"use client";

const RACE_ICON_BY_KEY: Record<string, string> = {
  alien: "/race-icons/Alien.png",
  animal: "/race-icons/Animal.png",
  aqua: "/race-icons/Aqua.png",
  construct: "/race-icons/Construct.png",
  demon: "/race-icons/Demon.png",
  divine: "/race-icons/Divine.png",
  dragon: "/race-icons/Dragon.png",
  dwarf: "/race-icons/Dwarf.png",
  elf: "/race-icons/Elf.png",
  gnom: "/race-icons/Gnom.png",
  gnome: "/race-icons/Gnom.png",
  goblin: "/race-icons/Goblin.png",
  human: "/race-icons/Human.png",
  lizard: "/race-icons/Lizard.png",
  mutant: "/race-icons/Mutant.png",
  orc: "/race-icons/Orc.png",
  plant: "/race-icons/Plant.png",
  tauren: "/race-icons/Tauren.png",
  voidborn: "/race-icons/Voidborn.png",
};

function normalizeRaceKey(race: string | null | undefined) {
  return (race ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

export function getRaceIconSrc(race: string | null | undefined) {
  const key = normalizeRaceKey(race);
  return key ? RACE_ICON_BY_KEY[key] ?? null : null;
}

type RaceIconProps = {
  race: string | null | undefined;
  showLabel?: boolean;
  className?: string;
  iconClassName?: string;
};

export default function RaceIcon({ race, showLabel = true, className = "", iconClassName = "" }: RaceIconProps) {
  const label = race?.trim() || "—";
  const src = getRaceIconSrc(race);
  const raceKey = normalizeRaceKey(race) || "unknown";

  return (
    <span className={`race-icon-chip race-icon-${raceKey}${showLabel ? " has-label" : ""}${className ? ` ${className}` : ""}`} title={label}>
      {src ? (
        <img
          className={`race-icon${iconClassName ? ` ${iconClassName}` : ""}`}
          src={src}
          alt={label}
          width={32}
          height={32}
          loading="eager"
          decoding="async"
        />
      ) : null}
      {showLabel ? <span className="race-icon-label">{label}</span> : null}
    </span>
  );
}
