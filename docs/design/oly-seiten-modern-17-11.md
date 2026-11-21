# Einsatzliste modern und Plan „Oly-Seiten aufhübschen“ (Fable, 17.11.)

Anlass, Chris am 17.11. zum Basketball-Mockup: „die layout UI sachen sehen geil aus, genau so ne
qualität hätte ich gerne öfter und ÜBERALL“, danach: „kannst du nicht auch in so nem modernen stil
mal die Einsatzliste aufbereiten? erst Fable Mockup planen und ausführen, dann könnten wir die
Oly-Seiten doch sicher noch geiler aufhübschen“.

Dies ist ein Entwurf. `components/`, `app/` und der Motor sind nicht angefasst, nichts ist
committet. Bei PixelLab ist nichts bestellt (0 Generationen): alles ist CSS und SVG.

## Ansehen

| Was | Datei |
|---|---|
| Einsatzliste, klickbar | `public/mockups/einsatzliste-modern-17-11.html` |
| Startseite im selben Stil | `public/mockups/oly-start-modern-17-11.html` |
| Bilder (doppelte Dichte) | `docs/design/einsatzliste-modern-17-11/01` bis `14` |

Beide Seiten laufen per Doppelklick ohne Server, über den Dev-Server unter `/mockups/...`. Die graue
Leiste oben gehört nicht zum UI, sie springt zwischen den Zuständen. Dieselben Zustände per Adresse:
`?szene=basketball|buehne|bahn|arena|fehler|leer|gespeichert`, dazu `&still=1` (ohne Leiste) und
`&phone=1`.

| Bild | Zustand |
|---|---|
| `01-teamspiel-basketball.png` | Basketball, Platz Perimeter gewählt, Rollenkarte rechts |
| `02-buehne-eiskunstlauf-gegner.png` | Eiskunstlauf als Auftrittsfolge, Reiter Gegner mit Vierergruppe |
| `03-bahn-spurt.png` | Spurt mit vier Bahnen und Wertbalken |
| `04-arena-battlefield.png` | Battlefield mit drei Punkten (vierter Feldtyp, zeigt dass das Raster trägt) |
| `05-ungueltig-pruefung.png` | Offener Platz, Verletzter gesetzt, Erschöpfter bei Vollgas; Abgabe gesperrt |
| `06-leer.png` | Leere Liste mit Vorschlägen je Platz |
| `07-abgegeben.png` | Nach der Abgabe |
| `08` bis `11-phone-*.png`, `14-phone-uebersicht.png` | Phone 390 × 844 |
| `12-start-desktop.png`, `13-start-phone.png` | Startseite |

### Was echt ist und was nicht

| Echt | Erfunden |
|---|---|
| Spielernamen, Portraits, Klassen, Völker, Traits, die zwölf Attribute, die Disziplinwerte (`data/generated/oly-player-stats.json`, `oly-player-attributes.json`) | Form, Erschöpfung, Verletzung, Formkarten, der Spieltag |
| Matrixgewichte der vier Disziplinen (`official-discipline-weights.ts`), unverändert | Die Slot-Wert-Formel: Disziplinwert + Rollenpassung + Form − Last, stark vereinfacht |
| Rollennamen, Rollentexte, Fokus- und Belastungsattribute (`lib/lineups/matchday-slot-roles.ts`) | Gegner-Schätzung, Siegchance, Gruppenprognose, Rivalen |
| Wappen, Teamnamen, der Kader von Armageddon Aftermath (`oly-rosters.json`) | Platzanzahl bei Spurt (4) und Battlefield (3); Basketball 6 und Eiskunstlauf 3 stimmen mit `dataAdapter.ts` |

Der eigene Kader besteht aus den sieben echten Wranglers plus sieben Figuren aus dem
Basketball-Mockup, damit die Liste 14 Zeilen hat.

---

## Teil 1: Die Einsatzliste heute

Quellen: `app/foundation/legacy-lineup-lab/LineupNewLook.tsx` (3096 Zeilen) und
`LegacyLineupLabClient.tsx` (6493 Zeilen) auf `main`; Bild
`docs/design/fable-uiux-screenshots-14-11/03-einsatzliste-ist-zustand.png`; der Stand von PR #1358
(Branch `claude/einsatzliste-revamp-architektur-0811`, Bild `einsatzliste-revamp-08-11/f4/a-nachher-1920x1080.png`);
`einsatzliste-gesamtkonzept-visuell-08-11.md`. Ein eigenes Bild der Live-Seite gibt es nicht, sie
liegt hinter `/login`.

### Was ein Spieler dort wirklich braucht

| Frage des Spielers | Information | Heute | Im Entwurf |
|---|---|---|---|
| Was muss ich aufstellen? | Zwei Disziplinen je Spieltag, Plätze mit Rollen | zwei Blöcke untereinander | zwei Reiter im Kopf mit Füllstand |
| Wer passt auf welchen Platz? | Wert je Spieler und Platz | Kandidatenliste rechts, „Best Fit“ je Platz | Kaderliste sortiert sich nach dem gewählten Platz, Unterschied zur jetzigen Besetzung steht daneben |
| Warum passt er? | Fokus-Attribute der Rolle, Matrixgewichte | Radar und Text im Fokus-Panel; in #1358 eine Rollenkarte | Rollenkarte mit Balken, Matrixgewicht und Rechenweg des Platzwerts |
| Ist er einsatzfähig? | Form, Erschöpfung, Verletzung, Verletzungsrisiko | Fatigue-Uhr nur für den Fokus-Spieler; Risiko in einer aufklappbaren Liste | Form und Last in jeder Zeile und auf jeder Platzkarte, Risiko in der Rollenkarte |
| Reicht das gegen den Gegner? | Gegner-Schätzung, Rivalen | „Zu schlagen“-Chips; in #1358 Schätzzeile als Text | Waage über dem Feld, Geister auf der Gegnerhälfte, Reiter Gegner mit Platz gegen Platz |
| Ist das die beste Besetzung? | Goldrahmen | in #1358 Raute nach optimaler Verteilung | Raute auf dem Platz (Bestbesetzung), Goldrand in der Liste (Top N der Disziplin) |
| Darf ich abgeben? | Validierung | Ring „0/5 offen“, rohe Codes wurden schon einmal gezeigt (`lineup-fehlertexte.ts`) | Reiter Prüfung mit Sätzen, jeder Punkt springt zum Platz; Abgabe-Knopf zeigt den Zustand |
| Wie hart spiele ich? | Schonen/Normal/Vollgas, Formkarten, Captain | drei Stellen im Block | eine Taktik-Leiste unter dem Feld |

### Was heute stört (belegt)

1. **Sieben Bedienzonen vor dem ersten Platz.** Im Ist-Bild stehen über dem ersten Slot: Statusleiste
   „Bereit“, Brotkrume, Reiter Einsatzliste/Formplan, Kopfkarte mit fünf Kennzahlen, fünf Knöpfe
   (Nächster Slot, Automatisch füllen, Optimieren, Slots offen, Zur Arena), zwei Auswahlfelder
   (Spieltag, Team) und zwei KI-Knöpfe. Der erste Platz beginnt bei etwa 790 von 1600 Pixeln Höhe.
2. **Die Plätze sind die kleinsten Elemente der Seite.** Eine Slot-Kachel misst im Ist-Bild rund
   245 × 150 px und enthält sechs Texte in 10 bis 13 px („D1-1“, Rollenname, „Offen“, „Nächster
   Fokus“, zwei Chips, „Best Fit“). In #1358 sind die Marken auf dem Mini-Feld etwa 85 × 30 px, der
   Name ist abgeschnitten („Tidesprinter 7…“).
3. **Formkarten sind zwei Auswahlfelder über die volle Breite**, je Disziplin, obwohl meist „keine“
   drinsteht. Sie nehmen mehr Fläche ein als die Plätze.
4. **Disziplinen untereinander statt nebeneinander oder umschaltbar.** Bei sechs Plätzen je
   Disziplin (Hockey, Basketball) rutscht D2 unter den Bildrand. #1358 stellt sie nebeneinander,
   dadurch wird jedes Feld nur noch 480 px breit.
5. **Zahlen ohne Aussage.** „Erwartete Punkte 0,0“ vor dem ersten Eintrag (schon im Brainstorm 14.11.
   notiert), „Risiko hoch“ ohne Bezug, „Fatigue-Kosten 0“.
6. **Fachwörter in vier Sprachen.** „Klar bester“, „Hier weiter“, „Best Fit“, „Top-Pick setzen“,
   „Passt sofort · direkt“, „Nur Notfall · Notfall“, „Alternative 10“. Dieselbe Aussage (wie gut
   passt er) hat fünf Schreibweisen.
7. **Zustand eines Spielers ist verteilt.** Verletzungsrisiko und Erschöpfung stehen in #1358 in einer
   zugeklappten „Slot-Liste“, die Form gar nicht in der Kandidatenliste.
8. **Kein Bild.** Bis #1358 gibt es keine Portraits in Plätzen, nur 20-px-Avatare in der Liste. Der
   Basketball-Entwurf, der Chris gefallen hat, lebt von 84-px-Portraits und Wappen.
9. **Mobil nicht benutzbar.** Laut Brainstorm 14.11. Abschnitt 15 klappt die Seitenleiste nicht ein,
   der Inhalt beginnt nach etwa 900 px Scrollweg.

---

## Teil 2: Der Entwurf

### Aufbau

```
┌──┬──────────────────────────────────────────────────────────────────────────────┐
│  │ Wappen  ‹ Spieltag 7 ›          ◢ D1 Basketball 311 ◣ ◢ D2 Eiskunstlauf 210 ◣   Abgabe bis │ Hero-Kopf 115 px
│S │ Einsatzliste · Gegner            (Füllstand als Striche)                                │ (Kulisse der Disziplin, unscharf)
│c ├───────────────┬──────────────────────────────────────────┬───────────────────┤
│h │ KADER         │ Waage: Wir 311 ▬▬▬▬ 277 Gegner            │ Rolle│Gegner│Prüfung│
│i │ Suche         │ [Auffüllen] [Optimieren] [↶]              │                   │
│e │ Filter-Chips  │ ┌──────────────────────────────────────┐ │ Rollenkarte       │
│n │ Spalten:      │ │  Mini-Feld mit Platzkarten            │ │ Was hier zählt    │
│e │ Disz. Platz   │ │  (Court, Bühne, Bahn, Arena)          │ │ Besetzt mit       │
│  │ Form Last     │ │  Gegner als Geister                   │ │ Rechenweg         │
│64│ 14 Zeilen     │ └──────────────────────────────────────┘ │ Beste Kandidaten  │
│px│               │ Einsatz │ Formkarten │ Captain            │                   │
│  ├───────────────┴──────────────────────────────────────────┴───────────────────┤
│  │ ● ABGABEBEREIT · eine Zeile Begründung        Spieltag gesamt 521  [Leeren] [ABGEBEN] │ Dock 62 px
└──┴──────────────────────────────────────────────────────────────────────────────┘
```

Bei 1600 × 900 passt alles ohne Seitenscrollen; nur die Kaderliste und der Kontext scrollen in sich.

### Entwurfsentscheidungen

1. **Eine Disziplin zur Zeit, beide im Kopf.** Die zwei Reiter zeigen Namen, Chassis, Füllstand und
   erwartete Punkte beider Disziplinen dauerhaft. Das Feld bekommt dafür die volle Mitte (725 × 540 px
   statt 480 × 350). Taste `D` wechselt.
2. **Der Platz ist das größte klickbare Element.** Jede Platzkarte misst mindestens 150 × 80 px:
   farbiger Kopfstreifen mit Kürzel und ausgeschriebener Rolle, Portrait 44 px, Name, Platzwert,
   Rollenpassung (`++ + o −`), Formpfeil, Lastbalken. Raute oben rechts = Bestbesetzung, „C“ = Captain.
3. **Platz wählen, dann sortiert sich alles danach.** Ein Klick auf einen Platz sortiert den Kader
   nach dem Wert auf genau diesem Platz und zeigt je Zeile den Unterschied zur jetzigen Besetzung
   (`+11,9`). Fährt man über eine Zeile, rechnet die Waage die Vorschau. Klick setzt und springt zum
   nächsten offenen Platz. Ziehen geht ebenfalls (Liste auf Platz, Platz auf Platz tauscht, Platz
   auf Liste leert).
4. **Ein Kader für beide Disziplinen.** Wer in D2 steht, trägt in der Liste die Marke „D2 JS“ in der
   Farbe seines Platzes. Setzt man ihn in D1, wird er dort abgezogen und die Meldung sagt das.
   „Optimieren“ verteilt über beide Disziplinen gemeinsam, „Auffüllen“ lässt Gesetztes stehen.
   Annahme dahinter: ein Spieler je Spieltag höchstens einmal (`legacy-matchday-readiness.ts`,
   `duplicate_player_usage`). Stimmt das nicht, entfällt nur das Abziehen.
5. **Vier Feldtypen aus einer Datentabelle.** Court, Bühne (Auftrittsfolge), Bahn (Bahnen mit
   Wertbalken), Arena (Punkte). Jeder Platz hat Koordinaten in Prozent, das Zeichnen kennt keine
   Disziplin. Das ist dieselbe Idee wie `lib/lineups/formation/formation-registry.ts` aus #1358;
   der Entwurf ersetzt dessen Darstellung, nicht dessen Daten.
6. **Rollenkarte rechts, wie am 08.11. entschieden.** Sie zeigt Schwerpunkt, Nebenfokus und das
   belastete Attribut mit Matrixgewicht und dem Wert des gesetzten Spielers, dazu den Rechenweg
   (Disziplin + Rolle + Form − Last = Platzwert) und die fünf besten Kandidaten zum Anklicken.
7. **Gegner an drei festen Orten.** Waage über dem Feld (Summe, Siegchance oder Platzprognose,
   Unsicherheit schraffiert), Geister auf der Gegnerhälfte (Name und Spanne), Reiter Gegner (Platz
   gegen Platz; grau heißt „innerhalb der Unsicherheit“). Gruppen-Disziplinen zeigen statt des
   Duells die Vierergruppe.
8. **Prüfung in Sätzen, Abgabe-Knopf als Ampel.** Fehler (offener Platz, Verletzter gesetzt) sperren
   die Abgabe, Warnungen (Erschöpfung, Risiko) nicht, Hinweise (kein Captain, keine Formkarte) sind
   grau. Jeder Punkt springt zum Platz. Der rohe Code (`invalid_lineup`) steht klein dahinter, damit
   eine In-Game-Meldung ihn nennen kann. Ein Klick auf den gesperrten Knopf öffnet die Prüfung.
9. **Taktik in einer Leiste.** Einsatz als Dreier-Schalter (Vollgas wird rot), Formkarten als zwei
   Kartenplätze mit Aufklappliste statt zwei Auswahlfeldern, Captain mit Saisonzähler.
10. **Farben mit fester Bedeutung**, übernommen aus dem Basketball-Entwurf: Bernstein = wir,
    Türkis = Gegner, Gold = gewählt/beste/Hauptaktion, Rot = Fehler, Gelb = Warnung. Dazu die sechs
    Platzfarben (Chris 08.11.: Farben nach Position 1 bis 6).
11. **Tastatur:** `1`–`6` Platz, `←` `→` Platz weiter, `D` Disziplin, `A` auffüllen, `O` optimieren,
    `Z` zurück, `Esc` schließt. Jeder Knopf hat Fokusrahmen und, wo nötig, einen Tooltip.
12. **Phone:** eine Spalte. Kopf klebt oben, das Feld zeigt beim Court nur die eigene Hälfte, Tippen
    auf einen Platz öffnet den Kader als Blatt von unten (mit „Rolle ansehen“), Kontext ebenfalls als
    Blatt, Abgabe-Leiste unten fest.

### Was der Entwurf bewusst weglässt

KI-Vorschau aller Teams, Formplan-Reiter, die Aufdeck-Show, Team-Auswahl (mehrere geführte Teams).
Sie bleiben in der App, gehören aber nicht auf die erste Ebene; Vorschlag: Überlaufmenü im Kopf.

### Schwächen des Prototyps

- Auf dem Phone verdecken die Bahn-Karten den Anfang der Wertbalken (`11-phone-bahn.png`).
- Die Geister in der Feldmitte stehen bei 1600 px Breite dicht an der Platzkarte des Floor General.
- Die Positionsfarben sind frei gewählt, nicht die gerechneten Werte aus dem Gesamtkonzept 08.11.
  Abschnitt 4.3 (fünf Stimmungen je Kulisse).
- Zwei Schriften: RaniraSeason für Namen, Barlow Condensed für Zahlen, wie im Basketball-Entwurf.
  Das widerspricht Chris' Satz vom 30.09. („nutz nur den Font, den ich für alles vorgegeben hatte“),
  siehe Frage 1.

---

## Teil 3: Plan „Oly-Seiten aufhübschen“

### Gemeinsames Designsystem

Die App hat bereits 75 `--nl-*`-Variablen in `app/globals.css` (81 840 Zeilen) und `Nl*`-Bausteine
(`NlTable`, `NlEmptyState`, `NlGauge`). Der Plan ersetzt sie nicht, sondern legt eine zweite,
kleine Schicht darüber und zieht Seite für Seite um.

| Baustein | Inhalt | Herkunft |
|---|---|---|
| Tokens | Farben, zwei Schriften, Radien 6/10, Haarstrich 13 % / 30 % | `:root` der beiden Mockups, identisch mit dem Basketball-Entwurf |
| Schiene | 64 px Icon-Navigation mit Tooltip und Zähler; Phone: Leiste unten | neu, ersetzt die 280 px breite Seitenleiste |
| Hero-Kopf | Wappen, Dachzeile, Titel, schräge Kennzahl-Kacheln, eine Hauptaktion, Kulisse unscharf dahinter | neu |
| Tafel | Karte mit Kopfzeile (Hausschrift) und „mehr ›“ rechts | Tafel aus dem Basketball-Entwurf |
| Tabelle | Zahlen rechts, feste Ziffernbreite, eigene Zeile bernstein hinterlegt, Wappen 26 px | Boxscore |
| Spielerzeile / Spielerkarte | Portrait, Name, Klasse, Wert, Form, Last, Marke | Spielerkachel und Spielerkarte |
| Waage | schräger Zweifarbbalken mit Unsicherheit | Siegchance-Band |
| Marke, Chip, Schalter | Zustände und Filter | Foul-Marken, Filter im Spielverlauf |
| Prüfzeile | Symbol, Satz, Sprung | neu |
| Blatt (Phone) | Panel von unten | Tafel/Spielerkarte auf dem Phone |
| Tooltip | ein Muster für alle | F4 aus #1358 |

Ein `hud-system-17-11.md` liegt auf keinem Branch (`origin/claude/*hud*` enthält nur ältere
Staffel- und Eiskunstlauf-Arbeiten). Sobald es existiert, sollten Tokens und Bausteinnamen dort und
hier dieselben sein; die Tabelle oben ist dafür die Abgleichliste.

### Inventar und Aufwand

Aufwand in Arbeitstagen für Umbau auf die Bausteine inklusive Phone und Sichtprüfung, ohne neue
Funktionen. Zeilenzahlen der heutigen Hauptdatei als Maß für die Größe.

| Seite | Datei (Zeilen) | Ist | Zielbild | Tage |
|---|---|---|---|---:|
| Fundament | `shell/`, `globals.css` | Seitenleiste 280 px, klappt mobil nicht ein | Tokens, Schiene, Hero-Kopf, Tafel, Tabelle, Blatt als Komponenten | 4 |
| Einsatzliste | `LineupNewLook.tsx` (3096) + #1358 | siehe Teil 1 | Mockup 1 | 7 |
| Start | `HomeV2NewLook.tsx` (1013) | lange Spalte, 6er-Karten mit verwaister Karte, Radar und Board-Ziele weit unten | Mockup 2 | 3 |
| Inbox | `InboxV2NewLook.tsx` (827) | drei Stufen farblich kaum zu trennen | Prüfzeilen mit Sprung, Gruppen nach Dringlichkeit | 1,5 |
| Spieltag-Ergebnis | `MatchdayResultNewLook.tsx` (871) | Ergebnisliste | Hero mit Endstand, Boxscore-Tabelle, Spieler des Tages | 2,5 |
| Arena-Vorschau | `DisciplineStageArena.tsx` (3926) | eigener Stil neben dem Motor | Rahmen und Tafeln aus dem HUD-System, Inhalt bleibt | 3 |
| Saisonstand | `SeasonStandingsNewLook.tsx` (3589) | sehr dichte Tabelle, Platzhalterspalten vor Spieltag 1 | Tabelle mit festen Spalten, Hero mit Rang und Abstand, Disziplin-Kacheln | 4 |
| Kader / Teams | `FoundationTeamsNewLook.tsx` (2489), `FoundationTeamsDetailPanel.tsx` (3342), `TeamProfileNewLook.tsx` (2591) | Kartenrand-Farben ohne Legende | Hero mit Wappen, Spielerzeilen, Vertragsmarken | 5 |
| Spieler-Tabelle | `FoundationPlayersTableNewLook.tsx` (3494) | Podium mit leeren Ringen | Tabelle, Spielerkarte als Einblendung | 3,5 |
| Spielerprofil | `PlayerProfileClient.tsx`, `PlayerHeroNewLook.tsx` (613) | Hero vorhanden, Rest uneinheitlich | Hero-Kopf, Attributbalken wie Rollenkarte, Disziplin-Kacheln | 2,5 |
| Training | `TrainingCompactNewLook.tsx` (1475) | Tabelle mit unklaren Symbolen | Spielerzeilen mit Schalter, Last sichtbar | 2,5 |
| Gebäude | `FacilitiesV2NewLook.tsx` (1436) | Detail überdeckt Nachbarn | Tafeln mit Stufenleiste | 2 |
| Transfermarkt | `TransfermarktV2NewLook.tsx` (3211) | Lade-Skelett und „0 sichtbar“ zugleich | Tabelle, Filter-Chips, Spielerkarte, Verhandlung als Blatt | 5 |
| Scouting | `ScoutingCenterV2NewLook.tsx` (599) + Teile | Ausbau schon konzipiert (11.11.) | Scout-Stufe als Punkte wie im Gegner-Reiter | 2,5 |
| Finanzen, Kredite, Sponsoren | (1535 + 1447 + 1804) | drei eigene Stile | Kennzahl-Kacheln, Zeilen, Zielbalken | 4 |
| Saisonvorschau, Finale | `SeasonPreviewNewLook.tsx` (597), `FoundationSeasonFinalePanel.tsx` (435) | wenig Bild | Hero mit Pokal/Wappen, Rangtafel | 2 |
| Ewige Tabelle, Leaders, Ranks, Historie | (796 + 2470 + 1033 + 1206) | Tabellen | Tabelle, Kacheln | 4 |
| Merkliste, Lexikon, Settings, Changelog | klein | – | nur Tokens und Tafel | 1,5 |
| **Summe** | | | | **59,5** |

Nicht eingerechnet: Deep-Links (Brainstorm Punkt 19), neue Funktionen, PixelLab-Schmuck.

### Reihenfolge

| Welle | Inhalt | Tage | Ergebnis für Chris |
|---|---|---:|---|
| 0 | Fundament: Tokens, Schiene, Hero-Kopf, Tafel, Tabelle, Blatt, hinter Schalter | 4 | nichts Sichtbares, aber jede weitere Seite wird billiger |
| 1 | Einsatzliste | 7 | die Seite, die er an jedem Spieltag am längsten sieht |
| 2 | Start, Inbox, Spieltag-Ergebnis | 7 | der ganze Spieltags-Kreislauf sieht gleich aus |
| 3 | Saisonstand, Kader/Teams, Spielerprofil, Spieler-Tabelle | 15 | alles rund um Team und Liga |
| 4 | Transfermarkt, Scouting, Training, Gebäude | 12 | Markt und Entwicklung |
| 5 | Finanzen/Kredite/Sponsoren, Saisonvorschau/Finale, Tabellen-Seiten, Rest, Arena-Vorschau | 14,5 | Abschluss |

Welle 1 baut auf #1358 auf: dessen `formation-registry.ts`, `einsatzliste-anzeige.ts` und
`gegner-schaetzung.ts` liefern genau die Daten, die das Mockup erfindet. #1358 sollte deshalb vorher
gemergt oder gezielt als Datenbasis übernommen werden; seine Darstellung (`EinsatzlisteMiniFeld.tsx`)
wird ersetzt.

Regeln für jede Welle: neue Ansicht hinter einem Schalter neben der alten, bis Chris sie freigibt;
reine Anzeige, keine Änderung an Wertung oder Matrix; Sichtprüfung bei 1920 × 1080, 3840 × 2160 und
390 × 844; neuer CI-Job nur mit Weiche.

### Fragen an Chris

| # | Frage | Empfehlung |
|---|---|---|
| 1 | Zweite Schrift (Barlow Condensed, frei lizenziert, 64 KB) für alle Zahlen, wie im Basketball-Entwurf? | Ja. RaniraSeason bleibt für Namen und Überschriften; Zahlenkolonnen in Kursiv-Serife sind schlecht lesbar. |
| 2 | Schmale Icon-Schiene statt der breiten Seitenleiste? | Ja. Sie gibt 216 px Breite frei und löst das Mobil-Problem gleich mit. |
| 3 | Eine Disziplin zur Zeit mit Reitern statt beide nebeneinander? | Ja. Das Feld wird doppelt so groß, der Stand der anderen Disziplin bleibt im Kopf sichtbar. |
| 4 | Darf ein Spieler am selben Spieltag in beiden Disziplinen stehen? | Entwurf nimmt Nein an. Bitte bestätigen, davon hängt „Optimieren“ ab. |
| 5 | Welle 0 und 1 jetzt bauen (11 Tage), die anderen Wellen einzeln freigeben? | Ja. |
| 6 | PR #1358 vorher mergen? | Ja, als Datenbasis; die Mini-Feld-Darstellung daraus wird in Welle 1 ersetzt. |
| 7 | PixelLab-Schmuck (Rahmen, Banner) für die Seiten? | Nein. CSS und SVG reichen, bleiben scharf in 4K und kosten nichts. |

## Designsystem-Regeln, ergänzt 21.11. (Chris)

- **Alle Tabellen sortierbar**: Klick auf den Spaltenkopf sortiert, zweiter Klick dreht die Richtung.
- **Keine doppelte Information**: Steht ein Attribut als absolute Zahl da, nicht zusätzlich die Notenstufe (S/A/B/C…) daneben. Noten nur dort, wo keine Zahl sichtbar ist (z. B. Scouting-Nebel).
- **Klassen immer farblich hervorheben**: Klassenname bzw. -marke in der Klassenfarbe (`app/foundation/classVisuals.ts`: rot Berserker/Warlord/Tank, grün Sprinter/Rogue/Charger, blau Mage/Overseer/Templar, gelb Bard/Hero/Badass/Tactician).
- **Icons für Klasse und Rasse nutzen**, wo Platz ist: `public/class-icons/*.png` (`app/foundation/ClassIcon.tsx`), `public/race-icons/*.png` (`app/foundation/RaceIcon.tsx`) — statt reinem Text.
