# The Living Planet v0.5 — Time Flow

A browser-based living ecosystem designed to be watched, explored and gently influenced.

## New in v0.5

- Added a **Time Flow** slider that accelerates and decelerates simulated time.
- Seven rates: **0.25×, 0.5×, 1×, 1.5×, 2×, 3× and 4×**.
- Default remains **1×**, preserving the v0.4 pace.
- `[` slows time and `]` accelerates it.
- Changing speed clears accumulated timing so the world does not jump.
- Catch-up work is capped after a hidden/background tab to prevent lock-ups.
- All v0.4 fundamentals remain unchanged: fixed camera, named regions, direct stewardship tools, Naturalist reports and World Chronicle.

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
- `Esc`: Observe mode

## Production build

```powershell
npm run build
```
