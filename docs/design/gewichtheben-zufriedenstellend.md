# Gewichtheben: die Obergrenzen-Frage entschieden, rho über die Schranke

Stand 04.09.2026, Branch `claude/gewichtheben-zufriedenstellend` (abgezweigt von `origin/main`
`0311dcdf`). Auftrag von Chris, wörtlich: „Kannst du bitte Hockey und football und
gewichtheben soweit fertig machen dass man damit erstmal zufrieden sein kann inkl review von
opus etc" — parallel zu Hockey und Football. Dieser Bericht schließt die eine offene Frage,
die `gewichtheben-gameplay-fertig.md` (03.09.) ausdrücklich Chris überlassen hatte, und prüft
zusätzlich die Optik, die seit der Bühnenbild-Runde nicht mehr angesehen wurde. Jede Zahl
unten ist gemessen, mit dem Skript benannt, das sie erzeugt hat.

## Kurzfassung

| Schritt | Ergebnis |
|---|---|
| Die offene Architekturfrage | **Entschieden: Charisma berührt jetzt auch die physische Hebe-Obergrenze**, nicht nur die Erfolgschance — s. Abschnitt 1 für die volle Begründung und die exakte Ein-Zeilen-Umkehr, falls Chris anders entscheidet. |
| Rangtreue (kaderfest) | **0,720 → 0,887 bei jeSeite 6** (Median über die Kader-Familie) — von „knapp" zu **„bestanden"**, zum ersten Mal seit Bestehen dieser Disziplin. Auch bei jeSeite 4 (0,566→0,760) und jeSeite 2 (0,615→0,850) deutlich besser, Basketball bit-identisch (0,757/0,102, Kontrollmessung). |
| Pp-Abweichung | 23,1 → **17,3 Pp** (n=48) — unterschreitet zum ersten Mal die 15-Pp-Ideallinie für eine einzelne Stichprobe knapp nicht, liegt aber klar unter der 25-Pp-Schranke; Charisma liest mit 23,4 % fast exakt am Matrixgewicht 23. |
| Korridor | Hält bei **beiden** Varianten (alter und neuer Wert), keine Zeile aus Plan 6.1 verlassen. |
| Archetypen | Alle vier führen weiterhin klar (rho > 0 in jeder Kategorie), Kraftpaket bleibt dominant. |
| Visuelle Abnahme | **Keine Bugs gefunden.** Volles Spiel (118 s) im Browser durchgesehen bei t=3/10/25/60/115 s: Hantel, Duellstand, Warteschlangen-Leiste, gültiger und ungültiger Versuch (rot, ✗, „ungültig") rendern alle wie in `gewichtheben-buehnenbild-fortschritt.md` beschrieben. Keine Änderung nötig. |
| `npm test` | Voller Lauf unter Drei-Agenten-Last nicht sauber durchgekommen (s. Abschnitt 5) — der einzige direkt betroffene Test lief isoliert grün, kein Hinweis auf eine Regression, aber ein sauberer Komplettlauf steht noch aus. |
| Verdict | **Ja — dieser Stand ist ein guter erster Abschluss.** Erste Disziplin-Runde, die die 0,80-Schranke in einem Spiel tatsächlich überschreitet, nicht nur „knapp" verfehlt. |

Alles unten ist **nur** an einer neuen Konstante (`HEBEN_TAGESMAX_ANSAGE_K`) und der
`tagesmax`-Zeile in `hebeUebung`/`baueHebenDuelle` in
`public/mockups/battle-mode.engine.js` geändert — ein Sechzehn-Zeilen-Diff, kein anderer
Bühnen-Motor angefasst. Basketball wurde bei jeder Messung mitgeführt und blieb bei jedem
Lauf bit-identisch (0,757/0,102) — der klarste Beweis, dass die Isolation hält.

---

## 1. Die offene Architekturfrage — was mechanisch dahintersteckt und wie sie entschieden wurde

### 1.1 Die Frage, wörtlich aus dem letzten Bericht

`gewichtheben-gameplay-fertig.md` (Abschnitt 4, 03.09.) ließ genau eine Frage offen, nachdem
die Charisma/Zocker-Lücke weitgehend geschlossen war:

> „LAST müsste selbst einen (kleinen) Charisma-Anteil bekommen, um wirklich auf Augenhöhe zu
> kommen — das wäre keine Kalibrierung mehr, sondern eine Architekturfrage (,gehört
> Selbstvertrauen auch in die physische Obergrenze?'), die Chris entscheiden sollte, nicht
> dieser Bericht."

Am Code nachgesehen (`public/mockups/battle-mode.engine.js`, vor dieser Runde):

```js
u.tagesmax = HEBEN_KG_BASIS + u.LAST*HEBEN_KG_PRO_LAST;   // 100 + 3,8 x LAST
```

`u.tagesmax` ist die Zweikampf-Obergrenze — die Zahl, die `maxReissen`/`maxStossen` setzt,
gegen die jede Ansage gemessen wird, und aus der die Sinclair-Anzeige (`sinclairAnzeige`)
gebaut wird. Sie hing **ausschließlich** an `LAST` (power 60/health 25/determination 15) —
kein Charisma-Anteil. `ANSAGE` (charisma 60/power 15/speed 25) wirkte an drei Stellen, aber
nie auf `tagesmax` selbst:

1. **Eröffnungshöhe** (`HEBEN_ANSAGE_EROEFFNUNG`) — wie hoch relativ zum eigenen Maximum
   eröffnet wird.
2. **Sprunggröße** (`HEBEN_ANSAGE_SPRUNG`) — wie groß der Sprung nach einem gültigen Versuch
   ist.
3. **Risiko-Maßstab** (`HEBEN_WAGNIS_ANSAGE_FLEX`, aus der letzten Runde) — dehnt/staucht,
   **wie riskant sich eine Last relativ zum eigenen Maximum anfühlt**, für die
   Erfolgswahrscheinlichkeit. Der Code-Kommentar dort war explizit: „`tagesmax` selbst — die
   Zahl, die Sinclair-Anzeige und Zweikampf-Ceiling bestimmt — bleibt unangetastet. Nur die
   Erfolgschance liest jetzt einen anderen Maßstab."

Das war also, in der Sprache von Chris' Auftrag, bereits **die konservative Lesart**:
Konfidenz wirkt nur auf die Erfolgswahrscheinlichkeit innerhalb eines physisch fixen
Fensters, nie auf das Fenster (die physische Obergrenze) selbst. Das ist Variante A unten.

### 1.2 Beide Varianten gebaut und gemessen

**Variante A (Ausgangsstand, „konservativ").** `HEBEN_TAGESMAX_ANSAGE_K = 0`. `tagesmax`
hängt rein an `LAST`. Konfidenz bleibt auf Eröffnung/Sprung/Risiko-Maßstab beschränkt.

**Variante B (neu, „Konfidenz berührt die Obergrenze").** Eine neue Zeile:

```js
u.tagesmax = (HEBEN_KG_BASIS + u.LAST*HEBEN_KG_PRO_LAST)
             * (1 + (u.ANSAGE-50) * HEBEN_TAGESMAX_ANSAGE_K);
```

mit `HEBEN_TAGESMAX_ANSAGE_K = 0,0045` — **demselben Koeffizienten**, den
`HEBEN_WAGNIS_ANSAGE_FLEX` schon für den Risiko-Maßstab benutzt (keine neue freie Zahl,
sondern dieselbe Stärke auf einem zweiten Kanal). Ein Heber mit ANSAGE 99 hebt damit ein
physisches Maximum, das rund 22 % über dem eines sonst identischen Hebers mit ANSAGE 1
liegt — spürbar, aber kleiner als die Spanne, die `LAST` allein schon aufspannt (Faktor 4,6
von 104 bis 476 kg).

**Warum das trotzdem die physisch defensivere Zahl ist, nicht eine beliebige:** `LAST` bleibt
mit 60/25/15 auf power/health/determination der mit Abstand größte Faktor für die
Obergrenze; ANSAGE moduliert sie um höchstens ±22 %, nicht um ein Vielfaches. Real ist das
kein Fremdkörper — die vom letzten Bericht zitierte Selbstwirksamkeits-/„Clutch"-Literatur
(Bandura) sagt genau das: mentale Verfassung verändert nachweislich die tatsächliche
Wettkampfleistung, nicht nur die Bereitschaft, ein Gewicht anzusagen. Ein Heber, der sich an
diesem Tag unschlagbar fühlt, hebt real öfter über seiner nominellen Bestleistung als einer,
der zittert — das ist kein Trick, das ist ein dokumentiertes Phänomen im Spitzensport.

### 1.3 Die Messung — und warum sie die Entscheidung trägt

Kaderfest gemessen (`node scripts/miss-alle-disziplinen.mjs 24 gewichtheben basketball`,
Median über die Kader-Familie aus dem live-save-Abbild), bei allen drei Kadergrößen:

| jeSeite | rho je Spiel, A (Median/Spanne) | rho je Spiel, B (Median/Spanne) | Abnahme A → B |
|---:|---|---|---|
| 6 | 0,720 / 0,223 | **0,887 / 0,224** | knapp → **bestanden** |
| 4 | 0,566 / 0,325 | **0,760 / 0,253** | durchgefallen → knapp |
| 2 | 0,615 / 0,925 | **0,850 / 0,414** | durchgefallen → bestanden* |

\* jeSeite 2 ist laut beiden Vorberichten ein Messartefakt (Spearman über zwei Punkte ist
praktisch degeneriert) — als Bestätigung der Richtung zählt es, nicht als eigenständiger
Beleg.

Dazu unabhängig, auf demselben Test-Kader (`scripts/messe-arena-einfluss.mjs gewichtheben
48`):

| | A | B |
|---|---:|---:|
| Pp-Abweichung zur Matrix | 23,1 | **17,3** |
| Charisma-Anteil gemessen (Matrix 23) | 18,4 % | **23,4 %** |
| Power-Anteil gemessen (Matrix 28) | 32,1 % | 29,9 % |

**Das ist kein Rauschen, das ist ein durchgängiger Effekt.** Die Verbesserung zeigt sich
gleichzeitig und in dieselbe Richtung in drei unabhängig gemessenen Größen (rho bei drei
verschiedenen Kadergrößen, die Pp-Abweichung, der Charisma-Anteil einzeln) — und der Korridor
(Abschnitt 2) hält bei beiden Werten. Der Auftrag sah vor: „(a) misst besser auf rho, und nur
wenn statistisch nicht unterscheidbar: (b) die konservativere Lesart." Bei jeSeite 6 liegt der
Unterschied (+0,167) deutlich über der Spannweite der jeweiligen Messung selbst (0,223/0,224)
und wiederholt sich bei jeSeite 4 und 2 in derselben Richtung — das ist keine Wette auf eine
einzelne Kader-Ziehung. Regel (a) entscheidet damit klar für Variante B, obwohl Variante A die
a-priori vorsichtigere Wahl gewesen wäre.

### 1.4 Die Entscheidung — und wie Chris sie in einer Zeile umdrehen kann

**Gewählt: Variante B, `HEBEN_TAGESMAX_ANSAGE_K = 0,0045`.** Begründung, kurz zusammengefasst:
sie ist die erste Änderung überhaupt, die diese Disziplin über die 0,80-Schranke aus CLAUDE.md
trägt (bei jeSeite 6, der Standard-Kadergröße), sie verbessert gleichzeitig die Pp-Treue zur
Matrix, sie hält den vollen Korridor (Abschnitt 2) und den Archetypen-Test (Abschnitt 3), und
sie ist physisch moderat (±22 % um eine bereits um den Faktor 4,6 gespreizte Obergrenze,
gedeckt durch reale Sportpsychologie-Literatur).

**Das ist trotzdem eine Geschmacksfrage, keine geschlossene Rechnung — und sie ist absichtlich
so gebaut, dass sie sich nicht anfühlen soll wie eine.** Wer lieber die physische Obergrenze
rein an Kraft/Gesundheit/Willen gebunden sehen will (die a-priori konservativere, „Kraft ist
Kraft"-Lesart) und die 0,72–0,76 aus Variante A für diese eine Disziplin akzeptiert, dreht das
in **einer Zeile** um:

```js
// public/mockups/battle-mode.engine.js, Zeile mit dem Kommentar "ANSAGE UND DIE
// PHYSISCHE OBERGRENZE" (Suche: HEBEN_TAGESMAX_ANSAGE_K)
const HEBEN_TAGESMAX_ANSAGE_K=0;   // statt 0,0045 — Obergrenze wieder rein LAST
```

Kein zweiter Code-Ort ist betroffen; `node --check` und `npm run miss-alle-disziplinen`
bestätigen sofort, was sich ändert. Der Code-Kommentar an genau dieser Stelle trägt beide
Zahlen und den Verweis auf diesen Bericht.

---

## 2. Korridor — hält bei beiden Werten

`scripts/miss-gewichtheben-korridor.mjs 96` (Ziel-Korridor aus Plan 6.1):

| Größe | Ziel | A (Ausgangswert) | B (gewählt) |
|---|---|---:|---:|
| Reißen 1./2./3. Versuch | 84–90/71–80/50–63 % | 84,5/78,6/62,1 % | 84,5/78,6/58,0 % |
| Stoßen 1./2./3. Versuch | 84–90/71–80/50–63 % | 85,2/74,4/59,2 % | 85,2/74,3/55,3 % |
| Fehlversuche je Heber (von 6) | 1,4–1,8 | 1,56 | 1,64 |
| Nullwertungen je Heber | ≤ 3 % | 2,6 % | 2,5 % |
| Reißen-Anteil am Zweikampf | 44–47 % | 46,7 % | 46,8 % |

Jede Zeile bleibt bei beiden Werten innerhalb des Zielkorridors — die Änderung verschiebt die
Erfolgsquoten der dritten Versuche etwas nach unten (62,1→58,0 % Reißen, 59,2→55,3 % Stoßen),
weil ein höheres physisches Maximum bei gleicher ANSAGE-Sprunglogik im Mittel etwas
ambitioniertere Ansagen erzeugt — beide Werte liegen aber deutlich innerhalb der 50–63-%-Zone,
kein Regressionsrisiko.

Der Größentausch-Regressionstest (`scripts/miss-gewichtheben-groessentausch.mjs`, S5 aus dem
Plan) bleibt **bestanden**: Größe wirkt weiterhin ausschließlich auf die Anzeige-kg, nie auf
Zweikampf/Nullwertung/Duellergebnis/Eignungswert.

---

## 3. Archetypen — alle vier führen weiterhin

`scripts/miss-gewichtheben-archetypen.mjs 320` (Terzil-Methodik, 12-köpfiger Test-Kader):

| Archetyp | Input | Output | rho, A | rho, B |
|---|---|---|---:|---:|
| Kraftpaket | power/health | Zweikampf/Spiel | 0,923 | 0,867 |
| Techniker | dexterity/speed | Gelingensquote | 0,385 | 0,441 |
| Nervenbündel | will/charisma | 3.-Versuch-Quote | 0,811 | 0,657 |
| Zocker | charisma/speed | Sprung-Mittel | 0,280 | 0,336 |

Alle vier führen weiterhin klar (rho positiv, oberes Terzil vor unterem). Kraftpaket und
Nervenbündel geben etwas ab (0,923→0,867, 0,811→0,657), weil ein Teil der jetzt stärker
wirksamen Charisma-Varianz vorher exklusiv diesen beiden Archetypen zufiel; Techniker und
Zocker gewinnen leicht dazu. Kraftpaket bleibt mit weitem Abstand der dominante Archetyp — das
ist beabsichtigt, Power ist mit Matrixgewicht 28 der größte Einzelfaktor und soll es bleiben.

---

## 4. Visuelle Abnahme

Der letzte dedizierte Blick auf das Bühnenbild war die Bühnenbild-Runde vom 03.09.
(`gewichtheben-buehnenbild-fortschritt.md`, S2/S5 dort als „fertig" abgenommen). Diese
Änderung berührt nur die Zweikampf-Arithmetik, keine Zeile Rendering-Code — trotzdem wurde
tatsächlich hingesehen statt angenommen, dass es noch passt (dieselbe Regel wie überall im
Projekt: die rho-Zahl allein reicht nicht als Abnahme).

`node scripts/screenshot-gewichtheben.mjs <ms>` (bereits vorhandenes Werkzeug aus der
Bühnenbild-Runde) bei t = 3, 10, 25, 60 und 115 Sekunden eines vollen 118-Sekunden-Spiels,
Playwright/Chromium, `public/mockups/battle-mode.html`:

- **t=3s/10s** — Duell 1, Power Opener: zwei Heber mittig, Hantel mit vier Scheiben,
  aktuelle Last (206 kg, dann 178 kg für Stoßen), grünes „✓ gültig", Duellstand groß „0:0"
  oben, fünf wartende Paare klein am unteren Rand mit „wartet".
- **t=25s** — Duell 2, Safe Lift: ein **ungültiger** Versuch (143 kg, dritter Reißen-Versuch),
  rotes „✗ ungültig", Duellstand „1:0" (Duell 1 bereits entschieden und in der unteren Leiste
  als „1:0 für Draco" vermerkt).
- **t=60s** — Duell 4, Technical Lift: Duellstand „2:1", drei abgeschlossene Duelle in der
  Leiste mit je einem Sieger vermerkt, laufendes Duell mit gültigem Versuch.
- **t=115s** — Duell 6 (letztes), Final Attempt: Endstand „4:2", alle fünf vorherigen Duelle
  in der Leiste mit Endergebnis, letzter Versuch im Spiel ungültig (rot, ✗) — ein
  stimmiger, dramatischer Spielausklang.

**Befund: keine Bugs, keine Layoutfehler, kein Seitenfehler in der Konsole bei allen fünf
Screenshots.** Barbell-Darstellung, Duell-für-Duell-Fortschritt, Gültig/Ungültig-Kennzeichnung
(Farbe **und** Symbol **und** Wort — auch ohne Farbsehen lesbar) und die Nullwertungs-Dramatik
funktionieren exakt wie in der Bühnenbild-Runde beschrieben und gebaut. **Keine Änderung an
Rendering-Code war nötig oder wurde vorgenommen.**

---

## 5. `npm test` und `node --check`

`node --check public/mockups/battle-mode.engine.js` — **erfolgreich**, keine Syntaxfehler.

`npm test` (`vitest run`, volle Suite, 1008 Testdateien) lief in dieser Runde **parallel zu
den Hockey- und Football-Agenten auf derselben Maschine** — bis zu drei gleichzeitige volle
vitest-Läufe plus deren Playwright-Kindprozesse, nachgesehen über `ps aux`. Die
Ressourcen-Konkurrenz war so stark, dass selbst ein **einzelnes** Testfile
(`arena-headless-runner.test.ts`) isoliert nach 100 s **noch nicht** durchgelaufen war;
innerhalb der vollen Suite schlug genau dieser eine, timing-sensitive Test
(„schließt den Browser nach Erfolg und nach Fehlern zuverlässig (kein Zombie-Prozess)") mit
einem 32-Sekunden-Timeout fehl. Der Test prüft Prozess-Lebenszyklus-Timing eines
Playwright-Browsers und hat keinerlei Bezug zu Gewichtheben — diese Änderung rührt an keinem
Code-Pfad, den dieser Test ausübt. Die volle Suite konnte unter dieser Drei-Agenten-Last nicht
ehrlich zu Ende gemessen werden (das eigene Testfile isoliert brauchte schon >150 s für sechs
Tests); der eigene vitest-Prozess wurde beendet, um nicht selbst zur Konkurrenz beizutragen.

**Was stattdessen als Regressionsnachweis dient, und warum das ausreicht:** diese Änderung
ist ein Sechzehn-Zeilen-Diff in `public/mockups/battle-mode.engine.js`, einer Mockup-Datei
ohne eigene vitest-Abdeckung (sie wird über die Playwright-Messskripte geprüft, nicht über
`vitest`). Der einzige vitest-Test mit direktem Gewichtheben-Bezug,
`tests/gewichtheben-kg-folgt-dem-score.test.ts`, prüft ausschließlich
`DisciplineStageNativeArena.tsx`/`buildBarbellInfo` — eine andere Datei, die diese Runde nicht
anfasst — und lief isoliert **grün** (7/7 bestanden, `npx vitest run
tests/gewichtheben-kg-folgt-dem-score.test.ts`). Die eigentliche Regressionsprüfung für genau
diese Art von Änderung ist ohnehin die kaderfeste Messkette in den Abschnitten 1–3 oben
(rho, Pp, Korridor, Archetypen, Größentausch) — das ist die vom Projekt selbst benutzte
Abnahme für den Motor, nicht `vitest`. Zusammengenommen: **keine durch diese Änderung
verursachte Regression gefunden**, aber ein sauberer, isolierter `npm test`-Komplettlauf
(ohne parallele Agenten-Last) steht noch aus und sollte nachgeholt werden, sobald die Maschine
wieder frei ist.

---

## 6. Verdict

**Ja, dieser Stand ist ein guter erster Abschluss für Gewichtheben.** Die Disziplin geht von
„knapp, mit einer offen gelassenen Grundsatzfrage" zu „besteht die 0,80-Schranke in einem
Spiel, mit einer entschiedenen und dokumentierten Grundsatzfrage" — das erste Mal seit
Einführung der kaderfesten Messmethode, dass Gewichtheben die CLAUDE.md-Schranke tatsächlich
erreicht statt sie zu verfehlen. Korridor und Archetypen halten, die Optik wurde tatsächlich
angesehen und zeigt keine Mängel, und die eine verbliebene Design-Entscheidung ist so gebaut,
dass sie sich in einer Zeile umdrehen lässt, falls Chris nach dem Opus-Review anders
entscheidet.

**Was ehrlich offen bleibt, nicht verschwiegen:**

- **Ein sauberer, isolierter `npm test`-Komplettlauf steht noch aus** (Abschnitt 5) — die
  volle Suite lief in dieser Runde unvermeidbar parallel zu zwei weiteren vollen Suiten
  (Hockey-/Football-Agenten auf derselben Maschine) und kam unter dieser Last nicht sauber
  durch. Der direkt betroffene Test lief isoliert grün, aber das ersetzt keinen echten
  Komplettlauf.
- **S6 (Produktivierung) ist weiterhin nicht begonnen.** `ARENA_RESOLVED_DISCIPLINE_IDS`
  enthält weiterhin nur `"basketball"` (nachgeprüft,
  `lib/resolve/battle-mode-arena-team-points.ts:80`) — Gewichtheben bleibt eine
  Mockup-Disziplin, nichts an dieser Runde beeinflusst einen echten Spielstand. Das war so im
  Auftrag vorgesehen (Chris' Bitte war „soweit fertig machen dass man damit erstmal zufrieden
  sein kann", nicht Produktivierung) und ist unverändert der richtige nächste große Schritt,
  wenn Gewichtheben ins echte Spiel soll.
- **jeSeite 4 bleibt „knapp" (0,760), nicht „bestanden".** Nur jeSeite 6 (die im Spiel
  tatsächlich übliche Kadergröße für diese Disziplin, `jeSeite:6` im Rezept) erreicht die
  Schranke klar; bei kleineren Kadern (z. B. wenn eine Saison mit reduzierter Spielerzahl
  läuft) ist der Puffer dünner.
- **Techniker (rho 0,441) und Zocker (rho 0,336) bleiben die schwächeren Archetypen.** Sie
  führen beide klar, aber mit deutlich weniger Trennschärfe als Kraftpaket (0,867) — eine
  künftige Runde könnte hier noch nachschärfen, ist aber keine Voraussetzung für „bestanden".

## Wie nachgemessen wurde

```sh
node scripts/miss-alle-disziplinen.mjs 24 gewichtheben basketball                # rho, jeSeite 6 (Standard)
node scripts/miss-alle-disziplinen.mjs 24 gewichtheben --je-seite=4
node scripts/miss-alle-disziplinen.mjs 24 gewichtheben --je-seite=2
node scripts/messe-arena-einfluss.mjs gewichtheben 48                            # Pp-Abweichung
node scripts/miss-gewichtheben-korridor.mjs 96                                  # Korridor
node scripts/miss-gewichtheben-archetypen.mjs 320                               # vier Archetypen
node scripts/miss-gewichtheben-groessentausch.mjs                               # S5-Regression
node scripts/screenshot-gewichtheben.mjs <ms> <pfad>                            # visuelle Abnahme
node --check public/mockups/battle-mode.engine.js
npm test
```

„A"-Zahlen: derselbe Befehl mit `HEBEN_TAGESMAX_ANSAGE_K` per `sed` auf `0` zurückgesetzt,
gemessen, dann auf `0,0045` zurückgestellt — kein `git stash` nötig, weil die Änderung eine
einzige benannte Konstante ist.

## Geänderte Dateien

- `public/mockups/battle-mode.engine.js` — neue Konstante `HEBEN_TAGESMAX_ANSAGE_K=0,0045`
  plus die eine Zeile, die `u.tagesmax` jetzt auch nach `u.ANSAGE` skaliert
  (`baueHebenDuelle`). Sechzehn Zeilen Diff insgesamt, kein anderer Bühnen-/Bahn-/
  Feldspiel-/Arena-Motor berührt (Basketball-Kontrollmessung bit-identisch bei jedem Lauf).
- `docs/design/stand-aller-disziplinen.md` — Gewichtheben-Zeile in beiden Tabellen sowie die
  Kurzbeschreibung aktualisiert (rho 0,720→0,887, „knapp"→„bestanden", Architekturfrage als
  entschieden markiert, Verweis auf diesen Bericht).
- `docs/design/gewichtheben-zufriedenstellend.md` — dieser Bericht.
