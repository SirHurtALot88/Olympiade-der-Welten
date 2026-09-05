// Exportiert Oly-Spielerportraits (public/portraits/<slug>.jpg) als PCM-taugliche PNGs,
// benannt nach `gene_sz_photo` -- dem Feld, das export-pcm-mod.mjs beim Patchen je Fahrerzeile
// auf playerSlug(player) setzt (Name-Teil der Oly-ID, z.B. "kelektros" fuer
// "player-2307-kelektros"). Das ist zufaellig dieselbe Slug-Konvention wie unser eigenes
// public/portraits/ (s. dessen README.md), deshalb reicht ein einfacher Format-/Groessen-
// Export -- keine Neubenennung.
//
// Nur Fahrer exportieren, die tatsaechlich im letzten Export gepatcht wurden (Trace-Datei aus
// export-pcm-mod.mjs, `riders[].olyPlayerId`) -- nicht alle 2984 Oly-Spieler pauschal, falls
// Trace und tatsaechlicher DB-Stand je auseinanderlaufen (z.B. anderer --transfer-reserve).
//
// Ordner/Format sind wie bei export-logos.mjs aus oeffentlicher PCM-Modding-Doku uebernommen,
// NICHT an Chris' Installation verifiziert: Documents/AppData\...\Mod\<Mod>\ProCyclistPhoto\
// <gene_sz_photo>.<ext>. Format PNG (wie Logos), Groesse 256x256 -- reine Annahme, da 400x400-
// Quellportraits quadratisch genug sind, dass ein Crop nichts abschneidet, das nicht sowieso
// zentriert waere.
//
//   node scripts/pcm/export-photos.mjs --trace <pfad-zu-oly-pcm-mapping-trace.json> [--out <dir>]
//     [--format png|jpeg] [--quality 85]
// --format jpeg ist NUR eine Not-Option fuer die Dateiuebertragung an Chris (PNG bei 256x256
// x ~2984 Dateien wird als Zip zu gross fuer die Chat-Uebertragung) -- welches Format PCM
// tatsaechlich erwartet, ist wie bei den Logos nicht verifiziert, deshalb bleibt PNG Default.
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const PORTRAITS_DIR = 'public/portraits';
const EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

function parseArgs(argv) {
  const out = { trace: null, outDir: 'data/generated/pcm-mod/photos', format: 'png', quality: 85 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--trace') out.trace = argv[++i];
    else if (argv[i] === '--out') out.outDir = argv[++i];
    else if (argv[i] === '--format') out.format = argv[++i];
    else if (argv[i] === '--quality') out.quality = Number(argv[++i]);
  }
  if (!out.trace) throw new Error('Pflichtargument fehlt: --trace <pfad-zu-oly-pcm-mapping-trace.json>');
  return out;
}

function playerSlug(playerId) {
  const m = /^player-\d+-(.+)$/.exec(playerId);
  return m ? m[1] : playerId;
}

function findSourceFile(slug) {
  for (const ext of EXTENSIONS) {
    const p = path.join(PORTRAITS_DIR, `${slug}${ext}`);
    if (existsSync(p)) return p;
  }
  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  mkdirSync(args.outDir, { recursive: true });

  const trace = JSON.parse(readFileSync(args.trace, 'utf8'));
  const riders = trace.riders || [];
  console.log(`Gepatchte Fahrer im Trace: ${riders.length}`);

  const manifest = [];
  let ok = 0;
  let missing = 0;
  for (const rider of riders) {
    const slug = playerSlug(rider.olyPlayerId);
    const src = findSourceFile(slug);
    if (!src) {
      missing++;
      console.warn(`WARNUNG: kein Portrait fuer ${rider.olyPlayerName} (${rider.olyPlayerId}) unter ${PORTRAITS_DIR}/${slug}.*`);
      continue;
    }
    try {
      await sharp(src).resize(256, 256, { fit: 'cover' }).toFormat(args.format, args.format === 'jpeg' ? { quality: args.quality } : {}).toFile(path.join(args.outDir, `${slug}.${args.format === 'jpeg' ? 'jpg' : args.format}`));
      ok++;
      manifest.push({ olyPlayerName: rider.olyPlayerName, slug, photo: `${slug}.${args.format === 'jpeg' ? 'jpg' : args.format}` });
    } catch (e) {
      missing++;
      console.warn(`WARNUNG: ${rider.olyPlayerName} (${src}): ${e.message}`);
    }
  }

  writeFileSync(path.join(args.outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`${ok} Spielerportraits exportiert (256x256 ${args.format.toUpperCase()}), ${missing} fehlgeschlagen/fehlend.`);
  console.log(`Ausgabe: ${args.outDir}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
