// Reusable hover / long-press tooltip bubble (FR labels via callers).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Platform,
  type StyleProp, type ViewStyle,
} from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { FontSize, Radius, Spacing } from '@/constants/theme';

export type TooltipPlacement = 'below' | 'above' | 'near';

type TooltipProps = {
  label: string;
  children: React.ReactElement;
  placement?: TooltipPlacement;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Controlled visibility (optional). When omitted, hover/long-press manages it. */
  visible?: boolean;
  onVisibleChange?: (v: boolean) => void;
  longPressDelayMs?: number;
};

/**
 * Shows a small bubble with `label` on hover (web/desktop) or when the child
 * triggers long-press. Does NOT nest Pressables — clones the child to add
 * onLongPress / onPressOut for touch fallbacks.
 * Always set accessibilityLabel on the interactive child.
 */
export function Tooltip({
  label,
  children,
  placement = 'below',
  disabled,
  style,
  visible: controlledVisible,
  onVisibleChange,
  longPressDelayMs = 450,
}: TooltipProps) {
  const C = useThemeColors();
  const [internalVisible, setInternalVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isWeb = Platform.OS === 'web';
  const isControlled = controlledVisible !== undefined;
  const visible = isControlled ? controlledVisible : internalVisible;

  const clearHide = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const setVisible = useCallback((v: boolean) => {
    if (disabled || !label) return;
    if (!isControlled) setInternalVisible(v);
    onVisibleChange?.(v);
  }, [disabled, label, isControlled, onVisibleChange]);

  const show = useCallback(() => {
    clearHide();
    setVisible(true);
  }, [setVisible]);

  const hide = useCallback(() => {
    clearHide();
    hideTimer.current = setTimeout(() => setVisible(false), 80);
  }, [setVisible]);

  useEffect(() => () => clearHide(), []);

  const placementStyle =
    placement === 'above'
      ? { bottom: '100%' as const, marginBottom: 6 }
      : { top: '100%' as const, marginTop: 6 };

  const child = React.cloneElement(children, {
    ...(isWeb
      ? {}
      : {
          onLongPress: (e: unknown) => {
            show();
            const orig = (children.props as { onLongPress?: (ev: unknown) => void }).onLongPress;
            orig?.(e);
          },
          delayLongPress: longPressDelayMs,
          onPressOut: (e: unknown) => {
            hide();
            const orig = (children.props as { onPressOut?: (ev: unknown) => void }).onPressOut;
            orig?.(e);
          },
        }),
  } as Partial<typeof children.props>);

  return (
    <View
      style={[{ position: 'relative', alignItems: 'center' }, style]}
      // @ts-expect-error web-only hover handlers
      onMouseEnter={isWeb ? show : undefined}
      onMouseLeave={isWeb ? hide : undefined}
    >
      {child}

      {visible && label ? (
        <View
          pointerEvents="none"
          style={[
            styles.bubble,
            placementStyle,
            { backgroundColor: C.bgCardAlt, borderColor: C.border },
          ]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text style={[styles.text, { color: C.textPrimary }]} numberOfLines={2}>
            {label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Native title/hint fallback when a one-off Pressable is not wrapped in IconButton. */
export function withNativeTitle(
  props: Record<string, unknown>,
  label: string,
): Record<string, unknown> {
  if (Platform.OS === 'web' && label) {
    return { ...props, title: label, accessibilityHint: label };
  }
  return { ...props, accessibilityHint: label };
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    zIndex: 1000,
    maxWidth: 200,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.sm,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  text: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    textAlign: 'center',
  },
});
