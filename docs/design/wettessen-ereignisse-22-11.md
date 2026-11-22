# Wettessen-Rework: Ereignisse statt Zähler — Konzept und Mockup (22.11.)

**Reine Konzeptrunde. Kein Engine-Code geändert, nichts bestellt, nichts gemessen.**
Auftrag (Arbeitsliste 21.11., Welle 4): statt eines hochlaufenden Zählers echte Ereignisse.

- Mockup (klickbar): `public/mockups/wettessen-ereignisse-22-11.html`
- Aufnahmen: `docs/design/wettessen-ereignisse-22-11/` (1920×1080, 2560×1440, 1710×1112)

Die Zahlen im Mockup kommen aus einer **Schau-Simulation** im Mockup selbst (Startwerte dieses Papiers, echte
Attribute aus `data/generated/oly-player-attributes.json`, Beispielkader). Sie sind keine Messung.

---

## 1. Ist-Stand (gelesen, nicht geändert)

| Baustein | Stand im Motor (`public/mockups/battle-mode.engine.js`) |
|---|---|
| Format | Coney-Island-Tafel: 6 gegen 6, alle essen gleichzeitig, 10 Minuten = 10 Durchgänge (`BUEHNE_ART.wettessen`, `rundenN:10`) |
| Je Minute | **ein Wurf** je Esser: „schlingt durch“ oder „muss kurz pausieren“ (Minute zählt dann 65 %) |
| Mauer + Haltung | live seit 04.10. (`BUEHNE_FLAGS.wettessenMauer=2`, `wettessenMauerRunden()`): Füllstand über Kapazität → Mauer; Haltung Sprint / Gleichmäßig / Schlussspurt; Team-Vorlage seit 17.11. |
| Anzeige | Teamstand in der Einheit des Gerichts, je Esser ein Zähler, der hochläuft |
| Abnahme | rho je Spiel 0,905, Saison 0,958, Pp 8,7 / 10,0 (bzw. 13,6 / 14,7 bei n=48) — der **komfortabelste** Puffer aller Bühnen |

**Das Problem ist nicht die Rechnung, sondern die Erzählung.** Unter der Haube passiert je Esser zehnmal
etwas; zu sehen ist eine Zahl, die steigt. Es gibt genau zwei Wörter („schlingt durch“, „pausiert“), und
warum einer pausiert, erfährt niemand. Von den sechs Matrix-Attributen ist nur „Ausdauer → Mauer“ sichtbar.

Daraus folgt die Linie dieses Konzepts: **das statistische Gerüst bleibt** (zehn unabhängige Durchgänge je
Esser — genau das macht Wettessen so rangtreu), aber jeder Durchgang endet in einem **benannten Ereignis mit
Ursache und Rettungsweg**.

---

## 2. Die Regeln

### 2.1 Zehn Gänge

Aus „Minute“ wird **Gang**: jede Runde kommt eine Platte auf den Tisch (Knödel, Bratwurst, Haxe …). Gang 4 und
Gang 8 sind **Höllengänge** (scharf, im Mockup „Höllen-Chili“). Die Gangleiste im Kopf zeigt, wo man steht und
was kommt.

Gezählt werden **Teller** statt Punkte: 1 Teller = 25 Wertungspunkte (Startwert; im Bau die bestehende
„Einheit des Gerichts“ weiterverwenden). Gebucht wird weiter die Punktsumme, gezeigt wird sie in Tellern —
gezeigt = gebucht, nur in einer Einheit, die man sich vorstellen kann. Vor jedem Esser wächst der Stapel
leerer Teller.

### 2.2 Jeder Gang endet in einem Ereignis

| Ereignis | Wann | Wirkung (Startwerte) |
|---|---|---|
| **Teller leer** | Wurf gelingt | voller Gang plus normaler Bonus |
| **Räumt ab** | Wurf gelingt deutlich (unteres 40-%-Stück der Erfolgsspanne) | voller Gang plus großer Bonus |
| **Schluckauf** | Wurf misslingt, vor der Mauer | Störung, Rettung über TECHNIK |
| **Krampf** | Wurf misslingt, hinter der Mauer | Störung, Rettung über AUSDAUER |
| **Würgen** | Wurf misslingt deutlich | schwere Störung, Rettung über NERVEN — sonst **Strafe** |
| **Brennen** | Wurf misslingt im Höllengang | Störung, Rettung über WAGNIS |
| **Zweite Luft** | einmal je Esser, frühestens im Gang nach der Mauer | zwei Gänge ohne Mauer-Abzug |
| **Strafe** | Würgen nicht gerettet | der Schiedsrichter pfeift, der Teller wird aberkannt (Gang zählt 20 %) |

**Störung und Rettung** ersetzen den heutigen Pauschalabzug (65 %):

- **gerettet** → der Gang zählt 85 % („atmet ihn weg“, „läuft sich frei“, „hält es drin“, „isst durch“)
- **nicht gerettet** → der Gang zählt 50 % („verliert den Takt“, „muss absetzen“, „greift zum Wasser“)
- Würgen nicht gerettet → 20 % und Strafe

Bei einer Rettungsquote um 60 % liegt der Mittelwert bei 0,71 statt 0,65 — nahe am heutigen Stand, der Rest ist
Kalibrierung. **Ob** ein Gang misslingt, entscheidet derselbe Wurf wie heute; **welche** Störung es ist,
ergibt sich ohne weiteren Wurf aus der Lage (Höllengang? hinter der Mauer? wie weit daneben?). Neu ist genau
**ein** zusätzlicher Wurf je misslungenem Gang: die Rettung.

### 2.3 Mauer und Zweite Luft

Die Mauer bleibt, wie sie ist (Füllstand über Kapazität, Kapazität aus AUSDAUER). Neu ist die **Zweite Luft**:
im Gang nach der Mauer wird einmal geprüft (Chance aus PUBLIKUM = Wille 50, Entschlossenheit 50; Startwert
`(PUBLIKUM − 40)/70`, gedeckelt 10–70 %). Gelingt es, isst er zwei Gänge ohne Mauer-Abzug — die Figur leuchtet
gold, das Publikum trägt ihn. Das ist der Moment, den das echte Wettessen hat und unser Zähler nicht.

### 2.4 Der Höllengang

Gang 4 und 8: die Grundmenge wird mit `0,75 + WAGNIS × 0,005` gewichtet (WAGNIS 50 → 1,00; 80 → 1,15;
30 → 0,90), die Erfolgschance sinkt um 0,08, jede Störung heißt „Brennen“ und wird über WAGNIS gerettet. Damit
bekommt **Qual** (Matrix 6) einen sichtbaren Auftritt: wer Schmerz gewohnt ist, isst durch.

### 2.5 Was die Schau-Simulation zeigt (keine Messung)

Acht Probeläufe: 120 Gang-Ergebnisse je Spiel, davon rund drei Viertel sauber (Teller leer / Räumt ab), 25–35
Störungen (etwa die Hälfte gerettet), 2–5 Strafen, 2–5 Zweite-Luft-Momente, die Mauer kommt für die meisten in
Gang 6–7. Die Teamstände lagen dicht beieinander (z. B. 200 : 194 Teller).

---

## 3. Welche Attribute welche Ereignisse treiben

Matrix für Wettessen (`official-discipline-weights.ts`, **nur gelesen**): Wille 26, Gesundheit 22, Ausdauer 22,
Entschlossenheit 16, Intelligenz 8, Qual 6. Kein Charisma — das Publikum feuert an, aber der eigene Wille
nimmt den nächsten Bissen.

Es wird **kein neues Rezept** gebaut; alle Kanäle lesen die bestehenden Teilwerte aus
`BUEHNE_ART.wettessen.rezept`:

| Teilwert (besteht) | Rezept | Treibt |
|---|---|---|
| GRUNDLAGE | Ausdauer 40, Gesundheit 35, Wille 25 | Menge je Gang — der **Hauptweg** |
| AUSDAUER | Ausdauer 50, Gesundheit 30, Wille 20 | wann die Mauer kommt; **rettet den Krampf** |
| NERVEN | Wille 45, Gesundheit 35, Entschlossenheit 20 | wie hart die Mauer bremst; **rettet das Würgen** |
| TECHNIK | Intelligenz 45, Entschlossenheit 30, Gesundheit 25 | Erfolgschance; **rettet den Schluckauf** |
| WAGNIS | Qual 50, Ausdauer 30, Intelligenz 20 | Höllengang; **rettet das Brennen** |
| PUBLIKUM | Wille 50, Entschlossenheit 50 | **Zweite Luft** |
| SPITZENMOMENT | Qual 45, Wille 30, Entschlossenheit 25 | Bonus bei „Räumt ab“ |

### Mehrere Wege zum Erfolg

| Weg | Wer | Wie |
|---|---|---|
| **Hauptweg: der Vielfraß** | Ausdauer, Gesundheit, Wille | große Menge, späte Mauer, wenige Störungen |
| Nebenweg: der Techniker | Intelligenz | isst nicht mehr, verliert aber fast nichts an Schluckauf |
| Nebenweg: der Zähe | Entschlossenheit, Wille | steht früh an der Mauer, holt sich aber die Zweite Luft |
| Nebenweg: der Schmerzfreie | Qual | macht in den zwei Höllengängen Boden gut |

Die Nebenwege sind bewusst kleiner als der Hauptweg (zwei Höllengänge von zehn, eine Zweite Luft je Spiel):
die Matrix muss durchkommen, und dort wiegen Wille, Gesundheit und Ausdauer zusammen 70 von 100.

---

## 4. Anzeige (Mockup)

| Bereich | Inhalt |
|---|---|
| Kopf | Teamstand in Tellern, „Gang 7 / 10“, Gericht, je Team „n an der Mauer · n Strafen“; darunter die **Gangleiste** mit markierten Höllengängen |
| Tafel | zwölf Esser hinter der langen Tafel, vor jedem der aktuelle Teller und sein **Stapel leerer Teller** mit Zahl; im Höllengang glühen die Teller |
| über den Köpfen | die **Ereignis-Blase** des Gangs: Zeichen, Wort, Folge („+3,5 Teller“, „hält es drin“, „Teller aberkannt“) |
| Karte je Esser (in der Spalte unter der Figur) | Name, Teller, Zustand (Magen in % / Mauer seit Gang n / Zweite Luft), **Magen-Balken** mit Mauer-Marke, **zehn Kästchen** in Ereignisfarbe — die Geschichte seines Abends auf einen Blick |
| links oben | Legende „Ereignisse und Wege: wer rettet was“ (im Spiel einklappbar) |
| rechts oben | Verlauf: nur das Bemerkenswerte (Mauer, Zweite Luft, Strafe, missglückte Rettung) |
| Einblender | STRAFE, ZWEITE LUFT, AN DER MAUER — höchstens einer je Gang |
| Endstand | Tabelle je Esser: die zehn Gänge als Farbleiste, Teller, Mauer in Gang, Zweite Luft, Störungen, gerettet, Strafen, PP (im Bau sortierbar) |

**Figuren, nur Bestand:**

| Moment | Vorhandene Pose |
|---|---|
| isst | `south` (Standbild) mit zwei Pixel Kau-Wippen per Code — keine Animation |
| Störung (Schluckauf, Krampf, Würgen, Brennen) | `treffer-south`, bei missglückter Rettung zusätzlich kurzes Rütteln |
| Räumt ab, Zweite Luft | `angriff-south` einmal als „haut rein“ |
| an der Mauer | Figur entsättigt; Zweite Luft: goldener Schein |
| Strafe | Schiedsrichter (`__schiri`, vorhandene `pfiff`-Animation) pfeift |

Keine neue Figur, keine neue Animation. Eine echte Ess-Pose gibt es nicht und wird hier **nicht** vorgeschlagen.

**PixelLab-Requisiten — Vorschlag mit Schätzung, nichts bestellt:**

| Posten | Schätzung |
|---|---:|
| Lange Tafel mit Tischtuch (Vordergrund, ersetzt den CSS-Platzhalter), je Kulisse eine Variante (Bierzelt, Jahrmarkt, Nachtmarkt) | 3–4 Generationen |
| Gerichte auf dem Teller (8 Stück: Knödel, Bratwurst, Haxe, Chili, Brezn, Kraut, Leberkäs, Schmarrn) | 8–10 |
| Tellerstapel (leer, 3 Höhen), Wasserkrug, Eimer, Tischglocke, Serviette | 5–6 |
| Ereignis-Zeichen als kleine Requisiten-Icons (8 Stück) | 4–8 |
| Stilproben, Ausschuss | 5 |
| **Summe** | **rund 25–33** |

Vorhanden und im Mockup genutzt: `public/sprites/kulissen/wettessen/bierzelt.jpg`,
`public/sprites/arena/wettessen_teller_normal.png`. Tafel, Tellerstapel und Ereignis-Zeichen sind im Mockup
CSS/SVG-Platzhalter.

**Abgleich der Bildschirme** (selbst angesehen): 1920×1080 und 2560×1440 ohne Scrollen, ohne Überlappung;
1710×1112 nutzt die zusätzliche Höhe für die Kulisse. Bekannte Schwächen des Mockups: das Tischtuch ist als
Platzhalter zu flächig; lange Namen werden in der Karte gekürzt („Petra Brezel…“); die Folgezeile unter der
Blase ist auf hellem Boden schwächer lesbar als die Blase selbst.

---

## 5. Risiko für rho und Pp, Messplan

### 5.1 Einschätzung

Wettessen hat den größten Puffer (0,905 gegen die Schranke 0,75; Pp um 9–15 gegen 25). Das Rework darf davon
etwas ausgeben, aber nicht blind.

| Änderung | Wirkung auf rho je Spiel | Wirkung auf Pp |
|---|---|---|
| Ereignisnamen aus der Ursache (nur Anzeige) | **keine** — Fingerabdruck bleibt | keine |
| Rettungswurf (85 / 50 statt 65 %) | leicht positiv erwartet: die Schwere einer Störung hängt jetzt an einem Attribut statt am Zufall; dafür ein Wurf mehr | verschiebt etwas zu Intelligenz, Ausdauer, Wille — beobachten |
| Strafe (20 %) | **senkt**: größter Einzelausschlag. Häufigkeit unter 3 % der Gänge halten | klein |
| Zweite Luft | senkt leicht (ein Wurf mit großer Folge), hebt Entschlossenheit/Wille | Entschlossenheit steht bei 16 — darf nicht darüber hinausschießen |
| Höllengang | senkt leicht (zwei von zehn Gängen folgen einem anderen Gewicht) | **Qual** hat nur 6 in der Matrix und sitzt schon in SPITZENMOMENT und WAGNIS — der Höllengang muss klein bleiben |
| Teller statt Punkte | keine, solange die Punktsumme gebucht wird (nicht auf ganze Teller runden!) | keine |

Die Wechselwirkung zwischen Essern bleibt null (am 03.10. bewusst so entschieden: „Rivalen-Druck“ als Mechanik
verworfen). Das Publikum und das Kopf-an-Kopf sind Anzeige.

### 5.2 Messplan — in drei Stufen, nach dem Muster `BUEHNE_FLAGS`

Neuer Schalter `BUEHNE_FLAGS.wettessenEreignisse` (0 aus · 1 · 2 · 3):

| Stufe | Inhalt | Wertung |
|---|---|---|
| **1 — Erzählung** | Gänge, Teller, Ereignisnamen aus der Ursache, Blasen, Karten, Gangleiste, Endtabelle. Störung zählt weiter pauschal 65 %. | **unverändert — Fingerabdruck muss gleich bleiben** |
| **2 — Rettung** | Rettungswurf je Störung, Zweite Luft | bewegt sich, Messpflicht |
| **3 — Höllengang und Strafe** | Gang 4/8 mit WAGNIS-Gewicht, Würgen → Strafe | bewegt sich, Messpflicht |

Stufe 1 liefert schon den größten Teil dessen, was man sieht, ohne jedes Wertungsrisiko. Stufe 2 und 3 einzeln
messen, jede darf für sich aus bleiben.

Je Stufe: `scripts/miss-alle-disziplinen.mjs 48 wettessen` in zwei Saatströmen, bei **6v6 und 4v4** (4v4 lag
schon einmal bei 0,82), `scripts/messe-arena-einfluss.mjs wettessen 48` plus zweiter Saatstamm, dazu die
bestehende Sonde `scripts/miss-wettessen-mauer.mjs` (Haltungen dürfen nicht kippen: keine Haltung darf
dominieren). Mit `OLY_FORM_MODUS=echt` gegenprüfen.

**Abnahme:** rho je Spiel ≥ 0,75 hart, Ziel > 0,80, angestrebt 0,85 — und **Wettessen soll über 0,85 bleiben**
(es liegt bei 0,905; ein Rework der Erzählung ist kein Grund, zehn Punkte Rangtreue herzugeben). Pp ≤ 25 hart,
Ziel < 15 in beiden Saatströmen; je Attribut prüfen, besonders Qual und Entschlossenheit.

### 5.3 Fingerabdruck, Schutzsumme, Rückweg

- Stufe 1: `node scripts/pruefe-wertung-fingerabdruck.mjs` muss **unverändert** bleiben.
- Stufe 2/3: `spiele wettessen 1|7|42` und `disziplinProbe wettessen` bewegen sich → neues GESAMT in `CLAUDE.md`
  und `data/generated/`; alles andere byte-gleich.
- Das alte Verhalten bleibt geschützt: drei Zeilen `spiele wettessen/zaehler 1|7|42` mit eigener Summe
  **`WETTESSEN-ZAEHLER`** außerhalb von GESAMT (erste Zeile = heutiger Wert).
- Stempel je Spieltag `seasonState.wettessenFormat` (`lib/resolve/wettessen-format.ts`, Vorbild
  `climbing-format.ts` / `hockey-torwart.ts`): gebuchte Spieltage behalten ihr Format.
- Rückweg-Schalter `OLY_WETTESSEN_FORMAT=alt`; das Format reist im Kader-Umschlag
  (`formatByDisciplineId.wettessen`) und steht im Eingabe-Hash des Vorlaufs.
- PP: `data/generated/`-Referenz für Wettessen nach Stufe 2/3 neu schreiben (`werte-pp-skala-aus.mjs`, dann
  `werte-ergebnisskala-aus.ts`), Bester um 5 PP.

---

## 6. Bau-Hinweise für Sonnet (erst nach Chris' „bau das“)

1. **Stufe 1 zuerst und allein.** In `wettessenMauerRunden()` trägt jede Runde schon `ereignis`, `knapp`,
   `mauer`, `mauerNeu`, `fuell`. Den Ereignistyp daraus **ableiten** (misslungen + `mauer` → Krampf, misslungen
   + nicht `knapp` → Würgen, sonst Schluckauf; gelungen → Teller leer / Räumt ab über den Abstand zum
   Erfolgswert). Kein neuer Wurf, kein neues Feld, das die Wertung liest.
2. Für „Räumt ab“ in Stufe 1 den Wurf **nicht** neu ziehen; den vorhandenen Wurf mittragen (`wurf`, `erfolg`
   in die Runde schreiben) — nur lesen.
3. Stufe 2/3: der Rettungswurf ist **genau ein** zusätzliches `rr()` je misslungenem Gang und kommt **nach**
   dem bestehenden Wurf, damit die Reihenfolge der Zufallszahlen für gelungene Gänge gleich bleibt. Die
   Haltungs-Sonde (`buehneDiagVon`, gemeinsame Zufallszahlen für drei Haltungen) muss dieselbe Zahl Würfe je
   Gang ziehen wie der Spielpfad.
4. Teller nur in der Anzeige umrechnen; nie die gebuchte Summe auf ganze Teller runden.
5. Anzeige neu bauen (eigene Komponente im Stil des Mockups), nicht in `zeichneWettessen()` einhängen. Schrift
   über die Tokens, Endtabelle sortierbar, Rang 1 = Bester, keine Notenstufe neben einer Zahl.
6. Haltung und Team-Vorlage (17.11.) bleiben und gehören in die Esser-Karte (im Mockup aus Platzgründen
   weggelassen: Zustandszeile zeigt Magen/Mauer/Zweite Luft; im Bau die Haltung als kleines Zeichen ergänzen).
7. Mehrspieler: nichts Neues zu schreiben; Team aus `activeManagerTeamId`, Vorlage je Team wie heute.
8. Abschluss: Abgleich „Mockup | App“ bei 1920×1080 und 2560×1440 mit Liste drin / angepasst / fehlt, drei
   Kulissen (Bierzelt, Jahrmarkt, Nachtmarkt) und 6v6 / 4v4 / 2v2 als Stichproben.

---

## 7. Offene Fragen an Chris

1. **Stufenweise einführen?** Vorschlag: Stufe 1 (nur Erzählung, Wertung unverändert) sofort bauen, Stufe 2
   (Rettung, Zweite Luft) und Stufe 3 (Höllengang, Strafe) erst nach Messung. Oder willst du alles in einem
   Schritt und dafür später?
2. **Strafe ja oder nein?** „Würgen → Teller aberkannt“ ist der größte Einzelmoment und der größte
   Zufallsausschlag. Soll es ihn geben (selten, unter 3 % der Gänge), oder ist dir das zu hart für eine
   Disziplin, die nur wenige Male je Saison drankommt?
3. **Dürfen Tafel, Gerichte und Tellerstapel als PixelLab-Requisiten bestellt werden** (rund 25–33
   Generationen, keine Figuren, keine Animationen)? Eine echte Ess-Pose bleibt damit weiter offen — gewollt?
