import React from 'react';

// The coffee-cup mascot, restored from the March 20 build (commit 03f75b8).
// That commit was force-pushed out of the branch and garbage-collected from
// GitHub, so the source was gone; the artwork and the markup below were
// recovered from the deployment Vercel still had, and match it one for one.
export type MascotMood = 'idle' | 'neutral' | 'happy' | 'perfect' | 'sad' | 'surprised';

export const MASCOT_MOODS: { value: MascotMood; label: string }[] = [
    { value: 'happy', label: 'Радісний' },
    { value: 'perfect', label: 'Захоплений' },
    { value: 'surprised', label: 'Здивований' },
    { value: 'sad', label: 'Сумний' },
    { value: 'neutral', label: 'Спокійний' },
    { value: 'idle', label: 'Звичайний' },
];

const KNOWN: ReadonlySet<string> = new Set(MASCOT_MOODS.map(m => m.value));

// idle/neutral breathe and blink continuously; the reactive moods play once.
const animationClass = (mood: string) => {
    if (mood === 'idle' || mood === 'neutral') return 'mascot-idle';
    if (mood === 'happy' || mood === 'perfect') return 'mascot-bounce';
    if (mood === 'sad' || mood === 'surprised') return 'mascot-shake';
    return '';
};

interface MascotProps {
    mood?: string;
    size?: number;
    speechBubble?: React.ReactNode;
    animated?: boolean;
    style?: React.CSSProperties;
}

export const Mascot: React.FC<MascotProps> = ({ mood, size = 80, speechBubble, animated = true, style }) => {
    const key = String(mood || '').trim().toLowerCase();
    const safeMood = KNOWN.has(key) ? key : 'neutral';

    return (
        <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', ...style }}>
            {speechBubble && (
                <div className="mascot-speech-bubble" style={{
                    marginBottom: '1rem', background: 'white', padding: '0.75rem 1rem',
                    borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
                    fontSize: '0.95rem', color: '#1e293b', fontWeight: 500,
                    maxWidth: '260px', textAlign: 'center', border: '2px solid #e2e8f0',
                    lineHeight: 1.4, position: 'relative'
                }}>
                    {speechBubble}
                </div>
            )}
            <img
                src={`/assets/mascot/${safeMood}.png`}
                alt={`Маскот: ${safeMood}`}
                className={animated ? animationClass(safeMood) : ''}
                style={{ width: size, height: size, objectFit: 'contain', transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
            />
        </div>
    );
};
