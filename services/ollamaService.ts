// ollamaService — modèles LOCAUX via Ollama (http://127.0.0.1:11434).
//
// Appel DIRECT depuis l'app : le proxy Edge tourne dans le cloud et ne peut
// pas joindre ce PC. Ollama accepte par défaut les origines localhost /
// 127.0.0.1 (appli desktop sur 127.0.0.1:47823, serveur de dev) ; le site
// github.io est refusé (403) tant que la variable OLLAMA_ORIGINS ne l'autorise pas.
// Les modèles « :cloud » d'Ollama (crédits ollama.com) sont exclus : ce
// chemin n'existe que pour l'usage sans quota.

export const OLLAMA_URL = 'http://127.0.0.1:11434';
export const OLLAMA_PREFIX = 'ollama:';
export const OLLAMA_PROVIDER = 'Ollama (local)';

// Fenêtre de contexte : le cache KV vit en mémoire vidéo. Sur une carte de
// 6 Go, au-delà de ~16k tokens le modèle déborde trop en RAM (lent).
const MIN_CTX = 4096;
const MAX_CTX = 16384;
const NUM_PREDICT = 2048;
const CHARS_PER_TOKEN = 3.5;

export const isOllamaModel = (id?: string | null): boolean => !!id && id.startsWith(OLLAMA_PREFIX);
export const ollamaModelName = (id: string): string => id.slice(OLLAMA_PREFIX.length);

export interface LocalModel {
  id: string;
  label: string;
  provider: string;
  tokens: number;
  sizeGb: number;
}

/** Modèles locaux installés, ou null si Ollama est injoignable depuis cette page. */
export async function listLocalModels(timeoutMs = 2500): Promise<LocalModel[] | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: ctrl.signal });
    if (!res.ok) return null;
    const data: any = await res.json();
    return (data?.models ?? [])
      .filter((m: any) => !m.remote_host && !String(m.name ?? '').endsWith(':cloud'))
      .map((m: any): LocalModel => ({
        id: `${OLLAMA_PREFIX}${m.name}`,
        label: `${m.name}${m.details?.parameter_size ? ` · ${m.details.parameter_size}` : ''}`,
        provider: OLLAMA_PROVIDER,
        tokens: MAX_CTX,
        sizeGb: Math.round((Number(m.size) || 0) / 1e8) / 10,
      }));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function unreachableError(): Error {
  return new Error(
    'Ollama ne répond pas sur ce PC (127.0.0.1:11434). Vérifie qu’Ollama est lancé (icône du lama dans la barre des tâches). '
    + 'Les modèles locaux fonctionnent dans l’appli desktop ; le site web n’y a pas accès.',
  );
}

/** Dernière taille de contexte utilisée par modèle (pour cette session de l'app). */
const ctxByModel = new Map<string, number>();

/** Taille de contexte adaptée à la conversation. Ollama RECHARGE entièrement
 *  le modèle quand elle change (jusqu'à 90 s, et le cache est perdu) : elle ne
 *  fait donc que grandir, par paliers de 4096, au fil de la session. */
function pickNumCtx(model: string, messages: { content: string }[]): number {
  const promptTokens = Math.ceil(messages.reduce((n, m) => n + m.content.length, 0) / CHARS_PER_TOKEN);
  const needed = Math.ceil((promptTokens + NUM_PREDICT) / 4096) * 4096;
  const ctx = Math.min(MAX_CTX, Math.max(MIN_CTX, needed, ctxByModel.get(model) ?? 0));
  ctxByModel.set(model, ctx);
  return ctx;
}

/** Si le prompt système dépasse le contexte maximal, on le raccourcit
 *  explicitement (sinon Ollama le couperait sans prévenir). */
function fitToContext<T extends { role: string; content: string }>(messages: T[]): T[] {
  const budgetChars = (MAX_CTX - NUM_PREDICT - 512) * CHARS_PER_TOKEN;
  const total = messages.reduce((n, m) => n + m.content.length, 0);
  if (total <= budgetChars) return messages;
  const sys = messages[0];
  if (!sys || sys.role !== 'system') return messages;
  const others = total - sys.content.length;
  const room = Math.max(4000, budgetChars - others);
  if (sys.content.length <= room) return messages;
  const note = '\n\n[… contexte du workspace tronqué : le modèle local ne peut pas tout lire d’un coup.]';
  return [{ ...sys, content: sys.content.slice(0, room - note.length) + note }, ...messages.slice(1)];
}

export interface OllamaChatOptions {
  model: string;
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  temperature?: number;
  thinking?: boolean;
  onToken?: (fullText: string) => void;
  onThinking?: (fullThinking: string) => void;
  signal?: AbortSignal;
}

/** Envoie la conversation au modèle local et diffuse la réponse au fil de l'eau. */
export async function streamOllamaChat(opts: OllamaChatOptions): Promise<string> {
  const messages = fitToContext(opts.messages);
  const baseBody = {
    model: opts.model,
    messages,
    stream: true,
    // Garder le modèle en mémoire 30 min après la dernière question : un
    // rechargement depuis le disque coûte jusqu'à 90 s sur un PC classique.
    keep_alive: '30m',
    options: {
      num_ctx: pickNumCtx(opts.model, messages),
      num_predict: NUM_PREDICT,
      ...(typeof opts.temperature === 'number' ? { temperature: opts.temperature } : {}),
    },
  };

  const post = (withThink: boolean) => fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(withThink ? { ...baseBody, think: true } : baseBody),
    signal: opts.signal,
  });

  let res: Response;
  try {
    res = await post(opts.thinking === true);
    // Mode Réfléchie sur un modèle sans raisonnement natif : on retente sans.
    if (!res.ok && opts.thinking === true && res.status === 400) {
      const t = await res.text().catch(() => '');
      if (/think/i.test(t)) res = await post(false);
      else throw new Error(`Ollama ${res.status} : ${t.slice(0, 200)}`);
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    if (e instanceof TypeError) throw unreachableError();
    throw e;
  }

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    let msg = t.slice(0, 200);
    try { msg = JSON.parse(t)?.error ?? msg; } catch { /* texte brut */ }
    if (res.status === 404) {
      throw new Error(`Modèle local « ${opts.model} » introuvable sur ce PC — installe-le avec : ollama pull ${opts.model}`);
    }
    throw new Error(`Ollama ${res.status} : ${msg}`);
  }

  let fullText = '';
  let fullThinking = '';
  const handleLine = (line: string) => {
    if (!line.trim()) return;
    let obj: any;
    try { obj = JSON.parse(line); } catch { return; }
    if (obj.error) throw new Error(`Ollama : ${obj.error}`);
    const thinking = obj.message?.thinking;
    if (typeof thinking === 'string' && thinking) {
      fullThinking += thinking;
      opts.onThinking?.(fullThinking);
    }
    const content = obj.message?.content;
    if (typeof content === 'string' && content) {
      fullText += content;
      opts.onToken?.(fullText);
    }
  };

  const reader = res.body?.getReader();
  if (!reader) {
    (await res.text()).split('\n').forEach(handleLine);
    return fullText;
  }
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    if (opts.signal?.aborted) {
      try { await reader.cancel(); } catch { /* ignore */ }
      throw new DOMException('Aborted', 'AbortError');
    }
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    lines.forEach(handleLine);
  }
  handleLine(buffer);
  return fullText;
}

/** Test rapide (Paramètres) : le modèle répond-il ? */
export async function pingOllamaModel(model: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: 'Réponds seulement : ok', stream: false, options: { num_predict: 5 } }),
    });
    if (res.ok) return { ok: true, message: `Modèle local « ${model} » opérationnel — aucune clé, aucun quota ✓` };
    const body: any = await res.json().catch(() => ({}));
    if (res.status === 404) return { ok: false, message: `Modèle « ${model} » non installé — lance : ollama pull ${model}` };
    return { ok: false, message: `Ollama a répondu ${res.status} : ${body?.error ?? 'erreur inconnue'}` };
  } catch {
    return { ok: false, message: unreachableError().message };
  }
}
