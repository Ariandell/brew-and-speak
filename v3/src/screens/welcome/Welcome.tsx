import { useEffect } from 'react';
import { useScene } from '../../ui/SceneProvider';

interface Props {
    onStart: () => void;
}

/** Small type that never stops moving, so the screen is never a still image. */
const CRAWL =
    'ENG · UA — РІВНІ A1 A2 B1 B2 — 20 ХВИЛИН НА ДЕНЬ — ФЛЕШКАРТКИ — ЖИВА ВИКЛАДАЧКА — ';

/**
 * The first screen.
 *
 * The earlier version failed for a reason worth naming: everything sat politely
 * inside its own margin. Nothing was cropped, nothing overlapped anything, the
 * type was placed rather than composed, and the button was the most generic
 * shape an interface can have. That reads as assembled, not designed.
 *
 * What is different here:
 *
 * - **The wordmark is too big for the frame and is cut by it.** Type that runs
 *   off the edge reads as a printed object rather than as a label sitting in a
 *   box. It is the single strongest move available and it costs nothing.
 * - **The cup is behind it.** The canvas is one layer under all the markup, so
 *   the character can only sit behind - which turns the constraint into the
 *   composition: the lid and one arm rise clear of the letters and the rest is
 *   occluded, and that overlap is what creates depth between the layers.
 * - **A dense annotation layer.** Corner marks, a rule, an index, a crawl of
 *   small type. None of it is decoration for its own sake - together they are
 *   what makes a screen look considered instead of empty, and they are what a
 *   large flat area of nothing is otherwise missing.
 * - **Two type sizes and nothing between.** Enormous and tiny. Middle sizes are
 *   what make a layout look like a document.
 */
export const Welcome = ({ onStart }: Props) => {
    const scene = useScene();

    useEffect(() => {
        // Up and slightly off centre, so the wordmark owns the lower left and
        // the cup is not sitting on top of its own name.
        scene?.setPose({ x: 0.16, y: 0.30, scale: 0.78 });
    }, [scene]);

    return (
        <div className="relative h-full overflow-hidden">
            {/* Registration marks. Barely visible, and the screen feels built
                rather than poured the moment they are there. */}
            <span className="absolute left-3 top-3 h-3 w-px bg-text/25" />
            <span className="absolute left-3 top-3 h-px w-3 bg-text/25" />
            <span className="absolute right-3 top-3 h-3 w-px bg-text/25" />
            <span className="absolute right-3 top-3 h-px w-3 bg-text/25" />
            <span className="absolute bottom-3 left-3 h-3 w-px bg-text/25" />
            <span className="absolute bottom-3 left-3 h-px w-3 bg-text/25" />
            <span className="absolute bottom-3 right-3 h-3 w-px bg-text/25" />
            <span className="absolute bottom-3 right-3 h-px w-3 bg-text/25" />

            {/* The crawl. Rotated onto the right edge, where it is a texture
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

            {/* The index, enormous and cut by the edge. It is not information -
                it is weight in the corner that the composition leans against.
                It sits low, clear of the cup: a ghost number crossing the
                character reads as a mistake rather than as a layer. */}
            <span
                className="surface pointer-events-none absolute -right-10 bottom-[3%] select-none text-[260px] font-black leading-none tracking-[-0.06em] text-text/[0.06]"
                style={{ animationDelay: '160ms' }}
            >
                01
            </span>

            <div className="absolute inset-x-0 bottom-0 px-6 pb-9">
                <h1
                    className="surface -ml-2 text-[88px] font-black leading-[0.78] tracking-[-0.055em] text-text"
                    style={{ animationDelay: '240ms' }}
                >
                    BREW
                    <br />
                    &amp; SPEAK
                </h1>

                <div
                    className="surface mt-5 flex items-center gap-3"
                    style={{ animationDelay: '340ms' }}
                >
                    <span className="h-px flex-grow bg-text/20" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-text-faint">
                        Щоденна англійська
                    </span>
                </div>

                <p
                    className="surface mt-4 max-w-[240px] text-[15px] font-medium leading-relaxed text-text-soft"
                    style={{ animationDelay: '420ms' }}
                >
                    Двадцять хвилин на день. Далі воно тримається саме.
                </p>

                {/* Not a pill. A pill is the shape an interface takes when no
                    decision was made about it - this one has a leading mark, a
                    label and a measure, and reads as a control. */}
                <button
                    onClick={onStart}
                    className="surface group mt-7 flex h-[62px] w-full items-center gap-4 rounded-[14px] bg-accent pl-5 pr-6 text-left transition-transform duration-quick ease-out active:scale-[0.985]"
                    style={{ animationDelay: '500ms' }}
                >
                    <span className="h-6 w-[3px] shrink-0 bg-white/70" />
                    <span className="text-[17px] font-extrabold tracking-tight text-white">
                        Почати
                    </span>
                    <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.2em] text-white/60">
                        ~20 хв
                    </span>
                </button>
            </div>
        </div>
    );
};
