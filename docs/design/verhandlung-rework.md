# Verhandlungs-Rework: Spielerkäufe

**Status: Entwurf. Kein Produktivcode geändert.**

Auftrag (Chris): _„können wir mal bitte checken wie die verhandlungen laufen, bisher habe ich
immer das gefühl dass sobald ich überhaupt verhandle der preis fast immer ansteigt … und dann
nen tooltip bei den verhandlungen machen wo klar wird von was das abhängt, also ob es an den
traits vom spieler liegt oder ob er aus gründen ggf lieber oder weniger gern wechseln will und so"_

Das Gefühl ist gemessen und bestätigt. Dieses Dokument beschreibt das neue Modell so präzise,
dass es offline gegen den echten Spielstand durchgerechnet werden kann, bevor irgendetwas
live geht. Alle Eingangsgrößen existieren bereits im Code — es wird kein neues Datenfeld
erfunden; wo eines fehlen würde, steht das ausdrücklich in Abschnitt 7.

---

## 0. Ausgangsbefund (gemessen, nicht vermutet)

Betroffene Stellen:

- `app/foundation/transfermarkt-v2/TransfermarktV2Client.tsx`, `negotiateBuy` (~Z. 1862–1926)
- `lib/market/contract-negotiation-preview.ts`, `calculateNegotiationChances` (~Z. 1423–1451)
  und `buildContractNegotiationPreview` (~Z. 1453 ff.)

**Defekt 1 — Großzügigkeit wird bestraft.** Das Gegenangebot lautet heute
`counterSalary = max(expectedSalary·1.04, activeSalaryOffer·1.08)`. Der zweite Term hängt am
Angebot des Nutzers, nicht an der Forderung des Spielers. Wer bei Forderung 4,00 bereits 4,80
bietet (+20 %), bekommt 5,18 gefordert — mehr als der Spieler selbst verlangt, _weil_ das
Angebot großzügig war.

**Defekt 2 — Ratsche.** `setOfferedSalary(counterSalary)` schreibt das Gegenangebot in das
Nutzerangebot zurück; jede Runde multipliziert erneut: 4,80 → 5,18 → 5,59 → 6,04 → 6,52 → 7,04
(das 1,76-fache nach fünf Runden bei Forderung 4,00). Über den gesamten Raum geprüft: ein
Gegenangebot liegt **nie** unter dem eigenen Angebot.

**Defekt 3 — kein Mittelbereich.** Ab `acceptanceScore` 50 wird alles angenommen, auch 15 %
unter Forderung; darunter wird fast immer nachverhandelt, selbst bei +10 %. Über alle
Kombinationen: 72 % Zusage, 20 % Gegenangebot, 8 % Absage. Das Verdikt ist deterministisch
(stärkste der drei Reaktionen gewinnt, kein Würfel) — das bleibt im neuen Modell so, es wird
nur ehrlich ausgenutzt.

---

## 1. Grundgerüst: drei Fragen statt fünfzehn Faktoren

Das alte Modell wirft alles — Wechselwille, Geld, Vertragskonditionen — in einen einzigen
`acceptanceScore` und vergleicht den dann _nochmal_ mit dem Geld (`offerRatio`). Das Geld zählt
dadurch doppelt, und keine der Zahlen beantwortet eine menschliche Frage.

Das neue Modell trennt die vorhandenen 15 Faktoren aus `pushScoreBreakdown` in drei Achsen.
**Es sind exakt dieselben Datenquellen** — nur neu sortiert:

### Achse A: Wechselwille `W` — „Will er überhaupt zu uns?"

Summe dieser bestehenden Breakdown-Einträge (Keys wie im Code), **ohne** alles, was vom
Angebot abhängt:

| Key | Punkte heute | Quelle |
|---|---|---|
| `base_interest` | +45 | fix |
| `team_fit` | −10 … +28 | `calculateTransfermarktFit` + `fit25Bonus` |
| `scouting_network` | 0/1/2/4/6/9 | `getTransfermarktScoutingRecruitmentBonus(scoutingLevel)` |
| `trait_culture` | ca. −22 … +15 | `deriveTraitCultureSignals` (Traits × TeamIdentity) |
| `loyal_fit` | +6 | Trait `loyal` und `teamFit ≥ 20` |
| `ambition_match` / `ambition_mismatch` | +4 / −3 | Trait `ambitious` × `teamIdentity.ambition` / `starPriority` — **Änderung:** der Mismatch-Zweig feuert neu bei schwachem Projekt (`ambition ≤ 4` und `starPriority < 8`) statt bei `offerRatio < 1`; Ambition ist eine Eigenschaft des Umfelds, nicht des Angebots |
| `bad_experience` | −14 | `priorBadExperience` (Draft-Status `rejected_bad_experience`) |
| `negotiation_mood` | −4 … +4 | `deriveNegotiationMood` (deterministischer Hash je Save/Season/Team/Spieler) |

```
W = clamp(Summe der obigen Punkte, 0, 99)
```

Typische Spanne: 30–85. `W` hängt **nicht** vom Angebot ab — deshalb kann der Tooltip später
einen festen Satz sagen wie „Zusage ab 4,32 M", ohne dass sich die Schwelle beim Tippen bewegt.

### Achse B: Geld `r` — „Reicht das Gehalt?"

`r = offeredSalary / expectedSalary` (das bestehende `offerRatio`). Die Forderung
`expectedSalary = baseExpectedSalary · demandMultiplier` bleibt komplett wie heute
(`demandBreakdown`-Pipeline: Fit-Druck, Charakter/Subklasse/Wesen, Vertragsform, Teamumfeld,
Vertrauensbruch ×1.12, Laune). Der alte Score-Eintrag `salary_offer`
(`clamp(offerDelta·95, −42, 32)`) **entfällt** — das Geld wirkt nur noch über `r` gegen die
Schwellen, statt doppelt.

### Achse C: Konditionen `K` — „Stimmen Laufzeit und Form?"

Die drei vertragsbezogenen Score-Einträge verlassen den Score und werden zu einem
**Konditionen-Aufschlag in Gehaltsprozent**:

```
K = clamp( −(styleScore + prefScore + lengthScore) · 0.005, −0.04, +0.08 )
```

- `styleScore` = Eintrag `contract_style` (`deriveContractStyleAdjustment`)
- `prefScore` = Eintrag `player_contract_preference` (`contractPreference.scoreAdjustment`, −12…+8)
- `lengthScore` = Eintrag `contract_length_security` (`deriveRetoolContractSalarySignal(...).score`, −14…+12)

Lesart: 1 Score-Punkt ≈ 0,5 % Gehalt. Passt der Vertrag nicht zum Wunschprofil des Spielers
(`buildPlayerContractPreference`: `lengthPreference`, `idealLength`, `shapePreference`,
`matchQuality`), verlangt er bis zu 8 % mehr Geld — **oder** der Nutzer gibt ihm den Vertrag,
den er will (Abschnitt 3, Konditionen-Gegenangebot). Ein Wunschvertrag senkt die nötige Summe
um bis zu 4 %. Der Faktor 0,005 ist bewusst kleiner als der Wechselkurs des Willens
(0,003 · Score-Punkt wäre 0,3 %, siehe unten) — hier stecken aber Scores bis ±14 drin, also
bleibt der Konditionen-Hebel insgesamt in derselben Größenordnung wie heute (±8 Punkte
Score-Wirkung), nur sichtbar in Geld.

### Persönlichkeits-Schwellen (angebotsreaktive Traits)

Vier alte Einträge feuerten nur in Abhängigkeit vom Angebot (`mercenary_lowball`/`_paid`,
`ego_lowball`/`_signal`). Sie werden zu **Schwellen-Verschiebungen**, weil sie genau das
beschreiben: wie empfindlich jemand auf die Höhe reagiert.

```
persReq = (mercenary ? +0.020 : 0) + (diva || egomaniac ? +0.015 : 0)
persRej = (mercenary ? +0.050 : 0) + (diva || egomaniac ? +0.030 : 0)
```

- `persReq` +2,0 % Mercenary: entspricht dem alten `mercenary_lowball` von −7 Punkten beim
  Wechselkurs 0,003 (7 · 0,3 % ≈ 2,1 %). Diva/Ego +1,5 %: bewusst kleiner als die alten
  −8 Punkte, weil ein Teil des Diva-Malus bereits in `trait_culture` (Achse A) steckt —
  Doppelzählung vermeiden.
- `persRej`: Lowball-Beleidigungszone. Ersetzt die alte `mercenaryLowballPenalty`
  (`(1−r)·18`), die im Rauschen unterging; +5 %/+3 % machen sie zur harten Kante.

### Gestrichen: `team_wage_sensitivity`

Der Eintrag zog dem **Spieler** Punkte ab, weil das **Team** gehaltsdiszipliniert ist — das
ist Team-Politik, keine Spielerpsychologie, und für den Spieler unsichtbar. Die
Team-Gehaltsdisziplin wirkt bereits korrekt auf der Forderungsseite
(`wage_disciplined_team`-Eintrag in `deriveTeamDemandSignals`, ×0.98). Ersatzlos streichen.

Damit sind alle 15 Faktoren verortet: 8 in `W`, 1 ersetzt durch `r`, 3 in `K`, 2 als
Schwellen, 1 gestrichen.

---

## 2. Die neue Verdikt-Kurve

### 2.1 Schwellen

Alles sind Verhältnisse zur Forderung `D = expectedSalary`:

```
R_rej   = clamp(0.98 − 0.004·W, 0.70, 0.95) + persRej      // darunter: Absage
R_money = clamp(1.14 − 0.003·W, 0.92, 1.14) + persReq      // reine Geld-Schwelle
R_full  = R_money + K                                       // Zusage-Schwelle inkl. Konditionen
P       = 1.04 + (mercenary || diva || egomaniac ? 0.02 : 0)   // Stolz-Kappe, max 1.06
```

### 2.2 Verdikt-Regel (deterministisch, in dieser Reihenfolge)

```
1  r <  R_rej                  → ABSAGE            („zu weit weg, er bricht ab")
2  r >= R_full                 → ZUSAGE
3  r >= R_money                → GEGENANGEBOT (Konditionen)   // Geld reicht, Vertrag nicht — Abschnitt 3.2
4  r >= P                      → ABSAGE („es liegt nicht am Geld")   // Abschnitt 3.3
5  T − O < 0.02                → ZUSAGE (Bagatelle)           // T s. Abschnitt 3.1
6  sonst                       → GEGENANGEBOT (Geld)          // Abschnitt 3.1
```

Das Verdikt kommt aus diesen Bändern — nicht mehr aus einem argmax über drei Prozentwerte.
Die drei angezeigten Prozente werden aus denselben Abständen abgeleitet (2.5) und stimmen
mit den Bändern überein; sie sind Anzeige, nicht Entscheidung.

### 2.3 Warum genau diese Konstanten

- **1.14 (Basis der Geld-Schwelle):** Ein völlig unwilliger Spieler (`W = 0`) ist mit +14 %
  über Forderung zu haben. Geld bietet damit immer einen Weg — aber einen, den der Spieler
  **nie selbst nennt** (seine Gegenforderung ist bei `P` ≤ 1.06 gedeckelt). Wer den
  Unwilligen will, muss das Schmerzensgeld freiwillig hinlegen.
- **0.003 (Wechselkurs Wille→Geld):** 10 Punkte Wechselwille ≈ 3 % Gehalt. Kalibriert so,
  dass die Schwelle bei `W ≈ 47` exakt durch `r = 1.00` läuft: ein durchschnittlich
  interessierter Spieler (Basis 45 plus ein bisschen Kontext) sagt genau bei seiner Forderung
  zu — die Forderung bedeutet endlich wieder etwas. Nebenprodukt: der Vertrauensbruch
  (−14 Punkte) kostet ab jetzt messbar ~4,2 % Gehalt.
- **Floor 0.92:** Auch der willigste Spieler unterschreibt nicht unter 92 % seiner eigenen
  Forderung. Verhindert den Exploit, sich über perfekten Kontext systematisch Rabatte weit
  unter Forderung zu erspielen. (Erreicht ab `W ≈ 73`.)
- **Ceiling 1.14:** Die Schwelle wächst nicht ins Absurde; mehr als +14 % verlangt das Modell
  nie als Zusagebedingung.
- **0.98 / 0.004 (Absage-Band):** Ein durchschnittlicher Spieler (`W = 45`) bricht unter
  80 % der Forderung ab; ein sehr williger (`W = 70`) erst unter 70 %. Lowballs tragen damit
  **auch bei willigen Spielern** ein reales Abbruchrisiko — und wegen `persRej` besonders
  bei Mercenary/Diva.
- **Ceiling 0.95 im Absage-Band:** Wer näher als 5 % an der Forderung liegt, wird nie
  wortlos abgewiesen — selbst der unwilligste Spieler redet dann wenigstens.
- **Floor 0.70:** Unter 70 % der Forderung ist immer mindestens Gegenangebots-Territorium,
  nie sichere Annahme.
- **Stolz-Kappe `P` = 1.04/1.06:** Der „kleine, begründete Aufschlag" über den eigenen
  Anspruch (Berater-Marge). Ersetzt die alten Multiplikatoren ×1.04/×1.08 aus `negotiateBuy` —
  aber bezogen auf **seine Forderung**, nie auf das Nutzerangebot. Geld-/Ego-Typen gönnen
  sich 2 Punkte mehr.

### 2.4 Verdikt-Tabelle alt gegen neu

Alt (gemessen; Achse = alter `acceptanceScore`, der das Angebot mit enthält):

```
score |  0.85   0.90   0.95   1.00   1.05   1.10   1.20   1.40   (offerRatio)
   20 | ABSAG  GEGEN  GEGEN  GEGEN  GEGEN  GEGEN  GEGEN   ZU
   30 | GEGEN  GEGEN  GEGEN  GEGEN  GEGEN  GEGEN   ZU     ZU
   40 | GEGEN  GEGEN  GEGEN  GEGEN  GEGEN   ZU     ZU     ZU
   50 |  ZU     ZU     ZU     ZU     ZU     ZU     ZU     ZU
   70 |  ZU     ZU     ZU     ZU     ZU     ZU     ZU     ZU
```

Neu (Achse = Wechselwille `W`, ohne Angebotsanteil; `K = 0`, keine Persönlichkeits-Schwellen;
nachgerechnet per Skript, s.u.):

```
   W  |  0.85   0.90   0.95   1.00   1.05   1.10   1.20   1.40   (offerRatio)
   20 | ABSAG  GEGEN  GEGEN  GEGEN  ABSAG*  ZU     ZU     ZU
   30 | ABSAG  GEGEN  GEGEN  GEGEN   ZU     ZU     ZU     ZU
   40 | GEGEN  GEGEN  GEGEN  GEGEN   ZU     ZU     ZU     ZU
   50 | GEGEN  GEGEN  GEGEN   ZU     ZU     ZU     ZU     ZU
   70 | GEGEN  GEGEN   ZU     ZU     ZU     ZU     ZU     ZU
```

`ABSAG*` = Absage mit dem Grund „es liegt nicht am Geld" (Regel 4: Angebot liegt schon über
der Stolz-Kappe 1.04, aber unter seiner Geld-Schwelle 1.08 — mehr Geld fordern wäre
unglaubwürdig, also sagt er ehrlich ab; erst ab 1.08 gewinnt das Schmerzensgeld).

Verteilung über dieses Raster: alt 72 % Zusage / 20 % Gegenangebot / 8 % Absage —
neu 55 % / 37,5 % / 7,5 %. Es gibt wieder einen echten Mittelbereich, Lowballs bleiben
riskant, und bei `W = 30` hilft ein hohes Angebot jetzt spürbar (ab +5 % statt ab +20 %).

Hinweis zum Vergleich: die Achsen sind nicht identisch (alter Score enthielt das Angebot,
`W` nicht). Für die Zeilen 40–70 ist der Unterschied bei `r ≈ 1` klein (`salary_offer` ≈ 0),
dort ist der Vergleich direkt gültig.

### 2.5 Anzeige-Prozente (Ersatz für `calculateNegotiationChances`)

```
fitSignal = clamp(teamFit / 60, −0.8, 0.8)          // unverändert
mA = r − R_full                                      // Abstand zur Zusage
mR = R_rej − r                                       // Abstand zur Absage
rawAccept  = clamp(50 + 300·mA + 6·fitSignal, 2, 96)
rawReject  = clamp(50 + 300·mR − 6·fitSignal, 2, 96)
rawCounter = clamp(50 − 150·max(mA, mR), 6, 50)
→ normalizeChances(rawAccept, rawCounter, rawReject)   // bestehende Funktion, unverändert
```

- **300:** 1 % Gehaltsabstand = 3 Rohpunkte; ±10 % Abstand sättigt Richtung Extrem
  (50 + 30 = 80). Die Prozente bewegen sich dadurch sichtbar mit jedem Regler-Schritt.
- **150 / Floor 6:** Das Gegenangebot dominiert im Korridor (beide Abstände negativ → 50)
  und schrumpft außerhalb schnell auf Restgröße.

Beispiele (normalisiert, `W = 50`, Fit 0): r = 0.85 → 9/57/33 · r = 1.00 → 51/47/2 ·
r = 1.40 → 92/6/2. Bei `W = 20`: r = 0.85 → 2/39/59.

---

## 3. Das neue Gegenangebots-Verhalten

Grundsatz: **Der Spieler fordert nie mehr als seinen eigenen Anspruch plus die Stolz-Kappe**
(`counter ≤ D · P ≤ 1.06 · D`), und das Nutzerangebot geht in keine Multiplikation mehr ein.

### 3.1 Geld-Gegenangebot (Regel 6: `R_rej ≤ r < R_money` und `r < P`)

```
T = D · min(R_full, P)                                       // sein Zielpunkt
h = clamp(0.80 − (W − 50)·0.006 + (R_money − r)·0.9, 0.55, 1.00)   // Härte
counter = roundMoney(O + (T − O) · h, 2)                      // O = offeredSalary
```

Garantierte Eigenschaften (über `W` 0–99, `r` 0.5–1.2, alle Trait-Kombinationen und
`K = 0.05` per Skript geprüft):

- `O < counter ≤ 1.06 · D` — immer über dem Angebot (sonst wäre es keins), nie mehr als
  Anspruch + 6 %.
- Deterministisch aus `(O, D, W, Traits)`. Gleiche Eingaben → identisches Gegenangebot.

Warum diese Härte-Formel:

- **0.80 Basis:** Er gibt standardmäßig ~20 % der Restlücke zu seinem Zielpunkt nach —
  Verhandeln lohnt sich, ersetzt aber keine faire Zahl.
- **−0.006 pro Willenspunkt:** Willige Spieler kommen entgegen (`W = 70` → h ≈ 0.68),
  unwillige kaum (`W = 30` → h ≈ 0.92). „Er will ja kommen" wird fühlbar.
- **+0.9 · Lowball-Tiefe:** Je tiefer das Angebot unter seiner Geld-Schwelle liegt, desto
  härter das Gegenangebot (h → 1.0 = er nennt seinen Zielpunkt, Punkt). Ohne diesen Term
  wäre — weil die Vorschau deterministisch und sichtbar ist — „maximal lowballen, dann
  Gegenangebot einschlagen" die dominante Strategie. So nachgerechnet: das Feilsch-Optimum
  spart je nach `W` nur noch ~1–3 % gegenüber dem Direktangebot, und zwar am meisten bei
  **willigen** Spielern (thematisch richtig: die kommen einem entgegen), fast nichts bei
  unwilligen.
- **Deckel 1.00:** Er geht nie über seinen Zielpunkt hinaus — das wäre die alte Ratsche.
- **Bagatelle (Regel 5):** Ist `T − O < 0.02` (weniger als ein Cent-Schritt der
  Gehaltsauflösung), gibt es kein Mini-Gegenangebot, sondern eine Zusage.

Zahlenbeispiele (D = 4.00, Details im Prüfskript):

```
W=30, O=3.60 (r=0.90) → 4.16   (104% von D; er will eigentlich nicht, Kappe greift)
W=40, O=3.80 (r=0.95) → 4.06
W=55, O=3.60 (r=0.90) → 3.85   ( 96% von D; williger Spieler geht unter seine Forderung)
W=70, O=3.40 (r=0.85) → 3.64   ( 91% von D)
```

Und das Defekt-1-Szenario: Forderung 4.00, Angebot 4.80 → **Zusage** (r = 1.20 ≥ R_full für
jedes plausible `W`). Kein Gegenangebot über dem eigenen Anspruch mehr, nie wieder 5.18.

### 3.2 Konditionen-Gegenangebot (Regel 3: `R_money ≤ r < R_full`)

Worüber verhandelt jemand, der beim Gehalt schon zufrieden ist? Über den Vertrag. Genau
dieser Fall ist jetzt ein eigenes Verdikt: das Geld hat seine Schwelle erreicht, aber der
Konditionen-Aufschlag `K > 0` (Laufzeit/Form passen nicht zum Wunschprofil) ist noch offen.

Das Gegenangebot fordert **kein Geld**, sondern den Wunschvertrag — alle Werte existieren in
`contractPreference`:

- Laufzeit: `clamp(idealLength, preferredMinLength, preferredMaxLength)`
- Form: `shapePreference`
- Gehalt: unverändert `O`

Nutzertext z. B.: _„Beim Gehalt sind wir uns einig. Aber zwei Jahre sind ihm zu kurz — er
will vier. Gib ihm die Laufzeit, oder leg ~5 % drauf."_ (Die 5 % sind `K`, konkret
berechenbar.) Der Nutzer hat damit echte Wahl: Konditionen erfüllen (→ `K` fällt weg,
`r ≥ R_full`, Zusage) oder freikaufen (Angebot auf `D · R_full` heben).

Annahme des Konditionen-Gegenangebots ist bindend (3.4).

### 3.3 Absage „es liegt nicht am Geld" (Regel 4: `P ≤ r < R_money`)

Liegt das Angebot bereits über Anspruch + Stolz-Kappe, aber unter seiner Geld-Schwelle
(nur bei sehr niedrigem `W` möglich), wäre eine höhere Geldforderung unglaubwürdig — er darf
ja nie mehr als `D · P` nennen. Also sagt er ab und **sagt warum**: _„Am Geld liegt es
nicht — er will einfach nicht zu euch."_ Das ist exakt die Information, nach der Chris fragt
(„ob er aus gründen ggf lieber oder weniger gern wechseln will"), als eigenes Verdikt statt
als Fußnote. Der Tooltip zeigt dann die `W`-Treiber (Abschnitt 5) — und dass es ab
`D · R_money` doch klappen würde, wer es unbedingt wissen will.

### 3.4 Gegenangebot annehmen ist bindend

Ein Klick auf „Einschlagen" übernimmt `counter` (bzw. die Wunsch-Konditionen) und setzt den
Status direkt auf `accepted_pending_confirm` — **ohne** das Verdikt neu auszuwerten. Er hat
die Zahl selbst genannt; sie erneut durch die Bänder zu schicken (wo `counter` mit `h < 1`
unter `R_full` liegen kann) wäre Wortbruch durch Formel. Das ist die einzige Stelle, an der
der Ablauf die Formeln übersteuert, und sie ist hier ausdrücklich als solche benannt.

---

## 4. Die Ratsche abstellen

### 4.1 Kein Rückschreiben mehr

`setOfferedSalary(counterSalary)` in `negotiateBuy` entfällt. Das Angebotsfeld gehört dem
Nutzer; das Gegenangebot wird daneben angezeigt („Seine Antwort: 4,16 M") mit zwei Wegen:
**Einschlagen** (bindend, 3.4) oder **eigenes Angebot ändern** und neu verhandeln.

### 4.2 Wiederholtes Verhandeln konvergiert, statt zu steigen

- Die Forderung `D` ist angebotsunabhängig und ändert sich durch Verhandeln nicht (einzige
  gewollte Ausnahme: ×1.12 nach `rejected_bad_experience` — das ist Strafe, keine Ratsche).
- `W` ist angebotsunabhängig; die Laune (`negotiation_mood`) ist ein Hash über
  Save/Season/Team/Spieler und damit innerhalb einer Saison konstant — es gibt nichts zu
  „neu würfeln".
- Das Gegenangebot ist eine reine Funktion von `(O, D, W, Traits)`. Verhandelt der Nutzer
  mit unverändertem Angebot erneut, kommt exakt dieselbe Zahl zurück — UI-Text dann:
  _„Er bleibt bei 4,16 M."_ Nachgerechnet: 4,06 → 4,06 → 4,06 → 4,06 → 4,06 statt
  4,80 → 5,18 → 5,59 → 6,04 → 6,52.
- Erhöht der Nutzer sein Angebot, wandert er auf derselben Kurve Richtung Zusage; das neue
  Gegenangebot kann nur kleiner werden (T fix, O größer, h fällt mit steigendem r).

### 4.3 Kostet wiederholtes Nachverhandeln etwas?

Ja, aber nur mit Mitteln, die es schon gibt. `ContractNegotiationDraft`
(`lib/data/olyDataTypes.ts` ~Z. 1847) speichert je Season/Team/Spieler genau **einen**
Eintrag mit `status` (`ready_for_review` / `countered` / `accepted_pending_confirm` /
`rejected_bad_experience`) und dem letzten `offeredSalary`. Daraus ist ein zweistufiges
Geduldsmodell ableitbar:

- **Affront-Regel:** Steht der Draft auf `countered` und das neue Angebot liegt **unter**
  dem im Draft gespeicherten letzten `offeredSalary`, ist das ein Rückzieher nach seinem
  Entgegenkommen → sofortige Absage + Status `rejected_bad_experience`. Damit greifen die
  bestehenden Strafen (−14 auf `W`, Forderung ×1.12) — der bereits verdrahtete Mechanismus
  wird zur Geduldsgrenze.
- Seitwärts- oder Aufwärtsbewegungen bleiben frei: wer sich in Schritten der Schwelle
  nähert, wird nicht bestraft, er verhandelt.

**Ausdrücklich fehlende Daten für mehr als zwei Stufen:** Ein Rundenzähler
(`negotiationRounds` o. ä.) existiert im Draft **nicht** — ein Modell „nach 3 Runden platzt
der Tisch" bräuchte dieses neue Feld. Ebenso gibt es nur `updatedAt` (Realzeit); eine Sperre
„nur eine Verhandlungsrunde pro Spieltag" bräuchte einen Spielzeit-Stempel im Draft, den es
nicht gibt. Beides hier nicht angenommen, sondern als mögliche Erweiterung markiert.

---

## 5. Der Tooltip

Ziel: beantworten, _warum er so reagiert_ — nicht 15 Rohfaktoren auflisten. Vier Bündel in
der Reihenfolge, in der ein Mensch fragt. Alle Inhalte stammen aus dem bestehenden
`ContractNegotiationPreview` (`scoreBreakdown`, `demandBreakdown`, `contractPreference`,
`offerRatio`, `expectedSalary`) plus dem Draft-Status — kein neues Feld nötig. Bündel ohne
Inhalt werden weggelassen; je Bündel höchstens zwei Sätze.

**Kopfzeile: das Verdikt als Satz + der stärkste Treiber.** Der Treiber ist der Eintrag mit
dem größten Punktebetrag außerhalb von `base_interest`, bzw. bei Geld-Verdikten der
Schwellenabstand. Beispiele: _„Er würde zusagen — der Teamfit zieht."_ / _„Er verhandelt:
ihm fehlen rund 0,3 M."_ / _„Er sagt ab — und am Geld liegt es nicht."_

**1. Will er überhaupt wechseln?** (Achse `W`, Grundstimmung)
Wortwertung aus `W`: unter 35 „will eher nicht", 35–60 „offen", über 60 „will kommen".
Faktoren: `base_interest`, `scouting_network` („euer Scouting hat den Kontakt aufgebaut"),
`ambition_match`/`ambition_mismatch` („bei euch sieht er ein Projekt" / „ihm fehlt die
Perspektive"), `negotiation_mood` („heute gut/schlecht drauf").

**2. Passt er zu uns?** (Team & Kultur)
Faktoren: `team_fit`, `loyal_fit` („loyaler Typ, euer Kader gefällt ihm"), `trait_culture`
(„sein Charakter verträgt sich [nicht] mit eurer Teamkultur" — die konkreten `reasons` aus
`deriveTraitCultureSignals` existieren schon als Sätze), plus die fit-getriebenen
Forderungs-Einträge (`negative_fit_pressure`, `fit25_salary_discount`).

**3. Reicht das Paket?** (Geld & Vertrag)
Die eine Zahl, die alles sagt — jetzt exakt berechenbar, weil `W` angebotsunabhängig ist:
_„Zusage ab ≈ D·R_full"_, daneben das eigene Angebot; bei Lowball zusätzlich _„unter
≈ D·R_rej bricht er ab"_. Darunter die Forderungs-Treiber aus `demandBreakdown` in
Alltagssprache (Charakter/Subklasse/Wesen: „er verhandelt hart, das liegt an ihm";
Mercenary-Premium; Teamumfeld) und der Konditionen-Teil: der Wunschprofil-Satz aus
`contractPreference.reasons[0]` („Wunschprofil: lange Verträge, am liebsten 4 Saisons,
Form balanced") mit dem `K`-Aufschlag als Prozent.

**4. Ist was vorgefallen?** (Geschichte)
`bad_experience` (−14, Forderung ×1.12): _„Die letzte Runde mit euch ist ihm quer im Hals —
das kostet euch gerade ~4 % Wille und 12 % Forderung."_ Draft-Status `countered`: _„Ihr habt
diese Saison schon verhandelt; er steht zu seinem letzten Wort."_ Nichts vorgefallen → Bündel
entfällt.

Zuordnung aller 15 Faktoren: Bündel 1 = `base_interest`, `scouting_network`, `ambition_*`,
`negotiation_mood` · Bündel 2 = `team_fit`, `loyal_fit`, `trait_culture` · Bündel 3 =
`salary_offer` (als `r` gegen die Schwellen), `contract_style`,
`player_contract_preference`, `contract_length_security`, `mercenary_*` und `ego_*` (als
Schwellen-Hinweis „reagiert empfindlich auf Lowballs") · Bündel 4 = `bad_experience` ·
gestrichen = `team_wage_sensitivity` (Begründung in Abschnitt 1).

---

## 6. Prüfskript

Die Tabellen und Beispielzahlen dieses Dokuments sind mit einem Node-Skript nachgerechnet
(Verdikt-Raster, Anzeige-Prozente, Ratschen-Sequenz, Schrankenprüfung über `W` 0–99 ×
`r` 0.50–1.20 × Trait-Kombinationen, Feilsch-Optimum). Es liegt bewusst nicht im Repo
(nur Entwurf); die Formeln unten genügen, um es in ~60 Zeilen zu reproduzieren. Geprüfte
Invarianten:

1. Gegenangebot immer `> O` und `≤ 1.06 · D` (0 Verletzungen im gesamten Raum).
2. Unverändertes Angebot → identisches Gegenangebot (keine Ratsche).
3. Bestes Feilsch-Ergebnis (Gegenangebot bindend annehmen) spart gegenüber dem
   Direktangebot `D·R_full` nur ~1 % (`W` 30–50) bis ~3 % (`W` 70).

## 7. Ausdrücklich fehlende Daten (nichts davon wird angenommen)

- **Rundenzähler** im `ContractNegotiationDraft` — nötig für Geduldsmodelle mit mehr als
  den zwei Stufen aus 4.3.
- **Spielzeit-Stempel** im Draft (`updatedAt` ist Realzeit) — nötig für „eine Runde pro
  Spieltag".
- **Spielerseitige Rollen-Präferenz** — `promisedRole` existiert nur als Zusage des Teams
  (`RosterPromisedRole`), es gibt kein Feld „will Starter sein". Gegenangebote über die
  Rolle sind mit vorhandenen Daten nicht möglich; Konditionen-Gegenangebote beschränken
  sich deshalb auf Laufzeit und Form, wofür `contractPreference` echte Daten liefert.
- **`counterSalary` im Draft** — nicht nötig: das Gegenangebot ist deterministisch aus dem
  Live-Preview reproduzierbar; gespeichert wird wie bisher nur der Status.

---

## 8. Formel-Kompaktblock

```
Eingaben (alle vorhanden):
  D  = expectedSalary            O = offeredSalary          r = O / D
  W  = clamp(Σ Punkte von {base_interest, team_fit, scouting_network, trait_culture,
             loyal_fit, ambition_match|mismatch, bad_experience, negotiation_mood}, 0, 99)
  K  = clamp(−(styleScore + prefScore + lengthScore) · 0.005, −0.04, +0.08)
  persReq = (mercenary ? 0.020 : 0) + (diva|egomaniac ? 0.015 : 0)
  persRej = (mercenary ? 0.050 : 0) + (diva|egomaniac ? 0.030 : 0)

Schwellen:
  R_rej   = clamp(0.98 − 0.004·W, 0.70, 0.95) + persRej
  R_money = clamp(1.14 − 0.003·W, 0.92, 1.14) + persReq
  R_full  = R_money + K
  P       = 1.04 + (mercenary|diva|egomaniac ? 0.02 : 0)

Verdikt (Reihenfolge!):
  r <  R_rej    → ABSAGE
  r >= R_full   → ZUSAGE
  r >= R_money  → GEGENANGEBOT Konditionen (Gehalt O bleibt; fordert
                  clamp(idealLength, preferredMin, preferredMax) + shapePreference)
  r >= P        → ABSAGE „es liegt nicht am Geld"
  T − O < 0.02  → ZUSAGE (Bagatelle)
  sonst         → GEGENANGEBOT Geld

Geld-Gegenangebot:
  T = D · min(R_full, P)
  h = clamp(0.80 − (W − 50)·0.006 + (R_money − r)·0.9, 0.55, 1.00)
  counter = roundMoney(O + (T − O)·h, 2)         // garantiert O < counter ≤ 1.06·D
  Annahme eines Gegenangebots ist bindend (kein erneutes Verdikt).
  Kein setOfferedSalary(counter) — das Angebotsfeld bleibt beim Nutzer.

Wiederholung:
  Draft-Status "countered" ∧ neues O < letztes O  → ABSAGE + rejected_bad_experience
  (bestehende Strafen: W −14, D ×1.12). Sonst frei; gleiche Eingaben → gleiches Ergebnis.

Anzeige-Prozente:
  mA = r − R_full;  mR = R_rej − r;  fitSignal = clamp(teamFit/60, −0.8, 0.8)
  rawAccept  = clamp(50 + 300·mA + 6·fitSignal, 2, 96)
  rawReject  = clamp(50 + 300·mR − 6·fitSignal, 2, 96)
  rawCounter = clamp(50 − 150·max(mA, mR), 6, 50)
  → normalizeChances(...)                        // bestehende Funktion
```
