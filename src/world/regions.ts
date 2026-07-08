import type { Region, Tile } from './types';

interface RegionTemplate {
  id: string;
  name: string;
  nx: number;
  ny: number;
  prefer?: 'shore' | 'highland' | 'wetland' | 'plain';
}

const templates: RegionTemplate[] = [
  { id: 'north', name: 'Northern Highlands', nx: 0.50, ny: 0.20, prefer: 'highland' },
  { id: 'west', name: 'Western Basin', nx: 0.27, ny: 0.50, prefer: 'plain' },
  { id: 'central', name: 'Central Plains', nx: 0.50, ny: 0.53, prefer: 'plain' },
  { id: 'east', name: 'Eastern Wetlands', nx: 0.73, ny: 0.49, prefer: 'wetland' },
  { id: 'south', name: 'Southern Ridge', nx: 0.49, ny: 0.78, prefer: 'highland' },
  { id: 'coast', name: 'Coastal Flats', nx: 0.72, ny: 0.76, prefer: 'shore' },
];

function isHabitable(tile: Tile): boolean {
  return tile.biome !== 'ocean' && tile.biome !== 'snow';
}

function preferenceScore(tile: Tile, prefer?: RegionTemplate['prefer']): number {
  if (!prefer) return 0;
  if (prefer === 'shore') return tile.biome === 'shore' ? 5 : -Math.abs(tile.elevation - 0.35) * 8;
  if (prefer === 'highland') return tile.elevation * 4 + (tile.biome === 'rock' ? 1.5 : 0);
  if (prefer === 'wetland') return tile.moisture * 4 + tile.fertility * 2;
  return (1 - Math.abs(tile.elevation - 0.48)) * 2 + tile.fertility;
}

export function generateRegions(tiles: Tile[], width: number, height: number): Region[] {
  return templates.map((template) => {
    const targetX = template.nx * width;
    const targetY = template.ny * height;
    let bestX = Math.floor(targetX);
    let bestY = Math.floor(targetY);
    let bestScore = Number.POSITIVE_INFINITY;

    for (let y = 2; y < height - 2; y += 1) {
      for (let x = 2; x < width - 2; x += 1) {
        const tile = tiles[x + y * width];
        if (!isHabitable(tile)) continue;
        const distance = Math.hypot(x - targetX, y - targetY);
        const score = distance - preferenceScore(tile, template.prefer) * 4;
        if (score < bestScore) {
          bestScore = score;
          bestX = x;
          bestY = y;
        }
      }
    }

    return { id: template.id, name: template.name, x: bestX, y: bestY };
  });
}

export function nearestRegion(regions: Region[], x: number, y: number): Region {
  let nearest = regions[0];
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const region of regions) {
    const distance = Math.hypot(region.x - x, region.y - y);
    if (distance < nearestDistance) {
      nearest = region;
      nearestDistance = distance;
    }
  }
  return nearest;
}
