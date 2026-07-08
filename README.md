# The Living Planet v0.7 — Herds, Packs & World Memory

A browser-based living ecosystem designed to be watched, explored and gently influenced.

This release keeps the established fundamentals intact: the fixed manual camera, named regions, direct stewardship tools, Naturalist, Chronicle and adjustable time flow. The main change is that social animals now persist as recognisable groups with names, routes and histories.

## New in v0.7

### Named living groups

- Grazers now belong to persistent named herds.
- Predators belong to named packs.
- Scavengers belong to named colonies or flocks.
- Each group has a colour, home region, destination, founding day and generation.
- Animals introduced with the mouse form a new named group rather than appearing anonymously.
- Newborn animals inherit their parent's group and usually its colour lineage.

### Group behaviour

- Group members maintain loose cohesion while searching for food.
- Herds seek plant-rich regions with lower predator pressure.
- Packs follow grazer concentrations.
- Scavenger colonies follow carrion.
- Large herds can split and create a newly named descendant herd.
- Small compatible groups can merge for survival.
- Group extinctions and mergers are recorded by the Naturalist.

### Living Registry

- Open **Wildlife** to see every active herd, pack and scavenger colony.
- The registry displays group size, condition, destination and generation.
- Select a group to centre the camera on it and switch to the Groups view.
- Press `W` to open or close the registry.

### Groups view

- Shows the territory around each active group.
- Displays recent migration routes.
- Uses each group's inherited colour.
- Labels groups directly on the world with their current population.

### World memory

- Animal movement gradually creates visible paths.
- Wildfires leave persistent burn scars rather than vanishing immediately.
- Dens, grazing grounds, migration crossings and burn sites become named landmarks.
- The new **Memory** view reveals paths, scars and landmarks.
- Old events fade slowly, allowing the landscape to retain a readable history.

### Chronicle improvements

- Chronicle entries can focus on the exact location of an event, not only the centre of a region.
- Group-specific events identify the herd or pack involved.
- The Naturalist can now report group division, migration, merger and extinction.

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
- `W`: Living Registry
- `Esc`: Observe mode

## Production build

```powershell
npm run build
```

The TypeScript and Vite production build has been verified for this release.
