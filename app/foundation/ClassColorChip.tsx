"use client";

const CLASS_COLOR_BY_NAME: Record<string, "red" | "green" | "blue" | "yellow"> = {
  Berserker: "red",
  Warlord: "red",
  Tank: "red",
  Sprinter: "green",
  Rogue: "green",
  Charger: "green",
  Mage: "blue",
  Overseer: "blue",
  Templar: "blue",
  Bard: "yellow",
  Hero: "yellow",
  Badass: "yellow",
  Tactician: "yellow",
};

export function getClassColorToken(className: string | null | undefined) {
  return className ? CLASS_COLOR_BY_NAME[className] ?? null : null;
}

export function getClassColorClassName(className: string | null | undefined, prefix = "class-color") {
  const token = getClassColorToken(className);
  return token ? `${prefix} ${prefix}-${token}` : `${prefix} ${prefix}-unknown`;
}

export default function ClassColorChip({ className }: { className: string | null | undefined }) {
  return <span className={getClassColorClassName(className)}>{className ?? "—"}</span>;
}
