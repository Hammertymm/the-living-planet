import './styles.css';
import { Simulation } from './engine/simulation';
import { Renderer } from './render/renderer';
import { isWorldSave, listWorlds, loadWorld, removeWorld, saveWorld } from './persistence/worldStore';
import type { WorldSave, WorldSaveMetadata } from './persistence/worldStore';
import type { PlacementTool, SocialGroup, ViewMode } from './world/types';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
<div class="shell">
  <canvas id="world" aria-label="The Living Planet simulation canvas"></canvas>

  <div class="topbar">
    <section class="brand">
      <h1>The Living Planet</h1>
      <p>v1.0 · Persistent Living Planet</p><span class="save-status" id="save-status">Preparing world…</span>
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
    <button data-view="climate">Climate</button>
    <span class="divider"></span>
    <button id="pause">Pause</button>
    <button id="labels" class="active">Labels</button>
    <button id="recenter">Recenter</button>
    <button id="chronicle-toggle">Chronicle</button>
    <button id="wildlife-toggle">Wildlife</button>
    <button id="worlds-toggle">Worlds</button>
    <button id="director-toggle">Story follow</button>
    <button id="documentary-toggle">Documentary</button>
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

    <section class="climate-summary" id="climate-summary"></section>

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

  <section class="worlds hidden" id="worlds">
    <div class="panel-heading">
      <div>
        <h2>World Library</h2>
        <p>Save, resume, export or begin another living world.</p>
      </div>
      <button id="close-worlds" class="icon-button" title="Close world library">×</button>
    </div>

    <label class="world-name-control" for="world-name">
      <span>Current world</span>
      <input id="world-name" type="text" maxlength="48" value="Eden-4319" />
    </label>
    <div class="world-identity" id="world-identity"></div>

    <div class="world-actions">
      <button id="save-world" class="primary-action">Save world</button>
      <button id="capture-world">Screenshot</button>
      <button id="export-world">Export file</button>
      <button id="import-world">Import file</button>
      <input id="import-file" type="file" accept="application/json,.json,.planet" hidden />
    </div>

    <div class="new-world-block">
      <div class="section-label">Begin another planet</div>
      <div class="new-world-fields">
        <input id="new-world-name" type="text" maxlength="48" placeholder="World name" />
        <input id="new-world-seed" type="number" min="1" max="999999999" placeholder="Seed" />
        <button id="new-world">Create</button>
      </div>
    </div>

    <div class="section-label library-label">Saved worlds</div>
    <div class="world-list" id="world-list"></div>
  </section>

  <div class="documentary-dock" id="documentary-dock">
    <button id="documentary-exit">Exit documentary</button>
    <button id="documentary-director">Story follow: off</button>
  </div>

  <div class="help">Wheel zoom · R recenter · L labels · C chronicle · W wildlife · M worlds · Ctrl+S save · D documentary · F story follow · [ ] time flow · Space pause · Esc observe</div>
</div>`;

const canvas = document.querySelector<HTMLCanvasElement>('#world')!;
let sim = new Simulation(4319);
const renderer = new Renderer(canvas);
let currentWorldName = 'Eden-4319';
let currentManualSaveId: string | undefined;
let lastAutosavedDay = -1;
let saveInFlight = false;
let ready = false;
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
let documentaryMode = false;
let directorEnabled = false;
let lastDirectedNote = '';

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
const climateSummary = document.querySelector<HTMLElement>('#climate-summary')!;
const saveStatus = document.querySelector<HTMLElement>('#save-status')!;
const worlds = document.querySelector<HTMLElement>('#worlds')!;
const worldsToggle = document.querySelector<HTMLButtonElement>('#worlds-toggle')!;
const worldNameInput = document.querySelector<HTMLInputElement>('#world-name')!;
const worldIdentity = document.querySelector<HTMLElement>('#world-identity')!;
const worldList = document.querySelector<HTMLElement>('#world-list')!;
const importFile = document.querySelector<HTMLInputElement>('#import-file')!;
const newWorldNameInput = document.querySelector<HTMLInputElement>('#new-world-name')!;
const newWorldSeedInput = document.querySelector<HTMLInputElement>('#new-world-seed')!;
const documentaryToggle = document.querySelector<HTMLButtonElement>('#documentary-toggle')!;
const documentaryExit = document.querySelector<HTMLButtonElement>('#documentary-exit')!;
const directorToggle = document.querySelector<HTMLButtonElement>('#director-toggle')!;
const documentaryDirector = document.querySelector<HTMLButtonElement>('#documentary-director')!;
let chronicleSignature = '';
let wildlifeSignature = '';

const APP_VERSION = '1.0.0';
const AUTOSAVE_ID = 'autosave';

function cleanWorldName(value: string, seed = sim.state.seed): string {
  const cleaned = value.trim().replace(/\s+/g, ' ').slice(0, 48);
  return cleaned || `Eden-${seed}`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[character] ?? character));
}

function setSaveStatus(message: string, state: 'idle' | 'busy' | 'saved' | 'error' = 'idle'): void {
  saveStatus.textContent = message;
  saveStatus.dataset.state = state;
}

function worldSummary(): WorldSave['summary'] {
  const counts = sim.counts();
  return {
    plants: counts.plant,
    grazers: counts.grazer,
    predators: counts.predator,
    scavengers: counts.scavenger,
    fungi: counts.fungi,
    groups: sim.state.groups.length,
    landmarks: sim.state.landmarks.length,
  };
}

function buildWorldSave(kind: 'autosave' | 'manual', id: string): WorldSave {
  currentWorldName = cleanWorldName(worldNameInput.value);
  worldNameInput.value = currentWorldName;
  return {
    id,
    name: currentWorldName,
    kind,
    savedAt: Date.now(),
    day: sim.state.day,
    seed: sim.state.seed,
    season: sim.state.seasonName,
    appVersion: APP_VERSION,
    summary: worldSummary(),
    format: 'the-living-planet-world',
    schemaVersion: 1,
    simulation: sim.snapshot(),
    settings: {
      camera: { ...renderer.camera },
      view: renderer.view,
      showLabels: renderer.showLabels,
      timeRateIndex,
      brushRadius,
      directorEnabled,
    },
  };
}

function updateWorldIdentity(): void {
  const summary = worldSummary();
  worldIdentity.innerHTML = `
    <div><span>Seed</span><strong>${sim.state.seed}</strong><button id="copy-seed" title="Copy seed">Copy</button></div>
    <div><span>Age</span><strong>Day ${sim.state.day}</strong></div>
    <div><span>Living groups</span><strong>${summary.groups}</strong></div>
    <div><span>World memory</span><strong>${summary.landmarks} landmarks</strong></div>`;
  worldIdentity.querySelector<HTMLButtonElement>('#copy-seed')?.addEventListener('click', async () => {
    await navigator.clipboard.writeText(String(sim.state.seed));
    setSaveStatus('Seed copied', 'saved');
  });
}

function resetUiAfterWorldChange(): void {
  lastUiDay = -1;
  chronicleSignature = '';
  wildlifeSignature = '';
  accumulator = 0;
  last = performance.now();
  selectTool('observe');
  setDocumentary(false);
  setChronicle(false);
  setWildlife(false);
  renderer.brush.visible = false;
  drawMetrics(true);
  drawChronicle(true);
  drawWildlife(true);
  updateWorldIdentity();
}

function applyWorldSave(world: WorldSave, manualId?: string): void {
  const restored = new Simulation(world.seed);
  restored.restore(world.simulation);
  sim = restored;
  currentWorldName = cleanWorldName(world.name, world.seed);
  currentManualSaveId = manualId ?? (world.kind === 'manual' ? world.id : undefined);
  worldNameInput.value = currentWorldName;
  const settings = world.settings ?? {
    camera: { x: sim.width / 2, y: sim.height / 2, zoom: 7 },
    view: 'natural' as ViewMode,
    showLabels: true,
    timeRateIndex: 2,
    brushRadius: 8,
    directorEnabled: false,
  };
  renderer.camera = { ...settings.camera };
  renderer.view = settings.view;
  renderer.showLabels = settings.showLabels;
  labelsButton.classList.toggle('active', renderer.showLabels);
  brushRadius = Math.max(2, Math.min(22, settings.brushRadius ?? 8));
  brushInput.value = String(brushRadius);
  brushValue.textContent = String(brushRadius);
  renderer.brush.radius = brushRadius;
  setTimeRate(settings.timeRateIndex ?? 2);
  setDirector(Boolean(settings.directorEnabled));
  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === renderer.view);
  });
  lastAutosavedDay = world.day;
  resetUiAfterWorldChange();
}

function timeAgo(timestamp: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function savedWorldCard(world: WorldSaveMetadata): string {
  const kind = world.kind === 'autosave' ? 'Automatic recovery' : 'Saved world';
  return `<article class="world-card" data-world-id="${world.id}">
    <button class="world-load" data-load-world="${world.id}">
      <span class="world-card-heading"><strong>${escapeHtml(world.name)}</strong><em>${kind}</em></span>
      <span class="world-card-meta">Day ${world.day} · ${world.season} · Seed ${world.seed}</span>
      <span class="world-card-life">${world.summary.grazers} grazers · ${world.summary.predators} predators · ${world.summary.groups} groups</span>
      <small>Saved ${timeAgo(world.savedAt)}</small>
    </button>
    ${world.kind === 'manual' ? `<button class="world-delete" data-delete-world="${world.id}" title="Delete ${escapeHtml(world.name)}">×</button>` : ''}
  </article>`;
}

async function drawWorldLibrary(): Promise<void> {
  try {
    const saves = await listWorlds();
    worldList.innerHTML = saves.length > 0
      ? saves.map(savedWorldCard).join('')
      : '<div class="empty-library">No saved worlds yet. Autosave begins as soon as the planet moves.</div>';

    worldList.querySelectorAll<HTMLButtonElement>('[data-load-world]').forEach((button) => {
      button.onclick = async () => {
        const id = button.dataset.loadWorld;
        if (!id) return;
        setSaveStatus('Opening world…', 'busy');
        const world = await loadWorld(id);
        if (!world) return setSaveStatus('World could not be found', 'error');
        applyWorldSave(world, world.kind === 'manual' ? id : undefined);
        setSaveStatus(`Opened ${world.name}`, 'saved');
        setWorlds(false);
      };
    });

    worldList.querySelectorAll<HTMLButtonElement>('[data-delete-world]').forEach((button) => {
      button.onclick = async () => {
        const id = button.dataset.deleteWorld;
        if (!id) return;
        const metadata = saves.find((entry) => entry.id === id);
        if (!confirm(`Delete ${metadata?.name ?? 'this saved world'}?`)) return;
        await removeWorld(id);
        if (currentManualSaveId === id) currentManualSaveId = undefined;
        await drawWorldLibrary();
        setSaveStatus('Saved world deleted', 'idle');
      };
    });
  } catch (error) {
    console.error(error);
    worldList.innerHTML = '<div class="empty-library error">The browser could not open the world library.</div>';
  }
}

function setWorlds(open: boolean): void {
  worlds.classList.toggle('hidden', !open);
  worldsToggle.classList.toggle('active', open);
  if (open) {
    setChronicle(false);
    setWildlife(false);
    updateWorldIdentity();
    void drawWorldLibrary();
  }
}

async function persistCurrentWorld(kind: 'autosave' | 'manual'): Promise<void> {
  if (saveInFlight || !ready) return;
  if (kind === 'autosave' && sim.state.day === lastAutosavedDay) return;
  saveInFlight = true;
  const id = kind === 'autosave' ? AUTOSAVE_ID : (currentManualSaveId ?? `world-${crypto.randomUUID()}`);
  try {
    setSaveStatus(kind === 'autosave' ? 'Autosaving…' : 'Saving world…', 'busy');
    const world = buildWorldSave(kind, id);
    await saveWorld(world);
    if (kind === 'manual') currentManualSaveId = id;
    lastAutosavedDay = sim.state.day;
    setSaveStatus(`${kind === 'autosave' ? 'Autosaved' : 'Saved'} · Day ${sim.state.day}`, 'saved');
    if (!worlds.classList.contains('hidden')) await drawWorldLibrary();
  } catch (error) {
    console.error(error);
    setSaveStatus('Save failed', 'error');
  } finally {
    saveInFlight = false;
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeFilename(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'living-planet';
}

async function exportCurrentWorld(): Promise<void> {
  const world = buildWorldSave('manual', currentManualSaveId ?? `export-${Date.now()}`);
  const blob = new Blob([JSON.stringify(world)], { type: 'application/json' });
  downloadBlob(blob, `${safeFilename(world.name)}-day-${world.day}.planet.json`);
  setSaveStatus('World file exported', 'saved');
}

async function captureWorld(): Promise<void> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return setSaveStatus('Screenshot failed', 'error');
  downloadBlob(blob, `${safeFilename(currentWorldName)}-day-${sim.state.day}.png`);
  setSaveStatus('Planet screenshot captured', 'saved');
}

async function importWorldFile(file: File): Promise<void> {
  try {
    const parsed: unknown = JSON.parse(await file.text());
    if (!isWorldSave(parsed)) throw new Error('Unsupported file');
    const imported: WorldSave = {
      ...parsed,
      id: `world-${crypto.randomUUID()}`,
      kind: 'manual',
      savedAt: Date.now(),
      appVersion: APP_VERSION,
    };
    await saveWorld(imported);
    applyWorldSave(imported, imported.id);
    setSaveStatus(`Imported ${imported.name}`, 'saved');
    await drawWorldLibrary();
  } catch (error) {
    console.error(error);
    setSaveStatus('That file is not a valid Living Planet world', 'error');
  } finally {
    importFile.value = '';
  }
}

function randomSeed(): number {
  return Math.floor(1 + Math.random() * 999_999_998);
}

async function beginNewWorld(): Promise<void> {
  if (!confirm('Begin a new planet? The current world will be archived in your World Library first.')) return;
  try {
    setSaveStatus('Archiving current world…', 'busy');
    const archiveId = currentManualSaveId ?? `world-${crypto.randomUUID()}`;
    await saveWorld(buildWorldSave('manual', archiveId));

    const seed = Math.max(1, Math.min(999_999_999, Number(newWorldSeedInput.value) || randomSeed()));
    const name = cleanWorldName(newWorldNameInput.value, seed);
    sim = new Simulation(seed);
    currentWorldName = name;
    currentManualSaveId = undefined;
    lastAutosavedDay = -1;
    worldNameInput.value = name;
    newWorldNameInput.value = '';
    newWorldSeedInput.value = '';
    renderer.recenter();
    renderer.view = 'natural';
    renderer.showLabels = true;
    labelsButton.classList.add('active');
    setTimeRate(2);
    setDirector(false);
    resetUiAfterWorldChange();
    setSaveStatus(`New world · Seed ${seed}`, 'idle');
    await persistCurrentWorld('autosave');
    setWorlds(false);
  } catch (error) {
    console.error(error);
    setSaveStatus('Could not begin a new world', 'error');
  }
}

async function bootWorld(): Promise<void> {
  try {
    const autosave = await loadWorld(AUTOSAVE_ID);
    if (autosave && isWorldSave(autosave)) {
      applyWorldSave(autosave);
      setSaveStatus(`Resumed ${autosave.name} · Day ${autosave.day}`, 'saved');
    } else {
      worldNameInput.value = currentWorldName;
      updateWorldIdentity();
      setSaveStatus('New world · Autosave ready', 'idle');
    }
  } catch (error) {
    console.error(error);
    setSaveStatus('World library unavailable · Session only', 'error');
  } finally {
    ready = true;
    drawMetrics(true);
    drawChronicle(true);
    drawWildlife(true);
  }
}

function groupLocation(group: SocialGroup): { x: number; y: number } {
  return sim.groupLocation(group);
}

function windLabel(x: number, y: number): string {
  const angle = Math.atan2(y, x);
  const directions = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
  const index = Math.round(angle / (Math.PI / 4) + 8) % 8;
  return directions[index];
}

function noteLocation(index: number): { x: number; y: number } | undefined {
  const entry = sim.state.notes[index];
  if (!entry) return undefined;
  if (entry.focusX !== undefined && entry.focusY !== undefined) return { x: entry.focusX, y: entry.focusY };
  const group = entry.groupId ? sim.state.groups.find((candidate) => candidate.id === entry.groupId) : undefined;
  if (group) return groupLocation(group);
  const region = entry.regionId ? sim.state.regions.find((candidate) => candidate.id === entry.regionId) : undefined;
  return region ? { x: region.x, y: region.y } : undefined;
}

function setDirector(enabled: boolean): void {
  directorEnabled = enabled;
  directorToggle.classList.toggle('active', enabled);
  directorToggle.textContent = enabled ? 'Story follow: on' : 'Story follow';
  documentaryDirector.classList.toggle('active', enabled);
  documentaryDirector.textContent = `Story follow: ${enabled ? 'on' : 'off'}`;
  if (!enabled) renderer.cancelCinematic();
  else lastDirectedNote = '';
}

function setDocumentary(enabled: boolean): void {
  documentaryMode = enabled;
  document.body.classList.toggle('documentary-mode', enabled);
  documentaryToggle.classList.toggle('active', enabled);
  if (enabled) {
    selectTool('observe');
    setChronicle(false);
    setWildlife(false);
    setWorlds(false);
    renderer.view = 'natural';
    document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === 'natural'));
  }
}

function maybeDirectCamera(): void {
  if (!directorEnabled) return;
  const entry = sim.state.notes[0];
  if (!entry || (entry.importance ?? 1) < 2) return;
  const signature = `${entry.day}:${entry.text}`;
  if (signature === lastDirectedNote) return;
  const point = noteLocation(0);
  if (!point) return;
  lastDirectedNote = signature;
  renderer.setCinematicTarget(point.x, point.y, entry.importance === 3 ? 10.5 : 9);
}

function drawMetrics(force = false): void {
  if (!force && lastUiDay === sim.state.day) return;
  lastUiDay = sim.state.day;
  const counts = sim.counts();
  metrics.innerHTML = `
    <div class="metric"><span>Day</span><strong>${sim.state.day}</strong></div>
    <div class="metric"><span>Season</span><strong>${sim.state.seasonName}</strong></div>
    <div class="metric"><span>Plants</span><strong>${counts.plant}</strong></div>
    <div class="metric"><span>Grazers</span><strong>${counts.grazer}</strong></div>
    <div class="metric"><span>Predators</span><strong>${counts.predator}</strong></div>
    <div class="metric"><span>Fronts</span><strong>${sim.state.climateFronts.length}</strong></div>`;

  const rain = sim.state.climateFronts.filter((front) => front.kind === 'rain').length;
  const dry = sim.state.climateFronts.filter((front) => front.kind === 'dry').length;
  const storms = sim.state.climateFronts.filter((front) => front.kind === 'storm').length;
  climateSummary.innerHTML = `
    <div><span>Current season</span><strong>${sim.state.seasonName}</strong></div>
    <div><span>Prevailing wind</span><strong>${windLabel(sim.state.windX, sim.state.windY)}</strong></div>
    <div><span>Active weather</span><strong>${rain} rain · ${dry} dry · ${storms} storm</strong></div>`;

  const note = sim.state.notes[0];
  const region = note?.regionId ? sim.state.regions.find((candidate) => candidate.id === note.regionId) : undefined;
  const group = note?.groupId ? sim.state.groups.find((candidate) => candidate.id === note.groupId) : undefined;
  noteElement.innerHTML = note
    ? `${note.text}<small>Day ${note.day}${region ? ` · ${region.name}` : ''}${group ? ` · ${group.name}` : ''}</small>`
    : 'The planet is quiet.';
  if (!worlds.classList.contains('hidden')) updateWorldIdentity();
}

function focusNote(index: number): void {
  const point = noteLocation(index);
  if (point) renderer.focus(point.x, point.y, 9);
}

function drawChronicle(force = false): void {
  const signature = sim.state.notes.map((entry) => `${entry.day}:${entry.regionId ?? ''}:${entry.groupId ?? ''}:${entry.text}`).join('|');
  if (!force && signature === chronicleSignature) return;
  chronicleSignature = signature;

  chronicleList.innerHTML = sim.state.notes.map((entry, index) => {
    const region = entry.regionId ? sim.state.regions.find((candidate) => candidate.id === entry.regionId) : undefined;
    const group = entry.groupId ? sim.state.groups.find((candidate) => candidate.id === entry.groupId) : undefined;
    return `<button class="chronicle-entry${index === 0 ? ' latest' : ''} importance-${entry.importance ?? 1}" data-index="${index}">
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
    setWorlds(false);
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
    setWorlds(false);
    drawWildlife(true);
  }
}

function frame(time: number): void {
  const delta = Math.min(200, time - last);
  last = time;
  accumulator += delta;
  if (!paused && ready) {
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
  maybeDirectCamera();
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
worldsToggle.onclick = () => setWorlds(worlds.classList.contains('hidden'));
document.querySelector<HTMLButtonElement>('#close-worlds')!.onclick = () => setWorlds(false);
worldNameInput.onchange = () => {
  currentWorldName = cleanWorldName(worldNameInput.value);
  worldNameInput.value = currentWorldName;
  setSaveStatus('World renamed · save to keep it', 'idle');
};
document.querySelector<HTMLButtonElement>('#save-world')!.onclick = () => void persistCurrentWorld('manual');
document.querySelector<HTMLButtonElement>('#capture-world')!.onclick = () => void captureWorld();
document.querySelector<HTMLButtonElement>('#export-world')!.onclick = () => void exportCurrentWorld();
document.querySelector<HTMLButtonElement>('#import-world')!.onclick = () => importFile.click();
importFile.onchange = () => {
  const file = importFile.files?.[0];
  if (file) void importWorldFile(file);
};
document.querySelector<HTMLButtonElement>('#new-world')!.onclick = () => void beginNewWorld();
directorToggle.onclick = () => setDirector(!directorEnabled);
documentaryDirector.onclick = () => setDirector(!directorEnabled);
documentaryToggle.onclick = () => setDocumentary(!documentaryMode);
documentaryExit.onclick = () => setDocumentary(false);

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
  if (directorEnabled) setDirector(false);
  const before = renderer.worldFromScreen(event.clientX, event.clientY);
  renderer.camera.zoom = Math.max(3, Math.min(18, renderer.camera.zoom + (event.deltaY < 0 ? 1 : -1)));
  const after = renderer.worldFromScreen(event.clientX, event.clientY);
  renderer.camera.x += before.x - after.x;
  renderer.camera.y += before.y - after.y;
}, { passive: false });

canvas.addEventListener('contextmenu', (event) => event.preventDefault());

canvas.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  if (directorEnabled) setDirector(false);
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
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void persistCurrentWorld('manual'); return; }
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
  if (event.key.toLowerCase() === 'm') worldsToggle.click();
  if (event.key.toLowerCase() === 'd') setDocumentary(!documentaryMode);
  if (event.key.toLowerCase() === 'f') setDirector(!directorEnabled);
  if (shortcutTools[event.key]) selectTool(shortcutTools[event.key]);
});

selectTool('observe');
drawMetrics(true);
drawChronicle(true);
drawWildlife(true);
setDirector(false);
setDocumentary(false);

setInterval(() => void persistCurrentWorld('autosave'), 45_000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void persistCurrentWorld('autosave');
});
addEventListener('beforeunload', () => { void persistCurrentWorld('autosave'); });
void bootWorld();
