// Hook React pilotant la mise à jour desktop (écran Réglages → À propos) :
// statut de vérification/téléchargement, installation et option « mise à
// jour automatique » (persistée côté process principal). Sur web/mobile le
// pont est absent — le hook renvoie isDesktop: false et l'écran retombe sur
// la vérification légère de services/updateService.ts.
import { useCallback, useEffect, useRef, useState } from 'react';

import { getDesktopBridge, type DesktopUpdateEvent } from '@/services/desktopUpdates';

export type DesktopUpdateStage =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'error';

interface DesktopUpdatesState {
  stage: DesktopUpdateStage;
  currentVersion: string | null;
  latestVersion: string | null;
  progress: number | null;
  error: string | null;
  autoUpdate: boolean;
}

export function useDesktopUpdates() {
  const bridge = getDesktopBridge();
  const isDesktop = !!bridge;

  const [state, setState] = useState<DesktopUpdatesState>({
    stage: isDesktop ? 'idle' : 'up-to-date',
    currentVersion: bridge?.appVersion ?? null,
    latestVersion: null,
    progress: null,
    error: null,
    autoUpdate: false,
  });

  // Snapshot initial : état + préférence, puis abonnement aux événements
  // poussés par le process principal (la vérification démarre au lancement
  // de l'app, potentiellement avant le montage de cet écran).
  useEffect(() => {
    if (!bridge) return;
    let cancelled = false;

    void bridge.getAutoUpdate().then((enabled) => {
      if (!cancelled) setState(s => ({ ...s, autoUpdate: enabled }));
    }).catch(() => {});

    const unsubscribe = bridge.onUpdateEvent((event: DesktopUpdateEvent) => {
      switch (event.type) {
        case 'checking':
          setState(s => ({ ...s, stage: 'checking', error: null }));
          break;
        case 'available':
          setState(s => ({ ...s, stage: 'available', latestVersion: event.version ?? s.latestVersion }));
          break;
        case 'not-available':
          setState(s => ({ ...s, stage: 'up-to-date' }));
          break;
        case 'progress':
          setState(s => ({ ...s, stage: 'downloading', progress: typeof event.percent === 'number' ? event.percent : null }));
          break;
        case 'downloaded':
          setState(s => ({
            ...s,
            stage: 'ready',
            progress: 100,
            latestVersion: event.version ?? s.latestVersion,
          }));
          break;
        case 'error':
          setState(s => ({ ...s, stage: 'error', error: event.message || 'Erreur inconnue' }));
          break;
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [bridge]);

  // Téléchargement automatique : dès qu'une version est détectée alors que
  // l'option est activée (le flag autoDownload du process principal fait
  // déjà le travail lors des vérifications qu'il déclenche lui-même ; ce
  // hook couvre les vérifications demandées depuis l'UI).
  const lastAutoDownloadRef = useRef(false);
  useEffect(() => {
    if (!bridge) return;
    if (!state.autoUpdate || state.stage !== 'available') {
      lastAutoDownloadRef.current = false;
      return;
    }
    if (lastAutoDownloadRef.current) return;
    lastAutoDownloadRef.current = true;
    void bridge.downloadUpdate();
  }, [bridge, state.autoUpdate, state.stage]);

  const checkForUpdates = useCallback(async () => {
    if (!bridge) return;
    setState(s => ({ ...s, stage: 'checking', error: null }));
    const result = await bridge.checkForUpdates();
    if (result.error) {
      setState(s => ({ ...s, stage: 'error', error: result.error ?? 'Erreur inconnue' }));
    }
    // Les transitions disponibles/à jour arrivent via les événements.
  }, [bridge]);

  const installUpdate = useCallback(() => {
    if (!bridge) return;
    bridge.quitAndInstall();
  }, [bridge]);

  const setAutoUpdate = useCallback(async (enabled: boolean) => {
    if (!bridge) return;
    setState(s => ({ ...s, autoUpdate: enabled }));
    try {
      const applied = await bridge.setAutoUpdate(enabled);
      setState(s => ({ ...s, autoUpdate: applied }));
    } catch {
      setState(s => ({ ...s, autoUpdate: !enabled }));
    }
  }, [bridge]);

  return { ...state, isDesktop, checkForUpdates, installUpdate, setAutoUpdate };
}
