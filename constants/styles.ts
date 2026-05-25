// Powered by OnSpace.AI
import { StyleSheet } from 'react-native';
import { Colors, Radius, Spacing } from './theme';

export const globalStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  cardAlt: {
    backgroundColor: Colors.bgCardAlt,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderAccent,
    padding: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
  },
});
