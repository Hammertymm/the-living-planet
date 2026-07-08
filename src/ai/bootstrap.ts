import './intelligence.css';
import { askCloudNaturalist } from './client';
import { EvidenceStore } from './evidenceStore';
import { analyzeLocally, observationFromEvidence } from './localNaturalist';
import type { EvidenceRecord, NaturalistAnalysis } from './types';

const REGION_NAMES = ['Northern Highlands', 'Western Basin', 'Central Plains', 'Eastern Wetlands', 'Southern Ridge', 'Coastal Flats'];
const SETTINGS_KEY = 'living-planet-intelligence-settings-v1';

interface IntelligenceSettings {
  autoInsights: boolean;
  preferCloud: boolean;
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

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(timestamp);
}

function loadSettings(): IntelligenceSettings {
  try {
    return {
      autoInsights: true,
      preferCloud: false,
      ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}'),
    };
  } catch {
    return { autoInsights: true, preferCloud: false };
  }
}

function saveSettings(settings: IntelligenceSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function waitForPlanet(): Promise<void> {
  return new Promise((resolve) => {
    const ready = () => document.querySelector('#viewbar') && document.querySelector('#metrics') && document.querySelector('#note');
    if (ready()) return resolve();
    const observer = new MutationObserver(() => {
      if (!ready()) return;
      observer.disconnect();
      resolve();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });
}

void waitForPlanet().then(startIntelligence);

function startIntelligence(): void {
  const viewbar = document.querySelector<HTMLElement>('#viewbar')!;
  const shell = document.querySelector<HTMLElement>('.shell') ?? document.body;
  const metricsElement = document.querySelector<HTMLElement>('#metrics')!;
  const noteElement = document.querySelector<HTMLElement>('#note')!;
  const worldName = document.querySelector<HTMLInputElement>('#world-name');
  const worldIdentity = document.querySelector<HTMLElement>('#world-identity');
  const store = new EvidenceStore();
  const settings = loadSettings();
  let open = false;
  let activeTab: 'insights' | 'evidence' | 'ask' | 'settings' = 'insights';
  let analyses: NaturalistAnalysis[] = [];
  let asking = false;

  const toggle = document.createElement('button');
  toggle.id = 'intelligence-toggle';
  toggle.className = 'intelligence-toggle';
  toggle.textContent = 'Intelligence';
  toggle.title = 'Grounded Naturalist intelligence (I)';
  const worldsButton = viewbar.querySelector('#worlds-toggle');
  worldsButton?.insertAdjacentElement('afterend', toggle) ?? viewbar.append(toggle);

  const panel = document.createElement('section');
  panel.id = 'intelligence-panel';
  panel.className = 'intelligence-panel hidden';
  panel.innerHTML = `
    <header class="intelligence-heading">
      <div>
        <span class="intelligence-eyebrow">Grounded intelligence</span>
        <h2>Naturalist 2.0</h2>
      </div>
      <div class="intelligence-heading-actions">
        <span class="intelligence-status" id="intelligence-status">Local evidence</span>
        <button class="intelligence-close" id="intelligence-close" title="Close intelligence">×</button>
      </div>
    </header>
    <nav class="intelligence-tabs" aria-label="Intelligence sections">
      <button data-ai-tab="insights" class="active">Insights</button>
      <button data-ai-tab="evidence">Evidence <span id="evidence-count">0</span></button>
      <button data-ai-tab="ask">Ask</button>
      <button data-ai-tab="settings">Settings</button>
    </nav>
    <div class="intelligence-body">
      <section class="ai-tab" data-ai-page="insights">
        <div class="insight-actions">
          <button id="observe-now" class="ai-primary">Observe now</button>
          <span id="grounding-meter">Waiting for evidence</span>
        </div>
        <div id="insight-list" class="insight-list"></div>
      </section>
      <section class="ai-tab hidden" data-ai-page="evidence">
        <div class="evidence-intro">Every claim is tied to a simulation observation. AI cannot invent events outside this ledger.</div>
        <div id="evidence-list" class="evidence-list"></div>
      </section>
      <section class="ai-tab hidden" data-ai-page="ask">
        <div class="question-chips">
          <button data-question="What changed recently?">What changed?</button>
          <button data-question="Is the ecosystem stable?">Is it stable?</button>
          <button data-question="Which region is most active?">Active region?</button>
          <button data-question="Why are grazers changing?">Grazers?</button>
          <button data-question="What is happening with predators?">Predators?</button>
          <button data-question="What is the role of fungi right now?">Fungi?</button>
        </div>
        <form id="ask-form" class="ask-form">
          <textarea id="ask-input" maxlength="280" rows="3" placeholder="Ask a question about this planet…"></textarea>
          <button class="ai-primary" type="submit">Analyze evidence</button>
        </form>
        <div id="answer-area" class="answer-area"></div>
      </section>
      <section class="ai-tab hidden" data-ai-page="settings">
        <label class="ai-setting"><input id="auto-insights" type="checkbox" /> <span><strong>Automatic insights</strong><small>Create an observation when a significant recorded change occurs.</small></span></label>
        <label class="ai-setting"><input id="prefer-cloud" type="checkbox" /> <span><strong>Cloud Naturalist</strong><small>Use the secure server endpoint for user-requested analysis. Falls back locally.</small></span></label>
        <div class="ai-security-note"><strong>API key protection</strong><br />The browser never receives an OpenAI API key. Cloud analysis only works after <code>OPENAI_API_KEY</code> is configured on the server.</div>
        <button id="clear-evidence" class="ai-danger">Clear intelligence evidence</button>
      </section>
    </div>`;
  shell.append(panel);

  const status = panel.querySelector<HTMLElement>('#intelligence-status')!;
  const evidenceCount = panel.querySelector<HTMLElement>('#evidence-count')!;
  const insightList = panel.querySelector<HTMLElement>('#insight-list')!;
  const evidenceList = panel.querySelector<HTMLElement>('#evidence-list')!;
  const groundingMeter = panel.querySelector<HTMLElement>('#grounding-meter')!;
  const answerArea = panel.querySelector<HTMLElement>('#answer-area')!;
  const askInput = panel.querySelector<HTMLTextAreaElement>('#ask-input')!;
  const autoInsights = panel.querySelector<HTMLInputElement>('#auto-insights')!;
  const preferCloud = panel.querySelector<HTMLInputElement>('#prefer-cloud')!;

  autoInsights.checked = settings.autoInsights;
  preferCloud.checked = settings.preferCloud;

  function setOpen(value: boolean): void {
    open = value;
    panel.classList.toggle('hidden', !value);
    toggle.classList.toggle('active', value);
    if (value) renderAll();
  }

  function setTab(tab: typeof activeTab): void {
    activeTab = tab;
    panel.querySelectorAll<HTMLButtonElement>('[data-ai-tab]').forEach((button) => button.classList.toggle('active', button.dataset.aiTab === tab));
    panel.querySelectorAll<HTMLElement>('[data-ai-page]').forEach((page) => page.classList.toggle('hidden', page.dataset.aiPage !== tab));
    if (tab === 'evidence') renderEvidence();
  }

  function evidenceChip(id: string): string {
    return `<button class="evidence-chip" data-evidence-id="${escapeHtml(id)}">${escapeHtml(id)}</button>`;
  }

  function analysisCard(analysis: NaturalistAnalysis): string {
    const caveats = analysis.caveats.length ? `<div class="analysis-caveat">${analysis.caveats.map(escapeHtml).join(' ')}</div>` : '';
    return `<article class="analysis-card" data-source="${analysis.generatedBy}">
      <div class="analysis-meta"><span>${analysis.generatedBy === 'cloud' ? 'Cloud Naturalist' : 'Local Naturalist'}</span><span>${analysis.confidence} confidence · ${formatTime(analysis.generatedAt)}</span></div>
      <h3>${escapeHtml(analysis.headline)}</h3>
      <p>${escapeHtml(analysis.narrative)}</p>
      <div class="analysis-evidence">${analysis.evidenceIds.map(evidenceChip).join('')}</div>
      ${caveats}
    </article>`;
  }

  function renderInsights(): void {
    const records = store.all();
    evidenceCount.textContent = String(records.length);
    const latestDay = [...records].reverse().find((record) => record.day !== undefined)?.day;
    groundingMeter.textContent = records.length
      ? `${records.length} evidence records${latestDay !== undefined ? ` · Day ${latestDay}` : ''}`
      : 'Waiting for evidence';
    insightList.innerHTML = analyses.length
      ? [...analyses].reverse().slice(0, 12).map(analysisCard).join('')
      : '<div class="ai-empty"><strong>The Naturalist is listening.</strong><span>Run the planet for several days or select Observe now.</span></div>';
  }

  function renderEvidence(): void {
    const records = store.recent(60).reverse();
    evidenceCount.textContent = String(store.all().length);
    evidenceList.innerHTML = records.length
      ? records.map((record) => `<article class="evidence-record" id="evidence-${record.id}">
          <div><strong>${escapeHtml(record.id)}</strong><span>${record.kind.replace(/_/g, ' ')}</span></div>
          <p>${escapeHtml(record.summary)}</p>
          <small>${record.day !== undefined ? `Day ${record.day}` : 'Live observation'}${record.region ? ` · ${escapeHtml(record.region)}` : ''} · ${record.source}</small>
        </article>`).join('')
      : '<div class="ai-empty">No evidence yet.</div>';
  }

  function renderAll(): void {
    renderInsights();
    if (activeTab === 'evidence') renderEvidence();
  }

  function addAnalysis(analysis: NaturalistAnalysis): void {
    analyses.push(analysis);
    if (analyses.length > 24) analyses = analyses.slice(-24);
    renderInsights();
  }

  function currentWorld(): { name?: string; seed?: string } {
    const seed = worldIdentity?.textContent?.match(/Seed\s*(\d+)/i)?.[1];
    return { name: worldName?.value, seed };
  }

  async function answer(question: string): Promise<void> {
    if (asking || !question.trim()) return;
    asking = true;
    answerArea.innerHTML = '<div class="ai-thinking"><span></span><span></span><span></span> Examining evidence…</div>';
    const evidence = store.recent(40);
    let analysis: NaturalistAnalysis;

    try {
      if (settings.preferCloud) {
        status.textContent = 'Cloud analysis';
        analysis = await askCloudNaturalist({ question: question.trim(), evidence, world: currentWorld() });
      } else {
        analysis = analyzeLocally(question, evidence);
      }
    } catch (error) {
      console.warn(error);
      analysis = analyzeLocally(question, evidence);
      analysis.caveats.unshift('Cloud analysis was unavailable; this answer used the local grounded Naturalist.');
    } finally {
      status.textContent = settings.preferCloud ? 'Cloud preferred · fallback ready' : 'Local evidence';
      asking = false;
    }

    answerArea.innerHTML = analysisCard(analysis);
    addAnalysis(analysis);
  }

  function capture(): void {
    store.captureMetrics(metricsElement.textContent ?? '');
    store.captureNaturalist(noteElement.textContent ?? '');
  }

  const observer = new MutationObserver(capture);
  observer.observe(metricsElement, { childList: true, subtree: true, characterData: true });
  observer.observe(noteElement, { childList: true, subtree: true, characterData: true });
  window.setInterval(capture, 2_500);
  capture();

  store.addEventListener('evidence', (event) => {
    const record = (event as CustomEvent<EvidenceRecord>).detail;
    if (settings.autoInsights) {
      const observation = observationFromEvidence(record, store.recent(40));
      if (observation) addAnalysis(observation);
    }
    if (open) renderAll();
  });
  store.addEventListener('changed', () => open && renderAll());

  toggle.addEventListener('click', () => setOpen(!open));
  panel.querySelector('#intelligence-close')?.addEventListener('click', () => setOpen(false));
  panel.querySelectorAll<HTMLButtonElement>('[data-ai-tab]').forEach((button) => button.addEventListener('click', () => setTab(button.dataset.aiTab as typeof activeTab)));
  panel.querySelector('#observe-now')?.addEventListener('click', () => addAnalysis(analyzeLocally('What is happening now?', store.recent(50))));
  panel.querySelectorAll<HTMLButtonElement>('[data-question]').forEach((button) => button.addEventListener('click', () => {
    const question = button.dataset.question ?? '';
    askInput.value = question;
    void answer(question);
  }));
  panel.querySelector<HTMLFormElement>('#ask-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    void answer(askInput.value);
  });
  autoInsights.addEventListener('change', () => {
    settings.autoInsights = autoInsights.checked;
    saveSettings(settings);
  });
  preferCloud.addEventListener('change', () => {
    settings.preferCloud = preferCloud.checked;
    saveSettings(settings);
    status.textContent = settings.preferCloud ? 'Cloud preferred · fallback ready' : 'Local evidence';
  });
  panel.querySelector('#clear-evidence')?.addEventListener('click', () => {
    if (!confirm('Clear the intelligence evidence ledger? The planet and World Chronicle are not affected.')) return;
    store.clear();
    analyses = [];
    renderAll();
  });
  panel.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-evidence-id]');
    if (!button) return;
    setTab('evidence');
    requestAnimationFrame(() => panel.querySelector(`#evidence-${button.dataset.evidenceId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() !== 'i' || event.ctrlKey || event.metaKey || event.altKey || (event.target as HTMLElement)?.matches('input, textarea')) return;
    setOpen(!open);
  });

  const first = analyzeLocally('What is happening now?', store.recent(40));
  if (first.evidenceIds.length) analyses.push(first);
  renderAll();

  // Keep region names discoverable for future model/tool grounding and prevent accidental tree-shaking.
  panel.dataset.regions = REGION_NAMES.join('|');
}
