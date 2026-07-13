/**
 * Query-Chip-Filter + Presets für das Spieler-Verzeichnis (additiv, "Neuer
 * Look"). Reine Client-Logik: Attribut-Katalog, Zeilen-Prädikat und
 * localStorage-Presets (kein Server, gleiche try/catch-Lese-/Schreib-Form
 * wie die bestehenden Transfermarkt-Filter-Presets in
 * `app/foundation/transfermarkt-v2/TransfermarktV2Client.tsx`).
 *
 * Chips kombinieren sich per UND und wenden sich zusätzlich zu den
 * bestehenden Umfang-/Team-/Klassen-Filtern an (auf den bereits davon
 * gefilterten `rows` in `FoundationPlayersTableNewLook.tsx`) — sie ersetzen
 * diese Filter nicht.
 */

import {
  getPlayerDisplayMarketValue,
  getPlayerDisplaySalary,
  getRosterEntryDisplaySalary,
} from "@/app/foundation/foundation-page-client-exports";
import { formatNlMoney, formatNlNumber } from "@/components/foundation/new-look";
import type { FoundationPlayerScopeRow } from "@/lib/foundation/tabs/use-foundation-cross-tab-player-directory";

export type QueryChipAttr =
  | "ovr"
  | "pps"
  | "mvs"
  | "mw"
  | "salary"
  | "pow"
  | "spe"
  | "men"
  | "soc"
  | "class"
  | "race";

export type QueryChipOperator = ">=" | "<=" | "=";

export type QueryChipAttrMeta = {
  key: QueryChipAttr;
  label: string;
  kind: "number" | "category";
  digits: number;
  money?: boolean;
};

export const QUERY_CHIP_ATTRIBUTES: ReadonlyArray<QueryChipAttrMeta> = [
  { key: "ovr", label: "OVR", kind: "number", digits: 1 },
  { key: "pps", label: "PPs", kind: "number", digits: 1 },
  { key: "mvs", label: "MVS", kind: "number", digits: 1 },
  { key: "mw", label: "MW", kind: "number", digits: 2, money: true },
  { key: "salary", label: "Gehalt", kind: "number", digits: 2, money: true },
  { key: "pow", label: "POW", kind: "number", digits: 0 },
  { key: "spe", label: "SPE", kind: "number", digits: 0 },
  { key: "men", label: "MEN", kind: "number", digits: 0 },
  { key: "soc", label: "SOC", kind: "number", digits: 0 },
  { key: "class", label: "Klasse", kind: "category", digits: 0 },
  { key: "race", label: "Rasse", kind: "category", digits: 0 },
];

export type QueryChip = {
  id: string;
  attr: QueryChipAttr;
  operator: QueryChipOperator;
  value: number | string;
};

export type QueryChipPreset = {
  id: string;
  name: string;
  chips: QueryChip[];
  createdAt: string;
};

/** Rohwert eines Attributs für eine Zeile — `null`, wenn nicht bekannt (keine Erfindung). */
export function getQueryChipRowValue(row: FoundationPlayerScopeRow, attr: QueryChipAttr): number | string | null {
  switch (attr) {
    case "ovr":
      return row.playerOvr;
    case "pps":
      return row.playerPps;
    case "mvs":
      return row.playerMvs;
    case "mw":
      return getPlayerDisplayMarketValue(row.player);
    case "salary":
      return row.roster ? getRosterEntryDisplaySalary(row.roster, row.player) : getPlayerDisplaySalary(row.player);
    case "pow":
    case "spe":
    case "men":
    case "soc":
      return row.player.coreStats[attr] ?? null;
    case "class":
      return row.player.className;
    case "race":
      return row.player.race;
    default:
      return null;
  }
}

function chipMatchesRow(row: FoundationPlayerScopeRow, chip: QueryChip): boolean {
  const rowValue = getQueryChipRowValue(row, chip.attr);
  if (rowValue == null) {
    return false;
  }
  if (typeof rowValue === "string" || typeof chip.value === "string") {
    return String(rowValue) === String(chip.value);
  }
  if (!Number.isFinite(rowValue) || !Number.isFinite(chip.value)) {
    return false;
  }
  switch (chip.operator) {
    case ">=":
      return rowValue >= chip.value;
    case "<=":
      return rowValue <= chip.value;
    case "=":
      return rowValue === chip.value;
    default:
      return false;
  }
}

/** UND-Verknüpfung aller Chips — leere Chip-Liste lässt jede Zeile durch. */
export function rowMatchesQueryChips(row: FoundationPlayerScopeRow, chips: QueryChip[]): boolean {
  return chips.every((chip) => chipMatchesRow(row, chip));
}

const OPERATOR_LABEL: Record<QueryChipOperator, string> = {
  ">=": "≥",
  "<=": "≤",
  "=": "=",
};

/** Anzeige-Label eines Chips, z. B. "OVR ≥ 72" oder "Klasse = Krieger". */
export function formatQueryChipLabel(chip: QueryChip): string {
  const meta = QUERY_CHIP_ATTRIBUTES.find((entry) => entry.key === chip.attr);
  if (!meta) {
    return "";
  }
  if (meta.kind === "category") {
    return `${meta.label} = ${chip.value}`;
  }
  const numericValue = typeof chip.value === "number" ? chip.value : Number(chip.value);
  const formatted = meta.money ? formatNlMoney(numericValue) : formatNlNumber(numericValue, meta.digits);
  return `${meta.label} ${OPERATOR_LABEL[chip.operator]} ${formatted}`;
}

const QUERY_CHIP_STORAGE_PREFIX = "nl-players-query-chip-presets";
const QUERY_CHIP_STORAGE_VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Aktive Save-ID aus der URL (`?saveId=...`), gleiche Quelle wie der Shell-Router. Nur clientseitig verfügbar. */
export function getActiveSaveIdFromLocation(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return new URLSearchParams(window.location.search).get("saveId");
  } catch {
    return null;
  }
}

function getQueryChipStorageKey(saveId: string | null | undefined): string {
  return `${QUERY_CHIP_STORAGE_PREFIX}:${saveId || "global"}`;
}

function sanitizeQueryChip(value: unknown): QueryChip | null {
  if (!isRecord(value)) {
    return null;
  }
  const attr = value.attr;
  const operator = value.operator;
  const chipValue = value.value;
  if (typeof attr !== "string" || !QUERY_CHIP_ATTRIBUTES.some((entry) => entry.key === attr)) {
    return null;
  }
  if (operator !== ">=" && operator !== "<=" && operator !== "=") {
    return null;
  }
  if (typeof chipValue !== "number" && typeof chipValue !== "string") {
    return null;
  }
  return {
    id: typeof value.id === "string" && value.id ? value.id : `chip-${crypto.randomUUID()}`,
    attr: attr as QueryChipAttr,
    operator,
    value: chipValue,
  };
}

export function readQueryChipPresets(saveId: string | null | undefined): QueryChipPreset[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(getQueryChipStorageKey(saveId));
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || !Array.isArray(parsed.presets)) {
      return [];
    }
    return parsed.presets
      .filter(isRecord)
      .map((preset) => ({
        id: typeof preset.id === "string" && preset.id ? preset.id : `preset-${crypto.randomUUID()}`,
        name: typeof preset.name === "string" && preset.name.trim() ? preset.name.trim().slice(0, 32) : "Preset",
        chips: Array.isArray(preset.chips)
          ? preset.chips.map(sanitizeQueryChip).filter((chip): chip is QueryChip => chip != null)
          : [],
        createdAt: typeof preset.createdAt === "string" ? preset.createdAt : new Date().toISOString(),
      }))
      .slice(0, 24);
  } catch {
    return [];
  }
}

export function writeQueryChipPresets(saveId: string | null | undefined, presets: QueryChipPreset[]): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      getQueryChipStorageKey(saveId),
      JSON.stringify({ version: QUERY_CHIP_STORAGE_VERSION, presets: presets.slice(0, 24) }),
    );
  } catch {
    // Storage kann voll/deaktiviert sein — Presets sind reiner Client-Komfort, kein Datenverlust.
  }
}
