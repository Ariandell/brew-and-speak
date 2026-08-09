import type { CupColours } from '../lib/cup';
import type { Palette } from '../lib/scene';

/**
 * A theme is one set of interface colours plus the palette the water is
 * painted with and the one the cup is made of. All three live together on
 * purpose: the shader is the largest surface on screen and the cup is what
 * stands on it, so letting either drift from the interface colours is how a
 * background stops belonging to the app.
 *
 * There is one theme. The shape is kept because it is what holds colour out of
 * the components - not because a second theme is planned. Adding one later is
 * an entry in this list and nothing else.
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
            lid: rgb('#E4E4E6'),
            body: rgb('#F0F0F2'),
            sleeveTop: rgb('#6E58CC'),
            sleeveBottom: rgb('#7B44C2'),
            faceInk: rgb('#241634'),
            shade: rgb('#9AA4BC'),
            rim: rgb('#C6D6F2'),
            depthTint: 0.55,
        },
    },
];

export const applyTheme = (theme: Theme) => {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(theme.vars)) root.style.setProperty(key, value);
    root.dataset.theme = theme.name;
};
