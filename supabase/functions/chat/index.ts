// Edge Function: /functions/chat — proxies chat messages to Anthropic Claude
// via the official Anthropic TypeScript SDK, with streaming AND a server-side
// tool-use loop: the model can REALLY read GitHub repos (with the user's
// token) and Supabase tables (with the user's JWT, RLS-respected).
//
// Requires the ANTHROPIC_API_KEY secret to be set on this Supabase project:
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// Version ÉPINGLÉE (pas de caret) : un re-résolution ^0.60.0 au
// re-déploiement tirait une version incompatible avec Deno → BOOT_ERROR.
import Anthropic from 'npm:@anthropic-ai/sdk@0.60.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// Keep in sync with constants/config.ts LLM_MODELS on the client.
const SUPPORTED_MODELS = new Set(['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5']);
const DEFAULT_MODEL = 'claude-sonnet-5';

// Adaptive thinking is supported on Opus 5 / Sonnet 5 but not on the older
// Haiku 4.5 tier.
function supportsAdaptiveThinking(model: string): boolean {
  return model !== 'claude-haiku-4-5';
}

const TOOL_LABELS: Record<string, string> = {
  github_list_repos: 'Liste de tes dépôts GitHub',
  github_list_files: 'Lecture de l’arborescence du dépôt GitHub',
  github_read_file: 'Lecture d’un fichier du dépôt GitHub',
  supabase_list_rows: 'Lecture de la base de données du workspace',
  workspace_list_files: 'Navigation dans la bibliothèque du workspace',
  workspace_read_file: 'Lecture dans la bibliothèque du workspace',
  workspace_write_file: 'Écriture dans la bibliothèque du workspace',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      messages,
      model,
      temperature,
      maxTokens,
      topP,
      githubToken,
      enableSupabase,
      enabledTools,
    } = await req.json();

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Anthropic API key not configured. Set ANTHROPIC_API_KEY as a Supabase Edge Function secret.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const anthropic = new Anthropic({ apiKey });
    const requestedModel = SUPPORTED_MODELS.has(model) ? model : DEFAULT_MODEL;

    // Anthropic takes a single top-level `system` string and alternating
    // user/assistant turns — split the incoming OpenAI-style message list.
    const systemMessage = (messages ?? []).find((m: any) => m.role === 'system')?.content ?? '';
    let conversationMessages = (messages ?? [])
      .filter((m: any) => m.role !== 'system')
      .map((m: any) => ({ role: m.role, content: m.content }));

    if (conversationMessages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No user/assistant messages provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sampling params (temperature/top_p) at non-default values are rejected
    // on Opus 5 / Sonnet 5 — only forward them for the Haiku 4.5 tier.
    const samplingParams = requestedModel === 'claude-haiku-4-5'
      ? { temperature: temperature ?? 1, top_p: topP ?? 1 }
      : {};

    // ── Outils RÉELS exécutés côté serveur ─────────────────────────────
    const ghToken = typeof githubToken === 'string' && githubToken.trim()
      ? githubToken.trim()
      : null;
    const ghHeaders: Record<string, string> | null = ghToken
      ? {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${ghToken}`,
          'X-GitHub-Api-Version': '2022-11-28',
        }
      : null;

    // Outils réellement activés par l'utilisateur (toggles du Builder/chat)
    const enabledTools: string[] = Array.isArray(enabledTools)
      ? enabledTools.map(String)
      : [];

    const tools: any[] = [];
    if (ghHeaders) {
      // Découverte spontanée des dépôts (toujours disponible, connecteur GitHub)
      tools.push({
        name: 'github_list_repos',
        description: "Liste les dépôts GitHub de l'utilisateur (privés et publics), un par ligne au format propriétaire/nom avec leur description. Utilise-le pour savoir quels dépôts existent.",
        input_schema: { type: 'object', properties: {} },
      });
      // La lecture des fichiers dépend de l'outil « Lecture de fichiers »
      if (enabledTools.includes('file_read')) {
        tools.push(
          {
            name: 'github_list_files',
            description: "Liste les fichiers d'un dépôt GitHub de l'utilisateur (privés inclus). Renvoie un chemin par ligne. Utilise-le AVANT de lire un fichier si tu ne connais pas son chemin exact.",
            input_schema: {
              type: 'object',
              properties: {
                repo: { type: 'string', description: 'Propriétaire/nom du dépôt, ex: catelyn2332-design/map-interactive' },
                path: { type: 'string', description: 'Préfixe de dossier optionnel pour filtrer la liste' },
                ref: { type: 'string', description: 'Branche ou tag (défaut: main)' },
              },
              required: ['repo'],
            },
          },
          {
            name: 'github_read_file',
            description: "Lit le contenu TEXTE d'un fichier d'un dépôt GitHub de l'utilisateur (privés inclus), 20 000 caractères max.",
            input_schema: {
              type: 'object',
              properties: {
                repo: { type: 'string', description: 'Propriétaire/nom du dépôt' },
                path: { type: 'string', description: 'Chemin complet du fichier, ex: src/main.ts' },
                ref: { type: 'string', description: 'Branche ou tag (défaut: main)' },
              },
              required: ['repo', 'path'],
            },
          },
        );
      }
    }
    if (enableSupabase === true && enabledTools.includes('db_access')) {
      tools.push({
        name: 'supabase_list_rows',
        description: "Lit jusqu'à 50 lignes d'une table du stockage cloud, selon les permissions de l'utilisateur.",
        input_schema: {
          type: 'object',
          properties: {
            table: { type: 'string', description: 'Nom exact de la table' },
            limit: { type: 'number', description: 'Nombre de lignes (1-50, défaut 10)' },
            order: { type: 'string', description: 'Colonne de tri optionnelle (décroissant)' },
          },
          required: ['table'],
        },
      });
    }
    // La BIBLIOTHÈQUE du workspace (dossiers/fichiers de l'application) —
    // lecture ET écriture réelles dans le cloud. Pilotée par l'outil
    // « Accès Base de données » activé par l'utilisateur.
    if (enabledTools.includes('db_access')) {
      tools.push(
        {
          name: 'workspace_list_files',
          description: "Liste l'arborescence de la BIBLIOTHÈQUE du workspace de l'utilisateur (dossiers, sous-dossiers, fichiers).",
          input_schema: {
            type: 'object',
            properties: {
              workspace: { type: 'string', description: 'Nom du workspace (optionnel — défaut : premier workspace)' },
            },
          },
        },
        {
          name: 'workspace_read_file',
          description: "Lit le contenu d'un fichier de la BIBLIOTHÈQUE du workspace (20 000 caractères max).",
          input_schema: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Nom du fichier, ou Dossier/Sous-dossier/fichier' },
              workspace: { type: 'string', description: 'Nom du workspace (optionnel)' },
            },
            required: ['path'],
          },
        },
        {
          name: 'workspace_write_file',
          description: "Crée ou met à jour un fichier de la BIBLIOTHÈQUE du workspace — la modification est réelle et visible par l'utilisateur. Crée les dossiers manquants automatiquement.",
          input_schema: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Chemin : nom du fichier, ou Dossier/Sous-dossier/fichier' },
              content: { type: 'string', description: 'Contenu complet du fichier' },
              workspace: { type: 'string', description: 'Nom du workspace (optionnel)' },
            },
            required: ['path', 'content'],
          },
        },
      );
    }

const userJwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');

// ── Bibliothèque du workspace : lecture/écriture réelle dans user_app_data ──
async function loadWorkspacesData(): Promise<any[]> {
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anon) throw new Error('Supabase non configuré côté serveur');
  const res = await fetch(
    `${url}/rest/v1/user_app_data?select=data&data_type=eq.workspaces`,
    { headers: { apikey: anon, Authorization: `Bearer ${userJwt}` } },
  );
  if (!res.ok) throw new Error(`Lecture du workspace impossible (${res.status})`);
  const rows: any[] = await res.json();
  const row = (rows ?? [])[0];
  if (!row?.data) throw new Error('Aucun workspace sauvegardé');
  return Array.isArray(row.data) ? row.data : [row.data];
}

async function saveWorkspacesData(workspaces: any[]): Promise<void> {
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anon) throw new Error('Supabase non configuré côté serveur');
  // user_id depuis la charge utile du JWT
  const payloadB64 = userJwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const payload = JSON.parse(atob(payloadB64));
  const res = await fetch(`${url}/rest/v1/user_app_data`, {
    method: 'POST',
    headers: {
      apikey: anon,
      Authorization: `Bearer ${userJwt}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify([{
      user_id: payload.sub,
      data_type: 'workspaces',
      data: workspaces,
      updated_at: new Date().toISOString(),
    }]),
  });
  if (!res.ok) throw new Error(`Sauvegarde du workspace impossible (${res.status})`);
}

function resolveWorkspace(workspaces: any[], wanted?: string) {
  if (wanted) {
    const byName = workspaces.find(w => String(w.name ?? '').toLowerCase() === wanted.toLowerCase() || w.id === wanted);
    if (byName) return byName;
  }
  return workspaces[0];
}

async function executeTool(name: string, input: any): Promise<string> {
      if (name === 'github_list_repos') {
        if (!ghHeaders) throw new Error('Connecteur GitHub non connecté');
        const res = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', { headers: ghHeaders });
        if (!res.ok) throw new Error(`GitHub API ${res.status}`);
        const repos: any[] = await res.json();
        return repos
          .map((r: any) => `${r.full_name}${r.private ? ' (privé)' : ''} — ${r.description ?? 'sans description'}`)
          .slice(0, 50)
          .join('\n');
      }
      if (name === 'github_list_files') {
        if (!ghHeaders) throw new Error('Connecteur GitHub non connecté');
        const [owner, repo] = String(input.repo ?? '').split('/');
        if (!owner || !repo) throw new Error('repo doit être au format propriétaire/nom');
        const ref = encodeURIComponent(String(input.ref ?? 'main'));
        const prefix = input.path ? String(input.path).replace(/^\/+|\/+$/g, '') : '';
        const res = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`,
          { headers: ghHeaders },
        );
        if (!res.ok) throw new Error(`GitHub API ${res.status}`);
        const data: any = await res.json();
        const paths = (data.tree ?? [])
          .filter((e: any) => e.type === 'blob' && (!prefix || e.path.startsWith(prefix + '/')))
          .map((e: any) => e.path)
          .slice(0, 300);
        return paths.length ? paths.join('\n') : '(aucun fichier)';
      }
      if (name === 'github_read_file') {
        if (!ghHeaders && !ghToken) throw new Error('Connecteur GitHub non connecté');
        const [owner, repo] = String(input.repo ?? '').split('/');
        const ref = encodeURIComponent(String(input.ref ?? 'main'));
        const p = String(input.path ?? '').replace(/^\/+/, '');
        if (!owner || !repo || !p) throw new Error('repo et path sont requis');
        const res = await fetch(
          `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${p}`,
          { headers: ghToken ? { Authorization: `Bearer ${ghToken}` } : {} },
        );
        if (!res.ok) throw new Error(`Fichier illisible (${res.status})`);
        return (await res.text()).slice(0, 20_000);
      }
      if (name === 'supabase_list_rows') {
        const url = Deno.env.get('SUPABASE_URL');
        const anon = Deno.env.get('SUPABASE_ANON_KEY');
        if (!url || !anon) throw new Error('Supabase non configuré côté serveur');
        const limit = Math.min(Math.max(Number(input.limit) || 10, 1), 50);
        const table = encodeURIComponent(String(input.table ?? ''));
        const order = input.order ? `&order=${encodeURIComponent(String(input.order))}.desc` : '';
        const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=${limit}${order}`, {
          headers: {
            apikey: anon,
            Authorization: userJwt ? `Bearer ${userJwt}` : `Bearer ${anon}`,
          },
        });
        if (!res.ok) throw new Error(`Lecture impossible (${res.status}) — table inconnue ou permissions insuffisantes`);
        return JSON.stringify(await res.json(), null, 1).slice(0, 20_000);
      }
      if (name === 'workspace_list_files') {
        const workspaces = await loadWorkspacesData();
        const ws = resolveWorkspace(workspaces, input.workspace);
        if (!ws?.database) throw new Error('Workspace introuvable ou sans bibliothèque');
        const lines: string[] = [`Workspace : ${ws.name}`];
        const rootFiles: any[] = ws.database.rootFiles ?? [];
        lines.push(`${rootFiles.length} fichier(s) à la racine :`);
        for (const f of rootFiles) lines.push(`- ${f.name}`);
        const walk = (subs: any[], prefix: string) => {
          for (const s of subs) {
            lines.push(`[dossier] ${prefix}${s.name}/ (${s.files.length} fichier(s))`);
            for (const f of s.files) lines.push(`  - ${prefix}${s.name}/${f.name}`);
            walk(s.subFolders ?? [], `${prefix}${s.name}/`);
          }
        };
        walk(ws.database.folders ?? [], '');
        return lines.slice(0, 400).join('\n');
      }
      if (name === 'workspace_read_file') {
        const workspaces = await loadWorkspacesData();
        const ws = resolveWorkspace(workspaces, input.workspace);
        if (!ws?.database) throw new Error('Workspace introuvable');
        const fileName = String(input.path ?? '').replace(/^\/+/, '').toLowerCase();
        const all: any[] = [
          ...(ws.database.rootFiles ?? []),
          ...(ws.database.folders ?? []).flatMap((f: any) => [
            ...f.files,
            ...(f.subFolders ?? []).flatMap((s: any) => [
              ...s.files,
              ...(s.subFolders ?? []).flatMap((ss: any) => ss.files),
            ]),
          ]),
        ];
        const file = all.find(f => String(f.name).toLowerCase() === fileName)
          ?? all.find(f => String(f.name).toLowerCase().endsWith('/' + fileName))
          ?? all.find(f => String(f.name).toLowerCase().endsWith(fileName));
        if (!file) throw new Error(`Fichier « ${input.path} » introuvable dans la bibliothèque — utilise workspace_list_files pour voir les noms exacts`);
        return `Fichier : ${file.name}\n\n${file.content || '(vide)'}`.slice(0, 20_000);
      }
      if (name === 'workspace_write_file') {
        const workspaces = await loadWorkspacesData();
        const ws = resolveWorkspace(workspaces, input.workspace);
        if (!ws?.database) throw new Error('Workspace introuvable');
        const segments = String(input.path ?? '').split('/').map((s: string) => s.trim()).filter(Boolean);
        if (segments.length === 0) throw new Error('Chemin requis');
        const fileName = segments.pop()!;
        const now = new Date().toISOString();
        // navigate/crée les dossiers par nom, à toute profondeur
        if (!ws.database.folders) ws.database.folders = [];
        let nodes: any[] = ws.database.folders;
        for (const seg of segments) {
          let node = nodes.find((n: any) => String(n.name).toLowerCase() === seg.toLowerCase());
          if (!node) {
            node = {
              id: `folder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              name: seg, icon: 'folder', color: '#3D7EFF', description: '',
              files: [], subFolders: [], createdAt: now,
            };
            nodes.push(node);
          }
          if (!node.subFolders) node.subFolders = [];
          nodes = node.subFolders;
        }
        const existing = nodes.find((f: any) => String(f.name).toLowerCase() === fileName.toLowerCase());
        const content = String(input.content ?? '');
        if (existing) {
          existing.content = content;
          existing.size = content.length;
          existing.updatedAt = now;
        } else {
          nodes.push({
            id: `file-ia-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            name: fileName, type: 'note', content, tags: ['ia'],
            size: content.length, createdAt: now, updatedAt: now,
          });
        }
        await saveWorkspacesData(workspaces);
        return `Fichier « ${fileName} » enregistré dans la bibliothèque du workspace « ${ws.name} »${segments.length ? ` (dossier ${segments.join('/')})` : ' (racine)'}.`;
      }
      throw new Error(`Outil inconnu : ${name}`);
    }

    const encoder = new TextEncoder();
    const body = new ReadableStream({
      async start(controller) {
        const send = (obj: any) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        try {
          let done = false;
          // Boucle d'outils : chaque tour peut se terminer par des tool_use,
          // exécutés côté serveur puis renvoyés au modèle (4 tours max).
          for (let round = 0; round < 4 && !done; round++) {
            const stream = anthropic.messages.stream({
              model: requestedModel,
              max_tokens: Math.min(Math.max(Math.round(maxTokens ?? 4096), 1), 8192),
              system: systemMessage,
              messages: conversationMessages,
              ...(tools.length ? { tools } : {}),
              ...(supportsAdaptiveThinking(requestedModel) ? { thinking: { type: 'adaptive' } } : {}),
              ...samplingParams,
            });

            for await (const event of stream) {
              if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                send({ delta: event.delta.text });
              }
            }
            const final = await stream.finalMessage();

            if (final.stop_reason !== 'tool_use') {
              done = true;
              break;
            }

            conversationMessages.push({ role: 'assistant', content: final.content });
            const toolResults: any[] = [];
            for (const block of final.content) {
              if (block.type !== 'tool_use') continue;
              let output: string;
              try {
                output = await executeTool(block.name, block.input);
              } catch (toolError: any) {
                output = `Erreur: ${toolError?.message ?? 'échec de l’outil'}`;
              }
              // Notifié APRÈS exécution : pour workspace_write_file, le client
              // recharge alors la bibliothèque depuis le cloud (déjà sauvegardé).
              send({ toolEvent: `${TOOL_LABELS[block.name] ?? block.name}…` });
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: String(output).slice(0, 30_000),
              });
            }
            if (toolResults.length > 0) {
              conversationMessages.push({ role: 'user', content: toolResults });
            } else {
              done = true;
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } catch (streamError: any) {
          console.error('[chat] Stream error:', streamError);
          send({ error: streamError?.message ?? 'Stream failed' });
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (e: any) {
    console.error('[chat] Unexpected error:', e);
    return new Response(
      JSON.stringify({ error: e?.message ?? 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
