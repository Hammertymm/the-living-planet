import { RNG } from '../world/random';
import { generateTiles } from '../world/generator';
import { generateRegions, nearestRegion } from '../world/regions';
import type { Entity, PlacementTool, PlanetState, Region, Species, Tile } from '../world/types';

const W = 180;
const H = 110;
const MAX_ENTITIES = 2600;
let nextId = 1;

function idx(x: number, y: number): number {
  return Math.max(0, Math.min(W - 1, Math.floor(x))) + Math.max(0, Math.min(H - 1, Math.floor(y))) * W;
}

function dist(a: Entity, b: Entity): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function entity(species: Species, x: number, y: number, rng: RNG): Entity {
  return {
    id: nextId++,
    species,
    x,
    y,
    vx: rng.range(-0.25, 0.25),
    vy: rng.range(-0.25, 0.25),
    energy: species === 'predator' ? 90 : species === 'grazer' ? 70 : species === 'scavenger' ? 58 : 40,
    age: 0,
    breed: rng.int(0, 5),
    cooldown: 0,
  };
}

function isLand(tile: Tile): boolean {
  return tile.biome !== 'ocean' && tile.biome !== 'rock' && tile.biome !== 'snow';
}

function cap(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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
      season: 0,
      seed,
    };
    this.seedLife();
    this.note('A young planet settles into motion. Wind, water, plants and hunger begin their quiet negotiations.', 'central');
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

  private pointNear(region: Region, radius = 12): { x: number; y: number } {
    return this.pointNearXY(region.x, region.y, radius, true) ?? this.landPoint();
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

  private seedClusterAt(species: Species, count: number, x: number, y: number, radius = 10): number {
    let placed = 0;
    for (let i = 0; i < count && this.state.entities.length < MAX_ENTITIES; i += 1) {
      const point = this.pointNearXY(x, y, radius, true);
      if (!point) continue;
      this.state.entities.push(entity(species, point.x, point.y, this.rng));
      placed += 1;
    }
    return placed;
  }

  private seedCluster(species: Species, count: number, region: Region, radius = 10): void {
    this.seedClusterAt(species, count, region.x, region.y, radius);
  }

  seedLife(): void {
    for (let i = 0; i < 900; i += 1) {
      const point = this.landPoint();
      this.state.entities.push(entity('plant', point.x, point.y, this.rng));
    }
    for (let i = 0; i < 75; i += 1) {
      const point = this.landPoint();
      this.state.entities.push(entity('grazer', point.x, point.y, this.rng));
    }
    for (let i = 0; i < 14; i += 1) {
      const point = this.landPoint();
      this.state.entities.push(entity('predator', point.x, point.y, this.rng));
    }
    for (let i = 0; i < 20; i += 1) {
      const point = this.landPoint();
      this.state.entities.push(entity('scavenger', point.x, point.y, this.rng));
    }
    for (let i = 0; i < 90; i += 1) {
      const point = this.landPoint();
      this.state.entities.push(entity('fungi', point.x, point.y, this.rng));
    }
  }

  counts(): Record<Species, number> {
    const counts: Record<Species, number> = { plant: 0, grazer: 0, predator: 0, scavenger: 0, fungi: 0, carrion: 0 };
    for (const current of this.state.entities) counts[current.species] += 1;
    return counts;
  }

  note(text: string, regionId?: string): void {
    this.state.notes.unshift({ day: this.state.day, text, regionId });
    this.state.notes = this.state.notes.slice(0, 8);
  }

  interveneAt(kind: PlacementTool, x: number, y: number, radius = 8, announce = true): boolean {
    x = cap(x, 1, W - 2);
    y = cap(y, 1, H - 2);
    radius = cap(radius, 2, 22);
    const region = this.regionAt(x, y);
    let changed = false;

    if (kind === 'observe') return false;

    if (kind === 'plants') {
      const placed = this.seedClusterAt('plant', Math.round(radius * 12), x, y, radius);
      changed = placed > 0;
      if (announce && changed) this.note(`Fresh vegetation has been established in the ${region.name}. Whether it persists will depend on moisture, grazing and soil.`, region.id);
    }
    if (kind === 'grazers') {
      const placed = this.seedClusterAt('grazer', Math.round(cap(radius * 1.35, 5, 30)), x, y, radius * 0.7);
      changed = placed > 0;
      if (announce && changed) this.note(`A new grazing herd has entered the ${region.name}. Its arrival will immediately test local food reserves.`, region.id);
    }
    if (kind === 'predators') {
      const placed = this.seedClusterAt('predator', Math.round(cap(radius * 0.25, 1, 7)), x, y, radius * 0.65);
      changed = placed > 0;
      if (announce && changed) this.note(`A predator lineage has been introduced into the ${region.name}. The surrounding herds now face a new pressure.`, region.id);
    }
    if (kind === 'scavengers') {
      const placed = this.seedClusterAt('scavenger', Math.round(cap(radius * 0.5, 2, 12)), x, y, radius * 0.8);
      changed = placed > 0;
      if (announce && changed) this.note(`Scavengers circle into the ${region.name}, ready to shorten the path from death back to fertile soil.`, region.id);
    }
    if (kind === 'fungi') {
      const placed = this.seedClusterAt('fungi', Math.round(radius * 7), x, y, radius);
      changed = placed > 0;
      if (announce && changed) this.note(`A fungal colony has taken hold beneath the ${region.name}, quietly expanding the planet's decomposer network.`, region.id);
    }
    if (kind === 'rain') {
      this.affectCircle(x, y, radius, (tile, strength) => {
        tile.moisture = cap(tile.moisture + 0.32 * strength, 0, 1);
        tile.fertility = cap(tile.fertility + 0.045 * strength, 0, 1);
      });
      changed = true;
      if (announce) this.note(`A local rain front crosses the ${region.name}. Dry ground darkens and life gathers around the renewed moisture.`, region.id);
    }
    if (kind === 'drought') {
      this.affectCircle(x, y, radius, (tile, strength) => {
        tile.moisture = cap(tile.moisture - 0.38 * strength, 0, 1);
        tile.heat = cap(tile.heat + 0.06 * strength, 0, 1);
      });
      changed = true;
      if (announce) this.note(`A pocket of drought settles over the ${region.name}. The first response will be movement, followed by hunger if the dry spell holds.`, region.id);
    }
    if (kind === 'fertility') {
      this.affectCircle(x, y, radius, (tile, strength) => {
        tile.fertility = cap(tile.fertility + 0.42 * strength, 0, 1);
      });
      changed = true;
      if (announce) this.note(`Mineral-rich soil has appeared in the ${region.name}. Plants now have an opportunity to turn that stored potential into biomass.`, region.id);
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
        const animalRisk = current.species === 'grazer' || current.species === 'predator' || current.species === 'scavenger';
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
      });
      changed = burned > 0;
      if (announce) this.note(`Fire has crossed the ${region.name}, removing old growth and leaving a warmer, nutrient-rich scar for succession to begin.`, region.id);
    }

    return changed;
  }

  // Preserved for simple scripted interventions and future story events.
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
      const seasonal = Math.sin(this.state.season * Math.PI * 2);
      tile.moisture = cap(tile.moisture + seasonal * 0.0008 - 0.0003, 0, 1);
      tile.fertility = cap(tile.fertility + 0.0002, 0, 1);
    }

    const entities = this.state.entities;
    for (const current of entities) {
      current.age += 1;
      current.cooldown = Math.max(0, current.cooldown - 1);
      const tile = this.state.tiles[idx(current.x, current.y)];

      if (current.species === 'plant') {
        current.energy += tile.moisture * 0.035 + tile.fertility * 0.025 - 0.018;
        if (current.energy > 75 && entities.length < MAX_ENTITIES && this.rng.next() < 0.015) {
          const nx = current.x + this.rng.range(-3, 3);
          const ny = current.y + this.rng.range(-3, 3);
          if (isLand(this.state.tiles[idx(nx, ny)])) {
            entities.push(entity('plant', nx, ny, this.rng));
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
            entities.push(entity('fungi', nx, ny, this.rng));
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
        const reproductionThreshold = current.species === 'predator' ? 180 : current.species === 'scavenger' ? 120 : 95;
        if (current.energy > reproductionThreshold && current.cooldown === 0 && entities.length < MAX_ENTITIES) {
          entities.push(entity(current.species, current.x + this.rng.range(-1, 1), current.y + this.rng.range(-1, 1), this.rng));
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

    if (this.state.day % 90 === 0) {
      const counts = this.counts();
      if (counts.grazer < 18 && counts.plant > 250) {
        const region = this.region('central');
        this.seedCluster('grazer', 18, region, 13);
        this.note(`A small grazing population recovers in the sheltered reaches of the ${region.name}.`, region.id);
      }
      if (counts.plant < 180) {
        const region = this.randomRegion();
        this.seedCluster('plant', 300, region, 16);
        this.note(`After a sparse season, plant life returns in scattered islands across the ${region.name}.`, region.id);
      }
      if (counts.predator < 3 && counts.grazer > 60) {
        const region = this.region('north');
        this.seedCluster('predator', 4, region, 12);
        this.note(`Predators reappear at low numbers in the ${region.name}, following the scent of recovering herds.`, region.id);
      }
    }

    if (this.state.day % 160 === 0) {
      const counts = this.counts();
      const focal = this.state.entities.length > 0 ? this.rng.pick(this.state.entities) : undefined;
      const region = focal ? nearestRegion(this.state.regions, focal.x, focal.y) : this.randomRegion();
      if (counts.predator > 25) {
        this.note(`Hunting pressure rises across the ${region.name}. Grazers are beginning to favour thicker cover.`, region.id);
      } else if (counts.grazer > 120) {
        this.note(`The ${region.name} supports a broad grazing population. Their movement is carving temporary paths through young growth.`, region.id);
      } else if (counts.fungi > 180) {
        this.note(`A fungal network is quietly repairing the ${region.name}, returning old bodies and fallen plants to the soil.`, region.id);
      } else {
        this.note(`The ${region.name} remains balanced for now: not still, but not yet in crisis.`, region.id);
      }
    }
  }
}
