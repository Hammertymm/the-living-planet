import type { EvidenceKind, EvidenceRecord, PopulationMetrics } from './types';

const STORAGE_KEY = 'living-planet-intelligence-evidence-v1';
const MAX_RECORDS = 180;
const REGION_NAMES = [
  'Northern Highlands',
  'Western Basin',
  'Central Plains',
  'Eastern Wetlands',
  'Southern Ridge',
  'Coastal Flats',
];

const POPULATION_KEYS = ['plants', 'grazers', 'predators', 'scavengers', 'fungi'] as const;
type PopulationKey = (typeof POPULATION_KEYS)[number];

function numberFrom(text: string, label: string): number | undefined {
  const expression = new RegExp(`${label}\\s*[:·-]?\\s*([\\d,]+)`, 'i');
  const match = text.match(expression);
  if (!match) return undefined;
  const value = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(value) ? value : undefined;
}

function regionFromText(text: string): string | undefined {
  const lower = text.toLowerCase();
  return REGION_NAMES.find((region) => lower.includes(region.toLowerCase()));
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function percentageChange(previous: number, current: number): number {
  if (previous === 0) return current === 0 ? 0 : 1;
  return (current - previous) / previous;
}

function labelFor(key: PopulationKey): string {
  return key === 'fungi' ? 'Fungi' : `${key[0].toUpperCase()}${key.slice(1)}`;
}

export function parseMetrics(text: string): PopulationMetrics {
  const raw = cleanText(text);
  const dayMatch = raw.match(/Day\s*([\d,]+)/i);
  const season = ['Spring', 'Summer', 'Autumn', 'Winter'].find((name) => new RegExp(`\\b${name}\\b`, 'i').test(raw));

  return {
    day: dayMatch ? Number(dayMatch[1].replace(/,/g, '')) : undefined,
    season,
    plants: numberFrom(raw, 'Plants?'),
    grazers: numberFrom(raw, 'Grazers?'),
    predators: numberFrom(raw, 'Predators?'),
    scavengers: numberFrom(raw, 'Scavengers?'),
    fungi: numberFrom(raw, 'Fungi'),
    groups: numberFrom(raw, 'Groups?'),
    raw,
  };
}

export class EvidenceStore extends EventTarget {
  private records: EvidenceRecord[] = [];
  private sequence = 0;
  private lastMetrics?: PopulationMetrics;
  private lastSnapshotDay = -Infinity;
  private lastNaturalistText = '';
  private saveTimer?: number;

  constructor() {
    super();
    this.restore();
  }

  all(): EvidenceRecord[] {
    return [...this.records];
  }

  recent(limit = 40): EvidenceRecord[] {
    return this.records.slice(-limit);
  }

  clear(): void {
    this.records = [];
    this.sequence = 0;
    this.lastMetrics = undefined;
    this.lastSnapshotDay = -Infinity;
    localStorage.removeItem(STORAGE_KEY);
    this.dispatchEvent(new CustomEvent('changed'));
  }

  captureMetrics(text: string): void {
    const metrics = parseMetrics(text);
    if (!metrics.raw) return;

    const currentDay = metrics.day ?? this.lastSnapshotDay;
    const shouldSnapshot = !this.lastMetrics || currentDay - this.lastSnapshotDay >= 5;

    if (shouldSnapshot) {
      this.add('metric_snapshot', 'metrics', this.metricSummary(metrics), {
        day: metrics.day ?? null,
        season: metrics.season ?? null,
        plants: metrics.plants ?? null,
        grazers: metrics.grazers ?? null,
        predators: metrics.predators ?? null,
        scavengers: metrics.scavengers ?? null,
        fungi: metrics.fungi ?? null,
        groups: metrics.groups ?? null,
      }, metrics.day);
      this.lastSnapshotDay = currentDay;
    }

    if (this.lastMetrics) this.derivePopulationChanges(this.lastMetrics, metrics);
    this.lastMetrics = metrics;
  }

  captureExternal(
    kind: EvidenceKind,
    summary: string,
    values?: EvidenceRecord['values'],
    day?: number,
    region?: string,
    source: EvidenceRecord['source'] = 'experiment',
  ): void {
    const cleaned = cleanText(summary);
    if (!cleaned) return;
    this.add(kind, source, cleaned, values, day, region);
  }

  captureNaturalist(text: string): void {
    const cleaned = cleanText(text);
    if (!cleaned || cleaned === this.lastNaturalistText) return;
    this.lastNaturalistText = cleaned;

    const lower = cleaned.toLowerCase();
    let kind: EvidenceKind = 'naturalist_note';
    if (/rain|storm|drought|dry|winter|summer|climate|wind/.test(lower)) kind = 'climate_signal';
    if (/fire|migration|split|merged|extinct|disease|birth|recovered|formed/.test(lower)) kind = 'world_event';

    this.add(kind, 'naturalist', cleaned, undefined, this.lastMetrics?.day, regionFromText(cleaned));
  }

  private metricSummary(metrics: PopulationMetrics): string {
    const parts: string[] = [];
    if (metrics.day !== undefined) parts.push(`Day ${metrics.day}`);
    if (metrics.season) parts.push(metrics.season);
    for (const key of POPULATION_KEYS) {
      const value = metrics[key];
      if (value !== undefined) parts.push(`${labelFor(key)} ${value.toLocaleString()}`);
    }
    return parts.join(' · ') || metrics.raw;
  }

  private derivePopulationChanges(previous: PopulationMetrics, current: PopulationMetrics): void {
    for (const key of POPULATION_KEYS) {
      const before = previous[key];
      const after = current[key];
      if (before === undefined || after === undefined || before === after) continue;

      if (before > 0 && after === 0) {
        this.add('extinction', 'derived', `${labelFor(key)} fell to zero.`, {
          population: key,
          before,
          after,
          changePercent: -100,
        }, current.day);
        continue;
      }

      if (before === 0 && after > 0) {
        this.add('recovery', 'derived', `${labelFor(key)} returned after being absent.`, {
          population: key,
          before,
          after,
          changePercent: 100,
        }, current.day);
        continue;
      }

      const change = percentageChange(before, after);
      const absolute = Math.abs(after - before);
      const minimumAbsolute = key === 'plants' ? 100 : 3;
      if (Math.abs(change) < 0.18 || absolute < minimumAbsolute) continue;

      const direction = change > 0 ? 'increased' : 'declined';
      this.add('population_change', 'derived', `${labelFor(key)} ${direction} from ${before.toLocaleString()} to ${after.toLocaleString()}.`, {
        population: key,
        before,
        after,
        changePercent: Math.round(change * 100),
      }, current.day);
    }
  }

  private add(
    kind: EvidenceKind,
    source: EvidenceRecord['source'],
    summary: string,
    values?: EvidenceRecord['values'],
    day?: number,
    region?: string,
  ): void {
    const duplicate = this.records.slice(-8).some((record) => record.kind === kind && record.summary === summary && record.day === day);
    if (duplicate) return;

    this.sequence += 1;
    const record: EvidenceRecord = {
      id: `E-${String(this.sequence).padStart(4, '0')}`,
      sequence: this.sequence,
      capturedAt: Date.now(),
      day,
      region,
      kind,
      source,
      summary,
      values,
    };

    this.records.push(record);
    if (this.records.length > MAX_RECORDS) this.records.splice(0, this.records.length - MAX_RECORDS);
    this.scheduleSave();
    this.dispatchEvent(new CustomEvent('evidence', { detail: record }));
    this.dispatchEvent(new CustomEvent('changed'));
  }

  private scheduleSave(): void {
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ records: this.records, sequence: this.sequence }));
      } catch {
        // Evidence is helpful but never allowed to interrupt the simulation.
      }
    }, 400);
  }

  private restore(): void {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as { records?: EvidenceRecord[]; sequence?: number } | null;
      if (!parsed || !Array.isArray(parsed.records)) return;
      this.records = parsed.records.slice(-MAX_RECORDS);
      this.sequence = Math.max(parsed.sequence ?? 0, ...this.records.map((record) => record.sequence ?? 0), 0);
      const latestSnapshot = [...this.records].reverse().find((record) => record.kind === 'metric_snapshot');
      if (latestSnapshot?.values) {
        this.lastMetrics = {
          day: typeof latestSnapshot.values.day === 'number' ? latestSnapshot.values.day : undefined,
          season: typeof latestSnapshot.values.season === 'string' ? latestSnapshot.values.season : undefined,
          plants: typeof latestSnapshot.values.plants === 'number' ? latestSnapshot.values.plants : undefined,
          grazers: typeof latestSnapshot.values.grazers === 'number' ? latestSnapshot.values.grazers : undefined,
          predators: typeof latestSnapshot.values.predators === 'number' ? latestSnapshot.values.predators : undefined,
          scavengers: typeof latestSnapshot.values.scavengers === 'number' ? latestSnapshot.values.scavengers : undefined,
          fungi: typeof latestSnapshot.values.fungi === 'number' ? latestSnapshot.values.fungi : undefined,
          groups: typeof latestSnapshot.values.groups === 'number' ? latestSnapshot.values.groups : undefined,
          raw: latestSnapshot.summary,
        };
        this.lastSnapshotDay = this.lastMetrics.day ?? -Infinity;
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}
