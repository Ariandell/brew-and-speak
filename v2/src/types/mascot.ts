export const MASCOT_MOODS = ['idle', 'neutral', 'happy', 'perfect', 'sad', 'surprised'] as const;
export type MascotMood = (typeof MASCOT_MOODS)[number];

/**
 * Native pixel height of each pose. The art was exported at different sizes,
 * and only `neutral` is large enough to stay sharp at hero size - the rest go
 * soft past roughly 170px. Until higher-resolution art exists, the component
 * uses this to warn in development rather than quietly blurring.
 */
export const MASCOT_NATIVE_HEIGHT: Record<MascotMood, number> = {
    idle: 167,
    neutral: 350,
    happy: 168,
    perfect: 164,
    sad: 159,
    surprised: 175,
};

export interface MascotClip {
    /** Animated WebP. Plays in a plain <img>, so no autoplay policy applies. */
    anim: string;
    /** First frame, 13 KB, shown until `anim` finishes downloading. */
    still: string;
    /** Frame width over height - the art is not square and must not be squashed. */
    ratio: number;
}

/**
 * Poses that have an animation. Deliberately partial: a mood with no entry
 * falls back to the static pose, so adding one is a single line here and
 * nothing else in the app needs to know.
 *
 * Chosen over VP9 WebM because Safari - and therefore Telegram on iOS - does
 * not reliably honour the alpha channel in WebM and would paint a black box
 * behind the cup. Animated WebP is transparent everywhere.
 */
export const MASCOT_CLIPS: Partial<Record<MascotMood, MascotClip>> = {
    perfect: {
        anim: '/assets/mascot/animations/perfect-anim.webp',
        still: '/assets/mascot/animations/perfect-still.webp',
        ratio: 604 / 660,
    },
};
