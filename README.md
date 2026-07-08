# The Living Planet v1.0

A browser-based living ecosystem designed to be watched, explored and gently influenced.

The planet contains persistent terrain, climate, seasons, plants, fungi, grazers, predators, scavengers, named social groups, landscape memory and a Naturalist that records significant events. v1.0 adds the first complete world-persistence system so a planet can develop over many sessions.

## New in v1.0

### Persistent worlds

- The current planet automatically saves in the browser every 45 seconds while time is moving.
- The latest autosave is resumed when the application opens again.
- Manual saves can be created and updated from the **Worlds** panel.
- Multiple named worlds can coexist in the local World Library.
- Creating a new planet automatically archives the current one first.
- Camera position, selected view, labels, time flow and brush radius are restored with the world.

Browser saves use IndexedDB. They remain on that browser and device unless exported.

### Portable world files

- Export a complete planet as a `.planet.json` file.
- Import exported worlds on another computer or browser.
- Copy the deterministic world seed.
- Capture a clean PNG image of the visible planet canvas.

### Stable world identity

Each world now has:

- A user-editable name
- A deterministic seed
- Current age and season
- Population and social-group summary
- Persistent Chronicle, landmarks, routes and burn scars
- Full simulation random state, allowing the world to continue rather than merely restart from its seed

### Existing systems retained

- Manual camera control with optional Story Follow
- Named geographic regions
- Direct mouse placement tools
- Adjustable time flow
- Moving climate fronts and four seasons
- Living wildfire and ecological succession
- Named grazer herds, predator packs and scavenger colonies
- World Chronicle and Living Registry
- Natural, moisture, soil, pressure, memory, groups and climate views
- Documentary mode

## Install and run

From the project folder:

```powershell
npm install
npm run dev
```

Open the local address printed by Vite, normally:

```text
http://localhost:5173
```

## Upgrade an existing local copy

Extract the v1.0 ZIP over the existing repository folder, then run:

```powershell
npm install
npm run dev
```

After testing:

```powershell
git add .
git commit -m "Release The Living Planet v1.0"
git push
```

## Main controls

| Control | Action |
|---|---|
| Mouse wheel | Zoom around the pointer |
| Drag in Observe mode | Pan |
| Shift-drag or right-drag with a tool | Pan while a tool is selected |
| `0–9` | Select stewardship tools |
| `[` / `]` | Slow down / accelerate time |
| `Space` | Pause or resume |
| `R` | Recenter |
| `L` | Toggle region labels |
| `C` | World Chronicle |
| `W` | Living Registry |
| `M` | World Library |
| `Ctrl+S` | Save the current world |
| `D` | Documentary mode |
| `F` | Optional Story Follow |
| `Esc` | Return to Observe mode |

## Stewardship tools

- Plant growth
- Grazer herd
- Predator pack
- Scavengers
- Fungal colony
- Rain front
- Drought
- Fertile soil
- Wildfire

The tools influence a living system; they do not directly script the outcome.

## Production check

```powershell
npm run check
npm run build
```

## Save-data note

Clearing browser site data will remove local World Library saves. Export important worlds before clearing browser storage or changing computers.
