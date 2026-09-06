import { useEffect, useState } from 'react';
import { EmotionScene } from './EmotionScene';
import {
    DEFAULT_LAB_SETTINGS,
    FACE_PRESETS,
    type EmotionLabSettings,
    type EmotionPose,
    type FaceAxis,
    type FacePreset,
} from './types';

const STORAGE_KEY = 'english-with-coffee:emotion-lab:v5';

const POSES: Array<{ id: EmotionPose; label: string }> = [
    { id: 'neutral', label: 'Neutral' },
    { id: 'wave', label: 'Wave' },
    { id: 'present', label: 'Present' },
    { id: 'celebrate', label: 'Celebrate' },
    { id: 'wait', label: 'Wait' },
];

const MOODS: Array<{ id: FacePreset; label: string }> = [
    { id: 'happy', label: 'Радість' },
    { id: 'neutral', label: 'Спокій' },
    { id: 'sad', label: 'Сум' },
    { id: 'surprised', label: 'Подив' },
    { id: 'focused', label: 'Фокус' },
    { id: 'blank', label: 'Без обличчя' },
];

const PALETTES: Array<{
    label: string;
    colours: Partial<EmotionLabSettings['colours']>;
}> = [
    {
        label: 'Світанок',
        colours: {
            background: '#dbe9f7',
            lid: '#e7e5e2',
            body: '#f1efec',
            sleeveTop: '#6e58cc',
            sleeveBottom: '#8249c4',
            face: '#251735',
            shade: '#8795b5',
            rim: '#d7e5ff',
        },
    },
    {
        label: 'М’ята',
        colours: {
            background: '#dcefe8',
            sleeveTop: '#2f9e83',
            sleeveBottom: '#247d72',
            face: '#173d39',
            shade: '#7faaa5',
            rim: '#d6fff3',
        },
    },
    {
        label: 'Чорниця',
        colours: {
            background: '#dce5fa',
            sleeveTop: '#4369d7',
            sleeveBottom: '#3148ac',
            face: '#17204c',
            shade: '#798dbb',
            rim: '#d9e5ff',
        },
    },
    {
        label: 'Корал',
        colours: {
            background: '#f7e2da',
            sleeveTop: '#ee7466',
            sleeveBottom: '#c95464',
            face: '#552131',
            shade: '#b28688',
            rim: '#ffe3dc',
        },
    },
];

const cloneDefaults = (): EmotionLabSettings => JSON.parse(JSON.stringify(DEFAULT_LAB_SETTINGS));

const loadSettings = (): EmotionLabSettings => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return cloneDefaults();
        const parsed = JSON.parse(stored) as Partial<EmotionLabSettings>;
        return {
            ...cloneDefaults(),
            ...parsed,
            colours: { ...DEFAULT_LAB_SETTINGS.colours, ...parsed.colours },
            bands: { ...DEFAULT_LAB_SETTINGS.bands, ...parsed.bands },
            face: { ...DEFAULT_LAB_SETTINGS.face, ...parsed.face },
            render: { ...DEFAULT_LAB_SETTINGS.render, ...parsed.render },
        };
    } catch {
        return cloneDefaults();
    }
};

interface RangeProps {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (value: number) => void;
}

const Range = ({ label, value, min, max, step, onChange }: RangeProps) => (
    <label className="grid grid-cols-[1fr_64px] items-center gap-x-3 gap-y-1.5 text-[12px] font-bold text-white/72">
        <span>{label}</span>
        <output className="font-mono text-right text-[11px] text-white/46">{value.toFixed(step < 0.01 ? 3 : 2)}</output>
        <input
            className="emotion-lab-range col-span-2 w-full accent-[#7fa6ff]"
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={event => onChange(Number(event.currentTarget.value))}
        />
    </label>
);

interface ColourProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
}

const Colour = ({ label, value, onChange }: ColourProps) => (
    <label className="flex items-center justify-between gap-3 rounded-[12px] border border-white/8 bg-white/[0.035] px-3 py-2">
        <span className="text-[12px] font-bold text-white/68">{label}</span>
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase text-white/38">
            {value}
            <input
                type="color"
                value={value}
                onChange={event => onChange(event.currentTarget.value)}
                className="h-7 w-9 cursor-pointer rounded-[8px] border-0 bg-transparent p-0"
            />
        </span>
    </label>
);

interface ToggleProps {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}

const Toggle = ({ label, checked, onChange }: ToggleProps) => (
    <label className="flex cursor-pointer items-center justify-between gap-4 text-[12px] font-bold text-white/70">
        <span>{label}</span>
        <input
            type="checkbox"
            checked={checked}
            onChange={event => onChange(event.currentTarget.checked)}
            className="h-4 w-4 rounded border-white/20 bg-white/10 text-[#638cff] focus:ring-[#638cff]"
        />
    </label>
);

const Section = ({ title, children, open = false }: { title: string; children: React.ReactNode; open?: boolean }) => (
    <details open={open} className="group border-t border-white/10 py-4">
        <summary className="cursor-pointer list-none text-[11px] font-black uppercase tracking-[0.18em] text-white/50">
            <span className="inline-flex w-full items-center justify-between">
                {title}
                <span className="text-white/25 transition group-open:rotate-45">＋</span>
            </span>
        </summary>
        <div className="mt-4 space-y-3">{children}</div>
    </details>
);

export const EmotionLab = () => {
    const [settings, setSettings] = useState<EmotionLabSettings>(loadSettings);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }, [settings]);

    const updateColours = (patch: Partial<EmotionLabSettings['colours']>) =>
        setSettings(current => ({ ...current, colours: { ...current.colours, ...patch } }));
    const updateBands = (patch: Partial<EmotionLabSettings['bands']>) =>
        setSettings(current => ({ ...current, bands: { ...current.bands, ...patch } }));
    const updateFace = (patch: Partial<EmotionLabSettings['face']>) =>
        setSettings(current => ({ ...current, face: { ...current.face, ...patch } }));
    const updateRender = (patch: Partial<EmotionLabSettings['render']>) =>
        setSettings(current => ({ ...current, render: { ...current.render, ...patch } }));

    const chooseMood = (preset: FacePreset) => {
        setSettings(current => ({
            ...current,
            facePreset: preset,
            face: { ...current.face, ...FACE_PRESETS[preset] },
        }));
    };

    const copyPreset = async () => {
        await navigator.clipboard.writeText(JSON.stringify(settings, null, 2));
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
    };

    return (
        <main className="grid h-[100dvh] min-h-0 bg-[#101217] text-white lg:grid-cols-[minmax(0,1fr)_390px]">
            <section className="relative min-h-[44vh] overflow-hidden lg:min-h-0">
                <EmotionScene settings={settings} />

                <div className="absolute inset-x-4 bottom-4 flex flex-wrap gap-2">
                    {POSES.map(pose => (
                        <button
                            key={pose.id}
                            type="button"
                            onClick={() => setSettings(current => ({ ...current, pose: pose.id }))}
                            className={`rounded-pill border px-3 py-2 text-[11px] font-extrabold transition ${
                                settings.pose === pose.id
                                    ? 'border-white bg-white text-[#17213d]'
                                    : 'border-white/45 bg-[#17213d]/45 text-white backdrop-blur-sm hover:bg-[#17213d]/70'
                            }`}
                        >
                            {pose.label}
                        </button>
                    ))}
                </div>
            </section>

            <aside className="emotion-lab-panel min-h-0 overflow-y-auto border-l border-white/10 bg-[#151820] px-5 pb-8 pt-5">
                <div className="flex items-start justify-between gap-4 pb-5">
                    <div>
                        <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#82a5ff]">Dev sandbox</p>
                        <h1 className="mt-1 text-[24px] font-black tracking-[-0.03em]">Emotion Lab</h1>
                        <p className="mt-1 max-w-[260px] text-[11px] leading-relaxed text-white/42">
                            Налаштування зберігаються лише в цьому браузері. Застосунок і база не змінюються.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setSettings(cloneDefaults())}
                        className="rounded-[10px] border border-white/12 px-3 py-2 text-[10px] font-bold text-white/55 hover:bg-white/5"
                    >
                        Reset
                    </button>
                </div>

                <Section title="Емоція" open>
                    <div className="grid grid-cols-3 gap-2">
                        {MOODS.map(mood => (
                            <button
                                key={mood.id}
                                type="button"
                                onClick={() => chooseMood(mood.id)}
                                className={`rounded-[10px] px-2 py-2 text-[10px] font-extrabold ${
                                    settings.facePreset === mood.id
                                        ? 'bg-[#638cff] text-white'
                                        : 'bg-white/[0.055] text-white/55 hover:bg-white/10'
                                }`}
                            >
                                {mood.label}
                            </button>
                        ))}
                    </div>
                    <label className="flex items-center justify-between gap-3 text-[12px] font-bold text-white/70">
                        Напрямок обличчя
                        <select
                            value={settings.faceAxis}
                            onChange={event => setSettings(current => ({ ...current, faceAxis: event.currentTarget.value as FaceAxis }))}
                            className="rounded-[9px] border border-white/10 bg-[#20242e] px-2 py-1.5 text-[11px] text-white"
                        >
                            <option value="+z">+Z</option>
                            <option value="-z">−Z</option>
                            <option value="+x">+X</option>
                            <option value="-x">−X</option>
                        </select>
                    </label>
                    <Range label="Масштаб обличчя" value={settings.face.unit} min={0.22} max={0.48} step={0.005} onChange={unit => updateFace({ unit })} />
                    <Range label="Висота обличчя" value={settings.face.centreY} min={-0.18} max={0.2} step={0.005} onChange={centreY => updateFace({ centreY })} />
                    <Range label="Відстань очей" value={settings.face.eyeSeparation} min={0.3} max={0.72} step={0.005} onChange={eyeSeparation => updateFace({ eyeSeparation })} />
                    <Range label="Ширина очей" value={settings.face.eyeWidth} min={0.08} max={0.28} step={0.002} onChange={eyeWidth => updateFace({ eyeWidth })} />
                    <Range label="Висота очей" value={settings.face.eyeHeight} min={0.06} max={0.3} step={0.002} onChange={eyeHeight => updateFace({ eyeHeight })} />
                    <Range label="Висота рота" value={settings.face.mouthVertexY} min={-0.75} max={-0.12} step={0.005} onChange={mouthVertexY => updateFace({ mouthVertexY })} />
                    <Range label="Ширина рота" value={settings.face.mouthWidth} min={0.15} max={0.55} step={0.005} onChange={mouthWidth => updateFace({ mouthWidth })} />
                    <Range label="Вигин рота" value={settings.face.mouthSag} min={-0.25} max={0.25} step={0.005} onChange={mouthSag => updateFace({ mouthSag })} />
                    <Range label="Товщина рота" value={settings.face.mouthThickness} min={0.012} max={0.18} step={0.001} onChange={mouthThickness => updateFace({ mouthThickness })} />
                </Section>

                <Section title="Палітра" open>
                    <div className="grid grid-cols-2 gap-2">
                        {PALETTES.map(palette => (
                            <button
                                key={palette.label}
                                type="button"
                                onClick={() => updateColours(palette.colours)}
                                className="rounded-[10px] border border-white/8 bg-white/[0.045] px-3 py-2 text-[10px] font-extrabold text-white/58 hover:bg-white/10"
                            >
                                {palette.label}
                            </button>
                        ))}
                    </div>
                    <Colour label="Фон" value={settings.colours.background} onChange={background => updateColours({ background })} />
                    <Colour label="Кришка" value={settings.colours.lid} onChange={lid => updateColours({ lid })} />
                    <Colour label="Корпус" value={settings.colours.body} onChange={body => updateColours({ body })} />
                    <Colour label="Рукав зверху" value={settings.colours.sleeveTop} onChange={sleeveTop => updateColours({ sleeveTop })} />
                    <Colour label="Рукав знизу" value={settings.colours.sleeveBottom} onChange={sleeveBottom => updateColours({ sleeveBottom })} />
                    <Colour label="Обличчя" value={settings.colours.face} onChange={face => updateColours({ face })} />
                    <Colour label="Глибока тінь" value={settings.colours.shade} onChange={shade => updateColours({ shade })} />
                    <Colour label="Контрове світло" value={settings.colours.rim} onChange={rim => updateColours({ rim })} />
                    <Toggle label="Чистий білий силует" checked={settings.silhouette} onChange={silhouette => setSettings(current => ({ ...current, silhouette }))} />
                </Section>

                <Section title="Межі матеріалів">
                    <Range label="Початок рукава" value={settings.bands.sleeveBottom} min={0.08} max={0.48} step={0.005} onChange={value => updateBands({ sleeveBottom: value })} />
                    <Range label="Кінець рукава" value={settings.bands.sleeveTop} min={0.45} max={0.82} step={0.005} onChange={value => updateBands({ sleeveTop: value })} />
                    <Range label="Початок кришки" value={settings.bands.lidStart} min={0.62} max={0.94} step={0.005} onChange={value => updateBands({ lidStart: value })} />
                    <Range label="М’якість межі" value={settings.bands.softness} min={0.002} max={0.06} step={0.002} onChange={value => updateBands({ softness: value })} />
                </Section>

                <Section title="Камера і світло">
                    <Toggle label="Автообертання" checked={settings.autoRotate} onChange={autoRotate => setSettings(current => ({ ...current, autoRotate }))} />
                    <Range label="Поворот Y" value={settings.render.yaw} min={-180} max={180} step={1} onChange={yaw => updateRender({ yaw })} />
                    <Range label="Нахил X" value={settings.render.pitch} min={-45} max={45} step={1} onChange={pitch => updateRender({ pitch })} />
                    <Range label="Поворот Z" value={settings.render.roll} min={-180} max={180} step={1} onChange={roll => updateRender({ roll })} />
                    <Range label="Масштаб" value={settings.render.scale} min={0.65} max={1.8} step={0.01} onChange={scale => updateRender({ scale })} />
                    <Range label="Основне світло" value={settings.render.light} min={0} max={1.4} step={0.02} onChange={light => updateRender({ light })} />
                    <Range label="Заповнення" value={settings.render.ambient} min={0.15} max={0.9} step={0.02} onChange={ambient => updateRender({ ambient })} />
                    <Range label="Світло по краю" value={settings.render.rim} min={0} max={0.9} step={0.02} onChange={rim => updateRender({ rim })} />
                </Section>

                <button
                    type="button"
                    onClick={copyPreset}
                    className="mt-2 h-11 w-full rounded-[12px] bg-[#638cff] text-[12px] font-black text-white shadow-[0_10px_28px_rgba(54,91,210,0.3)] active:translate-y-px"
                >
                    {copied ? 'Preset скопійовано' : 'Скопіювати preset JSON'}
                </button>
            </aside>
        </main>
    );
};
