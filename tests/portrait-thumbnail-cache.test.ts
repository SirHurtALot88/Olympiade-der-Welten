/**
 * DIE VERKLEINERTEN PORTRAITS ÜBERLEBEN EINEN DEPLOY — UND EIN FEHLGESCHLAGENER CACHE MACHT DIE
 * ANTWORT NICHT SCHLECHTER.
 *
 * GEMELDET VON CHRIS: „wenn ich teams seite aufrufe laden die spieler portraits furchtbar langsam."
 *
 * BEFUND: `getVariantCachePath` legt die verkleinerten Bilder unter
 * `process.cwd()/.cache/media-thumbs/…` ab. Im Container ist das `/app/.cache/media-thumbs` — und
 * dafür gab es KEIN Volume. Der Auto-Deploy baut bei jedem Push auf main einen neuen Container,
 * also war der Bestand nach jedem Deploy leer und jede Teamseite musste ihre Portraits neu
 * dekodieren und verkleinern, gedrosselt auf vier gleichzeitige Ladungen.
 *
 * Das ist derselbe Fehler, den `data/bug-reports` schon einmal hatte (siehe den Absatz im
 * Dockerfile) — nur mit Geschwindigkeit statt Datenverlust als Folge.
 *
 * GEMESSEN (scripts-Messung, 14 Portraits einer Teamseite, verrauschtes 1024×1536-PNG, also nicht
 * wegkomprimierbar): 421 ms kalt gegen 4,3 ms warm für die Thumbs, 441 ms gegen 6,2 ms für die
 * Vorschau. Faktor 98 bzw. 72 — und das seriell auf dieser Maschine, vor der Drosselung und ohne
 * HTTP.
 *
 * GEPINNT WIRD:
 *  1. Der Cache-Pfad liegt auf einem Volume, und das Verzeichnis existiert im Image (sonst gehört
 *     das frische Named Volume root und die App bekommt EACCES — genau die Falle, die der
 *     Dockerfile für `bug-reports` schon dokumentiert).
 *  2. Schlägt das Ablegen im Cache fehl, wird trotzdem das VERKLEINERTE Bild ausgeliefert. Vorher
 *     lag der Schreibvorgang im selben `try` wie die Verkleinerung, ein fehlgeschlagenes
 *     `writeFile` fiel also in den Notausgang und lieferte das Original — Megabytes statt
 *     Kilobytes, und damit das Gegenteil dessen, was hier repariert wird.
 */
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { serveMediaAsset } from "@/lib/media/serveMediaAsset";

describe("Portrait-Thumbnails · der Cache liegt auf einem Volume", () => {
  const compose = () => require("node:fs").readFileSync("deploy/hetzner/docker-compose.yml", "utf8") as string;
  const dockerfile = () => require("node:fs").readFileSync("Dockerfile", "utf8") as string;

  it("mountet genau den Pfad, den `getVariantCachePath` benutzt", () => {
    // Der Pfad im Code ist `<cwd>/.cache/media-thumbs`, im Container also /app/.cache/media-thumbs.
    const quelle = require("node:fs").readFileSync("lib/media/serveMediaAsset.ts", "utf8") as string;
    expect(quelle).toContain('path.join(process.cwd(), ".cache", "media-thumbs", kind)');
    expect(compose()).toContain(":/app/.cache/media-thumbs");
  });

  it("deklariert das Volume, sonst startet Compose gar nicht erst", () => {
    const [, deklarationen = ""] = compose().split(/^volumes:$/m);
    expect(deklarationen).toContain("oly-media-cache:");
  });

  it("legt das Verzeichnis im Image an — sonst gehört das Volume root", () => {
    // Ohne diese Zeile bekäme die App (uid 1001) EACCES beim Schreiben und der Cache bliebe für
    // immer leer, ohne dass irgendetwas im Log darauf hinweist.
    expect(dockerfile()).toMatch(/mkdir -p [^\n]*\/app\/\.cache\/media-thumbs/);
    expect(dockerfile()).toMatch(/chown -R oly:nodejs [^\n]*\/app\/\.cache/);
  });

  it("hält lokale Thumbs aus dem Image heraus", () => {
    // `COPY . .` nähme sonst den Cache einer lokalen Sitzung mit ins Image.
    const dockerignore = require("node:fs").readFileSync(".dockerignore", "utf8") as string;
    expect(dockerignore.split("\n").map((zeile) => zeile.trim())).toContain(".cache");
  });
});

describe("Portrait-Thumbnails · ein fehlgeschlagener Cache liefert trotzdem klein aus", () => {
  let verzeichnis = "";
  let quellbild = "";
  let quellgroesse = 0;

  beforeAll(async () => {
    verzeichnis = await mkdtemp(path.join(os.tmpdir(), "portrait-cache-"));
    quellbild = path.join(verzeichnis, "portrait.png");
    // 1024×1536 wie die echten Portraits, mit Rauschen gefüllt: eine einfarbige Fläche
    // komprimierte auf wenige Kilobyte und der Größenvergleich unten sagte dann nichts aus.
    const roh = Buffer.alloc(1024 * 1536 * 3);
    let zustand = 123456789;
    for (let index = 0; index < roh.length; index += 1) {
      zustand ^= zustand << 13;
      zustand |= 0;
      zustand ^= zustand >>> 17;
      zustand ^= zustand << 5;
      zustand |= 0;
      roh[index] = zustand & 0xff;
    }
    await writeFile(
      quellbild,
      await sharp(roh, { raw: { width: 1024, height: 1536, channels: 3 } }).png().toBuffer(),
    );
    quellgroesse = (await readFile(quellbild)).byteLength;
  });

  afterAll(async () => {
    await rm(verzeichnis, { recursive: true, force: true });
    // Was der erfolgreiche Lauf unten im Repo-Cache abgelegt hat, wieder wegräumen.
    await rm(path.join(process.cwd(), ".cache", "media-thumbs", "player-portrait"), {
      recursive: true,
      force: true,
    });
  });

  async function hole(assetId: string) {
    const antwort = await serveMediaAsset({
      request: new Request("http://local/api/media/player-portrait/x?variant=thumb"),
      kind: "player-portrait",
      assetId,
      sourcePath: quellbild,
    });
    return { antwort, bytes: (await antwort.arrayBuffer()).byteLength };
  }

  it("liefert im Normalfall ein winziges webp", async () => {
    const { antwort, bytes } = await hole("test-portrait");
    expect(antwort.headers.get("Content-Type")).toBe("image/webp");
    // Die Zahl ist bewusst grob: gepinnt wird „um Größenordnungen kleiner als das Original",
    // nicht eine bestimmte Kompressionsrate.
    expect(bytes).toBeLessThan(quellgroesse / 20);
  });

  it("liefert AUCH DANN klein aus, wenn das Ablegen im Cache scheitert", async () => {
    // Ein Dateiname jenseits der 255-Zeichen-Grenze: `mkdir` des Ordners geht durch, `writeFile`
    // scheitert mit ENAMETOOLONG. Das ist derselbe Ausgang wie ein root-eigenes Volume (EACCES)
    // oder eine volle Platte — nur portabel herstellbar.
    const { antwort, bytes } = await hole("z".repeat(300));
    expect(antwort.headers.get("Content-Type")).toBe("image/webp");
    expect(bytes).toBeLessThan(quellgroesse / 20);
  });
});
