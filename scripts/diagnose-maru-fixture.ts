// Diagnose Maru-Fall (Basketball, Spieltag 7): zieht die Arena-Eingabe einer gebuchten Begegnung aus einem
// Spielstand-Abbild und schreibt sie als JSON (heim, gast, aufstellung, seed, kulisse, format).
// Aufruf: OLY_APP_SQLITE_PATH=<abbild.sqlite> npx tsx scripts/diagnose-maru-fixture.ts <saveId> <matchdayId> <home> <away> <out.json>
import { writeFileSync } from "node:fs";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { bereiteFixturesVor } from "@/lib/battle/arena-headless-runner";

const [saveId, matchdayId, home, away, out] = process.argv.slice(2);
const persistence = createPersistenceService();
const save = persistence.getSaveById(saveId)!;
const gs = JSON.parse(JSON.stringify(save.gameState));
gs.matchdayState = { ...gs.matchdayState, matchdayId };
const seed = `${saveId}:${gs.season.id}:${matchdayId}:arena:basketball:${home}:${away}`;
const v = bereiteFixturesVor(gs, [{ homeTeamId: home, awayTeamId: away, seed, matchdayId }], undefined, "basketball");
writeFileSync(out, JSON.stringify(v[0], null, 1));
console.log("ok", seed, v[0].heim.length, v[0].gast.length, v[0].seed);
