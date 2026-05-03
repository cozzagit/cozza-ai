/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: { DEFAULT: '#00E5FF', glow: 'rgba(0, 229, 255, 0.5)' },
        magenta: { DEFAULT: '#FF00AA', glow: 'rgba(255, 0, 170, 0.5)' },
        amber: { DEFAULT: '#FFB300' },
        oled: {
          0: '#000000',
          50: '#050507',
          100: '#0A0A0E',
          200: '#12121A',
        },
      },
      fontFamily: {
        sans: ['Geist', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', '"JetBrains Mono"', 'monospace'],
        display: ['"Orbitron"', '"Geist Mono"', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scanline': 'scanline 8s linear infinite',
        'glitch': 'glitch 0.4s ease-in-out',
      },
      keyframes: {
        scanline: { '0%': { transform: 'translateY(-100%)' }, '100%': { transform: 'translateY(100%)' } },
        glitch: {
          '0%,100%': { transform: 'translate(0)' },
          '20%': { transform: 'translate(-1px, 1px)' },
          '40%': { transform: 'translate(1px, -1px)' },
          '60%': { transform: 'translate(-1px, -1px)' },
          '80%': { transform: 'translate(1px, 1px)' },
        },
      },
    },
  },
};
