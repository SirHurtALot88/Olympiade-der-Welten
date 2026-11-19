"use client";

import { useMemo } from "react";

import type { GameState } from "@/lib/data/olyDataTypes";
import { useFoundationStateOptional } from "@/lib/foundation/foundation-state-context";
import type { PlayerDetailDrawerData } from "@/lib/foundation/player-detail-drawer";
import {
  attributWerteAusDaten,
  baueMatchdayPpReihe,
  berechneSpielerRaenge,
  besteDisziplinId,
  bestimmeExperte,
  bestimmeVerletzung,
  hatNebel,
  nebelBreite,
  type ExperteIn,
  type PpSpieltag,
  type SpielerRaenge,
  type VerletzungsAnzeige,
} from "@/lib/foundation/spielerprofil-modell";
import { baueFormMoralAnzeige, moralUrsachen, type FormMoralAnzeige } from "@/lib/lineups/form-moral-anzeige";
import { einsatzlisteKulisseBild } from "@/lib/lineups/einsatzliste-kulisse-bild";
import type { PlayerGeneratorAttributeKey } from "@/lib/player-generator/official-discipline-weights";

export type SpielerprofilModell = {
  gameState: GameState | null;
  nebel: boolean;
  /** Breite der Bereiche im Nebel: 10 unbekannt, 5 beobachtet. */
  nebelBreite: 0 | 5 | 10;
  verletzung: VerletzungsAnzeige;
  raenge: SpielerRaenge | null;
  ppReihe: PpSpieltag[];
  form: FormMoralAnzeige | null;
  moralGruende: Array<{ id: string; label: string; delta: number }>;
  experte: ExperteIn[];
  werte: Partial<Record<PlayerGeneratorAttributeKey, number | null>>;
  besteDisziplin: string | null;
  kulisseUrl: string | null;
  disziplinLabel: (id: string) => string;
  /** Kollegen im Kader (für Blättern), in Kaderreihenfolge. */
  kaderIds: string[];
};

/**
 * Alles, was Seite und Kurzprofil zusätzlich zum `PlayerDetailDrawerData` brauchen und aus dem GameState kommt.
 * Ohne GameState (Kontext fehlt) bleiben Ränge, PP-Reihe und Form leer; die Ansicht blendet sie aus.
 */
export function useSpielerprofilModell(data: PlayerDetailDrawerData): SpielerprofilModell {
  const kontext = useFoundationStateOptional();
  const gameState = kontext?.gameState ?? null;
  const betrachterTeamId = kontext?.activeManagerTeamId ?? null;
  return useMemo(() => {
    const nebel = hatNebel(data);
    const breite = nebelBreite(data);
    const verletzung = bestimmeVerletzung(data, gameState);
    const ids = data.disciplineValues.map((zeile) => zeile.id);
    const raenge = gameState ? berechneSpielerRaenge(gameState, data.playerId, ids, betrachterTeamId) : null;
    const ppReihe = gameState ? baueMatchdayPpReihe(gameState, data.playerId) : [];
    const form = gameState ? baueFormMoralAnzeige(gameState, data.playerId) : null;
    const moralGruende = gameState && !nebel ? moralUrsachen(gameState, data.playerId, data.teamId, 4) : [];
    const experte = bestimmeExperte(data, 6);
    const werte = attributWerteAusDaten(data);
    const beste = besteDisziplinId(data);
    const namen = new Map(data.disciplineValues.map((zeile) => [zeile.id, zeile.label] as const));
    const kaderIds =
      gameState && data.teamId
        ? gameState.rosters.filter((eintrag) => eintrag.teamId === data.teamId).map((eintrag) => eintrag.playerId)
        : [];
    return {
      gameState,
      nebel,
      nebelBreite: breite,
      verletzung,
      raenge,
      ppReihe,
      form,
      moralGruende,
      experte,
      werte,
      besteDisziplin: beste,
      kulisseUrl: einsatzlisteKulisseBild(beste),
      disziplinLabel: (id: string) => namen.get(id) ?? id,
      kaderIds,
    };
  }, [data, gameState, betrachterTeamId]);
}
