# Recherche: Torwart, Puck, Tore — und was Hockey von Basketball erben kann (Fable)

Stand: `origin/main` `fff35048`, gemessen im eigenen Worktree (die Messwerkzeuge nennen die
gemessene Datei in der ersten Ausgabezeile; jede Zahl unten stammt aus einem Lauf, dessen
Quelle-Zeile auf `…/agent-a9c73ae75b9c4998a/public/mockups/battle-mode.html` zeigt).
Alle `engine.js`-Zeilen meinen `public/mockups/battle-mode.engine.js` auf diesem Stand.

Chris' drei Ansagen, wörtlich: *„einer der spieler soll natürlich einen torwart slot haben und
entsprechend im tor stehen! außer im 2er spiel da gibts nur verteiger und angreifer"* — *„Der
puck muss aber aktiv gespielt werden keine geister etc."* — *„bitte nicht unendlcih viele tore,
da bitte an realen ergebnissen orientieren ein paar tore mehr wäre ja okay aber nicht endlos!"*
Dazu die Nachschärfung: *„Beim Aufstellen in den Slots würde ich bei 3-6 Spielern explizit einen
Torwart Slot benennen und dem passende Gewichtung geben die sehr defensiv ausgerichtet ist aber
in Summe mit den andren Slots wieder der Diszi gewichtung entspricht"* und *„den Slot in den ich
einen Spieler einsetze würde ich gerne quasi auf dem Feld wieder erkennen"*.

---

## Die drei Empfehlungen, ohne Architekturwissen lesbar

**Torwart.** Ja, als benannter Aufstellungs-Slot ab drei Spielern, und die Person, die Chris
dort einsetzt, steht sichtbar im Tor — mit ihrem eigenen Sprite und ihrem eigenen Namen, nicht
als anonyme Figur. Im Motor ist sie aber **kein Feldspieler**: sie steht außerhalb der Liste, aus
der Angriffe, Deckung und Zweikämpfe gelost werden (dasselbe Bauprinzip, mit dem der
Schiedsrichter gebaut ist), sonst schießt der Torwart Tore und deckt Gegner. Beim Zweierspiel
gibt es keinen Torwart und ein kleineres Tor — das muss eigens kalibriert werden, sonst endet ein
Zweierspiel 14:12. Was heute fehlt und **vor** dem Torwart gebaut werden muss: die Aufstellung
erreicht die Arena gar nicht (der Motor kennt Chris' Slot-Zuweisung nicht), und der Slot-Generator
kann einen „sehr defensiven" Torwart-Slot bei Hockeys enger Matrix nicht ausdrücken, ohne dass
die sechs bestehenden Hockey-Slots umgerechnet werden.

**Puck.** Basketballs Ball-Objekt (getragen / in der Luft / frei) trägt für Hockey. Was neu
gebaut werden muss, ist nicht der Puck, sondern das, worauf er trifft: ein Tor mit Breite und
einem Torwart davor, der den Schuss hält, abprallen lässt oder festhält; die Bande, an der der
Puck im Spiel bleibt statt zu verschwinden; der Bully als Standphase nach jedem Tor und jedem
Festhalten; der Schussblock durch einen Verteidiger auf dem Weg zum Tor. Nicht zu bauen: Abseits,
Icing, Linienwechsel (Begründung unten). „Keine Geister" wird messbar: nach dem Umbau darf die
Sonde für Hockey keine `fehlend`-Liste mehr melden, und jedes Tor im Protokoll muss einen
Schussflug von einer Spielerposition haben.

**Tore.** Ziel **3,5 Tore je Team** in einem 4-Minuten-Spiel (3 Drittel à 1:20, ~8 Minuten
Zuschauzeit), Korridor 3 bis 4, Einzelspiele zwischen 0 und 8. Das ist ein Tor mehr als die NHL
und die DEL heute (je ~3,0), also genau „ein paar mehr". Erreichbar bei 24 bis 28 Schüssen je
Team und **13–16 % Trefferquote** (Fangquote .84–.87). Die im ersten Plan gesetzte harte Quote
8–13 % (Fangquote .870–.920) ist mit 4 Minuten Spielzeit nur erreichbar, wenn die Live-Engine
Basketballs Tempo hält — das ist rechnerisch möglich (siehe 3.3), hängt aber an einer
Tempo-Garantie, die der Plan gleichzeitig abschaffen will (die Schussuhr). Beides zugleich geht
nicht. Unentschieden bleiben bei ~15 % — Verlängerung nicht nötig.

---

## Was ich selbst nachgemessen oder abgerufen habe, was ich nur gelesen habe

**Nachgemessen** (Playwright/Chromium über das `node_modules` des Haupt-Checkouts, Skripte aus
dem Worktree, Quelle-Zeile geprüft):

| Zahl | Lauf | Ergebnis |
|---|---|---|
| Hockey Ist-Stand | `miss-hockey-bestand.mjs hockey 48` | 6,63 Tore/Team · 66,6 % Trefferquote · 10,23 Abschlüsse · 18,8 % Unentschieden · Pp 48,1 (health −9,6, stamina −9,0) — deckungsgleich mit dem Plan |
| Hockey Rangtreue | `miss-feldspiel-rangtreue.mjs hockey 24 6` | rho 0,493 / 0,481; `fehlend`-Liste: deckerAbstandBeiWurf, tier, decker, ballwechsel |
| Live-Engine bei 2, 3, 6 je Seite | `miss-feldspiel-rangtreue.mjs basketball 12 2,3,6` | läuft **ohne Seitenfehler** in allen drei Größen; rho(Seite) **0,083** / 0,813 / 0,818; Punkte je Spiel 65,2 / 66,4 / 84,9; FGA (beide Seiten) 79,8 / 85,0 / 82,1; Ballwechsel 90 / 96 / 100 |
| Slot-Invariante | eigenes Node-Skript über `SLOTS_JE_DISC` in `engine.js` | Mittel der sechs Profile minus Matrix: **0,10 Pp** (Hockey) und **0,10 Pp** (Basketball); jedes Profil summiert auf 99,9–100,2 |
| Unentschieden nach Poisson | `node -e` | λ=3: 16,7 % · λ=3,5: 15,4 % · λ=4: 14,3 % · λ=5: 12,8 % |
| DEL 2024/25 Tore je Spiel | Wikipedia-Hauptrundentabelle abgerufen, selbst summiert | 2197 Tore / 364 Spiele = **6,04 je Spiel, 3,02 je Team** (Tabellentore, enthält Penalty-Siegtore) |

**Abgerufen** (Websuche/-fetch, Zahlen wörtlich aus der Quelle):

| Kennzahl | Wert | Quelle |
|---|---|---|
| NHL 2024-25 Tore je Team und Spiel | 2,54 (San Jose) bis 3,56 (Tampa) | StatMuse, Teamtabelle |
| NHL 2024-25 Schüsse je Team und Spiel | 24,44 (Chicago) bis 31,98 (Edmonton) | StatMuse |
| NHL 2024-25 Trefferquote je Team | 9,1 % bis 12,6 % | StatMuse (dieselbe Tabelle) |
| NHL 2024-25 Fangquote ligaweit | .900 (Saisonende), .901/.902 zum Viertel-/Halbzeitpunkt | NHL.com „Numbers at quarter mark", StatMuse |
| NHL 2024-25 Tore je Spiel (beide) | „6.1 or higher for a third straight season" | NHL.com |
| NHL 2024-25 Hits je Team und Spiel | 15,13 (Edmonton) bis 29,83 (Florida) | StatMuse |
| NHL 2024-25 geblockte Schüsse je Team | 11,55 (Carolina) bis 17,74 (Philadelphia) | StatMuse |
| Anteil der Tore nach Distanz | 21 % aus ≤10 ft, 55 % aus ≤20 ft, 73 % aus ≤30 ft | snipersedgehockey.com (NHL-Auswertung) |
| Trefferwahrscheinlichkeit nach Zone | „point shot 1–3 %" gegen „5–15 % inside the house" | hockeysarsenal.substack.com |
| xG-Faktoren, Rangfolge | Distanz, Winkel, Schusstyp, Abpraller, Stärke, Zeit seit letztem Ereignis; Tore „peak around 10 feet"; Ablenker ~20 % Verwertung; Abpraller „up to 1 in 5", Basis 6,6 % | expectedbuffalo.com |
| Abpraller-Kontrolle | 29 % der Saves werden binnen 2 s festgehalten (Ligamittel 2009–15); 5,7 % der nicht festgehaltenen Saves führen zum Nachschuss; Fangquote auf Nachschüssen 66–81 % | hockey-graphs.com |
| Powerplay-Nachschüsse | 13 % der PP-Schüsse erzeugen einen Nachschuss, Verwertung 12 % | nhlspecialteams.com |
| Torwart-Grundregeln | „Base Depth" = Schlittschuhe an der Oberkante des Torraums; quadratisch zum Puck („belly-button test"); dann gehen Abpraller in die Ecken statt in den Slot | usahockeygoaltending.com, betterhockey.com, seltytending.com |
| Hockey-Formationen | Center im Slot, Flügel Half-Wall/Netfront, Verteidiger an den Points; Forecheck 1-2-2 / 2-1-2 (F1/F2/F3); Abwehr Box+1 und Low Collapse | thecoachessite.com, hockeyshare.com, weisstechhockey.com, learn-ice-hockey.com, icehockeyguide.com |
| Basketball-Formationen | PG Top of Key, SG/SF Flügel, PF/C am Key; Center ~50 % der Würfe aus der Restricted Area, SG ~50 % Dreier | sportplan.net, Wikipedia „Basketball positions", Dartmouth Sports Analytics |

**Aus den xG-Repos** (fünf von sechs per `git clone --depth 1` geholt, Dateien selbst gelesen):
Feature-Listen, die Feature-Importance-Grafik von hockeyR, die WOE-Kurven nach Distanz und Winkel
von Hainke, die Lizenzdateien (Abschnitt 8).

**Nur gelesen, nicht belegt:** die NHL-Tore-je-Spiel der 1980er (aus dem Gedächtnis ~8 je
Spiel; hockey-reference und StatMuse-Saisonabfragen lieferten 403/422); die Basketball-Zahlen bei
n=24 aus der Nachricht des Planautors (meine n=12-Läufe liegen daneben: 0,847/0,818, 84,9 Punkte,
82,1 FGA — konsistent); die Sound-Verdrahtung; die Aufstellungs-Oberfläche in der App.

---

## 1. Torwart

### 1.1 Was Chris' Satz technisch heißt

Der Satz hat drei Teile, und jeder ist eine andere Baustelle:

1. *„einen Torwart-Slot haben"* — die **Aufstellung**: eine siebte Rolle in
   `lib/lineups/matchday-slot-roles.ts` (`DISCIPLINE_ROLE_THEMES.hockey`, Zeilen 169–176), die im
   Aufstellungsbildschirm erscheint. Produktionsdaten.
2. *„einer der Spieler"* — die **Person**: der Torwart ist ein Kaderspieler mit Namen, Sprite und
   Attributen, nicht eine Zahl im Team (das war meine Option E im ersten Review — Chris' Satz
   schließt sie in dieser Form aus).
3. *„entsprechend im Tor stehen"* — die **Position und Mechanik** im Motor.

Teil 1 erreicht Teil 3 heute **gar nicht**: `buildArenaTeam` (`arena-kader-adapter.ts:137–159`)
reicht den Gesamtkader ohne Slot durch, `place` bleibt im Headless-Runner leer, und
`slotFuer(p,i)` (`engine.js:4013–4014`) fällt auf `slotListe[i % length]` zurück — die Rollen
werden **reihum** an die sechs Besten nach Disziplinwert (`:4010`) vergeben. Wer heute einen
Torwart-Slot setzt, sähe in der Arena einen anderen Spieler im Tor. Das Rohr Aufstellung → Arena
ist deshalb keine vertagbare Nebensache (F.5 im ersten Plan) mehr, sondern Voraussetzung für
Teil 1 von Chris' Satz. Es gilt für alle Feldspiele gleich (Basketballs Slot-Rollen erreichen die
Arena genauso wenig).

### 1.2 Was ein Torwart *innerhalb* von `FSTEAM` anfassen müsste (Option D, ehrlich gezählt)

Zwischen `initBasketballLive` (`:4330`) und dem Ende von `stepFeldspiel` (`:6440`) stehen
**23** Zugriffe der Form `FSTEAM[...]`, **10** Ganzteam-Schleifen (`for(const team of FSTEAM)`,
`[...FSTEAM[0],...FSTEAM[1]]`) und **8** Mitspieler-Filter (`team.filter(x=>x!==u)` /
`mitspieler`). Jeder davon ist eine Stelle, an der ein Torwart als 6. Teammitglied falsch
behandelt würde. Die wichtigsten, mit Zeile:

| Stelle | Was passiert mit einem Torwart in `FSTEAM` |
|---|---|
| `spielmacherLos` `:4524` | er eröffnet Angriffe (Los über AUFBAU) |
| `offensterMitspieler` `:4565` | er wird angespielt |
| `zuordneSlots` `:4308` | er bekommt einen Angriffs-Slot ums gegnerische Tor (6 Slots für 6 Spieler) |
| `zuordneDeckung` `:4377` | er deckt einen Gegner **und** wird gedeckt |
| `entscheideBallaktion` `:4648` | er wirft/schießt |
| `passeAb` `:5364–5376` | er fängt Pässe ab (`distZuLinie` über alle Gegner) |
| `versucheSteal` (Aufruf `:6250`) | er stiehlt |
| `startFastbreak` `:5469` | er kann Ausbrecher werden (schnellster ohne Ball) |
| Rebound-Kampf `:6127–6205` | er rangelt um freie Bälle (`GREIF_REICHWEITE`) |
| `bewegeSpielerLive` `:5624` | er läuft zu Slots, zu freien Bällen (`LAUF_ZUM_BALL_RADIUS=260`), setzt Screens |
| Separation `:5660 ff.` | er wird von allen abgestoßen |
| `MOTOREN[fd].wert/namen` `:13030` | Impact-Formel zählt für ihn Punkte/Rebounds |
| `renderWertungFeldspiel` `:9973`, `WERTUNG_KOPF` | Spalten Pkt/Reb/Ast/Stl/Blk/TO/FG/FG%/Imp/Eig — keine Saves, keine Fangquote |

Ein `if(u.torwart)continue;` an 20 Stellen ist genau die Bauform, vor der der
Schiedsrichter-Kommentar warnt (`:3500–3506`: „darf in keiner der Spieler-Schleifen auftauchen").

### 1.3 Die tragfähige Variante: Person **außerhalb** von `FSTEAM`, nach dem Schiedsrichter-Muster

`fsSchiri` (`:3510`, `:4368`) ist ein eigenes Objekt mit `x/y/zielX/zielY`, wird in
`bewegeSchiri` (`:5298`) bewegt und in `zeichneSchiri` (`:5315`) gezeichnet — und taucht in
keiner der Listen oben auf, ohne eine einzige Ausnahme im Code. Derselbe Bau für den Torwart, mit
einem Unterschied: das Objekt trägt die **Identität eines Kaderspielers**.

```
fsTorwart = [ {p, n, side, x, y, zielX, zielY, PARADE, saves, gegentore, festgehalten,
               abpraller, lunge, reaktT}, {…} ]   // je Seite eines, oder null (Zweierspiel)
```

- **Wer:** `bauFeldspiel` liest `place[p.n].slot === "goaltender"` (Aufstellung, sobald das Rohr
  steht); Rückfall: bester Wert des Hockey-Sub-Skills PARADE im Kader. Der Torwart wird
  **aus** `mine`/`gegner` herausgenommen, bevor `FSTEAM` gebaut wird — `FSTEAM` hat dann
  `jeSeite − 1` Feldspieler, und **keine** Feldspieler-Funktion muss angefasst werden.
- **Wo:** eine Position auf der Torlinie plus „Base Depth" (Torraum-Oberkante), quadratisch zum
  Puck: `zielY = H/2 + clamp(puck.y − H/2) · k` mit kleinem `k`, `zielX` fest. Das ist die
  Torwart-Regel aus den Quellen (belly-button test), und sie ist dieselbe Bauform wie
  `schiriRuhePos` (`:5279`: dem Ballbesitz auf gedeckelter Bahn folgen).
- **Was er tut:** die Auflösung des Schusses (Abschnitt 2.3). PARADE geht als Zahl in die
  Torwahrscheinlichkeit, `saves`/`gegentore`/`festgehalten` sind seine Boxscore-Zahlen.
- **Sichtbar:** `zeichneSprite(ctx,u,x,y,true)` (`:1484`) zeichnet jede Figur nach `u.n` — der
  Torwart bekommt sein eigenes Charakter-Sprite; `lunge` (schon vorhanden für Steal/Wurf-Posen)
  trägt die Parade-Geste. Kein neues Bild-Asset nötig, im Gegensatz zum Schiedsrichter.
- **Messung:** `MOTOREN[fd].namen()`/`wert()` (`:13029–13031`) müssen `fsTorwart` mit aufnehmen,
  sonst ist der Torwart für `einflussVon` und die Rangtreue unsichtbar (Abschnitt 7).

Kosten gegen Option D: kein einziger `continue` in Feldspieler-Schleifen; die Stellen sind
`bauFeldspiel` (Auswahl, Herausnahme), ein neues `bewegeTorwart`/`zeichneTorwart`, die
Schussauflösung, `wert/namen`, die Wertungstabelle, `sichern/zurueck` (`:13006–13010`, ein
weiteres Feld wie `fsSchiri`). Das ist Option E aus dem ersten Review plus Identität —
ich nenne sie unten **E′**.

**Gegenprobe, warum nicht doch ein 6. Feldspieler mit Flag:** Chris' Zweierregel. Bei `n=2`
gibt es keinen Torwart; bei E′ ist das `fsTorwart[side]=null` und `FSTEAM` mit 2 — der Code
läuft, wie heute gemessen (Basketball 2v2 ohne Seitenfehler). Bei einem Flag-Torwart in
`FSTEAM` wäre `n=2` ein zweiter Codepfad in jeder der 20 Stellen.

### 1.4 Die Degradationsregel

Chris: 3–6 Spieler → Torwart-Slot, 2 → nur Verteidiger und Angreifer. Real: 5 Feldspieler + 1
Torwart = 6; unsere `jeSeite: 6` trifft das exakt — das ist kein Zufall, den man nutzen kann, das
ist die richtige Sechs. Daraus:

| `jeSeite` | Feld + Tor | Reales Vorbild | Anmerkung |
|---|---|---|---|
| 6 | 5 + 1 | reguläres Spiel (C, LW, RW, LD, RD, G) | Formation aus 1.7 passt 1:1 |
| 5 | 4 + 1 | Unterzahlspiel / Box | Formation ohne einen Flügel |
| 4 | 3 + 1 | NHL-Verlängerung 3-gegen-3 | Formation: C, ein Flügel, ein Verteidiger |
| 3 | 2 + 1 | kein NHL-Vorbild (Kleinfeld) | ein Angreifer, ein Verteidiger, Torwart |
| 2 | 2 + 0 | Chris' Regel | **leeres, kleineres Tor** — eigene Kalibrierung, s. u. |

**Warum das Zweierspiel eine eigene Kalibrierung braucht, mit Zahl:** Basketball 2v2 liefert
heute 65,2 Punkte je Spiel bei 79,8 Feldwürfen (gemessen) — die Wurfzahl bleibt fast gleich wie
bei 6v6, nur die Trefferquote sinkt leicht. Überträgt man das auf Hockey: ~25 Schüsse je Team in
240 s auf ein Tor, vor dem niemand steht. Real trifft ein Schuss aufs leere Tor in der NHL in
der Größenordnung von 40–50 % (Empty-Net-Tore; im hockeyR-Modell ist `empty_net` ein eigenes
Merkmal — Zahl nicht abgerufen, Größenordnung aus dem Gedächtnis). 25 × 0,45 = **11 Tore je
Team** — das ist Chris' „endlos". Deshalb für `n=2`: (a) kleines Tor (halbe Breite, wie beim
Streethockey ohne Torwart), (b) der Schussblock des einzigen Verteidigers als Hauptabwehr, (c)
eigene Zieltabelle: 4–5 Tore je Team statt 3,5. Das ist eine zweite Zeile in derselben
Kalibriertabelle, kein zweiter Motor.

**Und die Kadergröße bindet heute nicht** — die Arena spielt immer 6 (`jeSeite` in
`FELDSPIEL_ART`, `:3456`; die Saison-Kadergröße 2..6 aus `season-discipline-schedule.ts:89–94`
erreicht den Motor nicht). Die Regel wird also erst mit F.5 sichtbar. Sie muss trotzdem **jetzt**
in die Formel: `fsTorwart[side]` ist nullable, und die Schussauflösung hat einen Zweig ohne
Torwart. Rangtreue bei 2v2 ist ohnehin ein Münzwurf (rho 0,083 gemessen, Basketball) — mit zwei
Rängen je Seite kann sie nichts anderes sein; das ist ein Befund für F.5, nicht für den Torwart.

### 1.5 Der Torwart-Slot im Generator — Chris' Bedingung ist Systemgesetz, und sie beißt

Chris will einen „sehr defensiv ausgerichteten" Slot, dessen Profil zusammen mit den anderen
wieder die Disziplinmatrix ergibt. Nachgemessen: das gilt heute exakt (0,10 Pp Abweichung), und
es ist **per Konstruktion** so, nicht zufällig — `buildSlotWeightProfiles`
(`matchday-slot-roles.ts:421–454`):

1. Für alle Themen **außer dem letzten** wird ein Delta gebaut (`buildInitialDelta`, `:369–402`):
   zwei Fokus-Attribute bekommen +5,5 und +3,5, **gedeckelt auf `min(base·0,45, 7)`, mindestens
   1,5**; die Summe wird aus den übrigen Attributen abgezogen (`distributeNegativeDelta`, nie unter
   0,75).
2. `resolveSafeDeltaScale` (`:404–418`) skaliert alle Deltas gemeinsam herunter, bis kein
   Attribut im letzten Slot unter 0,75 fiele.
3. Das **letzte Thema bekommt `−Σ` aller anderen Deltas** (`finalDelta`, `:438–443`) — es ist der
   Ausgleichsslot, der die Matrix wieder herstellt.
4. `buildGeneratedSlotRoles` (`:499–504`) nimmt `themes.slice(0, slotCount)` mit `slotCount`
   **geklemmt auf 0..6**.

Vier Folgen, alle geprüft am Code, nicht vermutet:

- **Der Generator trägt sieben Themen ohne Umbau** — Schritt 1–3 sind längenunabhängig, und die
  Invariante hält bei jeder Länge. Aber Schritt 4 klemmt auf 6: bei `playerCount ≤ 6` wird ein
  siebtes Thema **nie** ausgegeben. Ein Torwart-Thema muss also **innerhalb** der Sechs sitzen.
- **Die Position in der Liste entscheidet über die Degradation:** `slice(0, n)` liefert bei `n=3`
  die ersten drei Themen. Der Torwart muss für 3..6 erscheinen und bei 2 fehlen → er muss **an
  dritter Stelle** stehen (Index 2). Das ist eine Zeile in `DISCIPLINE_ROLE_THEMES.hockey`, die
  Reihenfolge ist aber heute Bedeutungsträger für alle Kadergrößen — bei `n=3` fällt dann
  z. B. „Playmaker" heraus, den es heute gibt.
- **Bei `n=3` ist der Torwart das letzte Thema und damit der Ausgleichsslot:** sein Profil wäre
  `−Σ` von Power Forward und Defensive Wall — ein Zufallsprofil, nicht das entworfene. Nötig ist
  eine kleine Generator-Regel: Ausgleichsslot = letztes **Nicht-Torwart**-Thema. Etwa 5 Zeilen in
  `buildSlotWeightProfiles`, aber sie ändern die Profile *aller* Kadergrößen, in denen der Torwart
  letzter wäre.
- **„Sehr defensiv" ist mit dem heutigen Deckel nicht ausdrückbar.** Hockeys Matrix hat vier
  Attribute ≥ 10 (power 18, health 18, speed 12, spirit 12) und die Torwart-Attribute liegen bei
  4 (determination, dexterity, will) und 8 (awareness). Der Fokus-Deckel `min(base·0,45, 7)`
  erlaubt für ein 4er-Attribut **+1,8**, für awareness +3,6, für health +7. Das stärkste
  erreichbare Torwart-Profil ist damit `health ≈ 23,5, awareness ≈ 11,5` — praktisch identisch mit
  dem bestehenden „Defensive Wall" (`health 23,4, spirit 15,4`, `engine.js:2748`). Chris' Wunsch
  braucht entweder einen eigenen, höheren Deckel für den Torwart (dann ziehen die anderen fünf
  entsprechend Masse ab — die sechs bestehenden Hockey-Profile verschieben sich) oder ein
  handgeschriebenes Profil außerhalb des Generators (bricht das Prinzip „nicht von Hand
  übertragen", das `generiere-arena-daten.ts` gerade abgeschafft hat).
- **Produktionsdaten:** die `roleId` trägt die Kadergröße (`${disciplineId}-${slotCount}-${theme.roleId}`,
  `:517`). Ob Aufstellungen `roleId`s persistieren, habe ich per `grep -rn roleId lib` **nicht
  gefunden** — nicht bewiesen, dass sie es nicht tun. Was Chris sicher sieht: die
  `keyAttributes` seiner bestehenden Hockey-Slots ändern sich im Aufstellungsbildschirm, und die
  Arena-Datei muss per `generiere-arena-daten.ts --schreiben` neu erzeugt werden (Marker
  `:63–64`; `slotZahl` dort liefert für Hockey 6).

**Empfehlung dazu:** Torwart-Thema an Index 2 mit eigenem Fokus-Deckel (Vorschlag: bis 12
Punkte auf zwei von determination/will/awareness/health, damit ein Torwart-Slot bei health ~25,
awareness ~14, will ~8 landet), Ausgleich auf die fünf Feldrollen **verteilt** statt auf das
letzte Thema allein, und die neuen sechs Hockey-Profile Chris **vorher** als Tabelle zeigen. Das
ist ein eigener PR, der keinen Motor anfasst.

### 1.6 PARADE und der Slot müssen dieselben Attribute lesen

Der Slot sagt Chris, *wer* ins Tor passt (Slot-Profil, `slotAufschlag` ±8,5 auf den
Disziplinwert, `engine.js:2869`). PARADE sagt dem Motor, *wie gut* er hält. Lesen beide
verschiedene Attribute, empfiehlt der Bildschirm einen anderen Spieler als den, den der Motor
belohnt. Vorschlag aus dem ersten Plan (B.3, PARADE: dexterity 25, will 40, determination 30,
awareness 15, health 5) und das Slot-Profil oben müssen deshalb dieselbe Reihenfolge haben.
Der dexterity-Konflikt aus meinem ersten Review (PARADE führt dexterity wie SCHUSS_NAH → der
Torhüter wäre der beste Schütze) ist mit E′ **erledigt**: der Torwart schießt nicht mehr.

### 1.7 Varianten im Vergleich

| | Sichtbar im Tor | Person mit Namen | Manager wählt | Bei 2 Spielern | Motorstellen | Produktionsdaten |
|---|---|---|---|---|---|---|
| A kein Torwart | nein | – | – | – | 0 | – |
| B PARADE-Zahl im Team | nein | nein | nein | geht | 1 Term | – |
| C B + Slot | nein | nein | ja | Slot fehlt | 1 Term | Slot |
| D Flag-Spieler in `FSTEAM` | ja | ja | ja | 2. Codepfad ×20 | ~20 Ausnahmen | Slot |
| E Zahl-Objekt wie Schiri | ja (anonym) | **nein** | nein | geht | ~6 | – |
| **E′ Person-Objekt wie Schiri** | **ja** | **ja** | **ja (mit Rohr)** | `null` | **~6** | Slot + Rohr |

E′ ist die einzige Zeile, die alle drei Teile von Chris' Satz trifft. Ihr Preis ist nicht der
Motor, sondern das Rohr (1.1) und der Generator (1.5).

---

## 2. Puck — was Basketballs Chassis kann und was Hockey neu braucht

### 2.1 Der Ball als Objekt: übertragbar

`fsLive.ball = {traeger, flug, frei, dribbelT}` (`:4365`) mit genau drei Zuständen. Abbildung:

| Basketball | Code | Hockey | Urteil |
|---|---|---|---|
| getragen (`traeger`) | `ballUebernehmen` `:4420` | Puck am Schläger | **übernehmen**; `dribbelT` (sin-Bounce, `:6232–6238`) wird zum Schläger-Versatz in Laufrichtung; `dribbelFaktor 0,85` (`:5663`) auf ~0,97 — ein Eisläufer mit Puck ist kaum langsamer |
| Pass (`flug.art="pass"`, 0,3 s, `:5405`) | `passeAb` `:5364`; Abfangen über `distZuLinie` gegen `PASSLINIE_RADIUS=55` | Pass | **übernehmen**, 0,25 s; Abfangen bleibt |
| Wurf (`flug.art="wurf"`, 0,45 s, Ziel = Korbpunkt) | `wirf` `:5021`, Ausgang **beim Abwurf gewürfelt**, bei Ankunft enthüllt (`:5033`) | Schuss | **ersetzen** im Ziel (2.3): Ziel ist ein Punkt auf der Torlinie innerhalb der Torbreite, nicht ein Ring; 0,2 s; Auflösung gegen Torwart |
| frei (`frei={x,y,vonSeite}`) | Rebound-Kampf `:6127–6205`, `GREIF_REICHWEITE=40`, `LAUF_ZUM_BALL_RADIUS=260`, `REB_BOXOUT=4` | loser Puck | **übernehmen mit anderer Kalibrierung**: Abpraller-Streuung `:5609–5612` entsteht am Torwart statt am Ring; `LAUF_ZUM_BALL_RADIUS` kleiner (ein Verteidiger verlässt den Point nicht für jeden losen Puck) |
| Steal (`versucheSteal` `:5420`, `STEAL_REICHWEITE=45`) | Chance `1−basis^(1/3)` je Versuch | Stockcheck / Bodycheck | **übernehmen und aufspalten**: Stockcheck = heutige Formel; Bodycheck = zusätzlich `down`/`lunge` beim Getroffenen für 0,4 s (Feld `down` existiert schon) und Strafrisiko (PR 8) |
| Fehlpass (`eigenerFehler`, `:5399`) | loser Ball | Fehlpass | **übernehmen** |

### 2.2 Wo Basketball für Hockey nicht passt

1. **Bande und Aus.** Basketball hat im Live-Pfad **keine** Aus-Behandlung — der Ball fliegt
   nur zu Spielern oder zum Ring, ein loser Ball entsteht nur am Ring (`:5609`) oder am Passziel
   (`:5512`); die einzigen Koordinaten-Klemmen im Motor sitzen im Kampf (`:9227`, `:9655`). Für
   Hockey ist das paradoxerweise die richtige Grundlage: der Puck ist nie im Aus. Neu ist nur:
   ein Schuss neben das Tor (Abschnitt 2.3, Ausgang „vorbei") legt den Puck **hinter** dem Tor
   an die Bande, also braucht `korbXVon` (`:3980`, `W·0,915`) einen Platz dahinter — real 11 ft
   von 200 ft (5,5 % der Länge) hinter der Torlinie; bei uns Torlinie auf `W·0,88`, Bande auf
   `W·0,96`. Loser Puck wird auf den Rink geklemmt und an der Bande gespiegelt (zwei Zeilen im
   `frei`-Zweig). Spiel hinter dem Tor ist eine echte Hockey-Situation (Center hinter dem Tor,
   Wikipedia „Centre (ice hockey)") und kommt so gratis.
2. **Schussuhr.** `SCHUSSUHR_BASKETBALL=8` (`:3642`) erzwingt den Abschluss. Der erste Plan sagt
   „weg damit" (C.3.3). **Ich widerspreche:** die Uhr ist keine Regel, sie ist die
   **Tempo-Garantie**, an der die Torzahl hängt (Abschnitt 3.3). Sie bindet bei Basketball fast
   nie (Kommentar `:3642 ff.`, mittlere Possession 3,75 s), sie ist ein Sicherheitsnetz. Für
   Hockey ein **Ereignis** statt einer Uhr: nach ~10 s Angriffszeit steigt die Chance je Tick,
   dass die Abwehr klärt (Puck an die Bande → loser Puck in der neutralen Zone). Der Zuschauer
   sieht „geklärt", nicht „Uhr abgelaufen". Aber die Kappe bleibt.
3. **Die Erfolgskurve.** `GEO_BONUS={dunk 0,70, nah 0,20, mit 0,09, fern 0,075}` (`:3710`) plus
   `MAKE_KORREKTUR` (`:3727`) sind gegen NBA-FG% kalibriert und **monoton fallend mit der
   Distanz**. Der erste Plan (C.3.2) und mein Review haben behauptet, Hockeys Kurve habe ihr
   Maximum im Slot und falle **zu beiden Seiten** ab („ganz nah: kein Winkel"). **Das stimmt nach
   den Daten nicht** — die WOE-Kurve nach Distanz (Hainke, `Images/shot_dist.png`) ist monoton:
   das Band 1–10 ft hat die **höchste** Torwahrscheinlichkeit, und expectedbuffalo nennt den
   Gipfel bei ~10 ft. Der Abfall „direkt am Tor" ist ein **Winkel**-Effekt (ein Schuss von
   neben dem Pfosten hat 90°), und der Winkel ist eine eigene Achse. Für Hockey gilt also:
   Distanz monoton (wie Basketball) **plus** Winkel als zweite Achse (Basketball hat sie nicht).
   Ich korrigiere damit meine eigene Auflage 6 aus dem ersten Review: keine „Formänderung mit
   Maximum im Slot", sondern eine zweite Dimension. Zahlen in Abschnitt 8.4.
4. **Der Wurf trifft einen Punkt, der Schuss trifft eine Linie mit Torwart.** Bei Basketball ist
   der Ausgang beim Abwurf entschieden (`treffer=rr()<technik`, `:5033`), der Ring nur
   Animation. Bei Hockey muss der Ausgang **ebenfalls** beim Abschuss gewürfelt werden (dasselbe
   Muster, deterministisch), aber mit dem Torwart als Term **und** mit vier statt zwei
   Ausgängen (2.3). Der Torwart „reagiert" dann auf den bereits feststehenden Ausgang — genau
   wie heute der Korb.
5. **Manndeckung spiegelt den Angriff.** `zuordneDeckung` (`:4377`) setzt jeden Verteidiger auf
   den nächsten Angreifer; `sag` (`:5850`, Zug zum eigenen Korb bis 35 px) ist der einzige
   Zonenanteil. Hockey verteidigt in der eigenen Zone als **Box+1 / Low Collapse** (Quellen oben):
   zwei Verteidiger tief an den Pfosten, zwei Flügel hoch, Center unterstützt tief. Das ist keine
   Ersetzung der Manndeckung, sondern ein größerer `sag` **plus** eine Rollen-Heimat in der
   eigenen Zone (Abschnitt 6). Der Forecheck (1-2-2 / 2-1-2) ist Basketballs Fokus-Doppeln
   verwandt: F1 auf den Puckträger, F2/F3 nehmen Passwege — `HILFE_RADIUS`/`hilfeBis`
   (`:3825`, `:5790 ff.`) tragen das mit anderer Kalibrierung.
6. **Foul → Freiwurf.** Fällt für Hockey weg (Plan C.3.1, richtig); die Standphase
   `fsLive.phase="freiwurf"` (`:5192–5279`) wird zum **Bully** (jedes Tor, jedes Festhalten,
   Drittelbeginn) und zum **Penalty** (selten, strukturell der Freiwurf). Bully-Mechanik:
   Los zwischen den beiden Centern über PUCKFUEHRUNG, Puck geht als `frei` mit kleinem Versatz
   zum Gewinner — kein eigener Sub-Skill (Plan B.5, ich stimme zu: ~55 Bullys je Spiel real,
   jedes einzelne wenig wert).
7. **Alley-Oop/`spielzuege`** — fällt weg (Plan C.3.5, zustimmend). Torjubel je Tor stattdessen.
8. **Dunk-Stufe (`DUNK_RADIUS=42`, `GEO_BONUS.dunk=0,70`)** — fällt weg als Stufe; ihr Platz
   nimmt der Abpraller-Nachschuss (`rebound` als Merkmal: „up to 1 in 5", expectedbuffalo).

### 2.3 Die Schussauflösung — der eigentliche Neubau

Ein Schuss hat vier Ausgänge statt Basketballs zwei (Treffer/Fehlwurf), und der Torwart ist der
Term dazwischen:

```
p_block   = f(SCHUSSBLOCK des Verteidigers auf der Linie, distZuLinie)   // wie Pass-Interception, :5368
p_vorbei  = g(Distanz, Winkel, SCHUSS_x)                                 // Schuss verfehlt das Tor
p_tor     = zone(Distanz, Winkel) · schütze(SCHUSS_NAH/FERN) · (1 − parade(PARADE, Abpraller-Kontext))
Rest: Save → davon `festgehalten` (Bully) oder `abpraller` (frei vor dem Tor, REB_BOXOUT gilt)
```

Real-Anker für die vier Anteile (Quellen oben): von 100 Schussversuchen werden ~25 geblockt
(NHL 11,6–17,7 Blocks je Team gegen ~55 Versuche), ~20 gehen vorbei, ~55 kommen aufs Tor; davon
~10 % Tor (NHL 9,1–12,6 %); von den Saves werden 29 % festgehalten, der Rest ist loser Puck, und
etwa jeder zwanzigste davon wird zum sofortigen Nachschuss mit ~15–20 % Verwertung. Für uns
zählt nur der Anteil, der **sichtbar** wird: Block, vorbei (Puck hinter dem Tor), Save mit
Bully, Save mit Abpraller, Tor. Der Abpraller ist der Ort, an dem ABPRALLER/ZWEITCHANCE und
`REB_BOXOUT` ihren Kanal bekommen — Basketballs Rebound-Kampf-Form passt, nur die
Grundverteilung (26 % offensiv) ist neu zu setzen; eine belastbare NHL-Zahl dafür gibt es nicht
(Plan F.7, ich bestätige das nach eigener Suche: nur die PP-Zahl 13 % und die 5,7 % von
hockey-graphs, beide mit anderer Definition).

**Was „keine Geister" als Abnahme heißt:** `feldspielProbe("hockey")` meldet heute
`fehlend: deckerAbstandBeiWurf, tier, decker, ballwechsel`. Nach dem Umbau muss die Liste leer
sein, und zusätzlich: jedes `treffer`-Ereignis trägt `zumKorbBeiWurf` und `winkelBeiWurf` von
einer echten Spielerposition, jeder Ballbesitzwechsel ist ein geloggtes Ereignis
(steal/block/save/abpraller/bully/geklaert). Das ist mit dem Protokoll (`fsZuege`) direkt prüfbar.

### 2.4 Was bewusst **nicht** gebaut wird

- **Abseits und Icing.** Beides braucht blaue Linien als Regelgrenzen und Positionsprüfung aller
  Spieler beim Passzeitpunkt. Der Ertrag ist eine Unterbrechung, die den Zuschauer stört, und
  eine Regel, die im Modell keinen Sub-Skill trägt. Abseits kommt in keinem der xG-Modelle vor.
  Empfehlung: nicht bauen; die blauen Linien nur zeichnen und als Formations-Anker nutzen.
- **Linienwechsel.** Real alle ~45 s die ganze Reihe. Wir haben 5 Feldspieler, keine zweite
  Reihe. Ein Linienwechsel wäre nur ein Ermüdungs-Reset ohne sichtbare Figur. SCHICHTKRAFT bekommt
  seinen Kanal besser über einen **echten Ermüdungsterm** in der Live-Engine (heute liest sie
  `AUSDAUER` nirgends — Plan B.3.1, bestätigt per grep): Tempo und Zweikampfchance sinken über
  das Drittel, erholen in der Drittelpause. Das ist sichtbar (langsamere Figuren im 3. Drittel)
  und misst sich. Kein Wechsel, keine Bank.
- **Powerplay** — PR 8, nach Live (Plan C.4, zustimmend).

---

## 3. Tore

### 3.1 Referenz und Ist

Real: **~3,0 Tore je Team** — NHL 2024-25 zwischen 2,54 und 3,56 (StatMuse), DEL 2024/25
3,02 (selbst summiert). Schüsse aufs Tor 24–32 je Team, Trefferquote 9–13 %, Fangquote .900.
Ist bei uns: 6,63 Tore bei 66,6 % auf 10,2 Abschlüsse — die Quote ist das Problem, nicht die
Zahl der Abschlüsse.

### 3.2 Welche Zahl sich richtig anfühlt — und warum 3,5

Chris will „ein paar mehr, nicht endlos". Drei Anker:

- **Realistisch:** 3,0. Ein Tor alle ~80 s Zuschauzeit in einem 8-Minuten-Spiel. Sechs Tore je
  Spiel.
- **„Ein paar mehr":** 3,5–4. Sieben bis acht Tore je Spiel, alle ~60–70 s eines. Das ist die
  Torfrequenz der torreichsten NHL-Ära (1980er, ~8 je Spiel — aus dem Gedächtnis, nicht
  abgerufen) bei heutigen Schusszahlen.
- **Albern:** ab 5. Zehn Tore je Spiel heißt alle 48 s ein Tor; mit Torjubel (~3 s) und Bully
  (~4 s) je Tor stehen 70 von 240 Simulationssekunden still — 30 % Standphase. Bei 3,5 sind es
  49 s, 20 %.

Zum Vergleich Basketball: 87 Punkte je Spiel in 360 s, ein Korb alle ~8 s. Hockey lebt vom
Gegenteil — jedes Tor ist ein Höhepunkt, und das trägt nur, wenn es selten genug ist, dass der
Jubel nicht zur Routine wird. **3,5 je Team** (Korridor 3–4) ist meine Zahl. Unentschieden dabei
15,4 % (Poisson), heute 18,8 %, bei 3,0 wären es 16,7 % — die Quote bewegt sich mit der Torzahl
kaum; F.3 („zulassen") hält.

### 3.3 Die Rechnung, an der alles hängt: Tempo × Quote

Basketball live liefert **41 Feldwürfe je Team in 360 s** (82,1 FGA beide Seiten, n=12; der
Planautor misst 82,3 bei n=24) — ein Abschluss je Team alle 8,8 s, unabhängig von der Feldgröße
(79,8 bei 2v2, 85,0 bei 3v3). Hält Hockey dieses Tempo, sind das in 240 s **~27 Abschlüsse je
Team** — zufällig genau die NHL-Schusszahl. Dann:

| Trefferquote | Tore je Team | Fangquote | Charakter |
|---|---|---|---|
| 10,9 % (NHL 2024-25) | 2,9 | .891 | Simulation |
| **13 %** | **3,5** | **.870** | „ein paar mehr" — **Empfehlung** |
| 16 % | 4,3 | .840 | obere Grenze |
| 25 % | 6,8 | .750 | heute |

Das ist der Grund, warum die Tempo-Garantie (2.2.2) nicht wegfallen darf: **ohne** Kappe auf
die Angriffsdauer sinkt die Abschlusszahl, und um dann noch 3,5 Tore zu erreichen, muss die Quote
steigen — bei 15 Abschlüssen wären es 23 %, und die Fangquote läge bei .77, was jeder Zuschauer
als „der Torwart hält nichts" liest. Die Torzahl ist also über Quote **und** Tempo zu
kalibrieren, und beide gehören in dieselbe Abnahmetabelle:

| Kennzahl | Ziel | Art |
|---|---|---|
| Abschlüsse je Team (240 s) | 24–28 | Tempo — misst die Angriffsdauer |
| Trefferquote (Tor / Schuss aufs Tor) | 13–16 % | Quote |
| Fangquote | .84–.87 | folgt |
| Tore je Team | 3–4, Mittel 3,5 | folgt |
| Geblockt je Team | 5–8 (NHL 11–18 bei 55 Versuchen, proportional) | Quote |
| Nachschüsse nach Abpraller je Spiel | 2–4 | gesetzt (keine Referenz) |
| Unentschieden | 13–17 % | folgt |

Der erste Plan (D.3) setzt 8–13 % und .870–.920 als „harte Quote, direkt gegen NHL". Das ist
bei 27 Abschlüssen 2,2–3,5 Tore — also die **Realismus**-Zeile, nicht Chris' „ein paar mehr".
Ich empfehle, die untere Grenze auf 13 % zu heben und dafür den Abschluss-Korridor als
gleichrangige Zielgröße hinzuzunehmen.

### 3.4 Spieldauer

Plan F.4: 3 × 1:20 = 240 s, Dehnung 2 → 8 Minuten. Ich stimme zu, mit einer Ergänzung:
Standphasen (Bully, Jubel, Drittelpausen) halten die Uhr an (`fsT` steht, wie bei Freiwurf und
Viertelpause, `:6031–6046`), das Budget in `MOTOREN[fd].lauf` (`:13026`: `SPIELDAUER+60`) muss
für Hockey mit ~55 Bullys real, bei uns ~10–15, um die Standphasen erweitert werden. Bei 3,5
Toren je Team plus Festhalten sind das ~15 Bullys à 4 s = 60 s — die Reserve ist exakt
aufgebraucht. Auf 90 s setzen.

---

## 4. Der Basketball-Stand, Punkt für Punkt

Legende: **Ü** übernehmen wie es ist · **K** übernehmen mit anderer Kalibrierung · **E** ersetzen
· **W** fällt weg.

### 4.1 Struktur und Zeit

| Basketball | Urteil | Hockey-Gegenstück |
|---|---|---|
| 4 × 90 s, `VIERTEL_*_BASKETBALL` | K | 3 × 80 s; Konstanten in die `FELDSPIEL_ART`-Zeile (PR 2, wie geplant) |
| Viertelpause mit Slot-Rotation (`starteViertelpause` `:4492`) | K | Drittelpause; Rotation „zurückliegend → offensiver" gilt (real: „pulling the goalie" ist die Extremform — nicht bauen, aber die Vorwärtsverschiebung der Verteidiger ja) |
| Schussuhr 8 s | **E** | Klär-Ereignis nach ~10 s Angriffszeit (2.2.2) — dieselbe Kappe, sichtbar als Aktion |
| Geduld-Schwelle `SCHWELLE_ABBAU=4` | Ü | gleich; Hockey schießt eher früher („throw it at the net") — Schwelle 0,42 → 0,35 |
| `fsLive.phase` laufend/freiwurf | K | laufend / bully / penalty / drittelpause — die Naht ist dafür gebaut (`:4356 ff.` nennt Bully wörtlich) |

### 4.2 Positionen und Bewegung

| Basketball | Urteil | Hockey-Gegenstück |
|---|---|---|
| `SLOTS` (`:4252`): sechs Punkte als Radius+Winkel um den **gegnerischen** Korb | **E** | zwei Sätze je Rolle: Angriffs-Heimat um das gegnerische Tor **und** Abwehr-Heimat um das eigene (Abschnitt 6). Basketball hat nur die Angriffshälfte, weil Verteidigung dort Manndeckung ist |
| `zuordneSlots` sortiert alle nach Schusswert | **E** | Rolle bestimmt die Slot-Familie (Slot / Flügel / Point), Sortierung nur innerhalb der Familie (Abschnitt 6.3) |
| `bewegeSpielerLive` mit `tempoPx=(230+(LAUFTEMPO−50)·0,70)·tempoMul` (`:6015`) | K | Eislaufen ist schneller als Laufen: Grundtempo ~1,3×, aber Richtungswechsel träger — ein kleiner Trägheitsterm (`vx/vy` existieren) statt sofortiger Zielumkehr; sichtbar als Gleiten |
| Screen & Roll (`screent`, `rollBis`) | **W** | kein Hockey-Gegenstück; Ersatz: **Netfront-Screen** — ein Flügel stellt sich vor den Torwart, Parade-Chance sinkt (`screened shots` sind in den xG-Modellen ein Merkmal, hockeyR: kein eigenes; nhlspecialteams: 5,8 % geschirmt gegen 4,9 % frei) |
| Fastbreak / Ausbruch (`startFastbreak` `:5456`, `ausbruchBis`) | Ü | Konter / Odd-Man-Rush — zentraler als im Basketball; `rush` ist in allen xG-Modellen ein Merkmal (hockeyR: Schuss ≤ 4 s nach Ereignis in NZ/DZ) |
| Manndeckung `zuordneDeckung` | K | bleibt, aber mit größerem `sag` und Zonen-Heimat (Box+1) — Verteidiger stehen **zwischen** Puck und Tor, nicht am Mann |
| Mann verloren (`verlorenBis`, `letzteSicht`) | Ü | gleich |
| Hilfsverteidigung `HILFE_RADIUS=90` | K | wird zum Forecheck-F2: Passwege zustellen statt Doppeln |
| Fokus-Doppeln `fokusZiel` | Ü | Chris' Eingriff wird zum Forecheck-Ziel; unverändert |
| Mismatch (`mismatchTempo/Wucht`) | Ü | gleich; „Wucht" liest künftig CHECK statt SCHUSS_NAH |
| Separation (`SEP_*`) | Ü | gleich |

### 4.3 Ball als Objekt

Siehe 2.1: drei Zustände **Ü**; Pass **Ü**; Wurf **E** (Ziel, Auflösung); freier Ball **K**;
Dribbeln **K** (Schläger-Versatz statt Bounce, Sound: kein Hockey-Set vorhanden — `bkSfx` ist an
`feldspielDisc==="basketball"` gegatet, `:5444` u. a.).

### 4.4 Das Wurfmodell

| Basketball | Urteil | Hockey-Gegenstück |
|---|---|---|
| vier Distanzstufen `klassifiziereWurfdistanz` (`:3814`) | **E** | Distanz **und Winkel** als zwei stetige Achsen (Abschnitt 8.4); Stufen nur für die Sonde (Bänder) |
| `GEO_BONUS` je Stufe | **E** | Zonentabelle aus den xG-Kurven (8.4), monoton in Distanz, monoton im Winkel |
| `steilerMake` mit `SKILL_MITTEL`, `STEIL_MAKE=12`, `MAKE_KORREKTUR` (`:3722–3736`) | K | die **Form** (logistische Aufsteilung um einen gemessenen Mittelwert) bleibt; `SKILL_MITTEL` und `MAKE_KORREKTUR` sind gemessene Basketball-Werte und müssen nach 3b für Hockey **neu gemessen** werden — sie dürfen nicht übernommen werden |
| Bedrängnis stufenlos `bedraengnisGate`, `kontestFaktor`, `doppelMalus` (`:4700 ff.`) | K | bleibt für den **Schuss**; der Torwart ist ein **zweiter**, unabhängiger Term (2.3). Kontest = Verteidiger auf der Schusslinie → geht in `p_block`, nicht in die Quote |
| Skill-Anteil `schussSkillFuer·0,0022 + TEAMGEIST·0,0030` | K | `SCHUSS_NAH/FERN` nach Zone, LINIENSPIEL statt TEAMGEIST |
| Freiwurf-Formel `verbucheFreiwurf` (`:5116`) | K | Penalty: Schütze gegen Torwart, Basis ~32 % (hockeyR setzt Penalty-Schüsse pauschal auf 0,32) |
| gegen NBA-FG% kalibriert (71,4 % offen / 58,9 % bedrängt) | E | gegen 3.3 kalibriert |

### 4.5 Standphasen, Schiedsrichter, Fouls

| Basketball | Urteil | Hockey |
|---|---|---|
| Freiwurf-Phase (`starteFreiwuerfe` `:5192`, `freiwurfAufstellung`, `freiwurfGeo`) | K | Bully (häufig) und Penalty (selten) auf derselben Phase; Bully-Geometrie: 5 Punkte (Mitte, 4 in den Zonen) |
| `fsSchiri` | Ü | gleich; im Hockey sind es real zwei Linesmen, einer reicht |
| Foul → Freiwurf, Schwebetext | **E** | Foul → Strafzeit (PR 8); bis dahin Foul = Feed-Text ohne Folge |

### 4.6 Zwei Rebound-Achsen

Ü in der Form (loser Puck, `losGewicht(ZWEITCHANCE)`, `REB_BOXOUT` als Seitenfaktor —
`:6180 ff.`), **K** in der Zahl: Achse 1 (Anteil offensiv) hat keine NHL-Referenz — gesetzt
markieren. Achse 2 (die Seite mit höherer ABPRALLER-Summe hat die höhere Quote) gilt
unverändert, und der Nenner-Befund (Rohzahl misst Wurfvolumen) gilt für Hockey genauso.

### 4.7 Boxscore und Impact

| Basketball | Hockey |
|---|---|
| Punkte, Rebounds, Assists, Steals, Blöcke, Verluste, Fouls, FGA/FGM | Tore, Vorlagen, Schüsse, Checks, geblockte Schüsse, Abpraller gewonnen, Verluste, Strafminuten (später); Torwart: Saves, Gegentore, Fangquote, festgehalten |
| je Wurf `tier`, `deckerAbstandBeiWurf` | je Schuss `distanzBeiSchuss`, `winkelBeiSchuss`, `blockerAbstand`, `abpraller` (bool), `torwartParade` — **ohne diese vier ist die Abnahme nicht fahrbar** (dasselbe Argument wie bei Basketball) |
| `wert = punkte + assists + 1,2·reb + 1,5·(stl+blk) − 0,8·to` (`:13030`) — für **alle** Feldspiele | **muss je Disziplin gesetzt werden, vor jeder Sondierung** (mein Befund 2, bestätigt: heute ist ein Check 1,5 Tore wert). Vorschlag Hockey: `tore·3 + vorlagen·2 + checks·0,4 + bloecke·0,5 + abpraller·0,5 − verluste·0,6`; Torwart: `saves·0,35 − gegentore·1,5 + festgehalten·0,1` — Größenordnung so, dass ein Torwart mit .870 in einem 3:3 etwa den Impact eines Zwei-Tore-Schützen hat. PLATZHALTER, gegen die Rangtreue zu messen |
| `WERTUNG_KOPF` je Modus (kampf/feldspiel, `:9948`) | je **Disziplin**; PR 9 nennt das, es wird aber mit dem Torwart (eigene Spalten) fällig, nicht erst bei der Produktivierung |

### 4.8 Sub-Skills

Basketballs zehn → Hockeys zwölf aus Plan B.2 (SPIELAUFBAU, ABSCHLUSSDRANG, SCHUSS_NAH,
SCHUSS_FERN, PUCKFUEHRUNG, ABPRALLER, CHECK, SCHUSSBLOCK, LINIENSPIEL, SCHICHTKRAFT, TEMPO,
PARADE). Zwei Auflagen aus dieser Recherche: PARADE liest nur der Torwart (E′), und SCHUSSBLOCK
braucht die Schusslinien-Prüfung (`distZuLinie`, existiert) als Kanal — sonst ist er tot wie
Basketballs AUSDAUER.

### 4.9 Die Abnahme — fünf Zahlen

| Basketball | Hockey |
|---|---|
| Pp (`messe-arena-einfluss.mjs`) | gleich; Torwart in `namen/wert` aufnehmen |
| Rangtreue rho (`miss-feldspiel-rangtreue.mjs`), 0,836/0,804 | gleich; **Torwart-Rang** braucht eine eigene Eignung — `u.eig` ist heute Disziplinwert + Slot + Form (`:4053`), also ein Feldspieler-Maß; der Torwart bekäme mit dem Hockey-Disziplinwert (power/health-lastig) einen Rang, der nichts mit PARADE zu tun hat. Vorschlag: Torwart aus rho(Seite) ausnehmen und separat prüfen (Fangquote gegen PARADE über n Spiele, Spearman) |
| Spiegeltest 0,0 % | gleich, plus: beide Torhüter identisch → Saves identisch |
| Rollenprobe V (starker/schwacher Decker) | wird zu **V** (Schütze gegen starken/schwachen Torwart, gepaart je Schütze) — der Torwart ist Hockeys „Decker" |
| Rollenprobe S (offen/bedrängt in Abstandsbändern) | wird zu **S** (Schuss ohne/mit Blocker auf der Linie) **und Z** (Trefferquote je Distanz-/Winkelband gegen die Zonentabelle — die Sonde prüft, ob der Motor die Tabelle wirklich abbildet) |
| Sondierung 21,8 / 17,5 / 14,8 / 11,4 / 10,3 | gleich — **erst nach** Impact-Formel, Zonentabelle und Torwart-Term (Reihenfolge Abschnitt 9) |

### 4.10 Basketball-Zahlen als Messlatte

87,3 Punkte · 101,8 Ballwechsel · 82,3 FGA · Usage 33,4 % · OREB 23,5 % · rho 0,836/0,804.
Hockeys Entsprechung: 7 Tore · **80–100 Ballwechsel** (das ist die Tempo-Zahl aus 3.3, sie
gehört als Ziel dazu) · 50–56 Abschlüsse · Usage des Besten **≤ 25 %** (Plan C.3.4, Ziel kehrt
sich um — zustimmend) · OREB-Gegenstück gesetzt · rho ≥ 0,74 (Plan D.2) ohne Torwart.

---

## 5. Was mit der Aufstellung heute wirklich passiert — zwei Slot-Begriffe

Bestätigt am Code: `slotId` (Rolle, aus `place`) wirkt **nur** über `slotAufschlag` (±8,5 auf
den Disziplinwert, `:2869`, angewandt `:4028`) und bei Basketball über `BASKETBALL_POS_MOD`
(`:3996`, ±1–4 auf Sub-Skills). `u.slotIdx` (Position 0..5) wird **ausschließlich** in
`zuordneSlots` (`:4313`) nach Schusswert gesetzt und in `bewegeSpielerLive` (`:5786`) zufällig
auf einen freien Slot umgesetzt, wenn der Decker zu nah steht. Die beiden hängen nirgends
zusammen — Chris' Center steht heute dort, wo sein SCHUSS_NAH ihn hinsortiert, und das kann
die Ecke sein.

Und die Rolle kommt in Produktion gar nicht erst an (1.1). Was fehlt, ist das Rohr
(`buildArenaTeam` → `window.__olyArenaKader` `:2375` → `place`), nicht die Buchse
(`slotFuer` liest `place` schon).

---

## 6. Rolle → Position: die Recherche, die Chris verlangt hat

### 6.1 Reale Formationen

**Basketball, Halbfeldangriff** (sportplan.net, Wikipedia „Basketball positions"): PG (1) oben
am Top of the Key organisiert; SG (2) und SF (3) auf den Flügeln („wing players"); PF (4) und C
(5) am Key, der Center „closest to the basket — in the post". Belegt mit Wurfprofilen: Center
nehmen ~50 % ihrer Würfe aus der Restricted Area, Shooting Guards ~50 % Dreier (Dartmouth
Sports Analytics). Verteidigung: der Center steht als Rim Protector unter dem Korb, Guards
verteidigen am Perimeter — d. h. auch die **Abwehr-Heimat** ist rollenabhängig, nicht nur die
Angriffsposition.

**Hockey, Angriffsdrittel** (learn-ice-hockey.com, icehockeyguide.com, crossicehockey.com,
Wikipedia „Centre (ice hockey)"): Center im **Slot** (zwischen den Bullykreisen, von deren
Oberkante bis vors Tor) oder an der **Half-Wall** (Bande auf Bullypunkt-Höhe); Flügel im
**hohen Slot** zwischen den gegnerischen Verteidigern, treiben zum Tor oder schießen von der
Half-Wall; Verteidiger an den **Points** (blaue Linie), „keep the puck in the zone".
Forecheck (thecoachessite.com, hockeyshare.com): 1-2-2 — F1 auf den Puckträger an die Bande,
F2/F3 in der Mitte, D an der blauen Linie; 2-1-2 — F1 und F2 tief, F3 hoch am
Bullykreis-Oberrand.

**Hockey, eigene Zone** (hockeyshare.com, weisstechhockey.com, blueseatblogs.com): **Box+1** —
zwei Verteidiger tief an den Pfosten, zwei Flügel hoch (Innenseite der gegnerischen Points),
Center als „+1" frei zum Puck; **Low Collapse** — vier oder fünf Spieler unter der
Bullykreis-Oberkante, wenn der Puck hinter dem Tor oder an den Points ist; alternativ 2-1-2
(zwei an den Pfosten, einer im mittleren Slot, zwei am Kreis).

**Torwart** (usahockeygoaltending.com, betterhockey.com, seltytending.com): Grundtiefe
„Schlittschuhe an der Torraum-Oberkante", Körper quadratisch zum Puck; seitliche Bewegung
„push, don't reach"; im Butterfly gehen Abpraller in die Ecken, schräg stehend in den Slot.

### 6.2 Datenform

Heute: `SLOTS[i] = {radius, seitlich}` relativ zum **gegnerischen** Korb, ein Satz für alle.
Das reicht nicht, weil (a) Abwehr-Heimaten fehlen und (b) die Zuordnung Rolle→Slot fehlt.
Vorschlag, in `FELDSPIEL_ART[d].formation`, je Rolle (Slot-Id der Disziplin):

```
formation:{
  // Hockey, 6 = 5+1. Radien in px relativ zur jeweiligen Torlinie, `seitlich` in Vielfachen von 90px
  center:        { angriff:{radius:110, seitlich:0},     abwehr:{radius:120, seitlich:0} },     // Slot / +1
  wingL:         { angriff:{radius:150, seitlich:+1.2},  abwehr:{radius:190, seitlich:+1.0} },  // Half-Wall / hoher Flügel
  wingR:         { angriff:{radius:150, seitlich:-1.2},  abwehr:{radius:190, seitlich:-1.0} },
  defL:          { angriff:{radius:260, seitlich:+0.9},  abwehr:{radius:55,  seitlich:+0.5} },  // Point / Pfosten
  defR:          { angriff:{radius:260, seitlich:-0.9},  abwehr:{radius:55,  seitlich:-0.5} },
  goaltender:    { fest:{radius:14, seitlich:0} }                                              // Torraum-Oberkante
}
```

Zwei Sätze je Rolle sind nötig — genau Chris' Beispiel: der Center ist im Angriff *und* in der
Abwehr unterm Korb, ein Guard nie. Für Basketball dieselbe Form (`center: angriff r=60,
abwehr r=50`; `pointguard: angriff r=130 seitlich 0, abwehr r=140`; Flügel/Ecken wie heute).
Der Torwart ist der Sonderfall „ein Satz, fest" — die einfachste Zeile der Tabelle.

`radius`/`seitlich` sind heute in `bewegeSpielerLive` (`:5755–5760`) schon der echte Abstand mit
berechneter X-Komponente; daran ändert sich nichts. Neu ist nur der Lookup: `SLOTS[u.slotIdx]`
→ `formation[u.rolle][ballSeite===u.side?"angriff":"abwehr"]`, mit den Radien um das
**jeweils richtige** Tor.

### 6.3 Wie viel Freiheit bleiben muss

Sechs Figuren an sechs Punkten sind tot — Basketballs Bewegung entsteht heute aus dem Neumischen
in `zuordneSlots` und dem Slot-Tausch bei Bedrängnis. Der Zusammenhang, den `zuordneSlots`
belegt hat („der Positionskanal ist ein RANGWECHSEL", Kommentar `:4270 ff.`), ist real: wer
innen steht, trifft öfter — die Position **ist** ein Skill-Kanal. Wird sie an die Rolle gebunden,
wandert dieser Kanal vom Motor in Chris' Aufstellung. Das ist gewollt (der Manager entscheidet),
verschiebt aber Balance.

Grenze, die ich vorschlage:

1. **Rolle bestimmt die Familie, nicht den Punkt.** Familien Hockey: `tief` (Center, Slot),
   `flügel` (2), `point` (2), `tor`. Familien Basketball: `innen` (C, PF), `flügel` (SG, SF),
   `oben` (PG). Innerhalb der Familie sortiert weiter der Schusswert (Basketball) bzw. der
   Zonen-Skill (Hockey) — `zuordneSlots` bleibt, arbeitet aber je Familie.
2. **Der bedrängnisbedingte Slot-Tausch (`:5786`) bleibt, aber nur innerhalb der Familie.**
3. **Die Heimat ist ein Ziel, keine Fessel.** Fastbreak, freier Ball, Hilfe, Screen/Netfront
   überschreiben sie wie heute (die `else if`-Kette in `bewegeSpielerLive` bleibt in der
   Reihenfolge). Ein Center läuft zum losen Puck, auch wenn seine Heimat der Slot ist.
4. **Drittel-/Viertelrotation** verschiebt Familien um eine Stufe (Rückstand: ein Point wird
   Flügel), nicht Einzelpunkte.

Damit erkennt Chris seinen Center **im Mittel** unterm Korb wieder (Ziel: ≥ 60 % der
Angriffsticks in seiner Familie — messbar über die Positionsablage `diagDetail`, die es schon
gibt), ohne dass die Figuren stehen.

### 6.4 Rückwirkung auf die Abnahme — und die Reihenfolge

Sobald Positionen an Rollen hängen, ändern sich Wurfdistanzen (`tier`-Verteilung),
Deckerabstände und damit V, S, rho und Pp — bei **Basketball**, das heute abgenommen ist. Das
ist eine Balance-Änderung mit Vorher/Nachher-Messung (n ≥ 60, 6v6 und 4v4, wie im
`zuordneSlots`-Kommentar für die verworfene Slot-0-Variante), und Chris entscheidet über das
Ergebnis. Konkret erwarte ich: rho(Seite) sinkt leicht (der Rangwechsel-Kanal ist weg), Usage
des Besten sinkt, S:dPp bleibt. Wenn rho unter 0,74 fällt, ist das der Preis dafür, dass die
Aufstellung wirkt — und dann ist es Chris' Entscheidung, nicht ein Messfehler.

**Zur Reihenfolge, die der Planautor vorschlägt („erst Leitung, dann Torwart"):** halb richtig.
Richtig ist, dass Rohr (Aufstellung → Arena) und Datenform (Rolle → Heimat) **einmal** gebaut
werden müssen und der Torwart ihr einfachster Fall ist. Falsch wäre, den Torwart hinter
Basketballs Balance-Runde zu stellen. Der Torwart braucht nur (a) das Rohr für **eine** Slot-Id
und (b) **eine** feste Position — beides ohne die Familien-Logik und ohne Basketballs
Neuvermessung. Vorschlag:

- **PR „Rohr":** `buildArenaTeam` reicht `place` (Spieler → Slot-Id je Disziplin) durch, der
  Runner setzt `window.__olyArenaKader.place`, `slotFuer` liest es. Kein Motorverhalten ändert
  sich (die Slots wirken weiter nur über `slotAufschlag`), aber jetzt der **richtige** Slot je
  Spieler. Basketball bit-identisch **nur**, wenn `place` leer bleibt — mit gefülltem `place`
  ändern sich die Aufschläge, das ist die erste sichtbare Wirkung der Aufstellung und ein
  eigener, kleiner Abnahmepunkt.
- **PR „Formation-Datenform + Torwart":** `formation` in `FELDSPIEL_ART`, für Hockey komplett,
  für Basketball zunächst **nur als Daten ohne Wirkung** (Lookup bleibt auf `SLOTS`, bis die
  Balance-Runde läuft). Hockey ist zu diesem Zeitpunkt noch nicht abgenommen, verliert also
  nichts.
- **PR „Basketball Rolle→Position":** Lookup umschalten, messen, Chris vorlegen.

So verkürzt die Reihenfolge den Hockey-Weg tatsächlich (der Torwart wartet auf nichts, was
Basketball betrifft) und baut nichts zweimal (eine Datenform, ein Rohr). Die Variante „erst die
ganze Leitung samt Basketball-Abnahme" **verschiebt** Hockey nur.

---

## 7. Wo die Umsetzung teurer wird, als sie aussieht

1. **Das Rohr Aufstellung → Arena** (1.1). Betrifft `arena-kader-adapter.ts`,
   `arena-headless-runner.ts:195–209`, den Host `FoundationBattleArenaHost.tsx`, das Mockup
   (`:2375–2395`) und den Test `tests/arena-headless-runner.test.ts`. Ohne es ist Chris' Slot
   Dekoration.
2. **Der Slot-Generator** (1.5): Deckel, Ausgleichsslot, Reihenfolge, Neugenerierung, sichtbare
   Änderung der bestehenden Hockey-Profile im Aufstellungsbildschirm.
3. **Der Ausgang wird beim Abschuss gewürfelt** (`:5033`), der Torwart „reagiert" auf einen
   feststehenden Ausgang. Jeder zusätzliche **bedingte** `rr()`-Aufruf verschiebt die
   Zufallsfolge zwischen Basis- und Hebungslauf von `einflussVon` (Kommentar `:3690 ff.`:
   50–65-Pp-Plateau als Messartefakt). Die vier Ausgänge müssen mit einer **festen** Zahl
   `rr()`-Aufrufe je Schuss gewürfelt werden (z. B. immer drei), sonst misst die Pp-Sonde
   Rauschen.
4. **`wert()`, `namen()`, Wertungstabelle, Rangtreue** kennen nur `FSTEAM` (4.7, 4.9). Der
   Torwart ist ohne Nacharbeit für jede Messung unsichtbar, und mit `u.eig` als Feldspieler-Maß
   falsch eingeordnet.
5. **PR 3b „Hockey live mit Basketballs Formeln"** liefert mit `GEO_BONUS.dunk=0,70` vor dem
   leeren Tor ~90 % Treffer aus Nahdistanz; der Sondierungslauf 3c misst dann Gewichte gegen
   eine Formel, die PR 4 ersetzt — exakt der Fehler, den mein erstes Review als Befund 2/6
   beschrieben hat. Reihenfolge in Abschnitt 9.
6. **Eisfläche und Tor gehören vor 3b, nicht in PR 7.** Ein Torwart braucht ein Tor, in dem er
   steht, und Platz dahinter (`korbXVon` `W·0,915` → Torlinie `W·0,88`). `bodenFeldspiel`
   (`:6432`) fällt für Hockey auf den neutralen Platz (`:6455`) — mindestens Tore, Torraum,
   blaue Linien, Bullypunkte müssen mit 3b kommen; Optik-Politur kann warten.
7. **Tests pinnen Basketball:** `tests/battle-mode-arena-team-points.test.ts:133`,
   `tests/arena-headless-runner.test.ts:113,155–235`, `battle-mode-arena-team-points.ts:32,177`.
8. **Sound:** kein Hockey-Set; alle `bkSfx` sind an Basketball gegatet. Chris meldet am 25.08.
   (`bug-reports`), dass Sound bei ihm in der Arena gar nicht läuft — ein offenes Ticket, das
   mit Hockey nicht schlimmer, aber auch nicht besser wird.
9. **Das Zweierspiel** braucht eine eigene Zieltabelle (1.4) — sonst 11 Tore je Team.
10. **`MOTOREN[fd].lauf`-Budget** (3.4): Standphasen fressen die 60-s-Reserve.
11. **Lizenzen der xG-Repos** (8.3): vier von fünf ohne Lizenzdatei — Zahlen ja, Code nein.

---

## 8. Fremder Code: EA NHL und die offenen xG-Modelle

### 8.1 EA NHL

Proprietär; keine öffentliche Attribut- oder Wahrscheinlichkeitsformel. Was kursiert, sind
Spieler-Ratings — nutzlos für Fantasy-Charaktere mit eigener Zwölfer-Matrix. Nicht weiter
verfolgt.

### 8.2 Erreichbarkeit der sechs Repos

| Repo | Erreicht | Wie |
|---|---|---|
| `JNoel71/NHL-Expected-Goals-xG-Model` | ja | `git clone --depth 1` über den Proxy |
| `RentoSaijo/NHLxG` | **nein** | `add_repo` verweigert (Cross-Owner), `github.com/RentoSaijo/NHLxG` liefert 404 — Repo existiert unter diesem Namen möglicherweise nicht mehr |
| `Nick-Glass/Hockey-XG-Model` | ja | clone |
| `HarryShomer/xG-Model` | ja | clone |
| `danmorse314/hockeyR-models` | ja | clone |
| `michael-hainke/NHL` | ja | clone |

GitHub-API (`api.github.com`) ist im Proxy gesperrt, `gh` nicht installiert — nur Git-Reads.

### 8.3 Lizenzen — gelesen, nicht vermutet

| Repo | Lizenzdatei | Folge |
|---|---|---|
| JNoel71 | **GPL-3.0** (`LICENSE`) | Code-Übernahme würde unser Repo GPL-pflichtig machen. Zahlen/Struktur sind keine Codeübernahme |
| Nick-Glass | keine | alle Rechte vorbehalten; nur Lesen/Forken nach GitHub-Terms |
| HarryShomer | keine | dito |
| danmorse314/hockeyR-models | keine (das Paket `hockeyR` selbst ist separat lizenziert — nicht geprüft) | dito |
| michael-hainke | keine | dito |

**Regel für uns:** kein Code, kein trainiertes Modell (`.rds`/`.pkl`), keine Grafik. Was wir
mitnehmen, ist die **Merkmalsstruktur** und **abgeleitete Größenordnungen** — Fakten, nicht
Werke — mit Quellenangabe im Code-Kommentar. Bei GPL-3.0 (JNoel71) gilt das genauso.

### 8.4 Was die Modelle sagen — Struktur und Größenordnungen

**Merkmale, in der Rangfolge der hockeyR-Feature-Importance** (Grafik
`figures/hockeyR_xg_5v5_feature_importance.png`, selbst angesehen): `shot_distance` (~0,35, mit
Abstand vorn) · Schusstyp `snap_shot`/`wrist_shot` (~0,09) · `time_since_last` (~0,09) ·
`shot_angle` (~0,07) · `slap_shot`/`tip_in` (~0,05) · `backhand` (~0,045) · `deflected` (~0,03)
· `distance_from_last` (~0,025) · `rebound` (~0,02) · `last_y`/`empty_net`/`last_x` (~0,01) ·
Rest (`cross_ice_event`, `rush`, `last_*`, Ären) < 0,01. hockeyR definiert `rebound` = Schuss
≤ 2 s nach Fenwick-Ereignis, `rush` = Schuss ≤ 4 s nach Ereignis in NZ/DZ
(`R/build_xg_model.R:111–112`). MoneyPuck nennt 15 Variablen mit Distanz an erster Stelle und
kodiert Abpraller/Konter indirekt über „speed from previous event". JNoel71 (LightGBM, 28
Merkmale, AUC 0,78) und Nick-Glass (XGBoost, AUC 0,82) haben dieselben Kernachsen; Nick-Glass
definiert **High Danger** als „30 ft in front of the crease, 16 ft wide" und Medium Danger als
„next to the slot" — eine Zonen-Definition, die wir übernehmen können. HarryShomer (GBM, 13
Merkmale) fügt `Is Forward` und `Off Wing` hinzu; Hainke (WOE-Logit, 4 Merkmale, AUC 0,72)
liefert die anschaulichsten Kurven.

**Torwahrscheinlichkeit nach Distanz** — aus Hainkes WOE-Kurve (`Images/shot_dist.png`)
umgerechnet, Annahme: Basisrate 10 % (der Text nennt „about 10 % of total sample"), Bänder in
Fuß von der Torlinie:

| Distanz (ft) | WOE (abgelesen) | Torwahrscheinlichkeit | Zone bei uns |
|---|---|---|---|
| 1–10 | +0,90 | ~21 % | Torraum-Rand |
| 10–14 | +0,70 | ~18 % | tiefer Slot |
| 14–20 | +0,52 | ~16 % | Slot |
| 20–27 | +0,26 | ~13 % | hoher Slot |
| 27–33 | −0,05 | ~10 % | Bullykreis-Oberkante |
| 33–39 | −0,46 | ~6,5 % | Half-Wall-Höhe |
| 39–45 | −0,77 | ~5 % | |
| 45–52 | −1,00 | ~4 % | Point |
| 52–59 | −1,10 | ~3,6 % | blaue Linie |
| 59–98 | −1,15 | ~3,4 % | jenseits |

**Nach Winkel** (`Images/angle.png`, gegen die Torlinie gemessen, 0° = frontal):

| Winkel | WOE | Torwahrscheinlichkeit |
|---|---|---|
| 0–2,5° | +0,90 | ~21 % |
| 2,5–4° | +0,35 | ~14 % |
| 4–11° | +0,26 | ~13 % |
| 11–18° | −0,03 | ~10 % |
| 18–23° | −0,23 | ~8 % |
| 23–33° | −0,32 … −0,40 | ~7 % |
| 33–41° | −0,27 | ~8 % (Hainke: „Petterzone", One-Timer von den Hash-Marks) |
| 41–54° | −0,38 | ~7 % |
| > 54° | −0,57 | ~6 % |

Beide Kurven sind **monoton** (bis auf die 33–41°-Delle). Konsistent damit: 21/55/73 % der
Tore aus ≤10/20/30 ft (snipersedge), „point shot 1–3 %, house 5–15 %" (hockeysarsenal — dort
auf Versuche statt Schüsse aufs Tor bezogen, deshalb niedriger), Ablenker ~20 %, Abpraller „up
to 1 in 5" gegen Basis 6,6 % (expectedbuffalo).

**Vorschlag für Hockeys `GEO_BONUS`-Gegenstück** — zwei Achsen statt vier Stufen, als Faktor auf
eine Basisquote, Maximum am Torraum-Rand frontal, kein Abfall bei kleiner Distanz:

```
// Torwahrscheinlichkeit VOR Torwart und Schütze, relativ zur Ligabasis (1,0 = 10-11 %).
// Quelle der Form: WOE-Kurven Hainke (github.com/michael-hainke/NHL, xG Model/Images),
// hockeyR-Importance (Distanz >> Winkel), Nick-Glass High-Danger-Definition. Zahlen
// umgerechnet, nicht kopiert; Basisrate 10 % angenommen. PLATZHALTER bis zur Messung.
zone(dist_ft, winkel_grad) = distFaktor(dist) * winkelFaktor(winkel)
distFaktor:   ≤10:2.0  ≤20:1.6  ≤27:1.3  ≤33:1.0  ≤45:0.55  ≤59:0.38  sonst 0.34
winkelFaktor: ≤4:1.5   ≤11:1.25 ≤18:1.0  ≤33:0.75 ≤54:0.72  sonst 0.6
abprallerFaktor (Schuss ≤ 2 s nach Save):  ×2.5     (expectedbuffalo: 6,6 % → bis 20 %)
ablenkerFaktor (Schusstyp tip/deflect):     ×1.8     (~20 % Verwertung)
leeresTor (n=2):                             ×4–5, gedeckelt bei 0.5
```

Umrechnung px ↔ ft: die Torlinie liegt bei uns auf `W·0,88`, die blaue Linie real 64 ft
davor (89−25), bei `H=470` und Rinkbreite 85 ft entspricht 1 ft ≈ 4,4 px → Slot-Oberkante
(30 ft) ≈ 130 px, Point (55 ft) ≈ 240 px. Das passt zur Formation in 6.2.

**Die Grenze, die der Planautor gezogen hat, halte ich ein:** die Tabelle sagt, wie ein Schuss
von *dort* fällt. Was SCHUSS_NAH, PARADE oder LINIENSPIEL daran drehen, ist Chris'
Budget-Methode plus Sondierung — dafür gibt es in keinem Repo eine Zahl, und das lineare
Vorhersagemodell ist bei Basketball an genau dieser Stelle gescheitert (49 Pp Prognosefehler).

---

## 9. Reihenfolge, die ich empfehle

| Schritt | Was | Ändert Spielverhalten |
|---|---|---|
| R | Rohr Aufstellung → Arena (`place` durchreichen) | nur Slot-Aufschläge — erste sichtbare Wirkung der Aufstellung, eigene Abnahme |
| G | Slot-Generator: Torwart-Thema Index 2, eigener Deckel, verteilter Ausgleich; neue Hockey-Profile Chris zeigen; `generiere-arena-daten.ts --schreiben` | Produktionsdaten |
| 2 | Zeit-/Periodenkonstanten in `FELDSPIEL_ART` (wie geplant) | nein |
| 3a | Live-Engine umbenennen, Konfiguration heben (wie geplant) | nein |
| **3b′** | Hockey live **mit** Torwart-Objekt (E′), Tor als Linie, Schussauflösung mit vier Ausgängen, Zonentabelle aus 8.4, Bande/Klemme, Bully-Phase, Klär-Ereignis, Impact-Formel je Disziplin, Boxscore-Spalten — **noch mit Platzhalter-Zahlen** | ja, Hockey |
| 3c | Sondierung — jetzt gegen die richtige Struktur | Messung |
| 4 | Sub-Skills, Rezept, Kalibrierung gegen 3.3 | ja |
| 5–8 | wie geplant (Rangtreue/Archetypen, Drittelpause, Eisfläche-Politur, Strafzeit) | |
| F | Formation je Rolle für Basketball (6.2–6.4), Balance-Runde, Chris' Abnahme | ja, Basketball |
| 9 | Produktivierung (Orchestrator je Disziplin, wie im ersten Review) | ja |

3b′ ist größer als das geplante 3b, aber es ist der Schritt, nach dem eine Messung erstmals
etwas bedeutet. Ein 3b, das Hockey mit `GEO_BONUS.dunk` und ohne Torwart live schaltet,
produziert Zahlen, die niemand braucht, und eine Sondierung, die weggeworfen wird.

---

## 10. Was ich nicht geprüft habe

- Die Aufstellungs-Oberfläche in der App (`LegacyLineupLabClient.tsx`): wie viele Slots sie
  zeigt und ob `roleId`s gespeichert werden.
- Ob das Hetzner-Deploy den Chromium-Batch für zwei Arena-Disziplinen je Spieltag trägt (mein
  Befund 1 aus dem ersten Review, unverändert offen).
- Die 1980er-NHL-Torzahlen (Quellen nicht erreichbar).
- Die Rangtreue der Live-Engine bei 2v2 mit mehr als 12 Spielen — 0,083 ist eine kleine
  Stichprobe, aber bei zwei Rängen je Seite kann die Zahl strukturell nicht hoch sein.
- Ob `hockeyR` (das Paket, nicht das Modell-Repo) eine Lizenz trägt.

---

## 11. Gegenlesen von `hockey-torwart-puck-tore-plan.md` (`deedfa06`) — erst nach Abschluss der Abschnitte 1–10 gelesen

Was übereinstimmt, kurz: die Degradationstabelle (3–6 mit Torwart, 2 ohne, 6 = 5+1) ist
deckungsgleich; Trefferquote 13–16 % und Fangquote .84–.87 ebenso; „Dribbeln passt nicht"
ebenso; PARADE ohne dexterity-Führung ebenso; „Eisfläche vor Torwart" ebenso. Die Ist-Zahlen
(6,63 / 10,2 / 66,6 %) habe ich reproduziert.

**Wo ich widerspreche, nach Gewicht:**

1. **Bauform des Torwarts (Plan 3.2).** Der Plan empfiehlt Option D — ein Spieler in `FSTEAM`
   mit Ausschluss an „sechs Stellen" — und verwirft das `fsSchiri`-Muster, weil der Torwart dann
   „kein Kaderspieler" sei, „keinen Namen, keine Statistik" habe und „nicht wählbar" sei. Das
   ist eine falsche Alternative: ein Objekt außerhalb von `FSTEAM` kann die Identität eines
   Kaderspielers tragen (Abschnitt 1.3, E′) — Name, Sprite, Attribute, Boxscore, Wahl über den
   Slot. Und es sind nicht sechs Stellen: zwischen `:4330` und `:6440` stehen 23 `FSTEAM[…]`-
   Zugriffe, 10 Ganzteam-Schleifen und 8 Mitspieler-Filter (Abschnitt 1.2, gezählt), darunter
   Pass-Interception, Steal, Fastbreak-Ausbrecher, Rebound-Kampf und Separation, die der Plan
   nicht nennt. D kostet das Vier- bis Fünffache von E′ und führt bei `n=2` einen zweiten
   Codepfad durch jede dieser Stellen.
2. **Reihenfolge 3b → 3c → 4a–4d (Plan 5).** 3b schaltet Hockey live „mit Basketballs
   Formeln" — ohne Tor, ohne Torwart, ohne Bande, mit `GEO_BONUS.dunk=0,70` — und 3c sondiert
   **darauf**. Die Sondierung misst dann Sub-Skill-Gewichte einer Mechanik, die 4b, 4c und 4d
   anschließend ersetzen; die Impact-Formel (4d) kommt sogar erst nach der Sondierung, obwohl
   mein erstes Review (Befund 2, vom Autor in H.2 übernommen) genau das ausgeschlossen hatte.
   Mein Gegenvorschlag ist 3b′ (Abschnitt 9): Tor, Torwart-Objekt, Schussauflösung,
   Zonentabelle, Bande, Bully-Phase und Impact-Formel **mit Platzhalterzahlen** in einem
   Schritt, dann sondieren. 3b′ ist größer, aber es ist der erste Schritt, nach dem eine Zahl
   etwas bedeutet.
3. **Der Torkorridor 3,5–4,5 und die Frage „vier oder fünf?" (Plan 2.1, 6.1).** Die obere
   Hälfte des Korridors ist zu hoch: bei 4,5 je Team sind es neun Tore je Spiel, alle ~53 s eines,
   und mit Jubel und Bully je Tor stehen ~27 % der Spielzeit still (Abschnitt 3.2). Fünf gehört
   Chris nicht als Option angeboten, sondern als „albern" begründet. Mein Korridor: 3–4, Mittel
   3,5. Und der Plan nennt die Bedingung nicht, unter der 26–32 Abschlüsse überhaupt entstehen:
   die Tempo-Garantie (Schussuhr → Klär-Ereignis, 2.2.2), die der alte Plan in C.3.3 streicht.
   Ohne sie sinken die Abschlüsse, und die Quote muss steigen, um die Torzahl zu halten — der
   heutige Fehler in Zeitlupe.
4. **Das Zonenmodell.** Der Plan verweist auf das alte C.3.2 („Maximum im Slot, fällt zu beiden
   Seiten ab"). Die xG-Daten (8.4) zeigen: monoton in der Distanz, der Nahbereich ist der beste;
   der Abfall neben dem Tor ist ein Winkel-Effekt. Zwei Achsen, keine Formänderung — das
   korrigiert auch meine eigene Auflage 6 aus dem ersten Review.
5. **„Wer bestimmt den Torwart?" (Plan 6.2) ist inzwischen beantwortet** — Chris: ein
   benannter Slot ab drei Spielern. Damit ist das Rohr Aufstellung → Arena (1.1) keine Frage
   mehr, sondern Voraussetzung, und der Slot-Generator (1.5: Deckel `min(base·0,45, 7)`,
   Ausgleichsslot = letztes Thema, `slice(0, slotCount)`, Klemme auf 6) kommt im Plan gar
   nicht vor, obwohl er die schwierigste Produktionsdaten-Stelle ist: ein „sehr defensiver"
   Torwart-Slot ist mit dem heutigen Deckel nicht ausdrückbar.
6. **„Leeres Tor braucht keine Erfindung" (Plan 3.1).** Doch: ohne kleineres Tor und eigene
   Zielzeile liefert 2v2 bei Basketballs Abschlusstempo ~11 Tore je Team (1.4). Und „ob die
   Live-Engine bei 2 je Seite läuft, ist nicht getestet" (Plan 7) — ist es jetzt: sie läuft
   ohne Seitenfehler, rho(Seite) 0,083, Punkte 65,2 je Spiel.
7. **„Bande prägt das Bild stärker als jede Formel" (Plan 4)** — kleiner, als es klingt:
   Basketballs Live-Pfad kennt heute **kein** Aus; der Ball verlässt das Feld nie. Neu sind eine
   Klemme mit Spiegelung im `frei`-Zweig und Platz hinter dem Tor. Was der Plan dafür in seiner
   Puck-Tabelle als „Schuss: ja, muss aufs Tor zielen" abhakt, ist der eigentliche Neubau: die
   Schussauflösung mit vier Ausgängen und dem Torwart als Term (2.3).
