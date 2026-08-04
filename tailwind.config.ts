import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#111111',
        surface: '#1C1C1E',
        'surface-raised': '#242424',
        border: '#2C2C2E',
        'fixed-block': '#3A3A3C',
        'text-primary': '#FFFFFF',
        'text-secondary': '#8E8E93',
        'text-muted': '#48484A',
        'load-green': '#30D158',
        'load-yellow': '#FFD60A',
        'load-red': '#FF453A',
      },
      fontFamily: {
        display: ['system-ui', '-apple-system', 'SF Pro Display', 'sans-serif'],
        body: ['system-ui', '-apple-system', 'SF Pro Text', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        card: '14px',
        btn: '10px',
        pill: '100px',
      },
      maxWidth: {
        app: '430px',
      },
    },
  },
  plugins: [],
}
export default config
