# Verbesserungs-Backlog — Olympiade der Welten

**Stand:** 2026-07-17
**Quelle:** 136 Rohbefunde aus 15 Multi-Agent-Audit-Berichten → **107 priorisierte Backlog-Items** (dedupliziert & gemergt).
**Methodik:** Multi-Agent-Audit über **View-Cluster** (Home/Inbox, Lineup/Arena, Season/Ranks, Teams, Spieler-Tabelle, Training/Gebäude, Transfermarkt/Scouting, Finanzen/Kredite, Spielplan/Lexikon/Generator …) kombiniert mit **querschnittlichen Fable-Dimensionen** (Fog-of-War-Leaks, Ökonomie-Invarianten, Formatierungs-/Token-Drift, Dead-Code, Performance, Test-Integrität). Überlappende Befunde wurden zusammengeführt (stärkstes Wording behalten, Belege gemerged), dann nach **Wert = f(Severity, Effort)** gerankt: P1/S oben, P3/L unten; innerhalb gleicher Klasse gehen Bugs, Fog-Leaks und Ökonomie-Korrektheit vor reiner Politur.

---

## Sofort-Empfehlung: Top 10

Die zehn wertvollsten Items — maximaler Schaden bzw. maximaler Hebel bei geringem bis mittlerem Aufwand:

| # | ID | Titel | Warum jetzt |
|---|----|-------|-------------|
| 1 | **T-019** | Fog-of-War global durch Debug-Default aufgehoben | `DEBUG_FORCE_PLAYER_VISIBILITY` ist per Default `true`. Jedes Deployment ohne explizit gesetzte Env-Var zeigt allen Spielern exakte Attribute/Werte fremder, nicht-gescouteter Spieler — die gesamte Kernmechanik „Scouting" ist wirkungslos. P1, Effort S: Default drehen. |
| 2 | **T-020** | `player-sheet`-API ohne Zugriffsprüfung | Jeder Client mit gültiger `saveId` kann exakte Attribut-Sheets **jedes** Spielers abrufen — die Route umgeht die Visibility-Maskierung komplett. Server-seitiges Fog-Leck. |
| 3 | **T-021** | `ratings-slice`-API exponiert alle Spieler ungefiltert | Exakte Achsenwerte, Ränge und Marktwerte jedes Spielers ohne Team-/Scouting-Scope. Zweites Server-Leck derselben Klasse. |
| 4 | **T-023** | Finanzdaten im Player-Drawer immer im Klartext | Gehalt/MW/Kaufpreis fremder Spieler werden nie maskiert, obwohl Attribute es sind — inkonsistent und ein Fog-Leak an der wichtigsten Transferzahl. |
| 5 | **T-002** | Best-Fit / Top-Pick weist blockierte Kandidaten zu | Schnellzuweisung umgeht den Blocker-Check der Kandidatenliste; `updateSelection` validiert nicht — erzeugt real ungültige Aufstellungen. |
| 6 | **T-009** | Trainings-Season-Lock im Neuer-Look ignoriert | Intensitäts-Radios bleiben klickbar, obwohl der Modus laut Spiellogik fixiert ist — Manager „ändern" etwas, das serverseitig nicht greift. P1/S. |
| 7 | **T-010** | Downgrade-Tab zeigt hartkodierte „25 %" statt echter Erstattung | Irreführender Platzhalter im selben Format wie echte Zahlen — direkte Falschinformation vor einer Geldentscheidung. P1/S. |
| 8 | **T-029** | Cash-Reconciliation ignoriert Kredit- & Gebäude-Cashflows | Die einzige Cash-Invarianten-Prüfung berücksichtigt nur Transfer+Sponsor; echte Doppelbuchungen in Kredit-/Facility-Höhe bleiben unsichtbar. Ökonomie-Kernkorrektheit. |
| 9 | **T-088** | Vitest führt keinen Typecheck durch — ~243 tsc-Fehler bleiben grün | Testsuite meldet grün, obwohl Fixtures nicht mehr zum Produktionsschema passen. CI-Gate ergänzen — schützt alle folgenden Test-Fixes. P1/S. |
| 10 | **T-089** | Kein Cash-Invarianten-/Conservation-Test | Wirtschaftssimulation ist Kernmechanik, aber kein Test prüft Σ(Cash-Delta) == Σ(gelogged cashDelta) über Transfer/Loan/Sponsor/Rollover. |

---

## Backlog (gruppiert nach Kategorie)

### 🐞 Bug (18)

| ID | Titel | Problem | Vorschlag | Kat | Sev | Eff | Beleg |
|----|-------|---------|-----------|-----|-----|-----|-------|
| T-001 | Warnungs-Filter matcht formatierte statt roher Strings | `NL_HOME_HIDDEN_WARNINGS` filtert auf übersetzten Labels; der Host mappt aber vor Übergabe via `formatHomeWarningLabel` — Roh-Key-Einträge greifen nie, Filter reißt lautlos bei Wortlaut-Änderung. | Vor dem Label-Mapping auf den rohen Warning-Keys filtern; tote Roh-Key-Einträge entfernen. | bug | P2 | S | HomeV2NewLook.tsx:244-249 vs FoundationShellRouterBody.tsx:1875 |
| T-002 | Best-Fit / Top-Pick weist blockierte Kandidaten zu | Schnellzuweisung nutzt `getAvailableOptionsForSlot` (nur Slot-Kollision), nicht den `blockReason`-Filter der Kandidatenliste; `updateSelection` validiert nicht. | Denselben Blocker-Check wie in der Kandidatenliste anwenden, `topPickForActiveSlot` aus gefilterten Kandidaten ableiten. | bug | P1 | M | LegacyLineupLabClient.tsx:3247-3259; LineupNewLook.tsx:1572-1584,1838-1846 |
| T-003 | Score-Herkunft-Button: `title` statisch trotz toggelndem `aria-label` | `aria-label` schaltet um, `title="…aufklappen"` bleibt auch im aufgeklappten Zustand. | `title` analog zu `aria-label` dynamisch setzen. | bug | P3 | S | MatchdayArenaNewLook.tsx:1173-1178 |
| T-004 | Rang-Chip-Tooltip beschreibt falsche Kennzahl | Tooltip sagt „seit Saisonstart", `rankDiff` ist laut Code-Kommentar aber die saisonübergreifende Bewegung (ggü. letzter archivierter Saison). | Titel auf „ggü. letzter Saison" ändern oder Wert gegen Saisonstart berechnen. | bug | P2 | S | SeasonStandingsNewLook.tsx:600,795 vs Komm. 57-59 |
| T-005 | Podium-Label „Spitze" mehrdeutig bei Punktgleichstand | `gap >= 0 → "Spitze"` gilt auch für Platz 2 bei Gleichstand → Silber + „Spitze" gleichzeitig. | Für Nicht-Erste mit `gap===0` „Gleichauf", „Spitze" nur für index 0. | bug | P3 | S | SeasonStandingsNewLook.tsx:871-873 |
| T-006 | MW-/Gehalt-Hover öffnet falsche Roster-Entry-ID | Klick ruft `onOpenPlayer(row.playerId, row.playerId)` statt `…, row.id`; die extra erzeugte `activePlayerId` bleibt ungenutzt → falscher Roster-Eintrag. | `onOpenPlayer(row.playerId, row.id)` in beiden Panels. | bug | P2 | S | TeamProfileNewLook.tsx:1104-1113,1143-1163 |
| T-007 | `formatRankLabel` liefert nacktes „#" statt „—" | Bei `rank == null` erscheint ein unerklärliches, halb-leeres „#" (Free Agents/fogged) statt des sonst genutzten Gedankenstrichs. | Bei null/undefined „—" zurückgeben. | bug | P2 | S | PlayerDetailDrawer.tsx:367-369 (u.a. 2139,2247,2377) |
| T-008 | Team-Filter bleibt bei Scope „Free Agents" auf altem Wert | Select wird disabled, behält aber „Team X"; Rückwechsel reaktiviert überraschend den alten Filter. | Beim Scope-Wechsel Team-Filter auf `ALL` zurücksetzen. | bug | P3 | S | FoundationPlayersTableNewLook.tsx:1692-1707 |
| T-009 | Trainings-Season-Lock im Neuer-Look ignoriert | `TrainingCompactNewLook` liest `trainingIntensityLocked` nie; ReadOnly hängt nur an `managementLocked` — Radios bleiben klickbar, kein Hinweis. | Pro Zeile `row.trainingIntensityLocked` auswerten, Controls sperren, Hinweistext wie in `PlayerTrainingControls`. | bug | P1 | S | TrainingCompactNewLook.tsx:887 vs PlayerTrainingControls.tsx:99-184 |
| T-010 | Downgrade-Tab zeigt hartkodierte „25 %" | Upgrade/Wartung zeigen Live-Werte, Downgrade statisch immer `25%` unabhängig von Gebäude/Level/`refundAmount`. | Echten `matchingUpgradePreview.refundAmount` als Währung anzeigen, sonst „wird berechnet …". | bug | P1 | S | facility-ui-shared.tsx:234-242 |
| T-011 | Admin-Override täuscht Wirkung in Multiplayer vor | Checkbox immer klickbar, `adminOverride` wirkt serverseitig nur ohne `roomCode` — MP-Spieler sieht „Admin-Modus aktiv", Server ignoriert das Flag. | Checkbox nur in Singleplayer rendern/aktivieren (Flag durchreichen). | bug | P2 | S | FoundationCreditsNewLook.tsx:980-996; loan/originate/route.ts:54 |
| T-012 | Kreditsummen-Eingabefeld out-of-sync mit Slider/Chip | `onAmountInputChange` setzt Rohtext ins Feld, klemmt nur `amount` auf `maxAmount`; erst `onAmountBlur` korrigiert das Feld. | Eingabewert direkt auf `[0, maxAmount]` klemmen. | bug | P2 | S | FoundationCreditsNewLook.tsx:1006-1012 |
| T-013 | Free-Agent-Commit-Status im Diagnose-Drawer hartcodiert falsch | Diagnose zeigt fest „Deaktiviert", während der echte Commit-Button aktiv einen Free Agent erzeugt. | Statuskärtchen aus `commitDisabled`/`commitBlockers` ableiten. | bug | P1 | S | PlayerGeneratorPanelNewLook.tsx:1279-1282 vs 609-634 |
| T-014 | Team-Wechsel Prev/Next ignoriert aktiven Suchfilter | Grid filtert `filteredTeamSettingsTeams`, Prev/Next springt über volle `gameState.teams` → springt zu unsichtbaren Teams. | Prev/Next auf gefilterte Liste anwenden. | bug | P2 | S | FoundationTeamSettingsNewLook.tsx:1185-1229 |
| T-015 | „Erweitert"-Badge zählt Default-Zustand als aktiven Filter | `hidePoorFit` ist Default-true, wird aber in `advancedActiveCount` mitgezählt → „Erweitert · 1 aktiv" schon beim Laden. | Nur zählen, wenn vom Default abweichend. | bug | P2 | S | TransfermarktV2NewLook.tsx:846-849 |
| T-016 | Kein Ledger-Eintrag für Kredit-Auszahlung (Origination) | `team.cash` ändert sich bei Aufnahme direkt, ohne Log analog zu `loanApplyLogs`/`sponsorPayoutLogs` — Cash-Sprung aus Logs nicht rekonstruierbar. | `loanOriginationLogs`-Eintrag mit `cashDelta` schreiben. | bug | P2 | S | loan-service.ts:442-457 |
| T-017 | Gebäude-Unterhalt/-Ausbau verändert Cash ohne Ledger | `facility-maintenance/-upgrade-service` schreiben `team.cash` direkt, ohne Log — für Audit, Finanzen-Tab, Nachvollziehbarkeit unsichtbar. | `facilityCashLogs`-Ledger (Betrag/facilityId/action) einführen und einspeisen. | bug | P2 | M | facility-upgrade-service.ts:345; facility-maintenance-service.ts:177 |
| T-018 | Silent-Clamp auf 0 bei Kreditraten maskiert Überzahlungs-Bugs | `Math.max(0, cash + delta)` verschluckt ein potenzielles Leck lautlos (und `cash_reconciliation_delta` wird ohnehin gefiltert). | Statt Clamp Assert/Warn-Log, wenn `cash + delta < 0`, und in Audit sichtbar machen. | bug | P3 | S | loan-service.ts:700-701 |

### 🌫️ Fog-of-War-Leaks (9)

| ID | Titel | Problem | Vorschlag | Kat | Sev | Eff | Beleg |
|----|-------|---------|-----------|-----|-----|-----|-------|
| T-019 | Globaler Debug-Schalter hebt Fog-of-War per Default auf | `DEBUG_FORCE_PLAYER_VISIBILITY` ist Default-true (nur `…=0` schaltet ab) und zwingt `resolveAttributeVisibility` immer auf „exact" — alle sehen exakte Werte fremder Spieler. | Default `false` (Opt-in), Schalter serverseitig statt `NEXT_PUBLIC_` an Build-Flags koppeln. | fog | P1 | S | debug-player-visibility.ts:15-16; player-detail-drawer.ts:890-892 |
| T-020 | `player-sheet`-API liefert rohe Attribut-Sheets ohne Zugriffsprüfung | GET nimmt nur saveId+playerId, prüft kein Team, gibt `attributeSheetStats/Ratings` direkt zurück — Maskierung wird umgangen. | Route um teamId/Scouting-Kontext erweitern, durch dieselbe Visibility-Maskierung schicken. | fog | P1 | M | api/singleplayer-state/player-sheet/route.ts:22-32 |
| T-021 | `ratings-slice`-API exponiert exakte Werte aller Spieler | Liefert `rawOvrScore`, ppPow/Spe/Men/Soc (+Ränge), mvs, marketValue für jeden playerId — ohne teamId/Scouting-Scope. | Um requesting-teamId erweitern, serverseitig auf eigene/gescoutete Spieler maskieren. | fog | P1 | M | season-ratings-slice.ts:9-67; api/season/ratings-slice/route.ts:12-23 |
| T-022 | `player-directory-slice` liefert komplette Ratings-/Karriere-Maps ohne Scope | ratings/performance/careerStats für ALLE Spieler des Saves, ohne Team-/Scouting-Bezug. | Antwort nach anfragendem Team filtern/maskieren. | fog | P2 | M | player-directory-slice.ts:80-137; route.ts:50-57 |
| T-023 | Gehalt/MW/Kaufpreis im Drawer immer im Klartext | `resolvePlayerEconomyContract` läuft unabhängig von `attributeVisibility`; salary/marketValue/purchasePrice werden 1:1 durchgereicht, auch für „scouted". | `maskEconomyForVisibility()` einführen (bei ≠"exact" auf null/Bandbreite reduzieren). | fog | P1 | M | player-detail-drawer.ts:2542-2565,2678-2681 |
| T-024 | `potential`/`scoutPotential` roh statt gescoutet | `potential ?? null` und `scoutPotential` werden unmaskiert übernommen, obwohl `buildPlayerScoutPotential` ein Banding-Muster bietet. | Bei ≠"exact" durch scoutingLevel-basierte Bandbreite ersetzen. | fog | P2 | S | player-detail-drawer.ts:2635-2636 |
| T-025 | `boardTrust` (interne AI-Bewertung) unmaskiert geliefert | Board-Confidence (inkl. exakter MW/Gehalt als Input) wird unconditional geschrieben, auch für fremde Teams. | Bei ≠"exact" auf null/stark reduziert setzen. | fog | P2 | S | player-detail-drawer.ts:2307-2320,2567 |
| T-026 | Legacy-Lineup-Pfad nutzt denselben globalen Debug-Bypass | `buildPlayerDrawerDataFromLegacyContext` leitet Visibility aus dem Debug-Flag statt scoutingLevel/manageableTeamIds ab. | Gleiche `resolveAttributeVisibility`-Logik wie Haupt-Pfad. | fog | P2 | S | player-detail-drawer.ts:2705-2709 |
| T-027 | Möglicherweise zwei Cash-Quellen: GameState vs Prisma `teamSeasonState.cash` | Buy/Sell-Services schreiben Prisma-Cash, Kredite/Sponsoren/Preisgeld mutieren GameState-Cash — bei Parallelbetrieb Doppelbuchungs-Gefahr. | Verifizieren/dokumentieren, dass Pfade nie gleichzeitig aktiv sind; sonst Guard/Kommentar. | fog | P3 | S | transfermarkt-buy-service.ts:247-279; cash-prize-apply-service.ts:210-213 |

### 💰 Ökonomie-Invarianten (5)

| ID | Titel | Problem | Vorschlag | Kat | Sev | Eff | Beleg |
|----|-------|---------|-----------|-----|-----|-----|-------|
| T-028 | Cash-Reconciliation-Verstoß wird überall ausgefiltert statt zu blocken | `cash_reconciliation_delta` wird an allen drei Konsumstellen hart entfernt/nie als Blocker gewertet — die Prüfung kann nie einen Save als kaputt markieren. | Ab harter Schwelle (>5 % cashStart o. Fixbetrag) als echten Blocker zulassen. | economy | P2 | M | transfer-finance-audit.ts:43; long-run-phase-audit.ts:412-414; long-run-soft-blockers.ts:90-91 |
| T-029 | Reconciliation-Formel ignoriert Kredit- & Gebäude-Cashflows | Nur netTransfer+netSponsor; Kreditraten/-auszahlung und Facility-Cash fehlen → Toleranz künstlich groß, echte Lecks unsichtbar. | loanApply-Deltas + Facility-Ledger einbeziehen, Toleranz auf Rundungsfehler (<1) senken. | economy | P1 | M | transfer-finance-audit.ts:118-132; loan-service.ts:701 |
| T-030 | Finanzen-Tab: Sponsor-Summe ist Proxy, weicht von Komponenten ab | `estimateTeamAnnualRevenue` nutzt letzten Payout-Log, die Aufschlüsselung den aktuellen Vertrag — beide können divergieren, wirkt wie UI-Rechenfehler. | Beide aus derselben Quelle ableiten oder Schätzung explizit kennzeichnen. | economy | P2 | S | use-finances-view-model.ts:50-67 |
| T-031 | GuV erklärt nicht die tatsächliche Cash-Veränderung der Saison | Kredit-Principal, Baukosten, Vorsaison-Übertrag fehlen; kein Season-Start-Cash zum Abgleich → GuV ≠ Cash-Delta, wirkt wie Bug. | `cashSeasonStart` mit ausgeben + „Sonstige Cash-Bewegungen"-Zeile. | economy | P2 | M | use-finances-view-model.ts:148-166; finances-types.ts:80-92 |
| T-032 | Cash-Prize-Apply-Pipeline existiert nur, um vom eigenen Audit als Verstoß markiert zu werden | Vollständig verdrahteter Payout-Pfad ändert wegen `CASH_PRIZE_BENCHMARK_ONLY` nie Cash; jeder apply-Log zählt als `cash_prize_apply_executed`-Verstoß. | Als Debug-/Test-Endpoint klar kennzeichnen oder entfernen. | economy | P3 | S | cash-prize-apply-service.ts:9-10,337-382; economy-audit-report.ts:13-16 |

### 🎛️ UX (9)

| ID | Titel | Problem | Vorschlag | Kat | Sev | Eff | Beleg |
|----|-------|---------|-----------|-----|-----|-----|-------|
| T-033 | Home-Hinweiszeile verschluckt Warnungen ab dem 4. Eintrag | `relevantWarnings.slice(0,3)` ohne „+N weitere"-Indikator — Manager weiß nicht, dass mehr existieren. | Bei >3 einen „+N weitere"-Chip (verlinkt zur Inbox) anzeigen. | ux | P2 | S | HomeV2NewLook.tsx:507-513 |
| T-034 | Optimieren-Panel im Read-Only-Modus komplett gesperrt | `disabled={isReadOnly}` blockt auch den rein informativen Panel-Inhalt (suboptimale Slots) für Zuschauer/nach Deadline. | Panel öffnen lassen, nur „Übernehmen"-Buttons ausblenden. | ux | P3 | S | LineupNewLook.tsx:1696-1706 vs 1795-1804 |
| T-035 | Kein Empty-State, wenn eigenes Team nicht in Liga/Saison | Ohne `ownEntry` verschwindet der „Dein Team"-Block ersatzlos — kein Hinweis, warum. | Platzhalter-Chip „Dein Team — nicht in dieser Ansicht" zeigen. | ux | P3 | S | FoundationRanksNewLook.tsx:218-247 |
| T-036 | „Verkaufen"-Aktion ohne Bestätigung direkt in der Kadertabelle | `openMarketSellModal` sofort per Klick, direkt neben „Verlängern" in gleicher Optik → Fehlklick-Gefahr. | Destruktive Aktion visuell absetzen (Abstand/Stil), ggf. Bestätigung. | ux | P3 | S | FoundationTeamsNewLook.tsx:1186-1227 |
| T-037 | „Finanzen"-Spaltenpreset blendet die Team-Spalte aus | Bei Scope „Alle/Aktive" (gemischte Teams) fehlt in der Gehalts-/Vertragsansicht die Team-Zuordnung — nur per Hover. | „team" (ggf. „Scouting") in die `visible`-Liste aufnehmen. | ux | P2 | S | foundation-players-column-presets.ts:70-74 |
| T-038 | „Letzte Deals"-Karte verschwindet komplett statt Empty-State | Bei 0 Einträgen wird die Karte gar nicht gerendert — inkonsistent zu Kandidaten/Wishlist/Kader. | Karte immer rendern, Empty-Text „Noch keine Deals in dieser Season". | ux | P3 | S | TransfermarktV2NewLook.tsx:2556-2582 |
| T-039 | Blocker-/Hinweis-Listen werden still auf 4 gekürzt | `slice(0,4)` ohne Zähler/„+N weitere" — Manager nimmt an, es gäbe nur vier Probleme. | Gesamtanzahl im Titel oder „+N weitere"-Zeile (wie `SALARY_TOOLTIP_MAX_ROWS`). | ux | P3 | S | FoundationPrizeV2NewLook.tsx:578,588 |
| T-040 | Draft-Löschen ohne Bestätigung, inkonsistent zu Save-Löschung | `deleteDraft()` entfernt sofort/unwiderruflich; Team-Settings sichert Save-Löschen bewusst mit `window.confirm`. | Gleiches Confirm-Pattern oder Undo-Toast. | ux | P2 | S | PlayerGeneratorPanelNewLook.tsx:585-598 vs FoundationTeamSettingsNewLook.tsx:287-302 |
| T-041 | Lexikon-Index ohne Kategorie-Filter bei ~38 flachen Einträgen | 6 Kategorien vorhanden, aber alles als eine ungruppierte Scroll-Liste; nur die Command-Palette erlaubt Zugriff. | Kategorie-Filterleiste (analog `NL_DISZIS_FILTERS`) oder Gruppierung mit Sticky-Headern. | ux | P2 | S | FoundationShellRouterBody.tsx:1772-1786; game-encyclopedia.ts |

### 🎨 Consistency (18)

| ID | Titel | Problem | Vorschlag | Kat | Sev | Eff | Beleg |
|----|-------|---------|-----------|-----|-----|-----|-------|
| T-042 | Cash/Gehalt im Kopf-Board ohne Einheit | Wichtigster Wert (Budget) über `formatNlNumber` → nackte „1.250,3"; alle anderen Geldwerte der View mit „Mio/k". | Cash/Gehalt-Chips über `formatTransfermarktCurrency`/`formatNlMoney`. | consistency | P1 | S | TransfermarktV2NewLook.tsx:964-971 |
| T-043 | Ein Screen mischt `formatDisplayMoney` (roh) und `formatNlMoney` (Mio/k) | Gehälter „4,2" neben Cash/MW „4,2 Mio" in derselben Komponente ohne inhaltlichen Grund. | Alle Geldbeträge im New-Look über `formatNlMoney`. | consistency | P1 | M | FoundationTeamsDetailPanel.tsx:883,1010,1146 |
| T-044 | `FoundationMarketSellShellHost` definiert eigene `formatSignedDisplayMoney` mit „ €" | Lokale Re-Impl. hängt literales „ €" an und lässt -0-Clamp weg → „+4,2 €" statt „+4,2"; dritte, singuläre Euro-Notation. | Geteilte Helper importieren, Einheiten-Suffix systemweit vereinheitlichen. | consistency | P1 | S | FoundationMarketSellShellHost.tsx:27-35 |
| T-045 | Unübersetztes „Rank" mitten in deutscher UI | Disziplin-Header zeigt „Rank {n}", Rest der View durchgehend Deutsch („belegt", „Rang"). | „Rank" → „Rang". | consistency | P2 | S | LineupNewLook.tsx:1352 |
| T-046 | Zwei Home-Hosts mit divergierendem Funktionsumfang | `FoundationHomeV2Host` baut Props ohne `onCompleteInboxItem`, Team-Picker-CTA, Feld-Rennen-Props — Feature-Drift je nach Einstiegspfad. | Beide Hosts auf denselben Prop-Satz bringen oder auf einen konsolidieren. | consistency | P2 | M | FoundationHomeV2Host.tsx:161-220 vs FoundationShellRouterBody.tsx:1850-1911 |
| T-047 | Captain-Chips & Rivalen-Streifen umgehen das NL-Kit komplett | Vollständig über Inline-`style` gebaut statt `nl-lineup-chip`/`StatChip` — zwei parallele Chip-Stilsysteme in einer View. | Auf bestehende Kit-Chip-Klassen umstellen. | consistency | P2 | M | LineupNewLook.tsx:144-159,1396-1452,1997-2057 |
| T-048 | Lead-Tier-/Lane-Schwellen manuell dupliziert statt geteilter Quelle | Bewusste Kopien der privaten Konstanten aus `LegacyLineupFocusV2Board` (Kommentar: „synchron halten") — driften unbemerkt auseinander. | In gemeinsames exportiertes Modul auslagern, aus beiden Boards importieren. | consistency | P2 | M | LineupNewLook.tsx:40-43,273-294 |
| T-049 | Daten-Tabelle im Saisonstand handgestrickt statt `NlTable` | Eigenes Sortier-Header-Rendering ohne `aria-sort`/zebra/sticky, obwohl `NlTable` es mitbringt (in LeagueLeaders genutzt). | `renderDatenTable` auf `NlTable` (Columns+renderCell) umstellen. | consistency | P2 | M | SeasonStandingsNewLook.tsx:741-764 vs NlTable.tsx:109-148 |
| T-050 | Prospect-Spieler in Teams-Kadertabelle als „Kader" statt korrekt gelabelt | Rollen-Spalte prüft nur starter/bench/rotation, fällt für „prospect" auf „Kader" zurück; Team-Profil behandelt „prospect" bewusst als leer → inkonsistent. | `getRoleLabel`-Logik in gemeinsames Util auslagern, in beiden Tabellen nutzen. | consistency | P2 | S | FoundationTeamsNewLook.tsx:1156 vs TeamProfileNewLook.tsx:124-131 |
| T-051 | MW/Gehalt in der Spieler-Tabelle ohne Einheit, im Hub mit „Mio" | Verzeichnis-Zeilen über `formatLocalePoints` (nackte Zahl), Summary-Kacheln 3 Zeilen darüber mit `formatNlMoney`. | Tabellen-Geldzellen ebenfalls über `formatNlMoney`. | consistency | P2 | S | FoundationPlayersTableNewLook.tsx:1443,1457,1468 vs 1756 |
| T-052 | Legacy-`EmptyState` statt `NlEmptyState` im Neuer-Look-Training | Alte Komponente statt Kit-Variante (in `FacilitiesV2NewLook` korrekt genutzt) → abweichendes Styling. | `EmptyState` durch `NlEmptyState` (inkl. Action-Button) ersetzen. | consistency | P2 | S | TrainingCompactNewLook.tsx:7,1150-1155 |
| T-053 | Preisgeld-Ansicht formatiert Geldwerte ohne Einheit | `formatLocalePoints` → „24,5" statt „24,5 Mio"; Kredite/Finanzen nutzen `formatNlMoney`. | Cash-/Preisgeld-Spalten auf `formatNlMoney` umstellen. | consistency | P2 | M | FoundationPrizeV2NewLook.tsx:546-563,643-670 |
| T-054 | Team-Settings zeigt Geldwerte ohne Einheit (`formatMoney`) | Budget/Cash/Gehalt/MW über Legacy-`formatMoney` → „12,5"; Rest des NL nutzt „12,5 Mio". | `formatMoney`-Aufrufe durch `formatNlMoney` ersetzen. | consistency | P2 | S | FoundationTeamSettingsNewLook.tsx:487,660,1302-1317 |
| T-055 | Lexikon läuft komplett außerhalb des Neuer-Look-Systems | Noch alte Panel-Optik (`panel`/`eyebrow`/`pill`), kein `data-new-look`, keine NL-Kit-Komponente. | Als `FoundationEncyclopediaNewLook` mit NlCard/NlTable nachziehen. | consistency | P2 | M | FoundationShellRouterBody.tsx:1755-1822; globals.css:6537ff |
| T-056 | `SeasonStandingsV2Client` hartcodiert 32 individuelle Hex-Farben | `seasonV2TeamTagColorMap` definiert bg/border/text/glow manuell — zweite Farbpalette am Token-System vorbei, zieht bei Theme-Wechsel nicht mit. | Auf CSS-Custom-Properties/`--nl-*`-Token umstellen (HSL-Rotation). | consistency | P2 | L | SeasonStandingsV2Client.tsx:180-208 |
| T-057 | `PlayerAttributeProgressChart` dupliziert `NL_TONE_VAR`-Farben mit Drift | Hartkodierte `#ff6b57` vs Token `#ff6b6b` etc. — sichtbarer unbeabsichtigter Farbdrift zwischen Chart und UI. | `ATTRIBUTE_COLORS` entfernen, `NL_TONE_VAR` importieren. | consistency | P2 | S | PlayerAttributeProgressChart.tsx:37-45 |
| T-058 | Training-View mischt zwei Formatter-Familien | Header-Kacheln `formatNlNumber`, Rest `formatVeloNumber` — unterschiedliches Runden/Vorzeichen in derselben Karte. | Konsequent auf `formatNlNumber`/`NlDeltaChip` vereinheitlichen. | consistency | P3 | M | TrainingCompactNewLook.tsx:1018-1043 vs 826-829 |
| T-059 | Scouting-Fokus-Fortschrittsbalken nicht die Kit-Komponente | Eigener `scouting-queue-progress`-Balken statt `NlProgressBar` (im selben Feature anderswo genutzt). | `NlProgressBar` auch in `ScoutingPriorityQueue` verwenden. | consistency | P3 | S | ScoutingPriorityQueue.tsx:169-176 |

### ♻️ Redundancy / Dead-Code (13)

| ID | Titel | Problem | Vorschlag | Kat | Sev | Eff | Beleg |
|----|-------|---------|-----------|-----|-----|-----|-------|
| T-060 | `formatMoney` und `formatDisplayMoney` sind byte-identische Duplikate | Zwei Funktionen mit exakt gleichem Körper, beide parallel in denselben NL-Dateien importiert. | Eine entfernen/als Alias umleiten, Call-Sites vereinheitlichen. | redundancy | P2 | M | foundation-format-render-helpers.ts:50-70 |
| T-061 | `FoundationMarketSellShellHost` dupliziert `formatWholeNumber`/`formatPpsValue` lokal | Identische Funktionen existieren bereits exportiert und werden fast überall importiert. | Lokale Definitionen entfernen, aus Helper importieren. | redundancy | P2 | S | FoundationMarketSellShellHost.tsx:19-25 |
| T-062 | `components/matchday-arena/*` ist verwaiste Subsystem-Kopie | 3 Dateien + `ArenaRevealPlaybackPanel` referenzieren nur sich gegenseitig, kein Aufrufer im Arena-v2-Flow. | Ordner + Panel löschen. | redundancy | P2 | S | grep MatchdayArenaLane/… → nur gegenseitig |
| T-063 | `components/foundation/modern-game/` komplett tot | `FoundationGameDecisionBoard`/`TrainingModeComparePanel` ohne externe Importe. | Ordner entfernen. | redundancy | P2 | S | grep → 0 externe Treffer |
| T-064 | `SponsorOfferCard.tsx` tote Vorgänger-Version | Nirgends importiert; aktiver Flow nutzt nur die NewLook-Variante. | Datei löschen, Kommentarverweis bereinigen. | redundancy | P2 | S | grep sponsor/SponsorOfferCard → kein Import |
| T-065 | `new-look-preference.ts` UND `.tsx` beide tot | Beide exportieren `useNewLook` mit widersprüchlicher Semantik; alle 26 Treffer sind reine Kommentar-Erwähnungen, kein echter Call. | Beide löschen (oder eine konsolidieren und real verdrahten). | redundancy | P2 | S | new-look-preference.ts/.tsx; grep → keine Aufrufer |
| T-066 | `FoundationViewRouter.tsx` toter Re-Export-Stub | Nur zwei Re-Exports, nirgends importiert — Rest alter Router-Migration. | Datei löschen, direkt aus lib importieren falls nötig. | redundancy | P3 | S | FoundationViewRouter.tsx; grep → 0 |
| T-067 | `FoundationVirtualTableBody.tsx` tote Parallel-Impl. | Generische Variante ohne Aufrufer; nur `LegacyLineupVirtualTableBody` wird genutzt. | Datei löschen oder Legacy darauf migrieren. | redundancy | P3 | S | grep FoundationVirtualTableBody → nur eigene Datei |
| T-068 | Vier Einzeldateien ohne jeden Aufrufer | `FoundationSourceBadge`, `FacilityGridCard`, `whole-season-dry-run-service`, `prize-money-paths` — 0 Treffer projektweit. | Alle vier löschen. | redundancy | P3 | S | grep → keine Treffer außer Datei selbst |
| T-069 | `phaser` (Game-Engine) komplett ungenutzt + 11 weitere unused deps | Keine Importe im gesamten Baum; unnötige Installationsgröße/CVE-Fläche. | `phaser` + Knip-gemeldete unused deps nach Verifikation entfernen. | redundancy | P3 | S | knip Unused dependencies (12); grep phaser → 0 |
| T-070 | `references/retool-ai-golden-master/` — 223 getrackte Legacy-JS (2 MB) | Reines Referenzmaterial, 100 % unused, bläht die Metrik massiv auf. | Aus Knip-Scope ausschließen oder nach `docs/archive` verschieben. | redundancy | P3 | M | references/retool-ai-golden-master/*.js (223) |
| T-071 | `lib/foundation/tabs/` — 9 unreferenzierte Hilfsdateien | Router-Body-Props/Navigation/Column-Defs/Cell-Renderer, alle in Knip Unused. | Stichprobe gegenprüfen (Barrel/dynamisch), dann Satz entfernen. | redundancy | P3 | M | knip Unused files, 9 Einträge unter lib/foundation/tabs/* |
| T-072 | Toter Prop `formatMoney` in `FoundationTeamsNewLook` | Pflicht-Prop entgegengenommen/destrukturiert, aber nie aufgerufen (alles über `formatNlMoney`). | Prop entfernen, Callback im Host nicht mehr durchreichen. | redundancy | P3 | S | FoundationTeamsNewLook.tsx:173,593 |

### ⚡ Performance (6)

| ID | Titel | Problem | Vorschlag | Kat | Sev | Eff | Beleg |
|----|-------|---------|-----------|-----|-----|-----|-------|
| T-073 | Doppelte O(n)-Player-Map-Konstruktion in Nachbar-`useMemo`s | `seasonV2TopPlayers`/`seasonV2PlayerRows` bauen beide `new Map(players.map(...))` mit identischem Deps-Array (Muster wiederholt sich mehrfach in der Datei). | Gemeinsamen `playerById`-`useMemo` [players] extrahieren und wiederverwenden. | perf | P2 | S | use-foundation-shell-router-body-scope.tsx:9302-9351 |
| T-074 | `FoundationCockpitPanel` (3108 Zeilen) ohne jede Memoization | 0 useMemo/useCallback, 74 inline map/filter/sort im Render-Body; jeder Re-Render wiederholt alles. | Teure Ableitungen in Host/`useMemo` verschieben, Panel mit `React.memo` umschließen. | perf | P2 | M | FoundationCockpitPanel.tsx |
| T-075 | `PlayerDetailDrawer` statisch statt via `next/dynamic` importiert | Chart-schwerer Drawer (3617 Zeilen) landet ungesplittet im Bundle der bereits code-gesplitteten Host-Panels. | Per `next/dynamic(..., {ssr:false})` in beiden Aufrufstellen laden. | perf | P2 | S | PlayerProfileClient.tsx:5; LegacyResolveLabClient.tsx:6 |
| T-076 | `PlayerDetailDrawer` läuft mit vollem Hook-Baum vor `data==null`-Early-Return | ~13 Hooks (inkl. Compare-Fetch-Effekt) laufen bei geschlossener Drawer pro Elternrender mit. | Compare-Feature in Subkomponente auslagern, erst bei `data!=null` mounten. | perf | P3 | M | PlayerDetailDrawer.tsx:1674-1945 |
| T-077 | Kein `React.memo` in den drei größten Views | LegacyLineupLab/CockpitPanel/PlayerDetailDrawer rendern als je ein Funktionskörper; kleine Teilbäume re-rendern komplett mit. | Teuerste Render-Einheiten (Zeilen/Slot-Karten) als memoisierte Komponenten extrahieren. | perf | P3 | L | LegacyLineupLabClient / FoundationCockpitPanel / PlayerDetailDrawer |
| T-078 | 134-`useMemo`-Kette hängt an voller `gameState.players/teams`-Referenz | Jede Nutzeraktion ersetzt `gameState` mit neuen Array-Refs → invalidiert dutzende irrelevante Memos gleichzeitig. | Selektive Slices/Selektoren (z. B. `players.length + season.id`) für teure Season-Tabellen. | perf | P3 | L | use-foundation-shell-router-body-scope.tsx (99 Treffer) |

### ♿ Accessibility (9)

| ID | Titel | Problem | Vorschlag | Kat | Sev | Eff | Beleg |
|----|-------|---------|-----------|-----|-----|-----|-------|
| T-079 | KPI-Hover in Teams-Übersicht für Screenreader unsichtbar | Popovers `aria-hidden="true"`, öffnen aber via `:focus-within` bei Tastatur — Inhalt wird nie vorgelesen; im Team-Profil existiert bereits korrektes `HeaderKpiHover`. | `HeaderKpiHover` (role=dialog, aria-expanded) für die Teams-Übersicht wiederverwenden. | a11y | P2 | M | FoundationTeamsNewLook.tsx:1282,1457,1481,1525,1591 vs TeamProfileNewLook.tsx:335-413 |
| T-080 | Klickbare Tabellenzeilen nicht tastaturbedienbar (Teams, Team-Profil, Preisgeld) | `<tr onClick>` ohne `tabIndex`/`role="button"`/`onKeyDown`; nur der Namens-Button ist fokussierbar — Zeilen-Interaktivität nur mit Maus. | Zeilen korrekt interaktiv machen (role/tabIndex/Enter+Space) oder Zugang in echten Button verschieben. | a11y | P2 | S | FoundationTeamsNewLook.tsx:1137; TeamProfileNewLook.tsx:920; FoundationPrizeV2NewLook.tsx:613-618 |
| T-081 | Ausbaustufen-Leiter zeigt aktuellen Stand nur per Hover/`title` | `aria-current="step"` nur im L0-Sonderfall; für gebaute Gebäude (Normalfall) keine semantische Auskunft über die erreichte Stufe. | `aria-current="step"` auf dem erreichten Schritt + visuell versteckter Text „aktuell". | a11y | P2 | S | FacilitiesV2NewLook.tsx:214-254 |
| T-082 | Scouting-Warteschlange nur per Drag & Drop sortierbar | Reorder ausschließlich HTML5-draggable, keine Tastatur-Alternative — die zentrale Interaktion der Karte ist für Tastatur/SR gesperrt. | Zusätzlich Hoch/Runter-Buttons bzw. Pfeiltasten-Reorder auf denselben `onReorder`-Handler. | a11y | P1 | M | ScoutingPriorityQueue.tsx:110-134 |
| T-083 | Saisonpfad als `<nav>` ohne navigierbaren Inhalt | `<nav aria-label="Saisonpfad">` mit rein nicht-interaktiven `<li>` — Landmark ohne fokussierbare Elemente, irreführende Semantik. | Auf `role="list"`/`<div>` umstellen oder Knoten wirklich interaktiv machen (siehe T-098). | a11y | P3 | S | HomeV2NewLook.tsx:517-537 |
| T-084 | Team-Wappen-Alt-Text dupliziert sichtbaren Teamnamen | `alt="{name} Logo"` neben sichtbarem `nl-arena-teamname` — SR hört den Namen pro Zeile doppelt (bei 32 Teams spürbar). | `alt=""` (dekorativ) bzw. `aria-hidden` am Bild. | a11y | P3 | S | MatchdayArenaNewLook.tsx:1022-1036 |
| T-085 | „Board sortieren"-Leiste ohne Radiogroup-/Tab-Tastatursemantik | Fünf `<button aria-pressed>` für einen exklusiven Modus, aber keine Pfeiltasten-Navigation wie bei den anderswo genutzten `NlSubTabs`. | `NlSubTabs` wiederverwenden oder `role="radiogroup"`/`radio` mit Pfeiltasten. | a11y | P3 | S | SeasonStandingsNewLook.tsx:924-943 |
| T-086 | Bereichs-Mini-Bars/Disziplin-Balken: Erklärung nur via `title` auf `<span>` | Wert nur im `title` eines nicht-interaktiven `<span>` — auf Touch und für SR nicht erreichbar. | `aria-label` auf dem Container statt nur `title`. | a11y | P3 | S | SeasonStandingsNewLook.tsx:426-441 |
| T-087 | Kandidaten-Kachel verschachtelt Buttons trotz gegenteiligem Kommentar | `div[role="button"]` enthält Namens- und Expand-Button, obwohl die Doku „kein verschachteltes button" behauptet → unklares Tab/Enter-Verhalten. | Kommentar/Architektur korrigieren oder auf saubereres Muster (Container ohne role=button + eigenständige Buttons) migrieren. | a11y | P3 | M | TransfermarktV2NewLook.tsx:203-209,1256-1341 |

### 🧪 Test-Integrität (10)

| ID | Titel | Problem | Vorschlag | Kat | Sev | Eff | Beleg |
|----|-------|---------|-----------|-----|-----|-----|-------|
| T-088 | Vitest führt keinen Typecheck durch — ~243 tsc-Fehler bleiben grün | esbuild transpiliert ohne Typprüfung; Suite meldet grün, obwohl Fixtures nicht mehr zum Produktionsschema passen. | CI-Gate `tsc --noEmit` vor/parallel zu vitest, bei Fehlern in tests/ brechen; oder `vitest --typecheck`. | test | P1 | S | package.json „test"; vitest.config.ts |
| T-089 | Kein Cash-Invarianten-/Conservation-Test trotz Cash-kritischer Module | Repo-Suche `conservation/reconcil/totalCash` findet nur lib/, keinen Test — kein Test prüft Summe/Nicht-Negativität aller Team-Cash über Transaktionen. | Dedizierten Test: nach Transfer/Loan/Sponsor/Rollover `cashEnd-cashStart` exakt gegen Σ Ledger-cashDelta prüfen. | test | P1 | M | tests/ (keine Treffer) vs loan-service/sponsor-settlement-service |
| T-090 | `ai-market-plan-apply-service.test.ts` gegen veraltete Roster/Team-Form | 46 tsc-Fehler: Mocks nutzen `activePlayerId` statt `id`, fehlende Pflichtfelder, `as`-Casts scheitern. Größter Einzel-Offender. | Fixtures auf aktuelle RosterEntry/Team-Typen migrieren, Factory-Helper einführen. | test | P1 | M | ai-market-plan-apply-service.test.ts:159,169,325,431,520 |
| T-091 | `ai-legacy-lineup-batch-apply-service.test.ts` prüft Vor-Rework-Form | 37 tsc-Fehler: Standing-Literale mit `disciplineId`/`teamCode` statt rank/score/sourceStatus; Matchday/Season fehlen Pflichtfelder. | Fixture-Satz gegen aktuelle Typen neu aufbauen (Kandidat für Neuschreiben). | test | P1 | L | ai-legacy-lineup-batch-apply-service.test.ts:87,272,352 |
| T-092 | `ai-team-cash-reserve-service.test.ts` gegen veraltetes Strategy-/Schedule-Schema | 26 tsc-Fehler: TeamStrategyProfile fehlen 6+ Pflichtfelder, ScheduleSlot nur `playerCount`, Team ohne budget/identityId — ausgerechnet Cash-Kernlogik. | Shared Test-Factories (via `satisfies<T>()`) synchron zu Produktionstypen. | test | P1 | M | ai-team-cash-reserve-service.test.ts:89,91,120 |
| T-093 | `ai-market-plan-convergence.test.ts` nutzt Alt-Schema für Roster/TeamIdentity | 22 tsc-Fehler: altes Roster-Format, `playerMax` statt playerOpt/playerMin — Testdateien driften unabhängig mit verschiedenen Feldnamen. | Gemeinsame Fixture-Utilities statt datei-lokaler Inline-Objekte. | test | P2 | M | ai-market-plan-convergence.test.ts:123,327,328 |
| T-094 | `game-inbox-service.test.ts` deckt breite, gedriftete Interfaces ab | 14 tsc-Fehler über Inbox/Transfer/Facility/Sponsor; `pow/spe/men`-Kürzel nicht mehr akzeptiert (Refactor). | In domänenspezifische Dateien aufteilen, je Domäne neu fixturen; Kürzel global ersetzen. | test | P2 | M | game-inbox-service.test.ts:133,355,468,518,551,568 |
| T-095 | `tests/_debug-dryrun.test.ts` — Debug-Skript ohne Assertions als Test eingecheckt | 0 `expect()`, nur console.log, kompiliert nicht (TS2352) — täuscht Abdeckung vor, bricht den Build. | Löschen bzw. aus tests/ verschieben; falls wichtig, in echten Test mit Assertions umwandeln. | test | P2 | S | tests/_debug-dryrun.test.ts:1-70 |
| T-096 | `ai-legacy-lineup.test.ts` fixturiert abgelöste Kategorie „tactics" | `category:"tactics"`, aber `DisciplineCategory` ist auf power/speed/mental/social reduziert — prüft die Taxonomie vor dem Rework. | Kategorien umstellen, Gewichtungslogik gegen Vier-Kategorien-Modell prüfen. | test | P2 | S | ai-legacy-lineup.test.ts:123-124; olyDataTypes.ts:1-5 |
| T-097 | Playwright-E2E besteht aus genau einem Testfall | `testMatch` fixiert auf eine Datei mit einem `test()`-Block; keine Browser-Regression für Transfermarkt/Draft/Rollover/Inbox. | `testMatch` aufweiten, Specs für zentrale UI-Flows ergänzen. | test | P2 | L | playwright.config.ts:4-5 |

### ✨ Feature (10)

| ID | Titel | Problem | Vorschlag | Kat | Sev | Eff | Beleg |
|----|-------|---------|-----------|-----|-----|-----|-------|
| T-098 | Umfangreiche Season-Host-Daten (GM, Archiv, Diszi-Leader) im NL-Saisonstand ignoriert | Host übergibt leaderTeam/pressureTeam/gmRows/archiveRows/disciplineLeaders + onOpenRanks/onOpenPrize; `SeasonStandingsNewLook` destrukturiert sie nicht — Infos werden berechnet und verworfen. | Mind. Navigations-Callbacks anbinden; GM-/Archiv-/Diszi-Daten in Tab/Abschnitt einbinden. | feature | P1 | M | FoundationSeasonV2Host.tsx:115-124 vs SeasonStandingsNewLook.tsx:128-142 |
| T-099 | Investitions-Ranking nur in Read-Only-Übersicht, nicht auf der Aktionsseite | `FacilitiesOverviewV2NewLook` berechnet „Nächstes bestes Upgrade" nach Amortisation; die Seite mit den Upgrade-Buttons (`FacilitiesV2NewLook`) hat es nicht. | `buildFacilityPortfolio`/`NextBestUpgradeCard` auch in `FacilitiesV2NewLook` mit Klick-Through. | feature | P2 | M | FacilitiesOverviewV2NewLook.tsx:116-186 |
| T-100 | „Kaufbereit"-Karten im Scouting zeigen keinen Preis | Empfehlungs-Kacheln zeigen Intel/Sterne/Radar, aber weder MW noch Gehalt — die Kaufentscheidungszahl fehlt, Manager muss in den Transfermarkt wechseln. | MW/Gehalt (aus Wishlist-/Watch-Target-Daten) auf den Karten ergänzen. | feature | P2 | M | ScoutingCenterV2NewLook.tsx:38-41,556-570 |
| T-101 | Kein Suchen/Filtern/„Zu meinem Team"-Sprung im Liga-Board | Board & Ranks rendern alle Teams ungefiltert; bei 20-30 Teams manuelles Scrollen trotz `is-selected`-Marker. | „Zu meinem Team springen"-Button (`scrollIntoView` auf `is-selected`). | feature | P2 | S | SeasonStandingsNewLook.tsx:1018-1020; SeasonStandingsV2Client.tsx:181-212 |
| T-102 | Keine Cross-Navigation von „Letzte Deals" zur vollen Transferhistorie | `transfer-history-v2` (Filter/CSV/Timeline) existiert, aber die Karte im Transfermarkt hat keinen Link dorthin. | „Vollständige Historie öffnen"-Link in den Kartenaktionen (ggf. Deep-Link). | feature | P2 | S | TransfermarktV2NewLook.tsx:2556-2558 |
| T-103 | Spieltag-Rail rein dekorativ, kein Auto-Scroll zum aktuellen Spieltag | Kein onClick, kein Auto-Scroll — bei 30+ Spieltagen liegt „aktuell" weit rechts, Klick tut nichts. | Beim Mount auf `.is-current` scrollen; Knoten klickbar (Sprung zum Spieltag) machen. | feature | P3 | M | HomeV2NewLook.tsx:516-537; globals.css:52067-52080 |
| T-104 | Keine Sammel-Aktionen in der Inbox trotz vieler Items | `onMarkDone`/`onDismiss` nur pro Item; bei 15+ Items einzelnes Abhaken, obwohl Handler für Bulk vorhanden. | Bulk-Aktion („Alle Info-Items erledigt") über die sichtbaren `displayedItems`. | feature | P3 | M | InboxV2NewLook.tsx:566,623-644 |
| T-105 | Kein Export/Kopieren der gefilterten Spielerliste | Umfangreiches Filter-/Query-/Spalten-System, aber keine Export-/Kopier-Funktion (Scouting-Shortlist) — klassisches Manager-Feature fehlt. | „Liste kopieren"/„Als CSV exportieren" für die sichtbaren Spalten der gefilterten Zeilen. | feature | P3 | M | FoundationPlayersTableNewLook.tsx:1920-1930 |
| T-106 | Kein Kredit-Verlauf — abgeschlossene/abgelöste Kredite unsichtbar | Nur `team.activeLoans` gerendert; ausgelaufene/abgelöste Kredite verschwinden spurlos, keine Zins-Historie. | Schlanke „Kredit-Historie"-Sektion (Datum/Saison/gezahlte Zinsen). | feature | P3 | M | FoundationCreditsNewLook.tsx:1072-1092 |
| T-107 | Finanzen-Ansicht zeigt nur die laufende Saison, kein Mehrsaisonvergleich | Nur `model.team` der aktuellen Saison; keine GuV-Entwicklung über Saisons — naheliegende Trendansicht fehlt. | Saison-für-Saison-GuV-Sparkline (Datenbasis wie 5-Saisons-Forecast in prize-v2). | feature | P3 | M | FoundationFinancesNewLook.tsx:268-373 |

---

## Zähl-Übersicht

**Findings je Kategorie:**

| Kategorie | Anzahl |
|-----------|--------|
| bug | 18 |
| consistency | 18 |
| redundancy | 13 |
| test | 10 |
| feature | 10 |
| fog | 9 |
| ux | 9 |
| a11y | 9 |
| perf | 6 |
| economy | 5 |
| **Gesamt** | **107** |

**Findings je Severity:**

| Severity | Anzahl |
|----------|--------|
| P1 | 20 |
| P2 | 44 |
| P3 | 43 |

**Effort-Verteilung:** überwiegend S (schnelle Wins), gefolgt von M; wenige L (große Refactorings: T-056 Farbtoken, T-077/T-078 Memoization-Umbau, T-091 Test-Neuschreiben, T-097 E2E-Ausbau).
