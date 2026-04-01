/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50:  '#eef2f7',
          100: '#d5e0ed',
          200: '#a9c0db',
          300: '#7d9fc9',
          400: '#517fb7',
          500: '#2d5282',
          600: '#1e3a5f',  // principal
          700: '#162d4a',
          800: '#0f2035',
          900: '#081220',
        },
        gold: {
          50:  '#fefbea',
          100: '#fdf3c0',
          200: '#fae47a',
          300: '#f7d038',
          400: '#f0c040',  // principal claro
          500: '#d4a017',  // principal
          600: '#b8860b',
          700: '#9a6f09',
          800: '#7c5807',
          900: '#5e4205',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'gold': '0 2px 12px 0 rgba(212, 160, 23, 0.25)',
        'navy': '0 4px 20px 0 rgba(30, 58, 95, 0.15)',
      },
    },
  },
  plugins: [],
};
