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
>
> **Stand nach Runde 3 (Chris, 22.11.):** Disziplin-Medaillen (Gold, Silber, Bronze) zusätzlich zum Farb-Meister. Arena mit
> Stehplatz, Sitzplatz und Loge, Stufe 0 = 4.000 Plätze, Tickets bis zu einem Viertel der Einnahmen. **Der Sponsor bleibt,
> wie er ist**; die Senkung der Ausschüttung aus f.3 ist zurückgenommen. Zuschauer-Ereignisse je Heimspiel (Derby ×1,5 bis
> ×2,0). Startbudget-Aufschlag als Messvariante. Alles in **Abschnitt (g)**; wo (f) und (g) sich widersprechen, gilt (g).
> Die Zeilen „Mehr Geld je Besucher“ und „Arena“ der Tabelle in (c) gelten nicht mehr, siehe g.2. Marketing:
> `docs/design/marketing-22-11.md`.
>
> **Stand nach Runde 4 (Chris, 22.11.):** Der Arena-Ausbau läuft **von Hand in 1.000er-Schritten je Bereich** (Stehplatz,
> Sitzplatz; Logen in 100er-Schritten) statt über feste Bauteile. Je Schritt stehen Bau, Unterhalt, „bringt ca.“ und
> Amortisation da. Alles in **Abschnitt (h)**; er ersetzt in g.2 nur den Teil „Ausbau: je Stufe ein Bauteil“ samt
> Beispiel-Leiter. Preise, Platzarten, Fanbasis, Dauerkarten, Ereignisse (g.3) und die Balance-Tabellen aus (g) bleiben.

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

> **Ersetzt durch g.2 und g.3 (Runde 3).** Die Leiter mit 8.000 Plätzen und der Gegenposten über den Sponsor gelten nicht
> mehr. Fanbasis, Empfehlung des Vorstands und KI-Regel sind in g.2 übernommen.

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

---

## (g) Runde 3: Medaillen, Arena mit Platzarten, Zuschauer-Ereignisse, Startbudget (Chris 22.11.)

Chris, 22.11., wörtlich: „oder mach als diszi krone quasi als medaille und gold silber bronze bekommen nen kleinen cash boost
und ggf. moral wenn es die spieler interessiert / arena einnahmen können bei top teams 25% ausmachen wenn sie die arena voll
bekommen ich hätte gesagt bei top voraussetzungen ca 1% pro 1k zuschauer? auf die saison gesehen. bei stufe 0 hat man dann halt
4k stadion oder du machst es sogar detaillierter mit stehplatz sitzplatz loge. je besser desto teurer in der einrichtung aber
desto mehr pro spieltag wirft es ab aber in der realität sind zb in der bundesliga die dauerkarten und generell kartenverkauf
ein großer treiber der einnahmen / Was ist mit marketing? […] / und gemeint ist den sockelbetrag für startbudget von 20 …
bekommt JEDES team platz 32 also +20 mio und platz 31 dann 22 mio platz 30 24 mio usw“

Und danach: „Ne Tickets werden stärker und Sponsoren bleiben genau wie sie sind. Ereignisse können auch auf Zuschauerzahlen
Einfluss nehmen, Derby gegen Rivalen, oder andere Dinge können die Einnahmen verdoppeln oder manches auch halbieren oder
zumindest verringern und erhöhen.“

Was sich gegenüber Runde 2 ändert:

- **f.1** bleibt, der Farb-Meister bekommt die Medaillen an die Seite und sinkt dafür leicht (g.1).
- **f.3 ist ersetzt** durch g.2 und g.3. Die Arena-Leiter mit 8.000 Plätzen und der Gegenposten „Sponsor-Ausschüttung
  0,73 → 0,69“ sind **zurückgenommen**. Der Sponsor bleibt, wie er ist; Tickets kommen obendrauf.
- **f.2** (Dauerkarten 25 %) bleibt und gilt je Platzart (g.2).
- Das Marketing steht in einem eigenen Papier: `docs/design/marketing-22-11.md`.

Alle Zahlen sind Startwerte für den Messlauf.

### g.1 Disziplin-Medaillen, zusätzlich zum Farb-Meister

**Regel.** Am Saisonende gibt es in jeder Liga je Disziplin Gold, Silber und Bronze: 20 Disziplinen × 3 Medaillen × 2 Ligen
= 120 Medaillen je Saison.

- **Wertung:** Summe der Ergebnispunkte (E1, 0 bis 10 je Begegnung) des Teams in dieser Disziplin. Jede Disziplin kommt je
  Saison **zweimal** dran (20 Spieltage × 2 Disziplinen), die Tabelle hat also zwei Einträge je Team. Gleichstände sind
  darum häufig. Reihenfolge bei Gleichstand: Summe der Rohwert-Abstände, dann die PP-Summe der eingesetzten Spieler; ist auch
  das gleich, wird die Medaille geteilt (beide bekommen sie, das Geld wird halbiert).
- **Geld:** Liga 1 Gold 0,5 · Silber 0,3 · Bronze 0,2 C. Liga 2 Gold 0,3 · Silber 0,2 · Bronze 0,1 C. Eine Goldmedaille ist
  rund ein Zwanzigstel eines Spielergehalts. Das ist mit Absicht klein, weil zwei Begegnungen viel Zufall enthalten.
- **Moral, nur für Spieler, die es interessiert.** Betroffen sind die Spieler, die in dieser Disziplin eingesetzt waren und
  einen Ehrgeiz- oder Ruhm-Trait tragen: `Ambitious` (`lib/training/class-progression-config.ts:236`), `FanFavorite` (`:243`),
  `FiredUp` (`:245`), `Motivated` (`:249`), `Diva` (`:260`), `Egomaniac` (`:261`). Sie bekommen Moral +6 (Gold), +4 (Silber),
  +2 (Bronze), höchstens +10 je Spieler und Saison. Das sind dieselben Traits, die im Code schon Forderungen auslösen
  (`DEMAND_TRAITS`, `lib/morale/player-demands-service.ts:59`). Alle anderen bekommen nichts. `Mercenary` (`:267`) und
  `Gambler` interessiert nur Geld: Moral +2 je Medaille, aber nur, wenn die Siegprämie an den Kader eingeschaltet ist.
  `Diva` und `Egomaniac` zählen nur die Medaillen, bei denen sie selbst der beste Spieler ihres Teams waren.
  Die Moral wirkt als On-top-Effekt über die Form und zählt nicht gegen die Rangtreue-Schranke.

**Zusätzlich oder statt des Farb-Meisters? Empfehlung: beides, der Farb-Meister sinkt.**

| Variante | Medaillen | Farb-Meister | Summe je Saison | Anteil am Rangprämien-Topf (620 C) |
|---|---:|---:|---:|---:|
| A: nur Medaillen | 20 + 12 = 32 C | – | 32 C | 5,2 % |
| **B: beides, Farb-Meister 3,0 / 2,0 C (Empfehlung)** | 32 C | 12 + 8 = 20 C | **52 C** | 8,4 % |
| C: beides, Farb-Meister wie Runde 2 (4,0 / 2,5 C) | 32 C | 26 C | 58 C | 9,4 % |

Begründung: Die zwei Preise belohnen Verschiedenes. Medaillen sind klein und breit, auch ein Team im Mittelfeld holt mit einer
starken Disziplin eine. Der Farb-Meister ist groß und selten, er belohnt einen Kader mit Profil über zehn Begegnungen. Zusammen
sind es im Mittel 1,6 C je Team (Liga 1: 2,0 C, Liga 2: 1,25 C).

**Topf und Gegenposten:** Einnahme, läuft über die Kasse (L), gebucht am Saisonende. Die 52 C kommen aus dem
**Rangprämien-Topf des Sponsors**: jede Rangprämie sinkt um 8,4 %. Die Auszahlung des Sponsors an die Liga bleibt damit auf
den Cent gleich, sie wird nur anders verteilt (weniger nach Tabellenplatz, mehr nach Disziplin und Farbe). Das passt zu
„Sponsoren bleiben genau wie sie sind“; wenn Chris auch die Verteilung nicht anfassen will, kommen die 52 C obendrauf und
die Geldmenge wächst je Saison um 2,4 % der Einnahmen (Frage 1).

**Risiko:** Ein überlegenes Team in Liga 1 könnte acht Gold, fünf Silber, drei Bronze (6,1 C) und alle vier Farben (12 C) holen,
zusammen 18 C. Deckel wie in f.1: höchstens zwei Farben je Team; dann sind es 12 C.

**KI:** keine eigene Regel für Medaillen. Die Farb-Regel aus f.1 bleibt.

### g.2 Arena-Einnahmen neu: Platzarten, Stufe 0 mit 4.000 Plätzen

**Ziel von Chris:** Bei Top-Voraussetzungen bringt die Arena rund 1 % der Saisoneinnahmen je 1.000 Zuschauer. Ein Top-Team mit
voller Arena von rund 25.000 Plätzen holt so ein Viertel seiner Einnahmen aus Karten. **Der Sponsor bleibt unverändert.**

**Eichung.** Ein Top-Team der Liga 1 bekommt heute rund 100 C vom Sponsor (Median 73 C, Maximum 121 C,
`docs/design/finanzen-ist-messung-18-11.md` Zeile 116), ein Top-Team der Liga 2 rund 76 C. Damit 25.800 Plätze ein Viertel
der Einnahmen bringen, muss das volle Haus über die Saison 34,4 C (Liga 1) bzw. 25,8 C (Liga 2) wert sein.

**Platzarten.** Preise in C je 1.000 Plätze, Liga 1 = Liga 2 × 4/3.

| Platzart | je Heimspiel, Liga 2 · Liga 1 | je Saison (10 Heimspiele) | Auslastung hängt an |
|---|---:|---:|---|
| **Stehplatz** | 0,06 · 0,08 C | 0,6 · 0,8 C | Fan-Stimmung, stark: ab Stimmung 70 voll, unter 40 halb leer |
| **Sitzplatz** | 0,12 · 0,16 C | 1,2 · 1,6 C | Fanbasis, träge: schwankt halb so stark wie der Stehplatz |
| **Loge** | 0,60 · 0,80 C | 6,0 · 8,0 C | Sponsor und Erfolg: 20 % + 40 % × Sponsor-Stufe + 40 % × Tabellenplatz, die Stimmung ist egal |

„Sponsor-Stufe“ ist der Rang des gewählten Sponsors nach seiner Saisonbasis in der Liga, „Tabellenplatz“ der Rang der
Vorsaison, ab Spieltag 5 der laufende Rang; beides als Anteil von 0 (letzter) bis 1 (erster). Ein Tabellenführer mit dem
größten Sponsor hat volle Logen, ein Kellerteam mit kleinem Sponsor 20 %.

**Stufe 0, die Grundarena:** 4.000 Plätze, davon 3.000 Stehplätze und 1.000 Sitzplätze, keine Logen. Volles Haus 3,0 C
(Liga 2) bzw. 4,0 C (Liga 1) je Saison. Sie kostet nichts und hat keinen Unterhalt.

**Ausbau: je Stufe ein Bauteil nach Wahl, höchstens fünf.** *(Ersetzt durch Abschnitt (h): Ausbau von Hand in Schritten. Die
folgenden zwei Tabellen sind der Stand von Runde 3.)* Der Manager entscheidet bei jedem Ausbau, welche Platzart wächst.

| Bauteil | Plätze | Bau (1. · 2. · 3. dieser Art) | Unterhalt je Saison | volles Haus je Saison, Liga 2 · Liga 1 | je Heimspiel | mehr netto | Bau bezahlt nach (1. der Art) |
|---|---:|---:|---:|---:|---:|---:|---:|
| **Stehtribüne** | +6.000 Steh | 12,0 · 14,4 · 16,8 C | 0,8 C | 3,6 · 4,8 C | 0,36 · 0,48 C | +2,8 · +4,0 C | 4,3 · 3,0 Saisons |
| **Sitzrang** | +4.500 Sitz | 20,0 · 24,0 · 28,0 C | 1,2 C | 5,4 · 7,2 C | 0,54 · 0,72 C | +4,2 · +6,0 C | 4,8 · 3,3 Saisons |
| **Logenring** | +800 Logen | 26,0 · 31,2 · 36,4 C | 1,0 C | 4,8 · 6,4 C | 0,48 · 0,64 C | +3,8 · +5,4 C | 6,8 · 4,8 Saisons |

Jedes weitere Bauteil derselben Art kostet 20 % mehr als das erste. Das schiebt leicht zu einer gemischten Arena, ohne eine
reine Stehplatz-Arena zu verbieten. „Bezahlt nach“ gilt bei vollem Haus; bei 80 % Auslastung dauert es ein Viertel länger,
und im ersten Jahr füllen sich neue Steh- und Sitzplätze erst zu rund 60 %.

**Beispiel-Leiter** (Stehtribüne, Sitzrang, Stehtribüne, Sitzrang, Logenring):

| Stufe | Bauteil | Plätze (Steh · Sitz · Loge) | Bau | Bau gesamt | Unterhalt | volles Haus je Saison, Liga 2 · Liga 1 | je Heimspiel | Fan-Maximum |
|---:|---|---:|---:|---:|---:|---:|---:|---:|
| 0 | – | 4.000 (3.000 · 1.000 · 0) | – | – | – | 3,0 · 4,0 C | 0,30 · 0,40 C | 6.000 |
| 1 | Stehtribüne | 10.000 (9.000 · 1.000 · 0) | 12,0 C | 12,0 C | 0,8 C | 6,6 · 8,8 C | 0,66 · 0,88 C | 15.000 |
| 2 | Sitzrang | 14.500 (9.000 · 5.500 · 0) | 20,0 C | 32,0 C | 2,0 C | 12,0 · 16,0 C | 1,20 · 1,60 C | 21.750 |
| 3 | Stehtribüne | 20.500 (15.000 · 5.500 · 0) | 14,4 C | 46,4 C | 2,8 C | 15,6 · 20,8 C | 1,56 · 2,08 C | 30.750 |
| 4 | Sitzrang | 25.000 (15.000 · 10.000 · 0) | 24,0 C | 70,4 C | 4,0 C | 21,0 · 28,0 C | 2,10 · 2,80 C | 37.500 |
| 5 | Logenring | 25.800 (15.000 · 10.000 · 800) | 26,0 C | 96,4 C | 5,0 C | 25,8 · 34,4 C | 2,58 · 3,44 C | 37.500 |

Die volle Leiter kostet 96,4 C (heute 185 C für fünf Stufen, die zusammen höchstens 28,5 C × Beliebtheit bringen). Bei
vollem Haus ist sie nach 5,4 (Liga 2) bzw. 3,8 Saisons (Liga 1) bezahlt.

**Was bleibt aus Runde 2:**

- **Fanbasis** je Team, einzige neue Größe im Spielstand, wirkt nur auf Geld. Start 5.000 × Beliebtheit. Nachfrage =
  Fanbasis × (0,30 + 0,85 × Stimmung ÷ 100) × Preisfaktor × Ereignis (g.3). Sie wächst um 2 % nach jedem Heimspiel mit
  mindestens 90 % Auslastung, sinkt um 1 % unter 60 % und endet am **Fan-Maximum = 1,5 × (Steh- + Sitzplätze)**.
- **Aufteilung der Nachfrage:** ein Anteil von 35 % + 30 % × Stimmung ÷ 100 will stehen, der Rest sitzen. Wer keinen
  Stehplatz bekommt, kauft zu 50 % einen Sitzplatz; wer keinen Sitzplatz bekommt, zu 80 % einen Stehplatz. Logen laufen
  getrennt.
- **Empfehlung des Vorstands** je Platzart: liegt ihr Schnitt der letzten drei Heimspiele bei 90 % oder mehr, empfiehlt er
  das passende Bauteil mit Amortisation. Unter 60 % rät er ab (Warnung, keine Sperre).
- Der Ausbau bleibt ein Gebäude: Investitionstopf, hart gegen die Freigabe, wirkt ab dem nächsten Heimspiel. Die Einnahme des
  heutigen Gebäudes „Arena Upgrade“ (`lib/facilities/facility-catalog.ts:186`, 2,4 bis 28,5 C × Beliebtheit) entfällt, der
  Arena-Betrieb aus V2 bleibt auf seinem Grundwert und wächst nicht mehr mit der Stufe (der Unterhalt je Bauteil ersetzt das).
- **KI:** baut nur bei aktiver Empfehlung, wählt das empfohlene Bauteil und nur, wenn es in höchstens sechs Saisons bezahlt
  ist. In Liga 2 sind das Stehtribüne und Sitzrang, der Logenring erst mit Erfolg.
- **Mehrspieler:** Bauteil-Wahl je Team, delegierbar im Bereich Gebäude.

**Dauerkarten je Platzart (f.2 bleibt).** Der gewählte Anteil (20, 40 oder 60 %) gilt für Stehplätze, Sitzplätze und Logen
gleich, Rabatt 25 %, Geld vor Spieltag 1. Die Wirkung ist je Platzart verschieden, weil der Gleichstand bei 75 % Auslastung
liegt: Stehplätze schwanken am stärksten, dort ist die Dauerkarte die größte Wette. Logen sind planbar, ihre Auslastung steht
vor der Saison fast fest; liegt sie unter 75 %, ist die Logen-Dauerkarte sicheres Geld. Eine eigene Stufe je Platzart wäre
genauer, aber drei Regler statt einem (Frage 2). Dauerkarten sind von Ereignissen nicht betroffen: Ein Derby hebt nur die
Tageskasse, ein Unwetter trifft Dauerkarten-Geld nicht. Beispiel des Mockups (15.300 Plätze, volles Haus 1,68 C): 2,52 ·
5,04 · 7,56 C sofort.

**Der Sponsor bleibt, wie er ist: Was die Tickets mit der Geldmenge machen.** Es gibt keinen Gegenposten. Die Einnahmen der
Liga steigen um die Tickets:

| Lage der Liga | Tickets Liga 1 · Liga 2 je Team | Tickets Liga-Summe | Unterhalt Liga | netto mehr je Saison | je Team | in % der heutigen Einnahmen (2182 C) |
|---|---:|---:|---:|---:|---:|---:|
| Start: alle Stufe 0, ausverkauft | 4,0 · 3,0 C | 112 C | 0 | +112 C | +3,5 C | 5 % |
| Schnitt Stufe 1, 80 % Auslastung | 7,0 · 5,3 C | 197 C | 26 C | +172 C | +5,4 C | 9 % |
| Schnitt Stufe 2 | 12,8 · 9,6 C | 358 C | 64 C | +294 C | +9,2 C | 16 % |
| Schnitt Stufe 3 | 16,6 · 12,5 C | 466 C | 90 C | +376 C | +11,8 C | 21 % |
| alle Stufe 5 (Logen 60 %) | 26,2 · 19,7 C | 735 C | 160 C | +575 C | +18,0 C | 34 % |

Je Team-Typ, Sponsor wie heute gemessen:

| Team-Typ | Arena | Sponsor | Tickets | Unterhalt | Einnahmen | Ticket-Anteil | Sponsor-Anteil |
|---|---|---:|---:|---:|---:|---:|---:|
| Top, Liga 1, volle Arena | Stufe 5, 25.800 | 100 C | 34,4 C | 5,0 C | 138 C | **25 %** | 73 % |
| Top, Liga 1, größter Sponsor (121 C) | Stufe 5, 25.800 | 121 C | 34,4 C | 5,0 C | 159 C | 22 % | 76 % |
| Mittelfeld, Liga 1 | Stufe 3, 20.500, 80 bis 85 % | 76 C | 17,2 C | 2,8 C | 96 C | 18 % | 79 % |
| Top, Liga 2, volle Arena | Stufe 5, 25.800 | 76 C | 25,8 C | 5,0 C | 105 C | **25 %** | 73 % |
| Mittelfeld, Liga 2 | Stufe 2, 14.500, 75 bis 80 % | 52 C | 9,3 C | 2,0 C | 64 C | 14 % | 81 % |
| Kleiner, Liga 2 | Stufe 1, 10.000, 65 bis 70 % | 43 C | 4,6 C | 0,8 C | 50 C | 9 % | 87 % |

Das trifft Chris' Regel: je 1.000 Plätze 0,84 bis 0,99 % der Einnahmen, mit voller Top-Arena ein Viertel. (Rest zu 100 %
sind die Vorstandsziele.)

**Wer fängt das Mehr auf, und wachsen die Kassen?**

- **In der Aufbauphase der Bau selbst.** Bis zum Schnitt von Stufe 2 gibt jedes Team im Mittel 32 C aus, 1.024 C in der
  Liga. Bei einem Ausbau je Saison sind das rund 500 C je Saison, mehr als die Tickets in dieser Zeit bringen (197 bis
  358 C). Die Kassen sinken in den ersten zwei bis drei Saisons eher.
- **Danach die schon geplanten Ausgaben.** Ausrüstung (Reparatur typisch 6,7 C, voll 19 C, dazu Händler) und Verpflegung
  (3,5 C) kosten zusammen 10 bis 25 C je Team und Saison, in der Liga 320 bis 800 C
  (`docs/design/zwischen-den-spieltagen-22-11.md`). Das war in Runde 1 die offene Balance-Frage (Abschnitt c, Frage 4), weil
  dem keine Einnahme gegenüberstand. Die Tickets sind diese Einnahme: 294 bis 575 C netto gegen 320 bis 800 C.
- **Gehälter** fangen nichts von selbst auf. Sie folgen dem Marktwert und dem Saison-Faktor, nicht der Kasse.
- **Ohne Ausrüstung und Verpflegung wachsen die Kassen** um 9 bis 18 C je Team und Saison (Schnitt Stufe 2 bis 5). Das Geld
  landet in der Kaufphase: höhere Gebote, vollere Kader. Darum gehören die Platzarten in dieselbe Baustufe wie Ausrüstung
  und Verpflegung, oder die Ticketpreise starten bei 70 % und steigen mit deren Bau.
- **Die Spreizung wächst.** Ein Top-Team der Liga 1 gewinnt netto 29 C je Saison, ein kleines Team der Liga 2 knapp 4 C.
  Erfolg füllt die Arena, die Arena bezahlt den nächsten Erfolg. Bremse: Auf- und Abstieg ändern die Preise (× 4/3 bzw.
  × 3/4) sofort, die Baukosten sind für alle gleich, und der Apron schöpft den Gehaltsüberhang ab.

Messplan: drei Saisons mit 32 KI-Teams (`scripts/miss-teamfinanzen-saison.ts`), je Saison Σ GuV, Kassen-Median, Verhältnis
reichstes zu ärmstem Team und der Ticket-Anteil je Team-Typ gegen die Tabelle oben.

### g.3 Zuschauer-Ereignisse je Heimspiel

Jedes Heimspiel kann einen Anlass haben, der die **Nachfrage** multipliziert. Mehrere Anlässe multiplizieren sich, das
Produkt ist auf 0,5 bis 2,0 begrenzt.

**Rivalen gibt es im Code:** `buildTeamRivalryLedger` (`lib/rivalries/team-rivalries.ts:109`) liest die Beziehungsmatrix der
32 Teams (`TEAM_RELATIONSHIP_CSV`, ab `:26`). Eine Rivalität zählt ab Intensität 4, bei beidseitig −2 oder schlechter, oder
wenn die Summe −5 oder schlechter ist (`:120` bis `:122`); die Intensität 0 bis 5 steht im Feld `intensity`. Den Erzrivalen
liefert `getPrimaryTeamRivalry` (`:200`). Beispiele: Golden Gladiators gegen Last Ride (−5/−5), Hell Raisers gegen The
Chantry (−4/−4), Vigilante Wranglers gegen Dire Legion (−3/−3).

| Ereignis | Faktor Nachfrage | Wann | Häufigkeit je Team und Saison |
|---|---:|---|---|
| **Derby gegen einen Rivalen** | ×1,5 (Intensität 2) · ×1,7 (3) · ×1,8 (4) · ×2,0 (5) | fest: Heimspiel gegen ein Team aus der Rivalen-Liste | 1 bis 3, je nach Spielplan |
| Spitzenspiel | ×1,4 | fest: Gegner auf Rang 1 bis 3 oder direkter Tabellennachbar, ab Spieltag 8 | rund 2 |
| Tabellenführer zu Gast | ×1,5 (ersetzt Spitzenspiel) | fest | 0 bis 1 |
| Saisoneröffnung, Saisonfinale | ×1,3; Finale ×1,6, wenn es um Titel, Aufstieg oder Abstieg geht | fest: erstes und letztes Heimspiel | 2 |
| Star-Debüt | ×1,3 | fest: erstes Heimspiel eines Neuzugangs mit Marketability ab 75 (`docs/design/marketing-22-11.md`) | 0 bis 2 |
| Abstiegskampf-Mobilisierung | ×1,25 | fest: letzte vier Heimspiele, Team höchstens zwei Ränge vom Abstiegsplatz | 0 bis 4 |
| Siegesserie · Niederlagenserie | ×1,15 · ×0,85 | fest: vier Siege bzw. vier Niederlagen in Folge (kürzere Serien stecken schon in der Stimmung) | 0 bis 2 |
| Feiertag, Volksfest | ×1,3 | **ligaweit**, einmal je Saison, vor der Saison im Kalender | 1 |
| Unwetter | Stehplatz ×0,6 · Sitzplatz ×0,8 · Loge ×1,0 | **ligaweit**, Würfel 6 % je Spieltag | rund 1 |
| Streik im Nahverkehr | ×0,7 | **ligaweit**, Würfel 3 % je Spieltag | rund 0,5 |
| Skandal, Fan-Boykott | Stehplatz ×0,5 · Sitzplatz ×0,8 für zwei Heimspiele | Team: Skandal eines Spielers mit `Scandalous` oder Verkauf des Aushängeschilds mitten in der Saison | 0 bis 1 |

**Regeln:**

- **Deckel nach oben ist die Arena.** Mehr Nachfrage als Plätze heißt ausverkauft. Der Überhang hebt dann den Preis der
  Tageskarten automatisch: Zuschlag = halber Überhang, höchstens +25 % (Tageslogen höchstens +50 %). Ein Derby ×2,0 kann
  die Einnahme in einer halb leeren Arena **verdoppeln**; in einer vollen bringt es höchstens +25 %. Das ist ein Grund mehr
  für den Ausbau. Dauerkarten bleiben beim festen Preis.
- **Deckel nach unten** ist das Produkt 0,5. Dauerkarten-Geld ist schon da und bleibt.
- **Ligaweite Ereignisse treffen alle Teams gleich:** Sie gelten für das **nächste Heimspiel jedes Teams**, nicht für einen
  Spieltag (sonst träfe es nur die 16 Heimteams). Sie stehen als befristeter Regel-Stempel im Spielstand.
- **Fan-Boykott hängt am Fanprofil.** Bei Teams mit Bösewicht-Fans (Ton unter −0,5, zum Beispiel Hell Raisers) löst ein
  Skandal keinen Boykott aus, sondern ×1,2 für ein Heimspiel.
- Feste Ereignisse stehen ab Saisonbeginn im Kalender und in der Arena-Karte („Nächstes Heimspiel: Derby ×1,5“). Gewürfelte
  Ereignisse kommen aus dem Saat-Strom des Spielstands, nie aus der Uhr.
- **Wirkung im Mittel:** Bei rund zwei Derbys, zwei Spitzenspielen, Eröffnung, Finale, einem Feiertag und einem Unwetter liegt
  der mittlere Faktor bei 1,2. Weil volle Arenen gedeckelt sind, steigen die Ticket-Einnahmen der Liga um rund 10 %. Wer das
  nicht will, senkt die Grundnachfrage von 0,30 auf 0,27.
- **KI, Mehrspieler:** keine Entscheidung nötig. Die KI hebt vor einem Derby nicht eigens den Preis, das macht der Zuschlag.
  Jeder Manager sieht die Ereignisse seines Teams; sie halten keinen Spieltag an.
- Sie wirken nur auf Geld und Fanbasis, nie auf die Wertung.

### g.4 Startbudget-Aufschlag (Messvariante, nicht scharf)

Chris' Lesart ist jetzt eindeutig: **jedes** Team bekommt einen Aufschlag, der letzte der Budget-Rangliste +20 C, je Platz
besser +2 C mehr (Platz 31 +22, Platz 30 +24, … Platz 1 +82).

Die Startbudgets stehen in `references/sheets/season-management.json` (Feld `startBudget`, 32 Einträge) und werden in
`lib/data/dataAdapter.ts:258` bis `:268` auf die Teams gelegt (`loadSourceTeams`). Sie laufen in 5er-Schritten von 325 C
(Mayhem Mavericks) bis 170 C (Riptide Rivers); Golden Gladiators haben 310 C (Platz 4), Hell Raisers 285 C (Platz 9).

| | heute | mit Aufschlag | Änderung |
|---|---:|---:|---:|
| Platz 1 (Mayhem Mavericks) | 325 C | 407 C | +82 C |
| Platz 16 (Vicious & Delicious) | 250 C | 302 C | +52 C |
| Platz 32 (Riptide Rivers) | 170 C | 190 C | +20 C |
| Summe der Liga | 7.920 C | 9.552 C | +1.632 C (+20,6 %) |
| Mittel je Team | 247,5 C | 298,5 C | +51 C |
| Abstand Platz 1 zu Platz 32 | 155 C | 217 C | +62 C |
| Verhältnis reich zu arm | 1,91 | 2,14 | |
| Schritt je Platz | 5 C | 7 C | |

**Wirkung:**

- **Die Spreizung wächst.** Der Aufschlag ist für den Reichsten viermal so hoch wie für den Ärmsten. Das Verhältnis steigt
  von 1,91 auf 2,14, der Abstand um 40 %.
- **Ein Fünftel mehr Geld im Draft.** Die Startbudgets fließen zu 97 % in Spieler. Der Pool wird nicht größer, also steigen
  die Preise der umkämpften Spieler. Zum Vergleich: 1.632 C sind 89 % der Gehaltssumme einer ganzen Saison (1.838 C).
- **Abhängige Größen:** Draft-Rücklage nach Finanzwert (halb in Saison 1), Kreditrahmen (15 % der Kasse, f.6), die
  Kalibrierung „Σ GuV = 0“ des Finanzkonzepts V2 und die KI-Kaufregeln rechnen mit dem Startbudget. Mit den stärkeren Tickets
  (g.2) käme ein zweiter Schub für dieselben Teams dazu.

**Vorschlag:** als Messvariante hinter einem Schalter laufen lassen (drei Saaten, 32 KI-Teams von Anfang an) und gegen heute
vergleichen: Kadergrößen, Gehaltssummen, Anteil der Teams unter Linie 1, Rangtreue der Tabelle zur Budget-Rangliste. Erst
danach entscheiden. Nichts davon ist gebaut oder scharf.

### g.5 Mockup, Runde 3

`public/mockups/finanzen-modern-18-11.html?ansicht=wahl` (neuer Schalter `&bau=0|1|2` für Stehtribüne, Sitzrang, Logenring):

- **Karte „Arena · Platzarten“:** je Platzart Plätze, Auslastung der letzten drei Heimspiele mit der 90-%-Marke und Ertrag je
  Heimspiel. Darunter die Wahl des nächsten Bauteils mit Kosten, Mehrertrag (erste Saison und volles Haus) und Amortisation
  für Liga 2 und Liga 1. Oben rechts das **Ereignis des nächsten Heimspiels** („DERBY ×1,5 ZUSCHAUER · Spieltag 14 ·
  Armageddon Aftermath“). Der Fuß nennt die Empfehlung des Vorstands.
- **Karte „Medaillenspiegel“:** die ersten fünf der Liga 2 mit Gold, Silber, Bronze und Bonus, das eigene Team markiert;
  darunter die vier Farben mit Rang und die Moral-Regel. Sie ersetzt die Farb-Meister-Karte.
- **Tabelle „Arena-Bauteile“** (ab 1250 px Höhe): Grundarena, drei Bauteile und die Beispiel-Arena der Stufe 5.
- **Aufschlüsselung und Spieltags-Abrechnung:** Die Ticketzeile nennt das Ereignis („Heim · Derby ×1,7“, die Rechnung
  rechts mit Gegner) und den Zuschlag bei ausverkauftem Haus. Der Posten „Tageskarten“ erklärt die Ereignisse, der Posten
  „Medaillen · Farb-Meister“ ersetzt „Farb-Meister“.

Das Beispielteam (Vigilante Wranglers, Liga 2) steht jetzt auf Stufe 3 mit 15.300 Plätzen (9.000 Steh, 5.500 Sitz, 800
Logen), volles Haus 1,68 C statt 1,45 C. Seine Ereignisse: Unwetter an Spieltag 6, Derbys an Spieltag 9 (Dire Legion), 14
(Armageddon Aftermath) und 18 (The Chantry), Saisonfinale an Spieltag 20. Die drei Derbys sind echte Rivalitäten aus der
Beziehungsmatrix; alles andere ist erfunden. Die Auslastung je Platzart ist im Mockup aus der Gesamtauslastung abgeleitet
(Logen fest 75 %), nicht mit der vollen Regel gerechnet. Die Kennzahlen aller Reiter haben sich dadurch leicht verschoben
(höhere Tickets): „Neue Posten netto“ steht jetzt bei −1,97 C statt −2,26 C, der Sponsor-Anteil des Beispielteams bei
58 %. Die Aufnahmen aus Runde 1 und 2 zeigen den alten Stand.

| Datei (`docs/design/finanzen-posten-22-11/`) | Zeigt |
|---|---|
| `runde3-saisonwahl-1920x1080.png` | Saisonwahl nach Spieltag 12: Platzarten, Derby als nächstes Heimspiel, Medaillenspiegel |
| `runde3-saisonwahl-logenring-2560x1440.png` | nach Spieltag 13, Logenring gewählt, Tabelle der Bauteile sichtbar |
| `runde3-saisonwahl-sitzrang-1710x1112.png` | Sitzrang gewählt, MacBook-Format |
| `runde3-aufschluesselung-tageskarten-1920x1080.png` | Aufschlüsselung, Posten Tageskarten mit Ereignis-Hinweis in der Quelle |
| `runde3-aufschluesselung-medaillen-2560x1440.png` | Aufschlüsselung, Filter Neu, Posten Medaillen · Farb-Meister |
| `runde3-abrechnung-derby-1920x1080.png` | Spieltags-Abrechnung Spieltag 9: Ticketzeile mit Derby ×1,7 und Zuschlag |
| `runde3-phone-412x900.png` | Nebenprobe Phone |

Geprüft in Chromium unter `flock /tmp/oly-aufnahme.lock`: keine JS-Fehler in allen Aufnahmen und in den übrigen Reitern
(Übersicht, Hebel, Budgets, Stimmung & Tickets, Merch); kein Seitenscroll und kein inneres Scrollen in Saisonwahl,
Aufschlüsselung und Abrechnung bei 2560×1440, 1920×1080 und 1710×1112; kein abgeschnittener Text in den neuen Karten. Bei
1080 und 1112 px Höhe entfällt in den Karten Arena und Medaillen der erklärende Fußtext. Unverändert aus den Vorrunden: der
Reiter Budgets scrollt bei 1920×1080 innen, und die Herkunfts-Marke der Abrechnung kürzt lange Texte.

### g.6 Offene Fragen an Chris

| # | Frage | Empfehlung |
|---:|---|---|
| 1 | Medaillen und Farb-Meister aus dem Rangprämien-Topf (Sponsor zahlt gleich viel, verteilt anders) oder obendrauf (+52 C je Saison)? | **Aus dem Topf.** Die Auszahlung bleibt gleich; nur wer sie bekommt, ändert sich leicht. |
| 2 | Dauerkarten: eine Stufe für alle Platzarten oder je Platzart eine? | **Eine.** Drei Regler für dieselbe Wette wären Mikromanagement. |
| 3 | Tickets ohne Gegenposten lassen die Kassen um 9 bis 18 C je Team und Saison wachsen, solange Ausrüstung und Verpflegung nicht gebaut sind. Zusammen bauen oder die Preise bei 70 % starten? | **Zusammen bauen.** Sonst zuerst 70 % und mit dem Bau der Ausgaben auf 100 %. |
| 4 | Startbudget-Aufschlag: Die Spreizung steigt von 1,91 auf 2,14, zusammen mit den Tickets doppelt. Erst messen? | **Ja, Messvariante.** Wenn es nur um mehr Geld im Draft geht: +51 C für alle hätte dieselbe Summe und senkt das Verhältnis auf 1,70. |

---

## (h) Runde 4: Arena-Ausbau von Hand in Schritten (Chris 22.11.)

Chris, 22.11., wörtlich: „Beim Stadionausbau hätte ich gerne dass man manuell in 1k-Schritten die 3 Bereiche ausbauen kann und
dass man klar sieht welche Stufe von was kostet X und bringt ca. Y wenn die Fans auch kommen.“

**Was sich ändert:** Die drei festen Bauteile aus g.2 (Stehtribüne +6.000, Sitzrang +4.500, Logenring +800, höchstens fünf
Stufen) entfallen. Stattdessen baut der Manager jeden der drei Bereiche einzeln und in kleinen Schritten aus. **Was bleibt:**
die Grundarena mit 4.000 Plätzen (3.000 Steh, 1.000 Sitz, keine Logen), die Preise je Platzart, Auslastungsregeln, Fanbasis,
Dauerkarten, Ticketpreis-Stufen, Ereignisse und der Zuschlag bei ausverkauftem Haus.

### h.1 Die Schritte

| Bereich | Ein Schritt | Grundarena | Obergrenze | Bau je Schritt | Unterhalt je Schritt und Saison | volles Haus je Schritt und Saison, Liga 2 · Liga 1 |
|---|---:|---:|---:|---|---:|---:|
| **Stehplatz** | +1.000 | 3.000 | 15.000 (12 Schritte) | 1. bis 6. Schritt 2,0 C · 7. bis 12. Schritt 2,4 C | 0,15 C | 0,6 · 0,8 C |
| **Sitzplatz** | +1.000 | 1.000 | 10.000 (9 Schritte) | 1. bis 5. Schritt 4,5 C · 6. bis 9. Schritt 5,4 C | 0,25 C | 1,2 · 1,6 C |
| **Loge** | **+100** | 0 | 1.200 (12 Schritte) | 1. bis 6. Schritt 3,2 C · 7. bis 12. Schritt 3,9 C | 0,12 C | 0,6 · 0,8 C |

**Warum Logen in 100er-Schritten:** Ein Logenplatz kostet das Zehnfache eines Stehplatzes (6,0 gegen 0,6 C je 1.000 Plätze
und Saison in Liga 2). 1.000 Logenplätze wären mehr als der ganze Logenring aus Runde 3 (800), würden 32 C kosten und 6 C je
Saison bringen: ein einziger Klick so groß wie zehn Stehplatz-Schritte, und kaum ein Team bekäme sie voll. 100 Logenplätze
bringen dagegen genauso viel wie 1.000 Stehplätze. Damit ist **ein Schritt in jedem Bereich ungefähr gleich viel Geld**, und
die drei Regler fühlen sich gleich an.

**Die Staffel ersetzt den Aufschlag „+20 % je weiteres Bauteil“.** Die zweite Hälfte jedes Bereichs kostet 20 % mehr. Die
Summen sind so gewählt, dass die Arena aus Runde 3 fast dasselbe kostet: 15.000 Steh, 10.000 Sitz und 800 Logen stehen jetzt
für 97,5 C (Runde 3: 96,4 C) bei 5,0 C Unterhalt (5,0 C). Die Balance-Tabellen in g.2 gelten deshalb weiter.

- Mehrere Schritte auf einmal sind erlaubt, auch in mehreren Bereichen. Es gibt keine Stufen 1 bis 5 mehr und keine
  Reihenfolge.
- Bezahlt wird aus dem Investitionstopf, hart gegen die Vorstands-Freigabe, für Mensch und KI gleich. Die neuen Plätze
  zählen ab dem nächsten Heimspiel.
- **Kein Rückbau.** Der Minus-Knopf nimmt nur einen geplanten, noch nicht beauftragten Schritt zurück.
- Der Unterhalt läuft je Spieltag (1/20), auch wenn die Plätze leer bleiben.

### h.2 Die Ausbau-Leitern

„Schritt bringt netto“ und „bezahlt nach“ gelten, **wenn die neuen Plätze voll werden**, nach Unterhalt.

**Stehplatz** (ein Schritt = +1.000 Plätze, Preis 0,6 · 0,8 C je 1.000 Plätze und Saison)

| Schritt | Plätze danach | Bau | Bau gesamt | Unterhalt gesamt | volles Haus in diesem Bereich, Liga 2 · Liga 1 | Schritt bringt netto | Schritt bezahlt nach |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 | 3.000 | – | – | – | 1,8 · 2,4 C | – | – |
| 1 | 4.000 | 2,0 C | 2,0 C | 0,15 C | 2,4 · 3,2 C | +0,45 · +0,65 C | 4,4 · 3,1 Saisons |
| 2 | 5.000 | 2,0 C | 4,0 C | 0,30 C | 3,0 · 4,0 C | +0,45 · +0,65 C | 4,4 · 3,1 Saisons |
| 3 | 6.000 | 2,0 C | 6,0 C | 0,45 C | 3,6 · 4,8 C | +0,45 · +0,65 C | 4,4 · 3,1 Saisons |
| 4 | 7.000 | 2,0 C | 8,0 C | 0,60 C | 4,2 · 5,6 C | +0,45 · +0,65 C | 4,4 · 3,1 Saisons |
| 5 | 8.000 | 2,0 C | 10,0 C | 0,75 C | 4,8 · 6,4 C | +0,45 · +0,65 C | 4,4 · 3,1 Saisons |
| 6 | 9.000 | 2,0 C | 12,0 C | 0,90 C | 5,4 · 7,2 C | +0,45 · +0,65 C | 4,4 · 3,1 Saisons |
| 7 | 10.000 | 2,4 C | 14,4 C | 1,05 C | 6,0 · 8,0 C | +0,45 · +0,65 C | 5,3 · 3,7 Saisons |
| 8 | 11.000 | 2,4 C | 16,8 C | 1,20 C | 6,6 · 8,8 C | +0,45 · +0,65 C | 5,3 · 3,7 Saisons |
| 9 | 12.000 | 2,4 C | 19,2 C | 1,35 C | 7,2 · 9,6 C | +0,45 · +0,65 C | 5,3 · 3,7 Saisons |
| 10 | 13.000 | 2,4 C | 21,6 C | 1,50 C | 7,8 · 10,4 C | +0,45 · +0,65 C | 5,3 · 3,7 Saisons |
| 11 | 14.000 | 2,4 C | 24,0 C | 1,65 C | 8,4 · 11,2 C | +0,45 · +0,65 C | 5,3 · 3,7 Saisons |
| 12 | 15.000 | 2,4 C | 26,4 C | 1,80 C | 9,0 · 12,0 C | +0,45 · +0,65 C | 5,3 · 3,7 Saisons |

**Sitzplatz** (ein Schritt = +1.000 Plätze, Preis 1,2 · 1,6 C je 1.000 Plätze und Saison)

| Schritt | Plätze danach | Bau | Bau gesamt | Unterhalt gesamt | volles Haus in diesem Bereich, Liga 2 · Liga 1 | Schritt bringt netto | Schritt bezahlt nach |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 | 1.000 | – | – | – | 1,2 · 1,6 C | – | – |
| 1 | 2.000 | 4,5 C | 4,5 C | 0,25 C | 2,4 · 3,2 C | +0,95 · +1,35 C | 4,7 · 3,3 Saisons |
| 2 | 3.000 | 4,5 C | 9,0 C | 0,50 C | 3,6 · 4,8 C | +0,95 · +1,35 C | 4,7 · 3,3 Saisons |
| 3 | 4.000 | 4,5 C | 13,5 C | 0,75 C | 4,8 · 6,4 C | +0,95 · +1,35 C | 4,7 · 3,3 Saisons |
| 4 | 5.000 | 4,5 C | 18,0 C | 1,00 C | 6,0 · 8,0 C | +0,95 · +1,35 C | 4,7 · 3,3 Saisons |
| 5 | 6.000 | 4,5 C | 22,5 C | 1,25 C | 7,2 · 9,6 C | +0,95 · +1,35 C | 4,7 · 3,3 Saisons |
| 6 | 7.000 | 5,4 C | 27,9 C | 1,50 C | 8,4 · 11,2 C | +0,95 · +1,35 C | 5,7 · 4,0 Saisons |
| 7 | 8.000 | 5,4 C | 33,3 C | 1,75 C | 9,6 · 12,8 C | +0,95 · +1,35 C | 5,7 · 4,0 Saisons |
| 8 | 9.000 | 5,4 C | 38,7 C | 2,00 C | 10,8 · 14,4 C | +0,95 · +1,35 C | 5,7 · 4,0 Saisons |
| 9 | 10.000 | 5,4 C | 44,1 C | 2,25 C | 12,0 · 16,0 C | +0,95 · +1,35 C | 5,7 · 4,0 Saisons |

**Loge** (ein Schritt = +100 Plätze, Preis 6,0 · 8,0 C je 1.000 Plätze und Saison)

| Schritt | Plätze danach | Bau | Bau gesamt | Unterhalt gesamt | volles Haus in diesem Bereich, Liga 2 · Liga 1 | Schritt bringt netto | Schritt bezahlt nach |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 | 0 | – | – | – | 0,0 · 0,0 C | – | – |
| 1 | 100 | 3,2 C | 3,2 C | 0,12 C | 0,6 · 0,8 C | +0,48 · +0,68 C | 6,7 · 4,7 Saisons |
| 2 | 200 | 3,2 C | 6,4 C | 0,24 C | 1,2 · 1,6 C | +0,48 · +0,68 C | 6,7 · 4,7 Saisons |
| 3 | 300 | 3,2 C | 9,6 C | 0,36 C | 1,8 · 2,4 C | +0,48 · +0,68 C | 6,7 · 4,7 Saisons |
| 4 | 400 | 3,2 C | 12,8 C | 0,48 C | 2,4 · 3,2 C | +0,48 · +0,68 C | 6,7 · 4,7 Saisons |
| 5 | 500 | 3,2 C | 16,0 C | 0,60 C | 3,0 · 4,0 C | +0,48 · +0,68 C | 6,7 · 4,7 Saisons |
| 6 | 600 | 3,2 C | 19,2 C | 0,72 C | 3,6 · 4,8 C | +0,48 · +0,68 C | 6,7 · 4,7 Saisons |
| 7 | 700 | 3,9 C | 23,1 C | 0,84 C | 4,2 · 5,6 C | +0,48 · +0,68 C | 8,1 · 5,7 Saisons |
| 8 | 800 | 3,9 C | 27,0 C | 0,96 C | 4,8 · 6,4 C | +0,48 · +0,68 C | 8,1 · 5,7 Saisons |
| 9 | 900 | 3,9 C | 30,9 C | 1,08 C | 5,4 · 7,2 C | +0,48 · +0,68 C | 8,1 · 5,7 Saisons |
| 10 | 1.000 | 3,9 C | 34,8 C | 1,20 C | 6,0 · 8,0 C | +0,48 · +0,68 C | 8,1 · 5,7 Saisons |
| 11 | 1.100 | 3,9 C | 38,7 C | 1,32 C | 6,6 · 8,8 C | +0,48 · +0,68 C | 8,1 · 5,7 Saisons |
| 12 | 1.200 | 3,9 C | 42,6 C | 1,44 C | 7,2 · 9,6 C | +0,48 · +0,68 C | 8,1 · 5,7 Saisons |

**Voll ausgebaut** (26.200 Plätze): 113,1 C Bau, 5,49 C Unterhalt je Saison, volles Haus 28,2 C (Liga 2) bzw. 37,6 C
(Liga 1). Gegenüber der Grundarena bezahlt nach 5,7 bzw. 4,0 Saisons bei vollem Haus.

### h.3 „Bringt ca. Y, wenn die Fans kommen“

Mehr Plätze bringen nur Geld, wenn mehr Leute kommen wollen, als hineinpassen. Die Vorschau rechnet deshalb zwei Zahlen:

    Erwartet  = (min(Plätze neu, Nachfrage) − min(Plätze alt, Nachfrage)) × Preis × 10 Heimspiele − Unterhalt
    Voll      = neue Plätze × Preis × 10 Heimspiele − Unterhalt

- **Nachfrage** je Bereich ist der Schnitt der letzten drei Heimspiele aus der Regel in g.2 (Fanbasis × Stimmung ×
  Preisfaktor × Ereignis, aufgeteilt auf Stehen und Sitzen; Logen aus Sponsor-Stufe und Tabellenplatz). Bei ausverkauftem
  Bereich zählt der Überhang mit, der sonst abgewiesen wurde.
- Ist ein Bereich nicht ausverkauft, ist „Erwartet“ für ihn **negativ** (nur Unterhalt), und „Bezahlt nach“ zeigt „nie“.
  Der Fuß der Karte sagt dann, welcher Bereich nicht voll ist.
- **Fan-Maximum:** Die Fanbasis endet bei 1,5 × (Steh- + Sitzplätze). Die Karte zeigt Fanbasis, Maximum und das Maximum nach
  dem geplanten Ausbau. Wer am Maximum hängt, muss bauen, damit die Fanbasis weiter wachsen kann; wer weit darunter liegt,
  braucht zuerst Stimmung und Erfolg.
- Im ersten Jahr rechnet die Vorschau nicht mehr pauschal mit 60 %, sondern mit der gemessenen Nachfrage.

Beispiel des Mockups (Vigilante Wranglers, Liga 2, 9.000 Steh · 5.000 Sitz · 900 Logen, nach Spieltag 12): Stehplätze zu
98 % voll, Nachfrage rund 10.700. Zwei Schritte Stehplatz (7. und 8., je 2,4 C) kosten 4,8 C, bringen voll +0,9 C und erwartet
+0,7 C je Saison, bezahlt nach rund 6,5 Saisons (voll 5,5; in Liga 1 3,5). Zwei Schritte Loge bei 75 % Auslastung kosten
7,8 C und bringen erwartet −0,2 C: „nie“.

### h.4 Vorstand, KI, Mehrspieler

- **Empfehlung des Vorstands** je Bereich wie bisher ab 90 % Auslastung über drei Heimspiele, unter 60 % rät er ab (Warnung,
  keine Sperre). Neu nennt er die Zahl der Schritte, die der Überhang füllt.
- **KI:** plant nur in Bereichen mit Empfehlung, so viele Schritte, wie der Überhang füllt, höchstens drei je Bereich und
  Saison, und nur, wenn „Erwartet“ den Bau in höchstens sechs Saisons bezahlt. In Liga 2 sind das Steh- und Sitzplätze,
  Logen erst mit Erfolg und großem Sponsor.
- **Mehrspieler:** Der Plan liegt je Team im Spielstand, delegierbar im Bereich Gebäude; geschrieben wird über den
  vorhandenen Gebäude-Weg hinter `authorizeServerRoomWrite`. Die Arena fremder Teams (Plätze je Bereich) ist sichtbar.
- **Dauerkarten** zählen weiter als Anteil aller Plätze; neue Plätze mitten in der Saison gehen nur in die Tageskasse.

### h.5 Mockup, Runde 4

`public/mockups/finanzen-modern-18-11.html?ansicht=wahl` (neuer Schalter `&plan=<Steh>,<Sitz>,<Loge>` für geplante Schritte;
`&bau=` entfällt):

- **Karte „Arena · Ausbau von Hand“:** je Bereich Plätze, Auslastung mit der 90-%-Marke und ein Regler mit Minus und Plus
  (+1.000, bei Logen +100). Darunter **Kostet** (Schritte und Schrittpreis), **Bringt ca.** (erwartet, daneben volles Haus)
  und **Bezahlt nach** (erwartet, daneben volles Haus und Liga 1). Ab 1250 px Höhe zusätzlich Nachfrage je Bereich und
  Fan-Maximum. Der Fuß nennt die Empfehlung oder warnt, wenn ein geplanter Bereich nicht voll ist. Tooltip je Bereich: die
  ganze Staffel.
- **Tabelle „Ausbau-Leiter je Bereich“** (ab 1250 px Höhe): Schritt, Staffelpreis, Unterhalt, volles Haus, netto,
  Amortisation, gebaut und Obergrenze; dazu die Zeilen „Dein Plan“ und „Voll ausgebaut“.

| Mockup-Feature aus Chris' Rückmeldung | Stand |
|---|---|
| Drei Bereiche von Hand ausbauen | drin (Plus und Minus je Bereich, klickbar) |
| 1.000er-Schritte | drin für Steh und Sitz; Logen in 100ern (Begründung h.1) |
| Klar sehen: Stufe kostet X | drin (Zeile Kostet, Tooltip, Leiter-Tabelle; alle Schritte in h.2) |
| Bringt ca. Y, wenn die Fans kommen | drin (erwartet aus der Nachfrage, daneben volles Haus) |
| Hinweis Kapazität und Fan-Maximum | drin (Warnung im Fuß; Nachfrage und Fan-Maximum ab 1250 px Höhe, sonst im Tooltip) |

Das Beispielteam hat jetzt 14.900 Plätze (9.000 Steh, 5.000 Sitz, 900 Logen) statt 15.300; das volle Haus bleibt bei 1,68 C
je Heimspiel, alle anderen Reiter rechnen unverändert. Die Nachfrage über 90 % Auslastung ist im Mockup aus der Auslastung
geschätzt, die Fanbasis (16.400) ist ein fester Beispielwert.

| Datei (`docs/design/finanzen-posten-22-11/`) | Zeigt |
|---|---|
| `runde4-saisonwahl-ausbau-1920x1080.png` | nach Spieltag 12, zwei Schritte Stehplatz geplant, Vorstand empfiehlt |
| `runde4-saisonwahl-stehplatz-2560x1440.png` | nach Spieltag 15, drei Schritte Stehplatz, Leiter-Tabelle sichtbar |
| `runde4-saisonwahl-ausbau-leiter-2560x1440.png` | nach Spieltag 13, Plan in allen drei Bereichen, Warnung „Sitzplätze nicht voll“ |
| `runde4-saisonwahl-logen-1710x1112.png` | zwei Schritte Loge bei 75 % Auslastung: „nie“ |
| `runde4-phone-412x900.png` | Nebenprobe Phone |

Geprüft in Chromium unter `flock /tmp/oly-aufnahme.lock`: keine JS-Fehler in der Saisonwahl und in den übrigen Reitern
(Übersicht, Abrechnung, Aufschlüsselung, Hebel, Budgets, Fans & Arena, Merch); Plus und Minus per Klick getestet; kein
Seitenscroll und kein inneres Scrollen der Arena-Karte bei 2560×1440, 1920×1080 und 1710×1112. Unverändert aus den Vorrunden:
der Reiter Budgets scrollt bei 1920×1080 innen, und bei 1710×1112 läuft die Trainingslager-Karte 6 px über.

### h.6 Offene Fragen an Chris

| # | Frage | Empfehlung |
|---:|---|---|
| 1 | Logen in 100er-Schritten statt 1.000ern, Obergrenze 1.200? | **Ja.** Ein Schritt ist dann in allen drei Bereichen etwa gleich viel Geld (0,6 C je Saison in Liga 2). |
| 2 | Obergrenzen 15.000 · 10.000 · 1.200 (zusammen 26.200), oder offen nach oben? | **Mit Obergrenze.** Sie hält das Ziel „volle Top-Arena = ein Viertel der Einnahmen“. Offen wäre möglich, wenn die Staffel weiter steigt. |
