# The Living Planet v1.2.1 — Grounded Intelligence Preview

This release adds the first AI-ready Naturalist without changing the established ecology, camera, world tools, regions, climate, persistence or documentary fundamentals.

## What is new

### Evidence ledger

- Verified metrics and existing Naturalist observations are captured into a compact local ledger.
- Significant population changes, extinctions and recoveries are derived from real snapshots.
- Each record receives an evidence ID such as `E-0042`.
- Evidence remains local to the browser and is capped to protect performance.

### Naturalist 2.0

Open **Intelligence** in the top controls or press `I`.

- **Insights** records meaningful changes.
- **Evidence** shows exactly what supports each claim.
- **Ask** answers questions about stability, populations, regions and recent change.
- **Settings** controls automatic insights and optional cloud analysis.

The local Naturalist works offline and does not require any account or API key.

### Optional cloud analysis

The included `/api/naturalist.js` serverless endpoint uses the OpenAI Responses API with a strict JSON schema. It is disabled unless `OPENAI_API_KEY` is configured on the deployment server.

The API key is never exposed to browser code.

## Upgrade

Extract this ZIP over the existing repository folder:

```powershell
C:\Projects\the-living-planet
```

Then run:

```powershell
npm install
npm run check
npm run dev
```

After testing:

```powershell
git add .
git commit -m "Add grounded Naturalist intelligence preview"
git push
```

## Optional Vercel cloud setup

1. Deploy the repository to Vercel.
2. Add `OPENAI_API_KEY` as a server environment variable.
3. Optionally set `OPENAI_MODEL=gpt-5.4-mini`.
4. Redeploy.
5. Open Intelligence → Settings → Cloud Naturalist.

Do not create a `VITE_OPENAI_API_KEY`; variables prefixed with `VITE_` are exposed to browser code.

## Checks

```powershell
npm run check
npm run check:api
npm run build
```

## Design rule

> The simulation creates reality. Intelligence may observe and explain it, but never invent or silently control it.


## v1.2.1 compatibility hotfix

Replaced ES2021/ES2022-only `replaceAll()` and `Array.at()` calls so the project continues to compile with its ES2020 TypeScript target.
