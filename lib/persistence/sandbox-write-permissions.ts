import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistedSaveGame } from "@/lib/persistence/types";

type SandboxWriteContext = GameState | PersistedSaveGame | null | undefined;

function resolveGameState(context: SandboxWriteContext) {
  if (!context) return null;
  return "gameState" in context ? context.gameState : context;
}

export function allowsSandboxTestWrites(context: SandboxWriteContext) {
  const gameState = resolveGameState(context);
  const meta = gameState?.scenarioMeta;
  return meta?.scenarioType === "sandbox_multiseason_test" && meta.allowTestWrites === true;
}

export function getSandboxLocalWritePolicy(context: SandboxWriteContext) {
  return {
    allowLocalServiceWrites: allowsSandboxTestWrites(context),
    requireServiceOrRunnerGate: true,
    forbidPrismaWrites: true,
    forbidRemoteWrites: true,
    forbidDirectInserts: true,
  };
}
