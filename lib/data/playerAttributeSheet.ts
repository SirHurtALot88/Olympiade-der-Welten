const ATTRIBUTE_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1Y4DJWoLBcEAWuS4dXTqnZK_6UXZe7NJtRD-rNjYc8Fk/export?format=csv&gid=589766543";

export const ATTRIBUTE_SHEET_ALIASES: Record<string, string> = {
  "Riley Le Rouge": "Riley Le Rogue",
};

export type PlayerAttributeSheetRow = {
  name: string;
  height: number | null;
  power: number | null;
  health: number | null;
  stamina: number | null;
  intelligence: number | null;
  awareness: number | null;
  determination: number | null;
  speed: number | null;
  dexterity: number | null;
  charisma: number | null;
  will: number | null;
  spirit: number | null;
  torment: number | null;
  powerRating: string | null;
  healthRating: string | null;
  staminaRating: string | null;
  intelligenceRating: string | null;
  awarenessRating: string | null;
  determinationRating: string | null;
  speedRating: string | null;
  dexterityRating: string | null;
  charismaRating: string | null;
  willRating: string | null;
  spiritRating: string | null;
  tormentRating: string | null;
};

type CsvRecord = Record<string, string>;

function parseCsv(text: string) {
  const rows: string[][] = [];
  let currentField = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char === "\"") {
      if (inQuotes && text[index + 1] === "\"") {
        currentField += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentField);
      currentField = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
      currentRow.push(currentField);
      rows.push(currentRow);
      currentField = "";
      currentRow = [];
      continue;
    }

    currentField += char;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((value) => value.trim().length > 0));
}

function toRecords(text: string): CsvRecord[] {
  const rows = parseCsv(text);
  const header = rows[0] ?? [];

  return rows.slice(1).map((row) => {
    const record: CsvRecord = {};
    for (let index = 0; index < header.length; index += 1) {
      record[header[index]] = row[index] ?? "";
    }
    return record;
  });
}

function toNumber(value: string | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function toRating(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function toPlayerAttributeSheetRow(record: CsvRecord): PlayerAttributeSheetRow {
  return {
    name: record.Name?.trim() ?? "",
    height: toNumber(record.Height ?? record.height ?? record.Size ?? record.Groesse ?? record["Größe"]),
    power: toNumber(record.Power),
    health: toNumber(record.Health),
    stamina: toNumber(record.Stamina),
    intelligence: toNumber(record.Intelligence),
    awareness: toNumber(record.Awareness),
    determination: toNumber(record.Determination),
    speed: toNumber(record.Speed),
    dexterity: toNumber(record.Dexterity),
    charisma: toNumber(record.Charisma),
    will: toNumber(record.Will),
    spirit: toNumber(record.Spirit),
    torment: toNumber(record.Torment),
    powerRating: toRating(record["Power Rating"]),
    healthRating: toRating(record["Health Rating"]),
    staminaRating: toRating(record["Stamina Rating"]),
    intelligenceRating: toRating(record["Intelligence Rating"]),
    awarenessRating: toRating(record["Awareness Rating"]),
    determinationRating: toRating(record["Determination Rating"]),
    speedRating: toRating(record["Speed Rating"]),
    dexterityRating: toRating(record["Dexterity Rating"]),
    charismaRating: toRating(record["Charisma Rating"]),
    willRating: toRating(record["Will Rating"]),
    spiritRating: toRating(record["Spirit Rating"]),
    tormentRating: toRating(record["Torment Rating"]),
  };
}

export function normalizeAttributeSheetName(name: string) {
  return ATTRIBUTE_SHEET_ALIASES[name] ?? name;
}

export async function fetchPlayerAttributeSheetRows(
  fetchImpl: typeof fetch = fetch,
): Promise<PlayerAttributeSheetRow[]> {
  const response = await fetchImpl(ATTRIBUTE_SHEET_URL, {
    headers: {
      accept: "text/csv,text/plain;q=0.9,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load Attribute sheet CSV (${response.status})`);
  }

  const text = await response.text();

  return toRecords(text).map(toPlayerAttributeSheetRow);
}

export function summarizeMissingAttributeRows(playerNames: string[], rows: PlayerAttributeSheetRow[]) {
  const sheetNames = new Set(rows.map((row) => normalizeAttributeSheetName(row.name)));
  return playerNames.filter((playerName) => !sheetNames.has(playerName));
}
