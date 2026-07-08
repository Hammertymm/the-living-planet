import type { SimulationSnapshot, ViewMode } from '../world/types';

const DATABASE_NAME = 'the-living-planet';
const DATABASE_VERSION = 1;
const WORLD_STORE = 'worlds';
const META_STORE = 'world-metadata';

export interface CameraSave {
  x: number;
  y: number;
  zoom: number;
}

export interface WorldSettingsSave {
  camera: CameraSave;
  view: ViewMode;
  showLabels: boolean;
  timeRateIndex: number;
  brushRadius: number;
  directorEnabled: boolean;
}

export interface WorldSummary {
  plants: number;
  grazers: number;
  predators: number;
  scavengers: number;
  fungi: number;
  groups: number;
  landmarks: number;
}

export interface WorldSaveMetadata {
  id: string;
  name: string;
  kind: 'autosave' | 'manual';
  savedAt: number;
  day: number;
  seed: number;
  season: string;
  appVersion: string;
  summary: WorldSummary;
}

export interface WorldSave extends WorldSaveMetadata {
  format: 'the-living-planet-world';
  schemaVersion: 1;
  simulation: SimulationSnapshot;
  settings: WorldSettingsSave;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction was aborted.'));
  });
}

let databasePromise: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(WORLD_STORE)) database.createObjectStore(WORLD_STORE, { keyPath: 'id' });
      if (!database.objectStoreNames.contains(META_STORE)) {
        const metadata = database.createObjectStore(META_STORE, { keyPath: 'id' });
        metadata.createIndex('savedAt', 'savedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open the world library.'));
  });

  return databasePromise;
}

export async function saveWorld(world: WorldSave): Promise<void> {
  const stableWorld = structuredClone(world);
  const database = await openDatabase();
  const transaction = database.transaction([WORLD_STORE, META_STORE], 'readwrite');
  const metadata: WorldSaveMetadata = {
    id: stableWorld.id,
    name: stableWorld.name,
    kind: stableWorld.kind,
    savedAt: stableWorld.savedAt,
    day: stableWorld.day,
    seed: stableWorld.seed,
    season: stableWorld.season,
    appVersion: stableWorld.appVersion,
    summary: stableWorld.summary,
  };
  transaction.objectStore(WORLD_STORE).put(stableWorld);
  transaction.objectStore(META_STORE).put(metadata);
  await transactionDone(transaction);
}

export async function loadWorld(id: string): Promise<WorldSave | undefined> {
  const database = await openDatabase();
  const transaction = database.transaction(WORLD_STORE, 'readonly');
  return requestResult(transaction.objectStore(WORLD_STORE).get(id));
}

export async function listWorlds(): Promise<WorldSaveMetadata[]> {
  const database = await openDatabase();
  const transaction = database.transaction(META_STORE, 'readonly');
  const result = await requestResult(transaction.objectStore(META_STORE).getAll());
  return result.sort((a, b) => b.savedAt - a.savedAt);
}

export async function removeWorld(id: string): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction([WORLD_STORE, META_STORE], 'readwrite');
  transaction.objectStore(WORLD_STORE).delete(id);
  transaction.objectStore(META_STORE).delete(id);
  await transactionDone(transaction);
}

export function isWorldSave(value: unknown): value is WorldSave {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<WorldSave>;
  return candidate.format === 'the-living-planet-world'
    && candidate.schemaVersion === 1
    && typeof candidate.name === 'string'
    && typeof candidate.seed === 'number'
    && Boolean(candidate.simulation?.state?.tiles?.length);
}
