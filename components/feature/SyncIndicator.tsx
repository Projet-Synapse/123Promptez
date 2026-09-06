// Global cloud sync badge — syncing / synced / error+retry
import React from 'react';
import { Pressable, Text, View, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAppData } from '@/contexts/AppDataContext';
import { useThemeColors } from '@/hooks/useThemeColors';
import { FontSize, Radius, Spacing } from '@/constants/theme';

interface Props {
  compact?: boolean;
  onRetry?: () => void;
}

export function SyncIndicator({ compact, onRetry }: Props) {
  const C = useThemeColors();
  const { isSyncing, lastSyncAt, syncError, retrySync } = useAppData();

  const retry = () => {
    if (onRetry) { onRetry(); return; }
    retrySync();
  };

  let color = C.accent;
  let icon: keyof typeof MaterialIcons.glyphMap = 'cloud-done';
  let label = lastSyncAt
    ? `Synchronisé ${lastSyncAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
    : 'Cloud prêt';

  if (isSyncing) {
    color = C.warning;
    icon = 'sync';
    label = 'Synchronisation…';
  } else if (syncError) {
    color = C.error;
    icon = 'cloud-off';
    label = 'Erreur sync — réessayer';
  }

  return (
    <Pressable
      onPress={syncError ? retry : undefined}
      accessibilityLabel={label}
      style={({ pressed }) => [{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: compact ? 8 : 10,
        paddingVertical: compact ? 4 : 6,
        borderRadius: Radius.pill,
        backgroundColor: color + '14',
        borderWidth: 1,
        borderColor: color + '44',
      }, pressed && syncError ? { opacity: 0.75 } : null]}
    >
      {isSyncing ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <MaterialIcons name={icon} size={14} color={color} />
      )}
      {!compact ? (
        <Text style={{ fontSize: FontSize.xs, color: syncError ? C.error : C.textMuted, fontWeight: '600' }} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
      {syncError && !compact ? (
        <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: Radius.pill, backgroundColor: C.error + '22' }}>
          <Text style={{ fontSize: 10, color: C.error, fontWeight: '700' }}>Réessayer</Text>
        </View>
      ) : null}
      {compact ? <View style={{ width: Spacing.xs }} /> : null}
    </Pressable>
  );
}
