/** Types pour l'espace Simulation (roleplay) — étape 1 : modèle de données. */

export type ConversationKind = 'classique' | 'simulation';

export interface SimulationCharacter {
  id: string;
  name: string;
  description: string;
  /** Traits / personnalité (remplis plus tard via UI ou vault) */
  traits: string[];
  avatarColor?: string;
}

export interface SimulationMemoryEntry {
  id: string;
  text: string;
  createdAt: string; // ISO — JSON-friendly for cloud sync
}

export interface SimulationData {
  /** Monde / décor de la simulation */
  world: {
    title: string;
    synopsis: string;
    /**
     * Ids de dossiers du vault 123Écriture choisis pour le worldbuilding.
     * Remplis à l'étape d'import (pas encore branché).
     */
    knowledgeFolderIds: string[];
  };
  characters: SimulationCharacter[];
  /** Mémoire déroulante de la partie (faits à retenir) */
  memory: {
    entries: SimulationMemoryEntry[];
  };
  /** Notes libres pour le moteur RP à venir */
  notes: string;
}

/** Structure vide mais typée — prête pour l'étape 2 (moteur RP). */
export function emptySimulationData(): SimulationData {
  return {
    world: { title: '', synopsis: '', knowledgeFolderIds: [] },
    characters: [],
    memory: { entries: [] },
    notes: '',
  };
}

export function defaultTitleForKind(kind: ConversationKind): string {
  return kind === 'simulation' ? 'Nouvelle simulation' : 'Nouvelle conversation';
}
