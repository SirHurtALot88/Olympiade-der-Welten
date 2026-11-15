const euroFormatter = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const euroCentsFormatter = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const percentFormatter = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatEuro(value: number): string {
  return euroFormatter.format(Math.round(value));
}

export function formatEuroCents(value: number): string {
  return euroCentsFormatter.format(value);
}

export function formatPercent(value: number): string {
  const text = percentFormatter.format(value * 100);
  // "-0" / "−0" soll nicht als negative Null erscheinen
  return /^[-−]0(,0+)?$/.test(text) ? text.replace(/^[-−]/, "") : text;
}
