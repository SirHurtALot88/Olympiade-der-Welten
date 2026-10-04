# Staffel: WECHSEL_*/KURVE_*-Kalibrierung — Diagnose, kein Code geändert (Task #40/#52, 02.10.)

## Auftrag und Ergebnis vorab

Folgerunde zu PR #1123 (`docs/design/bahn-staffel-pp-rezeptrunde-02-10.md`): die dortige
Empfehlung war, die als PLATZHALTER markierten `WECHSEL_*`/`KURVE_*`-Konstanten gegen Pp
einzumessen, um die verbliebene Pp-Abweichung (37,7/41,1) weiter Richtung ≤25 zu senken —
unter der ausdrücklichen Bedingung, die Kaderpaarung **vigilante-armageddon** (bei PR #1123
als einzige von fünf unter die 0,80-rho-Schranke gefallen: 0,716/0,690 bei n=24, 0,698/0,678
bei n=48) als Veto-Fall gegenzuprüfen.

**Ergebnis: kein Code geändert.** Fünfzehn Varianten wurden gebaut und gemessen (Tabelle
unten). Keine schließt den Zielkonflikt: Die Variante mit der stärksten Pp-Verbesserung
(reine `WECHSEL_*`-Verstärkung, Pp 24,1/27,8 — **das einzige in dieser Runde gefundene
Ergebnis unter der 25-Pp-Schranke**) drückt vigilante-armageddon auf 0,636 — schlechter als
der ohnehin schon verletzte Ausgangswert. Die einzige Hebelrichtung, die vigilante-armageddon
überhaupt anhebt (`KURVE_*`-Verstärkung), bewegt die Paarung nur bis an den Rand von 0,80
heran, nie mit einer echten Sicherheitsspanne — bei n=48 blieb sie in sechs von sieben
getesteten `KURVE_*`-Stufen unter 0,80 (0,761–0,792), nur eine einzige Stufe (x2,5) kam auf
0,802, umgeben von schlechteren Nachbarwerten (x2,2: 0,761; x2,8: 0,780) — ein Muster, das zu
einem einzelnen gekippten Rennausgang passt, nicht zu einer echten systematischen
Verbesserung. Nach CLAUDE.mds eigener Vorrangregel (rho/Sentinel vor Pp bei Zielkonflikt)
gibt es damit keine Kalibrierung dieser beiden Konstantenfamilien, die beide Abnahmen
gleichzeitig erfüllt. Das deckt sich mit der bereits in PR #1123 geäußerten Vermutung: die
strukturelle Verdünnung von TECHNIK/WENDIGKEIT (Wirkung nur über den Schnitt zweier Läufer,
nur an ein bis zwei von fünf Wechseln bzw. der eigenen Kurve) ist mit reiner
Konstantenkalibrierung nicht aufzulösen.

**Wichtig für den Gesamtstand:** vigilante-armageddon steht auf dem aktuellen `main` (nach
PR #1123, vor dieser Runde) bereits unter 0,80 (0,698 bei n=48). Diese Runde konnte das
nicht beheben — die Verletzung bleibt auf `main` offen, unabhängig von dieser Diagnose.

---

## 1. Ausgangslage (aktueller `main`, Commit `562d8924`, nach PR #1123/#1124)

Bestätigungsmessung vor jeder Änderung, bit-identisch zu PR #1123:

| Messung | Wert |
|---|---:|
| Pp, n=48, Saat 1 | 37,7 |
| Pp, n=48, Saat 2 (Versatz 10.000.000) | 41,1 |
| rho/Spiel, n=24 (Median, 5 Paarungen) | 0,893 |
| rho/Spiel, n=48 (Median) | 0,895 |

Einzelpaarungen (n=24 / n=48, rho je Spiel):

| Paarung | n=24 | n=48 |
|---|---:|---:|
| **vigilante-armageddon** | **0,716** | **0,698** |
| coldsteel-direlegion | 0,848 | — |
| goldengladiators-silversoldiers | 0,924 | — |
| mortalsin-natureswrath | 0,899 | — |
| piratecrew-raginglunatics | 0,893 | — |

(n=48-Einzelwerte für die anderen vier Paarungen stehen in PR #1123, hier nicht erneut
gemessen — die Bestätigung oben diente nur dem Abgleich mit dem Stand, auf dem diese Runde
aufsetzt.)

## 2. Betroffene Konstanten (Fundstelle `public/mockups/battle-mode.engine.js`)

```js
// UEBERGABE (TECHNIK = Wechsel: awareness 38, dexterity 32, charisma 30)
const WECHSEL_MAX=0.42;          const WECHSEL_K=0.0036;        const WECHSEL_MIN=0.04;
const WECHSEL_PATZER=0.11;       const WECHSEL_PATZER_K=0.0020; const WECHSEL_ROBUST_K=0.0012;
const WECHSEL_STREU_MAX=0.40;    const WECHSEL_STREU_K=0.0035;  const WECHSEL_STREU_MIN=0.10;
const WECHSEL_PATZER_MIN=0.045;  const WECHSEL_PATZER_KOSTEN=0.34;

// KURVE (WENDIGKEIT = Bahnarbeit: dexterity 42, awareness 34, speed 24)
const KURVE_ANTEIL=0.55;  const KURVE_KOSTEN=0.12;  const KURVE_WENDIG=0.0016;
```

`WECHSEL_STREU_*` ist **nicht** Teil des als "PLATZHALTER" markierten Satzes (der Kommentar
direkt über `WECHSEL_MAX` nennt ausdrücklich nur fünf Zahlen: MAX/K/MIN/PATZER/PATZER_K) —
die Streuung wurde am 13.09. bewusst und bereits nachgemessen eingeführt und verdoppelt
("Mehr geht bewusst nicht", s. ausführlicher Kommentar im Code), als Antwort auf Chris'
Wunsch nach weniger statischen Rennen. Diese Runde hat `WECHSEL_STREU_*` einmal probeweise
angefasst (Versuch 8 unten), das Ergebnis aber **nicht** in die Empfehlung übernommen, weil
es eine bereits getroffene, dokumentierte Designentscheidung rückgängig machen würde, ohne
dass das außerhalb dieser Runde abgestimmt wäre.

## 3. Positiv-Normierungs-Check vorab

Vor der ersten Konstantenänderung wurde geprüft, ob `einflussVon()`s Positiv-Summen-Effekt
(Pp-Anteile normieren nur über positive Gewinne, s. TDM-/Takeshi-Diagnosen) hier zuschlagen
könnte: Die Staffel misst bereits mit der projektweit höchsten empfohlenen Laufzahl
(`VORGABE.staffel=144` im Skript, hier mit explizit übergebenem n=48 gegen die beiden
Vorgängermessungen aus PR #1123 abgeglichen — bit-identisch reproduziert, s. Abschnitt 1).
Ein Lauf bei n=48 dauert ~19–20 s (deutlich billiger als TDM), zwei unabhängige Saatströme
sind damit in dieser Runde routinemäßig leistbar, nicht nur einmalig. Das Risiko einer
kleinen-n-Verzerrung ist damit für diese Disziplin strukturell geringer als bei TDM/Takeshi —
ändert aber nichts daran, dass die GEMESSENE Pp-Zahl von den `WECHSEL_*`/`KURVE_*`-Werten
nichtlinear und, wie Abschnitt 5 zeigt, teils chaotisch abhängt.

## 4. Methodik

- Pp: `scripts/messe-arena-einfluss.mjs staffel 48` und `...-zweiter-saatstamm.mjs staffel 48`
  (zwei unabhängige Saatströme, wie gefordert).
- rho: eigenes Hilfsskript (analog `miss-alle-disziplinen.mjs`, aber mit Klartext-Ausgabe je
  Paarung statt nur Median/Spannweite — `disziplinMessen()` liefert `.varianten` bereits,
  `miss-alle-disziplinen.mjs` druckt sie nur nicht), bei n=24 und — wo die Marge zur
  0,80-Schranke unter 0,02 lag — zusätzlich bei n=48 (Lehre aus der Football-PR-#1115-
  Episode, in CLAUDE.md referenziert).
- Jede Variante: `node --check` vor der Messung, Werte danach entweder verworfen (nächste
  Variante) oder als Kandidat weitergeführt.

## 5. Alle fünfzehn Versuche

### 5.1 Kombinierte WECHSEL+KURVE-Verstärkung

| # | WECHSEL (MAX/K) | KURVE (KOSTEN/WENDIG) | Pp n=48 (S1/S2) | rho Median n=24 | vigilante n=24 (Spiel/Saison) |
|---|---|---|---:|---:|---:|
| Basis | 0,42/0,0036 | 0,12/0,0016 | 37,7/41,1 | 0,893 | 0,716/0,690 |
| 1 | x2 (0,84/0,0072) | x2 (0,24/0,0032) | 31,3/— | 0,846 | 0,752/0,683 |
| 2 | x3 (1,26/0,0108) | x3 (0,36/0,0048) | 34,9/— | 0,842 | 0,763/0,708 |

Versuch 2 zeigt bereits: mehr ist nicht einfach besser — x3/x3 ist bei Pp SCHLECHTER als
x2/x2 (34,9 gegen 31,3), und drückt zusätzlich piratecrew-raginglunatics auf 0,798 (n=24,
Spiel), knapp unter die Schranke.

### 5.2 WECHSEL isoliert (KURVE auf Basis)

| # | WECHSEL (MAX/K) | Pp n=48 (S1/S2) | rho Median n=24 | vigilante n=24 |
|---|---|---:|---:|---:|
| 3 | x3 (1,26/0,0108) | **24,1 / 27,8** | 0,783 | **0,636 / 0,592** |
| 12 | x0,5 (0,21/0,0018) + KURVE x3 | 35,6 | — (n=48 Median 0,920) | 0,776 (n=48) |

**Versuch 3 ist das einzige in dieser Runde gefundene Ergebnis unter der 25-Pp-Schranke** —
und gleichzeitig das mit Abstand schlechteste für vigilante-armageddon: 0,636, schlechter als
der ohnehin schon verletzte Ausgangswert 0,716. Der rho-Median selbst fällt dabei unter 0,80
(0,783) — eine zweite, projektweite Verletzung, nicht nur die Sentinel-Paarung. **WECHSEL-
Verstärkung ist damit der Hebel, der Pp am stärksten senkt — und rho/vigilante-armageddon am
stärksten schädigt. Ein direkter, gemessener Zielkonflikt, keine Vermutung.**

Versuch 12 (WECHSEL halbiert statt verstärkt, kombiniert mit KURVE x3) zeigt: auch die
GEGENRICHTUNG hilft nicht — 0,776 bei n=48, ebenfalls unter der Schranke. Die Beziehung ist
nicht einfach "weniger WECHSEL-Gewicht ist besser für vigilante", sondern nichtlinear.

### 5.3 KURVE isoliert (WECHSEL auf Basis) — die einzige rho-freundliche Richtung

| # | KURVE (KOSTEN/WENDIG, Faktor) | Pp n=48 | rho Median n=24 | vigilante n=24 | vigilante n=48 |
|---|---|---:|---:|---:|---:|
| 4 | x2 (0,24/0,0032) | 35,1 | 0,902 | 0,759/0,725 | — |
| 13 | x2,2 (0,264/0,00352) | — | — | — | 0,761/0,720 |
| 11 | x2,5 (0,30/0,0040) | 33,5/35,5 | — | — | **0,802**/0,734 |
| 14 | x2,8 (0,336/0,00448) | — | — | — | 0,780/0,748 |
| 5 | x3 (0,36/0,0048) | 34,5 | 0,909 | 0,802/0,753 | 0,789/0,748 |
| 7/9 | x3,5 (0,42/0,0056) | 38,2 | 0,912 | 0,805/0,736 | 0,792/0,741 |
| 6 | x4 (0,48/0,0064) | 42,3 | 0,902 | 0,798/0,736 | — |

**Das ist die einzige getestete Richtung, die vigilante-armageddon überhaupt anhebt** (von
0,698/0,716 auf bis zu ~0,80) — aber nie mit echter Sicherheitsspanne. Bei n=48 (der
verbindlichen Zahl bei dünner Marge) liegen sechs von sieben Stufen UNTER 0,80 (0,720–0,792),
nur eine einzige (x2,5) kommt auf 0,802 — eingerahmt von schlechteren Nachbarwerten (x2,2:
0,761; x2,8: 0,780). Eine echte, robuste Verbesserung müsste über einen Bereich benachbarter
Werte monoton oder zumindest konsistent über 0,80 bleiben; hier springt die Zahl zwischen
0,720 und 0,802 ohne erkennbaren Trend — das Muster eines einzelnen, bei dieser exakten
Konstante gekippten Rennausgangs (Ränge sind diskret, kleine Parameteränderungen können ein
knappes Rennen kippen), nicht einer systematischen Verbesserung. Dazu kommt: selbst am besten
gefundenen Punkt bewegt sich Pp nur auf 33,5/35,5 — eine Verbesserung von ~37,7/41,1, aber
weit über dem Ziel 25, und schlechter als die bereits im `main` stehende Mittel-der-Sieben-
Kalibrierung selbst nicht verbessert in einer Weise, die den Aufwand einer Konstanten-
Umstellung rechtfertigt, wenn der Sentinel-Fall dabei nicht sicher gerettet wird.

### 5.4 Strukturelle Variante: `KURVE_ANTEIL` statt `KURVE_KOSTEN`

| # | KURVE_ANTEIL | KURVE_KOSTEN/WENDIG | Pp n=48 | vigilante n=48 |
|---|---:|---|---:|---:|
| 10 | 0,70 (statt 0,55) | x2 (0,24/0,0032) | 32,7 | 0,776 |

Mehr Kurvenanteil je Abschnitt statt mehr Kosten je Kurve ist kein besserer Hebel — schlechter
als Versuch 11 (x2,5 über `KURVE_KOSTEN`) bei ähnlichem Pp-Niveau.

### 5.5 Patzer-Sensitivität (bestätigt: wirkungslos durch bestehenden Boden)

| # | Änderung | Ergebnis |
|---|---|---|
| 15 | `WECHSEL_PATZER_K`/`WECHSEL_ROBUST_K` verdoppelt, zusammen mit KURVE x2,5 | **bit-identisch zu Versuch 11** (Pp 33,5/35,5, vigilante n=48 0,802/0,734) |

Erwartbar und bestätigt: bei den üblichen Koennen/Verlaesslich-Werten (40–55) liegt die
Patzerformel bereits unter dem Boden `WECHSEL_PATZER_MIN=0,045` (der Code-Kommentar an
`WECHSEL_PATZER_MIN` dokumentiert das bereits) — eine Verdopplung von `PATZER_K`/`ROBUST_K`
ändert für den Großteil der Spieler nichts, weil der Boden die Formel ohnehin überschreibt.
**`WECHSEL_PATZER_K`/`WECHSEL_ROBUST_K` sind damit keine wirksamen Stellschrauben, solange
`WECHSEL_PATZER_MIN` so nah an der ungedämpften Formel liegt.**

### 5.6 Außerhalb des Scopes getestet (nicht empfohlen)

| # | Änderung | Ergebnis | Warum nicht übernommen |
|---|---|---:|---|
| 8 | KURVE x3 + `WECHSEL_STREU_MAX/K` halbiert | vigilante n=24: **0,822** (Marge 0,022, am ehesten eine echte Verbesserung) | `WECHSEL_STREU_*` ist keine als Platzhalter markierte Konstante — sie wurde am 13.09. bewusst verdoppelt, um Rennen weniger statisch zu machen ("Mehr geht bewusst nicht", s. Code-Kommentar). Das rückgängig zu machen ist eine eigene Designentscheidung, die außerhalb dieser Runde mit Chris abzustimmen wäre, nicht Teil des Auftrags "WECHSEL_*/KURVE_*-Platzhalter kalibrieren". Nicht bei n=48 nachgemessen, weil nicht in die Empfehlung übernommen.

Dieser Versuch ist der einzige mit einer Marge über 0,02 — festgehalten als Hinweis für eine
künftige, ausdrücklich auf `WECHSEL_STREU_*` zielende Runde, nicht als Ergebnis dieser.

## 6. Warum die `KURVE_*`-Richtung nicht einfach weiter verstärkt werden kann

Versuch 6 (x4) zeigt den Umschlagpunkt: Pp verschlechtert sich wieder (42,3, schlechter als
x3,5s 38,2), weil `awareness`/`dexterity` jetzt ÜBER ihr Matrixgewicht hinausschießen (+3,7/
+5,1 Pp) während `charisma` (das NUR über `WECHSEL_*`/TECHNIK läuft, nicht über `KURVE_*`/
WENDIGKEIT) bei jeder reinen KURVE-Verstärkung unverändert unterrepräsentiert bleibt (-8,0 bis
-8,3 Pp gegen Matrix 10 in allen Versuchen 4–7, 10, 11, 15). **Charisma ist struktuell nur
über `WECHSEL_*` erreichbar — und genau diese Konstante ist diejenige, die vigilante-
armageddon am stärksten schädigt (Abschnitt 5.2).** Eine Pp-Abweichung unter 25 bräuchte
Fortschritt bei Charisma; der einzige Kanal dafür ist der Hebel, der den Sentinel-Fall am
stärksten verletzt. Das ist der Kern des Zielkonflikts, nicht ein Kalibrierungsdetail.

## 7. Einordnung

Dies bestätigt und verschärft die in PR #1123 geäußerte Vermutung: TECHNIK (Wechsel) wirkt
nur über den Schnitt zweier Läufer und an höchstens zwei von fünf Übergaben — eine
strukturelle Verdünnung, die sich durch Verstärken der zugehörigen Zeitkosten-Konstanten
NICHT in mehr Rangtreue für vigilante-armageddon übersetzt, sondern nachweislich in weniger
(0,716 → 0,636 bei WECHSEL x3). WENDIGKEIT (Kurve) wirkt direkter (eigener Läufer, nicht
gemittelt, durchgehend während der Kurvenzone) und hilft dem Sentinel-Fall tatsächlich — aber
nur bis an den Rand von 0,80, mit einem Muster (0,720–0,802 je nach exakter Konstante), das
eher nach einem gekippten Einzelrennen aussieht als nach einem robusten Fix, und ohne genug
Hebelkraft, die Pp-Abweichung spürbar unter 30 zu drücken.

**Für die nächste Runde (nicht in dieser verfolgt):**

- Eine echte Lösung für vigilante-armageddon bräuchte vermutlich eine **Mechanik-Änderung**,
  keine weitere Konstantenkalibrierung: z. B. mehr als zwei von fünf Übergaben an TECHNIK
  hängen lassen (jeder Läufer an beiden Enden bewertet?), oder eine Attributprofil-Analyse
  dieser konkreten Kaderpaarung (bisher nur Hypothese, s. PR #1123 "Nebenbefund"), um die
  tatsächliche Ursache zu isolieren statt an Symptomen zu drehen.
- `WECHSEL_STREU_*` (Versuch 8) ist ein echter Kandidat für eine eigene, ausdrücklich
  angefragte Runde — mit dem höchsten gemessenen Sentinel-Nutzen dieser ganzen Untersuchung
  (Marge 0,022), aber außerhalb des Platzhalter-Scopes dieser Runde.
- Pp unter 25 ist mit `WECHSEL_*`/`KURVE_*` allein nicht erreichbar, ohne vigilante-
  armageddon zu schädigen — Charismas einziger Kanal (`WECHSEL_*`) ist exakt der Hebel, der
  den Sentinel-Fall am stärksten verletzt.

## 8. Abnahme dieser Runde

- `node --check public/mockups/battle-mode.engine.js`: grün (vor jeder der fünfzehn
  Varianten, zuletzt nach vollständigem Rücksetzen auf den `main`-Stand).
- `git diff --stat` nach Abschluss: leer — **kein Code geändert**, Datei bit-identisch zum
  Stand vor dieser Runde (Commit `562d8924`).
- Baseline-Reproduktion: Pp 37,7/41,1 und rho je Paarung (n=24) bit-identisch zu PR #1123
  reproduziert, vor der ersten Konstantenänderung (Abschnitt 1).
- Isolationsnachweis für Spurt/Zeitfahren/Takeshi/Climbing entfällt — da kein Code geändert
  wurde, sind alle Disziplinen trivial bit-identisch.

## Ehrliches Fazit

Diese Runde ist, wie die TDM-Diagnose vor ihr (Task #39, PR #1124), ein reines
Diagnose-Ergebnis: fünfzehn durchgerechnete und gemessene Varianten, keine davon erfüllt
beide Abnahmen gleichzeitig. Die eine Richtung, die Pp wirklich unter die 25-Schranke drückt
(`WECHSEL_*`-Verstärkung, 24,1/27,8 Pp), verschärft die bereits bestehende rho-Verletzung bei
vigilante-armageddon drastisch (0,716 → 0,636) und reißt sogar den projektweiten Median unter
0,80. Die einzige Richtung, die dem Sentinel-Fall hilft (`KURVE_*`-Verstärkung), kommt nie mit
sicherer Marge über 0,80 und bewegt Pp kaum. Nach CLAUDE.mds eigener Vorrangregel — rho vor
Pp bei Zielkonflikt, die Sentinel-Paarung als Veto-Fall — ist "nichts ändern" das ehrlichere
Ergebnis dieser Runde als eine Kalibrierung, die eine Zahl verbessert und eine andere,
wichtigere, verschlechtert oder bestenfalls auf Messerschneide hält.
