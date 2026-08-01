# Inbox-Neukonzept — „Dein Schreibtisch"

Konzeptpapier zum Umbau der Inbox (Velo-Look, neue Sprungziele, Ereigniskatalog).
Gehört zum Mockup `docs/inbox-mockup.html` (eigenständige HTML-Seite, im Browser öffnen).

**Status: Entwurf — kein Produktivcode geändert.**

---

## 1. Was heute nicht stimmt — mit Beleg

| # | Befund | Beleg |
|---|--------|-------|
| 1 | **Interne Routen-Namen als Nutzertext.** Die Quick-Action-Zeile lautet wörtlich `Springe zu ${item.targetView}.` — der Spieler liest „Springe zu teams." und „Springe zu trainingV2." | `lib/foundation/inbox-quick-action-service.ts:90`, `lib/foundation/tabs/use-foundation-shell-router-body-scope.tsx:9846` |
| 2 | **Rohe Datenfetzen als Beschreibung.** „season source missing": unbekannte Flow-Blocker fallen durch `formatCockpitReason` und werden nur per `replaceAll("_", " ")` „übersetzt" (`game-inbox-service.ts:556` → `cockpit-ui-helpers.ts:85–107`). „matchday-10: +3 Plätze": der rohe `matchdayId` steht im Text (`game-inbox-service.ts:1298`). „Cashpuffer halten: 15.2 / Ziel >= 21.5": Board-Ziel-Beschreibung ist Rohwert-Verkettung (`game-inbox-service.ts:1027`). | s. links |
| 3 | **Ereignis ohne Ereignis.** `facility_news` rendert jeden `facilityEvent` mit rohem `facilityId` und ohne Prüfung `previousLevel !== nextLevel` — daher „fan_shop: Level 1 → 1." | `game-inbox-service.ts:1204–1222` |
| 4 | **Doppelte Titel.** Je verfehltem/gefährdetem Board-Ziel entsteht eine Karte, alle mit dem statischen Titel „Board-Ziel verfehlt"/„Board-Ziel gefährdet" — das Ziel selbst steht nur in der Kleinzeile. | `game-inbox-service.ts:1015–1034` (Titel: Zeile 1026) |
| 5 | **Fläche ungenutzt.** `InboxV2NewLook` rendert eine einspaltige `<ul class="nl-inbox-list">`; auf breiten Schirmen bleibt die rechte Hälfte leer. | `app/foundation/inbox-v2/InboxV2NewLook.tsx:613–717` |
| 6 | **Alles gleich wichtig.** `severity` wird nur auf einen Tone-Streifen abgebildet (`nlToneClass`), sonst sind alle Karten gleich groß, gleich platziert, gleich laut. Dazu mischen sich Karten im Zustand „done" („Lineup gesetzt") und Dauerwerbung („Facility Upgrade möglich" feuert, sobald irgendein Upgrade bezahlbar ist, `game-inbox-service.ts:968–991`). | `InboxV2NewLook.tsx:194–198`, `game-inbox-service.ts:591–614` |
| 7 | **Drei Schritte, ein Ziel.** `lineup_missing`, `lineup_not_submitted`, `formcards_open` und die drei Flow-Schritte zeigen alle auf die Einsatzliste — die Inbox fühlt sich an, als führe alles an denselben Ort. | `game-inbox-service.ts:591–665`, `data/bug-reports/triage/bug-2026-07-30T14-42-43-320Z-sq84lk.md` |
| 8 | **Doppelte Meldung desselben Ergebnisses.** `matchday_result_available` („Ergebnis kann angesehen werden") UND `matchday_recap` melden denselben Spieltag. | `game-inbox-service.ts:1074–1091` vs. `1288–1305` |
| 9 | **Tote/verwaiste Ziele im Typ.** `GameInboxTargetView` enthält noch `"training"` (Alt-Bezeichner ohne Nav-Eintrag, s. Kommentar Zeile 478) und kennt `trainingCompact`/`trainingV2` gar nicht — der Typ ist wirkungslos, weil `GameInboxItem.targetView` als `string` deklariert ist (`lib/data/olyDataTypes.ts:122`). Außerdem zielen Season-Review/Champion/Preseason auf `cockpit`, eine View ohne Navigations-Reiter (`foundation-nav-config.ts`). | `game-inbox-service.ts:33–46` |
| 10 | **Platzhalter als Text.** „Preisgeld angewendet: — Teams, — Preisgeld", wenn `log.payload` fehlt. | `game-inbox-service.ts:1257` |

Alle sechs Screenshot-Beobachtungen von Chris bestätigen sich im Code.

---

## 2. Leitidee: drei Räume statt einer Liste

Vorbild ist weniger die klassische FM-Inbox als das FM26-„Portal": wenige, klar
getrennte Zonen, „Must Respond"-Einträge deutlich abgesetzt, alles andere ruhig
([FM24 Inbox-Handbuch](https://community.sports-interactive.com/sigames-manual/football-manager-2024/inbox-and-news-r4956/),
[FM26 UI](https://www.footballmanager.com/fm26/features/fm26s-reimagined-user-interface)).
Übertragen auf unser Spiel:

| Raum | Frage | Verhalten |
|------|-------|-----------|
| **Jetzt handeln** | „Was kostet mich etwas, wenn ich es liegen lasse?" | Gefüllter Aktions-Knopf, löst sich selbst auf (#43-Mechanik bleibt), nie „Erledigt"-Knopf für Bedingungs-Items |
| **Im Blick behalten** | „Was wird bald wichtig?" | Leiser Knopf oder nur Ziel-Chip, ausblendbar |
| **Berichte & Momente** | „Was ist passiert?" | Kein Knopf, nur „→ Ziel"-Chip; wird **gelesen**, nicht erledigt; Lead-Karte für den Moment des Spieltags |

Auf breiten Schirmen stehen die drei Räume als Spalten nebeneinander (volle
Breite, Befund 5 behoben), auf schmalen stapeln sie. Dringlichkeit ist damit
**Position**, nicht nur ein Farbstreifen (Befund 6 behoben).

Zweite Kernregel: **jede Karte trägt ihr Ziel als Chip in Nutzersprache** —
„→ Einsatzliste", „→ Teams · Verträge". Die Labels kommen aus
`FOUNDATION_NAV_GROUPS` (eine bestehende Quelle, kein neues Vokabular). Damit
verschwinden „Springe zu trainingV2." und Frankys „alles führt an denselben
Ort"-Gefühl: man **sieht vor dem Klick**, wohin es geht.

---

## 3. Ereigniskatalog

Legende Dringlichkeit: **K** kritisch (Raum 1, rot) · **W** wichtig (Raum 1–2, amber) · **I** Info (Raum 2, neutral) · **B** Bericht (Raum 3).

### Raum 1 — Jetzt handeln

| Ereignis | Auslöser | Text (Beispiel) | Sprungziel | Dringlichkeit | Gebündelt? |
|----------|----------|-----------------|------------|---------------|------------|
| Spieler verletzt | Neue Verletzung nach Spieltag, Spieler steht (noch) im Kader | „Schattenfaust fällt bis Spieltag 9 aus. Einsatz bei Fatigue 78 mit 18 % Risiko. Er steht noch in deiner Aufstellung." | Einsatzliste (`lineup`, Spieler vorgewählt) | K solange er in der Aufstellung steht, sonst W | Mehrere Verletzte desselben Spieltags = eine Karte mit Namensliste |
| Spieltag vorbereiten | Aufstellung unvollständig ∨ Formkarten offen ∨ nicht bestätigt | Eine Karte, drei Teilschritte mit Häkchen: „Schritt 2 von 3 — Formkarten zuweisen" | Einsatzliste | K für aktives Team vor Spieltag | **Ja — ersetzt `lineup_missing` + `formcards_open` + `lineup_not_submitted` + die drei Flow-Banner** (Lösung aus dem Bug-Report) |
| Vertragsauflösung angeboten | Saisonende-Fenster, Angebote vorhanden | „2 Spieler wollen ihren Vertrag auflösen: …" (heute schon gebündelt) | Teams · Kader | W (Frist!) | Ja, je Team (bleibt) |
| Verträge laufen aus | ≥1 Vertrag `expiring`/Restlaufzeit ≤1, erst ab Saisonende-Fenster dringlich | „4 Verträge laufen aus: Grimma, Jason, Isabella, Inefinna." | Teams · Verträge | W im Entscheidungsfenster, I davor | Ja, je Team (bleibt) |
| Finanz-Notlage | `cash < 0` oder Facility-Netto treibt Cash unter 0 | „Kontostand −2,3. Unterhalt frisst 1,1 je Spieltag — Verkauf oder Kredit prüfen." | Finanzen (`finances`) | K | Ja — **eine** Finanzkarte statt getrennter `facility_upkeep_risk`/`transfer_candidate`-Alarme |
| Sponsor wählen | Saisonstart, kein Vertrag gewählt | „Wähle einen von drei Sponsor-Verträgen." | Teams · Sponsor | W (blockiert Einnahmen) | — |
| Kapitän ernennen | Kader ≥ Minimum, kein Kapitän | „Kader ist komplett — ernenne einen Saison-Kapitän für den Moral-Bonus." | Teams · Kapitän | W einmalig, dann weg | — |
| Training nicht gesetzt | ≥1 Spieler ohne Trainingsmodus | „3 Spieler ohne Trainingsmodus." | Training (`trainingCompact`) | W | Ja, je Team (bleibt) |
| Negative Formkarten offen | Ungenutzte Negativ-Karten, **erst ab Spieltag 8** | „2 negative Karten ungenutzt — am Saisonende drohen 4 Strafpunkte." | Einsatzliste · Formkarten | W spät in der Saison, vorher gar nicht | Ja |
| Mitspieler wartet | Multiplayer-Flow blockiert | „Franky wartet auf dein Ready für Spieltag 7." | Home | W | — |

### Raum 2 — Im Blick behalten

| Ereignis | Auslöser | Text (Beispiel) | Sprungziel | Dringlichkeit | Gebündelt? |
|----------|----------|-----------------|------------|---------------|------------|
| Belastungs-Report | ≥1 Spieler mit Fatigue ≥70 oder Risiko ≥15 % | „3 Spieler im roten Bereich" + je Zeile Fatigue-Balken, Risiko-%, 1-Klick „Training leicht" | Training | W (K, wenn einer ≥80/≥25 %) | **Ja — eine Karte je Team & Spieltag ersetzt `player_fatigue_risk` + `player_lineup_rest` + `player_training_load` (heute bis zu 3 Karten pro Spieler)** |
| Board-Ziel unter Druck / verfehlt | Objective `at_risk`/`failed` | Titel enthält das Ziel: „Board-Ziel unter Druck: **Cashpuffer halten**" — Text erklärt Lücke + Hebel: „Es fehlen 6,3. Größter Hebel: Verkauf von Inefinna." | Teams · Board-Ziele | W (`at_risk`), K (`failed` + Board-Vertrauen niedrig) | Nein (Titel unterscheidet), aber max. 1 Karte je Ziel |
| Transfer-Gelegenheit | Fenster offen ∧ (Verkaufskandidat mit Druck-Score ∨ Kaderlücke + Cash) | „Kader 10/12, Cash 9,5 — Zeit für einen Zugang." | Transfermarkt | I (W nur bei Kaderlücke unter Minimum) | Ja — max. **eine** Kauf- und eine Verkaufs-Karte je Team & Fenster |
| Stärkerer Kapitän verfügbar | Kandidat mit Führungs-Delta ≥8 | „Isabella hätte stärkere Führungswerte als Jason (+9)." | Teams · Kapitän | I, ausblendbar, max. 1× je Saison | — |
| Scouting-Update | ≥1 Intel-Meilenstein (25/50/75 %) seit letztem Spieltag | „3 Reports sind schärfer geworden: Ryze (75 %), Taryn (50 %), Mushu (50 %)." | Scouting (`scoutingCenterV2`) | I | **Ja — eine Wochen-Notiz statt einer Karte je Spieler & Meilenstein** |
| Gebäude-Zustand kritisch | Condition < Warnschwelle | „Arena bei 38 % — verliert Leistung, Wartung einplanen." | Gebäude (`trainingV2`) | W (K bei broken) | Ja, je Team: schlechtestes Gebäude nennt sich, Rest als „+2 weitere" |

### Raum 3 — Berichte & Momente

| Ereignis | Auslöser | Text (Beispiel) | Sprungziel | Dringlichkeit | Gebündelt? |
|----------|----------|-----------------|------------|---------------|------------|
| Spieltag-Recap | Ergebnis angewendet | „Rang 2 — +3 Plätze (jetzt Rang 5) · Spieler des Spieltags: Swiftstrike · keine neuen Verletzungen." **„Spieltag 6", nie `matchday-6`** | Arena · Ergebnis | B — **Lead-Karte** | Ersetzt `matchday_result_available` + `matchday_recap` (heute doppelt) |
| Top-Platzierung | Eigenes Team Rang ≤3 an einem Spieltag | Gold-Variante der Recap-Karte: „Rang 2 — bestes Ergebnis der Saison" | Arena · Ergebnis | B (Gold) | in Recap integriert |
| Auszeichnung: Most Improved Player | Saisonende, eigener Spieler gewinnt oder Top-3 (`most-improved-service`) | „Ixali ist Most Improved Player — von Feldposition 25 auf 77." | Leaders (`leagueLeaders`) | B (Gold) | Saison-Awards ggf. als eine „Saison-Ehrungen"-Karte |
| Saison-Auszeichnungen / Champion | Season-Snapshot `completed` | „Golden Gladiators sind Champion der Saison 2." | Saisonstand · Rückblick | B (Gold) | Ja — eine Karte je Saison |
| Spieler-Durchbruch | Progression-Event mit Attribut-Delta ≥5 oder ≥3 verbesserten Diszis | „Ixali verbessert 4 Disziplinen — Training zeigt Wirkung." | Training · Entwicklung | B | Max. 2 je Saisonwechsel, stärkste zuerst |
| Eigener Transfer fix | Kauf/Verkauf des eigenen Teams | „Inefinna verkauft: +8,4 — Kontostand 23,6." | Historie | B | — |
| Liga-Transfer | Fremder Transfer **über Liga-Median-Ablöse** | „Myriaclaw zu den Blazing Beasts — zweitteuerster Transfer der Saison." | Historie | B | Kleine Fenster-Zusammenfassung statt 12 Einzelkarten |
| Gebäude ausgebaut | Facility-Event **mit `previousLevel !== nextLevel`**, Anzeigename aus `FACILITY_CATALOG.label` | „Fan-Shop ausgebaut: Stufe 2 — +0,4 je Heimspieltag." | Gebäude | B | Mehrere Upgrades = eine Karte (Gruppierung existiert) |
| Preisgeld / Sponsor-Auszahlung | Cash-Prize-Log bzw. Payout-Log **mit Betrag** | „Rang 2 bringt +3,0 — Kontostand 15,2." | Finanzen | B | Ja — eine Finanz-Notiz je Spieltag |
| Story-Karten (Enges Rennen, Board-Druck, …) | wie heute | wie heute, aber max. 2 je Spieltag | Saisonstand / Teams | B | Priorisierung: die knappste/lauteste gewinnt |

---

## 4. Was bewusst NICHT gemeldet wird

Eine Inbox, die alles meldet, wird zur Tapete. Explizit gestrichen:

1. **„Facility Upgrade möglich"** (`facility_upgrade_possible`, Zeile 968–991): feuert, sobald irgendein Upgrade bezahlbar ist — also fast immer. Das ist Werbung, keine Nachricht. Gehört als Badge in den Gebäude-Reiter.
2. **Gebäude-Events ohne Stufenwechsel** („Level 1 → 1"): Filter `previousLevel !== nextLevel`, sonst kein Eintrag.
3. **Erledigte Bedingungs-Karten als Dauergäste** („Lineup gesetzt", „Sponsor gewählt", Status `done`): erledigt heißt weg. Wer Erledigtes sehen will, nutzt den bestehenden Toggle — aber es belegt keine Grundfläche mehr.
4. **„Spieltagsergebnis verfügbar"** als eigene Karte: der Recap IST die Meldung (heute doppelt).
5. **Ein Scouting-Eintrag je Spieler & Meilenstein**: wird zur Wochen-Notiz gebündelt.
6. **Jede Sponsor-Auszahlung einzeln**: wird zur Finanz-Notiz je Spieltag.
7. **Fremde Transfers unter Liga-Median**: Rauschen; nur nennenswerte Transfers sind eine Geschichte.
8. **„Pre-Season Schritt offen: Aktuelle Phase: preseason_x"** (roher `gamePhase`, Zeile 1111–1127): Der Flow-Banner führt bereits durch die Pre-Season; eine zweite, unübersetzte Karte hilft niemandem. Falls sie bleibt, dann mit übersetztem Phasennamen.
9. **AI-Team-Interna** (Training, Facilities, Verträge nicht gesteuerter Teams): nur Liga-News (Transfers, Ergebnisse) sind für fremde Teams interessant.
10. **Fatigue-Wiederholungen**: der Belastungs-Report erscheint einmal je Spieltag neu, nicht bei jedem Rechenlauf; unterhalb Fatigue 70/Risiko 15 % schweigt die Inbox.
11. **„AI/Workflow Blocker"** mit rohen Log-Fetzen: bleibt, aber nur im Host-Modus (Admin-Werkzeug, kein Spieler-Inhalt).

---

## 5. Sprungziele: heute → vorgeschlagen

Grundsatz: Labels aus `FOUNDATION_NAV_GROUPS` wiederverwenden; der „→ Ziel"-Chip zeigt sie vor dem Klick.

| Ereignis | Heute (`targetView`) | Problem | Vorschlag |
|----------|----------------------|---------|-----------|
| Quick-Action-Text | `Springe zu ${targetView}.` | Routen-Bezeichner als Satz | `Öffnet: {Nav-Label}` bzw. Ziel-Chip „→ Einsatzliste" |
| Verletzung | `lineup` | korrekt | **Einsatzliste** (bleibt), Spieler vorgewählt; Zweitlink Spielerprofil |
| Fatigue/Trainingslast | `trainingCompact` (seit e574215 korrekt) | Label fehlt | **Training** |
| Training nicht gesetzt | `trainingCompact` | korrekt | **Training** |
| Gebäude (Zustand/Unterhalt/News) | `trainingV2` | korrekt, aber als „trainingV2" sichtbar | **Gebäude** |
| Facility-Unterhalt gefährdet | `trainingV2` | eigentlich ein Geldproblem | **Finanzen** (Teil der Finanz-Notlage-Karte), Zweitlink Gebäude |
| Verträge/Kader/Kapitän/Sponsor-Wahl/Board | `teams` + Panel | korrekt, Panel unsichtbar | **Teams · Verträge / Kapitän / Sponsor / Board-Ziele** — Panel gehört ins Chip-Label |
| Transfers (Gelegenheit) | `market` | Alias, normalisiert auf `marketV2` | **Transfermarkt** |
| Transfer-Historie | `history` | Alias | **Historie** |
| Preisgeld | `prize` | „Sponsoren"-Reiter, Geld steht aber in Finanzen | **Finanzen** |
| Spieltags-Recap/Ergebnis | `matchdayArena` | korrekt | **Arena · Ergebnis** |
| Scouting-Meilenstein | `market` | Scouting hat einen eigenen Reiter | **Scouting** (`scoutingCenterV2`) |
| Season Review / Champion / Pre-Season | `cockpit` | View ohne Nav-Reiter — Ziel de facto unsichtbar | **Saisonstand · Rückblick** (`seasonV2`) — oder bewusste Entscheidung, das Cockpit in die Nav zu holen |
| Auszeichnungen (neu) | — | — | **Leaders** (`leagueLeaders`) |
| Typ `GameInboxTargetView` | enthält totes `"training"`, kennt `trainingCompact`/`trainingV2` nicht | Typ ohne Wirkung (`targetView: string`) | Typ auf `FoundationViewId` einengen — dann meckert der Compiler bei unerreichbaren Zielen |

---

## 6. Kosten und Reihenfolge

### Stufe 1 — Text & Ziele reparieren (klein, sofort, ohne Layout-Umbau)

- Ziel-Labels in Nutzersprache: Map `targetView → Nav-Label` an einer Stelle, Quick-Action-Detail und Ziel-Chip daraus speisen (ersetzt `Springe zu …` an beiden Fundstellen).
- No-op-Filter für Facility-Events + `FACILITY_CATALOG.label` statt `facilityId`.
- Board-Karten: Ziel in den Titel („Board-Ziel verfehlt: Cashpuffer halten").
- `matchdayId` formatieren („Spieltag 10"), Preisgeld-Karte ohne Payload unterdrücken statt „— Teams".
- `matchday_result_available` streichen (Recap reicht).
- `GameInboxTargetView` → `FoundationViewId`, `targetView` typisieren.

Aufwand: **S** (reine Service-/Text-Änderungen, bestehende Tests `inbox-target-routing.test.ts` erweitern).

### Stufe 2 — Katalog & Bündelung (mittel)

- Belastungs-Report: eine Karte je Team & Spieltag statt bis zu 3 Karten je Spieler (Quick-Action „Training leicht" je Zeile — `applyInboxQuickAction` kann das heute schon pro Spieler).
- „Spieltag vorbereiten"-Bündel mit Teilschritten (ersetzt 3 Aufgaben + 3 Flow-Banner; Empfehlung aus dem Bug-Report #264).
- Scouting-/Transfer-/Finanz-Bündelung; Gates aus Abschnitt 4 (facility_upgrade_possible raus, Negativ-Formkarten erst ab Spieltag 8, Liga-Transfer-Median).
- Neue Berichte: Top-Platzierung (Gold-Recap), Most Improved Player, Saison-Ehrungen.

Aufwand: **M** (Service-Logik + `groupInboxItemsForDisplay` verallgemeinern; UI kann die bestehende Liste behalten).

### Stufe 3 — Der neue Schreibtisch (groß)

- Drei-Spalten-Layout „Jetzt handeln / Im Blick behalten / Berichte & Momente" (siehe Mockup), responsive; ersetzt Modus-Umschalter „Entscheidungen/Chronik" durch gleichzeitige Sichtbarkeit.
- Lead-Karte für den Spieltags-Moment, Gelesen-Zustand für Berichte (statt „Erledigt/Ausblenden" auf News).
- Leere-Zustände je Raum („Alles erledigt" als Belohnung, Erststart mit CTA zur Einsatzliste).
- Aufräumen: toter Inline-Inbox-Block im Router-Body gegen `FoundationInboxV2Host` tauschen (im Bug-Report als offener sauberer Schnitt notiert).

Aufwand: **L** (neue Ansicht + Interaktionstests; Klick-Regression aus #264 als Pflicht-Testfall: ein Klick auf Karte X navigiert zu Ziel X).

**Empfehlung:** Stufe 1 zuerst — sie behebt vier der sechs Screenshot-Beschwerden mit minimalem Risiko. Stufe 2 macht die Inbox leise. Stufe 3 macht sie schön.

---

*Quellen der Inspiration: [FM24 Inbox & News](https://community.sports-interactive.com/sigames-manual/football-manager-2024/inbox-and-news-r4956/) (Kategorien, „Must Respond"-Gating), [FM26 Reimagined UI](https://www.footballmanager.com/fm26/features/fm26s-reimagined-user-interface) (Portal statt Inbox, Tiles→Cards). Übernommen: klare Trennung Handlungszwang/Bericht, Dringlichkeit als rote Ausnahme statt Dauerzustand. Nicht übernommen: FM-Detailtiefe (Pressekonferenzen etc.) — unser Spiel braucht weniger, dafür präzisere Nachrichten.*
