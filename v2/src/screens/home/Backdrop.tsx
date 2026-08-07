import { MascotSilhouette } from '../../ui/MascotSilhouette';
import { CUP_LANDING, landedTransform } from '../../ui/cupLanding';

/**
 * The header is not drawn here - the blue is the accent plane, come to rest in
 * the bottom corner. Drawing a plane as well would put two different blues on
 * the same screen and break the one thing the transition is meant to prove:
 * that the background and the transition are the same object.
 *
 * The cup lying in the corner is the mascot from the previous screen, arrived.
 * Its point, angle and opacity come from the same constant that screen aims
 * at, because the swap happens while both are on screen.
 */
/* No z-index on the wrapper. `z-0` would make a stacking context and seal the
   cup inside it at the backdrop's own level, under the planes - which is
   exactly the blink this is meant to avoid. Markup order already puts the
   backdrop below the content. */
export const Backdrop = () => (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Above the planes (z-40) but below the content (z-50): it has to be
            there the instant this screen mounts, while the planes are still
            covering, or the shape handed over by the previous screen blinks. */}
        <div
            className="absolute z-[45] h-0 w-0"
            style={{ left: CUP_LANDING.centreX, bottom: CUP_LANDING.centreY }}
        >
            <MascotSilhouette
                size={CUP_LANDING.height}
                className="absolute"
                style={{ opacity: CUP_LANDING.opacity, transform: landedTransform }}
            />
        </div>

        <div className="paper-grid absolute inset-x-0 top-0 h-1/2 opacity-[0.18]" />
        <div className="glow-blue absolute right-[-30%] top-[-20%] h-[50%] w-[140%]" />
    </div>
);
