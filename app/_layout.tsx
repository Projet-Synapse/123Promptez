// Powered by OnSpace.AI
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AlertProvider } from '@/template';
import { BotProvider } from '@/contexts/BotContext';
import { WorkspaceProvider } from '@/contexts/WorkspaceContext';

export default function RootLayout() {
  return (
    <AlertProvider>
      <SafeAreaProvider>
        <WorkspaceProvider>
          <BotProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="workspace-settings" options={{ headerShown: false }} />
              <Stack.Screen name="workspace-database" options={{ headerShown: false }} />
            </Stack>
          </BotProvider>
        </WorkspaceProvider>
      </SafeAreaProvider>
    </AlertProvider>
  );
}
