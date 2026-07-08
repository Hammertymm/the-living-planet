import type { PlanetState, ViewMode } from '../world/types';

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

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  camera = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2, zoom: 7 };
  view: ViewMode = 'natural';
  showLabels = true;

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
    this.camera.x = WORLD_WIDTH / 2;
    this.camera.y = WORLD_HEIGHT / 2;
    this.camera.zoom = 7;
  }

  screen(x: number, y: number): { x: number; y: number } {
    return {
      x: (x - this.camera.x) * this.camera.zoom + innerWidth / 2,
      y: (y - this.camera.y) * this.camera.zoom + innerHeight / 2,
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

    this.drawRegionLabels(state);

    ctx.fillStyle = 'rgba(255,255,255,.06)';
    ctx.fillRect(0, 0, innerWidth, innerHeight);
  }
}
