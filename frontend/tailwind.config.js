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
        secondary: '#1a1a1a',
        accent: '#e5e5e5',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        background: '#0f0f0f',
        surface: '#1f1f1f',
        'surface-hover': '#2a2a2a',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}