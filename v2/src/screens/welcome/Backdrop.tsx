/**
 * Light behind the welcome screen, not shapes.
 *
 * Two very soft pools of colour - cool at the top where the mascot sits, warm
 * at the bottom under the action. Nothing here has an edge, because an edge
 * would read as a panel and the whole style rests on there being none.
 *
 * Everything is pointer-events-none: decor that catches a tap over a button is
 * close to impossible to find later.
 */
export const Backdrop = () => (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-paper">
        <div className="glow-blue absolute left-[-30%] top-[-18%] h-[68%] w-[160%]" />
        <div className="glow-sun absolute bottom-[-22%] right-[-35%] h-[55%] w-[150%]" />
    </div>
);
