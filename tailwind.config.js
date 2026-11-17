/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FFFDF2',
          100: '#FFF7D6',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FACC15',
          500: '#EAB308',
          600: '#DC2626',
          700: '#B91C1C',
          800: '#292524',
          900: '#171717',
          950: '#0A0A0A',
        },
        surface: {
          light: '#FFFEF8',
          warm: '#FFFEF8',
          card: '#ffffff',
          border: '#F1E3B5',
          subtle: '#FFF9E8',
        },
        live: {
          DEFAULT: '#10B981',
          light: '#D1FAE5',
          dark: '#065F46',
        },
        estimated: {
          DEFAULT: '#F59E0B',
          light: '#FEF3C7',
          dark: '#92400E',
        },
        warning: {
          DEFAULT: '#EF4444',
          light: '#FEE2E2',
          dark: '#991B1B',
        },
        verified: {
          DEFAULT: '#2563EB',
          light: '#DBEAFE',
          dark: '#1E40AF',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
