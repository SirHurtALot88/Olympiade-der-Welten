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
 * Kader: wer im Save auf einem Oly-Team-Roster steht, wird genau dorthin uebernommen
 * (tid = das jeweilige BGM-Team) -- alle anderen (der weitaus groessere Teil der 2984)
 * bleiben Free Agent (tid: -1). Erster Anlauf hatte ALLE als Free Agent exportiert
 * (analog zum FM-Export), aber eine KI, die 31 Kader aus dem Nichts zusammenkaufen
 * muss, tut das schlecht -- nachgemessen Team-Ratings von +97 bis -130, praktisch nur
 * das handgepickte eigene Team konkurrenzfaehig. Die echten Oly-Kader als Startpunkt
 * geben von Anfang an 32 einigermassen ausgeglichene Teams.
 *
 * Usage: OLY_APP_SQLITE_PATH=<db> npx tsx scripts/export-players-for-basketball-gm.ts \
 *   --save-id <id> --out <pfad.json> [--limit N] [--starting-season 2026]
 */
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import { resolvePlayerPotentialScoreFromGameState } from "@/lib/scouting/player-attribute-ceiling-service";
import { getPlayerPortraitBrowserUrl, getTeamLogoBrowserUrl } from "@/lib/data/mediaAssets";
import { getTeamColor } from "@/lib/foundation/team-colors";
import { berechneStaturModifikator, ermittleSpielerHoehe } from "@/lib/player-generator/provisional-height";
import { writeFileSync } from "fs";

const BASE_URL = "https://olympiade.duckdns.org";

function arg(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] ?? null : null;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

// Oly-Skala (1-99) -> Basketball-GM-Skala (0-100, Mittelwert ~50).
// Jede Wertung ist ein gewichteter Mix aus mehreren Attributen -- Mitteln drueckt
// Extremwerte automatisch Richtung Mittelwert (nachgemessen: `diq`, 5 Attribute
// gemischt, kam vorher nur auf 12-85 statt 0-100). STAR_STRETCH zieht das nach dem
// Mitteln wieder auseinander, damit ein Charakter, der in EINEM Attribut wirklich
// herausragt, auch als Star ankommt statt vom Durchschnitt der anderen verwaschen
// zu werden. Einzelner Wert zum Nachjustieren, falls die Ovr-Spitze im Spiel immer
// noch zu flach/zu voll wirkt.
const STAR_STRETCH = 1.45;
function scale100(v: number): number {
  const raw = clamp((v / 99) * 100, 0, 100);
  const stretched = 50 + (raw - 50) * STAR_STRETCH;
  return Math.round(clamp(stretched, 0, 100));
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

// Oly hat eine ECHTE Groesse (1-10, lib/player-generator/provisional-height.ts) --
// Rasse+Subklasse+Statur-Heuristik, dieselbe Skala, die schon anderswo im Spiel
// fuer Tall/Giant/Colossus/Titan-Einstufungen benutzt wird. Chris' Kalibrierung
// (06.09.): Groesse 5 = durchschnittlicher Basketballer, Groesse 10 = 2,30 m.
// Linear durch beide Punkte, dann in Basketball GMs Rating-Skala umgerechnet
// (hgt-Rating = (Zoll-66)*3.70, so dokumentiert Basketball GM selbst).
const HOEHE_CM_BEI_5 = 198; // ca. NBA-Durchschnitt
const HOEHE_CM_BEI_10 = 230;
const HOEHE_CM_PRO_STUFE = (HOEHE_CM_BEI_10 - HOEHE_CM_BEI_5) / 5;

function groesseZuBbgmHoehe(groesse1bis10: number): { ratingHgt: number; zollGerundet: number } {
  const cm = HOEHE_CM_BEI_5 + (groesse1bis10 - 5) * HOEHE_CM_PRO_STUFE;
  const zoll = cm / 2.54;
  const ratingHgt = clamp(Math.round((zoll - 66) * 3.7), 0, 100);
  return { ratingHgt, zollGerundet: Math.round(clamp(zoll, 60, 96)) };
}

type RawAttrs = {
  power: number; health: number; stamina: number; intelligence: number; awareness: number;
  determination: number; speed: number; dexterity: number; charisma: number; will: number;
  spirit: number; torment: number;
};

// Kern der Uebersetzung: jede der 15 BGM-Ratings ist eine dokumentierte, gewichtete
// Mischung aus den 12 rohen Oly-Attributen -- keine Disziplin-Formel, rein generisch.
//
// Bewusst so verteilt, dass JEDES der 12 Attribute in mehreren Wertungen mitzaehlt
// (nicht nur power/dexterity ueberall) -- insbesondere `spirit` (Teamgeist) sitzt in
// praktisch jeder teamorientierten Wertung (ins, tp, oiq, diq, drb, pss, reb), damit
// ein hoher Teamgeist spuerbar in fast jede Aktion einzahlt statt nur beim Dribbling,
// und niemand allein durch Ego-Werte (power/dexterity) zum Ball-Hog wird.
function toBbgmRatings(raw: RawAttrs, ratingHgt: number) {
  return {
    hgt: ratingHgt,
    stre: scale100(blend([raw.power, 0.75], [raw.health, 0.15], [raw.determination, 0.10])),
    spd: scale100(blend([raw.speed, 0.75], [raw.dexterity, 0.15], [raw.stamina, 0.10])),
    jmp: scale100(blend([raw.power, 0.4], [raw.speed, 0.4], [raw.determination, 0.2])),
    endu: scale100(blend([raw.stamina, 0.5], [raw.health, 0.2], [raw.will, 0.15], [raw.torment, 0.15])),
    ins: scale100(blend([raw.power, 0.4], [raw.dexterity, 0.35], [raw.determination, 0.15], [raw.spirit, 0.10])),
    dnk: scale100(blend([raw.power, 0.5], [raw.speed, 0.3], [raw.determination, 0.2])),
    ft: scale100(blend([raw.dexterity, 0.5], [raw.determination, 0.3], [raw.awareness, 0.2])),
    fg: scale100(blend([raw.dexterity, 0.55], [raw.awareness, 0.25], [raw.intelligence, 0.2])),
    tp: scale100(blend([raw.dexterity, 0.5], [raw.intelligence, 0.2], [raw.will, 0.15], [raw.spirit, 0.15])),
    oiq: scale100(blend([raw.intelligence, 0.45], [raw.awareness, 0.30], [raw.spirit, 0.15], [raw.charisma, 0.10])),
    diq: scale100(blend([raw.awareness, 0.35], [raw.determination, 0.20], [raw.will, 0.15], [raw.torment, 0.15], [raw.spirit, 0.15])),
    drb: scale100(blend([raw.dexterity, 0.5], [raw.spirit, 0.25], [raw.charisma, 0.15], [raw.torment, 0.10])),
    pss: scale100(blend([raw.charisma, 0.35], [raw.intelligence, 0.20], [raw.dexterity, 0.20], [raw.spirit, 0.25])),
    reb: scale100(blend([raw.power, 0.45], [raw.determination, 0.25], [raw.will, 0.15], [raw.spirit, 0.15])),
  };
}

function main() {
  const saveId = arg("--save-id");
  const out = arg("--out") ?? "basketball-gm-league.json";
  const limitArg = arg("--limit");
  const limit = limitArg ? Number(limitArg) : null;
  const startingSeason = Number(arg("--starting-season") ?? "2026");
  // Chris will beides vergleichen: --free-agents-only erzwingt tid -1 fuer alle (wie
  // der allererste Anlauf), Standard uebernimmt die echten Oly-Kader (s. Docstring).
  const freeAgentsOnly = process.argv.includes("--free-agents-only");
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

  // Statur-Modifikator fuer die echte Groessen-Ableitung braucht Rassen-Mittel/-Streuung
  // von (power+health)/2 -- ueber ALLE Spieler des Saves berechnet (nicht nur --limit),
  // damit der Modifikator bei einem Testlauf mit --limit nicht verzerrt wird.
  const staturByRace = new Map<string, number[]>();
  for (const p of gs.players) {
    const a = p.attributeSheetStats ?? {};
    const statur = ((a.power ?? 50) + (a.health ?? 50)) / 2;
    const list = staturByRace.get(p.race) ?? [];
    list.push(statur);
    staturByRace.set(p.race, list);
  }
  const raceStatById = new Map<string, { mean: number; stdev: number }>();
  for (const [race, list] of staturByRace.entries()) {
    const mean = list.reduce((a, b) => a + b, 0) / list.length;
    const variance = list.reduce((a, b) => a + (b - mean) ** 2, 0) / list.length;
    raceStatById.set(race, { mean, stdev: Math.sqrt(variance) });
  }

  const bbgmPlayers = players.map((p) => {
    const a = p.attributeSheetStats ?? {};
    const raw: RawAttrs = {
      power: a.power ?? 50, health: a.health ?? 50, stamina: a.stamina ?? 50,
      intelligence: a.intelligence ?? 50, awareness: a.awareness ?? 50,
      determination: a.determination ?? 50, speed: a.speed ?? 50, dexterity: a.dexterity ?? 50,
      charisma: a.charisma ?? 50, will: a.will ?? 50, spirit: a.spirit ?? 50, torment: a.torment ?? 50,
    };

    const statur = (raw.power + raw.health) / 2;
    const raceStat = raceStatById.get(p.race) ?? { mean: statur, stdev: 0 };
    const staturModifikator = berechneStaturModifikator(statur, raceStat.mean, raceStat.stdev);
    const groesse = ermittleSpielerHoehe(a.height ?? null, p.race, p.subclasses ?? [], staturModifikator);
    const { ratingHgt, zollGerundet } = groesseZuBbgmHoehe(groesse);

    const ratings = toBbgmRatings(raw, ratingHgt);

    const ratingScore = p.rating ?? 50;
    const potentialScore = resolvePlayerPotentialScoreFromGameState({ gameState: gs, playerId: p.id }) ?? ratingScore;
    const gap = clamp(potentialScore - ratingScore, 0, 30);
    // Juenger als beim FM-Export (dort Deckel 30): Chris will hier mehr Spielzeit pro
    // Charakter herausholen, bevor Alterung/Ruhestand im Karriere-Modus greifen.
    const baseAge = 26 - (gap / 30) * 9;
    const frac = seededFraction(p.id);
    const jitter = (frac - 0.5) * 4;
    const age = Math.round(clamp(baseAge + jitter, 17, 26));
    const bornYear = startingSeason - age;

    const weight = Math.round(150 + (raw.power / 99) * 130);
    const heightInches = zollGerundet;

    const amount = Math.round(clamp((ratingScore / 99) * 24500 + 500, 500, 25000));

    const portraitRel = getPlayerPortraitBrowserUrl(p.id, p.portraitUrl ?? null, p.portraitPath ?? null);

    // Echte Oly-Kader als Startaufstellung uebernehmen statt alle als Free Agent zu
    // dumpen: eine KI, die 31 Kader aus 2984 Free Agents zusammenkaufen muss, tut das
    // schlecht (nachgemessen: Team-Ratings von +97 bis -130, praktisch nur das
    // handgepickte eigene Team konkurrenzfaehig). Wer im aktuellen Save auf keinem
    // Roster steht, bleibt regulaerer Free Agent (tid -1) -- das ist der groessere Teil
    // des Bestands und bleibt fuer Transfers/Scouting verfuegbar.
    const roster = freeAgentsOnly ? null : rosterByPlayerId.get(p.id);
    const tid = roster ? tidByTeamId.get(roster.teamId) ?? -1 : -1;

    return {
      firstName: "",
      lastName: p.name,
      tid,
      born: { year: bornYear, loc: "" },
      weight,
      hgt: heightInches,
      // Darf nie in der Zukunft liegen -- das sind schon aktive Spieler, kein Nachwuchs-Draft.
      draft: { year: Math.min(startingSeason, bornYear + 19), round: 0, pick: 0, tid: -1 },
      contract: { amount, exp: startingSeason + 2 },
      imgURL: portraitRel ? `${BASE_URL}${portraitRel}` : undefined,
      // `pos` bewusst NICHT gesetzt: Basketball GM berechnet die Position (inkl.
      // Kombi-Positionen wie "G"/"F"/"GF"/"FC") selbst aus den 15 Ratings, per eigenem
      // an echten NBA-Daten trainiertem Modell (siehe zengm.com/blog/2021/03/
      // new-position-formula) -- das ist naeher an "wie im Base-Game" als jede eigene
      // Heuristik hier, und bringt Mehrfachpositionen gratis mit.
      ratings: [
        {
          season: startingSeason,
          fuzz: 0,
          skills: [],
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
