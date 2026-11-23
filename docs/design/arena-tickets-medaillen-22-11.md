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
- Offen: Messung über mehr als zwei Saisons und ein A/B-Lauf ohne Arena für die Schere (nicht gemessen).

## Prüfungen

- `npx tsc -p tsconfig.check.json --noEmit` sauber.
- vitest `tests/finan*`, `guv-*`, `spieltag*`, `saisonende*`, `gebaeude*`, `stadion*`, `sponsor*`, `morale*`, `leaders*`, `marketing*`: 837 grün (2 Dateien übersprungen wie vorher); `tests/arena-tickets-medaillen.test.ts` 22 grün.
- Wertungs-Fingerabdruck: **GESAMT fe1dc086d68d** (unverändert; Arena und Medaillen wirken nur auf Geld und Moral).

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
