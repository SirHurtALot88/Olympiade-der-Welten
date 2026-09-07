# Basislinie-Drift vom 06.09.: neun Disziplinen, zwei Ursachen, keine offene Regression

**Auftrag:** PR #839 fand beim Versuch, `data/generated/rangtreue-basislinie.json` fuer
`gewichtheben` gezielt nachzuziehen, dass ein **voller** Neuzug aller zwanzig Disziplinen NICHT
bit-identisch zur eingecheckten Basislinie zurueckkommt — neun Disziplinen bewegen sich, obwohl
PR #839 an ihrem Code nichts aendert: `takeshis-castle`, `showcase`, `eiskunstlauf`, `breaking`,
`wettessen`, `speed-schach`, `i-spy`, `tennis`, `fechten`. PR #839 liess das bewusst aussen vor
("unverwandte Aenderungen nicht in diesen PR buendeln") und vermutete andere, am 06.09. gemergte
PRs als Ursache. Eine unabhaengige Opus-Review von PR #839 bestaetigte fuer drei der neun
(`showcase`, `speed-schach`, `takeshis-castle`), dass PR #839 selbst bit-identisch misst — die PR
ist also entlastet —, ohne die eigentliche Ursache zu benennen und ohne die restlichen sechs
zu pruefen.

**Ergebnis dieser Untersuchung:** Beide Ursachen sind gefunden, beide sind bereits bekannter,
review-abgenommener Code aus demselben Tag — nicht Rauschen, aber auch keine offene Regression.
Die Basislinie ist fuer alle neun Disziplinen gezielt nachgezogen (dieser PR).

---

## 1. Ausgangspunkt

`data/generated/rangtreue-basislinie.json`, Kopf:

```
"gemessenAm": "2026-09-06T12:46:11.785Z"
```

Der zugehoerige Commit steht im Nachzieh-Commit selbst (`35101308`, PR #816): *"Neu gezogen mit
`node scripts/baue-rangtreue-basislinie.mjs 24` auf dem aktuellen origin/main (**6da7f9f5**, ohne
PR #813)."* `6da7f9f5` ist ein Plan-Commit ohne Motor-Aenderung (2026-09-06T13:12:13+02:00) — die
Messung selbst lief 12:46 UTC (=14:46 CEST), also ein knappes Stueck spaeter auf demselben
Codestand. Nachgemessen: `6da7f9f5` reproduziert alle neun Basislinie-Werte bit-identisch (Tabelle
unten, Spalte "Basislinie"), der Ausgangs-Commit ist damit bestaetigt.

Aktueller Stand (`origin/main`, Ziel dieser Untersuchung): `7fb7c864` (PR #839, Merge dieses
Vormittags).

Elf Commits liegen dazwischen und aendern `public/mockups/battle-mode.engine.js`:

```
6a6554bc #813  Takeshi's Castle komplett (Burgpunkte + Route + Chaos/Outsmart + Kursmischer)
04068529 #817  Wertungstabelle Welle 2
d2ced4fe #818  Speed-Schach/Showcase: Produktivierung Welle 1
101505e8 #827  Endstand-Overlay: Staffel-Teamstand, Takeshi einheitlich burgwertung
85cc520b #830  Spurt: ZEIT_DEHNUNG.spurt gestreckt
e9f84644 #836  Football: Bewegung waehrend des Zugs
3f57a89f #820  Buehne-Spiegelasymmetrie beheben (Fehler #1)
e1ff34a9 #837  Basketball: Viertel-Laenge/Pausenbuzzer
6fc44b52 #838  Speed-Schach: Heim=Weiss/Gast=Schwarz + Sieger-Glow
7fb7c864 #839  Gewichtheben-Ueberholung (PR #839 selbst)
```

Zum Vergleich die vom PR-#839-Autor genannten Kandidaten: **#818, #825, #830, #834, #836, #837,
#838** — **#820 fehlt in dieser Liste**, obwohl es sich (s. Abschnitt 3) als Hauptursache fuer
acht der neun Disziplinen herausstellt. #825 und #834 wurden geprueft und sind sauber
ausgeschlossen: beide sind reine Recherche-Commits (`c747f175`, `f8f88531`) ohne jede Aenderung an
`battle-mode.engine.js` (`git show --stat <sha> -- public/mockups/battle-mode.engine.js` liefert
fuer beide keinen Treffer).

## 2. Messmethode

Alle Zahlen aus `node scripts/miss-alle-disziplinen.mjs 24 <disziplin>` (kaderfest, fuenf
Team-Paarungen aus `data/generated/kaderfamilie-live-save.json`, identische Datei an allen
verglichenen Commits — md5 geprueft). Vier Commits als eigene Git-Worktrees ausgecheckt
(`/tmp/wt-basislinie-drift-baseline` = `6da7f9f5`, `/tmp/wt-pre820` = `e9f84644`, `/tmp/wt-post820`
= `3f57a89f`, `/tmp/wt-post813` = `6a6554bc`), jeweils mit demselben `node_modules`-Symlink und
derselben Kaderfamilie-Datei gemessen. Die Messung ist **deterministisch**: derselbe Commit liefert
in mehreren unabhaengigen Laeufen exakt dieselben vier Zahlen (Median/Spannweite je Spiel und
Saison) — eine Differenz zwischen zwei Commits ist damit ausschliesslich dem Code-Unterschied
zuzuschreiben, nicht Messrauschen. Die "Spannweite" in der Tabelle ist das Kaderrauschen **innerhalb
eines Commits** (Streuung ueber die fuenf Team-Paarungen), nicht die Unsicherheit zwischen zwei
Laeufen — sie taugt hier als Maßstab dafuer, ob eine gemessene Verschiebung *gross* ist, nicht
dafuer, ob sie *real* ist (die Determinismus-Pruefung oben beantwortet das).

## 3. Ergebnis je Disziplin

| Disziplin | Basislinie (6da7f9f5) | Aktuell (7fb7c864) | Δ spielMedian | Spannweite (Basislinie) | Schranke = max(0,05; 0,3×Spannw.) | Innerhalb Schranke? | Ursache |
|---|---:|---:|---:|---:|---:|:---:|---|
| takeshis-castle | 0,886 | 0,861 | −0,025 | 0,073 | 0,05 | ja | PR #813 |
| showcase | 0,880 | 0,892 | +0,012 | 0,140 | 0,05 | ja (Verbesserung) | PR #820 |
| eiskunstlauf | 0,757 | 0,792 | +0,035 | 0,125 | 0,05 | ja (Verbesserung) | PR #820 |
| breaking | 0,801 | 0,804 | +0,003 | 0,114 | 0,05 | ja | PR #820 |
| wettessen | 0,844 | 0,845 | +0,001 | 0,233 | 0,07 | ja | PR #820 |
| speed-schach | 0,889 | 0,908 | +0,019 | 0,060 | 0,05 | ja (Verbesserung) | PR #820 |
| i-spy | 0,692 | 0,684 | −0,008 | 0,384 | 0,115 | ja | PR #820 |
| tennis | 0,814 | 0,786 | −0,028 | 0,176 | 0,053 | ja | PR #820 |
| fechten | 0,840 | 0,816 | −0,024 | 0,230 | 0,069 | ja | PR #820 |

Alle neun Bewegungen liegen unter der jeweiligen Schranke — `scripts/pruefe-rangtreue-schranke.mjs`
waere fuer keine rot gegangen, selbst wenn es gegen die alte Basislinie gelaufen waere (was auch
erklaert, warum PR #839 keinen CI-Ausschlag ausgeloest hat). Das ist aber Zufall der Groessenordnung,
kein Beleg fuer Harmlosigkeit — die Ursache musste trotzdem gefunden werden, weil eine Basislinie,
die nicht mehr den aktuellen Code beschreibt, die Schranken-Pruefung fuer die naechste *echte*
Regression an genau dieser Stelle unschaerfer macht.

Keine der neun Bewegungen ist Rauschen im Sinn von "durch das Messverfahren erzeugt" — jede ist
durch Bisektion exakt einem Commit zugeordnet (Abschnitt 4/5) und deckt sich auf die dritte
Nachkommastelle mit der Zahl, die die verursachende PR selbst in ihrer eigenen Messung angibt.

## 4. Ursache 1 (takeshis-castle): PR #813, vollstaendig im PR selbst dokumentiert

Bisektion: `takeshis-castle` bei `6da7f9f5` (vor #813) = 0,886/0,073/0,951/0,126 — bei `6a6554bc`
(PR #813, direkt nach dem Merge) = **0,861/0,116/0,930/0,056**, exakt der Wert, der seither bis
`7fb7c864` unveraendert steht (auch die "Spannweite je Saison" 0,056 stimmt exakt). Kein Commit
danach (`#816`–`#839`, einschliesslich `#827`, das explizit "Takeshi einheitlich burgwertung" im
Titel traegt) bewegt die Zahl weiter — post-#813 und aktuell sind bitidentisch.

PR #813 ist eine zusammengefasste Serie (deckt #810, #811, #812 ab) und dokumentiert die Bewegung
in ihrer eigenen Squash-Commit-Message vollstaendig und mehrfach nachgemessen:

- Burgpunkte-Formel (`W4`) ersetzt in `MOTOREN["takeshis-castle"].wert()` die reine
  Zieleinlauf-Platzierung — eine bewusste, im Plan-Dokument
  (`docs/design/takeshi-schlammroute-plan-06-09.md`) vorhergesagte Rezeptaenderung, keine
  Nebenwirkung.
- "gehaerteter Kursmischer": ein Opus-Review-Fund auf #810 (Kurswahl lief ueber einen einzelnen
  LCG-Schritt, benachbarte Saaten wählten zu 99,88 % denselben Kurs statt gleichverteilt 33,33 %)
  ist behoben — ebenfalls eine gewollte Korrektur.
- Chaos/Outsmart-Mechanik (Rempler im Fallenfenster, Gedraenge, TECHNIK-gegen-WUCHT-Ausweichen)
  aus Chris' Auftrag vom 06.09., mit Alternativen verworfen ("Nerven-Kosten fuer Rempler" senkte
  rho auf Saisonebene, "TECHNIK-Bonus auf jeder Falle" senkte rho je Spiel — beide bewusst nicht
  gesetzt).
- Der PR nennt die finale, ausgelieferte Zahl explizit im letzten Squash-Abschnitt: *"ABNAHME
  (node scripts/miss-alle-disziplinen.mjs 24, kaderfest ueber fuenf Paarungen): Takeshi's Castle
  0,861 / Spannweite 0,116 / Saison 0,930 — bestanden."* — identisch mit der hier unabhaengig
  nachgemessenen Zahl.

**Einordnung: Fall (a), akzeptierte, bereits (auch Opus-)review-gepruefte Aenderung.** Die
Basislinie war explizit "ohne PR #813" gezogen (s. Abschnitt 1) — der Nachzug fuer diese Disziplin
ist damit keine nachtraegliche Genehmigung, sondern das Nachholen eines Schritts, der beim
Basislinie-Bau vom 06.09. bewusst ausgelassen wurde.

## 5. Ursache 2 (acht Buehnen-Disziplinen): PR #820, Spiegelasymmetrie in `bauBuehne()`

Bisektion: alle acht `showcase`/`eiskunstlauf`/`breaking`/`wettessen`/`speed-schach`/`i-spy`/
`tennis`/`fechten` messen bei `e9f84644` (unmittelbar VOR #820, sechs Commits nach der Basislinie)
noch **bitidentisch zur Basislinie** — keiner der Commits #813/#816/#817/#818/#827/#830/#836 bewegt
auch nur eine der neun Zahlen. Bei `3f57a89f` (PR #820, unmittelbar NACH dem Merge) liegen alle acht
exakt auf dem Stand von `7fb7c864` (aktuell) — kein Commit danach (#837, #838, #839) bewegt sie
weiter.

Der Fund und Fix steht im Diff von `3f57a89f` an `bauBuehne()`
(`public/mockups/battle-mode.engine.js`, Zeile ~10646):

```diff
-    const gegner=OPP.slice(0,n);
+    const gastGesetzt=OPP.filter(p=>place[p.n]&&place[p.n].d===buehneDisc);
+    const gegner=(gastGesetzt.length?gastGesetzt:OPP).slice(0,n);
...
-    const setz=(p,seite,istGegner,idx)=>{
-      const sl=istGegner?null:slotFuer(p,idx);
+    const setz=(p,seite,idx)=>{
+      const sl=slotFuer(p,idx);
       const engP=sl?slotAufschlag(p,sl,buehneDisc):0;
-      const breitP=formVon(p.n)+(istGegner?0:stufenWert());
+      const breitP=formVon(p.n)+stufenWert();
```

Vor dem Fix bekam die Gastseite ueber `istGegner` weder Slot-Aufschlag noch Stufenwert, und ihre
tatsaechliche Aufstellung wurde nie gelesen (`OPP.slice(0,n)` statt der echten `place`-Zuordnung).
Das ist derselbe "Fehler #1" aus `docs/BATTLE_ARENA_UEBERGABE.md`, der in Kampf-/Bahn-/
Feldspiel-Chassis bereits frueher behoben worden war, in `bauBuehne()` aber uebersehen wurde — ein
Opus-Review-Fund auf PR #818, in PR #820 behoben. Die PR selbst benennt die Reichweite explizit:
*"Betrifft alle neun Buehnen-Disziplinen"* (die neun `chassis:"buehne"`-Eintraege — acht davon in
dieser Untersuchung, die neunte ist `gewichtheben`, das PR #839 bereits gezielt nachgezogen hat).

Verifiziert im PR selbst: eigener Spiegeltest (`scripts/miss-arena-buehne-spiegel.mjs`, 60–300
Spiele je Disziplin) zeigt Showcase/Speed-Schach nahe 50:50 nach dem Fix, vorher massiv gastlastig
(Showcase 36:84 Heim:Gast-Siege, Speed-Schach −10,5 % Rohwertabweichung), plus
`pruefe-rangtreue-schranke.mjs` gegen die (damals noch alte) Basislinie: alle 20 Disziplinen "ok".
Eine Opus-Review auf PR #820 fand zwei kleinere Nachtraege (Kommentar-Richtung korrigiert,
`gewichtheben-pps-referenz.json` neu gezogen) — keiner davon bewegt eine Rangtreue-Zahl.

**Einordnung: Fall (a), akzeptierte, Opus-review-gepruefte Bugfix-Aenderung mit dokumentiert
absichtlicher Breitenwirkung.** Bemerkenswert: der Fix ist kein reiner "mehr rho"-Gewinn — er
korrigiert eine strukturelle Asymmetrie, und deren Wegfall wirkt je Disziplin unterschiedlich
(showcase/eiskunstlauf/speed-schach steigen, tennis/fechten/i-spy fallen leicht, breaking/wettessen
kaum). Das ist erwartbar fuer einen reinen Korrektheits-Fix ohne Ziel-Richtung, keine Auffaelligkeit.

## 6. Ausgeschlossene Kandidaten

| PR | Aendert engine.js? | Ergebnis |
|---|---|---|
| #818 (Speed-Schach/Showcase Welle 1) | ja | Eigene Messung im PR: "Speed-Schach 0,889, Showcase 0,880 — unveraendert" gegenueber dem PM-Briefing-Stand (identisch mit der Basislinie). Durch Bisektion (Abschnitt 5) zusaetzlich bestaetigt: bei `e9f84644`, sechs Commits nach #818, sind beide noch bitidentisch. |
| #825 (Gewichtheben-Reihenfolge, Recherche) | **nein** | Reiner Recherche-Commit (`c747f175`), kein Treffer in `git show --stat -- public/mockups/battle-mode.engine.js`. |
| #827 (Endstand-Overlay/Burgwertung) | ja | Bisektion zeigt: takeshis-castle bei `6a6554bc` (nach #813, vor #827) = aktueller Wert = Basislinie nach #813 — #827 bewegt trotz "Takeshi einheitlich burgwertung" im Titel keine Zahl weiter. |
| #830 (Spurt ZEIT_DEHNUNG) | ja, aber nur `ZEIT_DEHNUNG.spurt` | Betrifft nicht `bauBuehne()`/`bauBahn()`, keine der neun betroffenen Disziplinen liest diesen Eintrag; durch die Bisektions-Kette in Abschnitt 5 ohnehin ausgeschlossen (liegt zwischen #827 und #836, alle acht Buehnen-Disziplinen bleiben dort bitidentisch). |
| #834 (Basketball Fokus-Doppeln, Recherche) | **nein** | Reiner Recherche-Commit (`f8f88531`), kein Treffer in `git show --stat -- public/mockups/battle-mode.engine.js`. |
| #836 (Football-Bewegung) | ja, nur Football-Pfad | Durch Bisektion ausgeschlossen: `e9f84644` (= nach #836) misst fuer alle acht Buehnen-Disziplinen noch bitidentisch zur Basislinie. |
| #837 (Basketball Viertel) | ja, nur Basketball/Feldspiel-Pfad | Liegt nach #820; da `3f57a89f` (nach #820, vor #837) bereits exakt den aktuellen Wert aller acht Disziplinen zeigt, kann #837 keine weitere Bewegung beigetragen haben. |
| #838 (Speed-Schach Farben/Sieger-Glow) | ja, nur Speed-Schach-Zeichenpfad | Rein zeichnerisch (Brettfarbe, Sieger-Glow); `speed-schach` bei `3f57a89f` (vor #838) = 0,908, identisch zum aktuellen Stand nach #838. |
| #839 (Gewichtheben-Ueberholung) | ja, nur Gewichtheben-Pfad + `feldspielDisc`-Reset | Bereits durch die unabhaengige Opus-Review auf PR #839 fuer showcase/speed-schach/takeshis-castle als bitidentisch bestaetigt; hier fuer alle neun bestaetigt. |

## 7. Nebenfund (kein Regressionsfall, aber relevant fuer die Abnahme-Doku)

`tennis` faellt durch den #820-Fix von 0,814 (Status "bestanden", >0,80) auf 0,786 (Status "knapp",
<0,80) — eine reale Verschlechterung des rohen Abnahme-Werts als Folge eines *korrekten* Bugfixes,
nicht dessen Nebenwirkung im schlechten Sinn: die Symmetrie war vorher kaputt und zufaellig
guenstig fuer Tennis. `docs/design/stand-aller-disziplinen.md` traegt fuer Tennis vermutlich noch
den alten ">0,80"-Stand und sollte bei naechster Gelegenheit nachgezogen werden — das ist eine
Doku-Pflege, keine Code-Regression, und bewusst nicht Teil dieses PRs (gleiche Begruendung wie PR
#839: unverwandte Aenderungen nicht buendeln).

## 8. Fazit

Keine der neun Disziplinen zeigt eine unerklaerte oder unerwuenschte Bewegung — Fall (b) tritt in
keinem der neun Faelle ein. Alle neun sind Fall (a): bereits gemergter, fuer PRODUKTIONSCODE mit
"besonderer Review-Sorgfalt" bzw. Opus-Review abgenommener Code, dessen Wirkung auf die
Buehnen-/Bahn-Rangtreue in der jeweiligen PR selbst schon beziffert war. Die Basislinie war lediglich
nicht nachgezogen. Dieser PR zieht sie fuer alle neun nach (`data/generated/rangtreue-basislinie.json`,
Werte s. Tabelle in Abschnitt 3); `gemessenAm` und alle anderen Eintraege bleiben unveraendert
(gleiches Vorgehen wie PR #839 fuer `gewichtheben` — gezieltes Nachziehen per Hand, nicht per
vollem `baue-rangtreue-basislinie.mjs`-Lauf, der die uebrigen elf Eintraege sonst geloescht haette).
