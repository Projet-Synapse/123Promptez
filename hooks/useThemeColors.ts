// Powered by OnSpace.AI
// useThemeColors — returns the current theme's color palette and forces re-render on theme change.
// Use this hook in any component that needs reactive colors (instead of static Colors import).
import { useTheme } from '@/contexts/ThemeContext';

export function useThemeColors() {
  const { colors } = useTheme();
  return colors;
}
