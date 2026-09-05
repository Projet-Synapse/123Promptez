// Powered by OnSpace.AI
import { MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import { useThemeColors } from '@/hooks/useThemeColors';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const Colors = useThemeColors();

  const tabBarStyle = {
    height: Platform.select({ ios: insets.bottom + 60, android: insets.bottom + 60, default: 70 }),
    paddingTop: 8,
    paddingBottom: Platform.select({ ios: insets.bottom + 8, android: insets.bottom + 8, default: 8 }),
    paddingHorizontal: 16,
    backgroundColor: Colors.bg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  };

  return (
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
}
