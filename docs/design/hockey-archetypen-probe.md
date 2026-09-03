# Hockey-Archetypen-Probe: Sniper, Playmaker, Verteidiger, Torwart

Messstand: 2026-09-03, gemessen gegen diesen Branch (`claude/hockey-archetypen-probe`,
Basis `ed675c58`, "Gewichtheben hebt: Reissen und Stossen, Duelle je Slot, Kilogramm
(#748)"). Werkzeug: `scripts/miss-hockey-archetypen.mjs [spiele]`, gemessen mit 40, 48
und 60 Spielen (die drei Läufe sind Ziffer für Ziffer im selben Muster — alle Zahlen
unten sind der 48er-Lauf, sofern nicht anders vermerkt). Reine Messung, **keine**
Änderung an Rezept oder Mechanik.

Methodik nach `docs/design/battle-mode-nba2k-modell-plan.md`, Abschnitte "Rollenprobe V"
und "Rollenprobe S": Spearman über Durchschnittsränge (Pearson auf den Rängen, nicht die
6·Σd²-Kurzformel), Rollenprobe V paarweise je Angreifer mit ≥3 Spielen in beiden
Terzil-Eimern, Rollenprobe S zwingend tier-isoliert. Gemessen am echten Kader
(`window.__arena.feldspielProbe("hockey", {n})`) — Vigilante Wranglers (SQUAD, beste 6
von 11) gegen Armageddon Aftermath (OPP, alle 6), derselbe Kader in jedem Spiel.

**Ergebnis vorweg:** Von vier Archetypen bildet der Motor heute **einen sauber** ab
(Playmaker über AUFBAU), **einen zur Hälfte** (Playmaker über TEAMGEIST ist invertiert),
**einen teilweise** (Verteidiger unterdrückt Tore, aber kaum die Trefferquote) und
**zwei nicht messbar wie gedacht** (Sniper-Fernschuss zeigt keinen Zusammenhang; Torwart
ist an dieser Stelle gar nicht prüfbar, weil die zwei gemessenen "Torwarte" nicht über
PARADE ausgewählt wurden, sondern durch einen Auswahl-Artefakt).

---

## 1) Sniper — SCHUSS_NAH: schwach positiv, SCHUSS_FERN: kein Zusammenhang

**Frage:** Trifft ein Spieler mit hohem SCHUSS_NAH/SCHUSS_FERN auch häufiger, nicht nur
öfter? Tier-isoliert wie Rollenprobe S verlangt: SCHUSS_NAH nur gegen die Nah-Tiers
(`dunk`+`nah`, Hockeys Radien `HK_RADIUS_ABSTAUBER`/`HK_RADIUS_SLOT`), SCHUSS_FERN nur
gegen die Fern-Tiers (`mit`+`fern`, `HK_RADIUS_HOCHSLOT`/`HK_RADIUS_MAX`) — exakt die
Aufteilung, die `schussSkillFuer()` (battle-mode.engine.js:4135) selbst trifft.

| Gruppe | n Spieler (≥8 Versuche) | Spearman(Skill, Trefferquote) | Terzil unten | Terzil oben | dPp |
|---|---:|---:|---:|---:|---:|
| Nah (dunk+nah) | 8 | **0,405** | 8,7 % | 11,2 % | +2,5 |
| Fern (mit+fern) | 10 | **−0,164** | 7,8 % | 8,0 % | +0,2 |

SCHUSS_NAH zeigt die erwartete Richtung, aber schwach (rho 0,36–0,52 über die drei
Läufe, Terzil-Abstand nur 2,5–3,3 Pp). SCHUSS_FERN zeigt **gar keinen** Zusammenhang
(rho −0,08 bis −0,16 über alle drei Läufe, Terzil-Abstand praktisch null) — ein Spieler
mit deutlich höherem SCHUSS_FERN trifft von der blauen Linie nicht öfter als einer mit
niedrigem.

**Wahrscheinliche Ursache, mit Codestelle.** Die Erfolgsformel für JEDEN Wurf — Basketball
wie Hockey — läuft durch dieselbe Funktion `steilerMake()` (battle-mode.engine.js:4223,
aufgerufen in `entscheideBallaktion` bei ~5888 und ~5943):

```
skillTeil = schussSkillFuer(u,tier)*0.0022 + u.TEAMGEIST*0.0030
lage      = -0.02 + GEO_BONUS[tier] - bedraengnisMake
technikMake = sigma(logit(lage+SKILL_MITTEL) + STEIL_MAKE*(skillTeil-SKILL_MITTEL) + MAKE_KORREKTUR[tier])
```

`SKILL_MITTEL=0.2917` (Zeile 4197), `STEIL_MAKE=12` (Zeile 4198) und `MAKE_KORREKTUR`
(dunk/nah/mit/fern, Zeile 4220) sind laut Kommentar an Ort und Stelle **gegen 1074 Basketball-Feldwürfe
gemessene** Konstanten — sie zentrieren die Kurve auf Basketballs SCHUSS_NAH/SCHUSS_FERN-
und TEAMGEIST-Mittelwerte (57,3 bzw. 55,2), nicht auf Hockeys. `GEO_BONUS.fern=0,075` ist
außerdem der kleinste der vier Werte — für die Fern-Stufe bleibt dem Skill-Term darüber
wenig Hebel, bevor `hockeySchussAusgang()` (Zeile 6632) das Ergebnis ein zweites Mal
durch `HK_TOR_SKALA`/`paradeFaktor` (den GEGNERISCHEN Torwart) skaliert. Für Hockey wurde
diese Kurve nie neu vermessen — das ist explizit als offener Punkt vermerkt
(`battle-mode.rezepte.js:437-440`: "Die Gewichte sind … NICHT gegen eine Sondierung
gemessen … Kalibrierung ist Schritt 4 des Hockey-Plans").

**Verdikt: Sniper besteht nicht sauber.** SCHUSS_NAH liefert ein schwaches, aber
richtiges Signal; SCHUSS_FERN liefert keins. Der wahrscheinlichste Kanal ist die geteilte,
basketball-kalibrierte Erfolgskurve — keine Rezept- oder Motoränderung in dieser Probe,
nur die Messung.

---

## 2) Playmaker — AUFBAU besteht, TEAMGEIST ist **invertiert**

**Frage:** Korreliert AUFBAU (bzw. TEAMGEIST) stärker mit Assists als mit eigenen Toren?

| Skill | Spearman(Skill, Assists/Spiel) | Spearman(Skill, Tore/Spiel) | Delta (Assists − Tore) |
|---|---:|---:|---:|
| AUFBAU | **0,580** | 0,073 | **+0,507** |
| TEAMGEIST | **−0,862** | 0,164 | **−1,026** |

(Feldspieler n=10; über die drei Läufe 40/48/60 stabil: AUFBAU-Delta +0,47 bis +0,51,
TEAMGEIST-Delta −0,96 bis −1,12.)

**AUFBAU besteht klar und ist sauber verdrahtet.** Der Kommentar in `entscheideBallaktion`
(Zeile 5811) benennt den Mechanismus selbst: "SPIELMACHER SUCHT ZUERST DEN PASS" —
`suchtPass` (Zeile 5835) lässt einen Spieler mit AUFBAU über 55 eine eigene
Wurf-/Schussgelegenheit zugunsten eines Passes an den offensten Mitspieler liegen. Das ist exakt der Kanal, der einen Vorlagengeber von einem Torschützen trennt,
und er zeigt sich in der Zahl.

**TEAMGEIST fällt durch — und zwar nicht schwach, sondern mit falschem Vorzeichen.**
Ursache, mit Codestelle: TEAMGEIST sitzt in `technikGate` (Zeile 5876):

```
technikGate = min(0.92, 0.16 + u.TECHNIK*0.0050 + u.TEAMGEIST*0.0060 + (imFastbreak?0.12:0))
```

`technikGate` entscheidet, ob ein Spieler in Wurf-/Schussreichweite überhaupt selbst
abschließt (gegen eine mit der Zeit fallende Schwelle `schwelle`). Ein hoher
TEAMGEIST-Wert hebt also die eigene Schussbereitschaft — ein Spieler mit hohem TEAMGEIST
wirft selbst häufiger, statt abzugeben, und produziert dadurch **weniger** Assists, nicht
mehr. Das ist das genaue Gegenteil dessen, was ein "Playmaker über TEAMGEIST"
bräuchte: der Kanal, der TEAMGEIST mechanisch trägt, arbeitet gegen die Rolle.

**Verdikt: Playmaker besteht — aber nur über AUFBAU.** Wer den Archetyp über TEAMGEIST
bauen will, bekommt heute das Gegenteil.

---

## 3) Verteidiger — Tore fallen deutlich, Trefferquote kaum

**Frage:** Wird ein Angreifer gegen einen starken ABWEHR-Decker schwächer (weniger
Torquote, weniger Tore, weniger Schüsse)? Rollenprobe V: Terzile über alle
`deckerAbwehr`-Zuteilungen, gepaart je Angreifer, nur mit ≥3 Spielen in **beiden**
Eimern (9 von 12 Kaderspielern qualifizieren).

| Größe | Wert (n=48) | Wert (n=40) | Wert (n=60) | Referenz (Basketballs Probe V) |
|---|---:|---:|---:|---:|
| ABWEHR-Terzilgrenzen | ≤48 / ≥74 | ≤48 / ≥74 | ≤48 / ≥74 | — |
| dFG% (stark − schwach) | **−2,8 Pp** | −1,8 Pp | −1,9 Pp | Ziel ≤ −8 Pp |
| dTore% (stark/schwach − 1) | **−49,4 %** | −26,9 % | −40,0 % | Ziel ≤ −25 % |
| dSchuesse% (stark/schwach − 1) | **−6,4 %** | −4,3 % | −4,7 % | (kein Basketball-Analog) |

Alle drei Kennzahlen zeigen das richtige Vorzeichen und sind über die drei Stichproben
stabil negativ. Die **Tor-Unterdrückung erreicht oder übertrifft** die für Basketball
kalibrierte Zielmarke von −25 % deutlich. Die **Trefferquoten-Unterdrückung bleibt weit
darunter** (−1,8 bis −2,8 Pp gegen das Basketball-Ziel von ≤ −8 Pp) — ein starker
ABWEHR-Decker macht den Angreifer nicht nennenswert ungenauer, er lässt ihn seltener und
aus schlechteren Lagen abschließen (die Schuss-Unterdrückung von −4 bis −6 % trägt einen
Teil davon, den Rest holt vermutlich die Wurfauswahl selbst — weniger `technikGate`-
Zugriffe unter Bedrängnis).

**Einordnung, mit Codestelle.** Die ABWEHR-Wirkung läuft über `kontestFaktor`
(NBA2K-Eingriff b1, `entscheideBallaktion`, Zeile 5717), skaliert um `KONTEST_PIVOT=57,3`
— wie bei Sniper eine **gegen Basketball gemessene** Konstante (1074 Feldwürfe,
Kommentar bei Zeile 4145), nie für Hockey nachgezogen. Dass die Tor-Zahl trotzdem stark
reagiert, deutet darauf, dass hier vor allem die **Chancenmenge** (Kick-Out-Wahrscheinlichkeit,
Schuss-Selektion) auf ABWEHR reagiert, nicht die Trefferformel selbst.

**Verdikt: Verteidiger besteht überwiegend.** Der Gegner erzielt gegen einen starken
Decker deutlich weniger Tore — das trifft Chris' eigentliches Kriterium ("macht den
Gegner schwächer"). Die Trefferquote selbst bewegt sich kaum, anders als in Basketball.

---

## 4) Torwart — nicht sauber prüfbar: die Probe misst den falschen Kanal

**Frage:** Korreliert GSAA (goals saved above average, `feldspielWert()`,
battle-mode.engine.js:5149/5188-5197) mit der Eignung, getrennt von den Feldspielern?

| Identität | Seite | Spiele | Eig (Mittel) | GSAA (Mittel) | PARADE (Rohwert) |
|---|---:|---:|---:|---:|---:|
| Krolach | 0 | 48 | 63,7 | 2,54 | **71** |
| Tidesprinter | 1 | 48 | 64,8 | 2,12 | **53** |

Spearman(Eig, GSAA) gepoolt über alle 96 Torwart-Spiel-Zeilen: **0,018** (n=40: 0,048;
n=60: −0,005 — über alle drei Läufe praktisch null). Gepaarter Pro-Spiel-Vergleich (wer
hat in DEMSELBEN Spiel die höhere Eignung UND die bessere GSAA): **exakt 50,0 %** in
allen drei Läufen — Münzwurf.

**Das ist kein Befund über die GSAA-Formel — es ist ein Auswahl-Artefakt, präzise
lokalisiert.** `feldspielProbe()` (wie jeder Aufruf ohne gesetzte Aufstellung) baut die
Mannschaft über `bauFeldspiel()`s Rückfall-Pfad: ohne Eintrag in `place[]` bekommt jeder
Spieler seinen Slot **nach Array-Position**, nicht nach Eignung:

```js
// battle-mode.engine.js:4484-4493
const slotFuer=(p,i)=>{
  const gesetzterSlot=(place[p.n]&&place[p.n].d===feldspielDisc)?place[p.n].slot:null;
  if(gesetzterSlot){ … return gesetzterSlot; }
  return (slotListe[i%Math.max(1,slotListe.length)]||{}).id||null;
};
```

Hockeys Slot-Liste (`SLOTS_JE_DISC.hockey`, Zeile 3027-3031) lautet in Deklarationsreihenfolge
`powerforward, defensivewall, goaltender, playmaker, transition, slotfinisher` — **Index 2
ist "goaltender"**. `bestimmeTorwaerter()` (Zeile 5233-5240) übernimmt diesen Slot
**bevor** es je nach PARADE sucht:

```js
let gewaehlt=team.find(u=>u.slotId&&TORWART_SLOTS.has(u.slotId));   // <- greift zuerst
if(!gewaehlt)for(const u of team)if(!gewaehlt||(u.PARADE||0)>(gewaehlt.PARADE||0))gewaehlt=u;
```

`place` ist im Standalone-Mockup (in dem diese Sonde läuft) leer (`const place={}`,
Zeile 8987) und bleibt es, solange niemand eine Aufstellung setzt — also für **jeden**
`feldspielProbe`/`spieleFeldspiel`-Aufruf ohne Lineup. Der dritte Spieler in der
(unsortierten) Kader-Reihenfolge wird damit automatisch zum Torwart, unabhängig von
PARADE. Verschärft wird das durch einen zweiten, stillen Fehler direkt daneben: die
"beste sechs"-Auswahl selbst (`ersatz`, Zeile 4466, `[...SQUAD].sort((a,b)=>(b.d[feldspielDisc]||0)-(a.d[feldspielDisc]||0))`)
sortiert nach `p.d.hockey` — einem Feld, das für **kein** SQUAD-/OPP-Mitglied existiert
(`d:{tdm,spurt}`, s. Kaderdaten Zeile 2609ff.). Der Vergleich liefert für alle Paare 0,
`sort()` ist stabil, also bleibt schlicht die Deklarationsreihenfolge stehen — "die
besten sechs nach Hockey-Wert" ist in Wahrheit "die ersten sechs im Quelltext".

Nachgemessen über `window.__arena.feldspielSubskills("hockey")`: unter den zwölf
gefeldeten Spielern liegen Ralazar the Balanced (73), Krolach (71), Greenkraut (69) und
Seraph-11 (68) bei PARADE vorn. Tatsächlich gefeldet als Torwart wird auf OPP-Seite aber
**Tidesprinter (PARADE 53, der schlechteste Torwart-Kandidat im OPP-Kader)** — einzig
weil er an dritter Stelle im `OPP`-Array steht (Zeile 2628-2630: Greenkraut, Krag'Zul,
**Tidesprinter**, …). Auf SQUAD-Seite trifft es zufällig richtig (Krolach, PARADE 71, an
dritter Stelle), aber das ist Zufall, kein Mechanismus.

**Verdikt: Torwart-Probe nicht aussagekräftig durchgeführt — aber die Ursache ist
gefunden.** Die beiden gemessenen "Torwarte" wurden nicht über PARADE bestimmt, sondern
über ihre Position in einem Array. Eine GSAA-vs.-Eignung-Korrelation über zwei so
zufällig gezogene Identitäten kann prinzipiell nichts über die GSAA-Formel aussagen.
Dieselbe Schwäche (Torwart-Auswahl ohne gesetzte Aufstellung ist Zufall statt PARADE)
betrifft vermutlich jede bisherige headless-Messung ohne Lineup, in der der Torwart eine
Rolle spielt (z. B. `scripts/miss-rangtreue-nach-rolle.mjs`) — nicht in dieser Probe
nachgemessen, aber aus demselben Codepfad zu erwarten.

---

## Zusammenfassung

| Archetyp | Kanal | Befund | Bewertung |
|---|---|---|---|
| Sniper | SCHUSS_NAH | rho 0,36–0,52, Terzil +2,5 bis +3,3 Pp | schwach, aber richtig |
| Sniper | SCHUSS_FERN | rho −0,08 bis −0,16, Terzil ≈ 0 | **kein Zusammenhang** |
| Playmaker | AUFBAU | Delta (Assists−Tore) +0,47 bis +0,51 | **sauber getrennt** |
| Playmaker | TEAMGEIST | Delta (Assists−Tore) −0,96 bis −1,12 | **invertiert** |
| Verteidiger | ABWEHR → Tore | −27 % bis −49 % | **erreicht Basketball-Referenz** |
| Verteidiger | ABWEHR → Trefferquote | −1,8 bis −2,8 Pp | **weit unter Basketball-Referenz** |
| Torwart | PARADE → GSAA vs. Eig | rho ≈ 0, Paar-Gewinnrate 50 % | **nicht aussagekräftig gemessen** (Auswahl-Artefakt) |

Keine dieser vier Rollen ist heute vollständig und zuverlässig aus dem echten Kader
herauslesbar. Am nächsten dran ist der Playmaker (über AUFBAU) und der Verteidiger (über
Tor-Unterdrückung); am weitesten weg ist der Torwart, dessen Messung an dieser Stelle
gar nicht am Rezept hängt, sondern an einer Slot-Zuweisung, die ohne gesetzte Aufstellung
schlicht die falsche Frage beantwortet.

**Was diese Probe nicht tut:** keiner der oben genannten Befunde ist hier behoben —
weder die geteilte, basketball-kalibrierte Erfolgskurve (Sniper/Verteidiger), noch
TEAMGEISTs Rolle im `technikGate`, noch die Torwart-Slot-Zuweisung ohne Lineup. Das ist
absichtlich: Auftrag war Messung, nicht Reparatur.
