import './genesis.css';
import type { LivingPlanetBridge } from '../integration/bridge';
import { dominantTrait, traitSummary } from '../world/genetics';
import type { Genome, Lineage } from '../world/types';
import { applyRecipe, composeRecipe } from './composer';
import { PlanetMemoryArchive } from './memory';
import { applyRecommendation, canApplyRecommendation, objectiveLabel, planStewardship } from './steward';
import type { StewardObjective, StewardRecommendation, WorldRecipe } from './types';

const TRAIT_LABELS: Record<keyof Genome, string> = {
  speed: 'Speed',
  metabolism: 'Efficiency',
  fertility: 'Fertility',
  vision: 'Perception',
  resilience: 'Resilience',
  cooperation: 'Cooperation',
  camouflage: 'Camouflage',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character] ?? character));
}

function waitForBridge(): Promise<LivingPlanetBridge> {
  if (window.livingPlanet) return Promise.resolve(window.livingPlanet);
  return new Promise((resolve) => window.addEventListener('living-planet-bridge-ready', () => resolve(window.livingPlanet!), { once: true }));
}

function traitBars(lineage: Lineage): string {
  return (Object.keys(TRAIT_LABELS) as Array<keyof Genome>).map((key) => {
    const raw = key === 'metabolism' ? 2 - lineage.genome[key] : lineage.genome[key];
    const percent = Math.max(8, Math.min(100, ((raw - 0.45) / 1.2) * 100));
    return `<div class="trait-row"><span>${TRAIT_LABELS[key]}</span><div><i style="width:${percent}%"></i></div><strong>${lineage.genome[key].toFixed(2)}</strong></div>`;
  }).join('');
}

function lineageCard(lineage: Lineage, all: Lineage[]): string {
  const parent = lineage.parentId ? all.find((candidate) => candidate.id === lineage.parentId) : undefined;
  const status = lineage.population > 0 ? `${lineage.population} living` : `extinct day ${lineage.extinctDay ?? 'unknown'}`;
  return `<article class="lineage-card ${lineage.population > 0 ? '' : 'extinct'}" data-lineage-id="${lineage.id}">
    <button class="lineage-focus" data-focus-lineage="${lineage.id}">
      <span class="lineage-swatch" style="--lineage:${lineage.color}"></span>
      <span><strong>${escapeHtml(lineage.name)}</strong><small>${lineage.species} · ${status}</small></span>
      <em>Day ${lineage.foundedDay}</em>
    </button>
    <p>${escapeHtml(traitSummary(lineage.genome))}${parent ? ` · descended from ${escapeHtml(parent.name)}` : ' · founding lineage'}</p>
    <div class="trait-grid">${traitBars(lineage)}</div>
  </article>`;
}

function recipeCard(recipe: WorldRecipe): string {
  const steps = recipe.interventions.map((step) => `<li><strong>${escapeHtml(step.tool)}</strong><span>${escapeHtml(step.regionId)} · radius ${step.radius}${(step.repetitions ?? 1) > 1 ? ` · ×${step.repetitions}` : ''}</span></li>`).join('');
  return `<article class="recipe-card">
    <div><span>Seed ${recipe.seed}</span><span>${recipe.tags.map(escapeHtml).join(' · ')}</span></div>
    <h3>${escapeHtml(recipe.name)}</h3>
    <p>${escapeHtml(recipe.description)}</p>
    <ol>${steps}</ol>
    <button id="apply-recipe" class="genesis-primary">Create this planet</button>
  </article>`;
}

function recommendationCard(recommendation: StewardRecommendation, index: number): string {
  const result = recommendation.result;
  const stability = Math.round((result.intervention.meanStability - result.baseline.meanStability) * 10) / 10;
  return `<article class="recommendation-card" data-rank="${index + 1}">
    <header><span>#${index + 1}</span><div><strong>${escapeHtml(recommendation.candidate.label)}</strong><small>${escapeHtml(result.regionName)}</small></div><em>${Math.round(recommendation.score)} pts</em></header>
    <p>${escapeHtml(recommendation.reason)}</p>
    <div class="recommendation-metrics"><span>Plants <b>${signed(result.deltas.plant)}</b></span><span>Grazers <b>${signed(result.deltas.grazer)}</b></span><span>Predators <b>${signed(result.deltas.predator)}</b></span><span>Fungi <b>${signed(result.deltas.fungi)}</b></span><span>Stability <b>${stability > 0 ? '+' : ''}${stability}</b></span></div>
    ${canApplyRecommendation(recommendation) ? `<button data-apply-recommendation="${index}" class="genesis-apply">Apply to live planet</button>` : '<small class="not-applicable">This recommendation is observational only and cannot be directly painted onto the live world.</small>'}
  </article>`;
}

function signed(value: number): string {
  const rounded = Math.round(value);
  return `${rounded > 0 ? '+' : ''}${rounded}`;
}

void waitForBridge().then(startGenesis);

function startGenesis(bridge: LivingPlanetBridge): void {
  const viewbar = document.querySelector<HTMLElement>('#viewbar');
  const shell = document.querySelector<HTMLElement>('.shell') ?? document.body;
  if (!viewbar) return;

  let open = false;
  let activeTab: 'evolution' | 'memory' | 'composer' | 'steward' = 'evolution';
  let recipe: WorldRecipe | undefined;
  let recommendations: StewardRecommendation[] = [];
  let planning = false;
  let memory = new PlanetMemoryArchive(bridge);
  let memorySeed = bridge.worldInfo().seed;

  const toggle = document.createElement('button');
  toggle.id = 'genesis-toggle';
  toggle.textContent = 'Genesis';
  toggle.title = 'Evolution, planetary memory, world composer and AI stewardship (G)';
  const scienceButton = viewbar.querySelector('#science-toggle');
  scienceButton?.insertAdjacentElement('afterend', toggle) ?? viewbar.append(toggle);

  const panel = document.createElement('section');
  panel.id = 'genesis-panel';
  panel.className = 'genesis-panel hidden';
  panel.innerHTML = `
    <header class="genesis-heading"><div><span>Living world intelligence</span><h2>Genesis Observatory</h2></div><button id="genesis-close">×</button></header>
    <nav class="genesis-tabs">
      <button data-genesis-tab="evolution" class="active">Evolution</button>
      <button data-genesis-tab="memory">Memory</button>
      <button data-genesis-tab="composer">Composer</button>
      <button data-genesis-tab="steward">Steward</button>
    </nav>
    <div class="genesis-body">
      <section data-genesis-page="evolution" class="genesis-page">
        <div class="genesis-intro"><strong>Evolution Observatory</strong><span>Traits are inherited, mutated and selected by the same energy economy that drives the ecosystem.</span></div>
        <div id="evolution-summary" class="evolution-summary"></div>
        <div id="lineage-list" class="lineage-list"></div>
      </section>
      <section data-genesis-page="memory" class="genesis-page hidden">
        <div class="genesis-intro"><strong>Planetary Memory</strong><span>The archive retains events beyond the short Chronicle and groups them into named ecological eras.</span></div>
        <div id="era-list" class="era-list"></div>
        <div class="memory-toolbar"><button id="refresh-memory">Refresh archive</button><button id="clear-memory" class="genesis-danger">Clear this world's archive</button></div>
        <div id="memory-list" class="memory-list"></div>
      </section>
      <section data-genesis-page="composer" class="genesis-page hidden">
        <div class="genesis-intro"><strong>World Composer</strong><span>Describe ecological pressures and starting conditions. A deterministic recipe is generated locally, previewed, then applied only with approval.</span></div>
        <div class="composer-presets">
          <button data-composer-prompt="A balanced resilient world with wetlands, rich fungal networks and several small grazing herds.">Balanced sanctuary</button>
          <button data-composer-prompt="A harsh dry savanna with scarce water, large migrating grazers and a small predator population.">Dry migration</button>
          <button data-composer-prompt="A lush rainforest world with heavy rain, dense plants and dominant decomposer networks.">Fungal rainforest</button>
          <button data-composer-prompt="A volcanic recovery landscape with ash-rich soil, recent fire and pioneer vegetation.">Ash recovery</button>
        </div>
        <textarea id="composer-prompt" rows="5" maxlength="500" placeholder="Describe the living planet you want to observe…"></textarea>
        <button id="compose-world" class="genesis-primary">Compose deterministic world</button>
        <div id="recipe-preview"></div>
      </section>
      <section data-genesis-page="steward" class="genesis-page hidden">
        <div class="genesis-intro"><strong>Steward Planner</strong><span>An autonomous local agent forks the current world, tests several interventions, ranks outcomes, and waits for approval before touching reality.</span></div>
        <div class="steward-controls">
          <label><span>Objective</span><select id="steward-objective">
            <option value="biodiversity">Increase biodiversity</option>
            <option value="grazer-recovery">Recover grazers</option>
            <option value="predator-balance">Balance predator pressure</option>
            <option value="drought-resilience">Drought resilience</option>
            <option value="soil-recovery">Soil and decomposition recovery</option>
          </select></label>
          <label><span>Focus region</span><select id="steward-region"></select></label>
        </div>
        <button id="run-steward" class="genesis-primary">Test alternative futures</button>
        <div id="steward-progress" class="steward-progress hidden"><div><i></i></div><p></p></div>
        <div id="steward-results" class="steward-results"></div>
      </section>
    </div>`;
  shell.append(panel);

  const lineageList = panel.querySelector<HTMLElement>('#lineage-list')!;
  const evolutionSummary = panel.querySelector<HTMLElement>('#evolution-summary')!;
  const eraList = panel.querySelector<HTMLElement>('#era-list')!;
  const memoryList = panel.querySelector<HTMLElement>('#memory-list')!;
  const composerPrompt = panel.querySelector<HTMLTextAreaElement>('#composer-prompt')!;
  const recipePreview = panel.querySelector<HTMLElement>('#recipe-preview')!;
  const stewardObjective = panel.querySelector<HTMLSelectElement>('#steward-objective')!;
  const stewardRegion = panel.querySelector<HTMLSelectElement>('#steward-region')!;
  const stewardProgress = panel.querySelector<HTMLElement>('#steward-progress')!;
  const stewardProgressBar = stewardProgress.querySelector<HTMLElement>('i')!;
  const stewardProgressText = stewardProgress.querySelector<HTMLElement>('p')!;
  const stewardResults = panel.querySelector<HTMLElement>('#steward-results')!;

  stewardRegion.innerHTML = bridge.regions().map((region) => `<option value="${region.id}">${escapeHtml(region.name)}</option>`).join('');

  function closeOtherPanels(): void {
    for (const id of ['intelligence-panel', 'science-panel', 'chronicle', 'wildlife', 'worlds']) document.querySelector(`#${id}`)?.classList.add('hidden');
    for (const id of ['intelligence-toggle', 'science-toggle', 'chronicle-toggle', 'wildlife-toggle', 'worlds-toggle']) document.querySelector(`#${id}`)?.classList.remove('active');
  }

  function setOpen(value: boolean): void {
    open = value;
    panel.classList.toggle('hidden', !value);
    toggle.classList.toggle('active', value);
    if (value) {
      closeOtherPanels();
      renderActive();
    }
  }

  function setTab(tab: typeof activeTab): void {
    activeTab = tab;
    panel.querySelectorAll<HTMLButtonElement>('[data-genesis-tab]').forEach((button) => button.classList.toggle('active', button.dataset.genesisTab === tab));
    panel.querySelectorAll<HTMLElement>('[data-genesis-page]').forEach((page) => page.classList.toggle('hidden', page.dataset.genesisPage !== tab));
    renderActive();
  }

  function lineagePosition(lineage: Lineage): { x: number; y: number } | undefined {
    const entities = bridge.snapshot().state.entities.filter((entity) => entity.lineageId === lineage.id);
    if (!entities.length) return undefined;
    return {
      x: entities.reduce((sum, entity) => sum + entity.x, 0) / entities.length,
      y: entities.reduce((sum, entity) => sum + entity.y, 0) / entities.length,
    };
  }

  function renderEvolution(): void {
    const lineages = bridge.lineages().sort((a, b) => b.population - a.population || b.foundedDay - a.foundedDay);
    const active = lineages.filter((lineage) => lineage.population > 0);
    const derived = lineages.filter((lineage) => lineage.parentId).length;
    evolutionSummary.innerHTML = `<span><strong>${active.length}</strong> living lineages</span><span><strong>${derived}</strong> divergence events</span><span><strong>${lineages.filter((lineage) => lineage.extinctDay !== undefined).length}</strong> extinctions recorded</span><button id="show-lineage-map">Lineage map</button>`;
    lineageList.innerHTML = lineages.length
      ? lineages.slice(0, 36).map((lineage) => lineageCard(lineage, lineages)).join('')
      : '<div class="genesis-empty">The genetic registry is preparing.</div>';
    evolutionSummary.querySelector('#show-lineage-map')?.addEventListener('click', () => bridge.setView('lineages'));
    lineageList.querySelectorAll<HTMLButtonElement>('[data-focus-lineage]').forEach((button) => button.onclick = () => {
      const lineage = lineages.find((candidate) => candidate.id === button.dataset.focusLineage);
      const point = lineage ? lineagePosition(lineage) : undefined;
      if (!point) return;
      bridge.setView('lineages');
      bridge.focus(point.x, point.y, 10);
      setOpen(false);
    });
  }

  function renderMemory(): void {
    memory.capture();
    const eras = memory.allEras().reverse();
    const moments = memory.allMoments().sort((a, b) => b.day - a.day);
    eraList.innerHTML = eras.length
      ? eras.map((era) => `<article><span>Day ${era.startDay}–${era.endDay}</span><strong>${escapeHtml(era.name)}</strong><p>${escapeHtml(era.summary)}</p></article>`).join('')
      : '<div class="genesis-empty">The first named era will close after 360 simulated days.</div>';
    memoryList.innerHTML = moments.length
      ? moments.slice(0, 80).map((moment) => `<button class="memory-moment" data-memory-region="${moment.regionId ?? ''}"><span>Day ${moment.day}</span><div><strong>${escapeHtml(moment.title)}</strong><small>${escapeHtml(moment.text)}</small></div><em>${moment.kind.replace(/-/g, ' ')}</em></button>`).join('')
      : '<div class="genesis-empty">No archived moments yet.</div>';
    memoryList.querySelectorAll<HTMLButtonElement>('[data-memory-region]').forEach((button) => button.onclick = () => {
      const region = bridge.regions().find((candidate) => candidate.id === button.dataset.memoryRegion);
      if (!region) return;
      bridge.focus(region.x, region.y, 8.5);
      setOpen(false);
    });
  }

  function renderActive(): void {
    if (!open) return;
    if (activeTab === 'evolution') renderEvolution();
    if (activeTab === 'memory') renderMemory();
  }

  function checkWorldChange(): void {
    const seed = bridge.worldInfo().seed;
    if (seed === memorySeed) return;
    memorySeed = seed;
    memory = new PlanetMemoryArchive(bridge);
    recipe = undefined;
    recommendations = [];
    recipePreview.innerHTML = '';
    stewardResults.innerHTML = '';
    renderActive();
  }

  toggle.addEventListener('click', () => setOpen(!open));
  panel.querySelector('#genesis-close')?.addEventListener('click', () => setOpen(false));
  panel.querySelectorAll<HTMLButtonElement>('[data-genesis-tab]').forEach((button) => button.onclick = () => setTab(button.dataset.genesisTab as typeof activeTab));
  panel.querySelector('#refresh-memory')?.addEventListener('click', renderMemory);
  panel.querySelector('#clear-memory')?.addEventListener('click', () => {
    if (!confirm('Clear the long-term memory archive for this world? The live planet will not be changed.')) return;
    memory.clear();
    renderMemory();
  });

  panel.querySelectorAll<HTMLButtonElement>('[data-composer-prompt]').forEach((button) => button.onclick = () => {
    composerPrompt.value = button.dataset.composerPrompt ?? '';
  });
  panel.querySelector('#compose-world')?.addEventListener('click', () => {
    recipe = composeRecipe(composerPrompt.value, bridge.regions());
    recipePreview.innerHTML = recipeCard(recipe);
    recipePreview.querySelector('#apply-recipe')?.addEventListener('click', async () => {
      if (!recipe || !confirm(`Archive the current planet and create “${recipe.name}”?`)) return;
      const button = recipePreview.querySelector<HTMLButtonElement>('#apply-recipe');
      if (button) { button.disabled = true; button.textContent = 'Creating planet…'; }
      try {
        await applyRecipe(bridge, recipe);
        setOpen(false);
      } finally {
        if (button) { button.disabled = false; button.textContent = 'Create this planet'; }
      }
    });
  });

  panel.querySelector('#run-steward')?.addEventListener('click', async () => {
    if (planning) return;
    planning = true;
    recommendations = [];
    stewardResults.innerHTML = '';
    stewardProgress.classList.remove('hidden');
    const objective = stewardObjective.value as StewardObjective;
    const regionId = stewardRegion.value;
    const runButton = panel.querySelector<HTMLButtonElement>('#run-steward')!;
    runButton.disabled = true;
    runButton.textContent = 'Testing futures…';
    try {
      recommendations = await planStewardship(bridge, objective, regionId, (completed, total, label) => {
        stewardProgressBar.style.width = `${Math.min(100, (completed / total) * 100)}%`;
        stewardProgressText.textContent = `${label} · ${Math.round((completed / total) * 100)}%`;
      });
      stewardResults.innerHTML = `<div class="steward-verdict"><strong>${escapeHtml(objectiveLabel(objective))}</strong><span>${recommendations.length} alternative interventions tested against matched futures.</span></div>${recommendations.map(recommendationCard).join('')}`;
      stewardResults.querySelectorAll<HTMLButtonElement>('[data-apply-recommendation]').forEach((button) => button.onclick = () => {
        const recommendation = recommendations[Number(button.dataset.applyRecommendation)];
        if (!recommendation || !confirm(`Apply ${recommendation.candidate.label} to the live planet?`)) return;
        applyRecommendation(bridge, recommendation);
        button.disabled = true;
        button.textContent = 'Applied';
      });
    } catch (error) {
      console.error(error);
      stewardResults.innerHTML = '<div class="genesis-empty error">The planner could not complete every alternative future. The live planet was not changed.</div>';
    } finally {
      planning = false;
      runButton.disabled = false;
      runButton.textContent = 'Test alternative futures';
      stewardProgress.classList.add('hidden');
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() !== 'g' || event.ctrlKey || event.metaKey || event.altKey || (event.target as HTMLElement)?.matches('input, textarea, select')) return;
    setOpen(!open);
  });

  memory.addEventListener('changed', () => activeTab === 'memory' && open && renderMemory());
  window.setInterval(() => {
    checkWorldChange();
    memory.capture();
    if (open && activeTab === 'evolution') renderEvolution();
  }, 5_000);
}
