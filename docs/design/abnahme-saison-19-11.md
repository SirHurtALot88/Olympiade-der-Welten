# Abnahme 19.11.: Picken in der App + eine Saison durchspielen

Chris, wörtlich: „kannst du das mit dem picken einmal wirklich in der app messen und bestätigen? und bei gelegenheit prüfen
dass die spieltage sauber durchlaufen? also man auch wirklich durch eine season durch kommt?"

## Kurzfazit

| Frage | Antwort |
|---|---|
| **Picken S1 bestätigt** | **Ja.** Kein Team unter 8, keine 8–9 ohne GM-Grund, 0 Teams unter GM-Opt, 0 Notwege/Notkäufe, Top-20 von niemandem gekauft, 18–19/32 im Gehaltsband 50–70 (Referenz 18–21). Zwei Läufe (vor und nach den Fixes) liefern dasselbe Bild. |
| **Picken S2 (Fenster) bestätigt** | **Ja.** 116 Käufe / 86 Verkäufe, kein Team unter 8, 0 unter GM-Opt, 0 Notwege, 0 Notverkäufe, keine negative Kasse, alle KI-Teams auf oder über der Notrücklage, Gehalt-Median 56,1 (20/32 im Band). |
| **Saison durchspielbar** | **Ja.** 20/20 Spieltage S1 + Saisonende + Auf-/Abstieg (3/3) + Fenster + 3 Spieltage S2 ohne Fehler oder Hänger; jede der 704 Disziplin-Zeilen Arena-gewertet. |
| **Funde** | 9 Fehler gefunden, **9 behoben** (F1–F9, je mit Test), dazu 2 Leistungsbefunde mit Ursache (L1, L2) und eine offene Entscheidung (E1). |
| **Fingerabdruck** | `node scripts/pruefe-wertung-fingerabdruck.mjs --node` auf dem Branch (inkl. main #1616): **GESAMT eaafed96150e** (= main). |

## 1. Aufbau

* **Dieselbe App wie auf dem Server:** Produktionsbuild (`npm run build`, `npm start`-Äquivalent `tsx server.ts`,
  `NODE_ENV=production`) gegen eine frische Wegwerf-SQLite unter `/tmp`, Auto-Export aus. **Nicht** auf Hetzner (kein
  Passwort, und ein neuer Spielstand hätte Chris' aktiven verdrängen können).
* **Neues Spiel im Battle-Modus über die echte App:** `POST /api/new-game` (Vorschau → Token → Anlage), Mensch = **M-M**
  (Vorgabe des Assistenten), danach `POST /api/team-settings/control` → **Halbautomatik** (Draft und Transfers selbst,
  Einsatzliste/Training/Gebäude/Sponsor KI).
* **Draft in der Draft-Seite** (Playwright, 1920×1080): ersten Pick selbst (GM-Vorschlag „picken“), danach
  „Überspringen → Variante B“ (Auto-Draft, eigener GM pickt am eigenen Platz).
* **Spieltage wie die Arena:** je Spieltag `ai-batch-prewarm` (wie nach „Spieltag abschließen“), dann
  `matchday-auto-run` mit `commitThroughSide: d1` und `d2`, `stopOnTie: false`, `includeWarningLineups: false`,
  `overwriteExistingLineups: false`, Quick-Sim beim ersten Versuch, Nachfragen bei `arena_vorlauf_laeuft`, danach
  `advance-matchday` („Spieltag abschließen“). **MD8 D1 (Climbing/Canyon) komplett über die Arena-Oberfläche**
  (Vorraum → „Zur Battle Arena“ → Start → Quick-Sim; die Oberfläche hat selbst gebucht).
* **Saisonende wie das Saisonfinale:** „Abrechnung buchen“ (`cash-prize-apply`, phase `season_end`) → „Verträge öffnen“
  (`transition` `open_transfer_window`) → „Saisonwechsel prüfen“ (`preseason-workflow` dryRun) → „Neue Saison starten“
  (`next_season_setup`; stößt den KI-Kauflauf im Fenster an).
* Werkzeug: `scripts/abnahme-saison-app.ts` (Phasen `anlegen | draft | messen-draft | spieltage | arena | saisonende |
  messen-fenster | vertraege | aufnahmen | status`). Rohdaten: `data/generated/abnahme-saison-19-11/` (Lauf A),
  `…/lauf-b/` (Lauf B nach den Fixes). Bilder: `docs/design/abnahme-saison-19-11/`.
* **Drei Läufe.** Lauf A: Spielstand `new-game-1795071093494-nzpdj7` auf origin/main `316c57de` (Draft-Schalter per Env
  gesetzt), ab Saisonende auf dem Branch mit main #1616 und F1–F6. Lauf B: frisches Spiel `new-game-1795077864481-aqai5n`
  auf dem Branch mit allen Fixes, **ohne** Draft-Schalter (prüft F1), Draft + MD1 (prüft F1/F4/F5). Lauf C: frisches Spiel auf dem finalen Build, nur Draft (prüft F2 nach dem Route-Fix).
* Gesichtete Werkzeuge: `abnahme-neues-spiel.ts`, `full-season-ui-playthrough.ts`, `multi-season-smoke.ts`,
  `finish-season-flow.ts`, `baue-battle-save-vw.ts` rufen die Dienste direkt (nicht die App), die beiden letzteren mit
  10-Spieltage-Annahmen bzw. dem alten Blocklauf; `screenshot-draft-seite.ts` und `miss-transferfenster-gemeinsam.ts`
  passen zum Stand und dienten als Vorlage für Messung und Aufnahme.

## 2. Draft Saison 1 — Messung

| Größe | Lauf A (main) | Lauf B (nach Fixes) | Vorgabe |
|---|---|---|---|
| Picks / Runden | 381 / 14 | 381 / 14 | — |
| Teams unter 8 | **0** | **0** | 0 |
| Kader 8–9 ohne GM-Grund | **0** (8–9: B-P Opt 9 elite_curator; P-S, R-L, V-V GM kompakt) | **0** | 0 |
| Teams unter GM-Opt (Plan-Ziel) | **0** | **0** | 0 |
| GM senkt Opt (bewusst, protokolliert) | 8 Teams, Σ −10 Plätze | 8 Teams, Σ −10 | ≤ −2 je Team |
| Kaderverteilung 9/10/11/12/13/14 | 4/3/5/8/3/9 | 4/3/6/6/4/9 | — |
| Notwege / Notkäufe | **0 / 0** | **0 / 0** | 0 |
| Top-20 gekauft (Grenze MW 80,7) | **0** (teuerster Pick 77,7) | **0** (65,9) | 0 |
| Gehalt Median (min–max) | 67,9 (39,2–103,2) | 66,1 (43,5–89,0) | „typisch 50–70" |
| im Band 50–70 / drüber / drunter | **18** / 11 / 3 | **19** / 10 / 3 | Referenz 18–21 |
| Kasse min / Median, negativ | 9,4 / 17,5, 0 | 8,3 / 16,6, 0 | ≥ 0 |
| Kasse : Notrücklage (Median) | 0,51 | 0,51 | S1 = halbe Draft-Rücklage (gewollt) |
| Transferbilanz S1 | „—“ für alle 32 | „—“ für alle 32 | „—“ |
| Ausstieg | 23 × Kaderplan „opt_erreicht…“, 9 × Pick-Grenze (Opt 14) | gleich | — |
| B-P (elite) | 9 = Opt 9, Gehalt 72,3 | 9 = Opt 9 | kompakt |
| Mensch M-M (GM-Auto-Draft) | 11 = Opt 11, Gehalt **103,2**, Kasse 23,7 | 11 = Opt 11, Gehalt 89,0 | s. E1 |

Finanzseite S1: „Kaderaufbau aus dem Startbudget · Startkader −301,30 C (11 Spieler) · Transferbilanz — (erst ab Saison 2)“
(Bild `05-s1-ende-finanzen.png`).

<details><summary>Je Team, Lauf A</summary>

| Team | Liga | GM | Kader | Min | Opt (heute) | Ziel (Plan) | Grund | Gehalt | Kasse | Teuerster |
|---|---|---|---:|---:|---:|---:|---|---:|---:|---:|
| B-P | 1 | elite-curator-08 | 9 | 8 | 9 | 9 | opt_erreicht | 72,3 | 24,1 | 46,0 |
| C-S | 1 | facility-architect-09 | 12 | 8 | 11 | 12 | opt_erreicht | 71,7 | 34,1 | 40,0 |
| G-G | 1 | talent-builder-03 | 14 | 8 | 13 | 13 | max_picks | 69,9 | 28,5 | 35,5 |
| H-R | 1 | star-chaser-06 | 10 | 8 | 12 | 10 | opt_erreicht · GM kompakt | 86,4 | 11,2 | 52,0 |
| L-R | 1 | rivalry-hawk-01 | 13 | 8 | 12 | 13 | opt_erreicht | 82,2 | 15,1 | 36,5 |
| M-M (Mensch) | 1 | risk-gambler-05 | 11 | 8 | 11 | 11 | opt_erreicht | 103,2 | 23,7 | 68,1 |
| N-N | 1 | risk-gambler-08 | 11 | 8 | 11 | 11 | opt_erreicht | 81,8 | 13,3 | 48,2 |
| N-W | 1 | depth-spammer-01 | 14 | 8 | 14 | 14 | max_picks | 69,5 | 16,1 | 23,8 |
| P-S | 1 | star-chaser-08 | 9 | 8 | 10 | 9 | opt_erreicht · GM kompakt | 79,4 | 16,6 | 49,9 |
| R-L | 1 | star-chaser-09 | 9 | 8 | 10 | 9 | opt_erreicht · GM kompakt | 69,5 | 10,3 | 77,7 |
| S-S | 1 | talent-builder-10 | 12 | 8 | 12 | 12 | opt_erreicht | 65,3 | 27,3 | 32,8 |
| T-T | 1 | bargain-hunter-01 | 14 | 8 | 14 | 14 | max_picks | 70,5 | 29,6 | 23,0 |
| V-D | 1 | risk-gambler-03 | 12 | 8 | 11 | 12 | opt_erreicht | 64,5 | 12,3 | 35,5 |
| W-L | 1 | bargain-hunter-06 | 11 | 8 | 11 | 11 | opt_erreicht | 69,1 | 37,0 | 35,5 |
| W-W | 1 | systems-tinkerer-04 | 12 | 8 | 12 | 12 | opt_erreicht | 74,1 | 25,4 | 43,8 |
| Z-H | 1 | risk-gambler-09 | 10 | 8 | 11 | 10 | opt_erreicht · GM kompakt | 90,6 | 11,8 | 67,1 |
| A-A | 2 | star-chaser-02 | 11 | 8 | 12 | 11 | opt_erreicht · GM kompakt | 54,6 | 9,4 | 24,1 |
| B-B | 2 | risk-gambler-07 | 12 | 8 | 12 | 12 | opt_erreicht_tiefe_vor_qualitaet | 55,5 | 10,8 | 20,5 |
| C-C | 2 | bargain-hunter-09 | 14 | 8 | 14 | 14 | max_picks | 63,5 | 26,3 | 16,9 |
| D-L | 2 | culture-keeper-01 | 14 | 8 | 14 | 14 | max_picks | 53,9 | 18,9 | 16,6 |
| D-P | 2 | culture-keeper-02 | 12 | 8 | 12 | 12 | opt_erreicht | 54,8 | 13,5 | 35,5 |
| L-K | 2 | talent-builder-06 | 14 | 8 | 14 | 14 | max_picks | 66,7 | 21,9 | 17,6 |
| M-S | 2 | culture-keeper-05 | 14 | 8 | 14 | 14 | max_picks | 58,3 | 22,6 | 31,4 |
| P-C | 2 | bargain-hunter-07 | 12 | 8 | 12 | 12 | opt_erreicht_tiefe_vor_qualitaet | 52,2 | 24,5 | 19,8 |
| R-C | 2 | rivalry-hawk-03 | 13 | 8 | 13 | 13 | opt_erreicht | 65,5 | 20,0 | 22,5 |
| R-R | 2 | systems-tinkerer-07 | 12 | 8 | 11 | 12 | opt_erreicht_tiefe_vor_qualitaet | 39,2 | 18,4 | 17,6 |
| S-C | 2 | rivalry-hawk-04 | 10 | 8 | 11 | 10 | opt_erreicht · GM kompakt | 54,2 | 16,2 | 35,3 |
| T-C | 2 | depth-spammer-03 | 14 | 8 | 14 | 14 | max_picks | 47,6 | 19,8 | 18,5 |
| T-G | 2 | rivalry-hawk-06 | 11 | 8 | 12 | 11 | opt_erreicht · GM kompakt | 69,3 | 11,3 | 41,8 |
| U-A | 2 | depth-spammer-05 | 14 | 8 | 14 | 14 | max_picks | 54,6 | 13,9 | 15,8 |
| V-V | 2 | star-chaser-07 | 9 | 8 | 11 | 9 | opt_erreicht · GM kompakt | 75,0 | 11,9 | 46,3 |
| V-W | 2 | culture-keeper-09 | 13 | 8 | 12 | 13 | opt_erreicht_tiefe_vor_qualitaet | 44,3 | 12,6 | 15,9 |

„Opt (heute)“ ist `getTeamOptTarget` nach dem Draft (der Kaderstress-Anteil sinkt mit gefülltem Kader); „Ziel (Plan)“ ist
das Ziel aus dem Ausstiegsprotokoll („Zielkader N erreicht“). Teams mit Pick-Grenze (`max_picks`, Opt 14) haben kein
Protokoll; G-G endet dort mit 14 bei Opt 13.
</details>

## 3. Saison 1 — Spieltage

20/20 Spieltage gebucht. Je Spieltag: 32/32 Einsatzlisten vor der Buchung, **0 verletzte Spieler eingesetzt**, 0 fremde
Spieler, D1 und D2 gebucht, „Spieltag abschließen“ angenommen, Saisonstand steigt (Σ Duellpunkte +56 bzw. +64), ab MD8
gezählt: alle Disziplin-Zeilen Arena-gewertet (keine PPS-Brücke, kein `arenaAusfall`).

| ST | Disziplinen | D1 s/Polls | D2 s/Polls | Punkte Σ |
|---:|---|---|---|---|
| 1 | Mini-DM + Eiskunst | 28/2 | 10/0 | 24→56 |
| 2 | Time Trial + Basketball | 8/0 | 9/0 | 88→120 |
| 3 | Showcase + Football | 24/0 | 41/3 | 120→184 |
| 4 | I-Spy + Tennis | 20/0 | 39/3 | 184→248 |
| 5 | Speed-Schach + Breaking | 26/0 | 41/3 | 248→312 |
| 6 | Gewichtheben + Spurt | 26/0 | 48/3 | 312→376 |
| 7 | Takeshi + Wettessen | 30/0 | 41/2 | 376→432 |
| 8 | **Climbing (Canyon, über die Arena-Oberfläche)** + Battlefield | 30/2 | 11/0 | 464→488 |
| 9 | Staffel + Hockey | 44/0 | 40/2 | 488→544 |
| 10 | TDM + Fechten | 26/0 | 39/2 | 544→608 |
| 11 | Basketball + Speed-Schach | 40/0 | 51/3 | 608→672 |
| 12 | Mini-DM + Battlefield | 30/0 | 33/1 | 672→720 |
| 13 | Gewichtheben + TDM | 30/0 | 40/2 | 720→784 |
| 14 | I-Spy + Hockey | 38/0 | 58/3 | 784→848 |
| 15 | Showcase + Spurt | 34/0 | 48/2 | 848→912 |
| 16 | Time Trial + Tennis | 45/0 | 62/3 | 912→976 |
| 17 | Breaking + Takeshi | 41/0 | 49/2 | 976→1032 |
| 18 | Climbing + Eiskunst | 41/0 | 67/3 | 1032→1096 |
| 19 | Staffel + Wettessen | 34/0 | 45/2 | 1096→1152 |
| 20 | Fechten + Football | 37/0 | 60/3 | 1152→1216 → `season_completed` |

Anmerkungen: MD1 D1 und MD2 D1 liefen zweimal (erster Messfehler im Skript bzw. ein Netzabbruch des Messrechners, beide
Male setzte der zweite Aufruf korrekt auf dem schon gebuchten D1 auf — keine Doppelbuchung, Punkte-Σ unverändert). MD8:
2 Treffer „verletzt eingesetzt“ waren Spieler, die sich **in** D1 verletzt hatten und nach der D1-Buchung gezählt wurden
(50-%-Regel, `docs/design/verletzung-regel-18-11.md`) — kein Fehler, das Skript prüft gebuchte Seiten seither nicht mehr.
MD18–20 liefen auf dem alten Server, während auf der Platte schon die Motor-Datei aus main #1616 lag (Merge während des
Laufs); Saison 2 lief vollständig auf dem neuen Build.

Climbing-Canyon (MD8 D1, Bilder `07-canyon-md8-arena-*.png`): Vorraum „32 von 32 Teams bereit“, Vorstellung, Canyon live
(Glocke, Seilschaften, Wege), Quick-Sim, Oberfläche bucht selbst: „Gewertet: Sieg gegen Black Panthers 7 : 3 → 10 : 1 · 2 Pkt.“

## 4. Saisonende → Saison 2

| Schritt | Ergebnis |
|---|---|
| Saisonabrechnung buchen | ok (8 s) |
| Verträge öffnen | ok (36 s), Phase `season_end_management` |
| Saisonwechsel prüfen | ok, `next_season_setup` bereit, keine Blocker |
| Neue Saison starten | ok, **256 s in einer Anfrage** (L2) |
| Auf-/Abstieg | 3/3: auf C-C, D-P, L-K; ab P-S, R-L, W-W |
| KI-Kauflauf im Fenster | `completed`, 116 Käufe, 86 Verkäufe |

## 5. Transferfenster vor Saison 2 — Messung

| Größe | Wert | Vorgabe |
|---|---|---|
| Teams unter 8 | **0** | 0 |
| Kader 8–9 ohne GM-Grund | **0** (9er: B-P Opt 9; P-S, R-L, V-V, W-L mit GM-Ziel 9) | 0 |
| Teams unter GM-Opt | **0** | 0 |
| Kaderverteilung 9/10/11/12/13/14 | 5/8/5/11/1/2 | — |
| Käufe / Verkäufe | 116 / 86 | — |
| Füller < 12 | 16 bei 5 Teams (A-A 2, D-L 3, T-C 4, T-T 1, U-A 6) | — |
| Notwege / Notverkäufe / Notkredite KI | **0 / 0 / 0** | 0 |
| Kasse unter Notrücklage | nur M-M (Mensch, s. F5) | 0 |
| negative Kassen | 0 | 0 |
| Kaderpflicht-Freigabe aktiv am Ende | 21 Teams, je +0 bis +7,3 C (alle stehen am Plan-Ziel) | — |
| Gehalt Median (min–max), im Band | 56,1 (38,0–103,2), **20/32**, 4 drüber, 8 drunter | „typisch 50–70" |
| Transferbilanz S1 | „—“ für alle 32 | „—“ |
| Transferbilanz S2 Median, +/− | −11,8; 7 positiv, 24 negativ | — |

**Verträge (Auftrag „1-Jahres-Verträge“):** 354 von 382 Draft-Verträgen liefen mit S1 aus (Regel „Season 1 Flex-Deal“,
s. E1/F3-Befund). Die KI hat die meisten verlängert: 59 Vertragsenden ligaweit (0–5 je Team), alle KI-Kader danach mit
Endsaison 2–6. Kein Team steht am Fenster dünn da (min 9, nur mit GM-Ziel 9). Das Mensch-Team M-M (Halbautomatik,
Transfers selbst) hat nicht verlängert — seine 11 Verträge stehen als `renewal_pending` in S2 (Entscheidung beim Menschen,
so gebaut: `preseason-workflow-service.ts` `buildNextSeasonGameState`).

<details><summary>Je Team</summary>

| Team | Liga S2 | Kader | Opt | Ziel (GM-Opt) | Verkäufe | Käufe (Σ C) | Füller <12 | Vertragsenden | Gehalt | Kasse | Notrücklage | Kaderpflicht am Ende | Transferbilanz S2 |
|---|---|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|---|---:|
| B-P | 1 | 9 | 9 | 9 | 1 | 2 (34,4) | 0 | 1 | 58,2 | 10,9 | 9,91 | — | −0,55 |
| C-C | 1 | 12 | 14 | 12 | 4 | 4 (54,9) | 0 | 2 | 50,4 | 15,6 | 15,6 | +0 C (12/14) | −10,06 |
| C-S | 1 | 11 | 11 | 11 | 1 | 0 | 0 | 0 | 63,1 | 76,0 | 13,41 | — | 15,83 |
| D-P | 1 | 12 | 12 | 12 | 1 | 1 (24,6) | 0 | 0 | 52,2 | 39,0 | 4,99 | — | −7,59 |
| G-G | 1 | 14 | 13 | 14 | 1 | 1 (33,9) | 0 | 0 | 60,6 | 40,7 | 10,72 | — | 3,3 |
| H-R | 1 | 10 | 12 | 10 | 1 | 4 (63,1) | 0 | 3 | 60,7 | 6,6 | 5,42 | +1,2 C (10/12) | −15,27 |
| L-K | 1 | 14 | 14 | 14 | 2 | 3 (53,6) | 0 | 1 | 58,3 | 12,1 | 11,65 | — | −23,84 |
| L-R | 1 | 12 | 12 | 12 | 3 | 2 (57,3) | 0 | 0 | 74,7 | 7,4 | 7,07 | — | −0,9 |
| M-M (Mensch) | 1 | 11 | 11 | 11 | 0 | 0 | 0 | 0 | 103,2 | 0,0 | 14,63 | — | 0 |
| N-N | 1 | 12 | 13 | 12 | 3 | 7 (99,1) | 0 | 3 | 69,5 | 10,1 | 7,56 | +2,5 C (12/13) | −28,81 |
| N-W | 1 | 12 | 14 | 12 | 5 | 6 (78,8) | 0 | 3 | 56,0 | 8,5 | 7,83 | +0,7 C (12/14) | −4 |
| S-S | 1 | 10 | 12 | 10 | 6 | 4 (69,3) | 0 | 0 | 53,3 | 13,8 | 12,34 | +1,5 C (10/12) | 34,35 |
| T-T | 1 | 12 | 14 | 12 | 3 | 4 (56,2) | 1 | 3 | 56,8 | 17,7 | 14,88 | +2,8 C (12/14) | −13,72 |
| V-D | 1 | 10 | 11 | 10 | 4 | 5 (73,3) | 0 | 3 | 54,7 | 6,4 | 5,57 | +0,8 C (10/11) | −25,07 |
| W-L | 1 | 9 | 11 | 9 | 1 | 2 (43,3) | 0 | 3 | 58,1 | 20,9 | 17,76 | +3,1 C (9/11) | −31,11 |
| Z-H | 1 | 10 | 11 | 10 | 0 | 3 (73,4) | 0 | 3 | 87,7 | 8,7 | 7,59 | — | −73,4 |
| A-A | 2 | 12 | 13 | 12 | 2 | 4 (32,3) | 2 | 1 | 49,2 | 5,2 | 3,9 | +1,3 C (12/13) | −5,69 |
| B-B | 2 | 11 | 12 | 11 | 2 | 2 (37,6) | 0 | 1 | 51,7 | 6,2 | 6,18 | — | −9,17 |
| D-L | 2 | 12 | 14 | 12 | 5 | 8 (81,1) | 3 | 5 | 47,9 | 11,4 | 7,88 | +3,6 C (12/14) | −27,74 |
| M-S | 2 | 12 | 14 | 12 | 7 | 5 (72,8) | 0 | 0 | 56,2 | 12,6 | 11,71 | +0,9 C (12/14) | 26,82 |
| P-C | 2 | 10 | 12 | 10 | 3 | 2 (37,0) | 0 | 1 | 47,4 | 27,2 | 13,4 | +7,3 C (10/12) | 4,15 |
| P-S | 2 | 9 | 10 | 9 | 1 | 4 (61,3) | 0 | 3 | 53,7 | 8,1 | 6,48 | +1,6 C (9/10) | −15,01 |
| R-C | 2 | 13 | 13 | 13 | 1 | 2 (39,5) | 0 | 1 | 68,8 | 12,5 | 12,3 | — | −25,13 |
| R-L | 2 | 9 | 10 | 9 | 1 | 4 (90,3) | 0 | 3 | 74,4 | 7,0 | 5,45 | +1,6 C (9/10) | −76,96 |
| R-R | 2 | 11 | 11 | 11 | 3 | 2 (47,6) | 0 | 0 | 43,5 | 9,3 | 9,1 | — | −13,54 |
| S-C | 2 | 10 | 11 | 10 | 0 | 3 (60,7) | 0 | 3 | 45,8 | 8,2 | 7,65 | +0,5 C (10/11) | −60,72 |
| T-C | 2 | 12 | 14 | 12 | 9 | 8 (86,6) | 4 | 1 | 38,0 | 11,1 | 11,13 | +0 C (12/14) | 39,07 |
| T-G | 2 | 11 | 12 | 11 | 0 | 3 (62,5) | 0 | 3 | 62,4 | 6,6 | 5,88 | +0,8 C (11/12) | −62,49 |
| U-A | 2 | 12 | 14 | 12 | 7 | 8 (64,3) | 6 | 3 | 38,1 | 7,5 | 6,89 | +0,6 C (12/14) | 13,73 |
| V-V | 2 | 9 | 11 | 9 | 0 | 3 (79,7) | 0 | 3 | 62,6 | 9,3 | 7,23 | +2,1 C (9/11) | −79,65 |
| V-W | 2 | 10 | 12 | 10 | 6 | 6 (87,3) | 0 | 3 | 41,7 | 5,1 | 4,84 | +0,2 C (10/12) | −15,27 |
| W-W | 2 | 10 | 12 | 10 | 3 | 4 (67,8) | 0 | 3 | 50,1 | 13,3 | 11,55 | +1,8 C (10/12) | −1 |
</details>

## 6. Saison 2 — Spieltage (neuer Build mit main #1616)

| ST | Disziplinen | D1 s | D2 s | Punkte Σ | Wertung | Sonst |
|---:|---|---|---|---|---|---|
| 1 | Staffel + TDM | 21 | 34 | 0→56 | Arena 64/64 | M-M bekommt zum Saisonstart den KI-Sponsor (F5 live bestätigt) |
| 2 | Wettessen + Mini-DM | 25 | 33 | 56→112 | Arena 64/64 | — |
| 3 | Football + Eiskunst | 30 | 49 | 112→176 | Arena 64/64 | — |

0 Fehler, 0 Verletzte eingesetzt, 32/32 Einsatzlisten. #1616 (Formkarten in allen Disziplinen) lief damit einmal im echten
Durchlauf ohne Auffälligkeit.

## 7. Funde — behoben

| # | Fund | Reproduktion | Ursache (Root Cause) | Schwere | Fix + Test |
|---|---|---|---|---|---|
| F1 | Die neue Draft-Seite (#1623) war auf dem Server nicht einschaltbar | `deploy/hetzner/docker-compose.yml` lesen: `OLY_LIGA_DRAFT_MODUS` fehlt im `environment` | Compose reicht `.env` nur zur Interpolation durch; ohne Eintrag erreichte der Schalter den Container nie → neue Spiele immer mit altem Blocklauf | hoch | Durchreichung + `.env.example`; auf Wunsch von Chris (Draft-Neubau abgenommen) ist der Einzelschritt jetzt **Standard für neue Ligen**, `OLY_LIGA_DRAFT_MODUS=block` = Rückweg; laufende Spielstände unberührt (Sperren verlangen zusätzlich einen Draft-Zustand dieser Saison). Tests `liga-draft-schalter-compose`, `league-setup-draft-service` (Standard ohne Schalter), angepasste Rückweg-Tests. Lauf B: ohne Env → „Draft läuft“. |
| F2 | „Überspringen → Variante B“ während die KI pickt, tat nichts (Lauf A: Draft hing 10 min an meinem Zug; Lauf B nach erstem Fix noch 3 Klicks) | Draft-Seite, eigener Pick, sofort Überspringen B | Jede Aktion trägt `erwarteteNr`; die KI pickt im Hintergrund alle 0,1–0,2 s, der Stand war beim Eintreffen veraltet → `draft_stand_veraltet`, von der Seite bewusst still verschluckt, Dialog geschlossen | hoch (Draft blockiert scheinbar) | Route: Überspringen, Auto-Pick und „fertig“ sind standunabhängig (Pflichtfeld bleibt, Dienst prüft den Stand nicht; Pick prüft weiter); Seite: Neuversuch nach Stand-Konflikt. Tests `liga-draft-api` (A6), `liga-draft-seite`. **Lauf C** (frisches Spiel, finaler Build): Überspringen B wirkt beim ersten Klick, 0 Browserfehler. |
| F4 | Kopf der Shell zeigte nach dem Draft die alte Kasse (256,9 C statt 23,7 C) und „Liga wird erstellt“ | Draft bis Ergebnis | Shell liest den geladenen Spielstand, den während des Drafts niemand nachlud | mittel | Draft-Seite lädt nach, wenn sich der eigene Kader/die eigene Kasse ändert oder der Draft endet (nicht bei fremden Picks). Test `liga-draft-seite` (F4). Lauf B: Kopf 24,4 = Draft 24,4 (`b-03-draft-ergebnis.png`). |
| F5 | Halbautomatik „Sponsor: KI“ wählte nie; die Inbox versprach „Die KI übernimmt“. M-M spielte S1 ohne Sponsor → GuV −113,6 C → Notkredit 93,9 C in S2 | Neues Spiel, Team auf Halbautomatik, Spieltag 1 buchen | Delegation „sponsor“ war nirgends verdrahtet (`chooseSponsorOfferForAiTeams` übersprang jedes `manual`-Team) | hoch (Finanzen des Menschen) | KI wählt zum Saisonstart (erster gewerteter Spieltag, solange die Phase die Wahl erlaubt) für Menschen mit `sponsor: ki`; beim Anlegen weiterhin nicht (Mensch darf vorher selbst wählen). Test `sponsor-offer-service`. Live bestätigt: S2 MD1 (Lauf A) und S1 MD1 (Lauf B, 32/32 Verträge). |
| F6 | Arena-Wertungstabelle: „Eigenes Team“ zeigte die Spieler des Gegners, wenn der Mensch auswärts spielte | MD8 Climbing, M-M auswärts gegen B-P | Links steht immer das Heimteam, die Überschriften waren fest „Eigenes Team/Gegner“ | niedrig | Überschriften tragen die Vereinsnamen aus der Kopfzeile (reine Anzeige in `battle-mode.engine.js`, Fingerabdruck unverändert). |
| F7 | Saisonfinale: „Verträge — nichts läuft aus · erledigt“, obwohl alle 11 Verträge endeten (Startseite: „11 Verträge laufen aus“) | Letzten Spieltag abschließen, Saisonstand → Finale | Zählte den Countdown `contractLength === 0`; der sinkt erst mit der Alterung („Verträge öffnen“) | mittel | Zählt nach der Endsaison (`laeuftMitDieserSaisonAus`), wie die Startseite; vor/nach Alterung gleich, Verlängerung zählt nicht. Test `season-finale-auslaufende-vertraege`. |
| F8 | Finanzseite „Lage: Solide · Kein Handlungsdruck“ bei Prognose −89,9 C | M-M ohne Sponsor, Finanzseite S1 | Lage zählte nur Gehaltsraten in der Kasse; Gehalt/Apron werden erst am Saisonende gebucht | mittel | Negative, noch nicht gebuchte Saisonende-Prognose geht vor („Saisonende im Minus“). Test `finanzen-v2-seite`. |
| F9 | Historie/Transfers: „Saison 1: 0 Picks aus dem Startbudget“ (381), „Deals 100“ (202) | Nach dem S2-Fenster Historie → Transfers | Picks, Deals, Umsatz, Fenster-Kacheln und Teambilanz wurden aus der geladenen Seite (100 neueste) gerechnet | mittel | Kennzahlen aus der vollständigen Historie im Spielstand, gleiche Fenster-Zuordnung wie der Server; mit aktivem Filter weiter aus der Liste. Test `historie-fenster-kennzahlen`. Nach dem Fix am selben Spielstand: „382 Picks aus dem Startbudget“ (381 Draft + 1 Startspieler), „202 Deals“, Bilanz je Team aus allen Deals (`15-nach-fixes-historie.png`). |
| — | Draft-Seite: „Gehaltsbudget: folgt mit dem Budget-Dienst (Finanzen V2)“ | Draft-Seite | Platzhalter aus der Zeit vor #1618 | niedrig | Text: S1 ohne Vorstandsdeckel, Rahmen ab S2, Verweis auf Finanzseite. |

## 8. Leistung — Ursache bekannt, nicht umgebaut

**L1: Jeder Spieltag verwirft den D2-Vorlauf einmal (~30–40 s Mehrzeit).** Server-Log je Spieltag zweimal
`arenaEingabeHash-Divergenz … Snapshot wird NICHT gebucht`. Nachgemessen an einer Kopie: direkt nach dem Vorlauf, nach
`prepareGameStateForMatchdayResolve` und nach dem `ai_lineups`-Schritt divergiert nichts. Die Divergenz entsteht beim
**D2**-Aufruf (D1 Polls 0, D2 Polls 2–3): der Vorlauf rechnet beim D1-Aufruf **beide** Disziplinen, die D1-Buchung ändert
danach Verletzungsstand/Fatigue, also den Eingang von D2 → D2 wird verworfen und neu gerechnet (dann Arena-gewertet,
gebucht = neu gerechnet). Das ist fachlich richtig (eine D1-Verletzung muss D2 erreichen) und gefährdet „gezeigt = gebucht“
nicht (die Bühne baut D2 nach der D1-Buchung neu auf). Vorschlag: der Vorlauf rechnet vor der D1-Buchung nur D1 und stößt
D2 direkt nach `commitThroughSide: "d1"` an (gebuchte Seiten überspringen, D2 bekommt eine eigene Signatur mit dem
D1-Stand). Nicht umgebaut: Eingriff in die Vorlauf-/Buchungskette der Arena (Mini-DM-/Battlefield-/Bahn-Pods hängen
mit dran); nach CLAUDE.md gehört so etwas mit unabhängigem Opus-Review gebaut.

**L2: „Neue Saison starten“ dauerte 256 s in einer Anfrage.** Im Server-Log läuft die XP-/Entwicklungsvorschau
(`[season-end-xp] … preview 32 teams`) **viermal** (dreimal für Saison 1, einmal für Saison 2) und die Liga-Neuberechnung
(2984 Spieler) einmal (1,9 s). Ohne Zeitstempel je Schritt ist die Hauptkostenstelle nicht belegt; der Spielstand nach S1
ist zudem verbraucht (Saison 2 läuft). Nächster Schritt: `next_season_setup` an einer Kopie eines Saisonende-Stands mit
Zeitmessung je Schritt fahren und die mehrfache XP-Vorschau (vermutlich je Aufrufer neu gerechnet) zwischenspeichern.

## 9. Offene Entscheidung

**E1 — Gehaltsband in Saison 1.** Chris' „50–70“ war eine Beschreibung, wo die meisten Teams landeten, keine harte Regel
(Rückmeldung 19.11.). Gemessen: 18/32 (Lauf A) bzw. 19/32 (Lauf B) im Band, 10–11 darüber. Ausreißer sind
`risk_gambler`/`star_chaser` mit großem Startbudget (M-M 103,2 bei 325 C Budget = 31,7 %, Z-H 90,6, H-R 86,4). Der
Mensch-Auto-Draft nutzt **dieselben** Planregeln wie die KI (`fuehreAutomatischenZugAus` → `bewerteKiPick` mit Kaderplan;
Ausstieg „opt_erreicht (Zielkader 11)“); einen Gehaltsdeckel gibt es in S1 nicht (Gehaltstopf ab S2,
`docs/design/ki-pick-analyse-18-11.md` 9.1/S3). Ob das S1-Band enger werden soll, entscheidet Chris.

**Vertragslaufzeiten S1 (geprüft, gewollt):** 354/382 Draft-Verträge laufen 1 Jahr — Regel „Season 1 Flex-Deal“ /
„Season 1 Kaderaufbau: vor stabilem Kern keine breite Mehrjahresbindung“ in
`lib/market/contract-negotiation-preview.ts` (`seasonOneCap`), am Live-Abbild ebenso (297/343, `docs/APRON_UND_VERTRAGSFORMEN.md`).
Folge in S2: die KI verlängert die meisten (59 Vertragsenden ligaweit), kein Team dünn.

## 10. Weitere Beobachtungen (nicht behoben)

* **Mensch ohne Verlängerung:** die 11 auslaufenden Verträge von M-M stehen in S2 als `renewal_pending` weiter im Kader
  (so gebaut, die Entscheidung liegt beim Menschen). Ob ein Spieler mit abgelaufenem Vertrag in S2 spielen darf, sollte
  Chris einmal bestätigen.
* **Saisonabrechnung ohne Sponsor-Gate:** der Finale-Weg (Abrechnung → Verträge → Neue Saison) läuft ohne
  `manual_sponsor_choice_pending`; das Gate sitzt nur in `runLocalSeasonCompletion` (Cockpit). Mit F5 entsteht der Fall
  bei Halbautomatik nicht mehr; bei „voll selbst“ ohne Wahl schon.
* **Board-Toast direkt nach dem Draft:** „Board-Ziel verfehlt: Cash-Reserve von 30M halten“ erscheint vor dem ersten
  Spieltag (Kasse 24,4 nach dem Draft).
* Draft-Seite: der Takt-Knopf heißt nach dem Draft „WEITER WEITER“; die Arena-Vorstellung legt die Regieleiste über die
  Gegnerkarte (`07-canyon-md8-arena-vorstellung.png`); Portraits fehlen lokal (Medien nur auf dem Server, 404 im Log).

## 11. Bilder

| Bild | Inhalt |
|---|---|
| `abnahme-saison-19-11/01-draft-live.png` | Draft live, Runde 1, „Du bist dran“, GM-Vorschlag Top 3 |
| `abnahme-saison-19-11/03-draft-ergebnis.png` | Ergebnis nach dem Draft (Lauf A, Kopf noch mit alter Kasse → F4) |
| `abnahme-saison-19-11/b-03-draft-ergebnis.png` | Ergebnis nach dem Draft (Lauf B, Kopf = Draft-Kasse) |
| `abnahme-saison-19-11/05-s1-ende-finanzen.png` | Finanzseite S1 (Kaderaufbau, Transferbilanz „—“; F8 vor dem Fix sichtbar) |
| `abnahme-saison-19-11/06-s1-ende-saisonstand.png` | Saisonstand Ende S1 mit Finale (F7 vor dem Fix sichtbar) |
| `abnahme-saison-19-11/10-nach-s1-historie.png` | Historie/Transfers nach S1 (F9 vor dem Fix sichtbar) |
| `abnahme-saison-19-11/15-nach-fixes-historie.png` | Historie/Transfers am selben Stand nach F9 (382 Picks, 202 Deals) |
| `abnahme-saison-19-11/11-s2-fenster-transfermarkt.png`, `12-s2-fenster-kader.png` | Transferfenster S2, Kader M-M |
| `abnahme-saison-19-11/07-canyon-md8-arena-live-2.png` | Climbing Canyon live (MD8 D1) |
| `abnahme-saison-19-11/07-canyon-md8-arena-nach-d1.png` | Nach der Buchung durch die Oberfläche |
