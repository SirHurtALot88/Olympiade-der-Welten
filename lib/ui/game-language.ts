export const GAME_LANGUAGE = {
  screens: {
    lineup: "Einsatzliste",
    formBoard: "Form Board",
    transferMarket: "Transfermarkt",
    training: "Training & Gebäude",
    seasonReview: "Saisonrückblick",
  },
  actions: {
    ready: "Bereit",
    save: "Speichern",
    confirm: "Bestätigen",
    submit: "Bestätigen",
    continue: "Weiter",
  },
  flow: {
    setLineupLabel: "Einsatzliste setzen",
    setLineupCta: "Weiter: Einsatzliste setzen",
    confirmLineupLabel: "Einsatzliste bestätigen",
    confirmLineupCta: "Weiter: Einsatzliste bestätigen",
    lineupMissing: "Einsatzliste fehlt",
    formCardPoolLabel: "Formkarten-Pool prüfen",
    formCardPoolCta: "Weiter: Formkarten-Pool",
    formCardPoolReadyHint: "Pool bereit — Zuweisung optional",
    finalizeTransfersLabel: "Transfers finalisieren",
    finalizeTransfersCta: "Transfers finalisieren",
    finalizeTransfersPendingHint: "Bestätigen, um die Formkarten zu verteilen",
  },
} as const;

export type GameLanguageKey = typeof GAME_LANGUAGE;
