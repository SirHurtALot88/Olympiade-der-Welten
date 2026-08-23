/* eslint-disable no-console */
/**
 * AUSWERTUNG DER APRON-SONDE — bremst die Bremse, und bremst sie die Richtigen?
 *
 * Die Sonde (`scripts/apron-bremse-sonde.ts`) schreibt je Saison eine Zeile pro Team aus dem
 * Kaufmoment: Gehalt, Decke, Bremsfaktor und das freie Kaufbudget MIT und OHNE Bremse. Dieses
 * Skript legt daneben, was danach tatsaechlich gekauft wurde, und trennt beides nach
 * „ueber der Decke" und „darunter".
 *
 * Zwei Zahlen entscheiden:
 *   1. ENTZOGENES BUDGET — Summe (frei OHNE minus frei MIT). Ist sie 0, kann die Bremse
 *      niemanden am Kaufen gehindert haben, egal wie klein der Faktor aussieht: sie dreht dann
 *      an einer Ruecklage, die das Cash ohnehin uebersteigt.
 *   2. TRIFFT SIE DIE RICHTIGEN — entzogenes Budget bei Teams ueber ihrer Decke gegen das bei
 *      Teams darunter (dort muss es 0 sein, sonst bremst die Mechanik am Ziel vorbei).
 *
 * Aufruf:
 *   OLY_APP_SQLITE_PATH=<lauf.sqlite> npx tsx scripts/werte-apron-sonde-aus.ts --sonde <pfad.jsonl>
 */
import fs from "node:fs";

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import type { GameState } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { isMarketBuyTransferEntry } from "@/lib/season/transfer-season-policy";
import type { ApronBremsZeile } from "./apron-bremse-sonde";

function argValue(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

function r(x: number, d = 1): string {
  return Number.isFinite(x) ? (Math.round(x * 10 ** d) / 10 ** d).toFixed(d) : "—";
}

function mittel(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function main(): void {
  const sondePfad = argValue("--sonde") ?? process.env.OLY_MESS_APRON_BREMSE;
  if (!sondePfad || !fs.existsSync(sondePfad)) throw new Error(`Sondendatei fehlt: ${sondePfad}`);
  const zeilen: ApronBremsZeile[] = fs
    .readFileSync(sondePfad, "utf-8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as ApronBremsZeile);

  const kopf = createPersistenceService().getActiveSave();
  const gs = kopf?.gameState as GameState | undefined;
  const kaeufe = new Map<string, number>();
  if (gs) {
    for (const entry of gs.transferHistory ?? []) {
      if (!isMarketBuyTransferEntry(entry)) continue;
      const key = `${entry.seasonId}|${entry.toTeamId ?? ""}`;
      kaeufe.set(key, (kaeufe.get(key) ?? 0) + 1);
    }
  } else {
    console.log("(kein Spielstand gelesen — Kaufzahlen bleiben leer)\n");
  }

  const saisons = [...new Set(zeilen.map((zeile) => zeile.seasonId))];
  for (const saison of saisons) {
    const s = zeilen.filter((zeile) => zeile.seasonId === saison);
    const ueber = s.filter((zeile) => zeile.faktor < 1);
    const unter = s.filter((zeile) => zeile.faktor >= 1);
    const entzogen = (rows: ApronBremsZeile[]) => rows.reduce((sum, z) => sum + Math.max(0, z.freiOhne - z.freiMit), 0);
    const gebunden = (rows: ApronBremsZeile[]) => rows.reduce((sum, z) => sum + Math.max(0, z.ruecklageMit - z.ruecklageOhne), 0);
    const kaufe = (z: ApronBremsZeile) => kaeufe.get(`${z.seasonId}|${z.teamId}`) ?? 0;

    console.log(`\n${saison} · Kaufmoment · Linien ${r(s[0]?.linie1 ?? 0)} / ${r(s[0]?.linie2 ?? 0)} · Median ${r(s[0]?.median ?? 0)}`);
    console.log(
      `  ueber der Decke: ${ueber.length}/${s.length} Teams · Ruecklage zusaetzlich gebunden ${r(gebunden(ueber))} · ` +
        `davon real entzogenes Kaufbudget ${r(entzogen(ueber))}`,
    );
    console.log(
      `  darunter:        ${unter.length}/${s.length} Teams · entzogenes Kaufbudget ${r(entzogen(unter))} (muss 0 sein)`,
    );
    console.log(
      `  Kaeufe danach: ueber der Decke Ø ${r(mittel(ueber.map(kaufe)), 2)} · darunter Ø ${r(mittel(unter.map(kaufe)), 2)}`,
    );
    if (ueber.length > 0) {
      console.log("  Team   Gehalt  Decke  Faktor | Cash  frei MIT  frei OHNE | entzogen | Kaeufe | Kader");
      for (const z of [...ueber].sort((a, b) => b.freiOhne - b.freiMit - (a.freiOhne - a.freiMit))) {
        console.log(
          `  ${z.kuerzel.padEnd(6)} ${r(z.gehalt).padStart(6)} ${r(z.decke).padStart(6)} ${r(z.faktor, 2).padStart(7)} |` +
            `${r(z.cash).padStart(6)} ${r(z.freiMit).padStart(9)} ${r(z.freiOhne).padStart(10)} |` +
            `${r(Math.max(0, z.freiOhne - z.freiMit)).padStart(9)} |${String(kaufe(z)).padStart(7)} | ${z.kader}/${z.kaderOpt}`,
        );
      }
    }
  }
}

main();
