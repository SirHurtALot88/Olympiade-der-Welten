import fs from "node:fs";
import path from "node:path";

/**
 * Minimaler .env-Loader fuer eigenstaendige tsx-Skripte (Next.js laedt .env
 * bereits selbst — dieser Helfer ist nur fuer scripts/*.ts noetig, damit z. B.
 * LEC_SQLITE_PATH konsistent mit dem App-Runtime aufgeloest wird). Ueberschreibt
 * nie bereits gesetzte process.env-Werte (gleiches Verhalten wie dotenv).
 */
export function loadDotEnv(): void {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, "utf-8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
