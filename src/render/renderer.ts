import type { PlacementTool, PlanetState, ViewMode } from '../world/types';

const WORLD_WIDTH = 180;
const WORLD_HEIGHT = 110;

const biomeColors: Record<string, string> = {
  ocean: '#163d58',
  shore: '#887656',
  grass: '#395d35',
  forest: '#244b30',
  rock: '#555a5a',
  snow: '#c7d3d2',
};

const speciesColors: Record<string, string[]> = {
  plant: ['#66a95e'],
  fungi: ['#a06bd6'],
  carrion: ['#7b5a3d'],
  grazer: ['#e0d37b', '#d4c46c', '#c9b65b', '#b9d080', '#e8d998', '#cddc88'],
  predator: ['#df6b55', '#c65346', '#e38659', '#b9483d', '#f08b6c', '#d0574a'],
  scavenger: ['#d7d0c0', '#c9bda8', '#b9c8d5', '#eee4c6', '#bcb3a1', '#d4cbb8'],
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

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  camera = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2, zoom: 7 };
  view: ViewMode = 'natural';
  showLabels = true;
  brush = { tool: 'observe' as PlacementTool, x: 0, y: 0, radius: 8, visible: false };

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
    this.camera.x = Math.max(0, Math.min(WORLD_WIDTH, x));
    this.camera.y = Math.max(0, Math.min(WORLD_HEIGHT, y));
    this.camera.zoom = Math.max(3, Math.min(18, zoom));
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
      if (!region) continue;
      const point = this.screen(region.x, region.y);
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

  render(state: PlanetState): void {
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

        let color = biomeColors[tile.biome];
        if (this.view === 'moisture') color = `rgb(${20 + tile.moisture * 40},${45 + tile.moisture * 70},${65 + tile.moisture * 135})`;
        if (this.view === 'soil') color = `rgb(${45 + tile.fertility * 90},${38 + tile.fertility * 95},${25 + tile.fertility * 35})`;
        if (this.view === 'pressure') color = `rgb(${40 + tile.pressure * 160},${50 - tile.pressure * 20},${42 - tile.pressure * 10})`;
        ctx.fillStyle = color;
        ctx.fillRect(point.x, point.y, size, size);
      }
    }

    ctx.globalAlpha = 0.25;
    for (const current of state.entities) {
      if (current.species !== 'plant' && current.species !== 'fungi') continue;
      const point = this.screen(current.x, current.y);
      if (point.x < 0 || point.y < 0 || point.x > innerWidth || point.y > innerHeight) continue;
      ctx.fillStyle = current.species === 'plant' ? '#75b76c' : '#9d69ce';
      ctx.beginPath();
      ctx.arc(point.x, point.y, Math.max(1.6, zoom * 0.45), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const current of state.entities) {
      if (current.species === 'plant' || current.species === 'fungi') continue;
      const point = this.screen(current.x, current.y);
      if (point.x < -20 || point.y < -20 || point.x > innerWidth + 20 || point.y > innerHeight + 20) continue;
      const color = (speciesColors[current.species] || ['white'])[current.breed % 6];
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
    }

    this.drawEventMarkers(state);
    this.drawRegionLabels(state);
    this.drawBrush();

    ctx.fillStyle = 'rgba(255,255,255,.045)';
    ctx.fillRect(0, 0, innerWidth, innerHeight);
  }
}
