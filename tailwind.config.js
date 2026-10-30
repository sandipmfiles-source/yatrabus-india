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
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#F97316',
          600: '#E85D04',
          700: '#C2410C',
          800: '#B91C1C',
          900: '#991B1B',
          950: '#450A0A',
        },
        yatriwarm: {
          50: '#FFFBF7',
          100: '#FFF7ED',
          200: '#FDEBD8',
          300: '#F5DCC3',
          400: '#DCC3A8',
          500: '#B99C80',
          600: '#8C725C',
          700: '#66503F',
          800: '#49382D',
          900: '#30241D',
          950: '#1C130F',
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
        'elevated': '0 10px 15px -3px rgba(0, 0, 0, 0.06), 0 4px 6px -4px rgba(0, 0, 0, 0.06)',
      }
    },
  },
  plugins: [],
}
