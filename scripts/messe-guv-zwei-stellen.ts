/* eslint-disable no-console */
/**
 * ZEIGEN SAISONSTAND UND TEAM-PROFIL DIESELBE GuV? — gefragt von Chris am 23.08.:
 * „in der Teamansicht haben wir ja eine GuV Projektion drinne mit Cash minus Gehälter plus
 *  Sponsoren. Das müsste noch mal angepasst werden, dass es auch gleich ist mit dem, was wir im
 *  Saisonstand finden."
 *
 * Nutzung: OLY_APP_SQLITE_PATH=/pfad/kopie.sqlite npx tsx scripts/messe-guv-zwei-stellen.ts
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import type { GameState } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

function z(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? "—" : v.toFixed(1).replace(".", ",");
}

const p = createPersistenceService();
for (const eintrag of p.listSaves()) {
  const gs = p.getSaveById(eintrag.saveId)?.gameState as GameState | undefined;
  if (!gs?.teams?.length) continue;
  const kuerzel = String(eintrag.saveId).slice(-6);
  const standings = (gs.seasonState?.standings ?? {}) as Record<string, {
    guv?: number | null;
    guvPosten?: Array<{ key: string; label: string; amount: number; counted: boolean }> | null;
  }>;
  const mitPosten = Object.entries(standings).filter(([, s]) => (s.guvPosten?.length ?? 0) > 0);
  if (mitPosten.length === 0) {
    console.log(`${kuerzel}: keine guvPosten im Saisonstand — uebersprungen`);
    continue;
  }
  console.log(`\n=== ${kuerzel} (${gs.seasonState?.seasonId}) ===`);
  console.log("Team   Saisonstand-GuV   Team-Profil-Formel   Differenz   fehlende Posten im Profil");
  let abweichungen = 0;
  for (const [teamId, stand] of mitPosten.slice(0, 6)) {
    const posten = stand.guvPosten ?? [];
    const wert = (key: string) => posten.find((x) => x.key === key)?.amount ?? 0;
    // Die Formel des Team-Profils: Gehaelter, Gebaeude-Unterhalt, Gebaeude-Einnahmen, Sponsor-Basis.
    const profil = wert("sponsor") + wert("gebaeude_einnahme") + wert("gehaelter") + wert("gebaeude_unterhalt");
    const echt = stand.guv ?? 0;
    const fehlend = posten
      .filter((x) => x.counted && !["sponsor", "gebaeude_einnahme", "gehaelter", "gebaeude_unterhalt"].includes(x.key))
      .filter((x) => Math.abs(x.amount) > 0.005)
      .map((x) => `${x.label} ${z(x.amount)}`);
    if (Math.abs(echt - profil) > 0.05) abweichungen += 1;
    console.log(
      `${teamId.padEnd(6)} ${z(echt).padStart(15)} ${z(profil).padStart(20)} ${z(echt - profil).padStart(11)}   ${fehlend.join(" · ") || "—"}`,
    );
  }
  console.log(`  Abweichungen unter den gezeigten: ${abweichungen}`);
}
