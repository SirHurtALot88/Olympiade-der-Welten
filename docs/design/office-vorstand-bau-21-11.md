# Office: Vorstand, Ziele, Gespräch, Prämien — Bau (21.11.)

Mockup `public/mockups/office-vorstand-21-11.html`, Erklärung `docs/design/office-vorstand-21-11.md` (dort „Entscheidungen Chris 21.11.“).
Gebaut sind beide Stufen: **A** (Vorstand und Ziele, Gespräch, Zielsystem, Ablösung der Finanz-Knöpfe) und **B** (Prämien: Sieg- und Treueprämie).

## Wo was liegt

| Teil | Datei |
|---|---|
| Seite, Reiter | `app/foundation/office/OfficeModern.tsx` (+ `OfficeVorstandTab`, `OfficeGespraechTab`, `OfficePraemienTab`, `office-modern.css`) |
| Modell der Seite (nichts neu gerechnet) | `lib/finance/office-modell.ts` |
| Zielarten, Laufzeit, Lieblingsspieler, Widerspruchsprüfung | `lib/board/vorstand-ziele-erweitert.ts`, Einbau in `lib/board/team-season-objectives-service.ts` |
| Gespräch (Waage, Antrag, Gegenangebot) | `lib/finance/vorstand-gespraech.ts`, Zustand `vorstand-gespraech-zustand.ts` |
| Prämien | `lib/finance/vorstand-praemien.ts` |
| Schreibweg | `POST /api/finance/vorstand` (`gespraech_antrag`, `gespraech_annehmen`, `gespraech_zurueckziehen`, `praemien_setzen`) hinter `authorizeServerRoomWrite`, frisch vom Server gelesen |
| Tests | `tests/office-vorstand-21-11.test.ts` (22), angepasst: `tests/finanzen-seite-modern.test.tsx`, `tests/team-season-objectives-service.test.ts` |

## Fund: Geldstrafe wurde noch gebucht

`penaltyCash` wurde in `buildTeamSeasonObjectiveSettlement` als **negativer Cash-Betrag** gebucht (verfehltes Ziel zog 1 bis 10 C ab), und das Ziel
„Vorstandsvertrauen wiederherstellen“ kündigte „Der Vorstand kürzt das Budget um X M“ an. Beides widersprach der Vorgabe vom 18.11.
**Behoben:** ein verfehltes Ziel bucht nie Geld (nur `rewardCash` bei Erfüllung); der Hinweis spricht von weniger Freigabe. Das Feld bleibt als totes Altfeld an den
Datensätzen (viele Tests und Generatoren schreiben es), wird nirgends gebucht und im Office nicht gezeigt (Test prüft `penaltyCash|Malus` nicht im Modell).
Offen: `FoundationTeamsDetailPanel.tsx` (Pille „Malus“) und die Sponsor-Karten (`penaltyCash` des Sponsor-Vertrags, andere Quelle) zeigen es weiter.

## Entscheidungen im Bau (Annahmen, bitte prüfen)

* **Neue Zielarten kommen zusätzlich zum kompakten Slate** (wie Sponsor- und Budget-Ziele), nicht auf Kosten eines Plätzchens: sonst verdrängen sie das Spieler-Ziel (Slot 4) und verschieben die KI-Neigung. Sie fließen **nicht** in `buildAiBias` ein.
* **KI-Teams:** die neuen Ziele werden ausgewertet und gezeigt, **Strafen (−1,0 Lieblings-Verkauf, −0,4 Vertragslaufzeiten) greifen nur beim Menschen**, bis eine Messung mit 32 KI-Teams vorliegt. Positives gilt für alle.
* **Vertragslaufzeiten:** ab Saison 2; gemessen werden die Enden der **kommenden zwei Saisons** (nicht die auslaufenden, das ist die Verlängerungs-Entscheidung selbst). Grenze 30 % des Kaders, mindestens 3. Gefährdet bis Saisonende, dann verfehlt. Laufzeit zwei Saisons.
* **Lieblingsspieler:** Wahl steht in der Spieler-Id des Ziels (fest für die Saison, kein eigener Speicher). Das „kleine Einsatz-Ziel“ aus dem Mockup fehlt (keine Datenquelle für Einsätze je Spieler).
* **Widerspruchsregeln** (wenige, lesbar): Sparziel (Transferdeckel, Netto-Transferbilanz) × Rang-Ziel bei Kader unter Soll; Cash-Reserve und Transferdeckel × Gebäude/Entwicklung; Gehaltsquote × „Lieblingsspieler verlängern“. Das Mockup-Beispiel (Netto-Transferausgaben gegen Top 6) ist die erste Regel; das nächste Ziel desselben Bereichs rückt nach, das verworfene steht mit Grund am Ersatz (`ersetzt`).
* **Gespräch:** Preise und Werte der Waage sind die Startwerte aus `vorstandsgespraech-18-11.md`. Bitten: Freigabe anheben, Sonderbudget Gehalt, Notrücklage anzapfen, Alles auf eine Karte, Ziel tauschen, Lieblingsspieler freigeben. Zusagen: höheres Saisonziel, Gehaltsdeckel, Vertrauen einsetzen, Lieblingsspieler verlängern. Zusagen werden zu Zielen (Vertrauen über die bestehende Buchung bei der Abrechnung).
* **Siegprämie:** „Sieg“ = Disziplin-Ergebnis in der oberen Hälfte der Liga (Annahme, nicht festgelegt). Stufen 0,01 / 0,02 C je Sieg und Einsatz, Treueprämie 5 / 10 % des neuen Gehalts; Moral +1/+2 je Sieg, +5/+10 bei Treue. Alle Werte sind Startwerte ohne Messung.

## Drin / angepasst / fehlt (Mockup gegen App)

Bilder: `docs/design/office-vorstand-bau-21-11/app-*.png` (1920×1080 und 2560×1440, Szenario Death Peaches, Stand als Saison 2 im Transferfenster aufbereitet), `s1/` (echter Stand Saison 1). Die Mockup-Bilder liegen in `docs/design/mockups-21-11/office-0*.png`.
Gemessen: kein Seitenscroll, kein horizontaler Überlauf, keine JavaScript-Fehler. Nicht geprüft: 1710×1112, Phone.

| Mockup-Merkmal | Stand |
|---|---|
| Kopf mit Reitern und Kennzahlen | drin; „Kabine“ als vierter Reiter (bestehende Ansicht); „Sponsor“ fehlt (eigene Seite) |
| Vertrauens-Bogen, Stufen-Tabelle mit aktiver Zeile | drin |
| „Was es bewegt hat“ (Verlauf) | **angepasst:** „Was am Saisonende zählt“ (Verlauf wird nicht gespeichert) |
| Ränge in der Liga | angepasst: Vertrauen, Gehaltskosten (günstigstes = 1), Kasse; Kaderstärke-Rang fehlt |
| Widerspruchsprüfung, Paar-Chips, verworfenes Ziel | drin |
| Zielkarten mit Laufzeit-Marke, NEU, Hinweis, Folgen | drin; „je Bereich höchstens ein Ziel“ nicht erzwungen |
| Vertragslaufzeiten mit Balken, Lieblingsspieler mit Porträt | drin |
| „So vergibt der Vorstand“ (4 Schritte) | angepasst an das, was der Code tut |
| Abrechnung, Zielprämien, Freigabe nächste Saison | drin |
| Freigabe/Budgets, Kassenbalken, Töpfe, Sonderwege, Regel-Tabelle | drin |
| Notfall-Antrag | **fehlt** (nie gebaut, nicht Teil der Entscheidungen) |
| Gespräch: 3 Schritte, Wechselrede, Waage, Folgen vorher/nachher, Bindungen, Protokoll | drin |
| Bitte „Prämientopf“, Zusage „Rückzahlung aus Verkäufen“ | **fehlt** (Prämien zahlen aus dem Gehaltstopf; Rückzahlung braucht Verkaufs-Hooks) |
| Prämien: Siegprämie, Treueprämie, Spielertabelle (sortierbar, Moral-Gesicht, Gehalt groß/klein), Kosten, harte Sperre | drin |
| Prämie fürs Saisonziel, Sonderprämie Spieltag, Klauseln je Spieler | **fehlt** (laut Entscheidung 7 später) |

## Finanzseite

„Rücklage anzapfen“ und „Alles auf eine Karte“ sind dort ersetzt durch Lesetext und den Knopf „Zum Gespräch“; „Annehmen“ bei einer Forderung des Vorstands und der Umschicht-Schieber bleiben. Die Route lehnt die beiden alten Aktionen ab (die KI ruft die Funktionen direkt).

## Offen

KI und Prämien messen (32 KI-Teams); KI-Strafen der neuen Zielarten nach der Messung; Notfall-Antrag; Sponsor im Office; 1710×1112; Spieltags-Hook der Siegprämie am Live-Spielstand in einem echten Spieltag testen (Unit-Test deckt Buchung, Idempotenz, Moral).

## Review-Funde 21.11. und Behebung

Ein unabhängiges Review hat Funde gemacht; behoben sind alle, jeweils mit Test (`tests/office-vorstand-21-11.test.ts`, Blöcke „Review 21.11: …"; gegen den Stand vor der Behebung gemessen rot, 14 von 17 neuen/angepassten Tests).

| # | Fund | Behebung |
|---|---|---|
| 1 | Siegprämie D2 wurde nie gezahlt: die Arena bucht gestaffelt (`commitThroughSide` D1, dann D2, dieselbe `matchdayResultId`), die Idempotenz hing aber an der Spieltag-Id. | Idempotenz je `${matchdayResultId}:${side}`. `bucheSiegpraemien(gs, id, neueSeiten)`: der Buchungsweg (`legacy-matchday-result-apply-service.ts`) übergibt nur die in diesem Commit **neu geschriebenen** Seiten (nicht die eingefrorenen). Je Seite zahlen nur Spieler, die auf **dieser** Seite eingesetzt waren. Alte Schlüssel ohne `:d1`/`:d2` gelten für beide Seiten. Tests: D1→D2, Replay, Voll-Re-Apply. |
| 2 | „Sieg" = obere Ligahälfte. | Sieg = gewonnene Begegnung (`istGewonnen`): Duell über `ergebnisNormiert`, sonst `verhaeltnis`, sonst `duellSeiten` (`marge` ist ein Betrag ohne Vorzeichen und taugt nicht); Pod mit vier Teams: nur Platz 1 (Entscheidung der Hauptsitzung); Rückfall auf die obere Hälfte nach Rang nur für alte Zeilen ohne diese Felder. Prämien-Ansicht: „Für jede gewonnene Begegnung …". |
| 3 | Prämien-Geld ungeloggt (`plan.protokoll` kürzt auf 12). | Eigenes ungekürztes Log `seasonState.vorstandPraemienLogs[teamId]` (`cashDelta`, `art`, `matchdayResultId`/`side` bzw. `contractId`, `playerId`; über alle Saisons, der Saisonwechsel setzt es nicht zurück). Finanz-Audit: eigener Kanal `netPraemienCash` in `transfer-finance-audit.ts` (und in der Abstimmung); Kontoauszug: Art `vorstand_praemien`. `tests/economy-cashflow-invariant.test.ts`: neue Phase 5b mit Prämienplan, Log-Summe = Cash-Delta, als Buchung im Aggregat. |
| 4 | KI nicht neutral. | Lieblingsspieler-Ziel und Vertragslaufzeit-Ziel gibt es für KI-Teams **gar nicht** (Builder liefert `null`): kein Delta, kein `rewardCash`, keine Zählung in `failed`/`atRisk`/`pressure`/`perceivedPressure`, GM-Entlassung und KI-Panik sehen nichts. Bei Menschen gelten Bonus und Malus symmetrisch. **Befund `rewardCash`:** die anderen Vorstandsziele zahlen bei Erfüllung Geld (Rang-Ziele 2 bis 12 C, Gehaltsquote, Cash-Reserve, Transferbilanz u. a.); die 2 C des Vertragslaufzeit-Ziels beim Menschen sind damit konsistent und bleiben. |
| 5 | Ziel tauschen ausnutzbar. | Kandidaten mit Status `completed`/`failed` sind ausgeschlossen (in `tauscheVorstandsZiel` wie in der Gesprächs-Sperre; im Tausch selbst war `completed` schon über `istZielTauschbar` abgedeckt, in der Sperre „es gibt Alternativen" noch nicht). Tausch nur bis einschließlich Spieltag 10 oder im Transferfenster (`zielTauschZeitfenster`, `ZIELTAUSCH_LETZTER_SPIELTAG`); danach ist die Bitte im Gespräch gesperrt, mit Begründung am Knopf, und das Office-Modell bietet nichts zum Tauschen an. |
| 6 | Zusage „Vertrauen einsetzen" wirkte sofort, zählte als `at_risk`, löste die Inbox-Meldung „Board-Ziel verfehlt/gefährdet" aus. | Status `open` (nie verfehlt, nie gefährdet, kein Druck, keine Inbox-Meldung). Das Delta −0,25 steht am Ziel, wird aber in der laufenden Vertrauens-Summe (`calculateBoardConfidence`) ausgelassen und erst in der Abrechnung (nächste Festlegung) gebucht. Vertrauen, Stufe und Freigabe bleiben bis dahin unverändert. Das Ziel trägt in der Office-Ansicht keine „Plus"-Pille. Der Kostenvermerk „Rücklage angezapft“ (Status `failed`, ein Vermerk und kein verfehltes Ziel) löst ebenfalls keine Inbox-Meldung mehr aus. Die Zusage „Höheres Saisonziel“ ist erst am Saisonende verfehlt (am alten Testspielstand mit nur 10 Spieltagen stand sie wegen „Saison zu Ende“ sofort auf verfehlt: Aufnahmen mit 20 Spieltagen). |
| 7 | Zusage „Lieblingsspieler verlängern" nach schon erfolgter Verlängerung, doppelte +0,3. | Zusage gesperrt („schon verlängert"). Ist die Verlängerung zugesagt, zahlt die Zusage die +0,3, das Lieblingsziel dann 0 (dieselbe Verlängerung zählt einmal). |
| 8 | `penaltyCash` lief in `mergeStoredTeamObjectives` weiter, „Malus"-Pille im Teams-Panel. | Beim Fortschreiben `undefined` (nur Sponsor-Spiegelziele behalten den Malus ihres Vertrags, andere Quelle). Pille „Malus" im Teams-Detail nur noch für Sponsor-Ziele. **Hinweis:** die Abschaffung der Geldstrafe ändert das Geld **aller** Teams (Chris-Regel „keine Geldstrafen", 18.11.): verfehlte Ziele kosten nur noch Vertrauen. Ein Test des Finanz-Audits, der die Strafe als Reward-Kanal missbrauchte (`tests/transfer-finance-audit.test.ts`), nutzt jetzt ein erfülltes Ziel mit Prämie. |
| 9 | Stufen-Anhebung und Lockerung durch Verkäufe stapelten. | Bei aktiver Anhebung ruht die Lockerung („es gilt die höhere der beiden"), höchstens 100 %. Wirkt nur im alten Fenster (`OLY_TRANSFERFENSTER_GEMEINSAM=0`); im gemeinsamen Standardfenster sind Verkaufserlöse ohnehin zu 100 % frei und die Lockerung ruht. |

Kleinigkeiten: ein formal fehlerhafter Antrag (fehlender Betrag, fehlende oder unbekannte Ziel-Id, unbekannte Bitte) verbraucht kein Gespräch (`formalFehlerImAntrag`, Grund `antrag_unvollstaendig`, Route speichert nur gültige Anträge); die Treueprämie gilt auch bei Verlängerungen, die die KI im Auftrag des Menschen macht (`source: "ai_contract_renewal"` am Menschen-Team mit Plan; reine KI-Teams haben keinen Plan); Moral-`reasonId` aus Quelle + Spieltag + Seite bzw. Vertrag statt aus der Listenlänge; `aktuellePp` ohne Ergebnisse dieser Saison ist leer (nicht alle Saisons).

Anzeige: (a) die doppelte Sprechblase der Bitte nach der Zustimmung ist weg (Entwurf nur im Schritt „Zusagen"); (b) Ligavergleichs-Ziele (Gehaltsquote, Transferdeckel, Netto-Transferbilanz, Cash-Puffer, Formkarten-Ausbeute) rechnen Rang und Teamzahl in der **eigenen Liga** (16, nicht 32), Rang 1 = bester (bei Kosten das günstigste Team); (c) „Übertreffe die Erwartung": bei erwartetem Rang 1 steht „Rang 1 halten", sonst „mindestens N Platz/Plätze besser".

Bilder (1920×1080, echte App, Kopie des live-save-Abbilds als Saison 2 mit 20 Spieltagen und zwei Ligen zu je 16): `app-06-gespraech-zustimmung` (ersetzt, nur noch eine Sprechblase der Bitte; die 2560-Fassung mit der Doppelung ist entfernt), `app-12` bis `app-12c` (Ligarang „12 von 16“, „mindestens 1 Platz besser“), `app-13a`, `app-14` (Zusage „Vertrauen einsetzen“ ohne Toast), `app-15` (Zusage steht als offen, nicht verfehlt). Der Fall „Rang 1 halten“ ist durch den Test abgedeckt.

Offen / Befund am Rand: `tests/economy-cashflow-invariant.test.ts` Phase 1 und Aggregat sind **schon auf dem Stand vor dieser Arbeit rot** (Team B-P: die KI baut im Auto-Run Gebäude, `facilityEvents` mit 7 und 13 C, ohne dass die Phase das bucht); unabhängig von den Prämien. Die neue Phase 5b ist grün.
