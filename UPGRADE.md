# The Living Planet v1.3 — Documentary Director

This is an upgrade overlay for v1.2.1.

Copy everything inside this folder over:

```text
C:\Projects\the-living-planet
```

Allow Windows to replace matching files, then run:

```powershell
npm install
npm run check
npm run check:api
npm run build
npm run dev
```

## New controls

- **Director** in the top control bar opens the Documentary Director.
- `K` opens or closes the Director panel.
- **Start directing** enables opt-in camera direction.
- **Focus best moment** manually revisits the strongest recorded event.
- **Play 3-minute reel** presents the seven strongest moments from the evidence ledger.
- Spoken narration is optional and uses the browser's local speech engine.

Manual panning or zooming immediately stops automatic direction unless a 3-minute reel is actively playing.
