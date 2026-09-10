# Opus-Overseer-Review PR #883 — Takeshi's Castle: die vier Ton-Aufrufstellen verdrahten (A4 0 → 20)

**Datum:** 10.09.2026
**PR:** #883, Branch `claude/takeshi-ton-verdrahtung-10-09`, Kopf `3abf56b1`
**Basis der PR:** `46b90c8e`
**`origin/main` bei Pruefende:** `743e1186` (nur ein Dokument dazugekommen, s. u. — kein Code)
**Reviewer:** unabhaengiger Opus-Overseer, an der PR nicht mitgearbeitet
**Pruefumgebung:** eigener Worktree `/tmp/oly-review-883` auf `3abf56b1`, Vergleichsbaum
`/tmp/oly-review-main` auf `46b90c8e`, `node_modules` je als Symlink auf den Hauptbaum. Der
geteilte Hauptbaum wurde nicht angefasst; die eigene Playwright-Sonde lag ausserhalb des Index
und ist nach dem Lauf wieder entfernt worden.

---

## Freigabe-Empfehlung

# FREIGEBEN MIT NACHTRAG

Der harte Vertrag haelt — vollstaendig, empirisch, ohne Ausnahme. Siebzehn gemessene Disziplinen
sind **bit-identisch** mit `main`, `tsc` liefert **zeichengleiche** Ausgabe, die Slot-Invariante
haelt, die vier CI-Jobs auf `3abf56b1` sind **gruen**, und der Probemerge gegen den aktuellen
`main` ist sauber. Es gibt keinen `rr()`-Aufruf, keine Score-Mutation, keinen `pageerror`.

Die beiden Behauptungen, die am ehesten haetten falsch sein koennen, habe ich selbst nachgemessen
und **beide bestaetigt**:

* **Die Gates sind echt.** Nicht nur im Diff gelesen, sondern gemessen: ein Rennen in
  `spurt`, `staffel`, `time-trial` und `climbing` erzeugt **null** `sfx()`-attribuierte Toene.
  Diesen Leck-Test hat die PR selbst nicht gefahren; er ist der eigentliche Kern des Risikos,
  weil der Huerden- und der Ziel-Einlauf-Zweig mit vier Geschwistern geteilt sind.
* **Der N1-Fix ist echt UND tragend.** Die Startfolge 1/2/3 der PR reproduziert sich bei mir als
  1/2/3/4 ueber vier Kaempfe. Und im Gegenversuch — dieselbe Sonde auf einem Baum, aus dem ich
  die eine Zeile `takeshiPublikumAn=false;` aus `reset()` wieder herausgeschnitten habe — kippt
  sie auf **1/1/1/1**. Die Zeile ist nicht Zierrat, sie ist der Unterschied zwischen einem
  Publikum, das wiederkommt, und einem, das nach dem ersten Kampf fuer immer schweigt.

**Nachzubessern sind drei Dinge, keins davon ein Merge-Blocker** (Abschnitt 7): der Katalogeintrag
`platsch` bleibt tot, das Ausscheiden bekommt ausgerechnet den Torklang, und die Ton-Dichte ist
mit gemessenen **227 Ein-Schuss-Toenen pro Rennen** ungedrosselt und unabgeschwaecht. Die ersten
beiden Punkte loesen sich gegenseitig — s. 7.1.

---

## 1. Was ich selbst gefahren habe

Alles synchron und blockierend, kein Hintergrundlauf.

| Lauf | Ergebnis |
|---|---|
| `miss-alle-disziplinen.mjs 24 takeshis-castle staffel spurt time-trial climbing`, `3abf56b1` vs. `46b90c8e` | **bit-identisch** (`diff` leer) |
| `miss-alle-disziplinen.mjs 24 gewichtheben speed-schach showcase eiskunstlauf breaking wettessen tennis fechten i-spy` | **bit-identisch** |
| `miss-alle-disziplinen.mjs 24 basketball hockey football` | **bit-identisch** |
| `npx tsc --noEmit`, beide Baeume | **je 560 Fehler, `diff` LEER** |
| `npx tsx scripts/pruefe-slot-invariante.ts` | **haelt**, max. 0,005 Pp (Schranke 0,2 Pp) |
| `grep -o 'sfx("takeshis-castle"' … \| wc -l` | **4** (selbst nachgezaehlt) |
| eigene Playwright-Sonde, Publikums-Loop ueber **vier** Kaempfe | **1/2/3/4**, Stops 0/1/2/3 |
| dieselbe Sonde, **Gegenversuch ohne die reset()-Zeile** | **1/1/1/1** — der Fix ist tragend |
| dieselbe Sonde, Leck-Test in spurt/staffel/time-trial/climbing | **0 / 0 / 0 / 0** Ton-Ereignisse |
| PR-eigene `scripts/probe-takeshi-ton.mjs`, unveraendert nachgefahren | **BESTANDEN**, Zahlen exakt wie im PR-Text (147/43/18) |
| GitHub-CI auf `3abf56b1` | **4/4 gruen** |
| Probemerge `main`(743e1186) x `3abf56b1` | **sauber** |

Die Zahlen zur Aktenlage, auf **beiden** Seiten identisch:

```
staffel   0.915 | spurt 0.871 | takeshis-castle 0.861 | time-trial 0.828 | climbing 0.790
speed-schach 0.908 | showcase 0.892 | eiskunstlauf 0.885 | breaking 0.869 | gewichtheben 0.854
wettessen 0.845 | tennis 0.825 | fechten 0.816 | i-spy 0.684 (durchgefallen, wie vorher)
basketball 0.769 | hockey 0.669 (Feldspieler 0.719) | football 0.516
```

Takeshi steht unveraendert bei **0,861 / 0,116 / 0,930 / 0,056** — genau den vier Zahlen der
Abschlussverifikation. Hockey liest 0,669 / 0,719 wie in CLAUDE.md. Eine reine Ton-PR darf keine
Nachkommastelle bewegen, und sie bewegt keine.

**Zur Merge-Reihenfolge:** `origin/main` ist waehrend des Reviews von `46b90c8e` auf `743e1186`
gewandert. Der Unterschied ist **ausschliesslich** `docs/design/feinschliff-abschlussverifikation-10-09.md`
(250 Zeilen, ein Dokument). Kein Code, kein `battle-mode.engine.js`. Meine Messungen gegen
`46b90c8e` gelten deshalb unveraendert gegen `743e1186`.

---

## 2. Der Diff, Zeile fuer Zeile

39 Zeilen in `public/mockups/battle-mode.engine.js`, davon 26 Kommentar. Dazu 168 Zeilen neue
Sonde in `scripts/probe-takeshi-ton.mjs`. Sonst nichts — keine Datei, kein Test, kein Asset.

Die substanziellen Zeilen sind sieben:

| # | Ort | Zeile |
|---|---|---|
| 1 | vor `bodenTakeshiRoute()` `:17237` | `let takeshiPublikumAn=false;` |
| 2 | erste Zeile in `bodenTakeshiRoute()` `:17239` | `if(!takeshiPublikumAn){ tonLoopStart("takeshis-castle"); takeshiPublikumAn=true; }` |
| 3 | erste Zeile in `bodenSpurt()` `:17416` | `if(!istRoute()&&takeshiPublikumAn){ tonLoopStop(); takeshiPublikumAn=false; }` |
| 4 | Fallen-Protokoll `:19345` | `if(A.takeshi)sfx("takeshis-castle","falle");` |
| 5 | Ausscheiden `:19448` | `if(A.takeshi)sfx("takeshis-castle","tor");` |
| 6 | Sturz `:19458` | `if(A.takeshi)sfx("takeshis-castle","sturz");` |
| 7 | Ziel-Einlauf `:19670` | `if(BA().takeshi)sfx("takeshis-castle","tor");` |
| 8 | `reset()` `:21678` | `takeshiPublikumAn=false;` |

### 2.1 Sind die Gates wirklich Gates?

Ja — und zwar auf beiden Wegen, den ich zu pruefen hatte.

**Der Schluessel im Code.** `takeshi:true` steht im ganzen `battle-mode.engine.js` **genau
einmal**, in `BAHN_ART["takeshis-castle"]` (`:18098`). Kein Spurt, keine Staffel, kein
Zeitfahren, kein Klettern traegt die Flagge. `BA()` liefert die Bahn-Konfiguration der aktuellen
Disziplin, also ist `BA().takeshi` eine exakte Disziplin-Schranke.

**Ist `A` an den Stellen 4/5/6 wirklich `BA()`?** Das war die Frage, die ich nicht glauben
wollte, weil `A` in dieser Datei dreimal als lokales `const A=BA()` vorkommt (`:18518`,
`:19016`, `:19324`) und ein Griff auf das falsche `A` genau so aussieht wie ein richtiger. Ich
habe deshalb die Klammertiefe zwischen `:19317` (`if(vor<h&&u.pos>=h){`) und `:19462`
mechanisch nachgezaehlt: `const A=BA();` steht auf `:19324` in Tiefe 1 dieses Blocks, die
Aufrufe auf `:19345` (Tiefe 1), `:19448` (Tiefe 2) und `:19458` (Tiefe 1). Alle drei liegen im
selben Block wie die Deklaration. `A` ist dort `BA()`, kein anderes.

An `:19670` liegt die Deklaration nicht mehr im Scope — die PR sagt das selbst im Kommentar und
schreibt dort korrekt `BA().takeshi` aus. Kein blindes Kopieren; die Stelle wurde verstanden.

**Der Beweis am laufenden Spiel.** Codelesen reicht mir hier nicht, weil eine falsche Gate
lautlos falsch ist. Meine Sonde (Abschnitt 5) faehrt je ein Rennen in `spurt`, `staffel`,
`time-trial` und `climbing` bei 4x und zaehlt **jedes** Audio-Ereignis, das ueber `sfx()` oder
`tonLoopStart()` in den Stack kommt:

```
spurt        sfx/loop-attribuierte Ereignisse: 0   laufende Loop-Quellen: 0
staffel      sfx/loop-attribuierte Ereignisse: 0   laufende Loop-Quellen: 0
time-trial   sfx/loop-attribuierte Ereignisse: 0   laufende Loop-Quellen: 0
climbing     sfx/loop-attribuierte Ereignisse: 0   laufende Loop-Quellen: 0
```

Null, nicht "wenig". Die vier Geschwister bleiben stumm. Damit ist die Sorge, die diese PR
ueberhaupt review-pflichtig macht, empirisch erledigt.

### 2.2 Die Loop-Buchfuehrung

Drei Loeschpfade fuer `takeshiPublikumAn`, und sie decken zusammen alles ab:

* `reset()` — laeuft bei jedem Neustart **und** bei jedem Disziplinwechsel, denn
  `setDisc:(d)=>{ disc=d; reset(); }` (`:23429`). Das ist der wichtige Pfad.
* `bodenSpurt()` — faengt den Fall ab, dass innerhalb des Bahn-Chassis von der Route auf eine
  Rechteck-Bahn gewechselt wird, ohne dass `reset()` dazwischen lag.
* implizit `tonLoopStart()` selbst, das als erstes `tonLoopStop()` ruft (`:16945`). Zwei
  ueberlagerte Loops sind konstruktiv unmoeglich, auch wenn die Flaggenbuchfuehrung einmal
  danebengreifen sollte. Das ist eine gute Eigenschaft der Ton-Schicht aus PR #872 und sie traegt
  hier mit.

Was `bodenSpurt()` **nicht** abdeckt: einen Wechsel von Takeshi auf ein Buehnen-, Feldspiel- oder
Arena-Chassis. Dort wird `bodenSpurt()` nie mehr gerufen. Der Pfad ist trotzdem dicht, weil
`setDisc()` `reset()` ruft — aber die Dichtheit haengt an `reset()`, nicht am
Boden-Bookkeeping. Genau dieselbe Struktur hat Gewichtheben seit #879, also ist es
Muster-treu; ich notiere es nur, damit die naechste Runde weiss, wo der Verlass liegt.

### 2.3 `rr()`-Neutralitaet auf dem Papier

Die Aufrufkette der neuen Zeilen ist kurz und vollstaendig lesbar: `sfx()` (`:16927`) →
Katalog-Lookup → `eintrag.synth(vol)` → `tonSchlag` / `tonMetall` / `tonKlick` / `tonRauschen`.
`tonLoopStart()` (`:16943`) → derselbe Satz. Keine dieser sieben Funktionen ruft `rr()`, liest
oder schreibt ein Feld an `u`, an `LAEUFER`, an `rennFertig` oder an `BA()`. Alles laeuft in
`try{}catch(e){}`, ein fehlender AudioContext ist ein stiller No-Op.

Das ist der Papierbeweis. Der empirische steht in Abschnitt 1: siebzehn Disziplinen, `diff`
leer. Bei einem versehentlichen `rr()`-Griff waere jede Bahn-Disziplin sofort auseinandergelaufen.

---

## 3. Die Ereignisnamen: nichts erfunden, nichts vertauscht

`TON_KATALOG["takeshis-castle"]` (`:16914-16920`) fuehrt fuenf Eintraege:

```js
falle:    tonSchlag(vol,180,70,0.14) + tonKlick(vol*0.7,1200,0.05)
sturz:    tonSchlag(vol*0.8,260,60,0.3) + tonRauschen(vol*0.5,700,0.3,false)
platsch:  tonRauschen(vol,900,0.4,false)
tor:      tonMetall(vol,300,0.6)
publikum: {loop:true} tonRauschen(vol,500,0,true)
```

Verdrahtet sind `falle`, `sturz`, `tor`, `publikum` — vier von fuenf, alle vier mit dem exakten
Katalog-Schluessel, keine Tippfehler, keine Vertauschung. `sfx()` waere bei einem Tippfehler ein
stiller No-Op gewesen; ich habe die Namen deshalb nicht nur gelesen, sondern die drei
Ein-Schuss-Ereignisse ueber ihre Klangsignatur im laufenden Rennen wiedergefunden (Abschnitt 5).

**Der Abgleich mit dem Auftrag stimmt Stelle fuer Stelle.** Die Abschlussverifikation (#882,
Abschnitt 6, Nachbesserung 1) hatte vier Stellen namentlich benannt:

| Ton | von #882 verlangt | in #883 gebaut |
|---|---|---|
| `falle` | `:19326`, bei `u.fallen.push({… aus:'sauber'})` | `:19345`, direkt nach genau diesem `push` |
| `sturz` | `:19431`, bei `schwebe({… txt:"stolpert"})` | `:19458`, direkt vor genau diesem `schwebe` |
| `tor` | `:19425` / `:19637`, beide `rennFertig.push(u)` | `:19448` / `:19670`, beide `rennFertig.push(u)` |
| `publikum` | Loop in `bodenTakeshiRoute()` | `:17239`, erste Zeile der Funktion |

Die Zeilennummern verschieben sich um genau den Betrag, den die eingefuegten Kommentarzeilen
erklaeren. Die PR hat den Auftrag nicht interpretiert, sie hat ihn abgearbeitet.

**`platsch` ist also keine Abweichung vom Auftrag** — #882 hatte es nie verlangt. Es ist aber
sehr wohl eine offene Luecke im Katalog, und die gehoert benannt (7.1).

---

## 4. Nachgezaehlt statt uebernommen

```
$ grep -o 'sfx("takeshis-castle"' public/mockups/battle-mode.engine.js | wc -l
4
```

Vier, wie behauptet. Zur Kontrolle die vollstaendige Liste aller `sfx("`-Aufrufstellen der Datei
nach dieser PR — elf, davon vier neu:

```
:11702 gewichtheben ansage      :12016 breaking powermove   :12023 breaking freeze
:12025 breaking abbruch         :12739 gewichtheben gueltig + stange_hoch
:12740 gewichtheben ungueltig + scheiben_fall
:19345 takeshis-castle falle    :19448 takeshis-castle tor
:19458 takeshis-castle sturz    :19670 takeshis-castle tor
```

`tonLoopStart()` steht jetzt dreimal: Gewichtheben `:12120`, Breaking `:21681`, Takeshi `:17239`.
Vor dieser PR zweimal — die Abschlussverifikation hatte genau das als Beleg fuer A4 = 0 angefuehrt.

---

## 5. Der N1-Beweis, selbst gebaut — und der Gegenversuch

Ich habe die PR-eigene Sonde **nicht** blind uebernommen. Ihr methodischer Schwachpunkt ist, dass
sie ein Ereignis allein an der Oszillator-Frequenz erkennt: ein Sinus bei 180 Hz koennte im
Prinzip aus jeder anderen Tonquelle der Seite stammen, und der Beweis "der Ton kam aus MEINER
neuen Aufrufstelle" waere dann keiner.

Meine Sonde attribuiert deshalb zusaetzlich ueber den **Stack**. Sie patcht in einem
`addInitScript` (also vor jedem Seitenskript) `createOscillator`, `createBufferSource`,
`createBiquadFilter` und `AudioParam.setValueAtTime` und schreibt bei jedem `start()` mit, ob im
Stack die Frames `at sfx (`, `at tonLoopStart (`, `at tonSchlag (`, `at tonMetall (`,
`at tonRauschen (` oder `at tonKlick (` stehen. Ein Treffer zaehlt nur, wenn Frequenz **und**
Herkunftskette passen. Dazu vier statt drei Kaempfe und der Leck-Test aus 2.1.

**Teil A — Publikums-Loop, vier aufeinanderfolgende Kaempfe:**

```
Kampf 1: Loop-Starts=1  Loop-Stops=0
Kampf 2: Loop-Starts=2  Loop-Stops=1
Kampf 3: Loop-Starts=3  Loop-Stops=2
Kampf 4: Loop-Starts=4  Loop-Stops=3
```

Die Behauptung der PR reproduziert sich und traegt eine Runde weiter, als die PR selbst gemessen
hat.

**Der Gegenversuch — das eigentliche Argument.** Eine Startfolge 1/2/3/4 beweist fuer sich noch
nicht, dass sie *an dieser einen Zeile* haengt. Ich habe deshalb in meinem Worktree
`takeshiPublikumAn=false;` aus `reset()` wieder herausgeschnitten und dieselbe Sonde erneut
gefahren:

```
Kampf 1: Loop-Starts=1  Loop-Stops=0
Kampf 2: Loop-Starts=1  Loop-Stops=1
Kampf 3: Loop-Starts=1  Loop-Stops=1
Kampf 4: Loop-Starts=1  Loop-Stops=1
```

1/1/1/1 — exakt das N1-Muster aus PR #876/#879. Das Publikum haette ab dem zweiten Takeshi-Kampf
fuer immer geschwiegen. **Die Zeile ist tragend, der Fix ist echt.** Danach habe ich die Datei
wiederhergestellt (`git status` sauber).

Nebenbefund aus dem Gegenversuch: die Ein-Schuss-Zahlen waren in beiden Laeufen identisch
(165 `falle`), was noch einmal bestaetigt, dass die Simulation von der Ton-Schicht nicht beruehrt
wird — nicht einmal ueber den Umweg der Wallclock.

**Teil B — die drei Ein-Schuss-Ereignisse in einem echten 4x-Rennen (50 s Wallclock):**

```
falle   (sine 180,  via sfx -> tonSchlag):   165
sturz   (sine 260,  via sfx -> tonSchlag):    50
tor     (square ~300, via sfx -> tonMetall):  24 Oszillatoren = 12 Toene
platsch (bandpass 900, via sfx -> tonRauschen): 0
sfx-attribuierte Audio-Ereignisse gesamt: 681 (von 681 insgesamt)
Seitenfehler: keine
```

Alle drei feuern, ueber `sfx()` attribuiert, im echten Spielablauf — nicht nur, wenn man `sfx()`
von aussen anstupst. `tor` kommt paarweise, wie `tonMetall()` es baut. Und `platsch` kommt nie
(7.1).

**Teil C — die PR-eigene Sonde, unveraendert nachgefahren.** Sie meldet `147 / 43 / 18` und
`GESAMT: BESTANDEN`, also **exakt die Zahlen, die im PR-Text stehen**. Der PR-Text ist an dieser
Stelle ehrlich berichtet, nicht geschoent.

---

## 6. CI und Merge-Lage

Alle vier Jobs auf `3abf56b1` **gruen**:

| Job | Ergebnis |
|---|---|
| `test-and-smoke` | success |
| `full-test-suite` | success |
| `persistenz-suiten` | success |
| `pps-referenz-frische` | success |

Probemerge `main`(743e1186) x `3abf56b1`: **sauber**. `mergeable_state` steht auf `blocked` — das
ist die Review-Pflicht, nicht ein Konflikt.

---

## 7. Nachtrag — drei Punkte, keiner blockiert

### 7.1 `platsch` bleibt tot — und ausgerechnet das Ausscheiden bekommt den Torklang

Das sind zwei Befunde, aber sie haben eine gemeinsame Loesung, deshalb stehen sie zusammen.

**Der Befund.** Von fuenf Katalog-Ereignissen sind vier verdrahtet. `platsch` — ein
Rauschstoss ueber Bandpass 900 Hz, also genau das Klatschen eines Koerpers ins Wasser — bleibt
ohne Aufrufstelle. Meine Sonde bestaetigt es am laufenden Spiel: **0 Treffer** ueber ein ganzes
Rennen. Es geht auch in keinem der vier anderen Toene auf: `falle` ist ein Schlag 180 → 70 Hz mit
Klick, `sturz` ein Schlag 260 → 60 Hz mit kurzem Rauschen. Beides sind Aufprall-Klaenge auf
festem Grund, kein Wasser. Der Katalogeintrag ist also nicht redundant, er ist unbenutzt.

**Warum das mehr als Kosmetik ist:** die Strecke hat Wasser, und zwar an drei benannten Stellen.
`BAHN_ART["takeshis-castle"].fallenBild` (`:18146`) fuehrt `steine` (Skipping Stones, Wasser),
`brueckenball` (Bridge Ball, Planke ueber Wasser) und `schlamm` (Dragon God Lake, Schlammgrube);
`zeichneFalleTakeshi()` malt fuer alle drei tatsaechlich Wasser bzw. Schlamm (`:17123`, `:17154`,
`:17201`). Ein Laeufer, der an einer dieser drei Fallen stuerzt, faellt sichtbar ins Wasser und
klingt wie einer, der auf Beton faellt.

**Der zweite Befund im selben Atemzug:** `:19448` spielt beim **Ausscheiden** den Ton `tor` —
`tonMetall(vol,300,0.6)`, einen metallischen Gong. Das ist der Erfolgsklang des Zieltors, und er
laeuft hier ueber die Feed-Zeile „*scheidet aus — Nerven am Ende*". Die PR ist damit
auftragstreu (#882 hat beide `rennFertig.push(u)`-Stellen ausdruecklich als `tor` benannt: „Ziel
erreicht bzw. ausgeschieden"), aber auftragstreu und richtig sind hier nicht dasselbe. Wer
ausscheidet, hat kein Tor durchschritten.

**Die Loesung schliesst beides zugleich.** `platsch` am Ausscheide-Zweig statt `tor` — das ist
der Klang, den die Sendung an dieser Stelle hat (der Kandidat landet im Wasser), und der tote
Katalogeintrag ist damit lebendig. Zwei Zeichen Aenderung:

```js
if(A.takeshi)sfx("takeshis-castle","platsch");   // statt "tor", :19448
```

Wer es genauer will, nimmt zusaetzlich den Fallentyp mit — der Index liegt an der `falle`-Stelle
ohnehin schon vor (`HUERDEN_N().indexOf(h)`), und `fallenLook(i)` (`:17052`) liefert daraus
deterministisch den Bild-Namen:

```js
const look=fallenLook(HUERDEN_N().indexOf(h));
if(A.takeshi)sfx("takeshis-castle", ["steine","brueckenball","schlamm"].includes(look)?"platsch":"falle");
```

**Bewertung fuer die Rubrik:** A4 = 20/20 ist damit knapp, aber vertretbar — die Rubrik fragt
„verdrahtet, nicht nur katalogisiert", und der Katalog ist zu 4/5 verdrahtet, mit Loop und
Reset-Fix, also strukturell auf demselben Stand wie Gewichtheben und Breaking. Ich wuerde 18/20
geben und die zwei Punkte mit dem toten `platsch` begruenden. Am Gesamturteil (Assets 75 → 93–95 %,
Takeshi gesamt 87 → 91–92 %) aendert das nichts Wesentliches.

### 7.2 Ton-Dichte: 227 Ein-Schuss-Toene pro Rennen, ungedrosselt und unabgeschwaecht

Gemessen, nicht geschaetzt: ein Takeshi-Rennen loest **165 `falle` + 50 `sturz` + 12 `tor` = 227**
Ein-Schuss-Toene aus. Im 4x-Lauf draengten die sich in unter 50 Sekunden Wallclock zusammen, also
im Mittel **mehr als vier Toene pro Sekunde**, in Spitzen deutlich mehr (zwoelf Laeufer treffen
dieselbe Falle nahezu gleichzeitig — das „Gedraenge an der Falle" ist ja gerade Absicht der
Mechanik).

Das ist eine Groessenordnung mehr als bei allen bisherigen Ton-Aufrufstellen: Gewichtheben und
Breaking feuern je Phasenuebergang **eines** Akteurs, hier feuert **jeder der zwoelf Laeufer an
jeder Falle**. Eine Drossel gibt es in der Ton-Schicht nirgends (`grep` nach Drossel-/Throttle-
Mustern: kein Treffer, auch nicht bei den bestehenden Disziplinen) — bisher brauchte es keine.

`sfx(disziplin,ereignis,vol)` nimmt einen dritten Parameter; die PR nutzt ihn nicht und laesst
alles auf dem Standard 0,6 laufen. Der naheliegende Nachtrag ist eine Abschwaechung nach
Kamera-Naehe oder Fokus-Laeufer (`bahnFokusAuto` und `laeuferXY()` liegen beide vor), oder eine
einfache Zusammenfassung, wenn mehrere Laeufer dieselbe Falle im selben Frame ausloesen. Das ist
Feinschliff und kein Fehler — aber es sollte gehoert werden, bevor Chris es hoert.

### 7.3 Der Loop endet nicht mit dem Rennen

`takeshiPublikumAn` wird nur in `reset()` und in `bodenSpurt()` geloescht, nicht bei `done`. Das
Publikum jubelt nach dem Zieleinlauf weiter, bis der naechste Kampf gestartet oder die Disziplin
gewechselt wird. Gewichtheben verhaelt sich identisch (`:12110` / `:21672`), Breaking bindet
seinen Beat dagegen an `running` (`:21681`). Muster-treu, also kein Einwand gegen diese PR — aber
die drei Disziplinen sind an dieser Stelle nicht einheitlich, und irgendwann sollte eine Runde
entscheiden, welches der beiden Muster gilt.

---

## 8. Was ich geprueft und **nicht** beanstandet habe

* **Die neue Sonde `scripts/probe-takeshi-ton.mjs`** ist sauber gebaut, gut kommentiert und
  faehrt bei mir durch. Ihre Methode (Frequenz-Buckets) ist schwaecher als eine
  Stack-Attribution, aber ihre Buckets sind fuer diesen Test tatsaechlich kollisionsfrei: meine
  Messung zeigt, dass in einem Takeshi-Rennen **681 von 681** Audio-Ereignissen ueber `sfx()`
  kommen, es also gar keine Fremdquelle gibt, die die Buckets verunreinigen koennte. Der Befund
  der PR steht.
* **Kein Testfile mitgeliefert.** Fuer eine reine Praesentations-PR ist eine Playwright-Sonde im
  Repo der richtige Ort; ein Vitest-Fall haette hier nichts zu pruefen, was die Sonde nicht
  besser prueft.
* **Der `A`-vs-`BA()`-Wechsel zwischen `:19458` und `:19670`** ist kein Schlamperei-Zeichen,
  sondern die richtige Antwort auf zwei verschiedene Scopes — und im Kommentar ausdruecklich so
  begruendet. Das ist gutes Handwerk.
* **Doppelte Loops** sind konstruktiv ausgeschlossen (`tonLoopStart()` ruft `tonLoopStop()` als
  erstes). Ich habe es zusaetzlich gemessen: Stops laufen den Starts immer genau um eins hinterher.

---

## 9. Verdikt

# FREIGEBEN MIT NACHTRAG

**Freigeben, weil:** der Vertrag empirisch haelt (17 Disziplinen bit-identisch, `tsc`
zeichengleich, Slot-Invariante gruen, CI 4/4, Probemerge sauber), die Gates nicht nur behauptet,
sondern **gemessen** dicht sind (null Ton-Leck in vier Geschwister-Disziplinen), die vier
Ereignisnamen exakt aus dem Katalog stammen, die vier Aufrufstellen exakt die von #882 benannten
sind, und der N1-Fix im Gegenversuch nachweislich **tragend** ist. Die zentrale Behauptung dieser
PR — Loop-Start 1/2/3 statt 1/1/1 — ist wahr, und sie ist es aus dem Grund, den die PR angibt.

**Mit Nachtrag, weil:** `platsch` als einziger von fuenf Katalogeintraegen tot bleibt und der
Ausscheide-Zweig ausgerechnet den Torklang bekommt — ein Befund, den ein einziger geaenderter
String zugleich behebt (7.1); und weil die gemessene Ton-Dichte von 227 Ein-Schuss-Toenen je
Rennen ohne Drossel und ohne Lautstaerke-Abstufung laeuft (7.2). Beides gehoert in die naechste
Takeshi- oder Ton-Runde, nicht in diese PR.

**A4 aus meiner Sicht: 18–20 von 20.** Takeshi-Assets damit 93–95 %, Takeshi gesamt 91–92 % —
die Marke ist gerissen, das Ziel der PR ist erreicht.

---
_Generated by [Claude Code](https://claude.ai/code)_
