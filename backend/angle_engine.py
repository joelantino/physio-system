"""
Angle Computation Engine
Computes joint angles from MediaPipe landmark coordinates using
vector dot-product formula. Supports all joints defined in joint_map.json.
"""

import json
import math
import numpy as np
from pathlib import Path
from typing import Dict, Optional, Tuple

# Load joint map
_CONFIG_PATH = Path(__file__).parent.parent / "config" / "joint_map.json"
with open(_CONFIG_PATH, "r") as f:
    JOINT_MAP = json.load(f)

JOINTS = JOINT_MAP["joints"]


# ─── Core Angle Math ─────────────────────────────────────────────────────────

def calculate_angle(a: np.ndarray, b: np.ndarray, c: np.ndarray) -> float:
    """
    Calculate the angle (in degrees) at vertex b, formed by rays b→a and b→c.
    
    Uses dot product formula:
        angle = arccos(  (BA · BC) / (|BA| * |BC|)  )
    
    Args:
        a: numpy array [x, y] or [x, y, z] for point A
        b: numpy array — the vertex/joint center
        c: numpy array — point C
    
    Returns:
        Angle in degrees (0–180)
    """
    a = np.array(a[:2], dtype=float)  # Use only x, y (2D angle)
    b = np.array(b[:2], dtype=float)
    c = np.array(c[:2], dtype=float)

    ba = a - b
    bc = c - b

    # Guard against zero-length vectors
    norm_ba = np.linalg.norm(ba)
    norm_bc = np.linalg.norm(bc)
    if norm_ba < 1e-6 or norm_bc < 1e-6:
        return 0.0

    cosine = np.dot(ba, bc) / (norm_ba * norm_bc)
    cosine = np.clip(cosine, -1.0, 1.0)  # Numerical stability
    angle = math.degrees(math.acos(cosine))

    return round(angle, 2)


def get_3d_angle(a: np.ndarray, b: np.ndarray, c: np.ndarray) -> float:
    """
    3D angle calculation using full (x, y, z) coordinates.
    More accurate when depth information is available.
    """
    a = np.array(a[:3], dtype=float)
    b = np.array(b[:3], dtype=float)
    c = np.array(c[:3], dtype=float)

    ba = a - b
    bc = c - b

    norm_ba = np.linalg.norm(ba)
    norm_bc = np.linalg.norm(bc)
    if norm_ba < 1e-6 or norm_bc < 1e-6:
        return 0.0

    cosine = np.dot(ba, bc) / (norm_ba * norm_bc)
    cosine = np.clip(cosine, -1.0, 1.0)
    return round(math.degrees(math.acos(cosine)), 2)


# ─── Joint Angle Computation ─────────────────────────────────────────────────

def compute_joint_angle(
    joint_name: str,
    landmarks: Dict,
    use_3d: bool = False
) -> Optional[float]:
    """
    Compute angle for a named joint given landmark data.
    Works with both standard (int) and derived (str) landmark keys.
    """
    if joint_name not in JOINTS:
        return None

    joint = JOINTS[joint_name]

    # Use coordinates defined in joint map
    if not all(k in joint for k in ["point_a", "vertex", "point_b"]):
        return None

    idx_a = joint["point_a"]
    idx_v = joint["vertex"]
    idx_b = joint["point_b"]

    # Ensure all three landmarks are present in the provided pool
    if not all(k in landmarks for k in [idx_a, idx_v, idx_b]):
        return None

    # Check visibility threshold (virtual/string joints default to 1.0)
    visibility_threshold = 0.1
    for idx in [idx_a, idx_v, idx_b]:
        if landmarks[idx].get("visibility", 1.0) < visibility_threshold:
            return None

    lm_a = landmarks[idx_a]
    lm_v = landmarks[idx_v]
    lm_b = landmarks[idx_b]

    if use_3d:
        a = [lm_a["x"], lm_a["y"], lm_a["z"]]
        b = [lm_v["x"], lm_v["y"], lm_v["z"]]
        c = [lm_b["x"], lm_b["y"], lm_b["z"]]
        angle = get_3d_angle(a, b, c)
    else:
        a = [lm_a["x"], lm_a["y"]]
        b = [lm_v["x"], lm_v["y"]]
        c = [lm_b["x"], lm_b["y"]]
        angle = calculate_angle(a, b, c)

    # Offset vertical joints (Neck, Tilts) to report 0 degrees when upright (instead of 180)
    if "neck" in joint_name.lower() or "tilt" in joint_name.lower():
        angle = round(abs(180.0 - angle), 2)

    return angle


def compute_all_angles(
    landmarks: Dict[int, Dict[str, float]],
    use_3d: bool = False
) -> Dict[str, Optional[float]]:
    """
    Compute angles for all matching joints. Supports pooling standard
    and derived joints.
    """
    # 1. Compute derived midpoint coordinates
    derived = compute_derived_joints(landmarks)
    
    # 2. Build combined lookup pool (Integers + String names)
    pool = {**landmarks}
    for name, coords in derived.items():
        if coords:
            pool[name] = coords
            
    result = {}
    for joint_name in JOINTS:
        angle = compute_joint_angle(joint_name, pool, use_3d)
        result[joint_name] = angle
    return result


def compute_derived_joints(
    landmarks: Dict[int, Dict[str, float]]
) -> Dict[str, Optional[Dict[str, float]]]:
    """
    Compute derived joint positions (neck, hip_center as midpoints).
    """
    result = {}
    for joint_name, joint_def in JOINTS.items():
        # Only compute coordinates for derived joints that aren't angles themselves
        if not joint_def.get("derived") or "point_a" in joint_def:
            continue
            
        if joint_def.get("type") == "midpoint":
            points = joint_def["points"]
            if all(p in landmarks for p in points):
                coords = {}
                for axis in ["x", "y", "z"]:
                    coords[axis] = round(
                        sum(landmarks[p][axis] for p in points) / len(points), 6
                    )
                # Store visibility as the average of its components
                avg_vis = sum(landmarks[p].get("visibility", 1.0) for p in points) / len(points)
                
                # Fallback logic for hip_center if it's off-screen
                if joint_name == "hip_center" and avg_vis < 0.1 and result.get("neck"):
                    coords["x"] = result["neck"]["x"]
                    coords["y"] = result["neck"]["y"] + 0.5  # straight down vertically
                    coords["z"] = result["neck"]["z"]
                    avg_vis = 1.0  # Force it to be visible so the angle engine accepts it
                    
                coords["visibility"] = avg_vis
                result[joint_name] = coords
            else:
                result[joint_name] = None
    return result


def get_angle_for_joint(
    joint_name: str,
    landmarks: Dict[int, Dict[str, float]]
) -> Tuple[Optional[float], str]:
    """
    Convenience function: get angle and description for a joint.
    
    Returns:
        (angle_degrees, label_string)
    """
    angle = compute_joint_angle(joint_name, landmarks)
    label = JOINTS.get(joint_name, {}).get("label", joint_name)
    return angle, label


def get_all_joint_names() -> list:
    """Return all joint names that can be computed as an angle (have 3 points)."""
    return [name for name, j in JOINTS.items() if "point_a" in j]
