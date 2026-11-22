# Finanzen: woher kommt das Geld, wohin geht es (22.11.)

Chris, 22.11.: „genauso noch mal im finanzbereich überlegen, für was wird noch geld ausgegeben und eingenommen. Mal random
dazu aus meinem FM27 spielstand vllt hilfts und du hast ideen die man zu nem mockup machen kann“.

Dieses Papier ist Konzept und Mockup, kein App-Code. Es nimmt auf, welche Geldflüsse es heute gibt (a), schlägt neue vor (b),
rechnet ihre Wirkung auf die Balance (c) und stellt fünf Fragen (d). Das Mockup ist ein neuer Reiter „Aufschlüsselung“ in
`public/mockups/finanzen-modern-18-11.html` (`?ansicht=posten`), Abschnitt (e).

**Kurzfassung**

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

### Empfohlen: umsetzen

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

| Posten | brutto je Team | Gegenposten je Team | netto je Team | Σ Liga (32 Teams) |
|---|---:|---:|---:|---:|
| N1 Dauerkarten (normal) | +5,2 | −4,6 Tageskarten | +0,6 bis −1,0 | −13 bis +19, im Mittel um 0 |
| N2 Disziplin-Krone | +1,0 im Mittel | −1,0 Rangprämie | 0 | 0 (32 C umgewidmet) |
| N3 Versicherung | −2,0 Prämie, +1,7 Leistung | Überschuss in den Liga-Topf | −0,3 | −10 in der GuV, +10 im Liga-Topf |
| N4 Topspiel | +0,9 | −0,9 Siegprämie der Liga | 0 | 0 |
| N5 Winterpause | +1,8 oder −2,0 | – | etwa 0 im Liga-Mittel | ±15 |
| N6 Zielprämie | −1,5 bei Erfolg | – | −0,6 im Mittel | −20 |
| **Summe, alle sieben** | | | **rund −0,65** | **rund −20 C, 1,1 % der Gehälter** |
| **Summe, nur N1 bis N3** | | | **rund −0,3** | **rund −10 C, 0,5 % der Gehälter** |

Die Zahl −0,65 C steht auch im Mockup (Kennzahl „Neue Posten netto“). Zum Vergleich: der Saison-Faktor bewegt die Liga um
261 C zwischen seinen Grenzen. Die neuen Posten liegen damit weit unter dem Rauschen und kippen keine Kalibrierung.

Was sich verschiebt, ohne dass die Summe sich ändert:

- **Zeit.** Dauerkarten bringen rund 5 C vor Spieltag 1. Das hebt den Tiefststand der Kasse mitten in der Saison und
  kann in der Kaufphase einen halben Spieler mehr bezahlen. Der Betrag läuft über die Kasse und unterliegt damit der
  Vorstands-Freigabe wie jedes andere Guthaben.
- **Verteilung.** Die Krone nimmt den ersten Rängen etwas Rangprämie und gibt sie Spezialisten. Bei 1,6 % des Topfs ist das
  kein Rubberband, aber messbar; der Lauf muss zeigen, ob die Kronen nicht doch alle beim Tabellenführer landen.
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
