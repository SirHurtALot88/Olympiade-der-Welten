/* eslint-disable no-console */
/**
 * WAS DER FORMWUNSCH DES SPIELERS HEUTE KOSTET — nachgemessen, nicht geschaetzt.
 *
 * Jeder Spieler hat eine `shapePreference` (front_loaded / balanced / back_loaded). Sie wird
 * angezeigt („Vertragsform mag er weniger"). Die Frage vor jedem Eingriff: schlaegt sie ueberhaupt
 * auf den Preis durch, und wenn ja, wie stark?
 *
 * Der Preispfad ist eine Kette:
 *
 *   buildPlayerContractPreference(player, profile, {contractLength, contractShape})
 *      -> salaryAdjustmentPct           (+0,02 bei Formabweichung, Zeile ~679)
 *   resolveContractLengthSalaryFactor({player, contractLength, salaryPreferenceAdjustmentPct})
 *      -> Faktor auf das Basisgehalt    (clamp -0,06 .. +0,08, bei mercenary +0,04)
 *
 * Zwei Klemmen koennen den Aufschlag unterwegs auffressen:
 *   1. `clamp(salaryAdjustmentPct, -0.08, 0.12)` am Ende der Preference.
 *   2. `clamp(preferenceAdjustment, -0.06, +0.08 / +0.04)` im Retool-Signal.
 * Beide misst dieses Skript mit, indem es NUR den Endfaktor vergleicht.
 *
 * Gemessen wird an jedem laufenden Mehrjahresvertrag der Spielstaende: einmal mit der Form, die
 * im Vertrag steht, einmal mit der Wunschform des Spielers. Die Differenz ist das, was der Wunsch
 * heute wert ist.
 *
 * Nutzung:
 *   OLY_APP_SQLITE_PATH=/pfad/zur/kopie.sqlite npx tsx scripts/messe-vertragsform-wunsch.ts
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import type { ContractShape, GameState, Player } from "@/lib/data/olyDataTypes";
import { createPersistenceService } from "@/lib/persistence/persistence-service";
import {
  buildPlayerContractPreference,
  resolveContractLengthSalaryFactor,
  resolveContractShapeSalarySurcharge,
} from "@/lib/market/contract-negotiation-preview";

const ALLE_FORMEN: ContractShape[] = ["front_loaded", "balanced", "back_loaded"];

type Zeile = {
  save: string;
  spieler: string;
  jahre: number;
  form: ContractShape;
  wunsch: ContractShape;
  gehalt: number;
  faktorIst: number;
  faktorWunsch: number;
};

const p = createPersistenceService();
const zeilen: Zeile[] = [];

for (const eintrag of p.listSaves()) {
  const gs = p.getSaveById(eintrag.saveId)?.gameState as GameState | undefined;
  if (!gs?.rosters?.length) continue;
  const spielerNachId = new Map<string, Player>((gs.players ?? []).map((s) => [s.id, s]));
  const profilNachTeam = new Map((gs.teamStrategyProfiles ?? []).map((profil) => [profil.teamId, profil]));

  for (const rosterEintrag of gs.rosters) {
    const jahre = rosterEintrag.contractLength ?? 0;
    if (jahre < 2) continue;
    const spieler = spielerNachId.get(rosterEintrag.playerId);
    if (!spieler) continue;
    const profil = profilNachTeam.get(rosterEintrag.teamId) ?? null;
    const form: ContractShape = rosterEintrag.contractShape ?? "balanced";

    const wunschProfil = buildPlayerContractPreference(spieler, profil);
    if (!wunschProfil) continue;
    const wunsch = wunschProfil.shapePreference;

    const faktor = (gewaehlteForm: ContractShape) => {
      const preference = buildPlayerContractPreference(spieler, profil, {
        contractLength: jahre,
        contractShape: gewaehlteForm,
      });
      return resolveContractLengthSalaryFactor({
        player: spieler,
        contractLength: jahre,
        salaryPreferenceAdjustmentPct: preference?.salaryAdjustmentPct ?? 0,
      });
    };

    zeilen.push({
      save: String(eintrag.saveId).slice(-6),
      spieler: spieler.name,
      jahre,
      form,
      wunsch,
      gehalt: rosterEintrag.salary ?? 0,
      faktorIst: faktor(form),
      faktorWunsch: faktor(wunsch),
    });
  }
}

const passend = zeilen.filter((z) => z.form === z.wunsch);
const abweichend = zeilen.filter((z) => z.form !== z.wunsch);

console.log(`Mehrjahresvertraege gesamt: ${zeilen.length}`);
console.log(`  Form trifft den Wunsch:   ${passend.length}  (${Math.round((passend.length / zeilen.length) * 100)} %)`);
console.log(`  Form weicht ab:           ${abweichend.length}  (${Math.round((abweichend.length / zeilen.length) * 100)} %)`);
console.log("");

// Die entscheidende Zahl: bewegt sich der Preisfaktor ueberhaupt, wenn die Form abweicht?
const bewegt = abweichend.filter((z) => Math.abs(z.faktorIst - z.faktorWunsch) > 1e-9);
console.log(`Von den ${abweichend.length} abweichenden Vertraegen aendert die Wunschform den Preisfaktor bei: ${bewegt.length}`);
if (bewegt.length > 0) {
  const deltas = bewegt.map((z) => (z.faktorIst / z.faktorWunsch - 1) * 100);
  deltas.sort((a, b) => a - b);
  const median = deltas[Math.floor(deltas.length / 2)]!;
  console.log(
    `  Aufschlag der abweichenden Form gegenueber dem Wunsch:` +
      `  min ${deltas[0]!.toFixed(2)} %   median ${median.toFixed(2)} %   max ${deltas[deltas.length - 1]!.toFixed(2)} %`,
  );
  const euro = bewegt.reduce((summe, z) => summe + z.gehalt * (1 - z.faktorWunsch / z.faktorIst), 0);
  console.log(`  In Geld ueber alle ${bewegt.length}: ${euro.toFixed(2)} pro Saison zusammen`);
}
console.log("");

// DIE LUECKE: der KI-Schnellkauf-Pfad (transfermarkt-local-service.ts) rief
// `resolveContractLengthSalaryFactor` OHNE `salaryPreferenceAdjustmentPct` auf. Fuer jeden von der
// KI geschlossenen Vertrag war die Form damit gratis. Das misst, was der neue Aufschlag dort holt.
{
  const nurForm = abweichend.map((z) => {
    const gs = p.getSaveById(p.listSaves().find((e) => String(e.saveId).endsWith(z.save))!.saveId)?.gameState as GameState;
    const spieler = (gs.players ?? []).find((s) => s.name === z.spieler)!;
    const roster = (gs.rosters ?? []).find((r) => r.playerId === spieler.id);
    const profil = (gs.teamStrategyProfiles ?? []).find((pr) => pr.teamId === roster?.teamId) ?? null;
    const aufschlag = resolveContractShapeSalarySurcharge({
      player: spieler,
      teamStrategyProfile: profil,
      contractLength: z.jahre,
      contractShape: z.form,
    });
    const ohne = resolveContractLengthSalaryFactor({ player: spieler, contractLength: z.jahre });
    const mit = resolveContractLengthSalaryFactor({
      player: spieler,
      contractLength: z.jahre,
      salaryPreferenceAdjustmentPct: aufschlag,
    });
    return { aufschlag, prozent: (mit / ohne - 1) * 100, geld: z.gehalt * (mit / ohne - 1) };
  });
  const wirksam = nurForm.filter((e) => e.prozent > 1e-9);
  const prozente = wirksam.map((e) => e.prozent).sort((a, b) => a - b);
  console.log("NEU im KI-Schnellkauf-Pfad (nur der Form-Anteil, Laufzeit unveraendert):");
  console.log(`  Vertraege mit Aufschlag: ${wirksam.length} von ${abweichend.length} abweichenden`);
  if (prozente.length > 0) {
    console.log(
      `  Aufschlag aufs Jahresgehalt:  min ${prozente[0]!.toFixed(2)} %` +
        `   median ${prozente[Math.floor(prozente.length / 2)]!.toFixed(2)} %` +
        `   max ${prozente[prozente.length - 1]!.toFixed(2)} %`,
    );
    console.log(`  In Geld ueber alle: +${nurForm.reduce((s, e) => s + e.geld, 0).toFixed(2)} pro Saison zusammen`);
  }
  const beiTreffer = passend.slice(0, 50).map((z) => {
    const gs = p.getSaveById(p.listSaves().find((e) => String(e.saveId).endsWith(z.save))!.saveId)?.gameState as GameState;
    const spieler = (gs.players ?? []).find((s) => s.name === z.spieler)!;
    const roster = (gs.rosters ?? []).find((r) => r.playerId === spieler.id);
    const profil = (gs.teamStrategyProfiles ?? []).find((pr) => pr.teamId === roster?.teamId) ?? null;
    return resolveContractShapeSalarySurcharge({ player: spieler, teamStrategyProfile: profil, contractLength: z.jahre, contractShape: z.form });
  });
  console.log(`  Gegenprobe: Aufschlag bei Wunschtreffer (50 Stichproben) hoechstens ${Math.max(0, ...beiTreffer)}`);
}
console.log("");

// Gegenprobe an einem einzelnen Spieler: alle drei Formen nebeneinander.
const beispiel = abweichend[0];
if (beispiel) {
  console.log(`Beispiel ${beispiel.spieler} (${beispiel.jahre} Jahre, Wunsch ${beispiel.wunsch}, Vertrag ${beispiel.form}):`);
  const gs = p.getSaveById(p.listSaves().find((e) => String(e.saveId).endsWith(beispiel.save))!.saveId)?.gameState as GameState;
  const spieler = (gs.players ?? []).find((s) => s.name === beispiel.spieler)!;
  const profil = (gs.teamStrategyProfiles ?? []).find((pr) => pr.teamId === gs.rosters!.find((r) => r.playerId === spieler.id)?.teamId) ?? null;
  for (const form of ALLE_FORMEN) {
    const preference = buildPlayerContractPreference(spieler, profil, { contractLength: beispiel.jahre, contractShape: form });
    const faktor = resolveContractLengthSalaryFactor({
      player: spieler,
      contractLength: beispiel.jahre,
      salaryPreferenceAdjustmentPct: preference?.salaryAdjustmentPct ?? 0,
    });
    console.log(
      `  ${form.padEnd(12)}  salaryAdjustmentPct ${String(preference?.salaryAdjustmentPct ?? 0).padStart(7)}` +
        `   Faktor ${faktor.toFixed(4)}   Gehalt ${(beispiel.gehalt * faktor / beispiel.faktorIst).toFixed(2)}` +
        `${form === beispiel.wunsch ? "   <- Wunsch" : ""}`,
    );
  }
}
