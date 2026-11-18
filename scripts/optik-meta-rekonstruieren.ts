// Rekonstruiert /tmp/optik-meta.json (oder $OPTIK_TMP/optik-meta.json) aus vorhandenen Save-Kopien optik-<disz>.sqlite.
// AUFRUF: OPTIK_TMP=<ordner> npx tsx scripts/optik-meta-rekonstruieren.ts basketball,tennis
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { getSeasonDisciplineSchedule } from "@/lib/season/season-discipline-schedule";

async function main() {
  const tmp = process.env.OPTIK_TMP ?? os.tmpdir();
  // Ein Prozess je Disziplin (der Persistenz-Dienst merkt sich den Pfad), Ergebnis wird zusammengefuehrt.
  const metaPfad = path.join(tmp, "optik-meta.json");
  const meta: Record<string, { saveId: string; teamId: string; seite: number }> = await fs.readFile(metaPfad, "utf8").then((t) => JSON.parse(t), () => ({}));
  for (const d of (process.argv[2] ?? "").split(",").filter(Boolean)) {
    process.env.OLY_APP_SQLITE_PATH = path.join(tmp, `optik-${d}.sqlite`);
    const persistence = createPersistenceService();
    const save = persistence.getActiveSave();
    if (!save) { console.log(`kein Save in ${d}`); continue; }
    const gs = save.gameState;
    const eintrag = getSeasonDisciplineSchedule(gs).find((e) => e.matchdayId === gs.matchdayState.matchdayId);
    meta[d] = { saveId: save.saveId, teamId: gs.teams[0]!.teamId, seite: eintrag?.discipline1?.disciplineId === d ? 0 : 1 };
    console.log(d, meta[d], gs.matchdayState.matchdayId, gs.season.currentMatchday, eintrag?.discipline1?.disciplineId, eintrag?.discipline2?.disciplineId);
  }
  await fs.writeFile(metaPfad, JSON.stringify(meta));
  process.exit(0);
}
void main();
