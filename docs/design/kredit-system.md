# Kredit- & Schuldensystem

Status: **In Umsetzung** (Phase 1 + 2). Phase 3 (Team-zu-Team) ist geplant, aber später.

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

Verhindert Infinite-Money. Maximale **zusätzliche** Restschuld beim Abschluss:

```
capacity = min( 0.35 · marketValueTotal , 1.25 · jährlicheEinnahmen ) − aktuelleRestschuld
```

`jährlicheEinnahmen` = Proxy aus Sponsoren-Payout + ggf. Preisgeld-Benchmark der letzten Saison.
Ein bereits hoch verschuldetes Team bekommt entsprechend weniger/keinen neuen Kredit.

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
- **Phase 3 — Team-zu-Team (später):** Verleiher zahlt aus eigenem Cash, Satz = Bank-Satz −
  Beziehungs-Rabatt (`getTeamRelationship` / `buildTeamRelationshipCards`), Verleiher-Bereitschaft
  gegated durch eigenen Liquiditäts-Puffer + `cashPriority`. Rivalen verweigern/verteuern.

## Tests

- Zins/Rate-Berechnung gegen die Beispieltabelle (Annuität, Floor/Cap, Laufzeitrabatt,
  Monotonie der Absolut-Zinsen).
- `loan_settlement`: Rate belastet Cash korrekt, Restschuld/Restlaufzeit sinken, Idempotenz über
  `loanApplyLogs` (kein Doppel-Charge bei Retry), Ausfall kapitalisiert korrekt.
- Kreditaufnahme respektiert Kapazitätslimit.
- KI: bedarfslos → kein Kredit; knapp + Bedarf + Kapazität → Kredit in Höhe des gedeckelten
  Shortfalls; Restschuld erhöht den Planungs-Puffer.
