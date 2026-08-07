/** Tokens come from docs/DESIGN.md.
 *
 *  The style is "soft dimensional": everything in the app is made of the same
 *  matte material as the mascot. That means no skew, no outlines, no hard
 *  offset shadows - depth comes from radius, layered shadow and light. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0F1B33',
        'ink-soft': '#5A6782',
        'ink-faint': '#94A0B8',
        paper: '#FFFDF8',
        surface: '#FFFFFF',
        line: '#E8EDF7',

        /* One accent, several lightnesses. A soft material needs a family to
           show depth - a single flat blue can only ever look like paint. */
        blue: '#2563EB',
        'blue-deep': '#1D4ED8',
        'blue-tint': '#DCE7FF',
        'blue-soft': '#EFF4FF',

        sun: '#FFB020',
        coral: '#FF6B5A',
        mint: '#14B88A',
        sand: '#FDF3E3',
      },
      fontFamily: {
        sans: ['"Nunito Sans"', 'system-ui', 'sans-serif'],
      },
      spacing: { xs: '4px', sm: '8px', md: '12px', lg: '16px', xl: '24px', xxl: '32px', huge: '48px' },
      borderRadius: { sm: '10px', DEFAULT: '14px', md: '18px', lg: '24px', xl: '32px', pill: '999px' },
      boxShadow: {
        /* Two layers, always: a tight contact shadow plus a wide ambient one.
           A single blurred shadow reads as a sticker floating over the page;
           the pair reads as an object resting on a surface, which is the
           entire point of this style. */
        'soft-1': '0 1px 2px rgba(15,27,51,0.04), 0 2px 6px rgba(15,27,51,0.04)',
        'soft-2': '0 2px 4px rgba(15,27,51,0.04), 0 8px 20px rgba(15,27,51,0.07)',
        'soft-3': '0 4px 8px rgba(15,27,51,0.05), 0 18px 44px rgba(15,27,51,0.11)',

        /* An accent surface casts an accent-coloured shadow. Black under a
           saturated colour reads as dirt, not as depth. */
        accent: '0 4px 8px rgba(37,99,235,0.20), 0 12px 28px rgba(37,99,235,0.28)',
        'accent-press': '0 1px 2px rgba(37,99,235,0.24), 0 3px 8px rgba(37,99,235,0.20)',
      },
      transitionTimingFunction: {
        snappy: 'cubic-bezier(0.2, 0, 0, 1)',
        /* Soft things overshoot a little as they settle. */
        soft: 'cubic-bezier(0.34, 1.28, 0.64, 1)',
      },
    },
  },
  plugins: [],
};
