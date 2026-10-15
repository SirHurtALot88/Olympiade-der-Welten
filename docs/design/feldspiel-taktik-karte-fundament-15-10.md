# Feldspiel-Taktik-Karte: gemeinsames Fundament (Basketball P4) — 15.10.

**Auftrag:** Chris' Sammel-Antwort auf eine Liste offener Punkte, "ja überall D, bau weiter" —
konkret: die Taktik-Karte-Idee aus `docs/design/fable-ideen-feldspiel-30-09.md` Abschnitt 2.2
("Eine Taktik-Karte, drei Optionssätze — nicht drei Taktik-Karten") bauen, Basketball zuerst.

**Ergebnis in einem Satz:** Das **Fundament** ist gebaut und gemessen bit-identisch (Klasse A) —
die disziplin-generische Datenstruktur, die Basketball-P4-Optionssätze (vier Schalter aus
`basketball-opus-konzeptreview-26-09.md` P4) und eine deterministische KI-Vorgabe. Die
**Mechanik-Bindung** (was Zone 3-3 oder Screen-Coverage tatsächlich am Live-Motor ändert) und
die **UI-Integration** in den Matchday-/Lineup-Fluss sind **bewusst nicht Teil dieser Runde** —
Begründung in Abschnitt 3.

---

## 1. Zwei Abhängigkeiten geprüft, bevor gebaut wurde

### 1.1 "Spiel des Tages"-Replay (Task #31) — NICHT vollständig erledigt

Abschnitt 2.1 desselben Fable-Dokuments sagt wörtlich: "Eine Trainerkarte, deren Wirkung man
sieht, ist Gameplay. Eine, deren Wirkung man nur in einer Tabelle vermutet, ist ein Formular."
Task #31 (PR #1108, `git log` Commit 8895a2e1, "Feldspiel Paket 1 'Spiel des Tages': Drei
Momente") wurde geprüft — **nicht** als pauschal "erledigt" übernommen, sondern am Commit
nachgelesen:

> Task #31 hat ausdrücklich **nur** den zweiten Teil von 2.1 gebaut (den "Drei Momente"-Kasten
> aus dem Ereignisprotokoll). Der **volle Replay** ("Sekunde-für-Sekunde identisches
> Nachspielen") wurde **bewusst nicht gebaut** — zwei Gegenbefunde aus der PR-Beschreibung:
> `buildArenaTeam()`/`buildArenaAufstellungBeide()` lesen den aktuellen Spielstand, keine
> eingefrorene Kopie zum Spieltag; und Hockeys `ZEIT_DEHNUNG.hockey=2` würde bei einem späteren
> Replay-Lauf eine andere `rr()`-Kette ziehen als beim Original.

**Konsequenz für diese Runde:** Die Prämisse aus 2.1 ("ohne Replay ist jede Taktik-Karte nur ein
Formular") ist für Basketball weiterhin **nicht aufgelöst** — der Manager sieht sein eigenes
Spiel bis heute nicht. Das ändert an der Architektur-Entscheidung aus 2.2 nichts (die ist davon
unabhängig sinnvoll), begrenzt aber den Nutzen einer **manager-seitigen** UI, solange sie nicht
gebaut ist: eine Taktik-Wahl, deren Wirkung niemand sieht, bleibt genau das Formular, vor dem das
Konzeptpapier warnt. Diese Runde baut deshalb die Infrastruktur **KI-seitig vollständig**, aber
hält die manager-seitige UI für den nächsten Schritt zurück (s. Abschnitt 4) statt sie
vorzuziehen, obwohl ihre Wirkung noch nicht sichtbar wäre.

### 1.2 Task #33 ("Rezeptrunden-Auftaktschritte F1 EPA, B1+B2a, H-C") — hat NICHTS vorbereitet

`docs/design/feldspiel-rezeptrunde-f1-b1-umsetzung-03-10.md` (Task #33) wurde gelesen. Der
eigene erste Satz grenzt den Auftrag ausdrücklich ein: *"F1 (§4, 'EPA statt Yards') und
B1-Stufe-1 (§3, 'Gravity-Assist als Buchhaltung'). B2 (Freiwurf), H-C (Torwart-Passgeber) und
Gravity-Stufe-2 sind ausdrücklich NICHT Teil dieses Auftrags."* Basketball P4 (die Taktik-Karte)
kommt in diesem Dokument **an keiner Stelle** vor — weder als Code noch als KI-Logik. Die
Vermutung, Task #33 könnte Teile der KI-Vorgabe für die Taktik-Karte vorbereitet haben, trifft
nicht zu. Diese Runde beginnt bei null.

---

## 2. Was gebaut wurde

Alles in `public/mockups/battle-mode.engine.js`, keine andere Datei angefasst.

### 2.1 Datenstruktur (disziplin-generisch)

`FELDSPIEL_ART.<disziplin>.taktik = { schalter: [ {id, label, stufen:[{id,label,beschreibung}],
standard, vorgabe:(eigen,gegner,kontext)=>stufeId} ... ] }` — exakt die Form, die das
Fable-Dokument 2.2 selbst vorschlägt. Nur `FELDSPIEL_ART.basketball` trägt aktuell einen
`taktik`-Block; Hockey und Football liefern ihren später nach demselben Schema, ohne dass eine
der drei Engine-Funktionen unten geändert werden muss.

**Basketball P4** (vier Schalter, 1:1 aus `basketball-opus-konzeptreview-26-09.md` Abschnitt
"P4 — Trainerkarte", die in `fable-ideen-feldspiel-30-09.md` 1.2 zusammengefasste Liste).
**Fundstellen-Hinweis:** Dieses Dokument liegt nicht auf `main`, sondern nur auf dem nie
gemergten Branch `basketball-konzeptreview-26-09` (Commit 53dde2d7) — `fable-ideen-feldspiel-
30-09.md` zitiert es trotzdem als "im Repo-Verlauf". Gelesen per
`git show origin/basketball-konzeptreview-26-09:docs/design/basketball-opus-konzeptreview-26-09.md`.
Ob dieses Review-Dokument auf `main` nachgezogen werden soll, ist eine eigene, kleine
Aufräum-Frage und nicht Gegenstand dieser Runde.

| Schalter | Stufen | KI-Gegenmittel-Logik (gebaut) |
|---|---|---|
| Angriff | Tempo · Halbfeld/Pick-and-Roll · Innen | Tempo gegen langsame Gegner (LAUFTEMPO ≤44), Innen bei ≥8 Punkten Vorsprung in SCHUSS_NAH gegen gegnerische ABWEHR, sonst Halbfeld |
| Verteidigung | Mann eng · Mann tief/Pack-Line · Zone 3-3 | Zone gegen schwache Schützen (SCHUSS_FERN ≤44), Mann eng gegen schwache Ballführer (AUFBAU ≤44), sonst Mann tief |
| Screen-Coverage | Drop · Switch · Blitz | **Platzhalter** — Review verweist selbst nur auf P3 (Pick-and-Roll), das noch nicht existiert; vorläufig aus der eigenen Verteidigung (beweglich → Switch, druckstark → Blitz, sonst Drop) |
| Bretter | Angreifen · Zurück | Angreifen bei Rückstand oder ≥8 Punkten Größenvorteil (Mittel aus SCHUSS_NAH/ABWEHR), sonst Zurück |

Alle vier `vorgabe()`-Funktionen lesen ausschließlich bereits vorhandene, matrixgewichtete
Rezeptwerte der Feldspieler (`u.SCHUSS_FERN/SCHUSS_NAH/LAUFTEMPO/AUFBAU/ABWEHR`) — keine
Matrixänderung, kein neuer Sub-Skill, kein `rr()`-Aufruf. Die Schwellen (44/56/8 Punkte) sind
**Platzhalter**, am Rezept-Mittelwert 50 gespiegelt — unkritisch, weil in dieser Runde nichts
davon gelesen wird (s. 2.3).

### 2.2 Generische Engine-Funktionen

- `berechneTaktikAuto()` — analog zu `berechneFokusAuto()`: für beide Seiten unabhängig, liest
  `FB().taktik.schalter`, ruft je Schalter dessen `vorgabe(eigen,gegner,kontext)` auf (mit
  try/catch-Fallback auf `standard`), schreibt nach `fsLive.taktikAuto[seite]`. No-opt für jede
  Disziplin ohne `taktik`-Block (aktuell alle außer Basketball) — bit-identisch zum bisherigen
  Verhalten, exakt das Muster, mit dem `berechneFokusAuto` schon heute jede Nicht-Basketball-
  Disziplin unberührt lässt.
- `effektiverTaktik(seite,schalterId)` — manuelle Wahl (`fsLive.taktikManuell`) geht vor der
  automatischen Vorgabe, dieselbe Reihenfolge wie `effektiverFokus`.
- `setzeTaktik(seite,schalterId,stufeId)` — die Schnittstelle für eine künftige UI oder eine
  Mess-Sonde, schreibt nur das Datenfeld.
- Aufgerufen an denselben zwei Zeitpunkten wie `berechneFokusAuto`: einmal beim Spielaufbau
  (`initFeldspielLive`), erneut bei jedem Viertelwechsel (`starteViertelpause`) — für eine
  künftige Mechanik, die auf eine Rotation oder einen Foulausstieg reagieren soll.
- `window.__arena.taktikSetzen/taktikLesen/taktikSchalterVon` — Mess-/QA-Schnittstelle nach dem
  Muster von `buehneHaltungTest`/`persHandwerk`, die Entsprechung zu Fables Vorschlag "ein
  Parameter `--taktik=<id>:<stufe>` für alle drei" (als Funktionsaufruf statt CLI-Flag, weil die
  Headless-Sonden ohnehin über `window.__arena` fahren).

### 2.3 Warum das beweisbar Klasse A ist

Grep über die ganze Datei nach `taktikAuto`/`taktikManuell`/`effektiverTaktik` zeigt: außer der
Initialisierung in `initFeldspielLive`, den beiden Aufrufstellen und der `window.__arena`-
Schnittstelle liest **keine** andere Stelle diese Felder — insbesondere nicht `feldspielWert()`
(die Wertformel) oder irgendeine Bewegungs-/Wurf-/Kontest-Funktion. Der ganze Block fügt nur
neue, ungelesene Felder hinzu — exakt das Muster von Task #31s "Drei Momente" (PR #1108).

---

## 3. Warum die Mechanik-Bindung und die UI nicht Teil dieser Runde sind

**Mechanik.** Zwei der vier Basketball-P4-Schalter hängen laut Opus-Review selbst an Mechanik,
die noch nicht existiert: Screen-Coverage ("s. P3") braucht Pick-and-Roll-Rollen (P3, nicht
gebaut), Zone 3-3 und "Mann eng" mit mehr Fouls brauchen das Foul-System (P1, nicht gebaut). Die
verbleibenden zwei Schalter (Angriff-Tempo, Bretter) ließen sich isoliert an bestehende Kanäle
binden — aber jede Bindung, die tatsächlich Positionen oder die Wurfauswahl verschiebt, ist laut
CLAUDE.md eine echte Mechanikänderung mit eigener rho-/Pp-Pflichtprüfung, kein Fundament-Schritt.
Das Fable-Dokument selbst stuft 2.2 ausdrücklich als "Architektur, keine Mechanik für sich" ein —
"die Mechanik je Schalter bleibt der jeweilige Review-Vorschlag", also eine eigene, größere Runde
mit eigener Messung. Diese Runde liefert die Architektur; die Mechanik-Bindung ist der nächste,
klar benannte Schritt (Abschnitt 4).

**UI.** Eine Durchsicht von `app/foundation/legacy-lineup-lab/` (die bestehende Lineup-/Matchday-
Fläche) zeigt einen mehrteiligen Fluss (`FoundationLineupPanel`, `LineupAiPreviewPanel`,
`FormBoardPanel`, eigener Client/Page) — die Integration einer neuen Vorspiel-Entscheidung dort
ist ein eigenes Vorhaben (Datenhaltung je Spieltag, Persistenz bis zum Anpfiff, Darstellung im
Legacy Resolve Lab danach), unabhängig von der Engine-Infrastruktur oben. Dazu kommt der
Replay-Befund aus 1.1: eine manager-seitige UI, deren Wirkung der Manager mangels Replay ohnehin
nicht sieht, wäre genau das "Formular", vor dem das Konzeptpapier warnt. Beides zusammen macht
die UI-Integration zu einem eigenen, später klar abzugrenzenden Schritt statt eines Anhängsels an
diese Runde.

---

## 4. Nächste Schritte (nicht Teil dieser Runde)

1. **Mechanik-Bindung Angriff/Bretter** (die zwei Schalter ohne P1/P3-Abhängigkeit): eigene
   Runde mit rho-Messung (n=24 und n=48 bei knapper Marge) und Pp-Messung (zwei Saatströme) —
   Basketball ist "knapp" (0,795), jede Schwellenverschiebung braucht die volle Pflichtprüfung.
2. **Screen-Coverage/Zone 3-3** warten auf P3 (Pick-and-Roll) bzw. P1 (Foul-System) als
   Vorbedingung — vorher hat die KI-Vorgabe für diese zwei Schalter kein mechanisches Gegenüber.
3. **UI-Integration** in den Matchday-/Lineup-Fluss — eigenes Vorhaben, s. Abschnitt 3.
4. **Replay aus der Saat** (2.1, voller Umfang) bleibt offen — ohne sie ist jede manager-seitige
   Wahl unsichtbar; das Fundament hier braucht sie nicht (die KI-Vorgabe funktioniert ohne),
   aber eine Manager-UI-Runde sollte sie vorher einplanen oder bewusst in Kauf nehmen.
5. **Hockey T4 / Football P2**, sobald ihre eigenen Optionssätze feststehen — jeweils nur ein
   `taktik`-Block in `FELDSPIEL_ART.hockey`/`.football`, keine Engine-Änderung nötig.

---

## 5. Messung

Kader-Familie live-save, `scripts/miss-alle-disziplinen.mjs 24 basketball`:

| | vorher (HEAD) | nachher (mit Fundament) |
|---|---:|---:|
| rho je Spiel (Median) | 0,795 | **0,795** |
| Spannweite | 0,085 | 0,085 |
| rho Saison (Median) | 0,881 | 0,881 |
| Spannweite | 0,140 | 0,140 |

Bit-identisch auf drei Nachkommastellen, wie von Abschnitt 2.3 erwartet (strukturell
nachgewiesen: kein Lesezugriff auf die neuen Felder). Gemessen durch Austausch der Engine-Datei
gegen `git show HEAD:...` (kein `git stash`, s. CLAUDE.md-Hinweis zu parallelen Agenten) und
zurück.

Pp-Einfluss (`scripts/messe-arena-einfluss.mjs basketball 24`, Live-Motor, 1801 s):
**33,7 Pp**, Seitenfehler keine. **Kein neuer Befund und keine Verschlechterung** —
`docs/design/gesamtstand-audit-13-10.md` Zeile 100 dokumentiert dieselbe Verletzung seit dem
26.09. mit 33,4 Pp ("VERLETZT", damals erstmals gemessen, bis heute nicht behoben). 33,7 gegen
33,4 liegt im erwarteten Lauf-/Zeitpunkt-Rauschen einer seit Wochen bekannten, unveränderten
Verletzung — kein zusätzlicher Pp-Schaden durch die Taktik-Karte, genau wie der strukturelle
Befund aus 2.3 es vorhersagt (`einflussVon()` ruft `M.bau()`/`M.lauf()`/`M.wert()` direkt;
`berechneTaktikAuto()` läuft innerhalb von `M.bau()` mit, aber `M.wert()` (`feldspielWert()`)
liest keines der neuen Felder). Attributverteilung (spirit 20,5 % · speed 16,5 % gg. Matrix
10 % · intelligence 14,7 % · torment 13 % gg. 6 % · ... · health/determination/will 0 %) passt
zum bekannten Basketball-Befund (speed/torment über Matrixgewicht, awareness darunter), keine
neue, durch die Taktik-Karte eingeführte Verzerrung. Diese Runde behebt die bestehende
Verletzung **nicht** — das bleibt eine eigene, größere Rezeptrunde.

---

## 6. Offene Fragen an Chris

1. Soll die nächste Runde die **Mechanik-Bindung** für Angriff/Bretter angehen (die zwei
   Schalter ohne P1/P3-Abhängigkeit), oder zuerst **P1 (Foul-System)**/**P3 (Pick-and-Roll)**,
   damit alle vier Schalter zusammen ein mechanisches Gegenüber haben?
2. Soll die **UI-Integration** vorgezogen werden, obwohl der Manager die Wirkung seiner Wahl
   mangels vollem Replay (1.1) noch nicht sieht — oder wartet sie, bis Replay oder zumindest
   eine klarere Zwischenlösung steht?
3. Ist die Platzhalter-Logik für Screen-Coverage (aus der eigenen Verteidigung statt aus einer
   Pick-and-Roll-Gegenmittel-Analyse) als Übergang akzeptabel, oder soll dieser Schalter bis P3
   ganz ohne KI-Logik (immer `standard:"drop"`) bleiben?
