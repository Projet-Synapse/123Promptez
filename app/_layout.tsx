// Root layout — wires WorkspaceProvider, ProfileProvider & BotProvider to cloud auto-sync
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import { useFonts } from 'expo-font';
import { MaterialIcons, FontAwesome } from '@expo/vector-icons';
import * as SplashScreen from 'expo-splash-screen';
import { AlertProvider, AuthProvider } from '@/template';
import { BotProvider, type BotConfig } from '@/contexts/BotContext';
import { WorkspaceProvider, type Workspace } from '@/contexts/WorkspaceContext';
import { ProfileProvider, type UserProfile } from '@/contexts/ProfileContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AppDataProvider, useAppData } from '@/contexts/AppDataContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { CommandPaletteProvider } from '@/contexts/CommandPaletteContext';
import { CommandPalette } from '@/components/feature/CommandPalette';
import { VaultLiveSync } from '@/components/feature/VaultLiveSync';
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
          <VaultLiveSync />
          <WebScrollbars />
          <CommandPalette />
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

/** Barres de défilement visibles (web) : repère visuel sur toutes les pages.
 *  Les vues défilantes de react-native-web sont des div avec overflow inline —
 *  on les cible par sélecteur d'attribut et on force un scrollbar discret. */
function WebScrollbars() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const style = document.createElement('style');
    style.id = 'promptez-scrollbars';
    // RN-web écrit les styles inline SANS espace (overflow-y:auto) : on cible
    // les deux variantes.
    style.textContent = `
      div[style*="overflow-y: auto"], div[style*="overflow-y:auto"],
      div[style*="overflow: auto"], div[style*="overflow:auto"],
      div[style*="overflow-y: scroll"], div[style*="overflow-y:scroll"],
      div[style*="overflow: scroll"], div[style*="overflow:scroll"] {
        scrollbar-width: thin !important;
        scrollbar-color: #b6bdc7 transparent !important;
      }
      div[style*="overflow-y: auto"]::-webkit-scrollbar,
      div[style*="overflow-y:auto"]::-webkit-scrollbar,
      div[style*="overflow: auto"]::-webkit-scrollbar,
      div[style*="overflow:auto"]::-webkit-scrollbar,
      div[style*="overflow-y: scroll"]::-webkit-scrollbar,
      div[style*="overflow-y:scroll"]::-webkit-scrollbar,
      div[style*="overflow: scroll"]::-webkit-scrollbar,
      div[style*="overflow:scroll"]::-webkit-scrollbar {
        width: 10px; height: 10px; display: block;
      }
      div[style*="overflow-y: auto"]::-webkit-scrollbar-thumb,
      div[style*="overflow-y:auto"]::-webkit-scrollbar-thumb,
      div[style*="overflow: auto"]::-webkit-scrollbar-thumb,
      div[style*="overflow:auto"]::-webkit-scrollbar-thumb,
      div[style*="overflow-y: scroll"]::-webkit-scrollbar-thumb,
      div[style*="overflow-y:scroll"]::-webkit-scrollbar-thumb,
      div[style*="overflow: scroll"]::-webkit-scrollbar-thumb,
      div[style*="overflow:scroll"]::-webkit-scrollbar-thumb {
        background: #b6bdc7; border-radius: 6px; border: 2px solid transparent;
        background-clip: content-box;
      }
      div[style*="overflow-y: auto"]::-webkit-scrollbar-track,
      div[style*="overflow-y:auto"]::-webkit-scrollbar-track,
      div[style*="overflow: auto"]::-webkit-scrollbar-track,
      div[style*="overflow:auto"]::-webkit-scrollbar-track,
      div[style*="overflow-y: scroll"]::-webkit-scrollbar-track,
      div[style*="overflow-y:scroll"]::-webkit-scrollbar-track,
      div[style*="overflow: scroll"]::-webkit-scrollbar-track,
      div[style*="overflow:scroll"]::-webkit-scrollbar-track {
        background: transparent;
      }
    `;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);
  return null;
}

function CloudHydrator() {
  const { loadedData, isDataLoaded, reloadToken } = useAppData();
  const { hydrateFromCloud: hydrateWs } = useWorkspace();
  const { hydrateFromCloud: hydrateProfile } = useProfile();
  const { hydrateFromCloud: hydrateBot } = useBot();
  const hydrated = useRef(false);

  // Hydratation initiale (premier chargement cloud)
  useEffect(() => {
    if (!isDataLoaded || hydrated.current) return;
    hydrated.current = true;
    if (loadedData.workspaces) hydrateWs(loadedData.workspaces as any);
    if (loadedData.profile) hydrateProfile(loadedData.profile as any);
    if (loadedData.bot_config) hydrateBot(loadedData.bot_config as any);
  }, [isDataLoaded, loadedData, hydrateWs, hydrateProfile, hydrateBot]);

  // Re-chargement à la demande (ex : l'IA a modifié la bibliothèque côté serveur)
  useEffect(() => {
    if (!reloadToken) return;
    if (loadedData.workspaces) hydrateWs(loadedData.workspaces as any);
    if (loadedData.profile) hydrateProfile(loadedData.profile as any);
    if (loadedData.bot_config) hydrateBot(loadedData.bot_config as any);
  }, [reloadToken]);

  return null;
}

export default function RootLayout() {
  const [iconFontLoaded] = useFonts({ ...MaterialIcons.font, ...FontAwesome.font });

  useEffect(() => {
    if (iconFontLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [iconFontLoaded]);

  if (!iconFontLoaded) return null;

  return (
    <AlertProvider>
      <SafeAreaProvider>
        <ThemeProvider>
          <LanguageProvider>
            <ToastProvider>
              <AuthProvider>
                <AppDataProvider>
                  <CommandPaletteProvider>
                    <InnerLayout />
                  </CommandPaletteProvider>
                </AppDataProvider>
              </AuthProvider>
            </ToastProvider>
          </LanguageProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </AlertProvider>
  );
}
