# Seiten-Umbau-Fahrplan (18.11.) — jede Seite neu konzipieren, nicht mischen

Anlass, Chris am 18.11., wörtlich: „Wir haben nun einen sehr guten Style gefunden mit den neuen Mockups und genau so möchte ich
das auch umgesetzt haben, nicht nur integriert. Der alte Stil darf dann nicht überall mit dem neuen gemixt sein, sondern
letztendlich müssen wir step by step die Seiten neu konzeptionieren und aufsetzen inkl. der neuen Mechaniken.“

Dies ist eine **Inventur und ein Plan**, kein App-Code. Gelesen wurden Router, Navigation, Komponenten, `globals.css` und die
offenen PRs (Stand `origin/main` 63560079 = #1579, dazu #1580 bis #1584). Nichts wurde gebaut, gestartet oder gemessen; alle Zahlen
unten sind Zählungen im Quelltext (`grep`/`wc`), keine Laufzeitmessungen. Die Regel selbst („Neuer Stil überall“) steht in
`CLAUDE.md` auf PR #1583 (Branch `claude/claude-md-finanzregeln-18-11`) und verweist auf dieses Dokument.

## 0. Wie gelesen wurde

**Neu** heißt: eigene Komponente im Mockup-Stil (`bc-`-Bausteine aus `components/foundation/broadcast/`, eigenes CSS-Präfix wie
`ssm-`, `elm-`), keine `nl-`-Klassen im Seitenkörper. **Alt** heißt: `*NewLook`-Komponente (der Name „NewLook“ ist der frühere
Velo-/„Neuer Look“-Stil, also der *alte* Stil von heute) mit `nl-*`-Klassen aus `app/globals.css`, ältere Panels oder eigene
Altklassen (`team-`, `player-`, `cockpit-`). **Gemischt**: neue und alte Teile in derselben Ansicht oder Hülle neu, Inhalt alt.

Beleg „nl“ in den Tabellen = Anzahl der Klassen-Token mit Präfix `nl-` im Hauptfile der Seite, „bc“ = `bc-`, „eigen“ = eigenes
Präfix. Ein Wert wie `nl 142 / 164` heißt: 142 von 164 Klassen-Token sind `nl-`.

Wichtigster Befund vorweg: **von 43 Flächen sind genau zwei komplett neu (Saisonstand, Einsatzliste)**, vier gemischt, 36 alt, eine
entfällt. Die zwei neuen halten ihre alte Fassung noch als Rückfall im Code (`?saisonstand=klassisch`, `?einsatzliste=klassisch`):
das ist selbst eine Mischung, die nach dem Abnahmelauf raus muss.

## 1. Seitenverzeichnis

Quellen: `lib/foundation/foundation-nav-config.ts` (Navigation, sechs Gruppen), `lib/foundation/foundation-view-routing.ts`
(`FOUNDATION_VIEW_IDS`, 42 Ids mit Alias-Auflösung), `app/foundation/FoundationShellRouterBody.tsx` (3346 Zeilen, 36 verschiedene
`activeView`-Gates), `app/foundation/shell/*`. Spalte „Bau“ = laufender Bau bzw. Entwurf (Stand 18.11.).

Aufwand: **S** unter einem Tag Sonnet-Arbeit, **M** 1–3 Tage, **L** mehr als 3 Tage oder mehrere PRs. „Mockup“: ✔ vorhanden und
ausreichend, ◐ vorhanden, aber nur Teilansicht oder veraltet, ✘ fehlt (dann: Fable-Mockup vor dem Bau).

### 1.1 Rahmen (gilt für jede Seite)

| # | Name | Route / View | Stil-Status und Beleg | Mockup | Bau | Neue Mechaniken | Welle | Aufwand |
|---|---|---|---|---|---|---|---|---|
| R1 | App-Rahmen: Schiene, Kopfzeile, Unterreiter, Taktgeber/Weiter, Suche, Meldungen, Ladezustand | `FoundationShell`, `FoundationSidebar`, `FoundationSubNav`, `FoundationActivityStrip`, `FoundationRoomFlowBar`, `foundation-nav-icons` (alle Ansichten) | **gemischt.** Schiene neu (64 px, Hover klappt aus, anheftbar, #1576; Volle Breite #1577). Kopfzeile, Chip „Bereit“, Unterreiter, Aktivitätsstreifen und `FoundationPanelSkeleton` („… wird geladen“) noch alte Gestalt; jede Seite zeichnet ihren eigenen Kopf (`BcHero` oder `nl-`-Kopf) und teils eigene Fußleiste | ✔ `public/mockups/app-rahmen-modern-18-11.html` + `docs/design/app-rahmen-modern-18-11.md` | #1580 (nur Mockup + Doku, Draft). Der in der Aufgabe genannte Branch `claude/app-rahmen-bau-18-11` existiert noch nicht | Regieband, Taktgeber mit drei Zuständen, Saison-Chip mit 20 Strichen, Kasse als Chip, Office als Blatt, Meldungen als Bauchbinde, Arena-Vollbild schaltet Band und Schiene ab, Seiten-Slot und eine Hauptaktion oben rechts | **0** | L (neun kleine PRs laut Doku Abschnitt 4) |

Offene Entscheidungen für Chris, die vor dem Bau geklärt sein müssen: Doku Abschnitt 5 (Hauptaktion oben rechts statt Fußleiste,
Office als Blatt, Arena ohne Schiene, Sendewisch, Meldungen in der Arena, Slot auf der Startseite, mitwachsende Schrift).

### 1.2 Gruppe „Spieltag“ (Navigation) und Spieltags-Ansichten ohne eigenen Navigationspunkt

| # | Name | Route / View | Stil-Status und Beleg | Mockup | Bau | Neue Mechaniken | Welle | Aufwand |
|---|---|---|---|---|---|---|---|---|
| 1 | Home: Übersicht | `homeV2` (Tab „Übersicht“), `home-v2/HomeV2NewLook.tsx` | **alt.** nl 142 / 164, `velo` 39 Treffer, Block `.nl-home` in `globals.css` (Zeilen 45491–46010) | ✔ `oly-start-modern-18-11.html` (Branch `claude/oly-start-mockup-18-11`), `oly-start-modern-17-11.html` (Branch `claude/saisonstand-modern-mockup-17-11`) | **#1584** `claude/startseite-neu-18-11` (Draft): `HomeModern.tsx`, `HomeV2NewLook` entfernt. Fehlt laut PR: Kassenkurve, Spieltags-Buchungen, Apron-Abstand, Einsatzliste je Disziplin, „Spieler des Tages“ | Duell-Wertung S-U-N (in #1584 drin), Kaderstärke-Vergleich und Papierform, Form/Moral, Verletzung = nicht einsetzbar im Kader, Finanzen V2 (Kassenkurve, Heimspiel-Buchung, Vorstand-Budgetfreigabe) | 1 | M (Rest nach #1584) |
| 2 | Home: Office | `homeV2` (Tab „Office“), `home-v2/ManagerOfficeClient.tsx` | **alt.** gehört zu `HomeV2NewLook`-Familie, `.nl-home`-Klassen | ◐ nur als „Blatt“ im Rahmen-Mockup (Bild 21) | in #1584 unverändert („Das Office bleibt“) | Vorstand-Budgetfreigabe, Rücklage, Kassensturz-Hinweis, Pflichtkredit-Vorschau | 1 (mit Rahmen Schritt 7) | M |
| 3 | Inbox | `inboxV2`, `inbox-v2/InboxV2NewLook.tsx` (827 Zeilen) | **alt.** nl 83 / 112, Block `.nl-inbox` (46011–46488) | ◐ Meldungen als Bauchbinde, Glocke-Aufklapper, Inbox-Aufklapper im Rahmen-Mockup (Bilder 18, 19) | nichts | Meldungen aus Verletzung, Form/Moral-Wechsel, Vorstand-Budgetfreigabe, Kassensturz | 1 (mit Rahmen Schritt 6) | M |
| 4 | Einsatzliste | `lineup` / `lineupV2`, `legacy-lineup-lab/EinsatzlisteModern.tsx` (1600 Zeilen) | **neu.** elm 86 + bc 60 von 189, eigenes `einsatzliste-modern.css` (1294 Zeilen), Hülle `FoundationLineupPanel` hat noch einen alten `panel-header` mit `TooltipHeading` und die Rückfall-Weiche `useEinsatzlisteLook` | ✔ `einsatzliste-modern-17-11.html` (auf main) | gebaut (#1565, #1573); in Rahmen-Bau: eigener Kopf und Fußleiste raus, Slot + Hauptaktion in den Rahmen. Der in der Aufgabe genannte Branch `claude/einsatzliste-optik-18-11` existiert nicht, stattdessen Branch `claude/einsatzliste-flaechen-stilprobe-18-11` und `…-kulisse-hintergrund-18-11` | Verletzt = nicht einsetzbar (gesperrter Platz, Prüfung), Form/Moral je Zeile, Formkarten-Farbregel, Kaderstärke je Platz, PP-Skala (Erwartungswert in Platzkarte) | 1 (Feinschliff), Rückfall löschen nach Abnahme | S |
| 5 | Formplan (Unterreiter der Einsatzliste) | `lineup` mit `formBoard`, `legacy-lineup-lab/FormBoardPanel.tsx` (872 Zeilen) | **gemischt.** `legacy-` 66 / 124 eigene Altklassen; Bausteine `FormMoralBausteine.tsx` sind bc | ◐ `form-moral-modern-17-11.html` (Ansichten 1–3) | #1565 hat die Karten übernommen, der Board-Teil nicht | Formkarten-Farbregel, Form/Moral als kleiner Modifikator | 1 | M |
| 6 | Arena (Spieltag spielen) | `matchdayArena`, `discipline-stage/` (42 Dateien, 25 788 Zeilen), `DisciplineStageNativeArena` | **gemischt.** Spielfläche und Live-Stand-Band im neuen PixelLab-/Broadcast-Stil; HUD erst für Basketball, Hockey, Football (#1564, #1566), 17 Disziplinen offen; die Hülle (Kopfzeile, Steuerzeile, Spielstandsleiste, `nl-` 910 Treffer im Verzeichnis, z. B. `DisciplineStageMatchdayPanel`) alt | ◐ `basketball-ui-mockup-17-11.html` (nur Basketball-HUD) und Arena-Vollbild im Rahmen-Mockup (Bilder 10–12, 22) | Vollbild: Rahmen-Schritt 9, baut auf `claude/arena-vollbild-18-11` (gemergt als #1578 für die Battle-Arena-Vollfläche); HUD-Wellen laufen separat | Duell-Wertung 2/1/0 im Spielstand, Verletzung = 50 % Basisleistung in der Verletzungs-Disziplin (CLAUDE.md #1583), PP-Skala um 5, Arena-Vollbild, Form/Moral sichtbar | 1 (Hülle + Vollbild), HUD laufend | L |
| 7 | Nach dem Spieltag (heute „Spieltagsergebnis“) | `matchdayResult` (+ `?view=nach-dem-spieltag` in #1581), `matchday-result-v2/MatchdayResultNewLook.tsx` (890 Zeilen) | **alt.** nl 140 / 160, `.nl-result-*`; Formmeldungen darin als eingehängte Liste | ✔ `form-moral-modern-17-11.html` Ansicht 4 (auf main) | **#1581** `claude/nach-dem-spieltag-18-11` (Draft): neue Komponente `nach-dem-spieltag/NachDemSpieltag.tsx` (272 Zeilen) + eigenes CSS | Duell-Ergebnis je Disziplin, Form-Pfeile vorher→nachher, Moral mit Grund, „Was jetzt zu tun ist“, Verletzungen als Folge | 1 | S (Rest nach #1581: Alt-Ansicht entfernen) |
| 8 | Saisonstand | `seasonV2`, `season-v2/SeasonStandingsModern.tsx` (1150 Zeilen) | **neu.** ssm 185 + bc 67 von 328, eigenes `saisonstand-modern.css`; Standard seit 18.11. (#1570, #1572, #1579). Alt-Rückfall `SeasonStandingsNewLook.tsx` (3589 Zeilen, nl 357 / 430) und `season-standings-new-look.css` (955 Zeilen) noch im Code | ✔ `saisonstand-modern-17-11.html` (Branch `claude/saisonstand-modern-mockup-17-11`) | gebaut; Runde-2-Abgleich `saisonstand-modern-runde2-abgleich-18-11.md`. Rahmen-Bau macht den Kopf zum Slot (Liga-Reiter) | Duell-Wertung 2/1/0 (Duellpunkte statt PP, #1572), Liga-Split 2×16 (zwei Reiter), Kaderstärke, Form-Spalte, Rang-Bänder | 1 (Abnahme, dann Rückfall löschen) | S |
| 9 | Saisonende / Finale | `seasonV2` in der Endphase, `season-v2/FoundationSeasonFinalePanel.tsx` (435 Zeilen) | **alt.** nl 14 + `season-` 7 von 34, Altpanel ohne bc | ✘ | nichts | Saisonende-Buchungslauf (Rangbonus = Wertungstopf × Saison-Faktor), Sponsor-Auszahlung, Entwicklung aller Spieler, Auf-/Abstieg bei Liga-Split 2×16, Kassensturz und Pflichtkredit (Finanzkonzept V2 Abschnitte 2.2, 6) | 1 (nach Finanzen-Mechanik) | M, Fable-Mockup nötig |
| 10 | Saisonstand-Preview | `seasonPreview`, `season-preview-v2/SeasonPreviewNewLook.tsx` | **alt.** nl 57 / 68; kein Navigationspunkt, nur Sekundäransicht | ✘ | nichts | wie Saisonstand | 3 (oder streichen) | S |
| 11 | Spieltag-Steuerung („Cockpit“) | `cockpit`, `cockpit-v2/FoundationCockpitPanel.tsx` (3211 Zeilen) | **alt, intern.** eigene Klassen `cockpit-` 108, `metric-` 95; kein Navigationspunkt | ✘ (Werkzeug, kein Spielerthema) | nichts | Ablaufschritte stehen künftig im Taktgeber-Aufklapper | 4 (nur Tokens), Logik bleibt | M |
| 12 | Battle Arena (Test) | `battleArena`, `battle-arena/` (2190 Zeilen) | **gemischt.** Vollfläche neu (#1578, `ArenaVollflaecheBuehne`), eigene `oly-`-Klassen; Navigationspunkt trägt „Test“-Plakette | entfällt (Testwerkzeug) | #1578 gemergt | – | 4: entscheiden, ob nach dem Rahmen-Bau noch gebraucht | S |

### 1.3 Gruppe „Team“

| # | Name | Route / View | Stil-Status und Beleg | Mockup | Bau | Neue Mechaniken | Welle | Aufwand |
|---|---|---|---|---|---|---|---|---|
| 13 | Teams: Liste/Übersicht | `teams`, `teams-v2/FoundationTeamsNewLook.tsx` (2489 Zeilen) | **alt.** nl 227 / 281, `velo` 85 Treffer im Verzeichnis | ✘ | nichts | Kaderstärke je Team, Liga-Split 2×16, Form/Moral je Team | 2 | L (mit 14) |
| 14 | Team-Detail: Kader, Verträge, Transfers | `teams` (Reiter Kader/Verträge/Transfers), `FoundationTeamsDetailPanel.tsx` (3342 Zeilen), `FoundationRosterSellPeekDrawer.tsx` | **alt.** eigene Altklassen `team-` 116, `teams-` 71, nl 44 von 442 | ✘ | nichts | Verletzt = nicht einsetzbar (Kader-Kennzeichnung), Form/Moral je Spieler, Gehalt je Spieltag (Finanzen V2), PP-Skala | 2 | L |
| 15 | Teamprofil | `teamProfile`, `team-profile/TeamProfileNewLook.tsx` (2591 Zeilen) | **alt.** nl 296 / 348, `velo` 78 Treffer | ✘ | nichts | Fan-Stimmung 0–100 (Finanzen V2), Beliebtheit, Kaderstärke, Rivalen | 2 | M |
| 16 | Spieler (Liste, Vergleich) | `players`, `players-table/` (8 Dateien, 5848 Zeilen), `FoundationPlayersTableNewLook.tsx` (3494 Zeilen) | **alt.** nl 243 / 305, CSS-Block `.nl-players` (237 Treffer) | ✘ | nichts | PP-Skala (Spalten PP), Form/Moral-Spalten, Verletzungskennzeichen, Spalten-Vorgaben | 2 | L |
| 17 | Spielerprofil (Seite, 7 Reiter `PLAYER_PROFILE_TABS`) und Spieler-Drawer (Overlay aus allen Listen) | `playerProfile`, `player-profile/PlayerProfileClient.tsx` (262 Zeilen) → `PlayerDetailDrawer.tsx` (4337 Zeilen), `PlayerHeroNewLook.tsx`, `components/foundation/player-drawer/` | **alt/gemischt.** `player-` 279 / 450 eigene Altklassen, nl 49; ein einziges Bauteil bedient Seite und Overlay, daher in zwei Zeilen gezählt, aber ein Bau | ✘ | nichts | PP-Skala (Verlauf, Saisonwert), Form-Verlauf und Moral-Gesicht (`BcMoralGesicht` existiert), Verletzung (Dauer, Disziplin mit 50 %), Entwicklung | 2 (zuerst) | L, Fable-Mockup nötig |
| 18 | Merkliste | `merkliste`, `merkliste-v2/MerklisteClient.tsx` (159 Zeilen) | **alt.** `merkliste-` 18, nl 6 von 33 | ✘ (klein; mit Spieler-/Teamlisten-Mockup abdecken) | nichts | – | 3 | S |
| 19 | Training | `trainingCompact`, `training-compact/TrainingCompactNewLook.tsx` (1475 Zeilen) | **alt.** nl 127 / 184, `velo` 62 Treffer, Block `.nl-training` (54021–55239, rund 1200 Zeilen) | ✘ | nichts | Verletzte trainieren nicht, Form/Moral-Wirkung, PP-Skala für Forecast, Gebäude-Bonus | 2 | M |
| 20 | Gebäude (+ Upgrade-/Wartungs-Panel, Alias `facilitiesOverviewV2`) | `trainingV2`, `facilities-v2/FacilitiesV2NewLook.tsx` (1436 Zeilen), `facilities-overview-v2/` | **alt.** nl 69 / 110 und 33 / 43; Block `.nl-facility` (55240–55708) | ✘ | nichts | Unterhalt in 20 Raten je Spieltag, Gebäude-Regel für KI und Mensch (Finanzkonzept Stufe 8) | 2 (mit Training) | M |
| 21 | Ewige Tabelle | `allTimeTable`, `all-time-table-v2/AllTimeTableNewLook.tsx` (796 Zeilen) | **alt.** nl 37 / 55; Block `.nl-alltime` (66 Treffer) | ✘ (Tabellen-Muster aus Saisonstand genügt) | nichts | Liga-Split 2×16 (Spalte Liga), Duellpunkte statt Spiele | 3 | S |

### 1.4 Gruppe „Markt“ (inklusive Draft, Dialoge, Finanzen)

| # | Name | Route / View | Stil-Status und Beleg | Mockup | Bau | Neue Mechaniken | Welle | Aufwand |
|---|---|---|---|---|---|---|---|---|
| 22 | Transfermarkt | `marketV2` (Unterreiter Markt/Vertragsangebot/Verkauf), `transfermarkt-v2/TransfermarktV2NewLook.tsx` (3211 Zeilen) | **alt.** nl 330 / 447, Block `.nl-market` (50561–51374, 388 Treffer) | ✘ | nichts | Vorstand-Budgetfreigabe (Transfers nur auf X %), Gehaltsdeckel am Sponsor (Anker statt hartem Deckel), Verletzung/Form/Moral je Angebot, PP-Skala, Verkaufsabschlag fließt in Liga-Topf | 2 | L, Fable-Mockup nötig |
| 23 | Draft-Phase (keine eigene View: Phase des Transfermarkts, Wunschliste in Scouting) | `isTeamSetupDraftWishlistPhase`, `ScoutingShortlistBoard`, Draft-Zweige in `TransfermarktV2NewLook` und `FoundationMarketV2ShellHost` | **alt.** gleiche nl-Klassen wie 22/26 | ✘ | nichts | Rücklage nach Finanzwert (5–25 %), Zielgehalt, Kassensturz am Ende der Kaufphase, 32 KI-Teams | 2 (mit 22) | M |
| 24 | Dialoge Kauf, Verkauf, Vertragsangebot, Vertragsverlängerung | `FoundationMarketBuyShellHost` (CSS „F1 Kauf-Modal Velo-Layer“), `FoundationMarketSellShellHost`, `ContractRenewalNegotiationModal.tsx` (807 Zeilen), `contract-offer/ContractOfferClient.tsx` | **alt.** nl 41 / 76 (Modal), `contract-` 13 / 25 | ◐ `docs/design/kauf-modal-mockup.html`, `verkauf-popup-mockup.html` (14.11., alter Stil, vor dem Designsystem) | nichts | Kassenprüfung gegen Budgetfreigabe, Pflichtkredit-Hinweis, Abschlag beim Verkauf | 2 (mit 22) | M |
| 25 | Scouting (Übersicht, Scouting-Report) | `scoutingCenterV2`, `scouting-center-v2/` (8 Dateien, 1960 Zeilen) | **alt.** nl 58 / 81 im Hauptfile, `velo` 23 Treffer; Block `.nl-scout` (52874–53156) | ✘ | nichts | Berichte zu Form/Moral/Verletzung, Wunschliste für Draft | 3 | M |
| 26 | Transferhistorie | `historyV2`, `transfer-history-v2/TransferHistoryV2NewLook.tsx` (1206 Zeilen) | **alt.** nl 134 / 162, Block `.nl-thist` (53157–54020) | ✘ (Tabellen-Muster) | nichts | Verkaufsabschlag, Liga-Topf-Ausschüttung als Buchungszeile | 3 | S |
| 27 | Kredite | `credits`, `credits/FoundationCreditsNewLook.tsx` (1447 Zeilen) | **alt.** nl 174 / 207 | ✘ (im Finanz-Mockup nur angerissen) | nichts | Pflichtkredit (2 Saisonen, 12 %, Schuldendienst ≤ 20 %), Rate je Spieltag, Zwangsverkauf durch den Vorstand | 2 (mit Finanzen) | M |
| 28 | Finanzen | `finances`, `finances/FoundationFinancesNewLook.tsx` (1535 Zeilen) | **alt.** nl 145 / 190 | ✔ `finanzen-modern-18-11.html` und `finanzen-daten-modern-18-11.html` (Branch `claude/finanzkonzept-v2-18-11`), älter `finanzen-modern-17-11.html` | **#1582** (Draft, nur Konzept und Mockups, „gebaut wird erst nach Chris’ OK“); Bau-Reihenfolge Abschnitt 8 des Konzepts: Mechanik-Stufen 0–9, Seite ist Stufe 10 | Kasse je Spieltag (20 Raten), Tickets an Heimspielen, Rangbonus am Saisonende, Fan-Stimmung, Vorstand-Budgetfreigabe statt Geldstrafen, Apron-Neueichung, Kassensturz | 2 (Seite nach Mechanik-Stufen 4–5) | L |
| 29 | Sponsoren | `prize`, `prize-v2/` + `sponsors-v2/FoundationSponsorsNewLook.tsx` (1804 Zeilen), `components/foundation/sponsor/` | **alt.** nl 138 / 180 und 91 / 111; Block `.nl-sponsor` (55709–56745, 261 Treffer) | ◐ Ärmel-/Disziplin-Sponsoren nur im Mockup vom 17.11. (im Konzept als „später“) | nichts | Sponsor zweigeteilt (Sockel in 20 Raten, Rangbonus am Ende), Gehaltsdeckel am Sponsor-Anker | 2 (mit Finanzen) | M |

### 1.5 Gruppe „Welt“, „Verwaltung“, „Info“ und Nebenflächen

| # | Name | Route / View | Stil-Status und Beleg | Mockup | Bau | Neue Mechaniken | Welle | Aufwand |
|---|---|---|---|---|---|---|---|---|
| 30 | Ranks | `ranks`, `ranks-v2/FoundationRanksNewLook.tsx` (523 Zeilen) | **alt.** nl 44 / 62; Block `.nl-ranks` (81 Treffer) | ✘ (Tabellen-Muster aus Saisonstand) | nichts | Kaderstärke-Rang, Duellpunkte, Liga-Split 2×16 | 3 | S |
| 31 | Spielplan (View `diszis`) | `diszis`, `ranks-v2/FoundationDiszisNewLook.tsx` (510 Zeilen) | **alt.** nl 40 / 53 | ✘ | nichts | 20 Spieltage je Saison, Heim/Auswärts (Finanzen V2), Duell-Paarungen | 3 | S |
| 32 | Leaders (Bestenlisten, Rekorde, Trophäenschrank, legendäre Spieler) | `leagueLeaders`, `league-leaders-v2/LeagueLeadersNewLook.tsx` (2470 Zeilen) | **alt.** nl 221 / 278; Block `.nl-leaders` (70 Treffer) | ✘ | nichts | PP-Skala (Bestenliste, MVP), Matchwinner | 3 | M |
| 33 | Lexikon | `encyclopedia`, **inline** in `FoundationShellRouterBody.tsx` (Zeilen 1754 ff.), `foundation-encyclopedia-*` | **alt.** eigene Altklassen, nicht ausgelagert | ✘ | nichts | alle neuen Begriffe (Duell 2/1/0, Kaderstärke, Papierform, Moral, Apron neu) | 3 | S |
| 34 | Player Generator | `generator`, `PlayerGeneratorPanelNewLook.tsx` (1605 Zeilen) | **alt.** nl 164 / 189; Block `.nl-gen` (ab Zeile 76288) | ✘ (Werkzeug) | nichts | – | 4 | S (Tokens) |
| 35 | Team-Einstellungen / Spielstände | `teamSettings`, `team-settings/FoundationTeamSettingsNewLook.tsx` (2895 Zeilen) | **alt.** nl 317 / 420 | ✘ | nichts | Steuerung (Mensch/KI), Identität inkl. Finanzwert 1–10 | 3 | M |
| 36 | Changelog | `changelog`, `changelog/FoundationChangelogHost.tsx` (282 Zeilen) | **alt.** nl 27 / 33; Block `.nl-changelog` (33 Treffer) | ✘ | nichts | – | 3 | S |
| 37 | Admin | `admin`, **inline** in `FoundationShellRouterBody.tsx` (ab Zeile 2319, rund 230 Zeilen) | **alt, intern.** `panel`, `room-meta`, `pill` | entfällt | nichts | – | 4 | S |
| 38 | Debug | `debug`, `debug/FoundationDebugGameStatePanel.tsx` (200 Zeilen) | **alt, intern.** eigene Altklassen | entfällt | nichts | – | 4 | S |
| 39 | Disziplin-Bühne-Hinweis | `disciplineStage`, inline in `FoundationShellRouterBody.tsx` (Zeile 3237), `VeloPendingRanking` | **entfällt.** reiner Umleitungs-Hinweis „Diese Ansicht ist umgezogen“ | entfällt | nichts | – | 0 (mit Rahmen löschen) | S |
| 40 | Login | `app/login/` (`LoginFormClient.tsx`, 96 Zeilen) | **alt.** `oly-`/`pill`/`filter`-Altklassen, außerhalb der Foundation | ✘ | nichts | – | 3 | S |
| 41 | Start-/Spielstandwahl und Räume | `app/page.tsx` + `HomePageClient.tsx` (289 Zeilen), `app/room/`, `components/LobbyCard.tsx`, `FoundationRoomFlowBar` | **alt.** `oly-`/`primary`/`secondary` Altklassen | ✘ | nichts | – | 3 | M |

Nicht Teil dieses Plans: `app/kartenschmiede/` (eigenes Nebenprojekt), `app/dev-arena/` (Entwicklungswerkzeug), Moosgrab.

### 1.6 Zählung

Gezählt sind 42 Zeilen (R1 und 1–41); die Zeile 17 deckt zwei Oberflächen ab (Seite und Overlay), insgesamt sind es also
**43 Flächen**.

| Status | Anzahl Flächen | Welche |
|---|---:|---|
| **neu** | 2 | Einsatzliste (4), Saisonstand (8) |
| **gemischt** | 4 | Rahmen (R1), Formplan (5), Arena (6), Battle Arena (12) |
| **alt** | 36 | alle übrigen, darunter die zwei mit laufendem Bau (Home Übersicht #1584, Nach dem Spieltag #1581) und eine mit fertigem Konzept ohne Bau (Finanzen #1582) |
| **entfällt** | 1 | Disziplin-Bühne-Hinweis (39) |

Rechnerisch ist der Altbestand groß: allein die `*NewLook`-Hauptfiles der 20 größten alten Seiten zählen rund 44 000 Zeilen, dazu
rund 5100 Zeilen mit `.nl-` in `app/globals.css` (81 840 Zeilen insgesamt).

## 2. Neue Mechaniken: Matrix (was jede Seite beim Neukonzept zeigen muss)

Die Mechaniken sind nicht alle auf `main`. Wo sie nur in einem Draft liegen, steht es dabei. Je Mechanik: Quelle, und welche
Seiten sie berühren (Nummern aus Abschnitt 1).

| Mechanik | Stand | Quelle | Betrifft Seiten |
|---|---|---|---|
| **Duell-Wertung 2/1/0** (Sieg 2, Remis 1, Niederlage 0 je Disziplin-Duell, S-U-N statt „Spiele“) | auf main, Saisonstand zeigt Duellpunkte (#1572) | `lib/resolve/battle-mode-pps-duell.ts`, `lib/season/saisonstand-modern-logik.ts` | 1, 6, 7, 8, 13, 21, 30, 31 |
| **Form + Moral** (kleiner Modifikator, Moral-Smiley, Form-Verlauf, „eine Wahrheit“) | auf main (#1571) | `docs/design/form-moral-bau-18-11.md`, `BcMoralGesicht.tsx` | 1, 3, 4, 5, 7, 14, 16, 17, 19 |
| **Formkarten-Farbregel** | auf main (#1571) | `form-moral-bau-18-11.md` | 4, 5, 7 |
| **Kaderstärke** (Vergleich, Papierform ab 55 % / unter 45 %) | auf main (Saisonstand), in #1584 (Home) | `saisonstand-modern-logik.ts`, `HomeModern.tsx` | 1, 4, 8, 13, 15, 30 |
| **Liga-Split 2×16** (zwei Ligen zu je 16 Teams) | auf main (Saisonstand-Reiter) | `foundation-season-history-projection.ts`, `SeasonStandingsModern` | 8, 9, 13, 21, 30 |
| **Finanzen V2** (Kasse je Spieltag in 20 Raten, Tickets nur an 10 Heimspielen, Rangbonus am Saisonende, Fan-Stimmung 0–100, Liga-Topf, Kassensturz, Pflichtkredit) | **nur Konzept** (#1582), keine Spiellogik | `docs/design/finanzkonzept-v2-18-11.md` | 1, 2, 3, 9, 15, 20, 22, 23, 24, 27, 28, 29, 31, 35 |
| **Vorstand: weniger Budgetfreigabe statt Geldstrafen** (Transfers nur auf X %) | **nur Regel** (#1583, CLAUDE.md) | `finanzkonzept-v2-18-11.md` Abschnitt 5.7 | 2, 22, 24, 28 |
| **Verletzung = nicht einsetzbar** (in der Verletzungs-Disziplin 50 % der Basisleistung, gezeigt = gebucht) | **nur Regel** (#1583, CLAUDE.md) | CLAUDE.md Branch `claude/claude-md-finanzregeln-18-11` | 1, 3, 4, 6, 7, 14, 16, 17, 19, 22 |
| **PP-Skala** (bester Spieler einer Disziplin an einem Spieltag um 5 PP, nicht weit darüber; gezeigt = gebucht) | **offene Neueichung** (Regel in CLAUDE.md, Chris 18.11.) | CLAUDE.md Abschnitt „Player Points“ | 4, 6, 16, 17, 19, 22, 32 |
| **Arena-Vollbild** (Band und Schiene fahren weg, Feld = ganzes Fenster, HUD darüber) | Battle-Arena-Vollfläche auf main (#1578); matchdayArena im Rahmen-Bau Schritt 9 | `app-rahmen-modern-18-11.md` | 6, 12, R1 |
| **Icon-Schiene / Regieband / Taktgeber** | Schiene auf main (#1576), Rest Mockup (#1580) | `app-rahmen-modern-18-11.md` | R1 und indirekt jede Seite |
| **Apron-Neueichung** (Linien Median × 1,15 / × 1,35) | nur Konzept | `finanzkonzept-v2-18-11.md` Abschnitt 7 | 22, 28 |

Regel für jede Seiten-PR: vor dem Bau die Spalte „Neue Mechaniken“ der Zeile abarbeiten und im PR-Text belegen, welche Mechaniken
gezeigt werden und welche Datenquelle fehlt (so wie #1584 es für „Spieler des Tages“ macht).

## 3. Reihenfolge in Wellen

Ordnungskriterien: wie oft eine Fläche im Spieltagsablauf gesehen wird, was von ihr abhängt, ob die Mechanik dahinter schon
steht. Daraus:

### Welle 0: Rahmen (zuerst, blockiert alles andere)

Jede Seiten-PR danach müsste sonst ihren Kopf, ihre Hauptaktion und ihre Fußleiste zweimal anfassen. Bau nach #1580 in neun PRs (Band-Gerüst, Taktgeber, Saison-/Kassen-Chip, Schiene, Seiten-Slot, Meldungen, Office als Blatt, Seitenwechsel/Ladezustand, Arena-Vollbild). Vorher: Chris’ sieben offene Entscheidungen. Gleich mit löschen: Zeile 39 (Bühnen-Hinweis).

### Welle 1: Kernschleife (Start → Einsatzliste → Arena → Nach dem Spieltag → Saisonstand)

Wird jeden Spieltag durchlaufen, 20 Mal je Saison. Zwei Teile sind fertig oder im Bau, deshalb zügig:

1. Start/Home (1): #1584 abnehmen und mergen; Office (2) als Blatt im Rahmen.
2. Einsatzliste (4) und Formplan (5): Rahmen anschließen, Fußleiste raus, Rückfall `LineupNewLook` löschen; Formplan-Board neu.
3. Arena (6): Hülle und Vollbild (Rahmen-Schritt 9); HUD-Wellen laufen unabhängig weiter.
4. Nach dem Spieltag (7): #1581 abnehmen.
5. Saisonstand (8): Rahmen-Slot, Rückfall `SeasonStandingsNewLook` löschen.
6. Inbox (3) mit Meldungen (Rahmen-Schritt 6).
7. Saisonende (9): braucht die Finanz-Buchungen (Rangbonus, Kassensturz); Mockup zuerst, Bau nach Finanzen-Stufe 4–5.

### Welle 2: Kader, Spieler, Markt, Geld (täglich genutzt, größte Altbestände)

Reihenfolge nach Abhängigkeit: Spielerprofil/Drawer (17) zuerst, weil jede Liste ihn öffnet; dann Spieler-Liste (16), Teams (13–15),
Training und Gebäude (19, 20), Transfermarkt samt Draft und Dialogen (22–24). Finanzen, Kredite, Sponsoren (27–29) als ein
Block **nach** den Mechanik-Stufen 4–5 des Finanzkonzepts, sonst baut man eine Seite für Zahlen, die es noch nicht gibt.
Scouting (25) rutscht in Welle 3, weil es ohne Draft/Markt keinen Sinn hat.

### Welle 3: Nachschlagen und Verwaltung

Ranks, Spielplan, Leaders, Ewige Tabelle, Historie, Merkliste, Scouting, Lexikon, Team-Einstellungen, Changelog, Login,
Spielstandwahl, Saisonstand-Preview. Fast alles Tabellen oder Listen: ein gemeinsamer Tabellen-Baukasten (`BcTable`
existiert) trägt sie, danach je Seite S.

### Welle 4: Werkzeug und Aufräumen

Cockpit, Admin, Debug, Generator, Battle Arena bekommen nur die neuen Tokens (kein Konzept nötig). Danach die Altlasten (Abschnitt 5)
in einem Rutsch. **Wichtig:** `globals.css` und `components/foundation/new-look/`/`velo-ui/` erst löschen, wenn keine Seite mehr
darauf zeigt; vorher je Seiten-PR nur den eigenen Block entfernen.

## 4. Fable-Mockups als Nächstes (Top 5)

Gemäß CLAUDE.md „Größere Konzepte: zuerst Mockup + Erklärung“. Ausreichend vorhanden sind bereits: Start, Einsatzliste,
Nach dem Spieltag, Saisonstand, Finanzen, Rahmen, Basketball-HUD. Es fehlen, in der Reihenfolge ihres Nutzens:

1. **Spielerprofil + Spieler-Drawer (17).** Das am häufigsten geöffnete Detail, nicht ein einziges Mockup, ein Bau (4337 Zeilen
   Altbestand), und es zeigt fast jede neue Mechanik (PP-Skala, Form-Verlauf, Moral, Verletzung). `BcMoralGesicht`, `BcSheet`
   sind vorbereitet.
2. **Transfermarkt mit Draft, Kauf-/Verkauf-/Vertragsdialogen (22–24).** Größte Einzelseite des Alt-Stils (3211 Zeilen, 388
   CSS-Treffer) und der Ort der Budgetfreigabe. Die Mockups vom 14.11. (`kauf-modal-mockup.html`) sind vor dem Designsystem
   entstanden und taugen nur als Inhaltsliste.
3. **Kader und Teams: Team-Detail, Teamprofil, Spieler-Liste (13–16).** Ein gemeinsames Mockup, weil dieselbe Zeile
   (Spieler mit Form, Moral, Verletzung, PP) überall wiederkehrt.
4. **Saisonende und Saisonwechsel (9).** Ablauf „Saison abschließen → Buchungslauf → Entwicklung → Kassensturz → neue Saison“ als
   geführter Ablauf; hängt am Finanzkonzept (#1582), das es als Daten-Mockup schon zeigt.
5. **Training und Gebäude als „Entwicklung“ (19, 20).** Zwei Seiten, ein Thema, jeweils über 1400 Zeilen Altbestand.

Danach ein einziges **Sammel-Mockup „Tabellen und Nachschlagen“** (Ranks, Spielplan, Leaders, Ewige Tabelle, Historie,
Merkliste, Scouting): zeigt, dass der Saisonstand-Tabellenbaukasten fünf Seiten trägt, spart fünf Einzelmockups.

## 5. Altlasten: was nach dem Umbau je Seite gelöscht werden kann

Zeilenzahlen gezählt am Stand `origin/main`. CSS-Bereiche in `app/globals.css` sind grob („ab Zeile“), weil Blöcke sich teils
überlappen. Löschen erst, wenn die Seite abgenommen ist und kein anderes Bauteil mehr die Klassen nutzt (vorher `grep` auf das
Präfix im ganzen `app/` und `components/`).

| Seite (Nr.) | Datei(en) löschen | CSS-Bereich in `app/globals.css` |
|---|---|---|
| Home Übersicht (1) | `home-v2/HomeV2NewLook.tsx` (1013 Zeilen) – entfällt schon in #1584 | `.nl-home` 45491–46010 |
| Inbox (3) | `inbox-v2/InboxV2NewLook.tsx` (827) | `.nl-inbox` 46011–46488 |
| Einsatzliste (4/5) | `legacy-lineup-lab/LineupNewLook.tsx` (3102), `FormBoardPanel.tsx` (872) nach Neubau, Rückfall-Weiche `lib/lineups/einsatzliste-look.ts`; in `LegacyLineupLabClient.tsx` (6575) die Zweige für den klassischen Look | `.nl-lineup-*` ab 60208 und Drag-&-Drop-Block ab 62247, rund 2500 Zeilen |
| Arena (6) | alte Kopf-/Steuerzeile in `discipline-stage/DisciplineStageMatchdayPanel.tsx` u. ä., sobald das Band im Rahmen sitzt | Arena-eigene `nl-`-Anteile (Verzeichnis zählt 910 Treffer, noch nicht aufgeschlüsselt) |
| Nach dem Spieltag (7) | `matchday-result-v2/MatchdayResultNewLook.tsx` (890) und die Hosts | `.nl-result*` (142 Treffer) |
| Saisonstand (8) | `season-v2/SeasonStandingsNewLook.tsx` (3589), `season-standings-new-look.css` (955), Weiche `lib/season/saisonstand-look.ts`, Look-Schalter im Panel | `.nl-season*` (29 Treffer) |
| Saisonende (9) | `FoundationSeasonFinalePanel.tsx` (435) nach Neubau | `season-final*` (29 Treffer) |
| Saisonstand-Preview (10) | `season-preview-v2/SeasonPreviewNewLook.tsx` (597), falls nicht übernommen | `.nl-preview`-Reste |
| Teams (13, 14) | `teams-v2/FoundationTeamsNewLook.tsx` (2489), `FoundationTeamsDetailPanel.tsx` (3342), `FoundationRosterSellPeekDrawer.tsx` (218) | `.nl-team*` (549 Treffer, größter Einzelblock), `.teams-*` |
| Teamprofil (15) | `team-profile/TeamProfileNewLook.tsx` (2591) | `.nl-team-profile*` (Teil der 549) |
| Spieler (16) | `players-table/` (5848 Zeilen, 8 Dateien) | `.nl-players*` (237 Treffer) |
| Spielerprofil/Drawer (17) | `PlayerDetailDrawer.tsx` (4337), `PlayerHeroNewLook.tsx` (351), `components/foundation/player-drawer/` | `.player-*` (Werdegang-Block ab 44036, Spieler-Hero ab 48748) |
| Training (19) | `training-compact/TrainingCompactNewLook.tsx` (1475), `training-facilities-v2/training-view-shared.tsx` | `.nl-training*` 54021–55239 |
| Gebäude (20) | `facilities-v2/FacilitiesV2NewLook.tsx` (1436), `facilities-overview-v2/` (323) | `.nl-facility*` 55240–55708 |
| Transfermarkt (22–24) | `transfermarkt-v2/TransfermarktV2NewLook.tsx` (3211), Kauf-/Verkauf-Hosts, `ContractRenewalNegotiationModal.tsx` (807), `contract-offer/` (194) | `.nl-market*` 50561–51374, Kauf-Modal „F1“ ab 52149 |
| Scouting (25) | `scouting-center-v2/` (1960) | `.nl-scout*` 52874–53156 |
| Historie (26) | `transfer-history-v2/TransferHistoryV2NewLook.tsx` (1206) | `.nl-thist*` 53157–54020 |
| Kredite (27) | `credits/FoundationCreditsNewLook.tsx` (1447) | `.nl-credit*` (131 Treffer) |
| Finanzen (28) | `finances/FoundationFinancesNewLook.tsx` (1535) | `.nl-fin*` (84 Treffer) |
| Sponsoren (29) | `sponsors-v2/FoundationSponsorsNewLook.tsx` (1804), `prize-v2/` (1033), `components/foundation/sponsor/` | `.nl-sponsor*` 55709–56745 |
| Ranks, Spielplan, Leaders, Ewige Tabelle (30–32, 21) | `ranks-v2/` (1157), `league-leaders-v2/` (2503), `all-time-table-v2/` (1044) | `.nl-ranks*`, `.nl-diszi*`, `.nl-leaders*`, `.nl-alltime*` (zusammen rund 240 Treffer) |
| Team-Einstellungen, Generator, Changelog (35, 34, 36) | `team-settings/` (2914), `PlayerGeneratorPanelNewLook.tsx` (1605), `changelog/` (282) | `.nl-gen*` ab 76288, `.nl-changelog*` |
| Rahmen (R1) | alter Statuschip, `FoundationActivityStrip.tsx` (307), `FoundationPanelSkeleton.tsx`, breite Seitenleiste (Schalter `compactRail={false}`), blaue Rahmenfarben, `foundation-view-enter` | Rahmenblöcke in `globals.css` ab Zeile 58047 („Neuer Look“-Umschalter), `foundation-shell-*` |
| Disziplin-Bühne-Hinweis (39) | Zweig `disciplineStage` im Router (Zeile 3237) | `.foundation-discipline-stage-redirect` |

Am Ende, wenn alle Seiten umgezogen sind, fallen zusammen:

- `components/foundation/new-look/` (22 Dateien, u. a. `NlCard`, `NlTable`, `NlSubTabs`) und `components/foundation/velo-ui/`
  (14 Dateien). Vorher prüfen, welche Bausteine (`NlSparkline`, `NlRadar`, `NlGauge`) ins Broadcast-System übernommen werden.
- die Hauptmasse der rund 5100 Zeilen mit `.nl-` und der `velo`-Reste in `app/globals.css`; die `nl-`-Token-Variablen erst zuletzt
  (Hinweis in `globals.css` Zeile 38218: `--nl-bronze-text`).
- der Router-Körper `FoundationShellRouterBody.tsx` (3346 Zeilen, `/* eslint-disable */`, „AUTO-GENERATED“) schrumpft von selbst, weil
  Lexikon, Admin und Debug ausgelagert werden können; daraus ist ein eigener Aufräum-PR nach Welle 3 zu machen.

## 6. Arbeitsregeln für jeden Seiten-PR (Vorschlag)

1. **Mockup zuerst** (Fable), Chris sagt „bau das“, dann Bau mit Sonnet, Prüfung durch die Hauptsitzung (CLAUDE.md).
2. **Neue Komponente und eigenes Präfix**, nicht in die alte Seite einhängen. Keine Weiche „modern/klassisch“ auf Dauer: höchstens
   eine Abnahmephase von einem Tag, danach löscht derselbe PR die alte Fassung samt ihrem CSS-Block.
3. **Abgleich Mockup | App** bei 2560×1440, 1920×1080 und 1710×1112 (CLAUDE.md, PR #1574); Seite scrollt nicht, keine Tafel läuft über.
4. **Mechaniken-Zeile abarbeiten** (Abschnitt 2) und im PR-Text die Lücken nennen.
5. **Wertungs-Fingerabdruck** `node scripts/pruefe-wertung-fingerabdruck.mjs` bleibt unverändert (reine Anzeige), Stand
   `ce8fcef66028`.
6. **Keine neuen PixelLab-Figuren oder -Animationen**; Seiten bauen aus CSS/SVG, vorhandenen Portraits und Kulissen.

## 7. Grenzen dieser Inventur

- Rein statisch gelesen: kein Dev-Server, keine Screenshots. „Alt/neu/gemischt“ stützt sich auf Klassenpräfixe und Komponentennamen,
  nicht auf eine Sichtprüfung. Bei Arena (6) und Spielerprofil (17) ist die Einstufung am unsichersten (große Verzeichnisse,
  gemischte Präfixe).
- Die Aufgabe nannte die Branches `claude/einsatzliste-optik-18-11` und `claude/app-rahmen-bau-18-11`; beide gibt es auf dem Remote
  nicht. Als laufend wurden die offenen Draft-PRs #1580, #1581, #1582, #1583, #1584 gewertet.
- Die CSS-Zeilenbereiche sind nach den Abschnittskommentaren in `globals.css` geschätzt, einzelne Regeln einer Seite liegen
  außerhalb ihres Blocks (zum Beispiel `.nl-lineup-*` in zwei Blöcken).
- Die Mockups #1584/#1580 liegen auf Branches, nicht auf `main`; Pfade stehen oben, damit der Bau-Agent sie von dort liest.
