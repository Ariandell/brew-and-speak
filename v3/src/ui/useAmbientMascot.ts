import { useCallback, useEffect, useRef, useState } from 'react';
import type { Mood } from '../lib/cup';
import { useScene } from './SceneProvider';

const AMBIENT_MOODS: readonly Mood[] = [
    'happy', 'smirk', 'cool', 'wink', 'proud', 'surprised',
];

const nextDelay = () => 2_000 + Math.random() * 8_000;

/**
 * Harmless personality for screens where the face carries no semantic state.
 * Result, feedback and error screens deliberately do not use this hook.
 */
export function useAmbientMascot(enabled = true) {
    const scene = useScene();
    const [mood, setMood] = useState<Mood>('happy');
    const current = useRef<Mood>('happy');
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const schedule = useRef<() => void>(() => undefined);

    useEffect(() => {
        if (!enabled || !scene) return;
        let active = true;
        const plan = () => {
            if (!active) return;
            timer.current = setTimeout(() => {
                const choices = AMBIENT_MOODS.filter(item => item !== current.current);
                const next = choices[Math.floor(Math.random() * choices.length)] ?? 'happy';
                current.current = next;
                setMood(next);
                scene.express(next, 60_000);
                plan();
            }, nextDelay());
        };
        schedule.current = plan;
        scene.express(current.current, 60_000);
        plan();
        return () => {
            active = false;
            schedule.current = () => undefined;
            if (timer.current) clearTimeout(timer.current);
            timer.current = null;
        };
    }, [enabled, scene]);

    const show = useCallback((next: Mood, holdMs = 4_500) => {
        current.current = next;
        setMood(next);
        scene?.express(next, 60_000);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => schedule.current(), holdMs);
    }, [scene]);

    return { mood, show };
}
