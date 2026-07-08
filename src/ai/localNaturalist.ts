import type { EvidenceRecord, NaturalistAnalysis } from './types';

const POPULATION_LABELS: Record<string, string> = {
  plants: 'plant cover',
  grazers: 'grazer population',
  predators: 'predator population',
  scavengers: 'scavenger population',
  fungi: 'fungal activity',
};

interface Snapshot {
  record: EvidenceRecord;
  values: Record<string, number | string | boolean | null>;
}

function snapshots(records: EvidenceRecord[]): Snapshot[] {
  return records
    .filter((record) => record.kind === 'metric_snapshot' && record.values)
    .map((record) => ({ record, values: record.values! }));
}

function latestValue(snapshot: Snapshot | undefined, key: string): number | undefined {
  const value = snapshot?.values[key];
  return typeof value === 'number' ? value : undefined;
}

function trend(before: number | undefined, after: number | undefined): string | undefined {
  if (before === undefined || after === undefined || before === after) return undefined;
  const delta = after - before;
  const percent = before === 0 ? 100 : Math.round((delta / before) * 100);
  const direction = delta > 0 ? 'up' : 'down';
  return `${direction} ${Math.abs(percent)}% (${before.toLocaleString()} → ${after.toLocaleString()})`;
}

function recentIds(records: EvidenceRecord[], limit = 6): string[] {
  return records.slice(-limit).map((record) => record.id);
}

function result(
  headline: string,
  narrative: string,
  evidence: EvidenceRecord[],
  caveats: string[] = [],
  confidence: NaturalistAnalysis['confidence'] = evidence.length >= 4 ? 'high' : evidence.length >= 2 ? 'medium' : 'low',
): NaturalistAnalysis {
  return {
    headline,
    narrative,
    confidence,
    evidenceIds: recentIds(evidence),
    caveats,
    generatedBy: 'local',
    generatedAt: Date.now(),
  };
}

function latestEvent(records: EvidenceRecord[]): EvidenceRecord | undefined {
  return [...records].reverse().find((record) => record.kind !== 'metric_snapshot');
}

function populationQuestion(question: string): string | undefined {
  const lower = question.toLowerCase();
  if (/plant|vegetation|forest|grass/.test(lower)) return 'plants';
  if (/grazer|herbivore|herd/.test(lower)) return 'grazers';
  if (/predator|pack|wolf/.test(lower)) return 'predators';
  if (/scavenger/.test(lower)) return 'scavengers';
  if (/fung|decompos/.test(lower)) return 'fungi';
  return undefined;
}

export function analyzeLocally(question: string, records: EvidenceRecord[]): NaturalistAnalysis {
  const evidence = records.slice(-60);
  if (evidence.length === 0) {
    return result(
      'Observation not yet possible',
      'The intelligence layer has not collected enough evidence. Let the planet run for several simulated days, then ask again.',
      [],
      ['No simulation evidence has been captured yet.'],
      'low',
    );
  }

  const lower = question.toLowerCase();
  const allSnapshots = snapshots(evidence);
  const current = allSnapshots[allSnapshots.length - 1];
  const previous = allSnapshots.length > 1 ? allSnapshots[Math.max(0, allSnapshots.length - 4)] : undefined;
  const population = populationQuestion(question);

  if (/what changed|recent|happened|latest/.test(lower)) {
    const changes = evidence.filter((record) => ['population_change', 'extinction', 'recovery', 'world_event', 'climate_signal'].includes(record.kind)).slice(-5);
    const lines = changes.length ? changes.map((record) => record.summary) : [latestEvent(evidence)?.summary ?? current?.record.summary ?? 'No significant change has been detected.'];
    return result('Recent changes', lines.join(' '), changes.length ? changes : evidence.slice(-2));
  }

  if (/stable|stability|balance|healthy|collapse/.test(lower)) {
    const tracked = ['plants', 'grazers', 'predators', 'scavengers', 'fungi'];
    const movements = tracked
      .map((key) => ({ key, value: trend(latestValue(previous, key), latestValue(current, key)) }))
      .filter((entry) => entry.value);
    const extinctions = evidence.filter((record) => record.kind === 'extinction');
    const sharpChanges = evidence.filter((record) => record.kind === 'population_change').slice(-8);
    const stable = extinctions.length === 0 && sharpChanges.length <= 2;
    const detail = movements.length
      ? movements.map((entry) => `${POPULATION_LABELS[entry.key]} is ${entry.value}`).join('; ')
      : 'recent population snapshots show little measurable movement';
    return result(
      stable ? 'The ecosystem is comparatively stable' : 'The ecosystem is under visible pressure',
      `${detail}. ${extinctions.length ? `${extinctions.length} trophic role loss event${extinctions.length === 1 ? '' : 's'} appears in the recent evidence.` : 'No recent trophic role has fallen to zero.'}`,
      [...sharpChanges.slice(-4), ...extinctions.slice(-2), ...(current ? [current.record] : [])],
      ['This is a short-window assessment, not a prediction of long-term equilibrium.'],
    );
  }

  if (population) {
    const before = latestValue(previous, population);
    const after = latestValue(current, population);
    const relevant = evidence.filter((record) => record.values?.population === population || record.summary.toLowerCase().includes(population.slice(0, -1))).slice(-8);
    const environmental = evidence.filter((record) => ['climate_signal', 'world_event'].includes(record.kind)).slice(-5);
    const movement = trend(before, after);
    const associated = environmental.length ? ` Recent associated events include: ${environmental.map((record) => record.summary).join(' ')}` : '';
    return result(
      `${POPULATION_LABELS[population][0].toUpperCase()}${POPULATION_LABELS[population].slice(1)} assessment`,
      movement
        ? `The recorded ${POPULATION_LABELS[population]} is ${movement}.${associated}`
        : `The available snapshots do not show a strong recent change in ${POPULATION_LABELS[population]}.${associated}`,
      [...relevant, ...environmental, ...(current ? [current.record] : [])].slice(-8),
      ['Association does not prove causation; a counterfactual simulation would be needed to isolate the cause.'],
    );
  }

  if (/region|where|active|location/.test(lower)) {
    const regional = evidence.filter((record) => record.region);
    const counts = new Map<string, number>();
    for (const record of regional) counts.set(record.region!, (counts.get(record.region!) ?? 0) + 1);
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (ranked.length === 0) {
      return result('No regional concentration detected', 'Recent evidence does not identify a named region strongly enough to rank current activity.', evidence.slice(-4), ['Some simulation events do not carry a region label.'], 'low');
    }
    const [region, count] = ranked[0];
    const regionEvidence = regional.filter((record) => record.region === region).slice(-5);
    return result('Most active named region', `${region} appears most often in the recent evidence, with ${count} recorded observation${count === 1 ? '' : 's'}. ${regionEvidence.map((record) => record.summary).join(' ')}`, regionEvidence);
  }

  const latest = latestEvent(evidence);
  const currentSummary = current?.record.summary;
  return result(
    latest ? 'Current naturalist assessment' : 'Current world state',
    [currentSummary, latest?.summary].filter(Boolean).join(' '),
    [current?.record, latest].filter((record): record is EvidenceRecord => Boolean(record)),
    ['Ask a more specific question for a population, region, recent change or stability assessment.'],
  );
}

export function observationFromEvidence(record: EvidenceRecord, records: EvidenceRecord[]): NaturalistAnalysis | undefined {
  if (!['population_change', 'extinction', 'recovery', 'world_event', 'climate_signal'].includes(record.kind)) return undefined;
  const related = records.filter((candidate) => candidate.id === record.id || (record.region && candidate.region === record.region)).slice(-5);

  if (record.kind === 'extinction') {
    return result('A trophic role has disappeared', `${record.summary} The planet may now enter a recovery period or reorganise around the missing role.`, related, ['The system may automatically recover a lost role when resources permit.'], 'high');
  }
  if (record.kind === 'recovery') {
    return result('Ecological recovery detected', `${record.summary} This is a measured return, though persistence is not yet guaranteed.`, related, ['A short-lived recovery may still reverse.'], 'high');
  }
  return result(record.region ? `Change in ${record.region}` : 'Meaningful change detected', record.summary, related, [], related.length >= 2 ? 'high' : 'medium');
}
