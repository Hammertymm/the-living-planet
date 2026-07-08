import type { AnimalSex, Entity, NotableRole, SocialSpecies } from './types';
import { RNG } from './random';

const FEMALE_NAMES = ['Mara', 'Asha', 'Nima', 'Tala', 'Sena', 'Orla', 'Kiri', 'Vela', 'Iria', 'Edda', 'Luma', 'Rhea'];
const MALE_NAMES = ['Tarin', 'Koro', 'Bram', 'Orin', 'Rook', 'Daro', 'Vale', 'Ivo', 'Marek', 'Soren', 'Pax', 'Nilo'];
const SPECIES_TITLES: Record<SocialSpecies, string[]> = {
  grazer: ['Amber', 'Reed', 'Dune', 'River', 'Ash', 'Meadow', 'Stone', 'Dawn'],
  predator: ['Red', 'Night', 'Iron', 'Shadow', 'Storm', 'Black', 'Frost', 'Ember'],
  scavenger: ['Sky', 'Dust', 'Pale', 'Longwing', 'Cloud', 'Grey', 'Sun', 'Marsh'],
};

export function individualName(species: SocialSpecies, sex: AnimalSex, serial: number, rng: RNG): string {
  const names = sex === 'female' ? FEMALE_NAMES : MALE_NAMES;
  const prefix = SPECIES_TITLES[species][serial % SPECIES_TITLES[species].length];
  const base = names[(serial + rng.int(0, names.length - 1)) % names.length];
  return `${base} of the ${prefix}`;
}

export function lifeStage(entity: Entity): 'juvenile' | 'adult' | 'elder' {
  if (entity.species === 'grazer') {
    if (entity.age < 100) return 'juvenile';
    if (entity.age > 1850) return 'elder';
  }
  if (entity.species === 'predator') {
    if (entity.age < 140) return 'juvenile';
    if (entity.age > 2050) return 'elder';
  }
  if (entity.species === 'scavenger') {
    if (entity.age < 115) return 'juvenile';
    if (entity.age > 1950) return 'elder';
  }
  return 'adult';
}

export function notableRole(entity: Entity): NotableRole {
  const stage = lifeStage(entity);
  if (stage === 'elder') return 'elder';
  if ((entity.kills ?? 0) >= 5 && entity.species === 'predator') return 'hunter';
  if ((entity.offspringCount ?? 0) >= 5 && entity.sex === 'female') return 'matriarch';
  if ((entity.injury ?? 0) > 0.45 || entity.age > 1500) return 'survivor';
  if (entity.genome.vision > 1.18) return 'scout';
  if (entity.genome.cooperation > 1.18) return 'sentinel';
  return 'pathfinder';
}

export function notableScore(entity: Entity): number {
  const stage = lifeStage(entity);
  return entity.age * 0.012
    + (entity.offspringCount ?? 0) * 9
    + (entity.kills ?? 0) * 12
    + (stage === 'elder' ? 18 : 0)
    + (entity.notable ? 30 : 0)
    + entity.genome.resilience * 5
    + entity.genome.cooperation * 4;
}
