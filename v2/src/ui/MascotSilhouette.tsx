import type { CSSProperties } from 'react';
import { MASCOT_CLIPS } from '../types/mascot';
import { cn } from '../lib/cn';

const CLIP = MASCOT_CLIPS.perfect!;

interface Props {
    /** Rendered height in px. Width follows the art and is always written out. */
    size: number;
    className?: string;
    style?: CSSProperties;
}

/**
 * The mascot reduced to its outline.
 *
 * `brightness(0)` crushes every colour to black and `invert(1)` flips that to
 * white, while the alpha channel survives untouched - so the still frame we
 * already ship becomes a clean white cup shape with no second asset to draw,
 * export or keep in step with the animation.
 *
 * It only reads on a saturated ground. On paper, white on white is nothing.
 *
 * Width is written out, and `max-w-none` with it. This gets pinned to a point
 * by sitting inside a zero-size anchor, and Tailwind's reset puts
 * `max-width: 100%` on every image - 100% of a zero-width box is zero, which
 * beats the explicit width. The image then lays out full height and no width:
 * present, painted, and invisible.
 */
export const MascotSilhouette = ({ size, className, style }: Props) => (
    <img
        src={CLIP.still}
        alt=""
        aria-hidden
        className={cn('max-w-none select-none', className)}
        style={{
            height: size,
            width: size * CLIP.ratio,
            filter: 'brightness(0) invert(1)',
            ...style,
        }}
    />
);
