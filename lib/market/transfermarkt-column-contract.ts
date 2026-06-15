export type TransfermarktColumnGroup = "core" | "detail" | "fit";

export type TransfermarktColumnContractEntry = {
  id: string;
  label: string;
  dataKey: string;
  group: TransfermarktColumnGroup;
  teamDependent: boolean;
  defaultWidth: number;
  minWidth: number;
};

export const TRANSFERMARKT_COLUMN_CONTRACT: TransfermarktColumnContractEntry[] = [
  { id: "imageUrl", label: "Bild", dataKey: "imageUrl", group: "core", teamDependent: false, defaultWidth: 112, minWidth: 84 },
  { id: "name", label: "Name", dataKey: "name", group: "core", teamDependent: false, defaultWidth: 240, minWidth: 180 },
  { id: "marketValue", label: "Marktwert", dataKey: "marketValue", group: "core", teamDependent: false, defaultWidth: 170, minWidth: 130 },
  { id: "salary", label: "Gehalt", dataKey: "salary", group: "core", teamDependent: false, defaultWidth: 150, minWidth: 120 },
  { id: "pow", label: "POW", dataKey: "pow", group: "core", teamDependent: false, defaultWidth: 82, minWidth: 68 },
  { id: "spe", label: "SPE", dataKey: "spe", group: "core", teamDependent: false, defaultWidth: 82, minWidth: 68 },
  { id: "men", label: "MEN", dataKey: "men", group: "core", teamDependent: false, defaultWidth: 82, minWidth: 68 },
  { id: "soc", label: "SOC", dataKey: "soc", group: "core", teamDependent: false, defaultWidth: 82, minWidth: 68 },
  { id: "className", label: "Klasse", dataKey: "className", group: "core", teamDependent: false, defaultWidth: 130, minWidth: 110 },
  { id: "subclasses", label: "Subclasses", dataKey: "subclasses", group: "core", teamDependent: false, defaultWidth: 190, minWidth: 150 },
  { id: "traits", label: "Traits", dataKey: "traits", group: "core", teamDependent: false, defaultWidth: 220, minWidth: 170 },
  { id: "topDisciplineScores", label: "Diszi (3)", dataKey: "topDisciplineScores", group: "core", teamDependent: false, defaultWidth: 168, minWidth: 138 },
  { id: "potentialTier", label: "PO", dataKey: "potentialTier", group: "core", teamDependent: false, defaultWidth: 72, minWidth: 62 },
  { id: "trainingFormTier", label: "Train", dataKey: "trainingFormTier", group: "core", teamDependent: false, defaultWidth: 82, minWidth: 70 },
  { id: "developmentRoute", label: "Dev Road", dataKey: "developmentRoute", group: "core", teamDependent: false, defaultWidth: 128, minWidth: 104 },
  { id: "regressionRisk", label: "Risk", dataKey: "regressionRisk", group: "core", teamDependent: false, defaultWidth: 96, minWidth: 80 },
  { id: "fitDisplay", label: "Fit", dataKey: "fitDisplay", group: "core", teamDependent: true, defaultWidth: 100, minWidth: 86 },
  { id: "bracket", label: "Bracket", dataKey: "bracket", group: "core", teamDependent: false, defaultWidth: 100, minWidth: 84 },
  { id: "race", label: "Rasse", dataKey: "race", group: "core", teamDependent: false, defaultWidth: 130, minWidth: 110 },
  { id: "powerRating", label: "Pow", dataKey: "powerRating", group: "detail", teamDependent: false, defaultWidth: 92, minWidth: 72 },
  { id: "healthRating", label: "Hea", dataKey: "healthRating", group: "detail", teamDependent: false, defaultWidth: 92, minWidth: 72 },
  { id: "staminaRating", label: "Sta", dataKey: "staminaRating", group: "detail", teamDependent: false, defaultWidth: 92, minWidth: 72 },
  { id: "intelligenceRating", label: "Int", dataKey: "intelligenceRating", group: "detail", teamDependent: false, defaultWidth: 92, minWidth: 72 },
  { id: "determinationRating", label: "Det", dataKey: "determinationRating", group: "detail", teamDependent: false, defaultWidth: 92, minWidth: 72 },
  { id: "awarenessRating", label: "Awa", dataKey: "awarenessRating", group: "detail", teamDependent: false, defaultWidth: 92, minWidth: 72 },
  { id: "speedRating", label: "Spe", dataKey: "speedRating", group: "detail", teamDependent: false, defaultWidth: 92, minWidth: 72 },
  { id: "dexterityRating", label: "Dex", dataKey: "dexterityRating", group: "detail", teamDependent: false, defaultWidth: 92, minWidth: 72 },
  { id: "charismaRating", label: "Cha", dataKey: "charismaRating", group: "detail", teamDependent: false, defaultWidth: 92, minWidth: 72 },
  { id: "willRating", label: "Wil", dataKey: "willRating", group: "detail", teamDependent: false, defaultWidth: 92, minWidth: 72 },
  { id: "spiritRating", label: "Spi", dataKey: "spiritRating", group: "detail", teamDependent: false, defaultWidth: 92, minWidth: 72 },
  { id: "tormentRating", label: "Tor", dataKey: "tormentRating", group: "detail", teamDependent: false, defaultWidth: 92, minWidth: 72 },
  { id: "alignment", label: "Alignment", dataKey: "alignment", group: "detail", teamDependent: false, defaultWidth: 130, minWidth: 110 },
  { id: "gender", label: "Geschlecht", dataKey: "gender", group: "detail", teamDependent: false, defaultWidth: 120, minWidth: 100 },
  {
    id: "marketValueSalaryRatio",
    label: "Marktwert gehalt ratio",
    dataKey: "marketValueSalaryRatio",
    group: "detail",
    teamDependent: false,
    defaultWidth: 160,
    minWidth: 130,
  },
  { id: "fitRace", label: "Fit Rasse", dataKey: "fitRace", group: "fit", teamDependent: true, defaultWidth: 110, minWidth: 90 },
  { id: "fitSubclasses", label: "Fit Subclasses", dataKey: "fitSubclasses", group: "fit", teamDependent: true, defaultWidth: 140, minWidth: 110 },
  { id: "fitTraits", label: "Fit Traits", dataKey: "fitTraits", group: "fit", teamDependent: true, defaultWidth: 120, minWidth: 100 },
  { id: "fitAlignment", label: "Fit Alignment", dataKey: "fitAlignment", group: "fit", teamDependent: true, defaultWidth: 130, minWidth: 110 },
];

export function getTransfermarktBaseColumns() {
  return TRANSFERMARKT_COLUMN_CONTRACT.filter((entry) => entry.group === "core");
}

export function getTransfermarktAdvancedColumns() {
  return TRANSFERMARKT_COLUMN_CONTRACT.filter((entry) => entry.group !== "core");
}
