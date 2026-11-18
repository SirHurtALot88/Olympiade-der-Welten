# App-Rahmen modern — Bau und Abgleich (18.11.)

Vorlage: `public/mockups/app-rahmen-modern-18-11.html`, Erklärung `docs/design/app-rahmen-modern-18-11.md`.
Bilder der echten App: `docs/design/app-rahmen-bau-18-11/` (Wegwerf-Battle-Save, Aufnahme mit
`scripts/screenshot-app-rahmen.ts`, Port 3215). Mockup-Bilder zum Vergleich: `docs/design/app-rahmen-modern-18-11/`.
Wertung nicht berührt (reine Rahmen-Änderung).

## Drin

| Mockup-Teil | Umsetzung |
|---|---|
| Regieband statt Rahmenzeile + Seitenkopf + Reiterzeile | `FoundationShell`: `<header class="fb-band">` mit Ort (goldene Kopfzeile + Seitentitel), Unterreiter am Band, Seiten-Slot, Saison-Chip, Kasse, Suche, Hauptaktion, Taktgeber; klebt oben. Stil: `components/foundation/broadcast/rahmen.css` |
| Seiten-Slot | `foundation-band-slot.tsx`: `<FoundationBandSlot>` in jeder Seite bringt Inhalt per Portal ins Band (noch von keiner Seite benutzt) |
| Taktgeber (3 Zustände + Ablauf) | `FoundationTaktgeber.tsx`: bereit/weiter (pulsiert)/zu (blockiert, Klick springt trotzdem zum offenen Schritt)/läuft (Füllung + laufende Linie); die bisherige Aktivitätsliste steht im Ablauf-Aufklapper (Klick auf die Statuszeile, Esc/Außenklick schließt). Statuschip und alter „Weiter“-Knopf entfallen. `data-testid="foundation-global-next-button"` bleibt |
| Saison-Chip mit 20 Strichen, Kasse | im Band; Klick auf Saison öffnet den Saisonstand. „S1 MD1“ über der Schiene entfällt |
| Suche | Lupe im Band (⌘K bleibt) |
| Nur Ansicht | kleine Marke im Band statt goldenem Band (Chris-Nachtrag) |
| Schiene: Wappenkopf, gleitende Marke, Office unten | Wappen des aktiven Teams oben (ausgeklappt mit Name; Teamwechsel über den vorhandenen Picker), eine Goldmarke gleitet zum aktiven Punkt, Office als Punkt unten |
| Flagge unten | Fehler-Flagge sitzt per CSS unten links in der Schiene, in der Arena-Vollbild ausgeblendet |
| Meldungen als Bauchbinde | `FoundationMeldungen.tsx`: neue Inbox-Meldungen 6 s unten rechts, klickbar; in der Arena zurückgehalten, danach EINE gesammelte Zeile („3 neue Meldungen“) |
| Arena-Vollbild | Band und Schiene fahren weg, Griff links (15 px), R blendet den Rahmen ein, Esc verlässt die Arena (zurück zur Seite davor, sonst Start) |
| Sendewisch 0,7 s | beim Wechsel in die Arena; bei reduzierter Bewegung aus |
| Seitenwechsel | Titel rutscht ein, Tafeln steigen gestaffelt auf (0,34 s) |
| Gold statt Blau | Band, Reiter, Marke, Taktgeber in Gold/Creme (Tokens des Mockups) |
| rem-Skalierung | Band, Taktgeber, Bauchbinde skalieren mit Fenstergröße (`--fb-u`, Entwurfsmaß 1920×1080) |

## Nachträge (Chris 18.11., nach #1588)

- **Leertaste = weiter, überall.** `lib/foundation/foundation-takt-plan.ts` ist die eine Quelle: `baueTaktPlan` baut aus
  `buildGameFlowState().steps` und den offenen Inbox-Einträgen die Pflichtschritte (Haken/Rot/Gelb) und die kritischen
  Punkte; `entscheideLeertaste` entscheidet. Ohne kritische Punkte ruft die Leertaste genau die Taktgeber-Aktion
  (`triggerGlobalNext`). Bei kritischen Punkten (rote Schritte bis zum aktuellen, kritische Inbox-Einträge wie
  Einsatzliste unvollständig, Pflicht-Minuskarte, Verletzter aufgestellt, Kasse unter null) geht es NICHT weiter: der
  Ablauf klappt auf, ein zweiter Druck springt zum ersten kritischen Punkt. Nicht ausgelöst wird in Eingabefeldern,
  Dialogen, laufenden Aktionen und in Ansichten mit eigener Leertaste (Arena = Pause; die Einsatzliste behält ihre
  bisherige Ausnahme). Der Zustand „Ablauf offen“ teilen Hook und Taktgeber über `takt-ablauf-store.ts`.
  Tests: `tests/foundation-takt-plan.test.ts`, `tests/foundation-taktgeber-zustand.test.ts`.
- **Ablauf-Aufklapper** zeigt die Pflichtschritte mit Haken (grün), Rot (hält auf, „beheben ›“) und Gelb, darunter wie
  bisher die laufenden Aktivitäten.
- **Aufgeräumt:** Kopfzeilen-Regeln und `foundation-rail-mini` in `broadcast.css`, Kontext-Portal („S1 · MD“) und
  alte Brotkrumen-/Kopf-Regeln in `globals.css`, die Saison-Chips der Schiene entfernt (Saison steht im Band).
  Shell-Vertragstest auf Band-Chip umgezogen.
- **Arena-Vollbild:** hängt jetzt an `.oly-arena-buehne[data-voll="1"]` der Vollflächen-Bühne (#1578) statt an einer
  Leinwand-Suche; Seitenmodus der Bühne („⤓ Seite“) und „Vor dem Anpfiff“ behalten Band und Schiene.

## Angepasst gegenüber dem Mockup

- Der Ablauf zeigt die vorhandene Aktivitätsliste (Preseason, Setup-Aktionen …), nicht die Pflichtschritte mit
  Haken/Rot/Gelb des Mockups: die Schritt-Liste liefert `FoundationRoomFlowBar` / `resolve-game-flow-action-step`
  noch nicht in dieser Form.
- Die Statuszeile unter dem Knopf sagt „Bereit · Leertaste“ bzw. „Hält auf“, nicht „1 Platz offen“ (der Grund steht im
  Tooltip des Knopfes).
- Saison-Chip trägt feste 20 Spieltage; die Striche sind gespielt/jetzt/offen (keine Farbe nach Ergebnis, die Daten
  liegen am Rahmen nicht vor).
- Die Hauptaktion der Seite (z. B. „Office öffnen“, „Kandidat wählen“) steht weiter als kleiner Knopf neben dem
  Taktgeber, bis die Seiten ihre Aktion über den Slot melden.
- Arena-Vollbild ist rahmenseitig gebaut (Band/Schiene weg). Die Bühne selbst füllt das Fenster erst mit
  `claude/arena-vollbild-18-11` (nicht gemergt, nicht angefasst).

## Fehlt / offen

- **Office als Blatt über der Seite:** Office ist ein Reiter der Startseite (`homeV2Tab`), kein eigenes Bauteil. Der
  Schienenpunkt führt dorthin. Das Blatt braucht eine Umstellung der Home-Komponente (gehört zum Startseiten-Bau).
- **Hauptaktion nur noch oben rechts, Fußleiste der Einsatzliste raus:** laut Auftrag letzter Schritt nach dem Merge
  der Einsatzliste. Offen. Ebenso das Doppel des Startseiten-Kopfs (eigener „Einsatzliste setzen“-Knopf): der
  Startseiten-Bau soll den Knopf entfernen, der Taktgeber trägt ihn.
- **Seiten füllen den Slot noch nicht** (Start: Rang/Punkte/Form, Einsatzliste: D1/D2, Saisonstand: Liga-Reiter);
  die Seitenköpfe (`BcHero`) und eigene Reiterzeilen stehen daher noch.
- **Ladezustand mit Tafel-Umrissen** statt „… WIRD GELADEN“: bestehende Platzhalter der Seiten, nicht umgebaut.
- **Mitwachsende Schrift für die ganze App:** nur der Rahmen skaliert; Seiteninhalt (px-Maße) wächst noch nicht mit.
  Auf 2560 wirken Schiene (64 px) und Seiten daher kleiner als im Mockup. Schrittweise je Seite.
- **Meldungen:** speist sich aus der Home-Inbox-Liste; auf Seiten, auf denen sie nicht berechnet wird, bleibt sie leer.
- **Kasse-Chip:** Wert aus der Standings-Zeile (`selectedStandingRow.cash`), ohne Saldo-Pfeil.

## Bilder

`docs/design/app-rahmen-bau-18-11/`: `abgleich-saisonstand|einsatzliste|start-1920x1080.png` (links App, rechts Mockup),
`app-saisonstand-1920x1080|2560x1440|1710x1112`, `app-einsatzliste-1920x1080|2560x1440`, `app-start-1920x1080`,
`app-takt-ablauf-1920x1080` (Taktgeber mit Ablauf), `app-schiene-hover-1920x1080`, `app-office-1920x1080`,
`app-arena-vollbild-1920x1080`.

Lücken der Aufnahme (Rechner voll, Chromium stürzte mehrfach ab): 1710-Aufnahmen nur Saisonstand, 2560 nur
Saisonstand und Einsatzliste; Taktgeber-Zustände „läuft“ und „zu“ nicht im Bild (nur „bereit zum Weiter“); die
Arena-Aufnahme zeigt „Vor dem Anpfiff“ (Wegwerf-Save ohne Einsatzliste) – Vollbild mit laufender Bühne ist nicht
bebildert. Der Vollbild-Schalter greift deshalb nur, wenn im Arena-Container eine Leinwand/ein Iframe steht
(`MutationObserver` in `FoundationShell`); „Vor dem Anpfiff“ behält Band und Schiene. Das Bild
`app-arena-vollbild-1920x1080.png` stammt von einem Zwischenstand (Band ausgeblendet, Seite ohne Bühne).
