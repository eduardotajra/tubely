/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'red-base': '#EF4444',
        'red-dark': '#DC2626',
        'gray-100': '#F9FAFB',
        'gray-200': '#F3F4F6',
        'gray-300': '#E5E7EB',
        'gray-400': '#D1D5DB',
        'gray-500': '#6B7280',
        'gray-600': '#4B5563',
        'gray-700': '#374151',
        'gray-800': '#1F2937',
        'gray-900': '#111827',
        'green-500': '#22C55E',
        'yellow-500': '#EAB308',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
