/**
 * The header is not drawn here - the blue is the accent plane, come to rest in
 * the bottom corner. Drawing a plane as well would put two different blues on
 * the same screen and break the one thing the transition is meant to prove:
 * that the background and the transition are the same object.
 *
 * The cup is not here either: it travels, so it lives in `LandedCup` where it
 * can be told which way it is going.
 */
export const Backdrop = () => (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="paper-grid absolute inset-x-0 top-0 h-1/2 opacity-[0.18]" />
        <div className="glow-blue absolute right-[-30%] top-[-20%] h-[50%] w-[140%]" />
    </div>
);
