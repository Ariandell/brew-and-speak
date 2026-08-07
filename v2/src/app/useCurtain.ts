import { useCallback, useEffect, useRef, useState } from 'react';

/** `booting` is the covered state held with no transition, so the very first
 *  paint is already behind the planes and the app can sweep itself open. */
export type CurtainPhase = 'booting' | 'idle' | 'covering' | 'returning';

/** Long enough to read as a deliberate wipe, short enough not to be a wait. */
export const COVER_MS = 420;
export const RETURN_MS = 460;
/** The last plane trails this far behind the first. */
export const STAGGER_MS = 140;

const wantsStillness = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Drives the screen change: the planes cover, the screen swaps behind them,
 * the planes retract to where they hang in the background.
 *
 * The swap happens at the exact moment the cover is complete, so the old
 * screen is never seen leaving and the new one is never seen arriving. That is
 * the whole trick - it also means a screen can mount slowly without the seam
 * showing.
 *
 * First load runs the same machinery in reverse: the app starts covered and
 * sweeps itself open, so arriving and moving between screens are the same
 * gesture rather than two unrelated animations.
 */
export const useCurtain = () => {
    const [phase, setPhase] = useState<CurtainPhase>('booting');
    const timers = useRef<number[]>([]);

    const clear = () => {
        timers.current.forEach(clearTimeout);
        timers.current = [];
    };

    useEffect(() => {
        if (wantsStillness()) {
            setPhase('idle');
            return clear;
        }
        let opened = false;
        const open = () => {
            if (opened) return;
            opened = true;
            setPhase('returning');
            timers.current.push(window.setTimeout(() => setPhase('idle'), RETURN_MS + STAGGER_MS));
        };

        // One frame covered, so the browser has a "from" to animate out of.
        const frame = requestAnimationFrame(open);

        // requestAnimationFrame does not run while the tab is hidden, and a Mini
        // App can be opened into the background. Without this the whole screen
        // would sit behind a solid plane until someone looked at it.
        timers.current.push(window.setTimeout(open, 250));

        return () => {
            cancelAnimationFrame(frame);
            clear();
        };
    }, []);

    const go = useCallback((commit: () => void) => {
        clear();

        // Reduced motion gets the destination, not a shortened animation.
        if (wantsStillness()) {
            commit();
            return;
        }

        setPhase('covering');
        timers.current.push(
            window.setTimeout(() => {
                commit();
                setPhase('returning');
            }, COVER_MS + STAGGER_MS),
            window.setTimeout(() => setPhase('idle'), COVER_MS + RETURN_MS + STAGGER_MS * 2),
        );
    }, []);

    return { phase, go };
};
