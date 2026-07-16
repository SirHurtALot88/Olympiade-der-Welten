/**
 * Central policy for mutating API routes and their server-authority expectations.
 * Used by tests/api-write-route-guard-coverage.test.ts as the contract source of truth.
 */
export type ApiWriteRoutePolicyEntry = {
  routePath: string;
  methods: Array<"POST" | "PUT" | "PATCH" | "DELETE">;
  policy: "require_room_write_guard" | "allowlisted";
  reason: string;
};

export const API_WRITE_ROUTE_ALLOWLIST: ApiWriteRoutePolicyEntry[] = [
  {
    routePath: "lineups/legacy/preview",
    methods: ["POST"],
    policy: "allowlisted",
    reason: "POST computes lineup preview only; does not persist game state.",
  },
  {
    routePath: "singleplayer-state",
    methods: ["PUT", "POST"],
    policy: "allowlisted",
    reason: "Save meta management (create, activate, compact put) — not a team gameplay write.",
  },
  {
    routePath: "singleplayer-state/season-start-reset",
    methods: ["POST"],
    policy: "allowlisted",
    reason: "Dev-only season start reset tooling.",
  },
  {
    routePath: "new-game",
    methods: ["POST"],
    policy: "allowlisted",
    reason: "Creates a new save; no active room context.",
  },
  {
    routePath: "admin/season-simulation",
    methods: ["POST"],
    policy: "allowlisted",
    reason: "Admin-only season simulation runner.",
  },
  {
    routePath: "season/whole-season-dryrun",
    methods: ["POST"],
    policy: "allowlisted",
    reason: "Dry-run orchestration without direct gameplay apply.",
  },
  {
    routePath: "season/season-snapshot",
    methods: ["POST"],
    policy: "allowlisted",
    reason: "Snapshot tooling with explicit confirmToken.",
  },
  {
    routePath: "ai/picks-import",
    methods: ["POST"],
    policy: "allowlisted",
    reason: "Import/audit tooling without gameplay write semantics.",
  },
  {
    routePath: "ai/picks-audit-reset",
    methods: ["POST"],
    policy: "allowlisted",
    reason: "Audit reset tooling without gameplay write semantics.",
  },
  {
    routePath: "ai/market-apply",
    methods: ["POST"],
    policy: "allowlisted",
    reason: "Delegates POST to ai/market-plan-apply which enforces the write guard.",
  },
  {
    routePath: "auth/login",
    methods: ["POST"],
    policy: "allowlisted",
    reason: "Session login — writes an auth session cookie, not save/gameplay state.",
  },
  {
    routePath: "auth/logout",
    methods: ["POST"],
    policy: "allowlisted",
    reason: "Session logout — clears an auth session cookie, not save/gameplay state.",
  },
  {
    routePath: "season/warmup-derivations",
    methods: ["POST"],
    policy: "allowlisted",
    reason: "Derived/cache-only season stats warmup; no teamId, no client-controlled gameplay fields.",
  },
];

export const API_WRITE_ROUTE_GUARD_REQUIRED: ApiWriteRoutePolicyEntry[] = [
  {
    routePath: "lineups/legacy/ai-batch-apply",
    methods: ["POST"],
    policy: "require_room_write_guard",
    reason: "Season-wide AI lineup batch apply mutates multiple teams.",
  },
  {
    routePath: "ai/preseason-background",
    methods: ["POST"],
    policy: "require_room_write_guard",
    reason: "Season-wide AI preseason automation mutates save state.",
  },
  {
    routePath: "ai/picks-run",
    methods: ["POST"],
    policy: "require_room_write_guard",
    reason: "AI picks execute mutates roster state across teams.",
  },
  {
    routePath: "ai/market-plan-apply",
    methods: ["POST"],
    policy: "require_room_write_guard",
    reason: "AI market apply mutates transfer state.",
  },
  {
    routePath: "ai/roster-fill",
    methods: ["POST"],
    policy: "require_room_write_guard",
    reason: "Auto roster fill execute mutates roster state.",
  },
  {
    routePath: "team-settings/identity",
    methods: ["POST"],
    policy: "require_room_write_guard",
    reason: "Team identity override write mutates seasonState.teamIdentityOverrides for one team.",
  },
  {
    routePath: "team-settings/control",
    methods: ["POST"],
    policy: "require_room_write_guard",
    reason: "Team control settings write mutates seasonState.teamControlSettings for one team.",
  },
];

export function isAllowlistedApiWriteRoute(routePath: string, method: string) {
  return API_WRITE_ROUTE_ALLOWLIST.some(
    (entry) => entry.routePath === routePath && entry.methods.includes(method as ApiWriteRoutePolicyEntry["methods"][number]),
  );
}

export function isGuardRequiredApiWriteRoute(routePath: string, method: string) {
  return API_WRITE_ROUTE_GUARD_REQUIRED.some(
    (entry) => entry.routePath === routePath && entry.methods.includes(method as ApiWriteRoutePolicyEntry["methods"][number]),
  );
}
