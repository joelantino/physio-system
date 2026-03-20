"""
FastAPI Backend — PhysioAI System
Main application entry point. Orchestrates pose engine, angle computation,
feedback engine, and session management via a clean REST API.
"""

import json
import sys
import time
import uuid
from pathlib import Path
from typing import Optional

import uvicorn
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent))

from pose_engine import get_engine
from angle_engine import (
    compute_all_angles, get_all_joint_names, compute_joint_angle,
    compute_derived_joints
)
from feedback_engine import (
    get_feedback_engine, ExerciseConfig, FeedbackStatus
)
from session_manager import get_session_manager

# ─── Setup ───────────────────────────────────────────────────────────────────
CONFIG_DIR = Path(__file__).parent.parent / "config"
EXERCISES_DIR = Path(__file__).parent.parent / "exercises"
EXERCISES_DIR.mkdir(exist_ok=True)

# Load templates
with open(CONFIG_DIR / "exercise_templates.json") as f:
    EXERCISE_TEMPLATES = json.load(f)

with open(CONFIG_DIR / "joint_map.json") as f:
    JOINT_MAP_DATA = json.load(f)

# ─── FastAPI App ─────────────────────────────────────────────────────────────
app = FastAPI(
    title="PhysioAI API",
    description="Real-time AI-powered physiotherapy system backend",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Pydantic Models ─────────────────────────────────────────────────────────

class ExerciseConfigRequest(BaseModel):
    name: str = Field(..., description="Exercise name")
    joint: str = Field(..., description="Joint key, e.g. 'left_knee'")
    target_angle: float = Field(..., ge=0, le=180, description="Target angle in degrees")
    tolerance: float = Field(10.0, ge=1, le=45, description="Acceptable angle deviation")
    reps_target: int = Field(10, ge=1, le=100)
    hold_seconds: float = Field(2.0, ge=0, le=30)
    description: str = ""


class SessionStartRequest(BaseModel):
    exercise_id: Optional[str] = None  # Template or custom exercise ID
    custom_config: Optional[ExerciseConfigRequest] = None


# ─── Startup ─────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    """Initialize pose engine on server start."""
    engine = get_engine()
    print("[PhysioAI] Backend started. Pose engine initialized.")
    print("[PhysioAI] Available joints:", get_all_joint_names())


# ─── Video Stream ─────────────────────────────────────────────────────────────

@app.get("/stream", tags=["Video"])
async def video_stream():
    """
    MJPEG video stream with real-time skeleton overlay.
    Open in <img src="/stream"> in the browser.
    """
    engine = get_engine()
    return StreamingResponse(
        engine.mjpeg_generator(),
        media_type="multipart/x-mixed-replace;boundary=frame"
    )


# ─── Pose Data ────────────────────────────────────────────────────────────────

@app.get("/landmarks", tags=["Pose"])
async def get_landmarks():
    """
    Get current landmark coordinates.
    Returns 33 MediaPipe Holistic landmarks with x, y, z, visibility.
    """
    engine = get_engine()
    return {
        "landmarks": engine.get_landmarks(),
        "detection_active": engine.is_detection_active(),
        "fps": engine.get_fps(),
        "timestamp": time.time()
    }


@app.get("/angles", tags=["Pose"])
async def get_angles():
    """
    Compute and return current joint angles for all configured joints.
    """
    engine = get_engine()
    landmarks = engine.get_landmarks()
    angles = compute_all_angles(landmarks)

    # Filter out None angles for cleaner response
    filtered = {k: v for k, v in angles.items() if v is not None}

    return {
        "angles": filtered,
        "all_angles": angles,
        "detection_active": engine.is_detection_active(),
        "fps": engine.get_fps(),
        "timestamp": time.time()
    }


@app.get("/angles/{joint_name}", tags=["Pose"])
async def get_single_angle(joint_name: str):
    """Get angle for a specific joint."""
    engine = get_engine()
    landmarks = engine.get_landmarks()
    angle = compute_joint_angle(joint_name, landmarks)

    if angle is None and not engine.is_detection_active():
        return {
            "joint": joint_name,
            "angle": None,
            "message": "Pose not detected"
        }

    return {
        "joint": joint_name,
        "angle": angle,
        "timestamp": time.time()
    }


# ─── Feedback ─────────────────────────────────────────────────────────────────

@app.get("/feedback", tags=["Feedback"])
async def get_feedback():
    """
    Get real-time feedback for the active exercise.
    Evaluates current joint angle against configured target.
    """
    engine = get_engine()
    fb_engine = get_feedback_engine()
    session_mgr = get_session_manager()

    landmarks = engine.get_landmarks()
    angles = compute_all_angles(landmarks)

    # Get feedback
    feedback = fb_engine.evaluate_batch(angles)
    
    # Calculate derived landmarks for virtual highlighting (Neck Tilt midpoints)
    derived = compute_derived_joints(landmarks)
    engine.set_derived_landmarks(derived)

    # Update session if active
    if session_mgr.is_active():
        config = fb_engine.get_config()
        current_angle = angles.get(config.joint) if config else None
        session_state = session_mgr.update(current_angle, feedback.status, feedback.severity.value)

        # Update pose engine highlights
        if config and feedback.status not in [FeedbackStatus.IDLE, FeedbackStatus.NO_DETECTION]:
            joint_def = JOINT_MAP_DATA["joints"].get(config.joint, {})
            indices = [
                joint_def.get("point_a"),
                joint_def.get("vertex"),
                joint_def.get("point_b")
            ]
            indices = [i for i in indices if i is not None]
            
            if feedback.status == FeedbackStatus.PERFECT:
                color = (0, 255, 136)
            elif feedback.status == FeedbackStatus.INCREASE:
                color = (0, 100, 255)
            else:
                color = (0, 0, 255)
                
            label = f"{feedback.current_angle:.1f} deg" if feedback.current_angle is not None else ""
            engine.set_highlight_joints(indices, color, label)
            engine.set_feedback_message(feedback.message, color)
        else:
            engine.clear_highlights()
    else:
        session_state = session_mgr.get_state()

    return {
        "feedback": feedback.to_dict(),
        "session": session_state,
        "timestamp": time.time()
    }


# ─── Exercise Configuration ───────────────────────────────────────────────────

@app.post("/exercise/configure", tags=["Exercise"])
async def configure_exercise(config: ExerciseConfigRequest):
    """
    Configure an exercise (physiotherapist endpoint).
    Sets the active exercise that feedback engine evaluates against.
    """
    valid_joints = get_all_joint_names()
    if config.joint not in valid_joints:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid joint '{config.joint}'. Valid joints: {valid_joints}"
        )

    exercise = ExerciseConfig(
        name=config.name,
        joint=config.joint,
        target_angle=config.target_angle,
        tolerance=config.tolerance,
        reps_target=config.reps_target,
        hold_seconds=config.hold_seconds,
        description=config.description,
        id=str(uuid.uuid4())
    )

    # Save to exercises dir
    ex_path = EXERCISES_DIR / f"{exercise.id}.json"
    with open(ex_path, "w") as f:
        json.dump({
            "id": exercise.id,
            "name": exercise.name,
            "joint": exercise.joint,
            "target_angle": exercise.target_angle,
            "tolerance": exercise.tolerance,
            "reps_target": exercise.reps_target,
            "hold_seconds": exercise.hold_seconds,
            "description": exercise.description
        }, f, indent=2)

    # Activate in feedback engine
    get_feedback_engine().set_config(exercise)

    return {
        "success": True,
        "exercise_id": exercise.id,
        "message": f"Exercise '{exercise.name}' configured on joint '{exercise.joint}'",
        "config": {
            "id": exercise.id,
            "name": exercise.name,
            "joint": exercise.joint,
            "target_angle": exercise.target_angle,
            "tolerance": exercise.tolerance
        }
    }


@app.get("/exercise/list", tags=["Exercise"])
async def list_exercises():
    """List all saved exercises and built-in templates."""
    # Custom exercises
    custom = []
    for p in EXERCISES_DIR.glob("*.json"):
        try:
            with open(p) as f:
                custom.append(json.load(f))
        except Exception:
            continue

    return {
        "templates": EXERCISE_TEMPLATES,
        "custom": custom,
        "active_config": (
            {
                "name": get_feedback_engine().get_config().name,
                "joint": get_feedback_engine().get_config().joint,
                "target_angle": get_feedback_engine().get_config().target_angle
            }
            if get_feedback_engine().get_config() else None
        )
    }


@app.post("/exercise/load-template/{template_id}", tags=["Exercise"])
async def load_template(template_id: str):
    """Load a built-in exercise template as the active exercise."""
    template = next((t for t in EXERCISE_TEMPLATES if t["id"] == template_id), None)
    if not template:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")

    exercise = ExerciseConfig(
        name=template["name"],
        joint=template["joint"],
        target_angle=template["target_angle"],
        tolerance=template["tolerance"],
        reps_target=template.get("reps_target", 10),
        hold_seconds=template.get("hold_seconds", 2.0),
        description=template.get("description", ""),
        id=template["id"]
    )
    get_feedback_engine().set_config(exercise)

    return {
        "success": True,
        "message": f"Template '{template['name']}' loaded",
        "config": template
    }


@app.get("/joints", tags=["Pose"])
async def list_joints():
    """Get all available joint names and their metadata."""
    return {
        "joints": JOINT_MAP_DATA["joints"],
        "joint_names": get_all_joint_names()
    }


# ─── Session Management ───────────────────────────────────────────────────────

@app.post("/session/start", tags=["Session"])
async def start_session(request: SessionStartRequest):
    """Start a new exercise session."""
    session_mgr = get_session_manager()
    fb_engine = get_feedback_engine()

    if session_mgr.is_active():
        raise HTTPException(status_code=400, detail="A session is already active. Stop it first.")

    # Determine config
    if request.custom_config:
        config = ExerciseConfig(
            name=request.custom_config.name,
            joint=request.custom_config.joint,
            target_angle=request.custom_config.target_angle,
            tolerance=request.custom_config.tolerance,
            reps_target=request.custom_config.reps_target,
            hold_seconds=request.custom_config.hold_seconds,
            description=request.custom_config.description
        )
        fb_engine.set_config(config)
    elif fb_engine.get_config():
        config = fb_engine.get_config()
    else:
        raise HTTPException(
            status_code=400,
            detail="No exercise configured. Please configure an exercise first."
        )

    session_id = session_mgr.start_session(config)
    return {
        "success": True,
        "session_id": session_id,
        "exercise": config.name,
        "joint": config.joint,
        "message": f"Session started for '{config.name}'"
    }


@app.post("/session/stop", tags=["Session"])
async def stop_session():
    """Stop the active session and return performance summary."""
    session_mgr = get_session_manager()
    get_engine().clear_highlights()

    summary = session_mgr.stop_session()
    if not summary:
        raise HTTPException(status_code=400, detail="No active session to stop.")

    return {
        "success": True,
        "summary": summary.to_dict()
    }


@app.get("/session/state", tags=["Session"])
async def get_session_state():
    """Get current session state (reps, elapsed, hold time)."""
    return get_session_manager().get_state()


@app.get("/session/history", tags=["Session"])
async def get_session_history():
    """List all completed sessions."""
    from session_manager import SessionManager
    return {"sessions": SessionManager.list_sessions()}


@app.get("/session/{session_id}", tags=["Session"])
async def get_session(session_id: str):
    """Retrieve a specific session summary by ID."""
    from session_manager import SessionManager
    data = SessionManager.load_session(session_id)
    if not data:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found")
    return data


# ─── Health Check ─────────────────────────────────────────────────────────────

@app.get("/health", tags=["System"])
async def health_check():
    """System health check."""
    engine = get_engine()
    return {
        "status": "ok",
        "fps": engine.get_fps(),
        "detection_active": engine.is_detection_active(),
        "session_active": get_session_manager().is_active(),
        "active_exercise": (
            get_feedback_engine().get_config().name
            if get_feedback_engine().get_config() else None
        ),
        "timestamp": time.time()
    }


# ─── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        workers=1
    )
