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
