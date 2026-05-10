/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bgDeep: '#0B0F1A',
        surface: 'rgba(255,255,255,0.08)',
        primary: '#5B8CFF',
        primaryHover: '#7AA2FF',
        textPrimary: '#F8FAFC',
        textSecondary: '#CBD5E1',
        textMuted: '#64748B',
        borderGlass: 'rgba(255,255,255,0.18)',
        inputGlass: 'rgba(255,255,255,0.06)'
      }
    },
  },
  plugins: [],
}
