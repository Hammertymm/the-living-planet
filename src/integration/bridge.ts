import type { Lineage, Note, PlacementTool, Region, SimulationSnapshot, SocialSpecies, Species, ViewMode } from '../world/types';

export interface PlanetGroupSummary {
  id: string;
  name: string;
  species: SocialSpecies;
  color: string;
  members: number;
  generation: number;
  x: number;
  y: number;
}

export interface PlanetIndividualSummary {
  id: number;
  name: string;
  species: SocialSpecies;
  role: string;
  groupId?: string;
  x: number;
  y: number;
  age: number;
  offspring: number;
  kills: number;
}

export interface PlanetWorldInfo {
  name: string;
  seed: number;
  day: number;
  season: string;
}

export interface PlanetCameraState {
  x: number;
  y: number;
  zoom: number;
}

export interface LivingPlanetBridge {
  readonly version: string;
  snapshot(): SimulationSnapshot;
  counts(): Record<Species, number>;
  worldInfo(): PlanetWorldInfo;
  regions(): Region[];
  notes(): Note[];
  groups(): PlanetGroupSummary[];
  lineages(): Lineage[];
  individuals(): PlanetIndividualSummary[];
  camera(): PlanetCameraState;
  focus(x: number, y: number, zoom?: number): void;
  recenter(): void;
  documentary(): boolean;
  setDocumentary(enabled: boolean): void;
  paused(): boolean;
  setPaused(paused: boolean): void;
  timeRateIndex(): number;
  setTimeRateIndex(index: number): void;
  intervene(tool: PlacementTool, x: number, y: number, radius?: number, announce?: boolean): boolean;
  setView(view: ViewMode): void;
  createWorld(name: string, seed: number): Promise<void>;
}

interface BridgeOptions {
  version: string;
  snapshot: () => SimulationSnapshot;
  counts: () => Record<Species, number>;
  worldInfo: () => PlanetWorldInfo;
  regions: () => Region[];
  notes: () => Note[];
  groups: () => PlanetGroupSummary[];
  lineages: () => Lineage[];
  individuals: () => PlanetIndividualSummary[];
  camera: () => PlanetCameraState;
  focus: (x: number, y: number, zoom?: number) => void;
  recenter: () => void;
  documentary: () => boolean;
  setDocumentary: (enabled: boolean) => void;
  paused: () => boolean;
  setPaused: (paused: boolean) => void;
  timeRateIndex: () => number;
  setTimeRateIndex: (index: number) => void;
  intervene: (tool: PlacementTool, x: number, y: number, radius?: number, announce?: boolean) => boolean;
  setView: (view: ViewMode) => void;
  createWorld: (name: string, seed: number) => Promise<void>;
}

export function installLivingPlanetBridge(options: BridgeOptions): LivingPlanetBridge {
  const bridge: LivingPlanetBridge = {
    version: options.version,
    snapshot: () => structuredClone(options.snapshot()),
    counts: () => ({ ...options.counts() }),
    worldInfo: () => ({ ...options.worldInfo() }),
    regions: () => structuredClone(options.regions()),
    notes: () => structuredClone(options.notes()),
    groups: () => structuredClone(options.groups()),
    lineages: () => structuredClone(options.lineages()),
    individuals: () => structuredClone(options.individuals()),
    camera: () => ({ ...options.camera() }),
    focus: options.focus,
    recenter: options.recenter,
    documentary: options.documentary,
    setDocumentary: options.setDocumentary,
    paused: options.paused,
    setPaused: options.setPaused,
    timeRateIndex: options.timeRateIndex,
    setTimeRateIndex: options.setTimeRateIndex,
    intervene: options.intervene,
    setView: options.setView,
    createWorld: options.createWorld,
  };

  window.livingPlanet = bridge;
  window.dispatchEvent(new CustomEvent('living-planet-bridge-ready'));
  return bridge;
}

declare global {
  interface Window {
    livingPlanet?: LivingPlanetBridge;
  }
}
