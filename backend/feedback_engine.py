"""
Feedback Engine
Compares current joint angles against physiotherapist-configured targets
and provides real-time corrective guidance to the user.
"""

from dataclasses import dataclass, field
from typing import Optional, List
from enum import Enum
import time


# ─── Enums & Types ───────────────────────────────────────────────────────────

class FeedbackStatus(str, Enum):
    PERFECT = "perfect"
    INCREASE = "increase"
    DECREASE = "decrease"
    NO_DETECTION = "no_detection"
    IDLE = "idle"


class FeedbackSeverity(str, Enum):
    GOOD = "good"       # Within tolerance
    WARNING = "warning" # Close (within 2× tolerance)
    ERROR = "error"     # Far from target


@dataclass
class FeedbackResult:
    """Complete feedback evaluation result."""
    status: FeedbackStatus
    message: str
    detail: str
    severity: FeedbackSeverity
    current_angle: Optional[float]
    target_angle: Optional[float]
    tolerance: Optional[float]
    delta: Optional[float]          # How far from target
    color: str                      # Hex color for UI
    icon: str                       # Emoji icon for UI
    timestamp: float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        return {
            "status": self.status.value,
            "message": self.message,
            "detail": self.detail,
            "severity": self.severity.value,
            "current_angle": self.current_angle,
            "target_angle": self.target_angle,
            "tolerance": self.tolerance,
            "delta": self.delta,
            "color": self.color,
            "icon": self.icon,
            "timestamp": self.timestamp
        }


@dataclass
class ExerciseConfig:
    """Active exercise configuration set by physiotherapist."""
    name: str
    joint: str
    target_angle: float
    tolerance: float
    reps_target: int = 10
    hold_seconds: float = 2.0
    description: str = ""
    id: Optional[str] = None


# ─── Feedback Engine ─────────────────────────────────────────────────────────

class FeedbackEngine:
    """
    Real-time feedback engine that evaluates user performance against
    physiotherapist-defined exercise parameters.
    """

    # Message templates
    _MESSAGES = {
        FeedbackStatus.PERFECT: {
            "message": "Perfect! Hold it.",
            "detail": "Your angle is within the target range. Excellent form!",
            "color": "#00ff88",
            "icon": "✅"
        },
        FeedbackStatus.INCREASE: {
            "message": "Increase movement",
            "detail": "You need to move further. Keep going!",
            "color": "#ff6b35",
            "icon": "⬆️"
        },
        FeedbackStatus.DECREASE: {
            "message": "Reduce movement",
            "detail": "You have gone too far. Bring it back slowly.",
            "color": "#ff4757",
            "icon": "⬇️"
        },
        FeedbackStatus.NO_DETECTION: {
            "message": "Pose not detected",
            "detail": "Make sure your full body is visible to the camera.",
            "color": "#ffa502",
            "icon": "👁️"
        },
        FeedbackStatus.IDLE: {
            "message": "Waiting to start",
            "detail": "Select an exercise and press Start Session.",
            "color": "#747d8c",
            "icon": "⏸️"
        }
    }

    def __init__(self):
        self._config: Optional[ExerciseConfig] = None
        self._last_result: Optional[FeedbackResult] = None

    def set_config(self, config: ExerciseConfig):
        """Set the active exercise configuration."""
        self._config = config

    def clear_config(self):
        """Clear active exercise (returns idle state)."""
        self._config = None

    def evaluate(
        self,
        current_angle: Optional[float]
    ) -> FeedbackResult:
        """
        Evaluate current angle against active exercise config.
        
        Args:
            current_angle: Current measured angle in degrees (None if not detected)
        
        Returns:
            FeedbackResult with status, message, color, and metadata
        """
        # No exercise configured
        if self._config is None:
            return self._make_result(FeedbackStatus.IDLE, None)

        # Pose not detected
        if current_angle is None:
            return self._make_result(FeedbackStatus.NO_DETECTION, None)

        target = self._config.target_angle
        tolerance = self._config.tolerance
        delta = current_angle - target

        # Within tolerance range → PERFECT
        if abs(delta) <= tolerance:
            status = FeedbackStatus.PERFECT
            severity = FeedbackSeverity.GOOD

        # Too low (need to increase)
        elif current_angle < target - tolerance:
            status = FeedbackStatus.INCREASE
            # Severity based on how far off
            if abs(delta) <= tolerance * 2:
                severity = FeedbackSeverity.WARNING
            else:
                severity = FeedbackSeverity.ERROR

        # Too high (need to decrease)
        else:
            status = FeedbackStatus.DECREASE
            if abs(delta) <= tolerance * 2:
                severity = FeedbackSeverity.WARNING
            else:
                severity = FeedbackSeverity.ERROR

        result = self._make_result(status, current_angle, severity, delta)
        self._last_result = result
        return result

    def evaluate_batch(
        self,
        angles: dict,
        joint_name: Optional[str] = None
    ) -> FeedbackResult:
        """
        Evaluate all angles or a specific joint from a batch.
        
        Args:
            angles: {joint_name: angle_degrees}
            joint_name: Override joint to evaluate (uses config joint if None)
        
        Returns:
            FeedbackResult for the active joint
        """
        joint = joint_name or (self._config.joint if self._config else None)
        if joint is None:
            return self._make_result(FeedbackStatus.IDLE, None)

        angle = angles.get(joint)
        return self.evaluate(angle)

    def get_last_result(self) -> Optional[FeedbackResult]:
        return self._last_result

    def get_config(self) -> Optional[ExerciseConfig]:
        return self._config

    # ─── Internal ────────────────────────────────────────────────────────────

    def _make_result(
        self,
        status: FeedbackStatus,
        current_angle: Optional[float],
        severity: FeedbackSeverity = FeedbackSeverity.GOOD,
        delta: Optional[float] = None
    ) -> FeedbackResult:
        tmpl = self._MESSAGES[status]
        return FeedbackResult(
            status=status,
            message=tmpl["message"],
            detail=tmpl["detail"],
            severity=severity,
            current_angle=current_angle,
            target_angle=self._config.target_angle if self._config else None,
            tolerance=self._config.tolerance if self._config else None,
            delta=round(delta, 2) if delta is not None else None,
            color=tmpl["color"],
            icon=tmpl["icon"]
        )


# ─── Singleton ───────────────────────────────────────────────────────────────
_feedback_engine = FeedbackEngine()


def get_feedback_engine() -> FeedbackEngine:
    return _feedback_engine
