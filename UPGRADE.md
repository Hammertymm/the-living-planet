# Upgrade to The Living Planet v2.3

1. Stop the development server with `Ctrl+C`.
2. Copy the complete contents of this package over `C:\Projects\the-living-planet`.
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

Existing v2.x browser worlds remain compatible. On first load, old animals receive deterministic life-state defaults and the world gains persistent rivers and regional waterholes. Export important worlds before any major upgrade as normal.

Open **Lives** or press `V`. Open **Water** from the left observation rail.
