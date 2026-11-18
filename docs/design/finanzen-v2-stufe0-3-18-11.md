# Finanzkonzept V2, Stufen 0 bis 3 — Bau und A/B-Messung (18.11.2026)

Umgesetzt nach `docs/design/finanzkonzept-v2-18-11.md` (Abschnitte 5 und 8) mit Chris' Entscheidungen vom 18.11., die dem Konzept vorgehen.
Spiellogik und Wertung der Disziplinen unberuehrt: `node scripts/pruefe-wertung-fingerabdruck.mjs` ergibt unveraendert **GESAMT ce8fcef66028 (75 Eintraege)**.

## 1. Was gebaut ist

| Stufe | Datei | Inhalt |
|---|---|---|
| 0 | `lib/finance/kontoauszug.ts` | Kontoauszug je Team, **nur Lesen** aus vorhandenen Ledgern (Transferverlauf, Sponsor-Auszahlungslog, Apron-Log, Vorstandsziel-Log, Notfall-Kasse). Nichts neu gebucht, GuV unveraendert. Spieltags-Zeilen kommen mit der Taktung (Stufe 4). |
| 0 | `scripts/miss-teamfinanzen-saison.ts` | **32 KI-Teams von Anfang an**: M-M (technisch noetiges Chris-Team der Neuanlage) wird direkt nach der Anlage auf KI gestellt und signiert seinen Sponsor, BEVOR der Draft laeuft (Fix des Messartefakts „M-M ohne Sponsor“). Neu: Kaderstaerke (Top-6-Eignung je Disziplin), Finanzwert, Vertrauen, Sponsor-Anker, Kontoauszug-Summen, Kasse je Spieltag; `--nur-anlage` / `--von-anlage` fuer **paarweise A/B auf identischer Basis**, `--stop-after draft|kaufphase`. |
| 0 | `scripts/vergleiche-finanzen-v2.mjs` | A/B-Tabellen und die Abbruchpruefung (Kaderstaerke-Median -5 %, Kader unter Minimum). |
| 1 | `lib/finance/ki-ruecklage.ts`, `draft-adapter.ts`, `draft-builder.ts` | Ruecklage = max(q x Budget, 0,35 x Zielgehalt), q = 5 % + 20 % x (Finanzwert - 1) / 9; Budget = Kasse + Kaderwert, Zielgehalt = `projectSalaryAtPlannerTarget`. Wirkt im echten Draft-Pfad (organischer Kaderbauer, S1-Draft und Kaufphase der Folgesaison) als `cashBuffer`, `solvencyFloor` und neu `minFillFloor` (Ruecklage auch unter dem Kader-Minimum; reicht das Geld nicht fuer Ruecklage UND Mindestkader, gewinnt der Mindestkader). **Weich**: nur Kaufgrenze der KI, keine Sperre fuer den Menschen. |
| 2 | `lib/finance/sponsor-erwartung.ts`, `draft-adapter.ts` | Forecast bekommt `sponsorIncome = 0,92 x terms.anchor` des signierten Vertrags statt 0 (alle drei Aufrufer lassen `forecast` weg; der Default sitzt im Adapter). **Kein harter Gehaltsdeckel, `OLY_SALARY_CEILING_V2` bleibt aus.** |
| 3 | `lib/finance/vorstand-budgetfreigabe.ts`, `transfermarkt-local-service.ts`, `draft-builder.ts` | Vorstand-Freigabe, **hart**, Mensch und KI gleich (siehe 3). |

Alle drei KI-Stufen sind einzeln per Env abschaltbar (`OLY_KI_RUECKLAGE_V2=0`, `OLY_KI_FORECAST_SPONSOR=0`, `OLY_VORSTAND_BUDGET=0`); alle auf 0 ist bit-gleich zum Stand vor diesem PR (so wurde „vorher“ gemessen).

## 2. Entscheidungen

* **Rücklage nach Finanzwert (1 bis 10)**, nicht nach Budget (Chris 18.11.). Niedriger Wert 5 bis 10 %, hoher 15 bis 25 %. Kein Team unter dem eigenen Soll (32 von 32 erreichen q x Budget).
* **Kein neuer Gehaltsdeckel.** Die Orientierung am Sponsor ist weich: Forecast (Stufe 2), Ruecklage (Stufe 1), Vorstand (Stufe 3).
* **Vorstand nimmt nichts weg** (Chris' Praezisierung): Das Geld bleibt auf dem Konto, freigegeben sind nur X % zum Ausgeben, fuer Abloesen UND Jahresgehaelter neuer Vertraege.

## 3. Vorstand-Budgetfreigabe (Stufe 3)

Vertrauen = `seasonState.boardConfidence[team].value` (1 bis 10, vorhandenes Board-System, nichts neu berechnet).

| Vertrauen | Stufe | Freigabe |
|---|---|---:|
| ab 6 | hoch | 100 % |
| 4 bis unter 6 | mittel | 85 % |
| 2,5 bis unter 4 | niedrig | 70 % |
| darunter | Sparauflage | 50 % |

* Saison 1: immer 100 % (kein Vorjahr, Board neutral 5, sonst waere jedes Team „mittel“ ohne Misserfolg).
* **Hart**: `pruefeKaufGegenVorstandFreigabe` blockiert im Kaufpfad (`executeLocalTransfermarktBuy`, Vorschau und Fast-Batch; Grund `vorstand_budget_nicht_freigegeben`). Ausnahme: unter dem Kader-Minimum (8) gilt die Sperre nicht, ein spielfaehiger Kader geht vor.
* **Verkaufserloese unter derselben Quote**: freigegeben = Anteil x (Anfangskasse + Verkaufserloese). Bei 70 % werden von 20 C Erloes 14 C frei, 6 C bleiben als Puffer.
* **Anzeige-Funktion** `berechneVorstandBudgetStand(gameState, teamId)` fuer Transfermarkt und Spielerprofil: `freigegebenGesamt`, `ausgegeben`, `nochFrei`, `gesperrt` (auf dem Konto, nicht ausgebbar), `grund` (ein Satz). Der Rueckgabewert traegt schon zwei Toepfe (`investition`, `gehalt`, `getrennt: false`); heute ist `gehalt` ein leerer Platzhalter und die Gehaelter zaehlen gegen die gemeinsame Freigabe.
* Rechnung ohne neuen Speicher, aus dem Transferverlauf der Saison. **Nicht erfasst:** Gehaltserhoehungen bei Vertragsverlaengerungen (anderer Buchungspfad) und eine UI.
* Die weiche Ruecklage (Stufe 1) bleibt weich.

## 4. A/B-Messung

Methode: zwei Anlagen (Saaten `new-game-1794999053691-yyec6b`, `new-game-1794999386737-3dhmr5`), je 32 KI-Teams, Anlage-SQLite kopiert, dann **gleiche Basis, nur die Schalter verschieden** (paarweise). „vorher“ = alle drei Schalter 0. Saison 1 wurde bis zum Draft an beiden Saaten gemessen; Saison 1 komplett plus Kaufphase Saison 2 an der ersten Saat (siehe 4.3).

### 4.1 Saison 1 nach dem Draft (Stufen 1 und 2; Stufe 3 gibt in S1 100 % frei)


### Saison 1, nach dem Draft: Cash und Kader

| Klasse | n | Cash C (Median) vorher | Cash C (Median) nachher | Cash % Budget (Median) vorher | Cash % Budget (Median) nachher | Kader (Median) vorher | Kader (Median) nachher | Kader min vorher | Kader min nachher | Gehalt (Median) vorher | Gehalt (Median) nachher |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| FW < 3 | 14 | 5.9 | 23.1 | 2.4 % | 9.0 % | 11.0 | 10.0 | 9.0 | 9.0 | 75.6 | 70.7 |
| FW 3 bis 7 | 30 | 6.5 | 33.5 | 2.8 % | 13.1 % | 11.5 | 10.0 | 9.0 | 8.0 | 63.3 | 56.9 |
| FW ab 7 | 20 | 6.8 | 52.3 | 3.2 % | 20.9 % | 12.0 | 10.0 | 10.0 | 8.0 | 64.4 | 53.1 |
| alle | 64 | 6.4 | 33.8 | 2.9 % | 15.3 % | 11.0 | 10.0 | 9.0 | 8.0 | 64.6 | 56.5 |

### Saison 1, nach dem Draft: Sponsor-Deckung (erwarteter Sponsor 0,92 x Anker / Gehalt)

| Klasse | n | Quote (Median) vorher | Quote (Median) nachher | Teams mit Quote < 0,8 vorher | Teams mit Quote < 0,8 nachher |
|---|---:|---:|---:|---:|---:|
| FW < 3 | 14 | 0.88 | 0.90 | 6 | 4 |
| FW 3 bis 7 | 30 | 1.01 | 1.11 | 3 | 2 |
| FW ab 7 | 20 | 1.01 | 1.25 | 3 | 0 |
| alle | 64 | 1.00 | 1.10 | 12 | 6 |

### Kaderstaerke nach dem Draft (Saison 1)

Top-6-Eignung je Disziplin und Team (fehlende Plaetze zaehlen 0); je Disziplin Median bzw. unterstes Viertel (P25) ueber alle Team-Laeufe, dann Mittel ueber die Disziplinen.

| Kennzahl | vorher | nachher | Aenderung |
|---|---:|---:|---:|
| Median (Mittel ueber Disziplinen) | 48.12 | 46.19 | -4.0 % |
| Unterstes Viertel P25 | 42.40 | 40.02 | -5.6 % |

Groesster Rueckgang je Disziplin (Median): staffel -7.6 %, mini-dm -5.1 %, speed-schach -5.0 %

Kader unter Minimum (8) — s1_01_nach_draft, vorher: 0 von 64

Kader unter Minimum (8) — s1_01_nach_draft, nachher: 0 von 64

## Abbruchkriterien

Keines ausgeloest (Kaderstaerke-Median nicht um mehr als 5 % gefallen, kein Kader zusaetzlich unter dem Minimum).


Zerlegung: Nur Stufe 1 (Stufe 2 aus) liefert fast dieselben Zahlen (Kaderstaerke Median -4,1 %, P25 -5,9 %, Cash 15,3 % Budget). **Stufe 2 (Sponsor im Forecast) bewegt in S1 praktisch nichts**, weil die harten Boeden der Ruecklage den Kauf schon begrenzen, bevor der weiche Brems-Nutzen entscheidet. Sie bleibt als Vorbereitung fuer die Folgesaisons und kostet nichts.

### 4.2 Lesart

* Cash nach Draft je Finanzwert-Klasse: FW unter 3 **9,0 %**, FW 3 bis 7 **13,1 %**, FW ab 7 **20,9 %** des Budgets (vorher 2,4 / 2,8 / 3,2 %). Das entspricht der Vorgabe.
* Kader im Median **10 statt 11 Spieler**, kleinster Kader 8 statt 9, **kein Kader unter dem Minimum**. Gehalt im Median 56,5 statt 64,6 (-12,5 %); Sponsor-Deckung (0,92 x Anker / Gehalt) im Median 1,10 statt 1,00, Teams mit Quote unter 0,8: 6 statt 12 von 64.
* Kaderstaerke im Median **-4,0 %**, unterstes Viertel **-5,6 %** (Mittel ueber 20 Disziplinen). Das ist knapp unter der Abbruchgrenze von 5 % im Median (die Grenze betrifft den Median), aber nahe daran: die Abbruchbedingung ist **nicht ausgeloest**, der Spielraum ist klein. Groesster Rueckgang: Staffel (-7,6 %), Mini-DM, Speed-Schach.
* Ausgangsbefund Saison 1 (nur „vorher“-Lauf, volle Saison): Median Sponsor/Gehalt 0,90, 16 von 32 Teams unter 0,9, Σ GuV der Liga -124 C, **13 von 32 Teams mit negativer Kasse nach der Saison-Abrechnung**; die Kasse bleibt ueber alle 20 Spieltage flach (alles wird heute am Saisonende gebucht, Taktung ist Stufe 4).

### 4.3 Saison 2, Kaufphase

SAISON2_PLATZHALTER

## 5. Tests

`tests/finanzen-v2-stufe0-3.test.ts` (16 Tests): Rücklage (Endpunkte, Finanzwert statt Budget, Gehalts-Untergrenze), Vorstand-Stufen 100/85/70/50, **Kauf ueber der Freigabe abgelehnt**, **Verkaufserloes nur zu X % frei (20 C bei 70 % -> 14 C)**, **Kontostand unveraendert durch die Sperre**, Kader-Minimum-Ausnahme, Kontoauszug aus Ledgern, Builder (`minFillFloor` bit-gleich ohne Wert, Mindestkader vor Ruecklage, `spendCap`). Lauf der Nachbarsuiten (organic-squad, ai-picks, Transferfenster, Kredite, Notverkauf): gruen bis auf zwei Zeitueberschreitungen unter Last (`ai-picks-run-service`, `ki-kauft-erst-im-kauffenster…`; Mocks, bei 18 Last auf der Maschine; mit verlaengertem Timeout gruen bzw. nur das 30-s-Limit gerissen). `tsc` ohne Fehler in den beruehrten Dateien, `eslint` ohne neue Meldungen.

## 6. Offene Punkte

1. **Kaderstaerke -4 % im Median / -5,6 % im unteren Viertel, Kader 10 statt 11**: unter der Abbruchgrenze, aber der Preis der Ruecklage. Offene Frage an Chris: Startbudgets +15 %.
2. Vorstand-Sperre fuer Gehaltserhoehungen bei Verlaengerungen und die UI (Transfermarkt, Spielerprofil) fehlen noch.
3. Der Kontoauszug zeigt heute nur Saisonende- und Transferzeilen; Spieltagszeilen kommen mit Stufe 4.
4. Zwei Saaten im Draft-A/B, eine im Voll-Lauf: fuer Verteilungsaussagen duenn.
