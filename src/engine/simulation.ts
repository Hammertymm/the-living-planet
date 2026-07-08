import { RNG } from '../world/random';
import { generateTiles } from '../world/generator';
import { generateRegions, nearestRegion } from '../world/regions';
import type { Entity, PlanetState, Region, Species, Tile } from '../world/types';

const W = 180;
const H = 110;
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
    energy: species === 'predator' ? 90 : species === 'grazer' ? 70 : 40,
    age: 0,
    breed: rng.int(0, 5),
    cooldown: 0,
  };
}

function isLand(tile: Tile): boolean {
  return tile.biome !== 'ocean' && tile.biome !== 'rock' && tile.biome !== 'snow';
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

  private landPoint(): { x: number; y: number } {
    for (let i = 0; i < 500; i += 1) {
      const x = this.rng.int(5, W - 6);
      const y = this.rng.int(5, H - 6);
      if (isLand(this.state.tiles[idx(x, y)])) return { x, y };
    }
    return { x: W / 2, y: H / 2 };
  }

  private pointNear(region: Region, radius = 12): { x: number; y: number } {
    for (let i = 0; i < 300; i += 1) {
      const angle = this.rng.range(0, Math.PI * 2);
      const distance = Math.sqrt(this.rng.next()) * radius;
      const x = Math.max(2, Math.min(W - 3, region.x + Math.cos(angle) * distance));
      const y = Math.max(2, Math.min(H - 3, region.y + Math.sin(angle) * distance));
      if (isLand(this.state.tiles[idx(x, y)])) return { x, y };
    }
    return this.landPoint();
  }

  private affectRegion(region: Region, radius: number, effect: (tile: Tile) => void): void {
    const minX = Math.max(0, Math.floor(region.x - radius));
    const maxX = Math.min(W - 1, Math.ceil(region.x + radius));
    const minY = Math.max(0, Math.floor(region.y - radius));
    const maxY = Math.min(H - 1, Math.ceil(region.y + radius));
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const distance = Math.hypot(x - region.x, y - region.y);
        if (distance > radius) continue;
        const strength = 1 - distance / radius;
        effect(this.state.tiles[x + y * W]);
        // Soften the edge by partially restoring the original effect strength.
        if (strength < 0.35 && this.rng.next() > strength * 2) continue;
      }
    }
  }

  private seedCluster(species: Species, count: number, region: Region, radius = 10): void {
    for (let i = 0; i < count; i += 1) {
      const point = this.pointNear(region, radius);
      this.state.entities.push(entity(species, point.x, point.y, this.rng));
    }
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

  intervene(kind: string): void {
    if (kind === 'rain') {
      const region = this.region('east');
      this.affectRegion(region, 24, (tile) => {
        tile.moisture = Math.min(1, tile.moisture + 0.24);
        tile.fertility = Math.min(1, tile.fertility + 0.05);
      });
      this.note(`A rainstorm settles over the ${region.name}. Low ground darkens and new vegetation brightens along the waterline.`, region.id);
    }
    if (kind === 'drought') {
      const region = this.region('central');
      this.affectRegion(region, 28, (tile) => {
        tile.moisture = Math.max(0, tile.moisture - 0.28);
      });
      this.note(`A dry spell grips the ${region.name}. Grazers begin to search beyond their familiar feeding grounds.`, region.id);
    }
    if (kind === 'forest') {
      const region = this.region('north');
      this.seedCluster('plant', 260, region, 17);
      this.note(`New forest growth spreads through the ${region.name}, creating shelter and breaking up the open ground.`, region.id);
    }
    if (kind === 'herd') {
      const region = this.region('central');
      this.seedCluster('grazer', 35, region, 14);
      this.note(`A migrating herd enters the ${region.name}, testing the carrying capacity of its grasslands.`, region.id);
    }
    if (kind === 'wolves') {
      const region = this.region('north');
      this.seedCluster('predator', 6, region, 12);
      this.note(`A small predator lineage appears along the ${region.name}. Its success will depend on cover, prey and restraint.`, region.id);
    }
    if (kind === 'fungi') {
      const region = this.region('west');
      this.seedCluster('fungi', 120, region, 16);
      this.note(`Fungal threads bloom beneath the ${region.name}, preparing dead matter for its return to the soil.`, region.id);
    }
  }

  step(): void {
    this.state.day += 1;
    this.state.season = (this.state.day % 360) / 360;

    for (const tile of this.state.tiles) {
      tile.pressure *= 0.96;
      const seasonal = Math.sin(this.state.season * Math.PI * 2);
      tile.moisture = Math.max(0, Math.min(1, tile.moisture + seasonal * 0.0008 - 0.0003));
      tile.fertility = Math.max(0, Math.min(1, tile.fertility + 0.0002));
    }

    const entities = this.state.entities;
    for (const current of entities) {
      current.age += 1;
      current.cooldown = Math.max(0, current.cooldown - 1);
      const tile = this.state.tiles[idx(current.x, current.y)];

      if (current.species === 'plant') {
        current.energy += tile.moisture * 0.035 + tile.fertility * 0.025 - 0.018;
        if (current.energy > 75 && entities.length < 2200 && this.rng.next() < 0.015) {
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
        if (current.energy > 60 && entities.length < 2200 && this.rng.next() < 0.006) {
          const nx = current.x + this.rng.range(-2, 2);
          const ny = current.y + this.rng.range(-2, 2);
          entities.push(entity('fungi', nx, ny, this.rng));
          current.energy *= 0.72;
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
        current.x = Math.max(1, Math.min(W - 2, current.x));
        current.y = Math.max(1, Math.min(H - 2, current.y));
        const reproductionThreshold = current.species === 'predator' ? 180 : current.species === 'scavenger' ? 120 : 95;
        if (current.energy > reproductionThreshold && current.cooldown === 0 && entities.length < 2200) {
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
    this.state.entities = survivors.slice(0, 2400);

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
