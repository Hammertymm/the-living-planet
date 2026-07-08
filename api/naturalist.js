const MAX_EVIDENCE = 40;
const MAX_QUESTION_LENGTH = 280;
const MODEL = process.env.OPENAI_MODEL || 'gpt-5.4-mini';

const responseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['headline', 'narrative', 'confidence', 'evidenceIds', 'caveats'],
  properties: {
    headline: { type: 'string' },
    narrative: { type: 'string' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    evidenceIds: { type: 'array', items: { type: 'string' } },
    caveats: { type: 'array', items: { type: 'string' } },
  },
};

function reply(response, status, body) {
  response.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(body));
}

function sanitizeEvidence(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(-MAX_EVIDENCE).map((record) => ({
    id: String(record?.id ?? '').slice(0, 24),
    day: Number.isFinite(record?.day) ? Number(record.day) : null,
    region: typeof record?.region === 'string' ? record.region.slice(0, 80) : null,
    kind: typeof record?.kind === 'string' ? record.kind.slice(0, 40) : 'unknown',
    source: typeof record?.source === 'string' ? record.source.slice(0, 24) : 'unknown',
    summary: typeof record?.summary === 'string' ? record.summary.slice(0, 500) : '',
    values: record?.values && typeof record.values === 'object' ? record.values : null,
  })).filter((record) => record.id && record.summary);
}

function outputText(data) {
  for (const item of data?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') return content.text;
    }
  }
  return '';
}

export default async function handler(request, response) {
  if (request.method !== 'POST') return reply(response, 405, { error: 'POST required.' });
  if (!process.env.OPENAI_API_KEY) return reply(response, 503, { error: 'Cloud Naturalist is not configured.' });

  const question = typeof request.body?.question === 'string' ? request.body.question.trim().slice(0, MAX_QUESTION_LENGTH) : '';
  const evidence = sanitizeEvidence(request.body?.evidence);
  const world = {
    name: typeof request.body?.world?.name === 'string' ? request.body.world.name.slice(0, 80) : 'Unnamed world',
    seed: typeof request.body?.world?.seed === 'string' ? request.body.world.seed.slice(0, 32) : 'unknown',
  };

  if (!question) return reply(response, 400, { error: 'A question is required.' });
  if (!evidence.length) return reply(response, 400, { error: 'No grounded simulation evidence was supplied.' });

  const allowedIds = new Set(evidence.map((record) => record.id));

  try {
    const openaiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        store: false,
        reasoning: { effort: 'low' },
        input: [
          {
            role: 'system',
            content: [
              'You are the Naturalist for The Living Planet, a deterministic ecology simulation.',
              'Answer only from the supplied evidence ledger. Never invent an event, region, population, cause, number, species, or trend.',
              'Separate observation from inference. Use cautious language for causes unless the evidence explicitly states causation.',
              'Cite only supplied evidence IDs. If evidence is insufficient, say so directly and lower confidence.',
              'Write calm, precise nature-documentary prose in no more than 120 words.',
            ].join(' '),
          },
          {
            role: 'user',
            content: JSON.stringify({ world, question, evidence }),
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'grounded_naturalist_analysis',
            strict: true,
            schema: responseSchema,
          },
        },
      }),
    });

    const data = await openaiResponse.json();
    if (!openaiResponse.ok) {
      console.error('OpenAI error', data);
      return reply(response, 502, { error: 'The cloud model could not complete the analysis.' });
    }

    const raw = outputText(data);
    const parsed = JSON.parse(raw);
    const evidenceIds = Array.isArray(parsed.evidenceIds)
      ? parsed.evidenceIds.filter((id) => allowedIds.has(id)).slice(0, 10)
      : [];

    return reply(response, 200, {
      analysis: {
        headline: String(parsed.headline ?? 'Naturalist analysis').slice(0, 120),
        narrative: String(parsed.narrative ?? '').slice(0, 1_200),
        confidence: ['low', 'medium', 'high'].includes(parsed.confidence) ? parsed.confidence : 'low',
        evidenceIds,
        caveats: Array.isArray(parsed.caveats) ? parsed.caveats.map(String).slice(0, 4) : [],
        generatedBy: 'cloud',
        generatedAt: Date.now(),
      },
    });
  } catch (error) {
    console.error(error);
    return reply(response, 500, { error: 'Cloud analysis failed safely. The local Naturalist remains available.' });
  }
}
