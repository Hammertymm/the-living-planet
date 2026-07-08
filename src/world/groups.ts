import type { Region, SocialGroup, SocialSpecies } from './types';

const grazerAdjectives = ['Ashplain', 'Sunfield', 'Mossback', 'Longgrass', 'Silverstep', 'Rainward', 'Amberhorn', 'Riverbend', 'Thistledown', 'Greenwake'];
const grazerNouns = ['Herd', 'Grazers', 'Drift', 'Company', 'Caravan'];
const predatorAdjectives = ['Red Ridge', 'Nightwater', 'Stonejaw', 'Northwind', 'Ember', 'Black Fern', 'Cold Hollow', 'Grey Tooth'];
const predatorNouns = ['Pack', 'Hunters', 'Lineage', 'Pride'];
const scavengerAdjectives = ['Whitewing', 'Dustcircling', 'Highwatch', 'Bonefield', 'Longshadow', 'Stormglass'];
const scavengerNouns = ['Colony', 'Flock', 'Gathering', 'Watch'];

export const groupColors: Record<SocialSpecies, string[]> = {
  grazer: ['#f4dd72', '#e7c964', '#cadc88', '#e3d09b', '#bcd487', '#f0c86e'],
  predator: ['#ef6b5a', '#d95649', '#f08b63', '#c94942', '#e66d7a', '#bf5b4e'],
  scavenger: ['#d8eff1', '#c5d7e7', '#ece2bd', '#c9c0ad', '#c5e6d8', '#e0d5c8'],
};

function hash(value: string): number {
  let result = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    result ^= value.charCodeAt(i);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

export function groupName(species: SocialSpecies, serial: number, region: Region): string {
  const seed = hash(`${species}:${serial}:${region.id}`);
  if (species === 'grazer') {
    return `${grazerAdjectives[seed % grazerAdjectives.length]} ${grazerNouns[(seed >>> 4) % grazerNouns.length]}`;
  }
  if (species === 'predator') {
    return `${predatorAdjectives[seed % predatorAdjectives.length]} ${predatorNouns[(seed >>> 5) % predatorNouns.length]}`;
  }
  return `${scavengerAdjectives[seed % scavengerAdjectives.length]} ${scavengerNouns[(seed >>> 6) % scavengerNouns.length]}`;
}

export function groupColor(species: SocialSpecies, serial: number): string {
  const colors = groupColors[species];
  return colors[serial % colors.length];
}

export function groupCentroid(group: SocialGroup, positions: Map<number, { x: number; y: number }>): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let count = 0;
  for (const id of group.memberIds) {
    const point = positions.get(id);
    if (!point) continue;
    x += point.x;
    y += point.y;
    count += 1;
  }
  return count > 0 ? { x: x / count, y: y / count } : { x: group.homeX, y: group.homeY };
}
