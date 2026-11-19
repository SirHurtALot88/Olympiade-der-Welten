import { getClassColorToken } from "./classVisuals";

/**
 * Die Klasse eines Spielers in der Farbe seiner Formkarte. Dieselbe Quelle wie der Formkarten-Code
 * (`CLASS_COLOR_BY_NAME` in classVisuals, rot POW / grün SPE / blau MEN / gelb SOC, siehe `FARB_KURZ` in
 * lib/lineups/formkarten-wirkung.ts): welche Farbe die Karte hat, die ein Spieler bringt, hängt allein an der Klasse.
 */
const FARBE: Record<"red" | "green" | "blue" | "yellow", { achse: string; farbe: string; grund: string }> = {
  red: { achse: "POW", farbe: "#ff7a6e", grund: "rgba(229,72,60,.18)" },
  green: { achse: "SPE", farbe: "#5fd68a", grund: "rgba(47,176,100,.18)" },
  blue: { achse: "MEN", farbe: "#6fb0ff", grund: "rgba(58,128,230,.2)" },
  yellow: { achse: "SOC", farbe: "#f3cf5a", grund: "rgba(230,184,40,.18)" },
};

export function klassenKartenfarbe(className: string | null | undefined) {
  const token = getClassColorToken(className);
  return token ? { token, ...FARBE[token] } : null;
}

export default function KlassenFarbTag({ className, mitAchse = true }: { className: string | null | undefined; mitAchse?: boolean }) {
  if (!className) return null;
  const f = klassenKartenfarbe(className);
  if (!f) return <span data-testid="klasse-farbe">{className}</span>;
  return (
    <span
      data-testid="klasse-farbe"
      data-kartenfarbe={f.achse}
      title={`${className}: Formkarte in ${f.achse}-Farbe`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.3em",
        padding: "0 0.5em",
        borderRadius: "0.35em",
        border: `1px solid ${f.farbe}`,
        background: f.grund,
        color: f.farbe,
        fontWeight: 700,
        lineHeight: 1.5,
        whiteSpace: "nowrap",
      }}
    >
      {className}
      {mitAchse ? <b style={{ fontSize: "0.82em", opacity: 0.85, letterSpacing: ".06em" }}>{f.achse}</b> : null}
    </span>
  );
}
