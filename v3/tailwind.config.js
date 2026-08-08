/**
 * Colours are not written here - they are read from CSS variables, so a theme
 * swap is one attribute on the root element and no component changes.
 *
 * Variables hold raw `r g b` triplets rather than hex, which is what lets the
 * opacity modifiers keep working: `bg-surface/60` compiles to
 * `rgb(var(--c-surface) / 0.6)`.
 */
const token = name => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: token('base'),
        surface: token('surface'),
        raised: token('raised'),
        line: token('line'),

        text: token('text'),
        'text-soft': token('text-soft'),
        'text-faint': token('text-faint'),

        accent: token('accent'),
        'accent-deep': token('accent-deep'),
        'accent-tint': token('accent-tint'),

        warm: token('warm'),
        good: token('good'),
        alert: token('alert'),
      },
      fontFamily: {
        sans: ['"Nunito Sans"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xs: '8px',
        sm: '12px',
        DEFAULT: '16px',
        md: '20px',
        lg: '26px',
        xl: '34px',
        pill: '999px',
      },
      transitionTimingFunction: {
        /* One family for everything. A long, slow settle is what separates
           "animated" from "expensive"; mixing easings is what makes an
           interface feel like it is stuttering. */
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
        inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
        soft: 'cubic-bezier(0.34, 1.18, 0.64, 1)',
      },
      transitionDuration: {
        quick: '140ms',
        enter: '260ms',
        move: '420ms',
        scene: '620ms',
      },
    },
  },
  plugins: [],
};
