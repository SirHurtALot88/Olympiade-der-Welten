# AI Automation Status

Stand: 2026-06-06

## Grundregel
- Default: `source=sqlite/local`
- `prisma` bleibt read-only
- keine AI-Automation darf im normalen Produktfluss Prisma beschreiben
- keine AI-Automation darf stillschweigend `manual`-Teams ueberschreiben

## Team Admin / Control Settings

Lokal gespeichert in:
- `gameState.seasonState.teamControlSettings`

User-facing Bearbeitung:
- Foundation `Team Settings`
- `Admin` verlinkt nur noch technisch auf diesen Bereich

Relevante Felder:
- `controlMode`: `manual | ai | passive`
- `aiLineupPreviewEnabled`
- `aiLineupApplyEnabled`
- `aiTransferPreviewEnabled`
- `aiSellPreviewEnabled`
- Auto-Apply-Felder sind als Struktur vorbereitet, aber nicht als versteckte Produktautomatik freigeschaltet

Verhalten:
- `manual`: Nutzer-Team, durch AI zu schuetzen
- `ai`: AI-Team, je nach Freigaben fuer Preview/Apply nutzbar
- `passive`: aktuell kein Auto-Fallback in Matchday Auto-Run

## Team Strategy Profiles V1

Lokal gespeichert in:
- `gameState.seasonState.teamStrategyProfiles`

Default-Quellen:
- Identity-Rohwerte: `data/source/team-identities.json`
- Strategy-Profile-Defaults: `lib/foundation/team-strategy-profiles.ts`
- lokale Identity-Overrides: `gameState.seasonState.teamIdentityOverrides`

Status:
- fuer 32 Teams vorhanden
- lokal speicher- und editierbar
- werden bereits read-only in AI-Erklaerungen genutzt
- `Team Settings` zeigt Raw Identity, Axis Weights, Lore, Bias und Control Settings getrennt

Noch nicht:
- keine vollautomatische Gesamt-Saisonsteuerung
- keine harte neue Player-Progression-Logik

## AI-Lineup

### Einzelteam Preview
- Status: umgesetzt
- Modus: read-only
- Route: `/api/lineups/legacy/ai-preview`

### Einzelteam Apply
- Status: umgesetzt
- Modus: lokaler Write
- Pfad: bestehender lokaler Einsatzlisten-Save
- Schutz:
  - Confirm
  - Validator
  - `source=prisma` blockiert

### Batch Preview
- Status: umgesetzt
- Modus: read-only
- Route: `/api/lineups/legacy/ai-batch-preview`
- zeigt Vorschlaege fuer mehrere Teams / aktuellen Matchday

### Batch Apply
- Status: umgesetzt
- Modus: lokaler Write
- Route: `/api/lineups/legacy/ai-batch-apply`
- Regeln:
  - DryRun-first
  - Confirm fuer Execute
  - nur `controlMode=ai`
  - `manual` -> `skipped_manual`
  - `passive` -> `skipped_passive`
  - disabled AI -> `skipped_disabled`
  - warning Teams nur mit Extra-Option
  - blocked Teams nie
  - bestehende Lineups nur mit Overwrite-Option

## Matchday Auto-Run

### Status
- umgesetzt
- Modus: lokaler Orchestrator
- Route: `/api/season/matchday-auto-run`

### Was er orchestriert
1. AI-Lineup Batch Apply fuer AI-Teams
2. Resolve Preview
3. Result Apply lokal
4. Standings Preview / Apply lokal
5. Prize Preview / Cash Apply lokal
6. Matchday Advance lokal

### Manual-Team-Policy
- `ai`: AI-Lineups duerfen per DryRun/Confirm gesetzt werden
- `manual`: Auto-Run prueft nur, ob ein Lineup vorhanden ist
  - fehlt es, blockiert der Flow mit `missing_manual_lineup`
- `passive`: wird in V1 nicht automatisch ersetzt
  - fehlt es, blockiert der Flow mit `passive_missing_lineup`
- bestehende Lineups werden nur mit Overwrite-Option ersetzt

### Nicht enthalten
- keine AI-Transfers
- keine AI-Verkaeufe
- keine Prisma-Writes

## AI-Transfermarkt Buy Preview

### Status
- umgesetzt
- Modus: read-only

### Scope
- AI-Teams
- Cash, Roster, Gehalt, Marktwert, Need und Strategy Profile fliessen ein

### Nicht enthalten
- kein Kauf
- kein Auto-Apply
- kein Prisma

## AI-Sell Preview

### Status
- umgesetzt
- Modus: read-only

### Scope
- AI-Teams
- Kader, Vertrag, Gehalt, Marktwert, Strategy Profile

### Wichtige Ehrlichkeitsregel
- `expectedSellValue` nur mit echter Quelle
- wenn VK-Faktoren fehlen:
  - Feld bleibt `—` / `null`
  - Warnung statt Heuristik

## AI-Market Plan Preview

### Status
- umgesetzt
- Modus: read-only
- Route: `/api/ai/market-plan-preview`

### Kombiniert
- AI-Buy Preview
- AI-Sell Preview
- Team Strategy Profile
- Team Control Settings

### Status pro Team
- `hold`
- `buy_only`
- `sell_only`
- `sell_then_buy`
- `warning`
- `blocked`

## AI-Market Apply

### Status
- umgesetzt
- Modus: lokaler Write
- Route: `/api/ai/market-plan-apply`

### Regeln
- DryRun-first
- Confirm fuer Execute
- nur `source=sqlite/local`
- nur `controlMode=ai`
- `manual` / `passive` werden uebersprungen
- Sell-before-Buy
- Buy nur ueber bestehenden lokalen Buy-Service
- Sell nur ueber bestehenden lokalen Sell-Service
- Sell wird geblockt, wenn `expectedSellValue` fehlt
- Execute braucht explizite Transferphase:
  - `transferPhase=manual_transfer_window`

### Nicht enthalten
- kein Auto-Apply im Matchday Auto-Run
- kein Prisma
- keine neuen Preisformeln

## Whole Season Simulation

### Status
- teilweise umgesetzt
- nur DryRun
- keine echte Season-Execute-Automation

### Verhalten
- verwendet eine isolierte In-Memory-Kopie des lokalen Saves
- simuliert Matchdays ueber den vorhandenen lokalen Auto-Run
- stoppt sauber bei Blockern

## Saison-Snapshots / Historie

### Status
- teilweise umgesetzt
- lokale Season-Snapshot-Struktur vorhanden
- Snapshot-Service vorhanden
- finaler Cash/Prize-Apply des letzten Matchdays schreibt Season Snapshot lokal mit

### Nutzen heute
- echte Historie fuer Teams / ewige Tabelle / Player-Historie vorbereitet

### Noch offen
- volle Produktoberflaeche fuer Historiennavigation
- breitere AI-Nutzung historischer Daten
- ein eigener `Development Preview`-Layer fuer aktive Kaderspieler fehlt noch:
  - nur aktive Spieler
  - keine Free Agents
  - `expectedPps`, `ppDelta`, `developmentScore`, `inactivityRisk`
  - Trait-Rohwert, gedampfter Wert, Multiplier und Cap-Hinweis
  - Player-History nur aus echten `seasonSnapshots[]`

## Bewusst offen / nicht umgesetzt
- Formkarten-Automation
- Mutator-Automation
- Whole Season Execute
- Auto-Transfer im Matchday Auto-Run
- Auto-Buy / Auto-Sell ohne Confirm
- Marktwert-Neuberechnung / Player Progression

## Bekannte Warnungen
- fehlende Formkarten-/Mutator-Quellen erzeugen weiter offene Warnings
- `expectedSellValue` ist nicht fuer alle Kandidaten belegbar
- Next-Build zeigt weiter die bekannte nicht-blockierende Turbopack-NFT-Warnung

## Empfohlene naechste Schritte
1. Transferfenster-/Market-Timing-UX absichern
2. VK-Faktoren / `expectedSellValue` fachlich staerker belegen
3. Formkarten und Mutatoren als echte Quellenblock entscheiden
4. `Matchday Resolve V2` abschliessen
5. `AI Needs/Picks Compare` read-only gegen Retool-/Golden-Master-Quellen fahren
6. danach `Development Preview + echte Player-History-Snapshots` auf aktive Kaderspieler und echte Season-Snapshot-Quellen aufsetzen
7. erst danach Whole Season Execute oder weitergehende AI-Automation
