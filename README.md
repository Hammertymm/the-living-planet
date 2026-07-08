# The Living Planet

A browser-based digital nature documentary: a living ecosystem designed to be watched, explored, and gently influenced.

## v0.3 — Stewardship Tools

This phase restores direct interaction without turning the planet into a management game. You can now introduce life and local conditions exactly where you choose.

### Direct placement tools

Select a tool, then click or drag across the planet:

- Plant growth
- Grazer herd
- Predator pack
- Scavengers
- Fungal colony
- Rain front
- Drought
- Fertile soil
- Wildfire

A visible influence circle shows the affected area before you act.

### Camera and inspection

- **Observe** mode: drag to pan
- With another tool selected: **Shift-drag** or right-drag to pan
- Mouse wheel zooms toward the cursor
- Hover over the world to see:
  - named region
  - biome
  - moisture
  - soil fertility
  - nearby plants, grazers, predators and fungi
- Press `R` to recenter
- Press `L` to toggle region labels
- Press `Space` to pause
- Press `Esc` to return to Observe mode

### Keyboard tools

| Key | Tool |
|---|---|
| `0` | Observe |
| `1` | Plant growth |
| `2` | Grazer herd |
| `3` | Predator pack |
| `4` | Scavengers |
| `5` | Fungal colony |
| `6` | Rain front |
| `7` | Drought |
| `8` | Fertile soil |
| `9` | Wildfire |

### Ecological behaviour

Every intervention remains subject to the world rather than guaranteeing an outcome. A herd placed in poor habitat may migrate or die. A forest planted in dry soil may fail. Wildfire removes growth but can leave a fertile succession scar.

## Run locally

```powershell
npm install
npm run dev
```

## Update GitHub

```powershell
git add .
git commit -m "Add direct stewardship tools"
git push
```

## Design rule

> Every minute should produce something worth watching.
