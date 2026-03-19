// src/components/FeedbackBanner.tsx
// Animated real-time feedback display

import React from 'react';
import type { FeedbackResult } from '../api';

interface FeedbackBannerProps {
    feedback: FeedbackResult | null;
}

const FeedbackBanner: React.FC<FeedbackBannerProps> = ({ feedback }) => {
    if (!feedback) {
        return (
            <div className="feedback-banner idle">
                <div className="feedback-icon">⏸️</div>
                <div className="feedback-text">
                    <div className="feedback-message">Waiting to start</div>
                    <div className="feedback-detail">Select an exercise and press Start Session</div>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`feedback-banner ${feedback.status} animate-slide-up`}
            style={{ borderColor: `${feedback.color}44` }}
        >
            <div className="feedback-icon">{feedback.icon}</div>
            <div className="feedback-text">
                <div className="feedback-message" style={{ color: feedback.color }}>
                    {feedback.message}
                </div>
                <div className="feedback-detail">{feedback.detail}</div>
            </div>
            {feedback.delta !== null && (
                <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    color: feedback.color,
                    flexShrink: 0
                }}>
                    {feedback.delta > 0 ? '+' : ''}{feedback.delta.toFixed(1)}°
                </div>
            )}
        </div>
    );
};

export default FeedbackBanner;
