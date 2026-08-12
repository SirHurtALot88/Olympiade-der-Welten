/**
 * DER BLINDE FLECK DER GESAMTEN SPONSOR-SUITE — dieser Test schliesst ihn.
 *
 * BEFUND: 57 gruene Sponsor-Testdateien mit 374 gruenen Tests konnten neben 31 von 32 FALSCH
 * abgerechneten Vertraegen koexistieren (Live-Abbild vom 11.08.2026, Save
 * `new-game-1786465783606-0kalpx`: A-A zeigte 34,7 C und haette 55,8 bekommen, R-C 41,4 gegen 95,3,
 * ueber die Liga 1 997,6 gegen 2 310,1 C). Der Grund ist keine Luecke IN einem dieser Tests, sondern
 * eine Luecke ZWISCHEN ihnen: KEIN EINZIGER ging durch `lib/persistence/save-repository.ts` — und
 * genau dort sass der Fehler (`withMigratedSponsorLadders` im Ladepfad).
 *
 * Die Mechanik, an der man sieht, warum kein Einheitentest sie finden konnte: `new-game-setup-service`
 * laesst die KI SOFORT beim Anlegen unterschreiben. Der erste Ladevorgang danach findet einen
 * Spielstand ohne Migrationsstempel vor, und die Migration baute jedem noch nicht abgerechneten
 * Vertrag neue Konditionen — auch dem, der gerade erst welche bekommen hatte. Die frisch
 * eingefrorene Ligaleiter (Kurvenform, Tilt, Raritaets-Wertfaktor, Gebaeude-Verzicht) wurde durch die
 * form- und tiltfreie Preisgeld-Benchmark ersetzt. Im Speicher stimmte alles; erst nach dem
 * SPEICHERN UND LADEN wich die Abrechnung von der Karte ab. Nur der Mensch war verschont — er
 * unterschreibt erst nach dem ersten Laden.
 *
 * WAS DIESER TEST TUT: er legt ein NEUES SPIEL an (32 Teams, KI unterschreibt), SPEICHERT es ueber
 * das echte Repository, verwirft den Session-Cache und LAEDT es kalt aus SQLite zurueck. Danach
 * vergleicht er ueber ALLE Vertraege und ALLE 32 Sprossen, ob die Karte noch dasselbe zeigt, was das
 * Settlement zahlt — und ob beides noch dasselbe ist wie vor dem Speichern.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { GameState, TeamSponsorContract } from "@/lib/data/olyDataTypes";
import { createSingleplayerGameState } from "@/lib/game-state/singleplayer-state";
import { createSaveRepository } from "@/lib/persistence/save-repository";
import { invalidateSaveSessionCache } from "@/lib/persistence/save-session-cache";
import { resetDatabaseForTests } from "@/lib/persistence/sqlite";
import { advanceSponsorContractsForNewSeason } from "@/lib/sponsor/sponsor-contract-lifecycle";
import { readLockedRankPayout } from "@/lib/sponsor/sponsor-economy-calibration";
import { chooseSponsorOfferForAiTeams, ensureSeasonSponsorOffers } from "@/lib/sponsor/sponsor-offer-service";
import { previewSponsorSettlement } from "@/lib/sponsor/sponsor-settlement-service";
import { getSponsorV3Terms, sponsorV3GuaranteedLadder } from "@/lib/sponsor/sponsor-v3-offer-service";

const SAVE_ID = "sponsorkarte-rundreise";
const previousSqlitePath = process.env.OLY_APP_SQLITE_PATH;
let tempDirectory = "";

beforeEach(() => {
  tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "oly-sponsor-rundreise-"));
  process.env.OLY_APP_SQLITE_PATH = path.join(tempDirectory, "data", "oly-app.sqlite");
  resetDatabaseForTests();
});

afterEach(() => {
  resetDatabaseForTests();
  process.env.OLY_APP_SQLITE_PATH = previousSqlitePath;
  if (tempDirectory && fs.existsSync(tempDirectory)) {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
});

/**
 * Ein NEUES SPIEL in genau dem Zustand, in dem der "Neues Spiel"-Knopf es hinterlaesst: Angebote
 * erzeugt, KI-Vertraege unterschrieben, Leiter-Migration noch NIE gelaufen (kein Stempel). Genau
 * dieser Zustand trifft beim ersten Laden auf die Migration.
 */
function neuesSpielMitUnterschriebenenVertraegen(): GameState {
  const gameState = chooseSponsorOfferForAiTeams(ensureSeasonSponsorOffers(createSingleplayerGameState()));
  const seasonState = { ...gameState.seasonState };
  delete (seasonState as { sponsorLadderMigrationVersion?: number }).sponsorLadderMigrationVersion;
  return { ...gameState, seasonState };
}

/** Was die KARTE zeigt: die bei Unterschrift eingefrorene Leiter am jeweiligen Rang. */
function karteAmRang(contract: TeamSponsorContract, rang: number): number {
  return readLockedRankPayout(contract.lockedRankPayoutLadder ?? [], rang);
}

/** Woraus das SETTLEMENT zahlt: die garantierte Leiter der Vertragskonditionen. */
function settlementAmRang(contract: TeamSponsorContract, rang: number): number {
  const terms = getSponsorV3Terms(contract);
  if (!terms) return Number.NaN;
  return sponsorV3GuaranteedLadder(terms)[rang - 1] ?? Number.NaN;
}

function vertraege(gameState: GameState): [string, TeamSponsorContract][] {
  return Object.entries(gameState.seasonState.sponsorContractsByTeamId ?? {});
}

describe("Sponsorkarte == Settlement, auch nach Speichern und Laden", () => {
  it("jede der 32 Sprossen jedes Vertrags ueberlebt die Runde durch SQLite unveraendert", () => {
    const vorher = neuesSpielMitUnterschriebenenVertraegen();
    const vertraegeVorher = vertraege(vorher);
    // Die Voraussetzung, gemessen statt behauptet: es gibt ueberhaupt eine Liga voller Vertraege.
    expect(vertraegeVorher.length).toBeGreaterThanOrEqual(31);
    expect(vorher.seasonState.sponsorLadderMigrationVersion).toBeUndefined();

    const repository = createSaveRepository();
    repository.saveGameState({ saveId: SAVE_ID, gameState: vorher });
    invalidateSaveSessionCache(SAVE_ID);
    const geladen = repository.getSaveById(SAVE_ID);
    expect(geladen, "der Spielstand muss sich laden lassen").not.toBeNull();
    const nachher = geladen!.gameState;

    // Der Ladepfad IST gelaufen — sonst prueft dieser Test die Migration gar nicht.
    expect(nachher.seasonState.sponsorLadderMigrationVersion).toBeGreaterThan(0);

    const vertraegeNachher = new Map(vertraege(nachher));
    expect(vertraegeNachher.size).toBe(vertraegeVorher.length);

    let verglichen = 0;
    const abweichungen: string[] = [];
    for (const [teamId, vertragVorher] of vertraegeVorher) {
      const vertragNachher = vertraegeNachher.get(teamId);
      expect(vertragNachher, `Vertrag von ${teamId} fehlt nach dem Laden`).toBeDefined();

      for (let rang = 1; rang <= 32; rang += 1) {
        const karte = karteAmRang(vertragNachher!, rang);
        const settlement = settlementAmRang(vertragNachher!, rang);
        const karteVorher = karteAmRang(vertragVorher, rang);

        // 1. Karte == Settlement NACH dem Laden.
        if (Math.abs(karte - settlement) > 1e-6) {
          abweichungen.push(`${teamId}@${rang}: Karte ${karte.toFixed(1)} vs Settlement ${settlement.toFixed(1)}`);
        }
        // 2. Und beides ist noch das, was VOR dem Speichern unterschrieben wurde.
        if (Math.abs(karte - karteVorher) > 1e-6) {
          abweichungen.push(`${teamId}@${rang}: Karte nach Laden ${karte.toFixed(1)} vs vor Speichern ${karteVorher.toFixed(1)}`);
        }
        verglichen += 1;
      }
    }

    expect(abweichungen.slice(0, 10).join(" | ")).toBe("");
    // Der Test zaehlt seine Vergleiche mit, damit er nicht gruen sein kann, weil er nichts geprueft hat.
    expect(verglichen).toBe(vertraegeVorher.length * 32);
    expect(verglichen).toBeGreaterThanOrEqual(31 * 32);
  }, 180_000);

  it("die Identitaet der Karte (Kurvenform, Raritaet, Gebaeude-Verzicht) ueberlebt das Laden", () => {
    const vorher = neuesSpielMitUnterschriebenenVertraegen();
    const repository = createSaveRepository();
    repository.saveGameState({ saveId: SAVE_ID, gameState: vorher });
    invalidateSaveSessionCache(SAVE_ID);
    const nachher = repository.getSaveById(SAVE_ID)!.gameState;

    const nachherMap = new Map(vertraege(nachher));
    let mitVerzicht = 0;
    let geprueft = 0;
    for (const [teamId, vertragVorher] of vertraege(vorher)) {
      const termsVorher = getSponsorV3Terms(vertragVorher);
      const termsNachher = getSponsorV3Terms(nachherMap.get(teamId)!);
      expect(termsVorher, `${teamId} trug vor dem Speichern keine V3-Konditionen`).not.toBeNull();
      expect(termsNachher, `${teamId} hat nach dem Laden keine V3-Konditionen mehr`).not.toBeNull();

      expect(termsNachher!.curveShape).toBe(termsVorher!.curveShape);
      expect(termsNachher!.rarity).toBe(termsVorher!.rarity);
      expect(termsNachher!.tilt).toBeCloseTo(termsVorher!.tilt, 9);
      expect(termsNachher!.anchor).toBeCloseTo(termsVorher!.anchor, 6);
      expect(termsNachher!.floor).toBeCloseTo(termsVorher!.floor, 6);
      expect(termsNachher!.leihVerzicht ?? 0).toBeCloseTo(termsVorher!.leihVerzicht ?? 0, 6);
      if ((termsVorher!.leihVerzicht ?? 0) > 0) mitVerzicht += 1;
      geprueft += 1;
    }
    expect(geprueft).toBeGreaterThanOrEqual(31);
    // Die Gebaeude-Karten sind der teuerste Fall: ihr Cash-Verzicht steckt AUSSCHLIESSLICH in der
    // Kartenleiter. Ging sie verloren, behielt das Team das Gebaeude UND bekam die volle Leiter.
    expect(mitVerzicht, "ohne Gebaeude-Karten im Slate misst dieser Test den teuersten Fall nicht").toBeGreaterThan(0);
  }, 180_000);

  /**
   * DERSELBE BLINDE FLECK, EINE SAISON SPAETER. `advanceSponsorContractsForNewSeason` laeuft NUR beim
   * Saisonwechsel: sie baut die Leiter jedes Mehrjahresvertrags neu (Gehaltsfaktor + Erosion + eine
   * Stufe Gebaeude-Leihe) und schreibt `lockedRankPayoutLadder` nach. Auch dieser Pfad ging bis hier
   * durch keinen Test, der anschliessend speichert und laedt — und der geladene Spielstand ist genau
   * der, aus dem die naechste Saison abgerechnet wird.
   */
  it("auch nach einem SAISONWECHSEL zeigt die geladene Karte, was das Settlement zahlt", () => {
    const saison1 = neuesSpielMitUnterschriebenenVertraegen();
    const saison2 = advanceSponsorContractsForNewSeason(saison1, "season-2");
    const gerollt = vertraege(saison2).filter(([, vertrag]) => getSponsorV3Terms(vertrag) != null);
    expect(gerollt.length, "kein Mehrjahresvertrag gerollt — dann misst dieser Test nichts").toBeGreaterThan(0);

    const repository = createSaveRepository();
    repository.saveGameState({ saveId: SAVE_ID, gameState: { ...saison2, season: { ...saison2.season, id: "season-2" } } });
    invalidateSaveSessionCache(SAVE_ID);
    const nachher = repository.getSaveById(SAVE_ID)!.gameState;

    const nachherMap = new Map(vertraege(nachher));
    let verglichen = 0;
    const abweichungen: string[] = [];
    for (const [teamId, vertragVorher] of gerollt) {
      const vertragNachher = nachherMap.get(teamId);
      expect(vertragNachher, `Vertrag von ${teamId} fehlt nach dem Laden`).toBeDefined();
      for (let rang = 1; rang <= 32; rang += 1) {
        const karte = karteAmRang(vertragNachher!, rang);
        if (Math.abs(karte - settlementAmRang(vertragNachher!, rang)) > 1e-6) {
          abweichungen.push(`${teamId}@${rang}: Karte ${karte.toFixed(1)} != Settlement`);
        }
        if (Math.abs(karte - karteAmRang(vertragVorher, rang)) > 1e-6) {
          abweichungen.push(`${teamId}@${rang}: Laden hat die gerollte Karte veraendert`);
        }
        verglichen += 1;
      }
    }
    expect(abweichungen.slice(0, 10).join(" | ")).toBe("");
    expect(verglichen).toBe(gerollt.length * 32);
  }, 180_000);

  it("das Settlement des GELADENEN Spielstands zahlt die Basiszeile der Karte", () => {
    const vorher = neuesSpielMitUnterschriebenenVertraegen();
    const repository = createSaveRepository();
    repository.saveGameState({ saveId: SAVE_ID, gameState: vorher });
    invalidateSaveSessionCache(SAVE_ID);
    const nachher = repository.getSaveById(SAVE_ID)!.gameState;

    const zeilen = previewSponsorSettlement(nachher).rows;
    let geprueft = 0;
    for (const [teamId, vertrag] of vertraege(nachher)) {
      const basis = zeilen.find((zeile) => zeile.teamId === teamId && zeile.kind === "base");
      expect(basis, `keine Basiszeile fuer ${teamId}`).toBeDefined();
      // Die Basiszeile ist definitionsgemaess der Betrag am letzten Platz — also die unterste
      // Sprosse der Karte, auf eine Nachkommastelle gerundet wie jede Settlement-Zeile.
      expect(basis!.cashDelta).toBeCloseTo(Math.round(karteAmRang(vertrag, 32) * 10) / 10, 6);
      geprueft += 1;
    }
    expect(geprueft).toBeGreaterThanOrEqual(31);
  }, 180_000);
});
