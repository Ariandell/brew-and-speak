import { useCallback, useEffect, useState } from 'react';
import { SceneProvider } from '../ui/SceneProvider';
import { THEMES, applyTheme } from '../app/themes';
import { ENTRIES } from './registry';

/**
 * Where components are built and judged, one at a time.
 *
 * The background canvas is mounted here rather than inside an entry: it is the
 * ground everything else is drawn on, so every component has to be looked at
 * standing on it. Judging a button against plain white and then dropping it
 * onto a lit surface is how an interface ends up feeling assembled from parts.
 *
 * This is the app for now. Screens come last, once there is something to build
 * them from.
 */
export const Workshop = () => {
    const [themeIndex, setThemeIndex] = useState(0);
    const [entryId, setEntryId] = useState(ENTRIES[0].id);
    const [fps, setFps] = useState(0);

    const theme = THEMES[themeIndex];
    const entry = ENTRIES.find(e => e.id === entryId) ?? ENTRIES[0];

    useEffect(() => applyTheme(theme), [theme]);

    return (
        <SceneProvider look={{ palette: theme.shader, cup: theme.cup }} onMeter={useCallback(setFps, [])}>
            <div className="relative flex min-h-[100dvh] flex-col">
                <header className="flex flex-wrap items-center gap-2 border-b border-line/60 px-4 py-3 backdrop-blur-sm">
                    <span className="mr-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-text-faint">
                        Майстерня
                    </span>

                    {ENTRIES.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setEntryId(item.id)}
                            className={`rounded-pill px-3 py-1.5 text-[12px] font-bold transition-colors duration-quick ease-out ${
                                item.id === entry.id
                                    ? 'bg-accent text-white'
                                    : 'bg-surface/70 text-text-soft'
                            }`}
                        >
                            {item.label}
                        </button>
                    ))}

                    <span className="ml-auto flex items-center gap-2">
                        {/* Measured, not guessed: the shader is the one thing here
                            that can quietly cost a phone its frame rate. */}
                        <span className="font-mono text-[11px] tabular-nums text-text-faint">
                            {fps} fps
                        </span>
                        {THEMES.map((option, index) => (
                            <button
                                key={option.name}
                                onClick={() => setThemeIndex(index)}
                                className={`rounded-pill px-3 py-1.5 text-[12px] font-bold transition-colors duration-quick ease-out ${
                                    index === themeIndex
                                        ? 'bg-text text-base'
                                        : 'bg-surface/70 text-text-soft'
                                }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </span>
                </header>

                <main className={entry.bleed ? 'flex-grow' : 'flex-grow p-6'}>{entry.render()}</main>
            </div>
        </SceneProvider>
    );
};
