import { MascotSilhouette } from '../../ui/MascotSilhouette';

/**
 * The header is not drawn here - it is the accent plane, come to rest. Drawing
 * a blue plane as well would put two different blues on the same screen and
 * break the one thing the transition is meant to prove: that the background
 * and the transition are the same object.
 *
 * The mascot carries across as its own outline, and it *lands* rather than
 * appears - oversized, then settling - so it reads as the cup flattening into
 * the background rather than a second picture fading up. Its delay is timed to
 * the plane's arrival, since until then it is underneath it anyway.
 */
export const Backdrop = () => (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        {/* Rotation and the landing animation live on different elements: both
            write `transform`, and together the tilt would be dropped for the
            length of the animation and snap back at the end. */}
        <div className="animate-settle absolute right-1 top-4" style={{ animationDelay: '380ms' }}>
            <MascotSilhouette className="h-[196px] rotate-[8deg] opacity-[0.20]" />
        </div>

        <div className="paper-grid absolute inset-x-0 bottom-0 h-1/2 opacity-[0.18]" />
        <div className="glow-sun absolute bottom-[-28%] left-[-30%] h-[52%] w-[150%]" />
    </div>
);
