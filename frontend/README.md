# 🏥 PhysioAI — Frontend

This is the strictly typed **React + TypeScript + Vite** frontend for the **PhysioAI** real-time physiotherapy system. It provides the user interface for both patients and physiotherapists to interact with the system.

---

## ✨ Features & Full Working

The frontend is specifically designed to consume the Fast API real-time telemetry from the backend (video stream + JSON telemetry) and present it in an intuitive, responsive dashboard.

### 1. User View (Patient Interface)
- **Live Feed Rendering:** Embeds the MJPEG camera stream from the backend showing the real-time wireframe overlay.
- **Dynamic Angle Gauge:** An SVG-based localized visualizer (`AngleGauge.tsx`) that animates to show current joint angle progress vs. target angle.
- **Real-Time Feedback Banner:** Polls the backend for real-time corrective instructions (e.g., "Increase movement", "Hold it!") and color-codes the UI to guide the patient. 

### 2. Physio Dashboard (Clinical Interface)
- **Exercise Configuration:** Allows physiotherapists to flexibly configure session parameters: target joints, expected angles, and forgiveness tolerances.
- **Built-in Templates:** Physiotherapists can quickly initialize standard templates (e.g., Knee Flexion, Shoulder Abduction).

### 3. Session History
- **Analytics & Records:** Consumes historical session logs saved by the backend to review patient performance, completed repetitions, and mean accuracy.

---

## 🚀 How to Run

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher is recommended)
- The backend should ideally be running for full capability (defaults to `http://localhost:8000`).

### Proceed with Installation
Open a terminal in the `frontend` folder and run:
```bash
# 1. Install dependencies
npm install

# 2. Start the development server
npm run dev
```

### Accessing the App
Once started, Vite will host the application at:
**`http://localhost:5173`**

*(Note: The `run_frontend.bat` script at the root of the project can also be used to launch the frontend server on Windows environments automatically.)*

---

## 📁 System Architecture (Frontend)

```
frontend/
├── src/
│   ├── pages/
│   │   ├── UserView.tsx          # Patient live exercise view
│   │   ├── PhysioDashboard.tsx   # Physio exercise configuration
│   │   └── SessionHistory.tsx    # Past session records
│   ├── components/
│   │   ├── LiveFeed.tsx          # MJPEG camera stream embed
│   │   ├── AngleGauge.tsx        # Animated SVG arc for joint angles
│   │   ├── FeedbackBanner.tsx    # UI element for live tracking
│   │   └── SessionSummaryModal.tsx # Post-workout popup
│   ├── api.ts                    # Backend integration (Axios client)
│   ├── App.tsx                   # Core layout & React Router
│   └── index.css                 # Global styling / design system
├── package.json
└── vite.config.ts
```

## 🛠️ Tech Stack
- **Framework:** React 18
- **Language:** TypeScript
- **Build Tool:** Vite
- **Styling:** CSS (`index.css`)
- **Routing:** React Router DOM
- **HTTP Client:** Axios
