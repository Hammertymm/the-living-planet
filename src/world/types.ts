export type Biome = 'ocean' | 'shore' | 'grass' | 'forest' | 'rock' | 'snow';
export type Species = 'plant' | 'grazer' | 'predator' | 'scavenger' | 'fungi' | 'carrion';
export type SocialSpecies = 'grazer' | 'predator' | 'scavenger';
export type ViewMode = 'natural' | 'moisture' | 'soil' | 'pressure' | 'memory' | 'groups' | 'climate';
export type PlacementTool =
  | 'observe'
  | 'plants'
  | 'grazers'
  | 'predators'
  | 'scavengers'
  | 'fungi'
  | 'rain'
  | 'drought'
  | 'fertility'
  | 'wildfire';
export type ClimateFrontKind = 'rain' | 'dry' | 'storm';
export type SeasonName = 'Spring' | 'Summer' | 'Autumn' | 'Winter';

export interface Tile {
  elevation: number;
  moisture: number;
  fertility: number;
  heat: number;
  biome: Biome;
  pressure: number;
  trail: number;
  burn: number;
  fire: number;
}

export interface Entity {
  id: number;
  species: Species;
  x: number;
  y: number;
  vx: number;
  vy: number;
  energy: number;
  age: number;
  breed: number;
  cooldown: number;
  groupId?: string;
  generation: number;
}

export interface Region {
  id: string;
  name: string;
  x: number;
  y: number;
}

export interface RoutePoint {
  x: number;
  y: number;
  day: number;
}

export interface SocialGroup {
  id: string;
  name: string;
  species: SocialSpecies;
  color: string;
  homeRegionId: string;
  targetRegionId: string;
  homeX: number;
  homeY: number;
  targetX: number;
  targetY: number;
  memberIds: number[];
  foundedDay: number;
  lastEventDay: number;
  route: RoutePoint[];
  generation: number;
}

export type LandmarkKind = 'burn-scar' | 'migration-route' | 'den' | 'grazing-ground';

export interface Landmark {
  id: string;
  name: string;
  kind: LandmarkKind;
  x: number;
  y: number;
  createdDay: number;
  strength: number;
  regionId: string;
}

export interface ClimateFront {
  id: string;
  kind: ClimateFrontKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  intensity: number;
  age: number;
  maxAge: number;
  lastRegionId?: string;
}

export interface Note {
  day: number;
  text: string;
  regionId?: string;
  groupId?: string;
  focusX?: number;
  focusY?: number;
  importance?: 1 | 2 | 3;
}

export interface PlanetState {
  day: number;
  tiles: Tile[];
  entities: Entity[];
  notes: Note[];
  regions: Region[];
  groups: SocialGroup[];
  landmarks: Landmark[];
  climateFronts: ClimateFront[];
  season: number;
  seasonName: SeasonName;
  windX: number;
  windY: number;
  seed: number;
}

export interface SimulationSnapshot {
  schemaVersion: 1;
  state: PlanetState;
  rngState: number;
  counters: {
    nextEntityId: number;
    nextGroupId: number;
    nextLandmarkId: number;
    nextClimateFrontId: number;
  };
}
