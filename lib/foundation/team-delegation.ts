import type {
  DelegationBereich,
  DelegationStufe,
  DelegationWahl,
  TeamControlSettings,
  TeamDelegation,
} from "@/lib/data/olyDataTypes";

/**
 * DELEGATION JE BEREICH — wer entscheidet bei einem menschlichen Team: der Mensch oder die KI?
 *
 * Chris am 18.11., woertlich: „Wir brauchen die Möglichkeit, dass Ramonas Teams z. B. automatisch
 * picken, aber sie die Käufe und Verkäufe managed“ und praezisiert: „Es muss quasi eine
 * halbautomatische Option geben. Einsätze laufen KI-mäßig und werden auto eingesetzt, aber die
 * Teams mit Käufen und Verkäufen macht man selbst. Entwicklung stellt die KI ein, aber man kann sie
 * quasi manuell überschreiben, wenn man möchte.“
 *
 * Drei feste Stufen plus Einzelschalter je Bereich. Die Einzelschalter gehen der Stufe vor. Das
 * Prinzip in jedem delegierten Bereich: **Mensch ueberschreibt, KI respektiert das.** Die KI fuellt
 * nur, was der Mensch nicht selbst gesetzt hat (Einsatzliste: Luecken; Training: Spieler ohne
 * eigene Wahl).
 *
 * Konzept, Ablauf eines Spieltags mit drei Menschen und offene Fragen:
 * docs/design/mehrspieler-delegation-18-11.md.
 *
 * Bestehende Spielstaende tragen kein `delegation`-Feld. Fuer Chris und Franky gilt dann „voll
 * selbst“ — exakt das Verhalten von vorher. Nur Ramonas Teams starten ohne Feld in der
 * Halbautomatik (Chris, 18.11.: „Standard ist Halbautomatik, sobald man sie als Spielerin wählt“).
 */

/** Ramonas feste Besitzer-ID. Gab es als Eintrag in `DEFAULT_TEAM_OWNERS` schon vor dem Login. */
export const RAMONA_OWNER_ID = "ramona_local";

export const DELEGATION_BEREICHE: readonly DelegationBereich[] = [
  "einsatzliste",
  "draft",
  "transfers",
  "training",
  "gebaeude",
  "sponsor",
  "ausruestung",
  "vorstand",
];

export const DELEGATION_BEREICH_LABEL: Record<DelegationBereich, string> = {
  einsatzliste: "Taktik und Formkarten",
  draft: "Draft-Picks",
  transfers: "Käufe, Verkäufe und Verträge",
  training: "Training und Entwicklung",
  gebaeude: "Gebäude",
  sponsor: "Sponsorwahl",
  ausruestung: "Ausrüstung (Truhen und Lager)",
  vorstand: "Budget-Gespräch mit dem Vorstand",
};

export const DELEGATION_STUFE_LABEL: Record<DelegationStufe, string> = {
  voll_selbst: "Voll selbst",
  halbautomatik: "Halbautomatik",
  voll_ki: "Voll KI",
};

/**
 * Was jede Stufe je Bereich bedeutet. Halbautomatik nach Chris' Vorgabe (18.11. abends, wörtlich:
 * „ramona draftet und kauft und verkauft selber alles andere startet mit AI“): Draft-Picks und
 * Kaeufe/Verkaeufe/Vertraege macht der Mensch, alles andere (Einsatzliste, Training, Gebaeude,
 * Sponsor) startet auf KI und kann je Bereich auf „selbst“ umgestellt werden.
 */
export const DELEGATION_STUFEN: Record<DelegationStufe, Record<DelegationBereich, DelegationWahl>> = {
  voll_selbst: {
    einsatzliste: "selbst",
    draft: "selbst",
    transfers: "selbst",
    training: "selbst",
    gebaeude: "selbst",
    sponsor: "selbst",
    ausruestung: "selbst",
    vorstand: "selbst",
  },
  halbautomatik: {
    einsatzliste: "ki",
    draft: "selbst",
    transfers: "selbst",
    training: "ki",
    gebaeude: "ki",
    sponsor: "ki",
    ausruestung: "ki",
    // Chris-Entscheid 23.11. (PM, Frage 3): Ramona kauft selbst, soll aber nicht mit dem Vorstand verhandeln muessen.
    vorstand: "ki",
  },
  voll_ki: {
    einsatzliste: "ki",
    draft: "ki",
    transfers: "ki",
    training: "ki",
    gebaeude: "ki",
    sponsor: "ki",
    ausruestung: "ki",
    vorstand: "ki",
  },
};

/** Voreinstellung je Besitzer, solange am Team keine eigene Delegation gespeichert ist. */
export function defaultDelegationStufeForOwner(ownerId: string | null | undefined): DelegationStufe {
  return ownerId === RAMONA_OWNER_ID ? "halbautomatik" : "voll_selbst";
}

export function isDelegationStufe(value: unknown): value is DelegationStufe {
  return value === "voll_selbst" || value === "halbautomatik" || value === "voll_ki";
}

export function isDelegationBereich(value: unknown): value is DelegationBereich {
  return typeof value === "string" && (DELEGATION_BEREICHE as readonly string[]).includes(value);
}

export type ResolvedTeamDelegation = {
  stufe: DelegationStufe;
  /** Aus der Voreinstellung des Besitzers abgeleitet, nicht am Team gespeichert. */
  ausVoreinstellung: boolean;
  bereiche: Record<DelegationBereich, DelegationWahl>;
  trainingSelbstSpielerIds: string[];
};

/**
 * Die wirksame Delegation eines Teams. Fuer KI- und passive Teams ist alles „ki“ — dort gibt es
 * keinen Menschen, der etwas entscheiden koennte. Die Mechaniken fragen trotzdem `controlMode`
 * selbst ab; diese Funktion beantwortet nur die Frage fuer menschliche Teams.
 */
export function resolveTeamDelegation(
  settings: Pick<TeamControlSettings, "controlMode" | "ownerId" | "delegation"> | null | undefined,
): ResolvedTeamDelegation {
  if (!settings || settings.controlMode !== "manual") {
    return {
      stufe: "voll_ki",
      ausVoreinstellung: true,
      bereiche: { ...DELEGATION_STUFEN.voll_ki },
      trainingSelbstSpielerIds: [],
    };
  }
  const gespeichert: TeamDelegation | null | undefined = settings.delegation;
  const stufe = isDelegationStufe(gespeichert?.stufe) ? gespeichert!.stufe : defaultDelegationStufeForOwner(settings.ownerId);
  const bereiche = { ...DELEGATION_STUFEN[stufe] };
  for (const [bereich, wahl] of Object.entries(gespeichert?.bereiche ?? {})) {
    if (isDelegationBereich(bereich) && (wahl === "selbst" || wahl === "ki")) {
      bereiche[bereich] = wahl;
    }
  }
  return {
    stufe,
    ausVoreinstellung: !isDelegationStufe(gespeichert?.stufe),
    bereiche,
    trainingSelbstSpielerIds: Array.from(new Set(gespeichert?.trainingSelbstSpielerIds ?? [])),
  };
}

/** Erledigt die KI diesen Bereich eines MENSCHLICHEN Teams? `false` fuer KI-/passive Teams. */
export function isBereichDelegiert(
  settings: Pick<TeamControlSettings, "controlMode" | "ownerId" | "delegation"> | null | undefined,
  bereich: DelegationBereich,
): boolean {
  if (!settings || settings.controlMode !== "manual") return false;
  return resolveTeamDelegation(settings).bereiche[bereich] === "ki";
}

/**
 * Normalisiert eine eingehende Delegation (API). Unbekannte Bereiche/Werte fallen weg; die Liste
 * der selbst trainierten Spieler bleibt, wie sie am Team stand — sie gehoert dem Trainingsweg,
 * nicht dem Einstellungsweg.
 */
export function normalizeTeamDelegationInput(
  input: unknown,
  bisher: TeamDelegation | null | undefined,
  now: string = new Date().toISOString(),
): TeamDelegation | null {
  if (input == null || typeof input !== "object") return null;
  const roh = input as { stufe?: unknown; bereiche?: unknown };
  if (!isDelegationStufe(roh.stufe)) return null;
  const bereiche: Partial<Record<DelegationBereich, DelegationWahl>> = {};
  if (roh.bereiche && typeof roh.bereiche === "object") {
    for (const [bereich, wahl] of Object.entries(roh.bereiche as Record<string, unknown>)) {
      if (isDelegationBereich(bereich) && (wahl === "selbst" || wahl === "ki")) {
        bereiche[bereich] = wahl;
      }
    }
  }
  return {
    stufe: roh.stufe,
    bereiche: Object.keys(bereiche).length > 0 ? bereiche : null,
    trainingSelbstSpielerIds: bisher?.trainingSelbstSpielerIds ?? null,
    geaendertAm: now,
  };
}

/**
 * Traegt ein, dass der Mensch das Training dieses Spielers selbst gesetzt hat (oder nimmt es mit
 * `selbst: false` wieder heraus). Rein: liefert die neue Delegation, schreibt nichts.
 */
export function withTrainingSelbstSpieler(
  settings: Pick<TeamControlSettings, "controlMode" | "ownerId" | "delegation">,
  playerId: string,
  selbst: boolean,
  now: string = new Date().toISOString(),
): TeamDelegation {
  const wirksam = resolveTeamDelegation(settings);
  const ids = new Set(wirksam.trainingSelbstSpielerIds);
  if (selbst) ids.add(playerId);
  else ids.delete(playerId);
  return {
    // Die Stufe wird festgeschrieben, damit eine Voreinstellung (Ramona) nicht stillschweigend
    // wechselt, wenn sich spaeter die Voreinstellung aendert.
    stufe: wirksam.stufe,
    bereiche: settings.delegation?.bereiche ?? null,
    trainingSelbstSpielerIds: ids.size > 0 ? Array.from(ids).sort() : null,
    geaendertAm: now,
  };
}
