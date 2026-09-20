# Kampf-Archetyp-Auflösung (Backlog #156, Schritt 1) — Klasse+Unterklasse+Traits → einer von 35 Kampf-Archetypen

Auftragsgrundlage: `docs/design/klassen-archetyp-konzept-20-09.md` (Branch
`fable-klassen-archetyp-20-09`), dort Abschnitt 3/4, "Schritt 1": `PLATZHALTER_ARCHETYP`
(`battle-mode.engine.js`) durch eine echte, deterministische Zuordnung ersetzen — ohne die
Basisattribute (`p.a`) anzufassen, ohne ein viertes Archetyp-System zu erfinden.

## 1) Was gebaut wurde

Eine reine Funktion `bestimmeKampfArchetyp(spieler)` (`lib/battle/combat-archetype-resolver.ts`),
die für Klasse+Unterklassen+Traits eines Spielers genau einen der 35 Kampf-Archetypen aus
`lib/battle/archetype-registry.ts` liefert. Sie verbindet drei bestehende Systeme, erfindet
keins:

1. **`player-generator/player-generator-archetypes.ts`** (14 breite Buckets: mage, beast,
   rogue, tank, warrior, social_icon, construct, undead, nature, demon, angel, pirate, ninja,
   mercenary) — bisher nur ein Würfel-Parameter, hier rückwärts angewendet: Klasse in
   `preferredClasses` (+3) / `disallowedClasses` (−6), je Unterklasse in
   `preferredSubclasses` (+2), je Trait in `preferredPositiveTraits`/`preferredNegativeTraits`
   (+1), je Identitäts-Schlüsselwort-Treffer (Klasse ODER eine Unterklasse, normalisiert
   „klein-mit-bindestrich") (+1,5). Der Bucket mit dem höchsten Score gewinnt; bleibt jeder
   Bucket bei 0 (kein einziges Kriterium traf), gilt der explizite Default `"warrior"` statt
   des ersten Objekt-Schlüssels.
2. **`lib/battle/subclass-archetypes.ts`** (`archetypenFuer()`, unverändert) — liefert die
   Kandidatenmenge: die Vereinigung der Archetypen aller Unterklassen des Spielers, oder —
   wenn ein Bildbefund vorliegt — dessen bereits verengte Liste.
3. **`lib/battle/archetype-registry.ts`** (unverändert) — die 35 Kampf-Karten selbst.

Die letzte Auswahl (Bucket → genau ein Kandidat) ist der einzige wirklich neue Code: ein
Skalarprodukt zwischen dem normierten hp/atk/def/spd-Profil jedes Kandidaten (Min-Max über
alle 35 Karten, sonst gewinnt `hp` jeden Vergleich allein durch die größere Zahlenspanne) und
einem aus `attributeBias` abgeleiteten Zielvektor. Die Attribut→Kampfachse-Abbildung
(`health→hp`, `power`+`torment`→`atk`, `speed`+`dexterity`→`spd`, `stamina`+`will`→`def`,
je zur Hälfte) ist eine explizite, dokumentierte Modellannahme (s. Kommentar an
`ZIEL_ABBILDUNG`), keine gemessene Größe — es gibt in den Karten keine Verbindung zwischen
den vier Kampfachsen und den zwölf Spielattributen.

Ein einzelner Kandidat ist trivial. Eine leere Kandidatenmenge (heute nur die
Datenrest-Unterklasse `"Klasse"` oder ein Spieler ganz ohne Unterklasse) fällt auf einen
dokumentierten, expliziten Default zurück (`STANDARD_ARCHETYP_ID = "fighter"` — bewusst
dieselbe Karte wie der alte Platzhalter, jetzt aber nur noch für die seltene Ausnahme statt
für die ganze Liga).

Deterministisch: reine Funktion der vier Eingabefelder, kein RNG, kein Speicherzustand.

### Verdrahtung in `battle-mode.engine.js`

Der Motor ist plain JS ohne Modulimport (`<script src>`, nicht gebündelt). Die statischen
Daten (Bucket-Kriterien+Zielvektoren, Unterklassen-Zuordnung, Bildbefunde, normierte
Kampfwerte je Archetyp) werden von `scripts/generiere-kampf-archetyp-daten.ts` aus denselben
drei TS-Quellen generiert und zwischen zwei Markern in den Motor geschrieben — exakt das
Muster von `scripts/generiere-arena-daten.ts` (BASIS_JE_DISC/SLOTS_JE_DISC). Die eigentliche
Auflösungsfunktion ist eine mechanische Kopie derselben Formeln direkt in `engine.js`
(Logik, keine Daten, deshalb nicht generiert). `scripts/pruefe-kampf-archetyp-abgleich.ts`
weist nach, dass beide Fassungen für dieselben echten Spieler dasselbe liefern (Abschnitt 3).

`baueEinheit()` (nur für TDM/Mini-DM/Battlefield — Feldspiel/Bühne/Bahn laufen über andere
Baufunktionen und rufen `baueEinheit()` nie auf) setzt jetzt `stunResist`/`knockbackResist`
aus dem aufgelösten Archetyp statt aus `PLATZHALTER_ARCHETYP`. Die Basisattribute `p.a`
bleiben unangetastet. `PLATZHALTER_ARCHETYP` bleibt als Sicherheitsnetz für `betWiderstand`/
`stossWiderstand` stehen (`??`-Fallback), falls ein Aufrufer `baueEinheit()` je umgeht.

## 2) Verteilung gegen den echten Spielstand — gemessen, nicht behauptet

`scripts/miss-kampf-archetyp-verteilung.ts` wendet die Funktion auf ALLE Spieler aller
Spielstände im live-save-Abbild an (20.888 Spieler über 7 Spielstände,
`OLY_APP_SQLITE_PATH=/tmp/abbild.sqlite`):

- **32 von 35 Archetypen** tatsächlich vergeben (nur Astralwing/Ember Priest/… mit
  Kleinstanteilen fehlen keinem strukturell, s. volle Tabelle im PR).
- **Höchster Anteil: Rogue mit 20,0 %** — kein einzelner Archetyp dominiert 90 %+, wie im
  Auftrag als Entartungsschranke genannt.
- Alle **14 breiten Buckets** kommen vor, von 14,5 % (rogue) bis 0,5 % (ninja) — die grobe
  Form folgt den Buckets, wie gefordert.
- **Fallback (leere Kandidatenmenge → Fighter): 1,01 %** (210 von 20.888) — ausschließlich
  die Datenrest-Unterklasse `"Klasse"` und Spieler ganz ohne Unterklasse. Dokumentiert, nicht
  still.

Volle Tabelle: `npx tsx scripts/miss-kampf-archetyp-verteilung.ts` gegen ein aktuelles Abbild.

## 3) Motor-Abgleich — liefert die JS-Kopie dasselbe wie die TS-Quelle?

`scripts/pruefe-kampf-archetyp-abgleich.ts` baut echte Kader (über `buildArenaTeam`, denselben
Adapter wie der Arena-Host) aus den ersten zehn Teams des live-save-Abbilds, lässt den echten
Motor (Playwright, `disziplinProbe("tdm", ...)`) den Archetyp jedes Spielers auflösen und
vergleicht das Ergebnis mit `bestimmeKampfArchetyp()` aus TypeScript, Name für Name.

**Ergebnis: 96 von 96 abgeglichenen Spielern identisch, 0 Abweichungen.**

## 4) Regressionsnachweis — bleiben die 17 Nicht-Arena-Disziplinen bit-identisch?

`node scripts/miss-alle-disziplinen.mjs 24`, Kader-Quelle `kaderfamilie-live-save.json`,
vorher (unveränderter `origin/main`-Stand, Commit `82cd85c4`) gegen nachher (dieser Branch) —
per `diff` verglichen, nicht nur überflogen:

```
17/17 Nicht-Arena-Zeilen byte-identisch:
speed-schach staffel spurt showcase eiskunstlauf takeshis-castle breaking wettessen
gewichtheben climbing fechten time-trial tennis basketball football i-spy hockey
(inkl. "davon nur Feldspieler" fuer Hockey)

Einzige Abweichungen im diff: die drei Arena-Zeilen (tdm/mini-dm/battlefield) — erwartet,
s. Abschnitt 5.
```

## 5) TDM/Mini-DM/Battlefield kaderfest — vorher/nachher gegen die erweiterte Kader-Familie

`OLY_KADER_FAMILIE=data/generated/kaderfamilie-arena-erweitert.json node
scripts/miss-alle-disziplinen.mjs 24 tdm mini-dm battlefield --bootstrap-unsicherheit`
(16 disjunkte Team-Paarungen, M0-Kaderfamilie, live-save vom 20.09.2026):

| Disziplin   | rho/Spiel vorher | Spannweite vorher | rho/Spiel nachher | Spannweite nachher | Bewegung |
|---|---:|---:|---:|---:|---|
| TDM         | 0,104 | 0,563 | 0,169 | 0,488 | +0,065 — innerhalb beider Spannweiten |
| Mini-DM     | 0,153 | 0,988 | 0,119 | 1,100 | −0,034 — innerhalb beider Spannweiten |
| Battlefield | 0,325 | 0,737 | 0,313 | 0,929 | −0,012 — innerhalb beider Spannweiten |

90-%-Bootstrap-CI über den Median (16 Paarungen, 2000 Ziehungen) überlappt in allen drei
Fällen deutlich (TDM [0,023–0,261] vorher vs. [0,086–0,266] nachher; Mini-DM [0,056–0,403]
vorher vs. [0,023–0,271] nachher; Battlefield [0,183–0,460] vorher vs. [0,201–0,460] nachher).

**Ehrlicher Befund: keine der drei Bewegungen verlässt die eigene Kader-Spannweite** — das
ist der Maßstab aus `docs/design/arena-zielwahl-umsetzung.md` Abschnitt 3 für "nicht nur ein
kleiner Median-Wackler, sondern eine echte Verschlechterung". Nach diesem Maßstab ist Schritt 1
weder eine Verbesserung noch eine Verschlechterung — alle drei bleiben weit unter der
0,80-Schranke, mit oder ohne Archetyp-Auflösung. Das ist plausibel: `stunResist`/
`knockbackResist` beeinflussen nur, wie oft Betäubung/Rückstoß greifen, nicht die
grundlegende Eignungs-/Zielwahl-Mechanik, die laut `klassen-archetyp-konzept-20-09.md`
Abschnitt 0.5/2 die eigentliche rho-Bremse ist. Committet wird trotzdem, weil (a) keine
Verschlechterung vorliegt und (b) Schritt 1 laut Konzept die Voraussetzung für jeden
weiteren Schritt ist ("welcher Archetyp ist dieser Spieler" als Eingabe).

**Wichtiger Vorbehalt zu BEIDEN Zeilen dieser Tabelle (vorher UND nachher):** ein paralleler
Fund (Branch `fix-persof-kadersetzen-20-09`, noch nicht gemerged) zeigt, dass `persOf` (die
KI-Persönlichkeits-Herleitung) im Mehrpaarungs-Pfad (`disziplinProbe(d,{kaderFamilie})`, genau
der Pfad, den `miss-alle-disziplinen.mjs` nutzt) nur beim allerersten Kader-Laden berechnet
wird und nie neu — jeder Kämpfer außer denen der ersten Paarung fällt auf die generische
"Duellant"-Persönlichkeit zurück, statt seine echte KI-Persönlichkeit zu bekommen. Beide
Messungen oben (vorher UND nachher) liefen unter diesem Bug, betreffen also den Vergleich
selbst nicht (beide Seiten gleich betroffen), verzerren aber die ABSOLUTEN Zahlen in dieser
Tabelle gegenüber einer Messung mit echten Persönlichkeiten. Diese PR fixt `persOf` NICHT
(separate Verantwortung) — nach dessen Merge sollte diese Tabelle neu gezogen werden.

## 6) Was das NICHT ist

- Kein Klassenaufschlag in `aufEignung`/`gewichtet()` (Schritt 2 des Konzepts) — die
  Basisattribute und die Eignungsformel bleiben für alle 20 Disziplinen exakt, wie sie waren.
- Keine Attribut-Umverteilung (Schritt 3/Option A) — nichts an `p.a` geändert, in keiner
  Disziplin.
- Kein neues, viertes Archetyp-System — nur die drei bestehenden verbunden.
- Keine Aussage darüber, ob CC (Betäubung/Rückstoß) im aktuellen Motor überhaupt oft genug
  auslöst, um spürbar zu wirken, oder ob eine Mono-Tank-/Mono-Assassinen-Aufstellung sich
  dadurch wirklich anders schlägt — das ist die in Abschnitt 2 des Konzepts vorgeschlagene
  Konter-Play-Sonde, ein separater, noch nicht gebauter Schritt.
