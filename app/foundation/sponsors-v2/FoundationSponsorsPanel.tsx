"use client";

import { useMemo, useState } from "react";

import FoundationSponsorsNewLook from "@/app/foundation/sponsors-v2/FoundationSponsorsNewLook";
import SponsorenModern from "@/app/foundation/sponsors-v2/SponsorenModern";
import type { GameState, SponsorCommercialRating, SponsorOffer, TeamSponsorContract } from "@/lib/data/olyDataTypes";
import { baueSponsorUebersicht } from "@/lib/sponsors/sponsor-uebersicht";
import type { SponsorFarbe, SponsorVertragsart } from "@/lib/sponsors/sponsor-topf-typen";

import "./sponsoren-modern.css";

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
  /**
   * Unterschreibt ein Angebot. Unter der Topf-Regel (seit 24.11.) trägt `wahl` Vertragsart, Laufzeit und Farb-Partner; ohne `wahl`
   * füllt die KI sie (Mensch überschreibt, KI respektiert das).
   */
  chooseTeamSponsor: (
    offerId: string,
    wahl?: { vertragsart?: SponsorVertragsart; laufzeit?: 1 | 2 | 3; farben?: SponsorFarbe[] },
  ) => void | Promise<void>;
  /** Sponsorentermin beantworten (`POST /api/sponsor/event`); fehlt der Schreibweg, sind die Knöpfe gesperrt. */
  answerSponsorTermin?: (terminId: string, antwort: "zusagen" | "absagen" | "ki") => void | Promise<void>;
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

/**
 * Sponsorenseite. Unter der Topf-Regel (neues Spiel ab Saison 1, bestehender Spielstand ab dem nächsten Saisonwechsel) die neue Seite
 * nach dem Mockup 22.11.; unter der alten Regel bleibt die alte Seite zuständig (dort laufen Wahl, Leiter und Seltenheit weiter), mit
 * einem Hinweis, ab wann das neue System gilt.
 */
export default function FoundationSponsorsPanel(props: FoundationSponsorsPanelProps) {
  const { gameState, selectedTeamId, answerSponsorTermin } = props;
  const [terminBusy, setTerminBusy] = useState<string | null>(null);
  const uebersicht = useMemo(() => {
    if (!selectedTeamId) return null;
    try {
      return baueSponsorUebersicht(gameState, selectedTeamId);
    } catch {
      return null;
    }
  }, [gameState, selectedTeamId]);

  if (!uebersicht || !selectedTeamId) {
    return (
      <>
        <div className="bc so-alt" data-testid="sponsoren-alt-hinweis" role="note">
          <strong>Neues Sponsorensystem gilt ab der nächsten Saison.</strong> Dein laufender Vertrag und die Wahl vor Spieltag 1 laufen bis dahin wie gewohnt; zum Saisonwechsel wird der Vertrag
          als Leistungsvertrag derselben Marke übernommen, mit Passung, Farb-Partnern und Sponsorterminen.
        </div>
        <FoundationSponsorsNewLook {...props} />
      </>
    );
  }
  return (
    <SponsorenModern
      gameState={gameState}
      teamId={selectedTeamId}
      teamName={props.selectedTeamName}
      uebersicht={uebersicht}
      kannVerwalten={props.selectedTeamCanManage}
      onUnterschreiben={props.chooseTeamSponsor}
      onTerminAntwort={
        answerSponsorTermin
          ? async (terminId, antwort) => {
              setTerminBusy(terminId);
              try {
                await answerSponsorTermin(terminId, antwort);
              } finally {
                setTerminBusy(null);
              }
            }
          : undefined
      }
      meldung={props.sponsorChoiceMessage}
      beschaeftigt={props.sponsorChoiceBusy}
      terminBeschaeftigt={terminBusy}
    />
  );
}
