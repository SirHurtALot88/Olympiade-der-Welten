# Spielbarkeit 23.11.: aktueller Save und neues Spiel gegen die echte App

Chris, 23.11.: „Was muss gemacht werden, damit es wieder sauber spielbar ist mit einem neuen oder dem aktuellen Save?“

Messung wie am 19.11. (`docs/design/abnahme-saison-19-11.md`): Produktionsbuild (`npm run build`, `tsx server.ts`,
`NODE_ENV=production`), nur über die HTTP-Routen der Oberfläche, gegen Wegwerf-SQLite-Kopien unter `/tmp` (Auto-Export aus,
**nie** gegen den Hetzner-Server). Werkzeug: `scripts/abnahme-saison-app.ts`, neu dazu die Befehle `bestand`, `laden`,
`pruefe`, `mensch-kaufen`, `vertraege-erledigen` und die Umgebungsvariablen `ABNAHME_MENSCH_AUFSTELLEN`,
`ABNAHME_FORMKARTE_NR`. Rohdaten: `data/generated/spielbarkeit-23-11/`, Bilder: `docs/design/spielbarkeit-23-11/`.

## Kurzfazit

| Frage | Antwort |
|---|---|
| **Aktueller Save (`new-game-1795114260527-nzr0z9`, Chris, D-P) spielbar?** | **Ja, bis S2 und darüber hinaus.** Laden ohne Fehler (2 s), Spieltag 12–20 gebucht (0 Fehler, 0 Verletzte eingesetzt, 32/32 Einsatzlisten), Saisonabrechnung, Verträge öffnen, Saisonwechsel, Neue Saison starten, KI-Fenster (93 Käufe / 63 Verkäufe), danach 4 Spieltage S2, einer davon über die Arena-Oberfläche. **Stolperstein:** der Saisonwechsel verlangt die Entscheidung über alle 10 auslaufenden Verträge (s. F1) und der Sponsor für S2 muss **vor** Spieltag 1 gewählt werden. |
| **Neues Spiel spielbar?** | **Ja.** Anlegen, Draft (Startwahl-Dialog, Auto-Draft), 20 Spieltage, Saisonende, KI-Fenster, 3 Spieltage S2 ohne Fehler und ohne Hänger. |
| **Stempel im laufenden Save** | Wie dokumentiert: S1 rechnet bis zum Saisonende bit-identisch alt (Formkarten `alt`, Marketing `aus`, Entwicklung `alt`, Kredite `saisonende`, Training `aus`, Finanzen je Spieltag fehlt), ab MD12 gelten Hockey-Torwart, Basketball-Puste, Breaking Tag-Team, Battlefield 5 Punkte. **S2 bekommt alles scharf:** C2 + E1 + PP-Tagesanker, Formkarten `plusminus`, Marketing `an`, Entwicklung `neu`, Kredite `raten`, Finanzen je Spieltag `v1`, Trainingsvorlieben `v1`, Ausrüstung `besitz`. |
| **Funde** | 2 Fehler, **2 behoben** (F1, F2, je mit Test), 4 Beobachtungen ohne Eingriff (B1–B4). |
| **Fingerabdruck** | `node scripts/pruefe-wertung-fingerabdruck.mjs --node`: **GESAMT fe1dc086d68d** (unverändert, keine Wertungsänderung). |

## 1. Aktueller Save

Abbild vom 22.11. (`live-save`), Kopie, Chris' Team **D-P**, `manual`, keine Delegation (Voll selbst), Spieltag 12 in Planung.

| Phase | Ergebnis |
|---|---|
| Laden (Lade-Migrationen: C2, Climbing/Battlefield/Hockey/Basketball/Breaking, Formkarten, Entwicklung, Training, Marketing, Ausrüstung, Kredite, Sponsor-Namen) | wirft nicht, 2–3 s, kein Team < 8 (min 9), keine NaN-Kasse. Stempel siehe Kurzfazit, alle „bis Saisonende alt“ wie dokumentiert. |
| Spieltag 12 bis 20 (HTTP wie die Oberfläche: Vorwärmen, `matchday-auto-run` d1/d2, Quick-Sim, „Spieltag abschließen“) | 9/9 ohne Fehler, 32/32 Einsatzlisten, 0 verletzt eingesetzt, 0 fremde Spieler, alle Zeilen Arena-gewertet, Punkte 672 → 1216, Phase `season_completed`. Menschen-Aufstellung wie im UI (KI-Vorschlag übernehmen, Speichern mit bestätigter Abgabe), MD12 mit Formkarten-Plan (D1 und D2 je eine positive Karte). |
| Formkarte „gezeigt = gebucht“ | S2 MD1/MD2 mit Karte: Formmodifikator D-P 18,4 / 6,5 und 29 / 10; ohne Karte (MD3, MD4) 0,8 / 0 und 0 / 0. Die Karte wird gebucht. |
| Saisonabrechnung | ok (6 s). Die Preisgeld-Zeile bleibt `benchmarkOnly` (`cashPayoutApplied: false`), wie im Stempel dieser Saison. |
| Verträge öffnen | ok (35 s), Phase `season_end_management`, 10 offene Entscheidungen bei D-P (alle Draft-Verträge enden mit S1). |
| Entscheidungen | über `/api/contracts/renewal`: 4 freigegeben (Kasse −11,3 → +87,9 C), 6 verlängert. |
| Saisonwechsel prüfen / Neue Saison starten | ok, **270 s in einer Anfrage** (bekannt, L2 vom 19.11.). S2 mit allen neuen Stempeln. |
| KI-Fenster | `completed`, 93 Käufe / 63 Verkäufe, kein KI-Team < 8, 0 Notkredite, 0 Notverkäufe, keine negative KI-Kasse, Gehalt-Median 51,3 (17/32 im Band 50–70), Füller 19 bei 9 Teams (V-W 3 Notweg „fueller_rueckfall“). |
| Mensch im Fenster | D-P mit 6 Spielern (meine Wahl: 4 freigegeben) steht vom Vorstand „Kaderpflicht: 0,3 C frei, Kader 6/8“; Kauf über `/api/transfermarkt/buy`: 3 Spieler gekauft, vierter 409 (Vorstands-Quote), danach 9 ≥ 8. |
| S2 Spieltage 1 bis 4 | 4/4 ohne Fehler; MD1 und MD2 mit Formkarten Plus/Minus. **MD4 (Breaking Tag-Team + Staffel) über die Arena-Oberfläche:** Vorraum → „Zur Battle Arena“ → Vorstellung → START → Quick-Sim; Oberfläche bucht beide Seiten selbst (32 + 32 Zeilen Arena-gewertet), „Beide Disziplinen gewertet“. Bilder 01 und 02. |
| Plausibilität S2 (nach MD4) | `pruefe`: keine nicht-endliche Zahl in Teams, Rostern, Tabelle, Finanzbuchungen, Marketingstand, Krediten; Kasse 9–56 C, keine negative; Finanzbuchungen 32 Teams je Spieltag; Kredite 2 aktiv, 0 im Verzug, Restschuld 49,0 C; Marketing 32/32 Stände (Median 6,0 C, max 9,1 C ans Team); Entwicklungsregel `neu`. |

## 2. Neues Spiel

`anlegen → draft → spieltage 20 → saisonende → messen-fenster → 3 S2-Spieltage`, Mensch M-M auf Halbautomatik.

| Größe | 19.11. (Lauf B) | 23.11. | Anmerkung |
|---|---|---|---|
| Picks / Runden | 381 / 14 | 368 / 14 | |
| Kader < 8 nach Draft | 0 | **0** | 4 Teams auf 8 (A-A, P-S, V-V, Z-H), alle „nichts_leistbar“ (Rahmen erschöpft), kein Notweg dort |
| Kader 8/9/10/11/12/13/14 | —/4/3/6/6/4/9 | 4/3/4/2/8/2/9 | |
| Top-20 gekauft | 0 | **0** | |
| Gehalt Median / im Band 50–70 | 66,1 / 19 | 70,2 / 12 | höher, mehr Teams über 70 (17) |
| Kasse Median nach Draft | 16,6 | **43,1** | Startbudget-Staffel (22.11.) und Rücklage; viele Teams unter der Notrücklage-Zahl der Anzeige, das ist S1-halbe-Rücklage |
| Ausstieg | 23 × Kaderplan, 9 × Pick-Grenze | 23 × „nichts_leistbar“, 9 × Pick-Grenze | |
| 20 Spieltage S1 | 20/20 ohne Fehler | **20/20, 0 Fehler, 0 Verletzte eingesetzt** | ~1300 s gesamt, 40–70 s je Spieltag |
| Finanzen je Spieltag | — | 640 Buchungszeilen (32 Teams × 20), Kasse 9–61 C, Kredite 0 | M-M: Gehalt −4,4, Sponsor +3,7, Rang-Abschlag +0,7, Marketing +0,2 je Spieltag |
| Saisonende | Abrechnung 8 s, Verträge 36 s, Wechsel 256 s | Abrechnung 3 s, Verträge 31 s, Wechsel **46 s** | |
| KI-Fenster S2 | 116 Käufe / 86 Verkäufe | 84 Käufe / 75 Verkäufe | kein KI-Team < 8, 0 Notkredite/-verkäufe, Gehalt-Median 55,4 (16/32 im Band) |
| S2 Spieltage 1–3 | 3/3, 64/64 Arena | 3/3 ohne Fehler, Punkte 0 → 176 | M-M kauft vorher auf 10 (4 Käufe, alle 200) |

Der Draft startet jetzt mit der Wahl „Draft spielen / Selbst kaufen“ (Dialog beim ersten Öffnen, danach Hinweis auf der
Startseite), Bild 03. Das Skript klickt sie seit heute mit.

## 3. Funde — behoben

| # | Fund | Reproduktion | Ursache | Schwere | Fix + Test |
|---|---|---|---|---|---|
| F1 | **Sackgasse im Saisonwechsel:** wer mit offenen Vertragsentscheidungen den Saisonende-Assistenten („nächster Schritt“) bis `lineup_setup` / `next_season_ready` weiterschaltete, konnte weder verlängern noch freigeben (`phase_blocked:renew_contract:next_season_ready`) und „Neue Saison starten“ blieb gesperrt (`vertragsentscheidung_offen:D-P:10`). Der Spielstand kam nicht mehr heraus (nur über das Server-Skript). | Chris' Save, Saisonabrechnung → Verträge öffnen → `advance_step` bis `next_season_ready`, dann `/api/contracts/renewal` | Der Phasen-Riegel erlaubt `renew_contract` nur im Transferfenster und im Saisonstart-Setup; die Sperre des Saisonwechsels (19.11.) verlangt die Entscheidung aber bis zum Start. Die Route kannte nur den Ausnahmefall „Nachholen“ (Vertrag aus früherer Saison). | hoch (Spielstand blockiert) | `darfVertragsentscheidungTrotzPhase` (`lib/contracts/vertragsentscheidung.ts`): nachzuholen **oder** in jeder Saisonende-Phase, solange der Vertrag `renewal_pending` und fällig ist; die Route nutzt es. Test `tests/vertragsentscheidung-verlaengern-oder-freigeben.test.ts` (alle vier Saisonende-Phasen buchbar, kein Freibrief in `season_active` oder für entschiedene Verträge). |
| F2 | Arena-Motor: `TypeError: Cannot set properties of null (setting 'hidden')` beim Umschalten der Reiter (Browserkonsole bei jedem Arena-Besuch) | Arena öffnen (Host klickt `#t2`) | `document.querySelectorAll(".tab")` ist global; ein Reiter ohne Panel ließ `getElementById(...).hidden` auf `null` laufen und brach die Schleife für die übrigen Reiter ab | niedrig (Anzeige) | Panel-Existenz geprüft (`public/mockups/battle-mode.engine.js`, reine Anzeige, Fingerabdruck unverändert). Test `tests/spielbarkeit-23-11.test.ts`. |

## 4. Beobachtungen ohne Eingriff

| # | Beobachtung | Einschätzung |
|---|---|---|
| B1 | **Chris' Team D-P ist im Save schon knapp:** Kasse −1,2 C bei MD12, −3,7 C nach MD20, **−11,3 C** nach der Saisonabrechnung (Gehalt ~103 C gegen Sponsor 49,7 + Preisgeld). Erst die 4 Freigaben (+99 C) drehen es. | Folge der S1-Altregel (alles am Saisonende) und des hohen Gehalts, kein Rechenfehler. Chris sollte beim Saisonfinale Verträge bewusst entscheiden; ab S2 buchen die Finanzen je Spieltag. |
| B2 | **Sponsor S2:** bei „Voll selbst“ muss der Sponsor vor Spieltag 1 gewählt werden (danach `phase_blocked:sponsor_choice:season_active`); D-P hatte in meinem Lauf 0 Sponsor-Einnahmen. Das Postfach meldet „Sponsor wählen“ offen. | So gebaut; mein Skript überspringt die Postfach-Sperre. Auf Halbautomatik (M-M) wählt die KI beim ersten gewerteten Spieltag. |
| B3 | 404 für `/api/media/player-portrait/player-2560-columbra-and-dovian` (Spieler ohne Porträtdatei), vom 19.11. bekannt als „404 beim Laden“ | Rückfallbild greift, nur Konsole. |
| B4 | „Neue Saison starten“ 270 s in einer Anfrage am Chris-Save (46 s im neuen Spiel) | L2 vom 19.11., ohne Timeout auf dem Server (reverse proxy prüfen: bei 60-s-Limit bricht die Anfrage ab, der Lauf geht dennoch weiter). |

## 5. Offene Punkte / Was Chris tun muss

* **Server neu bauen lassen** (auto-deploy auf `main`) — der Fix F1 wirkt erst mit dem nächsten Deploy. Bis dahin: Saisonende-Assistent **nicht** über „nächster Schritt“ weiterschalten, solange „Vertragsentscheidung offen“ im Finale steht; erst verlängern oder freigeben, dann „Saisonwechsel prüfen“ und „Neue Saison starten“.
* Vor Spieltag 1 von S2 den Sponsor wählen (Postfach „Sponsor wählen“).
* Vor dem Saisonwechsel auf die Kasse achten (B1).
* Nicht gemessen: Zweit-/Drittspieler (Franky, Ramona) in einem Raum; Playwright-Läufe der Seiten außer Arena/Draft.
