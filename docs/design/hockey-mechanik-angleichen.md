# Hockey auf den Basketball-Stand heben — was umgesetzt wurde und was offen bleibt

Auftrag: Hockey auf denselben Stand bringen, den Basketball gerade bekommen hat, auf Basis
zweier bereits fertiger Recherche-Berichte (`hockey-impact-verteilung-recherche-fable.md`,
`hockey-archetypen-probe.md`). Umsetzung + Messung, keine neue Recherche. Branch
`claude/hockey-mechanik-angleichen`, abgezweigt von `origin/claude/sonde-alle-disziplinen`.

Reihenfolge wie verlangt: erst der isolierte Torwart-Bug (A), dann die 7-Schritt-Liste aus
dem Impact-Bericht (B), mit Zwischenmessung nach jedem größeren Schritt — nicht alles auf
einmal geändert und erst am Ende gemessen.

---

## A) Der isolierte Bug: Torwart-Auswahl

`bestimmeTorwaerter()` bevorzugte jeden Spieler, dessen `slotId` in `TORWART_SLOTS` lag —
aber `slotFuer()` vergibt diesen Slot auch über den reinen Rundlauf-Rückfall
(`i % slotListe.length`), wenn keine Aufstellung gesetzt ist. Bei Hockeys Slotliste liegt
`goaltender` zufällig an Index 2: der DRITTE Spieler im Kaderarray wurde damit automatisch
Torwart, unabhängig von PARADE — exakt der Befund aus `hockey-archetypen-probe.md`,
Abschnitt 4.

**Fix:** `slotFuer()` gibt jetzt zusätzlich zurück, ob der Slot aus einer echten
Manager-Aufstellung (`place[]`) stammt oder aus dem Rundlauf (`slotGesetzt`).
`bestimmeTorwaerter()` respektiert nur noch die echte Zuweisung; ohne Aufstellung fällt es
immer auf den besten PARADE-Wert im Kader zurück.

| Zahl (`miss-hockey-archetypen.mjs 48`) | vorher | nachher |
|---|---:|---:|
| Verschiedene Torwart-Identitäten im Lauf | 2 | 6 |
| Spearman(Eignung, GSAA) gepoolt | 0,026 | 0,128 |
| Gepaarter Pro-Spiel-Vergleich (höhere Eignung → bessere GSAA) | 47,9 % | 62,5 % |

Von Null verschieden — der Auftrag für Schritt A ist erreicht. (Nach den Schritten B1-7 ist
diese Zahl wieder gesunken, s. unten — dazu mehr im Abschnitt "Was schlechter aussieht".)

---

## B) Die 7-Schritt-Liste aus dem Impact-Verteilung-Bericht

Alle sieben Punkte aus Abschnitt 5 des Berichts umgesetzt bzw. — wo durchgemessen und
schädlich — bewusst wieder verworfen:

1. **Passqualitäts-Kette** (`hockeyPassQualBonus`, Hockey-Zweig von `technikMake`): ein
   Schuss binnen `ASSIST_FENSTER` nach einem Pass bekommt einen additiven Qualitätsterm,
   gestaffelt nach Passgeometrie (`klassifiziereHockeyPassGeometrie`: quer durch den Slot
   > hinter dem Tor > sonst), skaliert mit AUFBAU des Passgebers, gedämpft von der ABWEHR
   des nächsten Verteidigers an der Passlinie (`passeAb` hält jetzt `passLinienAbwehr`
   fest). **Größenordnung nachträglich gesenkt:** die erste Fassung (0,14/0,06/0,02 vor
   Skalierung) drückte `mitte` in `steilerMake` bei Nahdistanz-Schüssen regelmäßig gegen
   den Sättigungsdeckel — dieselbe Falle, vor der ein Motorkommentar beim verworfenen
   Basketball-Assist-Bonus schon einmal warnt — und drehte die Sniper-Probe (SCHUSS_NAH)
   ins Negative. Auf ein Drittel gesenkt (0,05/0,025/0,01), nachgemessen wieder im grünen
   Bereich.
2. **Abpraller in die Ecke** (`loeseHockeySchuss`): ein Abpraller landet jetzt überwiegend
   seitlich Richtung Bande/hinter dem Tor statt immer 18-52 px frontal vor dem Tor; der
   PARADE-abhängige Slot-Anteil (`HK_ABPRALLER_SLOT_*`, Basis 25 %, sinkt mit PARADE bis
   auf 8 %) bricht die Schleife „Puck gewinnen, aus 58 px schießen, Torwart lässt
   abprallen, Puck liegt wieder da".
3. **Schussanteil als Fähigkeit** (`schwelle` in `entscheideBallaktion`): liest jetzt
   `schussSkillFuer(u,tier)` — ein starker Schütze im eigenen Tier zieht früher ab. Der
   zweite, im Bericht vorgeschlagene Teil (Passwahl in `offensterMitspieler` bevorzugt den
   besseren Schützen) wurde gebaut, durchgemessen und **wieder verworfen**: er drehte
   dieselbe Sniper-Probe ins Negative (SCHUSS_NAH-rho 0,30 → −0,25, Terzil-dPp +4,8 →
   −4,4 Pp), vermutlich weil der bevorzugt angespielte gute Schütze im Schnitt
   schlechtere/bedrängtere Gelegenheiten bekam (Verteidigung stellt sich auf ihn ein) —
   dieselbe Selektionsverzerrung, vor der andere Kommentare an dieser Stelle schon warnen.
   Kommentar mit der Messung steht an der Fundstelle. Nebenbefund: die `schwelle`-Änderung
   selbst zeigt gemessen KEINE Wirkung, weil `technikGate` bei normalen Werten (~0,9) weit
   über jeder erreichbaren Schwelle (≤0,42) liegt — derselbe tote Gate-Befund wie bei
   Basketballs TECHNIK im Rollout-Plan. Stehen gelassen (harmlos, dokumentiert), nicht
   entfernt.
4. **Vorlagen aus der Berührungskette** (`merkeBeruehrung`, `fsLive.beruehrungKette`) statt
   aus dem reinen `ASSIST_FENSTER`-Zeitfenster: die letzten bis zu drei Ballbesitzer
   derselben Seite in Folge, geleert bei Seitenwechsel. A1/A2 getrennt gezählt
   (`assists1`/`assists2`) und in `feldspielWert` mit 2,0/1,5 gewichtet (NHL Game Score
   0,7/0,55, auf unsere Tor=3-Skala). `assists` (die Summe) bleibt für Boxscore/Anzeige
   unverändert; `fsBisher()` (Live-Enthüllung) bekam denselben zweiten Vorlagen-Zähler,
   damit die Anzeige während des Spiels nicht von der Endabrechnung abweicht.
5. **Bully als Fähigkeitsduell** (`bully()`): TECHNIK-Duell der zwei nächsten Spieler je
   Seite statt eines Wettlaufs um einen freien Puck über die ZWEITCHANCE-Zweikampf-Logik.
   `checks*0,4` aus `feldspielWert` gestrichen — Hit-Differenzen korrelieren real NEGATIV
   mit Tordifferenzen (Hockey Graphs 2015), der Posten korrelierte bei uns nur deshalb mit
   der Eignung (0,855), weil `wucht` dieselbe ABWEHR/AUSDAUER-Matrix liest wie ABWEHR
   selbst. Ein Check wirkt jetzt nur noch als Taumeln des Getroffenen, nicht mehr als Punkt
   für den Checker.
6. **HK_TOR_SKALA/HK_TW_REF/HK_TW_BASIS nachgezogen** (`scripts/miss-hockey-korridor.mjs`,
   `scripts/sondiere-feldspiel-subskills.mjs`): Schritte 1-5 senkten die Torzahl auf 3,23
   je Team (Ziel 3,5) und hoben die Fangquote auf 91,4 % — schwieriger abzuschließen soll
   nicht automatisch weniger Tore heißen. `HK_TOR_SKALA` 0,425 → 0,46
   (0,425·3,5/3,23), nachgemessen 3,50 Tore je Team. `HK_TW_REF` folgte noch der alten
   Fangquote (0,844) und ließ dadurch jeden Torwart im Mittel besser aussehen, als er ist
   (gemessener Torwart-Mittelwert 11,77 gegen 7,16 bei den Feldspielern) — auf die neu
   gemessene Fangquote (0,907) gezogen, `HK_TW_BASIS` auf den neu gemessenen
   Feldspieler-Mittelwert (7,16). Nachgemessen: Torwart-Mittelwert 7,17 gegen 7,16.
   **Die Sondierung danach** (`sondiere-feldspiel-subskills.mjs hockey 24 0`) — Zahlen und
   Einordnung im Abschnitt darunter.
7. **Dokumentationsfehler korrigiert**: `docs/design/stand-aller-disziplinen.md` Zeile 128
   sagte „auch hier fehlt Verlässlichkeit, nicht Richtigkeit" — das Gegenteil von CLAUDE.md
   (verdoppelte Spielzeit hob Verlässlichkeit 0,755→0,85, rho blieb flach) und der eigenen
   Messung (Pucks Retest 0,997, Tore rho 0,27 zur Eignung). Korrigiert.

---

## Die Sondierung: trägt ZWEITCHANCE jetzt weniger?

`scripts/sondiere-feldspiel-subskills.mjs hockey 24 0`, drei Stände:

| Sub-Skill | Report (vorher) | Nach Fix A | Nach B1-6 (final) |
|---|---:|---:|---:|
| ZWEITCHANCE | 28,9 % | 17,8 % | **12,0 %** |
| TEAMGEIST | 20,2 % | 16,1 % | 17,5 % |
| LAUFTEMPO | 25,0 % | 10,3 % | 14,6 % |
| ABSCHLUSS | 10,5 % | 11,4 % | 12,5 % |
| SCHUSS_FERN | 1,5 % | 10,3 % | 11,6 % |
| TECHNIK | 11,8 % | 5,4 % | 9,1 % |
| ABWEHR | 0 % | 5,6 % | 9,0 % |
| SCHUSS_NAH | 0 % | 4,7 % | 8,8 % |
| AUSDAUER | 0 % | 0 % | 4,4 % |
| AUFBAU | 0 % | 0 % | **0,5 %** |
| PARADE | 2,2 % | 18,5 % | 0 % |

**ZWEITCHANCE ist von 28,9 % auf 12,0 % gefallen — deutlich unter das Viertel, das der
Auftrag als Schwelle für ein neues Rezept nennt.** Das ist der strukturelle Kern-Erfolg
dieser Runde: der lose Puck ist nicht mehr der Kanal, der alles andere dominiert. AUFBAU
liest jetzt 0,5 % statt 0 % — die Passqualitäts-Kette macht AUFBAU zum ersten Mal
mechanisch sichtbar, aber die Zahl ist winzig. Das passt zur Vorsicht bei der Kalibrierung
(Abschnitt 1 oben, Sättigungsfalle): der Kanal existiert jetzt, ist aber klein gehalten,
um die Sniper-Probe nicht wieder zu drehen. TEAMGEIST bleibt mit 17,5 % der größte einzelne
Posten — erwartbar, denn TEAMGEIST geht (wie in `battle-mode.rezepte.js` dokumentiert) über
`technikMake` UND die Pass-Lotterie gleich zweifach ein, und das wurde in dieser Runde
bewusst nicht angefasst (s. Design-Frage C2 unten).

**PARADE zeigt den auffälligsten Ausschlag der ganzen Tabelle, unkommentiert wäre das
irreführend:** 2,2 % im Ausgangsbericht (VOR Fix A, als der Torwart per Zufalls-Slot
gewählt wurde) → 18,5 % direkt nach Fix A (sobald der Torwart wirklich der beste
PARADE-Kandidat ist, wird PARADE mit einem Schlag ein Hauptkanal) → 0 % nach B1-6. Der
Fall auf 0 % nach den Mechanik- und Kalibrierungsschritten ist NICHT weiter isoliert
nachgemessen worden (derselbe Aufwand, der beim Verteidiger/Torwart in der
Archetypen-Probe schon an die Grenze des mit vertretbarem Aufwand Isolierbaren stieß, s.
unten) — plausibler Kandidat ist die HK_TW_REF/BASIS-Neukalibrierung (Schritt 6): sie
zieht GSAA im Mittel auf ~0 und könnte damit auch die STREUUNG, an der die Sondierung
PARADEs Einfluss misst, zusammengedrückt haben. Eine künftige Rezeptrunde sollte diese
Zahl vor dem Bauen erneut prüfen, nicht ungeprüft übernehmen.

**Der Auftrag war ausdrücklich: kein Rezept bauen, solange ZWEITCHANCE über einem Viertel
der Impact-Masse liegt.** Das ist jetzt erreicht — 12,0 % liegt weit darunter. Dieser
Bericht schlägt trotzdem an keiner Stelle ein neues Rezept vor: das bleibt einer eigenen
Runde vorbehalten, die die Rangtreue (s. unten, aktuell noch unter dem Ausgangswert) gegen
diese neue, ehrlichere Verteilung neu aufbaut.

---

## rho je Spiel / rho Saison (`scripts/miss-alle-disziplinen.mjs 24 hockey`)

| Stand | rho je Spiel | rho Saison |
|---|---:|---:|
| Baseline (CLAUDE.md, vor dieser Runde) | 0,670 | 0,874 |
| Nach Fix A (nur Torwart-Auswahl) | 0,706 | 0,832 |
| Nach B1-6 (final, mit HK_TOR_SKALA/TW_BASIS/REF) | 0,612 | 0,895 |

**Das ist eine ehrliche Verschlechterung bei der Zahl, die zählt** (Einzelspiel-rho, Ziel
>0,80). Saison-rho (Validität mit dem BESTEHENDEN Rezept) steigt sogar leicht. Die
Einordnung, warum das kein Widerspruch zum Auftrag ist, sondern der erwartete Zwischenstand:

- Das Rezept (`battle-mode.rezepte.js`, Hockey) wurde in dieser Runde **bewusst nicht
  angefasst** — der Auftrag verlangt das ausdrücklich erst NACH einer grünen Sondierung.
  Die gemessene rho-Zahl gilt also für ein Rezept, das für die ALTE, ZWEITCHANCE-lastige
  Mechanik gebaut wurde, gegen die NEUE Mechanik gemessen.
- Der `checks*0,4`-Streichung entzieht der Wertformel einen Posten, der bisher — aus dem
  falschen Grund (der Matrix, nicht dem Skill) — recht zuverlässig mit der Eignung
  korrelierte (0,855 laut Bericht). Ihn zu entfernen ist mechanisch richtig (Hit-Differenzen
  korrelieren real negativ mit dem Ergebnis), kostet aber kurzfristig Rangtreue, bis ein
  künftiges Rezept den frei gewordenen Spielraum in echte Kanäle (AUFBAU, Passqualität)
  umlenkt.
- Dasselbe gilt für ZWEITCHANCE: die Sondierung zeigt (s. oben), dass ihr mechanisches
  Gewicht sinkt — aber das heutige Rezept gewichtet ZWEITCHANCE weiterhin nach der ALTEN
  Sondierung. Eine Mechanik, die ehrlicher verteilt, aber mit einem Rezept gemessen wird,
  das auf die unehrliche Verteilung kalibriert ist, sieht im rho zunächst schlechter aus —
  genau das Muster, das CLAUDE.md für den Basketball-Vorläufer dieser Arbeit beschreibt
  ("ein Rezept mit halbem Budget in ZWEITCHANCE würde rho heben und die Disziplin genau
  deshalb eindimensional machen").

**Trotzdem, klar benannt:** 0,612 ist HEUTE kein bestandener Wert, und ich habe ihn nicht
selbst wieder über 0,670 gehoben. Der nächste Schritt für rho ist eine eigene Rezeptrunde
gegen die jetzt gemessene Sondierung — genau das, was der Auftrag für diese Runde
ausdrücklich ausschließt.

---

## Die vier Archetypen — besser, gleich, schlechter

`scripts/miss-hockey-archetypen.mjs 48`, derselbe Kader in jedem Lauf:

| Archetyp / Kanal | Nach Fix A (vor B) | Nach B1-6 (final) | Bewertung |
|---|---:|---:|---|
| Sniper SCHUSS_NAH, rho | 0,300 | 0,042 | schwächer, Vorzeichen hält (dPp +4,8→+3,3) |
| Sniper SCHUSS_FERN, rho | −0,164 | −0,159 | **unverändert** — offene Design-Frage C1 |
| Playmaker AUFBAU-Delta | −0,109 | **+0,100** | **klar verbessert** — Vorzeichen gedreht |
| Playmaker TEAMGEIST-Delta | −0,634 | −0,182 | verbessert, aber weiter invertiert — Design-Frage C2 |
| Verteidiger dTore% | −3,8 % | **+11,7 %** | **verschlechtert** — falsches Vorzeichen |
| Verteidiger dFG% | 0,4 Pp | −0,3 Pp | ~unverändert (beide weit vom Ziel ≤−8 Pp) |
| Torwart, rho(Eig,GSAA) | 0,128 | −0,180 | **verschlechtert** gegenüber Fix-A-Stand |
| Torwart, Paarvergleich | 62,5 % | 43,8 % | **verschlechtert** gegenüber Fix-A-Stand |

**Was besser ist:** Playmaker über AUFBAU ist jetzt sauber von einem generischen
Offensiv-Skill getrennt (Delta positiv statt negativ) — das ist der Kern von Schritt 1 und 4
(Passqualität + Berührungskette), und es funktioniert wie beabsichtigt.

**Was gleich bleibt:** Sniper SCHUSS_FERN zeigt weiterhin keinen Zusammenhang — erwartet,
das hängt an der geteilten, Basketball-kalibrierten `steilerMake`-Kurve (Design-Frage C1,
s. unten), die dieser Auftrag ausdrücklich NICHT anfassen sollte.

**Was schlechter ist, ehrlich benannt:**

- **Verteidiger dTore%** kippt von schwach-richtig (−3,8 %) auf klar falsch (+11,7 %). Ich
  habe das isoliert zu verstehen versucht (einzelne Mechanismen sauber aus- und
  eingeschaltet, ohne die RNG-Abfolge zu verschieben — ein `if(true||rr()<x)` statt eines
  `if(rr()<1)`, damit kein zusätzlicher Zufallswurf die gesamte restliche Partie
  verschiebt). Ergebnis: KEIN einzelner der fünf Mechanismen erklärt den Effekt sauber —
  Passqualität allein ändert fast nichts (38,9→38,2 %), Abpraller-in-die-Ecke allein
  VERBESSERT sogar (38,9→19,8 %), aber beide zusammen mit Bully-Duell und
  A1/A2-Vorlagen ergeben wieder +31,4 % im finalen Stand. Das riecht nach einer
  Interaktion, nicht nach einer einzelnen Ursache — und die Rollenprobe V ist ohnehin
  schwankungsanfällig: der ursprüngliche `hockey-archetypen-probe.md`-Bericht selbst maß für
  DIESELBE, unveränderte Mechanik −26,9 % bis −49,4 % je nach Spielanzahl (40/48/60). Eine
  Zahl, die schon im Ausgangszustand über 20 Punkte streut, ist kein verlässliches Ziel für
  eine Ursachenzuordnung mit den hier verfügbaren Mitteln (Wechsel eines fixen RNG-Seeds
  bei jeder Motoränderung). Empfehlung: eine eigene Nachmessrunde mit deutlich mehr Spielen
  (120+) und mehreren Saatfamilien, bevor daraus eine Motorentscheidung folgt.
- **Torwart-Korrelation** fällt von den durch Fix A erreichten 0,128/62,5 % auf −0,180/43,8 %
  zurück. Dieselbe Einschränkung gilt: nur 6 verschiedene Torwart-Identitäten über 48
  Spiele (der Kader liefert je Seite immer denselben besten-PARADE-Spieler), die
  Korrelation testet effektiv nur zwei Personen gegeneinander. Fix A selbst — die
  PARADE-Auswahl — ist unverändert korrekt und bleibt bestehen; die Verschlechterung
  entstand irgendwo in B1-6, ohne dass sie einem einzelnen Mechanismus klar zuzuordnen war,
  aus demselben Grund wie beim Verteidiger.

Kurz: die Playmaker-Reparatur ist die verlässlichste positive Bewegung dieser Runde. Die
zwei Verschlechterungen (Verteidiger, Torwart) sind real gemessen, aber nicht sauber
ursächlich isoliert — das ist ein ehrlicher offener Punkt für die nächste Runde, kein
Verstecken eines Fehlers.

---

## Zwei offene Design-Fragen aus Punkt C — recherchiert, nicht entschieden

### C1: Die geteilte SCHUSS_FERN-Kurve (`steilerMake`)

`technikMake`/`steilerMake` (Basketball wie Hockey gemeinsam, `SKILL_MITTEL=0,2917`,
`STEIL_MAKE=12`, `MAKE_KORREKTUR`, `GEO_BONUS`) ist gegen 1074 Basketball-Feldwürfe
kalibriert und nie für Hockey neu vermessen — dokumentiert als offener Punkt in
`battle-mode.rezepte.js:437-440` ("Kalibrierung ist Schritt 4 des Hockey-Plans").

**Das ist keine neue Erkenntnis dieser Runde, sondern ein bereits benannter, bewusst
aufgeschobener Schritt.** `docs/design/hockey-torwart-puck-tore-recherche-fable.md`,
Abschnitt 4.4, sagt es sogar wörtlich in der eigenen Vergleichstabelle: „`SKILL_MITTEL` und
`MAKE_KORREKTUR` sind gemessene Basketball-Werte und müssen nach 3b für Hockey NEU GEMESSEN
werden — sie dürfen nicht übernommen werden." Das ist exakt der Plan-Schritt, der bis heute
nicht gelaufen ist.

**Meine Einschätzung:** die Kurve braucht eine eigene, in sich abgeschlossene
Kalibrierrunde — dieselbe Größenordnung wie die Basketball-NBA2K-Runde selbst (eine
Referenzstichprobe realer Hockey-Schüsse messen, `SKILL_MITTEL`/`MAKE_KORREKTUR` neu
fitten, wahrscheinlich auch ein eigenes `GEO_BONUS` für Hockeys Radien statt Basketballs
Dunk/Nah/Mit/Fern-Geometrie). Das in diesem Auftrag nebenbei zu tun hätte die
Passqualitäts-Kette (Schritt 1) UND jede spätere Basketball-Kalibrierung gleichzeitig
verschoben — deshalb nicht angefasst, wie verlangt. Empfehlung: eigene Runde, mit
`scripts/miss-hockey-korridor.mjs`/einer neuen Sonde für Trefferquote nach Distanzstufe
als Abnahme.

### C2: TEAMGEIST — Team-Stat oder Playmaking-Stat?

Der Archetypen-Bericht fragt: ist die TEAMGEIST-Inversion (hoher TEAMGEIST → MEHR eigene
Tore, WENIGER Vorlagen) ein Bug in `technikGate`, oder ist TEAMGEIST als „Team-vor-sich"-Stat
gedacht und die Assist-Korrelation kein Fehler?

**Gefunden, nicht selbst entschieden:** zwei Textstellen beantworten das ziemlich klar in
eine Richtung. Erstens, `battle-mode.rezepte.js` (Basketball-Rezept, TEAMGEIST-Kommentar):
„TEAMGEIST geht in `technikMake` UND in die Pass-Lotterie (`qualitaet` hoch zwei) ein" —
TEAMGEIST ist im Rezept schon als „schießt besser UND ist ein attraktives Passziel"
verdrahtet, nicht als „gibt Vorlagen". Zweitens, und deutlicher:
`docs/design/hockey-torwart-puck-tore-recherche-fable.md`, Abschnitt 4.4, derselbe
Tabellenblock wie bei C1, nennt für den Skill-Anteil in der Erfolgsformel wörtlich:
„`SCHUSS_NAH/FERN` nach Zone, **LINIENSPIEL statt TEAMGEIST**". Der ursprüngliche Hockey-Plan
sah also von Anfang an vor, dass TEAMGEIST hier durch einen EIGENEN, noch zu bauenden
Sub-Skill namens LINIENSPIEL ersetzt wird — TEAMGEIST war nie als Hockeys langfristiger
Playmaking-Kanal gedacht, sondern als Platzhalter, bis LINIENSPIEL existiert (LINIENSPIEL
taucht auch im Rollout-Plan B.2 als vorgesehener, nie gebauter Sub-Skill für „Vorlagen" auf,
s. Impact-Verteilung-Bericht Abschnitt 3).

**Meine Einschätzung:** `technikGate` ist damit nicht „falsch verdrahtet" im Sinne eines
Fehlers — es fährt exakt den dokumentierten Platzhalter-Zustand. Der saubere Fix ist NICHT,
TEAMGEIST aus `technikGate` zu entfernen (das würde der eigenen Design-Absicht
widersprechen, TEAMGEIST als Team-Chemie-/Schuss-Stat zu behandeln), sondern LINIENSPIEL als
eigenen Sub-Skill zu bauen und AN IHN die Vorlagen-Erfolgsgröße zu hängen — das ist aber
Rezept-/Sub-Skill-Architektur und damit klar außerhalb dessen, was dieser Auftrag umsetzen
sollte ("baue KEIN Rezept"). Ich habe `technikGate` NICHT geändert.

---

## Was noch nicht gemessen wurde

- Die exakte „Trefferquote nach Pass gegen ohne Pass" (6,9 % / 8,4 % im Ausgangsbericht) ist
  mit den Werkzeugen in diesem Repo nicht direkt nachmessbar — das Original-Werkzeug
  (`miss-hockey-paesse.mjs`) lief nur im Scratchpad einer früheren Recherche-Session
  (Instrumentierung von `passeAb`) und ist nie ins Repo gewandert. Die Passqualitäts-Kette
  (Schritt 1) ist strukturell so gebaut, dass sie diese Quote heben SOLLTE (additiver Bonus
  nur bei Schuss nach Pass), aber ich habe die exakte Vorher/Nachher-Prozentzahl nicht
  reproduziert. Empfehlung: das Werkzeug aus dem Bericht nachbauen (Kopie von Mockup/Motor
  mit einem `logZug`-Aufruf in `passeAb`, wie in Abschnitt 0.2 des Impact-Berichts
  beschrieben) und in dieses Repo übernehmen, dann als feste Abnahme für Schritt 1 fahren.
- Zwei-/Dreier-/Viererbesetzungen: alle Zahlen hier sind 6 je Seite, wie in beiden
  Ausgangsberichten.
- Die Verteidiger- und Torwart-Regression (s. oben) sind gemessen, aber nicht sauber
  ursächlich isoliert — offen für eine Nachmessrunde mit mehr Spielen/Saatfamilien.
