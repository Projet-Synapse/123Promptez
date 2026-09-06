// Export / import JSON for workspaces, KB, and AI memory.
import type { BotConfig } from '@/contexts/BotContext';
import type { Workspace } from '@/contexts/WorkspaceContext';
import type { UserProfile } from '@/contexts/ProfileContext';
import { Platform } from 'react-native';

export type ExportBundle = {
  version: 1;
  exportedAt: string;
  app: '123Promptez';
  workspaces?: Workspace[];
  bot_config?: Partial<BotConfig>;
  profile?: Partial<UserProfile>;
};

export function buildExportBundle(opts: {
  workspaces?: Workspace[];
  bot?: BotConfig;
  profile?: UserProfile;
  includeWorkspaces?: boolean;
  includeKB?: boolean;
  includeMemory?: boolean;
}): ExportBundle {
  const bundle: ExportBundle = {
    version: 1,
    exportedAt: new Date().toISOString(),
    app: '123Promptez',
  };
  if (opts.includeWorkspaces !== false && opts.workspaces) {
    bundle.workspaces = opts.workspaces;
  }
  if (opts.includeKB !== false && opts.bot) {
    bundle.bot_config = {
      kbSources: opts.bot.kbSources,
      faqItems: opts.bot.faqItems,
      name: opts.bot.name,
      description: opts.bot.description,
      llmConfig: opts.bot.llmConfig,
      agentTools: opts.bot.agentTools,
      connectedApps: opts.bot.connectedApps.map(a => ({
        ...a,
        // Never dump secrets into casual shares — redact PAT-looking tokens
        webhookUrl: a.presetId === 'github' || a.id === 'github'
          ? (a.webhookUrl ? '[REDACTED]' : '')
          : a.webhookUrl,
      })),
      customAgents: opts.bot.customAgents,
    };
  }
  if (opts.includeMemory !== false && opts.profile) {
    bundle.profile = {
      name: opts.profile.name,
      role: opts.profile.role,
      bio: opts.profile.bio,
      language: opts.profile.language,
      aiMemory: opts.profile.aiMemory,
    };
  }
  return bundle;
}

export function downloadJson(filename: string, data: unknown): boolean {
  try {
    const json = JSON.stringify(data, null, 2);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return true;
    }
    // Native fallback: copy to clipboard via expo-clipboard if available
    // Caller can also show the JSON in a modal.
    return false;
  } catch {
    return false;
  }
}

export function parseImportBundle(raw: string): { ok: true; bundle: ExportBundle } | { ok: false; error: string } {
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return { ok: false, error: 'JSON invalide' };
    if (data.version !== 1 && data.version !== undefined) {
      return { ok: false, error: `Version non supportée: ${data.version}` };
    }
    return { ok: true, bundle: data as ExportBundle };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? 'Impossible de lire le JSON' };
  }
}
