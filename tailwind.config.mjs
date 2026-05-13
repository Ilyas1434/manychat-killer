/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg:         '#080808',
        sidebar:    '#000000',
        surface:    '#111111',
        raised:     '#191919',
        border:     '#252525',
        'border-hi':'#333333',
        ink:        '#f5f5f5',
        prose:      '#a8a8a8',
        note:       '#5a5a5a',
        green:      '#22c55e',
        'green-lo': '#0c2016',
        'green-mid':'#166534',
        amber:      '#f59e0b',
        danger:     '#ef4444',
        blue:       '#60a5fa',
      },
      fontFamily: {
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
        sans: ['var(--font-sans)', '-apple-system', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
      },
    },
  },
  plugins: [],
}
