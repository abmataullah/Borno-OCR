/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        app: {
          bg: '#0a0a0a',
          panel: '#18181b',
          elevated: '#27272a',
          border: '#3f3f46',
          hover: '#343439',
          active: '#2d2d30',
          canvas: '#1e1e21',
        },
        gold: {
          DEFAULT: '#d4af37',
          hover: '#e6c659',
          active: '#b8941f',
          muted: 'rgba(212, 175, 55, 0.15)',
        },
        text: {
          primary: '#fafafa',
          secondary: '#a1a1aa',
          tertiary: '#71717a',
          'on-gold': '#0a0a0a',
        },
        status: {
          success: '#10b981',
          danger: '#ef4444',
          warning: '#f59e0b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        noto: ['Noto Sans', 'Noto Sans Bengali', 'serif'],
        'noto-serif': ['Noto Serif', 'Noto Serif Bengali', 'serif'],
        'siyam-rupali': ['Siyam Rupali', 'sans-serif'],
        kalpurush: ['Kalpurush', 'serif'],
        'solaiman-lipi': ['SolaimanLipi', 'sans-serif'],
        bengali: ['Noto Sans Bengali', 'Siyam Rupali', 'Kalpurush', 'SolaimanLipi', 'sans-serif'],
      },
      spacing: {
        '15': '3.75rem',
        '18': '4.5rem',
        '88': '22rem',
      },
      borderRadius: {
        '4': '4px',
        '8': '8px',
        '12': '12px',
        '16': '16px',
        '24': '24px',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(circle at center, var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gold-shine': 'linear-gradient(135deg, #d4af37 0%, #f4d77a 50%, #d4af37 100%)',
        'gold-dark': 'linear-gradient(135deg, #b8941f 0%, #d4af37 100%)',
        'hero-glow': 'radial-gradient(60% 60% at 50% 40%, rgba(212,175,55,0.18) 0%, rgba(212,175,55,0.04) 50%, transparent 100%)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'float-slow': 'float 8s ease-in-out infinite',
        'spin-slow': 'spin 20s linear infinite',
        'pulse-glow': 'pulseGlow 3s ease-in-out infinite',
        'shimmer': 'shimmer 3s linear infinite',
        'gradient-x': 'gradientX 6s ease infinite',
        'fade-up': 'fadeUp 0.6s ease-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
          '50%': { transform: 'translateY(-20px) rotate(2deg)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(212, 175, 55, 0.3)' },
          '50%': { boxShadow: '0 0 60px rgba(212, 175, 55, 0.6)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        gradientX: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      boxShadow: {
        'gold-glow': '0 0 40px rgba(212, 175, 55, 0.4)',
        'gold-glow-lg': '0 0 80px rgba(212, 175, 55, 0.5)',
        'inner-glow': 'inset 0 0 20px rgba(212, 175, 55, 0.2)',
      },
    },
  },
  plugins: [],
};
