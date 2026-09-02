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

> **Dieser Plan ist nach dem Overseer-Review korrigiert.** Fable hat als Sparringspartner
> (Chris' Wunsch) unabhängig recherchiert — `hockey-torwart-puck-tore-recherche-fable.md`,
> 964 Zeilen — und mir an drei Stellen mit Zahlen widersprochen. Alle drei sind hier
> eingearbeitet; was ursprünglich dastand, ist in **Teil 8** protokolliert, damit die
> Korrektur nachvollziehbar bleibt:
> 1. Die **Bauform des Torwarts** war falsch bewertet, in beide Richtungen (Teil 3.2).
> 2. Die **Reihenfolge** hätte eine Sondierung gegen eine Mechanik gemessen, die danach
>    ersetzt wird (Teil 5).
> 3. Der **Slot-Generator** fehlte in diesem Plan ganz — und er macht Chris' „sehr
>    defensiven" Torwart-Slot heute unmöglich (neuer Teil 3.4).

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
| **Tore je Team und Spiel** | **3,5** (Korridor 3 – 4) | Real NHL ~3,0, DEL 2024/25 3,02. „Ein paar mehr" heißt +17 %, nicht +50 % |
| **Abschlüsse je Team** | **24 – 28** | Real 28,3 — die Realität selbst ist das Ziel, weil mehr Schüsse das Zuschauen besser machen |
| **Trefferquote** | **13 – 16 %** | Real 9–12,6 %. Leicht darüber, damit die Tore ohne unrealistische Schussflut zustande kommen |
| **Fangquote des Torwarts** | **84 – 87 %** | Gegenstück zur Trefferquote (real ~90 %) |

Rechenprobe: 26 Abschlüsse × 13,5 % = **3,5 Tore**. Beide Eingangsgrößen liegen dicht an der
Realität, das Ergebnis liegt bewusst leicht darüber.

**Die Obergrenze 4,5 aus dem ersten Entwurf war zu hoch** — der Overseer hat vorgerechnet,
dass ein Drittelspiel bei so vielen Toren rund 27 % seiner Zeit in Standphasen verbringt
(nach jedem Tor ein Bully). Das Spiel würde stocken. Vier Tore je Team sind die Grenze, und
fünf sollten Chris gar nicht erst angeboten werden.

**Die Zahl, an der alles hängt, ist aber nicht die Quote, sondern das TEMPO.** Basketball
erzeugt gemessen 41 Feldwürfe je Team in 360 s. Dieselbe Ereignisdichte auf 240 s Hockey
ergibt **rund 27 Abschlüsse** — exakt die NHL-Zahl. Das Tempo kommt also von selbst, **wenn
es garantiert wird**: es braucht eine Schussuhr mit Klär-Ereignis als Gegenstück, sonst
kann ein Team den Puck beliebig lange laufen lassen. Der ursprüngliche Hockey-Plan hatte
die Schussuhr für Hockey gestrichen; sie muss zurück.

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

### 3.2 Die Bauform — hier lag ich falsch, in beide Richtungen

Ich hatte einen Torwart **als sechsten Feldspieler mit Ausschluss-Flag** empfohlen und den
Aufwand auf „sechs Stellen" geschätzt. Der Overseer hat nachgezählt: zwischen
`initBasketballLive` (`:4330`) und dem Ende von `stepFeldspiel` (`:6440`) stehen **23**
Zugriffe der Form `FSTEAM[...]`, **10** Ganzteam-Schleifen und **8** Mitspieler-Filter.
Jeder davon ist eine Stelle, an der ein Torwart im Team falsch behandelt würde — er würde
Angriffe eröffnen, angespielt werden, einen Angriffs-Slot am **gegnerischen** Tor bekommen,
decken und gedeckt werden, schießen, Pässe abfangen, stehlen, Ausbrecher werden und um freie
Bälle rangeln. Meine Schätzung war um den Faktor vier zu niedrig.

Gleichzeitig hatte ich die Alternative mit einem falschen Argument verworfen: „kein
Kaderspieler, kein Name, nicht wählbar". Das stimmt für den Schiedsrichter, aber nicht für
die Bauform. Ein Objekt **außerhalb** von `FSTEAM` kann die **Identität eines Kaderspielers
tragen** — Name, Sprite, eigene Boxscore-Zahlen, und wählbar über den Aufstellungs-Slot.

**Empfohlen ist damit Variante E′: der Torwart ist eine Person, aber kein Feldspieler.**

```
fsTorwart = [ {p, n, side, x, y, zielX, zielY, PARADE,
               saves, gegentore, festgehalten, abpraller, lunge, reaktT}, {…} ]
```

- **Wer:** `bauFeldspiel` liest `place[p.n].slot === "goaltender"` aus der Aufstellung;
  Rückfall ist der beste PARADE-Wert im Kader. Er wird **aus dem Kader herausgenommen,
  bevor `FSTEAM` gebaut wird** — `FSTEAM` hat dann `jeSeite − 1` Feldspieler, und **keine
  einzige Feldspieler-Funktion muss angefasst werden**.
- **Wo:** auf der Torlinie plus Torraum-Tiefe, quadratisch dem Puck folgend
  (`zielY = H/2 + clamp(puck.y − H/2)·k`, `zielX` fest). Dieselbe Bauform wie
  `schiriRuhePos` (`:5279`).
- **Sichtbar:** `zeichneSprite` zeichnet jede Figur nach ihrem Namen — der Torwart bekommt
  sein eigenes Charakter-Sprite, und die vorhandene `lunge`-Pose trägt die Parade-Geste.
  **Kein neues Bild-Asset nötig.**
- **Messbar:** `MOTOREN[fd].namen()` und `wert()` (`:13029`) müssen `fsTorwart` mitnehmen,
  sonst ist er für die Pp-Messung und die Rangtreue unsichtbar.
- **Beim Zweierspiel** ist das schlicht `fsTorwart[side] = null`. Bei einem Flag-Torwart im
  Team wäre Chris' Zweierregel ein zweiter Codepfad an jeder der 20 Stellen.

Angefasst werden bei E′: `bauFeldspiel` (Auswahl und Herausnahme), ein neues
`bewegeTorwart`/`zeichneTorwart`, die Schussauflösung, `wert`/`namen`, die Wertungstabelle
und `sichern`/`zurueck` — ein weiteres Feld wie `fsSchiri`.

### 3.2b Was trotzdem am Feldspieler-Code zu tun ist

Nichts. Genau das ist der Gewinn: der Schiedsrichter-Kommentar (`:3500-3506`) verlangt
ausdrücklich, dass ein Nicht-Spieler „in keiner der Spieler-Schleifen auftauchen" darf. Ein
`if(u.torwart) continue;` an zwanzig Stellen wäre die Bauform, vor der dieser Kommentar
warnt.

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

### 3.4 Der Slot-Generator — Chris' Bedingung ist Systemgesetz, und sie beißt

Chris verlangt einen „sehr defensiv ausgerichteten" Torwart-Slot, dessen Profil **zusammen
mit den anderen wieder die Disziplinmatrix ergibt**. Nachgemessen: das gilt heute exakt.

| Disziplin | Slots | Abweichung des Slot-Mittels zur Matrix |
|---|---:|---:|
| Hockey | 6 | **0,1 Pp** |
| Basketball | 6 | **0,1 Pp** |
| Tennis | 6 | **0,1 Pp** |

Das ist keine Näherung, sondern per Konstruktion so: `buildSlotWeightProfiles`
(`lib/lineups/matchday-slot-roles.ts:421-454`) baut für alle Themen außer dem letzten ein
Delta und gibt dem **letzten Thema `−Σ` aller anderen** — es ist der Ausgleichsslot, der
die Matrix wiederherstellt.

**Vier Folgen, alle am Code geprüft:**

1. **Der Generator trägt sieben Themen ohne Umbau** — die Rechnung ist längenunabhängig.
   Aber `buildGeneratedSlotRoles` klemmt auf `slice(0, slotCount)` mit `slotCount` auf 0..6:
   bei sechs Spielern wird ein siebtes Thema **nie** ausgegeben. Der Torwart muss also
   **innerhalb** der Sechs sitzen, nicht daneben.
2. **Die Position in der Liste entscheidet über Chris' Degradationsregel.** `slice(0,n)`
   liefert bei drei Spielern die ersten drei Themen. Damit der Torwart bei 3 bis 6
   erscheint und bei 2 fehlt, muss er **an dritter Stelle** stehen. Preis: bei drei
   Spielern fällt dann ein Thema heraus, das es heute gibt.
3. **Bei drei Spielern wäre der Torwart der Ausgleichsslot** — sein Profil wäre `−Σ` der
   beiden anderen, also ein Zufallsprofil statt des entworfenen. Es braucht eine
   Generator-Regel: Ausgleichsslot ist das letzte **Nicht-Torwart**-Thema.
4. **„Sehr defensiv" ist heute nicht ausdrückbar.** Der Fokus-Deckel `min(base·0,45, 7)`
   erlaubt für ein Attribut mit Matrixgewicht 4 (determination, dexterity, will) nur
   **+1,8**, für awareness +3,6. Das stärkste erreichbare Torwart-Profil landet bei
   `health ≈ 23,5, awareness ≈ 11,5` — praktisch identisch mit dem bestehenden „Defensive
   Wall" (`health 23,4, spirit 15,4`). **Chris bekäme einen zweiten Verteidiger, keinen
   Torwart.**

**Vorschlag:** Torwart-Thema an dritter Stelle, mit eigenem, höherem Fokus-Deckel (bis 12
Punkte auf zwei von determination/will/awareness/health, damit ein Profil bei health ~25,
awareness ~14, will ~8 entsteht), und der Ausgleich **verteilt auf die fünf Feldrollen**
statt auf eine allein.

**Das berührt Produktionsdaten und damit laufende Spielstände.** Chris sieht die geänderten
Schlüsselattribute seiner sechs bestehenden Hockey-Slots im Aufstellungsbildschirm. Die
neuen Profile gehören ihm deshalb **vorher als Tabelle gezeigt**, nicht nachher erklärt.
Eigener PR, der keinen Motor anfasst.

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

**Auch hier hatte der Overseer recht.** Mein erster Entwurf hätte Hockey erst live geschaltet
(mit Basketballs Formeln), dann sondiert, und erst danach Tor, Torwart, Bande und
Impact-Formel gebaut. Damit hätte die Sondierung die Gewichte einer Mechanik gemessen, die
unmittelbar danach ersetzt wird — **exakt der Fehler, den ich im vorigen Review selbst als
Auflage übernommen hatte** (Impact-Formel vor jeder Sondierung, Zonenmodell vor dem Rezept).

Die korrigierte Fassung fasst alles Strukturelle in **einen** Schritt mit Platzhalter-Zahlen
zusammen und misst erst danach.

| Schritt | Was | Ändert Spielverhalten? |
|---|---|---|
| **R** | **Das Rohr**: Aufstellung → Arena, `place` durchreichen. Erste sichtbare Wirkung der Aufstellung überhaupt | nur Slot-Aufschläge |
| **G** | **Slot-Generator**: Torwart-Thema an dritter Stelle, eigener Deckel, verteilter Ausgleich; neue Hockey-Profile Chris **vorher** zeigen | Produktionsdaten |
| **2** | Zeit- und Periodenkonstanten in die `FELDSPIEL_ART`-Zeile | nein |
| **3a** | Live-Engine umbenennen, Sub-Skill-Konfiguration heben | nein (Basketball bit-identisch) |
| **3b′** | **Hockey live, komplett**: Torwart-Objekt (E′), Tor, Schussauflösung mit vier Ausgängen, Zonentabelle, Bande, Bully-Phase, Klär-Ereignis, Impact-Formel je Disziplin, Boxscore-Spalten — **mit Platzhalter-Zahlen** | **ja**, erstmals |
| **3c** | Sondierung — jetzt gegen die richtige Struktur | nein (Messung) |
| **4** | Sub-Skills, Rezept, Kalibrierung gegen den Korridor aus 2.1 | ja |
| **5** | Rangtreue und Archetypen, inklusive Torwart-Archetyp | ja |
| **6** | Drittelpause, Eisflächen-Politur | ja |
| **F** | **Formation je Rolle für Basketball** — Chris' „Center unterm Korb", eigene Balance-Runde | **ja**, Basketball |
| **8** | Strafzeit und Überzahlspiel | ja |
| **9** | Produktivierung: Orchestrator je Disziplin | ja |

**Warum R und G ganz vorn stehen:** der Torwart *ist* ein Aufstellungs-Slot. Ohne das Rohr
kommt Chris' Zuweisung nie an, und ohne den Generator-Umbau gibt es das Torwart-Thema
nicht. Beide sind klein, beide sind für sich abnehmbar, und beide nützen Basketball
genauso.

**Warum F erst hinten steht, obwohl es Chris' zweiter Wunsch ist:** die Formation ändert
Wurfdistanzen und Deckerabstände und damit **alle** Zahlen der Rollenproben. Das ist eine
Balance-Runde mit eigener Abnahme, und sie darf den Hockey-Weg nicht blockieren. Die
**Datenform** für Positionen je Rolle wird aber schon in 3b′ mitgebaut, damit sie nicht
zweimal entsteht.

### 5.1 Abnahme je Schritt

- **R:** eine Aufstellung, die Chris setzt, verändert nachweisbar den Slot-Aufschlag eines
  Spielers; ohne Aufstellung bleibt alles bit-identisch.
- **G:** das Mittel aller Slot-Profile trifft die Disziplinmatrix weiter auf ≤0,2 Pp.
- **3b′:** `feldspielProbe("hockey")` liefert **keine** `fehlend`-Liste mehr; der Puck hat
  zu jedem Zeitpunkt genau einen Zustand; bei jeder Kadergröße 2..6 startet das Spiel; bei
  3..6 steht genau ein Torwart je Seite auf der Torlinie und schießt nie; Basketball
  bit-identisch.
- **4:** Tore je Team 3–4 · Abschlüsse 24–28 · Trefferquote 13–16 % · Fangquote 84–87 % ·
  Pp-Abnahme bei n=48.
- **5:** Rangtreue rho ≥ 0,74 (heute 0,493).

## 6. Was Chris entscheiden muss

**6.1 Drei oder vier Tore je Team?** Der Vorschlag ist **3,5** bei 26 Abschlüssen und 13,5 %
Trefferquote. Real sind 3,0 (NHL) beziehungsweise 3,02 (DEL 2024/25). Vier sind die
Obergrenze; darüber verbringt ein Drittelspiel rund 27 % seiner Zeit mit Bullys nach Toren
und stockt sichtbar.

**6.2 — beantwortet.** Chris hat entschieden: benannter Torwart-Slot ab drei Spielern, bei
zwei Spielern keiner. Damit steht auch die Reihenfolge: das Rohr von der Aufstellung zur
Arena (Schritt R) kommt zuerst, weil der Torwart ohne es nicht zuweisbar ist.

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

---

## 8. Protokoll: was der Overseer korrigiert hat

Fable lief als Sparringspartner auf Chris' Wunsch und hat **unabhängig** recherchiert,
bevor er diesen Plan gelesen hat. Was hier ursprünglich stand und warum es falsch war:

| Stelle | Erster Entwurf | Korrigiert zu | Beleg |
|---|---|---|---|
| **3.2 Bauform** | Torwart als sechster Feldspieler mit Ausschluss-Flag, „sechs Stellen" | **E′**: Person außerhalb von `FSTEAM`, mit Kaderidentität | 23 `FSTEAM[…]`-Zugriffe, 10 Ganzteam-Schleifen, 8 Mitspieler-Filter — gezählt, nicht geschätzt |
| **3.2 Alternative** | Schiri-Muster verworfen: „kein Kaderspieler, kein Name, nicht wählbar" | Falsche Alternative — das Objekt kann alle drei tragen | `zeichneSprite` zeichnet nach Namen; `lunge`-Pose existiert |
| **3.4** | fehlte ganz | Der Slot-Generator macht „sehr defensiv" heute unmöglich | Fokus-Deckel `min(base·0,45, 7)` erlaubt für 4er-Attribute nur +1,8 |
| **5 Reihenfolge** | 3b live → 3c sondieren → 4a–4d Struktur | **3b′**: alles Strukturelle zuerst, dann messen | sonst misst die Sondierung eine Mechanik, die danach ersetzt wird |
| **2.1 Korridor** | 3,5 – 4,5 Tore, „oder fünf?" | **3,5** (Korridor 3 – 4), fünf nicht anbieten | bei 4,5 Toren ~27 % Standphasen |
| **2.1 Tempo** | fehlte | Die Torzahl hängt an einer **Tempo-Garantie**, nicht an der Quote | Basketball: 41 FGA je Team je 360 s → ~27 Abschlüsse auf 240 s |
| **Zonenmodell** | „Maximum im Slot" | **monoton in der Distanz plus eigene Winkel-Achse** | die offenen xG-Modelle sagen: Distanz und Winkel sind die zwei stärksten Merkmale |
| **3.1 Zweierspiel** | „leeres Tor braucht keine Erfindung" | braucht kleineres Tor und eigene Kalibrierung | sonst ~11 Tore je Team |

**Was der Overseer bestätigt hat:** die Degradationsregel, dass Hockeys `jeSeite: 6` exakt
5 Feldspieler plus Torwart trifft, die Slot-Invariante (0,10 Pp), und dass EAs NHL
proprietär ist, während die offenen xG-Modelle die brauchbare Quelle sind — fünf von sechs
Repos erreichbar, eines GPL-3.0, vier ohne Lizenz. **Daraus dürfen nur Zahlen übernommen
werden, kein Code**, und die Quelle gehört in den Kommentar.

Die vollständige Recherche mit allen Belegen steht in
`docs/design/hockey-torwart-puck-tore-recherche-fable.md`.
