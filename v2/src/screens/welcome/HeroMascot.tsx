import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MascotAnimated } from '../../ui/MascotAnimated';
import { MascotSilhouette } from '../../ui/MascotSilhouette';
import { CUP_LANDING, LANDING_ANCHOR, travel, type Anchor } from '../../ui/cupLanding';

interface Props {
    /** True while the screen is being covered. */
    leaving: boolean;
    /** True for the whole of a screen change, in either direction. */
    travelling: boolean;
    /** Reports where the cup sits, so the screen it hands over to can send it back. */
    onAnchor?: (anchor: Anchor) => void;
}

/**
 * The mascot, and what it turns into.
 *
 * On the way out the cup does not fade - it goes white, turns over and swings
 * down into the corner, where it stays as the next screen's background. The
 * point is that the main object is not removed to make way for what comes
 * next, it *becomes* what comes next.
 *
 * Two stacked images rather than one animated filter: CSS can only interpolate
 * between filter lists holding the same functions in the same order, and the
 * recolour and the white-out share nothing. Cross-fading is the only way this
 * reads as a change of material instead of a flicker.
 *
 * It always mounts white and turns to colour, which is what makes the journey
 * reversible: arriving back here is the exit played backwards, and the cup
 * regains its colour on the spot it left from rather than appearing in it.
 *
 * The move is measured, not written down. Where the cup starts depends on how
 * the column happened to lay out on this phone, and the landing point is
 * fixed, so a hard-coded offset would miss by a different amount on every
 * screen size.
 *
 * It lifts above the planes while it moves (z-50 against their z-40). The
 * whole idea depends on the shape being *on* the blue, not buried under it.
 */
export const HeroMascot = ({ leaving, travelling, onAnchor }: Props) => {
    const ref = useRef<HTMLDivElement>(null);
    const [anchor, setAnchor] = useState<Anchor>();
    const [ghost, setGhost] = useState(true);

    useLayoutEffect(() => {
        const el = ref.current;
        const frame = el?.closest('main')?.getBoundingClientRect();
        if (!el || !frame) return;

        const box = el.getBoundingClientRect();
        const here: Anchor = {
            left: box.left + box.width / 2 - frame.left,
            bottom: frame.bottom - (box.top + box.height / 2),
        };
        setAnchor(here);
        onAnchor?.(here);
        // Measured once, on mount: the cup does not move until it leaves, and
        // measuring later would read the transform we are about to apply.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const frame = requestAnimationFrame(() => setGhost(false));
        return () => cancelAnimationFrame(frame);
    }, []);

    const { dx, dy } = anchor ? travel(anchor, LANDING_ANCHOR) : { dx: 0, dy: 0 };
    const morph =
        leaving && anchor
            ? `translate(${dx}px, ${dy}px) rotate(${CUP_LANDING.rotate}deg) ` +
              `scale(${CUP_LANDING.height / CUP_LANDING.heroHeight})`
            : undefined;

    return (
        <div
            ref={ref}
            className="relative transition-transform duration-[560ms] ease-snappy"
            style={{
                height: CUP_LANDING.heroHeight,
                transform: morph,
                // Raised for the whole journey, not just the half spent leaving.
                // On the way back the cup arrives the instant the screen swaps,
                // while the planes still cover everything - left at its normal
                // level it would hide under them and only reappear once they
                // pulled away, which is the pop this is meant to remove.
                zIndex: travelling ? 50 : undefined,
            }}
        >
            <MascotAnimated
                mood="perfect"
                size={CUP_LANDING.heroHeight}
                className={`transition-opacity duration-[420ms] ${leaving || ghost ? 'opacity-0' : 'opacity-100'}`}
            />
            <MascotSilhouette
                size={CUP_LANDING.heroHeight}
                className="absolute left-0 top-0 transition-opacity duration-[420ms]"
                style={{ opacity: leaving || ghost ? CUP_LANDING.opacity : 0 }}
            />
        </div>
    );
};
