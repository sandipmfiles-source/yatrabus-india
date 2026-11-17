/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./packages/shared/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        yatribrand: {
          50: '#FFFDF2',
          100: '#FFF7D6',
          200: '#FDE68A',
          300: '#FCD34D',
          400: '#FACC15',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
          800: '#292524',
          900: '#171717',
          950: '#0A0A0A',
        },
        yatriwarm: {
          50: '#FFFEF8',
          100: '#FFF9E8',
          200: '#F1E3B5',
          300: '#E8D9A7',
          400: '#D6C58D',
          500: '#A89A6C',
          600: '#766B4E',
          700: '#5A5140',
          800: '#3D3830',
          900: '#26231F',
          950: '#161513',
        },
        signal: {
          yellow: { 50: '#FFFDF2', 100: '#FFF7D6', 200: '#FDE68A', 400: '#FACC15', 500: '#EAB308' },
          red: { 50: '#FEF2F2', 100: '#FEE2E2', 500: '#EF4444', 600: '#DC2626', 700: '#B91C1C' },
          charcoal: { 50: '#F5F5F4', 100: '#E7E5E4', 700: '#292524', 800: '#1C1917', 900: '#171717', 950: '#0A0A0A' },
        },
        transit: {
          live: '#059669',
          estimate: '#0284C7',
          stale: '#D97706',
          disputed: '#DC2626',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'subtle': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.04), 0 2px 4px -2px rgba(0, 0, 0, 0.04)',
        'elevated': '0 10px 15px -3px rgba(0, 0, 0, 0.06), 0 4px 6px -4px rgba(0, 0, 0, 0.04)',
      }
    },
  },
  plugins: [],
}
