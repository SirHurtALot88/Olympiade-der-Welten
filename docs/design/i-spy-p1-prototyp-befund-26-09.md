# I-Spy P1 "Spur statt Los" — PR-0-Prototyp: ehrlicher Befund (26.09.)

**Ergebnis vorweg: P1 fällt beim Abbruchkriterium durch.** Der Prototyp wurde vollständig gebaut,
mehrfach kalibriert und kaderfest gemessen — keine der drei Bedingungen aus dem Konzeptreview
(`docs/design/i-spy-opus-konzeptreview-26-09.md`, Abschnitt 6, PR 0) wurde erreicht, in der besten
gefundenen Kalibrierung liegt das Ergebnis klar darunter, nicht knapp daneben. Am Motor
(`public/mockups/battle-mode.engine.js`) wurde **nichts committet** — der Prototyp lief in dieser
isolierten Worktree/Branch (`i-spy-spur-statt-los-26-09`) an einer direkt gepatchten Kopie der
Datei, die danach vollständig auf den `main`-Stand zurückgesetzt wurde (`git checkout --`). Der
Ist-Stand (rho je Spiel 0,756, Saison 0,909) bleibt unverändert und ist weiterhin besser als jeder
gemessene P1-Stand.

## 0. Auftrag und Abbruchkriterium

Konzeptreview Abschnitt 6 (PR 0): *"Median ≥ 0,78 UND paarweise besser in ≥ 4 von 5 Paarungen UND
Star auf Rang 1 ≥ 47,5 %. Wird das verfehlt, fällt P1."* Gemessen wird kaderfest über die
Kader-Familie aus `data/generated/kaderfamilie-live-save.json` (fünf echte Team-Paarungen aus dem
aktuellen live-save-Abbild), mit `scripts/miss-alle-disziplinen.mjs`/`miss-star-paartreue.mjs`,
exakt wie in `CLAUDE.md` vorgeschrieben.

## 1. Was gebaut wurde

Vollständige Ersetzung von `ispySeiteTick()`/`baueSchatzsuche()` (PR 1-4) durch das in Abschnitt 4
des Konzeptreviews beschriebene P1:

- **Eigene, personengebundene Spuren.** Jeder Teilnehmer verfolgt zu jedem Zeitpunkt genau eine
  Spur (kein geteilter Zwölf-Truhen-Pool mehr, kein `belegt`, keine Reihenfolge-Kollision).
- **Angesammelter Spürsinn.** `spurwert += SPUERSINN·(0,75+0,5·rr())` je Grabtick; Schwellen
  (`ISPY_SPUR_SCHWELLE`, zuletzt 2:60/3:160 wie im Konzeptreview-Beispiel "80er in zwei Ticks,
  40er in vier") heben die erreichte Stufe (Notiz→Akte→Tresor).
- **Echte Graben-oder-Knacken-Entscheidung.** Jeden Tick, an dem eine Spur mindestens Stufe 1 hat,
  berechnet die KI für jede erreichbare Zielstufe den Erwartungswert je verbleibendem Tick
  (Fundpunkte-Rest + Lösungspunkte·Knackchance, geteilt durch die dafür nötigen Ticks inklusive
  Knackversuch) und wählt das Maximum — **nicht kalibriert, aus dem echten EV abgeleitet**, wie im
  Bauplan verlangt.
- **Zwei Konten.** Fundpunkte (Notiz 4/Akte 10/Tresor 25, ans Finden/SPÜRSINN gebunden, ausgezahlt
  beim Schwellen-Überschreiten, unabhängig vom späteren Knacken) und Lösungspunkte (Notiz 6/Akte
  15/Tresor 35, an den Knack-Sub-Skill gebunden, nur bei Erfolg) ersetzen die alten 55-%-Teilpunkte.
- **Kein Reaktionskanal.** Das Konzeptreview stellt selbst fest, dass die alte Reaktion gemessen
  neutral war (0,757 mit gegen 0,756 ohne) — P1 streicht sie ersatzlos, NERVEN/TEAMGEIST fallen
  aus dem Rezept (beide Attribute-Gruppen bleiben über die verbleibenden fünf Sub-Skills trotzdem
  vollständig abgedeckt).
- **Fester `rr()`-Verbrauch** (Handbuch-Falle 17): exakt 3 Würfe je Teilnehmer je Tick, unabhängig
  von Grab-/Knack-Zweig — identisch zum alten Budget, minus dem entfallenen Reaktionswurf.
- **Keine Interaktion zwischen Spielern/Seiten.** Jede Spur ist vollständig privat; kein Zug wird
  durch fremde Hand genommen oder geschenkt (harte Anforderung erfüllt).

## 2. Was gemessen wurde

Alle Zahlen: `node scripts/miss-alle-disziplinen.mjs <n> i-spy` bzw.
`node scripts/miss-star-paartreue.mjs 24 i-spy`, kaderfest über dieselbe Fünf-Paarungen-Familie wie
der Ist-Stand.

| Variante | n | rho Spiel (Median) | Spannweite | rho Saison (Median) | Spannweite |
|---|---:|---:|---:|---:|---:|
| **Ist-Stand** (zum Vergleich) | 24 | **0,756** | 0,170 | **0,909** | 0,184 |
| P1, Art = `argmax(LOGIK,MENSCHENKENNTNIS,FINGERFERTIGKEIT)` (Konzeptreview wörtlich) | 24 | 0,626 | 0,331 | 0,671 | 0,420 |
| P1, Art-Knackchance = `avg(L,M,F)` statt `argmax` | 24 | 0,689 | 0,171 | 0,776 | 0,294 |
| P1, `avg` + Schwellen 45/120 (statt 60/160) | 24 | 0,659 | 0,190 | 0,811 | 0,182 |
| P1, `avg` + Schwellen 55/150 | 24 | 0,666 | 0,188 | 0,692 | 0,301 |
| P1, `avg` + Schwellen 60/160, **n=48** (Rauschkontrolle) | 48 | 0,669 | 0,184 | 0,713 | 0,287 |
| P1, `avg` + 14 statt 8 Ticks | 24 | 0,664 | 0,175 | 0,769 | 0,168 |
| P1, Fundpunkte 8/20/45 + Lösungspunkte 4/10/25 (SPÜRSINN staerker gewichtet) | 24 | 0,629 | 0,226 | 0,636 | 0,420 |
| P1, Knackchance = `0,5·argmax + 0,5·avg` (Zwischenstufe) | 24 | 0,593 | 0,286 | 0,741 | 0,091 |

**Keine der acht gemessenen Varianten kommt in die Nähe von 0,78 rho je Spiel.** Die höchsten
Einzelwerte (0,689 bzw. 0,701 in einzelnen Paarungen der besten Konfiguration) bleiben unter dem
schwächsten Ist-Stand-Wert der Kader-Familie (0,690). Die Saison-Validität, im Konzeptreview mit
0,86–0,91 grob geschätzt, erreicht in keiner Variante mehr als 0,811 (n=24; bei größerem n, das
Kaderrauschen ausmittelt, fällt sie auf 0,713) — weit unter dem Ist-Stand von 0,909.

### Paarweiser Vergleich, beste gefundene Konfiguration (`avg`, Schwellen 60/160 — die Konzeptreview-Werte wörtlich)

| Kader-Paarung | Ist-Stand rho Spiel | P1 rho Spiel | Besser als Ist-Stand? |
|---|---:|---:|---|
| vigilante-armageddon | 0,860 | 0,689 | Nein |
| coldsteel-direlegion | 0,756 | 0,547 | Nein |
| goldengladiators-silversoldiers | 0,740 | 0,693 | Nein |
| mortalsin-natureswrath | 0,842 | 0,701 | Nein |
| piratecrew-raginglunatics | 0,690 | 0,530 | Nein |

**0 von 5 Paarungen sind besser** — das Abbruchkriterium verlangt mindestens 4 von 5.

### Star- und Paartreue, dieselbe Konfiguration

```
node scripts/miss-star-paartreue.mjs 24 i-spy
Star Rang1 38.3%  Top2 57.5%  Letzter 0.0%  Paartreue(>=15) 91.9% (n=3271)
```

Gefordert: Star Rang1 ≥ 47,5 % (der heutige Ist-Stand-Wert). **38,3 % verfehlt das um 9,2
Prozentpunkte** — deutlich, nicht knapp.

**Alle drei Bedingungen des Abbruchkriteriums sind verfehlt**, nicht nur eine.

## 3. Diagnose: warum P1 die eigene Prognose verfehlt

Das Konzeptreview schätzte die Validität mit 0,86–0,91 (auf Basis des gemessenen "entrauschten
Kerns ohne `belegt`", 0,888) und die Verlässlichkeit mit 0,80–0,88 — beides **Schätzungen, nicht
Messungen**, ausdrücklich mit dem Hinweis, dass PR 0 genau das prüfen muss. Gemessen zeigt sich ein
anderes Bild, mit einer plausiblen Ursache:

1. **Der wörtliche Vorschlag ("Art = die, deren Knack-Sub-Skill am höchsten ist") schneidet die
   Eignungsbreite ab.** `eig` ist eine gewichtete Summe über alle zehn Matrixattribute
   (`BASIS_JE_DISC["i-spy"]`). Ein Spieler, der pro Spiel **nur** seine eine stärkste von drei
   Rätselart-Sub-Skill-Mischungen nutzt, lässt zwei Drittel der ihm eigentlich zur Verfügung
   stehenden Wissens-/Charakter-Attribute komplett ungenutzt. Das ist der Unterschied zum
   Ist-Stand: dort zwingt die Verfügbarkeit geteilter Truhen (`belegt`, begrenzte Fundorte)
   Spieler faktisch dazu, über ein Spiel hinweg mehrere Rätselarten zu bearbeiten — eine
   inzidentelle Durchmischung, die die Korrelation mit der breiten `eig`-Summe stützt, aber nie so
   benannt war. Ohne diesen Zwang (P1 hat keine geteilte Ressource mehr) bricht diese Durchmischung
   weg. Gemessen: reiner `argmax` (Konzeptreview-Wortlaut) → Saison 0,671; derselbe Aufbau mit
   `avg(LOGIK,MENSCHENKENNTNIS,FINGERFERTIGKEIT)` statt `argmax` → Saison 0,776 (+0,105) — die
   größte Einzelbewegung aller getesteten Stellschrauben, und sie bestätigt die Diagnose, hebt sie
   aber nicht über die Schranke.
2. **Weniger, dafür größere Ereignisse verschärfen den bekannten Tausch zwischen Validität und
   Verlässlichkeit, den das Konzeptreview selbst als Kernproblem benennt (Abschnitt 3.3/3.4) —
   P1 verlässt die Tauschkurve nicht, sie verschiebt sich nur.** Ein Tresor-Zyklus bindet über
   mehrere Ticks hinweg dieselbe Spur, bevor ein einziger, binärer Knackwurf (0 oder 35 Punkte)
   entscheidet. Das senkt die Zahl unabhängiger Ereignisse je Spiel gegenüber den acht
   Bernoulli-artigen Zügen des Ist-Stands. Jede getestete Stellschraube (Schwellenhöhe, Tickzahl,
   Punkteverteilung zwischen den beiden Konten) verschob das Verhältnis von Validität zu
   Verlässlichkeit lediglich **auf derselben Kurve** — genau das Muster, das das Konzeptreview für
   den ALTEN Kern beschrieben hat ("Signal und Rauschen sitzen im selben Kanal"), nur mit anderen
   Endpunkten (max. gemessen 0,689/0,776 bzw. 0,659/0,811 statt 0,756/0,909).
3. **Mehr Ereignisse halfen wie erwartet kaum** (14 statt 8 Ticks: 0,664/0,769, kein Sprung über
   die Schranke) — konsistent mit der Hockey-Lehre aus `CLAUDE.md` und mit dem eigenen Befund des
   Konzeptreviews zum Ist-Stand (16 Ticks: +0,011).
4. **Das Konto-Gleichgewicht ist keine freie Stellschraube in die gewünschte Richtung.** Eine
   stärkere Gewichtung der Fundpunkte (die an SPÜRSINN hängen, dem Attribut mit der historisch
   höchsten Einzelkorrelation, r=0,650) verschlechterte das Ergebnis weiter (0,629/0,636) statt es
   zu verbessern — das mechanische Verhältnis zwischen den beiden Konten interagiert nicht linear
   mit der Eignungskorrelation einzelner Attribute.

**Kein Bug im engeren Sinn wurde gefunden.** Die Engine lief in allen acht gemessenen Varianten
ohne Seitenfehler (`pageerror`); das Verhalten ist deterministisch und der erwartete
Monotonie-Test (höheres SPÜRSINN/höherer Sub-Skill → höherer Erwartungswert) hält in einer
isolierten Simulation (`sim.mjs`, nicht Teil dieses Commits) stand. Das Problem liegt in der
**Struktur** — personengebundene Spuren ohne geteilte Ressource entkoppeln den Spielerfolg von der
breiten Zehn-Attribut-Eignungssumme stärker, als das Konzeptreview vor der Messung annehmen
konnte.

## 4. Entscheidung

**P1 wird NICHT in die Produktionsdatei übernommen.** Der Ist-Stand
(`public/mockups/battle-mode.engine.js`, unverändert seit `6b471366`) bleibt die gültige I-Spy-
Mechanik: rho je Spiel 0,756, Saison 0,909, kaderfest gemessen. Das ist besser als jede gemessene
P1-Variante — ein halbfertiger Umbau in die Produktionsdatei zu übernehmen wäre das Gegenteil eines
"guten Stands".

## 5. Was als Nächstes sinnvoll wäre (nicht in diesem PR umgesetzt)

1. **P2 "Slots werden Spielpläne" + Mehrwege im Finden, auf dem BESTEHENDEN Kern, ohne die
   Graben-oder-Knacken-Politik.** Das Konzeptreview selbst nennt das als Rückfallplan (Abschnitt
   6, PR 0-Abbruch: *"P2 wird auf diesen Kern hin neu bewertet (P2 ohne Grabenpolitik, nur
   Nebenwege im Finden)"*). Die Mehrwege-Leitlinie aus `CLAUDE.md` ließe sich auf das SPÜRSINN-Tor
   anwenden (heute ein einziger Weg über intelligence/torment/awareness), ohne den validitätsstarken
   Ist-Stand-Kern (0,909 Saison) anzutasten. Das ist die naheliegendste Folge-PR.
2. **Eine gezielte P1-Variante, die die inzidentelle Durchmischung bewusst nachbaut**, statt sie
   ersatzlos zu streichen — z. B. eine Spur, die nach jedem Knackversuch (Erfolg wie Fehlschlag)
   deterministisch zur NÄCHSTEN Rätselart rotiert (round-robin über die drei Arten nach
   Subskill-Rang), statt immer dieselbe zu wählen. Das würde die unter (1) diagnostizierte
   Attributverengung mindern, ohne echten Zufall neu einzuführen. Nicht mehr geprüft — Zeitbudget
   dieses PR-0-Anlaufs war mit acht gemessenen Varianten ausgeschöpft.
3. **P3 "Ein Fall, zwei Räume"** bleibt orthogonal zum hier gemessenen Problem: Es repariert die
   Reaktion (heute "Theater"), nicht die Validität/Verlässlichkeit des Kerns. Auf dem Ist-Stand
   aufgesetzt, würde es die 0,756-Schranke vermutlich nicht bewegen (die alte Reaktion war bereits
   gemessen neutral, 0,757 gegen 0,756) — es lohnt sich nur als eigenständige Taktik-/Erzählungs-
   verbesserung, nicht als rho-Hebel.
4. **Chris' Entscheidung zur "ehrlicheren Abnahme" aus `CLAUDE.md`** (Star + Paartreue mit
   Abstand statt nackter Rangkorrelation) steht seit dem zweiten Gegencheck offen und wurde vom
   Konzeptreview erneut aufgeworfen (Frage 5). Nach ihr erfüllt der **Ist-Stand** heute 3 von 4
   Bedingungen (Saison-rho 0,909 ✓, Top2 75,8 % ✓, nie Letzter ✓, Paartreue 95,0 % ✓; nur Star
   Rang1 47,5 % gegen 50 % ✗, um 2,5 Punkte) — das ist eine echte Alternative zum Versuch, die
   rohe 0,80-Schranke über einen Konzeptumbau zu erzwingen, der bei diesem ersten Anlauf klar
   gescheitert ist.

## 6. Reproduktion

```sh
git worktree add /tmp/wt-ispy-p1 -b i-spy-spur-statt-los-26-09 origin/main
cd /tmp/wt-ispy-p1
ln -s /home/user/Olympiade-der-Welten/node_modules node_modules   # oder: npm install
node scripts/miss-alle-disziplinen.mjs 24 i-spy      # Ist-Stand-Kontrolle: 0,756/0,909
```

Der P1-Patch selbst wurde nicht committet (s.o.). Die Implementierung folgte exakt Abschnitt 4/6
von `docs/design/i-spy-opus-konzeptreview-26-09.md`; wer sie erneut aufbauen will, findet dort die
vollständige Spezifikation (Formeln, Konten, Politik).
