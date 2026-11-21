# Draft: Tempo "nur rechnen", Abbruch, Startwahl-Dialog (21.11.)

Auftrag von Chris (19./20.11.). Branch `claude/draft-ki-tempo-19-11`, aufbauend auf `docs/design/draft-ki-tempo-19-11.md`.

## 1. Tempo

**Umbau.** "Vor zu meinem Pick", Ueberspringen A und "Selbst kaufen" rechnen alle KI-Picks bis zum Menschen in EINEM
Server-Happen mit EINEM Schreiben des Spielstands (`LIGA_DRAFT_VOR_JE_HAPPEN = 1000`, Sicherung
`LIGA_DRAFT_VOR_HAPPEN_BUDGET_MS = 8000`). Die Seite zeigt waehrenddessen nur "KI rechnet ..." (`data-testid="draft-rechnet"`)
und danach den fertigen Stand. "Selbst kaufen" ueber die Route nutzt denselben Weg (vorher: 120-ms-Happen, je Pick ein Schreiben).

**Weitere Einsparungen im Rechnen (Pick-Folge unveraendert):** Brackets sortieren die Preise einmal statt je Bracket;
Theme-Tags je Spieler aus dem Inhalts-Cache (auch im Zaehler "Themen-Pool"); Tag-Mengen und Trefferzahlen je Tag-Zeile gemerkt;
der Themen-Pool-Zaehler haengt an der Spielerliste statt am Spielstand-Objekt (Zaehler vorher ~290 ms, nachher ~40 ms je 31 Picks).

**Messung** (`scripts/miss-draft-ki-tempo.ts --db=... --save=... --ein-happen --nur-folge [--warm]`, 32 Teams, Mensch letzter
in Runde 1, derselbe vorbereitete Stand, 4 Kerne):

| Stand | 31 Picks |
|---|---|
| Vorgaenger (1-s-Happen, ~3 Schreiben) | 3,03 s |
| Ein Happen, vor den Rechen-Caches | 2,18 s (Rechnen 1,42 s, Schreiben 0,86 s) |
| Ein Happen, mit Caches, Maschine ruhig (Last ~2-4) | 1,79 bis 2,15 s, kalt 1,99 bis 2,17 s |
| dito, Maschine ueberlastet (Last 10-13, andere Agenten) | 3,1 bis 6,5 s (nicht aussagekraeftig) |

Je Pick rund 37 ms Rechnen (der erste kalt 340 ms: Tag-Cache fuellt sich), dazu einmal ~0,6 bis 0,8 s Schreiben des Spielstands.
**Ehrlich:** die 2-s-Marke wird auf ruhiger Maschine knapp gehalten (1,8 bis 2,1 s), nicht mit Reserve; auf einem
Produktionsserver mit warmem Cache (zweiter Klick) liegt sie darunter. Der Rest ist das Schreiben des ganzen Spielstands
(Baseline-Checksummen, Sitzungs-Cache-Groesse) — eine Aenderung an der gemeinsamen Persistenzschicht wurde bewusst nicht gewagt.

**Pick-Folge:** Hash `76774f6ef662` auf dem vorbereiteten Stand fuer Standard-Happen (120 ms), Vorgaenger-Vor-Lauf und den neuen
Ein-Happen-Lauf identisch (31 Picks). Wertungs-Fingerabdruck der Arena: `GESAMT eaafed96150e`, identisch zu `origin/main`
(die Aenderung beruehrt die Arena nicht).

## 2. Abbruch

**Ursache.** `POST /api/draft` mit `abbrechen` pruefte `erwarteteNr` (Stand, den die Seite gesehen hat) streng. Waehrend die KI im
Hintergrund pickt (Vor-Lauf, Ueberspringen A, Selbst kaufen), ist dieser Stand beim Klick immer ueberholt: die Route antwortete
`409 draft_stand_veraltet`, die Seite verschluckt Stand-Konflikte still (`istStandKonflikt`), der Dialog schloss — es geschah nichts.
Ueberspringen, Auto-Pick und "fertig" waren am 19.11. schon standunabhaengig gemacht worden (Abnahme F2), der Abbruch nicht.
Reproduziert im Test (ohne Fix: `expected 409 to be 200`).

**Fix.** Der Abbruch ist standunabhaengig (Route reicht kein `erwarteteNr` an den Dienst, verlangt es auch nicht mehr);
ein laufender Hintergrundlauf bekommt zusaetzlich das Abbruchzeichen. Geprueft: Abbruch mit veraltetem Stand, ohne Stand, waehrend
des Hintergrundlaufs, aus Startwahl offen, nach "Draft spielen", nach Ueberspringen B, im Nachzug (A / Selbst kaufen); danach
kauft der Mensch jeweils im Transfermarkt (`executeLocalTransfermarktBuy`). Ueberspringen A/B, "Ich bin fertig" und Nachzug
waren nicht kaputt (Test bestaetigt). Im Browser (1920x1080) nachgespielt: Startwahl -> Draft spielen -> Vor -> Abbrechen -> Draft `fertig`.

## 3. Startwahl

Chris sah die Wahl nicht, weil das Office nur das schmale Banner (`DraftHinweis`) zeigte. Jetzt legt sich, solange
`startWahl === "offen"`, ein modaler Dialog ueber die ganze App (`StartWahlDialog`): beide Wege kurz erklaert, zwei grosse Knoepfe,
dazu "Erst das Office ansehen" (blendet ihn bis zum Neuladen aus; das Banner bleibt). "Selbst kaufen" startet den KI-Lauf sofort im
Hintergrund (Route `startwahl`, ein Happen); das Banner meldet "Die KI rechnet gerade ..." und fragt dann alle 0,7 s nach.

## Tests
`tests/liga-draft-abbruch-tempo.test.ts` (10), angepasst: `liga-draft-api.test.ts`, `liga-draft-ki-tempo.test.ts`.

## Screenshots
`docs/design/draft-tempo-abbruch-21-11/`: 01 Startwahl-Dialog im Office, 02 Draft-Seite nach Wahl, 03 "KI rechnet", 04 nach dem Vor-Lauf,
05 Abbruch-Dialog, 06 nach dem Abbruch. (Der Hinweis "Save-Sync fehlgeschlagen" und der JSON-Fehler im Brett stammen vom
Wegwerf-Dev-Server der Sandbox, nicht von dieser Aenderung.)
