/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/src/**/*.{ts,tsx}', './src/renderer/index.html'],
  theme: {
    extend: {
      colors: {
        // Mono Dark Theme — neutral grayscale, sem tinta de cor.
        // accent/quase-branco é o destaque; indigo/purple viraram cinzas de
        // hierarquia. green/amber/red continuam sendo cores de status.
        ag: {
          bg: '#0f0f0f',
          'bg-secondary': '#161616',
          'bg-card': '#1b1b1b',
          'bg-hover': '#232323',
          'bg-active': '#2b2b2b',
          border: '#292929',
          'border-light': '#3a3a3a',
          'border-focus': '#e5e5e5',
          text: '#f2f2f2',
          'text-secondary': '#a6a6a6',
          'text-muted': '#6f6f6f',
          accent: '#e5e5e5',
          'accent-hover': '#ffffff',
          'accent-glow': 'rgba(255, 255, 255, 0.10)',
          indigo: '#9e9e9e',
          green: '#10b981',
          amber: '#f59e0b',
          red: '#ef4444',
          purple: '#a1a1aa',
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
        glow: '0 0 20px rgba(255, 255, 255, 0.07)',
        'glow-sm': '0 0 10px rgba(255, 255, 255, 0.05)',
      },
    },
  },
  plugins: [],
};
