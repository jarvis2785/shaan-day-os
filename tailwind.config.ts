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
        bg: '#080808',
        surface: '#111111',
        border: '#1E1E1E',
        accent: '#E8FF47',
        danger: '#FF4040',
        amber: '#FFB347',
        'text-primary': '#F0F0F0',
        'text-body': '#AFAFAF',
        'text-muted': '#555555',
        'fixed-block': '#1A1A1A',
        'mentor-surface': '#161616',
        'overflow-surface': '#1A0A0A',
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        card: '12px',
        btn: '8px',
        pill: '6px',
      },
      maxWidth: {
        app: '430px',
      },
      transitionDuration: {
        DEFAULT: '150ms',
      },
    },
  },
  plugins: [],
}
export default config
