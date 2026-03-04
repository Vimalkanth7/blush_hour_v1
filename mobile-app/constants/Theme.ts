/**
 * Blush Hour V1 Design System
 * 
 * Usage:
 * import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/Theme';
 * 
 * const styles = StyleSheet.create({
 *   container: {
 *     backgroundColor: COLORS.background,
 *     padding: SPACING.screen,
 *   },
 *   title: {
 *     ...TYPOGRAPHY.display,
 *     color: COLORS.primaryText,
 *   }
 * });
 */

export const COLORS = {
  // Brand Colors
  primary: '#FF6B9D', // Safety Amber
  brandBase: '#0F172A', // Midnight Blue

  // Functional Colors
  destructive: '#E11D48', // Blush Red
  success: '#10B981', // Success Green

  // App Colors (Light Mode)
  background: '#0D0A14',
  surface: '#1A1425',
  primaryText: '#F5F0FF',
  secondaryText: '#A89BC2',
  border: '#2D2440',
  disabled: '#2D2440',
  disabledText: '#5C5175',

  // Dark Mode (Future Ready - Placeholder)
  dark: {
    background: '#0D0A14',
    surface: '#1A1425',
    primaryText: '#F5F0FF',
    secondaryText: '#A89BC2',
  }
} as const;

export const TYPOGRAPHY = {
  fontFamily: 'Inter',

  // Scale
  display: {
    fontSize: 32,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
    lineHeight: 40,
  },
  h1: {
    fontSize: 24,
    fontWeight: '700' as const,
    lineHeight: 32,
  },
  h2: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 28,
  },
  bodyLarge: {
    fontSize: 18,
    fontWeight: '400' as const,
    lineHeight: 28,
  },
  bodyBase: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  caption: {
    fontSize: 13,
    fontWeight: '500' as const,
    lineHeight: 20,
  },
} as const;

export const SPACING = {
  // Base Unit: 4px
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16, // Card padding
  xl: 20, // Screen gutter
  xxl: 24,
  section: 32,
  display: 48,

  // Semantic Aliases
  screen: 20,
  card: 16,
  gutter: 16,
} as const;

export const RADIUS = {
  sm: 12,
  md: 16, // Inputs, Small Buttons
  lg: 24, // Cards
  xl: 32, // Bottom Sheets
  pill: 30, // Primary Buttons
  round: 9999, // Circles
} as const;

export const SHADOWS = {
  card: {
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8, // Android
  },
  small: {
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  }
} as const;

export const GRADIENTS = {
  primary: ['#FF6B9D', '#C44569'],
  background: ['#0D0A14', '#1A1025'],
  card: ['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.03)'],
  gold: ['#FFD700', '#FF8C00'],
  glow: ['rgba(255,107,157,0.3)', 'rgba(255,107,157,0)'],
} as const;

// Compatibility for existing template hooks
export const Colors = {
  light: {
    text: COLORS.primaryText,
    background: COLORS.background,
    tint: COLORS.primary,
    icon: COLORS.primaryText,
    tabIconDefault: COLORS.secondaryText,
    tabIconSelected: COLORS.primary,
  },
  dark: {
    text: COLORS.dark.primaryText,
    background: COLORS.dark.background,
    tint: COLORS.primary,
    icon: COLORS.dark.primaryText,
    tabIconDefault: COLORS.dark.secondaryText,
    tabIconSelected: COLORS.primary,
  },
};
