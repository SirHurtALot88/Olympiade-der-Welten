# Dynamischer empfohlener VK und Sortimentsentscheidung (Konzept, 13.11.2026)

Entwurf eines Beratungs-Agenten (Fable) auf Basis des Codes und eines Board-Abzugs vom 13.11. (4.249 Zeilen, ohne VK und Einzelverkäufe).
**Alle Schwellen sind Startwerte, noch nicht an Chris' echten Verkaufsdaten kalibriert.** Noch nichts davon ist gebaut.

## 1. Was die Daten hergeben

| Rohdaten | Vorhanden? | Heute genutzt |
|---|---|---|
| Einzelverkäufe (`Sale`: Datum, Menge, Stückpreis, gesamte Historie) | ja | nur Tempo (`pace.ts`) und „letzter Verkauf“; der Stückpreis je Verkauf nicht |
| Fenster 30/90/365/all | ja | Marge, Nachfrage-Beweis, Nachbestellregel |
| Cardmarket Trend/Ø1/Ø7/Ø30/ab | nur der letzte Stand | Marktwert; `trend7vs30` fließt nicht in den Preis |
| Marktpreis-Verlauf | nein: `market/sync.ts` löscht bei jedem Abruf alle Zeilen | – |
| Zahl der Konkurrenz-Angebote (`available`) | Feld da, Abruf füllt es nicht | – |
| Preis-, EK-, Bestandsänderungen | erst seit LEC mitschreibt | Anzeige |
| Einstelldatum | nein (`createdAt` = erster LEC-Import) | – |

Kennzahlen (1.781 aktive Artikel mit Bestand): 394 (22 %) mit mindestens 2 Verkäufen/Jahr bringen 90 % der Stückzahl; 216 (12 %) genau 1 Verkauf, nur 17 mit ≥ 3 € Gewinn je Stück;
285 (16 %) früher verkauft, 365 Tage nichts (224 über 540 Tage, 118 über 730); 886 (50 %) nie verkauft. Fixkosten 4.229 €/Jahr = 1,59 € je Stück, 2,37 € je aktivem Artikel.
80 % des Deckungsbeitrags kommen aus 119 Artikeln. Median Reichweite 11 Monate.

## 2. Dynamischer empfohlener VK

Kette bleibt: Marktwert → Zielspanne → Marktdeckel → Mindestpreis. Neu: Zielmarge m* je Artikel statt fest 25/33 %.
VK(m) = (0,45 + 1,30 + Marktwert) / (1 − Gebührensatz − m); m* = 28 % + A + B + C + D, begrenzt auf 15–40 %.

| Signal | Messung | Wirkung auf m* |
|---|---|---:|
| A Tempo | Tempo × 12 / Soll des Preisbands (unter 8 €: 4/Jahr; 8–20 €: 3; 20–40 €: 2; darüber 1) | ab 2,0: +5 · 1,0–2,0: +2 · 0,5–1,0: 0 · unter 0,5: −3 · nie verkauft: 0 |
| B Reichweite | Bestand / Tempo | bis 3 Monate und Bestand ≤ 2: +3 · 12–24 Monate: −2 · über 24: −4 |
| C Markt | Ø7/Ø30 − 1 (nur ab 2 € Marktwert); „ab“ / Trend | ab +10 %: +3 · bis −10 %: −3 · „ab“ < 0,6 × Trend: −2 |
| D Preisbeweis | Verkäufe seit der letzten Preisänderung | 2 Verkäufe in 60 Tagen: +3 · 0 trotz erwartetem Tempo 1,5: −2 |

Zusammenspiel: Marktwert (mit Zustandsabschlag) → m* → Marktdeckel → niedrigerer aus dynamischem Preis und Ladenhüter-Abschlag → Nachfrage-Beweis als Untergrenze →
Untergrenzen 4,99 € und Deckungsbeitrag 0 am eigenen EK (unter 25 % nur als Abverkauf) → Preisstufen auf .99 (unter 10 €: 1-€-Schritte, 10–30 €: 2 €, darüber 5 %) →
Ruhezeit: neue Empfehlung frühestens 30 Tage nach einer Preisänderung (60 Tage ab 20 €).

Kalibrierung: (1) realisierter Aufschlag je Verkauf = Stückpreis / Marktwert, je Preisband 25./50./75. Perzentil; (2) Wiederverkaufsquote Vorjahr → Folgejahr je Preisband;
(3) nach dem Start Deckungsbeitrag je Artikel und 30 Tage, Empfehlung befolgt gegen nicht befolgt (8–12 Wochen).

## 3. Behalten / Beobachten / Auslaufen lassen / Auslisten

Uhr = Tage am aktuellen Preis ohne Verkauf (seit dem spätesten aus letztem Verkauf, letzter Preissenkung, Einstelldatum). Erste passende Zeile gilt.

| Status | Regel | Größe heute |
|---|---|---:|
| Preis prüfen (geschützt) | nie verkauft und (Einstelldatum unbekannt/unter 12 Monate, oder VK außerhalb der Zielspanne, oder Preis in 90 Tagen geändert); jeder Artikel in der Ruhezeit | bis 886 |
| Behalten | ≥ 2 Verkäufe in 365 Tagen oder 1 Verkauf mit ≥ 3 € Gewinn je Stück | ca. 411 (23 %) |
| Beobachten | 1 Verkauf mit < 3 € Gewinn; oder letzter Verkauf vor 365–540 Tagen bei VK > 5,99 € (erst Preis senken) | ca. 260 (15 %) |
| Auslaufen lassen | über 540 Tage ohne Verkauf am aktuellen Preis; oder nie verkauft, über 12 Monate eingestellt, seit 180 Tagen richtig bepreist. Nicht nachkaufen | höchstens 224 (13 %) |
| Auslisten | wie Auslaufen, plus VK ≤ 5,99 € oder Abschlag ausgeschöpft, plus über 730 Tage | höchstens 118 (7 %) |

Streichkandidaten höchstens 13 % des Sortiments, Liste auf die 50 schlechtesten je Durchgang begrenzen. Karten ab 20 €: 730 Tage, und statt „Auslisten“ „Preis senken oder anders verkaufen“.
Sortierung: Jahreswert = Gewinn je Stück × erwartete Stück/Jahr − 8 % × (Bestand × EK) − 0,50 € Pflege (0,50 € ist eine Annahme von Chris zu setzen). Auslisten spart bei gleicher Shopstufe kein Geld, nur Ordnerplatz und Pflege.
`reorder.ts` ergänzen: kein Nachkauf über 25 € Marktwert; Nachkauf nur bei ≥ 25 % Marge beim Nachkauf (15 % ab 6 Verkäufen/Jahr); bei fallendem Markt (−10 %) Bestellmenge halbieren; Status „Auslaufen“ sperrt den Nachkauf.

## 4. Fallstricke

| Fallstrick | Test |
|---|---|
| Ausverkauft-Zeiten verfälschen das Tempo | Tempo je Tag mit Bestand (aus `StockMovement`) gegen Kalendertempo |
| Preisänderung als Ursache | Uhr bei jeder Änderung ab 10 % zurücksetzen; Vorher/Nachher in gleichen Fenstern |
| Kleine Zahlen (66 % mit 0 Verkäufen im Jahr) | Wiederverkaufsquote; Fristen so, dass höchstens 15 % der Ausgelisteten im Folgejahr verkauft hätten |
| Preisführer ohne Sprach-/Zustands-/Auflagenfilter („ab“ oft bespielte englische Karte) | 50 Artikel von Hand gegen gefiltertes Angebot, Abweichung je Preisband |
| Reprints, Bannliste, Saison | Tempo gegen shopweiten Monatsindex normieren; Alarm bei Ø7/Ø30 < −20 % |

Nebenbefunde: Marktdeckel zwischen 35 und 40 € ist nicht monoton; nie verkaufte Artikel bekommen nie einen Ladenhüter-Abschlag (`daysSinceSale` null).

## 5. Was als Erstes zu bauen wäre

1. Daten sichern: Marktpreise bei jedem Abruf anhängen statt löschen; je Artikel „zuerst gesehen“; Uhr „Tage am aktuellen Preis ohne Verkauf“ aus `Sale` und `PriceChange`.
2. Auswertungsskript (nur Bericht): realisierter Aufschlag je Preisband und Wiederverkaufsquote aus der vollen `Sale`-Historie.
3. Statusregel aus Abschnitt 3 statt `lifecycle.ts` (mit Schutzstatus und Begrenzung auf 50 Kandidaten), danach der dynamische VK als zweite Spalte „Empfohlen (dynamisch)“, 4 Wochen im Parallelbetrieb.
