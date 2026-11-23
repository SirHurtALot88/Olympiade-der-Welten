import type { ReactNode } from "react";

import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";

/**
 * Symbole der Icon-Schiene: dieselbe Sprache wie `components/foundation/broadcast/BcIcon.tsx` und
 * die Vorlage `public/mockups/einsatzliste-modern-17-11.html` (24er-Raster, eine Strichstärke,
 * `currentColor`). Neun Pfade stammen 1:1 aus dem Mockup (Home, Inbox, Einsatzliste, Arena,
 * Saisonstand, Teams, Training, Transfermarkt, Scouting, Finanzen), der Rest ist im selben Strich
 * nachgezeichnet. Fehlt ein Eintrag, fällt die Schiene auf das Unicode-Zeichen aus
 * `foundation-nav-config.ts` zurück — ein Ziel bleibt also nie ohne Symbol.
 */
const PFADE: Partial<Record<FoundationViewId, ReactNode>> = {
  homeV2: (
    <>
      <path d="M3 11l9-7 9 7v9H3z" />
      <path d="M9 20v-6h6v6" />
    </>
  ),
  inboxV2: (
    <>
      <path d="M3 6h18v12H3z" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  lineup: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  matchdayArena: <path d="M4 20L20 4M14 4h6v6M4 4l16 16M4 10V4h6" />,
  seasonV2: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  battleArena: <path d="M6 21V4M6 5h11l-2.5 3.5L17 12H6" />,
  teams: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 20c0-4 3-6 7-6s7 2 7 6" />
      <circle cx="18" cy="9" r="2.5" />
      <path d="M17 14c3 0 5 2 5 5" />
    </>
  ),
  players: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.5 3.5-7 8-7s8 2.5 8 7" />
    </>
  ),
  trainingCompact: <path d="M3 9v6M6 6v12M18 6v12M21 9v6M6 12h12" />,
  trainingV2: (
    <>
      <path d="M4 21V9l8-5 8 5v12" />
      <path d="M9 21v-6h6v6M2 21h20" />
    </>
  ),
  allTimeTable: <path d="M3 18h18l1-10-5 4-5-7-5 7-5-4z" />,
  marketV2: <path d="M4 8h14l-3-3M20 16H6l3 3" />,
  scoutingCenterV2: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M16 16l5 5" />
    </>
  ),
  seasonArchive: (
    <>
      <path d="M4 12a8 8 0 108-8 8 8 0 00-6 2.7" />
      <path d="M4 4v4h4M12 8v4l3 2" />
    </>
  ),
  credits: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18M7 15h4" />
    </>
  ),
  finances: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9c-1-1.5-5-1.5-5 .8 0 2.6 5 1.4 5 4.2 0 2.2-4.2 2.2-5.4.4M12 6v12" />
    </>
  ),
  // Ausruestung (22.11.): ein Schild mit Kreuzband, im Strich der uebrigen Symbole.
  marketing: (
    <>
      <path d="M3 10v4h4l8 5V5L7 10z" />
      <path d="M18 9c1.5 1 1.5 5 0 6" />
    </>
  ),
  ausruestung: (
    <>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
      <path d="M12 8v8M8.5 11.5h7" />
    </>
  ),
  ranks: <path d="M5 21V12h4v9M10 21V5h4v16M15 21v-7h4v7M3 21h18" />,
  diszis: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  leagueLeaders: <path d="M7 4h10v5a5 5 0 01-10 0zM7 6H3v2a3 3 0 004 3M17 6h4v2a3 3 0 01-4 3M12 14v4M8 21h8M9 18h6" />,
  prize: (
    <>
      <path d="M4 9h16v11H4zM2 6h20v3H2z" />
      <path d="M12 6v14M12 6c-1-3-5-3-5 0M12 6c1-3 5-3 5 0" />
    </>
  ),
  encyclopedia: (
    <>
      <path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3z" />
      <path d="M9 9h6M9 13h4" />
    </>
  ),
  generator: <path d="M12 5v14M5 12h14" />,
  teamSettings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
    </>
  ),
  changelog: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l3 3 5-6" />
    </>
  ),
};

export function FoundationRailIcon({ viewId, fallback }: { viewId: FoundationViewId; fallback?: string }) {
  const pfad = PFADE[viewId];
  if (!pfad) return fallback ? <span className="foundation-rail-glyph">{fallback}</span> : null;
  return (
    <svg className="foundation-rail-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {pfad}
    </svg>
  );
}
