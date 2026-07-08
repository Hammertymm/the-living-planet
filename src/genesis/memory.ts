import type { LivingPlanetBridge } from '../integration/bridge';
import type { Lineage, Note } from '../world/types';
import type { MemoryMoment, PlanetEra } from './types';

interface StoredMemory {
  moments: MemoryMoment[];
  eras: PlanetEra[];
  lineageState: Record<string, { population: number; extinctDay?: number }>;
}

const MAX_MOMENTS = 360;

function memoryKey(seed: number): string {
  return `living-planet-memory-v2-${seed}`;
}

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function noteTitle(note: Note): string {
  const text = clean(note.text);
  const first = text.split(/[.!?]/)[0];
  return first.length <= 64 ? first : `${first.slice(0, 61).trim()}…`;
}

function eraName(moments: MemoryMoment[], startDay: number): string {
  const text = moments.map((moment) => moment.text.toLowerCase()).join(' ');
  if (/fire|burn|ash|lightning/.test(text)) return 'The Ash Years';
  if (/drought|dry|water/.test(text)) return 'The Long Thirst';
  if (/rain|storm|wetland/.test(text)) return 'The Returning Rains';
  if (/lineage|emerged|ancestral/.test(text)) return 'The Age of Divergence';
  if (/migration|route|entered|crossing/.test(text)) return 'The Great Movements';
  if (/extinct|disappeared|loss/.test(text)) return 'The Quiet Decline';
  if (/fung|soil|reclaim|renewal/.test(text)) return 'The Renewal';
  return `The ${Math.floor(startDay / 360) + 1}${['st', 'nd', 'rd'][Math.min(2, Math.floor(startDay / 360))] ?? 'th'} Era`;
}

export class PlanetMemoryArchive extends EventTarget {
  private moments: MemoryMoment[] = [];
  private eras: PlanetEra[] = [];
  private lineageState: StoredMemory['lineageState'] = {};
  private noteSignatures = new Set<string>();
  private lastCaptureDay = -1;

  constructor(private bridge: LivingPlanetBridge) {
    super();
    this.restore();
  }

  allMoments(): MemoryMoment[] {
    return [...this.moments];
  }

  allEras(): PlanetEra[] {
    return [...this.eras];
  }

  clear(): void {
    this.moments = [];
    this.eras = [];
    this.lineageState = {};
    this.noteSignatures.clear();
    localStorage.removeItem(memoryKey(this.bridge.worldInfo().seed));
    this.dispatchEvent(new CustomEvent('changed'));
  }

  capture(): void {
    const world = this.bridge.worldInfo();
    if (world.day === this.lastCaptureDay) return;
    this.lastCaptureDay = world.day;
    let changed = false;

    for (const note of this.bridge.notes()) {
      const signature = `${note.day}:${note.text}`;
      if (this.noteSignatures.has(signature)) continue;
      this.noteSignatures.add(signature);
      this.moments.push({
        id: `M-${note.day}-${this.moments.length + 1}`,
        day: note.day,
        title: noteTitle(note),
        text: clean(note.text),
        regionId: note.regionId,
        importance: note.importance ?? 1,
        kind: 'event',
      });
      changed = true;
    }

    for (const lineage of this.bridge.lineages()) this.captureLineage(lineage);
    if (this.buildEras()) changed = true;

    if (changed) {
      this.moments = this.moments.sort((a, b) => a.day - b.day).slice(-MAX_MOMENTS);
      this.save();
      this.dispatchEvent(new CustomEvent('changed'));
    }
  }

  private captureLineage(lineage: Lineage): void {
    const previous = this.lineageState[lineage.id];
    if (!previous && lineage.population > 0) {
      this.moments.push({
        id: `L-${lineage.id}-birth`,
        day: lineage.foundedDay,
        title: `${lineage.name} enters the record`,
        text: `${lineage.name} emerged as a distinct ${lineage.species} lineage.`,
        regionId: lineage.regionId,
        importance: lineage.parentId ? 3 : 2,
        kind: 'lineage-birth',
      });
    }
    if (previous && previous.extinctDay === undefined && lineage.extinctDay !== undefined) {
      this.moments.push({
        id: `L-${lineage.id}-extinct-${lineage.extinctDay}`,
        day: lineage.extinctDay,
        title: `${lineage.name} disappears`,
        text: `${lineage.name} no longer has living members, though its ancestry remains in the archive.`,
        regionId: lineage.regionId,
        importance: 3,
        kind: 'lineage-extinction',
      });
    }
    this.lineageState[lineage.id] = { population: lineage.population, extinctDay: lineage.extinctDay };
  }

  private buildEras(): boolean {
    const latestDay = this.bridge.worldInfo().day;
    const completeEraCount = Math.floor(latestDay / 360);
    let changed = false;
    while (this.eras.length < completeEraCount) {
      const index = this.eras.length;
      const startDay = index * 360;
      const endDay = startDay + 359;
      const moments = this.moments.filter((moment) => moment.day >= startDay && moment.day <= endDay);
      const important = moments.filter((moment) => moment.importance >= 2);
      const name = eraName(important.length ? important : moments, startDay);
      const summary = important.length
        ? `${important.slice(0, 3).map((moment) => moment.title).join('; ')}.`
        : 'A quieter interval in which the planet continued changing without a single dominant event.';
      this.eras.push({ id: `era-${index + 1}`, startDay, endDay, name, summary, momentIds: moments.map((moment) => moment.id) });
      changed = true;
    }
    return changed;
  }

  private save(): void {
    const stored: StoredMemory = { moments: this.moments, eras: this.eras, lineageState: this.lineageState };
    try { localStorage.setItem(memoryKey(this.bridge.worldInfo().seed), JSON.stringify(stored)); } catch { /* optional memory */ }
  }

  private restore(): void {
    try {
      const parsed = JSON.parse(localStorage.getItem(memoryKey(this.bridge.worldInfo().seed)) ?? 'null') as StoredMemory | null;
      if (!parsed) return;
      this.moments = Array.isArray(parsed.moments) ? parsed.moments.slice(-MAX_MOMENTS) : [];
      this.eras = Array.isArray(parsed.eras) ? parsed.eras : [];
      this.lineageState = parsed.lineageState ?? {};
      this.noteSignatures = new Set(this.moments.filter((moment) => moment.kind === 'event').map((moment) => `${moment.day}:${moment.text}`));
    } catch {
      localStorage.removeItem(memoryKey(this.bridge.worldInfo().seed));
    }
  }
}
