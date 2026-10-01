# Fable-Ideen Feldspiel — Basketball, Football, Hockey (30.09.)

**Reines Brainstorming, kein Code, keine Messung, keine Produktionsdatei angefasst.** Chris hat
gebeten, frisch auf die Feldspiel-Gruppe zu schauen und eigene Ideen einzubringen. Dieses
Dokument baut auf dem auf, was schon liegt — und das ist inzwischen viel: am 26.09. haben drei
Opus-Konzeptreviews (`basketball-`, `hockey-`, `football-opus-konzeptreview-26-09.md`, alle im
Repo-Verlauf) je Disziplin fünf bis sieben priorisierte Vorschläge hinterlassen. Ich wiederhole
keinen davon als „neu". Was hier steht, sind Kanäle, Formate und zwei Querschnittsbeobachtungen,
die in keinem der drei Reviews vorkommen.

**Leitplanken, die für jede Idee unten gelten (CLAUDE.md):**

- Die Eignungsmatrix (`lib/player-generator/official-discipline-weights.ts`) bleibt für alle
  zwanzig Disziplinen unangetastet. Keine Idee unten ändert ein Matrixgewicht; wo ein Attribut
  „mehr Kanal" bekommen soll, ist das immer ein Rezept- oder Mechanikkanal *innerhalb* der
  vorgegebenen Gewichte. Für Football gilt die Override-Eignung
  (`lib/player-generator/spiel-eignung-overrides.ts`, E3-Entscheidung) als Zielgröße.
- rho in EINEM Spiel bleibt die Abnahme (Ziel über 0,80). Jede Mechanikidee nennt unten, ob sie
  neue `rr()`-Würfe einführt (RNG-Kaskade, das Muster, an dem Zoneneintritt und Puste-Wirkung
  gescheitert sind) oder nur Schwellen/Buchhaltung verschiebt.
- Pp-Abweichung ≤ 25 in zwei Saatstämmen ist Pflicht — und sie bestraft **beide** Richtungen. Ein
  Attribut, das heute 0 % trägt, darf über eine neue Idee nicht auf das Doppelte seines
  Matrixgewichts springen.
- „Mehrere Wege zum Erfolg" (Primärweg/Nebenweg, I-Spy-Muster vom 21.09.) wird bei jeder Idee
  mitgedacht und steht als eigene Zeile dabei.

**Klassen:** **A** = reine Anzeige/Präsentation, rho bit-identisch per Konstruktion. **W** =
Wertformel/Buchhaltung (wie Hockey-K3: kein neuer Wurf, keine Bewegung, aber rho-relevant, also
Messpflicht). **B** = echte Mechanikänderung, braucht Chris' Zustimmung und volle Abnahme.

---

## 1. Rückblick: was existiert, was entschieden ist, was schon vorgeschlagen wurde

### 1.1 Stand der Zahlen (26.09., kaderfest)

| | rho je Spiel | rho Saison | Pp | Live im Spielstand | Abnahme |
|---|---:|---:|---:|---|---|
| Basketball | 0,769 | 0,923 | 33,4 | ja (`ARENA_RESOLVED_DISCIPLINE_IDS`) | knapp; G1\* scheitert an Validität (Star Rang 1 nur 43 %) |
| Football | 0,818 | 0,874 | 47,3–58,8 | nein | bestanden; sechs Attribute mechanisch bei 0 % |
| Hockey (Feldspieler) | 0,725 | 0,836 | 39,4 (n=6) | ja | knapp; von Chris für den Live-Betrieb abgenommen |

Die Pp-Verletzungen sind bekannt und laufen als eigene Kalibrierungsaufgaben — **nicht Gegenstand
hier**. Wo eine Idee unten ein Attribut an einen Kanal bindet, sage ich das, weil es für die
spätere Pp-Runde relevant ist, nicht als Diagnose.

### 1.2 Was in den drei Disziplinen schon liegt — und hier NICHT wiederholt wird

**Basketball.** Live-Motor mit Manndeckung, Hilfe, Doppeln/Kick-out, vier Wurfdistanzen,
Rebound-Zweikampf, Fastbreak, Freiwürfe, Schussuhr, Viertel mit Pause und Buzzer, Fokus-Doppeln
(Bedienung + KI-Vorgabe), K3 (Feldkörbe halb als Erwartungswert), Rollen-Positionierung auf dem
Court (26.09.). Vorgeschlagen und offen (Opus 26.09.): **P1** Risiko an Entscheidungen binden,
Reach-in-Fouls, Teamfouls, Stopps als defensiver Wertkanal · **P2** Rollen werden Aufträge ·
**P3** Pick-and-Roll mit Drop/Switch/Blitz · **P4** Trainerkarte (Angriff, Verteidigung inkl.
Zone 3-3, Coverage, Bretter) · **P5** Spielstand-Logik (2-für-1, Foul up 3, Dreier bei −3) ·
**P6** Ringschutz vor dem Wurf · **P7** AUSDAUER über Hockeys `puste`. Dazu die
Primär-/Nebenweg-Tabelle in Abschnitt 3 dort (Kraft- gegen Finesse-Abschluss, Am-Mann gegen
Antizipation, Ausboxen gegen lange Abpraller). Aus der Fable-Recherche vom 03.09.: Steals und
Fouls auf NBA-Maß, Kontest stetig, Dreieranteil, Endspiel-Regeln.

**Hockey.** Live-Motor mit Torwart (PARADE, eigene PPS-Referenz), Bodycheck mit Strafe,
Überzahl/Unterzahl mit Uhr, Bully als TECHNIK-Duell, A1/A2, K3, Torwart-Konstanten nachgezogen,
**Puste sichtbar, aber gemessen NICHT wirksam** (drei Faktoren auf exakt 1, weil jede
Tempoverschiebung die `versucheSteal`-Kaskade verschiebt und rho um 0,04–0,05 kostet), **T1**
Torwart raus in der Endphase plus Führungs-Riegel (gebaut, 26.09.). Vorgeschlagen und offen (Opus
26.09.): **T0** Spielzustände sichtbar · **T2** Special Teams als eigener Zustand (1-3-1 gegen
Box, Klären statt Kontern) · **T3** Rollen werden Positionen (mit Primär-/Nebenweg je Slot) ·
**T4** Mannschaftstaktik (Forecheck 2-1-2, Riegeln 1-2-2, Schattendeckung) · **T5** Zonenbesitz
statt Schussuhr (Grundsatzfrage). Ausdrücklich verworfen: Linienwechsel (keine Bank), Momentum,
mehr Checks, Zoneneintritt als Wurf, Bully-Wertposten. Aus dem NHL-Review: H2 GSAx statt GSAA
für den Torwart, H4/H5 Messungen.

**Football.** Eigene Zustandsmaschine (Downs, Distanz, Line of Scrimmage, Serien, Punt, Field
Goal, Formationen je Down, Spielzugwahl nach Down/Distanz), Rezept C, football-eigene Lotterie
`fkLos` (κ 3,4), Slot-Fix, PRD zurückgenommen, Down-&-Distanz im HUD. Vorgeschlagen und offen
(Opus 26.09.): **P1** Uhr und Spielstand (Two-Minute, Uhr auslaufen, 4. Versuch nach Lage,
2-Punkte, Halbzeit beendet den Drive) · **P2** Spielplan Boden/Luft, Box als Mechanik,
Play-Action, awareness-Read · **P3** O-Line schützt statt QB, Rush und Deckung getrennt ·
**P4** Kicker/Punter/Returner an Attribute, Punt-Touchback, Onside · **P5** Big Plays · **P6**
Safety, Overtime, Kickoff zur zweiten Halbzeit. Dazu die vier Wege Boden/Luft/Front/Feld.

**Meine eigene Vorrunde (E1–E3, 10.09.):** G1\* als messbare Alternativ-Abnahme (Star-/Paartreue),
keine Hockey-„Runde 1" nach Football-Muster, Football-Anzeige folgt der Spiel-Eignung. Alles drei
umgesetzt bzw. entschieden; hier nicht neu aufgemacht.

### 1.3 Was alle drei Reviews gemeinsam sagen — und was daraus folgt

Alle drei kommen unabhängig voneinander zum selben Urteil: **Ereignis-Ebene gut, Mannschafts-Ebene
Gerüst, Manager-Ebene leer.** Und alle drei schlagen als Antwort eine **Taktik-Karte vor dem
Spiel** vor (Basketball P4, Hockey T4, Football P2 „Spielplan"). Das ist die wichtigste Beobachtung
dieses Rückblicks, und sie führt direkt zu Abschnitt 2.

---

## 2. Zwei Beobachtungen quer über alle drei

### 2.1 „Spiel des Tages": der Manager sieht sein eigenes Spiel nie — und jede Taktikschicht setzt voraus, dass er es tut

**Befund (aus `basketball-doppeln-taktik-pause-recherche-06-09.md` 1.4, bis heute nicht
adressiert):** Der echte Spieltag wird headless aufgelöst (`runArenaFixtures` →
`window.__arena.spieleFeldspiel(fd, saat)`), für alle Paarungen auf einmal, auch für das eigene
Team. Der „Battle Arena"-Tab ist eine freie Ansicht mit beliebigen Teams. **Was ein Manager dort
klickt oder einstellt, hat auf kein Ergebnis Einfluss, das zählt.** Alle Taktik-Vorschläge der drei
Reviews (P4/T4/P2) sind deshalb heute Vorschläge für ein Spiel, das niemand sieht — der Manager
stellt etwas ein, bekommt eine Tabelle und weiß nicht, ob seine Wahl irgendetwas getan hat. Bei
zwei Spielen je Disziplin und Saison ist das doppelt bitter: es gibt keine Gelegenheit zu lernen.

**Idee: Replay aus der Saat.** Der Motor ist deterministisch (dieselbe Saat, dieselben Kader,
dieselbe Aufstellung ergeben bit-identisch dasselbe Spiel — das ist die Grundlage jeder
kaderfesten Messung im Projekt). Wenn der Headless-Runner je Fixture Saat und Aufstellungen
persistiert, kann der Arena-Tab das **tatsächliche** Spiel des Nutzers nachspielen, Sekunde für
Sekunde identisch mit dem, was gebucht wurde. Kein Live-Watch-Modus mit Eingriff (der würde die
Headless-Auflösung sprengen), sondern eine **Aufzeichnung**, die man sich nach dem Spieltag ansieht
— wie eine TV-Wiederholung. Dazu ein automatischer „Drei Momente"-Kasten aus dem Ereignisprotokoll
(`logZug`/`feed` liefern das schon): der Führungswechsel, das entscheidende Tor, der Turnover.

- **Warum das die Voraussetzung für alles andere ist:** Eine Trainerkarte, deren Wirkung man sieht,
  ist Gameplay. Eine, deren Wirkung man nur in einer Tabelle vermutet, ist ein Formular.
- **Klasse A.** Keine Zeile Simulation, rho bit-identisch per Konstruktion (es ist wörtlich
  dieselbe Simulation).
- **Zu prüfen (nicht gelesen):** ob `arena-headless-runner.ts` die Saat je Fixture heute
  überhaupt ablegt; falls nicht, ist das die eine kleine Schreibstelle. Und ob die Aufstellung
  zum Zeitpunkt des Replays noch dieselbe ist (Verletzungen, Transfers nach dem Spieltag) — die
  Aufstellung muss mit der Saat eingefroren werden, nicht live neu gelesen.
- **Aufwand:** klein bis mittel (Persistenz + ein Einstieg im Arena-Tab „Spiel des Tages" + der
  Momente-Kasten). Deutlich billiger als jede einzelne Taktikmechanik, und die einzige Idee in
  diesem Dokument, die allen drei Disziplinen gleichzeitig hilft.

### 2.2 Eine Taktik-Karte, drei Optionssätze — nicht drei Taktik-Karten

Wenn P4 (Basketball), T4 (Hockey) und P2-Spielplan (Football) je für sich gebaut werden, entstehen
drei UIs, drei KI-Vorgabe-Funktionen und drei Messharnisse. Vorschlag: **einmal** im
Feldspiel-Chassis bauen, als Feld an `FELDSPIEL_ART.<disziplin>`:

```
taktik: {
  schalter: [ {id, label, stufen:[...], vorgabe:(kader)=>stufe} , ... ],
}
```

Die Disziplin liefert nur ihren Optionssatz (Basketball: Angriff/Verteidigung/Coverage/Bretter;
Hockey: Forecheck/Riegel/Schatten; Football: Boden/Ausgewogen/Luft plus 4th-Down-Aggressivität).
Die KI-Vorgabe folgt dem Muster `berechneFokusAuto` (rechnet aus dem Kader, würfelt nicht). Die
Sonde bekommt **einen** Parameter `--taktik=<id>:<stufe>` für alle drei. Chris sieht **eine**
Karte, die er in allen Feldspiel-Disziplinen wiedererkennt — dieselbe Sprachregelung, die das
Puste-Konzept für die Leiste unter den Füßen durchgesetzt hat („eine Leiste, drei Chassis").

- **Klasse:** Architektur, keine Mechanik für sich. Die Mechanik je Schalter bleibt der jeweilige
  Review-Vorschlag.
- **Warum es hierher gehört:** Es ist kein Gameplay, aber es entscheidet, ob die Gameplay-Ideen
  aus drei Reviews in einer Runde oder in drei ankommen.

---

## 3. Basketball

Basketball ist von den dreien am dichtesten beackert. Das Opus-Review deckt Risiko, Rollen,
Pick-and-Roll, Trainerkarte, Endspiel, Ringschutz und Ausdauer ab; die Primär-/Nebenweg-Tabelle
dort ist vollständig für Abschluss, Wurf, Verteidigung, Rebound und Spielmachen. **Ich habe zwei
Ideen, die dort fehlen, und beide zielen auf dieselbe Stelle:** die Pp-Sondierung sagt, spirit
(17,8 % gegen 22) und awareness (9,1 % gegen 14) sind untergewichtet, speed (20,1 % gegen 10) und
torment (12,1 % gegen 6) übergewichtet. Beide Ideen geben spirit/awareness/intelligence einen
Kanal, der **nicht** über Bewegung läuft.

### B1 — Gravity: der Schütze ohne Ball hat einen Wert

**Was echter Basketball hat und wir nicht:** Ein Schütze, den die Verteidigung respektiert, bindet
seinen Verteidiger an sich („Gravity"). Sein Verteidiger kann nicht helfen, ohne einen offenen
Dreier freizugeben. Der Nutzen des Schützen entsteht dadurch **auch in Ballbesitzen, in denen er
nicht wirft** — er öffnet den Drive für andere. Im Motor heute: der Verteidiger hängt bis 35 px
zum Korb ab („sag"), unabhängig davon, wen er deckt; die Hilfsentscheidung liest die eigene ABWEHR
und den Abstand, nicht **wen** der Helfer dafür freigibt (Opus 2.4). Ein 95er-Schütze zieht also
exakt so viel Aufmerksamkeit wie ein 30er.

**Zwei Stufen, bewusst getrennt:**

1. **Gravity-Assist als Buchhaltung (Klasse W).** Fällt ein Feldkorb, bekommt jeder Mitspieler,
   dessen Verteidiger im Moment des Wurfs *näher an ihm als an der Hilfe-Position* stand und der
   SCHUSS_FERN über einer Schwelle hat, eine kleine Gutschrift („Screen-Assist" heißt das
   Gegenstück im NBA-Tracking, für Screens; für Spacing gibt es keinen offiziellen Namen — ich
   nenne es Gravity-Assist). Kein neuer Wurf, keine Bewegung, dieselbe Bauform wie K3: eine Zahl,
   die der Motor im Wurfmoment ohnehin kennt (Deckerabstände aller Spieler), wird gebucht.
2. **Gravity als Mechanik (Klasse B).** Der Sag eines Verteidigers wird eine Funktion des
   SCHUSS_FERN seines Mannes (hoher Wert: null Sag, klebt außen; niedriger Wert: voller Sag,
   verstopft die Zone), und die Hilfsentscheidung schließt „gebundene" Verteidiger aus. Damit
   entsteht der Effekt, den P6 (Ringschutz) und P3 (Pick-and-Roll) brauchen, um überhaupt Sinn zu
   haben: gegen ein Team ohne Schützen ist die Zone voll, gegen ein Team mit vier Schützen leer.

**Warum es zu Basketball passt:** Es ist der Grundsatz, auf dem der moderne Basketball aufbaut
(„Spacing"), und das Opus-Review nennt ihn in der Referenz (1.2), ohne ihn in einen Vorschlag zu
übersetzen — P2 macht „Perimeter" zum Spacer, sagt aber nicht, was Spacing mechanisch tut.

**Attribute/Rezept:** SCHUSS_FERN = intelligence 50 / awareness 22 / spirit 16 / dexterity 12 —
exakt die drei untergewichteten Attribute. Gravity gibt ihnen einen Kanal, der **nicht** vom
Wurfvolumen abhängt (heute trägt intelligence nur, wenn der Schütze auch wirft; 12 % Abfangquote
je Pass sorgt dafür, dass er den Ball oft gar nicht bekommt).

**Mehrwege:** Der Primärweg des Schützen bleibt der Wurf. Gravity ist sein Nebenweg: derselbe
Spieler trägt auch dann bei, wenn ihn die Verteidigung wegnimmt — was im Motor heute gerade das
Fokus-Doppeln tut (gemessen: −20 % Punkte, −22 % Würfe für den Fokussierten). Mit Gravity kostet
das Doppeln den Verteidiger etwas, statt umsonst zu sein.

**rho/Pp:** Stufe 1 ist K3-Klasse (kein Wurf, keine Bewegung) — messbar in einem Nachmittag mit
`miss-alle-disziplinen.mjs 24 basketball` und `messe-arena-einfluss.mjs basketball 48`. Stufe 2
verschiebt Positionen und damit `versucheSteal`-Zählungen (mittleres Risiko, wie jede
Positionsänderung). Reihenfolge: erst Stufe 1 messen; wenn intelligence/awareness in der
Einflussmessung steigen und rho hält, ist Stufe 2 begründet. **Aufwand:** Stufe 1 klein, Stufe 2
mittel.

### B2 — Der Freiwurf als Verlässlichkeitsanker (und „Hack-a-X" als Nebenweg der Verteidigung)

**Die Beobachtung, die CLAUDE.md nahelegt:** Basketball hat Validität 0,923 und Verlässlichkeit
0,69 — „belohnt das Richtige, aber zu laut". Mehr Uhr hilft nicht. Was helfen kann, sind
**Ereignisse mit höherem Eignungsanteil bei gleicher Uhr.** Der Freiwurf ist genau das: ein
Wurf ohne Verteidiger, ohne Distanzwahl, ohne Pass davor, in dem allein die Technik des Werfers
zählt. Nach allgemeinem Analytik-Konsens ist die Freiwurfquote die von Jahr zu Jahr stabilste
Einzelquote im Box-Score (hier nicht eigens belegt). In der NBA sind Freiwürfe rund ein Sechstel
aller Punkte (≈ 22 Versuche je Team, ≈ 78 %). Bei uns fallen 1,9 Fouls je Spiel, Freiwürfe sind
praktisch nicht vorhanden.

**Idee:** Wenn P1 (Foul-System) kommt — und es sollte kommen —, dann nicht als Nebenprodukt,
sondern mit einer **eigenen Freiwurf-Formel**, die bewusst rauscharm ist: Trefferchance aus
spirit (Nervenstärke) + dexterity + intelligence, enge Spreizung (≈ 55–92 %), **kein**
Kontest-, Distanz- oder Fastbreak-Term. Damit werden ≈ 20 Freiwürfe je Spiel zu ≈ 20
hochverlässlichen Skill-Tests, die heute schlicht nicht stattfinden. Ich habe die bestehende
Freiwurf-Auflösung (`starteFreiwuerfe`, `undEins`) **nicht** gelesen — welche Sub-Skills sie
heute liest, ist zu prüfen; wenn sie die normale Wurfformel wiederverwendet, ist das der erste
Umbau.

**Der Nebenweg für die Verteidigung: Hack-a-X.** Gegen einen dominanten Innenspieler mit
schwachem spirit (der klassische „Shaq"-Fall) foult die Verteidigung absichtlich und schickt ihn
an die Linie — ein echtes NBA-Gegenmittel, das im Spielstand-Kontext (P5, zurückliegend spät)
oder als Trainerkarten-Stufe („Foul den Schwächsten") gewählt wird. Das gibt dem Verteidiger
ohne torment/speed einen Weg, den besten Gegner zu neutralisieren: nicht über den Griff (Steal),
sondern über die Regel. Und es erzeugt den Zielkonflikt, den Chris beim Gewichtheben so mochte:
ein Center mit power 90 und spirit 30 ist am Ring unaufhaltbar **und** von der Linie eine Last.

**Attribute/Rezept:** spirit ist Basketballs schwerstes Matrixattribut (22) und untergewichtet.
Ein Freiwurf-Kanal mit spirit-Führung ist der direkteste Weg, das zu beheben, ohne an
SCHUSS_NAH/SCHUSS_FERN zu drehen. **Achtung Pp-Gegenrichtung:** spirit sitzt auch in SCHUSS_NAH
(30) und ABSCHLUSS (22); die Freiwurf-Formel darf spirit nicht über 22 treiben. Kalibrierung
gehört in die P1-Runde, nicht daneben.

**rho:** Freiwürfe sind Würfe ohne Bewegung; jeder ist ein `rr()`-Wurf, aber er ersetzt keinen
anderen und verschiebt keine Position — die Kaskade ist die des Foul-Systems (P1), nicht der
Freiwurf-Formel. Erwartung: Verlässlichkeit steigt (mehr eignungsgebundene Ereignisse), Validität
bleibt oder steigt (spirit trägt). Das ist die eine Stelle, an der ich für Basketball eine
Bewegung *nach oben* für plausibel halte. **Klasse B** (Teil von P1), Hack-a-X **B** (Teil von P4/P5).
**Aufwand:** klein, wenn P1 ohnehin gebaut wird.

### B3 — Charge: Verteidigung mit dem Körper statt mit der Hand (kleine Ergänzung zu P1)

P1 hat Reach-in, Wurffoul und Blockfoul. Was fehlt, ist das **Offensivfoul**: Ein Verteidiger,
der *vor* dem Drive seine Position hat, nimmt den Kontakt und bekommt den Ballbesitz — kein
Griff, kein Steal-Würfel, sondern Positionierung (awareness/intelligence) gegen den Drive
(power/spirit). Das ist der Nebenweg für den Verteidiger ohne torment/speed, den Opus' Tabelle als
„Antizipation" benennt, aber nur über Hilfe und Abfangen füllt. Ein Charge ist ein **Stopp mit
Ballgewinn**, gebucht wie ein Steal, aber aus einem anderen Attribut. Deterministisch entscheidbar
(stand der Verteidiger vor dem Antritt in der Bahn?), der Wurf ist der ohnehin fällige
Foul-Würfel des Drives. **Klasse B**, Teil von P1, **Aufwand** klein. Kein eigenes Paket — nur
damit P1 beim Bau daran denkt, dass Fouls zwei Richtungen haben.

### Wo Basketball aus meiner Sicht rund ist

Wurfauflösung, Kontest als Paarung, Rebound, Fastbreak-Struktur, Assist-Fenster, Viertel, Pause,
Fokus-Doppeln, Rollenpositionierung: hier braucht es nichts Neues, nur die Taktikschicht darüber
(P1–P7). Ideen, die ich geprüft und **nicht** aufgeschrieben habe: Hot-Hand (statistisch
schwach, Opus warnt zu Recht vor einem Clutch-Rating), Bank/Rotation (keine Bank, projektweit),
Größe im Kontest (steht in der 03.09.-Recherche 4.3), Zone (P4), Timeout als Ressource (im
Headless-Modus unsichtbar, s. 2.1).

---

## 4. Football

Football hat den größten Raum, weil sein Inneres (der Snap) am dünnsten ist — das Opus-Review
sagt das klar. P1–P6 dort sind der richtige Weg. **Meine vier Ideen liegen daneben:** eine
Buchhaltung (die Football-Fassung von K3), ein Kanal, den nur Football gefahrlos haben kann, ein
Zustand, der einen Slot ehrlich macht, und eine Formatfrage, die Chris gehört.

### F1 — EPA statt Yards: die Football-Fassung von K3 (Klasse W)

**Was die echte Analytik macht:** Seit gut fünfzehn Jahren bewertet die NFL-Analytik keinen
Spielzug nach Yards, sondern nach **Expected Points Added**: Jeder Spielzustand (Down, Distanz,
Feldposition) hat einen Erwartungswert in Punkten; der Wert eines Spielzugs ist die Differenz
nachher minus vorher. Ein 5-Yard-Lauf bei 3rd & 4 ist ein Gewinn (First Down, Serie lebt), derselbe
Lauf bei 3rd & 12 ein Verlust (Punt). Eine Interception an der eigenen 20 kostet weit mehr als
eine an der gegnerischen 30. Yards sagen darüber nichts.

**Was der Motor heute bucht:** `feldspielWert()` fasst im Fantasy-Schema zusammen — Yards, Punkte,
Turnover, Tackles, Sacks. Yards sind dort Yards, egal wann. Der 3rd-Down-Wendepunkt, den der
Opus-Plan 6.3 als **sichtbar** machen wollte, ist in der Wertformel unsichtbar.

**Idee:** Eine EP-Tabelle je (Down, Distanzklasse, Spot-Zehner), **aus dem eigenen Motor gezogen**
(200 Spiele über `miss-football-korridor.mjs`, mittlere Folgepunkte je Zustand — dieselbe
Ehrlichkeit, mit der `skillMittel` als gemessener Mittelwert gezogen wurde, nicht aus einer
NFL-Tabelle übernommen, die zu unserem Korridor nicht passt). Dann bucht jeder Snap
`EP(nachher) − EP(vorher)` auf die gezogenen Akteure: Passer und Receiver teilen sich die
Offense-EPA (Vorschlag: nach dem Verhältnis, das heute Yards teilt), der Läufer bekommt sie ganz,
Tackler/Rusher/Interceptor bekommen die negative Offense-EPA als Defensiv-Kredit. Ein Punt bucht
Feldpositions-EPA auf den Punter — damit entsteht der Punter-Kredit aus P4 **von selbst**, ohne
eigenen Posten.

**Warum es zu Football passt:** Football ist die einzige der drei Disziplinen, deren Spielzustand
diskret und vollständig beschreibbar ist (Down/Distanz/Spot). Für Basketball gäbe es das Analogon
(Punkte je Ballbesitz), aber ohne die Zustandsvielfalt; für Hockey gar nicht. EPA ist die
Football-eigene Antwort auf „wer hat wirklich beigetragen".

**Attribute/Rezept:** keine neuen. Es ändert, **welche** Ereignisse wie viel zählen, nicht wer sie
erzeugt. Erwartung für Pp: PASSGENAUIGKEIT/LAUFKRAFT verlieren etwas Gewicht an Situationswert
(3rd-Down-Konversion, Turnover-Kosten) — ob das die sechs 0-%-Attribute berührt, sagt nur die
Messung; vermutlich kaum, weil Situationsspiel (P1) und Read (P2) die Kanäle dafür sind.

**Mehrwege:** indirekt, aber wichtig — EPA belohnt den Boden-Weg (Serien am Leben halten, Uhr) und
den Luft-Weg (Explosivspielzüge) **unterschiedlich richtig**, statt beide über Yards gleich zu
machen. Ohne EPA gewinnt P2 seinen zweiten Weg nur im Korridor, nicht im Spielerwert.

**rho:** K3-Klasse — kein Wurf, keine Bewegung, reine Bilanz. Hockeys K3 brachte +0,07 (Feldspieler),
Basketballs +0,015. Ich verspreche nichts, aber es ist die billigste rho-relevante Idee dieses
Dokuments, und sie ist in einem Tag messbar. Nachziehen: PPS-Referenz und Basislinie. **Aufwand:**
klein (Tabelle ziehen, Buchung an fünf Stellen in `vollziehFootballErgebnis`), Messpflicht wie
bei K3 (n=24 und n=48).

### F2 — Puste ist in Football gefahrlos wirksam: Tempo-Offense als dritter Spielplan (Klasse B)

**Die Beobachtung:** Hockeys Puste ist sichtbar, aber nicht wirksam, weil jede Tempoänderung
Positionen verschiebt und damit die Zahl der `versucheSteal`-Aufrufe — RNG-Kaskade, rho −0,04
(`hockey-puste-kalibrierung-13-09.md` 4.2). Basketball hätte dasselbe Problem (P7 erbt es).
**Football hat es nicht.** Footballs Ergebnisse entstehen in `resolveLauf`/`resolvePass` aus
Sub-Skill-Werten der gelosten Akteure; die Bewegung der zwölf Figuren ist laut Code „rein optisch"
(`fkEngageZiel`). Ein Puste-Faktor auf die **effektiven** Sub-Skill-Werte je Snap (ABWEHR_LAUF ×
pusteFaktor des Run-Stoppers, PASSSCHUTZ × pusteFaktor, …) ändert keine einzige Position und
keinen einzigen Wurf-Zeitpunkt — nur Schwellen. Das ist genau die Bauform, die das Puste-Dokument
selbst als Bedingung für eine Wirkung nennt („nur auf Kanäle, die keine Positionen verschieben").

**Was das ermöglicht — „Tempo" als dritter Spielplan neben Boden und Luft (P2):** No-Huddle über
das ganze Spiel, nicht nur im Two-Minute-Drill (P1). Wirkung: die Verteidigung zehrt schneller
(kürzere Erholung zwischen den Snaps), eigene Angreifer auch — wer mehr AUSDAUER hat, hält es
länger. Kosten: leicht höheres Turnover-Risiko (weniger Formationsphase = schlechterer Read,
koppelt an P2). Real: Chip Kellys Eagles, die Bills unter Daboll — ein echter, umstrittener
Football-Weg, den man wählen kann, ohne einen besseren Kader zu haben.

**Und die zweite Wirkung, die niemand wählen muss:** Ein langer Drive (12 Spielzüge) ermüdet die
Verteidigung *innerhalb* der Serie — die Box wird im vierten Quarter weicher, wenn die eigene
Offense den Ball gehalten hat. Das ist der echte Uhrwert des Boden-Wegs, den P1 über die Uhr und
P2 über die Box baut; die Puste macht ihn spürbar, nicht nur rechnerisch.

**Attribute/Rezept:** AUSDAUER = stamina 67 / will 33, heute **0 % mechanisch** (Opus-Plan 6.4,
seit dem 10.09. bekannt). Override-Gewicht stamina 6, will 3 — klein. Die Puste darf also nur
einen kleinen Kanal aufmachen (Ziel: AUSDAUER liest 5–9 %, nicht 20). Ein Puste-Rezept in
`FELDSPIEL_ART.football` nach Hockeys Vorbild (`puste:{…}`), Zehr **je Snap** statt je Pixel
(genau die Entkopplung von LAUFTEMPO, die das Puste-Dokument als Schritt 1 fordert).

**Mehrwege:** Tempo ist ein Weg für ein Team mit tiefem, ausdauerndem Kader gegen ein Team mit
zwei Stars und dünner Bank — auf Team-Ebene das, was Primär/Nebenweg auf Spieler-Ebene ist.

**rho:** Kein neuer Wurf, keine Bewegung. Schwellenverschiebung wie eine κ-Änderung, also messbar
mit derselben Sonde. Risiko gering bis mittel; die Gefahr ist nicht Kaskade, sondern dass ein
Spielplan „Tempo" in KI-gegen-KI-Spielen asymmetrisch gewählt wird und die Sonde das als
Kaderrauschen liest — die Vorgabe muss symmetrisch aus dem Kader kommen (2.2). **Aufwand:**
mittel (Puste-Block portieren, Snap-Zehr, Spielplan-Stufe), am besten in derselben Runde wie P2.

### F3 — Die Red Zone als eigener Zustand: der Slot „Red Zone" wird ehrlich (Klasse B, klein)

**Real:** Innerhalb der gegnerischen 20 ändert sich Football strukturell — das Feld ist zu kurz für
tiefe Pässe, die Verteidigung steht kompakt, der Laufanteil steigt, und der Pass wird zum
**Jump Ball** an einen großen Receiver („Fade"), nicht zum Sprint eines schnellen. Red-Zone-Effizienz
ist in jeder NFL-Statistik eine eigene Spalte.

**Motor heute:** `waehleFootballTier` und `waehlePlayCall` lesen Down/Distanz, nicht die Zone (ob
der Spot die Tiefe klemmt, habe ich nicht geprüft). Der Receiver wird immer über TEAMGEIST gelost
(health 45 / torment 30 / speed 25 — laut Rezeptkommentar bewusst „der große, zähe Zielspieler").
Der Slot „Red Zone" (`matchday-slot-roles.ts`) verspricht „bekommt den Ball an der Goal Line" und
tut mechanisch nichts als einen Attributaufschlag (Opus-Review 0.3, Frage 7.3).

**Idee:** Ein Zustand `fb.redZone = spot <= 20` mit drei Folgen: (1) Tier „tief" fällt weg, „kurz"
gewinnt; (2) Laufanteil +0,10; (3) die Receiver-Lotterie liest **innerhalb** der 20 TEAMGEIST wie
heute, **außerhalb** aber eine Mischung aus TEAMGEIST und LAUFTEMPO (speed 52) — der schnelle
Receiver bekommt sein Feld, der große seine Zone. Der Slot „Red Zone" bekommt seinen Aufschlag
**nur** in der Lotterie innerhalb der 20; dann hält sein Text, was er verspricht.

**Mehrwege:** Zwei Receiver-Typen, zwei Zonen — der große, langsame Receiver (health/torment) ist
außerhalb der 20 Nebenweg und innerhalb Primärweg; der schnelle umgekehrt. Kein neuer Sub-Skill
(Chris' Vorbehalt gegen erfundene Sub-Skills ist dokumentiert), nur zwei bestehende neu gemischt.

**Attribute/Rezept:** gibt speed (Override 14, heute nur über LAUFKRAFT 26 und den winzigen
YAC-Term) einen Receiving-Kanal, ohne P5 (Big Plays) vorwegzunehmen. **rho:** Lotteriegewichte
ändern sich zustandsabhängig, kein neuer Wurf — mittel-gering. **Aufwand:** klein.

### F4 — Die Formatfrage, die Chris gehört: NFL im Kleinformat oder Arena Football?

Das ist keine Empfehlung, sondern eine Wendung, die noch nirgends im Repo steht — und die
Auftragsfrage nach „Formaten aus echten Sportarten, die noch nicht aufgegriffen wurden" trifft sie
direkt. Unser Football ist **sechs gegen sechs** auf 100 Yards mit vier Vierteln zu 70 Sekunden.
Das ist näher an der **Arena Football League** (acht gegen acht, 50 Yards, Ironman — dieselben
Spieler in Offense und Defense, was bei uns über die Lotterie ohnehin gilt) als an der NFL. Zwei
AFL-Regeln würden zwei bekannte Motorprobleme beseitigen: **kein Punt** (die Punt-Konstante und
das Feldpositions-Problem aus P4.2 verschwinden; jeder vierte Versuch ist ein Go) und
**Rebound-Netze hinter der Endzone** (Kickoffs bleiben im Spiel — Kickoff-Returns, die P4.4 als
neue Zustandsmaschine bauen müsste, wären dann der Normalfall). Der Preis: der „Feld"-Weg aus dem
Opus-Review (Punter, Feldposition) gäbe es nicht, alle NFL-Korridore (Punts je Team, Sack-Quote)
müssten gegen AFL-Werte neu gezogen werden, und Chris' mentales Modell ist erkennbar NFL.

**Mein Rat:** beim NFL-Modell bleiben — die Korridore, die Rezepte und vier Runden Kalibrierung
sind NFL, und sechs gegen sechs ist ein Chassis-Merkmal, keine Sportart. Aber die Frage einmal
ausdrücklich stellen, damit sie nicht in zwei Monaten als „warum puntet man in einem
6-gegen-6-Spiel" wiederkommt. **Klasse:** Produktentscheidung, kein PR.

### Wo Football aus meiner Sicht rund ist

Die Zustandsmaschine (Downs, Serie, Spot), die Spielzugwahl nach Down/Distanz, die Kalibrierung
gegen NFL-Quoten, die Lotterie mit κ. Geprüft und **nicht** aufgeschrieben: Strafen (jeder
Pre-Snap-Wurf ist ein neuer `rr()` je Snap — die Kaskadenlehre gilt auch für snap-diskrete
Motoren, weil jeder spätere Wurf wandert; wenn, dann deterministisch aus TECHNIK-artigen Werten,
und das ist ein eigenes Konzept), Wetter (kein Realismusgewinn ohne Bild), Timeouts (headless
unsichtbar, s. 2.1), Depth Chart (gemessen schlechter, 0,167 gegen 0,277 — Opus P3.3 hat den
richtigen Ersatz).

---

## 5. Hockey

Hockey ist die Disziplin, zu der mir **am wenigsten Neues** eingefallen ist — und das ist ein
ehrlicher Befund, kein Versäumnis. T0–T5 decken die Mannschaftsebene ab, die Puste-Runde hat
gemessen gezeigt, wo die Grenze der Bewegungsmechanik liegt, Chris hat die Rangtreue für den
Live-Betrieb abgenommen, und die Liste der verworfenen Ideen (Linienwechsel, Momentum, mehr
Checks, Bully-Posten, Zoneneintritt) ist lang und gut begründet. Was bleibt, liegt am Rand: ein
Format, ein Zielkonflikt, ein Torwart-Kanal.

### H-A — Verlängerung 3 gegen 3 und Penaltyschießen (Klasse B, isoliert)

**Das Format, das noch nirgends aufgegriffen ist:** Die NHL spielt seit 2015 bei Gleichstand fünf
Minuten **3 gegen 3** (Sudden Death), danach Penaltyschießen. Der Rollout-Plan (F.3) hat
Unentschieden bewusst zugelassen (damals 18,8 % der Spiele) und eine Verlängerung als „eigenen
kleinen Auftrag nach PR 6" markiert — seitdem nicht wieder aufgegriffen. Bei zwei Hockey-Spielen
je Saison endet statistisch jedes fünfte Spiel remis; das ist viel für ein Turnier mit Tabelle.

**Warum ausgerechnet 3 gegen 3 zu unserem Motor passt:** Wir haben keine Bank, aber wir haben
fünf Feldspieler — die Verlängerung nimmt je Seite **drei** davon (Manager-Wahl oder Vorgabe:
die drei mit dem höchsten LAUFTEMPO+ABSCHLUSS). Auf einmal ist das Eis leer: keine Hilfe, kein
Bandengedränge, jeder Puckgewinn ein Konter. Das ist die Situation, in der **speed** (Matrix 12)
und der „Transition Runner" (T3) dominieren — real ist 3-gegen-3 der Grund, warum schnelle
Stürmer in der NHL einen eigenen Marktwert haben. Und es ist das Gegenbild zum Riegel aus T1:
Führung riegelt, Gleichstand öffnet.

**Penaltyschießen** danach: drei Runden ABSCHLUSS gegen PARADE, reine Duelle, keine Bewegung. Der
Slot Finisher und der Torwart bekommen eine Bühne, die es im Spiel selbst nicht gibt.

**Wertung, und warum das rho-seitig sauber ist:** NHL-Regel — Verlängerungstore zählen im
Box-Score, **Penaltyschießen-Tore nicht** (nur das Team-Ergebnis). Übernehmen wir das wörtlich,
verschiebt das Penaltyschießen die Rangtreue-Sonde um null, und die Verlängerung nur in den ~19 %
der Spiele, die sie erreichen — dort mit Ereignissen, die stärker an speed/ABSCHLUSS hängen als
der Durchschnitts-Besitz. Arena-Punktesystem: heute 2/1/0 mit Remis; NHL-Fassung wäre 2 für den
Sieg, 1 für die Niederlage nach Verlängerung/Penalty, 0 sonst — eine Zeile, aber Chris'
Entscheidung.

**Attribute/Rezept:** keine neuen. Verlängerung liest, was der Motor hat (LAUFTEMPO, ABSCHLUSS,
ABWEHR, PARADE). **Mehrwege:** der schnelle, schussschwache Spieler bekommt sein Fenster (3 gegen 3
belohnt speed, wo das 5-gegen-5 den Slot-Finisher belohnt). **rho:** Neue Würfe **nur** nach dem
regulären Spielende — die reguläre Zufallsbahn ist unberührt (dasselbe Argument, mit dem T1 als
„niedriges Risiko" eingestuft und gemessen bestätigt wurde: 0,669 → 0,686). Messpflicht trotzdem,
n=24 und n=48, plus Anteil Spiele mit Verlängerung und Penalty. **Aufwand:** mittel (ein
Spielzustand nach dem letzten Drittel, Feldstärke 3, Penalty-Standphase wie Freiwürfe im
Basketball; Bild und Ton kommen mit dem Broadcast-Apparat).

### H-B — Strafneigung als Zielkonflikt: der saubere und der rücksichtslose Checker (Klasse B, klein)

**Motor heute:** Ein sitzender Bodycheck wird mit `HK_FOUL_ANTEIL = 0,38` abgepfiffen — eine
**Konstante**, für jeden Spieler gleich. Der Rollout-Plan (B.5, Chris' Kandidatenliste) hat einen
eigenen „Disziplin"-Sub-Skill zu Recht abgelehnt und stattdessen festgehalten: „Die richtige
Bauform ist eine Strafwahrscheinlichkeit als Funktion von CHECK: wer härter checkt, erobert öfter
den Puck und kassiert öfter." Gebaut wurde das nie; die Strafquote hängt heute an nichts.

**Idee:** `p_strafe = HK_FOUL_ANTEIL × f(TECHNIK des Checkers)` — TECHNIK (awareness 46 /
determination 31 / dexterity 23) als „Timing des Checks": hoher Wert, sauberer Treffer, selten
abgepfiffen; niedriger Wert, Bandencheck. Kein neuer Wurf — der `rr()<HK_FOUL_ANTEIL`-Wurf
existiert, nur seine Schwelle wandert. Die Wucht (`ABWEHR − AUSDAUER`) bleibt, was sie ist.

**Warum es zu Hockey passt:** Es ist die eine Eishockey-Abwägung, die im Manager-Modus etwas
bedeutet: der Spieler mit hoher ABWEHR und niedriger TECHNIK ist ein Puckgewinner **und** eine
Strafbank-Garantie — und mit T2 (Special Teams als echter Zustand) kostet jede Strafe endlich
etwas. Heute ist Überzahl gemessen kaum ein Vorteil (Versuche/s 0,194 gegen 0,196, Opus 0.3);
sobald T2 das ändert, wird Disziplin zur Kaderfrage.

**Attribute/Rezept:** gibt awareness/determination/dexterity (Matrix 8/4/4, zusammen 16 Pp — die
kleinen Attribute, die in einem power/health-getriebenen Spiel leicht untergehen) einen
defensiven Kanal, der nicht über Bewegung läuft. **Mehrwege:** der technisch saubere Verteidiger
ist der Nebenweg zum wuchtigen — weniger Pucks, aber nie auf der Strafbank. **rho:** Schwellen-
statt Wurfänderung; Wertformel bucht dem Gecheckten einen Verlust, dem Bestraften nichts —
Verteilung der Strafen über die Spieler ändert sich, nicht ihre Zahl (Kalibrierung: mittlere
Strafquote bleibt 2,8 je Spiel, Korridor). **Aufwand:** klein; gehört in dieselbe Runde wie T2,
davor ist es folgenlos.

### H-C — Der Torwart als erster Passgeber: ein zweiter Kanal für die schwächste Rolle (Klasse B)

**Befund:** Die Rangtreue nach Rolle liegt für den Torwart bei 0,39 (`miss-rangtreue-nach-rolle.mjs`,
NHL-Review H2). Sein einziger Kanal ist PARADE; H2 (GSAx) verbessert die Bewertung desselben Kanals.
Ein **zweiter** Kanal fehlt.

**Was echte Torhüter tun:** Sie spielen den Puck. Der erste Pass nach der Parade oder nach dem
Dump-in entscheidet, ob der Aufbau gegen den Forecheck gelingt — und NHL-Torhüter bekommen dafür
Assists (Hextall, Brodeur, heute Hellebuyck als „third defenseman"). Der Motor hat den
Torwart-Klär-Zweig (T2 will ihn für die Unterzahl wiederverwenden) und die
Passqualitäts-Kette (`hockeyPassQualBonus`, A1/A2).

**Idee:** Der Klär-/Erstpass des Torwarts liest **TECHNIK des Torwarts** (statt eines
Festwerts) in derselben Passqualitäts-Kette wie jeder Feldspieler-Pass, und führt der Pass zum
Tor, bucht A1/A2 wie bei jedem anderen. Ein Torwart mit hohem awareness/dexterity startet Konter,
einer mit niedrigem schlägt den Puck an die Bande.

**Attribute/Rezept:** PARADE = health 45 / awareness 30 / dexterity 15 / will 10; TECHNIK =
awareness 46 / determination 31 / dexterity 23 — konsistent, keine neue Mischung nötig.
**Mehrwege:** der Torwart mit mittlerer Parade, aber gutem Auge, hat einen Nebenweg. **rho:** Hier
bin ich vorsichtig — der Zielspieler des Torwartpasses bestimmt, wer den Puck trägt, also
Positionen; wenn die Zielwahl heute schon über die Kette läuft und nur die Qualität sich ändert,
ist es eine Schwellenänderung; wenn die Zielwahl neu ist, ist es Kaskade. Das habe ich am Code
nicht geprüft. Erwartung: hebt die Zwölferzahl, nicht die Feldspielerzahl (wie H2). **Aufwand:**
klein bis mittel, in derselben Runde wie H2 sinnvoll.

### H-D — Optional, reiner Geschmack: die Rauferei (Klasse A+, Chris' Entscheidung)

Das eine NHL-Element, das kein Dokument je erwähnt: nach einem harten Check kommt es zur Rauferei,
beide bekommen fünf Minuten, es wird **4 gegen 4** (mehr Eis, wieder speed). Als **Präsentation**
(nach einem sitzenden Check mit Strafe: kurze Rauferei-Szene, beide auf die Bank) ist das
Klasse A und ein Zuschauer-Moment, den Eishockey-Fans erwarten; als Mechanik (4 gegen 4 für 5
Minuten) ist es T2 mit anderem Vorzeichen und ein eigener Zustand. Ich schlage nur die
Präsentation vor und lege die Mechanik als Frage hin — wenn Chris Breaking als Folter will, will
er vielleicht auch das.

### Wo Hockey aus meiner Sicht rund ist

Ereignisebene (Schuss nach Zone mit NHL-Quoten, Torwart im Winkel, Abpraller, Bully, Check,
Bandenduell), Wertformel nach K3, Torwart-Referenz, T1. Geprüft und **nicht** aufgeschrieben:
Torwart-Ermüdung über die Puste (wäre der eine Puste-Kanal ohne Positionsverschiebung, aber
verschiebt Save/Tor-Verzweigungen — dieselbe Bauform wie das Puste-Dokument 4.3 Schritt 2, dort
besser aufgehoben), Bully als Aufstellungsrolle (28 Bullys je Spiel wären ein verlässlicher Kanal,
aber die Literatur gibt ihm 0,013 Tore je Gewinn — Opus hat das zu Recht gestrichen), Icing/Abseits
(T5), Linienwechsel (keine Bank).

---

## 6. Die drei stärksten Ideen über alle drei Disziplinen

1. **F1 — EPA statt Yards (Football, Klasse W).** Die billigste rho-relevante Idee im Dokument,
   dieselbe Bauform wie Hockeys K3 (+0,07), in einem Tag messbar, macht den 3rd-Down-Wendepunkt
   und die Turnover-Kosten zum ersten Mal im Spielerwert sichtbar und erzeugt den Punter-Kredit
   nebenbei. Kein Wurf, keine Bewegung, keine Matrixberührung.
2. **2.1 — Replay aus der Saat (alle drei, Klasse A).** Kein Gameplay im engen Sinn, aber die
   Voraussetzung dafür, dass irgendeine Taktik-Karte aus P4/T4/P2 je als Gameplay erlebt wird.
   Solange der Manager sein eigenes Spiel nicht sieht, ist jede Entscheidung vor dem Spiel ein
   Formular. Bit-identisch per Konstruktion.
3. **B2 — Freiwurf als Verlässlichkeitsanker plus Hack-a-X (Basketball, Klasse B als Teil von P1).**
   Die eine Stelle, an der ich für Basketball eine Bewegung nach oben für plausibel halte:
   ≈ 20 eignungsgebundene, bewegungsfreie Skill-Tests je Spiel bei unveränderter Uhr, spirit-geführt
   (Basketballs schwerstes und untergewichtetes Attribut), mit einem Zielkonflikt für den
   dominanten Center und einem Regel-Nebenweg für die Verteidigung.

Dahinter: **F2** (Puste in Football ohne Kaskade — der einzige Feldspiel-Motor, in dem die Puste
wirken darf) und **H-A** (Verlängerung 3 gegen 3, das eine NHL-Format, das noch niemand
aufgegriffen hat).

---

## 7. Was ich bewusst nicht vorschlage

- **Keine Matrixänderung, kein neuer Sub-Skill.** Beides gesperrt bzw. von Chris abgelehnt.
- **Kein neuer hochfrequenter Wurf im Tick-Loop** (Zoneneintritt-Lehre). Jede Mechanikidee oben
  verschiebt Schwellen, bucht anders oder greift nach dem regulären Spielende.
- **Keine längere Uhr.** Alle drei Reviews und CLAUDE.md sind sich einig.
- **Keine Hot-Hand-, Momentum- oder Clutch-Eigenschaft.** Statistisch schwach, und „reich wird
  reicher" ist der Fehler, vor dem das Climbing-Flow-Review gewarnt hat.
- **Keine Bank.** Rotation, Foul-Out mit Ersatz, Linienwechsel — alles Kaderfragen fürs ganze
  Spiel, nicht für eine Disziplin.
- **Keine Live-Eingriffe während des Spiels.** Der Spieltag ist headless; alles, was ein Manager
  entscheidet, entscheidet er vorher (2.2), und was er sieht, sieht er nachher (2.1).

---

## 8. Fragen an Chris

1. **Replay (2.1):** Soll der Manager sein eigenes Spiel nach dem Spieltag ansehen können —
   als Aufzeichnung, ohne Eingriff? Wenn nein, sind die Taktik-Karten aus allen drei Reviews
   Formulare, und man sollte sie entsprechend klein halten.
2. **Eine Taktik-Karte für alle Feldspiele (2.2):** einverstanden, dass Basketball P4, Hockey T4
   und Football P2 auf einer gemeinsamen Infrastruktur laufen, statt dreimal gebaut zu werden?
3. **Freiwürfe (B2):** Wenn das Foul-System kommt — sollen Freiwürfe eine eigene, rauscharme,
   spirit-geführte Formel bekommen, und ist Hack-a-X als KI- und Manager-Option gewünscht (real
   umstritten, weil zäh anzusehen)?
4. **EPA (F1):** Darf die Football-Wertformel auf Erwartungspunkte umgestellt werden — die
   Boxscore-Spalte „Yards" bleibt, aber der Spielerwert rechnet EPA? Das ändert, wer in der
   Football-Linse oben steht.
5. **Tempo-Offense (F2):** Ein dritter Spielplan neben Boden und Luft, der Puste kostet und
   Puste nimmt — gewünscht, oder reicht Two-Minute aus P1?
6. **Formatfrage Football (F4):** NFL im Kleinformat (mein Rat) oder Arena-Football-Regeln (kein
   Punt, Rebound-Netze)? Einmal entscheiden, damit die Frage nicht wiederkommt.
7. **Verlängerung Hockey (H-A):** 3 gegen 3 plus Penaltyschießen statt Remis? Und
   NHL-Punktesystem (2/1/0 mit dem Punkt für die Niederlage nach Verlängerung) oder das heutige
   2/1/0 mit Remis?
8. **Rauferei (H-D):** nur als Szene, als Mechanik (4 gegen 4), oder gar nicht?

---

## 9. Grenzen dieses Dokuments

- **Nichts gemessen, nichts gebaut.** Alle Risikoeinschätzungen sind aus den gemessenen
  Präzedenzfällen abgeleitet (K3, T1, Puste, Zoneneintritt, Fokus-Doppeln), nicht aus eigenen
  Sonden.
- **Codestellen** sind aus den zitierten Dokumenten übernommen (Funktionsnamen, nicht
  Zeilennummern, weil die seit dem 26.09. durch die Broadcast-Runden gewandert sind). Nicht selbst
  am Code geprüft: die Freiwurf-Auflösung (B2), ob der Spot die Tiefenstufe klemmt (F3), ob der
  Headless-Runner die Saat je Fixture persistiert (2.1), ob die Torwart-Klärung heute schon über
  die Passqualitäts-Kette läuft (H-C).
- **Die Pp-Verletzungen** aller drei Disziplinen sind bekannt und laufen separat; wo eine Idee
  einen Kanal aufmacht, ist das als Hinweis für diese Runden gedacht, nicht als deren Ersatz.
- **Chris' In-Game-Meldungen** (`bug-reports`, letzte vom 25.08.) enthalten zu diesen drei
  Disziplinen nichts Gameplay-Bezogenes, das hier fehlen würde — die beiden Arena-Meldungen
  (Ton, Rollenprofile in der Einsatzliste) sind Feature-Lücken, keine Mechanikwünsche.
