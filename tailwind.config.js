/** @type {import('tailwindcss').Config} */
//
// Noctura Wallet · DS v0.2 + v0.2.1 tokens
// Source of truth: /home/user/Downloads/index.html (Phase 3 design)
// + /home/user/Downloads/screen.md (locked-in constraints)
//
// Architecture notes:
// - Color naming is unprefixed (e.g. `bg-base`, `text-fg-primary`) because tokens
//   are namespaced inside the tailwind theme object — no collision with defaults.
// - `accent-transparent` (violet) and `accent-shielded` (mint) are distinct tokens;
//   mode-aware components pick via useMode() hook (added in Phase A Task 3).
// - Font sizes use the [size, options] tuple form so lineHeight / fontWeight /
//   letterSpacing all travel together — single source of truth per type tier.
// - DS v0.2.1 additions (--dur-spin, --radius-icon-hero, --danger-on) are
//   integrated alongside v0.2 tokens; namespace is unified.
//
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // ── Background scale (OLED-optimized · DS v0.2 §1)
        'bg-base': '#0A0A0A',
        'bg-surface-1': '#0E0E10',
        'bg-surface-2': '#17171A',
        'bg-surface-3': '#212126',

        // ── Foreground scale (4-step contrast ladder)
        'fg-primary': '#F4F5F7',
        'fg-secondary': '#A8ACB5',
        'fg-tertiary': '#6E727A',
        'fg-disabled': '#3A3D44',

        // ── Mode accents (Solana violet + mint)
        // Components pick via useMode() hook. data-mode attribute drives the
        // cascade visually in the HTML mockup; in RN we resolve at component
        // level (see useMode + ModeContainer pattern, Phase A Task 3).
        'accent-transparent': '#B084FC',
        'accent-shielded': '#5BE3C2',
        'accent-transparent-tint': '#1B142C',
        'accent-shielded-tint': '#0E2620',

        // ── Status tokens
        'success': '#3FD68B',
        'warning': '#F2B53B',
        'danger': '#FF5C6A',
        'info': '#7DA8FF',
        'shield-300': '#A6F0DC',

        // ── DS v0.2.1 semantic contrast pair
        'danger-on': '#FFFFFF',
      },

      // ── Spacing scale · 4-based · 8 steps · DS v0.2 §3
      // Names map to --space-N tokens from index.html. Tailwind utility classes:
      // p-1 → 4px, p-2 → 8px, p-3 → 12px, p-4 → 16px, p-5 → 20px,
      // p-6 → 24px, p-7 → 32px, p-8 → 48px
      spacing: {
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '7': '32px',
        '8': '48px',
      },

      // ── Radii · DS v0.2 §4 + v0.2.1 icon-hero
      borderRadius: {
        'sm': '6px',
        'md': '10px',
        'lg': '14px',
        'xl': '20px',
        '2xl': '24px',
        'pill': '9999px',
        // DS v0.2.1 · between --radius-lg (14) and --radius-xl (20)
        // Used on icon-hero wrappers (#8 import, #9 unlock, #38 about, etc.)
        'icon-hero': '16px',
      },

      // ── Typography · DS v0.2 §2 + v0.2.1 h1-compact
      // Format: [fontSize, { lineHeight, fontWeight, letterSpacing? }]
      fontSize: {
        // Hero / display
        'display':       ['32px', {lineHeight: '38px', fontWeight: '600', letterSpacing: '-0.01em'}],
        // Headings
        'h1':            ['24px', {lineHeight: '30px', fontWeight: '600', letterSpacing: '-0.01em'}],
        'h1-compact':    ['17px', {lineHeight: '22px', fontWeight: '600', letterSpacing: '-0.01em'}], // DS v0.2.1
        'h2':            ['20px', {lineHeight: '26px', fontWeight: '600'}],
        'h3':            ['17px', {lineHeight: '22px', fontWeight: '600'}],
        // Body
        'body-lg':       ['17px', {lineHeight: '24px', fontWeight: '500'}],
        'body':          ['15px', {lineHeight: '22px', fontWeight: '400'}],
        'body-sm':       ['13px', {lineHeight: '18px', fontWeight: '400'}],
        'caption':       ['12px', {lineHeight: '16px', fontWeight: '400'}],
        'overline':      ['11px', {lineHeight: '14px', fontWeight: '600', letterSpacing: '0.08em'}],
        // Financial / balance tier · tabular-nums applied via .noc-numeral class
        'balance-xl':    ['44px', {lineHeight: '50px', fontWeight: '600', letterSpacing: '-0.02em'}],
        'balance-lg':    ['28px', {lineHeight: '34px', fontWeight: '600', letterSpacing: '-0.02em'}],
        'balance-md':    ['20px', {lineHeight: '26px', fontWeight: '600', letterSpacing: '-0.01em'}],
      },

      // ── Font families · DS v0.2 §2
      // Geist + Geist Mono installed in Phase A Task 2 (src/assets/fonts/)
      // Fallback chain ends in system fonts so app remains functional during
      // Task 2 setup before Geist files land.
      fontFamily: {
        'geist': ['Geist-Regular', 'System'],
        'geist-medium': ['Geist-Medium', 'System'],
        'geist-semibold': ['Geist-SemiBold', 'System'],
        'geist-bold': ['Geist-Bold', 'System'],
        'geist-mono': ['GeistMono-Regular', 'monospace'],
        'geist-mono-medium': ['GeistMono-Medium', 'monospace'],
      },

      // ── Motion · DS v0.2 §5 + v0.2.1 spin token
      transitionDuration: {
        'fast': '120ms',
        'base': '220ms',
        'slow': '360ms',
        'spin': '900ms', // DS v0.2.1
      },
      transitionTimingFunction: {
        'standard': 'cubic-bezier(0.2, 0, 0, 1)',
        'decelerate': 'cubic-bezier(0, 0, 0, 1)',
        'accelerate': 'cubic-bezier(0.3, 0, 1, 1)',
      },

      // ── Touch target sizes · DS v0.2 §6 (Android baseline 48 dp)
      // iOS variant pass (post-Phase-A) maps to 44 pt minimum.
      minWidth: {
        'touch-min': '48px',
        'touch-rec': '56px',
        'touch-lg': '64px',
      },
      minHeight: {
        'touch-min': '48px',
        'touch-rec': '56px',
        'touch-lg': '64px',
      },
    },
  },

  // NativeWind v4 plugin layer · semantic .noc-* classes via @apply
  // are defined in src/global.css (NOT here) so they participate in the
  // standard tailwind @layer components cascade.
  plugins: [],
};
