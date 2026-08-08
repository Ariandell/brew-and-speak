import { Screen } from '../../ui/Screen';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { HeroMascot } from './HeroMascot';
import { Backdrop } from './Backdrop';
import type { Anchor } from '../../ui/cupLanding';

interface Props {
    onStart: () => void;
    /** True while the planes are covering, so the mascot can leave with them. */
    leaving: boolean;
    /** True for the whole of a screen change, in either direction. */
    travelling: boolean;
    /** Reports where the mascot sits, so the next screen can send it back. */
    onAnchor: (anchor: Anchor) => void;
}

/**
 * First screen: mascot, name, one action.
 *
 * One centred column rather than a growing hero plus a fixed footer - split in
 * two, the growing half swallows the spare height and opens a hole above the
 * mascot on tall phones while the rest stays glued to the bottom.
 *
 * The entrance is choreographed against the opening sweep rather than started
 * with it: the planes clear the screen first, then the card lands, then the
 * wordmark is uncovered in the same direction the planes travelled.
 *
 * The column carries no z-index on purpose. Stacking on it would trap the
 * mascot inside this screen's layer, and on the way out the mascot has to rise
 * above the planes. Order in the markup already puts it over the backdrop.
 */
export const Welcome = ({ onStart, leaving, travelling, onAnchor }: Props) => (
    <Screen>
        <Backdrop />

        <div className="relative flex flex-grow flex-col items-center justify-center px-6 py-8">
            {/* The mascot is a sibling of the card, not a child. `animate-settle`
                leaves a transform on the card, and a transform makes a stacking
                context for good - the mascot would be sealed inside it and could
                never rise above the planes on its way out. */}
            <div className="relative flex h-[300px] w-[300px] max-w-full items-center justify-center">
                <Card
                    level={3}
                    className={`animate-settle absolute inset-0 rounded-xl transition-opacity duration-300 ${leaving ? 'opacity-0' : 'opacity-100'}`}
                    style={{ animationDelay: '340ms' }}
                >
                    {/* Bounced light behind the cup, then its contact shadow. */}
                    <div className="glow-blue pointer-events-none absolute inset-x-6 bottom-12 top-6" />
                    <div className="contact-shadow pointer-events-none absolute bottom-7 h-9 w-[200px]" />
                </Card>

                <HeroMascot leaving={leaving} travelling={travelling} onAnchor={onAnchor} />
            </div>

            <h1
                className={`animate-wipe mt-8 text-[40px] font-extrabold leading-none tracking-tight text-ink transition-opacity duration-200 ${leaving ? 'opacity-0' : 'opacity-100'}`}
                style={{ animationDelay: '470ms' }}
            >
                Brew &amp; Speak
            </h1>

            <p
                className={`animate-rise mt-3 max-w-[270px] text-center text-[16px] font-medium leading-relaxed text-ink-soft transition-opacity duration-200 ${leaving ? 'opacity-0' : 'opacity-100'}`}
                style={{ animationDelay: '640ms' }}
            >
                Вчи англійську зі смаком кави та літнім настроєм
            </p>

            <div className="animate-rise mt-9 w-full" style={{ animationDelay: '730ms' }}>
                <Button onClick={onStart} trailing="→">
                    Почати навчання
                </Button>
            </div>
        </div>
    </Screen>
);
