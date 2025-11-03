/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9f7',
          100: '#ccf2e8',
          200: '#99e5d1',
          300: '#66d8ba',
          400: '#33cba3',
          500: '#00674F',
          600: '#00523f',
          700: '#003d2f',
          800: '#00291f',
          900: '#00140f',
        },
      },
    },
  },
  plugins: [],
}