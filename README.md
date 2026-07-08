# The Living Planet

A browser-based digital nature documentary: a living ecosystem designed to be watched, explored, and gently influenced.

## v0.2 — Named World

This phase makes the planet easier to understand spatially.

### Changes

- Camera no longer drifts or follows organisms automatically
- Mouse wheel is captured by the canvas and no longer scrolls the page
- Drag to pan manually
- Double-click, press `R`, or use **Recenter** to reset the camera
- Six named map regions are generated onto suitable terrain:
  - Northern Highlands
  - Western Basin
  - Central Plains
  - Eastern Wetlands
  - Southern Ridge
  - Coastal Flats
- Naturalist reports now identify the region where an event occurred
- Interventions are localised to meaningful regions instead of affecting the entire planet
- Region labels can be toggled with **Labels** or `L`

## Run locally

```powershell
npm install
npm run dev
```

## Update GitHub

```powershell
git add .
git commit -m "Add fixed camera and named regions"
git push
```

## Design rule

Every minute should produce something worth watching.
