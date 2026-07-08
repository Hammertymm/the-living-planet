import type { PlacementTool } from '../world/types';
import type { ExperimentResult, ExperimentScenario } from '../science/types';

export interface ScenarioIntervention {
  tool: Exclude<PlacementTool, 'observe'>;
  regionId: string;
  radius: number;
  repetitions?: number;
}

export interface WorldRecipe {
  name: string;
  seed: number;
  description: string;
  interventions: ScenarioIntervention[];
  tags: string[];
}

export type StewardObjective =
  | 'biodiversity'
  | 'grazer-recovery'
  | 'predator-balance'
  | 'drought-resilience'
  | 'soil-recovery';

export interface StewardCandidate {
  scenario: ExperimentScenario;
  regionId: string;
  label: string;
}

export interface StewardRecommendation {
  objective: StewardObjective;
  candidate: StewardCandidate;
  score: number;
  reason: string;
  result: ExperimentResult;
}

export interface MemoryMoment {
  id: string;
  day: number;
  title: string;
  text: string;
  regionId?: string;
  importance: number;
  kind: 'event' | 'lineage-birth' | 'lineage-extinction' | 'era';
}

export interface PlanetEra {
  id: string;
  startDay: number;
  endDay: number;
  name: string;
  summary: string;
  momentIds: string[];
}
