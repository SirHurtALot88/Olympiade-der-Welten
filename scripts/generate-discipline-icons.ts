import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR = join(process.cwd(), "public/discipline-icons");

const DISCIPLINES: Array<{ file: string; label: string; color: string }> = [
  { file: "Basketball.svg", label: "BB", color: "#e07a2f" },
  { file: "Battlefield.svg", label: "BF", color: "#8b5a2b" },
  { file: "Breaking Point.svg", label: "BP", color: "#d94f4f" },
  { file: "Climbing.svg", label: "CL", color: "#6fbf73" },
  { file: "Eiskunst.svg", label: "EK", color: "#6ec1ff" },
  { file: "Fechten.svg", label: "FE", color: "#b0b8c9" },
  { file: "Football.svg", label: "FB", color: "#4f8f5d" },
  { file: "Gewichtheben.svg", label: "GW", color: "#c77dff" },
  { file: "Hockey.svg", label: "HK", color: "#4a90c2" },
  { file: "I Spy.svg", label: "IS", color: "#f0c84a" },
  { file: "MEN.svg", label: "ME", color: "#7aa2ff" },
  { file: "MiniDM.svg", label: "MD", color: "#ff8f6b" },
  { file: "POW.svg", label: "PO", color: "#ff6b6b" },
  { file: "Schach.svg", label: "SC", color: "#d9dde6" },
  { file: "Showcase.svg", label: "SH", color: "#ffd166" },
  { file: "SOC.svg", label: "SO", color: "#66d9a8" },
  { file: "SPE.svg", label: "SP", color: "#6ecbff" },
  { file: "Spurt.svg", label: "SR", color: "#ff9f43" },
  { file: "Staffel.svg", label: "ST", color: "#54a0ff" },
  { file: "TDM.svg", label: "TD", color: "#a29bfe" },
  { file: "Takeshi.svg", label: "TK", color: "#ff7675" },
  { file: "Tennis.svg", label: "TE", color: "#c8f27a" },
  { file: "Time Trial.svg", label: "TT", color: "#74b9ff" },
  { file: "Wettessen.svg", label: "WE", color: "#fdcb6e" },
];

function buildSvg(label: string, color: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img" aria-hidden="true">
  <rect x="2" y="2" width="60" height="60" rx="14" fill="#121722" stroke="${color}" stroke-width="3"/>
  <circle cx="32" cy="32" r="18" fill="${color}" opacity="0.18"/>
  <text x="32" y="37" text-anchor="middle" font-family="system-ui, sans-serif" font-size="18" font-weight="800" fill="${color}">${label}</text>
</svg>`;
}

mkdirSync(OUT_DIR, { recursive: true });

for (const entry of DISCIPLINES) {
  writeFileSync(join(OUT_DIR, entry.file), buildSvg(entry.label, entry.color), "utf8");
}

console.log(`Generated ${DISCIPLINES.length} discipline icons in ${OUT_DIR}`);
