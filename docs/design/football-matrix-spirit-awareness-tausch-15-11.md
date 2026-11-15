# Football: echte Matrix-Verschiebung spirit↔awareness probiert und verworfen (15.11.)

Chris hat explizit gefragt, ob — zusaetzlich zu den vier Rezept-Varianten aus
`docs/design/football-rezept-matrix-budget-14-11.md` (alle vier haben nur verteilt, wie das feste
Matrixbudget auf Zellen faellt, NIE das Budget selbst) — eine ECHTE Verschiebung der gesperrten
Eignungsmatrix (`lib/player-generator/official-discipline-weights.ts`) ausprobiert wurde: `spirit`
bei Football senken (25, das groesste Einzelgewicht), `awareness` (11) um denselben Betrag anheben,
unter der am 15.11. dokumentierten Ausgleichspflicht (`docs/design/matrix-ausgleichspflicht-15-11.md`).
Dieses Dokument ist dieser Versuch — gemessen, nicht nur gerechnet.

**Ergebnis vorweg: verworfen.** Beide Pflichtschranken (CLAUDE.md) schlagen schlechter aus als die
Runde-1-Baseline, nicht besser — Pp verletzt die 25er-Schranke auf BEIDEN Saatstroemen, rho bewegt
sich nicht signifikant und die Mechanik wird deutlich instabiler (Spannweiten verdoppelt bis
verdreifacht). Kein Kandidat fuer einen Merge.

## 1. Die Matrix-Aenderung

`lib/player-generator/official-discipline-weights.ts`:

| Attribut | Football vorher | Football nachher | Ausgleichs-Disziplin | vorher | nachher |
|---|---:|---:|---|---:|---:|
| spirit | 25 | **15** (−10) | fechten | 0 | **10** (+10) |
| awareness | 11 | **21** (+10) | fechten | 15 | **5** (−10) |

**EIN einziger Ausgleichspartner (fechten), nicht zwei getrennte** — football und fechten tauschen
spirit/awareness symmetrisch gegeneinander. Das haelt automatisch sowohl die Zeilensummen (jedes
Attribut ueber alle 20 Disziplinen) ALS AUCH die Spaltensumme (=100 Budget-Punkte) JEDER der beiden
beteiligten Disziplinen exakt — ohne eine dritte Disziplin anzufassen. (Ein erster Versuch mit zwei
getrennten Partnern — TDM fuer spirit, Basketball fuer awareness — wurde noch vor der Messung
verworfen: er hielt zwar die Zeilensummen, verletzte aber die SPALTENSUMME der beiden
Ausgleichsdisziplinen selbst, TDM auf 110 hoch, Basketball auf 90 runter. Das war ein eigener Fehler
in diesem Versuch, kein Befund über die Methode — s. Abschnitt 5.)

**Nachgerechnet, exakt** (`node`-Check gegen `officialDisciplineWeightTable`):

```
spirit Zeilensumme:     166 (unveraendert)
awareness Zeilensumme:  167 (unveraendert)
football Spaltensumme:  100 (unveraendert)
fechten Spaltensumme:   100 (unveraendert)
```

**Warum fechten als Partner:** awareness ist dort die Nummer 4 von 8 Attributen (hinter torment 25,
dexterity 20, speed 16) — eine plausible Nebenrolle fuer eine Kuerzung, kein Kernattribut. spirit
stand bei 0 und wird ein kleiner neuer Nebenkanal (Wettkampf-/Kampfgeist im Fechten ist thematisch
nicht abwegig). Fechten wurde in den letzten Wochen nicht aktiv rekalibriert (keine Erwaehnung in
den letzten zehn Nachtraegen von `docs/design/stand-aller-disziplinen.md`) — geringeres Risiko, eine
gerade erst bestandene, fragile Abnahme zu stoeren. **Fechtens eigene Pp/rho-Abnahme wurde in dieser
Runde NICHT neu nachgemessen** — ausserhalb des hier beauftragten Scopes (nur Football + die
Ausgleichszahl selbst), ausdruecklich als offene Lücke vermerkt.

## 2. Was am Rezept angefasst wurde — und was nicht

`scripts/baue-feldspiel-rezept.mjs` hat eine EIGENE, hartkodierte Kopie der Football-Matrix
(`MATRIX.football`), getrennt von `official-discipline-weights.ts` — nur diese Kopie wurde auf die
neuen Werte (`spirit:15, awareness:21`) gesetzt, damit das Sinkhorn-Werkzeug das neue Budget sieht.
`ERLAUBT.football` (welche Zelle welches Attribut ueberhaupt bekommen darf) ist **unveraendert
gegenueber Runde 1** — explizit NICHT erweitert, um die Spaltenseite nicht zusaetzlich zu verwirren.

Die Sondierung (mechanisches Gewicht je Sub-Skill) ist laut Abschnitt 2 des Budget-Dokuments
kompositionsunabhaengig — trotzdem frisch gemessen (`node scripts/sondiere-feldspiel-subskills.mjs
football 24`, 365s) statt die alte Zahl zu uebernehmen, und **bit-identisch** zur dokumentierten
Runde-1-Sondierung bestaetigt (TEAMGEIST 52,7 %, LAUFKRAFT 24,4 %, ABWEHR_LAUF 8,7 %,
PASSGENAUIGKEIT 8,1 %, ABWEHR_PASS 4,9 %, PASSSCHUTZ 1,2 %, Rest 0 %).

Mit der neuen Matrix und derselben Sondierung neu per Sinkhorn gerechnet
(`node scripts/baue-feldspiel-rezept.mjs football <sondierung>`):

| Sub-Skill | Soll-Masse | Ist-Masse (Runde 5) | Differenz | Runde 1 zum Vergleich |
|---|---:|---:|---:|---|
| TEAMGEIST | 51,7 | 33,8 | −17,88 | −3,0 (Runde 1 Restfehler gesamt 11,74) |
| LAUFKRAFT | 23,9 | 15,6 | −8,28 | — |
| ABWEHR_PASS | 4,8 | 12,6 | +7,77 | — |
| ABWEHR_LAUF | 8,5 | 5,6 | −2,95 | — |
| AUSDAUER | 1,0 | 6,0 | +5,02 | — |
| PASSGENAUIGKEIT | 7,9 | 20,8 | +12,84 | — |
| PASSSCHUTZ | 1,2 | 3,1 | +1,90 | — |
| BALLSICHERHEIT | 1,0 | 2,6 | +1,59 | — |

**Groesste Sinkhorn-Abweichung 17,88 Pp — schon auf dem Papier schlechter als Runde 1 (11,74).** Der
Grund ist exakt der in Abschnitt 3a von `football-rezept-matrix-budget-14-11.md` beschriebene
Mechanismus: `awareness` hat nur drei erlaubte Zellen (PASSGENAUIGKEIT, PASSSCHUTZ, ABWEHR_PASS),
alle mechanisch klein. Ein fast verdoppeltes awareness-Budget (11→21) MUSS in diese drei engen
Zellen — mit folgendem Resultat:

```
football:{
    PASSGENAUIGKEIT:{awareness:35,determination:34,will:31},   // Runde 1: awareness:9
    LAUFKRAFT:   {health:66,power:28,spirit:6},                 // Runde 1: spirit:22
    PASSSCHUTZ:  {awareness:35,determination:34,will:31},       // Runde 1: awareness:9
    ABWEHR_PASS: {awareness:100},                                // Runde 1: awareness:100 (unveraendert)
    ABWEHR_LAUF: {health:66,power:28,torment:6},
    BALLSICHERHEIT:{will:100},
    TEAMGEIST:   {torment:46,spirit:42,charisma:12},             // Runde 1: spirit:53
    AUSDAUER:    {stamina:100}
}
```

`awareness` wird in PASSGENAUIGKEIT/PASSSCHUTZ von einer kleinen Minderheit (9 %) zu einer
substanziellen Minderheit/fast-Mehrheit (35 %) — nicht ganz das 81 %/79 %-Extrem aus Runde 3, aber
derselbe Mechanismus, nur schwaecher ausgepraegt. In `battle-mode.engine.js` eingetragen
(`FELDSPIEL_ART.football.rezept`), Runde-1-Fassung im Kommentar daneben dokumentiert fuer einen
schnellen Rollback.

## 3. Gemessen — echter Motor, dieselbe Kaderfamilie wie Runde 1

Kader-Quelle: `data/generated/kaderfamilie-live-save.json` (live-save, "Oly New Game Custom
31.10.2026"), identisch zur Runde-1-Messung. Baseline vorher selbst frisch reproduziert
(`node scripts/messe-arena-einfluss.mjs football 48`): **Pp 18.3, rho 0.525 — bit-identisch** zur
in `football-rezept-matrix-budget-14-11.md` dokumentierten Runde-1-Zahl, inklusive aller acht
Attributabweichungen. Die Messumgebung ist damit als korrekt verifiziert, bevor irgendetwas
veraendert wurde.

| | Baseline (Runde 1) | Runde 5 (spirit↓/awareness↑, echte Matrix) |
|---|---:|---:|
| **Pp, Saatstrom 0** | 18,3 | **33,7** |
| **Pp, Saatstrom +10 000 000** | — (nicht dokumentiert) | **26,8** |
| **Pp Mittel (2 Stroeme)** | 18,3 (1 Strom) | **≈30,3** |
| rho je Spiel (Median, n=48) | 0,525 | **0,500** |
| Spannweite je Spiel | 0,206 | **0,390** |
| rho Saison (Median) | 0,685 | **0,559** |
| Spannweite Saison | 0,280 | **0,608** |

**Pp-Pflichtschranke (≤25) auf BEIDEN unabhaengigen Saatstroemen verletzt** (33,7 und 26,8) — nicht
knapp, deutlich. Attributtabelle Strom 0:

| Attribut | Anteil | Matrix | Differenz |
|---|---:|---:|---:|
| torment | 21,8 % | 16 | +5,8 |
| spirit | 21,5 % | 15 | +6,5 |
| awareness | 19,0 % | 21 | −2,0 |
| health | 17,5 % | 14 | +3,5 |
| power | 6,3 % | 6 | +0,3 |
| determination | 5,4 % | 8 | −2,6 |
| charisma | 4,7 % | 4 | +0,7 |
| will | 3,7 % | 10 | −6,3 |
| stamina | 0 % | 6 | −6,0 |

Strom +10 000 000 zeigt dasselbe Muster (spirit +6,2, torment +4,6, awareness −2,5, will −3,2,
stamina −6,0) — reproduzierbar, kein Ausreisser eines einzelnen Saatstroms.

**rho bewegt sich NICHT signifikant — und die Mechanik wird deutlich instabiler.** 0,500 gegen
0,525 liegt innerhalb der eigenen Spannweite (0,390) locker im Rauschen; wenn überhaupt, ist der
Punktschaetzer leicht schlechter, nicht besser. Auffaelliger ist die Spannweite selbst: sowohl
Einzelspiel- (0,206→0,390, fast verdoppelt) als auch Saison-Spannweite (0,280→0,608, mehr als
verdoppelt) wachsen stark — fast exakt die Grossenordnung (0,608), die Runde 3 im Budget-Dokument
bei einer anderen Mehrheits-Verschiebung (TEAMGEIST als Receiver-Los) schon einmal als Zeichen einer
"kaderabhaengig instabilen Mechanik" gemessen hatte.

## 4. Einordnung

Dieselbe strukturelle Erklaerung wie in Abschnitt 3a/5c von `football-rezept-matrix-budget-14-11.md`
— nur diesmal ueber die ECHTE Matrix statt nur das Rezept bestaetigt: `awareness` hat in der
Football-Mechanik nur drei kleine, mechanisch schwache Zellen zur Verfuegung. Egal ob man ihm per
Rezept (Runde 3/4b) oder per echter Matrix-Verschiebung (diese Runde) mehr Budget gibt — in beiden
Faellen wird es in diesen engen Zellen zur (fast-)Mehrheit, und die nichtlineare `fkLos()`-Lotterie
(`FK_LOS_KAPPA=3,4`) verstaerkt genau diesen Effekt ueberproportional. Das zusaetzliche Budget
verschwindet nicht einfach — es destabilisiert die Mechanik (Spannweiten) und verschlechtert Pp,
ohne rho spuerbar zu heben. Die Vermutung aus dem Auftrag — "awareness deutet am ehesten auf eine
Verbesserung hin" (abgeleitet aus Runde 4b, +0,053 rho, selbst dort schon als nicht abgesichert
markiert) — bestaetigt sich bei der echten Matrix-Verschiebung NICHT; wenn ueberhaupt, zeigt dieser
staerkere, direktere Hebel ein klareres NEIN als der schwaechere Rezept-Hebel aus Runde 4b.

**Das ist jetzt der FUeNFTE unabhaengige Hebel** (nach drei Spaltenseiten-Varianten und einem
Kappa-Sweep in `football-rezept-matrix-budget-14-11.md`), der keine Verbesserung bringt — und der
erste, der tatsaechlich die gesperrte Matrix selbst bewegt hat, nicht nur das Rezept. Das Ergebnis
staerkt die in Abschnitt 5c jenes Dokuments formulierte Einordnung: die 0,50–0,58-Bandbreite sieht
nach einer STRUKTURELLEN Grenze aus, die aus der Kombination "spirit muss ueberwiegend in
TEAMGEIST/LAUFKRAFT landen" + "awarenesss einzige Zellen sind klein und schwach" + "fkLos() uebertreibt
Mehrheiten" folgt — nicht nach einem noch unausprobierten Hebel.

## 5. Methodischer Hinweis: zwei Spaltensummen gleichzeitig pruefen

Beim ersten Versuch dieser Runde (zwei getrennte Ausgleichspartner: TDM fuer spirit, Basketball fuer
awareness) wurde nur die ROW-Summe (Zeilensumme je Attribut) nachgerechnet, nicht aber die
SPALTENSUMME der beiden Ausgleichsdisziplinen selbst — TDMs eigene Spaltensumme stieg dadurch
unbemerkt auf 110, Basketballs fiel auf 90. Der Fehler wurde vor jeder Messung entdeckt (Node-Skript
gegen `officialDisciplineWeightTable`, das beide Summen zugleich prueft) und durch den oben
beschriebenen EINEN symmetrischen Tausch (football↔fechten) ersetzt, der beide Invarianten
automatisch haelt. Fuer kuenftige Matrix-Ausnahmen mit zwei verschobenen Attributen: ein einziger,
symmetrischer Tauschpartner ist einfacher korrekt zu halten als zwei unabhaengige Einzel-Partner.

## 6. Empfehlung

**Nicht mergen.** Pp verletzt die Pflichtschranke auf beiden Stroemen deutlich, rho bewegt sich
nicht signifikant, und die Mechanik wird instabiler. Dieser Branch dokumentiert den Versuch
vollstaendig (inkl. Rollback-Kommentaren direkt im Code), bleibt aber im Draft-Status — die
Optionen aus Abschnitt 6 von `football-rezept-matrix-budget-14-11.md` (rho-Ausnahme fuer Football
beantragen, oder Football vorerst auf der PPS-Bruecke lassen) bleiben unveraendert die
naheliegendsten naechsten Schritte.

## Quellen

- `docs/design/football-rezept-matrix-budget-14-11.md` (Runden 1–4, Baseline-Zahlen).
- `docs/design/matrix-ausgleichspflicht-15-11.md` (Ausgleichspflicht-Verfahren).
- `docs/design/matrix-backups/official-discipline-weights-ursprungsstand-15-11.ts` (Ursprungsstand
  vor dieser und jeder weiteren Matrix-Ausnahme).
- Eigene Messungen (15.11.): `node scripts/messe-arena-einfluss.mjs football 48` [+ `--saat-
  versatz=10000000`], `node scripts/miss-alle-disziplinen.mjs 48 football`,
  `node scripts/sondiere-feldspiel-subskills.mjs football 24`, `node scripts/
  baue-feldspiel-rezept.mjs football <sondierung>` — Kaderfamilie "Oly New Game Custom
  31.10.2026", identisch zu Runde 1.
