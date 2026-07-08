# Changelog

## v2.6.0 — Deep Ecology

- Added functional ecological niches for plants, fungi, grazers, predators and scavengers.
- Connected niche suitability to growth, feeding efficiency, hunting success and energy demand.
- Added wetland as a living biome that can form, expand, dry and return to grassland.
- Added long-term succession, erosion and sediment state to every terrain cell.
- Added gradual grassland-to-forest succession and fire/drought-driven reopening of forest.
- Added long climate eras: temperate, wet, dry, cooling and fire-dominated intervals.
- Climate eras now influence moisture, heat, weather-front balance and wildfire spread.
- Added a Habitat observation layer for succession, wetland development and erosion.
- Added current climate era to the Stewardship summary.
- Added pointer-hover identification for animals only.
- Hover cards show species, life stage, condition, group, region, niche and lineage, then disappear when the pointer leaves.
- Removed individual animal camera following; biography focus remains a one-time locate action.
- Preserved documentary Story Follow as a separate, explicitly enabled system.
- Added automatic migration for existing v2.x saves lacking niche, succession and climate-era data.


## v2.3.0 — Living Creatures

- Added named notable individuals without naming every simulated animal.
- Added founder, matriarch, hunter, pathfinder, sentinel, scout, elder and survivor roles.
- Added individual age, sex, descendants, hunting record, injury and short life-history records.
- Added group leadership and evidence-grounded leadership succession.
- Added the Lives panel with focus and opt-in individual camera follow.
- Manual camera input cancels individual follow.
- Added juvenile, adult and elder life stages.
- Added thirst, fatigue, fear and recoverable injury.
- Added juvenile group protection and vulnerability-aware predator selection.
- Added cooperative herd defence to predator success calculations.
- Added deterministic rivers, regional waterholes and named crossings.
- Added persistent surface-water state affected by rain, drought, season and fire.
- Added water-seeking behaviour and water-aware migration.
- Added a Water analysis view and water-refuge summary.
- Exposed notable individual summaries through the internal Living Planet bridge.
- Preserved existing v2.x saves through automatic hydration of new fields.
- Passed TypeScript, API, production build and multi-seed 2,500-day simulation tests.

## v2.0.3 — Compact Observatory Docks

- Narrowed both left and right control rails to expose more of the planet canvas.
- Reduced rail button height, padding and type size while preserving readability.
- Moved the Stewardship panel lower so dynamically injected Intelligence, Science Lab and Genesis controls remain visible.
- Standardised group territory overlays by animal type: grazers yellow, predators red and scavengers cyan.
- Applied the same species colour to territory fills, borders, routes and group labels.
- Preserved all simulation, persistence and herd-balance behaviour from v2.0.1.


## v2.0.1 — Living Herds balance correction

- Fixed named grazer herds tending to shrink without ever producing visible growth.
- Herd migration now targets real forage concentrations inside the selected region.
- Initial herds begin closer to viable food sources.
- Increased grazer forage-detection range and food energy return.
- Added resource-gated spring calving pulses for established herds.
- Reduced the individual grazer reproduction threshold and made it seasonal.
- Added maturity requirements and retained food, energy and predator constraints.
- Raised the herd split threshold from 32 to 46 members so growth is visible before division.
- Restricted emergency grazer reintroduction to near-collapse conditions.
- Adjusted predator recovery to preserve the trophic layer when grazers remain viable.
- Verified TypeScript, API syntax, production build, existing-world migration and five 5,000-day seeded simulations.

## v2.0.0 — Genesis

This release consolidates several development phases into one full replacement package.

### v1.5 phase — Genetic lineages

- Added inherited genomes to plants, fungi and animals.
- Connected traits to speed, energy use, fertility, perception, resilience, cooperation and camouflage.
- Added imperfect predator hunting influenced by predator and prey traits.
- Added inherited mutation and controlled lineage divergence.
- Added deterministic taxonomy names and lineage colours.
- Added migration for v1.x saves that do not contain genomes.
- Added a Lineages map and Evolution Observatory.

### v1.6 phase — Planetary memory

- Added a per-world long-term memory archive.
- Records major events beyond the short Chronicle limit.
- Records lineage births and extinctions.
- Groups history into named 360-day eras.
- Added region-focus navigation from archived moments.

### v1.7 phase — World Composer

- Added natural-language ecological scenario composition.
- Added deterministic prompt hashing and shareable seeds.
- Added scenario previews before creation.
- Added presets for balanced, dry-migration, fungal-rainforest and ash-recovery worlds.
- Current worlds are archived before a composed world is created.

### v1.8 phase — Steward Planner

- Added an approval-gated simulation agent.
- Runs multiple counterfactual interventions against matched baselines.
- Supports biodiversity, grazer recovery, predator balance, drought resilience and soil recovery objectives.
- Ranks alternatives using population survival, stability and trophic outcomes.
- Does not alter the live world until the user approves a supported intervention.

### v2.0 integration

- Integrated Genesis Observatory alongside Intelligence and Science Lab.
- Added bridge APIs for lineages, world creation, view switching and approved intervention.
- Preserved all v1.x ecosystem, camera, persistence and documentary fundamentals.
- Updated documentation and production metadata.
- Verified TypeScript, API syntax, production build and long-run simulation stability.

## v1.4.0 — Science Preview

- Added counterfactual ecology experiments.
- Added matched baseline and intervention futures.
- Added documentary shot planning and Story Reel.

## v1.3.0 — Documentary Director

- Added event scoring, documentary direction and opt-in narration.

## v1.2.1 — Grounded Intelligence hotfix

- Added evidence-ledger Naturalist intelligence.
- Restored ES2020 compatibility.

## v1.0.0 — Persistent Living Planet

- Added IndexedDB world saves, autosave, world library, import/export and screenshots.
