/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // High-end premium dark mode colors
        jarvis: {
          dark: '#030712',      // Rich obsidian black
          card: '#0f172a',      // Slate-900 card
          border: '#1e293b',    // Slate-800 border
          cyan: '#06b6d4',      // Neon cyan
          violet: '#8b5cf6',    // Neon purple/violet
          emerald: '#10b981',   // Neon green
          amber: '#f59e0b',     // Warn amber
        }
      },
      animation: {
        'float-slow': 'float 6s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'wave-slow': 'wave 8s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.4', filter: 'brightness(1)' },
          '50%': { opacity: '0.9', filter: 'brightness(1.5)' },
        },
        wave: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        }
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'neon-cyan': '0 0 15px rgba(6, 182, 212, 0.4)',
        'neon-violet': '0 0 15px rgba(139, 92, 246, 0.4)',
      }
    },
  },
  plugins: [],
}
