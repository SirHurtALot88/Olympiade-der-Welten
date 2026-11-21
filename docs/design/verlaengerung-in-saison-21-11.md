# Verlängerung während der Saison (21.11., Welle 4)

Auftrag (Arbeitsliste 21.11.): „Vertragsverlängerung während der Saison — gilt ab sofort, laufende Saison zählt mit."
Draft-Picks aus Saison 1 (Festkonditionen) werden erst am Ende von Saison 1 verhandelt (Chris 21.11.).

## 1. Wie es vorher war

- **Ein Dienst für Mensch und KI:** `lib/contracts/contract-renewal-service.ts` (`previewContractRenewalAction`,
  `applyContractRenewalAction`). Mensch: `POST /api/contracts/renewal` (Dry-Run, dann Apply mit Token), Dialog
  `app/foundation/teams-v2/ContractRenewalNegotiationModal.tsx`. KI: Saisonende-Tick (`computeSeasonEndContractTick`,
  Quelle `ai_contract_renewal`) und die Verkaufsrunde im Transferfenster (`ai-transfer-window-session-service.ts`).
- **Die Begrenzung auf das Saisonende** saß an zwei Stellen: der Phasen-Riegel `evaluateGamePhaseAction(…, "renew_contract")`
  (`lib/foundation/game-phase-action-policy.ts`) ließ nur das Saisonende-/Vorsaison-Fenster und das Setup vor Spieltag 1
  zu; die Route hat produktive Schreibzugriffe sonst mit 409 abgewiesen. Dazu die UI (`selectedTeamRosterActionsAvailable`
  graute „Verlängern" mitten in der Saison aus).
- **Gehalt wird einmal pro Saison gebucht**, am Saisonende, als Summe (`applySponsorSettlement`, Komponente `salary_deduct`,
  Summe aus `getTeamActualSalaryTotal`). „Gehalt je Spieltag" ist reine Anzeige (Saison / Anzahl Spieltage). Es gibt keine
  Spieltags-Buchung, die man doppelt oder rückwirkend treffen könnte — das Risiko liegt allein darin, dass die Saisonsumme
  mit dem *aktuellen* Rostergehalt gerechnet wird.
- **Laufzeit:** `contractLength` zählt Saisons einschließlich der laufenden und wird am Saisonende gesenkt; die Wahrheit ist
  `contractEndSeasonNumber`. `endSaisonFuerNeuenVertrag` (`lib/contracts/vertragslaufzeit.ts`) rechnete schon vor dieser
  Arbeit „laufende Saison zählt mit", solange die Phase nicht Saisonende ist.

## 2. Was jetzt gilt

| Regel | Umsetzung |
|---|---|
| Verlängern zwischen den Spieltagen | Phasen-Riegel: `renew_contract` auch in `season_active` (Warnung `in_season_renewal_window`) |
| Mensch und KI über denselben Dienst | `previewContractRenewalAction`/`applyContractRenewalAction`; die KI-Hilfe `ki-verlaengerung-in-saison.ts` ruft genau diese |
| Laufende Saison zählt mit | `endSaisonFuerNeuenVertrag`: in Saison 3 auf 2 Saisons = bis Ende Saison 4; `contractLength` 2, Status „aktiv" |
| Gehalt ab sofort, nichts rückwirkend, nichts doppelt | Vermerk `RosterEntry.inSaisonVerlaengerung {seasonId, spieltageAlt, spieltageGesamt, altesGehalt, neuesGehalt, endSaisonNummer}`; `getTeamActualSalaryTotal` mischt die Saisonsumme nach Spieltagen (`mischeSaisongehalt`). Beispiel: 4 von 10 Spieltagen zu 6, Rest zu 8 = 7,2. Der Vermerk gilt nur in seiner Saison und nur solange das Rostergehalt dem neuen Gehalt entspricht |
| Vorstands-Gehaltstopf hart | unverändert im Dienst: `pruefeVerlaengerungGegenVorstandFreigabe` (Mensch und KI gleich). Der Gehaltstopf zählt das volle neue Jahresgehalt, weil er an `roster.salary` hängt |
| Mindestlaufzeit | 2 Saisons (Laufzeit 1 wäre keine Verlängerung, die laufende zählt ja mit): `in_season_renewal_min_length_2` |
| Einmal je Spieler und Saison | Vermerk, `in_season_renewal_already_done` (gilt auch für den Menschen) |
| Nur Verträge, die mit dieser Saison auslaufen | wie bisher `renewalEligible` (`contractLength <= 1`) |
| Saison-1-Draft-Picks | `in_season_renewal_draft_s1`: in Saison 1 gesperrt, wer im `seasonState.ligaDraft` als Pick des Teams steht |
| Nach dem letzten Spieltag | `in_season_renewal_season_over` — dann gilt das Saisonende-Fenster wie bisher |
| Rückweg | `OLY_VERLAENGERUNG_IN_SAISON=0` (Server; für die Oberfläche zusätzlich `NEXT_PUBLIC_OLY_VERLAENGERUNG_IN_SAISON=0`): Phasen-Riegel zu, Dienst blockt mit `in_season_renewal_disabled`, KI schweigt — alles wie vorher |

Die Ereigniszeile trägt `decisionReason: "in_season_renewal:ab_spieltag_N"`.

### KI

`lib/contracts/ki-verlaengerung-in-saison.ts`, aufgerufen beim Spieltagsabschluss (`matchday-progress-service.ts`, neben dem
KI-Reha-Bau, Fehler kippen den Spieltagswechsel nie). **Keine neue Heuristik:** die Entscheidung ist die Zeile des
Saisonende-Ticks (`bewerteVertraegeFuerKi` -> `buildPreviewRow`: Kassenlage, Rest-Kader, Moral, TCO, Strategie). Neu ist nur der
Zeitpunkt, eng gefasst:

- nur Verträge mit Laufzeit 1, nur KI-Teams und Menschen-Teams mit delegiertem Bereich „Käufe, Verkäufe, Verträge";
- nur Verlängern, nie Freigeben (wer am Saisonende gehen würde, bleibt unberührt);
- einmal je Spieler und Saison (Vermerk) und je Spieler an **einem** festen Spieltag (Hash über Saison/Team/Spieler, Spieltag 2 bis
  Gesamt−3), damit nicht jeder Spieltagsabschluss die ganze Liga durchrechnet;
- Empfehlung unter 2 Saisons wird nicht in-season umgesetzt; Vorstands-Gehaltstopf und alle Sperren prüft der gemeinsame Dienst.

### Hooks (Moral, Trainingswunsch, Treueprämie)

Beim Verlängern läuft über den Dienst weiter die Moral-Bewertung (`assessPlayerMorale`: Forderungsmodifikator, Laufzeitgrenze,
„lehnt Verlängerung ab") — in der Saison mit echten Einsätzen, also oft strenger als am Saisonende. Weitere Folgeeffekte
(Treueprämie / `vorstand-praemien`) sind auf `main` noch nicht vorhanden (liegen auf `claude/sammel-21-11-c`, PR #1673) und
wurden nicht nachgebaut. Hook-Punkt dort bleibt unverändert: `applyContractRenewalAction` schreibt das Ereignis
`contract_renewed`; wer daran hängt, greift in-season gleich.

## 3. Oberfläche

- Dialog (`ContractRenewalNegotiationModal`): Block „Mitten in der Saison — gilt ab Spieltag N · läuft bis Ende Saison X",
  daneben Gehalt **bisher / neu**, groß je Saison, klein je Spieltag (Chris-Regel 18.11.). Laufzeit 1 ist gesperrt, neue
  Fehlertexte für alle `in_season_*`-Gründe.
- Kader und Verträge (`FoundationTeamsNewLook`, `FoundationTeamsDetailPanel`): „Verlängern" ist zwischen den Spieltagen für das
  eigene Team aktiv (Tooltip: „gilt ab dem nächsten Spieltag, die laufende Saison zählt mit"). „Verkaufen" bleibt im Saisonende-Fenster.

## 4. Prüfung

- `tests/verlaengerung-in-saison.test.ts` (13 Fälle): Phasen-Riegel mit Schalter, Laufzeit (Saison 3 -> Ende Saison 4), Gehalt alt/neu
  anteilig ohne Rück-/Doppelbuchung (höher und niedriger), einmal je Saison, Mindestlaufzeit, nur auslaufende Verträge, S1-Draft,
  Vorstands-Gehaltstopf, Schalter aus, nach dem letzten Spieltag, Saisonende-Fall unverändert, KI-Kandidaten und KI-Lauf.
- Wertungs-Fingerabdruck: `GESAMT eaafed96150e` unverändert (Engine nicht angefasst).
- Aufnahmen aus der echten App: `docs/design/verlaengerung-in-saison-21-11/`.
