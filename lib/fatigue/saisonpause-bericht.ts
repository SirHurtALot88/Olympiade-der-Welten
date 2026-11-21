/**
 * SAISONPAUSE: Bericht fürs eigene Team (Postfach, Spielplan-Marke). Reine Funktionen auf der
 * gebuchten Pause (`seasonState.belastungsPause`) — dieselben Zahlen, die die Buchung gespeichert
 * hat (gezeigt = gebucht). Die Pause selbst bucht `fatigue-injury-service.ts`.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { BELASTUNG_PAUSE_NACH_SPIELTAG } from "@/lib/fatigue/belastung-regel";

/** Ab dieser Erschöpfung gilt ein Spieler als „im roten Bereich“ (Verletzungsrisiko-Band 65+). */
export const SAISONPAUSE_ROT_AB = 65;

export type SaisonpauseBericht = {
  nachSpieltag: number;
  anzahl: number;
  fatigueVorher: number;
  fatigueNachher: number;
  /** Spieler im roten Bereich vor / nach der Pause. */
  rotVorher: number;
  rotNachher: number;
  /** Aus dem roten Bereich herausgeholt. */
  ausDemRotenBereich: number;
  /** Zum Zeitpunkt der Pause verletzt: erholen sich auch, fehlen aber weiter (Sperren zählen Spieltage). */
  verletzt: number;
};

const rund1 = (wert: number) => Number(wert.toFixed(1));

/** Der Bericht eines Teams, oder null, wenn in dieser Saison keine Pause gebucht ist. */
export function baueSaisonpauseBericht(
  gameState: Pick<GameState, "season" | "seasonState">,
  teamId: string,
): SaisonpauseBericht | null {
  const pause = gameState.seasonState?.belastungsPause;
  if (!pause || pause.seasonId !== gameState.season?.id) return null;
  const eintraege = pause.eintraege.filter((entry) => entry.teamId === teamId);
  if (eintraege.length === 0) return null;
  const mittel = (werte: number[]) => werte.reduce((a, b) => a + b, 0) / werte.length;
  const rotVorher = eintraege.filter((e) => e.fatigueVorher >= SAISONPAUSE_ROT_AB).length;
  return {
    nachSpieltag: BELASTUNG_PAUSE_NACH_SPIELTAG,
    anzahl: eintraege.length,
    fatigueVorher: rund1(mittel(eintraege.map((e) => e.fatigueVorher))),
    fatigueNachher: rund1(mittel(eintraege.map((e) => e.fatigueNachher))),
    rotVorher,
    rotNachher: eintraege.filter((e) => e.fatigueNachher >= SAISONPAUSE_ROT_AB).length,
    ausDemRotenBereich: eintraege.filter(
      (e) => e.fatigueVorher >= SAISONPAUSE_ROT_AB && e.fatigueNachher < SAISONPAUSE_ROT_AB,
    ).length,
    verletzt: eintraege.filter((e) => e.verletzt).length,
  };
}

const zahl = (wert: number) => wert.toFixed(1).replace(".", ",");

/** Der Meldungstext fürs Postfach. */
export function formatSaisonpauseBericht(bericht: SaisonpauseBericht): string {
  const teile = [
    `Ø Erschöpfung ${zahl(bericht.fatigueVorher)} → ${zahl(bericht.fatigueNachher)}`,
    bericht.rotVorher > 0
      ? `${bericht.ausDemRotenBereich} von ${bericht.rotVorher} Spielern aus dem roten Bereich (ab ${SAISONPAUSE_ROT_AB}) heraus`
      : "niemand war im roten Bereich",
  ];
  if (bericht.verletzt > 0) {
    teile.push(`${bericht.verletzt} Verletzte erholen sich ebenfalls, fehlen aber weiter`);
  }
  return `Nach Spieltag ${bericht.nachSpieltag} hat der ganze Kader einen spielfreien Spieltag regeneriert: ${teile.join(" · ")}. Die Pause zählt nicht als Spieltag (keine Wertung, kein Training, keine Finanzbuchung).`;
}
