/**
 * ERGEBNISSKALA E1 IN DER ENGINE (18.11., lib/resolve/ergebnis-skala.ts, docs/design/ergebnisskala-18-11.md).
 *
 * Nachlauf EINER Disziplin in `legacy-matchday-resolve-engine.ts`, NACHDEM die Team-Zeilen (Ausgang,
 * 2/1/0, Pod-Platz, Marge) und die Spieler-PP feststehen. Er aendert NUR die Anzeige-/Tiebreaker-Groessen
 * `verhaeltnis`, `ergebnisNormiert`, `miniDmPod.wert` und `margeM90` (die verwendete Bezugsgroesse) --
 * nie `teamPoints`, `rank`, `outcome`, Pod-Platz oder Spieler-PP. Wer gewinnt, bleibt also, was der
 * Motor bzw. die Bruecke entschieden hat.
 *
 * Eingaben je Zeile:
 *   - Ausgang: aus dem Vorzeichen des schon gebuchten Verhaeltnisses (das alte D ist fuer jeden Sieg >= 1,
 *     fuer jedes Remis 0, s. `berechneVerhaeltnisBetrag()`); bei Pods der Platz.
 *   - Marge: `marge` (Duell: |Seitenstand-Differenz|; Pod: Abstand zum naechstbesseren Platz).
 *   - Leistung: mittlere Spieler-PP der Seite (`pointsAwarded` der persistierten Spielerzeilen, also
 *     dieselbe Zahl, die Ledger und Anzeige sehen).
 */
import type { DisciplineTeamResolvePreview } from "@/lib/resolve/legacy-matchday-resolve-types";
import { berechneDuellErgebnisE1, berechnePodErgebnisE1, type PodAnkerVariante } from "@/lib/resolve/ergebnis-skala";

type SpielerZeile = { teamId: string; disciplineSide?: string | null; pointsAwarded?: number | null };

function mittel(werte: readonly number[]): number | null {
  if (werte.length === 0) return null;
  return werte.reduce((a, b) => a + b, 0) / werte.length;
}

export function wendeErgebnisSkalaE1An(input: {
  teamResults: DisciplineTeamResolvePreview[];
  spielerZeilen: readonly SpielerZeile[];
  disciplineId: string;
  playerCount: number | null | undefined;
  /** Battlefield: Anker-Variante des Spieltag-Formats (`orte3` = altes Format, alte Anker). */
  podVariante?: PodAnkerVariante;
}): void {
  const ppJeSeite = new Map<string, number[]>();
  for (const z of input.spielerZeilen) {
    const pp = typeof z.pointsAwarded === "number" && Number.isFinite(z.pointsAwarded) ? z.pointsAwarded : 0;
    const k = `${z.teamId}::${z.disciplineSide ?? ""}`;
    const liste = ppJeSeite.get(k) ?? [];
    liste.push(pp);
    ppJeSeite.set(k, liste);
  }
  const leistung = (teamId: string, seite: string | null | undefined) => mittel(ppJeSeite.get(`${teamId}::${seite ?? ""}`) ?? []);

  // DUELLE (Arena und PPS-Duell-Bruecke).
  for (const zeile of input.teamResults) {
    if (zeile.miniDmPod || typeof zeile.verhaeltnis !== "number" || !zeile.opponentTeamId) continue;
    const gegner = input.teamResults.find((x) => x.teamId === zeile.opponentTeamId && x.disciplineSide === zeile.disciplineSide) ?? null;
    const outcome = zeile.verhaeltnis > 0 ? "win" : zeile.verhaeltnis < 0 ? "loss" : "draw";
    const e1 = berechneDuellErgebnisE1({
      disciplineId: input.disciplineId,
      playerCount: input.playerCount,
      outcome,
      marge: typeof zeile.marge === "number" ? zeile.marge : 0,
      seiten: zeile.duellSeiten ?? null,
      leistungEigen: leistung(zeile.teamId, zeile.disciplineSide),
      leistungGegner: gegner ? leistung(gegner.teamId, gegner.disciplineSide) : null,
      variante: input.podVariante,
    });
    zeile.verhaeltnis = e1.verhaeltnis;
    zeile.ergebnisNormiert = e1.ergebnis;
    zeile.margeM90 = e1.bezug;
    zeile.ergebnisSkala = "e1";
  }

  // VIERERGRUPPEN (Mini-DM, Battlefield, Bahn-Pods): je Pod einmal, Plaetze aus der Wertung.
  const pods = new Map<string, DisciplineTeamResolvePreview[]>();
  for (const zeile of input.teamResults) {
    if (!zeile.miniDmPod) continue;
    const k = `${zeile.miniDmPod.podId}::${zeile.disciplineSide}`;
    const liste = pods.get(k) ?? [];
    liste.push(zeile);
    pods.set(k, liste);
  }
  for (const liste of pods.values()) {
    const sortiert = [...liste].sort((a, b) => (a.miniDmPod!.platz ?? 0) - (b.miniDmPod!.platz ?? 0));
    const e1 = berechnePodErgebnisE1({
      disciplineId: input.disciplineId,
      playerCount: input.playerCount,
      podVariante: input.podVariante,
      sortiert: sortiert.map((z, i) => ({
        luecke: i === 0 ? 0 : typeof z.marge === "number" ? z.marge : 0,
        leistung: leistung(z.teamId, z.disciplineSide),
      })),
    });
    sortiert.forEach((z, i) => {
      z.miniDmPod = { ...z.miniDmPod!, wert: e1.werte[i] ?? z.miniDmPod!.wert };
      z.verhaeltnis = e1.verhaeltnisse[i] ?? 0;
      z.ergebnisSkala = "e1";
    });
  }
}
