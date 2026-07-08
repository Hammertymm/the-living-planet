# Living Observatory Architecture

## Purpose

v3.0 turns observation into a closed evidence loop:

1. The deterministic simulation produces world state and events.
2. The Observatory samples that state at bounded intervals.
3. The Scientific Naturalist registers a measurable forecast.
4. Time advances normally in the live simulation.
5. The due forecast is resolved against later evidence.
6. Calibration reflects the accumulated record.
7. Documentary films present only located, recorded events and current subjects.

The Observatory does not own ecology and cannot advance or mutate the world directly.

## Modules

### `src/observatory/archive.ts`

Maintains a bounded, per-seed local archive of:

- population and landscape samples
- Chronicle-derived verified events
- predictions and outcomes

Sampling occurs no more frequently than every 30 simulated days unless a user explicitly requests an immediate capture.

### `src/observatory/predictor.ts`

Creates deterministic, falsifiable forecasts from:

- population trends
- current climate era
- group size and survival pressure
- active migration targets

Every forecast has a metric, direction, threshold and due day. Resolution is mechanical and does not rely on generated prose.

### `src/observatory/films.ts`

Constructs documentary arcs from archived events and current bridge summaries. Every shot carries an evidence reference. The module cannot invent a location or event.

### `src/observatory/bootstrap.ts`

Owns the Observatory interface, recording workflow, archive export and atmosphere controls. WebM recording uses the browser canvas stream when available.

### `src/render/renderer.ts`

Owns visual atmosphere and canvas captions. These effects are presentation-only and never enter `PlanetState`.

## Persistence

Observatory memory uses bounded local-storage records keyed by world seed. Full planets remain in IndexedDB through the existing World Library.

## Recording

Canvas recording is explicitly user-triggered. Captions are drawn into the same canvas so supported WebM exports contain both the planet view and evidence-backed text.

No audio track is created.

## Safety and truth constraints

- Forecasts do not script outcomes.
- A forecast can be refuted.
- Inconclusive evidence is reported as inconclusive.
- Documentaries use only recorded events and present-state subjects.
- Manual camera input terminates automatic direction.
- Atmosphere changes appearance only.
- Ambient audio is outside the v3.0 scope.
