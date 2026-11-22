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
  /** Ein kurzer Satz, WARUM der Schritt wichtig ist (Review 22.11., für Franky und Ramona ohne Chris). */
  warum?: string;
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

/**
 * Der „Warum“-Satz je Schritt des Spieltagsablaufs. Nur Aussagen, die im Spiel gelten (CLAUDE.md, Konzeptdokus):
 * Duellpunkte 2/1/0, Pflicht-Minuskarten, Vorstandsfreigabe, Training und Finanzen je Spieltag, Kader ab 8.
 */
export const TAKT_WARUM: Record<string, string> = {
  season_intro: "Zeigt Ziele, Gegner und Finanzlage der neuen Saison, bevor du entscheidest.",
  review_previous_season: "Zeigt, was die letzte Saison gebracht hat: Platz, Vorstandsziele und Geld.",
  apply_rewards: "Bucht Prämien und Abrechnung der Saison auf die Kasse.",
  facilities: "Gebäude zahlen aus dem Investitionstopf und bringen Einnahmen, Erholung oder Trainingsfortschritt.",
  player_development: "Zeigt, wer sich entwickelt hat und wer an seine Grenze kommt.",
  sell_players: "Verkaufserlöse darfst du nur im Rahmen der Vorstandsfreigabe wieder ausgeben.",
  buy_players: "Der Kader braucht mindestens 8 Spieler; Käufe sind durch Transfertopf und Vorstandsfreigabe begrenzt.",
  set_training: "Training wirkt je Spieltag, aber nur in die Richtung, die du wählst.",
  prepare_season: "Setzt Tabelle, Einsatzlisten und Formkarten für die neue Saison zurück.",
  start_matchday_1: "Danach läuft die Saison: zwei Disziplinen je Spieltag.",
  scouting_facilities: "Mehr Scouting zeigt echte Werte statt grober Bereiche — wichtig vor jedem Kauf.",
  choose_sponsor: "Der Sponsor bringt ein festes Saisonbudget und stellt dir ein Ziel.",
  review_last_matchday: "Zeigt, wie der letzte Spieltag ausging und wer sich verletzt hat.",
  check_training: "Training läuft je Spieltag weiter; Verletzte trainieren nicht.",
  finalize_transfers: "Erst danach stehen deine Formkarten für den Spieltag fest.",
  set_lineup: "Wer auf welchem Platz steht, entscheidet das Duell: Eignung, Platzrolle und Belastung zählen.",
  assign_formcards: "Karten geben Bonus oder Malus je Disziplin; Pflicht-Minuskarten müssen bis Saisonende gelegt sein.",
  confirm_lineup: "Nur bestätigte Einsatzlisten gehen in den Spieltag.",
  open_arena: "Hier siehst du die Duelle deines Teams.",
  run_reveal: "Die Auswertung bucht Punkte, Spieler-PP, Form, Moral und Erschöpfung.",
  review_matchday_results: "Sieg bringt 2 Punkte, Remis 1, Niederlage 0 — hier siehst du, wie jedes Duell ausging.",
  open_season_standings: "Zeigt deinen Platz in der Liga und den Abstand zu Aufstieg und Abstieg.",
  matchday_facilities: "Gebäude kannst du auch zwischen den Spieltagen ausbauen, wenn die Kasse es erlaubt.",
  advance_to_next_matchday: "Schließt den Spieltag ab: Gehälter und Einnahmen werden je Spieltag gebucht.",
};

export const LEERER_TAKT_PLAN: TaktPlan = { schritte: [], kritisch: [] };

export function baueTaktPlan(input: {
  steps: GameFlowStep[];
  currentStepId: string;
  formatGrund: (grund: string) => string;
  sprungZuSchritt: (schritt: GameFlowStep) => () => void;
  inbox: TaktInboxEintrag[];
  /**
   * Ist in dieser Saison schon ein Spieltag gewertet? Vor Spieltag 1 gibt es keinen „letzten Spieltag“, den man prüfen
   * könnte: der Schritt `review_last_matchday` entfällt dann (er stünde sonst ewig offen).
   */
  hatGespielt?: boolean;
}): TaktPlan {
  const aktuellerIndex = input.steps.findIndex((schritt) => schritt.stepId === input.currentStepId);
  const schritte: TaktSchritt[] = [];
  const kritisch: TaktSchritt[] = [];

  input.steps.forEach((schritt, index) => {
    if (schritt.stepId === "review_last_matchday" && input.hatGespielt === false) return;
    if (schritt.optional && schritt.status !== "warning" && schritt.status !== "blocked" && index !== aktuellerIndex) return;
    const istJetzt = schritt.stepId === input.currentStepId;
    // Rot (hält auf) gilt nur für den aktuellen und frühere Schritte; spätere sind naturgemäß noch zu.
    const blockiert =
      (aktuellerIndex < 0 || index <= aktuellerIndex) &&
      (schritt.status === "blocked" || (schritt.blockers.length > 0 && schritt.status !== "completed"));
    const status: TaktSchrittStatus =
      schritt.status === "completed"
        ? "erledigt"
        : blockiert
          ? "rot"
          : schritt.status === "warning" || schritt.optional || (schritt.warnings.length > 0 && index <= aktuellerIndex)
            ? "gelb"
            : istJetzt
              ? "jetzt"
              : "offen";
    const gruende = (status === "rot" ? schritt.blockers : status === "gelb" ? schritt.warnings : []).map(input.formatGrund).join(" · ");
    const eintrag: TaktSchritt = {
      id: `schritt:${schritt.stepId}`,
      label: schritt.label,
      detail: gruende || undefined,
      warum: TAKT_WARUM[schritt.stepId],
      status,
      sprung: status === "erledigt" ? undefined : input.sprungZuSchritt(schritt),
    };
    schritte.push(eintrag);
    if (status === "rot") kritisch.push(eintrag);
  });

  for (const item of input.inbox) {
    if (item.severity === "info") continue;
    /**
     * DIESELBE MELDUNG NUR EINMAL: „Lineup fehlt“ (Inbox, kritisch) und der Schritt „Einsatzliste setzen“ sagen dasselbe.
     * Gibt es zu einem Inbox-Eintrag über die Einsatzliste schon einen offenen Lineup-Schritt, wird DIESER Schritt rot
     * (bei kritischem Eintrag) und trägt den Grund; ein zweiter Eintrag entsteht nicht.
     */
    if (/lineup|einsatzliste/i.test(item.title)) {
      const vorhanden = schritte.find((x) => x.id.startsWith("schritt:") && /lineup/i.test(x.id) && x.status !== "erledigt");
      if (vorhanden) {
        if (item.severity === "critical" && vorhanden.status !== "rot") {
          vorhanden.status = "rot";
          vorhanden.detail = vorhanden.detail ?? item.detail ?? undefined;
          kritisch.push(vorhanden);
        }
        continue;
      }
    }
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
