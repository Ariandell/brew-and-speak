/**
 * A theme is one set of surface and text colours plus the palette the
 * background shader paints with. Both live together on purpose: the shader is
 * the largest surface on screen, and letting it drift from the interface
 * colours is exactly how a background stops belonging to the app.
 *
 * Interface colours are raw `r g b` triplets for Tailwind's alpha modifiers.
 * Shader colours are 0..1 floats because that is what GLSL wants, and
 * converting on every frame would be waste.
 */
export interface Theme {
    name: string;
    label: string;
    /** Written onto the root element as CSS variables. */
    vars: Record<string, string>;
    shader: {
        base: [number, number, number];
        glowA: [number, number, number];
        glowB: [number, number, number];
        /** How far the light travels from its centre. */
        reach: number;
        /** Film grain. Small numbers only - it is there to kill banding. */
        grain: number;
    };
}

const rgb = (hex: string): [number, number, number] => [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
];

export const THEMES: Theme[] = [
    {
        name: 'dawn',
        label: 'Світанок',
        vars: {
            '--c-base': '250 246 240',
            '--c-surface': '255 255 255',
            '--c-raised': '255 255 255',
            '--c-line': '226 220 211',
            '--c-text': '26 24 33',
            '--c-text-soft': '95 90 105',
            '--c-text-faint': '148 143 158',
            '--c-accent': '43 92 232',
            '--c-accent-deep': '28 66 186',
            '--c-accent-tint': '221 231 255',
            '--c-warm': '236 148 52',
            '--c-good': '30 160 120',
            '--c-alert': '224 92 78',
        },
        shader: {
            base: rgb('#F7F1E8'),
            glowA: rgb('#C9D8FF'),
            glowB: rgb('#FFE2BC'),
            reach: 0.95,
            grain: 0.022,
        },
    },
    {
        name: 'ink',
        label: 'Ніч',
        vars: {
            '--c-base': '13 16 28',
            '--c-surface': '24 28 44',
            '--c-raised': '32 37 56',
            '--c-line': '48 55 78',
            '--c-text': '238 240 248',
            '--c-text-soft': '160 168 190',
            '--c-text-faint': '110 118 140',
            '--c-accent': '92 134 255',
            '--c-accent-deep': '62 100 220',
            '--c-accent-tint': '38 48 82',
            '--c-warm': '244 172 78',
            '--c-good': '52 200 152',
            '--c-alert': '240 108 96',
        },
        shader: {
            base: rgb('#0B0E18'),
            glowA: rgb('#2B49B8'),
            glowB: rgb('#7A3FA8'),
            reach: 1.15,
            grain: 0.03,
        },
    },
    {
        name: 'espresso',
        label: 'Еспресо',
        vars: {
            '--c-base': '22 17 15',
            '--c-surface': '34 27 24',
            '--c-raised': '44 35 31',
            '--c-line': '62 50 44',
            '--c-text': '246 240 234',
            '--c-text-soft': '176 163 152',
            '--c-text-faint': '124 112 103',
            '--c-accent': '232 156 62',
            '--c-accent-deep': '198 122 38',
            '--c-accent-tint': '62 45 28',
            '--c-warm': '226 118 72',
            '--c-good': '104 176 118',
            '--c-alert': '224 96 78',
        },
        shader: {
            base: rgb('#150F0D'),
            glowA: rgb('#7A3E12'),
            glowB: rgb('#3A2418'),
            reach: 1.05,
            grain: 0.032,
        },
    },
];

export const applyTheme = (theme: Theme) => {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(theme.vars)) root.style.setProperty(key, value);
    root.dataset.theme = theme.name;
};
