/**
 * SPONSOR-NAMEN (Chris, 22.11.): „dass ingame alle so heißen wie auch auf den Logos“.
 *
 * Die 200 Dachmarken tragen seit 22.11. eigene Parodienamen (`sponsor-brand-parents.ts`); die `id`
 * blieb gleich. Gespeichert wird der Anzeigename aber an vier Stellen im Spielstand:
 *
 *  - Angebote (`seasonState.sponsorOffersByTeamId[].name`)
 *  - unterschriebene Verträge (`seasonState.sponsorContractsByTeamId[].name`)
 *  - Sponsor-Ereignisse (`seasonState.sponsorEvents[].sponsorName` und `.message`, daraus baut die
 *    Inbox ihre Karten)
 *
 * Diese Lade-Migration setzt dort den neuen Namen ein. Vorrang hat die `sponsorParentBrandId`
 * (stabil), sonst wird der alte Klartext-Name über `ALTE_SPONSOR_NAMEN` erkannt. Nur Namen ändern
 * sich, kein Geld, keine Werte. Idempotent: ein bereits neuer Name bleibt unangetastet.
 */
import type { GameState, SponsorEventRecord, SponsorOffer, TeamSponsorContract } from "@/lib/data/olyDataTypes";
import { ALTE_SPONSOR_NAMEN } from "@/lib/sponsor/sponsor-brand-alte-namen";
import { SPONSOR_BRAND_PARENTS, getSponsorBrandParentById } from "@/lib/sponsor/sponsor-brand-parents";

/** Alter Klartext-Name → neuer Name (über die gemeinsame id). Nur dort, wo sich der Name geändert hat. */
function baueAltNeuListe(): Array<readonly [string, string]> {
  const liste: Array<readonly [string, string]> = [];
  for (const parent of SPONSOR_BRAND_PARENTS) {
    const alt = ALTE_SPONSOR_NAMEN[parent.id];
    if (alt && alt !== parent.name) liste.push([alt, parent.name] as const);
  }
  // Längste zuerst, damit ein langer Name nicht von einem kürzeren angefressen wird.
  return liste.sort((a, b) => b[0].length - a[0].length);
}

const ALT_NEU_LISTE = baueAltNeuListe();
const ALT_NEU_NACH_NAME = new Map(ALT_NEU_LISTE);

/** Setzt in einem Freitext (z. B. Ereignis-Nachricht) jeden alten Marken-Namen auf den neuen. */
export function ersetzeAlteSponsorNamen(text: string): string {
  let result = text;
  for (const [alt, neu] of ALT_NEU_LISTE) {
    if (result.includes(alt)) result = result.split(alt).join(neu);
  }
  return result;
}

/** Der Anzeigename, der heute zu einem gespeicherten Namen gehört (mit oder ohne Marken-id). */
export function aktuellerSponsorName(parentBrandId: string | null | undefined, gespeicherterName: string): string {
  const parent = parentBrandId ? getSponsorBrandParentById(parentBrandId) : null;
  if (parent) return parent.name;
  return ALT_NEU_NACH_NAME.get(gespeicherterName) ?? gespeicherterName;
}

export function migriereSponsorNamen(gameState: GameState): GameState {
  const seasonState = gameState.seasonState;
  if (!seasonState) return gameState;
  let changed = false;

  const migriereAngebot = <T extends SponsorOffer | TeamSponsorContract>(eintrag: T): T => {
    const name = aktuellerSponsorName(eintrag.sponsorParentBrandId, eintrag.name);
    if (name === eintrag.name) return eintrag;
    changed = true;
    return { ...eintrag, name };
  };

  const angebote = seasonState.sponsorOffersByTeamId
    ? Object.fromEntries(
        Object.entries(seasonState.sponsorOffersByTeamId).map(([teamId, liste]) => [teamId, liste.map(migriereAngebot)]),
      )
    : seasonState.sponsorOffersByTeamId;

  const vertraege = seasonState.sponsorContractsByTeamId
    ? Object.fromEntries(
        Object.entries(seasonState.sponsorContractsByTeamId).map(([teamId, vertrag]) => [teamId, migriereAngebot(vertrag)]),
      )
    : seasonState.sponsorContractsByTeamId;

  const ereignisse = seasonState.sponsorEvents?.map((ereignis: SponsorEventRecord) => {
    const sponsorName = ALT_NEU_NACH_NAME.get(ereignis.sponsorName) ?? ereignis.sponsorName;
    const message = ersetzeAlteSponsorNamen(ereignis.message);
    if (sponsorName === ereignis.sponsorName && message === ereignis.message) return ereignis;
    changed = true;
    return { ...ereignis, sponsorName, message };
  });

  if (!changed) return gameState;
  return {
    ...gameState,
    seasonState: {
      ...seasonState,
      sponsorOffersByTeamId: angebote,
      sponsorContractsByTeamId: vertraege,
      ...(ereignisse ? { sponsorEvents: ereignisse } : {}),
    },
  };
}
