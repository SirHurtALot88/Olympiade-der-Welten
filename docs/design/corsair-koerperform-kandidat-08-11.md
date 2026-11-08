# Corsair-Körperform-Kandidat (08.11.)

## Auftrag

Chris, zum Konzept-Portrait von Corsair (dunkle Hightech-Rüstung, blaue Neon-/Magie-Energie um
die Hände, sehr definierte, austrainierte Beine und Gesäß) neben dem winzigen PixelLab-Sprite im
Spiel: „bekommt man es hin die krassen kurven von corsair besser im charakter abzubilden? die
beine und der po? sind sehr gut trainiert." Auf Nachfrage, ob eine neue Version vor dem Löschen
der alten probiert werden soll: „ja versuch corsair in ner besseren version zu erstellen lösche
die alte noch nicht."

Harte Vorgabe: die bestehende Figur (`corsair`, `pixellabId` `9f913ed5-a980-40c8-81b5-af5fcd7c42c9`)
bleibt unangetastet. Jeder Kandidat ist ein **zusätzlicher** Eintrag (`corsair-v2`, `corsair-v3`, …)
zur Begutachtung.

**Nachtrag nach Kandidat 1 (`corsair-v2`):** Chris hat ihn gesehen und klar zurückgewiesen —
„Neee der köroer und Kopf passen nicht sie soll genau wie auf eem bild aussehen" und „Und du musst
80x80 wie immer machen". Dazu zweimal die Anweisung, **nicht** auf einen Notbehelf-Erzeugungsweg
auszuweichen, sondern den **tatsächlichen** Weg zu finden, mit dem alle anderen ~360 Figuren
entstanden sind: „Du sollst sie nach gleichem Vorbild generieren wie die anderen bisher" und „Wir
hatten das doch dokumentiert prüfen das". Das Ergebnis dieser zweiten Suche steht unten in
**Kandidat 2 (`corsair-v3`)** — `corsair-v2` bleibt als dokumentierter Fehlversuch stehen (nicht
gelöscht), weil er zeigt, woran der erste Anlauf gescheitert ist.

## Recherche 1: PixelLab-v2-API, Basis-Charaktererzeugung (ergab Kandidat 1, `corsair-v2`)

Im Repo gab es bislang **kein** Skript für die Basis-Charaktererzeugung (nur
`scripts/figuren-bestelle-animationen.py`, das ausschließlich nachträglich fehlende Animationen für
eine bereits existierende Figur bestellt). Recherchiert über die offizielle OpenAPI-Spezifikation
(`https://api.pixellab.ai/v2/openapi.json`, bestätigt per `GET` — Stand 08.11.) und die kondensierte
Referenz (`https://api.pixellab.ai/v2/llms.txt`).

**Gefundene Charaktererzeugungs-Endpunkte** (alle `POST`, Basis-URL `https://api.pixellab.ai/v2`):

| Endpunkt | Richtungen | Besonderheit |
|---|---|---|
| `/create-character-v3` | 8 (Referenzbild-Modus) oder aus Text | neuestes Modell, optional mit Referenzbild |
| `/create-character-pro` | 8 | Pro-Modus, teurer |
| `/create-character-with-8-directions` | 8 | `mode`: `standard` (Template-Skelett, günstig) oder `pro` |
| `/create-character-with-4-directions` | 4 | kein `mode`-Feld, immer Template-Pfad |
| `/create-character-state` | — | neuer Zustand einer bestehenden Figur |

Dazu `GET /balance` (Konto-/Guthabenabfrage, kostenlos) und `GET /background-jobs/{job_id}`
zum Pollen einzelner Jobs.

**Abgleich mit den ~360 bestehenden Projekt-Figuren:** `GET /characters/{id}` an der bestehenden
`corsair` und einer Zufallsstichprobe (`hollow`, `timantha`, `sterling`, `don-micelio-valens`)
zeigt bei **allen** identisch: `size: {80, 80}`, `directions: 8`, `view: "low top-down"`,
`template_id: "custom"`, `style_settings` leer. `template_id: "custom"` ist in der aktuellen
OpenAPI-Beschreibung für `/create-character-with-8-directions` nicht mehr als gültiger Wert
gelistet (nur noch `mannequin`/`bear`/`cat`/`dog`/`horse`/`lion`) — die 360 Bestandsfiguren
stammen also entweder von einer älteren API-Version oder einem internen Pfad, der inzwischen nicht
mehr über die dokumentierten Endpunkte erreichbar ist. Für den neuen Kandidaten wurde deshalb der
nächstliegende aktuelle Endpunkt gewählt: **`POST /create-character-with-8-directions`**,
`mode: "standard"` (Template-Skelett-Erzeugung, 1 Generation — nicht `"pro"`, das 10–25
Generationen/Richtung kostet), `template_id: "mannequin"` (humanoid), `view: "low top-down"`,
`image_size: {80, 80}` — das trifft Canvas, Blickwinkel und Richtungszahl exakt, der einzige
unvermeidbare Unterschied ist `template_id` (`mannequin` statt des nicht mehr verfügbaren `custom`).

**Animationen für die neue Figur:** laufen über denselben Endpunkt wie beim bestehenden Skript,
`POST /characters/animations`, `mode: "pixminimax"`, mit `character_id` der neuen Figur statt
einer bestehenden — keine Sonderbehandlung nötig, die `animation_group_id`-Logik ist identisch.

**Kostenabschätzung vor dem Call** (`GET /balance`, kostenlos, 08.11.): Tier-3-Abo
("Pixel Architect 2x"), **2385 von 18387** Generationen in der laufenden Periode noch frei, USD-
Guthaben 0 (Kosten laufen über die Abo-Generationen, nicht über USD). Laut OpenAPI-Beschreibung
des `mode`-Felds von `/characters/animations`: `pixminimax` kostet größenabhängig — "64x64 bei 8
Bildern = 1 Generation, 40 Bilder = 6" — macht für die vier Kanon-Gruppen (16/16/8/16 Aktionsbilder
× 3 Richtungen) überschlagen rund 25–35 Generationen, plus 1 Generation für die Basis-Figur selbst
(`mode: "standard"`). Das liegt weit innerhalb des verfügbaren Budgets — ein einziger, gut geplanter
Lauf statt mehrerer Versuche war damit vertretbar.

Quellen: `https://api.pixellab.ai/v2/openapi.json` (OpenAPI-Schema, direkt abgefragt),
`https://api.pixellab.ai/v2/llms.txt` (Endpunkt-Übersicht), `GET /balance` und `GET
/characters/{id}` (eigene Abfragen, 08.11., Platzhalter-Key über den Netzwerk-Proxy der Umgebung).

## Subjekt-Beschreibung für Kandidat 1 (`corsair-v2`)

Hält an der bestehenden thematischen Richtung fest (weiblicher augmented Elf-Mage/Spec-Ops-Hybrid,
dunkle Hightech-Rüstung, blaue Energie/Magie), betont zusätzlich die von Chris gewünschten Beine
und das Gesäß — Zielrichtung "austrainierte Kämpferin", nicht Erotik:

**Erzeugungs-Prompt (Basis-Figur, `description`):**

> Corsair, a female Elf Mage with Augmented and Spec Ops cybernetic enhancements. Sleek dark
> high-tech combat armor with glowing blue neon circuitry across the chest and forearms, a faint
> blue magical energy aura crackling around both raised hands. Athletic, powerfully built warrior
> physique: strong, clearly defined leg muscles and a toned, muscular rear, visible through
> form-fitting lower armor plating. Confident fighting stance. Full body pixel art character.

**Kurze Nominalphrase für die Animationen (`subject_description`, pixminimax):**

> an athletic augmented elf mage in dark high-tech armor with blue energy magic and strong,
> well-defined legs and glutes

**Angriffstext (statt des generischen Standard-Hiebs, passend zum Magie-Thema):**

> lunges forward and unleashes a surge of blue energy from both hands at an enemy in front, then
> returns to the starting pose

Zusätzlich strukturell (nicht nur Text) über `proportions` (Typ `custom`) leicht verstärkt:
`legs_length: 1.1`, `hip_width: 1.05` — eine bewusst moderate Verschiebung, damit die Figur bei
80×80 Pixeln noch zur übrigen Kanon-Statur der ~360 Figuren passt und nicht aus der Reihe fällt.

## Ergebnis Kandidat 1 (`corsair-v2`)

Lauf am 08.11. über `scripts/figuren-erzeuge-basis-charakter.py` (neu, committet — kopiert/angepasst
nach dem Muster von `figuren-bestelle-animationen.py`, verändert nichts an diesem Original):

- **Basis-Figur:** `pixellabId` `e963d988-fe09-4495-aa71-0aa85c807a9d`, Status `completed`,
  alle 8 Rotationen vorhanden (south/east/west/north + 4 Diagonalen), getaggt `corsair-v2`
  (nur Organisation bei PixelLab, keine Spielanbindung).
- **Vier Animationsgruppen**, alle `completed`, Richtungen south/east/north, Framezahlen exakt
  wie beim Kanon (= wie bei der alten `corsair`): walk 17, angriff 17, treffer 9, tod 17
  (Startbild + Kanon-Aktionsbilder).
  - walk: `gid 68a1ad4c-012d-47b4-aaa9-85aa02d86c4d`
  - angriff: `gid 12425d38-d64c-4737-bfbf-db948e33d8bd`
  - treffer: `gid 01084b28-fdab-4652-b6a4-6f0b2d60f98a`
  - tod: `gid daa0e14f-3b06-405d-adae-335bb353fa2f`
- **Kosten:** `GET /balance` vorher/nachher verglichen (direkt abgefragt, kein geschätzter Wert):
  2385 → 2366 von 18387 Abo-Generationen — **19 Generationen insgesamt** (1 für die Basis-Figur,
  bestätigt über `GET /background-jobs/{id}` → `usage: {generations: 1.0}`; die restlichen 18
  verteilen sich auf die vier `pixminimax`-Animationsgruppen × 3 Richtungen). Deutlich unter der
  vorab überschlagenen Spanne von 25–35 — ein einziger Lauf hat gereicht.
- **Neuer Index-Eintrag:** `data/generated/figuren-sprites.json` → Schlüssel `corsair-v2`
  (geprüft: der bestehende Schlüssel `corsair` ist byteidentisch zum Stand vor dem Lauf — das
  Einfüge-Skript bricht sonst ab, statt zu schreiben).
- **Dateien:** `public/sprites/figuren/corsair-v2/{south,east,west,north}.png` (Grundposen) und
  `{walk,angriff,treffer,tod}-{south,east,north}.png` (Animations-Streifen).
- **Vergleichsbild:** `docs/design/corsair-koerperform-kandidat-08-11-vergleich.png` (South-Idle-
  Pose + fünf Walk-Frames, alt über neu, 4x hochskaliert).

**Eine echte Abweichung vom Kanon, nicht nur kosmetisch:** die neue Figur hat **Canvas 112×112**,
nicht 80×80. Grund: der aktuell dokumentierte Endpunkt `create-character-with-8-directions`
interpretiert das `image_size`-Feld als "Charaktergröße", der Canvas wird laut OpenAPI-Beschreibung
automatisch "~40% größer, um Platz für Animationen zu lassen" — angefragt 80×80, geliefert 112×112
(112/80 = exakt 1,4). Die bestehenden ~360 Figuren (inkl. `corsair`) haben dagegen `size: {80,80}`
als tatsächlichen Canvas, über einen `template_id: "custom"`-Pfad, der in der aktuellen API-Version
nicht mehr als gültiger `template_id`-Wert dokumentiert ist — vermutlich ein älterer oder interner
Endpunkt, der die 40%-Aufschlagsrechnung nicht anwendet und inzwischen über die dokumentierten
Endpunkte nicht mehr reproduzierbar ist. Technische Konsequenz: `corsair-v2` ist als PNG-Datei
größer als die 80px-Kanon-Figuren. Optisch fällt das in der Vergleichsansicht nicht als Bruch auf
(die Engine skaliert ohnehin), aber bei einer echten Übernahme müsste entweder mit einem kleineren
angefragten `image_size` (rechnerisch ~57×57, um nach der 1,4-Aufschlagsrechnung wieder bei ~80
herauszukommen) neu erzeugt oder im Nachhinein auf 80×80 herunterskaliert werden.

**Warum Chris das zurückgewiesen hat:** `corsair-v2` wurde rein aus Text erzeugt (kein Bild als
Eingabe), über den nächstliegenden *aktuell dokumentierten* Endpunkt — das traf weder die Farben/
Form des Konzeptbilds noch die 80×80-Canvas-Vorgabe. Beides klärt Kandidat 2.

## Recherche 2: der tatsächliche Kanon-Weg (Git-Archäologie, ergab Kandidat 2, `corsair-v3`)

Chris bestand darauf, dass es **einen** dokumentierten, bereits genutzten Weg gibt, und wies auf
eine gezielte Suche hin statt eines weiteren Rateversuchs. Gefunden über die Git-Historie (nicht
über die aktuelle API-Doku, die diesen Pfad gar nicht mehr auflistet):

```
git log --all --oneline --since=2026-11-01 --until=2026-11-03
```

Commit `4b66f8156` — **„PixelLab-Figuren fuer 14 fehlende Spieler (Vigilante Wranglers /
Armageddon Aftermath)"**, 02.11., wörtlich: „Neu nach PixelLab-Kanon (`/create-character-pro`
80x80, `create_from_concept` mit rohem Portrait-JPG, template custom, kein name; Animationen
pixminimax)". Das ist der gesuchte Nachweis: **Endpunkt `POST /create-character-pro`**, Methode
`create_from_concept` (das rohe Portrait-JPG der Figur als Eingabebild, nicht nur Text!),
`template_id: "custom"`.

Bestätigt per `GET /characters/{id}` an vier so erzeugten Bestandsfiguren (`gram`, `elara`,
`cassandra`, `tidesprinter`): alle `size: {80,80}` exakt, `template_id: "custom"`, `view: "low
top-down"`, `style_settings` leer — identisch zum Muster, das `corsair` selbst zeigt. Das erklärt
auch, warum `template_id: "custom"` in der *aktuellen* OpenAPI-Beschreibung von
`create-character-with-8-directions` fehlt (dort nicht mehr gültig), aber bei `create-character-pro`
weiterhin ein aktiv unterstützter, dokumentierter Wert ist — ich hatte in Recherche 1 am falschen
Endpunkt nach dem Wert gesucht.

`/create-character-pro`-Schema (`https://api.pixellab.ai/v2/openapi.json`, Komponente
`CreateCharacterProRequest`), die fürs Ergebnis wichtigen Felder:

- `method: "create_from_concept"` — „`concept_image` (required) seeds the design; `reference_image`
  (optional) provides additional style guidance."
- `concept_image`: Base64Image, max 1024×1024 — **hier geht das echte Konzeptbild rein**, lokal
  `public/portraits/corsair.jpg` (400×400, weit unter dem Limit).
- `image_size`: 32–168px, „The persisted rotations share a square canvas whose side is at least
  max(width, height) and may grow up to 256 pixels to fit generated content." — bei 80×80 angefragt
  und den vier Referenzfiguren oben kam nachweislich exakt 80×80 heraus; anders als bei
  `create-character-with-8-directions` KEINE feste +40%-Aufschlagsrechnung. Trotzdem vor den
  (teuren) Animationen separat verifiziert, s. unten.
- `template_id: "custom"` — überspringt das 3D-Skelett ("such a character can't use skeleton-based
  animations"); unproblematisch, weil im ganzen Projekt ausschließlich die skelettfreie
  `pixminimax`-Animationsart bestellt wird.
- `style_character_id` (zusätzlich genutzt, über die dokumentierte Pflicht-Vorlage hinaus): „ID of
  one of your existing 8-direction characters to use as the style reference. Its 8 directional
  sprites guide the new character's style in every direction." Gesetzt auf die alte `corsair`
  selbst (`9f913ed5-…`) — verankert den Pixel-Art-Stil zusätzlich am bestehenden Hauskanon, während
  `concept_image` den eigentlichen Entwurf liefert.

Zweite, inhaltliche Spur (vom Koordinator eingebracht, unabhängig von der Endpunkt-Frage und
genauso bestätigt): `docs/design/figuren-checkin-07-11/batch1-beschreibungen.json` und
`docs/design/figuren-reparatur-nord-07-11.md` Abschnitt 1c, „Prompt-Qualität: Erst-267 Ø 163
Zeichen, Batch-93 Ø 440 Zeichen mit Körperbau, Material, Farbe, Requisit, Haltung … neue
Generierungen bekommen Prompts nach dem Batch-Muster." Per `GET` an denselben vier
Referenzfiguren nachgemessen: ihre gespeicherten `prompt`-Felder liegen bei 510–525 Zeichen und
benennen Körperbau, Material, Farbe, Requisit und Haltung einzeln und konkret (nie nur Klasse/Rasse
als Schablone) — exakt das Muster, nach dem die neue Corsair-Beschreibung unten gebaut ist.

Werkzeug: `scripts/figuren-erzeuge-basis-charakter.py` wurde um diesen Weg erweitert (Feld
`konzeptbild` in der `subjekte.json`-Eingabe schaltet `create-character-pro`/`create_from_concept`
scharf; ohne `konzeptbild` bleibt der alte Text-Weg aus Kandidat 1 als klar so benannter
Rückfall erhalten) sowie um `--nur-basis`/`--character-id`, um die Basis-Figur separat von den
Animationen zu erzeugen und zu prüfen — genau für den Zweck unten (Canvas-Verifikation vor der
teuren Stufe).

## Beschreibung für Kandidat 2 (`corsair-v3`)

Im Batch-93-Stil (Körperbau, Material, Farbe, Requisit, Haltung einzeln benannt), jedes von Chris
genannte Merkmal einzeln adressiert:

**Erzeugungs-Prompt (`description`, zusammen mit dem Konzeptbild als `concept_image`):**

> Corsair, a Mage of race Elf, archetype Augmented/Mage/Spec Ops. A slender, very athletic
> cyber-warrior in a skin-tight black segmented suit, glowing blue circuit lines through every
> segment, bright round blue energy cores on the chest and hip. At the calves and feet the suit
> dissolves into glowing blue flames instead of boots. A glowing blue horn-like headpiece with two
> backswept points, dark hair in a long ponytail, eyes glowing blue. Powerful fighting stance,
> weight on one leg, waist and hips defined, muscular athletic legs, holding a glowing blue energy
> orb in one raised hand. Full body pixel art character.

**Kurze Nominalphrase für die Animationen (`subject_description`, pixminimax):**

> a slender athletic female cyber-warrior in a tight black segmented suit with glowing blue energy
> circuit lines and bright energy cores at chest and hip, blue flames at the calves and feet, a
> glowing blue horn-like headpiece, dark ponytail, glowing blue eyes, holding a glowing blue
> energy orb

**Angriffstext:**

> lunges forward and unleashes a surge of glowing blue energy from the orb at an enemy in front,
> then returns to the starting pose

## Ergebnis Kandidat 2 (`corsair-v3`)

Zweistufig gefahren, wie oben beschrieben: erst nur die Basis-Figur (billig), Größe verifiziert,
erst danach die vier Animationsgruppen bestellt.

- **Basis-Figur:** `POST /create-character-pro` → `pixellabId`
  `35d0e3dd-fe2d-493e-9c38-32e750196d14`, Status `completed`. **`GET /characters/{id}` bestätigt
  `size: {width: 80, height: 80}` exakt** — vor den Animationen geprüft, keine Überraschung danach.
  Alle 8 Rotationen vorhanden. Getaggt `corsair-v3` (nur Organisation bei PixelLab).
- **Vier Animationsgruppen**, alle `completed`, Richtungen south/east/north, Framezahlen exakt wie
  Kanon: walk 17, angriff 17, treffer 9, tod 17.
  - walk: `gid f6610a34-b151-4eef-a84f-bbc9051cf197`
  - angriff: `gid 45c76a7d-dc23-463d-9645-ff82d0fbf9d7`
  - treffer: `gid 21612e72-80ee-4288-8d24-2d7892577944`
  - tod: `gid e72676b2-4d9e-4287-9674-54827e8aa110`
- **Kosten:** `GET /balance` vorher/nachher: 2366 → 2335 von 18387 Abo-Generationen — **31
  Generationen** für diesen Lauf (etwas mehr als Kandidat 1's 19, plausibel durch die
  Konzeptbild-Analyse von `create-character-pro`). Ein einziger, zweistufig kontrollierter
  Lauf hat gereicht — kein zweiter Versuch nötig.
- **Neuer Index-Eintrag:** `data/generated/figuren-sprites.json` → Schlüssel `corsair-v3`,
  `canvas: 80` (nicht 112 wie bei Kandidat 1). Programmatisch geprüft: `corsair` UND `corsair-v2`
  sind byteidentisch zum Stand vor diesem Lauf (362 statt 361 Einträge, nur `corsair-v3` neu).
- **Dateien:** `public/sprites/figuren/corsair-v3/{south,east,west,north}.png` und
  `{walk,angriff,treffer,tod}-{south,east,north}.png`.
- **Gesamtkosten beide Kandidaten:** 2385 → 2335 Generationen, also **50 von 18387** für die
  komplette Begutachtungsrunde (beide Basis-Figuren + je vier Animationsgruppen) — weiterhin
  überschaubar gegenüber dem Budget.

**Visuell trifft `corsair-v3` die Vorgaben sichtbar deutlich besser:** schwarzer segmentierter
Anzug, blaue Energielinien, heller Energiekern an der Brust, blaue Flammen an Unterschenkeln/Füßen,
hornartiger blau leuchtender Kopfschmuck, Energiekugel in der erhobenen Hand — alle von Chris
einzeln genannten Merkmale sind im 80×80-Sprite wiederzuerkennen (s. Vergleichsbild, das jetzt auch
das Referenzbild selbst zeigt).

## Vergleichsbild

`docs/design/corsair-koerperform-kandidat-08-11-vergleich.png` — vier Zeilen: Chris' Konzept-
Portrait, `corsair` (alt, unverändert), `corsair-v2` (Kandidat 1, verworfen), `corsair-v3`
(Kandidat 2, aktueller Vorschlag). Je South-Idle-Pose + fünf Walk-Frames, 4× hochskaliert.

## Was Chris jetzt entscheiden sollte

1. Trifft `corsair-v3` die Vorgaben aus dem Konzeptbild (Farben, Kopfschmuck, Flammen-Effekt,
   Energiekugel, Statur)?
2. Soll `corsair` auf `corsair-v3` umgestellt werden (Rename/Referenzänderung — bisher bewusst
   NICHT gemacht, s. unten)?
3. Falls noch Nacharbeit gewünscht ist (z. B. noch schlankere Taille, andere Haarfarbe/-länge):
   gezielte Korrektur an der `description` für einen dritten, ebenso kontrollierten Lauf statt
   diesen Kandidaten zu verwerfen — die Basis-Pipeline (Endpunkt, Canvas, Kosten) ist jetzt belegt
   und reproduzierbar.

Nichts davon wurde vorentschieden oder verdrahtet — weder `corsair-v2` noch `corsair-v3` ersetzen
an irgendeiner Stelle im Spiel die bestehende `corsair`-Figur.

## Was bewusst NICHT gemacht wurde

- Keine Verdrahtung ins Spiel: kein Rename, keine Referenzänderung an irgendeiner Stelle, die
  `corsair` nutzt. `corsair-v2` und `corsair-v3` sind reine Begutachtungskandidaten.
- `corsair-v2` wurde NICHT gelöscht, obwohl verworfen — dokumentiert den ersten, weniger treffenden
  Anlauf und bleibt als Beleg stehen, bis Chris entscheidet.
- Kein dritter Generierungsversuch "auf Verdacht" für `corsair-v3` — die Basis-Figur wurde separat
  erzeugt und auf 80×80 geprüft, BEVOR die teureren Animationen bestellt wurden, um genau das zu
  vermeiden (s. Budget-Vorsicht im Auftrag).
