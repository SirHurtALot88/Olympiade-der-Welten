# Hockey: Torwart, aktiv gespielter Puck, realistische Torzahlen

Recherche-Stand: 2026-09-02, gemessen gegen `origin/main` `fff35048`. Alle Datei- und
Zeilenangaben sind gegen genau diesen Stand geprüft. Anschluss an
`docs/design/hockey-rollout-plan.md` (Teil H.8) — dieser Plan **ersetzt** dort die
Entscheidung F.1 und verschärft die Abnahme aus D.3.

Auftrag von Chris, wörtlich:

> „einer der spieler soll natürlich einen torwart slot haben und entsprechend im tor
> stehen! außer im 2er spiel da gibts nur verteiger und angreifer
>
> Der puck muss aber aktiv gespielt werden keine geister etc.
>
> Und bitte nicht unendlcih viele tore, da bitte an realen ergebnissen orientieren ein
> paar tore mehr wäre ja okay aber nicht endlos!"

**Jede Zahl hier ist entweder selbst gemessen, aus dem Code zitiert oder eine reale
Sport-Referenz mit Quelle.** Was nicht geprüft ist, steht als „nicht geprüft" da.

---

## 0. Die drei Ansagen, übersetzt

| Chris' Ansage | Was sie technisch bedeutet | Aufwand |
|---|---|---|
| Torwart im Tor, außer beim Zweierspiel | Eine **echte Sonderrolle** im Motor (Plan-Option D), plus ein gezeichnetes Tor — das es heute gar nicht gibt | groß |
| Puck aktiv gespielt, keine Geister | Die **Live-Migration wird zwingend** (Plan PR 3b), plus ein Puck-Objekt mit Position | sehr groß |
| Nicht unendlich Tore, an realen Ergebnissen orientiert | Kalibrierung der Erfolgsformel gegen NHL-Referenzen | mittel |

Die zweite Ansage ist die teuerste und trägt die beiden anderen: **ohne Live-Motor gibt es
weder einen Puck noch eine Position, an der ein Torwart stehen könnte.** Die Reihenfolge
folgt daraus zwingend.

---

## 1. Was heute wirklich da ist — nachgesehen, nicht vermutet

**1.1 Es gibt kein Tor.** `bodenFeldspiel` (`engine.js:6439`) hat einen eigenen Zweig für
Football (Endzonen, Yard-Linien) und einen für Basketball (Zonen, Dreierbögen). Hockey
fällt in den generischen Rückfall `feldspielDisc!=="basketball"` (`:6457-6465`): ein
Rechteck, eine Mittellinie, ein Mittelkreis, zwei Bögen an den Enden. **Kein Tor, kein
Torraum, keine blaue Linie.** Ein Torwart „im Tor" braucht also zuerst ein Tor.

**1.2 Es gibt keinen Puck.** Hockey fährt den Vorab-Pfad: `bauFeldspiel` rechnet die ganze
Partie in einer Schleife durch (`engine.js:4072` ff.) und schreibt Tore, Assists und Steals
direkt in die Spielerobjekte. Was auf dem Feld zu sehen ist, ist eine **Nacherzählung** —
genau das, was Chris „Geister" nennt. Der Ball existiert als Objekt nur im Live-Motor
(`fsLive.ball = {traeger, flug, frei, dribbelT}`, `engine.js:4365`).

**1.3 Es gibt keinen Torwart-Slot — auf beiden Seiten nicht.** `SLOTS_JE_DISC.hockey`
(`engine.js` ~2686) führt sechs Rollen: Power Forward, Defensive Wall, Playmaker,
Transition Runner, Slot Finisher, Captain Line. Das produktionsseitige Gegenstück
`lib/lineups/matchday-slot-roles.ts:169-176` führt dieselben sechs. Keiner davon ist ein
Torwart.

**1.4 Die Aufstellung erreicht die Arena überhaupt nicht.** `buildArenaTeam`
(`lib/foundation/battle-arena/arena-kader-adapter.ts:137-159`) enthält **null** Vorkommen
von `place` oder `slot` — nachgezählt, nicht geschätzt. Sie liefert den Gesamtkader,
sortiert nach TDM-Wert. Die Arena nimmt daraus die sechs besten nach Disziplinwert
(`engine.js:4017-4019`).

> **Das ist die eine Stelle, an der Chris' Wortlaut zwei Dinge heißen kann.** „Einer der
> Spieler soll einen Torwart-Slot haben" kann bedeuten (a) *der Motor bestimmt den
> Torwart* — dann geht es heute — oder (b) *ich als Manager stelle jemanden ins Tor* —
> dann braucht es vorher, dass die Aufstellung die Arena erreicht, und das ist ein eigener
> Auftrag, der alle Feldspiel-Disziplinen betrifft. Der Plan unten baut **(a) so, dass (b)
> später nur noch eine Zuweisung ist**, und stellt Chris die Frage in Teil 6.

**1.5 Der Präzedenzfall für einen Akteur ohne Spielerstatus existiert.** `fsSchiri`
(`engine.js:5291` ff., `bewegeSchiri`) ist ausdrücklich kein 13. Spieler, sondern ein
eigenes Objekt mit `x`/`y`, das sich je Spielphase an eine eigene Position stellt.

**1.6 Der Zweikampf um den freien Ball existiert.** `fsLive.ball.frei = {x, y, vonSeite}`
(`engine.js:5512`, `:5611`), `GREIF_REICHWEITE = 40` (`:3822`), und Spieler laufen von
selbst hin (`:5736`, `LAUF_ZUM_BALL_RADIUS`). Das ist der Abpraller-Zweikampf, den Eishockey
braucht — er muss nicht erfunden werden.

**1.7 Die Tor-Geometrie hat ein Vorbild.** `korbXVon(side)` (`engine.js:3980`) liefert
`W*0.915` bzw. `W*0.085`. Dieselbe Form trägt zwei Tore.

---

## 2. Die Torzahlen — und warum sie so weit daneben liegen

**Gemessen** (`scripts/miss-hockey-bestand.mjs`, n=48):

| | Hockey heute | NHL 2024-25 |
|---|---:|---:|
| Tore je Team und Spiel | **6,63** | **~3,0** (2,54 San Jose bis 3,56 Tampa Bay) |
| Abschlüsse je Team | **10,2** | **~28,3** |
| Trefferquote | **66,6 %** | **9,1 % bis 12,6 %** |

NHL-Werte über die Websuche am 02.09. selbst abgerufen (StatMuse-Auswertung der
Teamtabelle 2024-25); die Fangquote liegt laut NHL.com bei .902 oder niedriger, erstmals
seit 30 Jahren in zwei aufeinanderfolgenden Saisons.

**Es sind zwei Fehler, nicht einer, und sie zeigen in entgegengesetzte Richtungen:**

- Die Trefferquote ist **sechsmal zu hoch**. Das ist die Torflut.
- Die Zahl der Abschlüsse ist **fast dreimal zu niedrig**. Es wird zu selten geschossen.

Wer nur die Trefferquote repariert und die Abschlüsse lässt, landet bei 10,2 × 11 % ≈ **1,1
Toren je Team** — das wäre kein realistisches Spiel, sondern ein langweiliges.

**Der Vergleich mit Basketball zeigt, wie schief die Hausnorm ist.** Unser Basketball
liefert nach der Deckel-Reparatur 87,3 Punkte je **Spiel**, also rund 43,6 je Team — gegen
NBA-typische ~113. Basketball liegt damit bei **rund 39 % eines echten Spiels**, Hockey bei
**221 %**. Die beiden Disziplinen sitzen auf entgegengesetzten Seiten des Realismus, und
das ist selbst ein Befund: es gibt bisher keine Hausnorm dafür, wie nah eine
zeitkomprimierte Arena-Partie an einem echten Ergebnis liegen soll.

### 2.1 Der vorgeschlagene Korridor

Chris' Ansage lautet „an realen Ergebnissen orientieren, ein paar Tore mehr wäre okay, aber
nicht endlos". Daraus:

| Größe | Ziel | Begründung |
|---|---:|---|
| **Tore je Team und Spiel** | **3,5 – 4,5** | Real 3,0. „Ein paar mehr" heißt +20 bis +50 %, nicht +120 % |
| **Abschlüsse je Team** | **26 – 32** | Real 28,3 — hier ist die Realität selbst das Ziel, weil mehr Schüsse das Zuschauen besser machen |
| **Trefferquote** | **13 – 16 %** | Real 9–12,6 %. Leicht darüber, damit die 4 Tore ohne unrealistische Schussflut zustande kommen |
| **Fangquote des Torwarts** | **84 – 87 %** | Gegenstück zur Trefferquote (real ~90 %) |

Rechenprobe: 29 Abschlüsse × 14 % = **4,1 Tore**. Beide Eingangsgrößen liegen dicht an der
Realität, das Ergebnis liegt bewusst darüber.

**Die Zahl, die Chris gehört:** ob 4 Tore je Team richtig sind oder ob er 5 will. Alles
darüber kippt in die Torflut zurück, alles darunter macht ein 8-Minuten-Spiel ereignisarm.

---

## 3. Der Torwart

### 3.1 Die Degradationsregel — Chris' Ausnahme, zu Ende gedacht

Chris nennt nur den Zweierfall. Die Kadergröße wird je Saison auf 2..6 gewürfelt
(`season-discipline-schedule.ts:89-94`; der Katalogwert 5 aus `dataAdapter.ts:69` wird von
der Saison nie benutzt), es braucht also eine Regel für jede Größe.

**Vorschlag, an echtem Eishockey ausgerichtet** (5 Feldspieler + 1 Torwart = 6 auf dem Eis
— unsere `jeSeite: 6` trifft das exakt):

| Spieler je Seite | Aufstellung | Begründung |
|---:|---|---|
| **6** | 1 Torwart + 5 Feldspieler | Deckt sich mit echtem Eishockey |
| **5** | 1 Torwart + 4 Feldspieler | Wie eine Unterzahlsituation |
| **4** | 1 Torwart + 3 Feldspieler | Wie doppelte Unterzahl, real 3-gegen-3 in der Verlängerung |
| **3** | 1 Torwart + 2 Feldspieler | Untergrenze mit Torwart |
| **2** | **kein Torwart**: 1 Verteidiger + 1 Angreifer | Chris' ausdrückliche Ausnahme |

Bei zwei Spielern schießt man aufs **leere Tor** — das ist im echten Eishockey eine bekannte
Situation und braucht keine Erfindung. Die Trefferquote muss dort eigens kalibriert werden,
sonst fallen zweistellige Ergebnisse.

### 3.2 Was ein echter Torwart im Motor anfassen muss

Vollständig aufgelistet, damit der Aufwand nicht unterschätzt wird:

| Stelle | Was zu tun ist |
|---|---|
| `zuordneSlots` (`:4308`) | Sortiert heute **alle** Spieler nach Schusswert in Positionen. Torwart muss raus und eine feste Position am eigenen Tor bekommen |
| `spielmacherLos` (`:4524`) | Gewichtet nach AUFBAU — Torwart darf den Angriff nicht einleiten |
| `offensterMitspieler` (`:4565`) | Torwart darf kein Passziel im Angriffsdrittel sein |
| `gewichtetesLos(team,"ABSCHLUSS")` | Torwart darf nicht schießen |
| `zuordneDeckung` (`:4377`) | Torwart deckt keinen Mann und wird nicht gedeckt |
| `bewegeSpielerLive` (`:5624`) | Eigene Bewegungslogik: in der Torlinie bleiben, dem Puck folgen |
| Erfolgsformel | Neuer Term `paradeChance(schütze, torwart)` als Gegenstück zum Schuss |
| Boxscore | Spalten Paraden / Gegentore / Fangquote |
| `SLOTS_JE_DISC.hockey` | Siebte Rolle `goaltender` |
| `matchday-slot-roles.ts:169-176` | Dieselbe Rolle produktionsseitig — **berührt laufende Spielstände** |
| `bodenFeldspiel` | Zwei Tore und zwei Torräume zeichnen |

**Der billigere Zwischenweg, den ich nicht empfehle, aber benennen will:** ein `fsTorwart`
nach dem `fsSchiri`-Muster — ein eigenes Objekt statt eines Spielers. Er wäre sichtbar im
Tor und bräuchte **keine** der sechs Ausschlussstellen oben. Der Preis ist, dass er kein
Kaderspieler ist: er hat keinen Namen aus dem Team, keine Statistik in der Wertung und der
Manager kann ihn nicht wählen. Chris sagt „**einer der spieler** soll einen torwart slot
haben" — das schließt diese Variante aus. Sie steht hier nur, damit die Entscheidung
bewusst getroffen ist.

### 3.3 Der PARADE-Sub-Skill

Der Torwart braucht einen eigenen Wert, sonst entscheidet sein Schusswert über sein
Torwartspiel. Aus dem Hockey-Plan (B.2/B.3) übernommen, mit **einer Korrektur**: dort führte
PARADE `dexterity` — dasselbe Attribut wie SCHUSS_NAH. Fable hat im Review belegt, dass der
beste Torhüter damit voraussichtlich auch der beste Torschütze wäre. Da der Torwart jetzt
**aus dem Angriff ausgeschlossen** ist, verschwindet dieser Konflikt von selbst; die
Attributmischung bleibt trotzdem besser ohne Überschneidung:

`PARADE: {awareness, will, determination, dexterity, health}` — Stellungsspiel und
Nervenstärke vor Handgeschwindigkeit. Die genauen Gewichte fallen erst nach der Sondierung
auf dem Live-Motor (Reihenfolge s. Hockey-Plan H.5).

---

## 4. Der Puck

„Aktiv gespielt, keine Geister" heißt: der Puck ist ein Objekt mit Position, und jede
Zustandsänderung hat eine sichtbare Ursache. Was das Chassis dafür schon hat und was fehlt:

| Element | Vorhanden? | Woher |
|---|---|---|
| Träger am Schläger | **ja** | `fsLive.ball.traeger` |
| Pass mit Flugbahn und Abfangen | **ja** | `ball.flug`, `distZuLinie` in `passeAb` |
| Schuss | **ja** | Wurf-Zweig, muss aufs Tor statt auf den Korb zielen |
| Freier Puck + Zweikampf | **ja** | `ball.frei`, `GREIF_REICHWEITE`, `LAUF_ZUM_BALL_RADIUS` |
| Abpraller vom Torwart | **nein** | Neu: Parade erzeugt `ball.frei` vor dem Tor statt Ballbesitzwechsel |
| Bully | **nein** | Neu, aber `fsLive.phase` trägt es (die Standphasen-Mechanik steht) |
| Bande | **nein** | Neu: der Puck darf nicht ins Aus, er prallt ab |
| Dribbeln | passt nicht | Basketballs `dribbelT`-Hüpfen ist Ballsport-Optik; Puckführung gleitet |

**Die eine Stelle, an der Basketball nicht trägt:** Basketball hat kein Aus und keine Bande —
ein Ball, der die Seitenlinie überquert, ist dort ein Einwurf. Eishockey hat eine
umlaufende Bande, an der der Puck **abprallt und im Spiel bleibt**. Das ist keine
Anpassung, sondern neue Mechanik, und sie prägt das Bild stärker als jede Formel: ohne
Bande wirkt das Spiel wie Hallenfußball ohne Wände.

---

## 5. Reihenfolge

Die Nummerierung schließt an `hockey-rollout-plan.md` Teil H.8 an. **PR −1 bis PR 1 sind
erledigt** (#729, #732, #734).

| PR | Was | Ändert Spielverhalten? |
|---|---|---|
| **2** | Zeit- und Perioden-Konstanten in die `FELDSPIEL_ART`-Zeile; Hockey bekommt 3 Drittel | nein (Basketball bit-identisch) |
| **3a** | Live-Engine umbenennen, Sub-Skill-Konfiguration heben | nein (Basketball bit-identisch) |
| **3b** | **Hockey live schalten** — der Puck wird ein Objekt | **ja**, erstmals |
| **3c** | Sondierungslauf: welcher Sub-Skill trägt live wie viel | nein (Messung) |
| **4a** | **Eisfläche mit zwei Toren, Torräumen, blauen Linien, Bullypunkten** | nein (Optik), aber Voraussetzung für 4b |
| **4b** | **Torwart als echte Sonderrolle** + PARADE + Degradationsregel + Boxscore-Spalten | **ja** |
| **4c** | **Bande**: der Puck prallt ab statt ins Aus zu gehen | **ja** |
| **4d** | Impact-Formel je Disziplin, dann Zonenmodell, dann Erfolgsformel, dann Rezept | **ja** |
| **5** | Rangtreue und Archetypen (inkl. Torwart-Archetyp) | ja |
| **6** | Bully-Standphase und Drittelpause | ja |
| **9** | Produktivierung — Orchestrator je Disziplin | ja |

Gegenüber dem alten Plan neu: **4a vor 4b** (ohne gezeichnetes Tor keine Torwartposition),
**4c** als eigener Schritt, und der Torwart wandert von „eigene Entscheidung danach" in die
Kernrunde. Das Überzahlspiel (alt PR 8) bleibt hinten.

### 5.1 Abnahme je Schritt

- **3b:** Hockey läuft drei Drittel durch, der Puck hat zu jedem Zeitpunkt genau einen
  Zustand (Träger, Flug oder frei), Basketball bit-identisch.
- **4b:** Bei jeder Kadergröße 2..6 startet das Spiel; bei 3..6 steht genau ein Torwart je
  Seite in der Torlinie und schießt nie; bei 2 gibt es keinen.
- **4d:** Tore je Team 3,5–4,5 · Abschlüsse 26–32 · Trefferquote 13–16 % · Fangquote
  84–87 % — und die Pp-Abnahme aus dem Hockey-Plan D.1 bei n=48.
- **5:** Rangtreue rho ≥ 0,74 (heute 0,493, gemessen mit
  `scripts/miss-feldspiel-rangtreue.mjs hockey 24 6`).

---

## 6. Was Chris entscheiden muss

**6.1 Vier oder fünf Tore je Team?** Der Vorschlag ist ein Korridor von 3,5 bis 4,5 bei rund
29 Abschlüssen. Real sind 3,0. Fünf wären das Doppelte der Realität — machbar, aber dann
sollte es eine bewusste Entscheidung sein und keine Nebenwirkung.

**6.2 Wer bestimmt den Torwart?** Heute erreicht **keine** Aufstellung die Arena, für keine
Disziplin. Der Plan baut den Motor so, dass er den Torwart selbst bestimmt (bester
PARADE-Wert) — sichtbar im Tor, mit Namen und Statistik. Dass **du** ihn aussuchst, ist ein
eigener, größerer Auftrag, der Basketballs Slot-Rollen genauso betrifft. Soll der jetzt
mit dazu, oder reicht dir zunächst, dass ein echter Spieler aus deinem Kader im Tor steht?

**6.3 Drei Drittel zu wie lang?** Aus dem alten Plan unbeantwortet: Basketball läuft 4×1:30,
mit Dehnung rund 12 Minuten Zuschauzeit. Vorschlag Hockey: 3×1:20, rund 8 Minuten. Diese
Zahl bestimmt direkt, wie lange du zuschaust — und zusammen mit 6.1, wie dicht die Tore
fallen.

---

## 7. Was ich nicht geprüft habe

- Die NHL-Fangquote habe ich nur als Fließtext-Aussage von NHL.com („.902 oder niedriger"),
  nicht als Tabellenwert je Team.
- Strafminuten und Überzahlquote habe ich für diese Runde gar nicht erhoben — das
  Überzahlspiel bleibt hinten.
- Ob die Live-Engine bei 2 Spielern je Seite überhaupt sauber läuft, ist **nicht getestet**;
  die Slot-Tabelle hat sechs Einträge, und `zuordneSlots` deckelt auf `SLOTS.length-1`.
  Das ist ein eigener Prüfpunkt für 4b und der wahrscheinlichste Ort für eine böse
  Überraschung.
- Wie viel Rechenzeit ein Live-Hockeyspiel kostet und ob die Pp-Messung bei n=48 dann noch
  in ein Zeitbudget passt — bei Basketball hat genau das schon einmal geklemmt.
- Keine Zeile Code geändert. Dieser Plan ist Recherche.
