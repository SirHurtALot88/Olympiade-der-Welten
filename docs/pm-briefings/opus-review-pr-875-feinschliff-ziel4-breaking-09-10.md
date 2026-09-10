# Opus-Overseer-Review PR #875 — Ziel 4: Breaking-Assets + Movement (echter Cypher)

**Datum:** 10.09.2026
**PR:** #875, Branch `claude/feinschliff-ziel4-breaking-09-10`, Kopf `9f0fddbc`
**Basis:** `origin/main` `3f2c7a4f` (post-#873)
**Reviewer:** unabhaengiger Opus-Overseer, an der PR nicht mitgearbeitet
**Pruefumgebung:** eigener isolierter Worktree (`scratchpad/wt-875`), `node_modules` symlink
auf den Hauptbaum; Nullpunkt ein zweiter Worktree auf `origin/main` `3f2c7a4f` (`wt-main`),
Konflikt-Probe in einem dritten (`wt-merge`)

---

## Freigabe-Empfehlung

# FREIGEBEN MIT NACHTRAG

Die zentrale Behauptung — **nie mehr als EIN Tanzender gleichzeitig in der Mitte** — habe ich
nicht nachgelesen, sondern mit einer **staerkeren** Methode als der PR selbst nachgemessen:
nicht 140 Stichproben im 50-ms-Raster, sondern **jeder einzelne Simulationsschritt eines
vollstaendigen Spiels, lueckenlos** (3 700 Schritte, 96 Enthuellungen). Ergebnis: **maximal 1,
null Verstoesse**, und die Phasenlaengen sind auf den Frame konstant. Die Garantie ist
ausserdem **struktureller** als die PR es formuliert (Abschnitt 3.2).

Die `rr()`-Neutralitaet ist bit-identisch bestaetigt — fuer breaking und alle acht
Buehnen-Geschwister. Kein Nachtrag ist ein Blocker.

**Vor dem Merge zu wissen, nicht zu beheben:** #875 und #874 (Eiskunstlauf) **kollidieren
textuell** — beide haengen ihre neue `step*`-Funktion an dieselbe Ankerstelle. Die Aufloesung
ist mechanisch, ich habe sie gefahren und den zusammengefuehrten Baum gemessen: ebenfalls
bit-identisch (Abschnitt 7).

---

## 1. Was ich selbst gefahren habe

Alles synchron und blockierend, kein Hintergrundlauf.

| Lauf | Ergebnis |
|---|---|
| `miss-alle-disziplinen.mjs 24` x 9 Buehne, PR-Kopf vs. `main` | **bit-identisch** (`diff` leer, gleiche MD5 `0c4fa758…`) |
| dieselbe Messung auf dem **zusammengefuehrten** Baum #875+#874 | **bit-identisch mit `main`** |
| Eigene Cypher-Sonde, lueckenlos je Simulationsschritt (3 700 Schritte) | **max. 1 in der Mitte, 0 Verstoesse** |
| Eigene Winkelsprung-Sonde (41 058 Ring-Messpaare) | 107 Spruenge >= 0,3 rad, max. 2,80 rad — siehe N2 |
| `npx tsc --noEmit`, PR vs. `main` | 560 Fehler auf beiden Seiten, **Diff leer** |
| `npx tsx scripts/pruefe-slot-invariante.ts` | **haelt**, max. Abweichung 0,005 Pp (Schranke 0,2 Pp) |
| `screenshot-disziplin.mjs breaking` auf **beiden** Baeumen | 0 `pageerror`, Bilder in Abschnitt 6 |
| Trocken-Merge #875 x #874 / x #876 | **Konflikt** bzw. **sauber** — Abschnitt 7 |
| GitHub-CI auf `9f0fddbc` | siehe Abschnitt 8 |

Die Zahlen, zur Aktenlage — auf beiden Seiten identisch, Ziffer fuer Ziffer:

```
speed-schach 0.908 | showcase 0.892 | eiskunstlauf 0.885 | breaking 0.869 | gewichtheben 0.854
wettessen    0.845 | tennis   0.825 | fechten      0.816 | i-spy     0.684 (durchgefallen, wie vorher)
```

breaking: rho je Spiel 0,869, Spannweite 0,114, rho Saison 0,951, Spannweite 0,168 — exakt die
Werte von `main`. Diese PR bewegt keine Nachkommastelle.

---

## 2. Der `rr()`-Neutralitaetsvertrag — empirisch, nicht nur gelesen

### 2.1 Laeuft `stepCypher()` in der Messung ueberhaupt mit?

Das ist die Frage, an der ein bequemer Beweis scheitern koennte, und sie hat eine klare
Antwort: **ja**. `MOTOREN[<buehne>].lauf` (`:21857`) ruft `stepBuehne(1/60)`; `stepBuehne`
ruft bei `:11667` `buehnenBewegung(dt)`; der Dispatcher trifft bei `art.cypher` auf
`stepCypher`. `miss-alle-disziplinen.mjs` faehrt das in einem **echten Chromium** (Playwright),
also mit echten `W`/`H` — die Funktion laeuft vollstaendig, inklusive `sfx()`-Aufrufen. Die
Bit-Identitaet ist damit ein echter Beweis und kein Nulllauf.

### 2.2 Schreibt sie irgendetwas Verbotenes?

Ich habe den Rumpf Zeile fuer Zeile gelesen. Zuweisungsziele, vollstaendig:
`u.vizPhase`, `u.vizPhaseT`, `u.vizMove`, `u.vizA`, `u.vizR` (letzteres auch im Helfer
`NAECHER`). **Fuenf viz*-Felder, sonst nichts.** Kein `rr(`. Kein Schreibzugriff auf
`u.summe`/`u.runden`/`u.aktuell`/`u.vorteil`/`u.zweikampf`/`u.lunge`/`buehneAkt`/
`buehneZeiger`/`done`.

Eine Stelle verdient das genaue Hinsehen, weil sie wie ein Schreibzugriff aussieht:

```js
0:TEILNEHMER.filter(u=>u.side===0).sort((a,b)=>b.summe-a.summe||a.id-b.id),
```

`filter()` liefert ein **neues** Array; das anschliessende `sort()` sortiert die Kopie.
`TEILNEHMER` selbst bleibt in seiner Reihenfolge — das ist wichtig, weil die Reihenfolge von
`TEILNEHMER` an anderer Stelle sehr wohl zaehlt.

### 2.3 Der Ersatz fuer `rr()`

`cypherHash(a,b)` ist ein reiner Ganzzahl-Hash (`Math.imul` + xorshift), ohne Zustand. Er
speist die Move-Wahl (`u.vizMove=cypherHash(u.id,u.aktuell)%4`) und die Wippen-Phase. Genau
das, was der PR-0-Vertrag verlangt ("Wer Streuung braucht, nimmt einen reinen Hash aus
`u.id`"). Die Deterministik ist als Nebenwirkung meiner Sonden mitbewiesen: zwei
Sondenlaeufe ergaben identische Enthuellungsabstaende, Episodenlaengen und Phasenprofile.

**Bewertung: der Vertrag haelt, woertlich.**

---

## 3. Die zentrale Behauptung — selbst nachgemessen, mit einer besseren Methode

### 3.1 Wie ich gemessen habe

Die PR nennt "140 Samples/50 ms". Das ist ein **Zeitraster**, und ein Zeitraster kann
Simulationsschritte ueberspringen: der Motor rechnet in `loop()` (`:19881`)
`while(acc>=1/60){stepSim((1/60)/zf);acc-=1/60;}` — bei einem langsamen Frame laufen mehrere
Schritte zwischen zwei Abtastungen. Genau in so einer Luecke saesse ein Verstoss.

Ich habe deshalb **lueckenlos** gemessen. Vor dem Motorskript (`page.addInitScript`) ersetze
ich `requestAnimationFrame` durch eine Warteschlange und pumpe sie von aussen mit
Zeitstempeln von exakt `1000/60 + 0,0001` ms. Damit gilt in jedem Pump-Aufruf
`acc >= 1/60` **genau einmal** — ein Pump = **ein** `stepSim()`. Nach jedem Pump lese ich
`window.__arena.cypherVizProbe()`. Es gibt keine ungesehenen Schritte.

### 3.2 Das Ergebnis

Ein vollstaendiges Breaking-Spiel (12 Teilnehmer x 8 Durchgaenge = 96 Enthuellungen):

| Groesse | Messwert |
|---|---:|
| Abgetastete Simulationsschritte | 3 700 (lueckenlos) |
| Maximal gleichzeitig **nicht** im Ring | **1** |
| Frames mit genau 1 in der Mitte | 3 524 |
| Frames mit leerer Mitte | 476 |
| Frames mit 2 oder mehr | **0** |
| Verstoesse | **keine** |
| Enthuellungs-Abstand | **38 Frames, 95x von 95** (kein anderer Wert) |
| Vollstaendige Episoden | 95 |
| Episodenlaenge | **33 Frames, 95x von 95** |
| Phasenprofil je Episode | `eintritt 8 · throwdown 16 · freeze 9` (63x) bzw. `… rueckzug 9` (32x) |

33 Frames Auftritt gegen 38 Frames Taktschlag: **5 Frames (83 ms) leere Mitte** zwischen zwei
Tanzenden. Das deckt sich mit den 476 Leer-Frames (95 x 5 + 1).

### 3.3 Warum die Garantie belastbarer ist, als die PR selbst sagt

Die PR begruendet sie mit Sekunden (0,15+0,25+0,15 = 0,55 s < 0,625 s). Das stimmt, ist aber
nur die halbe Begruendung, denn eine Phasengrenze faellt nicht bei `t = T`, sondern beim
**ersten Frame nach** `T` — die effektive Laenge ist `ceil(T/dt)` Frames, und bei grossem `dt`
kann die Aufrundung den Puffer aufzehren.

Der Punkt, den die PR nicht nennt und der die Sache rettet: **`dt` ist hier eine Konstante,
kein Messwert.** `loop()` uebergibt `stepSim((1/60)/zeitFaktor())`, und `zeitFaktor()` ist
`ZEIT_DEHNUNG[disc]||1`. `breaking` steht **nicht** in `ZEIT_DEHNUNG` (`:19821`), also ist
`dt` **immer exakt 1/60**, unabhaengig von Bildrate, Maschine und dem 1x/2x/4x-Tempo-Regler
(der wirkt auf `acc`, nicht auf `dt`). Damit sind 8/16/9 Frames keine Messung, sondern eine
Eigenschaft: sie koennen sich nicht verschieben. Die Garantie ist maschinenunabhaengig.

**Wer das je aufweichen will, muss zwei Dinge gleichzeitig anfassen:** einen
`ZEIT_DEHNUNG.breaking`-Eintrag setzen (macht `dt` groesser und die Aufrundung teuer) oder
`rundenDauer` senken. Beides waere ein stiller Bruch dieser Garantie. Das gehoert als Satz
ueber die vier Phasenkonstanten — siehe N6.

### 3.4 Der `u.lunge===0.5`-Trigger

Ein exakter Float-Vergleich als Ereignis-Trigger ist normalerweise ein Alarmzeichen. Hier
traegt er, und zwar aus zwei unabhaengigen Gruenden: (a) `stepBuehne` baut `u.lunge` bei
`:11589` **zuerst** ab (`Math.max(0,u.lunge-dt)`, also von 0,5 strikt abwaerts) und setzt es
bei `:11601` **danach** auf exakt `0.5`, und `buehnenBewegung(dt)` laeuft erst bei `:11667`;
(b) `dt` ist konstant `1/60` > 0, ein Frame mit `dt===0` (der 0,5 stehen liesse und die
Phase jeden Frame neu startete) kann nicht auftreten. Meine Sonde bestaetigt es von der
anderen Seite: **95 Episoden auf 96 Enthuellungen, keine einzige Doppelausloesung.**

---

## 4. `stepCypher()` und `zeichneBreaking()` — Zeile fuer Zeile

Was ich beim Lesen geprueft und fuer richtig befunden habe:

* **Toprock-Spiegelung** `ctx.translate(2*x,0); ctx.scale(-1,1)` — das ist die korrekte
  Spiegelung an der Senkrechten durch `x` (`p → 2x−p`), kein Versatz.
* **Footwork** `translate(x,fussY); scale(1,0.92); translate(-x,-(fussY-6))` — setzt die
  Figur um 5,5 px tiefer und staucht sie; das ist die beschriebene Wirkung, gerechnet.
* **Powermove** rotiert Sprite **und** Schatten um denselben Fusspunkt, mit demselben Winkel.
  Konsistent.
* **`zeichneSprite()` unveraendert wiederverwendet**, innerhalb von `save()/restore()`; die
  Textetiketten stehen **ausserhalb** und werden nicht mitgedreht. Richtig herum gebaut.
* **Fallback** `u.vizA!=null?…:startA+…` faengt den einen Redraw vor dem ersten `stepBuehne()`.
  `bauBuehne()` setzt `TEILNEHMER=[]` (`:10997`), es gibt also keine veralteten
  `viz*`-Zustaende ueber einen Reset oder Disziplinwechsel hinweg — geprueft.
* **Ton-Katalog:** `TON_KATALOG.breaking` hat `beat` (loop), `freeze`, `powermove`, `abbruch`
  (`:16486`). Alle drei von `stepCypher()` gerufenen Namen existieren; kein stiller Leerlauf.
* **`tonLoopStop()` im `reset()`** steht neben `bkLoopStop()` und ist bei nicht laufendem Loop
  ein No-Op. Sauber.
* **`BREAKING_BPM`** wird an drei Stellen wirklich benutzt (Wippen, Kern-Puls, Toprock-Takt)
  und in `breaking.tsx` als bewusst gespiegelte Konstante gefuehrt — der Kommentar sagt
  ausdruecklich, dass zwei Laufzeiten eine Konstante nur spiegeln, nicht teilen koennen. Das
  ist die ehrliche Formulierung.

Was mir dabei aufgefallen ist, steht als N1–N3 und N7 unten.

---

## 5. `breaking.tsx` — die neuen Requisiten

Gelesen und **nachgerechnet**, statt sie nur auf dem Bild zu suchen. `breaking` laeuft auf der
`thermometer`-Geometrie (`registry.ts:88` bzw. `PRIM_GEO`), also **1180 x 600**. Daraus:
`cx=590`, `cy=308`, `rOut=min(542,8 | 264)=264`, Ringunterkante `cy+rOut*KY=524,5`.

| Requisit | Geometrie | Kollision? |
|---|---|---|
| DJ-Pult + Boombox | `y = H−68 … H−24` = 532…576 | nein, 7,5 px unter der Ringkante |
| Lautsprechertuerme | `x = cx±150`, `y = H−74` = 526 | nein — der Ring liegt bei `x=440/740` nur bis `y≈486` |
| Battle-Bracket-Leiste | `y=16` / `y=30`, zentriert | nein; das Wasserzeichen steht links (`x=18`) |
| Cypher-Boden + 6 Nahtlinien | `rx=rOut`, unter allem | nein, `pointerEvents="none"` |

Drei Punkte, die ich explizit gepruefte habe, weil sie leicht schiefgehen:

1. **React-Keys der Bracket-Paare** (`${a.code}-${b.code}`). Das waere kaputt, wenn `code`
   ein Team**mitglied** benaenne — es benennt aber das **Team** (`rt: RT[]` = "ALLE Teams in
   idx-Reihenfolge", `types.ts`), und `sorted` enthaelt jedes Team einmal. Keys eindeutig.
2. **`teamPrimaryColor`** ist wirklich exportiert (`lib/foundation/team-colors.ts:69`).
3. **Der Hover-Ring** benutzt dieselbe `KY`-Stauchung wie die sichtbare Zone. Ein Kreis haette
   am Rand deutlich neben dem Ring gelegen; das ist bedacht und im Kommentar begruendet.

Die Etiketten-Loesung (nur bei Hover) beseitigt die im Sicht-QA gefundene Kollision **auf der
React-Buehne**. Auf der Canvas-Oberflaeche stehen die vier Zonentexte weiterhin ueber dem Ring
— siehe N4.

---

## 6. Die Sichtpruefung, mit eigenen Bildern

Ich habe `screenshot-disziplin.mjs breaking 4000` auf **beiden** Baeumen gefahren (0
`pageerror` auf beiden Seiten). Der Unterschied ist nicht subtil:

* **`main`:** vier bis fuenf Tanzende stapeln sich im Zentrum uebereinander, die Etiketten
  liegen aufeinander — exakt das Bild aus `docs/design/sicht-qa-10-09-breaking.png`, das ich
  zum Abgleich mitgelesen habe. Der QA-Befund ist echt und reproduzierbar.
* **PR-Kopf:** elf Tanzende gleichmaessig auf dem Ring, **einer** in der Mitte, Etiketten
  getrennt lesbar. Der Befund ist behoben, und zwar strukturell (der Radius traegt keinen
  Score mehr), nicht kosmetisch.

Die sechs mitgelieferten PNGs habe ich gegengelesen; sie zeigen, was sie zu zeigen behaupten.
In `breaking-nachher-10-09-mitte-2.png` ist der Tanzende in der Mitte gerade im Powermove und
deshalb weit um seinen Fusspunkt geschwenkt — das ist die Absicht, sieht auf einem Standbild
aber zunaechst wie ein versetzter Sprite aus. Sein Etikett liegt dabei auf der
`SURVIVOR · UNBROKEN`-Zeile (N3).

**Beide Oberflaechen sind live.** `breaking` steht in `ARENA_RESOLVED_DISCIPLINE_IDS`
(`lib/resolve/battle-mode-arena-team-points.ts`), und `FoundationBattleArenaHost.tsx` zieht
`/mockups/battle-mode.html` in die App (kein iframe mehr, aber dieselbe Quelle). Chris sieht
also **beide** Aenderungen — die Canvas-Choreografie **und** die neuen `breaking.tsx`-Requisiten.

---

## 7. Kollisionscheck mit den Geschwister-PRs

Stand jetzt ist **keine** der drei Ziel-PRs gemergt; alle drei haengen an derselben Basis
`3f2c7a4f`:

| PR | Ziel | Kopf | Konflikt mit #875? |
|---|---|---|---|
| #874 | Ziel 2, Eiskunstlauf (`stepKuer`) | `b2d49f14` | **JA** — `battle-mode.engine.js` |
| #876 | Ziel 1, Gewichtheben | `87ab3fd5` | nein, sauber |
| #874 x #876 | — | — | ja (untereinander) |

**Wo genau.** Der Konflikt ist ein Lehrbuch-"beide haben hinzugefuegt": #874 und #875 haengen
ihre neue `step*`-Funktion an **dieselbe** Ankerstelle, unmittelbar hinter
`buehnenBewegung()`. Ein einziger Hunk, `HEAD` 11696–11827 gegen `b2d49f14` 11827–11926.
Keine Zeile widerspricht der anderen; sie stehen nur beide am selben Platz.

**Ich habe die Aufloesung gefahren, nicht nur behauptet.** Beide Bloecke hintereinander, plus
die zwei schliessenden Klammern, die git dem ersten Block wegnimmt (sie stehen im gemeinsamen
Nachspann und gehoeren beiden). Danach:

* `node --check public/mockups/battle-mode.engine.js` → **syntaktisch in Ordnung**
* `miss-alle-disziplinen.mjs 24` x 9 auf dem zusammengefuehrten Baum → **bit-identisch mit
  `main`**, also auch das Zusammenspiel von `stepKuer` und `stepCypher` ist rangtreue-neutral

Die Feldnamen ueberschneiden sich nicht (`vizX/vizY/vizRi/vizSpur` gegen
`vizR/vizA/vizPhase/vizPhaseT/vizMove`), und beide sind ohnehin ueber ihr Disziplin-Flag
(`art.duett` bzw. `art.cypher`) exklusiv gegated.

**Empfehlung:** #875 und #876 in beliebiger Reihenfolge; wer von #874/#875 zweitgeht, loest
den einen Hunk auf. **Kein Blocker, aber nichts, was ein Auto-Merge erledigt.**

---

## 8. CI

Vier Checks auf `9f0fddbc` (Run 34457811975):

| Check | Stand zum Zeitpunkt dieses Berichts |
|---|---|
| `pps-referenz-frische` | **gruen** (08:57:46Z) |
| `persistenz-suiten` | **gruen** (09:10:08Z) |
| `full-test-suite` | **gruen** (09:15:36Z) |
| `test-and-smoke` | lief bei Abfassung noch |

Drei von vier gruen und gemeldet; `test-and-smoke` war beim Schreiben noch nicht fertig.
`mergeable_state` ist `blocked` — das ist die fehlende Freigabe, nicht ein roter Check.
**Vor dem Merge einmal nachsehen, ob der vierte Check durch ist.**

---

## 9. Nachtraege

**N1 — die LETZTE Enthuellung wird nie getanzt.** `stepBuehne` setzt `done=true` bei `:11668`,
also im selben Frame wie die 96. Enthuellung; ab dem naechsten Frame kehrt `stepBuehne` bei
`:11587` sofort zurueck und `buehnenBewegung()` laeuft nie wieder. Der letzte Tanzende bleibt
damit **fuer immer** in `eintritt` stehen, auf halbem Weg zur Mitte. Gemessen: ab Frame 3612
friert der Zustand ein, Teilnehmer 11 steht bei `r=151` (Ring: 203–211) und bewegt sich
389 Frames lang nicht mehr; sein `freeze`/`abbruch`-Ton faellt ebenfalls aus. Das ist **keine
Regression** — auf `main` blieb aus demselben Grund `u.lunge` bei exakt 0,5 stehen und der
Erfolgs-/Fehlschlag-Ring des letzten Teilnehmers leuchtete danach dauerhaft mit voller
Deckkraft weiter. Es ist nur ein **anderes** Standbild. Richtig behoben waere es mit einer
Zeile: `buehnenBewegung(dt)` auch dann laufen lassen, wenn `done` schon steht (die Funktion
schreibt ohnehin nur `viz*`). Kein Blocker; gehoert in die naechste Runde an dieser Stelle.

**N2 — Rangwechsel lassen Tokens springen, ungeglaettet.** Im Zustand `ring` schreibt
`stepCypher` `u.vizA=cypherRingWinkel(u,seiten)` **jeden Frame neu**, und
`cypherRingWinkel` bestimmt den Platz aus dem **Rang** (`sort` nach `u.summe`). Aendert eine
Enthuellung die Rangfolge, tauschen zwei Tokens ihren Platz **ohne Zwischenschritt**.
Gemessen ueber ein Spiel (41 058 Ring-Messpaare): **107 Winkelspruenge >= 0,3 rad, groesster
2,80 rad** — das ist praktisch die volle Team-Halbkreis-Spanne, der Tanzende erscheint am
anderen Ende des Rings. Zum Vergleich: die gewollte langsame Rotation macht < 0,002 rad je
Frame; 36 985 der Messpaare liegen genau dort. Rund 1,1 Spruenge je Enthuellung.
Der Code will das so ("an einer sichtbar neuen Ringposition abzulesen") — er will vermutlich
nicht, dass es ein Teleport ist. Der Radius wird bereits ueber `NAECHER()` geglaettet; dieselbe
Behandlung fuer `vizA` (mit Beachtung des Winkelumlaufs) waeren drei Zeilen. Kosmetisch, aber
gut sichtbar, weil es alle 0,625 s passiert. **Auf `main` sprang statt des Winkels der
Radius** (der Score springt ja auch dort sofort), es ist also kein neuer Fehler-TYP — nur ein
groesserer Weg.

**N3 — die Effektringe verschwinden bei halber Deckkraft.** `FREEZE_T` und `RUECKZUG_T` sind
0,15 s (gemessen: exakt 9 Frames), aber die Ausblendungen in `zeichneBreaking()` rechnen noch
mit den Werten der ersten Fassung: `p=Math.max(0,1-u.vizPhaseT/0.35)` fuer den goldenen
Standbild-Ring und `/0.3` fuer den roten Riss-Flash. Am Phasenende steht `p` deshalb bei 0,571
bzw. 0,50 — und in diesem Moment springt die Phase auf `ring`, der Effekt ist schlagartig weg.
Er blendet also nie aus, er reisst ab. Fix: die beiden Divisoren auf `FREEZE_T`/`RUECKZUG_T`
setzen (oder die Konstanten dort verwenden, statt die Zahl ein zweites Mal zu schreiben).

**N4 — der Etiketten-Fix gilt nur fuer eine der beiden Oberflaechen.** Die Hover-Loesung sitzt
in `breaking.tsx`. Auf der Canvas-Buehne (`bodenBuehne`/`zeichneBreaking`) stehen `GEBROCHEN`,
`SCHMERZGRENZE`, `STONE FACE` und `MIND FORTRESS` weiterhin dauerhaft ueber dem Ring — auf
meinem eigenen Nachher-Screenshot gut zu sehen. Da beide Oberflaechen live sind (Abschnitt 6),
sollte niemand erwarten, dass der QA-Befund "Etiketten kollidieren" damit ueberall erledigt
ist. Nur mitteilen, nicht nachbessern.

**N5 — das Etikett des Tanzenden in der Mitte liegt auf der `SURVIVOR · UNBROKEN`-Zeile.**
Weil jetzt **immer** jemand in der Mitte steht (das ist ja der Zweck), trifft diese
Ueberlappung jetzt jeden Durchgang statt nur gelegentlich. Sichtbar auf der PR-eigenen
`…-mitte-2.png` und auf meinem eigenen Bild. Kleine Verschiebung des Namensetiketts waehrend
`eintritt`/`throwdown`/`freeze` waere die naheliegende Loesung.

**N6 — die Timing-Garantie steht nirgends als Bedingung.** Die vier Phasenkonstanten tragen
einen ausfuehrlichen Kommentar mit der Sekundenrechnung, aber **nicht** den Satz, an dem die
Garantie wirklich haengt: dass `breaking` nicht in `ZEIT_DEHNUNG` stehen darf und
`rundenDauer` nicht sinken darf (Abschnitt 3.3). Wer spaeter — voellig unabhaengig von
Breaking-Bewegung — einen `ZEIT_DEHNUNG.breaking`-Eintrag setzt, weil das Spiel zu hektisch
wirkt, bricht die Garantie stillschweigend. Ein Halbsatz an den beiden Stellen genuegt.

**N7 — `sfx()` laeuft ab jetzt im MESS-Pfad mit.** #875 ist die erste PR, die `sfx()` aus
Simulationscode ruft. Damit legt `miss-alle-disziplinen.mjs`/`disziplinProbe()` in echtem
Chromium einen `AudioContext` an und erzeugt je Enthuellung 1–2 Audio-Knoten plus einmalig
einen 2-Sekunden-Rauschpuffer — bei 5 Kadern x 24 Spielen x 96 Enthuellungen rund 11 500
Knoten je Disziplinlauf. **Gemessen unschaedlich** (bit-identisch, normale Laufzeit), aber auf
einem nicht fortlaufenden (suspendierten) Kontext laeuft `ctx.currentTime` nicht, das
eingeplante `stop()` faellt also nie. Nur als Notiz, falls Messlaeufe je deutlich laenger werden.

**N8 — PR-Text, kleine Ungenauigkeit.** Die PR sagt, die 560 vorbestehenden `tsc`-Fehler
lagen "ausschliesslich in `tests/*.test.ts`". Sie verteilen sich auf 199 Dateien, davon 21
unter `scripts/`. Die tragende Aussage — **Diff gegen die Baseline leer** — habe ich bestaetigt
(560 auf beiden Seiten, `diff` liefert nichts).

**N9 — toter Fallback in `zeichneBreaking()`.** `perm`, `frac` und `maxSumme` werden weiterhin
je Token berechnet, greifen aber nur noch im einen Redraw vor dem ersten `stepBuehne()`. Kein
Fehler, nur eine Stelle, an der ein spaeterer Leser Score-Logik vermuten koennte, wo keine
mehr ist.

---

## 10. Was ich nicht pruefen konnte

* **Ton auf echter Hardware.** Playwright hat kein Audiogeraet. Ich habe bewiesen, dass die
  drei Katalogeintraege existieren, die Aufrufe an den richtigen Phasenuebergaengen sitzen
  und nichts werfen — **nicht**, wie es klingt. Das kann nur Chris.
* **Die React-Buehne im laufenden Spiel.** `breaking.tsx` habe ich gelesen und die Geometrie
  gegen die tatsaechliche `viewBox` gerechnet (Abschnitt 5), aber nicht in einer laufenden
  Next-Instanz gerendert. DJ-Pult, Bracket-Leiste und Boden sind **im Code vorhanden und
  plausibel platziert**; ob sie im Zusammenspiel mit den HTML-Overlays des Hosts gut aussehen,
  ist eine Frage fuers Auge.
* **Der `full-test-suite`-Umfang.** Ich habe die Suite nicht lokal gefahren (Laufzeit); ich
  stuetze mich auf den gruenen CI-Job auf genau diesem Kopf-SHA.
* **Der vierte CI-Check.** `test-and-smoke` lief bei Abfassung noch (Abschnitt 8).
* **Der Server.** Wie in `CLAUDE.md` beschrieben kommen Agenten nicht heran.

---

## 11. Fazit

Diese PR loest das Problem, das sie zu loesen behauptet, und sie loest es an der richtigen
Stelle: der Radius traegt keinen Score mehr, deshalb kann sich nichts mehr stapeln — das ist
eine strukturelle Behebung, keine Kosmetik. Die Choreografie ist eine kleine, geschlossene
Zustandsmaschine ohne globalen Zustand, und ihre zentrale Garantie haelt nicht "meistens",
sondern **auf den Frame und maschinenunabhaengig**: 3 700 lueckenlos abgetastete
Simulationsschritte, 96 Enthuellungen, Episodenlaenge 33 Frames in 95 von 95 Faellen,
**null** Verstoesse. Das habe ich mit einer strengeren Methode nachgemessen als die PR selbst
benutzt hat, und sie besteht sie.

Die Rangtreue bewegt sich um keine Ziffer — weder allein noch zusammen mit #874 —, die
Slot-Invariante haelt mit 0,005 Pp, der `tsc`-Diff gegen die Baseline ist leer, und die
Sichtpruefung auf beiden Baeumen zeigt den Unterschied unmissverstaendlich.

**FREIGEBEN MIT NACHTRAG.** Von den neun Nachtraegen ist keiner ein Blocker. Drei lohnen die
naechste Runde an dieser Datei (**N1** der eingefrorene letzte Auftritt, **N2** die
Teleport-Spruenge beim Rangwechsel, **N3** die abreissenden Effektringe), einer ist eine
Kommentarzeile mit echtem Schutzwert (**N6**), und einer ist mitteilungspflichtig, damit
niemand mehr erwartet als geliefert wird: **N4**, der Etiketten-Fix gilt nur fuer die
React-Buehne. Dazu der Hinweis aus Abschnitt 7: **#874 kollidiert textuell mit dieser PR** —
mechanisch aufloesbar, von mir durchgespielt und nachgemessen, aber kein Auto-Merge.

---
_Generated by [Claude Code](https://claude.ai/code)_
