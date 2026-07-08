export type Biome = 'ocean' | 'shore' | 'grass' | 'forest' | 'rock' | 'snow';
export type Species = 'plant' | 'grazer' | 'predator' | 'scavenger' | 'fungi' | 'carrion';
export type ViewMode = 'natural' | 'moisture' | 'soil' | 'life' | 'pressure';

export interface Tile { elevation: number; moisture: number; fertility: number; heat: number; biome: Biome; pressure: number; }
export interface Entity { id: number; species: Species; x: number; y: number; vx: number; vy: number; energy: number; age: number; breed: number; cooldown: number; }
export interface Note { day: number; text: string; }
export interface PlanetState { day: number; tiles: Tile[]; entities: Entity[]; notes: Note[]; season: number; seed: number; }
