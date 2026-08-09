import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';
import { Aquarium, type Reading } from './Aquarium';
import type { CupPose } from '../lib/cup';
import type { Scene, SceneLook } from '../lib/scene';

interface Handle {
    /** Ask the cup to be somewhere. It swims there; it does not cut. */
    setPose(pose: Partial<CupPose>): void;
    /** Turn the cup's head toward something on screen. */
    lookAt(element: HTMLElement | null): void;
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
    const frame = useRef<HTMLDivElement>(null);

    const handle = useMemo<Handle>(
        () => ({
            setPose: pose => scene.current?.setPose(pose),
            lookAt: element => {
                const box = frame.current?.getBoundingClientRect();
                const target = element?.getBoundingClientRect();
                if (!box || !target) return;
                scene.current?.look(
                    (target.left + target.width / 2 - box.left) / box.width,
                    (target.top + target.height / 2 - box.top) / box.height,
                );
            },
        }),
        [],
    );

    const at = (event: React.PointerEvent<HTMLDivElement>) => {
        const box = event.currentTarget.getBoundingClientRect();
        return [
            (event.clientX - box.left) / box.width,
            (event.clientY - box.top) / box.height,
        ] as const;
    };

    const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        const [x, y] = at(event);
        scene.current?.touch(x, y);
    };

    /* Following the finger while it is down, rather than snapping on a tap.
       On a phone there is no cursor to follow and no hover to react to, and a
       tap on empty space is a gesture nobody thinks to make - but dragging is
       the one thing everyone does without being told, and something that
       tracks continuously reads as alive in a way a discrete jump never does.
       On a desktop the same handler fires without a button held, which is the
       cursor-following behaviour for free. */
    const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        const [x, y] = at(event);
        scene.current?.look(x, y);
    };

    return (
        /* A phone, even on a desktop. The app only ever runs inside Telegram's
           column, so judging it at window width judges a layout that will never
           exist - and it quadruples the pixels the scene has to draw while
           doing it. */
        <div className="flex min-h-0 flex-1 justify-center bg-[#101014]">
            <div
                ref={frame}
                className="relative h-full w-full max-w-[430px] overflow-hidden"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
            >
                <Aquarium look={look} onMeter={onMeter} onScene={value => (scene.current = value)} />
                <SceneContext.Provider value={handle}>{children}</SceneContext.Provider>
            </div>
        </div>
    );
};
