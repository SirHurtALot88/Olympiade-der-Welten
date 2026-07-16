import { access } from "node:fs/promises";
import path from "node:path";

export type RetoolParityStatus =
  | "ported"
  | "partially_ported"
  | "referenced_only"
  | "missing"
  | "obsolete";

export type RetoolParityRow = {
  retoolFile: string;
  purpose: string;
  localAppFile: string;
  status: RetoolParityStatus;
  openGap: string;
};

const REFERENCE_ROOT = path.join(process.cwd(), "references", "retool-ai-golden-master");

const RETOOL_PARITY_ROWS: Array<Omit<RetoolParityRow, "status"> & { sourceCandidates: string[]; defaultStatus: RetoolParityStatus }> = [
  {
    retoolFile: "AI2_06_SimulatePicks.js",
    purpose: "Saisonweiter AI-Pick-Lauf und Sequenz-Trigger",
    localAppFile: "lib/ai/ai-picks-run-service.ts",
    defaultStatus: "partially_ported",
    openGap: "DryRun/Execute-Trace und harte Source-of-Truth-Audits waren bislang nicht komplett sichtbar.",
    sourceCandidates: ["AI2_06_SimulatePicks.js", "AI2_06_SimulatePicks.txt"],
  },
  {
    retoolFile: "aiSNP_pickStep.js",
    purpose: "einzelner sequentieller Pick-Step",
    localAppFile: "lib/ai/ai-needs-picks-compare-service.ts",
    defaultStatus: "partially_ported",
    openGap: "Retool-nahe Step-Transparenz ist vorhanden, aber noch nicht als Pflicht-Trace ausgegeben.",
    sourceCandidates: ["aiSNP_pickStep.js"],
  },
  {
    retoolFile: "finalPicksScore100_v2_withWant.js",
    purpose: "Pick-Scoring und Want-/Need-Gewichtung",
    localAppFile: "lib/ai/ai-needs-picks-compare-service.ts",
    defaultStatus: "partially_ported",
    openGap: "Scoring ist lokal nachgebaut, aber Golden-Master-Vergleich bleibt nur teilweise belastbar.",
    sourceCandidates: ["finalPicksScore100_v2_withWant.js", "finalPicksScore100_v2_withWant.txt"],
  },
  {
    retoolFile: "aiPackageScoringConfig.state.js",
    purpose: "globale Paket- und Lane-Konfiguration",
    localAppFile: "lib/ai/ai-needs-picks-compare-service.ts",
    defaultStatus: "partially_ported",
    openGap: "Konfiguration ist verteilt in lokaler Logic statt 1:1 als separater Config-Layer.",
    sourceCandidates: ["aiPackageScoringConfig.state.js", "aiPackageScoringConfig.txt"],
  },
  {
    retoolFile: "cashCreatorPackageScoringConfig.state.js",
    purpose: "team-spezifische C-C-Paketlogik",
    localAppFile: "lib/foundation/team-strategy-profiles.ts",
    defaultStatus: "partially_ported",
    openGap: "Teamprofile sind portiert, aber nicht jede team-spezifische Lane-Regel ist isoliert abbildbar.",
    sourceCandidates: ["cashCreatorPackageScoringConfig.state.js"],
  },
  {
    retoolFile: "seasonPlannerEngine.js",
    purpose: "Saisonplaner über Needs, Budget und Teamidentität",
    localAppFile: "lib/ai/ai-needs-picks-compare-service.ts",
    defaultStatus: "partially_ported",
    openGap: "Preisgeld-/Budgetprojektion ist lokal vorhanden, aber noch nicht voll als führender Planner-State abgesichert.",
    sourceCandidates: ["seasonPlannerEngine.js", "seasonPlannerEngine.txt", "seasonPlannerEngine.state.js"],
  },
  {
    retoolFile: "aiPickSeasonPlan.js",
    purpose: "Plan-Struktur über mehrere Pick-Phasen",
    localAppFile: "lib/ai/ai-needs-picks-compare-service.ts",
    defaultStatus: "partially_ported",
    openGap: "Globale Minimum-Phase und erklärbare Pick-Phasen sind noch nicht auf allen Outputs sichtbar.",
    sourceCandidates: ["aiPickSeasonPlan.js", "aiPickSeasonPlan.txt"],
  },
  {
    retoolFile: "aiPickSeasonPreview.js",
    purpose: "Preview-Ausgabe des Season-Plans",
    localAppFile: "lib/ai/ai-needs-picks-compare-service.ts",
    defaultStatus: "partially_ported",
    openGap: "Preview ist vorhanden, aber DryRun/Execute-Parität und Pool-Audits fehlten bisher in der Ausgabe.",
    sourceCandidates: ["aiPickSeasonPreview.js", "aiPickSeasonPreview.txt", "aiPickSeasonPreview.state.js"],
  },
  {
    retoolFile: "aiSequentialNeedsPreview.js",
    purpose: "sequentielle Needs-Neuberechnung je Pick",
    localAppFile: "lib/ai/ai-needs-picks-compare-service.ts",
    defaultStatus: "ported",
    openGap: "Sequentielle Needs laufen lokal, müssen aber weiterhin gegen Golden-Master-Läufe validiert werden.",
    sourceCandidates: ["aiSequentialNeedsPreview.js", "aiSequentialNeedsPreview.txt"],
  },
  {
    retoolFile: "aiTeamNeedsQuery.js",
    purpose: "Team-Needs und Achsenlücken",
    localAppFile: "lib/ai/ai-needs-engine.ts",
    defaultStatus: "ported",
    openGap: "Feintuning einzelner Need-Felder kann noch vom Retool abweichen.",
    sourceCandidates: ["aiTeamNeedsQuery.js", "aiTeamNeedsQuery.txt"],
  },
  {
    retoolFile: "aiTransferCandidatePool.txt",
    purpose: "Kandidatenpool vor dem Reranking",
    localAppFile: "lib/ai/ai-transfermarkt-preview-service.ts",
    defaultStatus: "partially_ported",
    openGap: "Pool- und Feed-Audit musste erst explizit ergänzt werden, damit UI und AI dieselben günstigen Spieler sehen.",
    sourceCandidates: ["aiTransferCandidatePool.txt"],
  },
  {
    retoolFile: "aiTransferPicksBase.txt",
    purpose: "Basisliste der Picks vor Skill-/Need-Gewichtung",
    localAppFile: "lib/ai/ai-needs-picks-compare-service.ts",
    defaultStatus: "partially_ported",
    openGap: "Base-Picks sind lokal vorhanden, aber Golden-Master-Abgleich ist nur für Teilteams belastbar.",
    sourceCandidates: ["aiTransferPicksBase.txt"],
  },
  {
    retoolFile: "aiTransferPicksSkillWeighted.txt",
    purpose: "gewichtete Picks nach Skills und Needs",
    localAppFile: "lib/ai/ai-needs-picks-compare-service.ts",
    defaultStatus: "partially_ported",
    openGap: "Skill-weighted Reihenfolge ist lokal angenähert, aber noch nicht für alle Fokus-Teams must-feel-right gehärtet.",
    sourceCandidates: ["aiTransferPicksSkillWeighted.txt", "aiTransferPicksSkillWeighted.js", "aiTransferPicksSkillWeighted.state.js"],
  },
  {
    retoolFile: "rosterNeeds.txt",
    purpose: "Rosterdruck und fehlende Rollen",
    localAppFile: "lib/ai/ai-needs-engine.ts",
    defaultStatus: "ported",
    openGap: "Globale Minimum-Phase muss in den Outputs noch klarer markiert bleiben.",
    sourceCandidates: ["rosterNeeds.txt"],
  },
  {
    retoolFile: "rosterPressureProfile.txt",
    purpose: "Druckprofil je Team zwischen Minimum, Optimum und Luxus",
    localAppFile: "lib/ai/ai-needs-picks-compare-service.ts",
    defaultStatus: "partially_ported",
    openGap: "Pressure-Profile wirken bereits, sind aber noch nicht als eigener Audit-Block exportiert.",
    sourceCandidates: ["rosterPressureProfile.txt"],
  },
  {
    retoolFile: "teamIdentityOverrides.js",
    purpose: "explizite Teamidentität und Sonderfälle",
    localAppFile: "lib/foundation/team-identity-settings.ts",
    defaultStatus: "ported",
    openGap: "Overrides sind lokal da, aber für einige Teams fehlt noch der abschließende Live-Validation-Lauf.",
    sourceCandidates: ["teamIdentityOverrides.js", "teamIdentityOverrides.txt", "teamIdentityOverrides.state.js"],
  },
  {
    retoolFile: "teamIdentityWeights.txt",
    purpose: "Gewichtung der Teamidentität im Pick-Scoring",
    localAppFile: "lib/ai/ai-needs-picks-compare-service.ts",
    defaultStatus: "partially_ported",
    openGap: "Identity greift lokal schon früher, muss aber noch feiner gegen Value/Need/Lane balanciert werden.",
    sourceCandidates: ["teamIdentityWeights.txt"],
  },
  {
    retoolFile: "disciplineRecipesGlobal.txt",
    purpose: "globale Diszi-Rezepte und Verknüpfungen",
    localAppFile: "lib/season/season-discipline-schedule.ts",
    defaultStatus: "referenced_only",
    openGap: "Diszi-Rezepte werden lokal als Referenz genutzt, aber nicht als eigener Planner-Input-Layer geführt.",
    sourceCandidates: ["disciplineRecipesGlobal.txt", "disciplineRecipesGlobal.js", "disciplineRecipesGlobal.state.js"],
  },
];

async function fileExists(candidate: string) {
  try {
    await access(path.join(REFERENCE_ROOT, candidate));
    return true;
  } catch {
    return false;
  }
}

export async function buildRetoolParityMatrix(): Promise<RetoolParityRow[]> {
  const rows = await Promise.all(
    RETOOL_PARITY_ROWS.map(async (row) => {
      const exists = await Promise.all(row.sourceCandidates.map((candidate) => fileExists(candidate)));
      const hasSource = exists.some(Boolean);
      return {
        retoolFile: row.retoolFile,
        purpose: row.purpose,
        localAppFile: row.localAppFile,
        status: hasSource ? row.defaultStatus : "missing",
        openGap: hasSource ? row.openGap : "Retool-Quelle fehlt im lokalen Golden-Master-Ordner.",
      } satisfies RetoolParityRow;
    }),
  );

  return rows;
}
