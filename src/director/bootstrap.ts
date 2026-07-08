import './director.css';

const EVIDENCE_KEY = 'living-planet-intelligence-evidence-v1';
const SETTINGS_KEY = 'living-planet-director-settings-v1';
const MAX_STORIES = 36;
const PACE_SECONDS = [20, 35, 55, 80] as const;

type EvidenceKind =
  | 'metric_snapshot'
  | 'naturalist_note'
  | 'climate_signal'
  | 'world_event'
  | 'population_change'
  | 'extinction'
  | 'recovery'
  | string;

interface EvidenceRecord {
  id: string;
  sequence?: number;
  capturedAt: number;
  day?: number;
  region?: string;
  kind: EvidenceKind;
  source?: string;
  summary: string;
  values?: Record<string, unknown>;
}

interface StoredEvidence {
  records?: EvidenceRecord[];
  sequence?: number;
}

interface DirectorSettings {
  enabled: boolean;
  narration: boolean;
  autoDocumentary: boolean;
  paceIndex: number;
  quietHours: boolean;
}

interface StoryMoment extends EvidenceRecord {
  score: number;
  title: string;
}

interface ActiveReel {
  stories: StoryMoment[];
  index: number;
  timer?: number;
  endsAt: number;
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

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function loadSettings(): DirectorSettings {
  const defaults: DirectorSettings = {
    enabled: false,
    narration: false,
    autoDocumentary: true,
    paceIndex: 1,
    quietHours: true,
  };

  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<DirectorSettings>;
    return {
      ...defaults,
      ...saved,
      paceIndex: Math.max(0, Math.min(PACE_SECONDS.length - 1, Number(saved.paceIndex ?? defaults.paceIndex))),
    };
  } catch {
    return defaults;
  }
}

function saveSettings(settings: DirectorSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // The director is optional and must never interrupt the planet.
  }
}

function readEvidence(): EvidenceRecord[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(EVIDENCE_KEY) ?? 'null') as StoredEvidence | null;
    if (!parsed || !Array.isArray(parsed.records)) return [];
    return parsed.records
      .filter((record) => record && typeof record.id === 'string' && typeof record.summary === 'string')
      .slice(-180);
  } catch {
    return [];
  }
}

function eventScore(record: EvidenceRecord): number {
  const lower = record.summary.toLowerCase();
  let score = 8;

  if (record.kind === 'extinction') score = 100;
  else if (record.kind === 'world_event') score = 82;
  else if (record.kind === 'recovery') score = 76;
  else if (record.kind === 'population_change') score = 58;
  else if (record.kind === 'climate_signal') score = 48;
  else if (record.kind === 'naturalist_note') score = 38;
  else if (record.kind === 'metric_snapshot') score = 10;

  if (/wildfire|fire|burn|lightning/.test(lower)) score += 15;
  if (/migration|split|merged|formed|birth|first/.test(lower)) score += 12;
  if (/extinct|disappear|fell to zero|collapse/.test(lower)) score += 18;
  if (/recovered|returned|restored|regrowth/.test(lower)) score += 12;
  if (/drought|storm|flood|winter|disease/.test(lower)) score += 10;
  if (/predator|pack|herd|lineage|colony/.test(lower)) score += 5;
  if (record.region) score += 4;

  return Math.min(120, score);
}

function storyTitle(record: EvidenceRecord): string {
  const lower = record.summary.toLowerCase();
  const place = record.region ? ` in ${record.region}` : '';

  if (record.kind === 'extinction' || /extinct|fell to zero|disappear/.test(lower)) return `A Silence${place}`;
  if (record.kind === 'recovery' || /recovered|returned|restored/.test(lower)) return `The Return${place}`;
  if (/wildfire|fire|burn|lightning/.test(lower)) return `Fire Across ${record.region ?? 'the Land'}`;
  if (/migration|crossing|moving toward/.test(lower)) return `The Long Crossing${place}`;
  if (/drought|dry season|drying/.test(lower)) return `The Drying Season${place}`;
  if (/rain|storm|flood/.test(lower)) return `Weather Turns${place}`;
  if (/disease|outbreak/.test(lower)) return `A Quiet Outbreak${place}`;
  if (/predator|hunting|pack/.test(lower)) return `Under Pressure${place}`;
  if (/fungal|fungi|decompos/.test(lower)) return `The Hidden Recyclers${place}`;
  if (/increased|rising|flourishing/.test(lower)) return `Life Expands${place}`;
  if (/declined|falling|fragile/.test(lower)) return `Numbers in Retreat${place}`;
  return record.region ? `A Change in ${record.region}` : 'A Turning Point';
}

function toStories(records: EvidenceRecord[]): StoryMoment[] {
  const seen = new Set<string>();
  const result: StoryMoment[] = [];

  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    const fingerprint = `${record.day ?? 'live'}:${clean(record.summary).toLowerCase()}`;
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    result.push({ ...record, score: eventScore(record), title: storyTitle(record) });
    if (result.length >= MAX_STORIES) break;
  }

  return result;
}

function significantWords(value: string): string[] {
  const ignored = new Set(['this', 'that', 'with', 'from', 'into', 'over', 'under', 'across', 'after', 'before', 'their', 'there', 'where', 'while', 'have', 'has', 'been', 'were', 'will', 'world', 'planet', 'day']);
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 5 && !ignored.has(word));
}

function overlapScore(story: StoryMoment, button: HTMLButtonElement): number {
  const buttonText = clean(button.textContent ?? '').toLowerCase();
  const words = significantWords(story.summary);
  let score = 0;
  for (const word of words) if (buttonText.includes(word)) score += 3;
  if (story.region && buttonText.includes(story.region.toLowerCase())) score += 8;
  if (story.day !== undefined && buttonText.includes(`day ${story.day}`)) score += 10;
  return score;
}

function findChronicleEntry(story: StoryMoment): HTMLButtonElement | undefined {
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.chronicle-entry'));
  let best: HTMLButtonElement | undefined;
  let bestScore = 0;

  for (const button of buttons) {
    const score = overlapScore(story, button);
    if (score > bestScore) {
      bestScore = score;
      best = button;
    }
  }

  return bestScore >= 6 ? best : undefined;
}

function ensureDocumentary(enabled: boolean): void {
  const bodyEnabled = document.body.classList.contains('documentary-mode');
  if (enabled === bodyEnabled) return;
  document.querySelector<HTMLButtonElement>('#documentary-toggle')?.click();
}

function chooseVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis?.getVoices() ?? [];
  const preferred = ['Daniel', 'George', 'Microsoft David', 'Microsoft Mark', 'Google UK English Male'];
  for (const name of preferred) {
    const voice = voices.find((candidate) => candidate.name.includes(name));
    if (voice) return voice;
  }
  return voices.find((candidate) => candidate.lang.toLowerCase().startsWith('en'));
}

function speakStory(story: StoryMoment): void {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const text = `${story.title}. ${clean(story.summary)}`.slice(0, 360);
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.86;
  utterance.pitch = 0.88;
  utterance.volume = 0.72;
  const voice = chooseVoice();
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
}

function waitForPlanet(): Promise<void> {
  return new Promise((resolve) => {
    const ready = () => Boolean(document.querySelector('#viewbar') && document.querySelector('.shell') && document.querySelector('#chronicle-list'));
    if (ready()) return resolve();
    const observer = new MutationObserver(() => {
      if (!ready()) return;
      observer.disconnect();
      resolve();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });
}

void waitForPlanet().then(startDirector);

function startDirector(): void {
  const shell = document.querySelector<HTMLElement>('.shell') ?? document.body;
  const viewbar = document.querySelector<HTMLElement>('#viewbar')!;
  const settings = loadSettings();
  const brandSubtitle = document.querySelector<HTMLElement>('.brand p');
  if (brandSubtitle) brandSubtitle.textContent = 'v1.3 · Documentary Director';
  const help = document.querySelector<HTMLElement>('.help');
  if (help && !help.textContent?.includes('K director')) help.textContent = `${help.textContent ?? ''} · K director`;
  let open = false;
  let stories = toStories(readEvidence());
  let currentStory: StoryMoment | undefined;
  let lastFocusedId = '';
  let nextFocusAt = Date.now() + PACE_SECONDS[settings.paceIndex] * 1000;
  let activeReel: ActiveReel | undefined;
  let lastStorageValue = localStorage.getItem(EVIDENCE_KEY) ?? '';

  const toggle = document.createElement('button');
  toggle.id = 'director-panel-toggle';
  toggle.className = 'director-panel-toggle';
  toggle.textContent = 'Director';
  toggle.title = 'Documentary director (K)';
  const intelligenceButton = viewbar.querySelector('#intelligence-toggle');
  (intelligenceButton ?? viewbar.querySelector('#worlds-toggle'))?.insertAdjacentElement('afterend', toggle) ?? viewbar.append(toggle);

  const panel = document.createElement('section');
  panel.id = 'director-panel';
  panel.className = 'director-panel hidden';
  panel.innerHTML = `
    <header class="director-heading">
      <div>
        <span class="director-eyebrow">Cinematic observation</span>
        <h2>Documentary Director</h2>
      </div>
      <button id="director-panel-close" class="director-close" title="Close director">×</button>
    </header>
    <nav class="director-tabs" aria-label="Director sections">
      <button data-director-tab="live" class="active">Live</button>
      <button data-director-tab="reel">Story reel</button>
      <button data-director-tab="settings">Settings</button>
    </nav>
    <div class="director-body">
      <section data-director-page="live" class="director-page">
        <div class="director-state" id="director-state"></div>
        <div class="director-actions">
          <button id="director-enable" class="director-primary">Start directing</button>
          <button id="director-focus">Focus best moment</button>
        </div>
        <div id="director-current" class="director-current"></div>
      </section>
      <section data-director-page="reel" class="director-page hidden">
        <div class="reel-intro">The strongest recorded moments, ranked by ecological importance. Select one to revisit it.</div>
        <div class="reel-actions">
          <button id="director-start-reel" class="director-primary">Play 3-minute reel</button>
          <button id="director-stop-reel">Stop reel</button>
        </div>
        <div id="director-reel" class="director-reel"></div>
      </section>
      <section data-director-page="settings" class="director-page hidden">
        <label class="director-setting"><input id="director-auto-documentary" type="checkbox" /><span><strong>Enter Documentary mode</strong><small>Hide research controls while the director is active.</small></span></label>
        <label class="director-setting"><input id="director-narration" type="checkbox" /><span><strong>Spoken Naturalist</strong><small>Use the browser's local speech voice for selected moments.</small></span></label>
        <label class="director-setting"><input id="director-quiet" type="checkbox" /><span><strong>Quiet pacing</strong><small>Ignore routine metrics and wait for stronger ecological stories.</small></span></label>
        <label class="director-pace" for="director-pace"><span>Camera pace <strong id="director-pace-value"></strong></span><input id="director-pace" type="range" min="0" max="3" step="1" /></label>
        <div class="director-safety"><strong>Manual control always wins.</strong><br />The director is off by default. Panning, zooming or stopping the director returns the planet to manual observation.</div>
      </section>
    </div>`;
  shell.append(panel);

  const caption = document.createElement('aside');
  caption.className = 'director-caption hidden';
  caption.innerHTML = '<span class="director-caption-kicker">Director observing</span><strong id="director-caption-title"></strong><small id="director-caption-copy"></small>';
  shell.append(caption);

  const stateElement = panel.querySelector<HTMLElement>('#director-state')!;
  const currentElement = panel.querySelector<HTMLElement>('#director-current')!;
  const reelElement = panel.querySelector<HTMLElement>('#director-reel')!;
  const enableButton = panel.querySelector<HTMLButtonElement>('#director-enable')!;
  const focusButton = panel.querySelector<HTMLButtonElement>('#director-focus')!;
  const stopReelButton = panel.querySelector<HTMLButtonElement>('#director-stop-reel')!;
  const autoDocumentaryInput = panel.querySelector<HTMLInputElement>('#director-auto-documentary')!;
  const narrationInput = panel.querySelector<HTMLInputElement>('#director-narration')!;
  const quietInput = panel.querySelector<HTMLInputElement>('#director-quiet')!;
  const paceInput = panel.querySelector<HTMLInputElement>('#director-pace')!;
  const paceValue = panel.querySelector<HTMLElement>('#director-pace-value')!;
  const captionTitle = caption.querySelector<HTMLElement>('#director-caption-title')!;
  const captionCopy = caption.querySelector<HTMLElement>('#director-caption-copy')!;

  autoDocumentaryInput.checked = settings.autoDocumentary;
  narrationInput.checked = settings.narration;
  quietInput.checked = settings.quietHours;
  paceInput.value = String(settings.paceIndex);

  function paceLabel(): string {
    return `${PACE_SECONDS[settings.paceIndex]} seconds`;
  }

  function closeOtherPanels(): void {
    document.querySelector<HTMLButtonElement>('#intelligence-toggle.active')?.click();
    document.querySelector<HTMLButtonElement>('#chronicle-toggle.active')?.click();
    document.querySelector<HTMLButtonElement>('#wildlife-toggle.active')?.click();
    document.querySelector<HTMLButtonElement>('#worlds-toggle.active')?.click();
  }

  function setOpen(value: boolean): void {
    open = value;
    panel.classList.toggle('hidden', !value);
    toggle.classList.toggle('active', value);
    if (value) {
      closeOtherPanels();
      render();
    }
  }

  function setTab(tab: string): void {
    panel.querySelectorAll<HTMLButtonElement>('[data-director-tab]').forEach((button) => button.classList.toggle('active', button.dataset.directorTab === tab));
    panel.querySelectorAll<HTMLElement>('[data-director-page]').forEach((page) => page.classList.toggle('hidden', page.dataset.directorPage !== tab));
  }

  function setEnabled(value: boolean): void {
    settings.enabled = value;
    saveSettings(settings);
    enableButton.textContent = value ? 'Stop directing' : 'Start directing';
    enableButton.classList.toggle('active', value);
    toggle.classList.toggle('directing', value);
    nextFocusAt = Date.now() + PACE_SECONDS[settings.paceIndex] * 1000;

    if (settings.autoDocumentary) ensureDocumentary(value);
    if (value) {
      const initial = bestUnseenStory() ?? stories[0];
      if (initial) focusStory(initial, false);
    }
    if (!value) {
      caption.classList.add('hidden');
      window.speechSynthesis?.cancel();
    }
    renderState();
  }

  function storyCard(story: StoryMoment, compact = false): string {
    const scoreLabel = story.score >= 90 ? 'major' : story.score >= 65 ? 'strong' : story.score >= 45 ? 'notable' : 'quiet';
    return `<button class="director-story${compact ? ' compact' : ''}" data-story-id="${escapeHtml(story.id)}">
      <span class="director-story-meta"><strong>${story.day !== undefined ? `Day ${story.day}` : 'Live'}</strong><em>${escapeHtml(story.region ?? 'Planetwide')} · ${scoreLabel}</em></span>
      <span class="director-story-title">${escapeHtml(story.title)}</span>
      <span class="director-story-copy">${escapeHtml(clean(story.summary))}</span>
    </button>`;
  }

  function currentArc(): { title: string; copy: string } {
    const strongest = [...stories].sort((a, b) => b.score - a.score || b.capturedAt - a.capturedAt).slice(0, 4);
    if (!strongest.length) return { title: 'The planet is still gathering history', copy: 'Run the world for several days. The director will identify significant ecological moments as evidence accumulates.' };

    const lead = strongest[0];
    const regions = Array.from(new Set(strongest.map((story) => story.region).filter(Boolean))) as string[];
    const copy = regions.length > 1
      ? `${lead.title} leads a wider story now unfolding across ${regions.slice(0, 3).join(', ')}.`
      : `${lead.title} is currently the strongest recorded ecological thread.`;
    return { title: lead.title, copy };
  }

  function renderState(): void {
    const arc = currentArc();
    stateElement.innerHTML = `<div><span>Status</span><strong>${settings.enabled ? 'Directing' : 'Manual observation'}</strong></div><div><span>Evidence</span><strong>${stories.length} story moments</strong></div><div><span>Current arc</span><strong>${escapeHtml(arc.title)}</strong></div>`;
    enableButton.textContent = settings.enabled ? 'Stop directing' : 'Start directing';
    paceValue.textContent = paceLabel();
  }

  function renderCurrent(): void {
    if (!currentStory) {
      const arc = currentArc();
      currentElement.innerHTML = `<div class="director-empty"><strong>${escapeHtml(arc.title)}</strong><span>${escapeHtml(arc.copy)}</span></div>`;
      return;
    }
    currentElement.innerHTML = `<span class="director-section-label">Now observing</span>${storyCard(currentStory)}`;
  }

  function renderReel(): void {
    const ranked = [...stories].sort((a, b) => b.score - a.score || b.capturedAt - a.capturedAt).slice(0, 14);
    reelElement.innerHTML = ranked.length ? ranked.map((story) => storyCard(story, true)).join('') : '<div class="director-empty">No story moments have been recorded yet.</div>';
  }

  function render(): void {
    renderState();
    renderCurrent();
    renderReel();
  }

  function updateCaption(story: StoryMoment): void {
    captionTitle.textContent = story.title;
    captionCopy.textContent = clean(story.summary);
    caption.classList.toggle('hidden', !settings.enabled || open);
  }

  function focusStory(story: StoryMoment, announce = true): void {
    currentStory = story;
    lastFocusedId = story.id;
    nextFocusAt = Date.now() + PACE_SECONDS[settings.paceIndex] * 1000;

    const chronicleEntry = findChronicleEntry(story);
    if (chronicleEntry) chronicleEntry.click();
    if (announce && settings.narration) speakStory(story);
    updateCaption(story);
    renderCurrent();
  }

  function bestUnseenStory(): StoryMoment | undefined {
    const threshold = settings.quietHours ? 55 : 32;
    return stories
      .filter((story) => story.id !== lastFocusedId && story.score >= threshold)
      .sort((a, b) => b.capturedAt - a.capturedAt || b.score - a.score)[0]
      ?? stories.filter((story) => story.id !== lastFocusedId).sort((a, b) => b.score - a.score)[0];
  }

  function stopReel(): void {
    if (activeReel?.timer) window.clearTimeout(activeReel.timer);
    activeReel = undefined;
    stopReelButton.classList.remove('active');
    renderState();
  }

  function advanceReel(): void {
    if (!activeReel) return;
    if (activeReel.index >= activeReel.stories.length || Date.now() >= activeReel.endsAt) {
      stopReel();
      return;
    }
    const story = activeReel.stories[activeReel.index];
    activeReel.index += 1;
    focusStory(story);
    activeReel.timer = window.setTimeout(advanceReel, 28_000);
  }

  function startReel(): void {
    stopReel();
    const ranked = [...stories].sort((a, b) => b.score - a.score || b.capturedAt - a.capturedAt).slice(0, 7);
    if (!ranked.length) return;
    setEnabled(true);
    ensureDocumentary(true);
    activeReel = { stories: ranked, index: 0, endsAt: Date.now() + 3 * 60_000 };
    stopReelButton.classList.add('active');
    advanceReel();
  }

  function refreshEvidence(): void {
    const value = localStorage.getItem(EVIDENCE_KEY) ?? '';
    if (value === lastStorageValue) return;
    lastStorageValue = value;
    stories = toStories(readEvidence());
    if (open) render();
  }

  toggle.addEventListener('click', () => setOpen(!open));
  panel.querySelector('#director-panel-close')?.addEventListener('click', () => setOpen(false));
  panel.querySelectorAll<HTMLButtonElement>('[data-director-tab]').forEach((button) => button.addEventListener('click', () => setTab(button.dataset.directorTab ?? 'live')));
  enableButton.addEventListener('click', () => setEnabled(!settings.enabled));
  focusButton.addEventListener('click', () => {
    const story = bestUnseenStory() ?? stories[0];
    if (story) focusStory(story);
  });
  panel.querySelector('#director-start-reel')?.addEventListener('click', startReel);
  stopReelButton.addEventListener('click', stopReel);
  autoDocumentaryInput.addEventListener('change', () => {
    settings.autoDocumentary = autoDocumentaryInput.checked;
    saveSettings(settings);
  });
  narrationInput.addEventListener('change', () => {
    settings.narration = narrationInput.checked;
    saveSettings(settings);
    if (!settings.narration) window.speechSynthesis?.cancel();
  });
  quietInput.addEventListener('change', () => {
    settings.quietHours = quietInput.checked;
    saveSettings(settings);
  });
  paceInput.addEventListener('input', () => {
    settings.paceIndex = Math.max(0, Math.min(PACE_SECONDS.length - 1, Number(paceInput.value)));
    nextFocusAt = Date.now() + PACE_SECONDS[settings.paceIndex] * 1000;
    saveSettings(settings);
    renderState();
  });
  panel.addEventListener('click', (event) => {
    const storyButton = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-story-id]');
    if (!storyButton) return;
    const story = stories.find((candidate) => candidate.id === storyButton.dataset.storyId);
    if (story) focusStory(story);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() !== 'k' || event.ctrlKey || event.metaKey || event.altKey || (event.target as HTMLElement)?.matches('input, textarea')) return;
    setOpen(!open);
  });

  // Manual camera interaction immediately stops automatic direction.
  const canvas = document.querySelector<HTMLCanvasElement>('#world');
  const manualOverride = () => {
    if (!settings.enabled || activeReel) return;
    setEnabled(false);
  };
  canvas?.addEventListener('pointerdown', manualOverride, { capture: true });
  canvas?.addEventListener('wheel', manualOverride, { capture: true, passive: true });

  window.setInterval(() => {
    refreshEvidence();
    if (!settings.enabled || activeReel || Date.now() < nextFocusAt) return;
    const story = bestUnseenStory();
    if (story) focusStory(story);
    else nextFocusAt = Date.now() + PACE_SECONDS[settings.paceIndex] * 1000;
  }, 2_000);

  render();
  if (settings.enabled) setEnabled(true);
}
