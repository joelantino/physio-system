"""
Pose Detection Engine — MediaPipe Holistic + OpenCV
Captures webcam feed, detects 33 full-body landmarks, and provides
MJPEG stream with skeleton overlay.
"""

import cv2
import mediapipe as mp
import numpy as np
import threading
import time
from typing import Optional, Dict, List

# ─── MediaPipe Setup ────────────────────────────────────────────────────────
mp_holistic = mp.solutions.holistic
mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles
mp_pose = mp.solutions.pose


# ─── Drawing Spec ───────────────────────────────────────────────────────────
LANDMARK_STYLE = mp_drawing.DrawingSpec(
    color=(0, 255, 170), thickness=3, circle_radius=4
)
CONNECTION_STYLE = mp_drawing.DrawingSpec(
    color=(0, 180, 255), thickness=2, circle_radius=2
)


class PoseEngine:
    """
    Thread-safe pose detection engine using MediaPipe Holistic.
    Runs in a background thread and exposes:
    - MJPEG frame generator
    - Latest landmark coordinates
    """

    def __init__(self, camera_index: int = 0, width: int = 1280, height: int = 720):
        self.camera_index = camera_index
        self.width = width
        self.height = height

        # State
        self._lock = threading.Lock()
        self._running = False
        self._thread: Optional[threading.Thread] = None

        # Frame & landmark buffers
        self._frame: Optional[np.ndarray] = None
        self._annotated_frame: Optional[np.ndarray] = None
        self._landmarks: Dict[int, Dict[str, float]] = {}
        self._visibility: Dict[int, float] = {}
        self._fps: float = 0.0
        self._detection_active: bool = False

        # Highlight joints (for feedback visualization)
        self._highlight_joints: List[int] = []
        self._highlight_color: tuple = (0, 0, 255)
        self._highlight_label: str = ""
        self._feedback_msg: str = ""
        self._feedback_color: tuple = (255, 255, 255)

    # ─── Public Interface ────────────────────────────────────────────────────

    def start(self):
        """Start the pose detection background thread."""
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._detection_loop, daemon=True)
        self._thread.start()

    def stop(self):
        """Stop the pose detection thread."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=3)

    def get_landmarks(self) -> Dict[int, Dict[str, float]]:
        """Return latest landmark coordinates {idx: {x, y, z, visibility}}."""
        with self._lock:
            return dict(self._landmarks)

    def get_annotated_frame(self) -> Optional[np.ndarray]:
        """Return latest frame with skeleton overlay."""
        with self._lock:
            return self._annotated_frame.copy() if self._annotated_frame is not None else None

    def get_fps(self) -> float:
        with self._lock:
            return self._fps

    def is_detection_active(self) -> bool:
        with self._lock:
            return self._detection_active

    def set_highlight_joints(self, joint_indices: List[int], color: tuple = (0, 0, 255), label: str = ""):
        """Highlight specific landmark indices in a given color and draw text (for feedback)."""
        with self._lock:
            self._highlight_joints = joint_indices
            self._highlight_color = color
            self._highlight_label = label

    def set_feedback_message(self, msg: str, color: tuple = (255, 255, 255)):
        """Set a main banner message for the camera feed overlay."""
        with self._lock:
            self._feedback_msg = msg
            self._feedback_color = color

    def clear_highlights(self):
        with self._lock:
            self._highlight_joints = []
            self._highlight_label = ""
            self._feedback_msg = ""

    def mjpeg_generator(self):
        """Generator yielding MJPEG frames for FastAPI StreamingResponse."""
        while True:
            frame = self.get_annotated_frame()
            if frame is None:
                time.sleep(0.033)
                continue
            _, buffer = cv2.imencode(
                '.jpg', frame,
                [cv2.IMWRITE_JPEG_QUALITY, 85]
            )
            yield (
                b'--frame\r\n'
                b'Content-Type: image/jpeg\r\n\r\n'
                + buffer.tobytes()
                + b'\r\n'
            )

    # ─── Internal Detection Loop ─────────────────────────────────────────────

    def _detection_loop(self):
        cap = cv2.VideoCapture(self.camera_index)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
        cap.set(cv2.CAP_PROP_FPS, 30)

        prev_time = time.time()
        frame_count = 0

        with mp_holistic.Holistic(
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
            model_complexity=1
        ) as holistic:
            while self._running:
                ret, frame = cap.read()
                if not ret:
                    time.sleep(0.05)
                    continue

                # Flip for mirror effect
                frame = cv2.flip(frame, 1)
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                rgb.flags.writeable = False
                results = holistic.process(rgb)
                rgb.flags.writeable = True
                annotated = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)

                # Extract landmarks
                landmarks = {}
                detection_active = False

                if results.pose_landmarks:
                    detection_active = True
                    h, w = frame.shape[:2]
                    for idx, lm in enumerate(results.pose_landmarks.landmark):
                        landmarks[idx] = {
                            'x': lm.x,
                            'y': lm.y,
                            'z': lm.z,
                            'visibility': lm.visibility,
                            'x_px': int(lm.x * w),
                            'y_px': int(lm.y * h)
                        }

                    # Draw standard pose skeleton
                    mp_drawing.draw_landmarks(
                        annotated,
                        results.pose_landmarks,
                        mp_holistic.POSE_CONNECTIONS,
                        landmark_drawing_spec=LANDMARK_STYLE,
                        connection_drawing_spec=CONNECTION_STYLE
                    )

                    # Draw highlighted joints (feedback)
                    with self._lock:
                        highlight_joints = list(self._highlight_joints)
                        highlight_color = self._highlight_color
                        highlight_label = self._highlight_label

                    for i, idx in enumerate(highlight_joints):
                        if idx in landmarks:
                            cx, cy = landmarks[idx]['x_px'], landmarks[idx]['y_px']
                            cv2.circle(annotated, (cx, cy), 12, highlight_color, -1)
                            cv2.circle(annotated, (cx, cy), 14, (255, 255, 255), 2)
                            # Draw label precisely on the vertex (the middle joint of the 3)
                            if highlight_label and i == 1:
                                cv2.putText(
                                    annotated, highlight_label, (cx + 20, cy - 20),
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, highlight_color, 2
                                )

                # ─ FPS Counter ──────────────────────────────────────────────
                frame_count += 1
                current_time = time.time()
                elapsed = current_time - prev_time
                if elapsed >= 1.0:
                    fps = frame_count / elapsed
                    prev_time = current_time
                    frame_count = 0
                else:
                    fps = self._fps

                # ─ HUD Overlay ──────────────────────────────────────────────
                annotated = self._draw_hud(annotated, fps, detection_active, landmarks)

                # Update buffers
                with self._lock:
                    self._landmarks = landmarks
                    self._annotated_frame = annotated
                    self._fps = fps
                    self._detection_active = detection_active

        cap.release()

    def _draw_hud(
        self, frame: np.ndarray,
        fps: float,
        active: bool,
        landmarks: dict
    ) -> np.ndarray:
        """Draw HUD overlay: FPS, detection status, landmark count."""
        h, w = frame.shape[:2]

        # Semi-transparent top bar
        overlay = frame.copy()
        cv2.rectangle(overlay, (0, 0), (w, 50), (10, 10, 30), -1)
        cv2.addWeighted(overlay, 0.7, frame, 0.3, 0, frame)

        # FPS
        cv2.putText(
            frame, f"FPS: {fps:.1f}", (10, 35),
            cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 170), 2
        )

        # Detection status
        status_text = f"TRACKING: {'ACTIVE' if active else 'NO POSE'}"
        status_color = (0, 255, 100) if active else (0, 80, 255)
        cv2.putText(
            frame, status_text, (w // 2 - 100, 35),
            cv2.FONT_HERSHEY_SIMPLEX, 0.8, status_color, 2
        )

        # Landmark count
        lm_count = len(landmarks)
        cv2.putText(
            frame, f"Joints: {lm_count}/33", (w - 180, 35),
            cv2.FONT_HERSHEY_SIMPLEX, 0.8, (200, 200, 255), 2
        )

        # Bottom watermark
        cv2.putText(
            frame, "PhysioAI v1.0 — Real-Time Pose Analysis",
            (10, h - 10),
            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (100, 100, 150), 1
        )

        # Main Feedback Banner Overlay
        with self._lock:
            msg = self._feedback_msg
            color = self._feedback_color
            
        if msg:
            text_size = cv2.getTextSize(msg, cv2.FONT_HERSHEY_DUPLEX, 1.0, 2)[0]
            tx = (w - text_size[0]) // 2
            ty = h - 60
            cv2.rectangle(frame, (tx - 20, ty - 35), (tx + text_size[0] + 20, ty + 15), (20, 20, 25), -1)
            cv2.rectangle(frame, (tx - 20, ty - 35), (tx + text_size[0] + 20, ty + 15), color, 2)
            cv2.putText(frame, msg, (tx, ty - 2), cv2.FONT_HERSHEY_DUPLEX, 1.0, color, 2)

        return frame


# ─── Singleton Instance ──────────────────────────────────────────────────────
_engine_instance: Optional[PoseEngine] = None


def get_engine() -> PoseEngine:
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = PoseEngine()
        _engine_instance.start()
    return _engine_instance
