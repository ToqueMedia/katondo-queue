// Chakra UI v3 system — Clínica Katondo brand tokens

import { createSystem, defineConfig, defaultConfig } from '@chakra-ui/react';

const config = defineConfig({
  theme: {
    semanticTokens: {
      colors: {
        'chakra-body-text': { value: '{colors.ink}' },
        'chakra-body-bg': { value: '{colors.surface}' },
      },
    },
    tokens: {
      fonts: {
        heading: { value: "'DM Serif Display', Georgia, serif" },
        body: { value: "'Geist', system-ui, sans-serif" },
        mono: { value: "'Geist Mono', 'JetBrains Mono', monospace" },
      },
      colors: {
        brand: {
          50: { value: '#E0F2F1' },
          100: { value: '#B2DFDB' },
          200: { value: '#80CBC4' },
          300: { value: '#4DB6AC' },
          400: { value: '#26A69A' },
          500: { value: '#009688' }, // Pantone Water / Medical Teal
          600: { value: '#00897B' },
          700: { value: '#004D40' },
          800: { value: '#0A192F' }, // Dark Navy for Sidebar
          900: { value: '#050E1A' },
        },
        emerald: {
          50: { value: '#ECFDF5' },
          100: { value: '#D1FAE5' },
          200: { value: '#A7F3D0' },
          300: { value: '#6EE7B7' },
          400: { value: '#34D399' },
          500: { value: '#059669' },
          600: { value: '#047857' },
          700: { value: '#065F46' },
          800: { value: '#064E3B' },
          900: { value: '#022C22' },
        },
        surface: {
          DEFAULT: { value: '#FAFAF9' },
          elevated: { value: '#FFFFFF' },
          muted: { value: '#F5F5F4' },
        },
        ink: {
          DEFAULT: { value: '#0A192F' },
          muted: { value: '#64748B' },
          faint: { value: '#94A3B8' },
        },
      },
      radii: {
        card: { value: '16px' },
        button: { value: '10px' },
        input: { value: '10px' },
        pill: { value: '9999px' },
      },
      shadows: {
        card: { value: '0 1px 3px rgba(10,25,47,0.08), 0 4px 12px rgba(10,25,47,0.05)' },
        cardHover: { value: '0 4px 12px rgba(10,25,47,0.12), 0 12px 24px rgba(10,25,47,0.08)' },
        elevated: { value: '0 8px 32px rgba(10,25,47,0.12)' },
        glow: { value: '0 0 40px rgba(5,150,105,0.20)' },
      },
      spacing: {
        section: { value: '40px' },
        card: { value: '24px' },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);

