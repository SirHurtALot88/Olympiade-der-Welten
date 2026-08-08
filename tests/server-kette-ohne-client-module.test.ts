/**
 * GEMELDET: „habe saisonwechsel prüfen gedrückt … ich hab ok gedrückt aber es passiert nix"
 *
 * Nach dem Sichtbarkeits-Fix (#437) stand der Grund endlich auf dem Bildschirm:
 *
 *     Attempted to call roundViewNumber() from the server but roundViewNumber is on the client.
 *     It's not possible to invoke a client function from the server.
 *
 * URSACHE, mit Zeile: `lib/season/season-snapshot-service.ts` zog ueber
 * `lib/foundation/team-discipline-rank-engine.ts:2` das `"use client"`-Modul
 * `lib/foundation/tabs/season-stand-render-helpers.tsx` in einen Route-Handler. Next.js laesst das
 * nicht zu und wirft zur Laufzeit — der Saisonwechsel starb genau dort, wo er den Snapshot baut.
 *
 * Der Befund ist NICHT neu: `scripts/audit-koop-spielbarkeit.ts:624` prueft seit PR #211 auf genau
 * diese Meldung und haelt fest, das Werkzeug sei „in Route-Handlern faktisch kaputt". Nur sah es
 * niemand, weil das Saisonfinale-Panel Fehler gar nicht anzeigen konnte.
 *
 * `npm run ci:client-bundle-lint` faengt diesen Fall NICHT — nachgemessen: mit dem kaputten Import
 * meldet er weiterhin „Client bundle boundaries OK". Deshalb dieser Test: er laeuft den
 * Import-Graphen ab den Server-Einstiegen ab und findet jedes `"use client"` auf dem Weg.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const WURZEL = process.cwd();

/**
 * Einstiege, die ausschliesslich auf dem Server laufen. Von hier aus darf kein `"use client"`
 * erreichbar sein — sonst bricht der Aufruf zur Laufzeit, nicht beim Bauen.
 */
const SERVER_EINSTIEGE = [
  "lib/season/season-snapshot-service.ts",
  "lib/season/season-transition-service.ts",
  "lib/season/preseason-workflow-service.ts",
];

const ENDUNGEN = [".ts", ".tsx", "/index.ts", "/index.tsx"];

function loesePfad(spezifizierer: string, vonDatei: string): string | null {
  let basis: string;
  if (spezifizierer.startsWith("@/")) {
    basis = join(WURZEL, spezifizierer.slice(2));
  } else if (spezifizierer.startsWith(".")) {
    basis = resolve(dirname(vonDatei), spezifizierer);
  } else {
    // Paket aus node_modules — nicht unser Code, nicht unsere Grenze.
    return null;
  }
  for (const endung of ENDUNGEN) {
    const kandidat = `${basis}${endung}`;
    if (existsSync(kandidat)) return kandidat;
  }
  return existsSync(basis) && basis.match(/\.tsx?$/) ? basis : null;
}

/** Nur echte Wert-Importe: `import type` verschwindet beim Uebersetzen und kann nichts brechen. */
function sammleImporte(quelle: string): string[] {
  const treffer: string[] = [];
  const muster = /^\s*import\s+(?!type\s)([\s\S]*?)from\s+["']([^"']+)["']/gm;
  let m: RegExpExecArray | null;
  while ((m = muster.exec(quelle)) != null) {
    if (/^\s*\{\s*type\s/.test(m[1] ?? "")) continue;
    treffer.push(m[2]!);
  }
  const reexport = /^\s*export\s+(?!type\s)[\s\S]*?from\s+["']([^"']+)["']/gm;
  while ((m = reexport.exec(quelle)) != null) treffer.push(m[1]!);
  return treffer;
}

function findeClientModule(einstieg: string): Array<{ modul: string; weg: string[] }> {
  const start = join(WURZEL, einstieg);
  const gesehen = new Set<string>();
  const funde: Array<{ modul: string; weg: string[] }> = [];
  const stapel: Array<{ datei: string; weg: string[] }> = [{ datei: start, weg: [einstieg] }];

  while (stapel.length > 0) {
    const { datei, weg } = stapel.pop()!;
    if (gesehen.has(datei)) continue;
    gesehen.add(datei);
    if (!existsSync(datei)) continue;

    const quelle = readFileSync(datei, "utf8");
    if (/^\s*["']use client["']/.test(quelle) && datei !== start) {
      funde.push({ modul: datei.replace(`${WURZEL}/`, ""), weg });
      // Nicht weiter absteigen: der Bruch ist hier, alles darunter ist Folge.
      continue;
    }

    for (const spez of sammleImporte(quelle)) {
      const ziel = loesePfad(spez, datei);
      if (ziel) stapel.push({ datei: ziel, weg: [...weg, ziel.replace(`${WURZEL}/`, "")] });
    }
  }
  return funde;
}

describe("Server-Kette zieht kein \"use client\"-Modul", () => {
  for (const einstieg of SERVER_EINSTIEGE) {
    it(`${einstieg} bleibt serverfaehig`, () => {
      const funde = findeClientModule(einstieg);
      const bericht = funde
        .map((fund) => `  ${fund.modul}\n    ueber: ${fund.weg.join("\n           -> ")}`)
        .join("\n");
      expect(funde, `"use client" aus dem Server erreichbar:\n${bericht}`).toEqual([]);
    });
  }

  it("die verschobenen Helfer liegen in einem serverfaehigen Modul", () => {
    const quelle = readFileSync(join(WURZEL, "lib/foundation/season-stand-rank-helpers.ts"), "utf8");
    expect(quelle).not.toMatch(/^\s*["']use client["']/);
    expect(quelle).toContain("export function roundViewNumber");
    expect(quelle).toContain("export function buildSharedRankMap");
  });

  it("das Client-Modul exportiert sie weiterhin, damit kein Aufrufer bricht", () => {
    const quelle = readFileSync(
      join(WURZEL, "lib/foundation/tabs/season-stand-render-helpers.tsx"),
      "utf8",
    );
    expect(quelle).toContain('from "@/lib/foundation/season-stand-rank-helpers"');
    expect(quelle).toContain("buildSharedRankMap");
    expect(quelle).toContain("roundViewNumber");
  });
});
