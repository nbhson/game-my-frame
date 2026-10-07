/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
        sans: ['"Be Vietnam Pro"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        pixel: '4px 4px 0 #2b2117',
        'pixel-sm': '2px 2px 0 #2b2117',
      },
    },
  },
  plugins: [],
};
