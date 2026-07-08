import './styles.css';
import { Simulation } from './engine/simulation';
import { Renderer } from './render/renderer';
import type { ViewMode } from './world/types';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
<div class="shell">
  <canvas id="world"></canvas>
  <div class="topbar">
    <section class="brand"><h1>The Living Planet</h1><p>A digital nature documentary in progress.</p></section>
    <section class="metrics" id="metrics"></section>
  </div>
  <div class="viewbar" id="viewbar">
    <button data-view="natural" class="active">Natural</button>
    <button data-view="moisture">Moisture</button>
    <button data-view="soil">Soil</button>
    <button data-view="pressure">Pressure</button>
    <span class="divider"></span>
    <button id="labels" class="active">Labels</button>
    <button id="recenter">Recenter</button>
  </div>
  <section class="naturalist"><h2>Naturalist</h2><div class="note" id="note"></div></section>
  <section class="interventions"><h2>Interventions</h2><div class="buttons">
    <button data-act="rain">Rainstorm</button><button data-act="drought">Drought</button><button data-act="forest">Plant forest</button><button data-act="herd">Release herd</button><button data-act="wolves">Introduce predators</button><button data-act="fungi">Fungal bloom</button>
  </div></section>
  <div class="help">Camera fixed · drag to pan · wheel to zoom · R recenter · L labels · Space pause</div>
</div>`;

const canvas = document.querySelector<HTMLCanvasElement>('#world')!;
const sim = new Simulation(4319);
const renderer = new Renderer(canvas);
let paused = false;
let last = performance.now();
let accumulator = 0;

function drawMetrics(): void {
  const counts = sim.counts();
  document.querySelector('#metrics')!.innerHTML = `
    <div class="metric"><span>Day</span><strong>${sim.state.day}</strong></div>
    <div class="metric"><span>Plants</span><strong>${counts.plant}</strong></div>
    <div class="metric"><span>Grazers</span><strong>${counts.grazer}</strong></div>
    <div class="metric"><span>Predators</span><strong>${counts.predator}</strong></div>
    <div class="metric"><span>Scavengers</span><strong>${counts.scavenger}</strong></div>
    <div class="metric"><span>Fungi</span><strong>${counts.fungi}</strong></div>`;

  const note = sim.state.notes[0];
  const region = note?.regionId ? sim.state.regions.find((candidate) => candidate.id === note.regionId) : undefined;
  document.querySelector('#note')!.innerHTML = note
    ? `${note.text}<small>Day ${note.day}${region ? ` · ${region.name}` : ''}</small>`
    : 'The planet is quiet.';
}

function frame(time: number): void {
  const delta = time - last;
  last = time;
  accumulator += delta;
  if (!paused) {
    while (accumulator > 55) {
      sim.step();
      accumulator -= 55;
    }
  }
  renderer.render(sim.state);
  drawMetrics();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

document.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((button) => {
  button.onclick = () => sim.intervene(button.dataset.act!);
});

document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) => {
  button.onclick = () => {
    document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((candidate) => candidate.classList.remove('active'));
    button.classList.add('active');
    renderer.view = button.dataset.view as ViewMode;
  };
});

const labelsButton = document.querySelector<HTMLButtonElement>('#labels')!;
labelsButton.onclick = () => {
  renderer.showLabels = !renderer.showLabels;
  labelsButton.classList.toggle('active', renderer.showLabels);
};

document.querySelector<HTMLButtonElement>('#recenter')!.onclick = () => renderer.recenter();

addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    paused = !paused;
  }
  if (event.key.toLowerCase() === 'r') renderer.recenter();
  if (event.key.toLowerCase() === 'l') labelsButton.click();
});

canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  renderer.camera.zoom = Math.max(3, Math.min(18, renderer.camera.zoom + (event.deltaY < 0 ? 1 : -1)));
}, { passive: false });

let dragging = false;
let lastX = 0;
let lastY = 0;
canvas.addEventListener('pointerdown', (event) => {
  dragging = true;
  lastX = event.clientX;
  lastY = event.clientY;
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointerup', (event) => {
  dragging = false;
  canvas.releasePointerCapture(event.pointerId);
});
canvas.addEventListener('pointercancel', () => {
  dragging = false;
});
canvas.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  renderer.camera.x -= (event.clientX - lastX) / renderer.camera.zoom;
  renderer.camera.y -= (event.clientY - lastY) / renderer.camera.zoom;
  lastX = event.clientX;
  lastY = event.clientY;
});
canvas.addEventListener('dblclick', () => renderer.recenter());
