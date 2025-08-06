/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#6B7A5E', // sage-500
        secondary: '#8B9A7B', // sage-400
        background: '#F7F8F6', // sage-50
        accent: '#FEFCF8', // cream-50
        text: '#2C3E36', // charcoal
        light: '#F0F4F8', // light background
        modalBg: '#E2E8F0', // darker background for modal
      },
    },
  },
  plugins: [],
}
