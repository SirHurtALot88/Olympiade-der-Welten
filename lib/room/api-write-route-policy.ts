/**
 * Central policy for mutating API routes and their server-authority expectations.
 * Used by tests/api-write-route-guard-coverage.test.ts as the contract source of truth.
 */
export type ApiWriteRoutePolicyEntry = {
  routePath: string;
  methods: Array<"POST" | "PUT" | "PATCH" | "DELETE">;
  policy: "require_room_write_guard" | "allowlisted" | "require_room_bound_refusal";
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
    methods: ["PUT"],
    policy: "allowlisted",
    reason:
      "Whole-state PUT is save meta management (compact put) — not a team gameplay write. It is " +
      "additionally hard-blocked with 409 room_save_generic_write_forbidden for any save bound to " +
      "an active room (see getActiveRoomBySaveId check in the PUT handler), so it can never bypass " +
      "per-team room ownership there either.",
  },
  {
    routePath: "bug-report",
    methods: ["POST"],
    policy: "allowlisted",
    reason:
      "Bug reports are written as standalone JSON files under data/bug-reports/ — the handler " +
      "READS the save to enrich the report (season, matchday, active teams) but never persists " +
      "game state, so there is no team-owned write to authorize. Gating it behind the room guard " +
      "would be actively harmful: reporting must stay possible from the login page, without a " +
      "session, and on a half-broken screen (see components/feedback/BugReportFlag.tsx).",
  },
  {
    routePath: "new-game",
    methods: ["POST"],
    policy: "allowlisted",
    reason: "Creates a new save; no active room context.",
  },
  {
    routePath: "season/whole-season-dryrun",
    methods: ["POST"],
    policy: "allowlisted",
    reason:
      "Real write, but never to the actual save: runWholeSeasonDryRun operates on an in-memory " +
      "persistence harness (whole-season-dryrun-service.ts:216-228) and the route hard-blocks " +
      "execute===true/dryRun===false with 409 before ever calling it (route.ts:45-52) — there is " +
      "no code path in which this route touches the real save.",
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
    reason:
      "materialize=1 does write for real (route.ts:43-46), but only the derived cache field " +
      "seasonState.persistedSeasonDerivations — a pure function of the existing gameState plus its " +
      "contentSignature, with no teamId and no phase/matchday advance. Two racing writes from " +
      "different clients converge to the same value (same input state -> same signature -> same " +
      "derivation), so unlike the tools in API_WRITE_ROUTE_ROOM_BOUND_REFUSAL_REQUIRED it cannot " +
      "desync a coop room — there is no gameplay-visible field for a room-bound refusal to protect.",
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
  {
    routePath: "training",
    methods: ["POST"],
    policy: "require_room_write_guard",
    reason: "Player training mode/class write mutates player state for one team's roster.",
  },
  {
    routePath: "singleplayer-state",
    methods: ["POST"],
    policy: "require_room_write_guard",
    reason:
      "POST is a multi-action dispatch: most branches (create/clone/snapshot/activate/delete/" +
      "fresh-season-1) are save-meta admin without a teamId, but assign-team-captain, " +
      "new-game-flow-step and contract-negotiation-outcome are team-scoped gameplay writes " +
      "(captain assignment, onboarding step status, negotiation draft) and are now routed through " +
      "authorizeServerRoomWrite. Previously this whole route was blanket-allowlisted, which let " +
      "those three writes bypass room ownership and skip the room broadcast (S9).",
  },
];

/**
 * Admin-/KI-/Simulationswerkzeuge, die keinen Team-Write sind (kein `teamId`, keine
 * `authorizeServerRoomWrite`-Autorisierungsfrage), aber real ganze Save-/Saisonzustaende
 * ersetzen. Fuer `authorizeServerRoomWrite` gibt es hier keine sinnvolle Frage — diese Werkzeuge
 * sind mit einem laufenden Koop-Raum grundsaetzlich unvertraeglich (siehe
 * `lib/room/assert-save-not-room-bound.ts` fuer die ausfuehrliche Begruendung und
 * `docs/design/coop-absicherung.md`, Risiko R4, fuer den gemeldeten Vorfall). Statt Autorisierung
 * verlangen sie eine harte Ablehnung ueber `assertSaveNotRoomBound`, sobald der Save an einen
 * aktiven Raum gebunden ist — ohne Host-Sonderweg.
 *
 * Diese fuenf Routen standen vorher fehlerhaft in `API_WRITE_ROUTE_ALLOWLIST` mit Begruendungen,
 * die real stattfindende Schreibvorgaenge verschleierten ("Admin-only", "tooling without gameplay
 * write semantics" o.ae.) — siehe Git-Historie fuer den vorherigen Wortlaut.
 */
export const API_WRITE_ROUTE_ROOM_BOUND_REFUSAL_REQUIRED: ApiWriteRoutePolicyEntry[] = [
  {
    routePath: "admin/season-simulation",
    methods: ["POST"],
    policy: "require_room_bound_refusal",
    reason:
      "mode: \"apply\" persists real gameplay state via the local services directly " +
      "(season-simulation-runner.ts:283,484,553,612,1525,1846,1866, saveSingleplayerState) — no " +
      "room context, no ready-gates, no broadcast. This is exactly the reported R4 incident: a " +
      "click on \"Saison simulieren\" fast-forwarded a room-bound save to season end while the " +
      "co-player's client still showed matchday 3.",
  },
  {
    routePath: "singleplayer-state/season-start-reset",
    methods: ["POST"],
    policy: "require_room_bound_refusal",
    reason:
      "Execute path (dryRun===false, confirmToken checked) persists via " +
      "season-start-reset-service.ts:330 (saveSingleplayerState) — resets save state wholesale, " +
      "not a team-scoped write.",
  },
  {
    routePath: "ai/picks-import",
    methods: ["POST"],
    policy: "require_room_bound_refusal",
    reason:
      "Execute path persists via executeLocalTransfermarktBuy (ai-pick-import-service.ts:593-600) " +
      "against the targetSaveId — a real roster/cash write with no teamId-scoped authorization " +
      "question, driven entirely by import data instead of a room participant's action.",
  },
  {
    routePath: "ai/picks-audit-reset",
    methods: ["POST"],
    policy: "require_room_bound_refusal",
    reason: "Execute path persists via ai-pick-audit-reset-service.ts:792 (saveSingleplayerState) — resets audit/pick state wholesale.",
  },
  {
    routePath: "season/season-snapshot",
    methods: ["POST"],
    policy: "require_room_bound_refusal",
    reason:
      "Execute path (execute===true, confirmToken checked) persists via " +
      "season-snapshot-service.ts:912-920 (persistGameStateWithMaterializedDerivations) — writes " +
      "seasonState.seasonSnapshots for the whole save.",
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

export function isRoomBoundRefusalRequiredApiWriteRoute(routePath: string, method: string) {
  return API_WRITE_ROUTE_ROOM_BOUND_REFUSAL_REQUIRED.some(
    (entry) => entry.routePath === routePath && entry.methods.includes(method as ApiWriteRoutePolicyEntry["methods"][number]),
  );
}
