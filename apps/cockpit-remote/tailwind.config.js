/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: { DEFAULT: '#00E5FF' },
        magenta: { DEFAULT: '#FF00AA' },
        oled: { 0: '#000000', 50: '#050507', 100: '#0A0A0E', 200: '#12121A' },
      },
      fontFamily: {
        sans: ['Geist', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', '"JetBrains Mono"', 'monospace'],
        display: ['"Orbitron"', '"Geist Mono"', 'monospace'],
      },
    },
  },
};
