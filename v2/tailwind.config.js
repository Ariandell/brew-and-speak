/** Tokens come from docs/DESIGN.md. The palette the design tool emitted also
 *  carried a full Material set; only what the screens use is kept here. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0F1B33',
        'ink-soft': '#5A6782',
        paper: '#FFFDF8',
        surface: '#FFFFFF',
        line: '#E4EAF5',
        blue: '#2563EB',
        'blue-deep': '#1D4ED8',
        'blue-soft': '#EFF4FF',
        'blue-hot': '#1E5AFF',
        sun: '#FFB020',
        coral: '#FF6B5A',
        mint: '#14B88A',
        sand: '#FDF3E3',
      },
      fontFamily: {
        sans: ['"Nunito Sans"', 'system-ui', 'sans-serif'],
      },
      spacing: { xs: '4px', sm: '8px', md: '12px', lg: '16px', xl: '24px', xxl: '32px', huge: '48px' },
      borderRadius: { DEFAULT: '0.25rem', lg: '0.5rem', xl: '0.75rem', card: '20px', btn: '14px' },
      boxShadow: { card: '0 4px 20px rgba(15,27,51,0.06)' },
      transitionTimingFunction: { snappy: 'cubic-bezier(0.2, 0, 0, 1)' },
    },
  },
  plugins: [],
};
