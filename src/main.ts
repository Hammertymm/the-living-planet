import './styles.css';
import { Simulation } from './engine/simulation';
import { Renderer } from './render/renderer';
import type { PlacementTool, SocialGroup, ViewMode } from './world/types';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
<div class="shell">
  <canvas id="world" aria-label="The Living Planet simulation canvas"></canvas>

  <div class="topbar">
    <section class="brand">
      <h1>The Living Planet</h1>
      <p>v0.7 · Herds, Packs & Memory</p>
    </section>
    <section class="metrics" id="metrics"></section>
  </div>

  <div class="viewbar" id="viewbar">
    <button data-view="natural" class="active">Natural</button>
    <button data-view="moisture">Moisture</button>
    <button data-view="soil">Soil</button>
    <button data-view="pressure">Pressure</button>
    <button data-view="memory">Memory</button>
    <button data-view="groups">Groups</button>
    <span class="divider"></span>
    <button id="pause">Pause</button>
    <button id="labels" class="active">Labels</button>
    <button id="recenter">Recenter</button>
    <button id="chronicle-toggle">Chronicle</button>
    <button id="wildlife-toggle">Wildlife</button>
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

    <label class="time-control" for="time-rate">
      <span>Time flow <strong id="time-rate-value">1×</strong></span>
      <input id="time-rate" type="range" min="0" max="6" step="1" value="2" aria-label="Simulation time flow" />
      <small id="time-rate-caption">Normal observation</small>
    </label>

    <div class="pan-hint">Observe mode: drag to pan. With a tool selected: <strong>Shift-drag</strong> or right-drag to pan. Use <strong>[</strong> and <strong>]</strong> to change time flow.</div>
  </section>

  <button id="open-tools" class="open-tools hidden">Stewardship tools</button>

  <section class="chronicle hidden" id="chronicle">
    <div class="panel-heading">
      <div>
        <h2>World Chronicle</h2>
        <p>Recent moments recorded by the Naturalist. Select one to travel there.</p>
      </div>
      <button id="close-chronicle" class="icon-button" title="Close chronicle">×</button>
    </div>
    <div class="chronicle-list" id="chronicle-list"></div>
  </section>

  <section class="wildlife hidden" id="wildlife">
    <div class="panel-heading">
      <div>
        <h2>Living Registry</h2>
        <p>Named herds, packs and scavenger colonies currently shaping the planet.</p>
      </div>
      <button id="close-wildlife" class="icon-button" title="Close wildlife registry">×</button>
    </div>
    <div class="registry-summary" id="registry-summary"></div>
    <div class="wildlife-list" id="wildlife-list"></div>
  </section>

  <div class="help">Wheel zoom · R recenter · L labels · C chronicle · W wildlife · [ ] time flow · Space pause · Esc observe</div>
</div>`;

const canvas = document.querySelector<HTMLCanvasElement>('#world')!;
const sim = new Simulation(4319);
const renderer = new Renderer(canvas);
let paused = false;
let last = performance.now();
let accumulator = 0;
const BASE_STEP_MS = 55;
const TIME_RATES = [0.25, 0.5, 1, 1.5, 2, 3, 4] as const;
const TIME_RATE_LABELS = ['Very slow', 'Slow observation', 'Normal observation', 'Lively', 'Fast', 'Very fast', 'Time-lapse'] as const;
let timeRateIndex = 2;
let timeRate = TIME_RATES[timeRateIndex];
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
const labelsButton = document.querySelector<HTMLButtonElement>('#labels')!;
const pauseButton = document.querySelector<HTMLButtonElement>('#pause')!;
const stewardship = document.querySelector<HTMLElement>('#stewardship')!;
const openTools = document.querySelector<HTMLButtonElement>('#open-tools')!;
const brushInput = document.querySelector<HTMLInputElement>('#brush-size')!;
const brushValue = document.querySelector<HTMLElement>('#brush-value')!;
const timeRateInput = document.querySelector<HTMLInputElement>('#time-rate')!;
const timeRateValue = document.querySelector<HTMLElement>('#time-rate-value')!;
const timeRateCaption = document.querySelector<HTMLElement>('#time-rate-caption')!;
const chronicle = document.querySelector<HTMLElement>('#chronicle')!;
const chronicleList = document.querySelector<HTMLElement>('#chronicle-list')!;
const chronicleToggle = document.querySelector<HTMLButtonElement>('#chronicle-toggle')!;
const wildlife = document.querySelector<HTMLElement>('#wildlife')!;
const wildlifeList = document.querySelector<HTMLElement>('#wildlife-list')!;
const wildlifeToggle = document.querySelector<HTMLButtonElement>('#wildlife-toggle')!;
const registrySummary = document.querySelector<HTMLElement>('#registry-summary')!;
let chronicleSignature = '';
let wildlifeSignature = '';

function groupLocation(group: SocialGroup): { x: number; y: number } {
  return sim.groupLocation(group);
}

function drawMetrics(force = false): void {
  if (!force && lastUiDay === sim.state.day) return;
  lastUiDay = sim.state.day;
  const counts = sim.counts();
  metrics.innerHTML = `
    <div class="metric"><span>Day</span><strong>${sim.state.day}</strong></div>
    <div class="metric"><span>Plants</span><strong>${counts.plant}</strong></div>
    <div class="metric"><span>Grazers</span><strong>${counts.grazer}</strong></div>
    <div class="metric"><span>Predators</span><strong>${counts.predator}</strong></div>
    <div class="metric"><span>Groups</span><strong>${sim.state.groups.length}</strong></div>
    <div class="metric"><span>Memory</span><strong>${sim.state.landmarks.length}</strong></div>`;

  const note = sim.state.notes[0];
  const region = note?.regionId ? sim.state.regions.find((candidate) => candidate.id === note.regionId) : undefined;
  const group = note?.groupId ? sim.state.groups.find((candidate) => candidate.id === note.groupId) : undefined;
  noteElement.innerHTML = note
    ? `${note.text}<small>Day ${note.day}${region ? ` · ${region.name}` : ''}${group ? ` · ${group.name}` : ''}</small>`
    : 'The planet is quiet.';
}

function focusNote(index: number): void {
  const entry = sim.state.notes[index];
  if (!entry) return;
  if (entry.focusX !== undefined && entry.focusY !== undefined) {
    renderer.focus(entry.focusX, entry.focusY, 9);
    return;
  }
  const group = entry.groupId ? sim.state.groups.find((candidate) => candidate.id === entry.groupId) : undefined;
  if (group) {
    const point = groupLocation(group);
    renderer.focus(point.x, point.y, 9);
    return;
  }
  const region = entry.regionId ? sim.state.regions.find((candidate) => candidate.id === entry.regionId) : undefined;
  if (region) renderer.focus(region.x, region.y, 9);
}

function drawChronicle(force = false): void {
  const signature = sim.state.notes.map((entry) => `${entry.day}:${entry.regionId ?? ''}:${entry.groupId ?? ''}:${entry.text}`).join('|');
  if (!force && signature === chronicleSignature) return;
  chronicleSignature = signature;

  chronicleList.innerHTML = sim.state.notes.map((entry, index) => {
    const region = entry.regionId ? sim.state.regions.find((candidate) => candidate.id === entry.regionId) : undefined;
    const group = entry.groupId ? sim.state.groups.find((candidate) => candidate.id === entry.groupId) : undefined;
    return `<button class="chronicle-entry${index === 0 ? ' latest' : ''}" data-index="${index}">
      <span class="chronicle-meta"><strong>Day ${entry.day}</strong><em>${group?.name ?? region?.name ?? 'Planetwide'}</em></span>
      <span>${entry.text}</span>
    </button>`;
  }).join('');

  chronicleList.querySelectorAll<HTMLButtonElement>('[data-index]').forEach((button) => {
    button.onclick = () => focusNote(Number(button.dataset.index));
  });
}

function setChronicle(open: boolean): void {
  chronicle.classList.toggle('hidden', !open);
  chronicleToggle.classList.toggle('active', open);
  if (open) {
    setWildlife(false);
    drawChronicle(true);
  }
}

function groupStatus(group: SocialGroup): string {
  const region = sim.state.regions.find((candidate) => candidate.id === group.targetRegionId);
  const age = sim.state.day - group.foundedDay;
  if (group.memberIds.length <= 4) return 'fragile';
  if (group.memberIds.length >= (group.species === 'grazer' ? 24 : 10)) return 'flourishing';
  if (age < 120) return 'newly formed';
  return region ? `moving toward ${region.name}` : 'established';
}

function drawWildlife(force = false): void {
  const signature = sim.state.groups.map((group) => `${group.id}:${group.memberIds.length}:${group.targetRegionId}:${group.generation}`).join('|');
  if (!force && signature === wildlifeSignature) return;
  wildlifeSignature = signature;

  const grazers = sim.state.groups.filter((group) => group.species === 'grazer').length;
  const predators = sim.state.groups.filter((group) => group.species === 'predator').length;
  const scavengers = sim.state.groups.filter((group) => group.species === 'scavenger').length;
  registrySummary.innerHTML = `<span><strong>${grazers}</strong> herds</span><span><strong>${predators}</strong> packs</span><span><strong>${scavengers}</strong> colonies</span>`;

  wildlifeList.innerHTML = [...sim.state.groups]
    .sort((a, b) => a.species.localeCompare(b.species) || b.memberIds.length - a.memberIds.length)
    .map((group) => {
      const region = sim.state.regions.find((candidate) => candidate.id === group.targetRegionId);
      const symbol = group.species === 'grazer' ? '●' : group.species === 'predator' ? '▲' : '◆';
      return `<button class="wildlife-entry" data-group="${group.id}">
        <span class="wildlife-symbol" style="--group-color:${group.color}">${symbol}</span>
        <span class="wildlife-copy"><strong>${group.name}</strong><small>${group.memberIds.length} members · ${groupStatus(group)}${region ? ` · ${region.name}` : ''}</small></span>
        <span class="wildlife-generation">G${group.generation}</span>
      </button>`;
    }).join('');

  wildlifeList.querySelectorAll<HTMLButtonElement>('[data-group]').forEach((button) => {
    button.onclick = () => {
      const group = sim.state.groups.find((candidate) => candidate.id === button.dataset.group);
      if (!group) return;
      const point = groupLocation(group);
      renderer.focus(point.x, point.y, 10);
      document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((candidate) => candidate.classList.toggle('active', candidate.dataset.view === 'groups'));
      renderer.view = 'groups';
    };
  });
}

function setWildlife(open: boolean): void {
  wildlife.classList.toggle('hidden', !open);
  wildlifeToggle.classList.toggle('active', open);
  if (open) {
    chronicle.classList.add('hidden');
    chronicleToggle.classList.remove('active');
    drawWildlife(true);
  }
}

function frame(time: number): void {
  const delta = Math.min(200, time - last);
  last = time;
  accumulator += delta;
  if (!paused) {
    const stepInterval = BASE_STEP_MS / timeRate;
    let stepsThisFrame = 0;
    while (accumulator >= stepInterval && stepsThisFrame < 12) {
      sim.step();
      accumulator -= stepInterval;
      stepsThisFrame += 1;
    }
    if (stepsThisFrame === 12) accumulator = Math.min(accumulator, stepInterval);
  } else {
    accumulator = 0;
  }
  renderer.render(sim.state);
  drawMetrics();
  drawChronicle();
  drawWildlife();
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

function setTimeRate(index: number): void {
  timeRateIndex = Math.max(0, Math.min(TIME_RATES.length - 1, Math.round(index)));
  timeRate = TIME_RATES[timeRateIndex];
  timeRateInput.value = String(timeRateIndex);
  timeRateValue.textContent = `${timeRate}×`;
  timeRateCaption.textContent = TIME_RATE_LABELS[timeRateIndex];
  accumulator = 0;
}

timeRateInput.oninput = () => setTimeRate(Number(timeRateInput.value));
setTimeRate(timeRateIndex);

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

chronicleToggle.onclick = () => setChronicle(chronicle.classList.contains('hidden'));
document.querySelector<HTMLButtonElement>('#close-chronicle')!.onclick = () => setChronicle(false);
wildlifeToggle.onclick = () => setWildlife(wildlife.classList.contains('hidden'));
document.querySelector<HTMLButtonElement>('#close-wildlife')!.onclick = () => setWildlife(false);

function updatePointer(clientX: number, clientY: number): void {
  const world = renderer.worldFromScreen(clientX, clientY);
  renderer.brush.x = world.x;
  renderer.brush.y = world.y;
  renderer.brush.radius = brushRadius;
  renderer.brush.visible = world.x >= 0 && world.y >= 0 && world.x < sim.width && world.y < sim.height;
}

function applyTool(clientX: number, clientY: number, announce: boolean): void {
  if (activeTool === 'observe') return;
  const world = renderer.worldFromScreen(clientX, clientY);
  if (world.x < 0 || world.y < 0 || world.x >= sim.width || world.y >= sim.height) return;
  sim.interveneAt(activeTool, world.x, world.y, brushRadius, announce);
  drawMetrics(true);
  drawChronicle(true);
  drawWildlife(true);
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
});

canvas.addEventListener('pointermove', (event) => {
  updatePointer(event.clientX, event.clientY);

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
  if (event.key === '[') { event.preventDefault(); setTimeRate(timeRateIndex - 1); return; }
  if (event.key === ']') { event.preventDefault(); setTimeRate(timeRateIndex + 1); return; }
  if (event.code === 'Space') {
    event.preventDefault();
    pauseButton.click();
    return;
  }
  if (event.key === 'Escape') selectTool('observe');
  if (event.key.toLowerCase() === 'r') renderer.recenter();
  if (event.key.toLowerCase() === 'l') labelsButton.click();
  if (event.key.toLowerCase() === 'c') chronicleToggle.click();
  if (event.key.toLowerCase() === 'w') wildlifeToggle.click();
  if (shortcutTools[event.key]) selectTool(shortcutTools[event.key]);
});

selectTool('observe');
drawMetrics(true);
drawChronicle(true);
drawWildlife(true);
