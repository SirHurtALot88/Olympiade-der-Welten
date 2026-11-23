# Werbeklausel und Aushängeschild: Bau (23.11.)

Chris, 23.11.: „Bau das direkt ein, dann kann ich das morgen mal testen.“ Vorlage: Mockup `public/mockups/marketing-werbeklausel-aushaengeschild-23-11.html`
und Abschnitt „Runde 4“ in `docs/design/marketing-22-11.md`. Dieser Text hält fest, was gebaut ist, welche Entscheidungen des Projektleiters zu den sechs offenen
Fragen des Mockups gelten, wie man es testet und was vom Mockup abweicht.

## 1. Entscheidungen zu den offenen Fragen

| # | Frage | Entscheidung (gebaut) |
|---|---|---|
| 1 | Klausel ehrlicher rechnen | drei Stufen: „Spieler behält mehr“ −10 Punkte Team-Anteil, Gehalt −2,5 %, Sicherheitsnetz 22 %; „Standard“ 0, Netz 25 %; „Team bekommt mehr“ +10 Punkte, Gehalt +2,5 %, Netz 28 %. `Egomaniac` und `Diva` lehnen „Team bekommt mehr“ ab, `Loyal` nimmt sie ohne Aufschlag |
| 2 | KI-Wahl des Aushängeschilds | nach dem höchsten **Zusatzertrag ans Team** (Werbegeld ans Team als Gesicht minus ohne), bei Gleichstand höhere Marketability, dann Id; Netz und 65 % gelten in der Rechnung |
| 3 | Sperre | sofort mit „Bestätigen“ bis Saisonende; bei Delegation gilt die KI-Wahl, der Mensch überschreibt bis zum ersten gebuchten Spieltag. Ohne Wahl gilt ab dem ersten Spieltag die KI-Wahl |
| 4 | Vorlieben wachsen | ein neuer Zugang **ersetzt** den früheren (ein Zugang je Team, nur Klassen); Auslöser: dasselbe Gesicht in zwei Saisons in Folge |
| 5 | Wer darf überschreiben | nur der Manager des Teams (`authorizeServerRoomWrite`, 403 für andere Menschen); andere lesen nur |
| 6 | Delegationsbereich | die Klausel gehört zu „Käufe, Verkäufe und Verträge“ (`transfers`), das Aushängeschild zu „Sponsor“ |

## 2. Was gebaut ist

**Rechenkern** (`lib/marketing/`)

- `marketing-modell.ts`: `klauselGehaltFaktor`, `gehaltMitKlausel`, `klauselErlaubt`, `wirksameKlausel`, Netz je Stufe (`MARKETING_KONFIG.klauselNetz`). Eine Rechenstelle für
  Vorschau und Buchung: der Vertrag trägt `marketingKlausel`, `berechneMarketing` liest ihn, die Kasse bucht über `marketingTeamUebersicht` wie bisher.
- `marketing-klausel.ts`: `klauselFuerVertrag` (Mensch-Wahl, sonst KI-Regel nach Finanzwert), `klauselZeilen` (die drei Zeilen der Verhandlung), `kiKlauselFuerTeam`
  (Finanzwert ab 7 „Team bekommt mehr“, unter 4 „Spieler behält mehr“, sonst Standard).
- `marketing-kontext.ts`: `gesichtKandidaten`, `kiAushaengeschild` (Zusatzertrag), `gewaehltesAushaengeschild`. Die KI-Wahl rechnet mit neutraler Moral und ohne
  Verletzungsstand, damit sie in der Saison nicht kippt (gezeigt = gebucht).
- `marketing-aushaengeschild.ts`: Regeln der Wahl (nur beste sechs, nur vor dem ersten gebuchten Spieltag, einmal, gesperrt).
- `marketing-team.ts`: Saisonwechsel schreibt `gesichtVorsaison` und `klassenVorliebe`; `fanProfilFuer` zählt die gewachsene Klasse zu „Fans mögen“.

**Schreibwege**

- Kauf: `POST /api/transfermarkt/buy` (Feld `marketingKlausel`), `executeLocalTransfermarktBuy` und der KI-Massenkauf schreiben Gehalt mit Klausel und `marketingKlausel` in den
  Vertrag. Draft-Festkonditionen bleiben Standard.
- Verlängerung: `POST /api/contracts/renewal` (Feld `marketingKlausel`), Vorschau und Abschluss rechnen mit demselben Gehalt; Ablehnung durch Trait blockt den Abschluss
  (`werbeklausel_vom_spieler_abgelehnt`).
- Aushängeschild: `POST /api/marketing` (`aktion: "aushaengeschild"`), Schreibprüfung am Team, Aktion `marketing_update`.

**Regel-Stempel**

`seasonState.marketingRegel.version = "klausel-v2"`. Ein **neues Spiel** hat sie ab Saison 1; ein **laufender Spielstand** bekommt sie mit dem nächsten Saisonwechsel
(der Lade-Stempel schreibt für die laufende Saison `regel: "aus"`, danach gilt der Schalter). Rückweg wie bisher `OLY_MARKETING=aus` (neue Saisons ohne Marketing),
Notbremse `OLY_MARKETING=aus-sofort`. Ein Stempel ohne `version` (Marketing-Stand vom 22.11.) rechnet weiter wie gestempelt: Klausel immer Standard, KI-Wahl nach Marketability.

**Oberfläche** (neuer Stil, Tokens `--schrift-haus`/`--schrift-zahl`, Gehalt groß je Saison, klein je Spieltag)

- Verhandlungstisch (Kauf und Verlängerung, ein Dialog): Block „Werbeklausel“ in der rechten Spalte (`WerbeklauselBlock.tsx`).
- Marketing-Seite: vierter Reiter „Aushängeschild“ (`AushaengeschildAnsicht.tsx`).

## 3. So testet Chris es

**Neues Spiel (alles ab Saison 1):** Spiel anlegen, nach dem Draft im Transfermarkt einen Spieler öffnen, „Verhandeln“: im rechten Teil steht die Werbeklausel mit drei
Zeilen. Marketing → Reiter „Aushängeschild“: Zeile wählen, rechts „Bestätigen“ (danach gesperrt). Verträge → „Verlängern“: derselbe Block.

**Laufender Spielstand (Chris' Stand hat Marketing in Saison 1 aus):** Die Klausel- und Aushängeschild-Wahl erscheinen erst nach dem nächsten Saisonwechsel; bis dahin zeigt der
Reiter „Aushängeschild“ den Hinweis „gilt in dieser Saison noch nicht“ und der Verhandlungstisch den Block nicht.

## 4. Abgleich mit dem Mockup

Mockup: `public/mockups/marketing-werbeklausel-aushaengeschild-23-11.html`. Aufnahmen aus der echten App (Wegwerf-SQLite, Dev-Server mit Auto-Export aus, nie gegen den
echten Server) mit `scripts/screenshot-werbeklausel.ts`, Mockup mit `scripts/screenshot-werbeklausel-mockup.ts`, beide unter `flock /tmp/oly-aufnahme.lock`.
Ordner `docs/design/werbeklausel-aushaengeschild-23-11/`, je 1920x1080 und 2560x1440, kein Seitenscroll (x=0, y=0), keine JS-Fehler.

## 5. Bildpaare und Liste

**Bildpaare (links Mockup, rechts App, `paar-<ansicht>-<groesse>.png`):** `paar-verhandlung`, `paar-verlaengerung`, `paar-aushaengeschild-offen`,
`paar-aushaengeschild-vorschau`, `paar-aushaengeschild-gesperrt`. Einzelaufnahmen der App: `app-*.png` (zusätzlich `app-verhandlung-spieler-behaelt-*`).

**Korrekturschleife (Befunde der eigenen Sichtung):**
1. Reiter „Aushängeschild“ im Kopf wurde zu „Aush…“ abgeschnitten: Beschriftung jetzt Eyebrow „Aushängeschild“, Titel „Gesicht“ (behoben).
2. Bei 2560x1440 überlappte die zweizeilige Tabellenkopfzeile der Aushängeschild-Tabelle die erste Zeile (feste Höhe 30 px): Kopfzeile wächst jetzt mit (behoben).
3. Offen, nicht behoben: auf 1920x1080 sind die Tabellenzeilen kompakter als im Mockup; es bleibt freie Fläche unter der Tabelle (nur sechs Zeilen).

**drin**
- Verhandlung und Verlängerung: Block Werbeklausel mit drei Zeilen (Spieler behält mehr / Standard / Team bekommt mehr), je Gehalt je Saison groß und je Spieltag klein,
  Team-Anteil, Werbegeld ans Team, Werbegeld an ihn, Saldo gegen Standard; gewählte Zeile hervorgehoben.
- Summenzeile über die Laufzeit mit Saldo gegen Standard; Ablösehinweis und Kaderränge.
- Aushängeschild: Hinweisband (Wahl offen / gesperrt), vier Kennzahlen (Kasse, ans Team, an die Spieler, Zusatzertrag), Tabelle der besten sechs mit „jetzt“ und „als Gesicht“,
  Zerlegung des Team-Anteils rechts, Vorlieben-Zähler, Regelblatt, Bestätigen und danach „Gesperrt“, KI-Wahl-Marke.
- Hero: Kachel „Aushängeschild“ mit Name und Marketability des Gesichts.

**angepasst (warum)**
- Verhandlung ist ein Dialog im Transfermarkt statt einer eigenen Mockup-Seite: der bestehende Verhandlungstisch trägt den Block (kein Doppelbau), die rechte Spalte „Reaktion und
  Zerlegung“ des Mockups liegt dort als „Warum er so reagiert“ plus Block.
- Beispielwerte im Mockup (Saison 4, Hell Raisers) sind in der App echte Werte des Testspielstands (Saison 1, Armageddon Aftermath, Werbegeld meist 0,0 C); darum wirken viele Zahlen leer.
- Vorschau der Gesicht-Wahl nennt bei Spielern ohne Werbegeld „0,0 C → 0,0 C“ (ehrliche Rechnung, im Mockup waren die Beispiele durchweg positiv).

**fehlt (warum)**
- Reiter „Mehrspieler“ (Co-Manager und KI-Delegation als Ansicht): kein eigener Bildschirm, die Rechte wirken über `authorizeServerRoomWrite` und das Delegations-Hinweisband im Aushängeschild-Reiter.
- Mockup-Kopfleiste (Spieler-Umschalter, Demo-Hinweis): reines Mockup-Werkzeug.
- Die Zerlegungs-Kachel „Team-Anteil im Aufbau“ je Zeile im Verhandlungsdialog: dort nur Anteil und Saldo, die volle Zerlegung steht im Aushängeschild-Reiter.
