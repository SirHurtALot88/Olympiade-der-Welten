# Sprite-Fit-Bewertungssystem

> Redaktionsnotiz (01.09.): Dieses Dokument wurde ursprünglich auf Branch
> `claude/sprite-fit-rating-system` angelegt (noch nicht nach `main` gemerged, als dieser
> Commit hier entstand). Der Auftrag für diesen Commit ging davon aus, dass es auf `main`
> bereits existiert — es lag stattdessen nur auf jenem Branch. Der folgende Text bis
> einschließlich "Grundsatz: Bild schlägt Tags" ist deshalb unverändert von dort übernommen,
> nicht neu verfasst; nur der letzte Abschnitt "Grundsatz: Assets werden nie exklusiv
> reserviert" ist neu. Der Querverweis auf `sprite-fit-ergebnisse.md` unten zeigt auf eine
> Datei, die ebenfalls nur auf jenem Branch liegt — sie löst sich auf, sobald beide Branches
> zusammengeführt sind.

Wie gut trifft das im Battle Mode gebaute Sprite-Rezept (`BAU`-Tabelle in
`public/mockups/battle-mode.engine.js`, oder `vollbild:"..."` für eigenständige Illustrationen)
das Konzept-Portrait (`public/portraits/<slug>.jpg`) desselben Charakters? Dieses Dokument legt
eine 1-5-Sterne-Rubrik dafür fest, damit Bewertungen über verschiedene Runden und Bearbeiter
hinweg vergleichbar bleiben — nicht nur ein Gefühl im Kopf eines einzelnen Betrachters.

Ausgangspunkt waren Chris' eigene Kalibrierpunkte (siehe unten); die Definitionen sind so
geschärft, dass sie diese Punkte konsistent reproduzieren.

## Die fünf Stufen

**★★★★★ (5) — Vollständiger Treffer.**
Körpertyp/Rasse/Silhouette stimmen, UND die spezifischen Details, die den Charakter einzigartig
machen — Krone, Requisiten, Rüstungsfarbe/-material, markante Anhängsel, Flügelform, Waffe —
sind im Rezept sichtbar abgebildet. Nichts Charakteristisches fehlt, das ein Betrachter des
Portraits im Sprite vermissen würde.
*Anker:* King Arlen Morgolor — älterer menschlicher König, glänzende goldene Rüstung, Krone: alles
davon ist im Sprite da.

**★★★★ (4) — Grundidentität korrekt, ein Detail fehlt.**
Körpertyp/Rasse/allgemeiner Look ist richtig getroffen, aber GENAU EIN markantes, klar
benennbares Merkmal fehlt oder ist falsch — eine punktuelle Korrektur (ein Layer, eine Textur,
eine Farbe) würde auf 5 Sterne heben. Der Unterschied zu 3 Sternen ist die Zahl der fehlenden
Details: bei 4 Sternen lässt sich der Fix in einem Satz benennen, bei 3 Sternen sind es mehrere
Baustellen oder eine grundsätzlich zu grobe Annäherung.
*Anker:* Krolach — Standard-Construct-Look ohne die Kristallstacheln aus dem Portrait. Mit
Stacheln wäre er eine 5, ohne bleibt er eine 4 — das fehlende Detail lässt sich exakt benennen.

**★★★ (3) — Grobe Kategorie stimmt, spürbar generisch.**
Die grobe Kategorie ist richtig (z.B. "irgendein Monster", "irgendein Ritter", "irgendeine
Magierin"), aber das Rezept ist eine reine Näherung: mehrere charakteristische Details fehlen,
oder es wirkt wie ein austauschbarer Vertreter seiner Kategorie statt wie der spezifische
Charakter. Anders als bei 4 Sternen lässt sich der fehlende Punkt nicht in einer einzigen
Korrektur zusammenfassen.

**★★ (2) — Kategorie verfehlt, aber thematischer Bezug vorhanden.**
Körpertyp/Kategorie passt kaum oder ist stark verfälscht — ein klar nicht-humanoides Konzept wird
z.B. als Standard-Humanoid mit bloßem Kopf-Tausch dargestellt. Es gibt aber noch einen
erkennbaren Bezug: richtige Farbfamilie, thematisch verwandtes Element, grobe Silhouette-Analogie.
Ein Betrachter, der Portrait und Sprite nebeneinanderlegt, erkennt "das soll wohl das sein",
auch wenn die Umsetzung strukturell falsch ist.

**★ (1) — Kein sinnvoller Bezug / strukturell unmöglich.**
Das Portrait zeigt etwas fundamental außerhalb des aktuellen Baukastens — ein echtes Tier, ein
unbelebtes Objekt (Schiff, Maschine), ein rein mechanisches Wesen ohne Humanoid-Analogie — und
das aktuelle Sprite hat keinen erkennbaren Zusammenhang dazu, meist weil es schlicht der
generische Standard-Humanoid ohne jede thematische Anpassung ist.
*Anker:* Vigil (Taube mit Kamera-Objektiv) und ein Schiff-Charakter (Kreischende Kogge) — beides
Konzepte, für die der Humanoid-Baukasten strukturell nichts hergibt.

> Update 01.09.: Vigil ist mittlerweile behoben (`vollbild:"taube"` + prozedurale
> Kamera-Requisite, s. `BAU["Vigil"]` in `battle-mode.engine.js`) und damit kein 1-Stern-Anker
> mehr im aktuellen Stand — als Definitions-Anker für "strukturell unmöglich" bleibt das
> Beispiel trotzdem gültig, es beschreibt den Zustand VOR dem Fix.

## Abgrenzung 4 vs. 3 vs. 2 (die schwierigen Übergänge)

- **4 vs. 3**: Lässt sich der Rückstand in EINEM Satz als EIN nachrüstbares Element beschreiben
  ("Kristallstacheln fehlen", "Krone fehlt", "Flügel sind falsche Farbe")? → 4. Braucht es mehrere
  unabhängige Korrekturen oder eine grundsätzlich andere Bauweise? → 3.
- **3 vs. 2**: Ist die grobe Kategorie (Mensch/Monster/Konstrukt/Tier-artig) noch richtig, nur die
  Ausführung generisch? → 3. Ist die Kategorie selbst falsch (nicht-humanoides Wesen wird als
  Standard-Mensch mit Kopf-Swap gebaut, oder umgekehrt)? → 2.
- **2 vs. 1**: Gibt es noch IRGENDEINEN erkennbaren Bezug (Farbe, Thema, grobe Form)? → 2. Ist der
  Bezug komplett verschwunden, weil das Konzept strukturell außerhalb des Systems liegt (Tier,
  Objekt, Maschine) und das Sprite nur der neutrale Standard-Humanoid ist? → 1.

`fehlendesDetail` wird nur bei 3 und 4 Sternen ausgefüllt (bei 4 Sternen so konkret wie möglich,
bei 3 Sternen darf es eine kurze Sammelkategorie sein); bei 1, 2 und 5 Sternen ist es `null`, weil
entweder nichts Punktuelles zu benennen ist (1/2 — der Fehler ist strukturell) oder nichts fehlt (5).

## Anwendung

Für jeden Charakter aus `data/generated/battle-arena-sprite-gallery.json` wird das Portrait
(`public/portraits/<slug>.jpg`) direkt neben der aktuellen Sprite-Vorschau
(`public/sprites/preview/<slug>.png`) betrachtet und nach obiger Rubrik bewertet. Ergebnis:
`data/generated/sprite-fit-bewertung.json`, Liste von:

```json
{ "name": "...", "slug": "...", "sterne": 1-5, "begruendung": "...", "fehlendesDetail": "..." }
```

Die vollständige Auswertung der ersten Bewertungsrunde (Verteilung, Triage-Listen für 1-Stern-
und 4-Stern-Fälle) steht in [`sprite-fit-ergebnisse.md`](./sprite-fit-ergebnisse.md).

## Grundsatz: Bild schlägt Tags (Chris, 01.09.)

Wenn Konzept-Portrait und die Daten-Tags eines Charakters (Rasse `r`, Unterklasse `sub`, o.ä.)
sich widersprechen — wie bei Krolach, dessen Portrait einen Eis-/Kristall-Koloss zeigt, während
sein Sprite über Jahre einem grünhäutigen Troll-Humanoid folgte, ohne dass das je auffiel —
**gilt IMMER das Bild als Wahrheit für die Optik, nie die Tags.** Tags dürfen an das Bild
angepasst werden (wie bei Krolachs Umstellung auf `Behemoth`/`Warrior`, passend zum jetzt
korrekt gebauten Golem-Vollbild), aber niemals umgekehrt — das Sprite folgt nie den Tags gegen
das Bild.

Bei jedem gefundenen Widerspruch dieser Art: einen Remark/Kommentar im Code UND (falls die
Bewertung betroffen ist) einen Hinweis im `begruendung`-Feld der Sprite-Fit-Bewertung hinterlassen,
der explizit sagt "Bild und Tags widersprechen sich" — nicht stillschweigend nach eigenem
Ermessen zwischen beiden vermitteln.

## Grundsatz: Assets werden nie exklusiv reserviert (Chris, 01.09.)

Anlass war Vigil (Taube mit Überwachungskamera als Kopf): "[LPC] Birds" enthält keine Taube, und
die drei gefundenen Ein-Richtungs-Tauben-Sprites auf itch.io hatten jeweils nur über verlinkte
Zusatzseiten prüfbare Lizenzen. Ein früherer Agent hatte deshalb recherchiert, aber nichts
eingebaut — "kein perfektes Asset gefunden" blieb als Endergebnis stehen. Chris' Reaktion:

> "Entweder machst du den dann halt in 2 Richtungen oder den ähnlichsten der 15 Vögel nehmen,
> Spieler reservieren ja keine Assets nur für sich alleine! [...] wir wollen nie mehr das mit
> den besten Näherungswerten haben [...] 2 Richtungen ist nicht perfekt, aber besser als nichts,
> wenn es dafür wenigstens eine Taube ist [...] so sollst du das dann bei allen auch immer
> handhaben."

Zwei Regeln folgen daraus, ab sofort für JEDEN Sprite-Fix-Auftrag verbindlich:

1. **Keine Asset-Exklusivität.** Dieselbe Bild-/Sprite-Quelle darf für beliebig viele Charaktere
   verwendet werden. Dass ein Blatt schon einem anderen Charakter zugeordnet ist, ist KEIN Grund,
   es für einen weiteren Charakter zu verwerfen — solange es die bessere Annäherung ist als das,
   was der Charakter aktuell hat. (Konkret bereits so gehandhabt: `bird_1_brown` einerseits für
   Seraph-11 als Reiher-Näherung, dasselbe `[LPC] Birds`-Paket andererseits schon für die Deko in
   `public/sprites/arena/vogel_adler.png` — eine Quelle, mehrere Verwendungen, ohne Konflikt.)

2. **Eine unvollständige Näherung schlägt immer keinen Fix.** Eine Richtung statt vier (gespiegelt
   für die zweite Seite, grobe Notlösung für die restlichen zwei), die ähnlichste von mehreren
   verfügbaren Arten statt eines exakten Treffers, ein Körpertyp, der nur die Silhouette trifft
   und nicht die spezifischen Details — all das wird eingebaut und im Code dokumentiert, nicht
   liegengelassen. "Kein perfektes Asset gefunden, also nichts eingebaut" ist ab sofort **keine
   akzeptable Endmeldung mehr** für einen Sprite-Fix-Auftrag. Die Dokumentationspflicht bleibt
   unverändert bestehen (Kommentar im Code, `quellen.json`-Eintrag, ggf. Hinweis im
   `begruendung`-Feld der Sprite-Fit-Bewertung) — dokumentiert wird die Lücke, nicht vertuscht,
   aber sie blockiert den Fix nicht mehr.

Beispiel für Regel 2, direkt aus demselben Auftrag: Seraph-11 (mechanischer Reiher/Storch) trifft
keiner der 15 Vögel in `[LPC] Birds` körperlich — alle 15 sind kompakte Kleinvögel ohne langen
Hals oder lange Beine. Eingebaut wurde trotzdem die ähnlichste der 15 (`bird_1`, die schlankste
und spitzschnäbligste der drei Grund-Körpertypen), mit dokumentierter Begründung im BAU-Kommentar
und in `public/sprites/vogel/quellen.json` — nicht der vorher vorgemerkte, aber körperlich
unpassende Weißkopfseeadler, und nicht "gar kein Vogel".
