// Exportiert Oly-Team-Logos (public/team-logos/<shortCode>.jpg) als PCM-taugliche PNGs,
// benannt nach `jersey_sz_abbreviation` -- dem Feld, ueber das PCM Logo-Dateien einer
// Team-Zeile zuordnet (jersey_sz_abbreviation bleibt bewusst unangetastet, s.
// export-pcm-mod.mjs Kopfkommentar, deshalb zeigen die Dateinamen weiter auf den echten
// Original-Code des Slots, nicht auf unsere neue `abbreviation`).
//
// Ordner/Groessen sind aus oeffentlicher PCM-Modding-Doku uebernommen (PCM.daily Tips &
// Tricks), nicht an Chris' Installation verifiziert -- 256x256 fuer Gui/team/logo, 64x64
// fuer Gui/team/minilogo (Namenszusatz "_minilogo"). Format PNG (neuere PCM-Versionen,
// aeltere nutzten TGA).
//
//   node scripts/pcm/export-logos.mjs --out <dir> [--save <saveId>]
import Database from 'better-sqlite3';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { readCdb, parseTree, findTableChunk, readColumnValues } from './cdb-format.mjs';
import { rankOlyTeams, matchSlotOrder, WT_SLOT_STRENGTH_ORDER, PT_SLOT_STRENGTH_ORDER } from './oly-pcm-mapping.mjs';

const SQLITE_PATH = process.env.OLY_APP_SQLITE_PATH || 'data/persistence/oly-app.sqlite';
const TEAM_LOGOS_DIR = 'public/team-logos';

function parseArgs(argv) {
  const out = { cdb: null, outDir: 'data/generated/pcm-mod/logos', save: null, order: 'f1' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--cdb') out.cdb = argv[++i];
    else if (argv[i] === '--out') out.outDir = argv[++i];
    else if (argv[i] === '--save') out.save = argv[++i];
    else if (argv[i] === '--order') out.order = argv[++i];
  }
  if (!out.cdb) throw new Error('Pflichtargument fehlt: --cdb <pfad-zur-OfficialRelease.cdb>');
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  mkdirSync(args.outDir, { recursive: true });
  const logoDir = path.join(args.outDir, 'logo');
  const minilogoDir = path.join(args.outDir, 'minilogo');
  mkdirSync(logoDir, { recursive: true });
  mkdirSync(minilogoDir, { recursive: true });

  const { buffer } = readCdb(args.cdb);
  const tree = parseTree(buffer);
  const teamTable = findTableChunk(tree, 'DYN_team');
  const teamIds = readColumnValues(teamTable, 'IDteam').values;
  const names = readColumnValues(teamTable, 'gene_sz_name').values;
  const divisions = readColumnValues(teamTable, 'fkIDdivision').values;
  const jerseyAbbr = readColumnValues(teamTable, 'jersey_sz_abbreviation').values;
  const idToJersey = new Map(teamIds.map((id, i) => [id, jerseyAbbr[i]]));

  function realTeamRowsByDivision(division) {
    const rows = [];
    for (let i = 0; i < teamIds.length; i++) {
      if (divisions[i] === division) rows.push({ rowIndex: i, IDteam: teamIds[i], name: names[i] });
    }
    return rows;
  }

  const wtTeamRows = realTeamRowsByDivision(10);
  const ptTeamRows = realTeamRowsByDivision(11);
  const wtOrderIdx = matchSlotOrder(WT_SLOT_STRENGTH_ORDER, wtTeamRows.map((t) => t.name));
  const ptOrderIdx = matchSlotOrder(PT_SLOT_STRENGTH_ORDER, ptTeamRows.map((t) => t.name));
  const wtSlotsOrdered = wtOrderIdx.map((i) => wtTeamRows[i]);
  const ptSlotsOrdered = ptOrderIdx.map((i) => ptTeamRows[i]);

  const db = new Database(SQLITE_PATH, { readonly: true });
  const saveId = args.save || db.prepare('select save_id from saves order by updated_at desc limit 1').get().save_id;
  const teamRows = db.prepare('select payload_json from teams where save_id = ?').all(saveId);
  const identityRows = db.prepare('select team_id, payload_json from team_identities where save_id = ?').all(saveId);
  const identityByTeam = new Map(identityRows.map((r) => [r.team_id, JSON.parse(r.payload_json)]));
  const olyTeams = teamRows.map((r) => JSON.parse(r.payload_json));
  const olyTeamsForRanking = olyTeams.map((t) => ({ teamId: t.teamId, name: t.name, budget: t.budget }));
  const { worldTour, proTeams } = rankOlyTeams(olyTeamsForRanking, identityByTeam, args.order);

  const assignments = [
    ...worldTour.map((olyTeam, i) => ({ olyTeam, slot: wtSlotsOrdered[i] })),
    ...proTeams.map((olyTeam, i) => ({ olyTeam, slot: ptSlotsOrdered[i] })),
  ];

  const manifest = [];
  let ok = 0, missing = 0;
  for (const { olyTeam, slot } of assignments) {
    const jersey = idToJersey.get(slot.IDteam);
    const src = path.join(TEAM_LOGOS_DIR, `${olyTeam.teamId}.jpg`);
    try {
      await sharp(src).resize(256, 256, { fit: 'cover' }).png().toFile(path.join(logoDir, `${jersey}.png`));
      await sharp(src).resize(64, 64, { fit: 'cover' }).png().toFile(path.join(minilogoDir, `${jersey}_minilogo.png`));
      ok++;
      manifest.push({ olyTeam: olyTeam.name, jerseyAbbreviation: jersey, logo: `logo/${jersey}.png`, minilogo: `minilogo/${jersey}_minilogo.png` });
    } catch (e) {
      missing++;
      console.warn(`WARNUNG: ${olyTeam.name} (${src}): ${e.message}`);
    }
  }

  writeFileSync(path.join(args.outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`${ok} Team-Logos exportiert (je 1x logo/256x256 + 1x minilogo/64x64), ${missing} fehlgeschlagen.`);
  console.log(`Ausgabe: ${logoDir}/ und ${minilogoDir}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
