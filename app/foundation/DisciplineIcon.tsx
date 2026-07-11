"use client";

const DISCIPLINE_ICON_BY_KEY: Record<string, string> = {
  basketball: "/discipline-icons/Basketball.svg",
  battlefield: "/discipline-icons/Battlefield.svg",
  breaking: "/discipline-icons/Breaking Point.svg",
  breakingpoint: "/discipline-icons/Breaking Point.svg",
  climbing: "/discipline-icons/Climbing.svg",
  eiskunst: "/discipline-icons/Eiskunst.svg",
  fechten: "/discipline-icons/Fechten.svg",
  football: "/discipline-icons/Football.svg",
  gewichtheben: "/discipline-icons/Gewichtheben.svg",
  hockey: "/discipline-icons/Hockey.svg",
  ispy: "/discipline-icons/I Spy.svg",
  men: "/discipline-icons/MEN.svg",
  minidm: "/discipline-icons/MiniDM.svg",
  pow: "/discipline-icons/POW.svg",
  schach: "/discipline-icons/Schach.svg",
  showcase: "/discipline-icons/Showcase.svg",
  soc: "/discipline-icons/SOC.svg",
  spe: "/discipline-icons/SPE.svg",
  spurt: "/discipline-icons/Spurt.svg",
  staffel: "/discipline-icons/Staffel.svg",
  tdm: "/discipline-icons/TDM.svg",
  takeshi: "/discipline-icons/Takeshi.svg",
  tennis: "/discipline-icons/Tennis.svg",
  timetrial: "/discipline-icons/Time Trial.svg",
  wettessen: "/discipline-icons/Wettessen.svg",
};

function normalizeDisciplineKey(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

export function getDisciplineIconSrc(
  disciplineId: string | null | undefined,
  disciplineLabel?: string | null | undefined,
) {
  const candidates = [disciplineId, disciplineLabel];
  for (const candidate of candidates) {
    const key = normalizeDisciplineKey(candidate);
    if (key && DISCIPLINE_ICON_BY_KEY[key]) {
      return DISCIPLINE_ICON_BY_KEY[key]!;
    }
  }
  return null;
}

type DisciplineIconProps = {
  disciplineId?: string | null | undefined;
  label: string | null | undefined;
  showLabel?: boolean;
  className?: string;
  iconClassName?: string;
};

export default function DisciplineIcon({
  disciplineId,
  label,
  showLabel = true,
  className = "",
  iconClassName = "",
}: DisciplineIconProps) {
  const resolvedLabel = label?.trim() || "—";
  const src = getDisciplineIconSrc(disciplineId, label);
  const fallbackLabel = resolvedLabel.slice(0, 2).toUpperCase();

  return (
    <span
      className={`discipline-icon-chip${showLabel ? " has-label" : ""}${className ? ` ${className}` : ""}`}
      title={resolvedLabel}
      // Without a visible label the chip's only cue is `title` (not reliably announced),
      // so expose the discipline name to assistive tech directly.
      role={showLabel ? undefined : "img"}
      aria-label={showLabel ? undefined : resolvedLabel}
    >
      {src ? (
        <img
          className={`discipline-icon${iconClassName ? ` ${iconClassName}` : ""}`}
          src={src}
          alt={showLabel ? resolvedLabel : ""}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
        />
      ) : (
        <span className={`discipline-icon discipline-icon-fallback${iconClassName ? ` ${iconClassName}` : ""}`} aria-hidden="true">
          {fallbackLabel}
        </span>
      )}
      {showLabel ? <span className="discipline-icon-label">{resolvedLabel}</span> : null}
    </span>
  );
}
