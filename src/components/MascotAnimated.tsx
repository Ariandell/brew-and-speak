import React, { useEffect, useRef, useState } from 'react';

// The mascot reacting to a flashcard answer, restored from the March 20 build.
//
// That build decoded the APNGs with apng-js and drove a canvas, because it
// wanted each clip to stop on its last frame. It does not need to: every one of
// these files carries numPlays = 1 in its acTL chunk, so a plain <img> plays it
// once and holds the final frame. Same result, no dependency, no canvas.
//
// The clips are 300x533, not square. The box below keeps the original's
// proportions - a size x size slot holding an image scaled to size * 1.5 and
// nudged 4% right - so the cup lands where it used to.

// Opening.apng is deliberately absent. The March build drove these through
// apng-js onto a canvas, which keeps whatever was last painted, so a clip that
// ends on an empty frame still left the cup on screen. An <img> shows the real
// composited result instead - and Opening's final frame is fully transparent,
// which is why the mascot went missing when it was used as the resting clip.
// The other four all settle on a visible pose, so every state maps to one.
const CLIPS = {
    idleToHappy: '/assets/mascot/animations/IdleToHappy.apng',
    happyToIdle: '/assets/mascot/animations/HappyToIdle.apng',
    idleToSad: '/assets/mascot/animations/IdleToSad.apng',
    sadToIdle: '/assets/mascot/animations/sadToIdel.apng',
} as const;

type Clip = keyof typeof CLIPS;

// happyToIdle doubles as the resting state: it ends on the idle pose.
const transition = (next: string, prev: string | null): Clip => {
    if (next === 'happy' || next === 'perfect') return 'idleToHappy';
    if (next === 'sad' || next === 'surprised') return 'idleToSad';
    if (prev === 'sad' || prev === 'surprised') return 'sadToIdle';
    return 'happyToIdle';
};

let preloaded = false;

interface Props {
    mood: string;
    size?: number;
    style?: React.CSSProperties;
}

export const MascotAnimated: React.FC<Props> = ({ mood, size = 320, style }) => {
    // Seeded with the first mood so mounting plays Opening and nothing else.
    const prevMood = useRef<string | null>(mood);
    const [clip, setClip] = useState<Clip>('happyToIdle');
    const [failed, setFailed] = useState(false);

    // Warm the cache once per session, a moment after mount so it never
    // competes with the first paint. Without this the first swap of src shows
    // a gap while 1.5 MB decodes, which reads as a flicker.
    useEffect(() => {
        if (preloaded) return;
        preloaded = true;
        const timer = setTimeout(() => {
            for (const url of Object.values(CLIPS)) new Image().src = url;
        }, 600);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const prev = prevMood.current;
        if (prev === mood) return;
        prevMood.current = mood;
        setClip(transition(mood, prev));
    }, [mood]);

    // The clips are 300x533 with a lot of transparent margin - the cup itself
    // fills roughly 38% of the frame height. `size` is the height of the frame,
    // so the visible cup comes out at about a third of it. Width follows the
    // real ratio: forcing a square box here is what shrank the cup to nothing.
    const width = Math.round(size * (300 / 533));
    const inner: React.CSSProperties = { width, height: size, display: 'block', pointerEvents: 'none' };

    return (
        <div style={{ width, height: size, position: 'relative', ...style }}>
            {failed
                ? <img src={`/assets/mascot/${mood || 'neutral'}.png`} alt="" style={{ ...inner, objectFit: 'contain' }} />
                : <img src={CLIPS[clip]} alt="" onError={() => setFailed(true)} style={inner} />}
        </div>
    );
};
