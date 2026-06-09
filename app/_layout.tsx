// Powered by OnSpace.AI
// Root layout — wires WorkspaceProvider & ProfileProvider to cloud auto-sync via AppDataContext
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AlertProvider, AuthProvider } from '@/template';
import { BotProvider } from '@/contexts/BotContext';
import { WorkspaceProvider, type Workspace } from '@/contexts/WorkspaceContext';
import { ProfileProvider, type UserProfile } from '@/contexts/ProfileContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AppDataProvider, useAppData } from '@/contexts/AppDataContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { useRef, useEffect, useCallback } from 'react';

// ── Inner layout: has access to AppDataContext + contexts that need cloud sync ─
function InnerLayout() {
  const { triggerSync, loadedData, isDataLoaded } = useAppData();

  // Debounce refs per data type
  const wsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onWorkspacesChange = useCallback((ws: Workspace[]) => {
    if (wsTimer.current) clearTimeout(wsTimer.current);
    wsTimer.current = setTimeout(() => triggerSync('workspaces', ws), 2000);
  }, [triggerSync]);

  const onProfileChange = useCallback((profile: UserProfile) => {
    if (profileTimer.current) clearTimeout(profileTimer.current);
    profileTimer.current = setTimeout(() => triggerSync('profile', profile), 2000);
  }, [triggerSync]);

  return (
    <ProfileProvider onDataChange={onProfileChange}>
      <WorkspaceProvider onDataChange={onWorkspacesChange}>
        <BotProvider>
          <CloudHydrator />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="index" />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="workspace-settings" options={{ headerShown: false }} />
            <Stack.Screen name="workspace-database" options={{ headerShown: false }} />
            <Stack.Screen name="workspace-tasks" options={{ headerShown: false }} />
          </Stack>
        </BotProvider>
      </WorkspaceProvider>
    </ProfileProvider>
  );
}

// ── Hydrates contexts from cloud once data is loaded ─────────────────────────
import { useWorkspace } from '@/hooks/useWorkspace';
import { useProfile } from '@/contexts/ProfileContext';

function CloudHydrator() {
  const { loadedData, isDataLoaded } = useAppData();
  const { hydrateFromCloud: hydrateWs } = useWorkspace();
  const { hydrateFromCloud: hydrateProfile } = useProfile();
  const hydrated = useRef(false);

  useEffect(() => {
    if (!isDataLoaded || hydrated.current) return;
    hydrated.current = true;
    if (loadedData.workspaces) hydrateWs(loadedData.workspaces);
    if (loadedData.profile) hydrateProfile(loadedData.profile);
  }, [isDataLoaded, loadedData, hydrateWs, hydrateProfile]);

  return null;
}

export default function RootLayout() {
  return (
    <AlertProvider>
      <SafeAreaProvider>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <AppDataProvider>
                <InnerLayout />
              </AppDataProvider>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </AlertProvider>
  );
}
