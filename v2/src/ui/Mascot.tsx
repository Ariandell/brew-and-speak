import type { CSSProperties } from 'react';
import { MASCOT_NATIVE_HEIGHT, type MascotMood } from '../types/mascot';
import { cn } from '../lib/cn';

/**
 * The cup is drawn purple. Rather than redraw it, the hue is rotated: 97% of
 * its saturated pixels sit at 250-260 degrees while the lid and base are below
 * 0.25 saturation, so those stay cream. -48deg lands it slightly cooler than
 * the accent, so it does not merge into a button beside it. See docs/DESIGN.md.
 *
 * Change this one constant to repaint every pose and every animation.
 */
export const MASCOT_RECOLOUR = 'hue-rotate(-48deg) contrast(1.15) saturate(1.2)';

interface Props {
    mood?: MascotMood;
    /** Rendered height in px. Width follows the art. */
    size?: number;
    className?: string;
    style?: CSSProperties;
}

export const Mascot = ({ mood = 'neutral', size = 200, className, style }: Props) => {
    if (import.meta.env.DEV && size > MASCOT_NATIVE_HEIGHT[mood] * 1.1) {
        console.warn(
            `Mascot "${mood}" is ${MASCOT_NATIVE_HEIGHT[mood]}px tall but rendered at ${size}px - it will look soft. ` +
            `Either drop the size or get a higher-resolution export.`,
        );
    }

    return (
        <img
            src={`/assets/mascot/${mood}.png`}
            alt=""
            aria-hidden
            className={cn('select-none', className)}
            style={{ height: size, width: 'auto', objectFit: 'contain', filter: MASCOT_RECOLOUR, ...style }}
        />
    );
};
