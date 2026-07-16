export function formatPlayerIdentitySubMeta(input: {
  className?: string | null;
  race?: string | null;
  subclasses?: string[] | null;
}) {
  return [input.className, input.race, ...(input.subclasses ?? []).slice(0, 3)]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" · ");
}

const TODAY_CARD_TONE_WEIGHT: Record<string, number> = {
  warning: 0,
  danger: 0,
  info: 1,
  ready: 2,
};

export function sortTodayCardsByUrgency<T extends { tone: string }>(cards: T[]) {
  return [...cards].sort(
    (left, right) =>
      (TODAY_CARD_TONE_WEIGHT[left.tone] ?? 1) - (TODAY_CARD_TONE_WEIGHT[right.tone] ?? 1),
  );
}
