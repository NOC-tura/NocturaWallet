/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        'noc-base': '#0C0C14',
        'noc-surface': 'rgba(255,255,255,0.04)',
        'noc-elevated': 'rgba(255,255,255,0.07)',
        'noc-accent': '#6C47FF',
        'noc-accent-h': '#8B6AFF',
        'noc-accent-l': '#A78BFA',
        'noc-accent-p': '#4A2EC9',
        'noc-success': '#4ADE80',
        'noc-danger': '#F87171',
        'noc-warning': '#FBBF24',
        'noc-info': '#60A5FA',
        'noc-amoled': '#000000',
      },
      borderRadius: {
        'noc-sm': '8px',
        'noc-md': '12px',
        'noc-lg': '16px',
        'noc-xl': '20px',
        'noc-card': '22px',
        'noc-phone': '38px',
      },
      fontSize: {
        'noc-balance': ['34px', {lineHeight: '40px', letterSpacing: '-1.4px', fontWeight: '700'}],
        'noc-title': ['16px', {lineHeight: '20px', fontWeight: '700'}],
        'noc-label': ['13px', {lineHeight: '18px', fontWeight: '600'}],
        'noc-body': ['13px', {lineHeight: '21px', fontWeight: '400'}],
        'noc-caption': ['11px', {lineHeight: '17px', fontWeight: '500'}],
        'noc-tiny': ['10px', {lineHeight: '14px', fontWeight: '600'}],
      },
      spacing: {
        'noc-xs': '4px',
        'noc-sm': '8px',
        'noc-md': '12px',
        'noc-lg': '16px',
        'noc-xl': '20px',
        'noc-2xl': '24px',
        'noc-3xl': '32px',
      },
    },
  },
  plugins: [],
};
