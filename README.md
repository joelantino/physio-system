# 🏥 PhysioAI — Phase 1: Real-Time AI Physiotherapy System

A production-level, modular, real-time physiotherapy system using **MediaPipe Holistic**, **FastAPI**, and **React**.

---

## 🚀 Quick Start

### Prerequisites
- Python 3.8–3.11
- Node.js 18+
- Webcam connected

### 1. Start the Backend
```bash
# Double-click run_backend.bat
# OR run manually:
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Backend starts at: `http://localhost:8000`
- 📖 API Docs: `http://localhost:8000/docs`
- 📹 Video Stream: `http://localhost:8000/stream`

### 2. Start the Frontend
```bash
# Double-click run_frontend.bat
# OR run manually:
cd frontend
npm run dev
```

Frontend starts at: `http://localhost:5173`

---

## 📁 Project Structure

```
physio-system/
├── backend/
│   ├── main.py              # FastAPI app — all API endpoints
│   ├── pose_engine.py       # MediaPipe Holistic + OpenCV webcam capture
│   ├── angle_engine.py      # Vector dot-product joint angle computation
│   ├── feedback_engine.py   # Real-time corrective feedback logic
│   ├── session_manager.py   # Session tracking, rep counting, persistence
│   └── requirements.txt
│
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── UserView.tsx          # Patient live exercise view
│       │   ├── PhysioDashboard.tsx   # Physio exercise configuration
│       │   └── SessionHistory.tsx    # Past session records
│       ├── components/
│       │   ├── LiveFeed.tsx          # MJPEG camera stream
│       │   ├── AngleGauge.tsx        # SVG arc angle gauge
│       │   ├── FeedbackBanner.tsx    # Color-coded feedback display
│       │   └── SessionSummaryModal.tsx
│       ├── api.ts           # Axios API client + TypeScript types
│       ├── App.tsx          # Router + navigation
│       └── index.css        # Premium dark theme CSS
│
├── config/
│   ├── joint_map.json       # MediaPipe landmark triplets for each joint
│   └── exercise_templates.json  # 6 built-in exercise templates
│
├── sessions/                # Auto-created: JSON session records
├── exercises/               # Auto-created: saved custom exercises
│
├── run_backend.bat          # Windows launcher for backend
└── run_frontend.bat         # Windows launcher for frontend
```

---

## 🧩 System Architecture

```
Webcam → OpenCV → MediaPipe Holistic → 33 Landmarks (x,y,z)
                                              │
                                    ┌─────────┴──────────┐
                                    │    Angle Engine     │
                                    │  (dot product math) │
                                    └─────────┬──────────┘
                                              │
                                    ┌─────────┴──────────┐
                                    │  Feedback Engine    │
                                    │  current vs target  │
                                    └─────────┬──────────┘
                                              │
                          ┌───────────────────┼───────────────────┐
                          │                   │                   │
                 Session Manager         FastAPI REST          MJPEG Stream
                 (reps, hold, stats)     (/angles, /feedback)   (/stream)
                          │                   │                   │
                          └───────────────────┼───────────────────┘
                                              │
                                    React Frontend
                          ┌───────────────────┼───────────────────┐
                          │                   │                   │
                    User View           Physio Dashboard    Session History
                 (live feed + feedback)  (configure exercises)  (records)
```

---

## 🌐 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stream` | MJPEG video stream with skeleton overlay |
| GET | `/landmarks` | Current 33 landmark coordinates |
| GET | `/angles` | All joint angles (computed in real-time) |
| GET | `/angles/{joint}` | Single joint angle |
| GET | `/feedback` | Real-time feedback + session state |
| GET | `/joints` | List all mapped joints |
| POST | `/exercise/configure` | Set active exercise config |
| GET | `/exercise/list` | All templates + custom exercises |
| POST | `/exercise/load-template/{id}` | Load a built-in template |
| POST | `/session/start` | Begin tracking session |
| POST | `/session/stop` | End session, return summary |
| GET | `/session/state` | Current session state |
| GET | `/session/history` | All past sessions |
| GET | `/session/{id}` | Specific session details |
| GET | `/health` | System health check |

---

## 🦵 Supported Joints (12 joints)

| Joint | Landmarks (A → Vertex → B) |
|-------|---------------------------|
| Left/Right Elbow | Shoulder → Elbow → Wrist |
| Left/Right Shoulder | Elbow → Shoulder → Hip |
| Left/Right Hip | Shoulder → Hip → Knee |
| Left/Right Knee | Hip → Knee → Ankle |
| Left/Right Ankle | Knee → Ankle → Foot |
| Left/Right Wrist | Elbow → Wrist → Pinky |

---

## 🏋️ Built-in Exercise Templates

1. **Knee Flexion** — Left knee to 90°
2. **Elbow Curl** — Right elbow to 45°
3. **Shoulder Abduction** — Right shoulder to 90°
4. **Hip Flexion** — Left hip to 90°
5. **Ankle Dorsiflexion** — Left ankle to 20°
6. **Full Knee Extension** — Right knee to 170°

---

## 🔧 Usage Flow

1. **Physio configures exercise** → Go to `/dashboard`, pick joint + target angle + tolerance → Approve
2. **Patient opens User View** → `/` or `/user`
3. **Start Session** → Real-time angle tracking begins
4. **Feedback updates live** → "Perfect! Hold it" / "Increase movement" / "Reduce movement"
5. **Stop Session** → Summary modal shows reps, avg angle, accuracy
6. **Review history** → `/history` shows all past sessions

---

## ⚙️ Performance Notes

- Target: ≥15 FPS (typically 25–30 FPS on modern hardware)
- MediaPipe model complexity: 1 (balanced accuracy/speed)
- Frontend polls feedback at 5 Hz (200ms interval)
- Sessions stored as JSON in `/sessions/`

---

## 🔮 Phase 2 Roadmap

- [ ] MongoDB session persistence
- [ ] Multi-patient profile management
- [ ] Custom ML exercise classification
- [ ] Progress analytics dashboard
- [ ] WebSocket real-time updates (replace polling)
- [ ] Mobile-responsive UI
