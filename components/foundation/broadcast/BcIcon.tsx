import type { ReactElement } from "react";

/**
 * Symbole des Broadcast-Stils: eine Strichstärke, `currentColor`, 24er-Raster. Inline-SVG statt
 * Symbol-Sprite, damit jede Seite die Bausteine ohne ein gemeinsames Dokument-Fragment nutzen kann.
 * Quelle der Pfade: Prototyp public/mockups/einsatzliste-modern-17-11.html.
 */
const PFADE = {
  liste: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  links: <path d="M15 5l-7 7 7 7" />,
  rechts: <path d="M9 5l7 7-7 7" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  zurueck: (
    <>
      <path d="M9 7L4 12l5 5" />
      <path d="M4 12h10a6 6 0 010 12" />
    </>
  ),
  zauber: <path d="M5 19L16 8M14 4l1 3 3 1-3 1-1 3-1-3-3-1 3-1zM19 13l.7 1.8L21.5 15.5l-1.8.7L19 18l-.7-1.8-1.8-.7 1.8-.7z" />,
  karte: (
    <>
      <rect x="6" y="3" width="12" height="18" rx="2" />
      <path d="M12 8l2 4-2 4-2-4z" />
    </>
  ),
  krone: <path d="M3 18h18l1-10-5 4-5-7-5 7-5-4z" />,
  bank: (
    <>
      <path d="M3 10l9-6 9 6z" />
      <path d="M5.5 10v7M10 10v7M14 10v7M18.5 10v7M3 20h18" />
    </>
  ),
  auf2: <path d="M6 12l6-6 6 6M6 18l6-6 6 6" />,
  auf: <path d="M6 15l6-6 6 6" />,
  gleich: <path d="M6 12h12" />,
  ab: <path d="M6 9l6 6 6-6" />,
  ab2: <path d="M6 6l6 6 6-6M6 12l6 6 6-6" />,
  kreuz: <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" />,
  check: <path d="M5 12l5 5 9-10" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.5" />
    </>
  ),
  team: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 20c0-4 3-6 7-6s7 2 7 6" />
      <circle cx="18" cy="9" r="2.5" />
      <path d="M17 14c3 0 5 2 5 5" />
    </>
  ),
  suche: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M16 16l5 5" />
    </>
  ),
  arena: <path d="M4 20L20 4M14 4h6v6M4 4l16 16M4 10V4h6" />,
  blitz: <path d="M13 2L5 14h6l-1 8 9-13h-6z" />,
  zahnrad: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
    </>
  ),
} satisfies Record<string, ReactElement>;

export type BcIconName = keyof typeof PFADE;

export function BcIcon({ name, className }: { name: BcIconName; className?: string }) {
  return (
    <svg className={`bc-icon${className ? ` ${className}` : ""}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {PFADE[name]}
    </svg>
  );
}
