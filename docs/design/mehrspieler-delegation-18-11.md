# Mehrspieler und Delegation je Manager (18.11.)

Auftrag von Chris, 18.11., wörtlich:

> „wichtig ist auch, dass ALL das weiterhin im Multiplayer möglich ist, wenn ich Franky als Spieler noch hinzufüge und
> ggf. Ramona auch mal mitmachen möchte. Wir brauchen die Möglichkeit, dass Ramonas Teams z. B. automatisch picken, aber
> sie die Käufe und Verkäufe managed, weil das macht sie am liebsten.“

> „Es muss quasi eine halbautomatische Option geben. Einsätze laufen KI-mäßig und werden auto eingesetzt, aber die Teams
> mit Käufen und Verkäufen macht man selbst. Entwicklung stellt die KI ein, aber man kann sie quasi manuell
> überschreiben, wenn man möchte.“

Dazu: Chris und Franky stehen standardmäßig auf „Voll selbst“, Ramona auf „Halbautomatik“. Während Chris die Saison
spielt, regelt die KI die Vorfälle in Ramonas Teams. Chris sieht im Taktgeber, in der Inbox und auf der Startseite nur
seine eigenen Teams. Ramonas kritische Punkte halten seine Leertaste nicht an.

Die Oberfläche für die Einstellungen kommt später als Mockup. Dieses Dokument und der PR liefern die Daten, die
Mechanik für Einsatzliste und Training, den Login für Ramona und die Lückenliste.

---

## 1. Ist-Stand (vor dem 18.11.)

| Baustein | Ort | Stand |
|---|---|---|
| Besitz je Team | `TeamControlSettings.controlMode/ownerId/ownerSlot` (`lib/data/olyDataTypes.ts`) | `manual`/`ai`/`passive`; Besitzer Chris `user_local`, Franky `franky_remote_placeholder`. `ramona_local` stand nur in `DEFAULT_TEAM_OWNERS`, ohne Login und ohne Zuordnung. |
| KI-Schalter | `aiLineupApplyEnabled`, `aiTransferAutoApplyEnabled`, `aiSellAutoApplyEnabled` | Gelten nur für `controlMode: "ai"`. Ein `manual`-Team hat keinen Weg, einen Bereich an die KI zu geben. |
| KI-Aufstellung | `applyAiLegacyLineupBatchLocally` (`lib/ai/ai-legacy-lineup-batch-apply-service.ts`) | `manual` wird immer übersprungen (`skipped_manual`). Fehlt die Einsatzliste, blockiert der Spieltag mit `missing_manual_lineup`. |
| KI-Training | `reevaluateAiTrainingModesForMatchday` | Nur `controlMode: "ai"`. |
| Login | `lib/auth/config.ts` | Zwei feste Benutzer (`"chris" \| "franky"`). |
| Schreibschutz | `authorizeServerRoomWrite`, `resolveAuthoritativeWriteOwnerId`, `canLocalUserManageTeam` | Außerhalb eines Raums generisch je Besitzer-ID. Im Raum über das Sitz-Token, ebenfalls generisch. |
| Räume | `lib/room/online-room-model.ts` | Host plus **ein** Gast (`resolveFrankyParticipant` = erster `role: "player"`). |

## 2. Lücken aus der Mehrspieler-Prüfung

Schwere: **hoch** = funktioniert mit mehreren Menschen falsch, **mittel** = funktioniert, aber falsch angezeigt oder
blockiert unnötig, **niedrig** = Schönheitsfehler. „Gebaut“ heißt: in diesem PR behoben.

### 2.1 Auf main

| # | Stelle | Schwere | Befund | Fix |
|---|---|---|---|---|
| M1 | `lib/auth/config.ts:12` | hoch | Nur zwei Benutzer. Ramona konnte sich nicht anmelden. | **Gebaut:** `AUTH_USERNAMES = ["chris","franky","ramona"]`, Passwort aus `OLY_USER_<NAME>_PASSWORD`, Deploy-Dateien ergänzt. Ein weiterer Benutzer ist ein Eintrag. |
| M2 | `lib/foundation/team-control-settings.ts` (`applyChrisFrankyOwnershipToTeamControlSettings`, `deriveChrisFrankyTeamIdsFromSettings`, `getGameModeOwnershipLimits`) | hoch | Zuordnung kennt nur Chris/Franky. Jedes Team, das in keiner der zwei Listen stand, wurde KI, auch ein Team von Ramona. | **Gebaut:** dritte Besitzerin mit `ramonaTeamIds` (optional, ohne Angabe bleiben ihre Teams bei ihr), `ramonaMax`, Delegation wird beim Besitzerwechsel zurückgesetzt. |
| M3 | `app/api/team-settings/ownership/route.ts` | hoch | Nimmt nur `chrisTeamIds`/`frankyTeamIds`. | **Gebaut:** optional `ramonaTeamIds`, gleiche Prüfungen (doppelt, Obergrenze, mindestens ein Mensch). |
| M4 | `lib/ai/ai-legacy-lineup-batch-apply-service.ts:2040` | hoch | `manual` immer übersprungen; ein abwesender Mensch blockiert den Spieltag. | **Gebaut:** delegierte Einsatzliste (Abschnitt 4). |
| M5 | `lib/foundation/matchday-human-readiness.ts:32` | mittel | Alle `manual`-Teams zählen als „wartet noch“, auch wenn die KI aufstellt. | **Gebaut:** `lineupDelegated` zählt nie als ausstehend. |
| M6 | `lib/foundation/game-inbox-service.ts` (Team-Aufgaben) | mittel | `lineup_missing` etc. sind für das aktive menschliche Team `critical` und halten die Leertaste an, auch wenn die KI sie erledigt. | **Gebaut:** offene Aufgaben in delegierten Bereichen werden zum Hinweis („Die KI übernimmt“). |
| M7 | `lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx:7456` | mittel | `isOnlineGame: activeSaveGameMode === "online_4v4"`: in 1v1/2v2 sprang „Weiter“ in die Arena, bevor der Mitspieler aufgestellt hatte. | **Gebaut:** `isOnlineSaveMode()` (alle drei Größen). |
| M8 | `app/api/singleplayer-state/route.ts:573` | mittel | Löschsperre nur für `online_4v4`; einen 1v1/2v2-Spielstand durfte auch der Gast löschen. | **Gebaut:** `isOnlineSaveMode()`. |
| M9 | `lib/ai/ai-training-mode-reevaluation-service.ts:91` | mittel | Training menschlicher Teams nie von der KI. | **Gebaut:** delegiertes Training (Abschnitt 5). |
| M10 | `lib/room/online-room-model.ts:73` (`resolveFrankyParticipant`), `:120` (`resolveRoomParticipantActiveOwnerId`), `buildOwnershipForPreset`, `lib/socket/server.ts:195` (`setTeamSelection {chrisTeamIds, frankyTeamIds}`), `lib/room/room-store.ts:1285` (`applyRoomTeamSelection`) | hoch | Ein Raum kennt Host plus einen Gast. Ein dritter Teilnehmer bekommt `role: "player"`, keine Teams, und erscheint in der Foundation als Franky (jeder `player` wird zu `FRANKY_OWNER_ID`). | **Offen, nächster Schritt** (Aufwand Abschnitt 11). Bis dahin spielt Ramona über ihren Login im gemeinsamen Spielstand (Koop ohne Raum), das trägt dieser PR. |
| M11 | `lib/room/room-flow-controller.ts:226` (`getRequiredParticipants`), `buildRoomFlowState` | hoch | Im Raum muss jeder Mensch jeden Schritt „bereit“ melden, auch „Einsatzliste“ und „Formkarten“, wenn er sie delegiert hat. Ein abwesender Mensch hält den Raum an. | **Offen.** Vorschlag: `buildRoomFlowState` bekommt je Schritt die Teilnehmer, deren Teams den Bereich alle delegiert haben, und zählt sie als erledigt (Schritte `lineup`/`formcards` → `einsatzliste`, `training` → `training`, `buy_players`/`sell_players` → `transfers`, `facilities` → `gebaeude`). |
| M12 | `lib/season/matchday-auto-run-service.ts:297` (`simulateAiLineupState`) | mittel | Der Trockenlauf (`execute: false`) stellt nur KI-Teams hypothetisch auf; eine delegierte, noch leere Einsatzliste meldet dort `missing_manual_lineup`. Der echte Lauf ist richtig (der Batch füllt vor der Prüfung). | **Offen.** Vorschlag: `buildDelegatedLineupPreview` dort ebenfalls für delegierte Teams aufrufen. |
| M13 | `app/api/ai/picks-run/route.ts:99-128` | entfällt | Kader-KI auf menschliche Teams ist verboten (Chris, 19.08.). Die geplante Ausnahme „KI pickt in der Saison für den delegierten Draft nach“ ist **gestrichen** (Chris, 18.11.: „in der season gibt es keine käufe oder verkäufe“): gekauft wird nur im Fenster vor dem ersten Spieltag der Saison, verkauft nur zum Saisonende (`lib/market/transfer-window-policy.ts`, `TRANSFER_BUY_PHASES` ist leer). | **Erledigt durch Entscheidung:** nichts zu bauen. Beim Spielstart pickt der Liga-Draft Teams mit `draft: "ki"` mit (`app/api/new-game/route.ts`). |
| M14 | `lib/foundation/tabs/use-foundation-cross-tab-team-control.ts:152` (`localUserManualTeams`) | niedrig | Erkennt „eigene Teams“ über `user_local`/`ownerSlot "user"`/Etikett „Chris“, nicht über den angemeldeten Besitzer. | **Offen.** Vorschlag: `canOwnerManageTeam(settings, effectiveActiveOwnerId)` wie in `canManageTeamId`. |
| M15 | `lib/foundation/game-inbox-service.ts:313-318` (`getVisibleTeamIds`, Raum-Zweig) | niedrig | Raum-Besitz fest auf `user_chris`/`user_franky` bzw. Etikett „Chris“/„Franky“. Für Ramona greift nur der allgemeine Zweig. | **Offen**, mit M10 zusammen. |
| M16 | `app/foundation/team-settings/FoundationTeamSettingsNewLook.tsx`, `lib/foundation/tabs/foundation-page-types.ts:2088` | mittel | Die Team-Zuordnung in der Oberfläche hat nur Chris- und Franky-Spalten. | **Gebaut:** „Neues Spiel starten“ hat Ramona im Klub-Raster und in „Mitspieler (Franky, Ramona)“; „Wer steuert was“ zeigt „Ramona · Halbautomatik“. Bilder: `docs/design/mehrspieler-delegation-18-11/`. Die Delegations-Schalter selbst kommen mit dem Mockup. |
| M17 | `lib/foundation/team-control-settings.ts:153` (`isChrisOwnedTeamSettings`) | niedrig | Erkennt Chris auch am Etikett „Chris“. Für drei Menschen ungefährlich, weil Ramona vorher erkannt wird. | Gebaut ist die Reihenfolge (Ramona zuerst). |

Geprüft und **mehrspielertauglich** (je Team bzw. je Besitzer getrennt): Merkliste (`MerklisteEintrag.ownerId`),
Scouting-Beobachtungsliste (`ScoutingWatchlistEntry.teamId`), Startseite (`baueStartseiteModern` nimmt `teamId`),
Nach dem Spieltag (`activeManagerTeamId`), Taktgeber (`buildGameFlowState` je aktivem Team,
`activeTeamOpenInboxItems`), Inbox (`getVisibleTeamIds` je Besitzer, „alle Teams“ nur mit `hostMode`),
Vorstands-Freigabe auf Branch #1594 (`resolveVorstandFreigabe(gameState, teamId)`, dieselbe Funktion für KI und Mensch).

### 2.2 Auf offenen Branches (an die bauenden Agenten weitergeben)

| # | Branch | Stelle | Schwere | Befund | Fix-Vorschlag |
|---|---|---|---|---|---|
| B1 | `claude/transfermarkt-neu-18-11` (#1597) | `app/foundation/transfermarkt-modern/TransfermarktModern.tsx:109` | niedrig | `teamId = props.defaultTeamId ?? manageableTeamIds[0] ?? teams[0]?.teamId`: ohne eigenes Team fällt die Seite auf das erste Team der Liga (nur Ansicht, `darfVerwalten` schützt). | Ohne eigenes Team einen leeren Zustand zeigen statt Team 1. |
| B2 | `claude/transfermarkt-neu-18-11` (#1597) | `FoundationMarketV2ShellHost.tsx` (`freigabe: null`) | mittel | Die Vorstands-Freigabe ist hart aus, bis #1594 auf main ist. | Nach #1594: `berechneVorstandBudgetStand(gameState, activeManagerTeamId)` je aktivem Team einsetzen, nicht für „das menschliche Team“. |
| B3 | `claude/transfermarkt-neu-18-11` (#1597) | Kauf/Verkauf/Vertrag | mittel | Kennt keine Delegation: bei `transfers: "ki"` (Voll KI) müsste die Seite „Die KI kauft und verkauft für dieses Team“ zeigen und die Knöpfe sperren, bei Halbautomatik bleibt sie wie heute. | `isBereichDelegiert(settings, "transfers")` lesen; Anzeige erst mit dem Mockup. |
| B4 | `claude/finanzen-v2-stufe0-3-18-11` (#1594) | `lib/market/transfermarkt-local-service.ts` (`pruefeKaufGegenVorstandFreigabe`) | mittel | Prüft Kauf und Sammelkauf. Vertragsverlängerung (Gehaltstopf) und Draft-Pick des Menschen sind nicht geprüft. | Dieselbe Prüfung in den Verlängerungs- und Draft-Pfad, damit die delegierte KI und der Mensch dieselbe Grenze haben. |
| B5 | `claude/startseite-runde2-18-11` (#1590) | `lib/foundation/startseite-modern-zustand.ts` (`baueAbgeleiteteEntscheidungen`) | mittel | „Einsatzliste offen“ und „Pflicht-Minuskarte“ erscheinen auch, wenn die Einsatzliste delegiert ist. | Bei `isBereichDelegiert(settings, "einsatzliste")` statt „offen“ „Die KI stellt auf (du kannst übernehmen)“ zeigen; nicht als Entscheidung zählen. |
| B6 | `claude/spielerprofil-neu-18-11` (Branch noch nicht gepusht) | Trainings-Auswahl im Profil | mittel | Konnte nicht geprüft werden. Muss den Trainingswechsel über `/api/training` schicken, damit die Halbautomatik „selbst gesetzt“ vermerkt. | Kein direkter `PUT /api/singleplayer-state`; nach dem Wechsel „zurück auf KI“ anbieten, wenn `trainingDelegiert` in der Antwort `true` ist. |
| B7 | Training je Spieltag (im Bau, Mockup #1592) | Ziel-Disziplin und Weg | hoch | Das neue Datenmodell (Ziel-Disziplin, Weg, Intensität je Spieler) braucht dieselbe Regel „Mensch überschreibt, KI respektiert das“. | Ziel-Disziplin/Weg je Spieler mit Herkunft speichern oder `delegation.trainingSelbstSpielerIds` nutzen; die KI-Wahl für delegierte Teams in denselben Spieltagswechsel wie `reevaluateAiTrainingModesForMatchday` legen; Schreibweg über `authorizeServerRoomWrite`. |
| B8 | App-Rahmen (#1588, main) | `baueTaktPlan` | — | Liest nur das aktive Team. Mit M6 halten delegierte Aufgaben die Leertaste nicht mehr an. | Erledigt. Für die Anzeige „KI erledigt“ im Ablauf später ein eigener Status statt „gelb“. |

## 3. Datenmodell der Delegation

Am Team, in `TeamControlSettings.delegation` (optional). Fehlt das Feld, gilt die Voreinstellung des Besitzers. Damit
verhalten sich alle bestehenden Spielstände wie heute.

```ts
type DelegationBereich = "einsatzliste" | "draft" | "transfers" | "training" | "gebaeude" | "sponsor";
type DelegationStufe = "voll_selbst" | "halbautomatik" | "voll_ki";
type DelegationWahl = "selbst" | "ki";

type TeamDelegation = {
  stufe: DelegationStufe;
  bereiche?: Partial<Record<DelegationBereich, DelegationWahl>> | null; // Einzelschalter, gehen der Stufe vor
  trainingSelbstSpielerIds?: string[] | null; // „Mensch überschreibt“ im Training
  geaendertAm?: string | null;
};
```

Die drei Stufen (`DELEGATION_STUFEN` in `lib/foundation/team-delegation.ts`):

| Bereich | Voll selbst | Halbautomatik | Voll KI |
|---|---|---|---|
| Einsatzliste und Formkarten | selbst | **KI**, Mensch überschreibt | KI |
| Draft-Picks | KI-Draft nur für KI-Teams, für Menschen ausdrücklich gesperrt (M13). | Team mit `draft: "ki"`: der KI-Draft pickt mit, nach denselben Regeln (Vorstands-Freigabe, Kaderziel). Picks, die der Mensch schon gemacht hat, bleiben; die KI füllt bis zum Kaderziel. | **Beim Spielstart gebaut** (Liga-Draft pickt delegierte Teams mit). Ein Nachpicken in der Saison entfällt: es gibt dort keine Käufe (Chris, 18.11.). |
| Käufe, Verkäufe, Verträge | selbst | **selbst** | KI |
| Training und Entwicklung | selbst | **KI**, Mensch überschreibt | KI |
| Gebäude | selbst | KI (Empfehlung, F3) | KI |
| Sponsorwahl | selbst | KI (Empfehlung, F3) | KI |

Voreinstellung: Chris und Franky **Voll selbst**, Ramona **Halbautomatik** (`defaultDelegationStufeForOwner`). Weist
man Ramona ein Team zu, wird die Halbautomatik am Team gespeichert. Wechselt ein Team den Besitzer, fällt die
Delegation weg.

Lesen: `resolveTeamDelegation(settings)` und `isBereichDelegiert(settings, bereich)`. Schreiben:
`POST /api/team-settings/control` mit `control.delegation = { stufe, bereiche? }` (je Team, Schreibrecht: nur der Besitzer des Teams und der Host (F1, 18.11.), sonst wie jede
Team-Einstellung; `null` setzt auf die Voreinstellung zurück).

**Warum am Team und nicht am Manager:** jede Mechanik fragt ohnehin je Team (Batch, Training, Inbox), und ein Manager
mit zwei Teams kann sie verschieden führen. Eine Manager-Voreinstellung ist die Voreinstellung des Besitzers; eine
eigene Tabelle je Manager wäre eine zweite Wahrheit.

## 4. Einsatzliste und Formkarten (gebaut)

`applyAiLegacyLineupBatchLocally` erkennt ein menschliches Team mit `einsatzliste: "ki"` (`lineupDelegated`). Dann:

1. Die Einträge, die schon im Entwurf stehen, werden **gesperrt**: Spieler, Seite, Slot, Kapitänsbinde bleiben.
   Herausgenommen werden nur Verletzte (`player_unavailable`) und Spieler, die nicht mehr im Kader sind. Müde Spieler,
   die der Mensch aufgestellt hat, bleiben.
2. Für die offenen Plätze läuft **dieselbe KI** wie für jedes KI-Team (`buildAiLegacyLineupPreviewWithModifiers`), auf
   einem verkleinerten Kontext: ohne die gesperrten Spieler, Sollstärke je Seite um die gesperrten Plätze verringert.
   Die Engine selbst ist unverändert.
3. Formkarten und Intensität rechnet die KI für die ganze Aufstellung. Hat der Mensch selbst Formkarten (oder eine
   Team-Power) gesetzt, bleiben alle seine und die KI legt keine dazu (`mergeDelegatedLineupModifiers`).
4. Ein vollständiger Entwurf wird **nie** überschrieben, auch nicht mit `overwriteExisting`.
5. Ist der Spieltag schon angelaufen (eine Seite gebucht), ist der Entwurf eingefroren wie bei KI-Teams.

Wann die KI aufstellt: nach dem Spieltagswechsel im Hintergrund (`ai-batch-prewarm`) und spätestens beim Ausführen des
Spieltags (`matchday-auto-run-service`). Ramona findet ihre Einsatzliste also aufgestellt vor und kann sie ändern;
Chris' Spieltag wartet nicht auf sie.

Was ein delegiertes Team nicht mehr blockiert: Bereitschaft (`evaluateMatchdayHumanReadiness`), Arena-Sprung im
Online-Spiel, Inbox (`lineup_missing`, `lineup_not_submitted`, `formcards_open`, `formcards_negative_open` werden
Hinweise), damit der Taktgeber und die Leertaste.

Formkarten bei vollständig gesetzten Spielern (F3, Chris, 18.11.: „AI pickt formkarten für ramona ja“): hat der Mensch alle Spieler, aber keine Formkarte gesetzt, gilt der Entwurf für die KI als **nicht fertig** (`delegatedDraftLacksFormCards`). Sie legt die Karten nach, Spieler und Slots bleiben. Hat der Mensch auch nur eine Karte gesetzt, bleibt alles seins. Sobald Karten stehen, ist der Entwurf vollständig und wird nicht mehr angefasst (keine Neuberechnung bei jedem Batch). Nach Spieltagsstart bleibt er eingefroren.


## 5. Training (gebaut, Stand main)

Auf main besteht Training aus `trainingMode` (leicht/mittel/hart) und `trainingClass` je Spieler. Für ein menschliches
Team mit `training: "ki"`:

- `reevaluateAiTrainingModesForMatchday` bewertet es bei jedem Spieltagswechsel wie ein KI-Team (Fatigue-Schoner) und
  setzt fehlende Trainingsklassen einmal (dieselbe Auswahl wie die Vorsaison-KI).
- Setzt der Mensch über `/api/training` einen Spieler selbst, landet er in `delegation.trainingSelbstSpielerIds`. Die KI
  fasst ihn dann nicht mehr an.
- `POST /api/training` mit `zurueckAufKi: true` gibt ihn zurück; ab dem nächsten Spieltagswechsel entscheidet wieder
  die KI.

Mit „Training je Spieltag“ (Mockup #1592: Ziel-Disziplin, Weg, Intensität) muss dieselbe Regel auf die neuen Felder
(B7).

## 6. Weitere Bereiche (Konzept, nicht gebaut)

| Bereich | Heute | Delegation | Aufwand |
|---|---|---|---|
| Draft-Picks | KI-Draft nur für KI-Teams, für Menschen ausdrücklich gesperrt (M13). | Team mit `draft: "ki"`: der KI-Draft pickt mit, nach denselben Regeln (Vorstands-Freigabe, Kaderziel). Picks, die der Mensch schon gemacht hat, bleiben; die KI füllt bis zum Kaderziel. | **Beim Spielstart gebaut** (Liga-Draft pickt delegierte Teams mit). Offen: Nachpicken in der Saison über `picks-run` (klein). |
| Draft überspringen je Manager | Chris überspringt den Draft, die KI-Teams picken durch. | „Überspringen“ heißt für einen Menschen: seine Teams warten nicht im Draft-Takt. Mit `draft: "selbst"` pickt er danach in Ruhe (Kauffenster bleibt offen, bis er „fertig“ meldet); mit `draft: "ki"` pickt die KI im selben Durchlauf. Der Draft wartet nie auf einen abwesenden Menschen. | mittel |
| Käufe, Verkäufe, Verträge | KI-Kauf/-Verkauf nur für `controlMode: "ai"`. | Nur bei Voll KI. Dann dieselben KI-Läufe wie für KI-Teams, mit derselben Vorstands-Freigabe (#1594). Halbautomatik: der Mensch entscheidet, die KI tut nichts. | mittel |
| Gebäude | KI-Ausbau im Vorsaison-Plan nur für KI-Teams. | `gebaeude: "ki"`: derselbe Ausbau-Schritt aus `applyAiManagerPlan`, aus dem Freigabe-Budget. | klein bis mittel |
| Sponsorwahl | `chooseSponsorOfferForAiTeams` überspringt `manual`. | `sponsor: "ki"`: dieselbe Wahl. Der Mensch kann vor Saisonstart selbst wählen; hat er nicht gewählt, wählt die KI beim Saisonstart. | klein |

## 7. Ablauf eines Spieltags mit drei Menschen

Chris (Voll selbst, Host), Franky (Voll selbst), Ramona (Halbautomatik, heute nicht online).

1. **Spieltagswechsel** (`writeLocalMatchdayAdvance`): Training-Neubewertung für KI-Teams und Ramonas Teams (ihre selbst
   gesetzten Spieler bleiben). Danach im Hintergrund der KI-Batch: KI-Teams und Ramonas Teams werden aufgestellt.
2. **Chris** sieht im Taktgeber, in der Inbox und auf der Startseite nur seine Teams. Ramonas Teams erscheinen nur, wenn
   er sie gezielt auswählt oder „alle Teams“ einblendet; ihre offenen Punkte stehen dann als Hinweis „Die KI übernimmt“.
3. **Franky** stellt auf. Solange er fehlt, wartet der Arena-Sprung im Online-Spiel auf ihn (er hat nichts delegiert).
4. **Ramona** (falls sie doch reinschaut) findet ihre Einsatzliste fertig vor, tauscht einen Spieler, setzt ein
   Training selbst. Beides bleibt.
5. **Spieltag ausführen**: der Batch läuft noch einmal. Ramonas Entwurf ist vollständig und wird nicht angefasst; wird
   einer ihrer Spieler zwischendurch verletzt, setzt die KI genau ihn neu. `missing_manual_lineup` entsteht nicht.
6. **Ergebnis** für alle gleich.

Im Raum (M10/M11) gilt das erst, wenn ein dritter Sitz und die delegationsfähige Bereit-Pflicht gebaut sind. Bis
dahin: Ramona spielt mit eigenem Login im gemeinsamen Spielstand.

## 8. Draft überspringen pro Manager

Bisher: Chris überspringt den Draft, die KI-Teams picken durch, er pickt danach in Ruhe. Mit mehreren Menschen gilt:

- Der Draft-Takt wartet nur auf Menschen mit `draft: "selbst"`, die **anwesend** sind und nicht „überspringen“
  gewählt haben.
- „Überspringen“ ist eine Wahl je Manager, nicht für den Raum. Wer überspringt, pickt danach in Ruhe, solange das
  Kauffenster offen ist.
- Ramona (Halbautomatik) draftet selbst (Chris, 18.11. abends: „ramona draftet und kauft und verkauft selber alles
  andere startet mit AI“). Stellt sie den Bereich Draft auf KI, pickt die KI ihre Teams im selben Durchlauf wie die KI-Teams.
- Ist Ramona `draft: "selbst"` und pickt nicht selbst, wird **sinnvoll gepickt, als wäre das Team richtig KI-gesteuert** (Chris, 18.11., F4/F5: „nicht über so einen NOTFALL weg fahren! niemals“): derselbe organische Aufbau mit Team-Identität, Budget und Zusammensetzung, kein Auffüllen auf das Minimum. Der Stand der Umsetzung je Stelle steht in Abschnitt 12.

## 9. Entscheidungen zu F1–F5 (Chris, 18.11.)

Die frühere Fragenliste ist beantwortet. Wörtlich und mit Folge:

| # | Frage | Chris, 18.11. | Folge |
|---|---|---|---|
| F1 | Wer darf die Delegation eines Teams ändern? | „owner und host“ | Nur der **Besitzer** des Teams und der **Host** des Raums bzw. Spielstands, sonst niemand. Serverseitig in `POST /api/team-settings/control` (`authorizeTeamDelegationWrite` in `lib/room/server-authoritative-write-guard.ts`): im Raum Sitz-Token (Besitzer-Sitz oder `role: "host"`), ohne Raum die Sitzung (Besitzer-ID, Standard-Owner Chris oder Urheber des Spielstands). Test: `tests/mehrspieler-delegation-schreibrecht.test.ts` (Besitzer ja, Host ja, anderer Spieler nein, mit und ohne Raum). |
| F2 | Braucht der delegierte Draft in der Saison ein Nachpicken (M13, `picks-run`)? | „in der season gibt es keine käufe oder verkäufe“ | **Nein, M13 entfällt.** Kauf ist nur im Fenster vor dem ersten Spieltag (`isEarlySeasonTransferSetup`), Verkauf nur zum Saisonende; `TRANSFER_BUY_PHASES` ist leer. Es gibt keinen Weg, mitten in der Saison für ein menschliches oder delegiertes Team zu kaufen (nachgeprüft, `lib/market/transfer-window-policy.ts`, `transfermarkt-local-service.ts`). |
| F3 | Soll die KI Formkarten nachlegen, wenn der Mensch alle Spieler, aber keine Karte gesetzt hat? | „AI pickt formkarten für ramona ja“ | **Gebaut** (Abschnitt 4). Test in `tests/mehrspieler-delegation-einsatzliste.test.ts` (Karten werden nachgelegt, gesetzte Karten bleiben, zweiter Lauf ändert nichts). Die „Herkunftsmarke“ ist nicht nötig: ein Entwurf mit Karten gilt als vollständig. |
| F4/F5 | Füllt die KI ein Team, das nicht selbst pickt, bis zum Kadermindestkader? | „nein das minimum wird nicht gefüllt, sondern wenn ein spieler nicht selber pickt soll SINNVOLL gepickt werden als wäre das team richtig AI gesteuert, das soll nicht über so einen NOTFALL weg fahren! niemals“ | Kein Mindestkader-Auffüllen für Menschen. Ein Team, das nicht selbst pickt, bekommt den **vollen organischen KI-Aufbau** wie ein echtes KI-Team. Bestandsaufnahme und Stand: Abschnitt 12. Die frühere Empfehlung „Saisonstart füllt bis zum Minimum“ ist verworfen. |

Offen bleiben F6 (dritter Sitz im Raum, Abschnitt 11) und F7 (weitere Spieler später) wie bisher: erst wenn Ramona wirklich im Raum mitspielen will bzw. ab dem vierten Menschen.


## 10. Tests

- `tests/mehrspieler-delegation-einsatzliste.test.ts`: drei Menschen; Ramonas leere Einsatzliste wird aufgestellt,
  ihre gesetzten Spieler (Slot, Kapitän) bleiben, Verletzte werden ersetzt, vollständige Entwürfe werden nicht
  überschrieben, Chris/Franky bleiben `skipped_manual`; Bereitschaft und Inbox blockieren nicht; Chris' Inbox zeigt
  keine Ramona-Teams.
- `tests/mehrspieler-delegation-training.test.ts`: ohne Delegation unverändert, Halbautomatik bewertet wie KI, selbst
  gesetzte Spieler bleiben, Einzelschalter „Training selbst“.
- `tests/mehrspieler-delegation-schreibrecht.test.ts`: Delegation aendern nur Besitzer und Host (F1), mit und ohne Raum.
- `tests/auth-ramona-login.test.ts`: Login, Passwort-Variable, Sitzung, Deploy-Dateien, Zuordnung mit drei Menschen,
  Schreibschutz je Besitzer, Erhalt von Ramonas Teams bei Chris/Franky-Umstellungen.

Wertung und Arena-Motor sind nicht berührt (Fingerabdruck `ce8fcef66028` unverändert).

## 11. Dritter Sitz im Raum: nächster Schritt mit Aufwand

Chris (18.11.): Ramona als wählbare Person „mit denselben Rechten wie Franky“. Außerhalb eines Raums ist das gebaut
(Login, Besitzer, Zuordnung beim Spielstart, Delegation). Im Raum nicht. Gemessener Umfang:

| Teil | Stelle | Arbeit |
|---|---|---|
| Sitz statt Rolle | `lib/room/online-room-model.ts:73` (`resolveFrankyParticipant`), `:120` (`resolveRoomParticipantActiveOwnerId`) | Jeder Teilnehmer bekommt einen Sitz (`host`/`gast1`/`gast2`) oder trägt die Login-Besitzer-ID; heute wird jeder `player` zu Franky. |
| Raum-Modi | `PRESET_OWNERSHIP_TABLE`, `buildOwnershipForPreset`, `types/game.ts` (`RoomOwnershipPreset`) | Modi mit drei Menschen (z. B. 1+1+1, 2+2+2) oder eine freie Auswahl je Sitz. |
| Team-Auswahl | `lib/socket/server.ts:195` (`setTeamSelection {chrisTeamIds, frankyTeamIds}`), `lib/room/room-store.ts:1285` (`applyRoomTeamSelection`), `app/room/[roomCode]/RoomPageClient.tsx` | dritte Liste bzw. `Record<sitz, teamIds[]>`, Lobby-Oberfläche mit drittem Spieler. |
| Spiegel in den Spielstand | `room-store.ts` (`syncRoomOwnershipToBoundSave`, `startRoom`, `createRoomCoopSave`) | `ramonaTeamIds` an `applyGameModeOwnership`/`createRoomCoopSave` durchreichen (die Funktionen können es seit diesem PR). |
| Bereit-Pflicht mit Delegation | `lib/room/room-flow-controller.ts:226`, `buildRoomFlowState` (M11) | Teilnehmer, deren Teams den Bereich des Schritts delegiert haben, gelten als bereit. |
| Tests | `tests/smoke-multiplayer-*`, `tests/server-authoritative-write-guard.test.ts`, Raum-Tests | drei Sitze, Schreibschutz je Sitz, Notausgang bei Abwesenheit. |

**Schätzung:** 1,5 bis 2 Arbeitstage eines Bau-Agenten plus ein Opus-Review des Schreibschutzes. Die Raum-Logik ist an
rund 15 Stellen auf „Host + ein Gast“ gebaut; ein Teilumbau würde einen dritten Teilnehmer still als Franky behandeln.
Deshalb ist er in diesem PR bewusst nicht angefangen.

## 12. Mindestkader-Auffüllen für Menschen: Bestandsaufnahme (F4/F5, 18.11.)

Anforderung: ein menschliches Team, das nicht selbst pickt, bekommt denselben vollen KI-Aufbau wie ein echtes KI-Team
(organischer Aufbau mit Team-Identität, Budget, Zusammensetzung), keinen Notweg auf das Minimum.

| Stelle | Was dort läuft | Stand |
|---|---|---|
| Spielstart, `app/api/new-game/route.ts:121` + `lib/game/league-setup-draft-service.ts:225` | Teams mit `draft: "ki"` laufen im Liga-Draft über `runAiPicksExecutePreview` mit (`includeManualTeams`), organisch. | Bereits der volle KI-Weg. Nichts zu ändern. |
| Cockpit-Selbstheilung, `lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx:10320-10395` | Bei mindestens vier Teams unter Minimum (abgebrochener Erst-Draft) läuft `/api/ai/picks-run` mit `includeManualTeams`, auch für Menschen. | Voller organischer Weg, kein Fill. Gelassen. Nachteil: erfasst auch menschliche Teams mit `draft: "selbst"`, die noch selbst picken wollen (Chris-Regel 19.08.); bei Bedarf auf „nicht selbst pickend“ eingrenzen. |
| Wiederholung „Liga-Setup fehlgeschlagen“, `use-foundation-shell-router-body-scope.tsx:10434` | Wie oben, `/api/ai/picks-run`. | Voller organischer Weg. Gelassen. |
| Cockpit-Handgriff „Kader-Fill“, `lib/foundation/tabs/cockpit-handlers.ts:125` -> `app/api/ai/roster-fill/route.ts` -> `lib/ai/auto-roster-fill-service.ts:486` | Der alte Füll-Lauf ohne Qualitätsterm (`scoreRosterFillCandidate`), nur Saison 1, kauft auch für die eigenen Teams des Aufrufers (Test `tests/auto-roster-fill-service.test.ts:511` erwartet das ausdrücklich). | **Nicht geändert** (Bestandstest, ausdrücklicher Admin-Handgriff, ab Saison 2 gesperrt). Empfehlung: menschliche Teams dort ausnehmen oder den Handgriff auf `picks-run` umhängen. |
| Notfüllung im Pick-Kern, `lib/ai/ai-picks-run-service.ts:4473-4500` (`runSeason1ExecuteEmergencyMinFill`, Modus `season1_optimum_execute`) | Nach dem organischen Lauf füllt ein Notweg bis zum Minimum auf, für jedes Team im Lauf (KI wie delegiert). | **Nicht geändert** (Pick-Kern, parallele Analyse auf `claude/ki-pick-analyse-18-11`). |
| Notkauf im neuen Draft-Kern, `lib/draft/liga-draft-dienst.ts:430` (`notkauf_mindestkader`, Branch `claude/draft-neubau-kern-18-11`, noch nicht auf main) | Kauf mit `ausNotfall` bis zum Mindestkader. | **Nicht geändert**, nur gelistet. |
| Vorsaison-Markt ab Saison 2, `lib/ai/ai-preseason-background-service.ts:107-117` (`getAiTeamIds`) und `lib/ai/ai-transfer-window-session-service.ts:672-688` (`manualTeamIds`) | Nur Teams mit `controlMode: "ai"`. Menschliche Teams, auch mit `draft: "ki"`, bekommen ab Saison 2 weder Kauf noch Mindestkader-Rettung. | **Lücke, nicht geändert:** „Voll KI“ im Draft wirkt nur beim Spielstart. Ein Eingriff berührt den Pick-Kern und `protectManualPlayerTeams`; gehört in die Pick-Analyse. |
| Admin-Simulation, `lib/admin/season-simulation-runner.ts:1104` (Mindestkader-Refill) | Nur Testläufe der Simulation, nicht im Spiel. | Ohne Belang. |

Ein „Saisonstart prüft das Kaderminimum und füllt notfalls auf“ (frühere Empfehlung zu F5) wurde nie gebaut und
entfällt.
