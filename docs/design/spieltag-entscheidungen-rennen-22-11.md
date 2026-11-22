# Deine Entscheidungen, Rennen mit Halbzeitbericht, Manager-Leiste mit Derby (22.11.)

Status: **Mockup, nichts gebaut.** Drei Vorschläge aus `docs/design/gameplay-designreview-22-11.md` (Top 5, Nr. 1, 2, 4),
von Chris freigegeben („ja“). Mockup `public/mockups/spieltag-entscheidungen-rennen-22-11.html`, Umschalter oben oder
`?ansicht=entscheidungen|rennen|halbzeit|manager`. Aufnahmen 1920×1080 und 2560×1440 in
`docs/design/spieltag-entscheidungen-rennen-22-11/`, selbst angesehen: kein Scrollen, kein Überlauf, kein
abgeschnittener Text. Alle Stände und Zahlen im Mockup sind erfunden, die Größen dahinter gibt es. Kein App-Code, keine
PixelLab-Bestellung. Alle drei Teile sind reine Anzeige: der Wertungs-Fingerabdruck bleibt unverändert.

Annahme im Mockup: Chris = Death Peaches, Franky = Vigilante Wranglers, Ramona = Royal Court, alle in Liga 2.

## 1. „Deine Entscheidungen“ in Nach dem Spieltag

**Was man sieht.** Je Disziplin ein Wasserfall vom Grundwert der Aufstellung über die eigenen Hebel zur Vorhersage, dann
der Teil, der nicht die eigene Wahl war, dann das Gespielte gegen den Gegner. Rechts dieselben Hebel als „gebracht /
gekostet“ mit dem Preis, den sie am nächsten Spieltag haben. Unten je Spieler dieselbe Zerlegung als sortierbare Tabelle.
Ein Satz Gegenprobe („ohne die Karte …“) und ein Merksatz mit Sprung zur nächsten Einsatzliste.

| Zeile | Quelle im Code |
|---|---|
| Grundwert der Aufstellung | Eignung auf dem Platz ohne Hebel, dieselbe Zahl wie in der Einsatzliste (`lib/lineups/legacy-score-engine.ts`, Arena: `aufEignung`) |
| Formkarte, „alle“ und Farbträger | `calculateFormModifierForSide` → `formByPlayerId`, Zerlegung `formkartenZerlegungFuerSpieler` (`lib/lineups/formkarten-farbregel.ts`, `formkarten-wirkung.ts`) |
| Einsatzstufe | `seededIntensityShare`, Schonen −3…−2, Normal −2…+2, Vollgas +2…+6 (`lib/lineups/legacy-lineup-modifiers.ts`) |
| Captain | `captainMultiplier` 1,5 (`lib/lineups/legacy-score-engine.ts`) |
| Form und Moral | Skalierung der Eignung (`docs/design/form-moral-17-11.md` Abschnitt 7, Schalter `OLY_FORM_MORAL`) |
| Erschöpfung | `fatigueByPlayerId[].multiplier` (Legacy), Erschöpfungsbremse in `lib/lineups/nach-dem-spieltag.ts` |
| Vorhersage und Spanne | „erwartet“ der Einsatzliste, Tagesform `FORM_TAGESFORM_SPANNE` |
| Gespielt, Ergebnis, Punkte | gebuchte Leistung je Spieler („Leistung X gegen erwartete Y“ gibt es schon in den Form-Meldungen), Ergebnisskala E1, Duellpunkte |
| Preis: Erschöpfung, Risiko, Verletzung | `lib/fatigue/belastung-regel.ts`, `projectMatchdayInjuryRisk`, `verletzungsStand` |
| Kartenhaushalt, Pflicht-Minuskarte | Formkarten-Bestand, `lib/season/form-card-penalty-service.ts` |
| PP | `baueSpielerPp` |

**Bau-Hinweise.**
- Ein neuer Baustein `baueEntscheidungsBilanz(gameState, teamId, matchdayId)` neben `baueNachDemSpieltag`; er liest nur
  Gebuchtes und rechnet nichts ein zweites Mal. Die Hebelwerte müssen beim Buchen je Spieler mit in die Buchungszeile
  (Karte, Stufe, Captain, Form/Moral, Erschöpfung); heute stehen nicht alle einzeln drin. Aufwand M statt S.
- **Arena-gebuchte Disziplinen:** die Hebel wirken dort auf die Eignung, das Ergebnis macht der Motor. Die Zerlegung ist
  deshalb ehrlich nur bis zur Vorhersage exakt; der Rest heißt „Spielverlauf und Tagesform“. Ohne diese Restzeile wäre
  die Anzeige eine zweite Wahrheit.
- **Gegenprobe:** Im Legacy-Pfad ist „ohne Karte“ exakt nachrechenbar. Im Arena-Pfad nur über einen zweiten Lauf des
  Node-Motors mit derselben Saat (deterministisch, kostet aber Rechenzeit). Welle 1 zeigt die Gegenprobe nur als Differenz
  der Vorhersagen („43,4 gegen 43,1“), nie als behauptetes Ergebnis.
- Teamwert = Mittel der Spielerwerte, damit Zeilen und Spielertabelle zusammenpassen (Mittel der Spalte = Zeile). Ein
  Wächtertest prüft genau das.
- Mehrspieler: jeder sieht nur die Bilanz seines Teams (`activeManagerTeamId`); delegierte Bereiche tragen die Marke
  „von der KI gesetzt“.
- Im Halbzeitbericht und am Saisonende wird dieselbe Bilanz summiert („9 Formkarten, Teamwert +21,4, 6 davon in Siegen“).

## 2. Rennen je Liga und Halbzeitbericht

**Rennen (Saisonstand, Reiter „Rennen“).** Je Team ein heller Balken (Punkte) und ein matter (noch erreichbar: 4 Punkte
je verbleibendem Spieltag), darüber die Linien der Rennen. Status je Team: sicher, auf Platz, im Rennen, nur rechnerisch,
ohne Rennen. Rechts je Rennen eine Karte: wer ist drin, Punkte bis sicher, der nächste entscheidende Spieltag.

**Befund beim Entwerfen:** drei Rennen je Liga gibt es so nicht. `league-movement-service.ts` tauscht nur zwischen Liga 1
und Liga 2: Liga 1 hat Titel und Abstieg, Liga 2 hat Meisterschaft und Aufstieg, aber **keinen Abstieg**. Das Mockup nimmt
als drittes Rennen das **Vorstandsziel** (Platzziel jedes menschlichen Managers), das für die untere Tabellenhälfte der
Liga 2 der einzige Einsatz ist. Mit drei Ligen hätte die mittlere Liga alle drei Rennen (siehe
`zwischen-den-spieltagen-22-11.md`, Ligaformat).

| Element | Quelle |
|---|---|
| Punkte, Rang, Verhältnis | Saisonstand (`seasonState.standings`, Duellpunkte `battle-mode-pps-duell.ts`) |
| Erreichbar | 4 × verbleibende Spieltage. `lib/season/title-race.ts` rechnet noch mit 12 × 3,3 = 39,6 je Spieltag und ohne Liga: muss ersetzt werden |
| Linien | `LEAGUE_SIZE`, `RELEGATION_COUNT` (`lib/season/league-split.ts`), Vorstandsziel aus `team-season-objectives-service.ts` |
| Nächstes Direktduell | Spielplan (`season-fixture-schedule.ts`) |
| Menschen-Marke | `ownerId` je Team |

Status-Regel (Anzeige, kein Spielwert): „im Rennen“ = Rückstand höchstens die Hälfte der noch möglichen Punkte, sonst
„nur rechnerisch“. Ohne diese Stufe wären bei 16 Restpunkten fast alle Teams „im Rennen“ und die Anzeige sagte nichts.
„Punkte bis sicher“ rechnet gegen das beste erreichbare Ergebnis des ersten Verfolgers außerhalb der Linie.

**Halbzeitbericht (Pause nach Spieltag 10).** Eine Seite statt eines Postfach-Eintrags: Tabelle mit Rennen, Vorstand
(Vertrauen, Freigabe, Ziele in den Stufen auf Kurs / gefährdet / verfehlt), Sponsor, Erholung aus der gebuchten Pause,
Kader der Hinrunde (Punkte je Achse, beste Spielerin, größter Sprung, Sorgenkind, Bilanz der eigenen Entscheidungen) und
„Das brauchst du in der Rückrunde“: Kaderstärke-Rang je Disziplin, drei Sätze mit Sprung, das Programm der Spieltage
11 bis 20 mit Derby- und Direktduell-Marke.

| Tafel | Quelle |
|---|---|
| Erholung | `seasonState.belastungsPause.eintraege`, `lib/fatigue/saisonpause-bericht.ts` |
| Vorstand | `lib/finance/vorstand-budgetfreigabe.ts`, `team-season-objectives-service.ts` |
| Sponsor | `lib/sponsor/`, `prize-money-sponsor-source.ts` |
| Punkte je Achse, Kaderstärke-Rang | Saisonstand je Disziplin, Kaderstärke über die besten 6 (wie Startseite) |
| PP, Sprung, Moral | `baueSpielerPp`, Training je Spieltag, `playerFormState` |
| Programm | Spielplan und `season-discipline-schedule.ts` |

Bau-Hinweise: Der Bericht erscheint als Halt im Taktgeber zwischen Spieltag 10 und 11 (ersetzt dort „letzten Spieltag
prüfen“), für KI-Teams gar nicht. Die drei Sätze sind Regeln, kein Text-Generator: schwächste Achse, offener
Kartenhaushalt, Direktduelle. Jede Regel hat einen Schwellwert und einen Sprung. Die Ziel-Stufen „auf Kurs / gefährdet“
kommen aus Befund 3.9 der Review und gehören zu diesem Bau.

## 3. Manager-Leiste und Derby-Marke

**Manager-Leiste (Startseite, unter dem Kopf).** Je menschlichem Manager eine Karte: Team, Rang, Punkte, Serie der
letzten fünf Spieltage, Bereit-Status mit Delegationsstufe, „anstupsen“. Darunter: Derby-Band für den heutigen Spieltag
mit Direktvergleich, Reihenfolge in der Arena (Derbys, dann Begegnungen mit Menschen, dann Topspiel, Rest als Ergebnis),
Managertabelle mit Punkteverlauf, ein Satz je Mitspieler zum letzten Spieltag, Legende der vier Status.

| Element | Quelle |
|---|---|
| Wer ist Mensch | `ownerId`, `canOwnerManageTeam`; nie `teams[0]` oder „Chris“ |
| Bereit-Status | Raumzustand: Einsatzliste abgegeben je Team; Anwesenheit aus dem Raum (`lib/room/`); Delegation `isBereichDelegiert` |
| Rang, Punkte, Serie | Saisonstand je Spieltag |
| Derby | Spielplan: beide Teams einer Begegnung (oder zwei Teams einer Vierergruppe) haben einen menschlichen Besitzer |
| Direktvergleich | gebuchte Begegnungen der Saison zwischen den beiden Teams |
| Arena-Reihenfolge | Sortierung der Begegnungsliste im Arena-Host, reine Anzeige |
| Mitspieler-Sätze | Ergebnis und Rangänderung aus der Buchung |

Bau-Hinweise: Die Leiste erscheint nur, wenn der Spielstand mindestens zwei menschliche Manager hat. Status „blockiert“
(nicht delegiert und nicht da) ist der einzige, der den Spieltag aufhält; er setzt voraus, dass M10/M11 aus
`mehrspieler-delegation-18-11.md` geschlossen sind (Raum mit mehr als einem Gast, kein Warten auf delegierte Schritte).
Sichtbar sind von den anderen nur Status und öffentliche Ergebnisse, nie Aufstellung oder Kartenplan vor der Abgabe; der
Satz „hat noch 2 Pluskarten“ zeigt nur, was nach einem gebuchten Spieltag ohnehin ableitbar ist (offene Frage 3).
„Gleichzeitig ansehen“ ist ein Ziel für den späteren Spielabend-Modus; in Welle 1 genügt „Derby zuerst“.

## Reihenfolge und Aufwand

| Teil | Aufwand | Voraussetzung |
|---|---|---|
| 3 Manager-Leiste, Derby-Marke, Arena-Reihenfolge | S | keine (Status „blockiert“ erst nach M10/M11) |
| 2a Rennen auf Duellpunkten je Liga | S–M | `title-race.ts` ersetzen |
| 2b Halbzeitbericht | M | 2a, Ziel-Stufen |
| 1 Deine Entscheidungen | M | Hebelwerte je Spieler in der Buchung |

Abnahme je Teil nach CLAUDE.md: Aufnahmen aus der echten App bei 1920×1080 und 2560×1440 neben diesen Bildern, Liste
drin / angepasst / fehlt; bei Teil 1 Stichproben über Feldspiel, Bahn, Bühne und Mini-DM/Spurt.

## Offene Fragen

1. **Drittes Rennen in Liga 2:** Vorstandsziel wie im Mockup, oder eine Prämienlinie (Preisgeld nach Platz)? Abstieg gibt
   es dort nicht.
2. **Gegenprobe im Arena-Pfad:** reicht die Differenz der Vorhersagen, oder soll der Motor für knappe Spiele (Abstand
   unter 1 Ergebnispunkt) ein zweites Mal laufen, damit „wäre ein Remis gewesen“ gebucht stimmt?
3. **Wie viel sieht man vom Mitspieler:** nur Status und Ergebnisse, oder auch den Kartenhaushalt (Zahl der übrigen
   Plus- und Minuskarten)?

## Runde 2 (22.11.): Feedback von Chris

- **Gegner im Vergleich:** der Wasserfall hat rechts eine Spalte „Gegner“ mit denselben Zeilen (Grundwert, Karte,
  Einsatzstufe, Captain, Form und Moral, Erschöpfung, Vorhersage, Spielverlauf, gespielt). Große Hebel des Gegners sind
  hell hinterlegt; der Satz darunter sagt, warum es so ausging. Quelle ist die Buchung der Gegenseite, sichtbar erst nach
  dem Spieltag. Bau-Hinweis: dieselbe Funktion `baueEntscheidungsBilanz` für beide Seiten, kein zweiter Rechenweg.
- **Rennen neu** (Chris: „wirkt sehr generisch“): je Rennen eine Seite mit vier Tafeln statt der Balkentabelle.
  1. *Wie es so weit kam:* Abstand zur Linie über die Spieltage für die Teams im Rennen, zwei markierte Wendepunkte, ein
     Absatz Geschichte aus Regeln (tiefster Stand, Wendepunkt, längste Serie, wer fällt).
  2. *Wenn, dann:* drei gerechnete Szenarien (eigener Sieg, eigene Niederlage, Direktduell der Verfolger) mit Punkteständen.
     Bewusst keine Prozent-Chancen: dafür gibt es keine ehrliche Quelle.
  3. *Die entscheidenden Spieltage:* Restprogramm der Teams im Rennen; Farbe = Kaderstärke (beste 6) in den zwei
     Disziplinen gegen diesen Gegner; Direktduelle und Derbys hervorgehoben; höchstens erreichbare Punkte.
  4. *Direktvergleich* mit dem nächsten Rivalen: Punkte, Serie, Hinspiel, Rang der Kaderstärke in den verbleibenden
     Disziplinen.
  Die Balkentabelle bleibt als Reiter „Tabelle“. Quellen wie oben (Saisonstand je Spieltag, Spielplan, Kaderstärke).
  „Im Rennen“ sind die Teams, deren Rückstand höchstens die Hälfte der noch möglichen Punkte beträgt.
- **Liga:** bleibt vorerst 2 × 16 (entschieden). Das dritte Rennen in Liga 2 bleibt damit das Vorstandsziel.
- Die Sendung „Nach dem Spiel“, der Zuruf im Spiel und die Winterpause stehen in `zwischen-den-spieltagen-22-11.md`
  (Abschnitte 8, 17, 15.2).

## Entschieden (Projektleitung, 22.11.)

Die drei offenen Fragen oben sind entschieden:

1. **Drittes Rennen in Liga 2 = Vorstandsziel** (vorhandene Daten).
2. **Gegenprobe = Differenz der Vorhersagen**, kein zweiter Motorlauf.
3. **Mitspieler:** vorab nur Status und Ergebnisse. Nach dem Spieltag zeigt „Deine Entscheidungen“ in der Gegnerspalte auch
   deren gespielte Entscheidungen. Kein Einblick in Kartenhaushalt oder Lager vorab; der Satz „hat noch 2 Pluskarten“ aus
   dem Mockup (Ansicht Manager) entfällt im Bau.
