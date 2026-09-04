// Root layout — wires WorkspaceProvider, ProfileProvider & BotProvider to cloud auto-sync
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { MaterialIcons } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import { AlertProvider, AuthProvider } from '@/template';
import { BotProvider, type BotConfig } from '@/contexts/BotContext';
import { WorkspaceProvider, type Workspace } from '@/contexts/WorkspaceContext';
import { ProfileProvider, type UserProfile } from '@/contexts/ProfileContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AppDataProvider, useAppData } from '@/contexts/AppDataContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { useRef, useEffect, useCallback } from 'react';

// ── Hydrates contexts from cloud once data is loaded ─────────────────────────
import { useWorkspace } from '@/hooks/useWorkspace';
import { useProfile } from '@/contexts/ProfileContext';
import { useBot } from '@/hooks/useBot';

// Every screen in this app renders icons via MaterialIcons before any
// explicit font-loading ever happens — @expo/vector-icons lazily loads its
// font per-icon-instance (see createIconSet.js), which on web/Electron can
// lose a race against first paint: the glyph's Private-Use-Area codepoint
// gets painted with the browser's fallback font (a hollow "tofu" box)
// before the real font finishes downloading, and nothing repaints it after.
// Preloading here — gating the whole app behind one useFonts() call — makes
// the font available before any icon ever mounts, on every platform.
SplashScreen.preventAutoHideAsync().catch(() => {});

// ── Inner layout: has access to AppDataContext + contexts that need cloud sync ─
function InnerLayout() {
  const { triggerSync, loadedData, isDataLoaded } = useAppData();

  // Debounce refs per data type
  const wsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const botTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onWorkspacesChange = useCallback((ws: Workspace[]) => {
    if (wsTimer.current) clearTimeout(wsTimer.current);
    wsTimer.current = setTimeout(() => triggerSync('workspaces', ws), 2000);
  }, [triggerSync]);

  const onProfileChange = useCallback((profile: UserProfile) => {
    if (profileTimer.current) clearTimeout(profileTimer.current);
    profileTimer.current = setTimeout(() => triggerSync('profile', profile), 2000);
  }, [triggerSync]);

  const onBotChange = useCallback((bot: BotConfig) => {
    if (botTimer.current) clearTimeout(botTimer.current);
    botTimer.current = setTimeout(() => triggerSync('bot_config', bot), 2000);
  }, [triggerSync]);

  return (
    <ProfileProvider onDataChange={onProfileChange}>
      <WorkspaceProvider onDataChange={onWorkspacesChange}>
        <BotProvider onDataChange={onBotChange}>
          <CloudHydrator />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="index" />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="workspace-settings" options={{ headerShown: false }} />
            <Stack.Screen name="workspace-database" options={{ headerShown: false }} />
            <Stack.Screen name="workspace-tasks" options={{ headerShown: false }} />
            <Stack.Screen name="workspace-automations" options={{ headerShown: false }} />
          </Stack>
        </BotProvider>
      </WorkspaceProvider>
    </ProfileProvider>
  );
}

function CloudHydrator() {
  const { loadedData, isDataLoaded } = useAppData();
  const { hydrateFromCloud: hydrateWs } = useWorkspace();
  const { hydrateFromCloud: hydrateProfile } = useProfile();
  const { hydrateFromCloud: hydrateBot } = useBot();
  const hydrated = useRef(false);

  useEffect(() => {
    if (!isDataLoaded || hydrated.current) return;
    hydrated.current = true;
    if (loadedData.workspaces) hydrateWs(loadedData.workspaces as any);
    if (loadedData.profile) hydrateProfile(loadedData.profile as any);
    if (loadedData.bot_config) hydrateBot(loadedData.bot_config as any);
  }, [isDataLoaded, loadedData, hydrateWs, hydrateProfile, hydrateBot]);

  return null;
}

export default function RootLayout() {
  const [iconFontLoaded] = useFonts({ ...MaterialIcons.font });

  useEffect(() => {
    if (iconFontLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [iconFontLoaded]);

  if (!iconFontLoaded) return null;

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
