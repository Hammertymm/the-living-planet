import type { LivingPlanetBridge } from '../integration/bridge';
import type { DocumentaryShot } from '../science/types';
import { ObservatoryArchive } from './archive';
import type { FilmKind, ObservatoryEvent, ObservatoryFilm } from './types';

function clean(value: string, max = 190): string {
  const result = value.replace(/\s+/g, ' ').trim();
  return result.length <= max ? result : `${result.slice(0, max - 1).trim()}…`;
}

function eventLocation(bridge: LivingPlanetBridge, event: ObservatoryEvent): { x: number; y: number } | undefined {
  if (event.x !== undefined && event.y !== undefined) return { x: event.x, y: event.y };
  if (event.groupId) {
    const group = bridge.groups().find((candidate) => candidate.id === event.groupId);
    if (group) return { x: group.x, y: group.y };
  }
  if (event.regionId) {
    const region = bridge.regions().find((candidate) => candidate.id === event.regionId);
    if (region) return { x: region.x, y: region.y };
  }
  return undefined;
}

function eventScore(event: ObservatoryEvent, latestDay: number): number {
  const text = event.text.toLowerCase();
  let score = event.importance * 18;
  score += Math.max(0, 24 - (latestDay - event.day) / 10);
  if (/extinct|disappear|death|vanish|fire|drought|storm|split|leader|birth|recover|migration|crossing|lineage/.test(text)) score += 18;
  if (/water|rain|wetland|river|herd|pack|predator|grazer/.test(text)) score += 7;
  return score;
}

function filmWindow(kind: FilmKind, day: number): { start: number; title: string; subtitle: string } {
  if (kind === 'brief') return { start: Math.max(0, day - 60), title: 'Field Notes', subtitle: 'A short documentary from the planet’s latest verified events' };
  if (kind === 'season') return { start: Math.max(0, day - 180), title: 'A Season in Motion', subtitle: 'Migration, pressure and recovery across one ecological chapter' };
  return { start: Math.max(0, day - 720), title: 'Chronicle of an Era', subtitle: 'A long-form record assembled from planetary memory' };
}

function chooseArc(events: ObservatoryEvent[]): string {
  const text = events.map((event) => event.text.toLowerCase()).join(' ');
  if (/drought|dry|water|river/.test(text) && /herd|grazer|migration/.test(text)) return 'The Search for Water';
  if (/fire|burn|ash/.test(text) && /recover|growth|fung|soil/.test(text)) return 'After the Fire';
  if (/predator|hunt|pack/.test(text) && /herd|grazer/.test(text)) return 'Hunters and Herds';
  if (/lineage|emerged|ancestral|diverg/.test(text)) return 'The Making of New Life';
  if (/rain|storm|wetland|flood/.test(text)) return 'The Returning Rains';
  return 'A Planet in Motion';
}

function openingShot(bridge: LivingPlanetBridge, title: string, subtitle: string): DocumentaryShot {
  const camera = bridge.camera();
  return {
    id: `opening-${Date.now()}`,
    title,
    caption: `${subtitle}. Day ${bridge.worldInfo().day} on ${bridge.worldInfo().name}.`,
    x: camera.x,
    y: camera.y,
    zoom: Math.min(camera.zoom, 5.2),
    durationMs: 6_500,
    kind: 'establishing',
    chapter: 'Opening',
    evidence: `World state, day ${bridge.worldInfo().day}`,
  };
}

function eventShot(bridge: LivingPlanetBridge, event: ObservatoryEvent, index: number): DocumentaryShot | undefined {
  const location = eventLocation(bridge, event);
  if (!location) return undefined;
  const region = event.regionId ? bridge.regions().find((candidate) => candidate.id === event.regionId) : undefined;
  const group = event.groupId ? bridge.groups().find((candidate) => candidate.id === event.groupId) : undefined;
  return {
    id: `event-${event.id}-${index}`,
    title: group?.name ?? region?.name ?? `Day ${event.day}`,
    caption: clean(event.text),
    x: location.x,
    y: location.y,
    zoom: event.importance >= 3 ? 11.5 : group ? 10.5 : 8.2,
    durationMs: event.importance >= 3 ? 10_500 : 8_000,
    day: event.day,
    kind: group ? 'group' : 'event',
    chapter: event.importance >= 3 ? 'Turning point' : 'Field observation',
    evidence: event.id,
  };
}

function individualShot(bridge: LivingPlanetBridge): DocumentaryShot | undefined {
  const individuals = bridge.individuals();
  if (!individuals.length) return undefined;
  const subject = [...individuals].sort((a, b) => (b.offspring + b.kills * 2 + b.age / 220) - (a.offspring + a.kills * 2 + a.age / 220))[0];
  const group = subject.groupId ? bridge.groups().find((candidate) => candidate.id === subject.groupId) : undefined;
  const legacy = subject.species === 'predator' ? `${subject.kills} recorded hunts` : `${subject.offspring} descendants`;
  return {
    id: `individual-${subject.id}`,
    title: subject.name,
    caption: `${subject.role}. ${legacy}${group ? ` within ${group.name}` : ''}. One life through which the planet’s larger pressures become visible.`,
    x: subject.x,
    y: subject.y,
    zoom: 13,
    durationMs: 9_500,
    kind: 'individual',
    chapter: 'A life within the system',
    evidence: `Notable animal ${subject.id}`,
  };
}

function landscapeShot(bridge: LivingPlanetBridge): DocumentaryShot | undefined {
  const snapshot = bridge.snapshot();
  const era = snapshot.state.climateEra;
  const regions = bridge.regions();
  const region = regions[Math.abs(Math.floor(snapshot.state.seed + bridge.worldInfo().day / 90)) % Math.max(1, regions.length)];
  if (!region) return undefined;
  return {
    id: `landscape-${bridge.worldInfo().day}`,
    title: era.name,
    caption: `The wider landscape remains under a ${era.kind} climate regime. Water, vegetation and movement respond gradually, often before population totals reveal the full change.`,
    x: region.x,
    y: region.y,
    zoom: 6.6,
    durationMs: 8_500,
    kind: 'landscape',
    chapter: 'The wider system',
    evidence: `Climate era ${era.id}`,
  };
}

export function buildObservatoryFilm(bridge: LivingPlanetBridge, archive: ObservatoryArchive, kind: FilmKind): ObservatoryFilm {
  archive.capture(true);
  const world = bridge.worldInfo();
  const window = filmWindow(kind, world.day);
  const available = archive.eventsSince(window.start)
    .filter((event) => eventLocation(bridge, event))
    .sort((a, b) => eventScore(b, world.day) - eventScore(a, world.day));
  const limit = kind === 'brief' ? 5 : kind === 'season' ? 8 : 11;
  const selected: ObservatoryEvent[] = [];
  const regions = new Set<string>();
  for (const event of available) {
    const regionKey = event.regionId ?? event.groupId ?? event.id;
    if (selected.length < Math.ceil(limit * 0.65) || !regions.has(regionKey)) {
      selected.push(event);
      regions.add(regionKey);
    }
    if (selected.length >= limit) break;
  }
  selected.sort((a, b) => a.day - b.day);

  const arc = chooseArc(selected);
  const shots: DocumentaryShot[] = [openingShot(bridge, arc, window.subtitle)];
  const subject = individualShot(bridge);
  if (subject && kind !== 'brief') shots.push(subject);
  selected.forEach((event, index) => {
    const shot = eventShot(bridge, event, index);
    if (shot) shots.push(shot);
  });
  const landscape = landscapeShot(bridge);
  if (landscape) shots.push(landscape);
  const central = bridge.regions().find((region) => region.id === 'central') ?? bridge.regions()[0];
  if (central) {
    shots.push({
      id: `closing-${Date.now()}`,
      title: 'The planet continues',
      caption: 'This film ends, but the evidence does not. Every population, route and landscape remains in motion beyond the final frame.',
      x: central.x,
      y: central.y,
      zoom: 5.1,
      durationMs: 7_000,
      kind: 'closing',
      chapter: 'Closing observation',
      evidence: `Live world, day ${world.day}`,
    });
  }

  const title = kind === 'brief' ? `${arc}: Field Brief` : kind === 'season' ? arc : `${arc}: Chronicle of an Era`;
  const startDay = selected.length ? selected[0].day : window.start;
  const evidence = selected.map((event) => ({ day: event.day, text: event.text }));
  return {
    id: `FILM-${world.seed}-${world.day}-${kind}-${Date.now()}`,
    kind,
    title,
    subtitle: window.subtitle,
    synopsis: selected.length
      ? `${selected.length} verified events form a documentary arc spanning day ${startDay} to day ${world.day}.`
      : 'The current archive is quiet, so this film concentrates on the living world as it stands now.',
    worldName: world.name,
    worldSeed: world.seed,
    generatedDay: world.day,
    startDay,
    endDay: world.day,
    shots: shots.slice(0, kind === 'brief' ? 8 : kind === 'season' ? 12 : 16),
    evidence,
  };
}

export function filmAsMarkdown(film: ObservatoryFilm): string {
  const lines = [
    `# ${film.title}`,
    '',
    `**World:** ${film.worldName}  `,
    `**Seed:** ${film.worldSeed}  `,
    `**Days:** ${film.startDay}–${film.endDay}  `,
    `**Format:** ${film.kind}`,
    '',
    film.synopsis,
    '',
    '## Storyboard',
    '',
  ];
  film.shots.forEach((shot, index) => {
    lines.push(`### ${index + 1}. ${shot.title}`, '', shot.caption, '', `Evidence: ${shot.evidence ?? 'live simulation state'}`, '');
  });
  lines.push('## Evidence ledger', '');
  film.evidence.forEach((entry) => lines.push(`- **Day ${entry.day}:** ${entry.text}`));
  return lines.join('\n');
}
