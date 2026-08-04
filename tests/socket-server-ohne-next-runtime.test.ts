import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Der Socket-Server (`server.ts`, gestartet via `tsx`) ist ein NACKTER Node-Prozess. Module aus
 * der Next-Laufzeit — allen voran `next/server` — sind dort nicht ladbar: schon der IMPORT wirft
 * "Invariant: AsyncLocalStorage accessed in runtime where it is not available", und zwar beim
 * Modulladen, bevor der Server ueberhaupt lauschen kann. `npm start` stirbt dann kommentarlos.
 *
 * Genau das ist passiert, als `lib/room/room-store.ts` den Liga-Setup-Draft bekam: ueber
 * `league-setup-draft-service` → `ai-picks-run-service` → … → `lib/persistence/resolve-local-save`
 * hing ploetzlich ein `next/server` in der Kette. Aufgefallen ist es erst im CI-Smoke ueber einen
 * echten Serverstart — mit einer Fehlermeldung, die nichts ueber die Ursache sagt.
 *
 * Dieser Test faehrt denselben Import-Graphen statisch ab und nennt beim Bruch die KETTE. Er ist
 * damit die schnelle, sprechende Variante desselben Nachweises. Er prueft bewusst den Graphen und
 * nicht "kommt das Wort next/server irgendwo vor": entscheidend ist die Erreichbarkeit VOM
 * Socket-Server aus, nicht die blosse Existenz.
 */

const ROOT = path.resolve(__dirname, "..");

/** Nur Next-Laufzeit-Module. `next/env` etwa ist reines Node und in Skripten voellig in Ordnung. */
const VERBOTEN = [/^next\/server$/, /^next\/headers$/, /^next\/navigation$/, /^next\/cache$/];

function aufloesen(spezifizierer: string): string | null {
  if (!spezifizierer.startsWith("@/")) return null;
  const basis = path.join(ROOT, spezifizierer.slice(2));
  for (const kandidat of [`${basis}.ts`, `${basis}.tsx`, path.join(basis, "index.ts")]) {
    if (fs.existsSync(kandidat)) return kandidat;
  }
  return null;
}

/** Tiefensuche mit mitgefuehrtem Pfad, damit der Fehlerfall die ganze Kette zeigen kann. */
function sucheVerboteneKante(start: string): { kette: string[]; modul: string } | null {
  const gesehen = new Set<string>();

  function besuche(datei: string, pfad: string[]): { kette: string[]; modul: string } | null {
    if (gesehen.has(datei)) return null;
    gesehen.add(datei);

    let quelltext: string;
    try {
      quelltext = fs.readFileSync(datei, "utf8");
    } catch {
      return null;
    }

    // Ganze Import-Anweisungen lesen, nicht nur die `from`-Zeile: `import type { … }` steht bei
    // mehrzeiligen Importen viele Zeilen VOR dem `from`, ein Blick nur aufs `from` wuerde sie
    // faelschlich als Wert-Import zaehlen.
    //
    // Und NUR Wert-Importe zaehlen: `import type … from "@/…"` wird wegkompiliert, das Modul wird
    // zur Laufzeit nie geladen, die Kante existiert also gar nicht. Wuerde der Test sie
    // mitzaehlen, meldete er Ketten, die es im laufenden Prozess nie gibt — und ein Waechter, der
    // grundlos rot wird, wird irgendwann geloescht statt gelesen.
    for (const treffer of quelltext.matchAll(/\bimport\s+(type\s+)?([\s\S]*?)\bfrom\s*["']([^"']+)["']/g)) {
      const nurTyp = Boolean(treffer[1]);
      const spezifizierer = treffer[3]!;
      if (nurTyp) continue;

      if (VERBOTEN.some((muster) => muster.test(spezifizierer))) {
        return { kette: [...pfad, datei], modul: spezifizierer };
      }
      const ziel = aufloesen(spezifizierer);
      if (!ziel) continue;
      const fund = besuche(ziel, [...pfad, datei]);
      if (fund) return fund;
    }
    return null;
  }

  return besuche(start, []);
}

describe("Socket-Server laedt keine Next-Laufzeit-Module", () => {
  it("erreicht von server.ts aus kein next/server & Co.", () => {
    const fund = sucheVerboteneKante(path.join(ROOT, "server.ts"));
    const meldung = fund
      ? `Verbotener Import "${fund.modul}" ueber:\n  ${fund.kette
          .map((datei) => datei.replace(`${ROOT}/`, ""))
          .join("\n  → ")}`
      : "";
    expect(meldung).toBe("");
  });

  it("haelt insbesondere den Room-Store frei — er haengt direkt am Socket-Server", () => {
    // Eigener Fall, weil der Room-Store die Stelle ist, an der die Kante real entstanden ist:
    // hier wird der Liga-Setup-Draft angestossen, und der zieht die halbe KI-Kette nach.
    const fund = sucheVerboteneKante(path.join(ROOT, "lib/room/room-store.ts"));
    const meldung = fund
      ? `Verbotener Import "${fund.modul}" ueber:\n  ${fund.kette
          .map((datei) => datei.replace(`${ROOT}/`, ""))
          .join("\n  → ")}`
      : "";
    expect(meldung).toBe("");
  });
});
