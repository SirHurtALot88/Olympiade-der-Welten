# Finanzseite V2 — Bau, Entscheidungen, Messung (18.11.2026)

Baut auf `docs/design/finanzen-v2-stufe0-3-18-11.md` und `finanzkonzept-v2-budgets-18-11.md` (Abschnitt 12 = Chris' Entscheidungen).
Wertung und Arena-Motor unberührt (`pruefe-wertung-fingerabdruck.mjs`: GESAMT ce8fcef66028 bleibt).

## 1. Was gebaut ist

| Teil | Datei |
|---|---|
| Neue Seite (Kopf mit Kennzahl-Reitern, sechs Reiter: Übersicht, Kontoauszug, Budgets, Sponsor, GuV, Apron; Kontext Lage/Quelle/Liga) | `app/foundation/finances/FinanzenModern.tsx`, `finanzen-modern.css` |
| Lesemodell (Kontoauszug, Verlauf je Station, Prognose) | `lib/finance/finanzseite-modell.ts` |
| Töpfe, Umschichten, Lockerung, Anzapfen, Alles auf eine Karte (Rechnung) | `lib/finance/vorstand-budgetfreigabe.ts` |
| Aktionen (Mensch und KI, gleiche Funktionen) | `lib/finance/vorstand-budget-aktionen.ts` |
| Schreibweg | `POST /api/finance/vorstand` (`authorizeServerRoomWrite`, Aktion `vorstand_budget_update`) |
| Gebäude gegen den Investitionstopf | `lib/facilities/facility-upgrade-service.ts` (Vorschau, damit auch Anwenden und KI) |
| Gehaltserhöhung bei Verlängerung gegen den Gehaltstopf | `lib/contracts/contract-renewal-service.ts` |
| Ausgang der Wette und Anzapf-Kosten als Vorstandsziele (nur Vertrauen, keine Geldstrafe) | `lib/board/team-season-objectives-service.ts` |
| KI-Entscheidung einmal je Fenster | `lib/ai/ai-transfer-window-session-service.ts` |

Raus: `FoundationFinancesNewLook.tsx`, der `.nl-fin-*`-Block in `globals.css`, `finances-view-sections.ts`, die Markup-Tests der alten Seite.
Gehälter stehen **groß je Saison, klein je Spieltag**, Einheit C.

## 2. Quoten (Chris, 18.11. abends, ersetzen 100/85/70/50)

Vertrauen ab 7,5 → 100 %, ab 5 → **90 % (Standard)**, ab 3 → 80 %, ab 1,5 → 70 %, darunter 50 % (Sparauflage). Saison 1 bleibt 100 %. Gehaltstopf-Untergrenze 75 % bleibt. Lockerungs-Puffer 10 / 15 / 20 / 30 % (bei 90 / 80 / 70 / 50 %), Umschicht-Grenze 20 / 17,5 / 15 / 10 % (100 % → 25 %). Ein erfülltes Vorstandsziel bringt Geld und Vertrauen (die Wette: +3 C und +0,75). Der Gehaltspuffer in Saison 1 ist halbiert: in Saison 1 gibt es ihn nicht (alles frei), die Rücklage der KI im Draft war schon halb.

## 3. Entscheidungen (wo das Konzept offen war)

1. **Saison 1 bleibt voll frei** (Chris: Quote 100 % für alle). Ab Saison 2 gilt die harte Sperre, auch bei Quote 100 % für den Gehaltstopf.
2. **Transfertopf ab Saison 2** = q × (Kasse − Rücklage-Ziel − Gehaltspuffer) + q × Verkaufserlöse (Konzept Abschnitt 1). Im ersten Fenster (Saison 2) zählt nur die **halbe** Rücklage (Übergang, Rückfrage an Chris unten).
3. **Gebäude**: Bau und Ausbau gegen den freien Transfertopf; in der Sparauflage keine Gebäude außer mit „Alles auf eine Karte“ (Konzept Abschnitt 7). Verkauf eines Gebäudes zählt als negative Kosten.
4. **Verlängerung**: nur die Gehaltserhöhung zählt gegen den freien Gehaltstopf; gleiches oder niedrigeres Gehalt geht immer, kein Zwangsverkauf. Verlängerungen im Saisonende-Fenster von Saison 1 sind frei (die Saison-ID ist noch 1).
5. **Umschichten** ±25/20/15/10 % des Gehaltstopfs, 1 C = 1 C Jahresgehalt; Gehalt → Transfer nur im Fenster und höchstens die Hälfte von Rücklage + Puffer.
6. **Lockerung**: Puffer 10/20/30 % des tragbaren Gehalts, eine Stufe je Fenster, Mehrfreigabe höchstens der Verkaufserlös, Boden Rücklage + Puffer + X. Gesperrt bei Kasse im Minus, bei Kredit dieses Fensters und unter dem Kader-Minimum.
7. **Rücklage anzapfen** bis 50 % des Ziels, Vertrauen −0,25 je angefangenem Viertel. Die Kosten stehen als Vorstandsziel „Rücklage angezapft“; **die Quote dieser Saison bleibt** (Wirkung erst bei der nächsten Festlegung).
8. **Alles auf eine Karte**: einmal je Saison, nur im Fenster ab Saison 2. Mensch: Antrag, genehmigt ab Vertrauen 4, sonst Ablehnung mit Begründung. Vorstand fordert es bei Erwartungsrang ≤ 3 und Vertrauen ≥ 8, der Mensch nimmt per Knopf an. Wirkung: Quote 100 % in beiden Töpfen, Rücklage und Puffer entfallen, bis auf 5 % bleibt alles ausgebbar. Ziel eingefroren = Endrang zwei Plätze besser als die Kader-Erwartung (mindestens Platz 1). Ausgang als Vorstandsziel: Treffer +0,75 Vertrauen, Verfehlen −1,0, keine Geldstrafe.
9. **KI** (`entscheideKiVorstandMassnahmen`): Charakter aus der Risikobereitschaft (<4 vorsichtig, >7 aggressiv). Umschichten Transfer → Gehalt nach Charakter (0/50/100 % der Grenze), wenn der Gehaltstopf zuerst bindet; Rücklage anzapfen nur aggressiv und unter Soll; „Alles auf eine Karte“ nur aggressiv, Ambition ≥ 7, Vertrauen ≥ 5, Erwartungsrang ≤ 4, oder wenn der Vorstand es fordert.
10. **Verlauf je Spieltag**: heute bucht das Spiel Sponsor, Gehalt, Gebäude und Kredit am Saisonende, Spieltags-Zeilen gibt es nur für Transfers (Taktung ist Stufe 4). Die Seite zeigt deshalb Start, Spieltage, Prognose und die Saisonabrechnung als eigene Station und erfindet keine Spieltags-Posten.
11. **Liga-Vergleich** steht nach dem Mockup im Kontext-Panel (Reiter „Liga“), der Apron hat einen eigenen Reiter (Chris' frühere Vorgabe bleibt erfüllt, „ganz oben“ ist durch das Mockup ersetzt).
12. Nicht gebaut: KI-Regel „Gebäude höchstens 30 % des freien Betrags und erst bei Soll-Kader“ (die harte Sperre wirkt trotzdem), Pflichtkredit-Lockerungssperre nur vereinfacht, Fans/Merch-Reiter des Mockups (die Mechaniken gibt es noch nicht).

## 4. Messung (`scripts/miss-teamfinanzen-saison.ts`, 32 KI-Teams, Saison 1 voll gespielt, Kaufphase Saison 2, eine Saat)

Paarweise auf identischem Stand vor der Kaufphase (`--stop-after vorkauf`, dann je Variante `--resume`). **vorher** = `OLY_VORSTAND_BUDGET=0` (identisch mit Stufen 1+2 allein); **nachher** = dieser Stand.

| Kennzahl (32 Teams, nach der S2-Kaufphase) | vorher | nachher |
|---|---:|---:|
| Käufe | 69 | 48 |
| Kader (Median / kleinster) | 10 / 6 | 8 / 6 |
| Teams unter Minimum 8 | 7 | 12 |
| Kasse (Median) | 42,9 | 63,2 |
| Negative Kassen / Σ Kasse | 0 / 1300 | 0 / 2108 |
| **Kaderstärke Median** | 44,30 | 41,90 (**−5,4 %**) |
| Kaderstärke unterstes Viertel | 40,29 | 39,28 (−2,5 %) |
| Gebäude gesamt | 43 | 43 |

**Stand vor der Planer-Korrektur: Abbruchkriterium (−5 %) knapp ausgelöst (−5,4 %).** Behoben durch Abschnitt 4b (jetzt −0,8 %, 0 Teams unter 8); die Tabelle hier zeigt den Zwischenstand.

Wie oft greift die Sperre (abgelehnte Prüfungen, Saison-2-Kaufphase):

| Art | Prüfungen | Teams |
|---|---:|---:|
| Kauf, Ablöse über dem freien Transfertopf | 21 | 21 |
| Kauf, Gehalt über dem freien Gehaltstopf | 1 | 1 |
| Gebäude | 0 (1 Lauf: 2 bei einem Team, mit voller Rücklage) | 0 bis 1 |
| Verlängerung | 0 | 0 |

„Alles auf eine Karte“: 0 Nutzungen, Umschichten: 0, Rücklage anzapfen: 0, Lockerung: 0 (KI-Bedingungen sind eng, im Lauf erfüllte keines der 32 Teams sie; Stufen zu Beginn mit den neuen Quoten: 4 hoch (100 %), 24 Standard (90 %), 4 niedrig (80 %)).

### Diagnose

* Es ist **nicht die Rücklage**: ohne Rücklage im Topf (Testlauf) und mit halber Rücklage kommen dieselben Zahlen heraus (Median 41,6 bis 41,9).
* Die abgelehnten Käufe sind je Team genau **ein teurer Zugang** (Ablöse 36 bis 45 C bei 7 bis 36 C frei). Sie kommen aus dem **Markt-Plan der KI** (`ai_preseason_market_buy`, `ai-market-plan-apply-service`), der die Töpfe nicht kennt, nur der organische Planer (`planOrganicDraftForTeam`) bekommt `feeCap`/`salaryCap`. Der Zugang scheitert an der harten Sperre, und die Teams bleiben mit Geld auf der Hand bei Kader 8 stehen (Kasse 60 statt 43).
* **Empfohlene Behebung (nicht mehr in diesem PR):** den Markt-Plan-Planer mit `investition.frei` und `gehalt.frei` als Kaufgrenze füttern, damit er billigere Spieler plant statt eines gesperrten Stars; danach Messung wiederholen. Alternativ die Sperre für die KI nur über den organischen Planer wirken lassen.

## 4b. KI-Planung mit Töpfen (Chris, 18.11. abends; gebaut in diesem PR)

Chris: „das problem mit den budget pots hatten wir schon mal, konnten es nie lösen und nur das entfernen vom budget topf hat es gefixt — wie bekommt man das hin dass die KI trotzdem noch sinnvoll pickt?“ Die alten Fehler kamen daher, dass **Planer und Prüfung mit verschiedenen Zahlen rechneten** und ein gesperrter Wunschkauf das ganze Team stehen ließ.

**Befund der Messung (vorher):** 19 von 32 Teams stehen nach dem Saisonwechsel unter 8 Spielern. Das hatte drei Ursachen, keine war die Rücklage:
1. Die Sperre nahm als Ausnahme das **Identity-Minimum** (`playerMin`, bei vielen Teams 5 bis 7) statt der festen 8. Ein Team mit 6 Spielern und Identity-Minimum 5 wurde gesperrt.
2. Der Markt-Plan (`ai_preseason_market_buy`) wählte einen Wunschkauf ohne Rahmen, scheiterte an der Sperre und **brach das ganze Team ab** (`failed_buy`).
3. Ein verkleinerter Plan (weniger als das Identity-Minimum) wurde als Ganzes verworfen (`roster_after_market_plan_below_player_min`), obwohl die Pflicht nur 8 ist.

**Der Entwurf (genau so gebaut):**
1. **Eine Zahl für Planung UND Sperre:** `kaufRahmen(gameState, teamId)` in `lib/finance/vorstand-budgetfreigabe.ts` liefert `abloeseFrei` und `gehaltFrei`. `pruefeKaufGegenVorstandFreigabe` (die harte Sperre im Kaufweg) und beide KI-Planer holen sich den Rahmen dort.
2. **Erst planen, dann kaufen:** Vor dem ersten Kauf reserviert der Plan die **Pflichtplätze bis 8** (fehlende Plätze x billigster passender Spieler, Gehalt eingeschlossen) und verteilt nur den Rest nach Bedarf. Ein Wunschkauf (auch ein Star) wird nur gewählt, wenn er plus Pflichtreserve in den Rahmen passt. Beide Planer: organischer Planer (`lib/ai/organic-squad/draft-builder.ts`) und Markt-Plan (`buildFinalBuyGate` in `ai-market-plan-apply-service.ts`).
3. **Pflichtkader nie gesperrt:** Kauf, der ein Team auf höchstens 8 bringt (`VORSTAND_PFLICHT_KADER`), ist nie gesperrt, auch bei Identity-Minimum 5. Er zählt gegen den Topf und darf ihn überziehen (das nächste Fenster ist dann kleiner). Mensch und KI gleich.
4. **Leiter statt Stillstand:** Scheitert ein Kandidat an der Sperre, nimmt der Plan den nächsten, billigeren; ein Team, dem nach dem Rahmen noch Pflichtplätze fehlen, bekommt die billigsten übrigen Kandidaten (Auffangnetz). Scheitert der Kauf in der Ausführung nur an der Vorstand-Sperre, wird der Kandidat übersprungen statt das Team abzubrechen. Ein Plan bricht erst unter dem Pflichtkader 8 ab, nicht mehr am Identity-Minimum.
5. **Test:** `tests/ki-planung-toepfe.test.ts` (Eigenschaftstest über 60 Zufallsteams: Pflichtkader erreicht, jeder Kauf ab Kader 8 besteht die Sperre mit den laufenden Summen).

**Rücklage ab Saison 2 nach Gehaltskosten (Chris, 18.11.: „ab season 2 sollten budgets gespart werden basierend auf den gehaltskosten“):** `Rücklage = q(Finanzwert) x Jahresgehalt des Kaders auf Soll-Größe`, ohne Boden. Saison 1 bleibt Startbudget (Rücklage halbiert), bit-gleich. Beispielwerte (C):

| Finanzwert | Gehalt 40 | Gehalt 60 | Gehalt 80 |
|---:|---:|---:|---:|
| 1 (q 5 %) | 2,0 | 3,0 | 4,0 |
| 5 (q 15 %) | 6,0 | 9,0 | 12,0 |
| 10 (q 25 %) | 10,0 | 15,0 | 20,0 |

Der alte Boden 0,35 x Gehalt (14 / 21 / 28) liegt **immer** darüber (q höchstens 0,25). Er entfällt als Rücklage, **wirkt aber im Topf weiter**: der Gehaltspuffer (7 Spieltage = 0,35 x Gehaltsbudget, soweit die Rücklage ihn nicht deckt) bleibt. Deshalb ändert die Umstellung die **Töpfe in der Messung nicht** (Rücklage + Puffer = max(Rücklage, 0,35 x Gehalt)); Schalter `OLY_RUECKLAGE_GEHALT_S2=0` stellt die alte Regel für den Vergleich her.

**Messung (32 KI-Teams, Saison 1 voll, Kaufphase Saison 2, paarweise, eine Saat; die zweite Saat über `OLY_ORGANIC_SEED_SALT` änderte nichts, es gibt nur eine echte Saat):**

| Kennzahl | vorher (Schalter aus) | nachher (alter Stand dieses PR) | nachher (neue Planung) | + Rücklage nach Gehalt |
|---|---:|---:|---:|---:|
| Käufe | 69 | 48 | 68 | 68 |
| Teams unter 8 | 7 | 12 | **0** | **0** |
| Kader Median / kleinster | 10 / 6 | 8 / 6 | 9 / 8 | 9 / 8 |
| **Kaderstärke Median** | 44,30 | 41,90 (-5,4 %) | **43,94 (-0,8 %)** | 43,94 (-0,8 %) |
| Negative Kassen | 0 | 0 | 0 | 0 |
| Kasse Median nach S2-Fenster (C) | 42,9 | 63,2 | 47,6 | 47,6 |
| Kasse in % des Startbudgets (Median) | 17,8 % | 26,3 % | 19,9 % | 19,9 % |
| Soll-Rücklage (q(Finanzwert) x Startbudget, Median) | 14,0 % | 14,0 % | 14,0 % | 14,0 % |

**Kasse in Saison 1:** Median nach dem Draft 18,2 C = 7,3 % des Startbudgets bei einem Soll von 7,0 % (halbierte Rücklage nach Finanzwert); 30 von 32 Teams liegen im Band 0,5 bis 1,5 x Soll. Dort hortet die KI nicht (das untersucht parallel ein anderer Lauf).

**Kasse nach dem S2-Fenster:** 19,9 % des Startbudgets bei Soll 14 % (1,5 x Soll, vorher 1,14 x, alter Stand dieses PR 1,9 x). Gründe, mit Zahlen: (a) bei 7 von 32 Teams ist der **Gehaltstopf** der Engpass (frei unter 5 C), (b) einzelne Teams bleiben bei Kader 8 bis 9 stehen, obwohl noch rund 30 C Transferrahmen frei sind (z. B. C-C, D-P): der Markt-Plan plant dort selbst keinen weiteren Kauf (sein eigener Bedarfs-Stopp, nicht die Sperre), (c) der Standard-Anteil von 90 % lässt 10 % gewollt auf dem Konto. Eine weitere Absenkung gehört in den Planer-Stopp (Bedarf bis Opt), nicht in die Töpfe.

## 4d. Kaderpflicht-Freigabe (Chris, 18.11. abends)

Chris: „Wenn Geld da ist, aber nicht freigegeben, müsste der Vorstand das Geld freigeben, weil das ja schon ein Notfall ist, wenn man nicht das Minimum erreicht und sich nicht dem Optimum nähern kann.“ Gebaut in `kaufRahmen` / `berechneVorstandBudgetStand` (`lib/finance/vorstand-budgetfreigabe.ts`), für Mensch und KI gleich:

1. **Unter dem Minimum** (Identitäts-Minimum, mindestens 8): der Rahmen ist nie kleiner als Platzpreis × fehlende Plätze, Ablöse UND Gehalt. Gedeckt aus der **ganzen Kasse** (auch unter der Notrücklage), ohne Vertrauensverlust.
2. **Zwischen Minimum und Opt:** der Rahmen deckt mindestens die Plätze bis Opt zum Platzpreis, **soweit Kasse über der Notrücklage** da ist. Die Quote (50 bis 100 %) wirkt erst auf das Geld darüber hinaus.
3. **Platzpreis** = Median des freien Marktes (Marktwert und Gehaltsforderung eines sinnvollen Spielers, nicht der billigste Füller). Sobald der Kaderplan #1629 auf main ist, kann er die Platzpreise hineinreichen (`platzPreisAusMarkt` ist die eine Stelle).
4. **Eine Zahl für Planer und Sperre:** `kaufRahmen().grenzeFuer(kaderVorKauf, bereitsAusgegebeneAbloese, bereitsAusgegebenesGehalt)`; der organische Planer (`economy.kaufGrenze`), der Markt-Plan und die Sperre rechnen mit derselben reinen Funktion `kaderpflichtZuschlag`.
5. **Sichtbarkeit (gezeigt = gebucht):** die Zeile „Kaderpflicht: Vorstand gibt X C frei (Kader 6/10)“ steht in der Transfer-Karte der Budgets (`data-testid="fin-kaderpflicht"`) und ist Teil von `TransferFreigabe.kaderpflicht` für den Transfermarkt (`tm-kaderpflicht`). Der Betrag steckt schon im freien Rahmen des Stands.
6. **Kasse reicht wirklich nicht:** die Freigabe ist nie größer als die Kasse; dann greift die bestehende Leiter (Kredit), kein Notkauf.

Messung (derselbe Aufbau wie 4b, eine Saat): **Teams unter 8: 0**, Käufe 75 (vorher 69), Kader Median 10, **Kaderstärke Median 44,50 (+0,5 % gegen „vorher“ 44,30)**, negative Kassen 0, Kasse nach dem S2-Fenster 16,0 % des Startbudgets bei Soll 14,0 % (**1,04 x Soll**, vorher 1,14 x; 20 von 32 Teams im Band 0,5 bis 1,5 x Soll). Tests: `tests/ki-planung-toepfe.test.ts` (Team mit 6 Spielern und 87 C Kasse: Rahmen für 4 Käufe zum Platzpreis; Team bei Opt: keine Wirkung; Kasse reicht nicht: Freigabe höchstens die Kasse; Saison 1: keine Wirkung).

## 4c. Mockup vs. Bau (Abgleich der Aufnahmen aus der echten App)

Bilder: `docs/design/finanzen-v2-seite-18-11/` (Bau: `normal-<reiter>-<breite>.png`, Mockup: `mockup-kasse|auszug|budget-1920.png`). Das Mockup ist eine eigenständige Seite ohne App-Schale; in der App fehlen dem Reiterbereich deshalb rund 110 px Höhe (Kopfzeile der Schale). Der Spielstand der Aufnahmen steht vor Spieltag 1 der Saison 2, deshalb ist der Kontoauszug leer und der Kassenverlauf flach (das Spiel bucht Spieltag-Posten nur für Transfers, siehe Abschnitt 3); das Mockup zeigt erfundene Spieltags-Posten.

| Reiter | Mockup | Bau | Abweichung / Begründung |
|---|---|---|---|
| Kopf | Wappen, Titel, drei Kennzahl-Reiter (Kasse, Sponsoren, Fans und Arena), „nächste Buchung“ | Wappen, Titel, drei Kennzahl-Reiter (Kasse, Budgets, Sponsor), „Saisonende erwartet“ | Fans/Arena gibt es in der Finanzseite nicht (eigene Seiten); an ihrer Stelle die Budgets, weil dort die Freigabe des Vorstands lebt. |
| Reiter | Übersicht, Spieltags-Abrechnung, Hebel, Budgets | Übersicht, Kontoauszug, Budgets, Sponsor, GuV, Apron | „Hebel“ entfällt (Konzept: Umschichten, Lockerung und Sonderwege stehen in Budgets); Sponsor, GuV und Apron kamen aus der alten Seite dazu. |
| Übersicht | Kassenverlauf mit Reserve-Linie, Posten-Balken je Spieltag, Einnahmen-Mix | Kassenverlauf mit Stationen, Balken nur für Saisonabrechnung, fünf Kennzahlen | Keine Spieltags-Posten im Spiel (nur Transfers werden je Spieltag gebucht); Reserve-Linie und Einnahmen-Mix sind nicht umgesetzt. |
| Kontoauszug | Posten, Herkunft, Quelle der Zahl, Betrag, Kontostand je Spieltag, Spieltag-Auswahl | Wann, Art, Posten, Betrag; Saisonende-Erwartung als Kopfzeile | Nur Zeilen aus vorhandenen Ledgern (Transfers, Sponsor, Apron, Vorstandsziele); „Herkunft“ und „Quelle“ nur, wo das Ledger sie hat. Leer vor dem ersten Spieltag. |
| Budgets | Kennzahl-Streifen, zwei Töpfe mit Herleitung, Vorstand-Leiter, Umschichten, Lockerung, „Was gegen welchen Topf zählt“ | Zwei Töpfe mit Herleitung, Vorstand-Leiter, Umschichten, Lockerung, Sonderwege (Rücklage anzapfen, Alles auf eine Karte), Regel-Streifen | Kennzahl-Streifen entfällt (die Zahlen stehen in den Kopf-Reitern und in den Karten); Unterzeilen der Herleitung entfallen unter 1200 px Höhe. Sonderwege sind neu gegenüber dem Mockup (Chris, 18.11.). |
| Kontext-Panel | Lage, Quelle, Liga; „zinsfreier Rahmen“, „nächste Buchung“ | Lage, Quelle, Liga; Gehälter, Saisonende, Prognose | Kein zinsfreier Rahmen im Spiel; die Gehälter stehen groß je Saison und klein je Spieltag (Chris, 18.11.). |
| Sponsor / GuV / Apron | nicht im Mockup | eigene Reiter aus der alten Seite | Gehaltsfaktor-Chip im Reiter GuV (Ton nach Nutzen, Tooltip). |

Korrekturschleife: Seitenhöhe (Schale wächst mit der Breite) und Budgets-Höhe nachgezogen; die Mess-Aufnahme meldet pro Reiter und Breite, ob die Seite scrollt und welche Karten innen scrollen.

## 5. Offene Punkte für Chris

1. Soll im ersten Fenster (Saison 2) nur die halbe Rücklage zählen (Übergang)? Ohne diese Entscheidung wären die Töpfe im ersten Fenster noch enger.
2. Die KI-Planer müssen die Töpfe kennen (siehe Diagnose), sonst kostet die harte Sperre Kaderstärke.
3. Verlängerungen im Saisonende-Fenster von Saison 1 sind frei (Saison-ID 1). Soll die Sperre dort schon für die kommende Saison gelten?
4. Spieltags-Buchungen (Stufe 4) fehlen, der Verlauf je Spieltag ist bis dahin eine Transfer-/Saisonende-Kurve.
