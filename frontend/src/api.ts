// src/api.ts
// Centralized API client for the PhysioAI backend

import axios from 'axios';

const BASE_URL = 'http://localhost:8000';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 5000,
});

export const STREAM_URL = `${BASE_URL}/stream`;

// ─── Types ────────────────────────────────────────────────────────────

export interface JointAngle {
  [joint: string]: number | null;
}

export interface FeedbackResult {
  status: 'perfect' | 'increase' | 'decrease' | 'no_detection' | 'idle';
  message: string;
  detail: string;
  severity: 'good' | 'warning' | 'error';
  current_angle: number | null;
  target_angle: number | null;
  tolerance: number | null;
  delta: number | null;
  color: string;
  icon: string;
  timestamp: number;
}

export interface SessionState {
  active: boolean;
  session_id: string | null;
  reps: number;
  elapsed_seconds: number;
  total_hold_time: number;
  perfect_frames: number;
  total_frames: number;
  perfect_percentage: number;
}

export interface ExerciseConfig {
  name: string;
  joint: string;
  target_angle: number;
  tolerance: number;
  reps_target: number;
  hold_seconds: number;
  description: string;
}

export interface ExerciseTemplate {
  id: string;
  name: string;
  joint: string;
  target_angle: number;
  tolerance: number;
  reps_target: number;
  hold_seconds: number;
  description: string;
  instructions?: string[];
  category?: string;
  difficulty?: string;
}

export interface SessionSummary {
  session_id: string;
  exercise_name: string;
  joint: string;
  target_angle: number;
  tolerance: number;
  start_time: number;
  end_time: number;
  duration_seconds: number;
  total_reps: number;
  max_angle: number | null;
  min_angle: number | null;
  avg_angle: number | null;
  perfect_percentage: number;
  completed: boolean;
  start_time_iso: string;
  angle_history: Array<{ timestamp: number; angle: number; feedback_status: string }>;
}

// ─── API Calls ────────────────────────────────────────────────────────

export const getAngles = () => api.get<{ angles: JointAngle; fps: number; detection_active: boolean }>('/angles');

export const getFeedback = () => api.get<{ feedback: FeedbackResult; session: SessionState }>('/feedback');

export const getHealth = () => api.get<{ status: string; fps: number; detection_active: boolean; session_active: boolean; active_exercise: string | null }>('/health');

export const listExercises = () => api.get<{ templates: ExerciseTemplate[]; custom: ExerciseConfig[]; active_config: any }>('/exercise/list');

export const configureExercise = (config: ExerciseConfig) => api.post('/exercise/configure', config);

export const loadTemplate = (templateId: string) => api.post(`/exercise/load-template/${templateId}`);

export const startSession = (exerciseId?: string) => api.post('/session/start', { exercise_id: exerciseId });

export const stopSession = () => api.post<{ summary: SessionSummary }>('/session/stop');

export const getSessionState = () => api.get<SessionState>('/session/state');

export const getSessionHistory = () => api.get<{ sessions: SessionSummary[] }>('/session/history');

export const getJoints = () => api.get<{ joint_names: string[] }>('/joints');
