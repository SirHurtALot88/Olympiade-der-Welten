# Mehrspieler-Vollausbau — Befund und Plan

**Auftrag (Chris, 15.08.2026):** „ich möchte dass wir endlich eine VOLLE multiplayer funktionalität
herstellen." Vier benannte Ziele:

1. Aufstellungen effizient speichern, auch für mehrere Teams; die Team-Auswahl muss sauber laufen.
2. Ein Spiel hosten und dabei einstellen, wer welche Teams bekommt — und das später ändern können.
3. Als Host die Arena starten, und beide sehen **gleichzeitig dasselbe**.
4. Voller Mehrspieler-Betrieb, nicht Prototyp.

Dieses Dokument ist der Befund plus der Bauplan. Es ist **gemessen, nicht geschätzt**: jede Aussage
trägt eine Fundstelle, und die vier Kernbefunde wurden nach der Aufklärung noch einmal von Hand
nachgeprüft.

---

## Teil 1 — Was schon da ist

Deutlich mehr, als „Prototyp" vermuten ließe. 3.332 Zeilen `lib/room/`, ein eigener Node-Server mit
socket.io, 12 Testdateien mit **74 grünen Tests**.

| Baustein | Zustand | Ort |
|---|---|---|
| Echtzeit-Übertragung | **Trägt.** socket.io am eigenen HTTP-Server, Broadcast bei jeder Zustandsänderung | `server.ts:24`, `lib/socket/server.ts:71-360` |
| Raumcode + Beitritt + Wiederverbinden | **Trägt.** `XXXX-XXXX`, Sitz-Token, Presence-Heilung bei blockierter Event-Loop | `lib/room/room-store.ts:141-361` |
| Serverautoritative Rechte | **Trägt, im Raum.** Team-Besitz entscheidet, nicht die UI-Auswahl | `lib/room/online-room-model.ts:171-212` |
| Team-Zuordnung als Datenmodell | **Trägt.** Echte Personen-Zuordnung, nicht nur „Mensch/KI" | `lib/foundation/team-control-settings.ts:207-265` |
| Host-Zuteilung beim Anlegen | **Trägt.** Chris-Raster + Franky-Raster, je bis 4 Teams | `FoundationTeamSettingsNewLook.tsx:661-778` |
| Ready-Gates + 12-Schritt-Flow mit Spieltagszyklus | **Trägt.** | `lib/room/room-flow-controller.ts` |
| Arena-Gleichlauf | **Gebaut, aber wirkungslos** — siehe B3 | `lib/room/arena-sync-state.ts` |

Der Kern ist gut gedacht. Was fehlt, sind keine fehlenden Bausteine, sondern **fünf Löcher in
tragenden Teilen**.

---

## Teil 2 — Die fünf Befunde

### B1 — Räume leben nur im Arbeitsspeicher. Jeder Deploy beendet jedes laufende Spiel.

```
lib/room/room-store.ts:53
const runtimeRooms = (globalThis.__olyRuntimeRooms ??= new Map<string, RuntimeRoom>());
```

Keine Tabelle, kein Prisma-Modell (`prisma/schema.prisma`: null Treffer auf `room|seat`), kein
Rehydrieren beim Start. `lib/room/live-room-save-registry.ts:9-11` sagt es selbst: *„Rooms live purely
in-memory … and are never persisted to SQLite."*

**Schlimmer als „Raum weg" ist die stille Degradierung.** Ohne gefundenen Raum fällt der
Schreib-Wächter auf den Einzelspieler-Pfad zurück (`server-authoritative-write-guard.ts:149-161`):
beide Browser schreiben weiter in denselben Spielstand, niemand sendet mehr etwas, die Stände laufen
unbemerkt auseinander. Als Risiko R3 in `docs/design/coop-absicherung.md:174-183` bekannt und dort
**bewusst zurückgestellt**.

Das ist dasselbe Muster wie beim Portrait-Cache und den Bug-Meldungen: etwas Wichtiges liegt im
Container, und der Auto-Deploy baut den bei jedem Push neu. Nur ist die Folge hier nicht Wartezeit,
sondern ein abgebrochenes Spiel mit divergierenden Ständen.

### B2 — Die Besitzprüfung außerhalb des Raums ist eine Tautologie.

`authorizeLocalSingleplayerTeamWrite` prüft `getTeamOwner(settings) === activeOwnerId`
(`server-authoritative-write-guard.ts:113-121`) — und `activeOwnerId` kommt **aus dem Request-Body**.
Der Client setzt dort nicht die eigene Identität, sondern die Owner-ID des **Zielteams**
(`use-foundation-shell-router-body-scope.tsx:1352-1368`). Der Vergleich ist damit für jedes
`manual`-Team immer wahr.

Praktisch: Chris kann Frankys Teams bespielen und umgekehrt. Betrifft alle 24 `withRoomBody(...)`-
Aufrufe. **Genau eine** Route holt die Identität serverseitig aus der Sitzung
(`app/api/lineups/legacy/lab-context/route.ts:86-91`); alle anderen vertrauen dem Body.

### B3 — Der Arena-Gleichlauf überträgt eine Zahl, die sich nie bewegt.

Beide Aufrufstellen senden die Zählgrenze hart als Null:

```
DisciplineStageArena.tsx:1188   maxSlotRevealCountByDiscipline: { d1: 0, d2: 0 }
DisciplineStageArena.tsx:1200   onHostAdvanced: () => …emitHostRoomArenaAdvance({ d1: 0, d2: 0 })
```

Die Folge ist zwingend und von Hand nachgeprüft:
`revealedSlotCount < maxSlotRevealCount` ⇒ `0 < 0` ⇒ nie wahr (`matchday-arena-reveal-sync.ts:139`) ⇒
`slotRevealIndex = 0` für immer (`arena-sync-state.ts:60`) ⇒ beim Gast ist
`roomSync.syncedRound > round` nie wahr (`DisciplineStageNativeArena.tsx:2853`).

**Der Gast steht dauerhaft vor Etappe 1**, während beim Host die ganze Disziplin durchläuft. Nicht
„leicht versetzt" — gar nicht. Das ist der Fehler, den `.github/workflows/ci.yml:75-91` beschreibt und
als *„Root Cause nicht abschliessend lokalisiert"* führt; deshalb ist der Zwei-Browser-Test seit dem
11.07.2026 aus dem CI-Tor genommen.

Warum ihn kein Test fing: die Smoke-Skripte senden `{ d1: 2, d2: 2 }`
(`scripts/smoke-coop-sync.ts:212`), also nie die Werte, die der echte Client sendet.

### B4 — Auch mit richtiger Zahl gäbe es keinen gemeinsamen Moment.

Der Ablauf existiert ausschließlich als `setTimeout`-Kaskade im Browser
(`DisciplineStageNativeArena.tsx:2587-2795`, `TRACK_ROUND_MS = 10000`). Es gibt keine Funktion
`Zustand(Schritt, verstricheneZeit)`, aus der ein zweiter Browser denselben Augenblick herstellen
könnte. Der Raum-Zustand kennt weder einen Startzeitpunkt eines Schritts noch dessen Dauer
(`types/game.ts:103-120` hat nur `updatedAt`).

Dazu kommt: der Host meldet **nachträglich**, was bei ihm schon passiert ist
(`NativeArena:2866-2867`). Und lokale Eingriffe — Hover-Pause, Leertaste, Zeitlupe, Quick-Sim, Reset,
`prefers-reduced-motion` (alle Timer auf 0 ms, `:1584`) — sind nirgends synchronisiert.

Ohne gemeinsame Zeitbasis ist das Ergebnis bestenfalls „gleiche Reihenfolge, anderer Moment".

### B5 — Mehrere eigene Teams: die Rechte stimmen, der Weg ist mühsam.

Die Berechtigung ist sauber pro Team modelliert und trägt beliebig viele eigene Teams. Nur der
Arbeitsweg ist teuer:

- **Kein Sammel-Speichern für Menschen.** `saveLocalLegacyLineupDraftBatch` existiert und schreibt n
  Teams in **einem** Schreibvorgang (`legacy-lineup-local-service.ts:1455-1576`) — benutzt wird sie
  nur vom KI-Stapellauf und einem Messskript. Der menschliche Weg nimmt die Einzelvariante.
- **Pro Team: ein Bestätigungsdialog und 4–5 Anfragen** (`route.ts:133-143` erzwingt einen zweiten
  PUT mit `confirmLock`), dazu ein voller Spielstand-Schreibvorgang von **~1,2 s** (gemessen in
  PR #526). Bei vier eigenen Teams: vier Dialoge, ~16–20 Anfragen.
- **Der geteilte Kontext-Cache wird durch jedes Speichern global entwertet**: sein Schlüssel enthält
  eine Signatur über **alle** Entwürfe (`:222-225`). Wer vier Teams nacheinander speichert, zahlt
  viermal den vollen Kontextaufbau.
- **Keine Sammel-Ansicht „meine Teams: fertig/offen".** Die Daten liegen alle vor
  (`evaluateMatchdayHumanReadiness` liefert `pendingTeamIds`), werden aber nur als Arena-Sperre im
  Modus `online_4v4` ausgewertet und **nirgends angezeigt**.
- **Die UI erlaubt mehr als der Server.** `canManageTeamId` akzeptiert zusätzlich
  `displayLabel === "Chris"` (`use-foundation-shell-router-body-scope.tsx:6635-6653`), der Server
  verlangt exakte Owner-Gleichheit ⇒ latenter 403 nach dem Klick, sobald zwei Menschen im Spiel sind.

### Nebenbefunde, die mitlaufen

| | |
|---|---|
| **Beitritt löscht die Zuteilung des Hosts** | `joinRoom` überschreibt die Team-Verteilung bedingungslos mit `chris_4_franky_4_rest_ai` (`room-store.ts:218`). Wer vorher handverlesen hat, verliert es. |
| **Kein Einladungslink** | `/room/CODE` funktioniert nur für den, der schon über die Startseite beigetreten ist (`RoomPageClient.tsx:75`). Kopiert wird nur der Code. |
| **Kein Raumende, kein Aufräumen** | Kein `leaveRoom`, kein `delete` — die Map wächst bis zum Prozessende. Status `"completed"` wird nirgends gesetzt. |
| **294 Zeilen tote Parallel-API** | `app/api/room/route.ts` wird von niemandem aufgerufen — und reicht, anders als der Socket-Weg, **keine Sitzung durch**. Bei aktivem Login wäre das ein Identitäts-Umweg. |
| **„Franky" per Namens-Regex** | `/franky/i.test(displayName)` an vier Stellen, obwohl die echte `ownerId` bereits in `participant.userId` liegt. |
| **Toter Brettspiel-Rest** | `tokens`, `board`, `activeRole`, `turnNumber` werden bei **jedem** Broadcast mitgeschickt; die Handler `moveToken`/`endTurn` ruft kein Client. |
| **Doku verspricht, was der Code nicht hält** | `SPIELBAR-STATUS.md:15` führt „MP E2E in CI 🟢" — der Schritt ist auskommentiert, und der Test deckt genau B3 auf. |

---

## Teil 3 — Der Plan

Fünf Stufen. Die Reihenfolge ist nicht beliebig: **Stufe 0 muss zuerst**, sonst baut alles Weitere
auf einer Map, die der nächste Deploy leert.

### Stufe 0 — Fundament (ohne das ist alles andere Sandburg)

| Paket | Inhalt | Prüfung |
|---|---|---|
| **0.1** | Räume, Sitze, Teilnehmer nach SQLite; Rehydrieren beim Serverstart. Neue Tabellen, kein Umbau des Zustandsmodells — `RuntimeRoom` bleibt, bekommt nur eine Ablage. | Test: Raum anlegen → Store leeren (Neustart simulieren) → Raum ist wieder da, Sitz-Token gilt weiter |
| **0.2** | Die stille Degradierung schließen: ein raumgebundener Spielstand darf **nie** auf den Einzelspieler-Pfad zurückfallen. Der Baustein existiert (`assert-save-not-room-bound.ts`), er hängt nur nicht im Wächter. | Test: Raum weg + raumgebundener Save ⇒ Schreibvorgang wird abgelehnt, nicht durchgereicht |
| **0.3** | Identität serverseitig bestimmen: Sitz-Token im Raum, Sitzung außerhalb — **nie** aus dem Body. `activeOwnerId` aus dem Body wird ignoriert. | Test: gefälschte `activeOwnerId` auf fremdes Team ⇒ 403 |
| **0.4** | Raumende und Aufräumen: `leaveRoom`, `closeRoom`, Status `completed`, Verfall alter Räume. | Test: Raum schließen ⇒ aus Ablage und Map raus, Code wieder frei |

### Stufe 1 — Hosten und Team-Zuordnung

| Paket | Inhalt |
|---|---|
| **1.1** | Einladungslink: `/room/CODE` nimmt neue Gäste auf (Name eintragen → Sitz). Der Link ist die Einladung. |
| **1.2** | `joinRoom` überschreibt die Host-Zuteilung nicht mehr. |
| **1.3** | Zuordnung **später änderbar**: in der Lobby frei, im laufenden Spiel zwischen den Spieltagen, nur durch den Host, mit Postfach-Eintrag als Beleg. Sperre während eines laufenden Spieltags. |
| **1.4** | „Franky" über `ownerId` statt Namens-Regex. Die vier Regex-Stellen fallen weg. |
| **1.5** | Tote Parallel-API `app/api/room/route.ts` löschen, dazu `moveToken`/`endTurn` und die Brettspiel-Felder. |

### Stufe 2 — Aufstellungen für mehrere Teams

| Paket | Inhalt |
|---|---|
| **2.1** | Sammel-Speichern für Menschen: die vorhandene Batch-Funktion um `lockMatchday`, Formkarten-Sicherstellung, Apron-Einfrierung und **Besitzprüfung je Team** ergänzen; Alles-oder-nichts durch „pro Team melden" ersetzen. Eine Route, ein Schreibvorgang für n Teams. |
| **2.2** | Sammel-Ansicht „meine Teams · Spieltag X · fertig/offen" mit Direktsprung. Datenquelle: `evaluateMatchdayHumanReadiness`, die es schon gibt. |
| **2.3** | Kontext-Cache je Team schlüsseln statt über alle Entwürfe — behebt den n-fachen Kaltaufbau. |
| **2.4** | Client-Erlaubnis auf die Server-Regel ziehen (`canManageTeamId` = `canOwnerManageTeam`), damit kein 403 nach dem Klick kommt. |
| **2.5** | Den doppelten PUT abschaffen: Sperr-Bestätigung im ersten Aufruf mitgeben. |

### Stufe 3 — Arena-Gleichlauf

| Paket | Inhalt |
|---|---|
| **3.1** | **Die echte Etappenzahl senden** statt `{d1:0, d2:0}`. Der eine Befund, der den Gast überhaupt in Bewegung bringt. |
| **3.2** | Ein gemeinsamer Schrittbegriff. Heute zählt der Client Etappen, der Server führt eine Phasenkette — zwei Modelle für dieselbe Sache. |
| **3.3** | Gemeinsame Zeitbasis: `stepStartedAt` (Serverzeit) + `stepDurationMs` im Raum-Zustand, Uhren-Versatz je Client aus dem Socket-Ping. |
| **3.4** | Anzeige als Funktion von (Schritt, verstrichene Zeit) statt Timer-Kette; Nachholen durch Überspringen statt Nachspielen. Damit ist auch ein später beitretender Gast sofort im Bild. |
| **3.5** | Host-Vorbehalt beim Buchen des Ergebnisses (`commitFinishedDiscipline` hat heute keinen). |
| **3.6** | Pause, Zeitlupe, Quick-Sim, Reset in den Raum heben. |

### Stufe 4 — Absicherung

| Paket | Inhalt |
|---|---|
| **4.1** | Zwei-Browser-E2E zurück ins CI-Tor. Er ist gebaut, repariert und stillgelegt — er ist die einzige Prüfung, die B3 fängt. |
| **4.2** | Tests, die die **echten** Client-Werte fahren, nicht erfundene. |
| **4.3** | Neustart-Test: Server neu starten mitten im Spiel, beide verbinden sich wieder, der Stand hält. |
| **4.4** | Doku begradigen: `SPIELBAR-STATUS.md` sagt heute „🟢" zu einem Test, der nicht läuft. |

---

## Arbeitsregeln für dieses Projekt

1. **Jede Stufe wird gemessen, nicht behauptet.** Vor jedem Paket: der Fehler wird reproduziert.
   Nach jedem Paket: Gegenprobe, dass der Test ohne die Änderung umfällt.
2. **Ein Paket, ein Commit, ein grünes Tor.** `npm run ci:flow-smoke`, `npx tsc --noEmit` gefiltert
   auf `^lib/|^app/|^components/`, plus die betroffenen Suiten.
3. **Keine zweite Quelle.** Wo eine Größe schon existiert, wird sie benutzt, nicht nachgebaut.
4. **Bei 0 wird erklärt, nicht versteckt.**
5. Tests halten die **Eigenschaft** fest, nicht die Umsetzung.

---

## Entscheidungen, die ich selbst getroffen habe

Chris ist kein Programmierer und will nicht mit Rückfragen aufgehalten werden. Diese vier Punkte
waren offen; ich entscheide sie hier, damit sie nachlesbar und umkehrbar sind.

| Frage | Entscheidung | Begründung |
|---|---|---|
| Was tut die Arena, wenn der Mitspieler die Verbindung verliert? | Der Host darf weiter — mit sichtbarem Hinweis „Franky ist getrennt". Das Bereit-Tor blockiert nur, solange der andere **verbunden und noch nicht bereit** ist. | Eine abgerissene Leitung darf ein Spiel nie einfrieren. Wer wieder da ist, springt über die gemeinsame Zeitbasis (Stufe 3.3/3.4) sofort an die richtige Stelle. |
| Team-Zuordnung mitten in der Saison ändern? | Ja, aber nur **zwischen** Spieltagen und nur durch den Host, mit Postfach-Eintrag. Während eines laufenden Spieltags gesperrt. | Chris hat „später wechseln" ausdrücklich verlangt. Mitten im Spieltag umzuhängen, während eine Aufstellung halb gespeichert ist, erzeugt genau die Zustände, die man hinterher nicht mehr auseinanderrechnet. |
| Wie viele Teams je Person? | Bleibt bei 4, aber als **eine** Konstante statt wie heute doppelt (`online-room-model.ts:264` und `RoomPageClient.tsx:14`). Höhersetzen ist dann eine Zeile. | Kein Grund, das Limit jetzt zu ändern; sehr wohl einer, es nicht an zwei Stellen zu pflegen. |
| Muss der Login an sein, damit Besitz greift? | Nein. Identität kommt **im Raum aus dem Sitz-Token**, außerhalb aus der Sitzung — nie aus dem Body. | Erzwungener Login wäre eine Hürde für zwei Leute, die zusammen spielen wollen. Das Sitz-Token identifiziert im Raum bereits eindeutig; das Loch in B2 ist der Body, nicht der fehlende Login. |
