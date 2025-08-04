/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        pink: {
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#fda4af',
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
        },
      },
      screens: {
        'xs': '475px',
      },
      animation: {
        'pulse': 'pulse 1.5s ease-in-out infinite',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      gap: {
        '18': '4.5rem',
      }
    },
  },
  plugins: [],
}
