/**
 * MESSDATEN-FIXTURE fuer den Sponsorentwurf "Preisgeld-Sockel" (docs/SPONSOR_PREISGELD_SOCKEL_ENTWURF.md).
 *
 * Quelle: der ECHTE Live-Spielstand (Branch `live-save`, data/online-saves/hetzner-live.sqlite.gz),
 * Saison 1 nach Spieltag 10 (season_completed), 32 Teams, sponsorSystemVersion 2. Extrahiert ueber
 * `buildPrizeMoneyPreview` (phase "season_end") + `resolvePlayerEconomyContract` — d. h. `salary` ist der
 * ECHTE Vertragswert (front-/back-loaded beruecksichtigt), `salaryExpected` der geglaettete Formelwert
 * (getTeamDisplaySalaryTotal). `prizeMoney`/`placementBonus` sind exakt die Benchmark-Werte, die die
 * Preview am Saisonende ausweist; `sponsorCash` ist die tatsaechliche Sponsor-Settlement-Vorschau der
 * eingefrorenen V2-Vertraege.
 *
 * Reproduktion (Save aus dem live-save-Branch entpacken, dann):
 *   OLY_APP_DISABLE_PROJECT_ROOT_GUARD=true OLY_APP_SQLITE_PATH=<pfad.sqlite> npx tsx <extract-skript>
 * Das Extraktionsskript steht im PR-Text des Entwurfs; die Werte hier sind eingefroren, damit die
 * Kennzahlen des Entwurfs ohne den (nicht eingecheckten) Live-Save wiederholbar bleiben.
 */
export type SponsorLiveSaveTeam = {
  code: string;
  /** Endrang nach Spieltag 10. */
  rank: number;
  /** Startrang der Saison (Basis des Platzierungsbonus). */
  startRank: number;
  /** ECHTE Gehaltssumme (resolvePlayerEconomyContract().salary) — der Wert, den der Saisonstand nutzt. */
  salary: number;
  /** Geglaettete Gehaltssumme (expectedSalary-Pfad) — der Wert, an dem der heutige Sponsor-Anker haengt. */
  salaryExpected: number;
  /** Preisgeld-Benchmark am Endrang (nie ausgezahlt, CASH_PRIZE_BENCHMARK_ONLY). */
  prizeMoney: number;
  /** Platzierungsbonus des Benchmarks (Start- vs. Endrang, getSponsorPlacementLookup). */
  placementBonus: number;
  /** Tatsaechliche Sponsor-Auszahlung der eingefrorenen V2-Vertraege (Settlement-Vorschau season_end). */
  sponsorCash: number;
  rarity: string;
};

export const SPONSOR_LIVE_SAVE_S1_TEAMS: SponsorLiveSaveTeam[] = [
  { code: "A-A", rank: 27, startRank: 31, salary: 51.9, salaryExpected: 46.6, prizeMoney: 59.67, placementBonus: 5.14, sponsorCash: 61.6, rarity: "magisch" },
  { code: "B-B", rank: 25, startRank: 29, salary: 53.4, salaryExpected: 50.9, prizeMoney: 61.46, placementBonus: 5.14, sponsorCash: 56.2, rarity: "selten" },
  { code: "B-P", rank: 10, startRank: 11, salary: 80.9, salaryExpected: 71.7, prizeMoney: 80.32, placementBonus: 1.28, sponsorCash: 105.7, rarity: "selten" },
  { code: "C-C", rank: 21, startRank: 23, salary: 42.5, salaryExpected: 47.1, prizeMoney: 64.96, placementBonus: 2.57, sponsorCash: 48.099999999999994, rarity: "magisch" },
  { code: "C-S", rank: 2, startRank: 3, salary: 69.6, salaryExpected: 75.2, prizeMoney: 100.77, placementBonus: 1.28, sponsorCash: 79.7, rarity: "magisch" },
  { code: "D-L", rank: 24, startRank: 27, salary: 50.3, salaryExpected: 52.2, prizeMoney: 62.32, placementBonus: 3.85, sponsorCash: 39.5, rarity: "magisch" },
  { code: "D-P", rank: 20, startRank: 18, salary: 56.5, salaryExpected: 58.7, prizeMoney: 65.89, placementBonus: -1.93, sponsorCash: 80.80000000000001, rarity: "selten" },
  { code: "G-G", rank: 8, startRank: 4, salary: 68.2, salaryExpected: 75.9, prizeMoney: 85.37, placementBonus: -3.85, sponsorCash: 115.69999999999999, rarity: "legendär" },
  { code: "H-R", rank: 9, startRank: 9, salary: 76.3, salaryExpected: 70.6, prizeMoney: 82.84, placementBonus: 0, sponsorCash: 83.2, rarity: "magisch" },
  { code: "L-K", rank: 23, startRank: 21, salary: 61.8, salaryExpected: 61.6, prizeMoney: 63.25, placementBonus: -1.93, sponsorCash: 80.1, rarity: "legendär" },
  { code: "L-R", rank: 12, startRank: 5, salary: 79.8, salaryExpected: 78.4, prizeMoney: 77.57, placementBonus: -6.17, sponsorCash: 79.2, rarity: "selten" },
  { code: "M-M", rank: 1, startRank: 1, salary: 95.7, salaryExpected: 84.4, prizeMoney: 103.3, placementBonus: 0, sponsorCash: 95.6, rarity: "magisch" },
  { code: "M-S", rank: 22, startRank: 17, salary: 54.3, salaryExpected: 60.5, prizeMoney: 64.11, placementBonus: -4.82, sponsorCash: 48.1, rarity: "selten" },
  { code: "N-N", rank: 14, startRank: 12, salary: 77.2, salaryExpected: 70.9, prizeMoney: 74.83, placementBonus: -1.93, sponsorCash: 72.8, rarity: "legendär" },
  { code: "N-W", rank: 11, startRank: 13, salary: 67, salaryExpected: 69.6, prizeMoney: 78.94, placementBonus: 2.57, sponsorCash: 95.30000000000001, rarity: "legendär" },
  { code: "P-C", rank: 30, startRank: 26, salary: 53.2, salaryExpected: 53.3, prizeMoney: 57.03, placementBonus: -3.85, sponsorCash: 42, rarity: "legendär" },
  { code: "P-S", rank: 4, startRank: 6, salary: 79.3, salaryExpected: 75.2, prizeMoney: 95.64, placementBonus: 2.57, sponsorCash: 87.9, rarity: "magisch" },
  { code: "R-C", rank: 26, startRank: 22, salary: 57.6, salaryExpected: 52.3, prizeMoney: 60.61, placementBonus: -3.85, sponsorCash: 48.7, rarity: "magisch" },
  { code: "R-L", rank: 3, startRank: 7, salary: 80.1, salaryExpected: 75.2, prizeMoney: 98.17, placementBonus: 5.14, sponsorCash: 110.7, rarity: "magisch" },
  { code: "R-R", rank: 29, startRank: 32, salary: 35.4, salaryExpected: 37.8, prizeMoney: 57.96, placementBonus: 3.85, sponsorCash: 47.2, rarity: "magisch" },
  { code: "S-C", rank: 31, startRank: 25, salary: 48.8, salaryExpected: 48.7, prizeMoney: 56.17, placementBonus: -5.78, sponsorCash: 45.1, rarity: "selten" },
  { code: "S-S", rank: 6, startRank: 10, salary: 66.2, salaryExpected: 68.6, prizeMoney: 90.51, placementBonus: 5.14, sponsorCash: 107, rarity: "magisch" },
  { code: "T-C", rank: 18, startRank: 24, salary: 44.2, salaryExpected: 51.3, prizeMoney: 68.84, placementBonus: 7.71, sponsorCash: 88.3, rarity: "selten" },
  { code: "T-G", rank: 19, startRank: 20, salary: 68.2, salaryExpected: 64.4, prizeMoney: 67.37, placementBonus: 1.28, sponsorCash: 60.6, rarity: "selten" },
  { code: "T-T", rank: 15, startRank: 14, salary: 71.4, salaryExpected: 68.6, prizeMoney: 73.46, placementBonus: -0.96, sponsorCash: 80.6, rarity: "legendär" },
  { code: "U-A", rank: 32, startRank: 28, salary: 54.9, salaryExpected: 54.5, prizeMoney: 55.32, placementBonus: -3.85, sponsorCash: 41.2, rarity: "selten" },
  { code: "V-D", rank: 17, startRank: 16, salary: 65.2, salaryExpected: 62, prizeMoney: 70.31, placementBonus: -0.96, sponsorCash: 58.599999999999994, rarity: "magisch" },
  { code: "V-V", rank: 16, startRank: 19, salary: 64, salaryExpected: 60, prizeMoney: 72.08, placementBonus: 3.85, sponsorCash: 88.5, rarity: "selten" },
  { code: "V-W", rank: 28, startRank: 30, salary: 40.3, salaryExpected: 42.9, prizeMoney: 58.82, placementBonus: 2.57, sponsorCash: 43, rarity: "selten" },
  { code: "W-L", rank: 7, startRank: 8, salary: 75.2, salaryExpected: 76.1, prizeMoney: 87.98, placementBonus: 1.28, sponsorCash: 112.30000000000001, rarity: "selten" },
  { code: "W-W", rank: 13, startRank: 15, salary: 69.5, salaryExpected: 68.9, prizeMoney: 76.2, placementBonus: 2.57, sponsorCash: 95, rarity: "selten" },
  { code: "Z-H", rank: 5, startRank: 2, salary: 97.7, salaryExpected: 83.3, prizeMoney: 93.03, placementBonus: -2.89, sponsorCash: 96.6, rarity: "magisch" },
];

/** Preisgeldkurve der Preview am Saisonende (Rang 1..32) — die Referenzkurve des Entwurfs. */
export const SPONSOR_LIVE_SAVE_S1_PRIZE_CURVE: number[] = [103.3, 100.77, 98.17, 95.64, 93.03, 90.51, 87.98, 85.37, 82.84, 80.32, 78.94, 77.57, 76.2, 74.83, 73.46, 72.08, 70.31, 68.84, 67.37, 65.89, 64.96, 64.11, 63.25, 62.32, 61.46, 60.61, 59.67, 58.82, 57.96, 57.03, 56.17, 55.32];

/**
 * Platzierungsbonus-Lookup (rankDelta -> Bonus/Malus) — DIE TABELLE, DIE DER BENCHMARK WIRKLICH NUTZT:
 * die Sheet-Tabelle aus references/sheets/prize-money-table.csv (Spalten Rank/Platzierung), gelesen ueber
 * readPrizeMoneySourceBundle. Sie ist ASYMMETRISCH (+1.28 je Platz aufwaerts, −0.96 je Platz abwaerts,
 * oberhalb ±10 abflachend). NICHT zu verwechseln mit getSponsorPlacementLookup() in lib/season/prize-money.ts
 * (±8.33 fuer 1 Platz) — die haengt an einer Legacy-Anzeige und geht NICHT in die Benchmark-Preview ein.
 * Jeder placementBonus der 32 Teams oben ist gegen diese Tabelle verifiziert (max. Abweichung < 0.05).
 */
export const SPONSOR_LIVE_SAVE_S1_PLACEMENT: ReadonlyMap<number, number> = new Map<number, number>([[-31, -12.84], [-30, -12.59], [-29, -12.33], [-28, -12.07], [-27, -11.82], [-26, -11.56], [-25, -11.3], [-24, -11.05], [-23, -10.79], [-22, -10.53], [-21, -10.28], [-20, -10.02], [-19, -9.76], [-18, -9.51], [-17, -9.25], [-16, -8.99], [-15, -8.73], [-14, -8.48], [-13, -8.22], [-12, -7.96], [-11, -7.71], [-10, -7.32], [-9, -6.94], [-8, -6.55], [-7, -6.17], [-6, -5.78], [-5, -4.82], [-4, -3.85], [-3, -2.89], [-2, -1.93], [-1, -0.96], [0, 0.0], [1, 1.28], [2, 2.57], [3, 3.85], [4, 5.14], [5, 6.42], [6, 7.71], [7, 8.99], [8, 10.28], [9, 11.56], [10, 12.84], [11, 13.49], [12, 14.13], [13, 14.77], [14, 15.41], [15, 16.06], [16, 16.7], [17, 17.34], [18, 17.98], [19, 18.62], [20, 19.27], [21, 19.91], [22, 20.55], [23, 21.19], [24, 21.84], [25, 22.48], [26, 23.12], [27, 23.76], [28, 24.41], [29, 25.05], [30, 25.69], [31, 26.33]]);

/** Ligajahr-Faktor der Preview ("Aktuell") — Preisgeld-Pool = Gehaltssumme x Faktor. */
export const SPONSOR_LIVE_SAVE_S1_SALARY_FACTOR = 1.15;
