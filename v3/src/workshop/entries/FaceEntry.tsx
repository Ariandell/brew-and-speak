import { useState } from 'react';
import { useScene } from '../../ui/SceneProvider';
import type { Mood } from '../../lib/cup';

const MOODS: { id: Mood; label: string }[] = [
    { id: 'happy', label: 'Радість' },
    { id: 'surprised', label: 'Здивування' },
    { id: 'sad', label: 'Сум' },
];

/**
 * The moods, one at a time and on the water they will live on.
 *
 * Holding a mood rather than flashing it is the point of the entry: what has
 * to be judged is not the shape at rest but the road between shapes, and a
 * road is only visible while something is travelling it.
 */
export const FaceEntry = () => {
    const scene = useScene();
    const [held, setHeld] = useState<Mood>('happy');

    const wear = (mood: Mood) => {
        setHeld(mood);
        // A very long hold, so it stays put until another is chosen.
        scene?.express(mood, 600000);
    };

    return (
        <div className="flex h-full flex-col justify-end gap-3 p-6">
            <p className="max-w-[260px] text-[13px] leading-relaxed text-text-soft">
                Настрій — це числа, тож між ними є шлях. Дивимось не на форму, а на перехід.
            </p>
            <div className="flex gap-2">
                {MOODS.map(mood => (
                    <button
                        key={mood.id}
                        onClick={() => wear(mood.id)}
                        className={`rounded-pill px-4 py-2 text-[12px] font-bold transition-colors duration-quick ease-out ${
                            held === mood.id ? 'bg-accent text-white' : 'bg-surface/80 text-text-soft'
                        }`}
                    >
                        {mood.label}
                    </button>
                ))}
            </div>
        </div>
    );
};
