import './styles.css';
import { Simulation } from './engine/simulation';
import { Renderer } from './render/renderer';
import type { PlacementTool, ViewMode } from './world/types';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
<div class="shell">
  <canvas id="world" aria-label="The Living Planet simulation canvas"></canvas>

  <div class="topbar">
    <section class="brand">
      <h1>The Living Planet</h1>
      <p>v0.3 · Stewardship Tools</p>
    </section>
    <section class="metrics" id="metrics"></section>
  </div>

  <div class="viewbar" id="viewbar">
    <button data-view="natural" class="active">Natural</button>
    <button data-view="moisture">Moisture</button>
    <button data-view="soil">Soil</button>
    <button data-view="pressure">Pressure</button>
    <span class="divider"></span>
    <button id="pause">Pause</button>
    <button id="labels" class="active">Labels</button>
    <button id="recenter">Recenter</button>
  </div>

  <section class="naturalist">
    <h2>Naturalist</h2>
    <div class="note" id="note"></div>
  </section>

  <section class="stewardship" id="stewardship">
    <div class="panel-heading">
      <div>
        <h2>Stewardship</h2>
        <p>Choose a tool, then click or paint directly onto the world.</p>
      </div>
      <button id="collapse-tools" class="icon-button" title="Collapse tools">×</button>
    </div>

    <div class="tool-grid" id="tool-grid">
      <button data-tool="observe" class="tool active"><span>◉</span>Observe <kbd>0</kbd></button>
      <button data-tool="plants" class="tool plants"><span>✦</span>Plant growth <kbd>1</kbd></button>
      <button data-tool="grazers" class="tool grazers"><span>●</span>Grazer herd <kbd>2</kbd></button>
      <button data-tool="predators" class="tool predators"><span>▲</span>Predator pack <kbd>3</kbd></button>
      <button data-tool="scavengers" class="tool scavengers"><span>◆</span>Scavengers <kbd>4</kbd></button>
      <button data-tool="fungi" class="tool fungi"><span>✺</span>Fungal colony <kbd>5</kbd></button>
      <button data-tool="rain" class="tool rain"><span>≋</span>Rain front <kbd>6</kbd></button>
      <button data-tool="drought" class="tool drought"><span>☼</span>Drought <kbd>7</kbd></button>
      <button data-tool="fertility" class="tool fertility"><span>⬢</span>Fertile soil <kbd>8</kbd></button>
      <button data-tool="wildfire" class="tool wildfire"><span>△</span>Wildfire <kbd>9</kbd></button>
    </div>

    <label class="brush-control" for="brush-size">
      <span>Influence radius <strong id="brush-value">8</strong></span>
      <input id="brush-size" type="range" min="2" max="22" value="8" />
    </label>
    <div class="pan-hint">Observe mode: drag to pan. With a tool selected: <strong>Shift-drag</strong> or right-drag to pan.</div>
  </section>

  <button id="open-tools" class="open-tools hidden">Stewardship tools</button>

  <aside class="hovercard hidden" id="hovercard"></aside>
  <div class="help">Wheel zoom · R recenter · L labels · Space pause · Esc observe</div>
</div>`;

const canvas = document.querySelector<HTMLCanvasElement>('#world')!;
let sim = new Simulation(4319);
const renderer = new Renderer(canvas);
let paused = false;
let last = performance.now();
let accumulator = 0;
let lastUiDay = -1;
let activeTool: PlacementTool = 'observe';
let brushRadius = 8;
let painting = false;
let panning = false;
let pointerId: number | null = null;
let lastX = 0;
let lastY = 0;
let lastPaintTime = 0;
let lastPaintX = Number.NaN;
let lastPaintY = Number.NaN;

const metrics = document.querySelector<HTMLElement>('#metrics')!;
const noteElement = document.querySelector<HTMLElement>('#note')!;
const hovercard = document.querySelector<HTMLElement>('#hovercard')!;
const labelsButton = document.querySelector<HTMLButtonElement>('#labels')!;
const pauseButton = document.querySelector<HTMLButtonElement>('#pause')!;
const stewardship = document.querySelector<HTMLElement>('#stewardship')!;
const openTools = document.querySelector<HTMLButtonElement>('#open-tools')!;
const brushInput = document.querySelector<HTMLInputElement>('#brush-size')!;
const brushValue = document.querySelector<HTMLElement>('#brush-value')!;

function drawMetrics(force = false): void {
  if (!force && lastUiDay === sim.state.day) return;
  lastUiDay = sim.state.day;
  const counts = sim.counts();
  metrics.innerHTML = `
    <div class="metric"><span>Day</span><strong>${sim.state.day}</strong></div>
    <div class="metric"><span>Plants</span><strong>${counts.plant}</strong></div>
    <div class="metric"><span>Grazers</span><strong>${counts.grazer}</strong></div>
    <div class="metric"><span>Predators</span><strong>${counts.predator}</strong></div>
    <div class="metric"><span>Scavengers</span><strong>${counts.scavenger}</strong></div>
    <div class="metric"><span>Fungi</span><strong>${counts.fungi}</strong></div>`;

  const note = sim.state.notes[0];
  const region = note?.regionId ? sim.state.regions.find((candidate) => candidate.id === note.regionId) : undefined;
  noteElement.innerHTML = note
    ? `${note.text}<small>Day ${note.day}${region ? ` · ${region.name}` : ''}</small>`
    : 'The planet is quiet.';
}

function frame(time: number): void {
  const delta = Math.min(200, time - last);
  last = time;
  accumulator += delta;
  if (!paused) {
    while (accumulator > 55) {
      sim.step();
      accumulator -= 55;
    }
  } else {
    accumulator = 0;
  }
  renderer.render(sim.state);
  drawMetrics();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) => {
  button.onclick = () => {
    document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((candidate) => candidate.classList.remove('active'));
    button.classList.add('active');
    renderer.view = button.dataset.view as ViewMode;
  };
});

function selectTool(tool: PlacementTool): void {
  activeTool = tool;
  renderer.brush.tool = tool;
  document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((button) => {
    button.classList.toggle('active', button.dataset.tool === tool);
  });
  canvas.classList.toggle('painting', tool !== 'observe');
}

document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((button) => {
  button.onclick = () => selectTool(button.dataset.tool as PlacementTool);
});

brushInput.oninput = () => {
  brushRadius = Number(brushInput.value);
  brushValue.textContent = String(brushRadius);
  renderer.brush.radius = brushRadius;
};

pauseButton.onclick = () => {
  paused = !paused;
  pauseButton.textContent = paused ? 'Resume' : 'Pause';
  pauseButton.classList.toggle('active', paused);
};

labelsButton.onclick = () => {
  renderer.showLabels = !renderer.showLabels;
  labelsButton.classList.toggle('active', renderer.showLabels);
};

document.querySelector<HTMLButtonElement>('#recenter')!.onclick = () => renderer.recenter();

document.querySelector<HTMLButtonElement>('#collapse-tools')!.onclick = () => {
  stewardship.classList.add('hidden');
  openTools.classList.remove('hidden');
};
openTools.onclick = () => {
  stewardship.classList.remove('hidden');
  openTools.classList.add('hidden');
};

function updateHover(clientX: number, clientY: number): void {
  const world = renderer.worldFromScreen(clientX, clientY);
  renderer.brush.x = world.x;
  renderer.brush.y = world.y;
  renderer.brush.radius = brushRadius;
  renderer.brush.visible = world.x >= 0 && world.y >= 0 && world.x < sim.width && world.y < sim.height;

  if (!renderer.brush.visible) {
    hovercard.classList.add('hidden');
    return;
  }

  const tile = sim.tileAt(world.x, world.y);
  const region = sim.regionAt(world.x, world.y);
  const local = sim.localCounts(world.x, world.y, 7);
  hovercard.innerHTML = `
    <strong>${region.name}</strong>
    <span>${tile.biome} · moisture ${Math.round(tile.moisture * 100)}% · soil ${Math.round(tile.fertility * 100)}%</span>
    <small>${local.plant} plants · ${local.grazer} grazers · ${local.predator} predators · ${local.fungi} fungi</small>`;
  const left = Math.min(innerWidth - 300, Math.max(12, clientX + 18));
  const top = Math.min(innerHeight - 92, Math.max(12, clientY + 18));
  hovercard.style.left = `${left}px`;
  hovercard.style.top = `${top}px`;
  hovercard.classList.remove('hidden');
}

function applyTool(clientX: number, clientY: number, announce: boolean): void {
  if (activeTool === 'observe') return;
  const world = renderer.worldFromScreen(clientX, clientY);
  if (world.x < 0 || world.y < 0 || world.x >= sim.width || world.y >= sim.height) return;
  sim.interveneAt(activeTool, world.x, world.y, brushRadius, announce);
  drawMetrics(true);
}

canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  const before = renderer.worldFromScreen(event.clientX, event.clientY);
  renderer.camera.zoom = Math.max(3, Math.min(18, renderer.camera.zoom + (event.deltaY < 0 ? 1 : -1)));
  const after = renderer.worldFromScreen(event.clientX, event.clientY);
  renderer.camera.x += before.x - after.x;
  renderer.camera.y += before.y - after.y;
}, { passive: false });

canvas.addEventListener('contextmenu', (event) => event.preventDefault());

canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  pointerId = event.pointerId;
  canvas.setPointerCapture(event.pointerId);
  lastX = event.clientX;
  lastY = event.clientY;
  const wantsPan = activeTool === 'observe' || event.shiftKey || event.button === 1 || event.button === 2;
  panning = wantsPan;
  painting = !wantsPan && event.button === 0;
  if (painting) {
    applyTool(event.clientX, event.clientY, true);
    lastPaintTime = performance.now();
    const world = renderer.worldFromScreen(event.clientX, event.clientY);
    lastPaintX = world.x;
    lastPaintY = world.y;
  }
});

canvas.addEventListener('pointerup', (event) => {
  painting = false;
  panning = false;
  if (pointerId === event.pointerId) pointerId = null;
  if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
});

canvas.addEventListener('pointercancel', () => {
  painting = false;
  panning = false;
  pointerId = null;
});

canvas.addEventListener('pointerleave', () => {
  renderer.brush.visible = false;
  hovercard.classList.add('hidden');
});

canvas.addEventListener('pointermove', (event) => {
  updateHover(event.clientX, event.clientY);

  if (panning) {
    renderer.camera.x -= (event.clientX - lastX) / renderer.camera.zoom;
    renderer.camera.y -= (event.clientY - lastY) / renderer.camera.zoom;
    lastX = event.clientX;
    lastY = event.clientY;
    return;
  }

  if (painting) {
    const now = performance.now();
    const world = renderer.worldFromScreen(event.clientX, event.clientY);
    const moved = Math.hypot(world.x - lastPaintX, world.y - lastPaintY);
    if (now - lastPaintTime > 120 && moved > Math.max(1.5, brushRadius * 0.28)) {
      applyTool(event.clientX, event.clientY, false);
      lastPaintTime = now;
      lastPaintX = world.x;
      lastPaintY = world.y;
    }
  }
});

canvas.addEventListener('dblclick', () => renderer.recenter());

const shortcutTools: Record<string, PlacementTool> = {
  '0': 'observe',
  '1': 'plants',
  '2': 'grazers',
  '3': 'predators',
  '4': 'scavengers',
  '5': 'fungi',
  '6': 'rain',
  '7': 'drought',
  '8': 'fertility',
  '9': 'wildfire',
};

addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    pauseButton.click();
    return;
  }
  if (event.key === 'Escape') selectTool('observe');
  if (event.key.toLowerCase() === 'r') renderer.recenter();
  if (event.key.toLowerCase() === 'l') labelsButton.click();
  if (shortcutTools[event.key]) selectTool(shortcutTools[event.key]);
});

// Ensure a clean first frame and selected state.
selectTool('observe');
drawMetrics(true);
