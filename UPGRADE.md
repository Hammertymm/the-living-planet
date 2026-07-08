# Upgrade to v2.0.1

1. Stop the development server with `Ctrl+C`.
2. Extract the contents of this package over:

```text
C:\Projects\the-living-planet
```

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

5. Open the app and press `G` to open Genesis Observatory.

After testing:

```powershell
git add .
git commit -m "Fix herd growth and forage balance"
git push
```

Existing browser saves remain available. The first load may take slightly longer while older entities are assigned deterministic genomes and founding lineages.
