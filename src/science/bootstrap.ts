import './science.css';
import type { LivingPlanetBridge } from '../integration/bridge';
import { runCounterfactualExperiment, scenarioLabel } from './counterfactual';
import { DocumentaryDirector, buildDocumentaryPlan } from './director';
import type { DocumentaryShot, ExperimentResult, ExperimentScenario, PopulationVector } from './types';

const RESULTS_KEY = 'living-planet-science-results-v1';

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character] ?? character));
}

function waitForBridge(): Promise<LivingPlanetBridge> {
  if (window.livingPlanet) return Promise.resolve(window.livingPlanet);
  return new Promise((resolve) => {
    const ready = () => window.livingPlanet && resolve(window.livingPlanet);
    window.addEventListener('living-planet-bridge-ready', ready, { once: true });
  });
}

function loadResults(): ExperimentResult[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RESULTS_KEY) ?? '[]') as ExperimentResult[];
    return Array.isArray(parsed) ? parsed.slice(-12) : [];
  } catch {
    return [];
  }
}

function saveResults(results: ExperimentResult[]): void {
  try { localStorage.setItem(RESULTS_KEY, JSON.stringify(results.slice(-12))); } catch { /* optional history */ }
}

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${Math.round(value).toLocaleString()}`;
}

function populationRows(result: ExperimentResult): string {
  const rows: [keyof PopulationVector, string][] = [
    ['plant', 'Plants'], ['grazer', 'Grazers'], ['predator', 'Predators'], ['scavenger', 'Scavengers'], ['fungi', 'Fungi'],
  ];
  return rows.map(([key, label]) => `<tr>
    <th>${label}</th>
    <td>${Math.round(result.baseline.end[key]).toLocaleString()}</td>
    <td>${Math.round(result.intervention.end[key]).toLocaleString()}</td>
    <td class="${result.deltas[key] > 0 ? 'positive' : result.deltas[key] < 0 ? 'negative' : ''}">${signed(result.deltas[key])}</td>
  </tr>`).join('');
}

function resultCard(result: ExperimentResult): string {
  return `<article class="experiment-result">
    <div class="experiment-meta"><span>${escapeHtml(result.id)}</span><span>${result.confidence} confidence</span></div>
    <h3>${escapeHtml(scenarioLabel(result.config.scenario))} · ${escapeHtml(result.regionName)}</h3>
    <p>${escapeHtml(result.interpretation)}</p>
    <table><thead><tr><th>Population</th><th>Baseline</th><th>Alternative</th><th>Difference</th></tr></thead><tbody>${populationRows(result)}</tbody></table>
    <div class="experiment-foot"><span>Day ${result.startDay} → ${result.endDay}</span><span>${result.config.replicates} paired run${result.config.replicates === 1 ? '' : 's'}</span><span>Stability ${result.baseline.meanStability} → ${result.intervention.meanStability}</span></div>
    <button class="science-export" data-export-result="${escapeHtml(result.id)}">Export experiment</button>
  </article>`;
}

function shotCard(shot: DocumentaryShot, index: number): string {
  return `<article class="shot-card">
    <span>${String(index + 1).padStart(2, '0')}</span>
    <div><strong>${escapeHtml(shot.title)}</strong><small>${escapeHtml(shot.caption)}</small></div>
    <em>${Math.round(shot.durationMs / 1000)}s</em>
  </article>`;
}

void waitForBridge().then(startScience);

function startScience(bridge: LivingPlanetBridge): void {
  const viewbar = document.querySelector<HTMLElement>('#viewbar');
  const shell = document.querySelector<HTMLElement>('.shell') ?? document.body;
  if (!viewbar) return;

  let open = false;
  let activeTab: 'experiment' | 'director' | 'history' = 'experiment';
  let running = false;
  let results = loadResults();
  let shots = buildDocumentaryPlan(bridge);
  const director = new DocumentaryDirector(bridge);

  const toggle = document.createElement('button');
  toggle.id = 'science-toggle';
  toggle.textContent = 'Science Lab';
  toggle.title = 'Counterfactual ecology and documentary direction (X)';
  const intelligenceButton = viewbar.querySelector('#intelligence-toggle');
  intelligenceButton?.insertAdjacentElement('afterend', toggle) ?? viewbar.append(toggle);

  const panel = document.createElement('section');
  panel.id = 'science-panel';
  panel.className = 'science-panel hidden';
  panel.innerHTML = `
    <header class="science-heading">
      <div><span>Experimental observatory</span><h2>Science Lab</h2></div>
      <button id="science-close" title="Close Science Lab">×</button>
    </header>
    <nav class="science-tabs">
      <button data-science-tab="experiment" class="active">Counterfactual</button>
      <button data-science-tab="director">Director</button>
      <button data-science-tab="history">History <span id="science-history-count">0</span></button>
    </nav>
    <div class="science-body">
      <section data-science-page="experiment" class="science-page">
        <p class="science-intro">Fork the current world, change one condition, and compare the alternative future with a matched baseline. The live planet is never altered.</p>
        <div class="science-form-grid">
          <label><span>Intervention</span><select id="experiment-scenario">
            <option value="rainfall">Sustained rainfall</option>
            <option value="drought">Extended drought</option>
            <option value="vegetation">Vegetation restoration</option>
            <option value="grazer-introduction">Grazer introduction</option>
            <option value="predator-introduction">Predator introduction</option>
            <option value="predator-exclusion">Predator exclusion</option>
            <option value="fungal-bloom">Fungal bloom</option>
            <option value="fertility">Soil fertility restoration</option>
            <option value="wildfire">Wildfire disturbance</option>
          </select></label>
          <label><span>Region</span><select id="experiment-region"></select></label>
          <label><span>Future horizon</span><select id="experiment-horizon"><option value="90">90 days</option><option value="180" selected>180 days</option><option value="360">360 days</option></select></label>
          <label><span>Paired runs</span><select id="experiment-replicates"><option value="1">1 exploratory</option><option value="3" selected>3 comparative</option></select></label>
          <label class="science-radius"><span>Intervention radius <strong id="experiment-radius-value">12</strong></span><input id="experiment-radius" type="range" min="4" max="22" value="12" /></label>
        </div>
        <button id="run-experiment" class="science-primary">Run matched futures</button>
        <div id="experiment-progress" class="experiment-progress hidden"><div><span></span></div><p>Preparing matched worlds…</p></div>
        <div id="experiment-current"></div>
      </section>
      <section data-science-page="director" class="science-page hidden">
        <p class="science-intro">Build a short documentary from verified Chronicle events and named groups. The camera only moves after you press Play and stops when you take manual control.</p>
        <div class="director-actions"><button id="refresh-storyboard">Refresh storyboard</button><button id="play-storyboard" class="science-primary">Play story reel</button><button id="stop-storyboard" class="science-danger" disabled>Stop</button></div>
        <div id="director-progress" class="director-progress hidden"><span></span><strong></strong><small></small></div>
        <div id="storyboard" class="storyboard"></div>
      </section>
      <section data-science-page="history" class="science-page hidden"><div id="science-history" class="science-history"></div></section>
    </div>`;
  shell.append(panel);

  const caption = document.createElement('section');
  caption.id = 'science-director-caption';
  caption.className = 'science-director-caption hidden';
  caption.innerHTML = '<span></span><h2></h2><p></p>';
  shell.append(caption);

  const scenarioInput = panel.querySelector<HTMLSelectElement>('#experiment-scenario')!;
  const regionInput = panel.querySelector<HTMLSelectElement>('#experiment-region')!;
  const horizonInput = panel.querySelector<HTMLSelectElement>('#experiment-horizon')!;
  const replicatesInput = panel.querySelector<HTMLSelectElement>('#experiment-replicates')!;
  const radiusInput = panel.querySelector<HTMLInputElement>('#experiment-radius')!;
  const radiusValue = panel.querySelector<HTMLElement>('#experiment-radius-value')!;
  const progress = panel.querySelector<HTMLElement>('#experiment-progress')!;
  const progressBar = progress.querySelector<HTMLElement>('span')!;
  const progressText = progress.querySelector<HTMLElement>('p')!;
  const currentResult = panel.querySelector<HTMLElement>('#experiment-current')!;
  const history = panel.querySelector<HTMLElement>('#science-history')!;
  const historyCount = panel.querySelector<HTMLElement>('#science-history-count')!;
  const storyboard = panel.querySelector<HTMLElement>('#storyboard')!;
  const playButton = panel.querySelector<HTMLButtonElement>('#play-storyboard')!;
  const stopButton = panel.querySelector<HTMLButtonElement>('#stop-storyboard')!;
  const directorProgress = panel.querySelector<HTMLElement>('#director-progress')!;

  regionInput.innerHTML = bridge.regions().map((region) => `<option value="${escapeHtml(region.id)}">${escapeHtml(region.name)}</option>`).join('');
  regionInput.value = bridge.regions().find((region) => region.id === 'central')?.id ?? bridge.regions()[0]?.id ?? '';

  function setOpen(value: boolean): void {
    open = value;
    panel.classList.toggle('hidden', !value);
    toggle.classList.toggle('active', value);
    if (value) {
      window.dispatchEvent(new CustomEvent('living-planet-panel-open', { detail: { panel: 'science' } }));
      renderHistory();
      renderStoryboard();
    }
  }

  function setTab(tab: typeof activeTab): void {
    activeTab = tab;
    panel.querySelectorAll<HTMLButtonElement>('[data-science-tab]').forEach((button) => button.classList.toggle('active', button.dataset.scienceTab === tab));
    panel.querySelectorAll<HTMLElement>('[data-science-page]').forEach((page) => page.classList.toggle('hidden', page.dataset.sciencePage !== tab));
    if (tab === 'history') renderHistory();
    if (tab === 'director') renderStoryboard();
  }

  function renderHistory(): void {
    historyCount.textContent = String(results.length);
    history.innerHTML = results.length
      ? [...results].reverse().map(resultCard).join('')
      : '<div class="science-empty"><strong>No experiments yet.</strong><span>Run a matched future to create the first record.</span></div>';
  }

  function renderStoryboard(): void {
    storyboard.innerHTML = shots.length
      ? shots.map(shotCard).join('')
      : '<div class="science-empty">The Chronicle does not yet contain enough located events for a story reel.</div>';
  }

  function exportResult(result: ExperimentResult): void {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${result.id.toLowerCase()}-${result.config.scenario}.experiment.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }

  async function runExperiment(): Promise<void> {
    if (running) return;
    running = true;
    const runButton = panel.querySelector<HTMLButtonElement>('#run-experiment')!;
    runButton.disabled = true;
    progress.classList.remove('hidden');
    currentResult.innerHTML = '';

    try {
      const snapshot = bridge.snapshot();
      const result = await runCounterfactualExperiment(snapshot, bridge.worldInfo().name, {
        scenario: scenarioInput.value as ExperimentScenario,
        regionId: regionInput.value,
        horizon: Number(horizonInput.value),
        replicates: Number(replicatesInput.value),
        radius: Number(radiusInput.value),
      }, (completed, total, label) => {
        const percent = Math.min(100, Math.max(0, completed / total * 100));
        progressBar.style.width = `${percent}%`;
        progressText.textContent = `${label} · ${Math.round(percent)}%`;
      });

      results.push(result);
      results = results.slice(-12);
      saveResults(results);
      currentResult.innerHTML = resultCard(result);
      renderHistory();
      window.dispatchEvent(new CustomEvent('living-planet-science-evidence', { detail: result }));
    } catch (error) {
      console.error(error);
      currentResult.innerHTML = '<div class="science-error">The experiment could not complete. The live world was not changed.</div>';
    } finally {
      running = false;
      runButton.disabled = false;
      progress.classList.add('hidden');
      progressBar.style.width = '0%';
    }
  }

  function updateCaption(shot: DocumentaryShot, index: number, total: number): void {
    caption.classList.remove('hidden');
    caption.querySelector('span')!.textContent = `STORY REEL · ${index + 1}/${total}${shot.day !== undefined ? ` · DAY ${shot.day}` : ''}`;
    caption.querySelector('h2')!.textContent = shot.title;
    caption.querySelector('p')!.textContent = shot.caption;
    directorProgress.classList.remove('hidden');
    directorProgress.querySelector('span')!.style.width = `${((index + 1) / total) * 100}%`;
    directorProgress.querySelector('strong')!.textContent = shot.title;
    directorProgress.querySelector('small')!.textContent = `${index + 1} of ${total}`;
  }

  function endDirectorUi(): void {
    caption.classList.add('hidden');
    directorProgress.classList.add('hidden');
    playButton.disabled = false;
    stopButton.disabled = true;
  }

  director.addEventListener('started', () => { playButton.disabled = true; stopButton.disabled = false; });
  director.addEventListener('shot', (event) => {
    const detail = (event as CustomEvent<{ shot: DocumentaryShot; index: number; total: number }>).detail;
    updateCaption(detail.shot, detail.index, detail.total);
  });
  director.addEventListener('stopped', endDirectorUi);
  director.addEventListener('finished', endDirectorUi);

  toggle.addEventListener('click', () => setOpen(!open));
  panel.querySelector('#science-close')?.addEventListener('click', () => setOpen(false));
  panel.querySelectorAll<HTMLButtonElement>('[data-science-tab]').forEach((button) => button.addEventListener('click', () => setTab(button.dataset.scienceTab as typeof activeTab)));
  panel.querySelector('#run-experiment')?.addEventListener('click', () => void runExperiment());
  radiusInput.addEventListener('input', () => { radiusValue.textContent = radiusInput.value; });
  panel.querySelector('#refresh-storyboard')?.addEventListener('click', () => { shots = buildDocumentaryPlan(bridge); renderStoryboard(); });
  playButton.addEventListener('click', () => { shots = buildDocumentaryPlan(bridge); renderStoryboard(); director.play(shots); });
  stopButton.addEventListener('click', () => director.stop(true));

  panel.addEventListener('click', (event) => {
    const exportButton = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-export-result]');
    if (!exportButton) return;
    const result = results.find((candidate) => candidate.id === exportButton.dataset.exportResult);
    if (result) exportResult(result);
  });

  window.addEventListener('living-planet-panel-open', (event) => {
    const detail = (event as CustomEvent<{ panel?: string }>).detail;
    if (detail?.panel !== 'science') setOpen(false);
  });

  const canvas = document.querySelector<HTMLCanvasElement>('#world');
  canvas?.addEventListener('pointerdown', () => director.isActive() && director.stop(true));
  canvas?.addEventListener('wheel', () => director.isActive() && director.stop(true), { passive: true });

  document.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() !== 'x' || event.ctrlKey || event.metaKey || event.altKey || (event.target as HTMLElement)?.matches('input, textarea, select')) return;
    setOpen(!open);
  });

  renderHistory();
  renderStoryboard();
}
