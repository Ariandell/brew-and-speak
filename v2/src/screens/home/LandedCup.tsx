import { MascotSilhouette } from '../../ui/MascotSilhouette';
import { CUP_LANDING, LANDING_ANCHOR, travel, type Anchor } from '../../ui/cupLanding';

interface Props {
    /** True while the screen is being covered, so the cup can go back. */
    leaving: boolean;
    /** Where the cup lives on the screen it came from. */
    origin?: Anchor;
}

/**
 * The mascot, arrived - lying upside down in the corner as background.
 *
 * On the way back it retraces the journey exactly: the same distance, the same
 * turn, the same change of size, all reversed. Without this the cup simply
 * stops existing here and starts existing there, and the transition is smooth
 * in one direction only.
 *
 * Centring is done with negative margins rather than `translate(-50%, -50%)`.
 * Percentage translations resolve against the untransformed box, so combined
 * with a scale they would pull the cup off its point by an amount that changes
 * with the scale - and the two screens have to agree on this point exactly.
 *
 * While travelling it rises above the planes *and* above the content (z-55):
 * the whole idea depends on the shape being seen moving across the blue.
 */
export const LandedCup = ({ leaving, origin }: Props) => {
    const { dx, dy } = origin ? travel(LANDING_ANCHOR, origin) : { dx: 0, dy: 0 };

    const back =
        `translate(${dx}px, ${dy}px) rotate(0deg) ` +
        `scale(${CUP_LANDING.heroHeight / CUP_LANDING.height})`;

    return (
        <div
            className="pointer-events-none absolute"
            style={{
                left: CUP_LANDING.centreX,
                bottom: CUP_LANDING.centreY,
                width: 0,
                height: 0,
                zIndex: leaving ? 55 : 45,
            }}
        >
            <MascotSilhouette
                size={CUP_LANDING.height}
                className="absolute left-0 top-0 transition-transform duration-[560ms] ease-snappy"
                style={{
                    marginLeft: -CUP_LANDING.width / 2,
                    marginTop: -CUP_LANDING.height / 2,
                    opacity: CUP_LANDING.opacity,
                    transform: leaving && origin ? back : `rotate(${CUP_LANDING.rotate}deg)`,
                }}
            />
        </div>
    );
};
