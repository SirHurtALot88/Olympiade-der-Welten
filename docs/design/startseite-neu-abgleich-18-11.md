# Startseite neu — Abgleich Mockup | App (18.11., Stand Runde 2)

Chris (18.11.): „startseite neu sieht geil aus! bitte genau so einarbeiten, nicht integrieren sondern die jetzige neu bauen“.
Vorlage: `public/mockups/oly-start-modern-18-11.html`, Doku `docs/design/oly-start-modern-18-11.md`.
Gebaut: `app/foundation/home-v2/HomeModern.tsx` + `home-modern.css`, Daten `lib/foundation/startseite-modern.ts`
(`baueStartseiteModern`, im Router-Scope nur gerechnet, solange Home offen ist). Die alte Übersicht
(`HomeV2NewLook.tsx`) ist entfernt; das Office (Reiter „Office") bleibt unverändert.

Bilder (`docs/design/startseite-neu-18-11/`): `abgleich-<zustand>-<BxH>.png` = Mockup links | App rechts,
Zustände `vor` (vor Spieltag 1), `mitte` (nach Spieltag 6), `ende` (nach Spieltag 20); Einzelbilder `app-*` und `mockup-*`.
Der App-Spielstand ist ein Wegwerf-Battle-Save (Liga-Split, Auto-Run), das Team ist das erste der Liste und nicht Chris' Team, deshalb steht im App-Rahmen „Nur Ansicht".
Der Rahmen (Schiene, Kopfzeile) ist der echte App-Rahmen, im Mockup ist er nur angedeutet; die Seite füllt die Fläche, die der Rahmen übrig lässt.

Gemessen (`scripts/screenshot-startseite-neu.ts`-Lauf, Seite scrollt nicht, keine Tafel läuft über): 2560×1440 (Schrift 19,4 px), 1920×1080 (14,1 px), 1710×1112 (14,0 px). Phone 412 breit: einspaltig, Seite scrollt wie im Mockup.

## Runde 2 (neue Lücken geschlossen, Daten lagen im Spielstand)

| Lücke aus Runde 1 | Jetzt | Quelle (nichts doppelt gerechnet) |
|---|---|---|
| Einsatzliste je Disziplin | Strichleiste und „x von n" je Disziplin-Karte (Vierergruppe ohne Strichleiste, wie im Mockup) | gespeicherter Entwurf des laufenden Spieltags: `getTeamMatchdayLineupDraft`, `getMatchdayLineupSideRequirements`, `getLineupDraftSideCounts` — dieselben Funktionen wie der Home-Flow (`homeNextMatchdayStatus`); `lib/foundation/startseite-modern-zustand.ts` |
| Gelegte Formkarte | „Speed +8 gelegt" bzw. „keine gelegt"; ohne Formkarten-Pool (Transfers nicht finalisiert) entfällt die Zeile | `modifiers.d1/d2` des Entwurfs, sonst `formCardPlans`; Pool über `getFormCardFlowStatus` |
| Entscheidungen aus echtem Zustand | „Einsatzliste unvollständig/leer" (n von m Plätzen), „Pflicht-Minuskarte offen" (Strafe am Saisonende, Spieltage Zeit; rot ab 3 Spieltagen), „Spieler verärgert" (Moral unter 40, Spieltage ohne Einsatz), „Vertrag läuft aus" (Endsaison = laufende Saison); danach die Inbox, doppelte Titel entfallen | `buildFormCardSeasonUsageAudit` (dieselbe Zahl wie die Strafe), `laeuftMitDieserSaisonAus`, `baueFormMoralAnzeige`, Einsatz-Zeilen |
| Sprungziele | Einsatzliste → Einsatzliste; Spieler → Spielerprofil; mehrere Verträge → Kader; Inbox-Zeilen → Inbox | Props der Startseite |
| Spieler des Tages | im Meldungsband mit Form-Pfeil: bester des Teams im letzten gewerteten Spieltag (gewonnener Einsatz zuerst, dann Beitrag) | `playerDisciplinePerformances` (`rankInTeam`, `scoreContribution`) |
| Spieler der Saison, Bestes Heimspiel | in der Saisonbilanz; Heimspiel nur, wo der Spielplan Heim/Auswärts speichert | `baueMatchwinnerListe`, `schedule.homeTeamId` |
| Kaderkarten Klasse und Volk | „Hero · Lizard" unter dem Namen | `Player.className`, `Player.race` über `HomeV2TopPlayerCard` |

Weiter offen: Kassenkurve, Spieltags-Buchungen, Apron-Abstand (Finanzkonzept), „Scout-Bericht fertig" (kein Inbox-Eintrag), Einsatzliste-Karten nur für den laufenden Spieltag (der Entwurf gehört sonst nicht zur Karte).

## Drin (wie im Mockup, echte Daten)

| Teil | Quelle |
|---|---|
| Kopf: Wappen, Kicker „Saison · vor Spieltag N von 20 · Liga 2", Lagesatz, fünf Kacheln, Hauptknopf | `HomeV2ClientProps`, `lagesatz()`, Standings-Zeile |
| Kachel Rang mit Bewegung, Punkte mit S-U-N, Ergebnisse (5 Kästchen), Form · Moral, Kasse | Standings, `summiereSaisonBilanz`, `SaisonVerlauf`, `baueFormMoralAnzeige` |
| S-U-N klargestellt: „14-0-10 · 24 Duelle", Tabellenkopf-Hinweis „Disziplin-Duelle (2 je Spieltag)", nirgends „Spiele" | `sunText`, `duelleText`, Test `startseite-modern-vertraege` |
| Spieltag-Karte: Gegner, Heim/Auswärts, je Disziplin Kulissenkarte (Kaderstärke-Anteil, Rang in der Liga, Papierform-Wort ab 55 % / unter 45 %), Vierergruppe mit vier Kadern, „Auf dem Spiel" | `buildSpieltagsUebersicht`, `buildTeamDisciplineRankRowsFromGameState` (Werte und liga-lokale Ränge), `papierform()`, `stehtAufDemSpiel()` |
| Saisonende: Karte wird zur Saisonbilanz (Platz, Marke Aufstieg/Abstieg/Meister, Punkte, S-U-N, beste/schwächste Disziplin, Abstand nach hinten), Kopf „Saison beendet" | `duellPunkteEigen`, `bestimmeZone`, `ZONEN_MARKE_ENDE` |
| Liga-Tabelle: alle 16 Zeilen der eigenen Liga, Bewegung, S-U-N, Verhältnis, Form-Kästchen, Aufstiegs-/Abstiegszone, DU- und GEGNER-Marke; vor Spieltag 1 alphabetisch mit Rang „–" | `teileNachLiga`-Logik, `fieldRaceRankDelta`-Quelle des Scopes |
| Entscheidungen: Inbox-Einträge (kritisch / Warnung / Info) und Vorstandsziel | `inboxItems`, `boardObjectives` |
| Kader · Form & Moral: Team-Form-Zähler, Moral Ø als Gesicht, sechs Karten mit Pfeil und Gesicht | `topPlayers`, `FormMoralMarke`, `BcFormPfeil`, `BcMoralGesicht` |
| Kasse: Kassenstand, Gehälter, Saisonergebnis (GuV), Kredit | `cash`, `salaryTotal`, `guv`, Kreditkern |
| Disziplinen: 20 Kacheln nach Kaderstärke-Rang sortiert, Ampel 1–3 / 4–6 / 7–10 / ab 11, die zwei Disziplinen des Spieltags gold, klein die Duellpunkte, PixelLab-Kulisse als Grund | `ampelFuerRang`, `duellPunkteEigen`, `einsatzlisteKulisseBild` |
| Meldungsband: letzter Spieltag je Disziplin (Sieg/Remis/Niederlage, Ergebnis 0–10, Punkte) und Tabellenführer; vor Spieltag 1 der Saisonauftakt | Übersicht des letzten Spieltags |
| Volle Fläche, „wie ein Game": Wurzelgröße aus verfügbarer Breite und Höhe, Raster füllt die Resthöhe; Phone einspaltig | `useVolleFlaeche` |

## Angepasst (bewusst anders als das Mockup)

- **Kasse ohne Kurve.** Entscheidung des PM: erst mit dem neuen Finanzkonzept (Buchungen je Spieltag). Der Platz der Kurve bleibt als gestrichelte, klar beschriftete Fläche („Kassenverlauf je Spieltag folgt mit dem neuen Finanzkonzept"), die Kurve kann dort später einrasten.
- **Papierform-Wort** nur ab 55 % / unter 45 % (dazwischen „offen"), Vierergruppe Rang 1 / Rang 4 (Entscheidung des PM).
- **Kopf-Kachel Kasse** zeigt Gehälter statt „Saldo letzter Spieltag" (der Saldo existiert noch nicht).
- **Kaderkarten** tragen statt „Klasse · Volk" die Vertragslaufzeit, weil `HomeV2TopPlayerCard` Klasse und Volk nicht führt; die Zahl ist der Gesamtwert (OVR) wie bisher.
- **Entscheidungen**: Zahl und Texte sind die der Inbox, ein Klick öffnet die Inbox (keine Einzelsprünge, weil die Props sie nicht tragen); der Zähler „Inbox (N)" ist die volle Liste.
- **Kopfbild**: bei nur einer Disziplin mit Kulisse (Takeshi hat keine) füllt dieses eine Bild die linke Hälfte statt zwei geteilter.
- **Schiene und Rahmen** unverändert aus der App (kein Umbau, wie beauftragt).

## Fehlt (mit Grund)

| Im Mockup | Warum nicht |
|---|---|
| Kassenkurve, Einnahmen/Ausgaben des letzten Spieltags, „Nächste Buchung", Stadion nur im Heimspiel | Keine Buchungen je Spieltag, bis das Finanzkonzept sie liefert; nichts erfunden |
| Apron-Abstand und Quote | `buildApronProjection` braucht die Projektion über alle 32 Teams; gehört zur Finanzseite, nicht zur Startseite |
| Entscheidung „Scout-Bericht fertig“ | Kein Inbox-Eintrag dafür |
| „Spieler des Tages" im Band, „Spieler der Saison", „Bestes Heimspiel" in der Bilanz | Keine Datenquelle je Spieltag bzw. nicht abgeleitet; weggelassen |
| Hover-Ausklappen der Schiene im Mockup-Rahmen | Ist die echte App-Schiene |

## Weggefallen gegenüber der alten Startseite (nicht im Mockup)

Radar der Achsen, Gebäude-Karte, Entwicklungs-Karte, Kapitän-Hinweis, Warnungs-Chips, Abhak-Kästchen an Inbox-Einträgen (`onCompleteInboxItem`), Spieltag-Stepper. Die Props bleiben in `HomeV2ClientProps`, damit die Shell sie weiter füllt; das Office (Kapitän, Board) bleibt im Reiter „Office". Die zugehörigen CSS-Blöcke `nl-home-*` in `globals.css` sind jetzt ungenutzt und können in einem eigenen Aufräum-PR entfernt werden (wegen der 80 000 Zeilen nicht hier).

## Tests

`tests/startseite-modern-logik.test.ts` (Papierform, Ampel, S-U-N/Duelle, Duellpunkte), `tests/startseite-modern-vertraege.test.ts` (Verdrahtung, beidseitige Klassen-Absicherung, PM-Entscheidungen). Alte Quelltext-Verträge der entfernten Komponente wurden in neun Testdateien auf die neue Komponente umgestellt oder entfernt (`home-verbleibende-spieltage.test.ts` gelöscht, weil sie nur den alten Stepper-Fehler an der alten Datei prüfte; die neue Seite rechnet verbleibende Spieltage aus `season.matchdayIds`).
Wertung/Fingerabdruck unberührt (reine Anzeige, keine Spiellogik angefasst).
