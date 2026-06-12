import saisonstandColumnContractJson from "@/references/retool-standings-economy/saisonstand-column-contract.json";

export type SaisonstandColumnSourceStatus =
  | "mapped"
  | "mapped_with_transform"
  | "missing_source"
  | "blocked_formula_unclear"
  | "intentionally_hidden"
  | "legacy_not_ported";

export type SaisonstandColumnContractEntry = {
  order: number;
  retoolColumnName: string;
  displayLabel: string;
  normalizedKey: string;
  retoolType: string;
  visibleInRetool: boolean;
  hiddenInRetool: boolean;
  currentAppField: string | null;
  sourceKind: string;
  sourceDescription: string;
  sourceStatus: SaisonstandColumnSourceStatus;
  transformNote: string | null;
  format: string;
  compactVisible: boolean;
  expertVisible: boolean;
  retoolColumnId: string;
  columnSize: number | null;
  alignment: string | null;
  headerBackgroundColor: string | null;
  headerTextColor: string | null;
  valueTransform?: string | null;
  decimalPlaces?: number | null;
  sortRole?: "points_desc" | "rank_asc" | "text" | "numeric" | null;
  notes?: string | null;
};

export type SaisonstandColumnContract = {
  generatedAt: string;
  sourceAppExportPath: string;
  sourceComponentId: string;
  sourcePage: string;
  dataSourceExpression: string;
  columns: SaisonstandColumnContractEntry[];
};

export const saisonstandColumnContract = saisonstandColumnContractJson as SaisonstandColumnContract;

export const saisonstandLeftPinnedColumns = [
  "platz",
  "mannschaft",
  "punkte",
 ] as const;

export const saisonstandDisciplineColumns = [
  "bonuspunkte",
  "tdm",
  "mini_dm",
  "gewichtheben",
  "hockey",
  "breaking",
  "staffel",
  "time_trial",
  "spurt",
  "climbing",
  "fechten",
  "schach",
  "takeshi",
  "tennis",
  "i_spy",
  "wettessen",
  "basketball",
  "football",
  "battlefield",
  "eiskunst",
  "showcase",
] as const;

export const saisonstandCompactFinanceColumns = [
  "vertragslange",
  "cash",
  "gehalt",
  "transfers",
  "guv",
  "cash_total",
] as const;

export const saisonstandFinanceColumns = [
  "vertragslange",
  "form",
  "transfers",
  "cash",
  "gehalt",
  "cash_fc",
  "startplatz",
  "rank_diff",
  "basis",
  "platzierung",
  "sponsor_season",
  "sponsor_total",
  "guv",
  "cash_total",
] as const;

const compactOrder = [
  ...saisonstandLeftPinnedColumns,
  ...saisonstandDisciplineColumns,
  ...saisonstandCompactFinanceColumns,
] as const;

const compactOrderIndex = new Map<string, number>(compactOrder.map((key, index) => [key, index]));

export const saisonstandExpertPresetOrder = [
  "platz",
  "mannschaft",
  "punkte",
  "bonuspunkte",
  "tdm",
  "mini_dm",
  "gewichtheben",
  "hockey",
  "breaking",
  "staffel",
  "time_trial",
  "spurt",
  "climbing",
  "fechten",
  "schach",
  "takeshi",
  "tennis",
  "i_spy",
  "wettessen",
  "basketball",
  "football",
  "battlefield",
  "eiskunst",
  "showcase",
  ...saisonstandFinanceColumns,
] as const;

const retoolVisualOrderIndex = new Map<string, number>(
  saisonstandExpertPresetOrder.map((key, index) => [key, index]),
);

export const saisonstandExpertPresetWidths: Record<string, number> = {
  platz: 72,
  mannschaft: 234,
  punkte: 78,
  bonuspunkte: 74,
  tdm: 52,
  mini_dm: 52,
  gewichtheben: 52,
  hockey: 52,
  breaking: 52,
  staffel: 52,
  time_trial: 52,
  takeshi: 52,
  spurt: 52,
  climbing: 52,
  fechten: 52,
  schach: 52,
  tennis: 52,
  i_spy: 52,
  wettessen: 52,
  basketball: 52,
  football: 52,
  battlefield: 52,
  eiskunst: 52,
  showcase: 52,
  vertragslange: 82,
  form: 58,
  transfers: 84,
  cash: 94,
  gehalt: 98,
  cash_fc: 84,
  startplatz: 56,
  rank_diff: 52,
  basis: 76,
  platzierung: 88,
  sponsor_season: 108,
  sponsor_total: 108,
  guv: 82,
  cash_total: 94,
};

export function getSaisonstandCompactContractColumns() {
  return saisonstandColumnContract.columns
    .filter((column) => column.compactVisible)
    .sort((left, right) => {
      const leftIndex = compactOrderIndex.get(left.normalizedKey) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = compactOrderIndex.get(right.normalizedKey) ?? Number.MAX_SAFE_INTEGER;
      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }

      return left.order - right.order;
    });
}

export function getSaisonstandExpertContractColumns() {
  return saisonstandColumnContract.columns
    .filter((column) => column.expertVisible && !column.hiddenInRetool)
    .sort((left, right) => {
      const leftIndex = retoolVisualOrderIndex.get(left.normalizedKey) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = retoolVisualOrderIndex.get(right.normalizedKey) ?? Number.MAX_SAFE_INTEGER;
      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }

      return left.order - right.order;
    });
}
