import { Platform } from 'react-native';
import { localCompletion, LOCAL_FALLBACK_MODEL, type LocalAIConfig } from '@/services/localAI';
import { parseLlmJson, textFromSse } from '@/services/llmJson';
import { NeedKey, NEED_KEYS, applyNeedDeltas, emptyNeeds, SimulationNeeds } from '@/types/simulationNeeds';
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
  normalizeKind,
  MEMORY_PLACE_KINDS,
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
  removeInventoryItems,
  applySkillGains,
  mergeLifeStages,
  type SkillGain,
  type SimulationSkillItem,
  type SimulationLifeStage,
  mergeKnownNumbers,
  extractPhones,
  normalizePhone,
  randomPhone,
  type SimulationKnownNumber,
  type SimulationFeatureContent,
  type SimulationInventoryItem,
  type SimulationFeatureMessageItem,
} from '@/types/simulationFeatureContent';

type ChatMsg = { role: 'user' | 'assistant' | 'system'; content: string };

/** Extrait un objet JSON d'une réponse modèle (tolère ```json). */
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
    if (section === 'places') {
      base.kind = normalizeKind(r.kind ?? r.type ?? r.placeType, MEMORY_PLACE_KINDS, 'lieux');
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

/** Plafond de sortie de la passe mémoire selon le modèle (limites fournisseurs). */
function memoryMaxTokens(model: string): number {
  const m = model.toLowerCase();
  if (m.startsWith('gemini')) return /gemini-(1\.|2\.0)/.test(m) ? 8192 : 16000;
  if (/claude-3-(haiku|opus|sonnet)(?!-5|-7)/.test(m)) return 4096;
  return 16000;
}

export async function completeOnce(opts: {
  model: string;
  apiKey?: string | null;
  system: string;
  user: string;
  signal?: AbortSignal;
  /** Plafond de sortie (défaut 4096) */
  maxTokens?: number;
  /** Demande une sortie JSON stricte (Gemini : responseMimeType) */
  jsonMode?: boolean;
  localAI?: LocalAIConfig;
}): Promise<string> {
  if (opts.localAI?.enabled) {
    try {
      return await localCompletion({ config: opts.localAI, purpose: opts.jsonMode ? 'memory' : 'narrative',
        messages: [{ role: 'system', content: opts.system }, { role: 'user', content: opts.user }],
        maxTokens: opts.maxTokens, json: opts.jsonMode, temperature: 0.2,
        stream: false, android: Platform.OS === 'android', signal: opts.signal });
    } catch (e) {
      if (opts.signal?.aborted || !opts.localAI.fallbackGemini || !opts.apiKey?.trim()) throw e;
      return completeOnce({ ...opts, localAI: undefined, model: LOCAL_FALLBACK_MODEL });
    }
  }
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
      maxTokens: opts.maxTokens ?? 4096,
      topP: 0.9,
      apiKey: opts.apiKey ?? null,
      enabledTools: [],
      thinking: false,
      jsonMode: opts.jsonMode === true,
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
    // Android / React Native : pas de ReadableStream → le corps arrive en SSE brut
    // (« data: {"delta":…} »). Il FAUT le décoder, sinon le JSON est illisible.
    const text = await response.text();
    fullText = textFromSse(text) ?? text;
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
  "characters": [{"name":"string","summary":"string","characterCategory":"principal|secondaires|enjeux|anecdotiques","age":"string?","physique":"string?","personality":"string?","extraInfo":"string?","location":"string?"}],
  "links": [{"name":"string","summary":"string?","linkSubsection":"objets|rapports|evenements|accords","owner":"string?","origin":"string?","interlocutors":"string?","dynamics":"string?","attitude":"string?","attachmentLevel":"string?","participants":"string?","time":"string?","location":"string?","proposedBy":"string?","completed":false}],
  "places": [{"name":"string","summary":"string","kind":"pays|villes|zones|lieux"}],
  "inventory": [{"name":"string","quantity":1,"description":"string?","carriedByPersona":true}],
  "contactMessages": [{"from":"string","content":"string","influence":"string?"}],
  "inventoryRemoved": [{"name":"string","reason":"perdu|donné|consommé|volé|autre"}],
  "discoveredNumbers": [{"name":"string","number":"xxx-xxx","source":"chat|paper"}],
  "personaNumberGivenTo": ["string"],
  "skillXp": [{"name":"string","xp":10,"description":"string?","notion":"string?"}],
  "needDeltas": {"hunger":0,"energy":0,"hygiene":0,"social":0,"fun":0,"mood":0},
  "lifeStages": [{"title":"string","description":"string","when":"string?","impact":"string"}],
  "unknownMessages": [{"senderName":"string?","number":"xxx-xxx?","content":"string","suspicious":false}]
}
Règles STRICTES:
- Pas de doublons de personnages (un nom = une entrée ; fusionne les alias).
- Faits vérifiables dans le worldbuilding / l'historique seulement — pas d'invention.
- Summaries courtes (1–3 phrases).
- "persona" = faits APPRIS en RP sur le persona joueur, STRICTEMENT différents de ce qui est déjà dans le persona de base. N'y mets PAS de simple reformulation du persona de base.
- "characters" = PNJ seulement (jamais le persona joueur).
- characterCategory : principal = PNJ central (un seul), secondaires = récurrents, enjeux = liés aux enjeux de l'intrigue, anecdotiques = de passage. Garde la catégorie actuelle si rien ne change.
- Pour chaque personnage, renseigne si possible : age, physique, personality, extraInfo, location.
- linkSubsection:
  - objets = objets clés (owner=propriétaire, name=nom article, summary=description, origin=origine)
  - rapports = liens relationnels (interlocutors, dynamics, attitude, attachmentLevel)
    attachmentLevel = entier de -10 (hostile) à +10 (très attaché), 0 = neutre. Fais-le évoluer PROGRESSIVEMENT (±1 à ±3 max) selon les interactions récentes ; garde la valeur actuelle si rien ne change.
  - evenements = évènements marquants (participants, summary=description, time, location)
  - accords = accords et tâches (proposedBy, participants, summary=description, completed true/false)
- places (Map) seulement s'ils apparaissent vraiment ; kind = pays, villes, zones (quartier, région, forêt…) ou lieux (bâtiment, pièce, endroit précis).
- "inventory" : UNIQUEMENT les objets que le persona JOUEUR porte actuellement sur lui (équipés / dans les poches / en main). carriedByPersona doit être true. Sinon tableau vide.
- "contactMessages" : messages envoyés AU persona par des contacts listés (seulement si narrativement pertinent maintenant). from = nom exact du contact. Tableau vide si aucun.
- "inventoryRemoved" : objets de l'INVENTAIRE ACTUEL qui ont quitté le persona dans l'historique récent (perdu, donné, consommé, volé). Nom EXACT de l'inventaire. Vide sinon.
- Un papier/carte portant un numéro donné au persona = objet d'inventaire (ex. "Papier avec numéro de X", description contenant le numéro).
- "discoveredNumbers" : numéros au format xxx-xxx (3 chiffres, tiret, 3 chiffres) qu'un personnage donne AU persona (oralement → chat, ou sur papier → paper), avec le nom du personnage. Vide sinon.
- "personaNumberGivenTo" : noms des personnages à qui le JOUEUR vient de donner SON numéro (numéro du persona fourni). Vide sinon.
- "unknownMessages" : messages SMS reçus d'un numéro non enregistré. Cas 1 : un personnage de la liste "ONT LE NUMÉRO DU PERSONA" écrit enfin (pas forcément tout de suite — seulement quand c'est naturel ; senderName = son nom). Cas 2 (TRÈS RARE, seulement si l'histoire s'y prête : mystère, danger) : un numéro étrange/suspect écrit (suspicious=true, senderName vide ou identité cachée). Vide la plupart du temps.
- "skillXp" : compétences que le PERSONA JOUEUR vient d'exercer par ses choix/actions dans l'historique RÉCENT (pas les PNJ). xp = 5 à 40 selon l'intensité/réussite (progression douce, jamais de saut). Réutilise le nom EXACT d'une compétence existante si c'est la même. "notion" = notion apprise concrète (courte), utile si l'action marque un vrai apprentissage. Vide si aucune.
- "lifeStages" : étapes MAJEURES de la vie du persona qui viennent d'arriver et auront un impact durable (ex. "A appris à faire du vélo", "A trouvé un travail", "A déménagé"). Rare. N'en répète pas une existante. Vide sinon.
- "needDeltas" : SEULEMENT si le module Besoins est actif. Objet {"hunger","energy","hygiene","social","fun","mood"} : variation (entier −60…+60) due aux ACTIONS RÉCENTES du persona (manger → hunger +, dormir → energy +, se laver → hygiene +, discuter → social +, se divertir → fun +, évènement heureux/triste → mood ±). Omets les besoins inchangés. {} sinon. (La baisse liée au temps qui passe est calculée à part : ne la compte pas.)
- Priorise les cibles [[wikilink]] mentionnées dans l'historique récent.
- Réponds en français.`;

export type MemoryPassResult = {
  memory: SimulationMemory;
  inventoryAdded: SimulationInventoryItem[];
  inventoryRemoved: SimulationInventoryItem[];
  skillsNext?: SimulationSkillItem[];
  skillsCreated: SimulationSkillItem[];
  levelUps: { name: string; level: number }[];
  lifeStagesNext?: SimulationLifeStage[];
  lifeStagesAdded: SimulationLifeStage[];
  needsNext?: SimulationNeeds;
  knownNumbersNext?: SimulationKnownNumber[];
  pendingNext?: string[];
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
  features?: { inventory?: boolean; messages?: boolean; skills?: boolean; needs?: boolean };
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
  let llmRemoved: string[] = [];
  const llmSkills: SkillGain[] = [];
  const llmNeedDeltas: Partial<Record<NeedKey, number>> = {};
  const llmLife: Partial<SimulationLifeStage>[] = [];
  let llmNumbers: { number: string; name?: string; source?: SimulationKnownNumber['source'] }[] = [];
  let llmGivenTo: string[] = [];
  let llmUnknown: { senderName?: string; number?: string; content: string; suspicious?: boolean }[] = [];
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
        ? `## NUMÉRO DU PERSONA\n${fc?.personaNumber || '(aucun)'}\n## ONT LE NUMÉRO DU PERSONA (peuvent écrire en numéro inconnu)\n${(fc?.pendingNumberGivenTo ?? []).join(', ') || '(personne)'}\n## CONTACTS (seuls autorisés à écrire)\n${contactNames.length ? contactNames.map((n) => `- ${n}`).join('\n') : '(aucun contact — contactMessages doit être [])'}`
        : '## MESSAGES CONTACTS\nModule inactif — renvoie "contactMessages": [].',
      '',
      features.skills
        ? `## COMPÉTENCES ACTUELLES\n${JSON.stringify((fc?.skills ?? []).map((s) => ({ name: s.name, level: s.level, xp: s.xp })))}\n## ÉTAPES DE VIE EXISTANTES\n${(fc?.lifeStages ?? []).map((s) => `- ${s.title}`).join('\n') || '(aucune)'}`
        : '## COMPÉTENCES / ÉTAPES\nModule inactif — renvoie "skillXp": [] et "lifeStages": [].',
      '',
      features.needs
        ? `## BESOINS ACTUELS (0–100)\n${JSON.stringify(emptyNeeds(fc?.needs))}`
        : '## BESOINS\nModule inactif — renvoie "needDeltas": {}.',
      '',
      '## HISTORIQUE',
      buildHistorySnippet(messages),
    ].filter((s) => s !== undefined).join('\n');

    const call = (system: string) => completeOnce({
      localAI: bot.llmConfig?.localAI,
      model: bot.llmConfig?.model || 'claude-sonnet-5',
      apiKey: (bot as any).apiKey ?? null,
      system,
      user: userPrompt,
      signal,
      // Extraction complète (Rafraîchir) = sortie longue : 4096 tronquait le JSON
      maxTokens: memoryMaxTokens(bot.llmConfig?.model || 'claude-sonnet-5'),
      jsonMode: true,
    });
    let raw = await call(EXTRACT_SYSTEM);
    let res = parseLlmJson(raw);
    if (!res || typeof res.value !== 'object') {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn('[Mémoire IA] JSON illisible — extrait brut :', String(raw ?? '').slice(0, 600), '…', String(raw ?? '').slice(-300));
      }
      // Dernier recours : une relance stricte
      raw = await call(`${EXTRACT_SYSTEM}\n\nIMPORTANT : renvoie UNIQUEMENT un objet JSON valide et complet (pas de \`\`\`, pas de texte avant/après, pas de commentaires). Sois concis : résumés courts, omets les champs vides.`);
      res = parseLlmJson(raw);
    }
    if (!String(raw ?? '').trim()) {
      throw new Error('Mémoire IA : réponse vide');
    }
    if (!res || !res.value || typeof res.value !== 'object' || Array.isArray(res.value)) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn('[Mémoire IA] échec après relance — extrait brut :', String(raw ?? '').slice(0, 600));
      }
      throw new Error('Mémoire IA : JSON illisible (mémoire existante conservée)');
    }
    if (res.truncated && typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('[Mémoire IA] réponse tronquée réparée (fin de JSON coupée)');
    }
    const json = res.value;
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
    if (features.needs && json.needDeltas && typeof json.needDeltas === 'object') {
      for (const k of NEED_KEYS) {
        const v = Number((json.needDeltas as any)[k]);
        if (Number.isFinite(v) && v !== 0) llmNeedDeltas[k] = v;
      }
    }
    if (features.skills) {
      if (Array.isArray(json.skillXp)) {
        for (const r of json.skillXp) {
          const name = String(r?.name ?? '').trim();
          if (!name) continue;
          llmSkills.push({
            name,
            xp: Number(r?.xp) || 0,
            description: String(r?.description ?? '').trim() || undefined,
            notion: String(r?.notion ?? '').trim() || undefined,
          });
        }
      }
      if (Array.isArray(json.lifeStages)) {
        for (const r of json.lifeStages) {
          const title = String(r?.title ?? '').trim();
          if (!title) continue;
          llmLife.push({
            title,
            description: String(r?.description ?? '').trim(),
            when: String(r?.when ?? '').trim(),
            impact: String(r?.impact ?? '').trim(),
          });
        }
      }
    }
    if (features.inventory && Array.isArray(json.inventoryRemoved)) {
      llmRemoved = json.inventoryRemoved
        .map((r: any) => String(typeof r === 'string' ? r : r?.name ?? '').trim())
        .filter(Boolean);
    }
    if (features.messages) {
      if (Array.isArray(json.discoveredNumbers)) {
        for (const r of json.discoveredNumbers) {
          const n = normalizePhone(r?.number);
          if (n) llmNumbers.push({ number: n, name: String(r?.name ?? '').trim(), source: r?.source === 'paper' ? 'paper' : 'chat' });
        }
      }
      if (Array.isArray(json.personaNumberGivenTo)) {
        llmGivenTo = json.personaNumberGivenTo.map((s: any) => String(s ?? '').trim()).filter(Boolean);
      }
      if (Array.isArray(json.unknownMessages)) {
        for (const r of json.unknownMessages) {
          const content = String(r?.content ?? '').trim();
          if (!content) continue;
          llmUnknown.push({
            senderName: String(r?.senderName ?? '').trim() || undefined,
            number: normalizePhone(r?.number) ?? undefined,
            content,
            suspicious: r?.suspicious === true,
          });
        }
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
  let inventoryRemoved: SimulationInventoryItem[] = [];
  let inventoryNext: SimulationInventoryItem[] | undefined;
  if (features.inventory) {
    const merged = mergeInventoryItems(fc?.inventory ?? [], llmInventory);
    const addedKeys = new Set(merged.added.map((a) => a.id));
    const rem = removeInventoryItems(merged.next, llmRemoved);
    inventoryAdded = merged.added.filter((a) => !rem.removed.some((r) => r.id === a.id));
    inventoryRemoved = rem.removed.filter((r) => !addedKeys.has(r.id));
    inventoryNext = rem.next;
  }

  const needsNext = features.needs ? applyNeedDeltas(emptyNeeds(fc?.needs), llmNeedDeltas) : undefined;
  let skillsNext: SimulationSkillItem[] | undefined;
  let skillsCreated: SimulationSkillItem[] = [];
  let levelUps: { name: string; level: number }[] = [];
  let lifeStagesNext: SimulationLifeStage[] | undefined;
  let lifeStagesAdded: SimulationLifeStage[] = [];
  if (features.skills) {
    const sg = applySkillGains(fc?.skills ?? [], llmSkills);
    skillsNext = sg.next; skillsCreated = sg.created; levelUps = sg.levelUps;
    const ls = mergeLifeStages(fc?.lifeStages ?? [], llmLife);
    lifeStagesNext = ls.next; lifeStagesAdded = ls.added;
  }

  // Numéros découverts : LLM + regex texte IA récent + papiers d’inventaire
  let knownNumbersNext: SimulationKnownNumber[] | undefined;
  let pendingNext: string[] | undefined;
  if (features.messages) {
    const recentAssistant = messages.slice(-2).filter((m) => m.role === 'assistant').map((m) => m.content).join('\n');
    const personaN = fc?.personaNumber ? normalizePhone(fc.personaNumber) : null;
    const regexNums = extractPhones(recentAssistant)
      .filter((n) => n !== personaN && !llmNumbers.some((l) => l.number === n))
      .map((n) => ({ number: n, name: '', source: 'chat' as const }));
    const paperNums = (inventoryNext ?? fc?.inventory ?? []).flatMap((i) =>
      extractPhones(`${i.name} ${i.description}`)
        .filter((n) => n !== personaN && !llmNumbers.some((l) => l.number === n))
        .map((n) => ({ number: n, name: '', source: 'paper' as const })),
    );
    knownNumbersNext = mergeKnownNumbers(fc?.knownNumbers ?? [], [
      ...llmNumbers.filter((l) => l.number !== personaN), ...regexNums, ...paperNums,
    ]);
    const pend = new Set([...(fc?.pendingNumberGivenTo ?? []), ...llmGivenTo]);
    // Messages numéro inconnu
    for (const u of llmUnknown) {
      const fromPending = u.senderName && Array.from(pend).some((p) => normalizeMemoryKey(p) === normalizeMemoryKey(u.senderName!));
      if (!fromPending && !u.suspicious) continue;
      const existing = knownNumbersNext.find((k) => u.senderName && normalizeMemoryKey(k.name) === normalizeMemoryKey(u.senderName));
      const num = u.number || existing?.number || randomPhone();
      if (fromPending) {
        for (const p of Array.from(pend)) if (normalizeMemoryKey(p) === normalizeMemoryKey(u.senderName!)) pend.delete(p);
      }
      llmContactMsgs.push({ from: 'Numéro inconnu', content: u.content, influence: undefined });
      (llmContactMsgs[llmContactMsgs.length - 1] as any).__unknown = {
        fromNumber: num, hiddenName: u.senderName, suspicious: u.suspicious === true,
      };
    }
    pendingNext = Array.from(pend);
  }

  let messagesAdded: SimulationFeatureMessageItem[] = [];
  let messagesNext: SimulationFeatureMessageItem[] | undefined;
  if (features.messages) {
    const existing = fc?.messages ?? [];
    const contacts = fc?.contacts ?? [];
    messagesAdded = llmContactMsgs.map((m) => {
      const u = (m as any).__unknown as { fromNumber: string; hiddenName?: string; suspicious: boolean } | undefined;
      if (u) {
        return emptyFeatureMessageItem({
          from: `Numéro inconnu (${u.fromNumber})`,
          content: m.content,
          read: false,
          fromNumber: u.fromNumber,
          unknownSender: true,
          hiddenName: u.hiddenName,
          suspicious: u.suspicious,
        });
      }
      const c = contacts.find((x) => normalizeMemoryKey(x.name) === normalizeMemoryKey(m.from));
      return emptyFeatureMessageItem({
        from: m.from,
        content: m.content,
        influence: m.influence,
        read: false,
        fromNumber: c?.number,
      });
    });
    messagesNext = messagesAdded.length ? [...messagesAdded, ...existing] : existing;
  }

  return {
    memory: next,
    inventoryAdded,
    inventoryRemoved,
    skillsNext,
    skillsCreated,
    levelUps,
    lifeStagesNext,
    lifeStagesAdded,
    needsNext,
    knownNumbersNext,
    pendingNext,
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
  opts?: Partial<SimulationMemoryItem>,
): SimulationMemory {
  const item = emptyMemoryItem({
    name: name.trim() || 'Nouvelle entrée',
    summary: '',
    userEdited: true,
    characterCategory: section === 'characters' ? (opts?.characterCategory ?? 'anecdotiques') : undefined,
    linkSubsection: section === 'links' ? (opts?.linkSubsection ?? 'rapports') : undefined,
    kind: section === 'places' ? (opts?.kind ?? 'lieux') : opts?.kind,
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

/** Résumé d’une partie terminée, pour lancer « la suite » dans une nouvelle conversation. */
export async function generateContinuationSummary(opts: {
  sim: SimulationData;
  messages: ChatMsg[];
  bot: BotConfig;
  result: 'won' | 'lost';
}): Promise<string> {
  const raw = await completeOnce({
    localAI: opts.bot.llmConfig?.localAI,
    model: opts.bot.llmConfig?.model || 'claude-sonnet-5',
    apiKey: (opts.bot as any).apiKey ?? null,
    system: 'Tu résumes une partie de roleplay terminée pour en préparer la suite. Réponds en français, en prose, 150 à 250 mots, sans titre ni liste.',
    user: [
      `Issue de la partie : ${opts.result === 'won' ? 'objectif atteint (victoire)' : 'défaite'}.`,
      opts.sim.world?.objectives ? `Objectifs : ${opts.sim.world.objectives}` : '',
      '## HISTORIQUE',
      buildHistorySnippet(opts.messages, 9000),
      '',
      'Écris : ce qui s’est passé (faits clés, relations, lieux), l’état du persona à la fin, et les fils ouverts qui peuvent nourrir la suite.',
    ].filter(Boolean).join('\n'),
  });
  return String(raw ?? '').trim();
}
