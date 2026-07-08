# Grounded Intelligence Architecture

The AI Preview deliberately keeps intelligence outside the simulation loop.

## Flow

1. The deterministic ecosystem updates the world.
2. The existing interface renders verified metrics and Naturalist events.
3. `EvidenceStore` captures those verified observations into a compact ledger.
4. The local Naturalist answers immediately from deterministic rules.
5. User-requested cloud analysis may send the same bounded evidence ledger to `/api/naturalist`.
6. Every returned claim includes evidence IDs that can be opened in the interface.

## Non-negotiable constraints

- AI never advances time or changes ecology.
- AI is never called on every simulation tick.
- No API key is shipped to the browser.
- Cloud analysis is opt-in and user-triggered.
- Failure always falls back to the local Naturalist.
- AI cannot cite evidence IDs that were not supplied.
- Causal language remains cautious unless causation is explicitly recorded.

## Current limitation

v1.2 grounds itself through the current UI metrics and Naturalist notes. The next engine phase will publish a first-class typed event stream directly from the simulation, replacing DOM observation while keeping the same evidence contract.
