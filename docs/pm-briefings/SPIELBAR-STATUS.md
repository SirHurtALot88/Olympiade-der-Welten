# Spielbar-Status — Solo (1 Team)

**Ziel:** Ein Solo-Spielstand, ein manuelles Team, voller Spieltag-Loop ohne Dead-End.

**Letzter Smoke:** 2026-06-27 (Dead-Zones-9/10: Room-URL-Persistenz, MP-E2E Foundation-Arena, CI dedizierter Smoke-Save)

| Check | Status | Notiz |
|-------|--------|-------|
| Production Build | 🟢 | `npm run build` grün (SQLite aus Client-Bundle) |
| CI flow-smoke | 🟢 | Blocker-Routing, Inbox-Apply, Season-Readiness, Fatigue→Inbox (`npm run ci:flow-smoke`) |
| CI import-exists | 🟢 | `npm run ci:import-exists` — keine orphan `@/lib`-Imports |
| Client-Bundle-Lint | 🟢 | `npm run ci:client-bundle-lint` — kein sqlite/local-service in Foundation-Client |
| Perf regression | 🟢 | `npm run perf:regression-smoke` (<250ms Version-Metadata) |
| Playwright gameplay | 🟢 | Read-only-Gate via `contentSignature`; dedizierter CI-Smoke-Save |
| MP E2E in CI | 🟢 | `app:smoke-multiplayer-e2e` inkl. Foundation-Arena-Reveal-Sync |
| Save laden | 🟢 | Dev-Server lädt Long Run Sandbox mit A-A · Armageddon Aftermath |
| Home Top-6 Karten | 🟢 | POW/SPE/MEN/SOC ohne Noten; CA absolut + PO-Range (kein „Gering“/„F“) |
| Home/Inbox: nächster Schritt | 🟢 | Flow + Inbox Quick-Actions (Training leicht, Später) + Health-Priorität |
| Sidebar-Reihenfolge | 🟢 | Drag pro Gruppe, localStorage persistiert nach Reload |
| Entity-Navigation (Klick) | 🟢 | Spieler-/Teamnamen öffnen Profil per Single-Click; Escape/Backspace navigiert zurück |
| Escape-Back Profil | 🟢 | Teams → Spieler → Escape kehrt zu Teams zurück (kein URL-Sync-Dead-End) |
| Training setzen | 🟢 | "Weiter" navigiert korrekt zu `trainingCompact` (Trainingsmodus) statt Gebäude |
| Transfermarkt: nur eigenes Team | 🟢 | Buy disabled + Modal-Guard |
| Verhandlung: Feedback bei Abbruch | 🟢 | Meldung beim Schliessen |
| Lineup + Formkarten | 🟢 | Pool-Pflicht; Zuweisung optional mit klarer Copy (`formcards_assignment_optional`) |
| Board-Ziele im Loop | 🟢 | Flow-Warnungen + Inbox-Tasks bei failed/at_risk; Team-Panel `board-objectives` |
| Preseason Cockpit | 🟢 | Flow warnt bei offenem Preisgeld/Entwicklung; `prepare_season` zeigt Restschritte |
| Lineup bestätigen (submitted) | 🟢 | Pflicht — UI zeigt Blocker + Button "Lineup bestätigen" |
| Arena startet | 🟢 | Nach Lineup-Bestaetigung — Flow-Gate aktiv |
| Arena Ergebnisse scrollen | 🟢 | Globaler-Next scrollt direkt zu `#arena-result-summary` statt Arena-Top |
| Spieltag abschliessen | 🟢 | Auto-Prep (Formkarten/Lineups) vor Auto-Run; Vertrags-Inbox blockiert Matchday-Flow nicht mehr |
| Nächster Spieltag | 🟢 | Nach auto-run → homeV2 mit Training/Lineup für neuen Spieltag |
| Gehalt/MW-Delta-Stack | 🟢 | Deltas unter Wert in Kader-Tabelle, Roster-Grids und Home-Karten |
| Ranira Bold Italic | 🟢 | `font-style: italic; font-weight: 700` auf Body/Foundation-Shell |

## Economy P0 (2026-06-27)

| Check | Status | Notiz |
|-------|--------|-------|
| Cash-Prize nur Benchmark | 🟢 | `cashPrizeApplyLogs=0` auf frischem S1-Audit-Save |
| Sponsor AI `base_first` deferred | 🟢 | Nur manuelles Team darf `base_first`; Verify filtert AI-Teams |
| Season-End Sponsor Settlement | 🟢 | 35× `season_end` nach S1 (`fresh-season-1-1782553543626`) |
| Repair-Buy Cash | 🟢 | Keine `preseason_roster_repair_buy` mit Fee=0 / negative Cash |
| Economy Audit Script | 🟢 | `npx tsx scripts/verify-cash-economy-audit.ts --save-id <id>` |
| Realistic Multi-Sim Report | 🟢 | `economyAudit` Block in `scripts/season-realistic-multi-sim.ts` |

Legende: 🟢 OK · 🟡 teilweise / Re-Test nötig · 🔴 blockiert

## Technische Readiness (Multiplayer-Vorbereitung)

| Bereich | Score | Status | Notiz |
|---------|-------|--------|-------|
| Solo Loop Wiring | **10/10** | 🟢 | `ci:flow-smoke` + Blocker-Routing + Write-Smoke (Inbox/Training/Matchday) |
| Build / Client-Server | ~9/10 | 🟢 | TrainingCompact + Resolve-Blocker client-safe; `ci:client-bundle-lint` |
| Arena + Reveal (Solo) | ~9/10 | 🟢 | Arena/Einsatzliste/Training/Drawer in CI grün |
| Room Arena Sync | ~9/10 | 🟢 | Unit + 2-Browser Foundation-Arena-E2E in `app:smoke-multiplayer-e2e` |
| Foundation ↔ Room | ~9/10 | 🟢 | Room-Params in URL-Navigation; Banner mit Flow-Step; `roomContext` an Sub-Panels |
| Server-Authority (Writes) | ~9/10 | 🟢 | Guard + Contract-Test für mutierende API-Routes; Host-only AI/Season-Writes |
| Parallel Coach UX | ~9/10 | 🟢 | Warten/Host-only in Foundation-Banner + Arena; Room-Event-Hinweise |

Legende Score: technische Verdrahtung, nicht Spielspaß.

## Was noch 🟡 ist

- **Manueller 15-Min-Playtest S1→S2** — Checkliste [playtest-checklist.md](./playtest-checklist.md) einmal im Browser; automatisierter Proof: `npm run ci:flow-smoke` + `app:smoke-gameplay-write -- --confirm-testsave`
- **Spielgefühl Feintuning** — System-Verknüpfungen sind sichtbar (Training-AI, Health-Inbox, Arena-Recap); menschlicher Proof bleibt Playtest-Ritual

## Gameplay 10/10 Proof (2026-06-26)

| Dimension | Status | Proof |
|-----------|--------|-------|
| Blocker → Fix-Pfad | 🟢 | `tests/flow-blocker-routing.test.ts` — alle playtest-checklist IDs geroutet |
| Inbox Entscheidungen | 🟢 | Quick-Actions: Training leicht, Später, Lineup — `inbox-quick-action-service` |
| Load/Verletzung sichtbar | 🟢 | Lineup-Slot Issues + Training AI-Empfehlung + Health-Inbox |
| Saison-Bogen | 🟢 | Preseason/Season-End Checklist in Manager Office |
| Arena → Chronik | 🟢 | Spieltag-Recap in Inbox Chronik (`story:matchday_recap`) |
| Cross-System | 🟢 | `tests/fatigue-injury-inbox-integration.test.ts` |

## Performance (2026-06-27)

| Change | Effekt |
|--------|--------|
| Arena `includeDetails=0` | Erster Arena-Load ohne Resolve/Standings auf dem Basis-Endpoint; Details per `/api/resolve/legacy-matchday-preview` + `/api/standings/preview` |
| `FoundationSeasonV2Panel` | Saisonstand aus Monolith extrahiert; Feed nur bei aktiver Season-View |
| Home Management Feed | Nur noch bei Home-Tab „Office“, nicht mehr beim Overview-Start |
| Saisonstand UX | Top-5 + eigenes Team, Finanzspalten default eingeklappt, Tabellen-Skeleton |

## Performance (2026-06-26)

| Change | Effekt |
|--------|--------|
| `FoundationHomeV2Panel` | Home/Office aus 31k-Zeilen-Monolith extrahiert; View unmountet wenn inaktiv |
| `save-session-cache` | Version-Reload ohne Full-Save (bereits in CI) |
| `shouldBuild*` Gating | Schwere Feeds nur bei aktiver View |

## Fix Loop 3 — Foundation Nav-UX (2026-06-25)

| Fix | Bereich | Problem | Lösung |
|-----|---------|---------|--------|
| Single-Click-Profile | Foundation, Season V2, Historie, Arena, Einsatzliste | Doppelklick-Mentalmodell, extra Sprung-Buttons | `table-link-button` auf Namen; Zeilen-Doppelklick entfernt |
| Classic Home entfernt | FoundationPageClient | Parallele Home-UI neben homeV2 | Panel gelöscht; URL `home` → `homeV2` |
| Classic Season entfernt | FoundationPageClient | Parallele Saison-UI neben seasonV2 | Classic-Panel gelöscht; Redirect bleibt |
| Tote Cross-Nav-Props | V2 Clients | `onOpenClassic*`, `onOpenHomeV2` ungenutzt | Props aus Types und Clients entfernt |
| Keyboard-Back | FoundationPageClient | Escape/Backspace nur für Drawer | `foundationNavigateBack()` + History-Stack verdrahtet |
| Economy-Stack MW | Team-Kader | MW-Delta neben statt unter Wert | `.economy-money-stack` auch für MW-Spalte und Roster-Grids |
| Build TS | Sponsor-Services | `computeWeightedHistoricalRank(null)` + Tier-Cast | Null-Guard + `SponsorStarTier`-Cast in sponsor-tier-pool |
| Resolve-Lab Nav | LegacyResolveLabClient | Doppelklick auf Spieler | Namens-Links per `table-link-button` |

## Bekannte Einschränkungen (v1)

- Nur **Solo 1 Team** — Online 4v4 kommt später
- V2-Preview-Screens (Scouting Hub etc.) sind optional, nicht Teil des Loops
- GM-Story / Hot Seat ist Design-Feedback, kein SP-Blocker
- Automatischer Smoke: `npm run app:smoke-gameplay` (CI + Entwickler-Check; lokal einmalig `npx playwright install chromium`)
- Transfermarkt-Wishlist: Doppelklick auf Kandidat öffnet weiterhin Kaufdialog (bewusst)

## Vollständiger Solo-Loop (8-9/10)

```
Home (nächster Schritt angezeigt)
  → Training setzen (alle Spieler · speichert sofort)
  → Transfermarkt optional (nur eigenes Team)
  → Lineup Lab (Slots füllen · Formkarten · "Lineup bereit speichern")
  → Arena (Reveal läuft · "Spieltag abschliessen" klicken)
  → Home (neuer Spieltag · Training wieder dran)
```

## Dein Playtest (15 Min)

1. `npm run play` → Browser öffnet Foundation
2. Checkliste: [playtest-checklist.md](./playtest-checklist.md)
3. Sidebar-Reihenfolge ändern → Reload → persistiert
4. Home → Spielername → Profil; Zurück via Escape oder Sidebar
5. Teams → Kader → Name → Profil; Gehalt/MW-Delta unter Wert
6. Transfermarkt → Kandidat → Name/Portrait → Profil
7. Historie → Spieler/Team klickbar
8. Bugs melden mit Vorlage aus dem Plan (Ziel / Erwartung / Ist-Zustand)

## Save schützen

```bash
npm run backup:save
```
