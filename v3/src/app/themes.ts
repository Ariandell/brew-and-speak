import type { CupColours } from '../lib/cup';
import type { Palette } from '../lib/scene';

/**
 * A theme is one set of interface colours plus the palette the water is
 * painted with and the one the cup is made of. All three live together on
 * purpose: the shader is the largest surface on screen and the cup is what
 * stands on it, so letting either drift from the interface colours is how a
 * background stops belonging to the app.
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
    {
        /* Dawn's structure in a different family: the same lightness, the same
           flow, the same grain. Only the hue moves - which is the whole reason
           the numbers live apart from the colours. */
        name: 'mint',
        label: 'Мінт',
        vars: {
            '--c-base': '238 246 241',
            '--c-surface': '255 255 255',
            '--c-raised': '255 255 255',
            '--c-line': '211 227 218',
            '--c-text': '23 37 31',
            '--c-text-soft': '92 111 102',
            '--c-text-faint': '147 166 156',
            /* White on this reads at about 4.9 to 1, past the 4.5 needed at any
               size. A lighter, prettier mint does not get there, and an accent
               that cannot carry white text is not an accent. */
            '--c-accent': '12 132 101',
            '--c-accent-deep': '7 107 80',
            '--c-accent-tint': '213 240 228',
            '--c-warm': '226 160 60',
            '--c-good': '26 161 121',
            '--c-alert': '224 87 74',
        },
        shader: {
            ramp: [rgb('#B9CFC2'), rgb('#D9EADF'), rgb('#C6E6E6'), rgb('#FAFFFC')],
            bubbleTint: rgb('#FFFFFF'),
            flow: 0.04,
            bubbles: 0.7,
            grain: 0.024,
        },
        cup: {
            lid: rgb('#E5E8E6'),
            body: rgb('#F1F4F2'),
            /* Cooler at the top, greener at the bottom - the same kind of shift
               the reference sleeve has, carried into this family. */
            sleeveTop: rgb('#3FBF9C'),
            sleeveBottom: rgb('#1E9E78'),
            faceInk: rgb('#10382C'),
            shade: rgb('#94A8A0'),
            rim: rgb('#BFE6DA'),
            depthTint: 0.55,
        },
    },
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
            lid: rgb('#E9E9EC'),
            body: rgb('#F1F2F6'),
            sleeveTop: rgb('#5570E4'),
            sleeveBottom: rgb('#3C46C6'),
            faceInk: rgb('#12193C'),
            shade: rgb('#16255E'),
            rim: rgb('#8FB4FF'),
            depthTint: 1.1,
        },
    },
];

export const applyTheme = (theme: Theme) => {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(theme.vars)) root.style.setProperty(key, value);
    root.dataset.theme = theme.name;
};
