import type { LivingPlanetBridge } from '../integration/bridge';
import type { Region, Species } from '../world/types';
import { ObservatoryArchive } from './archive';
import type { NaturalistPrediction, ObservatorySample, PredictionDirection, PredictionStatus } from './types';

const TRACKED: Species[] = ['plant', 'grazer', 'predator', 'scavenger', 'fungi'];
const LABELS: Record<Species, string> = {
  plant: 'plant cover',
  grazer: 'grazer population',
  predator: 'predator population',
  scavenger: 'scavenger population',
  fungi: 'fungal network',
  carrion: 'carrion',
};

function nearestRegion(regions: Region[], x: number, y: number): Region | undefined {
  let selected: Region | undefined;
  let distance = Infinity;
  for (const region of regions) {
    const candidate = Math.hypot(region.x - x, region.y - y);
    if (candidate >= distance) continue;
    distance = candidate;
    selected = region;
  }
  return selected;
}

function confidenceFor(samples: number, strength: number): NaturalistPrediction['confidence'] {
  if (samples >= 5 && strength >= 22) return 'high';
  if (samples >= 3 && strength >= 10) return 'medium';
  return 'low';
}

function directionLabel(direction: PredictionDirection): string {
  if (direction === 'increase') return 'increase';
  if (direction === 'decrease') return 'decline';
  if (direction === 'stable') return 'remain broadly stable';
  if (direction === 'survive') return 'remain extant';
  if (direction === 'decline') return 'lose members';
  return 'reach its destination';
}

function metricValue(sample: ObservatorySample | undefined, metric?: string): number | undefined {
  if (!sample || !metric) return undefined;
  if (metric.startsWith('population:')) {
    const species = metric.slice('population:'.length) as Species;
    return sample.counts[species];
  }
  if (metric === 'meanWater') return sample.meanWater;
  if (metric === 'meanVegetation') return sample.meanVegetation;
  if (metric === 'meanMoisture') return sample.meanMoisture;
  if (metric === 'activeLineages') return sample.activeLineages;
  return undefined;
}

function outcomeStatus(expected: PredictionDirection, baseline: number, actual: number, threshold: number): { status: PredictionStatus; score: number } {
  const change = baseline === 0 ? (actual === 0 ? 0 : 100) : (actual - baseline) / Math.abs(baseline) * 100;
  if (expected === 'increase') {
    if (change >= threshold) return { status: 'confirmed', score: 1 };
    if (change > 0) return { status: 'partly-confirmed', score: 0.5 };
    return { status: 'refuted', score: 0 };
  }
  if (expected === 'decrease') {
    if (change <= -threshold) return { status: 'confirmed', score: 1 };
    if (change < 0) return { status: 'partly-confirmed', score: 0.5 };
    return { status: 'refuted', score: 0 };
  }
  if (expected === 'stable') {
    if (Math.abs(change) <= threshold) return { status: 'confirmed', score: 1 };
    if (Math.abs(change) <= threshold * 1.75) return { status: 'partly-confirmed', score: 0.5 };
    return { status: 'refuted', score: 0 };
  }
  return { status: 'inconclusive', score: 0 };
}

export function generatePredictions(bridge: LivingPlanetBridge, archive: ObservatoryArchive, horizon = 180): NaturalistPrediction[] {
  archive.capture(true);
  const world = bridge.worldInfo();
  const snapshot = bridge.snapshot();
  const samples = archive.samplesSince(Math.max(0, world.day - 240));
  const predictions: NaturalistPrediction[] = [];
  const existing = archive.allPredictions().filter((prediction) => prediction.status === 'pending');
  const hasSubject = (kind: NaturalistPrediction['kind'], subjectLabel: string) => existing.some((prediction) => prediction.kind === kind && prediction.subjectLabel === subjectLabel);

  const trends = TRACKED.map((species) => ({ species, trend: archive.populationTrend(species, 180) }))
    .filter((entry): entry is { species: Species; trend: NonNullable<ReturnType<ObservatoryArchive['populationTrend']>> } => Boolean(entry.trend))
    .sort((a, b) => Math.abs(b.trend.percent) - Math.abs(a.trend.percent));

  const strongest = trends[0];
  if (strongest && !hasSubject('population', LABELS[strongest.species])) {
    const strength = Math.abs(strongest.trend.percent);
    const direction: PredictionDirection = strength < 7 ? 'stable' : strongest.trend.percent > 0 ? 'increase' : 'decrease';
    predictions.push({
      id: archive.nextPredictionId(),
      worldSeed: world.seed,
      createdDay: world.day,
      dueDay: world.day + horizon,
      kind: 'population',
      headline: `${LABELS[strongest.species][0].toUpperCase()}${LABELS[strongest.species].slice(1)} forecast`,
      statement: `Over the next ${horizon} days, the ${LABELS[strongest.species]} is expected to ${directionLabel(direction)}.`,
      rationale: `The most recent ${Math.min(240, world.day)}-day evidence window moved from ${strongest.trend.before.toLocaleString()} to ${strongest.trend.after.toLocaleString()} (${strongest.trend.percent > 0 ? '+' : ''}${Math.round(strongest.trend.percent)}%).`,
      confidence: confidenceFor(samples.length, strength),
      status: 'pending',
      subjectLabel: LABELS[strongest.species],
      metric: `population:${strongest.species}`,
      direction,
      baselineValue: strongest.trend.after,
      threshold: direction === 'stable' ? 12 : 8,
      evidence: [
        `Day ${Math.max(0, world.day - 180)}–${world.day} population trend`,
        `${strongest.trend.before.toLocaleString()} → ${strongest.trend.after.toLocaleString()}`,
      ],
    });
  }

  const era = snapshot.state.climateEra;
  const climateMetric = era.kind === 'wet' ? 'meanWater' : era.kind === 'dry' || era.kind === 'fire' ? 'meanWater' : 'meanVegetation';
  const baselineClimate = metricValue(archive.latestSample(), climateMetric);
  if (baselineClimate !== undefined && !hasSubject('climate-response', era.name)) {
    const direction: PredictionDirection = era.kind === 'wet'
      ? 'increase'
      : era.kind === 'dry' || era.kind === 'fire'
        ? 'decrease'
        : 'stable';
    const metricLabel = climateMetric === 'meanWater' ? 'surface water' : 'landscape vegetation';
    predictions.push({
      id: archive.nextPredictionId(),
      worldSeed: world.seed,
      createdDay: world.day,
      dueDay: Math.min(world.day + horizon, Math.max(world.day + 60, era.expectedEndDay)),
      kind: 'climate-response',
      headline: `${era.name} response`,
      statement: `${metricLabel[0].toUpperCase()}${metricLabel.slice(1)} is expected to ${directionLabel(direction)} while this climate era remains active.`,
      rationale: `${era.name} is a ${era.kind} era with intensity ${Math.round(era.intensity * 100)}%. The forecast measures a planetary mean rather than a single region.`,
      confidence: era.intensity > 0.72 ? 'high' : 'medium',
      status: 'pending',
      subjectLabel: era.name,
      metric: climateMetric,
      direction,
      baselineValue: baselineClimate,
      threshold: 6,
      evidence: [`Climate era: ${era.name}`, `Era kind: ${era.kind}`, `Intensity: ${Math.round(era.intensity * 100)}%`],
    });
  }

  const groups = bridge.groups().filter((group) => group.species === 'grazer').sort((a, b) => a.members - b.members);
  const vulnerable = groups[0];
  if (vulnerable && !hasSubject('group-survival', vulnerable.name)) {
    const direction: PredictionDirection = vulnerable.members <= 5 ? 'decline' : 'survive';
    predictions.push({
      id: archive.nextPredictionId(),
      worldSeed: world.seed,
      createdDay: world.day,
      dueDay: world.day + horizon,
      kind: 'group-survival',
      headline: `${vulnerable.name} viability`,
      statement: `${vulnerable.name} is expected to ${directionLabel(direction)} over the next ${horizon} days.`,
      rationale: `It is currently the smallest recorded grazer group with ${vulnerable.members} members. Small herds are more exposed to predation, drought and reproductive failure.`,
      confidence: vulnerable.members <= 4 || vulnerable.members >= 12 ? 'medium' : 'low',
      status: 'pending',
      subjectId: vulnerable.id,
      subjectLabel: vulnerable.name,
      direction,
      baselineValue: vulnerable.members,
      threshold: 2,
      evidence: [`Current group size: ${vulnerable.members}`, `Smallest grazer group on day ${world.day}`],
    });
  }

  const migrating = snapshot.state.groups.find((group) => {
    const summary = bridge.groups().find((candidate) => candidate.id === group.id);
    const currentRegion = summary ? nearestRegion(snapshot.state.regions, summary.x, summary.y) : undefined;
    return currentRegion && currentRegion.id !== group.targetRegionId;
  });
  if (migrating && !hasSubject('migration', migrating.name)) {
    const target = snapshot.state.regions.find((region) => region.id === migrating.targetRegionId);
    predictions.push({
      id: archive.nextPredictionId(),
      worldSeed: world.seed,
      createdDay: world.day,
      dueDay: world.day + Math.min(horizon, 150),
      kind: 'migration',
      headline: `${migrating.name} migration`,
      statement: `${migrating.name} is expected to reach the ${target?.name ?? 'target region'} within ${Math.min(horizon, 150)} days.`,
      rationale: `The group has an active target outside its current named region. This is a movement forecast, not a guarantee that the destination will remain favourable.`,
      confidence: 'medium',
      status: 'pending',
      subjectId: migrating.id,
      subjectLabel: migrating.name,
      targetRegionId: migrating.targetRegionId,
      direction: 'arrive',
      evidence: [`Target region: ${target?.name ?? migrating.targetRegionId}`, `Route changed before day ${world.day}`],
    });
  }

  return predictions.slice(0, 4);
}

export function resolvePredictions(bridge: LivingPlanetBridge, archive: ObservatoryArchive): NaturalistPrediction[] {
  archive.capture(true);
  const world = bridge.worldInfo();
  const snapshot = bridge.snapshot();
  const resolved: NaturalistPrediction[] = [];

  for (const original of archive.allPredictions()) {
    if (original.status !== 'pending' || original.dueDay > world.day) continue;
    const prediction: NaturalistPrediction = { ...original, evidence: [...original.evidence] };
    prediction.resolvedDay = world.day;

    if (prediction.kind === 'population' || prediction.kind === 'climate-response') {
      const sample = archive.sampleAtOrAfter(prediction.dueDay);
      const actual = metricValue(sample, prediction.metric);
      if (actual === undefined || prediction.baselineValue === undefined) {
        prediction.status = 'inconclusive';
        prediction.score = 0;
        prediction.outcome = 'The required metric was not available at the resolution date.';
      } else {
        const result = outcomeStatus(prediction.direction, prediction.baselineValue, actual, prediction.threshold ?? 8);
        const percent = prediction.baselineValue === 0 ? 0 : (actual - prediction.baselineValue) / Math.abs(prediction.baselineValue) * 100;
        prediction.status = result.status;
        prediction.score = result.score;
        prediction.outcome = `Observed ${prediction.metric?.replace('population:', '') ?? 'metric'} changed from ${prediction.baselineValue.toFixed(2)} to ${actual.toFixed(2)} (${percent > 0 ? '+' : ''}${Math.round(percent)}%).`;
        prediction.evidence.push(`Resolved against day ${sample?.day ?? world.day} sample`);
      }
    } else if (prediction.kind === 'group-survival') {
      const group = bridge.groups().find((candidate) => candidate.id === prediction.subjectId);
      const actual = group?.members ?? 0;
      const baseline = prediction.baselineValue ?? 0;
      if (prediction.direction === 'survive') {
        prediction.status = actual > 0 ? (actual >= Math.max(2, baseline - 2) ? 'confirmed' : 'partly-confirmed') : 'refuted';
      } else {
        prediction.status = actual <= Math.max(0, baseline - (prediction.threshold ?? 2)) ? 'confirmed' : actual < baseline ? 'partly-confirmed' : 'refuted';
      }
      prediction.score = prediction.status === 'confirmed' ? 1 : prediction.status === 'partly-confirmed' ? 0.5 : 0;
      prediction.outcome = group ? `${group.name} has ${group.members} living members.` : `${prediction.subjectLabel} is no longer present in the Living Registry.`;
    } else if (prediction.kind === 'migration') {
      const group = bridge.groups().find((candidate) => candidate.id === prediction.subjectId);
      if (!group) {
        prediction.status = 'refuted';
        prediction.score = 0;
        prediction.outcome = `${prediction.subjectLabel} disappeared before reaching the forecast destination.`;
      } else {
        const currentRegion = nearestRegion(snapshot.state.regions, group.x, group.y);
        prediction.status = currentRegion?.id === prediction.targetRegionId ? 'confirmed' : 'refuted';
        prediction.score = prediction.status === 'confirmed' ? 1 : 0;
        prediction.outcome = `${prediction.subjectLabel} is currently in ${currentRegion?.name ?? 'an unclassified area'}.`;
      }
    }

    archive.updatePrediction(prediction);
    resolved.push(prediction);
  }
  return resolved;
}

export function predictionAccuracy(predictions: NaturalistPrediction[]): { resolved: number; score: number; label: string } {
  const resolved = predictions.filter((prediction) => prediction.status !== 'pending' && prediction.status !== 'inconclusive');
  if (!resolved.length) return { resolved: 0, score: 0, label: 'Uncalibrated' };
  const weight = (prediction: NaturalistPrediction) => prediction.confidence === 'high' ? 3 : prediction.confidence === 'medium' ? 2 : 1;
  const totalWeight = resolved.reduce((sum, prediction) => sum + weight(prediction), 0);
  const score = resolved.reduce((sum, prediction) => sum + (prediction.score ?? 0) * weight(prediction), 0) / Math.max(1, totalWeight) * 100;
  const label = score >= 78 ? 'Well calibrated' : score >= 58 ? 'Developing calibration' : 'Needs more evidence';
  return { resolved: resolved.length, score, label };
}
