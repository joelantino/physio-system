// src/components/AngleGauge.tsx
// SVG arc gauge showing current vs target angle

import React from 'react';

interface AngleGaugeProps {
    current: number | null;
    target: number | null;
    tolerance: number | null;
    label?: string;
    size?: number;
}

const AngleGauge: React.FC<AngleGaugeProps> = ({
    current,
    target,
    tolerance,
    label = 'Joint Angle',
    size = 200
}) => {
    const r = (size / 2) * 0.78;
    const cx = size / 2;
    const cy = size / 2;
    const strokeW = size * 0.085;
    const circumference = Math.PI * r; // Half circle (180°)

    const angleToOffset = (angle: number | null) => {
        if (angle === null) return circumference;
        const clamped = Math.min(180, Math.max(0, angle));
        return circumference - (clamped / 180) * circumference;
    };

    const getColor = () => {
        if (current === null || target === null || tolerance === null) return '#4f79ff';
        const diff = Math.abs(current - target);
        if (diff <= tolerance) return '#00ff88';
        if (diff <= tolerance * 2) return '#ffab40';
        return '#ff4757';
    };

    const color = getColor();
    const offset = angleToOffset(current);
    const lowerBound = target !== null && tolerance !== null ? target - tolerance : null;
    const lowerOffset = angleToOffset(lowerBound);

    // Calculate path for half-circle arc (bottom half of circle, left to right)
    const arcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <svg width={size} height={size * 0.6} viewBox={`0 0 ${size} ${size * 0.6}`}>
                {/* Background arc */}
                <path
                    d={arcPath}
                    fill="none"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth={strokeW}
                    strokeLinecap="round"
                />

                {/* Target zone arc (green band) */}
                {target !== null && tolerance !== null && (
                    <path
                        d={arcPath}
                        fill="none"
                        stroke="rgba(0, 255, 136, 0.15)"
                        strokeWidth={strokeW + 4}
                        strokeLinecap="butt"
                        strokeDasharray={`0 ${
                            (Math.min(180, Math.max(0, target - tolerance)) / 180) * circumference
                        } ${
                            ((Math.min(180, Math.max(0, target + tolerance)) - Math.min(180, Math.max(0, target - tolerance))) / 180) * circumference
                        } ${circumference}`}
                        strokeDashoffset={0}
                        style={{ transform: `scaleX(1)`, transformOrigin: 'center' }}
                    />
                )}

                {/* Current angle arc */}
                <path
                    d={arcPath}
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeW}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    style={{
                        filter: `drop-shadow(0 0 6px ${color}88)`,
                        transition: 'stroke-dashoffset 0.3s ease, stroke 0.3s ease'
                    }}
                />

                {/* Target marker */}
                {target !== null && (() => {
                    const totalAngle = (target / 180) * Math.PI;
                    const mx = cx - r * Math.cos(Math.PI - totalAngle);
                    const my = cy - r * Math.sin(Math.PI - totalAngle);
                    return (
                        <circle
                            cx={mx}
                            cy={my}
                            r={strokeW * 0.5}
                            fill="#00d4ff"
                            style={{ filter: 'drop-shadow(0 0 4px #00d4ff)' }}
                        />
                    );
                })()}

                {/* Center text */}
                <text
                    x={cx}
                    y={cy - 2}
                    textAnchor="middle"
                    fill={color}
                    fontSize={size * 0.18}
                    fontWeight="800"
                    fontFamily="'JetBrains Mono', monospace"
                    style={{ transition: 'fill 0.3s ease' }}
                >
                    {current !== null ? `${current.toFixed(1)}°` : '--'}
                </text>

                {target !== null && (
                    <text
                        x={cx}
                        y={cy + size * 0.1}
                        textAnchor="middle"
                        fill="rgba(136, 146, 176, 0.8)"
                        fontSize={size * 0.08}
                        fontFamily="'Inter', sans-serif"
                    >
                        Target: {target}° ± {tolerance}°
                    </text>
                )}

                {/* Scale labels */}
                <text x={cx - r - 10} y={cy + 14} fill="rgba(136,146,176,0.5)" fontSize={size * 0.07} textAnchor="middle">0°</text>
                <text x={cx + r + 10} y={cy + 14} fill="rgba(136,146,176,0.5)" fontSize={size * 0.07} textAnchor="middle">180°</text>
                <text x={cx} y={size * 0.07} fill="rgba(136,146,176,0.4)" fontSize={size * 0.07} textAnchor="middle">90°</text>
            </svg>

            <div className="angle-label">{label}</div>
        </div>
    );
};

export default AngleGauge;
