"use client";

import type { CSSProperties } from "react";

import BudgetedMediaImage from "@/components/foundation/BudgetedMediaImage";
import { formatMoney } from "@/lib/foundation/tabs/foundation-format-render-helpers";

export type FoundationTeamPortraitCardProps = {
  teamId: string;
  teamName: string;
  shortCode?: string | null;
  logoUrl: string | null;
  logoInitials: string;
  rosterSize?: number | null;
  cash?: number | null;
  salaryTotal?: number | null;
  marketValueTotal?: number | null;
  powRank?: number | null;
  speRank?: number | null;
  menRank?: number | null;
  socRank?: number | null;
  generalManagerName?: string | null;
  boardConfidence?: number | null;
  interactive?: boolean;
  onOpen?: () => void;
  className?: string;
  style?: CSSProperties;
};

function formatRank(rank: number | null | undefined) {
  return rank != null && Number.isFinite(rank) ? `#${rank}` : "—";
}

export default function FoundationTeamPortraitCard({
  teamId,
  teamName,
  shortCode,
  logoUrl,
  logoInitials,
  rosterSize,
  cash,
  salaryTotal,
  marketValueTotal,
  powRank,
  speRank,
  menRank,
  socRank,
  generalManagerName,
  boardConfidence,
  interactive = false,
  onOpen,
  className = "",
  style,
}: FoundationTeamPortraitCardProps) {
  const hasRanks = [powRank, speRank, menRank, socRank].some((value) => value != null);
  const hasEconomy = [marketValueTotal, salaryTotal, cash].some((value) => value != null);

  const cardClassName = ["foundation-team-portrait-card", className].filter(Boolean).join(" ");

  const cardBody = (
    <>
      <div className="foundation-team-portrait-head">
        <BudgetedMediaImage
          className="foundation-team-portrait-logo"
          src={logoUrl}
          alt={`${teamName} Logo`}
          width={40}
          height={40}
          loading="lazy"
          fetchPriority="low"
          fallback={
            <span className="foundation-team-portrait-logo foundation-team-portrait-logo-placeholder" aria-label={`${teamName} Logo Platzhalter`}>
              {logoInitials}
            </span>
          }
        />
        <div className="foundation-team-portrait-identity">
          <strong className="foundation-team-portrait-name">{teamName}</strong>
          {shortCode ? <span className="foundation-team-portrait-shortcode">{shortCode}</span> : null}
        </div>
      </div>

      {rosterSize != null ? (
        <div className="foundation-team-portrait-roster-line">
          <span>Kader:</span> <strong>{rosterSize}</strong>
        </div>
      ) : null}

      {hasRanks ? (
        <div className="team-drawer-rank-grid foundation-team-portrait-rank-grid">
          <article className="team-drawer-rank-card is-power">
            <span>POW</span>
            <strong>{formatRank(powRank)}</strong>
          </article>
          <article className="team-drawer-rank-card is-speed">
            <span>SPE</span>
            <strong>{formatRank(speRank)}</strong>
          </article>
          <article className="team-drawer-rank-card is-mental">
            <span>MEN</span>
            <strong>{formatRank(menRank)}</strong>
          </article>
          <article className="team-drawer-rank-card is-social">
            <span>SOC</span>
            <strong>{formatRank(socRank)}</strong>
          </article>
        </div>
      ) : null}

      {hasEconomy ? (
        <div className="foundation-team-portrait-economy">
          <span>
            <small>Marktwert</small>
            <strong>{marketValueTotal != null ? formatMoney(marketValueTotal) : "—"}</strong>
          </span>
          <span>
            <small>Gehalt</small>
            <strong>{salaryTotal != null ? formatMoney(salaryTotal) : "—"}</strong>
          </span>
          <span>
            <small>Cash</small>
            <strong>{cash != null ? formatMoney(cash) : "—"}</strong>
          </span>
        </div>
      ) : null}

      {generalManagerName ? (
        <div className="foundation-team-portrait-gm-line">
          <span>GM:</span> <strong>{generalManagerName}</strong>
          {boardConfidence != null ? <em>Board {boardConfidence}</em> : null}
        </div>
      ) : null}
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        className={cardClassName}
        style={style}
        onClick={() => onOpen?.()}
        title={`${teamName} öffnen`}
        data-testid="foundation-team-portrait-card"
        data-team-id={teamId}
      >
        {cardBody}
      </button>
    );
  }

  return (
    <div className={cardClassName} style={style} data-testid="foundation-team-portrait-card" data-team-id={teamId}>
      {cardBody}
    </div>
  );
}
