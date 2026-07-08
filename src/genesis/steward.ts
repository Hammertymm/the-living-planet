import type { LivingPlanetBridge } from '../integration/bridge';
import { runCounterfactualExperiment, scenarioLabel } from '../science/counterfactual';
import type { ExperimentConfig, ExperimentResult, ExperimentScenario } from '../science/types';
import type { PlacementTool } from '../world/types';
import type { StewardCandidate, StewardObjective, StewardRecommendation } from './types';

const OBJECTIVE_LABELS: Record<StewardObjective, string> = {
  biodiversity: 'Increase biodiversity and trophic survival',
  'grazer-recovery': 'Recover grazer populations without destabilising predators',
  'predator-balance': 'Reduce boom-and-bust predator pressure',
  'drought-resilience': 'Improve resilience to dry periods',
  'soil-recovery': 'Restore fertility and decomposition',
};

const SCENARIO_TOOL: Partial<Record<ExperimentScenario, PlacementTool>> = {
  rainfall: 'rain',
  drought: 'drought',
  vegetation: 'plants',
  'grazer-introduction': 'grazers',
  'predator-introduction': 'predators',
  'fungal-bloom': 'fungi',
  fertility: 'fertility',
  wildfire: 'wildfire',
};

export function objectiveLabel(objective: StewardObjective): string {
  return OBJECTIVE_LABELS[objective];
}

export function candidatesFor(objective: StewardObjective, regionId: string): StewardCandidate[] {
  const scenarios: Record<StewardObjective, ExperimentScenario[]> = {
    biodiversity: ['rainfall', 'vegetation', 'fungal-bloom', 'fertility', 'grazer-introduction'],
    'grazer-recovery': ['vegetation', 'rainfall', 'fertility', 'grazer-introduction', 'predator-exclusion'],
    'predator-balance': ['vegetation', 'grazer-introduction', 'predator-exclusion', 'rainfall'],
    'drought-resilience': ['rainfall', 'vegetation', 'fertility', 'fungal-bloom'],
    'soil-recovery': ['fungal-bloom', 'fertility', 'vegetation', 'rainfall', 'wildfire'],
  };
  return scenarios[objective].map((scenario) => ({ scenario, regionId, label: scenarioLabel(scenario) }));
}

function score(result: ExperimentResult, objective: StewardObjective): number {
  const delta = result.deltas;
  const stability = result.intervention.meanStability - result.baseline.meanStability;
  const survival = result.intervention.survivalProbability;
  const diversity = result.intervention.meanDiversity - result.baseline.meanDiversity;

  if (objective === 'biodiversity') {
    return diversity * 80 + stability * 1.5 + survival.grazer * 0.12 + survival.predator * 0.1 + survival.fungi * 0.08;
  }
  if (objective === 'grazer-recovery') {
    return delta.grazer * 1.8 + delta.plant * 0.05 + stability * 1.4 - Math.max(0, delta.predator) * 0.4;
  }
  if (objective === 'predator-balance') {
    const grazerSafety = delta.grazer * 1.2;
    const predatorPenalty = Math.abs(delta.predator) * 0.28;
    return grazerSafety + stability * 2.2 + survival.predator * 0.1 - predatorPenalty;
  }
  if (objective === 'drought-resilience') {
    return delta.plant * 0.09 + delta.grazer * 1.1 + delta.fungi * 0.55 + stability * 2;
  }
  return delta.fungi * 1.2 + delta.plant * 0.08 + stability * 1.4 + survival.fungi * 0.12;
}

function reason(result: ExperimentResult, objective: StewardObjective): string {
  const stabilityDelta = Math.round((result.intervention.meanStability - result.baseline.meanStability) * 10) / 10;
  const parts: string[] = [];
  if (Math.abs(result.deltas.plant) >= 1) parts.push(`${result.deltas.plant > 0 ? '+' : ''}${Math.round(result.deltas.plant)} plants`);
  if (Math.abs(result.deltas.grazer) >= 1) parts.push(`${result.deltas.grazer > 0 ? '+' : ''}${Math.round(result.deltas.grazer)} grazers`);
  if (Math.abs(result.deltas.predator) >= 1) parts.push(`${result.deltas.predator > 0 ? '+' : ''}${Math.round(result.deltas.predator)} predators`);
  if (Math.abs(result.deltas.fungi) >= 1) parts.push(`${result.deltas.fungi > 0 ? '+' : ''}${Math.round(result.deltas.fungi)} fungi`);
  if (Math.abs(stabilityDelta) >= 0.5) parts.push(`${stabilityDelta > 0 ? '+' : ''}${stabilityDelta} stability`);
  return `${scenarioLabel(result.config.scenario)} ranked highest for “${objectiveLabel(objective)}” across the tested alternatives${parts.length ? `: ${parts.join(', ')}` : ''}.`;
}

export async function planStewardship(
  bridge: LivingPlanetBridge,
  objective: StewardObjective,
  regionId: string,
  onProgress: (completed: number, total: number, label: string) => void,
): Promise<StewardRecommendation[]> {
  const candidates = candidatesFor(objective, regionId);
  const snapshot = bridge.snapshot();
  const recommendations: StewardRecommendation[] = [];

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const config: ExperimentConfig = {
      scenario: candidate.scenario,
      regionId: candidate.regionId,
      horizon: 150,
      replicates: 1,
      radius: candidate.scenario === 'wildfire' ? 8 : 12,
    };
    const result = await runCounterfactualExperiment(snapshot, bridge.worldInfo().name, config, (done, total, label) => {
      onProgress(index + done / total, candidates.length, `${candidate.label}: ${label}`);
    });
    recommendations.push({
      objective,
      candidate,
      score: score(result, objective),
      reason: reason(result, objective),
      result,
    });
    onProgress(index + 1, candidates.length, `${candidate.label} complete`);
  }

  return recommendations.sort((a, b) => b.score - a.score);
}

export function canApplyRecommendation(recommendation: StewardRecommendation): boolean {
  return Boolean(SCENARIO_TOOL[recommendation.candidate.scenario]);
}

export function applyRecommendation(bridge: LivingPlanetBridge, recommendation: StewardRecommendation): boolean {
  const tool = SCENARIO_TOOL[recommendation.candidate.scenario];
  if (!tool) return false;
  const region = bridge.regions().find((candidate) => candidate.id === recommendation.candidate.regionId) ?? bridge.regions()[0];
  return bridge.intervene(tool, region.x, region.y, recommendation.result.config.radius, true);
}
