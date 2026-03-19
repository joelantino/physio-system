// src/pages/PhysioDashboard.tsx
// Physiotherapist control panel: configure exercises, manage templates

import React, { useState, useEffect, useCallback } from 'react';
import {
    listExercises, configureExercise, loadTemplate,
} from '../api';
import type { ExerciseTemplate, ExerciseConfig } from '../api';

const JOINT_LABELS: Record<string, string> = {
    left_elbow: 'Left Elbow', right_elbow: 'Right Elbow',
    left_shoulder: 'Left Shoulder', right_shoulder: 'Right Shoulder',
    left_hip: 'Left Hip', right_hip: 'Right Hip',
    left_knee: 'Left Knee', right_knee: 'Right Knee',
    left_ankle: 'Left Ankle', right_ankle: 'Right Ankle',
    left_wrist: 'Left Wrist', right_wrist: 'Right Wrist',
    neck_tilt: 'Neck Tilt',
};

const DIFFICULTIES: Record<string, string> = {
    beginner: 'badge-green', intermediate: 'badge-blue', advanced: 'badge-orange'
};

const defaultConfig: ExerciseConfig = {
    name: '', joint: 'left_knee', target_angle: 90,
    tolerance: 10, reps_target: 10, hold_seconds: 2, description: ''
};

const PhysioDashboard: React.FC = () => {
    const [config, setConfig] = useState<ExerciseConfig>(defaultConfig);
    const [templates, setTemplates] = useState<ExerciseTemplate[]>([]);
    const [customExercises, setCustomExercises] = useState<any[]>([]);
    const [activeConfig, setActiveConfig] = useState<any>(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    const fetchExercises = useCallback(async () => {
        try {
            const { data } = await listExercises();
            setTemplates(data.templates);
            setCustomExercises(data.custom);
            setActiveConfig(data.active_config);
        } catch {
            setError('Cannot reach backend. Make sure the server is running.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchExercises();
    }, [fetchExercises]);

    const handleSave = async () => {
        if (!config.name) { setError('Exercise name is required.'); return; }
        setSaving(true); setError(''); setSaved(false);
        try {
            await configureExercise(config);
            setSaved(true);
            setActiveConfig({ name: config.name, joint: config.joint, target_angle: config.target_angle });
            setTimeout(() => setSaved(false), 3000);
            fetchExercises();
        } catch (e: any) {
            setError(e?.response?.data?.detail || 'Failed to save exercise.');
        } finally {
            setSaving(false);
        }
    };

    const handleLoadTemplate = async (tmpl: ExerciseTemplate) => {
        try {
            await loadTemplate(tmpl.id);
            setConfig({
                name: tmpl.name, joint: tmpl.joint,
                target_angle: tmpl.target_angle, tolerance: tmpl.tolerance,
                reps_target: tmpl.reps_target, hold_seconds: tmpl.hold_seconds,
                description: tmpl.description || ''
            });
            setActiveConfig({ name: tmpl.name, joint: tmpl.joint, target_angle: tmpl.target_angle });
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        } catch {
            setError('Failed to load template.');
        }
    };

    const handleEdit = (ex: any) => {
        setConfig({
            name: ex.name, joint: ex.joint, target_angle: ex.target_angle,
            tolerance: ex.tolerance, reps_target: ex.reps_target || 10,
            hold_seconds: ex.hold_seconds || 2, description: ex.description || ''
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="main-content" style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '1.5rem', alignItems: 'start' }}>
            {/* LEFT: Exercise Builder */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'sticky', top: 80 }}>

                {/* Active Exercise Banner */}
                {activeConfig && (
                    <div style={{
                        padding: '0.875rem 1rem',
                        background: 'rgba(0, 255, 136, 0.07)',
                        border: '1px solid rgba(0, 255, 136, 0.25)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex', alignItems: 'center', gap: 10
                    }}>
                        <span style={{ fontSize: '1.1rem' }}>✅</span>
                        <div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--accent-green)', fontWeight: 600 }}>ACTIVE EXERCISE</div>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{activeConfig.name}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {activeConfig.joint?.replace(/_/g, ' ')} · Target: {activeConfig.target_angle}°
                            </div>
                        </div>
                    </div>
                )}

                {/* Exercise Builder Card */}
                <div className="card">
                    <div className="card-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="2">
                                <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
                            </svg>
                            <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                                Configure Exercise
                            </span>
                        </div>
                    </div>

                    {error && (
                        <div style={{
                            padding: '0.75rem 1rem',
                            background: 'rgba(255, 71, 87, 0.1)',
                            border: '1px solid rgba(255, 71, 87, 0.3)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--accent-red)',
                            fontSize: '0.85rem',
                            marginBottom: '1rem'
                        }}>
                            ⚠️ {error}
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">Exercise Name *</label>
                        <input
                            className="form-input"
                            placeholder="e.g. Knee Flexion Rehab"
                            value={config.name}
                            onChange={e => setConfig(c => ({ ...c, name: e.target.value }))}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Target Joint</label>
                        <select
                            className="form-select"
                            value={config.joint}
                            onChange={e => setConfig(c => ({ ...c, joint: e.target.value }))}
                        >
                            {Object.entries(JOINT_LABELS).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Description</label>
                        <input
                            className="form-input"
                            placeholder="Optional exercise description"
                            value={config.description}
                            onChange={e => setConfig(c => ({ ...c, description: e.target.value }))}
                        />
                    </div>

                    <div className="range-group form-group">
                        <div className="range-header">
                            <label className="form-label">Target Angle</label>
                            <span className="range-value">{config.target_angle}°</span>
                        </div>
                        <input
                            type="range" min={0} max={180} step={1}
                            value={config.target_angle}
                            onChange={e => setConfig(c => ({ ...c, target_angle: +e.target.value }))}
                            style={{
                                background: `linear-gradient(to right, var(--accent-blue) 0%, var(--accent-blue) ${(config.target_angle / 180) * 100}%, rgba(255,255,255,0.1) ${(config.target_angle / 180) * 100}%, rgba(255,255,255,0.1) 100%)`
                            }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            <span>0°</span><span>90°</span><span>180°</span>
                        </div>
                    </div>

                    <div className="range-group form-group">
                        <div className="range-header">
                            <label className="form-label">Tolerance (±)</label>
                            <span className="range-value">±{config.tolerance}°</span>
                        </div>
                        <input
                            type="range" min={2} max={40} step={1}
                            value={config.tolerance}
                            onChange={e => setConfig(c => ({ ...c, tolerance: +e.target.value }))}
                            style={{
                                background: `linear-gradient(to right, var(--accent-purple) 0%, var(--accent-purple) ${((config.tolerance - 2) / 38) * 100}%, rgba(255,255,255,0.1) ${((config.tolerance - 2) / 38) * 100}%, rgba(255,255,255,0.1) 100%)`
                            }}
                        />
                    </div>

                    <div className="grid-2">
                        <div className="range-group form-group">
                            <div className="range-header">
                                <label className="form-label">Reps Target</label>
                                <span className="range-value" style={{ color: 'var(--accent-green)' }}>{config.reps_target}</span>
                            </div>
                            <input
                                type="range" min={1} max={50} step={1}
                                value={config.reps_target}
                                onChange={e => setConfig(c => ({ ...c, reps_target: +e.target.value }))}
                            />
                        </div>
                        <div className="range-group form-group">
                            <div className="range-header">
                                <label className="form-label">Hold (sec)</label>
                                <span className="range-value" style={{ color: 'var(--accent-orange)' }}>{config.hold_seconds}s</span>
                            </div>
                            <input
                                type="range" min={0} max={10} step={0.5}
                                value={config.hold_seconds}
                                onChange={e => setConfig(c => ({ ...c, hold_seconds: +e.target.value }))}
                            />
                        </div>
                    </div>

                    {/* Target Zone Preview */}
                    <div style={{
                        padding: '0.75rem 1rem',
                        background: 'rgba(0, 212, 255, 0.06)',
                        border: '1px solid rgba(0, 212, 255, 0.2)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.85rem',
                        marginBottom: '1rem'
                    }}>
                        <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>📐 Acceptance Zone</div>
                        <div style={{ color: 'var(--text-primary)', fontFamily: 'JetBrains Mono', fontWeight: 700 }}>
                            {config.target_angle - config.tolerance}° → {config.target_angle + config.tolerance}°
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                            className={`btn ${saved ? 'btn-success' : 'btn-primary'}`}
                            style={{ flex: 1 }}
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Saving...</> :
                                saved ? '✓ Exercise Approved!' : 'Approve Exercise'}
                        </button>
                        <button
                            className="btn btn-ghost"
                            onClick={() => { setConfig(defaultConfig); setError(''); }}
                        >
                            Reset
                        </button>
                    </div>
                </div>
            </div>

            {/* RIGHT: Templates + Custom Exercises */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Built-in Templates */}
                <div className="card">
                    <div className="card-header">
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>📚 Exercise Template Library</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{templates.length} templates</span>
                    </div>
                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '1rem', color: 'var(--text-muted)' }}>
                            <div className="spinner" /> Loading templates...
                        </div>
                    ) : (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Exercise</th>
                                    <th>Joint</th>
                                    <th>Target</th>
                                    <th>Tolerance</th>
                                    <th>Reps</th>
                                    <th>Difficulty</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {templates.map(t => (
                                    <tr key={t.id}>
                                        <td>
                                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.description?.slice(0, 55)}{t.description && t.description.length > 55 ? '…' : ''}</div>
                                        </td>
                                        <td style={{ fontFamily: 'JetBrains Mono', fontSize: '0.8rem' }}>
                                            {JOINT_LABELS[t.joint] || t.joint}
                                        </td>
                                        <td style={{ fontFamily: 'JetBrains Mono', color: 'var(--accent-blue)' }}>{t.target_angle}°</td>
                                        <td style={{ fontFamily: 'JetBrains Mono', color: 'var(--accent-purple)' }}>±{t.tolerance}°</td>
                                        <td style={{ fontFamily: 'JetBrains Mono' }}>{t.reps_target}</td>
                                        <td>
                                            <span className={`badge ${DIFFICULTIES[t.difficulty || ''] || 'badge-blue'}`}>
                                                {t.difficulty || 'standard'}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button className="btn btn-success btn-sm" onClick={() => handleLoadTemplate(t)}>
                                                    Load
                                                </button>
                                                <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(t)}>
                                                    Edit
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Custom Exercises */}
                {customExercises.length > 0 && (
                    <div className="card">
                        <div className="card-header">
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>🔧 Custom Exercises</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{customExercises.length} saved</span>
                        </div>
                        <table className="data-table">
                            <thead>
                                <tr><th>Name</th><th>Joint</th><th>Target</th><th>Tolerance</th><th></th></tr>
                            </thead>
                            <tbody>
                                {customExercises.map((ex, i) => (
                                    <tr key={i}>
                                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ex.name}</td>
                                        <td style={{ fontFamily: 'JetBrains Mono', fontSize: '0.8rem' }}>{JOINT_LABELS[ex.joint] || ex.joint}</td>
                                        <td style={{ fontFamily: 'JetBrains Mono', color: 'var(--accent-blue)' }}>{ex.target_angle}°</td>
                                        <td style={{ fontFamily: 'JetBrains Mono', color: 'var(--accent-purple)' }}>±{ex.tolerance}°</td>
                                        <td>
                                            <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(ex)}>Edit</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* API Info */}
                <div className="card" style={{ background: 'rgba(79,121,255,0.04)' }}>
                    <div className="card-title" style={{ marginBottom: 12 }}>📡 API Endpoints</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {[
                            ['GET', '/stream', 'MJPEG video stream'],
                            ['GET', '/angles', 'All joint angles'],
                            ['GET', '/feedback', 'Real-time feedback'],
                            ['POST', '/exercise/configure', 'Set exercise config'],
                            ['POST', '/session/start', 'Begin session'],
                            ['POST', '/session/stop', 'End session, get summary'],
                        ].map(([method, path, desc]) => (
                            <div key={path} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.8rem' }}>
                                <span className={`badge ${method === 'GET' ? 'badge-blue' : 'badge-orange'}`}>{method}</span>
                                <code style={{ color: 'var(--accent-cyan)', fontFamily: 'JetBrains Mono', flex: 1 }}>{path}</code>
                                <span style={{ color: 'var(--text-muted)' }}>{desc}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PhysioDashboard;
