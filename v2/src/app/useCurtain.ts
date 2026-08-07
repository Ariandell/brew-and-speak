import { useCallback, useEffect, useRef, useState } from 'react';

export type CurtainPhase = 'idle' | 'covering' | 'returning';

/** Long enough to read as a deliberate wipe, short enough not to be a wait. */
export const COVER_MS = 420;
export const RETURN_MS = 460;

/**
 * Drives the screen change: the curtain covers, the screen swaps behind it,
 * the curtain retracts to where it hangs in the background.
 *
 * The swap happens at the exact moment the curtain is fully covering, so the
 * old screen is never seen leaving and the new one is never seen arriving.
 * That is the whole trick - it also means a screen can mount slowly without
 * the seam showing.
 */
export const useCurtain = () => {
    const [phase, setPhase] = useState<CurtainPhase>('idle');
    const timers = useRef<number[]>([]);

    const clear = () => {
        timers.current.forEach(clearTimeout);
        timers.current = [];
    };

    useEffect(() => clear, []);

    const go = useCallback((commit: () => void) => {
        clear();

        // Reduced motion gets the destination, not a shortened animation.
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            commit();
            return;
        }

        setPhase('covering');
        timers.current.push(
            window.setTimeout(() => {
                commit();
                setPhase('returning');
            }, COVER_MS),
            window.setTimeout(() => setPhase('idle'), COVER_MS + RETURN_MS),
        );
    }, []);

    return { phase, go };
};
