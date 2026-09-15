# PM-Gesamtstand 15.09. — was als Nächstes

**Auftrag von Chris:** „Was sagt der PM Overseer, was als nächstes kommt?" Dieser Bericht baut auf
`docs/design/gesamtstand-fertigstellungsgrad-alle-disziplinen-09-10.md` (Stand 14.09. vormittags)
auf und zieht die Merge-Welle 14.09. (PR #920–#930) nach. Alle rho-Zahlen unten sind **frisch
gemessen** auf `main` @ `4ef4f681` (`node scripts/miss-alle-disziplinen.mjs 24`, kaderfest, Median
über fünf echte Kader-Paarungen), nicht aus PR-Texten übernommen — sie bestätigen die PR-Texte
bit-genau, keine Überraschung, keine Regression.

**Spiegel-Frische geprüft (15.09., `pruefe-spiegel-frische.ts`):** beide Spiegel `frisch`
(live-save < 0,1 h, bug-reports < 0,1 h). **Keine neue In-Game-Meldung seit dem 25.08.** — der
Cron läuft, Chris hat seither einfach nichts über die Flagge gemeldet.

---

## 1. Die zwanzig Disziplinen — Stand 15.09.

| # | Disziplin | Chassis | rho/Spiel | Abnahme (>0,80) | Arena-Resolved | Bewegung seit 14.09. |
|--:|---|---|---:|:--:|:--:|---|
| 1 | Speed-Schach | Bühne | 0,908 | bestanden | ja | unverändert |
| 2 | Staffel | Bahn | 0,899 | bestanden | ja | unverändert (PR #925 bit-identisch) |
| 3 | **Spurt** | Bahn | **0,894** | bestanden | **ja (neu)** | **PR #926: jeSeite 4→6, rho 0,871→0,894, jetzt produktiv** |
| 4 | Showcase | Bühne | 0,892 | bestanden | ja | unverändert |
| 5 | Eiskunstlauf | Bühne | 0,885 | bestanden | ja | unverändert |
| 6 | Takeshi's Castle | Bahn | 0,879 | bestanden | ja | unverändert (PR #925 bit-identisch) |
| 7 | Breaking | Bühne | 0,869 | bestanden | ja | unverändert |
| 8 | Wettessen | Bühne | 0,845 | bestanden | ja | unverändert |
| 9 | Gewichtheben | Bühne | 0,843 | bestanden | ja | unverändert |
| 10 | Time-Trial | Bahn | 0,825 | bestanden | ja | unverändert (PR #925 bit-identisch) |
| 11 | Tennis | Bühne | 0,825 | bestanden | ja | unverändert (PR #929 rein Präsentation, rho bit-identisch) |
| 12 | **Football** | Feldspiel | **0,813** | bestanden | **nein — Achse 2** | **PR #924: Korridor-Refit Runde 2, rho 0,800→0,813** |
| 13 | **Fechten** | Bühne | **0,809** | bestanden | ja | **PR #928: Perioden-Struktur, rho 0,816→0,809 (Kaderrauschen)** |
| 14 | Climbing | Bahn | 0,782 | knapp durchgefallen | nein — Achse 1 | unverändert |
| 15 | Basketball | Feldspiel | 0,769 | knapp (Chris-Ausnahme) | ja | unverändert |
| 16 | I-Spy | Bühne | 0,684 | durchgefallen | nein — Achse 1 (bewusst) | unverändert |
| 17 | Hockey | Feldspiel | 0,669 / 0,719 (Feldspieler) | durchgefallen (Chris-Ausnahme) | ja | PR #921/#922: Präsentation, rho bit-identisch |
| 18 | Mini-DM | Arena | 0,256 | durchgefallen | nein — Achse 1 | unverändert (PR #930 nur Spielplan/Wiring, Motor unangetastet) |
| 19 | Battlefield | Arena | 0,251 | durchgefallen | nein — Achse 1 | unverändert |
| 20 | TDM | Arena | 0,165 | durchgefallen | nein — Achse 1 | unverändert |

**Arena-Resolved: 14 von 20** (`lib/resolve/battle-mode-arena-team-points.ts:250-268`), plus Spurt
neu dazu. Sechs fehlen weiterhin:

| Disziplin | Fehlende Achse | Grund |
|---|---|---|
| **Football** | Achse 2 (Technik) | rho bestanden (0,813), aber **kein eigener `ARENA_IMPACT_KONFIG_JE_DISZIPLIN`-Eintrag** — `scripts/ziehe-football-pps-referenz.ts` existiert nicht. Ein Modul-Load-Guard verhindert, dass das versehentlich unbemerkt bleibt (wirft beim Import, falls jemand Football in `ARENA_RESOLVED_DISCIPLINE_IDS` einträgt, ohne die Referenz zu ziehen). |
| Climbing | Achse 1 | 0,782, nur 0,018 unter der Schranke — aber nie eine eigene Kalibrierrunde gehabt. |
| I-Spy | Achse 1 | 0,684 — technischer Anschluss wäre eine Zeile, ist bewusst unterlassen (Achsen-Trennung). |
| TDM / Mini-DM / Battlefield | Achse 1 | 0,165 / 0,256 / 0,251, weit unter der Schranke, Kaderrauschen größer als der Messwert selbst bei n=24 — Validitätsproblem der Zielwahl-Mechanik, kein Messfehler. |

---

## 2. Was sich seit dem 14.09.-Vormittag bewegt hat (PR #920–#930)

- **#920–#922:** Scorecard-Nachzug, Hockey-Präsentation (sichtbarer Offense/Defense-Wechsel),
  kleine Aufräumarbeiten (TON_KATALOG-Rename, Puste-Ticket geschlossen) — alle rho-neutral.
- **#923:** Fechten-Konzeptrecherche (reine Doku, kein Code).
- **#924 — Football-Korridor-Refit Runde 2:** die Auflage aus der #884-Freigabe erfüllt (Korridor
  jetzt in NFL-Nähe: Completion 65,8 %, Yards/Attempt 7,22, Yards/Carry 4,28, Interception 2,5 %).
  **rho 0,800 → 0,813 — Achse 1 jetzt sauber bestanden.** Football fehlt jetzt nur noch Achse 2.
- **#925:** die letzten drei Bahn-Disziplinen (Staffel/Climbing/Takeshi) bekommen dieselbe
  `stepZeitfahren()`-Lösung wie Time-Trial — die eingefrorene Sprite-Uhr ist damit auf **allen
  fünf** Bahnen behoben bis auf eine: **Spurt ist jetzt der letzte offene Fall.**
- **#926 — Spurt-Produktionsanbindung:** Feldgröße 4→6 behoben (war die einzige Bahn mit
  Diskrepanz zur Saison-Feldgröße). rho 0,871 → 0,894, **Spurt ist jetzt die 14. arena-resolved
  Disziplin.**
- **#927:** Mini-DM-Spielplan-Anchoring — reiner Befund, keine Umsetzung. Drei Chris-Entscheidungen
  eingeholt (Liga-Größe bleibt Vielfaches von 4, zweites Vorkommen würfelt neu, additive
  Pod-Struktur statt Fixture-Umbau).
- **#928 — Fechten Perioden-Struktur:** drei FIE-Perioden statt einer Punkteformel, laufender
  Trefferstand im Feed. rho 0,816 → 0,809, innerhalb des Kaderrauschens (0,184). Ein
  Review-Fund (doppelter Perioden-Beat) behoben. **Option 3 (echtes Zielpunktzahl-Ende) bewusst
  zurückgestellt.**
- **#929 — Tennis bekommt Schläger + Ballwechsel im Motor:** reine Präsentation (Movement-Achse
  20 % → höher), `wert()`/Rezept unangetastet, rho bit-identisch.
- **#930 — Mini-DM 4-Team-Pods + Kadergröße 1 + FFA-Motor-Wiring:** additive Pod-Struktur
  (`mini-dm-pod-schedule.ts`), echter Playwright-Aufrufer für den bisher nur per Messskript
  erreichbaren FFA-Kampfmotor — **aber ausdrücklich noch nicht in die Live-Resolve-Pipeline
  verdrahtet**, Mini-DM bleibt außerhalb `ARENA_RESOLVED_DISCIPLINE_IDS`. Ein echter
  Review-Fund behoben: `playerCount:1` wäre lautlos in den Legacy-PPS-Scoring-Pfad
  durchgesickert und hätte jedem Team 0 Ligapunkte gebucht (`rank-to-points.json` kennt keine
  Zeile für 1) — neues Feld `legacyScorePlayerCount` entkoppelt beide Verwendungen.

**Kein Rückgang irgendwo.** Jede gemessene Bewegung ist entweder eine dokumentierte Verbesserung
(Football, Spurt) oder liegt innerhalb des eigenen Kaderrauschens (Fechten).

---

## 3. Offene Punkte aus früheren Runden — aktueller Stand

- **Football-PPS-Referenz:** einziges verbleibendes Stück für Achse 2. `scripts/ziehe-football-pps-referenz.ts`
  existiert weiterhin nicht. Der Modul-Load-Guard in `battle-mode-arena-team-points.ts` verhindert
  einen unbemerkten Merge ohne Referenz.
- **E3 (Football Spiel-Eignung-Override-Tabelle):** `lib/player-generator/spiel-eignung-overrides.ts`
  existiert nicht — **weiterhin nicht gemergt, wartet weiterhin auf Chris' explizite Bestätigung**
  (seit 10.09., also fünf Tage). Unabhängig vom PPS-Referenz-Weg: E3 regelt, ob Kaderbildschirm/
  KI-Kauf dieselbe Football-Stärke zeigen wie das Minispiel, nicht ob Football arena-resolved
  werden darf.
- **Hockey Tor-Gewichtung + Torwart-Stärke:** **Torwart-Stärke ist erledigt** — `HK_TW_REF=0,871`/
  `HK_TW_BASIS=9,13` stehen im Code exakt auf den vom Opus-Review verlangten nachgezogenen Werten.
  Offen bleibt nur ein kleiner, laut Review selbst „praktisch folgenloser" Rest: der Torwart-Zweig
  bucht eigene Tore weiterhin mit `u.punkte*3`, der Feldspieler-Zweig seit K3 mit
  `u.punkte*1.5+u.xg*1.5` — Torhüter schießen fast nie, also ohne Rangtreue-Wirkung, aber
  inkonsistent.
- **Feldspiel Viertel-/Drittelpausen interaktiv:** weiterhin offen, blockiert an derselben
  unbeantworteten Architekturfrage wie am 07.09. (`erlebt ein Nutzer sein eigenes Battle-Mode-Spiel
  künftig live, oder bleibt es headless mit Nachbericht?`) — eine Bedienung ohne live erlebtes
  Spiel wäre wirkungslos.
- **Saison-Spielplan — keine Kurs-Wiederholung:** strukturell gegenstandslos für den heutigen
  Manager-Spielplan (10 Spieltage, 20 Disziplinen, jede genau 1x — nachgemessen über 200 Saisons,
  0 Wiederholungen). Für Battle Mode (20 Spieltage, `repeat=2`) existiert die Infrastruktur
  (Derangement-Logik in `season-discipline-schedule.ts`), **aber kein Produktionsaufrufer setzt
  `repeat:2`** — bleibt latent.
- **Battle-Mode-Saisonstruktur (20 Spieltage/40 Slots, 2x je Disziplin):** **Infrastruktur gebaut
  und getestet, aber nicht Grundlage des Spiels.** Kein aktiver Save trägt `scenarioMeta.gameMode`
  gesetzt (Stand letzter Prüfung); die gesamte Arena-Resolve-Arbeit an 14 Disziplinen ist damit
  real, aber bislang wirkungslos für jeden bestehenden Spielstand.
- **Sound:** acht von zwanzig Disziplinen haben verdrahteten Ton (Basketball einzige mit echten
  Audio-Dateien), zwölf bleiben stumm — unverändert seit 14.09., weiterhin niedrige Priorität
  gegenüber Rangtreue-Arbeit.
- **Fable: In-Race-Verletzungen (Chaos/Tackle) und manager-einstellbarer Spielstil:** beide seit
  ihrer ersten Erwähnung (06./07.09.) unangetastet, keine neue Nachfrage von Chris — Backlog,
  keine Dringlichkeit erkennbar.
- **Mini-DM — die sechs Spielplan-Fragen (`mini-dm-4-team-ffa-recherche-06-09.md` Abschnitt 5):**
  von PR #930 sind **fünf von sechs** technisch beantwortet — Vierergruppen-Bildung (gebaut,
  `mini-dm-pod-schedule.ts`), Teilbarkeit durch 4 (LEAGUE_SIZE bereits fest und getestet), zweites
  Vorkommen (Chris' Entscheidung: neu gewürfelt), zweiter Disziplin-Slot (Chris' Entscheidung:
  bleibt unberührt), Heim/Auswärts-Semantik (eigene Vierergruppe statt erfundenem Gegner gezeigt).
  **Nur Kaderrobustheit bei Verletzung/Sperre im Pod-Kontext ist nie geprüft worden.** Das ändert
  aber nichts am eigentlichen Blocker: **rho 0,256 ist ein Validitätsproblem der
  Zielwahl-Mechanik, kein Spielplan-Problem** — der Spielplan könnte heute fertig sein und Mini-DM
  wäre trotzdem nicht abnahmefähig.
- **Rangtreue-Basislinie (`data/generated/rangtreue-basislinie.json`):** Stand 06.09., **jetzt an
  mindestens elf Zeilen stale** (die acht vom 14.09. plus Football/Fechten/Spurt aus dieser Welle).
  `node scripts/baue-rangtreue-basislinie.mjs 24` ist überfällig — die CI-Schranke fängt derzeit
  nur Rückgänge gegen einen neun Tage alten Stand.
- **Fechten Option 3 (echtes Zielpunktzahl-Ende):** laut PR #928 bewusst zurückgestellt, keine
  neue Nachfrage — braucht bei Bedarf eine eigene Messrunde.
- **N-Team-Audit — die 41 %-Frage (13.09.):** an >40 % der Spieltage läuft heute keine der beiden
  Disziplinen als echtes Duell, weil beide arena-aufgelöst sind (heute: 14 von 20 Disziplinen
  arena-aufgelöst, der Fall trifft also öfter denn je) — **liegt weiterhin unbeantwortet auf
  Chris' Tisch.**

---

## 4. Priorisierte Empfehlung — nächste 2–4 Schritte

1. **Football-PPS-Referenz ziehen und produktiv schalten.** `scripts/ziehe-football-pps-referenz.ts`
   bauen (Vorbild: die 13 bestehenden Referenzen), Eintrag in `ARENA_IMPACT_KONFIG_JE_DISZIPLIN`
   plus `ARENA_RESOLVED_DISCIPLINE_IDS`. **Der billigste Weg auf eine 15. produktive Disziplin**:
   rho ist seit #924 sauber bestanden (0,813), es fehlt nur noch der technische Anschluss, und der
   Modul-Load-Guard macht den Schritt risikoarm. Unabhängig von E3 — E3 betrifft nur, was der
   Manager im Kaderbildschirm sieht, nicht ob das Minispiel korrekt bewertet wird.
2. **Rangtreue-Basislinie neu bauen (`baue-rangtreue-basislinie.mjs 24`).** Elf von zwanzig Zeilen
   sind stale, die CI-Schranke prüft gegen einen neun Tage alten Stand. Aufwand ¼ Tag, überfällig
   seit dem 14.09.-Nachtrag, rho-Risiko keins — reine Wartung, aber sie schützt jede künftige
   Messung vor einem falschen Referenzpunkt.
3. **Chris' zwei offene Entscheidungen einholen — beide blockieren, keine kostet Bauzeit.**
   (a) E3 (Football-Anzeige folgt der Spiel-Eignung, seit 10.09. offen) und (b) die 41 %-Frage aus
   dem N-Team-Audit (heute jeder zweite Spieltag betroffen, Tendenz steigend mit jeder weiteren
   arena-resolved Disziplin). Beides sind Ein-Satz-Antworten von Chris, die eine ganze Bauarbeit
   entweder freigeben oder aus dem Plan streichen — der teuerste Fehler wäre, ohne sie
   weiterzubauen und danach umzudrehen.
4. **Climbing eine eigene Kalibrierrunde geben.** Mit 0,782 die **billigste offene
   Rangtreue-Baustelle** im ganzen Feld (0,018 fehlen, Kaderrauschen 0,191 — zehnmal so groß wie
   der Fehlbetrag), aber die einzige Bahn-Disziplin ohne je eine eigene Modellierungsrunde gehabt
   zu haben. Ein kleiner, gezielter Durchgang (nach dem Tennis-Muster: Rezept an die eigene Matrix
   nachziehen statt Fremdrezept) ist der naheliegende nächste Versuch und brächte bei Erfolg eine
   16. produktive Disziplin.

**Bewusst NICHT priorisiert:** eine neue Zielwahl-Rezeptrunde für TDM/Mini-DM/Battlefield. Alle
drei liegen so weit unter der Schranke, dass selbst eine erfolgreiche Änderung bei n=24 nicht vom
Kaderrauschen zu unterscheiden wäre (Spannweiten 0,272–0,778 gegen Messwerte 0,165–0,256) — hier
zuerst zu bauen hieße, einen Erfolg zu riskieren, der sich nicht nachweisen lässt. Vor jeder
Rezeptarbeit an diesen dreien braucht es zuerst ein größeres Messbudget (n≥96–150, geschätzt
3–4 Minuten je Disziplin und Variante) als eigenen, planbaren Schritt.
