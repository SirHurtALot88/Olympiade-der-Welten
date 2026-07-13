# Kredit- & Schuldensystem

Status: **Service-/Mechanik-Ebene fertig** (Phase 1 + 2 + 3). Offen: menschliche UI (Aufnahme,
Ablösung, Angebots-Karten, Finanz-Integration) und Balancing nach Playtest.

## Ziel

Teams — Menschen **und** KI — können einen Bankkredit aufnehmen, um sich cash-seitig über
Wasser zu halten (z. B. um in Season 2 den Kader trotz knapper Kasse aufs Optimum aufzufüllen).
Der Kredit wird über eine feste Laufzeit (1–10 Saisons = Jahre) per **Annuität** zurückgezahlt.
Die entstehende **Restschuld** ist eine eigene Bilanz-Seite neben dem Cash und macht spürbar:
„Ich habe Schulden, ich muss auf dem Transfermarkt vorsichtiger sein."

### Nicht-Ziele (bewusst ausgeklammert)

- Keine zusätzliche dynamische Dauer-Mechanik, die sich ständig neu berechnet. Zins wird bei
  Abschluss **fixiert**, die Rate ist über die Laufzeit konstant.
- Kein Mid-Season-Kredit. Kreditaufnahme passiert **nur im Preseason** (vor der Kaufphase).
- Team-zu-Team-Kredite (aus dem Cash anderer Teams, beziehungsbasierte Konditionen) sind
  Phase 3 und hier nur skizziert.

## Datenmodell

Neu in `lib/data/olyDataTypes.ts`:

```ts
export type LoanLenderType = "bank" | "team"; // "team" erst Phase 3

export type LoanRecord = {
  loanId: string;
  borrowerTeamId: string;
  lenderType: LoanLenderType;
  lenderTeamId?: string;            // nur bei lenderType === "team"
  principalOriginal: number;        // ursprüngliche Kreditsumme
  principalOutstanding: number;     // Restschuld -> die Schulden-Seite
  interestRatePerSeason: number;    // fix bei Abschluss (z. B. 0.152)
  termSeasons: number;              // 1..10
  seasonsRemaining: number;
  installmentPerSeason: number;     // Annuität, konstante Jahresrate
  originatedSeasonId: string;
  status: "active" | "paid" | "defaulted";
  missedPayments: number;
};

export type LoanApplyLogRecord = {
  seasonId: string;                 // Saison, in der die Rate verbucht wurde
  loanId: string;
  installmentCharged: number;
  interestPortion: number;
  principalPortion: number;
  createdAt: string;
};
```

Neue Felder auf `SeasonState` (round-trippt automatisch durch den JSON-Blob in
`lib/persistence/sqlite.ts`, keine Migration nötig):

```ts
loans?: LoanRecord[];
loanApplyLogs?: LoanApplyLogRecord[];  // Idempotenz-Log analog objectiveRewardApplyLogs
```

**Restschuld je Team** = `sum(loans where borrowerTeamId === team && status === "active", principalOutstanding)`
— abgeleitet, kein eigener Store.

## Zins- & Tilgungsmodell

**Tilgung: Annuität.** Konstante Jahresrate `A = P · r / (1 − (1 + r)^(−n))` mit `P` =
Kreditsumme, `r` = `interestRatePerSeason`, `n` = `termSeasons`. Jede Saison wird die Rate im
Saison-Abschluss belastet; sie zerfällt in Zins- (`principalOutstanding · r`) und Tilgungsanteil.

**Zinssatz p. a.** (bei Abschluss fixiert):

```
rate = clamp( 0.10 + risk − termDiscount , 0.07 , 0.20 )
  risk         = (10 − identity.finances) · 0.012      // 0 … ~0.084
  termDiscount = (termSeasons − 1) · 0.004             // 0 … 0.036
```

- Längere Laufzeit → **niedrigerer Satz**, aber die absolute Zinslast steigt trotzdem monoton
  (der Rabatt ist bewusst mild).
- Floor 7 %, Cap 20 % — nie geschenkt, nie ruinös.

### Beispiel: 20 Mio. Kredit, `finances 5` (risk +6 %)

| Laufzeit | Satz p. a. | Jahresrate | Summe Rückzahlung | Zinsen gesamt |
|---:|---:|---:|---:|---:|
| 1 J | 16,0 % | 23,20 Mio. | 23,20 Mio. | 3,20 Mio. |
| 3 J | 15,2 % | 8,79 Mio. | 26,37 Mio. | 6,37 Mio. |
| 5 J | 14,4 % | 5,88 Mio. | 29,41 Mio. | 9,41 Mio. |
| 8 J | 13,2 % | 4,20 Mio. | 33,57 Mio. | 13,57 Mio. |
| 10 J | 12,4 % | 3,60 Mio. | 35,98 Mio. | 15,98 Mio. |

## Kreditlimit (Borrowing Capacity)

Verhindert Infinite-Money. Die Kapazität ist eine **Kombination** aus Teamwert (Cash + Kaderwert)
und Tragbarkeit (Jahreseinnahmen), nicht nur ein Einzelwert:

```
capacity = min( teamwertCap , tragbarkeitsCap ) − aktuelleRestschuld
  teamwertCap     = 0.15 · cash + 0.30 · marketValueTotal   // Cash + Kaderwert = Teamwert
  tragbarkeitsCap = 1.5 · jährlicheEinnahmen                // deckelt nach Repay-Fähigkeit
```

- Der `min`-Guardrail bleibt bewusst: ein Team mit dickem Kader, aber mageren Einnahmen kann sich
  nicht überschulden — die Einnahmen begrenzen, was realistisch bedienbar ist.
- `cash` = aktuelles `Team.cash`; `marketValueTotal` aus `buildTeamSeasonOverviewRows`.
- `jährlicheEinnahmen` = Proxy aus Sponsoren-Payout der letzten Saison (TODO: Preisgeld ergänzen).
- Ein bereits hoch verschuldetes Team bekommt entsprechend weniger/keinen neuen Kredit.

**Season 1 = keine Kredite (harte Regel):** In Season 1 gibt es grundsätzlich keinen Kredit —
`originateLoan`/`resolveAiLoanDecision` lehnen ab, unabhängig von der Kapazität. Man kommt mit dem
aus, was man hat. (Zusätzlich ist der Einnahmen-Proxy in Season 1 ohnehin 0, weil noch keine
Sponsoren-Payouts geloggt sind — aber die Regel ist explizit, nicht nur ein Nebeneffekt.)

## Integrationspunkte

1. **Cash-Mutation** — dasselbe Muster wie `applyTeamSeasonObjectiveRewards`
   (`lib/board/team-season-objectives-service.ts`): `teams.map(t => ({...t, cash: roundCash(t.cash + delta)}))`.
   - Kreditauszahlung: `+principal` auf `Team.cash` bei Abschluss (Preseason).
   - Ratenbelastung: `−installment` pro Saison im Abschluss-Schritt.
2. **Saison-Abschluss** — neuer Schritt `loan_settlement` in
   `lib/season/season-completion-service.ts`, als Sibling zu `sponsor_settlement` /
   `objective_rewards`, idempotent über `loanApplyLogs`. Reihenfolge: nach Sponsoren-Settlement
   (Einnahmen zuerst), dann Kreditraten.

## Ablauf

### Kredit aufnehmen (nur Preseason)
- **Mensch:** in einer Finanzen/Bank-Ansicht; Kreditsumme + Laufzeit wählen, Satz/Rate werden
  live angezeigt, Auszahlung sofort auf Cash.
- **KI:** siehe KI-Anbindung.

### Tilgung (jeder Saison-Abschluss)
- Für jeden aktiven Kredit Rate berechnen, Cash belasten, `principalOutstanding` und
  `seasonsRemaining` reduzieren. Bei `seasonsRemaining === 0` → `status = "paid"`.

### Zahlungsausfall
- Reicht das Cash nicht für die Rate: fehlender Betrag wird kapitalisiert (auf
  `principalOutstanding` addiert) + 5 % Strafzins darauf, `missedPayments++`,
  Board-Confidence-Hit. Bei wiederholtem Ausfall `status = "defaulted"` + Zwangsverkauf-Flag
  (spätere Transfermarkt-Anbindung).

### Vorab-Rückzahlung (vorzeitige Ablösung)

Ein Team kann einen Kredit vorzeitig ablösen, ohne die vollen Restzinsen bis Laufzeitende zu
zahlen. Es zahlt die Restschuld plus nur einen kleinen Anteil der der Bank/dem Verleiher
entgangenen Zukunftszinsen:

```
restrateGesamt          = installmentPerSeason · seasonsRemaining   // was der Spieler als "noch offen" sieht
entgangeneZukunftszinsen = restrateGesamt − principalOutstanding
earlyPayoff             = principalOutstanding + PREPAYMENT_FEE_RATE · entgangeneZukunftszinsen
  PREPAYMENT_FEE_RATE = 0.20   // Vorfälligkeits-Entschädigung (Stellschraube)
```

- Beispiel: 25-Mio.-Kredit, „18 Mio. noch offen" (= Restraten). Restschuld z. B. 15 Mio.,
  entgangene Zinsen 3 Mio. → `earlyPayoff ≈ 15,6 Mio.` — deutlich unter den 18 Mio.
- `computeEarlyPayoff(loan)` liefert die Ablösesumme; `applyEarlyPayoff(gameState, loanId)` belastet
  Cash, setzt den Kredit auf `status: "paid"`. Bei Team-Krediten (Phase 3) fließt die Ablösung an
  den Verleiher.
- **Timing:** in der **Verkaufsphase** (aus Spielererlösen finanzierbar). Mensch per UI, KI per
  Entscheidung.

**Anti-Churn-Balancing** (verhindert „am Saisonende alles ablösen → nächste Saison neu leihen"):
- Natürliche Reibung: jede Ablösung kostet die Vorfälligkeits-Entschädigung, jeder neue Kredit
  kostet neue Zinsen — Hin-und-Her ist strikt teurer als Halten.
- KI-Regel: früh ablösen **nur aus echtem Überschuss** — Cash über dem Liquiditätspuffer *und* über
  dem erwarteten Kaufbedarf der nächsten Saison. Ein Team, das nächste Saison ohnehin Spieler
  braucht, löst nicht ab.
- Hysterese: ein gerade erst (dieselbe/letzte Saison) aufgenommener Kredit wird nicht sofort
  abgelöst; in derselben Saison nicht leihen *und* ablösen.

## KI-Anbindung (Phase 2)

Kernprinzip: **bedarfsgetrieben und persönlichkeitsgegated**, nicht zins-arbitrage-getrieben.
Ein Team nimmt nur einen Kredit auf, wenn es echten Kaderbedarf hat und ihn sich sonst nicht
leisten kann — sonst spart es (Cash-Creator/Hoarder-Teams borgen von selbst konservativ).

Einhängepunkt: **Preseason, unmittelbar vor der KI-Kaufphase** (`transfer_buy_phase`).

Entscheidungslogik `resolveAiLoanDecision(gameState, teamId)`:
1. **Bedarf**: aus der bestehenden Needs-/Utility-Bewertung die Lücke bis zum Roster-Optimum in
   € schätzen (`kosten, um bis playerOpt sinnvolle Spieler zu holen`). Sagt die Utility „kein
   Spieler mehr nötig" → **kein Kredit**.
2. **Finanzierungslücke**: `shortfall = benötigtesBudget − spendableCash`
   (`resolveTeamSpendableCashForPlanning`). Ist `shortfall <= 0` → kein Kredit.
3. **Kapazität**: `loanAmount = min(shortfall, borrowingCapacity)`. Ist die Kapazität 0 → kein
   Kredit.
4. **Persönlichkeit**: `cashPriority`/`isCashHoardingTeam` skaliert die Bereitschaft nach unten
   (Hoarder nehmen nur bei hartem Bedarf und kleinerem Betrag); `finances` bestimmt den Satz.
5. **Tragfähigkeit**: Kredit nur, wenn die resultierende Jahresrate gegen die projizierten
   Saison-Einnahmen (`seasonEconomyFactors`) tragbar ist — kein offensichtlich unbezahlbarer
   Kredit.
6. Laufzeit: KI wählt eine Default-Laufzeit (z. B. mittelfristig), die die Rate tragbar hält.

Ergebnis: Kredit wird aufgenommen (Cash +loanAmount, `LoanRecord` angelegt), **bevor** die
Kaufschleife das Cash konsumiert → die KI kann den Kader aufs Optimum auffüllen.

Zusätzlich fließt vorhandene Restschuld als Vorsichts-Signal in
`resolveTeamLiquidityBufferTarget` (`lib/ai/planner-cash-buffer-policy.ts`): verschuldete Teams
erhöhen ihren Cash-Puffer / geben in `ai-transfer-doctrine-layer.ts` (`passIntentScale`)
vorsichtiger aus.

## Phasen

- **Phase 1 — Bank-Kern:** Datenmodell, Zins/Rate-Berechnung, `loan_settlement`-Schritt,
  Kreditaufnahme-Service (+ Kapazität), Ausfall-Logik, Unit-Tests. Menschliche Aufnahme via
  Service-API (UI kann nachgezogen werden).
- **Phase 2 — KI-Anbindung:** `resolveAiLoanDecision` vor der Kaufphase, Restschuld-Signal im
  Puffer-Gate + Doctrine-Layer, Tests, dass eine bedarfslose KI **nicht** borgt und eine
  bedarfsstarke knappe KI **schon**.
- **Phase 3 — Team-zu-Team (später):** Verleih aus fremdem Cash mit beziehungsbasierten
  Konditionen und einem interaktiven Angebots-UI. Detailkonzept siehe unten.

## Phase 3 — Team-zu-Team-Kredite (Detailkonzept)

Vorbedingung (offen): erst prüfen, wie viel Cash die Teams über die Saisons realistisch
ansammeln — Angebote sind nur sinnvoll, wenn Teams überhaupt nennenswertes freies Cash haben.
Keine zusätzliche dynamische Dauer-Mechanik; alle Werte werden im Moment der Kreditanfrage
einmal berechnet.

### Idee

Statt nur der Bank kann der Kreditnehmer auch von anderen Teams leihen, die freies Cash haben.
Das fördert Interaktion und gibt Finanz-Teams (z. B. Cash Creators, hohe `finances`) einen
Zweck: sie verdienen an den Zinsen, die der Kreditnehmer über die Laufzeit zurückzahlt (der
Verleiher kassiert die Raten als Einnahme).

### Angebots-UI (Kreditaufnahme)

- **Summen-Slider als Filter**: der Spieler stellt die gewünschte Kreditsumme ein.
- Darunter **Angebots-Karten** — je eine Karte pro Anbieter (die Bank **und** jedes Team, das die
  Summe anbieten kann), mit: Anbietername, angebotener Kreditbetrag (bei Teams: was sie maximal
  geben würden), Zinssatz, Jahresrate, Beziehungs-Badge. Aufsteigend nach Zinssatz sortiert
  (bestes Angebot oben).
- Schiebt der Spieler den Slider hoch, **fallen Team-Karten raus**, deren Angebotsbetrag nicht mehr
  reicht — die Bank-Karte bleibt immer (bis Kreditlimit). Der Spieler „sieht rein": z. B.
  „Black Panthers würden 15 Mio. anbieten".

### Verleiher-Eligibilität & Angebotsbetrag

Ein Team `L` erscheint als Karte für Betrag `X`, wenn `lenderOfferAmount(L) >= X` **und** die
Beziehung nicht feindlich ist (`getTeamRelationship(L, borrower) > rivalCutoff`; Rivalen mit
Relationship ≤ −4 bieten **nicht** an).

**Angebotsbetrag** — ein Team verleiht nur einen **Teil** seines freien Cash, nicht alles (die
Cash Creators mit 30 Mio. bieten eben nicht 30, sondern ~15–20):
```
lendableCash(L)     = max(0, cash − resolveTeamLiquidityBufferTarget(L))   // was L überhaupt entbehren kann
lenderOfferAmount(L) = lendableCash(L) · LENDER_OFFER_SHARE
  LENDER_OFFER_SHARE ≈ 0.5–0.66   // Verleiher behält eine Reserve; ggf. je nach cashPriority/Beziehung höher
```
Finanz-/renditehungrige Teams (hohe `finances`/`cashPriority`) oder gute Beziehungen können einen
höheren Anteil anbieten; vorsichtige Teams weniger.

### Konditionen (Zinssatz eines Team-Angebots)

Ausgangspunkt ist der Bank-Satz, den der Kreditnehmer für dieselbe Summe/Laufzeit bekäme.
Teams unterbieten die Bank **immer leicht**, damit sich Team-Kredite lohnen:

```
teamRate = clamp(
  bankRate − interactionDiscount − relationshipDiscount − lenderYieldAppetite,
  teamFloor,                    // z. B. 0.05, leicht unter dem Bank-Floor
  bankRate − interactionDiscount
)
  interactionDiscount   = 0.01                      // Teams sind IMMER ~1 % günstiger als die Bank
  relationshipDiscount  = max(0, relValue) / 5 · 0.03   // rel +5 → bis −3 % extra bei sehr guter Beziehung
  lenderYieldAppetite   = finanzstarke/renditehungrige Verleiher (hohe finances / cashPriority)
                          geben einen kleinen Extra-Rabatt, weil sie den Deal WOLLEN
```

- Beispiel Mavericks leihen 20 Mio., sehr gute Beziehung (+5) zu den Cash Creators (hohe
  `finances`, wollen Finanzdeals): Bank z. B. 14,4 % → Cash-Creators-Angebot ~14,4 % − 1 %
  (Interaktion) − 3 % (Beziehung) − X (Rendite-Appetit) ⇒ deutlich unter Bank, aber ≥ 5 % Floor.
- Rivalen: kein Angebot.

### Abwicklung

- Bei Abschluss: `LoanRecord` mit `lenderType: "team"`, `lenderTeamId: L`. Cash-Transfer
  `borrower.cash += X`, `L.cash −= X` (dasselbe map-Muster).
- `loan_settlement` pro Saison: Rate wird dem Kreditnehmer belastet **und dem Verleiher
  gutgeschrieben** (statt an die Bank zu „verschwinden"). Der Zinsanteil ist der Gewinn des
  Verleihers. Bei Ausfall trägt der Verleiher das Risiko (Rate bleibt aus / Kapitalisierung).
- KI-Verleiher: ein finanzstarkes AI-Team mit viel freiem Cash und guter/neutraler Beziehung
  bietet automatisch an; `cashPriority`/`finances` steuern Bereitschaft und Rendite-Appetit.

### Offene Punkte Phase 3

- Wie werden mehrere gleichzeitige Angebote/aktive Verleih-Positionen eines Teams gedeckelt
  (damit ein Team sich nicht komplett verausgabt)?
- KI-zu-KI-Kredite: vorerst evtl. nur Mensch↔KI, KI↔KI später.
- Balancing des Cash-Aufkommens (Vorbedingung oben) — braucht Daten aus echten Season-Läufen.

## UI-Integration (Finanzansichten)

Kredite sollen nicht nur in einer eigenen Bank-Ansicht leben, sondern dort auftauchen, wo Cashflow
und Finanzen ohnehin gezeigt werden — als weitere Position neben Gehältern und Gebäudekosten:
- **Cashflow-/Finanz-Übersicht**: die anstehende(n) Kreditrate(n) als Abzugsposition vom Cash
  ausweisen — „Gehälter −X, Gebäudekosten −Y, **Kreditraten −Z**". So sieht der Spieler den echten
  Netto-Cashflow.
- **Restschuld** als Bilanz-Seite neben dem Cash-Bestand anzeigen (die „Schulden-Seite").
- Konkrete Zielseiten identifizieren (Home/Finanzen-Tab, Team-Detail, Saison-Vorschau) und die
  Kredit-Position dort einhängen, wo Salär-/Facility-Kosten bereits dargestellt werden.

*(Umsetzung zusammen mit der menschlichen Bank-/Aufnahme-UI; die Service-Werte
`getTeamOutstandingDebt` und die Rate aus `LoanRecord` liegen bereits vor.)*

## Tests

- Zins/Rate-Berechnung gegen die Beispieltabelle (Annuität, Floor/Cap, Laufzeitrabatt,
  Monotonie der Absolut-Zinsen).
- Kapazität: `min(teamwertCap, tragbarkeitsCap) − Restschuld`; Cash + Marktwert + Einnahmen fließen
  ein; Season 1 → keine Kredite (harte Regel).
- Vorab-Rückzahlung: `earlyPayoff = Restschuld + 0.20 · entgangeneZukunftszinsen`, Kredit wird
  „paid", Cash korrekt belastet; Anti-Churn-Regeln der KI.
- `loan_settlement`: Rate belastet Cash korrekt, Restschuld/Restlaufzeit sinken, Idempotenz über
  `loanApplyLogs` (kein Doppel-Charge bei Retry), Ausfall kapitalisiert korrekt.
- Kreditaufnahme respektiert Kapazitätslimit.
- KI: bedarfslos → kein Kredit; knapp + Bedarf + Kapazität → Kredit in Höhe des gedeckelten
  Shortfalls; Restschuld erhöht den Planungs-Puffer.
