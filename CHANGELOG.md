# Changelog

## v1.0.0 — Persistent Living Planet

### Added

- IndexedDB-backed World Library
- Automatic recovery save and automatic resume
- Multiple named manual world saves
- Full simulation-state persistence, including random generator state
- Save restoration for camera, view, labels, time flow and brush radius
- New-world creation with custom or random deterministic seeds
- Automatic archival of the current world before creating another
- Portable `.planet.json` export and import
- PNG planet capture
- Seed copying and world identity summary
- Save-state indicator and keyboard shortcut (`Ctrl+S`)

### Improved

- Save operations clone a stable snapshot before asynchronous storage
- Autosave interval reduced in frequency to protect animation smoothness
- Package versions are pinned for repeatable installs
- Removed an unused Vite dependency
- Fixed panel coordination so World Library, Chronicle and Living Registry do not overlap
- Corrected a stylesheet parsing error inherited from the prototype

### Retained from v0.9

- Moving climate fronts
- Visible seasonal transitions
- Wind-driven wildfire and succession
- Documentary mode and optional Story Follow
- Named social groups, routes, territories and world memory
- Direct stewardship tools and adjustable time flow
