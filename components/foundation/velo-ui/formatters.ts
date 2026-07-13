export function formatVeloNumber(value: number | null | undefined, digits = 0) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  // Never render a negative sign for a value whose magnitude rounds to zero (e.g. "-0").
  if (Math.round(value * 10 ** digits) === 0) {
    value = 0;
  }
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatVeloSignedPercent(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatVeloNumber(value, 0)}%`;
}

export function formatVeloSignedNumber(value: number | null | undefined, digits = 1) {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatVeloNumber(value, digits)}`;
}

export function formatTrainingAttributeWeight(weight: number) {
  const sign = weight > 0 ? "+" : "";
  return `${sign}${formatVeloNumber(weight, 2)}`;
}
