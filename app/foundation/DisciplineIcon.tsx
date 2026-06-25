"use client";

const DISCIPLINE_ICON_BY_KEY: Record<string, string> = {
  basketball: "/discipline-icons/Basketball.png",
  battlefield: "/discipline-icons/Battlefield.png",
  breaking: "/discipline-icons/Breaking Point.png",
  breakingpoint: "/discipline-icons/Breaking Point.png",
  climbing: "/discipline-icons/Climbing.png",
  eiskunst: "/discipline-icons/Eiskunst.png",
  fechten: "/discipline-icons/Fechten.png",
  football: "/discipline-icons/Football.png",
  gewichtheben: "/discipline-icons/Gewichtheben.png",
  hockey: "/discipline-icons/Hockey.png",
  ispy: "/discipline-icons/I Spy.png",
  men: "/discipline-icons/MEN.png",
  minidm: "/discipline-icons/MiniDM.png",
  pow: "/discipline-icons/POW.png",
  schach: "/discipline-icons/Schach.png",
  showcase: "/discipline-icons/Showcase.png",
  soc: "/discipline-icons/SOC.png",
  spe: "/discipline-icons/SPE.png",
  spurt: "/discipline-icons/Spurt.png",
  staffel: "/discipline-icons/Staffel.png",
  tdm: "/discipline-icons/TDM.png",
  takeshi: "/discipline-icons/Takeshi.png",
  tennis: "/discipline-icons/Tennis.png",
  timetrial: "/discipline-icons/Time Trial.png",
  wettessen: "/discipline-icons/Wettessen.png",
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

  return (
    <span
      className={`discipline-icon-chip${showLabel ? " has-label" : ""}${className ? ` ${className}` : ""}`}
      title={resolvedLabel}
    >
      {src ? (
        <img
          className={`discipline-icon${iconClassName ? ` ${iconClassName}` : ""}`}
          src={src}
          alt={resolvedLabel}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
        />
      ) : null}
      {showLabel ? <span className="discipline-icon-label">{resolvedLabel}</span> : null}
    </span>
  );
}
