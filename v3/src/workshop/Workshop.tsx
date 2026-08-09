import { useCallback, useEffect, useState } from 'react';
import { SceneProvider, type Reading } from '../ui/SceneProvider';
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
    const [meter, setMeter] = useState<Reading>({
        fps: 0,
        quality: 0,
        renderer: '',
        width: 0,
        height: 0,
    });

    const theme = THEMES[themeIndex];
    const entry = ENTRIES.find(e => e.id === entryId) ?? ENTRIES[0];

    useEffect(() => applyTheme(theme), [theme]);

    return (
        /* The bar sits above the phone, not on it. Tooling drawn over the thing
           being judged changes the thing being judged - every entry would be
           looked at with a strip taken off the top. */
        <div className="flex min-h-[100dvh] flex-col bg-[#101014]">
            <header className="flex flex-wrap items-center gap-2 border-b border-white/10 px-4 py-3">
                <span className="mr-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/40">
                    Майстерня
                </span>

                    {ENTRIES.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setEntryId(item.id)}
                            className={`rounded-pill px-3 py-1.5 text-[12px] font-bold transition-colors duration-quick ease-out ${
                                item.id === entry.id
                                    ? 'bg-accent text-white'
                                    : 'bg-white/10 text-white/70'
                            }`}
                        >
                            {item.label}
                        </button>
                    ))}

                    <span className="ml-auto flex items-center gap-2">
                        {/* Measured, not guessed. The rung shows only once the
                            scene has given something up, so seeing it at all is
                            the signal that this device could not hold full
                            quality - and the renderer name says whether a real
                            GPU is doing the work at all, which is the first
                            thing to rule out when a capable machine is slow. */}
                        <span
                            className="font-mono text-[11px] tabular-nums text-white/45"
                            title={meter.renderer}
                        >
                            {meter.fps} fps
                            {meter.quality > 0 ? ' · q' + meter.quality : ''}
                            {meter.width > 0 ? ' · ' + meter.width + '×' + meter.height : ''}
                        </span>
                        {THEMES.map((option, index) => (
                            <button
                                key={option.name}
                                onClick={() => setThemeIndex(index)}
                                className={`rounded-pill px-3 py-1.5 text-[12px] font-bold transition-colors duration-quick ease-out ${
                                    index === themeIndex
                                        ? 'bg-white text-black'
                                        : 'bg-white/10 text-white/70'
                                }`}
                            >
                                {option.label}
                            </button>
                        ))}
                </span>
            </header>

            <SceneProvider
                look={{ palette: theme.shader, cup: theme.cup }}
                onMeter={useCallback(setMeter, [])}
            >
                <div className={entry.bleed ? 'min-h-[100dvh]' : 'min-h-[100dvh] p-6'}>
                    {entry.render()}
                </div>
            </SceneProvider>
        </div>
    );
};
