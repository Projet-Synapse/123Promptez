/**
 * Parsing JSON tolérant pour les réponses LLM (passe mémoire Simulation).
 * Gère : fences ```json, texte autour, virgules finales, commentaires,
 * guillemets typographiques structurels, sortie SSE brute, JSON tronqué.
 */

/** Texte SSE brut (`data: {"delta":"…"}`) → texte concaténé. null si ce n’est pas du SSE. */
export function textFromSse(raw: string): string | null {
  if (!/^\s*data:\s/m.test(raw)) return null;
  let out = '';
  let any = false;
  for (const line of raw.replace(/\r\n/g, '\n').split('\n')) {
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;
    try {
      const j = JSON.parse(payload);
      if (typeof j.delta === 'string') { out += j.delta; any = true; }
      else if (typeof j.error === 'string') throw new Error(j.error);
    } catch (e: any) {
      if (e?.message && !/JSON|Unexpected|token/i.test(e.message)) throw e;
    }
  }
  return any ? out : null;
}

/** Premier objet {…} équilibré (en respectant les chaînes). Renvoie aussi s’il est complet. */
function firstBalancedObject(s: string): { text: string; complete: boolean } | null {
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') {
      depth--;
      if (depth === 0) return { text: s.slice(start, i + 1), complete: true };
    }
  }
  return { text: s.slice(start), complete: false };
}

/** Réparations hors chaînes : commentaires, virgules finales, guillemets typographiques structurels. */
function repair(s: string): string {
  let out = '';
  let inStr = false;
  let smart = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    let c = s[i];
    if (inStr) {
      if (smart && (c === '”' || c === '“')) { out += '"'; inStr = false; continue; }
      if (smart && c === '"') { out += '\\"'; continue; }
      out += c;
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      else if (c === '\n') out = out.slice(0, -1) + '\\n';
      continue;
    }
    if (c === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
    if (c === '/' && s[i + 1] === '*') { const j = s.indexOf('*/', i + 2); i = j < 0 ? s.length : j + 1; continue; }
    smart = false;
    if (c === '“' || c === '”' || c === '„') { c = '"'; smart = true; }
    if (c === '"') inStr = true;
    out += c;
  }
  return out.replace(/,\s*([}\]])/g, '$1');
}

/** Ferme un JSON tronqué (chaîne ouverte, crochets/accolades) en coupant le dernier élément incomplet. */
function closeTruncated(s: string): string {
  const stack: string[] = [];
  let inStr = false;
  let esc = false;
  let lastSafe = -1; // position après le dernier élément complet
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') stack.push(c === '{' ? '}' : ']');
    else if (c === '}' || c === ']') { stack.pop(); lastSafe = i + 1; }
    else if (c === ',') lastSafe = i;
  }
  let cut = lastSafe > 0 ? s.slice(0, lastSafe) : s;
  cut = cut.replace(/,\s*$/, '');
  // Recalcule la pile sur la version coupée
  const st: string[] = [];
  inStr = false; esc = false;
  for (const c of cut) {
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '{' || c === '[') st.push(c === '{' ? '}' : ']');
    else if (c === '}' || c === ']') st.pop();
  }
  if (inStr) cut += '"';
  return cut + st.reverse().join('');
}

export type LlmJsonResult = { value: any; truncated: boolean } | null;

export function parseLlmJson(text: string): LlmJsonResult {
  let raw = String(text ?? '').replace(/^\uFEFF/, '').trim();
  if (!raw) return null;
  const sse = textFromSse(raw);
  if (sse !== null) raw = sse.trim();
  const fence = raw.match(/```(?:json|JSON)?\s*([\s\S]*?)(?:```|$)/);
  const candidates = [fence ? fence[1] : null, raw].filter(Boolean) as string[];
  for (const cand of candidates) {
    try { const v = JSON.parse(cand); if (v && typeof v === 'object') return { value: v, truncated: false }; } catch { /* suite */ }
    const obj = firstBalancedObject(cand);
    if (!obj) continue;
    const fixed = repair(obj.text);
    try { return { value: JSON.parse(fixed), truncated: false }; } catch { /* suite */ }
    if (!obj.complete) {
      try { return { value: JSON.parse(repair(closeTruncated(obj.text))), truncated: true }; } catch { /* suite */ }
      try { return { value: JSON.parse(closeTruncated(fixed)), truncated: true }; } catch { /* suite */ }
    }
  }
  return null;
}
