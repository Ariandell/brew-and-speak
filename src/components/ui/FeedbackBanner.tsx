import React from 'react';
import { Button } from './Button';

interface FeedbackBannerProps {
    status: 'correct' | 'wrong' | null;
    onNext: () => void;
    onTryAgain: () => void;
}

export const FeedbackBanner: React.FC<FeedbackBannerProps> = ({ status, onNext, onTryAgain }) => {
    if (!status) return null;

    const isCorrect = status === 'correct';

    return (
        <div
            className="animate-slide-up"
            style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '1.5rem',
                paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
                backgroundColor: isCorrect ? 'var(--color-success)' : 'var(--color-error)',
                borderTopLeftRadius: '24px',
                borderTopRightRadius: '24px',
                zIndex: 200,
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
            }}
        >
            <h3 style={{ color: 'white', fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                {isCorrect ? 'Correct Answer!' : 'Wrong Answer!'}
            </h3>

            <Button
                style={{
                    backgroundColor: 'white',
                    color: isCorrect ? 'var(--color-success)' : 'var(--color-error)'
                }}
                onClick={isCorrect ? onNext : onTryAgain}
            >
                {isCorrect ? 'Next' : 'Try again'}
            </Button>
        </div>
    );
};
