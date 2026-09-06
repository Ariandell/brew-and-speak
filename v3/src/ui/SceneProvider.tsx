import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';
import { Aquarium, type Reading } from './Aquarium';
import type { CupPose, Mood } from '../lib/cup';
import type { Scene, SceneLook } from '../lib/scene';
import { mascotPoseUrl, type MascotPose } from '../scene/mascotPoses';

interface Handle {
    placeIn(element: HTMLElement): void;
    setCharacter(pose: MascotPose): void;
    /** Ask the cup to be somewhere. It swims there; it does not cut. */
    setPose(pose: Partial<CupPose>): void;
    /** Turn the cup's head toward something on screen. */
    lookAt(element: HTMLElement | null): void;
    /** Wear a mood for a moment. Passing 'happy' settles back for good. */
    express(mood: Mood, holdMs?: number): void;
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
    const queuedPose = useRef<Partial<CupPose> | null>(null);
    const queuedCharacter = useRef<MascotPose>('reference');
    const frame = useRef<HTMLDivElement>(null);

    const handle = useMemo<Handle>(
        () => ({
            placeIn: element => {
                const box = frame.current?.getBoundingClientRect();
                const slot = element.getBoundingClientRect();
                if (!box || !box.height) return;
                const visible = slot.bottom > box.top && slot.top < box.bottom;
                const pose = { x: ((slot.left + slot.width / 2 - box.left) / box.width) * 2 - 1,
                    y: 1 - ((slot.top + slot.height / 2 - box.top) / box.height) * 2,
                    scale: visible ? Math.min(slot.height, slot.width) / (box.height * .55) * .82 : 0,
                    roll: 0, lookYaw: 0, lookPitch: 0 };
                queuedPose.current = pose;
                scene.current?.setPose(pose);
            },
            setCharacter: pose => {
                queuedCharacter.current = pose;
                scene.current?.setModel(mascotPoseUrl(pose));
            },
            setPose: pose => {
                queuedPose.current = { ...queuedPose.current, ...pose };
                scene.current?.setPose(pose);
            },
            express: (mood, holdMs) => scene.current?.express(mood, holdMs),
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
        if (event.pointerType !== 'mouse') return;
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
                <Aquarium
                    look={look}
                    onMeter={onMeter}
                    onScene={value => {
                        scene.current = value;
                        if (value) value.setModel(mascotPoseUrl(queuedCharacter.current));
                        if (value && queuedPose.current) value.setPose(queuedPose.current);
                    }}
                />
                <SceneContext.Provider value={handle}>
                    <div className="relative z-10 h-full">{children}</div>
                </SceneContext.Provider>
            </div>
        </div>
    );
};
