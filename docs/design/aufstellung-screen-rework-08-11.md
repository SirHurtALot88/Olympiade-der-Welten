# Aufstellungs-Screen: Rework-Konzept (Fable, 08.11.)

Reine Konzeptarbeit, kein Code. Gegenstand ist das **Entwurf-Board der Battle Arena** —
`renderList()` (Kader, ab Z. 37273), `renderBoard()` (Slotzonen, ab Z. 37344) und `renderDbar()`
(Disziplin-Tabs, Z. 37649) in `public/mockups/battle-mode.engine.js`, Markup `#plist / #dbar /
#pitch / #hint / #opp` in `public/mockups/battle-mode.html` Z. 28–52, Stile in
`public/mockups/battle-mode.css`. Zeilennummern gelten für den Stand vom 08.11. und verschieben
sich mit jedem Merge — per `grep` suchen.

Verbindlich bleiben: die Eignungsmatrix ist gesperrt (alles hier ist **Anzeige**, kein Rezept),
und jede Aussage auf dem Screen darf nur behaupten, was der Motor nachweislich liest
(`docs/design/verhalten-drei-stufen-board-text-03-11.md`, im Folgenden „Verhalten-Befund").

## 0. Chris' Feedback (08.11.) und der Backlog, den es trifft

Wörtlich:

1. „Immer noch sehr viele Einstellungen hier"
2. „Die ganze Darstellung der Einsatzliste sollte mehr zeigen, wie die Position der Spieler auf
   dem Feld auch ist, und mit den +/- als Auswirkung etc."
3. „Der Screen muss noch mal ein Rework von Fable bekommen"

Offene Backlog-Punkte zum selben Screen (`docs/design/uebergabe-samstag-03-11.md` Abschnitt 6,
Punkte 1–4 und 6): Zahlen neben den Top-3-Kürzeln in der Kader-Liste; feste Farbe je Slot (6);
goldener Rahmen um die Top-N je Disziplin (N = Slotzahl); Rollenkarten im FM27-Stil mit farbigen
`++ / + / − / −−`; Regler nur dort zeigen, wo sie wirken (Verhalten-Befund, Abschnitt 5 Punkt 1–4).
Dieses Konzept baut die vier Backlog-Punkte **ein**, statt sie einzeln nachzurüsten — sie sind
genau die Bausteine, die Punkt 2 braucht.

## 1. Befund: warum der Screen überladen wirkt

Inventar bei voller TDM-Aufstellung (6 gesetzte Einheiten), gezählt am Code:

| Bereich | Elemente je Einheit / Slot | × 6 |
|---|---|---:|
| Slotkopf (`zname`) | Label, `+POWER +HEALTH · LAST STAMINA` als Text, `0/1` | 18 Texte |
| `slottext` | ein Erklärsatz | 6 |
| Vorschläge (`slotvorschlag`) | 3 × (Nr., Figur, Name, `77.8 (+8.5)`) | 18 Zeilen |
| Einheit, Werte | `LP · ANG · VER · TMP`, 6 Prozentkacheln (`pz`), Aufschlüsselung (`apart`, 4–6 Kacheln), Traitzeile, Skillchips (2–4), Heilbadge, „Schaden je Treffer" | ~90 Zahlen |
| Einheit, Regler | Befehl, Zielpriorität, Haltung, Zusammenhalt, Bindung (`select`) | **30 Dropdowns** |
| Einheit, Text | `persline` („Bollwerk · abgeleitet"), `neig` | 12 |
| Kopfzeile | Intensität (3 Buttons), 20 Disziplin-Tabs, Hinweiszeile | 24 |

Dreißig Dropdowns und rund neunzig Zahlen auf einer Fläche, **alle gleichrangig** — das ist
Punkt 1. Dazu drei strukturelle Ursachen, die man nicht mit Weglassen allein löst:

**a) Information und Einstellung liegen auf derselben Ebene.** Was eine Rolle *ist* (Stufe 2 im
Verhalten-Befund, das Einzige, was am Spieltag wirkt) und was man *einstellen kann* (Stufe 3,
wirkt nur im Entwurfskampf) stehen in derselben Karte, in derselben Schriftgröße, unter demselben
Rand.

**b) Die Regler stehen auch dort, wo sie nichts tun.** Die fünf Dropdowns werden für jede Einheit
jeder Disziplin gerendert (`renderBoard()` Z. 37582–37629 ohne `istArena(disc)`-Prüfung). Im
Spurt-Reiter sind sie gemessen wirkungslos (Verhalten-Befund 2.4: `spiele("spurt",1337)`
byte-identisch mit und ohne Dropdowns). Siebzehn von zwanzig Reitern zeigen also Einstellungen,
die eine Lüge sind — und machen den Screen voller, als er sein müsste.

**c) Die Tafel kennt keine Geometrie, obwohl der Motor sie hat.** `#pitch` ist ein
`grid-template-columns:1fr 1fr 1fr` (CSS Z. 179), gefüllt in `slotsVon(disc)`-Reihenfolge
(`SLOT_ZUSATZ.pos`): Zeile 1 = Vanguard, Hold Line, Breaker; Zeile 2 = Skirmisher, Shotcaller,
Rally Point. Das ist die **Aufstellungsreihenfolge**, nicht die Feldposition. Dabei steht die
Position seit langem im Code: `SLOT_ZUSATZ[id].reihe` (0/1/2, Z. 8201), `homeFor()` setzt die
Reihen bei Kampfstart auf `MID∓140/300/460` (Kommentar Z. 39800), und seit der
Reihenanker-Änderung hält die Formationsleine sie dort auch während des Kampfs (Z. 39819 ff.).
Die Konstante `ROWS` („Front / Mitte / Backrow", Z. 8336) existiert, wird auf der Tafel aber
nirgends gezeichnet. Der Untertitel verspricht „Drei Reihen", die Tafel zeigt zwei Zeilen à drei
Karten. Genau das ist Punkt 2.

**Was schon da ist und bleiben soll** (nicht neu erfinden): die vierstufige Passung
`passung()` (Z. 8296: ≥6 perfekt, ≥2 sehr gut, ≥−2 okay, sonst passt nicht) mit den Klassen
`pass-perfekt/gut/okay/schlecht` auf der Zone (CSS Z. 463–466: blau/grün/gelb/rot) und `fmark` in
der Kader-Liste bei `slotFokus`; die Top-3-Vorschläge `bestenFuer()` sortiert nach `abs`
(Z. 8313); `topSlotsFuer()`/`slotKuerzel()` (Z. 8322–8332); die Plus/Minus-Färbung
`.apart.plus/.minus` über `--ok/--crit` (CSS Z. 543); Drag & Drop auf die Zone; die Sortierung der
Kader-Liste nach angeklicktem Slot.

## 2. Leitidee: drei Ebenen statt einer Fläche

```
Ebene A  FORMATION        immer sichtbar      Mini-Feld, Slot-Marken in Slotfarbe, Spieler-Chips,
                                              Passungs-Pille, Intensität als ein Chip
Ebene B  ROLLENKARTE      ein Slot aktiv      FM-Stil ±-Attribute, Top-3, Beitrags-Zerlegung,
                                              Zeile „Rolle" (+ „Persönlichkeit" nur in Arena/Bahn)
Ebene C  FEINJUSTIERUNG   ausgeklappt,        Befehl, Ziel, Haltung, Zusammenhalt, Bindung,
                          nur istArena(disc)  Kampfwerte, Skills, Traits
```

Regel dahinter, im FM-Sinn (`.cursor/rules/foundation-ui-copy.mdc`: Fakten sichtbar, Erklärung
in den Tooltip): **Fakten auf Ebene A, Begründung auf Ebene B, Regler auf Ebene C.** Ein Manager,
der nur aufstellen will, sieht nie mehr als Ebene A. Wer wissen will, *warum* Ragnarok auf
Vanguard +8,5 bekommt, klickt den Slot (B). Wer im Entwurfskampf am Verhalten drehen will,
klappt die Einheit auf (C) — und nur in TDM, Mini-DM, Battlefield, wo `build()` die Werte liest.

Was damit aus der Standardansicht verschwindet: alle 30 Dropdowns, die 6 Prozentkacheln und die
Aufschlüsselung je Einheit, `slottext`, der Satz „Insgesamt 10 Einsätze bei 10 Spielern" (Z. 37646,
Rest aus der Zwei-Disziplinen-Demo: `DISCS.tdm.size+DISCS.spurt.size`), die `persline` außerhalb
der Arena-/Bahn-Reiter. Nichts davon ist gelöscht, alles ist einen Klick entfernt.

## 3. Ebene A: das Mini-Feld

### 3.1 Grundsatz: Geometrie aus dem Motor, nicht neu erfunden

Das Mini-Feld zeichnet **nur Plätze, die der Motor kennt**. Jede Disziplin bekommt eine Feldform
aus einer kleinen abgeleiteten Tabelle (Arbeitsname `FELD_JE_DISC`), deren Einträge sich aus
bestehenden Engine-Daten ergeben — sonst zeigt die Tafel wieder etwas, das der Kampf nicht hält.

| Chassis | Disziplinen | Feldform | Quelle für die Plätze | Was NICHT behauptet werden darf |
|---|---|---|---|---|
| Arena (Entwurf) | TDM, Mini-DM, Battlefield-Duell | eigene Hälfte, drei Spalten Front/Mitte/Backrow | `SLOT_ZUSATZ.reihe` (TDM: Vanguard/Hold Line 0, Breaker/Skirmisher 1, Shotcaller/Rally Point 2; Mini-DM ohne Eintrag → `floor(idx/2)`: Frontliner/Finisher 0, Trick Fighter/Iron Guard 1), x ≙ `MID∓140/300/460` | „steht immer ganz vorn" — Verhalten-Befund 2.1: Reihe 0 vor Reihe 2 in 83–96 % der Paare, aber Breaker/Skirmisher (verfolgen/flanke, keine Leine) stehen oft vor dem Vanguard. Text: „hält die vordere Linie" |
| Domination (gebucht) | Battlefield-Pod | drei Orte Nord · Mitte · Süd (`BF_ORT_NAMEN` Z. 55993) | Startort je Rolle `BFFFA_ROLLEN_ORT` (Z. 55998: Morale Anchor/Commander heim, Siege Core/Field Control Mitte, Disruptor/Spotter fern); Slots je k aus `BATTLEFIELD_SLOTS_JE_K` | ein Fixplatz — Chris 27.10.: „keine fixe aufteilung". Darstellung = **Startort + Neigung** (erobern/halten aus `ARENA_DOMINATION.rolle`), Marke mit Rotationspfeil |
| Bahn | Spurt, Time-Trial, Climbing, Staffel, Takeshi | Streckenband (horizontal), Climbing: Wand (vertikal) | Rennplan je Slot `planJeSlot` (Spurt Z. 44869: Blockstart/Acceleration/Drive Phase „Von vorn" = Spitze, Lane Control „Windschatten" = Mitte hinter einem Vordermann, Top Speed/Photo Finish „Schlusssprint" = hinten, zieht im letzten Drittel) — analog für Staffel (Angehen/Halten/Schlussmann), Takeshi (Kopf voran/Beherzt/Vorsichtig), Time-Trial, Climbing | eine Bahnzuteilung — Bahnen sind kein Slot-Merkmal. Gezeigt wird die **Position im Rennverlauf**, mit dem Plan-Label aus `plaene[..].label` |
| Feldspiel | Basketball | Halbfeld mit Paint, Flügeln, Ecken | `BASKETBALL_ROLLE_SLOT` (Z. 10855: Rim Pressure Paint, Floor General Top, Fast Break/Help Defense Flügel, Perimeter/Clutch Shot Ecke) | Wirkung bei Teilaufstellung — `zuordneSlots` nimmt die Rollenplätze **nur**, wenn alle sechs gesetzt und eindeutig sind; sonst Rückfall auf SCHUSS_NAH-Sortierung. Bei < 6 gesetzten: Marken gestrichelt + Hinweis „Formation greift ab 6 Spielern" |
| Feldspiel | Hockey, Football | Eisfläche / Feld | nur **mechanisch gelesene** Plätze fest: Hockey Goaltender im Tor (`TORWART_SLOTS` Z. 12144), Football Quarterback hinter der Linie (`QB_SLOTS` Z. 12488), Kicker/Punter abseits (`KICKER_SLOTS` Z. 12678). Die übrigen Rollen nach Fokus-Attributen sortiert (Power Forward/Slot Finisher vorn, Defensive Wall hinten …) | dass diese Ordnung im Motor etwas tut. Nicht-mechanische Plätze bekommen eine **andere Marke** (hohl statt gefüllt) und den Tooltip „Darstellung; der Motor liest hier nur Torwart/QB/Kicker" |
| Bühne | Gewichtheben, Breaking, Tennis, Fechten, Speed-Schach, Wettessen, Showcase, Eiskunstlauf, I-Spy | **Reihenfolge-Leiste** statt Feld: sechs Plätze nebeneinander | Gewichtheben Duell Slot n gegen n (`HEBEN_ROLLEN` mit Eröffnung %, Z. 20913), Breaking Kette 1–6, Tennis/Fechten Paarung n gegen n, Speed-Schach Brettfolge, Wettessen Sitzordnung Heim-Gast-Heim-Gast (Wettessen-Paket 03.11.), Showcase/Eiskunstlauf Startreihenfolge | einen Ort. Kopfzeile sagt es: „Hier zählt die Reihenfolge, kein Platz." Gegnerplatz n wird als `vs`-Schatten daneben gezeigt, wo der Motor n gegen n paart |

Die Tabelle ist zugleich die Vollständigkeitsprüfung: **alle zwanzig Disziplinen haben eine
Feldform**, und bei keiner steht mehr, als die Verhalten-Befund-Tabelle (Abschnitt 3 dort) als
„wirkt" ausweist. Für Hockey/Football steht bewusst „Darstellung", bis die PPS-Brücke dort
Slots liest.

### 3.2 Was auf einer Slot-Marke steht

```
┌──────────────────┐   Rahmen: Slotfarbe (Abschnitt 5), 2 px
│ VA  Vanguard     │   Kürzel groß, Label klein
│ ┌──┐ Ragnarok   │   Figur (figurKlein, 28 px) + Name; leer: „1. Ragnarok 78 ++" als Vorschlag
│ └──┘  78  ++    │   Wert in diesem Slot (abs) + Passungsglyphe (Abschnitt 6.2)
│        ↑         │   Befehlspfeil (nur Arena): mitlinie kurz ↑, verfolgen lang ↑↑,
└──────────────────┘   flanke ↗ gebogen, hinter/decken ↓ Klammer — aus slotOrd()/order[p.n]
```

Zustände, alle aus dem bestehenden Zustand `sel / slotFokus / place`:

- **Spieler gewählt** (`sel`): jede Marke färbt ihren Rand nach `passung(slotAufschlag(sel, slot))`
  — genau das, was heute `pass-*` auf der ganzen Zone tut (Z. 37365–37367), nur klein. Klick setzt
  (Z. 37633–37638), Drop setzt/tauscht (Z. 37418–37427).
- **Slot gewählt** (`slotFokus`): Marke bekommt den `fokus`-Rahmen, Ebene B öffnet, Kader-Liste
  sortiert sich wie heute (Z. 37277).
- **Goldener Rahmen** (Abschnitt 7) auf dem Spieler-Chip, wenn der Spieler zu den Top-N der
  Disziplin gehört — auch auf der Marke, damit man die Verteilung des Golds auf dem Feld sieht.
- Leere Marke zeigt den **1. Vorschlag** aus `bestenFuer(rw.id, frei, disc, 1)` halbtransparent;
  Klick übernimmt. Die Plätze 2 und 3 stehen auf Ebene B.

### 3.3 Die Gegnerhälfte

Das Gegner-Panel (`#opp`, „Dire Legion", Späh-Gewissheit-Slider) listet heute Namen mit
„Warlord · Vanguard oder Breaker" und einer Spanne. Diese Information gehört **auf dieselbe
Fläche**: die gegnerische Hälfte des Mini-Felds zeigt Geister-Marken an den Plätzen, die die
Späh-Vorhersage für wahrscheinlich hält („Vanguard oder Breaker" → Marke zwischen Reihe 0 und 1,
Unschärfe-Radius aus der Späh-Gewissheit). Der Slider bleibt, die Liste wird zum Tooltip der
Geister-Marken. Erst dann ist die Frage im heutigen Hinweistext („Ihre schnellen Leute laufen um
deine Front herum. Wer deckt hinten?") auf dem Bild beantwortbar statt nur im Text.

Für Bühnen-Disziplinen (Reihenfolge-Leiste) steht der Gegner als `vs`-Schatten unter jedem Platz,
wo der Motor n gegen n paart (Gewichtheben, Tennis, Fechten, Speed-Schach); sonst entfällt er.

### 3.4 Kopfzeile

Eine Zeile: Disziplin-Tabs wie heute (`dchip`, mit `6v6`/`4v4`), rechts daneben **Intensität als
ein Segment-Chip** (Schonen −2,5 · Normal 0 · Push +4) statt eigener `stufenzeile`. Tooltip
ehrlich nach Verhalten-Befund 4: „Wirkt im Entwurfskampf; der gebuchte Spieltag fährt normal."
Die `.sub`-Zeile „Drei Reihen. Jeder Spieler bekommt einen Befehl …" entfällt — das Feld zeigt
die Reihen jetzt selbst, und der Satz ist in siebzehn Disziplinen falsch.

## 4. Ebene B: die Rollenkarte

Öffnet sich **einmal** (rechts neben dem Feld auf Desktop, als Sheet unter dem Feld auf Mobil),
nicht sechsmal. Inhalt von oben nach unten:

```
VANGUARD                                   ■ Slotfarbe   Front · mit der Linie
Öffnet Teamfights mit Power und Health.                      (SLOT_ZUSATZ.reihe + ORDTIP.l)

ATTRIBUTE IN DIESER ROLLE                 (FM-Stil, Abschnitt 6.1)
 Power        ++      Health      ++       Stamina    −       Spirit     −
 Charisma     −       Determ.     ·        Intell.    ·       Awareness  ·

BESETZT  Ragnarok                 78 ++    ← Beitrags-Zerlegung (Abschnitt 6.3)
   +6,1 Power   +1,9 Health   −0,4 Stamina   −0,3 Spirit   … = +8,5 (gedeckelt)

ALTERNATIVEN                               (bestenFuer, Top 3, wie heute)
 1. Ragnarok   78 ++     2. Buttercup  61 +     3. Molten Boar  49 ·

ROLLE                                      (Verhalten-Befund Abschnitt 4, Zeile 2 — nur Fakten)
 Reihe 1, mit der Linie. Hält die vordere Linie; Breaker und Skirmisher laufen oft vor ihm.

PERSÖNLICHKEIT  Bollwerk · abgeleitet      (nur TDM, Mini-DM, Battlefield, Spurt, Takeshi, Staffel)
 Greift an, was auf ihn zukommt. Bleibt dicht bei der Linie, löst sich bei ~27 % Leben kurz.

[ Feinjustierung ▾ ]                       (nur istArena(disc), Ebene C)
```

Die Zeilen „Rolle" und „Persönlichkeit" sind **wörtlich die Textvorschläge** aus dem
Verhalten-Befund Abschnitt 4 (Tabelle Archetypen, Zeile 2 je Disziplin) — hier nicht neu
formuliert, nur verortet. Die Persönlichkeitszeile erscheint nur in den sechs Disziplinen, in
denen `behav()`/`willTackeln`/`STAFFEL_PERS_HALTUNG` sie lesen (Befund 2.5); überall sonst wäre
sie eine Behauptung ohne Motor.

Der heutige Slotkopf-Text `+POWER +HEALTH · LAST STAMINA` (`slotfokus`, Z. 37371) wird durch die
Attributtafel ersetzt — gleiche Quelle (`rw.gross/klein/last` ⊂ `rw.profil`), lesbarer, und mit
der Information, die der Text verschweigt: dass eine Rolle auch Attribute **abwertet**.

## 5. Feste Slotfarben (Backlog 6.2)

**Farbe hängt an der Slot-Position 1–6, nicht an der Rolle.** Zwanzig Disziplinen à sechs Rollen
wären 120 Farben — niemand lernt die. Sechs Positionsfarben lernt man in einem Abend, und sie
bedeuten überall dasselbe: Position 1 ist in TDM der Vanguard, im Spurt der Block Start, im
Battlefield der Siege Core — jeweils der Platz, den `slotsVon(d)` (sortiert nach `SLOT_ZUSATZ.pos`)
als ersten liefert, also der, den der Reihum-Rückfall dem Eignungsbesten gibt. Bei Battlefield
mit k < 6 gilt die Position in `bfSlotsFuer(d,k)`.

Wo die Farbe steht (immer als **Rand oder Kürzel-Chip, nie als Flächenfüllung**, damit sie sich
nicht mit den Bedeutungsfarben `--ok/--crit/--warn/--away` und den Teamfarben `--home/--away`
beißt):

- Slot-Marke auf dem Mini-Feld (Rahmen) und Rollenkarten-Kopf (Balken links, ersetzt den heutigen
  `--home`-Balken der `.unit`, CSS Z. 185).
- Kürzel in der Kader-Liste (`egposis`, heute `--faint`): `VA 78 · BR 78 · SK 72` mit jedem Kürzel in
  seiner Positionsfarbe — damit die Zuordnung Kader ↔ Feld ohne Lesen klappt.
- Gegner-Geister-Marken in abgeschwächter Positionsfarbe.

Palette: sechs Farbtöne, die sich von den sieben reservierten (ok-grün, crit-rot, warn-gelb,
home-orange, away-türkis, gold, fortschritt-blau) **im Farbton** unterscheiden und in beiden
Themes (CSS Z. 11–32) auf `--surface` lesbar bleiben. Kandidaten, vor dem Bau mit der
`dataviz`-Palettenprüfung gegen beide Themes zu validieren: Position 1 Weinrot, 2 Violett,
3 Indigo, 4 Petrol-Grün (deutlich dunkler als `--away`), 5 Moos, 6 Umbra. Ergänzend immer das
Kürzel als zweites Merkmal, damit die Zuordnung auch ohne Farbsehen funktioniert.

## 6. Das ±-Schema (Backlog 6.4) — eine Tabelle für alles

### 6.1 Attribut-Effekte der Rolle

Quelle: `SLOTS_JE_DISC[d][i].profil` gegen `BASIS_JE_DISC[d]` — die Differenz je Attribut ist
exakt `deltaPct` in `resolveKeyAttributes()` (`lib/lineups/matchday-slot-roles.ts` Z. 718 ff.), wo
die Schwellen `emphasis: primary ≥ 3, secondary ≥ 1` schon stehen. Darauf setzt das Schema auf,
gespiegelt ins Negative:

| Δ Gewicht (Pp) | Glyphe | Farbe | Beispiel (`SLOTS_JE_DISC` Z. 7956 ff. gegen `BASIS_JE_DISC` Z. 7909 ff.) |
|---|---|---|---|
| ≥ +3 | `++` | `--ok`, fett | TDM-Vanguard Power 33,4 gegen Basis 28 (+5,4), Health 23,4 gegen 20 (+3,4) |
| +1 … +3 | `+` | `--ok` | TDM-Hold-Line Determination 8,7 gegen 6 (+2,7) |
| −1 … +1 | `·` | `--faint` | TDM-Vanguard Determination 5 gegen 6 (−1,0), Intelligence 5 gegen 6 |
| −3 … −1 | `−` | `--crit` | TDM-Vanguard Stamina 11,5 gegen 14 (−2,5), Spirit 9,9 gegen 12 (−2,1), Charisma 8,3 gegen 10 |
| ≤ −3 | `−−` | `--crit`, fett | Battlefield-Morale-Anchor Intelligence 7,2 gegen 16 (−8,8); bei TDM tritt die Stufe nicht auf |

Nur Anzeige: die Matrix bleibt, die Profile bleiben, es wird nichts gerundet, was der Motor nicht
ohnehin rundet.

### 6.2 Passung eines Spielers auf einen Slot

Heute vier Stufen in `passung()` mit vier Farben (blau/grün/gelb/rot). Vorschlag: **dieselben
Schwellen, fünf Glyphen, zwei Farben plus neutral** — damit „Rolle" (6.1) und „Spieler in Rolle"
dieselbe Sprache sprechen:

| `slotAufschlag` m | heute | neu Glyphe | Farbe |
|---|---|---|---|
| ≥ +6 | perfekt (blau) | `++` | `--ok`, fett |
| +2 … +6 | sehr gut (grün) | `+` | `--ok` |
| −2 … +2 | okay (gelb) | `·` | `--faint` |
| −6 … −2 | passt nicht (rot) | `−` | `--crit` |
| ≤ −6 | passt nicht (rot) | `−−` | `--crit`, fett |

Die Glyphe steht **immer neben der Zahl**, nie statt ihrer: „78 ++". Betroffen: `fmark` in der
Kader-Liste, `passmarke` im Slotkopf, die Slot-Marke, die Vorschlagszeilen. `passung()` selbst
bleibt (Texte „passt perfekt" … für Tooltips), bekommt nur eine fünfte Stufe für die Anzeige — kein
Motorpfad liest sie.

### 6.3 Beitrags-Zerlegung: warum +8,5?

Das ist der Teil, der Punkt 2 („mit den +/- als Auswirkung") wirklich einlöst. `slotAufschlag()`
(Z. 8286) ist linear in den Attributen:

    m = 2,2 · ( Σ a_k·w_k / Σw  −  Σ a_k·b_k / Σb )  =  Σ_k  2,2 · a_k · (w'_k − b'_k)

mit `w'`/`b'` den normierten Slot- bzw. Basisgewichten. Jeder Summand ist der **Beitrag eines
Attributs** zum Slot-Aufschlag; die Summe ist exakt m (vor Rundung und vor der Klemmung auf ±8,5;
Football zusätzlich × 0,35). Die Rollenkarte zeigt die drei größten positiven und die zwei größten
negativen Beiträge als farbige Chips (`apart plus/minus`, existiert) und markiert die Klemmung
ausdrücklich: „= +11,2 → gedeckelt auf +8,5". So sieht man, dass Ragnaroks Power der Grund ist,
und dass bei ihm noch Luft über dem Deckel ist — heute steht da nur „(+8,5)".

Test dazu (Pflicht, Anzeige-Invariante): Summe der Beiträge = `slotAufschlag`-Rohwert vor
Klemmung, auf 0,05 genau, für alle 20 Disziplinen × alle Slots × einen Beispielkader.

### 6.4 Einheitliche Anwendung auch in der Foundation

`matchday-slot-roles.ts` liefert `keyAttributes[].deltaPct/emphasis` schon an die
Foundation-Einsatzliste, die daraus heute nur `role?.label` zeigt
(`app/foundation/legacy-lineup-lab/LineupNewLook.tsx` Z. 2077, `nl-lineup-slot-role`). Dieselbe
Glyphen-Tabelle (6.1) gehört dort hinein, sobald sie im Board steht — eine Tabelle, zwei Orte, kein
zweites Schema. Nicht Teil dieses Reworks, aber die Tabelle soll so geschnitten sein, dass sie
beides bedient (Schwellen als Konstanten, keine Board-Spezifika).

## 7. Goldener Rahmen für die Top-N (Backlog 6.3)

- **N = `slotsVon(disc).length`** (TDM 6, Mini-DM 4, Battlefield nach k) — nicht fest 6. Chris:
  „hat eine Diszi nur 2 Slots, sind nur die Top-2 umrahmt."
- **Rang nach Basis-Eignung in dieser Disziplin**, nicht nach Slot-Passung: `p.d[d]`, sonst
  `gewichtet(p.a, BASIS_JE_DISC[d])` — derselbe Rückfall, den `bestenFuer()` für `abs` nimmt
  (Z. 8315; CLAUDE.md: `p.d` hält nur `tdm` und `spurt` vorberechnet). Begründung: Gold soll
  sagen „gehört in diese Disziplin", unabhängig davon, wo er dort steht. Die Slot-Passung zeigt die
  Glyphe.
- Wo: um den Eignungswert in der Kader-Liste (`eg`-Zelle, je Spalte eigenes N), um den Spieler-Chip
  auf der Slot-Marke, um den Namen in den Vorschlagszeilen. Steht ein Gold-Spieler in der anderen
  Disziplin (`anderswo`), wird der Rahmen gestrichelt — man sieht, dass man Gold verschenkt.
- Farbe: eigenes Token `--gold` (metallisch, z. B. `#D4AF37` hell / `#E8C65A` dunkel), bewusst
  **nicht** `--warn` (`#B07A12`/`#E0B341`), das „okay" und Intensität trägt. Ein Token, beide
  Themes.
- Tooltip: „Top 3 im Kader für TDM (Eignung 69)".

## 8. Kader-Liste (Backlog 6.1) — kompakt, aber vollständig

Zeile heute: Figur · Name/Slot · `69` mit `VA · BR · SK` darunter · `62`. Neu:

```
[Fig] Ragnarok            ┌ 69 ┐  VA 78 · BR 78 · SK 72      62  BS 66 · AC 64 · TS 60
      Vanguard            └gold┘  (Kürzel in Slotfarbe, Zahl = abs in diesem Slot)
```

- Die Zahl neben dem Kürzel ist **`abs`** (Basis + m), dieselbe Zahl wie auf der Marke und in den
  Vorschlägen. Für einen Spieler ist die Reihenfolge nach `abs` identisch mit der nach `m`
  (gleiche Basis), `topSlotsFuer()` muss also nicht umsortiert werden — nur um `abs` ergänzt.
- Bei `slotFokus` bleibt die `fmark` (jetzt „+8,5 ++"), die Liste bleibt sortiert.
- Die zwei Spalten bleiben die zwei Disziplinen des Spieltags (im Mockup TDM/Spurt). Die
  `eghead`-Zeile trägt die Labels wie heute.
- Zeile bleibt eine Zeile hoch (Chris 03.11.: „damit es nicht zusätzlich Platz kostet").

## 9. Ebene C: Feinjustierung — nur wo der Motor liest

Aufklappbar je besetzter Einheit **nur bei `istArena(disc)`** (TDM, Mini-DM, Battlefield). Inhalt
ist das heutige Innenleben der `.unit`: Befehl, Zielpriorität, Haltung/Zusammenhalt/Bindung
(`bwrap/srow`), Kampfwerte (`prozente`), Aufschlüsselung (`aufschluss`), Traits, Skills, Heilbadge
— unverändert in Funktion, nur eingeklappt. Zwei Zusätze:

- Kopfzeile des Aufklappers: „Gilt im Entwurfskampf. Am Spieltag zählt nur der Slot." (Befund 4,
  Zeile 3) — bis Stufe 3 gebucht wird (`ArenaAufstellungEintrag` hat `haltung?` schon vorgesehen,
  `lib/foundation/battle-arena/arena-aufstellung-adapter.ts` Z. 53–57, setzt es aber nirgends).
- Abweichungen vom ★-Standard der Persönlichkeit werden **außen** auf der Marke als kleiner Punkt
  sichtbar („hier wurde eingestellt"), damit man eingeklappt nicht vergisst, was man verstellt hat.

In den siebzehn anderen Disziplinen gibt es keinen Aufklapper; die Rolle-Zeile der Rollenkarte
zeigt stattdessen den Plan aus der Tabelle (Spurt „Von vorn", Staffel „Schlussmann", Gewichtheben
„Eröffnung 92 %", Basketball „Formationsplatz Paint — ab 6 gesetzten") — Fakten, die der Motor
tatsächlich fährt.

## 10. Wireframe (Desktop, drei Spalten wie heute `.lay`)

```
┌ KADER ───────────────┬ AUFSTELLUNG TDM ─────────────────────────────┬ ROLLE ──────────────────┐
│ TDM Tabs … Intensität ○ Normal                                      │ ■ VANGUARD   Front      │
│ [F] Ragnarok    69g   │   eigene Hälfte            │ Gegnerhälfte    │ Power ++  Health +      │
│     Vanguard  VA78·BR78│ Back    Mitte    Front    ┊ (Geister,       │ Stamina − Spirit −      │
│ [F] Buttercup   57g   │ ┌RP┐    ┌SK┐     ┌VA┐     ┊  Späh 35 %)     │                         │
│     —         VA61·HL58│ │  │    │  │     │Rag│→   ┊   ◌ ◌           │ BESETZT Ragnarok 78 ++  │
│ [F] Molten B.   44    │ └──┘    └──┘     └──┘     ┊  ◌    ◌         │ +6,1 Power +1,9 Health  │
│ …                     │ ┌SC┐    ┌BR┐     ┌HL┐     ┊     ◌ ◌         │ −0,4 Stamina = +8,5 ▲   │
│                       │ │  │    │  │→→   │  │     ┊                 │                         │
│                       │ └──┘    └──┘     └──┘     ┊                 │ 1. Ragnarok 78 ++       │
│                       │ 1 von 6 aufgestellt         Späh-Gewissheit ━━●━━ │ 2. Buttercup 61 +  │
│                       │                                              │ 3. Molten Boar 49 ·     │
│                       │                                              │ ROLLE  Reihe 1, mit …   │
│                       │                                              │ PERSÖNLICHKEIT Bollwerk │
│                       │                                              │ [ Feinjustierung ▾ ]    │
└───────────────────────┴──────────────────────────────────────────────┴─────────────────────────┘
```

`g` = Goldrahmen. Die dritte Spalte (heute Gegnerliste) wird zur Rollenkarte; die Gegnerliste
wandert als Geister-Marken aufs Feld und als Tooltip. Mobil: Kader → Feld → Rollenkarte als
Sheet beim Tippen einer Marke; Kader-Liste unter dem Feld einklappbar.

Für Bühnen-Disziplinen ersetzt die Reihenfolge-Leiste das Feld:

```
│  1 ■PO  Ragnarok 71 +    2 ■SL  —  (1. Grumpp 52 ·)    3 ■PL  …    4 …   5 …   6 …   │
│    vs Hargorin           vs Genta                       vs …                        │
│  Hier zählt die Reihenfolge, kein Platz. Duell Slot n gegen Slot n.                 │
```

## 11. Was sich an den Abläufen ändert (und was nicht)

| Ablauf | heute | neu |
|---|---|---|
| Spieler setzen | Spieler klicken → Zone klicken; Drag auf Zone | gleich, Ziel ist die Marke; Zonenfarbe wird Markenrand |
| Slot verstehen | Slotkopf + `slottext` + Vorschläge in jeder der 6 Karten | Marke klicken → **eine** Rollenkarte |
| Kader nach Slot sortieren | Slotkopf klicken (`slotFokus`) | Marke klicken — derselbe Zustand |
| Verhalten einstellen | 5 Dropdowns in jeder Einheit, jede Disziplin | Aufklapper in der Rollenkarte, nur Arena |
| Intensität | eigene Zeile | Chip in der Kopfzeile, ehrlicher Tooltip |
| Gegner lesen | Liste rechts | Geister auf der Gegnerhälfte, Liste im Tooltip |
| Alle setzen | — | „Vorschlag übernehmen": Reihum-Zuteilung über `bestenFuer()` greedy, wie der Rückfall ohne Aufstellung; danach alles einzeln änderbar |

Der Zustand (`place / order / zielOf / takt / STUFE / sel / slotFokus`) bleibt derselbe, `build()`
und der Import der Übergabe (Z. 36633) bleiben unberührt. Das Rework ist eine neue **Ansicht** auf
denselben Zustand.

## 12. Umsetzung in Paketen (Vorschlag, PR-groß, in dieser Reihenfolge)

Alles Anzeige, kein Motorpfad — trotzdem je Paket die Identitätsprüfung nach dem Muster
`scripts/pruefe-wettessen-identisch.mjs`: `spiele(d, saat)` vor und nach dem Paket byte-gleich
für TDM, Mini-DM, Battlefield, Spurt, Gewichtheben. Dazu die `board-check.mjs`-Sonde aus dem
Verhalten-Befund (zählt `select` je Reiter — nach Paket 3 muss sie außerhalb der Arena null
liefern).

1. **Farben, Gold, Zahlen** (Backlog 6.1–6.3): `SLOTFARBE[pos]`, `--gold`, `abs` in `topSlotsFuer`,
   `egposis` neu. Nur `renderList()` + CSS. Kleinster Schritt, sofort sichtbar.
2. **±-Schema und Beitrags-Zerlegung** (Backlog 6.4): Glyphen-Tabelle 6.1/6.2, `beitraege(p, slot,
   d)` neben `slotAufschlag()`, Vitest für die Summen-Invariante (6.3). Rollenkarte als Inhalt der
   heutigen Zone — noch ohne Feld.
3. **Mini-Feld Arena + Ebenen**: `FELD_JE_DISC` für TDM/Mini-DM/Battlefield-Duell aus
   `SLOT_ZUSATZ`, Zonen → Marken, eine Rollenkarte, Feinjustierung einklappen, Regler nur
   `istArena(disc)` (Verhalten-Befund 5.1), Intensität in die Kopfzeile, Demo-Satz Z. 37646 raus.
4. **Feldformen der übrigen Chassis**: Bahn-Band aus `planJeSlot`, Basketball-Halbfeld aus
   `BASKETBALL_ROLLE_SLOT` mit 6-gesetzt-Hinweis, Hockey/Football hohl markiert, Domination
   Startort + Neigung, Reihenfolge-Leiste für die neun Bühnen. Rolle-Zeilen aus den vorhandenen
   Tabellen (Befund Abschnitt 4, Zeile 2).
5. **Gegnerhälfte**: Geister-Marken aus der Späh-Vorhersage, Slider bleibt.
6. (später, Engine) Stufe 3 buchen — erst dann darf der Aufklapper ohne „Entwurfskampf"-Hinweis
   stehen. Außerhalb dieses Reworks; Pflicht-Abnahme rho/Pp nach CLAUDE.md, weil es Mechanik ist.

Pakete 1–2 sind unabhängig von 3; 4 und 5 bauen auf 3 auf.

## 13. Fragen an Chris (kurz, vor Paket 3)

1. Slotfarbe **je Position 1–6** über alle Disziplinen (Vorschlag) — oder je Rolle innerhalb einer
   Disziplin, mit neuen Farben je Reiter?
2. Gold nach **Basis-Eignung** (Vorschlag) oder nach dem Wert im zugewiesenen Slot?
3. Gegner **auf dem Feld** als Geister (Vorschlag) oder weiter als Liste rechts?
4. Rollenkarte **rechts** (ersetzt die Gegnerliste) oder unter dem Feld?
5. Soll die Foundation-Einsatzliste (`LineupNewLook`) dasselbe Mini-Feld bekommen, oder bleibt
   das ein Arena-Board-Thema?

## Anhang: Fundstellen

| Was | Datei : Zeile (08.11.) |
|---|---|
| Kader-Liste | `public/mockups/battle-mode.engine.js` : 37273 `renderList()` |
| Slotzonen, Vorschläge, Einheiten, Dropdowns | ebd. : 37344 `renderBoard()`, Dropdowns 37582–37629 |
| Disziplin-Tabs | ebd. : 37649 `renderDbar()` |
| Reihe/Befehl/Position je Slot | ebd. : 8201 `SLOT_ZUSATZ`, 8239 `slotReihe`, 8244 `slotsVon` |
| Slot-Profile (20 Disziplinen) | ebd. : 7908 `BASIS_JE_DISC`, 7954 `SLOTS_JE_DISC`, 8158 `BATTLEFIELD_SLOTS_JE_K` |
| Torwart-/QB-/Kicker-Slots im Motor | ebd. : 12144 `TORWART_SLOTS`, 12488 `QB_SLOTS`, 12678 `KICKER_SLOTS` |
| Slot-Aufschlag, Passung, Top-3 | ebd. : 8286 `slotAufschlag`, 8296 `passung`, 8313 `bestenFuer`, 8322 `topSlotsFuer`, 8329 `slotKuerzel` |
| Befehle, Persönlichkeit, Skalen | ebd. : 7739 `PERSORD`, 7746 `PERS`, 7758–7760 `HALTUNG/ZUSAMMEN/BINDUNG` |
| Startgeometrie der Reihen | ebd. : 38186 `homeFor`, Kommentar 39800 (`MID∓140/300/460`) |
| Basketball-Formationsplätze | ebd. : 10855 `BASKETBALL_ROLLE_SLOT` |
| Battlefield-Startorte | ebd. : 55993 `BF_ORT_NAMEN`, 55998 `BFFFA_ROLLEN_ORT` |
| Gewichtheben-Rollen | ebd. : 20913 `HEBEN_ROLLEN` |
| Spurt-Rennplan je Slot | ebd. : 44861 `plaene`, 44869 `planJeSlot` |
| Arena-Prüfung | ebd. : 8937 `istArena` |
| Markup | `public/mockups/battle-mode.html` : 28–52 |
| Stile Tafel | `public/mockups/battle-mode.css` : 149–215 (`prow/pico/eg/egposis/pitch/zone/unit/bwrap`), 451–466 (`slotzone/passmarke/pass-*`), 543 (`apart.plus/minus`), 11–32 (Tokens beide Themes) |
| Rollenprofile Foundation | `lib/lineups/matchday-slot-roles.ts` : 96 `DISCIPLINE_ROLE_THEMES`, 343 `ROLE_THEME_IDS_BY_SLOT_COUNT`, 718 `resolveKeyAttributes` |
| Foundation-Einsatzliste, Rollenlabel | `app/foundation/legacy-lineup-lab/LineupNewLook.tsx` : 2077 |
| Übergabe Arena | `lib/foundation/battle-arena/arena-aufstellung-adapter.ts` : 53 `ArenaAufstellungEintrag` |
| Was der Motor liest | `docs/design/verhalten-drei-stufen-board-text-03-11.md` |
| Backlog | `docs/design/uebergabe-samstag-03-11.md` Abschnitt 6 |
