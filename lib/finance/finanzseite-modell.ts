/**
 * Finanzseite (Finanzkonzept V2): das Lesemodell der neuen Seite. Reine Funktion auf dem Spielstand, client-sicher, kein Schreiben.
 *
 * Jede Zahl kommt aus einer Quelle, die es schon gibt (Kontoauszug, Vorstand-Freigabe, GuV-Posten des Finanz-Modells) —
 * die Seite rechnet nichts ein zweites Mal („gezeigt = gebucht“). Einheit ist C. Gehaelter stehen gross je Saison und klein je
 * Spieltag (Chris, 18.11.).
 *
 * VERLAUF: Heute bucht das Spiel Sponsor, Gehalt, Gebaeude und Kredit am Saisonende; Spieltags-Zeilen gibt es nur fuer Transfers
 * (die Taktung auf 20 Spieltage ist Stufe 4 des Konzepts). Der Verlauf zeigt deshalb Start, die gespielten Spieltage mit ihren
 * Transfer-Buchungen, die Prognose bis zum Saisonende und die Saisonabrechnung als eigenen Balken — ohne Spieltags-Posten zu erfinden.
 */

import type { GameState } from "@/lib/data/olyDataTypes";
import { erwarteteSpieltagBuchung } from "@/lib/finance/finanzen-je-spieltag-erwartung";
import { istJeSpieltagSaison, summeSpieltagBuchungen } from "@/lib/finance/finanzen-je-spieltag";
import { kreditSaisonTilgungRaten } from "@/lib/finance/kredit-raten";
import { buildTeamKontoauszug, type KontoauszugZeile, type TeamKontoauszug } from "@/lib/finance/kontoauszug";
import { berechneVorstandBudgetStand, type VorstandBudgetStand } from "@/lib/finance/vorstand-budgetfreigabe";
import type { FinancesViewModel, TeamFinancesState } from "@/lib/foundation/finances/finances-types";

export type VerlaufPunkt = {
  id: string;
  /** "Start", "1" bis "20" oder "Ende". */
  label: string;
  spieltag: number | null;
  art: "start" | "spieltag" | "ende";
  /** Kassenstand nach dieser Station. */
  kasse: number;
  /** Bewegung an dieser Station. */
  bewegung: number;
  gebucht: boolean;
  /** Die Zeilen, die zu dieser Station gehoeren (Kontoauszug). */
  zeilen: KontoauszugZeile[];
  /** Nur fuer "ende": die erwarteten Posten, wenn noch nichts gebucht ist. */
  prognosePosten?: { key: string; label: string; betrag: number }[];
};

export type FinanzLage = { titel: string; ton: "gut" | "acht" | "warn"; text: string };

export type FinanzSeiteModell = {
  teamId: string;
  teamName: string;
  saisonId: string;
  saisonNummer: number;
  spieltag: number;
  spieltageGesamt: number;
  kasse: number;
  gehaltSaison: number;
  gehaltJeSpieltag: number;
  gehaltsraten: number;
  einnahmenBisher: number;
  ausgabenBisher: number;
  guvPrognose: number | null;
  prognoseEnde: number;
  prognoseSpanne: number;
  tiefsterStand: number;
  saisonendeGebucht: boolean;
  lage: FinanzLage;
  verlauf: VerlaufPunkt[];
  kontoauszug: TeamKontoauszug;
  stand: VorstandBudgetStand;
  /** Die GuV-Posten, soweit das Finanz-Modell sie liefert. */
  finanzen: TeamFinancesState | null;
  /** Finanzen je Spieltag (22.11.): laeuft diese Saison mit Spieltagsbuchung? */
  jeSpieltag: boolean;
  /** Erwartete Nettobuchung je offenem Spieltag (nur im Modus je Spieltag, sonst 0). */
  erwartetJeSpieltag: number;
  /** Bereits je Spieltag gebuchtes Netto der Saison (Gehalt, Sponsor-Basis, Gebaeude). */
  jeSpieltagGebucht: number;
};

const r2 = (v: number) => Math.round(v * 100) / 100;

function saisonNummer(id: string): number {
  return Number(/(\d+)\s*$/.exec(id)?.[1] ?? 1);
}

function spieltagVon(gameState: GameState, matchdayId: string | null): number | null {
  if (!matchdayId) return null;
  const idx = gameState.season.matchdayIds?.indexOf(matchdayId) ?? -1;
  if (idx >= 0) return idx + 1;
  const m = /(\d+)\s*$/.exec(matchdayId);
  return m ? Number(m[1]) : null;
}

export function buildFinanzSeiteModell(gameState: GameState, teamId: string, finanzen: FinancesViewModel): FinanzSeiteModell {
  const team = gameState.teams.find((t) => t.teamId === teamId);
  const kasse = team?.cash ?? 0;
  const saisonId = gameState.season.id;
  const gesamt = Math.max(1, gameState.season.totalMatchdays ?? gameState.season.matchdayIds?.length ?? 20);
  const aktuell = Math.max(0, Math.min(gesamt, (gameState.season.currentMatchday ?? 1) - (gameState.matchdayState?.status === "resolved" ? 0 : 1)));
  const kontoauszug = buildTeamKontoauszug(gameState, teamId, saisonId);
  const stand = berechneVorstandBudgetStand(gameState, teamId);
  const f = finanzen.status === "ready" ? finanzen.team : null;

  const gehaltSaison = gameState.rosters.filter((r) => r.teamId === teamId).reduce((x, r) => x + (r.salary ?? 0), 0);
  const gehaltJeSpieltag = gehaltSaison / gesamt;
  const gehaltsraten = gehaltJeSpieltag > 0 ? Math.max(0, kasse) / gehaltJeSpieltag : 0;

  const saisonendeGebucht = (gameState.seasonState.sponsorPayoutLogs ?? []).some(
    (l) => l.teamId === teamId && l.seasonId === saisonId && l.phase === "season_end",
  );

  // Verlauf: Start -> gespielte Spieltage -> Prognose -> Ende.
  const zeilenNachSt = new Map<number, KontoauszugZeile[]>();
  const startZeilen: KontoauszugZeile[] = [];
  const endeZeilen: KontoauszugZeile[] = [];
  for (const z of kontoauszug.zeilen) {
    if (z.phase === "saisonende") endeZeilen.push(z);
    else if (z.phase === "saison") {
      const t = spieltagVon(gameState, z.matchdayId);
      if (t == null) startZeilen.push(z);
      else (zeilenNachSt.get(t) ?? zeilenNachSt.set(t, []).get(t)!).push(z);
    } else startZeilen.push(z);
  }
  const summe = (zs: KontoauszugZeile[]) => r2(zs.reduce((x, z) => x + z.betrag, 0));
  const bisherSumme = summe(kontoauszug.zeilen.filter((z) => z.phase !== "saisonende"));
  const endeSumme = summe(endeZeilen);
  const kasseStart = r2(kasse - bisherSumme - (saisonendeGebucht ? endeSumme : 0));

  const verlauf: VerlaufPunkt[] = [];
  let lauf = kasseStart;
  verlauf.push({ id: "start", label: "Start", spieltag: null, art: "start", kasse: r2(lauf + summe(startZeilen)), bewegung: summe(startZeilen), gebucht: true, zeilen: startZeilen });
  lauf = verlauf[0]!.kasse;
  for (let t = 1; t <= gesamt; t += 1) {
    const zs = zeilenNachSt.get(t) ?? [];
    const gespielt = t <= aktuell;
    lauf = r2(lauf + summe(zs));
    verlauf.push({ id: `st-${t}`, label: String(t), spieltag: t, art: "spieltag", kasse: lauf, bewegung: summe(zs), gebucht: gespielt, zeilen: zs });
  }
  // Prognose Saisonende: gebucht = Kasse ist schon drin; sonst Kasse + erwartetes GuV ohne die schon verbuchten Transfers.
  const guv = f?.guv ?? null;
  const transferNetto = f?.transfer?.net ?? 0;
  // FINANZEN JE SPIELTAG (22.11.): die GuV ist die GANZE Saison; was davon je Spieltag schon gebucht ist, steckt in der Kasse
  // und kommt am Saisonende nicht noch einmal. Die Prognose zeigt nur den Rest.
  const jeSpieltag = istJeSpieltagSaison(gameState);
  const jeSpieltagGebucht = jeSpieltag ? summeSpieltagBuchungen(gameState, teamId).cashDelta : 0;
  // KREDITRATEN JE SPIELTAG (22.11.): die GuV zaehlt nur den Zins, die Tilgung steht aber in der Kasse (gebucht) und kommt noch (offen).
  // Die ganze Saisontilgung zieht die Prognose deshalb zusaetzlich ab; ohne Raten-Saison ist es 0 und nichts aendert sich.
  const kreditTilgung = jeSpieltag && !saisonendeGebucht ? kreditSaisonTilgungRaten(gameState, teamId) : 0;
  const erwartung = saisonendeGebucht ? 0 : r2((guv ?? 0) - transferNetto - jeSpieltagGebucht - kreditTilgung);
  const prognosePosten = saisonendeGebucht
    ? undefined
    : [
        ...(f?.guvPosten ?? [])
          .filter((p) => p.counted && p.key !== "transfers" && Math.abs(p.amount) > 0.004)
          .map((p) => ({ key: p.key, label: p.label, betrag: r2(p.amount) })),
        ...(Math.abs(jeSpieltagGebucht) > 0.004
          ? [{ key: "spieltag_gebucht", label: "Schon je Spieltag gebucht", betrag: r2(-jeSpieltagGebucht) }]
          : []),
        ...(Math.abs(kreditTilgung) > 0.004 ? [{ key: "kredittilgung", label: "Kredittilgung (Bilanz, nicht GuV)", betrag: r2(-kreditTilgung) }] : []),
      ];
  const prognoseEnde = saisonendeGebucht ? kasse : r2(kasse + erwartung);
  // Gespielte Spieltage nach heute tragen die heutige Kasse fort (flach), damit die Linie bis zum Ende sichtbar bleibt.
  // Im Modus je Spieltag laeuft die Linie mit der erwarteten Spieltagsbuchung weiter (Gehalt, Sponsor-Basis, Gebaeude).
  const erwartetJeSpieltag = jeSpieltag && !saisonendeGebucht ? r2(erwarteteSpieltagBuchung(gameState, teamId).netto) : 0;
  let offenerSpieltag = 0;
  for (const p of verlauf) {
    if (p.art === "spieltag" && !p.gebucht) {
      offenerSpieltag += 1;
      p.kasse = r2(kasse + erwartetJeSpieltag * offenerSpieltag);
      p.bewegung = erwartetJeSpieltag;
    }
  }
  verlauf.push({
    id: "ende",
    label: "Ende",
    spieltag: null,
    art: "ende",
    kasse: prognoseEnde,
    bewegung: saisonendeGebucht ? endeSumme : erwartung,
    gebucht: saisonendeGebucht,
    zeilen: endeZeilen,
    prognosePosten,
  });

  const tiefsterStand = Math.min(...verlauf.map((p) => p.kasse));
  const offen = Math.max(0, gesamt - aktuell);
  const prognoseSpanne = r2(offen * 0.3);

  // ABNAHME 19.11., Fehler F8 (docs/design/abnahme-saison-19-11.md): die Lage zaehlte nur Gehaltsraten in der Kasse und hiess
  // „Solide · Kein Handlungsdruck“, waehrend dieselbe Seite eine Prognose von −89,9 C zum Saisonende zeigte (Gehalt und Apron
  // werden erst am Saisonende gebucht, ohne Sponsor fehlt die Einnahme). Eine negative Prognose, die noch nicht gebucht ist,
  // geht jetzt vor: sie ist der Handlungsdruck.
  const lage: FinanzLage =
    kasse < 0
      ? { titel: "Im Minus", ton: "warn", text: "Die Kasse ist negativ. Am Kassensturz kommt der Pflichtkredit." }
      : !saisonendeGebucht && prognoseEnde < 0
        ? {
            titel: "Saisonende im Minus",
            ton: "warn",
            text: `Die Prognose zum Saisonende liegt bei ${zahlDe(prognoseEnde)} C. Ohne Gegensteuern kommt am Kassensturz der Pflichtkredit.`,
          }
      : gehaltsraten < 1
        ? { titel: "Knapp", ton: "acht", text: "Weniger als eine Gehaltsrate Reserve. Jeder Kauf geht auf die Rate." }
        : gehaltsraten < 2
          ? { titel: "Eng", ton: "acht", text: "Eine bis zwei Gehaltsraten Reserve. Wenig Spielraum." }
          : { titel: "Solide", ton: "gut", text: "Mehr als zwei Gehaltsraten Reserve. Kein Handlungsdruck." };

  return {
    teamId,
    teamName: team?.name ?? "Dein Team",
    saisonId,
    saisonNummer: saisonNummer(saisonId),
    spieltag: aktuell,
    spieltageGesamt: gesamt,
    kasse: r2(kasse),
    gehaltSaison: r2(gehaltSaison),
    gehaltJeSpieltag: r2(gehaltJeSpieltag),
    gehaltsraten: r2(gehaltsraten),
    einnahmenBisher: kontoauszug.summeZufluss,
    ausgabenBisher: kontoauszug.summeAbfluss,
    guvPrognose: guv,
    prognoseEnde,
    prognoseSpanne,
    tiefsterStand: r2(tiefsterStand),
    saisonendeGebucht,
    lage,
    verlauf,
    kontoauszug,
    stand,
    finanzen: f,
    jeSpieltag,
    erwartetJeSpieltag,
    jeSpieltagGebucht: r2(jeSpieltagGebucht),
  };
}

function zahlDe(wert: number): string {
  return (Math.round(wert * 10) / 10).toFixed(1).replace(".", ",");
}
