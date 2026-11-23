export const GAME_LANGUAGE = {
  screens: {
    lineup: "Taktik",
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
    setLineupLabel: "Taktik setzen",
    setLineupCta: "Weiter: Taktik setzen",
    confirmLineupLabel: "Taktik bestätigen",
    confirmLineupCta: "Weiter: Taktik bestätigen",
    lineupMissing: "Taktik fehlt",
    formCardPoolLabel: "Formkarten-Pool prüfen",
    formCardPoolCta: "Weiter: Formkarten-Pool",
    formCardPoolReadyHint: "Pool bereit — Zuweisung optional",
    finalizeTransfersLabel: "Transfers finalisieren",
    finalizeTransfersCta: "Transfers finalisieren",
    finalizeTransfersPendingHint: "Bestätigen, um die Formkarten zu verteilen",
  },
} as const;

export type GameLanguageKey = typeof GAME_LANGUAGE;
