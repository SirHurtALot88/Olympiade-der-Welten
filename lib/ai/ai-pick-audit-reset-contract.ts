export const AI_PICK_AUDIT_RESET_CONFIRM_TOKEN = "RESET_AI_SETUP_TRANSFERS_ONLY";

export const AI_PICK_RESETTABLE_SOURCES = [
  "auto_roster_fill",
  "ai_roster_fill",
  "ai_buy",
  "setup_roster_fill",
  "mvp_bootstrap_fill",
  "smoke_bootstrap_fill",
] as const;

export type AiPickResettableSource = (typeof AI_PICK_RESETTABLE_SOURCES)[number];

export function isAiPickResettableSource(value: string | null | undefined): value is AiPickResettableSource {
  return typeof value === "string" && (AI_PICK_RESETTABLE_SOURCES as readonly string[]).includes(value);
}
