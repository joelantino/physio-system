// src/pages/SessionHistory.tsx
// Historical session records list

import React, { useState, useEffect } from 'react';
import { getSessionHistory, type SessionSummary } from '../api';

const SessionHistory: React.FC = () => {
    const [sessions, setSessions] = useState<SessionSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        getSessionHistory()
            .then(({ data }) => setSessions(data.sessions))
            .catch(() => setError('Failed to load session history'))
            .finally(() => setLoading(false));
    }, []);

    const formatDur = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
    };

    return (
        <div className="main-content">
            <div className="page-header">
                <div className="page-title">Session History</div>
                <div className="page-subtitle">Review past exercise sessions and performance metrics</div>
            </div>

            {loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-muted)', padding: '2rem' }}>
                    <div className="spinner" /> Loading sessions...
                </div>
            )}

            {error && (
                <div style={{ padding: '1rem', background: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.2)', borderRadius: 'var(--radius-md)', color: 'var(--accent-red)' }}>
                    {error}
                </div>
            )}

            {!loading && !error && sessions.length === 0 && (
                <div className="card" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>No sessions recorded yet</div>
                    <div style={{ fontSize: '0.85rem', marginTop: 8 }}>Start a session in the User View to see history here</div>
                </div>
            )}

            {sessions.length > 0 && (
                <div className="card">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Exercise</th>
                                <th>Joint</th>
                                <th>Date</th>
                                <th>Duration</th>
                                <th>Reps</th>
                                <th>Avg Angle</th>
                                <th>Max Angle</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sessions.map((s: any) => (
                                <tr key={s.session_id}>
                                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.exercise_name}</td>
                                    <td style={{ fontFamily: 'JetBrains Mono', fontSize: '0.8rem' }}>
                                        {s.joint?.replace(/_/g, ' ')}
                                    </td>
                                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        {s.start_time_iso?.slice(0, 16).replace('T', ' ') || '--'}
                                    </td>
                                    <td style={{ fontFamily: 'JetBrains Mono' }}>
                                        {s.duration_seconds ? formatDur(s.duration_seconds) : '--'}
                                    </td>
                                    <td>
                                        <span className="badge badge-green">{s.total_reps ?? 0}</span>
                                    </td>
                                    <td style={{ fontFamily: 'JetBrains Mono', color: 'var(--accent-cyan)' }}>
                                        {s.avg_angle != null ? `${Number(s.avg_angle).toFixed(1)}°` : '--'}
                                    </td>
                                    <td style={{ fontFamily: 'JetBrains Mono', color: 'var(--accent-orange)' }}>
                                        {s.max_angle != null ? `${Number(s.max_angle).toFixed(1)}°` : '--'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default SessionHistory;
