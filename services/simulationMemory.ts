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
  extractWikilinkTargets,
  type SimulationMemory,
  type SimulationMemoryItem,
  type MemorySectionId,
  type MemoryCharacterCategory,
  type MemoryLinkSubsection,
} from '@/types/simulationMemory';
import {
  emptyFeatureMessageItem,
  mergeInventoryItems,
  type SimulationFeatureContent,
  type SimulationInventoryItem,
  type SimulationFeatureMessageItem,
} from '@/types/simulationFeatureContent';

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

function itemsFromLlmArray(
  arr: any,
  section: 'persona' | 'characters' | 'links' | 'places',
): SimulationMemoryItem[] {
  if (!Array.isArray(arr)) return [];
  const out: SimulationMemoryItem[] = [];
  for (const r of arr) {
    if (!r || typeof r !== 'object') continue;
    const name = String(r.name ?? r.title ?? r.task ?? r.tache ?? r.fait ?? '').trim();
    if (!name) continue;
    const summary = String(r.summary ?? r.description ?? r.text ?? r.task ?? r.tache ?? '').trim();
    const base: Partial<SimulationMemoryItem> & { name: string } = {
      name,
      summary,
      from: r.from ? String(r.from) : undefined,
      to: r.to ? String(r.to) : undefined,
      userEdited: false,
      isPlayerPersona: false,
      age: r.age != null ? String(r.age) : undefined,
      physique: r.physique ?? r.physicalDescription ?? r.descriptionPhysique,
      personality: r.personality ?? r.personnalite,
      extraInfo: r.extraInfo ?? r.infosComplementaires ?? r.notes,
      location: r.location ?? r.emplacement ?? r.place,
      participants: r.participants,
      time: r.time ?? r.temps ?? r.when,
      owner: r.owner ?? r.proprietaire,
      origin: r.origin ?? r.origine,
      interlocutors: r.interlocutors ?? r.interlocuteurs,
      dynamics: r.dynamics ?? r.dynamique,
      attitude: r.attitude,
      attachmentLevel: r.attachmentLevel ?? r.niveauAttachement ?? r.attachement,
      proposedBy: r.proposedBy ?? r.proposePar,
      task: r.task ?? r.tache,
      completed: r.completed === true || r.done === true,
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
      if (base.linkSubsection === 'accords' && !base.summary) {
        base.summary = summary || name;
      }
      if (base.linkSubsection === 'rapports' && !base.interlocutors && (base.from || base.to)) {
        base.interlocutors = [base.from, base.to].filter(Boolean).join(' / ');
      }
    }
    out.push(emptyMemoryItem(base));
  }
  return mergeMemoryItems([], out);
}

/** Seed déterministe à partir du worldbuilding (personas, PNJ, titre). */
export function seedMemoryFromWorld(sim: SimulationData): SimulationMemory {
  // Persona de base reste dans sim.personas — la section mémoire « persona »
  // ne liste que les faits APPRIS en RP (différents du persona de base).
  const characters: SimulationMemoryItem[] = [];
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
        physique: String(c.description ?? '').trim() || undefined,
        personality: Array.isArray(c.traits) && c.traits.length ? c.traits.join(', ') : undefined,
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
          interlocutors: `${persona.name.trim()} / ${c.name.trim()}`,
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
    persona: [],
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
  "persona": [{"name":"string","summary":"string"}],
  "characters": [{"name":"string","summary":"string","age":"string?","physique":"string?","personality":"string?","extraInfo":"string?","location":"string?"}],
  "links": [{"name":"string","summary":"string?","linkSubsection":"objets|rapports|evenements|accords","owner":"string?","origin":"string?","interlocutors":"string?","dynamics":"string?","attitude":"string?","attachmentLevel":"string?","participants":"string?","time":"string?","location":"string?","proposedBy":"string?","completed":false}],
  "places": [{"name":"string","summary":"string"}],
  "inventory": [{"name":"string","quantity":1,"description":"string?","carriedByPersona":true}],
  "contactMessages": [{"from":"string","content":"string","influence":"string?"}]
}
Règles STRICTES:
- Pas de doublons de personnages (un nom = une entrée ; fusionne les alias).
- Faits vérifiables dans le worldbuilding / l'historique seulement — pas d'invention.
- Summaries courtes (1–3 phrases).
- "persona" = faits APPRIS en RP sur le persona joueur, STRICTEMENT différents de ce qui est déjà dans le persona de base. N'y mets PAS de simple reformulation du persona de base.
- "characters" = PNJ seulement (jamais le persona joueur).
- Pour chaque personnage, renseigne si possible : age, physique, personality, extraInfo, location.
- linkSubsection:
  - objets = objets clés (owner=propriétaire, name=nom article, summary=description, origin=origine)
  - rapports = liens relationnels (interlocutors, dynamics, attitude, attachmentLevel)
  - evenements = évènements marquants (participants, summary=description, time, location)
  - accords = accords et tâches (proposedBy, participants, summary=description, completed true/false)
- Lieux clés seulement s'ils apparaissent vraiment.
- "inventory" : UNIQUEMENT les objets que le persona JOUEUR porte actuellement sur lui (équipés / dans les poches / en main). carriedByPersona doit être true. Sinon tableau vide.
- "contactMessages" : messages envoyés AU persona par des contacts listés (seulement si narrativement pertinent maintenant). from = nom exact du contact. Tableau vide si aucun.
- Priorise les cibles [[wikilink]] mentionnées dans l'historique récent.
- Réponds en français.`;

export type MemoryPassResult = {
  memory: SimulationMemory;
  inventoryAdded: SimulationInventoryItem[];
  messagesAdded: SimulationFeatureMessageItem[];
  /** true si le JSON LLM a été parsé */
  parsed: boolean;
  /** Inventaire fusionné (si features.inventory) — sinon undefined */
  inventoryNext?: SimulationInventoryItem[];
  /** Messages fusionnés (nouveaux en tête) — sinon undefined */
  messagesNext?: SimulationFeatureMessageItem[];
};

/**
 * Génère ou met à jour la mémoire (+ inventaire / messages contacts si demandés).
 * `mode: 'initial'` = première ouverture ; `'refresh'` = MAJ auto / manuelle.
 * Les items `userEdited` de `current` sont toujours préservés.
 * En refresh : une erreur LLM ou un JSON illisible remonte (plus de silence).
 */
export async function generateOrRefreshMemory(opts: {
  sim: SimulationData;
  messages: ChatMsg[];
  bot: BotConfig;
  mode: 'initial' | 'refresh';
  signal?: AbortSignal;
  /** Modules actifs — extrait inventaire / messages contacts si true */
  features?: { inventory?: boolean; messages?: boolean };
  featureContent?: SimulationFeatureContent | null;
}): Promise<MemoryPassResult> {
  const { sim, messages, bot, mode, signal } = opts;
  const current = normalizeOrEmpty(sim.memory);
  const seed = mode === 'initial' ? seedMemoryFromWorld(sim) : current;
  const features = opts.features ?? {};
  const fc = opts.featureContent;
  const contactNames = (fc?.contacts ?? []).map((c) => c.name).filter(Boolean);
  const recentWiki = messages
    .slice(-6)
    .flatMap((m) => extractWikilinkTargets(m.content));

  let llmPersona: SimulationMemoryItem[] = [];
  let llmCharacters: SimulationMemoryItem[] = [];
  let llmLinks: SimulationMemoryItem[] = [];
  let llmPlaces: SimulationMemoryItem[] = [];
  let llmInventory: { name: string; quantity?: number; description?: string }[] = [];
  let llmContactMsgs: { from: string; content: string; influence?: string }[] = [];
  let parsed = false;

  try {
    const userPrompt = [
      mode === 'initial'
        ? 'Génère la mémoire INITIALE de cette simulation à partir du worldbuilding et de l’historique.'
        : 'METS À JOUR la mémoire : ajoute/affine uniquement les faits nouveaux de l’historique récent. Ne réinvente pas.',
      '',
      recentWiki.length
        ? `## WIKILINKS RÉCENTS (prioritaires)\n${recentWiki.map((w) => `- [[${w}]]`).join('\n')}`
        : '',
      '',
      '## WORLDBUILDING',
      buildWorldSnippet(sim),
      '',
      '## PERSONA DE BASE (ne PAS recopier dans persona — seulement faits nouveaux du RP)',
      JSON.stringify(
        (sim.personas ?? []).map((p) => ({
          name: p.name,
          identity: p.identity,
          physique: p.physique,
          personality: p.personality,
          tastes: p.tastes,
          background: p.background,
        })),
        null,
        2,
      ),
      '',
      '## MÉMOIRE ACTUELLE (à respecter / fusionner)',
      JSON.stringify(
        {
          persona: current.persona.map((c) => ({
            name: c.name,
            summary: c.summary,
            userEdited: c.userEdited,
          })),
          characters: current.characters.filter((c) => !c.isPlayerPersona).map((c) => ({
            name: c.name,
            summary: c.summary,
            age: c.age,
            physique: c.physique,
            personality: c.personality,
            extraInfo: c.extraInfo,
            location: c.location,
            userEdited: c.userEdited,
          })),
          links: current.links.map((c) => ({
            name: c.name,
            summary: c.summary,
            linkSubsection: c.linkSubsection,
            owner: c.owner,
            origin: c.origin,
            interlocutors: c.interlocutors,
            dynamics: c.dynamics,
            attitude: c.attitude,
            attachmentLevel: c.attachmentLevel,
            participants: c.participants,
            time: c.time,
            location: c.location,
            proposedBy: c.proposedBy,
            task: c.task,
            completed: c.completed === true,
            userEdited: c.userEdited,
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
      features.inventory
        ? `## INVENTAIRE ACTUEL\n${JSON.stringify((fc?.inventory ?? []).map((i) => ({ name: i.name, quantity: i.quantity, description: i.description })), null, 2)}\nN’ajoute que ce que le persona porte SUR LUI maintenant.`
        : '## INVENTAIRE\nModule inactif — renvoie "inventory": [].',
      '',
      features.messages
        ? `## CONTACTS (seuls autorisés à écrire)\n${contactNames.length ? contactNames.map((n) => `- ${n}`).join('\n') : '(aucun contact — contactMessages doit être [])'}`
        : '## MESSAGES CONTACTS\nModule inactif — renvoie "contactMessages": [].',
      '',
      '## HISTORIQUE',
      buildHistorySnippet(messages),
    ].filter((s) => s !== undefined).join('\n');

    const raw = await completeOnce({
      model: bot.llmConfig?.model || 'claude-sonnet-5',
      apiKey: (bot as any).apiKey ?? null,
      system: EXTRACT_SYSTEM,
      user: userPrompt,
      signal,
    });
    if (!String(raw ?? '').trim()) {
      throw new Error('Mémoire IA : réponse vide');
    }
    const json = extractJsonObject(raw);
    if (!json || typeof json !== 'object') {
      throw new Error('Mémoire IA : JSON illisible');
    }
    parsed = true;
    llmPersona = itemsFromLlmArray(json.persona, 'persona');
    llmCharacters = itemsFromLlmArray(json.characters, 'characters');
    llmLinks = itemsFromLlmArray(json.links, 'links');
    llmPlaces = itemsFromLlmArray(json.places, 'places');
    if (features.inventory && Array.isArray(json.inventory)) {
      for (const r of json.inventory) {
        if (!r || typeof r !== 'object') continue;
        if (r.carriedByPersona === false) continue;
        const name = String(r.name ?? '').trim();
        if (!name) continue;
        llmInventory.push({
          name,
          quantity: typeof r.quantity === 'number' ? r.quantity : 1,
          description: String(r.description ?? r.summary ?? '').trim() || undefined,
        });
      }
    }
    if (features.messages && Array.isArray(json.contactMessages) && contactNames.length) {
      const allowed = new Set(contactNames.map((n) => normalizeMemoryKey(n)));
      for (const r of json.contactMessages) {
        if (!r || typeof r !== 'object') continue;
        const from = String(r.from ?? '').trim();
        const content = String(r.content ?? r.text ?? '').trim();
        if (!from || !content) continue;
        if (!allowed.has(normalizeMemoryKey(from))) continue;
        llmContactMsgs.push({
          from,
          content,
          influence: String(r.influence ?? '').trim() || undefined,
        });
      }
    }
  } catch (e: any) {
    if (mode === 'refresh') {
      // Remonte l’erreur : le bouton Rafraîchir ne doit plus rester silencieux
      throw e instanceof Error ? e : new Error(String(e?.message ?? e ?? 'Mémoire : échec'));
    }
    // initial : seed seul si LLM indisponible
  }

  const basePersona = mode === 'initial' ? seed.persona : current.persona;
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
    persona: mergeMemoryItems(basePersona, llmPersona),
    characters: mergedCharacters,
    links: mergeMemoryItems(baseLinks, llmLinks),
    places: mergeMemoryItems(basePlaces, llmPlaces),
  });

  let inventoryAdded: SimulationInventoryItem[] = [];
  let inventoryNext: SimulationInventoryItem[] | undefined;
  if (features.inventory) {
    const merged = mergeInventoryItems(fc?.inventory ?? [], llmInventory);
    inventoryAdded = merged.added;
    inventoryNext = merged.next;
  }

  let messagesAdded: SimulationFeatureMessageItem[] = [];
  let messagesNext: SimulationFeatureMessageItem[] | undefined;
  if (features.messages) {
    const existing = fc?.messages ?? [];
    messagesAdded = llmContactMsgs.map((m) =>
      emptyFeatureMessageItem({
        from: m.from,
        content: m.content,
        influence: m.influence,
        read: false,
      }),
    );
    messagesNext = messagesAdded.length ? [...messagesAdded, ...existing] : existing;
  }

  return {
    memory: next,
    inventoryAdded,
    messagesAdded,
    parsed,
    inventoryNext,
    messagesNext,
  };
}

function normalizeOrEmpty(mem: SimulationMemory | undefined): SimulationMemory {
  if (!mem) return emptySimulationMemory();
  return emptySimulationMemory(mem);
}

/** Applique une édition manuelle (marque userEdited). */
export function applyManualMemoryEdit(
  memory: SimulationMemory,
  section: MemorySectionId,
  itemId: string,
  patch: {
    name?: string;
    summary?: string;
    from?: string;
    to?: string;
    characterCategory?: MemoryCharacterCategory;
    linkSubsection?: MemoryLinkSubsection;
    age?: string;
    physique?: string;
    personality?: string;
    extraInfo?: string;
    location?: string;
    participants?: string;
    time?: string;
    owner?: string;
    origin?: string;
    interlocutors?: string;
    dynamics?: string;
    attitude?: string;
    attachmentLevel?: string;
    proposedBy?: string;
    task?: string;
    completed?: boolean;
    pinned?: boolean;
    avatarUri?: string | null;
    avatarColor?: string;
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
    const pick = (k: keyof typeof patch, cur?: string) =>
      patch[k] !== undefined ? (String(patch[k] ?? '').trim() || undefined) : cur;
    return emptyMemoryItem({
      ...it,
      name,
      key,
      summary: patch.summary !== undefined ? patch.summary : it.summary,
      from: patch.from !== undefined ? (patch.from || undefined) : it.from,
      to: patch.to !== undefined ? (patch.to || undefined) : it.to,
      characterCategory,
      linkSubsection: patch.linkSubsection ?? it.linkSubsection,
      age: pick('age', it.age),
      physique: pick('physique', it.physique),
      personality: pick('personality', it.personality),
      extraInfo: pick('extraInfo', it.extraInfo),
      location: pick('location', it.location),
      participants: pick('participants', it.participants),
      time: pick('time', it.time),
      owner: pick('owner', it.owner),
      origin: pick('origin', it.origin),
      interlocutors: pick('interlocutors', it.interlocutors),
      dynamics: pick('dynamics', it.dynamics),
      attitude: pick('attitude', it.attitude),
      attachmentLevel: pick('attachmentLevel', it.attachmentLevel),
      proposedBy: pick('proposedBy', it.proposedBy),
      task: pick('task', it.task),
      completed: patch.completed !== undefined ? patch.completed === true : it.completed === true,
      pinned: patch.pinned !== undefined ? patch.pinned === true : it.pinned === true,
      avatarUri: patch.avatarUri === null
        ? undefined
        : (patch.avatarUri !== undefined ? (String(patch.avatarUri).trim() || undefined) : it.avatarUri),
      avatarColor: pick('avatarColor', it.avatarColor),
      userEdited: true,
      updatedAt: new Date().toISOString(),
      isNew: false,
    });
  });
  if (section === 'characters') list = ensureSinglePrincipal(list);
  return emptySimulationMemory({ ...memory, [section]: list });
}

export function addManualMemoryItem(
  memory: SimulationMemory,
  section: MemorySectionId,
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
  section: MemorySectionId,
  itemId: string,
): SimulationMemory {
  return emptySimulationMemory({
    ...memory,
    [section]: memory[section].filter((it) => it.id !== itemId),
  });
}
