import {
  captureSimulationCounters,
  restoreSimulationCounters,
  Simulation,
} from '../engine/simulation';
import type { PlacementTool, SimulationSnapshot, Species } from '../world/types';
import type {
  AggregateOutcome,
  BranchOutcome,
  ExperimentConfig,
  ExperimentResult,
  ExperimentScenario,
  PopulationVector,
} from './types';

const POPULATIONS: (keyof PopulationVector)[] = ['plant', 'grazer', 'predator', 'scavenger', 'fungi', 'carrion'];
const SOCIAL: ('grazer' | 'predator' | 'scavenger' | 'fungi')[] = ['grazer', 'predator', 'scavenger', 'fungi'];

const SCENARIO_LABELS: Record<ExperimentScenario, string> = {
  rainfall: 'Sustained rainfall',
  drought: 'Extended drought',
  vegetation: 'Vegetation restoration',
  'grazer-introduction': 'Grazer introduction',
  'predator-introduction': 'Predator introduction',
  'predator-exclusion': 'Predator exclusion',
  'fungal-bloom': 'Fungal bloom',
  fertility: 'Soil fertility restoration',
  wildfire: 'Wildfire disturbance',
};

function vector(counts: Record<Species, number>): PopulationVector {
  return {
    plant: counts.plant,
    grazer: counts.grazer,
    predator: counts.predator,
    scavenger: counts.scavenger,
    fungi: counts.fungi,
    carrion: counts.carrion,
  };
}

function emptyVector(): PopulationVector {
  return { plant: 0, grazer: 0, predator: 0, scavenger: 0, fungi: 0, carrion: 0 };
}

function cloneSnapshot(snapshot: SimulationSnapshot, rngSalt: number): SimulationSnapshot {
  const cloned = structuredClone(snapshot);
  cloned.rngState = (cloned.rngState + Math.imul(rngSalt + 1, 2654435761)) >>> 0;
  return cloned;
}

function mean(values: number[]): number {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function standardDeviation(values: number[]): number {
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

function diversityScore(population: PopulationVector): number {
  return ['plant', 'grazer', 'predator', 'scavenger', 'fungi'].filter((key) => population[key as keyof PopulationVector] > 0).length;
}

function scenarioTool(scenario: ExperimentScenario): PlacementTool | undefined {
  const tools: Partial<Record<ExperimentScenario, PlacementTool>> = {
    rainfall: 'rain',
    drought: 'drought',
    vegetation: 'plants',
    'grazer-introduction': 'grazers',
    'predator-introduction': 'predators',
    'fungal-bloom': 'fungi',
    fertility: 'fertility',
    wildfire: 'wildfire',
  };
  return tools[scenario];
}

function applyScenario(simulation: Simulation, config: ExperimentConfig, elapsedDay: number): void {
  const region = simulation.state.regions.find((candidate) => candidate.id === config.regionId) ?? simulation.state.regions[0];
  if (config.scenario === 'predator-exclusion') {
    const radiusSquared = (config.radius * 2.2) ** 2;
    simulation.state.entities = simulation.state.entities.filter((entity) => {
      if (entity.species !== 'predator') return true;
      const dx = entity.x - region.x;
      const dy = entity.y - region.y;
      return dx * dx + dy * dy > radiusSquared;
    });
    return;
  }

  const tool = scenarioTool(config.scenario);
  if (!tool) return;

  const repeating = config.scenario === 'rainfall' || config.scenario === 'drought' || config.scenario === 'fertility';
  if (elapsedDay === 0 || (repeating && elapsedDay % 60 === 0)) {
    simulation.interveneAt(tool, region.x, region.y, config.radius, false);
  }
}

async function yieldToBrowser(): Promise<void> {
  await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
}

async function runBranch(
  source: SimulationSnapshot,
  config: ExperimentConfig,
  replicate: number,
  intervention: boolean,
  onProgress: (fraction: number) => void,
): Promise<BranchOutcome> {
  const simulation = new Simulation(source.state.seed);
  simulation.restore(cloneSnapshot(source, replicate * 101 + (intervention ? 17 : 0)));
  const start = vector(simulation.counts());
  const minimums = { ...start };
  const maximums = { ...start };
  const samples: PopulationVector[] = [];

  for (let day = 0; day < config.horizon; day += 1) {
    if (intervention) applyScenario(simulation, config, day);
    simulation.step();

    if (day % 15 === 0 || day === config.horizon - 1) {
      const current = vector(simulation.counts());
      samples.push(current);
      for (const key of POPULATIONS) {
        minimums[key] = Math.min(minimums[key], current[key]);
        maximums[key] = Math.max(maximums[key], current[key]);
      }
    }

    if (day % 24 === 0) {
      onProgress((day + 1) / config.horizon);
      await yieldToBrowser();
    }
  }

  const end = vector(simulation.counts());
  const extinctionSpecies = (['plant', 'grazer', 'predator', 'scavenger', 'fungi'] as Species[])
    .filter((species) => start[species] > 0 && minimums[species] === 0);
  const trackedStability = ['grazer', 'predator', 'plant'].map((key) => {
    const series = samples.map((sample) => sample[key as keyof PopulationVector]);
    const average = Math.max(1, mean(series));
    return Math.max(0, 100 - (standardDeviation(series) / average) * 100);
  });

  return {
    replicate,
    start,
    end,
    minimums,
    maximums,
    extinctions: extinctionSpecies,
    diversity: diversityScore(end),
    stability: round(mean(trackedStability)),
  };
}

function aggregate(outcomes: BranchOutcome[]): AggregateOutcome {
  const end = emptyVector();
  const low = emptyVector();
  const high = emptyVector();

  for (const key of POPULATIONS) {
    const values = outcomes.map((outcome) => outcome.end[key]);
    end[key] = round(mean(values));
    low[key] = Math.min(...values);
    high[key] = Math.max(...values);
  }

  const survivalProbability = {
    grazer: 0,
    predator: 0,
    scavenger: 0,
    fungi: 0,
  };
  for (const species of SOCIAL) {
    survivalProbability[species] = round(mean(outcomes.map((outcome) => outcome.end[species] > 0 ? 100 : 0)));
  }

  return {
    end,
    low,
    high,
    survivalProbability,
    meanDiversity: round(mean(outcomes.map((outcome) => outcome.diversity))),
    meanStability: round(mean(outcomes.map((outcome) => outcome.stability))),
  };
}

function describeDelta(label: string, value: number): string | undefined {
  if (Math.abs(value) < 1) return undefined;
  return `${label} ${value > 0 ? 'increased' : 'decreased'} by ${Math.abs(Math.round(value)).toLocaleString()} relative to the matched baseline`;
}

function interpretation(config: ExperimentConfig, baseline: AggregateOutcome, intervention: AggregateOutcome, deltas: PopulationVector): string {
  const statements = [
    describeDelta('Plant abundance', deltas.plant),
    describeDelta('Grazer abundance', deltas.grazer),
    describeDelta('Predator abundance', deltas.predator),
    describeDelta('Fungal activity', deltas.fungi),
  ].filter((value): value is string => Boolean(value));

  const stabilityDelta = intervention.meanStability - baseline.meanStability;
  if (Math.abs(stabilityDelta) >= 2) {
    statements.push(`short-window stability was ${stabilityDelta > 0 ? 'higher' : 'lower'} by ${Math.abs(round(stabilityDelta))} points`);
  }

  if (!statements.length) {
    return `${SCENARIO_LABELS[config.scenario]} produced no strong separation from the matched baseline over ${config.horizon} simulated days.`;
  }
  return `${SCENARIO_LABELS[config.scenario]} produced a measurable alternative trajectory: ${statements.join('; ')}. This is a simulated comparison, not proof that the same intervention will behave identically in every future state.`;
}

export async function runCounterfactualExperiment(
  snapshot: SimulationSnapshot,
  worldName: string,
  config: ExperimentConfig,
  onProgress: (completed: number, total: number, label: string) => void,
): Promise<ExperimentResult> {
  const counterGuard = captureSimulationCounters();
  const baselineRuns: BranchOutcome[] = [];
  const interventionRuns: BranchOutcome[] = [];
  const total = config.replicates * 2;
  let completed = 0;

  try {
    for (let replicate = 0; replicate < config.replicates; replicate += 1) {
      const baseline = await runBranch(snapshot, config, replicate, false, (fraction) => {
        onProgress(completed + fraction, total, `Baseline run ${replicate + 1} of ${config.replicates}`);
      });
      baselineRuns.push(baseline);
      completed += 1;
      onProgress(completed, total, `Baseline run ${replicate + 1} complete`);

      const intervention = await runBranch(snapshot, config, replicate, true, (fraction) => {
        onProgress(completed + fraction, total, `Alternative run ${replicate + 1} of ${config.replicates}`);
      });
      interventionRuns.push(intervention);
      completed += 1;
      onProgress(completed, total, `Alternative run ${replicate + 1} complete`);
    }
  } finally {
    restoreSimulationCounters(counterGuard);
  }

  const baseline = aggregate(baselineRuns);
  const intervention = aggregate(interventionRuns);
  const deltas = emptyVector();
  for (const key of POPULATIONS) deltas[key] = round(intervention.end[key] - baseline.end[key]);
  const region = snapshot.state.regions.find((candidate) => candidate.id === config.regionId) ?? snapshot.state.regions[0];

  return {
    id: `X-${Date.now().toString(36).toUpperCase()}`,
    createdAt: Date.now(),
    worldName,
    startDay: snapshot.state.day,
    endDay: snapshot.state.day + config.horizon,
    regionId: region.id,
    regionName: region.name,
    config,
    baseline,
    intervention,
    deltas,
    interpretation: interpretation(config, baseline, intervention, deltas),
    confidence: config.replicates >= 3 ? 'moderate' : 'exploratory',
    runs: { baseline: baselineRuns, intervention: interventionRuns },
  };
}

export function scenarioLabel(scenario: ExperimentScenario): string {
  return SCENARIO_LABELS[scenario];
}
