// roleplayPrompt — assemble les instructions d'un tour de roleplay.
//
// `stable` : règles, monde, persona, PNJ, mémoire, dossiers de connaissances —
//            identique d'un tour à l'autre tant que la partie n'évolue pas.
// `volatile` : l'état du monde recalculé par l'application à chaque tour
//            (horloge, besoins, inventaire, objectif, dernier fait) + les
//            injections du tour (mode de réponse, automatisations).
// chatService place `stable` en tête et `volatile` après l'historique : le
// moteur peut ainsi réutiliser tout le début de la requête depuis son cache.
import { buildSimulationPromptInjection, type SimulationData, type SceneState } from '@/types/simulation';
import { formatClockFr, defaultClock, normalizeClock } from '@/types/simulationClock';
import { buildKnowledgePromptBlock } from '@/types/simulationKnowledge';

export interface RoleplayTurn {
  stable: string;
  volatile: string;
}

/** État du monde consolidé — recalculé par l'application, pas par le modèle. */
export function buildWorldStateBlock(sim: SimulationData, scene: SceneState): string {
  const lines: string[] = [];
  const c = normalizeClock(scene.clock) ?? defaultClock();
  lines.push(`Date et heure actuelles dans l’histoire : ${formatClockFr(c)}.`);
  const needs = scene.needs;
  if (needs) {
    lines.push(`Besoins du persona : ${Object.entries(needs).map(([k, v]) => `${k} ${v}/100`).join(', ')}.`);
  }
  if (scene.inventory.length) {
    lines.push(`Objets portés par ${scene.personaName || 'le persona'} : ${scene.inventory.join(', ')}.`);
  }
  if (scene.newInventory.length) {
    lines.push(`Objets récemment acquis : ${scene.newInventory.join(', ')}.`);
  }
  if (scene.objective) {
    lines.push(`Objectif en cours : ${scene.objective}`);
  }
  if (scene.latestStage) {
    lines.push(`Dernier fait établi : ${scene.latestStage}`);
  }
  return ['### ÉTAT ACTUEL DU MONDE (fourni par l’application — à respecter)', ...lines].join('\n');
}

export function buildRoleplayTurn(
  sim: SimulationData,
  opts: {
    maxBotChars?: number;
    /** Dossiers du workspace (pour les dossiers de connaissances choisis dans la partie) */
    knowledgeFolders?: Parameters<typeof buildKnowledgePromptBlock>[0];
    /** Consigne de langue (ne change pas d'un tour à l'autre) */
    langInjection?: string;
    /** Injections propres à ce tour : mode de réponse, automatisations… */
    turnInjections?: string[];
  },
): RoleplayTurn {
  const { stable, scene } = buildSimulationPromptInjection(sim, { maxBotChars: opts.maxBotChars, split: true });
  const kb = buildKnowledgePromptBlock(opts.knowledgeFolders ?? [], sim.world?.knowledgeFolderIds ?? []);
  return {
    stable: `${opts.langInjection ?? ''}${stable}${kb ? `\n\n${kb}` : ''}`,
    volatile: [buildWorldStateBlock(sim, scene), ...(opts.turnInjections ?? []).map((s) => s.trim())].filter(Boolean).join('\n\n'),
  };
}
