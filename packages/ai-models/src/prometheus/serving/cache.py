"""
Prediction Caching for Prometheus AI.

Provides Redis-based caching for model predictions to reduce
latency and computational load.
"""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime
from typing import Any

from prometheus.config import RedisConfig

logger = logging.getLogger(__name__)


class PredictionCache:
    """
    Redis-based cache for model predictions.

    Args:
        config: Redis configuration
        default_ttl: Default TTL in seconds
    """

    def __init__(
        self,
        config: RedisConfig,
        default_ttl: int = 300,
    ) -> None:
        self.config = config
        self.default_ttl = default_ttl
        self._client = None
        self._connected = False

        # Cache key prefixes
        self._prefix = "prometheus:cache:"

    async def connect(self) -> None:
        """Establish Redis connection."""
        try:
            import redis.asyncio as redis

            self._client = redis.Redis(
                host=self.config.host,
                port=self.config.port,
                db=self.config.db,
                password=self.config.password,
                ssl=self.config.ssl,
                decode_responses=True,
            )

            # Test connection
            await self._client.ping()
            self._connected = True
            logger.info("Connected to Redis cache")

        except ImportError:
            logger.warning("redis-py not installed, caching disabled")
            self._connected = False

        except Exception as e:
            logger.warning(f"Failed to connect to Redis: {e}")
            self._connected = False

    async def close(self) -> None:
        """Close Redis connection."""
        if self._client:
            await self._client.close()
            self._connected = False
            logger.info("Redis connection closed")

    def _make_key(self, model_type: str, key: str) -> str:
        """Generate cache key."""
        return f"{self._prefix}{model_type}:{key}"

    def _hash_features(self, features: list | dict) -> str:
        """Generate hash for feature data."""
        data = json.dumps(features, sort_keys=True, default=str)
        return hashlib.sha256(data.encode()).hexdigest()[:16]

    async def get_prediction(
        self,
        model_type: str,
        key: str,
    ) -> dict[str, Any] | None:
        """
        Get cached prediction.

        Args:
            model_type: Type of model (earnings, difficulty, sentinel)
            key: Cache key (e.g., worker_id or hashed features)

        Returns:
            Cached prediction or None if not found
        """
        if not self._connected or not self._client:
            return None

        try:
            cache_key = self._make_key(model_type, key)
            data = await self._client.get(cache_key)

            if data:
                cached = json.loads(data)
                logger.debug(f"Cache hit: {cache_key}")
                return cached

            logger.debug(f"Cache miss: {cache_key}")
            return None

        except Exception as e:
            logger.warning(f"Cache get error: {e}")
            return None

    async def set_prediction(
        self,
        model_type: str,
        key: str,
        value: dict[str, Any],
        ttl: int | None = None,
    ) -> bool:
        """
        Cache a prediction.

        Args:
            model_type: Type of model
            key: Cache key
            value: Prediction data to cache
            ttl: Time-to-live in seconds (optional)

        Returns:
            True if cached successfully
        """
        if not self._connected or not self._client:
            return False

        try:
            cache_key = self._make_key(model_type, key)
            ttl = ttl or self.default_ttl

            # Add cache metadata
            cached_value = {
                **value,
                "_cached_at": datetime.now().isoformat(),
            }

            # Handle datetime serialization
            data = json.dumps(cached_value, default=str)
            await self._client.setex(cache_key, ttl, data)

            logger.debug(f"Cached: {cache_key} (TTL: {ttl}s)")
            return True

        except Exception as e:
            logger.warning(f"Cache set error: {e}")
            return False

    async def invalidate(
        self,
        model_type: str,
        key: str,
    ) -> bool:
        """
        Invalidate a cached prediction.

        Args:
            model_type: Type of model
            key: Cache key

        Returns:
            True if invalidated successfully
        """
        if not self._connected or not self._client:
            return False

        try:
            cache_key = self._make_key(model_type, key)
            deleted = await self._client.delete(cache_key)
            logger.debug(f"Invalidated: {cache_key} (deleted: {deleted})")
            return deleted > 0

        except Exception as e:
            logger.warning(f"Cache invalidate error: {e}")
            return False

    async def invalidate_pattern(
        self,
        model_type: str,
        pattern: str = "*",
    ) -> int:
        """
        Invalidate multiple cached predictions matching a pattern.

        Args:
            model_type: Type of model
            pattern: Key pattern (e.g., "worker_*")

        Returns:
            Number of keys invalidated
        """
        if not self._connected or not self._client:
            return 0

        try:
            full_pattern = self._make_key(model_type, pattern)
            keys = []

            async for key in self._client.scan_iter(match=full_pattern):
                keys.append(key)

            if keys:
                deleted = await self._client.delete(*keys)
                logger.info(f"Invalidated {deleted} keys matching {full_pattern}")
                return deleted

            return 0

        except Exception as e:
            logger.warning(f"Cache invalidate pattern error: {e}")
            return 0

    async def get_or_compute(
        self,
        model_type: str,
        key: str,
        compute_fn: callable,
        ttl: int | None = None,
    ) -> dict[str, Any]:
        """
        Get cached value or compute and cache it.

        Args:
            model_type: Type of model
            key: Cache key
            compute_fn: Async function to compute value if not cached
            ttl: Cache TTL

        Returns:
            Cached or computed value
        """
        # Try cache first
        cached = await self.get_prediction(model_type, key)
        if cached is not None:
            return cached

        # Compute value
        result = await compute_fn()

        # Cache the result
        await self.set_prediction(model_type, key, result, ttl)

        return result

    async def get_stats(self) -> dict[str, Any]:
        """Get cache statistics."""
        if not self._connected or not self._client:
            return {"connected": False}

        try:
            info = await self._client.info("stats")
            keys = await self._client.dbsize()

            return {
                "connected": True,
                "total_keys": keys,
                "hits": info.get("keyspace_hits", 0),
                "misses": info.get("keyspace_misses", 0),
                "hit_rate": (
                    info.get("keyspace_hits", 0)
                    / (info.get("keyspace_hits", 0) + info.get("keyspace_misses", 1))
                ),
            }

        except Exception as e:
            logger.warning(f"Failed to get cache stats: {e}")
            return {"connected": True, "error": str(e)}


class InMemoryCache:
    """
    In-memory cache fallback when Redis is unavailable.

    Uses a simple LRU-style dictionary with TTL support.
    """

    def __init__(
        self,
        max_size: int = 1000,
        default_ttl: int = 300,
    ) -> None:
        self.max_size = max_size
        self.default_ttl = default_ttl
        self._cache: dict[str, tuple[Any, float]] = {}
        self._access_order: list[str] = []

    def _is_expired(self, timestamp: float, ttl: int) -> bool:
        """Check if cache entry is expired."""
        from time import time
        return time() - timestamp > ttl

    def _evict_if_needed(self) -> None:
        """Evict oldest entries if cache is full."""
        while len(self._cache) >= self.max_size and self._access_order:
            oldest_key = self._access_order.pop(0)
            self._cache.pop(oldest_key, None)

    async def get_prediction(
        self,
        model_type: str,
        key: str,
    ) -> dict[str, Any] | None:
        """Get cached prediction."""
        cache_key = f"{model_type}:{key}"

        if cache_key in self._cache:
            value, timestamp = self._cache[cache_key]
            if not self._is_expired(timestamp, self.default_ttl):
                # Update access order
                if cache_key in self._access_order:
                    self._access_order.remove(cache_key)
                self._access_order.append(cache_key)
                return value

            # Expired, remove
            del self._cache[cache_key]
            if cache_key in self._access_order:
                self._access_order.remove(cache_key)

        return None

    async def set_prediction(
        self,
        model_type: str,
        key: str,
        value: dict[str, Any],
        ttl: int | None = None,
    ) -> bool:
        """Cache a prediction."""
        from time import time

        cache_key = f"{model_type}:{key}"

        self._evict_if_needed()

        self._cache[cache_key] = (value, time())

        if cache_key in self._access_order:
            self._access_order.remove(cache_key)
        self._access_order.append(cache_key)

        return True

    async def invalidate(
        self,
        model_type: str,
        key: str,
    ) -> bool:
        """Invalidate a cached prediction."""
        cache_key = f"{model_type}:{key}"

        if cache_key in self._cache:
            del self._cache[cache_key]
            if cache_key in self._access_order:
                self._access_order.remove(cache_key)
            return True

        return False

    async def connect(self) -> None:
        """No-op for in-memory cache."""
        pass

    async def close(self) -> None:
        """Clear cache on close."""
        self._cache.clear()
        self._access_order.clear()
