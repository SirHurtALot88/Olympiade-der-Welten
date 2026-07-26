# Sponsor-Rework — Umsetzungsplan

Status: **Entwurf zur Prüfung.** Kein Produktionscode geändert. Alle Zahlen stammen aus
gemessenen Modellläufen, nicht aus Schätzungen.

## 1. Warum

Drei Defekte des Ist-Systems, jeder einzeln gemessen mit `scripts/sponsor-payout-model.ts`:

| Defekt | Messung |
|---|---|
| **Fallen-Sponsoren** — Kurven sind auf gleiche Fläche über Rang 1..32 normiert, eine Invariante, die kein Team erlebt (jedes hat genau *einen* Endrang) | 6–7 von 11 Kurven sind für ein gegebenes Team bei **jedem erreichbaren Rang** schlechter als eine andere. EV-Spread 16–30 %. |
| **Doppelzählung** — Überperformance (Baseline Erwartungsrang) und Tabellenziel (Baseline Startrang) messen bei stabilen Teams dieselbe Zahl | Bei einem Aufstieg #23→#17 stammen **51–77 %** des Zuwachses aus diesen zwei Modulen. Bei kleinen Aufstiegen innerhalb einer 4er-Stufe **100 %** — die Kurve trägt dann gar nichts bei. |
| **Sonderziele ohne Schwierigkeits-Bepreisung** — `specialCash` hängt nur an der Rarity | Alle 25 Bonus- + 6 Golden-Ziele zahlen bei gleicher Rarity denselben Betrag. Ein 22-%-Ziel bringt so viel wie ein 65-%-Ziel. |

Wirtschaftliche Folge (gemessen bei salaryFactor 1.0, echte S1-Referenz Σ Gehälter = 2078,
min 43,7 / max 87,8): **ob ein Team seine Gehälter zahlen kann, hängt davon ab, welchen Sponsor
es gewählt hat.** Meister 70,0–102 je nach Kurve; Letzter 39,2–56 — teils unter dem Mindestgehalt.

## 2. Zielarchitektur — vier getrennte Leitern

Referenzimplementierung: `scripts/sponsor-model-proposal.ts` (lauffähig, verifiziert).

| Leiter | Rolle | Eigenschaft |
|---|---|---|
| **1 — Liga** | Was ein Platz wirtschaftlich wert ist | absolut, 4er-Stufen, **sponsorunabhängig**. Die Block-Challenge bleibt; es gibt **kein per-Rang-Geld** mehr obendrauf. |
| **2 — Typ** | Die Sponsor-Identität | **relativ** (Δ = erwartete − erreichte Stufe), Mali erlaubt. Weil relativ, hat jeder Typ auf *jedem* Ausgangsrang Stärken und Schwächen. |
| **3 — Sonderziel** | Modularer Zusatz | nach Schwierigkeit bepreist (`scripts/sponsor-objective-pricing.ts`). |
| **4 — Klausel** | Rang-unabhängige Zustandsbedingung mit Bonus **und** Malus | Strukturell nötig: am Tabellenende kann kein Team abrutschen, dort degeneriert die Rang-Achse (gemessen: σ 0,8, Spannweite 2 C). Nur die Klausel liefert dort Risiko. |

**Modular statt fest:** ein Sponsor ist eine Kombination aus Kurvenform × Klausel.
6 Kurven × 20 Klauseln = **120 mögliche Sponsoren** aus zwei unabhängig pflegbaren Listen.

### Kalibrierregeln (jede aus einem Fehlschlag gelernt)

1. **Offsets je (Typ, Erwartungsstufe)**, nicht global. Ein globaler Offset lässt am Rand 8–9 %
   Spread samt Fallen stehen, und sein Fixpunkt hängt vom Startwert ab — nicht reproduzierbar.
2. **Kalibrierung mit bereits wirkender Untergrenze.** Die Untergrenze schützt Risiko-Typen
   gratis nach unten und hebt deren EV; vorher kalibrieren verzerrt.
3. **Untergrenze asymmetrisch**: fällt im schlechten Jahr gedämpft mit (Faktor 0,8), steigt im
   guten Jahr **nicht**. Sie ist Schutz, keine Belohnung.
4. **Neigung nur nach oben**: bei sf > 1 kippt die Leiter zugunsten der Spitze (Stärke 0,8).
   Bei sf ≤ 1 aus — die Härte des schlechten Jahres für die Spitze ist gewollt.
5. **Je flacher die Kurve, desto symmetrischer die Klausel.** Stark asymmetrische Klauseln
   (großer Bonus, zahnloser Malus) erzeugen mit flacher Kurve dominierte Sponsoren.

## 3. Gemessenes Ergebnis

**Messkriterium:** Fallen werden per **rang-konditionaler FOSD** (Erststufen-stochastische Dominanz)
bestimmt, nicht elementweise. Der frühere elementweise Vergleich ist ungültig, seit jede Klausel ihr
eigenes P trägt — er vergleicht Zellen über verschiedene Wahrscheinlichkeitsmaße und erzeugt
systematisch False Positives. Der CDF-Vergleich ist zusätzlich unabhängig von σ.

| Kriterium | Ist | Vorschlag |
|---|---|---|
| Fallen-Sponsoren (kuratierte Liste, alle 32 Ränge) | 6–7 von 11 | **0** |
| Fallen im vollen 120er-Raum | — | **3 Paare** (nur Ränge 29–32, s. u.) |
| EV-Spread über alle 32 Erwartungsränge | 16–30 % | **3,8 %** |
| Risikospanne σ | — | **5,4 – 16,8** (Faktor 3) |
| Meister bei sf 1.0 | 70–102 je nach Sponsor | **89–104 mit jedem Typ** |
| Letzter | 39–56, teils unter Gehalt | **≥ 44 mit jedem Typ** |

**Liga-Bilanz** (Σ Sponsoren gegen Σ Gehälter 2078) und **Überschuss je Stufe**:

| sf | Σ | Meister | R16 | Letzter | Schere | R1 | R4 | R8 | R16 | R24 | R32 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 0,8 | 1662 | 67 | 52 | 44 | 1,53× | −21 | −23 | −20 | −14 | −7 | ±0 |
| 1,0 | 2078 | 86 | 66 | 53 | 1,60× | −2 | −6 | −5 | −1 | +5 | +10 |
| 1,2 | 2494 | 120 | 78 | 56 | 2,12× | +32 | +20 | +15 | +12 | +11 | +13 |

**Der Überschuss ist bei sf 1,2 NICHT monoton**: R32 (+13) liegt über R24 (+11), R4 (+20) unter
R1 (+32) aber über R8 (+15). Eine frühere Fassung behauptete Monotonie — sie stammte aus der Zeit
vor der Bonus/Malus-Ableitung, durch die der Klausel-EV exakt 0 wurde; die Ökonomietabellen wurden
danach nicht neu gemessen. Die Nicht-Monotonie am Tabellenende ist eine direkte Folge der
Untergrenze (siehe offener Punkt 3 unten) und noch nicht behoben.

**Stresstest** (`OLY_SPONSOR_STRESS=1`), alle 120 Kombinationen gleichzeitig kalibriert:

| Test | Ergebnis |
|---|---|
| Designannahmen | 12 Fallen (3 Paare), Spread **5,5 %** |
| σ = 2 / 3 / 4 / 6 / 8 | Spread 13,8 / 9,6 / **5,5** / 12,4 / **22,0 %** |
| P fehlgeschätzt ±0,10 / ±0,15 / ±0,20 | Spread bis 6,8 / 10,5 / **12,7 %** |

**Das Modell hängt sehr wohl an den beiden ungemessenen Annahmen.** Bei σ = 8 statt 4 liegt der
Spread bei 22 % — in derselben Größenordnung wie der Ist-Defekt (16–30 %), den der Rework behebt.
Eine frühere Fassung meldete hier „0,0 % durchweg"; das war ein Messfehler des Prüfstands
(Kalibrierung aufs Set-Mittel, globales P, Messung nur an den Stützstellen, wo der Spread per
Konstruktion 0 ist). **σ und P müssen vor dem Cutover gemessen werden — sie sind keine Kosmetik,
sondern tragen das Ergebnis.**

### Angebotsregel (neu, zwingend)

Die 3 verbleibenden Fallen sind `Halten/Achsenprofil ≪ Halten/Ausbau`,
`Halten/Fokusschule ≪ Halten/Einsatzlast`, `Halten/Wortlaut ≪ Halten/Ausbau` — jeweils bei
Erwartungsrang 29–32. Alle drei haben **dieselbe Kurve, dasselbe P und ein kleineres s**: am
Tabellenende schneidet die Untergrenze den Malus beider ab, wodurch der schmaleren Spannweite nur
noch der kleinere Bonus bleibt.

**Regel: eine Angebotsliste darf keine zwei Sponsoren derselben Kurvenform enthalten.** Damit
sind es über alle 32 Erwartungsränge 0 Fallen (verifiziert). Die Regel ist allerdings **nicht
robust gegen P-Fehlschätzung** — sie trägt erst, wenn P gemessen ist.

### Vier Befunde aus dem Abschluss-Audit — zwingend VOR der ersten Produktionszeile

Diese vier hat keine der drei Prüfrunden vorher gesehen. Die ersten beiden sind
**Design-Entscheidungen, die nicht der Umsetzende treffen kann.**

1. **Leiter 3 bricht die Parität, die Leitern 1+2+4 herstellen.** Die Kalibrierung erzwingt
   EV-Gleichheit nur über Liga + Typ + Klausel. Der Sonderziel-EV hängt aber an der Rarity
   (4 / 12 / 16 / 30 C aus SLOT_EV × Slots). Enthält eine Angebotsliste **gemischte Rarities** —
   was die heutige Angebotserzeugung tut —, unterscheiden sich zwei Angebote um bis zu **26 C EV**.
   Das ist eine Größenordnung über dem gefeierten Spread von 3,8 % (≈ 2 C). Die Zusage „nie in der
   Höhe, nur im Risiko" gilt damit **nur innerhalb einer Rarity**.
   → Entscheidung: Rarity je Angebotsliste fixieren **oder** Rarity-EV in die Parität einpreisen.
   Bestimmt die Signatur der Rechenschicht, nachträglich teuer.

2. **`TARGET_EV` ist der wirtschaftliche Anker des ganzen Modells und nirgends hergeleitet.**
   Die Werte sind eingefrorene Set-Mittel eines früheren Kalibrierlaufs. Ihre Schere (76 → 53 =
   1,43×) ist flacher als die Gehaltsschere (87,8 → 43,7 = 2,0×) — daraus folgt zwingend das
   Umverteilungsprofil bei sf 1,0: Spitze −2 … −6, Keller +10, nur **14 von 32 Teams im Plus**.
   Ob das gewollt ist, hat niemand abgenommen.
   → Entscheidung: Profil als Design-Entscheidung dokumentieren **oder** Leiter anpassen — bevor
   die Werte in P1 als Unit-Test-Referenz eingefroren werden.

3. **Die Untergrenze annulliert die eigene Begründung von Leiter 4.** Der Architektur-Gedanke war:
   „am Tabellenende liefert nur die Klausel Risiko". Gemessen hat bei Erwartungsrang 30 aber
   **jeder der 12 Typen den Sockel 44** — der Floor schluckt jeden Malus, die Klausel ist dort
   reines Upside, es gibt faktisch kein Abwärtsrisiko mehr. Daraus entstehen auch die 3 Fallen und
   die Nicht-Monotonie bei sf 1,2.
   → Entweder akzeptieren und dokumentieren, oder das Tabellenende anders lösen.

4. **Liga-Summe rechnet am Δ-0-Punkt statt über Erwartungswerte** (Jensen + Floor): `solveK` löst
   `k` dadurch zu hoch, die reale Σ läge über dem Ziel — am stärksten bei sf 0,8. Zusätzlich ist
   `clauseEv` seit der Bonus/Malus-Ableitung **exakt 0** (toter Code), und `SPECIAL_TYPICAL = 9`
   passt zu keiner Rarity des Pricing-Skripts.

## 4. Betroffene Produktionsdateien

| Datei | Änderung |
|---|---|
| `lib/sponsor/sponsor-economy-calibration.ts` | Kern. Liga-Leiter, Untergrenze, sf-Skalierung/Neigung, Offset-Tabelle. `getSponsorOverperfConfig` und `getSponsorImprovementConfig` entfallen (Doppelzählung). |
| `lib/sponsor/sponsor-curve-shapes.ts` | 11 absolute Kurven → 6 relative Kurvenformen. |
| `lib/sponsor/sponsor-special-objectives.ts` | Klausel-Katalog (20), Schwierigkeits-Bepreisung, Wahrscheinlichkeitsband-Filter je Stärkeklasse. |
| `lib/sponsor/sponsor-offer-service.ts` | Angebotserzeugung: Kurve × Klausel komponieren statt Archetyp wählen. |
| `lib/sponsor/sponsor-objective-evaluator.ts` | Auswertung der neuen Klauseln (Fatigue-Schnitt, Klassenaufstiege, XP-Quote, Traits, Versprechen …). |
| `lib/sponsor/sponsor-settlement-service.ts` | Auszahlung nach neuer Modulstruktur; Mali können den Betrag senken. |
| `lib/sponsor/sponsor-tier-pool.ts` | Archetyp-Mapping ersetzen. |
| `lib/sponsor/sponsor-offer-presenter.ts` | Darstellung: Kurvenform, Klausel mit Bonus **und Malus**, Sonderziel-Preis. |
| `lib/foundation/finances/*` | Prognosen und Ligatabelle auf die neue Struktur. |

**Achtung Migration:** laufende Verträge tragen ihre Konditionen (`targetValue`, `ratePerUnitC`)
eingefroren im Save. Bestandsverträge müssen weiter nach altem Recht abgerechnet werden.

## 5. Phasenplan

Jede Phase ist einzeln lauffähig, hinter Flag, mit eigenem Abnahmekriterium.

| # | Phase | Inhalt | Abnahme |
|---|---|---|---|
| **P0** | Messbasis einfrieren | Ist-Auszahlungen für 32 Teams × 5 Saisons als CSV sichern | Referenz existiert, reproduzierbar |
| **P1** | Reine Rechenschicht | Vier Leitern als *pure functions* in neuem Modul, keine Verdrahtung. Unit-Tests gegen die Modellzahlen | tsc grün, Tests grün, Werte identisch mit `sponsor-model-proposal.ts` |
| **P2** | Kurven + Klauseln als Daten | 6 Kurvenformen, 20 Klauseln, Offset-Tabelle. Noch nicht aktiv | Fallen-Test als **automatisierter Test** im Repo, 0 Fallen |
| **P3** | Evaluator | Klausel-Auswertung gegen echte Felder. Pro Klausel ein Test | jede Klausel messbar, keine auf Alter (existiert nicht) |
| **P4** | Angebotserzeugung hinter Flag | `OLY_SPONSOR_V2` — komponiert Kurve × Klausel, Sonderziel nach Schwierigkeit | A/B: beide Pfade lauffähig, alter Pfad unverändert |
| **P5** | Settlement hinter Flag | Auszahlung inkl. Mali; Bestandsverträge nach altem Recht | Alt-Verträge zahlen unverändert (Regressionstest) |
| **P6** | Long-Run-Validierung | 5 Saisons, beide Arme vom selben Seed | Σ Sponsoren ≈ Σ Gehälter bei sf 1.0; kein Team zahlungsunfähig; P je Klausel **gemessen** |
| **P7** | Nachkalibrierung | gemessene P und σ statt geschätzter in die Tabelle | Fallen 0 mit *gemessenen* Werten |
| **P8** | Cutover | Flag default an, alter Pfad entfernt | Ökonomie-Diff dokumentiert |

## 6. Offene Punkte / Risiken

1. **Klausel-Erfüllungswahrscheinlichkeit P.** Ursprünglich global mit 0,55 angesetzt — das war der
   gefährlichste Fehler des Entwurfs: mit klausel-individuellem P riss die EV-Parität auf über 50 %
   auf, also weiter als der behobene Defekt. Jede Klausel trägt jetzt ihr eigenes P, und Bonus/Malus
   werden daraus abgeleitet (`bonus = s·(1−P)`, `malus = s·P`), damit EV-Beitrag und Spannweite
   unabhängig von P sind. Die P-Werte selbst bleiben Schätzungen. → **P6 muss messen, vor P7.**
2. **Erfolgswahrscheinlichkeiten der 22 Sonderziele** sind Design-Schätzungen. Größter
   ungemessener Parameter des Entwurfs.
3. **Deckel bei der Sonderziel-Bepreisung** (4×) drückt die EV der schwersten Ziele auf 3,6–4,8
   statt 6,0. Bewusst: ohne Deckel zahlte ein 15-%-Ziel bei magisch 40 C und dominierte die Ökonomie.
4. **Gehaltsverlauf über die Ränge** ist im Modell linear genähert (87,8 → 43,7). Die echte
   Verteilung ist es nicht; die Überschuss-Tabelle ist deshalb eine Näherung.
5. **KI-Sponsorwahl** muss auf die neue Struktur — sonst wählen AI-Teams weiter nach altem Muster.
6. **Bestandsverträge**: ohne sauberen Alt-Pfad brechen laufende Saisons.
7. **σ = 4** (Ergebnisstreuung) ist gesetzt, nicht gemessen. Bei sehr enger oder sehr offener Liga
   verschiebt sich der erreichbare Korridor.

## 7. Nicht Teil dieses Plans

- Golden-Sponsoren (eigene Mechanik, bleibt vorerst wie sie ist)
- Verhandlung (`sponsor-negotiation.ts`)
- Marken-/Flavour-Katalog
