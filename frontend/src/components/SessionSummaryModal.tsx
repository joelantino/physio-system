// src/components/SessionSummaryModal.tsx
// Session summary display after stopping a session

import React from 'react';
import type { SessionSummary } from '../api';
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';

interface Props {
    summary: SessionSummary;
    onClose: () => void;
}

const SessionSummaryModal: React.FC<Props> = ({ summary, onClose }) => {
    const chartData = summary.angle_history
        .filter((_, i) => i % 3 === 0) // Downsample for rendering
        .map((r, i) => ({
            t: i,
            angle: r.angle,
            status: r.feedback_status
        }));

    const formatDuration = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return m > 0 ? `${m}m ${s}s` : `${s}s`;
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 680 }}>
                <div className="modal-header">
                    <div>
                        <div className="modal-title">🏆 Session Complete</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 2 }}>
                            {summary.exercise_name} · {summary.start_time_iso}
                        </div>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={onClose}>✕ Close</button>
                </div>

                {/* Stats Grid */}
                <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
                    <div className="stat-card">
                        <div className="stat-label">Repetitions</div>
                        <div className="stat-value green">{summary.total_reps}</div>
                        <div className="stat-sub">reps completed</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">Avg Angle</div>
                        <div className="stat-value blue">{summary.avg_angle?.toFixed(1) ?? '--'}°</div>
                        <div className="stat-sub">target: {summary.target_angle}°</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">Max Angle</div>
                        <div className="stat-value orange">{summary.max_angle?.toFixed(1) ?? '--'}°</div>
                        <div className="stat-sub">range of motion</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">Accuracy</div>
                        <div className="stat-value purple">{summary.perfect_percentage}%</div>
                        <div className="stat-sub">time in target zone</div>
                    </div>
                </div>

                {/* Duration row */}
                <div style={{
                    display: 'flex',
                    gap: '1rem',
                    marginBottom: '1.5rem',
                    padding: '0.75rem 1rem',
                    background: 'rgba(79, 121, 255, 0.06)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)'
                }}>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Duration</div>
                        <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: 'var(--accent-blue)' }}>
                            {formatDuration(summary.duration_seconds)}
                        </div>
                    </div>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Joint</div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {summary.joint.replace(/_/g, ' ')}
                        </div>
                    </div>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Min Angle</div>
                        <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                            {summary.min_angle?.toFixed(1) ?? '--'}°
                        </div>
                    </div>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Data Points</div>
                        <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, color: 'var(--text-secondary)' }}>
                            {summary.angle_history.length}
                        </div>
                    </div>
                </div>

                {/* Angle History Chart */}
                {chartData.length > 0 && (
                    <div>
                        <div className="card-title" style={{ marginBottom: 12 }}>Angle History</div>
                        <div style={{ height: 160, background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)', padding: '8px 0' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                                    <XAxis dataKey="t" hide />
                                    <YAxis domain={[0, 180]} tick={{ fill: '#4a5568', fontSize: 11 }} width={32} />
                                    <Tooltip
                                        contentStyle={{ background: '#12162a', border: '1px solid #1e2440', borderRadius: 8, fontSize: '0.8rem' }}
                                        formatter={(v: any) => [`${Number(v).toFixed(1)}°`, 'Angle']}
                                        labelFormatter={() => ''}
                                    />
                                    <ReferenceLine y={summary.target_angle} stroke="#00d4ff" strokeDasharray="4 2" strokeWidth={1.5} />
                                    <ReferenceLine y={summary.target_angle + summary.tolerance} stroke="rgba(0,255,136,0.3)" strokeDasharray="2 4" />
                                    <ReferenceLine y={summary.target_angle - summary.tolerance} stroke="rgba(0,255,136,0.3)" strokeDasharray="2 4" />
                                    <Line
                                        type="monotone"
                                        dataKey="angle"
                                        stroke="#4f79ff"
                                        strokeWidth={2}
                                        dot={false}
                                        activeDot={{ r: 4, fill: '#4f79ff' }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                <div className="divider" />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn btn-primary" onClick={onClose}>Done</button>
                </div>
            </div>
        </div>
    );
};

export default SessionSummaryModal;
