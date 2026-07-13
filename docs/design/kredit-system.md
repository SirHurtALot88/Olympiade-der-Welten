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

- **Summen-Slider**: der Spieler stellt die gewünschte Kreditsumme ein.
- Live darunter eine **Angebotsliste**: die Bank plus jedes Team, das die Summe stemmen kann,
  jeweils mit seinem angebotenen Zinssatz (aufsteigend sortiert, bestes Angebot oben).
- Schiebt der Spieler den Slider hoch, **fallen Teams raus**, deren freies Cash nicht mehr reicht
  — nur die Bank ist immer verfügbar (bis Kreditlimit).

### Verleiher-Eligibilität

Ein Team `L` erscheint als Angebot für Betrag `X`, wenn:
- `lendableCash(L) >= X`, mit `lendableCash = max(0, cash − resolveTeamLiquidityBufferTarget(L))`
  — ein Team verleiht nur Cash, das es selbst nicht als Puffer braucht (nicht das nackte
  Kontoguthaben, sonst ruiniert es sich selbst), **und**
- die Beziehung nicht feindlich ist: `getTeamRelationship(L, borrower) > rivalCutoff` (Rivalen mit
  Relationship ≤ −4 bieten **nicht** an).

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

## Seam-Vertrag für die UI (Phase 3)

Die Kredite-UI (`app/foundation/credits/FoundationCreditsNewLook.tsx`) ist bereits ein
Angebots-Marktplatz: Betrag-Slider + Laufzeit-Dropdown sind ein **Filter**, darunter rendert eine
generische Angebotsliste (`lib/foundation/credits/loan-offers.ts`, `buildLoanOffers`) eine Karte
pro Verleiher, günstigster Zins zuerst. Aktuell liefert `buildLoanOffers` nur das Bank-Angebot —
diese Sektion ist der copy-paste-fertige Vertrag, um Team-Angebote reinzuhängen.

### 1. `LoanOffer`-Typ (bereits vorhanden, nicht ändern)

```ts
// lib/foundation/credits/loan-offers.ts
export type LoanOffer = {
  lenderType: "bank" | "team";
  lenderTeamId: string | null;      // null für die Bank
  lenderName: string;               // "Bank" oder Team-Name
  maxAmount: number;                // aktuell maximal verfügbarer Betrag dieses Verleihers
  interestRatePerSeason: number;    // Satz für den angefragten Betrag+Laufzeit
  installmentPerSeason: number;
  relationship?: number | null;     // nur Team-Verleiher, für das Beziehungs-Badge
  eligible: boolean;                // maxAmount >= angefragter Betrag
};
```

Die UI rendert `LoanOffer[]` bereits generisch (sortiert nach `interestRatePerSeason` aufsteigend,
`eligible: false` → Karte greyed-out mit "Reicht für diese Summe nicht."-Hinweis, Button
deaktiviert). Es ist **keine weitere UI-Arbeit** nötig, sobald `buildLoanOffers` Team-Angebote
zurückgibt.

### 2. Team-Zweig in `buildLoanOffers` implementieren

In `lib/foundation/credits/loan-offers.ts` steht der Block `// === SEAM: Phase 3 team-to-team
offers connect HERE ===` mit auskommentiertem Pseudocode. Kurzfassung der Regeln (siehe oben
§"Verleiher-Eligibilität" / §"Konditionen"):

- Für jedes Team `L !== borrowerTeamId`:
  - `freeLendableCash = max(0, L.cash - resolveTeamLiquidityBufferTarget(gameState, L.teamId))`
    (`lib/ai/planner-cash-buffer-policy.ts`) — **nicht** das nackte `L.cash`.
  - Kein Angebot (auch nicht disabled), wenn `freeLendableCash <= 0`.
  - Kein Angebot, wenn die Beziehung feindlich ist:
    `(getTeamRelationship(L.teamId, borrowerTeamId)?.value ?? 0) <= RIVAL_CUTOFF` (z. B. `-4`).
    Achtung: `getTeamRelationship` gibt einen `TeamRelationshipRecord | null` zurück
    (`lib/rivalries/team-rivalries.ts`), nicht direkt eine Zahl — `.value` lesen.
  - Sonst: `teamRate = clamp(bankRate - 0.01 - relationshipDiscount - lenderYieldAppetite,
    teamFloor, bankRate - 0.01)` mit `relationshipDiscount = max(0, relationshipValue) / 5 * 0.03`
    und `bankRate` = derselbe Satz, den das Bank-Angebot für Betrag+Laufzeit gerade zeigt.
  - `installmentPerSeason` **muss** aus `teamRate` per Annuität berechnet werden
    (`A = P · r / (1 − (1+r)^(−n))`), NICHT über `computeLoanTerms` — die Funktion leitet ihren
    Satz intern aus `finances` her und akzeptiert keinen extern vorgegebenen Zins. Am saubersten:
    die Annuitätsformel aus `computeLoanTerms` in eine eigene, von beiden Zweigen (Bank + Team)
    genutzte Hilfsfunktion auslagern.
  - `maxAmount = freeLendableCash`, `eligible = freeLendableCash >= angefragter Betrag`,
    `relationship = relationshipValue`.

### 3. `originateLoan` für `lenderType: "team"` erweitern

`lib/finance/loan-service.ts`, `originateLoan`: aktuell hart auf `lenderType: "bank"` codiert
(Zeile `lenderType: "bank"` im gebauten `LoanRecord`) und mutiert bei `execute: true` nur den
Cash des Kreditnehmers (`teams.map(...)`). Für Team-Kredite zusätzlich:

- `OriginateLoanInput` um `lenderTeamId?: string` erweitern.
- Beim Bauen des `LoanRecord`: `lenderType: input.lenderTeamId ? "team" : "bank"`,
  `lenderTeamId: input.lenderTeamId`.
- Bei der Cash-Mutation (`execute: true`): zusätzlich zum `+principal` beim Kreditnehmer den
  Verleiher belasten: `−principal` auf `Team.cash` des Verleihers, im selben `teams.map`-Aufruf
  (dasselbe Muster wie die Kreditnehmer-Mutation, nur gegenläufig). Kein zusätzlicher
  Validierungsschritt nötig, wenn `buildLoanOffers`/die UI bereits `eligible` korrekt filtert —
  aber serverseitig trotzdem `freeLendableCash >= principal` erneut prüfen (nie dem Client
  vertrauen), sonst `reason: "over_capacity"` (oder ein neuer, spezifischerer Reason-Code).

### 4. Settlement (`loan_settlement`) für Team-Verleiher erweitern

`buildSettlementRows`/`applyLoanSettlement` (`lib/finance/loan-service.ts`) belasten aktuell nur
den Kreditnehmer und schreiben dem Verleiher nichts gut ("verschwindet" bei der Bank). Für
`loan.lenderType === "team"`: der `installmentCharged`-Betrag (abzüglich eines eventuellen
Ausfall-Anteils) muss zusätzlich `loan.lenderTeamId` gutgeschrieben werden — analog zu
`cashDeltaByTeamId` für den Kreditnehmer, nur mit positivem Delta beim Verleiher. Bei Ausfall
trägt der Verleiher das Risiko (Rate bleibt aus / Kapitalisierung erhöht nur die Restschuld beim
Kreditnehmer, keine Zahlung an den Verleiher für den ausgefallenen Teil).

### 5. API-Route-Guard entfernen

`app/api/finance/loan/originate/route.ts` lehnt aktuell jede Anfrage mit gesetztem
`lenderTeamId` im Body sofort mit `{ ok: false, reason: "team_lending_not_available" }` ab (Guard
direkt nach dem Body-Parsing, vor allen anderen Checks). Der Client (`onBorrow` in
`app/foundation/credits/FoundationCreditsNewLook.tsx` → `originateLoanForActiveTeam` in
`lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx`) übergibt bereits
`offer.lenderTeamId` (aus der `LoanOffer`) an `onBorrow` — sobald `originateLoan` Team-Kredite
unterstützt (Schritt 3), diesen Guard entfernen und `lenderTeamId` bis zum
`originateLoan(...)`-Aufruf durchreichen.

## Tests

- Zins/Rate-Berechnung gegen die Beispieltabelle (Annuität, Floor/Cap, Laufzeitrabatt,
  Monotonie der Absolut-Zinsen).
- `loan_settlement`: Rate belastet Cash korrekt, Restschuld/Restlaufzeit sinken, Idempotenz über
  `loanApplyLogs` (kein Doppel-Charge bei Retry), Ausfall kapitalisiert korrekt.
- Kreditaufnahme respektiert Kapazitätslimit.
- KI: bedarfslos → kein Kredit; knapp + Bedarf + Kapazität → Kredit in Höhe des gedeckelten
  Shortfalls; Restschuld erhöht den Planungs-Puffer.
