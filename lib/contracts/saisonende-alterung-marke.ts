import type { GameState } from "@/lib/data/olyDataTypes";

/**
 * DER MARKER DER SAISON-VERTRAGSALTERUNG — bewusst in einem EIGENEN, CLIENT-SICHEREN Modul.
 *
 * Beides stand vorher in `contract-renewal-service.ts`. Das Modul zieht `node:crypto` herein
 * (`randomUUID` für die Log-Ids), und sobald etwas aus dem Client-Bundle es importiert, bricht
 * der Webpack-Build mit `UnhandledSchemeError: Reading from "node:crypto" is not handled`. Genau
 * das passierte, als die Verträge-Tabelle wissen musste, ob die Alterung schon gelaufen ist:
 *
 *     node:crypto
 *       ./lib/contracts/contract-renewal-service.ts
 *       ./lib/market/contract-negotiation-preview.ts
 *       ./lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx
 *       ./app/foundation/FoundationPageClient.tsx
 *
 * Die Frage „ist die Alterung gelaufen?" ist reines Lesen aus dem GameState und hat mit dem
 * Schreibpfad nichts zu tun. Sie gehört deshalb dorthin, wo auch der Browser sie stellen darf.
 * `contract-renewal-service` reicht beide Namen unverändert weiter, damit bestehende Importe
 * bleiben können.
 */

/**
 * Idempotenz-Marker der Saison-Vertragsalterung. Wird als preSeasonWorkflowLogs-Eintrag je
 * fromSeasonId geführt, damit die Alterung pro echtem Saisonübergang GENAU EINMAL läuft — egal ob
 * sie über den (Vorschau-)Schritt contract_renewal, den Sim-Apply oder den interaktiven
 * Saisonübergang (buildNextSeasonGameState) angestoßen wird. Der stepId ist ein freier String im
 * PreSeasonWorkflowLogRecord-Typ, deshalb keine Änderung an gemeinsamen Typen nötig.
 */
export const SEASON_END_CONTRACT_TICK_STEP_ID = "season_end_contract_tick";

/** Wurde die Vertragsalterung für die AKTUELLE (auslaufende) Saison bereits angewandt? */
export function hasSeasonEndContractTickApplied(gameState: GameState): boolean {
  const seasonId = gameState.season.id;
  return (gameState.seasonState.preSeasonWorkflowLogs ?? []).some(
    (log) =>
      log.stepId === SEASON_END_CONTRACT_TICK_STEP_ID &&
      log.fromSeasonId === seasonId &&
      log.status === "applied",
  );
}
