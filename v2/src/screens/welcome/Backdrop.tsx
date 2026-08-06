import { Panel } from '../../ui/Panel';
import { MonoNote } from '../../ui/MonoNote';

/**
 * Decorative composition behind the welcome screen. Kept apart from the screen
 * itself so the layout above stays readable - and so it can never intercept a
 * tap, which is why the whole thing is pointer-events-none.
 */
export const Backdrop = () => (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="bg-dots absolute inset-0" />

        <Panel tilt="left" className="absolute left-[-20%] top-[-10%] h-[60%] w-[150%] origin-top-left overflow-hidden bg-blue-hot shadow-2xl">
            <div className="moving-bar absolute bottom-4 left-0 h-px w-full bg-paper/30" />
            <div className="moving-bar absolute bottom-8 left-0 h-0.5 w-full bg-paper/20" style={{ animationDuration: '5s' }} />
        </Panel>

        <Panel tilt="right" className="absolute right-[-10%] top-[40%] h-[30%] w-[120%] bg-paper shadow-[0_-10px_30px_rgba(15,27,51,0.1)]" />

        <Panel tilt="left" className="absolute left-[-10%] top-[38%] z-10 h-[15px] w-[120%] bg-coral" />

        <MonoNote className="absolute right-[5%] top-[10%] origin-right rotate-90 text-right text-paper/70">
            SYS.INIT // v.3.0
            <br />
            LOC: EN-UK // BREW
        </MonoNote>

        <div className="absolute bottom-[20%] left-[5%] flex gap-1">
            <div className="h-2 w-2 rounded-sm bg-blue-deep" />
            <div className="h-2 w-2 animate-pulse-fast rounded-sm bg-blue-hot" />
            <div className="h-2 w-2 rounded-sm border border-blue-hot" />
        </div>
    </div>
);
