import type { LivingPlanetBridge } from '../integration/bridge';
import type { Region } from '../world/types';
import type { ScenarioIntervention, WorldRecipe } from './types';

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0) || 4319;
}

function region(regions: Region[], id: string, fallback = 0): Region {
  return regions.find((candidate) => candidate.id === id) ?? regions[fallback % Math.max(1, regions.length)];
}

function titleFromPrompt(prompt: string, seed: number): string {
  const meaningful = prompt
    .replace(/[^a-z0-9\s-]/gi, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3 && !['with', 'world', 'planet', 'create', 'make', 'where', 'that', 'very'].includes(word.toLowerCase()))
    .slice(0, 3)
    .map((word) => `${word[0].toUpperCase()}${word.slice(1).toLowerCase()}`);
  return meaningful.length ? meaningful.join(' ') : `Eden-${seed}`;
}

export function composeRecipe(prompt: string, regions: Region[]): WorldRecipe {
  const clean = prompt.trim() || 'A balanced living world with wetlands, grasslands and resilient food webs.';
  const lower = clean.toLowerCase();
  const seed = 1 + (hash(clean) % 999_999_998);
  const interventions: ScenarioIntervention[] = [];
  const tags: string[] = [];

  const add = (tool: ScenarioIntervention['tool'], regionId: string, radius: number, repetitions = 1) => {
    interventions.push({ tool, regionId: region(regions, regionId).id, radius, repetitions });
  };

  if (/wet|rain|river|marsh|swamp|rainforest|monsoon/.test(lower)) {
    tags.push('wet');
    add('rain', 'east', 18, /rainforest|monsoon/.test(lower) ? 3 : 2);
    add('plants', 'east', 17, 2);
    add('fungi', 'east', 12, 1);
  }
  if (/dry|desert|arid|drought|savanna/.test(lower)) {
    tags.push('dry');
    add('drought', 'central', 18, /desert|arid/.test(lower) ? 3 : 2);
    add('fertility', 'coast', 8, 1);
  }
  if (/forest|woodland|jungle|lush/.test(lower)) {
    tags.push('forest');
    add('plants', 'north', 20, 3);
    add('fungi', 'west', 14, 2);
    add('rain', 'north', 13, 1);
  }
  if (/volcan|fire|ash|burn/.test(lower)) {
    tags.push('disturbance');
    add('wildfire', 'south', 10, 1);
    add('fertility', 'south', 15, 2);
    add('plants', 'south', 9, 1);
  }
  if (/grazer|herd|prey|rabbit|deer/.test(lower)) {
    tags.push('grazers');
    add('grazers', 'central', 11, /many|abundant|large/.test(lower) ? 3 : 2);
    add('plants', 'central', 16, 2);
  }
  if (/predator|wolf|wolves|hunter|carnivore/.test(lower)) {
    tags.push('predators');
    add('predators', 'north', 8, /many|dominant|intense/.test(lower) ? 2 : 1);
  }
  if (/fung|mushroom|decompos|mycel/.test(lower)) {
    tags.push('fungal');
    add('fungi', 'west', 18, 3);
    add('fertility', 'west', 12, 1);
  }
  if (/fragile|harsh|stress|collapse/.test(lower)) {
    tags.push('fragile');
    add('drought', 'central', 13, 1);
    add('predators', 'west', 6, 1);
  }
  if (/balanced|stable|resilient|diverse/.test(lower) || interventions.length === 0) {
    tags.push('balanced');
    add('rain', 'east', 12, 1);
    add('plants', 'central', 15, 2);
    add('grazers', 'central', 10, 1);
    add('fungi', 'west', 10, 1);
    add('fertility', 'south', 10, 1);
  }

  return {
    name: titleFromPrompt(clean, seed),
    seed,
    description: clean,
    interventions: interventions.slice(0, 12),
    tags: [...new Set(tags)],
  };
}

export async function applyRecipe(bridge: LivingPlanetBridge, recipe: WorldRecipe): Promise<void> {
  await bridge.createWorld(recipe.name, recipe.seed);
  const regions = bridge.regions();
  for (const step of recipe.interventions) {
    const target = region(regions, step.regionId);
    const repetitions = Math.max(1, Math.min(4, step.repetitions ?? 1));
    for (let index = 0; index < repetitions; index += 1) {
      const angle = (index / repetitions) * Math.PI * 2;
      const offset = index === 0 ? 0 : Math.min(7, step.radius * 0.35);
      bridge.intervene(
        step.tool,
        target.x + Math.cos(angle) * offset,
        target.y + Math.sin(angle) * offset,
        step.radius,
        index === repetitions - 1,
      );
    }
  }
  bridge.setView('natural');
  bridge.recenter();
}
