# Finanzen: woher kommt das Geld, wohin geht es (22.11.)

Chris, 22.11.: „genauso noch mal im finanzbereich überlegen, für was wird noch geld ausgegeben und eingenommen. Mal random
dazu aus meinem FM27 spielstand vllt hilfts und du hast ideen die man zu nem mockup machen kann“.

Dieses Papier ist Konzept und Mockup, kein App-Code. Es nimmt auf, welche Geldflüsse es heute gibt (a), schlägt neue vor (b),
rechnet ihre Wirkung auf die Balance (c) und stellt fünf Fragen (d). Das Mockup ist ein neuer Reiter „Aufschlüsselung“ in
`public/mockups/finanzen-modern-18-11.html` (`?ansicht=posten`), Abschnitt (e).

> **Stand nach Runde 2 (Chris, 22.11.):** Disziplin-Krone gestrichen, dafür Farb-Meister. Dauerkarten mit 25 % Rabatt.
> Mehr Geld je Besucher, Arena-Ausbau hängt an der Auslastung. Versicherung als Erstattung gegen Pauschale. Trainingslager
> in der Winterpause. Kredite ab Saison 1. Alles dazu steht in **Abschnitt (f)**; wo (b) und (f) sich widersprechen, gilt (f).
> Die Balance-Tabelle in (c) ist auf diesen Stand gebracht.

**Kurzfassung** (Runde 1)

- Heute bucht das Spiel 19 Arten von Geldfluss. 96 % der Einnahmen kommen vom Sponsor. Von der FM-Liste gibt es bei uns schon
  Prämien (Siegprämie an den Kader), Loyalitätsboni (Treueprämie), Zinsen (Kredite zwischen Teams), Steuern (Apron),
  Spielerverkäufe und Kreditrückzahlungen. Es fehlen Kartenverkauf, Fanartikel je Star, Preisgelder und Reisekosten; die
  stehen alle schon im Finanzkonzept V2 (Stufe 5), sind aber nicht gebaut.
- Neu schlage ich sieben Posten vor. Drei davon empfehle ich zum Bau: **Dauerkarten**, **Disziplin-Krone** und
  **Verletzungs-Versicherung**. Drei kommen später mit ihrem Baustein (Topspiel-Geld, Winterpause, Zielprämie). Sechs Ideen
  verwerfe ich, darunter Guthabenzins und eine Liga-Umlage.
- Jeder neue Posten nennt seinen Gegenposten. Netto bewegen die sieben Posten rund −0,65 C je Team und Saison, das sind
  unter 1 % der Gehälter. Die Kalibrierung des Finanzkonzepts V2 (Σ GuV der Liga = 0 bei Faktor 1,0) bleibt stehen.
- Kein Posten braucht mehr als eine Entscheidung je Saison. Personal, Geldstrafen und ein Gehaltsdeckel kommen nicht vor.

---

## (a) IST: jeder Geldfluss im Code

Topf: **T** = Transfer- und Investitionstopf (hart gegen die Vorstands-Freigabe), **G** = Gehaltstopf (höchstens auf 75 %
gekürzt), **L** = läuft direkt über die Kasse und gehört zu keinem Topf. Größenordnung je Team und Saison aus
`docs/design/finanzen-ist-messung-18-11.md` und dem Gebäudekatalog.

### Einnahmen

| Posten | Topf | Quelle im Code | Wann gebucht | Größenordnung |
|---|:--:|---|---|---|
| Sponsor, Saisonbasis (Sockel) | L | `lib/finance/finanzen-je-spieltag-buchung.ts:49` (`bucheSpieltagFinanzen`), Betrag aus `lib/sponsor/sponsor-settlement-service.ts:115` (`sponsorBasisJahr`) | je Spieltag, 1/N | Sponsor gesamt Median 64 C (Liga 1 um 78, Liga 2 um 55) |
| Sponsor, Rangprämie | L | `sponsor-settlement-service.ts:140` (`sponsorRangAbschlag`), Schlussausgleich in `:189` (`applySponsorSettlement`) | Abschlag je Spieltag (80 %), Rest am Saisonende | in der Zeile darüber enthalten |
| Sponsor, Sonderziel | L | `sponsor-settlement-service.ts:189`, Zeile `special` aus `lib/sponsor/sponsor-v3-offer-service.ts` | Saisonende | 0 bis rund 3 C |
| Sponsor-Ereignisse (Bonus, Klausel, Reibung) | L | `lib/sponsor/sponsor-event-service.ts:29` (`maybeGenerateSponsorEvents`), `:112` | je Ereignis, beim Spieltagswechsel | ±9 C über die Saison |
| Sponsor-Vorschuss (nur Altverträge) | L | `sponsorPayoutLogs`, gelesen in `lib/finance/kontoauszug.ts:121` | bei Unterschrift | selten |
| Gebäude-Einnahme Fan Shop | L | Katalog `lib/facilities/facility-catalog.ts:166`, Rechnung `lib/facilities/facility-season-end-service.ts:172`, Buchung `finanzen-je-spieltag-buchung.ts:49` | je Spieltag, 1/N | 3,9 bis 25 C nach Stufe |
| Gebäude-Einnahme Arena (× Beliebtheit, × Liga-Faktor) | L | Katalog `facility-catalog.ts:186`, Faktor `facility-season-end-service.ts:103` | je Spieltag, 1/N | 2,4 bis 28,5 C nach Stufe |
| Vorstandsziele (Prämie; Wette „Alles auf eine Karte“ +3 C) | L | `lib/board/team-season-objectives-service.ts:2788` (`applyTeamSeasonObjectiveRewards`) | Saisonende | rund 3 C, 4 % der Einnahmen |
| Apron-Ausgleich | L | `lib/season/apron-settlement-service.ts:304` (`applyApronSettlement`) | Saisonende | Liga 8 bis 19 C, Nullsumme |
| Spielerverkauf (Ablöse) | T | `transferHistory`, gelesen in `kontoauszug.ts:84`; Quote in `lib/finance/vorstand-budgetfreigabe.ts:334` | sofort | einzelne Spieler 5 bis 30 C |
| Vertragsende (ablösefreier Verkauf, Ablöse an den Klub) | T | `lib/contracts/contract-renewal-service.ts:1020` (`contract_exit`) | Saisonwechsel | Liga 1244 bis 1796 C je Wechsel |
| Kredit: Aufnahme | T | `lib/finance/loan-service.ts:514` (`originateLoan`) | sofort, ab Saison 2 | nach Kreditrahmen |
| Kredit: Zins und Tilgung von Schuldner-Teams | L | `loan-service.ts:392` (`buildLoanOffers`), `:811` (`applyLoanSettlement`) | Saisonende | 5 bis 12 % Zins je Saison |
| Notkredit, Notfall-Kasse der KI | L | `loan-service.ts:953` (`applyInsolvencyBackstop`), `lib/ai/ai-market-plan-convergence-service.ts:429` | Saisonende bzw. Kaufphase | Ausnahme |
| Preisgeld | – | `lib/season/cash-prize-benchmark-flag.ts:13`: `CASH_PRIZE_BENCHMARK_ONLY = true`, bewegt nie Kasse | nie | 0 |

### Ausgaben

| Posten | Topf | Quelle im Code | Wann gebucht | Größenordnung |
|---|:--:|---|---|---|
| Spielergehälter | G | `lib/finance/finanzen-je-spieltag.ts:187` (`kaderJahresgehaltAmSpieltag`), Buchung `finanzen-je-spieltag-buchung.ts:49` | je Spieltag, 1/N | Median 64 C (3,2 C je Spieltag) |
| Siegprämie an den Kader | G | `lib/finance/vorstand-praemien.ts:190` (`bucheSiegpraemien`), Stufen `:26` | je Spieltag, bei Siegen | 0,01 oder 0,02 C je Sieg und eingesetztem Spieler, rund 1 bis 3 C |
| Treueprämie | G | `vorstand-praemien.ts:257` (`bucheTreuepraemie`), Stufen `:32` | sofort bei Verlängerung | 5 oder 10 % des neuen Jahresgehalts |
| Gehaltserhöhung bei Verlängerung | G | `lib/contracts/contract-renewal-service.ts:2206`, Sperre `vorstand-budgetfreigabe.ts:701` | ab dem nächsten Spieltag | je Spieler |
| Abfindung bei Vertragsauflösung | G | `lib/market/contract-negotiation-preview.ts:551` (`calculateOpenBuyoutCost`) | sofort | offenes Restgehalt |
| Spielerkauf (Ablöse) | T | `transferHistory`, Sperre `vorstand-budgetfreigabe.ts:654` (`pruefeKaufGegenVorstandFreigabe`) | sofort | Startbudget 170 bis 325 C, zu 97 % in Spielern |
| Gebäude: Bau und Ausbau | T | `lib/facilities/facility-upgrade-service.ts:308`, Sperre `vorstand-budgetfreigabe.ts:679` | sofort | 5 bis 72 C je Stufe |
| Gebäude: Wartung | T | `lib/facilities/facility-maintenance-service.ts:126` | sofort | unter 2 C |
| Gebäude: Unterhalt | L | `facility-season-end-service.ts:172`, Buchung `finanzen-je-spieltag-buchung.ts:49` | je Spieltag, 1/N | 0,4 bis 5,4 C je Gebäude |
| Kredit: Zins (GuV) und Tilgung (Bilanz) | L | `loan-service.ts:811`, vorzeitige Ablösung `:1068` | Saisonende | Annuität |
| Apron-Abgabe | L | `apron-settlement-service.ts:304` | Saisonende | nur über Linie 1 |
| Sponsor-Ereignis mit Abzug | L | `sponsor-event-service.ts:29` | je Ereignis | bis −2 C |

Vorgemerkt, aber nicht gebaut: Tickets, Merch je Star, Siegprämie der Liga, Arena-Betrieb, Reise, Überziehungszins,
Liga-Topf, Pflichtkredit (alle `docs/design/finanzkonzept-v2-18-11.md`, Stufen 5 bis 7); Ärmel- und Disziplin-Sponsoren
(dort Frage 10); Reparatur, Händler, Schmiede, Handelsposten, Verkauf von Ausrüstung, Verpflegung
(`docs/design/zwischen-den-spieltagen-22-11.md` §32, §38, §67, §71, §77). Der Getränke-Partner kostet und zahlt nichts,
Kisten und Ruhm sind kein Geld.

### Abgleich mit der FM-Liste

| FM27 | Bei uns |
|---|---|
| Fanartikel | heute Fan Shop (flach); geplant Merch je Star × Stimmung |
| Kartenverkauf | heute Arena-Gebäude (× Beliebtheit); geplant Tageskarten je Heimspiel |
| Dauerkarten | **fehlt, Vorschlag N1** |
| TV-Einnahmen | fehlt; geplant ist die Siegprämie der Liga als Ersatz. **Vorschlag N4** für ein kleines Topspiel-Geld |
| Preisgelder | abgeschaltet (nur Benchmark); geplant Siegprämie je Duell. **Vorschlag N2** Disziplin-Krone |
| Zuschüsse | fehlt; geplant ist die Ausschüttung des Liga-Topfs. Aufbauhilfe siehe S2 |
| Zinsen | gebaut: Zinsen aus Krediten an andere Teams. Guthabenzins verworfen (V1) |
| Spielerverkäufe, Investitionen | gebaut |
| Spielergehälter, Kreditrückzahlungen | gebaut |
| Prämien, Loyalitätsboni | gebaut: Siegprämie an den Kader, Treueprämie |
| Steuern | gebaut als Apron (Abgabe auf Gehaltsüberhang) |
| Reisekosten, Außerbetriebliches | geplant: Reise je Auswärtsspiel, Arena-Betrieb je Heimspiel |
| Mitarbeitergehälter | bewusst nicht (Chris: „Personal erstmal nicht“) |
| „Scoutingbudget anpassen“ | kein Geldposten; Scouting läuft über das Gebäude Scouting Office. Frage 5 |

---

## (b) SOLL: Vorschläge

Bezugsgrößen: Spielergehalt 6 bis 7 C je Saison, Kader rund 14, Gehälter 70 bis 90 C, Reparatur voll 19 C. Beispielzahlen
für ein Team der Liga 2.

### Empfohlen: umsetzen (Runde 1; N1 bis N3 und N5 sind durch Abschnitt (f) ersetzt)

| # | Posten | Regel | Entscheidung des Managers | je Saison | Mikromanagement | Gegenposten |
|---|---|---|---|---:|---|---|
| **N1** | **Dauerkarten** (Einnahme, L) | Vor Spieltag 1 wird ein Anteil der Plätze für alle 10 Heimspiele verkauft, 10 % unter dem Richtpreis. Das Geld kommt sofort und hängt nicht an der Stimmung. | Einmal je Saison: wenig (20 %), normal (40 %), viel (60 %). Viel ist sicheres Geld schon in der Kaufphase. Wenig lässt Platz für volle Tageskassen, wenn die Saison gut läuft. | +2,6 / +5,2 / +7,8 C | eine Wahl je Saison | Tageskarten sinken um den verkauften Anteil. Netto +0,6 C in einer schwachen, rund −1 C in einer starken Saison |
| **N2** | **Disziplin-Krone** (Einnahme, L) | Das beste Team jeder der 20 Disziplin-Tabellen einer Liga bekommt am Saisonende 1,0 C (Liga 1) bzw. 0,6 C (Liga 2). | Keine eigene. Sie macht aber den Kaderbau interessanter: zuspitzen oder breit bauen. Ein Mittelfeld-Team mit zwei starken Disziplinen holt Geld und einen Titel. Das passt zur Leitlinie „mehrere Wege zum Erfolg“. | 0 bis 3 C, Liga 20 bzw. 12 C | keins | aus dem Rangprämien-Topf des Sponsors geschnitten (1,6 % davon) |
| **N3** | **Verletzungs-Versicherung** (Prämie G, Leistung G) | Prämie 3 % der Gehaltssumme des versicherten Kreises, je Spieltag. Ab dem zweiten Ausfall-Spieltag zahlt sie das Gehalt des Verletzten. | Einmal je Saison: keine, die besten 6, ganzer Kader. Ein Recovery Center verkürzt Ausfälle und macht sie weniger nötig. | −1,2 bzw. −2,0 C Prämie, Leistung im Mittel 85 % davon | eine Wahl je Saison | Überschuss (15 %) geht in den Liga-Topf |

Begründung:

- **N1** ist der einzige neue Posten, der Geld in der Zeit verschiebt. Seit „Finanzen je Spieltag“ rutschen Teams mit
  kleinem Sockel mitten in der Saison ins Minus (4 von 32 nach dem Rang-Abschlag). Dauerkarten geben genau diesen Teams
  eine Antwort, die eine Abwägung ist und kein Geschenk. Sie setzen die Tageskarten voraus (V2, Stufe 5).
- **N2** kostet fast nichts und nutzt Tabellen, die es schon gibt. Die Größe ist bewusst klein: ein halbes bis ein
  Zehntel eines Spielergehalts je Krone. Sie soll auffallen, aber keinen Rang kaufen.
- **N3** hängt an einer festen Regel: verletzt heißt nicht einsetzbar, das Gehalt läuft weiter. Bisher ist das reines
  Pech. Mit der Versicherung wird daraus eine Wahl mit Preis. Der Satz von 3 % ist geschätzt; vor dem Bau müssen die
  Ausfalltage je Team und Saison gemessen werden (`scripts/miss-teamfinanzen-saison.ts` um Verletzungstage erweitern).

### Später, mit ihrem Baustein

| # | Posten | Regel | Entscheidung | je Saison | Warum später |
|---|---|---|---|---:|---|
| **N4** | Übertragungsgeld Topspiel (Einnahme, L) | Je Spieltag hat jede Liga ein Topspiel (Derby, Erzfeind, Tabellennachbarn). Beide Teams bekommen 0,3 C. | keine | 0,6 bis 1,2 C | braucht die Sendung nach dem Spiel und die Rivalitäten (Rahmenkonzept §8, B9). Summenneutral aus der Siegprämie der Liga |
| **N5** | Winterpause: Schaukampf, Trainingslager oder Ruhe | Schaukampf bringt 1,0 C + 0,8 C × Beliebtheit und belastet die besten 6. Trainingslager kostet 2,0 C aus dem Investitionstopf und gibt Trainingspunkte. Ruhe gibt Erholung. | eine Wahl je Saison, drei Wege | +1,0 bis +2,6 C oder −2,0 C | braucht den Status Winterpause (Rahmenkonzept §15.2). Über die Liga etwa ausgeglichen |
| **N6** | Zielprämie an den Kader (Ausgabe, G) | Vor der Saison versprochen: 2 % der Gehaltssumme, fällig nur, wenn das wichtigste Vorstandsziel erfüllt ist. Das Versprechen hebt die Moral leicht. | versprechen oder nicht | 0 oder −1,3 bis −1,8 C | braucht Kabine und Moral (B18). Wird nur fällig, wenn auch die Vorstandsprämie fließt |
| **S1** | Weiterverkaufs-Beteiligung | Wer einen Spieler ausgebildet hat, bekommt 10 % der nächsten Ablöse. | keine | selten, 0,5 bis 3 C | braucht Nachwuchs und Abgang (B12) |
| **S2** | Aufbauhilfe und Fallschirm | Aufsteiger und Absteiger bekommen eine Saison lang einen Zuschuss aus dem Liga-Topf. | keine | 3 bis 8 C | braucht Auf- und Abstieg und den Liga-Topf (V2, Stufe 6) |

### Verworfen

| # | Idee | Grund |
|---|---|---|
| V1 | Zinsen auf Guthaben | Erzeugt Geld aus dem Nichts und belohnt Liegenlassen. Wer Geld arbeiten lassen will, verleiht es schon heute an andere Teams. |
| V2 | Liga-Umlage oder Steuer auf Einnahmen | Der Apron ist die Abgabe der Liga, der Liga-Topf (V2) sammelt Abschläge und Zinsen. Eine dritte Abgabe wäre nur eine Zahl mehr. |
| V3 | Reisekosten nach Entfernung | Es gibt keine Landkarte. Die feste Reise-Pauschale aus V2 reicht und braucht keine Entscheidung. |
| V4 | Handgeld bei Verpflichtung | Ist eine höhere Ablöse mit anderem Namen. Die Treueprämie deckt den Fall „Geld für Bindung“. |
| V5 | Mitgliedsbeiträge der Fans | Doppelt zu Dauerkarten und Merch. |
| V6 | Personal, Geldstrafen, Gehaltsdeckel | Feste Vorgaben von Chris. |

### Mehrspieler, Delegation, KI

Alle Wahlen (Dauerkarten-Stufe, Versicherung, später Winterpause und Zielprämie) liegen je Team im Spielstand, werden zum
Saisonstart einmal gestellt und sind delegierbar: Dauerkarten und Winterpause im Bereich Sponsor, Versicherung und
Zielprämie im Bereich Käufe/Verträge. Die KI nutzt dieselbe Tabelle für KI-Teams und delegierte Teams (Finanzwert,
erwarteter Rang, Kadergröße, Charakter aus `kiCharakter`). Die delegierte KI füllt nur, was der Mensch nicht gesetzt hat.
Fehlt eine Wahl zum ersten Spieltag, gilt „normal“ bzw. „keine“; kein Spieltag wartet. Ligaweite Größen (Krone,
Topspiel-Satz, Versicherungssatz) sind für alle 32 Teams gleich. Befristete Liga-Lagen dürfen sie wie die
Sponsor-Auszahlung für wenige Spieltage verschieben, nie dauerhaft.

---

## (c) Wirkung auf die Balance

Maßstab ist die Geldmengen-Bilanz des Finanzkonzepts V2 (Abschnitt 3.1): Σ GuV über 32 Teams = 0 bei Saison-Faktor 1,0,
Gehälter Σ 1838 C. Grundsatz für alles Neue: **jeder Posten nennt, woraus er bezahlt wird.** Einnahmen werden aus einem
bestehenden Topf geschnitten, Ausgaben fließen in den Liga-Topf und kommen zur nächsten Kaufphase zurück.

Stand nach Runde 2. Liga-Mittel je Team und Saison; Regeln und Herleitung in Abschnitt (f).

| Posten | Stand | brutto je Team | Gegenposten je Team | netto je Team | Σ Liga (32 Teams) |
|---|---|---:|---:|---:|---:|
| Dauerkarten, normal, Rabatt 25 % | entschieden | +5,3 | −5,2 Tageskarten (Auslastung 73 %) | +0,1 (von +1,1 bei 60 % bis −1,1 bei 90 %) | um +4 |
| Mehr Geld je Besucher (+25 %) | Vorschlag | +2,6 | −2,6 Sponsor (Ausschüttung 0,73 → 0,69) | 0 | 0 (83 C umgewidmet) |
| Arena: Plätze statt fester Einnahme | Vorschlag | wie heute | – | um 0, zu messen | um 0 |
| Farb-Meister | entschieden | +0,8 im Mittel | −0,8 Rangprämie | 0 | 0 (26 C umgewidmet) |
| Versicherung (Erstattung) | entschieden | −0,6 Pauschale, +0,3 Erstattung | Überschuss in den Liga-Topf | −0,3 | −9 in der GuV, +9 im Liga-Topf |
| Trainingslager | entschieden | −1,2 (vier von fünf Teams, Mittel 1,5 C) | in den Liga-Topf | −1,2 | −38 in der GuV, +38 im Liga-Topf |
| Kredite ab Saison 1 | entschieden | nur der Zins zählt zur GuV | Zins an den Geber oder in den Liga-Topf | −0,15 | um −5 |
| **Summe, angenommene Posten** | | | | **rund −1,5** | **rund −48 C, 2,6 % der Gehälter** |
| Topspiel-Geld (N4), Zielprämie (N6) | offen, wie Runde 1 | +0,9 / −1,5 bei Erfolg | −0,9 / – | 0 / −0,6 | 0 / −20 |

Die −48 C sind kein Verlust der Liga: Versicherungs-Überschuss, Lagerkosten und Bankzins fließen in den Liga-Topf und kommen
zur nächsten Kaufphase als Saisonstart-Budget zurück (Finanzkonzept V2, Stufe 6). Mit Liga-Topf ist die Summe 0. Wird der
Liga-Topf später gebaut als diese Posten, liegt die Abweichung über der Abnahme von ±30 C; dann entweder die Lagerpreise
halbieren oder die Sponsor-Ausschüttung um 0,02 heben. Runde 1 kam auf −0,65 C je Team; der Unterschied ist das
Trainingslager, das jetzt eine reine Ausgabe ist (der Schaukampf als Einnahme entfällt).

Das Mockup zeigt für sein Beispielteam −2,26 C („Neue Posten netto“). Das Team hat eine gute Saison (Auslastung 86 %), darum
kosten die Dauerkarten 0,6 C, und es hat Lager, Versicherung und Zielprämie gewählt.

Was sich verschiebt, ohne dass die Summe sich ändert:

- **Zeit.** Dauerkarten bringen 4 bis 5 C vor Spieltag 1, ein Kredit in Saison 1 bis zum Rahmen. Das hebt den Tiefststand der Kasse mitten in der Saison und
  kann in der Kaufphase einen halben Spieler mehr bezahlen. Der Betrag läuft über die Kasse und unterliegt damit der
  Vorstands-Freigabe wie jedes andere Guthaben.
- **Verteilung.** Der Farb-Meister nimmt allen etwas Rangprämie (1,25 %) und gibt sie den vier Farbbesten je Liga. Der
  Lauf muss zeigen, wie oft der Tabellenführer mehr als zwei Farben holt.
- **Risiko.** Die Versicherung glättet. Teams mit langen Ausfällen verlieren weniger, alle anderen zahlen wenig.

Messplan vor dem Bau: zwei Saaten mit `scripts/miss-teamfinanzen-saison.ts`, 32 KI-Teams von Anfang an; Abnahme Σ GuV
±30 C gegen den Lauf ohne die Posten, Kader und Käufe der KI in höchstens zwei Teams anders, Wertungs-Fingerabdruck
unverändert (kein Posten berührt die Arena).

Eine zweite Zahl gehört in dieselbe Rechnung, obwohl sie nicht von mir stammt: die schon geplanten Ausgaben für
Ausrüstung (Reparatur typisch 6,7 C, voll 19 C, dazu Händler) und Verpflegung (3,5 C) sind zusammen 10 bis 25 C je Team
und Saison, also 15 bis 30 % der Gehälter. Ihnen steht bisher nur der Verkauf von Ausrüstung gegenüber. Das ist die
eigentliche offene Balance-Frage (Frage 4).

---

## (d) Offene Fragen an Chris

| # | Frage | Empfehlung |
|---:|---|---|
| 1 | Reiter „Aufschlüsselung“ so bauen (Einnahmen links, Ausgaben rechts, Verlauf darüber, Posten antippen zeigt Regel und Entscheidung)? | **Ja**, als siebter Reiter der Finanzseite. Er liest nur den Kontoauszug, braucht keine neue Buchung und kann vor allen neuen Posten gebaut werden. |
| 2 | Dauerkarten, Disziplin-Krone und Versicherung bauen? | **Ja, in dieser Reihenfolge**: Krone sofort (hängt an nichts), Dauerkarten mit den Tageskarten (V2, Stufe 5), Versicherung nach der Messung der Ausfalltage. |
| 3 | Soll die Disziplin-Krone aus dem Rangprämien-Topf kommen (summenneutral) oder obendrauf (Liga +32 C je Saison)? | **Aus dem Topf.** Obendrauf wäre einfacher zu bauen, lässt die Geldmenge aber jede Saison wachsen. |
| 4 | Ausrüstung und Verpflegung kosten zusammen 10 bis 25 C je Team und Saison. Sollen die Sponsor-Auszahlungen dafür steigen, oder ist das ein gewollter Abfluss? | **Gewollter Abfluss in den Liga-Topf**, der zur nächsten Kaufphase zurückkommt. So bleibt die Geldmenge gleich und reiche Teams kaufen sich Stärke nicht doppelt. Ohne Liga-Topf wäre es ein echter Verlust von bis zu 30 % der Gehälter. |
| 5 | Ein Scouting-Budget wie im FM (Geld je Saison für Berichte), oder bleibt Scouting am Gebäude? | **Bleibt am Gebäude.** Ein zweiter Regler für dasselbe Ziel wäre Mikromanagement. Falls doch: drei Stufen aus dem Investitionstopf, einmal je Saison. |

---

## (e) Das Mockup

`public/mockups/finanzen-modern-18-11.html?ansicht=posten` (weitere Schalter: `&per=bisher|saison`, `&fil=alle|ist|plan|neu`,
`&psel=<posten>`, `&ctab=quelle`). Stil, Tokens (`--haus`, `--zahl`), lokale Schriften und Bausteine des bestehenden
Mockups; kein PixelLab, alles CSS und SVG.

- **Kennzahlen:** Einnahmen, Ausgaben, Saldo, Sponsor-Anteil, „Neue Posten netto“ (mit Gegenposten).
- **Verlauf (SVG):** Einnahmen und Ausgaben aufsummiert über die Saison, gebucht durchgezogen, Prognose gestrichelt,
  Einnahmen der Vorsaison gepunktet. Darunter der gewählte Posten je Spieltag. Ein Klick auf einen Spieltag öffnet seine
  Abrechnung.
- **Zwei Tabellen:** Posten, Topf (Transfer, Gehalt, Laufend), Summe (groß), Anteil, letzter Spieltag mit Trendpfeil
  (klein), Rang in der Liga. Jede Spalte sortiert. Rang 1 ist der beste: bei Einnahmen der höchste Betrag, bei Ausgaben
  der niedrigste. Die Summenzeile zeigt die Saisonsumme groß und den Wert je Spieltag klein.
- **Marken:** ohne Marke = heute im Code (17 Posten), GEPLANT = Konzept liegt vor (12), NEU = Vorschlag von heute (7). Der
  Filter oben zeigt jede Gruppe allein.
- **Kontext „Quelle“:** je Posten Topf, Buchungszeitpunkt, Rechnung, Entscheidung, KI-Regel, Gegenposten und Codequelle.
- **Knöpfe unten** wie im FM: Budgets anpassen, Anfrage an Vorstand (beide führen in den Reiter Budgets), Kontoauszug.

**Ehrlich gekennzeichnet:** alle Beträge sind erfunden. Posten mit gefüllter Farbmarke kommen aus dem Rechenmodell des
Mockups und stehen in dessen Kasse und Kontoauszug. Posten mit hohler Marke (Gebäude, Ausrüstung, Treueprämie, Zinsen und
alle neuen) sind Beispielzahlen nur für diesen Reiter; darum weicht der Saldo hier von der Kassen-Prognose der Übersicht
ab. Die Ränge sind erfunden. Die Rangprämie zeigt das Mockup noch als einen Betrag am Saisonende; im Spiel läuft sie seit
22.11. als Abschlag je Spieltag.

Aufnahmen (Chromium, unter `flock /tmp/oly-aufnahme.lock`), `docs/design/finanzen-posten-22-11/`:

| Datei | Zeigt |
|---|---|
| `aufschluesselung-2560x1440.png`, `-1920x1080.png`, `-1710x1112.png` | Grundansicht, bisher, alle 36 Posten |
| `saison-dauerkarten-2560x1440.png` | ganze Saison, Dauerkarten gewählt, Kontext Quelle |
| `saison-versicherung-1920x1080.png` | ganze Saison, Versicherungsprämie gewählt |
| `nur-neu-1920x1080.png` | Filter „Neu“, Disziplin-Krone gewählt |
| `uebersicht-unveraendert-1920x1080.png` | Reiter Übersicht, zur Kontrolle unverändert |
| `phone-412x900.png` | Nebenprobe Phone |

Geprüft: keine JS-Fehler in allen acht Aufnahmen und im Klicktest (sortieren, Zeitraum, Filter, Zeile, Reiterwechsel);
kein Seitenscroll bei 2560×1440, 1920×1080 und 1710×1112; alle 19 und 17 Zeilen ohne inneres Scrollen sichtbar; keine
abgeschnittenen Posten-Namen, Köpfe oder Beträge. Unter 2100 px Breite fällt der Anteilsbalken weg (die Prozentzahl
bleibt), unter 1500 px die Spalten Anteil und Rang. Auf dem Phone ist ein Name gekürzt („Ausrüstung · Händler, Schmiede“).

---

## (f) Runde 2: Entscheidungen von Chris 22.11.

Chris, 22.11., wörtlich: „diszi krone nicht, aber das beste team in POW SPE MEN SOC am season ende könnte noch einen bonus
erhalten / dauerkarten klingt gut, 10% sind aber zu wenig rabatt glaube ich / vllt müsste es mehr cash geben für die besucher
und der arena ausbau den wir als gebäude haben sollte direkt damit verknüpft sein dass man dann ausbaut wenn man das fan max
erreicht hat um noch mehr fans rein zu bekommen etc / Verletzungsversicherung könnte man dann wirklich einführen wo man
erstattungen bekommt wenn spieler ausfallen für ne pauschale / Trainingslager möglichkeit für winterpause finde ich gut, wenn
man ausgeruht genug ist oder ambitioniert dass man seine leute entweder hin schickt für mehr training, besserer fitness,
moral oder bessere reha wären doch alles möglichkeiten oder temporäre boosts für die nächste(n) diszi(s) / und zur not gibts
ja auch kredite … geben wir kredite auch ab S1 frei!“

Alle Zahlen sind Startwerte für den Messlauf. Beispielwerte gelten für ein Team der Liga 2 (Gehaltssumme 68 C, 14 Spieler).

### f.1 Farb-Meister statt Disziplin-Krone

Die Disziplin-Krone (N2) ist gestrichen. Neu: Am Saisonende bekommt in jeder Liga das beste Team je Disziplinfarbe einen
Bonus.

- **Zuordnung im Code:** jede Disziplin trägt ihre Farbe im Feld `category`, `lib/data/dataAdapter.ts:59` bis `:78`
  (Typ `DisciplineCategory`, `lib/data/olyDataTypes.ts:13`). Es sind genau fünf je Farbe: Power = Mini DM, TDM,
  Gewichtheben, Hockey, Breaking. Speed = Time Trial, Spurt, Staffel, Climbing, Fechten. Mental = Tennis, Wettessen,
  Schach, Takeshi, I Spy. Social = Showcase, Basketball, Battlefield, Football, Eiskunst.
- **Wertung:** Summe der Ergebnispunkte des Teams (E1, 0 bis 10 je Begegnung) aus den fünf Disziplinen der Farbe. Bei 20
  Spieltagen mit je zwei Disziplinen sind das zehn Begegnungen je Farbe und Team. Gleichstand teilt den Bonus.
- **Höhe:** 4,0 C in Liga 1, 2,5 C in Liga 2. Das sind rund 5 % der Sponsor-Einnahme eines Teams (Median 78 bzw. 55 C) und
  gut ein halbes Spielergehalt: spürbar, aber kein Rang lässt sich damit kaufen. Liga-Summe 4 × 4,0 + 4 × 2,5 = 26 C je
  Saison (die Krone lag bei 32 C).
- **Gegenposten, Empfehlung: aus dem Rangprämien-Topf.** 26 C sind 1,25 % der Sponsor-Auszahlung der Liga (2089 C heute);
  jede Rangprämie sinkt um diesen Anteil, im Mittel 0,8 C je Team. Obendrauf wäre einfacher, lässt die Geldmenge aber jede
  Saison um 26 C wachsen.
- **Risiko:** Ein überlegenes Team könnte alle vier Farben holen (16 C in Liga 1, ein Fünftel seiner Einnahmen). Der Messlauf
  zählt, wie oft der Tabellenerste mehr als zwei Farben gewinnt. Liegt das über einem Viertel der Saisons, zahlt der Bonus
  je Team höchstens zweimal und die übrigen Farben gehen an den Zweiten.
- **KI:** Liegt ein Team zur Winterpause in einer Farbe unter den ersten drei, gewichtet es Kauf und Training dieser Farbe
  leicht höher. Für alle 32 Teams dieselbe Regel.

### f.2 Dauerkarten: Rabatt 25 %

Regel wie N1, aber mit **25 % Rabatt** statt 10 %. Wahl weiter einmal je Saison vor Spieltag 1: wenig (20 % der Plätze),
normal (40 %), viel (60 %).

Begründung der Zahl: Eine Dauerkarte ersetzt einen Platz, der an der Tageskasse nur mit der Wahrscheinlichkeit der
Auslastung verkauft worden wäre. Netto = Anteil × volles Haus × 10 × (1 − Rabatt − Auslastung). Der Gleichstand liegt also
bei Auslastung = 1 − Rabatt.

| Rabatt | Gleichstand bei Auslastung | entspricht Stimmung | Folge |
|---:|---:|---:|---|
| 10 % (Runde 1) | 90 % | 71 | lohnt sich fast immer, keine echte Wahl und für die Fans kein Angebot |
| 20 % | 80 % | 59 | lohnt sich für die untere Hälfte der Liga |
| **25 %** | **75 %** | **53** | Gleichstand nahe am Liga-Mittel (Stimmung 50, Auslastung 73 %): eine echte Wette auf die eigene Saison |
| 30 % | 70 % | 47 | lohnt sich nur noch für schwache Teams |

Beispiel (volles Haus 1,45 C): wenig 2,18 C, normal 4,35 C, viel 6,53 C sofort. Bei 86 % Auslastung kostet „normal“ netto
0,6 C, bei 60 % bringt es 0,9 C. Der zweite Wert bleibt: Das Geld ist schon in der Kaufphase da.

KI: erwartete Auslastung unter 70 % → viel, über 80 % → wenig, sonst normal; Kasse unter zwei Gehaltsraten → eine Stufe
höher.

### f.3 Mehr Geld je Besucher, Arena-Ausbau hängt an der Auslastung

**Befund heute:** Besucher bringen fast nichts. Ohne Arena-Gebäude ist die Einnahme 0. Mit Stufe 1 sind es 2,4 C je Saison
× Beliebtheit (0,5 bis 1,5) bei 0,8 C Unterhalt (`lib/facilities/facility-catalog.ts:186`, Rechnung
`lib/facilities/facility-season-end-service.ts:172`), also rund 3 % der Einnahmen. Die Stufen amortisieren sich nach acht
Saisons. 96 % der Einnahmen kommen vom Sponsor. Das Finanzkonzept V2 (Stufe 5) hebt die Tickets auf 331 C in der Liga, 16 %
der Einnahmen; die Gebäude-Einnahme bleibt dort ein fester Katalogwert, der mit Plätzen nichts zu tun hat.

**Vorschlag, zwei Teile:**

1. **Preis je Besucher + 25 %.** 0,18 C je 1.000 Besucher in Liga 2, 0,265 C in Liga 1. Volles Haus der Grundarena (8.000
   Plätze): 1,44 statt 1,15 C bzw. 2,12 statt 1,70 C. Tickets der Liga 414 statt 331 C. Gegenposten: Sponsor-Ausschüttung
   0,73 → 0,69. Mehr geht nicht, ohne die Abnahme der Stufe 5 zu reißen (Sponsor-Anteil 65 bis 72 %); mit + 25 % liegt er
   bei rund 65 %.
2. **Die Arena hat Plätze statt einer festen Einnahme.** Tickets = min(Plätze, Nachfrage) × Preis. Baukosten und Unterhalt
   bleiben wie im Katalog, die Katalog-Einnahme des Arena-Gebäudes entfällt.

| Stufe | Plätze | Fan-Maximum | Bau | Unterhalt je Saison | volles Haus Liga 2 / Liga 1 | mehr je Saison, netto | Bau bezahlt nach |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 | 8.000 | 10.000 | – | – | 1,4 / 2,1 C | – | – |
| 1 | 11.000 | 13.750 | 13 C | 0,8 C | 2,0 / 2,9 C | +4,0 / +6,3 C | 3,2 / 2,1 Saisons |
| 2 | 14.000 | 17.500 | 24 C | 1,4 C | 2,5 / 3,7 C | +4,2 / +6,5 C | 5,7 / 3,7 Saisons |
| 3 | 17.500 | 21.875 | 30 C | 2,4 C | 3,2 / 4,6 C | +4,7 / +7,4 C | 6,3 / 4,1 Saisons |
| 4 | 21.500 | 26.875 | 46 C | 3,6 C | 3,9 / 5,7 C | +5,5 / +8,5 C | 8,4 / 5,4 Saisons |
| 5 | 26.000 | 32.500 | 72 C | 5,4 C | 4,7 / 6,9 C | +5,8 / +9,2 C | 12,5 / 7,8 Saisons |

„Netto“ zieht den zusätzlichen Unterhalt und den höheren Arena-Betrieb ab (0,6 bzw. 0,9 C je Stufe) und gilt bei vollem
Haus. Die frühen Stufen lohnen sich schneller als heute, die späten nur für Teams mit großer Fanbasis. In der ersten Saison
nach dem Ausbau füllen sich die neuen Plätze erst: im Beispiel +0,8 C, danach +4,0 C, bezahlt nach rund vier Saisons.

**Kopplung an die Auslastung:**

- Jedes Team hat eine **Fanbasis**, Start 8.000 × Beliebtheit. Nachfrage = Fanbasis × (0,30 + 0,85 × Stimmung ÷ 100) ×
  Preisfaktor (die Formel aus V2).
- Die Fanbasis wächst um 2 % nach jedem Heimspiel mit mindestens 90 % Auslastung und sinkt um 1 % unter 60 %. Sie wächst
  nur bis zum **Fan-Maximum = 1,25 × Plätze**. Wer das Maximum erreicht hat, bekommt mehr Fans erst mit mehr Plätzen.
- **Empfehlung des Vorstands** im Postfach, sobald der Schnitt der letzten drei Heimspiele bei 90 % oder mehr liegt, mit
  der Amortisationsrechnung. Unter 60 % rät er vom Ausbau ab (Warnung im Bau-Dialog, keine Sperre).
- Der Ausbau bleibt ein Gebäude: sofort aus dem Investitionstopf, hart gegen die Freigabe, wirkt ab dem nächsten Heimspiel.
  Das Dauerkarten-Kontingent wächst mit, ab der nächsten Saison.
- KI: baut die Arena nur bei aktiver Empfehlung und wenn die Amortisation unter sechs Saisons liegt.

Die Fanbasis ist die einzige neue Größe im Spielstand. Sie wirkt nur auf Geld, nie auf die Wertung.

### f.4 Verletzungs-Versicherung als Erstattung

Pauschale einmal je Saison aus dem Gehaltstopf, dafür Erstattung je Ausfall-Spieltag.

| Stufe | Pauschale Liga 2 / Liga 1 | versichert | Erstattung |
|---|---:|---|---|
| keine | 0 | – | – |
| beste 6 | 0,7 / 1,0 C | die sechs teuersten Verträge | 80 % des Spieltagsgehalts **ab dem zweiten Ausfall-Spieltag** einer Verletzung |
| ganzer Kader | 1,2 / 1,7 C | alle | wie oben |

Bezug: Heute fällt ein Verletzter einen Spieltag aus; künftig sollen Verletzungen bis zu drei Spieltage dauern (Idee von
Chris, noch nicht gebaut). Der erste Ausfall-Spieltag bleibt immer beim Team. Darum zahlt die Versicherung heute nichts und
gehört erst mit den längeren Verletzungen in den Bau.

Rechnung: Die Liga hat rund 145 Verletzungen je Saison (`lib/fatigue/fatigue-injury-service.ts:177` bis `:182`), 4,5 je
Team. Annahme für die Dauer: 50 % ein Spieltag, 30 % zwei, 20 % drei. Das sind 0,7 erstattete Tage je Verletzung.

| | Erstattung je Tag | erwartet je Saison | Pauschale | lohnt sich ab |
|---|---:|---:|---:|---|
| beste 6 (Mittel 7,5 C Gehalt) | 0,30 C | rund 0,4 C | 0,7 C | 3 erstatteten Tagen, also zwei langen Ausfällen unter den besten 6 |
| ganzer Kader (Mittel 4,9 C) | 0,19 C | rund 0,6 C | 1,2 C | 7 erstatteten Tagen, also mehr als drei Ausfällen über drei Spieltage |

Im Mittel fließen 50 bis 60 % der Pauschale zurück, der Rest geht in den Liga-Topf. Wer Pech für zwei hat, gewinnt; alle
anderen zahlen einen kleinen Preis für Ruhe. Ein Recovery Center verkürzt Ausfälle und senkt damit den Wert der
Versicherung. Beispiel im Mockup: Com. Shepard (9,0 C) fehlt zwei Spieltage, erstattet werden 1 × 0,45 × 0,8 = 0,36 C.

KI: dünner Kader (unter 11) oder ein Star mit über 12 % der Gehaltssumme → beste 6; vorsichtiger Charakter → ganzer Kader;
sonst keine. Vor dem Bau die Ausfalltage je Team messen (`scripts/miss-teamfinanzen-saison.ts` erweitern).

### f.5 Trainingslager in der Winterpause

Die Pause nach Spieltag 10 gibt es schon (`BELASTUNG_PAUSE_NACH_SPIELTAG`, `lib/fatigue/belastung-regel.ts:50`): ein
Ruhe-Spieltag für alle, kein Transferfenster. Neu ist eine Teamentscheidung in dieser Pause. Sie ersetzt N5 aus Runde 1
(Schaukampf und Ruhe entfallen).

| Schwerpunkt | Kosten | bleibende Wirkung | Schub, Spieltag 11 bis 13 | Bedingung |
|---|---:|---|---|---|
| kein Lager | 0 | Pause wie bisher | – | – |
| Training | 2,0 C | Trainingspunkte von zwei Spieltagen zusätzlich für alle Gesunden (+10 % der Saisonmenge) | Form +1 an Spieltag 11 | Erschöpfung im Team-Schnitt höchstens 55, **oder** ambitioniertes Ziel; dann ohne Erholung: Form −1 statt +1 |
| Fitness | 1,5 C | Erschöpfung −10 zusätzlich zur Pause | Erschöpfung baut sich um 20 % langsamer auf | keine |
| Moral | 1,5 C | Moral +8 für alle | Form +1 an Spieltag 11 und 12 | keine |
| Reha | 1,0 C + 0,3 C je Verletztem | Verletzte fehlen einen Spieltag weniger, Spieler im roten Bereich (ab 65) −15 Erschöpfung | Rückkehrer starten ohne Formabzug | mindestens ein Verletzter oder drei im roten Bereich |

- **Ambitioniert** heißt: Vorstandsziel Titel, Aufstieg oder Top 4, oder „Alles auf eine Karte“.
- **Der Schub läuft über die Form**, nie als Punkte, wie beim Mutator. Eine Form-Stufe ist 1 % Eignung. Das ist ein
  On-top-Effekt und zählt nicht gegen die Rangtreue-Schranke.
- **Kosten:** aus dem Investitionstopf, hart gegen die Freigabe, für Mensch und KI gleich. 1,0 bis 2,0 C sind ein Viertel
  bis ein Drittel eines Spielergehalts. Das Geld geht in den Liga-Topf.
- **KI:** zwei Verletzte oder vier im roten Bereich → Reha; Moral unter 55 → Moral; Erschöpfung über 60 → Fitness;
  ambitioniertes Ziel höchstens drei Ränge entfernt und ausgeruht → Training; Kasse unter zwei Gehaltsraten oder Freigabe
  reicht nicht → kein Lager.
- **Mehrspieler:** je Team gespeichert, delegierbar im Bereich Training. Ohne Wahl gilt „kein Lager“; kein Spieltag wartet.
- Training muss gemessen werden: zwei Spieltage Trainingspunkte dürfen das Liga-Mittel der Entwicklung nicht aus dem
  Korridor −1 bis +1 schieben.

### f.6 Kredite ab Saison 1

Entscheidung: Die Sperre für Saison 1 fällt. Sie sitzt an drei Stellen: `lib/finance/loan-service.ts:399`
(`buildLoanOffers` gibt in Saison 1 eine leere Liste), `:531` (`originateLoan` lehnt ab) und
`lib/ai/ai-loan-decision-service.ts:298` (KI). Alles andere bleibt: Kreditrahmen = 15 % der Kasse + 30 % des Kaderwerts −
Restschuld (`loan-service.ts:95`), Zins 5 bis 12 %, Sparauflage des Vorstands (unter 60 % Freigabe kein freiwilliger
Kredit), Pflichtkredit erst am Kassensturz.

Folgen, die der Bau beachten muss:

- Vor dem Draft hat ein Team keinen Kader. Der Rahmen ist dann 15 % des Startbudgets, 25 bis 49 C. Nach dem Draft sind es
  rund 50 bis 60 C.
- Die KI leiht in Saison 1 nur für den Pflichtkader und im Notfall, **nie für den Draft**. Sonst kaufen alle Teams mit
  rund 15 % mehr Geld und die Kalibrierung der Startbudgets kippt. Der Mensch darf.
- Der Kredit landet im Transfertopf und unterliegt der Freigabe (in Saison 1 immer 100 %).

### f.7 Mockup, Runde 2

Neuer Reiter **Saisonwahl**: `public/mockups/finanzen-modern-18-11.html?ansicht=wahl` (Schalter `&dk=0|1|2`, `&vers=0|1|2`,
`&lager=0..4`, `&st=<Spieltag>`). Sechs Karten: Dauerkarten, Arena und Auslastung mit Ausbau-Rechnung, Versicherung,
Trainingslager, Farb-Meister, Kredite. Ab 1250 px Höhe steht darunter die Arena-Leiter. Die drei Wahlen sind klickbar und
rechnen in die Aufschlüsselung durch. Ab Spieltag 15 liegt der Schnitt der letzten drei Heimspiele über 90 % und die Arena-Karte zeigt die
Empfehlung des Vorstands.

Im Reiter Aufschlüsselung: Farb-Meister ersetzt die Krone, Trainingslager ersetzt den Schaukampf, Versicherung heißt
Pauschale und Erstattung, Dauerkarten rechnen mit 25 %. Der Reiter Hebel nennt im Fuß die Kredite ab Saison 1. Die
Ticket-Zeilen nennen die Grundarena mit 8.000 Plätzen (vorher stand dort „Arena Stufe 2“, was nicht zum Betrag passte).

Ehrlich gekennzeichnet: alle Beträge sind erfunden. Dauerkarten und Auslastung rechnen mit dem Modell des Mockups; Lage des
Kaders (Erschöpfung 58, Moral 64), Farb-Tabellen und Kreditrahmen sind feste Beispielwerte. Das Mockup rechnet mit einem
vollen Haus von 1,45 C; die Regel ergibt 1,44 C.

| Datei (`docs/design/finanzen-posten-22-11/`) | Zeigt |
|---|---|
| `runde2-saisonwahl-1920x1080.png` | Saisonwahl nach Spieltag 12, Auslastung 86 %, noch keine Empfehlung |
| `runde2-saisonwahl-2560x1440.png` | nach Spieltag 16, Vorstand empfiehlt den Ausbau, Arena-Leiter sichtbar |
| `runde2-saisonwahl-training-ganzer-kader-1710x1112.png` | andere Wahlen: viel, ganzer Kader, Training trotz Erschöpfung |
| `runde2-aufschluesselung-neu-farbmeister-1920x1080.png` | Aufschlüsselung, Filter Neu, Farb-Meister mit Quelle |
| `runde2-aufschluesselung-2560x1440.png` | Aufschlüsselung, alle Posten, Trainingslager gewählt |
| `runde2-hebel-1920x1080.png` | Reiter Hebel mit neuem Fußtext |
| `runde2-phone-412x900.png` | Nebenprobe Phone |

Geprüft in Chromium unter `flock /tmp/oly-aufnahme.lock`: keine JS-Fehler in allen sieben Aufnahmen, kein Seitenscroll und
kein inneres Scrollen bei 2560×1440, 1920×1080 und 1710×1112, kein abgeschnittener Text in Karten, Reitern und Kennzahlen.
Die Aufnahmen aus Runde 1 zeigen den alten Stand (Krone, Schaukampf, 10 % Rabatt).

### f.8 Offene Fragen an Chris

| # | Frage | Empfehlung |
|---:|---|---|
| 1 | Farb-Meister aus dem Rangprämien-Topf oder obendrauf? Und ein Deckel, falls ein Team mehr als zwei Farben holt? | **Aus dem Topf**, Deckel erst nach dem Messlauf. |
| 2 | Arena-Leiter: Reichen 3 bis 6 Saisons Amortisation für die ersten drei Stufen, oder soll die Arena schneller Geld bringen? | **So lassen.** Schneller heißt höherer Preis je Besucher, und dann fällt der Sponsor-Anteil unter 65 %. |
| 3 | Kredit in Saison 1 schon im Draft oder erst danach? | **Mensch ja, KI nicht für den Draft**, damit die Startbudgets die Kalibrierung bleiben. |
