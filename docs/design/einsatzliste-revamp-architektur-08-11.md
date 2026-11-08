# Einsatzliste-Revamp: Architektur und Umsetzungsplan (08.11.)

Grundlage ist Fables Konzept `docs/design/aufstellung-screen-rework-08-11.md` (Branch
`claude/aufstellung-screen-rework-0811`, PR #1356), vor allem Abschnitt 0b. Dort ist festgelegt,
dass das Ziel die **echte Foundation-Einsatzliste** ist (`app/foundation/legacy-lineup-lab/LineupNewLook.tsx`)
und nicht nur das Arena-Board im Mockup. Dieses Dokument prüft, was die Foundation-Seite dafür
schon hat. Es legt eine erweiterbare Formations-Datenquelle fest, übersetzt Fables Pakete auf
`LineupNewLook.tsx` und arbeitet Chris’ Antworten auf die fünf Fragen aus Abschnitt 13 ein
(Abschnitt 4). Dazu gehört auch die Prüfung, ob die Gegner-Daten zur Aufstellungszeit vorliegen
(4a). Paket F1 ist im selben PR schon gebaut (Abschnitt 6).

Alle Zeilennummern gelten für `main` @ `ecc12ccb6`. Wo „neu“ steht, ist der Stand nach diesem PR
gemeint. Nach jedem Merge verschieben sie sich, also per `grep` suchen.

Verbindlich bleibt: **alles hier ist Anzeige.** Die Eignungsmatrix ist gesperrt (CLAUDE.md). Kein
Paket F1–F4 berührt Resolve, Slot-Profile oder Motor. Wo ein Paket eine gemeinsame Rechenfunktion
braucht (F2), wird sie neben die bestehende gestellt und per Identitätstest abgesichert. Die
bestehende Rechnung wird dabei nicht umgebaut.

---

## 1. Befund mit Belegen

### 1.1 `LineupNewLook.tsx`: was da ist

- **Umfang:** 2936 Zeilen (neu 3068). Es ist eine reine Darstellungskomponente: Die Props sind ein
  `Pick<LegacyLineupFocusV2BoardProps, …>` (Z. 103–229), alle Handlungen laufen über Handler des
  Clients (`onAssignPlayer`, `onClearSlot`, `onSaveDraft` …, Kopfkommentar Z. 33–48). Die
  Komponente rechnet keine Spiellogik.
- **Slot-Raster:** `renderSide(d1|d2)` (Z. 1544) rendert je Seite ein `nl-lineup-slot-grid`
  (Z. 1996). Die Reihenfolge ist `slots.filter(side)`, also nach `slotIndex`. Das ist eine
  Kartenliste ohne jede Geometrie.
- **Rollenlabel:** Z. 2077, `<span className="nl-lineup-slot-role">{role?.label ?? "Slot"}</span>`.
  Mehr wird von der Rolle nicht gezeigt. Dazu kommt Z. 2574 im Fokus-Kopf, wieder nur `label`.
- **Was die Rolle mitbringt, aber ungenutzt bleibt:** `slotRoleByKey: Map<string,
  MatchdaySlotRoleDefinition | null>` (Board-Props Z. 169, gebaut in `LegacyLineupLabClient.tsx`
  Z. 2008–2036 aus `resolveSlotRolesForDiscipline`). Jede Definition trägt `slotWeightProfile`,
  `baseWeightProfile`, `keyAttributes`, `description`, `majorPositive/minorPositive/strainAttribute`
  (`matchday-slot-roles.ts` Z. 25–39). Für das ±-Schema (F2) ist also alles schon im Prop
  vorhanden, nur nicht angezeigt.
- **Spieler gegen jeden Slot:** `playerBestSlotSummaryByActivePlayerId` hält je Spieler eine
  **vollständige** Rangliste über alle Slots beider Seiten mit `projectedScore` und `projectedDelta`
  (`lineup-candidate-model.ts` Z. 853–910). Die Kader-Liste zeigte davon bisher nur den ersten
  Eintrag („Bester Slot D1-3 · 72,4“, alt Z. 2866–2871). Fables „Top-3 mit Zahl“ (Backlog 6.1)
  braucht deshalb keine neue Rechnung.
- **Disziplin-Eignung je Spieler:** `LineupBoardRosterCard.discipline1Score/discipline2Score`
  (`legacy-lineup-board-props.ts` Z. 25–41). Das ist die Grundlage für den Gold-Rahmen.
- **Attributwerte:** Im Board-Typ `LineupBoardRosterCard` fehlen sie. Zur Laufzeit liegen sie aber
  schon in denselben Map-Werten, denn der Client übergibt `MatchdayRosterCard`, und
  `LineupPlayerTableRow` trägt `attributeStats` (`lineup-candidate-model.ts` Z. 45 ff.,
  gelesen in Z. 874). Für F2 reicht ein optionales Feld im Board-Typ, ohne Datenumbau.

### 1.2 Kennt die Foundation-Seite die Formationsgeometrie? **Nein, überhaupt nicht.**

Gesucht in `lib/`, `app/`, `components/`, `scripts/`, `public/`:

| Größe (Fables Quelle) | Fundort | Foundation/TS? |
|---|---|---|
| `SLOT_ZUSATZ` (reihe/ord/pos) | `battle-mode.engine.js` Z. 8201 | nein; nur zwei Messskripte lesen es als Text (`scripts/lib/aufstellungs-stufungen.ts`, `scripts/miss-preis-der-aufstellung.ts`) |
| `ROWS` (Front/Mitte/Backrow) | ebd. Z. 8336 | nein |
| `BASKETBALL_ROLLE_SLOT` | ebd. Z. 10855 | nein |
| `TORWART_SLOTS` / `QB_SLOTS` / `KICKER_SLOTS` | ebd. Z. 12144 / 12488 / 12678 | nein; `matchday-slot-roles.ts` nennt `KICKER_SLOTS` nur im Kommentar (Z. 290) |
| `HEBEN_ROLLEN` | ebd. Z. 20904 | nein |
| `planJeSlot` (Spurt/Time-Trial/Climbing/Staffel/Takeshi) | ebd. Z. 44756, 45031, 45375, 45519, 45862 | nein |
| `BF_ORT_NAMEN`, `BFFFA_ROLLEN_ORT` | ebd. Z. 55534, 55539 | nein |

**Folge:** Eine gemeinsame Datenquelle muss **extrahiert** werden. Die Foundation-Seite hat heute
nur die Reihenfolge der Slots (`slotIndex`) und die Rollenprofile, aber keinen einzigen Platz.

### 1.3 Zwei Fallen, die die Architektur bestimmen

**a) Slot-Index ist nicht Feldposition und auch nicht Motor-Reihenfolge.** Die Foundation zählt
Slots in der Reihenfolge von `DISCIPLINE_ROLE_THEMES`. Bei TDM ist das Vanguard, Skirmisher,
Shotcaller, Hold Line, Rally Point, Breaker (`matchday-slot-roles.ts` Z. 97–104). Der Motor
sortiert dieselben Rollen für TDM, Spurt und Battlefield per `slotsVon(d)` nach `SLOT_ZUSATZ.pos`
um (Engine Z. 8244). Daraus ergibt sich Vanguard, Hold Line, Breaker, Skirmisher, Shotcaller,
Rally Point. Battlefield setzt je Kadergröße zusätzlich eine eigene Zusammensetzung ein
(`ROLE_THEME_IDS_BY_SLOT_COUNT`, Z. 343). **Geometrie muss deshalb über die kurze Rollenkennung
geschlüsselt werden und nie über den Index.** Diese Kennung liefert
`resolveSlotRoleShortId(disciplineId, null, slotIndex, slotCount)`, dieselbe Funktion, mit der
der Arena-Adapter `place` füllt (`arena-aufstellung-adapter.ts` Z. 137–143). So steht die Marke
auf dem Mini-Feld garantiert für dieselbe Rolle, die die Arena bekommt.

**b) Der Slot-Aufschlag ist nicht überall dieselbe Formel.** `slotAufschlag()` im Motor (Z. 8286)
multipliziert für Football mit `FOOTBALL_SLOT_AUFSCHLAG_SKALA = 0,35` (Z. 8282). Die
Foundation-Rechnung `resolveProfileRoleModifier` (`matchday-slot-roles.ts` Z. 846–856, Grundlage
von Projektion und Resolve) kennt diesen Faktor nicht. Für die Beitrags-Zerlegung in F2 heißt das:
**In der Einsatzliste wird gegen die TS-Formel zerlegt**, denn die zeigt die Einsatzliste und die
rechnet der Spieltag. Fables Summen-Invariante (Konzept 6.3) gilt dann gegen
`resolveProfileRoleModifier` vor der Klemmung. Die Abweichung selbst ist ein Befund für die
Football-Leute, kein Teil dieses Reworks. **Offen, nicht angefasst.**

Kleiner Nachtrag zu Konzept 6.1: `resolveKeyAttributes` (Z. 718–747) zeigt nur positive
Slot-Attribute und kappt nach vier Einträgen. „primary/secondary“ hängt dort zusätzlich am
Fokus-Index, nicht nur an Δ ≥ 3 bzw. Δ ≥ 1. Für die ±-Glyphen deshalb **direkt**
`slotWeightProfile − baseWeightProfile` je Attribut nehmen (beides liegt auf der Rollendefinition)
und nicht `keyAttributes`. Sonst fehlen genau die `−`/`−−`, die Fable zeigen will.

### 1.4 Vorbild für die Datenrichtung: TS ist Quelle, der Motor bekommt generiert

`scripts/generiere-arena-daten.ts` schreibt `BASIS_JE_DISC`, `SLOTS_JE_DISC` und
`BATTLEFIELD_SLOTS_JE_K` aus `matchday-slot-roles.ts` zwischen Markern in `battle-mode.engine.js`
(Z. 257–272 im Skript). Die Rollenprofile haben also schon heute **eine** Quelle in TS. Die
Formations-Datenquelle soll denselben Weg gehen (Abschnitt 2.4).

---

## 2. Formations-Datenquelle: so geschnitten, dass neue Formate nur Daten brauchen

### 2.1 Anforderungen

1. Alle 20 heutigen Disziplinen haben eine Feldform (Fables Tabelle 3.1).
2. **Format-Varianten derselben Disziplin** können eine eigene Geometrie haben. Das ist kein
   Gedankenspiel: Gewichtheben hat schon ein Hantel-Duell (Reihenfolge-Leiste, n gegen n) und ein
   Sandsack-Rennen (Stationen, Engine `SANDSACK_SZENE`; `lib/foundation/discipline-scenes.ts`
   Z. 184–189). Mit „Die Grube“ (`docs/design/format-varianten-brainstorm-08-11.md` Abschnitt 2)
   käme ein drittes Format dazu. Chris’ Tauziehen-Bild „die Slots stehen hintereinander“ ist ein
   weiteres Feld für dieselbe Disziplin. **Der Schlüssel ist deshalb (Disziplin, Variante), nicht
   nur die Disziplin.**
3. Jede Marke sagt, **wie verbindlich** ihr Platz ist. Fable unterscheidet drei Fälle: Der Motor
   hält den Platz (gefüllte Marke). Der Platz ist nur der Start (Domination, Marke mit
   Rotationspfeil). Der Platz ist reine Darstellung (Hockey/Football ohne Torwart/QB/Kicker, hohle
   Marke).
4. Eine unbekannte Disziplin oder Variante **bricht nie**, sondern fällt auf eine generische
   Reihenfolge-Leiste zurück.

### 2.2 Datentyp (Skizze, Ort `lib/lineups/formation/`)

```ts
/** Wie die Fläche gezeichnet wird: ein kleiner, abgeschlossener Satz Hintergründe. */
type FeldArt =
  | { art: "leiste" }                                     // Bühne: Plätze 1..n nebeneinander
  | { art: "reihen"; reihen: readonly string[] }          // Arena: Front/Mitte/Backrow
  | { art: "strecke"; richtung: "waagrecht" | "senkrecht" } // Bahn, Climbing (Wand)
  | { art: "kette" }                                      // Tauziehen: Seil, Zieher hintereinander
  | { art: "flaeche"; flaeche: "basketball-halbfeld" | "eis" | "football" | "domination-3" | "grube" };

type Verbindlichkeit = "motor" | "start" | "darstellung";

type SlotPlatz = {
  x: number; y: number;              // normiert 0..1 auf der EIGENEN Hälfte/Fläche
  verbindlichkeit: Verbindlichkeit;
  beleg: string;                     // z. B. "SLOT_ZUSATZ.reihe=0", "BASKETBALL_ROLLE_SLOT=paint"
  rolleZeile?: string;               // Fakt für die Rollenkarte ("Von vorn", "Eröffnung 92 %")
};

type FormationsDefinition = {
  schluessel: { disziplin: string; variante?: string };  // variante fehlt = Standardformat
  feld: FeldArt;
  plaetze: Readonly<Record<string /* kurze Rollen-Id */, SlotPlatz>>;
  gegner?: "spiegel" | "n-gegen-n" | null;                // wie der Gegner gezeigt wird
  bedingung?: { minBesetzt: number; text: string };       // Basketball: „greift ab 6“
  kopfzeile?: string;                                     // „Hier zählt die Reihenfolge, kein Platz.“
};

function resolveFormation(disziplin: string, variante: string | null, slotCount: number): FormationsDefinition;
```

Die Auflösung läuft so: Zuerst wird `(disziplin, variante)` gesucht, dann `(disziplin)`, dann die
generische Leiste. Jede Rolle ohne Eintrag bekommt einen Platz auf der Leiste mit
`verbindlichkeit: "darstellung"`. Eine fehlende Geometrie macht also eine Marke hohl, aber nie
unsichtbar.

### 2.3 Rendering: eine Komponente, keine Disziplin-Weichen

`<FormationsFeld definition slots selections …/>` zeichnet den Hintergrund nach `feld.art` (je
Art ein kleines SVG) und setzt die Marken an `x/y`. Das Aussehen der Marke hängt allein an
`verbindlichkeit` (gefüllt / Start mit Pfeil / hohl). Im Renderer steht **kein**
`if (disziplin === …)`.

**Neues Format = neuer Eintrag in der Registry.** Neuer Code ist nur nötig, wenn das Format eine
noch nie dagewesene Fläche braucht, und auch dann nur ein Hintergrund-SVG, kein Umbau. Die
Tauziehen-Variante mit „hintereinander“ ist `feld: { art: "kette" }`: Die Plätze liegen auf einer
Linie (x = 0,15 … 0,9), und die Gegenseite wird gespiegelt (`gegner: "spiegel"`). „Die Grube“ mit
zwölf Podesten im Kreis wäre `flaeche: "grube"` mit Plätzen auf einem Kreis. Beides entsteht ohne
Renderer-Änderung, sobald die Variante Rollen-Ids hat.

**Was die Variante auswählt:** Heute gibt es im Spieltags-Vertrag
(`context.matchdayContract.discipline1/2`) kein Variantenfeld, die Wahl trifft nur der Motor
(Szenen). Bis eine Variante produktiv wird, ist `variante = null`. Wird eine produktiv, braucht der
Vertrag **ein** optionales Feld `formatVariante`, das der Client durchreicht. Am Feld ändert sich
dann nichts.

### 2.4 Verhältnis zum Motor: Anzeige-Kopie mit Drift-Wächter statt Umbau

`SLOT_ZUSATZ.reihe` ist **simulationsrelevant**: `homeFor()` setzt die Reihen beim Kampfstart, und
die Formationsleine hält sie (Fable 1c). Würde man den Block jetzt aus TS generieren, wäre das eine
Mechanik-Änderung mit Pflichtabnahme rho/Pp. Deshalb in zwei Stufen:

1. **F3:** Die TS-Registry ist eine **Anzeige-Kopie** der Motorfakten. Ein Vitest liest
   `battle-mode.engine.js` als Text und vergleicht `SLOT_ZUSATZ` (reihe, ord),
   `BASKETBALL_ROLLE_SLOT`, `BFFFA_ROLLEN_ORT`, die `planJeSlot`-Schlüssel, `TORWART_SLOTS`,
   `QB_SLOTS` und `KICKER_SLOTS` mit der Registry. Jeder Eintrag mit
   `verbindlichkeit: "motor" | "start"` muss dort einen Beleg haben. Vorbild für Tests, die die
   Engine lesen: `tests/battlefield-rollen-je-kadergroesse.test.ts`,
   `tests/staffel-weniger-als-sechs-laeufer.test.ts`. Ändert jemand den Motor, wird der Test rot,
   und die Tafel zeigt nie wieder etwas, das der Kampf nicht hält.
2. **Später, optional:** Ein Block `FORMATION_JE_DISC`, nur zur Anzeige, wird per
   `generiere-arena-daten.ts` in die Engine geschrieben, damit das Arena-Board dieselbe Registry
   rendert. Die Simulation liest ihn nicht. Dazu die Identitätsprüfung (`spiele(d, saat)`
   byte-gleich) nach dem Muster `scripts/pruefe-wettessen-identisch.mjs`. Erst wenn das steht,
   kann man erwägen, `SLOT_ZUSATZ` selbst daraus zu speisen. Das wäre dann Mechanik und fällt
   **nicht** unter dieses Rework.

---

## 3. Governance: speist der Adapter Anzeige zurück in die Simulation? **Nein, geprüft.**

- `buildArenaAufstellung` (`arena-aufstellung-adapter.ts` Z. 73–163) ist eine reine Funktion. Sie
  liest `gameState.seasonState.lineupDrafts` (den **gespeicherten** Entwurf, nicht den
  Anzeigezustand), `players`, `rosters`, die Kadergröße aus dem Spielplan
  (`getSeasonDisciplineScheduleEntry`) und die Staffel-Paargeschichte. Sie gibt ein neues Objekt
  `{Name → {d, slot, …}}` zurück und schreibt nichts.
- Aufrufer gibt es nur in `app/foundation/battle-arena/FoundationBattleArenaHost.tsx` (Z. 405,
  441, 500, 857). Alle bauen den Umschlag Richtung Motor. Kein Pfad führt vom Motor zurück zu
  `lineupDrafts`. `grep lineupDrafts` in `lib/foundation/battle-arena` und
  `app/foundation/battle-arena` findet nur die Lesestelle im Adapter.
- Der Motor übernimmt die Aufstellung nur lesend in `place`/`order` (Engine Z. 36789–36815).
- `LineupNewLook.tsx` importiert den Adapter nicht und spricht nur über die Handler des Clients.
  Paket F1 ändert keinen Handler und kein Prop des Board-Vertrags. Die Datei
  `lib/lineups/einsatzliste-anzeige.ts` hat keinen einzigen Import, das sichert ein Test
  (`tests/einsatzliste-anzeige.test.ts`).
- Das Feld `haltung?` im `ArenaAufstellungEintrag` (Z. 53–60) bleibt ungesetzt. Erst wenn Stufe 3
  gebucht wird, käme ein Rückkanal aus der Einsatzliste. Das wäre Mechanik und liegt außerhalb
  dieses Reworks.

**Der Vertrag `ArenaAufstellungEintrag` bleibt in allen Paketen unverändert.** Gesetzt wird
weiterhin über `onAssignPlayer` → Entwurf → `onSaveDraft`, und die Arena liest den gespeicherten
Entwurf.

---

## 4. Die fünf Fragen (Fable Abschnitt 13): Chris’ Antworten und was daraus folgt

Chris hat die Fragen am 08.11. selbst beantwortet (Rework-Konzept Abschnitt 13, „beantwortet
08.11.“). Eine erste Fassung dieses Dokuments ging noch von der unbeantworteten Version aus. Bei
Frage 2 und 3 lag sie damit falsch, bei Frage 4 hatte sie vorgegriffen. Das ist hier korrigiert,
und F1 ist entsprechend umgebaut.

1. **Slotfarbe je Position, „aber passend zu der jeweiligen Disziplin“.** Die Zuordnung Position
   → Farbton gilt über alle 20 Disziplinen. Sättigung, Wärme und Helligkeit dürfen sich an die
   Disziplin anpassen; Fables Gesamtkonzept löst das mit fünf „Stimmungen“ je Kulisse
   (`einsatzliste-gesamtkonzept-visuell-08-11.md` Abschnitt 4).
   - **Präzisierung aus der Architektur:** Position heißt **Foundation-`slotIndex`**, also die
     Zahl, die als „D1-3“ auf der Karte steht und aus der der Arena-Adapter die Rolle liest. Die
     `slotsVon(d)`-Reihenfolge des Motors weicht bei TDM, Spurt und Battlefield davon ab (1.3a).
     Das Arena-Board muss deshalb nach `SLOT_STELLE[id]` färben (Engine Z. 8238), sonst trägt
     dieselbe Rolle auf beiden Screens verschiedene Farben.
   - **F1 nutzt die Grundpalette ohne Stimmung.** Die sechs Töne in `EINSATZLISTE_SLOTFARBEN` sind
     mit der dataviz-Prüfung validiert (dunkles Thema, benachbarte Paare: CVD-Abstand 12,1,
     Normalsicht 17,8, Kontrast ≥ 3:1). Über alle Paare trennen sie nicht sauber, deshalb steht
     das Kürzel immer daneben.
   - **Abgleich nötig:** Fables Farbnamen (P1 Weinrot … P6 Umbra) und meine validierten Werte sind
     noch nicht dasselbe Set. Die Stimmungsfilter gehören als zweiter Parameter in `slotFarbe`.
     Jede Stimmungsvariante muss vor dem Bau wieder durch dieselbe Prüfung.
2. **Gold nach dem Slotwert**, ausdrücklich nicht nach Basis-Eignung. Chris: „Zu Punkt 2, den
   Rahmen machen wir nach dem Slotwert.“
   - **Umgesetzt nach Fables Lesart** (Gesamtkonzept Abschnitt 5): Gold heißt *Bestbesetzung*.
     Der Spieler hat in genau diesem Slot den höchsten Wert des ganzen Kaders, gemessen an
     derselben Projektion, die die Einsatzliste überall zeigt.
   - **Gestrichelter Goldring** („Gold verschenkt“): Der Kader-Beste für diesen Slot steht
     woanders oder nicht im Aufgebot. Der Tooltip sagt, wer es wäre und wo er steht.
   - **Kader-Liste:** Eine Raute ◆ steht hinter jedem Slot, in dem der Spieler Kader-Bester ist.
   - **Am 08.11. ersetzt (zweite Runde, Abschnitt 6.2).** Die Sichtprüfung hatte gezeigt:
     Tidesprinter war in allen 12 Slots Kader-Bester, also waren 11 von 12 Slots gestrichelt.
     Daraufhin hat Chris entschieden, dass Gold nach der **optimalen Gesamtzuteilung des Kaders**
     vergeben wird, und zwar dynamisch. Steht der dominante Spieler optimal auf Slot X, geht das
     Gold von Slot Y an den Besten unter den übrigen Spielern. `bestbesetzungJeSlot` ist
     entfernt; an seine Stelle treten `optimaleZuteilung` und `goldPruefung`.
3. **Gegner auf dem Feld, mit Counter-Einschätzung.** Das ist Chris’ Vorgabe, keine offene Frage.
   Meine erste Fassung hatte das für die Foundation mit „keine Späh-Daten, also erfunden“
   verworfen. Das war voreilig. Die Datenlage ist geprüft und steht in **Abschnitt 4a**. Kurz:
   Gegner und gegnerischer Kader sind zur Aufstellungszeit bekannt, nur noch nicht verdrahtet.
   Offen ist eine Spielregel-Frage an Chris, keine Datenfrage.
4. **Rollenkarte rechts oder darunter:** Chris hat das **bewusst vertagt**, bis ein Bild vorliegt
   („hängt davon ab, wie es dann aussieht“). Meine erste Fassung hatte „rechts in der
   Fokus-Rail“ entschieden; das ist zurückgenommen. Fables Gesamtkonzept schlägt inzwischen rechts
   vor, mit einem Faden von der Marke zur Karte. Architektonisch kostet beides gleich viel, denn
   die Rollenkarte ist eine Komponente, und wo sie steht, entscheidet das Layout. F2 kann sie
   vorläufig in die bestehende Fokus-Rail setzen, ohne die Entscheidung vorwegzunehmen.
5. **Foundation-Einsatzliste bekommt das Mini-Feld:** Ja, bestätigt. Bindend ist auch die Kopplung:
   Wer in der Einsatzliste eingesetzt wird, steht genau so in der Arena. Das leistet heute schon
   der Adapter (Abschnitt 3), und die Formations-Registry hängt an derselben Rollen-Id (1.3a).

Zusätzlich gilt weiterhin: **Fables Ebene C (Feinjustierung) gibt es in der Foundation nicht.**
Befehl, Haltung und Zusammenhalt sind Entwurfskampf-Regler des Mockups, und die Einsatzliste hat
keine. Das „zu viele Einstellungen“ trifft in der Einsatzliste andere Bedienelemente: je Seite
Intensität, zwei Formkarten-Selects, Team-Power-Select und Captain-Chips. Dazu gibt es das
optionale Paket F5 unten. Es braucht Chris’ Ja, weil es Bedienwege verschiebt.

### 4a. Gegner-Daten: weiß die Foundation zur Aufstellungszeit, gegen wen und mit wem?

**Ja, beides liegt im Spielstand. Es ist nur nicht an die Einsatzliste angeschlossen.**

- **Wer der Gegner ist**, steht im Spielplan: `getOpponentOf(gameState, teamId, matchdayId)`
  (`lib/season/season-fixture-schedule.ts` Z. 195) liest `seasonState.schedule`. Das ist derselbe
  Spielplan, aus dem die Arena ihre Heim/Gast-Paarung baut (`findeSpieltagsFixtures`,
  `lib/foundation/season-matchday-fixtures-overview.ts` Kopfkommentar). Pod-Disziplinen
  (Mini-DM, Battlefield, Takeshi/Staffel) haben einen eigenen 4-Team-Pod-Spielplan
  (`lib/season/mini-dm-pod-schedule.ts` u. a.).
  - **Einschränkung:** Bei alten Spielständen ohne Liga-Split ist der Spielplan nur ein
    Platzhalter. Im lokalen Abbild (Saison 2, nur 10 Spielplaneinträge) liefert
    `getOpponentOf` für das menschliche Team `null`. Die Anzeige muss das abfangen („Gegner noch
    nicht bekannt“), statt etwas zu erfinden.
- **Mit welchem Kader**, steht in den Aufstellungen der KI-Teams. Sie werden **vor** der eigenen
  Aufstellung geschrieben:
  - `POST /api/lineups/legacy/ai-batch-prewarm` (angestoßen aus dem Cockpit nach dem
    Spieltagswechsel, `lib/foundation/tabs/cockpit-matchday-handlers.ts` Z. 172) erzeugt alle
    KI-Aufstellungen des anstehenden Spieltags.
  - Spätestens beim Speichern der eigenen Aufstellung holt `app/api/lineups/legacy/route.ts`
    (Z. 175 ff.) fehlende nach.
  - Im Normalfall liegt die gegnerische `lineupDraft` also schon fest, wenn der Spieler aufstellt.
    Sie reagiert auch nicht auf seine Aufstellung (`overwriteExisting: false`).
- **Zwei Grenzen, die keine Datenlücke sind, sondern Spielregeln:**
  1. **Menschliche Gegner** (Koop, Franky; `getManualControlTeamIds`): Deren Entwurf zu zeigen,
     verriete eine Aufstellung, die der andere Mensch noch ändert. Für menschliche Gegner gibt es
     bis zur Abgabe keine Gegnerdaten, höchstens den Kader ohne Slots.
  2. **Wie genau die KI-Aufstellung sichtbar sein soll:** exakt oder nur als Späh-Schätzung mit
     Unschärfe, wie Fables Arena-Board es mit der Späh-Gewissheit vorsieht. Wird die exakte
     Gegneraufstellung gezeigt, wird Countern zur reinen Rechenaufgabe. Das ist eine
     Balance-Entscheidung. **Offener Punkt für Chris** (siehe unten), nicht von uns zu kippen.
- **Was die Einsatzliste dafür bräuchte:** Der Kontext (`lab-context`-Route, Typ
  `LegacyLineupLoadedContext`) bekäme ein optionales Feld `gegner`: Team, und je Disziplin-Seite
  Slots mit Spieler, Slotwert und Rolle. Es wird serverseitig aus Spielplan + gegnerischer
  `lineupDraft` gebaut, mit derselben `resolveSlotRoleShortId`-Abbildung wie der Adapter. Für die
  Counter-Einschätzung (Fables „Live-Delta“) reichen zunächst die Slotwerte beider Seiten je
  Position. Eine echte Duell-Projektion (eigener gegen gegnerischen Slot) gibt es im Resolve heute
  **nicht**: Gewertet wird die Seitensumme, nicht Slot gegen Slot. Jede „wer gewinnt dieses Duell“-
  Anzeige darf deshalb nur behaupten, was der Motor der jeweiligen Disziplin wirklich paart (z. B.
  n gegen n bei Gewichtheben, Tennis, Fechten, Speed-Schach). Für die Feldspiel- und Arena-
  Disziplinen ist das eine eigene Recherche.

**Chris’ Entscheidung (08.11., zweite Runde). Beide Punkte sind beantwortet:**
- (a) Die Gegneraufstellung wird **nie exakt** gezeigt, immer nur geschätzt. Wie genau die
  Schätzung ist, hängt an der Scouting-Qualität. Das ist dasselbe Prinzip wie beim Nebel über
  fremdem Potenzial. Gegen KI-Teams darf sie bei guter Stufe sehr treffsicher sein, weil die KI
  nach festen Mustern einsetzt.
- (b) Gegen **menschliche** Gegner gibt es auch auf der besten Stufe nur eine Prognose der
  wahrscheinlich besten Aufstellung. Sie wird mit derselben optimalen Zuteilung berechnet wie das
  Gold. Den echten Entwurf sieht man nie, und wenn der Mensch abweicht, ist das gewollt.
- Umgesetzt als Iteration 1, siehe Abschnitt 6.2.

**Zwischenschritt für die Scouting-Stufe (Iteration 1).** Eine Scouting-Stufe *pro Gegnerteam*
gibt es im Code nicht. Es gibt nur eine Stufe pro Paar aus eigenem Team und fremdem Spieler:
`getEffectiveScoutingLevel` ist Scouting-Büro (Facility 0–5) plus `floor(Gewissheit / 25)`,
gedeckelt auf 5 (`lib/scouting/facility-scout-pipeline-service.ts`). Daraus wird die Team-Stufe
abgeleitet, und so ist es auch umgesetzt: Sie ist der **gerundete Mittelwert dieser Spieler-Stufen
über den gegnerischen Kader**. Jede Slot-Spanne nutzt dagegen die Stufe ihres eigenen Spielers.
Die Unschärfe folgt genau der Skala von `getScoutingUncertainty` (±16 / 10 / 8 / 6 / 4 / 3), die
Treffsicherheit der von `getScoutingConfidencePct` (20 … 90 %). Dafür braucht es keine neue
Wirtschaft und keine neuen Spielstand-Felder. Eine echte Gegner-Scouting-Mechanik, zum Beispiel
eine „Spielvorbereitung“ als Auftrag an das Scouting-Büro, wäre eine eigene, spätere Entscheidung.

---

## 5. Umsetzungsplan für `LineupNewLook.tsx`

Jedes Paket ist reine Anzeige und kann als eigener PR laufen. Prüfung je Paket: die
Einsatzliste-Vertragstests (`tests/*` mit `LineupNewLook`, 15 Dateien) bleiben grün, und
`tsc`/`eslint` laufen ohne neue Meldungen. Ab F2 zusätzlich: Die Resolve-Ausgabe ist vor und nach
dem Paket identisch (`calculateSideSlotRoleModifierBreakdown` auf einem festen Kader, alle 20
Disziplinen).

| Paket | Inhalt | Braucht Geometrie? | Voraussetzung |
|---|---|---|---|
| **F1** ✅ (dieser PR) | Kürzel in Positionsfarbe an Slotkarte, Fokus-Kopf und Kader-Zeile; Kader-Zeile „Top-3 Slots mit Zahl“ statt nur „Bester Slot“; Gold = Bestbesetzung nach Slotwert (voll / gestrichelt „verschenkt“ / Raute ◆ in der Kader-Zeile) | nein | keine |
| **F2** | ±-Schema + Beitrags-Zerlegung als **Rollenkarte v1 in der Fokus-Rail**: Attributtafel `++/+/·/−/−−` aus `slotWeightProfile − baseWeightProfile`; „warum +8,5?“ als die 3 größten positiven und 2 größten negativen Beiträge, Klemmung sichtbar; Passungsglyphe neben jeder Slotzahl | nein | optionales `attributeStats` im Board-Typ `LineupBoardRosterCard` (Laufzeit hat es schon); eine reine Funktion `resolveSlotRoleContributions(role, stats)` **neben** `resolveProfileRoleModifier` in `matchday-slot-roles.ts` plus Vitest auf die Summen-Invariante (Σ Beiträge = Rohwert vor Klemmung, ±0,05, 20 Disziplinen × alle Slots). Die Schwellen als Konstanten in `einsatzliste-anzeige.ts` |
| **F3** | Formations-Datenquelle `lib/lineups/formation/` (Abschnitt 2) mit Drift-Wächter gegen die Engine. `<FormationsFeld>` ersetzt `nl-lineup-slot-grid` als Ansicht; die Kartendetails (Fatigue, Verletzungsrisiko, Drag-Fit) bleiben an der Marke bzw. in der Rail. Zuerst **Arena-Chassis (TDM/Mini-DM/Battlefield-Duell) und Basketball** (Chris’ Beispiel, mit Hinweis „Formation greift ab 6 Spielern“); alle übrigen Disziplinen bekommen sofort die generische Leiste | **ja** | F1 (Farben), sinnvoll nach F2 |
| **F4** | Übrige Feldformen: Bahn-Band aus `planJeSlot`, Climbing-Wand, Bühnen-Leiste mit „vs Platz n“, Hockey/Football hohl außer Torwart/QB/Kicker, Battlefield-Domination als Startort + Neigung. Rolle-Zeilen aus den Motortabellen (Verhalten-Befund Abschnitt 4) | **ja** | F3 |
| **F5** (optional, Chris fragen) | Einstellungen entschlacken: Formkarten, Team-Power und Captain je Seite in einen einklappbaren Block „Spieltag-Einstellungen“ mit Kurzfassung im eingeklappten Zustand; Intensität bleibt sichtbar | nein | Chris’ Ja |
| **F6** (Arena-Board) | Dasselbe im Mockup über einen generierten `FORMATION_JE_DISC`-Block (2.4 Stufe 2), Identitätsprüfung `spiele()` byte-gleich | ja | F3 |
| **F7** (Gegner) | Gegnerhälfte des Mini-Felds und Counter-Einschätzung (Chris’ Vorgabe, Abschnitt 4a): optionales Feld `gegner` im Lineup-Kontext aus Spielplan + gegnerischer `lineupDraft`, Rollen über `resolveSlotRoleShortId`; Geister-Marken mit Slotwert, Vergleich je Position | ja | F3 + Chris’ Antwort auf (a) exakt oder Schätzung und (b) menschliche Gegner |

**Kleinster sinnvoller Schritt mit sichtbarem Mehrwert: F1.** Der Schritt ist schon gebaut, weil
er keine offene Designfrage hat und ohne neue Datenquelle auskommt.

**Zwingend erst die Formations-Datenquelle:** F3, F4 und F6. F1 und F2 sind davon unabhängig. F2
lässt sich parallel zu F3 bauen.

Mit F3 wird die Kader↔Feld-Zuordnung über die Rollen-Id hergestellt
(`resolveSlotRoleShortId`, 1.3a). Die Marke liest also dieselbe Rolle wie der Arena-Adapter. Dazu
gehört ein Test, der für alle 20 Disziplinen und k = 1…6 prüft, dass jede Rolle, die
`resolveSlotRoleShortId` liefert, in der Registry einen Platz hat oder bewusst auf die Leiste
fällt.

---

## 6. Was in diesem PR gebaut ist (F1)

- `lib/lineups/einsatzliste-anzeige.ts` (neu, ohne Importe):
  - `EINSATZLISTE_SLOTFARBEN` / `slotFarbe(slotIndex)`: sechs validierte Positionsfarben.
  - `slotKuerzel` / `slotKuerzelFuerListe`: Arena-Regel, Kollisionen eindeutig aufgelöst. Die
    Grundregel kollidiert heute in **Staffel** (Curve Runner und Chase Runner, beide „CR“) und in
    **Breaking** (Standhalten und Steingesicht, beide „ST“). Neu heißen sie CH und SE. Das
    Mockup-`slotKuerzel` hat dieselbe Kollision und sollte beim Arena-Paket 1 dieselbe Funktion
    bekommen.
  - ~~`bestbesetzungJeSlot`~~ (je Slot der Kader-Beste): in der zweiten Runde durch
    `optimaleZuteilung` / `goldPruefung` ersetzt, siehe 6.2.
- `LineupNewLook.tsx`:
  - Slotkarte: Kürzel-Chip in Positionsfarbe vor dem Rollenlabel.
    - Voller Goldring am Avatar, wenn der Gesetzte hier Kader-Bester ist („Bestbesetzung: niemand
      im Kader wäre auf D1-1 Vanguard besser (Slotwert 78,4)“).
    - Gestrichelter Goldring um das Kürzel, wenn der Kader-Beste woanders steht oder fehlt
      („Gold verschenkt: Buttercup wäre hier 81,0 — steht auf D1-4 Hold Line“).
  - Fokus-Kopf: Kürzel-Chip vor dem Rollennamen.
  - Kader-Zeile: Statt „Bester Slot D1-3 · 72,4“ stehen jetzt die drei stärksten Slots als
    `VA 78,4◆ · BR 77,9 · SK 72,0`.
    - Mit aktivem Slot innerhalb seiner Seite, sonst über beide Seiten mit Seitenkürzel.
    - Die Zahl ist dieselbe Slot-Projektion (`projectedScore`), die überall sonst steht.
    - ◆ steht hinter jedem Slot, in dem der Spieler Kader-Bester ist.
    - Goldring am Avatar für den Kader-Besten des aktiven Slots.
- `tests/einsatzliste-anzeige.test.ts`: Kürzel eindeutig in allen 20 Disziplinen × k = 1…6,
  Kollisionsauflösung, Farben, Bestbesetzung je Slot, keine Importe im Helfer.

### 6.1 Sichtprüfung im Browser (lokaler Dev-Server, frischer Spielstand)

Aufbau: lokaler Dev-Server mit leerer SQLite, also frisch angelegtem Spielstand (S1, Spieltag 1,
Hockey (6) / Climbing (6), Team Armageddon Aftermath). Automatischer Save-Export war
abgeschaltet. Die Aufstellung kam über „KI-Vorschlag für dieses Team“ (nur im Browserzustand,
nicht gespeichert). Der Live-Server wurde nicht berührt.

Screenshots:
- `einsatzliste-revamp-08-11/f1-leer-kaderliste.png`: leere Aufstellung, Kader-Liste mit
  Top-3-Slots und ◆
- `einsatzliste-revamp-08-11/f1-ki-aufstellung-gold.png`: volle KI-Aufstellung mit vollem und
  gestricheltem Gold

**Was aussieht wie gedacht:**
- **Kürzel-Chips** in sechs Positionsfarben an allen 12 Slots, im Fokus-Kopf und in der
  Kader-Zeile. Die Zuordnung Kader ↔ Slot ist ohne Lesen der Rollennamen möglich.
- **Kader-Zeile:** zeigt „TR 70,8◆ · SF 69,5◆ · PL 67,2◆“. Die Zeile bleibt eine Zeile hoch.
- **Voller Goldring** am Avatar von Tidesprinter auf D2-1 Route Reader (Bestbesetzung, Slotwert
  86,4).

**Was nicht passt, ehrlich:**
1. **Die Bestbesetzungs-Lesart kippt, wenn ein Spieler den Kader dominiert.** Im frischen
   Spielstand ist Tidesprinter in **allen 12 Slots** der Kader-Beste. Er kann aber nur einen
   Slot besetzen; die Kader-Liste zeigt ihn danach als „schon eingesetzt“.
   - Folge: **11 von 12 Slots tragen den gestrichelten Ring** „Gold verschenkt: Tidesprinter wäre
     hier 66,7 — steht auf D2-1 Route Reader“.
   - Daneben steht auf denselben Karten der bestehende Chip „Bester Pick ✓“, der gegen die noch
     *verfügbaren* Spieler misst. Zwei Signale widersprechen sich auf derselben Karte, und das
     gestrichelte ist nicht umsetzbar.
   - Das ist kein Bug in F1, sondern eine Lücke in der Definition (Fables Vorschlag, nicht von
     Chris bestätigt). Drei Lesarten, alle nur eine Funktion:
     - (a) **Optimale Zuteilung:** Gold, wenn der Slot so besetzt ist, wie die beste
       Gesamtzuteilung des Kaders ihn besetzen würde. „Verschenkt“ hieße dann: eine andere
       Verteilung brächte mehr.
     - (b) **Bestbesetzung unter den Verfügbaren:** deckt sich mit „Bester Pick ✓“, wäre also
       doppelt.
     - (c) **„Verschenkt“ nur bei Bank:** gestrichelt nur, wenn der Kader-Beste gar nicht
       aufgestellt ist.
   - Empfehlung: **(a)**. Sie beantwortet „habe ich gut verteilt?“, und das ist genau der
     Konflikt, den Fable mit „Gold wandert“ zeigen will. **Entscheidung bei Chris/Fable.** F1 zeigt
     bis dahin Fables Lesart unverändert.
2. **Rost (Position 3) und Kupfer (Position 5) liegen im Bild näher beieinander als im
   Validator.** Im Raster mit drei Spalten stehen sie diagonal benachbart (D1-3 / D1-5). Der
   Validator prüft nur Listen-Nachbarn. Für das Mini-Feld (F3) muss die Palette über alle Paare
   nachgeschärft werden. Das passt ohnehin zu Fables Stimmungs-Varianten.
3. **Der gestrichelte Ring am kleinen Kürzel-Chip ist dezent.** Er ist bei 100 % Zoom erkennbar,
   aber kein starkes Signal. Auf der Marke des Mini-Felds (F3) gehört er an den Kartenrand, wie
   Fable es zeichnet.
4. **Schrift:** Im Container fehlen die Webfonts (Proxy), die Screenshots zeigen eine
   Ersatzschrift. Das betrifft nicht den Code.

**Nachtrag zweite Runde:** Punkt 1 ist durch die optimale Gesamtzuteilung gelöst (6.2). Punkt 2
und 3 bleiben für das Mini-Feld (F3) offen.

### 6.2 Zweite Runde (08.11.): Gold nach optimaler Gesamtzuteilung, Gegner-Schätzung Iteration 1

**Gold: was gebaut ist.**
- `lib/lineups/einsatzliste-anzeige.ts` (weiterhin ohne Importe):
  - `optimaleZuteilung` löst das Zuordnungsproblem (Maximum-Weight-Bipartite-Matching) mit der
    Ungarischen Methode. Slots stehen gegen Spieler, das Kantengewicht ist `projectedScore`, also
    dieselbe Slot-Projektion, die überall in der Einsatzliste steht. Ein Spieler belegt höchstens
    einen Slot über beide Disziplinen, wie im Drag & Drop. Verletzte sind ausgeschlossen. Der
    Aufwand ist O(n³) mit n = max(Slots, Spieler); bei 12 Slots und ~20 Spielern sind das ein
    paar tausend Schritte.
  - `goldPruefung` entscheidet über Gold. Ein besetzter Slot ist Gold, wenn es **eine** optimale
    Gesamtzuteilung gibt, die genau diesen Spieler auf diesem Slot hat. Geprüft wird per
    Fixierung: Spieler P wird fest auf Slot S gesetzt, der Rest neu optimal verteilt. Gegenüber
    der reinen Frage „steht er da, wo der Algorithmus ihn hinlegt?“ hat das zwei Vorteile:
    1. Gold kippt nicht an Gleichständen. Zwei gleich starke Spieler sind in beiden Anordnungen
       Gold.
    2. Die Abweichung bekommt eine Zahl. Der Tooltip am gestrichelten Ring sagt zum Beispiel
       „Diese Besetzung kostet die beste Gesamtverteilung −3,8. Optimal hier: Leira 55,9 — steht
       auf D1-3 Style Tech“. Das erklärt den Ring und sagt zugleich, was zu tun ist.
- `LineupNewLook.tsx`:
  - Ein voller Goldring am Avatar erscheint, wenn die Fixierung nichts kostet (≤ 0,05, dieselbe
    Schwelle wie bei „Bester Pick ✓“). Sonst ist der Ring gestrichelt und trägt Kosten und
    Tausch-Hinweis.
  - Die ◆ in der Kader-Zeile steht genau einmal je Spieler, am Slot seiner optimalen Zuteilung.
    Oft liegt dieser Slot nicht unter seinen eigenen Top 3, typischerweise weil ein Stärkerer den
    besten Platz hat. Dann wird er als vierter Eintrag angehängt.
  - Neu ist eine Bilanz je Seite, etwa „◆ 4/4 optimal verteilt · beste Verteilung“ oder
    „· gesamt −40,4 zur besten Verteilung“. Die Gesamtzahl gilt über beide Seiten und erscheint
    nur bei voller Aufstellung.
  - Der Widerspruch mit „Bester Pick ✓“ ist aufgelöst. Dieser Chip misst nur gegen die *noch
    freien* Spieler. Trägt dieselbe Karte den gestrichelten Ring, heißt der Chip jetzt „Bester
    freier Pick“ (neutral, der Tooltip ist der Gold-Hinweis).
- Tests (`tests/einsatzliste-anzeige.test.ts`) decken ab:
  - den Tidesprinter-Fall: Der dominante Spieler nimmt einen Slot, die anderen geben ihr Gold weiter;
  - Gleichstände;
  - Verletzte und einen zu kleinen Kader;
  - einen **Brute-Force-Abgleich auf 200 Zufallsinstanzen**, bei dem die Summe jedes Mal dem
    Optimum entspricht.

**Warum dieses Konzept und nicht Chris’ erster Gedanke wörtlich.** Chris war offen für Besseres.
Der Unterschied ist klein, entscheidet aber über die Lesbarkeit. Bei „Gold = steht, wo der
Algorithmus ihn hinlegt“ wirkte Gold bei Gleichständen zufällig, und „verschenkt“ hätte keine
Größe. Die Fixierungsprüfung beantwortet die Frage, die der Spieler wirklich hat: *Kostet mich
diese Besetzung etwas, und wie viel?* Dynamisch bleibt sie trotzdem. Zieht der Spieler bewusst
jemanden um, wird nur der Slot gestrichelt, der dadurch wirklich verliert, nicht die ganze Seite
(Screenshot 2 unten).

**Gegner-Schätzung, Iteration 1: was gebaut ist** (`lib/lineups/gegner-schaetzung.ts`).
- Der Gegner kommt aus `getOpponentOf`, also aus dem Spielplan. Die `lab-context`-Route liefert
  den vollen Spielstand ohnehin im Kontext mit (`context.gameState`), deshalb war keine neue Route
  nötig.
- Ist der Gegner `null` (Altstand ohne Liga-Split, kein Spielplan-Eintrag) oder der Spielstand
  lückenhaft, zeigt der Streifen „Gegner noch nicht bekannt“ statt abzustürzen. Der Aufruf steht
  zusätzlich in einem `try/catch`.
- Was je Stufe sichtbar ist:
  - **Stufe 0:** der Name des Gegners und der Disziplin-Schnitt als grobe Spanne (±16), keine
    Spielernamen.
  - **Stufe 1–2:** Namen und Spannen je Position, aufgestellt nach der **Prognose**, also der
    optimalen Zuteilung des gegnerischen Kaders über beide Seiten.
  - **Stufe ≥ 3, KI-Gegner:** Die Slots kommen aus dem bereits geschriebenen KI-Entwurf
    („KI-Einsatzmuster erkannt“). Die Werte bleiben eine Spanne von mindestens ±3, die
    Treffsicherheit ist auf 95 % gedeckelt.
  - **Menschlicher Gegner:** Den Entwurf gibt es nie, immer nur die Prognose. Die Treffsicherheit
    ist auf 60 % gedeckelt, mit dem Hinweis „ein Mensch kann abweichen“.
- Die Spannen sind **nicht um den wahren Wert zentriert**, denn sonst wäre ihre Mitte die
  Wahrheit. Ihr Mittelpunkt ist um einen festen Versatz verschoben, je Betrachter, Spieler und
  Disziplin, höchstens um die halbe Unschärfe. Der wahre Wert liegt trotzdem immer in der Spanne.
  Der bestehende Potenzial-Nebel zentriert noch; das wäre eine eigene Nachschärfung.
- Die Werte sind die rohe Disziplin-Eignung (`player.disciplineRatings`), nicht die Slot-Projektion
  mit Rolle und Intensität. Deshalb steht daneben „wir Ø …“ auf derselben Skala.
- Angezeigt wird das als kompakter, gestrichelter Streifen je Disziplin-Seite über dem
  Slot-Raster. Er nutzt dieselben Positions-Kürzel und -Farben wie die eigene Seite und trägt die
  Marke „Iteration 1“. Er hält den Platz für die Gegner-Marken des Mini-Felds (F3).
- Tests (`tests/einsatzliste-gegner-schaetzung.test.ts`) prüfen:
  - ohne Spielplan oder ohne Spielstand wird „unbekannt“ gemeldet;
  - die Spanne enthält immer den wahren Wert und ist nie exakt;
  - Stufe 0 verdeckt die Namen;
  - bei einem KI-Gegner auf Stufe 5 kommt der Entwurf, aber weiter als Spanne;
  - bei einem Menschen kommt die Prognose, gedeckelt, und jeder Spieler steht höchstens einmal
    darin.

**Grenzen von Iteration 1, ehrlich:**
- **Pod-Disziplinen** (Mini-DM, Battlefield, Takeshi/Staffel) laufen in Vierergruppen mit eigenem
  Spielplan. Der Streifen zeigt dort den Gegner aus dem Haupt-Spielplan, nicht die Gruppe.
- Verletzte Gegner werden in der Prognose noch nicht ausgeschlossen.
- Der volle Spielstand liegt heute ohnehin im Browser, fremde Entwürfe eingeschlossen. Für echtes
  Verbergen (Koop/PvP) müsste die Route die Schätzung serverseitig bauen und `gameState` nicht
  mehr ausliefern. Das gehört in eine spätere Iteration.

**Sichtprüfung zweite Runde.**

Aufbau:
- lokaler Dev-Server mit eigener, leerer SQLite im Scratchpad;
- zwei frisch angelegte Spielstände (Neues Spiel „solo_1“ plus Liga-Draft);
- Export, Push und Login abgeschaltet;
- alles nur im Browser eingesetzt, nichts gespeichert, der Live-Server nicht berührt;
- in Save B ein Scouting-Büro der Stufe 5 im Spielstand, um den treffsicheren Fall zu zeigen.

Screenshots (`einsatzliste-revamp-08-11/`):
1. `f2-gold-optimal-dominanter-spieler.png`: Stronghold Crusaders mit dem dominanten Spieler
   *Bearington*. Er ist in beiden Disziplinen Kader-Bester, das ist der Tidesprinter-Fall. Die
   optimale Verteilung ist im Browser nachgeklickt, Ergebnis: **10/10 Gold, „beste Verteilung“.**
   - Bearington trägt genau einen Goldring (D1-3 Style Tech, 60,2).
   - Leira bekommt D1-1, obwohl Bearington dort mehr hätte.
   - Alle Fechten-Slots tragen Gold für die jeweils Besten unter den Übrigen.
   - Vorher (`f1-ki-aufstellung-gold.png`) waren in derselben Lage 11 von 12 Slots gestrichelt.
2. `f2-gold-dynamik-nach-fehlgriff.png`: dieselbe Aufstellung, danach Bearington bewusst auf
   D1-1 gesetzt. **Nur D1-1 wird gestrichelt** („kostet −3,8. Optimal hier: Leira 55,9“), alle
   anderen Slots behalten ihr Gold.
3. `f2-ki-vorschlag-dominanter-spieler-gegner-scouting5.png`: KI-Vorschlag für denselben Kader.
   Gegner Death Peaches mit „KI-Einsatzmuster erkannt“, Namen und Spannen ±3, ~90 %.
4. `f2-ki-vorschlag-normaler-kader-gegner-scouting0.png`: Death Peaches (ohne dominanten
   Spieler) mit KI-Vorschlag. D1 ist 4/4 Gold. Der Gegner zeigt bei Scouting 0 nur „Ø 35–68“,
   keine Namen.
5. `f2-automatisch-fuellen-abweichungen-chip.png`: Hell Raisers nach „Automatisch füllen“. Auf
   den gestrichelten Slots steht „Bester freier Pick“ statt „Bester Pick ✓“.

**Neuer Befund für Chris: Der KI-Vorschlag ist nach der angezeigten Projektion klar nicht
optimal.**
- In beiden KI-Fällen liegt die KI-Aufstellung **insgesamt rund 40 Punkte** unter der optimalen
  Verteilung: Stronghold Crusaders −40,4 bei 0/10 Gold, Death Peaches −43,3 bei 5/10. Das sind
  gut 9 % der Seitensummen.
- Den KI-Pfad (`ai-lineup`) habe ich in dieser Runde nicht untersucht. Zwei Erklärungen sind
  möglich: Die KI plant bewusst nach etwas anderem als dieser Slot-Projektion (Frische, Rotation,
  Kapitäne, Saisonstrategie), oder sie gewichtet Rollen und Slot-Fit schwächer.
- „Automatisch füllen“ geht gierig in Slot-Reihenfolge vor und verfehlt die beste Verteilung
  ebenfalls deutlich, mit Einzelposten bis −14.
- Das Gold macht das jetzt sichtbar. Ob die KI oder das Füllen nachgezogen wird, ist eine eigene
  Entscheidung: Das wäre Spielmechanik der KI, keine Anzeige.

**Offen für Chris:**
- Gold-Konzept ansehen und bewerten (Screenshots 1 und 2).
- Soll „Automatisch füllen“ künftig die optimale Zuteilung nehmen? Das betrifft nur die Bedienung,
  keine Spielregel, und wäre ein naheliegender kleiner nächster Schritt. Und soll der KI-Vorschlag
  untersucht werden (Befund oben)?
- Gegner-Streifen: Passen Ort und Dichte für jetzt? Im Mini-Feld (F3) wird daraus die Gegner-Reihe.
- Später: eine echte Gegner-Scouting-Mechanik statt des Kader-Mittelwerts und serverseitiges
  Verbergen für Koop/PvP.
