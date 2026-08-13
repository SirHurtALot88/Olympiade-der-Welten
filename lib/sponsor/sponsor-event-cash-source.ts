/**
 * DIE EINE QUELLE FÜR „WAS HABEN DIE SPONSOR-EREIGNISSE GEBRACHT ODER GEKOSTET".
 *
 * GEMELDET VON CHRIS: „klauseln bitte mit in die GuV hinzufügen wenn zutreffend!"
 *
 * WAS FEHLTE. Mitten in der Saison würfelt `maybeGenerateSponsorEvents` beim Spieltagswechsel
 * Ereignisse aus dem laufenden Sponsorvertrag: einen Aktions-Bonus (positiv), eine ausgelöste
 * Vertragsklausel oder Partner-Reibung (beide negativ). Sie werden SOFORT verrechnet — der
 * `cashDelta` landet direkt auf `team.cash`, der Datensatz wird als `resolved` abgelegt. In der GuV
 * tauchten sie in keinem einzigen Posten auf: nicht in der Sponsor-Zeile (die liest
 * `sponsorPayoutLogs` und die Vertragskomponenten, nicht `sponsorEvents`) und in keiner anderen.
 * Am Abbild `1hf25q` traf das 23 von 32 Teams; L-K verlor über zwei ausgelöste Klauseln 4,0 C, die
 * vom Konto abgingen, ohne dass die GuV sie kannte.
 *
 * NUR WAS WIRKLICH GEBUCHT IST — deshalb zählt allein `status: "resolved"`. Das ist keine
 * Feinheit: `dismissed` heisst, das Team hat abgelehnt und es floss nie Geld; `open` gibt es nur
 * noch in Altspielständen (vor dem Auto-Settle) und ist eine Einladung, die niemand angenommen hat.
 * Beides in die GuV zu ziehen wäre eine Behauptung über eine Kontobewegung, die nicht stattfand.
 *
 * WARUM EIN EIGENER POSTEN UND NICHT IN DIE SPONSOR-ZEILE. Es sind zwei verschiedene Systeme, und
 * `sponsor-event-service.ts` sagt das selbst: „Das Event-Cash ist ein eigenständiges System und hat
 * KEINE Überschneidung mit dem Season-End-Settlement." Die Sponsor-Zeile beantwortet „was zahlt der
 * Vertrag für die Saison", diese hier „was ist unterwegs dazwischengekommen". Zusammengeworfen
 * liesse sich weder das eine noch das andere nachrechnen.
 */
import type { GameState, SponsorEventRecord } from "@/lib/data/olyDataTypes";

export type SponsorEventCashSource = {
  /** Netto-Cash je Team aus verrechneten Ereignissen. Teams ohne Eintrag hatten keine — 0. */
  byTeamId: Map<string, number>;
  /** Anzahl der verrechneten Ereignisse je Team — trägt die Hover-Notiz. */
  anzahlByTeamId: Map<string, number>;
};

function roundCash(value: number) {
  return Number(value.toFixed(1));
}

/** Die verrechneten Sponsor-Ereignisse der AKTUELLEN Saison. */
export function getSponsorEventCashByTeam(gameState: GameState): SponsorEventCashSource {
  const seasonId = gameState.season.id;
  const byTeamId = new Map<string, number>();
  const anzahlByTeamId = new Map<string, number>();

  for (const event of (gameState.seasonState.sponsorEvents ?? []) as SponsorEventRecord[]) {
    if (event.seasonId !== seasonId) continue;
    if (event.status !== "resolved") continue;
    if (!Number.isFinite(event.cashDelta)) continue;
    byTeamId.set(event.teamId, roundCash((byTeamId.get(event.teamId) ?? 0) + event.cashDelta));
    anzahlByTeamId.set(event.teamId, (anzahlByTeamId.get(event.teamId) ?? 0) + 1);
  }

  return { byTeamId, anzahlByTeamId };
}
