import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Base backgrounds
        background: {
          DEFAULT: '#0A0A0F',
          secondary: '#12121A',
          tertiary: '#1A1A24',
        },
        // Foreground/text colors
        foreground: {
          DEFAULT: '#FFFFFF',
          muted: '#A0A0B0',
          subtle: '#6B6B7B',
        },
        // Primary accent (Cyan)
        accent: {
          DEFAULT: '#00FFFF',
          50: '#E0FFFF',
          100: '#B3FFFF',
          200: '#80FFFF',
          300: '#4DFFFF',
          400: '#1AFFFF',
          500: '#00FFFF',
          600: '#00CCCC',
          700: '#009999',
          800: '#006666',
          900: '#003333',
        },
        // Secondary accent (Purple)
        purple: {
          DEFAULT: '#8B5CF6',
          50: '#F3F0FF',
          100: '#E9E3FF',
          200: '#D4C7FE',
          300: '#B69FFE',
          400: '#9F7AFA',
          500: '#8B5CF6',
          600: '#7C3AED',
          700: '#6D28D9',
          800: '#5B21B6',
          900: '#4C1D95',
        },
        // Status colors
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#3B82F6',
        // Chart colors
        chart: {
          1: '#00FFFF',
          2: '#8B5CF6',
          3: '#10B981',
          4: '#F59E0B',
          5: '#EF4444',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'monospace'],
      },
      fontSize: {
        display: ['3.75rem', { lineHeight: '1', fontWeight: '700' }],
        h1: ['2.25rem', { lineHeight: '1.2', fontWeight: '700' }],
        h2: ['1.875rem', { lineHeight: '1.3', fontWeight: '600' }],
        h3: ['1.5rem', { lineHeight: '1.4', fontWeight: '600' }],
        h4: ['1.25rem', { lineHeight: '1.4', fontWeight: '500' }],
        body: ['1rem', { lineHeight: '1.6' }],
        small: ['0.875rem', { lineHeight: '1.5' }],
        tiny: ['0.75rem', { lineHeight: '1.4' }],
      },
      boxShadow: {
        glow: '0 0 20px rgba(0, 255, 255, 0.3)',
        'glow-lg': '0 0 30px rgba(0, 255, 255, 0.5)',
        'glow-purple': '0 0 20px rgba(139, 92, 246, 0.3)',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'fade-in': 'fade-in 0.5s ease-out',
        'slide-up': 'slide-up 0.5s ease-out',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(0, 255, 255, 0)' },
          '50%': { boxShadow: '0 0 20px 2px rgba(0, 255, 255, 0.3)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};

export default config;
