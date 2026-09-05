// Icon-only toolbar/nav button with hover/long-press tooltip + a11y label.
import React from 'react';
import {
  Pressable, Platform,
  type StyleProp, type ViewStyle,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Radius } from '@/constants/theme';
import { Tooltip, type TooltipPlacement } from './Tooltip';

export type IconButtonProps = {
  /** MaterialIcons glyph name */
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  /** Visible tooltip + accessibility label (French in callers) */
  label: string;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  size?: number;
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  /** Outer box size (default 36) */
  boxSize?: number;
  placement?: TooltipPlacement;
  style?: StyleProp<ViewStyle>;
  hitSlop?: number;
  /** Skip bordered box — just the icon (still gets tooltip) */
  bare?: boolean;
  testID?: string;
};

export function IconButton({
  icon,
  label,
  onPress,
  onLongPress,
  disabled,
  size = 20,
  color,
  backgroundColor,
  borderColor,
  boxSize = 36,
  placement = 'below',
  style,
  hitSlop = 8,
  bare = false,
  testID,
}: IconButtonProps) {
  const C = useThemeColors();
  const iconColor = color ?? C.textSecondary;
  const bg = backgroundColor ?? (bare ? 'transparent' : C.bgCard);
  const bd = borderColor ?? (bare ? 'transparent' : C.border);

  return (
    <Tooltip label={label} placement={placement} disabled={disabled}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={disabled}
        hitSlop={hitSlop}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={Platform.OS === 'web' ? undefined : 'Appui long pour le libellé'}
        accessibilityState={{ disabled: !!disabled }}
        testID={testID}
        // @ts-expect-error web title attribute
        title={Platform.OS === 'web' ? label : undefined}
        style={({ pressed }) => [
          bare
            ? { padding: 4, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }
            : {
                width: boxSize,
                height: boxSize,
                borderRadius: Radius.sm,
                backgroundColor: bg,
                borderWidth: 1,
                borderColor: bd,
                alignItems: 'center' as const,
                justifyContent: 'center' as const,
                opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
              },
          style,
        ]}
      >
        <MaterialIcons name={icon} size={size} color={iconColor} />
      </Pressable>
    </Tooltip>
  );
}
