// agentClientTools — OUTILS RÉELS exécutés CÔTÉ CLIENT (navigateur / app).
//
// La fonction Edge déployée est un proxy minimaliste (tout re-déploiement avec
// dépendances plantait au boot — cf. historique BOOT_ERROR) : les outils
// d'écriture dans la bibliothèque, d'exécution de code et de lecture GitHub
// tournent donc DANS L'APP, sans serveur.
//
// Protocole en 2 tours :
//  1. L'IA écrit dans sa réponse un ou plusieurs marqueurs :
//       [OUTIL:nom:{"paramètre":"valeur"}]
//  2. chat.tsx parse ces marqueurs, exécute chaque outil ICI, ajoute un
//     message [RÉSULTATS D'OUTILS] à la conversation puis relance l'IA
//     (3 tours maximum, garde-fou anti-boucle).
//
// Le prompt système décrit ce protocole dans agentCapabilities.ts (honnêteté :
// l'IA ne promet que ce qui est réellement exécutable).
import type { Workspace, DBFile, DBFolder, DBSubFolder, FileLocation } from '@/contexts/WorkspaceContext';

// ─── Parse des marqueurs ─────────────────────────────────────────────────────

export interface ClientToolCall {
  name: string;
  args: any;
  /** Texte complet du marqueur, pour le retirer du message affiché */
  raw: string;
}

/** Parse tous les marqueurs [OUTIL:nom:{json}] d'un texte (JSON à accolades
 *  équilibrées, chaînes échappées supportées — un « contenu » de fichier
 *  contient des accolades et des \n). */
export function parseToolCalls(text: string): ClientToolCall[] {
  const calls: ClientToolCall[] = [];
  const re = /\[OUTIL:([a-zA-Z_]+):/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    let i = re.lastIndex;
    while (text[i] === ' ') i++;
    if (text[i] !== '{') continue;
    const start = i;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (; i < text.length; i++) {
      const ch = text[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
      } else if (ch === '"') inStr = true;
      else if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) { i++; break; }
      }
    }
    if (depth !== 0) break; // JSON tronqué (stream coupé) : on ignore
    const argsRaw = text.slice(start, i);
    let args: any = null;
    try {
      args = JSON.parse(argsRaw);
    } catch {
      // JSON invalide : cas très fréquent = retours à la ligne RÉELS dans une
      // chaîne (le modèle écrit du contenu multi-lignes sans les échapper).
      // On répare en échappant les caractères de contrôle dans les chaînes.
      args = tryParseRepaired(argsRaw);
    }
    if (args === null) {
      re.lastIndex = i;
      continue; // marqueur inexploitable : suivant
    }
    const end = text[i] === ']' ? i + 1 : i; // englobe le « ] » fermant
    calls.push({ name: m[1], args, raw: text.slice(m.index, end) });
    re.lastIndex = end;
  }
  return calls;
}

/** Tente JSON.parse après échappement des \n \r \t réels situés dans les chaînes. */
function tryParseRepaired(s: string): any {
  let out = '';
  let inStr = false;
  let esc = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) { esc = false; out += ch; continue; }
      if (ch === '\\') { esc = true; out += ch; continue; }
      if (ch === '"') { inStr = false; out += ch; continue; }
      if (ch === '\n') { out += '\\n'; continue; }
      if (ch === '\r') { out += '\\r'; continue; }
      if (ch === '\t') { out += '\\t'; continue; }
      out += ch;
      continue;
    }
    if (ch === '"') inStr = true;
    out += ch;
  }
  try {
    return JSON.parse(out);
  } catch {
    return null;
  }
}

/** Retire les marqueurs d'outils du texte affiché à l'utilisateur. */
export function stripToolCalls(text: string, calls: ClientToolCall[]): string {
  let out = text;
  for (const c of calls) out = out.replace(c.raw, '');
  return out.replace(/\[OUTIL:[a-zA-Z_]+:\{[\s\S]*?\}\]/g, '').trim();
}

// ─── Sandbox JavaScript (Web Worker) ─────────────────────────────────────────

export interface JsRunResult {
  logs: string[];
  error: string | null;
  result: string | null;
  timedOut: boolean;
}

/** Exécute du JS dans un Web Worker isolé (pas d'accès DOM/réseau applicatif),
 *  console capturée, timeout 10 s. Web uniquement. */
export function runJsSandbox(code: string, timeoutMs = 10_000): Promise<JsRunResult> {
  return new Promise(resolve => {
    if (typeof Worker === 'undefined' || typeof Blob === 'undefined') {
      resolve({ logs: [], error: 'Exécution de code disponible uniquement sur la version web.', result: null, timedOut: false });
      return;
    }
    const src = `
      const __send = (kind, payload) => postMessage({ kind, payload: String(payload) });
      const __fmt = (a) => a.map(x => {
        try { return typeof x === 'object' ? JSON.stringify(x, null, 2) : String(x); }
        catch { return String(x); }
      }).join(' ');
      self.console = {
        log: (...a) => __send('log', __fmt(a)),
        info: (...a) => __send('log', __fmt(a)),
        warn: (...a) => __send('warn', __fmt(a)),
        error: (...a) => __send('error', __fmt(a)),
      };
      self.onerror = (m) => { __send('error', m); return true; };
      (async () => {
        ${code}
      })().then(r => __send('done', r === undefined ? '(terminé, sans valeur de retour)' : (typeof r === 'object' ? JSON.stringify(r, null, 2) : String(r))))
        .catch(e => __send('error', (e && e.message) ? e.message : String(e)));
    `;
    let worker: Worker;
    try {
      worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'application/javascript' })));
    } catch (e: any) {
      resolve({ logs: [], error: `Impossible de créer le sandbox : ${e?.message ?? e}`, result: null, timedOut: false });
      return;
    }
    const logs: string[] = [];
    let error: string | null = null;
    let result: string | null = null;
    const timer = setTimeout(() => {
      worker.terminate();
      resolve({ logs, error, result, timedOut: true });
    }, timeoutMs);
    worker.onmessage = (ev: MessageEvent) => {
      const { kind, payload } = ev.data ?? {};
      if (kind === 'log' || kind === 'warn') logs.push(payload);
      else if (kind === 'error') error = error ? `${error}\n${payload}` : payload;
      else if (kind === 'done') result = payload;
    };
    worker.onerror = (ev) => {
      if (!error) error = ev.message || 'Erreur dans le sandbox';
    };
    // Fini dès qu'on a un résultat OU une erreur bloquante (petit délai pour
    // laisser arriver d'éventuels derniers logs).
    const finishCheck = setInterval(() => {
      if (result !== null || error !== null) {
        clearInterval(finishCheck);
        clearTimeout(timer);
        worker.terminate();
        setTimeout(() => resolve({ logs, error, result, timedOut: false }), 30);
      }
    }, 25);
  });
}

// ─── Manipulation de la bibliothèque ─────────────────────────────────────────

const MAX_WRITE_CHARS = 200_000;
const MAX_READ_CHARS = 30_000;

type WsActions = {
  updateFile: (wid: string, loc: FileLocation, fileId: string, updates: Partial<DBFile>) => void;
  addFile: (wid: string, loc: FileLocation, file: Omit<DBFile, 'id' | 'createdAt' | 'updatedAt' | 'size'>) => void;
  addSubFolder: (wid: string, folderId: string, sub: Omit<DBSubFolder, 'id' | 'files' | 'createdAt'>, parentSubId?: string) => string;
};

function inferFileType(name: string): DBFile['type'] {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'md' || ext === 'markdown') return 'markdown';
  if (ext === 'json') return 'json';
  if (ext === 'txt' || ext === 'csv' || ext === 'log') return 'text';
  return 'code';
}

interface FoundFile { file: DBFile; loc: FileLocation }

/** Recherche un fichier par chemin relatif (nom exact, puis suffixe unique). */
export function findFileByPath(ws: Workspace, chemin: string): FoundFile | null {
  const clean = chemin.replace(/^\/+/, '').trim();
  if (!clean) return null;
  const all: FoundFile[] = [
    ...ws.database.rootFiles.map(f => ({ file: f, loc: null as FileLocation })),
    ...ws.database.folders.flatMap((f: DBFolder): FoundFile[] => [
      ...f.files.map(file => ({ file, loc: f.id as FileLocation })),
      ...collectSubFiles(f.id, f.subFolders ?? []),
    ]),
  ];
  // 1) nom exact ou path exact
  const exact = all.filter(x => x.file.name === clean || x.file.path === clean);
  if (exact.length === 1) return exact[0];
  // 2) suffixe unique (le modèle omet parfois le préfixe du dépôt)
  const suffix = all.filter(x => x.file.name.endsWith(`/${clean}`) || x.file.path?.endsWith(`/${clean}`));
  if (suffix.length === 1) return suffix[0];
  return exact[0] ?? suffix[0] ?? null;
}

function collectSubFiles(folderId: string, subs: DBSubFolder[]): FoundFile[] {
  return subs.flatMap((s): FoundFile[] => [
    ...s.files.map(file => ({ file, loc: { folderId, subId: s.id } as FileLocation })),
    ...collectSubFiles(folderId, s.subFolders ?? []),
  ]);
}

export interface ToolOutcome {
  ok: boolean;
  /** Courte ligne pour le flux d'activités et les résultats renvoyés à l'IA */
  summary: string;
  /** Détail complet renvoyé à l'IA (contenu lu, logs d'exécution…) */
  detail: string;
}

/** Exécute un outil client. Retourne un résultat structuré pour la boucle chat. */
export async function executeClientTool(
  call: ClientToolCall,
  ws: Workspace,
  actions: WsActions,
): Promise<ToolOutcome> {
  switch (call.name) {
    case 'lire_fichier':
      return toolReadFile(call.args, ws);
    case 'ecrire_fichier':
      return toolWriteFile(call.args, ws, actions);
    case 'executer_js':
      return await toolExecJs(call.args);
    case 'lire_fichier_github':
      return await toolReadGithub(call.args);
    default:
      return { ok: false, summary: `Outil inconnu : ${call.name}`, detail: `L'outil « ${call.name} » n'existe pas. Outils disponibles : lire_fichier, ecrire_fichier, executer_js, lire_fichier_github.` };
  }
}

function toolReadFile(args: any, ws: Workspace): ToolOutcome {
  const chemin = String(args?.chemin ?? '').trim();
  if (!chemin) return { ok: false, summary: 'lire_fichier : chemin manquant', detail: 'Paramètre « chemin » obligatoire.' };
  const found = findFileByPath(ws, chemin);
  if (!found) {
    return { ok: false, summary: `Fichier introuvable : ${chemin}`, detail: `Aucun fichier « ${chemin} » dans la bibliothèque. Vérifie l'inventaire exact dans BIBLIOTHÈQUE DU WORKSPACE.` };
  }
  const content = found.file.content;
  const truncated = content.length > MAX_READ_CHARS;
  return {
    ok: true,
    summary: `Lu ${found.file.name} (${content.length} car.)`,
    detail: `Contenu de ${found.file.name} :\n${truncated ? content.slice(0, MAX_READ_CHARS) + '\n[… tronqué]' : content}`,
  };
}

function toolWriteFile(args: any, ws: Workspace, actions: WsActions): ToolOutcome {
  const chemin = String(args?.chemin ?? '').trim().replace(/^\/+/, '');
  const contenu = String(args?.contenu ?? '');
  if (!chemin) return { ok: false, summary: 'ecrire_fichier : chemin manquant', detail: 'Paramètre « chemin » obligatoire.' };
  if (chemin.includes('..')) return { ok: false, summary: 'ecrire_fichier : chemin invalide', detail: 'Le chemin ne doit pas contenir « .. ».' };
  if (contenu.length > MAX_WRITE_CHARS) return { ok: false, summary: 'ecrire_fichier : contenu trop long', detail: `Contenu limité à ${MAX_WRITE_CHARS} caractères (reçu ${contenu.length}). Écris le fichier en plusieurs étapes ou raccourcis-le.` };

  const wid = ws.id;
  const existing = findFileByPath(ws, chemin);
  if (existing) {
    actions.updateFile(wid, existing.loc, existing.file.id, {
      content: contenu,
      size: contenu.length,
      updatedAt: new Date(),
    });
    return { ok: true, summary: `Modifié ${existing.file.name} (${contenu.length} car.)`, detail: `Fichier ${existing.file.name} modifié (ancien contenu remplacé, ${contenu.length} caractères).` };
  }

  // Création : sous le dossier existant correspondant au 1er segment si présent,
  // sinon à la racine. Les sous-dossiers intermédiaires sont créés au besoin.
  const segments = chemin.split('/').map(s => s.trim()).filter(Boolean);
  const fileName = segments.pop() as string;
  let loc: FileLocation = null;
  const rootFolder = segments.length > 0
    ? ws.database.folders.find(f => f.name === segments[0])
    : undefined;
  if (rootFolder) {
    loc = rootFolder.id;
    let subs = rootFolder.subFolders ?? [];
    for (const seg of segments.slice(1)) {
      let sub = subs.find(s => s.name === seg);
      if (!sub) {
        const id = actions.addSubFolder(wid, rootFolder.id, {
          name: seg, icon: 'folder', color: '#8899BB', description: '',
        });
        sub = { id, name: seg, icon: 'folder', color: '#8899BB', description: '', files: [], subFolders: [], createdAt: new Date() } as DBSubFolder;
      }
      loc = { folderId: rootFolder.id, subId: sub.id };
      subs = sub.subFolders ?? [];
    }
  }
  actions.addFile(wid, loc, {
    name: chemin, // chemin relatif complet, comme les imports de dépôts
    type: inferFileType(fileName),
    content: contenu,
    tags: ['agent'],
  });
  return { ok: true, summary: `Créé ${chemin} (${contenu.length} car.)`, detail: `Fichier ${chemin} créé dans la bibliothèque (${contenu.length} caractères).` };
}

async function toolExecJs(args: any): Promise<ToolOutcome> {
  const code = String(args?.code ?? '').trim();
  if (!code) return { ok: false, summary: 'executer_js : code manquant', detail: 'Paramètre « code » obligatoire.' };
  if (code.length > 20_000) return { ok: false, summary: 'executer_js : code trop long', detail: 'Code limité à 20 000 caractères.' };
  const r = await runJsSandbox(code);
  const parts: string[] = [];
  if (r.logs.length > 0) parts.push(`Console :\n${r.logs.join('\n')}`);
  if (r.result !== null) parts.push(`Valeur de retour : ${r.result}`);
  if (r.error) parts.push(`ERREUR : ${r.error}`);
  if (r.timedOut) parts.push('TIMEOUT : exécution interrompue après 10 s (boucle infinie ?).');
  if (parts.length === 0) parts.push('(aucune sortie — ajoute des console.log pour observer)');
  return {
    ok: !r.error && !r.timedOut,
    summary: r.error ? `JS en erreur : ${r.error.slice(0, 60)}` : 'JS exécuté',
    detail: parts.join('\n'),
  };
}

/** Lecture d'un fichier GitHub via le CDN raw SANS jeton (sans limite de taux,
 *  CORS ouvert — cf. import des dépôts). Repli API Contents avec jeton (privé). */
async function toolReadGithub(args: any): Promise<ToolOutcome> {
  const depot = String(args?.depot ?? '').trim().replace(/^\/+|\/+$/g, '');
  const chemin = String(args?.chemin ?? '').trim().replace(/^\/+/, '');
  const branche = String(args?.branche ?? 'main').trim() || 'main';
  if (!depot || !depot.includes('/')) return { ok: false, summary: 'lire_fichier_github : dépôt invalide', detail: 'Paramètre « depot » au format « propriétaire/nom » obligatoire.' };
  if (!chemin) return { ok: false, summary: 'lire_fichier_github : chemin manquant', detail: 'Paramètre « chemin » obligatoire.' };
  const enc = chemin.split('/').map(p => encodeURIComponent(p)).join('/');
  try {
    const raw = await fetch(`https://raw.githubusercontent.com/${depot}/${encodeURIComponent(branche)}/${enc}`);
    if (raw.ok) {
      const content = await raw.text();
      const truncated = content.length > MAX_READ_CHARS;
      return {
        ok: true,
        summary: `Lu ${depot}/${chemin} (GitHub)`,
        detail: `Contenu de ${depot}/${chemin} (branche ${branche}) :\n${truncated ? content.slice(0, MAX_READ_CHARS) + '\n[… tronqué]' : content}`,
      };
    }
    // Repli : API Contents (nécessite un jeton pour un dépôt privé)
    const tokenHeader: Record<string, string> = args?.token ? { Authorization: `Bearer ${String(args.token)}` } : {};
    const api = await fetch(`https://api.github.com/repos/${depot}/contents/${enc}?ref=${encodeURIComponent(branche)}`, { headers: tokenHeader });
    if (api.ok) {
      const data: any = await api.json();
      const content = atob(String(data.content ?? '').replace(/\n/g, ''));
      return { ok: true, summary: `Lu ${depot}/${chemin} (GitHub)`, detail: `Contenu de ${depot}/${chemin} :\n${content.slice(0, MAX_READ_CHARS)}` };
    }
    return {
      ok: false,
      summary: `GitHub ${api.status} : ${depot}/${chemin}`,
      detail: api.status === 404
        ? `Fichier ou dépôt introuvable (${depot}/${chemin}, branche ${branche}). Pour un dépôt privé, connecte un jeton GitHub (Builder ▸ Connecteurs).`
        : `GitHub API ${api.status} — impossible de lire ${depot}/${chemin}.`,
    };
  } catch (e: any) {
    return { ok: false, summary: `Erreur réseau GitHub`, detail: `Lecture de ${depot}/${chemin} impossible : ${e?.message ?? 'erreur inconnue'}` };
  }
}

// ─── Formatage des résultats pour le tour suivant ────────────────────────────

export function formatToolResults(outcomes: { call: ClientToolCall; outcome: ToolOutcome }[]): string {
  const lines = outcomes.map(({ call, outcome }) => `▸ ${call.name} → ${outcome.summary}`);
  const details = outcomes.map(({ call, outcome }, i) => `--- Résultat ${i + 1} (${call.name}) ---\n${outcome.detail}`);
  return [
    `[RÉSULTATS D'OUTILS — exécutés automatiquement par l'application]`,
    ...lines,
    '',
    ...details,
    '',
    `Continue maintenant : utilise ces résultats pour ta réponse (corrige le code si ERREUR, vérifie avec executer_js si besoin). N'écris plus de marqueur [OUTIL:…] si tu as fini.`,
  ].join('\n');
}
