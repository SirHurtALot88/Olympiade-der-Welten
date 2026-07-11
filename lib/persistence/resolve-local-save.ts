import type { PersistedSaveGame } from "@/lib/persistence/types";
import type { PersistenceService } from "@/lib/persistence/types";

export function resolveLocalPersistedSave(
  persistence: PersistenceService,
  saveId?: string | null,
): { persistence: PersistenceService; save: PersistedSaveGame } {
  const bootstrapped = persistence.bootstrapSingleplayerSave();
  const save =
    (saveId ? persistence.getSaveById(saveId) : null) ??
    persistence.getActiveSave() ??
    bootstrapped.save;

  if (!save) {
    throw new Error("SQLite save could not be loaded.");
  }

  return { persistence, save };
}
