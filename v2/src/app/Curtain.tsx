import { COVER_MS, RETURN_MS, type CurtainPhase } from './useCurtain';

/** Filling the frame. The element is 140% of the frame, so this covers it. */
const COVER = 'translate(0, 0) rotate(0deg) scale(1)';

interface Props {
    phase: CurtainPhase;
    /** Where the slab sits when it is part of the current screen's background. */
    rest: string;
}

/**
 * The accent slab that hangs in the background - and the thing that performs
 * every screen change.
 *
 * One element in two states, not a decorative shape plus a separate overlay.
 * Two elements would have to be kept in step by hand and the link between
 * background and transition would be an impression rather than a fact.
 *
 * Its resting place belongs to the screen, so the blue never simply returns to
 * where it came from - it settles into whatever that screen needs it to be. On
 * the welcome screen that is a slab hanging off the top corner; on the home
 * screen it is the header itself.
 *
 * While covering it sits above everything (z-40). Retracting it stays above,
 * so the new screen is revealed by the blue moving off rather than by a cut -
 * which is why anything drawn inside the resting shape has to wait for the
 * slab to arrive before it fades in.
 */
export const Curtain = ({ phase, rest }: Props) => {
    const moving = phase !== 'idle';

    return (
        <div className={`pointer-events-none absolute inset-0 overflow-hidden ${moving ? 'z-40' : 'z-0'}`}>
            <div
                className="absolute inset-[-20%] rounded-[52px] bg-blue"
                style={{
                    transform: phase === 'covering' ? COVER : rest,
                    transitionProperty: 'transform',
                    transitionDuration: `${phase === 'covering' ? COVER_MS : RETURN_MS}ms`,
                    transitionTimingFunction: 'cubic-bezier(0.2, 0, 0, 1)',
                }}
            />
        </div>
    );
};
