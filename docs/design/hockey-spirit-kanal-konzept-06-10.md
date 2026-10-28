# Hockey: ein echter Kanal für Spirit (06.10., Konsultation, kein Code)

Chris, sinngemäß zur Pp-Pflichtprüfung: „musst du wenn spirit benötigt wird aber das noch fehlt"
einen Weg finden. Hintergrund ist die dedizierte Hockey-Pp-Rezeptrunde vom 06.10.
(`docs/design/stand-aller-disziplinen.md`, Siebzehnter und Achtzehnter Nachtrag; Commits
`2b3e89de`/`9392b0e6`): zwei Runden in Folge haben Hockeys Pp-Abweichung von 52,1/46,1 auf
31,7/31,7 gedrückt — über die Strafen-Fix-Einführung (V5, Siebzehnter Nachtrag) und eine
AUFBAU/LAUFTEMPO-Nachjustierung (Achtzehnter Nachtrag), die rho und die Star-/Paartreue-Kennzahlen
sogar klar verbessert hat (Saison kaderfest 0,839→0,882, Star Rang1 51,7%→63,3%). Die 25-Pp-Schranke
bleibt trotzdem verletzt, und beide Runden benennen denselben Rest: **Spirit ist mit -7,0/-6,4 Pp
gegen sein Matrixgewicht 12 der mit Abstand größte verbleibende Einzelposten** — und jeder bisher
geprüfte Hebel (Verstärkung in `ABSCHLUSS`, Umschichtung in `AUSDAUER`) wurde GEMESSEN UND
VERWORFEN, weil er entweder rho kostet oder mechanisch zu schwach ist, um etwas zu bewegen.

**Was dieses Papier ist:** eine Konsultation, keine Umsetzung. `public/mockups/battle-mode.engine.js`
und `battle-mode.rezepte.js` sind unangetastet. Alles unten ist Recherche und Konzept — jede der
drei Optionen ist mindestens Klasse B (echte Mechanik) und braucht Chris' ausdrückliches Ja, bevor
auch nur eine Zeile Code entsteht, dazu die volle rho-/Pp-Abnahme aus CLAUDE.md.

---

## Kurzfassung

1. **Warum die bisherigen Kanäle nicht reichen — nachgewiesen, nicht vermutet.** Spirits einzige
   zwei mechanischen Heimstätten in Hockey sind `ABSCHLUSS` (18 %, bereits auf Power nachjustiert,
   weil Spirit auf dem Testkader mit rho -0,34 zur Eignung korreliert) und `TEAMGEIST` (47 %
   Rezeptanteil — aber TEAMGEIST wurde bei der Erfolgskurven-Migration 02.09. ausdrücklich AUS
   Hockeys eigener Trefferformel gestrichen und wirkt dort praktisch gar nicht mehr; es bleibt nur
   in der Passziel-Auswahl). Ein dritter, winziger Anteil sitzt in `AUSDAUER` (4 %), das nur die
   Sturzwahrscheinlichkeit EINES Bodychecks steuert — zu schwach, um etwas zu bewegen (gemessen:
   ein Tausch stamina↔spirit dort machte Pp SCHLECHTER, nicht besser, Achtzehnter Nachtrag Punkt 2).
2. **Zwei strukturell ähnliche Fälle als Vorbild/Kontrast.** Basketball (Matrixgewicht 22, gemessen
   19,9–23,8 % mechanisches Gewicht — bestanden) verteilt Spirit dünn über SIEBEN Sub-Skills
   gleichzeitig. Football (Matrixgewicht 25, das höchste Einzelattribut der Disziplin) konzentrierte
   Spirit versuchsweise in seinem dominanten Kanal (`TEAMGEIST`, 44,5 % Rezeptgewicht) — und schon
   der kleinste sinnvolle Nachschlag (8 %) riss rho von 0,805 auf 0,788
   (`football-rezept-sondierung-awareness-ausdauer-spirit-02-10.md`, Abschnitt 4). **Hockey hat
   denselben Fehler gemacht wie Football, nicht den wie Basketball**: Spirit sitzt in zwei bereits
   großen/dominanten Kanälen statt dünn über viele kleine.
3. **Drei echte Sport-Mechaniken, die zu Spirit passen — und warum nicht alle gleich gut passen.**
   Siehe Abschnitt 3. Empfehlung: **K-Schock** (Resilienz-Fenster nach einem Gegentor).
4. **Die Leitplanke, die alle drei Optionen gemeinsam respektieren:** keine davon rührt `ABSCHLUSS`,
   `TEAMGEIST`, `AUFBAU` oder `LAUFTEMPO` an. Die ersten beiden sind gemessen ausgereizt, die
   letzten beiden wurden gerade erst (Achtzehnter Nachtrag) neu kalibriert — ein weiterer Eingriff
   dort würde die gerade gewonnene Stabilität (Spannweite zwischen den Saatströmen 9,3→0,0) wieder
   aufs Spiel setzen, ohne dass diese Runde das geprüft hätte.

| # | Konzept | Primärweg | Nebenweg | Klasse | Aufwand | Kollision mit V5/AUFBAU-LAUFTEMPO |
|---|---|---|---|---|---|---|
| **K-Schock** | Resilienz-Fenster nach Gegentor | spirit | determination, will | B | klein–mittel | keine, wenn auf `ABWEHR`/Zweikampf statt `AUFBAU` gescopt |
| K-Nerven | Penaltyschuss-/Verlängerungs-Nervenstärke | spirit | technik | B + **T** (+C für Verlängerung) | groß (braucht K6/K7 zuerst) | keine — aber auch fast keine Spielhäufigkeit |
| K-Linie | Captain-Lift für die Schicht | spirit | determination, will | B (+ M) | mittel | hoch — dauerhafter Multiplikator auf Zweikampf-/Aufbau-nahe Kanäle |

---

## 1. Was Spirit in diesem Projekt ist — und wie andere Disziplinen es nutzen

### 1.1 Die Definition im Code

Spirit ist kein reines „Willens"-Attribut wie `will` oder `determination`. Der Generator
gewichtet es überwiegend sozial, ein Fünftel mental, und kaum körperlich:

```
spirit: { pow: 0.04, spe: 0.05, men: 0.28, soc: 0.63 }   // lib/player-generator/player-generator-service.ts:204
```

In der Scouting-Oberfläche steht es mit `axis:"soc"` neben `charisma` und `determination`
(`lib/market/transfermarkt-attribute-filter.ts:43`), mit `tone:"mental"` und erst auf
`revealLevel 3` sichtbar (`lib/market/transfermarkt-scouting.ts:76`) — ein Attribut, das sich
nicht aus der Statistikzeile ablesen lässt, sondern sich erst im Spiel zeigt. Das deckt sich mit
der realen Bedeutung, die dieses Papier aufgreift: nicht rohe Willenskraft (dafür gibt es
`will`/`determination`), sondern **Mentalität im sozialen Kontext** — Nervenstärke unter
Beobachtung, Fassung nach einem Rückschlag, Wirkung auf die Mitspieler. Archetypen bestätigen das:
der Captain/Anführer-Typ trägt `attributeBias:{spirit:10,charisma:8,will:7,torment:-8}`
(`player-generator-archetypes.ts:187`), der Entertainer `{charisma:12,spirit:8,...}` (:112) — Spirit
gehört zur sozialen Führungsfigur, nicht zum stillen Kämpfer.

### 1.2 Vorbild: Basketball — Spirit dünn über sieben Kanäle

Basketballs Matrixgewicht für Spirit ist 22, das zweithöchste Attribut der Disziplin, und es wird
GEMESSEN eingelöst (19,9–23,8 % mechanisches Gewicht, bestanden). Der Grund liegt im Rezept
(`battle-mode.rezepte.js`, Basketball-Block): Spirit sitzt in AUFBAU (4), ABSCHLUSS (22),
TECHNIK (16), SCHUSS_NAH (30), SCHUSS_FERN (16), ZWEITCHANCE (20), TEAMGEIST (44) und AUSDAUER
(22) — **acht von zehn Sub-Skills**, nirgends dominant, überall ein Achtel bis ein Drittel. Kein
einzelner Kanal trägt die ganze Last, und ein Spieler mit hohem Spirit ist „per Rezept praktisch
nicht als reiner Verteidiger baubar" (Rezeptkommentar), weil er überall ein bisschen mitzieht.
**Das ist die Lehre für Hockey:** die Lösung für ein unterrepräsentiertes Attribut mit hohem
Matrixgewicht ist selten EIN neuer, großer Kanal, sondern viele kleine.

### 1.3 Kontrast: Football — derselbe Fehler, den Hockey heute macht

Football hat mit Matrixgewicht 25 das höchste Einzelattributgewicht der ganzen Disziplin für
Spirit — und 0 % gemessenes mechanisches Gewicht. Die Sondierung vom 02.10.
(`football-rezept-sondierung-awareness-ausdauer-spirit-02-10.md`) hat genau das versucht, was für
Hockey naheliegend wäre: Spirit in den eigenen, bereits dominanten `TEAMGEIST`-Kanal (44,5 % des
gesamten Rezeptgewichts) nachschlagen. Ergebnis bei n=24, kaderfest:

| TEAMGEIST-Variante | rho je Spiel | Abnahme |
|---|---:|---|
| `{health:45,torment:30,speed:25}` (unverändert) | 0,805 | bestanden |
| `{health:45,torment:22,speed:25,spirit:8}` | 0,788 | **durchgefallen** |
| `{health:38,torment:22,speed:25,spirit:15}` | 0,765 | **durchgefallen** |

Schon der kleinste sinnvolle Nachschlag reißt rho unter die Schranke. Football hat sich daraufhin
bewusst entschieden, Spirit bei 0 % zu belassen, mit vollständigem Messbeleg statt einer stillen
Ignoranz. **Hockey steht strukturell genau hier**, nur eine Stufe besser: statt 0 % trägt es ein
wenig über `ABSCHLUSS`, aber der Haupthebel (`TEAMGEIST`, 47 % Rezeptanteil) ist mechanisch schon
tot, bevor man überhaupt daran dreht — nicht weil ihn ein Test zerstört hat, sondern weil sein
Koeffizient aus der eigenen Trefferformel ausdrücklich entfernt wurde (`battle-mode.engine.js`,
Kommentar „skillTerme OHNE TEAMGEIST", s. Abschnitt 2.1). **Die Konsequenz für diese Runde: eine
weitere Erhöhung in ABSCHLUSS oder TEAMGEIST ist bereits geprüft bzw. durch den
Football-Präzedenzfall hochriskant — es braucht etwas NEUES, nicht mehr Gewicht auf Altem.**

### 1.4 Ein Weg, der schon einmal versucht und von Chris abgelehnt wurde

Eine frühere Planungsrunde hatte für Hockeys B.2-Rezeptplan einen zwölften Sub-Skill namens
`LINIENSPIEL` vorgesehen (spirit 75 % Anteil, `hockey-rollout-plan.md` B.2/B.3) — Vorlagen/Chemie
in der Reihe. Beim tatsächlichen Bau wurde er durch `TEAMGEIST` ersetzt (1:1 von Basketball geerbt)
und dann wieder gestrichen, mit einer ausdrücklichen Klarstellung im Code:

> „Chris hat NICHT 'Linienspiel' beauftragt (das war eine Erfindung einer früheren Planungsrunde,
> s. Bericht) — TEAMGEIST wird ERSATZLOS gestrichen, nicht durch einen neuen Sub-Skill ersetzt."
> (`battle-mode.engine.js`, Kommentar bei der Erfolgskurven-Migration)

**Diese Konsultation schlägt deshalb an keiner Stelle „Linienspiel" oder eine andere
Chemie-/Vorlagen-Mechanik vor.** Das wäre keine neue Idee, sondern die bereits einmal verworfene,
unter neuem Namen. Alle drei Optionen unten sind etwas anderes: keine Passqualität, sondern
Nervenstärke unter Druck.

---

## 2. Recherche: echtes Eishockey und reale Sportpsychologie

### 2.1 Was im Motor heute mit „Teamgeist"/Mentalität passiert

`TEAMGEIST` bleibt in `qualitaet()`/`offensterMitspieler` (Chemie als attraktives Anspielziel) und
in `hockeyPassQualBonus` — es beeinflusst also weiterhin, WER angespielt wird, nicht, ob der Schuss
sitzt. Das ist die „Inversions-Falle", die die Migration ausdrücklich benannt hat: ein hoher
TEAMGEIST-Wert machte denselben Spieler zugleich zum bevorzugten EMPFÄNGER statt zum Passgeber
(rho -0,86 bis -0,90 zu Assists in der alten Messung). Für eine neue Spirit-Mechanik heißt das:
**nicht an Passzielen oder Vorlagen ansetzen** — das Terrain ist vermint.

### 2.2 Resilienz nach einem Gegentor — die sportwissenschaftliche Grundlage

Eine systematische Übersicht zu „Responses to scoring or conceding the first goal" (Sport
Science Library, zitiert über `lida.sport-iat.de`) hält fest, dass die Leistung nach einem
Torereignis maßgeblich davon abhängt, **wie gut die zurückliegende Mannschaft ihren Nachteil
kontert** — nicht ob sie es tut, sondern wie schnell. Eine aktuelle Analyse in *Frontiers in
Sports and Active Living* (2023) zu Spielzustands-Effekten bestätigt, dass unmittelbare
Reaktionsmuster nach Toren ein eigenständiges, messbares Phänomen sind. Aus der Trainerpraxis
(zusammengefasst auf icehockeyman.com, „Managing the Shift After Conceding a Tying Goal"): die
Schicht direkt nach einem Gegentor ist **emotionale Eindämmung** — einfache Entscheidungen, das
Gefühl zurückholen, dass das Spiel noch kontrollierbar ist, bevor man wieder normal spielt. Das
ist exakt die Beschreibung einer **Fassungs-/Resilienzgröße**, kein Schuss- oder Passskill.

Eine zweite, gegenläufige Erkenntnis aus derselben Recherche-Richtung: nach einem **eigenen** Tor
gibt es laut einer NHL-Analyse einen nachweisbar **nachteiligen** Hot-Hand-Effekt — Mannschaften
neigen danach zu überhasteten, unbegründeten Abschlüssen. Übertragen auf Spirit heißt das: eine
Resilienzgröße ist keine reine „Bonus bei Führung"-Mechanik, sondern in erster Linie eine
**Schadensbegrenzung bei Rückstand**, und ein Übermaß an Selbstüberschätzung nach einem eigenen
Tor kann ebenso gut schaden wie Fassungslosigkeit nach einem Gegentor.

### 2.3 Nervenstärke im Shootout — die stärkste Einzelevidenz für ein „Nerven"-Attribut

NHL-Shootout-Statistiken zeigen eine enorme, person-gebundene Streuung, die nicht mit der
allgemeinen Torgefährlichkeit eines Spielers zusammenfällt: T.J. Oshie trifft 52,3 % seiner
Versuche (einer von nur drei Spielern mit ≥50 Versuchen über 50 %, neben Tyler Seguin 50,9 % und
Erik Christensen 52,7 %), während Brad Marchand — ein deutlich gefährlicherer Scorer im
Normalspiel — nur 21,6 % trifft. Steven Stamkos, ein Elite-Torschütze im Fünf-gegen-fünf, ging in
einer Saison 0-für-7 im Shootout. Das ist die sauberste reale Trennung zwischen „kann im
Normalspiel treffen" und „kann es unter Einzelkampf-Druck, ohne Verteidiger, mit allen Augen
darauf, auch treffen" — und damit die stärkste Evidenz aller hier recherchierten Mechaniken für
ein eigenständiges Nerven-/Spirit-Attribut, unabhängig vom Schusstechnik-Skill.

### 2.4 Undiszipliniertheit nach einer strittigen Entscheidung

Die NHL kennt ein reales Gegenstück zu „Verhalten nach kontroversen Schiedsrichterentscheidungen":
automatische Strafen für sichtbare Frustration (z. B. weggeworfene Ausrüstung nach einem
übersehenen Pfiff) und einen eigens benannten Instigator-Zuschlag für Vergeltungsaktionen in der
Schlussphase. Das Muster ist real und gut dokumentiert — aber es ist strukturell dasselbe
Terrain wie K3 (die bereits gebaute, TECHNIK-geführte Strafneigung aus V5): eine zweite
Foul-Wahrscheinlichkeit, nur mit Spirit statt TECHNIK als Treiber. Eine zusätzliche
„Retaliations-Strafe" würde entweder mit K3 um dieselbe Wurf-Stelle konkurrieren oder bräuchte
einen komplett neuen Zustand („wurde diese Mannschaft gerade sichtbar benachteiligt gepfiffen?"),
der im Motor heute nicht existiert. Deshalb wird daraus unten **keine eigene Option**, sondern nur
dieser Hinweis: falls eine künftige Runde das trotzdem bauen will, muss sie explizit gegen K3
messen, nicht danebenstellen.

### 2.5 Mentale Stärke als Teamgröße — die schwache und die belastbare Evidenz

Die Mental-Toughness-Forschung (häufig über den MTQ48-Fragebogen: Confidence, Commitment, Control,
Challenge) findet in mehreren Studien einen signifikant positiven Zusammenhang zwischen mentaler
Stärke und Teamleistung — eine reale, breite Stütze für „Spirit zahlt sich fürs Team aus", aber auf
Teamebene gemessen, nicht als Beleg für einen bestimmten Mechanismus. Zur Kapitänsfrage dagegen,
ehrlich recherchiert: es gibt **keine** belastbare quantitative Studie, die zeigt, dass das Tragen
des „C" selbst eine messbare On-Ice-Wirkung hat — die Fachpresse selbst schreibt dazu „there is no
tangible way to prove one player wearing the C instead of another leads to more victories". Das ist
wichtig für Abschnitt 3.3 (K-Linie): die thematisch naheliegendste Idee hat die schwächste reale
Evidenz von allen dreien.

---

## 3. Drei Mechanik-Optionen

Leitplanken für alle drei, identisch zum Nachtkonzept-Papier vom 03.10.: Matrix unangetastet, kein
neuer `rr()`-Aufruf, wo ein deterministischer Zustand reicht; KI-Vorgaben aus dem Kader, nie aus
`eig`; jede Mechanik hinter einem eigenen Feld in `FELDSPIEL_ART.hockey` (Muster `strafenFix`),
damit Basketball/Football bit-identisch bleiben; Primär-/Nebenweg wo immer möglich (CLAUDE.md,
„mehrere Wege zum Erfolg").

### K-Schock — Resilienz-Fenster nach einem Gegentor (empfohlen)

**Bild.** Ein Team kassiert ein Tor. Für die nächsten Sekunden/den nächsten Zweikampf in der
eigenen Zone ist die Mannschaft sichtbar „geschockt" — Pässe werden hastiger, der erste Rückgewinn
gelingt seltener. Spieler mit hohem Spirit fangen sich schneller: der Ticker zeigt „Draco sammelt
die Reihe" statt eines zweiten schnellen Gegentors. Das Gegenstück zu Chris' eigenem
Gewichtheben-Bild („unter dem Druck einbrechen oder sich übertreffen") — hier als Einbruch nach
einem Rückschlag, nicht vor einem Versuch.

**Mechanik (Konzept).** Beim Tor-Ereignis (`loeseHockeySchuss`, Tor-Zweig) wird für die
kassierende Seite ein Zustand gesetzt, z. B. `schockBisTick` (aktueller Tick + feste Fensterlänge,
Größenordnung 10–20 Game-Sekunden, zu kalibrieren). Solange dieser Zustand aktiv ist, wird GENAU
EIN bestehender Erfolgswurf in der eigenen Zone — der Zweikampf/Rückgewinn in `versucheSteal`
bzw. der Block in `ABWEHR`, **nicht** `AUFBAU` — mit einem Faktor multipliziert, der aus dem
Spirit des beteiligten Spielers kommt (Primärweg), mit einem kleineren Einfluss von
determination/will (Nebenweg, z. B. 70/20/10-Aufteilung). Kein neuer `rr()`: derselbe Wurf, eine
veränderte Schwelle, exakt das Muster von K3 (Strafneigung über TECHNIK). Der Zustand läuft
automatisch ab (`schockBisTick` überschritten) oder wird vom nächsten eigenen Tor überschrieben.

**Warum NICHT `AUFBAU`.** Der naheliegendste Ort für „Panik nach dem Gegentor" wäre der
Zonenaustritt selbst (`AUFBAU`) — aber genau dieser Kanal wurde im Achtzehnten Nachtrag frisch
nachjustiert (stamina 57→40, die Reproduzierbarkeit zwischen den Saatströmen ist jetzt
Spannweite 0,0). Eine zusätzliche, bedingte Modifikation an derselben Stelle macht jede künftige
Pp-Messung an `AUFBAU` zweideutig: wessen Bewegung war das, die Rezeptänderung oder der neue
Schockzustand? **K-Schock scoped deshalb bewusst auf den Zweikampf/Block (`ABWEHR`), nicht auf
den Breakout.**

**Primär-/Nebenweg.** Primär: spirit (Fassung). Nebenweg: determination (durchbeißen trotz
Rückstand) und will — beide Matrixgewicht 4, heute dünn vertreten (`ABWEHR` führt bereits speed/
health/will/determination/power/torment, s. aktuelles Rezept) und bekommen durch den Nebenweg
nebenbei etwas mehr Gewicht, ohne einen neuen Sub-Skill zu brauchen.

**Aufwand:** klein bis mittel — ein neuer Zustand pro Seite, ein Lesepunkt in einer bestehenden
Erfolgsformel, keine neue Formation, kein neuer Boxscore-Posten zwingend nötig (könnte aber als
„Fassung nach Gegentor gehalten" sichtbar gemacht werden, A*-Ergänzung).

**Klasse:** B (echte Mechanik, Chris' Ja + volle Abnahme nötig).

**Erwartete Pp-Wirkung.** Sollte Spirits -7,0/-6,4-Rest spürbar schließen, weil es der erste
Kanal ist, der NICHT in einem der beiden bereits ausgereizten Töpfe (ABSCHLUSS, TEAMGEIST) sitzt —
genau das Argument, das Basketballs Erfolg (viele kleine Kanäle) und Footballs Scheitern
(ein großer, bereits dominanter Kanal) beide stützen. Gleichzeitig ist das Fenster SELTEN genug
(ein Gegentor ist ein seltenes Ereignis, ca. 5 je Team und Spiel laut der Hockey-Nachtkonzept-
Basislinie von 10,4–10,5 Toren/Spiel insgesamt), um nicht wie der Football-Fall den größten Teil
aller Ereignisse neu zu gewichten — das ist dieselbe Logik, die Basketballs vorgeschlagenen
Freiwurf-Kanal (`fable-ideen-feldspiel-30-09.md`, B2) als „die eine Stelle, an der ich für
Basketball eine Bewegung nach oben für plausibel halte" einstuft: seltene, aber hoch
eignungsnahe Ereignisse heben Validität, ohne die Masse der Ereignisse zu verzerren.

**Kollisionscheck mit V5 und AUFBAU/LAUFTEMPO.** Keine direkte Kollision, wenn der Scope wie oben
auf `ABWEHR` begrenzt bleibt. Eine ehrliche offene Frage bleibt: ein Gegentor WÄHREND der eigenen
Unterzahl (V5-Zustand) würde beide Zustände gleichzeitig aktiv haben — Schock UND
Strafneigungs-Modifikator. Das ist kein bekannter Fehler, nur eine ungemessene Überlagerung; die
Abnahme muss diesen Fall explizit mitmessen (ein Gegentor in Überzahl ist nach der V5-Tabelle mit
19–22 % je Strafe nicht selten). AUFBAU/LAUFTEMPO bleiben vollständig unberührt.

### K-Nerven — Penaltyschuss-/Verlängerungs-Nervenstärke

**Bild.** Standbild, alle an der Bande, ein Schütze gegen den Torwart — der Moment mit der
stärksten realen Evidenz für ein eigenständiges Nerven-Attribut (Abschnitt 2.3: Oshie 52 % gegen
Marchand 22 %, derselbe Liga-Torschütze). Ein Spirit-geführter Erfolgswurf würde genau diesen
Unterschied — „kann im Fünf-gegen-fünf treffen" vs. „kann es auch 1-gegen-1 unter Beobachtung" —
mechanisch abbilden.

**Mechanik (Konzept).** Setzt K6 (Penaltyschuss bei Foul im Durchbruch) und/oder K7 (Verlängerung
3-gegen-3 + Penaltyschießen) voraus — beide existieren heute NUR als Konzept im
Nachtkonzept-Papier vom 03.10., beide dort als **Klasse T** eingestuft („nur Chris persönlich
entscheidet", „nicht zum Bau empfohlen ohne Chris' ausdrückliche Zustimmung"). Ein Spiel endet im
Motor heute mit „Schlusssirene — Unentschieden"; es gibt keine Verlängerung und keinen
Penaltyschuss. Die Nervenstärke-Formel selbst wäre simpel (ABSCHLUSS/TECHNIK gegen PARADE, Spirit
als dritter, primärer Faktor, Zielquote verankert an der realen ~32-%-Basis aus der
Nachtkonzept-Recherche), aber sie ist nur das letzte Glied einer Kette, die bei zwei offenen
Klasse-T-Entscheidungen beginnt.

**Primär-/Nebenweg.** Primär: spirit (Nerven im Einzelduell). Nebenweg: die bestehende
TECHNIK/ABSCHLUSS-Qualität (ein Spieler mit großartiger Technik, aber schwachen Nerven, trifft
seltener als seine Normalquote vermuten lässt — und umgekehrt).

**Aufwand:** groß — zwei vorgelagerte, von Chris noch nicht entschiedene Klasse-T/C-Fragen (K6,
K7), dann erst die eigentliche Spirit-Formel.

**Klasse:** B + **T** (Sendezeit/Spielablauf, K7 zusätzlich **C**, weil es das Unentschieden aus
der Tabelle streicht).

**Erwartete Pp-Wirkung — mit einem wichtigen Vorbehalt.** Von allen drei Optionen hätte diese die
sauberste reale Evidenz UND die geringste Kollisionsgefahr (ein komplett separater Spielzustand,
der keinen bestehenden Kanal berührt). Der Haken ist CLAUDE.mds eigene oberste Leitplanke: **die
Abnahme gilt für EIN Spiel, weil eine Saison nur zwei Hockey-Partien enthält.** Ein Penaltyschuss
ist real selten (laut Nachtkonzept-Recherche rund 50 je NHL-Saison bei 1312 Spielen — deutlich
unter einem Ereignis pro Partie), und eine Verlängerung tritt nur bei einem Unentschieden nach
regulärer Zeit auf. **Eine Mechanik, die in einem gegebenen Einzelspiel mit hoher
Wahrscheinlichkeit gar nicht auftritt, kann nicht die tragende Antwort auf einen
Pp-Pflichtbefund sein, der im Mittel über n=48 gemessen wird, aber inhaltlich die
Einzelspiel-Abnahme stützen soll** — sie mag die gemessene Pp-Durchschnittszahl über viele Spiele
leicht senken, trägt aber in der übergroßen Mehrheit der einzelnen Partien, auf die es laut
CLAUDE.md ankommt, exakt nichts bei.

**Kollisionscheck.** Keine mit V5 oder AUFBAU/LAUFTEMPO — das ist ihr einziger klarer Vorteil.

### K-Linie — Captain-Lift für die Schicht

**Bild.** Der Spieler mit dem höchsten Spirit auf dem Eis ist der informelle Anführer der
Schicht — exakt das Bild, das der Aufstellungsbildschirm heute schon verspricht
(`matchday-slot-roles.ts`, Hockey-Rolle `captainline`: „Hebt die Reihe über Spirit"), aber
mechanisch bisher NICHT einlöst: diese Rollentexte sind reine Anzeige, ohne Gewicht im Motor.

**Mechanik (Konzept).** Beim Aufstellen der Schicht wird der Spieler mit dem höchsten Spirit als
„Captain" markiert (automatisch, oder vom Manager setzbar — eine M-Erweiterung analog zu K2s
Überzahl-Einheit). Solange er auf dem Eis steht, erhalten die Mitspieler seiner Schicht einen
kleinen, konstanten Aufschlag auf einen Zweikampf-/Technik-nahen Erfolgswurf (z. B. `ABWEHR` oder
`PUCKFUEHRUNG`-äquivalent), proportional zu seinem Spirit-Wert.

**Primär-/Nebenweg.** Primär: spirit des Captains. Nebenweg: determination/will als schwächerer
Ersatz, FALLS kein auffällig hoher Spirit-Wert im Kader steht. Charisma wäre inhaltlich
naheliegend, aber Hockeys Matrixgewicht für charisma ist 0 — ein Nebenweg über charisma würde die
Pp-Abweichung eines komplett unbeteiligten Attributs aufblähen, ohne Nutzen. Deshalb bewusst
NICHT charisma.

**Aufwand:** mittel — ein dauerhafter, nicht ereignisgebundener Modifikator, der für die gesamte
Eiszeit der Schicht aktiv ist (anders als K-Schocks kurzes Fenster oder K-Nervens seltenes
Sonderereignis).

**Klasse:** B (+ M, falls der Manager den Captain selbst wählen darf, analog K2/K3).

**Erwartete Pp-Wirkung — mit dem größten Risiko der drei Optionen.** Real ist die Evidenz für
einen quantifizierbaren „Captain-Effekt" schwach (Abschnitt 2.5: „no tangible way to prove"). Und
strukturell ist K-Linie die einzige der drei Optionen, die — wie das gescheiterte
Football-TEAMGEIST-Experiment und die bereits beobachtete AUSDAUER-Umschichtung — einen
**dauerhaften, nicht seltenheitsgeschützten** Kanal anfasst: der Lift wirkt in JEDER Schicht, nicht
nur in einem engen Zeitfenster. Genau dieses Muster — große, bewegungs-/zweikampfnahe Kanäle
pervasiv verschieben — ist es, wovor der Sinkhorn-Post-Mortem in `battle-mode.rezepte.js`
ausdrücklich warnt, und wovor der Achtzehnte Nachtrag selbst warnt (eine Gewichtsverschiebung in
einem großen Kanal ändert die relative Prominenz ALLER anderen Kanäle mit). Es ist nicht
ausgeschlossen, dass K-Linie funktioniert — aber es ist die Option, die am ehesten denselben
Fehlschlag wiederholt, den diese Runde gerade erst dokumentiert hat.

**Kollisionscheck mit V5 und AUFBAU/LAUFTEMPO.** Hoch. Ein dauerhafter Zweikampf-Aufschlag
überschneidet sich mit `ABWEHR`, das selbst schon in V5s TECHNIK-Strafneigung verwoben ist (ein
härterer, erfolgreicherer Checker nimmt mehr Strafen UND mehr Puckgewinne), und mit dem gerade
erst stabilisierten `AUFBAU`/`LAUFTEMPO`-Paar, falls der Lift — wie naheliegend — auch auf
Zonenaufbau wirken soll. Jede Messung dieser Option muss deshalb gegen den vollen,
bereits eingebauten V5+Achtzehnter-Nachtrag-Stand laufen, nicht gegen eine ältere Baseline.

---

## 4. Empfehlung

**K-Schock (Resilienz-Fenster nach Gegentor).** Drei Gründe, in Reihenfolge ihres Gewichts:

1. **Es ist die einzige Option, die das Problem trifft, das die letzten beiden Runden tatsächlich
   gefunden haben** — ein neuer, von ABSCHLUSS/TEAMGEIST/AUFBAU/LAUFTEMPO unabhängiger Kanal, kein
   weiterer Nachschlag auf einen bereits gemessenen oder bereits frisch kalibrierten Topf.
2. **Es respektiert die Häufigkeits-Leitplanke aus CLAUDE.md besser als K-Nerven.** Ein Gegentor
   ist mit rund fünf Ereignissen je Team und Spiel (gemessene Hockey-Basislinie) häufig genug, um
   in einem EINZELNEN Spiel tatsächlich mehrfach aufzutreten — anders als ein Penaltyschuss oder
   eine Verlängerung, die in den meisten Einzelspielen schlicht nicht vorkommen.
3. **Es respektiert die Seltenheits-Leitplanke besser als K-Linie.** Ein kurzes, ereignisgebundenes
   Fenster trägt weniger Risiko für rho als ein permanenter Multiplikator auf einen
   bewegungszentralen Kanal — exakt die Unterscheidung, die Basketballs Erfolg (dünn verteilt,
   viele kleine Beiträge) von Footballs Scheitern (ein großer, bereits dominanter Kanal) trennt,
   und die K-Linie strukturell auf die falsche Seite dieser Linie stellt.

**K-Nerven** bleibt die inhaltlich eleganteste Idee mit der stärksten realen Evidenz (Abschnitt
2.3) und verdient einen Platz auf der Liste — aber sie hängt an zwei unentschiedenen
Klasse-T-Fragen (K6/K7 aus dem Nachtkonzept vom 03.10.) und würde selbst nach deren Freigabe in
den meisten Einzelspielen nicht feuern. Empfehlung: **erst wenn Chris K6/K7 unabhängig davon
freigibt**, dann die Spirit-Formel als Teil davon nachziehen — nicht als eigener erster Schritt.

**K-Linie** sollte zurückgestellt werden, bis K-Schock gemessen ist. Sollte K-Schock allein nicht
reichen, um unter die 25-Pp-Schranke zu kommen, ist K-Linie der nächste Kandidat — aber mit der
ausdrücklichen Erwartung, dass sie denselben vorsichtigen Dosis-Stufen-Test braucht, den Football
bei seinem TEAMGEIST-Versuch gefahren ist (0 % / kleine Dosis / größere Dosis, jede Stufe einzeln
gegen n=48 geprüft), nicht einen einzigen großen Sprung.

---

## 5. Offene Fragen für Chris

1. **K-Schock als ersten Schritt freigeben?** Umfang wie oben: Fenster 10–20 Sekunden nach einem
   Gegentor, Primärweg spirit auf `ABWEHR`, Nebenweg determination/will, `AUFBAU` unangetastet.
2. **Fensterlänge und Stärke** sind nicht gemessen — eine erste Sondierung (wie bei V5s
   `befreiungFlachX`) müsste mehrere Werte gegeneinander testen, bevor ein PR entsteht.
3. **Soll das Fenster auch bei einem EIGENEN Tor gegenteilig wirken** (Abschnitt 2.2, der
   nachteilige „Hot-Hand"-Befund — Übermut statt Fassungslosigkeit)? Das wäre eine zweite,
   kleinere Erweiterung derselben Mechanik, keine eigene Option.
4. **K6/K7 (Penaltyschuss, Verlängerung):** unabhängig von dieser Konsultation weiterhin offen aus
   dem Nachtkonzept vom 03.10. — eine Freigabe dort würde K-Nerven nachträglich attraktiver machen.
5. **Soll die Captain-Rolle (`captainline`-Slottext) irgendwann mechanisch eingelöst werden** —
   auch wenn nicht als erster Schritt? Falls ja, mit der ausdrücklichen Erwartung einer
   mehrstufigen Dosis-Messung wie beim Football-TEAMGEIST-Versuch.

---

## 6. Was ich nicht geprüft habe

- **Keine Motor-Prototyp-Messung.** Alle drei Optionen sind Konzept, keine davon ist im Motor
  oder in einem Modell gemessen — anders als K1–K4 im Nachtkonzept vom 03.10., das einen
  Scratch-Prototyp gebaut hat. Das wäre der erste Schritt nach Chris' Ja zu K-Schock.
- **Keine Pp-Zahl für K-Schock, K-Nerven oder K-Linie.** Die „erwartete Pp-Wirkung" oben ist
  Analogieschluss aus Basketball/Football, keine Messung an diesem Kader.
- **Die Überlagerung von K-Schock mit dem V5-Unterzahl-Zustand** ist nur als offene Frage benannt
  (Abschnitt 3, K-Schock), nicht untersucht.
- **Reale Zahlen zur Häufigkeit von Fastbreak-Fouls** (Voraussetzung für K6) wurden, wie schon im
  Nachtkonzept vom 03.10. (dortige offene Frage 8.6), nicht gezählt.
- **Die MTQ48-Studien** (Abschnitt 2.5) sind Sekundärzitate aus der Suche, keine selbst gelesenen
  Primärstudien — für eine künftige Bau-Entscheidung lohnt ein direkter Blick in mindestens eine
  der zitierten Arbeiten.

---

## Quellen

- Responses to scoring or conceding the first goal in the NHL — [lida.sport-iat.de](https://lida.sport-iat.de/twm/Record/4022484)
- Frontiers in Sports and Active Living (2023), Spielzustands-/Score-Effekte — [frontiersin.org](https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2023.1241014/pdf)
- icehockeyman.com, „Game Management Lesson 75: Managing the Shift After Conceding a Tying Goal" — [icehockeyman.com](https://icehockeyman.com/2026/09/10/game-management-lesson-75-managing-the-shift-after-conceding-a-tying-goal/)
- 20 years of the shootout in the NHL (Oshie/Seguin/Christensen/Marchand/Stamkos-Zahlen) — [FOX Sports](https://www.foxsports.com/articles/nhl/20-years-of-the-shootout-in-the-nhl-what-to-know-and-who-has-been-the-best)
- Captaincy Question: What's the value of wearing the 'C' in the NHL? (schwache/keine quantitative Evidenz) — [cfjctoday.com](https://cfjctoday.com/2019/09/23/captaincy-question-whats-the-value-having-a-player-wearing-the-c-in-the-nhl/)
- Mental Toughness and Team Performance among Hockey Players (MTQ48) — [ir-library.ku.ac.ke](https://ir-library.ku.ac.ke/items/fcd6e7fc-2a82-453d-a4bf-4c7662fc459b/full)
- NHL-Disziplinarregeln zu Retaliation/Instigator (Kontext für Abschnitt 2.4) — über Suchindex, nicht einzeln tiefengeprüft
- Projektintern: `CLAUDE.md`; `docs/design/stand-aller-disziplinen.md` (Sechzehnter/Siebzehnter/
  Achtzehnter Nachtrag, Commits `032b68a8`/`045db9e6`/`87d26fa1`/`2b3e89de`/`9392b0e6`);
  `docs/design/hockey-nachtkonzept-03-10.md` (K1–K7, Stilvorbild dieses Papiers);
  `docs/design/hockey-rollout-plan.md` (B.2/B.3, Linienspiel-Vorgeschichte);
  `docs/design/football-rezept-sondierung-awareness-ausdauer-spirit-02-10.md` (TEAMGEIST-Fehlschlag);
  `docs/design/fable-ideen-feldspiel-30-09.md` (Basketball-Freiwurf-Kanal B2, Analogie für
  „selten aber eignungsnah"); `public/mockups/battle-mode.rezepte.js` (aktuelles Hockey-Rezept,
  Sinkhorn-Post-Mortem); `public/mockups/battle-mode.engine.js` (TEAMGEIST-Streichung,
  `strafenFix`-Struktur); `lib/player-generator/official-discipline-weights.ts` (Matrix);
  `lib/player-generator/player-generator-service.ts`, `lib/market/transfermarkt-scouting.ts`,
  `lib/market/transfermarkt-attribute-filter.ts` (Spirit-Definition); `lib/lineups/
  matchday-slot-roles.ts` (`captainline`-Rollentext, heute rein narrativ).

**Klassen in diesem Papier**, identisch zum Nachtkonzept vom 03.10.: **A** reine Anzeige; **A\***
Anzeige mit kleiner Buchhaltung; **B** echte Mechanik innerhalb der Sendung, braucht Chris' Ja und
die volle rho-/Pp-Abnahme; **C** berührt Wertung/Tabelle; **M** neues Eingabefeld im Spieltag oder
Kaderstruktur; **T** Sendezeit/Spielablauf — nur Chris persönlich entscheidet.
