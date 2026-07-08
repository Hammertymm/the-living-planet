import type { LivingPlanetBridge } from '../integration/bridge';
import type { DocumentaryShot } from './types';

function trimCaption(value: string, max = 190): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trim()}…`;
}

export function buildDocumentaryPlan(bridge: LivingPlanetBridge): DocumentaryShot[] {
  const notes = bridge.notes();
  const groups = bridge.groups();
  const regions = bridge.regions();
  const camera = bridge.camera();
  const shots: DocumentaryShot[] = [];

  shots.push({
    id: 'opening',
    title: bridge.worldInfo().name,
    caption: `Day ${bridge.worldInfo().day}. A wide view of a planet whose history is still being written.`,
    x: camera.x,
    y: camera.y,
    zoom: Math.min(camera.zoom, 5.5),
    durationMs: 7_500,
    kind: 'establishing',
  });

  for (const note of notes.slice(0, 7).reverse()) {
    const region = note.regionId ? regions.find((candidate) => candidate.id === note.regionId) : undefined;
    const group = note.groupId ? groups.find((candidate) => candidate.id === note.groupId) : undefined;
    const x = note.focusX ?? group?.x ?? region?.x;
    const y = note.focusY ?? group?.y ?? region?.y;
    if (x === undefined || y === undefined) continue;
    shots.push({
      id: `note-${note.day}-${shots.length}`,
      title: group?.name ?? region?.name ?? `Day ${note.day}`,
      caption: trimCaption(note.text),
      x,
      y,
      zoom: (note.importance ?? 1) >= 3 ? 11 : group ? 10 : 8.5,
      durationMs: (note.importance ?? 1) >= 3 ? 12_000 : 9_000,
      day: note.day,
      kind: group ? 'group' : 'event',
    });
  }

  if (shots.length < 4) {
    for (const group of groups.slice(0, 4)) {
      shots.push({
        id: `group-${group.id}`,
        title: group.name,
        caption: `${group.members} ${group.species}${group.members === 1 ? '' : 's'} continue their shared history across the landscape.`,
        x: group.x,
        y: group.y,
        zoom: 10,
        durationMs: 9_000,
        kind: 'group',
      });
    }
  }

  const central = regions.find((region) => region.id === 'central') ?? regions[0];
  if (central) {
    shots.push({
      id: 'closing',
      title: 'The planet continues',
      caption: 'No conclusion is final here. Weather, hunger, recovery and memory continue beyond the frame.',
      x: central.x,
      y: central.y,
      zoom: 5.2,
      durationMs: 8_000,
      kind: 'closing',
    });
  }

  return shots.slice(0, 10);
}

export class DocumentaryDirector extends EventTarget {
  private shots: DocumentaryShot[] = [];
  private index = -1;
  private timer?: number;
  private active = false;
  private previous?: {
    camera: ReturnType<LivingPlanetBridge['camera']>;
    documentary: boolean;
    paused: boolean;
    timeRateIndex: number;
  };

  constructor(private bridge: LivingPlanetBridge) {
    super();
  }

  plan(): DocumentaryShot[] {
    this.shots = buildDocumentaryPlan(this.bridge);
    return [...this.shots];
  }

  isActive(): boolean {
    return this.active;
  }

  play(shots = this.plan()): void {
    this.stop(false);
    if (!shots.length) return;
    this.shots = shots;
    this.previous = {
      camera: this.bridge.camera(),
      documentary: this.bridge.documentary(),
      paused: this.bridge.paused(),
      timeRateIndex: this.bridge.timeRateIndex(),
    };
    this.active = true;
    this.bridge.setDocumentary(true);
    this.bridge.setPaused(false);
    this.bridge.setTimeRateIndex(1);
    this.index = -1;
    this.advance();
    this.dispatchEvent(new CustomEvent('started', { detail: { shots: [...shots] } }));
  }

  stop(restore = true): void {
    window.clearTimeout(this.timer);
    const wasActive = this.active;
    this.active = false;
    this.index = -1;
    if (restore && this.previous) {
      this.bridge.setDocumentary(this.previous.documentary);
      this.bridge.setPaused(this.previous.paused);
      this.bridge.setTimeRateIndex(this.previous.timeRateIndex);
      this.bridge.focus(this.previous.camera.x, this.previous.camera.y, this.previous.camera.zoom);
    }
    this.previous = undefined;
    if (wasActive) this.dispatchEvent(new CustomEvent('stopped'));
  }

  private advance(): void {
    if (!this.active) return;
    this.index += 1;
    if (this.index >= this.shots.length) {
      this.stop(true);
      this.dispatchEvent(new CustomEvent('finished'));
      return;
    }
    const shot = this.shots[this.index];
    this.bridge.focus(shot.x, shot.y, shot.zoom);
    this.dispatchEvent(new CustomEvent('shot', { detail: { shot, index: this.index, total: this.shots.length } }));
    this.timer = window.setTimeout(() => this.advance(), shot.durationMs);
  }
}
