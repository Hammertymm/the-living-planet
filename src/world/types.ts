export type Biome = 'ocean' | 'shore' | 'grass' | 'forest' | 'rock' | 'snow';
export type Species = 'plant' | 'grazer' | 'predator' | 'scavenger' | 'fungi' | 'carrion';
export type SocialSpecies = 'grazer' | 'predator' | 'scavenger';
export type ViewMode = 'natural' | 'moisture' | 'soil' | 'pressure' | 'memory' | 'groups';
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

export interface Tile {
  elevation: number;
  moisture: number;
  fertility: number;
  heat: number;
  biome: Biome;
  pressure: number;
  trail: number;
  burn: number;
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

export interface Note {
  day: number;
  text: string;
  regionId?: string;
  groupId?: string;
  focusX?: number;
  focusY?: number;
}

export interface PlanetState {
  day: number;
  tiles: Tile[];
  entities: Entity[];
  notes: Note[];
  regions: Region[];
  groups: SocialGroup[];
  landmarks: Landmark[];
  season: number;
  seed: number;
}
