// ===================================================================================
// KAMPF-ARCHETYP-DATEN FUER DEN MOTOR — erzeugt, nicht von Hand abgeschrieben.
//
// Backlog #156, Schritt 1 aus docs/design/klassen-archetyp-konzept-20-09.md
// (Branch fable-klassen-archetyp-20-09). Der Motor (public/mockups/battle-mode.
// engine.js) ist plain JS ohne Modul-Import (s. Kopfkommentar an
// FoundationBattleArenaHost.tsx: er wird per <script src> geladen, nicht gebuendelt).
// Die kanonische Aufloesungslogik lebt deshalb in TypeScript
// (lib/battle/combat-archetype-resolver.ts, verbindet drei bestehende Systeme:
// player-generator-archetypes.ts, subclass-archetypes.ts, archetype-registry.ts) und
// dieses Skript uebersetzt nur ihre STATISCHEN Daten (Bucket-Kriterien+Zielvektoren,
// Unterklassen->Archetyp-Zuordnung, Bildbefunde, normierte Kampfwerte je Archetyp) in
// einen JS-Block, der zwischen zwei Markern in den Motor geschrieben wird — exakt das
// Muster aus scripts/generiere-arena-daten.ts (BASIS_JE_DISC/SLOTS_JE_DISC).
//
// Was NICHT generiert wird: die eigentliche Aufloesungsfunktion (Bucket-Scoring,
// Kandidatenwahl) — die ist Logik, keine Daten, und steht deshalb von Hand direkt
// hinter dem generierten Block, mechanisch identisch zu combat-archetype-resolver.ts
// (dieselben Formeln, dieselbe Reihenfolge). scripts/pruefe-kampf-archetyp-abgleich.ts
// misst nach, dass beide fuer dieselben Spieler dasselbe Ergebnis liefern.
//
//   npx tsx scripts/generiere-kampf-archetyp-daten.ts            -> auf die Konsole
//   npx tsx scripts/generiere-kampf-archetyp-daten.ts --schreiben -> direkt in den Motor
// ===================================================================================

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { ARCHETYPES } from "@/lib/battle/archetype-registry";
import { ZUORDNUNGEN, BILDBEFUNDE } from "@/lib/battle/subclass-archetypes";
import { playerGeneratorArchetypes } from "@/lib/player-generator/player-generator-archetypes";
import { _internals, STANDARD_ARCHETYP_ID } from "@/lib/battle/combat-archetype-resolver";

const MARKER_AUF = "  // <<< GENERIERT: kampf-archetyp-daten — nicht von Hand ändern";
const MARKER_ZU = "  // >>> ENDE GENERIERT: kampf-archetyp-daten";

const NAME_ZU_ID = new Map(ARCHETYPES.map((a) => [a.name, a.id] as const));

function idsVonNamen(namen: readonly string[], quelle: string): string[] {
  return namen.map((name) => {
    const id = NAME_ZU_ID.get(name);
    if (!id) throw new Error(`generiere-kampf-archetyp-daten: "${name}" (${quelle}) ist kein bekannter Archetyp-Name.`);
    return id;
  });
}

function rund(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function archetypWerteBlock(): string {
  const zeilen = ARCHETYPES.map((a) => {
    const profil = _internals.KAMPF_PROFIL.get(a.id)!;
    return `    ${JSON.stringify(a.id)}:{name:${JSON.stringify(a.name)},stunResist:${a.stunResist},` +
      `knockbackResist:${a.knockbackResist},hp:${rund(profil.hp)},atk:${rund(profil.atk)},` +
      `def:${rund(profil.def)},spd:${rund(profil.spd)}}`;
  });
  return `  const ARCHETYP_KAMPFWERTE={\n${zeilen.join(",\n")}\n  };`;
}

function breiteArchetypenBlock(): string {
  const zeilen = _internals.BUCKET_REIHENFOLGE.map((key) => {
    const b = playerGeneratorArchetypes[key];
    const ziel = _internals.zielvektorVonBucket(b.attributeBias);
    return `    ${JSON.stringify(key)}:{` +
      `preferredClasses:${JSON.stringify(b.preferredClasses)},` +
      `disallowedClasses:${JSON.stringify(b.disallowedClasses)},` +
      `preferredSubclasses:${JSON.stringify(b.preferredSubclasses)},` +
      `preferredPositiveTraits:${JSON.stringify(b.preferredPositiveTraits)},` +
      `preferredNegativeTraits:${JSON.stringify(b.preferredNegativeTraits)},` +
      `identityKeywords:${JSON.stringify(b.identityKeywords)},` +
      `ziel:{hp:${rund(ziel.hp)},atk:${rund(ziel.atk)},def:${rund(ziel.def)},spd:${rund(ziel.spd)}}}`;
  });
  return `  const BREITE_ARCHETYPEN={\n${zeilen.join(",\n")}\n  };`;
}

function unterklasseArchetypenBlock(): string {
  const zeilen = ZUORDNUNGEN.map((z) => {
    const ids = idsVonNamen(z.archetypen, `subclass-archetypes.ts: ${z.unterklasse}`);
    return `    ${JSON.stringify(z.unterklasse)}:${JSON.stringify(ids)}`;
  });
  return `  const UNTERKLASSE_ARCHETYPEN={\n${zeilen.join(",\n")}\n  };`;
}

function bildbefundeBlock(): string {
  const zeilen = BILDBEFUNDE.map((b) => {
    const ids = idsVonNamen(b.archetypen, `subclass-archetypes.ts BILDBEFUNDE: ${b.spieler}`);
    return `    ${JSON.stringify(b.spieler)}:${JSON.stringify(ids)}`;
  });
  return `  const BILDBEFUNDE_ARCHETYPEN={\n${zeilen.join(",\n")}\n  };`;
}

const block = [
  MARKER_AUF,
  "  // Erzeugt von scripts/generiere-kampf-archetyp-daten.ts aus den echten Quellen:",
  "  //   lib/player-generator/player-generator-archetypes.ts (14 breite Buckets)",
  "  //   lib/battle/subclass-archetypes.ts                   (Unterklasse->Archetyp, Bildbefunde)",
  "  //   lib/battle/archetype-registry.ts                    (35 Kampf-Archetypen)",
  "  // Wer hier etwas von Hand ändert, verliert es beim nächsten Lauf.",
  archetypWerteBlock(),
  breiteArchetypenBlock(),
  unterklasseArchetypenBlock(),
  bildbefundeBlock(),
  `  const STANDARD_ARCHETYP_ID=${JSON.stringify(STANDARD_ARCHETYP_ID)};`,
  MARKER_ZU,
].join("\n");

const schreiben = process.argv.includes("--schreiben");

if (!schreiben) {
  console.log(block);
  console.log(`\n${ARCHETYPES.length} Archetypen, ${_internals.BUCKET_REIHENFOLGE.length} Buckets, ` +
    `${ZUORDNUNGEN.length} Unterklassen-Zuordnungen, ${BILDBEFUNDE.length} Bildbefunde. ` +
    `Mit --schreiben landet der Block direkt im Motor.`);
} else {
  const pfad = resolve(process.cwd(), "public/mockups/battle-mode.engine.js");
  const alt = readFileSync(pfad, "utf8");
  const iAuf = alt.indexOf(MARKER_AUF);
  const iZu = alt.indexOf(MARKER_ZU);
  if (iAuf === -1 || iZu === -1) {
    throw new Error(
      `generiere-kampf-archetyp-daten: Marker nicht gefunden in ${pfad}. ` +
        `Beim allerersten Lauf muessen "${MARKER_AUF}" und "${MARKER_ZU}" von Hand einmal eingefuegt werden.`,
    );
  }
  const neu = alt.slice(0, iAuf) + block + alt.slice(iZu + MARKER_ZU.length);
  writeFileSync(pfad, neu, "utf8");
  console.log(`Geschrieben nach ${pfad}.`);
}
