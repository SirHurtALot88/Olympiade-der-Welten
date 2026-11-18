# Finanzen und Sponsoren modern (Fable, 17.11.)

Mockup zum Konzept `docs/design/finanzkonzept-17-11.md` (Branch `claude/finanzkonzept-17-11`,
„Spieltags-Kreislauf“). Ablauf nach CLAUDE.md, „Größere Konzepte: immer zuerst Mockup + Erklärung“:
Chris sieht das Mockup, sagt „bau das“ oder korrigiert, erst dann wird gebaut.

Dies ist ein Entwurf. `components/`, `app/`, `lib/` und der Motor sind nicht angefasst. Bei PixelLab
ist nichts bestellt (0 Generationen): alles ist CSS und SVG, dazu Wappen und Portraits, die schon im
Repo liegen. Das Designsystem (Tokens, zwei Schriften, Schiene, Hero-Kopf, Reiter, Tafel, Marken,
Blatt) ist unverändert aus `saisonstand-modern-17-11.html` und `einsatzliste-modern-17-11.html`
übernommen.

## Ansehen

| Was | Datei |
|---|---|
| Finanzen und Sponsoren, klickbar | `public/mockups/finanzen-modern-17-11.html` |
| Bilder (doppelte Dichte) | `docs/design/finanzen-modern-17-11/01` bis `22` |

Die Seite läuft per Doppelklick ohne Server, über den Dev-Server unter `/mockups/...`. Schriften
kommen aus `public/fonts/`. Die graue Leiste oben gehört nicht zum UI: sie schaltet die Kassenlage
(Normal, Engpass, Im Dispo) und das Phone-Layout um und nennt rechts die Konzept-Welle, die die
gerade offene Ansicht braucht. Die Schiene links verlinkt auf die drei anderen Mockups vom 17.11.;
die liegen auf ihren eigenen Branches und sind von hier aus tote Links, solange sie nicht auf `main`
sind.

Adresse: `?ansicht=kasse|auszug|hebel|slots|angebote|bonus|fans|merch`, dazu `&szen=normal|eng|dispo`,
`&st=1..10` (Spieltag „jetzt“), `&tag=1..11` (Kontoauszug, 11 = Saisonende), `&preis=-30..30`,
`&spar=0|1|2`, `&dispo=0..12`, `&bonus=0..3`, `&notv=1`, `&an=pow,spe,soc`, `&sel=<posten>`,
`&ctab=lage|quelle|liga`, `&phone=1`, `&still=1` (ohne Leiste), `&blatt=kontext`.
Tasten: `←` `→` Spieltag, `Esc` schließt das Blatt.

## Aufbau

Drei Bereiche als Reiter im Kopf, jeder mit seiner Kennzahl: **Kasse** (Kontostand),
**Sponsoren** (Sponsorgeld am Spieltag), **Fans & Arena** (Stimmung). Darunter die Tafel mit zwei
bis drei Ansichten je Bereich. Rechts die Kontextspalte, auf dem Phone ein Blatt von unten:

- **Lage:** Warnstufe, Kasse in Gehaltsraten, Dispo-Rahmen, nächste Buchung, Prognose Saisonende.
- **Quelle:** die Rechnung hinter der zuletzt angetippten Zahl.
- **Liga:** Kasse und Stimmung der anderen Teams, eigener Einnahmen-Mix.

Die Pfeile im Kopf blättern den Spieltag. Alles bis „jetzt“ ist gebucht (volle Farbe), alles danach
Prognose (blass, gestrichelt).

## Die Ansichten

| Bild | Ansicht | Was sie zeigt | Braucht |
|---|---|---|---|
| `01` | Kasse · Übersicht | Kassenstand, Einnahmen und Ausgaben bisher, GuV und Prognose Saisonende. Oben die Kassenlinie über zehn Spieltage plus Saisonende mit Reserve-Linie (eine Gehaltsrate) und Dispo-Zone, unten je Spieltag ein gestapelter Balken Ein- gegen Ausgaben nach Herkunft. Darunter der Einnahmen-Mix mit Zielkorridor für den Sponsor-Anteil. Klick auf einen Spieltag öffnet seinen Kontoauszug. | W0, W1 |
| `02` `03` | dieselbe, Lage „Engpass“ und „Im Dispo“ | Warnband über der Tafel, Warnkarte rechts, Marke „DISPO“ am Kopf-Reiter, Dispo-Zins als eigener Posten. Im Minus gilt Kaufsperre, es gibt keinen automatischen Notkredit. | W1 (Netz), W3 (Aufnahme) |
| `04` | Kasse · Spieltags-Abrechnung | Kontoauszug eines Spieltags: Kasse davor, Einnahmen, Ausgaben, Bilanzposten (Transfers, Dispo, zählen nicht zur GuV), Kasse danach. Jede Zeile hat Herkunft, Kurzbegründung, Betrag und laufenden Kontostand. Hover zeigt die Rechnung, Klick legt sie rechts unter „Quelle“ ab. Fußzeile: „Summe der Posten = Änderung der Kasse“. | W0 (Auszug); neue Posten W1/W2 |
| `05` | dieselbe, Saisonende | Was am Ende noch kommt: Schlusszahlung des Hauptsponsors, Sonderziel, Vorstandsprämie, Apron (steht auch bei 0 da), Dispo-Tilgung. Als Prognose markiert. | W1 |
| `06` | Sponsoren · Slots & Ziele | Slot 1 Hauptsponsor: der heutige Vertrag, Sockel als zehn Raten, die Zielleiter mit der eigenen Stufe und dem Sprung zur nächsten, Schlusszahlung, Sonderziel. Slot 2 Ärmelsponsor: feste Rate und Presence-Bonus je Spieltag. Slot 3 Disziplin-Sponsoren: zwei Plätze, je Farbe eine Treffer-Reihe. | W1 (Raten), W4 |
| `07` | Sponsoren · Angebote | Vier Angebote vor dem nächsten Spieltag, eines je Farbe (Power, Speed, Mental, Social): Bonus je Podium, Zusatzziel, Risiko-Klausel, Papierform als Balken, Erwartung für den Rest der Saison, Annehmen oder Ablehnen. Angenommene stehen sofort in der Prognose. | W4 |
| `08` | Sponsoren · Bonus je Spieltag | Jede Sponsor-Zahlung als Zeile, die zehn Spieltage als Spalten: hell gebucht, grau Prognose, Punkt = kein Anspruch. Rechts „bisher“ und „Saison“. | W0, W1, W4 |
| `09` `10` | Fans · Stimmung & Tickets | Fan-Stimmung 0–100 mit Liga-Spanne, Verlauf je Spieltag mit Grund im Tooltip, Auslastung der Arena. Rechts der Ticketpreis-Regler (−30 bis +30 %, Schalter „Auto“): Auslastung, Erlös je Spieltag, Stimmung und Saisonprognose rechnen beim Ziehen neu, die Kurve zeigt das Maximum knapp über dem Richtpreis. Bild `10` steht auf +20 %. | W2, Regler W3 |
| `11` | Fans · Merch & Stars | Merch je Star mit Starpower, Fan-Liebling, Status und Treffer-Reihe; im Bild ist der Star verletzt und sein Merch auf 30 % gefallen. Darunter drei Hinweiskarten (Star-Ausfall, Fan-Shop, mehrere Wege). | W2, Verletzung W5 |
| `12` `13` | Kasse · Hebel | Oben vier Zahlen, die live mitrechnen (Kasse, tiefster Stand, Wirkung der Hebel, Prognose). Sechs Karten: Sparkurs (Aus, Leicht, Hart), Dispo aufnehmen (Regler, Zins je Spieltag, Tilgung), Spielerbonus (Star wählen, Betrag, Moral-Balken), Notverkauf, dazu Sprungkarten zu Ticketpreis und Angeboten. Bild `13`: Dispo 6 C, Sparkurs leicht, Bonus 2 C. | W3, Moral W5 |
| `14` bis `22` | Phone 390 × 844 | Dieselben Ansichten einspaltig, Schiene als Leiste unten, Kontext als Blatt (`16` Quelle, `22` Lage). | wie oben |

### Die Haltung „gezeigt = gebucht“

Es gibt im Mockup ein einziges Rechenmodell: jeder Spieltag ist eine Liste von Posten, und jede
Zahl auf jeder Ansicht ist eine Summe über diese Posten. Der Kontostand im Kopf, die Balken, die
GuV, die Bonus-Tabelle und der Einnahmen-Mix lesen dieselbe Liste. Deshalb stimmt die Fußzeile des
Kontoauszugs immer, auch nach jedem Hebel. So soll es auch in der App sein: eine Buchungsliste
(`cashLedger` aus dem Konzept, Abschnitt 2.6), alles andere ist Anzeige davon.

## Was Platzhalter ist

| Echt | Erfunden |
|---|---|
| Teamnamen, Wappen, Portraits (Dateien aus `public/`) | **Jede Buchung.** Kein Betrag stammt aus einem Spielstand |
| Größenordnungen aus der IST-Analyse: Sponsor rund 57 C, Gehalt 59 C, Kasse 17 bis 28 C je Saison | Alle Sponsor-Marken (Eisenross Fracht, Sattelfest Bräu, Hammerwerk Stahl, Blitzkurier, Denkfabrik Nord, Rampenlicht Media) |
| Posten und Taktung aus dem Konzept, Tabelle 2.2 | Formel-Parameter: Preis-Elastizität, Merch-Grundwerte, Ligageld-Schlüssel, Prämien |
| Stimmungs- und Auslastungsformel aus Abschnitt 2.2 | Stimmungswerte, Ränge, Ergebnisse, Verletzung an Spieltag 4 und 5 |
| Zielleiter als Prinzip (Sockel plus Wertung nach Rang) | Die fünf Stufen und ihre Beträge; die echte V3-Leiter hat andere Zahlen |
| Dispo-Rahmen-Regel (15 % Kasse + 30 % Kaderwert), Zins am oberen Ende der Bank-Spanne | Rahmen 12 C, 1,8 % je Spieltag, Mindestzins 0,1 C |
| Vier Farben der Disziplinen | Welche Disziplin an welchem Spieltag läuft; Zuordnung der Kürzel zu den Farben ist aus dem Saisonstand-Mockup abgelesen, nicht aus dem Code |
| | Arena „4.200 Plätze“, Zuschauerzahlen, Fan-Shop-Preise |
| | Moral-Werte und „+6 Moral je 1 C Bonus“ (Form/Moral entsteht parallel) |
| | Die drei Stars gehören im echten Spielstand nicht zu den Wranglers |

Vereinfachungen: Hebel wirken ab dem nächsten Spieltag; Dispo-Auszahlung, Spielerbonus und
Notverkauf werden auf den aktuellen Spieltag gebucht. Wer den Spieltag wechselt, setzt die Hebel
zurück. Die Prognose-Spanne (± 0,6 C je offenem Spieltag) ist geschätzt, nicht simuliert.

## Fünf Fragen an Chris (Ja oder Nein)

1. **Dispo mitten in der Saison?** Darf ein Team zwischen den Spieltagen ins Minus rutschen und
   sich dort Geld mit Zins leihen? Heute gibt es Kredit nur vor der Saison. Ja heißt: die Regel
   „kein Kredit während der Saison“ fällt, und die Karte „Dispo aufnehmen“ wird gebaut.
2. **Erst die Raten, dann das neue Geld?** Sollen Gehälter und Sponsor-Sockel schon im ersten
   Schritt in zehn Raten laufen, bevor Tickets, Merch und TV-Geld da sind? Dann bewegt sich die
   Kasse sofort jede Woche, aber schwache Teams können in Saison 1 kurz im Dispo stehen.
3. **Gleich viel Geld im Spiel?** Soll die Liga im Jahr insgesamt gleich viel einnehmen wie heute,
   nur anders verteilt (weniger Sponsor, dafür Tickets, Merch, TV)? Nein heißt: es kommt bewusst
   mehr Geld ins Spiel.
4. **Sponsoren je Farbe?** Sollen Power, Speed, Mental und Social eigene Sponsor-Angebote
   bekommen, die je Spieltag zahlen, wenn eine Disziplin dieser Farbe aufs Podium kommt (Bild `07`)?
5. **Baut die KI Gebäude?** Sollen KI-Teams künftig Arena und Fan-Shop bauen? Heute tut das
   keins von 31, und die Gebäude bringen der Liga fast nichts. Ja verschiebt die Liga-Kasse.

## Offene Designfragen aus dem Mockup

Diese sind beim Bauen des Mockups aufgefallen und stehen nicht im Konzept:

- **Wie viele Disziplin-Sponsoren gleichzeitig?** Das Mockup erlaubt zwei von vier. Mit vier
  gleichzeitig gäbe es nichts zu entscheiden, mit einem wäre die Wahl sehr hart.
- **Wann wird ein Hebel gebucht?** Im Mockup sofort (Bonus, Notverkauf, Dispo) und ab dem nächsten
  Spieltag (Sparkurs, Ticketpreis). Alternative: alles erst mit der nächsten Abrechnung.
- **Ticketpreis „Auto“ als Voreinstellung?** Das Konzept nennt es als Schutz gegen zu viele
  Stellschrauben. Im Mockup ist „Selbst“ auf Richtpreis voreingestellt.
- **Wo wohnt die Seite?** Im Mockup ersetzt „Finanzen“ den heutigen Finanzen-Eintrag der Schiene
  und nimmt die Sponsoren mit. Die Geldspalten des Saisonstands („Verein“) blieben als Vergleich.
- **Prognose zeigen oder nicht?** Die gestrichelte Linie verspricht eine Zahl am Saisonende. Wenn
  sie oft danebenliegt, schadet sie mehr, als sie hilft. Der Messlauf aus W0 kann die Spanne liefern.
- **Notverkauf-Vorschlag:** Das Mockup schlägt genau einen Spieler vor. Eine Liste mit drei
  Kandidaten wäre ehrlicher, kostet aber Platz.
- **Betrag je Star beim Merch:** Mit Rundung auf 0,1 C liegen die meisten Stars bei 0,1 bis 0,3 C.
  Das ist klein. Entweder Merch je Star sichtbar machen (wie jetzt) oder nur die Summe buchen.
