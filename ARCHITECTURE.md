# Architecture

The Living Planet is a small TypeScript/Vite application with three deliberately separate responsibilities.

## Simulation

`src/engine/simulation.ts`

Owns the authoritative `PlanetState` and advances it one simulated day at a time. It handles climate, fire, terrain condition, organisms, social groups, recovery and Naturalist events. The renderer never changes ecology directly.

## Rendering and camera

`src/render/renderer.ts`

Draws terrain, climate, organisms, labels, routes, landmarks and intervention previews onto one HTML canvas. It owns camera position and zoom but does not own world state.

## Application and interaction

`src/main.ts`

Builds the interface, maps mouse and keyboard input, manages time flow, switches views and connects stewardship actions to the simulation.

## Persistence

`src/persistence/worldStore.ts`

Stores large world snapshots in IndexedDB rather than localStorage. Metadata is kept in a separate object store so the World Library can list saves without loading every full planet.

A saved world contains:

- Planet state
- Random generator state
- Entity/group/landmark/front ID counters
- Camera and selected analysis view
- Time-flow and brush settings
- Human-readable metadata and population summary

The save schema is explicitly versioned. Future releases can add migrations without silently corrupting old worlds.

## World generation

`src/world/`

Contains deterministic random generation, named regions, group naming/colour logic and shared data types.

## Design constraints

1. Manual camera control remains the default.
2. New systems should interact with existing ecology rather than exist as isolated features.
3. Persistence should preserve history, not only recreate a starting seed.
4. Observation clarity takes priority over raw entity count.
5. Browser performance must remain stable on ordinary laptops.

## Living creatures

`src/world/individuals.ts` supplies deterministic naming, life-stage classification, notable-role selection and importance scoring. The simulation stores individual fields directly on social animals so saves retain ancestry, condition and history. Only a bounded set of animals becomes notable.

Water is authoritative simulation state on each terrain tile through `water` and `waterBase`. Regional waterholes and a river network are generated deterministically. Climate and stewardship alter current water, while the base value drives gradual recovery. A cached water-source index prevents thirsty-animal navigation from scanning the entire map each step.

The main application owns the Lives panel, one-time biography focus and pointer-hover animal identification. Hover inspection is non-interactive and disappears on pointer exit; the renderer may highlight the hovered animal but cannot mutate its state.

## Deep ecology

`src/world/ecology.ts` assigns functional niches, bounded habitat suitability and long climate-era effects. Terrain cells retain succession, erosion and sediment, allowing biome transitions to emerge from water, roots, grazing, trails and fire. See `DEEP_ECOLOGY_ARCHITECTURE.md`.
