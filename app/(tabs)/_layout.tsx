// Powered by OnSpace.AI
// Mobile: bottom tabs. Desktop (wide): side navigation + max content width.
import { MaterialIcons } from '@expo/vector-icons';
import { Tabs, useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform, View, Pressable, Text, useWindowDimensions } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { SyncIndicator } from '@/components/feature/SyncIndicator';
import { useCommandPalette } from '@/contexts/CommandPaletteContext';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';

const DESKTOP_BREAKPOINT = 960;
const SIDE_NAV_WIDTH = 220;
const MAX_CONTENT = 1100;

const TAB_ITEMS: { name: string; titleKey: string; icon: keyof typeof MaterialIcons.glyphMap; href: string }[] = [
  { name: 'index', titleKey: 'builder', icon: 'construction', href: '/(tabs)/' },
  { name: 'workspaces', titleKey: 'workspaces', icon: 'workspaces', href: '/(tabs)/workspaces' },
  { name: 'chat', titleKey: 'chat', icon: 'chat-bubble', href: '/(tabs)/chat' },
  { name: 'profile', titleKey: 'profile', icon: 'person', href: '/(tabs)/profile' },
  { name: 'settings', titleKey: 'settings', icon: 'tune', href: '/(tabs)/settings' },
];

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const Colors = useThemeColors();
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const router = useRouter();
  const pathname = usePathname();
  const { openPalette } = useCommandPalette();
  const { t } = useLanguage();

  const tabBarStyle = isDesktop
    ? { display: 'none' as const, height: 0 }
    : {
        height: Platform.select({ ios: insets.bottom + 60, android: insets.bottom + 60, default: 70 }),
        paddingTop: 8,
        paddingBottom: Platform.select({ ios: insets.bottom + 8, android: insets.bottom + 8, default: 8 }),
        paddingHorizontal: 16,
        backgroundColor: Colors.bg,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
      };

  const tabs = (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarShowLabel: false,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Builder',
          tabBarAccessibilityLabel: 'Builder',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="construction" size={size} color={color} accessibilityLabel="Builder" />,
        }}
      />
      <Tabs.Screen
        name="workspaces"
        options={{
          title: 'Workspaces',
          tabBarAccessibilityLabel: 'Workspaces',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="workspaces" size={size} color={color} accessibilityLabel="Workspaces" />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarAccessibilityLabel: 'Chat',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="chat-bubble" size={size} color={color} accessibilityLabel="Chat" />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarAccessibilityLabel: 'Profil',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="person" size={size} color={color} accessibilityLabel="Profil" />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Paramètres',
          tabBarAccessibilityLabel: 'Paramètres',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="tune" size={size} color={color} accessibilityLabel="Paramètres" />,
        }}
      />
    </Tabs>
  );

  if (!isDesktop) return tabs;

  const isActive = (href: string) => {
    if (href.endsWith('/')) return pathname === '/' || pathname.endsWith('/index') || pathname === '/(tabs)' || pathname.endsWith('(tabs)');
    return pathname.includes(href.replace('/(tabs)', '')) || pathname.endsWith(href.split('/').pop() || '');
  };

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: Colors.bg }}>
      <View
        style={{
          width: SIDE_NAV_WIDTH,
          paddingTop: Math.max(insets.top, 16),
          paddingBottom: insets.bottom + 12,
          paddingHorizontal: Spacing.sm,
          borderRightWidth: 1,
          borderRightColor: Colors.border,
          backgroundColor: Colors.bgCard,
          gap: Spacing.xs,
        }}
      >
        <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: Spacing.sm, marginBottom: Spacing.xs }}>
          123Promptez
        </Text>
        <Pressable
          onPress={openPalette}
          style={({ pressed }) => [{
            flexDirection: 'row', alignItems: 'center', gap: 8,
            paddingHorizontal: Spacing.sm, paddingVertical: 10,
            borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
            backgroundColor: Colors.bgCardAlt, marginBottom: Spacing.sm,
          }, pressed && { opacity: 0.8 }]}
        >
          <MaterialIcons name="search" size={16} color={Colors.textMuted} />
          <Text style={{ flex: 1, fontSize: FontSize.sm, color: Colors.textMuted }}>Rechercher…</Text>
          <Text style={{ fontSize: 10, color: Colors.textMuted, fontFamily: 'monospace' }}>⌘K</Text>
        </Pressable>

        {TAB_ITEMS.map(item => {
          const active = isActive(item.href);
          return (
            <Pressable
              key={item.name}
              onPress={() => router.push(item.href as any)}
              style={({ pressed }) => [{
                flexDirection: 'row', alignItems: 'center', gap: 10,
                paddingHorizontal: Spacing.sm, paddingVertical: 10,
                borderRadius: Radius.md,
                backgroundColor: active ? Colors.primary + '22' : 'transparent',
                borderWidth: 1,
                borderColor: active ? Colors.primary + '44' : 'transparent',
              }, pressed && { opacity: 0.75 }]}
            >
              <MaterialIcons name={item.icon} size={20} color={active ? Colors.primaryLight : Colors.textMuted} />
              <Text style={{ fontSize: FontSize.sm, color: active ? Colors.textPrimary : Colors.textSecondary, fontWeight: active ? '700' : '500' }}>
                {t(item.titleKey)}
              </Text>
            </Pressable>
          );
        })}

        <View style={{ flex: 1 }} />
        <SyncIndicator />
      </View>

      <View style={{ flex: 1, alignItems: 'center' }}>
        <View style={{ flex: 1, width: '100%', maxWidth: MAX_CONTENT }}>
          {tabs}
        </View>
      </View>
    </View>
  );
}
