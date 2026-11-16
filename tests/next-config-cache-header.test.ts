/**
 * CACHE-HEADER FÜR public/-DATEIEN UND KOMPRESSION — KONTRAKT.
 *
 * Opus-Performance-Review 16.11. (Live-Server): battle-mode.engine.js 19,7 MB (gzip 12,5 MB),
 * `max-age=0`; beim Arena-Start ~244 Sprites als bedingte Anfragen bei jedem Reload.
 *
 * Die Dateien in public/ sind NICHT per Hash versioniert (Reworks ersetzen Sprites/Szenen unter
 * gleichem Namen). Darum: Bilder nur kurz frisch (1 h + SWR), Motor-/Mockup-Dateien `no-cache`
 * (immer per ETag revalidieren), niemals `immutable`/lange max-age.
 * EINZIGE AUSNAHME (Task #165): /mockups/engine-bilder/ — die Dateinamen sind Inhalts-Hashes
 * (scripts/lagere-engine-bilder-aus.mjs), ein neuer Inhalt bekommt eine neue URL. Nur dort
 * `immutable` + ein Jahr; die Pruefung unten erlaubt es genau fuer diese eine Quelle.
 * Next komprimiert selbst; Caddy-`encode` war live groesser (s. next.config.ts).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import nextConfig from "../next.config";

type Regel = { source: string; headers: { key: string; value: string }[] };

async function regeln(): Promise<Regel[]> {
  return (await nextConfig.headers!()) as Regel[];
}

/** Wertet die `:dir(a|b|c)`-Quelle zu einer Liste der Verzeichnisse aus. */
function verzeichnisse(source: string): string[] {
  const m = /^\/:dir\(([^)]+)\)\/:path\*$/.exec(source);
  return m ? m[1].split("|") : [];
}

/** Wie Next: ALLE Regeln, deren Quelle den konkreten Pfad trifft, in Reihenfolge — die spaetere gewinnt. */
function wirksamFuer(rs: Regel[], pfad: string): string | undefined {
  let wert: string | undefined;
  for (const r of rs) {
    const muster = r.source
      .replace(/[.]/g, "\\.")
      .replace(/:dir\(([^)]+)\)/, "($1)")
      .replace(/:path\*$/, ".*");
    if (new RegExp("^" + muster + "$").test(pfad)) {
      wert = r.headers.find((h) => h.key === "Cache-Control")?.value ?? wert;
    }
  }
  return wert;
}

const ENGINE_BILDER_QUELLE = "/mockups/engine-bilder/:path*";

function cacheControlFuer(rs: Regel[], pfadAnfang: string): string | undefined {
  // ALLE passenden Regeln sammeln: Next wendet jede an, die spaetere gewinnt -- eine Ueberschneidung
  // waere also ein stiller Fehler. Genau eine Regel muss treffen.
  const treffer = rs.filter((r) => {
    const dirs = verzeichnisse(r.source);
    return dirs.length ? dirs.includes(pfadAnfang) : r.source === `/${pfadAnfang}/:path*`;
  });
  expect(treffer.length, `Regeln fuer /${pfadAnfang}`).toBe(1);
  return treffer[0].headers.find((h) => h.key === "Cache-Control")?.value;
}

describe("next.config.ts headers()", () => {
  it("Bilder/Assets: kurz frisch mit SWR, nie immutable", async () => {
    const rs = await regeln();
    for (const dir of [
      "portraits",
      "team-logos",
      "sprites",
      "szenen",
      "class-icons",
      "discipline-icons",
      "race-icons",
      "app-icons",
      "fonts",
      "sound",
    ]) {
      expect(cacheControlFuer(rs, dir), dir).toBe("public, max-age=3600, stale-while-revalidate=86400");
    }
  });

  it("/mockups/*: no-cache (immer per ETag revalidieren), kein max-age", async () => {
    const rs = await regeln();
    expect(cacheControlFuer(rs, "mockups")).toBe("no-cache");
  });

  it("/mockups/engine-bilder/*: immutable, ein Jahr (inhaltsadressiert) — die Engine selbst bleibt no-cache", async () => {
    const rs = await regeln();
    expect(wirksamFuer(rs, "/mockups/engine-bilder/0123456789ab.png")).toBe("public, max-age=31536000, immutable");
    expect(wirksamFuer(rs, "/mockups/battle-mode.engine.js")).toBe("no-cache");
    expect(wirksamFuer(rs, "/mockups/battle-mode.html")).toBe("no-cache");
    expect(wirksamFuer(rs, "/sprites/baukasten/k_walk.png")).toBe("public, max-age=3600, stale-while-revalidate=86400");
  });

  it("keine andere Regel setzt immutable oder ein max-age über einer Stunde", async () => {
    for (const r of await regeln()) {
      if (r.source === ENGINE_BILDER_QUELLE) continue;
      for (const h of r.headers) {
        expect(h.value).not.toMatch(/immutable/);
        const ma = /max-age=(\d+)/.exec(h.value);
        if (ma) expect(Number(ma[1])).toBeLessThanOrEqual(3600);
      }
    }
  });

  it("Next komprimiert selbst (Caddy-Kompression lieferte live groessere Antworten)", () => {
    expect(nextConfig.compress).toBe(true);
  });
});

describe("deploy/hetzner/Caddyfile", () => {
  const caddyfile = readFileSync(path.join(__dirname, "..", "deploy", "hetzner", "Caddyfile"), "utf8");

  it("Oly-Block hat kein `encode` (sonst doppelte/groessere Kompression)", () => {
    const block = /\{\$OLY_DOMAIN\}\s*\{([\s\S]*?)\n\}/.exec(caddyfile)?.[1] ?? "";
    const code = block
      .split("\n")
      .filter((l) => !l.trim().startsWith("#"))
      .join("\n");
    expect(code).not.toMatch(/^\s*encode\b/m);
    expect(code).toMatch(/reverse_proxy oly-app:3000/);
  });
});

describe("deploy/hetzner/auto-deploy.sh — Caddy-Neustart", () => {
  const skript = readFileSync(path.join(__dirname, "..", "deploy", "hetzner", "auto-deploy.sh"), "utf8");
  const code = skript
    .split("\n")
    .filter((l) => !l.trim().startsWith("#"))
    .join("\n");

  it("vergleicht die Caddyfile im Container mit der auf der Platte (kein Git-Diff)", () => {
    // Der Git-Diff taugt hier nicht: bash liest das Skript nach `git merge --ff-only` weiter aus der
    // alten Datei, ein erst durch den Merge eingefuehrter Block liefe im selben Lauf nicht mehr an.
    expect(code).toMatch(/exec -T caddy cat \/etc\/caddy\/Caddyfile[^\n]*cmp -s - deploy\/hetzner\/Caddyfile/);
    expect(code).toMatch(/restart caddy/);
    expect(code).not.toMatch(/grep[^\n]*deploy\/hetzner\/Caddyfile[^\n]*DATEIEN/);
  });
});

describe("Arena-Hülle beim Host", () => {
  it("holt battle-mode.html mit no-cache, nicht force-cache", () => {
    const host = readFileSync(
      path.join(__dirname, "..", "app", "foundation", "battle-arena", "FoundationBattleArenaHost.tsx"),
      "utf8",
    );
    expect(host).toMatch(/fetch\("\/mockups\/battle-mode\.html", \{ cache: "no-cache" \}\)/);
  });
});
