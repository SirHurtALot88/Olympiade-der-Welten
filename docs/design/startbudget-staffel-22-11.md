# Startbudget-Staffel (22.11.)

Chris, 22.11.: „budget soll eingeführt werden wie ich es gesagt habe! du sagst selbst ab season 2 entspannt es sich sowieso, das ist ok“.
Konzept: `budget-gespraech-s1-22-11.md`, `finanzen-posten-22-11.md` Abschnitt g.4. Messung: `guv-saisonfaktor-messung-22-11.md` (Variante `--budget-variante plus20plus2`).

## Regel

Aufschlag auf die **Startkasse** nach Budget-Platz: `+20 + 2 x (32 - Platz)`. Platz 32 (kleinstes Startbudget) +20 C, Platz 16 +52 C, Platz 1 +82 C, Summe **+1.632 C**.
Nur für **neu angelegte** Spiele; bestehende Spielstände bleiben unberührt (ihre Kasse ist gebucht).

## Gewählter Weg: Aufschlag beim Anlegen, nur auf `cash`

Die Quelldaten (`references/sheets/season-management.json`, `startBudget` 170-325) bleiben unverändert, ebenso `team.budget`. Beim Anlegen
(`lib/game/new-game-setup-service.ts`) startet `team.cash` bei `budget + Aufschlag`. Code und Stempel: `lib/resolve/startbudget-staffel.ts`.

Warum nicht `budget` mit anheben (so rechnete die Messung): `team.budget` ist die Basis aller Budget-Rang-Anzeigen, des Sponsor-Qualitätsrangs
(`sponsor-team-quality-rank`), des Liga-Splits (`league-split`), der Startplätze und der festen Stufen der KI-Draftplanung
(`season1-draft-spend-policy`: >=200 / 260 / 300) sowie der Vorstands-Rückstellung (`draftSeasonCashReserveBudgetFraction`). Mit 190-407 statt
170-325 rutschten fast alle Teams in "top/upper". Der Rang bliebe gleich (32 verschiedene Budgets, der Aufschlag steigt streng mit dem Platz), die
Schwellen nicht. Die Messung hob Budget und Kasse an; Abweichung also: hier wächst nur die Kasse, die Stufen bleiben, was sie waren.

## Stempel und Schalter

- Spielstand: `seasonState.startbudgetStaffel = { regel: "neu" | "alt", aufschlag: { teamId: C } }`, nur beim Anlegen gesetzt. Fehlt er, gab es keinen Aufschlag.
- Server-Schalter `OLY_STARTBUDGET_STAFFEL` (compose + `.env`, Muster der anderen Schalter): leer = neu, `0`/`aus`/`alt` = neue Spiele ohne Aufschlag. Kein `NEXT_PUBLIC`.
- Anzeigen/Messungen, die "Startbudget mit Staffel" meinen: `startbudgetMitStaffel(gameState, teamId)`.

## Abnehmer

| Abnehmer | Verhalten |
|---|---|
| Startkasse (`team.cash`) | +Aufschlag, Quelle der Wahrheit |
| KI-Draftplanung (`startingCash` aus `cash`, `season1-draft-spend-policy` Rahmen) | sieht die größere Kasse; Stufen aus `budget` unverändert |
| Vorstand: Freigabe/Rücklage, Cash-Puffer-Ziel S1 | rechnen mit Kasse bzw. `budget`-Anteil; mehr Spielraum, gleiche Regeln |
| Budget-Rang (Team-Übersicht `buildStartBudgetRankMap`, Startplatz, Liga-Split, Sponsor-Qualitätsrang, Preisgeld-Vorschau) | unverändert (`budget`) |
| Neues-Spiel-Vorschau | `budget` unverändert, neues Feld `startkasse`; Team-Settings zeigt die Startkasse |
| Finanzwert 1-10, Identität | kommen aus der Team-Matrix, nicht aus dem Startbudget: unverändert |
| Messskripte, Smoke-Skripte | Smokes prüfen `cash == budget + Aufschlag`; `miss-teamfinanzen-saison.ts --budget-variante` hebt weiter Budget und Kasse an (Messung 22.11.), für Vergleiche mit der Live-Regel besser ohne Variante laufen lassen |
