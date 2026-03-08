import React from 'react';

interface ProgressBarProps {
    progress: number; // 0 to 1
    color?: string;
    className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ progress, color = 'white', className = '' }) => {
    return (
        <div className={`progress-container ${className}`}>
            <div
                className="progress-bar-fill"
                style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%`, backgroundColor: color }}
            />
        </div>
    );
};
