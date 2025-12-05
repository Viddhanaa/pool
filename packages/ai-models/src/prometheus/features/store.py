"""
Feature Store Interface.

Provides a unified interface for storing and retrieving features
for model training and inference.
"""

from __future__ import annotations

import json
import logging
from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class StoredFeature:
    """A stored feature record."""

    entity_id: str
    feature_name: str
    value: float | list[float]
    timestamp: datetime
    metadata: dict[str, Any] | None = None


class FeatureStore(ABC):
    """
    Abstract base class for feature stores.

    Provides interface for storing, retrieving, and managing
    features for ML models.
    """

    @abstractmethod
    async def store_feature(
        self,
        entity_id: str,
        feature_name: str,
        value: float | list[float],
        timestamp: datetime | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Store a feature value."""
        pass

    @abstractmethod
    async def get_feature(
        self,
        entity_id: str,
        feature_name: str,
        timestamp: datetime | None = None,
    ) -> StoredFeature | None:
        """Retrieve a feature value."""
        pass

    @abstractmethod
    async def get_feature_history(
        self,
        entity_id: str,
        feature_name: str,
        start_time: datetime,
        end_time: datetime | None = None,
    ) -> list[StoredFeature]:
        """Retrieve feature history for a time range."""
        pass

    @abstractmethod
    async def delete_feature(
        self,
        entity_id: str,
        feature_name: str,
    ) -> bool:
        """Delete a feature."""
        pass


class InMemoryFeatureStore(FeatureStore):
    """
    In-memory feature store implementation.

    Suitable for development and testing. For production,
    use RedisFeatureStore or a dedicated feature store solution.
    """

    def __init__(self) -> None:
        self._store: dict[str, dict[str, list[StoredFeature]]] = {}

    def _get_key(self, entity_id: str, feature_name: str) -> str:
        """Generate storage key."""
        return f"{entity_id}:{feature_name}"

    async def store_feature(
        self,
        entity_id: str,
        feature_name: str,
        value: float | list[float],
        timestamp: datetime | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Store a feature value in memory."""
        timestamp = timestamp or datetime.now()

        if entity_id not in self._store:
            self._store[entity_id] = {}

        if feature_name not in self._store[entity_id]:
            self._store[entity_id][feature_name] = []

        feature = StoredFeature(
            entity_id=entity_id,
            feature_name=feature_name,
            value=value,
            timestamp=timestamp,
            metadata=metadata,
        )

        self._store[entity_id][feature_name].append(feature)

        # Keep sorted by timestamp
        self._store[entity_id][feature_name].sort(key=lambda x: x.timestamp)

    async def get_feature(
        self,
        entity_id: str,
        feature_name: str,
        timestamp: datetime | None = None,
    ) -> StoredFeature | None:
        """Retrieve the latest or point-in-time feature."""
        if entity_id not in self._store:
            return None

        if feature_name not in self._store[entity_id]:
            return None

        features = self._store[entity_id][feature_name]

        if not features:
            return None

        if timestamp is None:
            return features[-1]  # Latest

        # Find feature at or before timestamp
        for feature in reversed(features):
            if feature.timestamp <= timestamp:
                return feature

        return None

    async def get_feature_history(
        self,
        entity_id: str,
        feature_name: str,
        start_time: datetime,
        end_time: datetime | None = None,
    ) -> list[StoredFeature]:
        """Retrieve feature history for a time range."""
        end_time = end_time or datetime.now()

        if entity_id not in self._store:
            return []

        if feature_name not in self._store[entity_id]:
            return []

        features = self._store[entity_id][feature_name]

        return [
            f for f in features
            if start_time <= f.timestamp <= end_time
        ]

    async def delete_feature(
        self,
        entity_id: str,
        feature_name: str,
    ) -> bool:
        """Delete a feature from memory."""
        if entity_id not in self._store:
            return False

        if feature_name not in self._store[entity_id]:
            return False

        del self._store[entity_id][feature_name]
        return True

    async def get_all_features(
        self,
        entity_id: str,
        timestamp: datetime | None = None,
    ) -> dict[str, StoredFeature]:
        """Get all features for an entity."""
        if entity_id not in self._store:
            return {}

        result = {}
        for feature_name in self._store[entity_id]:
            feature = await self.get_feature(entity_id, feature_name, timestamp)
            if feature:
                result[feature_name] = feature

        return result

    async def get_feature_vector(
        self,
        entity_id: str,
        feature_names: list[str],
        timestamp: datetime | None = None,
    ) -> np.ndarray | None:
        """Get a feature vector for the specified features."""
        values = []

        for name in feature_names:
            feature = await self.get_feature(entity_id, name, timestamp)
            if feature is None:
                return None

            if isinstance(feature.value, list):
                values.extend(feature.value)
            else:
                values.append(feature.value)

        return np.array(values, dtype=np.float32)


class RedisFeatureStore(FeatureStore):
    """
    Redis-backed feature store implementation.

    Provides persistent feature storage with support for
    time-series data and TTL-based expiration.
    """

    def __init__(
        self,
        redis_url: str = "redis://localhost:6379",
        prefix: str = "prometheus:features:",
        default_ttl: int = 86400 * 7,  # 7 days
    ) -> None:
        self._redis_url = redis_url
        self._prefix = prefix
        self._default_ttl = default_ttl
        self._client = None

    async def _get_client(self) -> Any:
        """Get or create Redis client."""
        if self._client is None:
            import redis.asyncio as redis
            self._client = await redis.from_url(self._redis_url)
        return self._client

    def _make_key(self, entity_id: str, feature_name: str) -> str:
        """Generate Redis key."""
        return f"{self._prefix}{entity_id}:{feature_name}"

    async def store_feature(
        self,
        entity_id: str,
        feature_name: str,
        value: float | list[float],
        timestamp: datetime | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Store a feature value in Redis."""
        client = await self._get_client()
        timestamp = timestamp or datetime.now()

        key = self._make_key(entity_id, feature_name)

        feature_data = {
            "entity_id": entity_id,
            "feature_name": feature_name,
            "value": value if isinstance(value, list) else [value],
            "timestamp": timestamp.isoformat(),
            "metadata": metadata or {},
        }

        # Store as time-series using sorted set
        score = timestamp.timestamp()
        await client.zadd(key, {json.dumps(feature_data): score})

        # Set TTL
        await client.expire(key, self._default_ttl)

        # Also store latest value for quick access
        latest_key = f"{key}:latest"
        await client.set(latest_key, json.dumps(feature_data), ex=self._default_ttl)

    async def get_feature(
        self,
        entity_id: str,
        feature_name: str,
        timestamp: datetime | None = None,
    ) -> StoredFeature | None:
        """Retrieve a feature value from Redis."""
        client = await self._get_client()
        key = self._make_key(entity_id, feature_name)

        if timestamp is None:
            # Get latest
            latest_key = f"{key}:latest"
            data = await client.get(latest_key)
            if data:
                feature_data = json.loads(data)
                return self._parse_feature(feature_data)
            return None

        # Get point-in-time value
        score = timestamp.timestamp()
        results = await client.zrevrangebyscore(
            key, score, "-inf", start=0, num=1
        )

        if results:
            feature_data = json.loads(results[0])
            return self._parse_feature(feature_data)

        return None

    def _parse_feature(self, data: dict) -> StoredFeature:
        """Parse stored feature data."""
        value = data["value"]
        if len(value) == 1:
            value = value[0]

        return StoredFeature(
            entity_id=data["entity_id"],
            feature_name=data["feature_name"],
            value=value,
            timestamp=datetime.fromisoformat(data["timestamp"]),
            metadata=data.get("metadata"),
        )

    async def get_feature_history(
        self,
        entity_id: str,
        feature_name: str,
        start_time: datetime,
        end_time: datetime | None = None,
    ) -> list[StoredFeature]:
        """Retrieve feature history from Redis."""
        client = await self._get_client()
        end_time = end_time or datetime.now()

        key = self._make_key(entity_id, feature_name)
        start_score = start_time.timestamp()
        end_score = end_time.timestamp()

        results = await client.zrangebyscore(key, start_score, end_score)

        features = []
        for data in results:
            feature_data = json.loads(data)
            features.append(self._parse_feature(feature_data))

        return features

    async def delete_feature(
        self,
        entity_id: str,
        feature_name: str,
    ) -> bool:
        """Delete a feature from Redis."""
        client = await self._get_client()
        key = self._make_key(entity_id, feature_name)

        deleted = await client.delete(key, f"{key}:latest")
        return deleted > 0

    async def close(self) -> None:
        """Close Redis connection."""
        if self._client:
            await self._client.close()
            self._client = None
