import type { LegacyMatchdayResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-types";

/**
 * WECHSEL DISZIPLIN 1 -> DISZIPLIN 2 (18.11., Mockup `arena-spieltag-modern-18-11.html`, Screen 6) --
 * reine Logik, kein React.
 *
 * Chris: „obwohl ich N-N steuere, geht er auf ein anderes Spiel, wenn ich zu Diszi 2 wechsle". Der
 * Wechsel selbst ist nur `setDisciplineId(secondDisciplineId)`; welches Spiel die Arena danach zeigt,
 * hing an zwei getrennten Ableitungen (Ansicht aus der Wertungszeile, Pod-Suche im Host), und der
 * Kopf nannte bei Vierergruppen den Fixture-Gegner aus Disziplin 1. Regel jetzt: der Wechsel zeigt
 * IMMER das Spiel des gesteuerten Teams; fremde Spiele der Disziplin gibt es nur als bewusste Wahl
 * („nur ansehen"), die nie bucht.
 *
 * Die Spielliste kommt aus der Wertungsvorschau (gebucht = gezeigt): Duelle aus `opponentTeamId`,
 * Vierergruppen aus `miniDmPod.podId`/`teamIds`.
 */
export type WechselSpiel = {
  /** Stabile Kennung: Pod-Id bzw. sortiertes Duell-Paar. */
  id: string;
  art: "duell" | "pod";
  teamIds: string[];
  /** Das Spiel des gesteuerten Teams -- vorgewaehlt, Standard. */
  eigenes: boolean;
};

export function baueWechselSpielliste(input: {
  preview: LegacyMatchdayResolvePreview | null | undefined;
  disciplineId: string | null | undefined;
  ownTeamId: string | null | undefined;
}): WechselSpiel[] {
  const { preview, disciplineId, ownTeamId } = input;
  const disziplin = preview?.disciplinePreviews.find((eintrag) => eintrag.disciplineId === disciplineId);
  if (!disziplin) return [];
  const spiele = new Map<string, WechselSpiel>();
  for (const zeile of disziplin.teamResults) {
    const pod = zeile.miniDmPod;
    let id: string;
    let teamIds: string[];
    let art: WechselSpiel["art"];
    if (pod?.teamIds?.length) {
      art = "pod";
      teamIds = [...pod.teamIds];
      id = `pod:${pod.podId ?? teamIds.join("-")}`;
    } else if (zeile.opponentTeamId) {
      art = "duell";
      teamIds = [zeile.teamId, zeile.opponentTeamId].sort();
      id = `duell:${teamIds.join("-")}`;
    } else {
      continue;
    }
    if (!spiele.has(id)) {
      spiele.set(id, { id, art, teamIds, eigenes: !!ownTeamId && teamIds.includes(ownTeamId) });
    }
  }
  // Das eigene Spiel zuerst, danach in Vorschau-Reihenfolge.
  return [...spiele.values()].sort((a, b) => Number(b.eigenes) - Number(a.eigenes));
}

/** Das Spiel, auf dem der Wechsel landet: immer das eigene; `null`, wenn das Team dort nicht spielt. */
export function waehleWechselStandard(spiele: readonly WechselSpiel[]): WechselSpiel | null {
  return spiele.find((spiel) => spiel.eigenes) ?? null;
}
