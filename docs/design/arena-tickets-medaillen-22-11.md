# Arena-Einnahmen und Disziplin-Medaillen: Bau und Messung (22.11.)

Vorlage: `docs/design/finanzen-posten-22-11.md` (f.1, f.2, g.1 bis g.3, h, i.1). Mockup `public/mockups/finanzen-modern-18-11.html`, von Chris freigegeben.
Nicht angefasst: Startbudget-Staffel (g.4), Ausrüstung. Rückweg-Schalter und Regel-Stempel wie bei Marketing.

## Gebaut

| Baustein | Stelle |
|---|---|
| Rechnung (Platzarten, Nachfrage, Tageskasse, Dauerkarten, Ausbau-Leiter, „kostet / bringt ca.“) | `lib/arena/arena-modell.ts` (rein, client-sicher) |
| Regel-Stempel `seasonState.arenaRegel`, `OLY_ARENA` (`aus`, `aus-sofort`), Abbildung des alten Gebäudes | `lib/arena/arena-regel.ts` |
| Arena-Stand je Team (`seasonState.arena`): Plätze, Fanbasis, Stimmung, Dauerkarten, Heimspiele, Ausbau; Ereignisse je Heimspiel; Buchung | `lib/arena/arena-stand.ts` |
| Ausbau von Hand: ein Schreibweg, Kasse, Obergrenzen, harte Vorstands-Freigabe (`pruefeGebaeudeGegenVorstandFreigabe`), Gebäude-Ereignis im Investitionstopf | `lib/arena/arena-ausbau.ts`, `app/api/arena/route.ts` (`arena_update` über `authorizeServerRoomWrite`) |
| KI-Ausbau nach denselben Regeln, beim Spieltagsabschluss | `lib/arena/arena-ki.ts`, `lib/season/matchday-progress-service.ts` |
| Altes Gebäude „Arena Upgrade“ zahlt nichts, kostet nichts, ist nicht mehr ausbaubar; Unterhalt je Ausbau-Schritt | `lib/arena/arena-gebaeude.ts`, `facility-season-end-service.ts`, `season-end-guv.ts`, `facility-upgrade-service.ts` |
| Ticket-Einnahmen und Dauerkarten je Spieltag im Ledger (`tickets`, `dauerkarten`), Kontoauszug, Erwartung, GuV-Posten „Ticket-Einnahmen“ | `lib/finance/finanzen-je-spieltag*.ts`, `kontoauszug.ts`, `season-end-guv.ts`, `lib/arena/arena-guv.ts` |
| Regel-Stempel `seasonState.medaillenRegel`, `OLY_MEDAILLEN`, Topf-Abzug | `lib/medaillen/medaillen-regel.ts` |
| Medaillen, Farb-Meister, Geld, Moral; Buchung am Saisonende (idempotent) | `lib/medaillen/medaillen-modell.ts`, Haken in `applySponsorSettlement` |
| Wertung der Medaillen = die der Leaders-Seite (`medaillenTabelle`, `medaillenPlaetze` in `lib/foundation/leaders-modern.ts`, daraus baut auch die Hochrechnung) | `lib/foundation/leaders-modern.ts` |
| Moral-Grund „Medaillen“ | `lib/morale/player-morale-service.ts` |
| Seite: Reiter „Arena & Fans“ (eigene Komponente), Schreibweg `onArenaAktion` | `app/foundation/finances/ArenaAnsicht.tsx`, `arena-ansicht.css` |
| Tests | `tests/arena-tickets-medaillen.test.ts` (22) |
| Messung | `scripts/auswerte-arena-tickets-medaillen.ts` (Eingabe: `scripts/miss-teamfinanzen-saison.ts`) |

Regeln im Spielstand: neues Spiel ab Saison 1, bestehender Spielstand ab dem nächsten Saisonwechsel (Lade-Migration schreibt „aus“ für die laufende Saison). Jeder
Rechenweg fragt `arenaAktiv(gameState)` bzw. `medaillenAktiv(gameState)`. Die Variablen gelten nur auf dem Server (compose + `.env.example`).

## Entscheidungen des PM, wie umgesetzt

- Medaillen und Farb-Meister aus dem Rangprämien-Topf: jede Sponsor-Rangprämie sinkt um 8,4 % (`rangAbzug` im Stempel, `rangPraemieFaktor`), im Rang-Abschlag je Spieltag und
  in der Zeile „Tabellenplatz“ des Saisonendes. Das Angebot des Sponsors zeigt weiter den Bruttowert.
- Eine Dauerkarten-Stufe (20 / 40 / 60 %, Rabatt 25 %) für alle Platzarten.
- Ticketpreise fest bei 100 %, keine Preisstufen.
- Logen in 100er-Schritten, Obergrenzen 15.000 / 10.000 / 1.200; Bau und Unterhalt aus i.1.
- Pod-Disziplinen (Mini-DM, Takeshi, Staffel, Battlefield) werden nach der Summe des Verhältnisses gewertet, über `leaders-modern.ts`. Gleichstand: Verhältnis, PP-Summe, sonst
  geteilte Medaille mit halbiertem Geld (der Leaders-Modell-Code zeigt dasselbe).
- Moral nur für Spieler mit Ehrgeiz-/Ruhm-Trait (`Ambitious`, `FanFavorite`, `FiredUp`, `Motivated`, `Diva`, `Egomaniac`; Diva und Egomaniac nur, wenn sie der beste Spieler des Teams in der
  Disziplin waren), Gold +6 / Silber +4 / Bronze +2, höchstens +10; `Mercenary`/`Gambler` +2 je Medaille nur mit eingeschalteter Siegprämie. Die Vergabe wirkt in der laufenden und der Folgesaison.

## Abbildung des bestehenden Stadions beim Umstieg

Der erste Stempel „an“ eines alten Spielstands trägt `umstieg: true`. Die erste Arena jedes Teams wird aus der Stufe des Gebäudes „Arena Upgrade“ abgebildet; Bau ist bezahlt, nichts wird erstattet.

| Stufe | Steh | Sitz | Loge | Plätze |
|---:|---:|---:|---:|---:|
| 0 | 3.000 | 1.000 | 0 | 4.000 |
| 1 | 6.000 | 2.000 | 0 | 8.000 |
| 2 | 8.000 | 3.000 | 0 | 11.000 |
| 3 | 10.000 | 5.000 | 100 | 15.100 |
| 4 | 13.000 | 7.000 | 400 | 20.400 |
| 5 | 15.000 | 10.000 | 1.200 | 26.200 |

Die Fanbasis startet dort bei mindestens dem halben Fan-Maximum × Beliebtheit, damit die geerbte Arena sich füllen kann. Neues Spiel: Grundarena, Fanbasis 5.000 × Beliebtheit.

## Abweichungen vom Konzept (angepasst)

- **Fan-Stimmung** (Finanzkonzept V2 war nicht gebaut): Ergebnis des Spieltags aus den Tabellenpunkten (2:0 = +4, 1:1 = 0, 0:2 = −4, Heimspiel × 1,5), Serie ab drei, Rückzug zur Mitte, Saisonübertrag 50 + 0,5 × (S − 50), Rang 1 +10, Abstiegsplatz −10. Ohne Preis, Stars und Transfers.
- **Logen** füllen sich anteilig (20 % + 40 % Sponsor-Stufe + 40 % Tabellenplatz): „bringt ca.“ zeigt für Logen deshalb nie „nie“ bei Auslastung ab 20 %, aber lange Amortisationszeiten bei kleinen Sponsoren.
- **Dauerkarten** werden mit der Wahl sofort gutgeschrieben (Kontoauszug „Dauerkarten“); wer nicht wählt, bekommt am Abschluss von Spieltag 1 „Wenig“ (Mensch) bzw. die KI-Wahl (KI und delegierte Teams) im Ledger.
- **Ereignisse** (g.3) gebaut: Derby (Intensität 2 bis 5), Spitzenspiel, Tabellenführer zu Gast, Eröffnung, Finale, Abstiegskampf, Serien, Feiertag, Unwetter, Streik (ligaweit, gewürfelt aus der Saat im Stempel, gelten für das nächste Heimspiel jedes Teams). Es **fehlen** Star-Debüt und Skandal/Fan-Boykott (brauchen Zugangs- und Skandal-Ereignisse, die es noch nicht gibt).
- **KI** rechnet am Fan-Maximum mit einem Saison Fan-Wachstum (höchstens +22 %) bis zum neuen Maximum. Ohne das baut sie nie, weil bei voller Fanbasis ein Schritt allein keine neuen Besucher bringt (gefunden in Messung 1: 8 Ausbauten, danach 19).
- Ausbau ist in jeder Phase außer der Saisonabrechnung erlaubt (die Plätze zählen ab dem nächsten gebuchten Heimspiel).

## Messung (32 KI-Teams von Anfang an, 2 Saisons, 2 Saaten)

Skript `scripts/auswerte-arena-tickets-medaillen.ts` über zwei Läufe von `scripts/miss-teamfinanzen-saison.ts`. Saat 1 lief mit dem ersten KI-Stand (nur Sitzplätze, kein Fan-Wachstum
in der Rechnung), Saat 2 mit dem endgültigen. Die Schere ist ohne Arena nicht neu gemessen (Marketing-Messung: Verhältnis 1,24 bis 1,27 in Saison 1).

| Saison | Saat | Tickets L1 / L2 je Team | Ausbau-Ausgaben je Team | Teams GuV ≥ 0 | Einnahmen L1 : L2 | GuV-Abstand reiche 8 − arme 8 | Medaillen-Geld je Team | Auslastung Ø |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | 1 | 4,6 / 3,2 | 0,5 C | 28 | 1,25 | 11,8 | 1,62 | 97 % |
| 1 | 2 | 5,1 / 3,5 | 1,9 C | 25 | 1,26 | 20,7 | 1,63 | 91 % |
| 2 | 1 | 4,9 / 3,2 | 0,5 C | 31 | 1,40 | 6,6 | 1,62 | 92 % |
| 2 | 2 | 5,2 / 3,5 | 0,2 C | 31 | 1,19 | 1,0 | 1,63 | 86 % |

Lesart:
- Medaillen: 1,6 C je Team = 52 C je Saison wie im Konzept (Variante B), kein Team über dem Deckel.
- Die Grundarena ist fast immer voll (Tickets nahe am vollen Haus 4,0 / 3,0 C). Nach zwei Saisons stehen im Mittel 5.300 Plätze (Maximum 8.000): das Ziel „volle Top-Arena = ein Viertel der Einnahmen“ ist
  rechnerisch erreichbar (volle Arena Liga 1 37,6 C gegen rund 100 C Sponsor = 27 %), nach zwei Saisons aber nicht erreicht (Ticket-Anteil der Spitze 4 %), weil die Fanbasis nur 22 % je Saison wächst und die KI höchstens drei Schritte je Bereich baut.
- Ticket-Einnahmen Liga 1 : Liga 2 = 1,45 (Preisfaktor 4/3 plus größere Fanbasis); der absolute Abstand beträgt 1,5 C je Team. Die Einnahmen-Schere ändert sich damit nicht nennenswert
  (1,19 bis 1,40 in Saison 2, Streuung der Saat größer als der Effekt). Die Konzept-Zahl „Steh und Sitz zahlen sich in Liga 2 in 1,5 bis 2,5 Saisons“ ist im Test geprüft.
- Messung über drei Saisons: siehe Abschnitt „KI baut schneller“. Offen: ein A/B-Lauf ohne Arena für die Schere (nicht gemessen).

## KI baut schneller (Chris, 23.11.) und Messung über drei Saisons

Änderung in `lib/arena/arena-ki-bewertung.ts` (alt → neu):

| Regel | alt | neu |
|---|---|---|
| Schritte je Bereich und Saison (`KI_MAX_SCHRITTE_JE_BEREICH_UND_SAISON`) | 3 | 6 |
| Amortisation mit „Erwartet“ (`KI_MAX_BEZAHLT_SAISONS`) | höchstens 4 Saisons | höchstens 8 |
| Empfehlung ab Auslastung der letzten drei Heimspiele (`KI_EMPFEHLUNG_AUSLASTUNG`) | 90 % | 85 % |
| Schritte nach Überhang der Nachfrage | von heute | der nächsten Saison (× `KI_VORAUS_FAKTOR` = 1,22) |
| Fanbasis in der Bewertung | nur am Fan-Maximum +22 % | bei vollem Haus (Steh + Sitz ≥ 85 %) immer bis +22 %, gedeckelt am Fan-Maximum der Plätze; der Gewinn zählt nur den Ausbau (`fanbasisOhneAusbau` in `ausbauVorschau`, die Seite des Menschen rechnet unverändert) |

Dieselben Regeln gelten für Mensch und KI: `bauArenaAus` prüft Kasse, Obergrenzen und die harte Vorstands-Freigabe aus dem Investitionstopf, die Rücklage nach Finanzwert bleibt
(`freiesGeldNachRuecklage`). Kein Team baut sich in die Pleite: ein Schritt kostet 0,9 bis 2,4 C bei 0,1 bis 0,2 C Unterhalt.

Messung: 32 KI-Teams von Anfang an, `scripts/auswerte-arena-ki-saisons.ts` über Läufe von `scripts/miss-teamfinanzen-saison.ts --seasons 3`. Top-4 = die vier Teams der Liga mit der höchsten Fanbasis.
„alt“ = Stand vor der Änderung, „Stufe 1“ = nur Grenzen (6 Schritte, 8 Saisons, 85 %, Vorausnachfrage), „neu“ = zusätzlich die Fanbasis-Prognose.
Die Messung ist **kleiner als verlangt**: ein Lauf je Stand; „neu“ liegt nur für zwei Saisons vor (der Lauf ist in Saison 3 vom Speicherdruck anderer Prozesse abgebrochen worden, der Wiederholungslauf an einer vollen Platte).

| Saison | Stand | Plätze Ø Liga 1 / 2 | Plätze Top-4 Liga 1 / 2 | Ticket-Anteil Top-4 / alle | Teams GuV ≥ 0 | GuV-Abstand reich 8 − arm 8 | Kasse < 0 |
|---|---|---:|---:|---:|---:|---:|---:|
| 1 | alt | 5.000 / 4.313 | 5.500 / 5.250 | 5 % / 4 % | 26 | 7,5 | 0 |
| 1 | Stufe 1 | 5.250 / 4.688 | 5.500 / 6.500 | 5 % / 4 % | 26 | 17,6 | 0 |
| 1 | neu | 5.438 / 5.250 | 6.000 / 6.000 | 7 % / 5 % | 23 | −1,2 | 0 |
| 2 | alt | 5.375 / 4.625 | 5.250 / 5.500 | 5 % / 5 % | 30 | −7,5 | 0 |
| 2 | Stufe 1 | 5.250 / 4.938 | 5.250 / 5.500 | 6 % / 5 % | 28 | −9,5 | 1 |
| 2 | neu | 5.938 / 5.313 | 6.250 / 6.000 | 6 % / 5 % | 29 | 2,4 | 0 |
| 3 | alt | 6.000 / 5.250 | 6.750 / 6.250 | 6 % / 5 % | 30 | 0,4 | 1 |
| 3 | Stufe 1 | 5.438 / 5.250 | 6.500 / 6.000 | 6 % / 5 % | 31 | 9,6 | 1 |

Lesart, ehrlich:
- Die Lockerung bringt etwas (Saison 2: Liga 1 im Mittel 5.375 → 5.938, Top-4 5.250 → 6.250), aber **nicht** die Größenordnung des Richtwerts (Top-4 Liga 1 nach drei Saisons 12.000 bis 18.000 Plätze).
  Der Richtwert ist mit dem heutigen Fan-Modell nicht erreichbar, auch nicht mit einer KI, die beliebig schnell baut:
  die Fanbasis wächst nur bei mindestens 90 % Auslastung mit +2 % je Heimspiel (höchstens +22 % je Saison) und wuchs in der Messung bei den Spitzenteams um rund 5 bis 12 % je Saison
  (6.700 → 7.000 → 8.500 in drei Saisons). Die Nachfrage beträgt nur etwa das 0,7-fache der Fanbasis (Stimmung 40 bis 60). Wer mehr Plätze baut, als die Nachfrage füllt, fällt unter 90 %,
  und die Fanbasis wächst nicht mehr. Plätze folgen deshalb der Fanbasis, nicht umgekehrt: für 12.000 Plätze wären rund 15.000 Fans nötig.
- Ticket-Anteil der Spitze bleibt bei 5 bis 7 %, das Konzeptziel „volle Top-Arena ≈ ein Viertel der Einnahmen“ ist damit nach drei Saisons nicht erreicht.
- Wer bauen will, scheiterte vor allem an „zahlt sich nicht aus“ (Messlog: Sitzplätze, Stufe 1), weil bei Fanbasis unter dem Maximum zusätzliche Plätze rechnerisch nichts bringen; die Prognose (Fanbasis wächst bis zum Maximum) behebt das.
- Pleiten: höchstens ein Team mit negativer Kasse am Saisonende, in allen Ständen gleich; der Anteil Teams mit GuV ≥ 0 liegt bei 23 bis 31 (Streuung der Saat).
- **Entscheidung für Chris/PM:** soll die Top-Arena nach zwei bis drei Saisons wirklich bei 12.000 bis 18.000 Plätzen stehen, muss das Fan-Modell angefasst werden (Wachstum je Heimspiel, Schwelle 90 %,
  Nachfrage je Fan), nicht die KI. Das ist eine Änderung der Wirtschaftsmechanik und hier bewusst nicht ohne Freigabe gemacht.

## Prüfungen

- `npx tsc -p tsconfig.check.json --noEmit` sauber.
- vitest `tests/finan*`, `guv-*`, `spieltag*`, `saisonende*`, `gebaeude*`, `stadion*`, `sponsor*`, `morale*`, `leaders*`, `marketing*`: 837 grün (2 Dateien übersprungen wie vorher); `tests/arena-tickets-medaillen.test.ts` 22 grün.
- Wertungs-Fingerabdruck: **GESAMT fe1dc086d68d** (unverändert; Arena und Medaillen wirken nur auf Geld und Moral).

- Nach Merge mit main und KI-Änderung (23.11.): vitest `arena-tickets-medaillen*`, `kredit*`, `entwicklung*`, `finan*`, `guv-*`, `spieltag*`, `saisonende*`, `new-game*`, `save-repository-cold*`, `preseason*`, `foundation-nav*`, `foundation-icon-schiene*`, `marketing-bau*`, `sponsor*`: 997 grün, 22 übersprungen; Fingerabdruck GESAMT fe1dc086d68d.
- Aufnahmen 23.11. neu: das Overlay „1 Issue“ kam aus einem 403 der Seite beim Speichern des Flow-Schritts (das Aufnahme-Team gehörte nicht dem Dev-Benutzer); `scripts/screenshot-arena-bau.ts` setzt jetzt Besitz `user_local`, Modus manuell und loggt Konsolenfehler. Die Zeile „Nachfrage“ am Fuß der Karte „Arena · Ausbau von Hand“ (abgeschnitten) ist entfallen (Nachfrage steht im Tooltip des Balkens, Fanbasis/Maximum im Kopf).

## Abgleich Mockup – App (Aufnahmen: `docs/design/arena-tickets-medaillen-22-11/`)

Aufnahmen aus der echten App (Messlauf-Spielstand, Team G-G, Saison 2 nach Spieltag 20, nur Ansicht), Bildpaare „links Mockup, rechts App“:
`vergleich-arena-ausbau-*`, `vergleich-arena-leer-*`, `vergleich-finanzen-guv-*` bei 1920x1080, 2560x1440 und 1710x1112 (Seitenscroll 0, keine JS-Fehler in allen neun Aufnahmen).
Stichprobe über mehrere Disziplinen entfällt: die Seite ist teamweit, nicht je Disziplin.

| Mockup-Merkmal | Stand |
|---|---|
| Karte „Arena · Ausbau von Hand“: je Bereich Plätze, Auslastung mit 90-%-Marke, Regler Minus/Plus (+1.000, Loge +100) | drin |
| Zeilen Kostet / Bringt ca. / Bezahlt nach, „nie“ bei nicht vollem Bereich, Fuß mit Empfehlung oder Warnung, Knopf „Ausbau beauftragen“ | drin |
| Nachfrage je Bereich und Fan-Maximum (vorher/nachher) | drin (ab 1250 px Höhe sichtbar, darunter ausgeblendet wie im Mockup; Tooltip am Balken) |
| Ausbau-Leiter je Bereich | angepasst: eine Zeile je Bereich (erster und zweiter Preisabschnitt, bezahlt nach beide) statt aller zwölf Schritte; Zeile „Voll ausgebaut“ drin; Zeile „Dein Plan“ fehlt (der Plan steht in der Karte) |
| Dauerkarten-Karte (Stufen, Sofort-Geld, Rabatt 25 %) | drin; die Zeilen „Fehlt an der Tageskasse“ und „Bei schwacher Saison“ fehlen (Beispielzahlen des Mockups) |
| Karte „Fans & Heimspiele“ mit Anlass des letzten Heimspiels | angepasst: statt Stimmungsverlauf Textzeilen mit dem letzten gebuchten Heimspiel |
| Medaillenspiegel mit Liga-Tabelle und Farb-Meister-Chips | angepasst: eigene Medaillen, Farb-Meister und Geld; die Hochrechnung der Liga steht unter Leaders |
| Mockup-Steuerung (Lage-Schalter, Phone) | entfällt (nur Mockup) |
| GuV: Posten Ticket-Einnahmen und Medaillen | drin |
| Ticketpreis-Stufen, Merch, Verletzungs-Versicherung, Trainingslager, Kredite | nicht Teil dieses Baus |

Offen nach der Aufnahme: der Rabatt-Hinweis der Dauerkarten ist nach den Aufnahmen von einer leeren Marke auf Klartext umgestellt worden und nicht neu aufgenommen.


## Fan-Modell organisch (Chris 23.11.)

Chris: „12k Plätze war geplant, 12 % Einnahmen ca. Und Fans sollen organisch wachsen oder auch mal weniger werden nach Leistung des Teams, Kauf und Verkauf von Stars — die Anzahl Fans hängt nicht an der Stadiongröße! Starke Teams vielleicht schon etwas größere Stadien, aber ungern 1:1 nach Budget.“

### Regeln (Code: `lib/arena/fan-modell.ts`, Buchung `lib/arena/arena-stand.ts`)

- **Fanbasis hängt nicht am Stadion.** Fan-Maximum (1,5 × Plätze) und das Wachstum nach Auslastung sind entfernt. Das Stadion begrenzt nur die verkauften Tickets; die Nachfrage bleibt Fanbasis × (0,45 + 0,90 × Stimmung / 100).
- **Je Spieltag (kleine Schritte, alle Teams, Heim und Auswärts):** Tabellenpunkte gegen die Erwartung aus der Kaderstärke (Rang der besten sechs nach Rating, 1,3 bis 2,7 erwartete Punkte), Punkte über/unter dem Schnitt von 2, Serien ab drei (± 0,4 %), Rückzug zum Anker (1,1 % der Lücke je Spieltag).
- **Stars:** der Kader von heute wird mit dem gemerkten verglichen (derselbe Weg für Kauf, Verkauf und Vertragsende, Mensch und KI). Stern-Gewicht = ((Marketability − 30) / 70)² × (0,5 + 0,5 × Leistungsperzentil), Wirkung ± Gewicht × 1.200 Fans (Spitzenspieler etwa ± 500). Weniger als 0,05 zählt nicht.
- **Saisonende (größerer Schritt):** Tabellenplatz (± 14 %), Platz gegen Erwartung (± 12 %), Titel oder Farb-Meister (+ 8 %), Aufstieg (+ 8 %), Abstieg (− 8 %). Der Anker folgt der Fanbasis zu 40 %.
- **Schranke:** je Saison höchstens − 15 % bis + 30 % des Saisonstarts (gezeigt = gebucht, die Gründe werden anteilig gekappt).
- **Start (neues Spiel):** 6.500 × (½ Beliebtheits-KPI + ½ Matrix-Beliebtheit `popularity` × 0,12 + 0,45). Bestehender Spielstand: Umstieg wie bisher (halbes Haus × Beliebtheit).
- **Start-Stadion:** Grundarena 4.000 für alle plus 0 bis 3 Schritte à 1.000 (Steh, Sitz, Steh) aus der Mischung 60 % Matrix-Beliebtheit (auf 0..1), 25 % Liga 1, nur 15 % Budget (Rang). Spannweite 4.000 bis 7.000. Starke Teams starten etwas größer, müssen aber weiter bauen; reich allein macht das Stadion nicht größer.
- **KI:** prognostiziert den Fan-Trend (`fanPrognoseFaktor`: Änderung der Saison hochgerechnet, vor Spieltag 5 die der Vorsaison, × 0,7, begrenzt) statt der Auslastung; Überhang, Bewertung und Kosten wie für den Menschen (`bauArenaAus`).
- **Anzeige:** Seite „Arena & Fans“ zeigt Fanbasis und Trend der Saison, die Fanlinie je Spieltag und die Gründe (letzte Änderung, Saison, Vorsaison), z. B. „+ 44 Siege und Punkte, + 13 Ergebnisse über Erwartung“, „− 451 Verkauf Kelektros“.
- Regel-Stempel unverändert (`seasonState.arenaRegel`, Rückweg `OLY_ARENA`); neue Felder am Arena-Stand sind optional (Alt-Stände legen sie beim ersten Buchen an: Anker = Fanbasis, Kader ohne Wirkung).

### Start-Stadion und Start-Fanbasis je Team (Messlauf-Anlage, `scripts/auswerte-arena-start-stadion.ts`)

| Team | Liga | Beliebtheit (Matrix) | Budget | Start-Plätze | Start-Fanbasis |
|---|---|---:|---:|---:|---:|
| M-M | liga1 | 7.08 | 325 | 7000 | 8286 |
| M-S | liga2 | 8.29 | 245 | 6000 | 8758 |
| D-P | liga2 | 8.3 | 240 | 6000 | 8710 |
| R-C | liga2 | 7.42 | 220 | 6000 | 8157 |
| C-S | liga1 | 6.88 | 315 | 6000 | 8103 |
| B-P | liga1 | 7.88 | 275 | 6000 | 8074 |
| C-C | liga2 | 6.94 | 215 | 6000 | 7917 |
| G-G | liga1 | 6.5 | 310 | 6000 | 7903 |
| P-C | liga2 | 7.28 | 200 | 6000 | 7892 |
| T-C | liga2 | 6.92 | 210 | 6000 | 7857 |
| H-R | liga1 | 6.9 | 285 | 6000 | 7797 |
| N-W | liga1 | 6.14 | 265 | 6000 | 7291 |
| S-S | liga1 | 5.43 | 280 | 6000 | 7171 |
| R-L | liga1 | 4.94 | 295 | 6000 | 7137 |
| T-T | liga1 | 5.77 | 260 | 6000 | 7094 |
| Z-H | liga1 | 4.06 | 320 | 6000 | 7056 |
| V-D | liga1 | 5.8 | 250 | 6000 | 7001 |
| W-L | liga1 | 4.66 | 290 | 6000 | 6975 |
| L-R | liga1 | 4.04 | 305 | 6000 | 6891 |
| P-S | liga1 | 4.03 | 300 | 6000 | 6737 |
| L-K | liga2 | 6.07 | 225 | 5000 | 7683 |
| V-W | liga2 | 7.23 | 180 | 5000 | 7663 |
| S-C | liga2 | 6.53 | 205 | 5000 | 7652 |
| R-R | liga2 | 7.04 | 170 | 5000 | 7484 |
| V-V | liga2 | 4.76 | 235 | 5000 | 7276 |
| B-B | liga2 | 5.96 | 185 | 5000 | 7221 |
| T-G | liga2 | 3.24 | 230 | 5000 | 6631 |
| U-A | liga2 | 4 | 190 | 5000 | 6508 |
| D-L | liga2 | 3.82 | 195 | 5000 | 6491 |
| N-N | liga1 | 2.96 | 270 | 5000 | 6103 |
| W-W | liga1 | 2.9 | 255 | 5000 | 5922 |
| A-A | liga2 | 2.84 | 175 | 4000 | 5899 |

### Messung (32 KI-Teams von Anfang an, 3 Saisons, `scripts/auswerte-arena-ki-saisons.ts`)

Drei Läufe: **F2** mit den Konstanten vor dem letzten Feinschliff (Ergebnisschritte 0,35 %, Platz 12 %), **F3** und **F4** mit den endgültigen (zwei Saaten). Lauf 1 (Start 5.000, Nachfrage 0,30 + 0,85) brach in Saison 2 ab (Speicherdruck); nach Saison 1 stand die Spitze bei 6.200 bis 6.900 Fans und 6.250 Plätzen: Anlass für Start 6.500 und Nachfrage 0,45 + 0,90.

| Saison | Lauf | Plätze Ø L1 | Plätze Top-4 L1 | Top-4 L1 Fans | Ticket-Anteil Top-4 / alle | Teams GuV ≥ 0 | GuV-Abstand reich 8 − arm 8 | Kasse < 0 |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | F2 | 7.813 | 10.250 | 8.633 | 8 % / 8 % | 27 | 14,1 | 0 |
| 1 | F3 | 8.188 | 9.250 | 8.602 | 7 % / 8 % | 28 | 12,7 | 0 |
| 1 | F4 | 7.375 | 8.750 | 8.049 | 8 % / 8 % | 27 | 10,0 | 0 |
| 2 | F2 | 8.563 | 11.250 | 10.197 | 9 % / 8 % | 31 | 2,5 | 0 |
| 2 | F3 | 8.000 | 10.500 | 9.679 | 10 % / 7 % | 31 | 0,1 | 0 |
| 2 | F4 | 8.625 | 11.750 | 10.221 | 10 % / 8 % | 30 | 0,9 | 1 |
| 3 | F2 | 10.000 | 10.250 | 11.691 | 11 % / 9 % | 32 | 9,0 | 0 |
| 3 | F3 | 8.875 | 11.250 | 11.094 | 8 % / 8 % | 32 | 12,1 | 0 |
| 3 | F4 | 9.563 | 13.250 | 12.097 | 9 % / 8 % | 31 | 9,3 | 0 |

Endgültige Konstanten (F3, F4), Saison 3: Top-4 Liga 1 im Mittel **12.250 Plätze** (Ziel um 12.000, Spanne 10–14k: erreicht), Fans 11.100 bis 12.100, Liga-1-Schnitt 8.900 bis 9.600 Plätze (niedriger als die Spitze). Teams mit Kasse < 0: höchstens eins (Saison 2, F4). GuV-Abstand 9 bis 12 in Saison 3, 0,1 bis 2,5 in Saison 2: im Rahmen der Tabelle aus #1719 (− 9,5 bis 17,6). Die Fanbasis wächst und schrumpft (Spanne nach Saison 3: 4.200 bis 12.800; die Liga-Schere zwischen Spitze und Ende öffnet sich), Plätze folgen den Fans.

### Abweichungen und offene Entscheidung

- **Ticket-Anteil der Spitze erreicht das Ziel 12 % (10–14 %) nicht:** 8 bis 11 % nach Saison 3 (Mittel F3/F4 8,5 %), Liga-Schnitt 8 %. Bei den festen Preisen aus g.2 bringen 12.000 Plätze rund 13 C je Saison gegen 140 C Gesamteinnahmen; 12 % wären erst bei etwa 17.000 Plätzen oder rund 30 % höheren Preisen erreicht. Die Preise (`PREIS_JE_1000`) sind Teil des freigegebenen Konzepts und hier **nicht** geändert. **Entscheidung für Chris/PM:** Ticketpreise × 1,3 (eine Konstante); das verkürzt auch die Amortisation und lässt die KI mehr bauen, müsste neu gemessen werden.
- Erwartung aus der Kaderstärke (Rang der besten sechs nach Rating), nicht `computeTeamExpectation` des Vorstands (braucht die schweren Snapshot-Zeilen je Spieltag).
- Medaillen zählen nicht eigens in den Fans; „Titel oder Farb-Meister“ (aus `teamErfolgAusSnapshot`) schon. Kein Stimmungs-Malus bei sehr leerem Stadion.
- Start-Fanbasis: Matrix-Beliebtheit zur Hälfte beigemischt (Chris: „Beliebtheit/Tradition aus der Matrix“), Basis 6.500 statt 5.000.
- Stern-Gewichte werden zu Saisonbeginn aufgefrischt, sonst gilt das Gewicht beim Zugang (Verkauf kostet, was der Spieler beim Kauf oder zum Saisonstart wert war).
- Zwei Saaten gleichzeitig gelaufen; F2 ist die Saat mit den Konstanten vor dem Feinschliff.

### Prüfungen und Aufnahmen

- `npx tsc -p tsconfig.check.json --noEmit` sauber; `tests/arena-tickets-medaillen.test.ts` (26, davon fünf neue für das Fan-Modell).
- Aufnahmen: `docs/design/arena-tickets-medaillen-22-11/app-arena-leer-1920x1080.png` und `-2560x1440.png` (Messlauf-Spielstand F3, Saison 3 nach Spieltag 20, Seitenscroll 0, keine JS-Fehler); die Karte „Fans & Heimspiele“ zeigt Fanlinie und Gründe, die abgeschnittene Zeile „Ausverkauft“ ist entfallen.
