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
//     [--size 256] [--palette]
// Chris' erster Testlauf (05.09.): Datenbank + Restart korrekt, Teamname/Trikot laden, Foto
// bleibt graue Silhouette -- die erste Lieferung war als JPEG exportiert (nur wegen der
// Chat-Uebertragungsgrenze, s. Git-Historie), .jpg wird von PCMs ProCyclistPhoto-Ordner
// offenbar NICHT akzeptiert. --palette erzeugt eine ECHTE PNG-Datei (8-Bit indiziert statt
// 24-Bit) -- kleiner (~4x) ohne das Format zu wechseln, damit auch die volle ~2984er-Lieferung
// unter das Uebertragungslimit passt.
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const PORTRAITS_DIR = 'public/portraits';
const EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

function parseArgs(argv) {
  const out = { trace: null, outDir: 'data/generated/pcm-mod/photos', size: 256, palette: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--trace') out.trace = argv[++i];
    else if (argv[i] === '--out') out.outDir = argv[++i];
    else if (argv[i] === '--size') out.size = Number(argv[++i]);
    else if (argv[i] === '--palette') out.palette = true;
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
      await sharp(src)
        .resize(args.size, args.size, { fit: 'cover' })
        .png(args.palette ? { palette: true, quality: 80, effort: 8 } : {})
        .toFile(path.join(args.outDir, `${slug}.png`));
      ok++;
      manifest.push({ olyPlayerName: rider.olyPlayerName, slug, photo: `${slug}.png` });
    } catch (e) {
      missing++;
      console.warn(`WARNUNG: ${rider.olyPlayerName} (${src}): ${e.message}`);
    }
  }

  writeFileSync(path.join(args.outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`${ok} Spielerportraits exportiert (${args.size}x${args.size} PNG${args.palette ? ', indiziert' : ''}), ${missing} fehlgeschlagen/fehlend.`);
  console.log(`Ausgabe: ${args.outDir}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
