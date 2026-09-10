# Opus-Overseer-Review PR #876 — Ziel 1: Gewichtheben-Assets (Hantel an der Hand, Hebebuehne, Ton)

**Datum:** 10.09.2026
**PR:** #876, Branch `claude/feinschliff-ziel1-gewichtheben-09-10`, Kopf `87ab3fd5`
**Basis der PR:** `3f2c7a4f` (Stand von `main` bei PR-Eroeffnung)
**Reviewer:** unabhaengiger Opus-Overseer, an der PR nicht mitgearbeitet
**Pruefumgebung:** eigener Worktree `…/scratchpad/wt-876` auf `87ab3fd5`, `node_modules`-Symlink auf
den Hauptbaum; Vergleichsbaum `…/scratchpad/wt-r876-main` auf `3f2c7a4f`. Der geteilte Hauptbaum
wurde nicht angefasst.

**Wichtig fuer die Merge-Reihenfolge — die Lage hat sich WAEHREND dieses Reviews geaendert:**
`origin/main` stand bei Pruefbeginn auf `3f2c7a4f` (Basis dieser PR) und steht bei Pruefende auf
`afb770ec` — **#875 (Breaking) ist inzwischen gemergt, #874 (Eiskunstlauf) noch nicht.** Ich habe
deshalb zusaetzlich den *gemergten* Stand `main + #876` gemessen und geprueft. Genau aus dieser
Verschiebung faellt der einzige substanzielle Befund dieses Reviews (N1).

---

## Freigabe-Empfehlung

# FREIGEBEN MIT NACHTRAG

Der harte Vertrag haelt — vollstaendig, empirisch und ohne Ausnahme. Alle 17 gemessenen
Disziplinen sind bit-identisch mit `main`, in beiden Basisstaenden. Es gibt keinen `rr()`-Aufruf,
keine verbotene Mutation, keinen neuen TypeScript-Fehler, keinen `pageerror`, und die vier
CI-Jobs auf `87ab3fd5` sind gruen. Nichts hieran blockiert einen Merge.

**Nachzubessern ist ein echter, von mir reproduzierter Fehler in der Ton-Buchfuehrung (N1)** —
nicht am Motor, nicht an der Rangtreue, aber am hoerbaren Ergebnis: der Publikums-Loop des
Gewichthebens kehrt nach dem ersten `reset()` nie wieder. Das ist eine Einzeiler-Korrektur und
kann als Nachtrag in die naechste Gewichtheben-Runde, muss aber benannt werden, weil der Merge von
#875 den Fehler von "Loop laeuft zu lange" in "Loop laeuft nur einmal" gedreht hat — und die
zweite Fassung faellt niemandem beim Lesen des Diffs auf.

---

## 1. Was ich selbst gefahren habe

Alles synchron und blockierend, kein Hintergrundlauf.

| Lauf | Ergebnis |
|---|---|
| `miss-alle-disziplinen.mjs 24` x 9 Buehne, `87ab3fd5` vs. `3f2c7a4f` | **bit-identisch** (`diff` leer) |
| `miss-alle-disziplinen.mjs 24 basketball hockey football` (die `zeichneSprite()`-Familie) | **bit-identisch** |
| `miss-alle-disziplinen.mjs 24` x 5 Bahn | **bit-identisch** |
| dieselben 9 Buehne, **`main`(afb770ec) + #876 gemergt** vs. `main` | **bit-identisch** |
| `main`(afb770ec) vs. alte Basis `3f2c7a4f`, 9 Buehne | **bit-identisch** (auch #875 hat nichts bewegt) |
| `npx tsc --noEmit`, beide Baeume | **906 Zeilen, 560 Fehler, `diff` LEER** |
| `npx vitest run arena-barbell-glide arena-token-rank-size` | **10/10 gruen** (plus `arena-token-rank-badge-contract`: 14/14) |
| `npx tsx scripts/pruefe-slot-invariante.ts` | **gruen**, max. 0,005 Pp (Schranke 0,2 Pp) |
| `scripts/messe-heben-handpunkt.mjs` (eigene Reproduktion der Handpunkt-Messung) | **teilweise reproduziert**, s. 5 |
| `scripts/screenshot-disziplin.mjs gewichtheben` bei 2,5 / 6 / 9 / 16 s, **beide Baeume** | **0 `pageerror`** ueberall |
| eigene Playwright-Sonde: `rr()`-Neutralitaet der Ton-Schicht | **zeichengleich** nach 2000 `sfx()` + 50 Loops |
| eigene Playwright-Sonde: Publikums-Loop-Buchfuehrung, beide Baeume | **N1 bestaetigt**, s. 6 |
| GitHub-CI auf `87ab3fd5` | **4/4 gruen** |
| Probemerge #876 x #874 / #876 x #875 / #876 x `main`(afb770ec) | **1 Konflikt / sauber / sauber** |

Die Zahlen, zur Aktenlage — auf **beiden** Seiten identisch, in **beiden** Basisstaenden:

```
speed-schach  0.908 | showcase 0.892 | eiskunstlauf 0.885 | breaking 0.869 | gewichtheben 0.854
wettessen     0.845 | tennis   0.825 | fechten      0.816 | i-spy     0.684 (durchgefallen, wie vorher)
basketball    0.769 | hockey   0.669 | football     0.516
staffel       0.915 | spurt    0.871 | takeshis-castle 0.861 | time-trial 0.828 | climbing 0.790
```

Gewichtheben steht damit unveraendert bei **0,854 / 0,209 / 0,923 / 0,273** — genau die vier
Zahlen, die die PR nennt. Die Abnahme-Lage ist die von `main`; diese PR bewegt keine
Nachkommastelle. Das ist auch die einzige richtige Antwort fuer eine reine Asset-PR.

**Laufzeit-Gegenprobe.** Weil die PR erstmals einen `sfx()`-Aufruf in den *Motorpfad* haengt
(s. 4.3), habe ich Gewichtheben allein je zweimal auf beiden Baeumen gestoppt:
PR 22,2 s / 22,8 s gegen `main` 22,3 s / 21,9 s. Kein messbarer Aufschlag.

**CI im Einzelnen** (Run 34459077026 auf `87ab3fd5`): `test-and-smoke` success (09:35:29Z),
`full-test-suite` success (09:29:16Z), `persistenz-suiten` success (09:23:40Z),
`pps-referenz-frische` success (09:11:37Z).

---

## 2. Der harte Vertrag — Zeile fuer Zeile nachgeprueft

### 2.1 Kein `rr()`

Ueber alle `+`-Zeilen des Engine-Diffs gegrept: **genau ein** Treffer auf `\brr\(`, und der steht
in einem Kommentar (`// niemals rr() auf und schreibt nichts auf u/TEILNEHMER`). Im Code: null.
Ich habe die neuen Bloecke danach vollstaendig gelesen; das Grep deckt sich mit dem Lesen.

### 2.2 Keine verbotene Mutation

Grep ueber alle `+`-Zeilen nach Zuweisungen auf `u.summe`, `u.runden`, `u.aktuell`, `u.vorteil`,
`u.zweikampf`, `u.lunge`, `buehneAkt`, `buehneZeiger`, `done`: **null Treffer**. Die vollstaendige
Liste aller neu geschriebenen `u.*`-Felder in der ganzen PR lautet:

```
u._vizKg=
```

Ein Feld, mit `_viz`-Praefix, wie der Vertrag es verlangt. Es wird an genau einer Stelle gesetzt
(`:12330`, in `zeichneHeben()`, unmittelbar **vor** dem `zeichneSprite()`-Aufruf desselben
Teilnehmers) und an genau einer Stelle gelesen (`:2979`, im Zeichenpfad). In keiner Wertformel.

`TEILNEHMER` und `LAEUFER` kommen in den `+`-Zeilen ausschliesslich in Kommentaren vor.

### 2.3 Die eine Stelle, die formal danebenliegt

`letzterHebenZug` bekommt ein neues Feld `_tonPhase` (`:11688` beim Anlegen, `:12363` beim
Fortschreiben). Das ist **kein** Verstoss gegen den Vertrag — der verbietet Schreiben auf `u`,
`TEILNEHMER`, `buehneAkt`, `buehneZeiger`, `done`; `letzterHebenZug` steht auf keiner dieser
Listen, und `{u,r}` ist ein transienter Praesentations-Container, der bei jedem Zug neu gebaut
und in `build()` (`:11088`) auf `null` gesetzt wird. Ich habe alle **elf** Fundstellen von
`letzterHebenZug` durchgesehen: die Schreibstelle liegt in `stepBuehne`, **alle** Lesestellen
liegen in Zeichenfunktionen (`bodenHeben`, `zeichneHeben`, `hebePhase`). Keine Wertformel liest es.

Formal danebenliegend ist nur der **Name**: das Praefixgesetz aus PR 0 lautet `viz*`/`_viz*`,
`_tonPhase` haelt sich nicht daran. Kosmetisch, siehe N7.

### 2.4 Empirisch, nicht nur per Grep

Das Grep beweist Textabwesenheit, nicht Zustandsneutralitaet. Deshalb zwei unabhaengige
empirische Belege:

1. **Die Messlaeufe selbst.** `sfx("gewichtheben","ansage")` steht in `stepBuehne()` (`:11688`) —
   also **im gemessenen Pfad**, nicht daneben. Jeder der 24x5 Gewichtheben-Laeufe durchlaeuft
   ihn 72-mal je Spiel. Dass die rho-Werte trotzdem bis auf das letzte Byte stimmen, ist der
   staerkste denkbare Beweis der `rr()`-Neutralitaet fuer genau diesen Aufruf.
2. **Eigene Browser-Sonde.** `disziplinProbe("gewichtheben",{n:6,saat0:1337})` einmal als JSON
   gemerkt (3986 Zeichen), dann 2000 `sfxProbe()`-Aufrufe der vier von dieser PR verdrahteten
   Ereignisse (`ansage`, `gueltig`, `stange_hoch`, `scheiben_fall`) und 50 `tonLoopProbe()`-Zyklen,
   dann dieselbe Probe erneut: **zeichengleich.**

**Ein Punkt, den ich dabei korrigieren muss.** Das PR-872-Review notierte, die Ton-Schicht laufe
"in Node/Messbetrieb also nie" ins Audio. Das stimmt nicht: `miss-alle-disziplinen.mjs` misst
ueber **Playwright/Chromium**, nicht in nacktem Node. Meine Sonde hat den AudioContext dort
konstruiert und bekam den Zustand `"running"` zurueck — die Synth-Bausteine laufen im Messbrowser
also **wirklich**, inklusive der 96 000 `Math.random()`-Aufrufe in `tonRauschPufferHolen`. Und
genau deshalb ist der Befund staerker als gedacht: `Math.random()` und `rr()` sind nachweislich
getrennte Stroeme, gemessen und nicht nur behauptet. Siehe auch N6.

---

## 3. Die besonders zu pruefende Behauptung: `istHeben()` liegt nach der `ani`-Ermittlung

Die PR behauptet, die Aufrufstelle liege "strukturell NACH der `ani`-Ermittlung" und lese/schreibe
weder `waffeEffektiv` noch `ani`. **Selbst am Code nachgemessen, nicht aus den rho-Werten
geschlossen:**

| Was | Zeile in `battle-mode.engine.js` (PR-Kopf) |
|---|---:|
| `function zeichneSprite(ctx,u,x,y,feldspiel)` | 2192 |
| `const waffeEffektiv=…` | 2667 |
| `const bogen=…` / `const feuerwaffe=…` | 2668 / 2669 |
| `let ani="walk"` … `else if(u.lunge>0)ani=…` | 2686–2688 |
| `const n=ANIBILDER[ani]` — letzte Lesung von `ani` fuer die Bildwahl | 2690 |
| Hockeyschlaeger-Block (Vorbild) | 2967–2969 |
| **`if(feldspiel&&istHeben()&&!u.down){`** | **2977** |
| `zeichneHantel(ctx,…,hebePhase(u),u._vizKg||0)` | 2979 |

**291 Zeilen nach der letzten `ani`-Verwendung.** Der Block umfasst drei Zeilen und liest genau
`feldspiel`, `r`, `u.down`, `x`, `y`, `Z`, `HEBEN_HAND` und `u._vizKg`. Weder `waffeEffektiv` noch
`ani` noch `bogen`/`feuerwaffe` kommen darin vor — weder lesend noch schreibend. `ani` ist
ohnehin ein `let` **innerhalb** von `zeichneSprite` und fliesst in keinen Zustand zurueck (das
war der Befund N1 des PR-872-Reviews); hier wird es nicht einmal beruehrt.

Die Datenflussrichtung ist damit einseitig und offen einsehbar: der neue Block ist ein reiner
Konsument. Die bit-identischen rho-Werte der drei Chassis-Familien sind die Gegenprobe von der
anderen Seite, aber sie sind hier nicht das tragende Argument — die Codelage ist es.

**Zusatzpruefung, die die PR nicht nennt:** kann die Hantel in einer fremden Disziplin auftauchen?
`istHeben()=istBuehne(disc)&&buehneDisc==="gewichtheben"` (`:6351`). `buehneDisc` wird an genau
drei Stellen gesetzt, und die entscheidende ist `:14291` in `build()`: `if(istBuehne(disc)){buehneDisc=disc; …}`.
`reset()` ruft `build()`, und der Disziplin-Klick (`:13714`) ruft `reset()`. `disc` und `buehneDisc`
gehen also **im selben Aufruf** auseinander und wieder zusammen; ein Fenster, in dem `disc` schon
Tennis waere und `buehneDisc` noch Gewichtheben, gibt es nicht. Im Feldspiel und in der Arena ist
`istBuehne(disc)` zwingend falsch. Ergebnis: **die Hantel kann in keiner anderen Disziplin
erscheinen** — und meine Screenshots von Basketball/TDM/Tennis zeigen auch keine.

---

## 4. Was der Code sonst noch tut

### 4.1 `bodenHeben()` und der Dispatcher

Der Dispatch (`:11931`) ist eine Zeile: `if(art.heben)bodenHeben(); else bodenBuehne();`, mit dem
`const art=BB();` von darunter nach oben gezogen. `BB()` (`:11065`) faellt auf
`BUEHNE_ART.gewichtheben` zurueck und kann nie `undefined` liefern; `art.heben` kann also nicht
werfen. `heben`, `schach`, `cypher` und `duett` sind vier Flags auf vier verschiedenen Eintraegen
von `BUEHNE_ART` — die Exklusivitaet ist strukturell, nicht per Konvention.

Wichtig fuer die Sicherheitsfrage: **`zeichneBoden()` ist fuer die Buehne toter Code.** `draw()`
(`:19452`) kehrt bei `istBuehne(disc)` schon vorher mit `zeichneBuehne()` zurueck; `zeichneBoden()`
erreicht `bodenBuehne()` nur ueber einen Zweig, den `draw()` fuer Buehnen nie nimmt. `bodenBuehne()`
laeuft also **ausschliesslich** ueber den neuen Dispatcher. Kein Doppelzeichnen, kein Flackern.
Genau daraus folgt aber auch N1.

`bodenHeben()` selbst liest `letzterHebenZug` (Lampenfarbe aus `zug.r.gueltig`, Tafel aus
`zug.r.uebung`/`zug.r.versuch`/`zug.r.kg`) und `W`/`H`. Kein Schreibzugriff ausser der einen
Flagge. Der `null`-Fall vor dem ersten Zug ist ueberall abgefangen (`gueltig==null` → graue Lampen,
`zug?…:"—"` → Striche). Ich habe ihn im Screenshot bei 2,5 s gesehen: er greift.

### 4.2 `hebePhase()`, `HEBEN_PHASEN`, `zeichneHantel()`

`hebePhase(u)` (`:12279`) ist eine reine Ableitung aus `letzterHebenZug`, `buehneAkt` und
`BB().rundenDauer` — kein zweiter Zeitgeber, kein neuer Zustand, kein `rr()`. Der wartende Gegner
faellt ueber `zug.u!==u` auf `"boden"` — dadurch traegt jetzt **auch der Wartende** eine Stange,
was im Screenshot gut aussieht und den Vorher-Zustand (nur einer hatte ueberhaupt eine Hantel,
und die schwebte frei) deutlich verbessert.

`zeichneHantel()` (`:398`) hat den `HEBEN_PHASEN[phase]||HEBEN_PHASEN.zug`-Rueckfall wie
`zeichneHockeyschlaeger`. `scheibenFuer(kg)` (`:388`) ist monoton und liefert fuer `kg=0` die
kleinste Stufe — die "leere Stange" vor dem ersten Versuch ist damit abgedeckt.

Randnotiz: `HEBEN_SCHEIBEN_STUFEN` (`:381`) und `scheibenFuer()` fehlen in der PR-Beschreibung,
die nur "kg-abhaengige Scheibenzahl" sagt. Nicht falsch, nur unvollstaendig aufgezaehlt.

### 4.3 Der Ton

Vier Hookups, drei davon im Zeichenpfad (`gueltig`+`stange_hoch` beim Uebergang `zug→hoch`,
`ungueltig`+`scheiben_fall` beim Uebergang `→abwurf`, Publikums-Loop in `bodenHeben`), einer
**im Motorpfad**: `sfx("gewichtheben","ansage")` in `stepBuehne()` (`:11688`).

Der Motorpfad-Aufruf ist neu fuer das Projekt — PR #872 hatte die Ton-Schicht ausdruecklich nur
an Diagnose-Haken haengen. Er ist gemessen unschaedlich (2.4, plus die Laufzeitprobe in 1), aber
er ist eine Kopplung, die es vorher nicht gab. Siehe N6.

Die Uebergangslogik selbst ist korrekt und gegen Mehrfachfeuern gesichert (`_tonPhase` merkt die
zuletzt vertonte Phase). Ein theoretischer Aussetzer: wird die `zug`-Phase in **keinem** Frame
beobachtet, verschluckt die Bedingung `jetzt==="hoch"&&zug._tonPhase==="zug"` den Erfolgston. Das
Fenster ist `0,12…0,35 x rundenDauer 1,55 s ≈ 0,36 s`, also rund 21 Frames bei 60 Hz — in der
Praxis unerreichbar. Nur der Vollstaendigkeit halber notiert.

### 4.4 `barbell.tsx`

Gelesen, Zeile fuer Zeile. `barbellDemandAtRound`/`barbellFirstFailRound`/`barbellAttemptStatus`
sind reine Funktionen ueber `endKg`/`thrownSlot`/`axTop`/`kgMax`/`slotCount` — kein neuer
Datenpfad, wie behauptet. Bei `slotCount=6` ergibt `halbe=3` die IWF-Struktur 3+3;
`versuchNr=(curSlot%halbe)+1` stimmt in beiden Haelften. Der `hueForIdx`-Import ist mit seiner
letzten Verwendung entfernt worden, nicht darueber hinaus. `resolveBarbellGlideStart` habe ich
zwischen beiden Baeumen **byte-verglichen**: identisch (3 Zeilen). Die 10 Tests der beiden
genannten Suiten laufen gruen, mit genau den Namen, die man erwartet.

Was ich hier **nicht** pruefen konnte: die tatsaechliche Darstellung. `barbell.tsx` ist die
React-/SVG-Arena der `foundation`-App, nicht das Canvas-Mockup; ob die neue Versuchstafel bei
`translate(x, baseY+23)` mit etwas kollidiert und ob die 190 px breite Kopfzeile in schmalen
Spalten passt, sieht man nur in der laufenden App. Siehe 8.

---

## 5. Die `HEBEN_HAND`-Messung — selbst reproduziert

`scripts/messe-heben-handpunkt.mjs` selbst gefahren, im PR-Worktree, mit eigenem Zielordner:

```
hinten (dir 0): Frame 8/12, Spanne 31 — min(18,23) max(49,39)
links  (dir 1): Frame 8/12, Spanne 41 — min(11,31) max(52,31)
vorn   (dir 2): Frame 7/12, Spanne 26 — min(16,26) max(42,23)
rechts (dir 3): Frame 8/12, Spanne 41 — min(11,31) max(52,31)
```

Gegen die verwendeten Konstanten gehalten:

| Richtung | verwendet | mein Messwert | Urteil |
|---|---|---|---|
| links | x=11, y=32 | `min(11,31)`, Frame 8/12 | **gemessen** (x exakt, y ±1) |
| rechts | x=52, y=32 | `max(52,31)`, Frame 8/12 | **gemessen** (x exakt, y ±1) |
| hinten | x=39, y=38 | Extrema `18` und `49` | **nicht aus dem Pixelscan** |
| vorn | x=24, y=37 | Extrema `16` und `42` | **nicht aus dem Pixelscan** |

**Zwei von vier Punkten sind wirklich ausgemessen, zwei sind vom Beweisbild abgelesen.** Das ist
kein Vorwurf: das Dokument sagt es selbst — die Spalte "gemessen an" unterscheidet sauber zwischen
"Vollausschlag, Frame 8/12" (links/rechts) und "sichtbare Faust vor der Brust (gekreuzter Arm)"
(hinten/vorn), und der Abschnitt "Unsicherheiten" nennt die Vereinfachung offen. Ich habe mir das
Beweisbild `sprite-handpunkte-beweis-gewichtheben.png` angesehen: in allen vier Feldern sitzt der
Magenta-Marker sichtbar auf einer Faust. Die Aussage "an einem echten, gemessenen Koerperpunkt
statt an einem freischwebenden Bildpunkt" traegt also fuer alle vier Richtungen.

Was **die PR-Beschreibung** daraus macht ("ausgemessen an der `"shoot"`-Pose ueber
`window.__arena.renderProbe`") ist breiter als das, was die Doku behauptet. Siehe N4.

**Ein Detail, das das Skript selbst schlechter macht, als es ist:** sein abschliessendes
`console.log` schreibt die vier Konstanten **hart hin**, statt sie aus `ergebnis` abzuleiten. Wer
es nachfaehrt, sieht deshalb zwei Zeilen, die zu seinen eigenen Messwerten nicht passen, ohne
Hinweis darauf, dass das Absicht ist.

**Ein zweiter Befund aus dem Beweisbild, den die Doku nicht zieht:** in der Profilansicht
(links/rechts) sind **beide** Faeuste seitlich ausgestreckt, bei x≈11 und x≈52, also symmetrisch
±21 Zellen um die Bildmitte 32. `zeichneHantel()` verankert die Stange aber auf **einer** Faust und
zieht sie von dort ±34 Zellen. Ergebnis: die Stange steht 21 Zellen ausserhalb der Koerperachse,
reicht auf einer Seite rund 22 Zellen ueber den Sprite-Rand hinaus, und die zweite Faust greift
ins Leere. Das ist die Geometrie eines Hockeyschlaegers (einhaendiger Griff), nicht die einer
Hantel (zweihaendig, Mitte zwischen den Faeusten). In meinen Screenshots ist die Verschiebung
deutlich zu sehen. Siehe N3.

---

## 6. N1 im Detail — der Publikums-Loop kehrt nicht zurueck

### 6.1 Die Buchfuehrung

Drei Zeilen tragen den Loop:

```js
// bodenBuehne(), :11850
if(hebenPublikumAn){ tonLoopStop(); hebenPublikumAn=false; }
// :11858
let hebenPublikumAn=false;
// bodenHeben(), :11860
if(!hebenPublikumAn){ tonLoopStart("gewichtheben"); hebenPublikumAn=true; }
```

`hebenPublikumAn` hat damit **genau einen Loeschpfad**: `bodenBuehne()`. Und `bodenBuehne()` laeuft
nur, wenn `zeichneBuehne()` eine **andere Buehnen-Disziplin** zeichnet (4.1). Jeder andere Weg,
auf dem der Loop endet, laesst die Flagge stehen.

### 6.2 Auf der PR allein (Basis `3f2c7a4f`): der Loop laeuft weiter

Auf dieser Basis hat `reset()` nur `bkLoopStop()` (Basketball-`<audio>`), **kein** `tonLoopStop()`.
Eigene Playwright-Sonde, die aktive Schleifen-Quellen zaehlt (`createBufferSource` mit
`src.loop===true`, `start` minus `stop`):

```
Gewichtheben laeuft    : aktive Loop-Quellen = 1
nach Wechsel Basketball: aktive Loop-Quellen = 1
nach Wechsel Arena/TDM : aktive Loop-Quellen = 1
nach Wechsel Tennis    : aktive Loop-Quellen = 0
```

Das Publikumsrauschen des Gewichthebens laeuft also unter Basketball und unter der Arena weiter,
bis zufaellig eine Buehne gezeichnet wird.

### 6.3 Auf `main` + #876 (also nach dem Merge von #875): der Loop kommt nie wieder

#875 hat unabhaengig genau diese Luecke gefunden und `tonLoopStop()` in `reset()` gelegt
(`:21394` im gemergten Baum). Damit ist 6.2 geheilt — und der Fehler kippt auf die andere Seite:
`reset()` stoppt den Loop, **`hebenPublikumAn` bleibt `true`**, und `bodenHeben()` startet ihn nie
wieder. Dieselbe Sonde, diesmal zaehlend, wie oft eine Schleifen-Quelle **gestartet** wird:

```
nach 1. Kampfstart       : gestartete Loop-Quellen bisher = 1
nach reset + 2. Start    : gestartete Loop-Quellen bisher = 1
nach Umweg ueber Basketb.: gestartete Loop-Quellen bisher = 1
Erwartung bei korrekter Buchfuehrung: 1, 2, 3.
```

**Nach dem ersten Gewichtheben-Kampf ist das Publikum fuer den Rest der Seitensitzung stumm.**
Reproduzierbar, deterministisch, ohne `pageerror`. Und `reset()` ist kein Randweg: er laeuft beim
Disziplinklick (`:13714`), beim erneuten Start eines beendeten Kampfes (`if(done)reset()`) und bei
`__arena.setDisc()`.

Zusaetzlich kann auch #875s eigener Breaking-Loop den Heben-Loop stoppen (`tonLoopStart()` ruft
intern `tonLoopStop()`), ohne die Flagge zu beruehren — derselbe Endzustand.

### 6.4 Die Korrektur

#875 macht es an derselben Datei vor, ohne Flagge, zustandslos:
`if(disc==="breaking"){ if(running)tonLoopStart("breaking"); else tonLoopStop(); }`. Fuer
Gewichtheben genuegt entweder dasselbe Muster, oder — minimal — ein `hebenPublikumAn=false;` neben
das `tonLoopStop()` in `reset()`. Einzeiler, kein Motorcode, keine Rangtreue betroffen.

---

## 7. Das "vorbestehende Rendering-Problem" — bestaetigt, und die Ursache gefunden

Die PR schreibt, ein Sprite verschwinde kurzzeitig etwa 6 s nach Kampfstart, das sei per
Stash-Vergleich als vorbestehend gegengeprueft. **Beides stimmt, und ich kann es haerter machen
als der Stash-Vergleich.**

**Empirisch:** `screenshot-disziplin.mjs gewichtheben 6000` auf **beiden** Baeumen gefahren. Im
PR-Bild fehlt dem aktiven Heber (rechts, "Greenkraut") der Koerper, im `main`-Bild fehlt dem
aktiven Heber (links, "Draco") der Koerper — in beiden Faellen bleiben nur Schatten und ein
Kopf-Fragment. Bei 2,5 s, 9 s und 16 s stehen die Sprites auf beiden Seiten vollstaendig.

**Am Code:** die Ursache ist die Bildwahl in `zeichneSprite`:

```js
const f=(u.lunge>0&&!u.down)
  ? Math.min(n-1, Math.floor((1-u.lunge/0.2)*n))
  : …
```

`Math.min` klemmt nur nach **oben**. `stepBuehne` setzt aber `u.lunge=0.5` (`:11694`), nicht 0,2 —
fuer `lunge>0.2` wird `(1-lunge/0.2)` negativ, `f` also negativ, und der Bildindex greift ins
Leere. `u.lunge` faellt mit `dt` pro Sekunde (`:11679`), die Luecke dauert also **0,3 s je
enthuelltem Versuch**, bei `rundenDauer` 1,55 s rund ein Fuenftel der Zeit.

Beide Zeilen sind zwischen `3f2c7a4f` und `87ab3fd5` **unveraendert** — `u.lunge` kommt im ganzen
Diff nur in zwei Kommentarzeilen vor. Die Behauptung "vorbestehend" ist damit nicht nur per
Screenshot, sondern am Code bewiesen. Die Korrektur waere ein `Math.max(0, …)`, gehoert aber
nicht in diese PR: sie trifft `zeichneSprite` fuer **alle** Chassis und braucht eine eigene
Runde. Siehe N5.

---

## 8. Merge-Reihenfolge: #874 kollidiert, #875 nicht

Probemerges gefahren, nicht geschaetzt:

| Paar | Ergebnis |
|---|---|
| #876 x #875 | **sauber** |
| #876 x `main`(afb770ec, enthaelt #875) | **sauber** |
| #876 x #874 | **1 Konflikt**, `public/mockups/battle-mode.engine.js` |

Der Konflikt ist genau ein Hunk, am Kopf von `zeichneBuehne()`, und er ist **gefaehrlicher, als er
aussieht** — beide Seiten haengen dort ihren eigenen Boden-Dispatch hin:

```
<<<<<<< HEAD                       (#876 hat schon oben eingefuegt:
=======                             const art=BB(); if(art.heben)bodenHeben(); else bodenBuehne();)
    if(BB().duett)bodenEis(); else bodenBuehne();      (#874)
>>>>>>> origin/pr-874
```

Wer das mit "beide Seiten uebernehmen" aufloest, bekommt fuer Eiskunstlauf **erst `bodenEis()`,
dann `bodenBuehne()` darueber** — die neue Eisflaeche waere lautlos wieder weg, und alle uebrigen
Buehnen wuerden den Boden doppelt zeichnen. Die richtige Aufloesung ist eine Zeile:

```js
const art=BB();
if(art.heben)bodenHeben(); else if(art.duett)bodenEis(); else bodenBuehne();
```

Der Kommentar in #874 sieht das ausdruecklich vor ("Faellt ein spaeterer Agent eine eigene
bodenHeben() dazu, ist das eine weitere else-if-Zeile hier"). **Empfehlung: #876 zuerst, #874
danach** — dann liegt der Konflikt bei #874, dessen Autor die Zeile ohnehin schon so gedacht hat.
Kein Blocker fuer dieses Review-Urteil.

---

## 9. Nachtraege

**N1 — der Publikums-Loop kehrt nach dem ersten `reset()` nie zurueck. Der einzige echte Fehler
dieser PR.** Vollstaendig in Abschnitt 6, empirisch belegt in beiden Basisstaenden. Auf `main`
(mit #875) ist Gewichtheben nach dem ersten Kampf dauerhaft stumm. Einzeiler-Korrektur, kein
Motorcode. **Sollte vor oder unmittelbar nach dem Merge nachgezogen werden** — nicht weil es etwas
kaputt macht, sondern weil ein stummer Ton keinen Fehler wirft und deshalb nie von allein
auffaellt.

**N2 — Merge-Konflikt mit #874, mit einer stillen Fehlaufloesung.** Abschnitt 8. Reihenfolge
#876 → #874, und die Aufloesung ist `else if`, nicht "beide behalten".

**N3 — die Stange haengt an EINER Faust, nicht zwischen beiden.** Abschnitt 5. In der Profilpose
stehen beide Faeuste bei x≈11 und x≈52; `zeichneHantel()` zentriert die Stange auf einer davon.
Sichtbar in jedem Screenshot: die Hantel steht seitlich versetzt zur Koerperachse. Zusammen mit
`HEBEN_PHASEN.hoch.dy=-49` fuehrt das dazu, dass die Stange in der Streckungsphase eher ueber dem
Kopf **schwebt**, als in den Haenden zu liegen — der Ueberschriftsanspruch "Hantel IN den Haenden"
loest sich in der `boden`- und `zug`-Phase gut ein, in der `hoch`-Phase nur halb. Der richtige
Ankerpunkt waere die Mitte zwischen den beiden gemessenen Faeusten (x≈32), mit der halben
Stangenlaenge auf die Faustdistanz gelegt. **Kein Blocker** — der Vorher-Zustand (freistehende
Primitive, ganz ohne Koerperbezug) war eindeutig schlechter, und der wartende Gegner mit der
Stange am Boden sieht richtig gut aus. Aber der naechste Anfassende sollte es wissen.

**N4 — die PR-Beschreibung ist breiter als die eigene Doku.** Sie sagt "ausgemessen … ueber
`window.__arena.renderProbe`" ohne Einschraenkung; ausgemessen sind zwei von vier Punkten, die
anderen beiden vom Beweisbild abgelesen. `docs/design/sprite-handpunkte.md` sagt es korrekt, die
PR-Beschreibung nicht. Dazu: `messe-heben-handpunkt.mjs` druckt die Konstanten hart, statt sie aus
seinem eigenen Ergebnis abzuleiten — wer es nachfaehrt, sieht einen scheinbaren Widerspruch.

**N5 — der negative Bildindex in `zeichneSprite` ist ein echter, vorbestehender Fehler mit
bekannter Ursache.** Abschnitt 7. `Math.min(n-1, floor((1-u.lunge/0.2)*n))` klemmt nur nach oben,
`stepBuehne` setzt `u.lunge=0.5`. Nicht Sache dieser PR — aber jetzt ist er beschrieben statt nur
beobachtet, und die Korrektur (`Math.max(0, …)`) ist ein eigenes, kleines Ticket, das alle vier
Chassis betrifft.

**N6 — `sfx()` steht ab jetzt im Motorpfad.** PR #872 hatte die Ton-Schicht ausdruecklich nur an
Diagnose-Haken; `stepBuehne` (`:11688`) ist die erste Ausnahme. Gemessen unschaedlich (Abschnitte
1 und 2.4), aber die Messlaeufe bauen dadurch pro Gewichtheben-Lauf einige tausend Web-Audio-Knoten
in einem Chromium mit **laufendem** AudioContext. Heute folgenlos; erwaehnenswert, weil die
naechsten Ziel-PRs demselben Muster folgen werden und die Kopplung dann nicht mehr neu diskutiert
wird.

**N7 — `_tonPhase` haelt sich nicht ans Praefixgesetz.** PR 0 schreibt `viz*`/`_viz*` vor. Das Feld
sitzt auf dem transienten `{u,r}`-Container, nicht auf `u`, verletzt also den Vertrag inhaltlich
nicht — nur die Namenskonvention. Beim naechsten Anfassen umbenennen, kein eigener PR.

**N8 — `HEBEN_SCHEIBEN_STUFEN`/`scheibenFuer()` fehlen in der PR-Aufzaehlung.** Aktenlage.

**N9 — die Textkollision auf der Bühne ist vorbestehend.** Die kg-Zahl, "✓ gültig", die
Versuchszeile und der Teamname liegen uebereinander. Ich habe `main` und PR bei 2,5 s
nebeneinandergelegt: die Kollision ist auf beiden Seiten dieselbe. Die neue Anzeigetafel oben
rechts entschaerft sie teilweise (Uebung/Versuch/kg sind dort **zusaetzlich** ruhig lesbar), loest
sie aber nicht. Kein Befund gegen diese PR, nur eine Notiz fuer die naechste Gewichtheben-Runde.

---

## 10. Was ich nicht pruefen konnte

* **Wie es klingt.** Playwright hat keinen Audioausgang. Ich habe bewiesen, dass die Aufrufe nicht
  werfen, den Zufallszustand nicht anfassen und **wann** eine Schleifenquelle gestartet und
  gestoppt wird (Abschnitt 6) — nicht, ob Gong, Buzzer und Scheibenklirren gut klingen. Das kann
  nur Chris.
* **`barbell.tsx` im Bild.** Die Versuchstafel, die 190 px breite Kopfzeile und die
  Drei-Lampen-Reihe sind nur gelesen und typgeprueft, nicht gerendert — das braucht die laufende
  `foundation`-App, nicht das Canvas-Mockup (4.4).
* **Der Server.** Wie in `CLAUDE.md` beschrieben kommen Agenten nicht heran; alles hier ist am Repo
  und in der lokalen Playwright-Umgebung gemessen.
* **Ein deterministischer Bildvergleich** vorher/nachher. Die Szene laeuft in Echtzeit weiter, der
  Screenshot faellt nach Wanduhr — die PNGs unterscheiden sich auch dort, wo sich nichts geaendert
  hat. Ich habe deshalb bei vier Zeitpunkten gemessen und die Befunde am Code verankert, nicht am
  Pixelvergleich. (Derselbe Vorbehalt wie im PR-872-Review, Abschnitt 5.)
* **Die 150–400-kg-Remap.** Von der PR ausdruecklich als Folge-Ticket ausgeklammert; ich habe sie
  nicht bewertet.

---

## 11. Fazit

Diese PR macht Gewichtheben zum ersten Mal wie Gewichtheben aussehen: eine echte
Wettkampfplattform statt des violetten Allzweckpodests, drei Kampfrichterlampen, eine
Anzeigetafel, ein Hantelstaender, Kreide, Publikum — und beide Heber tragen eine Stange, die an
einem gemessenen Koerperpunkt haengt statt frei im Bild zu schweben. Ich habe das selbst gerendert
und nebeneinandergelegt; der Unterschied zu `main` ist gross und er geht in die richtige Richtung.

Der harte Vertrag haelt, und zwar besser belegt als in den Vorgaenger-PRs: **17 Disziplinen
bit-identisch, in zwei verschiedenen Basisstaenden**, die `rr()`-Neutralitaet nicht per Grep
sondern durch den Umstand bewiesen, dass der neue Tonaufruf **mitten im gemessenen Motorpfad**
sitzt und die Zahlen trotzdem auf das letzte Byte stimmen. `tsc` mit leerem Diff, Slot-Invariante
bei 0,005 Pp, 10/10 der genannten Suiten, 4/4 CI. Die besonders zu pruefende Behauptung zur
`ani`-Lage stimmt — 291 Zeilen Abstand, einseitiger Datenfluss, nachgelesen statt erschlossen. Die
Handpunkt-Messung habe ich nachgefahren und zwei von vier Werten exakt reproduziert; die anderen
zwei sind abgelesen, und die Doku sagt das selbst.

Was fehlt, ist eine Zeile Ton-Buchfuehrung. **FREIGEBEN MIT NACHTRAG.** Von neun Nachtraegen ist
genau einer handlungspflichtig: **N1**, der stumme Publikums-Loop — heute schon reproduzierbar,
seit dem Merge von #875 in der unangenehmeren Richtung. Zwei weitere sind
Merge-Hygiene (**N2**, Reihenfolge #876 vor #874 und `else if` statt "beide behalten") und ein
Hinweis fuer die naechste Gewichtheben-Runde (**N3**, die Stange gehoert zwischen die Faeuste, nicht
auf eine). Der Rest ist Aktenlage.

---
_Generated by [Claude Code](https://claude.ai/code)_
