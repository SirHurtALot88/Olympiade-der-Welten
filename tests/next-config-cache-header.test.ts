/**
 * CACHE-HEADER FÜR public/-DATEIEN UND KOMPRESSION — KONTRAKT.
 *
 * Opus-Performance-Review 16.11. (Live-Server): battle-mode.engine.js 19,7 MB (gzip 12,5 MB),
 * `max-age=0`; beim Arena-Start ~244 Sprites als bedingte Anfragen bei jedem Reload.
 *
 * Die Dateien in public/ sind NICHT per Hash versioniert (Reworks ersetzen Sprites/Szenen unter
 * gleichem Namen). Darum: Bilder nur kurz frisch (1 h + SWR), Motor-/Mockup-Dateien `no-cache`
 * (immer per ETag revalidieren), niemals `immutable`/lange max-age. Kompression macht Caddy
 * (zstd+gzip), deshalb muss Next `compress` abschalten, sonst bleibt Caddys zstd wirkungslos.
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

  it("keine Regel setzt immutable oder ein max-age über einer Stunde", async () => {
    for (const r of await regeln()) {
      for (const h of r.headers) {
        expect(h.value).not.toMatch(/immutable/);
        const ma = /max-age=(\d+)/.exec(h.value);
        if (ma) expect(Number(ma[1])).toBeLessThanOrEqual(3600);
      }
    }
  });

  it("Next komprimiert nicht selbst (Caddy übernimmt zstd/gzip)", () => {
    expect(nextConfig.compress).toBe(false);
  });
});

describe("deploy/hetzner/Caddyfile", () => {
  const caddyfile = readFileSync(path.join(__dirname, "..", "deploy", "hetzner", "Caddyfile"), "utf8");

  it("Oly-Block komprimiert mit zstd und gzip vor dem reverse_proxy", () => {
    const block = /\{\$OLY_DOMAIN\}\s*\{([\s\S]*?)\n\}/.exec(caddyfile)?.[1] ?? "";
    const code = block
      .split("\n")
      .filter((l) => !l.trim().startsWith("#"))
      .join("\n");
    expect(code).toMatch(/^\s*encode zstd gzip\s*$/m);
    expect(code.indexOf("encode")).toBeLessThan(code.indexOf("reverse_proxy"));
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
