// Edge Function: /functions/chat — route les messages vers l'API Anthropic
// Claude avec streaming ET une boucle d'outils exécutée côté serveur.
//
// SANS SDK : appel direct en fetch + parsing SSE — aucun npm: import, le boot
// ne peut plus échouer sur une dépendance. Version épinglée par ce fichier.
//
// Requiert le secret ANTHROPIC_API_KEY sur le projet Supabase :
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

const SUPPORTED_MODELS = new Set(['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5']);
const DEFAULT_MODEL = 'claude-sonnet-5';
const MAX_TOOL_ROUNDS = 4;
const TOOL_RESULT_CAP = 30_000;

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
      maxTokens,
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

    const requestedModel = SUPPORTED_MODELS.has(model) ? model : DEFAULT_MODEL;

    const systemMessage = (messages ?? []).find((m: any) => m.role === 'system')?.content ?? '';
    const conversationMessages = (messages ?? [])
      .filter((m: any) => m.role !== 'system')
      .map((m: any) => ({ role: m.role, content: m.content }));

    if (conversationMessages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No user/assistant messages provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    const enabledTools: string[] = Array.isArray(enabledTools)
      ? enabledTools.map(String)
      : [];

    const tools: any[] = [];
    if (ghHeaders) {
      tools.push({
        name: 'github_list_repos',
        description: "Liste les dépôts GitHub de l'utilisateur (privés et publics), un par ligne au format propriétaire/nom avec leur description. Utilise-le pour savoir quels dépôts existent.",
        input_schema: { type: 'object', properties: {} },
      });
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
    // lecture ET écriture réelles dans le cloud, pilotée par « Accès Base de
    // données ».
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

    // ── Exécution des outils ───────────────────────────────────────────
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
        if (!ghToken) throw new Error('Connecteur GitHub non connecté');
        const [owner, repo] = String(input.repo ?? '').split('/');
        const ref = encodeURIComponent(String(input.ref ?? 'main'));
        const p = String(input.path ?? '').replace(/^\/+/, '');
        if (!owner || !repo || !p) throw new Error('repo et path sont requis');
        const res = await fetch(
          `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${p}`,
          { headers: { Authorization: `Bearer ${ghToken}` } },
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

    // ── Boucle d'outils en streaming SSE brut ──────────────────────────
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      async start(controller) {
        const send = (obj: any) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
        try {
          let convo = conversationMessages.slice();
          let done = false;

          for (let round = 0; round < MAX_TOOL_ROUNDS && !done; round++) {
            const apiRes = await fetch(ANTHROPIC_URL, {
              method: 'POST',
              headers: {
                'x-api-key': apiKey,
                'anthropic-version': ANTHROPIC_VERSION,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: requestedModel,
                max_tokens: Math.min(Math.max(Math.round(maxTokens ?? 4096), 1), 8192),
                system: systemMessage,
                messages: convo,
                ...(tools.length ? { tools } : {}),
                ...(supportsAdaptiveThinking(requestedModel) ? { thinking: { type: 'adaptive' } } : {}),
                stream: true,
              }),
            });
            if (!apiRes.ok || !apiRes.body) {
              const t = await apiRes.text().catch(() => '');
              throw new Error(`Anthropic ${apiRes.status}: ${t.slice(0, 200)}`);
            }

            // Streaming SSE d'Anthropic : texte transmis en direct, tool_use accumulé
            const reader = apiRes.body.getReader();
            const decoder = new TextDecoder();
            let buf = '';
            let stopReason: string | null = null;
            const blocks: any[] = []; // {type:'text',text} | {type:'tool_use',id,name,json}
            let current: any = null;

            while (true) {
              const { done: rd, value } = await reader.read();
              if (rd) break;
              buf += decoder.decode(value, { stream: true });
              const parts = buf.split('\n\n');
              buf = parts.pop() ?? '';
              for (const part of parts) {
                for (const line of part.split('\n')) {
                  if (!line.startsWith('data: ')) continue;
                  let ev: any;
                  try { ev = JSON.parse(line.slice(6)); } catch { continue; }
                  if (ev.type === 'content_block_start') {
                    current = ev.index;
                    if (ev.content_block.type === 'tool_use') {
                      blocks[ev.index] = { type: 'tool_use', id: ev.content_block.id, name: ev.content_block.name, json: '' };
                    } else {
                      blocks[ev.index] = { type: 'text', text: '' };
                    }
                  } else if (ev.type === 'content_block_delta') {
                    if (ev.delta.type === 'text_delta') {
                      send({ delta: ev.delta.text });
                      if (blocks[ev.index]) blocks[ev.index].text += ev.delta.text;
                    } else if (ev.delta.type === 'input_json_delta' && blocks[ev.index]) {
                      blocks[ev.index].json += ev.delta.partial_json;
                    }
                  } else if (ev.type === 'message_delta' && ev.delta?.stop_reason) {
                    stopReason = ev.delta.stop_reason;
                  }
                }
              }
            }

            const toolUses = blocks.filter(b => b.type === 'tool_use');
            if (stopReason !== 'tool_use' || toolUses.length === 0) {
              done = true;
              break;
            }

            // L'assistant a demandé des outils : exécution + résultats
            convo.push({
              role: 'assistant',
              content: blocks
                .filter(b => b.type === 'tool_use')
                .map(b => ({ type: 'tool_use', id: b.id, name: b.name, input: safeJson(b.json) })),
            });
            const toolResults: any[] = [];
            for (const tu of toolUses) {
              const label = `${TOOL_LABELS[tu.name] ?? tu.name}…`;
              send({ toolEvent: label });
              let output: string;
              try {
                output = await executeTool(tu.name, tu.input);
              } catch (toolError: any) {
                output = `Erreur: ${toolError?.message ?? 'échec de l’outil'}`;
              }
              toolResults.push({
                type: 'tool_result',
                tool_use_id: tu.id,
                content: String(output).slice(0, TOOL_RESULT_CAP),
              });
            }
            convo.push({ role: 'user', content: toolResults });
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

function safeJson(s: string): any {
  try { return s ? JSON.parse(s) : {}; } catch { return {}; }
}
