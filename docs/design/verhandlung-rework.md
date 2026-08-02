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

---

# Nachtrag: Trotz, williger Pol, Erwiderung

**Status: 9.1 (Trotz) und 9.3 (Erwiderung) sind LIVE. 9.2 (Eile-Rabatt) ist verworfen —
begründet in Abschnitt 10. Die Abweichungen der gebauten Fassung stehen in Abschnitt 11.**

Auftrag (Chris, nach dem Ausprobieren des Live-Modells): _„aber sollte bei so sturen spielern
wenn verhandelt wird die forderung nicht teils hoch gehen? vor allem wenn ich lowballen will?
und es muss auch welche geben die auf lowballen eingehen"_

## 9. Messbefund am echten Spielstand (400 Kaufkandidaten)

```
ZUSAGE-SCHWELLE (× Forderung):  min 0,940  P25 0,963  Median 0,973  P75 0,991  max 1,052
ABSAGE-SCHWELLE (× Forderung):  min 0,768  P25 0,796  Median 0,807  P75 0,834  max 0,912

nach Trait-Gruppe            n      Zusage ab   Absage unter
  Mercenary/Egomaniac/Diva  110       1,007        0,855
  Loyal (ohne die obigen)    69       0,960        0,793
  Rest                      221       0,971        0,803

Spieler, die unter 0,95× Forderung zusagen: 13 von 400 = 3,3 %
```

**Befund 1 — kein williger Pol.** Alle Zusage-Schwellen liegen in einem Band von elf
Prozentpunkten (0,94–1,05); nur 3,3 % gehen unter 0,95×. „Auf Lowballen eingehen" existiert
praktisch nicht. Ursache ist der Floor 0,92 in `R_money` (Abschnitt 2.3): er war als
Exploit-Bremse gegen Kontext-Rabatte gedacht, kappt aber auch jeden *legitimen* Grund,
billig zu unterschreiben.

**Befund 2 — Sturheit ist passiv.** Mercenary/Egomaniac/Diva haben höhere Schwellen
(`persReq`/`persRej`), aber die Forderung **steigt nie** als Reaktion auf ein Lowball-Angebot.
Zwischen ihrer Absage-Schwelle (Ø 0,855) und der Verhandlungszone liegt eine Zone, in der
ein Lowball folgenlos gekontert wird — bestraft wird er erst unter `R_rej`, dann aber gleich
mit dem vollen Vertrauensbruch.

**Befund 3 — Entgegenkommen wird nicht erwidert.** Gemessen (Umbros, Forderung 14,72):
Angebote 13,25 / 13,50 / 14,00 ergeben Gegenangebote 14,44 / 14,43 / 14,44 — ein festes
Ziel, kein reaktives Zugeständnis. Das ist **strukturell** in der Härte-Formel (3.1)
angelegt, kein Kalibrierfehler:

```
C = O + (T − O) · h(r)   mit   h = 0,80 − (W−50)·0,006 + (R_money − r)·0,9
dC/dO = 1 − h − 0,9·(T − O)/D   ≈ 0    im typischen Band (h ≈ 0,84, (T−O)/D ≈ 0,08)
```

Der Anti-Exploit-Term `+0,9·Lowball-Tiefe` — eingebaut, damit „maximal lowballen, dann
einschlagen" nicht dominiert — neutralisiert fast exakt jede Bewegung des Nutzers: wer 0,75
drauflegt, bewegt das Gegenangebot um ~0,07. Die Formel kann Entgegenkommen prinzipiell
nicht belohnen, solange sie gedächtnislos ist. Deshalb braucht die Erwiderung (9.3)
Gedächtnis über Runden — und damit die neuen Draft-Felder (9.4), die Abschnitt 7 noch
ausdrücklich vermieden hat. Sie sind jetzt beauftragt.

---

## 9.1 Trotz-Aufschlag: Lowball bei Sturen hebt die Forderung

### Die drei Zonen unter der Forderung

Lowballs haben bei sturen Spielern (Mercenary, Diva, Egomaniac) künftig eine gestufte
Antwort statt „Konter oder Abbruch":

```
r0 = O / D0        // D0 = Forderung dieser Verhandlung OHNE Trotz-Aufschlag
L  = min(0.90, R_full − 0.04)                     // Beleidigungsgrenze

Zone 1   L ≤ r0            → normales Feilschen, kein Aufschlag
Zone 2   R_rej ≤ r0 < L    → TROTZ: Forderung steigt, Verhandlung läuft weiter
Zone 3   r0 < R_rej        → wie bisher: Abbruch + Vertrauensbruch (W −14, D ×1.12)
```

### Formel

```
stur    = mercenary ∨ diva ∨ egomaniac
s_offer = stur ∧ r0 < L  ?  min(0.06, roundTo(1.5 · (L − r0), 0.005))  :  0
s       = max(draft.defianceSurchargePct, s_offer)   // klebt: nur monoton aufwärts
D′      = D0 · (1 + s)
```

Alle Schwellen und der Zielpunkt `T` rechnen ab dann gegen `D′` statt `D0`. Der Trigger
selbst misst gegen `D0` — sonst würde der Aufschlag seinen eigenen Trigger verschieben.
Persistiert wird `s` **nur beim Klick auf „Verhandeln"** (9.4); beim Tippen zeigt die
Vorschau `s_offer` als Hypothese an („Wenn du DAS verhandelst, steigt seine Forderung auf
X"). Was die Vorschau zeigt, ist exakt das Klick-Ergebnis — WYSIWYG wie beim Verdikt.

### Warum genau diese Konstanten

- **0,90-Linie:** 10 % unter Forderung. Deutlich unterhalb von allem, was der Spieler je
  selbst als Gegenangebot nennt (gemessen: Zusage-Schwellen der Sturen Ø 1,007, ihre Konter
  liegen knapp darunter) — also eindeutig Provokations-, nicht Verhandlungszone. Und
  oberhalb der gemessenen Absage-Schwellen der Sturen (Ø 0,855): genau die heute straffreie
  Zone 0,855–0,90 bekommt einen Preis.
- **Kappe `R_full − 0,04`:** Bei willig-sturen Kombinationen (Trait stur, aber `E < 0` aus
  9.2) wandert die Beleidigungsgrenze mit dem realen Zusagepunkt nach unten. Beleidigend
  ist, was weit unter dem liegt, wozu er wirklich unterschreiben würde — nicht eine absolute
  Zahl. Für typische Sture (`R_full ≥ 0,97`) ist die 0,90-Linie bindend, die Kappe greift
  nur im Sonderfall.
- **Faktor 1,5:** Jeder Prozentpunkt tiefer kostet 1,5 Punkte Aufschlag. Überproportional,
  damit Tieferlegen nie durch spätere Erwiderung (Gegenzug-Faktor `g ≤ 0,7`, siehe 9.3)
  zurückverdient werden kann: 1,5 > 0,7, also ist der Saldo jedes Lowball-Pfads negativ
  (durchgerechnet in 9.5).
- **Kappe 0,06:** Bleibt bewusst unter der Vertrauensbruch-Strafe (×1,12) — Trotz ist
  Ärger, kein Bruch. Zusammen mit der höchsten gemessenen Zusage-Schwelle (1,052) bleibt
  die effektive Schwelle ≤ ~1,115.
- **Rundung 0,005:** Anzeige in halben Prozentpunkten, keine krummen Zahlen im Tooltip.
- **Monotones `max`:** Neuöffnen des Dialogs, Umtippen, Konditionenwechsel — nichts
  schüttelt den Aufschlag ab. Es zählt der tiefste je **verhandelte** Griff. Tippen ist
  frei (die Vorschau warnt), Verhandeln klebt.

### Rücknehmbar oder klebrig?

**Klebrig, für die Dauer der Verhandlung** (= Lebensdauer des Drafts: Season/Team/Spieler).
Wäre er durch anschließendes Wohlverhalten abbaubar, wäre Lowball-zuerst gratis — man
zahlt am Ende ohnehin nur den fairen Preis. Die Strafe muss den Pfad verteuern, nicht die
Runde. Zwei Grenzen:

- **Neue Season = neuer Draft = Aufschlag weg.** Trotz ist Verhandlungsgedächtnis, kein
  Lebensgroll — dafür gibt es `rejected_bad_experience`.
- **Keine Doppelstrafe:** Kippt die Verhandlung später in `rejected_bad_experience`
  (Zone 3 oder Affront), wird `defianceSurchargePct` genullt. Ab dann gilt nur die
  Vertrauensbruch-Strafe (×1,12); beides zu stapeln wäre doppelt kassiert für denselben
  Vorfall.

### Nachvollziehbarkeit

Der Aufschlag erscheint als eigener `demandBreakdown`-Eintrag (`defiance_surcharge`,
Kategorie `personality`) mit dem Auslöser im Text: _„Euer Angebot von 8,90 M lag mehr als
10 % unter seiner Forderung — ein Söldner nimmt das persönlich: +3 % für den Rest dieser
Verhandlung."_ Die Forderungszeile im Dialog zeigt beide Zahlen: „Forderung: 10,00 → 10,30".
Der Spieler sieht Ursache (sein eigenes Angebot), Wirkung (neue Forderung) und Dauer (diese
Verhandlung) — keine Willkür, kein Würfel.

---

## 9.2 Der willige Pol: Eile-Rabatt `E`

### Prinzip

`E` ist eine **angebotsunabhängige, negative Schwellen-Verschiebung** aus benennbaren
Gründen — dieselbe Bauart wie `persReq`, nur mit umgekehrtem Vorzeichen und je Quelle
einem Satz für den Tooltip. `E` umgeht gezielt den 0,92-Floor: der Floor bleibt für alle
ohne benennbaren Grund bestehen (kein Rabatt-Farming über guten Kontext), aber wer einen
echten Grund hat zu wollen, darf drunter.

```
E_vereinslos = −0.03 · min(inactiveSeasons, 2)     // „seit N Saisons ohne Vertrag"
E_loyalfit   = (loyal ∧ teamFit ≥ 30)               ? −0.03 : 0
E_projekt    = (ambitious ∧ (teamAmbition ≥ 8 ∨ starPriority ≥ 8)) ? −0.02 : 0
E_radar      = (scoutingBonus ≥ 6 ∧ marketValue ≤ 25) ? −0.02 : 0
E            = clamp(E_vereinslos + E_loyalfit + E_projekt + E_radar, −0.08, 0)

R_money      = max( clamp(1.14 − 0.003·W, 0.92, 1.14) + persReq + E, 0.84 )
```

`R_rej` bleibt unverändert (Floor 0,70 hält genug Abstand nach unten). `R_full = R_money + K`
wie gehabt — der theoretisch tiefste Fall ist damit 0,84 − 0,04 = **0,80** (Eile-Maximum
plus Wunschvertrag).

### Die vier Quellen und ihre Begründung

- **`E_vereinslos` (−3 % je Saison, Kappe −6 %): „Wen fragt sonst niemand?"**
  `PlayerMoraleState.inactiveSeasons` existiert und wird je Preseason für Spieler ohne
  Kader hochgezählt (`lib/season/preseason-workflow-service.ts` ~Z. 153). Der Markt hat ihn
  nachweislich nicht gewollt — das stärkste denkbare Eile-Signal, deshalb die größte
  Einzelquelle. Kappe bei zwei Saisons: mehr wäre eine Armutsspirale ohne Spielwert.
  Datenbedingung, ausdrücklich: das Feld existiert nur bei Team-Historie (gespeicherter
  Morale-Eintrag des letzten Teams). Frisch in den Markt geseedete Spieler haben keins →
  `E_vereinslos = 0`. Dadurch trifft die Quelle die richtige Gruppe (echte Ladenhüter)
  statt des halben Pools.
- **`E_loyalfit` (−3 %): „Er sieht sich bei euch."**
  Der Gegenpol zu `persReq` +2 % des Mercenary, bewusst einen halben Punkt stärker, weil
  er an eine rare Bedingung geknüpft ist: das Gate `teamFit ≥ 30` ist strenger als das des
  `loyal_fit`-W-Bonus (≥ 20). Der Rabatt-Pol soll seltener sein als der Willens-Bonus —
  Loyalität heißt hier: er feilscht nicht um den letzten Cent, wenn der Kader passt.
- **`E_projekt` (−2 %): „Er kauft Perspektive mit Gehaltsverzicht."**
  Exakt dieselben Gates wie `ambition_match` (Trait `ambitious` × `teamIdentity.ambition ≥ 8`
  oder `starPriority ≥ 8`) — keine neue Bedingung, nur die zweite Hälfte der Aussage: der
  W-Bonus (+4 ≈ 1,2 %) sagt „er will", der Rabatt sagt „und er zahlt dafür".
- **`E_radar` (−2 %): „Euer Netzwerk kennt die, die sonst niemand fragt."**
  Scouting-Bonus ≥ 6 heißt Scouting-Level ≥ 4 (`getTransfermarktScoutingRecruitmentBonus`:
  [0,1,2,4,6,9]). Gate `marketValue ≤ 25` = die „depth"-Schwelle aus `recommendedDealRole`:
  der Beziehungsrabatt gilt nur für kleine Spieler unter dem Radar. Stars werden über
  Scouting **nie** billiger — sonst wäre die Ausbaustufe ein globaler Rabatthebel, und der
  Pol wäre wieder keiner.

**Geprüft und verworfen: `popularity`.** Ein populäres Teamumfeld wirkt bereits zweimal —
als Statuserwartung von Diva/Ego auf der Forderungsseite (`deriveTraitCultureSignals`,
Statussignal ab `popularity ≥ 7`) und indirekt in `trait_culture` auf `W`. Eine dritte
Wirkung als Rabatt würde bei denselben Spielern gegenläufig verrechnet und wäre im Tooltip
nicht mehr erklärbar.

### Kalibrierung: wie weit runter?

- **Clamp −0,08 und Floor 0,84:** Der härteste statische Fall (z. B. loyal, Fit 38, eine
  Saison vereinslos, MW 22 bei Scouting 4: E = −0,08, W ≥ 73) sagt bei **0,84–0,85 ×
  Forderung** zu — 15–16 % unter Forderung, mit Wunschvertrag 0,80. Das ist echtes
  „auf Lowballen eingehen", nicht die heutigen 6 %.
- Typische `E`-Träger (eine Quelle) landen bei **0,88–0,93**.
- Der Median bewegt sich fast nicht: `E` trifft eine benennbare Minderheit, nicht den Pool.
- Und wichtig für das Gefühl: bei `E < 0` liegt auch sein **Zielpunkt** `T = D′·min(R_full, P)`
  unter der Forderung — er nennt von sich aus ein Gegenangebot *unterhalb* seiner Forderung.
  Der Tooltip kann es ankündigen, die Verhandlung löst es ein.
- **Der eine Kalibrier-Knopf:** Sollte die Messung am Spielstand zeigen, dass viele
  Marktspieler Team-Historie samt `inactiveSeasons ≥ 1` haben (dann rutscht zu viel Pool in
  den Rabatt), `E_vereinslos` von −0,03 auf −0,02 je Saison senken. Zielgröße: **10–20 %
  der Kandidaten mit Zusage-Schwelle < 0,95** (heute 3,3 %).

---

## 9.3 Zugeständnisse erwidern: das Gegenangebot bekommt Gedächtnis

### Regel

Liegt im Draft ein Geld-Gegenangebot aus der Vorrunde (`status = "countered"`,
`lastCounterSalary` gesetzt, Konditionen unverändert), gilt bei einem erhöhten Angebot:

```
ΔO      = O − draft.offeredSalary                  // sein Bezugspunkt: euer letztes Angebot
g       = stur ? 0.3 : (E < 0 ? 0.7 : 0.5)         // Gegenzug-Faktor
ρ       = stur ? 0.01 : (E < 0 ? 0.03 : 0.02)      // Erwiderungs-Budget (gesamt)

echter Schritt:  ΔO ≥ 0.01 · D0                    // sonst keine Erwiderung
C_formel = O + (T − O) · h                          // wie live (3.1), gegen D′
C_mem    = draft.lastCounterSalary − g · ΔO
T_min    = D′ · (min(R_full, P) − ρ)                // Budget-Boden

C = max( min(C_formel, C_mem, draft.lastCounterSalary), T_min )
C − O < 0.02  →  ZUSAGE zum Angebot O              // Bagatelle-Regel, erweitert
```

Kein Vorrunden-Gedächtnis (erste Runde, oder Konditionen gewechselt) → `C = C_formel` wie
live. Rückzieher (`O` unter das letzte Angebot) → weiterhin Affront-Regel (4.3), unverändert.

### Warum diese Konstanten

- **`g = 0,5` Basis:** das klassische „er kommt dir auf halbem Weg entgegen" — pro Cent,
  den der Nutzer drauflegt, geht sein letztes Wort einen halben runter. Sture 0,3 (er
  bewegt sich, aber zäh — fühlbar anders), Willige 0,7 (er springt fast mit). Alle drei
  Werte liegen unter dem Trotz-Faktor 1,5 — Voraussetzung des Exploit-Beweises in 9.5.
- **`ρ` (Budget):** deckelt, was Erwiderung **insgesamt** gegenüber dem Direktangebot
  `D′·R_full` sparen kann. Ohne Boden wäre Salami-Taktik dominant: viele kleine Schritte,
  jeder halb erwidert, konvergieren rechnerisch ~6 % unter die Zusage-Schwelle
  (nachgerechnet: Treffpunkt bei `W = 50` läge bei 0,926 statt 0,99). Mit Boden konvergiert
  der Pfad bei `R_full − ρ`. Die Werte 1/2/3 % decken sich mit dem schon in Abschnitt 6
  gemessenen Feilsch-Optimum (~1–3 %) — die Erwiderung **verteilt** diesen Gewinn sichtbar
  auf die Runden, statt ihn zusätzlich auszuschütten.
- **Mindestschritt 1 % von `D0`:** Fünf-Cent-Schritte sind kein Entgegenkommen, sondern
  Theater. Das Budget deckelt den Schaden ohnehin; der Mindestschritt hält das Ritual
  ehrlich („ein Schritt ist ein Schritt").
- **`C ≤ lastCounterSalary` immer:** Er steht zu seinem letzten Wort — sein Gegenangebot
  steigt innerhalb einer Verhandlung nie. (Die Forderung kann per Trotz steigen — aber nur
  als Antwort auf einen Lowball, und Trotz kann nach einem Konter gar nicht mehr feuern,
  weil ein Absenken des Angebots dann die Affront-Regel auslöst. Beide Gedächtnisse können
  sich deshalb nie widersprechen.)
- **Konditionenwechsel löscht `lastCounterSalary`:** Sein Wort galt für Laufzeit/Form der
  Vorrunde (beides steht im Draft: `contractLength`, `contractShape`). Ändert der Nutzer
  die Konditionen, ist es eine neue Sachlage — die nächste Runde beginnt gedächtnislos bei
  `C_formel`. Der Trotz-Aufschlag bleibt davon unberührt (Beleidigung hängt nicht an der
  Vertragsform).

### Das Umbros-Beispiel, neu

Annahmen aus der Messung rekonstruiert: `D = 14,72`, `W ≈ 53`, `K = 0`, keine Traits →
`R_full = 0,981`, `T = 14,44`, `ρ = 0,02` → `T_min = 14,15`, `g = 0,5`.

```
dein Angebot    heute (gemessen)    neu
   13,25            14,44          14,27    (C_formel, erste Runde)
   13,50            14,43          14,15    (C_mem = 14,27 − 0,5·0,25 = 14,145 → Boden 14,15)
   14,00            14,44          14,15    („Er bleibt bei 14,15" — Budget ausgeschöpft)
```

Wer entgegenkommt, sieht die Zahl sinken; wer weiter schiebt, hört ein glaubwürdiges
„mehr geht nicht" statt einer stur identischen Zahl. Einschlagen bei 14,15 spart 0,29
gegenüber heute — genau `ρ·D`.

---

## 9.4 Neue Felder (hebt zwei Punkte aus Abschnitt 7 auf)

Abschnitt 7 hat `counterSalary` im Draft für **nicht nötig** erklärt — das galt, solange
das Gegenangebot eine gedächtnislose Funktion von `(O, D, W, Traits)` war. Mit Erwiderung
und Trotz ist es geschichtsabhängig; die Felder sind jetzt beauftragt. Beide leben im
`ContractNegotiationDraft` (`lib/data/olyDataTypes.ts` ~Z. 1847) — dem einzigen Ort, der
Verhandlungsgedächtnis je Season/Team/Spieler ohnehin schon persistiert (Status, letztes
Angebot) und den die Preview bereits als Eingang kennt (`priorBadExperience`,
`affrontRetreat` werden dort abgelesen, `lib/market/transfermarkt-local-service.ts`
~Z. 1224–1245):

```
ContractNegotiationDraft (neu):
  lastCounterSalary: number | null;      // sein letztes Geld-Wort; geschrieben bei
                                         // verdict === "counter_money" zusammen mit
                                         // status = "countered"; genullt bei Konditionen-
                                         // wechsel und bei jedem Statuswechsel weg von
                                         // "countered"
  defianceSurchargePct: number;          // 0-Default; monoton per max() beim Verhandeln-
                                         // Klick; genullt beim Uebergang zu
                                         // rejected_bad_experience (keine Doppelstrafe)
                                         // und implizit per neuem Season-Draft
```

Neue Preview-Eingänge (aus Draft bzw. Morale-Store, alle vom Service beizusteuern wie
heute `affrontRetreat`): `priorDefianceSurchargePct`, `lastCounterSalary`,
`lastNegotiatedSalary` (= `draft.offeredSalary`, wird für die Affront-Regel schon gelesen),
`inactiveSeasons` (aus `PlayerMoraleState` des letzten Teams; fehlt der Eintrag → 0).

Neue Preview-Ausgänge für Tooltip/Dialog: `eagernessPct` (= `E`) samt Quellen-Sätzen,
effektives `defianceSurchargePct` (inkl. Hypothese fürs getippte Angebot) und die
angepasste Forderungszeile `D0 → D′`.

Das **Gedächtnis-Zusammenspiel** der drei persistierten Mechanismen ist disjunkt nach
Richtung des Angebots: runter = Affront (bestehend), tief = Trotz (neu, nur vor dem ersten
Konter erreichbar), rauf = Erwiderung (neu). Es gibt keine Runde, in der zwei davon
gleichzeitig feuern können.

## 9.5 Exploit-Rechnung: Lowball + Entgegenkommen darf nie gewinnen

Zu zeigen: kein Pfad aus Angeboten `O₁ … Oₙ` plus Einschlagen endet billiger, als es die
Regeln wollen. Drei Spielertypen, `D = 10,00`, `K = 0`, `W = 50` (Sture/Normale) bzw.
`W = 70` (Willige):

**Normal (keine Traits, E = 0):** `R_full = 0,99`, `R_rej = 0,78`, ehrlich direkt = 9,90.
Bester Pfad: 9,00 → Konter 9,79 → 9,10 → 9,74 → 9,20 → Boden 9,70 → einschlagen.
**Ergebnis 9,70 = `R_full − ρ` = 2 % unter direkt**, dafür drei echte Runden mit
steigenden Angeboten. Tiefer geht kein Pfad: der Boden `T_min` ist pfadunabhängig.

**Stur (Mercenary):** `R_full = 1,01`, `R_rej = 0,83`, `P = 1,06`, `L = 0,90`, ehrlich
direkt = 10,10.
- Lowball 8,90 (r₀ = 0,89, Zone 2): `s = 1,5 % → aufgerundet` +1,5 %, `D′ = 10,15`,
  Konter 10,14, Boden `10,15·1,00 = 10,15`. Bester Abschluss ≈ **10,14 — teurer als
  ehrlich (10,10)**. Netto-Strafe ≈ 1,5·Tiefe, und die Erwiderung (g = 0,3) kann sie nie
  aufholen, weil 0,3 < 1,5.
- Tiefer Lowball 8,50 (r₀ = 0,85): `s = +6 %` (Kappe), `D′ = 10,60`, `r′ = 0,802 < R_rej`
  → **Absage + Vertrauensbruch**. Die Vorschau zeigt genau das vor dem Klick.
- Braver Pfad ohne Lowball (Start 9,20 = 0,92 > L): Grind bis Boden 10,00 = 1 % unter
  direkt (ρ stur = 0,01). Sture belohnen Höflichkeit minimal und bestrafen alles andere.

**Willig (E = −0,08, W = 70):** `R_full = 0,85`, ehrlich direkt = 8,50.
Lowball 8,00 (r = 0,80 — bei Willigen erlaubt: kein Trait, kein Trotz; `R_rej = 0,70`):
Konter 8,36, Grind (g = 0,7) bis Boden `8,50 − 0,30 = 8,20` → Abschluss ≈ **8,20–8,36,
also 16–18 % unter der Forderung**. Hier — und nur hier — lohnt Lowballen wirklich, und
der Tooltip hat vorher gesagt, warum.

Invariante für das Prüfskript (ergänzt die drei aus Abschnitt 6):

```
4. s ist monoton je Draft, ≤ 0,06; Vorschau-Verdikt mit s_hyp ≡ Klick-Ergebnis (WYSIWYG).
5. C ≤ lastCounterSalary bei unveraenderten Konditionen; C ≥ T_min; gleiche Eingaben →
   gleiches C (keine Ratsche, auch nicht rueckwaerts).
6. min ueber alle Angebots-Pfade = D·(R_full − ρ) fuer Nicht-Sture; fuer Sture ist jeder
   Pfad mit einem Angebot unter L strikt teurer als das ehrliche Direktangebot.
```

## 9.6 Tooltip-Erweiterung (die vier Bündel aus Abschnitt 5)

**Bündel 1 — „Will er überhaupt wechseln?"** bekommt die `E`-Quellen als Sätze, mit der
Zahl, die sie wert sind:
_„Seit zwei Saisons ohne Vertrag — er will einfach wieder spielen. Zusage schon ab 12,50 M
(−15 % unter Forderung)."_ / _„Loyaler Typ, und euer Kader passt zu ihm — er feilscht
nicht um den letzten Cent (−3 %)."_ / _„Er will in ein ambitioniertes Projekt — eures ist
eins (−2 %)."_ / _„Euer Scouting kennt ihn lange; solche Spieler fragt sonst niemand an
(−2 %)."_

**Bündel 3 — „Reicht das Paket?"** bekommt die Sturheits-Warnung **vor** dem ersten
Lowball, mit konkreter Grenze:
_„Söldner: unter 13,25 M (10 % unter seiner Forderung) nimmt er's persönlich — seine
Forderung steigt dann um bis zu 6 % für den Rest der Verhandlung."_
Und bei `E < 0` die Gegenaussage: _„Bei ihm darfst du tief einsteigen — ernst nimmt er
euch noch bis runter zu 10,30 M."_ (= `D·R_rej`).

**Bündel 4 — „Ist was vorgefallen?"** bekommt beide Gedächtnisse:
_„Euer Angebot aus Runde 1 lag 12 % unter seiner Forderung — der Trotz-Aufschlag (+3 %)
bleibt für diese Verhandlung."_ / _„Er stand zuletzt bei 14,15 M — kommt ihr ihm entgegen,
geht er mit (etwa die Hälfte eures Schrittes)."_ / Budget erschöpft: _„Er bleibt bei
14,15 M — tiefer geht er in dieser Verhandlung nicht mehr."_

Bündel 2 bleibt unverändert. Alle neuen Sätze speisen sich aus `eagernessPct`-Quellen,
`defianceSurchargePct`, `lastCounterSalary` und den Schwellen — nichts davon ist geraten,
alles ist die Formel in Alltagssprache.

## 9.7 Formel-Kompaktblock (Nachtrag) und Zielverteilung

```
Neue Eingaben:
  inactiveSeasons   aus PlayerMoraleState des letzten Teams (fehlt → 0)
  draft.lastCounterSalary, draft.defianceSurchargePct, draft.offeredSalary (existiert)
  stur = mercenary ∨ diva ∨ egomaniac

Eile-Rabatt (williger Pol):
  E = clamp( −0.03·min(inactiveSeasons, 2)
             + (loyal ∧ teamFit ≥ 30 ? −0.03 : 0)
             + (ambitious ∧ (teamAmbition ≥ 8 ∨ starPriority ≥ 8) ? −0.02 : 0)
             + (scoutingBonus ≥ 6 ∧ marketValue ≤ 25 ? −0.02 : 0),  −0.08, 0 )
  R_money = max( clamp(1.14 − 0.003·W, 0.92, 1.14) + persReq + E, 0.84 )
  R_full  = R_money + K            // theoretisches Minimum 0.80; R_rej unveraendert

Trotz-Aufschlag (nur stur):
  r0 = O / D0;   L = min(0.90, R_full − 0.04)
  s_offer = stur ∧ r0 < L ? min(0.06, roundTo(1.5·(L − r0), 0.005)) : 0
  s  = max(draft.defianceSurchargePct, s_offer)    // persistiert nur beim Verhandeln-Klick
  D′ = D0·(1 + s)                                  // alle Baender & T rechnen gegen D′
  Nullung von s nur bei Uebergang zu rejected_bad_experience (Doppelstrafen-Verbot)

Erwiderung (nur bei status "countered", gleiche Konditionen, O > draft.offeredSalary):
  ΔO = O − draft.offeredSalary;    echter Schritt: ΔO ≥ 0.01·D0
  g  = stur ? 0.3 : (E < 0 ? 0.7 : 0.5)
  ρ  = stur ? 0.01 : (E < 0 ? 0.03 : 0.02)
  C  = max( min( O + (T−O)·h,  draft.lastCounterSalary − g·ΔO,  draft.lastCounterSalary ),
            D′·(min(R_full, P) − ρ) )
  C − O < 0.02 → ZUSAGE zum Angebot O
```

Zielverteilung der Zusage-Schwellen (× Forderung), gegen den Spielstand zu validieren:

| Kennzahl | heute | Ziel (statisch, Erstkontakt) | dynamisch (in der Verhandlung) |
|---|---|---|---|
| min | 0,940 | **0,840** (mit Wunschvertrag 0,800) | — |
| P25 | 0,963 | ~0,950 | — |
| Median | 0,973 | ~0,970 (E trifft die Minderheit, nicht den Pool) | — |
| P75 | 0,991 | 0,991 (unverändert) | — |
| max | 1,052 | 1,052 (unverändert) | bis **1,115** nach Lowball bei Sturen (+6 %) |
| Anteil Zusage < 0,95× | 3,3 % | **10–20 %** (Kalibrierziel; Knopf: `E_vereinslos`) | — |

Nach Trait-Gruppe: Mercenary/Egomaniac/Diva statisch unverändert (Ø 1,007), aber mit
Preisschild auf Lowballs; Loyal mit Fit ≥ 30 rutscht von Ø 0,960 auf ~0,93; Vereinslose
und Radar-Spieler bilden den neuen Boden bei 0,84–0,91.

---

# 10. Der willige Pol, nachgemessen — warum Abschnitt 9.2 ersetzt statt kalibriert wurde

**Status: live.** Abschnitt 9.2 (Eile-Rabatt `E`) ist damit **verworfen und nicht gebaut**;
9.1 (Trotz) und 9.3 (Erwiderung) bleiben davon unberührt und weiterhin offen.

Auftrag (Chris): _„es muss auch welche geben die auf lowballen eingehen"_, zuletzt präzisiert
zu _„müssen den aktuellen Stand nur sauber nachschärfen"_.

Abschnitt 9.2 endete mit einem Kalibrier-Knopf: falls zu viele Marktspieler
`inactiveSeasons ≥ 1` mitbringen, `E_vereinslos` von −0,03 auf −0,02 senken. Die Messung am
echten Spielstand hat das Gegenteil des erwarteten Problems gezeigt — und dabei auch die
Ursachen-Diagnose des Entwurfs widerlegt. Beides ist zu grundsätzlich für einen Knopf.

## 10.1 Was die Messung gesagt hat

Gemessen mit demselben Eingang, den `transfermarkt-local-service.ts:910` benutzt
(`teamIdentity`, `teamStrategyProfile`, `scoutingLevel` — ein erster Lauf ohne diese drei
Felder lieferte stumme Zutaten und wurde verworfen), drei Teams × 500 Marktspieler:

```
                              C-C          A-A          G-G
Wechselwille W   min/Med/max   36/46/64     26/45/55     20/44/83
Zusage-Schwelle  min/Med/max   0,942/1,004  0,969/1,008  0,884/1,011
Anteil Zusage unter 0,95×      0,6 %        0,0 %        3,2 %
```

**Befund A — der benannte Übeltäter war unbeteiligt.** Der Boden 0,92 in `R_money` greift
erst ab `W = 73`. Gekappt wurden **0 von 1500** Spielern. Abschnitt 9.2 hatte ihn als Ursache
benannt („Ursache ist der Floor 0,92"); das trifft für diesen Spielstand nicht zu.

**Befund B — alle vier Eile-Quellen feuern für 0 %.**

| Quelle | Gate | Wirklichkeit am Spielstand |
|---|---|---|
| `E_vereinslos` | `inactiveSeasons ≥ 1` | `playerMoraleState` hat **nur Kaderspieler** (332 von 2652). Marktspieler haben gar keinen Eintrag → Verteilung `{0: 2652}` |
| `E_loyalfit` | `teamFit ≥ 30` | beobachtetes Fit-**Maximum** 28 |
| `E_projekt` | `ambition ≥ 8` ∨ `starPriority ≥ 8` | Team-Ambition 2,8, starPriority 4 |
| `E_radar` | `scoutingBonus ≥ 6` | Scouting-Stufe 0 → Bonus 0 |

Der Entwurf hatte die Datenbedingung bei `E_vereinslos` selbst angesprochen und darauf
gesetzt, dass sie „die richtige Gruppe trifft statt des halben Pools". Sie trifft niemanden.
Vier Quellen mit acht Prozentpunkten Gesamtwirkung hätten am Spielerlebnis **nichts**
geändert — der Rabatt-Pol wäre eine Zeile im Tooltip geblieben, die nie erscheint.

**Befund C — die eigentliche Ursache ist die Stauchung von `W`.** Von neun Zutaten des
Wechselwillens tragen an diesem Spielstand vier **nichts** bei (`scouting_network`,
`loyal_fit`, `ambition_match`, `bad_experience`), und `base_interest` ist eine Konstante 45
für jeden. Übrig bleiben `trait_culture`, `team_fit` — und ein Würfel (`negotiation_mood`,
±4), der fast so groß war wie das einzige echte Signal.

## 10.2 Erste Schärfung: die Fit-Kennlinie hatte eine Klippe, die niemand erreicht

`team_fit` hatte drei Zweige mit einer Sprungstelle bei Fit 25: darunter `teamFit / 5` (bei
Fit 25 also **+5**), darüber `max(fit25Bonus, clamp(fit·0,65, 8, 28))` — **+16**. Elf
Willenspunkte Sprung innerhalb eines Zehntels Fit.

Der beobachtete Fit reicht von −49 bis **+28**. Der obere Zweig feuerte bei **4 von 1500**.
Der gesamte Ast, der bis zu +28 Willenspunkte vergeben konnte, war praktisch tot, während der
mittlere bei +5 deckelte. Neu gilt derselbe Anstieg **0,65 durchgehend ab 0** — die Steigung
des alten oberen Zweigs, nur ohne Sprungstelle. `fit25Bonus` bleibt ab Fit 25 ein Boden: dort
war er schon vorher ein Mindestwert und ist eine Team-Entscheidung, keine Kennlinie. Der
Malus-Ast bleibt unverändert.

Wirkung auf `team_fit` als W-Beitrag: Spanne 10 → **23** Punkte, Träger 72 % → 91 %.

## 10.3 Zweite Schärfung: die Geld-Kennlinie war zu flach, nicht zu tief gedeckelt

```
vorher:  R_money = clamp(1,14 − 0,0030·W, 0,92, 1,14) + persReq
neu:     R_money = clamp(1,20 − 0,0045·W, 0,88, 1,20) + persReq
```

Die Gerade dreht sich um ihren Angelpunkt bei `W = 42`, knapp unter dem gemessenen Median 46.
Das ist die Bedingung dafür, dass die Schärfung den **Schwierigkeitsgrad nicht verschiebt**:
die mittlere Schwelle bleibt praktisch stehen, die Enden spreizen sich. Genau die waren die
Beschwerde — Unwillige werden teurer, Willige wirklich billig. Der Boden fällt auf 0,88,
damit die neue Steigung oben nicht sofort wieder abgeschnitten wird.

## 10.4 Ergebnis, am selben Spielstand nachgemessen

```
Team C-C, 600 Marktspieler          vorher      nachher
Wechselwille W  Median / max        46 / 64     48 / 73
Zusage-Schwelle min                 0,942       0,885
Zusage-Schwelle Median              1,004       0,991    ← Mitte bleibt stehen
Anteil Zusage unter 0,95×            0,5 %      14,8 %   ← Zielband 10–20 %
```

Über drei Teams: 0,6 / 0,0 / 3,2 % → **16,2 / 7,4 / 17,2 %**.

Zwei Konstanten und eine stetige Kennlinie statt vier neuer Rabattquellen mit eigenen Gates,
Tooltip-Sätzen und Preview-Feldern. Kein neues Feld, kein neues Gedächtnis, keine Quelle, die
an einem anderen Spielstand wieder stumm sein kann: die Schärfung wirkt auf der Achse, die es
ohnehin schon gibt.

Beide Kennlinien liegen jetzt als benannte Funktionen frei (`deriveTeamFitWillingnessPoints`,
`deriveMoneyThresholdRatio`) — sonst ließe sich Stetigkeit nur behaupten, nicht messen.
`tests/verhandlung-williger-pol.test.ts` prüft die Stetigkeit über den gesamten beobachteten
Fit-Bereich, die Drehung um W = 42, die Monotonie und die Identität zwischen veröffentlichter
Schwelle und Kennlinie (eine Quelle je Größe — laufen Tooltip und Verdikt auseinander, ist
die Erklärung wertlos).

## 10.5 Was offen bleibt

- **9.1 Trotz-Aufschlag** und **9.3 Erwiderung** sind unverändert beauftragt und nicht gebaut.
  Sie brauchen die Draft-Felder aus 9.4 (`lastCounterSalary`, `defianceSurchargePct`) und
  hängen nicht an `E`.
- **`base_interest` ist eine Konstante 45.** Kein Defekt, aber der Grund, warum `W` selbst nach
  der Schärfung erst bei ~35 beginnt. Falls der Pol später noch breiter werden soll, ist das
  der nächste ehrliche Hebel — nicht ein weiterer Rabatt.
- **Vier stumme W-Zutaten.** `scouting_network`, `loyal_fit`, `ambition_match` und
  `bad_experience` sind nicht kaputt: sie hängen an Ausbaustufen, Teamidentität und
  Verhandlungshistorie, die dieser Spielstand schlicht nicht hat. Sie werden lauter, wenn das
  Team wächst. Wichtig ist nur, sie nicht mit „wirkt" zu verwechseln, wenn kalibriert wird —
  genau dieser Fehler steckte in 9.2.

---

# 11. Was beim Bauen anders wurde als im Entwurf

Alle Abweichungen kommen aus derselben Quelle wie Abschnitt 10: Nachmessen am echten Save.

## 11.1 Zwei weitere Gates lagen oberhalb der Wirklichkeit

Chris beim Lesen von Abschnitt 10: _„teamFit >30 ist kaum erreichbar, >10 ist schon stark!
ambition würde ich auch auf >6 oder >7 runter setzen."_ — bestätigt durch dieselbe Messung, die
schon die vier Eile-Quellen erledigt hat. Beide Schwellen sind LIVE-Code, nicht nur Entwurf:

| Konstante | vorher | jetzt | Warum |
|---|---|---|---|
| `LOYAL_FIT_THRESHOLD` | 20 | **10** | Teamfit real −49 … +28, P90 = 11,4. Traf zusammen mit dem Loyal-Trait so gut wie nie: Trefferquote **0 %** → jetzt 7 % |
| `AMBITION_PROJECT_THRESHOLD` | 8 | **7** | Team-Ambition real 2,8 … 8,8, `starPriority` = 4. Die 8 war praktisch der Maximalwert, nicht eine hohe Hürde |

Der Zweifel-Zweig auf der Forderungsseite rutscht entsprechend von `ambition ≤ 4` auf `≤ 3`,
damit zwischen „passt" und „zweifelt" ein neutraler Bereich bleibt.

Beide Werte stehen jetzt als benannte Konstanten mit der Messung im Kommentar — dieselbe
Vorsichtsmaßnahme wie bei den Kennlinien: wer sie anfasst, misst vorher.

## 11.2 Trotz: der Aufschlag wirkt ab der NÄCHSTEN Runde

Der Entwurf ließ offen, gegen welche Forderung das Verdikt derselben Runde rechnet. Beide
naheliegenden Lesarten sind kaputt:

- Rechnet das Verdikt sofort gegen `D′`, ist es die Antwort auf eine Forderung, die es im
  Moment des Tippens noch gar nicht gibt — man tippt eine Zahl und bekommt eine Absage auf eine
  andere.
- Rechnet der Auslöser gegen `D′`, verschiebt der Aufschlag seinen eigenen Auslöser und lädt
  sich Runde um Runde selbst nach.

Gebaut ist deshalb: **Auslöser misst gegen `D0`, Verdikt rechnet gegen `D′` mit dem bereits
VERHANDELTEN Aufschlag.** Die Vorschau weist den neuen Aufschlag als Hypothese aus
(`pendingDefianceSurchargePct`), der Klick schreibt ihn fest. Das ist zugleich das WYSIWYG, das
Abschnitt 9.1 verlangt: was der Banner ankündigt, ist exakt das Klick-Ergebnis.

**Und: der Abbruch misst ebenfalls gegen `D0`.** Sonst könnte ein Aufschlag, den der Spieler
selbst ausgelöst hat, dasselbe Angebot eine Runde später zum Vertrauensbruch machen — zweimal
bestraft für denselben Griff. „Trotz ist Ärger, kein Bruch" gilt damit auch mechanisch.

## 11.3 Erwiderung: zwei Fehler, die erst der Test gezeigt hat

Die Formel aus 9.3 war in dieser Reihenfolge geschrieben:

```
C = max( min(C_formel, C_mem, lastCounter), T_min )
```

Der Budget-Boden `T_min` steht außen — er kann das Gegenangebot also **über** `lastCounter`
heben, sobald die Zusage-Schwelle hoch liegt. Genau das trat auf: 79,77 statt der versprochenen
höchstens 79,74. Das ist die Ratsche durch die Hintertür: er kommt entgegen und fordert
trotzdem mehr als vorher. Gebaut ist deshalb **erst Boden, dann Deckel**:

```
C = min( lastCounter, max( min(C_formel, C_mem), T_min ) )
```

Der zweite Fehler saß am Rand des Mindestschritts. Ein Schritt einen Cent unter der 1-%-Grenze
fiel aus dem Gedächtnis heraus — und die gedächtnislose Formel nannte prompt wieder eine höhere
Zahl als in der Vorrunde. Der Mindestschritt entscheidet jetzt nur noch, ob er **entgegenkommt**,
nicht ob er wieder **hochgehen** darf: sein letztes Wort deckelt in jedem Fall.

## 11.4 Der Willens-Pol ersetzt `E` als Unterscheidung „stur / normal / willig"

9.3 staffelte Gegenzug-Faktor `g` und Budget `ρ` nach `E < 0`. `E` gibt es nicht mehr. An seine
Stelle tritt der Wechselwille selbst: `W ≥ 60` — knapp über dem gemessenen P90 (59), also der
obere Rand und nicht die obere Hälfte. Dieselbe Dreiteilung, aber an einer Größe, die es
wirklich gibt.

## 11.5 Gemessen nach dem Bauen

```
Trotz, 215 sture Kandidaten, Lowball bei 0,88x Forderung:
  löst Aufschlag aus: 202/215 = 94 %
  Beispiel Zed (Egomaniac): Forderung 13,64 -> 14,05 (+3,0 %), Verdikt bleibt counter_money

Erwiderung, derselbe Spieler, Gegenangebot der Vorrunde 13,57:
  Angebot +1 %   ohne Gedächtnis 13,57   mit 13,53
  Angebot +2 %   ohne Gedächtnis 13,58   mit 13,51
  Angebot +4 %   ohne Gedächtnis 13,61   mit 13,51   (Budget ausgeschöpft)
```

Die linke Spalte ist der gemeldete Missstand in Reinform: **je weiter man entgegenkam, desto
höher wurde seine Forderung.** Rechts sinkt sie und bleibt dann stehen — ein glaubwürdiges
„mehr geht nicht" statt einer stur identischen Zahl.

## 11.6 Der Tooltip erklärt alle drei Gedächtnisse an EINER Stelle

Das Bündel „Ist was vorgefallen?" (Abschnitt 5) trägt jetzt alle drei — Vertrauensbruch, Trotz
(geltend und angekündigt getrennt) und Erwiderung. Verteilt auf drei Ecken der Oberfläche wäre
jedes einzeln ein Rätsel; die Frage lautet „warum ist seine Forderung anders als eben?", und die
hat genau eine Antwortstelle zu haben.

Dazu im Kaufdialog zwei Banner, und die Trennung ist der Punkt: einer sagt, was SCHON gilt, der
andere, was ein Klick auslösen WÜRDE. Ohne den zweiten wäre der Aufschlag eine Überraschung nach
dem Klick; ohne den ersten wäre die erhöhte Forderung unerklärt.

## 11.7 Weiterhin offen

- `base_interest` ist weiterhin eine Konstante 45 (Abschnitt 10.5).
- Vier W-Zutaten bleiben an diesem Spielstand stumm, weil ihm die Ausbaustufen und die
  Verhandlungshistorie fehlen (Abschnitt 10.5) — kein Defekt, aber beim nächsten Kalibrieren zu
  beachten.
