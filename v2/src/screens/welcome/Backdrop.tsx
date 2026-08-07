/**
 * What sits behind the welcome screen: light, texture, and three drifting
 * marks. No panels - the one hard shape on this screen is the accent slab,
 * which belongs to the transition and lives in `app/Curtain`.
 *
 * No opaque background. The page colour comes from the app frame, or this
 * would paint over the planes hanging behind the screen.
 *
 * Everything is pointer-events-none: decor that catches a tap over a button is
 * close to impossible to find later.
 */
export const Backdrop = () => (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="glow-blue absolute left-[-30%] top-[-18%] h-[68%] w-[160%]" />
        <div className="glow-sun absolute bottom-[-22%] right-[-35%] h-[55%] w-[150%]" />

        <div className="paper-grid absolute inset-0 opacity-[0.22]" />

        {/* Slow enough to be noticed only on the second look. Three is the most
            that still reads as deliberate rather than as confetti. */}
        <span className="animate-drift absolute left-[12%] top-[26%] h-2 w-2 rounded-sm bg-blue/25" />
        <span
            className="animate-drift absolute right-[16%] top-[62%] h-1.5 w-1.5 rounded-sm bg-sun/40"
            style={{ animationDelay: '1.8s', animationDuration: '9s' }}
        />
        <span
            className="animate-drift absolute left-[22%] bottom-[16%] h-1.5 w-1.5 rounded-sm bg-blue/20"
            style={{ animationDelay: '3.4s', animationDuration: '8s' }}
        />
    </div>
);
