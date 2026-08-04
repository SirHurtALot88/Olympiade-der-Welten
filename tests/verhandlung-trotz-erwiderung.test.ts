/**
 * ZWEI AUFTRÄGE, ein Mechanismus-Paar (verhandlung-rework.md Abschnitt 9.1 und 9.3):
 *
 *   „aber sollte bei so sturen spielern wenn verhandelt wird die forderung nicht teils hoch
 *   gehen? vor allem wenn ich lowballen will?"
 *
 *   „wenn ich dann entgegen komme und bei umbros zb 13,5 biete müsste er ggf. auch noch mal
 *   entgegen kommen"
 *
 * Beides scheiterte vorher an derselben Eigenschaft: das Modell war GEDÄCHTNISLOS. Gemessen an
 * einem echten Spielstand ergaben die Angebote 12,96 / 13,09 / 13,37 die Gegenangebote
 * 13,57 / 13,58 / 13,61 — die Zahl stieg, je weiter man entgegenkam. Eine Formel ohne Vorrunde
 * kann Entgegenkommen prinzipiell nicht belohnen und einen Lowball nicht nachtragen.
 *
 * Deshalb zwei persistierte Felder (`defianceSurchargePct`, `lastCounterSalary`) — und die
 * Bedingung, unter der sie sich nie widersprechen: sie hängen an der RICHTUNG des Angebots.
 * Runter = Affront (bestand schon), tief = Trotz, rauf = Erwiderung. Keine Runde kann zwei
 * davon gleichzeitig auslösen.
 */
import { describe, expect, it } from "vitest";

import type { Player } from "@/lib/data/olyDataTypes";
import {
  DEFIANCE_FACTOR,
  DEFIANCE_INSULT_RATIO,
  DEFIANCE_MAX_SURCHARGE,
  buildContractNegotiationDraft,
  buildContractNegotiationPreview,
} from "@/lib/market/contract-negotiation-preview";
import { makePlayer, makeTeam, makeTeamIdentity } from "./_fixtures/game-entity-fixtures";

const TEAM = makeTeam({ teamId: "A-A", cash: 300 });
const IDENTITY = makeTeamIdentity({ teamId: "A-A", ambition: 5, popularity: 5 });

function spieler(id: string, traitsPositive: string[] = [], traitsNegative: string[] = []): Player {
  return makePlayer({
    id,
    name: `Spieler ${id}`,
    traitsPositive,
    traitsNegative,
    salaryDemand: 100,
    displaySalary: 4,
    marketValue: 3000,
    displayMarketValue: 30,
  });
}

function vorschau(player: Player, offeredSalary: number | null, extra: Record<string, unknown> = {}) {
  return buildContractNegotiationPreview({
    saveId: "trotz-check",
    seasonId: "season-1",
    team: TEAM,
    teamIdentity: IDENTITY,
    teamStrategyProfile: null,
    player,
    rosterPlayers: [],
    contractLength: 3,
    contractShape: "balanced",
    offeredSalary,
    scoutingLevel: 0,
    seasonLabelBase: "Season 1",
    ...extra,
  });
}

const STUR = spieler("merc", ["Mercenary"]);
const SANFT = spieler("neutral");
const forderung = (p: Player) => vorschau(p, null).expectedSalary as number;

/**
 * Ein Angebot IN der Trotz-Zone, aus den echten Schwellen abgeleitet statt geraten.
 * Zone 2 liegt zwischen der Absage-Schwelle (darunter bricht er ab, Zone 3) und der
 * Beleidigungslinie. Feste Prozentwerte wie „0,87x" treffen sie je nach Fixture gar nicht —
 * ein Mercenary hat durch `persRej` eine deutlich höhere Absage-Schwelle als ein neutraler
 * Spieler.
 */
function trotzZone(p: Player, tiefe: "flach" | "tief"): number {
  const basis = vorschau(p, null);
  const D = basis.expectedSalary as number;
  const untenRatio = (basis.rejectThresholdSalary as number) / D;
  const obenRatio = Math.min(DEFIANCE_INSULT_RATIO, ((basis.acceptThresholdSalary as number) / D) - 0.04);
  const anteil = tiefe === "flach" ? 0.75 : 0.15; // beide sicher innerhalb der Zone
  return Number((D * (untenRatio + (obenRatio - untenRatio) * anteil)).toFixed(2));
}

describe("Trotz (9.1): ein Lowball bei Sturen kostet — aber bricht nicht ab", () => {
  it("hebt bei Sturen die Forderung, sobald das Angebot unter die Beleidigungslinie geht", () => {
    const tief = vorschau(STUR, trotzZone(STUR, "tief"));
    expect(tief.pendingDefianceSurchargePct).toBeGreaterThan(0);
    expect(tief.pendingDefianceSurchargePct).toBeLessThanOrEqual(DEFIANCE_MAX_SURCHARGE);
  });

  it("lässt normales Feilschen straffrei", () => {
    // Der Aufschlag darf kein Preisschild auf JEDES Angebot unter Forderung sein — sonst wäre
    // Verhandeln selbst bestraft, und das war nie die Beschwerde.
    const D = forderung(STUR);
    expect(vorschau(STUR, Number((D * 0.97).toFixed(2))).pendingDefianceSurchargePct).toBe(0);
    expect(vorschau(STUR, D).pendingDefianceSurchargePct).toBe(0);
  });

  it("trifft NUR Sture — ein sanfter Spieler nimmt denselben Lowball nicht persönlich", () => {
    // Dieselbe RELATIVE Tiefe wie beim Sturen — es liegt an der Person, nicht an der Zahl.
    expect(vorschau(SANFT, trotzZone(SANFT, "tief")).pendingDefianceSurchargePct).toBe(0);
  });

  it("wird tiefer, je tiefer der Griff — und zwar überproportional", () => {
    // Der Faktor 1,5 ist kein Geschmack: er ist der Grund, warum sich ein Lowball nicht durch
    // späteres Entgegenkommen zurückverdienen lässt (größter Erwiderungs-Faktor 0,7).
    const flach = vorschau(STUR, trotzZone(STUR, "flach")).pendingDefianceSurchargePct ?? 0;
    const tief = vorschau(STUR, trotzZone(STUR, "tief")).pendingDefianceSurchargePct ?? 0;
    expect(tief).toBeGreaterThan(flach);
    expect(DEFIANCE_FACTOR).toBeGreaterThan(0.7);
  });

  it("wirkt erst in der NÄCHSTEN Runde — die Vorschau warnt, der Klick schreibt fest", () => {
    // Sonst wäre das Verdikt die Antwort auf eine Forderung, die es im Moment des Tippens noch
    // gar nicht gibt: man tippt eine Zahl und bekommt eine Absage auf eine andere.
    const D = forderung(STUR);
    const getippt = vorschau(STUR, trotzZone(STUR, "tief"));
    expect(getippt.defianceSurchargePct).toBe(0); // gilt noch nicht
    expect(getippt.pendingDefianceSurchargePct).toBeGreaterThan(0); // gälte nach dem Klick
    expect(getippt.expectedSalary).toBeCloseTo(D, 2);
  });

  it("hebt in der nächsten Runde die Forderung sichtbar — mit beiden Zahlen", () => {
    const D = forderung(STUR);
    const runde2 = vorschau(STUR, trotzZone(STUR, "tief"), { priorDefianceSurchargePct: 0.03 });
    expect(runde2.baseDemandSalary).toBeCloseTo(D, 2);
    expect(runde2.expectedSalary).toBeCloseTo(Number((D * 1.03).toFixed(2)), 1);
    // Der Aufschlag steht als eigener Posten in der Forderungs-Aufschlüsselung, nicht nur als
    // veränderte Endzahl — sonst wäre er für den Spieler Willkür.
    expect(runde2.demandBreakdown.some((entry) => entry.key === "defiance_surcharge")).toBe(true);
  });

  it("bricht NICHT ab, nur weil der Aufschlag das Angebot relativ tiefer macht", () => {
    // „Trotz ist Ärger, kein Bruch." Der Abbruch misst gegen die Forderung OHNE Aufschlag —
    // sonst würde ein Aufschlag, den der Spieler selbst ausgelöst hat, dasselbe Angebot in der
    // nächsten Runde zum Vertrauensbruch machen: zweimal bestraft für denselben Griff.
    const D = forderung(STUR);
    const angebot = Number((D * 0.9).toFixed(2));
    const ohne = vorschau(STUR, angebot);
    const mit = vorschau(STUR, angebot, { priorDefianceSurchargePct: DEFIANCE_MAX_SURCHARGE });
    expect(ohne.verdict).not.toBe("reject_lowball");
    expect(mit.verdict).not.toBe("reject_lowball");
  });

  it("wächst monoton und wird bei Vertrauensbruch genullt", () => {
    const D = forderung(STUR);
    const hoch = vorschau(STUR, D); // löst selbst keinen Aufschlag aus
    const draft = buildContractNegotiationDraft({
      saveId: "s", seasonId: "season-1", teamId: "A-A", playerId: STUR.id, playerName: STUR.name,
      priorDefianceSurchargePct: 0.04,
      preview: { ...hoch, status: "countered" },
    });
    // Ein braves Angebot schüttelt den Aufschlag nicht ab: es zählt der tiefste je VERHANDELTE
    // Griff. Wäre er abbaubar, wäre Lowball-zuerst gratis — man zahlt am Ende ohnehin nur den
    // fairen Preis, und die Strafe verteuert nur die Runde statt den Pfad.
    expect(draft.defianceSurchargePct).toBe(0.04);

    const gebrochen = buildContractNegotiationDraft({
      saveId: "s", seasonId: "season-1", teamId: "A-A", playerId: STUR.id, playerName: STUR.name,
      priorDefianceSurchargePct: 0.04,
      preview: { ...hoch, status: "rejected_bad_experience" },
    });
    // Dort greift die Vertrauensbruch-Strafe (x1,12) — beides zu stapeln wäre zweimal kassiert.
    expect(gebrochen.defianceSurchargePct).toBe(0);
  });

  it("misst den Auslöser gegen die unbelastete Forderung — kein Selbstnachladen", () => {
    // Gegen die bereits erhöhte Forderung gemessen wäre jede Folgerunde automatisch „tiefer"
    // und der Aufschlag würde sich Runde um Runde selbst nachladen.
    const angebot = trotzZone(STUR, "tief");
    const runde1 = vorschau(STUR, angebot);
    const runde2 = vorschau(STUR, angebot, { priorDefianceSurchargePct: runde1.pendingDefianceSurchargePct });
    expect(runde2.pendingDefianceSurchargePct).toBe(runde1.pendingDefianceSurchargePct);
  });

  it("bleibt insgesamt unter der Vertrauensbruch-Strafe", () => {
    expect(DEFIANCE_MAX_SURCHARGE).toBeLessThan(0.12);
    expect(DEFIANCE_INSULT_RATIO).toBe(0.9);
  });
});

describe("Erwiderung (9.3): wer entgegenkommt, sieht die Zahl sinken", () => {
  const D = forderung(SANFT);
  const runde1Angebot = Number((D * 0.94).toFixed(2));

  function runde1() {
    const ergebnis = vorschau(SANFT, runde1Angebot);
    expect(ergebnis.verdict, "Fixture trifft das Gegenangebots-Band nicht").toBe("counter_money");
    return ergebnis;
  }

  it("senkt das Gegenangebot, wenn ihr erhöht — statt es steigen zu lassen", () => {
    // Der gemessene Ist-Zustand vor dieser Änderung: 13,57 → 13,58 → 13,61, je weiter man
    // entgegenkam. Genau darauf zielte „müsste er ggf. auch noch mal entgegen kommen".
    const erste = runde1();
    const erhoeht = Number((runde1Angebot + D * 0.02).toFixed(2));
    const mit = vorschau(SANFT, erhoeht, {
      lastCounterSalary: erste.counterSalary,
      lastNegotiatedSalary: runde1Angebot,
    });
    if (mit.verdict === "counter_money") {
      expect(mit.counterSalary!).toBeLessThan(erste.counterSalary!);
      expect(mit.concededFromLastCounter).toBe(true);
    } else {
      // Auch gültig: die Erwiderung hat die Lücke unter einen Gehaltsschritt gedrückt.
      expect(mit.verdict).toBe("accept");
    }
  });

  it("steht zu seinem letzten Wort — das Gegenangebot steigt innerhalb einer Verhandlung nie", () => {
    const erste = runde1();
    for (const auf of [0.01, 0.02, 0.03, 0.05]) {
      const erhoeht = Number((runde1Angebot + D * auf).toFixed(2));
      const mit = vorschau(SANFT, erhoeht, {
        lastCounterSalary: erste.counterSalary,
        lastNegotiatedSalary: runde1Angebot,
      });
      if (mit.verdict === "counter_money") {
        expect(mit.counterSalary!, `+${auf}`).toBeLessThanOrEqual(erste.counterSalary! + 0.005);
      }
    }
  });

  it("konvergiert statt beliebig weit zu fallen — Salami-Taktik lohnt nicht", () => {
    // Ohne Budget-Boden wären viele kleine Schritte, jeder halb erwidert, dominant: der Pfad
    // konvergiert rechnerisch deutlich unter die Zusage-Schwelle. Mit Boden endet er dicht
    // darüber.
    const erste = runde1();
    let angebot = runde1Angebot;
    let letzterKonter = erste.counterSalary!;
    for (let runde = 0; runde < 12; runde += 1) {
      const naechstes = Number((angebot + D * 0.011).toFixed(2));
      const ergebnis = vorschau(SANFT, naechstes, {
        lastCounterSalary: letzterKonter,
        lastNegotiatedSalary: angebot,
      });
      if (ergebnis.verdict !== "counter_money") break;
      letzterKonter = ergebnis.counterSalary!;
      angebot = naechstes;
    }
    // Der Boden liegt bei R_full - rho; mehr als ein paar Prozent unter der Zusage-Schwelle
    // darf die Salami nie bringen.
    expect(letzterKonter).toBeGreaterThan((vorschau(SANFT, D).acceptThresholdSalary as number) * 0.95);
  });

  it("erwidert nur echte Schritte, keine Fünf-Cent-Gesten", () => {
    const erste = runde1();
    const winzig = Number((runde1Angebot + 0.01).toFixed(2));
    const mit = vorschau(SANFT, winzig, {
      lastCounterSalary: erste.counterSalary,
      lastNegotiatedSalary: runde1Angebot,
    });
    // Er gibt nichts nach — das ist die Regel. Sein letztes Wort deckelt trotzdem: der
    // Mindestschritt entscheidet, ob er ENTGEGENKOMMT, nicht ob er wieder hochgehen darf.
    expect(mit.concededFromLastCounter).toBe(false);
    expect(mit.counterSalary!).toBeLessThanOrEqual(erste.counterSalary! + 0.005);
  });

  it("ohne Vorrunde verhält es sich exakt wie bisher", () => {
    // Der Erstkontakt darf sich durch die Erwiderung nicht verändert haben.
    const erhoeht = Number((runde1Angebot + D * 0.02).toFixed(2));
    expect(vorschau(SANFT, erhoeht).concededFromLastCounter).toBe(false);
  });

  it("merkt sich sein Wort nur, solange die Verhandlung offen steht", () => {
    const erste = runde1();
    const offen = buildContractNegotiationDraft({
      saveId: "s", seasonId: "season-1", teamId: "A-A", playerId: SANFT.id, playerName: SANFT.name,
      preview: { ...erste, status: "countered" },
    });
    expect(offen.lastCounterSalary).toBe(erste.counterSalary);

    const beendet = buildContractNegotiationDraft({
      saveId: "s", seasonId: "season-1", teamId: "A-A", playerId: SANFT.id, playerName: SANFT.name,
      preview: { ...erste, status: "accepted_pending_confirm" },
    });
    // Jeder andere Status beendet die Runde — dann gibt es nichts mehr zu erwidern.
    expect(beendet.lastCounterSalary).toBeNull();
  });
});

describe("Die drei Gedächtnisse können sich nicht widersprechen", () => {
  it("hängen an der Richtung des Angebots: runter, tief, rauf", () => {
    // Affront (runter unter das letzte Angebot) übersteuert alles; Trotz greift nur unterhalb
    // der Beleidigungslinie; Erwiderung nur bei einem ECHTEN Schritt nach oben. Keine Runde
    // kann zwei davon gleichzeitig auslösen — hier am Affront geprüft, der als einziger ein
    // Verdikt erzwingt.
    const D = forderung(STUR);
    const affront = vorschau(STUR, trotzZone(STUR, "tief"), {
      affrontRetreat: true,
      priorDefianceSurchargePct: 0.03,
      lastCounterSalary: Number((D * 0.99).toFixed(2)),
      lastNegotiatedSalary: Number((D * 0.95).toFixed(2)),
    });
    expect(affront.verdict).toBe("reject_affront");
    expect(affront.counterSalary).toBeNull();
  });
});
