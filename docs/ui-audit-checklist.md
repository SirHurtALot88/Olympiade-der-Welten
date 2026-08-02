# UI-Audit-Checkliste (Foundation-Views)

Stand: 2026-08-02. Arbeitsgrundlage fuer einen wiederholbaren Audit-Durchlauf
ueber die Foundation-Views. Der Audit sucht drei Dinge: **Performance**,
**Redundanz**, **UI/UX-Konsistenz**. Er erfindet keine neuen Konventionen —
Massstab sind die bestehenden Repo-Regeln:

- `docs/UI_PRINCIPLES.md` — Farben/Signale, Tabellen, kompakte Oberflaechen
- `docs/ACCESSIBILITY_CONCEPT.md` — Tastatur, Fokus, ARIA
- `components/foundation/new-look/` — geteilte Primitives (NlCard, NlEmptyState,
  NlSkeleton, NlTable, StatChip, `nl-format.ts`-Formatter)
- `components/foundation/EmptyState.tsx`, `FoundationPanelSkeleton.tsx`,
  `FoundationButton.tsx`, `FoundationTableUi.tsx` — aeltere geteilte Bausteine
- `docs/foundation-gameplay-ui-performance-top100.md` und
  `docs/VIEW-SWEEP-2026-07.md` — bereits erhobene Findings mit Status

## Ablauf

1. `npm run audit:ui` ausfuehren. Der Scan schreibt
   `outputs/ui-audit-scan/ui-audit-scan.json` und druckt eine Zusammenfassung.
   Er liefert **Startpunkte**, keine Urteile.
2. Views in Reihenfolge der Scan-Ausgabe "Groesste Views" durchgehen
   (View → Datei-Zuordnung steht im JSON unter `views`).
3. Pro View die Pruefpunkte unten abarbeiten. Jeder Fund braucht:
   Datei + Zeile, erfuelltes Kriterium, Gewicht (P1–P3).
4. Gegen `docs/VIEW-SWEEP-2026-07.md` und
   `docs/foundation-gameplay-ui-performance-top100.md` abgleichen: bereits
   bekannte/erledigte Punkte NICHT neu melden, sondern nur Status vermerken.

Gewichte (wie im View-Sweep): **P1** = kaputt/irrefuehrend fuer den Spieler
oder messbarer Perf-Fresser im Standardpfad. **P2** = deutlich, aber mit
Workaround. **P3** = Konsistenz/Politur.

## A) Performance

### A1. Grosse Listen/Tabellen ohne Memoisierung oder Virtualisierung
- **Was:** `.map(` ueber Team-/Spieler-/Marktzeilen in grossen Komponenten,
  ohne `React.memo` auf der Zeilenkomponente, ohne `useMemo` auf der
  sortierten/gefilterten Liste und ohne `useVirtualizer`.
- **Kriterium:** Liste kann > 32 Zeilen erreichen (32 Teams / ~1000 Spieler)
  UND jede Elternzustandsaenderung rendert alle Zeilen neu (keine memo-Grenze
  dazwischen). Vorbild im Repo: `app/foundation/players-table/FoundationPlayersTableBody.tsx`
  und `app/foundation/legacy-lineup-lab/LegacyLineupVirtualTableBody.tsx`
  (beide `@tanstack/react-virtual`).
- **Gewicht:** P1 bei Spielerlisten (~1000 Eintraege), P2 bei 32-Team-Listen.
- **Scan:** ja — `signals.unmemoizedListRenderers` (Heuristik: >= 8x `.map(`,
  >= 300 LOC, kein memo/useMemo/Virtualizer). Treffer am Code verifizieren.

### A2. Teure Ableitungen im Render-Pfad
- **Was:** Sortieren/Filtern/Aggregieren direkt im Funktionskoerper statt in
  `useMemo` bzw. in den bestehenden Derivation-Hooks
  (`lib/foundation/tabs/use-*-derivations.ts`, `get-season-derivations.ts`).
- **Kriterium:** `.sort(`/`.filter(`/`.reduce(` ueber Save-Daten ausserhalb
  von `useMemo`/Derivation-Hook, in einer Komponente die bei Eingaben
  (Suchfeld, Tab-Wechsel, Hover-State) neu rendert.
- **Gewicht:** P1 wenn pro Tastendruck (Suchfeld), P2 sonst.
- **Scan:** teilweise — `signals.hookHeavyFiles` und `perFile` (Hook-Zaehler)
  zeigen, wo viel State neben viel Rechenarbeit liegt. Der eigentliche Fund
  ist nur von Hand pruefbar.

### A3. Inline-Objekt-/Array-Literale in Props von Listenzeilen
- **Was:** `style={{...}}`, `prop={{...}}`, `prop={[...]}` innerhalb eines
  `.map(`-Callbacks — erzeugt pro Zeile und Render neue Referenzen und hebelt
  memo-Grenzen aus.
- **Kriterium:** Literal liegt im Zeilen-Callback einer Liste aus A1. Inline-
  Literale ausserhalb von Listen sind KEIN Fund.
- **Gewicht:** P2 (nur relevant, wo eine memo-Grenze existiert oder geplant ist).
- **Scan:** teilweise — `signals.inlinePropHotspots` zaehlt `={{`/`={[` pro
  Datei (>= 15). Ob die Treffer in Listenzeilen liegen: von Hand.

### A4. Scroll-/Resize-Handler ohne rAF/Throttle
- **Was:** `addEventListener("scroll"|"resize")` dessen Callback pro Event
  Layout liest oder State setzt, ohne `requestAnimationFrame`/Throttle.
- **Kriterium:** Listener-Datei enthaelt weder rAF noch throttle/debounce.
- **Gewicht:** P2.
- **Scan:** ja — `signals.unthrottledScrollResize` (aktuell:
  `FoundationPlayerPortraitPreview.tsx`, `FoundationTeamPortraitPreview.tsx` —
  zugleich ein Redundanz-Fall, siehe B3).

### A5. "use client" ohne Client-Bedarf / zu grosse Client-Einstiege
- **Was:** Dateien mit `"use client"`-Direktive, die weder Hooks noch
  Event-Handler noch Browser-APIs nutzen (reine Praesentation, Icons,
  Formatter) — sie ziehen sich und ihre Importe unnoetig ins Client-Bundle.
- **Kriterium:** Direktive vorhanden, aber keine der genannten Client-Features
  im Quelltext; Entfernen bricht keinen Import-Pfad (Kind einer Client-Grenze
  braucht die Direktive nicht selbst).
- **Gewicht:** P3 pro Datei, P2 wenn ein grosser Baum betroffen ist.
- **Scan:** ja — `signals.needlessUseClient` (Heuristik, aktuell 57 Dateien;
  jede vor Meldung von Hand bestaetigen). Verbotene *Inhalte* im Client-Bundle
  prueft bereits `npm run ci:client-bundle-lint` — nicht doppeln.

### A6. Daten pro Render/Tab-Besuch neu geholt statt gecacht
- **Was:** Fetches, die beim Tab-Wechsel erneut feuern, obwohl sich der Save
  nicht geaendert hat; Feeds, die fuer inaktive Tabs mitladen.
- **Kriterium:** Network-Log beim Hin- und Herwechseln zweier Tabs zeigt
  identische Requests ohne Save-Aenderung; oder Fetch ohne `active`-Gate im
  Code (Muster: `FoundationDeferredMount`, `FoundationTabActiveHost`).
- **Gewicht:** P1.
- **Scan:** nein — nur von Hand (Dev-Server + Network-Tab). Achtung: viele
  Faelle sind laut `docs/foundation-gameplay-ui-performance-top100.md`
  ("Jetzt Gestartet" 1–14) bereits behoben — Status pruefen statt neu melden.

## B) Redundanz

### B1. Doppelt definierte Formatter/Helper
- **Was:** gleicher Top-Level-Funktionsname in mehreren Dateien — Kandidaten
  fuer kopierte Implementierungen desselben Konzepts.
- **Kriterium:** gleicher Name UND gleiche/fast gleiche Implementierung bzw.
  gleiches Konzept (z.B. Runden, Clamping, Vertragslabels). Gleicher Name mit
  bewusst anderem Verhalten ist kein Fund, aber ein Umbenennungs-Hinweis (P3).
  Geld-/Zahlformatierung gehoert nach `components/foundation/new-look/nl-format.ts`
  (durchgesetzt via `npm run ci:design-tokens` — dort nicht doppeln).
- **Gewicht:** P2 ab 3 Kopien oder bei abweichenden Ergebnissen (z.B. zwei
  `formatContractShapeLabel` mit unterschiedlichen Labels = P1), sonst P3.
- **Scan:** ja — `signals.duplicateFunctionNames` (aktuell 95 Namen; Top:
  `isFiniteNumber` 13x, `roundValue` 13x, `clamp` 8x, `roundViewNumber` 7x,
  `applyStoredColumnOrder` 5x, `formatContractShapeLabel` 4x).

### B2. Parallele V1/V2-Implementierungen und tote Pfade
- **Was:** Legacy-Views (`home`, `season`, `inbox`, `market`, `history`,
  `lineupV2`, `training` … siehe `FOUNDATION_VIEW_IDS` in
  `lib/foundation/foundation-view-routing.ts`), die per Normalisierung ohnehin
  auf V2 umgeleitet werden, deren Code aber noch mitgepflegt/mitgebundelt wird.
- **Kriterium:** View-Id ist ueber keine Navigation und keine
  `normalizeFoundationViewParam`-Eingabe mehr erreichbar, oder Code-Zweig im
  Router-Body ist fuer keine erreichbare Id aktiv. Bestehende Absicherung:
  `tests/foundation-v2-only-ui-contract.test.ts` — was dort schon festgelegt
  ist, nicht neu melden.
- **Gewicht:** P2 (Bundle/Pflegekosten), P3 wenn nur wenige Zeilen.
- **Scan:** teilweise — `views`-Zuordnung + `unclaimedViewDirs` zeigen, welche
  Verzeichnisse existieren; Erreichbarkeit nur von Hand.

### B3. Kopierte Komponenten
- **Was:** fast identische Komponenten unter verschiedenen Pfaden.
- **Kriterium:** > ~70% identische Struktur bei gleicher Aufgabe. Bekanntes
  Beispiel als Startpunkt: `components/foundation/player-portrait-card/FoundationPlayerPortraitPreview.tsx`
  vs. `components/foundation/team-portrait-card/FoundationTeamPortraitPreview.tsx`
  (gleiche Scroll-/Resize-Logik doppelt, siehe A4).
- **Gewicht:** P2.
- **Scan:** teilweise — `duplicateFunctionNames` mit Komponentennamen als
  Einstieg; Struktur-Vergleich von Hand.

### B4. Doppelte Datenabrufe desselben Endpunkts
- **Was:** mehrere Komponenten einer View laden denselben API-Endpunkt
  unabhaengig, statt ueber den gemeinsamen Kontext
  (`lib/foundation/foundation-shared-context.tsx` / Host-Props) zu teilen.
- **Kriterium:** derselbe Endpunkt-Pfad in > 1 Fetch-Aufruf innerhalb einer
  aktiven View-Sitzung (Network-Tab), ohne Cache/Abort-Teilung.
- **Gewicht:** P1 im Standardpfad, P2 in Detail-Panels.
- **Scan:** nein — von Hand (Network-Tab), da Fetch-URLs dynamisch gebaut werden.

## C) UI/UX-Konsistenz

### C1. Ladezustaende: Skeleton statt nacktem Text
- **Was:** Ladezustand als roher Text ("… wird geladen") statt
  `NlSkeleton`/`FoundationPanelSkeleton`.
- **Kriterium:** sichtbarer Ladepfad ohne Skeleton-/Spinner-Komponente.
  Bereits als Finding erhoben fuer `homeV2`, `matchdayArena`, `playerProfile`
  (`docs/VIEW-SWEEP-2026-07.md`) — dort nur Status pruefen.
- **Gewicht:** P3, P2 wenn der Zustand mehrere Sekunden im Standardpfad steht.
- **Scan:** ja — `signals.rawLoadingText` (Dateien + Zeilen mit rohem
  "wird geladen"-Text; aktuell 10 Dateien).

### C2. Empty-States: geteilte Komponente statt Ad-hoc-Text, "0" vs. "—"
- **Was:** leere Zustaende ohne `EmptyState`/`NlEmptyState`; Zahlwert "0" fuer
  "noch nicht gespielt/keine Daten" (nicht unterscheidbar von echter Null).
- **Kriterium:** leere Liste rendert Ad-hoc-`<p>`/nichts; oder Spalte zeigt
  `0`, wo `leagueLeaders` fuer denselben Fall Erklaertext zeigt (Referenzfall
  POW/SPE/MEN in `seasonV2`/`ranks`, View-Sweep P1/P2).
- **Gewicht:** P2 bei irrefuehrender "0", P3 bei reinem Stilbruch.
- **Scan:** nein — von Hand (leerer Zustand muss provoziert werden).

### C3. Farbe als einziges Signal
- **Was:** Status nur ueber Farbe (Chip/Zelle/Punkt) ohne Text oder Icon.
- **Kriterium:** `docs/UI_PRINCIPLES.md` ("Farbige Chips muessen durch
  Text/Icon verstaendlich bleiben"): Element in Graustufen nicht mehr
  unterscheidbar UND kein `title`/`aria-label`/Textinhalt.
- **Gewicht:** P2.
- **Scan:** nein — von Hand. (Hex-Farben ausserhalb der Tokens prueft bereits
  `ci:design-tokens`; das ist eine andere Frage als Semantik.)

### C4. Tastaturbedienbarkeit und ARIA
- **Was:** Abweichungen von `docs/ACCESSIBILITY_CONCEPT.md`.
- **Kriterium:** klickbares `div`/`span` ohne `role`/`tabIndex`; sortierbarer
  Tabellenkopf ohne `aria-sort`; modaler Drawer ohne Focus-Trap/`Escape`;
  fehlender sichtbarer Fokuszustand im Tab-Durchlauf.
- **Gewicht:** P1 wenn eine Kernaktion (Aufstellen, Kaufen, Spieltag starten)
  ohne Maus nicht erreichbar ist, sonst P2.
- **Scan:** nein — von Hand (Tab-Durchlauf pro View gemaess QA-Checkliste im
  Accessibility-Konzept).

### C5. Button-/Chip-/Tab-Muster
- **Was:** Ad-hoc-`<button>`-Styles und Eigenbau-Chips/Tabs statt der
  geteilten Primitives (`FoundationButton`, `StatChip`, `NlSubTabs`,
  `NlDeltaChip`, `secondary-button`/`inline-button`-Klassen).
- **Kriterium:** Element erfuellt dieselbe Rolle wie ein vorhandenes Primitive,
  weicht aber in Klassenaufbau/Markup ab, ohne dass ein View-Sonderfall
  dokumentiert ist.
- **Gewicht:** P3.
- **Scan:** nein — von Hand.

### C6. Fehlerdarstellung
- **Was:** Fetch-/Aktionsfehler als Konsolen-Fehler, stiller Leerzustand oder
  Ad-hoc-Text statt sichtbarer, einheitlicher Fehlermeldung
  (vgl. `WarningList`, Fehler-Chips im Neuen Look).
- **Kriterium:** `catch`-Pfad ohne UI-Folge, oder Fehlertext ohne
  Handlungsoption, wo andere Views Retry/Verweis anbieten.
- **Gewicht:** P1 bei stillem Verschlucken im Standardpfad, sonst P2.
- **Scan:** nein — von Hand.

## Was NICHT geprueft wird (und warum)

| Ausgelassen | Grund |
| --- | --- |
| €-Zeichen, `toLocaleString`/`Intl`, Hex-Farben | Ratchet existiert: `npm run ci:design-tokens` (`scripts/lint-design-tokens.ts` + Baseline) |
| Verbotene Imports im Client-Bundle (sqlite, Persistence) | Gate existiert: `npm run ci:client-bundle-lint` |
| Laufzeit-/Ladezeitmessung pro Tab | Tooling existiert: `npm run perf:foundation-tabs`, `perf:regression-smoke`; Baselines in `docs/tab-performance-baseline-v1.*` |
| Visuelle Screenshot-Pruefung aller Views | Bereits erhoben in `docs/VIEW-SWEEP-2026-07.md`; erst Status der dortigen Findings klaeren |
| Inhaltliche UI-Vertraege (Texte, Pflicht-Elemente je View) | Abgedeckt durch `tests/*-ui-contract.test.ts` (Vitest, `npm test`) |
| Farbtreue der Disziplin-Illustrationen | Bewusste Ausnahme, dokumentiert in `scripts/lint-design-tokens.ts` (`ALLOWED_DIR_PREFIXES`) |
| Gameplay-/Balancing-Logik | Eigene Audit-Skripte (`season:*`, `ai:*`, `player:*`) |

## Scan-Signale im Ueberblick

`npm run audit:ui` → `outputs/ui-audit-scan/ui-audit-scan.json`

| Signal (JSON-Key unter `signals`) | Traegt Pruefpunkt | Charakter |
| --- | --- | --- |
| `biggestFiles`, `views` | Priorisierung | Fakt |
| `hookHeavyFiles` | A2 | Hinweis |
| `unmemoizedListRenderers` | A1 | Heuristik, verifizieren |
| `inlinePropHotspots` | A3 | Heuristik, verifizieren |
| `unthrottledScrollResize` | A4 | Fakt (Datei-Ebene) |
| `needlessUseClient` | A5 | Heuristik, verifizieren |
| `duplicateFunctionNames` | B1, B3 | Fakt (Name), Konzept-Gleichheit von Hand |
| `rawLoadingText` | C1 | Fakt |

Alles ohne Scan-Signal (A6, B2/B4-Erreichbarkeit, C2–C6) ist Handarbeit am
laufenden Dev-Server (`npm run dev`, Aufrufmuster siehe Methodik-Abschnitt in
`docs/VIEW-SWEEP-2026-07.md`).
