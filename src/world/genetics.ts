import type { Genome, LineageSpecies, Region, Species } from './types';
import { RNG } from './random';

const TRAIT_KEYS: Array<keyof Genome> = [
  'speed',
  'metabolism',
  'fertility',
  'vision',
  'resilience',
  'cooperation',
  'camouflage',
];

const SPECIES_HUES: Record<LineageSpecies, number> = {
  plant: 112,
  grazer: 52,
  predator: 8,
  scavenger: 198,
  fungi: 276,
};

const TRAIT_WORDS: Record<keyof Genome, string[]> = {
  speed: ['Swift', 'Longstride', 'Fleet', 'Windborne'],
  metabolism: ['Thrifty', 'Slowburn', 'Lean', 'Enduring'],
  fertility: ['Manyborn', 'Quickbloom', 'Prolific', 'Spring'],
  vision: ['Farseeing', 'Watchful', 'Wide-Eyed', 'Horizon'],
  resilience: ['Hardy', 'Stoneback', 'Weathered', 'Ironroot'],
  cooperation: ['Gathered', 'Chorus', 'Kinbound', 'Packwise'],
  camouflage: ['Dusky', 'Mottled', 'Shadow', 'Veiled'],
};

const SPECIES_WORDS: Record<LineageSpecies, string[]> = {
  plant: ['Grass', 'Reed', 'Shrub', 'Bloom'],
  grazer: ['Grazer', 'Runner', 'Browser', 'Herd'],
  predator: ['Hunter', 'Stalker', 'Wolf', 'Prowler'],
  scavenger: ['Kite', 'Rook', 'Forager', 'Scavenger'],
  fungi: ['Mycelium', 'Fungus', 'Mould', 'Bloom'],
};

function cap(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function randomGenome(species: Species, rng: RNG, bias = 0): Genome {
  const social = species === 'grazer' || species === 'predator' || species === 'scavenger';
  const base = (center: number, spread = 0.14) => cap(center + rng.range(-spread, spread) + bias, 0.55, 1.45);
  return {
    speed: base(species === 'predator' ? 1.1 : species === 'grazer' ? 1.02 : social ? 0.96 : 0.82),
    metabolism: base(species === 'predator' ? 1.08 : 0.96),
    fertility: base(species === 'plant' || species === 'fungi' ? 1.08 : 0.95),
    vision: base(species === 'predator' ? 1.15 : social ? 1.0 : 0.75),
    resilience: base(species === 'fungi' ? 1.16 : 1.0),
    cooperation: base(social ? 1.05 : 0.72),
    camouflage: base(species === 'grazer' || species === 'predator' ? 1.02 : 0.88),
  };
}

export function mutateGenome(parent: Genome, rng: RNG, scale = 0.055): Genome {
  const child = {} as Genome;
  for (const key of TRAIT_KEYS) {
    const rareLeap = rng.next() < 0.018 ? rng.range(-0.18, 0.18) : 0;
    child[key] = cap(parent[key] + rng.range(-scale, scale) + rareLeap, 0.45, 1.65);
  }
  return child;
}

export function genomeDistance(a: Genome, b: Genome): number {
  const sum = TRAIT_KEYS.reduce((total, key) => total + Math.pow(a[key] - b[key], 2), 0);
  return Math.sqrt(sum / TRAIT_KEYS.length);
}

export function dominantTrait(genome: Genome): keyof Genome {
  let selected: keyof Genome = 'speed';
  let score = -Infinity;
  for (const key of TRAIT_KEYS) {
    const value = key === 'metabolism' ? 2 - genome[key] : genome[key];
    if (value > score) {
      score = value;
      selected = key;
    }
  }
  return selected;
}

export function lineageName(species: LineageSpecies, genome: Genome, region: Region, index: number): string {
  const trait = dominantTrait(genome);
  const traitWords = TRAIT_WORDS[trait];
  const speciesWords = SPECIES_WORDS[species];
  const regionWord = region.name.replace(/\b(Northern|Southern|Eastern|Western|Central|Coastal)\b\s*/i, '').split(/\s+/)[0] || region.name;
  const mode = index % 3;
  if (mode === 0) return `${regionWord} ${traitWords[index % traitWords.length]} ${speciesWords[index % speciesWords.length]}`;
  if (mode === 1) return `${traitWords[index % traitWords.length]} ${speciesWords[(index + 1) % speciesWords.length]}`;
  return `${region.name} ${speciesWords[(index + 2) % speciesWords.length]}`;
}

export function lineageColor(species: LineageSpecies, genome: Genome, index: number): string {
  const trait = dominantTrait(genome);
  const traitIndex = TRAIT_KEYS.indexOf(trait);
  const hue = (SPECIES_HUES[species] + traitIndex * 8 + index * 17) % 360;
  const saturation = species === 'plant' ? 48 : species === 'fungi' ? 58 : 66;
  const lightness = species === 'predator' ? 58 : 64;
  return `hsl(${Math.round(hue)} ${saturation}% ${lightness}%)`;
}

export function averageGenome(genomes: Genome[]): Genome {
  if (!genomes.length) {
    return { speed: 1, metabolism: 1, fertility: 1, vision: 1, resilience: 1, cooperation: 1, camouflage: 1 };
  }
  const result = {} as Genome;
  for (const key of TRAIT_KEYS) result[key] = genomes.reduce((sum, genome) => sum + genome[key], 0) / genomes.length;
  return result;
}

export function traitSummary(genome: Genome): string {
  const trait = dominantTrait(genome);
  const labels: Record<keyof Genome, string> = {
    speed: 'unusually fast movement',
    metabolism: 'low energy demand',
    fertility: 'high reproductive output',
    vision: 'long-range perception',
    resilience: 'strong environmental resilience',
    cooperation: 'strong group cooperation',
    camouflage: 'effective camouflage',
  };
  return labels[trait];
}
