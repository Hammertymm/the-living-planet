import type { LivingPlanetBridge } from '../integration/bridge';
import type { Note, Species } from '../world/types';
import type { NaturalistPrediction, ObservatoryEvent, ObservatorySample } from './types';

interface StoredArchive {
  samples: ObservatorySample[];
  events: ObservatoryEvent[];
  predictions: NaturalistPrediction[];
  eventSequence: number;
  predictionSequence: number;
}

const MAX_SAMPLES = 180;
const MAX_EVENTS = 520;
const MAX_PREDICTIONS = 120;

function key(seed: number): string {
  return `living-planet-observatory-v3-${seed}`;
}

function average(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function noteSignature(note: Note): string {
  return `${note.day}:${note.regionId ?? ''}:${note.groupId ?? ''}:${note.text}`;
}

export class ObservatoryArchive extends EventTarget {
  private samples: ObservatorySample[] = [];
  private events: ObservatoryEvent[] = [];
  private predictions: NaturalistPrediction[] = [];
  private eventSequence = 0;
  private predictionSequence = 0;
  private lastSampleDay = -Infinity;
  private knownNotes = new Set<string>();

  constructor(private bridge: LivingPlanetBridge) {
    super();
    this.restore();
  }

  allSamples(): ObservatorySample[] {
    return [...this.samples];
  }

  allEvents(): ObservatoryEvent[] {
    return [...this.events];
  }

  allPredictions(): NaturalistPrediction[] {
    return [...this.predictions];
  }

  nextPredictionId(): string {
    this.predictionSequence += 1;
    return `P-${String(this.predictionSequence).padStart(4, '0')}`;
  }

  addPredictions(predictions: NaturalistPrediction[]): void {
    if (!predictions.length) return;
    this.predictions.push(...predictions);
    this.predictions = this.predictions.slice(-MAX_PREDICTIONS);
    this.save();
    this.dispatchEvent(new CustomEvent('predictions-changed'));
  }

  updatePrediction(prediction: NaturalistPrediction): void {
    const index = this.predictions.findIndex((candidate) => candidate.id === prediction.id);
    if (index < 0) return;
    this.predictions[index] = prediction;
    this.save();
    this.dispatchEvent(new CustomEvent('predictions-changed'));
  }

  capture(force = false): boolean {
    const world = this.bridge.worldInfo();
    const snapshot = this.bridge.snapshot();
    let changed = false;

    for (const note of this.bridge.notes()) {
      const signature = noteSignature(note);
      if (this.knownNotes.has(signature)) continue;
      this.knownNotes.add(signature);
      this.eventSequence += 1;
      this.events.push({
        id: `OE-${String(this.eventSequence).padStart(5, '0')}`,
        day: note.day,
        text: note.text.replace(/\s+/g, ' ').trim(),
        regionId: note.regionId,
        groupId: note.groupId,
        x: note.focusX,
        y: note.focusY,
        importance: note.importance ?? 1,
      });
      changed = true;
    }

    if (force || world.day - this.lastSampleDay >= 30 || this.samples.length === 0) {
      const tiles = snapshot.state.tiles;
      const counts = this.bridge.counts();
      const sample: ObservatorySample = {
        day: world.day,
        capturedAt: Date.now(),
        counts: { ...counts },
        groups: this.bridge.groups().map((group) => ({
          id: group.id,
          name: group.name,
          species: group.species,
          members: group.members,
          x: group.x,
          y: group.y,
        })),
        meanWater: average(tiles.map((tile) => tile.water)),
        meanVegetation: average(tiles.map((tile) => tile.succession)),
        meanMoisture: average(tiles.map((tile) => tile.moisture)),
        activeLineages: snapshot.state.lineages.filter((lineage) => lineage.population > 0).length,
        climateEra: snapshot.state.climateEra.kind,
        noteSignatures: this.bridge.notes().slice(0, 8).map(noteSignature),
      };
      this.samples.push(sample);
      this.samples = this.samples.slice(-MAX_SAMPLES);
      this.lastSampleDay = world.day;
      changed = true;
    }

    if (changed) {
      this.events = this.events.sort((a, b) => a.day - b.day).slice(-MAX_EVENTS);
      this.save();
      this.dispatchEvent(new CustomEvent('changed'));
    }
    return changed;
  }

  samplesSince(day: number): ObservatorySample[] {
    return this.samples.filter((sample) => sample.day >= day);
  }

  eventsSince(day: number): ObservatoryEvent[] {
    return this.events.filter((event) => event.day >= day);
  }

  latestSample(): ObservatorySample | undefined {
    return this.samples.length ? this.samples[this.samples.length - 1] : undefined;
  }

  sampleAtOrAfter(day: number): ObservatorySample | undefined {
    return this.samples.find((sample) => sample.day >= day) ?? this.latestSample();
  }

  populationTrend(species: Species, windowDays = 180): { before: number; after: number; change: number; percent: number } | undefined {
    const latest = this.latestSample();
    if (!latest) return undefined;
    const candidates = this.samples.filter((sample) => sample.day >= latest.day - windowDays);
    if (candidates.length < 2) return undefined;
    const first = candidates[0];
    const before = first.counts[species];
    const after = latest.counts[species];
    const change = after - before;
    const percent = before === 0 ? (after === 0 ? 0 : 100) : change / before * 100;
    return { before, after, change, percent };
  }

  clear(): void {
    this.samples = [];
    this.events = [];
    this.predictions = [];
    this.eventSequence = 0;
    this.predictionSequence = 0;
    this.lastSampleDay = -Infinity;
    this.knownNotes.clear();
    localStorage.removeItem(key(this.bridge.worldInfo().seed));
    this.dispatchEvent(new CustomEvent('changed'));
    this.dispatchEvent(new CustomEvent('predictions-changed'));
  }

  private save(): void {
    const stored: StoredArchive = {
      samples: this.samples,
      events: this.events,
      predictions: this.predictions,
      eventSequence: this.eventSequence,
      predictionSequence: this.predictionSequence,
    };
    try {
      localStorage.setItem(key(this.bridge.worldInfo().seed), JSON.stringify(stored));
    } catch {
      // Observatory memory is optional and must never interrupt the planet.
    }
  }

  private restore(): void {
    try {
      const parsed = JSON.parse(localStorage.getItem(key(this.bridge.worldInfo().seed)) ?? 'null') as StoredArchive | null;
      if (!parsed) return;
      this.samples = Array.isArray(parsed.samples) ? parsed.samples.slice(-MAX_SAMPLES) : [];
      this.events = Array.isArray(parsed.events) ? parsed.events.slice(-MAX_EVENTS) : [];
      this.predictions = Array.isArray(parsed.predictions) ? parsed.predictions.slice(-MAX_PREDICTIONS) : [];
      this.eventSequence = Math.max(parsed.eventSequence ?? 0, this.events.length, 0);
      this.predictionSequence = Math.max(parsed.predictionSequence ?? 0, ...this.predictions.map((prediction) => Number(prediction.id.match(/\d+$/)?.[0] ?? 0)), 0);
      this.lastSampleDay = this.samples.length ? this.samples[this.samples.length - 1].day : -Infinity;
      this.knownNotes = new Set(this.events.map((event) => `${event.day}:${event.regionId ?? ''}:${event.groupId ?? ''}:${event.text}`));
    } catch {
      localStorage.removeItem(key(this.bridge.worldInfo().seed));
    }
  }
}
