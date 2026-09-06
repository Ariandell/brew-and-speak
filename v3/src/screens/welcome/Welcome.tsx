import { useEffect, useRef } from 'react';
import { RegistrationMarks } from '../../ui/RegistrationMarks';
import { useScene } from '../../ui/SceneProvider';

/** Small type that never stops moving, so the screen is never a still image. */
const CRAWL =
    'ENG · UA — РІВНІ A1 A2 B1 B2 — ЩОДЕННА ПРАКТИКА — ФЛЕШКАРТКИ — ЖИВА ВИКЛАДАЧКА — ';

const LEVELS = ['A1', 'A2', 'B1', 'B2'];
const WEEKDAYS = ['НД', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];

/** How often the cup remembers there is something to press. */
const GLANCE_MS = 7000;

interface Props {
    onStart: () => void;
}

/**
 * The first screen.
 *
 * The density is the point, but it only holds while every mark is true. An
 * index that counts nothing, or a duration on a button that merely opens the
 * app, is decoration wearing the clothes of information - and that is exactly
 * what gives a fake away. Everything here refers to something the product
 * actually has: the pair of languages, the levels it covers, what the action
 * does.
 *
 * The rest of the composition:
 *
 * - **The wordmark is too big for the frame and is cut by it.** Type running
 *   off the edge reads as a printed object rather than a label in a box.
 * - **Two sizes inside the title.** The small word between the large ones is
 *   what stops stacked lines reading as a list.
 * - **The cup is behind it.** The canvas is one layer under all the markup, so
 *   the character can only sit behind - which turns the constraint into the
 *   composition: the lid and one arm clear the letters, the rest is occluded,
 *   and that overlap is the depth.
 * - **Two type sizes overall and nothing between.** Middle sizes are what make
 *   a layout look like a document.
 */
export const Welcome = ({ onStart }: Props) => {
    const scene = useScene();
    const action = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        // Up and slightly off centre, so the wordmark owns the lower left and
        // the letters cross the cup's base rather than clearing it.
        scene?.setPose({ x: 0.13, y: 0.14, scale: 1.02, roll: 0 });
    }, [scene]);

    /* Every so often the cup glances at the one thing there is to do. Reacting
       to a touch is only half of being alive - the other half is having
       something of its own to look at, and pointing at the action is the one
       glance that is also useful. */
    useEffect(() => {
        if (!scene) return;
        const id = window.setInterval(() => scene.lookAt(action.current), GLANCE_MS);
        return () => clearInterval(id);
    }, [scene]);

    const now = new Date();
    const stamp =
        WEEKDAYS[now.getDay()] +
        ' · ' +
        String(now.getDate()).padStart(2, '0') +
        '.' +
        String(now.getMonth() + 1).padStart(2, '0');

    return (
        <div className="relative h-full overflow-hidden">
            <RegistrationMarks />

            {/* The crawl, rotated onto the right edge, where it is texture
                rather than something to read. */}
            <div className="pointer-events-none absolute -right-1 top-0 h-full w-6 overflow-hidden">
                <div className="crawl absolute left-1/2 top-0 -translate-x-1/2">
                    {[0, 1].map(copy => (
                        <p
                            key={copy}
                            className="whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.3em] text-text/25"
                            style={{ writingMode: 'vertical-rl' }}
                        >
                            {CRAWL}
                        </p>
                    ))}
                </div>
            </div>

            {/* Weight in the corner for the composition to lean against - and
                the one thing the whole product does, said in two letters. */}
            <span
                className="surface pointer-events-none absolute -right-8 bottom-[2%] select-none text-[250px] font-black leading-none tracking-[-0.07em] text-text/[0.06]"
                style={{ animationDelay: '160ms' }}
            >
                EN
            </span>

            {/* A counterweight at the top. The space between it and the
                wordmark was empty before; bounded by a line at each end it
                becomes room the composition is using rather than room it
                forgot about. The date is not filler - the product is twenty
                minutes a day, so which day it is is the whole premise. */}
            <div className="surface absolute inset-x-0 top-0 px-6 pt-7" style={{ animationDelay: '140ms' }}>
                <div className="flex items-baseline justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-text-faint">
                        Щоденна практика
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-text-faint">
                        {stamp}
                    </span>
                </div>
                <span className="mt-3 block h-px bg-text/15" />
            </div>

            <div className="absolute inset-x-0 bottom-0 px-6 pb-9">
                <div
                    className="surface mb-4 flex items-center gap-3"
                    style={{ animationDelay: '200ms' }}
                >
                    {LEVELS.map(level => (
                        <span
                            key={level}
                            className="font-mono text-[10px] uppercase tracking-[0.22em] text-text-faint"
                        >
                            {level}
                        </span>
                    ))}
                    <span className="h-px flex-grow bg-text/15" />
                </div>

                <h1
                    className="surface -ml-1 text-[80px] font-black leading-[0.8] tracking-[-0.055em] text-text"
                    style={{ animationDelay: '260ms' }}
                >
                    ENGLISH
                    <span className="flex items-baseline gap-3">
                        <span className="font-mono text-[20px] font-bold lowercase tracking-[0.08em] text-text-soft">
                            with
                        </span>
                        COFFEE
                    </span>
                </h1>

                <div
                    className="surface mt-5 flex items-center gap-3"
                    style={{ animationDelay: '360ms' }}
                >
                    <span className="h-px flex-grow bg-text/20" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-text-faint">
                        ENG → UA
                    </span>
                </div>

                <p
                    className="surface mt-4 max-w-[250px] text-[15px] font-medium leading-relaxed text-text-soft"
                    style={{ animationDelay: '440ms' }}
                >
                    Двадцять хвилин на день. Далі воно тримається саме.
                </p>

                {/* Not a pill. A pill is the shape an interface takes when no
                    decision was made about it - this one has a leading mark, a
                    label and a direction, and reads as a control. */}
                {/* The one thing anyone actually does on this screen, so it is
                    the one place a reaction is certain to be seen. */}
                <button
                    ref={action}
                    onPointerDown={() => scene?.express('surprised', 850)}
                    onClick={onStart}
                    className="surface mt-7 flex h-[62px] w-full items-center gap-4 rounded-[14px] bg-accent pl-5 pr-4 text-left transition-transform duration-quick ease-out active:scale-[0.985]"
                    style={{ animationDelay: '520ms' }}
                >
                    <span className="h-6 w-[3px] shrink-0 bg-white/70" />
                    <span className="text-[17px] font-extrabold tracking-tight text-white">
                        Почати
                    </span>
                    <span className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-white/15 text-[15px] font-bold text-white">
                        →
                    </span>
                </button>
            </div>
        </div>
    );
};
