import React, { useEffect, useRef, useState } from 'react';

// The mascot reacting to a flashcard answer, restored from the March 20 build.
//
// That build decoded the APNGs with apng-js and drove a canvas, because it
// wanted to stop each clip on its last frame. It does not need to: every one of
// these files carries numPlays = 1 in its acTL chunk, so a plain <img> plays it
// once and holds the final frame. Same result, no dependency, no canvas.

const CLIPS = {
    opening: '/assets/mascot/animations/Opening.apng',
    idleToHappy: '/assets/mascot/animations/IdleToHappy.apng',
    happyToIdle: '/assets/mascot/animations/HappyToIdle.apng',
    idleToSad: '/assets/mascot/animations/IdleToSad.apng',
    sadToIdle: '/assets/mascot/animations/sadToIdel.apng',
} as const;

type Clip = keyof typeof CLIPS;

// Which clip bridges the previous mood to the new one, as in the original.
const transition = (next: string, prev: string | null): Clip => {
    if (next === 'happy' || next === 'perfect') return 'idleToHappy';
    if (next === 'sad' || next === 'surprised') return 'idleToSad';
    if (prev === 'happy' || prev === 'perfect') return 'happyToIdle';
    if (prev === 'sad' || prev === 'surprised') return 'sadToIdle';
    return 'opening';
};

interface Props {
    mood: string;
    size?: number;
    style?: React.CSSProperties;
}

export const MascotAnimated: React.FC<Props> = ({ mood, size = 320, style }) => {
    const prevMood = useRef<string | null>(null);
    const [clip, setClip] = useState<Clip>('opening');
    // Bumped on every mood change so the <img> remounts and the clip replays;
    // reusing the same src would leave it frozen on its last frame.
    const [play, setPlay] = useState(0);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        const prev = prevMood.current;
        if (prev === mood) return;
        prevMood.current = mood;
        setClip(transition(mood, prev));
        setPlay(n => n + 1);
    }, [mood]);

    // If an animation is missing, fall back to the still image for that mood
    // rather than leaving a hole in the layout.
    if (failed) {
        return <img src={`/assets/mascot/${mood || 'neutral'}.png`} alt="" style={{ width: size, height: size, objectFit: 'contain', ...style }} />;
    }

    return (
        <img
            key={play}
            src={CLIPS[clip]}
            alt=""
            onError={() => setFailed(true)}
            style={{ width: size, height: size, objectFit: 'contain', ...style }}
        />
    );
};
