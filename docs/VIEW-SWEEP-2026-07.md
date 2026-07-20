# View-Sweep 2026-07 — Adversarialer UI-Audit aller Haupt-Tabs

**Datum:** 2026-07-17
**Autor:** Claude (Analyse-Deliverable, keine Code-Fixes, keine Commits)

## Methodik

- Dev-Server (`npm run dev`, tsx server.ts) lokal auf `http://localhost:3000` gestartet, per curl-Poll auf 200 gewartet, dann jede View einmal per curl (`--max-time 120`) vorgewärmt, um Cold-Compile-Verzögerungen aus den Screenshots herauszuhalten.
- Screenshots mit Playwright (`/opt/pw-browsers/chromium-1194`), Viewport-Breite **1600px**, `deviceScaleFactor: 1`, `fullPage: true`.
- `localStorage["oly-new-look-v1"] = "true"` per `addInitScript` gesetzt (permanenter "Neuer Look" / velo-Design erzwungen).
- Save: **`save-singleplayer-dev`** (Singleplayer Foundation, Season 1, Spieltag 1, aktives Team `A-A · Armageddon Aftermath`, reiner "Nur Ansicht"-Modus, da das Save kein steuerbares Team hat).
- Aufruf-Muster: `http://localhost:3000/foundation?view=<VIEW>&saveId=save-singleplayer-dev` (+ `team=A-A` bzw. `playerId=player-2389-nysha` wo nötig).
- Pro View wurde auf den Selektor `.is-new-look` gewartet (Timeout 30s) plus 2,5s Settle-Zeit. Bei drei Views (`homeV2`, `matchdayArena`, `playerProfile`) reichte das nicht aus — sie zeigten im ersten Versuch einen eingefrorenen Ladezustand ("Home wird geladen …", leere Scoreboard-Boxen, "Spielerprofil wird geladen …"). Ein zweiter Versuch mit 8–10s zusätzlicher Wartezeit zeigte in allen drei Fällen den vollständig geladenen Zustand — das sind also **keine dauerhaften Hänger**, aber der Umstand selbst ist unten als Finding vermerkt (Ladezustand ohne Spinner/Skeleton-Animation).
- 23 von 23 angeforderten Views wurden erfolgreich gescreenshottet (21 Pflicht-Views + 2 optionale: `teamProfile`, `playerProfile`). Keine harten Ladefehler, keine 500er.
- Ausnahme/Methodik-Hinweis: Bei sehr langen Full-Page-Screenshots (>3500px Höhe) rendert Playwright den fixierten linken Sidebar-Nav gelegentlich versetzt/dupliziert in den Screenshot hinein (sichtbar z.B. im `playerProfile`-Retry). Das wurde als Tooling-Artefakt eingestuft und **nicht** als Produkt-Bug gewertet.

Für jede View wurden Screenshots visuell gegen die Checkliste (Empty/Loading, Overflow/Layout, tote Controls, Formatierung/Konsistenz, 3-Sekunden-Test, Dichte) geprüft; auffällige Stellen wurden zusätzlich gezoomt/gecroppt, um Layout- und Formatierungsfehler zu verifizieren.

---

## Home (`homeV2`)

1. **[P1] Unlesbare Ein-Wort-pro-Zeile-Spalte + überlappendes Badge.** Die linke Karte im "Team"-Bereich der Home-Übersicht rendert ihre Spaltenbreite auf ca. 90–100px, sodass jedes Wort des Hinweistexts ("Wähle dein Team — Noch steuert kein Team dieses Save. Wähle dein Team in den Team-Einstellungen, um Kader, Transfers und Aufstellung selbst zu übernehmen.") einzeln umbricht und eine lange, kaum lesbare Wortkette entsteht. Zusätzlich überlappt ein blaues "Team"-Pill-Badge die Kartenüberschrift, sodass diese nur noch als "ER…S…" sichtbar ist. Text wird zudem rechts abgeschnitten ("Einstellu…", "Aufstellu…", "übernehr…").
   *Vorschlag:* Grid-/Flex-Breite der Karte fixen bzw. auf die volle verfügbare Spaltenbreite strecken; Badge-Positionierung von der Kartenüberschrift entkoppeln.
2. **[P3] Ladezustand ohne Skeleton/Spinner.** Beim ersten Kaltstart-Rendering steht für mehrere Sekunden nur der reine Text "Home wird geladen …" in der Hauptkarte, ohne Spinner oder Skeleton-Animation — auf langsameren Verbindungen wirkt das wie ein eingefrorener Zustand statt eines sichtbaren Ladevorgangs.
   *Vorschlag:* Skeleton-Placeholder oder Spinner-Icon ergänzen.

## Inbox (`inboxV2`)

1. **[P3] Doppelte Filter-/Tab-Ebene.** Es existieren zwei fast identische Kategorisierungs-UIs übereinander: die oberste Tab-Leiste ("Alle 5 / Aufgaben / Warnungen / Transfers / Finanzen / Training") und darunter, innerhalb der "Entscheidungen"-Karte, eine zweite Filterleiste ("Alle 5 / Aufgaben 2 / Facilities 1") mit eigenen Zählern. Für einen neuen Spieler ist nicht sofort klar, warum es zwei Filterebenen für scheinbar dieselbe Liste gibt.
   *Vorschlag:* Eine der beiden Ebenen entfernen oder visuell klar als "globaler Filter" vs. "Unterfilter innerhalb Entscheidungen" trennen.
2. **[P3] Redundante "NUR ANSICHT"-Banner-Wiederholung.** Direkt über jeder Content-Karte erscheint erneut ein goldener "NUR ANSICHT"-Balken, obwohl der Zustand bereits oben im "Bereit"-Header sichtbar ist — bei jeder View identisch, wirkt aber auf Dauer wie eine Doppelwarnung ohne neuen Informationsgehalt (view-übergreifend, hier erstmals notiert).

## Einsatzliste (`lineup`)

1. **[P3] Sehr hohe Informationsdichte.** D1/D2-Slot-Karten, rechte Vergleichs-/Fatigue-Sidebar und Spielerliste sind alle gleichzeitig sichtbar und dicht gepackt; für den 3-Sekunden-Test ist auf Anhieb nicht klar, welches der drei Panels (Slots, Line-Power-Detail, Alternativen-Suche) die primäre Handlungsaufforderung ist. Kein blockierendes Problem, aber Kandidat für visuelle Priorisierung (z.B. ein Panel standardmäßig eingeklappt).

## Matchday-Arena (`matchdayArena`)

1. **[P3] Leere Scoreboard-Boxen direkt nach dem Laden.** Unmittelbar nach `networkidle` zeigt die Arena sieben komplett leere dunkle Boxen ohne jeglichen Inhalt oder Ladeindikator; erst nach zusätzlicher Wartezeit (bzw. Klick auf "Play") füllt sich das Scoreboard mit den 32 Team-Ergebnissen. Ohne sichtbaren Spinner wirkt der Zustand wie eine kaputte Sektion.
   *Vorschlag:* Platzhalter-Skeleton für die Scoreboard-Zeilen, solange die Phase noch nicht gestartet ist.

## Saisonstand (`seasonV2`)

1. **[P1/P2] POW/SPE/MEN-Spalten zeigen pauschal "0" für alle 32 Teams.** In der Team-Liste unter "Sortieren: Rang/POW/SPE/MEN/SOC" steht bei jedem Team `POW 0`, `SPE 0`, `MEN 0`, während nur `SOC` einen realen Wert zeigt (z.B. Mayhem Mavericks: POW 0 / SPE 0 / MEN 0 / SOC 4). Das deckt sich damit, dass an Spieltag 1 bisher ausschließlich SOC-Disziplinen (Football, Showcase) gespielt wurden — der Wert ist also vermutlich technisch korrekt. Das Problem ist die **Darstellung**: eine nackte "0" ist optisch nicht von einem echten Nullwert zu unterscheiden. Die Liga-Leaders-View (`leagueLeaders`) behandelt exakt dieselbe Situation dagegen mit einem Erklärtext ("Noch keine Werte diese Saison — erscheint nach dem ersten Spieltag"). Diese Inkonsistenz zieht sich durch mehrere Views (siehe auch `ranks`).
   *Vorschlag:* "0" durch "—" bzw. Erklärtext ersetzen, solange die Kategorie diese Saison noch nicht gespielt wurde.
2. **[P2] 6. Top-Spieler-Karte rechts abgeschnitten.** In "Spieler-Highlights → Top-Spieler der Saison" wird die sechste Karte ("#6 …") am rechten Containerrand hart abgeschnitten (nur "#6 L" sichtbar, Name/Wert nicht mehr lesbar) — horizontaler Overflow ohne Scroll-Indikator.
   *Vorschlag:* Container auf `overflow-x: auto` mit sichtbarem Scroll-Hinweis umstellen oder auf 5 Karten begrenzen.
3. **[P3] Redundante Punktzahl in jeder Tabellenzeile.** Der Punktewert wird in jeder Zeile doppelt angezeigt: einmal fett direkt neben dem Teamnamen (z.B. "3,7") und ein zweites Mal identisch unter "PUNKTE" weiter rechts in derselben Zeile.

## Teams (`teams`)

1. **[P3] Kryptische 3-Buchstaben-Disziplin-Codes ohne Legende.** Das "Disziplin-Profil" (Radar-Chart + Balkenliste) verwendet ausschließlich Kürzel wie `CLI`, `FOO`, `GEW`, `HOC`, `SPU`, `STA`, `TDM`, `TIT`, `BAS`, `BRE` ohne sichtbaren Tooltip, Hover-Hinweis oder Legende im Screenshot. Für den 3-Sekunden-Test ist unklar, wofür die Kürzel stehen (Fachjargon ohne Erklärung).
2. **[P3] Liga-Teamtabelle dupliziert die Saisonstand-Tabelle.** Die komplette 32-Team-Tabelle am Seitenende (Rang/Punkte/Cash/MW/Gehalt/Kader) ist inhaltlich nahezu identisch mit der Tabelle in "Saisonstand" — dieselben Spalten, dieselbe Sortierung. Für Spieler, die zwischen Tabs wechseln, wirkt das redundant.

## Spieler (`players`)

1. **[P3] Sieger-Podest dupliziert die Top-3-Zeilen der Liste.** Das große "Sieger-Podest" oben (Wildheart/Nysha/Cornelius) zeigt exakt dieselben drei Spieler, die unmittelbar darunter erneut als Zeile 1–3 der sortierbaren Spielerliste erscheinen — leichte Redundanz, kein Blocker.

## Training kompakt (`trainingCompact`)

1. **[P3] Stark wiederholter Fließtext auf allen 12 Spielerkarten.** Jede der 12 Karten enthält (mit nur der Druck-Zahl variiert) denselben Satz "Wächst noch, aber hohes Rückschritt-Risiko (Druck XX) — kippt der Druck weiter, fällt das Netto ins Minus." sowie identisch "Wie kommt das zustande?" und "Forecast · wird erst am Saisonende final angewendet". Bei 12 Karten summiert sich das zu sehr viel wiederholtem Text und macht die Seite unnötig lang/dicht.
2. **[P3] Unklar platziertes "Andere Klasse"-Dropdown.** Jede Trainingskarte endet mit einem Dropdown "Andere Klasse" — im Kontext eines Trainings-Tabs ist nicht selbsterklärend, warum eine Klassenumstellung hier verankert ist statt im Spielerprofil; kein Tooltip sichtbar.

## Gebäude (`trainingV2`)

1. **[P2] Roter "Risiko"-Rahmen widerspricht eigener "Risiko 0"-Anzeige.** Die Zustandsübersicht oben zeigt explizit "Gut 0 · Achtung 0 · Risiko 0 · Nicht gebaut 8". Trotzdem sind 7 der 8 Gebäude-Karten mit einem roten Rahmen umrandet (Farbe, die im übrigen UI für "Risiko/Gefahr" steht) — für ein simples "noch nicht gebaut" ist Rot ein irreführendes Signal.
   *Vorschlag:* Neutrale Rahmenfarbe (z.B. Grau) für "Nicht gebaut" verwenden, Rot für tatsächliche Risiko-/Fehlerzustände reservieren.
2. **[P3] Negative-Zero-Formatierung.** Alle "Eff."-Werte zeigen "−0,0 Mio" (mit Minuszeichen) statt "0,0 Mio" — kosmetischer Formatierungsfehler bei Null-Werten.
3. **[P3] Uneinheitliche Lokalisierung der Gebäudenamen.** "Trainingszentrum" und "Recovery Center" sind (teilweise) übersetzt, während "Scouting Office", "Analytics Room", "Fan Shop", "Arena Upgrade", "Academy" und "Specialist Wing" komplett englisch bleiben — wirkt wie eine unvollständige Übersetzung.

## Transfermarkt (`marketV2`)

1. **[P2] Deal-Desk wirkt trotz geschlossenem Transferfenster voll interaktiv.** Direkt unter dem Hinweis "Kaufphase ist geschlossen — Transfers sind nur im Transferfenster … möglich" bleiben die Laufzeit-Pills ("1/2/3 Saisonen") und der Gehaltsangebot-Slider vollfarbig und optisch nicht als deaktiviert erkennbar (kein Grau/Opacity-Reduktion) — sieht aus wie ein funktionsfähiges Control, ist es aber nicht.
   *Vorschlag:* Deaktivierte Controls visuell klar (Opacity, `cursor: not-allowed`) kennzeichnen.
2. **[P3] Abgeschnittener Spielername ohne Tooltip-Hinweis.** In der Kandidatenliste erscheint "Creepy Ho…" hart abgeschnitten; im Screenshot ist kein Hover-/Tooltip-Mechanismus erkennbar, der den Vollnamen anzeigt.

## Scouting (`scoutingCenterV2`)

1. **[P3] Gesperrte Fog-of-War-Stufen ohne erkennbaren Freischalt-Pfad.** Die Stufenleiste "Enthüllung bei Scouting L0" zeigt Stufen 1–5 mit Schloss-Icons ("🔒 weitere positive Traits", "🔒 negative Traits" usw.), aber im Screenshot ist nicht ersichtlich, wie/wodurch diese freigeschaltet werden (kein Preis, kein Link, kein Hover-Hinweis sichtbar).
   *(Positiv angemerkt: Die Empty-States "Wishlist ist leer" / "Shortlist ist leer" sind vorbildlich mit Erklärtext und CTA gestaltet — Referenz für andere Views.)*

## Historie (`historyV2`)

1. **[P3] Chart mit nur einem Datenpunkt wirkt wie leerer Rendering-Fehler.** "Netto-Ausgaben-Verlauf" zeigt in einem ca. 150px hohen Chart-Bereich lediglich einen einzelnen roten Punkt ohne Achsenbeschriftung, Linie oder Kontext — bei nur einem Deal in Season 1 technisch korrekt, sieht aber wie ein kaputtes/leeres Chart aus statt wie eine bewusste Zeitreihen-Darstellung.

## Kredite (`credits`)

1. **[P1] Sichtbares Admin-/Debug-Control im Spieler-UI.** Unterhalb der Kreditrahmen-Sektion befindet sich eine aktive Checkbox mit dem Label **"Admin-Vorschau: Kredite trotz Season-1- & Phasen-Sperre freischalten"** — ein offensichtliches Entwickler-/QA-Werkzeug, das auch im reinen "Nur Ansicht"-Modus für den Spieler sichtbar bleibt. Das gehört nicht in eine Produktionsansicht.
   *Vorschlag:* Admin-Vorschau hinter ein Dev-/Feature-Flag verschieben, das in Produktion nicht gerendert wird.

## Finanzen (`finances`)

1. **[P3] Großer ungenutzter Leerraum.** Die Seite (1600×1206px) nutzt effektiv nur die oberen ~700px für die beiden Kennzahlen-Karten (Einnahmen/Ausgaben); der Rest der Seite bleibt vollständig leer. Für einen eigenständigen Menüpunkt wirkt das unfertig — z.B. fehlt ein Verlauf über mehrere Spieltage/Saisons oder eine Aufschlüsselung wie in "Historie".

## Ranks (`ranks`)

1. **[P1/P2] Gleicher "POW/SPE/MEN = 0"-Effekt wie in Saisonstand.** Die "PPs pro Bereich"-Liste zeigt für alle 32 Teams durchgehend `POW 0`, `SPE 0`, `MEN 0`, nur `SOC` hat reale Werte (z.B. Golden Gladiators: POW 0 / SPE 0 / MEN 0 / SOC 17). Da derselbe Effekt unabhängig in zwei Views (`seasonV2`, `ranks`) auftritt und dort jeweils ohne Erklärtext dargestellt wird, verstärkt sich der Eindruck eines echten Anzeigefehlers bzw. einer fehlenden Erklärung (siehe `seasonV2` Finding 1 für Detailanalyse und Vergleich mit `leagueLeaders`).
2. **[P3] Sehr kleine, unerklärte Diszi-Codes in der Matrix-Kopfzeile.** Die große Team-Stärke-Matrix oben nutzt zusätzlich zu POW/SPE/MEN/SOC eine lange Reihe weiterer 3-Buchstaben-Codes (TDM, MIN, GEW, HOC, STA, SPU, TEN, CLI, FEC, SCH, TAK …) in sehr kleiner Schrift ohne sichtbare Legende — hohe kognitive Last für den 3-Sekunden-Test.

## Spielplan (`diszis`)

Keine schwerwiegenden Findings. Die Ansicht ist positiv hervorzuheben: Die Diszi-Kürzel im Balkendiagramm werden in der Tabelle direkt darunter mit vollem Namen aufgelöst (z.B. "TDM" → "TDM" bleibt zwar Kürzel, aber "Football", "Showcase", "Tennis" etc. sind an anderer Stelle voll ausgeschrieben), wodurch das Jargon-Problem anderer Views hier vermieden wird.

## Leaders (`leagueLeaders`)

1. **[P2] Inkonsistente Behandlung von "noch keine Daten" zwischen Kategorien.** Drei der acht Kategorie-Karten (PP POW, PP SPE, PP MEN) zeigen korrekt den Erklärtext "Noch keine Werte diese Saison — erscheint nach dem ersten Spieltag", während die übrigen fünf Karten (PPS, PP SOC, MVS, OVR, Training) für denselben Spieltag bereits Werte führen. Das ist for sich stimmig (nur SOC-Disziplinen liefen bisher), zeigt aber im Vergleich mit `seasonV2`/`ranks` (dort: nackte "0" statt Erklärtext für dieselbe Situation) eine fehlende Vereinheitlichung der Leer-/Noch-nicht-Zustände zwischen den Views.

## Sponsoren (`prize`)

1. **[P3] Unklare Kennzahl-Formulierung "Aktiver Sponsor: Nein".** Als Wert einer Kennzahlkarte liest sich "Nein" wie eine Ja/Nein-Antwort statt eines Status; die Teamliste direkt darunter verwendet für denselben Zustand konsistent "Kein Sponsor" — leichte Uneinheitlichkeit innerhalb derselben View.

## Lexikon (`encyclopedia`)

Keine Findings. Vorbildlich umgesetzte Referenz-View: klare Begriffskarten, "Faktoren"- und "So liest du es"-Boxen erklären Fachbegriffe aktiv, inklusive Warnhinweis-Box ("Ein hoher OVR-Spieler kann in der falschen Disziplin schlechter sein…"). Kandidat als Vorbild für andere Views mit unerklärten Kürzeln (siehe `teams`, `ranks`).

## Ewige Tabelle (`allTimeTable`)

1. **[P1] PUNKTE-Spalte zeigt "0" für alle 32 Teams.** In der Tabelle "Season 1 · Laufende Saison" ist die Spalte `PUNKTE` für **jedes** der 32 Teams `0` — obwohl dieselben Teams an anderer Stelle (Saisonstand, Teams-Tab) reale, unterschiedliche Punktwerte zwischen 1,2 und 30,1 haben (z.B. Cold Steel: hier "0", in Saisonstand "30,1 Pkt"). Das ist ein eindeutiger, nicht mehrdeutiger Daten-Bug — im Gegensatz zu den POW/SPE/MEN-"0"-Fällen oben gibt es hier keine plausible Erklärung, da die Gesamtpunktzahl längst existiert.
   *Vorschlag:* Datenbindung der PUNKTE-Spalte in der Ewige-Tabelle-Komponente auf dieselbe Quelle wie Saisonstand/Teams umstellen.

## Team-Einstellungen (`teamSettings`)

1. **[P2] Admin-/Dev-Werkzeug im normalen Team-Menü, inkl. destruktiv wirkendem Button.** Die View trägt den Titel "Control Room" und enthält u.a. "Draft verwerfen", "Export JSON", einen "Admin"-Button, GM-Namen ("Franky"), Save-Verwaltung mit Klonen/Löschen sowie einen rot hervorgehobenen Button **"Season-Start-Reset ausführen"**. Für eine View, die im normalen "Team"-Navigationsbereich zwischen "Historie" und "Ranks" auftaucht, ist die Dichte an Entwickler-/Save-Verwaltungs-Funktionen (inkl. potenziell datenverlust-riskantem rotem Button) für einen Endnutzer weder erwartbar noch selbsterklärend.
   *Vorschlag:* Prüfen, ob Admin-/Draft-/Reset-Funktionen hinter einen separaten Dev-Modus gehören statt in die reguläre Team-Settings-Navigation.
2. **[P3] "PUNKTE 0" auch hier sichtbar** (Team-Fokus-Kachel folgt demselben Muster wie `teamProfile`, siehe unten).

## Team-Profil (`teamProfile`, optional)

1. **[P1] Kopfzeile zeigt falschen Punktwert und komplett andere Zahlenformatierung als der Teams-Tab.** Die Kopfzeile von "Armageddon Aftermath" zeigt `PUNKTE 0` (korrekt wären 27,4, siehe `teams`-Tab für dasselbe Team/denselben Zeitpunkt), sowie `CASH 175` (ohne "Mio"-Suffix, ohne Dezimalstelle), `MW 506.42` und `GEHALT 138.62` (Punkt statt Komma als Dezimaltrennzeichen, kein "Mio"-Suffix). Im Vergleich dazu zeigt die "Teams"-View für exakt dasselbe Team im selben Save-Zustand korrekt: `PUNKTE 27,4`, `CASH 175,0 Mio`, `MW 506,4 Mio`, `GEHALT 138,6 Mio`. Zwei völlig unterschiedliche Formatierungs- und Datenquellen für dieselbe Information in zwei Views derselben App.
   *Vorschlag:* Gemeinsame Formatierungsfunktion (z.B. `formatMio()`) und gemeinsame Datenquelle für Team-Kennzahlen-Header verwenden.

## Spieler-Profil (`playerProfile`, optional)

1. **[P3] Drei 404-Konsolenfehler beim Laden.** Beim Aufruf der View wurden drei `Failed to load resource: 404` Fehler in der Browser-Konsole geloggt (vermutlich fehlende Portrait-/Avatar-Bilder). Passend dazu bleibt der Spieler-Avatar oben links als leeres graues Rechteck ohne Platzhalter-Icon sichtbar — inkonsistent zum "?"-Silhouetten-Muster, das in Transfermarkt und Historie für unbekannte Spielerbilder verwendet wird.
2. **[P3] Sehr lange, dichte Seite.** Der vollständig geladene Screenshot ist ca. 4460px hoch bei 1600px Breite (>4× Viewporthöhe) mit vielen aufeinanderfolgenden Panels (Stats, Top-Disziplinen, Attribute, Training × 3 Intensitätsstufen, Entwicklung & Potential, Forderungen, Vertrag, Historie × 3 Untertabellen). Kandidat für Tabs/Collapse, um die Erstwahrnehmung zu entlasten.

---

## Top 12 über alle Views (schwerwiegendste zuerst)

1. **[P1] `teamProfile`:** Kopfzeile zeigt `PUNKTE 0` statt 27,4 und wechselt komplett das Zahlenformat (Punkt-Dezimal, kein "Mio"-Suffix) gegenüber der identischen Anzeige im `teams`-Tab für dasselbe Team.
2. **[P1] `allTimeTable`:** PUNKTE-Spalte zeigt "0" für alle 32 Teams, obwohl reale Werte (1,2–30,1) an anderer Stelle existieren — eindeutiger Daten-Bug ohne Erklärung.
3. **[P1] `homeV2`:** Team-Hinweis-Karte rendert mit ~90px Spaltenbreite, wodurch jedes Wort einzeln umbricht; ein blaues "Team"-Badge überlappt zusätzlich die Kartenüberschrift — praktisch unlesbar.
4. **[P1] `credits`:** Entwickler-Checkbox "Admin-Vorschau: Kredite trotz Season-1- & Phasen-Sperre freischalten" ist im normalen Spieler-UI sichtbar.
5. **[P2] `teamSettings`:** Vollständiger "Control Room" mit Draft-/Export-/Admin-Funktionen und einem rot hervorgehobenen "Season-Start-Reset ausführen"-Button liegt im regulären Team-Navigationsbereich statt in einem separaten Dev-Modus.
6. **[P2] `seasonV2` / `ranks`:** POW/SPE/MEN-Spalten zeigen für alle Teams pauschal "0" (nur SOC hat Werte), ohne den Erklärtext, den `leagueLeaders` für dieselbe Situation korrekt anzeigt — wirkt wie ein Datenfehler, ist es aber vermutlich nur an der falschen Stelle unkommentiert.
7. **[P2] `marketV2`:** Deal-Desk (Laufzeit-Pills, Gehalts-Slider) bleibt bei geschlossenem Transferfenster voll interaktiv eingefärbt statt sichtbar deaktiviert — tote Controls, die aktiv aussehen.
8. **[P2] `trainingV2`:** Alle unbebauten Gebäude sind rot umrandet, obwohl die Zustandsübersicht direkt darüber "Risiko 0" ausweist — widersprüchliches Farbsignal.
9. **[P2] `seasonV2`:** Die sechste Karte in "Top-Spieler der Saison" wird am rechten Rand hart abgeschnitten (horizontaler Overflow ohne Scroll-Hinweis).
10. **[P2/P3] `teams` & `ranks`:** Durchgängige, unerklärte 3-Buchstaben-Disziplin-Codes (CLI, FOO, GEW, TDM, MIN, HOC, STA, SPU, TEN, CLI, FEC, SCH, TAK …) ohne sichtbare Legende — Fachjargon ohne Erklärung in zwei zentralen Views.
11. **[P3] `trainingV2`:** "−0,0 Mio" (Negative-Zero) statt "0,0 Mio" bei allen Effekt-Werten, kombiniert mit uneinheitlich lokalisierten Gebäudenamen (Deutsch/Englisch gemischt).
12. **[P3] `finances`:** Seite nutzt nur die oberen ~700px von 1206px Gesamthöhe; darunter bleibt die View komplett leer, wirkt für einen eigenen Menüpunkt unfertig.

---

## Nicht bestätigte / entkräftete Verdachtsmomente

- `matchdayArena`: Die anfänglich leeren Scoreboard-Boxen sind kein permanenter Bug, sondern ein Timing-Effekt vor dem "Play"-Trigger (siehe Finding oben, als P3 belassen statt P1).
- `homeV2` / `playerProfile`: Der anfänglich eingefrorene Ladezustand ("… wird geladen") löst sich nach ausreichender Wartezeit vollständig auf; kein dauerhafter Hänger, aber das Fehlen einer Skeleton-Animation bleibt als eigenständiges (kleineres) Finding bestehen.
