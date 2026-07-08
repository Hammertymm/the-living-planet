import type { Species } from '../world/types';

export type ExperimentScenario =
  | 'rainfall'
  | 'drought'
  | 'vegetation'
  | 'grazer-introduction'
  | 'predator-introduction'
  | 'predator-exclusion'
  | 'fungal-bloom'
  | 'fertility'
  | 'wildfire';

export interface PopulationVector {
  plant: number;
  grazer: number;
  predator: number;
  scavenger: number;
  fungi: number;
  carrion: number;
}

export interface ExperimentConfig {
  scenario: ExperimentScenario;
  regionId: string;
  horizon: number;
  replicates: number;
  radius: number;
}

export interface BranchOutcome {
  replicate: number;
  start: PopulationVector;
  end: PopulationVector;
  minimums: PopulationVector;
  maximums: PopulationVector;
  extinctions: Species[];
  diversity: number;
  stability: number;
}

export interface AggregateOutcome {
  end: PopulationVector;
  low: PopulationVector;
  high: PopulationVector;
  survivalProbability: Record<'grazer' | 'predator' | 'scavenger' | 'fungi', number>;
  meanDiversity: number;
  meanStability: number;
}

export interface ExperimentResult {
  id: string;
  createdAt: number;
  worldName: string;
  startDay: number;
  endDay: number;
  regionId: string;
  regionName: string;
  config: ExperimentConfig;
  baseline: AggregateOutcome;
  intervention: AggregateOutcome;
  deltas: PopulationVector;
  interpretation: string;
  confidence: 'exploratory' | 'moderate';
  runs: {
    baseline: BranchOutcome[];
    intervention: BranchOutcome[];
  };
}

export interface DocumentaryShot {
  id: string;
  title: string;
  caption: string;
  x: number;
  y: number;
  zoom: number;
  durationMs: number;
  day?: number;
  kind: 'establishing' | 'event' | 'group' | 'individual' | 'landscape' | 'closing';
  chapter?: string;
  evidence?: string;
}
