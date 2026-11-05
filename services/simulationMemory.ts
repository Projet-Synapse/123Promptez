/**
 * Génération / MAJ de la mémoire Simulation.
 * - Seed local depuis worldbuilding (sans LLM)
 * - Enrichissement LLM (même edge function `/chat`)
 * - Merge qui préserve `userEdited`
 */
import { getSupabaseClient } from '@/template';
import type { BotConfig } from '@/contexts/BotContext';
import type { SimulationData } from '@/types/simulation';
import {
  emptyMemoryItem,
  emptySimulationMemory,
  mergeMemoryItems,
  normalizeMemoryKey,
  normalizeCharacterCategory,
  normalizeLinkSubsection,
  pickPrincipalByMentions,
  ensureSinglePrincipal,
  type SimulationMemory,
  type SimulationMemoryItem,
  type MemoryCharacterCategory,
  type MemoryLinkSubsection,
} from '@/types/simulationMemory';

type ChatMsg = { role: 'user' | 'assistant' | 'system'; content: string };

/** Extrait un objet JSON d'une réponse modèle (tolère ```json). */
function extractJsonObject(text: string): any | null {
  const raw = String(text ?? '').trim();
  if (!raw) return null;
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fence ? fence[1] : raw).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function itemsFromLlmArray(arr: any, section: 'characters' | 'links' | 'places'): SimulationMemoryItem[] {
  if (!Array.isArray(arr)) return [];
  const out: SimulationMemoryItem[] = [];
  for (const r of arr) {
    if (!r || typeof r !== 'object') continue;
    const name = String(r.name ?? r.title ?? '').trim();
    if (!name) continue;
    const summary = String(r.summary ?? r.description ?? r.text ?? '').trim();
    const base: Partial<SimulationMemoryItem> & { name: string } = {
      name,
      summary,
      from: r.from ? String(r.from) : undefined,
      to: r.to ? String(r.to) : undefined,
      userEdited: false,
      isPlayerPersona: r.isPlayerPersona === true,
    };
    if (section === 'characters') {
      base.characterCategory = normalizeCharacterCategory(
        r.characterCategory ?? r.category ?? r.role,
      );
    }
    if (section === 'links') {
      base.linkSubsection = normalizeLinkSubsection(
        r.linkSubsection ?? r.subsection ?? r.kind ?? r.type,
      );
    }
    out.push(emptyMemoryItem(base));
  }
  return mergeMemoryItems([], out);
}

/** Seed déterministe à partir du worldbuilding (personas, PNJ, titre). */
export function seedMemoryFromWorld(sim: SimulationData): SimulationMemory {
  const characters: SimulationMemoryItem[] = [];
  for (const p of sim.personas ?? []) {
    const name = (p.name || '').trim();
    if (!name) continue;
    const parts = [p.identity, p.physique, p.personality, p.tastes, p.background]
      .map((s) => String(s ?? '').trim())
      .filter(Boolean);
    characters.push(
      emptyMemoryItem({
        name,
        summary: parts.join(' · ').slice(0, 600) || 'Persona joueur',
        userEdited: false,
        isPlayerPersona: true,
        characterCategory: 'secondaires',
      }),
    );
  }
  for (const c of sim.characters ?? []) {
    const name = (c.name || '').trim();
    if (!name) continue;
    const traits = Array.isArray(c.traits) && c.traits.length ? ` [${c.traits.join(', ')}]` : '';
    characters.push(
      emptyMemoryItem({
        name,
        summary: `${c.description || ''}${traits}`.trim().slice(0, 600) || 'Personnage du monde',
        userEdited: false,
        isPlayerPersona: false,
        characterCategory: 'secondaires',
      }),
    );
  }
  const places: SimulationMemoryItem[] = [];
  const worldTitle = sim.world?.title?.trim();
  if (worldTitle) {
    places.push(
      emptyMemoryItem({
        name: worldTitle,
        summary: (sim.world.introduction || sim.world.backgroundContext || 'Monde de la simulation')
          .trim()
          .slice(0, 600),
        userEdited: false,
      }),
    );
  }
  const links: SimulationMemoryItem[] = [];
  // Relations persona ↔ PNJ (légères) si les deux existent
  const persona = sim.personas?.[0];
  if (persona?.name?.trim() && (sim.characters?.length ?? 0) > 0) {
    for (const c of sim.characters.slice(0, 6)) {
      if (!c.name?.trim()) continue;
      links.push(
        emptyMemoryItem({
          name: `${persona.name.trim()} ↔ ${c.name.trim()}`,
          summary: 'Relation à préciser au fil du roleplay',
          from: persona.name.trim(),
          to: c.name.trim(),
          userEdited: false,
          linkSubsection: 'rapports',
        }),
      );
    }
  }
  const mergedChars = pickPrincipalByMentions(mergeMemoryItems([], characters), []);
  return emptySimulationMemory({
    entries: sim.memory?.entries ?? [],
    initialized: true,
    lastUpdatedAt: new Date().toISOString(),
    messageCountAtLastUpdate: 0,
    updateEveryN: sim.memory?.updateEveryN,
    characters: mergedChars,
    links: mergeMemoryItems([], links),
    places: mergeMemoryItems([], places),
  });
}

async function completeOnce(opts: {
  model: string;
  apiKey?: string | null;
  system: string;
  user: string;
  signal?: AbortSignal;
}): Promise<string> {
  const supabase = getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  const authHeader = session?.access_token ? `Bearer ${session.access_token}` : '';
  const supabaseUrl = (supabase as any).supabaseUrl as string ?? '';
  const fnUrl = `${supabaseUrl}/functions/v1/chat`;
  const messages: ChatMsg[] = [
    { role: 'system', content: opts.system },
    { role: 'user', content: opts.user },
  ];
  const response = await fetch(fnUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
      'apikey': (supabase as any).supabaseKey as string ?? '',
    },
    body: JSON.stringify({
      messages,
      model: opts.model || 'claude-sonnet-5',
      temperature: 0.2,
      maxTokens: 4096,
      topP: 0.9,
      apiKey: opts.apiKey ?? null,
      enabledTools: [],
      thinking: false,
    }),
    signal: opts.signal,
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Mémoire IA: ${errText.slice(0, 240)}`);
  }
  let fullText = '';
  const reader = response.body?.getReader();
  if (reader) {
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n');
      buffer = parts.pop() ?? '';
      for (const line of parts) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const j = JSON.parse(payload);
          if (typeof j.delta === 'string') fullText += j.delta;
          else if (typeof j.error === 'string') throw new Error(j.error);
        } catch (e: any) {
          if (e?.message && !e.message.startsWith('Unexpected')) throw e;
        }
      }
    }
  } else {
    fullText = await response.text();
  }
  return fullText;
}

function buildHistorySnippet(messages: ChatMsg[], maxChars = 7000): string {
  const usable = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .filter((m) => !m.content.startsWith('[RÉSULTATS D\'OUTILS') && !m.content.startsWith('[RÉPONSES AU QUESTIONNAIRE]'))
    .slice(-40);
  let out = '';
  for (const m of usable) {
    const line = `${m.role === 'user' ? 'JOUEUR' : 'NARRATION'}: ${m.content.trim()}\n\n`;
    if (out.length + line.length > maxChars) break;
    out += line;
  }
  return out.trim() || '(aucun message encore)';
}

function buildWorldSnippet(sim: SimulationData): string {
  const w = sim.world;
  const parts = [
    w.title ? `Titre: ${w.title}` : '',
    w.introduction ? `Introduction:\n${w.introduction}` : '',
    w.backgroundContext ? `Contexte:\n${w.backgroundContext.slice(0, 2500)}` : '',
    w.rules ? `Règles:\n${w.rules.slice(0, 1200)}` : '',
  ].filter(Boolean);
  const personas = (sim.personas ?? [])
    .map((p) => `- Persona ${p.name}: ${[p.identity, p.personality].filter(Boolean).join(' / ')}`)
    .join('\n');
  const chars = (sim.characters ?? [])
    .map((c) => `- PNJ ${c.name}: ${c.description}`)
    .join('\n');
  if (personas) parts.push(`Personas:\n${personas}`);
  if (chars) parts.push(`PNJ connus:\n${chars}`);
  return parts.join('\n\n').slice(0, 6000);
}

const EXTRACT_SYSTEM = `Tu es un extracteur de mémoire pour un roleplay.
Tu renvoies UNIQUEMENT un JSON valide (pas de markdown hors éventuel fence), schéma:
{
  "characters": [{"name":"string","summary":"string","characterCategory":"principal|secondaires|enjeux|anecdotiques","isPlayerPersona":false}],
  "links": [{"name":"string","summary":"string","linkSubsection":"objets|rapports","from":"string?","to":"string?"}],
  "places": [{"name":"string","summary":"string"}]
}
Règles STRICTES:
- Pas de doublons de personnages (un nom = une entrée ; fusionne les alias).
- Faits vérifiables dans le worldbuilding / l'historique seulement — pas d'invention.
- Summaries courtes (1–3 phrases).
- characterCategory:
  - principal = UN SEUL PNJ le plus parlé / le plus d'interactions (JAMAIS le persona joueur)
  - secondaires = récurrents importants
  - enjeux = liés aux conflits / enjeux
  - anecdotiques = apparitions ponctuelles
- isPlayerPersona=true uniquement pour le/les persona(s) joueur ; ils ne sont jamais principal.
- linkSubsection:
  - objets = objets clés narratifs
  - rapports = liens relationnels entre personnages
- Lieux clés seulement s'ils apparaissent vraiment.
- Réponds en français.`;

/**
 * Génère ou met à jour la mémoire.
 * `mode: 'initial'` = première ouverture ; `'refresh'` = MAJ auto / manuelle.
 * Les items `userEdited` de `current` sont toujours préservés.
 */
export async function generateOrRefreshMemory(opts: {
  sim: SimulationData;
  messages: ChatMsg[];
  bot: BotConfig;
  mode: 'initial' | 'refresh';
  signal?: AbortSignal;
}): Promise<SimulationMemory> {
  const { sim, messages, bot, mode, signal } = opts;
  const current = normalizeOrEmpty(sim.memory);
  const seed = mode === 'initial' ? seedMemoryFromWorld(sim) : current;

  let llmCharacters: SimulationMemoryItem[] = [];
  let llmLinks: SimulationMemoryItem[] = [];
  let llmPlaces: SimulationMemoryItem[] = [];

  try {
    const userPrompt = [
      mode === 'initial'
        ? 'Génère la mémoire INITIALE de cette simulation à partir du worldbuilding et de l’historique.'
        : 'METS À JOUR la mémoire : ajoute/affine uniquement les faits nouveaux de l’historique récent. Ne réinvente pas.',
      '',
      '## WORLDBUILDING',
      buildWorldSnippet(sim),
      '',
      '## MÉMOIRE ACTUELLE (à respecter / fusionner)',
      JSON.stringify(
        {
          characters: current.characters.map((c) => ({
            name: c.name,
            summary: c.summary,
            userEdited: c.userEdited,
            characterCategory: c.characterCategory,
            isPlayerPersona: c.isPlayerPersona,
          })),
          links: current.links.map((c) => ({
            name: c.name,
            summary: c.summary,
            from: c.from,
            to: c.to,
            userEdited: c.userEdited,
            linkSubsection: c.linkSubsection,
          })),
          places: current.places.map((c) => ({
            name: c.name,
            summary: c.summary,
            userEdited: c.userEdited,
          })),
        },
        null,
        2,
      ),
      '',
      '## HISTORIQUE',
      buildHistorySnippet(messages),
    ].join('\n');

    const raw = await completeOnce({
      model: bot.llmConfig?.model || 'claude-sonnet-5',
      apiKey: (bot as any).apiKey ?? null,
      system: EXTRACT_SYSTEM,
      user: userPrompt,
      signal,
    });
    const parsed = extractJsonObject(raw);
    if (parsed) {
      llmCharacters = itemsFromLlmArray(parsed.characters, 'characters');
      llmLinks = itemsFromLlmArray(parsed.links, 'links');
      llmPlaces = itemsFromLlmArray(parsed.places, 'places');
    }
  } catch {
    // Seed seul si LLM indisponible
  }

  const baseChars = mode === 'initial' ? seed.characters : current.characters;
  const baseLinks = mode === 'initial' ? seed.links : current.links;
  const basePlaces = mode === 'initial' ? seed.places : current.places;

  const mergedCharacters = pickPrincipalByMentions(
    mergeMemoryItems(baseChars, llmCharacters),
    messages,
  );
  const next = emptySimulationMemory({
    entries: current.entries,
    initialized: true,
    lastUpdatedAt: new Date().toISOString(),
    messageCountAtLastUpdate: messages.length,
    updateEveryN: current.updateEveryN,
    characters: mergedCharacters,
    links: mergeMemoryItems(baseLinks, llmLinks),
    places: mergeMemoryItems(basePlaces, llmPlaces),
  });
  return next;
}

function normalizeOrEmpty(mem: SimulationMemory | undefined): SimulationMemory {
  if (!mem) return emptySimulationMemory();
  return emptySimulationMemory(mem);
}

/** Applique une édition manuelle (marque userEdited). */
export function applyManualMemoryEdit(
  memory: SimulationMemory,
  section: 'characters' | 'links' | 'places',
  itemId: string,
  patch: {
    name?: string;
    summary?: string;
    from?: string;
    to?: string;
    characterCategory?: MemoryCharacterCategory;
    linkSubsection?: MemoryLinkSubsection;
  },
): SimulationMemory {
  let list = memory[section].map((it) => {
    if (it.id !== itemId) return it;
    const name = patch.name !== undefined ? patch.name.trim() || it.name : it.name;
    let key = normalizeMemoryKey(name);
    if (memory[section].some((o) => o.id !== itemId && o.key === key)) {
      key = `${key} ${itemId.slice(-4)}`;
    }
    let characterCategory = it.characterCategory;
    if (patch.characterCategory) {
      characterCategory = patch.characterCategory;
      if (it.isPlayerPersona && characterCategory === 'principal') {
        characterCategory = 'secondaires';
      }
    }
    return emptyMemoryItem({
      ...it,
      name,
      key,
      summary: patch.summary !== undefined ? patch.summary : it.summary,
      from: patch.from !== undefined ? (patch.from || undefined) : it.from,
      to: patch.to !== undefined ? (patch.to || undefined) : it.to,
      characterCategory,
      linkSubsection: patch.linkSubsection ?? it.linkSubsection,
      userEdited: true,
      updatedAt: new Date().toISOString(),
    });
  });
  if (section === 'characters') list = ensureSinglePrincipal(list);
  return emptySimulationMemory({ ...memory, [section]: list });
}

export function addManualMemoryItem(
  memory: SimulationMemory,
  section: 'characters' | 'links' | 'places',
  name: string,
  opts?: { characterCategory?: MemoryCharacterCategory; linkSubsection?: MemoryLinkSubsection },
): SimulationMemory {
  const item = emptyMemoryItem({
    name: name.trim() || 'Nouvelle entrée',
    summary: '',
    userEdited: true,
    characterCategory: section === 'characters' ? (opts?.characterCategory ?? 'anecdotiques') : undefined,
    linkSubsection: section === 'links' ? (opts?.linkSubsection ?? 'rapports') : undefined,
    isPlayerPersona: false,
  });
  let list = mergeMemoryItems(memory[section], [item]);
  if (section === 'characters') list = ensureSinglePrincipal(list);
  return emptySimulationMemory({
    ...memory,
    [section]: list,
  });
}

export function removeMemoryItem(
  memory: SimulationMemory,
  section: 'characters' | 'links' | 'places',
  itemId: string,
): SimulationMemory {
  return emptySimulationMemory({
    ...memory,
    [section]: memory[section].filter((it) => it.id !== itemId),
  });
}
