/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      animation: {
        'ambient-pulse': 'ambientPulse 15s ease-in-out infinite alternate',
      },
      keyframes: {
        ambientPulse: {
          '0%': { transform: 'scale(1) translate(0, 0)', opacity: '0.3' },
          '50%': { transform: 'scale(1.1) translate(2%, 2%)', opacity: '0.4' },
          '100%': { transform: 'scale(0.9) translate(-2%, -2%)', opacity: '0.3' },
        }
      },
      colors: {
        spotify: {
          green: '#1DB954',
          black: '#191414',
          dark: '#0a0a0a', /* Slightly darker for better ambient contrast */
          card: '#181818',
          hover: '#282828'
        }
      }
    },
  },
  plugins: [],
}
