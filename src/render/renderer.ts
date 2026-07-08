import type { ClimateFront, Landmark, PlacementTool, PlanetState, SocialGroup, Tile, ViewMode } from '../world/types';


export interface CinematicCaption {
  eyebrow: string;
  title: string;
  body: string;
}

export interface AtmosphereState {
  enabled: boolean;
  intensity: number;
  cycleSpeed: number;
  fog: boolean;
  cloudShadows: boolean;
}

const WORLD_WIDTH = 180;
const WORLD_HEIGHT = 110;

const biomeColors: Record<string, string> = {
  ocean: '#163d58',
  shore: '#887656',
  grass: '#395d35',
  wetland: '#2f6353',
  forest: '#244b30',
  rock: '#555a5a',
  snow: '#c7d3d2',
};

type RGB = [number, number, number];

const biomeRgb: Record<string, RGB> = {
  ocean: [22, 61, 88],
  shore: [136, 118, 86],
  grass: [57, 93, 53],
  wetland: [47, 99, 83],
  forest: [36, 75, 48],
  rock: [85, 90, 90],
  snow: [199, 211, 210],
};

function rgb(values: RGB): string {
  return `rgb(${Math.round(values[0])},${Math.round(values[1])},${Math.round(values[2])})`;
}

function mix(a: RGB, b: RGB, amount: number): RGB {
  const t = clamp(amount, 0, 1);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

const speciesColors: Record<string, string[]> = {
  plant: ['#66a95e'],
  fungi: ['#a06bd6'],
  carrion: ['#7b5a3d'],
  grazer: ['#e0d37b', '#d4c46c', '#c9b65b', '#b9d080', '#e8d998', '#cddc88'],
  predator: ['#df6b55', '#c65346', '#e38659', '#b9483d', '#f08b6c', '#d0574a'],
  scavenger: ['#d7d0c0', '#c9bda8', '#b9c8d5', '#eee4c6', '#bcb3a1', '#d4cbb8'],
};

const groupOverlayColors: Record<SocialGroup['species'], string> = {
  grazer: '#e4d866',
  predator: '#f05f57',
  scavenger: '#65c5d8',
};

const toolColors: Record<PlacementTool, string> = {
  observe: '#dce8e2',
  plants: '#75c86b',
  grazers: '#f1dd72',
  predators: '#f16363',
  scavengers: '#d5eef2',
  fungi: '#bd7cf0',
  rain: '#69bfff',
  drought: '#e4a45d',
  fertility: '#c6dd68',
  wildfire: '#ff754d',
};

const toolLabels: Record<PlacementTool, string> = {
  observe: 'Observe',
  plants: 'Plant growth',
  grazers: 'Grazer herd',
  predators: 'Predator pack',
  scavengers: 'Scavengers',
  fungi: 'Fungal colony',
  rain: 'Rain front',
  drought: 'Drought',
  fertility: 'Fertile soil',
  wildfire: 'Wildfire',
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  camera = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2, zoom: 7 };
  view: ViewMode = 'natural';
  showLabels = true;
  private targetCamera: { x: number; y: number; zoom: number } | null = null;
  brush = { tool: 'observe' as PlacementTool, x: 0, y: 0, radius: 8, visible: false };
  highlightEntityId?: number;
  hoverEntityId?: number;
  cinematicCaption?: CinematicCaption;
  atmosphere: AtmosphereState = { enabled: true, intensity: 0.68, cycleSpeed: 1, fog: true, cloudShadows: true };

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unsupported');
    this.ctx = ctx;
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  resize(): void {
    this.dpr = devicePixelRatio || 1;
    this.canvas.width = innerWidth * this.dpr;
    this.canvas.height = innerHeight * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  recenter(): void {
    this.focus(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 7);
  }

  focus(x: number, y: number, zoom = this.camera.zoom): void {
    this.targetCamera = null;
    this.camera.x = clamp(x, 0, WORLD_WIDTH);
    this.camera.y = clamp(y, 0, WORLD_HEIGHT);
    this.camera.zoom = clamp(zoom, 3, 18);
  }

  setCinematicTarget(x: number, y: number, zoom = 9): void {
    this.targetCamera = {
      x: clamp(x, 0, WORLD_WIDTH),
      y: clamp(y, 0, WORLD_HEIGHT),
      zoom: clamp(zoom, 3, 18),
    };
  }

  cancelCinematic(): void {
    this.targetCamera = null;
  }


  setCinematicCaption(caption?: CinematicCaption): void {
    this.cinematicCaption = caption;
  }

  setAtmosphere(settings: Partial<AtmosphereState>): void {
    this.atmosphere = { ...this.atmosphere, ...settings };
  }

  private updateCamera(): void {
    if (!this.targetCamera) return;
    const ease = 0.025;
    this.camera.x += (this.targetCamera.x - this.camera.x) * ease;
    this.camera.y += (this.targetCamera.y - this.camera.y) * ease;
    this.camera.zoom += (this.targetCamera.zoom - this.camera.zoom) * ease;
    if (
      Math.hypot(this.targetCamera.x - this.camera.x, this.targetCamera.y - this.camera.y) < 0.06
      && Math.abs(this.targetCamera.zoom - this.camera.zoom) < 0.03
    ) this.targetCamera = null;
  }

  screen(x: number, y: number): { x: number; y: number } {
    return {
      x: (x - this.camera.x) * this.camera.zoom + innerWidth / 2,
      y: (y - this.camera.y) * this.camera.zoom + innerHeight / 2,
    };
  }

  worldFromScreen(x: number, y: number): { x: number; y: number } {
    return {
      x: (x - innerWidth / 2) / this.camera.zoom + this.camera.x,
      y: (y - innerHeight / 2) / this.camera.zoom + this.camera.y,
    };
  }

  private groupCenter(group: SocialGroup, state: PlanetState): { x: number; y: number } {
    const members = new Set(group.memberIds);
    let x = 0;
    let y = 0;
    let count = 0;
    for (const entity of state.entities) {
      if (!members.has(entity.id)) continue;
      x += entity.x;
      y += entity.y;
      count += 1;
    }
    return count > 0 ? { x: x / count, y: y / count } : { x: group.homeX, y: group.homeY };
  }

  private terrainColor(tile: Tile, state: PlanetState, x: number, y: number): string {
    let color: RGB = [...biomeRgb[tile.biome]] as RGB;
    if (tile.biome === 'ocean') {
      const shimmer = (Math.sin(x * 0.31 + y * 0.19 + performance.now() * 0.0007) + 1) * 0.5;
      color = mix(color, [32, 83, 111], 0.12 + shimmer * 0.08);
      return rgb(color);
    }
    if (tile.biome === 'grass' || tile.biome === 'forest' || tile.biome === 'wetland') {
      const health = clamp(tile.moisture * 0.58 + tile.fertility * 0.42, 0, 1);
      color = mix(color, [29, 54, 35], 0.34 * (1 - health));
      if (state.seasonName === 'Summer') color = mix(color, [126, 111, 51], 0.22 + (1 - tile.moisture) * 0.25);
      if (state.seasonName === 'Autumn') color = mix(color, [112, 76, 39], tile.biome === 'forest' ? 0.28 : tile.biome === 'wetland' ? 0.08 : 0.12);
      if (state.seasonName === 'Winter') color = mix(color, [92, 105, 91], 0.28);
      if (state.seasonName === 'Spring') color = mix(color, [72, 126, 63], 0.18 * health);
    }
    if (tile.biome === 'shore' && state.seasonName === 'Summer') color = mix(color, [160, 132, 76], 0.18);
    return rgb(color);
  }

  private drawClimateFront(front: ClimateFront, view: ViewMode): void {
    const point = this.screen(front.x, front.y);
    const radius = front.radius * this.camera.zoom;
    if (point.x < -radius || point.y < -radius || point.x > innerWidth + radius || point.y > innerHeight + radius) return;
    const ctx = this.ctx;
    const color = front.kind === 'rain' ? [92, 173, 218] : front.kind === 'storm' ? [153, 151, 202] : [220, 157, 83];
    const alpha = view === 'climate' ? 0.34 : 0.085;
    const gradient = ctx.createRadialGradient(point.x, point.y, radius * 0.08, point.x, point.y, radius);
    gradient.addColorStop(0, `rgba(${color[0]},${color[1]},${color[2]},${alpha * front.intensity})`);
    gradient.addColorStop(0.55, `rgba(${color[0]},${color[1]},${color[2]},${alpha * 0.55 * front.intensity})`);
    gradient.addColorStop(1, `rgba(${color[0]},${color[1]},${color[2]},0)`);
    ctx.save();
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
    if (view === 'climate') {
      ctx.strokeStyle = `rgba(${color[0]},${color[1]},${color[2]},${0.65 * front.intensity})`;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([7, 7]);
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius * 0.72, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(5,10,11,.72)';
      ctx.font = '700 10px Inter, system-ui, sans-serif';
      const label = front.kind === 'rain' ? 'RAIN FRONT' : front.kind === 'storm' ? 'STORM CELL' : 'DRY FRONT';
      const width = ctx.measureText(label).width + 18;
      ctx.beginPath();
      ctx.roundRect(point.x - width / 2, point.y - 10, width, 20, 10);
      ctx.fill();
      ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, point.x, point.y + 0.5);
    }
    ctx.restore();
  }

  private drawClimate(state: PlanetState): void {
    for (const front of state.climateFronts) this.drawClimateFront(front, this.view);
    if (this.view !== 'climate') return;
    const ctx = this.ctx;
    const anchorX = 28;
    const anchorY = innerHeight - 92;
    const scale = 420;
    ctx.save();
    ctx.strokeStyle = 'rgba(217,235,228,.68)';
    ctx.fillStyle = 'rgba(217,235,228,.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(anchorX, anchorY);
    ctx.lineTo(anchorX + state.windX * scale, anchorY + state.windY * scale);
    ctx.stroke();
    const angle = Math.atan2(state.windY, state.windX);
    const endX = anchorX + state.windX * scale;
    const endY = anchorY + state.windY * scale;
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - Math.cos(angle - 0.55) * 8, endY - Math.sin(angle - 0.55) * 8);
    ctx.lineTo(endX - Math.cos(angle + 0.55) * 8, endY - Math.sin(angle + 0.55) * 8);
    ctx.closePath();
    ctx.fill();
    ctx.font = '700 9px Inter, system-ui, sans-serif';
    ctx.fillText('PREVAILING WIND', anchorX, anchorY - 12);
    ctx.restore();
  }

  private drawRegionLabels(state: PlanetState): void {
    if (!this.showLabels) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const region of state.regions) {
      const point = this.screen(region.x, region.y);
      if (point.x < -120 || point.y < -40 || point.x > innerWidth + 120 || point.y > innerHeight + 40) continue;

      ctx.font = '600 11px Inter, system-ui, sans-serif';
      const width = ctx.measureText(region.name.toUpperCase()).width + 24;
      ctx.fillStyle = 'rgba(2, 9, 9, 0.55)';
      ctx.strokeStyle = 'rgba(218, 236, 227, 0.20)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(point.x - width / 2, point.y - 12, width, 24, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(231, 241, 236, 0.86)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(region.name.toUpperCase(), point.x, point.y + 0.5);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  private drawEventMarkers(state: PlanetState): void {
    const ctx = this.ctx;
    const now = performance.now() / 1000;
    const recent = state.notes.filter((note) => note.regionId && state.day - note.day <= 420).slice(0, 4);

    ctx.save();
    for (let index = recent.length - 1; index >= 0; index -= 1) {
      const note = recent[index];
      const region = state.regions.find((candidate) => candidate.id === note.regionId);
      const x = note.focusX ?? region?.x;
      const y = note.focusY ?? region?.y;
      if (x === undefined || y === undefined) continue;
      const point = this.screen(x, y);
      if (point.x < -60 || point.y < -60 || point.x > innerWidth + 60 || point.y > innerHeight + 60) continue;
      const age = Math.max(0, state.day - note.day);
      const freshness = Math.max(0.18, 1 - age / 420);
      const pulse = index === 0 ? 1 + Math.sin(now * 2.6) * 0.16 : 1;
      const radius = (13 + index * 3) * pulse;
      ctx.globalAlpha = freshness * (index === 0 ? 0.9 : 0.42);
      ctx.strokeStyle = index === 0 ? '#a8e6c0' : '#d7c889';
      ctx.fillStyle = index === 0 ? 'rgba(118,220,158,.14)' : 'rgba(215,200,137,.08)';
      ctx.lineWidth = index === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = index === 0 ? '#c8f3d8' : '#eadfae';
      ctx.globalAlpha = freshness;
      ctx.fill();
    }
    ctx.restore();
  }

  private drawLandmark(landmark: Landmark, state: PlanetState): void {
    const ctx = this.ctx;
    const point = this.screen(landmark.x, landmark.y);
    if (point.x < -120 || point.y < -50 || point.x > innerWidth + 120 || point.y > innerHeight + 50) return;
    const age = Math.max(0, state.day - landmark.createdDay);
    const alpha = clamp(landmark.strength * (1 - age / 8000), 0.18, 0.9);
    const color = landmark.kind === 'burn-scar'
      ? '#d9784f'
      : landmark.kind === 'migration-route'
        ? '#d8c476'
        : landmark.kind === 'den'
          ? '#dc6757'
          : landmark.kind === 'waterhole'
            ? '#65bfe2'
            : landmark.kind === 'river-crossing'
              ? '#8bd2e8'
              : '#b9d47b';

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.fillStyle = `${color}2a`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (this.camera.zoom >= 6) {
      ctx.font = '600 10px Inter, system-ui, sans-serif';
      const width = ctx.measureText(landmark.name).width + 18;
      ctx.fillStyle = 'rgba(3,8,8,.78)';
      ctx.beginPath();
      ctx.roundRect(point.x + 8, point.y - 11, width, 21, 10);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(landmark.name, point.x + 17, point.y);
    }
    ctx.restore();
  }

  private drawGroupOverlays(state: PlanetState): void {
    if (this.view !== 'groups') return;
    const ctx = this.ctx;
    ctx.save();

    for (const group of state.groups) {
      const center = this.groupCenter(group, state);
      const point = this.screen(center.x, center.y);
      if (point.x < -180 || point.y < -100 || point.x > innerWidth + 180 || point.y > innerHeight + 100) continue;
      const territory = (group.species === 'predator' ? 8.5 : group.species === 'grazer' ? 6.8 : 7.5) + Math.sqrt(group.memberIds.length) * 0.75;
      const overlayColor = groupOverlayColors[group.species];

      ctx.strokeStyle = `${overlayColor}a8`;
      ctx.fillStyle = `${overlayColor}22`;
      ctx.lineWidth = group.species === 'predator' ? 2 : 1.25;
      ctx.setLineDash(group.species === 'grazer' ? [8, 6] : group.species === 'scavenger' ? [3, 5] : []);
      ctx.beginPath();
      ctx.ellipse(point.x, point.y, territory * this.camera.zoom, territory * this.camera.zoom * 0.68, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);

      if (group.route.length > 1) {
        ctx.strokeStyle = `${overlayColor}82`;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        group.route.forEach((routePoint, index) => {
          const route = this.screen(routePoint.x, routePoint.y);
          if (index === 0) ctx.moveTo(route.x, route.y);
          else ctx.lineTo(route.x, route.y);
        });
        ctx.stroke();
        ctx.setLineDash([]);
      }

      const label = `${group.name} · ${group.memberIds.length}`;
      ctx.font = '700 11px Inter, system-ui, sans-serif';
      const width = ctx.measureText(label).width + 22;
      ctx.fillStyle = 'rgba(2,8,8,.82)';
      ctx.strokeStyle = `${overlayColor}d0`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(point.x - width / 2, point.y - 16, width, 25, 12);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = overlayColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, point.x, point.y - 3.5);
    }
    ctx.restore();
  }

  private drawLineageOverlays(state: PlanetState): void {
    if (this.view !== 'lineages') return;
    const ctx = this.ctx;
    const active = state.lineages
      .filter((lineage) => lineage.population > 0)
      .sort((a, b) => b.population - a.population)
      .slice(0, 12);

    ctx.save();
    for (const lineage of active) {
      let x = 0;
      let y = 0;
      let count = 0;
      for (const entity of state.entities) {
        if (entity.lineageId !== lineage.id) continue;
        x += entity.x;
        y += entity.y;
        count += 1;
      }
      if (!count) continue;
      const point = this.screen(x / count, y / count);
      if (point.x < -120 || point.y < -40 || point.x > innerWidth + 120 || point.y > innerHeight + 40) continue;
      const label = `${lineage.name} · ${lineage.population}`;
      ctx.font = '700 10px Inter, system-ui, sans-serif';
      const width = ctx.measureText(label).width + 20;
      ctx.fillStyle = 'rgba(2,8,8,.82)';
      ctx.strokeStyle = lineage.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(point.x - width / 2, point.y - 15, width, 23, 11);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = lineage.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, point.x, point.y - 3.5);
    }
    ctx.restore();
  }

  private drawBrush(): void {
    if (!this.brush.visible || this.brush.tool === 'observe') return;
    const point = this.screen(this.brush.x, this.brush.y);
    const radius = this.brush.radius * this.camera.zoom;
    const color = toolColors[this.brush.tool];
    const ctx = this.ctx;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = `${color}22`;
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = '650 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    const label = toolLabels[this.brush.tool];
    const width = ctx.measureText(label).width + 20;
    const labelY = point.y - radius - 20;
    ctx.fillStyle = 'rgba(2,9,9,.82)';
    ctx.strokeStyle = `${color}88`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(point.x - width / 2, labelY - 11, width, 22, 11);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillText(label, point.x, labelY + 0.5);
    ctx.restore();
  }


  private atmospherePhase(state: PlanetState): number {
    const moving = performance.now() / 90_000 * this.atmosphere.cycleSpeed;
    return ((state.day * 0.137 + moving) % 1 + 1) % 1;
  }

  private drawCloudShadows(state: PlanetState, phase: number): void {
    if (!this.atmosphere.cloudShadows || this.view !== 'natural') return;
    const ctx = this.ctx;
    const time = performance.now() * 0.000018;
    const density = Math.min(0.28, state.climateFronts.length * 0.028 + (state.climateEra.kind === 'wet' ? 0.08 : 0));
    if (density <= 0.015) return;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    for (let index = 0; index < 5; index += 1) {
      const x = ((index * 311 + time * innerWidth * (0.7 + index * 0.08)) % (innerWidth + 520)) - 260;
      const y = 70 + ((index * 173) % Math.max(160, innerHeight - 220));
      const width = 220 + index * 34;
      const height = 80 + (index % 3) * 22;
      const gradient = ctx.createRadialGradient(x, y, 10, x, y, width * 0.55);
      gradient.addColorStop(0, `rgba(7,18,22,${density * (0.7 + Math.sin(phase * Math.PI * 2 + index) * 0.12)})`);
      gradient.addColorStop(1, 'rgba(7,18,22,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(x, y, width, height, -0.12, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawAtmosphere(state: PlanetState): void {
    if (!this.atmosphere.enabled || this.view !== 'natural') return;
    const ctx = this.ctx;
    const phase = this.atmospherePhase(state);
    const sun = clamp(Math.sin((phase - 0.25) * Math.PI * 2), 0, 1);
    const night = 1 - sun;
    const dawn = Math.exp(-Math.pow((phase - 0.255) / 0.07, 2));
    const dusk = Math.exp(-Math.pow((phase - 0.745) / 0.07, 2));
    const intensity = this.atmosphere.intensity;

    if (night > 0.22) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.82, (night - 0.16) * intensity);
      for (let index = 0; index < 72; index += 1) {
        const x = (index * 97.31 + 43) % innerWidth;
        const y = (index * 53.77 + 17) % Math.max(120, innerHeight * 0.72);
        const radius = index % 9 === 0 ? 1.25 : 0.62;
        ctx.fillStyle = index % 7 === 0 ? '#d7e7ef' : '#eef5ee';
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      const moonX = innerWidth * (0.18 + phase * 0.64);
      const moonY = innerHeight * (0.18 + Math.abs(phase - 0.5) * 0.18);
      const glow = ctx.createRadialGradient(moonX, moonY, 2, moonX, moonY, 140);
      glow.addColorStop(0, `rgba(199,222,231,${0.22 * night * intensity})`);
      glow.addColorStop(1, 'rgba(199,222,231,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, innerWidth, innerHeight);
      ctx.restore();
    }

    const top = ctx.createLinearGradient(0, 0, 0, innerHeight);
    top.addColorStop(0, `rgba(7,18,35,${night * 0.66 * intensity})`);
    top.addColorStop(0.52, `rgba(7,17,27,${night * 0.42 * intensity})`);
    top.addColorStop(1, `rgba(3,9,12,${night * 0.56 * intensity})`);
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, innerWidth, innerHeight);

    const warm = Math.max(dawn, dusk);
    if (warm > 0.025) {
      const horizon = ctx.createLinearGradient(0, innerHeight * 0.22, 0, innerHeight);
      horizon.addColorStop(0, `rgba(231,124,62,${warm * 0.13 * intensity})`);
      horizon.addColorStop(0.45, `rgba(222,151,79,${warm * 0.085 * intensity})`);
      horizon.addColorStop(1, 'rgba(222,151,79,0)');
      ctx.fillStyle = horizon;
      ctx.fillRect(0, 0, innerWidth, innerHeight);
    }

    if (this.atmosphere.fog) {
      const moisture = state.tiles.reduce((sum, tile) => sum + tile.moisture + tile.water * 0.65, 0) / Math.max(1, state.tiles.length);
      const fogStrength = clamp((moisture - 0.36) * 0.28 + (state.seasonName === 'Winter' ? 0.045 : 0), 0, 0.16) * intensity;
      if (fogStrength > 0.006) {
        const drift = performance.now() * 0.000025;
        ctx.save();
        for (let band = 0; band < 3; band += 1) {
          const y = innerHeight * (0.58 + band * 0.12) + Math.sin(drift + band * 1.9) * 24;
          const gradient = ctx.createLinearGradient(0, y - 60, 0, y + 70);
          gradient.addColorStop(0, 'rgba(203,221,215,0)');
          gradient.addColorStop(0.5, `rgba(203,221,215,${fogStrength * (1 - band * 0.18)})`);
          gradient.addColorStop(1, 'rgba(203,221,215,0)');
          ctx.fillStyle = gradient;
          ctx.fillRect(0, y - 70, innerWidth, 150);
        }
        ctx.restore();
      }
    }
  }

  private drawCinematicCaption(): void {
    const caption = this.cinematicCaption;
    if (!caption) return;
    const ctx = this.ctx;
    const maxWidth = Math.min(680, innerWidth - 64);
    const x = innerWidth / 2;
    const y = innerHeight - 112;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const panel = ctx.createLinearGradient(x - maxWidth / 2, 0, x + maxWidth / 2, 0);
    panel.addColorStop(0, 'rgba(2,7,8,0)');
    panel.addColorStop(0.12, 'rgba(2,7,8,.80)');
    panel.addColorStop(0.88, 'rgba(2,7,8,.80)');
    panel.addColorStop(1, 'rgba(2,7,8,0)');
    ctx.fillStyle = panel;
    ctx.fillRect(x - maxWidth / 2, y - 66, maxWidth, 116);
    ctx.font = '700 10px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#98d5b4';
    ctx.fillText(caption.eyebrow.toUpperCase(), x, y - 42);
    ctx.font = '700 22px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#f0f5f1';
    ctx.fillText(caption.title, x, y - 16);
    ctx.font = '500 13px Inter, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(229,238,233,.88)';
    const words = caption.body.split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth - 80 && line) {
        lines.push(line);
        line = word;
      } else line = candidate;
      if (lines.length >= 1) break;
    }
    if (line && lines.length < 2) lines.push(line);
    lines.slice(0, 2).forEach((value, index) => ctx.fillText(value, x, y + 12 + index * 19));
    ctx.restore();
  }

  render(state: PlanetState): void {
    this.updateCamera();
    const ctx = this.ctx;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.fillStyle = '#07100f';
    ctx.fillRect(0, 0, innerWidth, innerHeight);

    const zoom = this.camera.zoom;
    const size = Math.max(1, zoom + 0.8);
    for (let y = 0; y < WORLD_HEIGHT; y += 1) {
      for (let x = 0; x < WORLD_WIDTH; x += 1) {
        const tile = state.tiles[x + y * WORLD_WIDTH];
        const point = this.screen(x, y);
        if (point.x < -size || point.y < -size || point.x > innerWidth + size || point.y > innerHeight + size) continue;

        let color = this.terrainColor(tile, state, x, y);
        if (this.view === 'moisture') color = `rgb(${20 + tile.moisture * 40},${45 + tile.moisture * 70},${65 + tile.moisture * 135})`;
        if (this.view === 'water') color = `rgb(${22 + tile.water * 34},${45 + tile.water * 112},${58 + tile.water * 168})`;
        if (this.view === 'habitat') color = `rgb(${40 + tile.succession * 65 + tile.sediment * 55},${46 + tile.succession * 125},${39 + tile.water * 85 - tile.erosion * 22})`;
        if (this.view === 'soil') color = `rgb(${45 + tile.fertility * 90},${38 + tile.fertility * 95},${25 + tile.fertility * 35})`;
        if (this.view === 'pressure') color = `rgb(${40 + tile.pressure * 160},${50 - tile.pressure * 20},${42 - tile.pressure * 10})`;
        if (this.view === 'memory') {
          const burn = tile.burn;
          const trail = tile.trail;
          color = `rgb(${32 + burn * 150 + trail * 55},${39 + trail * 85 - burn * 18},${34 + trail * 24 - burn * 14})`;
        }
        if (this.view === 'groups') {
          const base = tile.biome === 'ocean' ? [18, 48, 68] : [38, 58, 45];
          color = `rgb(${base[0]},${base[1]},${base[2]})`;
        }
        if (this.view === 'climate') {
          const wet = tile.moisture;
          const heat = tile.heat;
          color = `rgb(${38 + heat * 125},${52 + wet * 90},${64 + wet * 115 - heat * 34})`;
        }
        if (this.view === 'lineages') {
          color = tile.biome === 'ocean' ? 'rgb(16,38,51)' : 'rgb(35,45,39)';
        }
        ctx.fillStyle = color;
        ctx.fillRect(point.x, point.y, size, size);

        if (this.view === 'natural' && tile.biome !== 'ocean') {
          if (tile.water > 0.22) {
            const waterAlpha = Math.min(0.62, (tile.water - 0.18) * 0.72);
            ctx.fillStyle = `rgba(71,155,194,${waterAlpha})`;
            ctx.fillRect(point.x, point.y, size, size);
          }
          if (tile.burn > 0.08) {
            ctx.fillStyle = `rgba(92,39,24,${Math.min(0.48, tile.burn * 0.55)})`;
            ctx.fillRect(point.x, point.y, size, size);
          }
          if (tile.trail > 0.12) {
            ctx.fillStyle = `rgba(211,190,123,${Math.min(0.22, tile.trail * 0.25)})`;
            ctx.fillRect(point.x, point.y, size, size);
          }
          if (tile.fire > 0.02) {
            const flicker = 0.72 + Math.sin(performance.now() * 0.014 + x * 0.7 + y) * 0.18;
            ctx.fillStyle = `rgba(255,103,42,${Math.min(0.82, tile.fire * flicker)})`;
            ctx.fillRect(point.x, point.y, size, size);
          }
        }
      }
    }

    this.drawCloudShadows(state, this.atmospherePhase(state));
    this.drawClimate(state);

    if (this.view === 'memory') {
      for (const landmark of state.landmarks) this.drawLandmark(landmark, state);
    }

    this.drawGroupOverlays(state);
    this.drawLineageOverlays(state);

    const groupColors = new Map(state.groups.map((group) => [group.id, group.color]));
    const lineageColors = new Map(state.lineages.map((lineage) => [lineage.id, lineage.color]));
    ctx.globalAlpha = this.view === 'groups' ? 0.16 : this.view === 'lineages' ? 0.72 : 0.25;
    for (const current of state.entities) {
      if (current.species !== 'plant' && current.species !== 'fungi') continue;
      const point = this.screen(current.x, current.y);
      if (point.x < 0 || point.y < 0 || point.x > innerWidth || point.y > innerHeight) continue;
      const plantColor = state.seasonName === 'Spring' ? '#83c878' : state.seasonName === 'Summer' ? '#a6ad65' : state.seasonName === 'Autumn' ? '#a17d4f' : '#748a70';
      ctx.fillStyle = this.view === 'lineages'
        ? lineageColors.get(current.lineageId ?? '') ?? (current.species === 'plant' ? plantColor : '#9d69ce')
        : current.species === 'plant' ? plantColor : '#9d69ce';
      ctx.beginPath();
      ctx.arc(point.x, point.y, Math.max(1.6, zoom * 0.45), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const current of state.entities) {
      if (current.species === 'plant' || current.species === 'fungi') continue;
      const point = this.screen(current.x, current.y);
      if (point.x < -20 || point.y < -20 || point.x > innerWidth + 20 || point.y > innerHeight + 20) continue;
      const color = this.view === 'lineages'
        ? lineageColors.get(current.lineageId ?? '') ?? speciesColors[current.species][current.breed % 6]
        : current.groupId ? groupColors.get(current.groupId) ?? speciesColors[current.species][current.breed % 6] : speciesColors[current.species][current.breed % 6];
      ctx.fillStyle = color;
      ctx.strokeStyle = 'rgba(0,0,0,.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const radius = current.species === 'predator' ? Math.max(3, zoom * 0.55) : current.species === 'grazer' ? Math.max(2.5, zoom * 0.45) : Math.max(2, zoom * 0.36);
      if (current.species === 'predator') {
        ctx.moveTo(point.x, point.y - radius);
        ctx.lineTo(point.x + radius * 0.9, point.y + radius * 0.8);
        ctx.lineTo(point.x - radius * 0.9, point.y + radius * 0.8);
        ctx.closePath();
      } else if (current.species === 'scavenger') {
        ctx.rect(point.x - radius, point.y - radius, radius * 2, radius * 2);
      } else {
        ctx.ellipse(point.x, point.y, radius * 1.35, radius, 0, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.stroke();

      if (current.id === this.hoverEntityId) {
        ctx.save();
        ctx.strokeStyle = 'rgba(238,248,242,.92)';
        ctx.lineWidth = 1.7;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius * 2.45, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      if (current.notable && this.camera.zoom >= 6.5) {
        const selected = current.id === this.highlightEntityId;
        ctx.save();
        ctx.strokeStyle = selected ? '#f4f1c5' : 'rgba(231,244,235,.72)';
        ctx.lineWidth = selected ? 2.4 : 1.2;
        ctx.setLineDash(selected ? [] : [3, 3]);
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius * (selected ? 2.7 : 2.15), 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        if (selected && current.name) {
          ctx.font = '700 10px Inter, system-ui, sans-serif';
          const label = `${current.name} · ${current.role ?? 'followed'}`;
          const width = ctx.measureText(label).width + 18;
          ctx.fillStyle = 'rgba(2,8,8,.88)';
          ctx.beginPath();
          ctx.roundRect(point.x - width / 2, point.y - radius * 3.8 - 20, width, 21, 10);
          ctx.fill();
          ctx.fillStyle = '#eef4cf';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, point.x, point.y - radius * 3.8 - 9.5);
        }
        ctx.restore();
      }
    }

    this.drawEventMarkers(state);
    this.drawRegionLabels(state);
    this.drawBrush();

    const seasonTint = state.seasonName === 'Summer'
      ? 'rgba(238,183,94,.025)'
      : state.seasonName === 'Autumn'
        ? 'rgba(201,111,61,.028)'
        : state.seasonName === 'Winter'
          ? 'rgba(137,177,194,.032)'
          : 'rgba(119,207,140,.018)';
    ctx.fillStyle = seasonTint;
    ctx.fillRect(0, 0, innerWidth, innerHeight);
    ctx.fillStyle = 'rgba(255,255,255,.035)';
    ctx.fillRect(0, 0, innerWidth, innerHeight);
    this.drawAtmosphere(state);
    this.drawCinematicCaption();
  }
}
