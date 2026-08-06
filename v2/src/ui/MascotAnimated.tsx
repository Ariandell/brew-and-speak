import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { MASCOT_CLIPS, type MascotMood } from '../types/mascot';
import { MASCOT_RECOLOUR, Mascot } from './Mascot';
import { cn } from '../lib/cn';

const wantsStillness = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Props {
    mood: MascotMood;
    /** Rendered height in px. Width follows the clip's own ratio. */
    size?: number;
    className?: string;
    style?: CSSProperties;
}

/**
 * An animated pose, with the static pose as a stand-in.
 *
 * The clip is ~800 KB, so showing it directly would leave a hole in the middle
 * of the screen while it downloads. The 13 KB first frame goes up immediately
 * and the animation replaces it once decoded.
 *
 * The <img> itself never remounts - only `src` changes. In the old app the
 * animation carried a `key` that changed on every play, which remounted the
 * element and forced a full re-decode, and the mascot visibly blinked.
 */
export const MascotAnimated = ({ mood, size = 230, className, style }: Props) => {
    const clip = MASCOT_CLIPS[mood];
    const [src, setSrc] = useState(clip?.still);

    useEffect(() => {
        if (!clip) return;
        setSrc(clip.still);
        if (wantsStillness()) return;

        const loader = new Image();
        loader.onload = () => setSrc(clip.anim);
        loader.src = clip.anim;
        return () => {
            loader.onload = null;
        };
    }, [clip]);

    if (!clip) return <Mascot mood={mood} size={size} className={className} style={style} />;

    return (
        <img
            src={src}
            alt=""
            aria-hidden
            className={cn('select-none', className)}
            style={{ height: size, width: size * clip.ratio, filter: MASCOT_RECOLOUR, ...style }}
        />
    );
};
