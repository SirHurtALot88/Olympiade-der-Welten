/**
 * DIE SPERREN EINES FREIWILLIGEN KREDITS (22.11., docs/design/kredite-modern-22-11.md Abschnitt 3 und 4; Finanzkonzept V2 Abschnitt 6):
 *
 *   Obergrenze    Schuldendienst (Raten je Saison aller Kredite) hoechstens 20 % der Planeinnahmen. Ohne Planeinnahmen (noch kein
 *                 Sponsorvertrag) gibt es keine Bezugsgroesse, dann greift die Grenze nicht.
 *   Sparauflage   In der Stufe "Sparauflage" des Vorstands (Freigabe unter 60 %) gibt es keinen freiwilligen Kredit.
 *
 * EINE Funktion fuer Seite (Sperre am Knopf, Balken), Server (Route `POST /api/finance/loan/originate`) UND KI (`resolveAiLoanDecision` fragt sie
 * vor jedem `shouldBorrow: true`): was die Seite sperrt, lehnt der Server ab, und die KI leiht nie darueber. Eine gemeinsame Grenze von 20 %
 * fuer Mensch und KI. Nur der Notkredit der Bank (`emergency`) umgeht beide Sperren, weil er unfreiwillig ist.
 */
import type { GameState } from "@/lib/data/olyDataTypes";
import { getTeamAnnualLoanInstallment } from "@/lib/finance/loan-service";
import { erwarteterSponsorFuerPlanung } from "@/lib/finance/sponsor-erwartung";
import { resolveVorstandFreigabe } from "@/lib/finance/vorstand-budgetfreigabe";

export const SCHULDENDIENST_OBERGRENZE = 0.2;
/** Nur Anzeige: ab 10 % faerbt die Seite den Schuldendienst-Balken als Warnung. KEINE zweite Grenze -- gesperrt wird erst ueber 20 %, fuer Mensch und KI. */
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
