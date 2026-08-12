# Offene Funde — Plan zur Abarbeitung (12.08.2026)

> Auftrag (Chris): „lass fable nen plan machen fuer die 5 punkte und kleinkram und dann wird
> das abgearbeitet mit sonnet und dir und reviewed". Dieses Dokument ist der Plan: klar
> geschnittene Arbeitspakete mit eigenen Dateien, je Paket eine Wert-Abnahme, Abhängigkeiten
> und eine ehrliche Priorisierung am Schluss. Hier wird NICHT gebaut. Alle Zahlen in diesem
> Dokument sind heute gemessen (Abbild bzw. Testlauf), keine Übernahmen aus dem Gedächtnis.

Messgrundlage: Live-Abbild über `live-save` (Beschaffung und Frische-Pflicht: siehe
`docs/AUDIT_PLAN_VOR_DER_RUNDE.md` Abschnitt 1). Für dieses Dokument neu gezogen:
**Abbild vom 12.08.2026, 10:50 UTC** — Frische bestätigt (jüngster Schreibzugriff des
aktiven Saves 10:49, eine Minute vor dem Push; Chris hat heute Vormittag gespielt).
Die fünf Spielstände des Abbilds (P4 misst über alle fünf):
`new-game-1786465783606-0kalpx` (**aktiv**, S1, 12.08. 10:49) ·
`new-game-1785823388048-1hf25q` (**Messkörper**, S2/MD10, 11.08.) ·
`new-game-1786348179682-ul6tzn` (10.08.) · `new-game-1785412846578-h0z7cl` (30.07.,
aktiv für `franky_remote_placeholder`) · `new-game-1784747079649-n90y4m` (26.07.).
Code-Stand der Messungen: Branch `claude/bugfixing-agent-run-1azwei` @ `aacff059`.

---

## Schnitt für die parallele Abarbeitung

| Paket | Kern-Dateien (Schreibzugriff) | hängt ab von | kollidiert mit |
|---|---|---|---|
| P1 Test-Bodensatz | nur `tests/**`, `docs/KNOWN_TEST_FAILURES.md` | — | niemandem (Testdateien exklusiv) |
| P2 Ziel-Refresh | `lib/board/team-season-objectives-service.ts` + eigene Tests | — | **P3, wenn P3 dieselbe Datei anfasst → P3 fasst sie NICHT an (s. u.)** |
| P3 Boardziele-GuV | `lib/finance/season-guv-resolver.ts`, `lib/foundation/finances/use-finances-view-model.ts`, NEUE Datei `lib/board/objective-settlement-cash-source.ts` | — | P2 nur lesend (Import), kein Schreibkonflikt |
| P4 `front_loaded` | `lib/contracts/contract-renewal-service.ts` + Mess-Skript | Regler-Entscheid von Chris | niemandem |
| P5 Spielerbilder | `lib/data/mediaAssets.ts`, `public/portraits/**`, `data/generated/portrait-files.json` | Bild-Dateien von Chris/Dropbox | niemandem |
| P6 Kleinkram | je Punkt eine Datei, s. Abschnitt | — | P6c/P6d berühren Sponsor-/Punkte-Dateien, nicht dieselben wie P2–P4 |

Reihenfolge: Die P1-MESSUNG ist bereits gelaufen (Ergebnis unten: 64 statt 144, mit
Töpfen); P1-Abarbeitung, P2 und P3 können sofort parallel starten (P3 ist bewusst so
geschnitten, dass es `team-season-objectives-service.ts` nicht anfasst). P4 wartet auf einen
Regler-Entscheid, die Messung darin nicht. P5 wartet auf Bild-Dateien, die Code-Hälfte nicht.
P6b und P1-Cluster 1 (13 Tests) sind DERSELBE Entscheid — zusammen vorlegen.
**Review-Regel für alle Pakete:** jede Abnahme ist eine WERT-Messung am Abbild oder ein
Unit-Test mit konstruiertem GameState — kein `grep` im Quelltext als Beweis (Fehlerklasse 3).

---

## Paket 2 — Ein Ziel-Refresh verliert erfüllte Ziele

### Befund mit Ursache (heute am frischen Abbild reproduziert)

`refreshTeamObjectiveState` am Abbild 12.08. 10:50 UTC, aktuelle Saison je Save:

- `1hf25q` (season-2): **225 → 222**. Weg: `A-A|sport-axis-spe` (completed, Reward 4),
  `M-M|sport-axis-spe` (completed, Reward 4), `M-S|player-top20-breakthrough` (completed,
  Reward 3). **11 C Abrechnungswirkung verschwinden kommentarlos.**
- `0kalpx` (season-1): **214 → 216**. Weg: `A-A|finance-net-transfer-balance` (failed,
  Penalty 2); neu: `A-A|finance-salary-ratio`, `A-A|sport-axis-spe`, `V-V|sport-axis-spe`.

(Die 444→441 der Erstmeldung zählte beide Saisons; die Menge der verlorenen Ziele ist
identisch.) Messmethode (beim Bau als `scripts/mess-ziel-refresh-stabilitaet.ts` einchecken,
nur lesend auf der Abbild-Kopie via `OLY_APP_SQLITE_PATH`): Save über
`createPersistenceService().getSaveById(id)` laden, `refreshTeamObjectiveState(gameState)`
aufrufen, Mengen-Diff der Schlüssel `teamId|objectiveId` der aktuellen Saison vorher/nachher
ausgeben (weg/neu je mit Status, Reward, Penalty, Source) plus die Kassenwirkung der
verlorenen Ziele (completed-Reward − failed-Penalty).

**Ursache, drei Mechanismen in einer Kette** (`lib/board/team-season-objectives-service.ts`):

1. **Der Merge wirft Gespeichertes weg.** `mergeStoredTeamObjectives` (Z. 2083–2087): ein
   gespeichertes Ziel, dessen `objectiveId` nicht im FRISCH erzeugten Slate vorkommt, wird per
   `continue` verworfen — `refreshTeamObjectiveState` (Z. 2617–2635) ersetzt danach den
   kompletten Saisonbestand durch das Merge-Ergebnis. Verlust ist also Systemverhalten, kein
   Randfall.
2. **Die Slate-Auswahl ist status-abhängig und darum nicht stabil.**
   `selectBoardObjectiveDrafts` (Z. 1712–1784) wählt 3–5 Ziele mit Prädikaten wie
   `status !== "completed"` (Z. 1741, 1751) und `status !== "open"` (Z. 1760, 1765/66, 1769)
   und `pickUrgentObjective` (failed > at_risk > open). **Genau der Moment, in dem ein Ziel
   erfüllt wird, wählt es ab** — der nächste Refresh (läuft bei jedem Spieltags-Apply,
   Standings-Apply, Preseason-Schritt) verliert es dann über Mechanismus 1. Dazu ist
   `slateSize` dynamisch aus `perceivedPressure` (Z. 1908–1918) — auch die Slate-GRÖSSE
   wandert zwischen Refreshes.
3. **Zwei Ziel-Familien tragen bewegliche Werte in der ID.**
   `sport-rank-${sportTarget.rank}` (Z. 1948) und
   `sport-axis-rank-${axis}-top-${targetRank}` (Z. 1087, targetRank hängt am AKTUELLEN Rang).
   Ändert sich der Rang, ändert sich die Identität — dasselbe Ziel wird zum „neuen" Ziel,
   das alte fällt durch Mechanismus 1.

### Was es kostet

Erfüllte Ziele verlieren ihren Reward in der Saisonabrechnung (am Messkörper 11 C über drei
Teams — vor der Abrechnung, und der Verlust wächst mit jedem weiteren Refresh bis Saisonende),
verfehlte verlieren ihre Strafe (0kalpx: −2 C verschwinden). Beides richtungslos zufällig —
die Abrechnung hängt davon ab, WANN zuletzt refresht wurde. Dazu UI-Vertrauensverlust:
Zielkarten verschwinden vor den Augen des Spielers.

### Einordnung

**Reparatur.** Kein Regler: es gibt keine Balance-Frage, nur eine gebrochene Invariante
(„einmal vergeben bleibt bis zur Abrechnung").

### Bauplan

1. **Vergabe von Bewertung trennen.** Die Slate-AUSWAHL läuft nur noch, wenn für
   (Saison, Team) noch KEINE gespeicherten Ziele existieren (Saisonstart / erste Vergabe /
   definierte Ereignisse wie Sponsor-Unterschrift für die Spiegel-Ziele). Jeder weitere Refresh
   bewertet ausschließlich die GESPEICHERTEN Ziele neu — gegen den vollen Kandidaten-Pool
   (`buildTeamObjectives` VOR der Slate-Auswahl), nicht gegen den Slate.
2. **Merge behält alles.** `mergeStoredTeamObjectives`: der `continue`-Zweig entfällt. Ein
   gespeichertes Ziel ohne frischen Kandidaten bleibt mit letztem Stand stehen und bekommt
   `source += "+status_stale"` (sichtbar im Audit, kein stilles Einfrieren).
3. **ID-Stabilität für die zwei beweglichen Familien.** Matching im Merge per Familien-Präfix
   (`sport-rank-`, `sport-axis-rank-<axis>-top-`), Zielmarke/Label werden weiter erneuert
   (der Kommentar Z. 2069–2075 begründet das bereits — Anzeige und Wertung nennen dieselbe
   Marke). Die persistierte ID bleibt die bei Vergabe geschriebene.
4. Callers (`legacy-matchday-result-apply-service`, `standings-apply-service`,
   `preseason-workflow-service`, `matchday-mvp-scoring-service`, API-Route) bleiben
   unverändert — Signatur von `refreshTeamObjectiveState` ändert sich nicht.

### Dateien

`lib/board/team-season-objectives-service.ts` (mergeStoredTeamObjectives,
selectBoardObjectiveDrafts-Aufrufstelle in buildTeamObjectives, refreshTeamObjectiveState),
`tests/team-season-objectives-service.test.ts`, neu `scripts/mess-ziel-refresh-stabilitaet.ts`.

### Abnahme (Wert-Invarianten)

- **Am Abbild beider Saves:** `refreshTeamObjectiveState` ist schlüssel-stabil:
  Menge {teamId|objectiveId} vorher == nachher, **weg = 0, neu = 0** (auf `1hf25q`: 225→225;
  auf `0kalpx`: 214→214). Die drei oben genannten completed-Ziele sind danach im
  Settlement (`buildTeamSeasonObjectiveSettlement`) als Zeilen mit Reward 4/4/3 enthalten.
- **Idempotenz:** `refresh(refresh(s))` == `refresh(s)` auf Schlüsselmenge UND Status je Ziel.
- **Unit-Test mit konstruiertem GameState** (nicht nur Abbild, Fehlerklasse
  „läuft nur im Ladepfad"): Ziel wird completed → zwei weitere Refreshes → Ziel existiert
  weiter mit status completed; Settlement zahlt den Reward genau 1×.
- **Vergabe-Test:** leerer Saisonbestand → Refresh erzeugt Slate (3–5 je Team); zweiter
  Refresh mit verändertem Rang/Status erzeugt KEINE neuen IDs außer über die definierten
  Ereignisse (Sponsor-Spiegel).

### Gefahr

- Slate-Inflation, falls „Ereignis-Zugänge" (Sponsor-Spiegel, board-confidence-budget-cut)
  nicht sauber als solche definiert werden — deshalb der Vergabe-Test oben.
- Bestehende Saves tragen bereits gewobbelte Bestände (z. B. 0kalpx: A-A hat
  net-transfer-balance gespeichert, der Generator würde heute salary-ratio wählen). Nach der
  Reparatur bleibt der GESPEICHERTE Bestand verbindlich — das ist gewollt, muss aber im
  PR-Text stehen, weil die Slates einzelner Teams anders aussehen als eine Neu-Vergabe.
- `tests/kompakter-payload-verfaelscht-den-vorstand-nicht.test.ts` prüft den Refresh auf
  kompaktem Payload — mitlaufen lassen, er darf nicht rot werden.

---

## Paket 3 — Vorstandsziele wandern mit der Kasse (GuV-Selbstbezug)

### Befund mit Ursache

- Cash-Ziele werten gegen den LEBENDEN Kontostand: `finance-rebuild-cash-buffer` misst den
  Liga-Rang von `row.cash` (Z. 1532–1546), `finance-salary-ratio` misst
  `salary/(cash+salary)` (Z. 284–289, 302–315), V1-`finance-cash-positive` direkt `row.cash`
  (Z. 1985–1994).
- Die Saisonende-Kette bucht Sponsor (`season-completion-service.ts:318`) und Gebäude VOR den
  Zielen (`applyTeamSeasonObjectiveRewards`, `season-completion-service.ts:501/510`,
  `season-end-tail-settlement.ts:85`). Jede Buchung verschiebt die Liga-Cash-Ränge → Status
  kippt → `cashDelta` der `boardziele`-Zeile ändert sich. Gemessen: bis 5,0 C je Team
  (Reward 3 + Penalty 2 eines Kipp-Ziels).
- Die Buchung selbst persistiert ihre Wahrheit bereits:
  `objectiveRewardApplyLogs[].payload.cashDeltaByTeamId`
  (`team-season-objectives-service.ts:2502–2531`). **Aber die GuV liest sie nicht:**
  `season-guv-resolver.ts:60–66` rechnet `buildTeamSeasonObjectiveSettlement(gameState)` bei
  JEDEM Aufruf live — auch für längst gebuchte Saisons. Gleiches Muster in
  `use-finances-view-model.ts:276–281`.

### Was es kostet

Die GuV-Zeile „Vorstandsziele" zeigt je nach Betrachtungszeitpunkt eine andere Zahl als
gebucht wurde — bis 5,0 C je Team. Der Spieler sieht nach dem Saisonende eine GuV, die nicht
zur Kontobewegung passt (die alte „Roter-Alarm"-Klasse), und jede Nachrechnung
(transfer-finance-audit) rechnet gegen eine bewegliche Zahl.

### Einordnung

**Reparatur** (Log-first). Der verbleibende Rest — dass die HOCHRECHNUNG vor der Buchung mit
der Kasse atmet — ist systembedingt (die Ziele SIND als Liga-Cash-Vergleich definiert) und
bereits über `provisional` gekennzeichnet; kein Regler, aber im PR-Text benennen.

### Bauplan

1. **Neue, kleine Datei `lib/board/objective-settlement-cash-source.ts`** (bewusst NICHT in
   `team-season-objectives-service.ts`, damit P2 parallel bauen kann):
   `getObjectiveCashByTeam(gameState): { byTeamId, gebucht: boolean }` — liest zuerst
   `objectiveRewardApplyLogs` der aktuellen Saison (`payload.cashDeltaByTeamId` = die
   GEBUCHTE Wahrheit), fällt nur ohne Log auf die Live-Projektion
   `buildTeamSeasonObjectiveSettlement` zurück. Exakt das Muster von `apronGebucht`
   (`season-guv-resolver.ts:75–77`).
2. `season-guv-resolver.ts:60–66` und `use-finances-view-model.ts:276–281` stellen auf diese
   Quelle um; `SeasonGuvParts` bekommt analog zu `apronGebucht` ein `boardzieleGebucht`, damit
   der Hover „Hochrechnung" von „gebucht" unterscheiden kann (Anzeigetext, kein neuer Rechenweg).
3. Prüfen, ob `transfer-finance-audit.ts:267` und `season-review-service.ts:422` auf dem
   Zustand VOR oder NACH der Buchung laufen — der Review entsteht in der Kette selbst und darf
   live rechnen; nachträgliche Aufrufe müssen über die neue Quelle gehen.

### Dateien

Neu `lib/board/objective-settlement-cash-source.ts`; `lib/finance/season-guv-resolver.ts`;
`lib/foundation/finances/use-finances-view-model.ts`; ggf. `lib/finance/season-end-guv.ts`
(nur das neue Flag im Parts-Typ); Tests neu `tests/objective-settlement-cash-source.test.ts`.

### Abnahme (Wert-Invarianten)

- **Auf einer Wegwerf-Kopie des Abbilds** ein Saisonende durchspielen
  (`scripts/e2e-saisonende-am-save-abbild.ts`): danach gilt für alle 32 Teams exakt
  `resolveSeasonGuvForTeam(...).posten[boardziele] == objectiveRewardApplyLogs.payload.cashDeltaByTeamId[teamId]`
  (Toleranz 0,0 — es ist dieselbe gespeicherte Zahl).
- **Beobachter-Invarianz:** nach der Buchung `team.cash` eines Teams künstlich um ±20
  verschieben (in-memory) → die `boardziele`-Zeile ändert sich um **0,00** (heute kippt sie).
  Das ist die direkte Verneinung des gemessenen 5,0-Drifts.
- **Ohne Log** (Zwischenstand): Quelle liefert die Live-Projektion und `gebucht == false` —
  Verhalten unverändert gegenüber heute, per Test festgehalten.
- Unit-Test mit konstruiertem GameState + Log (Fehlerklasse „nur Saisonende-Pfad").

### Gefahr

- `use-finances-view-model` ist der dokumentierte Client-Nachbau-Hotspot (Audit-Plan F2/F3):
  bei der Umstellung NICHT nebenbei die Sponsor-/Gebäude-Beschaffung anfassen; nur die
  Boardziele-Quelle tauschen, F2-Parität (`buildFinancesViewModel.guv == resolveSeasonGuvForTeam`)
  als Regressionstest mitlaufen lassen.
- Ältere Saves ohne `cashDeltaByTeamId` im Log-Payload: **heute gezählt — im Abbild
  existiert genau 1 `objectiveRewardApplyLog`, und es TRÄGT die Map** (0 Altformate über
  alle 5 Saves). Der Fallback (Projektion + Warnung) wird trotzdem gebaut, kostet drei
  Zeilen und fängt fremde/ältere Stände.

---

## Paket 4 — `front_loaded` kommt in der KI nie vor

### Befund

`lib/contracts/contract-renewal-service.ts`, Rangfolge seit `aacff059` (Z. 806–821):

1. Kassenklemme: `tightNow && cashPreservationProfile → back_loaded` (Z. 807), mit
   `tightNow = cash < requiredReserve + max(6, salaryIncrease*2)` (Z. 801).
2. Faktor: `gefaelle >= 0,15 → back_loaded` OHNE Kassen-Wache (Z. 812);
   `gefaelle <= −0,15 → front_loaded` NUR mit `cash >= requiredReserve + 10` (Z. 813).
3. Profil: `strongCashBuffer && futureReliefProfile → front_loaded` (Z. 818) mit
   `strongCashBuffer = cash >= requiredReserve + max(18; 0,35·salaryTotal)` (Z. 802);
   `wageSensitivity >= 8 && cash >= requiredReserve + 10 → front_loaded` (Z. 820).

Gemessen (Vorlauf): auf einem Spielstand wollen 4 von 7 echten Neuabschlüssen über das
Faktor-Gefälle `front_loaded` und **alle 4 scheitern an der Kassen-Wache**; die beiden
Profil-Front-Regeln (Z. 818/820) feuern auf allen fünf Spielständen **0-mal**. Rechnung dazu:
`requiredReserve = 3 + 0,08·salaryTotal + Strategiereserve (~10–25) + salaryIncrease·2`
(Z. 616–624) — bei salaryTotal ≈ 65 liegt die Front-Schwelle bei Kasse ≈ 28–43,
`strongCashBuffer` verlangt sogar Kasse ≈ requiredReserve + 21–35. Drei back_loaded-Pfade
ohne Wache stehen einem front_loaded gegenüber, das nur bei praktisch nie erreichter Kasse
öffnet: die Asymmetrie ist strukturell, nicht zufällig.

### Was es kostet

Die halbe Vertragsform-Mechanik (und der halbe Nutzen von Schritt 2 aus
`docs/APRON_UND_VERTRAGSFORMEN.md`: in fallende Faktor-Fenster früh zahlen) existiert im
Spiel nicht. KI-Kassen glätten schlechter, die Formverteilung kippt Richtung
back_loaded-Monokultur (Kontrollzahl D wacht darüber, aber die Ursache liegt hier).

### Einordnung — sauber getrennt

- **Reparatur (kein Entscheid nötig): die Messlücke.** Erst ein Mess-Skript, das je echtem
  KI-Renewal am Abbild protokolliert: `cash`, `requiredReserve`, Marge zur Front-Wache,
  `gefaelle`, gewählte Form, greifende Regel. Ohne diese Zeilen ist jeder Schwellen-Vorschlag
  geraten. (Die 4/7- und 0/5-Zahlen stammen aus dem Vorlauf; das Skript macht sie
  reproduzierbar und liefert die Margen-Verteilung.)
- **Aufräumen (kein Entscheid nötig):** Wenn die Messung bestätigt, dass Z. 818
  (`strongCashBuffer`-Pfad) auf allen Saves unerreichbar ist, ist das tote Regel-Prosa —
  entweder Schwelle in den Regler-Entscheid aufnehmen oder Zeile streichen. Nicht stumm
  stehen lassen: sie gaukelt eine Mechanik vor, die es nicht gibt.
- **Regler (Chris entscheidet, mit Zahlen aus der Messung):**
  1. Marge der Faktor-Front-Wache: heute `requiredReserve + 10`. Vorschlag zur Entscheidung:
     Varianten +10 / +5 / +0 durchmessen — wie viele der front-wollenden Renewals öffnen je
     Variante, und wie viele davon reißen anschließend das Cash-Gate (`ai_cash_buffer_required`)?
     Die Wache schützt echte Liquidität; sie zu senken ist Risikoappetit, kein Bugfix.
  2. `strongCashBuffer`-Schwellen (18 / 0,35·salaryTotal) — senken oder Regel streichen.
  3. NICHT zur Disposition: die Rangfolge Kassenklemme > Faktor > Profil und die Schwelle
     0,15 (beides entschieden und hergeleitet, `AI_CONTRACT_SHAPE_FACTOR_GEFAELLE_SCHWELLE`).

### Dateien

`lib/contracts/contract-renewal-service.ts` (nur `chooseAiRenewalContractShape` +
`buildAiRenewalCashGate`-LESUNG, das Gate selbst bleibt), neu
`scripts/mess-formwahl-am-abbild.ts`, `tests/contract-renewal-service`-Erweiterung.

### Abnahme (Wert-Invarianten)

- Mess-Skript liefert je Save die Tabelle (Renewal → Regel → Form) und reproduziert vorab
  die Ist-Zahlen (4/7 blockiert; 0 Treffer Z. 818/820).
- Nach dem Regler-Entscheid: am Abbild wählen **> 0** der front-wollenden echten Renewals
  `front_loaded` (exakte Zahl aus der Varianten-Messung wird VOR dem Bau als Erwartung
  festgeschrieben, wie bei den 14/216 in `docs/APRON_UND_VERTRAGSFORMEN.md` 5 D), und
  **0** dieser Renewals reißt anschließend das Cash-Gate.
- Bestehende Abnahmen bleiben: 14/216 → back_loaded an `1hf25q` unverändert (die
  back-Seite darf sich nicht mitbewegen); Summen-Invariante `Σ schedule == annualSalary ×
  Laufzeit`; Wächter „Formwechsel ändert Apron-Abgabe um 0,00".
- Endmaßstab bleibt der Langlauf-A/B (Kreditzinsen, Blockaden) — an der Flip-Quote wird
  nicht nachjustiert (Beschluss in APRON_UND_VERTRAGSFORMEN 5 D).

### Gefahr

Eine zu großzügige Front-Wache erzeugt genau die Kreditketten, gegen die Regel 1 gebaut
wurde — deshalb ist die Wache ein Regler mit Chris' Unterschrift, und die Abnahme enthält
die „0 gerissene Cash-Gates"-Zeile.

---

## Paket 5 — Drei Spieler können auf dem Server nie ein Bild bekommen

### Befund

- `lib/data/mediaAssets.ts:19–27`: drei Spieler mit hartem Pfad auf
  `/Users/chrisfalk/.cursor/projects/…` — `player-0154-riley-le-rouge`,
  `player-2968-toothkrix`, `player-2676-peacock`. `resolveMediaSourcePath`
  (`lib/media/serveMediaAsset.ts:33–41`) remappt AUSSCHLIESSLICH den Dropbox-Präfix
  (`/Users/chrisfalk/Library/CloudStorage/Dropbox/`) — die `.cursor`-Pfade können auf dem
  Server unter keiner Konfiguration existieren: ENOENT für immer, UI fällt still auf
  Initialen.
- Der statische Index `data/generated/portrait-files.json` ist **leer** (`[]`, 3 Bytes),
  `public/portraits/` enthält nur die README. **Alle 2984 Spieler** laufen daher über die
  API-Route in die Legacy-Map, deren Einträge Dropbox-Pfade sind → der Server zeigt Bilder
  NUR, wenn `OLY_MEDIA_DROPBOX_ROOT` im Container gesetzt ist UND die Dropbox-Kopie dort
  liegt. Ob das der Fall ist, kann von hier niemand sehen.

### Was es kostet

Drei Spieler garantiert ohne Bild; für alle anderen hängt „Bild oder Initialen" an einer
unbeobachteten Server-Konfiguration. Rein kosmetisch (keine Rechnung hängt daran — Audit-Plan
Prio 7), aber dauerhaft sichtbar.

### So stellt man den Server-Zustand OHNE Serverzugang fest

Die API-Route ist öffentlich. Chris führt aus (zsh-sicher, keine `#`-Kommentare):

```sh
for id in player-0154-riley-le-rouge player-2968-toothkrix player-2676-peacock player-0001-umbros player-2969-lakshmi-ekelemann; do curl -s -o /dev/null -w "$id %{http_code} %{content_type}\n" "https://olympiade.duckdns.org/api/media/player-portrait/$id"; done
```

Lesart: `200 image/*` = Bild kommt; `4xx/5xx` oder `application/json` = kein Bild. Die drei
ersten IDs MÜSSEN heute fehlschlagen (Beweis des Befunds); `umbros`/`lakshmi` zeigen, ob der
Dropbox-Remap auf dem Server grundsätzlich funktioniert. Alternative mit mehr Reichweite:
`olympiade.duckdns.org` in der Netzwerk-Policy der Claude-Umgebung freischalten (CLAUDE.md),
dann kann ein Agent die Deckung über alle 2984 IDs selbst messen.

### Einordnung

**Reparatur** (drei Spieler + Index-Weg), plus eine **Asset-Entscheidung von Chris**
(vollständige Migration nach `public/portraits/`, s. u.).

### Bauplan

1. **Bilddateien beschaffen — heute per Dropbox-Suche vorgeklärt:**
   `Toothkrix.jpg` und `Riley Le Rogue.jpg` LIEGEN in Chris' Dropbox
   (`/Chris/Olympiade der Welten/Mark VI Cardgame/Spieler/`, 270 KB bzw. 140 KB, der Agenten-
   Dropbox-Connector findet sie); ob sie dasselbe Motiv wie die `.cursor`-PNGs zeigen,
   bestätigt Chris mit einem Blick. **Peacock existiert in der Dropbox NICHT** (Suche über
   png/jpg/webp: 0 Treffer) — diese eine Datei muss von Chris' Mac kommen
   (`.cursor/projects/.../assets/Peacock.png`). Ablage als `riley-le-rouge.jpg`,
   `toothkrix.jpg`, `peacock.png` in `public/portraits/` (Slug-Matching von
   `getStaticPortraitUrl`, `mediaAssets.ts:63–71`, greift dann ohne Map-Eintrag).
2. `npm run portraits:index` → `portrait-files.json` trägt die drei; die statische Kette hat
   Vorrang vor der Legacy-Map — die toten Map-Einträge Z. 19–27 danach LÖSCHEN (tote Pfade,
   die stehen bleiben, sind die nächste Falle).
3. **Empfehlung an Chris (Entscheid):** komplette Portrait-Migration in `public/portraits/`
   (2984 Dateien, vorab Größensumme messen; ggf. auf Web-Größe verkleinern) — danach ist der
   Server unabhängig von Dropbox-Mount und `OLY_MEDIA_DROPBOX_ROOT`, und der Befund kann als
   Klasse abgeschlossen werden. Ohne diesen Entscheid bleibt der Rest der Liga auf dem
   Dropbox-Weg — funktioniert, ist aber unbeobachtet.

### Dateien

`lib/data/mediaAssets.ts` (nur Map-Einträge löschen), `public/portraits/*` (neu),
`data/generated/portrait-files.json` (generiert), keine Code-Logik-Änderung. Die
Portrait-Schattenkopie in `use-foundation-shell-router-body-scope.tsx:966` (Audit-Plan PT1)
gehört NICHT in dieses Paket — sie ist ein eigener kleiner Aufräum-PR, sonst kollidiert P5
mit dem Foundation-Refactor-Cluster aus P1.

### Abnahme (Wert-Invarianten)

- Wert-Test (kein String-Grep): `getPlayerPortraitBrowserUrl` liefert für die drei IDs eine
  `/portraits/…`-URL; `getStaticPortraitUrl` trifft per Slug. Läuft als Unit-Test gegen den
  eingecheckten Index.
- Nach Deploy: die curl-Schleife oben liefert für die drei IDs `200 image/*`
  (Chris' 30-Sekunden-Abnahme).
- Deckungsmessung am Abbild (Audit-Plan PT2) einmal ausführen und die Verteilung der Kette
  (statisch / Legacy-Map / API / kein Bild) im PR dokumentieren — DAS ist die Zahl, an der
  die Migrations-Entscheidung hängt.

### Gefahr

Gering. Einzige echte Falle: Map-Einträge löschen, BEVOR die statischen Dateien da sind —
Reihenfolge im Bauplan einhalten. Und: `player-2969-lakshmi-ekelemann` (Z. 21–22) ist ein
Dropbox-Pfad, KEIN `.cursor`-Pfad — nicht mitlöschen.

---

## Paket 6 — Kleinkram (je Punkt: lohnt es?)

| # | Punkt | Beleg | Urteil | Begründung / Abnahme |
|---|---|---|---|---|
| a | KI-Gleichstands-Entscheider hängt an ID-Länge | `sponsor-offer-service.ts:1175` `(offer.offerId.length % 7) * 0.01` | **Reparieren, klein** | Gemessen folgenlos (0/256 Teams wählen anders), ABER er hat einen Test grün gefärbt, dessen eigentlicher Term abgeschaltet war — der Term ist aktiv schädlich für die Testaussage. Ersatz: deterministischer Tiebreak über `offerId`-Hash o. Ä.; Abnahme: Wahlverteilung über 256 Teams am Abbild identisch (0 Flips), und der betroffene Test prüft danach WERTE des echten Terms. |
| b | V4-Zielachsen tot im Erzeugungspfad, Achsen-Term in `scoreOfferForAi` lebt | Erzeugung emittiert 0 Achsen (gemessen); Term nur synthetisch fütterbar | **Aufräumen ODER Chris-Entscheid** | Entweder Achsen kommen zurück (Feature-Entscheid Chris) oder der tote Scoring-Term fliegt raus. Bis dahin: Wert-Test „Erzeugung emittiert keine Achsen" als Wache, damit niemand auf den toten Term kalibriert. |
| c | `SPONSOR_AI_TERM_INSURANCE_SHARE = 0.02` am falschen Sockel kalibriert (Doku 31,6 %, real 30,5 %) | `sponsor-offer-service.ts:845,1082` | **So lassen, Doku korrigieren** | Wirkung des Fehlers < 4 % eines 2-%-Terms. Kommentarzahl richtigstellen, fertig. Neukalibrierung nur, falls Chris am Sponsor-Verhalten ohnehin dreht (Regler). |
| d | Tagespunkte zweimal gerechnet | `lib/foundation/season-matchday-points.ts` (`summiereSpieltagsPunkteAusLedger`) vs `build-field-race-ledger.ts:105 ff.` (`pointsByMatchday` inline) | **Reparieren, klein** | Klasse „zwei Rechenstellen": heute zeichengleich, morgen Drift. Field-Race-Ledger stellt auf die eine Funktion um. Abnahme: Ledger-Ausgabe am Messkörper byte-identisch vor/nach (Wert-Diff über alle Teams × Spieltage == 0). |
| e | `usesArchivedSnapshotValues` prüft Felder, die `StandingRecord` nicht hat | `team-management-overview.ts:461–464` gegen Typ `olyDataTypes.ts:278 ff.`; Archiv-Zweig Z. 528/648–651 | **Löschen — Messung liegt vor** | Heute am Abbild über ALLE 5 Saves gezählt: **0 von 160 Standings** tragen `rosterCount`/`salaryTotal`/`marketValueTotal` — der Archiv-Zweig sieht nie Daten, Bedingung + Zweig sind toter Code über lebendem Anzeige-Pfad. Abnahme: Overview-Ausgabe am Abbild vor/nach der Löschung wert-identisch. |
| f | `standing.form` wird gelesen, nie geschrieben | Leser `team-management-overview.ts:656/891` (`financeForm`), `use-season-v2-standings-derivations.ts:44` (Sortier-FALLBACK hinter `seasonFormBonusByTeamId`); Schreiber: nur der alte Sheet-Import (`season-standings-sheet.ts:394`) | **Leseweg entfernen — Messung liegt vor** | Heute gezählt: **0 von 160 Standings** haben `form` gesetzt. „Definierte Kennzahl daraus machen" wäre ein Feature (Chris müsste sagen, was Form IST); bis dahin täuschen die Leser eine Kennzahl vor. Der Sortierpfad hat mit `seasonFormBonusByTeamId` bereits eine lebende Erstquelle — nur der tote Fallback fliegt. Abnahme: Sortierreihenfolge am Abbild vor/nach wert-identisch. |
| g | `teamIdentities.playerMin` gespeichert 8, normalisiert 7..12 | `roster-limits.ts:37–40` ignoriert Identity-`playerMin` bewusst (fix 8) | **So lassen, dokumentieren** | Der gespeicherte Wert ist tote Daten, die Normalisierung ist die Wahrheit und dokumentiert. Ein Backfill riskiert Merge-Konflikte in Saves für null Spielwirkung. Ein Satz im Typ-Kommentar (`olyDataTypes.ts:572`) genügt. |
| h | `roundCash`-Drift max 0,05 C | Zeilenweise Rundung vs Summenrundung | **So lassen, dokumentieren** | Unter der Anzeige-Auflösung (0,1). Eine „Reparatur" (Summen-Rundung) verschöbe die Drift nur an eine andere Naht. Im GuV-Kopfkommentar als bekannte Eigenschaft notieren. |
| i | Kauf-Vorschau antwortet 409 bei „nein" | Vorschau-Route | **So lassen, dokumentieren** | Semantisch schief, funktional korrekt und vom Client so erwartet. Statuswechsel wäre Client+Server-Koordination für null Nutzerwirkung. Kommentar an der Route, fertig. |
| j | Zwei Namen für denselben Spieltags-Score (`teamResult.score` vs `finalPreviewScore`) | `matchday-mvp-scoring-service.ts:312` (`score: teamResult.finalPreviewScore`) | **Wache bauen, nicht umbenennen** | Umbenennung wäre ein Massen-Touch quer durch Arena/Resolve (Kollisionsrisiko mit allem). Stattdessen ein Wert-Test an der Naht: für jeden gewerteten Spieltag am Abbild `score == finalPreviewScore` exakt — der Test macht aus „Disziplin" eine Invariante. |

**Paket-Schnitt:** a+b+c (Sponsor-Dateien) ein PR; d+j (Punkte/Arena-Nähte) ein PR; e+f
(team-management-overview) ein PR; g+h+i sind reine Doku-Zeilen und können jedem PR beiliegen.
Kein Kleinkram-PR fasst Dateien aus P2–P5 an.

---

## Paket 1 — Der Test-Bodensatz („144 rote Tests")

### Erste Messung: die 144 sind veraltet — es sind 64

Volllauf heute (12.08., 10:55–11:09 UTC, Branch `claude/bugfixing-agent-run-1azwei` @
`aacff059`, Container-Umgebung mit per Hook geseedetem Store):
**6446 Tests, 64 rot in 32 Dateien, 5 skipped, Exit 1** (JSON-Report liegt vor). Die 144 aus
`docs/KNOWN_TEST_FAILURES.md` stammen von einem älteren Branch-Stand; die dort gelisteten
Cluster (Pfad-Portabilität, API-Mocks, `extract-retool-*`, `data-adapter`,
`draft-repair-economy`, `media-assets`, `transfermarkt-formatting`, `whole-season-dryrun`)
sind heute **grün**; die Playwright-Spec läuft gar nicht mehr im vitest-Lauf.
**Erster Arbeitsschritt des Pakets ist deshalb ein Re-Baseline von
`KNOWN_TEST_FAILURES.md`** — ein Dokument, das 144 behauptet, wo 64 sind, ist selbst Teil
des Problems („Suite rot" trägt keine Information).

### Die Drei-Töpfe-Verteilung der 64 (gemessen, nicht geraten)

**Cluster 1 — 13 Tests, EIN Grund:** `analytics-live-fortschritt.test.ts` fällt 13× im
Test-SETUP („Slate enthält keine Achsenkarte — der Test hätte nichts geprüft"): die fünf
V4-Sponsor-Zielachsen entstehen im Erzeugungspfad nicht mehr — **exakt Kleinkram-Punkt b.**
Topf hängt an Chris' Achsen-Entscheid: kommen die Achsen zurück → Topf (b) (die Tests
decken eine echte Regression); bleiben sie tot → Topf (c) (Tests über totem Feature,
umschreiben auf lebende Zieltypen oder löschen). **Diese 13 nicht einzeln anfassen, sondern
mit P6b in einem Zug entscheiden.**

**Cluster 2 — 18 Tests: Quelltext-String-Contracts** (`toContain`/Metrik auf Dateiinhalt — die
Fehlerklasse, die die Vorgeschichte teuer gemacht hat; 241 von 829 Testdateien lesen
Quelltext als String, der Bodensatz wächst also nach, solange das Muster gilt). Maschinelle
Vorprüfung heute (erwartete Strings repo-weit gesucht):
  - **~5 Strings existieren woanders** (`FoundationPlayerPortraitCard` in 14 Dateien,
    `FoundationSubNav` in 4, `Season-End Review`, `season-v2-form-curve`,
    `var(--nl-accent-text`) → Topf (a): Test liest die alte Monolith-Datei, Markup ist in
    Panels gewandert — umbiegen, String für String.
  - **~8 Strings existieren NIRGENDS mehr** (`teamdeckCandidateGroups`-Prop,
    `legacy-lineup-flow-check`-testid, `LADDER_ROW_MIN_H`-Clamp,
    `new-game-solo-team-select`-testid, `SEASON_V2_DEFAULT_MODE`,
    `transfer-history-layout`-testid, `Erweiterte Technikoptionen`,
    Finale-Panel-Gate) → Topf (b)-verdächtig: entweder wurde UI wirklich entfernt (Befund!)
    oder umbenannt jenseits der Suchtiefe — je String von Hand klären, BEVOR der Test
    angepasst wird.
  - Sonderfall `f4-eine-quelle-pro-groesse.test.ts`: erwartet die ALTE Apron-Bemessung
    (`getTeamDisplaySalaryTotal` in `apron-service.ts`/`apron-projection.ts`) — seit
    `aacff059` (Chris' „ja!" zur verhandelten Basis) bewusst falsch. Topf (a), Test auf die
    neue Bemessung nachziehen. Lehrstück: selbst der sorgfältige gestrige Umbau hat einen
    roten Test hinterlassen — der Bodensatz wächst durch Unterlassen.
  - Dazu inverse Contracts, die FEUERN: `chunked-redraft-topup` verbietet
    `candidate.quality *` als Draft-Attraktivität — steht heute in
    `lib/ai/chunked-redraft-topup-service.ts:4108`. Das ist KEIN Test-Nachzug, das ist ein
    **Regelverstoß im Produktcode oder eine gekippte Policy** → Topf (b), Befund schreiben.
    Ebenso `teams-liste-vertraege` (verbietet `label: "Gehalt"`, steht wieder drin).
  - Sonderfall Budget-Test `foundation-performance-architecture` (useState-Zähler 239 > 237):
    der Test tut seinen Job — entweder wurden 2 States ohne Budget-Anhebung ergänzt (Topf b,
    klären wer/warum) oder das Budget wird BEGRÜNDET angehoben. Nicht stumm hochsetzen.

**Cluster 3 — 33 Tests: Wert-/Logik-Assertions** (Zahlen, Statuscodes, Objektformen) —
Topf (b)-Kandidaten, JE FALL lesen, NICHT den Test anpassen:
  - `singleplayer-state` (7) — SQLite-gestützt, als reihenfolge-flaky dokumentiert →
    zuerst Isolationslauf (Datei solo), erst dann triagieren; flaky-Anteil in Topf (d).
  - `ai-legacy-lineup-api` (3, Route antwortet 500) und
    `legacy-lineup-save-resolution-errors` (2, 409 statt 404/200 — dieselbe 409-Semantik
    wie Kleinkram i!) → Route-/Mock-Drift oder echte Route-Regression.
  - `verletzungsrisiko-einsatzliste` (3, Schutzzonen-Prozente 16≠10, 26≠20, 0,12≠0) —
    entweder Rebalancing ohne Testnachzug oder echte Regression im Risiko-Modell.
  - `kein-minus-nach-kauffenster` (2) + `kredite-im-kauffenster` (1): Assertion bekommt
    `undefined` statt Zahl — ein Feld ist aus einem Ergebnisobjekt verschwunden
    (Fehlerklasse „gelesenes Feld ohne Schreiber", schnelle echte Befunde).
  - Rest (player-detail-drawer 3, frozen-valuation-snapshot 2, ai-transfermarkt-sell-preview
    2, chunked-redraft 1, cash-prize-apply 1, player-economy-compare 1, player-stats-adapter
    1, room-flow-controller 1, season-one-long-run-market-buy 1, legacy-lineup-lab 1,
    bug-report-tickets 1) — einzeln, mit dem JSON-Report als Landkarte.

Ehrliche Grenze der Vorteilung: die Topf-Zuordnung von Cluster 2/3 ist eine VORPRÜFUNG
(String-Suche, Fehlermuster), keine Endabnahme — die macht der Bearbeiter je Fall. Was fest
steht: **13/64 hängen an EINEM Entscheid (P6b), 18/64 sind String-Contract-Mechanik,
33/64 brauchen je einen Blick** — und mindestens drei davon (`chunked-redraft`-Verbot,
`teams-liste`-Verbot, `kauffenster`-undefined) riechen nach echten Produktfehlern.

### Reihenfolge, Abbruchkriterium, Grünfärbe-Sperre

- Reihenfolge: Re-Baseline (KNOWN_TEST_FAILURES neu schreiben, 64 statt 144) → Cluster 1
  als EIN Entscheid mit P6b → Cluster 2 Topf (a) im Akkord (wenige Ziel-Dateien) →
  Cluster 2 „String nirgends" + Cluster 3 als Einzel-Befunde. Löschen (Topf c) erst NACH
  dem jeweiligen Entscheid, nie vorsorglich.
- **Abbruchkriterium:** Ziel ist NICHT 0 rote Tests, sondern: JEDER verbleibende rote Test
  steht mit Topf-Zuordnung und Ein-Zeilen-Grund im neu geschriebenen
  `KNOWN_TEST_FAILURES.md`, und die Zahl ist über zwei aufeinanderfolgende Volläufe stabil.
  „Suite rot" ist wieder eine Information, wenn JEDE Röte erklärt ist.
- **Grünfärbe-Sperre (Review-Regel):** ein Test-PR aus diesem Paket darf (1) KEINEN
  Produktcode anfassen (Produktfehler aus Cluster 3 werden als Befund abgegeben, nicht im
  Test-PR „mitgefixt"), (2) keine Assertion abschwächen (Zahl→`toBeDefined`,
  `toContain`→`toBeTruthy` sind Ablehnungsgründe), (3) einen String-Contract nur umbiegen,
  wenn der PR-Text für JEDEN String die neue Fundstelle nennt. Stichprobe im Review: 3
  zufällige umgebogene Assertions gegen die Ziel-Datei lesen.
- **Nachwachs-Sperre (mittelfristig, eigener Entscheid):** neue Quelltext-String-Tests nur
  noch mit Begründung — 241 von 829 Testdateien lesen heute Quelltext als String; jede
  Datei-Verschiebung erzeugt daraus neuen Bodensatz.

### Abnahme (Wert-Invarianten)

- `KNOWN_TEST_FAILURES.md` nennt exakt die gemessene Restmenge mit Topf je Test; Summe der
  Töpfe == Anzahl roter Tests im Abschlusslauf; zwei Volläufe in Folge liefern dieselbe
  Menge (flaky-Anteil ausgewiesen).
- Jeder gelöschte Test (Topf c) hat im Commit-Text die Begründung „totes Feature X, Beleg".
- Kein PR dieses Pakets ändert eine Zahl in einer Wert-Assertion ohne verlinkten Befund.

---

## Priorisierung — ehrlich

Wenn nur die halbe Zeit da ist, in dieser Reihenfolge:

1. **P2 (Ziel-Refresh).** Verliert HEUTE laufend Geld und Anzeige-Vertrauen im aktiven
   Spielstand, Reproduktion liegt vor (225→222 mit 11 C Verlustwirkung), der Fix ist auf
   eine Datei begrenzt. Nichts anderes in dieser Liste beschädigt aktiv den Spielstand.
2. **P1 Re-Baseline + Cluster 2a im Akkord.** Nicht, weil Tests wichtiger wären als
   Features — sondern weil ALLE anderen Pakete auf „Suite rot = Information" angewiesen
   sind, sobald mehrere Agenten parallel bauen. Die Messung hat den Berg zudem von 144 auf
   64 geschrumpft; das Re-Baseline allein ist eine Stunde Arbeit mit großem Hebel.
3. **P3 (Boardziele Log-first).** Klein, beendet den Beobachter-Effekt einer GEBUCHTEN
   Zahl; die Abnahme ist trivial scharf (±20-Cash-Experiment → 0,00).
4. **Die zwei Produktfehler-Verdachte aus P1-Cluster 3** (`chunked-redraft`-Verbotsverstoß,
   `kauffenster`-undefined) — kleine Befunde, potenziell echte Bugs im KI-Geldfluss.
5. **P4-MESSUNG** (Skript, Margen-Tabelle, Varianten) — sie kostet wenig und produziert
   genau die Zahlen, ohne die Chris den Regler nicht drehen kann. Der UMBAU danach wartet
   auf seinen Entscheid.

**Danach, wenn Zeit bleibt:** P6a/d/e/f (kleine echte Reparaturen mit fertiger Messung),
P5-Code-Hälfte (drei Bilder + Index; Peacock-Datei muss ohnehin von Chris' Mac kommen),
P6-Doku-Zeilen (c, g, h, i) beiläufig in den jeweiligen PRs.

**Gar nicht (bewusst):**
- Kleinkram g, h, i über die Doku-Zeile hinaus — Reparaturen ohne Spielwirkung.
- Jede Umbenennung von `finalPreviewScore`/`score` (P6j baut die Wache, nicht den Umzug).
- Neukalibrierung von P6c (Insurance-Share) ohne Anlass.
- In P4: Rangfolge und Schwelle 0,15 — entschieden und hergeleitet; nachjustiert wird am
  Langlauf-A/B, nicht an der Flip-Quote und nicht an diesem Plan vorbei.
- Eine Voll-Migration aller 2984 Portraits ins Repo OHNE Chris' Größen-/Asset-Entscheid
  (P5 Schritt 3 ist ihm vorgelegt, nicht beschlossen).

**Offene Entscheide, die NUR Chris treffen kann (gesammelt):**
1. P4: Front-Wachen-Marge (+10/+5/+0) und Schicksal der `strongCashBuffer`-Regel —
   Zahlen liefert die P4-Messung.
2. P6b ⇄ P1-Cluster 1: V4-Zielachsen wiederbeleben oder beerdigen (entscheidet zugleich
   über 13 der 64 roten Tests).
3. P5: Portrait-Voll-Migration ins Repo ja/nein; kurzfristig die Peacock-Datei vom Mac.
4. P6f, falls „Form" als echte Kennzahl gewünscht ist statt Leseweg-Entfernung.
