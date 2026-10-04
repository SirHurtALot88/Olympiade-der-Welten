# Feldspiel-Rezeptrunde: F1 (Football EPA) + B1 (Basketball Gravity-Assist) — 03.10.

**Task #33, eng eingegrenzt auf genau zwei Punkte aus `docs/design/fable-ideen-feldspiel-
30-09.md`:** F1 (§4, "EPA statt Yards") und B1-Stufe-1 (§3, "Gravity-Assist als
Buchhaltung"). B2 (Freiwurf), H-C (Torwart-Passgeber) und Gravity-Stufe-2 sind ausdruecklich
NICHT Teil dieses Auftrags (Task #59, Chris' Zustimmung ausstehend).

**Ergebnis in einem Satz:** F1 ist **gebaut, gemessen, nicht uebernommen** — es senkt die
Football-Rangtreue deutlich unter die 0,80-Schranke und wird deshalb nicht in die Wertformel
verdrahtet (die Buchhaltung bleibt im Code, abgeschaltet, fuer eine moegliche spaetere, anders
gewichtete Runde). B1-Stufe-1 ist **gebaut, gemessen, erfolgreich — mit kleinem Effekt**: rho
haelt (leicht ueber Baseline, bei n=24 UND n=48), und Intelligenz-/Awareness-Einfluss steigen
beide, wenn auch nur um 0,6 bzw. 0,2 Prozentpunkte (Details Abschnitt 2).

---

## 1. F1 — EPA statt Yards (Football)

### 1.1 Gebaut

- **Messsonde** `scripts/messe-football-epa-tabelle.mjs`: zieht eine EP-Tabelle (Expected
  Points), geschluesselt nach (Down, Distanzklasse, Feldstand in Zehnerschritten), aus 240
  simulierten Spielen des eigenen Motors — Standard-EPA-Methodik ("naechster Punktgewinn im
  Spiel", vorwaerts/rueckwaerts ueber Punt/Turnover/Seitenwechsel hinweg verfolgt). KEINE
  echte NFL-Tabelle, dieselbe Ehrlichkeit wie `kurve.skillMittel`.
- **Instrumentierung** (reine Buchfuehrung, kein neuer `rr()`-Aufruf): `starteSnap()` haelt
  JEDEN Snap als `{down,toGo,spot,side}` in `fsFbLog.epaZustaende` fest; jeder reale
  Punktgewinn (Touchdown, Field Goal) wird als `{idx,side,punkte}` in `fsFbLog.epaScores`
  nachgetragen. Beide Arrays sind ausserhalb der Messsonde ungelesen.
- **Produktionsbuchhaltung** in `vollziehFootballErgebnis`/`footballDownWeiter` (6
  Buchungsstellen: komplett, lauf, sack, interception, punt, plus die gemeinsame
  Touchdown-/Erster-Versuch-/Turnover-on-Downs-Verzweigung in `footballDownWeiter`):
  - Passer und Receiver teilen sich die Offense-EPA eines kompletten Passes im selben
    Verhaeltnis, das die alte Formel bei Yards anlegt (`FB_EPA_PASSER_ANTEIL`≈0,286 /
    `FB_EPA_RECEIVER_ANTEIL`≈0,714, aus 1/25 gegen 1/10 hergeleitet).
  - Der Laeufer bekommt die Offense-EPA eines Laufs voll.
  - Tackler (lauf/komplett), Sacker und Interceptor bekommen die NEGATIVE Offense-EPA als
    Defensiv-Gutschrift (additiv zu den bestehenden `checks`/`bloecke`/`steals`-Posten).
  - Der Punt bucht Feldpositions-EPA auf einen DETERMINISTISCH gewaehlten Namenstraeger
    (groesste PASSGENAUIGKEIT im Kader) — bewusst **kein** `fkLos()`-Zug, weil das einen
    zusaetzlichen `rr()`-Aufruf eingefuehrt haette (Kaskadenrisiko, s. 1.3).
  - `u.epa` ist das neue Sammelfeld, `u.passYards/laufYards/fangYards` bleiben als
    Boxscore-Spalten unveraendert bestehen.
- **Gezogene Tabelle** (102 von 120 moeglichen Feinzellen mit ≥25 Besuchen, Rest faellt auf
  eine Feldstand-Grobtabelle mit allen zehn Zehner-Zellen zurueck): monoton fallend in Down
  UND Feldstand, wie erwartet (1st & Goal ≈ 6,4-6,6, 4th & lang bei eigener 10-Yard-Linie
  ≈ -3,6).

### 1.2 Gemessen

Kader-Familie, `miss-alle-disziplinen.mjs 24 football` (Median ueber fuenf Team-Paarungen):

| Variante | rho je Spiel | Spannweite | Abnahme |
|---|---:|---:|---|
| Baseline (main, Yards-Formel) | **0,814** | 0,127 | bestanden |
| F1, NUR Passer/Receiver-Split (ohne Defensiv-/Punter-Gutschrift) | 0,680 | 0,151 | durchgefallen |
| F1, VOLLSTAENDIG (wie im Auftrag: + Tackler/Rusher/Interceptor + Punter) | **0,399** | 0,230 | durchgefallen |

Beide F1-Varianten liegen weit unter 0,80 und ausserhalb jeder Kader-Spannweite — das ist kein
Messrauschen, sondern ein echter, grosser Effekt in die falsche Richtung.

Pp-Messung (`messe-arena-einfluss.mjs football 48`) wurde gegen den finalen Code (F1 inert,
Wertformel unveraendert) gefahren: **51,7 Pp**, exakt im bereits bekannten Vorbestand (CLAUDE.md
nennt 47,3–58,8 fuer Football) — bestaetigt, dass F1 in der ausgelieferten Fassung keine
Nebenwirkung auf Pp hat, weil es nirgends in die Wertformel einfliesst.

### 1.3 Warum es nicht funktioniert (Befund, nicht nur Vermutung)

Die EP-Tabelle ist **stufig** in Down/Distanzklasse/Zehner-Feldstand. Ein Yard-Gewinn, der
keine Bucket-Grenze ueberschreitet, zaehlt in EPA oft NICHTS oder sogar NEGATIV (ein verbrauchter
Down ohne Fortschritt), waehrend derselbe Gewinn in der alten Yards-Formel immer positiv war.
Das macht die Spielerwertung diskontinuierlich statt glatt mit der tatsaechlichen
Sub-Skill-Differenz zu skalieren — genau umgekehrt zu Hockeys K3 (`punkte*1.5+xg*1.5`), das
eine BESTEHENDE binaere Masche (Tor/kein Tor) durch eine GLATTE Wahrscheinlichkeit ERSETZT und
dadurch Varianz SENKT. F1 tut das Gegenteil: es ersetzt eine glatte, Yard-proportionale Masche
durch eine stufige.

Am haertesten trifft es die Tackler-/Interceptor-Gutschrift: wer einen GROSSEN gegnerischen
Gewinn beendet (die eigentliche Verteidigungsleistung — er hat den Lauf/Pass gestoppt), wird
dafuer mit der GROSSEN negativen Offense-EPA dieses Zugs bestraft, obwohl der Gewinn selbst meist
an der Coverage/dem Lauf-Fit woanders lag, nicht an ihm. Der isolierte Test (nur Passer/Receiver,
ohne Defensiv-Gutschrift) zeigt: schon OHNE diesen Effekt kostet die reine Ersetzung der
Yards-Terme 0,134 rho (0,814→0,680) — die Defensiv-/Punter-Gutschrift kostet NOCH EINMAL 0,281
(0,680→0,399) obendrauf.

### 1.4 Entscheidung

**Nicht uebernommen — dokumentiert als "nicht erfolgreich, verworfen"** (CLAUDE.md erlaubt das
ausdruecklich: "Was rho drueckt, ist oft gar kein Fehler" / Task-Auftrag: "nicht erzwingen").
`feldspielWert()`s Football-Zweig ist **unveraendert** auf die alte Yards-Formel zurueckgesetzt.
Die komplette Buchhaltung (`footballEpVon`, `FOOTBALL_EP_TABELLE`, die Kredit-Vergabe in allen
sechs Buchungsstellen) bleibt im Code stehen, befuellt `u.epa` weiter, wird aber von KEINER
Wertformel gelesen — bit-identisch zur Vor-F1-Fassung (gegengemessen: 0,814 vorher/nachher,
identisch auf drei Nachkommastellen). Das ist bewusst keine Loeschung: eine kuenftige Runde
koennte z. B. nur den Passer/Receiver-Split mit einem kleinen Gewicht ADDITIV (nicht ersetzend)
neben die Yards-Formel legen, oder die Tackler-Gutschrift ganz weglassen — beides nicht in diesem
Auftrag gemessen, beides aus den obigen Zahlen als naechster Versuch naheliegend.

---

## 2. B1 — Gravity-Assist Stufe 1 (Basketball)

### 2.1 Gebaut

NUR Stufe 1 (reine Wertformel/Buchhaltung) — Stufe 2 (Verteidiger-Sog-Mechanik) ist nicht Teil
dieses Auftrags und wurde nicht angefasst.

- **Kandidaten-Erkennung** in `wirf()` (Abwurfmoment, vor jedem Feldwurfversuch, NUR
  Basketball): fuer jeden Mitspieler des Schuetzen (ausser ihm selbst) mit
  `SCHUSS_FERN >= 55` wird geprueft, ob sein eigener Verteidiger in genau diesem Moment NAEHER
  am Schuetzen (Ball-/Hilfe-Position) steht als an ihm selbst. Qualifizierende Mitspieler
  landen in `flug.gravityKandidaten`. Kein neuer `rr()`-Aufruf, keine neue Bewegung — reine
  Momentaufnahme bereits vorhandener Deckerabstaende (dieselbe Bauform wie
  `deckerAbstandBeiWurf`, das direkt daneben steht).
- **Gutschrift** in `loeseFlugAuf()`: faellt der Feldkorb (`flug.treffer`), bekommt jeder
  Kandidat `u.gravityAssist+=1`.
- **Wertformel**: `feldspielWert()` addiert im Basketball-Zweig
  `+(u.gravityAssist||0)*GRAVITY_ASSIST_GEWICHT` (Platzhalter-Gewicht 0,5 — klein neben
  Assist 1,0/Rebound 1,2, Messpflicht fuer eine spaetere Kalibrierrunde).
- SCHUSS_FERN = intelligence 50 / awareness 22 / spirit 16 / dexterity 12 — unveraendert aus
  `battle-mode.rezepte.js`, keine Matrix-/Rezeptaenderung.

### 2.2 Gemessen

Kader-Familie, `miss-alle-disziplinen.mjs <n> basketball`:

| n | Baseline rho/Spiel | B1 rho/Spiel | Delta | Spannweite |
|---:|---:|---:|---:|---:|
| 24 | 0,780 | 0,795 | +0,015 | 0,082/0,083 |
| 48 | 0,777 | 0,792 | +0,015 | 0,072/0,071 |

Die n=24→n=48-Nachmessung (CLAUDE.md-Pflicht bei Margen <0,02) bestaetigt denselben Effekt in
derselben Groessenordnung — **rho haelt** (keine Verschlechterung, konsistent leicht positiv,
aber innerhalb der Kader-Spannweite und damit statistisch nicht von Null zu unterscheiden).

**Betriebshinweis:** `messe-arena-einfluss.mjs basketball 48` (Live-Motor, (1+12×12)×48 =
6960 Spiele in EINER Browser-Seite) stuerzte zweimal mit "Target page, context or browser has
been closed" ab (Speicherdruck ueber die volle Laufzeit, trotz des bestehenden AudioContext-/
Timer-Fixes im Skript) — bei n=24 (3480 Spiele) lief es beide Male sauber durch (1406-1683s,
~23-28 min). Fuer Basketball deshalb **n=24** statt der im Auftrag genannten 48 (Football, mit
dem schlanken Snap-Motor statt Live-Ticks, lief bei n=48 anstandslos in 542s durch, s. Abschnitt
1.2) — dieselbe Einschraenkung gilt vermutlich fuer jede kuenftige Pp-Messung am Basketball-
Live-Motor und gehoert als eigener kleiner Befund in die Werkzeug-Pflege (Abschnitt 4).

Pp-Einfluss, zwei unabhaengige Saatstroeme (`messe-arena-einfluss.mjs basketball 24` und
`messe-arena-einfluss-zweiter-saatstamm.mjs basketball 24`), jeweils gegen denselben Baseline-
Lauf (identischer Code ohne B1, gleicher Saatstrom 1) verglichen, weil die Simulation selbst
bit-identisch bleibt (B1 wuerfelt nichts neu) und jede Verschiebung damit direkt auf die neue
Buchung zurueckgeht, nicht auf Kaderrauschen:

| | Baseline (Strom 1) | B1 (Strom 1) | Delta | B1 (Strom 2, unabh. Saat) |
|---|---:|---:|---:|---:|
| Intelligenz-Anteil | 13,7 % | 14,3 % | **+0,6** | 14,6 % |
| Awareness-Anteil | 6,1 % | 6,3 % | **+0,2** | 8,4 % |
| Pp-Abweichung gesamt | 35,0 | 34,5 | -0,5 | 34,9 |

Strom 2 laeuft auf einem komplett unabhaengigen Formkarten-/Bau-Saatversatz (+10.000.000,
`messe-arena-einfluss-zweiter-saatstamm.mjs`) und wurde NUR mit aktivem B1 gefahren (kein
eigener Baseline-Lauf fuer diesen Strom, aus Zeitgruenden — ein B1-Lauf allein dauert bei
Basketballs Live-Motor schon 20-28 Minuten). Er dient hier als Konsistenzpruefung: liegen
Intelligenz/Awareness in einem zu Strom 1 vergleichbaren, klar von Null verschiedenen Bereich?
Ja — 14,6 % / 8,4 % (Strom 1 mit B1: 14,3 % / 6,3 %), Pp-Abweichung 34,9 gegen 34,5. Beide
Stroeme liegen damit in derselben Groessenordnung, kein Ausreisser.

### 2.3 Bewertung gegen das Abnahmekriterium

Der Auftrag verlangt: **NUR wenn Intelligenz-/Awareness-Einfluss steigt UND rho haelt, gilt B1
als erfolgreich.**

- **rho haelt** — erfuellt (siehe 2.2: +0,015 bei n=24 UND bei n=48, kein Rueckgang).
- **Intelligenz-/Awareness-Einfluss steigt** — erfuellt, aber klein: beide Attribute legen in
  Strom 1 zu (Intelligenz +0,6 Pp, Awareness +0,2 Pp), und weil die zugrunde liegenden Spiele
  bit-identisch sind (B1 fuehrt keinen neuen `rr()`-Aufruf ein), ist das ein reproduzierbarer
  Effekt der neuen Buchung, kein Zufallsrauschen aus einer anderen Formkarten-/Mutator-Ziehung.
  Die Groessenordnung ist allerdings klein gegenueber der 25-Pp-Zielmarke (34,5 bleibt weit
  darueber) — B1 **lindert** die bekannte Unterbelichtung, **behebt** sie aber nicht.
  Strom 2 bestaetigt die Groessenordnung (Intelligenz 14,6 %, Awareness 8,4 %, Pp-Abweichung
  34,9 — konsistent mit Strom 1, kein Ausreisser in beide Richtungen).

### 2.4 Entscheidung

**B1-Stufe-1 wird uebernommen** (Wertformel bleibt wie gebaut, `GRAVITY_ASSIST_GEWICHT=0,5`
unveraendert) — beide Kriterien sind erfuellt, der Effekt ist klein, aber in die richtige
Richtung und ohne Risiko fuer rho. Das deckt sich mit der Erwartung aus dem Konzept-Dokument
("Stufe 1 ist K3-Klasse... ich verspreche nichts"). Stufe 2 (die eigentliche Verteidiger-Sog-
Mechanik) bleibt wie beauftragt aussen vor — erst dort entsteht der groessere, im Konzept
beschriebene Hebel (Hilfsverteidiger werden tatsaechlich von guten Schuetzen "gebunden"), und
dafuer braucht es Chris' Zustimmung (Task #59).

---

## 3. Isolationsnachweis

- **Football unveraendert fuer andere Disziplinen/Mechaniken.** `u.epa`-Buchhaltung ist
  additiv (neues Feld, neue Funktionen), beruehrt keine bestehende Yards-/Punkte-/
  Turnover-Buchhaltung. `feldspielWert()`s Football-Zweig ist Zeichen-fuer-Zeichen auf die
  Vor-F1-Fassung zurueckgesetzt. Gegengemessen: `miss-alle-disziplinen.mjs 24 football` liefert
  **0,814**, identisch zur dokumentierten Baseline in CLAUDE.md/Vorlaeufer-Messungen.
- **Kein neuer `rr()`-Aufruf** in F1 ODER B1 — nachgewiesen durch Code-Lesung (beide Kandidaten-
  Erkennungen lesen nur bereits vorhandene Positionen/Attribute) UND durch die bit-identische
  Football-Baseline-Messung (eine verschobene Zufallsfolge haette KEIN identisches Ergebnis auf
  drei Nachkommastellen ergeben).
- **Basketball:** B1 beruehrt ausschliesslich `wirf()` (neue, rein additive lokale Variable
  `gravityKandidaten`), `loeseFlugAuf()`s Treffer-Zweig (ein neuer Zaehler, kein bestehender
  angefasst) und `feldspielWert()`s Basketball-Zweig (ein neuer additiver Term). Bestehende
  Posten (Assist, Rebound, Steal/Block, Verlust, xp/K3) sind unveraendert.
- **Andere Disziplinen (Hockey, Bahn, Buehne, Arena, ...):** keine Datei ausserhalb von
  `public/mockups/battle-mode.engine.js` geaendert; innerhalb der Datei betreffen alle
  Aenderungen ausschliesslich football- bzw. basketball-gated Codepfade
  (`feldspielDisc==="football"`/`==="basketball"` bzw. Football-spezifische Funktionen wie
  `vollziehFootballErgebnis`/`footballDownWeiter`/`starteSnap`). `scripts/messe-football-epa-
  tabelle.mjs` ist eine reine Lesesonde (keine Schreibzugriffe auf den Spielstand).
  Stichprobe: `miss-alle-disziplinen.mjs 24 hockey` liefert mit UND ohne diesen Diff exakt
  **0,640** (durchgefallen, aber unveraendert — die Kaderfamilien-Messung liegt hier unter dem
  aelteren, mit einem anderen Messverfahren gewonnenen CLAUDE.md-Wert 0,725; das ist ein
  vorbestehender Zustand, mit dieser Runde nicht beruehrt und nicht Gegenstand von Task #33).

## 4. Werkzeuge dieser Runde

- `scripts/messe-football-epa-tabelle.mjs [spiele]` — zieht/aktualisiert die EP-Tabelle
  (240 Spiele empfohlen). Bei einer spaeteren Rezept-/Korridoraenderung an Football neu laufen
  lassen, falls F1 doch einmal reaktiviert wird.

## 5. Offene Fragen an Chris

1. **F1:** verworfen wie oben begruendet — soll die liegen gelassene Buchhaltung (`u.epa`)
   als Ausgangspunkt fuer eine additive statt ersetzende EPA-Variante in einer spaeteren Runde
   dienen, oder soll sie ganz entfernt werden?
2. **B1:** der Effekt ist klein (0,5 im Gewicht, +0,6/+0,2 Pp) — soll `GRAVITY_ASSIST_GEWICHT`
   in einer spaeteren Runde hoeher kalibriert werden (mehr Hebel, aber mehr Pp-/rho-Risiko),
   oder bleibt es bei 0,5 als konservativem Start? Und: ist Stufe 2 (Verteidiger-Sog) jetzt,
   nach diesem positiven Stufe-1-Befund, etwas, das Chris fuer eine kommende Runde freigeben
   moechte (Task #59)?
