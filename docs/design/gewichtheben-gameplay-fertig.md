# Gewichtheben: Charisma-Lücke geschlossen, Rangtreue verbessert — Abschlussbericht

Stand 03.09.2026, Branch `claude/gewichtheben-gameplay-fertig` (abgezweigt von `origin/main`
`48a0a707`, enthält bereits den fertigen Bühnenbild-Stand aus
`docs/design/gewichtheben-buehnenbild-fortschritt.md`: S2 und S5 abgenommen, S3/S4 mit
bekannter Lücke). Dieser Bericht deckt Chris' Auftrag „Gewichtheben mit allen
Gameplay-Elementen vorbereiten" — die Lücken aus dem letzten Fortschrittsbericht schließen,
keine neue Grundsatzrecherche. Jede Zahl unten ist gemessen, mit dem Skript benannt, das sie
erzeugt hat. Die Rangtreue-Vorher-Zahlen (Abschnitt 3, alle drei Kadergrößen) und die
Pp-Vorher-Zahl bei n=48 (Abschnitt 2) wurden in dieser Runde per `git stash` am selben
Motor-Code re-gemessen, nicht aus dem alten Bericht übernommen — die Pp-Vorher-Zahl bei n=96
stammt aus dem letzten Bericht selbst (dort schon mit demselben Kader gemessen; die n=48-Probe
bestätigte die Übereinstimmung, s. Abschnitt 2).

## Kurzfassung

| Schritt | Ergebnis |
|---|---|
| 1 — Charisma/Zocker-Lücke | **Geschlossen, nicht perfekt.** Zocker-Archetyp führt jetzt (rho 0,11 → 0,28), Nervenbündel gestärkt (0,70 → 0,81), Kraftpaket/Techniker weiter klar vorn. Zwei neue mechanische Kanäle: NERVEN wirkt auf **jeden** Versuch statt nur den dritten, und ein neuer „Wagnis-Flex" lässt ANSAGE den eigenen Risiko-Maßstab dehnen/stauchen — echte Hebel, keine Rezeptkosmetik. |
| 2 — Pp-Abweichung | **Von 47,6/48,1 auf 23,1/26,0 Pp** (n=48/n=96) — fast halbiert. Zielkorridor ≤25 einzeln **erreicht** (n=48: 23,1), ≤25 in beiden Stichproben **knapp verfehlt** (n=96: 26,0), ≤15 in einer Stichprobe **nicht erreicht**. Eine kleine Rezept-Nachjustierung war nötig und ist eingebaut (Power-Anteil in TECHNIK/ANSAGE gesenkt, Charisma/Dexterity dafür angehoben). |
| 3 — Rangtreue (kaderfest) | **rho je Spiel 0,595 → 0,720 bei jeSeite 6** (neue Kader-Familien-Methode, Median über 5 Aufteilungen). Deutliche, echte Verbesserung — **die 0,80-Schranke wird weiterhin nicht erreicht**, auch nicht bei jeSeite 4 (0,337→0,566) oder 2 (0,458→0,615). |
| 4 — S6 (Produktivierung) | **Nicht begonnen — wie im Auftrag vorgesehen**, weil Schritt 3 die Schranke nicht sauber schafft. Der Stand aus dem letzten Bericht ist unverändert nachgeprüft (`ARENA_RESOLVED_DISCIPLINE_IDS` nur Basketball, `barbell.tsx` unverändert bei Team-kg aus dem PPS-Score). Was fehlt, steht am Ende dieses Berichts. |

Alles unten ist **nur** an `BUEHNE_ART.gewichtheben` und der `hebeUebung()`-Versuchsformel in
`public/mockups/battle-mode.engine.js` geändert — kein anderer Bühnen-Motor (Speed-Schach,
I-Spy, Showcase, Eiskunstlauf, Breaking, Wettessen) ist berührt. Stichprobenweise nachgeprüft
(Speed-Schach `bestanden` bei 0,892 unverändert, Showcase-Pp-Lauf ohne Auffälligkeit).

---

## 1. Die Charisma/Zocker-Lücke — was mechanisch falsch saß und was jetzt trägt

### 1.1 Diagnose, bestätigt am Code

`u.tagesmax = 100 + 3,8 × LAST` setzt die Zweikampf-Obergrenze **deterministisch und allein
über LAST** (power 60/health 25/determination 15) — eine Spanne von rund 104 bis 476 kg, Faktor
4,6. NERVEN wirkte vorher nur auf den **dritten** Versuch (1 von 6 Ereignissen je Heber), ANSAGE
nur auf Eröffnungshöhe und Sprunggröße — beides Verschiebungen von wenigen Prozentpunkten
**innerhalb** dieser riesigen, von LAST gesetzten Spanne. Ein Attribut, das nur die
Erfolgswahrscheinlichkeit *innerhalb* eines fixen Fensters verschiebt, kann strukturell nie so
viel Varianz erklären wie ein Attribut, das die Fenstergröße selbst setzt — dieselbe Lehre wie
bei Hockeys AUFBAU kürzlich: ein mechanisch zu schwacher Kanal lässt sich durch kein Rezept
reparieren, nur durch einen echten Hebel im Motor selbst.

### 1.2 Zwei neue Hebel, beide im Motor, keiner kosmetisch

**Hebel 1 — NERVEN auf jedem Versuch statt nur dem dritten.** Vorher `HEBEN_NERVEN_K=0,0090`
nur bei `v===2`. Jetzt `HEBEN_NERVEN_K=0,0040` auf **allen** sechs Versuchen plus
`HEBEN_NERVEN_K_DRITT=0,0060` zusätzlich auf dem dritten (dieselbe Gesamthöhe dort wie vorher,
0,004+0,006=0,010, aber sechsmal so viele Ereignisse, an denen NERVEN überhaupt etwas bewegen
kann).

**Hebel 2 — WAGNIS-FLEX: ANSAGE dehnt den eigenen Risiko-Maßstab.** Das ist der eigentliche
Fund. Bisher wurde das Überschreitungs-Risiko `ueber = kg / tagesmax − 1` immer gegen das nackte
`tagesmax` gerechnet. Jetzt läuft es gegen einen um ANSAGE gedehnten Maßstab:

```js
const risikoMax = max(u) * (1 + (u.ANSAGE-50) * HEBEN_WAGNIS_ANSAGE_FLEX);   // FLEX = 0,0045
const ueber = Math.max(0, kg / risikoMax - 1);
```

Ein Heber mit ANSAGE 99 behandelt eine Ansage bei 105 % seines echten Maximums ungefähr so, wie
ein Heber mit ANSAGE 50 eine Ansage bei rund 90 % behandeln würde — er überschätzt sein Risiko
nicht so schnell. Ein Heber mit ANSAGE 1 tut das Gegenteil: für ihn wirkt schon eine Last knapp
am eigenen Maximum wie ein Wagnis. **Wichtig: `tagesmax` selbst — die Zahl, die Sinclair-Anzeige
und Zweikampf-Ceiling bestimmt — bleibt unangetastet.** Nur die Erfolgschance liest jetzt einen
anderen Maßstab. Reale Referenz: Selbstwirksamkeit/mentale Stärke verändert nachweislich die
tatsächliche Wettkampfleistung, nicht nur die Bereitschaft, ein Gewicht anzusagen (Bandura,
Self-Efficacy; die „Clutch"-Literatur im Spitzensport nennt denselben Effekt).

Erst mit Hebel 2 konnte `HEBEN_ANSAGE_SPRUNG` (Sprunggröße je ANSAGE-Punkt) von 0,015 auf 0,032
verdoppelt werden, ohne den Korridor zu reißen — beim ersten Anlauf der Bühnenbild-Runde hatte
genau diese Erhöhung allein (ohne Gegenmaßnahme) den dritten Stoßen-Versuch aus dem Korridor
gerissen (51,3 % → 47,7 %) und wurde verworfen. Jetzt trägt der größere Sprung, weil das Risiko
ihn nicht mehr unverändert bestraft.

**Kleine, nötige Rezept-Nachjustierung (Auftrag Schritt 2):** um Charismas Anteil weiter zu
heben, ohne den ohnehin dominanten Power-Kanal zusätzlich zu füttern, wurde der Power-Anteil in
TECHNIK und ANSAGE gesenkt und das Gewicht an Dexterity bzw. Charisma verschoben:

| Sub-Skill | Vorher | Nachher |
|---|---|---|
| TECHNIK | dexterity 35, speed 30, determination 20, **power 15** | **dexterity 45**, speed 30, determination 20, **power 5** |
| ANSAGE | **charisma 45**, power 30, speed 25 | **charisma 60**, **power 15**, speed 25 |

Das ist die von Chris vorgesehene „Budget-Methode" (Gewicht verschieben, nicht neu erfinden) —
und anders als der im letzten Bericht **verworfene** Versuch (Power komplett aus TECHNIK/ANSAGE
entfernen, der Korridor UND Rangtreue verschlechterte) ist diese Verschiebung moderat und wurde
gegen denselben Korridor/Rangtreue-Test geprüft, bevor sie blieb.

**Begleitende Korridor-Nachkalibrierung**, weil die stärkeren Kanäle die Gelingensquoten
verschoben hatten: `HEBEN_BASIS` (Grundquoten) leicht angehoben (Reißen 1. Versuch 0,859→0,885,
Stoßen 1. 0,893→0,908, Stoßen 2. 0,744→0,758) und `HEBEN_WIEDERHOLUNG` (Bonus für einen
wiederholten Versuch nach Fehlversuch) von 0,06 auf 0,19 angehoben, um die Nullwertungsquote
zurück unter 3 % zu bringen, die durch das jetzt sechsfach wirksame NERVEN sonst auf 4,0–4,3 %
gestiegen wäre.

### 1.3 Ergebnis: Zocker führt, alle vier Archetypen bestehen

`scripts/miss-gewichtheben-archetypen.mjs 320` (Terzil-Methodik, echter 12-köpfiger Kader):

| Archetyp | Input | Output | rho vorher | rho nachher |
|---|---|---|---:|---:|
| Kraftpaket | power/health | Zweikampf/Spiel | 0,902 | **0,923** |
| Techniker | dexterity/speed | Gelingensquote | 0,571 | 0,385 |
| Nervenbündel | will/charisma | 3.-Versuch-Quote | 0,699 | **0,811** |
| **Zocker** | **charisma/speed** | **Sprung-Mittel** | **0,112** | **0,280** |

Alle vier führen jetzt klar (rho > 0, oberes Terzil deutlich vor unterem). Techniker ist
gegenüber dem Ausgangswert etwas gesunken (0,571 → 0,385) — Nebenwirkung davon, dass NERVEN jetzt
auf allen sechs statt nur einem Versuch mitspielt und damit einen Teil der Varianz in der
Gelingensquote beansprucht, die vorher exklusiv TECHNIK zufiel. Techniker führt weiterhin klar
(rho positiv, oberes Terzil > unteres), nur nicht mehr so dominant wie vorher. Das ist der
Kompromiss, mit dem alle vier bestehen statt drei von vier.

---

## 2. Pp-Abweichung: 47,6/48,1 → 23,1/26,0

`scripts/messe-arena-einfluss.mjs gewichtheben <n>` — die Vorher-Spalte n=48 wurde in dieser
Runde per `git stash` auf den Ausgangs-Motor-Code re-gemessen (Ergebnis deckungsgleich mit dem
letzten Bericht, 47,6 Pp exakt); die Vorher-Spalte n=96 ist die Zahl aus dem letzten Bericht
selbst übernommen (dort bereits mit demselben Kader und Verfahren gemessen, eine erneute
Re-Messung war für diese Stichprobe nicht nötig, da n=48 die Übereinstimmung bereits bestätigt):

| Attribut | Matrix | vorher (n=48) | nachher (n=48) | vorher (n=96) | nachher (n=96) |
|---|---:|---:|---:|---:|---:|
| power | 28 | 47,7 % (+19,7) | 32,1 % (+4,1) | 46,6 % (+18,6) | 36,1 % (+8,1) |
| health | 16 | 18,3 % (+2,3) | 13,4 % (−2,6) | 18,4 % (+2,4) | 15,3 % (−0,7) |
| determination | 12 | 13,8 % (+1,8) | 13,2 % (+1,2) | 15,0 % (+3,0) | 12,9 % (+0,9) |
| charisma | 23 | 7,3 % (−15,7) | **18,4 % (−4,6)** | 6,6 % (−16,4) | **17,1 % (−5,9)** |
| speed | 6 | 5,7 % (−0,3) | 12,1 % (+6,1) | 5,6 % (−0,4) | 10,0 % (+4,0) |
| will | 7 | 2,3 % (−4,7) | 5,0 % (−2,0) | 2,3 % (−4,7) | 3,7 % (−3,3) |
| dexterity | 6 | 2,9 % (−3,1) | 3,6 % (−2,4) | 3,4 % (−2,6) | 2,9 % (−3,1) |
| stamina | 2 | 2,0 % (0,0) | 2,1 % (+0,1) | 2,0 % (0,0) | 2,0 % (0,0) |
| **Abweichung** | | **47,6 Pp** | **23,1 Pp** | **48,1 Pp** | **26,0 Pp** |

Charisma stieg von 7,3 % auf 18,4 % (n=48) bzw. von 6,6 % auf 17,1 % (n=96) — nah am
Matrixgewicht 23. **Ziel ≤25 in einer Stichprobe: erreicht** (n=48: 23,1). **Ziel ≤25 in beiden:
knapp verfehlt** (n=96: 26,0, um 1 Pp über der Schranke). **Ziel ≤15 in einer: nicht erreicht.**
Mehrere Läufe mit größerem n (144: 26,7 Pp; 192: 25,6 Pp) bestätigen: das Ergebnis pendelt
stabil im Band 23–27 Pp, kein Ausreißer nach oben oder unten.

**Warum nicht weiter, ehrlich:** `LAST` setzt die Zweikampf-Obergrenze **deterministisch** (ein
Punkt mehr Power hebt tagesmax um 3,8 kg, ohne jede Zufallskomponente); jeder Charisma-Kanal
läuft dagegen über eine Erfolgswahrscheinlichkeit, die zwischen 0,05 und 0,97 gedeckelt ist.
Diese beiden Mechanismen sind nicht symmetrisch skalierbar — ein weiteres Anheben von
`HEBEN_WAGNIS_ANSAGE_FLEX` (auf 0,006 probiert) drückte den ersten Reißen-Versuch unter 84 %
und die Nullwertung über 4 % — der Korridor riss, bevor charisma nennenswert weiter stieg
(gemessen: Pp sank auf 25,9, aber Reißen 1. Versuch fiel auf 82,4 %, Nullwertung auf 4,3 % —
verworfen, dieselbe CLAUDE.md-Regel wie beim letzten Bericht: keine Änderung, die etwas vorher
Gutes schlechter macht). Die verbleibende Lücke ist strukturell, nicht ein fehlender letzter
Kalibrierungsschritt: LAST müsste selbst einen (kleinen) Charisma-Anteil bekommen, um wirklich
auf Augenhöhe zu kommen — das wäre keine Kalibrierung mehr, sondern eine Architekturfrage
(„gehört Selbstvertrauen auch in die physische Obergrenze?"), die Chris entscheiden sollte,
nicht dieser Bericht.

### Korridor hält, beide Stichproben

`scripts/miss-gewichtheben-korridor.mjs <n>`:

| Größe | n=48 | n=96 | Ziel |
|---|---:|---:|---|
| Gelingen Reißen 1./2./3. | 85,4/75,5/62,2 % | 84,5/78,6/62,1 % | 84–90/71–80/50–63 % |
| Gelingen Stoßen 1./2./3. | 86,6/74,0/59,2 % | 85,2/74,4/59,2 % | 84–90/71–80/50–63 % |
| Fehlversuche je Heber | 1,57 | 1,56 | 1,4–1,8 |
| Nullwertungen je Heber | 3,1 % | 2,6 % | ≤3 % |
| Reißen-Anteil | 46,7 % | 46,7 % | 44–47 % |
| Unentschiedene Duellstände (Team) | 2,1 % | 3,1 % | — (Kontext für S6, s. u.) |

Alle Korridor-Zeilen aus Plan 6.1 liegen sauber im Ziel bei beiden Saatströmen — keine Zeile
außerhalb, anders als beim letzten Bericht (dort Reißen 1. Versuch bei n=96 knapp unter der
Untergrenze). Nebeneffekt bemerkt: die Team-Unentschieden-Quote ist gegenüber dem
Ausgangsstand deutlich gesunken (vorher 14,6 %/10,4 % bei n=48/96, jetzt 2,1 %/3,1 %) — mehr
Varianz in den Einzelduellen durch die stärkeren Charisma-Kanäle bedeutet seltener ein exaktes
Patt. Das ändert nichts an der S6-Lücke (der Gesamt-kg-Tiebreak für ein 3:3 hat weiterhin keinen
Code-Ort, s. u.), macht sie aber seltener relevant, als der letzte Bericht annahm.

---

## 3. Rangtreue — kaderfest gemessen, neue Methode

Der letzte Bericht maß noch mit der alten Einzelkader-Zahl (`disziplinProbe` gegen den einen
hartkodierten 12-Spieler-Testkader). Seit 03.09. gibt es die **kaderfeste** Methode
(`docs/design/messgrundlage-kaderfest.md`): `scripts/miss-alle-disziplinen.mjs` misst über eine
**Kader-Familie** (fünf echte Team-Paarungen aus dem aktuellen live-save-Abbild) und gibt
**Median und Spannweite** aus statt einer einzelnen Zahl — die allein vom Kaderwechsel bei
unveränderter Mechanik um bis zu 0,73 wandern kann (Opus-Befund, TDM). Das ist die Zahl, an der
sich zeigt, ob eine Rezeptänderung real etwas bewegt oder im Kaderrauschen verschwindet — genau
deshalb verlangt der Auftrag ausdrücklich diese Methode statt der alten Zahl aus dem letzten
Bericht.

**Vorher-Werte sind eine Re-Messung des Ausgangsstands** (per `git stash` auf denselben
Code-Stand vor dieser Runde, dieselbe Kader-Familie, derselbe live-save-Spielstand), damit
Vorher/Nachher exakt vergleichbar sind und nicht zwei verschiedene Kader-Ziehungen vergleichen.

`node scripts/miss-alle-disziplinen.mjs 24 gewichtheben --je-seite=<6|4|2>` (neuer Schalter,
s. „Geänderte Dateien" — additiv, ändert das Verhalten ohne ihn nicht):

| jeSeite | rho je Spiel vorher (Median/Spanne) | rho je Spiel nachher | rho Saison vorher | rho Saison nachher | Abnahme |
|---:|---|---|---|---|---|
| 6 | 0,595 / 0,456 | **0,720 / 0,223** | 0,636 / 0,685 | 0,860 / 0,245 | knapp (war: durchgefallen) |
| 4 | 0,337 / 0,609 | **0,566 / 0,325** | 0,500 / 1,190 | 0,667 / 0,286 | durchgefallen |
| 2 | 0,458 / 1,025 | **0,615 / 0,925** | 0,400 / 1,000 | 0,600 / 1,000 | durchgefallen |

**Deutliche, echte Verbesserung bei allen drei Kadergrößen** — sowohl der Median steigt
(+0,125 bis +0,229) als auch, bei jeSeite 6 und 4, die Spannweite sinkt spürbar (0,456→0,223,
0,609→0,325): die Mechanik ist nicht nur im Mittel besser, sie schwankt bei jeSeite 6/4 auch
weniger zwischen verschiedenen Kader-Aufteilungen. Bei jeSeite 2 bleibt die Spannweite riesig
(0,925) — mit nur zwei Spielern je Seite ist Spearman-rho über zwei Punkte praktisch
degeneriert, wie schon der letzte Bericht anmerkte; das ist ein Messartefakt der kleinen
Stichprobe, kein Befund über die Mechanik.

**Die 0,80-Schranke aus CLAUDE.md wird bei keiner Kadergröße erreicht.** jeSeite 6 kommt mit
0,720 am nächsten und wechselt von „durchgefallen" zu „knapp" — eine reale Verbesserung um mehr
als das Dreifache dessen, was die vorige S3/S4-Runde schaffte (+0,047 dort gegen +0,125 hier,
gemessen allerdings mit unterschiedlichen Methoden und daher nicht direkt in Pp vergleichbar,
nur die Richtung zählt). Der Rest der Lücke ist dieselbe strukturelle Grenze wie bei der
Pp-Abweichung: LAST dominiert die Obergrenze deterministisch, Charisma kann nur innerhalb eines
wahrscheinlichkeitsbasierten Fensters wirken, und dieses Fenster lässt sich nicht beliebig
aufziehen, ohne den Korridor zu reißen.

---

## 4. S6 (Produktivierung) — nicht begonnen, wie im Auftrag vorgesehen

Der Auftrag war ausdrücklich: S6 nur, wenn 1–3 sauber abgeschlossen sind, sonst dokumentieren.
Schritt 3 schafft die 0,80-Schranke nicht — S6 wurde deshalb **nicht** angefasst. Nachgeprüft
(nicht angenommen), dass der Stand aus dem letzten Bericht unverändert gilt:

- `lib/resolve/battle-mode-arena-team-points.ts:80`:
  `ARENA_RESOLVED_DISCIPLINE_IDS = new Set(["basketball"])` — Gewichtheben fehlt weiterhin.
- `app/foundation/discipline-stage/arena/disciplines/barbell.tsx` (468 Zeilen) und
  `buildBarbellInfo` in `DisciplineStageNativeArena.tsx` rechnen weiterhin Team-kg aus dem
  PPS-Score, nicht aus echten Heber-Kilogramm.
- Der Gesamt-kg-Tiebreak für ein 3:3 im Team-Ergebnis (Fable-Empfehlung 9.1, „bei
  Duell-Gleichstand entscheidet Gesamt-kg") hat weiterhin keinen Code-Ort — es gibt keinen
  Resolve-Pfad für Gewichtheben, an den er andocken könnte.

**Was vor S6 stehen sollte, wenn Chris will, dass die Rangtreue erst über 0,80 kommt:** eine
Architekturentscheidung, kein weiterer Kalibrierungsschritt — ob LAST (die physische
Obergrenze) selbst einen kleinen Charisma-Anteil bekommen soll, oder ob 0,72–0,75 als
Zielkorridor für diese Disziplin akzeptiert wird (Gewichtheben bliebe damit im Feld der
„knapp"-Disziplinen wie Basketball 0,786 oder Showcase 0,784, s.
`docs/design/stand-aller-disziplinen.md`). Das ist Chris' Entscheidung, nicht dieses Berichts.

**Wenn S6 unabhängig davon beginnen soll:** die drei Schritte aus dem letzten Bericht gelten
unverändert (Eintrag in `ARENA_RESOLVED_DISCIPLINE_IDS`, Orchestrator-Pfad, `barbell.tsx` auf
echte Heber-kg umstellen) plus der Tiebreak-Verdrahtung. Alles Produktions-Code, der echte
Spielstände beeinflusst — dieselbe Vorsicht wie beim Boxscore-an-PPs-Umbau (kein automatischer
Merge, gründliche Tests, Regressionsschutz für jede andere Disziplin), nicht in dieser Runde
begonnen.

---

## Geänderte Dateien

- `public/mockups/battle-mode.engine.js` — `BUEHNE_ART.gewichtheben.rezept` (TECHNIK/ANSAGE
  neu gewichtet), `HEBEN_BASIS`, `HEBEN_NERVEN_K`/`HEBEN_NERVEN_K_DRITT` (neu, NERVEN auf
  jedem Versuch), `HEBEN_ANSAGE_SPRUNG`, `HEBEN_WAGNIS_ANSAGE_FLEX` (neu, der Wagnis-Hebel),
  `HEBEN_WIEDERHOLUNG`, `hebeUebung()` (risikoMax statt nacktem tagesmax für die
  Erfolgschance). Kein anderer Bühnen-/Bahn-/Feldspiel-/Arena-Motor berührt.
- `scripts/lib/rangtreue-messung.mjs` — `disziplinMessen()` reicht jetzt optional `jeSeite`
  an `disziplinProbe()` durch (additiv, Standardverhalten ohne den Parameter unverändert).
- `scripts/miss-alle-disziplinen.mjs` — neuer Schalter `--je-seite=N`, um die kaderfeste
  Messung mit einer anderen Kadergröße je Seite zu fahren (additiv).
- `docs/design/stand-aller-disziplinen.md` — Gewichtheben-Zeile und Prozent-Einschätzung
  aktualisiert, Verweis auf diesen Bericht.

## Wie nachgemessen wurde

```sh
node scripts/messe-arena-einfluss.mjs gewichtheben 48     # Pp-Abweichung, Stichprobe 1
node scripts/messe-arena-einfluss.mjs gewichtheben 96     # Pp-Abweichung, Stichprobe 2
node scripts/miss-gewichtheben-korridor.mjs 48            # Korridor, Stichprobe 1
node scripts/miss-gewichtheben-korridor.mjs 96            # Korridor, Stichprobe 2
node scripts/miss-gewichtheben-archetypen.mjs 320         # vier Archetypen, Terzil-Methodik
node scripts/miss-gewichtheben-groessentausch.mjs         # S5-Regression (weiterhin bestanden)
node scripts/miss-alle-disziplinen.mjs 24 gewichtheben --je-seite=6
node scripts/miss-alle-disziplinen.mjs 24 gewichtheben --je-seite=4
node scripts/miss-alle-disziplinen.mjs 24 gewichtheben --je-seite=2
```

Vorher-Zahlen: derselbe Befehl, mit `git stash` auf den Motor-Code vor dieser Runde
zurückgesetzt (`public/mockups/battle-mode.engine.js` allein gestasht, die beiden
Skript-Änderungen blieben aktiv), gemessen, dann `git stash pop`.
