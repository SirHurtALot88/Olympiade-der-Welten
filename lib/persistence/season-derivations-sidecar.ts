import fs from "node:fs";
import path from "node:path";

import type { PersistedSeasonDerivationsRecord } from "@/lib/foundation/materialize-season-derivations";
import { getDatabasePath } from "@/lib/persistence/sqlite";

function sidecarDirectory() {
  return path.join(path.dirname(getDatabasePath()), "derivations");
}

export function seasonDerivationsSidecarPath(saveId: string) {
  return path.join(sidecarDirectory(), `${saveId}.json`);
}

export function readSeasonDerivationsSidecar(saveId: string): PersistedSeasonDerivationsRecord | null {
  const filePath = seasonDerivationsSidecarPath(saveId);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as PersistedSeasonDerivationsRecord;
    if (!parsed || typeof parsed !== "object" || typeof parsed.seasonId !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeSeasonDerivationsSidecar(saveId: string, record: PersistedSeasonDerivationsRecord) {
  const directory = sidecarDirectory();
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(seasonDerivationsSidecarPath(saveId), `${JSON.stringify(record)}\n`, "utf8");
}

export function deleteSeasonDerivationsSidecar(saveId: string) {
  const filePath = seasonDerivationsSidecarPath(saveId);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

export function clearSeasonDerivationsSidecarsForTests() {
  if (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") {
    throw new Error("clearSeasonDerivationsSidecarsForTests may only run in the test environment.");
  }

  const directory = sidecarDirectory();
  if (!fs.existsSync(directory)) {
    return;
  }

  for (const entry of fs.readdirSync(directory)) {
    if (entry.endsWith(".json")) {
      fs.unlinkSync(path.join(directory, entry));
    }
  }
}
