# Startseite modern, Fassung 18.11. — Mockup, Datenquellen, Bauanleitung

**Mockup:** `public/mockups/oly-start-modern-18-11.html` (Nachfolger von `oly-start-modern-17-11.html`, die alte Datei bleibt).
**Bilder:** `docs/design/oly-start-modern-18-11/`.
Reines HTML/CSS/Inline-JS/SVG, Schriften lokal (`public/fonts`), 0 PixelLab-Generationen, kein App-Code.

URL-Schalter: `?z=vor|mitte|ende` (vor Spieltag 1 / vor Spieltag 13 / nach Spieltag 20), `?phone=1`, `?still=1` (ohne Mockup-Leiste), `?nav=auf` (Schiene ausgeklappt, sonst per Hover).

| Bild | Zustand |
|---|---|
| `01-mitte-2560x1440.png`, `02-mitte-1920x1080.png`, `03-mitte-1710x1112.png` | mitten in der Saison, alle drei Zielbildschirme |
| `04-vor-spieltag-1-1920x1080.png`, `07-vor-spieltag-1-2560x1440.png` | Saisonstart (Vierergruppe Mini DM + Duell Tennis) |
| `05-saisonende-1920x1080.png`, `08-saisonende-1710x1112.png` | Saisonende mit Aufstieg |
| `06-schiene-ausgeklappt-1920x1080.png` | Icon-Schiene ausgeklappt |
| `09-phone-mitte.png`, `11-phone-vor-spieltag-1.png`, `10-phone-saisonende.png` | Phone 412 breit, einspaltig |

Alle Aufnahmen mit deviceScaleFactor 2, danach auf 256 Farben reduziert (Dateigröße). Gemessen: bei 2560×1440, 1920×1080 und 1710×1112 scrollt weder die Seite noch eine Tafel, kein Element läuft über.

## 1. Was sich gegenüber dem 17.11. geändert hat

1. **Liga-Split und Duell-Wertung statt Saisonpunkten.** Kopf zeigt „4. in Liga 2“, 28 Punkte, Bilanz 14-0-10 und Verhältnis. Die Tabelle ist die ganze eigene Liga (16 Zeilen) mit Aufstiegs- und Abstiegszone, Bewegung, S-U-N, Verhältnis, Form-Kästchen. „412 Saisonpunkte“, „von 32“ und der Sechs-Zeilen-Ausschnitt sind weg.
2. **Spieltag-Karte ohne erfundene Siegchance.** Je Disziplin eine Kulissenkarte mit Kaderstärke-Vergleich (Balken = Anteil A/(A+B), Ränge „#3 gg. #11“ in der Liga), Papierform-Wort aus fester Regel, Einsatzliste- und Formkartenstand. Vierergruppen (Mini DM, Battlefield) zeigen vier Kader statt eines Zweierbalkens. Darunter „Auf dem Spiel“.
3. **Form und Moral.** Kopf-Kachel und Kadertafel zeigen den Team-Form-Zähler (▲▲/▲/–/▼/▼▼) und die Moral als Gesicht grün→rot mit Zahl; jede Spielerkarte trägt Pfeil und Gesicht. Formkarten stehen in der Spieltag-Karte und als Entscheidung („Pflicht-Minuskarte offen“).
4. **Kasse je Spieltag.** Eigene Tafel statt „Kasse und Ziele“: Kassenstand, Verlauf über 20 Spieltage, letzter Spieltag als Einnahmen/Ausgaben, nächste Buchung, Gehaltsquote und Apron-Abstand. Vorstandsziele sind in die Entscheidungen gewandert.
5. **Disziplinen in der eigenen Liga.** Rang unter 16 mit Top-10-Ampel (1–3 grün, 4–6 gelb, 7–10 rot, ab 11 neutral), die zwei Disziplinen des Spieltags gold umrandet, klein die bisherigen Duellpunkte, dezent die PixelLab-Kulisse als Kachelgrund.
6. **Schiene.** 4 rem schmal, klappt bei Hover als Überlagerung mit Gruppen und Namen aus (wie PR #1576); der Inhalt verschiebt sich nicht.
7. **Volle Fläche.** Alles in rem, die Wurzelgröße folgt `min(0,8333vw, 1,4815vh)` (Entwurfsmaß 120 × 67,5 rem = 1920×1080 bei 16 px). Die Seite ist ein Raster mit fester Höhe `100vh`; Tabelle, Kaderkarten, Kurve und Entscheidungen teilen sich die Resthöhe. Bei 16:10 wächst die Höhe der zwei Hauptzeilen, nichts wird abgeschnitten.
8. **Kopf-Kulisse.** Die zwei Disziplinen des Spieltags als geteiltes Hintergrundbild (links D1, rechts D2), abgedunkelt.

## 2. Aufbau

Kopf (Wappen, Lagesatz, fünf Kacheln, Hauptknopf), darunter ein 12er-Raster:

| Spalten 1–5 | Spalten 6–9 | Spalten 10–12 |
|---|---|---|
| Spieltag-Karte | Liga-Tabelle (über beide Zeilen) | Entscheidungen |
| Kader · Form & Moral | | Kasse |
| Disziplinen (ganze Breite, 10 × 2) | | |
| Meldungsband letzter Spieltag (ganze Breite) | | |

Phone: einspaltig in der Reihenfolge Spieltag, Entscheidungen, Tabelle, Kader, Kasse, Disziplinen; Schiene als Leiste unten; Tabelle ohne Bewegung und Verhältnis.

Zustände: Vor Spieltag 1 stehen Rang „–“, 0 Punkte, leere Form-Kästchen, Tabelle alphabetisch, Kasse ohne Kurve, Disziplinen „noch offen“. Am Saisonende wird die Spieltag-Karte zur Saisonbilanz, der Hauptknopf zu „Saisonabschluss öffnen“, keine Disziplin ist gold.

## 3. Datenquellen je Kachel

„vorhanden“ heißt: die Funktion liefert die Zahl heute schon. Pfade ohne Branch liegen auf `main`.

### Kopf

| Anzeige | Quelle | Stand |
|---|---|---|
| Teamname, Wappen, Saison, Spieltag | `HomeV2ClientProps` (`app/foundation/home-v2/home-v2-types.ts`), gefüllt in `FoundationHomeV2Host.tsx` | vorhanden |
| „Liga 2“ | `getLeagueOf()` in `lib/season/league-split.ts` | vorhanden |
| Lagesatz | `lagesatz(zeile, liga)` in `lib/season/saisonstand-modern-logik.ts` | vorhanden |
| Rang in der Liga, Bewegung | `SeasonV2StandingsRow.rank` (liga-lokal), `fieldRaceRankDelta`; Darstellung `bewegungText()` | vorhanden, muss an die Startseite durchgereicht werden |
| Punkte, Verhältnis | `SeasonV2StandingsRow.points`, `.verhaeltnis` | vorhanden |
| S-U-N | `formatiereBilanz()` / `beschreibeBilanz()` in `lib/standings/standings-bilanz.ts` | vorhanden |
| Ergebnis-Kästchen | `formAusVerlauf(verlauf, 5)` aus `SaisonVerlauf` (Prop `verlauf` des Saisonstands) | vorhanden |
| Team-Form-Zähler, Moral Ø | `TeamFormKopf` und `baueFormMoralAnzeige()` (`lib/lineups/form-moral-anzeige.ts`), `BcFormPfeil`, `BcMoralGesicht`, `moralFarbe()` | Branch `claude/form-moral-bau-18-11` (PR #1571); Moral-Durchschnitt des Kaders ist eine Mittelung darüber, fehlt als fertige Funktion |
| Kasse | `HomeV2ClientProps.cash` | vorhanden |
| Saldo letzter Spieltag | — | **fehlt**, braucht Spieltags-Buchungen (Abschnitt Kasse) |
| Hauptknopf, Unterzeile | `nextStepLabel`, `nextStepDetail`, `onContinue` in `HomeV2ClientProps` | vorhanden |
| Kulisse im Kopf | `SpieltagsDuellDisziplin.kulisse`, Bildpfad über `lib/lineups/einsatzliste-kulisse-bild.ts`, Baustein `BcHeroKulisse` | Branch `claude/form-moral-bau-18-11`; geteilte Zwei-Bild-Variante ist neu |

### Spieltag-Karte

| Anzeige | Quelle | Stand |
|---|---|---|
| Gegner, Heim/Auswärts, Disziplinen, Durchgang | `buildSpieltagsUebersicht()` in `lib/foundation/season-matchday-fixtures-overview.ts` (`SpieltagsPaarung.homeTeamId`, `.disziplinen`) | vorhanden |
| Vierergruppe | `SpieltagsUebersicht.miniDmPods` (`SpieltagsMiniDmPod.mitglieder`) | vorhanden |
| Kulissenname | `SpieltagsDuellDisziplin.kulisse.label` | vorhanden |
| Stärke-Rang „#3 gg. #11“ in der Liga | `buildTeamDisciplineRankRowsFromGameState()` → `row.disciplineRanks`, auf die Liga umgerechnet wie `staerkeInLiga` in `SeasonStandingsModern.tsx` (Zeile 448) | vorhanden, `staerkeInLiga` sollte dafür nach `saisonstand-modern-logik.ts` wandern |
| Balken Anteil A/(A+B) | Stärkewerte je Disziplin liegen in `TeamDisciplineRankScorePack.disciplines` (`lib/foundation/team-discipline-rank-engine.ts`), werden aber nicht aus der Funktion herausgegeben | **fehlt halb**: Werte neben den Rängen zurückgeben |
| Papierform-Wort | Regel des Mockups: Anteil ≥ 55 % „Vorteil“, ≤ 45 % „Nachteil“, sonst „offen“; Vierergruppe: Rang 1 „Vorteil“, Rang 4 „Nachteil“, sonst „offen“ | **fehlt**, kleine reine Funktion; Schwellen sind ein Vorschlag |
| Einsatzliste „3 von 4“ | Logik der modernen Einsatzliste (`app/foundation/legacy-lineup-lab/EinsatzlisteModern.tsx`), `homeNextMatchdayStatus` | vorhanden, Zählung je Disziplin muss herausgezogen werden |
| Formkarte gelegt | `seasonState.formCards` / `formCardPlans`, `formkartenBuchung()` und `kartenEffektText()` in `lib/lineups/formkarten-wirkung.ts` | Branch `claude/form-moral-bau-18-11` |
| „Auf dem Spiel“ | `stehtAufDemSpiel(zeile, liga, verbleibendeSpieltage)` | vorhanden |
| Saisonbilanz (Ende) | beste/schwächste Disziplin aus `duellPunkteJeDisziplin()`; Platz und Polster aus der Tabelle | vorhanden; „Spieler der Saison“ aus `PlayerSeasonPerformanceSummary`; „bestes Heimspiel“ **fehlt** (weglassen oder aus `SaisonVerlauf` + Paarungen ableiten) |

### Liga-Tabelle

| Anzeige | Quelle | Stand |
|---|---|---|
| Zeilen der eigenen Liga | `teileNachLiga()` über die Saisonstand-Zeilen | vorhanden |
| Zonen, Linien | `bestimmeZone()`, `ZONEN_TEXT` | vorhanden |
| Bewegung, S-U-N, Verhältnis, Form, Punkte | wie im Kopf, je Zeile | vorhanden |
| Marke „Gegner“ | `SpieltagsPaarung` des eigenen Teams | vorhanden |

Am einfachsten ist `BcTable` mit denselben Spalten-Definitionen wie in `SeasonStandingsModern.tsx`, nur mit weniger Spalten.

### Entscheidungen

| Anzeige | Quelle | Stand |
|---|---|---|
| Liste, Dringlichkeit, Ziel | `inboxItems`, `inboxCriticalCount`, `todayCards`, `warnings`, `onNavigateInboxItem` | vorhanden |
| Vorstandsziel | `boardObjectives` | vorhanden |
| „Pflicht-Minuskarte offen“ | `formCardPenaltyAppliedSeasonIds`, Formkarten-Hand | **fehlt als Inbox-Eintrag**, Regel steht in `docs/design/form-moral-17-11.md` |
| „Spieler verärgert“ | `baueFormMeldungen()`, `moralUrsachen()` | Branch `claude/form-moral-bau-18-11`; als Inbox-Eintrag **fehlt** |

### Kader · Form & Moral

| Anzeige | Quelle | Stand |
|---|---|---|
| Sechs Karten, Portrait, Klasse, Gesamtwert | `topPlayers` (`HomeV2TopPlayerCard`) | vorhanden |
| Pfeil und Gesicht je Spieler | `FormMoralMarke` aus `FormMoralBausteine.tsx` | Branch `claude/form-moral-bau-18-11` |
| Team-Form-Zähler | `TeamFormKopf` | Branch `claude/form-moral-bau-18-11` |

### Kasse

| Anzeige | Quelle | Stand |
|---|---|---|
| Kassenstand | `cash` | vorhanden |
| Gehälter, Quote | `salaryTotal`, `sponsorTotal` / GuV-Posten (`lib/finance/season-end-guv.ts`) | vorhanden (Saisonwerte) |
| Apron-Abstand, Linien | `buildApronProjection()` in `lib/finance/apron-projection.ts`, `apronProjection` je Zeile | vorhanden |
| Kassenverlauf je Spieltag | — | **fehlt**: heute wird am Saisonende gebucht, es gibt keinen Kassenstand je Spieltag |
| Einnahmen/Ausgaben letzter Spieltag | — | **fehlt**, kommt mit dem Spieltags-Kreislauf des Finanzkonzepts |
| Nächste Buchung, Stadion nur im Heimspiel | — | **fehlt**; Heim/Auswärts selbst ist vorhanden (`homeTeamId`) |

### Disziplinen und Meldungsband

| Anzeige | Quelle | Stand |
|---|---|---|
| Stärke-Rang in der Liga | wie Spieltag-Karte (`staerkeInLiga`) | vorhanden |
| Ampel | Regel 1–3 / 4–6 / 7–10 / ab 11 | **fehlt**, drei Zeilen; `rangStufe()` hat eine andere Staffelung |
| Duellpunkte bisher | `duellPunkteJeDisziplin()` (`DuellZelle.punkte` / `.moeglich`) | vorhanden |
| „an diesem Spieltag“ | `getSeasonDisciplineScheduleEntry()` bzw. die Paarung | vorhanden |
| Kachelgrund | `public/sprites/kulissen/<disziplin>/` (Takeshi hat noch keine Kulisse) | vorhanden |
| Meldungsband | Ergebnisse aus `SpieltagsDuellDisziplin` (`punkteHeim/Gast`, `ergebnisNormiert`) des letzten Spieltags; Form-Meldungen `FormBauchbinde` | vorhanden / Branch |

## 4. Echt und erfunden

| Echt | Erfunden |
|---|---|
| Teamnamen, Wappen, Zuordnung der 16 Teams zu Liga 2 (aus dem Saisonstand-Mockup) | Jede Tabellenzahl: Punkte, S-U-N, Verhältnis, Form, Bewegung |
| Spielernamen, Portraits, Klassen, Völker | Gesamtwerte, Form-Stufen, Moralwerte |
| Regeln: 2/1/0 je Disziplin, Vierergruppe 2-1-0-0, Aufstieg 1–3, Abstieg 14–16, 20 Spieltage, 2 Disziplinen je Spieltag | Paarungen, Ergebnisse, Meldungen |
| Kulissenbilder und -namen (PixelLab) | Stärkewerte und -ränge je Disziplin |
| Farbverlauf und Mundform des Moral-Gesichts (nachgebaut aus `lib/morale/moral-anzeige.ts`) | Alle Geldbeträge, Kassenverlauf, Apron-Linien 72 und 78 Mio |
| Größenordnung Kasse und Gehälter (aus echten Aufnahmen: 3,2 Mio, 67,2 Mio) | Papierform-Schwellen 55/45 % |
| Navigationspunkte der Schiene | Frist der Pflicht-Minuskarte, Inbox-Texte |

**Unsicher wegen des laufenden Finanzkonzepts:** ob Einnahmen und Gehälter wirklich je Spieltag gebucht werden, ob es Stadion-Einnahmen nur im Heimspiel gibt (das Finanz-Mockup vom 17.11. sagte noch „es gibt kein Heimspiel“), die Posten-Namen, die Form der „nächsten Buchung“. Sponsoren-Kopplung an Gehälter mit Saisonfaktor ist bewusst **nicht** auf der Startseite; sie gehört auf die Finanzseite. Sicher sind Kassenstand, Gehaltssumme, Quote und Apron-Abstand.

## 5. Bauanleitung

Ziel: `app/foundation/home-v2/` bekommt eine moderne Ansicht neben `HomeV2NewLook.tsx`, umschaltbar wie Saisonstand und Einsatzliste.

Wiederverwenden:
- `components/foundation/broadcast`: `BcHero`, `BcPanel`, `BcTable`, `BcMarke`, `BcIcon`; nach PR #1571 `BcHeroKulisse`, `BcFormPfeil`, `BcMoralGesicht`.
- `lib/season/saisonstand-modern-logik.ts` für alles Tabellarische, `saisonstand-modern.css` für Form-Kästchen und Zonen.
- `FormMoralBausteine.tsx` (`FormMoralMarke`, `TeamFormKopf`).
- Schiene: nichts bauen, `FoundationShell`/`FoundationSidebar` ist fertig.

Reihenfolge:
1. **Daten-Naht.** Eine reine Funktion `baueStartseiteModern(gameState, teamId)` in `lib/foundation/`, die Tabellenzeilen der Liga, `SaisonVerlauf`, die eigene Paarung des nächsten Spieltags, Stärke-Ränge und -Werte, Duellpunkte je Disziplin liefert. `staerkeInLiga` aus `SeasonStandingsModern.tsx` dorthin ziehen; `team-discipline-rank-engine.ts` um die Stärkewerte je Disziplin erweitern. Mit Tests (Papierform-Regel, Ampel, Liga-Rang).
2. **Gerüst.** `HomeModern.tsx` + `home-modern.css`: Raster aus dem Mockup, alle Maße in rem, Wurzelgröße wie im Mockup nur auf diesem Screen (CSS-Variable am Container, nicht global an `html`). Kopf mit `BcHero`.
3. **Tabelle und Disziplinen** (nur vorhandene Daten).
4. **Spieltag-Karte** mit Duell- und Vierergruppen-Variante, Saisonende-Variante.
5. **Entscheidungen und Kader** aus den vorhandenen `HomeV2ClientProps`.
6. **Form & Moral einhängen**, sobald PR #1571 auf `main` ist; bis dahin bleiben Pfeil und Gesicht weg (nichts erfinden).
7. **Kasse:** zuerst nur Kassenstand, Quote, Apron-Abstand. Kurve, letzter Spieltag und nächste Buchung erst, wenn das Finanzkonzept Spieltags-Buchungen liefert; bis dahin bleibt der Platz der Kurve leer oder die Tafel zeigt die Saison-GuV-Posten (`guvPosten`).
8. **Prüfen** bei 2560×1440, 1920×1080, 1710×1112 und Phone; Zustände vor Spieltag 1, mitten in der Saison, Saisonende; Alt-Spielstand ohne Liga-Split (dann Tabelle über 32 und keine Zonen).

Wertung wird nicht berührt; der Fingerabdruck muss gleich bleiben.

## 6. Offene Fragen an Chris

- Papierform-Schwellen 55/45 %: passend, oder lieber nur Ränge ohne Wort?
- Disziplin-Kacheln zeigen den Rang der **Kaderstärke**. Alternative wäre der Rang nach erspielten Duellpunkten; der sagt in den ersten Spieltagen aber fast nichts.
- Kasse: Kurve erst mit dem neuen Finanzkonzept zeigen, oder bis dahin die Saison-GuV?
