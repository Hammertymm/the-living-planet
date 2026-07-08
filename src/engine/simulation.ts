import { RNG } from '../world/random';
import { generateTiles } from '../world/generator';
import { generateRegions, nearestRegion } from '../world/regions';
import { groupCentroid, groupColor, groupName } from '../world/groups';
import { averageGenome, genomeDistance, lineageColor, lineageName, mutateGenome, randomGenome, traitSummary } from '../world/genetics';
import type {
  ClimateFront,
  ClimateFrontKind,
  Entity,
  Genome,
  LandmarkKind,
  Lineage,
  LineageSpecies,
  PlacementTool,
  PlanetState,
  Region,
  SocialGroup,
  SocialSpecies,
  Species,
  SeasonName,
  SimulationSnapshot,
  Tile,
} from '../world/types';

const W = 180;
const H = 110;
const MAX_ENTITIES = 2600;
let nextId = 1;
let nextGroupId = 1;
let nextLandmarkId = 1;
let nextClimateFrontId = 1;
let nextLineageId = 1;

export interface SimulationCounterState {
  nextEntityId: number;
  nextGroupId: number;
  nextLandmarkId: number;
  nextClimateFrontId: number;
  nextLineageId: number;
}

export function captureSimulationCounters(): SimulationCounterState {
  return {
    nextEntityId: nextId,
    nextGroupId,
    nextLandmarkId,
    nextClimateFrontId,
    nextLineageId,
  };
}

export function restoreSimulationCounters(counters: SimulationCounterState): void {
  nextId = counters.nextEntityId;
  nextGroupId = counters.nextGroupId;
  nextLandmarkId = counters.nextLandmarkId;
  nextClimateFrontId = counters.nextClimateFrontId;
  nextLineageId = counters.nextLineageId ?? nextLineageId;
}

function idx(x: number, y: number): number {
  return Math.max(0, Math.min(W - 1, Math.floor(x))) + Math.max(0, Math.min(H - 1, Math.floor(y))) * W;
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function cap(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isSocial(species: Species): species is SocialSpecies {
  return species === 'grazer' || species === 'predator' || species === 'scavenger';
}

function entity(
  species: Species,
  x: number,
  y: number,
  rng: RNG,
  groupId?: string,
  breed = rng.int(0, 5),
  generation = 0,
  genome = randomGenome(species, rng),
  lineageId?: string,
): Entity {
  return {
    id: nextId++,
    species,
    x,
    y,
    vx: rng.range(-0.25, 0.25),
    vy: rng.range(-0.25, 0.25),
    energy: species === 'predator' ? 90 : species === 'grazer' ? 70 : species === 'scavenger' ? 58 : 40,
    age: 0,
    breed,
    cooldown: 0,
    groupId,
    generation,
    genome,
    lineageId,
  };
}

function isLand(tile: Tile): boolean {
  return tile.biome !== 'ocean' && tile.biome !== 'rock' && tile.biome !== 'snow';
}

interface RegionResources {
  plant: number;
  grazer: number;
  predator: number;
  scavenger: number;
  fungi: number;
  carrion: number;
}

export class Simulation {
  readonly width = W;
  readonly height = H;
  state: PlanetState;
  rng: RNG;

  constructor(seed = Date.now() % 999999) {
    this.rng = new RNG(seed);
    const tiles = generateTiles(W, H, seed);
    this.state = {
      day: 0,
      tiles,
      entities: [],
      notes: [],
      regions: generateRegions(tiles, W, H),
      groups: [],
      landmarks: [],
      climateFronts: [],
      lineages: [],
      season: 0,
      seasonName: 'Spring',
      windX: 0.035,
      windY: 0.008,
      seed,
    };
    this.seedLife();
    this.refreshLineages(false);
    this.seedClimate();
    this.note('A young planet settles into motion. Its first herds and hunting lineages begin to make places into territories.', 'central', undefined, undefined, undefined, 2);
  }

  private region(id: string): Region {
    return this.state.regions.find((region) => region.id === id) ?? this.state.regions[0];
  }

  private randomRegion(): Region {
    return this.rng.pick(this.state.regions);
  }

  regionAt(x: number, y: number): Region {
    return nearestRegion(this.state.regions, x, y);
  }

  tileAt(x: number, y: number): Tile {
    return this.state.tiles[idx(x, y)];
  }

  isLandAt(x: number, y: number): boolean {
    return isLand(this.tileAt(x, y));
  }

  localCounts(x: number, y: number, radius = 8): Record<Species, number> {
    const result: Record<Species, number> = { plant: 0, grazer: 0, predator: 0, scavenger: 0, fungi: 0, carrion: 0 };
    const radiusSquared = radius * radius;
    for (const current of this.state.entities) {
      const dx = current.x - x;
      const dy = current.y - y;
      if (dx * dx + dy * dy <= radiusSquared) result[current.species] += 1;
    }
    return result;
  }

  private landPoint(): { x: number; y: number } {
    for (let i = 0; i < 500; i += 1) {
      const x = this.rng.int(5, W - 6);
      const y = this.rng.int(5, H - 6);
      if (isLand(this.state.tiles[idx(x, y)])) return { x, y };
    }
    return { x: W / 2, y: H / 2 };
  }

  private pointNearXY(x: number, y: number, radius = 12, requireLand = true): { x: number; y: number } | undefined {
    for (let i = 0; i < 180; i += 1) {
      const angle = this.rng.range(0, Math.PI * 2);
      const distance = Math.sqrt(this.rng.next()) * radius;
      const px = cap(x + Math.cos(angle) * distance, 1, W - 2);
      const py = cap(y + Math.sin(angle) * distance, 1, H - 2);
      if (!requireLand || isLand(this.state.tiles[idx(px, py)])) return { x: px, y: py };
    }
    return requireLand && this.isLandAt(x, y) ? { x, y } : undefined;
  }

  private affectCircle(x: number, y: number, radius: number, effect: (tile: Tile, strength: number) => void): void {
    const minX = Math.max(0, Math.floor(x - radius));
    const maxX = Math.min(W - 1, Math.ceil(x + radius));
    const minY = Math.max(0, Math.floor(y - radius));
    const maxY = Math.min(H - 1, Math.ceil(y + radius));
    for (let py = minY; py <= maxY; py += 1) {
      for (let px = minX; px <= maxX; px += 1) {
        const distance = Math.hypot(px - x, py - y);
        if (distance > radius) continue;
        const strength = 1 - distance / Math.max(1, radius);
        effect(this.state.tiles[px + py * W], strength);
      }
    }
  }

  private createLineage(
    species: LineageSpecies,
    x: number,
    y: number,
    parentId?: string,
    sourceGenome?: Genome,
  ): Lineage {
    const region = this.regionAt(x, y);
    const serial = nextLineageId++;
    const genome = sourceGenome ? mutateGenome(sourceGenome, this.rng, parentId ? 0.035 : 0.08) : randomGenome(species, this.rng);
    const lineage: Lineage = {
      id: `lineage-${serial}`,
      name: lineageName(species, genome, region, serial),
      species,
      color: lineageColor(species, genome, serial),
      foundedDay: this.state.day,
      parentId,
      regionId: region.id,
      genome,
      population: 0,
      peakPopulation: 0,
    };
    this.state.lineages.push(lineage);
    return lineage;
  }

  private activeLineage(id?: string): Lineage | undefined {
    return id ? this.state.lineages.find((lineage) => lineage.id === id && lineage.extinctDay === undefined) : undefined;
  }

  private offspring(parent: Entity, x: number, y: number, groupId = parent.groupId): Entity {
    const genome = mutateGenome(parent.genome, this.rng);
    let lineage = this.activeLineage(parent.lineageId);
    const divergence = lineage ? genomeDistance(genome, lineage.genome) : 0;
    const canSpeciate = parent.species !== 'carrion'
      && parent.generation >= 3
      && this.state.day - (lineage?.foundedDay ?? 0) > 180
      && this.rng.next() < 0.018
      && divergence > 0.04;

    if (canSpeciate && parent.species !== 'carrion') {
      lineage = this.createLineage(parent.species, x, y, parent.lineageId, genome);
      const region = this.regionAt(x, y);
      this.note(
        `${lineage.name} has emerged in the ${region.name}. Its ${traitSummary(lineage.genome)} now separates it from its ancestral lineage.`,
        region.id,
        groupId,
        x,
        y,
        3,
      );
    }

    return entity(
      parent.species,
      x,
      y,
      this.rng,
      groupId,
      parent.breed,
      parent.generation + 1,
      genome,
      lineage?.id ?? parent.lineageId,
    );
  }

  private refreshLineages(announce = false): void {
    const members = new Map<string, Entity[]>();
    for (const current of this.state.entities) {
      if (!current.lineageId || current.species === 'carrion') continue;
      const bucket = members.get(current.lineageId) ?? [];
      bucket.push(current);
      members.set(current.lineageId, bucket);
    }

    for (const lineage of this.state.lineages) {
      const current = members.get(lineage.id) ?? [];
      const before = lineage.population;
      lineage.population = current.length;
      lineage.peakPopulation = Math.max(lineage.peakPopulation, current.length);
      if (current.length > 0) {
        lineage.extinctDay = undefined;
        if (this.state.day % 120 === 0) lineage.genome = averageGenome(current.map((entity) => entity.genome));
      } else if (lineage.extinctDay === undefined && this.state.day - lineage.foundedDay > 60) {
        lineage.extinctDay = this.state.day;
        if (announce && before > 0) {
          const region = this.region(lineage.regionId);
          this.note(`${lineage.name} has disappeared from the living record of the ${region.name}. Its ancestry remains in the planet's archive.`, region.id, undefined, region.x, region.y, 3);
        }
      }
    }

    if (announce && this.state.day > 0 && this.state.day % 360 === 0 && this.state.lineages.length < 80) {
      const candidates = this.state.lineages.filter((lineage) => lineage.population >= (lineage.species === 'plant' ? 80 : 8));
      if (candidates.length && this.rng.next() < 0.78) {
        const parent = this.rng.pick(candidates);
        const parentMembers = members.get(parent.id) ?? [];
        if (parentMembers.length >= 4) {
          const founder = this.rng.pick(parentMembers);
          const childLineage = this.createLineage(parent.species, founder.x, founder.y, parent.id, parent.genome);
          const transferCount = Math.max(2, Math.min(Math.floor(parentMembers.length * 0.18), parent.species === 'plant' ? 45 : 9));
          const stride = Math.max(1, Math.floor(parentMembers.length / transferCount));
          let transferred = 0;
          for (let index = this.rng.int(0, Math.max(0, stride - 1)); index < parentMembers.length && transferred < transferCount; index += stride) {
            const member = parentMembers[index];
            member.lineageId = childLineage.id;
            member.genome = mutateGenome(parent.genome, this.rng, 0.13);
            transferred += 1;
          }
          childLineage.population = transferred;
          childLineage.peakPopulation = transferred;
          const region = this.regionAt(founder.x, founder.y);
          this.note(
            `${childLineage.name} has separated from ${parent.name} in the ${region.name}. Its ${traitSummary(childLineage.genome)} marks the beginning of a new branch.`,
            region.id,
            founder.groupId,
            founder.x,
            founder.y,
            3,
          );
        }
      }
    }

    const active = this.state.lineages.filter((lineage) => lineage.population > 0);
    const extinct = this.state.lineages.filter((lineage) => lineage.population === 0).slice(-Math.max(0, 120 - active.length));
    this.state.lineages = [...active, ...extinct];
  }

  private seedClusterAt(
    species: Species,
    count: number,
    x: number,
    y: number,
    radius = 10,
    groupId?: string,
    breed?: number,
    generation = 0,
    lineageId?: string,
    sourceGenome?: Genome,
  ): number[] {
    const ids: number[] = [];
    let lineage = this.activeLineage(lineageId);
    if (!lineage && species !== 'carrion') lineage = this.createLineage(species, x, y, undefined, sourceGenome);
    for (let i = 0; i < count && this.state.entities.length < MAX_ENTITIES; i += 1) {
      const point = this.pointNearXY(x, y, radius, true);
      if (!point) continue;
      const created = entity(species, point.x, point.y, this.rng, groupId, breed, generation, lineage?.genome ?? randomGenome(species, this.rng), lineage?.id);
      this.state.entities.push(created);
      ids.push(created.id);
    }
    return ids;
  }

  private addLandmark(kind: LandmarkKind, name: string, x: number, y: number, region: Region, strength = 1): void {
    this.state.landmarks.unshift({
      id: `landmark-${nextLandmarkId++}`,
      name,
      kind,
      x,
      y,
      createdDay: this.state.day,
      strength,
      regionId: region.id,
    });
    this.state.landmarks = this.state.landmarks.slice(0, 28);
  }

  private createSocialGroup(
    species: SocialSpecies,
    count: number,
    x: number,
    y: number,
    radius: number,
    announce = false,
    inheritedGeneration = 0,
  ): SocialGroup | undefined {
    if (this.state.entities.length >= MAX_ENTITIES) return undefined;
    const region = this.regionAt(x, y);
    const serial = nextGroupId++;
    const id = `group-${serial}`;
    const group: SocialGroup = {
      id,
      name: groupName(species, serial, region),
      species,
      color: groupColor(species, serial),
      homeRegionId: region.id,
      targetRegionId: region.id,
      homeX: x,
      homeY: y,
      targetX: x,
      targetY: y,
      memberIds: [],
      foundedDay: this.state.day,
      lastEventDay: this.state.day,
      route: [{ x, y, day: this.state.day }],
      generation: inheritedGeneration,
    };
    const breed = serial % 6;
    const lineage = this.createLineage(species, x, y);
    group.color = lineage.color;
    group.memberIds = this.seedClusterAt(species, count, x, y, radius, id, breed, inheritedGeneration, lineage.id, lineage.genome);
    if (group.memberIds.length === 0) return undefined;
    this.state.groups.push(group);

    if (species === 'predator') this.addLandmark('den', `${group.name} den`, x, y, region, 0.85);
    if (species === 'grazer') this.addLandmark('grazing-ground', `${group.name} first range`, x, y, region, 0.62);

    if (announce) {
      const phrase = species === 'grazer'
        ? `${group.name} has entered the ${region.name}. The herd now has a history that can be followed.`
        : species === 'predator'
          ? `${group.name} has established itself in the ${region.name}. Nearby herds will learn the shape of its territory.`
          : `${group.name} gathers over the ${region.name}, following the planet's cycle of loss and renewal.`;
      this.note(phrase, region.id, group.id, x, y);
    }
    return group;
  }

  seedLife(): void {
    for (let cluster = 0; cluster < 4; cluster += 1) {
      const point = this.landPoint();
      this.seedClusterAt('plant', cluster === 0 ? 250 : 200, point.x, point.y, 26);
    }
    for (let cluster = 0; cluster < 3; cluster += 1) {
      const point = this.landPoint();
      this.seedClusterAt('fungi', cluster === 0 ? 35 : 25, point.x, point.y, 20);
    }

    const initialGroups: Array<[SocialSpecies, number, string, number]> = [
      ['grazer', 22, 'central', 10],
      ['grazer', 18, 'west', 9],
      ['grazer', 17, 'east', 9],
      ['grazer', 15, 'coast', 8],
      ['predator', 5, 'north', 7],
      ['predator', 4, 'south', 7],
      ['predator', 4, 'west', 6],
      ['scavenger', 10, 'central', 11],
      ['scavenger', 9, 'coast', 10],
    ];
    for (const [species, count, regionId, radius] of initialGroups) {
      const region = this.region(regionId);
      const fallback = this.pointNearXY(region.x, region.y, 8, true) ?? { x: region.x, y: region.y };
      const point = this.resourceHotspot(species, region, fallback);
      this.createSocialGroup(species, count, point.x, point.y, radius, false);
    }
  }

  counts(): Record<Species, number> {
    const counts: Record<Species, number> = { plant: 0, grazer: 0, predator: 0, scavenger: 0, fungi: 0, carrion: 0 };
    for (const current of this.state.entities) counts[current.species] += 1;
    return counts;
  }

  note(
    text: string,
    regionId?: string,
    groupId?: string,
    focusX?: number,
    focusY?: number,
    importance: 1 | 2 | 3 = 1,
  ): void {
    this.state.notes.unshift({ day: this.state.day, text, regionId, groupId, focusX, focusY, importance });
    this.state.notes = this.state.notes.slice(0, 16);
  }

  private seasonFor(value: number): SeasonName {
    if (value < 0.25) return 'Spring';
    if (value < 0.5) return 'Summer';
    if (value < 0.75) return 'Autumn';
    return 'Winter';
  }

  private createClimateFront(
    kind: ClimateFrontKind,
    x: number,
    y: number,
    radius = 16,
    intensity = 0.7,
    announce = false,
  ): ClimateFront {
    const seasonalAngle = this.state.season * Math.PI * 2;
    const baseSpeed = kind === 'storm' ? 0.16 : 0.1;
    const front: ClimateFront = {
      id: `front-${nextClimateFrontId++}`,
      kind,
      x,
      y,
      vx: Math.cos(seasonalAngle * 0.45 + this.rng.range(-0.6, 0.6)) * baseSpeed + 0.05,
      vy: Math.sin(seasonalAngle * 0.65 + this.rng.range(-0.7, 0.7)) * baseSpeed,
      radius: cap(radius, 7, 28),
      intensity: cap(intensity, 0.25, 1),
      age: 0,
      maxAge: this.rng.int(420, 760),
    };
    this.state.climateFronts.push(front);
    if (announce) {
      const region = this.regionAt(x, y);
      const phrase = kind === 'rain'
        ? `A sustained rain front begins crossing the ${region.name}. Its path will remain visible in the response of soil and vegetation.`
        : kind === 'storm'
          ? `A storm cell forms over the ${region.name}. Heavy rain and lightning now travel together.`
          : `A dry air mass settles over the ${region.name}, drawing moisture from soil as it moves.`;
      this.note(phrase, region.id, undefined, x, y, kind === 'storm' ? 2 : 1);
    }
    return front;
  }

  private seedClimate(): void {
    this.createClimateFront('rain', 18, 28, 18, 0.65, false);
    this.createClimateFront('dry', 155, 72, 20, 0.48, false);
    this.createClimateFront('rain', 68, 8, 13, 0.52, false);
  }

  private ignite(x: number, y: number, radius = 4, announce = true): void {
    const region = this.regionAt(x, y);
    this.affectCircle(x, y, radius, (tile, strength) => {
      if (tile.biome === 'ocean' || tile.biome === 'rock' || tile.biome === 'snow') return;
      tile.fire = cap(tile.fire + 0.92 * strength, 0, 1);
      tile.burn = cap(tile.burn + 0.45 * strength, 0, 1);
      tile.moisture = cap(tile.moisture - 0.18 * strength, 0, 1);
    });
    this.addLandmark('burn-scar', `The ${region.name} burn`, x, y, region, 1);
    if (announce) this.note(`Lightning has ignited dry growth in the ${region.name}. Wind now determines whether the fire fades or becomes a landscape event.`, region.id, undefined, x, y, 3);
  }

  private updateClimate(): void {
    const angle = this.state.season * Math.PI * 2;
    this.state.windX = Math.cos(angle * 0.72 + this.state.seed * 0.001) * 0.045 + Math.sin(this.state.day / 240) * 0.018;
    this.state.windY = Math.sin(angle * 0.88 + this.state.seed * 0.0007) * 0.032 + Math.cos(this.state.day / 310) * 0.012;

    if (this.state.day % 150 === 1 && this.state.climateFronts.length < 5) {
      const summerBias = this.state.seasonName === 'Summer';
      const winterBias = this.state.seasonName === 'Winter';
      const roll = this.rng.next();
      const kind: ClimateFrontKind = roll < (summerBias ? 0.47 : 0.24)
        ? 'dry'
        : roll > (winterBias ? 0.74 : 0.88)
          ? 'storm'
          : 'rain';
      const fromWest = this.rng.next() < 0.68;
      const x = fromWest ? -18 : W + 18;
      const y = this.rng.range(8, H - 8);
      const front = this.createClimateFront(kind, x, y, this.rng.range(12, 23), this.rng.range(0.45, 0.9), false);
      front.vx = fromWest ? Math.abs(front.vx) + 0.05 : -Math.abs(front.vx) - 0.05;
    }

    for (const front of this.state.climateFronts) {
      front.age += 1;
      front.x += front.vx + this.state.windX * 0.45;
      front.y += front.vy + this.state.windY * 0.45;
      front.vx = cap(front.vx + this.rng.range(-0.0025, 0.0025), -0.22, 0.22);
      front.vy = cap(front.vy + this.rng.range(-0.002, 0.002), -0.15, 0.15);

      if (front.x >= 0 && front.x < W && front.y >= 0 && front.y < H) {
        this.affectCircle(front.x, front.y, front.radius, (tile, strength) => {
          const force = strength * front.intensity;
          if (front.kind === 'dry') {
            tile.moisture = cap(tile.moisture - 0.0026 * force, 0, 1);
            tile.heat = cap(tile.heat + 0.0008 * force, 0, 1);
          } else {
            tile.moisture = cap(tile.moisture + (front.kind === 'storm' ? 0.0048 : 0.0029) * force, 0, 1);
            tile.fertility = cap(tile.fertility + 0.00035 * force, 0, 1);
            tile.heat = cap(tile.heat - 0.00035 * force, 0, 1);
          }
        });

        const region = this.regionAt(front.x, front.y);
        if (region.id !== front.lastRegionId && front.age > 35) {
          front.lastRegionId = region.id;
          if (this.rng.next() < 0.42) {
            const phrase = front.kind === 'dry'
              ? `A dry front is moving through the ${region.name}. Water-dependent groups are beginning to reconsider their routes.`
              : front.kind === 'storm'
                ? `A storm front reaches the ${region.name}, renewing wetlands while exposing dry high ground to lightning.`
                : `Rain is now crossing the ${region.name}, favouring fresh plant growth along its path.`;
            this.note(phrase, region.id, undefined, front.x, front.y, front.kind === 'storm' ? 2 : 1);
          }
        }

        if (front.kind === 'storm' && this.state.day % 7 === 0 && this.rng.next() < 0.013 * front.intensity) {
          const strikeX = cap(front.x + this.rng.range(-front.radius * 0.65, front.radius * 0.65), 2, W - 3);
          const strikeY = cap(front.y + this.rng.range(-front.radius * 0.65, front.radius * 0.65), 2, H - 3);
          const tile = this.tileAt(strikeX, strikeY);
          if (isLand(tile) && tile.moisture < 0.42) this.ignite(strikeX, strikeY, this.rng.range(3, 6), true);
        }
      }
    }

    this.state.climateFronts = this.state.climateFronts.filter((front) => (
      front.age < front.maxAge
      && front.x > -45
      && front.x < W + 45
      && front.y > -40
      && front.y < H + 40
    ));
  }

  private updateFire(): void {
    const active: number[] = [];
    for (let index = 0; index < this.state.tiles.length; index += 1) {
      const tile = this.state.tiles[index];
      if (tile.fire <= 0.01) {
        tile.fire = 0;
        continue;
      }
      active.push(index);
      tile.moisture = cap(tile.moisture - tile.fire * 0.0055, 0, 1);
      tile.fertility = cap(tile.fertility + tile.fire * 0.00055, 0, 1);
      tile.burn = cap(Math.max(tile.burn, tile.fire * 0.9), 0, 1);
      tile.fire *= tile.moisture > 0.58 ? 0.83 : 0.925;
    }

    if (this.state.day % 3 !== 0 || active.length === 0) return;
    const samples = active.length > 180 ? active.filter((_, index) => index % Math.ceil(active.length / 180) === 0) : active;
    for (const index of samples) {
      const source = this.state.tiles[index];
      if (source.fire < 0.18) continue;
      const x = index % W;
      const y = Math.floor(index / W);
      const windStepX = this.state.windX >= 0 ? 1 : -1;
      const windStepY = this.state.windY >= 0 ? 1 : -1;
      const options = [
        [windStepX, 0],
        [windStepX, windStepY],
        [0, windStepY],
        [this.rng.pick([-1, 1]), this.rng.pick([-1, 1])],
      ];
      const [dx, dy] = this.rng.pick(options);
      const nx = cap(x + dx, 0, W - 1);
      const ny = cap(y + dy, 0, H - 1);
      const target = this.state.tiles[idx(nx, ny)];
      if (!isLand(target) || target.moisture > 0.7) continue;
      const chance = source.fire * (1 - target.moisture) * 0.34;
      if (this.rng.next() < chance) target.fire = cap(target.fire + source.fire * 0.52, 0, 1);
    }
  }

  private groupPositions(): Map<number, { x: number; y: number }> {
    const positions = new Map<number, { x: number; y: number }>();
    for (const current of this.state.entities) positions.set(current.id, { x: current.x, y: current.y });
    return positions;
  }

  groupLocation(group: SocialGroup): { x: number; y: number } {
    return groupCentroid(group, this.groupPositions());
  }

  private refreshGroupMembership(announceExtinction = false): void {
    const members = new Map<string, number[]>();
    for (const current of this.state.entities) {
      if (!current.groupId) continue;
      const bucket = members.get(current.groupId) ?? [];
      bucket.push(current.id);
      members.set(current.groupId, bucket);
    }

    const survivors: SocialGroup[] = [];
    for (const group of this.state.groups) {
      group.memberIds = members.get(group.id) ?? [];
      if (group.memberIds.length > 0) {
        survivors.push(group);
      } else if (announceExtinction) {
        const region = this.region(group.targetRegionId);
        this.note(`${group.name} has vanished from the ${region.name}. Its old paths remain in the landscape even after the group itself is gone.`, region.id, group.id, group.targetX, group.targetY);
      }
    }
    this.state.groups = survivors;
  }

  private regionResources(): Map<string, RegionResources> {
    const resources = new Map<string, RegionResources>();
    for (const region of this.state.regions) {
      resources.set(region.id, { plant: 0, grazer: 0, predator: 0, scavenger: 0, fungi: 0, carrion: 0 });
    }
    for (const current of this.state.entities) {
      const region = this.regionAt(current.x, current.y);
      resources.get(region.id)![current.species] += 1;
    }
    return resources;
  }

  private resourceHotspot(
    species: SocialSpecies,
    region: Region,
    origin: { x: number; y: number } = { x: region.x, y: region.y },
  ): { x: number; y: number } {
    const foodSpecies: Species = species === 'grazer' ? 'plant' : species === 'predator' ? 'grazer' : 'carrion';
    const candidates = this.state.entities.filter((current) =>
      current.species === foodSpecies
      && current.energy > 0
      && this.regionAt(current.x, current.y).id === region.id,
    );
    if (candidates.length === 0) return { x: region.x, y: region.y };

    const stride = Math.max(1, Math.floor(candidates.length / 36));
    let best = candidates[0];
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let index = this.rng.int(0, Math.max(0, stride - 1)); index < candidates.length; index += stride) {
      const candidate = candidates[index];
      let nearbyFood = 0;
      for (let sample = 0; sample < candidates.length; sample += Math.max(1, Math.floor(candidates.length / 80))) {
        if (dist(candidate, candidates[sample]) < 9) nearbyFood += 1;
      }
      const travelPenalty = dist(candidate, origin) * 0.055;
      const score = nearbyFood - travelPenalty + this.rng.range(-0.8, 0.8);
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    return { x: best.x, y: best.y };
  }

  private redirectGroups(): void {
    const resources = this.regionResources();
    for (const group of this.state.groups) {
      let bestRegion = this.region(group.targetRegionId);
      let bestScore = Number.NEGATIVE_INFINITY;
      for (const region of this.state.regions) {
        const local = resources.get(region.id)!;
        const pressure = this.tileAt(region.x, region.y).pressure;
        let score = 0;
        if (group.species === 'grazer') score = local.plant * 1.5 - local.grazer * 2.2 - local.predator * 7 - pressure * 45;
        if (group.species === 'predator') score = local.grazer * 6 - local.predator * 9 + local.carrion * 0.6;
        if (group.species === 'scavenger') score = local.carrion * 9 + local.predator * 1.5 - local.scavenger * 4;
        score += this.rng.range(-8, 8);
        if (score > bestScore) {
          bestScore = score;
          bestRegion = region;
        }
      }

      const previous = this.region(group.targetRegionId);
      const current = this.groupLocation(group);
      const nextTarget = this.resourceHotspot(group.species, bestRegion, current);
      const changedRegion = bestRegion.id !== group.targetRegionId;
      const shiftedRange = Math.hypot(group.targetX - nextTarget.x, group.targetY - nextTarget.y) > 8;
      group.targetRegionId = bestRegion.id;
      group.targetX = nextTarget.x;
      group.targetY = nextTarget.y;

      if (changedRegion) {
        group.route.push({ x: current.x, y: current.y, day: this.state.day });
        group.route = group.route.slice(-12);
        group.lastEventDay = this.state.day;
        this.addLandmark('migration-route', `${group.name} crossing`, current.x, current.y, this.regionAt(current.x, current.y), 0.72);
        this.note(`${group.name} has turned away from the ${previous.name} and begun moving toward the ${bestRegion.name}. Food, carrion and pressure are redrawing its route.`, bestRegion.id, group.id, current.x, current.y);
      } else if (shiftedRange) {
        group.route.push({ x: current.x, y: current.y, day: this.state.day });
        group.route = group.route.slice(-12);
      }
    }
  }

  private splitLargeHerd(): void {
    const candidates = this.state.groups.filter((group) => group.species === 'grazer' && group.memberIds.length >= 46 && this.state.day - group.lastEventDay > 210);
    if (candidates.length === 0 || this.state.groups.filter((group) => group.species === 'grazer').length >= 9) return;
    const source = this.rng.pick(candidates);
    const positions = this.groupPositions();
    const center = groupCentroid(source, positions);
    const region = this.regionAt(center.x, center.y);
    const serial = nextGroupId++;
    const childId = `group-${serial}`;
    const selected = source.memberIds.filter((_, index) => index % 2 === 0);
    if (selected.length < 8) return;
    const selectedSet = new Set(selected);
    for (const current of this.state.entities) {
      if (selectedSet.has(current.id)) current.groupId = childId;
    }
    source.memberIds = source.memberIds.filter((id) => !selectedSet.has(id));
    source.lastEventDay = this.state.day;
    const child: SocialGroup = {
      id: childId,
      name: groupName('grazer', serial, region),
      species: 'grazer',
      color: groupColor('grazer', serial),
      homeRegionId: region.id,
      targetRegionId: region.id,
      homeX: center.x,
      homeY: center.y,
      targetX: center.x,
      targetY: center.y,
      memberIds: selected,
      foundedDay: this.state.day,
      lastEventDay: this.state.day,
      route: [{ x: center.x, y: center.y, day: this.state.day }],
      generation: source.generation + 1,
    };
    this.state.groups.push(child);
    this.addLandmark('grazing-ground', `${child.name} birthplace`, center.x, center.y, region, 0.68);
    this.note(`${source.name} has divided in the ${region.name}. The younger animals now travel as ${child.name}, creating a new thread in the planet's living history.`, region.id, child.id, center.x, center.y);
  }

  private seasonalGrazerBirths(): void {
    if (this.state.seasonName !== 'Spring' || this.state.day % 45 !== 0 || this.state.entities.length >= MAX_ENTITIES) return;

    const resources = this.regionResources();
    const entityById = new Map(this.state.entities.map((current) => [current.id, current]));
    for (const group of this.state.groups) {
      if (group.species !== 'grazer' || group.memberIds.length < 2) continue;
      const members = group.memberIds.map((id) => entityById.get(id)).filter((current): current is Entity => Boolean(current));
      if (members.length < 2) continue;

      const region = this.region(group.targetRegionId);
      const local = resources.get(region.id);
      if (!local) continue;
      const foodPerGrazer = local.plant / Math.max(1, local.grazer);
      const predatorRatio = local.predator / Math.max(1, local.grazer);
      const averageEnergy = members.reduce((total, member) => total + member.energy, 0) / members.length;
      if (foodPerGrazer < 2.4 || averageEnergy < 28 || predatorRatio > 0.42) continue;

      const carryingCapacity = Math.max(8, Math.floor(local.plant / 2.5));
      const availableCapacity = Math.max(0, carryingCapacity - local.grazer);
      if (availableCapacity === 0) continue;

      const birthRate = cap(0.10 + Math.min(0.12, foodPerGrazer * 0.018) - Math.min(0.07, predatorRatio * 0.16), 0.08, 0.22);
      const desiredBirths = Math.max(1, Math.floor(members.length * birthRate + this.rng.next()));
      const births = Math.min(5, desiredBirths, availableCapacity, MAX_ENTITIES - this.state.entities.length);
      let born = 0;
      for (let index = 0; index < births; index += 1) {
        const eligible = members.filter((member) => member.age >= 60 && member.energy > 24);
        if (eligible.length === 0) break;
        const parent = this.rng.pick(eligible);
        const point = this.pointNearXY(parent.x, parent.y, 1.4, true) ?? { x: parent.x, y: parent.y };
        const child = this.offspring(parent, point.x, point.y, group.id);
        child.energy = 58 + this.rng.range(0, 8);
        this.state.entities.push(child);
        parent.energy = Math.max(18, parent.energy - 6);
        parent.cooldown = Math.max(parent.cooldown, 30);
        born += 1;
      }

      if (born >= 2 && this.state.day - group.lastEventDay > 90) {
        const center = this.groupLocation(group);
        this.note(`${group.name} has entered a successful calving season in the ${region.name}. ${born} young grazers have joined the herd while forage remains abundant.`, region.id, group.id, center.x, center.y, 2);
        group.lastEventDay = this.state.day;
      }
    }
  }

  private mergeSmallGroups(): void {
    const positions = this.groupPositions();
    for (let i = 0; i < this.state.groups.length; i += 1) {
      const first = this.state.groups[i];
      if (first.memberIds.length > 6) continue;
      const firstCenter = groupCentroid(first, positions);
      for (let j = i + 1; j < this.state.groups.length; j += 1) {
        const second = this.state.groups[j];
        if (second.species !== first.species || second.memberIds.length > 8) continue;
        const secondCenter = groupCentroid(second, positions);
        if (dist(firstCenter, secondCenter) > 11) continue;
        const absorbedIds = new Set(second.memberIds);
        for (const current of this.state.entities) {
          if (absorbedIds.has(current.id)) current.groupId = first.id;
        }
        first.memberIds.push(...second.memberIds);
        first.lastEventDay = this.state.day;
        this.state.groups.splice(j, 1);
        const region = this.regionAt(firstCenter.x, firstCenter.y);
        this.note(`${second.name} has joined ${first.name} in the ${region.name}. Two fragile groups have become one more durable lineage.`, region.id, first.id, firstCenter.x, firstCenter.y);
        return;
      }
    }
  }

  interveneAt(kind: PlacementTool, x: number, y: number, radius = 8, announce = true): boolean {
    x = cap(x, 1, W - 2);
    y = cap(y, 1, H - 2);
    radius = cap(radius, 2, 22);
    const region = this.regionAt(x, y);
    let changed = false;

    if (kind === 'observe') return false;

    if (kind === 'plants') {
      changed = this.seedClusterAt('plant', Math.round(radius * 12), x, y, radius).length > 0;
      if (announce && changed) this.note(`Fresh vegetation has been established in the ${region.name}. Whether it persists will depend on moisture, grazing and soil.`, region.id, undefined, x, y);
    }
    if (kind === 'grazers') changed = Boolean(this.createSocialGroup('grazer', Math.round(cap(radius * 1.35, 5, 30)), x, y, radius * 0.7, announce));
    if (kind === 'predators') changed = Boolean(this.createSocialGroup('predator', Math.round(cap(radius * 0.25, 1, 7)), x, y, radius * 0.65, announce));
    if (kind === 'scavengers') changed = Boolean(this.createSocialGroup('scavenger', Math.round(cap(radius * 0.5, 2, 12)), x, y, radius * 0.8, announce));
    if (kind === 'fungi') {
      changed = this.seedClusterAt('fungi', Math.round(radius * 7), x, y, radius).length > 0;
      if (announce && changed) this.note(`A fungal colony has taken hold beneath the ${region.name}, quietly expanding the planet's decomposer network.`, region.id, undefined, x, y);
    }
    if (kind === 'rain') {
      this.affectCircle(x, y, radius, (tile, strength) => {
        tile.moisture = cap(tile.moisture + 0.32 * strength, 0, 1);
        tile.fertility = cap(tile.fertility + 0.045 * strength, 0, 1);
      });
      changed = true;
      if (announce) {
        this.createClimateFront('rain', x, y, radius * 1.15, 0.78, false);
        this.note(`A local rain front crosses the ${region.name}. Dry ground darkens and life gathers around the renewed moisture.`, region.id, undefined, x, y, 2);
      }
    }
    if (kind === 'drought') {
      this.affectCircle(x, y, radius, (tile, strength) => {
        tile.moisture = cap(tile.moisture - 0.38 * strength, 0, 1);
        tile.heat = cap(tile.heat + 0.06 * strength, 0, 1);
      });
      changed = true;
      if (announce) {
        this.createClimateFront('dry', x, y, radius * 1.2, 0.82, false);
        this.note(`A pocket of drought settles over the ${region.name}. The first response will be movement, followed by hunger if the dry spell holds.`, region.id, undefined, x, y, 2);
      }
    }
    if (kind === 'fertility') {
      this.affectCircle(x, y, radius, (tile, strength) => {
        tile.fertility = cap(tile.fertility + 0.42 * strength, 0, 1);
      });
      changed = true;
      if (announce) this.note(`Mineral-rich soil has appeared in the ${region.name}. Plants now have an opportunity to turn that stored potential into biomass.`, region.id, undefined, x, y);
    }
    if (kind === 'wildfire') {
      const radiusSquared = radius * radius;
      const survivors: Entity[] = [];
      let burned = 0;
      for (const current of this.state.entities) {
        const dx = current.x - x;
        const dy = current.y - y;
        const inside = dx * dx + dy * dy <= radiusSquared;
        const vulnerable = current.species === 'plant' || current.species === 'fungi';
        const animalRisk = isSocial(current.species);
        if (inside && vulnerable && this.rng.next() < 0.82) {
          burned += 1;
          continue;
        }
        if (inside && animalRisk && this.rng.next() < 0.08) {
          survivors.push(entity('carrion', current.x, current.y, this.rng));
          burned += 1;
          continue;
        }
        survivors.push(current);
      }
      this.state.entities = survivors;
      this.ignite(x, y, radius, false);
      this.affectCircle(x, y, radius, (tile, strength) => {
        tile.fertility = cap(tile.fertility + 0.10 * strength, 0, 1);
        tile.pressure = cap(tile.pressure + 0.18 * strength, 0, 1);
      });
      changed = true;
      if (announce) this.note(`Fire has crossed the ${region.name}, removing old growth and leaving a warmer, nutrient-rich scar that the landscape will remember.`, region.id, undefined, x, y, 3);
      this.refreshGroupMembership(false);
    }

    return changed;
  }

  intervene(kind: string): void {
    const map: Record<string, { tool: PlacementTool; region: string; radius: number }> = {
      rain: { tool: 'rain', region: 'east', radius: 24 },
      drought: { tool: 'drought', region: 'central', radius: 28 },
      forest: { tool: 'plants', region: 'north', radius: 17 },
      herd: { tool: 'grazers', region: 'central', radius: 14 },
      wolves: { tool: 'predators', region: 'north', radius: 12 },
      fungi: { tool: 'fungi', region: 'west', radius: 16 },
    };
    const choice = map[kind];
    if (!choice) return;
    const region = this.region(choice.region);
    this.interveneAt(choice.tool, region.x, region.y, choice.radius, true);
  }

  step(): void {
    this.state.day += 1;
    const previousSeason = this.state.seasonName;
    this.state.season = (this.state.day % 360) / 360;
    this.state.seasonName = this.seasonFor(this.state.season);
    if (this.state.seasonName !== previousSeason) {
      const region = this.randomRegion();
      const messages: Record<SeasonName, string> = {
        Spring: `Spring returns to the ${region.name}. Fresh growth creates new choices for every grazing group.`,
        Summer: `Summer settles over the ${region.name}. Water and shade begin to matter more than distance.`,
        Autumn: `Autumn reaches the ${region.name}. Movement slows as the planet stores the remains of its productive season.`,
        Winter: `Winter enters the ${region.name}. Growth contracts and established routes become increasingly important.`,
      };
      this.note(messages[this.state.seasonName], region.id, undefined, region.x, region.y, 2);
    }

    this.updateClimate();
    this.updateFire();

    for (const tile of this.state.tiles) {
      tile.pressure *= 0.96;
      tile.trail *= 0.9992;
      tile.burn *= tile.fire > 0.02 ? 0.9996 : 0.9982;
      const seasonal = Math.sin(this.state.season * Math.PI * 2);
      const summerDrying = this.state.seasonName === 'Summer' ? 0.00055 : 0;
      const winterRecovery = this.state.seasonName === 'Winter' ? 0.00022 : 0;
      tile.moisture = cap(tile.moisture + seasonal * 0.00055 - 0.00018 - summerDrying + winterRecovery, 0, 1);
      tile.fertility = cap(tile.fertility + 0.00016 + tile.burn * 0.00012, 0, 1);
    }

    if (this.state.day % 120 === 1) this.redirectGroups();

    const positions = this.groupPositions();
    const groupById = new Map(this.state.groups.map((group) => [group.id, group]));
    const centers = new Map(this.state.groups.map((group) => [group.id, groupCentroid(group, positions)]));
    const entities = this.state.entities;
    const initialLength = entities.length;

    for (let entityIndex = 0; entityIndex < initialLength; entityIndex += 1) {
      const current = entities[entityIndex];
      current.age += 1;
      current.cooldown = Math.max(0, current.cooldown - 1);
      const tile = this.state.tiles[idx(current.x, current.y)];

      if (current.species === 'plant') {
        const scarPenalty = tile.burn > 0.45 ? tile.burn * 0.035 : 0;
        const pathPenalty = tile.trail * 0.018;
        const growthMultiplier = this.state.seasonName === 'Spring' ? 1.22 : this.state.seasonName === 'Summer' ? 0.88 : this.state.seasonName === 'Autumn' ? 0.96 : 0.68;
        const resilience = current.genome.resilience;
        current.energy += (tile.moisture * 0.035 + tile.fertility * 0.025) * growthMultiplier * resilience - 0.018 * current.genome.metabolism - scarPenalty - pathPenalty - tile.fire * (1.8 / resilience);
        if (current.energy > 75 / current.genome.fertility && entities.length < MAX_ENTITIES && this.rng.next() < 0.015 * current.genome.fertility) {
          const nx = current.x + this.rng.range(-3, 3);
          const ny = current.y + this.rng.range(-3, 3);
          if (isLand(this.state.tiles[idx(nx, ny)])) {
            entities.push(this.offspring(current, nx, ny, undefined));
            current.energy *= 0.64;
            tile.fertility *= 0.996;
          }
        }
      } else if (current.species === 'fungi') {
        current.energy -= 0.015 * current.genome.metabolism + tile.fire * (1.25 / current.genome.resilience);
        const carrion = entities.find((other) => other.species === 'carrion' && dist(current, other) < 3);
        if (carrion) {
          current.energy += 0.7;
          carrion.energy -= 0.9;
          tile.fertility = Math.min(1, tile.fertility + 0.006);
        }
        if (current.energy > 60 / current.genome.fertility && entities.length < MAX_ENTITIES && this.rng.next() < 0.006 * current.genome.fertility) {
          const nx = current.x + this.rng.range(-2, 2);
          const ny = current.y + this.rng.range(-2, 2);
          if (isLand(this.state.tiles[idx(nx, ny)])) {
            entities.push(this.offspring(current, nx, ny, undefined));
            current.energy *= 0.72;
          }
        }
      } else if (current.species === 'carrion') {
        current.energy -= 0.22;
        tile.fertility = Math.min(1, tile.fertility + 0.0015);
      } else {
        const baseSpeed = current.species === 'predator' ? 0.34 : current.species === 'scavenger' ? 0.28 : 0.25;
        const speed = baseSpeed * current.genome.speed;
        if (tile.fire > 0.04) {
          current.vx += this.rng.range(-0.16, 0.16) - this.state.windX * 0.35;
          current.vy += this.rng.range(-0.16, 0.16) - this.state.windY * 0.35;
          current.energy -= tile.fire * (0.9 / current.genome.resilience);
        }
        let target: Entity | undefined;
        if (current.species === 'grazer') target = entities.find((other) => other.species === 'plant' && other.energy > 0 && dist(current, other) < 10 * current.genome.vision);
        if (current.species === 'predator') target = entities.find((other) => other.species === 'grazer' && other.energy > 0 && dist(current, other) < 9 * current.genome.vision);
        if (current.species === 'scavenger') target = entities.find((other) => other.species === 'carrion' && other.energy > 0 && dist(current, other) < 10 * current.genome.vision);

        const group = current.groupId ? groupById.get(current.groupId) : undefined;
        const center = current.groupId ? centers.get(current.groupId) : undefined;
        if (group && center) {
          const cohesionDistance = current.species === 'grazer' ? 6 : current.species === 'predator' ? 8 : 10;
          const centerDistance = dist(current, center);
          if (centerDistance > cohesionDistance) {
            current.vx += ((center.x - current.x) / Math.max(1, centerDistance)) * 0.026 * current.genome.cooperation;
            current.vy += ((center.y - current.y) / Math.max(1, centerDistance)) * 0.026 * current.genome.cooperation;
          }
          if (!target) {
            const targetDistance = Math.max(1, Math.hypot(group.targetX - current.x, group.targetY - current.y));
            current.vx += ((group.targetX - current.x) / targetDistance) * 0.012;
            current.vy += ((group.targetY - current.y) / targetDistance) * 0.012;
          }
        }

        if (target) {
          const dx = target.x - current.x;
          const dy = target.y - current.y;
          const distance = Math.max(0.01, Math.hypot(dx, dy));
          current.vx += (dx / distance) * 0.05;
          current.vy += (dy / distance) * 0.05;
          if (distance < 1.2 && current.cooldown === 0) {
            if (current.species === 'predator' && target.species === 'grazer') {
              const groupBonus = current.genome.cooperation * 0.08;
              const successChance = cap(
                0.48
                  + (current.genome.speed - target.genome.speed) * 0.22
                  + (current.genome.vision - target.genome.camouflage) * 0.18
                  + groupBonus,
                0.16,
                0.9,
              );
              tile.pressure = Math.min(1, tile.pressure + 0.16 + successChance * 0.12);
              if (this.rng.next() < successChance) {
                current.energy += 28;
                target.energy -= 999;
                current.cooldown = Math.round(52 / current.genome.metabolism);
              } else {
                target.vx += (target.x - current.x) * 0.22;
                target.vy += (target.y - current.y) * 0.22;
                current.energy -= 2.2;
                current.cooldown = 12;
              }
            } else {
              current.energy += target.species === 'plant' ? 15 : 11;
              target.energy -= 999;
              current.cooldown = current.species === 'scavenger' ? 18 : 12;
            }
          }
        } else {
          current.vx += this.rng.range(-0.035, 0.035);
          current.vy += this.rng.range(-0.035, 0.035);
        }

        current.energy -= (current.species === 'predator' ? 0.12 : current.species === 'grazer' ? 0.075 : 0.06) * current.genome.metabolism;
        const velocity = Math.hypot(current.vx, current.vy);
        if (velocity > speed) {
          current.vx = (current.vx / velocity) * speed;
          current.vy = (current.vy / velocity) * speed;
        }
        current.x += current.vx;
        current.y += current.vy;
        if (!isLand(this.state.tiles[idx(current.x, current.y)])) {
          current.vx *= -1.2;
          current.vy *= -1.2;
          current.x += current.vx * 2;
          current.y += current.vy * 2;
          current.energy -= 0.35;
        }
        current.x = cap(current.x, 1, W - 2);
        current.y = cap(current.y, 1, H - 2);
        const movementTile = this.state.tiles[idx(current.x, current.y)];
        movementTile.trail = cap(movementTile.trail + (current.species === 'grazer' ? 0.007 : current.species === 'predator' ? 0.0045 : 0.003), 0, 1);

        const seasonalBirthFactor = this.state.seasonName === 'Spring' ? 0.9 : this.state.seasonName === 'Winter' ? 1.1 : 1;
        const baseReproductionThreshold = current.species === 'predator' ? 180 : current.species === 'scavenger' ? 120 : 86;
        const reproductionThreshold = (baseReproductionThreshold * seasonalBirthFactor) / current.genome.fertility;
        const mature = current.age >= (current.species === 'grazer' ? 75 : 110);
        if (mature && current.energy > reproductionThreshold && current.cooldown === 0 && entities.length < MAX_ENTITIES) {
          const childBreed = this.rng.next() < 0.09 ? (current.breed + this.rng.pick([-1, 1]) + 6) % 6 : current.breed;
          const child = this.offspring(current, current.x + this.rng.range(-1, 1), current.y + this.rng.range(-1, 1), current.groupId);
          child.breed = childBreed;
          entities.push(child);
          current.energy *= current.species === 'grazer' ? 0.62 : 0.52;
          current.cooldown = current.species === 'grazer' ? 90 : 120;
        }
      }
    }

    const survivors: Entity[] = [];
    for (const current of entities) {
      if (current.energy > 0 && current.age < 2800 * current.genome.resilience) survivors.push(current);
      else if (current.species !== 'plant' && current.species !== 'carrion') survivors.push(entity('carrion', current.x, current.y, this.rng));
    }
    this.state.entities = survivors.slice(0, MAX_ENTITIES);
    this.seasonalGrazerBirths();
    this.refreshGroupMembership(this.state.day % 30 === 0);
    if (this.state.day % 30 === 0) this.refreshLineages(true);

    if (this.state.day % 45 === 0) {
      const currentPositions = this.groupPositions();
      for (const group of this.state.groups) {
        const center = groupCentroid(group, currentPositions);
        const lastPoint = group.route[group.route.length - 1];
        if (!lastPoint || dist(center, lastPoint) > 4.5) {
          group.route.push({ x: center.x, y: center.y, day: this.state.day });
          group.route = group.route.slice(-12);
        }
      }
    }

    if (this.state.day % 240 === 0) this.splitLargeHerd();
    if (this.state.day % 300 === 0) this.mergeSmallGroups();

    if (this.state.day % 90 === 0) {
      const counts = this.counts();
      if (counts.grazer < 18 && counts.plant > 280) {
        const resources = this.regionResources();
        const region = [...this.state.regions].sort((a, b) => resources.get(b.id)!.plant - resources.get(a.id)!.plant)[0] ?? this.region('central');
        const point = this.resourceHotspot('grazer', region);
        this.createSocialGroup('grazer', counts.grazer < 8 ? 14 : 8, point.x, point.y, 10, true);
      }
      if (counts.plant < 180) {
        const region = this.randomRegion();
        this.seedClusterAt('plant', 300, region.x, region.y, 16);
        this.note(`After a sparse season, plant life returns in scattered islands across the ${region.name}.`, region.id, undefined, region.x, region.y, 2);
      }
      if (counts.predator < 2 && counts.grazer > 18) {
        const resources = this.regionResources();
        const region = [...this.state.regions].sort((a, b) => resources.get(b.id)!.grazer - resources.get(a.id)!.grazer)[0] ?? this.region('north');
        this.createSocialGroup('predator', 2, region.x, region.y, 9, true);
      }
      if (counts.scavenger < 4 && counts.carrion > 8) {
        const resources = this.regionResources();
        const region = [...this.state.regions].sort((a, b) => resources.get(b.id)!.carrion - resources.get(a.id)!.carrion)[0] ?? this.region('coast');
        this.createSocialGroup('scavenger', 5, region.x, region.y, 10, true);
      }
      if (counts.fungi < 36 && counts.carrion > 10) {
        const region = this.randomRegion();
        this.seedClusterAt('fungi', 50, region.x, region.y, 13);
        this.note(`A new fungal bloom appears beneath the ${region.name}, arriving as older decomposer colonies fade.`, region.id, undefined, region.x, region.y, 1);
      }
    }

    if (this.state.day % 160 === 0) {
      const counts = this.counts();
      const focalGroup = this.state.groups.length > 0 ? this.rng.pick(this.state.groups) : undefined;
      const location = focalGroup ? this.groupLocation(focalGroup) : { x: this.randomRegion().x, y: this.randomRegion().y };
      const region = this.regionAt(location.x, location.y);
      if (focalGroup && focalGroup.memberIds.length > 18) {
        this.note(`${focalGroup.name} is now one of the most visible presences in the ${region.name}. Its repeated movement is becoming part of the landscape itself.`, region.id, focalGroup.id, location.x, location.y);
      } else if (counts.predator > 25) {
        this.note(`Hunting pressure rises across the ${region.name}. Grazers are beginning to favour thicker cover.`, region.id, undefined, location.x, location.y);
      } else if (counts.fungi > 180) {
        this.note(`A fungal network is quietly repairing the ${region.name}, returning old bodies and fallen plants to the soil.`, region.id, undefined, location.x, location.y);
      } else {
        this.note(`The ${region.name} remains balanced for now: not still, but not yet in crisis.`, region.id, focalGroup?.id, location.x, location.y);
      }
    }
  }
  private hydrateGenetics(): void {
    if (!Array.isArray(this.state.lineages)) this.state.lineages = [];
    const fallback = new Map<string, Lineage>();

    for (const current of this.state.entities) {
      if (!current.genome) {
        const seeded = new RNG((this.state.seed * 2654435761 + current.id * 1013904223) >>> 0);
        current.genome = randomGenome(current.species, seeded, (current.breed - 2.5) * 0.012);
      }
      if (current.species === 'carrion') continue;
      const existing = this.activeLineage(current.lineageId);
      if (existing) continue;
      const key = `${current.species}:${current.breed}`;
      let lineage = fallback.get(key);
      if (!lineage) {
        const region = this.regionAt(current.x, current.y);
        const serial = nextLineageId++;
        lineage = {
          id: `lineage-${serial}`,
          name: lineageName(current.species, current.genome, region, serial),
          species: current.species,
          color: lineageColor(current.species, current.genome, serial),
          foundedDay: 0,
          regionId: region.id,
          genome: current.genome,
          population: 0,
          peakPopulation: 0,
        };
        this.state.lineages.push(lineage);
        fallback.set(key, lineage);
      }
      current.lineageId = lineage.id;
    }
    this.refreshLineages(false);
  }

  snapshot(): SimulationSnapshot {
    return {
      schemaVersion: 1,
      state: this.state,
      rngState: this.rng.getState(),
      counters: {
        nextEntityId: nextId,
        nextGroupId,
        nextLandmarkId,
        nextClimateFrontId,
        nextLineageId,
      },
    };
  }

  restore(snapshot: SimulationSnapshot): void {
    if (!snapshot || snapshot.schemaVersion !== 1) throw new Error('Unsupported world save format.');
    if (!snapshot.state || snapshot.state.tiles.length !== W * H) throw new Error('The saved world has incompatible dimensions.');

    this.state = structuredClone(snapshot.state);
    this.rng.setState(snapshot.rngState ?? this.state.seed);
    if (!Array.isArray(this.state.lineages)) this.state.lineages = [];

    const counters = snapshot.counters;
    nextId = Math.max(
      counters?.nextEntityId ?? 1,
      ...this.state.entities.map((current) => current.id + 1),
      1,
    );
    nextGroupId = Math.max(
      counters?.nextGroupId ?? 1,
      ...this.state.groups.map((group) => Number(group.id.match(/\d+$/)?.[0] ?? 0) + 1),
      1,
    );
    nextLandmarkId = Math.max(
      counters?.nextLandmarkId ?? 1,
      ...this.state.landmarks.map((landmark) => Number(landmark.id.match(/\d+$/)?.[0] ?? 0) + 1),
      1,
    );
    nextClimateFrontId = Math.max(
      counters?.nextClimateFrontId ?? 1,
      ...this.state.climateFronts.map((front) => Number(front.id.match(/\d+$/)?.[0] ?? 0) + 1),
      1,
    );
    nextLineageId = Math.max(
      counters?.nextLineageId ?? 1,
      ...this.state.lineages.map((lineage) => Number(lineage.id.match(/\d+$/)?.[0] ?? 0) + 1),
      1,
    );

    this.hydrateGenetics();
    this.refreshGroupMembership(false);
  }


}
