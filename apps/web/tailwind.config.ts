import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        oled: {
          DEFAULT: '#000000',
          50: '#1A1A1A',
          100: '#141414',
          200: '#0F0F0F',
          300: '#0A0A0A',
          400: '#050505',
          500: '#000000',
        },
        accent: {
          DEFAULT: '#00E5FF',
          subtle: '#00B8D4',
          glow: '#26C6DA',
        },
        muted: {
          DEFAULT: '#737373',
          fg: '#A3A3A3',
        },
      },
      fontFamily: {
        sans: [
          'Geist',
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif',
        ],
        mono: ['Geist Mono', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // Glasses-first: bump base size up
        base: ['1.125rem', { lineHeight: '1.75rem' }], // 18px
        lg: ['1.25rem', { lineHeight: '1.875rem' }],   // 20px
        xl: ['1.5rem', { lineHeight: '2rem' }],        // 24px
      },
      spacing: {
        'safe-x': 'max(env(safe-area-inset-left), env(safe-area-inset-right))',
        'safe-y': 'max(env(safe-area-inset-top), env(safe-area-inset-bottom))',
      },
      maxWidth: {
        // Sweet spot 70% del FOV centrale
        'sweet': '70vw',
        'sweet-lg': '900px',
      },
      animation: {
        'pulse-glow': 'pulse-glow 1.4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fade-in 200ms ease-out',
        'slide-up': 'slide-up 240ms ease-out',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(0, 229, 255, 0.6)' },
          '50%': { boxShadow: '0 0 24px 8px rgba(0, 229, 255, 0.3)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
