/**
 * MIGRATION M1 — die eingefrorenen Leitern der laufenden Saison auf die V3-Basisleiter heben.
 *
 * docs/SPONSOR_PREISGELD_SOCKEL_ENTWURF.md, Abschnitt 5. Verifiziert: eine Neukalibrierung erreicht
 * laufende Vertraege NICHT — die alte Leiter ist im Vertrag eingefroren. Ohne diese Migration zahlt
 * die anstehende Saisonabrechnung noch einmal die alten Ausreisser (gemessen am Live-Save:
 * G-G +34,2 C ueber Benchmark, D-L −26,7 C).
 *
 * WAS DIE MIGRATION TUT:
 *  - Sie ersetzt bei jedem NOCH NICHT ABGERECHNETEN Vertrag die eingefrorene Leiter durch die
 *    V3-BASISLEITER (Tilt 0 — also exakt die Liga-Benchmark).
 *  - Die VERTRAGSIDENTITAET bleibt: Marke, Name, Rarity und der Sonderziel-Schluessel sind
 *    unveraendert. Das Sonderziel wird nur nach der neuen Regel bepreist (Praemie nach Rarity,
 *    Sockelabzug −p·G).
 *  - Sie laeuft GENAU EINMAL je Spielstand (`seasonState.sponsorLadderMigrationVersion`) und ist
 *    idempotent: ein zweiter Aufruf aendert nichts.
 *
 * WAS SIE NICHT TUT: bereits abgerechnete Vertraege anfassen. Wo fuer Team und Saison ein
 * `season_end`-Auszahlungslog steht, ist das Geld geflossen — daran wird nachtraeglich nichts mehr
 * gedreht.
 *
 * WARUM DAS DIE REGEL "unterschriebene Vertraege werden nie nachtraeglich geaendert" NICHT bricht:
 * die Regel schuetzt vor STILLER DRIFT (Anzeige != Settlement, wandernde Anker). M1 ist das
 * Gegenteil — eine explizite, einmalige, versionierte Design-Korrektur. Danach gilt die Regel
 * unveraendert weiter, auch fuer V3-Leitern.
 */
import type { GameState, TeamSponsorContract } from "@/lib/data/olyDataTypes";

import { getPrizePlacementBonus } from "@/lib/season/prize-placement-table";
import {
  getSponsorV3PrizeCurve,
  getSponsorV3SalaryFactor,
  SPONSOR_V3_FLOOR_C,
} from "@/lib/sponsor/sponsor-v3-offer-service";
import { buildSponsorV3TermsCore, sponsorV3BenchmarkLadder, sponsorV3CardByKey } from "@/lib/sponsor/sponsor-v3-model";

/** Version des Leiter-Formats, auf das migriert wird. Erhoehen heisst: noch einmal migrieren. */
export const SPONSOR_LADDER_MIGRATION_VERSION = 3;

function hasSeasonEndPayoutLog(gameState: GameState, seasonId: string, teamId: string): boolean {
  return (gameState.seasonState.sponsorPayoutLogs ?? []).some(
    (log) => log.seasonId === seasonId && log.teamId === teamId && log.phase === "season_end",
  );
}

/**
 * Startrang, gegen den der Platzierungsbonus der Leiter rechnet. Der Vertrag traegt ihn selbst; fehlt
 * er (sehr alte Saves), wird er aus dem Tabellenstand gelesen, und erst zuletzt auf den aktuellen
 * Rang zurueckgefallen. Ohne einen plausiblen Startrang waere der Platzierungsteil der Leiter frei
 * erfunden — deshalb hier eine ausdrueckliche Kette statt eines stillen Defaults.
 */
export function resolveContractStartRank(gameState: GameState, contract: TeamSponsorContract): number {
  const standing = gameState.seasonState.standings?.[contract.teamId] ?? null;
  const candidates = [
    contract.startRank,
    (standing as { startplatz?: number | null } | null)?.startplatz ?? null,
    (standing as { rank?: number | null } | null)?.rank ?? null,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate >= 1) {
      return Math.min(32, Math.round(candidate));
    }
  }
  return 32;
}

/**
 * Baut die V3-Konditionen eines BESTEHENDEN Vertrags. Die gewaehlte Karte ist immer eine
 * TILT-FREIE: der Spieler hat seinerzeit keine Risiko-Entscheidung getroffen, die man ihm jetzt
 * unterschieben duerfte. Traegt der Vertrag ein Sonderziel, bekommt er die Sonderziel-Karte
 * (Benchmark + fair bepreiste Zielpraemie), sonst die reine Basis-Karte.
 *
 * DIE LEITER BLEIBT DIE ALTE PREISGELD-BENCHMARK (`sponsorV3BenchmarkLadder`), NICHT die neue
 * Sponsor-Ligaleiter: genau wie beim Tilt hat der Spieler seinerzeit auch keine Kurvenform gewaehlt,
 * die man ihm jetzt unterschieben duerfte — ein Altvertrag hebt auf die Referenzspalte, die er beim
 * V3-Cutover schon bekommen haette, nicht auf eine Form-Entscheidung, die es damals nicht gab.
 */
export function buildMigratedSponsorV3Terms(gameState: GameState, contract: TeamSponsorContract) {
  const goalKey = contract.components.find((component) => component.kind === "special")?.specialKey ?? null;
  const startRank = resolveContractStartRank(gameState, contract);
  const baseLadder = sponsorV3BenchmarkLadder({
    prizeCurve: getSponsorV3PrizeCurve(gameState),
    startRank,
    placementBonus: getPrizePlacementBonus,
  });
  return buildSponsorV3TermsCore({
    baseLadder,
    startRank,
    rarity: contract.rarity ?? "magisch",
    card: sponsorV3CardByKey(goalKey ? "sonderziel" : "basis"),
    goalKey,
    salaryFactor: getSponsorV3SalaryFactor(gameState),
    floor: SPONSOR_V3_FLOOR_C,
  });
}

export type SponsorLadderMigrationResult = {
  gameState: GameState;
  /** Teams, deren Vertragsleiter neu berechnet wurde. */
  migratedTeamIds: string[];
  /** Lief die Migration in diesem Aufruf ueberhaupt (false = Stempel war schon gesetzt)? */
  applied: boolean;
};

/**
 * Einmalige, versionierte Neuberechnung. Setzt den Stempel auch dann, wenn nichts zu migrieren war —
 * sonst liefe die Pruefung bei jedem Laden erneut ueber alle Vertraege.
 */
export function migrateSponsorLaddersToV3(gameState: GameState): SponsorLadderMigrationResult {
  const seasonState = gameState.seasonState;
  if (!seasonState) {
    return { gameState, migratedTeamIds: [], applied: false };
  }
  if ((seasonState.sponsorLadderMigrationVersion ?? 0) >= SPONSOR_LADDER_MIGRATION_VERSION) {
    return { gameState, migratedTeamIds: [], applied: false };
  }
  const contracts = seasonState.sponsorContractsByTeamId ?? {};
  const seasonId = gameState.season?.id ?? "";
  const migratedTeamIds: string[] = [];
  const nextContracts: Record<string, TeamSponsorContract> = { ...contracts };

  for (const [teamId, contract] of Object.entries(contracts)) {
    if (!contract) continue;
    // Bereits abgerechnet ⇒ das Geld ist geflossen, die Leiter ist Geschichte.
    if (hasSeasonEndPayoutLog(gameState, contract.seasonId ?? seasonId, teamId)) continue;
    const terms = buildMigratedSponsorV3Terms(gameState, contract);
    const { sponsorV2: _legacyV2, ...rest } = contract as TeamSponsorContract & { sponsorV2?: unknown };
    nextContracts[teamId] = { ...rest, sponsorV3: terms };
    migratedTeamIds.push(teamId);
  }

  return {
    gameState: {
      ...gameState,
      seasonState: {
        ...seasonState,
        sponsorContractsByTeamId: nextContracts,
        sponsorLadderMigrationVersion: SPONSOR_LADDER_MIGRATION_VERSION,
      },
    },
    migratedTeamIds,
    applied: true,
  };
}

/** Bequemlichkeits-Fassade fuer Aufrufer, die nur den neuen Spielstand brauchen (Load-Pfad). */
export function withMigratedSponsorLadders(gameState: GameState): GameState {
  return migrateSponsorLaddersToV3(gameState).gameState;
}
