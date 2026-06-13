# Training And Progression Plan

## Current Direction

- Imported `displayMarketValue` and `displaySalary` remain active truth for live economy until the final switch.
- Training and development first become a transparent preview layer.
- Traits influence development, but only as a moderated signal.

## Trait Training Signal V1

The legacy trait table is preserved as `legacyTraitTrainingFactorPct`, but not used 1:1 as the final training multiplier.

### Raw Signal

For each player:

- `rawTraitTrainingSignalPct = sum(legacyTraitTrainingFactorPct of all player traits)`

Unknown traits:

- are not guessed
- contribute `0`
- emit `unknown_trait_training_factor:<trait>`

### Compression

V1 compression is intentionally simple and transparent:

- `compressedTraitTrainingPct = clamp(rawTraitTrainingSignalPct * 0.40, -12, 12)`
- `trainingTraitMultiplier = 1 + compressedTraitTrainingPct / 100`

Examples:

- raw `+25` -> compressed `+10` -> multiplier `1.10`
- raw `+40` -> compressed `+12` -> multiplier `1.12`
- raw `-20` -> compressed `-8` -> multiplier `0.92`
- raw `-35` -> compressed `-12` -> multiplier `0.88`

### Design Intent

Traits stay visible and meaningful, but they no longer dominate the entire development loop.

Primary drivers remain:

- usage
- season PPs
- expected vs. actual performance
- star/value pressure
- inactivity
- current attribute height
- discipline relevance

Traits are a bonus or malus on top of that process.

## Preview Fields

The later Development Preview should surface:

- player traits
- `rawTraitTrainingSignalPct`
- `compressedTraitTrainingPct`
- `trainingTraitMultiplier`
- `traitCapReached`
- only active roster players from the current local save
- no free agents
- `expectedPps`
- `ppDelta`
- `developmentScore`
- `inactivityRisk`
- a compact projected attribute-direction preview, still read-only

## Active Foundation

This block only adds the foundation contract:

- trait table
- compression logic
- tests

It does not yet apply attribute changes to players.

## Sequencing Guard

This Development Preview block sits behind:

1. `Matchday Resolve V2`
2. `AI Needs/Picks Compare`

It should reuse existing local season-performance and snapshot sources instead of introducing a new progression engine in the same step.
