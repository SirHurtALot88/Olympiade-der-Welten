/**
 * DIE SPERREN EINES FREIWILLIGEN KREDITS (22.11., docs/design/kredite-modern-22-11.md Abschnitt 3 und 4; Finanzkonzept V2 Abschnitt 6):
 *
 *   Obergrenze    Schuldendienst (Raten je Saison aller Kredite) hoechstens 20 % der Planeinnahmen. Ohne Planeinnahmen (noch kein
 *                 Sponsorvertrag) gibt es keine Bezugsgroesse, dann greift die Grenze nicht.
 *   Sparauflage   In der Stufe "Sparauflage" des Vorstands (Freigabe unter 60 %) gibt es keinen freiwilligen Kredit.
 *
 * EINE Funktion fuer Seite (Sperre am Knopf, Balken) und Server (Route `POST /api/finance/loan/originate`): was die Seite sperrt, lehnt der
 * Server ab. Der Notkredit (`emergency`) umgeht beide Sperren, weil er unfreiwillig ist. Die KI hat in `ai-loan-decision-service` ihre eigene,
 * strengere Grenze (10 % der Planeinnahmen) und bleibt damit unter dieser Obergrenze.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { getTeamAnnualLoanInstallment } from "@/lib/finance/loan-service";
import { erwarteterSponsorFuerPlanung } from "@/lib/finance/sponsor-erwartung";
import { resolveVorstandFreigabe } from "@/lib/finance/vorstand-budgetfreigabe";

export const SCHULDENDIENST_OBERGRENZE = 0.2;
export const SCHULDENDIENST_KI_GRENZE = 0.1;

export type KreditSperreGrund = "schuldendienst_obergrenze" | "vorstand_sparauflage";

export type KreditPruefung = {
  ok: boolean;
  reason: KreditSperreGrund | null;
  planEinnahmen: number;
  /** Schuldendienst heute und mit dem neuen Kredit (Anteil an den Planeinnahmen, 0 ohne Planeinnahmen). */
  quoteAlt: number;
  quoteNeu: number;
  stufe: string;
  freigabeAnteil: number;
};

/** `neueJahresrate` = Rate je Saison des geplanten Kredits (Rate je Spieltag x Spieltage). */
export function pruefeKreditAufnahme(gameState: GameState, teamId: string, neueJahresrate: number): KreditPruefung {
  const plan = erwarteterSponsorFuerPlanung(gameState, teamId);
  const alt = getTeamAnnualLoanInstallment(gameState, teamId);
  const freigabe = resolveVorstandFreigabe(gameState, teamId);
  const quoteAlt = plan > 0 ? alt / plan : 0;
  const quoteNeu = plan > 0 ? (alt + Math.max(0, neueJahresrate)) / plan : 0;
  let reason: KreditSperreGrund | null = null;
  if (freigabe.stufe === "sparauflage") reason = "vorstand_sparauflage";
  else if (plan > 0 && quoteNeu > SCHULDENDIENST_OBERGRENZE + 1e-9) reason = "schuldendienst_obergrenze";
  return { ok: reason == null, reason, planEinnahmen: plan, quoteAlt, quoteNeu, stufe: freigabe.stufe, freigabeAnteil: freigabe.anteil };
}

export const KREDIT_SPERRE_TEXT: Record<KreditSperreGrund, string> = {
  schuldendienst_obergrenze: "Über 20 % der Planeinnahmen: der Vorstand verlangt erst Verkäufe.",
  vorstand_sparauflage: "Sparauflage des Vorstands: kein freiwilliger Kredit.",
};
