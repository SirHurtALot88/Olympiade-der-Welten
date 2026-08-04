// Prüfung der Invarianten aus docs/design/verhandlung-rework.md — dem freigegebenen und
// durchgerechneten Balance-Entwurf für die Spielerkauf-Verhandlung. Diese Suite hält die
// GARANTIEN fest (nicht nur Einzelwerte), die den behobenen Defekt (Ratsche + unbegrenztes
// Gegenangebot) über den gesamten Eingaberaum ausschließen:
//
//   1. Ein Gegenangebot liegt nie unter dem eigenen Angebot.
//   2. Ein Gegenangebot hebt nie über 1,06 × Forderung an.
//   3. Keine Ratsche: unverändertes Angebot -> identisches Ergebnis, beliebig oft.
//   4. Das Verdikt "es liegt nicht am Geld" tritt im vorgesehenen Band tatsächlich auf.
//   5. Alle vier Punkte werden über einen RAUM geprüft (Traits × Teamkontext × Vertrag ×
//      Angebotsverhältnis), nicht an drei Handbeispielen.
//
// buildContractNegotiationPreview ist eine reine Funktion (keine DB/Netzwerk-Seiteneffekte,
// nur deterministische Hashes über Save/Season/Team/Spieler) — die Suite braucht daher keinen
// Persistence-Bootstrap und bleibt schnell trotz der großen Eingabematrix.

import { describe, expect, it } from "vitest";

import type { ContractShape, Player, Team, TeamIdentity } from "@/lib/data/olyDataTypes";
import { buildContractNegotiationPreview } from "@/lib/market/contract-negotiation-preview";
import { makePlayer, makeTeam, makeTeamIdentity } from "./_fixtures/game-entity-fixtures";

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

const TEAM: Team = makeTeam({ teamId: "A-A", cash: 120 });

type PlayerVariant = {
  label: string;
  traitsPositive: string[];
  traitsNegative: string[];
};

// Deckt beide Persönlichkeits-Schwellen-Gruppen ab (mercenary, diva/egomaniac, beide, keine)
// plus zwei W-relevante Traits (loyal, ambitious) — genug Spreizung, um K und persReq/persRej
// über den Raum zu variieren, ohne die Matrix zu sprengen.
const PLAYER_VARIANTS: PlayerVariant[] = [
  { label: "neutral", traitsPositive: [], traitsNegative: [] },
  { label: "mercenary", traitsPositive: ["Mercenary"], traitsNegative: [] },
  { label: "diva", traitsPositive: ["Diva"], traitsNegative: [] },
  { label: "egomaniac", traitsPositive: [], traitsNegative: ["Egomaniac"] },
  { label: "mercenary+egomaniac", traitsPositive: ["Mercenary"], traitsNegative: ["Egomaniac"] },
  { label: "loyal", traitsPositive: ["Loyal"], traitsNegative: [] },
  { label: "ambitious", traitsPositive: ["Ambitious"], traitsNegative: [] },
];

const IDENTITY_VARIANTS: Array<{ label: string; identity: TeamIdentity }> = [
  {
    label: "harsh",
    identity: makeTeamIdentity({
      teamId: "A-A",
      harmony: 2,
      manners: 2,
      cooperation: 2,
      ambition: 2,
      finances: 2,
      boardConfidence: 2,
      popularity: 2,
    }),
  },
  {
    label: "friendly",
    identity: makeTeamIdentity({
      teamId: "A-A",
      harmony: 9,
      manners: 9,
      cooperation: 9,
      ambition: 9,
      finances: 9,
      boardConfidence: 9,
      popularity: 9,
    }),
  },
];

const CONTRACT_VARIANTS: Array<{ length: number; shape: ContractShape }> = [
  { length: 1, shape: "balanced" },
  { length: 3, shape: "front_loaded" },
  { length: 5, shape: "back_loaded" },
];

const PRIOR_BAD_EXPERIENCE_VARIANTS = [false, true];
const SCOUTING_LEVEL_VARIANTS = [0, 6];

// 0.50 .. 1.60 in 0.05-Schritten — deckt Absage-Band, Mittelbereich und Zusage-Band ab.
const OFFER_RATIOS = Array.from({ length: 23 }, (_, index) => roundMoney(0.5 + index * 0.05));

type PreviewContext = {
  label: string;
  player: Player;
  identity: TeamIdentity;
  contractLength: number;
  contractShape: ContractShape;
  priorBadExperience: boolean;
  scoutingLevel: number;
};

function buildContexts(): PreviewContext[] {
  const contexts: PreviewContext[] = [];
  for (const variant of PLAYER_VARIANTS) {
    for (const identityVariant of IDENTITY_VARIANTS) {
      for (const contract of CONTRACT_VARIANTS) {
        for (const priorBadExperience of PRIOR_BAD_EXPERIENCE_VARIANTS) {
          for (const scoutingLevel of SCOUTING_LEVEL_VARIANTS) {
            contexts.push({
              label: `${variant.label}/${identityVariant.label}/len${contract.length}-${contract.shape}/${priorBadExperience ? "bad" : "clean"}/scout${scoutingLevel}`,
              player: makePlayer({
                id: `player-${variant.label}`,
                name: `Player ${variant.label}`,
                traitsPositive: variant.traitsPositive,
                traitsNegative: variant.traitsNegative,
                salaryDemand: 100,
                displaySalary: 4,
                marketValue: 3000,
                displayMarketValue: 30,
              }),
              identity: identityVariant.identity,
              contractLength: contract.length,
              contractShape: contract.shape,
              priorBadExperience,
              scoutingLevel,
            });
          }
        }
      }
    }
  }
  return contexts;
}

function runPreview(context: PreviewContext, offeredSalary: number | null) {
  return buildContractNegotiationPreview({
    saveId: "invariant-check",
    seasonId: "season-1",
    team: TEAM,
    teamIdentity: context.identity,
    teamStrategyProfile: null,
    player: context.player,
    rosterPlayers: [],
    contractLength: context.contractLength,
    contractShape: context.contractShape,
    offeredSalary,
    scoutingLevel: context.scoutingLevel,
    priorBadExperience: context.priorBadExperience,
    seasonLabelBase: "Season 1",
  });
}

const CONTEXTS = buildContexts();

describe("verhandlung-rework invariants (docs/design/verhandlung-rework.md)", () => {
  it("sanity: the swept context matrix is non-trivial (space, not three examples)", () => {
    // 7 Trait-Varianten × 2 Identitäten × 3 Vertragskombis × 2 Bad-Experience × 2 Scouting-Level
    expect(CONTEXTS.length).toBe(7 * 2 * 3 * 2 * 2);
    expect(OFFER_RATIOS.length).toBeGreaterThanOrEqual(20);
  });

  it("1+2: a money counter-offer is never below the own offer and never raises above 1.06 × D", () => {
    let counterMoneyVerdictSeen = 0;

    for (const context of CONTEXTS) {
      const baseline = runPreview(context, null);
      const D = baseline.expectedSalary;
      if (D == null || D <= 0) {
        continue;
      }

      for (const ratio of OFFER_RATIOS) {
        const offeredSalary = roundMoney(D * ratio);
        const result = runPreview(context, offeredSalary);

        if (result.verdict !== "counter_money") {
          continue;
        }
        counterMoneyVerdictSeen += 1;

        expect(result.counterSalary, `${context.label} @ r=${ratio}`).not.toBeNull();
        const counterSalary = result.counterSalary as number;

        // Invariante 1: nie unter dem eigenen Angebot — sonst wäre es kein "Gegenangebot".
        expect(counterSalary, `${context.label} @ r=${ratio}: counter must exceed offer`).toBeGreaterThan(
          offeredSalary,
        );

        // Invariante 2 — die im Auftrag genannte Falle: "hat das Modell angehoben UND liegt
        // über der Kappe" ist die Bedingung, nicht "counter > 1.06*D" allein (ein unveränderter
        // Rückgabewert über der Kappe wäre kein Anheben und darf den Test nicht rot machen).
        // Hier IST counterSalary > offeredSalary immer wahr (siehe oben) — die Kappe muss also
        // in jedem counter_money-Fall halten.
        const hasRaised = counterSalary > offeredSalary;
        const raisedAboveCap = counterSalary > roundMoney(D * 1.06) + 0.01;
        expect(
          hasRaised && raisedAboveCap,
          `${context.label} @ r=${ratio}: counter ${counterSalary} raised above 1.06*D=${roundMoney(D * 1.06)} (offer was ${offeredSalary})`,
        ).toBe(false);
      }
    }

    // Kein falsches Grün: die Schleife muss das Band tatsächlich getroffen haben.
    expect(counterMoneyVerdictSeen).toBeGreaterThan(50);
  }, 30000);

  it("3: renegotiating with an unchanged offer yields the identical result, five times over — no ratchet", () => {
    let checkedSamples = 0;

    for (const context of CONTEXTS) {
      const baseline = runPreview(context, null);
      const D = baseline.expectedSalary;
      if (D == null || D <= 0) {
        continue;
      }

      // Ein Punkt pro Kontext reicht hier: die Ratsche war ein Verhalten des ALTEN
      // negotiateBuy() (setOfferedSalary(counterSalary)), nicht der Formel selbst — die Formel
      // ist bei gleichem (O, D, W, Traits) immer deterministisch. Der Test hält genau das fest:
      // fünf Aufrufe mit UNVERÄNDERTEM Angebot liefern fünfmal dasselbe Gegenangebot, statt der
      // alten Sequenz 4.80 → 5.18 → 5.59 → 6.04 → 6.52.
      const offeredSalary = roundMoney(D * 0.85);
      const results = Array.from({ length: 5 }, () => runPreview(context, offeredSalary));

      expect(new Set(results.map((entry) => entry.verdict)).size, context.label).toBe(1);
      expect(new Set(results.map((entry) => entry.counterSalary)).size, context.label).toBe(1);
      expect(new Set(results.map((entry) => entry.acceptChance)).size, context.label).toBe(1);
      checkedSamples += 1;
    }

    expect(checkedSamples).toBe(CONTEXTS.length);
  }, 30000);

  it("defect-1 regression: a generous offer (r=1.20) is an ACCEPT, never a raised counter (old bug: 4.00 -> 4.80 -> 5.18)", () => {
    // Reproduziert den im Entwurf (Abschnitt 3.1) benannten Ausgangsfall mit neutralem Kontext
    // (kein Trait, K nahe 0): Forderung D, Angebot 1.20*D. Alt: Gegenangebot 1.08*O > eigener
    // Anspruch. Neu: das Angebot liegt so deutlich über jeder Zusage-Schwelle, dass zugesagt wird.
    const context: PreviewContext = {
      label: "defect-1-repro",
      player: makePlayer({
        id: "player-defect-1",
        name: "Defect One",
        salaryDemand: 100,
        displaySalary: 4,
        marketValue: 3000,
        displayMarketValue: 30,
      }),
      identity: makeTeamIdentity({ teamId: "A-A" }),
      contractLength: 1,
      contractShape: "balanced",
      priorBadExperience: false,
      scoutingLevel: 0,
    };
    const baseline = runPreview(context, null);
    const D = baseline.expectedSalary as number;
    const generousOffer = roundMoney(D * 1.2);

    const result = runPreview(context, generousOffer);

    expect(result.verdict).toBe("accept");
    // Der alte Bug hätte hier ein Gegenangebot über dem Angebot selbst erzeugt
    // (max(D*1.04, O*1.08) = max(4.16, 5.18) = 5.18 bei D=4.00/O=4.80).
    expect(result.counterSalary).toBeNull();
  });

  it("4: the 'reject_not_about_money' verdict (offer above pride cap, below the money threshold) actually occurs", () => {
    // Konstruiert den vorgesehenen Fall statt ihn nur zu hoffen: niedriger Wechselwille W
    // (priorBadExperience senkt W um 14) UND beide Trait-Schwellen (mercenary + egomaniac), denn
    // dort ist R_money - P am größten (siehe Herleitung im Kommentar von
    // verhandlung-rework.md-Abschnitt 2.3 — persReq/persRej und die Stolz-Kappen-Erhöhung
    // bewegen sich sonst im Gleichschritt und das Band [P, R_money) kann leer werden).
    const context: PreviewContext = {
      label: "reject-not-about-money-repro",
      player: makePlayer({
        id: "player-reject-not-about-money",
        name: "Reject Not About Money",
        traitsPositive: ["Mercenary"],
        traitsNegative: ["Egomaniac"],
        salaryDemand: 100,
        displaySalary: 4,
        marketValue: 3000,
        displayMarketValue: 30,
      }),
      identity: makeTeamIdentity({
        teamId: "A-A",
        harmony: 2,
        manners: 2,
        cooperation: 2,
        ambition: 2,
        popularity: 2,
        finances: 2,
        boardConfidence: 2,
      }),
      contractLength: 1,
      contractShape: "balanced",
      priorBadExperience: true,
      scoutingLevel: 0,
    };

    const baseline = runPreview(context, null);
    expect(baseline.prideCapSalary).not.toBeNull();
    expect(baseline.moneyThresholdSalary).not.toBeNull();
    expect(baseline.acceptThresholdSalary).not.toBeNull();
    const prideCap = baseline.prideCapSalary as number;
    const moneyThreshold = baseline.moneyThresholdSalary as number;
    const acceptThreshold = baseline.acceptThresholdSalary as number;
    // Regel-Reihenfolge (Abschnitt 2.2): r >= R_full gewinnt VOR r >= R_money. Ist K negativ
    // (R_full < R_money), reicht das Band für Regel 4 nur bis R_full, nicht bis R_money — sonst
    // würde Regel 2 (Zusage) schon vorher greifen. Die echte obere Grenze ist also
    // min(R_money, R_full) in Geld.
    const bandUpperBound = Math.min(moneyThreshold, acceptThreshold);

    // Voraussetzung für das Band: die Konstruktion muss P < min(R_money, R_full) tatsächlich
    // erreichen.
    expect(prideCap, "band [P, min(R_money, R_full)) must be non-empty for this scenario").toBeLessThan(
      bandUpperBound,
    );

    const offeredSalary = roundMoney((prideCap + bandUpperBound) / 2);
    const result = runPreview(context, offeredSalary);

    expect(result.verdict).toBe("reject_not_about_money");

    // Über den gesamten Raum: das Band tritt nicht nur im Handkonstrukt auf, sondern auch beim
    // groben Sweep aus den anderen Tests — als zusätzliche, nicht-blockierende Bestätigung.
    let sweepHits = 0;
    for (const sweepContext of CONTEXTS) {
      const sweepBaseline = runPreview(sweepContext, null);
      const D = sweepBaseline.expectedSalary;
      if (D == null || D <= 0) continue;
      for (const ratio of OFFER_RATIOS) {
        const sweepResult = runPreview(sweepContext, roundMoney(D * ratio));
        if (sweepResult.verdict === "reject_not_about_money") {
          sweepHits += 1;
        }
      }
    }
    expect(sweepHits).toBeGreaterThan(0);
  }, 30000);

  it("verdict is always one of the six documented outcomes when the preview is not blocked", () => {
    const validVerdicts = new Set([
      "accept",
      "counter_conditions",
      "counter_money",
      "reject_not_about_money",
      "reject_lowball",
      "reject_affront",
    ]);

    for (const context of CONTEXTS.slice(0, 20)) {
      const baseline = runPreview(context, null);
      const D = baseline.expectedSalary;
      if (D == null || D <= 0) continue;
      for (const ratio of [0.6, 0.9, 1.0, 1.1, 1.3]) {
        const result = runPreview(context, roundMoney(D * ratio));
        expect(validVerdicts.has(result.verdict as string), `${context.label} @ r=${ratio}`).toBe(true);
      }
    }
  });

  it("the affront rule overrides the band verdict to reject_affront, independent of the offer ratio", () => {
    const context: PreviewContext = {
      label: "affront-repro",
      player: makePlayer({
        id: "player-affront",
        name: "Affront Player",
        salaryDemand: 100,
        displaySalary: 4,
        marketValue: 3000,
        displayMarketValue: 30,
      }),
      identity: makeTeamIdentity({ teamId: "A-A" }),
      contractLength: 1,
      contractShape: "balanced",
      priorBadExperience: false,
      scoutingLevel: 0,
    };
    const baseline = runPreview(context, null);
    const D = baseline.expectedSalary as number;

    // Selbst ein sehr grosszuegiges Angebot wird abgelehnt, wenn der Affront-Flag gesetzt ist —
    // die Ueberschreibung ist bewusst UNBEDINGT (Abschnitt 4.3: Vertrauensbruch statt Verhandlung).
    const result = buildContractNegotiationPreview({
      saveId: "invariant-check",
      seasonId: "season-1",
      team: TEAM,
      teamIdentity: context.identity,
      teamStrategyProfile: null,
      player: context.player,
      rosterPlayers: [],
      contractLength: context.contractLength,
      contractShape: context.contractShape,
      offeredSalary: roundMoney(D * 1.3),
      scoutingLevel: context.scoutingLevel,
      priorBadExperience: context.priorBadExperience,
      affrontRetreat: true,
      seasonLabelBase: "Season 1",
    });

    expect(result.verdict).toBe("reject_affront");
    expect(result.warnings).toContain("retreat_after_counter_affront");
  });
});
