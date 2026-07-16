---
name: olympiade-character-generator
description: >-
  Builds and imports Olympiade der Welten players from a character brief with
  official 12 attributes, traits, discipline stats, market value and salary.
  Use when the user wants a new character imported into the browser game,
  describes a player concept, or asks for VIP-Wal-style character creation.
---

# Olympiade Character Generator

## When to use

Use this skill when the user describes a new player for **Olympiade der Welten** and wants them imported into the browser game with correct stats, economy and transfermarkt visibility.

Reference implementation: `references/character-briefs/vip-wal.json`

## Required inputs from the user

Collect or infer:

1. **Name**
2. **Concept** (role, vibe, species, archetype)
3. **Optional**: portrait already saved under Dropbox `Mark VI Cardgame/Spieler/`
4. **Optional**: flavor text (`flavorDe`)

You derive the rest using project rules below.

## Hard rules

- Only use official **12 attributes**: power, health, stamina, intelligence, awareness, determination, speed, dexterity, charisma, will, spirit, torment (1–99)
- Only use canonical traits from `lib/training/class-progression-config.ts`
- Only use classes from `PROGRESSION_CLASS_ORDER`
- No custom abilities / passive skills
- Portrait path must point to Dropbox `Spieler/<Name>.jpg` when available
- Artwork source should be **1:1 square** when generating portraits

## Workflow

```text
1. Draft brief JSON
2. Validate + build player
3. Run tests
4. Import with --write
5. Verify transfermarkt
```

### Step 1 — Draft brief JSON

Copy `references/character-briefs/template.json` and fill:

- `className`, `race`, `alignment`, `gender`
- up to 4 `subclasses`
- up to 3 `traitsPositive`, up to 3 `traitsNegative`
- all 12 `attributes`
- `flavorDe` if available
- `portraitPath` if image exists

Save as `references/character-briefs/<slug>.json`.

### Step 2 — Build + validate (dry-run)

```bash
npm run character:import -- --brief references/character-briefs/<slug>.json
```

Checks:

- no validation issues
- 20 discipline ratings present
- MW + salary printed from rank-table engine
- traits/classes are canonical

### Step 3 — Run tests

```bash
npm test -- tests/character-import-service.test.ts tests/sync-catalog-player-transfermarkt.test.ts
```

All checks must be green before import.

### Step 4 — Import

For **stats + economy + portrait** use the full character import:

```bash
npm run character:import -- --brief references/character-briefs/<slug>.json --write
```

For **flavor text only** (`flavorDe` / `flavorEn`) without recalculating stats:

```bash
npm run flavor:export -- --out data/generated/player-flavor-export-batch-01.json --missing-only --limit 500
npm run flavor:import -- --file data/generated/player-flavor-import-batch-01.json --write
```

Import file format:

```json
{
  "entries": [
    { "id": "player-1354-soul-reaper", "flavorDe": "..." }
  ]
}
```

Or JSONL with one `{ "id", "flavorDe" }` object per line.

Flavor import updates only:

- `flavorDe` / `flavorEn` on the **matched player id/name**
- **No** stat, MW, salary, attribute or portrait recalculation
- **No overwrite** of existing bios by default — use `--overwrite-existing` only for deliberate fixes

Full character import updates:

- `data/generated/oly-player-stats.json`
- `data/generated/oly-player-attributes.json`
- `data/generated/player-portrait-map.json`
- SQLite `player_catalog` + `player_baseline_catalog` (+ clears stale save patches)
- invalidates in-memory save cache (reload Foundation after import)
- Postgres if `.env.local` is configured

Never hand-set MW/salary in the brief. The full character import derives:

- 20 discipline ratings from the 12 attributes
- POW / SPE / MEN / SOC core axes
- MW via rank table across the full catalog
- salary via the official salary engine

### Step 5 — Verify transfermarkt

Search the player in Foundation Transfermarkt by name. Confirm:

- class / race / traits correct
- MW + salary plausible
- portrait loads via `/api/media/player-portrait/<playerId>`

## Attribute design guide

| Archetype | High attributes | Low attributes |
|---|---|---|
| Gambler / Bard | charisma, will, intelligence | speed, dexterity |
| Tank / Berserker | power, health, stamina | intelligence, dexterity |
| Sprinter / Rogue | speed, dexterity, awareness | power, torment |
| Mage / Tactician | intelligence, will, awareness | power, health |

Use VIP Wal as mid-tier strong reference (~rating 66):

- pow axis ~75 via power/health/stamina
- men axis ~71 via intelligence/will
- soc axis ~69 via charisma/spirit/torment
- spe axis ~47 (slow heavy character)

## Economy

Never hand-set MW/salary. The import service calculates:

- **Market value** via rank table across full catalog (`buildRankTableMarketValueMap`)
- **Salary** via `calculateSalaryFromMarketValue` with traits + attributes

## Portrait rule

If generating art:

- dark fantasy Olympiade style
- save to Dropbox `Spieler/<Name>.jpg`
- crop **1:1**
- do **not** generate physical card PNGs unless explicitly requested

## Additional resources

- **Welt-Lexikon:** `references/world/olympiade-welt-lexikon.md` — Herkunftsorte, Regionen, Bio-Regeln
- Service: `lib/player-import/character-import-service.ts`
- Import CLI: `scripts/import-olympiade-character.ts`
- Golden brief: `references/character-briefs/vip-wal.json`
