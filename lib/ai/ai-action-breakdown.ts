/**
 * Gemeinsame Kategorie-Zuordnung für AI-Manager-Aktionen (Preseason-Automatik).
 *
 * Diese Datei ist die EINE Wahrheit für die Übersetzung roher Aktionstypen
 * (`set_training_focus`, `maintain_building`, …) in die menschenlesbaren
 * deutschen Kategorien, die im UI ("Training", "Gebäude", …) erscheinen.
 * Sie wird sowohl serverseitig (Anreicherung des Preseason-Run-Records) als
 * auch clientseitig (Diagnose-Panel) verwendet — daher rein und ohne
 * Server-/Persistence-Abhängigkeiten.
 */

// Rohe AI-Aktionscodes in menschenlesbare Kategorien übersetzen.
export const AI_ACTION_CATEGORY_LABELS: Record<string, string> = {
  set_training_focus: "Training",
  set_training_intensity: "Training",
  set_player_training_modes: "Training",
  set_player_training_classes: "Training",
  maintain_building: "Gebäude",
  upgrade_building: "Gebäude",
  buy_building: "Gebäude",
  downgrade_building: "Gebäude",
  reserve_transfer_budget: "Budgetplanung",
  reserve_salary_budget: "Budgetplanung",
  reserve_maintenance_budget: "Budgetplanung",
  mark_contract_strategy: "Verträge",
  mark_sell_strategy: "Verkaufsplan",
};

// Stabile Anzeige-Reihenfolge der Kategorien (Setup-Reihenfolge der Preseason-Automatik):
// erst kader-unabhängige Vor-Draft-Aktionen, dann das kader-abhängige Training.
const AI_ACTION_CATEGORY_ORDER = ["Budgetplanung", "Gebäude", "Verträge", "Verkaufsplan", "Training"] as const;

export function categoryForAiActionType(actionType: string | null | undefined): string | null {
  if (!actionType) return null;
  return AI_ACTION_CATEGORY_LABELS[actionType] ?? null;
}

export type AiActionBreakdownEntry = {
  category: string;
  applied: number;
  blocked: number;
};

type BreakdownActionInput = {
  actionType: string;
  applied?: boolean;
  blockers?: readonly string[];
};

/**
 * Verdichtet eine Liste von AI-Manager-Aktionen zu einer kompakten
 * Kategorie-Aufstellung (angewandt vs. blockiert). Eine Aktion zählt als
 * `applied`, wenn `applied === true`; ansonsten als `blocked`, wenn sie
 * mindestens einen Blocker trägt. Aktionen ohne bekannte Kategorie werden
 * ignoriert.
 */
export function buildAiActionBreakdown(actions: ReadonlyArray<BreakdownActionInput>): AiActionBreakdownEntry[] {
  const tally = new Map<string, { applied: number; blocked: number }>();
  for (const action of actions) {
    const category = categoryForAiActionType(action.actionType);
    if (!category) continue;
    const entry = tally.get(category) ?? { applied: 0, blocked: 0 };
    if (action.applied) {
      entry.applied += 1;
    } else if ((action.blockers?.length ?? 0) > 0) {
      entry.blocked += 1;
    }
    tally.set(category, entry);
  }
  return [...tally.entries()]
    .map(([category, counts]) => ({ category, ...counts }))
    .sort((a, b) => {
      const orderA = AI_ACTION_CATEGORY_ORDER.indexOf(a.category as (typeof AI_ACTION_CATEGORY_ORDER)[number]);
      const orderB = AI_ACTION_CATEGORY_ORDER.indexOf(b.category as (typeof AI_ACTION_CATEGORY_ORDER)[number]);
      return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB);
    });
}

/**
 * Fallback für alte Run-Records OHNE `actionBreakdown`: leitet eine
 * blockiert-je-Kategorie-Aufstellung aus den rohen `blockingReasons`-Strings
 * (`teamCode:actionType:reason`) ab. Die `applied`-Zahl lässt sich aus diesen
 * Strings nicht rekonstruieren und bleibt daher 0.
 */
export function deriveBlockedBreakdownFromReasons(blockingReasons: readonly string[]): AiActionBreakdownEntry[] {
  const tally = new Map<string, number>();
  for (const reason of blockingReasons) {
    // Manager-Blocker: `teamCode:actionType:blocker`. Marktblocker haben kein
    // Manager-Actiontype-Segment und werden hier bewusst übersprungen.
    const actionType = reason.split(":")[1];
    const category = categoryForAiActionType(actionType);
    if (!category) continue;
    tally.set(category, (tally.get(category) ?? 0) + 1);
  }
  return [...tally.entries()]
    .map(([category, blocked]) => ({ category, applied: 0, blocked }))
    .sort((a, b) => {
      const orderA = AI_ACTION_CATEGORY_ORDER.indexOf(a.category as (typeof AI_ACTION_CATEGORY_ORDER)[number]);
      const orderB = AI_ACTION_CATEGORY_ORDER.indexOf(b.category as (typeof AI_ACTION_CATEGORY_ORDER)[number]);
      return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB);
    });
}
