# Intelligence Architecture

The Living Planet uses a layered intelligence model.

## Layer 1 — Deterministic ecology

The simulation owns terrain, climate, organisms, energy, reproduction, genetics, groups, lineages and history. This is the source of truth.

## Layer 2 — Grounded observation

Naturalist 2.0 collects verified metrics and recorded world events into an evidence ledger. Every analysis links to evidence IDs. Local analysis works offline.

## Layer 3 — Counterfactual science

The Science Lab clones deterministic world snapshots and compares matched alternative futures. Experiments never change the live planet.

## Layer 4 — Agentic stewardship

The Steward Planner runs several counterfactual experiments, scores them against a chosen objective and proposes a ranked plan. It cannot apply a recommendation without explicit user approval.

## Layer 5 — Optional cloud interpretation

A server-side Naturalist endpoint may convert bounded evidence into richer prose. API credentials remain server-side. Failure falls back to local analysis.

## Non-negotiable constraints

- No AI call occurs on every simulation tick.
- No model may fabricate an ecological event.
- No browser code contains a secret API key.
- No agent silently alters the live world.
- Causal claims remain cautious unless supported by controlled experiments.
- The app remains usable offline without cloud intelligence.

## v2.3 individual grounding

The internal bridge now exposes bounded notable individual summaries. Future Naturalist and documentary reasoning may reference those lives, but names, roles, events and survival outcomes remain simulation-generated evidence.
