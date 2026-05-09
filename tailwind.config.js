export default {
  content: [
    './index.html',
    './index.tsx',
    './App.tsx',
    './components/**/*.{ts,tsx}',
    './contexts/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './pages/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
    './utils/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
        'student-body': ['var(--font-student-body)', 'monospace'],
        'student-label': ['var(--font-student-label)', 'monospace'],
        'bodoni-moda': ['var(--font-portal-title)', 'serif'],
        syne: ['Syne', 'sans-serif'],
        syncopate: ['Syncopate', 'sans-serif'],
        orbitron: ['Orbitron', 'sans-serif'],
        rajdhani: ['Rajdhani', 'sans-serif'],
        'archivo-black': ['"Archivo Black"', 'sans-serif'],
      },
      colors: {
        background: 'var(--color-background)',
        'card-bg': 'var(--color-card-bg)',
        'input-bg': 'var(--color-input-bg)',
        'text-base': 'var(--color-text-base)',
        'text-muted': 'var(--color-text-muted)',
        primary: 'rgb(var(--color-primary-rgb) / <alpha-value>)',
        secondary: 'rgb(var(--color-secondary-rgb) / <alpha-value>)',
      },
      boxShadow: {
        primary: '0 0 20px -5px rgb(var(--color-primary-rgb) / 0.2)',
        secondary: '0 0 20px -5px rgb(var(--color-secondary-rgb) / 0.2)',
      },
    },
  },
  plugins: [],
};
