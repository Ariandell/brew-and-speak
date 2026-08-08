import type { CupColours } from '../lib/cup';
import type { Palette } from '../lib/scene';

/**
 * A theme is one set of interface colours plus the palette the water is
 * painted with. Both live together on purpose: the shader is the largest
 * surface on screen, and letting it drift from the interface colours is
 * exactly how a background stops belonging to the app.
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
    shader: Palette;
    cup: CupColours;
}

const rgb = (hex: string): [number, number, number] => [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
];

export const THEMES: Theme[] = [
    {
        name: 'ink',
        label: 'Глибина',
        vars: {
            '--c-base': '9 12 24',
            '--c-surface': '22 27 44',
            '--c-raised': '31 38 60',
            '--c-line': '48 58 86',
            '--c-text': '238 241 250',
            '--c-text-soft': '158 168 194',
            '--c-text-faint': '108 118 145',
            '--c-accent': '110 150 255',
            '--c-accent-deep': '70 108 220',
            '--c-accent-tint': '34 46 84',
            '--c-warm': '244 172 78',
            '--c-good': '52 200 152',
            '--c-alert': '240 108 96',
        },
        shader: {
            ramp: [rgb('#05070F'), rgb('#101E4E'), rgb('#2A4DAE'), rgb('#7FA0F5')],
            bubbleTint: rgb('#D8E6FF'),
            flow: 0.05,
            bubbles: 1,
            grain: 0.028,
        },
        cup: {
            lid: rgb('#EFE7DA'),
            body: rgb('#F4F6FB'),
            sleeve: rgb('#3D63DE'),
            shade: rgb('#16255E'),
            rim: rgb('#8FB4FF'),
            depthTint: 1.1,
        },
    },
    {
        name: 'espresso',
        label: 'Еспресо',
        vars: {
            '--c-base': '18 13 11',
            '--c-surface': '33 25 21',
            '--c-raised': '45 34 29',
            '--c-line': '66 51 43',
            '--c-text': '247 241 234',
            '--c-text-soft': '180 165 152',
            '--c-text-faint': '128 114 104',
            '--c-accent': '235 163 74',
            '--c-accent-deep': '200 126 40',
            '--c-accent-tint': '64 45 27',
            '--c-warm': '228 122 74',
            '--c-good': '110 180 122',
            '--c-alert': '226 98 80',
        },
        shader: {
            ramp: [rgb('#0E0907'), rgb('#3A2011'), rgb('#8A4A16'), rgb('#E5A353')],
            bubbleTint: rgb('#FFE3B8'),
            flow: 0.045,
            bubbles: 0.85,
            grain: 0.03,
        },
        cup: {
            lid: rgb('#F3E7D3'),
            body: rgb('#FBF5EC'),
            sleeve: rgb('#D9822B'),
            shade: rgb('#3A2011'),
            rim: rgb('#F0B469'),
            depthTint: 1,
        },
    },
    {
        name: 'dawn',
        label: 'Світанок',
        vars: {
            '--c-base': '245 239 230',
            '--c-surface': '255 255 255',
            '--c-raised': '255 255 255',
            '--c-line': '224 216 204',
            '--c-text': '26 24 33',
            '--c-text-soft': '95 90 105',
            '--c-text-faint': '148 143 158',
            '--c-accent': '43 92 232',
            '--c-accent-deep': '28 66 186',
            '--c-accent-tint': '221 231 255',
            '--c-warm': '226 140 44',
            '--c-good': '30 160 120',
            '--c-alert': '216 84 70',
        },
        shader: {
            ramp: [rgb('#D2C6B4'), rgb('#EDE3D4'), rgb('#CFE0F6'), rgb('#FFFAF2')],
            bubbleTint: rgb('#FFFFFF'),
            flow: 0.04,
            bubbles: 0.7,
            grain: 0.024,
        },
        cup: {
            lid: rgb('#EFE6D6'),
            body: rgb('#FFFFFF'),
            sleeve: rgb('#2B5CE8'),
            shade: rgb('#9AA4BC'),
            rim: rgb('#BFD4F5'),
            depthTint: 0.7,
        },
    },
];

export const applyTheme = (theme: Theme) => {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(theme.vars)) root.style.setProperty(key, value);
    root.dataset.theme = theme.name;
};
