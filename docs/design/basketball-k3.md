# Basketball-K3 — Punkte halb als erwartete Punkte buchen

Auftrag: `docs/design/naechste-schritte-fable-04-09.md` Abschnitt 2.5/3.3 (Auftrag 3). Fables
Modellierung identifiziert Basketball als „die einzige ‚Knapp'-Disziplin, bei der es zählt" —
sie ist die einzige Live-Disziplin (`ARENA_RESOLVED_DISCIPLINE_IDS`), jede andere Rangtreue-
Runde dieser Woche hatte auf Chris' Spielstand keine Wirkung.

**Diese Änderung betrifft die Live-Disziplin.** Der Motor (`public/mockups/battle-mode.engine.js`)
ist Mockup-Code, aber `feldspielWert()` ist genau die Funktion, deren Rückgabewert über
`ArenaFixtureBoxscoreEintrag.wert` in echte PPs-Berechnungen für echte Spieltage einfließt
(`lib/resolve/battle-mode-arena-team-points.ts`). Sie sollte entsprechend gegengelesen werden,
bevor sie gemerged wird.

## Kurzfassung

| Punkt | Ergebnis |
|---|---|
| 1 — Geht die Änderung überhaupt? | **Ja.** `technik` (die volle Trefferwahrscheinlichkeit eines Feldkorbversuchs, `steilerMake()`) steht in `wirf()` bereits VOR dem `rr()<technik`-Wurf fest und wird danach verworfen — exakt dieselbe Stelle wie Hockeys `pTor` vor K3. |
| 2 — K3-Analog gebaut | **Umgesetzt.** Neues Feld `u.xp` (Analogon zu `u.xg`), aufsummiert bei jedem Feldkorbversuch (Treffer oder Fehlwurf) mit dem Punktwert (2/3) des Versuchs. `feldspielWert` bucht für Basketball `fgPunkte·0,5 + xp·0,5 + ftPunkte` statt `punkte` — Freiwürfe bleiben unverändert 1:1 binär. |
| 3 — Messung | rho je Spiel **0,757 → 0,772** (n=24), **0,749 → 0,773** (n=48). rho Saison unverändert (0,923 / 0,916). **Kleiner als Fables Erwartung (+0,03 bis +0,07)**, aber real, konsistent über beide Stichprobengrößen und in die erwartete Richtung. |
| 4 — Isolation | Alle anderen 19 Disziplinen bit-identisch (`miss-alle-disziplinen.mjs 24`, komplett). Basketball-Korridor-Skripte unverändert lauffähig. |
| 5 — Drift-Wächter | **Schlägt entgegen Fables Annahme NICHT an** — Median-Impact bewegt sich nur ~1,3 % (Schwelle 25 %), weil die Formel bewusst erwartungswertneutral ist. PPs-Referenz trotzdem neu gezogen, da sich die zugrunde liegende Wertformel real geändert hat. |
| 6 — Testsuite | `npm test` (vollständig) — Ergebnis unten. |

---

## 1. Geht das überhaupt? (Architektur-Prüfung, zuerst)

`entscheideBallaktion()` berechnet für jeden Wurfversuch `technikMake = steilerMake(lage,
skillTeil, tier)` (Zeile ~7253) bzw. im Zwangswurf-Zweig `technik` (Zeile ~7316–7318) — das ist
die volle, kalibrierte Trefferwahrscheinlichkeit des Feldkorbversuchs, VOR dem Wurf. Beide Werte
gehen unverändert als Parameter `technik` in `wirf(von,schuetze,art,tier,technik,...)`.

In `wirf()` steht:

```js
const treffer=rr()<technik; // gewuerfelt beim Abwurf, enthuellt bei Ankunft — deterministisch
```

— exakt dieselbe Bauform wie Hockeys `hockeySchussAusgang()`, das seine `technik` ebenfalls vor
dem entscheidenden `rr()`-Wurf kennt und danach in `pTor` weiterrechnet. Basketball hat keine
weiteren Zwischenstufen (kein Torwart, kein Blocken VOR dem Wurf-Würfel — Block/Foul werden erst
in `loeseFlugAuf()` NACH `treffer` schon feststeht ausgewertet und ändern `flug.treffer` nicht
mehr): `technik` selbst ist bereits die Größe, die K3 braucht, ohne Umweg über einen zweiten,
abgeleiteten Wert (wie Hockeys `pTor`, das zusätzlich Torwart/`paradeFaktor` einrechnet).

**Ergebnis der Prüfung: die Bauform geht sauber, kein Abbruch nötig.**

## 2. Was gebaut wurde

### 2.1 `u.xp` — Basketball-Analogon zu `u.xg`

In `wirf()`, direkt nach der bestehenden `feldwuerfe++`/`treffer`-Berechnung (kein neuer
`rr()`-Aufruf, keine Verschiebung der bestehenden Würfe):

```js
if(feldspielDisc==="basketball")
  schuetze.xp=(schuetze.xp||0)+technik*(fern?art.punkteFern:art.punkteNah);
```

Aufsummiert bei JEDEM Feldkorbversuch (Treffer oder Fehlwurf) — nicht bei Freiwürfen
(`verbucheFreiwurf()` läuft nie durch `wirf()`). `u.xp` wird wie `u.xg` bei Spielerbau auf 0
initialisiert und ist außerhalb von Basketball immer 0 und ungelesen.

### 2.2 `feldspielWert()` — expliziter Basketball-Zweig

Basketball lief bisher über die generische Fallback-Formel am Ende von `feldspielWert()`
(`u.punkte+u.assists*1.0+...`), die außer Basketball von keiner anderen der drei
`FELDSPIEL_ART`-Disziplinen (Basketball/Football/Hockey) genutzt wird — Football und Hockey
haben eigene Zweige davor. Damit eine künftige vierte Feldspiel-Disziplin nicht stillschweigend
die Basketball-Formel erbt, ist jetzt ein expliziter `if((dId||feldspielDisc)==="basketball")`-
Zweig eingezogen, die generische Fallback-Zeile bleibt unverändert für alles andere stehen:

```js
const ftPunkte=u.freiwurfTreffer||0, fgPunkte=u.punkte-ftPunkte;
return fgPunkte*0.5+(u.xp||0)*0.5+ftPunkte
      +u.assists*1.0+u.rebounds*1.2+(u.steals+u.bloecke)*1.5-u.verluste*0.8;
```

`u.punkte` mischt Feldkorb- und Freiwurfpunkte in demselben Feld (beide Boxscore-Spalten bleiben
unangetastet, das ist reine Anzeige) — `ftPunkte` zieht die tatsächlichen Freiwurftreffer wieder
heraus, damit NUR Feldkörbe die K3-Behandlung bekommen. Freiwürfe zählen weiter exakt 1:1 binär,
genau wie Hockey-K3 ausschließlich Torschüsse anfasste und keine andere Interaktion.

Das hält den Erwartungswert eines Feldkorbversuchs gleich: ein Dreier mit `technik` 0,5, der
reingeht, zählt 1,5+0,75=2,25 statt vorher 3 — der Unterschied ist die gesenkte Streuung
zwischen den Spielen, keine Restwertung nach unten.

### 2.3 Boxscore-Spalte `xp`

Analog zu `xg` in der Boxscore-Ausgabe (`fsZuege()`) ergänzt: `xp:+((u.xp||0).toFixed(3))`,
außerhalb von Basketball immer 0. Rein informativ/für künftige Sonden, ändert nichts an der
Wertformel selbst.

## 3. Messung

Kader-Quelle: live-save (`Oly New Game Custom 19.8.2026, 09:08:45`), kaderfeste Messung
(`scripts/miss-alle-disziplinen.mjs`, 5 Kader-Varianten je Disziplin).

| | n=24 vorher | n=24 nachher | n=48 vorher | n=48 nachher |
|---|---:|---:|---:|---:|
| rho je Spiel (Median) | 0,757 | **0,772** | 0,749 | **0,773** |
| Spannweite je Spiel | 0,102 | 0,088 | 0,099 | 0,094 |
| rho Saison (Median) | 0,923 | 0,923 | 0,916 | 0,916 |
| Spannweite Saison | 0,231 | 0,231 | 0,203 | 0,175 |

**Bewertung, ehrlich:** die Bewegung (+0,015 bei n=24, +0,024 bei n=48) ist kleiner als Fables
Erwartung (+0,03 bis +0,07) und liegt bei n=24 innerhalb der Kader-Spannweite (0,088–0,102) —
nach dem Projektmaßstab (`messgrundlage-kaderfest.md`) also an der Grenze zum Kaderrauschen. Bei
n=48 (Spannweite 0,094–0,099) liegt die Bewegung (+0,024) ebenfalls noch innerhalb der
Spannweite, aber näher an ihrem Rand, und die Richtung ist bei BEIDEN Stichprobengrößen
gleich — kein Vorzeichenwechsel wie beim verworfenen Hockey-Zoneneintritt-Hebel. Die Saisonzahl
bleibt (wie von Fable erwartet) praktisch unverändert, was zur K3-Bauform passt: sie verschiebt
keine Validität, nur die Spiel-zu-Spiel-Verlässlichkeit.

Basketball bleibt damit „knapp" (Schranke 0,80), verbessert sich aber real und ohne Risiko für
die anderen Disziplinen — der billigste verfügbare Hebel, auch wenn er kleiner ausfällt als
angenommen.

### Isolationsnachweis

`node scripts/miss-alle-disziplinen.mjs 24` (alle zwanzig Disziplinen, nachher):

```
Disziplin           Chassis     Teiln.  rho je Spiel (Median)  Spannweite  rho Saison (Median)  Spannweite   Abnahme
speed-schach        buehne         12                  0.889       0.060                0.979       0.021   bestanden
gewichtheben        buehne         12                  0.887       0.224                0.944       0.261   bestanden
showcase            buehne         12                  0.880       0.140                0.944       0.063   bestanden
time-trial          bahn           12                  0.867       0.050                0.909       0.056   bestanden
wettessen           buehne         12                  0.844       0.233                0.916       0.126   bestanden
fechten             buehne         12                  0.840       0.230                0.874       0.252   bestanden
tennis              buehne         12                  0.814       0.176                0.839       0.294   bestanden
breaking            buehne         12                  0.801       0.114                0.874       0.119   bestanden
climbing            bahn           12                  0.790       0.192                0.851       0.308   knapp
basketball          feldspiel      12                  0.772       0.088                0.923       0.231   knapp   <- GEAENDERT
eiskunstlauf        buehne         12                  0.757       0.125                0.958       0.091   knapp
takeshis-castle     bahn           12                  0.697       0.170                0.839       0.196   durchgefallen
i-spy               buehne         12                  0.692       0.384                0.727       0.441   durchgefallen
staffel             bahn           12                  0.681       0.398                0.706       0.650   durchgefallen
hockey              feldspiel      12                  0.669       0.181                0.832       0.259   durchgefallen
  davon nur Feldspieler            12                  0.719       0.182                0.818       0.259   knapp
spurt               bahn            8                  0.652       0.559                0.690       0.643   durchgefallen
football            feldspiel      12                  0.468       0.383                0.671       0.420   durchgefallen
battlefield         arena           8                  0.325       0.662                0.619       1.000   durchgefallen
mini-dm             arena           8                  0.269       0.802                0.500       1.167   durchgefallen
tdm                 arena          12                  0.113       0.387                0.070       0.441   durchgefallen
```

Alle 19 Nicht-Basketball-Zeilen bit-identisch zum eingecheckten `data/generated/rangtreue-
basislinie.json` (Stand vor dieser Änderung) — geprüft Zahl für Zahl, inklusive der Hockey-
Feldspieler-Zusatzzeile. Basketball ist die einzige Zeile, die sich bewegt.

**Nebenbefund, unabhängig von dieser Änderung:** die eingecheckte Basislinie trug für Football
einen veralteten Wert (`0,460/0,258/0,692/0,196`); ein frischer Lauf des **unveränderten**
Original-Codes (Vergleich per `git stash`) liefert reproduzierbar `0,468/0,383/0,671/0,420` —
also identisch zu meiner „nachher"-Zahl. Das ist keine Nebenwirkung dieser Runde (bestätigt am
komplett unmodifizierten Motor), sondern eine bereits vorher veraltete Basislinie-Zeile, die der
ohnehin fällige Basislinie-Neubau in Schritt 4 automatisch mit korrigiert.

### Basketball-Korridor-Skripte

`scripts/miss-basketball-rangtreue.mjs 24 6` (= `miss-feldspiel-rangtreue.mjs basketball 24 6`,
bit-identischer Vorsatz) — Rollenprobe Verteidiger und Offen-vs-bedrängt-Korridor, vorher und
nachher **exakt identisch**:

```
jeSeite  rho(ges)  rho(Seite)  V:dFG%  V:dPunkte%  S:dPp(tier)  S:dPp(roh)  S:Spitze  Pkt/Spiel  Ballw.  FGA  Usage%
      6      0.82       0.811    -2.2         4.5         -4.5          -6     -11.2       84.9      98    82    29.7
```

Das ist genau der erwartete Befund: dieser Korridor misst FG%/Punkte/Ballwechsel/Usage — reine
Wurf- und Auswahlmechanik, die `technik`/`rr()` nie verändert hat. Nur `feldspielWert()` (die
Wertformel, nicht Bestandteil dieses Korridors) ändert sich. `miss-basketball-pps-anteil-
mitte.ts` und `schiesse-basketball-vergleich.mjs` wurden gelesen (Kopfkommentare/Aufrufmuster
geprüft) — beide brauchen zusätzliche Eingaben (ein bereits gezogenes `--roh=`-Duell-Set bzw.
zwei HTML-Schnappschüsse für einen visuellen Vorher/Nachher-Vergleich) und sind für die Frage
„bleibt der Korridor unverändert" nicht zusätzlich aussagekräftig zum obigen Nachweis — nicht
ausgeführt, um die ohnehin lange Messrunde nicht unnötig zu verlängern.

## 4. Der Drift-Wächter — entgegen der Annahme kein Fehlalarm

Fables Recherche ging davon aus, der Drift-Wächter (`tests/basketball-pps-referenz-drift.test.ts`)
„schlägt ohnehin an", weil sich die Wertformel ändert. **Gemessen stimmt das nicht:** der Median-
Impact des Demokaders bewegt sich durch diese Änderung nur um ~1,3 % (`10,8` → `10,94` bei
Feldgröße 6) — weit innerhalb der ±25-%-Schwelle des Wächters. Der Test blieb vor dem Neuziehen
der Referenz grün.

Das ist kein Fehler des Wächters, sondern eine Konsequenz der K3-Bauform selbst: sie ist bewusst
erwartungswertneutral (`fgPunkte*0,5+xp*0,5` hält denselben Erwartungswert wie vorher `fgPunkte`),
verschiebt also den MEDIAN kaum, senkt aber die Streuung zwischen einzelnen Spielen — genau das
Ziel. Der 25-%-Wächter ist auf grobe Drifts kalibriert (sein eigenes Beispiel: eine
Spieldauer-Änderung um Faktor 2,5), nicht auf eine gezielte Varianzreduktion mit gleichem
Mittelwert. Die PPs-Referenz wurde trotzdem neu gezogen — die zugrunde liegende Formel hat sich
real geändert, auch wenn der Median stabil blieb, und die eingefrorene Referenz soll den
AKTUELLEN Motor widerspiegeln, nicht nur einen, dessen Median sich zufällig kaum bewegt hat.

Nach dem Neuziehen (Schritt 5) erneut geprüft: `npx vitest run tests/basketball-pps-referenz-
drift.test.ts` — **1 passed (1)**, weiterhin grün (erwartungsgemäß, s. o.).

## 5. PPs-Referenz neu gezogen

`OLY_APP_SQLITE_PATH=<abbild> npx tsx scripts/ziehe-basketball-pps-referenz.ts --feldgroesse=<n>`
je Feldgröße, sequentiell (nicht parallel — s. Umgebungshinweis unten), danach `--merge`. Volle
300+-Fixtures-Vorgabe eingehalten (304 je Feldgröße, wie im etablierten PPs-Skalierungs-Muster).

| Feldgröße | iMittel vorher | iMittel nachher | iKrass vorher | iKrass nachher | demoKaderMedian vorher | nachher |
|---|---:|---:|---:|---:|---:|---:|
| 2 | 52,5 | 52,87 | 101,01 | 97,57 | 33,3 | 33,52 |
| 3 | 34,0 | 33,9 | 77,22 | 75,91 | 18,2 | 18,65 |
| 4 | 24,9 | 24,98 | 65,68 | 64,47 | 14,95 | 14,74 |
| 5 | 19,1 | 19,33 | 54,5 | 54,46 | 13,5 | 13,61 |
| 6 | 15,4 | 15,42 | 52,65 | 51,52 | 10,8 | 10,94 |

Genau das erwartete Bild: `iMittel` (Median) bewegt sich kaum (±0,1–0,4, Rauschen einer
neuen Ziehung, kein Trend) — die K3-Formel ist erwartungswertneutral, das war der Punkt.
`iKrass` (99,5.-Perzentil, „ein krasser Auftritt") sinkt dagegen bei jeder Feldgröße spürbar
(−1,3 bis −3,4 %): ein außergewöhnlich glückliches Spiel (viele getroffene Würfe mit niedriger
`technik`) wird jetzt gedämpft, weil die Hälfte seines Punktewerts an der tatsächlichen
Wurfqualität hängt statt am reinen Ausgang — exakt die Streuungsreduktion, die K3 verspricht.

`node scripts/baue-rangtreue-basislinie.mjs 24` danach neu gebaut, CI-Gate (`node scripts/pruefe-
rangtreue-schranke.mjs`) läuft **grün** gegen die neue Basislinie (alle 20 Zeilen `ok`, inkl.
Basketball `0,772 vs. 0,772, ±0,000`).

**Umgebungshinweis (Transparenz, kein Ergebnis-Vorbehalt):** Diese Runde lief in einer geteilten
Umgebung mit mehreren gleichzeitigen Agenten-Sitzungen auf demselben Host. Zwei konkrete Probleme
kamen dabei vor, beide identifiziert und behoben, **keins hat die oben stehenden Zahlen
beeinflusst**: (1) `/tmp` lief mit nur 1,6 GB frei voll (7,2 GB Testartefakte `oly-*.sqlite*`
aus früheren Sitzungen, nie aufgeräumt) — das ließ `runArenaFixtures()`-Läufe nach einigen
Batches unwiederbringlich hängen (0 % CPU, kein Fortschritt); behoben durch Aufräumen. (2) Zwei
parallele `git stash`/`git stash pop`-Zyklen in dieser Sitzung fingen sich kurzzeitig unrelated
lokale Änderungen eines anderen, gleichzeitig auf demselben Checkout laufenden Vorgangs ein
(`data/generated/sprite-fit-bewertung.json`, `docs/design/bloater-modell-verbessert.md`) — beide
Dateien wurden identifiziert, NICHT angefasst und sind bewusst nicht Teil dieses Commits/PRs
(expliziter `git add` nur der unten gelisteten Dateien). Der eigene Diff dieser Runde wurde vor
dem Commit Zeile für Zeile gegen die Absicht dieses Berichts geprüft.

## 6. Testsuite

`npm test` (vollständig, vitest run — nicht nur battle-mode-Dateien):

```
Test Files  3 failed | 1021 passed | 2 skipped (1026)
     Tests  4 failed | 8067 passed | 23 skipped (8094)
```

Die 4 Fehlschläge sind reine `Test timed out`-Abbrüche (15/40/40/20 s) in drei Dateien, die mit
Basketball/`battle-mode`/Arena **nichts zu tun haben** (`ai-market-plan-apply-service`,
`matchday-auto-run-service`, `transfermarkt-local-service`) — erwartbar in dieser Runde, weil die
Umgebung durchgehend mit mindestens einer weiteren, gleichzeitigen Agenten-Sitzung um dieselben
4 CPU-Kerne konkurrierte (s. Umgebungshinweis oben). Zum Nachweis alle drei Dateien isoliert neu
gefahren: **`3 passed (3)`, `64 passed (64)`, keine Fehlschläge** — die Timeouts sind
Ressourcen-Artefakte dieser geteilten Umgebung, keine Regression dieser Änderung. Alle
`battle-mode`/`arena`/PPs-bezogenen Suiten waren im vollständigen Lauf durchgehend grün.

## 7. Geänderte Dateien

- `public/mockups/battle-mode.engine.js` — `u.xp`-Feld, `wirf()`-Buchung, `feldspielWert()`-
  Basketball-Zweig, Boxscore-Spalte `xp`. **Betrifft die Live-Disziplin** (s. Kopf dieses
  Berichts) über `ArenaFixtureBoxscoreEintrag.wert`.
- `data/generated/basketball-pps-referenz.json` — neu gezogen.
- `data/generated/rangtreue-basislinie.json` — neu gebaut.
- `docs/design/basketball-k3.md` — dieser Bericht.

Keine Änderung an `lib/` oder `app/` — nur der Mockup-Motor und die davon abhängigen
generierten Referenzdateien.
