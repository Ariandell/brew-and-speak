import { useEffect, useRef } from 'react';
import { useScene } from './SceneProvider';
import type { MascotPose } from '../scene/mascotPoses';
import type { Mood } from '../lib/cup';

/** Layout reservation only; the shared scene owns geometry, camera and materials. */
export function MascotSpot({ pose, mood = 'happy', className }: { pose: MascotPose; mood?: Mood; className?: string }) {
    const element = useRef<HTMLDivElement>(null);
    const scene = useScene();
    useEffect(() => {
        const slot = element.current;
        if (!slot || !scene) return;
        scene.setCharacter(pose);
        scene.express(mood, 60000);
        let frame = 0;
        const update = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => scene.placeIn(slot)); };
        const observer = new ResizeObserver(update);
        observer.observe(slot);
        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        update();
        return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
    }, [pose, mood, scene]);
    return <div ref={element} aria-hidden className={`pointer-events-none mx-auto h-[148px] w-[180px] ${className ?? ''}`} />;
}
