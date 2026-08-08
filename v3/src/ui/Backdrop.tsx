import { useEffect, useRef } from 'react';
import { createBackground, type Palette } from '../lib/background';

interface Props {
    palette: Palette;
}

/**
 * The page background.
 *
 * The canvas sits behind everything and never takes a tap. If WebGL is missing
 * or the shader fails to build, the element keeps the flat base colour it was
 * given in CSS - the screen still works, it is just quieter.
 *
 * Under `prefers-reduced-motion` it draws a single frame and stops. The
 * texture is the point; the drift is not, and drifting light is exactly the
 * kind of thing that setting exists to switch off.
 */
export const Backdrop = ({ palette }: Props) => {
    const ref = useRef<HTMLCanvasElement>(null);
    const bg = useRef<ReturnType<typeof createBackground>>(null);

    useEffect(() => {
        const canvas = ref.current;
        if (!canvas) return;

        const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        bg.current = createBackground(canvas, palette, still);
        return () => {
            bg.current?.destroy();
            bg.current = null;
        };
        // Built once. Palette changes go through `setPalette` rather than a
        // rebuild - dropping and recreating the GL context on every theme
        // switch is both slow and a way to run out of contexts.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        bg.current?.setPalette(palette);
    }, [palette]);

    return (
        <canvas
            ref={ref}
            aria-hidden
            className="pointer-events-none fixed inset-0 h-full w-full bg-base"
        />
    );
};
