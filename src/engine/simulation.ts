import { RNG } from '../world/random';
import { generateTiles } from '../world/generator';
import { generateRegions, nearestRegion } from '../world/regions';
import { groupCentroid, groupColor, groupName } from '../world/groups';
import type {
  Entity,
  LandmarkKind,
  PlacementTool,
  PlanetState,
  Region,
  SocialGroup,
  SocialSpecies,
  Species,
  Tile,
} from '../world/types';

const W = 180;
const H = 110;
const MAX_ENTITIES = 2600;
let nextId = 1;
let nextGroupId = 1;
let nextLandmarkId = 1;

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
      season: 0,
      seed,
    };
    this.seedLife();
    this.note('A young planet settles into motion. Its first herds and hunting lineages begin to make places into territories.', 'central');
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

  private seedClusterAt(
    species: Species,
    count: number,
    x: number,
    y: number,
    radius = 10,
    groupId?: string,
    breed?: number,
    generation = 0,
  ): number[] {
    const ids: number[] = [];
    for (let i = 0; i < count && this.state.entities.length < MAX_ENTITIES; i += 1) {
      const point = this.pointNearXY(x, y, radius, true);
      if (!point) continue;
      const created = entity(species, point.x, point.y, this.rng, groupId, breed, generation);
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
    group.memberIds = this.seedClusterAt(species, count, x, y, radius, id, breed, inheritedGeneration);
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
    for (let i = 0; i < 850; i += 1) {
      const point = this.landPoint();
      this.state.entities.push(entity('plant', point.x, point.y, this.rng));
    }
    for (let i = 0; i < 85; i += 1) {
      const point = this.landPoint();
      this.state.entities.push(entity('fungi', point.x, point.y, this.rng));
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
      const point = this.pointNearXY(region.x, region.y, 8, true) ?? { x: region.x, y: region.y };
      this.createSocialGroup(species, count, point.x, point.y, radius, false);
    }
  }

  counts(): Record<Species, number> {
    const counts: Record<Species, number> = { plant: 0, grazer: 0, predator: 0, scavenger: 0, fungi: 0, carrion: 0 };
    for (const current of this.state.entities) counts[current.species] += 1;
    return counts;
  }

  note(text: string, regionId?: string, groupId?: string, focusX?: number, focusY?: number): void {
    this.state.notes.unshift({ day: this.state.day, text, regionId, groupId, focusX, focusY });
    this.state.notes = this.state.notes.slice(0, 12);
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

      if (bestRegion.id !== group.targetRegionId) {
        const previous = this.region(group.targetRegionId);
        group.targetRegionId = bestRegion.id;
        group.targetX = bestRegion.x;
        group.targetY = bestRegion.y;
        const current = this.groupLocation(group);
        group.route.push({ x: current.x, y: current.y, day: this.state.day });
        group.route = group.route.slice(-12);
        group.lastEventDay = this.state.day;
        this.addLandmark('migration-route', `${group.name} crossing`, current.x, current.y, this.regionAt(current.x, current.y), 0.72);
        this.note(`${group.name} has turned away from the ${previous.name} and begun moving toward the ${bestRegion.name}. Food, carrion and pressure are redrawing its route.`, bestRegion.id, group.id, current.x, current.y);
      }
    }
  }

  private splitLargeHerd(): void {
    const candidates = this.state.groups.filter((group) => group.species === 'grazer' && group.memberIds.length >= 32 && this.state.day - group.lastEventDay > 180);
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
      if (announce) this.note(`A local rain front crosses the ${region.name}. Dry ground darkens and life gathers around the renewed moisture.`, region.id, undefined, x, y);
    }
    if (kind === 'drought') {
      this.affectCircle(x, y, radius, (tile, strength) => {
        tile.moisture = cap(tile.moisture - 0.38 * strength, 0, 1);
        tile.heat = cap(tile.heat + 0.06 * strength, 0, 1);
      });
      changed = true;
      if (announce) this.note(`A pocket of drought settles over the ${region.name}. The first response will be movement, followed by hunger if the dry spell holds.`, region.id, undefined, x, y);
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
      this.affectCircle(x, y, radius, (tile, strength) => {
        tile.moisture = cap(tile.moisture - 0.26 * strength, 0, 1);
        tile.fertility = cap(tile.fertility + 0.12 * strength, 0, 1);
        tile.pressure = cap(tile.pressure + 0.18 * strength, 0, 1);
        tile.burn = cap(tile.burn + 0.95 * strength, 0, 1);
      });
      this.addLandmark('burn-scar', `The ${region.name} burn`, x, y, region, 1);
      changed = burned > 0;
      if (announce) this.note(`Fire has crossed the ${region.name}, removing old growth and leaving a warmer, nutrient-rich scar that the landscape will remember.`, region.id, undefined, x, y);
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
    this.state.season = (this.state.day % 360) / 360;

    for (const tile of this.state.tiles) {
      tile.pressure *= 0.96;
      tile.trail *= 0.9992;
      tile.burn *= 0.9982;
      const seasonal = Math.sin(this.state.season * Math.PI * 2);
      tile.moisture = cap(tile.moisture + seasonal * 0.0008 - 0.0003, 0, 1);
      tile.fertility = cap(tile.fertility + 0.0002 + tile.burn * 0.00012, 0, 1);
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
        current.energy += tile.moisture * 0.035 + tile.fertility * 0.025 - 0.018 - scarPenalty - pathPenalty;
        if (current.energy > 75 && entities.length < MAX_ENTITIES && this.rng.next() < 0.015) {
          const nx = current.x + this.rng.range(-3, 3);
          const ny = current.y + this.rng.range(-3, 3);
          if (isLand(this.state.tiles[idx(nx, ny)])) {
            entities.push(entity('plant', nx, ny, this.rng, undefined, current.breed, current.generation + 1));
            current.energy *= 0.64;
            tile.fertility *= 0.996;
          }
        }
      } else if (current.species === 'fungi') {
        current.energy -= 0.015;
        const carrion = entities.find((other) => other.species === 'carrion' && dist(current, other) < 3);
        if (carrion) {
          current.energy += 0.7;
          carrion.energy -= 0.9;
          tile.fertility = Math.min(1, tile.fertility + 0.006);
        }
        if (current.energy > 60 && entities.length < MAX_ENTITIES && this.rng.next() < 0.006) {
          const nx = current.x + this.rng.range(-2, 2);
          const ny = current.y + this.rng.range(-2, 2);
          if (isLand(this.state.tiles[idx(nx, ny)])) {
            entities.push(entity('fungi', nx, ny, this.rng, undefined, current.breed, current.generation + 1));
            current.energy *= 0.72;
          }
        }
      } else if (current.species === 'carrion') {
        current.energy -= 0.22;
        tile.fertility = Math.min(1, tile.fertility + 0.0015);
      } else {
        const speed = current.species === 'predator' ? 0.34 : current.species === 'scavenger' ? 0.28 : 0.25;
        let target: Entity | undefined;
        if (current.species === 'grazer') target = entities.find((other) => other.species === 'plant' && dist(current, other) < 6);
        if (current.species === 'predator') target = entities.find((other) => other.species === 'grazer' && dist(current, other) < 9);
        if (current.species === 'scavenger') target = entities.find((other) => other.species === 'carrion' && dist(current, other) < 10);

        const group = current.groupId ? groupById.get(current.groupId) : undefined;
        const center = current.groupId ? centers.get(current.groupId) : undefined;
        if (group && center) {
          const cohesionDistance = current.species === 'grazer' ? 6 : current.species === 'predator' ? 8 : 10;
          const centerDistance = dist(current, center);
          if (centerDistance > cohesionDistance) {
            current.vx += ((center.x - current.x) / Math.max(1, centerDistance)) * 0.026;
            current.vy += ((center.y - current.y) / Math.max(1, centerDistance)) * 0.026;
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
            if (current.species === 'predator') tile.pressure = Math.min(1, tile.pressure + 0.25);
            current.energy += target.species === 'grazer' ? 28 : 12;
            target.energy -= 999;
            current.cooldown = current.species === 'predator' ? 46 : 18;
          }
        } else {
          current.vx += this.rng.range(-0.035, 0.035);
          current.vy += this.rng.range(-0.035, 0.035);
        }

        current.energy -= current.species === 'predator' ? 0.12 : current.species === 'grazer' ? 0.075 : 0.06;
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

        const reproductionThreshold = current.species === 'predator' ? 180 : current.species === 'scavenger' ? 120 : 95;
        if (current.energy > reproductionThreshold && current.cooldown === 0 && entities.length < MAX_ENTITIES) {
          const childBreed = this.rng.next() < 0.09 ? (current.breed + this.rng.pick([-1, 1]) + 6) % 6 : current.breed;
          entities.push(entity(current.species, current.x + this.rng.range(-1, 1), current.y + this.rng.range(-1, 1), this.rng, current.groupId, childBreed, current.generation + 1));
          current.energy *= 0.52;
          current.cooldown = 120;
        }
      }
    }

    const survivors: Entity[] = [];
    for (const current of entities) {
      if (current.energy > 0 && current.age < 2800) survivors.push(current);
      else if (current.species !== 'plant' && current.species !== 'carrion') survivors.push(entity('carrion', current.x, current.y, this.rng));
    }
    this.state.entities = survivors.slice(0, MAX_ENTITIES);
    this.refreshGroupMembership(this.state.day % 30 === 0);

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
      if (counts.grazer < 18 && counts.plant > 250) {
        const region = this.region('central');
        this.createSocialGroup('grazer', 18, region.x, region.y, 13, true);
      }
      if (counts.plant < 180) {
        const region = this.randomRegion();
        this.seedClusterAt('plant', 300, region.x, region.y, 16);
        this.note(`After a sparse season, plant life returns in scattered islands across the ${region.name}.`, region.id, undefined, region.x, region.y);
      }
      if (counts.predator < 3 && counts.grazer > 60) {
        const region = this.region('north');
        this.createSocialGroup('predator', 4, region.x, region.y, 12, true);
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
}
