const { fontFamily } = require('tailwindcss/defaultTheme')

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter var"', ...fontFamily.sans]
      },
      colors: {
        surface: 'rgb(var(--color-surface-rgb) / <alpha-value>)',
        surfaceStrong: 'rgb(var(--color-surface-strong-rgb) / <alpha-value>)',
        accent: '#38bdf8',
        accentStrong: '#0ea5e9',
        warning: '#fbbf24',
        danger: '#f87171',
        success: '#34d399'
      },
      boxShadow: {
        soft: '0 24px 60px -28px rgba(15, 23, 42, 0.6)',
        glow: '0 0 0 1px rgba(148, 163, 184, 0.25), 0 12px 40px -20px rgba(59, 130, 246, 0.45)',
        inset: 'inset 0 1px 0 rgba(255, 255, 255, 0.08)'
      },
      borderRadius: {
        md: '16px',
        xl: '24px',
        '2xl': '32px'
      },
      backdropBlur: {
        xs: '6px'
      },
      keyframes: {
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' }
        }
      },
      animation: {
        pulseSoft: 'pulseSoft 2.6s ease-in-out infinite'
      }
    }
  },
  plugins: [require('@tailwindcss/typography')]
}
