# The Living Planet v3.0 — Living Observatory

A browser-based digital nature documentary: a deterministic planet that can be watched, explored, questioned and gently influenced.

v3.0 completes the planned Observatory arc. It adds falsifiable ecological forecasts, evidence-built documentaries, historical replay and a dynamic visual atmosphere while preserving the simulation as the sole source of ecological truth.

## New in v3.0

### Scientific Naturalist

Open **Observatory → Forecasts** or press `O`.

The Naturalist can now register explicit ecological predictions such as:

- a population increasing, declining or remaining broadly stable
- a fragile herd surviving or losing members
- a migrating group reaching its target region
- surface water or vegetation responding to the current climate era

Each prediction contains:

- issue day and due day
- confidence level
- measurable subject and threshold
- evidence and rationale
- later observed result
- confirmed, partly confirmed, refuted or inconclusive status

Due forecasts are automatically tested against later simulation samples. The Observatory reports accumulated accuracy and calibration rather than pretending every prediction is correct.

Predictions never change the live planet.

### Generative documentaries

Open **Observatory → Films**.

Three grounded formats are available:

- **Field brief** — the latest important events
- **Seasonal chapter** — a broader ecological story
- **Era documentary** — a longer historical arc

The documentary system selects only recorded events and current simulation subjects. It builds:

- an opening establishing shot
- located Chronicle events
- notable animal and group sequences
- landscape and climate context
- a closing observation
- an evidence-linked storyboard

Films can be:

- played inside Documentary Mode
- exported as a Markdown documentary dossier
- recorded as a captioned WebM where the browser supports `MediaRecorder` and canvas recording

Manual pointer or wheel input stops directed playback immediately.

### Observatory archive and replay

The new per-world Observatory archive stores a bounded record of:

- 30-day scientific samples
- verified Chronicle events
- forecasts and outcomes
- generated documentary plans

The archive can generate a new film from recent history or be exported as JSON. It supplements the World Chronicle and Planetary Memory; it does not replace authoritative world saves.

### Visual atmosphere

Open **Observatory → Atmosphere**.

The renderer now supports:

- a continuous dawn, daylight, dusk and moonlit-night cycle
- moisture-driven fog
- weather-dependent moving cloud shadows
- stronger cinematic or subtler observation presets
- adjustable strength and cycle speed
- a complete off switch

Atmospheric effects apply to the Natural view and do not alter climate, visibility, energy or animal behaviour.

**Ambient audio remains deliberately shelved.** v3.0 adds no sound system.

### Animal hover identification retained

Hover directly over a grazer, predator or scavenger to see a temporary information card containing identity, life stage, condition, group, region, niche and lineage. The card disappears as soon as the pointer moves away.

## Major systems retained

- Notable individual lives, leaders and descendants
- Behavioural ecology, thirst, fatigue, fear and injury
- Rivers, waterholes and water-driven migration
- Functional ecological niches
- Erosion, sediment, succession and changing biomes
- Long climate eras
- Genetics, lineages and extinction history
- Counterfactual Science Lab
- Approval-gated Steward Planner
- World Composer
- Grounded Intelligence and optional server-side cloud Naturalist
- Documentary mode and optional Story Follow
- IndexedDB world library, autosave, import and export

## Core rule

> The simulation creates reality. Intelligence may observe, forecast, compare and present it, but never invent or silently control it.

## Install or upgrade

Stop Vite with `Ctrl+C`, then extract this package over:

```text
C:\Projects\the-living-planet
```

Run:

```powershell
cd C:\Projects\the-living-planet
npm install
npm run check
npm run check:api
npm run build
npm run dev
```

Existing v1.x and v2.x world saves remain compatible and are hydrated when loaded.

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
| `V` | Notable Lives |
| `M` | World Library |
| `I` | Grounded Intelligence |
| `X` | Science Lab |
| `G` | Genesis |
| `O` | Living Observatory |
| `D` | Documentary mode |
| `F` | Story Follow |
| `Ctrl+S` | Save current world |
| `Esc` | Stop a playing film or return to Observe mode |

## Commit

```powershell
git add .
git commit -m "Release The Living Planet v3.0 Living Observatory"
git push
```
