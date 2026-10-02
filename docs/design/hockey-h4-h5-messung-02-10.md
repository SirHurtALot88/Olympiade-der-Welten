# Hockey H4/H5(/H2): Rangtreue je Slot-Gruppe, punkte/xg-Sweep, GSAx-Versuch (02.10.)

Task #34, Hockey-Teil, Klasse A laut Fable-Konsultation. Grundlage:
`docs/design/hockey-opus-review-nhl.md` (Abschnitte 2/3.3/4.4/6) und
`docs/pm-briefings/fable-entscheidung-e1-e2-e3-basketball-hockey-football-10-09.md` Abschnitt 2.
H1 (Torwart-Konstanten `HK_TW_REF=0.871`/`HK_TW_BASIS=9.13`) ist bereits auf `main` (PR #769).
H3 (deterministischer Wechselplan/Eiszeit) ist **nicht** Teil dieser Runde — Klasse B/M, braucht Chris.

Kaderfest gemessen, 5 echte Paarungen aus `data/generated/kaderfamilie-live-save.json`, n=48 je
Paarung, über `disziplinProbe()` (nicht `feldspielProbe()` — Begründung Abschnitt 3).

---

## H4 — Rangtreue je Slot-Gruppe (reine Messung, kein Code-Eingriff am Spiel)

`scripts/miss-hockey-rangtreue-je-rolle.mjs`. Gruppiert über das additive `slotId`-Feld, das
`disziplinProbe()`s Feldspiel-Teilnehmerliste jetzt mitführt (dieselbe Bauform wie das bestehende
`torwart`-Feld, Fable-Recherche 3.1/1.1 — kein neuer `rr()`-Aufruf, für jede andere Disziplin
unverändert `null`). Drei Gruppen: Verteidiger (`slotId==="defensivewall"`), Stürmer (die anderen
vier Feld-Slots: powerforward/playmaker/transition/slotfinisher), Torwart (`u.torwart`, die ECHTE
Rollen-Identität aus `bestimmeTorwaerter()` — nicht `slotId==="goaltender"`, weil ohne gesetzte
Aufstellung ohnehin der PARADE-Rückfall entscheidet, Opus-Review 4.3a).

**Struktureller Befund beim Bau des Skripts:** Verteidiger und Torwart stellen je Seite nur EINEN
Platz. Zwei Teilnehmer je Spiel (einer je Seite) lassen keine Rangtreue INNERHALB eines Spiels zu
(Spearman braucht n≥3) — "rho je Spiel" ist für diese zwei Gruppen also nicht definiert, unabhängig
von der Spielzahl. Das Skript druckt deshalb für sie eine **gepoolte Saison-Rangtreue über die
ganze Kader-Familie** (alle distincten Spieler aller 5 Paarungen zusammen, saisonaggregiert,
Schlüssel `<Paarungsindex>:<Name>` gegen Namenskollisionen) statt einer falschen Zahl.

### Ergebnis, n=48, Mutatoren "je-spiel" (Engine-Standard, s. Abschnitt 3 zur Methodik-Wahl)

| Gruppe | Teiln. | rho je Spiel (Median) | Spannweite | rho Saison (Median) | Spannweite |
|---|---:|---:|---:|---:|---:|
| alle 12 | 12 | 0,614 | 0,199 | 0,755 | 0,084 |
| Feldspieler (ohne Torwart) | 12 | 0,692 | 0,171 | 0,804 | 0,161 |
| Stürmer (4 Slots) | 10 | **0,735** | 0,161 | **0,891** | 0,121 |

| Gruppe (nur 1 Platz/Seite) | n (distinct) | rho (gepoolte Saison) |
|---|---:|---:|
| Verteidiger (slotId defensivewall) | 10 | 0,333 |
| Torwart (u.torwart) | 32 | 0,254 |

### Zum Vergleich: dieselbe Messung mit `--mutatoren=aus` (Vor-29.09.-Vergleichsbasis)

| Gruppe | rho je Spiel (Median) | Spannweite | rho Saison (Median) | Spannweite |
|---|---:|---:|---:|---:|
| alle 12 | 0,667 | 0,188 | 0,783 | 0,238 |
| Feldspieler | 0,720 | 0,181 | 0,776 | 0,210 |
| Stürmer | 0,748 | 0,172 | 0,933 | 0,194 |

| Gruppe (1 Platz/Seite) | n | rho (gepoolt) |
|---|---:|---:|
| Verteidiger | 10 | 0,333 |
| Torwart | 28 | 0,375 |

### Lesart

**Stürmer ordnet SEHR gut — besser als "alle 12" und besser als "Feldspieler" insgesamt** (0,735
je Spiel / 0,891 Saison bei "je-spiel"; 0,748/0,933 bei "aus"). H4s Frage ("ordnet die Mechanik
innerhalb einer Rolle richtig, oder nur Rollen?") beantwortet sich für die vier Stürmer-Slots mit
Ja, deutlich. **Verteidiger und Torwart ordnen auf der gepoolten Saison-Skala schwächer** (0,25–0,38)
— das ist aber ein anderer, strengerer Maßstab (gepoolt über nur 10 bzw. ≤32 distincte Spieler,
nicht "je Spiel") und nicht direkt mit der 0,80-Schranke vergleichbar. Für Verteidiger ist die
Zahl zusätzlich strukturell dünn: nur 10 distincte Spieler über die ganze Kader-Familie (ein
einziger Slot je Seite, 5 Paarungen × 2 Seiten).

**Mutator-Effekt sichtbar und erwartungsgemäß:** "je-spiel" liegt überall leicht unter "aus"
(alle 12: 0,614 gegen 0,667; Feldspieler 0,692 gegen 0,720) — der seit dem 29.09. organische
Mutator-Bonus fügt echte, nicht eignungsgebundene Varianz hinzu, genau wie erwartet. Die
Größenordnung der Bewegung (−0,02 bis −0,05) liegt klar innerhalb der Kader-Spannweite.

---

## H5 — Sweep des Verhältnisses punkte/xg in `feldspielWert()` (Hockey)

`scripts/miss-hockey-tor-gewicht-sweep.mjs`. Neue Konstante `HK_TOR_GEWICHT_KONSTANTE=
{punkte:1.5, xg:1.5}` ersetzt die bisherigen Literale 1,5/1,5 in `feldspielWert()` (Hockey-
Feldspielerzweig), plus Messhebel `window.__arena.hockeyTorGewicht(r)` (identisches Muster zu
`mutatorRegel`). Alle fünf Varianten summieren punkte+xg=3,0 (derselbe Erwartungswert einer
Torchance wie bisher).

### Ergebnis, n=48, Mutatoren "je-spiel"

| Verhältnis | rho alle12 (Median) | Spannweite | Saison | rho Feldspieler (Median) | Spannweite | Saison |
|---|---:|---:|---:|---:|---:|---:|
| 1,0 / 2,0 | **0,622** | 0,195 | 0,741 | **0,702** | 0,176 | 0,804 |
| 1,25 / 1,75 | 0,617 | 0,196 | 0,741 | 0,697 | 0,175 | 0,804 |
| 1,5 / 1,5 (aktuell) | 0,614 | 0,199 | 0,755 | 0,692 | 0,171 | 0,804 |
| 1,75 / 1,25 | 0,613 | 0,203 | 0,741 | 0,685 | 0,166 | 0,790 |
| 2,0 / 1,0 | 0,610 | 0,202 | 0,741 | 0,678 | 0,156 | 0,790 |

### Entscheidung: Konstante NICHT geändert

Der Trend ist **monoton und konsistent** über alle fünf Punkte, auf beiden Maßen (alle12 UND
Feldspieler): mehr Gewicht auf `xg` (weniger auf den binären Treffer) hebt rho leicht — exakt die
Richtung, die K3s eigene Begründung (ein Tor ist ein verrauschter Schätzer, `xg` der kalibrierte
Erwartungswert) vorhersagt. Die Bewegung vom aktuellen Wert zum besten gemessenen (1,0/2,0) ist
aber **klein und liegt unter der Kader-Spannweite** (+0,008 alle12, +0,010 Feldspieler, gegen eine
Spannweite von ~0,17–0,20) — nach der Projekt-Faustregel (`docs/design/messgrundlage-kaderfest.md`,
CLAUDE.md) ist eine Bewegung kleiner als die Kader-Spannweite von Null nicht unterscheidbar. Anders
als bei H1 (wo die Feldspieler-Zahl bit-identisch blieb und die GANZE Bewegung nachweislich in den
zwei Torwart-Zeilen saß) gibt es hier keine Isolation, die diesen Vorbehalt aufheben würde — das
ist exakt die "Erwartung ehrlich: klein" aus dem Opus-Review (Abschnitt 3.3), eingetroffen. Die
Konstante bleibt bei 1,5/1,5; der Messhebel (`hockeyTorGewicht`) bleibt im Code für eine künftige
Runde, die das Verhältnis mit einer größeren Kader-Familie oder gegen eine andere Frage noch einmal
prüfen will.

---

## H2 — GSAx statt GSAA für die Torwart-Wertung

`hockeySchussAusgang()` akkumuliert jetzt `tw.xgGegen` — die Summe der torwart-UNABHÄNGIGEN
Torwahrscheinlichkeit (`technik*HK_TOR_SKALA`, **ohne** `paradeFaktor`) jedes Schusses, der den
Torwart erreicht (also nicht geblockt, nicht vorher "vorbei" — derselbe Nenner wie `saves+gegentore`
bei GSAA). Kein neuer `rr()`-Aufruf, keine Verschiebung der bestehenden drei Würfe. `feldspielWert()`
kann über den Messhebel `window.__arena.hockeyTorwartFormel("gsax"|"gsaa"|null)` zwischen
`HK_TW_BASIS + (xgGegen-gegentore)*HK_TW_GSAX_K + ...` (GSAx) und der bisherigen GSAA-Formel
umschalten; Spielkonstante bleibt **"gsaa"** (unverändertes Verhalten). `xgGegen` ist zusätzlich im
`feldspielProbe()`-Output sichtbar (Diagnosefeld, wie `xg`).

### rho je Rolle, n=48, GSAx aktiv (`hockeyTorwartFormel("gsax")`, Mutatoren "je-spiel")

| Gruppe | rho je Spiel (Median) | Spannweite | rho Saison (Median) | Spannweite |
|---|---:|---:|---:|---:|
| alle 12 | 0,606 | 0,141 | 0,755 | 0,273 |
| Feldspieler | 0,692 | 0,171 | 0,804 | 0,161 |
| Stürmer | 0,735 | 0,161 | 0,891 | 0,121 |

| Gruppe (1 Platz/Seite) | n | rho (gepoolt) |
|---|---:|---:|
| Verteidiger | 10 | 0,333 |
| **Torwart** | 32 | **−0,134** |

**Feldspieler/Stürmer/Verteidiger sind bit-identisch zur GSAA-Basismessung** — exakt wie
vorhergesagt: GSAx rührt nur am Torwart-Zweig, keine Zufallsfolge verschoben. Die Torwart-Zahl
selbst ist aber **schlechter, nicht besser**: −0,134 (GSAx) gegen 0,254 (GSAA, dieselbe
"je-spiel"-Messung) bzw. 0,375 (GSAA, "aus"). Die "alle 12"-Zahl bewegt sich dadurch leicht nach
unten (0,606 gegen 0,614), innerhalb der Spannweite.

**Ehrlich gelesen:** Die echte Analytik nennt GSAx "the best goalie stat out there right now" —
aber das gilt für eine ganze NHL-Saison mit tausenden Schüssen, nicht für eine gepoolte Messung
über nur 32 (meist sehr kurz amtierende) Torwart-Identitäten unseres kleinen Kaders. Ohne den
`paradeFaktor`-Dämpfer variiert `xgGegen` stärker mit der zufälligen Schusslage eines Spiels als
mit echter Torwartgüte — bei so wenigen Schüssen je rotierendem Torwart (der Torwart wechselt pro
Spiel, Opus-Review 4.3a) wird daraus mehr Rauschen statt weniger Verzerrung. Das ist dieselbe
strukturelle Grenze, die der Opus-Review selbst für den Torwart-Split nennt (Fangquote stabilisiert
sich real erst nach ~3000 Schüssen).

### Pp-Messung (`messe-arena-einfluss.mjs hockey 48`) — NICHT messbar, dokumentiert statt ignoriert

Sowohl mit GSAA als auch mit GSAx stirbt `messe-arena-einfluss.mjs hockey 48` (2 unabhängige
Saatströme je Formel, insgesamt 4 Versuche) reproduzierbar nach 900s mit
`page.evaluate: Target page, context or browser has been closed` — exakt das in
`docs/design/stand-aller-disziplinen.md` ("Hockey/Breaking/TDM — technischer Nebenbefund")
dokumentierte, VORBESTEHENDE Chromium-Leck, das der Breaking-Fix (PR #1092/B0, nur AudioContext/
Timer) laut demselben Dokument ausdrücklich NICHT behebt ("Hockey und TDM sind von diesem Fix
unberührt — ihr Leck sitzt an anderer Stelle"). Ich habe das Leck nicht selbst gesucht (außerhalb
des Auftrags für diese Runde) — die bestehende Pp-Zwölferzahl (39,4 aus n=6) bleibt damit die
einzige verfügbare Pp-Referenz für Hockey, unverändert durch diesen PR.

### Entscheidung: Spielkonstante bleibt "gsaa"

Ohne eine funktionierende Pp-Messung (dem eigentlichen Zielwert laut Auftrag: "soll nur die
Zwölferzahl heben") und mit einer rho-Messung, die für GSAx schlechter statt besser ausfällt, gibt
es **keine Evidenz, die das Umstellen rechtfertigt**. Die GSAx-Maschinerie (`xgGegen`-Zähler,
`hockeyTorwartFormel`-Messhebel, `HK_TW_GSAX_K`) bleibt additiv im Code für eine künftige Runde,
sobald entweder das Hockey/TDM-Chromium-Leck behoben ist (Pp wird messbar) oder eine größere
Kader-Familie die gepoolte Torwart-Rangtreue weniger verrauscht macht.

---

## Nebenbefund — `feldspielProbe()` zieht Mutatoren nie neu (Messsonden-Fehler, NICHT in diesem PR behoben)

Bestätigt per Code-Lesen (nicht vermutet): `disziplinProbe()` kennt seit dem 29.09.
(MUTATOR ORGANISCH) `opt.mutatoren` ("je-spiel"/"aus"/"fest") und zieht `MUTATOREN` in seiner
Spieleschleife korrekt neu (`zieheMutatorenWieSpiel(...)` je Spiel-Index, mit Sichern/Zurücksetzen
in `finally`). **`feldspielProbe()` hat diesen Umbau nie bekommen** — `zieheMutatoren(` kommt im
gesamten Motor nur in `serieVon()` und `disziplinProbe()` vor, nicht in `feldspielProbe()`. Jede mit
`feldspielProbe()` gefahrene Serie (`scripts/miss-feldspiel-rangtreue.mjs`,
`scripts/miss-rangtreue-nach-rolle.mjs`, jede Hand-Sonde wie die, die H1s 9,13/0,871 lieferte)
vererbt für die GESAMTE Spielserie denselben, beim letzten Seitenladen zufällig gezogenen
Mutator-Zweier, statt ihn je Spiel neu zu ziehen wie im echten Spiel — ein reiner Messsonden-Fehler,
kein Rezeptfehler. Deshalb baut H4 oben bewusst auf `disziplinProbe()` statt auf `feldspielProbe()`
auf. **Der Fix selbst ist nicht Teil dieses PRs** — dafür gibt es eine eigene, separat angelegte
Aufgabe ("Messsonden-Fehler: feldspielProbe() zieht Mutatoren nie neu").

---

## Zusammenfassung Vorher/Nachher

| | Vorher (main) | Nachher (dieser PR) |
|---|---|---|
| H4 (rho je Slot-Gruppe) | nicht gemessen | gemessen, s. oben — reine Diagnose, kein Code-Verhalten geändert |
| H5 (`punkte`/`xg`-Verhältnis) | 1,5/1,5, nie gesweept | 1,5/1,5 **unverändert** (Sweep zeigt kleinen, konsistenten, aber sub-Spannweite-Trend) |
| H2 (Torwart-Formel) | GSAA | GSAA **unverändert** (GSAx-Maschinerie additiv vorhanden, Default unverändert, Pp nicht messbar) |
| `node --check` | — | sauber |
| `npx vitest run` | — | 8201 bestanden / 24 fehlgeschlagen (alle 24 sind `Test timed out`-Fehler in Disziplin-fremden DB/Save/Sponsor/Lineup-Tests auf der stark ausgelasteten Mehr-Agenten-Maschine, keiner berührt `battle-mode.engine.js`/Hockey/Mutator — gezielter Nachlauf der 12 hockey-/mutator-/arena-relevanten Testdateien bei entlasteter Maschine: nur die zwei generischen "kein Zombie-Prozess"-Prozesszahl-Checks (`arena-headless-runner`, `mini-dm-ffa-pod-headless-runner`) schlagen weiterhin fehl, reproduzierbar auch isoliert — sie zählen SYSTEMWEITE Chromium-Prozesse vor/nach dem Lauf und sind in dieser gemeinsam genutzten Umgebung mit mehreren parallelen Agenten-Sessions strukturell nicht deterministisch; `battle-mutator-organisch.test.ts` läuft isoliert 10/10 grün) |

**Motorcode-Diff dieses PRs ändert außer den neuen, standardmäßig inaktiven Messhebeln
(`hockeyTorGewicht`, `hockeyTorwartFormel`, `hockeyTwGsaxK`) und dem additiven `slotId`/`xgGegen`-
Diagnosefeld nichts an bestehendem Spielverhalten** — alle drei neuen/veränderten Konstanten
(`HK_TOR_GEWICHT_KONSTANTE`, `HK_TORWART_FORMEL_KONSTANTE`, `HK_TW_GSAX_K_KONSTANTE`) tragen exakt
die bisherigen Werte.
