# Upgrade to The Living Planet v3.0 — Living Observatory

1. Stop the current Vite server with `Ctrl+C`.
2. Extract all files from this package over `C:\Projects\the-living-planet`.
3. Allow Windows to replace matching files.
4. Run:

```powershell
cd C:\Projects\the-living-planet
npm install
npm run check
npm run check:api
npm run build
npm run dev
```

## Existing worlds

Existing world saves are compatible. The new Observatory archive is stored separately per world seed in browser local storage. It begins collecting bounded 30-day samples and new Chronicle events after the upgrade.

The archive does not modify or replace IndexedDB world saves.

## First use

1. Let the planet run long enough to collect several scientific samples.
2. Press `O`.
3. Open **Forecasts** and issue a 90-, 180- or 360-day forecast.
4. Open **Films** and build a seasonal documentary.
5. Open **Atmosphere** to select Natural, Subtle, Cinematic or Off.

WebM recording depends on browser support. Playback and dossier export remain available when recording is unsupported.

Ambient audio is intentionally not included.
