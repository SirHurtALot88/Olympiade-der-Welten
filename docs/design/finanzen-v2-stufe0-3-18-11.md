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

## 3. Vorstand-Budgetfreigabe (Stufe 3, Zwei-Toepfe-Form)

Vertrauen = `seasonState.boardConfidence[team].value` (1 bis 10, vorhandenes Board-System, nichts neu berechnet).

| Vertrauen | Stufe | Transfer-Quote | Gehalts-Quote |
|---|---|---:|---:|
| ab 6 | hoch | 100 % | 100 % |
| 4 bis unter 6 | mittel | 85 % | 85 % |
| 2,5 bis unter 4 | niedrig | 70 % | 75 % |
| darunter | Sparauflage | 50 % | 75 % |

* **Saison 1: 100 % fuer alle**, die Vertrauensquote greift ab Saison 2.
* **Hart**, Mensch und KI gleich: `pruefeKaufGegenVorstandFreigabe` blockiert im Kaufpfad (`executeLocalTransfermarktBuy`, Vorschau und Fast-Batch) mit `vorstand_transferbudget_nicht_freigegeben` bzw. `vorstand_gehaltsbudget_nicht_freigegeben`. Ausnahme: unter dem Kader-Minimum (8) gilt die Sperre nicht.
* **Das Geld bleibt auf dem Konto**; gesperrt heisst nur „nicht ausgebbar“. Die Ruecklage nach Finanzwert (Stufe 1) bleibt weich.
* **Transfertopf**: gesamt = Quote x (Anfangskasse + Verkaufserloese). Verkaufserloese zaehlen nur zu X % (bei 70 %: 20 C -> 14 C frei, 6 C Puffer).
* **Gehaltstopf**: Quote nie unter 75 %. Basis (Startwert) = max(erwarteter Sponsor 0,92 x Anker, Zielgehalt bei Soll-Kader); ausgegeben = aktuelle Gehaltssumme; bei einem Verkauf faellt die Summe, das **Gehalt kommt zu 100 % zurueck**.
* **Gebaeude** sollen aus dem Transfertopf kommen — noch nicht verdrahtet (Zwei-Budget-Bau danach).
* **Funktion** `berechneVorstandBudgetStand(gameState, teamId)`: `investition` und `gehalt` je `{ gesamt, ausgegeben, frei, gesperrt, quote, grund }` (ein Satz Begruendung), dazu die Kurzformen `freigegebenGesamt/ausgegeben/nochFrei/gesperrt` des Transfertopfs fuer Transfermarkt und Spielerprofil.
* Nicht erfasst: Gehaltserhoehungen bei Verlaengerungen, Gebaeudekaeufe, UI. Spaeter (nicht hier): „Ruecklage anzapfen“ / „Alles auf eine Karte“.

## 4. A/B-Messung

Methode: zwei Anlagen (Saaten `new-game-1794999053691-yyec6b`, `new-game-1794999386737-3dhmr5`), je 32 KI-Teams, Anlage-SQLite kopiert, dann **gleiche Basis, nur die Schalter verschieden** (paarweise). „vorher“ = alle drei Schalter 0. Saison 1 bis zum Draft an beiden Saaten, Saison 1 komplett plus Kaufphase Saison 2 an der ersten Saat (4.3).

### 4.1 Saison 1 nach dem Draft (Stufen 1 und 2; Stufe 3 gibt in S1 100 % frei)


### Saison 1, nach dem Draft: Cash und Kader

| Klasse | n | Cash C (Median) vorher | Cash C (Median) nachher | Cash % Budget (Median) vorher | Cash % Budget (Median) nachher | Kader (Median) vorher | Kader (Median) nachher | Kader min vorher | Kader min nachher | Gehalt (Median) vorher | Gehalt (Median) nachher |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| FW < 3 | 14 | 5.9 | 11.7 | 2.4 % | 4.8 % | 11.0 | 10.0 | 9.0 | 9.0 | 75.6 | 74.3 |
| FW 3 bis 7 | 30 | 6.5 | 16.7 | 2.8 % | 7.3 % | 11.5 | 11.0 | 9.0 | 8.0 | 63.3 | 62.2 |
| FW ab 7 | 20 | 6.8 | 26.7 | 3.2 % | 11.6 % | 12.0 | 11.0 | 10.0 | 9.0 | 64.4 | 58.0 |
| alle | 64 | 6.4 | 17.4 | 2.9 % | 7.6 % | 11.0 | 11.0 | 9.0 | 8.0 | 64.6 | 62.6 |

### Saison 1, nach dem Draft: Sponsor-Deckung (erwarteter Sponsor 0,92 x Anker / Gehalt)

| Klasse | n | Quote (Median) vorher | Quote (Median) nachher | Teams mit Quote < 0,8 vorher | Teams mit Quote < 0,8 nachher |
|---|---:|---:|---:|---:|---:|
| FW < 3 | 14 | 0.88 | 0.89 | 6 | 6 |
| FW 3 bis 7 | 30 | 1.01 | 1.05 | 3 | 1 |
| FW ab 7 | 20 | 1.01 | 1.10 | 3 | 1 |
| alle | 64 | 1.00 | 1.04 | 12 | 8 |

### Kaderstaerke nach dem Draft (Saison 1)

Top-6-Eignung je Disziplin und Team (fehlende Plaetze zaehlen 0); je Disziplin Median bzw. unterstes Viertel (P25) ueber alle Team-Laeufe, dann Mittel ueber die Disziplinen.

| Kennzahl | vorher | nachher | Aenderung |
|---|---:|---:|---:|
| Median (Mittel ueber Disziplinen) | 48.12 | 47.63 | -1.0 % |
| Unterstes Viertel P25 | 42.40 | 41.19 | -2.9 % |

Groesster Rueckgang je Disziplin (Median): showcase -3.4 %, gewichtheben -3.0 %, tennis -3.0 %

Kader unter Minimum (8) — s1_01_nach_draft, vorher: 0 von 64

Kader unter Minimum (8) — s1_01_nach_draft, nachher: 0 von 64

## Abbruchkriterien

Keines ausgeloest (Kaderstaerke-Median nicht um mehr als 5 % gefallen, kein Kader zusaetzlich unter dem Minimum).


Zerlegung: Nur Stufe 1 (Stufe 2 aus) liefert fast dieselben Zahlen (Kaderstaerke Median -4,1 %, P25 -5,9 %, Cash 15,3 % Budget). **Stufe 2 (Sponsor im Forecast) bewegt in S1 praktisch nichts**, weil die harten Boeden der Ruecklage den Kauf schon begrenzen, bevor der weiche Brems-Nutzen entscheidet. Sie bleibt als Vorbereitung fuer die Folgesaisons und kostet nichts.

### 4.2 Lesart

Stand nach Chris' Zwei-Budget-Entscheid (18.11.): **Draft-Ruecklage in Saison 1 halbiert**, Budgets unveraendert, Vorstandsquote in S1 = 100 %.

* Cash nach Draft je Finanzwert-Klasse: FW unter 3 **4,8 %**, FW 3 bis 7 **7,3 %**, FW ab 7 **11,6 %** des Budgets (vorher 2,4 / 2,8 / 3,2 %; mit voller Ruecklage waren es 9,0 / 13,1 / 20,9 %). Ab Saison 2 gilt die volle Ruecklage.
* Kader im Median **11 wie vorher** (mit voller Ruecklage 10), kleinster Kader 8 statt 9, **kein Kader unter dem Minimum**.
* Kaderstaerke im Median **-1,0 %**, unterstes Viertel **-2,9 %** (vorher mit voller Ruecklage: -4,0 % / -5,6 %). Abbruchkriterium (-5 % im Median) **nicht ausgeloest**, mit deutlichem Abstand.
* Sponsor-Deckung im Median 1,04 statt 1,00; Teams mit Quote unter 0,8: 8 statt 12 von 64.
* Stufe 2 (Sponsor im Forecast) bewegt in S1 praktisch nichts: die harten Boeden der Ruecklage begrenzen den Kauf, bevor der weiche Bremsnutzen entscheidet (Test nur mit Stufe 1: nahezu identische Zahlen).
* Ausgangsbefund Saison 1 (nur „vorher“, volle Saison): Median Sponsor/Gehalt 0,90, 16 von 32 Teams unter 0,9, Σ GuV der Liga -124 C, **13 von 32 Teams mit negativer Kasse nach der Abrechnung**; die Kasse bleibt ueber alle 20 Spieltage flach (alles wird heute am Saisonende gebucht, Taktung ist Stufe 4).

### 4.3 Saison 2, Kaufphase

Voller Lauf (eine Saat, paarweise, aktueller Stand mit halber S1-Ruecklage und Zwei-Toepfe-Freigabe): Saison 1 komplett gespielt, danach die Kaufphase der KI in Saison 2. In Saison 2 gilt die Ruecklage voll und der Vorstand die Vertrauensquote (Stufen zu Beginn: 20 hoch, 11 mittel, 1 niedrig, 0 Sparauflage).

| Kennzahl (32 KI-Teams) | vorher | nachher |
|---|---:|---:|
| Σ GuV Liga Saison 1 | -124 C | +63 C |
| Teams mit negativer Kasse nach der S1-Abrechnung | 13 | 6 |
| Sponsor / Gehalt (Median, Abrechnung) | 0,90 | 0,95 |
| Cash nach S2-Kaufphase (Median) | 43,4 | 51,8 |
| Cash nach S2-Kaufphase, FW unter 3 / 3 bis 7 / ab 7 | 38,3 / 46,5 / 34,8 | 41,8 / 52,4 / 51,8 |
| Kader nach S2-Kaufphase (Median) | 9 | 9 |
| Teams unter dem Minimum 8 nach der Kaufphase | 5 | 3 |
| **Kaderstaerke S2, Median** | 44,60 | 44,71 (**+0,2 %**) |
| **Kaderstaerke S2, unterstes Viertel** | 38,64 | 38,70 (+0,2 %) |
| Kaderstaerke S1 nach Draft (Median / P25) | 48,28 | 47,96 (**-0,7 %** / -3,2 %) |

Lesart: In Saison 2 ist die Kaderstaerke **nicht schwaecher** (Median +0,2 %), die Kasse liegt hoeher, weniger Teams im Minus und weniger unter dem Minimum. Dass nach der Kaufphase noch Kader unter 8 stehen, ist in beiden Varianten so: das Auffuellen der Kader geschieht erst spaeter in der Vorbereitung (die Messung endet vor dem Auffuellen). Die Vorstand-Sperre hat dabei in Saison 2 kaum gegriffen, weil 20 von 32 Teams „hoch“ (100 %) stehen; eine Saison-2-Wirkung der Stufen mittel/niedrig ist an einer Saat nicht belastbar auszuweisen. Kein Abbruchkriterium ausgeloest.


## 5. Tests

`tests/finanzen-v2-stufe0-3.test.ts` (16 Tests): Rücklage (Endpunkte, Finanzwert statt Budget, Gehalts-Untergrenze), Vorstand-Stufen 100/85/70/50, **Kauf ueber der Freigabe abgelehnt**, **Verkaufserloes nur zu X % frei (20 C bei 70 % -> 14 C)**, **Kontostand unveraendert durch die Sperre**, Kader-Minimum-Ausnahme, Kontoauszug aus Ledgern, Builder (`minFillFloor` bit-gleich ohne Wert, Mindestkader vor Ruecklage, `spendCap`). Lauf der Nachbarsuiten (organic-squad, ai-picks, Transferfenster, Kredite, Notverkauf): gruen bis auf zwei Zeitueberschreitungen unter Last (`ai-picks-run-service`, `ki-kauft-erst-im-kauffenster…`; Mocks, bei 18 Last auf der Maschine; mit verlaengertem Timeout gruen bzw. nur das 30-s-Limit gerissen). `tsc` ohne Fehler in den beruehrten Dateien, `eslint` ohne neue Meldungen.

## 6. Offene Punkte

1. **Kaderstaerke S1 -1,0 % im Median / -2,9 % im unteren Viertel, Kader 11 wie vorher** (halbe S1-Ruecklage). Startbudgets bleiben (Chris 18.11.), keine +15 %.
2. Vorstand-Sperre fuer Gehaltserhoehungen bei Verlaengerungen und die UI (Transfermarkt, Spielerprofil) fehlen noch.
3. Der Kontoauszug zeigt heute nur Saisonende- und Transferzeilen; Spieltagszeilen kommen mit Stufe 4.
4. Zwei Saaten im Draft-A/B, eine im Voll-Lauf: fuer Verteilungsaussagen duenn.
