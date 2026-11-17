/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        yatribrand: { 50:'#FFFDF2',100:'#FFF7D6',200:'#FDE68A',300:'#FCD34D',400:'#FACC15',500:'#EF4444',600:'#DC2626',700:'#B91C1C',800:'#292524',900:'#171717',950:'#0A0A0A' },
        yatriwarm: { 50:'#FFFEF8',100:'#FFF9E8',200:'#F1E3B5',300:'#E8D9A7',400:'#D6C58D',500:'#A89A6C',600:'#766B4E',700:'#5A5140',800:'#3D3830',900:'#26231F',950:'#161513' },
        signal: { yellow:{50:'#FFFDF2',100:'#FFF7D6',200:'#FDE68A',400:'#FACC15',500:'#EAB308'}, red:{50:'#FEF2F2',100:'#FEE2E2',500:'#EF4444',600:'#DC2626',700:'#B91C1C'}, charcoal:{50:'#F5F5F4',100:'#E7E5E4',700:'#292524',800:'#1C1917',900:'#171717',950:'#0A0A0A'} },
        transit: { live:'#059669',estimate:'#0284C7',stale:'#D97706',disputed:'#DC2626' },
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#0e5a36',
          950: '#07361f',
        },
        surface: {
          light: '#fbfdfa',
          warm: '#f3f6f3',
          card: '#ffffff',
          border: '#e2e8e0',
          subtle: '#eaf0ea',
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
