"""
Session Manager
Tracks user exercise sessions including angle history, repetition counting,
hold timing, and session summaries. Persists data to JSON files.
"""

import json
import time
import uuid
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Optional, List, Dict, Any
from enum import Enum

from feedback_engine import FeedbackStatus, ExerciseConfig

# Sessions directory
SESSIONS_DIR = Path(__file__).parent.parent / "sessions"
SESSIONS_DIR.mkdir(exist_ok=True)


# ─── Data Classes ─────────────────────────────────────────────────────────────

@dataclass
class AngleRecord:
    timestamp: float
    angle: float
    feedback_status: str


@dataclass
class SessionSummary:
    session_id: str
    exercise_name: str
    joint: str
    target_angle: float
    tolerance: float
    start_time: float
    end_time: float
    duration_seconds: float
    total_reps: int
    max_angle: Optional[float]
    min_angle: Optional[float]
    avg_angle: Optional[float]
    perfect_percentage: float
    angle_history: List[AngleRecord]
    completed: bool

    def to_dict(self) -> dict:
        d = asdict(self)
        d["angle_history"] = [asdict(r) for r in self.angle_history]
        d["start_time_iso"] = time.strftime(
            "%Y-%m-%dT%H:%M:%S", time.localtime(self.start_time)
        )
        d["end_time_iso"] = time.strftime(
            "%Y-%m-%dT%H:%M:%S", time.localtime(self.end_time)
        )
        return d


# ─── Session Manager ──────────────────────────────────────────────────────────

class SessionManager:
    """
    Manages physiotherapy exercise sessions:
    - Start/stop tracking
    - Record angle readings frame-by-frame
    - Count repetitions (crossing threshold)
    - Track hold time at target
    - Generate session summary
    """

    def __init__(self):
        self._active: bool = False
        self._session_id: Optional[str] = None
        self._config: Optional[ExerciseConfig] = None
        self._start_time: float = 0.0
        self._angle_history: List[AngleRecord] = []
        self._reps: int = 0
        self._hold_start: Optional[float] = None
        self._total_hold_time: float = 0.0
        self._perfect_frames: int = 0
        self._total_frames: int = 0

        # Rep detection state machine
        # A rep: goes OUT of target, then BACK IN (or vice versa, depending on exercise)
        self._in_target_zone: bool = False
        self._went_below_target: bool = False  # Passed through lower threshold
        self._went_above_target: bool = False  # Passed through upper threshold
        self._rep_direction: Optional[str] = None  # "increase" or "decrease"

    # ─── Session Control ─────────────────────────────────────────────────────

    def start_session(self, config: ExerciseConfig) -> str:
        """
        Begin a new session.
        
        Returns:
            session_id
        """
        self._session_id = str(uuid.uuid4())
        self._config = config
        self._start_time = time.time()
        self._angle_history = []
        self._reps = 0
        self._hold_start = None
        self._total_hold_time = 0.0
        self._perfect_frames = 0
        self._total_frames = 0
        self._in_target_zone = False
        self._went_below_target = False
        self._went_above_target = False
        self._rep_direction = None
        self._active = True

        print(f"[Session] Started: {self._session_id} | Exercise: {config.name}")
        return self._session_id

    def stop_session(self) -> Optional[SessionSummary]:
        """
        End the session and generate summary.
        
        Returns:
            SessionSummary or None if no active session
        """
        if not self._active or not self._config:
            return None

        end_time = time.time()
        duration = end_time - self._start_time

        # Compute aggregate stats
        angles = [r.angle for r in self._angle_history if r.angle is not None]
        max_angle = round(max(angles), 2) if angles else None
        min_angle = round(min(angles), 2) if angles else None
        avg_angle = round(sum(angles) / len(angles), 2) if angles else None
        perfect_pct = (
            round(self._perfect_frames / self._total_frames * 100, 1)
            if self._total_frames > 0 else 0.0
        )

        summary = SessionSummary(
            session_id=self._session_id,
            exercise_name=self._config.name,
            joint=self._config.joint,
            target_angle=self._config.target_angle,
            tolerance=self._config.tolerance,
            start_time=self._start_time,
            end_time=end_time,
            duration_seconds=round(duration, 2),
            total_reps=self._reps,
            max_angle=max_angle,
            min_angle=min_angle,
            avg_angle=avg_angle,
            perfect_percentage=perfect_pct,
            angle_history=list(self._angle_history),
            completed=True
        )

        # Persist to JSON
        self._save_session(summary)

        # Reset state
        self._active = False
        print(
            f"[Session] Stopped: {self._session_id} | "
            f"Reps: {self._reps} | Avg: {avg_angle}° | Duration: {duration:.1f}s"
        )

        return summary

    # ─── Frame-by-Frame Update ───────────────────────────────────────────────

    def update(
        self,
        angle: Optional[float],
        feedback_status: FeedbackStatus
    ) -> dict:
        """
        Record a single frame's angle and feedback status.
        Updates rep count, hold time tracking.
        
        Args:
            angle: Current measured angle (None if not detected)
            feedback_status: Current feedback enum
        
        Returns:
            Dict with current session state
        """
        if not self._active or not self._config:
            return self._state_dict()

        now = time.time()
        self._total_frames += 1

        if angle is not None:
            # Record angle
            self._angle_history.append(AngleRecord(
                timestamp=now,
                angle=angle,
                feedback_status=feedback_status.value
            ))

            # Track perfect frames
            if feedback_status == FeedbackStatus.PERFECT:
                self._perfect_frames += 1
                # Hold time tracking
                if self._hold_start is None:
                    self._hold_start = now
            else:
                # Left target zone — end hold
                if self._hold_start is not None:
                    self._total_hold_time += now - self._hold_start
                    self._hold_start = None

            # Rep detection
            self._detect_rep(angle, feedback_status)

        return self._state_dict()

    def _detect_rep(self, angle: float, status: FeedbackStatus):
        """
        State machine for repetition counting.
        A rep is: start outside target → enter target zone → exit again.
        Counts every time the user cycles through the target angle.
        """
        target = self._config.target_angle
        tolerance = self._config.tolerance
        lower = target - tolerance
        upper = target + tolerance

        in_zone = lower <= angle <= upper
        below = angle < lower
        above = angle > upper

        # If outside target zone, update where we are
        if not in_zone:
            if self._in_target_zone:
                # Just EXITED the target zone
                self._in_target_zone = False
                
                # If we came from below the target zone, and exited back below (Full Rep)
                if self._went_below_target and below:
                    self._reps += 1
                    self._went_below_target = False
                    self._went_above_target = False
                    print(f"[Rep] Count: {self._reps} (Full rep completed)")
                # OR If we came from above the target zone, and exited back above (Full Rep)
                elif self._went_above_target and above:
                    self._reps += 1
                    self._went_below_target = False
                    self._went_above_target = False
                    print(f"[Rep] Count: {self._reps} (Full rep completed)")
            else:
                # Track our origin point before entering the zone
                if below:
                    self._went_below_target = True
                    self._went_above_target = False
                elif above:
                    self._went_above_target = True
                    self._went_below_target = False

        elif in_zone and not self._in_target_zone:
            # Just ENTERED target zone
            self._in_target_zone = True

    # ─── State & Persistence ─────────────────────────────────────────────────

    def _state_dict(self) -> dict:
        elapsed = time.time() - self._start_time if self._active else 0
        hold_time = self._total_hold_time
        if self._hold_start is not None:
            hold_time += time.time() - self._hold_start
        return {
            "active": self._active,
            "session_id": self._session_id,
            "reps": self._reps,
            "elapsed_seconds": round(elapsed, 1),
            "total_hold_time": round(hold_time, 1),
            "perfect_frames": self._perfect_frames,
            "total_frames": self._total_frames,
            "perfect_percentage": round(
                self._perfect_frames / self._total_frames * 100, 1
            ) if self._total_frames > 0 else 0.0
        }

    def get_state(self) -> dict:
        return self._state_dict()

    def is_active(self) -> bool:
        return self._active

    def get_session_id(self) -> Optional[str]:
        return self._session_id

    def _save_session(self, summary: SessionSummary):
        """Persist session summary JSON to disk."""
        path = SESSIONS_DIR / f"{summary.session_id}.json"
        with open(path, "w") as f:
            json.dump(summary.to_dict(), f, indent=2)
        print(f"[Session] Saved to: {path}")

    @staticmethod
    def load_session(session_id: str) -> Optional[dict]:
        """Load a historical session by ID."""
        path = SESSIONS_DIR / f"{session_id}.json"
        if not path.exists():
            return None
        with open(path, "r") as f:
            return json.load(f)

    @staticmethod
    def list_sessions() -> List[dict]:
        """List all saved sessions (summary only, no angle history)."""
        sessions = []
        for p in sorted(SESSIONS_DIR.glob("*.json"), reverse=True):
            try:
                with open(p) as f:
                    data = json.load(f)
                # Return lightweight summary
                sessions.append({
                    "session_id": data.get("session_id"),
                    "exercise_name": data.get("exercise_name"),
                    "joint": data.get("joint"),
                    "total_reps": data.get("total_reps"),
                    "avg_angle": data.get("avg_angle"),
                    "duration_seconds": data.get("duration_seconds"),
                    "start_time_iso": data.get("start_time_iso"),
                    "perfect_percentage": data.get("perfect_percentage")
                })
            except Exception:
                continue
        return sessions


# ─── Singleton ───────────────────────────────────────────────────────────────
_session_manager = SessionManager()


def get_session_manager() -> SessionManager:
    return _session_manager
