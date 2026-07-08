# Living Creatures Architecture

## Purpose

The v2.3 layer creates emotional continuity without turning every entity into an expensive character simulation. Most organisms remain anonymous ecological agents. A bounded cast becomes notable because of leadership, age, reproduction, hunting success or survival.

## Individual state

Social animals may store sex, birth day, parent references, descendants, successful hunts, thirst, fatigue, fear, injury, role, name and a capped history. These values are included in normal world snapshots.

## Promotion and succession

Every social group receives a founder. Periodic scoring may promote exceptional adults until the global notable limit is reached. If a leader dies, the best surviving adult becomes successor and the Chronicle records the change.

## Behaviour

- Juveniles use tighter group cohesion.
- Grazers flee nearby predators.
- Predators score prey vulnerability rather than selecting the first visible target.
- Group size and cooperation provide defensive protection.
- Thirst can override food seeking.
- Injury and fatigue reduce movement performance but can recover.

## Water

Each tile has current water and a long-term base. Deterministic regional waterholes and a river corridor are generated for new worlds. Existing worlds receive the system during save hydration. Climate fronts, direct rain, drought, fire and seasonal heat alter current water.

## Performance controls

- Notable animals are globally capped.
- Individual history is capped at ten records.
- Water navigation uses a periodically refreshed source index.
- Water and behavioural state remain numeric and serialisable.
- No AI call occurs inside the simulation loop.

## Observation interaction

The Lives panel can locate a notable animal once, but it does not continuously follow animals. Pointer-hover inspection identifies nearby grazers, predators and scavengers in world coordinates and presents a temporary non-interactive field card.
