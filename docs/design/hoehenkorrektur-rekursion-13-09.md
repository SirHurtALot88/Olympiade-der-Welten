# Die Höhenkorrektur hat sich selbst gemessen

`hoehenKorrektur(u)` in `public/mockups/battle-mode.engine.js` soll die Streuung der
Sprite-Blätter wegrechnen, damit die Bildschirmhöhe einer Figur nur noch an ihrer
eingestellten `groesse` hängt — im Wortlaut des eigenen Kommentars: „damit nicht eine Figur
der Größe 5 höher auf dem Eis steht als eine der Größe 7".

Sie tat das nicht. **Der Messdurchlauf rief sich selbst auf**, lief rund zweitausend Ebenen
tief in einen Stapelüberlauf, und der Wert, der am Ende im Zwischenspeicher landete, hing an
der **Parität der zufälligen Überlauftiefe**. In etwa der Hälfte der Fälle war das 1,000 —
also gar keine Korrektur.

Fundstelle war eine Fehlermeldung aus einer ganz anderen Messung (Gewichtheben-Hantelgeometrie),
die zwei Ursachen vermutete. Dieser Bericht misst nach: **eine der beiden stimmt, die andere
nicht**, und die zutreffende wirkt anders, als vermutet.

## 1. Der Mechanismus

```js
function hoehenKorrektur(u){
  if(hoehenKorrSpeicher.has(u.n))return hoehenKorrSpeicher.get(u.n);
  let korr=1;
  try{
    ...
    zeichneSprite(cx,{n:u.n, ...},MESS/2,ankerY,false);   // <-- misst
    ...
  }catch(e){ korr=1; }
  hoehenKorrSpeicher.set(u.n,korr);                        // <-- erst HIER gefüllt
  return korr;
}
```

und in `zeichneSprite()`, erste Rechenzeile:

```js
const Z=groesseFaktor(u.groesse)*hoehenKorrektur(u)*bauSkala(b);
```

Der Zwischenspeicher wurde **nach** der Messung gefüllt, der Rückruf aus `zeichneSprite()` fand
also nichts vor und maß erneut. Kein Abbruch, nur der Stapel.

Gemessen (Sonde `window.__arena.hoehenKorrProbe`, diese Änderung; Instrumentierung mit
Tiefenzähler, s. Abschnitt 6):

| | |
|---|---:|
| Rekursionstiefe bis zum `RangeError` | 1057 bis 2309 Ebenen |
| Dauer des ERSTEN Aufrufs je Figur | ~1,1 s |
| 128×128-Messleinwände je Figur | ~2000 statt 1 |

Der `RangeError` fiel in das `try/catch` daneben und wurde lautlos zu `korr=1`.

## 2. Warum der Wert dann hin- und herkippte

Beim Abwickeln misst **jede** Ebene das Bild der Ebene darunter, und jede Ebene zeichnet mit
dem `korr`, das ihr von unten zurückgegeben wurde. Das ist ein sauberer Zweierzyklus.
Johanna, echte Messreihe (`HOEHEN_BEZUG=52`):

| Ebene | gezeichnet mit korr | gemessene Blatthöhe | daraus korr |
|---|---:|---:|---:|
| tiefste | (Absturz) | — | 1,0000 |
| darüber | 1,0000 | 49 px | **1,0612** |
| darüber | 1,0612 | 52 px | **1,0000** |
| darüber | 1,0000 | 49 px | **1,0612** |
| … | | | … |

Gespeichert wurde, was die **äußerste** Ebene in der Hand hielt. Ob das 1,0612 oder 1,0000 war,
entschied allein, wie viel Stapel zufällig frei war, als die Figur zum ersten Mal gezeichnet
wurde.

**Nachgewiesen**, indem dieselbe Figur aus verschieden tiefen Aufrufstapeln gemessen wurde
(`+n` = n zusätzliche Rahmen vor dem Aufruf):

| Figur | +0 | +1 | +2 | +3 | +50 | +51 |
|---|---:|---:|---:|---:|---:|---:|
| Johanna | 1,0000 | 1,0612 | 1,0000 | 1,0000 | 1,0612 | 1,0612 |
| Krag'Zul | 1,0000 | 0,8814 | 1,0000 | 1,0000 | 0,8814 | 0,8814 |
| Lava Golem | 0,8525 | 0,8525 | 0,8525 | 1,0000 | 0,8525 | 0,8525 |
| Treantos | 0,8966 | 0,8966 | 0,8966 | 0,8966 | 0,8966 | 1,0000 |
| Arachna | 1,0000 | 0,9286 | 0,9286 | 0,9286 | 1,0000 | 0,9286 |
| Alarm | 1,0000 | 0,8125 | 1,0000 | 0,8125 | 0,8125 | 1,0000 |

Gleiche Figur, gleicher Code, gleiche Seite — anderer Wert.

**Das war im Spiel sichtbar.** Dreimal dieselbe Seite geladen, dieselben Figuren über denselben
Pfad gezeichnet (`renderProbe`), gemessene Körperhöhe in Pixeln — links vorher, rechts nach der
Reparatur:

| Figur | vorher L1 | vorher L2 | vorher L3 | nachher L1 | nachher L2 | nachher L3 |
|---|---:|---:|---:|---:|---:|---:|
| Xelara | 51 | **45** | 51 | 51 | 51 | 51 |
| Jorund | 48 | 48 | **51** | 51 | 51 | 51 |
| Lulu | 48 | 48 | **51** | 51 | 51 | 51 |
| Cassandra | 48 | 48 | **51** | 51 | 51 | 51 |
| Johanna | 48 | 48 | 48 | 51 | 51 | 51 |
| Seraph-11 | 41 | 41 | 41 | 53 | 53 | 53 |
| Lava Golem (÷Faktor) | 51,3 | **49,6** | 51,3 | 49,6 | 49,6 | 49,6 |

Gleicher Code, gleiche Seite, unterschiedliche Größe — das ist der Fehler, wie ihn ein Spieler
zu sehen bekam. Nach der Reparatur sind alle drei Läufe zeichenweise identisch.

## 3. Was das die Funktion kostete

Kader-Umfrage, 11 Figuren aus `SQUAD`. „SOLL" ist der Wert, den die Formel der Funktion ohne
Rekursion liefert (`clamp(52/Blatthöhe)`), „ist-A"/„ist-B" sind die beiden Paritätszweige:

| | rho (`groesse` → Bildschirmhöhe) | Reststreuung der größennormierten Höhen (max/min) |
|---|---:|---:|
| SOLL | **1,000** | **1,00** |
| ist-A | 0,673 | 1,27 |
| ist-B | 0,491 | 1,27 |

Die Funktion existiert genau für diese Zahl, und sie erreichte sie nicht.

## 4. Die zwei vermuteten Ursachen, nachgemessen

**Vermutung 1 — „der Vollbild-Zweig zeichnet immer `dh=64*Z`, nötig wäre 52/64 = 0,81, statt
dessen hängt die Korrektur am oberen Deckel `HOEHEN_KORR_MAX=1,25`": trifft nicht zu.**

`dh=64*Z` ist die Höhe des **Rahmens**, nicht des gezeichneten Inhalts. Gemessen bei Z=1:

| Figur | Blattart | gezeichnete Inhaltshöhe | korr = 52/Höhe |
|---|---|---:|---:|
| Krag'Zul | `vollbild:"golem"` | 59 px | 0,881 |
| Lava Golem | `vollbild:"golem"` | 61 px | 0,852 |
| Krolach | `vollbild:"golem"` | 59 px | 0,881 |
| Tidesprinter | `vollbild:"froschmensch"` | 41 px | 1,268 → geklemmt auf 1,250 |
| Johanna | Baukasten | 49 px | 1,061 |
| King Arlen Morgolor | Baukasten | 62 px | 0,839 |

Ein Vollbild-Blatt füllt seine Zelle also gerade **nicht** aus. Die Formel rechnet für
Vollbild genau richtig; wo 1,25 herauskommt (Tidesprinter, Seraph-11), ist das der Deckel, der
bei einem tatsächlich sehr flach gezeichneten Blatt bestimmungsgemäß greift — kein Vorzeichen-
oder Richtungsfehler.

**Vermutung 2 — „Rekursion, die in den `catch` läuft": trifft zu, wirkt aber anders.**
Es ist nicht so, dass immer auf `korr=1` zurückgefallen wird. Nur die **tiefste** Ebene fällt
zurück; darüber wird bei jedem Abwickeln neu gemessen, und der Zweierzyklus aus Abschnitt 2
entscheidet.

**Und der Fehler ist nicht vollbild-spezifisch.** Die vier Figuren, die in der Kader-Umfrage
auf 1,000 standen — Johanna, Draco, Jorund, King Arlen Morgolor —, sind **alle vier**
Baukasten-Figuren. Die Fehlermeldung hatte den Vollbild-Zweig im Verdacht, weil sie genau zwei
Figuren verglichen hat; gemessen trifft es beide Blattarten gleichermaßen.

## 5. Die Reparatur

Eine Zeile: **vor** der Messung eine 1 in den Zwischenspeicher legen.

```js
if(hoehenKorrSpeicher.has(u.n))return hoehenKorrSpeicher.get(u.n);
hoehenKorrSpeicher.set(u.n,1);          // Rekursionsbremse
```

Der Rückruf aus `zeichneSprite()` findet sie, gibt 1 zurück, und die Messfigur wird genau so
gezeichnet, wie der Kommentar darüber es immer gemeint hat: „Messfigur ohne Größe: so misst der
Durchlauf das BLATT, nicht das Ergebnis." Ein Zeichendurchlauf statt zweitausend.

Danach, 17 Figuren, je sechs verschiedene Aufrufstapeltiefen und je fünf Wiederholungen:

| | vorher | nachher |
|---|---:|---:|
| stapelabhängig | 6 von 17 (je Lauf wechselnd) | **0 von 17** |
| zwischen Wiederholungen wackelnd | ja | **0 von 17** |
| Dauer des ersten Aufrufs | ~1,1 s | < 2 ms |

Beweisbilder (dieselben 17 Figuren, gemeinsame Bodenlinie, `renderProbe`):

| | |
|---|---|
| vorher | `docs/design/hoehenkorrektur-vorher-13-09.png` |
| nachher | `docs/design/hoehenkorrektur-nachher-13-09.png` |

Bildschirmhöhen derselben Montage (`renderProbe`, Gehen von vorn, Alphaschwelle 200 — die
halbdurchsichtigen Partikel-Wisps zählen nicht als Körper), geteilt durch `groesseFaktor`;
perfekt wäre überall 52:

| Figur | groesse | vorher | nachher |
|---|---:|---:|---:|
| Seraph-11 | 6 | 38,0 | **49,2** |
| Gram | 6 | 42,7 | 43,6 |
| Johanna | 5 | 47,0 | 49,9 |
| Cassandra | 5 | 47,0 | 49,9 |
| Jorund | 5 | 47,0 | 49,9 |
| Lulu | 5 | 47,0 | 49,9 |
| Draco | 6 | 47,3 | 50,1 |
| Rhyx'Tal | 8 | 48,8 | 51,3 |
| Ralazar the Balanced | 5 | 48,9 | 51,8 |
| Xelara | 5 | 49,9 | 49,9 |
| King Arlen Morgolor | 5 | 51,8 | 51,8 |
| Inefinna | 5 | 51,8 | 51,8 |
| Greenkraut | 7 | 52,9 | 52,9 |
| Tidesprinter | 6 | 44,5 | 44,5 (am Deckel) |
| **Streuung max/min** | | **1,39** | **1,21** |

(Lava Golem, Krolach und Krag'Zul fehlen in der Streuung: sie werden von `renderProbe` oben
angeschnitten, s. Abschnitt 6 — ihre Zahlen sind Untergrenzen, keine Messwerte.)

Die verbleibende Streuung von 1,21 ist **nicht** derselbe Fehler. Sie hat zwei bekannte
Ursachen: der Deckel (Tidesprinter, Seraph-11 — bestimmungsgemäß) und der Umstand, dass
`hoehenKorrektur` die Figur in EINER Pose misst (nach rechts laufend, `vx:5`), die Montage aber
eine andere zeigt (von vorn). Gram ist genau dieser Fall — 51 px in der Messpose, 47 px in der
Montagepose. Das ist eine Eigenschaft des Verfahrens, kein Fehler in ihm, und war vor dieser
Änderung genauso da.

## 6. Was dabei sonst auffiel — bewusst NICHT angefasst

**`renderProbe` verankert nicht mit.** Die Sonde rechnet `u.x=gr/2, u.y=gr*46/64`, ruft dann
aber `zeichneSprite(ctx,u,32,46,...)` mit den festen 32/46 auf. Der eigene Kommentar („Der
Ankerpunkt wächst mit, damit die Figur weiter auf demselben relativen Boden steht") beschreibt
etwas, das der Code nicht tut: eine Figur mit Z>1 wird oben abgeschnitten, egal wie groß
`leinwand` gewählt wird. `scripts/miss-figurgroessen.mjs` wirft angeschnittene Zeilen bereits
aus der Wertung, seine rho ist also nicht falsch — der Parameter hält nur nicht, was sein
Kommentar verspricht.

**Die Messung misst die Partikeleffekte mit.** `zeichneSprite` zeichnet `b.effekt` in denselben
Kontext, und die Wisp-Position hängt an der Simulationszeit `t`. Bei „wabernd" (Void/Gift) kann
`basisY=topY+(i/n)*spanne+spanne*0.5` deutlich **unter** `bottomY` liegen; dann rutscht ein
halbdurchsichtiger Tupfen bis an den unteren Leinwandrand, `unten<MESS-1` greift, und die
Korrektur wird stillschweigend übersprungen. Nach der Reparatur ist die Messung einmalig — in
5 Wiederholungen je Figur trat es nicht auf, aber es bleibt eine Einmal-Lotterie. Ein sauberer
Fix wäre eine Messfigur ohne Effekte; das ist ein eigener Eingriff und gehört nicht in eine
Rekursionsbremse.

**Blatt noch nicht geladen = Korrektur für immer aus.** `bHolEingefaerbt` gibt ein `Image` mit
`width===0` zurück, solange das Blatt lädt; `if(im&&im.width)` zeichnet dann nichts, `hoehe`
bleibt 0, `korr=1` wird **dauerhaft** gespeichert. Unter `networkidle` nicht reproduzierbar (bei
Wartezeit 0 ms kamen dieselben Werte heraus wie bei 3500 ms), strukturell aber möglich. Ein
Fix müsste bei fehlgeschlagener Messung **nicht** speichern, damit ein späterer Frame neu misst —
mit dem Risiko, dass eine dauerhaft nicht messbare Figur jeden Frame eine 128×128-Leinwand
auswertet. Nicht ohne Messung dieses Risikos.

## 7. Abgrenzung: reine Zeichenänderung

`hoehenKorrektur()` wird an genau drei Stellen gelesen, alle drei rein zeichnend:

| Stelle | Verwendung |
|---|---|
| `zeichneSprite`, `const Z=…` | `ctx.drawImage`/Pfadgeometrie |
| `handOffX` (Feldspiel-Ball) | `const bx=fsBall.x+bvx+handOffX`, nur `ctx.*` |
| `parcZ` (Takeshi-Startnummer) | Requisitenposition, nur `ctx.*` |

Kein `rr()`, kein Schreibzugriff auf eine Einheit, kein Wert, den `wert()`/die Boxscore-Formeln
lesen. `node scripts/miss-alle-disziplinen.mjs 24` muss deshalb **bit-identisch** bleiben.

## 8. Abnahme

| Prüfung | Ergebnis |
|---|---|
| `node scripts/miss-alle-disziplinen.mjs 24` (alle 20, Kader-Familie) | **bit-identisch zu main**, `md5 ac90ddbbad2335121b5b01df2468ef8c` vorher wie nachher |
| `node --check public/mockups/battle-mode.engine.js` | OK |
| `npx tsc --noEmit` | 906 Diagnosen, **zeilengleich zu main** (Kaltlauf beide Male Exit 2; der zweite, inkrementelle Lauf meldet 1 — Cache-Artefakt, nicht diese Änderung) |
| `npx tsx scripts/pruefe-slot-invariante.ts` | identische Ausgabe zu main, Invariante hält (max. 0,005 Pp) |
| `npx eslint` auf beide geänderten/neuen Dateien | 0 Fehler (nur die bestehenden Warnungen der Engine) |
| `npm run ci:quelltext-waechter` (144 Dateien, 2033 Tests) | 2032 bestanden; `tests/chunked-redraft-topup-service.test.ts` lief in eine 60-s-Zeitgrenze, **allein nachgefahren 15/15 grün in 96 s** — CPU-Konkurrenz mit der parallel laufenden rho-Messung, nicht diese Änderung |
| `node scripts/miss-hoehenkorrektur.mjs` (neu) | 0 von 17 stapelabhängig, 0 von 17 wackelnd |

Die rho-Gleichheit ist hier die eigentliche Abnahme: eine reine Zeichenänderung, die auch nur
eine Nachkommastelle bewegt, hätte etwas angefasst, was sie nicht anfassen darf.
