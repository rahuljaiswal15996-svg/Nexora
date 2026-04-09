/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./styles/**/*.css",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0055cc',
        secondary: '#0f172a',
        accent: '#475569',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        background: '#f4efe4',
        surface: '#ffffff',
        'surface-hover': '#f8fafc',
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}