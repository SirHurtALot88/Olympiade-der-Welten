# Current Project Handoff

Stand: 2026-06-06

## Kurzfassung
- `sqlite/local` ist die einzige schreibbare Source of Truth fuer den normalen Produktfluss.
- `prisma` / Referenzmodus bleibt read-only und darf keine normalen Apply-, Buy-, Sell- oder AI-Write-Pfade ausfuehren.
- Der lokale Spieltagsfluss ist funktional von Transfermarkt ueber Einsatzliste bis Matchday Advance aufgebaut.
- AI-Lineup ist lokal produktiv nutzbar.
- AI-Transfer/AI-Sell/AI-Market-Plan existieren als Preview, Market Apply existiert lokal mit Confirm.
- Whole Season Simulation ist bewusst nur DryRun.
- Season Snapshots sind lokal angebunden, aber Season-End als eigener Produktblock ist noch nicht abgeschlossen.

## Source Of Truth

### Schreibbar
- `source=sqlite/local`
- lokaler Save in SQLite
- lokale Apply-Pfade:
  - Einsatzlisten Save
  - AI-Lineup Apply / Batch Apply
  - Transfermarkt Buy/Sell lokal
  - Resolve Result Apply lokal
  - Standings Apply lokal
  - Cash/Prize Apply lokal
  - Matchday Advance lokal
  - AI-Market Apply lokal

### Read-only
- `source=prisma`
- Referenz-/Vergleichsansicht
- keine normalen Produkt-Writes
- APIs muessen im Prisma-Modus blockieren, sobald Buy/Sell/Apply ausgefuehrt werden soll

## Lokale Spieltagskette

Der aktuell vorhandene lokale Flow ist:

1. Fresh Season 1 lokal starten
2. Transfermarkt Buy/Sell lokal
3. Einsatzlisten manuell oder per AI vorbereiten
4. Resolve Preview
5. Result Apply lokal
6. Standings Preview / Apply lokal
7. Prize Preview / Cash Apply lokal
8. Matchday Advance lokal

Wichtige Regeln:
- kein Prisma-Write
- keine versteckten Multi-Actions
- DryRun/Preview vor Execute, wo der Pfad das verlangt
- fehlende Quellen bleiben offen statt erfunden

## Wirklich umgesetzt

### Kernfluss lokal
- Fresh Season 1 erzeugt 32 Teams, Season 1, Cash = Budget, Transferhistorie leer.
- Transfermarkt Buy/Sell schreibt lokal und aktualisiert Saisonstand, Teamwerte und Historie.
- Resolve Preview ist read-only und getrennt von Result Apply.
- Result Apply schreibt nur lokale Result-Strukturen.
- Standings Apply schreibt nur lokale Punkte/Raenge.
- Cash Apply schreibt nur lokalen Cash.
- Matchday Advance schliesst lokal den Spieltag ab.

### Cockpit
- Spieltag-Cockpit ist vorhanden.
- Matchday Auto-Run ist vorhanden.
- Manual-Team-Policy ist aktiv:
  - `manual` wird nicht von AI ersetzt
  - fehlendes manuelles Lineup blockiert mit `missing_manual_lineup`
- `passive` wird in V1 ebenfalls nicht automatisch ersetzt
  - fehlendes passives Lineup blockiert mit `passive_missing_lineup`

### Team Settings / Strategy Profiles
- `Team Settings` ist als eigene Foundation-Seite neben `Admin` vorhanden.
- Default-Identity-Rohwerte liegen in `data/source/team-identities.json` und stammen aus der Season-Management-Tabelle.
- Default-Strategy-Profile fuer alle 32 Teams liegen in `lib/foundation/team-strategy-profiles.ts`.
- lokale Werte werden in:
  - `gameState.seasonState.teamIdentityOverrides`
  - `gameState.seasonState.teamControlSettings`
  - `gameState.seasonState.teamStrategyProfiles`
  gespeichert.
- Speichern auf `Team Settings` loest keine AI-Aktion aus.

### Saisonstand / Teams / Transfermarkt
- Kernseiten sind lokal nutzbar.
- Saisonstand nutzt die feste Retool-nahe Reihenfolge.
- fehlende Finanz-/Historienquellen bleiben `—`
- keine Team-OVR/PPs/MVS-Fakewerte im Managementbereich

## Preview vs. lokale Writes

### Read-only / Preview
- AI-Lineup Einzel-Preview
- AI-Lineup Batch Preview
- AI-Transfermarkt Buy Preview
- AI-Sell Preview
- AI-Market Plan Preview
- Resolve Preview
- Standings Preview
- Prize Preview
- Whole Season Simulation DryRun

### Lokale Writes
- manuelles Lineup Save
- AI-Lineup Einzel-Apply
- AI-Lineup Batch Apply
- Transfermarkt Buy/Sell lokal
- Result Apply lokal
- Standings Apply lokal
- Cash Apply lokal
- Matchday Advance lokal
- AI-Market Apply lokal

## AI-Lineup Stand
- Einzelteam Preview: umgesetzt, read-only
- Einzelteam Uebernahme in UI-Draft: umgesetzt
- Einzelteam lokal speichern: umgesetzt
- Batch Preview fuer alle Teams: umgesetzt
- Batch Apply lokal: umgesetzt
- Batch Apply respektiert Team Admin Settings:
  - `controlMode=ai` + `aiLineupApplyEnabled=true` = eligible
  - `manual` = skip
  - `passive` = skip
  - disabled AI = skip
- Cockpit zeigt AI-Lineup-Schritt als eigenen Hauptschritt

## AI-Transfermarkt Stand
- AI-Buy Preview fuer AI-Teams: umgesetzt, read-only
- nutzt reale lokale Quellen fuer Cash, Roster, Marktwert, Gehalt und Strategy Profile
- keine Kaeufe in diesem Preview-Block

## Player Generator Stand
- Player Generator bleibt lokal unter `seasonState.playerGeneratorDrafts[]`.
- Die UI zeigt den Generator jetzt explizit als `Player Draft Preview`.
- `Draft speichern` schreibt nur in `seasonState.playerGeneratorDrafts[]`.
- Ein gespeicherter Draft ist noch kein DB-Spieler und noch kein Free Agent.
- `axisIntent` ist optional und defaultet auf `auto`.
- Auto-Achsen werden aus Rolle + Fantasy-Archetyp abgeleitet und im Draft transparent als `resolvedAxisIntent` dokumentiert.
- Offizielle Diszi-Gewichtungen liegen hart in `lib/player-generator/official-discipline-weights.ts` und entsprechen der gelieferten User-Tabelle.
- OVR bleibt ein lokaler Draftwert auf der normalen 1-100-Skala.
- PPs bleiben der Durchschnitt der echten Generator-Disziwerte.
- Attribute, Achsen, OVR, PPs und Disziwerte werden in der UI ohne Nachkommastellen angezeigt.
- MW / Gehalt bleiben bewusst blockiert:
  - `references/formulas/rank-to-discipline-market-value.json` fehlt
  - `references/formulas/class-factors.json` fehlt
- Klassenvorschlaege bleiben deshalb heuristisch markiert.

## AI-Sell Stand
- AI-Sell Preview fuer AI-Teams: umgesetzt, read-only
- `expectedSellValue` wird nur gezeigt, wenn echte Quelle vorhanden ist
- fehlende Verkaufsfaktoren bleiben `—` / `null`
- keine Verkaeufe im Preview-Block

## AI-Market Plan / Apply Stand

### Preview
- Buy + Sell werden zu einem read-only Transferplan kombiniert
- Status pro Team:
  - `hold`
  - `buy_only`
  - `sell_only`
  - `sell_then_buy`
  - `warning`
  - `blocked`

### Apply
- existiert lokal
- DryRun-first
- Execute nur mit Confirm
- nur fuer AI-Teams
- manual/passive werden uebersprungen
- Sell-before-Buy
- nur in expliziter Transferphase:
  - `transferPhase=manual_transfer_window`
- nicht Teil von Matchday Auto-Run

## Season Simulation Stand
- Matchday Auto-Run lokal: umgesetzt
- Whole Season Simulation: nur DryRun auf isolierter In-Memory-Kopie
- kein Whole Season Execute in diesem Stand

## Season Snapshots / Historie Stand
- lokale Season Snapshots sind im Modell vorhanden
- Snapshot-Service ist vorhanden
- finale Season-Snapshots werden beim finalen Cash/Prize-Apply des letzten Matchdays lokal mitgeschrieben
- Teams / ewige Tabelle / Player Drawer nutzen Snapshots bereits als echte Quelle an mehreren Stellen

Naechster fachlicher Ausbau in diesem Strang:
- `Development Preview + echte Player-History-Snapshots`
- Reihenfolge: erst nach `Matchday Resolve V2`, danach nach dem `AI Needs/Picks Compare`-Block
- Scope:
  - read-only Development Preview nur fuer aktive Kaderspieler
  - keine Free Agents
  - keine produktiven Attributwrites
  - Historienwerte im Player Drawer nur aus echten `seasonSnapshots[]`
  - `expectedPps`, `ppDelta`, `developmentScore`, `inactivityRisk` nur aus bestehenden lokalen Season-Performance-Signalen
  - `build:clean` / Next-Manifest-Flake als separates Infrastruktur-Gate dokumentieren, nicht mit Gameplay vermischen

Noch nicht fertig als Gesamtprodukt:
- eigener Season-End-Cockpit-Block
- breite Historienoberflaeche fuer Vorsaisons
- vollstaendige Sell-AI auf echter Langzeit-Historie fuer alle Faelle

## Offene Blocker / bewusste Luecken
- Transferfenster bleibt bewusst separater Phase-Block
- `expectedSellValue` / VK-Faktoren sind nicht fuer alle Faelle belegt
- Formkarten bleiben fehlende Quelle
- Mutatoren bleiben fehlende Quelle
- Marktwert-Neuberechnung / Player Progression existiert nicht
- Slots-/Gewichtungen-V2 sind nicht Teil des aktuellen Produktstands
- Whole Season Execute fehlt
- automatische AI-Transfers innerhalb Matchday Auto-Run sind bewusst verboten

## Bekannte Warnungen
- `next build` ist grün, zeigt aber weiter die bekannte nicht-blockierende Turbopack-NFT-Warnung rund um `next.config.ts` / lokale Persistence.
- Resolve-/Season-Smokes koennen weiter Warning-Texte fuer fehlende Formkarten- und Mutator-Quellen ausgeben. Das ist aktuell erwartetes Verhalten, kein Fakewert.
- `expectedSellValue` kann in AI-Sell/Market-Plan bewusst `—` bleiben, wenn keine echte Verkaufsquelle belegt ist.

## Nicht anfassen ohne neuen Fachblock
- keine Prisma-Writes fuer den normalen Produktfluss
- keine Fakewerte fuer Finanzen, Historie oder AI-Empfehlungen
- keine automatische AI-Uebernahme fuer `manual`-Teams
- keine Auto-Transfers im Matchday Auto-Run
- keine neue Marktwertformel
- keine Formkarten-/Mutator-Heuristiken
- keine stillen Source-of-Truth-Aenderungen
- Team-Identity-/Strategy-Defaults nicht wieder auf generische Seed-Platzhalter zurueckdrehen

## In diesem Audit wirklich geprueft
- `npm test -- tests/matchday-auto-run-service.test.ts tests/season-management-loop.test.ts tests/foundation-transfermarkt-ui-contract.test.ts`
- `npm run season:smoke-local-loop`
- `npm run project:audit-write-safety`
- `npm run build:clean`
- `npm run project:export-snapshot`
- `npm run app:check-live -- --base-url=http://localhost:3000`

## Snapshot-Artefakte
Aktuelle generierte Snapshot-Dateien liegen hier:
- `references/project-snapshots/current-app-snapshot.json`
- `references/project-snapshots/current-app-snapshot.md`
- `references/project-snapshots/current-app-file-manifest.json`

## Naechste empfohlene Aufgaben
1. Transferfenster-/Market-Timing in UI klarer machen, bevor weiterer AI-Market-Execute-Ausbau kommt.
2. `expectedSellValue` / Verkaufsfaktoren fachlich belegen oder bewusst weiter offen lassen.
3. Formkarten- und Mutator-Quellen sauber entscheiden.
4. `Matchday Resolve V2` abschliessen, damit der Gameplay-Pfad vor weiteren Preview-Schichten stabil ist.
5. `AI Needs/Picks Compare` als read-only Qualitaets-/Retool-Abgleich nutzen.
6. Danach `Development Preview + echte Player-History-Snapshots` fuer aktive Kaderspieler auf echte lokale Quellen aufsetzen.
7. Whole Season DryRun in einen besser lesbaren Saisonbericht ueberfuehren.
