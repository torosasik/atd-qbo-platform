import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        atd: {
          blue: '#0462AC',
          'blue-light': '#2BA6DF',
          silver: '#B2B2B2',
          dark: '#333333',
        },
      },
    },
  },
  plugins: [forms],
};
