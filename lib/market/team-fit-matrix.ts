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

function buildRowsByTeamId(rows: TeamFitMatrixRow[]) {
  return new Map(rows.map((row) => [normalizeMatrixToken(row.teamId), row] as const));
}

const raceRowsByTeamId = buildRowsByTeamId(typedSource.races.rows);
const subclassRowsByTeamId = buildRowsByTeamId(typedSource.subclasses.rows);

function getTokenFit(row: TeamFitMatrixRow | null | undefined, token: string | null | undefined) {
  if (!row || !token) {
    return null;
  }

  const normalizedToken = normalizeMatrixToken(token);
  const match = Object.entries(row.fits).find(([key]) => normalizeMatrixToken(key) === normalizedToken);
  return match ? match[1] : null;
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
  let hasAnyFit = false;
  const total = input.subclasses.reduce((sum, subclass) => {
    const fit = getTeamSubclassFit({ teamId: input.teamId, subclass });
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
