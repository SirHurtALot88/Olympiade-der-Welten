# Gewichtheben Sandsack-Finale — Paket 2: Präsentation (04.10., Task #58)

**Status: gebaut, visuell geprüft, bewusst NICHT in den Spielablauf verdrahtet.** Dieses
Dokument berichtet, was aus Fables Präsentationskonzept
(`docs/design/gewichtheben-sandsack-rennen-fable-praesentation-03-10.md`) nach Paket 1
(`docs/design/gewichtheben-sandsack-finale-paket1-umsetzung-03-10.md`) und Paket 1b
(`docs/design/gewichtheben-sandsack-finale-paket1b-kalibrierung-04-10.md`) als Paket 2
entstanden ist: Bühnenbild, Sack-Stufen, Taktik-Sichtbarkeit, Pantomimen, Ticker und Ton —
alles additiv, alles reine Darstellung, nichts an der kalibrierten Mechanik verändert.

---

## 1. Was gebaut wurde

Alles additiv in `public/mockups/battle-mode.engine.js`, direkt nach `baueSandsackFinale()`
eingehängt (ca. 430 neue Zeilen in einem zusammenhängenden, klar kommentierten Block):

* **Szenen-Aufbau** (`sandsackSzeneSeite()`, `sandsackSzeneZeitplan()`, `sandsackSzeneBauen()`):
  liest `LASTEN_FINALE` und die bereits von Paket 1 gesetzten `u.lastKg/u.lastSaecke/
  u.lastRutscher/u.lastPausen/u.lastDoppelt` sowie die reine, deterministische Funktion
  `sandsackZuteilung()` ein zweites Mal (kein `rr()`, kein Seiteneffekt, identisches Ergebnis),
  um herauszufinden, wer welche Station bekam. Daraus entsteht eine Liste von **Trips**
  (ein Trip = ein Sack-Gang an einer Station, mit Träger, Gewicht, Doppel-/Rutscher-/Pause-/
  Übergabe-Flag) und ein **Zeitplan**, der die bereits bekannte ECHTE Rennzeit
  (`LASTEN_FINALE.zeit[side]`) auf diese Trips verteilt.
* **Bühnenbild "Der Hof"** (`zeichneSandsackBuehne()`): zwei Bahnen, drei Stationen (Depot/
  Steg/Rampe & Silo — die `fableLabel`-Felder aus Paket 1), je ein eigenes Bodenmaterial,
  Depot-Stapel (schrumpfende Sack-Pyramide), Silo mit Füllstand in Teamfarbe, Wartezone
  hinter dem Depot, Taktik-Badge am Bahnanfang. Alles Canvas-Formen, keine neuen Bilddateien.
* **Sack-Stufen-Visualisierung** (`SANDSACK_VIZ_STUFEN`, `sandsackVizZeichneSack()`): sechs
  Stufen nach Fables Tabelle 3.1, Schulter-Anker für 1–3, der bestehende Front-Rack-Anker
  `HEBEN_PHASEN.zug.anteil` (0,326) für 4–6 — exakt der Anker, den `zeichneHantel()` schon für
  den Scheibenstapel nutzt.
* **Team-Taktik-Sichtbarkeit**: Taktik-Badge (Staffel/Stationen/Alleingang) am Bahnanfang,
  Aufstellungs-Ticker-Zeile vor dem ersten Trip, Übergabe-Flag an jedem Trip, bei dem ein
  Zweier-Team den Träger wechselt.
* **Rutscher-/Pause-Pantomime** (`stepSandsackVorschau()`, `zeichneSandsackTraeger()`): ein
  fester Zeitfenster-Mechanismus innerhalb jedes Trips — bei einem Rutscher fällt der Sack
  sichtbar Richtung Boden (mit Sandwolke), bei einer Pause steht der Sack neben der Figur auf
  Hüfthöhe, während die Figur ein Atemheben zeigt. Puste-Ring über dem Kopf (Fable 3.2) füllt
  sich während der Pause und leert sich während des Tragens.
* **Ticker-Dramaturgie** (`sandsackTickerPruefen()`): elf unterscheidbare Zeilenarten
  (Aufstellung, Start, Stationseintritt, schwerer Sack, Übergabe, Rutscher, Pause (2
  Varianten), Laufsieg (2 Varianten), Nachlese) im Haus-Stil, jede am Moment des Ereignisses
  geschrieben (Spoiler-Regel wie bei den Kampfrichterlampen).
* **`TON_KATALOG.gewichtheben`-Erweiterung**: neun neue Einträge (`hupe`, `sack_auf`,
  `sack_ab`, `schritt_last`, `sack_fall`, `keuchen`, `uebergabe`, `sack_silo`, `laufsieg`),
  alle aus den fünf vorhandenen Ton-Primitiven zusammengesetzt.
* **Probe-Einstiegspunkte** auf `window.__arena`: `sandsackVorschau(an, vorspulenSekunden)`
  schaltet die Szene ein/aus (optional mit Vorspulen für QA/Screenshots, ohne auf echte
  Sim-Frames zu warten), `sandsackVorschauZeitplan()` gibt den vollständigen Trip-Zeitplan
  beider Seiten zurück — für gezieltes Vorspulen auf einen Rutscher-/Pause-/Übergabe-Moment.

**Neue Datei:** `scripts/screenshot-sandsack-finale.mjs` — der visuelle Rauchtest, analog zu
`scripts/screenshot-gewichtheben.mjs`.

---

## 2. Das zentrale Gate: NICHT in den Spielablauf verdrahtet

Genau wie Paket 1/1b `seiten` in `spieleBuehneHeben()` bewusst unverändert ließen, bleibt auch
die komplette Präsentation aus Paket 2 **hinter einem Schalter**, der bei jedem echten
Spielstand aus ist:

```js
let sandsackVorschauAktiv=false;
```

`buehnenBewegung()` und `zeichneBuehne()` bekommen je eine neue, vorangestellte Zeile:

```js
if(art.heben && sandsackVorschauAktiv && typeof stepSandsackVorschau==="function"){ stepSandsackVorschau(dt); return; }
// ... (zeichneBuehne() analog mit zeichneSandsackBuehne)
```

Solange `sandsackVorschauAktiv` `false` ist (der Default, jeder echte Spielstand), erreichen
diese beiden Funktionen den neuen Code überhaupt nicht — `stepHeben()`/`zeichneHeben()` laufen
exakt wie vorher. Der Schalter wird ausschließlich von `window.__arena.sandsackVorschau()`
gesetzt, einer reinen Test-/QA-Schnittstelle, die kein echtes Spiel je aufruft.

**Warum dieses Gate, statt die Szene direkt nach den sechs Hantel-Duellen einzuhängen:**
Fables eigenes Papier (Abschnitt 8) flaggt das Sandsack-Finale ausdrücklich als
**Klasse-T-Verdacht** — ein sichtbares Rennen braucht 35–150 Sekunden zusätzliche Sendezeit
(oder ersetzt Duelle, ein Formatwechsel), und welcher der drei Wege (A/B/C) es wird, ist
ausdrücklich **Chris' Entscheidung**, nicht Teil dieses Auftrags. Diesen Auftrag als
"Präsentation bauen, nicht Spielablauf ändern" zu lesen heißt: die Fähigkeit bauen, sie
vollständig funktionsfähig und geprüft machen, aber den Moment, an dem ein Zuschauer sie
tatsächlich zu sehen bekommt, Chris überlassen — exakt dieselbe Zurückhaltung, die Paket 1 bei
`seiten` schon gezeigt hat. Wenn Chris sich für einen Weg entscheidet, ist das Einhängen danach
eine einzige zusätzliche Zeile in `baueSandsackFinale()`s Aufrufkette oder in
`spieleBuehneHeben()` — kein neuer Bau.

---

## 3. Ehrliche Einordnung: was eine Anzeige-Heuristik ist, kein Replik der Mechanik

Der Auftrag verlangt "nur LESEN der Datenfelder, die die Mechanik bereits liefert" — und genau
das tut dieser Code. `LASTEN_FINALE` trägt nach Paket 1/1b nur **Summen** je Seite
(`zeit/abgeliefertKg/saecke/rutscher/pausen/doppelt/plan/teamScore/sieger`), und jeder Athlet
trägt nur **seine eigenen Summen** (`u.lastKg/u.lastSaecke/u.lastRutscher/u.lastPausen/
u.lastDoppelt`). Welcher **einzelne** Gang ein Rutscher war, welcher eine Pause, welcher
gedoppelt wurde — das ist von der Mechanik nirgends einzeln exponiert; `sandsackSeiteLauf()`
kennt es nur für die Dauer seines eigenen Aufrufs und gibt es nicht nach außen weiter.

`sandsackSzeneSeite()` verteilt deshalb die bekannten Summen **greedy, deterministisch, in
Stations-/Gangreihenfolge** auf die Trips (erster verfügbarer Gang bekommt den ersten noch
offenen Rutscher/die erste offene Pause/den ersten offenen Doppel-Gang desselben Athleten).
Das ist eine **Anzeige-Heuristik**, keine Replik der echten internen Simulation — mit zwei
Konsequenzen, die ich bewusst nicht verschweige:

1. **Welcher Gang** exakt ein Rutscher war, kann von dem abweichen, was die echte Simulation
   intern gewürfelt hat — nur die GESAMTZAHL je Athlet stimmt garantiert.
2. Eine zweite, unabhängige Option wäre gewesen, `sandsackSeiteLauf()`s bereits intern
   vorhandenes `protokoll`/`pausen`-Array (das die exakte Reihenfolge UND cumulative Zeit
   trägt) zusätzlich in `LASTEN_FINALE` zu spiegeln. Ich habe mich bewusst dagegen
   entschieden: der Auftrag sagt ausdrücklich "nur LESEN", und selbst ein rein additives
   Exponieren hätte eine — wenn auch harmlose — Änderung an `baueSandsackFinale()`/
   `sandsackSeiteLauf()` selbst bedeutet, der kalibrierten Zone aus Paket 1/1b. Die
   Anzeige-Heuristik kostet keine einzige Zeile Diff in dieser Zone und ist für eine
   Präsentation, die ohnehin noch nicht live läuft, die konservativere Wahl. Will Chris später
   eine bit-exakte Replik, ist das Spiegeln von `protokoll`/`pausen` der nächste, kleine
   Schritt — mit Paket 1b als Review-Partner, da es genau diese Zone zuletzt angefasst hat.

**Eine zweite, wichtigere Erkenntnis beim Bauen:** Fables ursprüngliches Konzept beschrieb
"Staffel 3" als *eine Figur je Station* mit Übergabe an den Stationsgrenzen. Die tatsächliche
Paket-1-Mechanik (`sandsackZuteilung()`) setzt "staffel" aber als **Zweier-Paare je Station**
um — zwei Athleten teilen sich eine Station und wechseln sich dort beim Tragen ab (der
ruhende Partner erholt sich, s. `SANDSACK_RAST_*`-Konstanten), nicht ein einzelner Läufer, der
durch alle drei Stationen läuft. Die Übergabe, die Paket 2 zeigt, passiert deshalb **innerhalb
einer Station** zwischen den zwei zugeteilten Trägern, nicht an den Stationsgrenzen zwischen
drei verschiedenen Läufern. Das ist eine Anpassung an die reale, bereits kalibrierte Mechanik,
nicht an Fables ursprüngliche Vorstellung — und korrekt, weil Paket 2 ausschließlich zeigen
darf, was die Mechanik tatsächlich tut.

---

## 4. Screenshots

Erzeugt mit `node scripts/screenshot-sandsack-finale.mjs <saat> <vorspulenSekunden>`
(Saat 1337, Kaderfamilie `vigilante-armageddon`).

**Bühnenbild im Lauf** (t≈25s, beide Seiten mitten im ersten Depot-Trip):
`docs/design/gewichtheben-sandsack-finale-paket2-buehne-04-10.png` — zwei Bahnen mit drei
Stationszonen (Depot/Steg/Rampe & Silo), Depot-Stapel links, Silo mit Teamfarben-Füllstand
rechts ("2/11", "2/14"), Taktik-Badges ("Heim: Staffel", "Gast: Stationen"), Wartezone-Gruppe
am linken Rand, Puste-Ring über den aktiven Trägern.

**Pause-Pantomime** (t≈43,5s, Tidesprinter/Gast auf dem Steg):
`docs/design/gewichtheben-sandsack-finale-paket2-pause-04-10.png` — der Sack steht sichtbar
NEBEN der Figur auf Hüfthöhe statt getragen zu werden, der Puste-Ring füllt sich.

**Rutscher-Pantomime** (t≈97,9s, Greenkraut/Gast an Rampe & Silo):
`docs/design/gewichtheben-sandsack-finale-paket2-rutscher-04-10.png` — der Sack ist sichtbar
Richtung Boden gefallen statt am Körper-Anker zu hängen; die beiden Momente (Pause vs.
Rutscher) sind auf einen Blick unterscheidbar, wie Fables Konzept es verlangt ("beim Rutscher
fällt etwas und die Figur dreht sich um; bei der Pause steht etwas neben ihr und sie atmet").

Ein vierter Rauchtest (Lava Golem, ein Vollbild-Kreatur-Blatt) lief ohne Seitenfehler; der
Sack-Anker landet dort sichtbar ungenauer (verdeckt teilweise vom Kreaturkörper) — exakt die
Grenze, die Fables Papier Abschnitt 7.3 selbst benennt ("Vollbild-Kreaturen bekommen Sack und
Ring über `koerperHoehe` richtig platziert, aber keine Neigung/Stauchung-Feinheit"). Keine
Regression, keine neue Einschränkung — dieselbe wie überall sonst im Spiel bei Vollbild-Figuren.

---

## 5. Bewusste Vereinfachungen gegenüber Fables Konzept

Zur Ehrlichkeit, da der Auftrag Transparenz über Kompromisse verlangt:

1. **Aufstellungsmoment** (Fable 4.3, "Figuren gehen an ihre Stationen"): in dieser Fassung
   zeigt die Aufstellungsphase die Athleten weiterhin in der gemeinsamen Wartezone, nicht
   bereits an ihre jeweilige Station laufend. Die Ticker-Zeile und das Badge kündigen die
   Taktik trotzdem vor dem ersten Trip an (kein Spoiler-Verstoß), aber das Lauf-Bild selbst
   fehlt. Eine Lauf-Interpolation nach dem Muster von I-Spys `gehen`-Phase wäre der nächste
   Schritt, falls Chris mehr Politur will.
2. **Wartezone als EINE gemeinsame Gruppe**: während eine Station läuft, stehen alle gerade
   untätigen Athleten (auch die, die später an einer ANDEREN Station arbeiten) zusammen am
   Depot-Rand, statt an ihrer jeweils eigenen, noch nicht begonnenen Station zu stehen. Das
   ist eine Vereinfachung, kein Fehler — aber für die ideale Lesbarkeit "wer macht wann was"
   wäre eine stationsgebundene Wartung die nächste Verfeinerung.
3. **Keine Sub-Phasen-Feinzeichnung** innerhalb von Rutscher/Pause: Fables Konzept beschreibt
   vier Schritte für den Rutscher (Lösen/Aufprall/Umdrehen/Aufnehmen) und drei für die Pause
   (Absetzen/Stehen-Atmen/Aufnehmen). Diese Fassung zeigt den **Zustand** (Sack fällt/liegt
   unten vs. Sack steht abgestellt daneben) über ein einzelnes, interpoliertes Zeitfenster,
   nicht jede der einzelnen Fable-Teilschritte als eigene, benannte Phase. Der visuelle
   Unterschied zwischen beiden ist trotzdem sofort erkennbar (s. Screenshots oben).
4. **Timing ist Pacing, nicht Physik**: die Trip-Dauern kommen aus einer Gewichts-/
   Ereignis-gewichteten Formel, die auf die ECHTE Gesamtzeit der Mechanik normiert wird — sie
   ist plausibel, aber keine physikalische Simulation von Lauftempo/Strecke.

Keine dieser Vereinfachungen berührt die Mechanik, die Wertung oder eine Zufallszahl — alle
betreffen ausschließlich, WIE plastisch die bereits bekannten Zahlen im Bild erzählt werden.

---

## 6. Isolationsnachweis

**Methode:** `window.__arena.spiele("gewichtheben", saat)` und
`window.__arena.spieleBuehneHeben("gewichtheben", saat)` für die sieben Standard-Saaten
(1337, 4242, 99991, 2026, 555555, 7919, 104729), einmal gegen `origin/main`
(`3a94af84`, enthält Paket 1b) und einmal gegen diesen Branch — per Playwright, JSON-
Serialisierung beider Rückgabewerte verglichen (`check.mjs`, lokal, nicht Teil des Commits).

```
Saat 1337: byte-identisch
Saat 4242: byte-identisch
Saat 99991: byte-identisch
Saat 2026: byte-identisch
Saat 555555: byte-identisch
Saat 7919: byte-identisch
Saat 104729: byte-identisch
ISOLATIONSNACHWEIS BESTANDEN
```

**Warum das garantiert ist, nicht nur gemessen:** `sandsackVorschauAktiv` ist `false`, solange
niemand `window.__arena.sandsackVorschau(true)` aufruft — kein Codepfad in `spieleDisziplin()`/
`spieleBuehneHeben()`/`baueSandsackFinale()` tut das. Der gesamte neue Code (ca. 430 Zeilen)
ist entweder (a) hinter diesem Schalter in `buehnenBewegung()`/`zeichneBuehne()` gegated, oder
(b) komplett neue, nirgendwo sonst aufgerufene Funktionen (`sandsackSzene*`, `zeichneSandsack*`,
die neuen `window.__arena`-Probes). Keine bestehende Funktion, kein bestehendes Feld wurde
verändert — der einzige Diff außerhalb des neuen Blocks sind die zwei Gate-Zeilen und die
TON_KATALOG-Erweiterung (ein reines Hinzufügen neuer Schlüssel in ein bestehendes Objekt).

**Zusätzlich gegengeprüft:** `node scripts/miss-sandsack-finale.mjs 24 144` auf diesem Branch
liefert exakt dieselben Zahlen wie Paket 1b dokumentiert (Pp-Abweichung 19,3/22,7, Team-
Validität 0,794, Planverteilung/Rutscher/Pausen-Deskriptivwerte im selben Rahmen) — die
Mess-Pflichtsonde selbst lief unverändert durch und bestätigt, dass an der Mechanik nichts
gerührt wurde.

---

## 7. Visuelle Verifikation

`scripts/screenshot-sandsack-finale.mjs` (neu, nach dem Muster von
`scripts/screenshot-gewichtheben.mjs`): lädt die Seite, baut ein Gewichtheben-Duell,
aktiviert `window.__arena.sandsackVorschau(true, vorspulenSekunden)` und macht einen
Canvas-Screenshot. Vier Läufe ohne Seitenfehler (`Seitenfehler: keine`) bei verschiedenen
Vorspul-Zeitpunkten, s. Abschnitt 4 für die Bilder.

---

## 8. Geänderte/neue Dateien

* `public/mockups/battle-mode.engine.js` — additiv: der komplette Präsentations-Block nach
  `baueSandsackFinale()` (Szenen-Aufbau, Ticker, Schritt-Funktion, Zeichenfunktionen), zwei
  Gate-Zeilen in `buehnenBewegung()`/`zeichneBuehne()`, neun neue `TON_KATALOG.gewichtheben`-
  Einträge, drei neue `window.__arena`-Probes (`sandsackVorschau`, `sandsackVorschauZeitplan`).
  Keine Änderung an `baueSandsackFinale()`, `sandsackSeiteLauf()`, `sandsackGang()`,
  `sandsackWuerfe()`, einer `SANDSACK_*`-Konstante, `LASTEN_FINALE`, `seiten` in
  `spieleBuehneHeben()` oder der Eignungsmatrix.
* `scripts/screenshot-sandsack-finale.mjs` — neuer visueller Rauchtest.
* `docs/design/gewichtheben-sandsack-finale-paket2-buehne-04-10.png`,
  `gewichtheben-sandsack-finale-paket2-pause-04-10.png`,
  `gewichtheben-sandsack-finale-paket2-rutscher-04-10.png` — Belegscreenshots (Abschnitt 4).
* `docs/design/gewichtheben-sandsack-finale-paket2-praesentation-04-10.md` — dieses Dokument.

---

## 9. Offene Fragen und Risiken für Chris

1. **Wann im Spiel (Weg A/B/C aus Fables Papier Abschnitt 8)** bleibt offen — das ist der
   Kern des Gates in Abschnitt 2. Paket 2 liefert die fertige Fähigkeit; das Einhängen ist
   danach eine kleine, separate Entscheidung plus eine Zeile Code.
2. **Anzeige-Heuristik statt Replik** (Abschnitt 3): sollte Chris eine bit-exakte Abbildung
   der tatsächlichen Rutscher-/Pause-/Doppel-Positionen wollen, ist das additive Spiegeln von
   `sandsackSeiteLauf()`s bereits vorhandenem `protokoll`/`pausen`-Array in `LASTEN_FINALE`
   der nächste, kleine, risikoarme Schritt (siehe Begründung dort).
3. **Die drei Vereinfachungen aus Abschnitt 5** (kein Lauf-Bild in der Aufstellung, gemeinsame
   statt stationsgebundene Wartezone, keine Fable-Sub-Phasen) sind reine Politur-Fragen für
   eine mögliche nächste Runde, keine strukturellen Lücken.
4. **Vollbild-Kreaturen** (Golem/Kraken/Werwolf) bekommen Sack/Ring gröber platziert als
   LPC-Sprites — dieselbe, bereits dokumentierte Grenze wie bei der Hantel selbst
   (Fable-Papier Abschnitt 7.3), keine neue Einschränkung dieses Pakets.
