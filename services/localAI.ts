/** Direct local transport: never forwards LAN URLs to Supabase. */
export interface LocalAIConfig {
  enabled: boolean;
  url: string;
  protocol: 'ollama' | 'openai';
  narrativeModel: string;
  memoryModel: string;
  /** Explicit opt-in: history may leave the PC and go to Google. */
  fallbackGemini: boolean;
}
export const DEFAULT_LOCAL_AI: LocalAIConfig = {
  enabled: false, url: 'http://localhost:11434', protocol: 'ollama',
  narrativeModel: '', memoryModel: '', fallbackGemini: false,
};
export const LOCAL_FALLBACK_MODEL = 'gemini-2.5-flash-lite';
export function localBaseUrl(config: LocalAIConfig): string {
  const u = new URL(config.url.trim());
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.search || u.hash) {
    throw new Error('URL HTTP(S) requise, sans identifiants, paramètres ni fragment.');
  }
  return u.toString().replace(/\/$/, '').replace(/\/v1$/, '');
}

async function checked(res: Response): Promise<Response> {
  if (!res.ok) throw new Error(`IA locale HTTP ${res.status} : ${(await res.text()).slice(0, 240)}`);
  return res;
}

export async function listLocalModels(config: LocalAIConfig): Promise<string[]> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const base = localBaseUrl(config);
    const res = await checked(await fetch(`${base}${config.protocol === 'openai' ? '/v1/models' : '/api/tags'}`, { signal: ctl.signal }));
    const data = await res.json();
    const items = config.protocol === 'openai' ? data.data : data.models;
    if (!Array.isArray(items)) throw new Error('Liste de modèles non reconnue.');
    return items.map((x: any) => String(config.protocol === 'openai' ? x.id ?? '' : x.name ?? x.model ?? '')).filter(Boolean);
  } finally { clearTimeout(timer); }
}

/** Platform supplied by caller: Android always requests a single JSON response. */
export async function localCompletion(opts: {
  config: LocalAIConfig;
  purpose: 'narrative' | 'memory';
  messages: { role: string; content: string }[];
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  stream?: boolean;
  android?: boolean;
  signal?: AbortSignal;
  onToken?: (full: string) => void;
}): Promise<string> {
  const c = opts.config;
  const model = opts.purpose === 'memory' ? c.memoryModel : c.narrativeModel;
  if (!model.trim()) throw new Error(`Choisis un modèle local pour ${opts.purpose === 'memory' ? 'la mémoire' : 'le récit'}.`);
  const stream = opts.stream !== false && !opts.android;
  const ctl = new AbortController();
  const abort = () => ctl.abort();
  if (opts.signal?.aborted) abort();
  opts.signal?.addEventListener('abort', abort, { once: true });
  // Loading a model on consumer hardware can take minutes; no infinite hanging request.
  const timer = setTimeout(abort, 300000);
  try {
    const base = localBaseUrl(c);
    const openai = c.protocol === 'openai';
    const body = openai ? {
      model, messages: opts.messages, stream,
      temperature: opts.temperature ?? 0.2, max_tokens: opts.maxTokens ?? 4096,
      ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
    } : {
      model, messages: opts.messages, stream, think: false,
      options: { temperature: opts.temperature ?? 0.2, num_predict: opts.maxTokens ?? 4096 },
      ...(opts.json ? { format: 'json' } : {}),
    };
    const res = await checked(await fetch(`${base}${openai ? '/v1/chat/completions' : '/api/chat'}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: ctl.signal,
    }));
    let full = '';
    const event = (s: string) => {
      const line = s.trim();
      if (!line || line.startsWith(':') || line === 'data: [DONE]') return;
      if (openai && !line.startsWith('data:')) return;
      const j = JSON.parse(openai ? line.slice(5).trim() : line);
      if (j.error) throw new Error(typeof j.error === 'string' ? j.error : j.error.message ?? 'Erreur locale');
      const delta = openai ? j.choices?.[0]?.delta?.content : j.message?.content;
      if (typeof delta === 'string') { full += delta; opts.onToken?.(full); }
    };
    if (stream) {
      const reader = res.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        let buffer = '';
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n'); buffer = lines.pop() ?? '';
            for (const line of lines) event(line);
          }
          buffer += decoder.decode();
          if (buffer.trim()) event(buffer);
        } finally { reader.releaseLock(); }
      } else {
        // Non-ReadableStream environments can still receive buffered NDJSON/SSE.
        for (const line of (await res.text()).split('\n')) event(line);
      }
    } else {
      const j = await res.json();
      if (j.error) throw new Error(typeof j.error === 'string' ? j.error : j.error.message ?? 'Erreur locale');
      full = openai ? j.choices?.[0]?.message?.content ?? '' : j.message?.content ?? '';
      opts.onToken?.(full);
    }
    if (!full.trim()) throw new Error('Réponse locale vide (modèle chargé et compatible chat ?).');
    return full;
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', abort);
  }
}
