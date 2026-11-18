import type { GameFlowStep } from "@/lib/foundation/game-flow-controller";

/**
 * EINE Quelle für den Taktgeber im Regieband (18.11., App-Rahmen modern): die Pflichtschritte des
 * Spieltagsablaufs mit Haken/Rot/Gelb und die KRITISCHEN Punkte, bei denen die Leertaste nicht weitergeht.
 *
 * Aufgebaut auf dem, was es schon gab: `buildGameFlowState().steps` (Schritte, Blocker, Warnungen) und die
 * offenen Inbox-Einträge der Stufe „critical“ (Einsatzliste unvollständig, Pflicht-Minuskarte, Verletzter
 * aufgestellt, Kasse unter null …). Rein berechnend; die Sprünge reicht der Aufrufer als Funktionen herein.
 */
export type TaktSchrittStatus = "erledigt" | "jetzt" | "offen" | "rot" | "gelb";

export type TaktSchritt = {
  id: string;
  label: string;
  detail?: string;
  status: TaktSchrittStatus;
  /** Ziel zum Springen (Sprungziel der Anzeige); fehlt bei erledigten Schritten. */
  sprung?: () => void;
};

export type TaktPlan = {
  schritte: TaktSchritt[];
  /** Hält den Spieltag auf: Leertaste geht dann NICHT weiter, sondern zeigt diese Punkte. */
  kritisch: TaktSchritt[];
};

export type TaktInboxEintrag = {
  id: string;
  title: string;
  detail: string;
  severity: "critical" | "warning" | "info";
  sprung: () => void;
};

export const LEERER_TAKT_PLAN: TaktPlan = { schritte: [], kritisch: [] };

export function baueTaktPlan(input: {
  steps: GameFlowStep[];
  currentStepId: string;
  formatGrund: (grund: string) => string;
  sprungZuSchritt: (schritt: GameFlowStep) => () => void;
  inbox: TaktInboxEintrag[];
}): TaktPlan {
  const aktuellerIndex = input.steps.findIndex((schritt) => schritt.stepId === input.currentStepId);
  const schritte: TaktSchritt[] = [];
  const kritisch: TaktSchritt[] = [];

  input.steps.forEach((schritt, index) => {
    if (schritt.optional && schritt.status !== "warning" && schritt.status !== "blocked" && index !== aktuellerIndex) return;
    const istJetzt = schritt.stepId === input.currentStepId;
    const blockiert = schritt.status === "blocked" || (schritt.blockers.length > 0 && schritt.status !== "completed");
    const status: TaktSchrittStatus =
      schritt.status === "completed"
        ? "erledigt"
        : blockiert
          ? "rot"
          : schritt.status === "warning" || schritt.optional || schritt.warnings.length > 0
            ? "gelb"
            : istJetzt
              ? "jetzt"
              : "offen";
    const gruende = (blockiert ? schritt.blockers : schritt.warnings).map(input.formatGrund).join(" · ");
    const eintrag: TaktSchritt = {
      id: `schritt:${schritt.stepId}`,
      label: schritt.label,
      detail: gruende || undefined,
      status,
      sprung: status === "erledigt" ? undefined : input.sprungZuSchritt(schritt),
    };
    schritte.push(eintrag);
    // Rot zählt nur, wenn es JETZT oder schon vorher dran war — spätere Schritte sind naturgemäß noch zu.
    if (status === "rot" && (aktuellerIndex < 0 || index <= aktuellerIndex)) kritisch.push(eintrag);
  });

  for (const item of input.inbox) {
    if (item.severity === "info") continue;
    const eintrag: TaktSchritt = {
      id: `inbox:${item.id}`,
      label: item.title,
      detail: item.detail,
      status: item.severity === "critical" ? "rot" : "gelb",
      sprung: item.sprung,
    };
    schritte.push(eintrag);
    if (item.severity === "critical") kritisch.push(eintrag);
  }

  return { schritte, kritisch };
}

export type LeertasteEntscheidung = "ignorieren" | "weiter" | "ablauf-zeigen" | "springen";

/**
 * Was ein Druck auf die Leertaste tut. Nicht auslösen: Eingabefelder, Dialoge, Ansichten mit eigener Leertaste
 * (Arena: Pause) und laufende Aktionen. Sonst: ohne kritische Punkte weiter; mit kritischen Punkten erst den
 * Ablauf zeigen, beim zweiten Druck zum ersten kritischen Punkt springen.
 */
export function entscheideLeertaste(input: {
  textZiel: boolean;
  dialogOffen: boolean;
  eigeneLeertaste: boolean;
  deaktiviert: boolean;
  anzahlKritisch: number;
  ablaufOffen: boolean;
}): LeertasteEntscheidung {
  if (input.textZiel || input.dialogOffen || input.eigeneLeertaste || input.deaktiviert) return "ignorieren";
  if (input.anzahlKritisch === 0) return "weiter";
  return input.ablaufOffen ? "springen" : "ablauf-zeigen";
}
