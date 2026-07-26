# UI-Audit — Olympiade der Welten

**Datum:** 2026-07-26 · **Umfang:** `app/foundation/**` (176 `.tsx`, ~96k Zeilen), `app/globals.css` (71.488 Zeilen), `components/foundation/new-look/**`, relevante `lib/foundation/**`
**Methode:** 4 parallele, rein lesende Analysen (CSS-Redundanz · Component-Redundanz · Inline-Styles/Helfer · Mega-Files/Struktur). Keine Datei wurde geändert.

---

## Kernbefund (Executive Summary)

Die UI ist funktional, trägt aber die **Altlast einer nicht abgeschlossenen „Neuer Look"-Migration**: Der neue Look ist bereits committet und wird überall live gerendert — **aber die alten Implementierungen wurden nicht entfernt**. Dadurch existieren zwei komplette Design-Systeme nebeneinander, dazu tote Dateien, leere Durchreich-Wrapper und drei konkurrierende Formatter-/Token-Quellen.

Das Aufräumpotenzial ist groß und **überwiegend risikoarm** (Löschen von totem Code, Einklappen von Wrappern), mit einem kleineren Anteil echter Konsistenz-Bugs (widersprüchliche Formatter) und einem großen, bereits geplanten Struktur-Thema (Monolithen).

**Grobe Größenordnung sofort entfernbar / konsolidierbar:** ~6.000 Zeilen toter TSX-Code + geschätzt **~40 % der 71k-Zeilen-CSS** + ~15 überflüssige Wrapper-Dateien.

---

## Zahlen-Snapshot

| Metrik | Wert |
|---|---|
| `.tsx` in `app/foundation` | 176 |
| `app/globals.css` | 71.488 Zeilen / 1,64 MB, ~10.820 Regelblöcke, 6.183 Klassen |
| Davon „Neuer Look" (hinter `.is-new-look`) | ~29.000 Zeilen (~40 %) |
| Geschätzt tote CSS-Klassen | ~40 % (Stichprobe 61/154) |
| Farb-Literale in CSS | 5.427 `rgba()` + 887 Hex (420 verschiedene) vs. 290 Tokens / 6.386 `var()` |
| `style={{…}}` in TSX | 888 (254 in ~50 Nicht-Arena-Dateien) |
| Farb-Literale in echter UI-TSX (ohne Arena) | 79 |
| `— `-Guard-Idiom (`value == null …`) | 79× wiederholt |
| Größte Einzeldatei | `use-foundation-shell-router-body-scope.tsx` — **11.438 Zeilen** |

---

## A. Toter & redundanter Code — größte, risikoärmste Quick Wins

### A1. Drei tote Legacy-Implementierungen (nur noch Typ-Überlebende) — ~4.300 Zeilen 🔴
Die Datei enthält jeweils eine vollständige, exportierte Komponente, die **nirgends gerendert** wird — sie überlebt nur, weil ein Geschwister ihren `…Props`-**Typ** importiert.

| Datei | Zeilen | Live-Konsument |
|---|---|---|
| `team-settings/FoundationTeamSettingsPanel.tsx` | 2344 | `…Host` rendert `…NewLook`, importiert nur `…Props` |
| `legacy-lineup-lab-v2/LegacyLineupFocusV2Board.tsx` | 1731 | dynamisch importiert, aber **nie als JSX** verwendet |
| `ranks-v2/FoundationDiszisPanel.tsx` | 223 | `…Host` rendert `…NewLook`, importiert nur `…Props` |

**Fix:** Komponenten-Body löschen, `…Props`-Typ in `*-types.ts` verschieben (Konvention existiert bereits, z. B. `home-v2-types`).

### A2. Vier komplett tote Dateien (kein Import, kein Render) — ~1.670 Zeilen 🔴
| Datei | Zeilen | Notiz |
|---|---|---|
| `discipline-stage/arena/MiniDmArenaBattle.tsx` | 865 | 0 Referenzen |
| `discipline-stage/DisciplineStageEndScreen.tsx` | 550 | 0 Referenzen |
| `discipline-stage/DisciplineStageStandingsDelta.tsx` | 255 | 0 Referenzen |
| `facilities-v2/FacilityGridCard.tsx` | 41 | nur von 2 Contract-Tests als Quelltext gelesen; `FacilitiesV2NewLook` baut eigenes Karten-Grid |

**Fix:** löschen (bzw. `FacilityGridCard` wieder in `FacilitiesV2NewLook` einbinden — es war offensichtlich als geteilte Karte gedacht).

### A3. ~40 % tote CSS-Klassen 🔴
Stichprobe (jede 40. Klasse, 154 Stück): 61 (~40 %) ohne jede Referenz in `app/` + `lib/`. Konkrete Beispiele: `arena-v2-hero-metrics`, `market-v2-wishlist-row`, `season-v2-bottom-panel`, `nl-table-sort-th`, `player-drawer-affinity-row`, `team-drawer-relations-column` …
**Fix:** echte Usage-Analyse (PurgeCSS o. Ä., dynamische `nl-…`-Fragmente berücksichtigen), dann löschen.

### A4. Durchreich-Wrapper ohne Eigenlogik (Host → Panel → Client → NewLook) 🟡
Viele migrierte Views behalten 1–3 Wrapper-Schichten, deren Body nur `return <XNewLook {...props} />` ist (u. a. Ranks 3-tief, Diszis, TeamSettings, Home, Facilities, Inbox, Scouting, PlayerGenerator, AllTimeTable, LeagueLeaders, Sponsors, Prize).
**Fix:** Schichten entfernen, Router direkt auf `*NewLook` zeigen lassen → ~15 Dateien entfallen.

### A5. Redundante v2-Lineup-Route 🟡
`legacy-lineup-lab-v2/page.tsx` reicht `uiVariant="focusV2"` durch, das die Ausgabe **nicht mehr ändert** (Client rendert immer `LineupNewLook`). Die drei Dev-Lab-Routen (`legacy-lineup-lab`, `legacy-resolve-lab`, `transfermarkt-lab`) sind zudem nur per Direkt-URL erreichbar (keine Nav-Links).
**Fix:** v2-Route entfernen; Dev-Labs hinter Dev-Guard.

---

## B. Dupliziertes Design-System / Primitive

### B1. Zwei vollständige Design-Systeme in einer CSS-Datei 🔴
`globals.css` ist faktisch zweigeteilt: ~Zeile 1–42.680 „Legacy", ~42.680–71.488 (~29k Zeilen) ein zweiter kompletter „Neuer Look" hinter `.is-new-look` (4.355 Vorkommen als Scope-Präfix). Der Legacy-Teil existiert weiterhin voll (`.legacy-*` = 479 Klassen, 1.485 Referenzen).
**Fix (höchste Hebelwirkung):** Sobald `.is-new-look` Default ist, Flag entfernen und Legacy-Hälfte löschen — plausibel **~40 % Dateireduktion**.

### B2. Gleiche Primitive vielfach unter parallelen Präfixen 🔴
Karten: **276** verschiedene `*-card`-Klassen über ≥10 Präfix-Familien (`foundation-/nl-/legacy-/market-/season-/team-/training-/…`). Drawer: **281** Selektoren (`player-drawer-*` 597 Refs, `team-drawer-*` 242). Chips/Pills/Badges: **213**. Tabellen: **78**.
**Fix:** kleines Set Basis-Komponenten + Modifier statt Präfix-Kopien.

### B3. `nl-*`-Primitive existieren, werden aber ungleich genutzt 🟡
Reifes System unter `components/foundation/new-look/` (`NlCard`, `NlTable`, `NlSubTabs`, `NlEmptyState`, `NlRankingDrawer`, `NlDeltaChip`, `StatChip` …). Adoption partiell:

| Primitive | genutzt | handgerollt daneben |
|---|---|---|
| `NlCard` | 33 | (gut) |
| `NlTable` | 9 | **23** rohe `<table>` |
| `NlSubTabs` | 16 | **17** eigene Tab-Bars |
| `NlRankingDrawer` | 8 | **25** eigene Drawer/Overlays |
| `NlDeltaChip` | 21 | **20** eigene ▲/▼-Indikatoren |
| **Star-Rating** | *kein Primitive* | **23** handgerollte `★`-Ratings |

**Referenz-Implementierung:** `all-time-table-v2/AllTimeTableNewLook.tsx` (komponiert sauber aus `nl-*`).
**Fix:** Migration auf `nl-*`; **`NlStarRating` neu einführen**.

---

## C. Fragmentierte Formatter & Tokens — teils echte Konsistenz-Bugs

### C1. Drei konkurrierende Formatter-Quellen + lokale Kopien 🔴
Zentral existieren `components/foundation/new-look/nl-format.ts` **und** `lib/foundation/tabs/foundation-format-render-helpers.ts` (überlappen sich) — und werden trotzdem lokal neu implementiert.
**Echte Bugs, nicht nur DRY:**
- `formatScore` in **5 Dateien mit 3 verschiedenen Verhalten** (de-DE 0-Stellen vs. `formatNlNumber(…,1)` vs. `toFixed(1)`) → gleicher Score, verschiedene Ausgabe.
- `formatMoney` in `PlayerDetailDrawer` (wrappt `formatNlMoney`) vs. `foundation-format-render-helpers.ts:50` (bare de-DE, 1 Stelle) → widersprüchliche Regeln.
- Byte-identische Kopien: `formatValue`, `formatWholeNumber`, `formatPpsValue`, `formatSignedTransfermarktCurrency`, `formatSignedPercent`, `getInitials` (×4), `formatContractShapeLabel` (×3).
- Das `— `-Guard-Idiom **79×** wiederholt.

**Fix:** EINE Heimat (das `new-look`-Modul), `foundation-format-render-helpers.ts` einfalten/re-exportieren, lokale Kopien löschen. Startpunkt: Transfermarkt-Hosts + `PlayerDetailDrawer` (~50 lokale `format*`).

### C2. Delta/Tone-Picker umgehen `nlToneClass`/`NlDeltaChip` 🟡
`nlToneClass` + `NL_TONE_VAR` + `<NlDeltaChip>` existieren, trotzdem ~10 ad-hoc Tone-Picker (`getDeltaToneClass`, `getAxisToneClass`, `deltaTone`, `getNlTransferToneClass` …), die dieselben ±1-Schwellen neu kodieren.
**Fix:** auf `nlToneClass` + ein `deltaTone(value)`-Primitive standardisieren; Deltas über `<NlDeltaChip>` rendern.

### C3. Hartkodierte Farb-Paletten umgehen die Token-Ebene 🟡
79 Farb-Literale in echter UI-TSX (ohne Arena). Schlimmste: `season-v2/SeasonStandingsV2Client.tsx` (**32**, kompletter `seasonV2TeamTagColorMap` als rgba/Hex-Objekt), `player-profile/PlayerAttributeProgressChart.tsx` (`ATTRIBUTE_COLORS`-Hex-Map + inline-Fallbacks). In CSS: 420 verschiedene Hex, viele Fast-Duplikate (`#fff`/`#ffffff`/`#f7fbff`/…).
**Fix:** Farb-Maps in CSS-Variablen / `classVisuals.ts` / `NL_TONE_VAR`; Palette konsolidieren; gegen rohe Farb-Literale linten.

### C4. Inline-Styles mit statischem Spacing 🟢
254 Nicht-Arena `style={{…}}`, viele statische Magic-Numbers (`marginTop: 12/14` wiederholt, v. a. `FoundationCockpitPanel.tsx` 53×). Dynamische (Breiten, %, Transforms) sind legitim.
**Fix:** statisches Spacing → Utility-Klassen/Spacing-Token.

### C5. `clamp` mehrfach dupliziert 🟢
Byte-identisch in 4 Arena-Dateien + 2× in `lib` + viele in `lib/ai`. → ein geteiltes `clamp`.

---

## D. Struktur / Mega-Files (großes, teils bereits geplantes Thema)

> Es gibt bereits einen aktiven Dekompositions-Plan: `docs/foundation-monolith-split-plan.md`.

- **`lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx` — 11.438 Zeilen**: der eigentliche Monolith (Zustand/Logik hinter dem Shell-Router). Höchste Priorität im Backlog.
- **`cockpit-v2/FoundationCockpitPanel.tsx` (3131)**: ~154-Props-Komponente, 0 Hooks (rein präsentational), **18 copy-paste „cockpit-step"-Blöcke** + 17× wiederholtes Status-Pill-Markup → `<CockpitStepCard>` / `<StatusPill>` extrahieren (~700 Zeilen weg, mechanisch).
- **`LegacyLineupLabClient.tsx` (7283)**: klar trennbare Schichten — Typen (`:100-608`), ~60 reine Formatter (`:1113-1604`), 4 modul-scope Sub-Komponenten, dann eine ~5300-Zeilen-Gott-Komponente (49 `useState`, 86 `useMemo`).
- **`PlayerDetailDrawer.tsx` (3706)**: 67 Top-Level-Helfer + mehrere ganze Panels colocated (`PlayerComparePanel`, Star-Displays, „Top-Disciplines"-Sortier-Tabelle).
- **`DisciplineStageNativeArena.tsx` (3537)**: verstreute `prim === …`-Verzweigung statt Strategy-Map → `Record<Primitive, Renderer>`.
- **`FoundationShellRouterBody.tsx` (3060)**: `activeView === …`-Kette über ~40 Views → Lookup-Registry; zudem **dopplter dynamic-import-Block** auch im Scope-Hook.
- **`FoundationPlayersTableNewLook.tsx` (2762)**: zwei große Komponenten in einer Datei (`FoundationPlayersHub` sofort auslagerbar).
- **Cross-File:** drei unabhängige sortier-/spaltenkonfigurierbare Tabellen (Lineup, Drawer, Players) — obwohl ein geteiltes `SortableHeader`/`ColumnVisibilityManager` bereits existiert (das Cockpit bekommt es als Prop).

---

## Priorisierte Roadmap (Wert ÷ Risiko)

**P0 — Toten Code löschen (risikoarm, sofort):**
1. 3 Typ-only-Legacy-Bodies entfernen (~4.300 Z.), Typen in `*-types.ts`.
2. 4 tote Dateien löschen (~1.670 Z.).
3. CSS-Purge-Lauf → ~40 % toter Klassen weg.
4. Redundante v2-Lineup-Route entfernen, Dev-Labs guarden.

**P1 — Entkopplung & Konsistenz (kleiner, hoher Nutzen):**
5. Durchreich-Wrapper einklappen (~15 Dateien).
6. Formatter auf EIN Modul konsolidieren (behebt `formatScore`/`formatMoney`-Inkonsistenzen).
7. Delta/Tone auf `nlToneClass` + `<NlDeltaChip>` vereinheitlichen; `clamp` teilen.

**P2 — Primitive & Tokens:**
8. `NlStarRating` einführen; 23 rohe `<table>` / 17 Tab-Bars / 25 Drawer auf `nl-*` migrieren (Referenz: `AllTimeTableNewLook`).
9. Farb-Maps → Token-Ebene; statisches Inline-Spacing → Utility-Klassen; Lint gegen rohe Farben.

**P3 — Monolithen (groß, testgesichert):**
10. `<CockpitStepCard>`/`<StatusPill>`, Schichten-Extraktion aus `LegacyLineupLabClient`/`PlayerDetailDrawer`, Arena-Primitive-Registry, Shell-View-Registry.
11. `use-foundation-shell-router-body-scope.tsx` (11.438 Z.) weiter aufteilen — größter Einzel-Monolith.
12. `globals.css` nach Feature in co-lokalisierte Dateien splitten.

---

*Rein analytisch erstellt — keine Code-Änderung. Evidenz (Datei:Zeile) liegt je Befund vor und kann auf Wunsch pro Punkt vertieft werden.*
