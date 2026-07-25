/**
 * T-032: `executeCashPrizeApply`/`previewCashPrizeApply` sind ein Debug-/Benchmark-Endpoint für die
 * Preisgeld-Berechnung — solange dieses Flag `true` ist, wird ausschließlich der Preisgeld/Sponsor-
 * Benchmark (inkl. Audit-Log `cashPrizeApplyLogs`) persistiert; Team-Cash bleibt unverändert (kein
 * echter Payout). `lib/season/economy-audit-report.ts` liest dieses Flag deshalb explizit, um einen
 * ausgeführten Benchmark-Apply NICHT als `cash_prize_apply_executed`-Verstoß zu werten. Wird dieser
 * Pfad je auf echten Cash-Payout umgestellt, muss dieses Flag auf `false` gesetzt UND der Audit-Report
 * um eine echte Payout-Prüfung erweitert werden.
 *
 * Liegt in einem eigenen, client-sicheren Modul (ohne Persistence-/node:fs-Import), damit UI-Hooks
 * das Flag lesen können, ohne server-only Code in den Client-Bundle zu ziehen.
 */
export const CASH_PRIZE_BENCHMARK_ONLY = true;
