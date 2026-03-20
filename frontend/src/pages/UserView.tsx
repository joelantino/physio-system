// src/pages/UserView.tsx
// Patient-facing real-time exercise view with live video, feedback, session tracking

import React, { useState, useEffect, useRef, useCallback } from 'react';
import LiveFeed from '../components/LiveFeed';
import FeedbackBanner from '../components/FeedbackBanner';
import AngleGauge from '../components/AngleGauge';
import SessionSummaryModal from '../components/SessionSummaryModal';
import {
    getFeedback, startSession, stopSession,
} from '../api';
import type { FeedbackResult, SessionState, SessionSummary } from '../api';
import {
    LineChart, Line, XAxis, YAxis, Tooltip,
    ReferenceLine, ResponsiveContainer, CartesianGrid
} from 'recharts';

const POLL_INTERVAL = 200; // ms — 5 Hz polling
const MAX_CHART_POINTS = 120;

const UserView: React.FC = () => {
    const [feedback, setFeedback] = useState<FeedbackResult | null>(null);
    const [session, setSession] = useState<SessionState | null>(null);
    const [sessionActive, setSessionActive] = useState(false);
    const [summary, setSummary] = useState<SessionSummary | null>(null);
    const [showSummary, setShowSummary] = useState(false);
    const [angleHistory, setAngleHistory] = useState<{ t: number; angle: number }[]>([]);
    const [backendOk, setBackendOk] = useState(true);
    const [username, setUsername] = useState<string>(localStorage.getItem('physio_user') || 'guest');
    const [startError, setStartError] = useState('');

    const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
    const counterRef = useRef(0);

    const poll = useCallback(async () => {
        try {
            const { data } = await getFeedback();
            setFeedback(data.feedback);
            setSession(data.session);
            setBackendOk(true);
            setSessionActive(data.session.active);

            if (data.feedback.current_angle !== null) {
                setAngleHistory(prev => {
                    const next = [...prev, { t: counterRef.current++, angle: data.feedback.current_angle! }];
                    return next.length > MAX_CHART_POINTS ? next.slice(-MAX_CHART_POINTS) : next;
                });
            }
        } catch {
            setBackendOk(false);
        }
    }, []);

    useEffect(() => {
        poll();
        pollRef.current = setInterval(poll, POLL_INTERVAL);
        return () => clearInterval(pollRef.current);
    }, [poll]);

    const handleStart = async () => {
        setStartError('');
        localStorage.setItem('physio_user', username);
        try {
            await startSession(username);
            setSessionActive(true);
            setAngleHistory([]);
            counterRef.current = 0;
        } catch (e: any) {
            setStartError(e?.response?.data?.detail || 'Failed to start session. Configure an exercise first.');
        }
    };

    const handleStop = async () => {
        try {
            const { data } = await stopSession();
            setSessionActive(false);
            setSummary(data.summary);
            setShowSummary(true);
        } catch {
            setSessionActive(false);
        }
    };

    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60).toString().padStart(2, '0');
        const s = Math.floor(secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    return (
        <div className="main-content">
            {/* Backend offline warning */}
            {!backendOk && (
                <div style={{
                    padding: '0.875rem 1rem',
                    background: 'rgba(255, 165, 2, 0.1)',
                    border: '1px solid rgba(255, 165, 2, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    color: '#ffab40',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10
                }}>
                    ⚠️ Cannot reach backend. Make sure the server is running on port 8000.
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem', alignItems: 'start' }}>

                {/* LEFT COLUMN */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                    {/* Live Feed */}
                    <div className="card" style={{ padding: '1rem' }}>
                        <div className="card-header">
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                📹 Live Camera Feed
                            </span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>MediaPipe Holistic · 33 landmarks</span>
                        </div>
                        <LiveFeed />
                    </div>

                    {/* Angle History Chart */}
                    <div className="card">
                        <div className="card-header">
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>📈 Angle History</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Last {MAX_CHART_POINTS} readings</span>
                        </div>
                        <div style={{ height: 180 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={angleHistory} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                    <XAxis dataKey="t" hide />
                                    <YAxis
                                        domain={[0, 180]}
                                        tick={{ fill: '#4a5568', fontSize: 11 }}
                                        width={32}
                                    />
                                    <Tooltip
                                        contentStyle={{ background: '#12162a', border: '1px solid #1e2440', borderRadius: 8, fontSize: '0.8rem' }}
                                        formatter={(v: any) => [`${Number(v).toFixed(1)}°`, 'Angle']}
                                        labelFormatter={() => ''}
                                    />
                                    {feedback?.target_angle !== null && feedback?.target_angle !== undefined && (
                                        <>
                                            <ReferenceLine y={feedback.target_angle} stroke="#00d4ff" strokeDasharray="4 2" strokeWidth={1.5} label={{ value: `Target ${feedback.target_angle}°`, fill: '#00d4ff', fontSize: 10, position: 'insideTopRight' }} />
                                            {feedback.tolerance && <>
                                                <ReferenceLine y={feedback.target_angle + feedback.tolerance} stroke="rgba(0,255,136,0.25)" strokeDasharray="2 4" />
                                                <ReferenceLine y={feedback.target_angle - feedback.tolerance} stroke="rgba(0,255,136,0.25)" strokeDasharray="2 4" />
                                            </>}
                                        </>
                                    )}
                                    <Line
                                        type="monotone"
                                        dataKey="angle"
                                        stroke="#4f79ff"
                                        strokeWidth={2}
                                        dot={false}
                                        isAnimationActive={false}
                                        activeDot={{ r: 4, fill: '#4f79ff' }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Feedback */}
                    <div className="card">
                        <div className="card-header">
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>💬 Real-Time Feedback</span>
                        </div>
                        <FeedbackBanner feedback={feedback} />
                    </div>
                </div>

                {/* RIGHT COLUMN */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'sticky', top: 80 }}>

                    {/* Angle Gauge */}
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1.5rem 1rem' }}>
                        <div className="card-title" style={{ marginBottom: 12, textAlign: 'center' }}>Joint Angle Gauge</div>
                        <AngleGauge
                            current={feedback?.current_angle ?? null}
                            target={feedback?.target_angle ?? null}
                            tolerance={feedback?.tolerance ?? null}
                            size={280}
                        />
                    </div>

                    {/* Session Controls */}
                    <div className="card">
                        <div className="card-header">
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>⚡ Session Control</span>
                            {sessionActive && (
                                <span className="badge badge-green" style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
                                    ACTIVE
                                </span>
                            )}
                        </div>

                        {/* User Identity */}
                        <div style={{ marginBottom: '1rem', padding: '0.875rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>👤 Patient Profile</div>
                            <input
                                className="form-input"
                                placeholder="Enter patient name..."
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                disabled={sessionActive}
                                style={{ background: sessionActive ? 'transparent' : undefined, border: sessionActive ? 'none' : undefined, paddingLeft: sessionActive ? 0 : undefined, fontWeight: 700, color: 'var(--accent-blue)' }}
                            />
                        </div>

                        {startError && (
                            <div style={{
                                padding: '0.6rem 0.8rem',
                                background: 'rgba(255,71,87,0.1)',
                                border: '1px solid rgba(255,71,87,0.3)',
                                borderRadius: 'var(--radius-sm)',
                                color: 'var(--accent-red)',
                                fontSize: '0.8rem',
                                marginBottom: '0.75rem'
                            }}>
                                ⚠️ {startError}
                            </div>
                        )}

                        {/* Session Stats */}
                        {session && (
                            <div className="grid-1" style={{ marginBottom: '1rem', gap: '0.75rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                    <div className="stat-card" style={{ padding: '0.875rem' }}>
                                        <div className="stat-label">Reps</div>
                                        <div className="stat-value green" style={{ fontSize: '2.2rem' }}>{session.reps}</div>
                                        <div className="stat-sub">repetitions</div>
                                    </div>
                                    <div className="stat-card" style={{ padding: '0.875rem' }}>
                                        <div className="stat-label">Elapsed</div>
                                        <div className="stat-value blue" style={{ fontSize: '2.2rem' }}>
                                            {formatTime(session.elapsed_seconds)}
                                        </div>
                                        <div className="stat-sub">mm:ss</div>
                                    </div>
                                </div>
                                <div className="stat-card" style={{ padding: '0.875rem' }}>
                                    <div className="stat-label">Hold Time</div>
                                    <div className="stat-value orange" style={{ fontSize: '2.2rem' }}>
                                        {session.total_hold_time.toFixed(0)}s
                                    </div>
                                    <div className="stat-sub">total time in target zone</div>
                                </div>
                            </div>
                        )}
                        {/* Start/Stop Button */}
                        {!sessionActive ? (
                            <button
                                className="btn btn-success"
                                style={{ width: '100%', padding: '14px' }}
                                onClick={handleStart}
                            >
                                ▶ Start Session
                            </button>
                        ) : (
                            <button
                                className="btn btn-danger"
                                style={{ width: '100%', padding: '14px' }}
                                onClick={handleStop}
                            >
                                ⏹ Stop & Save Session
                            </button>
                        )}
                    </div>

                    {/* Exercise Info */}
                    {feedback?.target_angle !== null && feedback?.target_angle !== undefined && (
                        <div className="card" style={{ background: 'rgba(79,121,255,0.04)' }}>
                            <div className="card-title" style={{ marginBottom: 10 }}>📋 Active Exercise</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Target Angle</span>
                                    <span style={{ fontFamily: 'JetBrains Mono', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                                        {feedback.target_angle}°
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Tolerance</span>
                                    <span style={{ fontFamily: 'JetBrains Mono', color: 'var(--accent-purple)', fontWeight: 700 }}>
                                        ±{feedback.tolerance}°
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Acceptance Zone</span>
                                    <span style={{ fontFamily: 'JetBrains Mono', color: 'var(--accent-green)', fontWeight: 700 }}>
                                        {(feedback.target_angle - (feedback.tolerance ?? 0)).toFixed(0)}° – {(feedback.target_angle + (feedback.tolerance ?? 0)).toFixed(0)}°
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Current</span>
                                    <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: feedback.color }}>
                                        {feedback.current_angle?.toFixed(1) ?? '--'}°
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Session Summary Modal */}
            {showSummary && summary && (
                <SessionSummaryModal
                    summary={summary}
                    onClose={() => { setShowSummary(false); setSummary(null); }}
                />
            )}
        </div>
    );
};

export default UserView;
