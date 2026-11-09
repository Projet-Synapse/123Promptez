// roleplayPrompt — assemble les instructions d'un tour de roleplay.
//
// `stable` : règles, monde, persona, PNJ, mémoire, dossiers de connaissances —
//            identique d'un tour à l'autre tant que la partie n'évolue pas.
// `volatile` : état de la scène (horloge, besoins) + injections du tour (mode
//            de réponse, automatisations) — change à chaque tour.
// chatService place `stable` en tête et `volatile` après l'historique : le
// moteur peut ainsi réutiliser tout le début de la requête depuis son cache.
import { buildSimulationPromptInjection, type SimulationData } from '@/types/simulation';
import { buildKnowledgePromptBlock } from '@/types/simulationKnowledge';

export interface RoleplayTurn {
  stable: string;
  volatile: string;
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
  const parts = buildSimulationPromptInjection(sim, { maxBotChars: opts.maxBotChars, split: true });
  const kb = buildKnowledgePromptBlock(opts.knowledgeFolders ?? [], sim.world?.knowledgeFolderIds ?? []);
  return {
    stable: `${opts.langInjection ?? ''}${parts.stable}${kb ? `\n\n${kb}` : ''}`,
    volatile: [parts.volatile, ...(opts.turnInjections ?? []).map((s) => s.trim())].filter(Boolean).join('\n\n'),
  };
}
