# Opus-Overseer-Review PR #872 — Feinschliff PR 0 (Ton-Schicht, Requisiten-Tabelle, Buehnenbewegung-Dispatcher)

**Datum:** 10.09.2026
**PR:** #872, Branch `claude/feinschliff-pr0-fundament-09-10`, Kopf `452b19e6`
**Basis:** `origin/main` `c56fffd7`
**Reviewer:** unabhaengiger Opus-Overseer, an der PR nicht mitgearbeitet
**Pruefumgebung:** isolierter Worktree `/tmp/wt-review-872`, `node_modules` symlink auf den Hauptbaum
**Vergleichsbasis:** der Hauptbaum `/home/user/Olympiade-der-Welten` — nachgemessen: gegen `origin/main`
nur ein Docs-Commit (`688ef656`, 4 PNG + 1 Markdown), keine Codezeile. Damit ist er ein gueltiger
Nullpunkt fuer alle Messlaeufe.

---

## Freigabe-Empfehlung

# FREIGEBEN MIT NACHTRAG

Nichts an dieser PR blockiert den Merge. Alle vier Kernbehauptungen sind unabhaengig nachgeprueft
und halten. Die drei wartenden Agenten (Gewichtheben-Assets, Eiskunstlauf-Movement,
Breaking-Assets+Movement) koennen starten, sobald #872 auf `main` ist.

Die Nachtraege sind Dokumentations- und Kommunikationspunkte, kein Codefehler. **N2 sollte Chris
vor dem naechsten Deploy erfahren**, weil er die Aenderung an drei LIVE geschalteten Disziplinen
sehen wird und sie in der PR-Beschreibung nicht als solche benannt ist.

---

## 1. Was ich selbst gefahren habe

Alle Laeufe synchron, blockierend, im Review-Worktree bzw. im Hauptbaum. Kein Hintergrundlauf,
kein Monitor-Warten.

| Lauf | Ergebnis |
|---|---|
| `miss-alle-disziplinen.mjs 24` x 9 Buehne, PR-Kopf vs. `main` | **bit-identisch** (`diff` leer) |
| `miss-alle-disziplinen.mjs 24 basketball hockey football`, PR vs. `main` | **bit-identisch** |
| `miss-alle-disziplinen.mjs 24` x 5 Bahn, PR vs. `main` | **bit-identisch** |
| `npx tsx scripts/pruefe-slot-invariante.ts` | **gruen**, max. Abweichung 0,005 Pp (Schranke 0,2 Pp) |
| `npx vitest run` (Teilmenge Battle-Mode, 8 Dateien) | **120/120 gruen** |
| Eigener Playwright-Test der Ton-Schicht (nicht der PR-eigene) | **gruen**, Details Abschnitt 2 |
| GitHub-CI auf `452b19e6` | **4/4 gruen**: `test-and-smoke`, `full-test-suite`, `persistenz-suiten`, `pps-referenz-frische` |

Die Zahlen selbst, zur Aktenlage (identisch auf beiden Seiten):

```
speed-schach  0.908 | showcase 0.892 | eiskunstlauf 0.885 | breaking 0.869 | gewichtheben 0.854
wettessen     0.845 | tennis   0.825 | fechten      0.816 | i-spy     0.684 (durchgefallen, wie vorher)
basketball    0.769 | hockey   0.669 | football     0.516                  (unveraendert)
staffel       0.915 | spurt    0.871 | takeshis-castle 0.861 | time-trial 0.828 | climbing 0.790
```

Die Abnahme-Lage ist also exakt die von `main` — diese PR bewegt keine einzige Nachkommastelle.
Das ist auch das, was man erwarten muss: sie ist reines Fundament.

**Anmerkung zur Vitest-Behauptung.** Die PR nennt "42/42 Vitest gruen". Ein voller
`npx vitest run` laeuft in dieser Umgebung laenger als 10 Minuten und lief mir in den Timeout;
ich habe ihn deshalb nicht lokal zu Ende gefahren. Statt dessen: (a) die 8 Battle-Mode-Suiten
lokal, 120/120 gruen, und (b) der CI-Job `full-test-suite` auf **genau diesem Kopf-SHA**, gruen,
abgeschlossen 07:51:54Z. Das ist die staerkere Evidenz. Die konkrete Zahl "42/42" konnte ich
nicht reproduzieren und habe sie nicht nachvollzogen — sie ist fuer die Freigabe auch nicht
tragend.

---

## 2. Ton-Schicht — geprueft, haelt

### 2.1 Ist der Basketball-Block wirklich unangetastet?

**Ja.** Zwei unabhaengige Pruefungen:

1. Der Diff enthaelt **keine einzige `-`-Zeile**, die `bkSfx`, `bkLoopStart/Pause/Stop`,
   `bkVolume`, `bkMuted` oder `bkPegel` beruehrt. Alle 13 Diff-Treffer auf `bk*` sind `+`-Zeilen,
   und davon sind 11 neue **Aufrufe** von `bkPegel()` aus den neuen Synth-Bausteinen, 2 sind
   Kommentar.
2. Direkter Inhaltsvergleich aller `bk*`-tragenden Zeilen zwischen `origin/main` und `HEAD`:
   die 45 Zeilen von `main` kommen unveraendert wieder vor, 13 sind hinzugekommen. Kein
   Loeschen, kein Umschreiben.

`bkVolume`/`bkMuted`/`bkPegel()` werden wie behauptet **wiederverwendet**, nicht dupliziert —
ein Lautstaerkeregler steuert damit weiterhin alles, Basketball eingeschlossen. Das ist die
richtige Entscheidung und sie ist sauber umgesetzt.

### 2.2 Ruft die Ton-Schicht `rr()`? Schreibt sie auf `u`/`TEILNEHMER`/`LAEUFER`?

**Nein, beides nicht.** Der gesamte neue Block (`:16120`–`:16340`, von `bkLoopStop()` bis
`zeichneBoden()`) enthaelt bei einem Grep auf `\brr\(`, `TEILNEHMER`, `LAEUFER`, `\bu\.`, `\bu\[`
**null Treffer im Code** — die einzigen Vorkommen sind die beiden Kommentarzeilen, die genau
diese Regel formulieren. Ich habe den Block danach vollstaendig gelesen; das Grep-Ergebnis
deckt sich mit dem Lesen. Die Funktionen lesen ihre Argumente und sonst nichts.

**Empirische Gegenprobe im echten Browser** (staerker als Grep, weil sie den globalen
LKG-Zustand misst statt Text): `disziplinProbe("gewichtheben", {n:6, saat0:1337})` einmal
ausgefuehrt, Ergebnis als JSON gemerkt (3986 Zeichen); dann **1500 Tonaufrufe**
(500x `sfx("gewichtheben","gueltig")`, 500x `sfx("eiskunstlauf","sturz")`,
500x `tonLoopProbe("breaking")`); dann dieselbe Probe noch einmal. Ergebnis:
**zeichengleich**. Die Ton-Schicht verschiebt den `rr()`-Zustand nachweislich nicht.

### 2.3 Eigener Playwright-Test: wirft `sfx()` wirklich nie?

Ich habe den PR-eigenen Test **nicht** nachvollzogen, sondern einen eigenen geschrieben. Er
faehrt pro Runde **272 `sfx()`-Aufrufe und 11 `tonLoopStart/Stop`-Paare** — einmal **vor** dem
ersten `#play`-Klick und einmal **danach**:

* alle 20 echten Katalog-Ereignisse der vier Disziplinen (inkl. der `loop`-Eintraege, die
  `sfx()` ueberspringen muss),
* unbekannte Disziplin und unbekanntes Ereignis (`"gibtsnicht"`, `"basketball"/"korb"`),
* **prototyp-vergiftende Namen**: `"constructor"`, `"__proto__"`, `"toString"`, `"valueOf"` —
  jeweils als Disziplin und als Ereignis,
* `null`, `undefined`, Zahl, leerer String, Objekt und Array als Argumente,
* je 8 Lautstaerkewerte, darunter `-5`, `99`, `NaN`, `null` und der String `"laut"`.

**Ergebnis: 0 Fehlschlaege in beiden Runden, 0 `pageerror`.** Der einzige Konsolenfehler ist
ein `ERR_CONNECTION_RESET` beim Seitenaufbau, der auch ohne Tonaufrufe faellt (Fremd-Ressource,
`file://`-Betrieb), dazu 64x `ERR_FILE_NOT_FOUND` fuer Sprite-Dateien — beides bestehendes
Rauschen der `file://`-Umgebung, nicht von dieser PR verursacht.

Der Prototyp-Fall ist bemerkenswert, weil `sfx()` mit `(TON_KATALOG[disziplin]||{})[ereignis]`
eine ungeschuetzte Property-Suche macht: `TON_KATALOG["constructor"]` liefert die
`Object`-Funktion. Das faellt hier nur deshalb nicht um, weil danach `eintrag.loop`,
`eintrag.datei` und `typeof eintrag.synth==="function"` alle drei sauber verneinen und die
Funktion still zurueckkehrt — und weil ohnehin ein `try/catch` darum liegt. Es haelt, aber es
haelt durch Glueck plus Gurtzeug, nicht durch Absicht. Siehe N5.

### 2.4 Was die Ton-Schicht heute NICHT tut

`sfx()` wird im gesamten Modul an **genau einer** Stelle aufgerufen: aus `sfxProbe()`, dem
Diagnose-Haken fuer Playwright (`:22416`). `tonLoopStart()`/`tonLoopStop()` ebenso, nur aus
`tonLoopProbe()`. **Kein Spielcode spielt heute einen Ton.** Das ist plan-konform (PR 0 ist
Fundament, die Ziel-PRs verdrahten), aber es heisst: nach dem Merge von #872 klingt im Spiel
nichts anders. Wer das erwartet, wartet auf die Ziel-PRs. Siehe N3.

### 2.5 Der Rueckweg auf echte Dateien

Der `{datei:...}`-Pfad in `sfx()` und `tonLoopStart()` ist implementiert und plausibel
(3er-Pool je Ereignis, `frei.currentTime=0`, `play().catch(()=>{})`), aber **in dieser PR von
keinem Katalogeintrag benutzt** und damit ungetestet. Er ist tot, bis jemand eine Tabellenzeile
umstellt. Das ist in Ordnung fuer eine bewusst offengehaltene Tuer — nur soll niemand glauben,
der Pfad sei erprobt.

---

## 3. `DISZIPLIN_WAFFE` — vollstaendig, und der Bugfix ist echt

### 3.1 Deckt die Tabelle wirklich alle Chassis ab?

Nachgezaehlt, nicht geglaubt — die Schluessel der vier Chassis-Kataloge direkt aus der Datei
geparst:

| Chassis | Anzahl | In `DISZIPLIN_WAFFE`? |
|---|---:|---|
| `BUEHNE_ART` | 9 (gewichtheben, showcase, eiskunstlauf, breaking, wettessen, speed-schach, i-spy, tennis, fechten) | **alle 9** |
| `BAHN_ART` | 5 (spurt, time-trial, climbing, staffel, takeshis-castle) | **alle 5** |
| `FELDSPIEL_ART` | 3 (basketball, football, hockey) | bewusst keiner |
| `ARENA_ART` | 3 (tdm, mini-dm, battlefield) | bewusst keiner |

`DISZIPLIN_WAFFE` hat **exakt 14 Eintraege** — 9 + 5, keine Luecke, kein Ueberhang, kein Tippfehler
im Schluesselnamen. `fechten:"schwert"`, die anderen 13 `null`. Genau wie behauptet.

Dass Feldspiel und Arena fehlen, ist richtig: `undefined` faellt in `waffeEffektiv` auf `b.waffe`
zurueck, und in der Arena (Deathmatch) gehoert die Waffe ja hin.

**Randnotiz zum Plan, nicht zur PR:** der Plan (Abschnitt 3.3) spricht von "ALLE zehn
Buehnen-Disziplinen". Es sind neun. Der Code hat recht, der Plantext hat den Zahlendreher.

### 3.2 War der Bahn-Bug echt?

**Ja, und er ist beweisbar, nicht nur plausibel.**

Die alte Bedingung lautete:

```js
const keineBuehnenWaffe=istBuehne(disc)&&(buehneDisc==="eiskunstlauf"||buehneDisc==="breaking");
const waffeEffektiv=fechtenWaffe?"schwert":(keineBuehnenWaffe?null:b.waffe);
```

`istBuehne=(d)=>!!BUEHNE_ART[d]`, und `BUEHNE_ART` enthaelt **keinen** Bahn-Schluessel. Fuer jede
Bahn-Disziplin war `istBuehne(disc)` also zwingend `false`, damit `waffeEffektiv===b.waffe` —
die zufaellige Kosmetik. Und `:2849` lautet:

```js
if(feuerwaffe&&!u.down)zeichneWaffenbild(waffeEffektiv+"_walk");
```

mit `feuerwaffe=!feldspiel&&FEUERWAFFEN.includes(waffeEffektiv)`; auf der Bahn ist `feldspiel`
falsch. Damit ist der Weg vollstaendig: **ein Laeufer mit Feuerwaffen-Kosmetik trug sie den
ganzen Parcours entlang.** Im Bauplan-Katalog gibt es dafuer auch wirklich Kandidaten:
1x `waffe:"pistole"` und 4x `waffe:"bogen"` unter 57 Waffen-Eintraegen.

Die neue Bedingung fasst genau diesen Fall:

```js
const aktiveDisc=istBuehne(disc)?buehneDisc:(istBahn(disc)?bahnDisc:null);
const erzwungen=aktiveDisc!=null?DISZIPLIN_WAFFE[aktiveDisc]:undefined;
const waffeEffektiv=erzwungen===undefined?b.waffe:erzwungen;
```

Aequivalenz-Nachweis gegenueber `main`, Fall fuer Fall:

* `fechten` → `"schwert"` (vorher `"schwert"`) — **gleich**
* `eiskunstlauf`, `breaking` → `null` (vorher `null`) — **gleich**
* Feldspiel, Arena → `aktiveDisc===null` → `undefined` → `b.waffe` (vorher `b.waffe`) — **gleich**
* alle 5 Bahn → `null` (vorher `b.waffe`) — **geaendert, das ist der Bugfix**
* `showcase`, `tennis`, `wettessen`, `speed-schach`, `i-spy`, `gewichtheben` → `null`
  (vorher `b.waffe`) — **geaendert, siehe N2**

Kleiner Genauigkeitspunkt zur Kommentar-Rhetorik: der Kommentar spricht zweimal von
Schrotflinte/Sturmgewehr. Im Bauplan-Katalog existiert von den drei Feuerwaffen tatsaechlich nur
`"pistole"`, und zwar einmal. Der Bug ist real, aber schmaler als die Formulierung nahelegt.
Nicht wichtig genug fuer eine Nachbesserung, nur der Vollstaendigkeit halber notiert.

### 3.3 Wo der Kommentar falsch liegt (N1)

Der neue Tabellenkommentar behauptet:

> `waffeEffektiv` wird ausschliesslich bei :2717-2720/:2837/:2842-2845 gelesen

Das stimmt nicht ganz. `waffeEffektiv` wird unmittelbar darunter zu `bogen` und `feuerwaffe`
abgeleitet (`:2588`/`:2589`), und **die** entscheiden bei `:2608` ueber die Animation:

```js
else if(u.lunge>0)ani=feldspiel?"shoot":((bogen||feuerwaffe)?"shoot":"slash");
```

Wer also vorher eine Bogen- oder Pistolen-Kosmetik trug, bekam bei `u.lunge>0` die
`shoot`-Pose; jetzt bekommt er `slash`. Das ist eine echte, sichtbare Verhaltensaenderung, die
der Kommentar nicht abdeckt.

**Ist das schlimm? Nein.** `ani` ist ein `let` **innerhalb** von `zeichneSprite` (`:2606`) und
wird ausschliesslich zur Sprite-Auswahl benutzt (`ANIBILDER[ani]`, `"..."+ani`,
`ani==="slash"`-Vergleiche). Es fliesst in keinen Zustand zurueck. Die Wirkung bleibt also im
Zeichenpfad — die Schlussfolgerung des Kommentars ("keine Rangtreue-Formel") stimmt, nur die
Begruendung ist unvollstaendig. Meine drei bit-identischen Messlaeufe bestaetigen das von der
anderen Seite.

Wo die Aenderung greift: `u.lunge` wird in `stepBuehne` (`:11593`) und in Feldspiel/Arena gesetzt,
**nicht** im Bahn-Code (`:14664`/`:14928` sind `feuerSkill`/`wirkeAus`, also Arena). Auf der Bahn
aendert sich damit nur der Wegfall des `_walk`-Waffenbildes; die `ani`-Verschiebung trifft die
Buehne.

---

## 4. `buehnenBewegung`-Dispatcher — genau wie beschrieben

**Wirklich nur eine neue Zeile?** Ja. Der Diff-Hunk bei `:11656` enthaelt **eine** `+`-Zeile
(`buehnenBewegung(dt);`) und **keine** `-`-Zeile. Kein bestehender Code angefasst. Sie steht
direkt vor `if(buehneZeiger>=buehneQueue.length)done=true;`, genau an der im Plan genannten
Stelle. `dt` ist der Parameter von `stepBuehne(dt)` (`:11578`) und damit im Sichtbereich.

**Ist der Dispatcher sicher?** `const art=BB();` — und `BB` ist
`()=>BUEHNE_ART[buehneDisc]||BUEHNE_ART.gewichtheben` (`:10967`), liefert also **nie**
`undefined`. Der Zugriff `art.duett`/`art.cypher` kann nicht werfen. Die
`typeof stepKuer==="function"`-Waechter machen die Abwesenheit der Zielfunktionen zu einem
stillen No-Op statt zu einem `ReferenceError` — verifiziert, indem alle neun Buehnen-Disziplinen
gemessen wurden und alle Screenshots ohne `pageerror` durchliefen.

**Ist der Vertrags-Kommentar wortgetreu?** Ich habe ihn Satz fuer Satz gegen Abschnitt 3.3 des
Plans (`docs/pm-briefings/opus-plan-feinschliff-vier-disziplinen-09-10.md:262`) gehalten:
die verbotene Feldliste (`u.summe`, `u.runden`, `u.aktuell`, `u.vorteil`, `u.zweikampf`,
`u.lunge`, `buehneAkt`, `buehneZeiger`, `done`), die `rr()`-Begruendung samt Zeilenverweis
`:13913`, der Hinweis auf den reinen Hash aus `u.id`, und der Schlusssatz
"keine Hoeflichkeit, sondern Bedingung" — **alles woertlich uebernommen**. Auch der
Funktionsrumpf ist Zeichen fuer Zeichen der aus dem Plan.

Einzige Abweichung: der Plan zeigt die Aufrufzeile mit angehaengtem Kommentar
`// rein praesentational, s. Vertrag unten`; im Code steht sie nackt. Belanglos.

---

## 5. `scripts/screenshot-disziplin.mjs`

Gelesen und selbst benutzt. Es ist eine ehrliche Generalisierung: Disziplin, Wartezeit und
Zieldatei als Argumente, `setDisc()`-Fehler wird abgefangen und mit Exit-Code 1 gemeldet,
`pageerror` wird gesammelt und am Ende ausgegeben. `scripts/screenshot-gewichtheben.mjs` ist
**nicht geloescht** (nachgesehen: liegt unveraendert da) — richtig so, es ist in aelteren
PR-Beschreibungen verlinkt, und der Kopfkommentar sagt das auch.

Ich habe die Mechanik selbst gefahren (in einer eigenen, danach geloeschten Variante, die den
HTML-Pfad als Argument nimmt) und damit sechs Disziplinen von **beiden** Baeumen gerendert:
`takeshis-castle`, `spurt`, `climbing`, `eiskunstlauf`, `gewichtheben`, `breaking` — jeweils
**0 `pageerror`** auf beiden Seiten. Damit ist auch der neue `istBahn(disc)`/`bahnDisc`-Zugriff
in `zeichneSprite` (beide erst bei `:17624`/`:17626` deklariert, also weit **nach** der
Verwendung bei `:2587`) im Betrieb bestaetigt: das ist dasselbe IIFE-Muster, das `istBuehne`
schon vorher benutzte, und es traegt.

**Was ich damit NICHT belegen konnte:** ein Vorher/Nachher-Bildvergleich. Die Szene laeuft in
Echtzeit weiter, der Screenshot faellt nach fester Wanduhr-Wartezeit — die PNGs unterscheiden
sich deshalb auch dort, wo sich am Code nichts geaendert hat (`eiskunstlauf`, `breaking`). Der
Vergleich ist als Beweismittel wertlos, und ich habe ihn verworfen. Der Bugfix ist statt dessen
oben in 3.2 am Code bewiesen. Wer ein Bild braucht, braucht einen eingefrorenen Frame — das
waere eine sinnvolle kleine Erweiterung des Skripts, aber nicht Sache dieser PR.

---

## 6. Nachtraege

**N1 — Kommentar bei `:2103` ist unvollstaendig.** Die Behauptung, `waffeEffektiv` werde
"ausschliesslich" an drei Stellen gelesen, uebergeht die Ableitung zu `bogen`/`feuerwaffe`
(`:2588`/`:2589`) und deren Wirkung auf `ani` bei `:2608`. Die Schlussfolgerung bleibt richtig
(alles im Zeichenpfad), die Aufzaehlung nicht. Einen Halbsatz nachziehen, beim naechsten
Anfassen der Stelle. Kein eigener PR noetig.

**N2 — drei LIVE-Disziplinen aendern sichtbar ihr Bild, und die PR sagt es nicht.**
`showcase`, `tennis` und `wettessen` stehen in `ARENA_RESOLVED_DISCIPLINE_IDS`
(`lib/resolve/battle-mode-arena-team-points.ts:201`) und sind damit im echten Spielbetrieb.
Alle drei verlieren mit dieser PR ihre Kosmetikwaffe; wer eine Bogen- oder Pistolen-Kosmetik
trug, wechselt zusaetzlich von der `shoot`- auf die `slash`-Pose. Der **alte** Kommentar hatte
`showcase` ausdruecklich ausgenommen, mit genau dieser Begruendung ("bewusst unangetastet").
Diese PR kehrt die Entscheidung um — sachlich zu Recht (niemand spielt Tennis mit einer Axt),
aber die PR-Beschreibung verkauft es unter "bit-identisch fuer alle 9 Buehnen-Disziplinen".
Das stimmt fuer die **Messwerte** und ist von mir bestaetigt; fuer die **Pixel** stimmt es
nicht. Chris sollte das vor dem Deploy hoeren, sonst meldet er es als Bug.

**N3 — die Ton-Schicht ist heute stumm.** `sfx()`/`tonLoop*` sind ausserhalb der
Diagnose-Haken nirgends aufgerufen. Plan-konform, aber nach dem Merge klingt nichts anders.
In der Merge-Nachricht erwaehnen.

**N4 — `Math.random()` in `tonRauschPufferHolen`.** Die einzige Nichtdeterminismus-Quelle im
neuen Code. Sie beruehrt `rr()` nicht und laeuft nur, wenn ein `AudioContext` existiert (in
Node/Messbetrieb also nie). Harmlos, hier nur der Lueckenlosigkeit halber genannt.

**N5 — ungeschuetzte Property-Suche.** `TON_KATALOG[disziplin]` und `DISZIPLIN_WAFFE[aktiveDisc]`
greifen ohne `hasOwnProperty` zu. Ich habe `"constructor"`, `"__proto__"`, `"toString"` und
`"valueOf"` durch `sfx()` geschickt — alle stille No-Ops, die nachgelagerten Pruefungen fangen
es. Bei `DISZIPLIN_WAFFE` ist der Fall ohnehin theoretisch, weil `buehneDisc`/`bahnDisc` nur aus
festen Disziplin-IDs kommen. Kein Handlungsbedarf, nur eine Notiz fuer den Fall, dass jemand
spaeter Benutzereingaben durchreicht.

**N6 — "42/42 Vitest" nicht reproduziert.** Siehe Abschnitt 1. Durch den gruenen CI-Job
`full-test-suite` auf demselben SHA abgedeckt, aber die genannte Zahl habe ich nicht gesehen.

**N7 — Plan-Tippfehler.** Plan Abschnitt 3.3 sagt "zehn Buehnen-Disziplinen", es sind neun.
Betrifft den Plan (#870), nicht diese PR.

---

## 7. Was ich nicht pruefen konnte

* **Ton auf echter Hardware.** Playwright laeuft ohne Audio-Geraet. Ich habe bewiesen, dass die
  Aufrufe nicht werfen und den Zufallszustand nicht anfassen — **nicht**, dass die Toene gut
  klingen oder ueberhaupt hoerbar sind. Das kann nur Chris.
* **Der `{datei:...}`-Pfad** ist von keinem Katalogeintrag benutzt und damit unerprobt (2.5).
* **Der Server.** Wie in `CLAUDE.md` beschrieben kommen Agenten nicht heran; alles hier ist am
  Repo und in der lokalen Playwright-Umgebung gemessen.
* **Ein deterministischer Bildvergleich** vorher/nachher (5).

---

## 8. Fazit

Diese PR tut genau das, was eine PR 0 tun soll: sie legt Fundament, ohne irgendetwas zu
bewegen. Drei Messlaeufe ueber alle 17 gemessenen Disziplinen sind **bit-identisch** mit `main`,
die Slot-Invariante haelt mit 0,005 Pp gegen eine Schranke von 0,2 Pp, 120 lokale Tests und
alle vier CI-Jobs sind gruen, und die drei harten Regeln des Plans (`bk*` unangetastet, kein
`rr()`, kein Schreiben auf `u`/`TEILNEHMER`/`LAEUFER`) habe ich einzeln nachgemessen statt
nachgelesen — die `rr()`-Neutralitaet sogar empirisch im laufenden Browser.

Der Requisiten-Bugfix ist echt und am Code beweisbar. Die Tabelle ist vollstaendig. Der
Dispatcher ist eine Zeile und ein Vertrag, beides wortgetreu aus dem Plan.

**FREIGEBEN MIT NACHTRAG.** Der kritische Pfad ist frei — die drei Ziel-Agenten koennen starten.
Von den sieben Nachtraegen ist genau einer mitteilungspflichtig: **N2**, die sichtbare Aenderung
an `showcase`/`tennis`/`wettessen`. Die restlichen sechs sind Aktenlage.
