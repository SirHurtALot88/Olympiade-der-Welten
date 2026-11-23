# Ausrüstung: Phase 0 und Phase 1a (22.11.)

Bauplan: `docs/design/ausruestung-pilot-bauplan-22-11.md` (Abschnitte A bis E), Konzept `docs/design/zwischen-den-spieltagen-22-11.md` (§§ 11, 26 bis 27, 41, 50 bis 66), Mockup `public/mockups/zwischen-den-spieltagen-22-11.html?ansicht=ausruestung|familien|kiste` und `kiste-demo-22-11.html`.

**Phase 1a berührt die Wertung nicht.** Fingerabdruck `env -u NODE_OPTIONS node scripts/pruefe-wertung-fingerabdruck.mjs --node`: **GESAMT fe1dc086d68d** (75 Einträge), unverändert; die sechs Schutzsummen ebenfalls. Ein Test sichert, dass der Spieltags-Hook nichts außer `gameState.ausruestung` ändert.

## 1. Phase 0: Messgerüst und Sonde

### 1.1 Werkzeug `scripts/miss-ausruestung-spiegel.mjs --node`

- **Spiegelkader:** beide Seiten sind derselbe Kader (die zweite Seite trägt umbenannte Kopien), Quelle `data/generated/kaderfamilie-live-save.json`. Unterschiede kommen nur von der Ausrüstung.
- **Gepaarte Saaten mit Seitentausch:** jede Bedingung läuft über dieselben Spielsaaten; die Ausrüstung steckt einmal auf der Heim-, einmal auf der Gastseite.
- **Rauschboden:** dieselbe Messung ohne Ausrüstung. Der Spiegel hat eine feste Sitz-Verzerrung (Bahn bis 100 % Heim, Gleichstand), deshalb zeigt das Skript neben der rohen Quote eine **bias-bereinigte Quote** (Rand je Spiel minus Rand der Kontrolle auf demselben Sitz, geteilt durch die Streuung der Kontrolle, Normalnäherung).
- Wirkung im Messkader = Formel des Bauplans A.1: `a += Δ` (gekappt je `--kappe`), `d += Σ Δ × Gewicht / 100`, die Rangtabelle wird nicht neu gerechnet.
- Schalter: `--stufe`, `--teile`, `--traeger`, `--verteilung=beste|typisch`, `--kappe`, `--varianten`, `--sonde-a130`, `--json`.
- Siegquote = W + ½U über die Summe der Spielerwerte je Seite (Näherung; Phase 2 misst mit den echten Ergebnissen).

### 1.2 Sonde `a` bis 130, alle 20 Disziplinen

Aufschlag +30 auf jedes Attribut mit Matrixgewicht, `a` bis 130 (A) bzw. bei 100 gekappt (B, Überschuss nur über `d`), 8 Spiele × 3 Paarungen × 2 Seiten je Bedingung.

**Ergebnis: alle 20 Disziplinen rechnen bei `a > 100` sauber.**

- Kein NaN, kein Unendlich (0 von allen Werten).
- Der Aufschlag wirkt in der richtigen Richtung (Effektgröße des bereinigten Rands zA zwischen 1,8 und 10,6 Streuungen).
- Die Rangtreue bricht nirgends ein: rho (Eignung gegen Wert) steigt in allen Disziplinen oder bleibt (Basis → A, z. B. Hockey 0,70 → 0,81, Basketball 0,89 → 0,90, Wettessen 0,92 → 0,92).
- Vorzeichen: Bahn-Disziplinen werten in Zeiten (negative Werte von Natur aus); ein Vorzeichenbruch tritt nirgends auf.
- **A gegen B:** in 6 von 20 Disziplinen (Gewichtheben, Time Trial, Showcase, Wettessen, Basketball, Fechten) wirkt der Teil über 100 zusätzlich (zA − zB ≥ 0,25), in den anderen 14 ist er wirkungslos, aber nicht schädlich; in keiner wirkt er gegen den Träger.
- **Folge für Bauplan C3:** die Kappung ist nicht nötig, `a` darf über 100 laufen. Wo das Rezept den Überschuss ignoriert, geht er trotzdem über `eignungDelta` ein. Phase 2 kann `a` ungekappt an den Motor geben.

Roh: `docs/design/ausruestung-phase1a-22-11/messung-a130.txt`.

### 1.3 Rauschboden und Stufen-Pakete

Stufen-Pakete (Konzept §61): Attributpunkte je Träger 3 / 8 / 15 / 26, „typische“ Verteilung (60 % auf zwei Familien-Attribute), alle zwölf Spieler tragen, 48 gepaarte Spiele je Bedingung und Disziplin. Der Standardfehler einer einzelnen Disziplin ist damit **7,2 Prozentpunkte** (konservativ).

| Stufe | Punkte je Träger | mittlerer Eignungs-Hub | Siegquote roh (Mittel 20 Disz.) | Siegquote bereinigt (Mittel 20 Disz.) | Streuung der Einzel-Disziplinen um 50 % |
|---|---:|---:|---:|---:|---:|
| Standard | 3 | +0.24 | 51.4 % | 51.7 % | 4.0 pp |
| Selten | 8 | +0.64 | 53.1 % | 56.8 % | 9.2 pp |
| Episch | 15 | +1.22 | 57.8 % | 62.3 % | 14.8 pp |
| Legendär | 26 | +2.18 | 59.7 % | 68.8 % | 20.2 pp |

Roh je Stufe und Disziplin: `docs/design/ausruestung-phase1a-22-11/messung-stufe-*.txt`. Aufruf: `env -u NODE_OPTIONS node scripts/miss-ausruestung-spiegel.mjs --node 8 --varianten=3 --stufe=<stufe> --verteilung=typisch`.

**Einordnung gegen die Korridore des Bauplans** (Standard 50,5 bis 52 %, Selten 52 bis 54, Episch 54 bis 57, Legendär 57 bis 62; über 65 übermächtig): hier tragen alle zwölf Spieler ein volles Paket der Stufe, das ist der **obere Rand**, nicht der typische Kader (der Bauplan rechnet mit etwa 14 Teilen im ganzen Kader). Standard liegt mit 51,7 % im Korridor; Selten (56,8 %), Episch (62,3 %) und Legendär (68,8 %) liegen bei Volltragen **über** ihren Korridoren, Legendär über der Marke „übermächtig“. Das ist ein Hinweis für die Pakete aus Konzept §61 (Selten +8, Episch +15, Legendär +26 Attributpunkte je Teil), kein Befund: in Phase 2 gibt es höchstens zwei Teile je Spieler und längst nicht jeder trägt zwei Legendäre. Phase 2 misst deshalb mit dem typischen Kader (Teile nach der KI-Zuteilung) und stellt die Wertbereiche nach, wenn der Korridor verfehlt wird.

**Lesart für Phase 2:**
- Eine einzelne Disziplin mit 48 Spielen kann den Korridor „Standard 50,5 bis 52 %“ nicht auflösen (SE 7,2 pp). Standard und Selten werden deshalb wie im Bauplan als **typischer Kader über alle 20 Disziplinen** gemessen (Mittel der 20 Disziplinen: SE etwa 1,6 pp) und mit deutlich mehr Spielen je Disziplin (mindestens 200).
- Die Sitz-Verzerrung des Spiegels (Heim 54 bis 100 % in der Kontrolle) ist größer als jeder Stufen-Effekt; ohne Seitentausch und Bereinigung wäre die Messung wertlos.
- Der Rauschboden ist damit die Latte für Phase 2: Wirkung gilt erst, wenn der bereinigte Mittelwert über die 20 Disziplinen mehr als 2 SE über 50 % liegt.

### 1.4 Spielstandgröße (Grundlinie und Zuwachs)

| | Größe |
|---|---:|
| Vorher: Solo-Spielstand 22.11. (32 Teams, 8 Spieltage), alle Tabellen | 21 667 KB (`season_states` 11 493 KB, `players` 7 535 KB, `game_metadata` 2 221 KB) |
| Nachher: `gameState.ausruestung`, ein Team nach 10 Kisten (Lager 8, 26 Teile) | unter 8 KB |
| Nachher: 32 KI-Teams, 40 Spieltage Ruhm und KI-Runden (Lager im Mittel 12) | etwa 105 KB (nach 20 Spieltagen etwa 100 KB) |

Der Besitz liegt in `game_metadata` (neben `merkliste`) und wächst nach den ersten Spieltagen kaum noch, weil die KI das Lager bei 12 hält und Verlaufszeilen nur für Menschen geführt werden (höchstens 24 je Team). Das sind rund 0,5 % des Spielstands.

## 2. Phase 1a: was gebaut ist

### 2.1 Module `lib/ausruestung/*`

| Datei | Inhalt |
|---|---|
| `ausruestung-typen.ts` | Typen: Affix, Teil, Lagerplatz, Fund, offene Kiste, `TeamAusruestung`, `AusruestungSpielstand`, Regel-Stempel |
| `ausruestung-katalog.ts` | 8 Familien, 12 Attribute, 8 Materialien, Stufen, Truhen-Tabelle, Farben der 20 Disziplinen, Konstanten (Lager 16, Stapel 10, Gold alle 5 Spieltage) |
| `ausruestung-wuerfel.ts` | Affix-Würfel mit Saat (Mulberry32 über Text-Hash), Namen, Truhen-Funde, wirksame Chancen je Phase |
| `ausruestung-lager.ts` | Lager (16 Plätze, Material je Sorte ein Platz bis 10, Überlauf zu Teilen), Zerlegen 1/2/4/8, Zustand anlegen |
| `ausruestung-truhen.ts` | Truhen bezahlen und öffnen, Funde VOR der Wahl speichern, Wahl, Verwerfen, Gold-Abstand |
| `ausruestung-ruhm.ts` | Ruhm aus Duellpunkten, Holztruhen-Gutschein, Platzierungs-Gold |
| `ausruestung-ki.ts` | KI: Truhen öffnen, Wahl aus drei, Lager halten, Wunschliste; Delegation |
| `ausruestung-regel.ts` | Regel-Stempel `seasonState.ausruestungRegel`, Schalter `OLY_AUSRUESTUNG` |
| `ausruestung-sicht.ts` | fremdes Lager nicht in der Nutzlast, Schreibschutz gegen Client-Besitz |
| `ausruestung-aktionen.ts` | Schreibweg des Menschen (eine Funktion für die Route) |
| `ausruestung-spieltag.ts` | Hook nach dem Buchen eines Spieltags |
| `ausruestung-anzeige.ts` | Anzeige-Texte der Affixe, Icon-Zuordnung |

Außerdem: `app/api/ausruestung/route.ts` (POST), `app/foundation/ausruestung/*` (Seite, CSS, Host), Verdrahtung in Nav (`foundation-nav-config.ts`, `foundation-view-routing.ts`, `foundation-nav-icons.tsx`), Router (`FoundationShellRouterBody.tsx`, `use-foundation-shell-router-body-scope.tsx`), Persistenz (`save-repository.ts`: Typ, Schreib- und Lesezweig, sonst überlebt nichts den Kalt-Load), Hook in `legacy-matchday-result-apply-service.ts`, Stempel in Lade-Migration und Saisonwechsel (`preseason-workflow-service.ts`), Raum-Aktion `ausruestung_update`.

### 2.2 Entscheidungen im Bau (Abweichungen und Auslegungen)

- **Affix-Quoten (Bauplan C7):** je Affix eine Art-Würfelung: 5 % Pflege (ab Selten, nie das erste Affix), 15 % eingeschränkt (ab Selten), 20 % zweischneidig, sonst normal. Standard kennt nur normal (80 %) und zweischneidig (20 %). Getrennt davon die Attributwahl: 60 % auf die zwei bevorzugten der Familie, 40 % auf die übrigen zehn (Konzept §59). Per Test über Tausende Würfe geprüft.
- **Werte:** Standard +2 bis +3, Selten +3 bis +5, Episch +4 bis +6, Legendär +5 bis +8; zweischneidig und eingeschränkt ×1,5 (gerundet), Malus ein Drittel auf ein anderes Attribut. 30 % der höheren Funde kommen mit einem Affix weniger.
- **Truhen in 1a (Bauplan C1):** nur Material, Standard, Selten. Episch und Legendär fallen in Selten, Signatur-Material in Material (die Summe bleibt 100). Die Seite zeigt nur die wirksamen Zeilen. Mitleidszähler entfällt bis Phase 3 (es gibt noch nichts Episches).
- **Material je Fund:** Holz 2, Eisen 2, Gold 3 Stück einer zufälligen Sorte (Startwert).
- **Mindestens ein Fund ist Ausrüstung:** der dritte Fund wird bei Bedarf ersetzt.
- **Funde vor der Wahl gespeichert:** `offeneKiste` steht im Spielstand; Neuladen oder zweiter Klick zeigt dieselben Funde; eine zweite Kiste ist gesperrt, bis gewählt ist. Saat = Spielstand-Saat (einmal beim Anlegen gewürfelt, nur auf dem Server) + Team-ID + Kistenzähler.
- **Volles Lager:** die Wahl scheitert mit `lager_voll`, die Kiste bleibt offen; Auswege: ein Teil zerlegen oder „Alle drei zu Teilen“. Die KI zerlegt das wertloseste Teil.
- **Gold:** für Ruhm höchstens alle fünf gebuchte Spieltage (Zähler `ausruestung.spieltage`); Gutscheine aus Platzierungen zählen nicht dagegen.
- **Ruhm:** 1 je Duellpunkt (`teamPoints`), Holztruhen-Gutschein für den ersten Disziplinsieg (Rang 1) je Team und Spieltag, Gold-Gutschein für Platz 1 bis 3 nach Punktsumme zur Halbzeit und am Saisonende, je Anlass einmal. Gutschrift je Wertungsseite genau einmal (gestaffelte Buchung, `forceReplace`). **Skala ist ein Startwert:** Ruhm-Einnahmen und Truhenpreise sind nicht gemessen; Messung im Spielbetrieb steht aus.
- **KI (Konzept §55, soweit Phase 1a):** Gutscheine zuerst, dann Gold, Eisen, Holz für Ruhm, höchstens drei Kisten je Runde; Wahl aus drei: Wunschlisten-Material, dann höchste Stufe, dann höchster Gesamtwert; Lager über 12: wertlosestes Teil zerlegen. Wunschliste = Material der zwei Familien, deren Attribute in den Disziplinen der zwei stärksten Farben des Teams (Identität) das größte Gewicht tragen. Derselbe Code für KI-Teams und delegierte Menschen.
- **Delegation:** neuer Bereich `ausruestung` (`DelegationBereich`, Label, Stufen): Voll selbst = selbst, Halbautomatik (Ramona) = KI, Voll KI = KI. Eine offene Kiste eines selbst führenden Menschen fasst die KI nie an.
- **Regel-Stempel:** `seasonState.ausruestungRegel = { seasonId, wechsel: [{ ab, besitz, wirkung, schmiede, effekte }] }`, Lade-Migration und Festschreiben vor dem Buchen wie bei Breaking. Schalter nur Server `OLY_AUSRUESTUNG=aus|besitz|attribute|schmiede|effekte` (compose + `.env.example`), Notbremse `aus-sofort`. In 1a ist `wirkung` immer `keine`, `attribute|schmiede|effekte` wirken wie `besitz`. Nur Battle-Spielstände (Bauplan C11). Ein Spielstand mit bereits gebuchten Spieltagen bekommt Stufe „aus“ für diese und „Besitz“ ab dem nächsten.
- **Sichtbarkeit:** `GET /api/singleplayer-state` filtert `gameState.ausruestung` auf die Teams, die der Aufrufer steuert (`canOwnerManageTeam`, Besitzer aus der Sitzung, sonst `user_local`), die Saat bleibt auf dem Server; `PUT` setzt den Besitz des Servers wieder ein (`uebernehmeServerAusruestung`), der Client kann ihn nie schreiben oder löschen. Tests: Chris sieht nur sein Team, Ramona nur ihres, KI-Teams niemand.
- **Mehrspieler:** aktives Team aus `activeManagerTeamId`, Schreibweg durch `authorizeServerRoomWrite` mit `resolveAuthoritativeWriteOwnerId`, Spielstand frisch vom Server; kein festes Team, nie `teams[0]`.
- **Icons:** keine PixelLab-Bestellung. Drei vorhandene Probe-Icons aus PR #1697 (`public/sprites/ausruestung/`: Helm Standard, Plattenpanzer Selten, Amulett Legendär) und die Kiste, den Lichtkranz aus `public/sprites/beute/`. Alle übrigen Familien-Stufen zeichnet die Seite als Linien-Glyphe in Stufenfarbe (Platzhalter im Mockup-Stil, im UI-Text nirgends als Platzhalter bezeichnet). Holz- und Goldtruhe sind die per `hue-rotate` eingefärbte Eisentruhe (wie im Mockup).

### 2.3 Tests

`tests/ausruestung-katalog-wuerfel.test.ts` (Katalog, Saat-Determinismus, Affix-Grenzen und Quoten), `tests/ausruestung-lager-truhen.test.ts` (Lagergrenzen, Stapel, Zerlegen, Truhen, Gold-Abstand, Funde vor der Wahl, volles Lager, Schreibweg), `tests/ausruestung-ruhm-ki-sicht.test.ts` (Ruhm, Gutscheine, Platzierung, Hook neutral, KI, Delegation, Sichtbarkeit, Client-Schutz), `tests/ausruestung-regel.test.ts` (Stempel). Hilfsdatei `tests/ausruestung-hilfe.ts`.

## 3. Abgleich Mockup | App

Bildpaare unter `docs/design/ausruestung-phase1a-22-11/` (App-Aufnahmen aus der echten App, lokaler Store, 1920×1080 und 2560×1440, Team Death Peaches; Mockup-Aufnahmen: `docs/design/zwischen-den-spieltagen-22-11/*.png`).

| Ansicht | Mockup | App 1920 | App 2560 |
|---|---|---|---|
| Lager und Truhen | `../zwischen-den-spieltagen-22-11/ausruestung-1920.png`, `kiste-1920.png` | `ausruestung-phase1a-22-11/app-lager-1920.png` | `…/app-lager-2560.png` |
| Kiste geöffnet | `../zwischen-den-spieltagen-22-11/kiste-demo-offen-1920.png` | `…/app-kiste-offen-1920.png` | `…/app-kiste-offen-2560.png` |
| Familien | `../zwischen-den-spieltagen-22-11/familien-1920.png` | `…/app-familien-1920.png` | `…/app-familien-2560.png` |

Messung an den Aufnahmen: kein Seitenscroll (Seitenhöhe = Fensterhöhe bei beiden Größen), keine horizontal überlaufenden Textelemente (der einzige Treffer ist der absichtlich übergroße Lichtkranz hinter der Kiste), keine Konsolenfehler.

**drin**
- Kopf mit Wappen, Dachzeile, Titel, Reitern und Kennzahl-Kacheln (Ruhm, Teile, Gutscheine)
- Lager mit 16 Plätzen, „n von 16“, Filter Alle/Ausrüstung/Material, Zeilen mit Stufen-Rand (gestrichelt bei Standard), Icon, Name, Affixen, Stufen-Marke
- Materialien als Stapel „Eisen ×6, Stapel 6 von 10“ im selben Lager
- Zerlegen je Teil mit Teile-Zähler
- Der Gegenstand (Tooltip-Karte): Name in Stufenfarbe, Familie, bevorzugte Attribute, Affixe, Pluszeilen blau, Abzug rot, Beschränkung „nur in POW-Disziplinen“
- Kiste: Bühne mit Strahlen, Rütteln (1,2 s), Spannung mit Licht in der Farbe des seltensten Fundes (2,0 s), Deckel, drei Funde steigen nacheinander auf, Wahl, „Überspringen“
- Drei Truhen mit Preisen, Gutscheinen, Sperrgründen („20 fehlen“, „in 3 Spieltagen“), Chancen-Tafel
- Familien-Tafel: 8 Familien × 4 Stufen, Stufenwort, Wertbereich je Affix, bevorzugte Attribute, Material
- Verlauf je Team, Hinweis „So kommt Ruhm“

**angepasst**
- Mockup-Kopf zeigt Kennzahlen als Kacheln mit „ZUR EINSATZLISTE“: die App hat Reiter (Lager/Familien) in der Mitte und Kacheln rechts; ein Sprung zur Einsatzliste liegt schon im Seitenkopf der Shell.
- Mockup-Lager als 4er-Raster mit Icon-Kacheln, die App als Liste: Namen der Familien-Teile sind lang („Verstärkter Umhang des Pfaus“) und brauchen Breite.
- Drei Truhen als eine Auswahlleiste unter der Bühne statt drei Karten rechts (die Chancen-Tafel bleibt rechts).
- Familien-Icons sind für 29 von 32 Stufen Linien-Glyphen (nicht bestellt, Plan: 61 Generationen später); drei Stufen tragen die PixelLab-Probe-Icons.
- Zerlegen belegt in 1a die Rolle der Schmiede-Rezepte; ein Teil, das nicht passt, wird mit „Alle drei zu Teilen“ verworfen.
- Holz- und Goldtruhe zeigen die eingefärbte Eisentruhe (wie im Mockup).

**fehlt (und warum)**
- Ausrüsten am Spieler (drei Plätze, Spielerkarte mit Figur), „Attribute mit Ausrüstung“, „Was bringt es wann“, Vormerken, Automatisch ausrüsten: Phase 2.
- Verschleiß, Auto-Reparatur, Reparaturkosten, Händler und Verkaufen, Finanzposten: Phase 1b und 2.
- Schmiede-Tafel, Bauplan, Glück, Affix-Handwerk (Neu würfeln, Hinzufügen, Sperren), Legendäre I bis III: Phase 3.
- Epische und legendäre Funde, Mitleidszähler, Signatur-Material: Phase 3 und 4 (Truhen-Tafel zeigt nur die wirksamen Zeilen).
- Gebäude Schmiede/Handelsposten, Effekte im Motor, Aufleuchten in der Arena: Phase 1b und 4.
- Postfach-Nachrichten zu Funden (Konzept §69), Wochenziel/Derby/Wimpel als Ruhm-Quellen: später (Bauplan C6).
- Fund-Meldung im Liga-Ticker bei epischen Funden: erst mit epischen Funden.

## 4. Offene Punkte

- **Ruhm-Skala nicht gemessen:** 1 Ruhm je Duellpunkt, Preise 10/20/45 sind Startwerte; im Spielbetrieb prüfen, wie viele Kisten je Saison entstehen (Ziel nach Konzept §26: 8 bis 12 Teile im Verein nach einer Saison).
- **Messung der Wirkung** (Phase 2): Spiegelkader mit echten Ergebnissen statt Wertsumme, mindestens 200 Spiele je Disziplin; Korridore des Bauplans.
- **Reset auf Saisonstart** (Bauplan C5, Schnappschuss beim Saisonwechsel) ist nicht gebaut.
- **Räume (Online-Raum-Zustand):** der Sichtfilter sitzt im Singleplayer-State-Pfad, über den die drei Menschen mit eigenem Login spielen; andere Wege, die den Spielstand an Browser schicken (Raum-Sockets), tragen `ausruestung` noch ungefiltert, falls sie je Räume mit Ausrüstung bedienen. Vor einem Online-Raum-Einsatz prüfen.
- **Spieltag-Zähler:** zählt gebuchte Spieltage seit dem Anlegen des Besitzes (nicht den Kalender); Verlaufszeilen davor stehen als „Vor dem ersten Spieltag“.
- **Wunschliste und KI-Lager:** die KI hält das Lager bei 12 (Material-Stapel zählen mit); ob das die Kistenwahl der KI zu stark bremst, ist nicht gemessen.
- **Icons:** 29 von 32 Familien-Stufen sind Linien-Glyphen; Bestellung (61 Generationen Sparweg) liegt bei Chris.
