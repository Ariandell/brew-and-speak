import { MascotSilhouette } from '../../ui/MascotSilhouette';

/**
 * The header is not drawn here - it is the accent slab, come to rest. Drawing
 * a blue plane as well would put two different blues on the same screen and
 * break the one thing the transition is meant to prove: that the background
 * and the transition are the same object.
 *
 * The mascot carries across as its own outline. Full colour twice in a row
 * would turn the character into wallpaper instead of a voice.
 */
export const Backdrop = () => (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <MascotSilhouette className="absolute right-1 top-4 h-[196px] rotate-[8deg] opacity-[0.20]" />
        <div className="glow-sun absolute bottom-[-28%] left-[-30%] h-[52%] w-[150%]" />
    </div>
);
