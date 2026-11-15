# Fable UI/UX-Brainstorm — die ganze Foundation-App (14.11.)

Auftrag: dieselbe große Brainstorm-Runde, die Fable sonst für Disziplinen fährt, diesmal für
**UI/UX der gesamten Foundation-App** — nicht nur die Battle Arena. Reine Konzeptarbeit, kein Code
geändert, nichts gemessen (hier gibt es kein rho, keine Pp-Abweichung — die Eignungsmatrix ist von
alldem unberührt).

## 0. Methode und Quellenlage

**Live durchgesehen**, nicht nur am Code gelesen: `npm run dev` in einem eigenen Worktree
(`claude/fable-uiux-brainstorm-1114`), Spiegel-Abbild des Live-Spielstands
(`origin/live-save`, Stand 14.11., Season 1 · Spieltag 1, Team „Nunchuck Ninjas"), Playwright mit
echtem Rendering, Screenshots für jeden Hauptbereich. `OLY_AUTO_EXPORT_SAVES=0` gesetzt, damit die
lokale Durchsicht nichts auf `live-save`/`main` zurückschreibt — dieses Dokument verändert keinen
Spielstand.

**Einschränkung, ehrlich benannt:** Die Dev-Umgebung dieser Sitzung war unter Last mehrfach
instabil (OOM-Kills beim Kompilieren einzelner Routen, u. a. beim ersten Aufruf von Spieler- und
Battle-Arena-Ansichten). Für **Spieler-Profil** und **Team-Profil eines fremden Teams** ließ sich
deshalb kein sauberer Screenshot ziehen — dort stützt sich dieses Dokument auf Code-Lektüre
(`app/foundation/player-profile/`, `app/foundation/team-profile/`) und die PR-Historie (#48, #51),
nicht auf eigene Live-Beobachtung. Das steht an der jeweiligen Stelle noch einmal. Ein Nebenfund
dieser Instabilität steht trotzdem unten (Abschnitt 7) — er trat zweimal unabhängig auf.

**Was schon an Fable-Vorarbeit existiert — hier nicht wiederholt, nur referenziert:**

| Bereich | Dokument | Stand |
|---|---|---|
| Einsatzliste (Struktur) | `docs/design/aufstellung-screen-rework-08-11.md` | Konzept, PR #1358 offen |
| Einsatzliste (Bild: Mini-Feld, Gold, Gegner-Fäden, Farben) | `docs/design/einsatzliste-gesamtkonzept-visuell-08-11.md` | Konzept, PR #1358 offen |
| Scouting (FM27-Ring, Scout-Note, unbegrenzte Liste) | `docs/design/scouting-ausbau-konzept-11-11.md` | Konzept, noch nicht gebaut |
| Spieler-Seite (Podium, Ridgeline, Hover-Steckbrief) | PR #51 | gemerged |
| Home-Bento, Scouting→NL, Verträge→NL (Welle 3) | PR #78 | gemerged |
| Spielerprofil (Achsen-Detail, Entwicklung konsolidiert) | PR #48 | gemerged |
| Transfermarkt-Mitte (Radar kompakt, Top-5-Sprünge) | PR #49 | gemerged |
| Shell-Breite (Sidebar-Clipping, Breit/Cinema auf 4K) | PR #102 | gemerged |

Dieses Dokument füllt die Lücke **zwischen** diesen Einzelrunden: ein zusammenhängender Blick über
alle zwanzig-plus Bildschirme der Foundation, mit Fokus auf das, was noch **niemand** angefasst hat
(Saisonstand, Gebäude, Historie, Kredite, Training, Arena-Vorschau) und auf **bereichsübergreifende**
Muster, die keine Einzel-PR sieht, weil sie nur im Vergleich auffallen.

---

## 1. Home / Cockpit (`app/foundation/home-v2`)

**Befund.** Seit PR #78 ein 12-Spalten-Bento-Grid: Hero (Team, Rang, Cash, Form), „Top-Kader — Deine
besten 6" als Portraitkarten, Radar „Team-Stärke", „Aufsteiger & Risiken", Board-Ziele,
Entscheidungen-Vorschau, Gebäude-Streifen. Insgesamt die am saubersten durchkomponierte Seite der
App — und ein gutes Vorbild für den Rest. Zwei Dinge fallen trotzdem auf
(Beleg: `docs/design/fable-uiux-screenshots-14-11/01-home-cockpit.png`):

1. **Die Top-Kader-Kacheln sind ein 5er-Raster, der Kader hat aber 6 Spieler bis zum Minimum.**
   Karte #6 (hier: Larissa) steht allein in einer zweiten Zeile, daneben vier Kachelbreiten leerer
   Raum. Ein Layout, das für „5 oder 6" gebaut wurde, zeigt bei 6 eine sichtbare Lücke.
2. **Vor Spieltag 1 ist fast jede Zahl ein ehrlicher Platzhalter** („—" bei PPS, „Noch keine Form —
   erst 0 Spieltage", MVS „0,0 · #1" für **alle** Spieler gleichzeitig). Das erste ist vorbildlich
   (die App behauptet nichts, was der Motor noch nicht weiß — genau die Linie aus dem
   Verhalten-Befund). Das zweite nicht: „0,0" mit Rang „#1" bei elf von elf Spielern gleichzeitig
   sieht wie eine echte Bewertung aus, ist aber ein Tie-Break-Artefakt ohne Aussage.

**Ideen.**
- Kader-Grid auf echte Spaltenzahl des Minimums reagieren lassen (z. B. 3×2 oder 2×3 statt 5+1),
  oder die 6. Karte bewusst breiter ziehen statt sie verwaist stehen zu lassen.
- MVS vor dem ersten gewerteten Ereignis durchgängig als „—" statt „0,0 · #1" zeigen — dieselbe
  Regel, die schon bei PPS gilt, nur an dieser einen Stelle vergessen.
- Das Muster „Hero-Karte + Portraitkarten + Radar + Ziel-Liste" ist stark genug, um als Vorlage für
  Team-Profil und (wo passend) Spieler-Profil zu dienen — siehe Abschnitt 11 (Bibliothek).

## 2. Inbox / Entscheidungen (`app/foundation/inbox-v2`)

**Befund.** Fünf Dringlichkeits-Spalten (Kritisch / Heute sinnvoll / Kann warten / Berichte &
Momente), jede Karte mit Aktions-Button, der direkt zur betroffenen Stelle springt („Lineup
öffnen" → Einsatzliste). Das ist genau das Muster, das ein Decision-Inbox haben soll: nicht nur
melden, sondern hinführen. Beleg: `docs/design/fable-uiux-screenshots-14-11/02-inbox-entscheidungen.png`.

Ein Kontrast-Problem: Die „Kritisch"-Karte hat einen kräftigen roten Dot und einen roten Rahmen —
gut. Die beiden „Heute sinnvoll"-Karten darunter tragen denselben Orangeton wie die beiden
„Kann warten"-Karten weiter unten; der Unterschied zwischen den **Spalten** ist nur die
Abschnittsüberschrift, nicht mehr die Karte selbst. Wer die Seite nur überfliegt (genau der
Anwendungsfall einer Inbox), sieht drei optisch fast identische Orange-Karten und muss den
Abschnittstitel lesen, um den Unterschied zu verstehen.

**Ideen.**
- Drei klar unterscheidbare Dringlichkeits-Farben/-Intensitäten statt „Rot + zweimal fast gleiches
  Orange" — z. B. Orange für „Heute sinnvoll", ein gedämpftes Blau/Grau für „Kann warten".
- Die Badges `AUFGABE` / `WIEDERKEHREND` / `AUTOMATISCH` sind nützliche Metadaten, aber auf jeder
  Karte alle drei nebeneinander zu wiederholen, ist Rauschen, sobald man mehr als drei, vier Karten
  hat. Kandidat für eine kompaktere Kombi-Pille.

## 3. Einsatzliste (`app/foundation/legacy-lineup-lab/LineupNewLook.tsx`)

**Befund.** Das ist der Stand **vor** PR #1358 — der heutige Screen (Beleg:
`docs/design/fable-uiux-screenshots-14-11/03-einsatzliste-ist-zustand.png`) ist bereits
funktional dicht: Formkarten-Dropdowns, „Best Fit"-Vorschläge, ein rechtes Panel mit allen
Kandidaten sortiert nach Fit. Genau diese Seite ist aber schon Gegenstand von zwei sehr
ausführlichen, bereits gebilligten Fable-Konzepten (siehe Tabelle oben) und einer offenen PR — hier
deshalb bewusst **keine** neue Analyse, um nicht zum dritten Mal dasselbe Terrain zu vermessen.

**Eine Beobachtung, die in keinem der beiden Konzepte explizit vorkommt:** „Erwartete Punkte 0,0"
in der Kopfzeile, bevor ein einziger Slot besetzt ist, liest sich wie eine Vorhersage („wir werden
0 Punkte holen"), ist aber nur „noch nichts eingetragen". Dasselbe Prinzip wie beim MVS-Fund in
Abschnitt 1 — lohnt sich, bei der F4-Tooltip-Runde aus PR #1358 mitzunehmen: ein Leerstand-Text
statt „0,0", solange `0 von N Plätzen besetzt` gilt.

## 4. Arena-Vorschau vs. „Battle Arena" — zwei verschiedene Dinge unter ähnlichem Namen

**Befund, und das ist der eigentliche Fund dieses Abschnitts:** Die Sidebar hat zwei Einträge,
die beide nach Kampfbildschirm klingen:

- **„Arena"** (`app/foundation/discipline-stage`, Beleg
  `docs/design/fable-uiux-screenshots-14-11/10-arena-vorschau-vs-battle-arena.png`) ist der echte
  Spieltag-Flow: „Vor dem Anpfiff", Kaufphasen-Hinweis, Disziplin-Karten mit Besetztzahl, ein
  Schloss-Icon „Ergebnis bleibt verdeckt, bis Disziplin 1 komplett gewertet ist" — sauber,
  spoilerfrei, sagt klar, was fehlt (0 von 32 Teams bereit).
- **„Battle Arena"** (eigener Sidebar-Punkt, eigene Route, Beleg
  `docs/design/fable-uiux-screenshots-14-11/11-battle-arena-dev-tool.png`) ist explizit **kein**
  Spielbildschirm, sondern ein Entwickler-Werkzeug: „Battle Arena — Entwurf … noch keine offizielle
  Wertung" und darunter ein 360-Spieler-Vergleich „Pixel-Figuren vs. Kartenbilder" zur Prüfung der
  PixelLab-Migration. Das steht so auch im Seitentext selbst — die Seite deklariert sich sauber als
  Werkzeug, nicht als Bug.

**Das Problem ist nicht die Seite, sondern ihre Position.** Ein Spieler, der zum ersten Mal durch
die Sidebar scrollt, sieht „Arena" und „Battle Arena" nebeneinander in derselben Gruppe
(„SPIELTAG") und hat keinen Grund anzunehmen, dass einer der beiden ein internes QA-Werkzeug mit
360 Charakterkarten ist. Die Seite selbst warnt zwar im Fließtext, aber Sidebar-Einträge werden vor
dem Klick gelesen, nicht danach.

**Ideen.**
- „Battle Arena" entweder umbenennen (z. B. „Figuren-Vergleich (Dev)") oder aus der
  Haupt-Sidebar in einen sichtbar abgetrennten Entwickler-Bereich verschieben (die App hat mit
  `app/foundation/debug` bereits so einen Ort).
- Falls Chris sie bewusst sichtbar halten will (zum „Anschauen und Zerreden", wie der Seitentext
  sagt), reicht schon ein optisch anderes Badge/Icon in der Sidebar, damit sie nicht wie ein
  zweiter Kampfbildschirm aussieht.
- Für den eigentlichen Live-Kampfbildschirm (Discipline-Stage-Arena während eines laufenden
  Spieltags, `app/foundation/discipline-stage/arena/`) gilt dasselbe wie für die Einsatzliste:
  bereits ausführlich in `einsatzliste-gesamtkonzept-visuell-08-11.md` Abschnitt 6–8 (Gegner-Geister,
  Erwartungs-Waage, Live-Delta) und `docs/design/battle-arena-spieltag-anbindung-02-11.md`
  konzipiert — hier nicht verdoppelt.

## 5. Saisonstand / Ewige Tabelle (`app/foundation/season-v2`, `app/foundation/all-time-table-v2`)

**Befund.** Der Saisonstand (Beleg: `docs/design/fable-uiux-screenshots-14-11/04-saisonstand-dichte-tabelle.png`)
ist mit 14 Spalten × 16 Zeilen je Liga die dichteste Tabelle der App: Rang, Team, Punkte,
Dav.-Bonus, Formkarten, Rest, Verl., POW/SPE/MEN/SOC, MW, Cash, Sponsoren, Gehälter, Gebäude,
Transfers, GUV. Vor Spieltag 1 sind **acht** dieser vierzehn Spalten „—" oder „0" in jeder einzelnen
Zeile (Dav.-Bonus, Verl., POW–SOC) — 16 Zeilen × 8 Platzhalter-Zellen, nur um am Ende doch „noch
nicht gewertet" zu sagen, was der Text direkt darüber schon einmal sagt.

Die **Ewige Tabelle** macht genau das richtig, was dem Saisonstand fehlt: ein Hinweis-Banner
„Noch keine abgeschlossene Saison archiviert … Medaillen, Top-5/Top-10, Ø-Punkte und Ø-Rang füllen
sich, sobald die erste Saison abgeschlossen ist" — **vor** der Tabelle, einmal, statt in jeder
Zelle einzeln.

**Ideen.**
- Das Ewige-Tabelle-Muster (ein Erklärsatz vor der Tabelle statt Platzhalter in jeder Zelle) auf den
  Saisonstand übertragen: Vor Spieltag 1 die vier Achsen-Spalten und „Verl." entweder ausblenden
  oder zu einer einzigen „füllt sich ab Spieltag 1"-Spalte zusammenfassen.
- Die Tabelle selbst (Rang/Team/Punkte/MW/Cash) bleibt dann deutlich lesbarer, ohne Information zu
  verlieren — sie kommt ja erst ab Spieltag 1 dazu.
- Gemeinsame Komponente für „Vor-Saisonstart-Banner" (siehe Abschnitt 11) statt an mehreren Stellen
  leicht unterschiedlich formulierter Einzeltexte.

## 6. Teams / Kader (`app/foundation/teams-v2`, `app/foundation/team-profile`)

**Befund (eigenes Team, live gesehen).** Disziplin-Profil-Radar + sortierbare Balkenliste über alle
20 Disziplinen, Kaderprofil mit Portraitkarten (dasselbe Kartenmuster wie Home), Saison-Führung
(Kapitänswahl mit Moral-Puffer/Rivalitäts-Druck/Vorstands-Druck als Zahlen sichtbar — gut, macht
eine sonst unsichtbare Managemententscheidung nachvollziehbar). Jede Kaderkarte trägt einen
farbigen linken Rand (in den gesehenen Daten: Violett, Rot, Cyan, Grün, Blau, Gold …), aber **nirgends
auf der Seite steht, wofür diese Farbe steht** — keine Legende, kein Tooltip im Screenshot
erkennbar. Vermutlich Klasse/Fraktion, aber das ist eine Vermutung, keine gelesene Information.

**Befund (fremdes Team — nicht live geprüft, s. Abschnitt 0).** Laut `TeamProfileNewLook.tsx` /
PR-Historie gibt es eine eigene Ansicht für gegnerische Teams (Fog-of-War-reduzierte Kaderwerte).
Ob sie dasselbe Karten-/Radar-Vokabular wie die eigene Teamseite und wie Home teilt, oder eine
dritte, eigene Optik hat, ließ sich in dieser Sitzung nicht verifizieren — lohnt einen gezielten
Vergleichs-Screenshot in einer stabileren Sitzung, bevor hier weiter spekuliert wird.

**Ideen.**
- Farblegende für den Kartenrand ergänzen (Tooltip oder eine kleine Zeile „Rand = Klasse"), analog
  zur Positionsfarben-Erklärung, die für die Einsatzliste bereits geplant ist
  (`einsatzliste-gesamtkonzept-visuell-08-11.md` Abschnitt 4.5: „Kürzel steht immer neben der
  Farbe").
- Gezielter Soll-Ist-Vergleich „eigenes Team vs. fremdes Team" nachholen, sobald die Dev-Umgebung
  stabil eine Session durchhält — nicht aus diesem Dokument heraus behauptet, sondern als offene
  Prüfung markiert.

## 7. Spieler — Liga-weite Tabelle & Profil (`app/foundation/players-table`, `app/foundation/player-profile`)

**Befund 1 — Liga-Tabelle, live gesehen.** „Sieger-Podest" (PR #51) zeigt die Top-3 der Liga als
1-2-3-Podium. In den gesehenen Daten sind alle drei Portrait-Ringe **leer** — keine Spielerfigur,
kein Platzhalter-Icon, nur ein leerer Farbring über dem Podestblock (Beleg:
`docs/design/fable-uiux-screenshots-14-11/05-spieler-podium-leere-ringe.png`). Derselbe fehlende
Fallback zeigt sich an zwei weiteren, unabhängigen Stellen: in der Transferhistorie trägt der
„Top-Kauf #1" (Jump & Slash) nur ein graues „?"-Symbol statt eines Portraits
(`08-historie-fehlendes-portrait.png`), und im Scouting-Report trägt ein zu 100 % gescouteter
Kandidat (Crimson Shadow) gar kein Icon, während ein zu 0 % gescouteter (Espresso) wenigstens eine
Silhouette zeigt. Drei verschiedene Stellen, drei verschiedene „kein Bild"-Zustände (leerer Ring /
Fragezeichen / ganz leer) für dasselbe zugrunde liegende Problem: **es gibt kein einheitliches
Fallback-Avatar für Spieler ohne (geladenes) Portrait.**

**Befund 2 — Spielerprofil, nicht live geprüft.** Siehe Abschnitt 0 und Abschnitt 8: der Versuch,
von einer Kaderkarte auf der Teams-Seite ins Spielerprofil zu wechseln, blieb in dieser Sitzung
zweimal unabhängig auf „Spielerprofil wird geladen…" hängen (Ladebild, kein Inhalt, auch nach
12 Sekunden Wartezeit). Ob das ein echter Produktionsfehler oder eine Eigenart dieser lokalen
Dev-Sitzung (großes Spiegel-Abbild, instabiler Server) ist, kann dieses Dokument nicht entscheiden
— aber es trat **konsistent reproduzierbar** auf, nicht einmalig, und verdient eine gezielte
Nachprüfung mit frischem Server, bevor man es als harmlos abtut.

**Ideen.**
- **Eine** Fallback-Avatar-Komponente für „kein Portrait" (Initialen oder Klassen-Icon auf
  neutralem Grund), überall eingesetzt, wo heute Ring/Fragezeichen/Leere nebeneinander existieren:
  Podium, Historie-Spotlight, Scouting-Kreis, Kaderkarten. Kleiner Umfang, großer
  Konsistenzgewinn — guter Kandidat für die gemeinsame Bibliothek (Abschnitt 11).
- Das Laden-Hängenbleiben als eigenständiges Ticket verfolgen (technischer Bug, kein
  Gestaltungsvorschlag) — hier nur dokumentiert, damit es nicht verloren geht.

## 8. Transfermarkt (`app/foundation/transfermarkt-v2`)

**Befund.** Die Seite ist bereits aufwendig gegliedert (Markt-Pool-Filter, Kandidaten-Panel,
Scouting-Profil, Deal-Desk, Team-Impact, Wunschliste, aktueller Kader mit Achsen-Vergleich) — und
seit PR #49 bewusst kompakter (Radar neben statt über den Achsen-Kacheln). In der gesehenen Session
(Kaufphase offen, 0 Kandidaten sichtbar) blieb das „Kandidaten"-Panel dauerhaft im
Lade-Shimmer-Zustand, während direkt daneben schon „0 sichtbar" stand (Beleg:
`docs/design/fable-uiux-screenshots-14-11/07-transfermarkt-haengender-skeleton.png`). Ein
Lade-Skelett und ein bereits aufgelöster „leer"-Zähler gleichzeitig ist ein Widerspruch: entweder
ist noch nicht geladen (dann sollte auch der Zähler „…" zeigen) oder es ist fertig geladen und leer
(dann gehört dort ein Empty-State hin, kein Shimmer).

**Ideen.**
- Lade-Skelett konsequent durch einen Empty-State ersetzen, sobald der Zähler feststeht — nicht
  beides gleichzeitig zeigen.
- Ein Empty-State mit Grund wäre hilfreich: „0 Kandidaten, weil Kaderminimum/Filter X" statt eines
  stummen Leerzustands, der wie ein Ladefehler aussieht.

## 9. Scouting (`app/foundation/scouting-center-v2`)

**Befund.** Solide Grundstruktur (Fog-of-War-Stufen 0–5 mit klaren Freischalt-Haken, Wartequeue mit
Drag & Drop, Shortlist-Vergleichstabelle) — aber erkennbar der Stand **vor** dem FM27-Ring-Konzept
aus `scouting-ausbau-konzept-11-11.md`: Scouting-Fortschritt steht heute als nackte Prozentzahl in
einem schlichten Kreis ohne Schulnote, ohne Empfehlungstext, ohne „Warum"-Bericht. Genau diese Lücke
beschreibt das referenzierte Konzept bereits vollständig (Notenskala 1+ bis 6, Ring = Scouting-%,
Mitte = Note, Klick öffnet Bericht) — hier deshalb keine zweite Fassung, nur die Bestätigung aus der
Live-Ansicht, dass die Lücke, die das Konzept schließen soll, tatsächlich da ist.

**Idee.** Den Bauauftrag aus `scouting-ausbau-konzept-11-11.md` als nächsten Schritt für diesen
Bereich vorziehen — er ist bereits vollständig spezifiziert, nur noch nicht gebaut.

## 10. Training (`app/foundation/training-compact`, `training-facilities-v2`)

**Befund.** Dichte, aber gut lesbare Tabelle: Intensitäts-Chips (L/M/H) mit Zielwert-Markierung,
Netto/Saison mit Richtungspfeil, Belastungsbalken, Klassen-Vorschlag. Ein kleines Unschärfe: Die
Spalte „Klassen-Vorschlag" zeigt mal „★ Vorschlag: Mage" (echte Empfehlung), mal „Overseer passt"
oder „Hero passt" (bereits optimal) — beides ohne Icon-Unterscheidung außer dem Stern, der nur bei
der ersten Variante auftaucht. Auf den ersten Blick sehen beide Zustände gleich „vorschlagsartig"
aus.

**Idee.** Zwei klar unterscheidbare Icons (Stern = Wechsel empfohlen, Haken = passt bereits) statt
„Stern vs. kein Icon" — kleine Änderung, spürbarer Lesbarkeitsgewinn in einer ohnehin dichten
Tabelle.

## 11. Gebäude (`app/foundation/facilities-v2`, `facilities-overview-v2`)

**Befund.** Gute Struktur (Investitions-Radar mit Amortisationszeit, Zustands-Filter, Kosten-Kurven
L1–L5 als Balkendiagramm) — zwei visuelle Schwächen (Beleg:
`docs/design/fable-uiux-screenshots-14-11/06-gebaeude-overlay-icons.png`):

1. **Alle sieben Gebäude-Karten zeigen denselben Satz generischer Flat-Icons** (Haus-Symbol,
   Plus-Symbol, Turm-Symbol, Balkendiagramm-Symbol …) statt irgendeiner Gebäude-Illustration. Das
   ist nicht verboten — im Gegenteil: **Requisiten/Objekte sind von der PixelLab-Sperre
   ausdrücklich ausgenommen** (CLAUDE.md, Chris 10.11.: „die normalen Assets, die wir brauchen, wie
   eine Schatztruhe oder eine Kiste … die darfst du auch so weiterhin generieren"). Ein Gebäude ist
   kein Charakter — ein PixelLab-Icon pro Gebäudetyp (Fan Shop, Academy, Analytics Room, Arena
   Upgrade, Specialist Wing …) wäre ein kleiner, erlaubter Auftrag mit sichtbarem Effekt auf einer
   bisher sehr trockenen Seite.
2. **Die aufgeklappte Detailkarte („Trainingszentrum") legt sich als Overlay über die Kartenreihe**,
   statt inline zu expandieren — sie verdeckt sichtbar Teile der beiden Nachbarkarten dahinter. Das
   wirkt wie ein Modal, das aus Versehen an der falschen Stelle im DOM gelandet ist.

**Ideen.**
- Gebäude-Icons als PixelLab-Requisiten in Auftrag geben (sieben Typen, einmalig) — braucht keine
  Rückfrage laut der ausdrücklichen Ausnahme, aber sinnvoll, Chris kurz zu informieren, bevor es
  passiert, da es trotzdem eine sichtbare Bestellung ist.
- Detailkarte als echtes Inline-Expand (Karte wächst nach unten, Nachbarn rutschen) statt als
  überlagerndes Panel.

## 12. Historie / Transferhistorie (`app/foundation/transfer-history-v2`)

**Befund.** Die reichhaltigste, am wenigsten angefasste Seite der App: Deal-Flow-Kennzahlen,
Markt-Highlights, 9-Teams-Vergleich mit Mini-Sparklines, Deal-Strom als Timeline, Spotlight-Panel
mit Achsenprofil zum Kaufzeitpunkt. Funktional nichts auszusetzen — der einzige Fund ist der
bereits in Abschnitt 7 genannte fehlende Portrait-Fallback bei „Jump & Slash" in den
Top-Käufen. Sonst: gutes Vorbild dafür, wie viel Erzählung eine reine Zahlen-Seite tragen kann
(„Spotlight" erzählt die Geschichte **eines** Deals statt nur eine Tabellenzeile zu sein) — dieses
Muster lohnt sich für andere datenlastige Seiten (z. B. Saisonstand) als Vorbild.

## 13. Kredite (`app/foundation/finances` / Kredit-Bereich)

**Befund.** Kleine, klare Seite: Gauge für Kreditrahmen-Auslastung, Tilgung-vs.-Cashflow-Balken mit
„Deckungslücke"-Warnung, ein gesperrter Bereich „Kredit-Tresor … AB SEASON 2" mit Schloss-Icon. Die
Schloss-Metapher taucht identisch in der Arena-Vorschau auf („Ergebnis bleibt verdeckt") — ein gutes
Zeichen für ein bestehendes, wiedererkennbares Vokabular, das aber nirgends als **eine**
Komponente geführt wird (siehe Abschnitt 11/15, Bibliothek).

## 14. Merkliste (`app/foundation/merkliste-v2`)

**Befund.** Vorbildlicher Leerzustand: ein Satz, der erklärt, wie man etwas hinzufügt („Der Stern
neben einem Teamnamen … legt einen Eintrag an"), gerahmt in einem gestrichelten Kasten, keine
überflüssige Dekoration. Kein Änderungsbedarf — im Gegenteil: dieses Muster ist die Referenz, an
der die Leerzustände in Abschnitt 5 (Saisonstand) und Abschnitt 8 (Transfermarkt) gemessen werden
sollten.

## 15. Mobile / kleine Bildschirme — der größte Einzelfund dieses Dokuments

**Befund.** Bei 390 px Breite (iPhone-Klasse, frischer Seitenaufruf, kein Resize) bleibt die
**komplette Desktop-Sidebar als aufgeklappte, senkrechte Liste** über dem Inhalt stehen — alle
rund 25 Navigationspunkte (Spielstände, Breite-Schalter, Team-Wahl, Spieltag-Gruppe, Team-Gruppe,
Markt-Gruppe, Office/Settings/Leaders/Sponsoren/Changelog) werden einfach untereinander gerendert,
bevor der eigentliche Seiteninhalt beginnt. Beleg:
`docs/design/fable-uiux-screenshots-14-11/09-mobile-nav-kollabiert-nicht.png` — der Screenshot ist
6982 px hoch, und erst nach knapp 900 px Scrollstrecke beginnt die Home-Kachel „Nunchuck Ninjas".
Es gibt **keinen** Burger-Button, keinen Breakpoint, der die Navigation in ein Drawer/Off-Canvas-Menü
verwandelt — die Sidebar verhält sich auf dem Handy identisch zum Desktop, nur schmaler.

Nebenfund auf derselben Seite: eine der sechs Kaderkarten („Kati") zeigt eine komplett leere,
dunkle Bildfläche statt des Portraits, das dieselbe Karte auf der Desktop-Ansicht (Abschnitt 6)
korrekt zeigt — ein weiterer Beleg für den fehlenden/instabilen Portrait-Fallback aus Abschnitt 7,
diesmal unter mobilen Lade-/Bandbreitenbedingungen.

**Das ist der eine Fund in diesem Dokument, der am ehesten eine Grundsatzentscheidung von Chris
braucht, kein reines Styling:** Soll die Foundation auf dem Handy wirklich die volle
Management-Oberfläche in Mini-Format sein (dann ist die Lösung „nur" ein Drawer-Menü), oder ist
Mobile ohnehin nur als Nebenkanal gedacht (dann ist die Priorität dafür niedriger, als der
Screenshot zunächst suggeriert)? Dieses Dokument nimmt dazu keine Position ein — der Befund steht,
die Einordnung ist Chris' Entscheidung.

**Ideen.**
- Sidebar unterhalb eines Breakpoints (z. B. 900 px) in ein Burger-Icon + Off-Canvas-Drawer
  verwandeln, Inhalt beginnt sofort unter der Kopfzeile.
- Bis dahin, als Zwischenschritt mit sehr kleinem Umfang: die Sidebar auf Mobile **einklappbar**
  machen (nur Icons, aufklappbar bei Tap) statt sie unverändert in voller Textbreite zu rendern.

## 16. Kartenschmiede / Moosgrab

**Bewusst kurz gehalten.** `apps/kartenschmiede/` ist eine eigenständige App mit eigener
CI-Weiche (CLAUDE.md, „CI-Weiche für Moosgrab/Kartenschmiede") und eigenem Ton — ein Karten-/
Kampagnen-Werkzeug, kein Foundation-Teil im engeren Sinn. Diese Sitzung hat sie nicht live
durchgesehen (anderer Stack: statisches HTML/JS, keine Next.js-Route), um das begrenzte
Zeitbudget auf die Foundation-Bereiche aus dem eigentlichen Auftrag zu konzentrieren. Eine eigene
Fable-Runde für Kartenschmiede/Moosgrab wäre ein eigenständiger, sinnvoller nächster Auftrag — hier
nur als offene Empfehlung notiert, nicht ausgeführt.

## 17. Bereichsübergreifende Komponenten-Bibliothek — was jetzt mehrfach separat existiert

Der stärkste Eindruck aus der gesamten Durchsicht: **dieselben drei, vier Muster tauchen in fast
jedem Bereich einzeln erfunden auf**, meist mit kleinen Abweichungen. Eine gemeinsame Bibliothek
würde nicht nur Code sparen, sondern vor allem die App in sich konsistenter wirken lassen:

| Muster | Taucht auf in | Heutige Varianz |
|---|---|---|
| Fallback-Avatar „kein Portrait" | Spieler-Podium, Historie-Spotlight, Scouting-Kreis, mobile Kaderkarte | leerer Ring / „?" / ganz leer — drei verschiedene Lösungen |
| „Noch nicht verfügbar"-Banner | Ewige Tabelle (gut), Saisonstand (fehlt), Teams-Entwicklung, Kredit-Tresor | an vielen Stellen neu formuliert statt eine Komponente |
| Gesperrt-Zustand mit Schloss-Icon | Arena (Ergebnis verdeckt), Kredite (ab Season 2) | zweimal identisch gelöst, aber nicht als eine Komponente geführt |
| Farbe ohne Legende | Kaderkarten-Rand (Teams), Positionsfarben (Einsatzliste — dort bereits geplant) | nirgends erklärt außer in der geplanten Einsatzliste-Rework |
| Leerzustand-Kasten (gestrichelter Rahmen + Erklärsatz) | Merkliste (Vorbild), teils Transfermarkt | inkonsistent, mal Shimmer statt Erklärtext |

**Idee, grundsätzlich:** Eine kleine, gemeinsame „NL-Patterns"-Sammlung (ergänzend zu den schon
bestehenden `Nl*`-Komponenten wie `NlTable`, `NlEmptyState`, `NlGauge`, `NlAbilityStars`) für genau
diese fünf Muster würde jede künftige Welle-3/4-artige Umbaurunde beschleunigen, weil die nächste
Seite sie einbaut statt neu zu erfinden.

---

## 18. Die Vorschlagsliste

Sortiert grob „schnell + risikoarm zuerst". **Umfang:** klein (Stunden), mittel (ein guter Tag),
groß (mehrtägig/eigene Konzeptrunde nötig). **Typ:** Styling/Layout (reine Anzeige, kein neues
Verhalten) oder Komponente/Logik (neue Komponente, neuer Zustand, oder echte Verhaltensänderung).

1. **Home: 6er-Kaderkarten-Grid ohne verwaiste 6. Karte** — Raster auf echte Spaltenzahl des
   Kaderminimums anpassen (z. B. 3×2). *Klein · Styling/Layout.*
2. **MVS „0,0 · #1" vor dem ersten gewerteten Ereignis durch „—" ersetzen** (Home-Kaderkarten) —
   dieselbe Regel, die für PPS schon gilt. *Klein · Logik (Anzeigebedingung, kein neuer Wurf).*
3. **Inbox: drei Dringlichkeitsstufen farblich klarer trennen** (aktuell Rot + zweimal fast
   identisches Orange). *Klein · Styling.*
4. **Trainings-Tabelle: zwei klare Icons für „Vorschlag" vs. „passt bereits"** in der
   Klassen-Vorschlag-Spalte statt Stern/kein-Icon. *Klein · Styling.*
5. **Gebäude: Detailkarte als Inline-Expand statt Overlay über den Nachbarkarten.** *Klein–mittel ·
   Layout.*
6. **Einheitlicher Fallback-Avatar für fehlendes Spieler-Portrait**, an allen vier gefundenen
   Stellen (Podium, Historie-Spotlight, Scouting-Kreis, Kaderkarten) eingesetzt. *Mittel ·
   Komponente (neu, aber rein visuell).*
7. **Transfermarkt: Lade-Skelett nicht gleichzeitig mit „0 sichtbar" zeigen** — entweder laden
   *oder* Empty-State, nie beides. *Mittel · Logik.*
8. **Saisonstand: Platzhalter-Spalten vor Spieltag 1 bündeln/ausblenden**, nach dem Vorbild des
   Banners der Ewigen Tabelle. *Mittel · Logik + Styling.*
9. **Farblegende für den Kaderkarten-Rand** (Teams-Seite) ergänzen — Tooltip oder kurze Zeile.
   *Klein–mittel · Styling + Text.*
10. **Gemeinsame „Gesperrt"-Komponente** (Schloss-Icon + Text) für Arena-Spoilerschutz und
    Kredit-Tresor zusammenführen — heute zweimal unabhängig, aber gleich gelöst. *Mittel ·
    Komponente (Refactor, kein neues Verhalten).*
11. **Gemeinsame „Noch nicht verfügbar"-Banner-Komponente** für Vor-Saison-Zustände (Ewige Tabelle,
    Saisonstand, Teams-Entwicklung, Kredit-Tresor). *Mittel · Komponente.*
12. **Gebäude-Icons als PixelLab-Requisiten** (Fan Shop, Academy, Analytics Room, Arena Upgrade,
    Specialist Wing, Scouting, Trainingszentrum) statt generischer Flat-Icons — laut CLAUDE.md
    ausdrücklich erlaubt, kurze Information an Chris vor der Bestellung reicht. *Mittel · neue
    Assets.*
13. **„Battle Arena" in der Sidebar umbenennen oder sichtbar als Dev-Werkzeug abgrenzen**, damit
    sie nicht wie ein zweiter Kampfbildschirm neben „Arena" wirkt. *Klein–mittel · Styling/Navigation.*
14. **„Spielerprofil wird geladen…"-Hänger** (Abschnitt 7) technisch nachprüfen — kein
    Gestaltungsvorschlag, aber ein Befund, der vor jeder Komponentenarbeit am Spielerprofil geklärt
    gehört. *Unbekannt · Bug-Verdacht, erst verifizieren.*
15. **Mobile: Sidebar ab einem Breakpoint einklappbar machen** (Zwischenschritt: nur Icons, Tap zum
    Aufklappen, noch kein vollständiges Drawer-Pattern). *Mittel · Komponente/Logik.*
16. **Mobile: echtes Burger-Menü + Off-Canvas-Drawer** für die Hauptnavigation — der Inhalt beginnt
    dann sofort unter der Kopfzeile statt nach ~900 px Scrollstrecke. *Groß · neue Komponente +
    Zustand (offen/zu, Fokus-Falle, Escape-Taste, a11y).* Braucht vorher Chris' Grundsatzentscheidung
    (Abschnitt 15), ob Mobile die volle Oberfläche oder einen reduzierten Umfang zeigen soll.
17. **Scouting-Ausbau bauen** (FM27-Ring, Scout-Note 1+ bis 6, unbegrenzte Wunschliste) — bereits
    vollständig spezifiziert in `scouting-ausbau-konzept-11-11.md`, hier nur als nächster
    Umsetzungsschritt vorgezogen. *Groß · Komponente + Logik (schon konzipiert).*
18. **Einsatzliste-Rework fertigstellen** (PR #1358, Mini-Feld, Gold, Gegner-Fäden) — bereits in
    Arbeit, hier nur als Abhängigkeit markiert, kein neuer Vorschlag. *Groß · laufend.*
19. **Echte URLs/Deep-Links für die Foundation-Navigation.** Aktuell ist die gesamte Navigation
    reiner Client-State ohne Routenwechsel (kein `useSearchParams`, kein `router.push` in der
    Shell) — ein Reload springt auf „Home" zurück, „Zurück"-Taste des Browsers tut nichts, kein Tab
    lässt sich direkt verlinken (z. B. in eine In-Game-Bug-Meldung). Größte Einzeländerung dieser
    Liste, architekturnah, aber mit spürbarem Alltagsnutzen (Teilen, Reload-Sicherheit,
    Browser-Navigation). *Groß · Architektur/Logik — eigene Vorab-Prüfung nötig, ob der Next.js-Router
    das sauber ohne Seiten-Reload kann.*

---

**Kurzfassung für den nächsten Schritt:** Punkte 1–9 sind in Summe wohl ein guter Tag Arbeit, ohne
Risiko für Motor oder Rangtreue (alles reine Anzeige). Punkt 15/16 (Mobile) ist der Fund mit dem
größten Überraschungswert — lohnt sich, zuerst Chris' Grundsatzfrage zu klären, bevor daran gebaut
wird. Punkte 17/18 sind keine neuen Ideen, sondern Erinnerungen an bereits getroffene, noch nicht
umgesetzte Entscheidungen.
