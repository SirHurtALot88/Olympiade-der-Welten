# Battlefield: Domination mit drei Punkten — Konzeptrunde K6 (14.10.)

**Reine Konzeptrunde, kein Verhaltens-PR.** Auftrag: Task #117 Punkt 16
(`docs/design/chris-feedback-breite-runde-13-10.md`), vertieft als K6 in
`docs/design/fable-konzept-chris-feedback-13-10.md` Abschnitt 5.6. Chris, wörtlich: „battlefield
läuft noch zu sehr ab wie Team Deathmatch -> hier sollte es eher darum gehen verschiedene Bereiche
einzunehmen. z.B. wie in Domination Spielmodi wo man 3 Orte hat und das Team was den Platz hält
dann jede Sekunde Punkte erhält dafür. So dass man sich aufteilen muss und starke Spieler ggf.
sogar alleine einen Platz halten. Respawn kostet kurz Zeit und das Team was am Ende mehr Punkte hat
hat dann gewonnen."

**Ergebnis vorweg:** Dieses Papier legt Geometrie, Respawn, Spielerwert-Formel und
Zuweisungsmechanik fest — aber baut **keinen** Prototyp im Arena-Chassis und misst **keine**
rho-/Pp-Zahlen für die neue Mechanik. Abschnitt 1 sagt, warum das die richtige Entscheidung für
diese Runde ist, nicht ein übersprungener Schritt.

---

## 0. Geltungsbereich und was unberührt bleibt

- Die **Eignungsmatrix** (`lib/player-generator/official-discipline-weights.ts`) wird nicht
  angefasst — gesperrt, für alle zwanzig Disziplinen, endgültig (CLAUDE.md).
- `lib/battle/arena-resolved-disciplines.ts`: **nicht verändert.** Battlefield steht dort nicht
  drin (geprüft, Zeile 145–168) und bleibt draußen. Dieses Papier trifft keine Entscheidung
  darüber, wann Battlefield live geht — das ist Chris' Entscheidung nach einer bestandenen
  Abnahme.
- Kein Code in `public/mockups/battle-mode.engine.js` wird in dieser Runde geändert.

---

## 1. Warum kein Prototyp in dieser Runde — die Vorbedingung ist nicht erfüllt

**Geprüft, nicht vermutet: die TMP/AUS-Pp-Reparatur am Arena-Chassis ist nicht gelandet.**
`docs/design/stand-aller-disziplinen.md` Zeile 1454 (07.10., aktuellster Stand, kein späterer
Nachtrag gefunden) trägt für Battlefield wörtlich: „braucht zuerst die TMP/AUS-Pp-Reparatur am
Chassis". `git log --all --grep` auf „TMP", „AUS-Pp" und „aufEignung" seit dem 07.10. findet keinen
Commit, der sie umsetzt. Der Fehler selbst steht im Code (`battle-mode.engine.js:6608–6621,
6832–6836`): `aufEignung()` normiert LP, ANG und VER auf die Eignung der Matrix — TMP und AUS nicht.
Jedes Attribut, das in TMP oder AUS liegt, bekommt dadurch einen Bonus **erster Ordnung**, egal was
die Matrix dazu sagt. Bei Battlefield speist ausgerechnet TMP die beiden schwersten Matrixattribute
(`TMP:{awareness:36,intelligence:34,charisma:30}`, Zeile 6832) und AUS ebenso (`AUS:{spirit:36,
charisma:32,intelligence:24,stamina:8}`, Zeile 6836) — der Versuch, die Matrix auch dort
durchzureichen, der eigentlich hilft, verschärft stattdessen den Chassis-Fehler.

**Die Kontamination ist bereits einmal live vorgeführt worden, mit genau Battlefield als
Versuchskaninchen.** Die P1-Persönlichkeits-Runde (`docs/design/arena-zielwahl-opus-empfehlung-
02-10.md` Abschnitt 10.3) hat Battlefield ein eignungstreueres Zielwahl-Handwerk gegeben — rho je
Spiel stieg von 0,399/0,391 auf 0,583/0,616, Saison-Validität von 0,31 auf 0,81/0,76, alle
Kriterien A–E bestanden. Aber Kriterium F (Pp nicht mehr als 6 über Ist) wurde **klar verfehlt**:
+27,1 und +36,8 Pp in den beiden Saatströmen. Was dabei geschah, steht dort namentlich: in Strom 1
fiel Charisma (Matrixgewicht 20) von 20,2 % auf 1,1 % gemessenen Einfluss, Spirit stieg von 16,8 auf
27,9 %; in Strom 2 übernahmen Awareness und Intelligence zusammen 67,7 % (vorher 40,0 %) — **beide
Attribute laufen durch TMP**, das außerhalb der Normierung liegt. Die Mechanik wurde besser
(höheres rho), aber aus den falschen Gründen — exakt der Fall, den CLAUDE.md mit der Pp-Pflicht
abfangen soll, und exakt die Zahl, die genau dieser Konzeptrunde als Ziel vorgegeben ist (Charisma
20/Intelligence 16/Spirit 16 sollen die Hälfte des Gewichts tragen).

**Die Folgerung für dieses Papier:** jede neue Battlefield-Mechanik — auch eine, die nichts an
TMP/AUS selbst ändert — würde durch denselben kaputten Maßstab gemessen. Eine Domination-Mechanik,
die Haltesekunden über Spirit/Awareness laufen lässt (wie Abschnitt 6 unten vorschlägt), triebe
TMP/AUS-Kanäle genauso an wie die Persönlichkeits-Runde es tat — eine gemessene Pp-Zahl würde nicht
zeigen, ob **meine** Formel die Matrix durchreicht, sondern ob sie zufällig mit oder gegen den
Chassis-Fehler läuft. Das ist dasselbe Muster, vor dem CLAUDE.md beim Spiegel-Abbild warnt: „Ein
veraltetes Abbild sieht aus wie ein gültiger Spielstand. Wer darauf misst, misst die Vergangenheit
und hält sie für die Gegenwart." Eine Pp-Messung unter dem kaputten Maßstab sieht aus wie eine
Messung und ist keine.

Der Auftrag für diese Runde sagt ausdrücklich, die TMP/AUS-Reparatur **nicht** selbst anzufassen.
Also: Abschnitt 1 ist der dokumentierte Blocker, nicht eine Lücke in diesem Papier. **Die richtige
Reihenfolge ist: TMP/AUS-Reparatur am Chassis zuerst (eigene, bereits mehrfach angekündigte
Runde — s. `arena-zielwahl-opus-empfehlung-02-10.md` Abschnitt 6, `tdm-pp-rezeptrunde-diagnose-
02-10.md`), danach eine Battlefield-Rezept-/Domination-Baurunde, die diesen Entwurf umsetzt und
misst.** Das deckt sich mit der eigenen Empfehlung der letzten Battlefield-Runde (Abschnitt 10.3,
letzter Absatz: „braucht vorher oder zugleich die Pp-Reparatur am Chassis").

**Was stattdessen gilt:** rho ist bei Battlefield heute **nicht** die bindende Verletzung — der
Weg dahin (Persönlichkeits-Handwerk, V9) ist laut Abschnitt 10.3 „messbar der richtige Hebel". Die
offene Frage ist strukturell Pp, und die hängt am Chassis, nicht am Domination-Entwurf. Dieses
Papier legt deshalb die Mechanik fest, die **nach** der Reparatur gebaut und gemessen werden soll,
mit einer expliziten Abnahme-Checkliste (Abschnitt 9) nach demselben Muster (A–F), das die letzte
Battlefield-Runde schon benutzt hat.

---

## 2. Ist-Zustand

`ARENA_DOMINATION.battlefield` (`battle-mode.engine.js:6911–6917`):

```
radius: 230, kapZeit: 5, punkteJeSekunde: 6, punkteZumSieg: 150,
rolleErobert: { siegecore: 1.6 }
```

Ein Kontrollpunkt in der Mitte des Kampfplatzes (MID=620, H/2=235 bei Spielfeld 1240×470,
`battle-mode.html:149`), sonst eine reine Ausschaltungs-Arena ohne Respawn, 4 gegen 4
(`jeSeite:4`). Gemessen (Opus-Konsultation, `fable-ideen-arena-ispy-30-09.md` Zeile 85–88): **der
Punkt entscheidet 0 von 120 Spielen**, weil der Kampf durch Ausschaltung nach rund 19 Sekunden
vorbei ist — lange bevor die 25 Sekunden ununterbrochenen Alleinbesitzes erreicht sind, die bei
150 Zielpunkten und 6 Punkten/Sekunde zum Sieg nötig wären. Der Kontrollpunkt existiert im Code,
spielt aber in der Praxis nie eine Rolle. rho je Spiel 0,399/0,391, Saison-Validität 0,31
(`stand-aller-disziplinen.md` Zeile 1454) ist also im Kern die Zahl einer **Ausschaltungs-Arena**,
nicht die eines Domination-Modus — Chris' Einschätzung „läuft noch ab wie Team Deathmatch" ist
exakt richtig, auch mechanisch, nicht nur optisch.

Vier Rollen bestehen bereits und tragen genau die Namen, die ein geführtes Gefecht bräuchte
(`SLOTS_JE_DISC.battlefield`, Zeile ~6032): **Commander** (Charisma/Intelligence, „führt große
Situationen"), **Spotter** (Awareness/Intelligence, „liest Lücken und Ziele"), **Siege Core**
(Power/Torment, „drückt Fronten", erobert heute schon 1,6-fach), **Morale Anchor** (Spirit/Health,
„hält Linien zusammen") — aber keine dieser Rollen hat eine eigene mechanische Wirkung, nur ein
Attributprofil. Matrix: Charisma 20, Intelligence 16, Spirit 16, Torment 12, Power 10, Awareness
10, Health 8, Determination 4, Stamina 4 — die einzige Kampfdisziplin, in der Power nicht führt
(Zeile 6804–6809).

Ein Teil der Vorarbeit für diese Runde ist schon geleistet, ungebaut: `fable-ideen-arena-ispy-
30-09.md` Abschnitt 5 (B-1 bis B-5) entwirft genau diese vier Rollen mit Mechanik, lässt aber
Chris' „Frage 2" (Tickets + Respawn? Front statt Punkt? Beides?) ausdrücklich offen. Dieses Papier
beantwortet sie — s. Abschnitt 3.

---

## 3. Frage 2 beantwortet: Domination mit drei Punkten, nicht Tickets, nicht Front

Drei Entwürfe standen zur Wahl:

1. **Opus P3 „Conquest-light"** (Tickets + Respawn + zweiter, rückwärtiger Punkt).
2. **B-4 „Frontlinie statt Punkt"** (ein Tauziehen entlang einer verschiebbaren Linie statt fester
   Radien).
3. **Klassische Domination mit drei festen Punkten**, Punkte pro Sekunde für den haltenden Platz.

Chris' Vorgabe vom 13.10. ist wörtlich und konkret genug, um die Frage zu entscheiden: „3 Orte …
das Team was den Platz hält … jede Sekunde Punkte … das Team was am Ende mehr Punkte hat hat dann
gewonnen." Das ist Variante 3, nicht 1 (keine Tickets, kein Ticket-Bluten) und nicht 2 (keine
Linie, feste benannte Orte — „3 Orte" ist im Wortlaut bereits eine Geometrie-Entscheidung). **Diese
Runde entscheidet Frage 2 damit zugunsten von Variante 3.** B-4 bleibt als dokumentierte
Alternative stehen (Abschnitt 11, offene Fragen) — nicht, weil sie schlechter wäre, sondern weil
Chris eine andere, ebenfalls vollständige Lösung schon benannt hat und eine Konzeptrunde, die
beides gleichzeitig vorschlägt, am Ende gar nichts entscheidet.

Respawn ist Teil derselben Vorgabe („Respawn kostet kurz Zeit") — s. Abschnitt 5.

---

## 4. Punkt-Geometrie: drei Orte, die zur Aufstellung passen, nicht gegen sie

**Leitidee:** keine neue Positions-Logik erfinden (das Projekt hat an anderer Stelle gelernt,
Reihen/Spalten nicht zu duplizieren — `REIHEN_ABSTAND`-Kommentar, Zeile 32835: „das ist genau die
Geometrie, die `homeFor()` beim Start ohnehin vergibt"). Die drei Punkte sollen aus der
**bestehenden** Start-Geometrie der vier Rollen folgen, nicht zusätzlich zu ihr stehen.

`homeFor(side,row,i,n)` (Zeile 31502) platziert Battlefield-Kämpfer so: Reihe 0 (Siege Core,
Morale Anchor — zwei Spieler, `n=2`) auf `y = 70` bzw. `y = 400`; Reihe 1 (Spotter, allein) und
Reihe 2 (Commander, allein) beide auf `y = 235` (Feldmitte, `n<2` → `y=70+(H-140)·0,5`). Die X-Achse
(MID∓140/300/460) kodiert **Rolle und Vorrücktiefe**, nicht Teamseite-Symmetrie, und daran ändert
dieser Entwurf nichts — Formation, Front-Leine (`teamFront()`) und `reihenAnker()` bleiben
unberührt. Die Y-Achse dagegen ist für beide Seiten identisch (sie hängt nicht von `side` ab) und
bereits in drei saubere Bänder geteilt: oben (Siege Core), Mitte (Spotter/Commander), unten (Morale
Anchor).

**Vorschlag: drei Punkte auf der Y-Achse, bei konstantem X = MID (620) — derselbe Tiefenwert wie
der heutige Einzelpunkt, also weiterhin „der Ort, um den sich beide Seiten ohnehin gruppieren".**

| Punkt | Position (x, y) | Radius | Nähe zur Startaufstellung |
|---|---|---:|---|
| **Nord** | (620, 85) | 65 px | 15 px von Siege Cores Startzeile (y=70) beider Seiten |
| **Mitte** | (620, 235) | 65 px | identisch mit dem heutigen Einzelpunkt |
| **Süd** | (620, 385) | 65 px | 15 px von Morale Anchors Startzeile (y=400) beider Seiten |

Abstand Nord–Mitte und Mitte–Süd: je 150 px, Kantenabstand bei Radius 65 je **20 px** — drei
unabhängig haltbare Zonen, kein Überlappen (zum Vergleich: heute deckt ein einzelner Radius von 230
praktisch das ganze vordere Spielfeld ab, s. Kommentar Zeile 6878 „Radius 230 deckt … vor allem
Reihe 0 ab"). Je kleiner Radius heißt: wirkliche Präsenz nötig, nicht nur ungefähre Nähe.

**Warum das zur gewünschten Aufteilung zwingt, ohne eine Regel dafür zu brauchen:** Siege Core
startet 15 px von Nord entfernt, Morale Anchor 15 px von Süd — beide erreichen „ihren" Punkt fast
sofort, ganz ohne neue Entscheidung. Spotter und Commander starten mittig, gleich weit von allen
drei Punkten entfernt — sie sind die natürlichen Rotierer (s. Abschnitt 7). Acht Spieler (4 gegen 4)
auf drei Punkte heißt zwangsläufig: mindestens ein Punkt wird nur von einem Spieler je Seite
gehalten, oder bleibt zeitweise unbesetzt — genau „starke Spieler ggf. sogar alleine einen Platz
halten".

**Besitzregel unverändert vom heutigen Code übernommen:** Besitz wechselt nur, wenn genau eine
Seite präsent ist (kein Fortschritt in beide Richtungen gleichzeitig, Kommentar Zeile 6896 f.);
ein verlassener Punkt hält seinen letzten Besitz statt auf neutral zurückzufallen. Das gilt für
alle drei Punkte unverändert, keine neue Logik nötig außer einer dritten Instanz derselben Prüfung.

`rolleErobert.siegecore:1.6` bleibt — gilt unverändert an jedem der drei Punkte.

---

## 5. Respawn: Dauer, Ort, und was sich an der Sieg-Uhr ändert

TDM hat seit dem 26.09. bereits Respawn (`battle-mode.engine.js`, Commit `ac38f6fb`): 5 Sekunden
am eigenen Aufstellungsplatz, 1,5 Sekunden Spawnschutz danach. Das ist der nächstliegende Präzedenzfall
im selben Chassis, kein neu zu erfindendes Format.

**Vorschlag für Battlefield:**

- **Ort:** der eigene Aufstellungsplatz (`homeFor(side,row,i,n)`) — derselbe Mechanismus wie TDM,
  nicht an einem der drei Punkte (kein Spawn-Kill-Risiko an einer umkämpften Zone, s. Q7 unten).
- **Dauer:** 6 Sekunden plus 1,5 Sekunden Spawnschutz — eine Sekunde länger als TDM. Begründung:
  Battlefield-Kämpfer müssen nach dem Respawn oft zu einem von drei entfernten Punkten zurück,
  nicht nur ins nächste Gefecht; „kurz" bleibt kurz (Chris' Wort), aber lang genug, dass ein Tod an
  einem schlecht verteidigten Punkt eine spürbare, aber keine strafende Konsequenz ist (Q7: „Kontakt
  kostet, nimmt nicht").
- **Kein Wellen-Respawn (T-1).** T-1 wurde für TDMs sechs Köpfe je Seite vorgeschlagen, ausdrücklich
  weil erst bei dieser Kopfzahl eine Welle sichtbar wird (`fable-ideen-arena-ispy-30-09.md` Zeile
  166 f.). Bei vier Köpfen je Seite wäre eine „Welle" meist ein einzelner Spieler — kein Rhythmus,
  nur Verzögerung. Einzel-Respawn wie TDM heute, keine neue Taktzahl.
- **Stamina als kleiner Nebenkanal (T-2-Muster), optional:** `6 − 1·(STAMINA/100)` Sekunden statt
  fest 6 — Stamina trägt in der Matrix nur 4 Pp, ein kleiner, matrixtreuer Zuschlag passt zum
  Gewicht. Nicht Kernbestandteil dieses Entwurfs; erster Build kann mit fester Dauer starten und
  das als zweiten Schritt nachziehen, falls die Pp-Messung nach der Chassis-Reparatur zeigt, dass
  Stamina unterrepräsentiert bleibt.

**Was sich an der Sieg-Uhr ändert.** Die Opus-Messung (0 von 120, Abschnitt 2) zeigt: der heutige
Kampf endet durch Ausschaltung nach ~19 s, der Domination-Punkt hat real nie seine volle Spielzeit.
Respawn nimmt der Ausschaltung ihre Endgültigkeit — eine Seite kann nicht mehr dauerhaft auf 0
fallen, solange noch jemand respawnen kann. **Vorschlag: Elimination entfällt für Battlefield als
Sieg-Pfad, sobald Respawn aktiv ist** (`(disc!=="tdm"&&lebendeSeiten.size<=1)||t>95`,
Zeile 33827, gilt für Battlefield heute mit; mit Respawn wird `lebendeSeiten.size<=1` strukturell
fast nie mehr erreicht — dieselbe Umstellung, die TDM beim eigenen Respawn-Umbau schon gemacht hat,
„TDM läuft seit dem Respawn-Umbau regulär bis t>95", Zeile 35233). Entschieden wird ausschließlich
über die Kontrollpunkte: entweder eine Seite erreicht `punkteZumSieg` vor Ablauf (vorzeitiges Ende,
wie heute), oder — der Normalfall laut Chris' Wortlaut — **der Punktestand bei Zeitablauf
entscheidet.**

Die Spielzeit selbst sollte wachsen: die heutigen 60–95 s Battlefield-Echtzeit (Kommentar Zeile
6893) sind für eine Ausschaltungs-Arena kalibriert, die meist vorher endet. Mit Respawn und drei
Punkten, die tatsächlich über die volle Zeit umkämpft werden sollen, ist mehr Zeit nötig, damit
„realistisch innerhalb von einem Spiel" (CLAUDE.md) nicht an der Uhr scheitert. **Vorschlag: die
Kampfzeit auf etwa 130–150 echte Sekunden anheben** (`t`-Grenze bzw. `ZEIT_DEHNUNG.battlefield`
entsprechend verschieben) — eine Zahl, die die Baurunde kalibrieren muss, kein fester Wert dieses
Papiers. Sudden Death (heute ab t=50, Zeile 6893/35257) ergibt in einem reinen Punktespiel ohne
Ausschaltungs-Wettlauf keinen offensichtlichen Sinn mehr und sollte für Battlefield probeweise ganz
entfallen — offene Frage, s. Abschnitt 11.

**Punkterate neu kalibriert, weil jetzt mehrere Punkte gleichzeitig gehalten werden können.**
`punkteJeSekunde` bleibt nicht bei 6 je Punkt (das wären bis zu 18/s bei Kontrolle aller drei —
der heutige Sieg in 25 s würde auf unter 9 s fallen, der Rest des Kampfes wäre bedeutungslos).
**Vorschlag: 2 Punkte/Sekunde je gehaltenem Punkt, `punkteZumSieg` bleibt bei 150.** Wer alle drei
Punkte hält, erreicht damit dieselben 6 Punkte/Sekunde und dieselben 25 Sekunden wie der heutige
Einzelpunkt-Vollbesitz; wer nur einen von drei hält, braucht 75 Sekunden — realistisch nur bei
ausreichend verlängerter Spielzeit (s. oben), was den „man muss sich aufteilen" genau zur
Gewinnbedingung macht: volle Kontrolle ist der schnelle Weg, geteilte Kontrolle der langsame, aber
zuverlässigere.

---

## 6. Spielerwert-Formel: Haltesekunden, Eroberungen, Verteidigungen, Ausschaltungen

**Ziel laut Aufgabe:** Charisma (20), Intelligence (16) und Spirit (16) — zusammen 52 von 108
Matrix-Pp — sollen rund die Hälfte des gemessenen Einflusses tragen. Das lässt sich nicht aus der
Luft kalibrieren (jede konkrete Prozentzahl braucht `scripts/messe-arena-einfluss.mjs` unter dem
reparierten Chassis, s. Abschnitt 1) — aber die **Architektur** der Formel entscheidet, welche
Kanäle überhaupt etwas zu messen haben, und die lässt sich jetzt festlegen.

Vier Komponenten, mit vorgeschlagenem Startgewicht (zu kalibrieren, nicht final):

| Komponente | Anteil (Start) | Attributpfad | Rolle |
|---|---:|---|---|
| **Haltesekunden** | 35 % | Spirit, Health (+ Awareness über Nachbarschaftseffekt) | Morale Anchor |
| **Verteidigungen** | 25 % | Charisma (Folgequote), Intelligence (Plan-/Zieltreffer), Awareness | Commander, Spotter |
| **Eroberungen** | 20 % | Power, Torment, ×1,6 für Siege Core | Siege Core |
| **Ausschaltungsbeitrag** | 20 % | bestehendes `beitragVon`-Maß (Schaden/Heilung/Schild + KO-Anteil) | alle |

**Haltesekunden** — Sekunden, die ein Spieler im Radius eines **eigenen, bereits gehaltenen**
Punktes verbringt. Das ist die wörtliche Umsetzung von „das Team was den Platz hält … jede
Sekunde Punkte" auf Spielerebene, nicht nur auf Teamebene — und der Kanal, über den „ein starker
Spieler hält allein einen Platz" tatsächlich im Spielerwert ankommt, nicht nur im Ticker. Morale
Anchor (B-3, `fable-ideen-arena-ispy-30-09.md` Abschnitt 5) verlängert für Nachbarn im Umkreis die
Rückkehrzeit nach einem Rückzug (`k · SPIRIT(Anchor)`) — das hebt indirekt die Haltesekunden des
ganzen Punktes, nicht nur die eigenen, und ist der Kanal, über den Spirit (16 Pp) trägt.

**Eroberungen** — ein Punktewechsel von neutral/gegnerisch zu eigen, bereits im Code als
`rolleErobert.siegecore:1.6` vorgesehen (Abschnitt 4). Torment und Power sind hier matrixtreu, weil
sie bereits die ANG-Zusammensetzung von Battlefield sind (`ANG:{torment:38,power:32,charisma:30}`,
Zeile 6832).

**Verteidigungen** — ein Gegner wird im Radius eines eigenen, gehaltenen Punktes ausgeschaltet oder
zum Rückzug gezwungen. Hier trägt Charisma/Intelligence am direktesten: B-1 (Commander ruft einen
Konterplan, Intelligence entscheidet, ob der Konter trifft, Charisma, wie viele Mitspieler
innerhalb von 2 s folgen) und B-2 (Spotter markiert ein Ziel, Awareness wählt es, Intelligence
bestimmt den Takt) sind beides **Wege**-Mechaniken im Sinne von „mehrere Wege zum Erfolg": die
Menge der Verteidigung kommt aus `eig`, aber **ob** ein Verteidigungserfolg überhaupt zustande
kommt, hängt an Charisma/Intelligence/Awareness, nicht an einem zusätzlichen generischen Kanal.
Commander und Spotter bekommen auf diesem Weg einen Anteil am Teamerfolg auch dann, wenn sie selbst
nicht an der Front stehen (Opus-P2-Assist-Logik, in B-1 bereits vorgeschlagen).

**Ausschaltungsbeitrag** bleibt das bestehende `beitragVon`-Maß, aber bewusst mit dem **kleinsten**
der vier Anteile — das ist die Umsetzung von „wer zufällig wen zuerst trifft, soll nicht mehr
entscheiden" (Fable-Konzept-Hypothese, Abschnitt 5.6). Null wäre zu radikal (eine Ausschaltung ist
immer noch ein echtes Ereignis, und Siege Core/Commander-Pläne brauchen ANG/VER als Grundlage,
damit Verteidigungen überhaupt etwas zu entscheiden haben), aber sie soll nicht mehr die Hauptachse
sein.

**Q7-Kontaktregel, automatisch erfüllt, nicht neu zu bauen.** Die drei Pflichten aus Abschnitt 3.7
im Fable-Konzept-Papier:

1. „Kontakt kostet, nimmt nicht" — eine Ausschaltung am Punkt kostet dem Verlierer Zeit (Respawn-
   Wartezeit) und Position (zurück zum Aufstellungsplatz), nie bereits verdiente Haltesekunden:
   die laufen kontinuierlich in den Punktestand, der nicht rückwirkend korrigiert wird.
2. „Kontaktstärke aus den schweren Matrixattributen" — bereits erfüllt, weil ANG/VER in Battlefield
   schon aus Torment/Power/Charisma bzw. Spirit/Health/Awareness gespeist werden (Zeile 6832), kein
   generischer Kraftwert.
3. „Der Angegriffene hat immer eine eigene Antwort" — VER existiert bereits als eigener,
   attributgespeister Kanal; keine neue Mechanik nötig.

Spiegeltest (Heim:Gast nahe 50:50) bleibt Pflichtteil der Abnahme (Abschnitt 9), weil Kontakt laut
derselben Regel „die erste Stelle ist, an der Seitenasymmetrien entstehen".

---

## 7. Wer verteilt die Spieler: eine Commander-Entscheidung vor dem Spiel

Die Aufgabe verlangt ausdrücklich eine Antwort auf „wer weist Spieler den Punkten zu" — und
schlägt selbst vor, dass das eine Commander-Entscheidung aus Intelligence/Charisma ist, kein
automatischer Mechanismus. Das deckt sich mit B-1 (`fable-ideen-arena-ispy-30-09.md`, „eine meiner
drei stärksten Ideen"), hier auf die Punktzuweisung erweitert statt nur auf den Konterplan:

- **Vor dem Spiel** wählt das Management (oder Chris selbst, wenn er die Mannschaft stellt) eine
  von wenigen groben Eröffnungs-Zuweisungen für das eigene Team — „eine Entscheidung je Spiel, die
  eine richtige Antwort hat" (Muster a, `fable-ideen-arena-ispy-30-09.md` Abschnitt 2), genau wie
  Chris' Slot-Pläne auf der Bahn. Vorschlag für drei Grundmuster: **Dreiteilung** (jeder Punkt
  bekommt mindestens einen festen Verteidiger), **Doppelpunkt** (zwei Spieler drücken gemeinsam
  einen gegnerischen Punkt, der Rest hält zuhause), **Alleingang** (der stärkste Halter bindet
  allein einen entfernten Punkt, der Rest bleibt geschlossen an den anderen beiden) — die KI-Seite
  wählt über das bestehende `schlachtplan()`.
- **Im Spiel** darf der Commander umrufen, an denselben festen Momenten, die B-1 schon nennt
  (Punkt erobert/verloren, erster Ausfall, Halbzeit der verlängerten Spielzeit). Intelligence
  entscheidet, ob der neue Ruf zur tatsächlichen Lage passt; Charisma, wie viele Mitspieler
  innerhalb von 2 s folgen statt ihre Bindung auszusitzen.
- Für den Commander selbst gilt dieselbe Assist-Logik wie bei den Verteidigungen (Abschnitt 6): sein
  Beitrag wird daran gemessen, wie gut sein Team auf dem von ihm angesagten Ziel abschneidet, nicht
  an eigenen Ausschaltungen — er steht in Reihe 2, am weitesten von allen drei Punkten entfernt, und
  soll das auch bleiben dürfen, ohne im Spielerwert unsichtbar zu sein.

Das beantwortet die Teilfrage „wer entscheidet" eindeutig: eine Vorab-Zuweisung (Manager-Hebel) plus
eine laufzeitgebundene Nachjustierung (Commander-Attribute). Ob die Vorab-Zuweisung eine eigene
UI-Entscheidung für Chris wird oder vorerst KI-only mit Commander-Attributen als Qualitätsfaktor
bleibt, ist eine offene Frage (Abschnitt 11) — mechanisch ist beides mit derselben Formel
kompatibel.

---

## 8. Mehrere Wege zum Erfolg

CLAUDE.md, Design-Leitlinie aus der I-Spy-Konzeptrunde, von Chris ausdrücklich verallgemeinert:
„auf genau diese Art und Weise kannst du auch Attribute in allen möglichen Disziplinen nutzen,
sodass jeder Spieler eine gewisse Expertise hat und in irgendwas vielleicht gut ist." Battlefield
bekommt diesen Ansatz nicht als neue Erfindung, sondern weil die vier bestehenden Rollen bereits
vier verschiedene Wege zum selben Teamerfolg sind, sobald sie — wie in Abschnitt 6 beschrieben —
eigene mechanische Wirkung bekommen:

| Weg | Rolle | Attribute | Wie er gewinnt |
|---|---|---|---|
| **Halter** | Morale Anchor | Spirit, Health | hält einen Punkt lange allein durch, verlängert über B-3 auch die Standzeit der Nachbarn |
| **Eroberer** | Siege Core | Power, Torment | nimmt Punkte schnell (×1,6), ist im langen Stand selbst nicht der zäheste |
| **Rotierer** | Spotter | Awareness, Intelligence | markiert Bedrohungen (B-2), verstärkt, wo es gerade brennt, hält selbst keinen festen Platz |
| **Führer** | Commander | Charisma, Intelligence | trägt kaum eigene Haltesekunden/Eroberungen, vervielfacht aber über Plan und Zuweisung den Erfolg der anderen drei |

Kein Spieler ohne Power/Torment ist in Battlefield automatisch nutzlos — ein hoher Spirit-/Health-
Wert ist ein ebenso vollständiger Weg zum Erfolg wie ein hoher Power-/Torment-Wert, nur über einen
anderen Teil der Formel (Haltesekunden statt Eroberungen). Das ist keine zusätzliche Mechanik,
sondern die Konsequenz aus Abschnitt 6, hier nur einmal explizit als Playstyle-Tabelle benannt.

---

## 9. Abnahme-Plan für die Baurunde (nach der TMP/AUS-Reparatur)

Dieselbe Struktur wie die letzte Battlefield-Runde (`arena-zielwahl-opus-empfehlung-02-10.md`
Abschnitt 7), angepasst auf diesen Entwurf:

1. **Vorbedingung:** TMP/AUS-Pp-Reparatur am Arena-Chassis ist gelandet und auf allen drei
   betroffenen Disziplinen (TDM, Mini-DM, Battlefield) nachgemessen.
2. **Bauen hinter Flag**, `ARENA_RESOLVED_DISCIPLINE_IDS` unverändert (Battlefield bleibt draußen,
   keine Produktionsgefahr, s. Abschnitt 0).
3. **Messen**, kaderfest, zwei unabhängige Saatströme (`scripts/miss-alle-disziplinen.mjs`,
   `scripts/messe-arena-einfluss.mjs`):
   - **rho je Spiel ≥ 0,80**, angestrebt 0,85 (CLAUDE.md).
   - **Saison-Validität**, Vergleich gegen den Ist-Stand (0,31).
   - **Pp ≤ 25** (CLAUDE.md, Budget-Methode), Charisma+Intelligence+Spirit zusammen nahe 50 % des
     gemessenen Einflusses.
   - **Star auf Rang 1 / Top 2, Paare ≥ 15 Punkte**: keiner mehr als 3 Prozentpunkte unter dem
     Ist-Stand.
   - **Team-Ergebnistreue**: nicht mehr als 5 Prozentpunkte unter Ist (Chris' Grundmodell: ein
     klar überlegenes Team gewinnt zu ~95 %).
   - **Spiegeltest** (Heim:Gast) nahe 50:50 — Pflicht wegen Q7.
   - **G:** alle neunzehn übrigen Disziplinen bit-identisch nachgemessen.
4. **Abbruchregel:** verfehlt ein Einzelkriterium, wird dort gezielt nachgesteuert (z. B. Gewichte
   innerhalb der vier Formel-Komponenten verschoben), nicht die ganze Mechanik verworfen — analog
   zur Abbruchregel der letzten Runde.

---

## 10. Was dieses Papier bewusst nicht tut

- Keine neue Zielwahl-Formel für das Zwei-Seiten-Chassis (K1 ist zweimal gescheitert, s.
  `fable-ideen-arena-ispy-30-09.md` Abschnitt 1).
- Keine Matrix-Änderung, kein neuer Matrix-Kanal.
- Keine Front-Mechanik (B-4) — bewusst zugunsten der von Chris konkret benannten Drei-Punkte-
  Domination verworfen, s. Abschnitt 3.
- Keine Zahlen, die als „gemessen" ausgegeben werden, aber unter dem kaputten TMP/AUS-Maßstab
  entstanden wären.

---

## 11. Offene Fragen für Chris

1. **Reihenfolge:** Soll die TMP/AUS-Pp-Reparatur als eigene, vorgezogene Runde laufen (mein
   Vorschlag, weil sie auch TDM und Mini-DM blockiert), oder soll sie im selben Zug wie dieser
   Battlefield-Umbau passieren?
2. **Elimination als Nebensieg-Pfad:** ganz entfällt (mein Vorschlag, Abschnitt 5) oder bleibt als
   Sonderfall für einen vollständigen Wipeout über mehrere Respawns hinweg erhalten?
3. **Sudden Death:** für Battlefield komplett streichen (mein Vorschlag) oder in anderer Form
   behalten, z. B. als Punkterate-Bonus in der letzten Spielphase?
4. **Vorab-Zuweisung (Abschnitt 7):** eigene UI-Entscheidung für Chris/Management, wie die
   Bahn-Slotpläne, oder vorerst KI-only mit Commander-Attributen als Qualitätsfaktor?
5. **B-4 „Frontlinie"** bleibt dokumentierte Alternative (Abschnitt 3) — endgültig verworfen, oder
   später als eigener Vergleichslauf neben der Drei-Punkte-Domination prüfen?
6. **Exakte Spielzeit-Verlängerung** (Abschnitt 5, 130–150 s vorgeschlagen): eine konkrete Zahl
   oder der Baurunde zur Kalibrierung überlassen?

---

## Quellen

`docs/design/chris-feedback-breite-runde-13-10.md` Punkt 16 · `docs/design/fable-konzept-chris-
feedback-13-10.md` Abschnitt 5.6 (K6), 3.7 (Q7), 1 (Tabelle) · `docs/design/fable-ideen-arena-ispy-
30-09.md` Abschnitte 3 (TDM/Respawn), 5 (B-1–B-5) · `docs/design/arena-zielwahl-opus-empfehlung-
02-10.md` Abschnitte 6, 7, 10.3 · `docs/design/stand-aller-disziplinen.md` Zeile 1454 ·
`public/mockups/battle-mode.engine.js` Zeilen 5469, 5988, 6032, 6608–6621, 6804–6917, 31440–31520,
32801–32850, 33827 · `lib/battle/arena-resolved-disciplines.ts` · `CLAUDE.md` (rho>0,80,
Pp≤25-Budget-Methode, Eignungsmatrix gesperrt, mehrere Wege, Q7-Kontaktregel).
