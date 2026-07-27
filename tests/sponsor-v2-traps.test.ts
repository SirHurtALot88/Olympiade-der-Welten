/**
 * P2 — der Fallen-Test als automatisierter Test im Repo.
 *
 * Eine FALLE ist eine Karte, die von einer anderen Karte derselben Angebotsliste
 * RANG-KONDITIONAL stochastisch dominiert wird: bei JEDEM erreichbaren Endrang ist ihre
 * Auszahlungsverteilung schwaecher. Wer sie waehlt, hat sich nicht fuer ein anderes Risiko
 * entschieden, sondern schlicht falsch — und kann das an der Karte nicht erkennen.
 *
 * DREI DINGE, DIE DIESER TEST ANDERS MACHT ALS FRUEHERE PRUEFUNGEN IM REPO:
 *
 *  1. FOSD statt elementweisem Vergleich. Elementweise Dominanz impliziert stochastische Dominanz
 *     nur, wenn P(Dominator) >= P(Dominierter) — sonst entstehen systematisch False Positives,
 *     seit jede Klausel ihr eigenes P traegt.
 *  2. ALLE 32 Endraenge statt eines +-11-Korridors. Die Engine kennt keinen Korridor; ein Team mit
 *     Erwartungsrang 30 kann den Titel holen. Der Korridor hat nachweislich Fallen ERZEUGT, die es
 *     nicht gibt (49 Artefaktpaare bei Erwartungsrang 32).
 *  3. VAKUUM-WAECHTER. "0 Fallen" ist wertlos, wenn die verglichenen Karten keine Streuung mehr
 *     haben — eine ueber den ganzen Bereich konstante Karte kann per Definition weder dominieren
 *     noch dominiert werden. Frueher entstanden genau so gruene Haken. Der Test zaehlt kollabierte
 *     Karten mit und schlaegt an, wenn es welche gibt.
 */
import { describe, expect, it } from "vitest";

import {
  SPONSOR_V2_CLAUSES, SPONSOR_V2_CURVES, SPONSOR_V2_PROFILES, SPONSOR_V2_RARITIES,
  sponsorV2Calibrate, sponsorV2IsCollapsed, sponsorV2Lotteries, sponsorV2ParamsOf,
  sponsorV2FosdAtLeast, sponsorV2FosdStrictly,
  type SponsorV2Card, type SponsorV2Lottery,
} from "@/lib/sponsor/sponsor-v2-model";

type Built = { name: string; lot: SponsorV2Lottery[] };

function build(card: SponsorV2Card, expectedRank: number): Built {
  const params = sponsorV2ParamsOf(card);
  const cal = sponsorV2Calibrate(card, expectedRank, params);
  return {
    name: `${card.rarity}/${card.curve.name}/${card.profile.name}/${card.clause.name}`,
    lot: sponsorV2Lotteries(card, expectedRank, cal, params),
  };
}

function trapsIn(rows: Built[]): string[] {
  const out: string[] = [];
  for (const a of rows) {
    const dominator = rows.find((b) => b.name !== a.name
      && a.lot.every((la, i) => sponsorV2FosdAtLeast(b.lot[i]!, la))
      && a.lot.some((la, i) => sponsorV2FosdStrictly(b.lot[i]!, la)));
    if (dominator) out.push(`${a.name}  ≪  ${dominator.name}`);
  }
  return out;
}

/** Die Erwartungsraenge, an denen geprueft wird — Stuetzstellen inklusive beider Extreme. */
const PROBE_RANKS = [1, 5, 12, 18, 24, 28, 32];

describe("sponsor v2 — Fallenfreiheit ueber den Kombinationsraum", () => {
  it(
    "keine Kurve-x-Klausel-Kombination wird von einer anderen dominiert",
    { timeout: 300_000 },
    () => {
      const found: string[] = [];
      let collapsed = 0, cards = 0;
      for (const expectedRank of PROBE_RANKS) {
        const rows: Built[] = [];
        for (const curve of SPONSOR_V2_CURVES) {
          for (const clause of SPONSOR_V2_CLAUSES) {
            rows.push(build({ rarity: "magisch", profile: SPONSOR_V2_PROFILES[0]!, curve, clause }, expectedRank));
          }
        }
        cards += rows.length;
        collapsed += rows.filter((r) => sponsorV2IsCollapsed(r.lot)).length;
        for (const t of trapsIn(rows)) found.push(`E${expectedRank}: ${t}`);
      }
      // VAKUUM-WAECHTER: der Haken zaehlt nur, wenn ueberhaupt etwas zu dominieren war.
      expect(cards).toBe(PROBE_RANKS.length * SPONSOR_V2_CURVES.length * SPONSOR_V2_CLAUSES.length);
      expect(collapsed).toBe(0);
      expect(found.slice(0, 5)).toEqual([]);
    },
  );

  it(
    "die fuenf Verteilungsprofile dominieren sich nicht gegenseitig und sind nicht identisch",
    { timeout: 300_000 },
    () => {
      const found: string[] = [];
      let twins = 0;
      for (const rarity of SPONSOR_V2_RARITIES) {
        for (const expectedRank of [1, 16, 32]) {
          const rows = SPONSOR_V2_PROFILES.map((profile) => build(
            { rarity, profile, curve: SPONSOR_V2_CURVES[2]!, clause: SPONSOR_V2_CLAUSES[8]! }, expectedRank));
          for (let i = 0; i < rows.length; i += 1) {
            for (let j = i + 1; j < rows.length; j += 1) {
              const gap = Math.max(...rows[i]!.lot.flatMap((l, k) =>
                l.outcomes.map((o, m) => Math.abs(o.v - rows[j]!.lot[k]!.outcomes[m]!.v))));
              // "ausgewogen" und "zielschwer" teilen die Formleiter bewusst; sie unterscheiden sich
              // nur im specialShare. Alle anderen Paare muessen sich sichtbar unterscheiden.
              if (gap < 1e-6) twins += 1;
            }
          }
          for (const t of trapsIn(rows)) found.push(`${rarity} E${expectedRank}: ${t}`);
        }
      }
      expect(twins).toBe(0);
      expect(found.slice(0, 5)).toEqual([]);
    },
  );

  it(
    "auch ueber die Rarities hinweg entsteht keine Falle innerhalb einer Liste",
    { timeout: 300_000 },
    () => {
      // Die Angebotserzeugung mischt Rarities in EINER Liste. Der Umsetzungsplan haelt fest, dass
      // die EV-Paritaet nur INNERHALB einer Rarity gilt — eine hoehere Rarity ist absichtlich mehr
      // wert. Geprueft wird deshalb, dass innerhalb JEDER Rarity Fallenfreiheit herrscht; ueber
      // Rarities hinweg waere Dominanz kein Defekt, sondern die Definition von "seltener ist besser".
      const found: string[] = [];
      for (const rarity of SPONSOR_V2_RARITIES) {
        for (const expectedRank of [4, 16, 30]) {
          const rows = SPONSOR_V2_CURVES.map((curve, i) => build(
            { rarity, profile: SPONSOR_V2_PROFILES[i % SPONSOR_V2_PROFILES.length]!, curve,
              clause: SPONSOR_V2_CLAUSES[i % SPONSOR_V2_CLAUSES.length]! }, expectedRank));
          for (const t of trapsIn(rows)) found.push(`${rarity} E${expectedRank}: ${t}`);
        }
      }
      expect(found.slice(0, 5)).toEqual([]);
    },
  );
});
