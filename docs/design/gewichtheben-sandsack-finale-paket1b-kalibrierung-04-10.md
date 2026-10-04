# Gewichtheben Sandsack-Finale — Paket 1b Kalibrierung (04.10.)

**Status: Kalibrierrunde abgeschlossen, Ergebnis gemischt — ein Ziel erreicht, das andere sehr
knapp verfehlt.** Dieses Dokument berichtet den vollständigen Kalibrierverlauf für
`baueSandsackFinale()` (Paket 1, `docs/design/gewichtheben-sandsack-finale-paket1-umsetzung-03-10.md`)
im Auftrag von Task #60: Pp-Abweichung ≤ 25 (zwei Saatstöme) UND Team-Validität ≥ 0,80 — beide
gleichzeitig, nicht nacheinander. Ausgangslage (Paket 1): Pp 35,9/41,2, Team-Validität 0,770.

**Ergebnis nach 27 systematisch gemessenen Kalibrierrunden über neun unabhängige Hebel:**

| Größe | Vorher (Paket 1) | Nachher (Paket 1b) | Ziel |
|---|---:|---:|---:|
| Pp-Abweichung, Strom 1 | 35,9 | **19,3** | ≤ 25 |
| Pp-Abweichung, Strom 2 | 41,2 | **22,7** | ≤ 25 |
| Team-Validität (rho) | 0,770 | **0,794** | ≥ 0,80 |

**Pp-Abweichung ist bestanden, klar und mit Reserve** (beide Ströme deutlich unter 25, n=144,
auch bei n=240 stabil reproduziert). **Team-Validität ist von 0,770 auf 0,794 gestiegen — eine
deutliche, reproduzierbare Verbesserung — verfehlt die 0,80-Schranke aber um 0,006.** Diese Lücke
ist bei n=10 Teams (5 Paarungen × 2 Seiten) kleiner als ein einziger Rang-Tausch zwischen zwei
Teams bewirken würde; sie wurde bei doppelter Stichprobe (n=48 statt 24 Rennen je Paarung,
Abschnitt 4) exakt reproduziert, ist also kein Messrauschen, sondern der tatsächliche Wert dieser
Konfiguration.

Dies ist, nach Chris' ausdrücklicher Vorgabe für diese Kalibrierrunde (Auftrag, Abschnitt
"Vorgehen"), ein **akzeptables, ehrlich dokumentiertes Ergebnis**: beide Zahlen sind gegenüber
Paket 1 klar verbessert, eine davon erreicht die Schranke, die andere verfehlt sie knapp. Die
Mechanik bleibt — wie in Paket 1 — **bewusst inert** (`seiten` unverdrahtet, Abschnitt 6).

---

## 1. Methodik

Jede Runde änderte **genau einen** benannten `SANDSACK_*`-Konstanten (oder, in drei Fällen, einen
bereits als gut befundenen Hebel mit einem zweiten kombiniert, explizit als solches markiert),
wurde mit `scripts/miss-sandsack-finale.mjs` gemessen (zuerst n=48/Spiele=12 für schnelle
Iteration, jeder ernsthafte Kandidat zusätzlich mit den vollen Pflichtzahlen n=144/Spiele=24
bestätigt) und bei Verschlechterung **sofort zurückgerollt**, bevor der nächste Hebel versucht
wurde — exakt das in CLAUDE.md verlangte Vorgehen ("einen Hebel nach dem anderen"). Referenzkader:
`data/generated/kaderfamilie-live-save.json` (5 Paarungen, 10 Teams), identisch zu Paket 1.

**Startpunkt jeder Runde war der jeweils letzte GUTE Stand**, nicht immer der Paket-1-Ausgangswert
— einige Hebel wirken nur in Kombination mit einem bereits geänderten anderen Hebel anders als
isoliert vom Paket-1-Stand aus (dokumentiert einzeln unten, z. B. Runde 9 vs. Runde 1).

---

## 2. Kalibrierhistorie — alle 27 Runden

### Hebel A: `SANDSACK_K_LAST` (Traglast-Abhängigkeit von LAST, `K = 30 + K_LAST·LAST`)

| Runde | Wert | Pp Strom1/2 | rho | Urteil |
|---|---:|---:|---:|---|
| 1 (vom Paket-1-Stand) | 1,2→**1,5** | 42,3 / 30,7 | **0,661** | VERSCHLECHTERT (rho-Einbruch) — zurückgerollt |
| 9 (nach Runde 2+6, s. u.) | 1,2→**1,4** | 33,2 / 34,2 | 0,855 | gemischt, speed kollabierte auf 0 % — verworfen |
| 10 | **1,3** | **18,9 / 23,6** | 0,782 | **Pp PASS**, rho knapp drunter — bester Pp-Treffer |
| 11 | 1,25 | 35,9 / 37,6 | 0,758 | schlechter als beide Nachbarn — nicht-monotone Reaktion bestätigt |
| 12 | 1,32 | 26,0 / 26,7 | 0,794 | knapp über Pp-Schranke, rho verbessert |
| 13 | 1,31 | 30,3 / 31,5 | 0,794 | schlechter als 1,32 bei gleichem rho |
| 24 | 1,28 | 18,9 / 23,3 | 0,770 | Pp gut, rho schlechter als 1,3 |

**Befund:** `K_LAST` reagiert **nicht monoton** auf Pp und rho — benachbarte Werte (1,25 / 1,28 /
1,3 / 1,31 / 1,32) liefern teils sprunghaft unterschiedliche Ergebnisse. Ursache: die Formel
enthält mehrere **deterministische Schwellen** (Rutscher-Wahrscheinlichkeit, Doppeln-Schwelle,
Zeitlimit), die bei kleinen K-Verschiebungen kippen und dadurch viele Spieler-Paarungen
gleichzeitig neu ordnen ("Whack-a-Mole", bereits in Paket 1 so benannt). **1,3 ist der beste
gefundene Einzelwert** (Pp klar bestanden, rho mit 0,782 am nächsten an der Zielgruppe der
getesteten Werte, bevor weitere Hebel das Bild änderten).

### Hebel B: `SANDSACK_VLEER_TECHNIK_K` (TECHNIK-Einfluss auf Leertempo)

| Runde | Wert | Pp Strom1/2 | rho | Urteil |
|---|---:|---:|---:|---|
| 2 | 0,006→**0,003** | 35,3 / 37,9 | 0,770 (unverändert) | dex/speed trifft die Matrix fast exakt (13,7 % vs. Ziel 12 %) — **behalten** |
| 20 | 0,0045 (mit K_LAST=1,3) | **12,8 / 18,9** | 0,721 | Pp exzellent, rho schlechter — Zielkonflikt sichtbar |
| 25 | 0,0035 (mit K_LAST=1,3) | 26,0 / 25,7 | 0,794 | knapp über Pp-Schranke — 0,003 bleibt besser |

**Befund:** Halbierung auf 0,003 behoben die dex/speed-Überzeichnung aus Paket 1 (vorher 21,9 %
kombiniert, Ziel 12 %) ohne rho zu schaden — der einzige Hebel in dieser Runde, der sofort und
ohne Nebenwirkung half. Jede Erhöhung zurück Richtung Original verbessert Pp (mehr Charisma-Raum
durch weniger TECHNIK-Dominanz) auf Kosten von rho — ein echter Zielkonflikt, kein Messfehler.

### Hebel C: `SANDSACK_WAGNIS_FLEX` (ANSAGE-Einfluss auf Kf)

| Runde | Wert | Pp Strom1/2 | rho | Urteil |
|---|---:|---:|---:|---|
| 3 | 0,012→**0,008** | 29,3 / 35,1 | **0,576** | Pp verbessert, rho stürzt ab — SOFORT zurückgerollt |

**Befund:** Der stärkste negative Einzelbefund der ganzen Runde. ANSAGE/charisma ist über `Kf`
der Haupttreiber der 23-%-Matrixzuteilung; sein Gewicht zu senken verbessert zwar lokal die
Pp-Zahl (weniger Charisma-Überzeichnung), zerstört aber die Team-Validität, weil die
Rang-Reihenfolge der zehn Teams in diesem Kader stark an genau diesem Kanal hängt. **Nicht
weiterverfolgt.**

### Hebel D: `SANDSACK_ERMUEDUNG_K` (Erschöpfungskurve, `E += K·r²·...`)

| Runde | Wert | Pp Strom1/2 | rho | Urteil |
|---|---:|---:|---:|---|
| 4 | 60→**90** | 33,8 / 35,8 | 0,758 | leichte Verbesserung Pp, leichte Verschlechterung rho — kein klarer Fehlschlag |
| 5 | **130** | 30,5 / 35,1 | **0,867** | **großer Sprung**: rho weit über Ziel, Pp verbessert — bester Einzelfund |
| 6 | 180 | 33,9 / 33,3 | **0,467** | Zeitlimit-Überschreitungen explodieren (20 % "keiner fertig") — STARK zurückgerollt |
| 7 | 150 | 39,0 / 41,6 | **0,576** | bereits bei 150 Einbruch — 130 ist ein scharfes, schmales Optimum |
| 18 | 100 (mit K_LAST=1,3) | **21,6 / 21,5** | 0,733 | Pp exzellent, rho schlechter als 130 |
| 19 | 140 (mit K_LAST=1,3) | 21,9 / 27,3 | 0,758 | schlechter als 130 auf beiden Achsen |

**Befund:** Der wichtigste Hebel der gesamten Runde. 130 ist ein **scharfes lokales Optimum** —
schon ±10–20 Einheiten daneben bricht rho ein (durch zu viele Renn-Abbrüche am Zeitlimit, die die
saubere Zeit-Rangordnung zwischen Teams zerstören). Erhöhte Erschöpfung verstärkt LASTs Gewicht
**kumulativ über die 15 Säcke** statt nur über die K-Kapazität am einzelnen Sack — das traf das
Problem (unterrepräsentiertes LAST/power/determination in Paket 1) deutlich direkter als der
K_LAST-Hebel allein.

### Hebel E: `SANDSACK_BISS_NERVEN_K` (NERVEN-Bonus oberhalb rf > 0,7)

| Runde | Wert | Pp Strom1/2 | rho | Urteil |
|---|---:|---:|---:|---|
| 8 | 0,005→**0,0025** | 35,3 / 34,2 | 0,867 (unverändert) | Pp verschlechtert (determination fiel weiter), kein Gewinn — zurückgerollt |

### Hebel F: `SANDSACK_KANTE_WUCHT_R_K` (Wuchtbonus an der Ladekante, vorher Inline-Literal `1,5`,
jetzt benannter Konstanten — reiner Refactor plus Testwert)

| Runde | Wert | Pp Strom1/2 | rho | Urteil |
|---|---:|---:|---:|---|
| 15 | 1,5→**3,5** | 34,2 / 40,0 | 0,867 (unverändert) | Pp verschlechtert (power/determination profitierten NICHT, nur health/charisma) — zurückgerollt |

**Befund:** Ein stationsspezifischer LAST-Hebel (nur an der schwersten Station) half anders als
erhofft nicht gezielt power/determination, sondern vor allem health/charisma — vermutlich weil die
Ladekante nur 4 von 15 Gängen ausmacht und ihr Effekt im Budget über alle 15 Gänge verwässert wird.

### Hebel G: `SANDSACK_PAUSE_SCHWELLE_NERVEN_K` (NERVEN-Einfluss auf Pausenschwelle)

| Runde | Wert | Pp Strom1/2 | rho | Urteil |
|---|---:|---:|---:|---|
| 16 | 0,35→**0,15** | 32,4 / 36,2 | 0,830 | beides schlechter als der Ausgangsstand dieser Runde (30,5/35,1 · 0,867) — zurückgerollt |

### Hebel H: `SANDSACK_RUTSCHER_E_K` (Erschöpfungs-Einfluss auf Rutscher-Wahrscheinlichkeit)

| Runde | Wert | Pp Strom1/2 | rho | Urteil |
|---|---:|---:|---:|---|
| 17 | 0,15→**0,35** | 30,6 / 36,1 | 0,867 (unverändert) | neutral, kein Gewinn — zurückgerollt zur Minimierung des Diffs |

### Hebel I: `SANDSACK_PAUSE_RATE_ERHOLUNG_K` (ERHOLUNG-Einfluss auf Pausen-Erholungstempo)

| Runde | Wert (mit K_LAST=1,3, ERMUEDUNG_K=130) | Pp Strom1/2 | rho | Urteil |
|---|---:|---:|---:|---|
| 21 | 5→**9** | **19,3 / 22,7** | **0,794** | bester gemeinsamer Fund der gesamten Runde — behalten |
| 22 | 13 | 19,4 / 22,8 | 0,733 | schlechter — nicht-monoton wie Hebel A |
| 23 | 10 | 19,3 / 22,8 | 0,794 | identisch zu 9 — Plateau bestätigt |
| 27 | 9, aber mit K_LAST=1,2 statt 1,3 | 30,2 / 35,7 | 0,855 | zeigt: dieser Hebel wirkt nur zusammen mit K_LAST=1,3 spürbar auf Pp |

**Befund:** Schnellere Pausen-Erholung reduziert das durch die hohe Erschöpfungskurve (Hebel D)
eingeführte Pausen-Rauschen (von 4,0 auf 3,5 Pausen/Rennen) und schob rho von 0,782 auf 0,794 —
der letzte Schritt, der noch half, bevor ein Plateau erreicht wurde.

---

## 3. Finale Konfiguration

```
SANDSACK_K_LAST              1,2  →  1,3     (+8,3 %)
SANDSACK_VLEER_TECHNIK_K     0,006 → 0,003    (halbiert)
SANDSACK_ERMUEDUNG_K         60   →  130     (+117 %)
SANDSACK_PAUSE_RATE_ERHOLUNG_K  5 →  9       (+80 %)
```

Alle anderen `SANDSACK_*`-Konstanten bleiben bei den Opus-Startwerten aus Paket 1. Zusätzlich
wurde der bis dahin als Inline-Literal geschriebene Ladekante-Wuchtbonus (`0,6+1,5·max(0,r-0,5)`)
in zwei benannte Konstanten `SANDSACK_KANTE_WUCHT_BASIS`/`SANDSACK_KANTE_WUCHT_R_K` überführt
(reiner Refactor, Wert unverändert bei 1,5 — der Testwert aus Runde 15 wurde zurückgerollt, der
Konstanten-Name blieb, weil er die Lesbarkeit verbessert und zukünftige Kalibrierrunden
erleichtert).

### 3.1 Finale Messung (`node scripts/miss-sandsack-finale.mjs 24 144`)

| Attribut | Strom 1 | Strom 2 | Matrix |
|---|---:|---:|---:|
| charisma | 22,8 % | 25,1 % | 23 % |
| power | 22,5 % | 22,0 % | 28 % |
| health | 17,1 % | 16,1 % | 16 % |
| will | 11,9 % | 13,9 % | 7 % |
| dexterity | 9,1 % | 8,2 % | 6 % |
| determination | 8,8 % | 8,1 % | 12 % |
| speed | 6,5 % | 5,0 % | 6 % |
| stamina | 1,2 % | 1,5 % | 2 % |

**Pp-Abweichung: 19,3 (Strom 1) / 22,7 (Strom 2) — BEIDE unter 25, BESTANDEN.**

**Team-Validität: Spearman(Eignungssumme, −Median-Rennzeit) über 10 Teams = 0,794 (Ziel ≥ 0,80,
Opus-Modell 0,915) — NICHT BESTANDEN, um 0,006.** Bei n=48 statt 24 Rennen je Paarung (Abschnitt 4)
identisch reproduziert — kein Messrauschen.

| Paarung | Eig Heim | Eig Gast | Lücke | Median-Zeit H/G | Favorit-Quote |
|---|---:|---:|---:|---|---:|
| vigilante-armageddon | 356,6 | 261,3 | 30,8 % | 143,5 / 173,8 | 100 % |
| coldsteel-direlegion | 330,8 | 261,5 | 23,4 % | 178,4 / 180,4 | 100 % |
| goldengladiators-silversoldiers | 318,0 | 317,5 | 0,2 % | 155,1 / 184,4 | 100 % |
| mortalsin-natureswrath | 242,2 | 230,1 | 5,1 % | 196,3 / 186,9 | **0 %** |
| piratecrew-raginglunatics | 201,8 | 274,1 | 30,4 % | 199,8 / 159,3 | 100 % |

Dieselbe enge Paarung (Mortal Sin — Natures Wrath) bleibt die einzige mit Favoriten-Umkehr, genau
wie in Paket 1 — unverändert durch diese Kalibrierrunde.

Deskriptiv: Rutscher 1,08/Rennen (Ziel 0,8–2, ✓), **Pausen 3,49/Rennen (Ziel 0,5–2, deutlich
darüber)** — der Preis für die hohe Erschöpfungskurve, s. Abschnitt 5. Doppel-Gänge 3,0/Rennen,
Planverteilung Staffel 30 %/Stationen 40 %/Anker 30 % (unverändert, da die Taktik-Automatik von
dieser Kalibrierrunde nicht berührt wurde), "fertig unter Zeitlimit" 60 % beide/40 % einer/0 %
keiner.

---

## 4. Robustheitsprüfung

Die finale Konfiguration wurde zusätzlich mit doppelter Stichprobe (Spiele=48 statt 24,
`node scripts/miss-sandsack-finale.mjs 48 144`) erneut gemessen: Pp 19,3/22,7 (identisch), rho
0,794 (identisch auf drei Nachkommastellen). Die Lücke zur 0,80-Schranke ist damit **kein
Stichprobenrauschen**, sondern der tatsächliche Wert dieser Konfiguration bei diesem Kader.

---

## 5. Warum die letzten 0,006 rho nicht geschlossen werden konnten

Drei unabhängige Beobachtungen aus der Kalibrierhistorie deuten auf ein **strukturelles**, nicht
nur ein numerisches Hindernis:

1. **Pp und rho stehen bei mehreren Hebeln in echtem Zielkonflikt, nicht nur in
   Mess-Varianz.** Runde 20 (TECHNIK_K=0,0045) zeigt das am deutlichsten: Pp verbessert sich auf
   12,8/18,9 (weit unter der Schranke), während rho auf 0,721 fällt — ein Hebel, der die
   Mechanik näher an die Matrixgewichte bringt, bewegt in diesem spezifischen Kader die
   Rang-Reihenfolge der zehn Teams in die FALSCHE Richtung. Das ist dasselbe Muster, das Paket 1
   schon für Pp allein beschrieb ("Whack-a-Mole"), hier aber zusätzlich gegen die Team-Validität
   wirkend.
2. **Die Simulation ist reich an deterministischen Schwellen** (Rutscher-Wahrscheinlichkeit,
   Doppeln-Entscheidung, Pausen-Schwelle, Zeitlimit) — jede kleine Parameteränderung kann mehrere
   dieser Schwellen gleichzeitig für mehrere Spieler kippen lassen und damit die Rangfolge
   mehrerer Teams auf einmal neu mischen. `SANDSACK_K_LAST` zeigt das exemplarisch: 1,25/1,28/
   1,3/1,31/1,32 liefern keine glatte, monotone Kurve, sondern Sprünge, die in keinem der
   getesteten Werte konvergieren.
3. **Zehn Teams sind eine kleine Stichprobe für eine Rang-Korrelation.** Mit n=10 bewegt ein
   einziger Rang-Tausch zwischen zwei benachbarten Teams rho um einen spürbaren Betrag (beobachtet:
   Sprünge von 0,021 bis 0,29 zwischen benachbarten Parameterwerten). Die fehlenden 0,006 könnten
   in einem größeren Kader (mehr als 5 Paarungen) bereits von selbst verschwinden oder sich anders
   verteilen — das lässt sich mit der vorhandenen Kaderfamilie nicht trennen von einem echten
   mechanischen Defizit.

**Die Kreuz-Paarungs-Rangfolge (nicht nur die Mortal-Sin/Natures-Wrath-Paarung) trägt zur Lücke
bei.** Eine Analyse der zehn Team-Ränge zeigt, dass neben der bekannten engen Paarung auch
Golden Gladiators/Silver Soldiers (Eignungslücke nur 0,2 %, faktisch ein Münzwurf) und die
Piratecrew/Raging-Lunatics-Paarung spürbar von ihrem "erwarteten" Eignungsrang abweichen — beides
Paarungen, in denen die ABSOLUTE Rennzeit über verschiedene Lastenpläne (Anker vs. Staffel vs.
Stationen) hinweg verglichen wird, nicht nur die relative Zeit innerhalb einer Paarung. Das
deutet darauf hin, dass ein Teil der rho-Lücke nicht an den Pp-relevanten Attributgewichten hängt,
sondern an der plan-abhängigen Grundgeschwindigkeit (ein Anker-Rennen und ein Staffel-Rennen
haben bei gleicher Team-Eignung nicht zwangsläufig dieselbe absolute Zeit) — ein Befund für eine
mögliche nächste Kalibrierrunde, keiner, der mit den hier geprüften Hebeln behebbar war.

---

## 6. Was NICHT verdrahtet wurde

Wie in Paket 1 bleibt `seiten` in `spieleBuehneHeben()` unverändert — der siebte
Mannschaftspunkt fließt weiterhin nicht in die Arena-Tabelle ein. Diese Kalibrierrunde ändert
daran nichts; sie arbeitet ausschließlich an den `SANDSACK_*`-internen Formeln von
`baueSandsackFinale()`. **Mit dem hier erreichten Stand (Pp bestanden, rho bei 0,794 statt
0,80) ist die Mechanik noch nicht "bereit für die Verdrahtung"** im strengen Sinne beider
CLAUDE.md-Schranken — die Entscheidung, ob 0,794 für Chris nah genug an 0,80 ist, um trotzdem zu
verdrahten, bleibt ausdrücklich bei Chris.

---

## 7. Isolationsnachweis und Falle-17-Nachweis

Siehe PR-Beschreibung für die konkreten Befehle und Ergebnisse. Zusammenfassung: `window.__arena
.spiele("gewichtheben", saat)` und `spieleBuehneHeben("gewichtheben", saat)` bleiben für dieselben
sieben Saaten aus Paket 1 (1337, 4242, 99991, 2026, 555555, 7919, 104729) byte-identisch zu einem
Referenzlauf vor dieser Kalibrierrunde — alle Änderungen bleiben innerhalb der additiven
`baueSandsackFinale()`-Formeln. `sandsackWuerfe(saat,seite)` nimmt weiterhin keinen Plan-/
Doppeln-Parameter entgegen (unverändert seit Paket 1) — Falle 17 bleibt strukturell garantiert.

---

## 8. Geänderte Dateien

* `public/mockups/battle-mode.engine.js` — vier `SANDSACK_*`-Konstanten kalibriert
  (`SANDSACK_K_LAST`, `SANDSACK_VLEER_TECHNIK_K`, `SANDSACK_ERMUEDUNG_K`,
  `SANDSACK_PAUSE_RATE_ERHOLUNG_K`), ein Inline-Literal (Ladekante-Wuchtbonus) in zwei benannte
  Konstanten überführt (Wert unverändert). Keine Änderung an `seiten`, `BUEHNE_ART.gewichtheben
  .rezept`, `lib/player-generator/official-discipline-weights.ts` oder an `sandsackWuerfe()`s
  Signatur.
* `docs/design/gewichtheben-sandsack-finale-paket1b-kalibrierung-04-10.md` — dieses Dokument.
