"""
Worker Optimization Module.

Provides optimization recommendations for mining hardware configuration
based on GPU profiles, current conditions, and historical performance data.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)


class OptimizationTarget(Enum):
    """Optimization objectives."""

    EFFICIENCY = "efficiency"  # Maximize hashrate per watt
    PROFITABILITY = "profitability"  # Maximize earnings
    LONGEVITY = "longevity"  # Minimize hardware stress
    BALANCED = "balanced"  # Balance all factors


@dataclass
class HardwareProfile:
    """Hardware configuration profile for a mining device."""

    device_id: str
    device_name: str
    gpu_model: str
    base_hashrate: float  # MH/s
    base_power: float  # Watts
    memory_size_gb: float
    core_clock: int  # MHz
    memory_clock: int  # MHz
    power_limit: float  # Percentage of TDP
    fan_speed: int  # Percentage
    temperature: float  # Celsius
    vram_temperature: float | None = None  # Celsius (for newer cards)
    efficiency: float = 0.0  # MH/J (calculated)

    def __post_init__(self) -> None:
        """Calculate efficiency after initialization."""
        if self.base_power > 0:
            self.efficiency = self.base_hashrate / self.base_power


@dataclass
class OptimizationSuggestion:
    """A single optimization suggestion."""

    parameter: str
    current_value: float | int
    suggested_value: float | int
    expected_impact: str
    confidence: float
    priority: int  # 1 = highest priority
    risk_level: str  # low, medium, high


@dataclass
class OptimizationResult:
    """Container for optimization results."""

    worker_id: str
    current_efficiency: float
    predicted_efficiency: float
    expected_improvement_percent: float
    suggestions: list[OptimizationSuggestion]
    warnings: list[str] = field(default_factory=list)
    optimization_target: OptimizationTarget = OptimizationTarget.BALANCED


# GPU profiles with optimal settings for common mining GPUs
GPU_PROFILES: dict[str, dict[str, Any]] = {
    # NVIDIA RTX 40 Series
    "RTX 4090": {
        "optimal_core_clock_offset": -200,
        "optimal_memory_clock_offset": 1200,
        "optimal_power_limit": 75,
        "max_safe_temp": 83,
        "max_safe_vram_temp": 95,
        "expected_hashrate": 130.0,  # MH/s for ETH-like
        "expected_power": 300,
        "tdp": 450,
    },
    "RTX 4080": {
        "optimal_core_clock_offset": -200,
        "optimal_memory_clock_offset": 1000,
        "optimal_power_limit": 70,
        "max_safe_temp": 83,
        "max_safe_vram_temp": 95,
        "expected_hashrate": 95.0,
        "expected_power": 230,
        "tdp": 320,
    },
    "RTX 4070 Ti": {
        "optimal_core_clock_offset": -200,
        "optimal_memory_clock_offset": 900,
        "optimal_power_limit": 70,
        "max_safe_temp": 83,
        "max_safe_vram_temp": 95,
        "expected_hashrate": 75.0,
        "expected_power": 180,
        "tdp": 285,
    },
    # NVIDIA RTX 30 Series
    "RTX 3090": {
        "optimal_core_clock_offset": -200,
        "optimal_memory_clock_offset": 1100,
        "optimal_power_limit": 73,
        "max_safe_temp": 80,
        "max_safe_vram_temp": 96,
        "expected_hashrate": 120.0,
        "expected_power": 280,
        "tdp": 350,
    },
    "RTX 3080": {
        "optimal_core_clock_offset": -200,
        "optimal_memory_clock_offset": 1000,
        "optimal_power_limit": 70,
        "max_safe_temp": 80,
        "max_safe_vram_temp": 96,
        "expected_hashrate": 100.0,
        "expected_power": 230,
        "tdp": 320,
    },
    "RTX 3070": {
        "optimal_core_clock_offset": -200,
        "optimal_memory_clock_offset": 1100,
        "optimal_power_limit": 55,
        "max_safe_temp": 80,
        "max_safe_vram_temp": None,
        "expected_hashrate": 62.0,
        "expected_power": 125,
        "tdp": 220,
    },
    "RTX 3060 Ti": {
        "optimal_core_clock_offset": -200,
        "optimal_memory_clock_offset": 1100,
        "optimal_power_limit": 60,
        "max_safe_temp": 80,
        "max_safe_vram_temp": None,
        "expected_hashrate": 60.0,
        "expected_power": 130,
        "tdp": 200,
    },
    # AMD RX 6000 Series
    "RX 6900 XT": {
        "optimal_core_clock_offset": -100,
        "optimal_memory_clock_offset": 50,
        "optimal_power_limit": 80,
        "max_safe_temp": 90,
        "max_safe_vram_temp": 95,
        "expected_hashrate": 65.0,
        "expected_power": 200,
        "tdp": 300,
    },
    "RX 6800 XT": {
        "optimal_core_clock_offset": -100,
        "optimal_memory_clock_offset": 50,
        "optimal_power_limit": 75,
        "max_safe_temp": 90,
        "max_safe_vram_temp": 95,
        "expected_hashrate": 63.0,
        "expected_power": 180,
        "tdp": 300,
    },
    "RX 6700 XT": {
        "optimal_core_clock_offset": -100,
        "optimal_memory_clock_offset": 50,
        "optimal_power_limit": 70,
        "max_safe_temp": 90,
        "max_safe_vram_temp": None,
        "expected_hashrate": 47.0,
        "expected_power": 140,
        "tdp": 230,
    },
    # AMD RX 7000 Series
    "RX 7900 XTX": {
        "optimal_core_clock_offset": -100,
        "optimal_memory_clock_offset": 100,
        "optimal_power_limit": 80,
        "max_safe_temp": 90,
        "max_safe_vram_temp": 95,
        "expected_hashrate": 85.0,
        "expected_power": 280,
        "tdp": 355,
    },
    "RX 7900 XT": {
        "optimal_core_clock_offset": -100,
        "optimal_memory_clock_offset": 100,
        "optimal_power_limit": 75,
        "max_safe_temp": 90,
        "max_safe_vram_temp": 95,
        "expected_hashrate": 75.0,
        "expected_power": 240,
        "tdp": 300,
    },
}

# Default profile for unknown GPUs
DEFAULT_GPU_PROFILE: dict[str, Any] = {
    "optimal_core_clock_offset": -100,
    "optimal_memory_clock_offset": 500,
    "optimal_power_limit": 70,
    "max_safe_temp": 80,
    "max_safe_vram_temp": 95,
    "expected_hashrate": 30.0,
    "expected_power": 150,
    "tdp": 200,
}


class WorkerOptimizer:
    """
    Optimizer for mining worker configurations.

    Analyzes hardware profiles and provides optimization suggestions
    based on GPU specifications, current settings, and thermal conditions.

    Args:
        config: Configuration dictionary
    """

    def __init__(self, config: dict[str, Any] | None = None) -> None:
        self.config = config or {}
        self.gpu_profiles = GPU_PROFILES.copy()

        # Allow custom profile overrides
        custom_profiles = self.config.get("custom_gpu_profiles", {})
        self.gpu_profiles.update(custom_profiles)

        # Optimization weights
        self.weights = {
            OptimizationTarget.EFFICIENCY: {"hashrate": 0.3, "power": 0.5, "temp": 0.2},
            OptimizationTarget.PROFITABILITY: {"hashrate": 0.6, "power": 0.3, "temp": 0.1},
            OptimizationTarget.LONGEVITY: {"hashrate": 0.1, "power": 0.3, "temp": 0.6},
            OptimizationTarget.BALANCED: {"hashrate": 0.4, "power": 0.3, "temp": 0.3},
        }

    def _get_gpu_profile(self, gpu_model: str) -> dict[str, Any]:
        """Get the profile for a GPU model."""
        # Try exact match first
        if gpu_model in self.gpu_profiles:
            return self.gpu_profiles[gpu_model]

        # Try partial match
        for profile_name in self.gpu_profiles:
            if profile_name.lower() in gpu_model.lower():
                return self.gpu_profiles[profile_name]

        logger.warning(f"No profile found for {gpu_model}, using defaults")
        return DEFAULT_GPU_PROFILE

    def _analyze_temperature(
        self,
        hardware: HardwareProfile,
        gpu_profile: dict[str, Any],
    ) -> list[OptimizationSuggestion]:
        """Analyze temperature and generate cooling suggestions."""
        suggestions = []

        max_safe_temp = gpu_profile["max_safe_temp"]
        max_safe_vram = gpu_profile.get("max_safe_vram_temp")

        # Core temperature check
        if hardware.temperature > max_safe_temp:
            temp_reduction_needed = hardware.temperature - max_safe_temp + 5

            # Suggest fan speed increase
            suggested_fan = min(100, hardware.fan_speed + 15)
            if suggested_fan > hardware.fan_speed:
                suggestions.append(
                    OptimizationSuggestion(
                        parameter="fan_speed",
                        current_value=hardware.fan_speed,
                        suggested_value=suggested_fan,
                        expected_impact=f"Reduce temperature by ~{temp_reduction_needed:.0f}°C",
                        confidence=0.8,
                        priority=1,
                        risk_level="low",
                    )
                )

            # Suggest power limit reduction
            suggested_power = max(50, hardware.power_limit - 10)
            if suggested_power < hardware.power_limit:
                suggestions.append(
                    OptimizationSuggestion(
                        parameter="power_limit",
                        current_value=hardware.power_limit,
                        suggested_value=suggested_power,
                        expected_impact="Lower temperature at cost of ~5% hashrate",
                        confidence=0.9,
                        priority=2,
                        risk_level="low",
                    )
                )

        elif hardware.temperature < max_safe_temp - 15:
            # Temperature is low, might be able to increase performance
            if hardware.power_limit < gpu_profile["optimal_power_limit"]:
                suggestions.append(
                    OptimizationSuggestion(
                        parameter="power_limit",
                        current_value=hardware.power_limit,
                        suggested_value=gpu_profile["optimal_power_limit"],
                        expected_impact="Increase hashrate by ~5-10%",
                        confidence=0.7,
                        priority=3,
                        risk_level="medium",
                    )
                )

        # VRAM temperature check (for cards with memory temp sensors)
        if hardware.vram_temperature and max_safe_vram:
            if hardware.vram_temperature > max_safe_vram:
                suggestions.append(
                    OptimizationSuggestion(
                        parameter="memory_clock",
                        current_value=hardware.memory_clock,
                        suggested_value=hardware.memory_clock - 100,
                        expected_impact="Reduce VRAM temperature, prevent thermal throttling",
                        confidence=0.85,
                        priority=1,
                        risk_level="low",
                    )
                )

        return suggestions

    def _analyze_clocks(
        self,
        hardware: HardwareProfile,
        gpu_profile: dict[str, Any],
    ) -> list[OptimizationSuggestion]:
        """Analyze clock speeds and generate optimization suggestions."""
        suggestions = []

        optimal_mem_offset = gpu_profile["optimal_memory_clock_offset"]
        optimal_core_offset = gpu_profile["optimal_core_clock_offset"]

        # Memory clock optimization (most important for mining)
        # This is simplified - in reality, you'd compare against base clocks
        expected_mem = 2000 + optimal_mem_offset  # Simplified baseline
        if abs(hardware.memory_clock - expected_mem) > 100:
            suggestions.append(
                OptimizationSuggestion(
                    parameter="memory_clock",
                    current_value=hardware.memory_clock,
                    suggested_value=expected_mem,
                    expected_impact="Optimize memory bandwidth for mining",
                    confidence=0.75,
                    priority=2,
                    risk_level="medium",
                )
            )

        return suggestions

    def _analyze_power(
        self,
        hardware: HardwareProfile,
        gpu_profile: dict[str, Any],
        target: OptimizationTarget,
    ) -> list[OptimizationSuggestion]:
        """Analyze power settings and generate suggestions."""
        suggestions = []

        optimal_power = gpu_profile["optimal_power_limit"]
        expected_efficiency = (
            gpu_profile["expected_hashrate"] / gpu_profile["expected_power"]
        )

        current_efficiency = hardware.efficiency

        if target == OptimizationTarget.EFFICIENCY:
            # For efficiency, typically lower power limit helps
            if hardware.power_limit > optimal_power:
                suggestions.append(
                    OptimizationSuggestion(
                        parameter="power_limit",
                        current_value=hardware.power_limit,
                        suggested_value=optimal_power,
                        expected_impact=f"Improve efficiency from {current_efficiency:.3f} to ~{expected_efficiency:.3f} MH/J",
                        confidence=0.8,
                        priority=1,
                        risk_level="low",
                    )
                )
        elif target == OptimizationTarget.PROFITABILITY:
            # For profitability, balance hashrate and power
            if hardware.power_limit < optimal_power and hardware.temperature < 75:
                suggestions.append(
                    OptimizationSuggestion(
                        parameter="power_limit",
                        current_value=hardware.power_limit,
                        suggested_value=optimal_power,
                        expected_impact="Increase hashrate for higher earnings",
                        confidence=0.7,
                        priority=2,
                        risk_level="medium",
                    )
                )

        return suggestions

    def _calculate_expected_improvement(
        self,
        hardware: HardwareProfile,
        suggestions: list[OptimizationSuggestion],
        gpu_profile: dict[str, Any],
    ) -> tuple[float, float]:
        """
        Calculate expected efficiency after applying suggestions.

        Returns:
            Tuple of (predicted_efficiency, improvement_percent)
        """
        current_efficiency = hardware.efficiency
        predicted_efficiency = current_efficiency

        for suggestion in suggestions:
            if suggestion.parameter == "power_limit":
                # Power reduction typically improves efficiency
                power_ratio = suggestion.suggested_value / suggestion.current_value
                predicted_efficiency *= (1.0 + (1.0 - power_ratio) * 0.3)

            elif suggestion.parameter == "memory_clock":
                # Memory clock affects hashrate
                mem_diff = suggestion.suggested_value - suggestion.current_value
                if mem_diff > 0:
                    predicted_efficiency *= 1.05  # ~5% improvement
                else:
                    predicted_efficiency *= 0.97  # Small reduction for stability

            elif suggestion.parameter == "fan_speed":
                # Better cooling can enable higher performance
                predicted_efficiency *= 1.02

        # Clamp to reasonable values
        max_efficiency = gpu_profile["expected_hashrate"] / gpu_profile["expected_power"]
        predicted_efficiency = min(predicted_efficiency, max_efficiency * 1.1)

        improvement = ((predicted_efficiency / current_efficiency) - 1) * 100

        return predicted_efficiency, improvement

    def optimize(
        self,
        hardware: HardwareProfile,
        target: OptimizationTarget = OptimizationTarget.BALANCED,
    ) -> OptimizationResult:
        """
        Generate optimization suggestions for a mining worker.

        Args:
            hardware: Current hardware profile
            target: Optimization objective

        Returns:
            OptimizationResult with suggestions and predictions
        """
        gpu_profile = self._get_gpu_profile(hardware.gpu_model)
        suggestions: list[OptimizationSuggestion] = []
        warnings: list[str] = []

        # Analyze different aspects
        suggestions.extend(self._analyze_temperature(hardware, gpu_profile))
        suggestions.extend(self._analyze_clocks(hardware, gpu_profile))
        suggestions.extend(self._analyze_power(hardware, gpu_profile, target))

        # Generate warnings
        if hardware.temperature > gpu_profile["max_safe_temp"]:
            warnings.append(
                f"GPU temperature ({hardware.temperature}°C) exceeds safe limit "
                f"({gpu_profile['max_safe_temp']}°C)"
            )

        if hardware.vram_temperature:
            max_vram = gpu_profile.get("max_safe_vram_temp", 100)
            if hardware.vram_temperature > max_vram:
                warnings.append(
                    f"VRAM temperature ({hardware.vram_temperature}°C) is critical. "
                    "Immediate action required."
                )

        if hardware.efficiency < 0.1:
            warnings.append(
                "Extremely low efficiency detected. Check for hardware issues."
            )

        # Sort suggestions by priority
        suggestions.sort(key=lambda s: s.priority)

        # Calculate expected improvement
        predicted_efficiency, improvement = self._calculate_expected_improvement(
            hardware, suggestions, gpu_profile
        )

        return OptimizationResult(
            worker_id=hardware.device_id,
            current_efficiency=hardware.efficiency,
            predicted_efficiency=predicted_efficiency,
            expected_improvement_percent=improvement,
            suggestions=suggestions,
            warnings=warnings,
            optimization_target=target,
        )

    def optimize_batch(
        self,
        hardware_list: list[HardwareProfile],
        target: OptimizationTarget = OptimizationTarget.BALANCED,
    ) -> list[OptimizationResult]:
        """
        Optimize multiple workers.

        Args:
            hardware_list: List of hardware profiles
            target: Optimization objective

        Returns:
            List of OptimizationResult for each worker
        """
        return [self.optimize(hw, target) for hw in hardware_list]

    def get_optimal_settings(
        self,
        gpu_model: str,
        target: OptimizationTarget = OptimizationTarget.BALANCED,
    ) -> dict[str, Any]:
        """
        Get optimal settings for a GPU model.

        Args:
            gpu_model: GPU model name
            target: Optimization objective

        Returns:
            Dictionary of optimal settings
        """
        profile = self._get_gpu_profile(gpu_model)

        base_settings = {
            "core_clock_offset": profile["optimal_core_clock_offset"],
            "memory_clock_offset": profile["optimal_memory_clock_offset"],
            "power_limit": profile["optimal_power_limit"],
            "fan_curve": "auto",
        }

        # Adjust based on target
        if target == OptimizationTarget.EFFICIENCY:
            base_settings["power_limit"] = max(50, profile["optimal_power_limit"] - 5)
        elif target == OptimizationTarget.PROFITABILITY:
            base_settings["power_limit"] = min(100, profile["optimal_power_limit"] + 5)
        elif target == OptimizationTarget.LONGEVITY:
            base_settings["power_limit"] = max(50, profile["optimal_power_limit"] - 10)
            base_settings["memory_clock_offset"] = int(
                profile["optimal_memory_clock_offset"] * 0.9
            )

        return base_settings
