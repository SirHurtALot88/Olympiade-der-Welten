export type GmStoryTone = "new" | "hot" | "watch" | "stable";

export type GmStoryInput = {
  source?: string | null;
  previousGmId?: string | null;
  dismissalReason?: string | null;
  boardPressure?: number | null;
  boardConfidenceValue?: number | null;
};

export type GmStoryView = {
  tone: GmStoryTone;
  label: string;
  detail: string;
  statusLabel: string;
  isHotSeat: boolean;
  isReplacement: boolean;
};

function formatNumber(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatGmDismissalReason(reason: string | null | undefined) {
  if (!reason) return null;
  if (reason === "low_board_confidence") return "Board Confidence zu niedrig";
  if (reason === "high_board_pressure") return "Board-Druck eskaliert";
  if (reason === "board_pressure") return "Board-Druck eskaliert";
  if (reason === "objective_failure") return "Boardziele verfehlt";
  if (reason === "season_reset") return "Season-Neustart";
  return reason.replaceAll("_", " ");
}

export function getGmStoryTone(input: GmStoryInput): GmStoryTone {
  if (input.source === "board_replacement" || input.previousGmId || input.dismissalReason) return "new";
  if ((input.boardPressure ?? 0) >= 8) return "hot";
  if ((input.boardConfidenceValue ?? 100) <= 45 || (input.boardPressure ?? 0) >= 6) return "watch";
  return "stable";
}

export function getGmStoryLabel(input: GmStoryInput) {
  const tone = getGmStoryTone(input);
  if (tone === "new") return "Board-Wechsel";
  if (tone === "hot") return "Hot Seat";
  if (tone === "watch") return "Board schaut hin";
  return "Mandat stabil";
}

export function getGmStoryDetail(input: GmStoryInput) {
  const dismissal = formatGmDismissalReason(input.dismissalReason);
  if (input.source === "board_replacement" || input.previousGmId || dismissal) {
    return dismissal ? `Neuer GM nach: ${dismissal}.` : "Board hat nach der Season neu besetzt.";
  }
  if ((input.boardPressure ?? 0) >= 8) {
    return `Druck ${formatNumber(input.boardPressure, 1)}: nächste Zielauswertung kann den Job kosten.`;
  }
  if ((input.boardConfidenceValue ?? 100) <= 45 || (input.boardPressure ?? 0) >= 6) {
    return `Confidence ${formatNumber(input.boardConfidenceValue, 1)}, Druck ${formatNumber(input.boardPressure, 1)}: Ergebnisse müssen sichtbarer werden.`;
  }
  return `Confidence ${formatNumber(input.boardConfidenceValue, 1)}: Board vertraut dem Stil.`;
}

export function buildGmStoryView(input: GmStoryInput): GmStoryView {
  const tone = getGmStoryTone(input);
  const isHotSeat = (input.boardPressure ?? 0) >= 8;
  const isReplacement = input.source === "board_replacement" || Boolean(input.previousGmId || input.dismissalReason);
  return {
    tone,
    label: getGmStoryLabel(input),
    detail: getGmStoryDetail(input),
    statusLabel: isReplacement ? "Neu verpflichtet" : isHotSeat ? "Hot Seat" : tone === "watch" ? "Unter Beobachtung" : "Aktiv",
    isHotSeat,
    isReplacement,
  };
}
