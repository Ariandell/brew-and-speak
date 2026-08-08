import { useEffect, useRef } from 'react';
import { createScene, type Scene, type SceneLook } from '../lib/scene';

interface Props {
    look: SceneLook;
    /** Reports frame rate once a second, so the workshop can judge by measurement. */
    onMeter?: (fps: number) => void;
}

const MESH_URL = '/models/cup.msh';
const FACE_URL = '/models/faces/happy.png';

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
export const Aquarium = ({ look, onMeter }: Props) => {
    const ref = useRef<HTMLCanvasElement>(null);
    const scene = useRef<Scene | null>(null);

    useEffect(() => {
        const canvas = ref.current;
        if (!canvas) return;

        const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        scene.current = createScene(canvas, look, still, MESH_URL, FACE_URL);
        return () => {
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
        const id = window.setInterval(() => onMeter(scene.current?.fps() ?? 0), 1000);
        return () => clearInterval(id);
    }, [onMeter]);

    return (
        <canvas
            ref={ref}
            aria-hidden
            className="pointer-events-none fixed inset-0 h-full w-full bg-base"
        />
    );
};
