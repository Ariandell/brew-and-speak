import React from 'react';

interface CircularProgressProps {
    progress: number;
    total: number;
    size?: number;
    strokeWidth?: number;
    color?: string;
    trackColor?: string;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
    progress,
    total,
    size = 80,
    strokeWidth = 8,
    color = 'var(--color-accent-blue)',
    trackColor = '#e6ecff'
}) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const percent = total > 0 ? (progress / total) * 100 : 0;
    const offset = circumference - (percent / 100) * circumference;

    return (
        <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                {/* Track */}
                <circle
                    cx={size / 2} cy={size / 2} r={radius}
                    fill="transparent"
                    stroke={trackColor}
                    strokeWidth={strokeWidth}
                />
                {/* Progress */}
                <circle
                    cx={size / 2} cy={size / 2} r={radius}
                    fill="transparent"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                />
            </svg>
            {/* Label */}
            <div style={{ position: 'absolute', display: 'flex', alignItems: 'baseline', gap: '2px', color: 'var(--color-primary)' }}>
                <span style={{ fontWeight: 800, fontSize: '1.2rem' }}>{progress}</span>
                <span style={{ fontWeight: 600, fontSize: '0.8rem', opacity: 0.6 }}>/{total}</span>
            </div>
        </div>
    );
};
