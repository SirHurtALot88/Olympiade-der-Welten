/**
 * SPIELERPROFIL NEU (18.11.) — ANZEIGE-VERTRAG.
 *
 * Das Spielerprofil ist neu gebaut (`app/foundation/spielerprofil/`, Mockup `spielerprofil-modern-18-11.html`). Diese Datei
 * hielt vorher die ~4300 Zeilen der alten `PlayerDetailDrawer` fest (CA/PO-Sterne, Achsengitter, Trainingshistorie als
 * Diagramm, Klassen-Vorschau, Report-Reiter). Die Gruppen „Laden und Rechtelage“ und „Zwischenspeicher“ gelten unverändert
 * weiter, weil sie die Verdrahtung in der Shell prüfen, nicht die Oberfläche; der Rest ist auf die neuen Bauteile umgezogen.
 *
 * Eine Gruppe je Oberfläche und ein `it` je zusammenhängender Aussage: fällt eine, laufen die anderen weiter.
 */
import path from "node:path";
import fs from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { readFoundationOrchestratorSource, readFoundationSurfaceSource } from "./foundation-orchestrator-source";

const lies = (relativerPfad: string) => fs.readFile(path.join(process.cwd(), relativerPfad), "utf8");

const SEITE = await lies("app/foundation/spielerprofil/SpielerprofilSeite.tsx");
const KURZ = await lies("app/foundation/spielerprofil/SpielerKurzprofil.tsx");
const HOST = await lies("app/foundation/spielerprofil/SpielerKurzprofilHost.tsx");
const T_UEBERBLICK = await lies("app/foundation/spielerprofil/TabUeberblick.tsx");
const T_DISZI = await lies("app/foundation/spielerprofil/TabDisziplinen.tsx");
const T_LEISTUNG = await lies("app/foundation/spielerprofil/TabLeistung.tsx");
const T_ENTW = await lies("app/foundation/spielerprofil/TabEntwicklung.tsx");
const T_VERTRAG = await lies("app/foundation/spielerprofil/TabVertrag.tsx");
const T_KARRIERE = await lies("app/foundation/spielerprofil/TabKarriere.tsx");
const BAUSTEINE = await lies("app/foundation/spielerprofil/bausteine.tsx");
const CSS = await lies("app/foundation/spielerprofil/spielerprofil.css");
const SERVICE = await lies("lib/foundation/player-profile-service.ts");
const MODELL = await lies("lib/foundation/spielerprofil-modell.ts");
const SCOPE_ONLY = await lies("lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx");
const PERSISTENCE_ACTIONS = await lies("lib/foundation/tabs/use-foundation-persistence-actions.ts");
const ORCHESTRATOR = await readFoundationOrchestratorSource();
const SURFACE = await readFoundationSurfaceSource();
const ALLE_TABS = [T_UEBERBLICK, T_DISZI, T_LEISTUNG, T_ENTW, T_VERTRAG, T_KARRIERE].join("\n");

/**
 * Der Zwischenspeicher zog beim Performance-Schnitt aus dem Shell-Scope in den Persistenz-Hook um.
 * Beide zusammen sind „die Verdrahtung" — eine Zusicherung gegen nur eine der beiden Dateien würde
 * je nach Umzug mal hier und mal dort ins Leere greifen.
 */
const SCOPE = `${SCOPE_ONLY}\n${PERSISTENCE_ACTIONS}`;

describe("Spielerprofil-Seite (neu)", () => {
  it("ist ein eigenes Bauteil mit eigenem CSS im Mockup-Stil und hängt in der Shell", () => {
    expect(SURFACE).toContain("SpielerprofilSeite");
    expect(SEITE).toContain('import "./spielerprofil.css"');
    expect(CSS).toContain(".spr-kopf");
    // Nichts von der alten Schublade lebt in den neuen Dateien weiter.
    for (const quelle of [SEITE, KURZ, ALLE_TABS]) {
      expect(quelle).not.toMatch(/PlayerDetailDrawer(?!Data)/);
      expect(quelle).not.toMatch(/player-drawer-/);
    }
  });

  it("hat sechs Reiter, und der Reiter „Report“ (Scouting) ist entfallen", () => {
    expect(SERVICE).toContain('"overview" | "disciplines" | "performance" | "development" | "contract" | "career"');
    expect(SERVICE).not.toContain('id: "report"');
    expect(SERVICE).toContain("normalisierePlayerProfileTab");
    for (const marke of ["TabUeberblick", "TabDisziplinen", "TabLeistung", "TabEntwicklung", "TabVertrag", "TabKarriere"]) {
      expect(SEITE).toContain(marke);
    }
  });

  it("führt von hier aus weiter — Team und Blättern im Kader", () => {
    expect(SEITE).toContain("onOpenTeam");
    expect(SEITE).toContain("onNavigatePlayer");
    expect(ORCHESTRATOR).toContain("onOpenLeagueLeaders");
  });

  it("zeigt KEINE Kaderrolle als Wort (Chris 18.11., Punkt 3)", () => {
    for (const wort of ["Stammspieler", "Rollenspieler", "Ergänzungsspieler"]) {
      expect(ALLE_TABS + SEITE + KURZ + MODELL).not.toContain(wort);
    }
  });

  it("zeigt Verletzt als „verletzt · nicht einsetzbar · noch N Spieltage“ in Kopf, Karte und Drawer, nicht als Formabzug", () => {
    expect(MODELL).toContain("verletzt · nicht einsetzbar");
    expect(SEITE).toContain("modell.verletzung.text");
    expect(KURZ).toContain("modell.verletzung.text");
    expect(T_UEBERBLICK).toContain("spielerprofil-einsatz-verletzt");
    expect(T_LEISTUNG).toContain("× 50 %");
  });

  it("Disziplinen: Eignung, Rang in der Liga UND Rang unter allen aktiven Spielern, Kaderstärke über die besten 6", () => {
    expect(T_DISZI).toContain("Liga <b>#");
    expect(T_DISZI).toContain("Alle <b>#");
    expect(T_DISZI).toContain("Die besten 6 des Kaders");
    expect(MODELL).toContain("slice(0, 6)");
    expect(T_LEISTUNG + T_UEBERBLICK).toContain("ppGesamtLigaRang");
  });

  it("PP-Skala: Ziellinie bei 5 nur als Markierung, die Werte sind die gebuchten", () => {
    expect(MODELL).toContain("export const PP_ZIELLINIE = 5");
    expect(BAUSTEINE).toContain("spr-ppc__ziel");
    expect(MODELL).toContain("buildSeasonPointsLedger");
    expect(MODELL).not.toContain("Math.random");
  });

  it("Vertrag: Gehalt je Spieltag und je Saison, Vorstand-Freigabe mit Platz statt erfundener Quote", () => {
    expect(T_VERTRAG).toContain("spielerprofil-gehalt-spieltag");
    expect(T_VERTRAG).toContain("je Saison");
    expect(T_VERTRAG).toContain("spielerprofil-freigabe");
    expect(T_VERTRAG).toContain("Verlängerung, Gehaltserhöhung und Verkauf");
    expect(T_UEBERBLICK).toContain("spielerprofil-freigabe-platz");
  });

  it("Scouting-Nebel: fremde Spieler zeigen grobe Bereiche, Ränge nur als Einordnung", () => {
    expect(MODELL).toContain("export function hatNebel");
    for (const quelle of [T_UEBERBLICK, T_DISZI, T_ENTW]) {
      expect(quelle).toContain("nebel");
    }
    expect(T_DISZI).toContain("grobBereich");
    expect(T_DISZI).toContain("grobeRangStufe");
    expect(KURZ).toContain("grobBereich");
  });

  it("Figur groß auf der Kulisse der besten Disziplin, vier Posen anklickbar, Porträt groß ohne Figur", () => {
    expect(BAUSTEINE).toContain("spielerprofil-posen");
    for (const pose of ["Stand", "Lauf", "Angriff", "Treffer"]) {
      expect(BAUSTEINE).toContain(`label: "${pose}"`);
    }
    expect(BAUSTEINE).toContain("spielerprofil-portrait-ersatz");
    expect(BAUSTEINE).toContain("einsatzlisteKulisseBild");
    // Keine neue Animation, keine Tod-Pose (CLAUDE.md: PixelLab-Charaktere und -Animationen nur mit Freigabe).
    expect(BAUSTEINE).not.toContain('label: "K.o."');
  });
});

describe("Kurzprofil (Drawer ohne Reiter)", () => {
  it("ist ein eigenes Bauteil, alle Listen öffnen es, „Ganzes Profil öffnen“ führt auf die Seite", () => {
    expect(SCOPE_ONLY).toContain("oeffneSpielerKurzprofil({ playerId, activePlayerId })");
    expect(SURFACE).toContain("<SpielerKurzprofilHost");
    expect(KURZ).toContain("Ganzes Profil öffnen");
    expect(HOST).toContain("openPlayerProfileById");
  });

  it("zeigt alle 20 Disziplinen als Kacheln mit Eignung und Liga-Rang, Statuszeile und Form/Moral", () => {
    expect(KURZ).toContain("spielerkurzprofil-disziplinen");
    expect(KURZ).toContain("spielerkurzprofil-status");
    expect(KURZ).toContain("BcMoralGesicht");
    expect(KURZ).toContain("Liga #");
  });
});

describe("Laden und Rechtelage", () => {
  it("das Saisonarchiv wird nur einmal je Signatur geladen", () => {
    for (const quelle of [ORCHESTRATOR, SCOPE]) {
      expect(quelle).toContain("shouldLoadSeasonArchive");
      expect(quelle).toContain("loadedSeasonArchiveSignatureRef");
      expect(quelle).toContain("setPlayerProfileLoading(true)");
    }
  });

  it("fremde Spieler sind schreibgeschützt — die Trainingssteuerung hängt an der Verwaltbarkeit", () => {
    expect(SCOPE).toContain("const playerProfileTrainingReadOnly");
    expect(SCOPE).toContain("!canManageTeamId(playerProfileData.teamId)");
  });

  it("eine Trainingsänderung zieht das offene Profil nach", () => {
    expect(ORCHESTRATOR).toContain("refreshOpenPlayerProfileAfterTrainingChange");
    expect(SCOPE).toContain("openPlayerProfileById");
  });
});

/**
 * DER BEFUND, NICHT DIE DRIFT. Diese Gruppe hält absichtlich einen KAPUTTEN Zustand fest, damit er
 * sichtbar bleibt: `player-profile-session-cache.ts` exportiert vier Funktionen, angeschlossen ist
 * genau eine. Wird der Zwischenspeicher wieder verdrahtet ODER ganz entfernt, fällt diese Gruppe —
 * und genau dann soll sie fallen.
 */
describe("Spielerprofil-Zwischenspeicher (offener Befund)", () => {
  it("die Leer-Seite ist verdrahtet", () => {
    expect(SCOPE).toContain("player-profile-session-cache");
    expect(PERSISTENCE_ACTIONS).toContain("invalidatePlayerProfileSessionCache");
  });

  it("die Lese- und Schreibseite ist NICHT verdrahtet — der Speicher wird geleert, aber nie gefüllt", () => {
    expect(SCOPE).not.toContain("getCachedPlayerProfileData");
    expect(SCOPE).not.toContain("setCachedPlayerProfileData");
  });

  it("das Profil baut seine Daten deshalb bei jedem Öffnen neu", () => {
    // Kein Zwischenspeicher-Blick vor dem Bauen: `openPlayerProfileById` importiert den Bauer und
    // ruft ihn unbedingt. Das ist die Stelle, an der ein Treffer landen müsste.
    const oeffnen = SCOPE_ONLY.slice(
      SCOPE_ONLY.indexOf("async function openPlayerProfileById("),
      SCOPE_ONLY.indexOf("async function openPlayerProfileById(") + 3000,
    );
    expect(oeffnen).toContain("await import(\"@/lib/foundation/build-hydrated-player-drawer-data\")");
    expect(oeffnen).not.toContain("getCachedPlayerProfileData");
  });
});
