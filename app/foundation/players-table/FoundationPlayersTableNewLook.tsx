"use client";

/**
 * "Neuer Look" Spieler-Verzeichnis (flag-gated, additiv).
 *
 * Wird nur gerendert, wenn der Runtime-Flag (`useNewLook`) aktiv ist —
 * `FoundationShellRouterBody` fällt ohne Flag unverändert auf die bestehende
 * Players-Tabelle zurück. Konsumiert exakt dieselben Daten wie die alte
 * Ansicht (`sortedPlayersTableRows` + Filter-State aus dem Shell-Scope);
 * es wird nichts erfunden.
 *
 * Erhalten bleiben alle Funktionen der alten Tabelle:
 * - Scope- (Aktive/Free Agents/Alle), Team- und Klassen-Filter,
 * - jede Sortier-Spalte (gleiche `dataKey`s über `toggleTableSort`),
 * - alle Datenspalten (Bild, Name, Team, Klasse, Rasse, PPs, OVR, MVS,
 *   MW, Gehalt, Vertrag, Einsätze, Beste Diszi, Alltime, Traits),
 * - Zeilen-/Namensklick öffnet den Spieler-Drawer, Teamklick das Teamprofil,
 * - liga-relative Heat-Färbung (PPs/OVR/MVS) und die Bracket-Verteilung.
 *
 * Stat-Junkie-Zusätze (nur reale Daten aus denselben Props):
 * - Kader-/Liga-Summary im Header (Ø OVR, Ø MW, Gehaltssumme),
 * - Leader-Chips (Top OVR/PPs/MVS/MW) als Portale in den Spieler-Drawer,
 *   inkl. ligaweitem Rang aus den Heat-Pools,
 * - POW/SPE/MEN/SOC pro Zeile als getönte Achsen-Mini-Bars,
 * - MW-/Gehalts-Entwicklung als Delta-Chips (Baseline-Vergleich),
 * - Alltime-Spalte (Saisons · Einsätze · PPs über alle Saisons).
 *
 * Bewusst weggelassen, weil es dafür keine echten Daten in den Props gibt:
 * kein Pro-Saison-Sparkline je Spieler (OVR-/MW-Historie pro Saison existiert
 * nur im Spieler-Drawer über `historyRows`, nicht in den Tabellen-Rows).
 *
 * Weitere Zusätze:
 * - Schnäppchen-Radar (Analyse-Hub, `FoundationPlayersScatterCard.tsx`): ein
 *   Streudiagramm-Kärtchen aus OVR/PPs × MW/Gehalt über dieselben Hub-`rows`,
 *   eigenes Team hervorgehoben, Klick öffnet den Spieler-Drawer.
 * - MW-Bracket-Histogramm ist jetzt klickbar (`selectedMwBracket`, rein
 *   client-seitiges Prädikat auf `rows`, kein neuer Shell-State) — filtert die
 *   Spielerliste im Verzeichnis auf den angeklickten Bracket, erneuter Klick
 *   hebt den Filter wieder auf.
 * - Wishlist-Stern je Zeile: Lesezugriff auf die im `gameState`-Prop bereits
 *   vorhandene Transfermarkt-Wishlist des eigenen Teams
 *   (`gameState.seasonState.transferWishlist`, via `getTeamTransferWishlistEntries`)
 *   PLUS Schreibpfad (P1, #3): der Stern ist jetzt ein interaktiver Toggle
 *   (`aria-pressed`, Tastatur, ☆/★). Er reicht denselben Shell-Handler durch, den
 *   auch der Transfermarkt nutzt — `toggleTransferWishlist` in
 *   `use-foundation-shell-router-body-scope.tsx`, hier als playerId-Variante
 *   `toggleTransferWishlistByPlayerId` über den optionalen `onToggleWishlist`-Prop
 *   (aus `FoundationShellRouterBody.tsx` durchgereicht). Fehlt der Callback,
 *   bleibt der Stern read-only wie in Phase 0.
 *
 * Weitere Zusätze (UI/UX-Upgrades):
 * - Leader-Podium (`FoundationPlayersLeaderPodium.tsx`): Seiten-Hero, klassisches
 *   1-2-3-Podest der Top-3 nach OVR/PPs/MVS über dieselben (Umfang-/Team-/
 *   Klassen-gefilterten) `rows` wie der Rest der Seite.
 * - Kader-Ridgeline (`FoundationPlayersSquadRidgeline.tsx`, Analyse-Hub neben
 *   dem Schnäppchen-Radar): handgerolltes SVG-Joyplot der POW/SPE/MEN/SOC-
 *   Verteilung der aktuellen Hub-Auswahl (gebucketet, kein Knoten je Spieler).
 * - Hover-Steckbrief: Namens-Zelle triggert jetzt denselben reichen
 *   `FoundationPlayerPortraitPreview`-Hover wie die Bild-Zelle (eine
 *   gemeinsame Props-Instanz je Zeile, `subMeta` zeigt zusätzlich Klasse/Rasse).
 *
 * Styles: `app/globals.css` unter `.is-new-look .nl-players-*` /
 * `.is-new-look .nl-phub-scatter-*` / `.is-new-look .nl-podium-*` /
 * `.is-new-look .nl-ridge-*`.
 */

import { useEffect, useMemo, useState } from "react";

import ClassIcon from "@/app/foundation/ClassIcon";
import DisciplineIcon from "@/app/foundation/DisciplineIcon";
import RaceIcon from "@/app/foundation/RaceIcon";
import {
  formatContractShapeLabel,
  formatContractShapeShortLabel,
  rosterSalariesDifferForDisplay,
} from "@/lib/foundation/player-economy-contract";
import {
  formatLocalePoints,
  formatPpsValue,
  formatWholeNumber,
  getPlayerDisplayMarketValue,
  getPlayerDisplayMarketValueDelta,
  getPlayerDisplaySalary,
  getPlayerPortraitModel,
  getPoolHeatClass,
  getRosterEntryCurrentSeasonSalary,
  getRosterEntryDisplaySalary,
  getRosterEntrySalaryDelta,
  getTeamLogoModel,
  getTeamTransferWishlistEntries,
  type PlayerTableScope,
} from "@/app/foundation/foundation-page-client-exports";
import BudgetedMediaImage from "@/components/foundation/BudgetedMediaImage";
import {
  NlBarChart,
  NlCard,
  NlDeltaChip,
  NlEmptyState,
  NlMedalBadge,
  NlRankingDrawer,
  NlSubTabs,
  StatChip,
  StatChipRow,
  formatNlMoney,
  formatNlNumber,
  nlToneClass,
  NL_TONE_VAR,
  useCountUp,
  type NlAxisKey,
  type NlRankingDrawerRow,
  type NlTone,
} from "@/components/foundation/new-look";
import { NlAbilityStars } from "@/components/foundation/velo-ui/NlAbilityStars";
import FoundationPlayerPortraitPreview, {
  type FoundationPlayerPortraitPreviewProps,
} from "@/components/foundation/player-portrait-card/FoundationPlayerPortraitPreview";
import type { GameState, Team } from "@/lib/data/olyDataTypes";
import type { SortState } from "@/lib/foundation/foundation-table-ui-types";
import {
  formatLeaguePercentile,
  getMetricBarPercent,
  getPoolHeatTone,
  type LeaguePlayerHeatPools,
} from "@/lib/foundation/player-league-heat";
import {
  buildDisciplineSortKey,
  getDisciplineIdFromSortKey,
  type FoundationPlayerScopeRow,
} from "@/lib/foundation/tabs/use-foundation-cross-tab-player-directory";
import { getTransfermarktBracket } from "@/lib/market/transfermarkt-fit";
import { potentialScoreToStars } from "@/lib/progression/player-potential-service";
import { computeCurrentAbilityScore } from "@/lib/scouting/current-ability-score";

import FoundationPlayersCompareOverlay from "@/app/foundation/players-table/FoundationPlayersCompareOverlay";
import { getFoggedPoScoreRange } from "@/app/foundation/players-table/foundation-players-fog-of-war";
import { DEBUG_FORCE_PLAYER_VISIBILITY } from "@/lib/foundation/debug-player-visibility";
import {
  getActiveSaveIdFromLocation,
  rowMatchesQueryChips,
  type QueryChip,
} from "@/app/foundation/players-table/foundation-players-query-chips";
import {
  NL_PLAYERS_COLUMN_PRESETS,
  NL_PLAYERS_DEFAULT_PRESET_ID,
  NL_PLAYERS_HIDEABLE_COLUMN_IDS,
  NL_PLAYERS_STRUCTURAL_COLUMN_IDS,
  readColumnPreferences,
  resolvePresetVisibility,
  writeColumnPreferences,
  type NlPlayersColumnPresetId,
  type NlPlayersColumnVisibility,
} from "@/app/foundation/players-table/foundation-players-column-presets";
import FoundationPlayersLeaderPodium from "@/app/foundation/players-table/FoundationPlayersLeaderPodium";
import FoundationPlayersQueryChipsBar from "@/app/foundation/players-table/FoundationPlayersQueryChipsBar";
import FoundationPlayersScatterCard from "@/app/foundation/players-table/FoundationPlayersScatterCard";
import FoundationPlayersSquadRidgeline from "@/app/foundation/players-table/FoundationPlayersSquadRidgeline";

export type FoundationPlayersTableNewLookProps = {
  /** Bereits nach `tableSorts.playersTable` sortierte, gefilterte Zeilen. */
  rows: FoundationPlayerScopeRow[];
  gameState: GameState;
  leaguePlayerHeatPools: LeaguePlayerHeatPools;
  sortState: SortState | undefined;
  /** Host-Wrapper um `toggleTableSort("playersTable", columnKey)`. */
  onToggleSort: (columnKey: string) => void;
  playerScope: PlayerTableScope;
  onChangeScope: (scope: PlayerTableScope) => void;
  teams: Team[];
  playerTeamFilter: string;
  onChangeTeamFilter: (teamId: string) => void;
  playerClassFilter: string;
  playerClassOptions: string[];
  onChangeClassFilter: (className: string) => void;
  playerBracketCounts: Record<number, number>;
  openPlayerDrawerById: (playerId: string, rosterId?: string | null) => void;
  openTeamProfileById: (teamId: string) => void;
  /**
   * Wishlist-Schreibpfad (P1, #3): schaltet einen Spieler auf/von der
   * Transfermarkt-Merkliste des eigenen Teams. Reicht denselben Shell-Handler
   * durch, den auch der Transfermarkt nutzt (`toggleTransferWishlist`, hier als
   * playerId-Variante `toggleTransferWishlistByPlayerId` aus dem Shell-Scope).
   * Optional: fehlt der Callback (z. B. alte Aufrufer), bleibt der Stern
   * read-only wie in Phase 0.
   */
  onToggleWishlist?: (playerId: string) => void;
};

const NL_PLAYERS_SCOPE_ITEMS: Array<{ id: PlayerTableScope; label: string }> = [
  { id: "active", label: "Aktive Spieler" },
  { id: "free_agents", label: "Free Agents" },
  { id: "all", label: "Alle Spieler" },
];

/** Verzeichnis (bestehende Tabelle) vs. Analyse-Hub (#47, additiv). */
type NlPlayersView = "directory" | "hub";

const NL_PLAYERS_VIEW_ITEMS: Array<{ id: NlPlayersView; label: string }> = [
  { id: "directory", label: "Verzeichnis" },
  { id: "hub", label: "Analyse-Hub" },
];

/**
 * Kennzahlenkatalog des Hub-Leaderboards (#47). `pool` verweist auf den
 * passenden `LeaguePlayerHeatPools`-Schlüssel für den echten ligaweiten Rang
 * (nicht nur Rang innerhalb der aktuellen Auswahl) — MW hat keinen Heat-Pool,
 * dort bleibt der Perzentil-Chip leer statt erfunden.
 */
// NOTE: no "potential" metric here on purpose — a league-wide (all-teams) PO leaderboard
// would leak other teams' hidden potential (fog of war). PO is only ever surfaced as a
// fuzzy star RANGE for non-owned players (see NlAbilityStars), never as a rankable number.
type NlPhubMetricKey = "ovr" | "pps" | "mvs" | "mw" | "pow" | "spe" | "men" | "soc";

const NL_PHUB_METRICS: ReadonlyArray<{
  key: NlPhubMetricKey;
  label: string;
  tone: NlTone;
  digits: number;
  pool?: Exclude<keyof LeaguePlayerHeatPools, "disciplines">;
}> = [
  { key: "ovr", label: "OVR", tone: "accent", digits: 1, pool: "ovr" },
  { key: "pps", label: "PPs", tone: "spe", digits: 1, pool: "pps" },
  { key: "mvs", label: "MVS", tone: "soc", digits: 1, pool: "mvs" },
  { key: "mw", label: "Marktwert", tone: "neutral", digits: 2 },
  { key: "pow", label: "POW", tone: "pow", digits: 0, pool: "pow" },
  { key: "spe", label: "SPE", tone: "spe", digits: 0, pool: "spe" },
  { key: "men", label: "MEN", tone: "men", digits: 0, pool: "men" },
  { key: "soc", label: "SOC", tone: "soc", digits: 0, pool: "soc" },
];

/** Rohwert einer Hub-Kennzahl für eine Zeile — `null`, wenn nicht bekannt (keine Erfindung). */
function getPhubMetricValue(row: FoundationPlayerScopeRow, metric: NlPhubMetricKey): number | null {
  switch (metric) {
    case "ovr":
      return row.playerOvr;
    case "pps":
      return row.playerPps;
    case "mvs":
      return row.playerMvs;
    case "mw":
      return getPlayerDisplayMarketValue(row.player);
    case "pow":
    case "spe":
    case "men":
    case "soc":
      return row.player.coreStats[metric] ?? null;
    default:
      return null;
  }
}

function formatPhubMetricValue(value: number | null, metric: { key: NlPhubMetricKey; digits: number }): string {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  if (metric.key === "mw") {
    // Marktwert über den geteilten Geld-Formatter (Einheit " Mio"), damit die
    // Hub-Kacheln/Rangliste dieselbe Konvention wie der Rest der App tragen.
    return formatNlMoney(value);
  }
  return formatNlNumber(value, metric.digits);
}

/** Gleiche MW-Brackets wie die alte Bracket-Leiste (Transfermarkt-Logik). */
const NL_PLAYERS_BRACKETS: ReadonlyArray<{ bracket: number; range: string }> = [
  { bracket: 1, range: "<12.5M" },
  { bracket: 2, range: "12.5–17.5M" },
  { bracket: 3, range: "17.5–22.5M" },
  { bracket: 4, range: "22.5–30M" },
  { bracket: 5, range: "30–37.5M" },
  { bracket: 6, range: "37.5–45M" },
  { bracket: 7, range: "45–55M" },
  { bracket: 8, range: "55–70M" },
  { bracket: 9, range: "70M+" },
];

/**
 * Vertragsauslauf-Radar (additiv): Buckets nach verbleibenden Vertragsjahren
 * (`RosterEntry.contractLength`). "Diese Saison" spiegelt exakt dieselbe
 * Schwelle wie der bestehende "Verträge"-Fokus-Filter im Teams-Roster
 * (`contractLength <= 1`, siehe `use-teams-roster-table-derivations.ts`) —
 * ein Vertrag mit einem verbleibenden Jahr läuft am Ende dieser Saison aus.
 * Free Agents (kein `roster`) haben keinen Vertrag und fließen nicht ein.
 */
type NlContractExpiryBucket = "current" | "plus1" | "plus2" | "later";

const NL_PLAYERS_EXPIRY_BUCKETS: ReadonlyArray<{ id: NlContractExpiryBucket; label: string }> = [
  { id: "current", label: "Diese Saison" },
  { id: "plus1", label: "+1 Saison" },
  { id: "plus2", label: "+2 Saisons" },
  { id: "later", label: "Später" },
];

function getContractExpiryBucket(row: FoundationPlayerScopeRow): NlContractExpiryBucket | null {
  const length = row.roster?.contractLength;
  if (length == null || !Number.isFinite(length)) {
    return null;
  }
  if (length <= 1) {
    return "current";
  }
  if (length === 2) {
    return "plus1";
  }
  if (length === 3) {
    return "plus2";
  }
  return "later";
}

const NL_PLAYERS_AXES: ReadonlyArray<{ key: NlAxisKey; label: string }> = [
  { key: "pow", label: "POW" },
  { key: "spe", label: "SPE" },
  { key: "men", label: "MEN" },
  { key: "soc", label: "SOC" },
];

/** Spaltenkatalog — `sortKey` entspricht exakt den alten `dataKey`s. */
const NL_PLAYERS_COLUMNS: ReadonlyArray<{
  id: string;
  label: string;
  sortKey?: string;
  align?: "left" | "right" | "center";
  tooltip?: string;
  /**
   * Primäre/sekundäre Spalten-Betonung (Akzent-Rahmen auf Kopf + Zellen).
   * PPs ist laut Produkt die wichtigste Kennzahl (wichtiger als OVR/MVS)
   * und bekommt die stärkste Betonung; OVR bleibt sekundär hervorgehoben.
   */
  highlight?: "primary" | "secondary";
}> = [
  {
    id: "compare",
    label: "Vgl.",
    align: "center",
    tooltip: "Für den Vergleich auswählen (max. 4 Spieler) — schaltet die \"Vergleichen\"-Kachel frei.",
  },
  { id: "image", label: "Bild", align: "left" },
  { id: "name", label: "Name", sortKey: "name", align: "left" },
  { id: "team", label: "Team", sortKey: "team", align: "left" },
  { id: "class", label: "Klasse", sortKey: "class", align: "center" },
  { id: "race", label: "Rasse", sortKey: "race", align: "center" },
  {
    id: "abilityStars",
    label: "CA/PO",
    align: "left",
    tooltip: "Fähigkeit (CA) und Potenzial (PO) als Sterne — Bereich, solange nicht vollständig bekannt.",
  },
  {
    id: "axes",
    label: "Achsen",
    align: "left",
    tooltip:
      "POW/SPE/MEN/SOC — liga-relative Achsenwerte (0–100), anklickbar zum Sortieren. Farben sind liga-relativ: jede Stufe ist ein Achtel des aktuellen Liga-Pools. Über \"Disziplinen\" lässt sich zusätzlich nach einer einzelnen Disziplin-Wertung sortieren.",
  },
  {
    id: "pps",
    label: "PPs",
    sortKey: "pps",
    align: "right",
    tooltip:
      "Performance-Punkte der Saison — wichtigste Leistungskennzahl (Zeile aufklappbar für die Aufschlüsselung). Farben sind liga-relativ (Achtel des Liga-Pools).",
    highlight: "primary",
  },
  {
    id: "ovr",
    label: "OVR",
    sortKey: "ovr",
    align: "right",
    tooltip: "Gesamtstärke (Overall) — Farben sind liga-relativ (Achtel des Liga-Pools).",
    highlight: "secondary",
  },
  {
    id: "mvs",
    label: "MVS",
    sortKey: "mvs",
    align: "right",
    tooltip: "Marktwert-Score — Farben sind liga-relativ (Achtel des Liga-Pools).",
  },
  { id: "mw", label: "MW", sortKey: "mw", align: "right", tooltip: "Marktwert" },
  { id: "salary", label: "Gehalt", sortKey: "salary", align: "right" },
  { id: "contract", label: "Vertrag", sortKey: "contract", align: "right" },
  { id: "appearances", label: "Einsätze", sortKey: "appearances", align: "right" },
  {
    id: "bestDiscipline",
    label: "Beste Diszi",
    sortKey: "bestDiscipline",
    align: "left",
    tooltip: "Beste Disziplin",
  },
  {
    id: "careerLeague",
    label: "Alltime",
    sortKey: "careerLeague",
    align: "right",
    tooltip: "Karriere-Bilanz (Saisons · Einsätze · PPs) — gesamte Liga-Einsätze und PPs über alle Saisons (Archiv + Live).",
  },
  { id: "traits", label: "Traits", sortKey: "traits", align: "left" },
];

/**
 * Trait-Chips (statt kommasepariertem Text): positive Traits im Good-Ton,
 * negative im Risk-Ton. Kompakt (leben in einer Tabellenzelle), Inline-Styles
 * über die vorhandenen Ton-Tokens (`NL_TONE_VAR`) — keine neue globals.css.
 * Rendert nichts, wenn der Spieler keine Traits hat (Fallback "—" übernimmt der Aufrufer).
 */
function renderTraitChips(traitsPositive: string[], traitsNegative: string[]) {
  const entries: Array<{ label: string; tone: "good" | "risk" }> = [
    ...traitsPositive.map((label) => ({ label, tone: "good" as const })),
    ...traitsNegative.map((label) => ({ label, tone: "risk" as const })),
  ];
  if (entries.length === 0) {
    return null;
  }
  return (
    <span style={{ display: "flex", flexWrap: "wrap", gap: "3px" }}>
      {entries.map((entry, index) => {
        const tone = NL_TONE_VAR[entry.tone];
        return (
          <span
            key={`${entry.tone}-${entry.label}-${index}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "1px 6px",
              borderRadius: "999px",
              lineHeight: 1.45,
              fontSize: "var(--nl-fs-xs)",
              fontWeight: 700,
              whiteSpace: "nowrap",
              border: `1px solid color-mix(in srgb, ${tone} 45%, transparent)`,
              background: `color-mix(in srgb, ${tone} 14%, transparent)`,
              color: `color-mix(in srgb, ${tone} 80%, var(--nl-ink))`,
            }}
          >
            {entry.label}
          </span>
        );
      })}
    </span>
  );
}

const NL_PLAYERS_PAGE_SIZE = 100;

/**
 * Perf (Spieler-Verzeichnis, first paint): das ERSTE Rendering zeigt weniger
 * Zeilen als der reguläre "Mehr anzeigen"-Schritt (`NL_PLAYERS_PAGE_SIZE`,
 * unverändert 100 — der Button bleibt "Mehr anzeigen (+100)"). Jede Zeile
 * trägt CA/PO-Sterne, 4 sortierbare Achsen-Buttons, Trait-Chips und einen
 * MW-Sparkline — bei ~2984 Spielern/Liga macht ein satter erster Commit mit
 * 100 Zeilen den Erstaufbau träge (siehe `NlAbilityStars` DOM-Perf-Notiz).
 * Klick auf "Mehr anzeigen" lädt weiterhin in vollen 100er-Schritten nach,
 * nur die ALLERERSTE Seite ist kleiner. Keine Feature-/Datenänderung — nur
 * wie viele Zeilen der allererste Commit ans DOM hängt.
 */
const NL_PLAYERS_INITIAL_PAGE_SIZE = 45;

/**
 * Obergrenze für den "Alle anzeigen"-Sprung (P1, #Alle-anzeigen-Jank). Bewusst
 * KEINE Virtualisierung: die Zeilen tragen aufklappbare PPs-Detailzeilen,
 * Vergleichs-Checkboxen, sortierbare Achsen-Buttons und Portrait-Hover-Anchor —
 * @tanstack/react-virtual mit absolut positionierten Zeilen würde die
 * <tr>/<td>-Semantik, das Aufklappen (variable Höhe), den Sticky-Kopf und den
 * Hover-Steckbrief brechen. Statt das zu riskieren bleibt die Pagination
 * erhalten; "Alle anzeigen" springt höchstens auf diese sichere Obergrenze und
 * die "+100"-Schaltfläche lädt bei Bedarf inkrementell weiter (kein Massen-
 * Render von ~400 interaktiven Zeilen auf einen Schlag).
 */
const NL_PLAYERS_ALLE_MAX = 300;

// Fog of war (verdecktes Potenzial fremder Spieler): siehe
// `getFoggedPoScoreRange` in `foundation-players-fog-of-war.ts` (geteilt mit
// `FoundationPlayersLeaderPodium.tsx`, daher in eine eigene Datei ausgelagert
// statt hier lokal definiert — vermeidet einen zirkulären Modul-Import).

/** Ligaweiter Rang eines Werts innerhalb eines Heat-Pools (1 = bester). */
function getLeagueRank(value: number | null | undefined, pool: number[]): number | null {
  if (value == null || !Number.isFinite(value) || pool.length === 0) {
    return null;
  }
  let higher = 0;
  for (const entry of pool) {
    if (entry > value) {
      higher += 1;
    }
  }
  return higher + 1;
}

/** Kompaktes "Top 8%" → "T8%" für enge Zellen (Achsen-Zeilen). Leitet nichts neu her — reine Textkürzung des `formatLeaguePercentile`-Labels. */
function formatCompactPercentile(label: string | null): string | null {
  return label ? label.replace(/^Top\s+/, "T") : null;
}

/** Liga-Perzentil-Chip (StatChip-Vokabular in Miniatur) — `null`, wenn kein valider Rang/Pool vorliegt (keine Erfindung). */
function renderMetricPercentileChip(value: number | null | undefined, pool: number[], compact = false) {
  const rank = getLeagueRank(value, pool);
  const label = formatLeaguePercentile(rank, pool.length);
  if (!label) {
    return null;
  }
  const tone = getPoolHeatTone(value, pool);
  const fullTitle = `Liga-Perzentil: ${label} (Rang #${rank} von ${pool.length})`;
  return (
    <span className={`nl-ptable-percentile ${nlToneClass(tone)}`} title={fullTitle}>
      {compact ? formatCompactPercentile(label) : label}
    </span>
  );
}

/**
 * Absoluter Liga-Rang-Chip ("#N") — ersetzt den Perzentil-Chip in der
 * OVR-Spalte (Produkt-Feedback: absoluter Rang ist griffiger als "Top X%").
 * `null`, wenn kein valider Rang/Pool vorliegt (keine Erfindung).
 *
 * Ton ist bewusst FEST (`.nl-ptable-ovr-rank`), NICHT mehr die
 * wertabhängige `getPoolHeatTone`-Ton-Klasse: OVR ist die Kopf-Kennzahl der
 * Tabelle und bekommt EINEN eigenen, von PPs/MVS abgesetzten Akzent statt
 * einer dritten überlagerten Farb-Ebene (Value-Heat-Zellenhintergrund +
 * Sortier-Highlight + ton-gefärbter Chip sahen zusammen wie zufälliger
 * Regenbogen aus). Seit #111 nutzt dieser feste Akzent `--nl-accent`
 * (dasselbe Blau-Vokabular wie PPs, nur schwächer) statt Amber/Gold — der
 * Chip-Text ist ein fester heller `--nl-ink`-Vordergrund statt Ton-auf-Ton,
 * damit er lesbar bleibt. Siehe die OVR-`<td>`-Zelle unten und die CSS
 * `.nl-ptable-ovr-cell` / `.nl-ptable-ovr-rank`.
 */
function renderMetricRankChip(value: number | null | undefined, pool: number[]) {
  const rank = getLeagueRank(value, pool);
  if (rank == null) {
    return null;
  }
  return (
    <span className="nl-ptable-percentile nl-ptable-ovr-rank" title={`Liga-Rang #${rank} von ${pool.length}`}>
      #{formatNlNumber(rank, 0)}
    </span>
  );
}

/**
 * Kleine Inline-SVG-UI-Icons statt ASCII-Glyphen (Sortier-Pfeile, Auf-/
 * Zuklapp-Chevron, Schließen). Bewusst dekorativ (`aria-hidden`, `currentColor`,
 * `1em`) — die Barrierefreiheit hängt weiter an den bestehenden Button-`aria-label`/
 * `title`s, das SVG ersetzt nur die visuelle Glyphe. Minimal & konsistent gehalten.
 */
function NlSortGlyph({ direction }: { direction: "none" | "asc" | "desc" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {direction !== "desc" ? <path d="M4 7l4-4 4 4" opacity={direction === "asc" ? 1 : 0.55} /> : null}
      {direction !== "asc" ? <path d="M4 9l4 4 4-4" opacity={direction === "desc" ? 1 : 0.55} /> : null}
    </svg>
  );
}

/** Auf-/Zuklapp-Chevron (▸ zu / ▾ auf) — ein Pfad, per Rotation umgeschaltet. */
function NlChevronGlyph({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: open ? "rotate(90deg)" : "none", transformOrigin: "center" }}
    >
      <path d="M6 4l4 4-4 4" />
    </svg>
  );
}

/** Schließen-Kreuz (×) als Icon. */
function NlCloseGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export default function FoundationPlayersTableNewLook({
  rows,
  gameState,
  leaguePlayerHeatPools,
  sortState,
  onToggleSort,
  playerScope,
  onChangeScope,
  teams,
  playerTeamFilter,
  onChangeTeamFilter,
  playerClassFilter,
  playerClassOptions,
  onChangeClassFilter,
  playerBracketCounts,
  openPlayerDrawerById,
  openTeamProfileById,
  onToggleWishlist,
}: FoundationPlayersTableNewLookProps) {
  const [visibleCount, setVisibleCount] = useState(NL_PLAYERS_INITIAL_PAGE_SIZE);
  /** Namenssuche im Verzeichnis (P1) — Substring, case-insensitiv, ganz vorn im Filter-Stack. */
  const [nameQuery, setNameQuery] = useState("");
  /** Welche Zeile ist gerade per PPs-Klick aufgeklappt (max. eine gleichzeitig). */
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);
  /** Verzeichnis (bestehende Tabelle) vs. ligaweiter Analyse-Hub (#47). */
  const [playersView, setPlayersView] = useState<NlPlayersView>("directory");
  /**
   * Aktiver MW-Bracket-Filter der Spielerliste (Klick auf einen Histogramm-Balken,
   * erneuter Klick auf denselben Balken hebt ihn wieder auf). Rein client-seitiges
   * Prädikat auf `rows` — kein neuer Shell-State/Prop nötig, da die Bracket-Logik
   * (`getTransfermarktBracket`) bereits dieselbe ist wie in `playerBracketCounts`.
   */
  const [selectedMwBracket, setSelectedMwBracket] = useState<number | null>(null);
  /**
   * Aktiver Vertragsauslauf-Bucket (Klick auf eine Bucket-Kachel im
   * Vertragsauslauf-Radar, erneuter Klick hebt ihn wieder auf). Gleiches
   * Muster wie `selectedMwBracket` — rein client-seitiges Prädikat auf `rows`.
   */
  const [selectedExpiryBucket, setSelectedExpiryBucket] = useState<NlContractExpiryBucket | null>(null);
  /** Query-Chips (Attribut/Operator/Wert), UND-kombiniert zusätzlich zu den bestehenden Filtern. */
  const [queryChips, setQueryChips] = useState<QueryChip[]>([]);
  /** Für den Vergleich ausgewählte Spieler-IDs (2–4), Reihenfolge = Auswahlreihenfolge. */
  const [comparePlayerIds, setComparePlayerIds] = useState<string[]>([]);
  const [compareOverlayOpen, setCompareOverlayOpen] = useState(false);
  /**
   * Disziplinen-Sortier-Picker der Achsen-Spaltenkopfzeile (additiv, #Diszi-Sort):
   * Auf-/zugeklappt über den "Disziplinen"-Umschalter im Achsen-Header. Der
   * eigentliche "welche Disziplin ist gerade sortiert"-Zustand lebt NICHT hier,
   * sondern wird direkt aus `sortState.key` abgeleitet (`activeDisciplineSortId`
   * unten) — so bleibt genau EINE Quelle der Wahrheit (der geteilte Sort-State),
   * der Picker ist nur die Sichtbarkeit des Auswahl-Controls.
   */
  const [disciplinePickerOpen, setDisciplinePickerOpen] = useState(false);
  /**
   * Spalten-Sichtbarkeit + aktives Saved View (Phase 3, FM-Stil). Init ist
   * deterministisch die Vorgabe "Alles" (alle Datenspalten sichtbar = bisheriges
   * Verhalten) — die tatsächlich gespeicherten Präferenzen werden erst per Mount-
   * Effekt aus localStorage nachgeladen (SSR-sicher, kein Hydration-Mismatch),
   * exakt wie der Query-Chip-Presets-Mount-Effekt im Chips-Builder.
   */
  const [columnVisibility, setColumnVisibility] = useState<NlPlayersColumnVisibility>(() =>
    resolvePresetVisibility(NL_PLAYERS_DEFAULT_PRESET_ID),
  );
  const [activeColumnPreset, setActiveColumnPreset] = useState<NlPlayersColumnPresetId>(NL_PLAYERS_DEFAULT_PRESET_ID);
  /** Auf-/zugeklapptes "Spalten"-Menü (Popover). */
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  /**
   * Rückmeldung nach "Liste kopieren"/"Als CSV exportieren" (T-105) — z. B.
   * "42 Spieler kopiert." oder ein Fehlertext, wenn die Zwischenablage
   * verweigert wird. Gleiches Muster wie `copySeed`/`message` in
   * `PlayerGeneratorPanelNewLook.tsx` (persistiert bis zur nächsten Aktion,
   * kein Timer nötig).
   */
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  // Gespeicherte Spalten-Präferenzen beim Mount nachladen (rein clientseitig).
  useEffect(() => {
    const stored = readColumnPreferences(getActiveSaveIdFromLocation());
    if (stored) {
      setColumnVisibility(stored.visibility);
      setActiveColumnPreset(stored.preset);
    }
  }, []);

  /** Ist eine Spalte sichtbar? Strukturspalten (Vgl./Bild/Name+Stern) immer, Datenspalten laut Karte. */
  function isColumnVisible(columnId: string): boolean {
    if (NL_PLAYERS_STRUCTURAL_COLUMN_IDS.includes(columnId)) {
      return true;
    }
    return columnVisibility[columnId] !== false;
  }

  /** Benanntes View anwenden (setzt Sichtbarkeit komplett) und persistieren. */
  function applyColumnPreset(presetId: NlPlayersColumnPresetId) {
    const visibility = resolvePresetVisibility(presetId);
    setColumnVisibility(visibility);
    setActiveColumnPreset(presetId);
    writeColumnPreferences(getActiveSaveIdFromLocation(), { preset: presetId, visibility });
  }

  /** Einzelne Datenspalte umschalten — löst das benannte View zu "custom" auf und persistiert. */
  function toggleColumnVisibility(columnId: string) {
    const next: NlPlayersColumnVisibility = { ...columnVisibility, [columnId]: columnVisibility[columnId] === false };
    setColumnVisibility(next);
    setActiveColumnPreset("custom");
    writeColumnPreferences(getActiveSaveIdFromLocation(), { preset: "custom", visibility: next });
  }

  /** Tatsächlich gerenderte Spalten (Struktur immer, Datenspalten laut Sichtbarkeit) — Kopf, Zellen und Detail-`colSpan` teilen sich diese Liste. */
  const visibleColumns = useMemo(
    () =>
      NL_PLAYERS_COLUMNS.filter(
        (column) =>
          NL_PLAYERS_STRUCTURAL_COLUMN_IDS.includes(column.id) || columnVisibility[column.id] !== false,
      ),
    [columnVisibility],
  );

  /** Aktuell sortierte Disziplin (`discipline:<id>`-Sortierschlüssel), falls aktiv. */
  const activeDisciplineSortId = useMemo(() => getDisciplineIdFromSortKey(sortState?.key), [sortState?.key]);
  const activeDisciplineSortName = useMemo(
    () => (activeDisciplineSortId ? gameState.disciplines.find((d) => d.id === activeDisciplineSortId)?.name ?? null : null),
    [activeDisciplineSortId, gameState.disciplines],
  );
  /** Alphabetisch sortierte Disziplin-Optionen für den Picker (gleiche Konvention wie `raceOptions` unten). */
  const disciplinePickerOptions = useMemo(
    () => [...gameState.disciplines].sort((left, right) => left.name.localeCompare(right.name)),
    [gameState.disciplines],
  );

  // Bei Filterwechsel wieder auf die erste "Seite" zurück.
  useEffect(() => {
    setVisibleCount(NL_PLAYERS_INITIAL_PAGE_SIZE);
    setExpandedPlayerId(null);
  }, [playerScope, playerTeamFilter, playerClassFilter, selectedMwBracket, selectedExpiryBucket, queryChips, nameQuery]);

  /**
   * Namenssuche (P1): case-insensitiver Substring auf den Spielernamen, ganz vorn
   * im Filter-Stack — die bestehende Bracket-/Vertrags-/Query-Chip-Pipeline
   * komponiert sich darauf und stackt (ersetzt nichts).
   */
  const nameFilteredRows = useMemo(() => {
    const query = nameQuery.trim().toLowerCase();
    if (!query) {
      return rows;
    }
    return rows.filter((row) => row.player.name.toLowerCase().includes(query));
  }, [rows, nameQuery]);

  /** Spielerliste, zusätzlich auf den angeklickten MW-Bracket eingeschränkt (falls aktiv). */
  const bracketFilteredRows = useMemo(() => {
    if (selectedMwBracket == null) {
      return nameFilteredRows;
    }
    return nameFilteredRows.filter(
      (row) => getTransfermarktBracket(getPlayerDisplayMarketValue(row.player)) === selectedMwBracket,
    );
  }, [nameFilteredRows, selectedMwBracket]);

  /** Zusätzlich auf den angeklickten Vertragsauslauf-Bucket eingeschränkt (falls aktiv). */
  const expiryFilteredRows = useMemo(() => {
    if (selectedExpiryBucket == null) {
      return bracketFilteredRows;
    }
    return bracketFilteredRows.filter((row) => getContractExpiryBucket(row) === selectedExpiryBucket);
  }, [bracketFilteredRows, selectedExpiryBucket]);

  /** Zuletzt die aktiven Query-Chips (UND-kombiniert) — komponiert sich auf die bestehenden Filter, ersetzt sie nicht. */
  const queryChipFilteredRows = useMemo(() => {
    if (queryChips.length === 0) {
      return expiryFilteredRows;
    }
    return expiryFilteredRows.filter((row) => rowMatchesQueryChips(row, queryChips));
  }, [expiryFilteredRows, queryChips]);

  const maxBracketCount = useMemo(
    () => Math.max(1, ...NL_PLAYERS_BRACKETS.map(({ bracket }) => playerBracketCounts[bracket] ?? 0)),
    [playerBracketCounts],
  );

  /** Vertragsauslauf-Verteilung der aktuellen Auswahl (Umfang-/Team-/Klassenfilter) — nur Spieler mit Roster-Eintrag. */
  const expiryCounts = useMemo(() => {
    const counts: Record<NlContractExpiryBucket, number> = { current: 0, plus1: 0, plus2: 0, later: 0 };
    for (const row of rows) {
      const bucket = getContractExpiryBucket(row);
      if (bucket) {
        counts[bucket] += 1;
      }
    }
    return counts;
  }, [rows]);

  /** Rasse-Optionen für den Query-Chip-Builder — aus denselben `rows` wie die bestehenden Klassen-Optionen. */
  const raceOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.player.race))).sort((left, right) => left.localeCompare(right)),
    [rows],
  );

  /** Beste-Disziplin-Optionen für den Query-Chip-Kategorie-Picker — nur real vorkommende Labels (kein erfundener Katalog). */
  const bestDisciplineOptions = useMemo(
    () =>
      Array.from(
        new Set(rows.map((row) => row.bestDiscipline).filter((label): label is string => Boolean(label))),
      ).sort((left, right) => left.localeCompare(right)),
    [rows],
  );

  /** Ausgewählte Zeilen für den Vergleich, in Auswahlreihenfolge — aus den (noch nicht chip-/bucket-gefilterten) `rows`, damit die Auswahl auch bestehen bleibt, wenn Chips/Buckets sie aus der sichtbaren Liste filtern. */
  const compareRows = useMemo(() => {
    const byId = new Map(rows.map((row) => [row.player.id, row] as const));
    return comparePlayerIds.map((id) => byId.get(id)).filter((row): row is FoundationPlayerScopeRow => Boolean(row));
  }, [rows, comparePlayerIds]);

  function toggleCompareSelection(playerId: string) {
    setComparePlayerIds((current) => {
      if (current.includes(playerId)) {
        return current.filter((id) => id !== playerId);
      }
      if (current.length >= 4) {
        return current;
      }
      return [...current, playerId];
    });
  }

  /**
   * Eigenes (vom Menschen geführtes) Team — einzige Quelle, um zu wissen, wessen
   * Transfermarkt-Wishlist (`gameState.seasonState.transferWishlist`) gemeint ist.
   * `null`, wenn kein Team als `humanControlled` markiert ist (keine Erfindung).
   */
  const ownTeamId = useMemo(() => teams.find((team) => team.humanControlled)?.teamId ?? null, [teams]);

  /**
   * Wishlist-Stern je Zeile (#3, additiv): reiner Lesezugriff auf die bereits im
   * `gameState`-Prop vorhandene Transfermarkt-Wishlist des eigenen Teams — kein
   * neuer Schreibpfad, siehe Modul-Kommentar unten bei `renderRow`/dem Sterne-Chip.
   */
  const wishlistPlayerIds = useMemo(() => {
    if (!ownTeamId) {
      return new Set<string>();
    }
    return new Set(getTeamTransferWishlistEntries(gameState, ownTeamId).map((entry) => entry.playerId));
  }, [gameState, ownTeamId]);

  const wishlistSelectionCount = useMemo(() => {
    if (wishlistPlayerIds.size === 0) {
      return 0;
    }
    return rows.filter((row) => wishlistPlayerIds.has(row.player.id)).length;
  }, [rows, wishlistPlayerIds]);

  /**
   * Kader-/Liga-Summary aus den aktuell gefilterten Zeilen: Durchschnitte
   * und die Leader je Kennzahl. Alles reale Werte aus den Rows selbst.
   */
  const summary = useMemo(() => {
    let ovrSum = 0;
    let ovrCount = 0;
    let mwSum = 0;
    let salarySum = 0;
    let topOvr: FoundationPlayerScopeRow | null = null;
    let topPps: FoundationPlayerScopeRow | null = null;
    let topMvs: FoundationPlayerScopeRow | null = null;
    let topMw: FoundationPlayerScopeRow | null = null;
    let topMwValue = Number.NEGATIVE_INFINITY;

    for (const row of rows) {
      if (row.playerOvr != null && Number.isFinite(row.playerOvr)) {
        ovrSum += row.playerOvr;
        ovrCount += 1;
        if (topOvr == null || (topOvr.playerOvr ?? Number.NEGATIVE_INFINITY) < row.playerOvr) {
          topOvr = row;
        }
      }
      if (row.playerPps != null && Number.isFinite(row.playerPps)) {
        if (topPps == null || (topPps.playerPps ?? Number.NEGATIVE_INFINITY) < row.playerPps) {
          topPps = row;
        }
      }
      if (row.playerMvs != null && Number.isFinite(row.playerMvs)) {
        if (topMvs == null || (topMvs.playerMvs ?? Number.NEGATIVE_INFINITY) < row.playerMvs) {
          topMvs = row;
        }
      }
      const marketValue = getPlayerDisplayMarketValue(row.player);
      if (marketValue != null && Number.isFinite(marketValue)) {
        mwSum += marketValue;
        if (marketValue > topMwValue) {
          topMwValue = marketValue;
          topMw = row;
        }
      }
      const salary = row.roster
        ? getRosterEntryDisplaySalary(row.roster, row.player)
        : getPlayerDisplaySalary(row.player);
      if (salary != null && Number.isFinite(salary)) {
        salarySum += salary;
      }
    }

    return {
      count: rows.length,
      avgOvr: ovrCount > 0 ? ovrSum / ovrCount : null,
      avgMw: rows.length > 0 ? mwSum / rows.length : null,
      totalSalary: rows.length > 0 ? salarySum : null,
      topOvr,
      topPps,
      topMvs,
      topMw,
      topMwValue: Number.isFinite(topMwValue) ? topMwValue : null,
    };
  }, [rows]);

  // Kit-Zähleranimation der Summary-Kacheln (Spieler-Anzahl / Ø OVR / Ø MW) —
  // respektiert prefers-reduced-motion (springt dann direkt auf den Zielwert).
  const countUpCount = useCountUp(summary.count);
  const countUpAvgOvr = useCountUp(summary.avgOvr);
  const countUpAvgMw = useCountUp(summary.avgMw);

  const visibleRows = useMemo(
    () => queryChipFilteredRows.slice(0, visibleCount),
    [queryChipFilteredRows, visibleCount],
  );
  const hasMoreRows = queryChipFilteredRows.length > visibleRows.length;

  // Verzeichnis-Zusatzfilter (Bracket/Vertrag/Query-Chips) aktiv? Genutzt für den
  // Leerzustand UND (unten) für die "Filter aktiv"-Anzeige im Analyse-Hub.
  const hasExtraDirectoryFilters =
    selectedMwBracket != null || selectedExpiryBucket != null || queryChips.length > 0 || nameQuery.trim().length > 0;
  // "Schränkt der aktive Filter die Auswahl wirklich ein?" — genau dieselbe
  // gefilterte Liste, die die Tabelle rendert (`queryChipFilteredRows`), gegen die
  // rohen `rows` gemessen. Nur dann bekommt der Hub die "Filter aktiv"-Anzeige.
  const hubFilterNarrows = queryChipFilteredRows.length < rows.length;

  /**
   * Klasse für die aktuell sortierte Spalte (Header + jede Körperzelle
   * dieser Spalte) — sorgt für einen echten, deterministischen
   * "aktive Sortierspalte"-Zustand (heller Blau-Hintergrund) statt der
   * zufälligen Heat-Band-Färbung einzelner Zellen. Wird mit
   * kontrastsicherem, dunklem Text kombiniert (siehe Scratch-CSS
   * `.is-active-sort`), damit Ton-Chips (grün/gelb/rot) auf dem hellen Blau
   * lesbar bleiben.
   */
  function sortCellClass(sortKey: string | undefined): string {
    return sortKey && sortState?.key === sortKey ? " is-active-sort" : "";
  }

  function ariaSortFor(sortKey: string | undefined): "ascending" | "descending" | "none" | undefined {
    if (!sortKey) {
      return undefined;
    }
    if (sortState?.key !== sortKey) {
      return "none";
    }
    return sortState.direction === "asc" ? "ascending" : "descending";
  }

  function renderSortHeader(sortKey: string, label: string, tooltip?: string) {
    const isActive = sortState?.key === sortKey;
    const direction: "none" | "asc" | "desc" = !isActive ? "none" : sortState?.direction === "asc" ? "asc" : "desc";
    return (
      <button
        type="button"
        className={`nl-players-sort-th${isActive ? " is-active" : ""}`}
        onClick={() => onToggleSort(sortKey)}
        title={tooltip ?? `Nach ${label} sortieren`}
        aria-label={`Nach ${label} sortieren`}
      >
        <span>{label}</span>
        <b aria-hidden="true">
          <NlSortGlyph direction={direction} />
        </b>
      </button>
    );
  }

  /**
   * Kopfzelle der Achsen-Spalte: kein einzelner `sortKey` (die Spalte bündelt
   * POW/SPE/MEN/SOC + optional eine Disziplin, siehe `renderAxisBars`) — statt
   * eines Sortier-Buttons gibt es hier den Hinweis "Wert anklicken sortiert"
   * plus den Disziplinen-Umschalter/-Picker (additiv, wählt `discipline:<id>`
   * als `sortState.key` über denselben `onToggleSort`-Callback wie jede
   * andere Spalte).
   */
  function renderAxesColumnHeader(tooltip?: string) {
    return (
      <div className="nl-players-axes-th">
        <span className="nl-players-axes-th-label" title={tooltip}>
          {NL_PLAYERS_COLUMNS.find((column) => column.id === "axes")?.label ?? "Achsen"}
        </span>
        <span className="nl-players-axes-th-hint">Wert anklicken sortiert</span>
        <button
          type="button"
          className={`nl-players-disc-toggle${disciplinePickerOpen ? " is-open" : ""}`}
          onClick={(event) => {
            event.stopPropagation();
            setDisciplinePickerOpen((open) => !open);
          }}
          aria-expanded={disciplinePickerOpen}
          title="Nach einer Disziplin-Wertung sortieren"
        >
          Disziplinen{" "}
          <b aria-hidden="true">
            <NlChevronGlyph open={disciplinePickerOpen} />
          </b>
        </button>
        {disciplinePickerOpen ? (
          <select
            className="nl-players-disc-select"
            value={activeDisciplineSortId ?? ""}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => {
              const disciplineId = event.target.value;
              onToggleSort(disciplineId ? buildDisciplineSortKey(disciplineId) : "ovr");
            }}
            aria-label="Nach Disziplin sortieren"
            title="Sortiert die Spielerliste absteigend/aufsteigend nach der Wertung dieser Disziplin"
          >
            <option value="">Disziplin wählen…</option>
            {disciplinePickerOptions.map((discipline) => (
              <option key={discipline.id} value={discipline.id}>
                {discipline.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>
    );
  }

  /**
   * Achsen-Zellinhalt: eine Zeile je Achse (POW/SPE/MEN/SOC) statt eines
   * engen 2×2-Clusters — Label, Balken und Wert stehen so nie horizontal
   * nebeneinander benachbarter Achsen und laufen nicht zusammen
   * ("91SPE" statt "91 · SPE"). Jede Achse ist einzeln lesbar.
   *
   * Bewusst NUR Balken + Wert (kein inline "#Rang" mehr) — PPs/OVR/MVS
   * tragen bereits eigene Top-%/Rang-Chips, ein zusätzlicher #Rang je
   * Achse war reine Excel-Redundanz ("ein GAME, keine Excel-Tabelle").
   * Der ligaweite Rang bleibt trotzdem einen Hover entfernt: er steckt im
   * `title`-Tooltip der Achse statt fest sichtbar in der Zelle zu stehen.
   */
  function renderAxisBars(row: FoundationPlayerScopeRow) {
    return (
      <div className="nl-players-axes" role="group" aria-label={`Achsenwerte ${row.player.name}`}>
        {NL_PLAYERS_AXES.map(({ key, label }) => {
          const value = row.player.coreStats[key] ?? null;
          const percent =
            value != null && Number.isFinite(value) ? Math.max(2, Math.min(100, value)) : 0;
          const pool = leaguePlayerHeatPools[key];
          const rank = getLeagueRank(value, pool);
          const isAxisSort = sortState?.key === key;
          return (
            <button
              key={key}
              type="button"
              className={`nl-players-axis nl-ptable-axis-enhanced ${nlToneClass(key)}${isAxisSort ? " is-active-sort" : ""}`}
              onClick={(event) => {
                // Nicht zum Zeilenklick (öffnet den Spieler-Drawer) durchreichen —
                // ein Achsenwert-Klick soll ausschließlich sortieren.
                event.stopPropagation();
                onToggleSort(key);
              }}
              aria-pressed={isAxisSort}
              title={`Nach ${label} sortieren — ${label}: ${formatNlNumber(value, 0)} von 100${
                rank != null ? ` — Liga-Rang #${rank} von ${pool.length}` : ""
              }`}
            >
              <span className="nl-players-axis-label">{label}</span>
              <span className="nl-players-axis-track" aria-hidden="true">
                <span className="nl-players-axis-fill" style={{ width: `${percent}%` }} />
              </span>
              <span className="nl-players-axis-value nl-tnum">{formatNlNumber(value, 0)}</span>
            </button>
          );
        })}
        {activeDisciplineSortId
          ? (() => {
              const value = row.player.disciplineRatings[activeDisciplineSortId] ?? null;
              const pool = leaguePlayerHeatPools.disciplines[activeDisciplineSortId] ?? [];
              const percent = getMetricBarPercent(value, pool);
              const rank = getLeagueRank(value, pool);
              const disciplineLabel = activeDisciplineSortName ?? "Disziplin";
              return (
                <span
                  className={`nl-players-axis nl-players-axis-discipline ${nlToneClass("accent")} is-active-sort`}
                  title={`Sortiert nach ${disciplineLabel} — ${disciplineLabel}: ${formatNlNumber(value, 0)}${
                    rank != null ? ` — Liga-Rang #${rank} von ${pool.length}` : ""
                  }`}
                >
                  <span className="nl-players-axis-label">{disciplineLabel}</span>
                  <span className="nl-players-axis-track" aria-hidden="true">
                    <span className="nl-players-axis-fill" style={{ width: `${percent}%` }} />
                  </span>
                  <span className="nl-players-axis-value nl-tnum">{formatNlNumber(value, 0)}</span>
                </span>
              );
            })()
          : null}
      </div>
    );
  }

  /**
   * CA/PO-Sterne-Zelle — identische Props wie die bestehende
   * `FoundationPlayerPortraitPreview`-Einbindung weiter unten in dieser Datei
   * (`caScore={computeCurrentAbilityScore(row.player.coreStats)}`,
   * `poScore={row.player.potential}`), nur jetzt als eigene, immer sichtbare
   * Spalte statt nur im Hover-Preview. Gleiche Quelle wie die Teams-
   * Rosterkarten/Home-Portraitkarte (`NlAbilityStars`, siehe
   * `components/foundation/velo-ui/NlAbilityStars.tsx`).
   *
   * CA ist bewusst NICHT `row.playerOvr` — OVR ist liga-relativ (Rang/Perzentil
   * unter allen aktiven Spielern), CA ist die absolute, peak-gewichtete
   * Bewertung aus den eigenen Kernwerten (`computeCurrentAbilityScore`, siehe
   * `lib/scouting/current-ability-score.ts`). Ein Liga-#1 mit mittelmäßigen
   * Absolutwerten soll nicht als CA 100 / 5 Sterne erscheinen.
   */
  function renderAbilityStars(row: FoundationPlayerScopeRow) {
    // Nur eigene (vom Menschen geführte) Spieler haben ein bekanntes PO — deren
    // exakter Wert bleibt erhalten (`known`, solide Sterne). Für fremde Spieler
    // ist PO verdeckt: unscharfer Bereich statt Einzelwert, damit kein volles
    // ★★★★★ das verdeckte Potenzial leakt (siehe getFoggedPoScoreRange).
    // Build-Phase-Override: der zentrale `DEBUG_FORCE_PLAYER_VISIBILITY`-Schalter
    // (Env `NEXT_PUBLIC_DEBUG_PLAYER_ATTRIBUTES`) überbrückt den PO-Fog auch hier,
    // damit exakte PO-Sterne für ALLE Spieler sichtbar sind — nicht nur fürs eigene
    // Team. Auf 0 setzen reaktiviert die scouting-basierte Unschärfe.
    const owned = (row.team?.humanControlled ?? false) || DEBUG_FORCE_PLAYER_VISIBILITY;
    const potential = row.player.potential ?? null;
    return (
      <NlAbilityStars
        caScore={computeCurrentAbilityScore(row.player.coreStats)}
        known={owned}
        {...(owned ? { poScore: potential } : { poScoreRange: getFoggedPoScoreRange(potential) })}
        compact
        stacked
        label={`${row.player.name} Fähigkeiten`}
      />
    );
  }

  /**
   * Aufgeklappte PPs-Detailzeile. Echte Pro-Areal-PPs-Punkte (wie viele
   * Performance-Punkte je Bereich POW/SPE/MEN/SOC erzielt wurden) liegen in
   * `FoundationPlayerScopeRow` nicht vor — nur der Gesamtwert `playerPps`.
   * Sie existieren an anderer Stelle im Code (z. B. `ppPow`/`ppSpe`/`ppMen`/
   * `ppSoc` in `lib/foundation/player-rating-contract.ts`), aber nur als
   * Ergebnis einer ligaweiten Neuberechnung, die hier nicht verfügbar ist.
   * Statt das zu erfinden, zeigen wir ehrlich die vorhandenen Kernwerte
   * (POW/SPE/MEN/SOC, 0–100) als Aufschlüsselungs-Näherung mit klarer
   * Kennzeichnung, dass es keine echten Areal-PPs-Punkte sind.
   */
  function renderPpsDetail(row: FoundationPlayerScopeRow) {
    return (
      <div className="nl-players-pps-detail" role="group" aria-label={`PPs-Aufschlüsselung ${row.player.name}`}>
        <div className="nl-players-pps-detail-head">
          <strong className="nl-players-pps-detail-name">{row.player.name}</strong>
          <span className="nl-players-pps-detail-total">
            Gesamt-PPs (Saison):{" "}
            <span className="nl-tnum">{row.playerPps != null ? formatPpsValue(row.playerPps) : "—"}</span>
          </span>
        </div>
        <div className="nl-players-pps-detail-grid">
          {NL_PLAYERS_AXES.map(({ key, label }) => {
            const value = row.player.coreStats[key] ?? null;
            const percent =
              value != null && Number.isFinite(value) ? Math.max(2, Math.min(100, value)) : 0;
            return (
              <div key={key} className={`nl-players-pps-detail-axis ${nlToneClass(key)}`}>
                <span className="nl-players-pps-detail-axis-label">{label}</span>
                <span className="nl-players-pps-detail-axis-track" aria-hidden="true">
                  <span className="nl-players-pps-detail-axis-fill" style={{ width: `${percent}%` }} />
                </span>
                <span className="nl-players-pps-detail-axis-value nl-tnum">{formatNlNumber(value, 0)}</span>
              </div>
            );
          })}
        </div>
        <p className="nl-players-pps-detail-note">
          Zeigt die Kernwerte POW/SPE/MEN/SOC (0–100) als Näherung.
        </p>
      </div>
    );
  }

  function renderRow(row: FoundationPlayerScopeRow) {
    const portrait = getPlayerPortraitModel(row.player);
    const teamLogo = row.team ? getTeamLogoModel(row.team, { variant: "thumb" }) : null;
    const marketValue = getPlayerDisplayMarketValue(row.player);
    const marketValueDelta = getPlayerDisplayMarketValueDelta(row.player, row.roster, gameState);
    const annualSalary = row.roster
      ? getRosterEntryDisplaySalary(row.roster, row.player)
      : getPlayerDisplaySalary(row.player);
    const currentSeasonSalary = row.roster
      ? getRosterEntryCurrentSeasonSalary(row.roster, row.player)
      : annualSalary;
    const salaryDelta = getRosterEntrySalaryDelta(row.roster, row.player, gameState);
    const showSeasonSalarySubline = rosterSalariesDifferForDisplay(currentSeasonSalary, annualSalary);
    const contractShapeShort = row.roster ? formatContractShapeShortLabel(row.roster.contractShape) : null;
    const careerStats = row.careerLeagueStats;
    const traits = [...row.player.traitsPositive, ...row.player.traitsNegative.map((trait) => `-${trait}`)];
    const traitsText = traits.length > 0 ? traits.join(", ") : "—";
    const isPpsExpanded = expandedPlayerId === row.player.id;
    const ppsDetailId = `nl-players-pps-detail-${row.player.id}`;
    // Fog of war: nur eigene Spieler haben ein bekanntes PO (siehe renderAbilityStars).
    const playerOwned = (row.team?.humanControlled ?? false) || DEBUG_FORCE_PLAYER_VISIBILITY;
    const isCompareSelected = comparePlayerIds.includes(row.player.id);
    const compareDisabled = !isCompareSelected && comparePlayerIds.length >= 4;
    // Wishlist-Schreibpfad (P1, #3): der Stern ist interaktiv, sobald ein eigenes
    // Team existiert UND der Shell-Toggle durchgereicht wurde — sonst bleibt er
    // der read-only Stern aus Phase 0 (nur sichtbar, wenn schon auf der Liste).
    const isWishlisted = wishlistPlayerIds.has(row.player.id);
    const wishlistWritable = Boolean(onToggleWishlist) && ownTeamId != null;

    /**
     * Geteilte Props für den Hover-Steckbrief (#Hover-Steckbrief, additiv):
     * dieselbe reiche `FoundationPlayerPortraitPreview`-Instanz (voller
     * Dichte-Modus, Portrait + Name + Team/Klasse/Rasse + OVR/PPs/MVS +
     * Achsen-Orbit + CA/PO-Sterne) wird jetzt sowohl vom Bild- als auch vom
     * Namens-Zellinhalt getriggert — EINE Quelle statt einer zweiten,
     * parallelen Hover-Implementierung. `subMeta` trägt zusätzlich Klasse und
     * Rasse (zuvor nur der Teamname), damit der Steckbrief sie ohne neue
     * Bausteine mit anzeigt.
     */
    const portraitPreviewProps: Omit<FoundationPlayerPortraitPreviewProps, "children"> = {
      playerId: row.player.id,
      name: row.player.name,
      portraitUrl: portrait.previewSrc ?? portrait.src,
      portraitInitials: portrait.initials,
      playerOvr: row.playerOvr,
      playerMvs: row.playerMvs,
      playerPps: row.playerPps,
      pow: row.player.coreStats.pow ?? null,
      spe: row.player.coreStats.spe ?? null,
      men: row.player.coreStats.men ?? null,
      soc: row.player.coreStats.soc ?? null,
      leagueHeatPools: leaguePlayerHeatPools,
      variant: "team",
      context: "teamGrid",
      playerClassName: row.player.className,
      subMeta: [row.team?.name ?? "Free Agent", row.player.className, row.player.race].filter(Boolean).join(" · "),
      previewDensity: "full",
      newLook: true,
      known: playerOwned,
      // CA ist die absolute, peak-gewichtete Bewertung aus den Kernwerten —
      // NICHT `row.playerOvr` (liga-relativ), siehe `renderAbilityStars` oben.
      caScore: computeCurrentAbilityScore(row.player.coreStats),
      ...(playerOwned
        ? { poScore: row.player.potential ?? null }
        : { poScoreRange: getFoggedPoScoreRange(row.player.potential ?? null) }),
    };

    const rowElement = (
      <tr
        key={row.player.id}
        className={`nl-players-row${isCompareSelected ? " is-compare-selected" : ""}`}
        onClick={() => openPlayerDrawerById(row.player.id, row.roster?.id)}
      >
        <td className="nl-players-td-compare">
          <input
            type="checkbox"
            className="nl-players-compare-checkbox"
            checked={isCompareSelected}
            disabled={compareDisabled}
            onClick={(event) => event.stopPropagation()}
            onChange={() => toggleCompareSelection(row.player.id)}
            aria-label={`${row.player.name} zum Vergleich auswählen`}
            title={
              isCompareSelected
                ? `${row.player.name} aus dem Vergleich entfernen`
                : compareDisabled
                  ? "Maximal 4 Spieler im Vergleich"
                  : `${row.player.name} zum Vergleich hinzufügen`
            }
          />
        </td>
        <td className="nl-players-td-image">
          <FoundationPlayerPortraitPreview {...portraitPreviewProps}>
            {portrait.src ? (
              <BudgetedMediaImage
                className="nl-players-portrait"
                src={portrait.src}
                alt={row.player.name}
                width={44}
                height={44}
                loading="lazy"
                fetchPriority="low"
                fallback={
                  <span className="nl-players-portrait nl-players-portrait-fallback" aria-hidden="true">
                    {portrait.initials}
                  </span>
                }
              />
            ) : (
              <span className="nl-players-portrait nl-players-portrait-fallback" aria-hidden="true">
                {portrait.initials}
              </span>
            )}
          </FoundationPlayerPortraitPreview>
        </td>
        <td className={`nl-players-td-name${sortCellClass("name")}`}>
          <FoundationPlayerPortraitPreview {...portraitPreviewProps}>
            {/* Stern + Namens-Button sind Geschwister in der `nl-players-name-line`
                (Buttons dürfen nicht verschachtelt werden) — beide teilen weiter
                denselben Hover-Steckbrief-Anchor. */}
            <span className="nl-players-name-line">
              {wishlistWritable ? (
                // Interaktiver Toggle: reused `nl-players-name-button` nur als
                // Button-Reset, `nl-players-wishlist-star` gewinnt in der Kaskade
                // für den Warn-Ton. ☆ = nicht auf Liste, ★ = auf Liste.
                <button
                  type="button"
                  className="nl-players-name-button nl-players-wishlist-star"
                  aria-pressed={isWishlisted}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleWishlist?.(row.player.id);
                  }}
                  aria-label={
                    isWishlisted
                      ? `${row.player.name} von Merkliste entfernen`
                      : `${row.player.name} auf Merkliste setzen`
                  }
                  title={isWishlisted ? "Von Merkliste" : "Auf Merkliste"}
                >
                  {isWishlisted ? "★" : "☆"}
                </button>
              ) : isWishlisted ? (
                <span
                  className="nl-players-wishlist-star"
                  aria-label="Auf deiner Transfermarkt-Wishlist"
                  title="Auf deiner Transfermarkt-Wishlist"
                >
                  ★
                </span>
              ) : null}
              <button
                type="button"
                className="nl-players-name-button"
                onClick={(event) => {
                  event.stopPropagation();
                  openPlayerDrawerById(row.player.id, row.roster?.id);
                }}
                title={`${row.player.name} öffnen`}
              >
                <span className="nl-players-name">{row.player.name}</span>
                {/* Nur Ausnahmen bekommen eine Status-Caption (z. B. "Free Agent") —
                    bei aktivem "Aktive Spieler"-Scope wäre "ACTIVE PLAYER" auf JEDER
                    Zeile reine Redundanz (Excel-Beschreibung statt Spiel-UI). */}
                {row.transferStatus !== "Active Player" ? (
                  <span className="nl-players-status">{row.transferStatus}</span>
                ) : null}
              </button>
            </span>
          </FoundationPlayerPortraitPreview>
        </td>
        {isColumnVisible("team") ? (
        <td className={`nl-players-td-team${sortCellClass("team")}`}>
          <button
            type="button"
            className="nl-players-team-button"
            onClick={(event) => {
              event.stopPropagation();
              if (row.team) {
                openTeamProfileById(row.team.teamId);
              }
            }}
            disabled={!row.team}
            title={row.team ? `${row.team.name} öffnen` : "Free Agent — kein Team"}
          >
            {teamLogo?.src ? (
              <BudgetedMediaImage
                className="nl-players-team-logo"
                src={teamLogo.src}
                alt={`${row.team?.name ?? "Team"} Logo`}
                width={24}
                height={24}
                loading="lazy"
                fetchPriority="low"
                fallback={
                  <span className="nl-players-team-logo nl-players-team-logo-fallback" aria-hidden="true">
                    {teamLogo.initials}
                  </span>
                }
              />
            ) : (
              <span className="nl-players-team-logo nl-players-team-logo-fallback" aria-hidden="true">
                {teamLogo?.initials ?? "FA"}
              </span>
            )}
            <span className="nl-players-team-name">{row.team?.name ?? "Free Agent"}</span>
          </button>
        </td>
        ) : null}
        {isColumnVisible("class") ? (
        <td className={`nl-players-td-icon${sortCellClass("class")}`}>
          <ClassIcon
            classNameValue={row.player.className}
            className="table-identity-icon-chip"
            iconClassName="table-identity-icon-image"
          />
        </td>
        ) : null}
        {isColumnVisible("race") ? (
        <td className={`nl-players-td-icon${sortCellClass("race")}`}>
          <RaceIcon race={row.player.race} className="table-identity-icon-chip" iconClassName="table-identity-icon-image" />
        </td>
        ) : null}
        {isColumnVisible("abilityStars") ? (
        <td className="nl-ptable-td-ability nl-ptable-td-ability-stacked">{renderAbilityStars(row)}</td>
        ) : null}
        {isColumnVisible("axes") ? (
        <td className="nl-players-td-axes">{renderAxisBars(row)}</td>
        ) : null}
        {isColumnVisible("pps") ? (
        <td
          className={`nl-players-td-metric nl-players-td-pps is-highlight-primary${sortCellClass("pps")} ${
            row.playerPps != null ? getPoolHeatClass(row.playerPps, leaguePlayerHeatPools.pps) : ""
          }`}
        >
          <span className="nl-ptable-metric-cell">
            <button
              type="button"
              className={`nl-players-pps-toggle${isPpsExpanded ? " is-expanded" : ""}`}
              aria-expanded={isPpsExpanded}
              aria-controls={ppsDetailId}
              title={`PPs-Aufschlüsselung für ${row.player.name} ${isPpsExpanded ? "schließen" : "öffnen"}`}
              onClick={(event) => {
                event.stopPropagation();
                setExpandedPlayerId((current) => (current === row.player.id ? null : row.player.id));
              }}
            >
              <span className="nl-players-pps-toggle-value nl-tnum">
                {row.playerPps != null ? formatPpsValue(row.playerPps) : "—"}
              </span>
              <b className="nl-players-pps-toggle-caret" aria-hidden="true">
                <NlChevronGlyph open={isPpsExpanded} />
              </b>
            </button>
            {renderMetricPercentileChip(row.playerPps, leaguePlayerHeatPools.pps)}
          </span>
        </td>
        ) : null}
        {isColumnVisible("ovr") ? (
        <td className={`nl-players-td-metric nl-ptable-ovr-cell${sortCellClass("ovr")}`}>
          <span className="nl-ptable-metric-cell">
            <span className="nl-tnum">{formatWholeNumber(row.playerOvr)}</span>
            {renderMetricRankChip(row.playerOvr, leaguePlayerHeatPools.ovr)}
          </span>
        </td>
        ) : null}
        {isColumnVisible("mvs") ? (
        <td
          className={`nl-players-td-metric${sortCellClass("mvs")} ${
            row.playerMvs != null ? getPoolHeatClass(row.playerMvs, leaguePlayerHeatPools.mvs) : ""
          }`}
        >
          <span className="nl-ptable-metric-cell">
            <span className="nl-tnum">{row.playerMvs != null ? formatPpsValue(row.playerMvs) : "—"}</span>
            {renderMetricPercentileChip(row.playerMvs, leaguePlayerHeatPools.mvs)}
          </span>
        </td>
        ) : null}
        {isColumnVisible("mw") ? (
        <td className={`nl-players-td-money${sortCellClass("mw")}`}>
          <span className="nl-players-money">
            <span className="nl-tnum">{formatNlMoney(marketValue)}</span>
            {marketValueDelta != null && marketValueDelta !== 0 ? (
              <NlDeltaChip
                value={marketValueDelta}
                format={(n) => `${n > 0 ? "+" : ""}${formatNlNumber(n, 2)}`}
                title="Marktwert-Entwicklung gegenüber der Baseline"
              />
            ) : null}
          </span>
        </td>
        ) : null}
        {isColumnVisible("salary") ? (
        <td className={`nl-players-td-money${sortCellClass("salary")}`}>
          <span className="nl-players-money">
            <span className="nl-tnum">{formatNlMoney(annualSalary)}</span>
            {salaryDelta != null && salaryDelta !== 0 ? (
              <NlDeltaChip
                value={salaryDelta}
                invert
                format={(n) => `${n > 0 ? "+" : ""}${formatNlNumber(n, 2)}`}
                title="Gehalts-Entwicklung gegenüber der Baseline (weniger = besser)"
              />
            ) : null}
            {showSeasonSalarySubline ? (
              <small className="nl-players-salary-season" title="Gehalt diese Saison (Vertragsjahr 1)">
                Saison: {formatNlMoney(currentSeasonSalary)}
              </small>
            ) : null}
          </span>
        </td>
        ) : null}
        {isColumnVisible("contract") ? (
        <td className={`nl-players-td-contract${sortCellClass("contract")}`}>
          {row.roster ? (
            <span className="nl-players-contract">
              {contractShapeShort ? (
                <span className="nl-players-contract-shape" title={formatContractShapeLabel(row.roster.contractShape)}>
                  {contractShapeShort}
                </span>
              ) : null}
              <span className="nl-tnum">{row.roster.contractLength}J</span>
            </span>
          ) : (
            "—"
          )}
        </td>
        ) : null}
        {isColumnVisible("appearances") ? (
        <td className={`nl-players-td-metric${sortCellClass("appearances")}`}>
          {row.seasonPerformance ? row.seasonPerformance.appearances : "—"}
        </td>
        ) : null}
        {isColumnVisible("bestDiscipline") ? (
        <td className={`nl-players-td-disc${sortCellClass("bestDiscipline")}`}>
          <DisciplineIcon label={row.bestDiscipline ?? "—"} showLabel={Boolean(row.bestDiscipline)} />
        </td>
        ) : null}
        {isColumnVisible("careerLeague") ? (
        <td
          className={`nl-players-td-career${sortCellClass("careerLeague")}`}
          title={
            careerStats
              ? `Alltime Liga: ${careerStats.seasonsPlayed} Saison(en) · ${careerStats.appearances} Einsätze · ${formatLocalePoints(careerStats.totalPps, 1)} PPs`
              : undefined
          }
        >
          {careerStats ? (
            <span className="nl-players-career">
              <span className="nl-tnum">
                {careerStats.appearances} / {formatLocalePoints(careerStats.totalPps, 1)}
              </span>
              <small>{careerStats.seasonsPlayed} Saison(en)</small>
            </span>
          ) : (
            "—"
          )}
        </td>
        ) : null}
        {isColumnVisible("traits") ? (
        <td className={`nl-players-td-traits${sortCellClass("traits")}`} title={traitsText}>
          {/* Trait-Chips statt Kommatext: positiv = Good-Ton, negativ = Risk-Ton (Fallback "—"). */}
          {renderTraitChips(row.player.traitsPositive, row.player.traitsNegative) ?? "—"}
        </td>
        ) : null}
      </tr>
    );

    if (!isPpsExpanded) {
      return [rowElement];
    }

    return [
      rowElement,
      <tr key={`${row.player.id}-pps-detail`} id={ppsDetailId} className="nl-players-detail-row">
        <td className="nl-players-detail-cell" colSpan={visibleColumns.length}>
          {renderPpsDetail(row)}
        </td>
      </tr>,
    ];
  }

  /**
   * Export/Kopieren der gefilterten Spielerliste (T-105, Backlog Juli 2026).
   * Zellwerte spiegeln bewusst den TEXT, der pro Spalte in `renderRow`
   * gerendert wird — inkl. Fog-of-War-Maskierung (fremde Spieler bekommen nur
   * den unscharfen CA/PO-Sternbereich, nie das rohe `potential`, siehe
   * `renderAbilityStars` oben) statt der zugrundeliegenden Rohdaten.
   *
   * Spalten = `visibleColumns` (dieselbe aktive Spaltenkonfiguration wie der
   * Tabellenkopf) MINUS der beiden reinen UI-Strukturspalten "Vgl."-Checkbox
   * und Portraitbild, die keinen sinnvollen Textwert haben. Zeilen =
   * `queryChipFilteredRows` (Scope-/Team-/Klassen-/MW-Bracket-/Vertrags-/
   * Query-Chip-gefiltert, VOR der "Mehr anzeigen"-Pagination) — nicht nur die
   * aktuell eingeblendete `visibleRows`-Seite, sonst würde Export/Kopieren nur
   * einen Bruchteil der gefilterten Treffer erfassen.
   */
  const exportColumns = useMemo(
    () => visibleColumns.filter((column) => column.id !== "compare" && column.id !== "image"),
    [visibleColumns],
  );

  /** Klartext-Zellwert einer Export-Spalte für eine Zeile — spiegelt `renderRow` je Spalten-ID. */
  function getExportCellText(columnId: string, row: FoundationPlayerScopeRow): string {
    switch (columnId) {
      case "name":
        return row.player.name;
      case "team":
        return row.team?.name ?? "Free Agent";
      case "class":
        return row.player.className;
      case "race":
        return row.player.race;
      case "abilityStars": {
        // Gleiche Sternmathematik + Klammerung wie `NlAbilityStars`
        // (`resolveCaStars`/`resolvePoStarRange`) — PO fällt nie unter CA.
        // Build-Phase-Override: der zentrale `DEBUG_FORCE_PLAYER_VISIBILITY`-Schalter
    // (Env `NEXT_PUBLIC_DEBUG_PLAYER_ATTRIBUTES`) überbrückt den PO-Fog auch hier,
    // damit exakte PO-Sterne für ALLE Spieler sichtbar sind — nicht nur fürs eigene
    // Team. Auf 0 setzen reaktiviert die scouting-basierte Unschärfe.
    const owned = (row.team?.humanControlled ?? false) || DEBUG_FORCE_PLAYER_VISIBILITY;
        const caScore = computeCurrentAbilityScore(row.player.coreStats);
        const caStars = caScore != null ? potentialScoreToStars(caScore) : null;
        const potential = row.player.potential ?? null;
        let poText = "—";
        if (owned) {
          if (potential != null) {
            const poStars = potentialScoreToStars(potential);
            poText = `${formatNlNumber(caStars != null ? Math.max(poStars, caStars) : poStars, 2)}★`;
          }
        } else {
          // Fog of War: NIE den rohen `potential`-Wert exportieren — nur den
          // unscharfen Bereich, den `getFoggedPoScoreRange` auch der UI liefert.
          const range = getFoggedPoScoreRange(potential);
          if (range != null) {
            let min = potentialScoreToStars(range.min);
            let max = potentialScoreToStars(range.max);
            if (caStars != null) {
              min = Math.max(min, caStars);
              max = Math.max(max, caStars, min);
            }
            poText = `${formatNlNumber(min, 2)}–${formatNlNumber(max, 2)}★ (geschätzt)`;
          }
        }
        return `CA ${caStars != null ? `${formatNlNumber(caStars, 2)}★` : "—"} / PO ${poText}`;
      }
      case "axes":
        return NL_PLAYERS_AXES.map(
          ({ key, label }) => `${label} ${formatNlNumber(row.player.coreStats[key] ?? null, 0)}`,
        ).join(" ");
      case "pps":
        return row.playerPps != null ? formatPpsValue(row.playerPps) : "—";
      case "ovr":
        return formatWholeNumber(row.playerOvr);
      case "mvs":
        return row.playerMvs != null ? formatPpsValue(row.playerMvs) : "—";
      case "mw":
        return formatNlMoney(getPlayerDisplayMarketValue(row.player));
      case "salary": {
        const annualSalary = row.roster
          ? getRosterEntryDisplaySalary(row.roster, row.player)
          : getPlayerDisplaySalary(row.player);
        return formatNlMoney(annualSalary);
      }
      case "contract": {
        if (!row.roster) {
          return "—";
        }
        const shapeShort = formatContractShapeShortLabel(row.roster.contractShape);
        return `${shapeShort ? `${shapeShort} ` : ""}${row.roster.contractLength}J`;
      }
      case "appearances":
        return row.seasonPerformance ? String(row.seasonPerformance.appearances) : "—";
      case "bestDiscipline":
        return row.bestDiscipline ?? "—";
      case "careerLeague":
        return row.careerLeagueStats
          ? `${row.careerLeagueStats.appearances} / ${formatLocalePoints(row.careerLeagueStats.totalPps, 1)} (${row.careerLeagueStats.seasonsPlayed} Saison(en))`
          : "—";
      case "traits": {
        const traits = [...row.player.traitsPositive, ...row.player.traitsNegative.map((trait) => `-${trait}`)];
        return traits.length > 0 ? traits.join(", ") : "—";
      }
      default:
        return "—";
    }
  }

  type PlayersExportTable = { headers: string[]; rows: string[][] };

  /** Kopf- + Datenzeilen über die aktuell sichtbaren Export-Spalten und die gefilterte Zeilenliste. */
  function buildPlayersExportTable(): PlayersExportTable {
    const headers = exportColumns.map((column) => column.label);
    const rows = queryChipFilteredRows.map((row) =>
      // Whitespace normalisieren (z. B. der Zeilenumbruch in der "Saison: …"-Gehaltszeile
      // gibt es hier nicht, aber Achsen-/CA-PO-Text kombiniert mehrere Werte mit Leerzeichen).
      exportColumns.map((column) => getExportCellText(column.id, row).replace(/\s+/g, " ").trim()),
    );
    return { headers, rows };
  }

  /** Tab-getrennt (TSV) fürs Einfügen in Tabellenkalkulation/Chat — "Liste kopieren". */
  function buildPlayersExportTsv(table: PlayersExportTable): string {
    return [table.headers, ...table.rows].map((line) => line.map((cell) => cell.replace(/\t/g, " ")).join("\t")).join("\n");
  }

  function escapeCsvField(value: string): string {
    return /[",;\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  }

  /**
   * CSV-Download. Semikolon statt Komma als Feldtrenner (deutsche Excel-
   * Konvention) — `formatNlNumber`/`formatNlMoney` rendern Dezimalwerte mit
   * Komma (`de-DE`-Locale), ein Komma-Trenner würde jede Zahl in zwei Felder
   * zerreißen. Führendes BOM, damit Excel unter Windows Umlaute (ä/ö/ü/ß)
   * zuverlässig als UTF-8 statt Latin-1 erkennt.
   */
  function buildPlayersExportCsv(table: PlayersExportTable): string {
    const BOM = "﻿";
    return (
      BOM + [table.headers, ...table.rows].map((line) => line.map(escapeCsvField).join(";")).join("\r\n")
    );
  }

  async function handleCopyPlayersList() {
    const table = buildPlayersExportTable();
    if (table.rows.length === 0) {
      setExportStatus("Keine Spieler zum Kopieren — Filter ergibt 0 Treffer.");
      return;
    }
    try {
      await navigator.clipboard.writeText(buildPlayersExportTsv(table));
      setExportStatus(`${formatNlNumber(table.rows.length, 0)} Spieler in die Zwischenablage kopiert.`);
    } catch {
      setExportStatus("Kopieren im Browser nicht möglich (Zwischenablage-Zugriff verweigert).");
    }
  }

  function handleExportPlayersCsv() {
    const table = buildPlayersExportTable();
    if (table.rows.length === 0) {
      setExportStatus("Keine Spieler zum Exportieren — Filter ergibt 0 Treffer.");
      return;
    }
    try {
      const blob = new Blob([buildPlayersExportCsv(table)], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `spielerliste-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setExportStatus(`${formatNlNumber(table.rows.length, 0)} Spieler als CSV exportiert.`);
    } catch {
      setExportStatus("CSV-Export im Browser fehlgeschlagen.");
    }
  }

  /**
   * "Spalten"-Steuerung (Phase 3, FM-Stil): Popover mit den 4 benannten
   * Saved Views plus Einzel-Toggles je Datenspalte. Strukturspalten
   * (Vgl./Bild/Name+Stern) tauchen bewusst NICHT auf — sie sind nicht
   * abschaltbar. Styling ist bewusst inline (kein Zugriff auf globals.css)
   * und lehnt sich über die `--nl-*`-Tokens an das restliche Panel an.
   */
  function renderColumnMenu() {
    return (
      <span className="nl-players-columns-control" style={{ position: "relative", display: "inline-flex" }}>
        <button
          type="button"
          className="nl-players-more-button"
          data-testid="nl-players-columns-toggle"
          aria-haspopup="true"
          aria-expanded={columnMenuOpen}
          onClick={() => setColumnMenuOpen((open) => !open)}
          title="Spalten ein-/ausblenden und Ansichten wählen"
        >
          Spalten
        </button>
        {columnMenuOpen ? (
          <>
            {/* Unsichtbarer Backdrop: Klick außerhalb schließt das Menü (kein globaler Dokument-Listener). */}
            <button
              type="button"
              aria-label="Spalten-Menü schließen"
              onClick={() => setColumnMenuOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 40,
                background: "transparent",
                border: "none",
                cursor: "default",
              }}
            />
            <div
              className="nl-players-columns-menu"
              role="group"
              aria-label="Spalten-Sichtbarkeit und Ansichten"
              data-testid="nl-players-columns-menu"
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                zIndex: 41,
                minWidth: 220,
                maxHeight: "60vh",
                overflowY: "auto",
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                background: "var(--nl-surface, var(--nl-panel))",
                border: "1px solid var(--nl-line)",
                borderRadius: "var(--nl-r-md, 10px)",
                boxShadow: "0 12px 32px rgba(0, 0, 0, 0.28)",
                color: "var(--nl-ink)",
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }} role="group" aria-label="Gespeicherte Ansichten">
                {NL_PLAYERS_COLUMN_PRESETS.map((preset) => {
                  const isActive = activeColumnPreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className="nl-players-more-button"
                      aria-pressed={isActive}
                      onClick={() => applyColumnPreset(preset.id)}
                      title={`Ansicht "${preset.label}" anwenden`}
                      style={
                        isActive
                          ? { background: "var(--nl-accent)", borderColor: "var(--nl-accent)", color: "#fff" }
                          : undefined
                      }
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ height: 1, background: "var(--nl-line)", margin: "2px 0" }} aria-hidden="true" />
              {NL_PLAYERS_HIDEABLE_COLUMN_IDS.map((id) => {
                const label = NL_PLAYERS_COLUMNS.find((column) => column.id === id)?.label ?? id;
                return (
                  <label
                    key={id}
                    style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}
                  >
                    <input
                      type="checkbox"
                      checked={columnVisibility[id] !== false}
                      onChange={() => toggleColumnVisibility(id)}
                    />
                    <span>{label}</span>
                  </label>
                );
              })}
            </div>
          </>
        ) : null}
      </span>
    );
  }

  return (
    <div className="nl-players" id="players-table" data-testid="nl-players-table" data-new-look="true">
      <FoundationPlayersLeaderPodium
        rows={rows}
        leaguePlayerHeatPools={leaguePlayerHeatPools}
        openPlayerDrawerById={openPlayerDrawerById}
        openTeamProfileById={openTeamProfileById}
      />
      <NlCard
        className="nl-players-header-card"
        eyebrow={`Liga-Datenbank · ${gameState.season.name}`}
        title="Spieler"
        actions={
          <div className="nl-players-filters">
            {/* Namenssuche (P1): spiegelt das Compare-Picker-Eingabemuster
                (`nl-compare-picker-input`) und trägt eine kleine ×-Clear-
                Affordanz mit dem geteilten Inline-Close-SVG (Phase 0). */}
            <label className="nl-players-filter">
              <span>Name</span>
              <input
                type="search"
                className="nl-compare-picker-input"
                value={nameQuery}
                onChange={(event) => setNameQuery(event.target.value)}
                placeholder="Spielername…"
                autoComplete="off"
                aria-label="Spieler nach Name suchen"
              />
              {nameQuery ? (
                <button
                  type="button"
                  className="nl-players-bracket-filter-clear"
                  onClick={() => setNameQuery("")}
                  aria-label="Namenssuche zurücksetzen"
                  title="Namenssuche zurücksetzen"
                >
                  <NlCloseGlyph />
                </button>
              ) : null}
            </label>
            <label className="nl-players-filter">
              <span>Team</span>
              <select
                value={playerTeamFilter}
                onChange={(event) => onChangeTeamFilter(event.target.value)}
                disabled={playerScope === "free_agents"}
                aria-label="Nach Team filtern"
              >
                <option value="ALL">Alle</option>
                {teams.map((team) => (
                  <option key={team.teamId} value={team.teamId}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="nl-players-filter">
              <span>Klasse</span>
              <select
                value={playerClassFilter}
                onChange={(event) => onChangeClassFilter(event.target.value)}
                aria-label="Nach Klasse filtern"
              >
                <option value="ALL">Alle</option>
                {playerClassOptions.map((className) => (
                  <option key={className} value={className}>
                    {className}
                  </option>
                ))}
              </select>
            </label>
          </div>
        }
      >
        <NlSubTabs
          items={NL_PLAYERS_VIEW_ITEMS}
          activeId={playersView}
          onSelect={(id) => setPlayersView(id as NlPlayersView)}
          aria-label="Spieler-Ansicht"
          className="nl-phub-view-tabs"
        />
        <div className="nl-players-header-row">
          <NlSubTabs
            items={NL_PLAYERS_SCOPE_ITEMS.map((item) => ({ id: item.id, label: item.label }))}
            activeId={playerScope}
            onSelect={(id) => onChangeScope(id as PlayerTableScope)}
            aria-label="Spieler-Umfang"
            className="nl-players-scope-tabs"
          />
          <StatChipRow className="nl-players-summary-chips" aria-label="Auswahl-Kennzahlen">
            <StatChip
              label="Spieler"
              value={formatNlNumber(countUpCount, 0)}
              tone="neutral"
              title="Anzahl Spieler in der aktuellen Auswahl"
            />
            <StatChip
              label="Ø OVR"
              value={formatNlNumber(countUpAvgOvr, 1)}
              tone="accent"
              title="Durchschnittliches Overall-Rating der Auswahl"
            />
            <StatChip
              label="Ø MW"
              value={formatNlMoney(countUpAvgMw)}
              tone="neutral"
              title="Durchschnittlicher Marktwert der Auswahl"
            />
            <StatChip
              label="Gehälter"
              value={formatNlMoney(summary.totalSalary)}
              tone="warn"
              title="Summe der Jahresgehälter der Auswahl"
            />
            {ownTeamId != null ? (
              <StatChip
                label="Wishlist"
                value={formatNlNumber(wishlistSelectionCount, 0)}
                tone="warn"
                title="Spieler der aktuellen Auswahl auf deiner Transfermarkt-Wishlist"
              />
            ) : null}
          </StatChipRow>
        </div>
        {playersView === "directory" ? (
          <>
            {/* De-Dup (Phase 0): Die frühere "Top OVR/PPs/MVS/MW"-Leader-Chip-Zeile
                wurde entfernt — das Leader-Podium direkt darüber zeigt dieselben
                Top-3 (OVR/PPs/MVS) prominenter, und Top MW ist im Analyse-Hub-
                Leaderboard (MW-Kennzahl) abgedeckt. Kein "Volle Rangliste"-/
                Ranking-Drawer-Einstieg lebte hier (der sitzt im Hub), daher gibt
                es nichts umzuquartieren. */}
            <div className="nl-players-brackets nl-ptable-bracket-strip" role="group" aria-label="Marktwert-Brackets der Auswahl — Balken anklicken filtert die Spielerliste">
              <div className="nl-players-bracket-bars">
                {NL_PLAYERS_BRACKETS.map(({ bracket, range }) => {
                  const count = playerBracketCounts[bracket] ?? 0;
                  const isActive = selectedMwBracket === bracket;
                  const heightPercent = count > 0 ? Math.max(4, Math.round((count / maxBracketCount) * 100)) : 0;
                  return (
                    <button
                      key={bracket}
                      type="button"
                      className={`nl-players-bracket-bar${isActive ? " is-active" : ""}`}
                      onClick={() => setSelectedMwBracket((current) => (current === bracket ? null : bracket))}
                      aria-pressed={isActive}
                      title={`B${bracket} · ${range} · ${formatNlNumber(count, 0)} Spieler${
                        isActive ? " — Filter aktiv, erneut klicken zum Entfernen" : " — anklicken zum Filtern der Spielerliste"
                      }`}
                    >
                      <span className="nl-players-bracket-bar-value nl-tnum">{formatNlNumber(count, 0)}</span>
                      <span className="nl-players-bracket-bar-track" aria-hidden="true">
                        <span className="nl-players-bracket-bar-fill" style={{ height: `${heightPercent}%` }} />
                      </span>
                      <span className="nl-players-bracket-bar-label">B{bracket}</span>
                    </button>
                  );
                })}
              </div>
              {/* De-Dup (Phase 0): Die lange Bracket-Legenden-Zeile ("B1 <12,5M · …")
                  wurde entfernt — dieselbe Range steht bereits im `title`-Tooltip
                  jedes Histogramm-Balkens ("B{n} · {range} · {count} Spieler"). */}
              {selectedMwBracket != null ? (
                <div className="nl-players-bracket-filter-chip">
                  <span>
                    MW-Filter: B{selectedMwBracket} ·{" "}
                    {NL_PLAYERS_BRACKETS.find((entry) => entry.bracket === selectedMwBracket)?.range}
                  </span>
                  <button
                    type="button"
                    className="nl-players-bracket-filter-clear"
                    onClick={() => setSelectedMwBracket(null)}
                    aria-label="Marktwert-Filter zurücksetzen"
                    title="Marktwert-Filter zurücksetzen"
                  >
                    <NlCloseGlyph />
                  </button>
                </div>
              ) : null}
            </div>
            <div className="nl-pexpiry-strip" role="group" aria-label="Vertragsauslauf der Auswahl — Bucket anklicken filtert die Spielerliste">
              <span className="nl-pexpiry-strip-label">Vertragsauslauf</span>
              <div className="nl-pexpiry-buckets">
                {NL_PLAYERS_EXPIRY_BUCKETS.map((bucket) => {
                  const count = expiryCounts[bucket.id];
                  const isActive = selectedExpiryBucket === bucket.id;
                  return (
                    <button
                      key={bucket.id}
                      type="button"
                      className={`nl-pexpiry-bucket${isActive ? " is-active" : ""}${bucket.id === "current" ? " is-urgent" : ""}`}
                      onClick={() => setSelectedExpiryBucket((current) => (current === bucket.id ? null : bucket.id))}
                      aria-pressed={isActive}
                      title={`${bucket.label} · ${formatNlNumber(count, 0)} Spieler${
                        isActive ? " — Filter aktiv, erneut klicken zum Entfernen" : " — anklicken zum Filtern der Spielerliste"
                      }`}
                    >
                      <span className="nl-pexpiry-bucket-value nl-tnum">{formatNlNumber(count, 0)}</span>
                      <span className="nl-pexpiry-bucket-label">{bucket.label}</span>
                    </button>
                  );
                })}
              </div>
              {selectedExpiryBucket != null ? (
                <button
                  type="button"
                  className="nl-pexpiry-clear"
                  onClick={() => setSelectedExpiryBucket(null)}
                  aria-label="Vertrags-Filter zurücksetzen"
                  title="Vertrags-Filter zurücksetzen"
                >
                  <NlCloseGlyph />
                </button>
              ) : null}
            </div>
          </>
        ) : null}
      </NlCard>

      {playersView === "directory" ? (
        <FoundationPlayersQueryChipsBar
          chips={queryChips}
          onChipsChange={setQueryChips}
          classOptions={playerClassOptions}
          raceOptions={raceOptions}
          bestDisciplineOptions={bestDisciplineOptions}
        />
      ) : null}

      {playersView === "hub" ? (
        // Korrektheits-Fix (Phase 0): Der Hub bekommt jetzt EXAKT die im Verzeichnis
        // gerenderte, gefilterte Liste (`queryChipFilteredRows` — Bracket/Vertrag/
        // Query-Chips) statt der rohen `rows`. Vorher gingen diese Filter beim
        // Ansichtswechsel still verloren. `filterActive` blendet im Hub-Kopf einen
        // "Filter aktiv"-Hinweis ein, sobald der Filter die Auswahl wirklich einschränkt.
        <FoundationPlayersHub
          rows={queryChipFilteredRows}
          gameState={gameState}
          leaguePlayerHeatPools={leaguePlayerHeatPools}
          filterActive={hubFilterNarrows}
          openPlayerDrawerById={openPlayerDrawerById}
          openTeamProfileById={openTeamProfileById}
        />
      ) : queryChipFilteredRows.length === 0 ? (
        // Kit-Leerzustand statt bespoke `nl-players-empty-card`-Paragraph + Button
        // (die alte Card-Klasse bewusst weggelassen — `.nl-empty-state` trägt eine
        // eigene Oberfläche, sonst gäbe es Card-in-Card-Chrome).
        <NlEmptyState
          title="Keine Spieler"
          message={
            hasExtraDirectoryFilters
              ? "Keine Spieler bei diesen Filtern — MW-/Vertrags-Filter oder Query-Chips zurücksetzen oder Umfang/Team/Klasse anpassen."
              : "Keine Spieler in der aktuellen Auswahl — Umfang, Team- oder Klassen-Filter anpassen."
          }
          action={
            hasExtraDirectoryFilters
              ? {
                  label: "Alle Zusatzfilter zurücksetzen",
                  onClick: () => {
                    setSelectedMwBracket(null);
                    setSelectedExpiryBucket(null);
                    setQueryChips([]);
                    setNameQuery("");
                  },
                }
              : undefined
          }
        />
      ) : (
        <NlCard
          className="nl-players-table-card"
          eyebrow="Sortierbare Daten"
          title="Spielerliste"
          actions={
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span className="nl-players-shown nl-tnum" aria-live="polite">
                  {formatNlNumber(visibleRows.length, 0)} von {formatNlNumber(queryChipFilteredRows.length, 0)} Spielern
                </span>
                {/* T-105: Export/Kopieren der gefilterten (nicht nur eingeblendeten) Spielerliste
                    über die sichtbaren Spalten — TSV in die Zwischenablage bzw. CSV-Download. */}
                <button
                  type="button"
                  className="nl-players-more-button"
                  onClick={handleCopyPlayersList}
                  title="Sichtbare Spalten der gefilterten Spielerliste als Text (TSV) in die Zwischenablage kopieren"
                >
                  Liste kopieren
                </button>
                <button
                  type="button"
                  className="nl-players-more-button"
                  onClick={handleExportPlayersCsv}
                  title="Sichtbare Spalten der gefilterten Spielerliste als CSV-Datei herunterladen"
                >
                  Als CSV exportieren
                </button>
                {renderColumnMenu()}
              </span>
              {exportStatus ? (
                <small className="muted" role="status" aria-live="polite">
                  {exportStatus}
                </small>
              ) : null}
            </div>
          }
        >
          <div className="nl-players-table-shell">
            <table className="nl-players-table nl-tnum">
              <thead>
                <tr>
                  {visibleColumns.map((column) => (
                    <th
                      key={column.id}
                      scope="col"
                      className={`nl-players-th is-${column.align ?? "left"}${
                        column.highlight ? ` is-highlight-${column.highlight}` : ""
                      }${sortCellClass(column.sortKey)}`}
                      aria-sort={ariaSortFor(column.sortKey)}
                    >
                      {column.sortKey ? (
                        renderSortHeader(column.sortKey, column.label, column.tooltip)
                      ) : column.id === "axes" ? (
                        renderAxesColumnHeader(column.tooltip)
                      ) : (
                        <span title={column.tooltip}>{column.label}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>{visibleRows.flatMap((row) => renderRow(row))}</tbody>
            </table>
          </div>
          {hasMoreRows ? (
            <div className="nl-players-more">
              <button
                type="button"
                className="nl-players-more-button"
                onClick={() => setVisibleCount((current) => current + NL_PLAYERS_PAGE_SIZE)}
              >
                Mehr anzeigen (+{NL_PLAYERS_PAGE_SIZE})
              </button>
              {/* "Alle anzeigen" springt höchstens auf NL_PLAYERS_ALLE_MAX (siehe
                  Konstante) statt ~400 interaktive Zeilen auf einmal zu rendern;
                  bei mehr Treffern lädt die "+100"-Schaltfläche weiter. */}
              <button
                type="button"
                className="nl-players-more-button"
                onClick={() => setVisibleCount(Math.min(queryChipFilteredRows.length, NL_PLAYERS_ALLE_MAX))}
              >
                {queryChipFilteredRows.length > NL_PLAYERS_ALLE_MAX
                  ? `Erste ${formatNlNumber(NL_PLAYERS_ALLE_MAX, 0)} anzeigen`
                  : `Alle ${formatNlNumber(queryChipFilteredRows.length, 0)} anzeigen`}
              </button>
              {queryChipFilteredRows.length > NL_PLAYERS_ALLE_MAX ? (
                <small className="muted" role="note">
                  Zeigt max. erste {formatNlNumber(NL_PLAYERS_ALLE_MAX, 0)} auf einmal (Performance) — "Mehr anzeigen" lädt weiter.
                </small>
              ) : null}
            </div>
          ) : null}
        </NlCard>
      )}

      {comparePlayerIds.length >= 2 ? (
        <div className="nl-players-compare-pill-wrap">
          <button type="button" className="nl-players-compare-pill" onClick={() => setCompareOverlayOpen(true)}>
            Vergleichen ({comparePlayerIds.length})
          </button>
          <button
            type="button"
            className="nl-players-compare-pill-clear"
            onClick={() => setComparePlayerIds([])}
            aria-label="Vergleichsauswahl aufheben"
            title="Vergleichsauswahl aufheben"
          >
            <NlCloseGlyph />
          </button>
        </div>
      ) : null}

      <FoundationPlayersCompareOverlay
        open={compareOverlayOpen}
        onClose={() => setCompareOverlayOpen(false)}
        rows={compareRows}
        openPlayerDrawerById={openPlayerDrawerById}
        onRemove={(playerId) => setComparePlayerIds((current) => current.filter((id) => id !== playerId))}
        leaguePlayerHeatPools={leaguePlayerHeatPools}
        allRows={rows}
        onAddToCompare={toggleCompareSelection}
      />
    </div>
  );
}

/**
 * Ligaweiter Analyse-/Ranking-Hub (#47, additiv, "Neuer Look").
 *
 * Zweite Ansicht neben dem bestehenden Spieler-Verzeichnis (Toggle über
 * `NL_PLAYERS_VIEW_ITEMS` oben) — dieselben `rows` wie die Tabelle
 * (respektiert also Umfang-/Team-/Klassen-Filter genau wie die
 * Leader-Chips/Bracket-Leiste im Verzeichnis), nur als Leaderboard- und
 * Analyse-Lens statt Zeilentabelle. Es wird kein zusätzlicher, ungefilterter
 * Liga-Pool angenommen, der dieser Komponente nicht als Prop vorliegt.
 *
 * Kacheln:
 * - Leaderboard: wählbare Kennzahl (OVR/PPs/MVS/MW/POW/SPE/MEN/SOC) — bewusst KEIN
 *   ligaweites Potenzial-Ranking (das würde fremdes, verdecktes PO leaken),
 *   Top 10 der Auswahl mit Medaillen für die ersten drei, eigene Spieler
 *   (`team.humanControlled`) markiert, Perzentil-Chip aus dem echten
 *   ligaweiten Heat-Pool (`leaguePlayerHeatPools`) wo vorhanden. "Volle
 *   Rangliste" öffnet `NlRankingDrawer` mit der kompletten Auswahl-Rangliste.
 * - Bestes Preis-Leistungs-Verhältnis: OVR pro investierter Marktwert-Million
 *   (`getPlayerDisplayMarketValue`), Top 5 Schnäppchen.
 * - Auf-/Absteiger: Marktwert-Delta gegenüber der Baseline
 *   (`getPlayerDisplayMarketValueDelta`, dieselbe Quelle wie die
 *   Delta-Chips in der Tabellenzeile), Top 5 je Richtung.
 * - Größtes Potenzial-Polster: `player.potential − playerOvr`, Top 5 — nur eigene
 *   Spieler (`team.humanControlled`), da fremdes Potenzial verdeckt ist (Fog of War).
 * - Spezialisierungs-Verteilung: Anzahl Spieler je stärkster Disziplin
 *   (`row.bestDiscipline`, dieselbe Quelle wie die "Beste Diszi"-Spalte).
 *
 * Bewusst weggelassen: keine Alters-/Entwicklungskurve — `Player` trägt kein
 * Altersfeld, daher tritt das Potenzial-Polster (CA→PO-Abstand) an dessen
 * Stelle als echte, im Datenmodell vorhandene Entwicklungs-Kennzahl.
 */
function FoundationPlayersHub({
  rows,
  gameState,
  leaguePlayerHeatPools,
  filterActive = false,
  openPlayerDrawerById,
  openTeamProfileById,
}: {
  rows: FoundationPlayerScopeRow[];
  gameState: GameState;
  leaguePlayerHeatPools: LeaguePlayerHeatPools;
  /** Verzeichnis-Zusatzfilter (Bracket/Vertrag/Query) schränken die übergebenen `rows` ein. */
  filterActive?: boolean;
  openPlayerDrawerById: (playerId: string, rosterId?: string | null) => void;
  openTeamProfileById: (teamId: string) => void;
}) {
  const [metric, setMetric] = useState<NlPhubMetricKey>("ovr");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerHighlightId, setDrawerHighlightId] = useState<string | null>(null);

  const activeMetric = NL_PHUB_METRICS.find((entry) => entry.key === metric) ?? NL_PHUB_METRICS[0];
  const activePool = activeMetric.pool ? leaguePlayerHeatPools[activeMetric.pool] : [];

  const rankedRows = useMemo(() => {
    const withValue = rows
      .map((row) => ({ row, value: getPhubMetricValue(row, metric) }))
      .filter((entry): entry is { row: FoundationPlayerScopeRow; value: number } => entry.value != null);
    withValue.sort((left, right) => right.value - left.value);
    return withValue.map((entry, index) => ({ ...entry, rank: index + 1 }));
  }, [rows, metric]);

  const topBoardRows = rankedRows.slice(0, 10);

  const ownBoardEntry = useMemo(
    () => rankedRows.find((entry) => entry.row.team?.humanControlled) ?? null,
    [rankedRows],
  );

  const drawerRows: NlRankingDrawerRow[] = useMemo(
    () =>
      rankedRows.map(({ row, value, rank }) => ({
        id: row.player.id,
        rank,
        name: row.player.name,
        sub: row.team?.name ?? "Free Agent",
        value,
        displayValue: formatPhubMetricValue(value, activeMetric),
        tone: activeMetric.tone,
        isOwn: row.team?.humanControlled ?? false,
      })),
    [rankedRows, activeMetric],
  );

  function openDrawer(highlightId?: string | null) {
    setDrawerOpen(true);
    setDrawerHighlightId(highlightId ?? null);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setDrawerHighlightId(null);
  }

  /** Bestes Preis-Leistungs-Verhältnis: OVR je investierter Marktwert-Million. */
  const valueRows = useMemo(() => {
    return rows
      .map((row) => {
        const mw = getPlayerDisplayMarketValue(row.player);
        const ovr = row.playerOvr;
        if (mw == null || !Number.isFinite(mw) || mw <= 0 || ovr == null || !Number.isFinite(ovr)) {
          return null;
        }
        return { row, mw, ovr, ratio: ovr / mw };
      })
      .filter(
        (entry): entry is { row: FoundationPlayerScopeRow; mw: number; ovr: number; ratio: number } =>
          entry != null,
      )
      .sort((left, right) => right.ratio - left.ratio);
  }, [rows]);
  const topValueRows = valueRows.slice(0, 5);
  const medianRatio = valueRows.length > 0 ? valueRows[Math.floor(valueRows.length / 2)]!.ratio : null;

  /** Marktwert-Bewegung gegenüber der Baseline — dieselbe Quelle wie die Delta-Chips in der Tabelle. */
  const movers = useMemo(() => {
    return rows
      .map((row) => {
        const delta = getPlayerDisplayMarketValueDelta(row.player, row.roster, gameState);
        if (delta == null || delta === 0 || !Number.isFinite(delta)) {
          return null;
        }
        return { row, delta };
      })
      .filter((entry): entry is { row: FoundationPlayerScopeRow; delta: number } => entry != null);
  }, [rows, gameState]);
  const risers = useMemo(
    () => movers.filter((entry) => entry.delta > 0).sort((left, right) => right.delta - left.delta).slice(0, 5),
    [movers],
  );
  const fallers = useMemo(
    () => movers.filter((entry) => entry.delta < 0).sort((left, right) => left.delta - right.delta).slice(0, 5),
    [movers],
  );

  /**
   * Größtes Potenzial-Polster: PO minus aktuelles OVR — NUR für eigene Spieler
   * (`team.humanControlled`). Fremdes Potenzial ist verdeckt (Fog of War) und darf
   * nie als konkreter Wert erscheinen, daher werden hier ausschließlich Spieler des
   * eigenen, kontrollierten Teams gerankt, deren PO bekannt ist.
   */
  const headroomRows = useMemo(() => {
    return rows
      .map((row) => {
        if (!row.team?.humanControlled) {
          return null;
        }
        const potential = row.player.potential;
        const ovr = row.playerOvr;
        if (potential == null || !Number.isFinite(potential) || ovr == null || !Number.isFinite(ovr)) {
          return null;
        }
        const headroom = potential - ovr;
        if (headroom <= 0) {
          return null;
        }
        return { row, potential, ovr, headroom };
      })
      .filter(
        (entry): entry is { row: FoundationPlayerScopeRow; potential: number; ovr: number; headroom: number } =>
          entry != null,
      )
      .sort((left, right) => right.headroom - left.headroom)
      .slice(0, 5);
  }, [rows]);

  /** Spezialisierungs-Verteilung nach stärkster Disziplin ("Beste Diszi"). */
  const disciplineCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      if (!row.bestDiscipline) {
        continue;
      }
      counts.set(row.bestDiscipline, (counts.get(row.bestDiscipline) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((left, right) => right[1] - left[1]);
  }, [rows]);
  const scarcestDiscipline = disciplineCounts.length > 0 ? disciplineCounts[disciplineCounts.length - 1]! : null;

  return (
    <div className="nl-phub" data-testid="nl-players-hub">
      <NlCard
        className="nl-phub-board-card"
        eyebrow="Ranking · aktuelle Auswahl"
        title="Liga-Leaderboard"
        actions={
          <>
            {/* "Filter aktiv"-Hinweis: die Verzeichnis-Zusatzfilter schränken diese
                Hub-Auswahl gerade wirklich ein (Phase-0-Korrektheits-Fix). */}
            {filterActive ? (
              <StatChip
                label="Filter"
                value="aktiv"
                tone="warn"
                title="Bracket-/Vertrags-/Query-Filter aus dem Verzeichnis sind hier aktiv und schränken die Auswahl ein."
              />
            ) : null}
            <div className="nl-phub-metric-bar" role="group" aria-label="Kennzahl wählen">
              {NL_PHUB_METRICS.map((entry) => (
              <button
                key={entry.key}
                type="button"
                className={`nl-phub-metric-btn ${nlToneClass(entry.tone)}${metric === entry.key ? " is-active" : ""}`}
                onClick={() => setMetric(entry.key)}
                aria-pressed={metric === entry.key}
              >
                {entry.label}
              </button>
              ))}
            </div>
          </>
        }
      >
        {topBoardRows.length === 0 ? (
          <p className="nl-phub-empty">Keine Werte für {activeMetric.label} in der aktuellen Auswahl.</p>
        ) : (
          <>
            <StatChipRow className="nl-phub-board-stats" aria-label={`Kennzahlen ${activeMetric.label}`}>
              <StatChip
                label={`Spitze · ${activeMetric.label}`}
                value={formatPhubMetricValue(topBoardRows[0]!.value, activeMetric)}
                sub={topBoardRows[0]!.row.player.name}
                tone={activeMetric.tone}
                onClick={() => openPlayerDrawerById(topBoardRows[0]!.row.player.id, topBoardRows[0]!.row.roster?.id)}
                title={`Beste(r) ${activeMetric.label} der Auswahl — ${topBoardRows[0]!.row.player.name} öffnen`}
              />
              {ownBoardEntry ? (
                <StatChip
                  label="Bester eigener Spieler"
                  value={formatPhubMetricValue(ownBoardEntry.value, activeMetric)}
                  sub={`${ownBoardEntry.row.player.name} · Rang ${formatNlNumber(ownBoardEntry.rank, 0)}`}
                  tone="accent"
                  onClick={() => openPlayerDrawerById(ownBoardEntry.row.player.id, ownBoardEntry.row.roster?.id)}
                  title={`${activeMetric.label} — ${ownBoardEntry.row.player.name} öffnen`}
                />
              ) : null}
              <StatChip
                label="Volle Rangliste"
                value={formatNlNumber(rankedRows.length, 0)}
                sub="Spieler in Auswahl"
                tone="neutral"
                onClick={() => openDrawer(ownBoardEntry?.row.player.id ?? topBoardRows[0]?.row.player.id ?? null)}
                title={`Vollständige ${activeMetric.label}-Rangliste der aktuellen Auswahl öffnen`}
              />
            </StatChipRow>
            <ol className={`nl-phub-board-list ${nlToneClass(activeMetric.tone)}`} aria-label={`Top ${activeMetric.label}`}>
              {topBoardRows.map(({ row, value, rank }) => {
                const medalKind = rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : null;
                const isOwn = row.team?.humanControlled ?? false;
                const leagueRank = activeMetric.pool ? getLeagueRank(value, activePool) : null;
                const percentileLabel = activeMetric.pool ? formatLeaguePercentile(leagueRank, activePool.length) : null;
                const percentileTone = activeMetric.pool ? getPoolHeatTone(value, activePool) : "neutral";
                return (
                  <li key={row.player.id} className={`nl-phub-board-row${isOwn ? " is-own" : ""}`}>
                    <span className="nl-phub-board-rank">
                      {medalKind ? (
                        <NlMedalBadge kind={medalKind} title={`Rang ${rank}`} />
                      ) : (
                        <span className="nl-phub-board-ranknum nl-tnum">{rank}</span>
                      )}
                    </span>
                    <button
                      type="button"
                      className="nl-phub-board-name-btn"
                      onClick={() => openPlayerDrawerById(row.player.id, row.roster?.id)}
                      title={`${row.player.name} öffnen`}
                    >
                      {row.player.name}
                      {isOwn ? <span className="nl-phub-own-tag">Dein Spieler</span> : null}
                    </button>
                    {row.team ? (
                      <button
                        type="button"
                        className="nl-phub-board-team-btn"
                        onClick={() => openTeamProfileById(row.team!.teamId)}
                        title={`${row.team.name} öffnen`}
                      >
                        {row.team.name}
                      </button>
                    ) : (
                      <span className="nl-phub-board-team-btn is-free-agent">Free Agent</span>
                    )}
                    <span className={`nl-phub-board-value nl-tnum ${nlToneClass(activeMetric.tone)}`}>
                      {formatPhubMetricValue(value, activeMetric)}
                    </span>
                    {percentileLabel ? (
                      <span
                        className={`nl-phub-board-percentile ${nlToneClass(percentileTone)}`}
                        title={`Liga-Perzentil: ${percentileLabel} (Rang #${leagueRank} von ${activePool.length})`}
                      >
                        {percentileLabel}
                      </span>
                    ) : (
                      <span className="nl-phub-board-percentile is-empty" aria-hidden="true" />
                    )}
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </NlCard>

      <FoundationPlayersScatterCard rows={rows} openPlayerDrawerById={openPlayerDrawerById} />

      <FoundationPlayersSquadRidgeline rows={rows} />

      <div className="nl-phub-grid">
        <NlCard className="nl-phub-value-card" eyebrow="Kader-Ökonomie" title="Bestes Preis-Leistungs-Verhältnis">
          {topValueRows.length === 0 ? (
            <p className="nl-phub-empty">Keine Marktwert-/OVR-Daten in der aktuellen Auswahl.</p>
          ) : (
            <>
              <StatChipRow aria-label="Preis-Leistungs-Überblick">
                <StatChip
                  label="Bestes Verhältnis"
                  value={`${formatNlNumber(topValueRows[0]!.ratio, 2)} OVR/M`}
                  sub={topValueRows[0]!.row.player.name}
                  tone="good"
                  onClick={() => openPlayerDrawerById(topValueRows[0]!.row.player.id, topValueRows[0]!.row.roster?.id)}
                  title="OVR pro investierter Marktwert-Million — bester Wert der Auswahl"
                />
                {medianRatio != null ? (
                  <StatChip
                    label="Median Auswahl"
                    value={`${formatNlNumber(medianRatio, 2)} OVR/M`}
                    tone="neutral"
                    title="Median OVR pro Marktwert-Million über die Auswahl"
                  />
                ) : null}
              </StatChipRow>
              <ol className="nl-phub-list" aria-label="Top Preis-Leistungs-Spieler">
                {topValueRows.map(({ row, mw, ovr, ratio }, index) => (
                  <li key={row.player.id} className="nl-phub-list-row">
                    <span className="nl-phub-list-rank nl-tnum">{index + 1}</span>
                    <button
                      type="button"
                      className="nl-phub-list-name-btn"
                      onClick={() => openPlayerDrawerById(row.player.id, row.roster?.id)}
                      title={`${row.player.name} öffnen`}
                    >
                      {row.player.name}
                    </button>
                    {row.team ? (
                      <button
                        type="button"
                        className="nl-phub-list-team-btn"
                        onClick={() => openTeamProfileById(row.team!.teamId)}
                        title={`${row.team.name} öffnen`}
                      >
                        {row.team.name}
                      </button>
                    ) : (
                      <span className="nl-phub-list-team-btn is-free-agent">Free Agent</span>
                    )}
                    <span className="nl-phub-list-metrics">
                      <span className="nl-tnum">{formatNlNumber(ovr, 1)} OVR</span>
                      <span className="nl-tnum">{formatLocalePoints(mw, 2)} MW</span>
                      <span className={`nl-phub-list-ratio nl-tnum ${nlToneClass("good")}`}>
                        {formatNlNumber(ratio, 2)} OVR/M
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </NlCard>

        <NlCard className="nl-phub-movers-card" eyebrow="Marktwert-Bewegung" title="Auf- und Absteiger">
          {movers.length === 0 ? (
            <p className="nl-phub-empty">Keine Marktwert-Bewegung gegenüber der Baseline in der aktuellen Auswahl.</p>
          ) : (
            <div className="nl-phub-movers-grid">
              <div className="nl-phub-movers-col">
                <span className="nl-phub-movers-col-label">Aufsteiger</span>
                {risers.length === 0 ? (
                  <p className="nl-phub-empty-inline">Keine Aufsteiger in der Auswahl.</p>
                ) : (
                  <ol className="nl-phub-list">
                    {risers.map(({ row, delta }) => (
                      <li key={row.player.id} className="nl-phub-list-row">
                        <button
                          type="button"
                          className="nl-phub-list-name-btn"
                          onClick={() => openPlayerDrawerById(row.player.id, row.roster?.id)}
                          title={`${row.player.name} öffnen`}
                        >
                          {row.player.name}
                        </button>
                        <NlDeltaChip
                          value={delta}
                          format={(n) => `${n > 0 ? "+" : ""}${formatNlNumber(n, 2)}`}
                          title="Marktwert-Entwicklung gegenüber der Baseline"
                        />
                      </li>
                    ))}
                  </ol>
                )}
              </div>
              <div className="nl-phub-movers-col">
                <span className="nl-phub-movers-col-label">Absteiger</span>
                {fallers.length === 0 ? (
                  <p className="nl-phub-empty-inline">Keine Absteiger in der Auswahl.</p>
                ) : (
                  <ol className="nl-phub-list">
                    {fallers.map(({ row, delta }) => (
                      <li key={row.player.id} className="nl-phub-list-row">
                        <button
                          type="button"
                          className="nl-phub-list-name-btn"
                          onClick={() => openPlayerDrawerById(row.player.id, row.roster?.id)}
                          title={`${row.player.name} öffnen`}
                        >
                          {row.player.name}
                        </button>
                        <NlDeltaChip
                          value={delta}
                          format={(n) => `${n > 0 ? "+" : ""}${formatNlNumber(n, 2)}`}
                          title="Marktwert-Entwicklung gegenüber der Baseline"
                        />
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          )}
        </NlCard>

        <NlCard className="nl-phub-potential-card" eyebrow="Entwicklung · dein Kader" title="Größtes Potenzial-Polster">
          {headroomRows.length === 0 ? (
            <p className="nl-phub-empty">
              Keine eigenen Spieler mit Potenzial über dem aktuellen OVR in der Auswahl.
            </p>
          ) : (
            <ol className="nl-phub-list">
              {headroomRows.map(({ row, ovr, potential, headroom }, index) => (
                <li key={row.player.id} className="nl-phub-list-row">
                  <span className="nl-phub-list-rank nl-tnum">{index + 1}</span>
                  <button
                    type="button"
                    className="nl-phub-list-name-btn"
                    onClick={() => openPlayerDrawerById(row.player.id, row.roster?.id)}
                    title={`${row.player.name} öffnen`}
                  >
                    {row.player.name}
                  </button>
                  {row.team ? (
                    <button
                      type="button"
                      className="nl-phub-list-team-btn"
                      onClick={() => openTeamProfileById(row.team!.teamId)}
                      title={`${row.team.name} öffnen`}
                    >
                      {row.team.name}
                    </button>
                  ) : (
                    <span className="nl-phub-list-team-btn is-free-agent">Free Agent</span>
                  )}
                  <span className="nl-phub-list-metrics">
                    <span className="nl-tnum">{formatNlNumber(ovr, 1)} OVR</span>
                    <span className="nl-tnum">{formatNlNumber(potential, 0)} PO</span>
                    <span className={`nl-phub-list-ratio nl-tnum ${nlToneClass("good")}`}>
                      +{formatNlNumber(headroom, 1)}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </NlCard>

        <NlCard className="nl-phub-scarcity-card" eyebrow="Beste Disziplin" title="Spezialisierungs-Verteilung">
          {disciplineCounts.length === 0 ? (
            <p className="nl-phub-empty">Keine "Beste Diszi"-Daten in der aktuellen Auswahl.</p>
          ) : (
            <>
              <div className="nl-phub-scarcity-chart-scroll">
                <NlBarChart
                  bars={disciplineCounts.map(([label, value]) => ({ label, value, tone: "accent" as const }))}
                  format={(value) => formatNlNumber(value, 0)}
                  aria-label="Anzahl Spieler je stärkster Disziplin"
                  className="nl-phub-scarcity-chart"
                />
              </div>
              {scarcestDiscipline ? (
                <p className="nl-phub-hint">
                  Seltenste Spezialisierung in der Auswahl: <strong>{scarcestDiscipline[0]}</strong> (
                  {formatNlNumber(scarcestDiscipline[1], 0)} Spieler).
                </p>
              ) : null}
            </>
          )}
        </NlCard>
      </div>

      <NlRankingDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        metricLabel={activeMetric.label}
        metricKey={metric}
        subtitle="Rangliste der aktuellen Auswahl (Umfang-/Team-/Klassenfilter)"
        rows={drawerRows}
        highlightId={drawerHighlightId}
        onSelectRow={(row) => openPlayerDrawerById(row.id)}
      />
    </div>
  );
}
