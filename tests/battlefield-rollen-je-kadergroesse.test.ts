/**
 * BATTLEFIELD: EIGENE ROLLEN JE KADERGROESSE (Task #198, Chris 27.10.).
 *
 * Chris, woertlich: „Und vllt solltest du bei 2 Spielern dann nicht commander und spotter als
 * slot nehmen. Wichtig ist ja dass die gewichtungen passen, es kann bei 2 spielern ja andere
 * slots geben als bei 6 spielern! auch DAS ist erlaubt".
 *
 * Vorher schnitt `buildGeneratedSlotRoles` jede Disziplin mit `slice(0, k)` aus EINER Liste —
 * bei 2 Spielern also immer Commander + Spotter. Jetzt hat Battlefield je k eine eigene
 * Zusammensetzung (ROLE_THEME_IDS_BY_SLOT_COUNT). Diese Datei haelt fest:
 *   1. die Zusammensetzung je k (k=2 ohne Commander/Spotter, k=6 alle sechs),
 *   2. dass die Gewichte stimmen: der Mittelwert der Slot-Profile ist bei JEDEM k exakt die
 *      Matrix (die gesperrte Eignungsmatrix wird nicht angefasst, nur durchgereicht),
 *   3. dass die kurze Rollenkennung je Index der Kadergroesse folgt (Aufstellung -> Arena),
 *   4. dass alle anderen Disziplinen unveraendert `slice(0, k)` bleiben,
 *   5. dass der Motor dieselben Rollen und Profile spielt (BATTLEFIELD_SLOTS_JE_K),
 *   6. dass der Adapter Aufstellung -> Arena die Kadergroesse mitnimmt.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { GameState } from "@/lib/data/olyDataTypes";
import { buildArenaAufstellung } from "@/lib/foundation/battle-arena/arena-aufstellung-adapter";
import {
  hasSlotCountSpecificRoles,
  resolveSlotRoleShortId,
  resolveSlotRoleShortIdsForSlotCount,
  resolveSlotRolesForDiscipline,
} from "@/lib/lineups/matchday-slot-roles";
import { resolveDisciplineWeightProfile } from "@/lib/player-generator/spiel-eignung-overrides";

const ERWARTET: Record<number, string[]> = {
  2: ["siegecore", "moraleanchor"],
  3: ["siegecore", "fieldcontrol", "moraleanchor"],
  4: ["siegecore", "fieldcontrol", "commander", "moraleanchor"],
  5: ["siegecore", "fieldcontrol", "commander", "disruptor", "moraleanchor"],
  6: ["siegecore", "fieldcontrol", "commander", "spotter", "disruptor", "moraleanchor"],
};
const KS = [2, 3, 4, 5, 6] as const;

const kurz = (roleId: string, k: number) => roleId.replace(`battlefield-${k}-`, "");

describe("Battlefield: eigene Rollenzusammensetzung je Kadergroesse", () => {
  it.each(KS)("k=%i hat die festgelegte Zusammensetzung, k verschiedene Rollen", (k) => {
    const rollen = resolveSlotRolesForDiscipline("battlefield", "Battlefield", k);
    expect(rollen.map((r) => kurz(r.roleId, k))).toEqual(ERWARTET[k]);
    expect(new Set(rollen.map((r) => r.roleId)).size).toBe(k);
  });

  it("bei 2 Spielern stehen weder Commander noch Spotter auf dem Platz (vorher: genau diese zwei)", () => {
    const ids = resolveSlotRolesForDiscipline("battlefield", "Battlefield", 2).map((r) => kurz(r.roleId, 2));
    expect(ids).not.toContain("commander");
    expect(ids).not.toContain("spotter");
  });

  it("bei 6 Spielern stehen alle sechs Battlefield-Rollen auf dem Platz", () => {
    const ids = resolveSlotRolesForDiscipline("battlefield", "Battlefield", 6).map((r) => kurz(r.roleId, 6));
    expect([...ids].sort()).toEqual(["commander", "disruptor", "fieldcontrol", "moraleanchor", "siegecore", "spotter"]);
  });

  it.each(KS)("k=%i: der Mittelwert der Slot-Profile ist exakt die Matrix (die Gewichte passen)", (k) => {
    const basis = resolveDisciplineWeightProfile("battlefield");
    const rollen = resolveSlotRolesForDiscipline("battlefield", "Battlefield", k);
    for (const [attribut, gewicht] of Object.entries(basis)) {
      if (!gewicht) continue;
      const mittel = rollen.reduce((s, r) => s + ((r.slotWeightProfile as Record<string, number>)[attribut] ?? 0), 0) / k;
      expect(mittel, `${attribut} bei k=${k}`).toBeCloseTo(gewicht, 1);
    }
  });

  it.each(KS)("k=%i: jeder Slot ist ein echtes Profil (kein Attribut negativ, Fokusattribute ueber der Matrix)", (k) => {
    const basis = resolveDisciplineWeightProfile("battlefield") as Record<string, number>;
    for (const rolle of resolveSlotRolesForDiscipline("battlefield", "Battlefield", k)) {
      const profil = rolle.slotWeightProfile as Record<string, number>;
      for (const wert of Object.values(profil)) expect(wert).toBeGreaterThanOrEqual(0);
      expect(profil[rolle.majorPositiveAttribute]).toBeGreaterThan(basis[rolle.majorPositiveAttribute]! - 0.01);
    }
  });

  it.each(KS)("k=%i: resolveSlotRoleShortId folgt mit Kadergroesse derselben Reihenfolge wie die Aufstellung", (k) => {
    const lang = resolveSlotRolesForDiscipline("battlefield", "Battlefield", k).map((r) => kurz(r.roleId, k));
    const kurzIds = Array.from({ length: k }, (_, i) => resolveSlotRoleShortId("battlefield", null, i, k));
    expect(kurzIds).toEqual(lang);
    expect(resolveSlotRoleShortIdsForSlotCount("battlefield", null, k)).toEqual(lang);
    expect(resolveSlotRoleShortId("battlefield", null, k, k)).toBeNull();
  });

  it("ohne Kadergroesse gilt fuer Battlefield die Sechser-Zusammensetzung (die einzige, die jeden Index kennt)", () => {
    const ohne = Array.from({ length: 6 }, (_, i) => resolveSlotRoleShortId("battlefield", null, i));
    expect(ohne).toEqual(ERWARTET[6]);
  });

  it("andere Disziplinen bleiben unveraendert slice(0, k) — mit und ohne Kadergroesse dieselbe Rolle je Index", () => {
    expect(hasSlotCountSpecificRoles("battlefield", null)).toBe(true);
    for (const d of ["tdm", "mini-dm", "hockey", "basketball", "football"]) {
      expect(hasSlotCountSpecificRoles(d, null)).toBe(false);
      const sechs = resolveSlotRolesForDiscipline(d, d, 6).map((r) => r.roleId.replace(`${d}-6-`, ""));
      for (const k of KS) {
        const rollen = resolveSlotRolesForDiscipline(d, d, k).map((r) => r.roleId.replace(`${d}-${k}-`, ""));
        expect(rollen).toEqual(sechs.slice(0, k));
        for (let i = 0; i < k; i++) {
          expect(resolveSlotRoleShortId(d, null, i, k)).toBe(resolveSlotRoleShortId(d, null, i));
        }
      }
    }
    // Hockeys Torwart-Regel haengt an slice(0, k): bei 2 kein Torwart, ab 3 immer.
    expect(resolveSlotRolesForDiscipline("hockey", "hockey", 2).some((r) => r.roleId.endsWith("goaltender"))).toBe(false);
    expect(resolveSlotRolesForDiscipline("hockey", "hockey", 3).some((r) => r.roleId.endsWith("goaltender"))).toBe(true);
  });
});

describe("Battlefield: der Motor spielt dieselben Rollen (BATTLEFIELD_SLOTS_JE_K)", () => {
  const motor = readFileSync(
    join(fileURLToPath(new URL(".", import.meta.url)), "..", "public", "mockups", "battle-mode.engine.js"),
    "utf8",
  );
  const start = motor.indexOf("const BATTLEFIELD_SLOTS_JE_K={");
  const ende = motor.indexOf("\n  };", start);
  const block = motor.slice(start, ende);

  it("der generierte Block existiert", () => {
    expect(start).toBeGreaterThan(0);
  });

  it.each(KS)("k=%i: dieselben Rollen-Ids in derselben Reihenfolge und dieselben Profile wie die Aufstellung", (k) => {
    const kBlock = block.slice(block.indexOf(`    ${k}:[`), k < 6 ? block.indexOf(`    ${k + 1}:[`) : undefined);
    const eintraege = [...kBlock.matchAll(/\{id:"([a-z]+)".*?profil:\{([^}]*)\}\}/g)];
    const rollen = resolveSlotRolesForDiscipline("battlefield", "Battlefield", k);
    expect(eintraege.map((m) => m[1])).toEqual(rollen.map((r) => kurz(r.roleId, k)));
    eintraege.forEach((m, i) => {
      const profil = Object.fromEntries(m[2]!.split(",").map((p) => p.split(":")).map(([a, v]) => [a, Number(v)]));
      for (const [attribut, wert] of Object.entries(rollen[i]!.slotWeightProfile ?? {})) {
        if (!wert) continue;
        expect(profil[attribut], `${m[1]} ${attribut} k=${k}`).toBeCloseTo(wert as number, 0);
      }
    });
  });

  it("jede der sechs Rollen hat im Motor einen Startplatz (SLOT_ZUSATZ) — keine faellt auf die Ersatzregel", () => {
    for (const id of ERWARTET[6]!) expect(motor).toMatch(new RegExp(`\\b${id}:\\{reihe:\\d,ord:"[a-z]+",pos:\\d\\}`));
  });

  it("die Domination kennt fuer jede Rolle eine Eroberung von mindestens 1 (keine Rolle ist wirkungslos)", () => {
    // kpRolleVon() klemmt erobern/neutral/halten auf >= 1; der Test liest die Klemme selbst, damit
    // eine kuenftige Rollentabelle mit erobern:0 hier nicht unbemerkt durchrutscht.
    expect(motor).toContain("const erobern=Math.max(1,r.erobern??1);");
    expect(motor).toContain("neutral:Math.max(1,r.neutral??erobern), halten:Math.max(1,r.halten??1)");
  });
});

describe("Aufstellung -> Arena nimmt die Kadergroesse mit", () => {
  function spielstand(eintraege: Array<{ slotIndex: number; playerId: string }>, side: "d1" | "d2" = "d1") {
    const spieler = eintraege.map((e) => ({ id: e.playerId, name: `Name ${e.playerId}` }));
    return {
      players: spieler,
      rosters: spieler.map((s) => ({ id: `roster-${s.id}`, teamId: "t1", playerId: s.id })),
      seasonState: {
        lineupDrafts: [
          {
            lineupId: "l1",
            saveId: "s1",
            seasonId: "season-1",
            matchdayId: "md-1",
            teamId: "t1",
            status: "draft",
            entries: eintraege.map((e) => ({
              disciplineId: "battlefield",
              disciplineSide: side,
              slotIndex: e.slotIndex,
              playerId: e.playerId,
              activePlayerId: `roster-${e.playerId}`,
            })),
          },
        ],
      },
    } as unknown as GameState;
  }

  it("2 Spieler: Index 0/1 sind Siege Core und Morale Anchor (nicht Commander/Spotter)", () => {
    const aufstellung = buildArenaAufstellung(spielstand([{ slotIndex: 0, playerId: "a" }, { slotIndex: 1, playerId: "b" }]), "t1", "md-1");
    expect(aufstellung["Name a"]).toEqual({ d: "battlefield", slot: "siegecore" });
    expect(aufstellung["Name b"]).toEqual({ d: "battlefield", slot: "moraleanchor" });
  });

  it("6 Spieler: derselbe Index 1 ist Field Control, Index 5 Morale Anchor", () => {
    const aufstellung = buildArenaAufstellung(
      spielstand(Array.from({ length: 6 }, (_, i) => ({ slotIndex: i, playerId: `p${i}` })), "d2"),
      "t1",
      "md-1",
    );
    expect(Object.values(aufstellung).map((e) => e.slot)).toEqual(ERWARTET[6]);
  });

  it("eine Luecke vorn aendert die Kadergroesse nicht: Slots 3+4 (von 5) bleiben Disruptor und Morale Anchor", () => {
    const aufstellung = buildArenaAufstellung(spielstand([{ slotIndex: 3, playerId: "x" }, { slotIndex: 4, playerId: "y" }]), "t1", "md-1");
    expect(aufstellung["Name x"]?.slot).toBe("disruptor");
    expect(aufstellung["Name y"]?.slot).toBe("moraleanchor");
  });
});
