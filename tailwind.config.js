/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './App.{js,jsx,ts,tsx}',
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef9ff',
          100: '#d9f0ff',
          200: '#bce4ff',
          300: '#8ed3ff',
          400: '#59b8ff',
          500: '#2f97ff',
          600: '#1a78f5',
          700: '#155fdc',
          800: '#184fb1',
          900: '#1a448b',
          950: '#142c56',
        },
        surface: {
          light: '#ffffff',
          dark: '#0f172a',
        },
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
};
