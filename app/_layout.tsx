// Powered by OnSpace.AI
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AlertProvider } from '@/template';
import { BotProvider } from '@/contexts/BotContext';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';
import { ProfileProvider } from '@/contexts/ProfileContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

export default function RootLayout() {
  return (
    <AlertProvider>
      <SafeAreaProvider>
        <ThemeProvider>
          <ProfileProvider>
            <WorkspaceProvider>
              <BotProvider>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="workspace-settings" options={{ headerShown: false }} />
                  <Stack.Screen name="workspace-database" options={{ headerShown: false }} />
                  <Stack.Screen name="workspace-tasks" options={{ headerShown: false }} />
                </Stack>
              </BotProvider>
            </WorkspaceProvider>
          </ProfileProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </AlertProvider>
  );
}
