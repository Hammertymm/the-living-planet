import type { ClimateEra, ClimateEraKind, EcologicalNiche, Entity, Genome, Species, Tile } from './types';

function cap(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function assignNiche(species: Species, tile: Tile, genome: Genome): EcologicalNiche | undefined {
  if (species === 'carrion') return undefined;

  if (species === 'plant') {
    if (tile.burn > 0.34 || genome.resilience > 1.2) return 'firebloom';
    if (tile.water > 0.32 || tile.biome === 'wetland') return 'wetland-reed';
    if (tile.biome === 'forest' || genome.cooperation > 1.16) return 'canopy-growth';
    if (tile.moisture < 0.38 || genome.resilience > 1.12) return 'deep-root-shrub';
    return 'pioneer-grass';
  }

  if (species === 'fungi') {
    if (tile.burn > 0.28) return 'burn-scar-coloniser';
    if (tile.water > 0.32 || tile.biome === 'wetland') return 'wetland-fungus';
    if (tile.biome === 'forest' || genome.cooperation > 1.12) return 'root-symbiont';
    return 'carrion-decomposer';
  }

  if (species === 'grazer') {
    if (tile.water > 0.3 || tile.biome === 'wetland') return 'wetland-grazer';
    if (tile.elevation > 0.61 || genome.resilience > 1.24) return 'highland-grazer';
    if (tile.biome === 'forest' || genome.vision > 1.17) return 'browser';
    if (genome.speed > 1.12 || genome.cooperation > 1.14) return 'migratory-generalist';
    return 'grass-feeder';
  }

  if (species === 'predator') {
    if (tile.water > 0.24) return 'waterhole-hunter';
    if (genome.cooperation > 1.16) return 'pack-hunter';
    if (genome.speed > 1.16) return 'pursuit-hunter';
    if (genome.camouflage > 1.15 || tile.biome === 'forest') return 'ambush-hunter';
    return 'solitary-stalker';
  }

  if (tile.water > 0.28 || tile.biome === 'wetland') return 'wetland-forager';
  if (tile.biome === 'forest') return 'forest-forager';
  return 'open-country-scavenger';
}

export function nicheLabel(niche?: EcologicalNiche): string {
  if (!niche) return 'generalist';
  return niche.replace(/-/g, ' ');
}

export function nicheSuitability(entity: Entity, tile: Tile): number {
  switch (entity.niche) {
    case 'pioneer-grass': return cap(0.85 + tile.fertility * 0.35 - tile.trail * 0.25, 0.45, 1.35);
    case 'deep-root-shrub': return cap(0.78 + (1 - tile.moisture) * 0.35 + tile.fertility * 0.16, 0.45, 1.35);
    case 'wetland-reed': return cap(0.55 + tile.water * 0.9 + tile.moisture * 0.25, 0.35, 1.5);
    case 'canopy-growth': return cap(0.62 + tile.moisture * 0.38 + tile.succession * 0.42, 0.4, 1.5);
    case 'firebloom': return cap(0.58 + tile.burn * 0.72 + tile.fertility * 0.22, 0.4, 1.55);
    case 'grass-feeder': return tile.biome === 'grass' ? 1.24 : tile.biome === 'wetland' ? 0.78 : 0.88;
    case 'browser': return tile.biome === 'forest' ? 1.28 : tile.biome === 'grass' ? 0.84 : 0.95;
    case 'wetland-grazer': return cap(0.68 + tile.water * 0.72, 0.5, 1.4);
    case 'highland-grazer': return cap(0.75 + tile.elevation * 0.5 - tile.heat * 0.18, 0.5, 1.4);
    case 'migratory-generalist': return 1.03;
    case 'pursuit-hunter': return tile.biome === 'grass' ? 1.18 : 0.94;
    case 'ambush-hunter': return tile.biome === 'forest' || tile.biome === 'wetland' ? 1.22 : 0.88;
    case 'pack-hunter': return 1.07;
    case 'solitary-stalker': return tile.pressure < 0.35 ? 1.08 : 0.88;
    case 'waterhole-hunter': return cap(0.78 + tile.water * 0.65, 0.6, 1.35);
    case 'open-country-scavenger': return tile.biome === 'grass' || tile.biome === 'shore' ? 1.14 : 0.9;
    case 'wetland-forager': return cap(0.72 + tile.water * 0.65, 0.55, 1.35);
    case 'forest-forager': return tile.biome === 'forest' ? 1.2 : 0.9;
    case 'carrion-decomposer': return 1.05;
    case 'root-symbiont': return tile.biome === 'forest' ? 1.2 : 0.88;
    case 'burn-scar-coloniser': return cap(0.66 + tile.burn * 0.72, 0.48, 1.42);
    case 'wetland-fungus': return cap(0.66 + tile.water * 0.68, 0.48, 1.42);
    default: return 1;
  }
}

export const CLIMATE_ERA_NAMES: Record<ClimateEraKind, string[]> = {
  temperate: ['The Balanced Years', 'The Mild Cycle', 'The Green Interval'],
  wet: ['The Returning Rains', 'The Flooded Years', 'The Long Wet'],
  dry: ['The Long Thirst', 'The Dust Years', 'The Withdrawing Waters'],
  cooling: ['The Pale Seasons', 'The Cooling Age', 'The Long Wintering'],
  fire: ['The Ash Years', 'The Ember Cycle', 'The Burning Interval'],
};

export function climateEraEffects(era: ClimateEra): {
  moisture: number;
  heat: number;
  fire: number;
  rainBias: number;
  dryBias: number;
  stormBias: number;
} {
  const strength = era.intensity;
  if (era.kind === 'wet') return { moisture: 0.00034 * strength, heat: -0.00008 * strength, fire: 0.72, rainBias: 0.18, dryBias: -0.16, stormBias: 0.08 };
  if (era.kind === 'dry') return { moisture: -0.00034 * strength, heat: 0.00012 * strength, fire: 1.28, rainBias: -0.15, dryBias: 0.2, stormBias: -0.02 };
  if (era.kind === 'cooling') return { moisture: 0.00006 * strength, heat: -0.00024 * strength, fire: 0.82, rainBias: 0.03, dryBias: -0.05, stormBias: 0.04 };
  if (era.kind === 'fire') return { moisture: -0.00016 * strength, heat: 0.00018 * strength, fire: 1.55, rainBias: -0.08, dryBias: 0.12, stormBias: 0.03 };
  return { moisture: 0, heat: 0, fire: 1, rainBias: 0, dryBias: 0, stormBias: 0 };
}
