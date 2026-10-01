# Fable-Ideen: TDM, Mini-DM, Battlefield, I-Spy — offenes Gameplay-Brainstorming (30.09.)

Chris wollte, dass ich als Zweitkanal neben Opus „frisch" auf meine Disziplingruppe schaue und
eigene Ideen einbringe. Dieses Dokument ist **reines Brainstorming**: kein Code, keine
Motoränderung, keine Zahl gedreht. Jede Idee trägt eine Klasse (**A** = reine Anzeige, rho- und
Pp-neutral, kann ohne Rückfrage gebaut werden; **M** = echte Mechanik-Änderung, braucht Chris'
Zustimmung und eine Messung), eine grobe Aufwandsschätzung (klein ≤ 1 Tag, mittel 2–4 Tage,
groß > 1 Woche) und die Begründung, warum sie zu genau dieser Disziplin passt und welches
Matrixattribut sie bedient.

**Was ich gelesen und vorausgesetzt habe:** `CLAUDE.md` (bindend), `stand-aller-disziplinen.md`
(Zwölfter Nachtrag, 26.09.), `arena-mini-dm-tdm-battlefield-rollout-plan.md` (inkl. Domination-
Umsetzungsnotiz 22.09.), `arena-zielwahl-umsetzung.md` (K1, zweimal gescheitert),
`arena-tempo-schlagfrequenz.md`, `mini-dm-4-team-ffa-recherche-06-09.md`,
`mini-dm-spielplan-umsetzung-14-09.md`, meine eigene `arena-duell-recherche-fable.md`, die
Opus-Konzeptreview der Arena-Minispiele vom 26.09. (nur auf Branch
`arena-minigames-konzeptreview-26-09`, nicht auf `main` — P0–P5 dort), die vier I-Spy-Dokumente
(Konzept 21.09., mein Reaktionskanal 22.09., Opus-Konzeptreview 26.09., P1-Prototyp-Befund
26.09.), `mutator-trait-organische-performance-konzept-29-09.md` (PR #1078) und die Commit-Texte
der Arena-/I-Spy-Änderungen seit dem 26.09. (TDM-Respawn, Mini-DM-Live-Reveal, Highlight-Cooldown,
Broadcast-Optik Phase 3–5). Motorstellen (`public/mockups/battle-mode.engine.js`, `main`
`42358ca6`): `PERS`/`PERSZIEL`/`ZIELE` (`:5108–5168`), `SLOTS_JE_DISC` (`:5265–5284`),
`ARENA_DOMINATION` (`:5990`), `TDM_RESPAWN_SEK` (`:25879`), `KAMPF_SUDDEN_DEATH_T` (`:27118`),
`baueMiniDmFfaRunde`/`MINI_DM_FFA_*` (`:38612–38730`), `ISPY_*`-Konstanten (`:15658–15937`).

---

## Kurzfassung

- **Die vier Disziplinen sind an sehr unterschiedlichen Stellen.** TDM ist seit dem Respawn vom
  26.09. formatlich rund (rho hat sich allein dadurch verdoppelt, 0,144 → 0,326) und braucht am
  ehesten *Rhythmus* und *Rollenjobs*, keine neue Grundmechanik. Mini-DM hat mit dem 4-Team-FFA
  ein Format, das noch niemand mit der rho-Sonde gemessen hat (Opus P0) — meine Ideen dort
  setzen deshalb bewusst auf das FFA-Chassis, nicht auf das 4-gegen-4, das laut Entscheidung gar
  nicht gespielt wird. Battlefield hängt an Chris' unbeantworteter Frage 2 aus der Opus-Review
  (Tickets + Respawn) — alles, was ich vorschlage, ist so gebaut, dass es *mit beiden* Antworten
  funktioniert. I-Spy hat nach dem verworfenen P1 einen validitätsstarken Kern (Saison 0,909),
  dem Entscheidungen und ein zweiter Mehrweg fehlen.
- **Ein Muster zieht sich durch alle vier:** die Matrix bepreist in jeder dieser Disziplinen
  Attribute, die heute nur als Stellvertreter in eine Kampf- oder Bühnenformel gehen (Charisma/
  Intelligence/Spirit in TDM und Battlefield, Awareness in I-Spy, Will/Stamina in Mini-DM). Die
  „mehrere Wege zum Erfolg"-Leitlinie ist genau das Werkzeug, diese Attribute an einen *eigenen*
  Weg zu binden, ohne die Matrix anzufassen — und zwar nicht nur beim Knacken einer Truhe,
  sondern beim *Finden* (I-Spy), beim *Wiedereinstieg* (TDM), beim *Führen* (Battlefield) und beim
  *Stehenbleiben* (Mini-DM).
- **Meine drei stärksten Ideen über alle vier:** (1) **I-Spy „Jede Seite wählt ihren Raum"** —
  eine echte Aufstellungsentscheidung für Chris mit richtiger Antwort, ohne Spiegel-Asymmetrie,
  weil die Räume ohnehin getrennt sind (I-1). (2) **Mini-DM „Joker-Runde"** — jedes Team setzt
  eine seiner vier Rollenrunden doppelt, die einzige Manager-Entscheidung im Event, eignungstreu
  und budgetneutral (M-2). (3) **Battlefield „Der Commander ruft den Plan"** — Opus' Team-Pläne
  (P4) an die Commander-Rolle und an Charisma/Intelligence als zwei Wege gebunden (B-1).
- **Wo mir nichts Neues eingefallen ist, das ich guten Gewissens vorschlagen kann:** an TDMs
  Grundmechanik nach dem Respawn — dort ist das Format richtig, und was fehlt (Rollen-Wertung,
  Persönlichkeit als Weg), steht schon in Opus P1/P2 und braucht keinen zweiten Vorschlag von
  mir. Ich habe TDM deshalb nur *Rhythmus*- und *Anzeige*-Ideen gegeben.

---

## 0. Was existiert und was entschieden ist — der Rahmen, in dem ich denke

**Gemeinsam (Arena-Chassis).** Eine Zielwahl-Kaskade ohne Würfel (`chooseTarget`), sechs
Persönlichkeiten mit fünf verschiedenen Zielneigungen (seit Chris' Meldung vom 13.09.:
`speer`/`schild`/`hinten`/`bedrohung`/`schwach`, nur das Bollwerk bleibt auf `naechster`), drei
Fünferskalen (Haltung, Zusammenhalt, Bindung), eine Live-Zielansage (PR #691), eine KI mit
Schlachtplan, `beitragVon` = Schaden + Heilung + Schild + 0,4·erlitten + 140·KO-Anteil, Sudden
Death ab t = 50, ein Sandring für alle. Zwei K1-Anläufe (Bedrohung mit Hysterese) sind gemessen
schlechter; die Tempo-Kopplung der Schlagfrequenz ist Chris' Entscheidung und hat TDM gehoben,
Mini-DM gesenkt. Broadcast-Optik Phase 3–5 hat Pips, Überzahl, Spectator-Karten, „Szene des
Spiels", KP-Zeile und einen spielweiten Highlight-Cooldown gebracht — die *Anzeige* der Kämpfe ist
also gerade erst überholt worden; meine A-Ideen unten sind bewusst nur die, die dort noch fehlen.

**TDM.** 6 gegen 6, seit 26.09. **Respawn** (5 s am Aufstellungsplatz, 1,5 s Spawnschutz), Ende
nur per Zeitlimit, Sieger über die KO-Summe. Chris: „TDM hat kein Kill-Limit". Matrix: power 28,
health 20, stamina 14, spirit 12, charisma 10, determination/intelligence 6, awareness/torment 2 —
**kein Speed**. Sechs Rollen (Vanguard, Skirmisher, Shotcaller, Hold Line, Rally Point, Breaker).

**Mini-DM.** Chris' Sonderregel: **vier Teams, je ein Kämpfer, vier Runden je Rolle (1v1v1v1),
Elimination ohne Respawn**, Rundenpunkte 4-3-2-1, Liga 2-1-0-0 (Chris' ausdrückliche
Übersteuerung, „nicht durch die Forschungsempfehlung ersetzen"). Gebaut und mit Live-Reveal
versehen, **nicht im Spielplan verdrahtet, nicht mit der rho-Sonde gemessen** (die misst weiter
das 4-gegen-4). Bekannt: Ecken-Lotterie (Team-Index 0 gewinnt 31 % statt 25 %, Rückzugsrichtung
hängt an `u.side===0`), Königsmacher-Risiko. Matrix: torment 24, health 20, power 16, stamina 16,
will 14, dexterity 10 — „hier wird geschlagen und eingesteckt".

**Battlefield.** 4 gegen 4, Elimination, dazu **Domination** (ein Mittelpunkt, Radius 230, 5 s
Eroberung, 6 P/s, Sieg bei 150, Siege Core erobert 1,6-fach) — die laut Opus-Messung **0 von 120
Spielen** entscheidet, weil der Kampf nach ~19 s durch Elimination vorbei ist. Opus P3 schlägt
Conquest-light (Tickets + Respawn + zweiter, rückwärtiger Punkt) vor; das ist **Chris' offene
Frage 2**. Matrix: charisma 20, intelligence 16, spirit 16, torment 12, power 10, awareness 10,
health 8, determination/stamina 4 — die einzige Kampfdisziplin, in der Power nicht führt. Rollen:
Commander, Spotter, Siege Core, Morale Anchor — ohne rollenspezifische Fähigkeit.

**I-Spy.** Chris' Schatzsuche ist gebaut: acht Ticks, zwölf Fundorte je Seite (eigener Raum je
Seite — ein geteilter Pool maß 0,53), drei Arten (Logik/Verhör/Mechanik), drei Stufen (Notiz 10 /
Akte 25 / Tresor 60), Spürwurf → F2-Wahl → 2RN-Knackwurf, Fortschritt an angebrochenen Truhen,
Teilpunkte 55 %, Nebenweg nur an Tresoren (Punktfaktor 0,65, genutzt in 3,71 % der Züge),
Reaktion als Hinweis (+0,15 Sicht, nur Tresor-Ereignisse), Nachfüllfolgen je Art, visueller
Layout-Randomizer. rho 0,756 / Saison 0,909, „knapp". **P1 „Spur statt Los" ist gebaut, gemessen
und verworfen** (0 von 5 Paarungen besser; Diagnose: personengebundene Spuren schneiden die
Eignungsbreite ab, weil niemand mehr über mehrere Rätselarten gezwungen wird). Offen: P2 (Slots als
Spielpläne + Mehrwege im Finden — der ausdrückliche Rückfallplan), P3 (ein Fall, zwei Räume), P4
(Indizienkette, Produktfrage), die Rotations-Idee aus dem P1-Befund 5.2, und Chris' Frage zur
„ehrlicheren Abnahme". Broadcast: Split-Screen, Zug-Uhr, Split-Tafel, Heiß/Kalt, Führung,
Highlight-Dosis sind gebaut.

**Mutator-Konzept (PR #1078).** Ein gleichförmiger Faktor `F = 1 + 0,065·h` auf alle
matrixgewichteten Attribute und auf `eig`, in allen vier Baufunktionen, Pp-neutral per
Konstruktion. **Konsequenz für dieses Dokument:** keine meiner Ideen baut einen Trait-spezifischen
Kanal oder lässt einen Trait die *Menge* bestimmen; wo Persönlichkeit vorkommt, bestimmt sie den
*Weg* (Opus P1-Prinzip), die Menge kommt aus `eig` — und `eig` trägt den Mutator-Faktor bereits.

**Was separat läuft und hier nicht angefasst wird.** Die Pp-Diagnose TDM/Mini-DM/Battlefield
(51/115/54 Pp). Ich nenne bei jeder M-Idee, ob sie die Pp-Messung *berührt*, aber ich versuche
nicht, sie zu reparieren.

---

## 1. Was ich bewusst NICHT vorschlage

- Keine Änderung der Eignungsmatrix, kein `power` in I-Spy (auf dem Abnahmekader r = −0,54 gegen
  die I-Spy-Eignung).
- Keine dritte Zielwahl-Formel für das Zwei-Seiten-Chassis (K1 ist zweimal gescheitert, Opus rät
  ausdrücklich ab). Die eine Zielwahl-Idee unten (M-3) betrifft ausschließlich das FFA-Chassis,
  das eine eigene Funktion und heute gar keine Neigung hat.
- Keine Rezept-/Zahlenrunde („balancing bringt noch nichts, wenn die Konzepte nicht perfekt sind").
- `cdKuerzung` und `jeSeite` bleiben, wie Chris sie entschieden hat.
- Keine geteilten Truhen zwischen den I-Spy-Seiten, keine Züge durch fremde Hand — die Regel, an
  der Gate, Duell-am-Fundort und Freilos-Läufer gemessen gescheitert sind.
- Kein Kill-Limit für TDM (Chris, 26.09.).
- Keine Wiederholung von Opus P1–P5. Wo eine Idee darauf aufbaut, sage ich es.

---

## 2. Drei Muster, die allen vier fehlen — und die meine Ideen tragen

**(a) Eine Entscheidung je Spiel, die eine richtige Antwort hat.** Die Arena hat sieben
Zielprioritäten und drei Regler je Kämpfer, I-Spy hat gar keine Aufstellungsentscheidung, die im
Raum vorkommt. Beides ist das Gegenteil von dem, was ein Manager-Spiel braucht: **eine** sichtbare
Wahl vor dem Spiel, deren Richtigkeit vom eigenen Kader abhängt — wie Chris' Slot-Pläne auf der
Bahn. I-1 (Raumwahl), M-2 (Joker-Runde) und B-1 (Plan des Commanders) sind genau das.

**(b) Der Weg als Mehrweg, nicht nur die Auszahlung.** Die Leitlinie ist bisher als „dieselbe
Aufgabe, zweites Attribut, schlechter bezahlt" gebaut. Es gibt eine zweite Lesart, die in echten
Spielen häufiger ist: **derselbe Erfolg, anderer Preis.** Der Dietrich am Logik-Tresor bringt nicht
weniger Punkte, er macht *Lärm* (I-3). Der Kämpfer mit hoher Ausdauer bekommt nicht mehr Schaden,
er steht *früher wieder* (T-2). Das ist matrixtreuer, weil das Attribut nicht über einen
Abschlag „durchgereicht" wird, sondern über eine eigene Konsequenz.

**(c) Rhythmus statt Gleichlauf.** Ein Kampf mit Respawn tröpfelt, wenn jeder einzeln zurückkommt;
eine Schatzsuche mit acht gleichen Ticks hat kein Endspiel. Wellen (T-1), ein schrumpfender Ring
(M-4) und ein sichtbarer Fallabschluss (I-5) geben dem Spiel einen Anfang, eine Mitte und ein Ende
— das ist die billigste Form von „lebendiger", weil sie vor allem Anzeige ist.

---

## 3. TDM — Rhythmus und Rollenjobs; die Grundmechanik ist seit dem Respawn richtig

### T-1 · Respawn-Wellen statt Einzel-Respawn — M, mittel

**Was.** Gefallene Kämpfer kommen nicht je einzeln nach 5 s zurück, sondern gemeinsam mit der
nächsten **Welle** (Vorschlag: alle 8 s, jeder wartet also 0–8 s, im Mittel weiter ~5 s). Wer
zwischen zwei Wellen fällt, wartet auf die nächste.

**Warum TDM.** Genau das ist der Unterschied zwischen einem Deathmatch, das tröpfelt, und einem,
das *Teamfights* hat: Wellen kollidieren, es gibt Momente, in denen fünf gegen zwei stehen, und
Momente, in denen die Überzahl zurückkommt. Overwatch, Battlefield und Halo fahren aus diesem
Grund Wellen oder gestaffelte Respawns. Für TDM mit sechs Köpfen je Seite ist das die einzige
Kopfzahl, bei der man eine Welle überhaupt *sieht*. Die Überzahl-Pips aus Phase 3 (K2) bekommen
dadurch etwas zu zeigen, das sich rhythmisch ändert statt zufällig.

**Attribut/Rezept.** Keins — bewusst. Die Welle ist ein Format, kein Kanal. (Für einen
attributgebundenen Wiedereinstieg s. T-2; beides zusammen wäre möglich: Stamina entscheidet, ob
man die *nächste* oder die *übernächste* Welle erwischt.)

**Risiko/Messung.** Weniger, dafür gebündelte Ereignisse; nach der Hockey-Lehre kostet das
Verlässlichkeit nur, wenn die Ereigniszahl je Kopf spürbar sinkt — bei 8-s-Wellen und ~95 s
Spielzeit nicht zu erwarten, aber `miss-alle-disziplinen.mjs 24 tdm` paarweise vor/nach, und
Opus' A1–A3 (Team-Ergebnis, Star/Paare, Kanaltreue). Wellen-Takt ist eine Zahl (`TDM_RESPAWN_SEK`
wird zu einem Wellenintervall), keine Formel.

### T-2 · „Wieder auf den Beinen": Stamina bestimmt die Respawn-Wartezeit — M, klein

**Was.** Die 5 s Respawn werden zu **4–6 s je nach Stamina** (Vorschlag: `6 − 2·(STAMINA/100)`).
Ein Kämpfer mit Stamina 90 ist nach 4,2 s zurück, einer mit 30 nach 5,4 s.

**Warum TDM.** Stamina hat in TDM Matrixgewicht 14 und ist heute nur über AUS (Ermüdung) und die
Rezeptmischung vertreten. „Wie schnell steht einer wieder auf" ist die wörtliche Bedeutung von
Ausdauer in einem Format mit Wiedereinstieg — und es ist ein Kanal, den *nur* ein Respawn-Format
haben kann, also etwas, das TDM von Mini-DM/Battlefield unterscheidet, statt sie ähnlicher zu
machen. Das ist Muster (b): derselbe Erfolg, anderer Preis — Stamina gibt keine Punkte, sie gibt
Zeit im Spiel.

**Attribut/Rezept.** Stamina (14 Pp). Ein Kanal, der die *Menge* der Gelegenheiten hebt, aber
über ein Matrixattribut — genau das, was CLAUDE.md mit „Matrixgewichte durchreichen" verlangt.
Kein Trait, kein Slot; der Mutator-Faktor auf die Attribute (PR #1078) wirkt automatisch mit.

**Risiko/Messung.** Pp: Stamina bekommt Einfluss dazu; ob das die Pp-Abweichung senkt (Stamina
ist heute vermutlich unterrepräsentiert) oder hebt, muss `messe-arena-einfluss.mjs tdm` zeigen —
klein genug, um es in die separate Pp-Diagnose mitzunehmen statt sie zu stören. Spanne 4–6 s ist
bewusst eng (nicht 2–10), damit der Kanal ein Zuschlag bleibt, kein Hauptträger.

### T-3 · Seitenwechsel zur Halbzeit — M (eignungsneutral), mittel

**Was.** Bei t = 47 (Halbzeit vor Sudden Death) tauschen die Seiten Heimatpunkte, wie in jedem
Feldsport. Kurze Einblendung „Seitenwechsel", Kämpfer laufen zur anderen Seite (oder werden
respawnt — mit T-1 bietet sich die Welle als Halbzeitpfiff an).

**Warum TDM.** Zwei bekannte Asymmetrien hängen an `u.side===0` (Rückzugsrichtung, Formation
links/rechts, s. `baueMiniDmFfaRunde`-Kommentar); Opus fand einen Heimvorteil von 59 % im TDM,
teils aus der Sonde, teils möglicherweise aus dem Motor. Ein Seitenwechsel mittelt jede
Geometrie-Asymmetrie **innerhalb eines Spiels** aus — dasselbe Prinzip wie die Ecken-Rotation, die
Opus für Mini-DM vorschlägt, nur auf das Zwei-Seiten-Spiel übertragen. Und er gibt dem Spiel eine
Mitte (Muster c), die es mit 95 Sekunden Gleichlauf heute nicht hat.

**Attribut/Rezept.** Keins. Reine Geometrie, kein Kanal.

**Risiko/Messung.** Der Spiegeltest (`miss-arena-buehne-spiegel.mjs`, für die Arena analog) muss
nach dem Wechsel näher an 50:50 lesen als vorher — das ist die Abnahme. Aufwand liegt in der
Geometrie (Heimatpunkte, MID-Klammern), nicht in der Logik.

### T-4 · Der „Trade" als benanntes Ereignis — A, klein (später Futter für Opus P2)

**Was.** Fällt ein Kämpfer, und ein Kamerad schaltet innerhalb von 5 s dessen Angreifer aus, ist
das ein **Trade** („Krolach vergilt Greenkraut"). Ticker-Zeile, Highlight-Kandidat (der
Cooldown aus dem 28.09. lässt das zu: Trades sind selten und echt), Spectator-Karte.

**Warum TDM.** In KAST-Statistiken (CS) ist „Traded" die halbe Miete des Skirmisher-Jobs; Opus P2
will Trades in die Rollen-Wertung nehmen. Bevor die Wertung sie zählt, sollte das Bild sie
*zeigen* — dann sieht Chris beim ersten Sichtlauf, ob die Zahl später zur Erzählung passt. Nur mit
Respawn ist ein Trade überhaupt ein Ereignis mit Folgen (der Gefallene kommt zurück, die Überzahl
ist wiederhergestellt).

**Attribut/Rezept.** Keins in Klasse A. Wenn P2 kommt: Trades zählen für Skirmisher/Breaker.

### T-5 · Die Front als Linie am Boden — A, klein

**Was.** Eine weiche, halbtransparente Linie zwischen den vordersten Kämpfern beider Seiten
(Mittelwert der Reihe-0-Positionen), die sich über das Spiel verschiebt; in der Seitenfarbe des
Teams, das sie zuletzt gedrückt hat.

**Warum TDM.** Bei sechs gegen sechs ist TDM die einzige Arena-Kopfzahl, in der „Fronten drücken"
(Vanguard, Breaker) sichtbar wäre — und heute nicht ist, weil alle drei Kampfdisziplinen auf
demselben Sandring ohne Raumbezug laufen (Rollout-Plan 2.3). Die Linie macht aus der Formation ein
Bild, ohne eine Zahl zu berühren. Für Battlefield wird sie in B-4 zur Mechanik.

---

## 4. Mini-DM — das FFA ist das Spiel; alles hier baut auf `baueMiniDmFfaRunde`

Vorbemerkung: Solange die Sonde das 4-gegen-4 misst, ist keine Mini-DM-Zahl im Stand der
Disziplinen eine Aussage über das, was Chris entschieden hat. **Opus P0 (FFA-Sonde) ist die
Voraussetzung für jede M-Idee unten** — ich wiederhole sie nicht, ich setze sie voraus.

### M-1 · Ecken-Rotation je Runde — M (eignungsneutral), klein

**Was.** In Runde r startet Team i an Ecke `(i + r) mod 4`. Über die vier Rollenrunden steht jedes
Team einmal an jeder Ecke. Opus nennt das in P3 als Nebensatz; hier die konkrete Regel, weil sie
die gemessene Ecken-Lotterie (Team-Index 0: 31 % Siege, zweigipflig) **innerhalb eines Events**
ausmittelt, ohne die Rückzugsformel anzufassen, die TDM/Battlefield teilen. Abnahme:
`miss-mini-dm-ffa-spiegel.mjs` mit vier byte-identischen Kämpfern muss über das *Event* (nicht je
Runde) auf 25 % ± 2 lesen.

### M-2 · Die Joker-Runde — M, klein bis mittel · **eine meiner drei stärksten Ideen**

**Was.** Vor dem Event setzt jedes Team **einen Joker auf eine seiner vier Rollenrunden**
(Frontliner/Finisher/Trick Fighter/Iron Guard). In dieser Runde zählen die Rundenpunkte dieses
Teams **doppelt** (4-3-2-1 → 8-6-4-2 nur für das Joker-Team, nur in seiner Joker-Runde). Die
Event-Endplatzierung ergibt sich wie heute aus der Summe; die Liga-Punkte bleiben Chris' 2-1-0-0.
Die KI-Teams setzen den Joker deterministisch auf die Rolle mit dem höchsten `eig`.

**Warum Mini-DM.** Das FFA ist heute ein Ablauf ohne einen einzigen Eingriff des Managers: vier
feste Rollen, vier feste Runden. Der Joker ist die Quiz-/Show-Mechanik („Schlag den Raab",
„Wer wird Millionär"-Joker, in Sportform: der Stich beim Doppelkopf) und passt zu einem Event,
das ohnehin als Sonderspieltag mit Live-Reveal inszeniert ist. Er hat eine **richtige Antwort, die
vom Kader abhängt** (Muster a): Joker auf die stärkste Rolle. Wer ihn falsch setzt, verliert
gegen dieselbe Aufstellung, die ihn richtig setzt. Und er ist **budgetneutral je Team**: jedes
Team verdoppelt genau eine Runde, die Summen sind über die Teams vergleichbar; die Liga-Punkte
werden nicht berührt.

**Attribut/Rezept.** Keins direkt — der Joker verstärkt, was die Rolle ohnehin leistet. Er
*erhöht* die Rangtreue der Event-Platzierung gegenüber der Kader-Eignung tendenziell (das
stärkste Glied zählt mehr), was messbar sein sollte.

**Risiko/Messung.** Zwei Teams mit Joker auf derselben Rolle: unproblematisch, jeder verdoppelt
nur die eigenen Punkte. Verdopplung ist der Vorschlag; ×1,5 wäre die vorsichtige Variante, wenn
der Joker das Event zu oft allein entscheidet. Abnahme mit der FFA-Sonde (P0): rho der
Event-Platzierung gegen Team-Eignung vor/nach; Anteil der Events, die *nur* durch den Joker
kippen, sollte unter ~25 % bleiben, sonst ist er ein Los.

### M-3 · Vergeltung als FFA-Zielneigung — M, mittel (nur FFA-Chassis)

**Was.** In der 1v1v1v1-Runde bekommt jeder Kämpfer als Grundneigung **„wer mich zuletzt getroffen
hat"** (Vergeltung), mit Rückfall auf die eigene Persönlichkeitsneigung, wenn ihn niemand
getroffen hat. Der Opportunist (`schwach`) behält seine Neigung — er *ist* der Königsmacher, und
das ist Charakter, kein Fehler.

**Warum Mini-DM.** In jedem FFA-Format (Smash, Battle Royale, Mario-Kart-Items) ist das
„Ganging" — zwei auf einen, der Dritte gewinnt — die Mechanik, die man **bewusst bremsen** muss;
Opus nennt den Königsmacher-Effekt als zu prüfendes Risiko, macht aber keinen Vorschlag.
Vergeltung ist die klassische Bremse: wer angreift, zieht den Angegriffenen auf sich, ein Ziel
„gehört" nicht dem Nächststehenden, sondern dem, der es sich gerade verdient hat. Das ist
**keine dritte K1-Formel**: sie ordnet keine Bedrohungszahl, sie liest ein Ereignis, und sie gilt
nur in `baueMiniDmFfaRunde`, wo heute gar keine FFA-spezifische Neigung existiert (jede Einheit
läuft mit `mitlinie`/`naechster`-Verhalten in einer Geometrie, die für zwei Seiten gebaut ist).

**Attribut/Rezept.** Keins direkt. Torment (24, das höchste Gewicht) ist im Rezept vermutlich
im Angriff; „einstecken und zurückschlagen" ist der Charakter dieser Matrix („hier wird
geschlagen und eingesteckt"), und Vergeltung ist die Zielwahl dazu.

**Risiko/Messung.** Kann Duelle in Paare zerfallen lassen (A↔B, C↔D) — das ist gewollt: zwei
parallele Duelle sind die *fairste* FFA-Konstellation, und der Sieger jedes Paares trifft danach
den anderen. Messen mit der FFA-Sonde: Königsmacher-Quote (wie oft wird Platz 1, ohne den
meisten Schaden gemacht zu haben) vor/nach.

### M-4 · Der Ring schrumpft — A zuerst, M optional, klein/mittel

**Was (A).** Sudden Death (t > 50, Schadensfaktor +6 %/s) existiert, ist im FFA aber unsichtbar.
Ein **Ring am Boden**, der ab t = 40 sichtbar auf die Feldmitte zuläuft, macht ihn zum Bild: die
Battle-Royale-Zone. Reine Zeichnung, liest nur `t`.

**Was (M, optional).** Wer außerhalb des Rings steht, verliert LP (wie in der Zone) — das
erzwingt Kontakt im FFA, wo vier Solokämpfer sich heute prinzipiell aus dem Weg gehen könnten
(`schleicher` → `hinten` ist im Zwei-Seiten-Mini-DM ein „stiller Leerlauf", s. `PERSZIEL`-
Kommentar). Damit wäre Will (14, „stehenbleiben unter Druck") ein Weg: wer länger im Ring
aushält, ohne zurückzuweichen, gewinnt Zeit.

**Warum Mini-DM.** Es ist das Battle-Royale-Format unter den vieren; die Zone ist dessen
Kernbild, und sie löst einen realen FFA-Stillstand, den ein Zwei-Seiten-Format nicht hat. Für
TDM (Respawn) und Battlefield (Objective) wäre eine Zone falsch — hier ist sie der Unterschied.

### M-5 · Platzierung nach Ausscheide-Reihenfolge — M, klein, **als Frage, nicht als Empfehlung**

Heute ist der Rundenrang `beitragVon` am Rundenende. Ein FFA-Format ordnet natürlich nach
**Überleben** (wer zuletzt steht, ist Erster). Das ehrt die Mini-DM-Matrix wörtlich (health 20,
will 14, stamina 16 — „einstecken"), während `beitragVon` vor allem Schaden (power) bezahlt. Aber:
Überleben ist im FFA die Größe, die vom Königsmacher am stärksten abhängt (fremde Hand). Deshalb
nur als Hybrid denkbar — **Rang nach Ausscheide-Reihenfolge, Gleichstand unter den Überlebenden
nach `beitragVon`** — und nur *nach* M-3, das das Ganging bremst. Ich stelle es als Frage: Chris
sagt „jeder hat nur ein Leben" — soll das Leben dann auch das sein, was gewertet wird?

---

## 5. Battlefield — Führung, Aufklärung, Moral: drei Rollen, die endlich etwas tun

Vorbemerkung: Ob Battlefield Tickets und Respawn bekommt (Opus P3, Chris' Frage 2), entscheidet,
ob die Domination je ein Spiel entscheidet. **Alle drei M-Ideen unten funktionieren mit und ohne
Tickets**, weil sie an Rollen und Attribute binden, nicht an das Siegkriterium.

### B-1 · Der Commander ruft den Plan — M, mittel bis groß · **eine meiner drei stärksten Ideen**

**Was.** Opus P4 schlägt zwei bis drei Team-Pläne mit Konterbeziehung vor („Kopf abschlagen"
schlägt „Lohnendste zuerst" schlägt „Mauer" schlägt „Kopf abschlagen"). Mein Vorschlag bindet das
an die Commander-Rolle und an **zwei Wege**:

- **Vor dem Kampf** wählt Chris den Plan (die eine Entscheidung, Muster a). Die KI-Seite wählt
  ihren über `schlachtplan()`, das es schon gibt.
- **Im Kampf** darf der Commander **umrufen** — an festen Momenten (Punkt erobert/verloren,
  erster Ausfall, Halbzeit). Ob er den *richtigen* Konter ruft, entscheidet **Intelligence**
  (Lesen des gegnerischen Plans: p = f(INT)); ob das Team dem Ruf *folgt*, entscheidet
  **Charisma** (Anteil der Kämpfer, die innerhalb von 2 s auf den neuen Plan wechseln, statt
  ihre Bindung auszusitzen). Ein Commander mit INT 85 / CHA 40 liest richtig, aber nur die Hälfte
  folgt; einer mit INT 40 / CHA 85 ruft oft falsch, aber alle ziehen mit. Beide sind brauchbar —
  auf verschiedenen Wegen.

**Warum Battlefield.** Charisma 20 + Intelligence 16 sind **36 Pp der Matrix** und haben heute
keinen eigenen Kanal („ein Befehl richtet mehr aus als ein Schlag" ist laut Opus ein
Stellvertreter). Der Commander-Slot-Text sagt wörtlich „führt große Situationen". Und es ist die
einzige der vier Disziplinen, deren Name ein *geführtes* Gefecht verspricht. Der Plan-Konter ist
zudem die Mechanik, mit der die Domination lesbar wird: „Mauer" hält den Punkt, „Kopf abschlagen"
holt ihn — der Kontrollpunkt bekommt einen Grund, um den gekämpft wird, unabhängig davon, ob er
über Tickets oder über 150 Punkte entscheidet.

**Attribut/Rezept.** Charisma (Folgequote), Intelligence (Trefferquote des Konters). Beides
bestimmt einen *Weg*, die Menge des Team-Erfolgs kommt weiter aus `eig` der Kämpfer, die den
Plan ausführen. Für den Commander selbst gilt Opus P2: sein Job wird als Anteil am Teamerfolg
auf dem angesagten Ziel gezählt (Assist-Logik), sonst bleibt er im rollenblinden `beitragVon`
unsichtbar.

**Risiko/Messung.** Pläne sind per Definition eignungsneutral (ein Konter *soll* etwas bringen,
aber weniger als ein großer Eignungsabstand — Opus' A1). Messen: Siegquote Plan gegen Plan bei
gleicher Eignung, dann A1–A3, dann Pp (Charisma/Intelligence müssen im Budget *steigen*, nicht
über 25 Pp hinausschießen — das ist bei 36 Pp Matrixgewicht unwahrscheinlich, aber zu prüfen).
Aufwand: mittel, wenn P4-Pläne als Grundlage kommen; groß, wenn die Umruf-Logik neu gebaut wird.

### B-2 · Der Spotter markiert — M, klein bis mittel

**Was.** Die Zielansage (PR #691, `kfZielFuer`, 7 s Sperre) wird für den Spotter zur **eigenen,
automatischen Fähigkeit**: alle N Sekunden markiert er ein Ziel, seine Seite bekommt darauf den
bestehenden Bias. **Welches** Ziel er markiert, entscheidet Awareness (hohe Awareness: das Ziel
mit dem niedrigsten Lebensanteil oder den Heiler; niedrige: den Nächsten — also die heutige
Geometrie). **Wie oft**, entscheidet Intelligence (Sperre 5–9 s).

**Warum Battlefield.** Awareness (10) hat in keiner Kampfdisziplin einen Kanal; der Spotter-Text
sagt „liest Lücken und Ziele". Die Infrastruktur existiert vollständig (Ring, Restsekunden,
Fokus-Farbe) — es fehlt nur die Regel, dass eine *Figur* sie auslöst statt der Spieler. Und es ist
Muster (b): der Spotter macht keinen Schaden, er macht die Treffer der anderen wahrscheinlicher.

**Attribut/Rezept.** Awareness (Zielqualität), Intelligence (Takt). Für die Wertung des Spotters
gilt wieder Opus P2 (Treffer der eigenen Leute auf markierte Ziele).

**Risiko/Messung.** Fokusfeuer ist fremde Hand für das Opfer — aber in einem Gefecht ist das die
Realität, und die Sonde misst je Spieler `beitragVon`, nicht Überleben. Vorsicht bei der
Kopplung mit B-1: zwei Führungsrollen, die beide Ziele setzen, brauchen eine Vorrangregel (der
Plan gibt die Klasse des Ziels vor, der Spotter das konkrete Ziel innerhalb der Klasse).

### B-3 · Der Morale Anchor hält die Linie — M, klein

**Was.** Die Haltung (defensiv … ungestüm) bestimmt, bei welchem LP-Anteil ein Kämpfer sich
löst. Der Morale Anchor verschiebt für **Nachbarn in seinem Umkreis** den Rückweg: wer sich
löst, kehrt nach `k · SPIRIT(Anchor)` Sekunden zurück statt nach der Persönlichkeits-Zeit — nicht
„niemand zieht sich zurück" (das würde den Charakter löschen, Opus P1), sondern „der Rückzug
dauert kürzer". Optisch: ein Standarten-/Banner-Layer am Anchor (Muster Krone für den Commander,
Rollout-Plan 2.3), Nachbarn im Umkreis bekommen einen Bannerschatten.

**Warum Battlefield.** Spirit (16) ist heute nur Rezeptmasse. „Hält Linien zusammen" ist der
Slot-Text, und Rückzug-und-Rückkehr ist die einzige Verhaltensdimension im Motor, die *Moral*
bedeutet. Es ist die kleinste der drei Rollenideen, weil Haltung und Rückzug schon existieren.

**Attribut/Rezept.** Spirit des Anchors, als Weg (Rückkehrzeit), nicht als Menge.

**Risiko/Messung.** Persönlichkeit bleibt spürbar (ein Vorsichtiger löst sich weiter früh — er
kommt nur schneller wieder). Pp: Spirit steigt; A3-Kanaltreue muss zeigen, dass die Haltung
danach weniger Rangvarianz erklärt als heute (5–10 %).

### B-4 · Frontlinie statt Punkt — M, groß, **als Alternative zu Conquest-light, nicht zusätzlich**

**Was.** Statt eines Kontrollpunkts (oder zweier) eine **Front**, die sich über das Feld
verschiebt — ein Tauziehen: die Seite mit mehr *gebundenem* Druck an der Linie (Kämpfer in
Kontakt, gewichtet mit Siege-Core-Faktor) drückt sie je Sekunde um ein Stück in die gegnerische
Hälfte; Sieg, wenn sie die gegnerische Grundlinie erreicht oder — bei Zeitablauf — wer die Linie
weiter in Feindesland stehen hat. Der Rollout-Plan hat das als Option 3 in einem Nebensatz
genannt („eine Frontlinie, die sich verschiebt"); Opus P3 hat sich für Tickets und einen zweiten
Punkt entschieden. Ich lege die Front als **Gegenvorschlag** hin, weil sie drei Dinge auf einmal
löst: (1) sie ist **kontinuierlich** (kein Radius, in dem 19 s nichts passiert), (2) sie ist
**lesbar** ohne HUD (T-5 als Mechanik), (3) sie gibt beiden Reihen einen Job — Siege Core drückt,
Morale Anchor hält, Commander entscheidet, wann gedrückt wird (B-1), ohne dass Reihe 2 je einen
Punkt „erreichen" müsste (das Problem, das der `ARENA_DOMINATION`-Kommentar für den Commander
benennt).

**Warum Battlefield.** Eine Front ist das Bild des Namens. Tickets sind das Bild von
Battlefield™ (dem Spiel), eine Front das Bild einer Schlacht. Für 4 gegen 4 ist ein Punkt mit
Radius 230 zu klein, um je umkämpft zu sein — eine Linie ist immer umkämpft, weil sie überall ist,
wo Kontakt ist.

**Risiko/Messung.** Braucht — wie Conquest-light — Respawn oder mindestens ein Spielende, das
nicht nach 19 s durch Elimination kommt; sonst gilt Opus' Befund (0 von 120) genauso. Groß, weil
neuer Sieg-Zustand und neue Bodenebene. **Chris' Frage 2 bleibt die Vorfrage:** Tickets, Front,
oder beides (Front als Ticket-Bleed).

### B-5 · Aufklärungs-Nebel — A, klein bis mittel

**Was.** In Battlefield werden gegnerische Kämpfer als **Silhouetten** gezeichnet, bis ein eigener
Kämpfer (bevorzugt der Spotter) sie in Sichtweite hatte; danach für 6 s scharf. Reine Zeichnung,
keine Wirkung auf Zielwahl oder Treffer.

**Warum Battlefield.** Die drei Kampfdisziplinen sehen identisch aus (Rollout-Plan 2.3); ein
eigenes Bodenbild ist vorgeschlagen. Nebel ist die *zweite* billige Differenzierung und die
einzige, die eine Rolle (Spotter) sichtbar macht, bevor sie mechanisch etwas tut (B-2). Ehrlich:
das ist Kulisse, aber Kulisse, die den Namen einlöst.

---

## 6. I-Spy — der Kern bleibt, die Entscheidungen kommen dazu

Vorbemerkung: Der P1-Befund hat etwas Wertvolles gezeigt, das über P1 hinausgeht — **die
Durchmischung über Rätselarten trägt die Validität** (argmax 0,671 → avg 0,776 Saison, die größte
Einzelbewegung). Jede Idee unten ist so gebaut, dass sie diese Durchmischung *erhält oder
verstärkt*, nie einschränkt.

### I-1 · Jede Seite wählt ihren Raum — M, mittel · **eine meiner drei stärksten Ideen**

**Was.** Drei benannte Räume (das Konzept 2.1 hatte sie schon: **Archiv**, **Werkstatt**,
**Salon**), alle mit zwölf Fundorten und derselben Stufenmultimenge, aber mit **verschobener
Art-Punktmasse innerhalb eines engen Korridors** um die Matrix-Anteile (`ISPY_ZIEL_ANTEIL`
0,376/0,365/0,259): Archiv Logik +8 Pp, Werkstatt Mechanik +8 Pp, Salon Verhör +8 Pp, die anderen
beiden je −4 Pp. **Vor dem Spiel wählt jede Seite ihren Raum** — Chris für sein Team, die KI
deterministisch den Raum, dessen Schwerpunkt-Art zum höchsten Team-Mittel der drei
Knack-Sub-Skills passt.

**Warum I-Spy.** Es ist die einzige Disziplin, in der die beiden Seiten **ohnehin in getrennten
Räumen** spielen (Architekturentscheidung PR 1, 0,53 beim geteilten Pool). Deshalb ist die
Raumwahl **spiegelfrei**: niemand wählt *gegen* den Gegner, jeder wählt *für* sich; der
Spiegeltest bleibt strukturell 50:50. Das gibt Chris die Aufstellungsentscheidung, die die Slots
heute nicht liefern (Opus 1.1: „schwach"), ohne P2s Risiko, dass ein falscher Plan einen guten
Spieler unter seinen Rang drückt — ein falscher Raum kostet dem *Team* ein paar Punkte, nicht
einem Spieler seine Rätselart. Und es erhält die Durchmischung: alle drei Arten bleiben in jedem
Raum, nur die Gewichte wandern.

**Attribut/Rezept.** Keins neu. Die Raumwahl verschiebt die *Verteilung* der bestehenden
Sub-Skills, nicht ihre Formeln.

**Risiko/Messung.** Pp: ±8 Pp Verschiebung einer Art bedeutet grob ±3 Pp auf Attributebene (die
Konzeptrechnung 1.5 gibt 4,3 Pp für die *heutige* Abweichung) — bleibt weit unter 25, aber
nachrechnen. rho: die Abnahme läuft mit der Standardwahl beider Seiten (KI-Regel), wie die Bahn
mit der Standardaufstellung. Der Layout-Randomizer (visuell) bleibt und wird zum Raum-Randomizer
*innerhalb* der Wahl (jeder Raum hat weiter drei Anordnungen). Aufwand: drei Positions-/
Massenlisten, eine Wahl-UI, die KI-Regel.

### I-2 · Mehrwege im FINDEN — M, mittel (Opus P2b, hier konkretisiert und ohne Spielpläne)

**Was.** Der Spürwurf hat heute einen Weg: SPÜRSINN (intelligence/torment/awareness). Er bekommt
zwei Nebenwege (Opus' Namen: **Beobachten** = Primär, **Befragen** = charisma/torment/spirit,
**Beschatten** = dexterity/speed/will), verrechnet wie `ispyBesterWeg()`: Sichtschwelle = max
(Primärweg, Nebenweg · 0,8). Keine Spielpläne, keine Graben-Politik — nur der zweite Weg zum Tor.

**Warum I-Spy — und warum das hier greift, wo es beim Knacken nicht griff.** Der Knack-Nebenweg
wird in 3,71 % der Züge genutzt, weil er nur an zwei Tresoren sitzt und der Primärweg dort meist
gewinnt. Das Finden passiert **in jedem Zug jedes Spielers** — dort entscheidet der Nebenweg
gemessen über den Zugang (Opus 0.2: „Der Zugang wiegt mehr als das Können am Schloss"). Ein
Spieler mit Intelligence 40, aber Charisma 85 findet heute kaum Tresore; mit „Befragen" findet
er sie über den Informanten. Das ist Chris' „jeder Spieler hat seine eigene Herangehensweise",
dort angewandt, wo die Punkte entschieden werden. Und es **verbreitert die Attributmischung** am
Sichttor — genau die Richtung, die der P1-Befund als validitätsstützend gemessen hat.

**Attribut/Rezept.** Charisma (9) und Dexterity/Speed (je 8) bekommen einen Weg zum Finden; die
Matrixmasse bleibt, weil die Nebenwege abgewertet sind und die Knack-Sub-Skills unverändert.

**Risiko/Messung.** Das Sichttor ist der Kanal, in dem Signal und Rauschen sitzen (Opus 3.3) —
ein Nebenweg verschiebt den Punkt auf der Tauschkurve, das muss die paarweise Messung zeigen
(`miss-alle-disziplinen.mjs 24 i-spy`, ≥ 4 von 5 besser oder mindestens neutral). Pp in zwei
Stämmen. Korridor-Kennzahl: Nebenweg-Anteil am Finden 10–25 % (Opus 5.4).

### I-3 · Der Nebenweg macht Lärm statt weniger Punkte — M, klein

**Was.** Der Tresor-Nebenweg (heute Punktfaktor 0,65, Variante A aus Chris' Nachtrag) bekommt
eine **dritte Variante C**: voller Punktwert, aber der Versuch ist **für die Gegenseite sichtbar**
— auch bei Notiz-/Aktenstufe, auch beim Fehlschlag — und löst deren Hinweis aus (S-c/Hinweis-
Regel, wie sie existiert). Der Dietrich öffnet den Logik-Tresor genauso gut wie die Chiffre, aber
man hört ihn drüben.

**Warum I-Spy.** Es ist Muster (b) in Reinform und die Clank!-Mechanik („Lärm zieht
Aufmerksamkeit"), die die Opus-Review in 2. zitiert, aber nicht baut. Chris' Wortlaut lässt A, B
oder beides zu; C ist die Fassung, in der der Nebenweg **nicht schlechter, sondern anders**
ist — was ihn für die KI-Wahl attraktiver macht (der Nebenweg-Anteil steigt von 3,7 % auf etwas,
das man sehen kann) und dem Reaktionskanal, der heute „Theater" ist (Opus 1.2), zum ersten Mal
einen Inhalt gibt: der Jubel drüben heißt „da hat jemand aufgebrochen". **Kombinierbar mit P3**
(ein Fall, zwei Räume): Lärm an Fundort 7 drüben + Schlüsselindiz an derselben Stelle = echte
Information.

**Attribut/Rezept.** Keins neu; `ispySichtbar()` bekommt einen Fall mehr. Der Mechanik-Nebenweg
(dexterity/speed) wird häufiger gewählt — Pp-Verschiebung Richtung Dexterity, klein.

**Risiko/Messung.** Der Hinweis ist gemessen rho-neutral bis leicht positiv (+0,022, mein
Reaktionskanal-Dokument 5.2), deshalb ist das Risiko klein. Dosis wie damals: 0 / 0,15 / 0,30.

### I-4 · Die Kooperations-Truhe — M, mittel, **mit benanntem Risiko**

**Was.** Ein Fundort je Raum (Vorschlag: der Verhör-Tresor auf der Mittelachse) ist eine
**Zwei-Personen-Truhe**: sie lässt sich nur öffnen, wenn im selben Tick zwei Teamkollegen sie
wählen — einer mit Logik, einer mit Verhör (Zeuge *und* Akte). Beide würfeln ihren eigenen
Knackwurf gegen ihre eigene Rätselart; gelingen beide, bekommen **beide** den vollen Wert (60).
Gelingt nur einer, gilt K-D (Fortschritt für beide). Niemand verliert einen Zug: wer allein dort
steht, versucht sie einwegig mit Nebenweg-Abschlag.

**Warum I-Spy.** Spirit (13) sitzt heute in TEAMGEIST (Reaktionswurf) und AUSDAUER — als
Füllmasse. Ein Escape-Room ist nach Nicholson zu 45 % pfadbasiert *mit Meta-Rätsel*, und das
Meta-Rätsel ist immer das, wofür man **zwei Leute** braucht. Opus P4 (Indizienkette) löst das
auf Teamebene *außerhalb* von `wert()`; die Kooperations-Truhe löst es *innerhalb* — als
seltenes, großes, gemeinsames Ereignis (ein bis zwei je Spiel), das der Ticker erzählen kann
(„Cassandra und Draco knacken den Tresor gemeinsam").

**Risiko/Messung — ehrlich.** Das ist geteilter Zustand innerhalb des Teams, und Opus 3.3 (3)
hat geteilten Zustand als „fremde Hand innerhalb des Teams" benannt. Zugleich hat der P1-Befund
gemessen, dass gerade das Wegfallen geteilter Ressourcen die Validität kostet. Beides ist wahr;
was überwiegt, entscheidet nur die Messung. Deshalb nur **eine** Truhe je Raum, Abnahme paarweise,
Abbruch bei < 4 von 5.

### I-5 · Die Fallakte — A, klein

**Was.** Jede Truhe trägt einen kleinen Hinweistext (Cluedo-Kategorien: **Wer / Wo / Womit**,
je Art einer), und die HUD-Leiste zeigt je Seite eine **Fallakte** „7 von 12 Hinweisen", die sich
mit jedem Fund füllt; am Ende blendet der Ticker „Team X löst den Fall: der Gärtner, im
Salon, mit dem Kerzenleuchter" ein — rein narrativ, aus den geknackten Arten zusammengesetzt,
ohne einen Punkt zu ändern.

**Warum I-Spy.** Chris' Satz war „Schatzsuche nach *Informationen*". Heute ist die Information
eine Zahl. Die Fallakte ist P4 (Indizienkette) **als reine Anzeige** — sie liefert das
Fort-Boyard-Gefühl, dass die Funde sich zu etwas fügen, ohne die Produktfrage (Teambonus in
einer Bühne) zu stellen. Wenn Chris P4 später will, ist die Fallakte die fertige Oberfläche
dafür.

### I-6 · Rotation der Rätselart nach jedem Versuch — M, klein, **zu prüfen, nicht zu bauen**

Der P1-Befund (5.2) schlägt vor, die inzidentelle Durchmischung bewusst nachzubauen: nach jedem
Knackversuch rotiert die bevorzugte Art (Round-Robin nach Sub-Skill-Rang). Ich unterstütze das
als **Diagnose-Messung auf dem bestehenden Kern**, nicht als P1-Wiederbelebung: F2 bekommt einen
kleinen Bonus auf die Art, die der Spieler zuletzt *nicht* gespielt hat. Wenn die Saison-Validität
dadurch über 0,909 steigt, ist die Durchmischungs-Hypothese bestätigt und I-2/I-4 stehen auf
festerem Grund. Ein halber Tag Messung.

### Was ich bei I-Spy nicht vorschlage

Kein neuer Kern (P1 ist gemessen; ein zweiter Neubau ohne neue Hypothese wäre dasselbe Lehrgeld).
Keine weitere Uhr-Runde (16 Ticks: +0,011). Keine Zuschauer-Ansage R-3 (Eingriff in eine
Vorab-Rechnung). Kein Pokerface je Persönlichkeit vor P3 — dort gehört es hin.

---

## 7. Rangliste, Aufwand, Reihenfolge

| # | Idee | Disziplin | Klasse | Aufwand | Braucht vorher | Attribut, das einen Weg bekommt |
|---|---|---|---|---|---|---|
| I-1 | Jede Seite wählt ihren Raum | I-Spy | M | mittel | — | (Verteilung) |
| M-2 | Joker-Runde | Mini-DM | M | klein–mittel | Opus P0 (FFA-Sonde) | (Verstärkung) |
| B-1 | Der Commander ruft den Plan | Battlefield | M | mittel–groß | Opus P4-Pläne | Charisma, Intelligence |
| I-2 | Mehrwege im Finden | I-Spy | M | mittel | — | Charisma, Dexterity/Speed |
| I-3 | Nebenweg macht Lärm | I-Spy | M | klein | — | (Dexterity, indirekt) |
| T-2 | Stamina bestimmt Respawn-Zeit | TDM | M | klein | — | Stamina |
| B-2 | Der Spotter markiert | Battlefield | M | klein–mittel | — | Awareness, Intelligence |
| B-3 | Morale Anchor hält die Linie | Battlefield | M | klein | — | Spirit |
| M-3 | Vergeltung als FFA-Zielneigung | Mini-DM | M | mittel | Opus P0 | — |
| M-1 | Ecken-Rotation | Mini-DM | M (neutral) | klein | — | — |
| T-1 | Respawn-Wellen | TDM | M | mittel | — | — |
| T-3 | Seitenwechsel zur Halbzeit | TDM | M (neutral) | mittel | — | — |
| I-4 | Kooperations-Truhe | I-Spy | M | mittel | I-2 | Spirit |
| B-4 | Frontlinie statt Punkt | Battlefield | M | groß | Chris' Frage 2 | (Siege Core/Anchor) |
| M-4 | Der Ring schrumpft | Mini-DM | A (M opt.) | klein/mittel | — | (Will, optional) |
| M-5 | Platzierung nach Überleben | Mini-DM | M | klein | M-3, Chris-Frage | Health/Will/Stamina |
| I-5 | Die Fallakte | I-Spy | A | klein | — | — |
| I-6 | Rotation der Rätselart (Messung) | I-Spy | Diagnose | klein | — | — |
| T-4 | Der Trade als Ereignis | TDM | A | klein | — | — |
| T-5 | Die Front als Linie | TDM | A | klein | — | — |
| B-5 | Aufklärungs-Nebel | Battlefield | A | klein–mittel | — | — |

**Reihenfolge, wenn Chris alles wollte:** Die A-Ideen (I-5, T-4, T-5, M-4a, B-5) sind
rho-neutral und können jederzeit; sie kosten zusammen etwa eine Woche. Von den M-Ideen zuerst
die drei, die *eine Entscheidung* einführen (I-1, M-2, B-1) — sie ändern, wie sich die Disziplin
für Chris *anfühlt*, nicht nur, wie sie misst. Dann die Rollen-/Attribut-Wege (I-2, T-2, B-2,
B-3, I-3), jede einzeln paarweise gemessen. B-4 und M-5 erst nach Chris' Antworten.

---

## 8. Fragen an Chris, je eine Zeile

1. **I-1 Raumwahl:** Soll jede Seite vor dem I-Spy-Spiel ihren Raum wählen (Archiv/Werkstatt/
   Salon, leicht verschobene Rätselart-Schwerpunkte)?
2. **M-2 Joker:** Darf jedes Mini-DM-Team eine seiner vier Rollenrunden als Joker doppelt zählen
   lassen (nur Event-Punkte, Liga bleibt 2-1-0-0)?
3. **B-1 Commander:** Soll der Commander Opus' Team-Pläne im Spiel *umrufen* dürfen, mit
   Intelligence (richtiger Konter) und Charisma (Folgequote) als zwei Wegen?
4. **I-3 Lärm:** Darf der Nebenweg voll bezahlen, wenn er dafür hörbar ist — statt 65 % leise?
5. **T-2 Stamina:** Darf Ausdauer die Respawn-Zeit im TDM um ±1 s bewegen?
6. **M-5 Überleben:** Wenn jeder im Mini-DM nur ein Leben hat — soll das Leben auch die
   Platzierung bestimmen (mit `beitragVon` als Gleichstandsregel)?
7. **B-4 Front:** Zu deiner offenen Frage 2 (Tickets + Respawn): wäre eine verschiebbare
   Frontlinie statt eines zweiten Kontrollpunkts das bessere Bild?

---

## Quellen im Repo

`CLAUDE.md` · `docs/design/stand-aller-disziplinen.md` · `docs/design/arena-mini-dm-tdm-battlefield-
rollout-plan.md` · `docs/design/arena-zielwahl-umsetzung.md` · `docs/design/arena-tempo-
schlagfrequenz.md` · `docs/design/arena-duell-recherche-fable.md` · `docs/design/mini-dm-4-team-
ffa-recherche-06-09.md` · `docs/design/mini-dm-spielplan-umsetzung-14-09.md` · `docs/design/
arena-minigames-opus-konzeptreview-26-09.md` (Branch `arena-minigames-konzeptreview-26-09`) ·
`docs/design/i-spy-schatzsuche-konzept-21-09.md` · `docs/design/i-spy-fable-reaktionskanal-22-09.md`
· `docs/design/i-spy-opus-konzeptreview-26-09.md` · `docs/design/i-spy-p1-prototyp-befund-26-09.md`
· `docs/design/mutator-trait-organische-performance-konzept-29-09.md` ·
`docs/design/broadcast-praesentation-runde-2-22-09.md` · Commits `ac38f6fb` (TDM-Respawn),
`466ef952` (Mini-DM-Live-Reveal), `58ef0035` (Highlight-Cooldown), `8ddaf756`/`1656b9dc`
(Broadcast Phase 3/4) · `public/mockups/battle-mode.engine.js` (`main` `42358ca6`), Stellen wie im
Kopf angegeben.

Externe Vorbilder, ohne neue Recherche, als bekannt vorausgesetzt: Respawn-Wellen (Overwatch,
Halo, Battlefield), KAST/Trade (Counter-Strike-Statistik), Vergeltungs-Zielwahl und Zone (Battle
Royale, Smash), Joker (Quiz-/Show-Formate), Tauziehen-Front (Tug-of-War-Modi in Splatoon/Halo
„Assault"), Clank! (Lärm), Nicholson 2015 (Meta-Rätsel), Cluedo (Wer/Wo/Womit).
