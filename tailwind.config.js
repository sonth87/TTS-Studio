/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0f0f1a',
          card:    '#1a1a2e',
          sidebar: '#12121e',
          border:  '#2a2a40',
          hover:   '#22223a',
        },
        accent: {
          DEFAULT: '#6366f1',
          hover:   '#4f46e5',
          soft:    '#6366f120',
        },
        success: '#10b981',
        warn:    '#f59e0b',
        error:   '#ef4444',
      },
    },
  },
  plugins: [],
};
