# Opus-Overseer-Review PR #874 — Ziel 2: Eiskunstlauf-Movement (`stepKuer`, `bodenEis`, `zeichneDuett`-Haertung)

**Datum:** 10.09.2026
**PR:** #874, Branch `claude/feinschliff-ziel2-eiskunstlauf-09-10`, Kopf `b2d49f14`
**Basis:** `origin/main` `3f2c7a4f`
**Reviewer:** unabhaengiger Opus-Overseer, an der PR nicht mitgearbeitet
**Pruefumgebung:** zwei eigene, isolierte Worktrees (`wt-pr874` auf `b2d49f14`, `wt-main` auf
`3f2c7a4f`), `node_modules` per Symlink auf den Hauptbaum. Der geteilte Hauptbaum wurde nicht
angefasst. Alle Laeufe synchron und blockierend, kein Hintergrundlauf.

---

## Freigabe-Empfehlung

# FREIGEBEN MIT NACHTRAG

Der harte Teil dieser PR haelt vollstaendig. Der PR-0-Vertrag ist eingehalten — nicht behauptet,
sondern dreifach nachgemessen (Grep, bit-identische Rangtreue ueber 17 Disziplinen in fuenf
unabhaengigen Laeufen, und ein Aufrufzaehler, der beweist, dass der Messpfad `stepKuer()` wirklich
durchlaeuft). Die `zeichneSprite()`-Erweiterung ist so eng, wie sie sein muss. Nichts an einer
anderen Disziplin bewegt sich, weder in der Zahl noch im Bild.

**Was nicht haelt, ist das Bild von Eiskunstlauf selbst.** Zwei eigene Befunde (N1, N2) zeigen,
dass die neue Bewegung Paare regelmaessig zur Deckung bringt und die Schlusspose *alle* Paare auf
zwei Punkte in der Mitte stapelt. Beide sind rein praesentational, beide brechen nichts, beide
sind mit je einer Zeile zu beheben — aber **Eiskunstlauf steht in `ARENA_RESOLVED_DISCIPLINE_IDS`
und ist live**, und N2 trifft ausgerechnet das Schlussbild, das Chris am Ende jeder Kuer sieht.

Deshalb: freigeben, aber N1 und N2 als kurze Folgerunde einplanen, bevor die Disziplin auf dem
Server landet. Ausserdem **kein Auto-Merge** — #874 kollidiert textuell mit #875 *und* mit #876
(Abschnitt 5, mit der gemessenen Aufloesung).

---

## 1. Was ich selbst gefahren habe

| Lauf | Ergebnis |
|---|---|
| `miss-alle-disziplinen.mjs 24 eiskunstlauf` PR vs. `main` | **bit-identisch** |
| `miss-alle-disziplinen.mjs 24` x 9 Buehne (alle Geschwister) | **bit-identisch** (`diff` leer) |
| `miss-alle-disziplinen.mjs 24 basketball hockey football` (`zeichneSprite()`-Familie) | **bit-identisch** |
| `miss-alle-disziplinen.mjs 48 eiskunstlauf breaking gewichtheben` (andere Stichprobe) | **bit-identisch** |
| `miss-alle-disziplinen.mjs 6 eiskunstlauf` (dritte Stichprobe) | **bit-identisch** |
| `miss-alle-disziplinen.mjs 24` x 5 Bahn | **bit-identisch** |
| Aufrufzaehler in `stepKuer()` (eigener Patch, danach verworfen) | **11 157 Aufrufe** in 3 Probespielen |
| `npx tsc --noEmit`, beide Baeume | **560 Fehler beidseits, Ausgabe byteweise identisch** |
| `npx tsx scripts/pruefe-slot-invariante.ts` | **haelt**, max. 0,005 Pp (Schranke 0,2 Pp) |
| `npx vitest run` (6 einschlaegige Suiten) | **104/104 gruen** |
| `screenshot-disziplin.mjs eiskunstlauf` bei 2,5 / 6 / 11 / 20 / 45 / 62 s | **6 Aufnahmen, 0 `pageerror`** |
| Laufzeitvergleich, je 3 Laeufe | main 23,9–26,5 s, PR 25,3–25,5 s — **kein Regress** |
| GitHub-CI auf `b2d49f14` | **4/4 gruen** |

Die Zahlen selbst, zur Aktenlage — identisch auf beiden Seiten:

```
speed-schach  0.908 | showcase 0.892 | eiskunstlauf 0.885 | breaking 0.869 | gewichtheben 0.854
wettessen     0.845 | tennis   0.825 | fechten      0.816 | i-spy     0.684 (durchgefallen, wie vorher)
basketball    0.769 | hockey   0.669 (Feldspieler 0.719) | football 0.516        (unveraendert)
staffel       0.915 | spurt    0.871 | takeshis-castle 0.861 | time-trial 0.828 | climbing 0.790
```

Eiskunstlauf im Detail: **rho je Spiel 0,885 / Spannweite 0,083; rho Saison 0,979 / 0,028** —
Wort fuer Wort die Zahl von `main`. Die zweite und dritte Stichprobe (n=48: 0,901; n=6: 0,925)
liegen ebenfalls beidseits gleich.

**CI-Belege** (Run `34457460078` auf genau diesem Kopf-SHA): `pps-referenz-frische` 08:53:46Z,
`persistenz-suiten` 09:06:34Z, `full-test-suite` 09:12:00Z, `test-and-smoke` 09:15:34Z — alle vier
`success`.

---

## 2. Der harte Vertrag — dreimal geprueft, nicht einmal

Der PR-0-Vertrag verlangt dreierlei: nur `viz*`-Felder schreiben, **nie** `rr()`, **nie**
`u.summe/u.runden/u.aktuell/u.vorteil/u.zweikampf/u.lunge/buehneAkt/buehneZeiger/done`.

### 2.1 Textprobe

Alle Zuweisungen auf `u.*` im gesamten `stepKuer()`-Rumpf (`:11731`–`:11787`), maschinell
extrahiert, nicht gelesen und gehofft:

```
u.vizAktuell  u.vizPhase  u.vizPhaseT  u.vizRi  u.vizSpur  u.vizSturz  u.vizX  u.vizY
```

Acht Felder, **alle** `viz`-praefigiert, alle in dieser PR neu. Kein einziger Treffer auf ein
verbotenes Feld. `rr(` und `Math.random` kommen im Block **nur in Kommentarzeilen** vor — in
genau den zwei Zeilen, die die Regel formulieren. `zeichneDuett()`, `zeichneEisstaub()` und
`bodenEis()` (`:11868`–`:12165`) schreiben **gar nichts** auf `u` und rufen ebenfalls kein `rr()`.

### 2.2 Empirische Probe

Fuenf voneinander unabhaengige Messlaeufe ueber zusammen **17 Disziplinen** (9 Buehne, 3 Feldspiel,
5 Bahn) und drei verschiedene Stichprobengroessen (n=6, 24, 48) — jeder einzelne `diff` gegen
`main` **leer**. Ein zusaetzlicher `rr()`-Zug haette die spaeteren Ziehungen aller Buehnen-
Disziplinen verschoben; das waere in der Zahl sichtbar. Es ist nichts sichtbar.

### 2.3 Und der Beweis, dass diese Probe kein Nulllauf ist

Der wunde Punkt jeder „bit-identisch"-Aussage: sie ist wertlos, wenn der neue Code im Messpfad gar
nicht laeuft. Ich habe das deshalb direkt nachgesehen statt es zu unterstellen.

`MOTOREN[<buehne>].lauf` ist `while(!done&&g<120){ stepBuehne(1/60); g+=1/60; }` (`:21866`), und
`stepBuehne()` ruft `buehnenBewegung(dt)` in seiner letzten Zeile (`:11665`). Der Messpfad geht
also durch den Dispatcher. Zur Sicherheit gemessen: einen Aufrufzaehler in `stepKuer()` gepatcht
(danach mit `git checkout` restlos zurueckgenommen, Arbeitsbaum sauber) und im Browser

```
disziplinProbe("eiskunstlauf", {n:3})   ->  __kuerN = 11157
disziplinProbe("gewichtheben", {n:3})   ->  __kuerN = 11157   (unveraendert)
```

**11 157 Aufrufe** in drei Probespielen (rund 3 720 Bilder je Spiel) — die Neutralitaet ist an
elftausend echten Durchlaeufen gemessen, nicht an null. Und der zweite Wert ist der Gegenbeweis
zur Gate-Frage: waehrend einer kompletten Gewichtheben-Probe steigt der Zaehler **um null**. Der
`art.duett`-Waechter haelt dicht.

---

## 3. Die `zeichneSprite()`-Erweiterung — die Stelle, die Sorgfalt verlangt

Der Diff dort ist drei Zeilen (`:2611`, `:2612`, `:2620`–`:2622`):

```js
const kuerSturz=!!u.vizSturz;
let ani="walk";
if(u.down||kuerSturz)ani="hurt";
...
const f=(u.lunge>0&&!u.down&&!kuerSturz)
  ? Math.min(n-1, Math.floor((1-u.lunge/0.2)*n))
  : ((u.down||kuerSturz)?n-1:Math.floor((t*7+u.id)%n));
```

**Kann `u.vizSturz` je woanders wahr werden?** Nein. Ein Grep ueber `public/`, `lib/`, `app/` und
`components/` findet `vizSturz` an **zwoelf** Stellen — drei davon Kommentar, eine die Lesestelle
oben, eine die Lesestelle in `zeichneDuett()`, und die uebrigen **ausschliesslich** in `stepKuer()`.
Es gibt keine zweite Schreibstelle im ganzen Repo. `stepKuer()` wiederum ist nur ueber
`buehnenBewegung()` hinter `art.duett` erreichbar, und `duett:true` traegt genau ein
`BUEHNE_ART`-Eintrag: `eiskunstlauf` (`:10721`). Fuer die uebrigen acht Buehnen-, drei Feldspiel-
und drei Arena-Disziplinen bleibt die Eigenschaft `undefined`, `!!undefined` ist `false`, und die
Weiche verhaelt sich Zeichen fuer Zeichen wie vorher.

**Kann ein alter Wert ueberleben?** Auch nein. `bauBuehne()` setzt `TEILNEHMER=[]` (`:10995`) und
baut jedes Objekt neu; Bahn (`LAEUFER`), Feldspiel (`FSTEAM`) und Arena (`U`) sind ohnehin eigene
Arrays mit eigenen Objekten. Es gibt keinen Weg, auf dem ein Teilnehmer mit gesetztem `vizSturz` in
eine andere Disziplin wandert.

**Die Initialisierung ist zusaetzlich defensiv:** `u.vizSturz=false` statt `delete`/`undefined`
(`:11738`) — die Eigenschaft existiert damit auf Eiskunstlauf-Objekten immer und ist ausserhalb
eines Sturzes immer falsch. Sauber.

**Die drei `zeichneSprite()`-Geschwister im Feldspiel** (`basketball hockey football`) habe ich
zusaetzlich gemessen: bit-identisch. Das ist der empirische Gegenbeweis von der anderen Seite.

Bewertung: **das ist die richtige Loesung.** Der naheliegende Weg — `u.down` setzen — haette ueber
dieselbe geteilte Weiche in Feldspiel-Kollaps und Arena-K.o. geleckt; der Kommentar an `:2608` sagt
das und hat recht. Der Preis ist eine zusaetzliche Eigenschaftsabfrage je Sprite je Bild. Bei zwoelf
Sprites ist das nicht messbar, und der Laufzeitvergleich in Abschnitt 1 bestaetigt es.

---

## 4. `bodenEis()` und der Boden-Dispatch

**Traegt `eisRundweg()` ausserhalb von Hockey?** Ja. `eisRundweg(k,ein)` ist eine eigenstaendige
Funktionsdeklaration bei `:10001`, **neben** `eisflaeche()` (`:10010`), nicht darin — im selben
IIFE-Sichtbereich, also aus `bodenEis()` (`:11868`) heraus aufrufbar. Kein `ReferenceError`, und
sechs eigene Aufnahmen ohne `pageerror` bestaetigen es im Betrieb. Die Behauptung „Pfad-Routine
wiederverwendet, nicht kopiert" stimmt: `bodenEis()` uebergibt eigene Grenzen an dieselbe Routine.

**Kein Hockey-Aufbau uebernommen** — nachgesehen: keine blaue Linie, kein Bullykreis, kein Tor.
Statt dessen Scheinwerferkegel und Zuschauerraenge in der Bauart von `bodenBuehne()`, plus ein
Kampfgericht-Tisch. Auf meinen Aufnahmen ist genau das zu sehen.

**Eine Geometrie fuer Bewegung und Boden.** `kuerFlaeche()` (`:11727`) liefert `{cx,cy,ax,ay}` und
wird von beiden gelesen. Das ist die richtige Entscheidung; sie wird allerdings nur halb
eingeloest — `bodenEis()` weitet die Flaeche mit den Faktoren `1.18`/`1.34` auf, `stepKuer()`
benutzt die Rohwerte. Die Bande liegt also weiter aussen als die Kufenbahn (Absicht, sonst wuerde
man an der Bande kleben), aber die Faktoren stehen an genau einer Stelle und der Zusammenhang haelt.

**Der Dispatch selbst** (`:11908`) ist eine `if/else`-Kette:

```js
if(BB().duett)bodenEis(); else bodenBuehne();
```

Eine weitere `else if` fuegt sich hier strukturell reibungslos ein — die Behauptung der PR stimmt
**strukturell**. Sie stimmt aber nicht **textuell**: siehe Abschnitt 5.

---

## 5. Merge-Kollisionen — selbst nachgemessen, mit Aufloesung

`git merge-tree` gegen die beiden Geschwister-PRs:

| Paarung | Ergebnis |
|---|---|
| #874 x #876 (Gewichtheben, Ziel 1) | **CONFLICT** in `battle-mode.engine.js` |
| #874 x #875 (Breaking, Ziel 4) | **CONFLICT** in `battle-mode.engine.js` |

**Gegen #876** liegt der Konflikt genau an der Zeile, die die PR fuer unkritisch haelt. Beide PRs
schreiben denselben `bodenBuehne();`-Aufruf um, und sie tun es **in unterschiedlicher Reihenfolge
relativ zu `const art=BB();`**:

```js
// #874:                                   // #876:
if(BB().duett)bodenEis(); else bodenBuehne();   const art=BB();
const art=BB();                                 if(art.heben)bodenHeben(); else bodenBuehne();
```

Die richtige Aufloesung ist eine Zeile, mit `const art=BB();` **davor** (#876er Reihenfolge):

```js
const art=BB();
if(art.heben)bodenHeben(); else if(art.duett)bodenEis(); else bodenBuehne();
```

Beide Zweige schliessen einander aus (`heben` und `duett` sitzen auf verschiedenen `BUEHNE_ART`-
Eintraegen), die Reihenfolge ist also gleichgueltig.

**Gegen #875** liegt der Konflikt an der gemeinsamen Ankerstelle hinter `buehnenBewegung()` — beide
haengen dort ihre `step*`-Funktion an. Das deckt sich mit dem Befund der #875-Review (#877), die
die Aufloesung bereits durchgespielt und danach bit-identisch nachgemessen hat.

**Empfehlung:** eine Merge-Reihenfolge festlegen und den jeweils spaeteren Zweig von Hand
aufloesen. Kein Auto-Merge auf einer dieser drei PRs.

---

## 6. Was das Bild wirklich zeigt — eigene Aufnahmen

Ich habe nicht die im PR verlinkten PNGs angesehen, sondern **sechs eigene** gemacht
(`screenshot-disziplin.mjs eiskunstlauf` bei 2,5 / 6 / 11 / 20 / 45 / 62 s, jeweils
`Seitenfehler: keine`). Die Kuer laeuft mit `rundenN:12` und `rundenDauer:0.425` bei zwoelf
Teilnehmern rund 61 s, die Serie deckt sie also von Durchgang 1 bis 12/12 ab.

**Was haelt.** Die Bewegung ist echt und deutlich: zwischen allen sechs Zeitpunkten stehen die
Paare an voellig anderen Stellen der Flaeche, mit sichtbaren, ausblendenden Kufenspuren hinter sich.
Die Eisflaeche ist da — kalter Verlauf, weisse Bande, goldene Kante, Kampfgericht-Tisch. Stuerze
(liegend gekippte Figur) und Wurf-Boegen sind im Bildbestand. **M1, M2 und M3 sind eingeloest**,
und der Sicht-QA-Befund „sechs Paare stehen bewegungslos im Raster" ist damit erledigt.

**Was nicht haelt — N1: die Partner haben keinen garantierten Abstand mehr.**

Der alte Rastercode setzte die beiden Partner auf `x-26` und `x+26`, also **konstant 52 px**
auseinander. Der Kommentar dazu ist in dieser PR mitgeloescht worden; er lautete, dass die
urspruenglichen 15 px zu eng waren, weil „die Namens-/Punktezeilen beider Partner ineinander
liefen". Der neue Code (`:11744`) gibt jedem Partner statt dessen einen eigenen Kreisversatz:

```js
const eigenPh=kuerHash(u.id,9)*6.2832, eigenR=partner?19:0;
const zielX=grundX+eigenR*Math.cos(buehneT*0.5+eigenPh);
const zielY=grundY+eigenR*0.5*Math.sin(buehneT*0.5+eigenPh);
```

Beide Partner kreisen um denselben Punkt, aber mit **unabhaengig gehashten Phasen**. Damit ist ihr
Abstand nicht gesetzt, sondern Zufall des Hashes — und er kann null werden. Die Groesse ist exakt
berechenbar: `u.id` ist ein fortlaufender Zaehler aus `bauBuehne()` (`:11021`, `id:id++`), Partner
sind immer zwei Eintraege derselben Seite. Ueber alle **30** so erreichbaren `id`-Paare
(2 Seiten x 15) ergibt sich:

| | alter Rastercode | neu (`eigenR=19`) |
|---|---:|---:|
| Partnerabstand, konstant | **52 px** | — |
| Partnerabstand, Median ueber t | — | **23,8 px** |
| bestes Paar | — | 29,5 px |
| **schlechtestes Paar** | — | **1,6 px** |
| Paare unter 26 px (dem Wert, den #857 als noetig ermittelt hatte) | 0 von 30 | **17 von 30** |
| Paare unter 10 px (Sprites praktisch deckungsgleich) | 0 von 30 | **5 von 30** |

Der maximal moegliche Abstand ist `2*eigenR = 38 px` und wird nur bei einer Phasendifferenz von
genau pi erreicht; die vier schlechtesten Paare (`9+11`, `1+3`, `6+8`, `4+5`) liegen bei 1,6 bis
3,3 px mittlerem Abstand — sie stehen dauerhaft ineinander. Auf meinen Aufnahmen ist genau das zu
sehen: bei t=6 s und t=20 s liegen mehrere Namens- und „Pkt"-Zeilen uebereinander
(`Krylov 173 Pkt` / `Johanna 232 Pkt` sind nicht mehr auseinanderzuhalten).

**Der Fix ist eine Zeile**: den Versatz nicht aus `u.id`, sondern aus der **Paar**-ID ziehen und dem
zweiten Partner pi aufaddieren —

```js
const eigenPh=kuerHash(paarId,9)*6.2832+((partner&&u.id!==paarId)?Math.PI:0);
```

Dann stehen die Partner immer diametral, und der Abstand ist `eigenR*sqrt(1+3*cos^2)`, also
garantiert zwischen **19 und 38 px**, nie null. Wer 52 px will, setzt zusaetzlich `eigenR=26`.

**Was nicht haelt — N2: das Schlussbild ist ein Haufen.**

`stepKuer()` schickt jeden Teilnehmer nach seinem letzten Durchgang in die `schlusspose`
(`:11774`):

```js
const zx=F.cx+(partner?(u.id===paarId?-16:16):0), zy=F.cy;
```

Das Ziel haengt **nur** davon ab, ob jemand der erste oder zweite Partner ist — es gibt keinen
Versatz je Paar. Alle sechs Paare laufen also auf **dieselben zwei Punkte** in der Bildmitte zu.
Meine Aufnahme bei t=62 s (Durchgang 12/12) zeigt das Ergebnis: neun der zwoelf Figuren stapeln
sich auf etwa 90 x 60 px, mit drei „DUETT"-Etiketten und sechs Namenszeilen uebereinander —
unleserlich. Das ist **das Schlussbild der Disziplin**, der Moment, in dem das Ergebnis abgelesen
wird. Auch hier reicht eine Zeile: den Zielpunkt je Paar ueber die Flaechenbreite verteilen (etwa
`F.cx+(paarIndex-(paarN-1)/2)*abstand`), wie es das alte Raster tat.

**N3 — die hochgeklappten Etiketten kollidieren mit „DUETT".** Nahe der unteren Bande klappen
Name/Punkte/Balken/Fortschritt nach oben (`:12139`, `flip=py>H*0.68`, `dyName=-46`). Das
„DUETT"-Etikett wird aber **nicht** mitgeklappt: es sitzt unveraendert bei
`Math.min(pa.y,pb.y)-38` (`:12155`). Acht Pixel Abstand bei 8,5 px Schrift heisst: sie ueberlagern
sich. Auf meinen Aufnahmen bei t=6 s (unten rechts) und t=11 s (unten Mitte) laeuft „DUETT" quer
durch die Namenszeile. Der Fix ist, `my` im Flip-Fall ebenfalls zu verschieben.

---

## 7. Behauptung fuer Behauptung

| Behauptung der PR | Befund |
|---|---|
| `stepKuer()` schreibt ausschliesslich `viz*`-Felder | **haelt** (2.1, maschinell extrahiert) |
| ruft nie `rr()` auf | **haelt** (2.1 Text, 2.2 fuenf bit-identische Laeufe, 2.3 Aufrufzaehler) |
| exklusiv auf `art.duett` gegated | **haelt**, mit Gegenprobe: Zaehler steigt bei Gewichtheben um 0 |
| `vizSturz` wird bei keiner anderen Disziplin gesetzt | **haelt**, einzige Schreibstelle im ganzen Repo ist `stepKuer()` |
| 8 Buehnen-Geschwister bit-identisch | **haelt**, selbst nachgemessen |
| `basketball hockey football` bit-identisch | **haelt**, selbst nachgemessen |
| `pruefe-slot-invariante.ts` haelt, max. 0,005 Pp | **haelt**, exakt diese Zahl |
| `tsc --noEmit` vor/nach identisch | **haelt** — aber die Zahl stimmt nicht, s. N4 |
| „keine `.ts`/`.tsx`-Datei angefasst" | **haelt**, der Diff ist 1 `.js` + 3 PNG |
| Positionen aendern sich sichtbar zwischen den Zeitpunkten | **haelt**, an sechs eigenen Aufnahmen |
| Eisflaeche/Bande/Kampfgericht/Kufenspuren sichtbar | **haelt** |
| „eine weitere `else if` fuegt sich reibungslos ein" | **strukturell ja, textuell nein** — s. N5 |
| Movement 60 % → 95 % | **nicht ganz eingeloest** — N1/N2 sind Movement-Maengel, s. N9 |

---

## 8. Nachtraege

**N1 — Partner ohne garantierten Abstand (behebenswert vor dem Deploy).** 17 von 30 erreichbaren
Paarungen liegen unter dem Abstand, den #857 als noetig ermittelt hatte; 5 von 30 stehen praktisch
deckungsgleich. Eine Zeile, Vorschlag in Abschnitt 6.

**N2 — Schlusspose stapelt alle Paare auf zwei Punkte (behebenswert vor dem Deploy).** Trifft das
Schlussbild der Disziplin. Eine Zeile, Vorschlag in Abschnitt 6.

**N3 — „DUETT" wird beim Etiketten-Flip nicht mitgeklappt.** Kollision unten an der Bande, an zwei
eigenen Aufnahmen sichtbar. Eine Zeile.

**N4 — „906 Fehler" sind 906 ZEILEN, nicht 906 Fehler.** `npx tsc --noEmit` liefert in beiden
Baeumen **560** `error TS`-Zeilen auf 906 Ausgabezeilen (die Differenz sind Folgezeilen langer
Typmeldungen). Die tragende Aussage — identisch vor und nach — ist richtig und von mir bestaetigt
(die Ausgaben sind byteweise gleich). Zweiter kleiner Punkt: die PR sagt „alle in `tests/*.ts`"; es
sind **457 in `tests/`, 103 in `scripts/`**. Beides vorbestehend, beides ohne Belang fuer die
Freigabe — nur soll die Aktenlage stimmen.

**N5 — der Kollisionshinweis ist zu optimistisch.** Die PR schreibt, eine weitere `else if` fuege
sich „reibungslos" ein. Strukturell stimmt das; **textuell kollidiert #874 mit #876 an genau dieser
Zeile** und mit #875 an der `buehnenBewegung()`-Ankerstelle — von mir mit `git merge-tree`
nachgemessen, beide `CONFLICT`. Aufloesung in Abschnitt 5. Kein Blocker, aber kein Auto-Merge.

**N6 — der Solo-Rest hat sich zwei Mal veraendert, ohne dass die PR es sagt.** Der alte Code rief
fuer einen Teilnehmer ohne Partner `zeichneSprite(ctx,u,x,y)` — **ohne** den `feldspiel`-Parameter;
neu bekommen alle `zeichneSprite(ctx,u,rx,ry,true)` (`:12127`). Damit wechselt der Solo-Laeufer bei
`u.lunge>0` von der `slash`- auf die `shoot`-Pose. Ausserdem verliert er seine volle Namenszeile
(vorher `u.n` auf 13 Zeichen gekuerzt bei 9,5 px, jetzt nur der Vorname bei 8,5 px). Beides ist
vertretbar — die Duo-Partner verhielten sich schon immer so, und Konsistenz ist besser als zwei
Regeln. Aber es ist eine sichtbare Aenderung an einem Pfad, der in 2 von 5 Saisons vorkommt
(ungerade Feldgroesse, „Frage A"), und die PR-Beschreibung erwaehnt sie nicht.

**N7 — die Kufenspur verschwindet waehrend Pirouette und Sturz.** `haeltStelle` friert die Position
ein (`:11771`), der Ringpuffer wird aber weiter mit demselben Punkt gefuellt. Nach 60 Bildern
(1 s) ist die ganze Spur auf einen Punkt zusammengefallen und damit unsichtbar; eine Pirouette
dauert 1,4 s, ueberlebt also keine Spur. Kosmetisch, leicht zu beheben (waehrend `haeltStelle`
nicht pushen).

**N8 — die Phase `"einlauf"` ist funktionslos.** Sie wird bei der Erstinitialisierung gesetzt
(`:11738`), aber nirgends abgefragt: `haeltStelle` prueft nur `pirouette`, die Zeichenweiche nur
`hebung`/`wurf`/`pirouette`. Nach 1 s wird sie ohnehin zu `"gleiten"`. Kein Fehler, nur ein
Zustandsname ohne Verhalten — beim naechsten Anfassen entweder fuellen oder streichen.

**N9 — „95 %" ist noch nicht verdient, die Richtung schon.** M1/M2/M3 (Grundfahrt, Elemente,
Eisflaeche) sind sauber eingeloest, M4 (Partikel/Posen) ebenfalls. Aber N1 und N2 sind keine
Feinheiten am Rand: sie machen in einem nennenswerten Teil der Paarungen unkenntlich, **wer**
gerade faehrt, und im Schlussbild ausnahmslos. Ich wuerde den Stand heute bei rund 80 % ansetzen
und die 95 % nach der Folgerunde eintragen. Betrifft die Rubrik-Tabelle in
`docs/design/gesamtstand-fertigstellungsgrad-alle-disziplinen-09-10.md`, nicht den Code.

**N10 — `stepKuer()` sucht den Partner in jedem Bild neu.** `TEILNEHMER.find(...)` je Teilnehmer je
Bild, also O(n^2) — bei zwoelf Teilnehmern nicht messbar (der Laufzeitvergleich zeigt kein Regress),
aber unnoetig. Eine Map bei der Erstinitialisierung waere billiger. Reine Aktenlage.

---

## 9. Was ich nicht pruefen konnte

* **Wie es sich anfuehlt.** Ich habe Standbilder bei sechs Zeitpunkten, keine Bewegung im Ablauf.
  Ob die Lissajous-Fahrt „nach Eiskunstlauf aussieht" oder nach Brownscher Bewegung, kann nur Chris
  am laufenden Bild beurteilen. Meine Aufnahmen zeigen, **dass** sich etwas bewegt, und dass es
  ueber die Flaeche verteilt ist — nicht, ob die Kurve schoen ist.
* **Ein deterministischer Vorher/Nachher-Bildvergleich.** Die Szene laeuft in Echtzeit weiter, der
  Screenshot faellt nach Wanduhr; zwei Aufnahmen desselben Baums unterscheiden sich schon deshalb.
  Der Vergleich ist als Beweismittel wertlos, wie schon in der #872-Review festgestellt. N1/N2 sind
  statt dessen am Code gerechnet und in Einzelbildern belegt.
* **Der volle `npx vitest run`.** Er laeuft in dieser Umgebung ueber zehn Minuten. Ich habe die
  sechs einschlaegigen Suiten lokal gefahren (104/104) und stuetze mich im uebrigen auf den gruenen
  CI-Job `full-test-suite` auf genau diesem Kopf-SHA.
* **Der Server.** Wie in `CLAUDE.md` beschrieben kommen Agenten nicht heran.
* **Der gemergte Zustand mit #875 und #876.** Ich habe die Konflikte nachgewiesen und die
  Aufloesung fuer #876 hergeleitet, aber den zusammengefuehrten Baum nicht selbst gebaut und
  gemessen. Fuer #875 hat das die #877-Review getan.

---

## 10. Fazit

Der technisch riskante Teil dieser PR — eine neue Funktion an einem geteilten Dispatcher, eine
Erweiterung an einer Zeichenfunktion, die vierzehn Disziplinen mitbenutzen — ist **sauber gemacht
und haelt jeder Probe stand, die ich ihm stellen konnte**. Fuenf unabhaengige Messlaeufe ueber
siebzehn Disziplinen sind bit-identisch mit `main`, der `tsc`-Ausstoss ist byteweise gleich, die
Slot-Invariante haelt mit 0,005 Pp gegen eine Schranke von 0,2 Pp, 104 lokale Tests und alle vier
CI-Jobs sind gruen. Die `rr()`-Neutralitaet habe ich nicht geglaubt, sondern an **11 157
tatsaechlichen Aufrufen** gemessen — und mit demselben Zaehler bewiesen, dass keine andere
Disziplin die Funktion je erreicht. Der Verzicht auf `u.down` zugunsten eines eigenen `vizSturz`
ist genau die Entscheidung, die der Vertrag verlangt.

Was fehlt, ist die letzte Meile am Bild selbst. Eiskunstlauf faehrt jetzt — aber in einem knappen
Sechstel der Paarungen faehrt es ineinander, und am Ende stapelt es sich in der Mitte. Das sind
zwei Zeilen Arbeit, kein Entwurfsfehler, und beide sind hier mit Zahl und Vorschlag beschrieben.

**FREIGEBEN MIT NACHTRAG.** Kein Blocker. **N1 und N2 gehoeren in eine kurze Folgerunde, bevor
Eiskunstlauf auf dem Server steht** — die Disziplin ist live, und N2 trifft das Bild, mit dem jede
Kuer endet. **N5 gehoert an die Merge-Reihenfolge**: #874 kollidiert textuell mit #875 und #876,
kein Auto-Merge. Die uebrigen acht Nachtraege sind Aktenlage.

---
_Generated by [Claude Code](https://claude.ai/code)_
