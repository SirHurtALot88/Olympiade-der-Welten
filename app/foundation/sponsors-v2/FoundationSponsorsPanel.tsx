"use client";

import FoundationSponsorsNewLook from "@/app/foundation/sponsors-v2/FoundationSponsorsNewLook";
import type { GameState, SponsorCommercialRating, SponsorOffer, TeamSponsorContract } from "@/lib/data/olyDataTypes";

export type FoundationSponsorsPanelProps = {
  gameState: GameState;
  /** Eigenes Team — trägt die offenen Gebäude-Übernahmeangebote (`sponsorUebernahmeAngeboteByTeamId`). */
  selectedTeamId: string | null;
  selectedTeamName: string;
  selectedTeamCommercialRating: SponsorCommercialRating | null;
  selectedTeamSponsorContract: TeamSponsorContract | null;
  selectedTeamSponsorOffers: SponsorOffer[];
  sponsorChoiceMessage: string | null;
  sponsorChoiceBusy: string | null;
  selectedTeamCanManage: boolean;
  formatMoney: (value: number) => string;
  chooseTeamSponsor: (offerId: string) => void | Promise<void>;
  /** Status/Meldung für ein laufendes Übernahme-Annehmen/Ablehnen — eigener Kanal, keine Angebotswahl. */
  sponsorUebernahmeMessage: string | null;
  /** `facilityId` des Angebots, das gerade bearbeitet wird — nicht die `offerId` wie bei `sponsorChoiceBusy`. */
  sponsorUebernahmeBusy: string | null;
  handleSponsorUebernahme: (facilityId: string, action: "annehmen" | "ablehnen") => void | Promise<void>;
  prizeFinanceTab: "sponsors" | "prize";
  /**
   * Aktiver Save — Seed-Anteil des Season-Ökonomie-Fensters (Gehaltsfaktor). Dieselbe Begründung wie
   * bei `FoundationFinancesHost`: ohne die echte saveId würfelt der Fallback in
   * `getSeasonEconomyFactorWindow` andere Werte als Finanzen-Reiter und KI. Optional, damit
   * bestehende Aufrufer unverändert bleiben — fehlt sie UND fehlt das persistierte Fenster, zeigt
   * die Sponsorseite den Faktor lieber gar nicht als abweichend.
   */
  saveId?: string | null;
};

export default function FoundationSponsorsPanel(props: FoundationSponsorsPanelProps) {
  return <FoundationSponsorsNewLook {...props} />;
}
