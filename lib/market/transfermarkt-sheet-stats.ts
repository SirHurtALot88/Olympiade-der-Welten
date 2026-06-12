export type TransfermarktRatingTier = "S+" | "S" | "A" | "B" | "C" | "D" | "E" | "F";

export type TransfermarktSheetStats = {
  playerName: string;
  displayMarketValue: number | null;
  displaySalary: number | null;
  cost: number | null;
  upkeepBase: number | null;
  referenceClass: string | null;
  imageSource: string | null;
  bracketLabel: string | null;
  pow: number | null;
  spe: number | null;
  men: number | null;
  soc: number | null;
  powerRating: TransfermarktRatingTier | null;
  healthRating: TransfermarktRatingTier | null;
  staminaRating: TransfermarktRatingTier | null;
  intelligenceRating: TransfermarktRatingTier | null;
  determinationRating: TransfermarktRatingTier | null;
  awarenessRating: TransfermarktRatingTier | null;
  speedRating: TransfermarktRatingTier | null;
  dexterityRating: TransfermarktRatingTier | null;
  charismaRating: TransfermarktRatingTier | null;
  willRating: TransfermarktRatingTier | null;
  spiritRating: TransfermarktRatingTier | null;
  tormentRating: TransfermarktRatingTier | null;
};

const PLAYER_SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1Y4DJWoLBcEAWuS4dXTqnZK_6UXZe7NJtRD-rNjYc8Fk/export?format=csv&gid=1895535866";

const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedRows:
  | {
      loadedAt: number;
      byName: Map<string, TransfermarktSheetStats>;
    }
  | null = null;

function normalizePlayerName(value: string) {
  return value.trim().toLocaleLowerCase("de");
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === "\"") {
      if (inQuotes && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
        continue;
      }

      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function parseCsv(text: string) {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map(parseCsvLine);
}

function parseSheetNumber(value: string | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed === "-" || trimmed === "#NV" || trimmed === "#N/A") {
    return null;
  }

  const normalized = trimmed.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getTransfermarktTierFromPoints(value: number | null): TransfermarktRatingTier | null {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }

  if (value >= 88) return "S+";
  if (value >= 82) return "S";
  if (value >= 76) return "A";
  if (value >= 70) return "B";
  if (value >= 64) return "C";
  if (value >= 58) return "D";
  if (value >= 52) return "E";
  return "F";
}

function buildProxyRatings(playerName: string, pow: number | null, spe: number | null, men: number | null, soc: number | null) {
  return {
    playerName,
    displayMarketValue: null,
    displaySalary: null,
    cost: null,
    upkeepBase: null,
    referenceClass: null,
    imageSource: null,
    bracketLabel: null,
    pow,
    spe,
    men,
    soc,
    powerRating: getTransfermarktTierFromPoints(pow),
    healthRating: getTransfermarktTierFromPoints(pow),
    staminaRating: getTransfermarktTierFromPoints(spe),
    intelligenceRating: getTransfermarktTierFromPoints(men),
    determinationRating: getTransfermarktTierFromPoints(men),
    awarenessRating: getTransfermarktTierFromPoints(men),
    speedRating: getTransfermarktTierFromPoints(spe),
    dexterityRating: getTransfermarktTierFromPoints(spe),
    charismaRating: getTransfermarktTierFromPoints(soc),
    willRating: getTransfermarktTierFromPoints(men),
    spiritRating: getTransfermarktTierFromPoints(soc),
    tormentRating: getTransfermarktTierFromPoints(soc),
  } satisfies TransfermarktSheetStats;
}

async function fetchTransfermarktSheetStats() {
  const response = await fetch(PLAYER_SHEET_CSV_URL, {
    cache: "no-store",
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch player sheet CSV (${response.status}).`);
  }

  const rows = parseCsv(await response.text());
  const [headerRow, ...valueRows] = rows;
  const headerIndex = new Map(headerRow.map((header, index) => [header.trim(), index]));
  const byName = new Map<string, TransfermarktSheetStats>();

  for (const row of valueRows) {
    const playerName = row[headerIndex.get("Name") ?? -1]?.trim();
    if (!playerName) {
      continue;
    }

    byName.set(
      normalizePlayerName(playerName),
      {
        ...buildProxyRatings(
        playerName,
        parseSheetNumber(row[headerIndex.get("Pow") ?? -1]),
        parseSheetNumber(row[headerIndex.get("Spe") ?? -1]),
        parseSheetNumber(row[headerIndex.get("Men") ?? -1]),
        parseSheetNumber(row[headerIndex.get("Soc") ?? -1]),
        ),
        displayMarketValue: parseSheetNumber(row[headerIndex.get("Marktwert") ?? -1]),
        displaySalary: parseSheetNumber(row[headerIndex.get("Gehalt") ?? -1]),
        cost: parseSheetNumber(row[headerIndex.get("Kosten") ?? -1]),
        upkeepBase: parseSheetNumber(row[headerIndex.get("Unterhalt") ?? -1]),
        referenceClass: row[headerIndex.get("Referenz Klasse") ?? -1]?.trim() || null,
        imageSource: row[headerIndex.get("Bild") ?? -1]?.trim() || null,
        bracketLabel: row[headerIndex.get("Bracket") ?? -1]?.trim() || null,
      },
    );
  }

  return byName;
}

export async function loadTransfermarktSheetStats() {
  const now = Date.now();
  if (cachedRows && now - cachedRows.loadedAt < CACHE_TTL_MS) {
    return cachedRows.byName;
  }

  const byName = await fetchTransfermarktSheetStats();
  cachedRows = { loadedAt: now, byName };
  return byName;
}
