import type { FeldArt } from "@/lib/lineups/formation/formation-registry";

/**
 * Hintergrund des Einsatz-Feldes. Der Renderer kennt keine Disziplin, nur die zwölf `FeldArt`en der
 * Formations-Registry. Reines SVG (kein PixelLab, Entscheidung 7), `preserveAspectRatio="none"`, damit
 * die Prozent-Koordinaten der Plätze und der Hintergrund immer deckungsgleich sind.
 */
const L = { stroke: "rgba(244,230,196,.34)", strokeWidth: 2, fill: "none" } as const;
const WIR = "rgba(242,160,61,.06)";
const GEGEN = "rgba(69,176,201,.07)";

export function FeldHintergrund({
  art,
  spuren,
  etiketten,
  disziplinId = null,
}: {
  /** Nur für Zeichen ohne eigene `FeldArt` (Tennis): die Linien liegen per SVG über der PixelLab-Fläche. */
  disziplinId?: string | null;
  art: FeldArt;
  /** Anzahl Bahnen bei `strecke`. */
  spuren: number;
  etiketten: ReadonlyArray<{ label: string; x: number; y: number; gespiegelt: boolean }>;
}) {
  const rest = (
    <>
      {etiketten.map((e, i) => (
        <text
          key={i}
          x={e.x * 800}
          y={e.y * 500 + 4}
          textAnchor="middle"
          fontSize="13"
          letterSpacing="3"
          fill={e.gespiegelt ? "rgba(69,176,201,.4)" : "rgba(244,230,196,.3)"}
          style={{ textTransform: "uppercase", fontFamily: "var(--bc-zahl)" }}
        >
          {e.label}
        </text>
      ))}
    </>
  );
  let inhalt: React.ReactNode;
  switch (art) {
    case "halbfeld":
      inhalt = (
        <>
          <rect width="800" height="500" fill="#2e2118" />
          <rect className="tint" width="400" height="500" fill={WIR} />
          <rect className="tint" x="400" width="400" height="500" fill={GEGEN} />
          <rect x="16" y="16" width="768" height="468" {...L} />
          <path d="M400 16v468" {...L} />
          <circle cx="400" cy="250" r="62" {...L} />
          <rect x="16" y="170" width="150" height="160" {...L} />
          <path d="M16 56h70a212 194 0 010 388H16" {...L} />
          <circle cx="46" cy="250" r="9" stroke="#F2A03D" strokeWidth="3" fill="none" />
          <rect x="634" y="170" width="150" height="160" {...L} />
          <path d="M784 56h-70a212 194 0 000 388h70" {...L} />
          <circle cx="754" cy="250" r="9" stroke="#45B0C9" strokeWidth="3" fill="none" />
        </>
      );
      break;
    case "eis":
      inhalt = (
        <>
          <rect width="800" height="500" fill="#0b1520" />
          <rect x="16" y="16" width="768" height="468" rx="90" fill="#122638" stroke="rgba(160,210,240,.45)" strokeWidth="2" />
          <path d="M290 16v468M510 16v468" stroke="rgba(90,150,255,.45)" strokeWidth="4" />
          <path d="M400 16v468" stroke="rgba(255,90,90,.4)" strokeWidth="3" />
          <circle cx="400" cy="250" r="50" {...L} />
          <path d="M60 215v70" stroke="#F2A03D" strokeWidth="4" />
          <path d="M740 215v70" stroke="#45B0C9" strokeWidth="4" />
        </>
      );
      break;
    case "football":
      inhalt = (
        <>
          <rect width="800" height="500" fill="#16301c" />
          {Array.from({ length: 9 }, (_, i) => (
            <path key={i} d={`M${80 + i * 80} 20v460`} stroke="rgba(255,255,255,.14)" strokeWidth="2" />
          ))}
          <path d="M20 20h760v460H20z" {...L} />
          <path d="M360 20v460" stroke="#f0c35a" strokeWidth="3" strokeDasharray="8 6" />
        </>
      );
      break;
    case "strecke":
      inhalt = (
        <>
          <rect width="800" height="500" fill="#0a0f16" />
          {Array.from({ length: Math.max(1, spuren) }, (_, k) => {
            const h = 480 / Math.max(1, spuren);
            const y = 10 + k * h;
            return (
              <g key={k}>
                <rect x="8" y={y} width="784" height={h - 4} fill={k % 2 ? "#2a1715" : "#321b18"} />
                <path d={`M8 ${y}h784`} stroke="rgba(244,230,196,.4)" strokeWidth="2" />
              </g>
            );
          })}
          <path d="M150 10v480" stroke="#fff" strokeWidth="3" />
          <path d="M770 10v480" stroke="#eef2f8" strokeWidth="8" strokeDasharray="10 10" />
        </>
      );
      break;
    case "wand":
      inhalt = (
        <>
          <rect width="800" height="500" fill="#17120e" />
          <rect x="140" y="20" width="520" height="440" fill="#2a2119" stroke="rgba(244,230,196,.3)" strokeWidth="2" />
          {Array.from({ length: 22 }, (_, i) => (
            <circle key={i} cx={190 + ((i * 97) % 420)} cy={50 + ((i * 53) % 380)} r="7" fill="rgba(240,195,90,.35)" />
          ))}
          <path d="M20 470h760" {...L} />
        </>
      );
      break;
    case "staffel":
      inhalt = (
        <>
          <rect width="800" height="500" fill="#0a0f16" />
          <rect x="30" y="150" width="740" height="200" rx="100" fill="#321b18" stroke="rgba(244,230,196,.4)" strokeWidth="2" />
          {[0.25, 0.5, 0.75].map((q) => (
            <path key={q} d={`M${30 + 740 * q} 150v200`} stroke="#f0c35a" strokeWidth="3" strokeDasharray="6 6" />
          ))}
        </>
      );
      break;
    case "tafel":
      inhalt = (
        <>
          <rect width="800" height="500" fill="#16120e" />
          <rect x="40" y="130" width="720" height="240" rx="18" fill="#3a2a1b" stroke="rgba(244,230,196,.35)" strokeWidth="2" />
        </>
      );
      break;
    case "ring":
      inhalt = (
        <>
          <rect width="800" height="500" fill="#0c0f14" />
          <circle cx="170" cy="250" r="150" fill="#1d1a18" stroke="rgba(244,230,196,.4)" strokeWidth="3" />
          <path d="M340 250h400" stroke="rgba(244,230,196,.2)" strokeWidth="6" strokeDasharray="4 12" />
        </>
      );
      break;
    case "bogen":
      inhalt = (
        <>
          <rect width="800" height="500" fill="#0a0f16" />
          <rect x="24" y="92" width="752" height="384" rx="150" fill="#16293a" stroke="rgba(160,210,240,.45)" strokeWidth="2" />
          <ellipse cx="400" cy="284" rx="96" ry="64" fill="none" stroke="rgba(160,210,240,.22)" strokeWidth="2" />
          <rect x="290" y="22" width="220" height="44" rx="6" fill="#141b27" stroke="rgba(244,230,196,.3)" />
        </>
      );
      break;
    case "domination":
      inhalt = (
        <>
          <rect width="800" height="500" fill="#161d12" />
          <rect className="tint" width="400" height="500" fill={WIR} />
          <rect className="tint" x="400" width="400" height="500" fill={GEGEN} />
          {[110, 250, 390].map((y) => (
            <circle key={y} cx="400" cy={y} r="52" fill="rgba(0,0,0,.3)" stroke="rgba(244,230,196,.45)" strokeWidth="3" strokeDasharray="10 7" />
          ))}
        </>
      );
      break;
    case "reihen":
      inhalt = (
        <>
          <rect width="800" height="500" fill="#10170f" />
          <rect className="tint" width="400" height="500" fill={WIR} />
          <rect className="tint" x="400" width="400" height="500" fill={GEGEN} />
          <path d="M400 0v500" stroke="rgba(244,230,196,.18)" strokeWidth="2" strokeDasharray="6 10" />
          {[140, 300, 460].map((x) => (
            <path key={x} d={`M${x / 1.0} 20v460`} stroke="rgba(244,230,196,.07)" strokeWidth="2" />
          ))}
        </>
      );
      break;
    default:
      inhalt =
        disziplinId === "tennis" ? (
          <>
            <rect width="800" height="500" fill="#17120e" />
            <rect x="40" y="70" width="720" height="360" {...L} />
            <rect x="40" y="118" width="720" height="264" {...L} />
            <path d="M400 70v360" stroke="rgba(244,230,196,.5)" strokeWidth="4" />
            <path d="M190 118v264M610 118v264M190 250h420" {...L} />
          </>
        ) : (
          <>
            <rect width="800" height="500" fill="#0a0f16" />
            <rect x="20" y="170" width="760" height="160" rx="10" fill="#141b27" stroke="rgba(244,230,196,.25)" strokeWidth="2" />
            <path d="M20 400h760" stroke="rgba(244,230,196,.15)" strokeWidth="2" />
          </>
        );
  }
  return (
    <svg className="elm-feld__svg" viewBox="0 0 800 500" preserveAspectRatio="none" aria-hidden="true">
      {inhalt}
      {rest}
    </svg>
  );
}
