import type { ClimateEraKind, Species } from '../world/types';
import type { DocumentaryShot } from '../science/types';

export type PredictionStatus = 'pending' | 'confirmed' | 'partly-confirmed' | 'refuted' | 'inconclusive';
export type PredictionKind = 'population' | 'group-survival' | 'migration' | 'climate-response';
export type PredictionDirection = 'increase' | 'decrease' | 'stable' | 'survive' | 'decline' | 'arrive';

export interface ObservatorySample {
  day: number;
  capturedAt: number;
  counts: Record<Species, number>;
  groups: Array<{ id: string; name: string; species: string; members: number; x: number; y: number }>;
  meanWater: number;
  meanVegetation: number;
  meanMoisture: number;
  activeLineages: number;
  climateEra: ClimateEraKind;
  noteSignatures: string[];
}

export interface ObservatoryEvent {
  id: string;
  day: number;
  text: string;
  regionId?: string;
  groupId?: string;
  x?: number;
  y?: number;
  importance: 1 | 2 | 3;
}

export interface NaturalistPrediction {
  id: string;
  worldSeed: number;
  createdDay: number;
  dueDay: number;
  kind: PredictionKind;
  headline: string;
  statement: string;
  rationale: string;
  confidence: 'low' | 'medium' | 'high';
  status: PredictionStatus;
  subjectId?: string;
  subjectLabel: string;
  metric?: string;
  direction: PredictionDirection;
  baselineValue?: number;
  threshold?: number;
  targetRegionId?: string;
  evidence: string[];
  resolvedDay?: number;
  outcome?: string;
  score?: number;
}

export type FilmKind = 'brief' | 'season' | 'era';

export interface ObservatoryFilm {
  id: string;
  kind: FilmKind;
  title: string;
  subtitle: string;
  synopsis: string;
  worldName: string;
  worldSeed: number;
  generatedDay: number;
  startDay: number;
  endDay: number;
  shots: DocumentaryShot[];
  evidence: Array<{ day: number; text: string }>;
}

export interface AtmosphereSettings {
  enabled: boolean;
  intensity: number;
  cycleSpeed: number;
  fog: boolean;
  cloudShadows: boolean;
}
