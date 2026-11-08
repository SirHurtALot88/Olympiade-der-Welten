# Corsair-Körperform-Kandidat (08.11.)

## Auftrag

Chris, zum Konzept-Portrait von Corsair (dunkle Hightech-Rüstung, blaue Neon-/Magie-Energie um
die Hände, sehr definierte, austrainierte Beine und Gesäß) neben dem winzigen PixelLab-Sprite im
Spiel: „bekommt man es hin die krassen kurven von corsair besser im charakter abzubilden? die
beine und der po? sind sehr gut trainiert." Auf Nachfrage, ob eine neue Version vor dem Löschen
der alten probiert werden soll: „ja versuch corsair in ner besseren version zu erstellen lösche
die alte noch nicht."

Harte Vorgabe: die bestehende Figur (`corsair`, `pixellabId` `9f913ed5-a980-40c8-81b5-af5fcd7c42c9`)
bleibt unangetastet. Dieser Kandidat ist ein **zusätzlicher** Eintrag `corsair-v2` zur Begutachtung.

## Recherche: PixelLab-v2-API, Basis-Charaktererzeugung

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

## Neue Subjekt-Beschreibung

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

## Ergebnis

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

## Was Chris jetzt entscheiden sollte

Das Vergleichsbild zeigt einen klaren Unterschied: `corsair-v2` ist sichtbar erwachsener und
athletischer gezeichnet als die alte, eher kindlich-rundliche "Chibi"-Statur — Taille, Hüfte und
Beine sind im engen Anzug deutlich als Körperform zu erkennen, nicht nur als Rüstungsblock. Ob das
genau die "krassen Kurven" trifft, die Chris am Konzept-Portrait meinte, und ob der insgesamt
andere Zeichenstil (detaillierter, weniger kompakt als die übrigen ~360 Figuren) neben den anderen
Figuren im Spiel noch passt, ist eine Geschmacks-/Konsistenzfrage, die nur Chris selbst
beantworten kann — dafür ist dieser Kandidat gedacht. Fragen zur Entscheidung:

1. Trifft die Körperform/Statur die gewünschte Richtung (Beine/Gesäß definierter)?
2. Ist der insgesamt detailliertere, weniger "chibi"-artige Zeichenstil gewollt, oder fällt die
   Figur dadurch zu sehr aus dem Rahmen der übrigen ~360 (die durchweg die kompaktere, gleichmäßig
   stilisierte Kanon-Statur haben)?
3. Falls ja: soll `corsair` auf diesen Kandidaten umgestellt werden (inkl. Nacharbeit am Canvas,
   s. oben), oder soll mit angepasster Beschreibung/Proportionen ein weiterer Versuch gemacht
   werden?

Nichts davon wurde vorentschieden oder verdrahtet — `corsair-v2` ersetzt an keiner Stelle im Spiel
die bestehende `corsair`-Figur.

## Was bewusst NICHT gemacht wurde

- Keine Verdrahtung ins Spiel: kein Rename, keine Referenzänderung an irgendeiner Stelle, die
  `corsair` nutzt. `corsair-v2` ist ein reiner Begutachtungskandidat.
- Kein zweiter Generierungsversuch "auf Verdacht" — bei einem Fehlschlag wäre das Ergebnis trotzdem
  ehrlich gezeigt worden statt beliebig oft nachzugenerieren (s. Budget-Vorsicht im Auftrag).
