# Deep Ecology Architecture

## Purpose

v2.6 moves the simulation from broad species categories toward functional ecology and deep time. It adds three interacting layers while keeping the deterministic simulation authoritative.

## 1. Ecological niches

Each non-carrion entity receives one functional niche derived from species, inherited genome and founding habitat. Niches alter energy gain, energy cost and hunting effectiveness through bounded suitability multipliers. They do not script outcomes or guarantee survival.

Examples include wetland grazers, browsers, pursuit hunters, ambush hunters, root symbionts and burn-scar colonisers.

## 2. Living landscape

Each terrain cell now retains:

- succession
- erosion
- sediment
- existing moisture, fertility, water, fire, burn and trail memory

Every thirty simulation days the landscape updates from water, plant cover, grazing, trails and fire. Biome transitions are gradual and threshold-based:

- grass or shore may become wetland
- wetland may dry into grassland
- mature moist grassland may become forest
- burned, dry or degraded forest may reopen into grassland

## 3. Climate eras

The planet moves through multi-year climate intervals lasting roughly 1,500–2,850 simulated days. Eras bias weather generation and long-term moisture, heat and fire behaviour. Era transitions enter the Chronicle and long-term planetary memory.

## Animal hover identification

Pointer inspection is presentation-only. The app searches nearby social animals in world coordinates and displays a non-interactive card. It does not pause, select, follow or mutate the animal. The card is removed during panning, painting, documentary mode and pointer exit.

## Save migration

The world save schema remains version 1 for compatibility. Missing deep-ecology fields are hydrated deterministically when a previous v2.x save is restored.
