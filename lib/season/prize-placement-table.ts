/**
 * DIE Platzierungsbonus-Tabelle der Liga — eine Quelle, synchron lesbar.
 *
 * Bis zum Sponsor-V3-Umbau gab es ZWEI: die Sheet-Tabelle aus `references/sheets/prize-money-table.csv`
 * (asymmetrisch, +1,28 je Platz aufwaerts / −0,96 abwaerts, oberhalb ±10 abflachend), die der
 * Preisgeld-Benchmark ueber `readPrizeMoneySourceBundle` benutzt, und eine zweite Code-Tabelle
 * `getSponsorPlacementLookup()` in `lib/season/prize-money.ts` (±8,33 fuer einen Platz). Die zweite ging in
 * die Benchmark-Preview NICHT ein und haing nur an einer Legacy-Anzeige — zwei Tabellen, die dieselbe
 * Groesse behaupteten und um Faktor 6 auseinanderlagen. Das Doppel ist aufgeloest: die Sheet-Tabelle ist
 * die Wahrheit, und diese Datei ist ihre synchrone Fassung.
 *
 * WARUM EINGEFROREN STATT GELESEN: `readPrizeMoneySourceBundle` ist asynchron und liest vom Dateisystem.
 * Die Sponsor-Angebotserzeugung ist synchron und laeuft auch im Client-Bundle. Die Werte hier sind Zeile
 * fuer Zeile aus dem CSV uebernommen; `tests/prize-placement-table.test.ts` liest das CSV und vergleicht —
 * die Doppelhaltung ist damit abgesichert und nicht gehofft.
 */

/** rankDelta (Startrang − Endrang) → Bonus/Malus in C. Deckt −31..+31 ab, also jede Bewegung in einer 32er-Liga. */
export const PRIZE_PLACEMENT_SHEET_TABLE: ReadonlyMap<number, number> = new Map<number, number>([
  [-31, -12.84], [-30, -12.59], [-29, -12.33], [-28, -12.07], [-27, -11.82], [-26, -11.56],
  [-25, -11.3], [-24, -11.05], [-23, -10.79], [-22, -10.53], [-21, -10.28], [-20, -10.02],
  [-19, -9.76], [-18, -9.51], [-17, -9.25], [-16, -8.99], [-15, -8.73], [-14, -8.48],
  [-13, -8.22], [-12, -7.96], [-11, -7.71], [-10, -7.32], [-9, -6.94], [-8, -6.55],
  [-7, -6.17], [-6, -5.78], [-5, -4.82], [-4, -3.85], [-3, -2.89], [-2, -1.93], [-1, -0.96],
  [0, 0],
  [1, 1.28], [2, 2.57], [3, 3.85], [4, 5.14], [5, 6.42], [6, 7.71], [7, 8.99], [8, 10.28],
  [9, 11.56], [10, 12.84], [11, 13.49], [12, 14.13], [13, 14.77], [14, 15.41], [15, 16.06],
  [16, 16.7], [17, 17.34], [18, 17.98], [19, 18.62], [20, 19.27], [21, 19.91], [22, 20.55],
  [23, 21.19], [24, 21.84], [25, 22.48], [26, 23.12], [27, 23.76], [28, 24.41], [29, 25.05],
  [30, 25.69], [31, 26.33],
]);

/** Kleinster/groesster in der Tabelle gefuehrter Rangsprung. */
export const PRIZE_PLACEMENT_MIN_DELTA = -31;
export const PRIZE_PLACEMENT_MAX_DELTA = 31;

/**
 * WIRKSAME OBERGRENZE DES RANGSPRUNGS — ab hier zahlt kein weiterer Platz mehr.
 *
 * Die Sheet-Tabelle laeuft bis ±31 durch und honoriert damit einen Sprung von Rang 32 auf 1 mit
 * +26,33 C. Das ist mehr als ein Drittel dessen, was ein Mittelfeldteam eine ganze Saison lang
 * bekommt, und es entsteht in einer einzigen Saison. Zwei Folgen: die Auszahlung haengt an einem
 * Ausreisser statt an der Leistung, und weil die Tabelle ASYMMETRISCH ist (aufwaerts +1,28 je Platz,
 * abwaerts nur −0,96), leckt die Ligasumme in den Extremen umso staerker nach oben.
 *
 * Sechs Plaetze sind die Grenze: +7,71 C fuer den Aufstieg, −5,78 C fuer den Absturz. Wer weiter
 * klettert, bekommt dafuer nichts mehr extra — die Belohnung dafuer steckt ohnehin schon in der
 * Rangkurve selbst, denn ein besserer Endrang zahlt dort bereits mehr. Der Platzierungsbonus soll
 * nur die BEWEGUNG gegenueber der Erwartung wuerdigen, nicht ein zweites Mal den Endrang.
 *
 * Die Tabelle selbst bleibt vollstaendig (sie ist Zeile fuer Zeile gegen das CSV abgesichert); die
 * Kappung sitzt ausschliesslich hier im Zugriff.
 */
export const PRIZE_PLACEMENT_EFFECTIVE_CAP = 6;

/**
 * Platzierungsbonus fuer einen Rangsprung. `rankDelta` ist POSITIV bei Verbesserung
 * (Startrang − Endrang), und er wird auf `PRIZE_PLACEMENT_EFFECTIVE_CAP` Plaetze gekappt.
 */
export function getPrizePlacementBonus(rankDelta: number): number {
  if (!Number.isFinite(rankDelta)) return 0;
  const capped = Math.min(
    PRIZE_PLACEMENT_EFFECTIVE_CAP,
    Math.max(-PRIZE_PLACEMENT_EFFECTIVE_CAP, Math.round(rankDelta)),
  );
  return PRIZE_PLACEMENT_SHEET_TABLE.get(capped) ?? 0;
}

/** Tabellenform fuer Anzeigen, absteigend nach rankDelta (wie die Sheet-Spalte). */
export function getPrizePlacementRows(): Array<{ rankDelta: number; placement: number }> {
  return [...PRIZE_PLACEMENT_SHEET_TABLE.entries()]
    .map(([rankDelta, placement]) => ({ rankDelta, placement }))
    .sort((left, right) => right.rankDelta - left.rankDelta);
}
