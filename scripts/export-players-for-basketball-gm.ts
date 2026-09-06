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
 * bleiben standardmaessig Free Agent (tid: -1). Erster Anlauf hatte ALLE als Free Agent
 * exportiert (analog zum FM-Export), aber eine KI, die 31 Kader aus dem Nichts
 * zusammenkaufen muss, tut das schlecht -- nachgemessen Team-Ratings von +97 bis -130,
 * praktisch nur das handgepickte eigene Team konkurrenzfaehig. Die echten Oly-Kader als
 * Startpunkt geben von Anfang an 32 einigermassen ausgeglichene Teams.
 *
 * Varianten zum A/B/C-Test (Chris' Wunsch 06.09.):
 *   (Standard)          echte Kader + Rest Free Agent (s. oben).
 *   --free-agents-only  ALLE Free Agent, kein Team hat einen Kader.
 *   --draft-classes N [--picks-per-year P] [--empty-rosters] [--initial-free-agents M]
 *                        [--first-year-picks F]
 *                        Standardmaessig bleiben echte Kader bestehen und nur die nicht
 *                        gerosterten Spieler werden zu Draft-Prospects. ALLE davon
 *                        (Chris 06.09., 3. Ruecksprache: "wir haben ja 3k Spieler",
 *                        nicht nur eine Auswahl von 1600) bekommen tid -2 (BGMs
 *                        "undrafted"-Konvention), verteilt auf wiederkehrende Zyklen
 *                        von je ceil(Poolgroesse/P) Jahren (Default P=70 -- NICHT 64:
 *                        Basketball GM fuellt jeden Jahrgang unter 70 Spielern mit
 *                        ZUFAELLIG GENERIERTEN Nicht-Oly-Fuellspielern auf, 70 ist die
 *                        kleinste Groesse ohne das). Jahr 1 (Startsaison) ist ein
 *                        einmaliger Expansion-Draft der Groesse firstYearPicks (Default
 *                        = P, oder bei --empty-rosters automatisch 384 = 32 Teams * 12,
 *                        "muessten genug sein um die Teams zuverlaessig zu fuellen").
 *                        Danach rotiert der Rest weiter: Zyklus 1 verteilt die restliche
 *                        Gruppe zufaellig auf so viele Jahre wie noetig; jeder weitere
 *                        Zyklus ist eine KOMPLETT NEUE, unabhaengige Zufallsverteilung
 *                        derselben Gruppe (nicht dieselbe Jahrgangs-Zuordnung wie zuvor),
 *                        bis die mit N gewuenschte Gesamtjahreszahl erreicht ist -- "150
 *                        Jahre durchrotieren mit immer neueren Junior-Versionen". Reicht
 *                        N nicht fuer einen vollen Zyklus, bekommen die dann nicht
 *                        verplanten Spieler einen sofortigen Free-Agent-Eintrag statt
 *                        spurlos zu verschwinden.
 *                        --empty-rosters: Chris 06.09. (4. Ruecksprache) -- "die Roster
 *                        muessten leer sein, die Teams sollen dann draften". Schaltet
 *                        die Kader-Uebernahme komplett ab, auch die bisher gerosterten
 *                        328 gehen ins Draft-/Free-Agent-System. Kein Team startet mit
 *                        einem vorgefertigten Kader. Braucht --draft-classes.
 *                        --initial-free-agents M (Default 100 bei --draft-classes, 0
 *                        sonst): reserviert M Spieler quer durch alle Staerke-Brackets
 *                        (stark bis schwach) als sofortige Free Agents VOR dem Draft-
 *                        Zyklus -- Chris: "ein paar Spieler sollten schon am Anfang als
 *                        Free Agents verfuegbar sein, stark bis schwach, so 100".
 *                        Oberes Staerke-Drittel des Drafts (Charakter-Eigenschaft, gilt
 *                        in jedem Zyklus gleich) bekommt "mittleres bis starkes CA, aber
 *                        hohes PO": gedaempfte Anfangs-Ratings (~55% des vollen
 *                        Niveaus) + explizit hohes `pot` (75-99) -- Basketball GMs
 *                        Alterungs-Engine zieht die echten Ratings ueber die Karriere
 *                        Richtung `pot` hoch. Alle anderen behalten ihr volles Niveau
 *                        und ein normales, von Basketball GM selbst berechnetes `pot`.
 *                        Alter/Geburtsjahr/Ratings-Saison eines Prospect-Auftritts
 *                        beziehen sich auf DESSEN Draft-Jahr (19-23 zum eigenen Draft),
 *                        nicht auf die Export-Startsaison; kein Contract (noch nicht
 *                        unterschrieben). Reine Terminplanung: ob ein Charakter zum
 *                        Zeitpunkt seines naechsten Zyklus im Spiel tatsaechlich schon
 *                        im Ruhestand ist, haengt vom echten Alterungsverlauf im
 *                        jeweiligen Save ab, nicht von diesem Skript. UNGEKLAERT (nicht
 *                        in der offiziellen Doku gefunden): ob ein brandneues
 *                        --empty-rosters-League-File direkt in den Draft startet oder
 *                        ob Basketball GM technisch erst eine (dann kaderlose) Saison
 *                        erwartet -- das muss Chris einmal ausprobieren.
 *
 * Usage: OLY_APP_SQLITE_PATH=<db> npx tsx scripts/export-players-for-basketball-gm.ts \
 *   --save-id <id> --out <pfad.json> [--limit N] [--starting-season 2026]
 *   [--free-agents-only | --draft-classes N [--picks-per-year P] [--empty-rosters]
 *     [--initial-free-agents M] [--first-year-picks F]]
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
  const draftClassesArg = arg("--draft-classes");
  const totalDraftYears = draftClassesArg ? Number(draftClassesArg) : null;
  // Default 70 statt 64: Basketball GM fuellt jeden Jahrgang unter 70 Spielern mit
  // ZUFAELLIG GENERIERTEN (Nicht-Oly!) Fuellspielern auf ("Custom Draft Classes"-Doku).
  // 70 ist die kleinste Groesse, bei der garantiert NUR unsere eigenen Charaktere drin
  // sind.
  const picksPerYear = Number(arg("--picks-per-year") ?? "70");
  // Chris (06.09., 4. Ruecksprache): "die roster muessten leer sein, die teams sollen
  // dann draften" -- alle Spieler (auch die bisher auf echten Oly-Kadern) werden Teil
  // des Draft-/Free-Agent-Systems, kein Team startet mit einem vorgefertigten Kader.
  const emptyRosters = process.argv.includes("--empty-rosters");
  // "ein paar Spieler sollten schon am Anfang als Free Agents verfuegbar sein, stark
  // bis schwach, so 100" -- Reserve aus dem Pool, VOR dem Draft-Zyklus, nicht Teil davon.
  const initialFreeAgents = Number(arg("--initial-free-agents") ?? (totalDraftYears ? "100" : "0"));
  // "muessten genug sein um die Teams zuverlaessig zu fuellen mit dem Draft" -- die
  // erste Jahrgangs-Ladung (Jahr 1 von Zyklus 1) ist bei leeren Kadern viel groesser als
  // die normalen Folgejahrgaenge, quasi ein Expansion-Draft: genug fuer ~12 Spieler pro
  // Team (32*12=384), damit alle 32 Teams sofort einen spielbaren Kader haben statt erst
  // nach Jahren picksPerYear/32-weise aufzufuellen.
  const firstYearPicks = Number(arg("--first-year-picks") ?? (emptyRosters ? "384" : String(picksPerYear)));
  if (!saveId) throw new Error("--save-id required");
  if (freeAgentsOnly && totalDraftYears) {
    throw new Error("--free-agents-only und --draft-classes schliessen sich aus -- getrennte Laeufe/Dateien.");
  }
  if (emptyRosters && !totalDraftYears) {
    throw new Error("--empty-rosters braucht --draft-classes -- ohne Draft-System nimm stattdessen --free-agents-only.");
  }

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

  // --draft-classes N: statt alle Nicht-Roster-Spieler sofort als Free Agent zu
  // exportieren, werden bis zu picksPerYear*N von ihnen zu Draft-Prospects (tid -2).
  // Chris' korrigierte Vorgabe (06.09., 2. Ruecksprache): "1600 aus ALLEN Brackets
  // nehmen, gute sowie schlechte" -- also NICHT nur die Spitze abschneiden, sondern
  // systematisch ueber die GESAMTE nach Oly-Rating sortierte Liste sampeln (jeder
  // ~n-te Spieler), damit die Auswahl den vollen Staerke-Bereich abbildet. Die
  // Jahrgangs-Zuteilung wird danach separat GEMISCHT (per Spieler-ID-Hash), nicht
  // nach Staerke sortiert -- jeder Jahrgang ist also wieder ein normaler Mix aus
  // schwach/mittel/stark statt "Jahr 1 nur Fuellspieler, Jahr 25 nur Stars".
  // Das obere Staerke-Drittel (unabhaengig vom Jahrgang/Zyklus) bekommt stattdessen die
  // "High-Potential-Rookie"-Behandlung, s. HIGH_POTENTIAL_PERCENTILE unten: gedaempftes
  // Anfangs-Rating, aber explizit hohes `pot`.
  //
  // Chris' Korrektur (06.09., 3. Ruecksprache): nicht 1600 EINMAL verteilen, sondern
  // ALLE Nicht-Roster-Spieler ("wir haben ja 3k Spieler") in Zyklen durchrotieren --
  // Zyklus 1 verteilt die komplette Gruppe zufaellig auf so viele Jahre, wie bei
  // picksPerYear pro Jahr eben noetig sind (Zykluslaenge = ceil(Poolgroesse /
  // picksPerYear)); danach beginnt Zyklus 2 mit einer KOMPLETT NEUEN, unabhaengigen
  // Zufallsverteilung derselben Gruppe (nicht dieselbe Jahrgangs-Zuordnung), usw., bis
  // die von --draft-classes gewuenschte Gesamtjahreszahl (z.B. 150) erreicht ist -- "so
  // dass ich 150 Jahre durchrotieren kann mit immer neueren Junior-Versionen". Alter/
  // Geburtsjahr wird pro Auftritt neu relativ zu DESSEN Draft-Jahr berechnet, ein
  // Charakter taucht also in jedem Zyklus als frischer 19-23-jaehriger Rookie auf.
  const prospectDraftYearsByPlayerId = new Map<string, number[]>();
  const prospectPercentileByPlayerId = new Map<string, number>();
  const initialFreeAgentIds = new Set<string>();
  let draftCycleLengthYears = 0;
  if (totalDraftYears) {
    // emptyRosters: ALLE Spieler gehen ins Draft-/Free-Agent-System, auch die sonst auf
    // einem echten Oly-Kader stehenden -- kein Team startet mit einem vorgefertigten
    // Kader. Sonst wie gehabt: nur die Nicht-Roster-Spieler.
    const pool = players.filter((p) => emptyRosters || !(freeAgentsOnly ? null : rosterByPlayerId.get(p.id)));
    const sortedAscending = [...pool].sort((a, b) => (a.rating ?? 50) - (b.rating ?? 50));
    sortedAscending.forEach((p, i) =>
      prospectPercentileByPlayerId.set(p.id, sortedAscending.length > 1 ? i / (sortedAscending.length - 1) : 0));

    // Reserve ~initialFreeAgents Spieler QUER durch alle Staerke-Brackets (systematisch
    // gesampelt wie die Draft-Auswahl vorher) als sofortige Free Agents -- Chris: "ein
    // paar Spieler sollten schon am Anfang als Free Agents verfuegbar sein, stark bis
    // schwach". Diese nehmen NICHT am Draft-Zyklus teil.
    const reserveCount = Math.min(initialFreeAgents, sortedAscending.length);
    if (reserveCount > 0) {
      const step = sortedAscending.length / reserveCount;
      for (let i = 0; i < reserveCount; i++) {
        initialFreeAgentIds.add(sortedAscending[Math.min(sortedAscending.length - 1, Math.floor(i * step))].id);
      }
    }
    const draftPool = pool.filter((p) => !initialFreeAgentIds.has(p.id));

    // Jahr 1 (Startsaison) ist ein EINMALIGER Expansion-Draft (firstYearPicks,
    // eigener Zufalls-Shuffle, nicht Teil der wiederkehrenden Zyklen) -- bei leeren
    // Kadern deutlich groesser als picksPerYear, damit alle 32 Teams sofort einen
    // spielbaren Kader haben ("muessten genug sein um die Teams zuverlaessig zu
    // fuellen"). Der Rest der Gruppe rotiert danach normal weiter, ab Jahr 2.
    const expansionShuffled = [...draftPool].sort(
      (a, b) => seededFraction(`${a.id}|expansion`) - seededFraction(`${b.id}|expansion`),
    );
    const expansionCount = Math.min(firstYearPicks, expansionShuffled.length);
    const expansionIds = new Set(expansionShuffled.slice(0, expansionCount).map((p) => p.id));
    for (const p of expansionShuffled.slice(0, expansionCount)) {
      prospectDraftYearsByPlayerId.set(p.id, [startingSeason]);
    }

    const remainingPool = draftPool.filter((p) => !expansionIds.has(p.id));
    draftCycleLengthYears = Math.max(1, Math.ceil(remainingPool.length / picksPerYear));
    const remainingYears = Math.max(0, totalDraftYears - 1);
    const numCycles = Math.ceil(remainingYears / draftCycleLengthYears);

    for (let cycle = 0; cycle < numCycles; cycle++) {
      const shuffled = [...remainingPool].sort(
        (a, b) => seededFraction(`${a.id}|shuffleyear|${cycle}`) - seededFraction(`${b.id}|shuffleyear|${cycle}`),
      );
      shuffled.forEach((p, i) => {
        const absoluteYearIndex = 1 + cycle * draftCycleLengthYears + Math.floor(i / picksPerYear);
        if (absoluteYearIndex >= totalDraftYears) return; // ueber den gewuenschten Zeitraum hinaus abschneiden
        const list = prospectDraftYearsByPlayerId.get(p.id) ?? [];
        list.push(startingSeason + absoluteYearIndex);
        prospectDraftYearsByPlayerId.set(p.id, list);
      });
    }
    // Randfall (nur bei sehr kurzem --draft-classes < 1+Zykluslaenge moeglich): Spieler,
    // die in keinem Zyklus einen Platz innerhalb des gewuenschten Zeitraums bekommen
    // haben, sollen trotzdem nicht spurlos verschwinden -- ein sofortiger Free Agent
    // statt eines nie auftauchenden Charakters.
    for (const p of draftPool) {
      if (!prospectDraftYearsByPlayerId.has(p.id)) prospectDraftYearsByPlayerId.set(p.id, []);
    }
  }
  const HIGH_POTENTIAL_PERCENTILE = 0.7; // oberes Drittel der Auswahl
  const HIGH_POTENTIAL_DAMP = 0.55; // wie viel vom vollen Niveau schon sichtbar ist
  function dampenForProspect(full: ReturnType<typeof toBbgmRatings>): ReturnType<typeof toBbgmRatings> {
    const damped = { ...full };
    for (const key of Object.keys(damped) as (keyof typeof damped)[]) {
      if (key === "hgt") continue; // physische Groesse "waechst" nicht rein
      damped[key] = Math.round(50 + (full[key] - 50) * HIGH_POTENTIAL_DAMP);
    }
    return damped;
  }
  function highPotentialValue(full: ReturnType<typeof toBbgmRatings>): number {
    const keys = (Object.keys(full) as (keyof typeof full)[]).filter((k) => k !== "hgt");
    const avg = keys.reduce((sum, k) => sum + full[k], 0) / keys.length;
    return Math.round(clamp(avg * 1.15, 75, 99));
  }

  const bbgmPlayers: Record<string, unknown>[] = [];

  for (const p of players) {
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
    const weight = Math.round(150 + (raw.power / 99) * 130);
    const heightInches = zollGerundet;
    const portraitRel = getPlayerPortraitBrowserUrl(p.id, p.portraitUrl ?? null, p.portraitPath ?? null);
    const imgURL = portraitRel ? `${BASE_URL}${portraitRel}` : undefined;
    const ratingScore = p.rating ?? 50;

    const makeRecord = (args: {
      tid: number; bornYear: number; draftYear: number; ratingsSeason: number;
      contract: { amount: number; exp: number } | null;
      ratingsOverride?: typeof ratings; pot?: number;
    }) => ({
      firstName: "",
      lastName: p.name,
      tid: args.tid,
      born: { year: args.bornYear, loc: "" },
      weight,
      hgt: heightInches,
      draft: { year: args.draftYear, round: 0, pick: 0, tid: -1 },
      ...(args.contract ? { contract: args.contract } : {}),
      imgURL,
      // `pos` bewusst NICHT gesetzt: Basketball GM berechnet die Position (inkl.
      // Kombi-Positionen wie "G"/"F"/"GF"/"FC") selbst aus den 15 Ratings, per eigenem
      // an echten NBA-Daten trainiertem Modell (siehe zengm.com/blog/2021/03/
      // new-position-formula) -- das ist naeher an "wie im Base-Game" als jede eigene
      // Heuristik hier, und bringt Mehrfachpositionen gratis mit.
      // `pot` bewusst NUR fuer High-Potential-Prospects gesetzt (s.u.) -- fuer alle
      // anderen berechnet Basketball GM es wie ovr selbst aus den 15 Ratings + Alter.
      ratings: [{
        season: args.ratingsSeason, fuzz: 0, skills: [],
        ...(args.ratingsOverride ?? ratings),
        ...(args.pot != null ? { pot: args.pot } : {}),
      }],
    });

    // Echte Oly-Kader als Startaufstellung uebernehmen statt alle als Free Agent zu
    // dumpen: eine KI, die 31 Kader aus 2984 Free Agents zusammenkaufen muss, tut das
    // schlecht (nachgemessen: Team-Ratings von +97 bis -130, praktisch nur das
    // handgepickte eigene Team konkurrenzfaehig). --empty-rosters schaltet das ab: dann
    // startet KEIN Team mit einem vorgefertigten Kader, alles laeuft ueber Draft/Free
    // Agency.
    const roster = freeAgentsOnly || emptyRosters ? null : rosterByPlayerId.get(p.id);
    if (initialFreeAgentIds.has(p.id)) {
      // Reservierter sofortiger Free Agent (stark bis schwach quer durch den Pool) --
      // nimmt nicht am Draft-Zyklus teil, sonst wie ein normaler aktiver Charakter.
      const potentialScore = resolvePlayerPotentialScoreFromGameState({ gameState: gs, playerId: p.id }) ?? ratingScore;
      const gap = clamp(potentialScore - ratingScore, 0, 30);
      const baseAge = 26 - (gap / 30) * 9;
      const frac = seededFraction(p.id);
      const age = Math.round(clamp(baseAge + (frac - 0.5) * 4, 17, 26));
      const bornYear = startingSeason - age;
      const amount = Math.round(clamp((ratingScore / 99) * 24500 + 500, 500, 25000));
      bbgmPlayers.push(makeRecord({
        tid: -1,
        bornYear,
        draftYear: Math.min(startingSeason, bornYear + 19),
        ratingsSeason: startingSeason,
        contract: { amount, exp: startingSeason + 2 },
      }));
      continue;
    }
    // Liste der Draft-Jahre, in denen dieser Charakter ueber alle Zyklen hinweg
    // auftaucht (leer = kein Platz im gewuenschten Zeitraum gefunden -> Fallback unten).
    const draftYears = roster || !totalDraftYears ? null : prospectDraftYearsByPlayerId.get(p.id) ?? null;

    if (!draftYears || draftYears.length === 0) {
      // Bereits aktiver Spieler (gerostert ODER sofortiger Free Agent, inkl. des
      // Randfall-Fallbacks oben): Alter ueber die Potenzial-Luecke wie gehabt, ein
      // Contract-Eintrag, draft.year darf nie in der Zukunft liegen (das ist kein
      // Nachwuchs-Draft, der Charakter spielt schon).
      const potentialScore = resolvePlayerPotentialScoreFromGameState({ gameState: gs, playerId: p.id }) ?? ratingScore;
      const gap = clamp(potentialScore - ratingScore, 0, 30);
      // Juenger als beim FM-Export (dort Deckel 30): Chris will hier mehr Spielzeit pro
      // Charakter herausholen, bevor Alterung/Ruhestand im Karriere-Modus greifen.
      const baseAge = 26 - (gap / 30) * 9;
      const frac = seededFraction(p.id);
      const jitter = (frac - 0.5) * 4;
      const age = Math.round(clamp(baseAge + jitter, 17, 26));
      const bornYear = startingSeason - age;
      const amount = Math.round(clamp((ratingScore / 99) * 24500 + 500, 500, 25000));
      const tid = roster ? tidByTeamId.get(roster.teamId) ?? -1 : -1;

      bbgmPlayers.push(makeRecord({
        tid,
        bornYear,
        draftYear: Math.min(startingSeason, bornYear + 19),
        ratingsSeason: startingSeason,
        contract: { amount, exp: startingSeason + 2 },
      }));
      continue;
    }

    // Draft-Prospect: noch nicht in der Liga, taucht in JEDEM zugewiesenen Zyklus-Jahr
    // erneut auf (tid -2 = "undrafted", BGMs eigene Konvention; kein Contract, noch
    // nicht unterschrieben). Alter/Geburtsjahr/Ratings-Saison beziehen sich pro Auftritt
    // auf DESSEN Draft-Jahr -- ein Rookie ist zu seinem jeweils eigenen Draft 19-23,
    // unabhaengig davon, wie viele Zyklen zuvor er schon einmal aufgetaucht ist.
    //
    // Oberes Staerke-Drittel (percentile, s.o. -- eine Charakter-Eigenschaft, gilt in
    // jedem Zyklus gleich) bekommt "mittleres bis starkes CA, aber hohes PO" (Chris
    // 06.09.): gedaempfte Anfangs-Ratings (nur ~55% des vollen Niveaus sichtbar --
    // Basketball GM zeigt also einen soliden, aber noch nicht ausgereiften Rookie),
    // dafuer ein explizit hohes `pot` (75-99, aus dem VOLLEN Niveau berechnet).
    // Basketball GMs eigene Alterungs-Engine zieht die tatsaechlichen Ratings ueber die
    // folgenden Saisons Richtung `pot` hoch -- so kommen sie "ueber die Jahre immer mehr
    // als coole neue Rookies" rein, statt schon am Draft-Tag fertig zu sein. Alle
    // anderen behalten ihr volles, unveraendertes Niveau und ein normales, von
    // Basketball GM selbst berechnetes `pot`.
    const highPotential = (prospectPercentileByPlayerId.get(p.id) ?? 0) >= HIGH_POTENTIAL_PERCENTILE;
    const ratingsOverride = highPotential ? dampenForProspect(ratings) : undefined;
    const pot = highPotential ? highPotentialValue(ratings) : undefined;

    for (const draftYear of draftYears) {
      const rookieAge = 19 + Math.floor(seededFraction(`${p.id}|rookieage|${draftYear}`) * 5);
      const bornYear = draftYear - rookieAge;
      bbgmPlayers.push(makeRecord({
        tid: -2,
        bornYear,
        draftYear,
        ratingsSeason: draftYear,
        contract: null,
        ratingsOverride,
        pot,
      }));
    }
  }

  const league = {
    startingSeason,
    teams: bbgmTeams,
    players: bbgmPlayers,
  };

  writeFileSync(out, JSON.stringify(league, null, 1), "utf-8");
  const cycleInfo = totalDraftYears ? `, Draft-Zykluslaenge: ${draftCycleLengthYears} Jahre` : "";
  console.log(`Geschrieben: ${out} (${bbgmTeams.length} Teams, ${bbgmPlayers.length} Spieler-Eintraege${cycleInfo})`);
}

main();
