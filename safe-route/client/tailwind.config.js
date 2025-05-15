/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          light: '#4da6ff',
          DEFAULT: '#0078ff',
          dark: '#0057b8',
        },
        secondary: {
          light: '#ffcc80',
          DEFAULT: '#ff9800',
          dark: '#e65100',
        },
        danger: '#dc3545',
        success: '#28a745',
        warning: '#ffc107',
      },
    },
  },
  plugins: [],
}
