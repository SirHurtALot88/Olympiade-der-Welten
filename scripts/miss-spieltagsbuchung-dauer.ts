/**
 * DAUER DER SPIELTAGSBUCHUNG (22.11., Marketing-Nachbesserung): zeitet `bucheSpieltagFinanzen` fuer alle Teams eines gespeicherten
 * Spielstands (Wegwerf-Kopie!). Erster Spieltag kalt, danach drei weitere Spieltage mit je NEUEM GameState-Objekt (wie im Spiel).
 *
 * AUFRUF: OLY_APP_SQLITE_PATH=/pfad/kopie.sqlite npx tsx scripts/miss-spieltagsbuchung-dauer.ts <saveId>
 */
import { bucheSpieltagFinanzen } from "@/lib/finance/finanzen-je-spieltag-buchung";
import { marketingAktiv } from "@/lib/marketing/marketing-regel";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const saveId = process.argv[2];
if (!saveId || !process.env.OLY_APP_SQLITE_PATH) throw new Error("saveId und OLY_APP_SQLITE_PATH setzen");
const persistence = createPersistenceService();
const g0 = persistence.getSaveById(saveId)!.gameState;
let gs = { ...g0, seasonState: { ...g0.seasonState, spieltagFinanzen: [] } };
console.log(`Teams ${gs.teams.length}, Spieler im Kader ${gs.rosters.length}, Marketing aktiv: ${marketingAktiv(gs)}`);
const ids = gs.season.matchdayIds;
for (let i = 0; i < 4; i += 1) {
  const t = Date.now();
  gs = { ...bucheSpieltagFinanzen({ ...gs }, ids[i]!) };
  console.log(`Spieltag ${i + 1}: ${Date.now() - t} ms${i === 0 ? " (kalt)" : ""}`);
}
const marketing = gs.seasonState.spieltagFinanzen!.filter((z) => z.matchdayIndex === 1).reduce((s, z) => s + (z.marketing ?? 0), 0);
console.log(`Marketing Spieltag 1 gesamt ${marketing.toFixed(2)} C`);
