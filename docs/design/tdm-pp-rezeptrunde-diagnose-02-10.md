# TDM Pp-Kalibrierrunde: Diagnose-Befund, kein Rezept geändert (Task #39, 02.10.)

Auftrag: die in `docs/design/stand-aller-disziplinen.md` dokumentierte TDM-Pp-Abweichung
(51,4/54,2 Pp, **n=2/n=12**, als "VERLETZT, Zahl sehr klein" markiert) zuerst bei n=48 mit zwei
unabhängigen Saatströmen neu messen (Lehre aus dem Gewichtheben-n=24-vs-n=48-Befund,
`docs/design/gewichtheben-pp-regression-befund-27-09.md`), bevor irgendeine Rezeptänderung
versucht wird.

## Ergebnis vorab

**n=48 ist in dieser Runde technisch nicht erreichbar — nicht wegen des dokumentierten
Chromium-Speicherlecks (das ist für TDM inzwischen mitbehoben), sondern wegen eines neuen,
bisher nicht dokumentierten Laufzeit-Blockers: ein einzelner TDM-"Lauf" von `einflussVon()`
kostet in dieser Umgebung ~680–790 Sekunden, macht n=48 über zwei Ströme zu einem
~20-Stunden-Messvorhaben.** Die bestmögliche Messung dieser Runde (n=2 und n=6, zwei Ströme)
zeigt trotzdem ein eindeutiges, robustes Bild: **Pp liegt bei 66–76 Punkten, drei- bis
viermal über der 25-Pp-Schranke, konsistent über alle drei Messungen.** Wichtiger als die Pp-
Zahl: **rho je Spiel liegt bei 0,404 (n=24, Kader-Familie) — eine krasse, seit Monaten
dokumentierte Verletzung der CLAUDE.md-Vorrangregel ("rho vor Pp bei Zielkonflikt").** Der
Code selbst (`ARENA_ART.tdm`-Kommentar, `engine.js:6028-6056`) dokumentiert bereits VIER
vorherige, vollständig durchgeführte und gescheiterte TDM-Rezeptumbauten sowie einen
chassis-weiten Reparaturversuch, der zwar die Pp-Abweichung fast halbierte, aber das Live-
Spiel sichtbar verschlechterte und deshalb zurückgenommen wurde. **Kein Code geändert — dies
ist analog zu PR #1110 (Takeshi) und #1106 (Breaking) ein reines Diagnose-Dokument.**

---

## 1. Der Speicherleck-Status: für TDM ebenfalls behoben, aber ein neuer Blocker ersetzt ihn

`docs/design/stand-aller-disziplinen.md` (Zwölfter Nachtrag, 26.09.) dokumentiert einen
reproduzierbaren Cgroup-OOM-Kill des Chromium-Messprozesses bei TDM/Hockey/Breaking ab
n≥12, bestätigt per `dmesg` bei ~13,5–13,7 GB RSS. Der spätere Fix (Commit `ea10d442`,
„Messwerkzeug: Speicherleck in messe-arena-einfluss.mjs behoben (kein AudioContext im
Messlauf)", 01.10., gemergt über PR „#1092/B0") entfernt `window.AudioContext` per
`addInitScript`, **bevor** die Seite lädt — das ist ein Fix im **gemeinsamen Messskript**
(`scripts/messe-arena-einfluss.mjs` und sein Zwilling `-zweiter-saatstamm.mjs`), nicht in
einem disziplinspezifischen Zweig. Die Commit-Botschaft nennt Breaking als Beispiel (600
`sfx()`-Aufrufe je Spiel), der Fix selbst ist aber unabhängig von der Disziplin.

Nachgemessen in dieser Runde, auf dem aktuellen `origin/main` (`83bfa315`, der den Fix
bereits enthält):

| Lauf | n | Dauer | RSS (Renderer, Spitzenwert beobachtet) | Seitenfehler |
|---|---:|---:|---:|---|
| `messe-arena-einfluss.mjs tdm 2` | 2 | 1363 s | ~420 MB | keine |
| `messe-arena-einfluss.mjs tdm 6` (Strom 1) | 6 | 4738 s | ~520 MB | keine |
| `messe-arena-einfluss-zweiter-saatstamm.mjs tdm 6` (Strom 2) | 6 | 4723 s | ~510 MB | keine |
| `miss-alle-disziplinen.mjs 24 tdm` (rho) | 24 | — | ~290 MB (Summe aller Chrome-Prozesse) | keine |

**Kein Absturz, kein Seitenfehler, RSS bleibt weit unter der 13,5-GB-OOM-Schwelle — auch bei
der rho-Sonde (`miss-alle-disziplinen.mjs`), die den AudioContext-Fix gar nicht eingebaut
hat.** Die Aufgabenstellung vermutete, der Fix habe „NUR Breaking/AudioContext" behoben,
nicht TDM — das ist nach dieser Messung **widerlegt**: TDM profitiert vom selben Fix im
selben Skript, weil beide Disziplinen dieselbe Ton-Schicht (`sfx()`) während der Messung
durchlaufen. Das ursprünglich dokumentierte Speicherleck ist für TDM kein offener Befund
mehr.

### 1.1 Der neue Blocker: Laufzeit, nicht Speicher

Was stattdessen eine n=48-Messung verhindert, ist reine Rechenzeit. Die drei Pp-Läufe oben
sind linear in n: 1363 s / 2 Läufe ≈ 681 s/Lauf; 4738 s / 6 ≈ 790 s/Lauf; 4723 s / 6 ≈ 787
s/Lauf — eine erstaunlich konstante Rate über zwei unabhängige Stichproben, kein Hinweis auf
Umgebungsrauschen (CPU-Auslastung während der Läufe durchgehend ~100–113 % eines Kerns, RSS
stabil statt wachsend). Hochgerechnet auf n=48: **48 × ~785 s ≈ 10,5 Stunden je Saatstrom,
~21 Stunden für zwei unabhängige Ströme** — innerhalb dieser Runde nicht leistbar. Die
`einflussVon()`-Kostenformel (Kommentar im Skript: „(1 + 12 × Teilnehmer) × n Spiele") trifft
bei TDMs `jeSeite:6` (12 Teilnehmer) auf 145 simulierte Kämpfe je Lauf — bei ~5,4 s je Kampf
(aus der gemessenen Gesamtzeit zurückgerechnet) ergibt das die beobachtete Laufzeit. Das ist
vermutlich zusätzlich dadurch verschärft, dass `einflussVon()` seit dem Mutator-organisch-
Umbau (29.09.) **standardmäßig** einen Mutator-Wurf je Lauf zieht (`Mutatoren je-lauf` in der
Ausgabe) — ein Zusatzaufwand, den es zur Zeit der im Skriptkommentar zitierten „zwei Minuten
für n=2" noch nicht gab.

**Einordnung:** Dies ist ein eigener, von der Pp-Zahl unabhängiger Befund für eine künftige
Runde (Messwerkzeug/Performance), hier nur dokumentiert, nicht verfolgt — analog dazu, wie
der Zwölfte Nachtrag das Speicherleck selbst nur dokumentiert, aber nicht behoben hat.

---

## 2. Die Pp-Messung: n=2 und n=6 (zwei Ströme), alle drei weit über der Schranke

Da n=48 nicht erreichbar war, zieht diese Runde die bestmögliche Annäherung: einen
Einzellauf bei n=2 und zwei unabhängige Ströme bei n=6 (Saatversatz 0 und 10 000 000).

| Messung | n | Pp | Dauer |
|---|---:|---:|---:|
| `messe-arena-einfluss.mjs tdm 2` | 2 | **65,9** | 1363 s |
| `messe-arena-einfluss.mjs tdm 6` (Strom 1) | 6 | **69,9** | 4738 s |
| `messe-arena-einfluss-zweiter-saatstamm.mjs tdm 6` (Strom 2) | 6 | **75,8** | 4723 s |
| *(zum Vergleich, Stand-Doku, vor dem Mutator-Umbau)* | *12* | *54,2* | — |

### Attribut-Detail, n=6, beide Ströme

| Attribut | Matrix | Strom 1 (Anteil / Diff) | Strom 2 (Anteil / Diff) |
|---|---:|---:|---:|
| power | 28 | 33,3 % / +5,3 | 34,6 % / +6,6 |
| spirit | 12 | 17,6 % / +5,6 | 1,6 % / -10,4 |
| determination | 6 | 11,9 % / +5,9 | 9,7 % / +3,7 |
| awareness | 2 | 10,7 % / +8,7 | 0 % / -2,0 |
| dexterity | 0 | 9,4 % / +9,4 | 7,0 % / +7,0 |
| stamina | 14 | 8,6 % / -5,4 | 1,9 % / -12,1 |
| charisma | 10 | 6,5 % / -3,5 | 16,3 % / +6,3 |
| torment | 2 | 1,9 % / -0,1 | 5,9 % / +3,9 |
| health | 20 | 0 % / -20,0 | 12,5 % / -7,5 |
| speed | 0 | 0 % / 0,0 | 10,4 % / +10,4 |
| will | 0 | 0 % / 0,0 | 0 % / 0,0 |
| intelligence | 6 | 0 % / -6,0 | 0,1 % / -5,9 |
| **Pp** | | **69,9** | **75,8** |

**Nicht stromstabil im Detail** (z. B. spirit +5,6 gegen -10,4, speed 0,0 gegen +10,4,
charisma -3,5 gegen +6,3) — erwartbar bei n=6 und ein weiteres Argument gegen eine
Kalibrierung auf dieser Stichprobenbasis (vgl. Takeshi-Diagnose #1110, Abschnitt 3: dieselbe
seedabhängige Instabilität der Positiv-Normierung in `einflussVon()`). **Stabil über beide
Ströme und über n=2 hinweg: power bleibt klar überzeichnet (+5,3 bis +6,6 trotz bereits
hohem Matrixgewicht 28), health bleibt klar unterzeichnet (-7,5 bis -20,0 bei Matrixgewicht
20), und zwei Attribute mit Matrixgewicht NULL (dexterity, teilweise speed) lesen durchgehend
einen positiven Anteil.**

**Warum die wahre n=48-Zahl mit hoher Sicherheit nicht niedriger liegt:** Das Messskript
dokumentiert selbst, dass kleines n die Abweichung SYSTEMATISCH zu günstig (zu niedrig)
ausweist (Kommentar in `messe-arena-einfluss.mjs`: „Spurt 40,9 Pp bei n=12 gegen 54,7 Pp bei
n=48"). Alle drei Messungen dieser Runde (65,9/69,9/75,8) liegen bereits weit über der
25-Pp-Schranke, **in der Richtung, die bei größerem n eher noch wächst als schrumpft.** Es
gibt keine plausible Flugbahn, auf der TDM bei n=48 unter 25 Pp fiele.

---

## 3. rho: 0,404 bei n=24 — die eigentlich bindende Verletzung

`node scripts/miss-alle-disziplinen.mjs 24 tdm` (Kader-Familie, 5 echte Team-Paarungen aus
dem live-save-Abbild):

```
Disziplin   Chassis  Teiln.  rho je Spiel (Median)  Spannweite  rho Saison (Median)  Spannweite  Abnahme
tdm         arena    12      0,404                   0,912       0,413                0,916       durchgefallen
```

**rho je Spiel liegt bei 0,404 gegen die CLAUDE.md-Schranke 0,80 — weniger als die Hälfte,
bei einer Kader-Spannweite (0,912), die größer ist als rho selbst.** Das deckt sich mit jeder
früheren TDM-Messung des Projekts: 0,306 (Elfter Nachtrag), 0,404 (29.09., mit Mutator),
0,253/0,165 (`gesamtstand-fertigstellungsgrad-...md`) — TDM war in **keiner** dokumentierten
Messung auch nur annähernd in Reichweite von 0,80.

**CLAUDE.md, Abschnitt „Die Abnahme jeder Disziplin": rho hat ausdrücklich Vorrang vor Pp bei
Zielkonflikt.** Das ist hier kein abstrakter Fall: TDMs rho-Problem ist seit Monaten
dokumentiert (`docs/design/stand-aller-disziplinen.md`, Zwölfter Nachtrag, Abschnitt
„TDM/Mini-DM/Battlefield"): **„Zielwahl ist Geometrie statt Bedrohung, nicht an der Eignung
ausgerichtet"** — die Kampf-KI wählt ihr Ziel nach geometrischer Nähe, nicht danach, wer
eignungsstark ist oder eine Bedrohung darstellt. Das ist ein **Mechanik-Befund über die
Zielwahl-Logik**, kein Gewichtungsproblem der zwölf Attribute — eine Rezeptkalibrierung
(Task #39s eigentlicher Auftrag) kann an dieser Ursache nichts ändern, selbst wenn sie die
Pp-Abweichung vollständig schließen würde. Eine Pp-Reparatur, die rho bei 0,40 beließe, wäre
nach der eigenen Vorrangregel des Projekts kein Erfolg.

---

## 4. Warum Schritt 2 (Rezeptkalibrierung) in dieser Runde nicht sinnvoll ist

Der Auftrag sieht Schritt 2 ausdrücklich nur vor, „falls Schritt 1 eine zuverlässige,
bestätigte Pp-Abweichung >25 zeigt" — das ist hier der Fall (Abschnitt 2). Trotzdem ist eine
neue Kalibrierrunde aus drei voneinander unabhängigen Gründen nicht der richtige nächste
Schritt:

### 4.1 Die Kalibrierung wurde bereits viermal versucht — alle vier scheiterten

`ARENA_ART.tdm` (`engine.js:6028-6056`) trägt bereits die vollständige, unveränderte
Versuchsgeschichte als Kommentar:

> „Vier neue TDM-Rezepte wurden gebaut und gemessen, um die restlichen 54 Pp wegzuarbeiten:
> ein voller Neubau (168 Pp — schlechter), eine gezielte Korrektur der größten Lücken aus der
> Messung (83 Pp — schlechter), und zwei ANG/VER-Sorten, die sich nur in Nuancen
> unterschieden (114,5 und 58,9 Pp bei n=6 — ein Ausschlag, der allein aus der Stichprobe
> kommen konnte). Bei doppeltem n bestätigte sich genau das: die bessere der beiden ANG/VER-
> Sorten lag bei n=12 bei 57,9 Pp — innerhalb der Streuung von REC.power (54,2 Pp), nicht
> darunter. Jeder Umbauversuch war also entweder schlechter oder ununterscheidbar vom
> Nichtstun."

Das ist exakt die Methode, die der Auftrag für diese Runde fordert (mehrere Varianten, ≥2
Saatströme, Prüfung auf Positiv-Normierungs-Artefakte) — bereits durchgeführt, mit
durchgehend negativem Ergebnis. Eine fünfte Variante ohne neue Erkenntnis hinzuzufügen würde
dieselbe, bereits dokumentierte Sackgasse wiederholen.

### 4.2 Der diagnostizierte Kanal-Fehler ist Chassis-Ebene, nicht Rezept-Ebene — und wurde bereits versucht und zurückgenommen

Derselbe Kommentarblock benennt die wahrscheinliche Ursache: `aufEignung()` normiert LP, ANG
und VER proportional zur Eignung, lässt TMP und AUS aber außen vor — ein Attribut, das dort
sitzt (im Standardrezept `REC.power`: Speed 46/Dexterity 24 in TMP, Stamina 52/Determination
26/Power 22 in AUS), kauft sich einen Effekt ERSTER ORDNUNG im Kampf, unabhängig vom
Matrixgewicht. Genau das zeigt auch die Messung dieser Runde (Abschnitt 2): Dexterity (Matrix
0) liest 7–9,4 %, Speed (Matrix 0) liest bis zu 10,4 % in Strom 2.

Der naheliegende Fix — TMP/AUS in `aufEignung()`s Normierung aufnehmen — **wurde bereits
gebaut und gemessen** (Kommentar `engine.js:5954-5973`): Pp fiel von 152,4 auf 83,7, Speed/
Dexterity lasen sauber 0 %. **Am echten Kampf gemessen war das Ergebnis aber das Gegenteil
einer Reparatur:** ein Matchup, das vorher mit gestreuten Ergebnissen 100 % gewann (6:0 neun-,
6:2 fünf-, 6:1 viermal, Rest knapper), gewann danach zu 96 % mit 23 von 24 Kämpfen als 6:0-
Blowout — die Normierung nahm der KI genau die Bewegungsfreiheit, mit der sie ein enges
Match überhaupt zustande bringt. Der Fix wurde **explizit zurückgenommen**, mit der
Begründung, dass er das Spiel verschlechtert, nicht nur eine Zahl verbessert. Das ist also
kein offener Punkt, den diese Runde übersehen hätte — er ist bereits geprüft und bewusst
verworfen worden, und zwar auf einer Ebene (`aufEignung()`, gemeinsamer Arena-Chassis-Code),
die ohnehin außerhalb von „Rezept-Kalibrierung innerhalb bestehender Kanäle" (Task #39s
eigene Klasse-A-Abgrenzung) liegt.

### 4.3 Selbst eine erfolgreiche Pp-Reparatur änderte nichts an der bindenden rho-Verletzung

S. Abschnitt 3: rho liegt bei 0,404, mit einer dokumentierten, von den Attributgewichten
unabhängigen Ursache (Zielwahl-Geometrie). CLAUDE.md ordnet rho ausdrücklich über Pp. Eine
Rezeptrunde, die ausschließlich die Pp-Abweichung angeht, bearbeitet damit nicht die Zahl, an
der die Disziplin nach dem eigenen Maßstab des Projekts hängt.

---

## 5. Nebenbedingung: geteiltes Arena-Chassis — Isolationsnachweis trivial, weil kein Code geändert wurde

TDM teilt `ARENA_ART`/`baueEinheit()`/`behav()`/`aufEignung()`/`stepSim()` mit Mini-DM,
Battlefield (und, vor dem Chassis-Wechsel vom 03.09., Fechten). Jede Rezeptänderung an dieser
Stelle bräuchte einen Isolationsnachweis für die Nachbar-Disziplinen (strukturell oder per
Neumessung) — diese Runde ändert aber **keine einzige Zeile Verhalten** (nur die
Kommentarzeile unten und dieses Dokument), die Nachbardisziplinen sind damit bit-identisch,
ohne dass eine eigene Messung das erst beweisen müsste.

---

## 6. Empfehlung für eine künftige Runde

- **rho zuerst:** die Zielwahl-Logik (Geometrie → Bedrohung/Eignung) ist der Hebel, der laut
  eigener Projektregel vor Pp steht, und der einzige, der TDM überhaupt in Reichweite von
  0,80 bringen könnte. Das ist eine Mechanik-Änderung am Kampf-KI-Code (`stepSim`/Zielwahl),
  nicht am Rezept.
- **Messwerkzeug-Laufzeit:** `einflussVon()` für TDM (und vermutlich Battlefield/Mini-DM,
  dasselbe Chassis) kostet ~785 s je Lauf — ein n=48-Pflichtlauf über zwei Ströme ist damit
  praktisch ein Tagesprojekt. Lohnt sich als eigener, kleiner Auftrag (z. B. `--mutatoren=aus`
  für die Pp-Pflichtprüfung standardmäßig erlauben, um den zusätzlichen Mutator-Wurf-Aufwand
  aus der Messung herauszunehmen, sofern das die Zahl nicht verzerrt — nicht in dieser Runde
  geprüft).
- **Falls doch am Rezept gearbeitet wird:** nicht an `REC.power` direkt (das würde auch Spurt
  mittreffen, `DISCS.spurt.cat` ist ebenfalls `"speed"`, aber Spurt läuft über `BAHN_ART`, nicht
  `ARENA_ART` — zu prüfen, ob `rezeptVon()`s Fallback `REC[(DISCS[dId]||{}).cat]` tatsächlich
  für TDM auf `REC.power` zeigt, weil `ARENA_ART.tdm.rezept` das bereits explizit setzt und
  den Fallback für TDM selbst nie erreicht — der Fallback träfe nur eine neue, noch
  unregistrierte `cat:"power"`-Disziplin). Ein eigenes `ARENA_ART.tdm`-ANG/VER/TMP/AUS-Rezept
  (statt der geteilten `REC.power`) ist der unversuchte Zwischenschritt zwischen „nichts tun"
  und „`aufEignung()` anfassen" — wurde laut Kommentar aber bereits zweimal in Varianten
  gebaut (168/83 Pp) und beide Male verworfen.

## Anhang: Reproduktion

```sh
git worktree add /tmp/wt-tdm-diagnose origin/main --detach
ln -s <repo>/node_modules /tmp/wt-tdm-diagnose/node_modules

node /tmp/wt-tdm-diagnose/scripts/messe-arena-einfluss.mjs tdm 2                        # 65,9 Pp, 1363s
node /tmp/wt-tdm-diagnose/scripts/messe-arena-einfluss.mjs tdm 6                        # 69,9 Pp, 4738s
node /tmp/wt-tdm-diagnose/scripts/messe-arena-einfluss-zweiter-saatstamm.mjs tdm 6      # 75,8 Pp, 4723s
node /tmp/wt-tdm-diagnose/scripts/miss-alle-disziplinen.mjs 24 tdm                      # rho 0,404
```
