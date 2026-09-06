import { useEffect, useRef } from 'react';
import { createScene, type Scene, type SceneLook } from '../lib/scene';

/** What the workshop shows in its corner, so nothing has to be guessed. */
export interface Reading {
    fps: number;
    quality: number;
    renderer: string;
    width: number;
    height: number;
}

interface Props {
    look: SceneLook;
    /** Reports frame rate once a second, so the workshop can judge by measurement. */
    onMeter?: (reading: Reading) => void;
    /** Hands the scene out once it exists, or null when WebGL is missing. */
    onScene?: (scene: Scene | null) => void;
}

const MESH_URL = '/models/cup.msh';

/**
 * The space the app lives in: water, bubbles, and the cup floating in it.
 *
 * The canvas sits behind everything and never takes a tap. If WebGL is missing
 * or a shader fails to build, the element keeps the flat base colour it was
 * given in CSS - the screen still works, it is just quieter.
 *
 * Under `prefers-reduced-motion` it draws a single frame and stops. The
 * texture is the point; the drift is not, and drifting light is exactly the
 * kind of thing that setting exists to switch off.
 */
export const Aquarium = ({ look, onMeter, onScene }: Props) => {
    const ref = useRef<HTMLCanvasElement>(null);
    const scene = useRef<Scene | null>(null);

    useEffect(() => {
        const canvas = ref.current;
        if (!canvas) return;

        const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        scene.current = createScene(canvas, look, still, MESH_URL);
        onScene?.(scene.current);
        const restore = () => {
            scene.current?.destroy();
            scene.current = createScene(canvas, look, still, MESH_URL);
            onScene?.(scene.current);
        };
        canvas.addEventListener('webglcontextrestored', restore);
        return () => {
            canvas.removeEventListener('webglcontextrestored', restore);
            onScene?.(null);
            scene.current?.destroy();
            scene.current = null;
        };
        // Built once. Look changes go through `setLook` rather than a rebuild -
        // dropping and recreating the GL context on every theme switch is both
        // slow and a way to run out of contexts.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        scene.current?.setLook(look);
    }, [look]);

    useEffect(() => {
        if (!onMeter) return;
        const id = window.setInterval(() => {
            const value = scene.current;
            if (!value) return;
            const { renderer, width, height } = value.info();
            onMeter({ fps: value.fps(), quality: value.quality(), renderer, width, height });
        }, 1000);
        return () => clearInterval(id);
    }, [onMeter]);

    return (
        <canvas
            ref={ref}
            aria-hidden
            className="aquarium-canvas pointer-events-none absolute inset-0 z-0 h-full w-full"
        />
    );
};
