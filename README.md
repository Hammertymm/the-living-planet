# The Living Planet

A browser-based digital nature documentary: a living ecosystem designed to be watched, explored, and gently influenced.

This is the clean production branch, separated from Emergence Lab.

## v0.1 — Foundation

Included:

- Vite + TypeScript project structure
- Deterministic seeded world generator
- Canvas renderer
- Camera drift / observe mode
- Terrain: ocean, shore, grassland, forest, rock, snow
- Entities: plants, grazers, predators, scavengers, fungi, carrion
- Basic ecology loop
- Naturalist event notes
- Intervention controls
- Minimal HUD that stays out of the world view

## Run locally

```powershell
npm install
npm run dev
```

Open the local URL shown in the terminal.

## GitHub setup

```powershell
git add .
git commit -m "Initial Living Planet foundation"
git push
```

## Design rule

Every minute should produce something worth watching.
