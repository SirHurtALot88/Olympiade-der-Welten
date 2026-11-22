import {
  applyContractRenewalAction,
  bewerteVertraegeFuerKi,
  previewContractRenewalAction,
} from "@/lib/contracts/contract-renewal-service";
import {
  gesamtSpieltage,
  gespielteSpieltage,
  istDraftPickFestkonditionen,
  istInSaisonModus,
  istSaisonDurchgespielt,
  IN_SAISON_MINDEST_LAUFZEIT,
  kiPruefSpieltag,
  verlaengerungInSaisonAktiv,
} from "@/lib/contracts/verlaengerung-in-saison";
import type { RosterEntry } from "@/lib/data/olyDataTypes";
import { createCaptureBatchPersistence } from "@/lib/persistence/capture-batch-persistence";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import type { PersistedSaveGame, PersistenceService } from "@/lib/persistence/types";

/**
 * KI-VERLAENGERUNG MITTEN IN DER SAISON (Chris 21.11., docs/design/verlaengerung-in-saison-21-11.md).
 *
 * KEINE NEUE HEURISTIK. Die Entscheidung „verlaengern oder nicht“ ist die Zeile des Saisonende-Ticks
 * (`bewerteVertraegeFuerKi` -> `buildPreviewRow`: Kassenlage, Rest-Kader, Moral, TCO, Strategie). Neu ist nur der
 * Zeitpunkt, und er ist eng gefasst:
 *   - nur Vertraege, die mit dieser Saison auslaufen (Laufzeit 1);
 *   - nur KI-Teams und Menschen-Teams mit delegiertem Bereich „Kaeufe, Verkaeufe, Vertraege“ (`controlMode: "ai"` der Zeile);
 *   - nur Verlaengern, nie Freigeben (wer am Saisonende gehen wuerde, wird hier nicht angefasst);
 *   - einmal je Spieler und Saison (Vermerk am Rostereintrag) und je Spieler an EINEM festen Spieltag (Hash), damit
 *     nicht jeder Spieltagsabschluss die ganze Liga neu durchrechnet;
 *   - Mindestlaufzeit 2, Saison-1-Draft-Picks ausgenommen, Vorstands-Gehaltstopf hart — das alles prueft der
 *     gemeinsame Dienst (`previewContractRenewalAction`), derselbe wie beim Menschen.
 */

export type KiVerlaengerungInSaisonErgebnis = {
  geprueft: number;
  verlaengert: Array<{ teamId: string; playerId: string; laufzeit: number; altesGehalt: number; neuesGehalt: number }>;
  abgelehnt: Array<{ teamId: string; playerId: string; grund: string }>;
};

/** Welche Vertraege prueft die KI NACH dem gerade gebuchten Spieltag? Reine Funktion, schreibt nichts. */
export function ermittleKiKandidatenInSaison(save: PersistedSaveGame): RosterEntry[] {
  const gameState = save.gameState;
  if (!verlaengerungInSaisonAktiv() || !istInSaisonModus(gameState) || istSaisonDurchgespielt(gameState)) return [];
  const gespielt = gespielteSpieltage(gameState);
  const gesamt = gesamtSpieltage(gameState);
  return gameState.rosters.filter((entry) => {
    if ((entry.contractLength ?? 0) !== 1) return false;
    if (entry.inSaisonVerlaengerung?.seasonId === gameState.season.id) return false;
    if (istDraftPickFestkonditionen(gameState, entry)) return false;
    return kiPruefSpieltag(gameState.season.id, entry.teamId, entry.playerId, gesamt) === gespielt;
  });
}

export function fuehreKiVerlaengerungenInSaisonAus(input: {
  saveId: string;
  persistence?: PersistenceService;
}): KiVerlaengerungInSaisonErgebnis {
  const ergebnis: KiVerlaengerungInSaisonErgebnis = { geprueft: 0, verlaengert: [], abgelehnt: [] };
  const basis = input.persistence ?? createPersistenceService();
  const seed = basis.getSaveById(input.saveId);
  if (!seed) return ergebnis;
  const kandidaten = ermittleKiKandidatenInSaison(seed);
  if (kandidaten.length === 0) return ergebnis;

  const deferred = createCaptureBatchPersistence({ delegate: basis, saveId: input.saveId, seed });
  const persistence = deferred.persistence;
  const zeilen = bewerteVertraegeFuerKi(seed, kandidaten);

  for (const zeile of zeilen) {
    const save = persistence.getSaveById(input.saveId);
    if (!save) break;
    if (zeile.controlMode !== "ai") continue;
    ergebnis.geprueft += 1;
    if (zeile.recommendedAction !== "renew" || !zeile.canRenewEffective) continue;
    const laufzeit = zeile.recommendedLength;
    if (laufzeit < IN_SAISON_MINDEST_LAUFZEIT) continue;
    const eintrag = save.gameState.rosters.find((e) => e.teamId === zeile.teamId && e.playerId === zeile.playerId);
    if (!eintrag) continue;
    const vorschau = previewContractRenewalAction({
      save,
      teamId: zeile.teamId,
      playerId: zeile.playerId,
      action: "renew",
      contractLength: laufzeit,
      offeredSalary: zeile.renewalSalaryPreview,
      contractShape: zeile.recommendedContractShape,
    });
    if (!vorschau.ok) {
      ergebnis.abgelehnt.push({ teamId: zeile.teamId, playerId: zeile.playerId, grund: vorschau.blockingReasons[0] ?? "blockiert" });
      continue;
    }
    const angewendet = applyContractRenewalAction({
      save,
      teamId: zeile.teamId,
      playerId: zeile.playerId,
      action: "renew",
      confirmToken: vorschau.confirmToken,
      persistence,
      contractLength: laufzeit,
      offeredSalary: zeile.renewalSalaryPreview,
      contractShape: zeile.recommendedContractShape,
      source: "ai_contract_renewal",
    });
    if (!angewendet.applied) {
      ergebnis.abgelehnt.push({ teamId: zeile.teamId, playerId: zeile.playerId, grund: angewendet.blockingReasons[0] ?? "nicht_angewendet" });
      continue;
    }
    ergebnis.verlaengert.push({
      teamId: zeile.teamId,
      playerId: zeile.playerId,
      laufzeit,
      altesGehalt: eintrag.salary,
      neuesGehalt: vorschau.inSaison?.neuesGehaltSaison ?? eintrag.salary,
    });
  }

  deferred.flush();
  return ergebnis;
}
