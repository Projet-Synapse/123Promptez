// Toast/snackbar — non-blocking feedback; reserve modal alerts for destructive confirms.
import React, { createContext, useCallback, useContext, useMemo, useRef, useState, ReactNode } from 'react';
import { Pressable, Text, View, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radius, Spacing, FontSize } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useThemeColors';

export type ToastTone = 'info' | 'success' | 'error' | 'warning';

export interface ToastOptions {
  message: string;
  tone?: ToastTone;
  durationMs?: number;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastItem extends Required<Pick<ToastOptions, 'message' | 'tone' | 'durationMs'>> {
  id: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastContextType {
  showToast: (message: string, opts?: Omit<ToastOptions, 'message'>) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const TONE_ICON: Record<ToastTone, keyof typeof MaterialIcons.glyphMap> = {
  info: 'info-outline',
  success: 'check-circle',
  error: 'error-outline',
  warning: 'warning-amber',
};

function ToastHost({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  const C = useThemeColors();
  const insets = useSafeAreaInsets();
  if (toasts.length === 0) return null;

  const toneColor = (tone: ToastTone) => {
    if (tone === 'success') return C.accent;
    if (tone === 'error') return C.error;
    if (tone === 'warning') return C.warning;
    return C.primary;
  };

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        elevation: 9999,
        alignItems: 'center',
        paddingBottom: Math.max(insets.bottom, 12) + (Platform.OS === 'web' ? 12 : 8),
        paddingHorizontal: Spacing.md,
        gap: Spacing.xs,
      }}
    >
      {toasts.slice(-3).map(t => (
        <View
          key={t.id}
          style={{
            maxWidth: 520,
            width: '100%',
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.sm,
            backgroundColor: C.bgCard,
            borderRadius: Radius.md,
            borderWidth: 1,
            borderColor: toneColor(t.tone) + '55',
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm + 2,
            ...Platform.select({
              web: { boxShadow: '0 8px 24px rgba(0,0,0,0.35)' } as any,
              default: {
                shadowColor: '#000',
                shadowOpacity: 0.25,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 4 },
                elevation: 8,
              },
            }),
          }}
        >
          <MaterialIcons name={TONE_ICON[t.tone]} size={18} color={toneColor(t.tone)} />
          <Text style={{ flex: 1, fontSize: FontSize.sm, color: C.textPrimary, lineHeight: 18 }}>{t.message}</Text>
          {t.actionLabel && t.onAction ? (
            <Pressable
              onPress={() => { t.onAction?.(); onDismiss(t.id); }}
              hitSlop={8}
              style={({ pressed }) => [{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.sm, backgroundColor: toneColor(t.tone) + '22' }, pressed && { opacity: 0.75 }]}
            >
              <Text style={{ fontSize: FontSize.xs, color: toneColor(t.tone), fontWeight: '700' }}>{t.actionLabel}</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => onDismiss(t.id)} hitSlop={10}>
            <MaterialIcons name="close" size={16} color={C.textMuted} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: string) => {
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, opts?: Omit<ToastOptions, 'message'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const item: ToastItem = {
      id,
      message,
      tone: opts?.tone ?? 'info',
      durationMs: opts?.durationMs ?? 3200,
      actionLabel: opts?.actionLabel,
      onAction: opts?.onAction,
    };
    setToasts(prev => [...prev.slice(-4), item]);
    timers.current[id] = setTimeout(() => dismiss(id), item.durationMs);
  }, [dismiss]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastHost toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

/** Soft import for optional usage outside provider (e.g. early boot). */
export function useToastOptional() {
  return useContext(ToastContext);
}

