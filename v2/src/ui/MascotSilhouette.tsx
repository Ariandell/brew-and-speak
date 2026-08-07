import type { CSSProperties } from 'react';
import { MASCOT_CLIPS } from '../types/mascot';
import { cn } from '../lib/cn';

/**
 * The mascot reduced to its outline.
 *
 * `brightness(0)` crushes every colour to black and `invert(1)` flips that to
 * white, while the alpha channel survives untouched - so the still frame we
 * already ship becomes a clean white cup shape with no second asset to draw,
 * export or keep in step with the animation.
 *
 * It only reads on a saturated ground. On paper, white on white is nothing.
 */
export const MascotSilhouette = ({ className, style }: { className?: string; style?: CSSProperties }) => (
    <img
        src={MASCOT_CLIPS.perfect!.still}
        alt=""
        aria-hidden
        className={cn('select-none', className)}
        style={{ filter: 'brightness(0) invert(1)', ...style }}
    />
);
