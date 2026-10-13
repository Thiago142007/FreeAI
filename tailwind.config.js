/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/src/**/*.{ts,tsx}', './src/renderer/index.html'],
  theme: {
    extend: {
      colors: {
        // Antigravity Dark Theme — exact palette
        ag: {
          bg: '#0e1015',
          'bg-secondary': '#14171f',
          'bg-card': '#1a1d26',
          'bg-hover': '#1e222d',
          'bg-active': '#252a37',
          border: '#262a36',
          'border-light': '#2f3445',
          'border-focus': '#3b82f6',
          text: '#e4e4e7',
          'text-secondary': '#a1a1aa',
          'text-muted': '#71717a',
          accent: '#3b82f6',
          'accent-hover': '#2563eb',
          'accent-glow': 'rgba(59, 130, 246, 0.15)',
          indigo: '#818cf8',
          green: '#10b981',
          amber: '#f59e0b',
          red: '#ef4444',
          purple: '#a855f7',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Noto Sans', 'sans-serif'],
        mono: ['DejaVu Sans Mono', 'Liberation Mono', 'Noto Sans Mono', 'JetBrains Mono', 'monospace'],
      },
      fontSize: {
        '2xs': '0.625rem',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
        'slide-in-right': 'slideInRight 0.2s ease-out',
        'dot-pulse': 'dotPulse 1.4s infinite ease-in-out both',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        dotPulse: {
          '0%, 80%, 100%': { transform: 'scale(0)' },
          '40%': { transform: 'scale(1)' },
        },
      },
      boxShadow: {
        'glow-blue': '0 0 20px rgba(59, 130, 246, 0.15)',
        'glow-sm': '0 0 10px rgba(59, 130, 246, 0.1)',
      },
    },
  },
  plugins: [],
};
