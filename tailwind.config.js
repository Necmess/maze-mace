/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'maze-bg': '#08080E',
        'maze-dark': '#1A1A2E',
        'maze-accent': '#C8432F',
        'maze-gold': '#C9A84C',
        'maze-silver': '#8A9BA8',
        'maze-cream': '#F5F3EE',
        'maze-text': '#F0EDE8',
      },
      fontFamily: {
        cinzel: ['Cinzel', 'serif'],
        outfit: ['Outfit', 'sans-serif'],
      },
      boxShadow: {
        'gold-glow': '0 0 15px rgba(201, 168, 76, 0.25)',
        'gold-glow-lg': '0 0 25px rgba(201, 168, 76, 0.45)',
        'red-glow': '0 0 15px rgba(200, 67, 47, 0.3)',
        'red-glow-lg': '0 0 25px rgba(200, 67, 47, 0.5)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        }
      }
    },
  },
  plugins: [],
}
