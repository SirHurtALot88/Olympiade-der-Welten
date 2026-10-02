# Bahn Paket 2 "Takeshi Pp schließen": Diagnose-Befund, kein Code geändert (Task #28, 01.10.)

Folgerunde auf `docs/design/fable-ideen-bahn-30-09.md` Abschnitt 5 ("Takeshi: erst messen,
dann reden"). Takeshi's Castle war die letzte verletzte Bahn-Pp-Abnahme ohne Detailtabelle
(Stand-Doku: 36,4 Pp bei n=24, "Kopfzahl vor Timeout gerettet"). Diese Runde zieht zuerst die
Detailtabelle (Fable Abschnitt 5.1), kalibriert dann den dort genannten Ein-Zeilen-Kandidaten
(Abschnitt 5.3, `fallenDurchbruch`) bei vier Werten und misst jedes Mal über zwei unabhängige
Saatströme bei n=48.

## Ergebnis vorab

**Kein getesteter Wert bringt beide Saatströme unter die 25-Pp-Schranke — die Abweichung
bewegt sich mit steigendem `fallenDurchbruch` weder monoton noch stromstabil.** `engine.js`
bleibt deshalb unverändert (reiner Kommentar-Zusatz, keine Codeänderung); dies ist analog zum
Breaking-Performance-Befund (#1106) ein Diagnose-Dokument ohne Kalibrierungs-Commit. Takeshi's
Castle bleibt die letzte verletzte Bahn-Pp-Abnahme des Projekts.

## 1. Diagnose: die Pp-Detailtabelle (Abschnitt 5.1 des Konzeptpapiers)

`node scripts/messe-arena-einfluss.mjs takeshis-castle 48` (Strom 1, Saatversatz 0) und
`node scripts/messe-arena-einfluss-zweiter-saatstamm.mjs takeshis-castle 48` (Strom 2,
Saatversatz 10 000 000), auf `origin/main` (`cd8b7052`), VOR jeder Änderung:

| Attribut | Matrix | Strom 1 (Anteil / Diff) | Strom 2 (Anteil / Diff) |
|---|---:|---:|---:|
| will | 22 | 15,8 % / **-6,2** | 12,7 % / **-9,3** |
| determination | 18 | 20,3 % / +2,3 | 16,2 % / -1,8 |
| charisma | 14 | 17,5 % / +3,5 | 17,0 % / +3,0 |
| intelligence | 11 | 15,3 % / +4,3 | 13,5 % / +2,5 |
| awareness | 8 | 10,8 % / +2,8 | 9,8 % / +1,8 |
| torment | 7 | 9,2 % / +2,2 | 15,6 % / **+8,6** |
| dexterity | 6 | 6,9 % / +0,9 | 4,9 % / -1,1 |
| stamina | 6 | 2,3 % / -3,7 | 4,7 % / -1,3 |
| health | 4 | 1,9 % / -2,1 | 3,8 % / -0,2 |
| speed | 4 | 0 % / -4,0 | 1,8 % / -2,2 |
| **Abweichung (Pp)** | | **32,0** | **31,8** |

**Befund, abweichend von Fables Hypothese (Abschnitt 5.1 war ausdrücklich nur eine
Vermutung):** Nicht Charisma allein, sondern vor allem **Will** (durchgehend das am
stärksten unterzeichnete Attribut — die Matrix führt es mit 22, dem höchsten Einzelgewicht
überhaupt) und **Torment** (stark überzeichnet, mit großer Varianz zwischen den Strömen:
+2,2 gegenüber +8,6, also einer Schwankung von 6,4 Pp bei UNVERÄNDERTEM Code) treiben die
Verletzung. Intelligence ist entgegen der Hypothese ebenfalls überzeichnet (+4,3/+2,5), nicht
unterzeichnet. Charisma ist über beide Ströme konsistent, aber moderat überzeichnet
(+3,5/+3,0).

**Ursache:** Der Durchbruch-Wurf (`wucht`-Erfolgschance, `engine.js:36616-36781`) liest an
ALLEN vierzehn Fallen reine WUCHT (`rezept.WUCHT = {charisma:38, determination:32,
torment:30}`), unabhängig vom Fallentyp (`hindernisTypen`: TECHNIK/WENDIGKEIT/WUCHT/
STEHEN/ROBUST). Der Sauber-Wurf liest seit `fallenKoennen:0.75` (13.09.) bereits zu drei
Vierteln den jeweiligen Fallentyp-Sub-Skill — der Durchbruch-Wurf tat das nie, obwohl der
Motor das Feld dafür bereits kennt (`fallenDurchbruch`, `engine.js:31789`/`:33849`/`:36618`,
ungesetzt). Torment und Charisma sitzen NUR in WUCHT unter den fünf Fallen-Sub-Skills — ein
Wurf, der an jeder der 14 Fallen WUCHT liest, überzeichnet sie deshalb systematisch. Will
dagegen sitzt in TECHNIK (12), STEHEN (46) und ROBUST (30) — drei der vier Nicht-WUCHT-Typen
— fehlt aber im Durchbruch-Wurf komplett, solange der rein WUCHT liest.

## 2. Der Ansatzpunkt: `fallenDurchbruch` (Abschnitt 5.3)

Fables Kandidat: ein einziges, im Motor bereits verdrahtetes Feld setzen.
`engine.js:36616-36621`:

```js
let koennen=u.TECHNIK, durch=u.WUCHT;
if(hTyp){
  const mK=A.fallenKoennen??0, mD=A.fallenDurchbruch??0;
  if(mK)koennen=(1-mK)*u.TECHNIK+mK*hSkill;
  if(mD)durch=(1-mD)*u.WUCHT+mD*hSkill;
}
```

`fallenDurchbruch` war am 06.09. nur für rho gemessen worden (0,874 gegen 0,883 bei
`fallenKoennen` allein — kein rho-Gewinn, deshalb damals nicht gesetzt) und NIE für Pp. An
den vier WUCHT-Fallen ändert ein Setzen nichts (`hSkill` ist dort bereits WUCHT). An den
zehn übrigen Fallen (TECHNIK×4, WENDIGKEIT×2, STEHEN×2, ROBUST×2) mischt der Durchbruch-Wurf
dann zu `mD` Anteilen den Sub-Skill der jeweiligen Falle statt immer WUCHT.

## 3. Messung: vier Werte, zwei Ströme, kein stabiler Treffer

Gemessen mit `scripts/messe-arena-einfluss.mjs` / `-zweiter-saatstamm.mjs`, jeweils n=48,
nacheinander in derselben Konfiguration (`BAHN_ART["takeshis-castle"].fallenDurchbruch`
nach `fallenKoennen:0.75` eingefügt, sonst unverändert):

| `fallenDurchbruch` | Pp Strom 1 (Saatversatz 0) | Pp Strom 2 (Saatversatz 10 000 000) | Beide ≤ 25? |
|---:|---:|---:|---|
| ungesetzt (0) | 32,0 | 31,8 | nein |
| 0,4 | 31,5 | 23,5 | nein (Strom 1) |
| 0,55 | 32,7 | 26,3 | nein (beide knapp drüber) |
| 0,75 | **24,4** | **36,3** | nein (Strom 2 deutlich schlechter als ungesetzt) |

**Das Muster ist weder monoton noch stromstabil.** Strom 1 bleibt bei 0,4/0,55 praktisch
unverändert (31,5/32,7 gegen 32,0 ungesetzt) und fällt erst bei 0,75 deutlich (24,4). Strom 2
verbessert sich bis 0,4 (23,5), verschlechtert sich dann bei 0,55 (26,3) wieder und wird bei
0,75 (36,3) SCHLECHTER als der ungesetzte Ausgangswert. Es gibt keinen der vier getesteten
Punkte, an dem beide Ströme gleichzeitig unter 25 liegen — am nächsten kommt 0,4 (31,5/23,5),
aber Strom 1 bleibt dort praktisch unverändert schlecht.

**Detailtabelle bei 0,75 (der Wert mit dem größten Einzelausschlag), zum Vergleich mit
Abschnitt 1:**

| Attribut | Matrix | Strom 1 vorher→0,75 | Strom 2 vorher→0,75 |
|---|---:|---:|---:|
| will | 22 | -6,2 → **-7,7** | -9,3 → **-7,6** |
| determination | 18 | +2,3 → -1,3 | -1,8 → -2,3 |
| charisma | 14 | +3,5 → **-0,3** | +3,0 → **+1,4** |
| intelligence | 11 | +4,3 → +4,0 | +2,5 → +3,9 |
| awareness | 8 | +2,8 → +2,7 | +1,8 → +2,9 |
| torment | 7 | +2,2 → +2,7 | +8,6 → **+6,2** |
| dexterity | 6 | +0,9 → +2,0 | -1,1 → +2,7 |
| stamina | 6 | -3,7 → -1,3 | -1,3 → -4,3 |
| health | 4 | -2,1 → +0,8 | -0,2 → +1,0 |
| speed | 4 | -4,0 → -1,6 | -2,2 → -4,0 |
| **Pp** | | **32,0 → 24,4** | **31,8 → 36,3** |

Auffällig: In BEIDEN Strömen verbessern sich Will, Charisma und Torment bei 0,75 gegenüber
dem Ausgangswert (bzw. bleiben nahe gleich) — genau die drei Attribute, die die Diagnose in
Abschnitt 1 als Haupttreiber identifiziert hatte. Trotzdem steigt die GESAMT-Pp in Strom 2.
Der Grund liegt in der Messformel selbst (`einflussVon()`, `engine.js:43110`):

```js
const summe=roh.reduce((x,y)=>x+Math.max(0,y.gewinn),0)||1;
const reihen=roh.map(x=>({...x, anteil:...x.gewinn/summe*100...}));
```

Der "Anteil" jedes Attributs ist sein Rohgewinn **relativ zur Summe aller positiven
Rohgewinne**, nicht sein Rohgewinn absolut. `fallenDurchbruch` senkt den ABSOLUTEN
Rohgewinn von Charisma/Determination/Torment an zehn von vierzehn Fallen spürbar (sie tragen
dort nicht mehr zum Durchbruch-Erfolg bei) — das drückt die Summe im Nenner. Ein Attribut,
dessen eigener Rohgewinn davon kaum berührt wird (Intelligence, Dexterity, Stamina in Strom
2), bekommt dadurch einen höheren RELATIVEN Anteil, ohne dass die Mechanik ihm mechanisch
mehr Gewicht gegeben hätte. Bei Strom 2 reicht diese Verschiebung aus, mehrere kleinere
Abweichungen (Intelligence, Dexterity, Health, Stamina, Speed) in Summe stärker zu
verschlechtern, als die drei Haupttreiber sich verbessern — bei Strom 1 reicht die
Verbesserung der drei Haupttreiber dagegen aus, den Gesamtsaldo zu drücken. Welcher Effekt
überwiegt, hängt an den zufälligen Rohgewinnen DIESES Saatstroms, nicht an der Mechanik
selbst — daher die beobachtete Instabilität.

## 4. Einordnung und Empfehlung für die nächste Runde

- **`fallenDurchbruch` allein ist kein robuster Ein-Zeilen-Fix für Takeshis Pp-Verletzung.**
  Es verschiebt real Gewicht in die von der Diagnose richtig identifizierte Richtung (Will
  hoch, Charisma/Torment runter), aber der Normierungs-Nenner der Pp-Messung macht den
  Nettoeffekt seedabhängig und damit nicht vorhersagbar — genau das Verhalten, das die
  CLAUDE.md-Pflicht "≥2 unabhängige Ströme" abfangen soll, und hier auch abgefangen hat.
- **Naheliegender nächster Kandidat, NICHT in dieser Runde versucht:** eine direkte
  Rezept-Kalibrierung von `rezept.WUCHT` selbst (`{charisma:38, determination:32,
  torment:30}` → Torment-Anteil senken, da Torment in JEDEM Strom überzeichnet war, auch
  ohne `fallenDurchbruch`). Das ist dieselbe Art von Eingriff wie die Gewichtheben-ANSAGE-
  Umschichtung (PR #1102) — eine reine Prozent-Umschichtung innerhalb eines Sub-Skills, kein
  neuer Wurf. Anders als `fallenDurchbruch` wirkt das direkt auf die Attributzusammensetzung
  des Sub-Skills selbst, nicht auf einen bedingten Mix-Faktor, und sollte deshalb weniger
  anfällig für den hier gefundenen Normierungs-Effekt sein. Das ist aber eine BREITERE
  Änderung (wirkt auch auf `koennen` an den vier WUCHT-Fallen und auf `tackleAb`/Chaos-
  Mechanik, die ebenfalls `u.WUCHT` lesen) und bräuchte eine eigene, saubere Isolations- und
  Pp/rho-Messrunde — nicht mehr "eine Konfigzeile", sondern ein eigener Kalibrierungs-
  Durchgang.
- **Torments hohe Varianz zwischen den Strömen (+2,2 / +8,6 bereits VOR jeder Änderung) ist
  ein eigener, unabhängiger Befund:** bei n=48 schwankt der gemessene Torment-Einfluss
  erheblich. Jede künftige Takeshi-Pp-Zahl sollte über mindestens zwei Strömen gelesen
  werden, nie über einem — und wo möglich mit mehr als zwei, da schon zwischen zwei
  Strömen hier das Vorzeichen der Gesamtwirkung einer Kalibrierung kippen konnte.

## 5. Isolationsnachweis (die drei anderen Bahn-Disziplinen)

`node scripts/miss-alle-disziplinen.mjs 24 time-trial spurt staffel takeshis-castle`, mit
`fallenDurchbruch:0.4` testweise gesetzt (als Stellvertreter für "irgendein Wert gesetzt" —
das Feld existiert nur in `BAHN_ART["takeshis-castle"]`, kann also keine andere Bahn
berühren):

| Disziplin | rho je Spiel (Median) | Spannweite | vorher (unverändert) |
|---|---:|---:|---|
| time-trial | 0,923 | 0,067 | 0,923 / 0,067 — **bit-identisch** |
| staffel | 0,898 | 0,081 | 0,898 / 0,081 — **bit-identisch** |
| spurt | 0,880 | 0,154 | 0,880 / 0,154 — **bit-identisch** |
| takeshis-castle | 0,861 | 0,114 | 0,871 / 0,125 — bewegt sich (erwartet) |

Time-Trial/Spurt/Staffel sind über alle vier Messgrößen (Median + Spannweite, Einzelspiel
und Saison) exakt identisch zum Vorher-Lauf — die Isolation ist belegt. Da `engine.js` am
Ende dieser Runde UNVERÄNDERT bleibt (reiner Kommentar), ist dieser Nachweis für den
tatsächlich committeten Stand ohnehin gegenstandslos; er dokumentiert nur, dass das Feld,
hätte man es gesetzt, korrekt auf Takeshi beschränkt geblieben wäre.

## 6. Status der Abnahme

Takeshi's Castle bleibt die letzte verletzte Bahn-Pp-Abnahme (Stand-Doku: 36,4 bei n=24,
hier nachgemessen bei n=48 über zwei Ströme: 32,0/31,8, also im selben verletzten Bereich,
die alte Kopfzahl war kein Messartefakt). rho bleibt in jeder getesteten Konfiguration
deutlich über der 0,80-Schranke (0,861-0,886 je nach Wert), die rho-Abnahme ist also nicht
das Problem — die Pp-Abnahme bleibt es.

## Quellen

`docs/design/fable-ideen-bahn-30-09.md` Abschnitt 5 (Takeshi), `docs/design/
stand-aller-disziplinen.md` (Pp-Tabelle, Zeile Takeshi's Castle, 36,4/n=24), `engine.js`
`BAHN_ART["takeshis-castle"]` (`fallenKoennen`/`fallenDurchbruch`-Kommentarblock,
`:34516-34548`), Durchbruch-Wurf (`:36616-36621`, `:36781`), `einflussVon()`
(`:43077-43122`, insbesondere die Positiv-Normierung `:43110`), PR #1102
(Gewichtheben-Kalibrierung, Vorbild für Rezept-Umschichtung als nächsten Schritt), PR #1098
(Climbing-Kalibrierung), #1106 (Breaking-Performance-Befund, Vorbild für reines
Diagnose-Dokument ohne Code-Änderung).
