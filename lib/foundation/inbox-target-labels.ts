/**
 * GEMELDET AUS DEM SPIEL: In der Inbox steht wörtlich „Springe zu trainingV2." und „Springe zu
 * teams." — der Spieler liest interne Routen-Bezeichner.
 *
 * Ursache war eine Textzeile in `inbox-quick-action-service.ts`, die `item.targetView` direkt in
 * einen Satz einsetzt. Der Bezeichner ist aber ein Programm-Detail: `trainingV2` heißt in der
 * Navigation „Gebäude", `trainingCompact` heißt „Training", `marketV2` heißt „Transfermarkt".
 *
 * Diese Datei ist die EINE Stelle, die aus einem Ziel einen Namen macht, den ein Mensch lesen kann.
 * Die Namen kommen dabei nicht aus einer neuen Liste, sondern aus `FOUNDATION_NAV_GROUPS` — der
 * Quelle, aus der auch die Reiter beschriftet werden. Damit kann die Inbox gar nicht anders heißen
 * als der Reiter, auf dem man landet; ein umbenannter Reiter zieht die Inbox automatisch mit.
 *
 * Was NICHT hierher gehört: eine Entscheidung darüber, WOHIN ein Eintrag zeigt. Das steht im
 * `game-inbox-service`. Hier wird ein bestehendes Ziel nur benannt.
 */
import { FOUNDATION_NAV_GROUPS } from "@/lib/foundation/foundation-nav-config";
import { normalizeFoundationViewParam, type FoundationViewId } from "@/lib/foundation/foundation-view-routing";

/** Nav-Label je View-Id, aus den Nav-Gruppen aufgebaut (keine zweite Namensliste). */
const NAV_LABEL_BY_VIEW: Record<string, string> = Object.fromEntries(
  FOUNDATION_NAV_GROUPS.flatMap((group) => group.items.map((item) => [item.id, item.label] as const)),
);

/**
 * Ziele, die keinen eigenen Reiter haben, aber sehr wohl erreichbar sind (eigener Render-Zweig oder
 * über einen anderen Weg). Ohne diese Zeilen fiele die Beschriftung auf den Bezeichner zurück —
 * also genau auf das gemeldete Problem.
 */
const EXTRA_VIEW_LABELS: Record<string, string> = {
  cockpit: "Cockpit",
  matchdayResult: "Spieltagsergebnis",
  disciplineStage: "Disziplin-Bühne",
  seasonPreview: "Saisonvorschau",
  playerProfile: "Spielerprofil",
  teamProfile: "Teamprofil",
  facilitiesOverviewV2: "Gebäude-Übersicht",
  admin: "Verwaltung",
  debug: "Debug",
};

/**
 * Panels, die innerhalb ihres Reiters einen eigenen Namen tragen. Sie beantworten die Frage „wo
 * genau auf der Seite?" und machen aus „→ Teams" ein „→ Teams · Verträge".
 */
const PANEL_LABELS: Record<string, string> = {
  "arena-result-summary": "Ergebnis",
  "board-objectives": "Board-Ziele",
  "captain-picker": "Kapitän",
  contracts: "Verträge",
  facilities: "Gebäude",
  formcards: "Formkarten",
  roster: "Kader",
  "season-end-development": "Entwicklung",
  "season-review": "Saisonrückblick",
  "sponsor-choice": "Sponsor",
  "training-plan": "Trainingsplan",
};

export type InboxTargetLike = {
  targetView: string;
  targetParams?: Record<string, string | number | boolean | null> | null;
};

/** Der Reiter-Name allein, ohne Panel-Zusatz. */
export function resolveInboxTargetViewLabel(targetView: string | null | undefined): string | null {
  if (!targetView) return null;
  // Aliase (`market` → `marketV2`, `season` → `seasonV2`, …) zuerst auflösen, sonst fände ein
  // gültiges Ziel seinen eigenen Reiter nicht.
  const normalized: FoundationViewId | null = normalizeFoundationViewParam(targetView);
  const key = normalized ?? targetView;
  return NAV_LABEL_BY_VIEW[key] ?? EXTRA_VIEW_LABELS[key] ?? null;
}

/**
 * Vollständige Zielbeschriftung: „Einsatzliste", „Teams · Verträge", „Arena · Ergebnis".
 *
 * Gibt `null` zurück, wenn das Ziel unbekannt ist — bewusst kein Rückfall auf den Bezeichner. Ein
 * unbekanntes Ziel soll gar nicht beschriftet werden statt falsch; der Aufrufer lässt den Chip dann
 * weg. So kann der gemeldete Text („Springe zu trainingV2.") auf keinem Weg zurückkehren.
 */
export function resolveInboxTargetLabel(target: InboxTargetLike): string | null {
  const viewLabel = resolveInboxTargetViewLabel(target.targetView);
  if (!viewLabel) return null;

  const panel = target.targetParams?.panel;
  const panelLabel = typeof panel === "string" ? PANEL_LABELS[panel] : undefined;
  // „Gebäude · Gebäude" wäre albern: Panel-Namen, die den Reiter nur wiederholen, entfallen.
  if (!panelLabel || panelLabel === viewLabel) return viewLabel;
  return `${viewLabel} · ${panelLabel}`;
}

/** Text für die Quick-Action-Zeile. Ersetzt „Springe zu ${targetView}.". */
export function describeInboxTargetDestination(target: InboxTargetLike): string {
  const label = resolveInboxTargetLabel(target);
  return label ? `Öffnet: ${label}` : "Öffnet die zugehörige Seite.";
}
