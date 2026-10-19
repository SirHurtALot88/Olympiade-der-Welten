// Merged die parallel gezogenen Teil-Ziehungen (/tmp/referenz-g1..g4.json) in
// data/generated/verhaeltnis-referenz.json. Jede Teilziehung traegt in `quellen.pps` NUR ihre
// eigenen Disziplinen (die anderen Prozesse haben eine eigene leere `bestehend`-Basis gesehen).
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const ZIEL = "data/generated/verhaeltnis-referenz.json";
const TEILE = ["/tmp/referenz-g1.json", "/tmp/referenz-g2.json", "/tmp/referenz-g3.json", "/tmp/referenz-g4.json"];

const bestehend = existsSync(ZIEL) ? JSON.parse(readFileSync(ZIEL, "utf8")) : { quellen: { pps: {}, arena: {} } };
const pps = { ...(bestehend.quellen?.pps ?? {}) };
let provenienzPps = bestehend.provenienz?.pps ?? null;

for (const teilPfad of TEILE) {
  if (!existsSync(teilPfad)) {
    console.error(`[merge] fehlt: ${teilPfad} -- uebersprungen`);
    continue;
  }
  const teil = JSON.parse(readFileSync(teilPfad, "utf8"));
  const teilPps = teil.quellen?.pps ?? {};
  for (const [disziplinId, eintrag] of Object.entries(teilPps)) {
    pps[disziplinId] = eintrag;
  }
  if (teil.provenienz?.pps) {
    provenienzPps = teil.provenienz.pps;
  }
  console.error(`[merge] ${teilPfad}: ${Object.keys(teilPps).join(", ")}`);
}

const ausgabe = {
  ...bestehend,
  provenienz: { ...(bestehend.provenienz ?? {}), pps: provenienzPps },
  quellen: { ...(bestehend.quellen ?? {}), pps },
};
writeFileSync(ZIEL, `${JSON.stringify(ausgabe, null, 1)}\n`);
console.error(`[merge] geschrieben: ${ZIEL} (${Object.keys(pps).length} Disziplinen in Quelle "pps")`);
