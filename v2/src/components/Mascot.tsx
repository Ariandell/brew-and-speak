import type { CSSProperties } from 'react';

// The cup is drawn purple. Rather than redraw it, the hue is rotated: 97% of
// its saturated pixels sit at 250-260 degrees, and the lid and base are below
// 0.25 saturation, so they stay cream. -48deg lands it a little cooler than
// the accent, so it reads as its own thing next to a button rather than
// merging into one. See docs/DESIGN.md.
const RECOLOUR = 'hue-rotate(-48deg) contrast(1.15) saturate(1.2)';

export type MascotMood = 'idle' | 'neutral' | 'happy' | 'perfect' | 'sad' | 'surprised';

interface Props {
    mood?: MascotMood;
    /** Height in px. The art is 0.56 as wide as it is tall. */
    size?: number;
    className?: string;
    style?: CSSProperties;
}

export const Mascot = ({ mood = 'neutral', size = 200, className = '', style }: Props) => (
    <img
        src={`/assets/mascot/${mood}.png`}
        alt=""
        aria-hidden
        className={className}
        style={{ height: size, width: 'auto', objectFit: 'contain', filter: RECOLOUR, ...style }}
    />
);
