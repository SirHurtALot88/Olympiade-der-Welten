/**
 * Paket F5: Entwicklersprache raus — die Verhandlungs-Signalcodes.
 *
 * `formatNegotiationSignalLabel` existierte dreifach (Client, Buy-Derivations,
 * Format-Helpers) mit driftenden Maps, und der gemeinsame Fallback
 * `value.replaceAll("_", " ")` stellte unübersetzte Codes als kaputten
 * Fließtext ins Spiel („morale former team hostile").
 *
 * Jetzt gilt:
 *  1. EINE Implementierung (foundation-format-render-helpers) — der Test
 *     zählt die Definitionen im Repo.
 *  2. Jeder im Code emittierte Signal-Code hat einen deutschen Eintrag —
 *     der Test GREPPT die Emitter (warnings.push / blockingReasons.push in
 *     den Markt-Services und im Moral-Service) statt einer Wunschliste.
 *  3. Der Fallback zeigt NIE rohen Code — generischer deutscher Hinweis
 *     plus console.warn.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { formatNegotiationSignalLabel } from "@/lib/foundation/tabs/foundation-format-render-helpers";

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

/** Alle Signal-Codes, die die Services wirklich emittieren. */
function gesammelteSignalCodes(): string[] {
  const dateien = [
    "lib/market/contract-negotiation-preview.ts",
    "lib/market/transfermarkt-buy-service.ts",
    "lib/market/transfermarkt-local-service.ts",
    "lib/market/transfermarkt-sell-service.ts",
    "lib/morale/player-morale-service.ts",
  ];
  const codes = new Set<string>();
  for (const datei of dateien) {
    const inhalt = quelle(datei);
    // Direkte String-Literale: warnings.push("code") / blockingReasons.push("code")
    for (const m of inhalt.matchAll(/(?:warnings|blockingReasons)\.push\("([a-z_]+)"\)/g)) {
      codes.add(m[1]!);
    }
    // Konstanten-Pushes: push(SOME_CONSTANT) → Konstante im selben File oder
    // in den bekannten Guard-Modulen auflösen.
    for (const m of inhalt.matchAll(/(?:warnings|blockingReasons)\.push\(([A-Z][A-Z0-9_]+)\)/g)) {
      const name = m[1]!;
      const eigene = inhalt.match(new RegExp(`${name}\\s*=\\s*"([a-z_]+)"`));
      if (eigene) {
        codes.add(eigene[1]!);
        continue;
      }
      for (const guard of ["lib/market/transfer-sold-cooldown.ts", "lib/market/anti-rebuy-guard.ts"]) {
        const fremd = quelle(guard).match(new RegExp(`${name}\\s*=\\s*"([a-z_]+)"`));
        if (fremd) {
          codes.add(fremd[1]!);
          break;
        }
      }
    }
  }
  return [...codes].sort();
}

describe("jeder emittierte Signal-Code hat eine deutsche Übersetzung", () => {
  const codes = gesammelteSignalCodes();

  it("der Grep findet die Emitter überhaupt (Selbsttest)", () => {
    expect(codes.length).toBeGreaterThan(20);
    expect(codes).toContain("insufficient_cash");
    expect(codes).toContain("morale_former_team_hostile");
  });

  it.each(codes)("%s → deutscher Text ohne Unterstriche", (code) => {
    const label = formatNegotiationSignalLabel(code);
    expect(label).not.toContain("_");
    // Nie der rohe Code mit Leerzeichen statt Unterstrichen (der alte Fallback).
    expect(label).not.toBe(code.replaceAll("_", " "));
    // Und nie der Nicht-übersetzt-Fallback — emittierte Codes MÜSSEN einen Eintrag haben.
    expect(label).not.toContain("noch ohne Übersetzung");
  });

  it("morale_former_team_hostile trägt die Moral-Warnung im Klartext", () => {
    expect(formatNegotiationSignalLabel("morale_former_team_hostile")).toBe(
      "Ehemaliges Team ist feindselig — Moral-Risiko.",
    );
  });
});

describe("der Fallback zeigt nie rohen Code", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("unbekannter Code → generischer deutscher Hinweis + console.warn", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const label = formatNegotiationSignalLabel("some_future_signal_code");
    expect(label).not.toContain("some future signal code");
    expect(label).not.toContain("_");
    expect(label).toContain("Verhandlungs-Hinweis");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0]![0])).toContain("some_future_signal_code");
  });
});

describe("eine Implementierung, keine Zwillinge", () => {
  it("formatNegotiationSignalLabel ist genau einmal definiert", () => {
    const definitionen = [
      "lib/foundation/tabs/foundation-format-render-helpers.ts",
      "app/foundation/transfermarkt-v2/TransfermarktV2Client.tsx",
      "lib/foundation/tabs/use-market-buy-derivations.ts",
    ]
      .map((pfad) => quelle(pfad))
      .flatMap((inhalt) => inhalt.match(/function formatNegotiationSignalLabel\(/g) ?? []);
    expect(definitionen).toHaveLength(1);
  });

  it("die früheren Duplikat-Stellen importieren die geteilte Funktion", () => {
    expect(quelle("app/foundation/transfermarkt-v2/TransfermarktV2Client.tsx")).toContain(
      'import { formatNegotiationSignalLabel } from "@/lib/foundation/tabs/foundation-format-render-helpers"',
    );
    expect(quelle("lib/foundation/tabs/use-market-buy-derivations.ts")).toContain(
      'import { formatNegotiationSignalLabel } from "@/lib/foundation/tabs/foundation-format-render-helpers"',
    );
  });
});

describe("F5-Nachbarn: kein roher Slug im Home-Stepper", () => {
  it("beide Schedule-Ableitungen formatieren Spieltag N statt matchdayId", () => {
    for (const pfad of [
      "lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx",
      "lib/foundation/tabs/use-home-v2-overview-derivations.ts",
    ]) {
      const inhalt = quelle(pfad);
      expect(inhalt, pfad).not.toContain("label: matchdayId,");
      expect(inhalt, pfad).toContain("`Spieltag ${absoluteIndex + 1}`");
    }
  });
});
