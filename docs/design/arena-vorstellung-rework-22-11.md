# Arena-Vorstellung: Rework mit Slot-Ausrichtung (Mockup 22.11.)

Mockup: `public/mockups/arena-vorstellung-rework-22-11.html` (klickbar, Tasten 1–4 wechseln die Variante, N schaltet den Nebel).
Aufnahmen: `docs/design/arena-vorstellung-rework-22-11/` (1920×1080 und 2560×1440 je Variante, 1710×1112 für Hockey und Battlefield).
Status: **nur Mockup**, kein App-Code. Gebaut wird erst nach Chris' „bau das“.

Auslöser, Chris am 22.11.: „Slot-Namen war gemeint im Screen bevor es losgeht, dass Leute mit gleichen Slots im Screen an
derselben Stelle stehen. Der Screen muss eh noch ein Rework bekommen.“

## 1. Problem

- Die heutige React-Vorstellung (`ArenaVorstellung` in `ArenaVorraum.tsx`) zeigt nur Teamkarten: Rang, Punkte, Stärke.
  Kein einziger Spieler, kein Slot. Der Satz „Deine Aufstellung steht in der Arena links“ ersetzt die Aufstellung.
- Die Vorstellung im Motor (`renderEinlauf()` in `battle-mode.engine.js`) listet die Spieler, aber je Seite in der
  Reihenfolge der Einheiten. Derselbe Slot steht links und rechts auf verschiedenen Höhen, im Pod sieht man nur zwei der
  vier Teams (`einlaufSeiten()`).
- Es gibt damit zwei Vorstellungen mit zwei Sichten, und keine beantwortet „wer steht bei mir und beim Gegner auf
  welcher Position“.

## 2. Lösung: eine Zeile = ein Slot

Der Screen ist eine Aufstellungstafel. Die Zeilen sind die Slots der Disziplin in der Reihenfolge der Einsatzliste,
die Zeilenhöhe ist für alle Seiten dieselbe.

| Spielart | Aufbau |
|---|---|
| **Duell** (Feldspiel, Bühne, Bahn, Kampf) | Teamtafel links · eigene Spieler · **Slot-Spalte in der Mitte** · Gegner · Teamtafel rechts. Die Figuren schauen sich je Zeile an, die Eignungszahlen stehen direkt an der Slot-Spalte. |
| **Vierergruppe** (Battlefield, Mini-DM, Staffel, Takeshi) | Slot-Spalte links, danach **vier gleich breite Team-Spalten**. Das eigene Team steht in Spalte 1 mit orangem Rahmen. Kein „A gegen B“. |

Die Slot-Zelle nennt Nummer, Slot-Name und die zwei Schlüsselattribute des Slots. Ein Klick auf die Zeile zeigt unten den
Rollentext. Die Zeilenzahl folgt der Kopfzahl k des Spieltags (1–6); bei wenigen Slots wachsen Zeilen und Figuren.

Unterschiede je Disziplin-Art:

- **Feldspiel:** die Slot-Zelle trägt zusätzlich einen kleinen Feldplan mit dem Platz des Slots (orange eigene Seite,
  türkis gespiegelt der Gegner).
- **Bühne mit Paarung** (Fechten, Tennis, Speed-Schach): die Zeile heißt „Gefecht 1…k“, weil dort Slot i gegen Slot i
  antritt (Paarungsblock in `bauBuehne()`). Bei Bühnen ohne Paarung bleibt es bei „Slot“.
- **Bahn:** die Zeile heißt „Läufer 1…k“; bei der Staffel ist das zugleich die Laufreihenfolge.
- **Unbesetzter Slot** (Kader zu klein): gestrichelte Leerzelle in derselben Zeile, die Ausrichtung bleibt.

## 3. Was je Spieler gezeigt wird und woher es kommt

| Anzeige | Eigenes Team | Fremde Teams | Datenquelle |
|---|---|---|---|
| Slot je Spieler | ja | ja (Listen sind gesperrt) | `LineupDraft` des Spieltags → `buildArenaAufstellung` (`arena-aufstellung-adapter.ts`), Slot-Reihenfolge und Texte aus `resolveSlotRolesForDiscipline` (`matchday-slot-roles.ts`) |
| Figur | PixelLab-Figur, Blick zur Mitte (Duell) bzw. nach vorn (Pod) | ebenso | `data/generated/figuren-sprites.json`, `public/sprites/figuren/<slug>/east|west|south.png`; ohne Figur die runde Porträt-Marke wie in der Arena |
| Name, Klasse in Klassenfarbe mit Icon, Rasse | ja | ja | `Player.className`/`race`, `app/foundation/classVisuals.ts`, `public/class-icons/` |
| Eignung im Slot | exakt | **nach Scouting-Stufe:** unbekannt 10er-Stufe, beobachtet 5er-Stufe, gescoutet exakt | eigene Zahl wie in der Einsatzliste (`einsatzliste-modern-logik.ts`); fremde über `nebelBreite` (`spielerprofil-modell.ts`) bzw. die Spannen aus `gegner-schaetzung.ts` |
| Form (Stufe −2…+2 mit Wort) | ja | nein | `playerFormState`, `formToStufe`, `FORM_STUFEN_WORT` |
| Moral (Gesicht + Zahl) | ja | nein | `BcMoralGesicht` |
| Formkarte je Spieler („Karte +2“, „+4 · Farbbonus“) | ja | nein | `calculateFormModifierForSide` → `formByPlayerId` (die eine Wahrheit) |
| Captain (C) | ja | nein | Aufstellungsentwurf |
| „vorn / offen“ je Zeile | Duell: Pfeil zur stärkeren Seite; Pod: „vorn gegen n von 3“ | – | `duellStand()` (`einsatzliste-gegner-vergleich.ts`): „vorn“ nur, wenn der eigene Wert außerhalb der gegnerischen Spanne liegt, sonst „offen“ |

Teamtafel (Duell am Rand, Pod als Kopfzeile): Wappen, Manager (Mensch/KI), Saison-Rang und Punkte, Disziplin-Rang (Liga
groß, klein gegen alle 32), Kaderstärke über die besten 6 (eigene Zahl; fremde als grobe Stufe mit fünf Balken) — alles
aus `baueVorraumTeams`. Beim eigenen Team dazu die gelegte Formkarte, der Einsatz (Schonen/Normal/Push) und „Nicht
aufgestellt“ mit Verletzten (`ermittleVerletzungsgesperrteAmSpieltag`, „nicht einsetzbar“, nie als Formabzug). Beim Gegner
die verdeckte Formkarte und ein Balken „Dein Scouting-Stand für diese Aufstellung“.

Bewusst **nicht** drin: Siegchancen, Prognosen, Tipps. Dafür gibt es keine Datenquelle, und der Vorlauf hat das Ergebnis
schon gerechnet. „Vorn/offen“ ist nur der Vergleich zweier gezeigter Zahlen.

Im Mockup erfunden sind alle Zahlen, die Zuordnung Spieler → Slot, die Scouting-Stufe je Spieler und die Punkte im
Feldplan. Echt sind Teams, Spieler, Klassen, Rassen, Figuren, Porträts, Kulissen, Slot-Namen und -Texte.

## 4. Was sich gegenüber dem Mockup vom 18.11. ändert

- Die Teamkarten-Reihe entfällt als Hauptinhalt; die Aufstellung ist der Screen.
- Regieleiste, Kopf mit Punkteschema und Fuß mit „Quick-Sim“/„Zur Arena“ bleiben wie in `arena-spieltag-modern-18-11.html`.
- Die Regel „Gegner zeigt keine Eignung der Einsatzplätze“ wird ersetzt durch „Gegner zeigt sie in Nebel-Stufen“ — siehe Frage 1.

## 5. Bau-Hinweise (für den späteren Sonnet-Bau)

1. **Logik, kein React:** neue Datei `lib/foundation/battle-arena/arena-vorstellung-tafel.ts` mit
   `baueVorstellungsTafel({gameState, teamIds, ownTeamId, disciplineId, matchdayId})` →
   `{ slots: [{nr, roleId, label, text, schluesselAttribute}], teams: [{…VorraumTeam, zellen: (Zelle|null)[]}] }`.
   Zeilen aus `resolveSlotRolesForDiscipline` mit dem k des Spieltags; Zellen je Team über die Rollen-Kennung
   (`resolveSlotRoleShortId`) aus demselben Aufstellungsobjekt, das der Host dem Motor gibt — nicht neu ableiten
   (gezeigt = gebucht). Fremde Werte laufen durch eine einzige Nebel-Funktion; der Schalter „Fog of War aus“ gilt auch hier.
2. **Komponente:** `ArenaVorstellung` in `ArenaVorraum.tsx` neu schreiben (eigenes CSS im Mockup-Stil, Tokens
   `--schrift-haus`/`--schrift-zahl`), Bausteine `VorstellungTeamtafel`, `VorstellungSlotZelle`, `VorstellungSpielerZelle`.
   Duell und Pod teilen sich die Zellen, nur das Raster unterscheidet sich. `ArenaLadebild` bleibt.
3. **Host:** `FoundationBattleArenaHost.tsx` reicht die Tafel statt nur `VorraumTeam[]` durch; im Pod die gebuchte
   Gruppe aus `podTeamIds`. Im Spieltag ersetzt der Screen die Motor-Vorstellung (`renderEinlauf`); der Motor bleibt
   unangetastet, der Wertungs-Fingerabdruck darf sich nicht bewegen.
4. **Mehrspieler:** eigenes Team aus `activeManagerTeamId`; Nebel und Scouting-Stand je Manager; keine Schreibwege.
5. **Feldplan:** Positionen je Slot aus der Formation des Motors lesen (nur Anzeige). Fehlt eine Quelle für eine
   Disziplin, entfällt der Feldplan dort statt geschätzt zu werden.
6. **Tests:** Zeilenreihenfolge = Einsatzliste für k = 1…6; gleicher Slot = gleicher Zeilenindex in allen Teams (auch
   Battlefield mit `ROLE_THEME_IDS_BY_SLOT_COUNT`); unbesetzter Slot ergibt `null`, keine Verschiebung; fremde Werte nie
   exakt unterhalb „gescoutet“; Verletzte nie in einer Zelle.
7. **Abgleich:** Aufnahmen aus der echten App bei 2560×1440, 1920×1080 und 1710×1112 neben den Mockup-Bildern, mit je
   einem Feldspiel, einer Bühne, einer Bahn und Mini-DM/Battlefield sowie k = 2 und k = 6.

Keine PixelLab-Bestellung nötig. Spieler ohne Figur zeigen die Porträt-Marke.

## 6. Offene Fragen an Chris

1. **Gegnerwerte in der Vorstellung:** Nebel-Stufen wie im Mockup (Empfehlung, passt zur Scouting-Regel) — oder exakt,
   weil die Einsatzlisten gesperrt sind? Die heutige Motor-Vorstellung zeigt beide Seiten exakt.
2. **Gegnerische Formkarte:** verdeckt bis zum Anpfiff wie bisher (Mockup) — oder mit der Vorstellung aufdecken?
3. **Feldplan in Feldspielen** (kleines Feld je Slot-Zeile): behalten oder weglassen?
