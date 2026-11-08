/**
 * Formations-Geometrie der Einsatzliste (Ebene A, Mini-Feld): `lib/lineups/formation/`.
 *
 * 1. Vollständigkeit: alle 20 Disziplinen × k = 1…6 — jede Rolle, die `resolveSlotRoleShortId`
 *    liefert (dieselbe Funktion wie der Arena-Adapter), hat einen Platz auf dem Feld.
 * 2. Drift-Wächter (Architektur 2.4, Stufe 1): die `MOTOR_*`-Tabellen sind Zeichen für Zeichen
 *    aus `public/mockups/battle-mode.engine.js` abgeschrieben. Dieser Test liest den Motor als
 *    Text und vergleicht. Ändert jemand den Motor, wird er rot — die Einsatzliste kann dann nie
 *    einen Platz zeigen, den der Kampf nicht hält.
 * 3. Ebene C (Feinjustierung) nur dort, wo das Arena-Chassis Regler liest.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  FEINJUSTIERUNG_DISZIPLINEN,
  FORMATIONS_DISZIPLINEN,
  MOTOR_BASKETBALL_ROLLE_SLOT,
  MOTOR_BASKETBALL_SLOTS,
  MOTOR_BFFFA_ROLLEN_ORT,
  MOTOR_BF_ORT_NAMEN,
  MOTOR_HEBEN_ROLLEN,
  MOTOR_HOCKEY_SLOTS,
  MOTOR_KICKER_SLOTS,
  MOTOR_MINI_DM_SLOT_STELLE,
  MOTOR_QB_SLOTS,
  MOTOR_REIHEN_X_VERSATZ,
  MOTOR_RENNPLAENE,
  MOTOR_SLOT_ZUSATZ,
  MOTOR_TORWART_SLOTS,
  findeFormation,
  formationFuerSeite,
  hatFeinjustierung,
  legeFormation,
  rollenIdsFuerSeite,
} from "@/lib/lineups/formation";
import { resolveSlotRoleShortId, resolveSlotRoleShortIdsForSlotCount } from "@/lib/lineups/matchday-slot-roles";
import { officialDisciplineWeightOrder } from "@/lib/player-generator/official-discipline-weights";

const ENGINE = readFileSync(join(process.cwd(), "public/mockups/battle-mode.engine.js"), "utf8");
const REGISTRY_QUELLE = readFileSync(join(process.cwd(), "lib/lineups/formation/formation-registry.ts"), "utf8");

/** Rohtext des Literals hinter `const NAME=` (balancierte Klammern). */
function motorBlockText(name: string): string {
  const start = ENGINE.indexOf(`const ${name}=`);
  if (start < 0) throw new Error(`${name} nicht im Motor gefunden`);
  const auf = ENGINE.slice(start).search(/[[{]/) + start;
  const oeffner = ENGINE[auf]!;
  const schliesser = oeffner === "{" ? "}" : "]";
  let tiefe = 0;
  let ende = auf;
  for (let i = auf; i < ENGINE.length; i += 1) {
    if (ENGINE[i] === oeffner) tiefe += 1;
    else if (ENGINE[i] === schliesser) {
      tiefe -= 1;
      if (tiefe === 0) {
        ende = i;
        break;
      }
    }
  }
  return ENGINE.slice(auf, ende + 1);
}

/** Wie `motorBlockText`, ohne `//`-Kommentare, ausgewertet. */
function motorLiteral(name: string): unknown {
  const text = motorBlockText(name)
    .split("\n")
    .map((zeile) => zeile.replace(/\/\/.*$/, ""))
    .join("\n");
  return new Function(`return (${text});`)();
}

function motorSet(name: string): string[] {
  const treffer = ENGINE.match(new RegExp(`const ${name}=new Set\\((\\[[^\\]]*\\])\\)`));
  if (!treffer) throw new Error(`${name} nicht im Motor gefunden`);
  return new Function(`return ${treffer[1]};`)() as string[];
}

describe("Formations-Geometrie: Vollständigkeit über alle 20 Disziplinen", () => {
  it("jede offizielle Disziplin hat eine eigene Formation (keinen Rückfall)", () => {
    for (const disziplin of officialDisciplineWeightOrder) {
      expect(FORMATIONS_DISZIPLINEN, disziplin).toContain(disziplin);
      expect(findeFormation(disziplin).rueckfall, disziplin).toBe(false);
    }
    expect(new Set(FORMATIONS_DISZIPLINEN).size).toBe(FORMATIONS_DISZIPLINEN.length);
  });

  it("jede Rolle hat für k = 1…6 einen Platz im Feld, keine zwei Marken liegen aufeinander", () => {
    for (const disziplin of officialDisciplineWeightOrder) {
      for (let k = 1; k <= 6; k += 1) {
        const formation = formationFuerSeite(disziplin, k);
        expect(formation.plaetze, `${disziplin} k=${k}`).toHaveLength(k);
        const gesehen = new Set<string>();
        formation.plaetze.forEach((platz, index) => {
          expect(platz.slotIndex).toBe(index);
          // Keine Rolle fällt auf die Reserve-Leiste: jede hat eine echte Gruppe bzw. einen Index-Platz.
          expect(platz.beleg, `${disziplin} k=${k} ${platz.rolleId}`).not.toBe("keine Geometrie für diese Rolle hinterlegt");
          for (const wert of [platz.x, platz.y, platz.gegner?.x ?? 0.5, platz.gegner?.y ?? 0.5]) {
            expect(wert).toBeGreaterThanOrEqual(0);
            expect(wert).toBeLessThanOrEqual(1);
          }
          const schluessel = `${platz.x}|${platz.y}`;
          expect(gesehen.has(schluessel), `${disziplin} k=${k}: doppelter Platz ${schluessel}`).toBe(false);
          gesehen.add(schluessel);
          if (platz.verbindlichkeit !== "darstellung") expect(platz.beleg.length).toBeGreaterThan(0);
        });
      }
    }
  });

  it("die Rollen-Id je Slot ist dieselbe wie im Arena-Adapter (resolveSlotRoleShortId mit Kadergröße)", () => {
    for (const disziplin of officialDisciplineWeightOrder) {
      for (let k = 1; k <= 6; k += 1) {
        const ids = rollenIdsFuerSeite(disziplin, k);
        expect(ids).toEqual(resolveSlotRoleShortIdsForSlotCount(disziplin, null, k));
        ids.forEach((id, index) => expect(id).toBe(resolveSlotRoleShortId(disziplin, null, index, k)));
      }
    }
  });

  it("Battlefield wechselt die Rollen mit der Kadergröße — das Feld folgt (k=2: Siege Core Mitte, Morale Anchor Heim)", () => {
    const zwei = formationFuerSeite("battlefield", 2);
    expect(zwei.plaetze.map((p) => [p.rolleId, p.gruppenLabel, p.verbindlichkeit])).toEqual([
      ["siegecore", "Mitte", "start"],
      ["moraleanchor", "Nord", "start"],
    ]);
  });

  it("unbekannte Disziplin bricht nie, sondern fällt auf die Reihenfolge-Leiste", () => {
    const formation = legeFormation({ disziplinId: "tauziehen", rollen: ["a", null, "c"] });
    expect(formation.rueckfall).toBe(true);
    expect(formation.plaetze.map((p) => p.verbindlichkeit)).toEqual(["darstellung", "darstellung", "darstellung"]);
    expect(legeFormation({ disziplinId: null, rollen: [] }).plaetze).toEqual([]);
  });

  it("Feldformen nach Chassis: Reihen, Halbfeld, Eis, Football, Strecke, Wand, Staffel, Leiste, Bogen, Tafel, Ring, Domination", () => {
    const feld = (d: string) => findeFormation(d).definition.feld;
    expect(feld("tdm")).toBe("reihen");
    expect(feld("mini-dm")).toBe("reihen");
    expect(feld("battlefield")).toBe("domination");
    expect(feld("basketball")).toBe("halbfeld");
    expect(feld("hockey")).toBe("eis");
    expect(feld("football")).toBe("football");
    for (const d of ["spurt", "time-trial", "takeshis-castle"]) expect(feld(d)).toBe("strecke");
    expect(feld("climbing")).toBe("wand");
    expect(feld("staffel")).toBe("staffel");
    for (const d of ["gewichtheben", "tennis", "fechten", "speed-schach", "showcase", "i-spy"]) expect(feld(d)).toBe("leiste");
    expect(feld("eiskunstlauf")).toBe("bogen");
    expect(feld("wettessen")).toBe("tafel");
    expect(feld("breaking")).toBe("ring");
  });

  it("TDM: Vanguard/Hold Line vorn, Shotcaller/Rally Point hinten; Gegner gespiegelt", () => {
    const tdm = formationFuerSeite("tdm", 6);
    const x = (rolle: string) => tdm.plaetze.find((p) => p.rolleId === rolle)!.x;
    expect(x("vanguard")).toBe(x("holdline"));
    expect(x("vanguard")).toBeGreaterThan(x("breaker"));
    expect(x("breaker")).toBeGreaterThan(x("shotcaller"));
    for (const platz of tdm.plaetze) expect(platz.gegner).toEqual({ x: Math.round((1 - platz.x) * 1000) / 1000, y: platz.y });
  });

  it("Basketball: Rim Pressure am nächsten am Korb, Floor General zentral, Bedingung „alle besetzt“", () => {
    const bb = formationFuerSeite("basketball", 6);
    const p = (rolle: string) => bb.plaetze.find((entry) => entry.rolleId === rolle)!;
    expect(p("rimpressure").y).toBe(0.5);
    expect(p("floorgeneral").y).toBe(0.5);
    expect(p("rimpressure").x).toBeLessThan(p("floorgeneral").x);
    expect(p("perimeter").y).not.toBe(p("clutchshot").y);
    expect(bb.definition.bedingung?.art).toBe("alle-besetzt");
  });

  it("Hockey: nur der Torwart ist Motor, Feldspieler sind Darstellung; Football: QB und Kicker sind Motor", () => {
    for (const platz of formationFuerSeite("hockey", 6).plaetze) {
      expect(platz.verbindlichkeit).toBe(platz.rolleId === "goaltender" ? "motor" : "darstellung");
    }
    for (const platz of formationFuerSeite("football", 6).plaetze) {
      expect(platz.verbindlichkeit).toBe(["quarterback", "kickerpunter"].includes(platz.rolleId!) ? "motor" : "darstellung");
    }
  });

  it("Bahn: Plätze nach Rennplan-Tempo (Spurt „Von vorn“ vor „Windschatten“ vor „Schlusssprint“), Climbing nach Höhe", () => {
    const spurt = formationFuerSeite("spurt", 6);
    const sx = (rolle: string) => spurt.plaetze.find((p) => p.rolleId === rolle)!.x;
    expect(sx("blockstart")).toBeGreaterThan(sx("lanecontrol"));
    expect(sx("lanecontrol")).toBeGreaterThan(sx("topspeed"));
    expect(spurt.plaetze.find((p) => p.rolleId === "blockstart")!.gruppenLabel).toBe("Von vorn");
    const climbing = formationFuerSeite("climbing", 6);
    const cy = (rolle: string) => climbing.plaetze.find((p) => p.rolleId === rolle)!.y;
    expect(cy("dynamicmove")).toBeLessThan(cy("routereader"));
    expect(cy("routereader")).toBeLessThan(cy("paceclimber"));
  });

  it("Staffel ist Motor (Bein = Slot), die Bühnen sind Darstellung (Befund: Motor paart nach Kaderliste)", () => {
    const staffel = formationFuerSeite("staffel", 6);
    expect(staffel.plaetze.every((p) => p.verbindlichkeit === "motor")).toBe(true);
    expect(staffel.plaetze.map((p) => p.x)).toEqual([...staffel.plaetze.map((p) => p.x)].sort((a, b) => a - b));
    expect(staffel.plaetze[5]!.zeile).toContain("Schlussläufer");
    for (const d of ["gewichtheben", "tennis", "fechten", "speed-schach", "breaking", "wettessen", "showcase", "eiskunstlauf", "i-spy"]) {
      expect(formationFuerSeite(d, 6).plaetze.every((p) => p.verbindlichkeit === "darstellung"), d).toBe(true);
    }
  });

  it("Gegner nur dort auf dem Feld, wo eine Paarung/Gegenseite gezeichnet werden darf", () => {
    for (const d of ["hockey", "football", "battlefield", "showcase", "eiskunstlauf", "i-spy"]) {
      expect(formationFuerSeite(d, 6).plaetze.every((p) => p.gegner === null), d).toBe(true);
    }
    for (const d of ["tdm", "basketball", "spurt", "fechten", "wettessen", "breaking", "climbing"]) {
      expect(formationFuerSeite(d, 6).plaetze.every((p) => p.gegner !== null), d).toBe(true);
    }
  });
});

describe("Ebene C (Feinjustierung) nur bei Arena-Chassis mit Reglern", () => {
  it("genau TDM, Mini-DM und Battlefield — die übrigen 17 haben keine", () => {
    expect([...FEINJUSTIERUNG_DISZIPLINEN].sort()).toEqual(["battlefield", "mini-dm", "tdm"]);
    expect(officialDisciplineWeightOrder.filter((d) => hatFeinjustierung(d))).toHaveLength(3);
    expect(officialDisciplineWeightOrder.filter((d) => !hatFeinjustierung(d))).toHaveLength(17);
    expect(hatFeinjustierung(null)).toBe(false);
  });

  it("deckt sich mit istArena() im Motor (= die obersten Schlüssel von ARENA_ART)", () => {
    expect(ENGINE).toContain("const istArena=(d)=>!!ARENA_ART[d];");
    const block = motorBlockText("ARENA_ART")
      .split("\n")
      .map((zeile) => zeile.replace(/\/\/.*$/, ""))
      .join("\n");
    const schluessel = [...block.matchAll(/^ {4}"?([\w-]+)"?\s*:\s*\{/gm)].map((t) => t[1]);
    expect([...new Set(schluessel)].sort()).toEqual([...FEINJUSTIERUNG_DISZIPLINEN].sort());
  });
});

describe("Drift-Wächter: MOTOR_*-Tabellen gegen battle-mode.engine.js", () => {
  it("SLOT_ZUSATZ (Reihe, Befehl, Position)", () => {
    expect(motorLiteral("SLOT_ZUSATZ")).toEqual(MOTOR_SLOT_ZUSATZ);
  });

  it("homeFor(): Spaltenabstände der drei Reihen", () => {
    const treffer = ENGINE.match(/const cols=\[side===0\?MID-(\d+):MID\+\d+,side===0\?MID-(\d+):MID\+\d+,side===0\?MID-(\d+):MID\+\d+\]/);
    expect(treffer).not.toBeNull();
    expect(treffer!.slice(1, 4).map(Number)).toEqual([...MOTOR_REIHEN_X_VERSATZ]);
  });

  it("Mini-DM-Rückfall: SLOT_STELLE-Reihenfolge = Rollenreihenfolge der Generator-Quelle", () => {
    expect(resolveSlotRoleShortIdsForSlotCount("mini-dm", null, 6)).toEqual([...MOTOR_MINI_DM_SLOT_STELLE]);
    expect(ENGINE).toContain("Math.min(2,Math.floor((SLOT_STELLE[id]||0)/2))");
  });

  it("BASKETBALL_ROLLE_SLOT, SLOTS (Basketball) und SLOTS_HOCKEY", () => {
    expect(motorLiteral("BASKETBALL_ROLLE_SLOT")).toEqual(MOTOR_BASKETBALL_ROLLE_SLOT);
    expect(motorLiteral("SLOTS")).toEqual(MOTOR_BASKETBALL_SLOTS);
    expect(motorLiteral("SLOTS_HOCKEY")).toEqual(MOTOR_HOCKEY_SLOTS);
  });

  it("TORWART_SLOTS, QB_SLOTS, KICKER_SLOTS", () => {
    expect(motorSet("TORWART_SLOTS")).toEqual([...MOTOR_TORWART_SLOTS]);
    expect(motorSet("QB_SLOTS")).toEqual([...MOTOR_QB_SLOTS]);
    expect(motorSet("KICKER_SLOTS")).toEqual([...MOTOR_KICKER_SLOTS]);
  });

  it("planJeSlot und Rennplan-Labels/Tempi der fünf Bahn-Disziplinen", () => {
    const bloecke = [...ENGINE.matchAll(/planJeSlot:\{([^}]*)\}/g)].map((treffer) => ({
      tabelle: new Function(`return {${treffer[1]}};`)() as Record<string, string>,
      fenster: ENGINE.slice(Math.max(0, treffer.index! - 3000), treffer.index!),
    }));
    for (const [disziplin, motor] of Object.entries(MOTOR_RENNPLAENE)) {
      const block = bloecke.find((b) => JSON.stringify(b.tabelle) === JSON.stringify(motor.planJeSlot));
      expect(block, `planJeSlot für ${disziplin} nicht (mehr) im Motor`).toBeDefined();
      for (const [planId, plan] of Object.entries(motor.plaene)) {
        const treffer = block!.fenster.match(new RegExp(`${planId}\\s*:\\s*\\{label:"([^"]+)",\\s*tempo:([\\d.]+)`));
        expect(treffer, `${disziplin}.${planId}`).not.toBeNull();
        expect(treffer![1]).toBe(plan.label);
        expect(Number(treffer![2])).toBe(plan.tempo);
        expect(block!.fenster).toContain(plan.text);
      }
    }
    // Und umgekehrt: kein Motor-Block, den die Registry nicht kennt.
    for (const block of bloecke) {
      expect(Object.values(MOTOR_RENNPLAENE).some((m) => JSON.stringify(m.planJeSlot) === JSON.stringify(block.tabelle))).toBe(true);
    }
  });

  it("BF_ORT_NAMEN, BFFFA_ROLLEN_ORT, HEBEN_ROLLEN", () => {
    expect(motorLiteral("BF_ORT_NAMEN")).toEqual([...MOTOR_BF_ORT_NAMEN]);
    expect(motorLiteral("BFFFA_ROLLEN_ORT")).toEqual(MOTOR_BFFFA_ROLLEN_ORT);
    expect(motorLiteral("HEBEN_ROLLEN")).toEqual(MOTOR_HEBEN_ROLLEN);
  });

  it("die Registry hat keinen einzigen Import (nichts wirkt zurück in Resolve/KI/Arena)", () => {
    expect(REGISTRY_QUELLE).not.toMatch(/^\s*import\s/m);
  });
});
