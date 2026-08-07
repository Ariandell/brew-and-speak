import { useLayoutEffect, useRef, useState } from 'react';
import { MascotAnimated } from '../../ui/MascotAnimated';
import { MascotSilhouette } from '../../ui/MascotSilhouette';
import { CUP_LANDING } from '../../ui/cupLanding';

interface Props {
    /** True while the screen is being covered. */
    leaving: boolean;
    size?: number;
}

/**
 * The mascot, and what it turns into.
 *
 * On the way out the cup does not fade - it goes white, swings down into the
 * corner and lies there as a background shape. The point is that the main
 * object is not removed to make way for the next screen, it *becomes* the next
 * screen's background.
 *
 * Two stacked images rather than one animated filter: CSS can only interpolate
 * between filter lists holding the same functions in the same order, and the
 * recolour and the white-out share nothing. Cross-fading is the only way this
 * reads as a change of material instead of a flicker.
 *
 * The move is measured, not written down. Where the cup starts depends on how
 * the column happened to lay out on this phone, so a fixed offset would land
 * it somewhere slightly different on every screen size - and the home screen
 * draws the same shape at a fixed point. The gap between the two is computed
 * at the moment the exit begins, so they meet exactly.
 *
 * It lifts above the planes while it moves (z-50 against their z-40). The
 * whole idea depends on the shape being *on* the blue, not buried under it.
 */
export const HeroMascot = ({ leaving, size = 244 }: Props) => {
    const ref = useRef<HTMLDivElement>(null);
    const [morph, setMorph] = useState<string>();

    useLayoutEffect(() => {
        if (!leaving) {
            setMorph(undefined);
            return;
        }
        const el = ref.current;
        const frame = el?.closest('main')?.getBoundingClientRect();
        if (!el || !frame) return;

        const box = el.getBoundingClientRect();
        const dx = frame.left + CUP_LANDING.centreX - (box.left + box.width / 2);
        const dy = frame.bottom - CUP_LANDING.centreY - (box.top + box.height / 2);

        setMorph(
            `translate(${Math.round(dx)}px, ${Math.round(dy)}px) ` +
            `rotate(${CUP_LANDING.rotate}deg) scale(${CUP_LANDING.height / size})`,
        );
    }, [leaving, size]);

    return (
        <div
            ref={ref}
            className="relative transition-transform duration-[560ms] ease-snappy"
            style={{ height: size, transform: morph, zIndex: leaving ? 50 : undefined }}
        >
            <MascotAnimated
                mood="perfect"
                size={size}
                className={`transition-opacity duration-300 ${leaving ? 'opacity-0' : 'opacity-100'}`}
            />
            <MascotSilhouette
                size={size}
                className="absolute left-0 top-0 transition-opacity duration-[420ms]"
                style={{ opacity: leaving ? CUP_LANDING.opacity : 0 }}
            />
        </div>
    );
};
