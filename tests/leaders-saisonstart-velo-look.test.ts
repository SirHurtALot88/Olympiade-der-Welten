/**
 * W2 · Leaders-Saisonstart (Muster 3: „eine leere Rangliste behauptet nie eine
 * Reihenfolge") — freigegebener Entwurf `leagueLeaders-v2.html`.
 *
 * Der Kernbefund: `buildCategory` reiht 0-Werte über den Namens-Tiebreaker —
 * am Saisonstart war „Platz 1" damit nur der alphabetisch Erste. Die Kacheln
 * versteckten das, aber Footprint („2× Top-5", „Liga-Anführer") und
 * Saison-Bestwerte („Bester PPs-Wert 0,0") konsumierten die Alphabet-Ränge:
 * Medaillen an Spieler mit 0 PPs. Die Erkennung sitzt jetzt EINMAL im Service
 * (`isLeagueLeaderCategoryPending`) und schützt Kachelgrid, Footprint und
 * Bestwerte gleichermaßen; das Kachelgrid kollabiert leere Kategorien zu EINEM
 * `VeloPendingRanking` („Noch zu vergeben") plus echtem Vorsaison-Podium.
 *
 * Der Test hält außerdem fest, was beim Umbau still verlorengehen kann: dass
 * jede Klasse, auf die das neue Markup zielt, wirklich in globals.css existiert
 * (CSS-Klassen fallen still durch) — und umgekehrt, dass die ersetzten Stücke
 * (Karten-Leertext, Medaillenspiegel-Balkenchart) wirklich weg sind.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildLeagueLeaderBoards,
  isLeagueLeaderCategoryPending,
  type LeagueLeaderSourceRow,
} from "@/lib/foundation/league-leaders-service";
import {
  buildLeagueSeasonBests,
  buildOwnTeamLeaderboardFootprint,
} from "@/lib/foundation/league-season-bests";

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), "utf8");

const MARKUP = quelle("app/foundation/league-leaders-v2/LeagueLeadersNewLook.tsx");
const BESTS = quelle("lib/foundation/league-season-bests.ts");
const SERVICE = quelle("lib/foundation/league-leaders-service.ts");
const CSS = quelle("app/globals.css");
const PENDING = quelle("components/foundation/velo-ui/VeloPendingRanking.tsx");
const KATALOG = quelle("components/foundation/velo-ui/index.ts");

function zeile(input: {
  playerId: string;
  name: string;
  teamId?: string;
  pps?: number | null;
  ovr?: number | null;
  mvs?: number | null;
}): LeagueLeaderSourceRow {
  return {
    playerId: input.playerId,
    name: input.name,
    teamId: input.teamId ?? "team-x",
    teamCode: (input.teamId ?? "team-x").toUpperCase(),
    teamName: input.teamId ?? "team-x",
    pps: input.pps ?? null,
    ppPow: null,
    ppSpe: null,
    ppMen: null,
    ppSoc: null,
    ovr: input.ovr ?? null,
    ovrRank: null,
    mvs: input.mvs ?? null,
  };
}

/** Saisonstart: PPs überall 0 (Alphabet wäre die einzige „Reihenfolge"), OVR echt. */
const saisonstartRows: LeagueLeaderSourceRow[] = [
  zeile({ playerId: "p-aaron", name: "Aaron Erster", teamId: "team-own", pps: 0, ovr: 71 }),
  zeile({ playerId: "p-berta", name: "Berta Zweite", teamId: "team-b", pps: 0, ovr: 90 }),
  zeile({ playerId: "p-cesar", name: "Cesar Dritter", teamId: "team-c", pps: 0, ovr: 84 }),
];

describe(`isLeagueLeaderCategoryPending — die Grenze zwischen „nichts gespielt" und „echte 0"`, () => {
  it("ausnahmslos 0-Werte sind ein Leerzustand (die Reihenfolge wäre nur das Alphabet)", () => {
    const boards = buildLeagueLeaderBoards({ seasonRows: saisonstartRows });
    const pps = boards.find((board) => board.id === "pps")!;
    expect(pps.entries[0]?.name).toBe("Aaron Erster"); // der Tiebreaker reiht alphabetisch …
    expect(isLeagueLeaderCategoryPending(pps)).toBe(true); // … und genau deshalb gilt das nicht als Wertung
  });

  it("gar keine Einträge (Quelle liefert null) sind ebenfalls ein Leerzustand", () => {
    const boards = buildLeagueLeaderBoards({ seasonRows: saisonstartRows });
    const mvs = boards.find((board) => board.id === "mvs")!;
    expect(mvs.fullEntries).toHaveLength(0);
    expect(isLeagueLeaderCategoryPending(mvs)).toBe(true);
  });

  it("ein einziger Wert ≠ 0 macht die Wertung echt — auch ein negativer", () => {
    const boards = buildLeagueLeaderBoards({
      seasonRows: saisonstartRows,
      trainingRows: [
        { playerId: "p-aaron", name: "Aaron Erster", teamId: "team-own", teamCode: "OWN", teamName: "Own", trainingForecast: 0, ovrRank: null },
        { playerId: "p-berta", name: "Berta Zweite", teamId: "team-b", teamCode: "B", teamName: "B", trainingForecast: -0.6, ovrRank: null },
      ],
    });
    const training = boards.find((board) => board.id === "training")!;
    expect(isLeagueLeaderCategoryPending(training)).toBe(false);
    // Und: der Spieler mit 0,0 in einer echten Wertung hat einen echten Rang (hier Platz 1
    // vor dem negativen Wert) — ein Spieler mit 0 ist KEIN Leerzustand, nur die leere Liga.
    expect(training.entries[0]?.playerId).toBe("p-aaron");
  });

  it("eine gefüllte Kategorie (OVR) ist nie pending", () => {
    const boards = buildLeagueLeaderBoards({ seasonRows: saisonstartRows });
    const ovr = boards.find((board) => board.id === "ovr")!;
    expect(isLeagueLeaderCategoryPending(ovr)).toBe(false);
    expect(ovr.entries[0]?.name).toBe("Berta Zweite"); // nach Wert, nicht nach Alphabet
  });
});

describe("Footprint & Saison-Bestwerte vergeben keine Alphabet-Medaillen mehr", () => {
  const boards = buildLeagueLeaderBoards({ seasonRows: saisonstartRows });

  it("der eigene alphabetisch erste Spieler wird NICHT als Top-5/Liga-Anführer gezählt", () => {
    const footprint = buildOwnTeamLeaderboardFootprint({ categories: boards, selectedTeamId: "team-own" });
    // „Aaron Erster" steht in der 0-PPs-Liste auf „Rang 1" — davon darf nichts übrig bleiben:
    expect(footprint.leaderCount).toBe(0);
    expect(footprint.bestPlacement?.categoryId).toBe("ovr"); // nur die ECHTE Wertung zählt
    expect(footprint.bestPlacement?.rank).toBe(3);
    expect(footprint.top5SlotCount).toBe(1);
    expect(footprint.categoriesWithTop5).toBe(1);
  });

  it(`die Saison-Bestwerte überspringen pending-Kategorien statt „Bester PPs-Wert 0,0" zu krönen`, () => {
    const bests = buildLeagueSeasonBests({
      categories: boards,
      gameState: null,
      selectedTeamId: "team-own",
      seasonLabel: "Season 2",
    });
    const keys = bests.entries.map((entry) => entry.key);
    expect(keys).not.toContain("category:pps");
    expect(keys).not.toContain("category:mvs");
    expect(keys).toContain("category:ovr");
  });

  it("beide Verbraucher nutzen wörtlich dieselbe Service-Erkennung (eine Quelle)", () => {
    expect(BESTS).toContain("isLeagueLeaderCategoryPending");
    expect(MARKUP).toContain("isLeagueLeaderCategoryPending");
    expect(SERVICE).toContain("export function isLeagueLeaderCategoryPending");
  });
});

describe("Kachelgrid: leere Kategorien kollabieren zu EINEM VeloPendingRanking", () => {
  it(`das Grid rendert nur gefüllte Kategorien, der Rest wird ein „Noch zu vergeben"-Block`, () => {
    expect(MARKUP).toContain("filledCategories.map((category)");
    expect(MARKUP).toContain("<VeloPendingRanking");
    expect(MARKUP).toContain('data-testid="nl-leaders-pending"');
    expect(MARKUP).toContain('title="Noch zu vergeben"');
  });

  it("der frühere Karten-Leertext (6× derselbe Satz) ist weg — beidseitig", () => {
    expect(MARKUP).not.toContain("Noch keine Werte diese Saison");
    expect(MARKUP).not.toContain("nl-leaders-empty");
    expect(CSS).not.toContain("nl-leaders-empty");
  });

  it("die Slots erklären die Kürzel und tragen die Achsfarben-Punkte (Tokens, keine Hex-Werte)", () => {
    expect(MARKUP).toContain('label: "Punktebeitrag gesamt"');
    expect(MARKUP).toContain('label: "Marktwert-Score"');
    for (const achse of ["pow", "spe", "men", "soc"]) {
      expect(MARKUP).toContain(`dotColor: "var(--nl-${achse})"`);
    }
  });

  it(`die Erklärung unterscheidet „noch kein Spieltag gewertet" von „gespielt, aber ohne Wert"`, () => {
    expect(MARKUP).toContain("seasonAwards.matchdaysPlayed > 0");
    expect(MARKUP).toContain("noch ist kein Spieltag gewertet");
    expect(MARKUP).toContain("nur das Alphabet");
  });

  it("das Vorsaison-Podium kommt aus dem geteilten Snapshot-Datenweg von Ranks (W1)", () => {
    expect(MARKUP).toContain('from "@/lib/foundation/ranks-previous-season-podium"');
    expect(MARKUP).toContain("buildPreviousSeasonPodium(foundationGameState)");
    expect(MARKUP).toContain("previousSeasonPodium && previousSeasonPodium.entries.length > 0");
    expect(MARKUP).toContain("Vorsaison · Endstand {previousSeasonPodium.seasonLabel}");
  });

  it("VeloPendingRanking bleibt das geteilte Katalog-Primitive (kein Parallelbau)", () => {
    expect(MARKUP).toContain('from "@/components/foundation/velo-ui"');
    expect(KATALOG).toContain("VeloPendingRanking");
    expect(KATALOG).toContain("Leaders");
    expect(PENDING).toContain("Leaders (W2)");
  });
});

describe("Jede im neuen Markup benutzte Klasse existiert in globals.css (und zurück)", () => {
  const tokens = new Set<string>();
  for (const match of MARKUP.matchAll(/nl-leaders-(?:pending|prev-podium)[a-z0-9-]*(?<!-)/g)) {
    tokens.add(match[0]);
  }
  for (const match of PENDING.matchAll(/velo-pending-ranking[a-z0-9-]*(?<!-)/g)) {
    tokens.add(match[0]);
  }
  tokens.delete("nl-leaders-pending-ranking"); // data-testid, keine Klasse.
  // Der Aufklapp-Knopf der Legenden-Anwärter nutzt die bestehende Drawer-Knopf-Klasse.
  tokens.add("nl-rankdrawer-more");

  it("das Markup benutzt die neuen Bausteine überhaupt", () => {
    expect(tokens.has("nl-leaders-pending")).toBe(true);
    expect(tokens.has("nl-leaders-prev-podium")).toBe(true);
    expect(tokens.has("velo-pending-ranking-slot")).toBe(true);
  });

  it.each([...tokens].sort())("%s ist in globals.css definiert", (klasse) => {
    expect(CSS).toMatch(new RegExp(`\\.${klasse}[\\s.,:{[>)]`));
  });
});

describe("Rekorde-Reiter: Medaillenspiegel und Geld-Einheiten", () => {
  it("nur Teams mit Medaille bekommen eine Zeile — der Rest ist ein gezählter Satz", () => {
    expect(MARKUP).toContain("row.gold + row.silver + row.bronze > 0");
    expect(MARKUP).toContain("ohne Medaille");
  });

  it("der Container-skalierte Balkenchart (2.500-px-Goldbalken bei 1 Saison) ist weg — beidseitig", () => {
    expect(MARKUP).not.toContain("<NlBarChart");
    expect(MARKUP).not.toContain("championBars");
    expect(CSS).not.toMatch(/\.nl-records-champions-chart[\s.,:{[>)]/);
  });

  it(`Geldbeträge tragen die Mio-Einheit (Befund 7: „65" ohne Einheit)`, () => {
    expect(MARKUP).toContain("formatNlMoney(records.recordTransferFee.amount)");
    expect(MARKUP).toContain("formatNlMoney(records.peakSquadMarketValue.value)");
    expect(MARKUP).toContain("formatNlSignedMoney(records.biggestMwJump.delta)");
    expect(BESTS).toContain("formatNlMoney(peakSquad.total)");
  });
});

describe("Legenden-Anwärter: kollabiert statt 10 × 5 identischer Kriterienzeilen", () => {
  it("Standard zeigt nur Anwärter mit Fortschritt (bzw. die ersten drei), der Rest per Knopf", () => {
    expect(MARKUP).toContain("kandidat.erfuellteAnzahl > 0");
    expect(MARKUP).toContain('data-testid="legend-candidates-show-all"');
    expect(MARKUP).toContain("weitere Anwärter anzeigen");
  });
});
