/**
 * RECHNUNG (kein Spiellauf): Ruecklage ab Saison 2 — #1618 (q 5–25 % x Zielgehalt) gegen den Vorschlag vom 18.11.
 * (Sparneigung s = Finanzwert − max(0, Ambition − 5), 1..10; q = 10 % + 65 % x (s − 1) / 9; angespart statt vorab gesperrt:
 * im Kauffenster gesperrt nur max(0, Ziel − erwarteter Ueberschuss bis Saisonende)).
 *
 *   OLY_APP_SQLITE_PATH=<kopie der anlage>.sqlite npx tsx scripts/rechne-ruecklage-s2-vorschlag-18-11.ts \
 *     --save <saveId> --lauf <miss-ki-pick-analyse.json>
 *
 * Gehalt = Kadergehalt nach dem S1-Draft aus dem Messlauf (Stellvertreter fuer das Zielgehalt der Folgesaison), Sponsor =
 * `erwarteterSponsorFuerPlanung` (Anker x 0,92). Ueberschuss = Sponsor − Gehalt (ohne Tickets/Merch/Fixkosten: grob, beide
 * Richtungen, nur fuer die Groessenordnung). Druckt eine Markdown-Tabelle.
 */
import fs from "node:fs";

import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { erwarteterSponsorFuerPlanung } from "@/lib/finance/sponsor-erwartung";
import { normalisiereFinanzwert, ruecklagenQuote } from "@/lib/finance/ki-ruecklage";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}
const r1 = (v: number) => (Math.round(v * 10) / 10).toString().replace(".", ",");

const gs = createPersistenceService().getSaveById(arg("save", ""))?.gameState;
if (!gs) throw new Error("--save <saveId> auf einer Wegwerf-Kopie");
const lauf = JSON.parse(fs.readFileSync(arg("lauf", ""), "utf8")) as { teams: Record<string, { nachDraft: { gehalt: number; kasse: number } }> };

const zeilen: string[] = [
  "| Team | Fin | Amb | s | q #1618 | Rücklage #1618 | q neu | Ziel neu | Sponsor (erw.) | Gehalt | Überschuss | gesperrt im Fenster (neu) |",
  "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
];
const sum = { alt: 0, neu: 0, gesperrt: 0 };
for (const team of gs.teams) {
  const id = gs.teamIdentities.find((i) => i.teamId === team.teamId);
  const fin = normalisiereFinanzwert(id?.finances);
  const amb = Math.min(10, Math.max(1, (id?.ambition ?? 5) > 10 ? (id?.ambition ?? 50) / 10 : id?.ambition ?? 5));
  const s = Math.min(10, Math.max(1, fin - Math.max(0, amb - 5)));
  const qNeu = 0.1 + 0.65 * ((s - 1) / 9);
  const gehalt = lauf.teams[team.teamId]?.nachDraft.gehalt ?? 0;
  const alt = ruecklagenQuote(id?.finances) * gehalt;
  const ziel = qNeu * gehalt;
  const sponsor = erwarteterSponsorFuerPlanung(gs, team.teamId);
  const ueberschuss = sponsor - gehalt;
  const gesperrt = Math.max(0, ziel - Math.max(0, ueberschuss));
  sum.alt += alt;
  sum.neu += ziel;
  sum.gesperrt += gesperrt;
  zeilen.push(
    `| ${team.teamId} | ${r1(fin)} | ${r1(amb)} | ${r1(s)} | ${Math.round(ruecklagenQuote(id?.finances) * 100)} % | ${r1(alt)} | ${Math.round(qNeu * 100)} % | ${r1(ziel)} | ${r1(sponsor)} | ${r1(gehalt)} | ${r1(ueberschuss)} | ${r1(gesperrt)} |`,
  );
}
zeilen.push(`| **Σ** | | | | | ${r1(sum.alt)} | | ${r1(sum.neu)} | | | | ${r1(sum.gesperrt)} |`);
console.log(zeilen.join("\n"));
