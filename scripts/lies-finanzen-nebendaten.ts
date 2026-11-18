/* eslint-disable no-console */
/**
 * Liest aus der (kopierten!) Wegwerf-SQLite eines Messlaufs: Saison-Faktor (Wirtschaftsfenster),
 * eingefrorene Apron-Linien, Apron-Buchungen (wer zahlte) und den Sponsor-salaryFactor je Vertrag.
 * OLY_APP_SQLITE_PATH=/pfad/kopie.sqlite npx tsx scripts/lies-finanzen-nebendaten.ts <saveId> <out.json>
 */
import fs from "node:fs";
import { createPersistenceService } from "@/lib/persistence/persistence-service";

const [saveId, out] = process.argv.slice(2);
const save = createPersistenceService().getSaveById(saveId!)!;
const ss = save.gameState.seasonState as Record<string, any>;
const res = {
  aktuelleSaison: save.gameState.season.id,
  wirtschaftsfaktoren: ss.seasonEconomyFactors,
  apronLinien: { gesamt: ss.apronLinesSnapshot ?? null, jeLiga: ss.apronLinesSnapshotByLeague ?? null },
  apronBuchungen: (ss.apronSettlementLogs ?? []).map((l: any) => ({ saison: l.seasonId, team: l.teamId, art: l.kind, cashDelta: l.cashDelta })),
  sponsorVertraege: Object.entries(ss.sponsorContractsByTeamId ?? {}).map(([t, c]: [string, any]) => ({ team: t, salaryFactorAtSign: c.salaryFactorAtSign ?? null, saison: c.seasonId ?? null })),
  sponsorPayoutLogs: (ss.sponsorPayoutLogs ?? []).length,
  transfersNachQuelle: (() => {
    const m = new Map<string, { n: number; fee: number; netto: number }>();
    for (const e of save.gameState.transferHistory as any[]) {
      const k = `${e.seasonId}|${e.phase ?? "-"}|${e.source ?? "-"}|${e.transferType}`;
      const v = m.get(k) ?? { n: 0, fee: 0, netto: 0 };
      v.n += 1; v.fee += e.fee ?? 0; v.netto += e.netCashImpact ?? e.fee ?? 0; m.set(k, v);
    }
    return [...m.entries()].map(([k, v]) => ({ schluessel: k, n: v.n, fee: Math.round(v.fee * 10) / 10, netto: Math.round(v.netto * 10) / 10 }));
  })(),
  transfersJeTeamSaison2: (() => {
    const m: Record<string, { kaeufe: number; kaufSumme: number; verkaeufe: number; verkaufNetto: number; ablauf: number }> = {};
    for (const e of save.gameState.transferHistory as any[]) {
      if (e.seasonId !== "season-2") continue;
      if (e.transferType === "buy" && e.toTeamId) { const b = (m[e.toTeamId] ??= { kaeufe: 0, kaufSumme: 0, verkaeufe: 0, verkaufNetto: 0, ablauf: 0 }); b.kaeufe++; b.kaufSumme += e.netCashImpact ?? e.fee; }
    }
    return m;
  })(),
  schluessel: Object.keys(ss).filter((k) => /apron|economy|factor/i.test(k)),
};
fs.writeFileSync(out!, JSON.stringify(res, null, 1));
console.log(JSON.stringify({ ...res, apronBuchungen: res.apronBuchungen.length, sponsorVertraege: res.sponsorVertraege.length, apronLinien: res.apronLinien }, null, 1).slice(0, 3000));
