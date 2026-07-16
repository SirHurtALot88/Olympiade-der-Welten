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

const CLASS_ICON_BY_KEY: Record<string, string> = {
  badass: "/class-icons/Badass.png",
  bard: "/class-icons/Bard.png",
  berserker: "/class-icons/Berserker.png",
  charger: "/class-icons/Charger.png",
  hero: "/class-icons/Hero.png",
  mage: "/class-icons/Mage.png",
  overseer: "/class-icons/Overseer.png",
  rogue: "/class-icons/Rogue.png",
  sprinter: "/class-icons/Sprinter.png",
  tactician: "/class-icons/Tactician.png",
  tank: "/class-icons/Tank.png",
  templar: "/class-icons/Templar.png",
  warlord: "/class-icons/Warlord.png",
};

function normalizeClassKey(className: string | null | undefined) {
  return (className ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

export function getClassColorToken(className: string | null | undefined) {
  return className ? CLASS_COLOR_BY_NAME[className] ?? null : null;
}

export function getClassColorClassName(className: string | null | undefined, prefix = "class-color") {
  const token = getClassColorToken(className);
  return token ? `${prefix} ${prefix}-${token}` : `${prefix} ${prefix}-unknown`;
}

export function getClassIconSrc(className: string | null | undefined) {
  const key = normalizeClassKey(className);
  return key ? CLASS_ICON_BY_KEY[key] ?? null : null;
}
