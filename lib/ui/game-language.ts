export const GAME_LANGUAGE = {
  screens: {
    lineup: "Einsatzliste",
    formBoard: "Form Board",
    transferMarket: "Transfermarkt",
    training: "Training & Gebaeude",
    seasonReview: "Saisonrueckblick",
  },
  actions: {
    ready: "Bereit",
    save: "Speichern",
    confirm: "Bestaetigen",
    submit: "Bestaetigen",
    continue: "Weiter",
  },
  flow: {
    setLineupLabel: "Einsatzliste setzen",
    setLineupCta: "Weiter: Einsatzliste setzen",
    confirmLineupLabel: "Einsatzliste bestaetigen",
    confirmLineupCta: "Weiter: Einsatzliste bestaetigen",
    lineupMissing: "Einsatzliste fehlt",
    formCardPoolLabel: "Formkarten-Pool pruefen",
    formCardPoolCta: "Weiter: Formkarten-Pool",
    formCardPoolReadyHint: "Pool bereit — Zuweisung optional",
    finalizeTransfersLabel: "Transfers finalisieren",
    finalizeTransfersCta: "Transfers finalisieren",
    finalizeTransfersPendingHint: "Bestaetigen, um die Formkarten zu verteilen",
  },
} as const;

export type GameLanguageKey = typeof GAME_LANGUAGE;
