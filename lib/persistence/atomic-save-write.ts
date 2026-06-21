import type { GameState } from "@/lib/data/olyDataTypes";
import type { PersistenceService, SaveStatus } from "@/lib/persistence/types";

export class AtomicSaveRecoveryError extends Error {
  readonly originalError: unknown;
  readonly recoveryError: unknown;

  constructor(input: { label: string; originalError: unknown; recoveryError?: unknown }) {
    super(`${input.label} failed and the previous save state was restored.`);
    this.name = "AtomicSaveRecoveryError";
    this.originalError = input.originalError;
    this.recoveryError = input.recoveryError ?? null;
  }
}

function cloneGameState(gameState: GameState): GameState {
  return JSON.parse(JSON.stringify(gameState)) as GameState;
}

export async function runWithSaveRecovery<T>(input: {
  label: string;
  saveId: string;
  status?: SaveStatus;
  beforeGameState: GameState;
  persistence: PersistenceService;
  run: () => T | Promise<T>;
}): Promise<T> {
  const recoverySnapshot = cloneGameState(input.beforeGameState);
  try {
    return await input.run();
  } catch (error) {
    try {
      input.persistence.saveSingleplayerState(input.saveId, recoverySnapshot, { status: input.status });
    } catch (recoveryError) {
      throw new AtomicSaveRecoveryError({ label: input.label, originalError: error, recoveryError });
    }
    throw new AtomicSaveRecoveryError({ label: input.label, originalError: error });
  }
}
