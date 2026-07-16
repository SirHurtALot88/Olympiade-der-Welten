# Retool Transfer & Economy Confirmed Rules

## Sicher bestaetigt
- Kauf reduziert Cash.
- Verkauf erhoeht Cash.
- Kauf/Verkauf schreiben Saisonstand-bezogene Cash-/Salary-Aenderungen.
- `cash` und `budget` sind als Economy-Felder klar belegt.

## Salary / Gehalt
- In den Retool-Spuren tauchen mehrfach auf:
  - `salary`
  - `gehalt`
  - `expected_salary`
  - `season_salary`
- In den AI-/Budgetspuren existiert zusaetzlich:
  - `salary_factor_current`
  - `salary_factors_5`
- Das spricht fuer eine getrennte Salary-/Forecast-Logik, die ueber reinen Kaufpreis hinausgeht.

## Preisgeld / Platzierung
- Preisgeld-/Placement-Spuren sind sichtbar:
  - `executeSeasonEnd.js`
  - diverse Hinweise auf Sponsor-/Prize-Environment
  - Suchtreffer fuer `placement`, `prize`, `preisgeld`
- Nicht sicher bestaetigt ist aktuell:
  - exakte Preisgeldstaffel pro Platzierung
  - ob Preisgeld sofort oder nur am Saisonende angewandt wird
  - konkrete Bonus-/Malus-Tabelle

## Draft / Allianz / Nebenlogik
- `alliance_matchups` und `alliance_team_scores` sind sichere Saison-/Matchday-Spuren.
- Ob `Kosten` und `Unterhalt` rein Draft-/View-Logik oder produktive Economy-Felder sind, ist in den vorhandenen Retool-Spuren noch nicht abschliessend sicher.

## Offene Ask-Mode-Fragen
- Wo ist Preisgeld pro Platzierung definiert?
- Welche Query schreibt den finalen Season-End-Cash-Stand?
- Wird `budget` separat gepflegt oder nur aus `cash`/Salary-Kontext abgeleitet?
- Sind `Kosten` und `Unterhalt` nur Draft-Mode oder produktive Economy-Spalten?
