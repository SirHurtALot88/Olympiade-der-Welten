import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Verdrahtungs-Contract für die Historie-Farben im Spielerprofil (Punkte 2/3 der
 * Historie-Überarbeitung):
 *  - Trainingshistorie/Saison-Forecast: die Legende verspricht "Grün = Zuwachs,
 *    Rot = Rückgang" — die is-positive/is-negative-Töne aus getDeltaToneClass
 *    brauchen in diesen Tabellen echte Farbregeln (--nl-good/--nl-risk).
 *  - Sportliche Historie: POW/SPE/MEN/SOC-Spalten tragen die festen Achsfarben
 *    (nl-tone-pow/… aus dem New-Look-Vokabular), Kopf im Achston, Werte dezent.
 */

const root = process.cwd();
const drawerSource = readFileSync(join(root, "app/foundation/PlayerDetailDrawer.tsx"), "utf8");
const cssSource = readFileSync(join(root, "app/globals.css"), "utf8");

describe("Trainingshistorie: Grün/Rot-Töne sind verdrahtet", () => {
  it("globals.css färbt is-positive/is-negative in Forecast- und Trainingshistorie-Tabelle mit nl-good/nl-risk", () => {
    expect(cssSource).toMatch(/\.player-drawer-matchday-training-table td\.is-positive[\s\S]{0,200}?--nl-good/);
    expect(cssSource).toMatch(/\.player-drawer-matchday-training-table td\.is-negative[\s\S]{0,200}?--nl-risk/);
    expect(cssSource).toMatch(/\.player-drawer-training-history-table \.is-positive[\s\S]{0,200}?--nl-good/);
    expect(cssSource).toMatch(/\.player-drawer-training-history-table \.is-negative[\s\S]{0,200}?--nl-risk/);
  });

  it("die Forecast-Zellen setzen die Ton-Klasse über getDeltaToneClass", () => {
    // Verdrahtung im JSX: kumulierte Zellen und Netto-Zelle tragen den Delta-Ton.
    expect(drawerSource).toMatch(/is-attribute-col \$\{getDeltaToneClass\(cell\.cumulative\)\}/);
    expect(drawerSource).toMatch(/getDeltaToneClass\(forecast\.netCumulative\)/);
  });
});

describe("Sportliche Historie: POW/SPE/MEN/SOC in festen Achsfarben", () => {
  it("die vier Achsen-Spalten nutzen nlToneClass mit ihrem Achs-Key", () => {
    for (const axis of ["pow", "spe", "men", "soc"] as const) {
      const pattern = new RegExp(
        `key: "${axis}", label: "${axis.toUpperCase()}", className: \`player-drawer-history-axis-col \\$\\{nlToneClass\\("${axis}"\\)\\}\``,
      );
      expect(drawerSource).toMatch(pattern);
    }
  });

  it("globals.css färbt Kopf voll und Werte dezent über --nl-tone (kein dunkel-auf-dunkel)", () => {
    expect(cssSource).toMatch(/th\.player-drawer-history-axis-col[\s\S]{0,200}?--nl-tone/);
    // Werte: gemischt mit heller Tinte (--nl-ink), damit die Zahlen lesbar bleiben.
    expect(cssSource).toMatch(/td\.player-drawer-history-axis-col[\s\S]{0,300}?color-mix\(in srgb, var\(--nl-tone[\s\S]{0,120}?--nl-ink/);
  });
});
