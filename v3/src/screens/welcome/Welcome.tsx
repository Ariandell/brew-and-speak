import { useEffect } from 'react';
import { useScene } from '../../ui/SceneProvider';

interface Props {
    onStart: () => void;
}

/**
 * The first screen.
 *
 * There is no card, no panel and no frame. The water and the cup are already
 * doing the work, and putting decorated surfaces over a rich background is
 * what turns richness into noise. Everything here is type on water plus one
 * thing to press.
 *
 * The drive is meant to come from three places instead:
 *
 * - the gap in scale, with a wordmark far larger than anything near it and
 *   nothing in between
 * - the entrance, where each line surfaces from below on the same vector
 * - the cup, which is not an illustration of the screen but the thing the
 *   screen is arranged around
 */
export const Welcome = ({ onStart }: Props) => {
    const scene = useScene();

    useEffect(() => {
        // The screen says where the cup belongs; the cup swims there itself.
        scene?.setPose({ x: 0, y: 0.34, scale: 0.82 });
    }, [scene]);

    return (
        <div className="relative flex min-h-[100dvh] flex-col justify-end px-7 pb-12">
            <p
                className="surface text-[11px] font-extrabold uppercase tracking-[0.22em] text-text-faint"
                style={{ animationDelay: '120ms' }}
            >
                Англійська щодня
            </p>

            <h1
                className="surface mt-4 text-[62px] font-black leading-[0.86] tracking-[-0.03em] text-text"
                style={{ animationDelay: '200ms' }}
            >
                BREW
                <br />
                &amp; SPEAK
            </h1>

            <p
                className="surface mt-5 max-w-[260px] text-[15px] font-medium leading-relaxed text-text-soft"
                style={{ animationDelay: '320ms' }}
            >
                Двадцять хвилин на день. Далі воно тримається саме.
            </p>

            <div className="surface mt-9" style={{ animationDelay: '420ms' }}>
                <button
                    onClick={onStart}
                    className="h-14 w-full rounded-pill bg-accent text-[16px] font-extrabold text-white transition-transform duration-quick ease-out active:scale-[0.98]"
                >
                    Почати
                </button>
            </div>

            <p
                className="surface mt-5 text-center text-[12px] font-medium text-text-faint"
                style={{ animationDelay: '520ms' }}
            >
                Торкніться будь-де — вода відгукнеться
            </p>
        </div>
    );
};
