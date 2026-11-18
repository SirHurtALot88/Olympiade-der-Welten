# Arena und Spieltagswertung im neuen Stil, für zwei und vier Teams (18.11.)

Anlass, Chris am 18.11. abends nach dem Live-Spieltag 1: „Die ganze Spieltagswertung muss natürlich auch noch
mit einem neuen Mockup gereworked werden … weil das 4 Teams sind und das noch nicht darauf ausgelegt ist, bitte
also Arena auch mit Mockup alle Screens upgraden.“

Mockup (klickbar): `public/mockups/arena-spieltag-modern-18-11.html`
Bilder: `docs/design/arena-spieltag-modern-18-11/`

Das Mockup ist kein App-Code. Es übernimmt das Designsystem der Mockups vom 17./18.11. unverändert (Tokens,
Barlow Condensed lokal, Ranira für Namen, Schrägkanten, Karten, Entwurfsmaß 120 × 67,5 rem) und die Arena-Bauteile
aus `app-rahmen-modern-18-11.html` (Tafel, Spielverlauf, Bedienleiste). 0 PixelLab-Generationen.

**Echt:** Teamnamen, Wappen, Spielernamen, Portraits, Figuren, Kulissen, Punkteschema (Duell 2 / 1 / 0,
Vierergruppe 2-1-0-0), die Statistik-Spalten K/T/B/CC/H/S/SCH/ERL/FF/IMP, die Spalten der heutigen
Spieltagswertung. **Erfunden:** jede Zahl, die Kaderzuordnung, die Rollen, die Liga-Einteilung, welcher Mensch
welches Team steuert (außer Chris = Nunchuck Ninjas), der Spieltag (im Mockup Spieltag 2, damit eine
Rangbewegung zu sehen ist).

## 1. Was heute nicht stimmt

| Befund aus den Screenshots | Ursache im Code | Antwort im Mockup |
|---|---|---|
| Kopf „Nunchuck Ninjas vs Natures Wrath“ und Stand „0·0·0·0“, Vorstellungskarte aber „Mayhem Mavericks vs Project Suicide“ | Der Host kennt nur Heim und Gast. Für eine Vierergruppe setzt `bestimmeArenaSpieltagAnsicht` (`lib/foundation/battle-arena/arena-spieltag-ansicht.ts`) `gastTeamId` auf den Fixture-Gegner aus D1; der Motor stellt dagegen die Gruppe in ihrer eigenen Reihenfolge vor (Team 0 gegen Team 1). Zwei Bauteile, zwei Paarungen. | Vierergruppen haben eigene Screens mit vier gleichwertigen Feldern. Es gibt dort kein „A vs B“ mehr. |
| Ergebnis „SIEGER — 0·88·112·0 KONTROLLPUNKTE (4-TEAM-FFA)“, vier kleine Tabellen | `renderEndstand()` im Motor (`public/mockups/battle-mode.engine.js`, `ESPALTEN`) baut je Team eine Tabelle, die Reihenfolge ist die Gruppen-Reihenfolge, nicht die Platzierung. | Rangfolge 1–4 groß, Liga-Punkte daneben, eine Statistik-Tabelle mit Reitern statt vier. |
| Erklärkarte „Das ist das Spiel, das für diesen Spieltag gewertet wird …“ ist Fließtext | `FoundationBattleArenaHost.tsx`, Zweig `if (spieltag)` | Regieleiste mit Schritt-Anzeige plus drei Fakten-Kacheln im Ladebild. |
| Spieltagswertung ist eine kleine kursive Tabelle, Werte doppelt, Mod-Pfeile unklar | `DisciplineStageMatchdayPanel.tsx`: je Team zwei Zeilen (D1/D2) mit Spieler-Chips in der Team-Spalte, Form-Score und Captain-Score als Spalten direkt neben den Punkten, obwohl sie sich nicht addieren lassen | Eine Zeile je Team, Spaltengruppen „Ergebnis“ und „Wirkung im Score“, Spieler und Aufschlüsselung im Blatt rechts. |
| „Obwohl ich N-N steuere, geht er auf ein anderes Spiel, wenn ich zu Diszi 2 wechsle“ | Noch nicht nachgemessen, siehe Abschnitt 4. | Eigener Wechsel-Screen, der immer beim eigenen Spiel landet; fremde Spiele nur als bewusste Wahl. |

## 2. Die Screens

Alle Screens teilen eine **Regieleiste** (3,5 rem): links zurück ins Büro und der Ort (Spieltag, Liga), in der
Mitte die drei Schritte des Spieltags (Disziplin 1, Disziplin 2, Spieltagswertung; erledigt = grüner Haken,
aktuell = Gold), rechts die Mitspieler im Raum und fest die Marke „Du steuerst: Nunchuck Ninjas“. Das eigene Team
ist auf jedem Screen dreifach markiert: Farbe Orange, goldene Marke „Dein Team“, goldener Rahmen.

Farben im eigenen Spiel: eigenes Team immer Orange (`--heim`), die anderen in Gruppen-Reihenfolge Türkis
(`--gast`), Violett, Rosa. Die zwei neuen Farben sind die einzige Erweiterung des Farbsatzes.

| # | Screen | URL | Inhalt |
|---|---|---|---|
| 1 | Laden | `?sc=laden` | „Arena wird vorbereitet“, Disziplin 1 von 2, Paarung mit eigenem Team, Fortschritt in vier Schritten (Kader, Aufstellung, Saat, Aufbau), drei Fakten statt Fließtext (gezeigt = gebucht · zuschauen oder Quick-Sim · Abpfiff bucht), Ausblick auf Disziplin 2 mit den vier Wappen |
| 2a | Vorstellung Duell | `?sc=vor2` | Zwei Teamkarten, Punkteschema, eigene Aufstellung mit Eignung, Formkarte und Captain; Gegner mit groben Stärke-Marken, Formkarte verdeckt |
| 2b | Vorstellung Vierergruppe | `?sc=vor4` | Vier Teamkarten, die eigene breiter und vorn, Punkteschema Platz 1–4, Hinweis, dass der D1-Gegner auch in der Gruppe sitzt |
| 3a | Live Duell | `?sc=live2`, `&lauf=1` | Tafel, Spielverlauf, Spielerleisten, Bedienleiste. Vor dem Start: Stand „–“, Startkarte, leerer Verlauf |
| 3b | Live Vierergruppe | `?sc=live4`, `&lauf=1` | Vierer-Tafel, Kontrollpunkte A/B/C in Teamfarbe, Turm „Rangfolge live“ mit „aktuell wert“, eigene Spielerleisten. Vor dem Start keine Platzziffern und keine Zahlen |
| 4a | Ergebnis Duell | `?sc=erg2` | Banner Sieg/Niederlage mit Endstand und Vierteln, „+2 Pkt gebucht“, Spieler des Spiels, Szene des Spiels, Statistik mit PP je Spieler für beide Teams, Höhepunkte, „Was das heißt“ (Disziplin 2 noch verschlossen) |
| 4b | Ergebnis Vierergruppe | `?sc=erg4`, `&tab=N-N` | Banner „Platz 1 von 4“, Rangfolge 1–4 mit Kontrollpunkten und Liga-Punkten, Spieler des Spiels, Szene, eine Statistik-Tabelle (alle 16 nach PP oder je Team), Legende der Kürzel, Höhepunkte als Chips in Teamfarbe |
| 5 | Spieltagswertung | `?sc=wertung`, `&liga=l2\|l1\|alle\|gruppe\|mensch`, `&team=…` | siehe Abschnitt 3 |
| 6 | Wechsel D1 → D2 | `?sc=wechsel`, `&fremd=1` | siehe Abschnitt 4 |

Tasten im Mockup: `←` `→` blättern durch den Ablauf, Leertaste startet/pausiert auf den Live-Screens.

### Kein Spoiler vor dem Start

Der Vorlauf hat das Ergebnis bereits gerechnet, bevor man zuschaut. Deshalb gilt für beide Live-Screens: vor dem
Anpfiff zeigen Tafel, Turm und Spielerleisten „–“ statt 0 oder einer Prognose, der Turm hat keine Platzziffern,
die Reihenfolge ist die der Gruppe mit dem eigenen Team vorn. In der Vorstellung steht beim Gegner nur „Kader
(beste 6) ≈ 59“ und grobe Marken je Spieler, nie die Eignung der Einsatzplätze (CLAUDE.md: Kaderstärke über die
besten 6, sonst spoilert sie). Die gegnerische Formkarte bleibt bis zum Anpfiff verdeckt.

## 3. Spieltagswertung neu

Aufbau: links die Tabelle, **eine Zeile je Team**; rechts ein Blatt mit der Aufschlüsselung des angeklickten
Teams (Start: eigenes Team). 16 Teams passen ohne Scrollen auf 1080 Zeilen Höhe, bei „Alle 32“ scrollt nur der
Tabellenkörper.

**Spalten und was sie bedeuten**

| Gruppe | Spalte | Bedeutung | heutiges Feld |
|---|---|---|---|
| | # | Rang nur dieses Spieltags, nach Gesamt | `matchdayRank` (Sortierung `total`) |
| | Team | Wappen, Name, Marke „Du“ bzw. Name des Menschen | `teamMeta`, `teamControlSettings` |
| Ergebnis | Basketball / Battlefield | Marke S/N bzw. 1.–4., Endstand, Punkte aus dem Platz | `d1Points`/`d2Points` (ohne Mutator), Endstand aus `teamResults` der Preview |
| Ergebnis | Punkte | Summe der beiden Disziplinen | `sum` |
| Ergebnis | ◆ Mutator | Bonus, violett, mit Spieler im Blatt | `MatchdayPanelMutatorEntry` |
| Ergebnis | Gesamt | Punkte + Mutator, die große Zahl | `totalPoints` |
| Wirkung im Score | Form | Beitrag der Formkarten zum Score, keine Punkte | `formModifier` (`matchday-team-modifiers.ts`) |
| Wirkung im Score | Captain | Beitrag des Captains zum Score, keine Punkte | `captainBonus` |
| Saison-Rang | vor → nach | Rang vor und nach dem Spieltag mit Bewegungsmarke | `currentRank`/`projectedRank` |

Form und Captain stehen bewusst in einer eigenen Spaltengruppe mit der Überschrift „Wirkung im Score · keine
Punkte“ und rechts von „Gesamt“. Heute stehen sie zwischen „Punkte“ und „Gesamt“; das legt nahe, man könne sie
addieren. Die Fußzeile sagt es in einem Satz.

**Das Blatt rechts** zeigt je Disziplin: Ergebnis in Worten („Sieg 78 : 71 gegen Natures Wrath“, „Platz 1 von 4 ·
112 Kontrollpunkte · Gruppe 1“), die Punkte, drei Kacheln (Formkarte mit Kürzel und Wirkung, Captain mit Name und
Wirkung, Mutator-Bonus) und die eingesetzten Spieler mit Portrait, Rolle, PP und Mutator-Marke. Unten die
Rechnung in einer Zeile: Basketball + Battlefield + Mutator = Gesamt. Damit entfallen die zwei Zeilen je Team und
die Spieler-Chips in der Tabelle; kein Wert steht doppelt.

**Filter:** Liga 2, Liga 1, Alle 32, Meine Gruppe (die vier Teams der eigenen Vierergruppe), Menschen. Jeder
Spaltenkopf sortiert. Solange Disziplin 2 nicht gespielt ist, bleibt ihre Spalte samt Gesamt, Rang nach dem
Spieltag und dem zweiten Block im Blatt verschlossen (wie heute `sideRevealed`); im Mockup ist dieser Zustand im
Ergebnis-Screen 4a unter „Was das heißt“ zu sehen, nicht in der Tabelle.

## 4. Wechsel von Disziplin 1 zu Disziplin 2

Regel: **Der Wechsel öffnet immer das Spiel des Teams, das ich steuere.** Der Screen zeigt links die gebuchte
Disziplin 1 (Ergebnis, Punkte, Spieler des Spiels), in der Mitte „gleiches Team, neues Spiel“, rechts die eigene
Vierergruppe von Disziplin 2. Daneben steht die Liste aller Spiele der Disziplin; das eigene ist vorgewählt und
trägt „Dein Spiel · Standard“. Ein fremdes Spiel öffnet man nur über „nur ansehen“. Dann liegt ein goldener
Balken über dem Screen: „Du schaust gerade Gruppe 2 an. Das ist nicht dein Spiel“ mit dem Knopf „Zurück zu meinem
Spiel“ (`?sc=wechsel&fremd=1`). Im Raum landet jeder Mensch bei seinem eigenen Team; der Host schaltet weiter.

**Zum Fehler selbst** (vor dem Bau messen, nicht raten):

- `ownTeamId` in `DisciplineStageArena.tsx` kommt im Raum aus dem Besitz (`teamControlSettings`), sonst aus
  `activeManagerTeamId ?? selectedTeamId`. Der Wechsel selbst ist nur `setDisciplineId(secondDisciplineId)`.
- Für eine Vierergruppe liefert `bestimmeArenaSpieltagAnsicht` `heimTeamId = ownTeamId` und als `gastTeamId` den
  Fixture-Gegner. Der Host sucht die Gruppe richtig über `podTeamId`, baut den Kopf aber aus Heim und Gast.
  Das erklärt „N-N vs Natures Wrath“ im Kopf einer Vierergruppe.
- Der Motor stellt die Gruppe in der Reihenfolge von `battlefieldPod.teamIds` vor. Ist das eigene Team dort
  Nummer 2 oder 3, sieht die Vorstellungskarte aus wie ein fremdes Spiel („Mayhem Mavericks vs Project
  Suicide“), obwohl es die eigene Gruppe ist. Wahrscheinlich ist genau das Chris' Eindruck; möglich ist aber
  auch ein echter Fremdtreffer, wenn `ownTeamId` beim Wechsel auf `selectedTeamId` zurückfällt.
- Prüfen im Save-Abbild von Spieltag 1: Ist Nunchuck Ninjas Mitglied der gezeigten Gruppe? Wenn ja, ist es ein
  reines Anzeigeproblem (Stufe 1 unten). Wenn nein, ist es ein Auswahlfehler und bekommt einen eigenen Test.

## 5. Datenquellen im Code

| Screen | Daten | Quelle |
|---|---|---|
| Regieleiste | Spieltag, D1/D2, eigenes Team, Raum | `matchdaySides`, `ownTeamId`, `roomContext` in `DisciplineStageArena.tsx` |
| Laden | Ladezustand | `ladeKader`, `motorBereit`, `arenaVorlaufStatus` in `FoundationBattleArenaHost.tsx` |
| Vorstellung | Paarung / Gruppe | `bestimmeArenaSpieltagAnsicht`, `getMiniDmPodForTeam`, `findeArenaPodMitVorschau`, `bahnPodNutzlast` |
| Vorstellung | Aufstellung, Formkarte, Captain | `arena-aufstellung-adapter.ts`, `calculateFormModifierForSide`, `formkartenBuchung` |
| Live | Stand, Uhr, Verlauf, Spielerwerte | Motor (`battle-mode.engine.js`), HUD-Baukasten `HUD_PROFIL` (`docs/design/hud-system-17-11.md`) |
| Ergebnis | Platz, Punkte, Statistik, Szene, Höhepunkte | Motor `renderEndstand`, `ESPALTEN`, `waehleSzeneDesSpiels`; gebucht: `beschreibeGebuchtesArenaErgebnis` |
| Ergebnis | PP je Spieler | Resolve-Preview (`MatchdayPanelPlayerRow.pp`), nicht aus dem Motor neu gerechnet |
| Spieltagswertung | alles | Props von `DisciplineStageMatchdayPanel.tsx` (Tabelle Abschnitt 3), `use-arena-standings-preview.ts` |
| Wechsel | Spiele der Disziplin | `getPodsForMatchday`, `findeSpieltagsFixtures` |

Gezeigt = gebucht bleibt die Regel: Punkte und PP in Ergebnis und Wertung kommen aus der Preview bzw. dem Ledger.
Der Motor liefert nur Verlauf, Statistik und Bilder. Wo beide eine Zahl haben (Endstand), prüft heute schon
`zeigtArenaDenGebuchtenSieger`; für Vierergruppen braucht es dieselbe Prüfung auf die Platzierung.

## 6. Fragen an Chris

1. **Eigenes Team immer links / vorn?** Im Mockup steht es im Duell links und in der Vierergruppe im ersten Feld
   (vor dem Start), danach nach Platz sortiert. Im Motor ist Seite 0 das Heimteam des Fixtures. Empfehlung: nur
   die Anzeige ordnen, die Seiten im Motor nicht tauschen (sonst ändert sich die Wertung). Auswärts stünde das
   eigene Team dann in der Tafel links, auf dem Feld aber rechts. In Ordnung, oder soll die Tafel dem Feld folgen?
2. **Vierer-Tafel während des Spiels:** feste Plätze (wie im Mockup, Platz steht klein darüber) oder sollen die
   Felder bei Führungswechsel die Plätze tauschen? Der Turm links sortiert in jedem Fall live.
3. **Mutator-Bonus:** Heute ist „Gesamt = Punkte + Mutator“, der Bonus (0,3) zählt also in die Tabelle. Soll das
   so bleiben? Das Mockup zeigt es so, in Violett abgesetzt.
4. **Form und Captain in der Tabelle:** als eigene Spaltengruppe behalten (Mockup) oder ganz ins Blatt rechts
   verschieben? Ohne die zwei Spalten wird die Tabelle ruhiger, man kann dann aber nicht mehr danach sortieren.
5. **Fremde Spiele ansehen:** Soll das im Spieltag überhaupt gehen (Mockup: ja, als bewusste Wahl mit goldenem
   Balken), oder nur das eigene Spiel und der Rest erst nach der Wertung?
6. **Mehrspieler:** Schaut jeder Mensch sein eigenes Spiel gleichzeitig, und der Host schaltet nur den Schritt
   weiter (Mockup)? Oder schauen alle nacheinander gemeinsam jedes Menschen-Spiel?
7. **Zwei neue Teamfarben** (Violett, Rosa) für Team 3 und 4 in Ordnung, oder lieber die echten Teamfarben aus
   `team-colors.ts`? Echte Farben sind schöner, zwei Teams einer Gruppe können sich dann aber ähneln.
8. **Quick-Sim:** direkt auf den Ergebnis-Screen (Mockup) oder mit kurzer Zeitraffer-Fahrt durch die Arena?
9. **Statistik-Tabelle der Vierergruppe:** Start mit „Alle 16 nach PP“ (Mockup) oder mit dem eigenen Team?

## 7. Bauplan in Stufen

Jede Stufe ist für sich lieferbar. Keine berührt die Wertung; der Fingerabdruck muss bei `ce8fcef66028` bleiben.

| Stufe | Inhalt | Dateien | Risiko |
|---|---|---|---|
| 0 | Messen: Abbild von Spieltag 1 laden, prüfen, welche Gruppe die Arena für N-N in D2 zeigt (Abschnitt 4). Test, der für jede Disziplin-Art „eigenes Team ist im gezeigten Spiel“ festschreibt. | `arena-spieltag-ansicht.ts`, neuer Test | klein |
| 1 | Regieleiste und Ladebild als eigene Komponente, Fließtext raus. Kopf für Vierergruppen aus der Gruppe statt aus Heim/Gast. | `FoundationBattleArenaHost.tsx`, `ArenaVollflaecheBuehne.tsx`, neues CSS | klein |
| 2 | Spieltagswertung neu als eigene Komponente (Tabelle + Blatt), alte `DisciplineStageMatchdayPanel` danach entfernen. Props bleiben, nur die Darstellung ist neu. | neue Komponente unter `app/foundation/discipline-stage/`, Tests der Sortierung übernehmen | mittel (viele Zustände: verschlossen, keine Aufstellung, Arena-Ausfall, Verletzung) |
| 3 | Wechsel-Screen D1 → D2 mit Spielliste; „nur ansehen“ als eigener Zustand, der nie bucht. | `DisciplineStageArena.tsx` (Knopf „Weiter zu Disziplin 2“), neue Komponente | mittel |
| 4 | Vorstellung für Duell und Vierergruppe als React-Screen vor dem Motor (ersetzt die Vorstellungskarte des Motors im Spieltag). | Host, Aufstellungsadapter (nur lesen) | mittel |
| 5 | Ergebnis-Screens: Rangfolge 1–4, eine Statistik-Tabelle mit Reitern, PP je Spieler aus der Preview. Motor liefert Statistik als Daten statt als fertiges HTML. | `battle-mode.engine.js` (nur Anzeige, `renderEndstand`), Host | mittel bis hoch (Motor-Datei, Fingerabdruck prüfen) |
| 6 | Live-HUD für vier Teams: Vierer-Tafel, Turm, Kontrollpunkte als Profil im HUD-Baukasten (`HUD_PROFIL.battlefield`, danach Mini-DM, Staffel, Takeshi). Spoiler-Regel vor dem Start. | `battle-mode.css`, `battle-mode.engine.js` (HUD) | hoch, eigener Review |

Reihenfolge-Vorschlag: 0 → 1 → 2 → 3, weil das die Befunde vom Spieltag direkt behebt; 4 bis 6 danach.

## 8. Bilder

Aufgenommen aus dem Mockup (`?still=1`), PNG mit 256 Farben, in `docs/design/arena-spieltag-modern-18-11/`:

| Datei | Screen |
|---|---|
| `01-laden-1920.png` | Laden, Disziplin 1 von 2 |
| `02-vorstellung-duell-1920.png` | Vorstellung Duell |
| `03-vorstellung-vierergruppe-1920.png` | Vorstellung Vierergruppe |
| `04-live-vierergruppe-vor-start-1920.png` | Live Vierergruppe vor dem Start, ohne Stand |
| `05-live-vierergruppe-1920.png`, `-2560.png` | Live Vierergruppe, Spiel läuft |
| `06-ergebnis-duell-1920.png` | Ergebnis Duell |
| `07-ergebnis-vierergruppe-1920.png`, `-2560.png` | Ergebnis Vierergruppe, Rangfolge 1–4 |
| `08-wechsel-d1-d2-1920.png` | Wechsel Disziplin 1 → 2 |
| `09-spieltagswertung-1920.png`, `-2560.png` | Spieltagswertung, Liga 2, eigenes Team im Blatt |

Live Duell, der Zustand „fremdes Spiel angesehen“ und die Filter der Spieltagswertung sind nur im Mockup zu sehen.
