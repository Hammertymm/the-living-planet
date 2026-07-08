# Upgrade to The Living Planet v2.6 — Deep Ecology

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

Existing v2.x browser worlds remain compatible. On first load, older worlds receive deterministic ecological niches, succession/erosion fields and a starting climate era without discarding their populations, history or saved camera state.

Hover the pointer over a grazer, predator or scavenger to see a temporary field-information card. The card disappears as soon as the pointer moves away.
