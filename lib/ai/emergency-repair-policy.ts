/**
 * Emergency roster repair (chunked redraft topup / preseason_roster_repair) is opt-in only.
 * Default: planner-only — no repair buys.
 */
export function isEmergencyRosterRepairEnabled(): boolean {
  return process.env.OLY_ENABLE_EMERGENCY_REPAIR === "1";
}
