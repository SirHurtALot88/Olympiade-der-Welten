/**
 * PRUEFT DIE SLOT-INVARIANTE: das Mittel aller Slot-Profile einer Disziplin muss die
 * Disziplinmatrix weiter treffen — Abweichung <=0,2 Pp, fuer JEDE Kadergroesse 1..6 und ALLE 20
 * Disziplinen (nicht nur Hockey). Das ist Chris' Bedingung „in Summe mit den andren Slots wieder
 * der Diszi Gewichtung entspricht" aus dem Torwart-Slot-Auftrag (Plan 3.4) — und zugleich
 * Systemgesetz fuer `resolveSlotRolesForDiscipline` insgesamt: der Generator hat diese
 * Invariante nie nur fuer Hockey versprochen.
 *
 * Nutzung:
 *   npx tsx scripts/pruefe-slot-invariante.ts
 *
 * Exit-Code 1, wenn irgendwo mehr als 0,2 Pp Abweichung gemessen wird.
 */
import {
  officialDisciplineWeightMatrix,
  officialDisciplineWeightOrder,
  playerGeneratorAttributeKeys,
  type OfficialDisciplineWeightId,
  type PlayerGeneratorAttributeKey,
} from "@/lib/player-generator/official-discipline-weights";
import { resolveSlotRolesForDiscipline } from "@/lib/lineups/matchday-slot-roles";

const TOLERANZ_PP = 0.2;

function z(wert: number, stellen = 3) {
  return wert.toFixed(stellen);
}

function pruefeDisziplinGroesse(disciplineId: OfficialDisciplineWeightId, groesse: number) {
  const matrix = officialDisciplineWeightMatrix[disciplineId];
  const rollen = resolveSlotRolesForDiscipline(disciplineId, disciplineId, groesse);

  if (rollen.length !== groesse) {
    throw new Error(`${disciplineId} @ ${groesse}: erwartete ${groesse} Rollen, bekam ${rollen.length}`);
  }

  let maxAbweichung = 0;
  let schlimmstesAttribut: PlayerGeneratorAttributeKey | null = null;

  for (const attribut of playerGeneratorAttributeKeys) {
    const basis = matrix[attribut] ?? 0;
    const mittel =
      rollen.reduce((summe, rolle) => summe + (rolle.slotWeightProfile?.[attribut] ?? 0), 0) / rollen.length;
    const abweichung = Math.abs(mittel - basis);
    if (abweichung > maxAbweichung) {
      maxAbweichung = abweichung;
      schlimmstesAttribut = attribut;
    }
  }

  return { maxAbweichung, schlimmstesAttribut };
}

function main() {
  let globalMax = 0;
  let globalSchlimmster: { disciplineId: string; groesse: number; attribut: string | null } | null = null;
  const verletzungen: string[] = [];

  console.log("Disziplin".padEnd(16) + [1, 2, 3, 4, 5, 6].map((n) => `n=${n}`.padStart(9)).join(""));

  for (const disciplineId of officialDisciplineWeightOrder) {
    const zeile: string[] = [];
    for (let groesse = 1; groesse <= 6; groesse += 1) {
      const { maxAbweichung, schlimmstesAttribut } = pruefeDisziplinGroesse(disciplineId, groesse);
      zeile.push(z(maxAbweichung).padStart(9));

      if (maxAbweichung > globalMax) {
        globalMax = maxAbweichung;
        globalSchlimmster = { disciplineId, groesse, attribut: schlimmstesAttribut };
      }
      if (maxAbweichung > TOLERANZ_PP) {
        verletzungen.push(
          `${disciplineId} @ n=${groesse}: ${z(maxAbweichung)} Pp Abweichung (Attribut ${schlimmstesAttribut}) > ${TOLERANZ_PP} Pp`,
        );
      }
    }
    console.log(disciplineId.padEnd(16) + zeile.join(""));
  }

  console.log("");
  console.log(
    `Maximale Abweichung ueber alle ${officialDisciplineWeightOrder.length} Disziplinen x 6 Groessen: ${z(globalMax)} Pp` +
      (globalSchlimmster
        ? ` (${globalSchlimmster.disciplineId} @ n=${globalSchlimmster.groesse}, Attribut ${globalSchlimmster.attribut})`
        : ""),
  );

  if (verletzungen.length > 0) {
    console.error("\nVERLETZUNG DER INVARIANTE (>0,2 Pp):");
    for (const zeile of verletzungen) {
      console.error(`  - ${zeile}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`\nInvariante haelt: alle Werte <= ${TOLERANZ_PP} Pp.`);
}

main();
