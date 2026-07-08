import type { AskRequest, NaturalistAnalysis } from './types';

const REQUEST_TIMEOUT_MS = 25_000;

export class CloudNaturalistError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
  }
}

export async function askCloudNaturalist(request: AskRequest): Promise<NaturalistAnalysis> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch('/api/naturalist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    const body = await response.json().catch(() => null) as { analysis?: NaturalistAnalysis; error?: string } | null;
    if (!response.ok || !body?.analysis) {
      throw new CloudNaturalistError(body?.error ?? `Cloud Naturalist returned ${response.status}.`, response.status);
    }

    return { ...body.analysis, generatedBy: 'cloud', generatedAt: Date.now() };
  } catch (error) {
    if (error instanceof CloudNaturalistError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') throw new CloudNaturalistError('Cloud analysis timed out.');
    throw new CloudNaturalistError('Cloud analysis is unavailable.');
  } finally {
    window.clearTimeout(timeout);
  }
}
