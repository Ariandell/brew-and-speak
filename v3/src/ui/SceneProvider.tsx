import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';
import { Aquarium, type Reading } from './Aquarium';
import type { CupPose } from '../lib/cup';
import type { Scene, SceneLook } from '../lib/scene';

interface Handle {
    /** Ask the cup to be somewhere. It swims there; it does not cut. */
    setPose(pose: Partial<CupPose>): void;
}

const SceneContext = createContext<Handle | null>(null);

/** Null until the scene exists, and forever if WebGL is missing. */
export const useScene = () => useContext(SceneContext);

interface Props {
    look: SceneLook;
    onMeter?: (reading: Reading) => void;
    children: ReactNode;
}

/**
 * The water, and the way screens speak to it.
 *
 * The pointer is caught here, on the whole page, rather than on the canvas -
 * the canvas takes no events at all. Every touch anywhere sends a ripple and
 * turns the cup's head, including touches that land on a button. That is the
 * point: the interface is meant to read as the surface of the water rather
 * than as glass in front of it.
 */
export type { Reading };

export const SceneProvider = ({ look, onMeter, children }: Props) => {
    const scene = useRef<Scene | null>(null);

    const handle = useMemo<Handle>(
        () => ({
            setPose: pose => scene.current?.setPose(pose),
        }),
        [],
    );

    const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        const box = event.currentTarget.getBoundingClientRect();
        scene.current?.touch(
            (event.clientX - box.left) / box.width,
            (event.clientY - box.top) / box.height,
        );
    };

    return (
        /* A phone, even on a desktop. The app only ever runs inside Telegram's
           column, so judging it at window width judges a layout that will never
           exist - and it quadruples the pixels the scene has to draw while
           doing it. */
        <div className="flex min-h-0 flex-1 justify-center bg-[#101014]">
            <div
                className="relative h-full w-full max-w-[430px] overflow-hidden"
                onPointerDown={onPointerDown}
            >
                <Aquarium look={look} onMeter={onMeter} onScene={value => (scene.current = value)} />
                <SceneContext.Provider value={handle}>{children}</SceneContext.Provider>
            </div>
        </div>
    );
};
