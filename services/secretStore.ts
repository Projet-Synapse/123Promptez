// Coffre local des secrets (clé d'API perso, jeton GitHub).
// Les secrets ne quittent JAMAIS l'appareil : ils ne sont pas synchronisés
// dans bot_config (Supabase) et sont retirés des données cloud entrantes.
//  - Android / iOS : expo-secure-store (Keystore / Keychain)
//  - Desktop Electron : safeStorage (DPAPI / Keychain / libsecret) via preload
//  - Web : sessionStorage uniquement (effacé à la fermeture de l'onglet)
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type SecretName = 'apiKey' | 'githubToken' | 'xaiKey';
const PREFIX = 'promptez_secret_';

type DesktopSecrets = {
  get: (name: string) => Promise<string | null>;
  set: (name: string, value: string) => Promise<boolean>;
  remove: (name: string) => Promise<boolean>;
};

function desktop(): DesktopSecrets | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return ((window as any).promptezSecrets as DesktopSecrets | undefined) ?? null;
}

/** Niveau de protection effectif, pour l'afficher dans les réglages. */
export function secretStorageKind(): 'secure' | 'desktop' | 'session' {
  if (Platform.OS !== 'web') return 'secure';
  return desktop() ? 'desktop' : 'session';
}

export async function getSecret(name: SecretName): Promise<string> {
  try {
    if (Platform.OS !== 'web') return (await SecureStore.getItemAsync(PREFIX + name)) ?? '';
    const d = desktop();
    if (d) return (await d.get(name)) ?? '';
    return window.sessionStorage?.getItem(PREFIX + name) ?? '';
  } catch {
    return '';
  }
}

export async function setSecret(name: SecretName, value: string): Promise<void> {
  try {
    if (!value) return await removeSecret(name);
    if (Platform.OS !== 'web') return await SecureStore.setItemAsync(PREFIX + name, value);
    const d = desktop();
    if (d) { await d.set(name, value); return; }
    // Web navigateur : pas de stockage chiffré fiable → session uniquement.
    console.warn('[secretStore] Web : la clé est gardée pour cette session seulement (non chiffrée).');
    window.sessionStorage?.setItem(PREFIX + name, value);
  } catch {
    /* silencieux : la clé reste en mémoire pour la session */
  }
}

export async function removeSecret(name: SecretName): Promise<void> {
  try {
    if (Platform.OS !== 'web') return await SecureStore.deleteItemAsync(PREFIX + name);
    const d = desktop();
    if (d) { await d.remove(name); return; }
    window.sessionStorage?.removeItem(PREFIX + name);
  } catch { /* ignore */ }
}

const isGithub = (a: any) => a?.presetId === 'github' || a?.id === 'github';

/** Extrait les secrets d'un bot_config (local ou cloud). */
export function extractSecrets(cfg: any): Partial<Record<SecretName, string>> {
  const out: Partial<Record<SecretName, string>> = {};
  if (!cfg || typeof cfg !== 'object') return out;
  if (typeof cfg.apiKey === 'string' && cfg.apiKey.trim()) out.apiKey = cfg.apiKey.trim();
  const xai = cfg.llmConfig?.localAI?.apiKey;
  if (typeof xai === 'string' && xai.trim()) out.xaiKey = xai.trim();
  const apps = cfg.connectedApps ?? cfg.connectors;
  if (Array.isArray(apps)) {
    const gh = apps.find(isGithub);
    if (gh && typeof gh.webhookUrl === 'string' && gh.webhookUrl.trim()) out.githubToken = gh.webhookUrl.trim();
  }
  return out;
}

/** Copie de bot_config sans aucun secret (pour le cloud / l'export). */
export function stripSecrets<T>(cfg: T): T {
  if (!cfg || typeof cfg !== 'object') return cfg;
  const { apiKey: _drop, ...rest } = cfg as any;
  const strip = (apps: any) => Array.isArray(apps)
    ? apps.map((a: any) => (isGithub(a) ? { ...a, webhookUrl: '' } : a))
    : apps;
  if ('connectedApps' in rest) rest.connectedApps = strip(rest.connectedApps);
  if ('connectors' in rest) rest.connectors = strip(rest.connectors);
  if (rest.llmConfig?.localAI && 'apiKey' in rest.llmConfig.localAI) {
    const { apiKey: _k, ...localAI } = rest.llmConfig.localAI;
    rest.llmConfig = { ...rest.llmConfig, localAI };
  }
  return rest as T;
}

/** Réinjecte les secrets locaux dans la config en mémoire. */
export function applySecrets<T extends { apiKey?: string; connectedApps?: any[] }>(
  cfg: T, secrets: Partial<Record<SecretName, string>>,
): T {
  const next: any = { ...cfg, apiKey: secrets.apiKey ?? '' };
  if (next.llmConfig?.localAI) {
    next.llmConfig = { ...next.llmConfig, localAI: { ...next.llmConfig.localAI, apiKey: secrets.xaiKey ?? next.llmConfig.localAI.apiKey ?? '' } };
  }
  if (Array.isArray(next.connectedApps)) {
    next.connectedApps = next.connectedApps.map((a: any) =>
      isGithub(a) ? { ...a, webhookUrl: secrets.githubToken ?? a.webhookUrl ?? '' } : a);
  }
  return next;
}
