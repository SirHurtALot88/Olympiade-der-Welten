# Arena-Vorstellung: Rework mit Slot-Ausrichtung (Mockup 22.11.)

Mockup: `public/mockups/arena-vorstellung-rework-22-11.html` (klickbar, Tasten 1–4 wechseln die Variante, N schaltet den Nebel).
Aufnahmen: `docs/design/arena-vorstellung-rework-22-11/` (1920×1080 und 2560×1440 je Variante, 1710×1112 für Hockey und Battlefield).
Status: **gebaut (22.11.)**, siehe Abschnitt 7. Das Mockup bleibt als Vorlage.

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

## 7. Umsetzung (22.11.)

Gebaut: `lib/foundation/battle-arena/arena-vorstellung-tafel.ts` (reine Logik, `baueVorstellungsTafel`), `ArenaVorstellung` und
`ArenaVorstellungAusSpielstand` in `app/foundation/battle-arena/ArenaVorraum.tsx`, CSS `app/foundation/battle-arena/arena-vorstellung.css`
(Masse des Mockups, alle Laengen ein Vielfaches von `--u`, das der Buehne folgt statt dem Fenster), Verdrahtung im Host
(`FoundationBattleArenaHost.tsx`, reicht `sheetsByPlayerId` und die gebuchte Kulissen-Variante durch). Der Motor ist unberuehrt;
der Wertungs-Fingerabdruck bleibt `ea36f666cc71`. Tests: `tests/arena-vorstellung-tafel.test.ts`.

### 7.1 Entscheidungen von Chris (22.11.) und wie sie umgesetzt sind

1. **Gegnerwerte exakt, ohne Modifikatoren.** Gegner und eigenes Team zeigen dieselbe Zahl: rohe Eignung
   (`player.disciplineRatings[disziplin]`) plus Slot-Bonus. Keine Form, Moral, Karte, Intensitaet, Muedigkeit. Der Slot-Bonus kommt aus
   `berechneSlotAufschlag` (neu exportiert in `lib/lineups/matchday-slot-roles.ts`, Wrapper um `resolveProfileRoleModifier`): Slotprofil
   gegen Grundprofil x 2,2, geklemmt auf +-8,5, dieselbe Formel wie `slotAufschlag()` im Motor (beide lesen `slotWeightProfile` /
   `baseWeightProfile` derselben Rolle; `generiere-arena-daten.ts` fuettert den Motor daraus). Einziger Sonderfall des Motors, Football x 0,35,
   steht als `VORSTELLUNG_FOOTBALL_SLOT_SKALA`; ein Test liest den Motor als Text und wird bei Drift rot. Die Zusammenfuehrung steht in
   `eignungImSlot()`. Das eigene Team zeigt Form (`baueFormMoralAnzeige`), Moral (`BcMoralGesicht`) und Kartenwert je Spieler
   (`berechneKartenWirkung` -> `calculateFormModifierForSide`) zusaetzlich als Marken, nicht in der Zahl. Der Scouting-Nebel-Balken des Mockups entfaellt.
2. **Gegnerische Formkarte verdeckt:** die Struktur des Gegners traegt keine Karten (`eigenInfo` ist dort `null`).
3. **Feldplan je Slot in Feldspielen:** Positionen aus `formationFuerSeite` (`lib/lineups/formation`, Anzeige-Kopie der Motor-Tabellen, Drift-Test
   `tests/einsatzliste-formation.test.ts`). Gezeichnet nur fuer die Feldarten Halbfeld (Basketball), Eis (Hockey), Football; Marke gefuellt, wenn der Motor den
   Platz haelt, sonst hohl gestrichelt (Hockey: nur Torwart gefuellt). Gegner-Marke nur, wo die Registry einen Gegnerplatz kennt (Basketball). Andere
   Disziplinen: kein Feldplan.

### 7.2 Geprueft und festgehalten

- Fechten, Tennis, Speed-Schach, Gewichtheben, Breaking paaren nach Slot (`nachSlotgeordnet`: `mineGeordnet[i]` gegen `gegnerGeordnet[i]`): Zeile
  heisst dort "Gefecht"/"Duell". Staffel: Zeile = Laufreihenfolge (`staffelNachSlot`). Bahn sonst "Laeufer", Climbing "Kletterer", sonst "Slot".
- Zeile = `slotIndex` des Entwurfs, Rolle ueber `resolveSlotRoleShortId` mit Kopfzahl k (Battlefield je k); k aus dem Spielplan, sonst aus den Entwuerfen.
- Verletzungsgesperrte (`ermittleVerletzungsgesperrteAmSpieltag`) stehen in keiner Zelle, beim eigenen Team unter "Nicht aufgestellt".
  Wer heute verletzt antritt (50 %), wird hier nicht abgezogen: die Zahl ist roh. Kein Entwurf fuer ein Team: Hinweis "Motor stellt reihum auf", Zellen leer.
- Eigenes Team = `ownTeamId` (Host: `spieltag.podTeamId` aus `activeManagerTeamId`), Manager-Chip aus `displayLabel`/`ownerId` der Team-Steuerung, sonst "KI".
- Vergleich je Zeile ("vorn +n", "gleich"; Pod "Du: vorn gegen n von m") rechnet mit den gezeigten, gerundeten Zahlen.

### 7.3 Abgleich Mockup gegen Bau (Bildpaare in `arena-vorstellung-rework-22-11/gebaut/`)

drin: Kopf mit Disziplin, Spielart, Punkteschema und Marken; Duell-Raster (Teamtafel | Spieler | Slot | Spieler | Teamtafel) und Pod-Raster (Slot-Spalte + 4 Teamspalten, eigenes zuerst);
Slot-Zelle mit Nummer, Name, zwei Schluesselattributen; Figur (PixelLab, Blick zur Mitte) oder Portraet-Marke; Klasse mit Icon in Klassenfarbe, Rasse; Eignung im Slot;
Form, Moral-Gesicht, Captain, Kartenwert je Spieler; Teamtafel mit Saison-Rang, Disziplin-Rang, Punkten, Staerke; Formkarten-Block, Einsatz, "Nicht aufgestellt" mit Verletzten;
verdeckte Gegnerkarte; Leerzelle; Klick auf Zeile zeigt den Rollentext im Fuss; Fuss mit Legende, Quick-Sim, Zur Arena.
angepasst: Gegnerwerte exakt statt Nebel-Stufen (Chris); "offen" heisst jetzt "gleich" und zeigt den Abstand; Staerke fremder Teams als Balken, eigene exakt;
Feldplan aus der Registry statt erfundener Punkte (Hockey nur eigene Marke); Seitentafeln 17,5 statt 19 Einheiten (laengere Namen bei 16:10); Regieleiste nicht doppelt, die Huelle der Arena traegt sie;
Hintergrund = gebuchte Kulisse; Marke "Einsatzlisten gesperrt" nur, wenn alle Entwuerfe gesperrt/gewertet sind; Initialen-Marke, wenn weder Figur noch Portraet-Datei vorhanden.
fehlt: Mockup-Leiste (Tasten 1-4, N, Nebel-Schalter) und das Enter-Kuerzel am Knopf (kein Tastenkuerzel im Host); Siegchancen (nie vorgesehen).

### 7.4 Aufnahmen: ehrlicher Stand

Der lokale Dev-Server der App wurde dreimal vom Speicherlimit beendet (Kompilieren von `/api/matchday/arena-base` ueber 11 GB), die Aufnahme aus der
laufenden App (Arena-Reiter, Zur Arena) ist daher **nicht** gelungen. Stattdessen: die ECHTE Komponente `ArenaVorstellung` mit der ECHTEN Tafel aus einem Wegwerf-Spielstand (Battle, 32 Teams, KI-Aufstellungen ueber
`applyAiLegacyLineupBatchLocally`), statisch gerendert in einer nachgebauten Huelle (Icon-Schiene 64 px, 40-px-Leiste). 1920x1080 und 2560x1440: Hockey (Feld), Fechten (Buehne), Staffel (Bahn),
Battlefield (Pod); 1710x1112: Hockey, Battlefield; dazu Mini-DM, Basketball, Football und ein Hockey-Stand mit Form/Moral/Verletzung. Kein Seitenscroll, keine Ueberlappung, kein abgeschnittener Text gemessen.
Offen: eine Aufnahme aus der laufenden App auf einem Rechner mit genug Speicher.
