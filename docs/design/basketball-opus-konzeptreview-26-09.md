# Basketball — Gameplay- und Taktik-Konzeptreview (Opus, 26.09.)

Chris' Vorgabe für diese Runde, sinngemäß: nicht an Zahlen drehen („balancing bringt noch nichts
wenn die Konzepte nicht perfekt sind"), sondern zuerst prüfen, ob die Spielmechanik taktisch
überzeugend echten Basketball abbildet.

Dieses Dokument ist **reines Konzept**: kein Produktionscode, keine Rezept- oder Konstantenänderung.
`engine.js` meint `public/mockups/battle-mode.engine.js`, Stand `main` `6b471366` (26.09.). Was
gemessen ist, steht mit Aufruf daneben; alle Zielwerte sind **Vorschläge**. Form und Tiefe folgen
`docs/design/climbing-neukonzept-22-09.md`.

## Kurzfassung

- **Basketball ist kein zweiter Climbing-Fall.** Climbing war ein Hindernislauf mit Kletterwörtern.
  Basketball ist eine echte Live-Simulation mit Ballbesitz, Manndeckung, Hilfsverteidigung und
  Doppeln, Kick-out, vier Wurfdistanzen mit 2/3 Punkten, einem Kontest aus Paarung (ABWEHR gegen
  Wurf-Skill), Rebound-Zweikampf mit Ausboxen, Fastbreak und Ausbruch, Freiwürfen samt And-One,
  Assist-Fenster, Mismatch-Bewegung, Schussuhr und Vierteln. Auf der **Ebene des einzelnen
  Spielers** ist das ausgereift: vier Extrem-Builds (Spielmacher, Distanzschütze, Korbschütze,
  Verteidiger) führen jeweils ihre eigene Kategorie an (`battle-mode.rezepte.js`, Archetypen-Runde).
- **Auf der Ebene der Mannschaft gibt es dagegen keine Taktik.** Einen Trainer gibt es nicht. Die
  einzige taktische Entscheidung im ganzen Spiel ist das Fokus-Doppeln. Die sechs Rollen der
  Aufstellung („Floor General", „Help Defense", „Clutch Shot" …) sind **Etiketten**: Sie verschieben
  Sub-Skills um ±1 bis ±4 Punkte (`BASKETBALL_POS_MOD`, `engine.js:7378`), bestimmen aber nicht,
  wer den Ball führt, wer hilft, wer in der Crunchtime wirft oder wer den Fastbreak läuft. Die
  Verteidigung entscheidet nichts: Zuteilung an den nächsten freien Angreifer, ein Screen ist eine
  Geschwindigkeitsbremse, und ein Block ist nur ein anderes Wort für einen Fehlwurf, der ohnehin
  schon feststand.
- **Drei Kernhandlungen des Basketballs sind gebaut, kommen im Spiel aber praktisch nicht vor oder
  sind verzerrt.** Nachgemessen über 24 Spiele: **36 Screens je Spiel, daraus 0,6 Würfe des
  Roll-Manns und 0,5 Alley-Oops.** Pick-and-Roll ist damit Kulisse. **12 % aller Pässe werden
  abgefangen** (NBA: Größenordnung 1–2 %), es gibt 28 Steals je 100 Ballbesitze (NBA ≈ 8), aber nur
  **1,9 Fouls je Spiel** (NBA ≈ 40). Riskante Aktionen kosten nichts, Ballbewegung wird bestraft.
  Das ist das Gegenteil des Grundsatzes, auf dem modernes Basketball aufbaut: Der Ball ist
  schneller als der Verteidiger. **30 % aller Würfe fallen im Fastbreak-Fenster** (NBA ≈ 15 %).
- **Das sieht nach Zahlen aus, ist aber Konzept.** Die Recherche vom 03.09.
  (`basketball-finalisierung-recherche-fable.md` Abschnitt 4) hat Steals, Fouls und Endspiel schon
  benannt, aber als **Kalibrierung** („der Hebel ist eine Kalibrierung auf ~14 Ballverluste").
  Seitdem ist nichts davon gebaut; die Zahlen stehen heute fast gleich da (Abschnitt 0.3). Der
  eigentliche Fehler ist nicht die Höhe einer Konstante, sondern **wo das Risiko herkommt**: Ein
  Steal wird alle 2 s je Decker gewürfelt, egal was der Ballführer tut. Das lässt sich nicht
  wegkalibrieren, ohne dem Verteidiger seinen Hauptkanal im Impact-Wert zu nehmen (Abschnitt 2.5).
- **Urteil: Eine reine Balance-Runde wäre der falsche nächste Schritt, ein Neubau aber auch.** Das
  Chassis trägt. Was fehlt, ist eine **Taktikschicht** darauf: Rollen, die Aufträge sind; Risiko,
  das an Entscheidungen hängt (mit Fouls als Preis); ein Pick-and-Roll mit Verteidiger-Wahl; eine
  Trainerkarte mit wenigen, lesbaren Schaltern; Spielstand-Logik fürs Endspiel.
  Priorisierte Vorschläge in Abschnitt 4, Etappen in Abschnitt 6.
- **Nebenbefund zur Scorecard:** Basketball steht dort mit „Konzept 100" und fällt nur an rho durch
  (`docs/pm-briefings/opus-plan-top-zehn-ueber-90-16-09.md`, Zeile 108). Die 100 bewerten
  Vollständigkeit (alle Mechaniken vorhanden), nicht taktische Tiefe. Nach diesem Review ist die
  100 zu hoch.
- **rho:** Basketball ist die einzige Disziplin in Chris' echtem Spielstand
  (`ARENA_RESOLVED_DISCIPLINE_IDS`). Jeder Umbau ist ein Eingriff an einer laufenden Disziplin mit
  CI-Schranke und PPS-Referenz. Die Latte lautet: nicht schlechter als 0,769, Ziel 0,80. Es gibt
  eine begründete, aber ungemessene Hoffnung, dass der Umbau rho **hebt**: G1* scheitert heute an
  der Validität (Star auf Rang 1 nur 43 %, Paartreue ≥15 nur 93 %,
  `basketball-g1-stern-paartreue-10-09.md`), und die Steal-/Abfang-Lotterie ist die größte
  Rauschquelle, die nicht an der Eignung hängt. Abschnitt 5.

---

## 0. Ist-Zustand, nachgelesen und nachgemessen

### 0.1 Wie ein Ballbesitz heute abläuft

1. **Ballerhalt.** Nach einem Korb oder einem Defensiv-Rebound bekommt ein per Los gewählter
   Spielmacher den Ball (`spielmacherLos`, `engine.js:9653`, gewichtet nach AUFBAU). Das ist nicht
   zwingend der „Floor General". Nach Steal oder Defensiv-Rebound öffnet sich ein Fastbreak-Fenster
   von 3 s; der schnellste Mitspieler reißt aus, wenn er schneller ist als der schnellste Gegner
   (`startFastbreak`, `:10883`).
2. **Aufstellung.** Die übrigen fünf laufen auf sechs feste Plätze: einer korbnah, einer zentral auf
   Distanz, je ein Flügel- und ein Eckenplatz pro Seite (`SLOTS`, `:7749`). Verteilt wird **nach
   SCHUSS_NAH sortiert** (`zuordneSlots`, `:7843`), nicht nach Rolle. Steht ein Angreifer länger als
   2,4 s eng gedeckt, springt er auf einen zufälligen freien Platz.
3. **Der Ballführer** läuft auf seine Wunschdistanz, die sein Wurfprofil festlegt
   (SCHUSS_FERN − SCHUSS_NAH): Schützen bleiben draußen, Korbspieler gehen nach innen
   (`bewegeSpielerLive`, `:11227`).
4. **Entscheidung** alle 0,4–1,2 s (`reevBall`, schneller bei hohem AUFBAU), in dieser Reihenfolge
   (`entscheideBallaktion`, `:9807`):
   - *Spielmacher sucht den Pass* (nur bei AUFBAU > 55, höchstens 35 %).
   - In Wurfreichweite: *Kick-out-Würfel* bei Bedrängnis (gedoppelt 90 %). Sonst *Wurf*, wenn die
     Qualität die mit der Zeit sinkende Geduldsschwelle übersteigt.
   - Sonst *Pass* (20–75 % nach AUFBAU). In Korbnähe kann daraus ein Alley-Oop werden.
   - Sonst *Screen rufen* (5–30 %): Ein Mitspieler, gelost nach ZWEITCHANCE, stellt sich für 1,2 s
     zwischen Ballführer und dessen Decker und rollt danach 1,5 s zum Korb.
   - Nach 8 s Schussuhr wird geworfen.
5. **Verteidigung** (`zuordneDeckung`, `:9401`; `bewegeSpielerLive`): Jeder Verteidiger nimmt in
   Abständen den **nächsten freien** Angreifer. Er hängt bis zu 35 px zum eigenen Korb ab („sag").
   Ein Nicht-Zuständiger im Umkreis von 90 px springt mit ABWEHR-abhängiger Chance als Helfer zum
   Ballführer, zusätzlich nach Fokus-Doppeln-Vorgabe. Ein Screen bremst den Decker des
   Ballführers auf 35 % Tempo (`:11545`). Mismatch (Tempo, Wucht) lässt Verteidiger zurückfallen
   oder „den Mann verlieren".
6. **Risiko:** Jeder Decker in 45 px würfelt alle 2 s einen Steal (`versucheSteal`, `:10713`). Jeder
   Pass hat eine Abfangchance über den Verteidiger, der der Passlinie am nächsten steht (`passeAb`,
   `:10643`), dazu einen eigenen Fehlpass-Würfel.
7. **Wurfauflösung** (`wirf`, `:10213`; `loeseFlugAuf`, `:11081`): Treffer wird beim Abwurf
   gewürfelt. Ein Foul gibt es nur beim Wurf und nur mit einem Bedränger (`foulBasis` 0,16/0,10/0,05).
   Ein Block wird **erst nach einem feststehenden Fehlwurf** ausgewertet: Er färbt den Fehlwurf um,
   er verhindert keinen Treffer. Den Rebound entscheidet ein Los nach ZWEITCHANCE, mit
   Ausbox-Vorteil für die Verteidiger.
8. **Wertung** (`feldspielWert`, K3): Feldkorbpunkte je zur Hälfte als erwartete Punkte, dazu
   Freiwürfe, Assists ×1,0, Rebounds ×1,2, (Steals + Blocks) ×1,5, Ballverluste ×−0,8.

### 0.2 Was die Mannschaft taktisch entscheiden kann

| Hebel | Wer | Wirkung |
|---|---|---|
| Aufstellung (6 Rollen-Slots) | Manager | ±1…4 auf einzelne Sub-Skills plus `slotAufschlag` auf `eig`, **kein Verhalten** |
| Fokus-Doppeln | Manager (Klick) / KI-Vorgabe (`berechneFokusAuto`, `:7200`) | Hilfe geht bevorzugt auf einen Gegner |
| Rotation in der Viertelpause | automatisch (`zuordneSlots(…, liegtZurueck)`) | wer liegt zurück, stellt offensiver auf |
| Angriffsstil, Tempo, Wurfschwerpunkt | — | existiert nicht |
| Verteidigungssystem (Mann/Zone), Screen-Verteidigung | — | existiert nicht |
| Bretter angreifen oder zurücklaufen | — | existiert nicht |
| Endspiel (Foul, 2-für-1, letzter Wurf, Auszeit) | — | existiert nicht |

`grep` über `engine.js` nach Zone, Switch, Hedge, Auszeit, Teamfoul, absichtlichem Foul: kein
Treffer im Feldspiel-Code.

### 0.3 Nachgemessen (24 Spiele, jeSeite 6, `main` `6b471366`)

Zwei Läufe im Scratchpad: `feldspielProbe("basketball",{n:24,jeSeite:6})` über die unveränderte
Seite, dazu eine instrumentierte **Kopie** der Engine mit Zählern an Screen, Roll, Kick-out, Hilfe,
Steal-Versuch, Abfangen, Fastbreak-Wurf und Ausbruch. An der Mechanik ist dabei keine Zeile
geändert, die Kopie liegt nicht im Repo.

| Kennzahl je Spiel (beide Teams) | Motor | Stand 03.09. | NBA-Referenz |
|---|---:|---:|---|
| Punkte | 84,9 | 86,4 | — (6 min) |
| Ballbesitze | 99 | 99,6 | — |
| **Sekunden je Ballbesitz** (Sim = Zuschauzeit) | **3,6** | — | ≈ 14–15 |
| Feldwürfe / FG% | 79,6 / 43,2 % | 82,8 / 42,5 % | FG 47 % |
| **Dreieranteil an FGA** | **49,0 %** | 48,7 % | 39–42 % |
| Quote dunk / nah / mit / fern | 90,8 / 46,4 / 31,2 / 36,0 % | ähnlich | Ring ≈ 65 %, Mitteldistanz ≈ 40–42 %, 3P 36 % |
| **Steals / Ballverluste je 100 Ballbesitze** | **28,4 / 33,0** | 25,8 / 30,5 | ≈ 8 / ≈ 14 |
| davon abgefangene Pässe / Steals am Ball | 18,0 / 10,1 | — | — |
| **Pässe / Abfangquote je Pass** | 149 / **12,1 %** | — | ≈ 300 je Team, Abfangquote um 1–2 % (Größenordnung, s. Quellen) |
| Steal-Versuche am Ball | 189 | — | — |
| **Fouls** | **1,9** | 2,3 | ≈ 37–46 |
| Blocks | 3,6 | 3,3 | 8–11 |
| Assists / assistierte FGM | 16,3 / 47 % | 45 % | ≈ 60–65 % |
| Offensiv-Rebound-Quote | 27 % | 26,4 % | 26–28 % |
| **Würfe im Fastbreak-Fenster** | **23,8 (30 %)**, FG 54 % | nicht gemessen | Transition ≈ 15 % der Ballbesitze |
| Ausbrüche | 24,8 | — | — |
| Hilfe-Auslösungen / Kick-outs (davon aus Doppel) | 139 / 17,3 (8,1) | — | — |
| **Screens / daraus Rolls / Würfe des Roll-Manns** | **36,4 / 17,2 / 0,63** | nicht gemessen | Pick-and-Roll ≈ 20 % der Ballbesitze |
| Alley-Oops | 0,46 | — | — |
| Zwangswürfe (Schussuhr) | < 0,1 | — | — |

Seit dem 03.09. hat sich an diesen Kanälen also nichts bewegt. Der Befund ist stabil.

### 0.4 Was schon da ist (die gute Nachricht)

- Ein **Live-Motor mit Raum und Zeit**: Positionen, Laufwege, Deckerabstand beim Wurf. Alles, was
  eine Taktikschicht braucht, ist messbar da.
- **Doppeln und Kick-out** entstehen emergent aus Hilfe → Bedrängnis → offenster Mitspieler. Das
  ist das Gerüst von Drive-and-Kick.
- **Kontest als Paarung** (Eingriff b1): ein 90er-Verteidiger drückt gegen einen 95er-Schützen
  weniger als gegen einen 30er. Das ist inhaltlich richtig.
- **Vier Archetypen führen ihre Kategorie** (Rezepte, Archetypen-Runde): Die Leitlinie „mehrere
  Wege zum Erfolg" ist auf Box-Score-Ebene bereits erfüllt (Abschnitt 3).
- **Viertelpause** mit Overlay und Buzzer, **Fokus-Doppeln** mit Bedienung und KI-Vorgabe. Das ist
  der Andockpunkt für eine Trainerkarte, die Chris am 06.09. schon angedacht hat („dann müsste man
  ja auswählen können wen ein spieler doppelt usw").
- **Hockeys `puste`-Block** (`FELDSPIEL_ART.hockey.puste`, `:6433`) ist ein fertiges
  Ermüdungssystem im selben Chassis; AUSDAUER könnte in Basketball darüber lebendig werden.

---

## 1. Was echten Basketball taktisch ausmacht (Referenz)

Knapp, nur so weit, wie es für die Bewertung gebraucht wird. Zahlen mit Quelle, Liste unten.

**1.1 Ballbesitz-Ökonomie.** Ein Spiel ist eine Folge von Ballbesitzen, jeder etwa 1 Punkt wert.
Taktik heißt, den eigenen Erwartungswert je Ballbesitz zu heben und den des Gegners zu senken. Die
Stellschrauben sind dieselben vier, die Dean Oliver „Four Factors" nennt: Wurfqualität,
Ballverluste, Offensiv-Rebounds, Freiwürfe. Ballverluste (≈ 14 je 100) sind teuer, weil sie
Fastbreaks gegen sich erzeugen. **Sie entstehen fast immer aus einer riskanten Entscheidung** des
Angriffs (Pass in den Verkehr, Drive in die Hilfe) oder einer riskanten Entscheidung der
Verteidigung (Griff nach dem Ball, der ein Foul riskiert).

**1.2 Angriff.** *Spacing*: Schützen ziehen Verteidiger aus der Zone („Gravity"). *Pick-and-Roll*
ist die häufigste Aktion der Liga (16 % → 22 % der Ballbesitze 2009–14, heute höher). Sie ist ein
Zwei-gegen-zwei, das die Verteidigung zu einer Entscheidung zwingt; der Roll-Mann ist die
effizienteste Anschlussoption. *Drive-and-Kick*: Ein Drive zwingt Hilfe, der Pass geht zum Mann,
den der Helfer verlassen hat. *Transition*: ≈ 15 % der Ballbesitze, deutlich effizienter als
Halbfeld (≈ 1,26 gegen 0,98 Punkte). *Post-up und Isolation* für Mismatches.

**1.3 Verteidigung.** Manndeckung ist in der NBA Standard; Zone ist Beiwerk (Miami, der
eifrigste Zonen-Team, 13,5 % der Defensivbesitze), in FIBA- und Jugendbasketball häufiger. Die
eigentliche taktische Entscheidung fällt **gegen den Pick-and-Roll**: *Drop* schützt den Ring und
gibt den Pull-up aus der Mitteldistanz frei (≈ 1,00–1,05 PPP). *Switch* hält alles vor sich,
erzeugt aber Mismatches (≈ 0,92–0,98). *Hedge* ist die vorsichtige Mitte. *Blitz* (Doppeln am
Screen) erzwingt Ballverluste, lässt aber Schützen auf der schwachen Seite frei (≈ 0,85 oder 1,15+,
bimodal). *Hilfsprinzipien*: Man hilft vom **Nichtschützen** weg, nicht vom Schützen. Der tiefe
Helfer „taggt" den Roll-Mann und rotiert zurück (Closeout). *Ringschutz* wirkt vor allem
**abschreckend**: Würfe am Ring werden gar nicht erst genommen.

**1.4 Bretter gegen Rückweg.** Jeder Spieler, der zum Offensiv-Rebound geht, fehlt in der
Transition-Verteidigung. Die Liga hat das über zehn Jahre zugunsten des Rückwegs entschieden
(Offensiv-Rebound-Quote 30 % → 26 %). Wer hinten liegt, geht spät im Spiel wieder mehr an die
Bretter. Das ist ein echter, lesbarer Tausch.

**1.5 Fouls und Spielstand.** Fouls sind der Preis für aggressive Verteidigung. Teamfouls führen zum
Bonus, persönliche Fouls zu Foul Trouble (Trainer nehmen den Spieler in > 70 % der Fälle sofort
raus). Im Endspiel entsteht eine eigene Taktik: letzter Wurf, 2-für-1, absichtliches Foul des
Zurückliegenden, „Foul up 3" des Führenden (heute in 34 % der Gelegenheiten, 2010 in 11,5 %),
Dreier erzwingen bei −3.

**1.6 Rollen.** Point Guard organisiert und initiiert den Pick-and-Roll. Flügel sind Schützen
und Slasher. „3-and-D" ist ein Spieler, der Ecke und Gegenspieler hält. Ein Ringbeschützer steht
tief und nimmt die Hilfe. Ein Rim-Runner rollt, ein Stretch-Big „poppt" zur Dreierlinie. Die
Crunchtime-Option bekommt den letzten Ball. **Eine Rolle ist ein Auftrag**, kein Wertezuschlag.

---

## 2. Bewertung: Was fehlt an echter taktischer Tiefe

### 2.1 Übersicht

| Element | Motor heute | Urteil |
|---|---|---|
| Ballbesitz, 2/3 Punkte, Schussuhr, Viertel | vorhanden | gut |
| Wurfqualität nach Distanz und Deckerabstand, Kontest als Paarung | vorhanden | gut (Monotonie je Distanzstufe noch offen, s. 03.09. 4.3) |
| Spacing | 6 feste Plätze, zugeteilt nach SCHUSS_NAH | flach: Platz ≠ Rolle |
| Drive-and-Kick | emergent über Hilfe → Kick-out | vorhanden, aber Hilfe kennt keine Schützen |
| Pick-and-Roll | Screen als Bremse, Roll-Lauf | **Kulisse** (0,6 Roll-Würfe je Spiel) |
| Off-Ball (Cuts, Off-Ball-Screens) | Platzwechsel per Zufall nach 2,4 s eng gedeckt | fehlt |
| Post-up / Mismatch suchen | Mismatch wirkt nur auf Bewegung des Verteidigers | fehlt als Angriffsentscheidung |
| Transition | Fenster 3 s, Ausbruch des Schnellsten | vorhanden, aber zu dominant (30 % der Würfe) |
| Manndeckung | nächster freier Angreifer | **implizit „switch everything"**, keine Zuordnungslogik |
| Zone | — | fehlt |
| Screen-Verteidigung (Drop/Switch/Hedge/Blitz) | — | fehlt |
| Hilfsprinzipien (vom Nichtschützen helfen, Tag, Closeout) | Hilfe nach ABWEHR und Abstand | flach |
| Ringschutz | Block färbt nur feststehende Fehlwürfe um | **fehlt als Abschreckung** |
| Ballverluste | Steal-Würfel je Decker alle 2 s, 12 % Abfangquote je Pass | **Risiko am falschen Ort** |
| Fouls, Freiwürfe | nur Wurffouls mit Bedränger, 1,9 je Spiel | **fehlt als System** |
| Bretter gegen Rückweg | — | fehlt |
| Endspiel / Spielstand | — | fehlt |
| Ermüdung | AUSDAUER mechanisch tot | fehlt |
| Rollen als Auftrag | nur Wertezuschlag | **fehlt** |
| Trainer-Entscheidungen | nur Fokus-Doppeln | **fehlt** |

### 2.2 L1 — Rollen sind Etiketten

Der Manager wählt für sechs Slots aus, wer „Floor General", „Rim Pressure", „Perimeter",
„Help Defense", „Clutch Shot" und „Fast Break" spielt. Mechanisch passiert danach genau eines:
`BASKETBALL_POS_MOD` verschiebt einzelne Sub-Skills um wenige Punkte. Dann:

- den Ball führt, wen `spielmacherLos` nach AUFBAU zieht, nicht der Floor General;
- korbnah steht, wer den höchsten SCHUSS_NAH hat, nicht Rim Pressure;
- helfen darf jeder Verteidiger im Umkreis, Help Defense ist nicht der Helfer;
- „Clutch Shot" hat keine Clutch-Situation; der Motor kennt keine Crunchtime;
- aus dem Fastbreak bricht der Schnellste aus, nicht der Fast-Break-Slot.

Für Chris heißt das: Die Aufstellung, die er als taktische Entscheidung erlebt, ist auf dem Feld
**unsichtbar**. Wer einen reinen Schützen auf „Floor General" stellt, sieht ihn trotzdem an der
Dreierlinie warten, weil sein AUFBAU niedrig ist. Das ist der deutlichste Unterschied zu echtem
Basketball, wo die Rollenverteilung das Erste ist, was ein Trainer festlegt.

### 2.3 L2 — Es gibt keinen Trainer

Beide Teams spielen immer dasselbe System: sechs Plätze, Manndeckung, Hilfe nach Nähe, gleiches
Tempo. Außer dem Fokus-Doppeln kann niemand etwas wählen. Dabei lebt Basketball-Taktik von
**Gegenmitteln**: Zone gegen schwache Schützen, Switch gegen ein Team ohne Post-Spieler, Drop gegen
ein Team ohne Pull-up-Werfer, Bretter angreifen, wenn der Gegner klein ist. Heute gibt es kein
Matchup zwischen **Systemen**, nur zwischen Spielern.

### 2.4 L3 — Die Verteidigung entscheidet nichts

- **Zuordnung:** Jeder nimmt den nächsten freien Angreifer. Das ist ein unbeabsichtigtes „switch
  everything" ohne jede Absicht: Niemand versteckt einen schwachen Verteidiger, niemand sucht sich
  den besten Gegner.
- **Screen:** Der Decker wird für die Dauer des Screens auf 35 % Tempo gebremst. Der Verteidiger des
  Screeners tut nichts, eine Wahl gibt es nicht. Ob der Roll-Mann frei ist, ist Zufall der
  Geometrie.
- **Hilfe:** Die Hilfsentscheidung liest die eigene ABWEHR und den Abstand, nicht **wen** der
  Helfer dafür verlässt. Real ist genau das die Kernfrage (vom Nichtschützen helfen).
- **Ringschutz:** Weil der Block erst nach dem Fehlwurf ausgewertet wird (`:11195`), senkt ein
  Ringbeschützer die Trefferquote am Ring nicht über den normalen Kontest hinaus und schreckt keinen
  Wurf ab. Die Dunk-Quote liegt bei 90,8 % (NBA am Ring ≈ 65 %). Die Zone ist ein Selbstbedienungs-
  laden, sobald ein Spieler durchkommt.

### 2.5 L4/L5 — Pick-and-Roll ist Kulisse, und das Risiko sitzt am falschen Ort

**Pick-and-Roll.** 36 Screens je Spiel sind viel, aber nur 17 werden zu einem Roll, und daraus
entstehen 0,6 Würfe. Der Grund steht in der Reihenfolge von `entscheideBallaktion`: Der Screen ist
der **letzte** Zweig, falls weder Wurf noch Pass gewürfelt wurden. Bis der Block nach 1,2 s steht,
hat der Ballführer in der Regel längst gepasst oder geworfen. Auch dann ist er dafür nicht
belohnt worden, denn am Wurf selbst ändert der Screen nur den Deckerabstand. Die zentrale Aktion
des modernen Basketballs ist also gebaut, aber ohne Folgen.

**Risiko.** Real ist ein Ballverlust fast immer die Rechnung für eine **Entscheidung**. Im Motor
ist er eine **Umgebungsbedingung**:

- Am Ball würfelt **jeder** Decker in 45 px alle 2 s, egal ob der Ballführer steht, dribbelt oder
  gerade den Ball bekommen hat (189 Versuche je Spiel). Der Verteidiger zahlt für den Versuch
  nichts, weil es kein Reach-in-Foul gibt.
- Jeder Pass hat eine Abfangchance von mindestens 3 %, bei einem Verteidiger nahe der Linie bis
  32 %, gemessen im Schnitt **12 %**. Ein Spielmacher, der den Ball bewegt, spielt damit Lotterie
  gegen sich selbst. Das erklärt nachträglich, warum die Archetypen-Runde den Pass so lange gegen
  den Box-Score-Wert verteidigen musste (`rezepte.js`, TEAMGEIST-Kommentar: „wer abgibt, tauscht rund
  1,2 erwartete eigene Punkte gegen eine Vorlage zu 1,0").
- Folge: 28 % aller Ballbesitze enden in einem Steal, und 30 % aller Würfe sind Fastbreak-Würfe
  mit 54 % Quote. Das Spiel ist ein Umschaltspiel, kein Halbfeldspiel. Taktik im Halbfeld hat
  gar nicht genug Ballbesitze, um sichtbar zu werden.

**Warum das kein Kalibrierproblem ist:** Senkt man nur die Steal- und Abfangkonstanten, verliert der
Verteidiger-Archetyp seinen Hauptkanal im Impact-Wert. (Steals + Blocks) × 1,5 ist heute der
einzige Posten, über den reine Verteidigung zählt. torment, das laut Rezept „einzige Attribut, das
AUSSCHLIESSLICH Verteidigung bezahlt", würde einbrechen, und die Pp-Abweichung stiege. Risiko und
Verteidigungswert müssen **zusammen** umgebaut werden (Vorschlag P1, Abschnitt 4).

### 2.6 L6 — Kein Spielstand-Bewusstsein

Das Spiel weiß nicht, wie es steht und wie viel Zeit bleibt. `liegtZurueck` wirkt nur auf die
Platzverteilung in der Viertelpause. Es gibt keinen letzten Wurf zum Viertelende (die Uhr läuft
einfach aus), kein 2-für-1, kein Foul des Zurückliegenden, kein „Foul up 3", keinen erzwungenen
Dreier bei −3 und keine engere Deckung am Ende enger Spiele. Die Bedeutung des Clutch-Slots hängt
aber genau daran. Für den Zuschauer ist das der dramatischste fehlende Teil: Enge Spiele enden
heute genauso wie Blowouts.

### 2.7 L7 — Kein Körper, keine Zeit

- **AUSDAUER ist tot** (`rezepte.js`: „kein einziger Aufruf liest u.AUSDAUER"). Damit fehlen die
  Taktiken, die an Kraft hängen: Tempo spielen, pressen, einen Gegner müde laufen.
- **3,6 s je Ballbesitz.** Eine Halbfeldsequenz aus Screen (1,2 s), Roll (1,5 s), Hilfe und
  Kick-out passt nicht in die Zeit, die ein Ballbesitz im Schnitt hat. Außerdem sieht der Zuschauer
  bei `ZEIT_DEHNUNG.basketball=1` jede Aktion in Echtzeit, Taktik ist so kaum lesbar. Das ist
  kein Plädoyer für mehr Spielzeit: CLAUDE.md belegt am Hockey, dass mehr Uhr rho nicht hebt. Es
  ist ein Argument für **weniger, aber reichere Ballbesitze** (weniger Lotterie-Enden, mehr
  Entscheidungen je Besitz), siehe P7.
- **6 gegen 6** statt 5 gegen 5. Das ist eine projektweite Setzung (sechs Slots je Disziplin) und hier
  kein Vorschlag, sie zu ändern. Es macht das Feld aber enger und ist ein Grund, warum Spacing und
  Zone in diesem Motor anders aussehen müssen als in der NBA (s. P4: Zone 3-3 statt 2-3).

### 2.8 Was die frühere Doku schon hatte, und was neu ist

`basketball-finalisierung-recherche-fable.md` (03.09.) Abschnitt 4 und 5 hatte bereits: Steals zu
hoch, Fouls fehlen, Kontest stetig machen, Endspiel-Regeln, AUSDAUER, Pick-and-Roll „messen, dann
Switch-Entscheidung". Das Dokument bleibt gültig, und diese Befunde bestätigt die Nachmessung
oben. **Neu in diesem Review:**

1. Steals/Fouls sind ein **Konzeptfehler** (Risikoquelle), nicht nur eine Kalibrierung, und sie
   hängen am Verteidigungswert im Impact (2.5).
2. **Rollen sind Etiketten** (2.2), mit Codebeleg für jeden der sechs Slots.
3. Pick-and-Roll ist **gemessen**: 0,6 Roll-Würfe je Spiel, und die Ursache ist die Zweig-
   Reihenfolge.
4. **Abfangquote je Pass 12 %**: Ballbewegung wird bestraft.
5. **Fastbreak-Anteil 30 %** der Würfe (dort war er „nicht gemessen").
6. **Fehlende Mannschaftstaktik** als eigene Lücke (2.3), mit Vorschlag Trainerkarte.
7. **Ringschutz ohne Abschreckung** (Block nach feststehendem Fehlwurf).
8. **3,6 s je Ballbesitz** als Grenze für lesbare Taktik.

`basketball-doppeln-taktik-pause-recherche-06-09.md` bleibt als Vorarbeit für die Trainerkarte
gültig, besonders der Präzedenzfall, dass ein vorgezogenes `zuordneDeckung(true)` in der Pause rho
schadete (0,722 statt 0,740). Jede Pausen-Entscheidung muss deshalb ohne Neuwürfeln der
Bewegungskette auskommen.

---

## 3. Mehrere Wege zum Erfolg (Design-Leitlinie aus CLAUDE.md)

**Was schon stimmt.** Auf Box-Score-Ebene gibt es vier Wege: Punkte nah, Punkte fern, Vorlagen,
Verteidigung plus Rebounds. Die Vier-Archetypen-Demo belegt, dass jeder Build seine Kategorie
führt. Das ist mehr, als die meisten Disziplinen haben.

**Was fehlt.** Die Leitlinie meint mehr als getrennte Box-Score-Spalten: **dieselbe Aufgabe** soll
über einen Primärweg (volles Ergebnis) und einen Nebenweg (schlechter gestellt) lösbar sein. In
Basketball gibt es das heute nicht. Jede Aufgabe hängt an genau einem Sub-Skill, und wer den nicht
hat, ist bei dieser Aufgabe draußen. Vorschlag, innerhalb der gesperrten Matrix (nur die neun
erlaubten Attribute, Gewichte unangetastet; verschoben wird nur, **über welchen Sub-Skill** ein
Attribut wirkt):

| Aufgabe | Primärweg | Nebenweg (schlechter gestellt) |
|---|---|---|
| Abschluss am Ring | **Kraft-Abschluss** (power/spirit, SCHUSS_NAH): hohe Quote, höheres Block- und Foulrisiko, zieht Freiwürfe | **Finesse-Korbleger** (dexterity/awareness): etwas niedrigere Quote, weicht dem Ringbeschützer aus |
| Wurf schaffen | **Catch-and-Shoot** (intelligence/awareness, SCHUSS_FERN) nach Pass | **Selbst kreieren** über Pick-and-Roll/Pull-up (charisma/dexterity, AUFBAU): schlechterer Wurf, aber ohne Passgeber |
| Verteidigung | **Am Mann** (torment/speed, ABWEHR): Kontest, verhinderte Punkte | **Antizipation** (intelligence/awareness): Hilfe, Tag des Roll-Manns, Abfangen im Passweg; seltener, aber mit Stopp-Gutschrift |
| Rebound | **Ausboxen** (torment, ZWEITCHANCE): Rebound am Ring | **Lange Abpraller** (speed/intelligence): holt die Fernwurf-Abpraller, die weiter springen |
| Spielmachen | **Vorlage** (charisma, AUFBAU) | **Extra-Pass** (awareness): der Pass nach dem Kick-out, zählt als „Hockey-Assist" mit halbem Gewicht |

Voraussetzung ist die Pp-Abnahme (≤ 25, zwei Saatstämme): Jeder Nebenweg verschiebt, wie stark ein
Attribut mechanisch trägt. Die Tabelle ist ein Denkrahmen für die Umbau-PRs in Abschnitt 6, kein
eigenes Paket. Am meisten zählt die **Verteidigungszeile**: Sie ist die Bedingung dafür, dass P1
(weniger Steal-Lotterie) den Verteidiger nicht entwertet.

---

## 4. Vorschläge, priorisiert (nur Konzept)

Reihung nach **Gewinn an echtem Basketball × Anteil an der Validitätslücke**, nicht nach
Aufwand. Jeder Vorschlag nennt den Primärhebel, die Abnahme und das rho-Risiko.

### P1 — Risiko an Entscheidungen binden; Fouls als Preis; Verteidigung über verhinderte Punkte

*Warum zuerst:* größte Verzerrung dessen, was Basketball ist (ein Drittel der Ballbesitze endet per
Würfel), und die wahrscheinlich größte Rauschquelle in rho.

1. **Steal am Ball nur noch als Reaktion auf eine Aktion des Ballführers**: beim Andribbeln gegen
   einen Verteidiger, der vor ihm steht, beim Drive in eine Hilfe, beim Dribbeln im Doppel. Nicht
   mehr alle 2 s je Decker in Reichweite. Der Verteidiger **entscheidet**, ob er greift (Neigung aus
   ABWEHR und Spielstand). Ein misslungener Griff ist mit einer Chance ein **Reach-in-Foul**.
2. **Pass-Risiko nach Passart**: Ein Standardpass über offene Linien ist fast sicher, ein Pass durch
   den Verkehr, ein Skip-Pass über das Feld oder ein Pass aus dem Doppel ist riskant. Heute hat
   jeder Pass mindestens 3 % Abfangrisiko und im Schnitt 12 %. Das Risiko hängt am
   **Passweg**, den der Ballführer wählt (AUFBAU/awareness gegen ABWEHR/intelligence des
   Passweg-Verteidigers), nicht an der bloßen Existenz eines Verteidigers in 55 px.
3. **Foul-System**: Reach-in, Wurffoul (vorhanden), Blockfoul am Ring; **Teamfouls je Viertel mit
   Bonus** ab dem fünften; **Foul Trouble** ohne Bank als Vorsicht (ab dem Q+1-Limit sinkt die
   Griff- und Blockbereitschaft, zengm-Form, s. 03.09. 4.2). Der Freiwurf-Zustand existiert schon
   (`starteFreiwuerfe`).
4. **Verteidigungswert über verhinderte Punkte** („Stopps", das defensive Gegenstück zu K3): Für
   jeden Wurf seines Mannes wird dem Decker gutgeschrieben, wie weit die erwartete Punktzahl
   (`technik × Punkte`, liegt in `wirf()` schon vor) unter dem Wert liegt, den derselbe Wurf ohne
   ihn (offen, gleiche Distanz) gehabt hätte. Das ist deterministisch (kein neuer Würfel), belohnt
   den Kontest statt der Lotterie und ersetzt den Wertkanal, den weniger Steals wegnehmen.

*Abnahme (Korridore, Vorschlag):* Ballverluste 12–16 je 100, Steals 6–10 je 100, Fouls 15–22 je
Team-Spiel-Äquivalent, FTA/FGA 0,18–0,28, Fastbreak-Anteil an den Würfen 12–20 %. Dazu Pp ≤ 25 und
rho ≥ 0,769.
*rho-Risiko:* hoch, aber in beide Richtungen offen; Begründung in 5.2.

### P2 — Rollen werden Aufträge

*Warum:* Das macht die Aufstellung, die einzige Entscheidung, die der Manager heute trifft, auf dem
Feld sichtbar. Und es richtet das Verhalten an dem aus, was `eig` über `slotAufschlag` ohnehin
schon unterstellt.

| Slot | Auftrag auf dem Feld |
|---|---|
| Floor General | primärer Ballführer; bekommt den Ball nach Korb und Defensiv-Rebound; ruft den Pick-and-Roll |
| Rim Pressure | Screener und Roll-Mann, belegt den korbnahen Platz; im Angriff Post, in der Verteidigung der tiefe Mann am Ring |
| Perimeter | Spacer in Ecke oder Flügel; erste Kick-out-Adresse; läuft von dort Cuts, wenn sein Verteidiger hilft |
| Help Defense | designierter Helfer der schwachen Seite: taggt den Roll-Mann, doppelt als Erster, rotiert zurück. Nur er darf „früh" helfen, alle anderen später. |
| Clutch Shot | Crunchtime-Option: bekommt den Ball bei Schussuhr-Ende, beim letzten Angriff eines Viertels und in engen Schlussminuten (braucht P5) |
| Fast Break | läuft nach Steal und Defensiv-Rebound als Erster die Bahn (statt „der Schnellste des Teams") |

Die Zuteilung nach SCHUSS_NAH bleibt als **Rückfall** für Slots ohne Rolle, zum Beispiel in
Unterzahl. Die Rolle bestimmt das **Verhalten**, der Erfolg bleibt bei den Sub-Skills: Ein
schlechter Floor General führt den Ball, aber schlecht. Das ist genau Chris' Erwartung („wenn ich
einen Spieler mit einer Stat von 80 reinschicke …") in beide Richtungen: Die richtige Rolle holt
heraus, was der Spieler kann; die falsche Rolle kostet sichtbar.

*Abnahme:* In der Vier-Archetypen-Demo muss jeder Build in seiner passenden Rolle seine Kategorie
**deutlicher** führen als heute und in einer unpassenden Rolle sichtbar abfallen.
*rho-Risiko:* mittel. In KI-gegen-KI-Spielen stellt die KI auf; ist ihre Aufstellung vernünftig,
steigt die Validität. Stellt sie schlecht auf, fällt rho, und das ist dann ein Befund über die
Aufstellungs-KI, nicht über die Mechanik.

### P3 — Pick-and-Roll als echte Zwei-gegen-zwei-Aktion mit Verteidiger-Wahl

1. **Der Screen ist eine Aktion, kein Rest-Zweig**: Der Floor General **wählt** den Pick-and-Roll
   (Neigung aus AUFBAU und Teamtaktik) und wartet auf den Block.
2. **Die Verteidigung antwortet mit ihrer Coverage** (Teamtaktik aus P4, sonst KI-Vorgabe):
   - *Drop*: Der Screener-Verteidiger bleibt tief. Offen ist der Pull-up aus der Mitteldistanz.
   - *Switch*: Die Verteidiger tauschen. Offen ist das Mismatch (vorhandenes `mismatch*`-System).
   - *Blitz*: Zwei auf den Ball (Fokus-Doppeln-Mechanik). Offen ist der kurze Roll oder der
     Kick-out zur schwachen Seite; Ballverlust-Chance steigt.
3. **Der Ballführer liest** (awareness/intelligence): Pull-up, Pass zum Roll-Mann, Pass zum
   Pop-Mann (Screener mit hohem SCHUSS_FERN poppt statt zu rollen), Kick-out zur schwachen Seite,
   wo der Help-Defense-Spieler (P2) den Roll-Mann taggt und seinen eigenen Mann freigibt.

Das ist die Stelle, an der „Primär-/Nebenweg" am natürlichsten wird: Derselbe Pick-and-Roll ergibt
für einen Schützen, einen Rim-Runner und einen Passer drei verschiedene beste Anschlüsse.

*Abnahme:* Pick-and-Roll-Aktionen 15–25 % der Halbfeldbesitze; Roll- und Pop-Abschlüsse als eigene
Zählgröße; die drei Coverages mit unterschiedlichem, plausiblem Ergebnisprofil (Drop mehr
Mitteldistanz, Switch mehr Mismatch-Abschlüsse, Blitz mehr Ballverluste und mehr offene Dreier).
*rho-Risiko:* mittel. Neue Verzweigungen verschieben die Würfelkette (derselbe Effekt, der bei
`technikGate` gemessen ist), aber jeder Zweig ist ein Skill-Test statt eines Zufallsendes.

### P4 — Trainerkarte: wenige Schalter, lesbare Gegenmittel

Drei Schalter je Team, vor dem Spiel und in jeder Viertelpause änderbar (Chris' Idee vom 06.09.),
dazu das bestehende Fokus-Doppeln. Für KI-Spiele eine **Vorgabe aus dem Kader**, nach demselben
Muster wie `berechneFokusAuto` (rechnet, würfelt nicht):

| Schalter | Stufen | Gegenmittel-Logik |
|---|---|---|
| Angriff | *Tempo* (Transition suchen) · *Halbfeld/Pick-and-Roll* · *Innen* (Post, Drive) | Tempo gegen langsame Teams, Innen gegen kleine, Pick-and-Roll gegen schwache Screen-Verteidiger |
| Verteidigung | *Mann eng* (mehr Druck, mehr Fouls) · *Mann tief/Pack-Line* (mehr Sag, Zone zu, Dreier offener) · *Zone 3-3* | Zone gegen schwache Schützen, Mann eng gegen schwache Ballführer |
| Screen-Coverage | *Drop* · *Switch* · *Blitz* | s. P3 |
| Bretter | *Angreifen* (2 Spieler zum Offensiv-Rebound) · *Zurück* (Transition-D) | angreifen, wenn man zurückliegt oder größer ist |

Das Prinzip bleibt aus der Arena bekannt: **Die Taktik ist ein Multiplikator, keine
Ersatzeignung.** Jede Stufe verschiebt, *welche* Sub-Skills zählen, nicht *wie viel* ein Team
kann. Zone wird für 6 gegen 6 als 3-3 gedacht (drei Plätze an der Dreierlinie, drei in der Zone).
Das ist ein Vorschlag ohne reale Referenz und muss beim Bau gezeichnet und geprüft werden.

*Abnahme:* rho mit KI-Vorgabe auf beiden Seiten (so misst die Sonde). Eine Stein-Schere-Papier-
Probe: Jede Stufe muss gegen ihr Gegenmittel messbar verlieren und gegen ihr Ziel gewinnen.
*rho-Risiko:* niedrig bis mittel. Mit symmetrischer KI-Vorgabe ist der Schalter weitgehend
kaderbestimmt. Die manuelle Wahl ist ein Manager-Kanal, den die rho-Sonde nicht sieht; das ist
gewollt.

### P5 — Spielstand-Logik: Endspiel, Fouls, Clutch

Klein, sichtbar, weitgehend rho-neutral, weil es nur die letzten Sekunden eines Viertels und enge
Schlussphasen betrifft:

- **Letzter Angriff eines Viertels** wird ausgespielt: Ball zum Clutch-Slot, Wurf vor dem Buzzer.
- **2-für-1** vor Viertelende.
- **Zurückliegend spät:** absichtliches Foul (über das Foul-System aus P1), Dreier erzwingen bei −3,
  Bretter angreifen (P4-Schalter automatisch).
- **Führend um 3 in den letzten Sekunden:** „Foul up 3" als KI-Option.
- **Enge Schlussminuten:** engere Deckung, Wurfqualität insgesamt leicht niedriger. Die Literatur
  findet keinen „Clutch-Spieler" als Eigenschaft, wohl aber, dass am Ende alle schlechter werfen
  (03.09. 4.7). Der Clutch-Slot ist deshalb ein **Adressat**, kein Bonus.

*Abnahme:* Zählgrößen (Buzzer-Würfe, absichtliche Fouls, 2-für-1) plus rho unverändert
(± Kaderspannweite).

### P6 — Ringschutz vor dem Wurf

Der Block wird Teil der Wurfauflösung am Ring (Stufen dunk/nah), nicht ein Etikett auf einem
Fehlwurf. Ein tiefer Verteidiger (Rim Pressure in der Verteidigung, Help Defense) senkt die
Trefferchance und erhöht die Kick-out-Neigung **vor** dem Wurf, also Abschreckung. Nebenweg:
Finesse-Korbleger (Abschnitt 3). Das senkt die heutigen 90,8 % am Ring über eine Ursache, nicht
über eine Konstante, und gibt dem Kraft-Abschluss ein echtes Gegenüber.

*rho-Risiko:* mittel. Die Dunk-Stufe ist der größte Term der Wurfformel (`GEO_BONUS.dunk`). Der
Umbau muss die Tier-Mittelwerte halten, wie es schon beim Eingriff b2 geschah.

### P7 — Körper und Zeit: AUSDAUER und reichere Ballbesitze

- **AUSDAUER** über Hockeys `puste`-Block lebendig machen: Ein Sprintbudget im Fastbreak und im
  engen Mann; die Teamtaktik „Tempo" und „Mann eng" kostet Puste. Vorhandene Infrastruktur, eigene
  Kalibrierung.
- **Ballbesitzlänge**: Sie ergibt sich aus P1 und P3 (weniger Lotterie-Enden, Pick-and-Roll als
  Aktion). Ziel ist eine Halbfeldsequenz, die man sehen kann, bei ungefähr gleicher Zahl von
  **Skill-Tests** je Spiel. Keine Verlängerung der Spielzeit.

*Abnahme:* AUSDAUER liest in der Einflussmessung > 0; Sekunden je Halbfeldbesitz als neue Zählgröße;
rho nicht schlechter.

### Was ausdrücklich **nicht** vorgeschlagen wird

- Keine Änderung der Eignungsmatrix (gesperrt).
- Kein Wechsel auf 5 gegen 5 (projektweite Setzung; als Frage in Abschnitt 8).
- Keine Verlängerung der Spieldauer (Hockey-Befund: mehr Uhr hebt rho nicht).
- Keine neue Wurfformel: `steilerMake`, `MAKE_ANKER` und Kontest bleiben. Die Vorschläge ändern,
  **welche** Würfe entstehen, nicht, wie ein gegebener Wurf fällt.
- Kein „Clutch-Rating" als verdeckter Bonus.

---

## 5. Machbarkeit gegen die Schranken

### 5.1 Live-Disziplin

Basketball steht in `ARENA_RESOLVED_DISCIPLINE_IDS` und ist damit die einzige Disziplin, deren
Mechanik heute direkt in Chris' Spielstand wirkt. Jeder PR aus Abschnitt 6 braucht:
`npm run ci:rangtreue-schranke`, neu gezogene PPS-Referenz (`scripts/ziehe-basketball-pps-referenz.ts`),
Basislinie `data/generated/rangtreue-basislinie.json`, Pp-Messung über zwei Saatstämme
(`scripts/messe-arena-einfluss.mjs basketball 48`) und G1*-Messung (`scripts/miss-star-paartreue.mjs`).
Wie beim Climbing-Neukonzept (6.3) gilt: Jedes neue Feld ist ungesetzt bit-identisch zum heutigen
Stand, damit ein PR ohne rho-Gewinn zurückgenommen werden kann, ohne andere mitzureißen.

### 5.2 Die Rechnung in den zwei Größen

rho je Spiel 0,769 bei Saison 0,923 (`stand-aller-disziplinen.md`), also Verlässlichkeit ≈
(0,769 / 0,923)² ≈ 0,69. Nach CLAUDE.md heißt „Saison hoch, Einzelspiel niedrig": Die Mechanik
belohnt das Richtige, aber zu laut. Das spricht für **Ereignisse mit mehr Eignungsanteil**, nicht
für ein neues Rezept. Genau das ist P1: Heute enden 28 % der Ballbesitze in einem Steal-Würfel, der
nur schwach an der Eignung hängt, und jeder Steal zählt 1,5 im Impact. Ersetzt man ihn durch
Stopps (stetig, an Kontest und Paarung gebunden) und durch Ballverluste aus Entscheidungen, sollte
die Verlässlichkeit steigen. G1* spricht in dieselbe Richtung: Der Star steht nur in 43 % der Spiele
auf Rang 1, obwohl die Saison 0,923 liest.

**Das ist eine Hypothese, keine Messung.** Die Gegenkraft ist bekannt: Jede neue Verzweigung
verschiebt die Würfelkette, und die Einflussmessung in Basketball ist sprunghaft (`rezepte.js`: fünf
von fünf modellgestützten Rezepten schlechter als der Stand). Deshalb in Abschnitt 6 zuerst eine
Sonde (P0) und eine orthogonale Sondierung (`scripts/sondiere-feldspiel-subskills.mjs`) vor und
nach jedem Schritt.

### 5.3 Was bei rho-Schaden gilt

Wie beim Fokus-Doppeln: Ein Mechanik-PR, der rho unter die Kaderspannweite (≈ 0,10) drückt, wird
nicht durch Rezeptdrehen gerettet, sondern ungesetzt zurückgenommen, und der Befund kommt in dieses
Dokument. Die Taktikschicht ist nur dann ein Gewinn, wenn sie auch die Abnahme hält.

---

## 6. Bauplan in Etappen (sequenziell, alle fassen `engine.js` an)

| PR | Inhalt | Abhängig von | rho-Erwartung |
|---|---|---|---|
| **P0** | **Taktik-Sonde**: die Zähler aus 0.3 (Screens, Rolls, Roll-/Pop-Würfe, Abfangquote je Pass, Steal-Versuche, Fastbreak-Anteil, Sekunden je Ballbesitz, Fouls nach Art) als festes Werkzeug `scripts/miss-basketball-taktik.mjs`, dazu Korridore aus Abschnitt 4 | — | keine (Messung) |
| P1a | Stopps im Impact-Wert (defensives K3), zuerst **allein** gemessen | P0 | Wertformel, Mechanik bit-identisch |
| P1b | Risiko an Entscheidungen (Steal/Pass), Foul-System mit Reach-in, Teamfouls, Bonus und Foul Trouble | P1a | hoch, offen (5.2) |
| P2 | Rollen werden Aufträge | P1 | mittel |
| P5 | Spielstand-Logik (kann parallel zu P2, braucht nur das Foul-System aus P1b) | P1b | neutral |
| P3 | Pick-and-Roll mit Coverage und Lesen | P2 (Rollen: Floor General, Rim Pressure, Help Defense) | mittel |
| P4 | Trainerkarte (UI + KI-Vorgabe), Zone 3-3, Bretter-Schalter | P3 | niedrig bis mittel |
| P6 | Ringschutz vor dem Wurf, Finesse-Nebenweg | P2 | mittel |
| P7 | AUSDAUER über `puste` | P4 (Taktik „Tempo", „Mann eng") | neutral bis leicht positiv |

**Reihenfolge-Begründung:** P1a vor P1b, damit der Verteidiger seinen neuen Wertkanal hat, bevor
der alte schrumpft. Ohne das zeigt die Pp-Messung einen Einbruch, der wie ein Fehlschlag aussieht,
aber nur ein Übergang ist. P2 vor P3, weil der Pick-and-Roll die Rollen braucht (wer initiiert, wer
rollt, wer taggt). P4 nach P3, weil die wichtigste Taktikwahl (die Screen-Coverage) erst mit P3
eine Wirkung hat.

**Aufwand grob:** P0 eine halbe Runde; P1 zwei bis drei Runden (Kalibrierung gegen Korridore und
Pp); P2 und P5 je eine; P3 zwei; P4 zwei (UI); P6 und P7 je eine. Zusammen 10–13 Arbeitstage. Wer
nur einen Teil will: **P0 + P1 + P2** beantworten Chris' Frage „bildet das echten Basketball ab" am
stärksten; P5 ist der billigste sichtbare Gewinn.

---

## 7. Antwort auf die Auftragsfrage

> „Bildet die aktuelle Mechanik die taktischen Elemente überhaupt ab, oder ist es im Kern ein
> simples Grundgerüst mit Basketball-Wörtern drüber?"

**Weder noch.** Das Grundgerüst ist ehrlich Basketball, keine Kulisse: Raum, Deckung, Hilfe,
Kick-out, Wurfdistanzen, Rebounds und Transition sind echte Mechanik, gegen reale Quoten
kalibriert, mit Archetypen, die unterscheidbar sind. **Die Taktik darüber fehlt**: Rollen sind
Wertezuschläge, die Verteidigung wählt nichts, der Pick-and-Roll hat keine Folgen, das Risiko hängt
nicht an Entscheidungen, Fouls und Spielstand gibt es praktisch nicht. Deshalb ist eine
Balance-Runde **jetzt** nicht der richtige nächste Schritt. Sie würde Konstanten an einem
Konzept festzurren, dessen Risikoquelle und dessen Rollenverständnis sich noch ändern müssen. Nach
P0–P2 ist sie es.

---

## 8. Offene Fragen für Chris

1. **Soll die Aufstellung auf dem Feld sichtbar werden (P2)?** Heißt: Ein falsch aufgestellter
   Spieler spielt sichtbar schlechter, statt dass der Motor ihn stillschweigend dorthin schiebt, wo
   er am besten ist.
2. **Trainerkarte: nur vor dem Spiel, oder auch in jeder Viertelpause?** Die Pause ist heute ≈ 2 s
   Overlay; für eine Wahl müsste sie wie beim Fokus-Doppeln ohne Simulationspause bedienbar sein.
3. **Zone ja oder nein?** In der NBA ist sie Beiwerk, in FIBA- und Freizeitbasketball üblich. Für
   6 gegen 6 müsste eine eigene Form (3-3) gezeichnet werden.
4. **Fouls: Ausschluss nach sechs, obwohl es keine Bank gibt?** Vorschlag: kein Ausschluss, aber
   Foul Trouble als Vorsicht.
5. **Absichtliche Fouls im Endspiel**: gewünscht oder zu zäh zum Zuschauen? (Real umstritten, s.
   ESPN 2026.)
6. **6 gegen 6 bleibt?** Hier ist das als Setzung behandelt.
7. **Scorecard:** Soll „Konzept" für Basketball nach diesem Review von 100 heruntergestuft werden,
   bis P1–P3 gebaut sind?

---

## 9. Was dieses Review bewusst nicht tut

Kein Code, keine Konstanten, kein Rezept, keine Messung am echten Spielstand. Die übrigen
Feldspiele (Hockey, Football, Tennis) teilen viel Code mit Basketball. Jeder Vorschlag hier ist als
Basketball-Feld in `FELDSPIEL_ART.basketball` gedacht und ungesetzt wirkungslos, damit Hockeys
abgenommener Stand nicht mitwandert. Optik (Korb, Dribbelpose, Ballschatten) steht in der
Recherche vom 03.09. und ist nicht Gegenstand dieses Reviews.

---

## Quellen

**Im Repo gelesen:** `public/mockups/battle-mode.engine.js` (Zeilen oben), `public/mockups/battle-mode.rezepte.js`
(Basketball-Block), `lib/lineups/matchday-slot-roles.ts`, `docs/design/basketball-finalisierung-recherche-fable.md`,
`basketball-doppeln-taktik-pause-recherche-06-09.md`, `basketball-k3.md`,
`basketball-g1-stern-paartreue-10-09.md`, `climbing-neukonzept-22-09.md`, `stand-aller-disziplinen.md`,
`docs/pm-briefings/opus-plan-top-zehn-ueber-90-16-09.md`, `CLAUDE.md`.

**Nachgemessen (Scratchpad, nicht im Repo):** `feldspielProbe("basketball",{n:24,jeSeite:6})` über die
unveränderte Seite, dazu eine Kopie der Engine mit Zählern (Screens, Rolls, Roll-Würfe, Alley-Oops,
Kick-outs, Hilfe, Steal-Versuche, Steals am Ball, abgefangene Pässe, Fehlpässe, Pässe, Fastbreak-
Würfe, Ausbrüche, Zwangswürfe, Ballbesitze). Stand `main` `6b471366`.

**Web (diese Runde):**
- Pick-and-Roll-Coverages und PPP je Coverage: [hoopbrief.com](https://hoopbrief.com/blog/pick-and-roll-coverages-explained-drop-switch-blitz-ice), [levelupbasket.com](https://www.levelupbasket.com/blog/basketball-pick-and-roll-coverages-explained), [FiveThirtyEight zum Switchen](https://fivethirtyeight.com/features/anybody-and-everybody-can-switch-on-pick-and-rolls-now), [NBA.com Stats Ball Handler (Synergy)](https://www.nba.com/stats/teams/ball-handler)
- Zone-Nutzung und PPP gegen Zone: [NBA.com Numbers Notebook](https://www.nba.com/news/numbers-notebook-zone-defenses), [Basketball Poetry „The Twilight Zone"](https://www.basketballpoetry.com/p/the-twilight-zone-how-much-zone-defense)
- Offensiv-Rebound gegen Transition-D: [CBS Sports](https://www.cbssports.com/nba/news/examining-the-acceptance-and-abandoment-crashing-the-glass-on-offense/), [ESPN „Why are teams bored with boards?"](https://www.espn.com/nba/story/_/id/14505051/transition-defense-left-offensive-rebounds-cutting-room-floor), [Grantland „Party Crashers"](https://grantland.com/the-triangle/party-crashers-debunking-the-myths-of-offensive-rebounding-and-transition-defense/), [Nylon Calculus](https://fansided.com/2020/06/08/nylon-calculus-crash-the-glass-or-get-back-on-defense/)
- Hilfsprinzipien, Tag, Closeout: [pgcbasketball.com](https://pgcbasketball.com/blog/smarter-closeouts-defend-shooters-drivers-complete-players/), [thehoopsgeek.com](https://www.thehoopsgeek.com/pick-and-roll-defense/), [HoopsHype zur Entwicklung der NBA-Verteidigung](https://www.hoopshype.com/story/sports/nba/2025/04/21/how-nba-defense-has-changed-over-time/83198895007/)
- Endspiel „Foul up 3": [ESPN 2026](https://www.espn.com/nba/story/_/id/48582233/nba-playoffs-2026-foul-3-san-antonio-spurs-portland-trail-blazers-impact), [82games.com Lawhorn](http://www.82games.com/lawhorn.htm)
- Pässe je Spiel (Kerrs 300-Pässe-Marke, Größenordnung): [hoopcoach.org](https://www.hoopcoach.org/passes-per-possession-an-eye-opening-metric/), [NBA.com Stats Passing](https://www.nba.com/stats/players/passing?sort=PASSES_MADE&dir=1). Die Abfangquote „1–2 % je Pass" ist daraus **abgeleitet** (≈ 7–8 Steals je Team auf ≈ 300 Pässe, davon nur ein Teil Pass-Steals), nicht direkt abgerufen.

**Aus der Recherche vom 03.09. übernommen** (dort mit Quelle belegt): Liga-Schnitte 2023–26 (FG%, 3PA-Anteil,
Ballverluste, Fouls, FTA/FGA), Transition 15,4 % und 125,8 gegen 98,1 (Cleaning the Glass),
Pick-and-Roll-Anteile 2009–14 (Synergy via Bleacher Report), Foul Trouble Q+1 und > 70 % (Maymin via
Slate), Clutch-Befunde (inpredictable, Sarioz), zengm-Formeln.
