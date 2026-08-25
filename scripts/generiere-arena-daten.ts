// ===================================================================================
// ARENA-DATEN GENERIEREN — statt sie abzuschreiben.
//
// Der Entwurf unter public/mockups/battle-mode.html braucht je Disziplin zwei Dinge:
// die Attribut-Gewichtsmatrix und die Slot-Rollen. Beides steht im Spiel bereits, und
// beides habe ich bisher VON HAND übertragen — erst für TDM, dann für Spurt.
//
// Das war schon bei zwei Disziplinen fehleranfällig (die Spurt-Slots fehlen laut
// Übergabe bis heute teilweise). Bei zwanzig wäre es fahrlässig: 20 Matrizen mit je
// zwölf Zahlen und 20 Slot-Sätze mit je sechs Profilen sind über 1400 Zahlen, die
// auseinanderlaufen können, ohne dass es jemand merkt.
//
// Deshalb dieses Skript. Es liest die echten Quellen —
//   lib/player-generator/official-discipline-weights.ts  (die Matrizen)
//   lib/lineups/matchday-slot-roles.ts                   (die Slot-Rollen)
// — und gibt einen fertigen JS-Block aus, der in den Entwurf kopiert wird.
//
//   npx tsx scripts/generiere-arena-daten.ts            → auf die Konsole
//   npx tsx scripts/generiere-arena-daten.ts --schreiben → direkt in den Entwurf
//
// Beim Schreiben wird nur der Bereich zwischen den beiden Markern ersetzt. Alles
// andere im Entwurf bleibt unangetastet.
// ===================================================================================

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { foundationSeedDisciplines } from "@/lib/data/dataAdapter";
import {
  officialDisciplineWeightOrder,
  officialDisciplineWeightTable,
  playerGeneratorAttributeKeys,
} from "@/lib/player-generator/official-discipline-weights";
import { resolveSlotRolesForDiscipline } from "@/lib/lineups/matchday-slot-roles";

const MARKER_AUF = "  // <<< GENERIERT: arena-daten — nicht von Hand ändern";
const MARKER_ZU = "  // >>> ENDE GENERIERT: arena-daten";

/** Wie viele Slots eine Disziplin in der Arena zeigt. */
function slotZahl(disziplinId: string): number {
  const stamm = foundationSeedDisciplines.find((d) => d.id === disziplinId);
  // Die Stammdaten nennen für TDM 3 und für Spurt 2, gebaut sind 6 und 4. Welche Zahl
  // gilt, ist eine offene Frage an Chris (siehe docs/BATTLE_ARENA_UEBERGABE.md).
  // Bis sie beantwortet ist, bleibt es bei dem, was der Entwurf zeigt: die Stammzahl
  // verdoppelt, mindestens vier, höchstens sechs. Das ist eine ANNAHME und steht
  // deshalb hier an einer Stelle, statt zwanzigmal verstreut.
  const roh = stamm?.playerCount ?? 4;
  return Math.max(4, Math.min(6, roh * 2));
}

function zahl(n: number): string {
  const g = Math.round(n * 10) / 10;
  return Number.isInteger(g) ? String(g) : g.toFixed(1);
}

function matrixBlock(): string {
  const zeilen: string[] = [];
  for (const id of officialDisciplineWeightOrder) {
    // ACHTUNG, die Tabelle ist TRANSPONIERT: sie ist nach Attribut geschlüsselt, nicht
    // nach Disziplin. officialDisciplineWeightTable.power["tdm"] ist 28, nicht
    // officialDisciplineWeightTable["tdm"].power. Ich hatte es andersherum angenommen
    // und bekam zwanzig leere Matrizen — lautlos, weil eine leere Zeile kein Fehler ist.
    const w = Object.fromEntries(
      playerGeneratorAttributeKeys.map((k) => [k, officialDisciplineWeightTable[k]?.[id] ?? 0]),
    ) as Record<string, number>;
    if (!Object.values(w).some((v) => v > 0)) continue;
    // Nur Attribute mit Gewicht: eine Null im Datensatz ist eine Aussage ("dieses
    // Attribut zählt hier nicht") und gehört nicht als Rauschen in die Rechnung.
    const paare = playerGeneratorAttributeKeys
      .map((k) => [k, w[k] ?? 0] as const)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k}:${zahl(v)}`);
    zeilen.push(`    ${JSON.stringify(id)}: {${paare.join(",")}}`);
  }
  return `  const BASIS_JE_DISC={\n${zeilen.join(",\n")}\n  };`;
}

function slotBlock(): string {
  const zeilen: string[] = [];
  for (const id of officialDisciplineWeightOrder) {
    const n = slotZahl(id);
    const rollen = resolveSlotRolesForDiscipline(id, id, n);
    if (!rollen.length) continue;
    const eintraege = rollen.map((r) => {
      const anyR = r as unknown as Record<string, unknown>;
      const profil = anyR.slotWeightProfile as Record<string, number> | undefined;
      const p = profil
        ? Object.entries(profil)
            .filter(([, v]) => v > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => `${k}:${zahl(v)}`)
            .join(",")
        : "";
      const gross = String(anyR.majorPositiveAttribute ?? "");
      const klein = String(anyR.minorPositiveAttribute ?? "");
      const last = String(anyR.strainAttribute ?? "");
      const mueh = String(anyR.fatigueProfile ?? "");
      // KURZE KENNUNG. Die Quelle liefert "tdm-6-vanguard"; der Entwurf spricht seine
      // Slots aber als "vanguard" an — in der Aufstellung, im Rennplan, in den Befehlen.
      // Die lange Kennung hier durchzureichen hiesse, all diese Stellen zu brechen.
      const langeId = String(anyR.roleId ?? "");
      const kurzeId = langeId.replace(new RegExp(`^${id}-${n}-`), "");
      return (
        `      {id:${JSON.stringify(kurzeId)},` +
        `label:${JSON.stringify(String(anyR.label ?? ""))},` +
        `text:${JSON.stringify(String(anyR.description ?? ""))},` +
        `gross:${JSON.stringify(gross)},klein:${JSON.stringify(klein)},` +
        `last:${JSON.stringify(last)},mueh:${JSON.stringify(mueh)},` +
        `profil:{${p}}}`
      );
    });
    zeilen.push(`    ${JSON.stringify(id)}:[\n${eintraege.join(",\n")}\n    ]`);
  }
  return `  const SLOTS_JE_DISC={\n${zeilen.join(",\n")}\n  };`;
}

function bericht(): string {
  const z: string[] = [];
  z.push("Disziplin        Slots  Attribute mit Gewicht > 0 (absteigend)");
  for (const id of officialDisciplineWeightOrder) {
    const w = Object.fromEntries(
      playerGeneratorAttributeKeys.map((k) => [k, officialDisciplineWeightTable[k]?.[id] ?? 0]),
    ) as Record<string, number>;
    const oben = playerGeneratorAttributeKeys
      .map((k) => [k, w[k] ?? 0] as const)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
    const summe = oben.reduce((s, [, v]) => s + v, 0);
    z.push(
      `${id.padEnd(16)} ${String(slotZahl(id)).padStart(5)}  ` +
        `${oben.length} Attribute, Summe ${zahl(summe)} — ` +
        oben
          .slice(0, 4)
          .map(([k, v]) => `${k} ${zahl(v)}`)
          .join(", "),
    );
  }
  return z.join("\n");
}

const block = [
  MARKER_AUF,
  "  // Erzeugt von scripts/generiere-arena-daten.ts aus den echten Quellen des Spiels:",
  "  //   lib/player-generator/official-discipline-weights.ts  (Gewichtsmatrizen)",
  "  //   lib/lineups/matchday-slot-roles.ts                   (Slot-Rollen)",
  "  // Wer hier etwas von Hand ändert, verliert es beim nächsten Lauf.",
  matrixBlock(),
  slotBlock(),
  MARKER_ZU,
].join("\n");

const schreiben = process.argv.includes("--schreiben");

if (!schreiben) {
  console.log(bericht());
  console.log("\n" + "=".repeat(70) + "\n");
  console.log(block);
  console.log(
    `\n${officialDisciplineWeightOrder.length} Disziplinen. Mit --schreiben landet der Block direkt im Entwurf.`,
  );
} else {
  // Seit Phase 2 (Modul-Extraktion) liegt der Motor-Code nicht mehr inline in
  // battle-mode.html, sondern in der ausgelagerten battle-mode.engine.js — die Marker
  // und der BASIS_JE_DISC-Block sind mitgewandert, s. FoundationBattleArenaHost.tsx.
  const pfad = resolve(process.cwd(), "public/mockups/battle-mode.engine.js");
  const alt = readFileSync(pfad, "utf8");
  const auf = alt.indexOf(MARKER_AUF);
  const zu = alt.indexOf(MARKER_ZU);
  if (auf < 0 || zu < 0) {
    console.error(
      "Marker nicht gefunden. Der Motor (public/mockups/battle-mode.engine.js) braucht einmalig die beiden Zeilen\n" +
        `  ${MARKER_AUF}\n  ${MARKER_ZU}\n` +
        "um den bisherigen BASIS_JE_DISC/SLOTS_JE_DISC-Block herum.",
    );
    process.exit(1);
  }
  const neu = alt.slice(0, auf) + block + alt.slice(zu + MARKER_ZU.length);
  writeFileSync(pfad, neu, "utf8");
  console.log(bericht());
  console.log(`\nGeschrieben nach ${pfad} (${officialDisciplineWeightOrder.length} Disziplinen).`);
}
