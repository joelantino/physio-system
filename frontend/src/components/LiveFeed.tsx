// src/components/LiveFeed.tsx
// MJPEG video feed component with reconnection logic

import React, { useState, useEffect, useRef } from 'react';
import { STREAM_URL } from '../api';

interface LiveFeedProps {
    className?: string;
}

const LiveFeed: React.FC<LiveFeedProps> = ({ className = '' }) => {
    const [connected, setConnected] = useState(false);
    const [retrying, setRetrying] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);
    const retryRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const loadStream = () => {
        if (!imgRef.current) return;
        const ts = Date.now();
        imgRef.current.src = `${STREAM_URL}?t=${ts}`;
    };

    useEffect(() => {
        loadStream();
        return () => {
            if (retryRef.current) clearTimeout(retryRef.current);
        };
    }, []);

    const handleLoad = () => {
        setConnected(true);
        setRetrying(false);
    };

    const handleError = () => {
        setConnected(false);
        setRetrying(true);
        retryRef.current = setTimeout(() => {
            loadStream();
        }, 2000);
    };

    return (
        <div className={`video-container ${className}`}>
            <img
                ref={imgRef}
                className="video-feed"
                alt="Live physio stream"
                onLoad={handleLoad}
                onError={handleError}
                style={{ display: connected ? 'block' : 'none' }}
            />

            {!connected && (
                <div className="video-error">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M15 10l4.553-2.278A1 1 0 0121 8.68v6.64a1 1 0 01-1.447.898L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                    </svg>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                        {retrying ? 'Connecting to camera stream...' : 'Camera stream unavailable'}
                    </span>
                    {retrying && <div className="spinner" />}
                    <button className="btn btn-ghost btn-sm" onClick={loadStream}>
                        Retry Connection
                    </button>
                </div>
            )}

            {connected && (
                <div className="video-overlay">
                    <span className="video-badge live">LIVE</span>
                </div>
            )}
        </div>
    );
};

export default LiveFeed;
