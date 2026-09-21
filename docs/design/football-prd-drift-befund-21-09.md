# Football-PRD-„Drift"-Befund: kein Drift, aber ein Erwartungswert-Fehler (21.09.)

Reine Recherche und Messung, kein Code auf `main`. Auftrag: klären, warum Football nach
PR #978 (P1, PRD für die vier football-eigenen Zufallsentscheidungen) bei rho 0,738 je Spiel
steht statt bei den 0,796, die Commit `0fd080cb` („Slot-Bonus auf Ansatzpunkt 2", 16.09.)
erreicht hatte — und ob PRD dafür verantwortlich ist.

Alle Zahlen unten sind heute an derselben festen Kaderfamilie
(`data/generated/kaderfamilie-live-save.json`, fünf Paarungen, gezogen 03.09.) gemessen.
Kein Produktionsfile wurde angefasst: jede Variante ist eine Kopie von `public/mockups/`
im Scratchpad mit einem ausgetauschten `fkPRDTrifft()` und/oder dem Diff von `0fd080cb`
(`git diff origin/main...football-balance-runde-16-09 -- public/mockups/battle-mode.engine.js`,
zwei Hunks, mit `patch -p3` auf die Kopie gelegt). Gemessen wurde mit einer Kopie von
`scripts/miss-alle-disziplinen.mjs`, die nur `SEITE` aus einer Umgebungsvariable liest und
denselben Messkern `scripts/lib/rangtreue-messung.mjs` aus dem Repo importiert. Anhang
beschreibt die Reproduktion Schritt für Schritt.

---

## 0. Ergebnis vorab

1. **Die Prämisse des Auftrags stimmt nicht: es gab keinen Drift von 0,796 auf 0,738.**
   Commit `0fd080cb` liegt **nur** auf dem Branch `football-balance-runde-16-09` und ist
   **PR #944, seit 16.09. offen, nie gemerged** (`git branch -a --contains 0fd080cb` nennt
   ausschließlich diesen Branch; `betroffeneAttribute()`/`slotAufschlag()` auf `main` enthalten
   keine `football`-Abfrage). Die 0,796 waren also nie auf `main`. PR #978 hat vor seiner
   Änderung `main` nachgemessen und dort 0,722 gefunden — das ist der Stand OHNE Slot-Fix.
   Die Rechnung „0,796 → 0,738 = −0,058 durch PRD" vergleicht einen Branch-Wert mit einem
   `main`-Wert. Richtig ist: **PRD auf `main` allein: 0,722 → 0,738 (+0,016)**, heute exakt
   reproduziert (Abschnitt 4, Varianten A/B). Beide Zahlen liegen innerhalb der
   Kaderfamilie-Spannweite (0,164 bzw. 0,207); die Bewegung ist von Null nicht unterscheidbar.
2. **Slot-Fix und PRD zusammen (der Stand, den ein Merge von PR #944 heute ergäbe): 0,785 je
   Spiel, Spannweite 0,083, 0,895 Saison.** Gegen den Slot-Fix ohne PRD (0,796 / 0,142 / 0,888)
   ist das −0,011 im Median — innerhalb jeder Spannweite, aber die **Spannweite halbiert sich**
   (0,142 → 0,083, das engste 90-%-Bootstrap-Intervall aller zwölf gemessenen Varianten:
   [0,755; 0,838]). PRD verschlechtert die Rangtreue also nicht messbar; es macht sie
   kaderrobuster. **Unter 0,80 bleibt Football in beiden Fällen.**
3. **Der eigentliche Fehler an PRD ist ein anderer und er ist real: das Konto-Schema hält den
   Erwartungswert nicht.** Der Kommentar bei `fkPRDTrifft()` (`battle-mode.engine.js:8616-8632`)
   behauptet „Erwartungswert bleibt exakt p, klassische PRD-Eigenschaft" und beruft sich auf
   ein Bresenham-Prinzip. Beides ist falsch: das Konto wird beim Treffer auf 0 gesetzt statt um
   1 vermindert, damit ist die Langfrist-Trefferquote bei konstantem p gleich
   `1 / Σ_k Π_{j≤k}(1 − j·p)`, und die liegt für p = 0,07 (Sack) bei 0,226, für p = 0,032
   (Fumble) bei 0,149, für p = 0,011 (Interception-Basis) bei 0,085. Das ist genau die
   Eigenschaft, derentwegen Warcraft 3 eine Konstante C < p tabelliert. **Im Spiel nachgemessen
   (instrumentiertes `fkPRDTrifft`, 200 Spiele): Fumble ×3,03, Sack ×2,54, Interception ×3,05,
   Completion ×1,10 gegenüber dem nominellen p.**
4. **Damit ist der NFL-Korridor, gegen den vier frühere Runden gefittet haben, auf `main`
   kaputt** — unbemerkt, weil die P1-Verifikationsliste `miss-football-korridor.mjs` nicht
   enthielt. `main` heute (200 Spiele): Sack-Quote 17,5 % (Ziel ~7,0, vor PRD 7,0),
   Interception-Quote 7,6 % (Ziel 2,1-2,4, vor PRD 2,5), verlorene Fumbles 1,24 je Team
   (Ziel ~0,5, vor PRD 0,44), Punkte je Team 13,5 (vor PRD 16,6). Die Completion-Quote sieht
   mit 65,6 % unverändert aus — Zufall: 0,7096 × (1 − 0,0757) = 0,656, der Zuwachs an
   Completions wird exakt von den verdreifachten Interceptions aufgefressen.
5. **Die „korrekte" PRD (WC3-Konstante C(p), Langfristquote exakt p) scheitert in einem
   Football-Spiel in die Gegenrichtung** (Fumble ×0,23, Sack ×0,48, Interception ×0,17):
   PRDs Erwartungstreue ist eine asymptotische Eigenschaft und braucht viele Versuche relativ
   zu 1/p. Ein Feldspieler hat ~12 Ballberührungen je Spiel; 1/p liegt bei 14 (Sack), 33
   (Fumble), 40 (Interception). Nur die Completion (1/p ≈ 1,5) liegt im PRD-Regime.
   **Für die drei seltenen Ereignisse ist PRD in jeder Form das falsche Werkzeug.**
6. **Auch eine mathematisch saubere Streuungsglättung bewegt rho nicht** (Dithering mit
   Zufalls-Startphase, erwartungstreu für JEDE Versuchszahl, Korridor exakt getroffen):
   0,718 auf `main`, 0,778 mit Slot-Fix — beides unter der jeweiligen Referenz ohne PRD.
   Die Bernoulli-Streuung der vier Würfe ist nicht die dominante Rauschquelle je Spiel; das
   Rauschen sitzt in der Rollenlotterie (`fkLos`, wer überhaupt gezogen wird), im Yards-Wurf
   und in der Tier-Wahl. Das ist der Befund, der die nächste Runde leiten sollte.
7. **Empfehlung** (Abschnitt 6): PRD für Sack/Interception/Fumble zurücknehmen (zwingend, wegen
   des Korridors), für die Completion wahlweise behalten oder ebenfalls zurücknehmen (rho-neutral,
   Korridor-Refit nötig, wenn behalten), PR #944 mergen. Erwarteter Stand danach: 0,796 je Spiel,
   Korridor wieder wie vor P1. Für den Weg über 0,80 ist danach nicht die Uhr und nicht der
   Würfel der Hebel, sondern die Lotterie und die Yards-Streuung (Ansatzpunkt 3).

---

## 1. Der Verlauf, richtiggestellt

| Datum | Ereignis | rho je Spiel (kaderfest) | wo |
|---|---|---:|---|
| 15.09. | PR #934 (E3) gemerged | 0,813 → 0,722 | `main` |
| 15.09. | Basislinie `d80a2792` | 0,722 | `main` |
| 16.09. | `0fd080cb` Slot-Fix, PR #944 geöffnet | 0,722 → 0,796 | **nur Branch, PR offen** |
| 20.09. | PR #978 (P1) misst `main` vor der Änderung | 0,722 | `main` |
| 20.09. | PR #978 gemerged, Basislinie `2cea78c8` | 0,722 → 0,738 | `main` |
| 21.09. | heute, `1234d32d` | 0,738 (reproduziert) | `main` |

Der Slot-Fix wurde nie „aufgefressen", er war nie da. Was die Basislinie 0,722 → 0,738 zeigt,
ist ausschließlich PRD. Dass PR #944 nach fünf Tagen noch offen ist, war dem P1-Agenten
offenbar nicht bekannt (sein Kommentar zählt „Football-Balance-Runde nach E3" unter die
„unabhängig gemergten Rezept-Korrekturen" — das war aber nur das Recherche-Dokument, PR #937,
nicht die Umsetzung).

Nachprüfbar mit:

```sh
git fetch origin main football-balance-runde-16-09
git branch -a --contains 0fd080cb
git log --oneline origin/main..football-balance-runde-16-09
git diff origin/main...football-balance-runde-16-09 --stat
```

---

## 2. Was PRD im Code genau tut

`public/mockups/battle-mode.engine.js`, Football-Sektion (Zeilen auf `main` `1234d32d`):

- `fkPRDTrifft(schluessel,p)` (`:8656-8661`): `konto = fkPRD[schluessel] + p`; wenn
  `rr() < konto` → Treffer, Konto auf **0**; sonst Konto = `konto`. Ein `rr()`-Aufruf je
  Entscheidung, an derselben Stelle wie das frühere `rr()<p` — die Ziehungskette der anderen
  neunzehn Disziplinen ist unberührt (das Isolationsargument von PR #978 ist korrekt).
- Vier Aufrufstellen, je Entscheidung ein eigener Schlüssel `<typ>:<spieler.id>`:
  - `resolveLauf()` `:8682` — `"fumble:"+rusher.id`, p = 0,01–0,08 (Basis 0,032)
  - `resolvePass()` `:8739` — `"sack:"+passer.id`, p = 0,02–0,20 (Basis 0,07)
  - `resolvePass()` `:8771` — `"interception:"+passer.id`, p = 0,008–0,10 (Basis 0,011)
  - `resolvePass()` `:8779` — `"komplett:"+passer.id`, p = `steilerMake(...)`, 0,05–0,97
- Konto lebt in `fsLive.fkPRD` (`:9246`), wird in `initFeldspielLive` je Spiel frisch angelegt
  — kein Übertrag zwischen Spielen, kein Übertrag zwischen Spielern.

**Die Kollisions-Hypothese (gemeinsamer Zähler) ist damit vom Tisch**: das Konto ist je
Spieler und je Typ, und der Kommentar `:8634-8644` dokumentiert, dass die spieler-
übergreifende Variante probiert und wegen 0,722 → 0,637 verworfen wurde. Das war die richtige
Entscheidung.

**Die zweite Hypothese (Dämpfung der Eignungsunterschiede) trifft zu — aber nur für die
Completion, und sie ist nicht der Grund für irgendeinen rho-Verlust** (Abschnitt 3.3).

---

## 3. Der eigentliche Fehler: der Erwartungswert bleibt nicht p

### 3.1 Rechnung

Bei konstantem p und Konto-Reset auf 0 ist die Wahrscheinlichkeit, dass der k-te Versuch nach
dem letzten Treffer noch fehlschlägt, `Π_{j=1..k}(1 − min(1, j·p))`. Die erwartete Zahl
Versuche je Treffer ist `E[T] = Σ_{k≥0} Π_{j≤k}(1 − j·p)`, die effektive Quote `1/E[T]`:

| p nominal | p effektiv | Faktor |
|---:|---:|---:|
| 0,010 | 0,082 | 8,2 |
| 0,032 (Fumble-Basis) | 0,149 | 4,7 |
| 0,070 (Sack-Basis) | 0,226 | 3,2 |
| 0,200 | 0,398 | 2,0 |
| 0,300 | 0,498 | 1,7 |
| 0,500 | 0,667 | 1,3 |
| 0,650 | 0,741 | 1,1 |
| 0,750 | 0,800 | 1,1 |
| 0,900 | 0,909 | 1,0 |

Ein Bresenham-Dithering, auf das der Kommentar sich beruft, würde beim Treffer `konto -= 1`
rechnen und deterministisch bei `konto ≥ 1` treffen — dann bliebe die Summe der p exakt
erhalten. Das Schema im Code ist dagegen die WC3-Formel mit C = p, und WC3 tabelliert C
gerade deshalb kleiner als p (für p = 0,25 ist C ≈ 0,085, für p = 0,05 ist C ≈ 0,0038).

### 3.2 Im Spiel nachgemessen

`fkPRDTrifft` in einer Scratchpad-Kopie um einen Mitschnitt je Typ ergänzt
(`window.__prdLog`), dann `feldspielProbe("football",{n:200,jeSeite:6})`:

| Typ | Würfe | p nominal (Mittel) | p min/max | Trefferquote, Konto (`main`) | Faktor | Trefferquote, PRD aus | Trefferquote, WC3-korrekt |
|---|---:|---:|---|---:|---:|---:|---:|
| fumble | 9 415 | 0,030 | 0,010/0,054 | **0,091** | 3,03 | 0,031 | 0,007 |
| sack | 11 193 | 0,069 | 0,020/0,151 | **0,176** | 2,54 | 0,070 | 0,033 |
| interception | 9 228 | 0,025 | 0,008/0,065 | **0,076** | 3,05 | 0,025 | 0,004 |
| komplett | 8 529 | 0,647 | 0,049/0,970 | **0,710** | 1,10 | 0,671 | 0,633 |

„PRD aus" (`return rr()<p`) trifft das nominelle p auf ±5 %. Die WC3-korrekte Form
(Zähler N, Trefferchance `C(p)·N`, C per Bisektion so, dass die Langfristquote exakt p ist)
unterschießt die drei seltenen Ereignisse um Faktor 4–6: ein Rusher mit 12 Läufen je Spiel und
p = 0,03 startet bei C ≈ 0,0016 und kommt in 12 Versuchen auf kumuliert ~0,12 statt 0,36.
Beide Fehler sind dieselbe Eigenschaft von zwei Seiten: PRD ist nur über viele Versuche
relativ zu 1/p erwartungstreu, und die gibt es in einem Football-Spiel für Fumble/Sack/
Interception nicht.

### 3.3 Kompression auf der Completion

Für die Completion, nach nominellen p-Klassen (dieselbe Sonde):

| p-Klasse | p nominal | effektiv, Konto | Faktor | effektiv, WC3-korrekt | Faktor |
|---|---:|---:|---:|---:|---:|
| 0,2–0,3 | 0,241 | 0,369 | 1,53 | 0,117 | 0,48 |
| 0,4–0,5 | 0,438 | 0,567 | 1,29 | 0,331 | 0,76 |
| 0,6–0,7 | 0,656 | 0,755 | 1,15 | 0,651 | 0,99 |
| 0,7–0,8 | 0,759 | 0,796 | 1,05 | 0,743 | 0,98 |
| 0,9–1,0 | 0,945 | 0,953 | 1,01 | 0,954 | 1,01 |

Das Konto-Schema ist eine **konkave** Abbildung von p: der Abstand zwischen einem Passer mit
p = 0,44 und einem mit p = 0,76 schrumpft von 0,32 auf 0,23. Das ist die vermutete Dämpfung
der Eignungsunterschiede — sie existiert, kostet aber messbar nichts (Abschnitt 4: PRD auf
`main` +0,016, mit Slot-Fix −0,011, beides im Rauschen), weil die Streuungsminderung sie
kompensiert. Die WC3-korrekte Form macht das Gegenteil (konvex, spreizt die Unterschiede),
was ihr leicht bessere rho-Zahlen und die höchste Verlässlichkeit beschert (Variante F: 0,851)
— um den Preis eines Korridors mit 3,6 % Sacks und 0,4 % Interceptions.

### 3.4 Der Korridor auf `main` heute

`node scripts/miss-football-korridor.mjs 200` (Kopie mit `OLY_SEITE`, sonst identisch):

| Größe | Ziel (NFL 2024) | `main` heute (PRD-Konto) | PRD aus (= Stand vor P1) |
|---|---:|---:|---:|
| Punkte je Team | 22,9 | **13,5** | 16,6 |
| Touchdowns je Team | ~2,4 | 1,43 | 1,86 |
| Passversuche je Team | ~29,9 | 23,0 | 25,3 |
| Completion-Quote | 65,3 % | 65,6 % | 65,4 % |
| Yards je Passversuch | 7,1 | 6,30 | 6,88 |
| Sack-Quote je Dropback | ~7,0 % | **17,5 %** | 7,0 % |
| Interception-Quote | 2,1–2,4 % | **7,6 %** | 2,5 % |
| Fumbles verloren je Team | ~0,5 | **1,24** | 0,44 |
| Punts je Team | ~4 | 2,94 | 2,48 |

Drei der vier Turnover-/Sack-Größen liegen beim Dreifachen des Ziels, die Punkte fallen um ein
Fünftel. Das ist der Zustand, den die Arena-Zuschauer heute sehen würden, wenn Football in
`ARENA_RESOLVED_DISCIPLINE_IDS` stünde (es steht dort nicht — deshalb ist der Schaden bisher
nur in der Sonde sichtbar).

---

## 4. Isolationsmessung: zwölf Varianten, eine Kaderfamilie

Alle Zeilen: `node <Kopie von miss-alle-disziplinen.mjs> 24 football`, fünf Paarungen, Median
und Spannweite. Verlässlichkeit = (rho Spiel / rho Saison)², nach der CLAUDE.md-Formel.
90-%-Bootstrap-CI des Medians mit `--bootstrap-unsicherheit`, wo gemessen.

| Var. | Slot-Fix (#944) | PRD-Form | auf | rho je Spiel | Spannw. | rho Saison | Spannw. | Verlässl. | Bootstrap-CI |
|---|---|---|---|---:|---:|---:|---:|---:|---|
| **A** | nein | Konto | alle vier | **0,738** | 0,207 | 0,825 | 0,189 | 0,800 | [0,663; 0,869] |
| **B** | nein | aus | — | **0,722** | 0,164 | 0,832 | 0,161 | 0,753 | [0,686; 0,850] |
| C | nein | WC3-korrekt | alle vier | 0,732 | 0,199 | 0,839 | 0,203 | 0,761 | — |
| J | nein | Konto | nur komplett | 0,733 | 0,196 | 0,818 | 0,161 | 0,803 | — |
| L | nein | WC3-korrekt | nur komplett | 0,718 | 0,173 | 0,804 | 0,133 | 0,797 | — |
| N | nein | Dithering | alle vier | 0,718 | 0,161 | 0,839 | 0,182 | 0,732 | — |
| **D** | ja | Konto | alle vier | **0,785** | **0,083** | 0,895 | 0,091 | 0,769 | **[0,755; 0,838]** |
| **E** | ja | aus | — | **0,796** | 0,142 | 0,888 | 0,098 | 0,803 | [0,691; 0,834] |
| F | ja | WC3-korrekt | alle vier | 0,800 | 0,124 | 0,867 | 0,133 | 0,851 | [0,730; 0,854] |
| K | ja | Konto | nur komplett | 0,769 | 0,122 | 0,881 | 0,084 | 0,762 | — |
| M | ja | WC3-korrekt | nur komplett | 0,797 | 0,149 | 0,860 | 0,049 | 0,859 | [0,664; 0,813] |
| O | ja | Dithering | alle vier | 0,778 | 0,135 | 0,867 | 0,084 | 0,805 | — |

A reproduziert die Basislinie `2cea78c8` auf drei Stellen exakt (0,738 / 0,207 / 0,825 /
0,189), B die Basislinie `d80a2792` davor (0,722 / 0,164 / 0,832 / 0,161), E den Wert aus
PR #944 (0,796 / 0,142 / 0,888 / 0,098). Die Sonde ist deterministisch — alle Unterschiede in
der Tabelle sind Code, nicht Rauschen der Messung; Rauschen des KADERS ist die Spannweite.

**Was die Tabelle sagt:**

- PRD-Konto ist rho-neutral: +0,016 ohne, −0,011 mit Slot-Fix. Beide Bewegungen sind kleiner
  als jede Spannweite. Was PRD-Konto mit Slot-Fix tatsächlich tut, ist die Spannweite zu
  halbieren (0,142 → 0,083) — die Paarungen rücken zusammen, der Median bleibt.
- Kein einziger PRD-Kandidat schlägt E (Slot-Fix, PRD aus) über das Rauschen hinaus. F und M
  liegen bei 0,800/0,797 gegen 0,796 — mit Bootstrap-Intervallen, die E vollständig enthalten.
- **Dithering (N/O) ist der Beleg gegen die P1-These.** Es hält den Korridor exakt (Abschnitt
  5), nimmt die Bernoulli-Streuung je Spieler nahezu vollständig heraus (Treffer je Spieler
  weichen um höchstens 1 von Σp ab) — und rho fällt eher (0,718 / 0,778) als zu steigen. Wenn
  das Entfernen des Würfelrauschens nichts bringt, ist das Würfelrauschen nicht der Engpass.
  Die Verlässlichkeit von 0,80 mit Slot-Fix hängt an etwas anderem: welche Spieler `fkLos`
  je Zug zieht (κ = 3 auf einen Sub-Skill), am Yards-Wurf `(rr()−0,5)·9` je Lauf und
  `lo + rr()·(hi−lo)` je Completion, an der Tier-Wahl. Das sind Zufallsquellen, die den Wert
  eines Spielers verschieben, ohne dass ein Konto sie sieht.
- Die P1-Diagnose („Verlässlichkeit 0,405, die niedrigste der zwanzig") stammte aus PR #803
  (05.09.). Auf `main` vor P1 war sie 0,753, mit Slot-Fix ohne PRD 0,803 — Hockey liegt bei
  0,755. Der Zwei-Spalten-Befund, der PRD begründete, war schon vor P1 überholt; PR #978 hat
  das selbst festgestellt (`:8601-8612`) und trotzdem gebaut.

---

## 5. Korridor je Variante (200 Spiele)

| Var. | Punkte/Team | Completion | Yards/Pass | Sack-Quote | INT-Quote | Fumbles verl. |
|---|---:|---:|---:|---:|---:|---:|
| Ziel | 22,9 | 65,3 % | 7,1 | ~7,0 % | 2,1–2,4 % | ~0,5 |
| A `main` | 13,5 | 65,6 % | 6,30 | 17,5 % | 7,6 % | 1,24 |
| B PRD aus | 16,6 | 65,4 % | 6,88 | 7,0 % | 2,5 % | 0,44 |
| C WC3-korrekt | 16,8 | 63,0 % | 6,73 | 3,3 % | 0,4 % | 0,08 |
| N Dithering | 16,6 | 65,0 % | 6,91 | 6,8 % | 2,4 % | 0,40 |
| D Slot-Fix + Konto | 11,6 | 62,7 % | 5,75 | 18,3 % | 7,3 % | 1,28 |
| E Slot-Fix, PRD aus | 15,2 | 62,6 % | 6,43 | 7,5 % | 2,6 % | 0,37 |
| F Slot-Fix + WC3-korrekt | 13,9 | 59,9 % | 6,19 | 3,6 % | 0,4 % | 0,10 |
| K Slot-Fix + Konto nur komplett | 17,0 | 67,8 % | 7,07 | 7,8 % | 2,6 % | 0,43 |
| M Slot-Fix + WC3 nur komplett | 13,3 | 58,9 % | 5,84 | 7,5 % | 2,6 % | 0,40 |
| O Slot-Fix + Dithering | 15,1 | 61,8 % | 6,44 | 7,1 % | 2,4 % | 0,41 |

Zwei Nebenbefunde:

- **Der Slot-Fix allein verschiebt den Korridor leicht** (B → E: Completion 65,4 → 62,6 %,
  Punkte 16,6 → 15,2). Das ist erwartbar — die Slot-Verteilung ändert die Sub-Skills, gegen die
  `kurve.skillMittel` gefittet ist — und war in PR #944 nicht gemessen. Vor dem Merge einmal
  `node scripts/miss-football-korridor.mjs 200` fahren und die Zahl ins PR schreiben; ein
  Nachfitten von `skillMittel` ist optional, nicht zwingend (die Abweichung ist klein gegen
  das, was der Korridor ohnehin unter dem Ziel liegt: Punkte 16,6 statt 22,9 schon vor allem).
- **K trifft den Korridor von allen Varianten am besten** (Completion 67,8, Yards/Pass 7,07,
  Punkte 17,0), weil die ×1,10-Inflation auf der Completion zufällig genau das Stück nach oben
  schiebt, das der Slot-Fix nach unten drückt — bei rho 0,769. Das ist ein Zufallstreffer,
  kein Argument.

---

## 6. Lösungsvorschläge, bewertet

Randbedingung wie immer: `official-discipline-weights.ts` bleibt unangetastet; keiner der
Vorschläge fasst die Eignungsmatrix, `spielEignung` oder Rezept C an.

### Ansatzpunkt 1 — PRD für Sack/Interception/Fumble zurücknehmen, PR #944 mergen (empfohlen)

Was: `fkPRDTrifft()` an den drei Stellen `:8682`, `:8739`, `:8771` durch das alte `rr()<p`
ersetzen (oder `fkPRDTrifft` selbst für Schlüssel ≠ `komplett:` durchreichen lassen — eine
Zeile). Kommentarblock `:8601-8655` korrigieren: die Erwartungswert-Behauptung streichen, die
Rechnung aus Abschnitt 3.1 hinterlegen. PR #944 auf `main` rebasen und mergen; Basislinie für
Football neu schreiben.

Erwartet: rho je Spiel **0,796** (E) oder 0,769 (K, falls die Completion-PRD bleibt),
Korridor wieder auf dem Stand vor P1 (Sack 7,0–7,8 %, INT 2,5–2,6 %, Fumbles 0,37–0,44).
Ob man die Completion-PRD behält, ist eine Frage der Spannweite (K: 0,122 gegen E: 0,142),
nicht des Medians — und K braucht ein Nachfitten von `kurve.skillMittel`, weil die ×1,10 auf
der Completion sonst bleibt. **Meine Empfehlung: PRD ganz zurücknehmen (E).** Das ist der
einzige Zustand, in dem der Kommentar im Code wieder wahr ist und niemand später ein zweites
Mal über „Erwartungswert bleibt p" stolpert.

Aufwand: klein (drei Aufrufstellen oder eine Zeile, ein Kommentar, ein Rebase, zwei
Messläufe). Risiko: klein — E ist exakt der Stand, den PR #944 schon gemessen hat, und der
Isolationsnachweis für die anderen neunzehn Disziplinen ist derselbe wie dort (Opt-in über
`dId==="football"`). Verifikation: `node scripts/miss-alle-disziplinen.mjs 24` (alle zwanzig),
`node scripts/miss-football-korridor.mjs 200`, `npm run ci:rangtreue-schranke`.

Was es nicht löst: 0,796 ist „knapp", nicht „bestanden". Die Kaderfamilie-Erweiterung auf
acht Paarungen, die `football-balance-runde-nach-e3-15-09.md` Abschnitt 6.3 als Voraussetzung
für das Festlegen der Skala 0,35 nennt, steht weiterhin aus.

### Ansatzpunkt 2 — PRD nur auf der Completion, in WC3-korrekter Form, plus Korridor-Refit

Was: `fkPRDTrifft` nur für `komplett:` aktiv, mit tabellierter/bisektierter Konstante C(p)
statt C = p (Variante M). Dazu `kurve.skillMittel` bzw. `lageBasisFuer` für Football neu
fitten, weil die WC3-Form die Completion um Faktor 0,95 senkt (58,9 % statt 65,3 %).

Erwartet: rho je Spiel 0,797, Verlässlichkeit 0,859 (die höchste aller Varianten), Saison-
Spannweite 0,049 (die engste). Aber: Bootstrap-CI [0,664; 0,813] enthält E vollständig; die
Completion-Kompression bzw. -Spreizung (Abschnitt 3.3) ist ein Effekt auf die Kalibrierung,
den jede spätere Korridor-Runde mitschleppen muss; und die WC3-Form spreizt Eignungsunterschiede
in einem Spiel, statt sie nur zu glätten — das ist eine Wirkung aufs Rezept durch die
Hintertür, die P1 ausdrücklich ausschließen wollte.

Aufwand: mittel (C(p)-Berechnung, Korridor-Refit mit mehreren Messläufen, neue Basislinie).
Risiko: mittel — kein messbarer Gewinn gegen Ansatzpunkt 1, zwei bewegliche Teile mehr.
**Nur dann sinnvoll, wenn Chris PRD als Kampfmodell-Baustein für die Echtzeit-Anzeige
ausdrücklich will** (weniger sichtbare Pechsträhnen beim Zuschauen). Für die Abnahmezahl
bringt es nichts.

### Ansatzpunkt 3 — die tatsächliche Rauschquelle: Lotterie und Yards-Wurf (nächste Runde)

Das Dithering-Ergebnis (N/O) sagt, wo die Verlässlichkeit von ~0,80 wirklich hängt: nicht
im Treffer/Fehlschlag, sondern darin, WER je Zug gezogen wird und WIE VIELE Yards ein Zug
bringt. Drei Kandidaten, nicht gemessen in dieser Runde, in Reihenfolge des vermuteten Hebels:

1. `FK_LOS_KAPPA` (`:8598`, heute 3, „gemessen gegen 2 und 4": 0,687 / 0,714 / 0,688 — auf dem
   Prototyp-Stand VOR dem Slot-Fix). Mit dem Slot-Fix ist die Sub-Skill-Verteilung eine andere;
   die Messung gehört wiederholt, mit 3 / 4 / 5 / 6.
2. Yards-Streuung: `(rr()−0,5)·9` je Lauf (`:8697`, Spannweite 9 Yards um einen Mittelwert von
   4) und `lo + rr()·(hi−lo)` je Completion (`:8782`). Ein Teil davon ist Ereignisdichte, die
   laut CLAUDE.md „fast nie hilft" — aber hier geht es nicht um mehr Ereignisse, sondern um
   weniger Rauschen je Ereignis bei gleichem Mittelwert (z. B. Faktor 6 statt 9, Mittelwert
   unverändert). Das ist eine Kalibrierung, keine Rezeptänderung, und sie ist am Korridor
   direkt messbar (Yards/Carry, Yards/Pass bleiben im Mittel gleich).
3. Kreditvergabe im Boxscore (`feldspielWert`, Hockey-K3-Analog): ob ein Sack dem Passer
   voll angelastet wird, obwohl `pSack` zu 0,0018·Δ aus `PASSSCHUTZ` gegen `ABWEHR_PASS`
   entsteht und der Passer über `PASSGENAUIGKEIT` gezogen wurde — das ist eine Rollenmischung,
   die rho je Spiel kostet, ohne dass sie mit Zufall zu tun hat.

Aufwand: mittel je Kandidat (je ein Parameter, je ein Messlauf à 20 Sekunden — die Sonde ist
schnell genug für eine Rasterung). Risiko: gering, alles football-exklusiv und rückbaubar.
Das ist die Runde, die über 0,80 führen kann; Ansatzpunkt 1 ist ihre Voraussetzung, weil man
auf einem Korridor mit 17 % Sacks nichts kalibrieren sollte.

### Was nicht empfohlen wird

- **Konto über Spiele hinweg persistieren** (würde das Warm-up-Problem der WC3-Form lösen):
  macht Spiele voneinander abhängig, braucht Zustand außerhalb von `fsLive` durch den
  Headless-Runner und den Arena-Host — und die Abnahme fragt ausdrücklich nach EINEM Spiel.
- **PRD-Konto behalten und p nominal herunterskalieren**, bis der Korridor stimmt: das wäre
  die WC3-Konstante unter anderem Namen und scheitert wie C/F am Warm-up.
- **Am Rezept oder an `spielEignung` drehen**, um den Korridor zu reparieren: ausgeschlossen
  per Chris' Regel, und es wäre ein Fit gegen einen Fehler statt gegen die Sache.

---

## 7. Was offen und unsicher bleibt

- **Fünf Paarungen sind zu wenig, um E (0,796), F (0,800) und M (0,797) zu ordnen** — alle
  drei Bootstrap-Intervalle überlappen vollständig. Das ist derselbe Vorbehalt wie in
  `football-balance-runde-nach-e3-15-09.md` Abschnitt 7 und wird durch diese Runde eher
  bestätigt als entkräftet.
- **Die Dithering-Variante hatte je Schlüssel einen zusätzlichen `rr()`-Aufruf beim Anlegen**
  des Kontos (Startphase) — innerhalb Footballs erlaubt, aber es verschiebt Footballs eigene
  Ziehungskette gegenüber A/B. Für den Schluss „Würfelrauschen ist nicht der Engpass" reicht
  das; für eine Produktivvariante müsste man es erneut messen.
- **Ansatzpunkt 3 ist nicht gemessen**, nur aus dem Dithering-Befund abgeleitet. Die
  Reihenfolge der drei Kandidaten ist eine Vermutung.
- **Der Korridor lag schon vor P1 unter dem Ziel** (Punkte 16,6 statt 22,9, Passversuche 25,3
  statt 29,9). Das ist kein Befund dieser Runde und wird durch Ansatzpunkt 1 nicht besser,
  nur nicht schlechter.
- **TDM/Arena-Isolationsnachweis für PR #944** ist laut dessen Commit-Text mit allen zwanzig
  Disziplinen gelaufen; nach dem Rebase auf den heutigen `main` (fünf Tage, u. a. Tennis M2,
  K1-Portraits, A3-Saat) gehört er wiederholt.

---

## Anhang: Reproduzieren

Alles im Scratchpad, kein Repo-File angefasst. `S` ist ein beliebiges Arbeitsverzeichnis.

1. Basis kopieren:
   `cp public/mockups/battle-mode.{html,css,rezepte.js,engine.js} $S/basis/`
2. Slot-Fix als Patch:
   `git diff origin/main...football-balance-runde-16-09 -- public/mockups/battle-mode.engine.js > $S/slotfix.patch`
   und auf eine Kopie: `patch -p3 $S/basis/battle-mode.engine.js < $S/slotfix.patch`
   (zwei Hunks, Offset 785 Zeilen gegenüber dem Branch-Stand).
3. PRD-Varianten: den Funktionskörper von `fkPRDTrifft` (Zeilen `:8656-8661`) textuell
   ersetzen —
   - aus: `function fkPRDTrifft(schluessel,p){ return rr()<p; }`
   - WC3-korrekt: Zähler `n` je Schlüssel, Treffer wenn `rr() < C(p)·n`, `C(p)` per Bisektion
     über `1/Σ_k Π_{j≤k}(1−j·C) = p`, Cache auf drei Nachkommastellen von p.
   - Dithering: Konto startet bei `rr()`, `konto += p`, Treffer wenn `konto ≥ 1`, dann `−1`.
   - nur komplett: `if(schluessel.slice(0,9)!=="komplett:")return rr()<p;` als erste Zeile.
4. Messkopie: `scripts/miss-alle-disziplinen.mjs` nach `$S/mess.mjs` kopieren, drei Zeilen
   ändern — `import ... from "<absoluter Pfad>/node_modules/playwright/index.mjs"`,
   `import ... from "<absoluter Pfad>/scripts/lib/rangtreue-messung.mjs"`,
   `const SEITE = pathToFileURL(process.env.OLY_SEITE).href;` — `WURZEL` fest auf das Repo.
   Dasselbe für `scripts/miss-football-korridor.mjs` nach `$S/korridor.mjs`.
5. Messen: `OLY_SEITE=$S/v/<variante>/battle-mode.html node $S/mess.mjs 24 football`
   (18 s je Lauf), mit `--bootstrap-unsicherheit` für das CI;
   `OLY_SEITE=... node $S/korridor.mjs 200` für den Korridor.
6. Effektive Trefferquoten: `fkPRDTrifft` um `window.__prdLog[typ] = {n, hits, pSum, bins}`
   ergänzen, dann in Playwright `window.__arena.feldspielProbe("football",{n:200,jeSeite:6})`
   und `window.__prdLog` auslesen.
7. Rechnung aus 3.1: `effektiv(p) = 1 / Σ_{k=0..} Π_{j=1..k} max(0, 1 − min(1, j·p))`, in
   zwanzig Zeilen Node nachrechenbar.

Kontrolle, dass die Kopien den echten Stand messen: Variante A muss 0,738 / 0,207 / 0,825 /
0,189 liefern (= `rangtreue-basislinie.json`), Variante B 0,722 / 0,164 / 0,832 / 0,161
(= Basislinie `d80a2792`), Variante E 0,796 / 0,142 / 0,888 / 0,098 (= PR #944). Alle drei
haben heute auf drei Stellen gestimmt.
