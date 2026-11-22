import type { FoundationViewId } from "@/lib/foundation/foundation-view-routing";

// Kredite tab visibility gate. The credit game-system (interest math,
// eligibility, cash mutations, borrow UX) is wired to the real bank credit
// service (lib/finance/loan-service.ts, see docs/design/kredit-system.md).
export const CREDITS_TAB_ENABLED = true;

export type FoundationNavItem = {
  id: FoundationViewId;
  label: string;
  tooltip: string;
  icon?: string;
  /**
   * Kleine Kennzeichnung hinter dem Label (z. B. "Test"). Nur Anzeige in der Sidebar — das Label
   * selbst bleibt unverändert, weil Breadcrumb und Inbox-Zielnamen es als Ansichtsnamen lesen.
   */
  badge?: string;
};

export type FoundationNavGroup = {
  id: "matchday" | "team" | "market" | "world" | "admin" | "info";
  label: string;
  items: FoundationNavItem[];
};

export const FOUNDATION_NAV_GROUPS: FoundationNavGroup[] = [
  {
    id: "matchday",
    label: "Spieltag",
    items: [
      { id: "homeV2", label: "Home", tooltip: "Manager-Dashboard mit KPIs, Top-Spielern und Flow.", icon: "⌂" },
      { id: "inboxV2", label: "Inbox", tooltip: "Offene Aufgaben & Warnungen für dein Team.", icon: "✉" },
      // Spielplan zur Spieltagsfolge (21.11.): erst sehen, was wann läuft, dann aufstellen, spielen, auswerten.
      {
        id: "diszis",
        label: "Spielplan",
        tooltip: "Saison-Spielplan: welche Disziplinen an welchem Spieltag laufen — farbcodiert nach Achse.",
        icon: "≣",
      },
      { id: "lineup", label: "Einsatzliste", tooltip: "Spieler setzen, Formplan und Team-Taktik — Focus Mode.", icon: "▣" },
      { id: "matchdayArena", label: "Arena", tooltip: "Spieltag live: Disziplinen mit echten Save-Werten (Wert/Fatigue/Form) durchspielen.", icon: "◉" },
      { id: "seasonV2", label: "Saisonstand", tooltip: "Tabelle, Cards und Teamstärken.", icon: "▤" },
      // Entwurf des Battle Mode. Steht bewusst NEBEN der Arena statt unter "Info":
      // beurteilen laesst er sich nur da, wo man ihn mit der echten Arena vergleicht.
      // Er liest und schreibt keinen Spielstand.
      {
        id: "battleArena",
        label: "Battle Arena",
        // Fable-UI/UX 14.11., Vorschlag 13: neben der echten "Arena" las sich der Eintrag wie ein
        // zweiter Kampfbildschirm. Er ist ein Testwerkzeug (Formate/Varianten ausprobieren) und
        // bleibt deshalb drin — nur kenntlich gemacht.
        badge: "Test",
        tooltip:
          "Testwerkzeug, kein Spieltag: Entwurf für den Battle Mode — Aufstellung mit Reihen und Befehlen, dazu ein laufender 6-gegen-6-Kampf. Liest und schreibt keinen Spielstand. Den echten Spieltag spielst du unter „Arena“.",
        icon: "⚔",
      },
    ],
  },
  {
    id: "team",
    label: "Team",
    items: [
      { id: "teams", label: "Teams", tooltip: "Kader, Verträge und Teamdetails.", icon: "◈" },
      { id: "players", label: "Spieler", tooltip: "Spieler suchen und Profil öffnen.", icon: "◎" },
      { id: "merkliste", label: "Merkliste", tooltip: "Gemerkte Teams und Spieler — deine Lesezeichen.", icon: "★" },
      { id: "trainingCompact", label: "Training", tooltip: "Trainingssteuerung pro Spieler.", icon: "↑" },
      { id: "trainingV2", label: "Gebäude", tooltip: "Facilities, Upgrade und Wirkung.", icon: "▦" },
      // Ausrüstung (22.11., Phase 1a): Lager, Truhen, Ruhm. Eigene Seite im neuen Stil, Mockup zwischen-den-spieltagen-22-11.html.
      { id: "ausruestung", label: "Ausrüstung", tooltip: "Lager, Truhen und Ruhm: Beute aus Punkten, Gegenstände mit Affixen.", icon: "⚒" },
    ],
  },
  {
    id: "market",
    label: "Markt",
    items: [
      { id: "marketV2", label: "Transfermarkt", tooltip: "Kaufen, verkaufen und verhandeln.", icon: "⇄" },
      { id: "scoutingCenterV2", label: "Scouting", tooltip: "Reports, Watchlist und Empfehlungen.", icon: "◐" },
      ...(CREDITS_TAB_ENABLED
        ? [{ id: "credits", label: "Kredite", tooltip: "Kreditrahmen, laufende Kredite und Angebote.", icon: "₤" } as FoundationNavItem]
        : []),
      { id: "finances", label: "Finanzen", tooltip: "Einnahmen, Ausgaben und GuV deines Teams.", icon: "€" },
    ],
  },
  {
    id: "world",
    label: "Welt",
    items: [
      { id: "ranks", label: "Ranks", tooltip: "Team- und Disziplinranks.", icon: "▥" },
      {
        id: "seasonArchive",
        label: "Historie",
        tooltip: "Gedächtnis der Liga: Saison-Archiv, Transfers und Ewige Tabelle.",
        icon: "↺",
      },
      { id: "leagueLeaders", label: "Leaders", tooltip: "Liga-Leaders je Kategorie plus Rekorde, Trophäenschrank und legendäre Spieler.", icon: "★" },
      { id: "prize", label: "Sponsoren", tooltip: "Sponsor-Vertrag wählen und Saisonfinanzen prüfen.", icon: "$" },
      { id: "encyclopedia", label: "Lexikon", tooltip: "Spielbegriffe und Regeln.", icon: "?" },
    ],
  },
  {
    id: "admin",
    label: "Verwaltung",
    items: [
      { id: "generator", label: "Generator", tooltip: "Spieler generieren.", icon: "+" },
      { id: "teamSettings", label: "Settings", tooltip: "Team-Konfiguration und Speicherstände.", icon: "⚙" },
    ],
  },
  // Bewusst die letzte Gruppe: das Konzept (docs/BUGFIXING_AGENT.md, "Der Changelog") verlangt den
  // Changelog als UNTERSTEN Reiter — und er ist weder Spielsteuerung noch Verwaltung, sondern
  // Auskunft. Eine eigene Gruppe haelt ihn aus dem Weg, ohne ihn zu verstecken.
  {
    id: "info",
    label: "Info",
    items: [
      {
        id: "changelog",
        label: "Changelog",
        tooltip: "Was zuletzt gefixt oder geändert wurde — mit PR-Nummer als Beleg.",
        icon: "✓",
      },
    ],
  },
];

export function isFoundationNavViewActive(activeView: FoundationViewId, itemId: FoundationViewId) {
  if (itemId === activeView) return true;
  if (itemId === "homeV2" && activeView === "home") return true;
  if (itemId === "seasonV2" && activeView === "season") return true;
  if (itemId === "marketV2" && activeView === "market") return true;
  // Ein Schienenpunkt „Historie" mit drei Reitern (Chris 18.11.): Saison-Archiv, Transfers, Ewige Tabelle.
  if (itemId === "seasonArchive" && (activeView === "historyV2" || activeView === "history" || activeView === "allTimeTable")) {
    return true;
  }
  if (itemId === "inboxV2" && activeView === "inbox") return true;
  if (itemId === "lineup" && (activeView === "lineup" || activeView === "lineupV2")) return true;
  if (itemId === "players" && (activeView === "players" || activeView === "playerProfile")) return true;
  if (itemId === "teams" && (activeView === "teams" || activeView === "teamProfile")) return true;
  return false;
}
