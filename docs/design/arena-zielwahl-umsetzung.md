# Arena-Zielwahl auf Bedrohung (K1) — zwei Anlaeufe, keiner nachweisbar besser (ehrlich dokumentiert)

Auftragsgrundlage: `docs/design/arena-duell-recherche-fable.md` Abschnitt 1.2/2.2 (Diagnose) und
`docs/design/arena-mini-dm-tdm-battlefield-rollout-plan.md` Abschnitt 4.1 (Option A, die
empfohlene, konkrete Umsetzung), gegengelesen mit `docs/design/stand-aller-disziplinen.md`
Abschnitt 5a. Reine Zielwahl-Aenderung im gemeinsamen Arena-Chassis (`chooseTarget`,
`PERSZIEL`), **nichts an der Schlagfrequenz** (`cdKuerzung`/`abkling`) angefasst — das bleibt
laut CLAUDE.md und dem Kommentar an der Stelle (Chris' Eslabong-Zitat) Chris' Entscheidung.

**Ergebnis vorweg: nicht committet.** Beide getesteten Varianten von K1 (Option A) bewegen
TDM gar nicht und verschlechtern Mini-DM und Battlefield kaderfest gemessen, teils deutlich
ausserhalb der eigenen Kader-Spannweite. `battle-mode.engine.js` steht unveraendert auf dem
`origin/main`-Stand. Dieser Bericht dokumentiert, was versucht wurde, warum es vermutlich
scheitert, und was ein naechster Anlauf anders machen muesste.

---

## 1) Was gebaut wurde

### Variante 1 — reine Hysterese auf der bestehenden `bedrohungVon`

`PERSZIEL` (`engine.js:2857`) liess bisher drei der sechs Persoenlichkeiten (`bollwerk`,
`draufgaenger`, `beschuetzer`) standardmaessig auf `"naechster"` zielen — genau die
Geometrie-Zielwahl, die Fable als Ursache diagnostiziert hat (264 von 288 Kaempfern).
Umgestellt auf `"bedrohung"`, wie in Option A vorgeschlagen:

```js
const PERSZIEL={bollwerk:"bedrohung",draufgaenger:"bedrohung",duellant:"bedrohung",
  schleicher:"hinten",beschuetzer:"bedrohung",opportunist:"schwach"};
```

Dazu eine Hysterese nach TrinityCore-Vorbild (`ThreatManager::ReselectVictim`, s. Fables
Recherche Abschnitt 1.2, GPL-2.0+ — nur die Regel nachgebaut, kein Code uebernommen): ein
Ziel wird nur gewechselt, wenn ein anderer Gegner mehr als 110 % seiner Bedrohung traegt,
sonst bleibt der Kaempfer beim aktuellen Ziel. Eingebaut als eine Hilfsfunktion, die an allen
drei Stellen genutzt wird, die vorher `foes.reduce((b,x)=>bedrohungVon(x)>bedrohungVon(b)?x:b)`
direkt aufgerufen haben (Flanke, `zielP==="bedrohung"`, Persoenlichkeits-Grundneigung):

```js
const ZIEL_HYSTERESE=1.10;
const bedrohtester=(u,foes)=>{
  const top=foes.reduce((b,x)=>bedrohungVon(x)>bedrohungVon(b)?x:b);
  const aktuell=u.tgt;
  if(aktuell&&!aktuell.down&&foes.includes(aktuell)&&
     bedrohungVon(top)<=bedrohungVon(aktuell)*ZIEL_HYSTERESE){
    return aktuell;
  }
  return top;
};
```

`bedrohungVon` selbst blieb unangetastet: `u.st.dmg+u.st.heal*0.6+u.st.ko*120` — die Formel,
die Fables Recherche bereits als plausibel eingestuft hatte.

### Variante 2 — dieselbe Hysterese, plus ein sichtbarer Basiswert

Variante 1 zeigte fuer Mini-DM einen Einbruch auf praktisch Zufallsniveau (Abschnitt 2). Der
vermutete Grund (Abschnitt 3): `bedrohungVon` ist zu Kampfbeginn fuer alle Kaempfer exakt 0
(niemand hat noch getroffen, geheilt oder K.o. geschlagen), also entscheidet `reduce()` per
Array-Reihenfolge, nicht nach Staerke — ein Konstruktions-Patt, das bei vier Kaempfern pro
Seite (Mini-DM/Battlefield) einen groesseren Anteil des ganzen Spiels praegt als bei sechs
(TDM). Variante 2 gibt jedem Kaempfer einen sichtbaren Basiswert aus seinem eigenen, bereits
im Motor vorhandenen `ANG`-Wert (kein Blick auf `eig` — das waere die gemessene Groesse selbst
gewesen, keine Beobachtung, die eine Einheit im Kampf machen koennte):

```js
const bedrohungVon=(u)=>u.ANG*0.5+u.st.dmg+u.st.heal*0.6+u.st.ko*120;
```

`u.ANG` liegt typischerweise um `BASISMITTE=50` (`engine.js:11842`); der Faktor 0,5 gibt zu
Kampfbeginn eine Bandbreite von einigen Punkten Unterschied, die von den akkumulierten
Kampfwerten binnen weniger Sekunden ueberholt wird — ein Tie-Breaker mit abnehmendem Gewicht,
kein neuer dominanter Kanal.

---

## 2) Gemessen — `node scripts/miss-alle-disziplinen.mjs 24 tdm mini-dm battlefield [basketball gewichtheben]`

Kader-Quelle in allen Laeufen: `data/generated/kaderfamilie-live-save.json` (fuenf echte
Team-Paarungen, s. `docs/design/messgrundlage-kaderfest.md`), n=24 je Variante, kaderfester
Median + Spannweite.

### Baseline (unveraendert `origin/main`, `77054c93`) — deckt sich mit `stand-aller-disziplinen.md`

| Disziplin | rho je Spiel (Median) | Spannweite | rho Saison (Median) | Spannweite |
|---|---:|---:|---:|---:|
| TDM | 0,113 | 0,387 | 0,070 | 0,441 |
| Mini-DM | 0,269 | 0,802 | 0,500 | 1,167 |
| Battlefield | 0,325 | 0,662 | 0,619 | 1,000 |
| Basketball (Regression) | 0,757 | 0,102 | 0,923 | 0,231 |
| Gewichtheben (Regression) | 0,720 | 0,223 | 0,860 | 0,245 |

### Variante 1 (Hysterese, `bedrohungVon` unveraendert)

| Disziplin | rho je Spiel | Δ vs. Baseline | Spannweite | rho Saison | Δ vs. Baseline | Spannweite |
|---|---:|---:|---:|---:|---:|---:|
| TDM | 0,113 | **±0,000** | 0,269 | 0,070 | ±0,000 | 0,455 |
| Mini-DM | **−0,036** | **−0,305** | 0,678 | **0,000** | **−0,500** | 1,048 |
| Battlefield | 0,351 | +0,026 | 0,599 | 0,548 | **−0,071** | 0,857 |
| Basketball | 0,757 | ±0,000 | 0,102 | 0,923 | ±0,000 | 0,231 |
| Gewichtheben | 0,720 | ±0,000 | 0,223 | 0,860 | ±0,000 | 0,245 |

### Variante 2 (Hysterese + ANG-Basiswert)

| Disziplin | rho je Spiel | Δ vs. Baseline | Spannweite | rho Saison | Δ vs. Baseline | Spannweite |
|---|---:|---:|---:|---:|---:|---:|
| TDM | 0,092 | −0,021 | 0,390 | 0,140 | +0,070 | 0,664 |
| Mini-DM | 0,007 | −0,262 | 0,706 | 0,190 | −0,310 | 0,786 |
| Battlefield | 0,282 | −0,043 | 0,534 | 0,452 | −0,167 | 1,095 |

**Basketball und Gewichtheben bit-identisch in beiden Varianten** — der erwartete
Regressionsnachweis: `chooseTarget`/`PERSZIEL`/`bedrohungVon` sind Arena-only, Feldspiel- und
Buehnen-Chassis laufen ueber andere Funktionen und wurden nicht angefasst.

**Keine der beiden Varianten hebt irgendeine der drei Zieldisziplinen ueber die eigene
Kader-Spannweite hinaus.** TDM bewegt sich in Variante 1 um exakt 0,000 (Median identisch,
nur die Spannweite selbst veraendert sich) — die Aenderung erreicht bei sechs Kaempfern pro
Seite den Median schlicht nicht. Mini-DM und Battlefield bewegen sich in beiden Varianten nach
UNTEN, bei Mini-DM in Variante 1 um das 2,7-fache mehr, als die CI-Schranke
(`data/generated/rangtreue-basislinie.json`: Mini-DM-Schranke 0,241) tolerieren wuerde — das
ist kein Rauschen, das ist eine gemessene Verschlechterung.

---

## 3) Warum es vermutlich scheitert — eine Vermutung, keine abschliessend gepruefte Ursache

`bedrohungVon(u) = dmg + heal·0,6 + ko·120` ist **rein reaktiv**: sie existiert nur aus dem,
was ein Kaempfer bereits BEWIRKT hat. Zu Kampfbeginn ist sie fuer jeden Kaempfer exakt 0.
`foes.reduce((b,x)=>bedrohungVon(x)>bedrohungVon(b)?x:b)` gibt bei durchgehender Gleichheit
den ERSTEN Kandidaten im Array zurueck (`>` statt `>=`) — die Zielwahl fuer die ersten
Sekunden eines Gefechts ist damit keine Bedrohungsentscheidung, sondern eine
Array-Reihenfolge-Entscheidung, die von der Slot-Aufbaureihenfolge abhaengt, nicht von der
Eignung. Bei vier Kaempfern pro Seite (Mini-DM, Battlefield) ist der Anteil des Spiels, den
diese Anfangsphase ausmacht, strukturell groesser als bei sechs (TDM) — passend dazu blieb TDM
in Variante 1 unbewegt, waehrend Mini-DM einbrach.

Sobald der erste Treffer faellt, verstaerkt sich das Problem eher, als dass es sich aufloest:
wer zuerst trifft, wird als Erster "bedrohlich" und zieht dadurch MEHR Angreifer auf sich, was
ihn schneller fallen laesst, was wiederum den naechsten Zufalls-Fuehrenden hervorbringt — eine
positive Rueckkopplung auf einer Zufallsgroesse (wer zuerst traf), nicht auf der Eignung.
Genau das ist der Unterschied zu TrinityCores Bedrohungssystem, das diesen Bericht als Vorbild
zitiert: dort gibt es einen dauerhaften Bedrohungs-Ozean aus permanenten Quellen (Tank-Haltung,
Aggro-Reichweite, Fernkampf-Ziehung durch Heilung), nicht nur akkumulierten Schaden — unser
`bedrohungVon` hat kein Aequivalent zu dieser Baseline.

Variante 2 versucht genau das zu reparieren (ein von Anfang an vorhandener, ANG-basierter
Basiswert statt eines Nullpunkts) — und wird trotzdem NICHT besser, sondern in allen drei
Disziplinen schlechter als Variante 1. Eine moegliche Erklaerung: der ANG-Basiswert allein
korreliert selbst nur maessig mit der Gesamteignung (ANG ist ein abgeleiteter Kampfwert, nicht
`eig` selbst, und die drei Zieldisziplinen nutzen unterschiedliche Matrizen mit
unterschiedlichem ANG-Gewicht) — er ersetzt das Array-Reihenfolge-Problem am Anfang durch ein
neues, das Konzentration auf denselben, ANG-staerksten Gegner ueber das GANZE Spiel triggert,
nicht nur am Anfang. Das ist eine Vermutung, keine durchgemessene Ursache — sie wuerde eine
eigene, kleinere Sonde brauchen (z. B. rho zwischen `u.ANG` und `eig` je Disziplin, und eine
Messung der tatsaechlichen Ziel-Konzentration ueber die Spielzeit), die in dieser Runde nicht
mehr gebaut wurde.

---

## 4) Was das fuer den naechsten Anlauf bedeutet

**Nicht noch eine Parameter-Variante auf demselben Ansatz.** Beide getesteten Formeln
(`dmg+heal·0,6+ko·120` und `ANG·0,5+dmg+heal·0,6+ko·120`) sind reine additive Score-Vergleiche
ohne Bezug zur Position — genau die Familie, vor der Fables Recherche selbst warnt (Abschnitt
1.2: Warzone 2100s `targetAttackWeight` kombiniert Bedrohung MIT einem Distanz-Abzug, gerade
damit ein Score nicht rein auf einer Zufallsgroesse kippt). Ein dritter Versuch sollte an
diesem strukturellen Punkt ansetzen, nicht an einer weiteren Gewichtsverschiebung:

- **Distanz als Tie-Breaker statt purer Bedrohungsvergleich** (Warzone-2100-Vorbild, additiv:
  `bedrohungVon(x) − k·dist(u,x)`) — das wuerde das Array-Reihenfolge-Patt am Kampfbeginn durch
  eine geometrisch plausible Entscheidung ersetzen, ohne auf `eig` zu schauen.
- **Eine zeitlich abklingende Anfangs-Randomisierung statt eines festen Basiswerts** —
  gaebe jedem Kaempfer in den ersten ein bis zwei Sekunden eine leicht unterschiedliche,
  aber NICHT positionsabhaengige Ausgangsbedrohung, die schnell von echten Kampfwerten
  ueberholt wird, ohne eine neue dauerhafte Vorliebe fuer bestimmte Statur-Profile zu erzeugen.
- **Erst eine eigene, kleine Sonde bauen** (Ziel-Konzentration ueber die Spielzeit, analog zu
  Fables `kampfSonde`, s. `arena-duell-recherche-fable.md` Abschnitt 0.2), BEVOR eine weitere
  Formel-Variante gemessen wird — sonst wird, wie hier, jede Variante nur am Gesamtergebnis
  erraten, nicht an der eigentlichen Ursache.

**TDM braucht ohnehin einen anderen Hebel.** In beiden Varianten bewegte sich TDMs Median
praktisch gar nicht (0,113→0,113→0,092) — bei sechs Kaempfern pro Seite verduennt sich der
Effekt einer reinen Zielwahl-Aenderung staerker, als die Rechnung aus
`arena-mini-dm-tdm-battlefield-rollout-plan.md` Abschnitt 1.3 nahelegt (der Rezept-Kommentar
selbst vermutet dort eher ein `aufEignung`/TMP-AUS-Normierungsproblem als ein
Zielwahl-Problem) — dieser Bericht bestaetigt das eher, als dass er es widerlegt.

---

## 5) Was geprueft wurde

- `node --check public/mockups/battle-mode.engine.js` — beide Varianten syntaktisch sauber
  waehrend des Baus; der finale Stand ist unveraendert `origin/main` (`git diff --stat` leer).
- `node scripts/miss-alle-disziplinen.mjs 24 tdm mini-dm battlefield basketball gewichtheben`
  fuer die Baseline und Variante 1 (voller Fuenf-Disziplinen-Lauf, Basketball/Gewichtheben als
  Regressionsnachweis bit-identisch), `... tdm mini-dm battlefield` fuer Variante 2 (dieselbe
  Regression war durch Variante 1 bereits erbracht, `chooseTarget`/`PERSZIEL`/`bedrohungVon`
  sind Arena-only und wurden zwischen den Varianten nicht in einer Weise geaendert, die
  Feldspiel/Buehne beruehren koennte).
- `npm test` — s. Testlauf-Protokoll dieser Runde; keine neuen Fehlschlaege gegenueber
  `origin/main`, weil am Ende keine Zeile Motor-Code im Commit steht.
- **Nicht committet**: `battle-mode.engine.js` steht auf dem unveraenderten `origin/main`-Stand.
  Beide Varianten sind in diesem Bericht vollstaendig genug spezifiziert, um sie ohne
  Code-Archaeologie erneut zu bauen.

## Empfehlung

Wie bei `docs/design/hockey-ueber-080-versuch2.md`: nicht mergen, ehrlich als „versucht,
gemessen, nicht besser" verbuchen. TDM/Mini-DM/Battlefield bleiben bei den in
`stand-aller-disziplinen.md` dokumentierten Zahlen (0,113 / 0,269 / 0,325). Der naechste
Anlauf sollte laut Abschnitt 4 eine Distanz- oder Zeit-Komponente in die Bedrohungsformel
aufnehmen und VOR der naechsten Rangtreue-Messung eine eigene Ziel-Konzentrations-Sonde bauen
— sonst wiederholt er denselben Rate-Zyklus, den dieser Bericht dokumentiert.
