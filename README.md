# The Living Planet v2.0 — Genesis

A browser-based living ecosystem designed to be watched, explored, questioned and gently influenced.

The Living Planet combines a deterministic ecology simulation with a grounded intelligence layer. Weather, plants, fungi, grazers, predators, scavengers, social groups, genetic lineages and landscape memory evolve from the simulation. AI and analytical systems may interpret or compare those outcomes, but they do not invent the planet's reality.

## What v2.0 adds

### Genetic evolution

Every living entity now carries an inherited genome containing:

- Speed
- Metabolism
- Fertility
- Perception
- Environmental resilience
- Cooperation
- Camouflage

Traits affect movement, energy use, reproduction, group cohesion, hunting success, escape and lifespan. Offspring inherit mutated traits. Long-lived populations can diverge into named descendant lineages, while extinct branches remain in the record.

Use the new **Lineages** map or open **Genesis → Evolution** to inspect living and extinct branches.

### Planetary memory

The short Chronicle remains useful for recent events. The new long-term archive records:

- Major ecological events
- Lineage origins and extinctions
- Named eras every 360 simulated days
- Long-term regional history
- Historical context beyond the Chronicle limit

Memory is stored locally per world seed.

### World Composer

Describe a world in plain language, preview the deterministic recipe, then approve its creation.

Examples:

- A dry migration world with scarce water and large grazer herds
- A fungal rainforest with heavy rain and rich decomposer networks
- A volcanic recovery landscape with ash-rich soil and pioneer plants
- A balanced sanctuary with wetlands and resilient food webs

The Composer archives the current world before creating another. It shapes ecological starting conditions; it does not pretend to generate arbitrary terrain geometry that the current terrain engine cannot support.

### Steward Planner

The Steward is an approval-gated simulation agent.

1. Select an ecological objective.
2. Select a region.
3. The Steward forks the current world.
4. It runs multiple matched alternative futures.
5. It ranks interventions by the chosen objective.
6. Nothing changes in the live world until you approve a recommendation.

Objectives include biodiversity, grazer recovery, predator balance, drought resilience and soil recovery.

### Science and documentary systems retained

- Counterfactual Ecology Lab
- Matched baseline and intervention futures
- Documentary Director and Story Reel
- Grounded Naturalist 2.0
- Optional secure cloud Naturalist
- Evidence ledger with traceable evidence IDs
- Named regions, herds, packs and scavenger colonies
- Climate fronts, seasons, wildfire and succession
- IndexedDB world saves, autosave, export and import

## Run locally

```powershell
cd C:\Projects\the-living-planet
npm install
npm run check
npm run check:api
npm run build
npm run dev
```

Open the local address printed by Vite, normally:

```text
http://localhost:5173
```

## Upgrade an existing copy

1. Stop Vite with `Ctrl+C`.
2. Extract the v2.0 ZIP over `C:\Projects\the-living-planet`.
3. Allow Windows to replace matching files.
4. Run the commands above.

Existing v1.x saves are migrated when loaded. Old entities receive deterministic fallback genomes and are assigned to compatible founding lineages.

After testing:

```powershell
git add .
git commit -m "Release The Living Planet v2.0 Genesis"
git push
```

## Main controls

| Control | Action |
|---|---|
| Mouse wheel | Zoom around pointer |
| Drag in Observe mode | Pan |
| Shift-drag or right-drag with a tool | Pan while a tool is selected |
| `0–9` | Select stewardship tools |
| `[` / `]` | Slow or accelerate time |
| `Space` | Pause or resume |
| `R` | Recenter |
| `L` | Toggle region labels |
| `C` | Chronicle |
| `W` | Living Registry |
| `M` | World Library |
| `I` | Grounded Intelligence |
| `X` | Science Lab |
| `G` | Genesis Observatory |
| `D` | Documentary mode |
| `F` | Story follow |
| `Ctrl+S` | Save current world |
| `Esc` | Return to Observe mode |

## Genesis Observatory

Open **Genesis** or press `G`.

- **Evolution** — inspect lineage traits, ancestry and extinction status.
- **Memory** — view named eras and archived planetary events.
- **Composer** — create deterministic ecological scenarios from natural language.
- **Steward** — test and rank interventions before approving them.

## Optional cloud Naturalist

The local Naturalist, evolution system, memory archive, Composer and Steward all work without an API key.

The optional cloud Naturalist requires a server-side `OPENAI_API_KEY`. Never create a browser-exposed `VITE_OPENAI_API_KEY`.

## Design rules

1. The simulation creates reality.
2. Intelligence must cite or derive from simulation evidence.
3. Agents may test alternatives but cannot silently alter the live planet.
4. Manual camera control remains the default.
5. Observation clarity takes priority over raw entity count.
6. New systems must interact with existing ecology rather than exist as isolated features.

## Important limitation

The Living Planet is an artificial-life artwork and simulation sandbox. Its ecological outputs are not forecasts or real-world environmental advice.
