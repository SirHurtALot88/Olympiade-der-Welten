/**
 * Exportiert einen Save direkt als Basketball-GM-Liga-Datei (League File JSON,
 * https://play.basketball-gm.com/ -> "New League" -> "Upload League File").
 *
 * Uebersetzt bewusst NUR die 12 rohen Oly-Attribute (1-99: power, health, stamina,
 * intelligence, awareness, determination, speed, dexterity, charisma, will, spirit,
 * torment) in Basketball GMs 15 Rating-Felder (0-100). Es wird KEINE Disziplin-eigene
 * Eignung (z.B. player.disciplineRatings.basketball) verwendet -- explizite Vorgabe:
 * jeder Charakter soll ueber seine generischen Rohwerte eine faire, nachvollziehbare
 * Uebersetzung bekommen, unabhaengig davon, in welcher Oly-Disziplin er stark ist.
 *
 * ovr/pot werden NICHT gesetzt -- Basketball GM berechnet beides beim Import selbst
 * aus den 15 Ratings (siehe basketball-gm.com/manual/customization/players/).
 *
 * Bilder: Oly hat fuer praktisch jeden Charakter ein Portraet (public/portraits/)
 * und fuer alle 32 Teams ein Logo (public/team-logos/), beides bereits live unter
 * https://olympiade.duckdns.org ausgeliefert. imgURL zeigt direkt dorthin -- Chris'
 * Browser laedt die Bilder beim Aufruf von play.basketball-gm.com direkt vom
 * Olympiade-Server, kein separates Hosting noetig.
 *
 * Alle Spieler laufen als Free Agent (tid: -1), analog zum FM-Export: Chris will
 * ingame draften/signen koennen statt fertige Kader zu bekommen.
 *
 * Usage: OLY_APP_SQLITE_PATH=<db> npx tsx scripts/export-players-for-basketball-gm.ts \
 *   --save-id <id> --out <pfad.json> [--limit N] [--starting-season 2026]
 */
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { resolvePlayerPotentialScoreFromGameState } from "@/lib/scouting/player-attribute-ceiling-service";
import { getPlayerPortraitBrowserUrl, getTeamLogoBrowserUrl } from "@/lib/data/mediaAssets";
import { getTeamColor } from "@/lib/foundation/team-colors";
import { writeFileSync } from "fs";

const BASE_URL = "https://olympiade.duckdns.org";

function arg(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

// Oly-Skala (1-99) -> Basketball-GM-Skala (0-100, Mittelwert ~50)
function scale100(v: number): number {
  return Math.round(clamp((v / 99) * 100, 0, 100));
}

function blend(...weighted: Array<[number, number]>): number {
  let sum = 0;
  let wsum = 0;
  for (const [v, w] of weighted) {
    sum += v * w;
    wsum += w;
  }
  return wsum > 0 ? sum / wsum : 50;
}

function seededFraction(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 10000) / 10000;
}

// "hsl(H S% L%)" -> "#rrggbb"
function hslToHex(hsl: string): string {
  const m = hsl.match(/hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)/);
  if (!m) return "#888888";
  const h = Number(m[1]) / 360;
  const s = Number(m[2]) / 100;
  const l = Number(m[3]) / 100;
  if (s === 0) {
    const v = Math.round(l * 255);
    return `#${[v, v, v].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t0: number) => {
    let t = t0;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const r = Math.round(hue2rgb(h + 1 / 3) * 255);
  const g = Math.round(hue2rgb(h) * 255);
  const b = Math.round(hue2rgb(h - 1 / 3) * 255);
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

function hexLuminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

const TALL_RACE_HINTS = ["golem", "riese", "troll", "oger", "ogre", "gigant", "titan"];
const SHORT_RACE_HINTS = ["zwerg", "goblin", "kobold", "gnom", "halbling", "hobbit"];

function raceHeightBonus(race: string | null | undefined): number {
  const r = (race ?? "").toLowerCase();
  if (TALL_RACE_HINTS.some((k) => r.includes(k))) return 18;
  if (SHORT_RACE_HINTS.some((k) => r.includes(k))) return -18;
  return 0;
}

type RawAttrs = {
  power: number; health: number; stamina: number; intelligence: number; awareness: number;
  determination: number; speed: number; dexterity: number; charisma: number; will: number;
  spirit: number; torment: number;
};

// Kern der Uebersetzung: jede der 15 BGM-Ratings ist eine dokumentierte, gewichtete
// Mischung aus den 12 rohen Oly-Attributen -- keine Disziplin-Formel, rein generisch.
function toBbgmRatings(raw: RawAttrs, race: string | null | undefined) {
  const hgt = clamp(
    scale100(blend([raw.power, 0.7], [raw.health, 0.3])) + raceHeightBonus(race),
    0, 100,
  );
  return {
    hgt,
    stre: scale100(raw.power),
    spd: scale100(raw.speed),
    jmp: scale100(blend([raw.power, 0.5], [raw.speed, 0.5])),
    endu: scale100(blend([raw.stamina, 0.7], [raw.health, 0.3])),
    ins: scale100(blend([raw.power, 0.5], [raw.dexterity, 0.5])),
    dnk: scale100(blend([raw.power, 0.6], [raw.speed, 0.4])),
    ft: scale100(blend([raw.dexterity, 0.6], [raw.determination, 0.4])),
    fg: scale100(blend([raw.dexterity, 0.7], [raw.awareness, 0.3])),
    tp: scale100(blend([raw.dexterity, 0.6], [raw.intelligence, 0.2], [raw.will, 0.2])),
    oiq: scale100(blend([raw.intelligence, 0.6], [raw.awareness, 0.4])),
    diq: scale100(blend([raw.awareness, 0.4], [raw.determination, 0.25], [raw.will, 0.15], [raw.torment, 0.2])),
    drb: scale100(blend([raw.dexterity, 0.6], [raw.spirit, 0.4])),
    pss: scale100(blend([raw.charisma, 0.4], [raw.intelligence, 0.3], [raw.dexterity, 0.3])),
    reb: scale100(blend([raw.power, 0.5], [raw.determination, 0.3], [raw.will, 0.2])),
  };
}

function assignPos(raw: RawAttrs): string {
  const size = raw.power;
  const skill = blend([raw.speed, 1], [raw.dexterity, 1]);
  if (size >= 75 && skill < 55) return "C";
  if (size >= 60) return "PF";
  if (skill >= 75) return "PG";
  if (skill >= 60) return "SG";
  return "SF";
}

function main() {
  const saveId = arg("--save-id");
  const out = arg("--out") ?? "basketball-gm-league.json";
  const limitArg = arg("--limit");
  const limit = limitArg ? Number(limitArg) : null;
  const startingSeason = Number(arg("--starting-season") ?? "2026");
  if (!saveId) throw new Error("--save-id required");

  const persistence = createPersistenceService();
  const save = persistence.getSaveById(saveId);
  if (!save) throw new Error(`Save not found: ${saveId}`);
  const gs = save.gameState;

  const rosterByPlayerId = new Map(gs.rosters.map((r) => [r.playerId, r] as const));
  const ratingSumByTeam = new Map<string, { sum: number; n: number }>();
  for (const p of gs.players) {
    const roster = rosterByPlayerId.get(p.id);
    if (!roster) continue;
    const acc = ratingSumByTeam.get(roster.teamId) ?? { sum: 0, n: 0 };
    acc.sum += p.rating ?? 50;
    acc.n += 1;
    ratingSumByTeam.set(roster.teamId, acc);
  }

  const teamsSorted = [...gs.teams].sort((a, b) => {
    const ra = ratingSumByTeam.get(a.teamId);
    const rb = ratingSumByTeam.get(b.teamId);
    const avgA = ra && ra.n > 0 ? ra.sum / ra.n : 0;
    const avgB = rb && rb.n > 0 ? rb.sum / rb.n : 0;
    return avgB - avgA;
  });

  const tidByTeamId = new Map<string, number>();
  teamsSorted.forEach((t, i) => tidByTeamId.set(t.teamId, i));

  const bbgmTeams = teamsSorted.map((t, i) => {
    const acc = ratingSumByTeam.get(t.teamId);
    const avgRating = acc && acc.n > 0 ? acc.sum / acc.n : 40;
    const cid = i < 16 ? 0 : 1;
    const localIdx = i < 16 ? i : i - 16;
    const did = cid * 2 + (localIdx < 8 ? 0 : 1);
    const color = getTeamColor(t.teamId);
    const primaryHex = hslToHex(color.primary);
    const secondaryHex = color.secondary ? hslToHex(color.secondary) : "#222222";
    const accentHex = hexLuminance(primaryHex) > 0.55 ? "#000000" : "#ffffff";
    const logoRel = getTeamLogoBrowserUrl(t.teamId, t.logoPath ?? null);

    return {
      tid: i,
      cid,
      did,
      region: "",
      name: t.name,
      abbrev: t.shortCode.replace(/-/g, "").toUpperCase().slice(0, 3),
      pop: Math.round(clamp(avgRating / 8, 0.5, 8) * 10) / 10,
      imgURL: logoRel ? `${BASE_URL}${logoRel}` : undefined,
      colors: [primaryHex, secondaryHex, accentHex],
    };
  });

  let players = gs.players;
  if (limit) players = players.slice(0, limit);

  const bbgmPlayers = players.map((p) => {
    const a = p.attributeSheetStats ?? {};
    const raw: RawAttrs = {
      power: a.power ?? 50, health: a.health ?? 50, stamina: a.stamina ?? 50,
      intelligence: a.intelligence ?? 50, awareness: a.awareness ?? 50,
      determination: a.determination ?? 50, speed: a.speed ?? 50, dexterity: a.dexterity ?? 50,
      charisma: a.charisma ?? 50, will: a.will ?? 50, spirit: a.spirit ?? 50, torment: a.torment ?? 50,
    };
    const ratings = toBbgmRatings(raw, p.race);
    const pos = assignPos(raw);

    const ratingScore = p.rating ?? 50;
    const potentialScore = resolvePlayerPotentialScoreFromGameState({ gameState: gs, playerId: p.id }) ?? ratingScore;
    const gap = clamp(potentialScore - ratingScore, 0, 30);
    const baseAge = 30 - (gap / 30) * 13;
    const frac = seededFraction(p.id);
    const jitter = (frac - 0.5) * 4;
    const age = Math.round(clamp(baseAge + jitter, 17, 30));
    const bornYear = startingSeason - age;

    const weight = Math.round(150 + (raw.power / 99) * 130);
    const heightInches = Math.round(clamp(ratings.hgt / 3.7 + 66, 60, 90));

    const amount = Math.round(clamp((ratingScore / 99) * 24500 + 500, 500, 25000));

    const portraitRel = getPlayerPortraitBrowserUrl(p.id, p.portraitUrl ?? null, p.portraitPath ?? null);

    return {
      firstName: "",
      lastName: p.name,
      tid: -1,
      born: { year: bornYear, loc: "" },
      weight,
      hgt: heightInches,
      // Darf nie in der Zukunft liegen -- das sind schon aktive Spieler, kein Nachwuchs-Draft.
      draft: { year: Math.min(startingSeason, bornYear + 19), round: 0, pick: 0, tid: -1 },
      contract: { amount, exp: startingSeason + 2 },
      imgURL: portraitRel ? `${BASE_URL}${portraitRel}` : undefined,
      ratings: [
        {
          season: startingSeason,
          fuzz: 0,
          skills: [],
          pos,
          ...ratings,
        },
      ],
    };
  });

  const league = {
    startingSeason,
    teams: bbgmTeams,
    players: bbgmPlayers,
  };

  writeFileSync(out, JSON.stringify(league, null, 1), "utf-8");
  console.log(`Geschrieben: ${out} (${bbgmTeams.length} Teams, ${bbgmPlayers.length} Spieler)`);
}

main();
