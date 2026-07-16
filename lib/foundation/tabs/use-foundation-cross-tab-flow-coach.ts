import { useMemo } from "react";

import type { FoundationFlowCoachModel, FoundationFlowLoopStage, FoundationView } from "@/lib/foundation/tabs/foundation-page-types";

export function useFoundationCrossTabFlowCoach(input: {
  activeView: FoundationView;
  homeV2Tab: string;
  globalNextLabel: string;
  globalNextTitle: string;
  gameFlowPhase?: string;
  preseasonWizardStepId?: string | null;
}) {
  const activeFlowCoach = useMemo<FoundationFlowCoachModel>(() => {
    const base = {
      nextLabel: input.globalNextLabel,
      nextTitle: input.globalNextTitle,
    };
    if (input.gameFlowPhase === "preseason_management" || input.gameFlowPhase === "transfer_sell_phase" || input.gameFlowPhase === "transfer_buy_phase") {
      const stepHint = input.preseasonWizardStepId
        ? `Aktueller Schritt: ${input.preseasonWizardStepId.replaceAll("_", " ")}`
        : "Sell → Buy → Facilities (optional) → Training → Saisonstart";
      return {
        ...base,
        kicker: "Preseason-Wizard",
        title: "Saisonende durchspielen: Transfers, optionale Gebäude, Training, dann Start.",
        detail: `${stepHint}. Leertaste führt Schritt für Schritt — Gebäude und überspringbare Schritte können acknowledged werden.`,
        terms: ["Sell", "Buy", "Facilities", "Training"],
        progressLabel: "Saisonvorbereitung",
        progressPct: 52,
        shortcut: "Space = nächster Preseason-Schritt",
        actions: [
          { label: "Transfermarkt", targetView: "marketV2", detail: "Kaufen/Verkaufen", tone: "primary" },
          { label: "Training", targetView: "trainingV2", detail: "Plan setzen" },
          { label: "Office", targetView: "hq", detail: "Captain & Board" },
        ],
      };
    }
    switch (input.activeView) {
      case "home":
        return {
          ...base,
          kicker: "Briefing-Flow",
          title: "Kurz lesen, dann direkt in Markt, HQ oder Einsatzliste springen.",
          detail: "Home zeigt nur die wichtigsten Signale für die ersten Minuten: Next Play, Druck, Chancen und Spieltag.",
          terms: ["PPs", "MVS", "OVR"],
          progressLabel: "Orientierung",
          progressPct: 18,
          shortcut: "Space = Next Play",
          actions: [
            { label: "Transfermarkt", targetView: "marketV2", detail: "Deals & Wishlist", tone: "primary" },
            { label: "Office", targetView: "hq", detail: "Druck & Prioritäten" },
            { label: "Einsatzliste", targetView: "lineup", detail: "Slots füllen" },
          ],
        };
      case "homeV2":
        if (input.homeV2Tab === "office") {
          return {
            ...base,
            kicker: "Office-Flow",
            title: "Baustellen ordnen, Druck lesen und dann gezielt in Markt oder Einsatzliste gehen.",
            detail: "Office ist die Manager-Zentrale: Was brennt sofort, was kippt diese Season und was musst du vor dem Wechsel vorbereiten?",
            terms: ["Cash", "Moral", "Kader", "Druck"],
            progressLabel: "Prioritäten",
            progressPct: 34,
            shortcut: "Space = nächste Baustelle",
            actions: [
              { label: "Transfermarkt", targetView: "marketV2", detail: "Kaderlücken", tone: "primary" },
              { label: "Training", targetView: "trainingCompact", detail: "Entwicklung" },
              { label: "Einsatzliste", targetView: "lineup", detail: "bereit machen" },
            ],
          };
        }
        return {
          ...base,
          kicker: "Briefing-Flow",
          title: "Kurz lesen, dann direkt in Markt, Office oder Einsatzliste springen.",
          detail: "Home zeigt die wichtigsten Signale: Next Play, Druck, Chancen und Spieltag.",
          terms: ["PPs", "MVS", "OVR"],
          progressLabel: "Orientierung",
          progressPct: 18,
          shortcut: "Space = Next Play",
          actions: [
            { label: "Transfermarkt", targetView: "marketV2", detail: "Deals & Wishlist", tone: "primary" },
            { label: "Office", targetView: "hq", detail: "Druck & Prioritäten" },
            { label: "Einsatzliste", targetView: "lineup", detail: "Slots füllen" },
          ],
        };
      case "hq":
        return {
          ...base,
          kicker: "Office-Flow",
          title: "Baustellen ordnen, Druck lesen und dann gezielt in Markt oder Einsatzliste gehen.",
          detail: "Office ist die Manager-Zentrale: Was brennt sofort, was kippt diese Season und was musst du vor dem Wechsel vorbereiten?",
          terms: ["Cash", "Moral", "Kader", "Druck"],
          progressLabel: "Prioritäten",
          progressPct: 34,
          shortcut: "Space = nächste Baustelle",
          actions: [
            { label: "Transfermarkt", targetView: "marketV2", detail: "Kaderlücken", tone: "primary" },
            { label: "Training", targetView: "trainingCompact", detail: "Entwicklung" },
            { label: "Einsatzliste", targetView: "lineup", detail: "bereit machen" },
          ],
        };
      case "lineup":
        return {
          ...base,
          kicker: "Einsatz-Flow",
          title: "Slot wählen, Kandidat prüfen, Team-Boost setzen, speichern.",
          detail: "Leertaste springt zum nächsten offenen Schritt. Boosts gelten teamweit, nicht mehr pro Spieler.",
          terms: ["Slot", "Boost", "D1", "D2"],
          progressLabel: "Vorbereitung",
          progressPct: 44,
          shortcut: "Space = nächster offener Slot",
          actions: [
            { label: "Arena öffnen", targetView: "matchdayArena", detail: "Reveal", tone: "primary" },
            { label: "Office", targetView: "hq", detail: "Blocker" },
            { label: "Training", targetView: "trainingCompact", detail: "Erschöpfung" },
          ],
        };
      case "matchdayArena":
        return {
          ...base,
          kicker: "Arena-Flow",
          title: "Reveal anschauen, Gewinner verstehen, danach Tabelle oder Training prüfen.",
          detail: "PPs zeigen den echten Spieltagsbeitrag; Arena verändert nichts mehr, sie macht das Ergebnis lesbar.",
          terms: ["PPs", "Rank", "D1", "D2"],
          progressLabel: "Spieltag",
          progressPct: 68,
          shortcut: "Space = nächster Flow-Schritt",
          actions: [
            { label: "Saisonstand", targetView: "seasonV2", detail: "Ranking", tone: "primary" },
            { label: "Office", targetView: "hq", detail: "Folgen" },
            { label: "Einsatzliste", targetView: "lineup", detail: "Zurück" },
          ],
        };
      case "teams":
        return {
          ...base,
          kicker: "Kader-Flow",
          title: "Teamprofil lesen, Fokus setzen, Problemspieler direkt öffnen.",
          detail: "Nutze Gehaltsdruck, Value, Verträge und Training als Arbeitsmodi statt die Tabelle zu durchsuchen.",
          terms: ["Value", "Gehalt", "LZ", "POW"],
          progressLabel: "Kaderarbeit",
          progressPct: 36,
          shortcut: "Klick = Profil",
          actions: [
            { label: "Gebäude", targetView: "trainingV2", detail: "Upgrades", tone: "primary" },
            { label: "Transfermarkt", targetView: "marketV2", detail: "Kaufen/Verkaufen" },
            { label: "Einsatzliste", targetView: "lineup", detail: "Slots" },
          ],
        };
      case "trainingV2":
        return {
          ...base,
          kicker: "Gebäude-Flow",
          title: "Upgrade, Wartung und Unterhalt direkt am aktiven Save steuern.",
          detail: "Facilities V2 zeigt Zustand, Effizienz, Kosten und Wirkung auf Training, Recovery und Scouting.",
          terms: ["Upgrade", "Wartung", "Unterhalt", "Effizienz"],
          progressLabel: "Infrastruktur",
          progressPct: 48,
          shortcut: "Upgrade prüfen = Vorschau laden",
          actions: [
            { label: "Training", targetView: "trainingCompact", detail: "Kader", tone: "primary" },
            { label: "Office", targetView: "hq", detail: "Prioritäten" },
            { label: "Transfermarkt", targetView: "marketV2", detail: "Budget" },
          ],
        };
      case "trainingCompact":
      case "training":
        return {
          ...base,
          kicker: "Entwicklungs-Flow",
          title: "Steigerer zuerst, Rückschritt-Risiko danach, Upgrades direkt beim Spieler.",
          detail: "XP kann Upgrades ermöglichen; schwache Entwicklung und negative Netto-XP können Werte auch senken.",
          terms: ["XP", "OVR", "MVS", "Fatigue"],
          progressLabel: "Entwicklung",
          progressPct: 52,
          shortcut: "Upgrade-Button = Spielerfokus",
          actions: [
            { label: "Office", targetView: "hq", detail: "Prioritäten", tone: "primary" },
            { label: "Einsatzliste", targetView: "lineup", detail: "Fit prüfen" },
            { label: "Transfermarkt", targetView: "marketV2", detail: "Bedarf" },
          ],
        };
      case "market":
        return {
          ...base,
          kicker: "Markt-Alt",
          title: "Die alte Marktansicht bleibt lesbar, der Hauptflow liegt aber in Transfermarkt v2.",
          detail: "Wenn du handeln willst, führt dich der Hauptpfad immer in die modernere Deal-Ansicht.",
          terms: ["MW", "Value", "Gehalt", "OVR"],
          progressLabel: "Transfers",
          progressPct: 42,
          shortcut: "/ oder Ctrl+K = Suchen",
          actions: [
            { label: "Transfermarkt v2", targetView: "marketV2", detail: "Hauptansicht", tone: "primary" },
            { label: "Office", targetView: "hq", detail: "Prioritäten" },
            { label: "Historie", targetView: "history", detail: "Deals" },
          ],
        };
      case "marketV2":
        return {
          ...base,
          kicker: "Markt-Flow",
          title: "Kandidaten links vergleichen, Profil mittig lesen, Vertrag rechts sauber vorbereiten.",
          detail: "Transfermarkt v2 ist die Hauptansicht: erst Bedarf und Fit, dann Cash/Gehalt, dann die Entscheidung.",
          terms: ["MW", "Fit", "Gehalt", "Bedarf"],
          progressLabel: "Transfers",
          progressPct: 48,
          shortcut: "Suche + Teamfilter = Deal-Funnel",
          actions: [
            { label: "Office", targetView: "hq", detail: "Prioritäten", tone: "primary" },
            { label: "Einsatzliste", targetView: "lineup", detail: "wenn bereit" },
            { label: "Historie", targetView: "history", detail: "Deals" },
          ],
        };
      case "season":
      case "seasonV2":
        return {
          ...base,
          kicker: "Tabellen-Flow",
          title: "Rang, Punkte und Bereichsstärken als Story lesen.",
          detail: "POW/SPE/MEN/SOC zeigen, warum Teams in bestimmten Disziplinen tragen oder wackeln.",
          terms: ["Rank", "PPs", "POW", "SOC"],
          progressLabel: "Liga-Lage",
          progressPct: 78,
          shortcut: "Tabellenkopf = sortieren",
          actions: [
            { label: "Arena", targetView: "matchdayArena", detail: "Spieltag", tone: "primary" },
            { label: "Office", targetView: "hq", detail: "Ursachen" },
            { label: "Preisgeld", targetView: "prize", detail: "Ausblick" },
          ],
        };
      case "players":
        return {
          ...base,
          kicker: "Spieler-Flow",
          title: "Erst Leistung scannen, dann Profil, Training oder Verkauf öffnen.",
          detail: "OVR ist der Schnellvergleich; PPs und MVS sagen mehr über echten Nutzen im Spiel.",
          terms: ["OVR", "PPs", "MVS", "MW"],
          progressLabel: "Scouting",
          progressPct: 34,
          shortcut: "Klick = Profil",
          actions: [
            { label: "Training", targetView: "trainingCompact", detail: "Entwicklung", tone: "primary" },
            { label: "Office", targetView: "hq", detail: "Rollen" },
            { label: "Transfermarkt", targetView: "marketV2", detail: "Vergleich" },
          ],
        };
      case "encyclopedia":
        return {
          ...base,
          kicker: "Lexikon",
          title: "Kennzahlen und Systeme transparent nachlesen.",
          detail: "Suche nach Abkürzungen, klicke GameTerm-Chips oder springe direkt von OVR, MVS und PPs in die Erklärung.",
          terms: ["OVR", "PPs", "MVS", "XP"],
          progressLabel: "Transparenz",
          progressPct: 60,
          shortcut: "Ctrl+K = Begriff suchen",
          actions: [
            { label: "Spieler", targetView: "players", detail: "Kennzahlen sehen", tone: "primary" },
            { label: "Einsatzliste", targetView: "lineup", detail: "Score anwenden" },
            { label: "Training", targetView: "trainingCompact", detail: "Setpoints prüfen" },
          ],
        };
      default:
        return {
          ...base,
          kicker: "Flow",
          title: "Nutze Next Play und die Schnellnavigation für den nächsten sinnvollen Schritt.",
          detail: "Die Hilfepunkte an Abkürzungen erklären Werte direkt im Kontext.",
          terms: ["OVR", "PPs", "MVS", "Value"],
          progressLabel: "Navigation",
          progressPct: 24,
          shortcut: "Ctrl+K = Schnellzugriff",
          actions: [
            { label: "Home", targetView: "home", detail: "Briefing", tone: "primary" },
            { label: "Transfermarkt", targetView: "marketV2", detail: "Handeln" },
            { label: "Office", targetView: "hq", detail: "Zentrale" },
          ],
        };
    }
  }, [input.activeView, input.gameFlowPhase, input.globalNextLabel, input.globalNextTitle, input.homeV2Tab, input.preseasonWizardStepId]);

  const foundationFlowLoopStages = useMemo<FoundationFlowLoopStage[]>(
    () => [
      { id: "briefing", label: "Briefing", detail: "Home & Hinweise", targetView: "homeV2", views: ["home", "homeV2", "inbox", "inboxV2", "cockpit"] },
      { id: "market", label: "Markt", detail: "Deals & Wishlist", targetView: "marketV2", views: ["market", "marketV2", "history", "historyV2"] },
      { id: "hq", label: "Office", detail: "Druck & Planung", targetView: "hq", views: ["teams", "training", "trainingCompact", "trainingV2", "players", "teamSettings"] },
      { id: "office", label: "Office", detail: "Kapitän & Board", targetView: "hq", views: ["homeV2"] },
      { id: "lineup", label: "Einsatz", detail: "Slots & Captain", targetView: "lineup", views: ["lineup"] },
      { id: "arena", label: "Arena", detail: "Reveal & Auswertung", targetView: "matchdayArena", views: ["matchdayArena", "matchdayResult", "season", "seasonV2", "ranks", "diszis", "prize", "seasonPreview"] },
    ],
    [],
  );

  const activeFlowLoopIndex = useMemo(() => {
    if (input.activeView === "homeV2" && input.homeV2Tab === "office") {
      const officeIndex = foundationFlowLoopStages.findIndex((stage) => stage.id === "hq");
      if (officeIndex >= 0) {
        return officeIndex;
      }
    }
    const index = foundationFlowLoopStages.findIndex((stage) => stage.views.includes(input.activeView));
    return index >= 0 ? index : 0;
  }, [foundationFlowLoopStages, input.activeView, input.homeV2Tab]);

  return {
    activeFlowCoach,
    foundationFlowLoopStages,
    activeFlowLoopIndex,
  };
}
