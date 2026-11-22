import teamFitMatrixSource from "@/data/source/team-fit-matrix.json";

type TeamFitMatrixRow = {
  teamId: string;
  playerGroup: string | null;
  fits: Record<string, number>;
  sum: number | null;
};

type TeamFitMatrixSource = {
  source: {
    sheetId: string;
    sheets: {
      races: string;
      subclasses: string;
    };
    syncedAt: string;
  };
  races: {
    tokens: string[];
    rows: TeamFitMatrixRow[];
  };
  subclasses: {
    tokens: string[];
    rows: TeamFitMatrixRow[];
  };
};

const typedSource = teamFitMatrixSource as TeamFitMatrixSource;

function normalizeMatrixToken(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return String(value)
    .replace(/[\s-]/g, "_")
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "")
    .replace(/__+/g, "_");
}

/**
 * A matrix row plus a precomputed `normalizedKey → fit` map. The raw `fits` keys need
 * `normalizeMatrixToken` to match a lookup token, and building/scanning `Object.entries(fits)` with a
 * per-key regex normalization on EVERY lookup was a real hot-loop cost (each candidate fit-scan does
 * 1 race + N subclass lookups, each re-normalizing all ~18–54 keys). Normalize the keys ONCE at module
 * load so a lookup is an O(1) `Map.get(normalizedToken)` instead of an O(keys)·regex scan. Identical
 * values — this is a pure speedup.
 */
type NormalizedFitRow = { row: TeamFitMatrixRow; fitsByNormalizedKey: Map<string, number> };

function buildRowsByTeamId(rows: TeamFitMatrixRow[]) {
  return new Map(
    rows.map((row) => {
      const fitsByNormalizedKey = new Map<string, number>();
      for (const [key, value] of Object.entries(row.fits)) {
        fitsByNormalizedKey.set(normalizeMatrixToken(key), value);
      }
      return [normalizeMatrixToken(row.teamId), { row, fitsByNormalizedKey } satisfies NormalizedFitRow] as const;
    }),
  );
}

const raceRowsByTeamId = buildRowsByTeamId(typedSource.races.rows);
const subclassRowsByTeamId = buildRowsByTeamId(typedSource.subclasses.rows);

/**
 * Fund 21.11. beim 40-Teams-Mockup: Matrix und Spielerpool benannten zwei Tokens verschieden, die Spalte
 * griff für diese Spieler nie (z. B. D-P −10 auf Aqua-Spieler, The Giants +5 auf Behemoths).
 * - Rasse: Chris „fish = aqua“ — die Matrix heißt seitdem selbst `Aqua` (auch der Sheet-Abgleich
 *   übersetzt). `fish` bleibt hier nur als Rückfall für Altdaten (ein Spieler im Pool trägt noch „Fish“).
 * - Subklasse: Matrix `Giant`, Pool `Behemoth` (161 Spieler) — Übersetzung beim Nachschlagen.
 */
const POOL_ZU_MATRIX_TOKEN: Record<string, string> = {
  fish: "aqua",
  behemoth: "giant",
};

function getTokenFit(entry: NormalizedFitRow | null | undefined, token: string | null | undefined) {
  if (!entry || !token) {
    return null;
  }

  const normalized = normalizeMatrixToken(token);
  return (
    entry.fitsByNormalizedKey.get(normalized) ??
    (POOL_ZU_MATRIX_TOKEN[normalized] ? entry.fitsByNormalizedKey.get(POOL_ZU_MATRIX_TOKEN[normalized]) : undefined) ??
    null
  );
}

export function getTeamRaceFit(input: { teamId?: string | null; race?: string | null }) {
  const row = raceRowsByTeamId.get(normalizeMatrixToken(input.teamId));
  return getTokenFit(row, input.race);
}

export function getTeamSubclassFit(input: { teamId?: string | null; subclass?: string | null }) {
  const row = subclassRowsByTeamId.get(normalizeMatrixToken(input.teamId));
  return getTokenFit(row, input.subclass);
}

export function getTeamSubclassFitSum(input: { teamId?: string | null; subclasses: string[] }) {
  // Fetch the team's subclass row ONCE (not per subclass) — this is called per candidate in the
  // redraft fit-scan, so the per-subclass row lookup + teamId re-normalization added up.
  const row = subclassRowsByTeamId.get(normalizeMatrixToken(input.teamId));
  if (!row) return null;
  let hasAnyFit = false;
  const total = input.subclasses.reduce((sum, subclass) => {
    const fit = getTokenFit(row, subclass);
    if (fit == null) {
      return sum;
    }
    hasAnyFit = true;
    return sum + fit;
  }, 0);

  return hasAnyFit ? total : null;
}

export function getTeamFitMatrixSourceInfo() {
  return typedSource.source;
}
