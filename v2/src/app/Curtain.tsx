import { COVER_MS, RETURN_MS, STAGGER_MS, type CurtainPhase } from './useCurtain';

/** Filling the frame. Each plane is 140% of the frame, so this covers it. */
const COVER = 'translate(0, 0) rotate(0deg) scale(1)';

/**
 * Three planes travelling the same path, offset in time and in space.
 *
 * The offsets only apply at rest, where they stack into one layered slab - the
 * warm sliver above, the deep blue beneath. In motion the offsets are dropped
 * so the cover is solid, and the delays turn what would be a single wipe into
 * a sweep with a leading edge.
 *
 * Painted in order, so `main` lands last and stays on top.
 */
const PLANES = [
    { key: 'lead', tone: 'bg-sun', offset: 'translate(-1.6%, 3.4%)', cover: 0, back: STAGGER_MS },
    { key: 'mid', tone: 'bg-blue-deep', offset: 'translate(1.1%, 1.7%)', cover: STAGGER_MS / 2, back: STAGGER_MS / 2 },
    { key: 'main', tone: 'bg-blue plane-grain', offset: '', cover: STAGGER_MS, back: 0 },
];

interface Props {
    phase: CurtainPhase;
    /** Where the planes sit when they are part of the screen's background. */
    rest: string;
}

/**
 * The accent planes that hang in the background - and the thing that performs
 * every screen change, including the first one.
 *
 * They are the same elements throughout, not decoration plus a separate
 * transition overlay. Two sets would have to be kept in step by hand, and the
 * link between background and transition would be an impression rather than a
 * fact.
 *
 * Their resting place belongs to the screen, so the blue never simply returns
 * to where it came from - it settles into whatever that screen needs it to be.
 * On the welcome screen that is a slab hanging off the top corner; on the home
 * screen it is the header itself.
 */
export const Curtain = ({ phase, rest }: Props) => {
    const covered = phase === 'covering' || phase === 'booting';
    const moving = phase !== 'idle';

    return (
        <div className={`pointer-events-none absolute inset-0 overflow-hidden ${moving ? 'z-40' : 'z-0'}`}>
            {PLANES.map(plane => (
                <div
                    key={plane.key}
                    className={`absolute inset-[-20%] rounded-[52px] ${plane.tone}`}
                    style={{
                        transform: covered ? COVER : `${rest} ${plane.offset}`,
                        transitionProperty: 'transform',
                        // `booting` holds the covered state with no animation at
                        // all, so the first frame has something to sweep out of.
                        transitionDuration:
                            phase === 'booting' ? '0ms' : `${phase === 'covering' ? COVER_MS : RETURN_MS}ms`,
                        transitionDelay: `${phase === 'covering' ? plane.cover : plane.back}ms`,
                        transitionTimingFunction: 'cubic-bezier(0.2, 0, 0, 1)',
                    }}
                />
            ))}
        </div>
    );
};
