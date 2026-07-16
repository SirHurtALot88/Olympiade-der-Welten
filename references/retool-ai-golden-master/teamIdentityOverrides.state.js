// term: teamIdentityOverrides
// id: teamIdentityOverrides
// type: datasource
// subtype: JavascriptQuery
// page: transfermarktPage
// folder: unknown
// updatedAt: unknown
// codeField: value
// dependencies: ({
  'Cash Creators': {
    archetype: 'cash_creator',
    description: 'Versucht möglichst immer 12 Spieler zu halten, um flexibel zu verkaufen und Gewinne zu realisieren. Gibt daher meist 1-Jahres-Verträge.',
    roster: { target: 12, rationale: 'sell-flexibility' },
    contracts: { preferredLengthYears: 1 }
  },
  'C-C': {
    archetype: 'cash_creator',
    description: 'Alias von Cash Creators.',
    roster: { target: 12, rationale: 'sell-flexibility' },
    contracts: { preferredLengthYears: 1 }
  },
  'W-L': {
    archetype: 'mercenary_roster',
    description: 'Spielt größtenteils (ca. 80%) mit Spielern mit Trait "mercenary". Ausnahmen erlaubt, aber nicht erwünscht.',
    traitPreferences: {
      requiredPrimary: ['mercenary'],
      requiredShareTarget: 0.8,
      exceptionsAllowed: true,
      exceptionsDiscouraged: true
    }
  },
  'T-T': {
    archetype: 'trainer_culture',
    description: 'Mag Spieler mit "Diligent" oder generell positiven Traits, die Training/Motivation signalisieren (Future: Training-System).',
    traitPreferences: {
      preferred: ['diligent'],
      preferredPositiveTraits: true,
      futureSystem: 'training'
    }
  }
})
// extractionStatus: complete_or_primary_match
{{ ({
  'Cash Creators': {
    archetype: 'cash_creator',
    description: 'Versucht möglichst immer 12 Spieler zu halten, um flexibel zu verkaufen und Gewinne zu realisieren. Gibt daher meist 1-Jahres-Verträge.',
    roster: { target: 12, rationale: 'sell-flexibility' },
    contracts: { preferredLengthYears: 1 }
  },
  'C-C': {
    archetype: 'cash_creator',
    description: 'Alias von Cash Creators.',
    roster: { target: 12, rationale: 'sell-flexibility' },
    contracts: { preferredLengthYears: 1 }
  },
  'W-L': {
    archetype: 'mercenary_roster',
    description: 'Spielt größtenteils (ca. 80%) mit Spielern mit Trait "mercenary". Ausnahmen erlaubt, aber nicht erwünscht.',
    traitPreferences: {
      requiredPrimary: ['mercenary'],
      requiredShareTarget: 0.8,
      exceptionsAllowed: true,
      exceptionsDiscouraged: true
    }
  },
  'T-T': {
    archetype: 'trainer_culture',
    description: 'Mag Spieler mit "Diligent" oder generell positiven Traits, die Training/Motivation signalisieren (Future: Training-System).',
    traitPreferences: {
      preferred: ['diligent'],
      preferredPositiveTraits: true,
      futureSystem: 'training'
    }
  }
}) }}
