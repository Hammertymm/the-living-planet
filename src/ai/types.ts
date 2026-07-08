export type EvidenceKind =
  | 'metric_snapshot'
  | 'naturalist_note'
  | 'population_change'
  | 'extinction'
  | 'recovery'
  | 'climate_signal'
  | 'world_event'
  | 'counterfactual_result'
  | 'prediction'
  | 'prediction_result'
  | 'documentary_record';

export type Confidence = 'low' | 'medium' | 'high';

export interface PopulationMetrics {
  day?: number;
  season?: string;
  plants?: number;
  grazers?: number;
  predators?: number;
  scavengers?: number;
  fungi?: number;
  groups?: number;
  raw: string;
}

export interface EvidenceRecord {
  id: string;
  sequence: number;
  capturedAt: number;
  day?: number;
  region?: string;
  kind: EvidenceKind;
  source: 'metrics' | 'naturalist' | 'derived' | 'experiment' | 'observatory';
  summary: string;
  values?: Record<string, number | string | boolean | null>;
}

export interface NaturalistAnalysis {
  headline: string;
  narrative: string;
  confidence: Confidence;
  evidenceIds: string[];
  caveats: string[];
  generatedBy: 'local' | 'cloud';
  generatedAt: number;
}

export interface AskRequest {
  question: string;
  evidence: EvidenceRecord[];
  world?: {
    name?: string;
    seed?: string;
  };
}
