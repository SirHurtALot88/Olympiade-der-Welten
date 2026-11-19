/**
 * MESSUNG: KI-Wahl unter den Top 3 (Chris 19.11.). Faehrt einen kompletten Liga-Draft einer reinen KI-Liga (32 Teams, Wegwerf-
 * SQLite) und zaehlt, welchen Platz der Top 3 die KI nimmt; rechnet dazu die erwartete Verteilung fuer mehrere T aus den
 * gemessenen Bewertungsabstaenden. Danach Kadergroessen und Kasse.
 *
 *   OLY_LIGA_DRAFT_KI_WAHL=aus npx tsx scripts/miss-liga-draft-ki-wahl.ts   (alt: immer Platz 1)
 *   npx tsx scripts/miss-liga-draft-ki-wahl.ts                               (neu)
 */
import os from "node:os";
import path from "node:path";

process.env.OLY_APP_SQLITE_PATH = path.join(os.tmpdir(), `oly-ki-wahl-${process.pid}.sqlite`);
process.env.OLY_LIGA_DRAFT_MODUS = "einzelschritt";

async function main() {
  const { createPersistenceService } = await import("@/lib/persistence/persistence-service");
  const dienst = await import("@/lib/draft/liga-draft-dienst");
  const ki = await import("@/lib/draft/liga-draft-ki");
  const modell = await import("@/lib/draft/liga-draft-modell");
  const persistence = createPersistenceService();
  const frisch = persistence.createFreshSeasonOneSave({ name: "ki-wahl-messung" });
  const saveId = frisch.saveId;
  dienst.starteLigaDraft({ persistence, saveId, selbstPickendeTeamIds: [] });

  const abstaende: Array<[number, number]> = [];
  const platz = [0, 0, 0];
  let picks = 0;
  for (;;) {
    const gs = persistence.getSaveById(saveId)!.gameState;
    const draft = gs.seasonState.ligaDraft!;
    const zug = modell.werIstDran(draft);
    if (!zug) break;
    const bew = ki.bewerteKiPick({ gameState: gs, saveId, draft, teamId: zug.teamId, topN: 3 });
    if (bew.kind === "buy" && bew.top.length === 3) abstaende.push([bew.top[0]!.nutzen - bew.top[1]!.nutzen, bew.top[0]!.nutzen - bew.top[2]!.nutzen]);
    const lauf = dienst.laufeKiZuege({ persistence, saveId, maxPicks: 1 });
    for (const e of lauf.eintraege) {
      if (e.art !== "pick") continue;
      picks += 1;
      const i = e.top3?.findIndex((t) => t.playerId === e.playerId) ?? -1;
      if (i >= 0 && i < 3) platz[i] += 1;
    }
    if (lauf.halt === "draft_vorbei") break;
  }
  console.log(`Picks ${picks}; genommen: Platz1 ${platz[0]}  Platz2 ${platz[1]}  Platz3 ${platz[2]}  (${platz.map((p) => `${Math.round((p / Math.max(1, picks)) * 100)}%`).join(" / ")})`);
  for (const t of [1.5, 2, 2.5, 3, 3.5, 4.5]) {
    const sum = [0, 0, 0];
    for (const [d2, d3] of abstaende) {
      const w = [1, Math.exp(-d2 / t), Math.exp(-d3 / t)];
      const s = w[0]! + w[1]! + w[2]!;
      w.forEach((x, i) => (sum[i] += x / s));
    }
    console.log(`T=${t}: erwartet ${sum.map((x) => `${Math.round((x / Math.max(1, abstaende.length)) * 100)}%`).join(" / ")}`);
  }
  const sortiert = [...abstaende].map((a) => a[0]).sort((a, b) => a - b);
  console.log(`Abstand Platz1-Platz2: Median ${sortiert[Math.floor(sortiert.length / 2)]?.toFixed(3)}, P25 ${sortiert[Math.floor(sortiert.length / 4)]?.toFixed(3)}, P75 ${sortiert[Math.floor((sortiert.length * 3) / 4)]?.toFixed(3)}`);
  const gs = persistence.getSaveById(saveId)!.gameState;
  const groessen = gs.teams.map((t) => gs.rosters.filter((r) => r.teamId === t.teamId).length);
  const kassen = gs.teams.map((t) => t.cash ?? 0);
  const schnitt = (a: number[]) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
  console.log(`Kader: min ${Math.min(...groessen)} Ø ${schnitt(groessen).toFixed(2)} max ${Math.max(...groessen)} · unter 8: ${groessen.filter((g) => g < 8).length}`);
  console.log(`Kasse: min ${Math.min(...kassen).toFixed(1)} Ø ${schnitt(kassen).toFixed(1)} max ${Math.max(...kassen).toFixed(1)}`);
  const neu = gs.rosters.filter((r) => r.joinedSeasonId === gs.season.id);
  console.log(`Gehaltssumme neue Eintraege: ${neu.reduce((sum, r) => sum + (r.salary ?? 0), 0).toFixed(1)} (Ø ${(neu.reduce((sum, r) => sum + (r.salary ?? 0), 0) / Math.max(1, neu.length)).toFixed(2)} je Spieler)`);
  console.log(`Vertragslaufzeit 1: ${gs.rosters.filter((r) => r.joinedSeasonId === gs.season.id && r.contractLength === 1).length} von ${gs.rosters.filter((r) => r.joinedSeasonId === gs.season.id).length} neuen Eintraegen`);
}

void main().then(() => process.exit(0));
