import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Lockr Brand Colors (matching the logo)
        lockr: {
          navy: '#0F172A',      // Primary navy (from logo)
          blue: '#1E3A8A',      // Secondary blue
          cyan: '#06B6D4',      // Accent cyan (keyhole color)
          'cyan-light': '#67E8F9', // Light cyan for highlights
        },
        // Security-focused color system
        primary: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          500: '#0F172A',       // Main brand navy
          600: '#0C1220',
          700: '#0A0F1A',
          900: '#020617',
        },
        secondary: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          500: '#3B82F6',       // Trust blue
          600: '#2563EB',
        },
        accent: {
          50: '#ECFEFF',
          100: '#CFFAFE',
          500: '#06B6D4',       // Brand cyan
          600: '#0891B2',
        },
        success: {
          50: '#ECFDF5',
          500: '#10B981',       // Success green
          600: '#059669',
        },
        warning: {
          50: '#FFFBEB',
          500: '#F59E0B',       // Warning amber
          600: '#D97706',
        },
        error: {
          50: '#FEF2F2',
          500: '#EF4444',       // Error red
          600: '#DC2626',
        },
        // Surface colors for cards/backgrounds
        surface: {
          light: '#FFFFFF',
          'light-alt': '#F8FAFC',
          dark: '#1F2937',
          'dark-alt': '#111827',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['SF Mono', 'Monaco', 'monospace'],
      },
      boxShadow: {
        'lockr': '0 4px 6px -1px rgba(15, 23, 42, 0.1), 0 2px 4px -1px rgba(15, 23, 42, 0.06)',
        'lockr-lg': '0 10px 15px -3px rgba(15, 23, 42, 0.1), 0 4px 6px -2px rgba(15, 23, 42, 0.05)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-security': 'pulseSecure 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseSecure: {
          '0%, 100%': { 
            boxShadow: '0 0 0 0 rgba(6, 182, 212, 0.4)' 
          },
          '50%': { 
            boxShadow: '0 0 0 8px rgba(6, 182, 212, 0)' 
          },
        },
      },
    },
  },
  plugins: [],
};

export default config; 