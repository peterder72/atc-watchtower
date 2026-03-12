const defaultTheme = require('tailwindcss/defaultTheme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      backgroundImage: {
        'watchtower-glow':
          'radial-gradient(circle at top right, rgba(255, 133, 70, 0.22), transparent 28%), radial-gradient(circle at top left, rgba(88, 196, 187, 0.14), transparent 34%), linear-gradient(180deg, #10222a 0%, #091118 100%)'
      },
      boxShadow: {
        floor: '0 0 0 1px rgba(99, 212, 199, 0.14), 0 18px 50px rgba(99, 212, 199, 0.16)',
        panel: '0 22px 60px rgba(3, 8, 12, 0.28)'
      },
      colors: {
        accent: '#ff8a4c',
        canvas: '#091118',
        danger: '#ff7f73',
        ink: '#f7efe5',
        success: '#6ce5b1',
        teal: '#63d4c7'
      },
      fontFamily: {
        sans: ['"Avenir Next"', '"Segoe UI"', ...defaultTheme.fontFamily.sans]
      }
    }
  },
  plugins: []
};
