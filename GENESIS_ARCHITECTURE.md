# Genesis Architecture

## Simulation genetics

`src/world/genetics.ts`

Provides deterministic genome generation, mutation, distance, trait interpretation, colour and taxonomy naming.

`src/engine/simulation.ts`

The simulation owns genomes and lineages. Traits directly influence ecological mechanics. Speciation is intentionally rate-limited so the registry remains readable and browser performance remains stable.

## Evolution Observatory

`src/genesis/bootstrap.ts`

Reads lineages through the read-safe application bridge and renders ancestry, population, trait profiles and map focus controls.

## Planetary memory

`src/genesis/memory.ts`

Maintains a per-seed browser archive of Chronicle events and lineage transitions. It never modifies simulation state. Named eras are deterministic summaries of events already recorded by the world.

## World Composer

`src/genesis/composer.ts`

Converts descriptive text into a deterministic ecological recipe. The parser maps supported concepts to existing simulation interventions. The recipe is shown before the user approves creating a new world.

## Steward Planner

`src/genesis/steward.ts`

Uses the Counterfactual Ecology Lab to test several candidate interventions. Each candidate begins from the same world snapshot. The planner scores outcomes against a user-selected objective and waits for explicit approval before applying a supported recommendation.

## Bridge permissions

`src/integration/bridge.ts`

The bridge exposes narrow capabilities:

- Read snapshots, counts, regions, groups and lineages
- Focus the camera
- Change analysis view
- Create a user-approved world
- Apply a user-approved intervention

It does not expose arbitrary mutation of simulation state.

## Trust boundary

The deterministic simulation is authoritative. Local analytical agents and optional cloud language models operate outside the simulation loop. They can observe, compare, narrate and propose. They cannot silently rewrite reality.
