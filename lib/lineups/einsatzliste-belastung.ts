/**
 * LAST-VORSCHAU DER EINSATZLISTE (Belastung/Resistenz, 21.11.) — reine Funktion für den Browser.
 *
 * Chris: „wenn ich einen Spieler per Drag and Drop irgendwo hinziehen will, soll mir direkt in jedem Slot
 * angezeigt werden, welche Stärke er dort hätte und wie viel Ausdauer er einsetzen müsste (Belastung)".
 *
 * GEZEIGT = GEBUCHT: die Last kommt aus `berechneEinsatzLast` (lib/fatigue/belastung-regel.ts), derselben
 * Funktion, mit der `applyFatigueAndInjuryAfterMatchday` bucht; Trait-, Einsatz-Multiplikator und aktive
 * Erholung liefert der Server je Spieler (`belastungsBasis`), Stufe und Belastungs-Attribut die Slot-Rolle,
 * die Resistenz das Attribut des Spielers. Die Erschöpfung danach läuft über `projiziereEinsatzErschoepfung`
 * (dieselbe Klemmung wie der Wurf), das Risiko über die Kurve aus `fatigue-calibration.ts`.
 */
import {
  belastungsTon,
  belastungsZusatzText,
  berechneEinsatzLast,
  berechneSlotBelastungsTeile,
  istBelastungsStufe,
  projiziereEinsatzErschoepfung,
  type BelastungsRegelVersion,
  type BelastungsStufe,
  type BelastungsTon,
  type SlotBelastungsTeile,
} from "@/lib/fatigue/belastung-regel";
import { getInjuryRiskBand, getInjuryRiskPercent } from "@/lib/fatigue/fatigue-calibration";
import type { LegacyBelastungsBasisRef, LegacyRosterPlayerRef } from "@/lib/lineups/legacy-lineup-types";
import type { MatchdayIntensityStage } from "@/lib/lineups/matchday-slot-roles";

export type SlotBelastungsVorschau = {
  regel: BelastungsRegelVersion;
  stufe: BelastungsStufe | null;
  strainAttribute: string | null;
  /** Resistenz = Wert des Spielers im Belastungs-Attribut des Platzes. */
  resistenz: number | null;
  /** Nur unter v2: Grundlast, Schwelle, Zusatz. */
  teile: SlotBelastungsTeile | null;
  /** Last dieses Einsatzes (vor aktiver Erholung) — genau die gebuchte Zahl. */
  last: number;
  aktiveErholung: number;
  fatigueVorher: number;
  fatigueNachher: number;
  risikoProzent: number;
  ton: BelastungsTon;
  /** „zu schwach +1,6“ / „über Schwelle −0,8“ / null (alte Regel). */
  zusatzText: string | null;
};

/**
 * Die Einsatz-Projektion EINES Platzes im Format von `injuryRiskProjection` (Erschöpfung beim Wurf, Last,
 * Risiko, Band) — unter Belastungsregel v2, wo die Last am Platz hängt. Unter der alten Regel `null`: dann
 * gilt die platzunabhängige `injuryRiskProjection` des Servers unverändert.
 */
export function slotEinsatzProjektion(input: {
  context:
    | {
        belastungsRegel?: BelastungsRegelVersion | null;
        activePlayers?: ReadonlyArray<{ id: string; playerId: string }> | null;
        rosterPlayers?: ReadonlyArray<LegacyRosterPlayerRef> | null;
      }
    | null
    | undefined;
  activePlayerId: string | null | undefined;
  role: { fatigueProfile: string; strainAttribute: string } | null | undefined;
  intensitaet: MatchdayIntensityStage;
}): { fatigueBeforeRoll: number; matchdayLoad: number; activeRecovery: number; riskPercent: number; bandLabel: string } | null {
  if (input.context?.belastungsRegel !== "v2" || !input.activePlayerId) return null;
  const playerId = input.context.activePlayers?.find((aktiv) => aktiv.id === input.activePlayerId)?.playerId;
  const ref = playerId ? input.context.rosterPlayers?.find((player) => player.id === playerId) : null;
  if (!ref) return null;
  const b = baueSlotBelastungsVorschau({
    regel: "v2",
    role: input.role,
    attributeStats: ref.attributeStats as Partial<Record<string, number | null>> | null,
    basis: ref.belastungsBasis ?? null,
    intensitaet: input.intensitaet,
    aktuelleFatigue: ref.fatigue ?? 0,
  });
  if (!b) return null;
  return {
    fatigueBeforeRoll: b.fatigueNachher,
    matchdayLoad: b.last,
    activeRecovery: b.aktiveErholung,
    riskPercent: b.risikoProzent,
    bandLabel: getInjuryRiskBand(b.fatigueNachher).label,
  };
}

export function baueSlotBelastungsVorschau(input: {
  regel: BelastungsRegelVersion | null | undefined;
  role: { fatigueProfile: string; strainAttribute: string } | null | undefined;
  attributeStats: Partial<Record<string, number | null>> | null | undefined;
  basis: LegacyBelastungsBasisRef | null | undefined;
  intensitaet: MatchdayIntensityStage;
  /** Gesamt-Erschöpfung des Spielers (Konto + Trainingsschicht), wie die Einsatzliste sie zeigt. */
  aktuelleFatigue: number | null | undefined;
}): SlotBelastungsVorschau | null {
  if (!input.basis) return null;
  const regel: BelastungsRegelVersion = input.regel === "v2" ? "v2" : "alt";
  const stufe = input.role && istBelastungsStufe(input.role.fatigueProfile) ? input.role.fatigueProfile : null;
  const strainAttribute = input.role?.strainAttribute ?? null;
  const rohResistenz = strainAttribute ? input.attributeStats?.[strainAttribute] : null;
  const resistenz = typeof rohResistenz === "number" && Number.isFinite(rohResistenz) ? rohResistenz : null;
  const slot = regel === "v2" && stufe ? { stufe, resistenz } : null;
  const last = berechneEinsatzLast({
    regel,
    altGrundlast: input.basis.altGrundlast,
    traitMultiplikator: input.basis.traitMultiplikator,
    einsatzMultiplikator: input.basis.einsatzMultiplikator[input.intensitaet] ?? 1,
    slot,
  });
  const teile = slot ? berechneSlotBelastungsTeile(slot) : null;
  const fatigueVorher = Math.max(0, Math.min(100, input.aktuelleFatigue ?? 0));
  const fatigueNachher = projiziereEinsatzErschoepfung({
    aktuelleFatigue: input.aktuelleFatigue ?? 0,
    last,
    aktiveErholung: input.basis.aktiveErholung,
  });
  return {
    regel,
    stufe,
    strainAttribute,
    resistenz,
    teile,
    last,
    aktiveErholung: input.basis.aktiveErholung,
    fatigueVorher,
    fatigueNachher,
    risikoProzent: getInjuryRiskPercent(fatigueNachher),
    ton: belastungsTon(teile),
    zusatzText: belastungsZusatzText(teile),
  };
}
