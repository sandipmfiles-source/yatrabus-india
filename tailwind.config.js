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
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          300: '#86EFAC',
          400: '#4ADE80',
          500: '#22C55E',
          600: '#16A34A',
          700: '#15803D',
          800: '#166534',
          900: '#0E4D34',  // Primary Brand Deep Green
          950: '#072E20',
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
