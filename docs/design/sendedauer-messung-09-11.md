# Sendedauer- und Anzeige-Treue-Sonde (Auftrag A1, 09.11.)

Ergebnis von `scripts/miss-sendedauer.mjs` (Auftrag A1 aus
`docs/design/alle-diszis-top-niveau-fahrplan-09-11.md`, Baustein B3) auf dem heutigen
`main`-Stand. Kein Code in `battle-mode.engine.js` wurde angefasst — reines Mess-Skript,
wie beauftragt. Basisbranch `main`, Worktree `.claude/worktrees/sendedauer-sonde`, Branch
`claude/sendedauer-messsonde-0911`.

## 1. Sendedauer gegen das Zielband (E2)

Gemessen mit `window.__arena.sondenLauf()` bis `vorbei()` (Tempo 1x, ohne Anpfiff-Countdown
und ohne Endstand-Nachlauf, s. Kopfkommentar des Skripts). Alle 20 Disziplinen plus drei
Pods (Staffel, Takeshi, Battlefield) gemessen.

| Disziplin (Format) | Ist | Zielband (E2) | Status |
|---|---:|---|---|
| **Spurt klassisch** | **3:36** | 3:00, Band 2:33–3:27 | **AUSSERHALB** (+20 % Drift, wie im Fahrplan dokumentiert) |
| **Climbing** | **0:48** | 1:30, Band 1:17–1:43 | **AUSSERHALB** (unverändert kürzestes Spiel) |
| **Battlefield (Pod)** | **7:12** | 3:30, Band 2:59–4:01 | **AUSSERHALB** (unverändert doppelt so lang wie bestellt) |
| Spurt HYROX | nicht verfügbar | 3:30 | existiert auf `main` noch nicht, s. Abschnitt 3 |
| Spurt Hatz | nicht verfügbar | 30 s/Welle | existiert auf `main` noch nicht, s. Abschnitt 3 |
| TDM | 3:00 | Ist=Ziel | ok |
| Mini-DM (2-Seiten-Chassis) | 1:08 | Ist=Ziel | ok |
| Battlefield (Duell) | 3:28 | Ist=Ziel | ok |
| Basketball | 6:08 | Chris-Vorgabe | ok (Ausnahme von der Leitplanke) |
| Football | 4:44 | Ist=Ziel | ok |
| Hockey | 8:06 | Chris-Vorgabe | ok (Ausnahme von der Leitplanke) |
| Gewichtheben | 7:22 | Chris-Vorgabe | ok (Ausnahme von der Leitplanke) |
| Showcase | 1:00 | Ist=Ziel | ok |
| Eiskunstlauf | 1:02 | Ist=Ziel | ok |
| Breaking | 1:46 | Ist=Ziel | ok |
| Wettessen | 1:02 | Ist=Ziel | ok |
| Speed-Schach | 1:02 | Ist=Ziel | ok |
| I-Spy | 1:04 | Ist=Ziel | ok |
| Tennis | 1:02 | Ist=Ziel | ok |
| Fechten | 1:38 | Ist=Ziel | ok |
| Time-Trial | 1:38 | Ist=Ziel | ok |
| Staffel (Duell) | 3:20 | Ist=Ziel | ok |
| Takeshi's Castle (Duell) | 1:02 | Ist=Ziel | ok |
| Staffel (Pod) | 3:00 | kein eigener E2-Wert | ok |
| Takeshi's Castle (Pod) | 1:00 | kein eigener E2-Wert | ok |
| Mini-DM-FFA | ~0:38 (Echtzeit-Heuristik) | Ist=Ziel | **mit Vorbehalt**, s. Abschnitt 4 |

Alle Werte stimmen mit den im Fahrplan (Abschnitt 1.3) genannten Zahlen praktisch exakt
überein — das Skript reproduziert die PM-Messung unabhängig und bestätigt sie.

## 2. Anzeige-Treue „gezeigt = gebucht" — HEUTE SCHON abweichend, nicht erst nach einer
   ZEIT_DEHNUNG-Änderung

**Das ist der wichtigste Befund dieses Auftrags.** Über 24 Saaten (`1337 + i*7919`, dieselbe
Konvention wie `disziplinProbe()`) verglichen: die am Bildschirm sichtbare Endrangfolge
(`setDisc()` + `sondenLauf()`, also der Pfad mit `zeitFaktor()`-skaliertem `dt`, exakt wie
der Zuschauer ihn sieht) gegen die tatsächlich gebuchte Wertung (`bahnLauf()` /
`spieleBahnPod()` / `spieleBattlefieldPod()`, der Pfad mit festem `1/60`-`dt`, derselbe wie
die Produktion und `scripts/miss-alle-disziplinen.mjs`).

| Ziel | Saaten mit Abweichung | Anteil |
|---|---:|---:|
| **Spurt klassisch** | 24 / 24 | 100 % |
| **Takeshi's Castle (Duell)** | 24 / 24 | 100 % |
| **Climbing** | 22 / 24 | 92 % |
| **Staffel (Duell)** | 23 / 24 | 96 % |
| **Staffel (Pod)** | 10 / 24 | 42 % |
| Time-Trial | 1 / 24 | 4 % |
| Takeshi's Castle (Pod) | nicht abschließend gemessen (Laufzeit-/Absturz-bedingt, s. unten) | – |
| Battlefield (Pod) | nicht abschließend über 24 Saaten gemessen; Einzelstichprobe (Saat 1337) stimmte überein | – |

**Befund: „Gezeigt = gebucht" ist auf dem heutigen `main`-Stand für praktisch jede
Bahn-Duell-Disziplin schon VERLETZT — unabhängig von jeder künftigen `ZEIT_DEHNUNG`-
Änderung.** Nicht nur bei den drei im Fahrplan genannten Beispielen (Spurt klassisch,
Climbing, Battlefield-Pod), sondern auch bei Staffel und Takeshi's Castle im Duell, die der
Fahrplan nicht nennt — und sogar bei der Staffel im VIER-TEAM-POD auf Teamebene (10 von 24
Saaten mit abweichendem Platz). **Time-Trial ist die auffällige Ausnahme** mit nur 1 von 24
Saaten — vermutlich, weil der gestaffelte Start (`BA().startAbstand`) weniger laufende
Zufallsentscheidungen während der Fahrt braucht als die anderen vier Bahnen.

**Wichtig für die Einordnung (E2-Regel aus dem Fahrplan):** Die Abweichungen betreffen fast
ausschließlich knapp beieinanderliegende Läufer im Mittelfeld/Hinterfeld (vertauschte
Nachbarplätze), nicht grobe Verschiebungen der Sieger-Plätze. Beispiel Saat 1337, Spurt:

```
gebucht:  Tidesprinter, Ralazar the Balanced, Seraph-11, Xelara,   Jorund,    Lulu, ...
gezeigt:  Tidesprinter, Ralazar the Balanced, Seraph-11, Jorund,   Xelara,    Lulu, ...
```

Die ersten drei Plätze stimmen überein, Platz 4/5 sind vertauscht. Das ist exakt das
Muster, das CLAUDE.md für die rho-Schranke ohnehin beschreibt (Paare mit großem
Eignungsabstand werden verlässlich geordnet, knappe Paare nicht) — nur hier auf der
ANZEIGE-Ebene statt auf der Wertungs-Ebene. Dennoch: laut Fahrplan-Regel E2 ist das ein
eigener, an Chris zu meldender Befund („gezeigt ≠ gebucht", unabhängig von einer
Faktoränderung), weil ein Zuschauer heute schon eine andere Reihenfolge sehen kann als die,
die am Ende in die Saison einfließt — nur eben größtenteils in Platzierungen, die ohnehin
knapp beieinanderliegen.

**Nicht abschließend geprüft, aus Zeitgründen:** Die 24-Saaten-Prüfung für Takeshi's
Castle (Pod) und Battlefield (Pod) lief beim Abschlusslauf dieses Auftrags nicht vollständig
durch — ein Chromium-Absturz mitten im Lauf (bekannte Falle, s. Kopfkommentar des Skripts)
plus die insgesamt lange Laufzeit des vollständigen Durchlaufs sprengten das Zeitbudget
dieser Session. Eine Einzelstichprobe (Saat 1337) für Battlefield-Pod stimmte überein
(`[2,4,1,3]` gebucht wie gezeigt) — konsistent mit dem Code-Befund in Abschnitt 3, aber
keine 24er-Abnahme. **Wer als Nächstes an `ZEIT_DEHNUNG` arbeitet, führt diese beiden
Ziele gezielt zu Ende:**

```sh
node scripts/miss-sendedauer.mjs takeshis-castle battlefield --nur-anzeige-treue
```

## 3. Nachgeprüft statt der Fahrplan-Liste blind vertraut

Der Fahrplan nennt als Beispiele nur Spurt klassisch, Climbing und Battlefield-Pod. Auftrag
verlangte, im Code selbst nachzuprüfen, ob es weitere Disziplinen mit demselben Muster
gibt. Ergebnis:

- **Der Mechanismus (`ZEIT_DEHNUNG[disc] != 1` UND tickgetriebene Physik) betrifft alle
  fünf Bahn-Duell-Disziplinen** (Spurt 11,14, Time-Trial 4,38, Climbing 4,38, Staffel 14,65,
  Takeshi's Castle 2,17) und beide Bahn-Pod-Formate — nicht nur die drei genannten
  Beispiele. Empirisch bestätigt (Abschnitt 2): Staffel und Takeshi's Castle im Duell sind
  genauso betroffen wie Spurt und Climbing.
- **Battlefield-Pod ist im Code anders gebaut, als der Fahrplan-Satz „durchgehende Physik"
  nahelegt.** `runBattlefieldPodFixtures()` (`lib/battle/arena-headless-runner.ts:1379-1386`)
  dokumentiert ausdrücklich: „Seit Chris' Entscheidung für das Mini-DM-Muster wird ein
  Battlefield-Pod als GEFECHT JE ORT entschieden (`bfffaGefecht()`): deterministisch aus der
  Eignung, die Arena spielt es danach ab. [...] Gezeigt = gebucht." Das ist strukturell
  näher am Hatz/HYROX-Muster (Ergebnis steht vor dem ersten Tick fest) als am Spurt-/
  Climbing-Muster. Die Einzelstichprobe in Abschnitt 2 bestätigt das für eine Saat; die
  volle 24er-Prüfung steht noch aus (s. dort) und sollte das endgültig klären, bevor jemand
  den Fahrplan-Satz als Tatsache zitiert.
- **Mini-DM-FFA ist aus einem anderen Grund immun**, nicht weil sein Ergebnis vorab
  feststeht wie bei Hatz/HYROX im eigentlichen Sinn des Fahrplan-Arguments, sondern weil die
  Offenbarung auf `#mdffaCv` über eine `setTimeout`-Kette (`renderMiniDmFfa()`) läuft, nicht
  über `stepSim()`-Ticks. `sondenLauf()`/`zeitFaktor()` haben darauf keinen Zugriff — eine
  künftige `ZEIT_DEHNUNG`-Änderung kann die Mini-DM-FFA-Anzeige gar nicht berühren.
- **TDM, Mini-DM (2-Seiten-Chassis), Battlefield-Duell, Fechten, Gewichtheben und Hockey
  haben ebenfalls `ZEIT_DEHNUNG[disc] != 1`** und sind damit demselben Mechanismus
  theoretisch ausgesetzt. Für sie gibt es aber keine so saubere „was zeigt der Bildschirm am
  Ende"-Sonde wie `bahnRangliste()`/`bahnPodAnzeigeStand()` für die Bahn — eine Kampf-/
  Bühnen-Disziplin hat keine einfache Endrangfolge, sondern einen Punktestand/HP-Verlauf.
  **Das ist eine offene Lücke dieses Skripts, kein geprüftes „ok".** Wer `ZEIT_DEHNUNG` für
  eine dieser sechs Disziplinen ändert, sollte vorher eine eigene Anzeige-Treue-Prüfung dafür
  bauen, nicht sich auf dieses Skript verlassen.
- **Hatz und HYROX existieren auf `main` nicht** (nur auf dem Spurt-Stapel/PR #1364–#1371,
  noch nicht gemergt — nachgeprüft: `window.__arena.bahnFlags` fehlt). Das Skript erkennt
  das automatisch (Feature-Detection) und meldet „nicht verfügbar" statt einen falschen Wert
  vorzutäuschen. Nach dem Merge greift die Messung ohne Codeänderung.

## 4. Grenzen dieser Messung

- **Mini-DM-FFA-Dauer ist eine Heuristik**, keine exakte Messung: Die Offenbarung läuft über
  reale `setTimeout`s, nicht über Ticks — das Skript pollt den Panel-Inhalt und wertet
  Stillstand (≥1,2 s unverändert, nach einer Mindestlaufzeit von 1,5 s) als „fertig". Das
  kann eine Pause zwischen zwei Runden fälschlich als Ende lesen oder umgekehrt knapp zu früh
  abbrechen. Für eine belastbare Mini-DM-FFA-Dauer bleibt `scripts/screenshot-mdffa-buehne.mjs`
  bzw. eine eigene, genauere Sonde die bessere Quelle.
- **Battlefield-Pod/Takeshi-Pod-Anzeige-Treue nicht über alle 24 Saaten abgeschlossen**,
  s. Abschnitt 2.
- Gemessen mit dem hartkodierten Standalone-Kader (`SQUAD`/`OPP`) für die Duell-Prüfungen
  bzw. der Kader-Familie aus `data/generated/kaderfamilie-live-save.json` für die Pods —
  dieselbe Quelle wie `scripts/pruefe-wertung-fingerabdruck.mjs`.
- Chromium stürzt beim Laden/während langer Läufe gelegentlich ab (bekannte, im Fahrplan
  dokumentierte Falle). Das Skript fängt das ab und startet mit frischem Browser neu (bis zu
  drei Versuche je Ziel) — im abschließenden Volllauf dieser Session reichte das Zeitbudget
  trotzdem nicht für alle Ziele (s. Abschnitt 2).

## 5. Wiederverwendung

`scripts/miss-sendedauer.mjs` ist für genau diesen Zweck gebaut: die Pflichtprüfung vor
jeder künftigen `ZEIT_DEHNUNG`-Änderung (Auftrag A3 und folgende, Fahrplan E2). Aufruf siehe
Kopfkommentar des Skripts. Kurzfassung:

```sh
node scripts/miss-sendedauer.mjs                         # alles
node scripts/miss-sendedauer.mjs spurt climbing          # gezielt
node scripts/miss-sendedauer.mjs --ohne-anzeige-treue    # nur Dauer/Zielband, schneller
node scripts/miss-sendedauer.mjs --nur-anzeige-treue     # nur die 24-Saaten-Pflichtprüfung
```

Vorher/nachher-Vergleich: lief die Anzeige-Treue für ein Ziel vorher „abweichend" und bleibt
sie es nachher, ist das kein neuer Befund. Wird aus „übereinstimmend" ein „abweichend", ist
die Faktoränderung laut Fahrplan-Regel NICHT erlaubt, ohne sie in kleineren Schritten zu
suchen oder den Fall an den PM zurückzugeben.

## 6. Nachtrag 10.11.: die sechs "Rest"-Disziplinen zu Ende gemessen (Fechten/Gewichtheben voll)

Fortsetzung von `scripts/miss-anzeige-treue-rest.mjs` (Commit `5fa5d1105`, Kopfkommentar dort
für Methode/Architektur-Befund): die Vorgänger-Session hatte für Fechten nur n=4 Saaten als
Rauchtest geschafft, der volle 24-Saaten-Lauf für alle sechs Ziele war beim Abgeben noch offen.
Dieser Auftrag hat **nur die beiden praktisch relevanten Ziele** nachgeholt — Fechten und
Gewichtheben sind die einzigen der sechs, die heute tatsächlich über `MOTOREN[d].lauf()`
produktionsgebucht werden (`lib/battle/arena-resolved-disciplines.ts`,
`ARENA_RESOLVED_DISCIPLINE_IDS`, nachgeprüft: `gewichtheben` und `fechten` stehen drin; `tdm`/
`mini-dm`/`battlefield` nie, weil ihr Saisonergebnis aus der PPS-Duell-Brücke bzw. dem
vorab entschiedenen Pod-Gefecht kommt; `hockey` ist "angeschlossen", aber wegen der 25-Pp-
Schranke ausdrücklich NICHT in der Menge — Kommentar dort: "HOCKEY BEWUSST NICHT HIER").

```
node scripts/miss-anzeige-treue-rest.mjs fechten gewichtheben --saaten=24
```

| Ziel | Saaten mit Abweichung |
|---|---:|
| Fechten | 0 / 24 |
| Gewichtheben | 0 / 24 |

**Entwarnung für beide.** "Gezeigt = gebucht" stimmt über alle 24 Saaten exakt überein, sowohl
beim Sieger als auch bei der nach `wert()` sortierten Rangliste — der Architektur-Befund im
Skript-Kopfkommentar (nur zwei dt-skalierte `rr()`-Würfe im ganzen Motor, beide in `stepSpurt()`
und bereits durch PR #1372 behoben; keine weitere Stelle in `stepFeldspiel()`/`stepBuehne()`/dem
Kampf-Teil von `stepSim()`) hält damit auch für die Buehne, nicht nur in der Theorie.

Vorher/Nachher-Beleg, dass die additive Sonde (reine Lesefunktion, kein `rr()`-Aufruf) die
Wertung nicht berührt — gemessen an Commit `a66cb12ef` (vor der Sonde) gegen den aktuellen Stand
(`5fa5d1105`, mit Sonde), beide Mal `node scripts/miss-alle-disziplinen.mjs 24 fechten
gewichtheben`:

| Disziplin | rho je Spiel vorher | rho je Spiel nachher |
|---|---:|---:|
| Gewichtheben | 0,865 | 0,865 |
| Fechten | 0,860 | 0,860 |

Bit-identisch, wie erwartet. Dazu `node scripts/pruefe-wertung-fingerabdruck.mjs` am aktuellen
Stand bestätigt: GESAMT `22f04e06e285` (69 Einträge) — unverändert gegenüber dem bei der Sonde
selbst schon dokumentierten Wert.

**Weiterhin offen, falls jemand daran weiterarbeitet:** TDM, Mini-DM, Battlefield (Duell) und
Hockey sind mit `miss-anzeige-treue-rest.mjs` noch nicht über die vollen 24 Saaten gemessen —
für die ersten drei fehlt dafür ohnehin ein echter "gebucht"-Begriff aus der Produktion (die
Sonde baut sich für sie nur einen Ad-hoc-Vergleich über `diszSonde()`, s. Skript-Kopfkommentar
Abschnitt "WICHTIG"), für Hockey läuft die Saison bis zur Pp-Korrektur sowieso noch über die
PPS-Brücke. Keiner der vier war Teil dieses Auftrags.
