# The Living Planet v0.9 — Climate, Seasons & Documentary

A browser-based living ecosystem designed to be watched, explored and gently influenced.

This phase keeps the established fundamentals intact: manual camera control, named regions, direct placement tools, named herds and packs, World Chronicle, Living Registry and adjustable time flow. It adds a continuous climate system and a cleaner observation experience.

## New in v0.9

### Moving climate

- Rain fronts, dry air masses and storm cells now move across the planet.
- Weather changes soil moisture, heat and fertility continuously rather than only when a tool is clicked.
- Prevailing wind changes gradually through the year.
- The new **Climate** view shows active fronts and wind direction.
- Rain and drought placed with the mouse create local moving weather systems.

### Four visible seasons

- Spring accelerates plant growth.
- Summer dries exposed ground and changes vegetation colour.
- Autumn shifts forests and grasslands toward warmer tones.
- Winter slows growth and gives the planet a cooler visual character.
- Seasonal transitions are recorded by the Naturalist and World Chronicle.

### Living fire

- Wildfire is no longer only an instant circular removal.
- Active fire can spread downwind through dry land.
- Animals attempt to flee burning ground.
- Burn scars remain part of World Memory and enrich soil during recovery.
- Dry storm cells can create rare lightning fires.

### Documentary mode

- Press **D** or select **Documentary** to fade away research controls.
- The Naturalist becomes a centred documentary caption.
- The camera remains manual by default.
- Optional **Story follow** can gently move the camera toward major events.
- Story follow is disabled by default and turns off immediately when you manually pan or zoom.

### Stability improvements

- Ecological recovery now protects long-running worlds from silently losing entire trophic roles.
- Small grazer, predator, scavenger and fungal populations can recover when resources support them.
- A 4,000-day automated simulation smoke test retains plants, grazers, predators, scavengers and fungi.

## Run locally

```powershell
npm install
npm run dev
```

Open the address shown by Vite, normally `http://localhost:5173`.

## Controls

- Mouse wheel: zoom
- Drag in Observe mode: pan
- Shift-drag or right-drag with a tool selected: pan
- `0–9`: select stewardship tools
- `[` / `]`: slower / faster time
- `Space`: pause/resume
- `R`: recenter
- `L`: region labels
- `C`: World Chronicle
- `W`: Living Registry
- `D`: Documentary mode
- `F`: Story follow
- `Esc`: Observe mode

## Production build

```powershell
npm run build
```

The TypeScript and Vite production build has been verified for this release.
