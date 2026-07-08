import './observatory.css';
import type { LivingPlanetBridge } from '../integration/bridge';
import { DocumentaryDirector } from '../science/director';
import type { DocumentaryShot } from '../science/types';
import { ObservatoryArchive } from './archive';
import { buildObservatoryFilm, filmAsMarkdown } from './films';
import { generatePredictions, predictionAccuracy, resolvePredictions } from './predictor';
import type { AtmosphereSettings, FilmKind, NaturalistPrediction, ObservatoryFilm } from './types';

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character] ?? character));
}

function waitForBridge(): Promise<LivingPlanetBridge> {
  if (window.livingPlanet) return Promise.resolve(window.livingPlanet);
  return new Promise((resolve) => window.addEventListener('living-planet-bridge-ready', () => resolve(window.livingPlanet!), { once: true }));
}

function formatStatus(status: NaturalistPrediction['status']): string {
  return status.replace(/-/g, ' ');
}

function confidenceWeight(confidence: NaturalistPrediction['confidence']): number {
  return confidence === 'high' ? 3 : confidence === 'medium' ? 2 : 1;
}

function predictionCard(prediction: NaturalistPrediction): string {
  const resolved = prediction.status !== 'pending';
  const outcome = prediction.outcome ? `<p class="prediction-outcome"><strong>Observed:</strong> ${escapeHtml(prediction.outcome)}</p>` : '';
  const evidence = prediction.evidence.map((entry) => `<li>${escapeHtml(entry)}</li>`).join('');
  return `<article class="prediction-card status-${prediction.status}">
    <header><span>${escapeHtml(prediction.id)}</span><em>${escapeHtml(prediction.confidence)} confidence</em><strong>${escapeHtml(formatStatus(prediction.status))}</strong></header>
    <h3>${escapeHtml(prediction.headline)}</h3>
    <p>${escapeHtml(prediction.statement)}</p>
    <div class="prediction-rationale">${escapeHtml(prediction.rationale)}</div>
    ${outcome}
    <details><summary>Evidence and test</summary><ul>${evidence}</ul><small>Issued day ${prediction.createdDay} · due day ${prediction.dueDay}${resolved && prediction.resolvedDay ? ` · resolved day ${prediction.resolvedDay}` : ''}</small></details>
  </article>`;
}

function shotCard(shot: DocumentaryShot, index: number): string {
  return `<article class="observatory-shot">
    <span>${String(index + 1).padStart(2, '0')}</span>
    <div><em>${escapeHtml(shot.chapter ?? shot.kind)}</em><strong>${escapeHtml(shot.title)}</strong><small>${escapeHtml(shot.caption)}</small><i>${escapeHtml(shot.evidence ?? 'live state')}</i></div>
    <b>${Math.round(shot.durationMs / 1000)}s</b>
  </article>`;
}

function filmCard(film: ObservatoryFilm): string {
  return `<article class="film-card">
    <header><span>${film.kind}</span><em>Days ${film.startDay}–${film.endDay}</em></header>
    <h3>${escapeHtml(film.title)}</h3>
    <p>${escapeHtml(film.synopsis)}</p>
    <small>${film.shots.length} grounded shots · ${film.evidence.length} archived events</small>
  </article>`;
}

function downloadText(filename: string, content: string, type = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

const ATMOSPHERE_KEY = 'living-planet-atmosphere-v3';

function filmsKey(seed: number): string {
  return `living-planet-films-v3-${seed}`;
}

function loadFilms(seed: number): ObservatoryFilm[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(filmsKey(seed)) ?? '[]') as ObservatoryFilm[];
    return Array.isArray(parsed) ? parsed.slice(-12) : [];
  } catch {
    return [];
  }
}

function saveFilms(seed: number, films: ObservatoryFilm[]): void {
  try { localStorage.setItem(filmsKey(seed), JSON.stringify(films.slice(-12))); } catch { /* optional archive */ }
}


function loadAtmosphere(): Partial<AtmosphereSettings> | undefined {
  try {
    const parsed = JSON.parse(localStorage.getItem(ATMOSPHERE_KEY) ?? 'null') as Partial<AtmosphereSettings> | null;
    return parsed ?? undefined;
  } catch {
    return undefined;
  }
}

function saveAtmosphere(settings: AtmosphereSettings): void {
  try { localStorage.setItem(ATMOSPHERE_KEY, JSON.stringify(settings)); } catch { /* optional preference */ }
}

function atmosphereFromBridge(bridge: LivingPlanetBridge): AtmosphereSettings {
  const value = bridge.atmosphere();
  return {
    enabled: value.enabled,
    intensity: value.intensity,
    cycleSpeed: value.cycleSpeed,
    fog: value.fog,
    cloudShadows: value.cloudShadows,
  };
}

void waitForBridge().then(startObservatory);

function startObservatory(bridge: LivingPlanetBridge): void {
  const viewbar = document.querySelector<HTMLElement>('#viewbar');
  const shell = document.querySelector<HTMLElement>('.shell') ?? document.body;
  const canvas = document.querySelector<HTMLCanvasElement>('#world');
  if (!viewbar || !canvas) return;
  const worldCanvas = canvas;

  let seed = bridge.worldInfo().seed;
  let archive = new ObservatoryArchive(bridge);
  let films = loadFilms(seed);
  let currentFilm: ObservatoryFilm | undefined;
  let open = false;
  let activeTab: 'forecasts' | 'films' | 'atmosphere' | 'archive' = 'forecasts';
  let recording: MediaRecorder | undefined;
  let recordingChunks: Blob[] = [];
  let recordingFilm: ObservatoryFilm | undefined;
  const director = new DocumentaryDirector(bridge);

  const toggle = document.createElement('button');
  toggle.id = 'observatory-toggle';
  toggle.textContent = 'Observatory';
  toggle.title = 'Predictions, films and visual atmosphere (O)';
  const genesisButton = viewbar.querySelector('#genesis-toggle');
  genesisButton?.insertAdjacentElement('afterend', toggle) ?? viewbar.append(toggle);

  const panel = document.createElement('section');
  panel.id = 'observatory-panel';
  panel.className = 'observatory-panel hidden';
  panel.innerHTML = `
    <header class="observatory-heading">
      <div><span>Living evidence system</span><h2>Observatory</h2></div>
      <div><small id="observatory-world"></small><button id="observatory-close" title="Close Observatory">×</button></div>
    </header>
    <nav class="observatory-tabs">
      <button data-observatory-tab="forecasts" class="active">Forecasts</button>
      <button data-observatory-tab="films">Films</button>
      <button data-observatory-tab="atmosphere">Atmosphere</button>
      <button data-observatory-tab="archive">Archive</button>
    </nav>
    <div class="observatory-body">
      <section class="observatory-page" data-observatory-page="forecasts">
        <div class="observatory-intro"><strong>Scientific Naturalist</strong><span>Registers falsifiable predictions, waits for the due day, then scores them against later simulation evidence.</span></div>
        <div class="forecast-toolbar">
          <label><span>Forecast horizon</span><select id="forecast-horizon"><option value="90">90 days</option><option value="180" selected>180 days</option><option value="360">360 days</option></select></label>
          <button id="generate-forecast" class="observatory-primary">Issue forecast</button>
          <button id="resolve-forecasts">Test due forecasts</button>
        </div>
        <div id="calibration-summary" class="calibration-summary"></div>
        <div id="prediction-list" class="prediction-list"></div>
      </section>

      <section class="observatory-page hidden" data-observatory-page="films">
        <div class="observatory-intro"><strong>Generative documentaries</strong><span>Builds story arcs only from verified events, current animals, climate and archived locations. No ambient audio is included.</span></div>
        <div class="film-builder">
          <label><span>Documentary format</span><select id="film-kind"><option value="brief">Field brief</option><option value="season" selected>Seasonal chapter</option><option value="era">Era documentary</option></select></label>
          <button id="build-film" class="observatory-primary">Build documentary</button>
        </div>
        <div id="film-preview" class="film-preview"></div>
        <div id="film-actions" class="film-actions hidden">
          <button id="play-film" class="observatory-primary">Play</button>
          <button id="record-film">Record WebM</button>
          <button id="export-film">Export dossier</button>
          <button id="stop-film" class="observatory-danger" disabled>Stop</button>
        </div>
        <div id="film-progress" class="film-progress hidden"><div><i></i></div><strong></strong><small></small></div>
        <div id="film-storyboard" class="film-storyboard"></div>
      </section>

      <section class="observatory-page hidden" data-observatory-page="atmosphere">
        <div class="observatory-intro"><strong>Visual atmosphere</strong><span>Day, night, dawn, dusk, fog and cloud shadows are visual only. Ambient audio remains deliberately shelved.</span></div>
        <div class="atmosphere-presets">
          <button data-atmosphere-preset="natural">Natural cycle</button>
          <button data-atmosphere-preset="subtle">Subtle</button>
          <button data-atmosphere-preset="cinematic">Cinematic</button>
          <button data-atmosphere-preset="off">Off</button>
        </div>
        <label class="observatory-setting"><input id="atmosphere-enabled" type="checkbox" /><span><strong>Dynamic light cycle</strong><small>Dawn, daylight, dusk and moonlit night.</small></span></label>
        <label class="observatory-range"><span>Atmosphere strength <strong id="atmosphere-intensity-value"></strong></span><input id="atmosphere-intensity" type="range" min="0" max="100" value="68" /></label>
        <label class="observatory-range"><span>Cycle speed <strong id="atmosphere-speed-value"></strong></span><input id="atmosphere-speed" type="range" min="0" max="200" value="100" /></label>
        <label class="observatory-setting"><input id="atmosphere-fog" type="checkbox" /><span><strong>Moisture-driven fog</strong><small>Appears more strongly in wet and cool conditions.</small></span></label>
        <label class="observatory-setting"><input id="atmosphere-clouds" type="checkbox" /><span><strong>Moving cloud shadows</strong><small>Responds to weather-front density.</small></span></label>
      </section>

      <section class="observatory-page hidden" data-observatory-page="archive">
        <div class="archive-summary" id="archive-summary"></div>
        <div class="archive-actions"><button id="replay-season">Build film from recent archive</button><button id="export-archive">Export archive</button></div>
        <h3 class="observatory-section-title">Documentary library</h3>
        <div id="film-library" class="film-library"></div>
        <h3 class="observatory-section-title">Verified event stream</h3>
        <div id="observatory-event-list" class="observatory-event-list"></div>
      </section>
    </div>`;
  shell.append(panel);

  const worldLabel = panel.querySelector<HTMLElement>('#observatory-world')!;
  const predictionList = panel.querySelector<HTMLElement>('#prediction-list')!;
  const calibrationSummary = panel.querySelector<HTMLElement>('#calibration-summary')!;
  const horizonInput = panel.querySelector<HTMLSelectElement>('#forecast-horizon')!;
  const filmKindInput = panel.querySelector<HTMLSelectElement>('#film-kind')!;
  const filmPreview = panel.querySelector<HTMLElement>('#film-preview')!;
  const filmActions = panel.querySelector<HTMLElement>('#film-actions')!;
  const filmStoryboard = panel.querySelector<HTMLElement>('#film-storyboard')!;
  const filmProgress = panel.querySelector<HTMLElement>('#film-progress')!;
  const filmProgressBar = filmProgress.querySelector<HTMLElement>('i')!;
  const filmProgressTitle = filmProgress.querySelector<HTMLElement>('strong')!;
  const filmProgressMeta = filmProgress.querySelector<HTMLElement>('small')!;
  const playFilm = panel.querySelector<HTMLButtonElement>('#play-film')!;
  const recordFilm = panel.querySelector<HTMLButtonElement>('#record-film')!;
  const stopFilm = panel.querySelector<HTMLButtonElement>('#stop-film')!;
  const atmosphereEnabled = panel.querySelector<HTMLInputElement>('#atmosphere-enabled')!;
  const atmosphereIntensity = panel.querySelector<HTMLInputElement>('#atmosphere-intensity')!;
  const atmosphereIntensityValue = panel.querySelector<HTMLElement>('#atmosphere-intensity-value')!;
  const atmosphereSpeed = panel.querySelector<HTMLInputElement>('#atmosphere-speed')!;
  const atmosphereSpeedValue = panel.querySelector<HTMLElement>('#atmosphere-speed-value')!;
  const atmosphereFog = panel.querySelector<HTMLInputElement>('#atmosphere-fog')!;
  const atmosphereClouds = panel.querySelector<HTMLInputElement>('#atmosphere-clouds')!;
  const archiveSummary = panel.querySelector<HTMLElement>('#archive-summary')!;
  const filmLibrary = panel.querySelector<HTMLElement>('#film-library')!;
  const eventList = panel.querySelector<HTMLElement>('#observatory-event-list')!;

  function closeOtherPanels(): void {
    const panels = ['intelligence-panel', 'science-panel', 'genesis-panel', 'chronicle', 'wildlife', 'lives', 'worlds'];
    const toggles = ['intelligence-toggle', 'science-toggle', 'genesis-toggle', 'chronicle-toggle', 'wildlife-toggle', 'lives-toggle', 'worlds-toggle'];
    panels.forEach((id) => document.querySelector(`#${id}`)?.classList.add('hidden'));
    toggles.forEach((id) => document.querySelector(`#${id}`)?.classList.remove('active'));
  }

  function setOpen(value: boolean): void {
    open = value;
    panel.classList.toggle('hidden', !value);
    toggle.classList.toggle('active', value);
    if (value) {
      closeOtherPanels();
      window.dispatchEvent(new CustomEvent('living-planet-panel-open', { detail: { panel: 'observatory' } }));
      renderActive();
    }
  }

  function setTab(tab: typeof activeTab): void {
    activeTab = tab;
    panel.querySelectorAll<HTMLButtonElement>('[data-observatory-tab]').forEach((button) => button.classList.toggle('active', button.dataset.observatoryTab === tab));
    panel.querySelectorAll<HTMLElement>('[data-observatory-page]').forEach((page) => page.classList.toggle('hidden', page.dataset.observatoryPage !== tab));
    renderActive();
  }

  function renderPredictions(): void {
    const predictions = archive.allPredictions().sort((a, b) => b.createdDay - a.createdDay);
    const accuracy = predictionAccuracy(predictions);
    const pending = predictions.filter((prediction) => prediction.status === 'pending').length;
    const confidencePoints = predictions.filter((prediction) => prediction.status !== 'pending').reduce((sum, prediction) => sum + confidenceWeight(prediction.confidence), 0);
    calibrationSummary.innerHTML = `
      <span><strong>${pending}</strong> active forecasts</span>
      <span><strong>${accuracy.resolved}</strong> resolved</span>
      <span><strong>${accuracy.resolved ? `${Math.round(accuracy.score)}%` : '—'}</strong> weighted accuracy</span>
      <span><strong>${escapeHtml(accuracy.label)}</strong> calibration</span>
      <small>${confidencePoints ? `${confidencePoints} confidence-weighted evidence points` : 'More resolved forecasts are required before calibration is meaningful.'}</small>`;
    predictionList.innerHTML = predictions.length
      ? predictions.map(predictionCard).join('')
      : '<div class="observatory-empty"><strong>No forecasts registered.</strong><span>Allow several samples to accumulate, then issue the first falsifiable forecast.</span></div>';
  }

  function emitPrediction(prediction: NaturalistPrediction, result = false): void {
    window.dispatchEvent(new CustomEvent('living-planet-observatory-evidence', {
      detail: {
        kind: result ? 'prediction_result' : 'prediction',
        summary: result
          ? `${prediction.id} ${formatStatus(prediction.status)}: ${prediction.outcome ?? prediction.statement}`
          : `${prediction.id}: ${prediction.statement} Due day ${prediction.dueDay}.`,
        values: {
          predictionId: prediction.id,
          dueDay: prediction.dueDay,
          confidence: prediction.confidence,
          status: prediction.status,
          score: prediction.score ?? 0,
        },
        day: result ? prediction.resolvedDay : prediction.createdDay,
      },
    }));
  }

  function issueForecast(): void {
    const created = generatePredictions(bridge, archive, Number(horizonInput.value));
    archive.addPredictions(created);
    created.forEach((prediction) => emitPrediction(prediction));
    renderPredictions();
  }

  function testForecasts(): void {
    const resolved = resolvePredictions(bridge, archive);
    resolved.forEach((prediction) => emitPrediction(prediction, true));
    renderPredictions();
  }

  function renderFilm(): void {
    if (!currentFilm) {
      filmPreview.innerHTML = '<div class="observatory-empty"><strong>No documentary prepared.</strong><span>Choose a format and build a grounded story from the current archive.</span></div>';
      filmActions.classList.add('hidden');
      filmStoryboard.innerHTML = '';
      return;
    }
    filmPreview.innerHTML = filmCard(currentFilm);
    filmActions.classList.remove('hidden');
    filmStoryboard.innerHTML = currentFilm.shots.map(shotCard).join('');
  }

  function buildFilm(kind = filmKindInput.value as FilmKind): void {
    currentFilm = buildObservatoryFilm(bridge, archive, kind);
    films.push(currentFilm);
    films = films.slice(-12);
    saveFilms(seed, films);
    renderFilm();
    renderArchive();
    window.dispatchEvent(new CustomEvent('living-planet-observatory-evidence', {
      detail: {
        kind: 'documentary_record',
        summary: `${currentFilm.title} was assembled from ${currentFilm.evidence.length} verified events spanning day ${currentFilm.startDay} to ${currentFilm.endDay}.`,
        values: { filmId: currentFilm.id, shots: currentFilm.shots.length, evidence: currentFilm.evidence.length },
        day: currentFilm.generatedDay,
      },
    }));
  }

  function updateFilmUi(active: boolean): void {
    playFilm.disabled = active;
    recordFilm.disabled = active;
    stopFilm.disabled = !active;
    filmProgress.classList.toggle('hidden', !active);
    if (!active) bridge.setCinematicCaption(undefined);
  }

  function playCurrentFilm(record = false): void {
    if (!currentFilm) buildFilm();
    if (!currentFilm) return;
    if (record) beginRecording(currentFilm);
    director.play(currentFilm.shots);
  }

  function supportedMime(): string | undefined {
    if (typeof MediaRecorder === 'undefined') return undefined;
    const options = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    return options.find((value) => MediaRecorder.isTypeSupported(value));
  }

  function beginRecording(film: ObservatoryFilm): void {
    const mimeType = supportedMime();
    const capture = worldCanvas.captureStream;
    if (!mimeType || typeof capture !== 'function') {
      alert('This browser cannot record the planet canvas as WebM. Playback and dossier export remain available.');
      return;
    }
    try {
      recordingChunks = [];
      recordingFilm = film;
      recording = new MediaRecorder(worldCanvas.captureStream(30), { mimeType, videoBitsPerSecond: 5_000_000 });
      recording.ondataavailable = (event) => { if (event.data.size) recordingChunks.push(event.data); };
      recording.onstop = () => {
        if (!recordingChunks.length || !recordingFilm) return;
        const blob = new Blob(recordingChunks, { type: recording?.mimeType || 'video/webm' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${recordingFilm.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'living-planet-film'}.webm`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
        recording = undefined;
        recordingFilm = undefined;
        recordingChunks = [];
      };
      recording.start(1_000);
    } catch (error) {
      console.error(error);
      recording = undefined;
      alert('WebM recording could not start. The documentary can still be played normally.');
    }
  }

  function stopRecording(): void {
    if (recording && recording.state !== 'inactive') recording.stop();
  }

  function syncAtmosphereInputs(): void {
    const settings = atmosphereFromBridge(bridge);
    atmosphereEnabled.checked = settings.enabled;
    atmosphereIntensity.value = String(Math.round(settings.intensity * 100));
    atmosphereIntensityValue.textContent = `${Math.round(settings.intensity * 100)}%`;
    atmosphereSpeed.value = String(Math.round(settings.cycleSpeed * 100));
    atmosphereSpeedValue.textContent = settings.cycleSpeed === 0 ? 'Frozen' : `${settings.cycleSpeed.toFixed(1)}×`;
    atmosphereFog.checked = settings.fog;
    atmosphereClouds.checked = settings.cloudShadows;
  }

  function applyAtmosphere(): void {
    const settings: AtmosphereSettings = {
      enabled: atmosphereEnabled.checked,
      intensity: Number(atmosphereIntensity.value) / 100,
      cycleSpeed: Number(atmosphereSpeed.value) / 100,
      fog: atmosphereFog.checked,
      cloudShadows: atmosphereClouds.checked,
    };
    bridge.setAtmosphere(settings);
    saveAtmosphere(settings);
    syncAtmosphereInputs();
  }

  function applyPreset(name: string): void {
    const presets: Record<string, AtmosphereSettings> = {
      natural: { enabled: true, intensity: 0.68, cycleSpeed: 1, fog: true, cloudShadows: true },
      subtle: { enabled: true, intensity: 0.34, cycleSpeed: 0.65, fog: true, cloudShadows: false },
      cinematic: { enabled: true, intensity: 0.92, cycleSpeed: 0.45, fog: true, cloudShadows: true },
      off: { enabled: false, intensity: 0, cycleSpeed: 0, fog: false, cloudShadows: false },
    };
    const settings = presets[name] ?? presets.natural;
    bridge.setAtmosphere(settings);
    saveAtmosphere(settings);
    syncAtmosphereInputs();
  }

  function renderArchive(): void {
    archive.capture();
    const samples = archive.allSamples();
    const events = archive.allEvents().sort((a, b) => b.day - a.day);
    archiveSummary.innerHTML = `
      <span><strong>${samples.length}</strong> scientific samples</span>
      <span><strong>${events.length}</strong> verified events</span>
      <span><strong>${films.length}</strong> documentaries</span>
      <span><strong>${archive.allPredictions().length}</strong> forecasts</span>`;
    filmLibrary.innerHTML = films.length
      ? [...films].reverse().map((film) => `<button data-library-film="${escapeHtml(film.id)}">${filmCard(film)}</button>`).join('')
      : '<div class="observatory-empty">No documentary records yet.</div>';
    eventList.innerHTML = events.length
      ? events.slice(0, 120).map((event) => `<article><span>Day ${event.day}</span><strong>${escapeHtml(event.text)}</strong><small>${event.importance >= 3 ? 'turning point' : event.importance === 2 ? 'significant event' : 'field note'} · ${escapeHtml(event.id)}</small></article>`).join('')
      : '<div class="observatory-empty">The event archive is still forming.</div>';
    filmLibrary.querySelectorAll<HTMLButtonElement>('[data-library-film]').forEach((button) => button.onclick = () => {
      currentFilm = films.find((film) => film.id === button.dataset.libraryFilm);
      setTab('films');
      renderFilm();
    });
  }

  function renderActive(): void {
    worldLabel.textContent = `${bridge.worldInfo().name} · Day ${bridge.worldInfo().day}`;
    if (activeTab === 'forecasts') renderPredictions();
    if (activeTab === 'films') renderFilm();
    if (activeTab === 'atmosphere') syncAtmosphereInputs();
    if (activeTab === 'archive') renderArchive();
  }

  function checkWorld(): void {
    const currentSeed = bridge.worldInfo().seed;
    if (currentSeed === seed) return;
    seed = currentSeed;
    archive = new ObservatoryArchive(bridge);
    films = loadFilms(seed);
    currentFilm = undefined;
    renderActive();
  }

  director.addEventListener('started', () => updateFilmUi(true));
  director.addEventListener('shot', (event) => {
    const detail = (event as CustomEvent<{ shot: DocumentaryShot; index: number; total: number }>).detail;
    const shot = detail.shot;
    bridge.setCinematicCaption({
      eyebrow: `${shot.chapter ?? 'Documentary'} · ${detail.index + 1}/${detail.total}${shot.day !== undefined ? ` · Day ${shot.day}` : ''}`,
      title: shot.title,
      body: shot.caption,
    });
    filmProgressBar.style.width = `${(detail.index + 1) / detail.total * 100}%`;
    filmProgressTitle.textContent = shot.title;
    filmProgressMeta.textContent = `${detail.index + 1} of ${detail.total} · ${shot.evidence ?? 'live evidence'}`;
  });
  director.addEventListener('stopped', () => { updateFilmUi(false); stopRecording(); });
  director.addEventListener('finished', () => { updateFilmUi(false); stopRecording(); });

  toggle.addEventListener('click', () => setOpen(!open));
  panel.querySelector('#observatory-close')?.addEventListener('click', () => setOpen(false));
  panel.querySelectorAll<HTMLButtonElement>('[data-observatory-tab]').forEach((button) => button.onclick = () => setTab(button.dataset.observatoryTab as typeof activeTab));
  panel.querySelector('#generate-forecast')?.addEventListener('click', issueForecast);
  panel.querySelector('#resolve-forecasts')?.addEventListener('click', testForecasts);
  panel.querySelector('#build-film')?.addEventListener('click', () => buildFilm());
  playFilm.addEventListener('click', () => playCurrentFilm(false));
  recordFilm.addEventListener('click', () => playCurrentFilm(true));
  stopFilm.addEventListener('click', () => director.stop(true));
  panel.querySelector('#export-film')?.addEventListener('click', () => {
    if (!currentFilm) return;
    downloadText(`${currentFilm.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`, filmAsMarkdown(currentFilm), 'text/markdown;charset=utf-8');
  });
  panel.querySelector('#replay-season')?.addEventListener('click', () => { filmKindInput.value = 'season'; buildFilm('season'); setTab('films'); });
  panel.querySelector('#export-archive')?.addEventListener('click', () => {
    const payload = { world: bridge.worldInfo(), samples: archive.allSamples(), events: archive.allEvents(), predictions: archive.allPredictions(), films };
    downloadText(`${bridge.worldInfo().name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-observatory.json`, JSON.stringify(payload, null, 2), 'application/json');
  });
  panel.querySelectorAll<HTMLButtonElement>('[data-atmosphere-preset]').forEach((button) => button.onclick = () => applyPreset(button.dataset.atmospherePreset ?? 'natural'));
  [atmosphereEnabled, atmosphereIntensity, atmosphereSpeed, atmosphereFog, atmosphereClouds].forEach((input) => input.addEventListener('input', applyAtmosphere));

  window.addEventListener('living-planet-panel-open', (event) => {
    const detail = (event as CustomEvent<{ panel?: string }>).detail;
    if (detail?.panel !== 'observatory') setOpen(false);
  });
  worldCanvas.addEventListener('pointerdown', () => director.isActive() && director.stop(true));
  worldCanvas.addEventListener('wheel', () => director.isActive() && director.stop(true), { passive: true });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && director.isActive()) {
      director.stop(true);
      return;
    }
    if (event.key.toLowerCase() !== 'o' || event.ctrlKey || event.metaKey || event.altKey || (event.target as HTMLElement)?.matches('input, textarea, select')) return;
    setOpen(!open);
  });

  const savedAtmosphere = loadAtmosphere();
  if (savedAtmosphere) bridge.setAtmosphere(savedAtmosphere);
  archive.capture(true);
  syncAtmosphereInputs();
  renderPredictions();
  renderFilm();
  renderArchive();

  window.setInterval(() => {
    checkWorld();
    archive.capture();
    const resolved = resolvePredictions(bridge, archive);
    resolved.forEach((prediction) => emitPrediction(prediction, true));
    if (open) renderActive();
  }, 5_000);
}
