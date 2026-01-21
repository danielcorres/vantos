/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#f5f5f5',
        },
        surface: {
          DEFAULT: '#ffffff',
        },
        text: {
          DEFAULT: '#1a1a1a',
        },
        muted: {
          DEFAULT: '#666666',
        },
        border: {
          DEFAULT: '#e0e0e0',
        },
        primary: {
          DEFAULT: '#1a1a1a',
        },
        danger: {
          DEFAULT: '#c33',
        },
        warning: {
          DEFAULT: '#c90',
        },
        success: {
          DEFAULT: '#3c3',
        },
      },
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '12px',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      },
      container: {
        center: true,
        padding: {
          DEFAULT: '16px',
          sm: '16px',
          lg: '24px',
        },
        screens: {
          sm: '640px',
          md: '768px',
          lg: '1024px',
          xl: '1200px',
        },
      },
    },
  },
  plugins: [],
}

