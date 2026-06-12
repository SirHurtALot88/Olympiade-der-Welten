type SeasonLabelInput = {
  seasonId?: string | null;
  seasonName?: string | null;
};

function extractSeasonNumber(input: SeasonLabelInput) {
  const idMatch = String(input.seasonId ?? "").match(/season-(\d+)/i);
  if (idMatch) {
    return Number(idMatch[1]);
  }

  const nameMatch = String(input.seasonName ?? "").match(/\bseason\s+(\d+)\b/i);
  if (nameMatch) {
    return Number(nameMatch[1]);
  }

  return null;
}

export function getCanonicalSeasonLabel(input: SeasonLabelInput) {
  const seasonNumber = extractSeasonNumber(input);
  if (seasonNumber != null) {
    return `Season ${seasonNumber}`;
  }

  const trimmedName = String(input.seasonName ?? "").trim();
  return trimmedName || "Season";
}

export function getCanonicalSeasonLabelAtOffset(input: SeasonLabelInput, offset = 0) {
  const seasonNumber = extractSeasonNumber(input);
  if (seasonNumber != null) {
    return `Season ${seasonNumber + Math.max(0, offset)}`;
  }

  const baseLabel = getCanonicalSeasonLabel(input);
  return offset === 0 ? baseLabel : `${baseLabel} +${offset}`;
}
