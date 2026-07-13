"use client";

import { useMemo } from "react";

import type { GameState } from "@/lib/data/olyDataTypes";
import type { CreditsViewModel } from "@/lib/foundation/credits/credits-types";

/**
 * Builds the Credits view model for one human team.
 *
 * Fog of war: this must only ever be called with the ACTIVE MANAGER's own
 * team id (`activeManagerTeamId`, same id used by other "own team finances"
 * views like Sponsoren). Never pass another team's id in here — the credit
 * system is not league-visible data.
 *
 * === SEAM: parallel credit system connects HERE ===
 * This is currently a stub that always returns `{ status: "not_ready" }` so
 * the "Kredite" tab can be scaffolded, wired into navigation, and reviewed
 * before the real credit game-system (interest math, eligibility, cash
 * mutations) lands.
 *
 * To go live, replace the body of this function so it reads the real credit
 * state — e.g. from `gameState.seasonState` (once a `teamCredits` /
 * `creditContractsByTeamId` slice exists there) or from a dedicated credit
 * service — and returns:
 *
 *   { status: "ready", team: TeamCreditState }
 *
 * No other file needs to change: `FoundationCreditsHost` calls this function
 * (via `useCreditsViewModel` below) and passes the resulting model straight
 * through to `FoundationCreditsNewLook`, which already renders both the
 * `"not_ready"` placeholder and the real `"ready"` shape (KPIs, active-loan
 * table, offer cards).
 */
export function buildCreditsViewModel(gameState: GameState, teamId: string | null): CreditsViewModel {
  if (!teamId) {
    return { status: "not_ready" };
  }

  // Referenced only to keep the stub's signature stable for the real
  // implementation — remove once real reads land here.
  void gameState;

  return { status: "not_ready" };
}

/**
 * React hook wrapper around `buildCreditsViewModel`. Hosts should prefer
 * this over calling the builder directly so the model is memoized per
 * render the same way other Foundation view models are.
 */
export function useCreditsViewModel(gameState: GameState, teamId: string | null): CreditsViewModel {
  // NOTE for the parallel team: once `buildCreditsViewModel` reads real
  // slices off `gameState` (e.g. `gameState.seasonState.teamCredits`),
  // narrow this dependency to that slice instead of the whole `gameState`
  // object so the memo doesn't recompute on every unrelated state change.
  return useMemo(() => buildCreditsViewModel(gameState, teamId), [gameState, teamId]);
}

/**
 * Stub action handler for taking out a loan. No-op until the parallel
 * credit system exists — swap the Host's `onTakeLoan` prop for the real
 * handler (e.g. a call into the credit service / an API route) to go live.
 */
export function stubOnTakeLoan(offerId: string): void {
  // TODO(credits): wire to parallel credit service
  void offerId;
}

/**
 * Stub action handler for repaying (part of) an active loan. No-op until
 * the parallel credit system exists — swap the Host's `onRepayLoan` prop
 * for the real handler to go live.
 */
export function stubOnRepayLoan(loanId: string): void {
  // TODO(credits): wire to parallel credit service
  void loanId;
}
