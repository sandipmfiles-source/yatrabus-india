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
          50: '#F5F5F4',
          100: '#E7E5E4',
          200: '#D6D3D1',
          300: '#A8A29E',
          400: '#78716C',
          500: '#57534E',
          600: '#44403C',
          700: '#292524',
          800: '#1C1917',
          900: '#171717',  // Futuristic charcoal brand
          950: '#0A0A0A',
        },
        yatriwarm: {
          50: '#FCFCFA',  // Background Warm Off-White
          100: '#F7F7F3',
          200: '#EFEFEA',
          300: '#E4E4DC',
          400: '#D2D2C6',
          500: '#AFAFA0',
          600: '#7F7F72',
          700: '#5A5A4F',
          800: '#3D3D35',
          900: '#262621',
          950: '#161613',
        },
        signal: {
          yellow: { 50: '#FFFCEB', 100: '#FEF3C7', 200: '#FDE68A', 400: '#FACC15', 500: '#EAB308' },
          red: { 50: '#FEF2F2', 100: '#FEE2E2', 500: '#EF4444', 600: '#DC2626', 700: '#B91C1C' },
          charcoal: { 50: '#F5F5F4', 100: '#E7E5E4', 700: '#292524', 800: '#1C1917', 900: '#171717', 950: '#0A0A0A' },
        },
        transit: {
          live: '#059669',     // Confirmed live GPS
          estimate: '#0284C7', // Schedule/historical ETA
          stale: '#D97706',    // Older observation / pending
          disputed: '#DC2626', // Disputed / discontinued
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
