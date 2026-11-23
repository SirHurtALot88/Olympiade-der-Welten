# Olympiade der Welten — Kontext für Agenten

## Der Server ist die einzige Quelle

Die Olympiade läuft **ausschließlich** auf dem Hetzner-Server. Nichts wird lokal gespielt,
nichts lokal gespeichert. Wer über „den Spielstand" redet, meint den auf diesem Server.

| | |
|---|---|
| Server | `OlympiadeServer` (Hetzner) |
| IPv4 | `135.181.102.2` |
| IPv6 | `2a01:4f9:c012:9009::` |
| Benutzer | `root` |
| App-URL | `https://olympiade.duckdns.org/foundation` |
| Healthcheck | `https://olympiade.duckdns.org/api/health` |
| Repo auf dem Server | `/root/Olympiade-der-Welten` |
| Spielstand im Container | `/app/data/persistence/oly-app.sqlite` (Volume `oly-data`) |
| Compose-Datei | `deploy/hetzner/docker-compose.yml` |
| Dienst | `oly-app` |

```sh
ssh root@135.181.102.2
```

Der Zugang selbst (Schlüssel/Passwort) liegt bei Chris, nicht im Repo. Ebenso `deploy/hetzner/.env`
mit Domain und Login-Geheimnissen — die Datei ist absichtlich nicht versioniert.

**Per SSH kommen Agenten nicht an den Server, per HTTPS inzwischen schon** — nachgemessen am 14.10.:
kein `ssh` im Container und Port 22 nicht erreichbar, aber die Netzwerk-Policy der Umgebung steht jetzt
auf „alle Domains“, und `https://olympiade.duckdns.org/api/health` antwortet mit 200 (früher `403 CONNECT
tunnel failed`). **Vor jeder Aussage „komme nicht ran“ neu messen**, statt diesen Absatz zu glauben.
Die App selbst (Foundation, Kartenschmiede) steht hinter `/login`. Zum Live-Testen gibt es den
Testbenutzer **Franky** — das Passwort hat Chris, es gehört nicht ins Repo. Live-Tests legen echte
Spielstände auf dem Server an, und die Spielstand-Liste der Kartenschmiede ist für alle Benutzer
dieselbe: eigene Testabende danach wieder löschen (`DELETE /api/kartenschmiede/spielstaende/<id>`,
nur die mit `gespeichertVon: "Franky"`), sonst kann eine spätere Map sie für ihre Übernahme ziehen.
Die Spielstände der Olympiade selbst kommen weiter über GitHub, siehe unten.

**Befehle für Chris immer ohne nachgestellte `#`-Kommentare schreiben.** Seine Shell ist zsh, und
die behandelt `#` interaktiv nicht als Kommentar — eine Zeile wie `befehl   # erklaerung` scheitert
mit `command not found: #`. Erklärungen gehören in den Fließtext, nicht in die Befehlszeile.

## Die Abnahme jeder Disziplin: ein Spiel, nicht eine Saison

**Gilt für alle zwanzig Disziplinen, nicht nur für Hockey.** Chris am 02.09., wörtlich:
„wichtig wäre auch dass es irgendwie möglich ist das umzusetzen innerhalb von einem spiel!
Wir haben ja pro season dann nur 2x Hockey. das muss also auch für sich wenn es einmal dran
kommt REALISTISCH ablaufen und >80% sein" — und danach: „und das gilt natürlich für alle
diszis merke dir das schon mal für das gesamtprojekt".

Eine Saison enthält je Disziplin nur eine Handvoll Spiele, im Eishockey zwei. Eine
Rangtreue, die sich erst über zwanzig Spiele einstellt, ist für den Spieler deshalb nicht
vorhanden. **Die Abnahmezahl ist rho in EINEM Spiel: harte Mindestschranke 0,75, Ziel über 0,80,
angestrebt 0,85.**

**Mindestschranke 0,75 seit 17.11.** Chris am 17.11., wörtlich: „Rangtreue auf 0,75 als min legen“.
Bis dahin war 0,80 zugleich Ziel und harte Untergrenze. Seither wird ein Wächter oder Test erst
unter 0,75 rot (`SCHRANKE_ABSOLUT` in `scripts/pruefe-rangtreue-schranke.mjs`, `schranken` in
`data/generated/disziplin-abnahme.json`, Konstanten in `scripts/lib/rangtreue-messung.mjs`); eine
Disziplin zwischen 0,75 und 0,80 besteht, liegt aber unter dem Ziel und bleibt Arbeitsauftrag.
Über 0,80 bleibt das Ziel, 0,85 das angestrebte Niveau.

**Die Schranke gilt nur gegen die reine Eignung (Chris, 22.11.).** Gemessen wird die Mechanik ohne On-top-Effekte.
Was obendrauf kommt — Form, Moral, Formkarten, künftig Ausrüstung, Zurufe —, zählt nicht dagegen: „da sind Spieler
einfach gut drauf, haben bessere Ausrüstung etc. Das MUSS sich ja sogar auswirken, dass Schwächere besser sein könnten.“

**Weitere Grundsätze vom 22.11.:** Ein Abgang durch Vertragsende ist ein **Verkauf** (ablösefrei) — Begriffe und Regeln
nicht getrennt behandeln. Ligaregeln dürfen sich ändern (z. B. per Abstimmung der Teams), aber **nur befristet**
(wenige Spieltage bis höchstens eine Saison) als Regel-Stempel im Spielstand, nie dauerhaft im Code. Ligaweite
Ereignisse treffen **alle Teams gleich**. Ligaformat bleibt vorerst **2×16** (später potentiell 2×20). Entwicklung:
wenige Spieler werden je Saison deutlich besser, wenige deutlich schlechter, die Masse kaum; Trainingspunkte und
Leistung (PP) stehen in einem gesunden Verhältnis.

Das ist strenger, als es klingt — aber die Grenze liegt woanders, als der erste Anlauf
vermutete, und der Unterschied entscheidet, wo man arbeitet.

**Zwei Größen, nicht eine.** Eine Einzelspiel-Rangtreue zerfällt in ein Produkt:

    rho(ein Spiel) = rho(Saison) x Wurzel(Verlaesslichkeit)

Die **Verlässlichkeit** sagt, wie gut ein Spiel das nächste vorhersagt — sie hängt an der
Ereigniszahl. Die **Validität** (rho über die Saison) sagt, ob die Mechanik überhaupt das
belohnt, was die Eignung misst — sie hängt am Rezept und an den Kanälen. Nachgemessen für
Hockey (24 Spiele, 10 Feldspieler): Verlässlichkeit 0,755, Validität 0,82, Produkt 0,71 —
und gemessen kommt 0,719 heraus, die Formel trägt auf ±0,01.

**Mehr Ereignisse helfen fast nie.** Bei Hockey mit verdoppelter Spielzeit stieg die
Verlässlichkeit von 0,755 auf 0,85 — und rho blieb bei 0,719 / 0,721 / 0,723. Flach.
Unser Hockeyspiel hat je Minute bereits die dreizehnfache NHL-Ereignisdichte. **Wer die
Rangtreue heben will, arbeitet an der Validität, nicht an der Uhr.**

**Was rho drückt, ist oft gar kein Fehler.** In Hockey steht der eignungsbeste Feldspieler
in 58 % der Spiele auf Rang 1, in 78 % in den ersten zwei, nie auf dem letzten (kaderfest
gemessen, nicht Einzelkader — `docs/design/hockey-opus-review-nhl.md` Abschnitt 5.3). Paare mit
mindestens 15 Eignungspunkten Abstand werden zu 99 % richtig geordnet. Was rho nach unten
zieht, sind Paare unter zwei Punkten Abstand — die kann kein Motor der Welt ordnen, und sie
sollen es auch nicht. **Die ehrlichere Abnahme fragt deshalb nach dem Star und nach der
Paartreue mit Abstand**, nicht nach einer nackten Rangkorrelation über alle Paare.

| Größe | Hockey | Basketball |
|---|---:|---:|
| rho je Spiel | 0,670 | 0,786 |
| Validität (Saison) | 0,874 | 0,881 |
| Star auf Rang 1 (kaderfest) | 58 % | — |
| Star in den ersten zwei (kaderfest) | 78 % | — |

**Achtung, alle älteren Zahlen in diesem Repo sind auf einer Stichprobe von VIER entstanden.**
`zieheFormkarten` nahm `z % n` von einem linearen Kongruenzgenerator, also die untersten Bits;
deren Periode ist bei vier Formwerten genau vier. Nachgerechnet ergaben 24 verschiedene Saaten
**vier** verschiedene Kartensätze, 1000 Saaten ebenfalls vier. Seit dem Umstieg auf die oberen
Bits (02.09.) sind es 24 aus 24. Die alte Basketball-Schranke `0,836 / 0,804 / 87,3 / 101,8 /
82,3` gilt deshalb nicht mehr; die neue steht in der Tabelle oben.

**Dieselbe Eignungslücke saß in ALLEN VIER Chassis** und ist überall behoben: `p.d` hält nur
`tdm` und `spurt` vorberechnet, alle vier Baufunktionen lasen `p.d[disziplin] || 0`, und für die
übrigen achtzehn Disziplinen bestand `eig` damit nur aus Slot-, Trait- und Formzuschlag. In der
Arena wog es am schwersten, weil `eigWert` dort über `aufEignung()` direkt in die Kampfwerte
geht. Fundstellen: `bauFeldspiel` (25.08.), `bauBuehne`, `bauSpurt`, `baueEinheit` (alle 02.09.).

Werkzeuge dafür: **`scripts/miss-alle-disziplinen.mjs [spiele] [disziplin ...]`** für alle
zwanzig auf einmal — die einzige Sonde, die alle vier Chassis kennt. Daneben
`scripts/miss-feldspiel-rangtreue.mjs <diszi> 24 6` für den Feldspiel-Boxscore und
`scripts/miss-rangtreue-nach-rolle.mjs <diszi> 48`, wenn eine Rolle (Torwart) eine eigene
Wertformel hat. Der vollständige Stand aller zwanzig steht in
`docs/design/stand-aller-disziplinen.md`.

**Die zwei Spalten lesen.** Ist die Saisonzahl hoch und die Einzelspielzahl niedrig, belohnt die
Mechanik das Richtige, aber zu laut — dann fehlen EREIGNISSE, nicht Rezepte. Sind beide niedrig,
belohnt die Mechanik das Falsche. Das entscheidet, ob man an der Uhr oder am Rezept arbeitet.

## Die Eignungsmatrix ist gesperrt — endgültig, für alle zwanzig Disziplinen

**Nicht mehr nachfragen.** Chris am 21.09., nachdem die Frage bei Football (E3, 10.–16.09.) und
bei I-Spy (Konzeptrunde, 21.09.) schon zweimal einzeln aufkam: die offizielle Gewichtsmatrix
(`lib/player-generator/official-discipline-weights.ts`) bleibt für **jede** der zwanzig
Disziplinen unangetastet — nicht nur für die, bei der es gerade zur Debatte steht. Das ist eine
endgültige Entscheidung fürs Gesamtprojekt, keine Einzelfallfrage mehr: kein Agent soll sie
künftig noch einmal stellen, egal welche Disziplin gerade an der Reihe ist. Ein Override auf einer
tieferen Ebene (Muster `lib/player-generator/spiel-eignung-overrides.ts`, bisher nur für Football,
dort ausdrücklich mit Chris' Bestätigung eingeführt) bleibt der einzige legitime Weg, wenn eine
Disziplin intern andere Gewichte braucht als die Matrix zeigt — das ändert an der Matrix selbst
nichts und bleibt eine bewusste, dokumentierte Ausnahme je Disziplin, keine stillschweigende Regel.

**Die andere Hälfte derselben Entscheidung, wörtlich:** „diese Disziplingewichtungen, die
vorgegeben sind, die müssen am Ende auch so rauskommen. Weil wenn ich einen Spieler mit einer Stat
von 80 reinschicke, erwarte ich auch, dass da einer der Top-Leute ist und nicht, dass das dann am
Ende so eine Hülpe ist." Die Matrix zu sperren heißt also nicht nur „nicht ändern", sondern auch:
**jede Disziplin-Mechanik muss die Matrixgewichte tatsächlich durchreichen.** Ein Spieler, dessen
stärkstes Attribut laut Matrix für eine Disziplin schwer zählt, muss in dieser Disziplin nachweisbar
zu den Besten gehören — nicht bloß irgendwo im Mittelfeld verschwinden, weil das Rezept das
Attribut in der Praxis kaum nutzt oder ein anderer Kanal (Slot, Trait, Form) es überdeckt.

Das ist keine neue Erfindung, sondern die **Budget-Methode**, die das Projekt an mehreren Stellen
schon einsetzt (`docs/design/neue-disziplin-handbuch.md` Abschnitt 2, Pipeline „Rezept →
Pp-Abnahme"): `scripts/messe-arena-einfluss.mjs` / `einflussVon(dId,n)` misst, wie viel jedes
Attribut in der fertigen Mechanik tatsächlich trägt, verglichen mit seinem Matrixgewicht. Zielwert
**Pp-Abweichung ≤ 25** (zwei unabhängige Saatstämme). Was neu ist: das ist ab jetzt kein optionaler
Politur-Schritt mehr, sondern eine **Pflichtprüfung für jede Disziplin, jede neue Mechanik und
jedes Rezept** — genauso verbindlich wie die rho-Mindestschranke oben, nicht nur "wenn gerade
Zeit ist". Beide Abnahmen gehören zusammen: rho sagt, ob das RICHTIGE Ergebnis am Ende steht, die
Pp-Abweichung sagt, ob es aus den RICHTIGEN Gründen (den vorgegebenen Attributen) zustande kommt.

Chris am 10.11.: **<15 ist das angestrebte Optimum**, sofern ohne rho-Verlust erreichbar — ≤25 bleibt
aber die verbindliche Pflichtschranke. Wo ein Rezept zwischen "knapp unter 25" und "unter 15, aber
rho sinkt" wählen muss, hat rho (Mindestschranke 0,75, Ziel >0,80, angestrebt 0,85) Vorrang: nicht die Pp-Zahl auf
Kosten von rho optimieren.

**Falls die Matrix doch angepasst werden muss: Ausgleichspflicht über alle 20 Disziplinen.**
Chris am 15.11., wörtlich: „wenn du die gewichtungen in der matrix anpassen würdest für eine diszi
müsstest du das bei anderen auch machen damit es unterm strich wieder sauber ist, momentan wird
jedes attribut über 20 disziplinen fast gleich gewichetet bis auf 1-2 Punkte unterschied. und das
MUSS so bleiben“ — nachgemessen exakt bestätigt: jedes der zwölf Attribute summiert sich über alle
20 Disziplinen auf genau 166 oder 167 Punkte. Das ändert nichts an der Sperre oben — die Matrix
bleibt der Normalfall unangetastet, und das bleibt die endgültige Entscheidung für alle zwanzig
Disziplinen. Es gilt nur als zusätzliche Nebenbedingung, **falls** Chris für einen bestimmten,
dokumentierten Einzelfall ausdrücklich eine Ausnahme freigibt: „Wenn du die matrix anpassen musst
dann nur so dass das in summe weiter aufgeht und vorsichtig sein und vor allem den aktuellen
ursprungsstand der matrix speichern“ — vor jeder solchen Änderung den aktuellen Stand sichern
(Muster: `docs/design/matrix-backups/`), jede Erhöhung bei einer Disziplin durch eine Senkung bei
anderen Disziplinen **desselben Attributs** ausgleichen, und die neue Zeilensumme nachrechnen statt
schätzen. Volle Herleitung und Tabelle: `docs/design/matrix-ausgleichspflicht-15-11.md`.

**Design-Leitlinie, nicht nur für eine Disziplin: mehrere Wege zum Erfolg.** Chris am 21.09., im
Kontext der I-Spy-Konzeptrunde (`docs/design/i-spy-schatzsuche-konzept-21-09.md`, Mehrwege-Truhen),
danach ausdrücklich verallgemeinert: „das ist jetzt auch nur ein Beispiel — auf genau diese Art und
Weise kannst du auch Attribute in allen möglichen Disziplinen nutzen, sodass jeder Spieler eine
gewisse Expertise hat und in irgendwas vielleicht gut ist." Gemeint ist das Muster, das für I-Spy
entstanden ist: eine Aufgabe hat einen **Primärweg** (ihr natives Attribut, volle Belohnung) und
einen oder mehrere **Nebenwege** über andere Attribute (dieselbe Aufgabe lösbar, aber schlechter
gestellt — weniger Punkte oder langsamer). Das ist kein numerischer Grenzwert wie rho oder die
Pp-Abweichung, sondern eine Design-Linie: wo eine Disziplin ohnehin neu gebaut oder überarbeitet
wird, lohnt sich die Frage, ob eine einzelne, starre Erfolgsformel durch einen Primär-/Nebenweg-
Ansatz ersetzt werden kann, statt Spieler ohne das eine geforderte Attribut komplett auszuschließen.
Kein Auftrag, alle zwanzig Disziplinen deswegen anzufassen — nur ein Kriterium, das ab jetzt bei
jeder ohnehin anstehenden Rezept- oder Mechanik-Runde mitgedacht werden soll.

## Spieler-Form, Moral und Formkarten-Farbregel sind scharf (18.11.)

Seit 18.11. im Spiel aktiv, jeweils per Umgebungsvariable abschaltbar (Details und Messung:
`docs/design/form-moral-17-11.md` Abschnitt 7-8, Bau: `docs/design/form-moral-bau-18-11.md`):

| Schalter | Standard | Abschalten |
|---|---|---|
| `OLY_FORM_MORAL` (Form fortschreiben, Form + Moral skalieren die Arena-Eignung, Form wirkt in der Legacy-Wertung) | AN | `OLY_FORM_MORAL=0` |
| `OLY_FORM_MORAL_DOSIS` (Prozent je Form-Stufe) | 1,0 | Zahl 0..4 |
| `OLY_FORMKARTEN_FARBREGEL` (neue Regel: alle + Farbträger, Spitze 12) | neu | `OLY_FORMKARTEN_FARBREGEL=alt` |

**Eine Wahrheit für die Kartenwerte:** `calculateFormModifierForSide` (`lib/lineups/legacy-lineup-modifiers.ts`) rechnet über
`formkartenZerlegungFuerSpieler` (`lib/lineups/formkarten-farbregel.ts`) und liefert `formByPlayerId`. Legacy-Wertung, Einsatzliste
(`lib/lineups/formkarten-wirkung.ts`), Arena-Aufstellungsadapter und KI-Kartenplan lesen genau diese Funktion; ein Pfad, der selbst
x2 rechnet, ist ein Fehler. **Gezeigt = gebucht:** `formkartenBuchung` sagt, ob die gespielte Karte in dieser Disziplin gebucht wird
(Battle-Modus: nur `FORMKARTEN_ECHT_DISCIPLINE_IDS`, sonst Ersatzkarte); die Einsatzliste verspricht dort sonst keine Punkte.
**Seit 18.11. zählt die gelegte Karte in allen zwanzig Disziplinen** (alle in `FORMKARTEN_ECHT_DISCIPLINE_IDS`, auch die Pods
Battlefield, Mini-DM-FFA und Bahn-Pod; Mini-DM über `FORM_POD` im Motor). Der Wächter `tests/formkarten-alle-disziplinen.test.ts`
wird rot, wenn eine motor-gebuchte Disziplin (`wirdAusMotorGebucht`) fehlt. **Farbbonus = Klassenfarbe des Spielers gleich
Kartenfarbe** (nicht Disziplinfarbe, nicht Rolle); die Disziplinfarbe entscheidet nur „alle“ voll oder halb. Messung und
Erklärung: `docs/design/formkarten-alle-disziplinen-18-11.md`.
**Formkarten Plus/Minus (Chris, 22.11.):** jeder Spieler hat eine positive Farbe (seine Klassenfarbe) und eine negative, die Gegenfarbe (POW↔MEN, SPE↔SOC, Faktor 0,25: Pluskarte kostet die Gegenfarbe, Minuskarte bleibt negativ), Kartenwerte 2/4/6/8 ohne 0, KI gewichtet knappe Duelle und Rivalen. Die Regel steht im Spielstand (`seasonState.formkartenRegel`, `lib/resolve/formkarten-regel.ts`): neues Spiel ab Saison 1, bestehender Spielstand ab dem nächsten Saisonwechsel; jeder Rechenweg fragt `formkartenRegelFuer(gameState)` bzw. `resolveFormMoralRegeln(env, gameState)`, nie die Variable. Rückweg `OLY_FORMKARTEN_PLUSMINUS=aus` (neue Saisons), Notbremse `=aus-sofort` (schaltet nur Gegenfarbe und Duellgewicht ab, die Kartenwerte bleiben); die Variable gilt nur auf dem Server (compose + `.env`), kein `NEXT_PUBLIC`. Doku: `docs/design/formkarten-plusminus-22-11.md`.
**Mutator = Form, keine Punkte (Chris, 18.11.):** im Battle-Modus bucht ein Mutator-Treffer nie mehr Score (+6) oder PP (+0,3);
Motor-Seiten tragen den Schub im Motor (+3,5 Attribut je Treffer), legacy-gewertete Battle-Seiten und die Vorschau bekommen
+3,5 Form je Treffer über den Formkarten-Kanal (`mitMutatorForm`). Abschalten: `OLY_MUTATOR_ALS_FORM=0`. Manager-Modus unverändert.
**Moral wird als Gesicht in Farbe (grün bis rot) plus Zahl gezeigt** (`BcMoralGesicht`, Stufen 80/60/40/20: sehr zufrieden, zufrieden,
neutral, unzufrieden, verärgert), nicht als Herz und nicht als Emoji. Der Form-Verlauf liegt je Spieler in `playerFormState[].verlauf`
(Saison-Reset zur Mitte beim Saisonwechsel). Wertungs-Fingerabdruck blieb bei `ce8fcef66028`, weil die Engine nicht angefasst wurde.

## Verletzung heißt: nicht einsetzbar, und 50 % in der Verletzungs-Disziplin (Chris, 18.11.)

Wörtlich: „Verletzt ist nicht nur −10, sondern gar nicht einsetzbar! Und IN der Disziplin, wo er sich verletzt hat, hat
er nur 50 % seiner Basisleistung bzw. Eignung/Score.“ Ein verletzter Spieler darf für die Dauer der Verletzung weder
manuell noch von der KI noch von einem Auto-Auffüllweg aufgestellt und nicht gewertet werden. In der Disziplin, in der
er sich verletzt, zählt nur die Hälfte seiner Basisleistung — gezeigt = gebucht. Anzeigen dürfen eine Verletzung nicht
als bloßen Formabzug darstellen. Umsetzung und Messung: `docs/design/verletzung-regel-18-11.md`.

## Finanzen und KI-Kaufverhalten: feste Vorgaben (Chris, 18.11.)

- **Rücklage nach Finanzwert, nicht nach Geld.** „Reiche Teams behalten 15–25 %“ meint den **Finanzwert des Teams in der
  Team-Matrix (1–10)**: hoher Finanzwert behält auch in Saison 1 15–25 % des Budgets als Cash, niedriger 5–10 %.
- **Der alte Gehaltsdeckel (`OLY_SALARY_CEILING_V2`) bleibt aus** — „da haben die Teams dann nur Mist gekauft“. Kein
  neuer harter Gehaltsdeckel; die Orientierung am gepickten Sponsor läuft weich (Forecast mit Sponsor, Rücklage, Vorstand).
- **Der Vorstand verhängt keine Geldstrafen.** Bei ausbleibendem Erfolg gibt er weniger Budget frei: das Team darf bei
  Transfers nur auf X % seines verfügbaren Budgets zugreifen.
- **So wirkt die Freigabe (Chris, 18.11., „wie im Football Manager“):** Der Vorstand nimmt nichts weg — das Geld bleibt auf
  dem Konto, nur X % davon dürfen für Ablösen UND Gehälter (neue Verträge, Gehaltserhöhungen) ausgegeben werden. Die Sperre
  ist **hart**: ein Kauf oder Vertrag über dem freien Betrag ist nicht möglich (Mensch und KI gleich). **Verkaufserlöse
  unterliegen derselben Quote** — bei 70 % werden von 20 C Verkauf nur 14 C ausgebbar, der Rest bleibt als gewollter Puffer
  auf dem Konto. Stufen nach Vertrauen (Chris, 18.11. abends): ab 7,5 → 100 %, Standard 90 % (ab 5), 80 % unter 5, 70 % unter 3, 50 % unter 1,5. Die Rücklage nach Finanzwert
  bleibt dagegen **weich** (Warnung, Vertrauensverlust).
- **Zwei Budgets wie im FM (Chris, 18.11.: „optisch und inhaltlich so bauen“):** Transfer-/Investitionstopf und
  Gehaltstopf, Konzept `docs/design/finanzkonzept-v2-budgets-18-11.md` (Abschnitt 12 = Entscheidungen). Festgelegt:
  - **Ab Saison 2 Rücklage nach Gehaltskosten (Chris, 18.11.):** `q(Finanzwert) x Jahresgehalt des Kaders auf Soll-Größe` statt Startbudget/Kasse + Kaderwert. Der Pflichtkader 8 ist nie gesperrt (Mensch und KI), Planer und Sperre rechnen mit derselben Zahl (`kaufRahmen`).
  - **Saison 1:** Vorstands-Quote für alle 100 %; die Draft-Rücklage nach Finanzwert ist **halb so hoch** wie üblich (mehr
    Spielraum beim Draft), voll erst ab Saison 2. Startbudgets und Sponsoren bleiben unverändert.
  - **Gehaltstopf:** der Vorstand kürzt ihn höchstens auf **75 %** (nie 50 %); frei werdendes Gehalt eines verkauften
    Spielers fließt zu **100 %** in den Gehaltstopf zurück. Nur der Verkaufserlös unterliegt der Transfer-Quote.
  - **Gebäude** zahlen aus dem Transfer-/Investitionstopf, kein dritter Topf.
  - **„Alles auf eine Karte“** (gebaut, Finanzseite 18.11.): beantragt vom Menschen, gewollt von einem Top-Team oder vom
    Vorstand als Ziel gefordert — dann darf bis auf **5 % Puffer** alles ausgegeben werden. Dazu „Rücklage anzapfen“ (kostet
    Vertrauen). Regeln und Entscheidungen: `docs/design/finanzen-v2-seite-18-11.md`.
  - **Die Finanzseite** (`app/foundation/finances/FinanzenModern.tsx`, Mockup `public/mockups/finanzen-modern-18-11.html`) ist neu
    gebaut, die alte `FoundationFinancesNewLook` samt `.nl-fin-*` ist raus. **Gehälter stehen groß je Saison und klein je
    Spieltag** (Chris, 18.11.), Einheit C. Gebäude (Bau und Ausbau) zahlen aus dem Investitionstopf, Gehaltserhöhungen bei
    Verlängerungen aus dem Gehaltstopf, beides hart und für Mensch und KI gleich (`pruefeGebaeudeGegenVorstandFreigabe`,
    `pruefeVerlaengerungGegenVorstandFreigabe` in `lib/finance/vorstand-budgetfreigabe.ts`). Geschrieben wird nur über
    `POST /api/finance/vorstand` hinter `authorizeServerRoomWrite`.
- **Kaderstärke** wird überall über die **besten 6** gerechnet, nicht über die Einsatzplätze — sonst zu genau, sie würde das
  Ergebnis spoilern (Chris, 18.11.).
- **Scouting-Nebel:** Ungescoutete Spieler zeigen nur grobe Bereiche; Sortieren und Filtern dürfen keine verdeckten Werte
  verraten (Chris, 18.11.).
  Regeln (Chris, 18.11., Kader-&-Teams-Mockup #1595 Abschnitt 7a): feste Stufen (unbekannt 10er, beobachtet 5er, gescoutet
  exakt), nie „~Zahl“ um den wahren Wert; Sortieren nach Stufe, Gleichstand nach Name. **Marktwert ist immer exakt
  sichtbar.** Kaderstärke fremder Teams als grobe Stufe, exakt nur bei vollem Scouting. **Eine Einstellung schaltet den Fog
  of War ganz aus** (Testzwecke, Spielbeginn). Ränge gegen die eigene Liga, klein daneben gegen alle 32.
- **Test- und Messläufe ohne menschliches Team:** 32 KI-Teams von Anfang an, nicht ein Preset mit menschlichem Team, das
  nachträglich auf KI umgestellt wird (sonst fehlt diesem Team z. B. der Sponsor, Messung 18.11.).
- **Gehaltsanzeige (Chris, 18.11.):** Wo ein Gehalt in Saison- und Spieltagswert gezeigt wird, steht **groß das Gehalt je
  Saison, klein darunter das je Spieltag.** Nie umgekehrt, nie gleich groß nebeneinander.
- Gesamtkonzept: `docs/design/finanzkonzept-v2-18-11.md` (Chris: „gefällt mir sehr gut … genau so einbauen, nicht integrieren“).

## Player Points (PPs): Leistungsmaß, Top-Spieler um 5 je Disziplin (Chris, 18.11.)

Wörtlich: „die PPs sollen weiterhin eine Darstellung der Leistung der Spieler sein, Top-Spieler sollen in einer Diszi um
die 5 PPs bekommen als Maximum — schau mal, dass du das gebalanced bekommst! bin da offen für changes“. Zielskala: der
beste Spieler einer Disziplin an einem Spieltag liegt um 5 PP, nicht weit darüber. Jede Änderung an der PP-Skala muss alle
Abnehmer kennen (Bestenliste, MVP, Saisonstand, Marktwert, Training, Moral/Form) und gezeigt = gebucht halten.

**Scharf seit 18.11. (Chris: Variante C2, dazu die Ergebnisskala E1 für die Team-Ergebnisse):** Welche Skala gilt,
steht im Spielstand, nicht im Serverstart: `seasonState.wertungsSkalen = { seasonId, pp: "c2"|"alt", ergebnis:
"e1"|"alt" }` (`lib/resolve/wertungs-skalen.ts`), gesetzt nur beim Anlegen eines Spiels und beim Saisonwechsel. Neues
Spiel: C2 + E1 ab Saison 1; bestehender Battle-Save mit höchstens 3 gebuchten Spieltagen: C2 ab dem nächsten Spieltag
(Lade-Migration `stelleLaufendeSaisonAufC2Um`, Feld `ppAb`; gebuchte Spieltage bleiben, Zeilen tragen `ppSkala: "c2"`),
sonst ab dem nächsten Saisonwechsel; E1 immer erst zum Saisonwechsel. Rückweg
`OLY_PP_SKALA=aus` / `OLY_ERGEBNIS_SKALA=aus` (wirkt ab der nächsten Saison), Notbremse `…=aus-sofort`. Jeder
Rechenweg fragt `ppSkalaModus(gameState)` bzw. `ergebnisSkalaVersionFuer(gameState)`, nie eine Prozess-Variable.
E1: je Begegnung 0–10 je Seite (Kantersieg 10:0, Median-Sieg 7:4, Remis bleibt Remis), Verhältnis = Abstand, Pods
„eigener Wert minus Mittel der Gegner“; die Arena zeigt „87 : 79 → 7 : 4“. Anker nachkalibrieren:
`werte-pp-skala-aus.mjs` dann `werte-ergebnisskala-aus.ts` (je `--schreibe-kalibrierung`). Doku:
`docs/design/pp-skala-18-11.md` Abschnitt 8, `docs/design/ergebnisskala-18-11.md`.
**PP-Tagesanker (Chris, 22.11.: „ja“, scharf ab der nächsten Saison):** gegen den Klumpen bei 5,0 werden die Spieler-PP je Disziplin
und Spieltag über beide Ligen neu verteilt (Mittel der besten drei auf 5,5, weiche Kappe ab 4, Tagesbester um 4,8–5,0).
Schalter ist der Stempel `seasonState.wertungsSkalen.ppTagesanker` (neues Spiel ab Saison 1 an; bestehender Spielstand erst
ab dem nächsten Saisonwechsel, gebuchte Spieltage bleiben), jeder Rechenweg fragt `ppTagesankerFuer(gameState, matchdayId)`.
Rückweg `OLY_PP_TAGESANKER=aus` (neue Saisons), Notbremse `=aus-sofort`. Doku: `docs/design/pp-tagesanker-live-22-11.md`.

## Arena-Einnahmen und Medaillen (Chris, 22.11.)

Platzarten Steh/Sitz/Loge (Grundarena 4.000), Tageskasse je Heimspiel, Dauerkarten (Rabatt 25 %), Ausbau von Hand (Steh +1.000, Sitz +1.000, Loge +100;
Obergrenzen 15.000 / 10.000 / 1.200) aus dem Investitionstopf, harte Vorstands-Freigabe, KI nach denselben Regeln. Disziplin-Medaillen und Farb-Meister am Saisonende,
bezahlt aus dem Rangprämien-Topf. Regeln im Spielstand (`seasonState.arenaRegel`, `medaillenRegel`; Abfrage nur `arenaAktiv` / `medaillenAktiv`), Rückweg `OLY_ARENA=aus` /
`OLY_MEDAILLEN=aus` (`aus-sofort` = Notbremse), nur Server. Bau, Messung, Abbildung des alten Gebäudes: `docs/design/arena-tickets-medaillen-22-11.md`.

## Marketing (Chris, 22.11.)

Werbegeld je Spieler, dynamischer Team-Anteil und Teammarke in der Kasse (Posten "Marketing"), Spieler-Anteil hebt die Moral; wirkt nie auf Wertung,
Marktwert oder Sponsor. Regel im Spielstand (`seasonState.marketingRegel`, Abfrage nur `marketingAktiv(gameState)`), Rückweg `OLY_MARKETING=aus` / `aus-sofort`, nur
Server. Eine Rechenstelle: `lib/marketing/marketing-team.ts`. Bau, Messung, Folgeaufträge: `docs/design/marketing-bau-22-11.md`.

## Jeder Bau: Abgleich mit dem Mockup und Korrekturschleife (Chris, 18.11.)

Wörtlich: „Wichtig: wenn du neue Dinge baust, IMMER einen Abgleich machen — Screenshot schauen und vergleichen mit dem
Mockup, dann Korrekturschleife, bis die Funktionen drin sind und die Optik so aussieht wie im Mockup.“ Ein Bau-PR ist erst
fertig, wenn (1) Aufnahmen aus der **echten App** bei 1920×1080 und 2560×1440 neben dem Mockup liegen, (2) der Agent sie
**selbst angesehen** und jede Abweichung behoben oder begründet hat (Liste drin / angepasst / fehlt), (3) kein
Seitenscroll, keine Überlappung, kein abgeschnittener Text, keine doppelten Knöpfe, kein Platzhaltertext bleibt, und
(4) bei Seiten je Disziplin **Stichproben über mehrere Disziplinen** (mindestens ein Feldspiel, eine Bahn, eine Bühne,
Mini-DM/Spurt) gemacht sind. Code mit grünen Tests ohne Abgleich-Bilder ist kein fertiger Bau. Aufnahmen laufen unter
`flock /tmp/oly-aufnahme.lock` (Rechner hat 15 GB RAM, ein Browser zugleich).

## Training und Entwicklung: je Spieltag (Chris, 18.11.)

Mockup `public/mockups/training-modern-18-11.html`, Konzept `docs/design/training-modern-18-11.md` (Abschnitt 7a),
Chris: „bitte setz das 1:1 so um“. **Training wirkt je Spieltag** und wird je Spieltag gebucht und getrackt (nicht am
Saisonende); die Raten müssen dafür neu gebalanced werden (bisher auf ~10 Spieltage ausgelegt, die Saison hat 20).
Trainiert wird auf eine **Ziel-Disziplin mit Weg** (Primär-/Nebenweg, Matrix nur gelesen), Fokus jederzeit wechselbar.
Verletzte trainieren nicht; Überlastung drückt die Form leicht. Kein Alter.

## Neuer Stil überall — Seite für Seite neu konzipieren, nicht mischen (Chris, 18.11.)

Wörtlich: „ich denke wir haben nun einen sehr guten Style gefunden mit den neuen Mockups und genau so möchte ich das auch
umgesetzt haben, nicht nur integriert — das ist ganz wichtig. Der alte Stil darf dann nicht überall mit dem neuen gemixt
sein, sondern letztendlich müssen wir step by step die Seiten neu konzeptionieren und aufsetzen inkl. der neuen Mechaniken.“
Jede Seite wird nach dem Mockup **neu gebaut** (eigene Komponente, eigenes CSS im Mockup-Stil), nicht in die alte Seite
eingehängt; die alte Fassung fliegt danach raus. Reihenfolge und Stand je Seite: `docs/design/seiten-umbau-fahrplan-18-11.md`.

**Rangregel (Chris, 21.11.): Rang 1 ist immer der beste.** Bei Kosten (Gehalt, Ablöse, Schulden) ist das günstigste Team 1.,
nicht das teuerste; bei Kasse, Stärke, Punkten das höchste. Gilt für alle Ranglisten, Vergleiche und Rangbalken der App.
**Weitere Designregeln (21.11.):** alle Tabellen sortierbar; steht eine Zahl, keine Notenstufe daneben; Klassen immer in
Klassenfarbe, wo Platz ist mit Klassen-/Rassen-Icon (`docs/design/oly-seiten-modern-17-11.md`).

**Schriftregel (Chris, 18.11.):** **RaniraSeason für Überschriften und Namen, Barlow Condensed für Fließtext, Zahlen und
Labels — beide lokal** (`public/fonts/`, `@font-face` mit `font-display: swap` in `app/globals.css`, kein Google-CDN). Die App
hängt an zwei Tokens: `--schrift-haus` (RaniraSeason, Rückfall Georgia) und `--schrift-zahl` (Barlow Condensed, Rückfall
Roboto Condensed/Arial Narrow); `--nl-display` und `--nl-sans` zeigen darauf, in den Mockups heißen sie `--haus` und `--zahl`.
Seiten tragen keine eigene Schrift (kein Georgia, kein `system-ui`) ein, sondern nutzen die Tokens. Ausgenommen ist die Arena
(Canvas/SVG-Beschriftungen in `battle-mode.engine.js` und `discipline-stage/arena/`).

## Breaking ist Folter, nicht Breakdance — nicht mehr nachfragen

Chris am 13.09., wörtlich: „breaking NICHT breakdance ist sondern ein foltern!!!! […] einer
schmerz zufügt der andere muss es aushalten dann ist wieder der andere dran bis einer aufgibt."
Eine Breakdance-Recherche wurde damals schon einmal gefahren und verworfen
(`docs/design/breaking-folter-zweikampf-praesentation-13-09.md` Abschnitt 0) — und ist am 26.09.
einem Konzeptreview-Agenten trotzdem ein zweites Mal passiert, weil der Name „Breaking" ohne
diesen Satz naheliegend nach Breakdance klingt. Jeder Agent, der an dieser Disziplin arbeitet,
recherchiert Folter-/Survival-Formate (Slap-Fighting, Kendo-Kachinuki, K.o.-Teamformate), nicht
Breakdance-Battles.

## PixelLab-Tod-Animationen: zum Charakter passend wählen, nicht generisch kippen lassen

Chris am 07.11., im Kontext der 360-Charaktere-Animationsreparatur, wörtlich: „Generell darfst du
passend zum Charakter auch den Tod wählen. Also auch blutiger und brutal möglich. Das einfach nach
hinten oder vorne kippen sieht manchmal aus wie hinfallen." Gilt für alle PixelLab-Figuren, nicht
nur für den Anlass-Fall (genta, Batch 11 der Animationsreparatur): die Tod-Animation darf — wenn
es zum Charakter passt — explizit blutig/brutal ausfallen (Belege dafür: Kanonen-Panzertiere
kippen auf den Rücken statt kurz zu blinken, Batch 1; ein gewöhnlicher Büro-Typ bekommt einen
Herzinfarkt-Tod statt Kampf-K.o., Batch 10). Ein reines Vorne-/Hinten-Kippen ist nur dann in
Ordnung, wenn es wirklich wie ein K.o. wirkt — wirkt es nur wie ein Hinfallen, zählt das als
Mangel und braucht eine charakterspezifischere Pose, kein 0815-Umkippen.

## PixelLab-Charaktere und -Animationen: keine neuen ohne Freigabe — Requisiten bleiben frei

Chris am 09.11., nachdem ein Agent für ein neues Spurt-Format ungefragt drei neue PixelLab-
Animationen für eine einzelne Figur bestellt hatte, wörtlich: „moment du darfst nicht einfach
irgendwelche animationen anlegen!!! die sind sau teuer wenn wir das für [den ganzen
Figuren-Bestand] machen deswegen haben wir nur die basis animationen bisher! du musst erstmal
auskommen damit bis ich es dir erlaube!" **Keine neue PixelLab-Animation für eine bestehende
Figur und keine neue Figur — auch nicht „nur für eine Testfigur" oder „nur probeweise" — ohne
Chris' ausdrückliche Freigabe für genau diesen Fall.** Grund, von ihm selbst am 10.11. präzisiert:
eine Animation oder ein neuer Charakter ist teuer in der Summe, weil sie potenziell für den
gesamten, großen Figuren-Bestand anfällt, nicht nur für eine Figur. Das gilt unabhängig davon,
wie viel besser eine Mechanik oder eine neue Kamera-Ansicht damit aussähe: der bestehende
Animationsbestand (Grundposen plus die bereits abgeschlossene „Nord"-Ergänzung) ist das, womit
jede neue Disziplin, jedes neue Format und jede neue Kameraperspektive auskommen muss, bis er
selbst grünes Licht für mehr gibt. Ein Agent, der eine fehlende Pose bemerkt, schlägt sie vor
(mit Umfang-/Kostenschätzung wie seinerzeit bei der Nord-Animation-Kampagne) statt sie selbst zu
bestellen.

**Ausdrücklich NICHT von dieser Sperre betroffen, Chris am 10.11. wörtlich: „du darfst PixelLab
Assets generieren, aber keine Charaktere oder Animationen [...] die normalen Assets, die wir
brauchen, wie eine Schatztruhe oder eine Kiste oder solche Dinge, die darfst du auch so weiterhin
generieren":** gewöhnliche Requisiten/Objekte (Kisten, Schatztruhen, Gerätschaften, Kulissen-
Versatzstücke und Ähnliches) bleiben frei bestellbar, wie bisher — der Kostentreiber ist die
Vervielfachung über den ganzen Figuren-Bestand, die bei einem einzelnen Requisiten-Sprite nicht
anfällt. Im Zweifel (eine neue Art von Objekt, die einem Charakter sehr nahekommt, z.B. ein
Maskottchen oder eine Kreatur) lieber einmal nachfragen statt anzunehmen.

**Fable bestellt für Arenen und Effekte selbst (Chris, 17.11.): „fable darf für optik und
verbesserungen der arenen und effekte von sich aus bestellen! freigabe erteilt".** Gilt für
Kulissen, Requisiten und VFX (auch kleine UI-Rahmen/Icons als Requisiten) — **nicht** für neue
Charaktere und Animationen, die bleiben gesperrt. Rahmen, gesetzt am selben Tag: etwa **1000
Generationen für 10 Tage** (Guthaben 1041,7 am 17.11.), **kein Nachkauf** (Chris: „nachkaufen
nein"), **Reserve 150 unantastbar**; vor jeder Bestellung Kosten schätzen und `/balance` lesen,
danach `usage.generations` aus der Job-Antwort protokollieren (die Kontodifferenz taugt nicht,
solange mehrere bestellen); **Bestellungen werden nie automatisch wiederholt** (ein POST nur
einmal) und laufen unter `flock /tmp/pixellab-bestell.lock` (nur ein Besteller zugleich); erst
Stilprobe, nur Treffer einbauen; Herkunft in die `quellen.json`. Stand und Töpfe:
`docs/design/offene-punkte-entscheidungen-17-11.md`.

**REMAKE statt Übertragung — GANZ WICHTIG (Chris, 17.11.):** „wichtig ist dass wir die designs
wirklich von pixel lab verwenden und nicht einfach die alten hässlichen 1:1 übertragen und
kopieren sondern REDESIGN als REMAKE/2D HD … sonst sieht so was wie time trial moderner aus und
spurt bleibt hässlich, das geht nicht". Jede Arena/Kulisse, die auf PixelLab umgestellt wird, wird
**neu gestaltet** (eigenes Areal, Tiefenstaffelung, Licht, Requisiten im 2D-HD-Look wie I-Spy,
HYROX-Arena, TDM), nicht der alte Entwurf mit neuem Bildmaterial nachgebaut. **Kein Gefälle**
zwischen den Disziplinen: vor einer neuen Arena prüfen, ob eine verwandte Disziplin (Zeitfahren
↔ Spurt ↔ Staffel ↔ Takeshi) sichtbar moderner aussähe, und diese gleich mitziehen. Dazu: mehrere
verschiedene Arenen/Varianten je Disziplin mit eigenen Assets (z. B. Takeshi), nicht eine Karte mit
Umfärbung.

## Eigener Kader: immer alle Figuren — Animationsfehler sofort beheben, alles lokal speichern (Chris, 21.11.)

Wörtlich: „mein Kader sollte auf jeden Fall immer alle Figuren generiert haben + die Basis-Animationen“. **Freigabe ohne
Rückfrage:** Hat ein Spieler im Kader des menschlichen Teams keine PixelLab-Figur (Index `data/generated/figuren-sprites.json`),
wird sie mit den Basis-Animationen (walk/angriff/treffer/tod, Süd/Ost/Nord, Kanon in `scripts/figuren-bestelle-animationen.py`)
erzeugt — auch bei neu verpflichteten Spielern. Für andere Teams gilt weiter die Sperre oben. Erste Runde 21.11.: sechs Figuren
für Death Peaches, 147 Generationen (`docs/design/figuren-kader-dp-21-11.md`).

Wörtlich: „wenn die Figuren von hinten sich nach vorne drehen, ist das IMMER ein Grund es zu fixen! … solche Bugs musst du nicht
beschreiben, sondern wenn du sie findest fixen … für Fixes hast du immer ne Freigabe, weil ich erwarte, dass die Animationen, die
wir haben, wenigstens sauber sind und runtergeladen werden und bei uns auf dem Server auch gespeichert werden“. **Reparaturen an
bestehenden Animationen** (falsche Richtung, Drehung zur Kamera in Nord-Animationen, doppelte Waffen, Effekt in falsche Richtung,
fehlende/kaputte Frames) **brauchen keine Rückfrage** — gefunden heißt nachbestellen (nur die fehlerhafte Richtung, an dieselbe
Gruppe, gleiche Framezahl), nicht beschreiben. Es gelten die Bestellregeln (flock, ein POST, Reserve 150, `usage.generations`
protokollieren). **Jede Animation liegt vollständig lokal** unter `public/sprites/figuren/<slug>/` im Repo (und damit auf dem
Server); nichts darf zur Laufzeit von PixelLab nachgeladen werden.

## Nur noch PixelLab-Assets — für alle zwanzig Disziplinen

Chris am 17.11., wörtlich, nachdem die I-Spy-Hallen mit PixelLab neu gebaut worden waren: „Das mit
Pixel lab gilt auch für alle anderen diszis! Wir nutzen keine alten Assets mehr sondern nur noch eie
aus Pixel lab". **Jedes neue sichtbare Bildasset (Kulisse, Boden, Requisit, Falle, Möbel, Objekt) wird
mit PixelLab erzeugt — nicht mehr aus OpenGameArt, Kenney oder anderen Paketen, nicht mehr als
Canvas-Primitive aus Code und nicht mehr aus den alten Szenen-HTMLs unter `public/szenen/`.** Das
gilt für alle zwanzig Disziplinen, nicht nur für I-Spy. Bestehende Nicht-PixelLab-Assets werden nach
dem Audit `docs/design/pixellab-nur-neue-assets-audit-17-11.md` in Wellen ersetzt (Reihenfolge und
Kosten dort; bestellt wird, was Chris freigibt). Herkunft jedes neuen Assets steht in
`public/sprites/kulissen/quellen.json` bzw. `public/sprites/arena/quellen.json`. **Unverändert
gesperrt bleiben neue Charaktere und neue Animationen** (siehe Abschnitt oben) — diese Regel betrifft
nur Requisiten und Kulissen.

**Zielbild (Chris, 17.11.): ein einheitlicher PixelLab-Stil für ALLE zwanzig Disziplinen.** Wörtlich:
„Alle Diszis sollen am Ende den gleichen Pixel lab Stil haben und die Assets davon! Das ist das
Target." Das ist der Zielzustand des Gesamtprojekts, nicht nur eine Regel für Neues: am Ende kommen
Kulisse, Boden, Requisiten, Effekte und (soweit sichtbar) HUD-Elemente jeder Disziplin aus
PixelLab und wirken wie aus einer Hand. Wo eine Disziplin optisch noch „alt" aussieht (zuletzt
Chris am 17.11. über die lange HYROX-Bahn im Vergleich zu den neuen Arenen), ist das ein
Arbeitsauftrag, kein Geschmacksthema. Die Ersatz-Reihenfolge steht im Audit
`docs/design/pixellab-nur-neue-assets-audit-17-11.md` (Wellen A/B/C) und im HYROX-Optikkonzept
`docs/design/hyrox-optik-konzept-17-11.md`. Chris hat am 17.11. zusätzlich HUD, Effekte und den
Schiedsrichter (als einzige freigegebene neue Figur) ausdrücklich in den PixelLab-Stil einbezogen.

## Rollenverteilung der Modelle: Opus führt, Sonnet baut, Fable berät

Chris am 17.11., wörtlich: „du bist nun der Projektmanager und managed das. Für so Design-Fragen gerne
Fable als teuren externen Berater sehen, für günstiges Building nutzt du Sonnet. und du selber managed
das, kümmerst dich um Rückfragen etc. solange du das Ziel kennst, kannst du darauf hin arbeiten, kleine
Fragen selber beantworten, Bugs fixen etc."

- **Hauptsitzung (Opus) = Projektmanagement:** Ziele kennen und darauf hinarbeiten, kleine Fragen selbst
  entscheiden (Empfehlung umsetzen, Entscheidung dokumentieren), Bugs fixen, Agenten beauftragen und
  ihre Ergebnisse prüfen (Fingerabdruck, Tests, Review), committen, PRs bis grün führen und mergen. Nur
  echte Grundsatzfragen gehen an Chris.
- **Sonnet = Bauen:** Umsetzung nach fertigem Entwurf, Konfiguration, Doku, Tests, Screenshots,
  mechanische Merges. Standard für Bau-Agenten.
- **Fable = teurer externer Berater:** Design-/UX-Entwürfe, Mockups, Konzepte, Asset-Bestellungen
  (Kulissen/Requisiten/VFX). Nicht für das Ausbauen fertiger Entwürfe.
- **Opus als Agent** nur, wo es das Risiko rechtfertigt: unabhängige Reviews von Wertungsänderungen
  und heikle Eingriffe in die Arena-Engine.

Priorität laut Chris (17.11.): Assets und HUD/UI zuerst, neue Posen/Animationen später. Seine Idee dazu:
Modelle/Animationen später nur für die tatsächlich gepickten Spieler erzeugen, wenn wirklich gespielt
wird, damit sich die Kosten verteilen. Günstige Kombinationen vorhandener Animationen sind ausdrücklich
erwünscht; neue Animationen bleiben ohne Einzelfreigabe gesperrt.

## Größere Konzepte: immer zuerst Mockup + Erklärung, im neuen Stil

Chris am 17.11., wörtlich: „mach für das Finanzthema und Sponsoren dann auch erstmal ein Mockup +
Erklärung — das müssen wir jetzt sauber immer bei größeren Konzepten machen. jetzt hast du nen Style
gefunden, der modern ist und den ich richtig cool finde! jetzt können wir die ganze App damit über die
nächsten Wochen hardcore verbessern!!"

- **Ablauf für jedes größere Konzept** (neue Seite, Umbau einer Seite, neues System wie Finanzen,
  Form/Moral, Sponsoren): (1) klickbares Mockup + kurze Erklärung (Fable als Design-Berater), (2) Chris
  sagt „bau das“ oder korrigiert, (3) Bau mit Sonnet, (4) Prüfung/Merge durch die Hauptsitzung. Erst
  bauen, wenn Chris das Mockup gesehen hat.
- **Der verbindliche Stil** ist der der Mockups vom 17.11.: `public/mockups/basketball-ui-mockup-17-11.html`,
  `public/mockups/einsatzliste-modern-17-11.html`, `public/mockups/oly-start-modern-17-11.html`, Plan
  `docs/design/oly-seiten-modern-17-11.md` (Designsystem: Tokens, Barlow-Condensed-Zahlen lokal, Karten,
  Tabellen, Icon-Schiene, Blatt). Neue Mockups übernehmen dieses System exakt, damit die App aus einem
  Guss wird. Reine CSS/SVG-Gestaltung; PixelLab nur, wo ein Bild echten Mehrwert hat.
- **Nach dem Bau immer mit dem Mockup abgleichen** (Chris, 18.11.: „wichtig, dass die ganzen coolen
  Features und Optik, die man vorher sieht, dann auch im Spiel wiederfindet“). Pflicht zum Abschluss
  jedes Baus nach Mockup: je Ansicht ein Bildpaar „Mockup | App“ nebeneinander unter `docs/design/…`
  und eine Liste jedes sichtbaren Mockup-Features als **drin / angepasst (warum) / fehlt (warum)**.
  Was im Mockup erfunden war (z. B. Siegchancen ohne Datenquelle), wird ehrlich ersetzt, nicht
  stillschweigend weggelassen.

## Zielbildschirme: 15"-MacBook M4 und 32"-4K-Monitor

Chris, 18.11., wörtlich: „Bitte alle Layouts, Spiele etc. auf 16:9 optimiert, 15" MacBook und
Hauptscreen ist 32" OLED, bitte merken.“ Nachgeschärft: „MacBook M4 hat 'ne bessere Auflösung […]
und Rechner ist 4K-Monitor!“ Jede Seite, jede Arena und jedes HUD wird für diese zwei Geräte gebaut
und geprüft:

| Gerät | Viewport zum Prüfen (CSS-px) | Pixeldichte |
|---|---|---|
| MacBook Air 15" M4 (2880×1864 nativ, Standard-Skalierung) | 1710×1112 (16:10) | 2 |
| 32" 4K-Monitor (3840×2160) | 2560×1440 (150 %) und 1920×1080 (200 %) | 1,5 bzw. 2 |

**Hauptziel ist der 4K-Monitor in 16:9** (Chris, 18.11.: „hauptsächlich auf den 4K-Monitor
aussteuern, dass alles drauf passt — wäre doof, wenn du auf 16:10 skalierst und nur am MacBook die
Breite aufgeht, es sonst aber nicht passt“). Erst muss alles bei **2560×1440** (und 1920×1080) ohne
Scrollen und ohne leere Ränder passen, dann wird **1710×1112** (MacBook, 16:10) geprüft; 3840×2160
(100 %) und Phone (412 breit) sind Nebenproben.

**Jeder Screen nutzt so viel vom Bildschirm wie möglich** (Chris, 18.11.: „bau alle Screens so,
dass sie möglichst viel vom Bildschirm nutzen, und vor allem die Battle Arena … die braucht ja
wirklich jeden cm Breite und Höhe“). Keine zentrierte Schmalspalte mit leeren Rändern, keine
festen Pixelbreiten für Hauptinhalte; die Arena füllt Breite und Höhe des Fensters (abzüglich der
Icon-Schiene), HUD und Steuerelemente liegen darüber oder am Rand, nicht darüber/darunter im Fluss. Auf dem MacBook darf nichts gequetscht,
abgeschnitten oder unnötig scrollend sein; auf dem 4K-Monitor darf nichts verloren wirken (keine
leeren Riesenränder, Schrift und Tafeln wachsen mit). Wird die genaue Skalierung eines Geräts
bekannt, hier eintragen.

## Mehrspieler ist Pflicht (Chris, 18.11.)

Wörtlich: „wichtig ist auch, dass ALL das weiterhin im Multiplayer möglich ist, wenn ich Franky als Spieler noch
hinzufüge und ggf. Ramona auch mal mitmachen möchte.“ Es spielen bis zu **drei Menschen**: Chris, Franky, Ramona (eigener
Login, Besitzer `ramona_local`). **Jede neue Seite und jede neue Mechanik** muss deshalb:

- **mit mehreren menschlichen Managern funktionieren:** das aktive Team kommt aus `activeManagerTeamId`, Besitz aus
  `ownerId` (`canOwnerManageTeam`), nie hart „Chris“, `user_local`, „das erste menschliche Team“ oder `teams[0]`;
  Online-Abfragen über `isOnlineSaveMode()`, nicht `=== "online_4v4"`. Jeder Schreibweg läuft durch
  `authorizeServerRoomWrite` mit `resolveAuthoritativeWriteOwnerId` und liest frisch vom Server.
- **je Team bzw. je Manager getrennte Zustände haben:** Merkliste, Scouting, Fog of War, Vorstands-Freigabe,
  Trainingsplan, Formkarten-Plan. Chris sieht in Taktgeber, Inbox und Startseite nur seine Teams; Vorfälle in fremden
  Teams halten seine Leertaste nicht an.
- **delegierbar sein:** je Bereich (Einsatzliste/Formkarten, Draft, Käufe/Verkäufe/Verträge, Training, Gebäude,
  Sponsor) kann ein Mensch selbst entscheiden oder an die KI geben (`TeamControlSettings.delegation`,
  `isBereichDelegiert` in `lib/foundation/team-delegation.ts`). Drei Stufen: **Voll selbst** (Chris, Franky),
  **Halbautomatik** (Ramona: KI stellt auf und trainiert, Käufe/Verkäufe macht sie selbst), **Voll KI**. Die delegierte
  KI nutzt dieselben Regeln und Funktionen wie für KI-Teams, **füllt nur, was der Mensch nicht selbst gesetzt hat**
  („Mensch überschreibt, KI respektiert das“) und hält die Vorstands-Freigabe ein. Ein Spieltag wartet nie auf einen
  abwesenden Menschen, dessen Bereich delegiert ist.

Konzept, Lückenliste und offene Fragen: `docs/design/mehrspieler-delegation-18-11.md`. Ramonas Passwort steht nur auf
dem Server (`OLY_USER_RAMONA_PASSWORD` in `deploy/hetzner/.env`), nie im Repo.

## An die Spielstände kommen

Der Server pusht seine **komplette** SQLite (also alle Spielstände) per Cron auf den Branch
`live-save`:

```sh
git fetch origin live-save
git show origin/live-save:data/online-saves/hetzner-live.sqlite.gz > /tmp/abbild.gz
gunzip -c /tmp/abbild.gz > /tmp/abbild.sqlite
```

Danach zeigt man die Werkzeuge über `OLY_APP_SQLITE_PATH` auf die **Kopie**:

```sh
OLY_APP_SQLITE_PATH=/tmp/abbild.sqlite npx tsx scripts/e2e-saisonende-am-save-abbild.ts
```

Der SessionStart-Hook (`.claude/hooks/session-start.sh`) macht genau das automatisch, wenn der
lokale Store leer ist. Ein Store, in dem schon Spielstände liegen, wird **nie** überschrieben.

`data/online-saves/manifest.json` (JSON-Exporte auf `main`) ist der ältere, zweite Weg und nur noch
Rückfall. Er trug über die gesamte Historie nur Smoke- und Audit-Saves, nie einen echten Stand.

## `npm run dev` lokal: Auto-Export abschalten, sonst pusht er auf `main`

Gefunden 16.11. bei einem visuellen Arena-Audit: `npm run dev` startet standardmäßig
`lib/persistence/online-save-auto-export.ts`, und dieser Mechanismus **committet lokale
Spielstände und pusht sie auf `main`** — genau das, was der Abschnitt oben als "nichts wird lokal
gespielt, nichts lokal gespeichert" ausschließt. Bei diesem Fund baute er tatsächlich einen Commit
("chore(daten): auto-export N Save(s)") und versuchte zu pushen; nur ein fehlgeschlagener Rebase hat
ihn aufgehalten, und das Skript hat den Commit danach selbst zurückgenommen — verlassen sollte man
sich darauf nicht.

**Jede Session, die die App lokal mit einem Dev-Server startet** (Browser-Sichtprüfung, Screenshots,
manuelles Durchklicken), setzt deshalb vorher:

```sh
OLY_AUTO_EXPORT_SAVES=0 OLY_AUTO_EXPORT_PUSH=0 npm run dev
```

## An Chris' In-Game-Meldungen kommen

Dieselbe Mechanik, anderer Branch: der Server pusht jede über die Flagge im Spiel abgeschickte
Meldung nach `bug-reports`. **Dafür muss Chris nichts tun** — nicht kopieren, nicht weiterleiten.

```sh
git fetch origin bug-reports
git ls-tree -r --name-only origin/bug-reports
git show origin/bug-reports:data/bug-reports/<datei>.json
```

Jede Meldung ist eine JSON-Datei mit `note` (Chris' Text), `page.view` (wo er stand), `game`
(Spielstand, Saison, Spieltag) und `createdAt`. Der Dateiname trägt den Zeitstempel, `ls-tree`
liefert sie also schon sortiert.

**Vor jeder Runde einmal lesen.** Die Tickets, die sonst mühsam aus Chats zusammengesucht werden,
stehen hier vollständig und mit Kontext — inklusive der Ansicht, in der er den Fehler gesehen hat.
Ausführlicher: `docs/BUGFIXING_AGENT.md`.

## Zuerst prüfen: spiegelt der Server überhaupt noch?

```sh
npx tsx scripts/pruefe-spiegel-frische.ts
```

Beide Spiegel (`live-save`, `bug-reports`) hängen an Crons **auf dem Server**. Fallen die aus,
schlägt nichts fehl — es passiert nur nichts mehr, und zwar lautlos. Am 19.08. stellte sich heraus,
dass beide seit dem 14.08. standen: fünf Tage lang war das neueste „aktuelle" Abbild fünf Tage alt,
und keine In-Game-Meldung erreichte GitHub.

**Ein veraltetes Abbild sieht aus wie ein gültiger Spielstand.** Wer darauf misst, misst die
Vergangenheit und hält sie für die Gegenwart. Der SessionStart-Hook fährt die Prüfung deshalb bei
jedem Start — auch dann, wenn er den Import überspringt.

Beheben kann das nur Chris auf dem Server. Dafür gibt es **einen** Befehl statt fünf:

```sh
ssh root@135.181.102.2
cd Olympiade-der-Welten && bash deploy/hetzner/spiegel-reparieren.sh
```

Das Skript prüft Crontab, Cron-Dienst, Deploy-Stand und Logs, richtet die Crons neu ein und
spiegelt einmal sofort. Es zerstört nichts — nur mit `--deploy-loesen` fasst es den Arbeitsbaum an,
und auch dann sagt es vorher, was es wegwirft.

## Etwas auf den Server zurückspielen

Nur über `deploy/hetzner/pull-repaired-save.sh` — **nicht** von Hand. Der Grund ist WAL: neben
`oly-app.sqlite` liegen `-wal` und `-shm`, die zur alten Datei gehören. Tauscht man nur die
Hauptdatei, schreibt SQLite beim Start die alte WAL auf den neuen Stand; bestenfalls ist der alte
Stand zurück, schlimmstenfalls ist die Datenbank kaputt. Das Skript sichert vorher, hält die App an,
räumt WAL/SHM weg und kann mit `--zurueck` alles rückgängig machen.

## Kader auffüllen, wenn ein Kauflauf abgebrochen ist

Ein Fehler beim Saisonstart konnte den KI-Kauflauf auf halber Strecke stehen lassen: die Sperre
`skipIfExistingMarketTransfers` fragte nur „existiert IRGENDEIN Transfer dieser Saison?" und stieg
dann für die **ganze Liga** aus. Teams blieben auf ihrem Minimum stehen, und auch ein erneuter Klick
auf „KI picken" tat nichts. Der Code ist repariert — ein **bestehender** Spielstand holt das aber
nicht von selbst nach, weil das Kauffenster der Saison durch ist.

```sh
ssh root@135.181.102.2
cd Olympiade-der-Welten && bash deploy/hetzner/kader-auffuellen.sh
```

Ohne Schalter gibt es **nur den Bericht**, die App läuft weiter. `--apply` fährt den Kauf wirklich
(sichert vorher nach `/root/oly-save-sicherungen/`, hält die App an, setzt Besitzrechte zurück),
`--zurueck` dreht auf die letzte Sicherung zurück. Gekauft wird über denselben Produktionspfad, den
das Spiel selbst nimmt — keine zweite Kauflogik.

## PRs mergen — Agenten dürfen das jetzt selbst

Chris am 10.11., wörtlich, nachdem ich noch dachte das Mergen bliebe sein Schritt: „ne das ist
nicht mein schritt, du lässt doch eh CI laufen etc. wenn sachen fertig sind und ready sollst du
auto mergen!" Das kehrt die bis dahin gelebte Praxis um — Draft-PR erstellen und auf Chris'
eigenen Merge warten.

**Ab jetzt gilt:** sobald eine PR grün ist (CI durchgelaufen, `mergeable_state: clean`, keine
offenen Findings/Reviews, die eine Entscheidung brauchen), aus dem Draft-Status nehmen und selbst
mergen — nicht mehr auf Chris warten. Das löst automatisch `auto-deploy.sh` auf dem Server aus
(s. unten), der neue Commits auf `main` baut und ausrollt — das ist beabsichtigt, kein Nebeneffekt
zum Vermeiden.

## Deploy

`deploy/hetzner/auto-deploy.sh` pollt per Cron `main` und baut bei neuen Commits neu. Er zieht mit
`--ff-only`; ein liegengebliebener lokaler Commit im Server-Repo blockiert ihn deshalb dauerhaft.
Logs: `tail -f /var/log/oly-deploy.log`.

Zweiter, ganz anderer Blockierer: volle Root-Platte, weil der Docker-Build mitten im Bauen
abbricht (`no space left on device`). Am 01.09. steckten so 6,8 GB reiner Git-Historie in `.git`,
bei nur ~200 MB Arbeitsbaum — verursacht durch `push-live-save.sh`/`push-bug-reports.sh`, die bei
jedem Cron-Lauf bewusst einen elternlosen Commit bauen und per Force-Push schicken (haelt den
Branch auf GitHub klein), der aber lokal sofort zum "dangling object" wird und nie von selbst
verschwindet. `deploy/hetzner/git-repo-aufraeumen.sh` raeumt das per `git gc --prune=now` weg und
laeuft seitdem woechentlich (sonntags 04:10) als dritter Cron neben den beiden Push-Crons, s.
`install-live-save-cron.sh`.

**Dritter Blockierer, gefunden am 14.11.: `/var/lib/containerd`, nicht `/etc/docker/daemon.json`.**
Docker laeuft hier ueber den **separaten System-Containerd-Dienst** (`/run/containerd/containerd.sock`,
eigener systemd-Dienst `containerd.service`) — der hat eine **eigene** Datenwurzel, unabhaengig von
Dockers `data-root`. Alle Schreibvorgaenge beim Layer-Entpacken laufen tatsaechlich unter
`/var/lib/containerd/io.containerd.snapshotter.v1.overlayfs/...` — das stand schon in der allerersten
"no space left"-Fehlermeldung, wurde aber zunaechst uebersehen, weil `docker info` eine andere
("Docker Root Dir") zeigt und man die fuer die ganze Wahrheit haelt. Am 14.11. waren es 23 GB, davon
**13 GB per `docker system prune -af` reclaimbar** (Reste gescheiterter Build-Versuche; Docker spricht
dafuer mit Containerd, auch wenn dessen Root separat liegt). Pruefen mit:
```sh
du -sh /var/lib/containerd
docker system df
docker system prune -af
```
Es gibt daneben `deploy/hetzner/docker-datenwurzel-auf-volume-umziehen.sh` (14.11., PR #1435), das
NUR Dockers eigene Datenwurzel (`/etc/docker/daemon.json`, Images/Volumes/Build-Cache) auf das bislang
ungenutzte Hetzner-Volume (`/mnt/HC_Volume_106761772`, 20 GB; `/mnt/volume-hel1-1` ist trotz Namens
**kein** eigenes Mount, sondern ein gewoehnlicher Ordner auf `sda1`) umzieht — das allein reicht nicht,
weil Containerds Root davon unberuehrt bleibt.

**Der naechste Schritt ist gebaut:** `deploy/hetzner/containerd-datenwurzel-auf-volume-umziehen.sh`
(16.11.) zieht Containerds eigene `root`-Datenwurzel (die den eigentlichen Platz frisst, s. oben)
auf dasselbe Volume um, in einen eigenen `containerd`-Unterordner neben Dockers. Gleiches Muster wie
beim Docker-Umzug: ohne Argument nur Bericht, `--apply` zieht wirklich um (haelt dafuer kurz
Containerd UND Docker an, nicht nur den Compose-Stack), `--zurueck` dreht zurueck, `--loesche-altes`
gibt den alten Platz erst frei, wenn der Umzug bestaetigt lief. `state` (Laufzeit-Sockets/PIDs, klein,
ohnehin unter `/run`) bleibt bewusst unangetastet — nur `root` war je gemessen das Platzproblem.
**Gelaufen am 16.11.:** Chris hat `--apply` und danach `--loesche-altes` selbst ausgefuehrt — die alte
`/var/lib/containerd` (24 GB) ist weg, danach `sda1` 38 GB gross, 12 GB belegt, **25 GB frei**,
Healthcheck 200. Dockers und Containerds Datenwurzel liegen damit beide auf dem Volume; `docker system
df` und `du -sh /var/lib/containerd` zeigen den Platz seither nicht mehr als Problem. Wer trotzdem
wieder "no space left" sieht, prueft zuerst das Volume (`df -h /mnt/HC_Volume_106761772`), nicht `sda1`.

**Dritter Umzug, kleinerer Kaliber (16.11.), Chris: "lass uns das groesste auf jeden fall umziehen
weil das externe volume kann ich beliebig vergroessern":** `/root/oly-save-sicherungen/` sammelt bei
jedem Lauf von `docker-datenwurzel-auf-volume-umziehen.sh`, `kader-auffuellen.sh` und
`pull-repaired-save.sh` eine gezippte komplette Spielstand-Kopie an — UNBEGRENZT, kein Cron raeumt
dort auf. `deploy/hetzner/save-sicherungen-auf-volume-umziehen.sh` zieht diesen EINEN Ordner aufs
Volume um und ersetzt ihn an alter Stelle durch einen Symlink — kein Dienst muss dafuer angehalten
werden (reine Dateiverwaltung), alle drei Skripte oben schreiben unveraendert weiter dorthin. Gleiches
Berichts-/`--apply`-/`--zurueck`-/`--loesche-altes`-Muster, ebenfalls noch nicht auf dem echten Server
gelaufen.

## Wertungs-Fingerabdruck der Arena-Engine

`node scripts/pruefe-wertung-fingerabdruck.mjs` laesst die Wertung (alle Disziplinen, Spurt-Formate
Hatz/HYROX mit Saaten 1/7/42) ueber den Node-Motor laufen und gibt eine Pruefsumme aus.
**Stand 22.11. (Breaking Tag-Team-1v1, `docs/design/breaking-tagteam-22-11.md`): GESAMT fe1dc086d68d (75 Eintraege)**; gegenueber `ea36f666cc71`
(Basketball-Puste) bewegen sich NUR `spiele breaking 1|7|42` (ed316124be88/0a689ade305e/c4bf3bd3603f -> 618a78380a90/9fcfb85a5f9a/ae3a91006f01); das alte Format (Gauntlet) steht
als `BREAKING-GAUNTLET 031655024229` (3 Zeilen `spiele breaking/gauntlet`, bit-identisch zu den frueheren Breaking-Zeilen) AUSSERHALB von GESAMT, Rueckweg
`OLY_BREAKING_FORMAT=alt` (Stempel `seasonState.breakingFormat`, `lib/resolve/breaking-format.ts`, Messhebel `window.__arena.breakingFormat("gauntlet")`).
Inhalt: 6 gegen 6, je Team einer im Ring, Gang = A peinigt / B haelt aus und umgekehrt, danach verdeckter Wechsel; jeder kommt dran, Standzeit 2,
Geraete-Eskalation je Umlauf; **Waffe frei waehlbar (Chris 22.11.): genau eine je Gang und Spieler, Plan des Managers in der Einsatzliste, sonst KI-Konterwahl;
der Plan reist als `waffen` im Aufstellungseintrag**. rho je Spiel 0,856 -> 0,915 (n=48), Pp 10,0/13,9 (gepoolt 10,4); Feldgroesse 2 unter 0,75 (0,68, Gauntlet 0,70), Notbremse 0,3 %. C2-/E1-Anker und PP-Referenz je Format
(`breakingGauntletAlt`, `duellGauntletAlt`, `breaking-pps-referenz-gauntlet.json`). Die anderen fuenf Schutzsummen sind unveraendert.
**Stand 22.11. (Basketball-Puste, `docs/design/basketball-puste-22-11.md`): GESAMT ea36f666cc71 (75 Eintraege)**; gegenueber `0310ec4a4e3d`
(Hockey-Torwart-Regel) bewegen sich NUR `spiele basketball 1|7|42` (91a13edbaa37/9cae043e306d/8a75782eceaa -> 1dcbd995722b/4aa24b3936d0/0478707f7e77);
die alte Regel steht als `BASKETBALL-PUSTE-ALT 77aa7158ff0d` (3 Zeilen `spiele basketball/puste-alt`, bit-identisch zu den frueheren
Basketball-Zeilen) AUSSERHALB von GESAMT, Rueckweg `OLY_BASKETBALL_PUSTE=alt` (Stempel `seasonState.basketballPuste`,
`lib/resolve/basketball-puste.ts`, Messhebel `window.__arena.basketballPuste("alt")`). Inhalt: Puste-Vorrat aus AUSDAUER, Verbrauch beim Laufen und
Ballfuehren, Wirkung auf Tempo/Rebound/Wurf/Anspielgewicht, dazu ein Beteiligungsboden in der Pass-Lotterie (Maru-Fall: Geister 3,9 -> 1,3 % bei vier je Seite).
rho je Spiel 0,864 -> 0,862. C2-/E1-Anker je Regel (`basketballPusteAlt`, `duellPusteAlt`), aus dem Motor abgeleitet. Die vier anderen
Schutzsummen (CLIMBING-STANDARD, BATTLEFIELD-ORTE3, HOCKEY-TORWART-ALT, TDM-GEFECHT) sind unveraendert.
**Stand 22.11. (Battlefield Fünf Punkte live): GESAMT 5b9acba4fe42 (75 Eintraege)** — absichtlich bewegt: Battlefield
bucht und zeigt im Vier-Team-Pod seit Arbeitsliste 21.11. (Welle 4) die Fünf-Punkte-Domination mit Respawn bei sinkenden HP
(100 → 75 → 50 %, Untergrenze 50 %; `bfd5Gefecht()`, Motor-Vorgabe `BF_POD_FORMAT="domination5"`,
`docs/design/battlefield-5punkte-22-11.md`). Gegenueber `eaafed96150e` bewegt sich NUR die eine Zeile `spieleBattlefieldPod`
(`4424ef90cb0c` → `2271b1fad9a4`); die Duell-Zeilen (`spiele battlefield`, `disziplinProbe battlefield`, `spieleArenaDomination`) bleiben
byte-gleich. Das alte Gefecht je Ort bleibt als Rueckweg geschuetzt: drei eigene Zeilen `spieleBattlefieldPod/orte3 <saat>` mit
Summe **`BATTLEFIELD-ORTE3 6413fbdc4641`** AUSSERHALB von GESAMT (erste Zeile = der alte Wert `4424ef90cb0c`). Das Format steht je Spieltag im
Spielstand (`seasonState.battlefieldFormat`, `lib/resolve/battlefield-format.ts`, gebuchte Spieltage behalten ihr Format;
Umstellung ab dem naechsten gewerteten Spieltag), Rueckweg-Schalter `OLY_BATTLEFIELD_FORMAT=alt` (deploy/hetzner/.env).
**Stand 22.11. (Hockey-Torwart-Regel, `docs/design/hockey-torwart-22-11.md`): GESAMT 0310ec4a4e3d (75 Eintraege)**; gegenueber `5b9acba4fe42`
(Battlefield Fuenf Punkte) bewegen sich NUR `spiele hockey 1|7|42`; die alte Regel steht als `HOCKEY-TORWART-ALT cdc62aeea8e4` (3 Zeilen
`spiele hockey/torwart-alt`) AUSSERHALB von GESAMT, Rueckweg `OLY_HOCKEY_TORWART=alt` (Stempel `seasonState.hockeyTorwart`,
`lib/resolve/hockey-torwart.ts`). Davor `5b9acba4fe42` (Battlefield, im Review). **Stand 21.11. (Arena-Livefehler): GESAMT eaafed96150e bleibt unveraendert** — Staffel-Uebergabe (Stab-Timer in Zuschauer-
statt Simulationssekunden, Naechster wartet an der Linie, HUD wird beim Wechsel durchsichtig) und Spieler-ohne-Figur-Marke sind
reine Anzeige. **TDM-Gefecht „Kampf bis zum Ende“ (Chris 21.11.: keine Respawns, EIN Kampf bis ein Team ausgeschaltet ist) bewegt
GESAMT NICHT**, weil `spiele tdm`/`disziplinProbe tdm` das alte Echtzeit-Duell rechnen und die Buchung ueber `spieleTdmGefecht()`
laeuft; der Fingerabdruck fuehrt dafuer seit 21.11. eigene Zeilen `spieleTdmGefecht 1|7|42` mit Summe **`TDM-GEFECHT`
AUSSERHALB von GESAMT**: **4f5a6af94a46** (vorher `45f3c5f3bc4a` mit takte 20, ko 15, takt 2). Aenderung: `TDM_GEFECHT_GRUND`
takte 20→80 (nur Notbremse) + Sudden-Death-Eskalation ab Takt 30, `wertung.takt` 2→0,5, Anzeige-Takt 4→1,7 s; 100 % der Gefechte
enden durch Ausscheiden einer Seite (vorher 60–68 %). Abnahme (`OLY_FORM_MODUS=echt`, `scripts/miss-tdm-gefecht-abnahme.mjs`):
rho je Gefecht Median 0,816–0,852 bei k=2..6 (Strom 0/1), Pp-Abweichung 13,1–16,5 (k=6: 13,4/13,6). Stand
18.11. (Canyon live): **GESAMT eaafed96150e (75 Eintraege)** — absichtlich bewegt, weil Climbing seit Chris' „Ja, Canyon
soll live gehen“ im Format Canyon laeuft (`docs/design/climbing-canyon-live-18-11.md`); gegenueber `d3a39030a3ef` bewegen
sich NUR die drei `spiele climbing`-Zeilen (1/7/42, jetzt die frueheren `spiele climbing/canyon`-Zeilen aus #1633). HUD-Profil
und Kamera-Modi derselben PR sind reine Anzeige. Davor: **GESAMT d3a39030a3ef** (Climbing „Ende erst, wenn alle oben sind“) — absichtlich bewegt, weil
Climbing kein Lead-Zeitlimit mehr hat (Chris 18.11.: „Ende bitte erst wenn ALLE im Ziel sind“; Sicherheitsdeckel 60 Sim-s
mit hochgerechneter Zeit, `docs/design/arena-start-ende-figuren-18-11.md`); gegenueber `ce8fcef66028` bewegen sich NUR die
drei `spiele climbing`-Zeilen (1/7/42). Die Anzeige-Commits derselben PR (kein Stand vor dem Start, Vorstellung im Pod,
Gesichtsmarke, Vorlauf-Fortschritt) lassen `ce8fcef66028` unveraendert. Davor: **GESAMT ce8fcef66028** — Basketball Runde 2 (Laufweg-Modul, Feld-Grenze; Kamera/Effekte/Teamfouls
sind reine Anzeige) auf main mit #1562 (`38b176d7185b`); gegenueber diesem main bewegen sich NUR die drei
`spiele basketball`-Zeilen (1/7/42), `docs/design/benchmark-basketball-17-11.md` Abschnitt 7.9. Von den zwei
Feldbegrenzungen blieb nur die Feld-Grenze (`feldGrenze`); die Ziel-Begrenzung in `spacingMitspielerZiel` aus #1562 ist
entfallen. Zwischenstaende: main mit #1562 `38b176d7185b` (Basketball-Benchmark R1 + Review-Fix auf dem Staffel-Stand
`97cccd6017fb`), Runde 2 auf altem main `004f26374565`, R1 `97c267e8b7c7`. Davor absichtlich bewegt von der Staffel „ganze Runde, Puste wirkt“
(`docs/design/vier-teams-staffel-battlefield-17-11.md` Abschnitt 2 und Review-Nachtrag 2.7); gegenueber dem Vorstand
`d09e10bb872c` (I-Spy-Knack-Motor V2) haben sich NUR die vier Staffel-Eintraege geaendert (`spiele staffel 1/7/42`,
`spieleBahnPod staffel`; Zwischenstand vor dem Review `8bbc6ea215f6`). Davor: `7c9257b4435c` (Kontakt im klassischen Spurt scharf,
`--kontakt-aus` -> `e80babacb68c`; I-Spy-Rueckweg `window.__arena.ispyMotor("alt")`). Das Battlefield-
Domination-Format mit 5 Punkten (`BATTLEFIELD_POD_FORMAT`) war damals im Standard AUS; seit 22.11. ist es der Standard (s. Stand 22.11. oben). Eine reine Anzeige-Aenderung an
`public/mockups/battle-mode.engine.js` (Zeichnen, HUD, Interpolation, Bilder auslagern) darf sie
NICHT veraendern; weicht sie ab, hat die Aenderung die Wertung beruehrt. Neue Felder an Laeufer-/
Spielerobjekten verschieben sie ebenfalls — Vorher-Werte stattdessen in einer WeakMap bzw. in
modulweiten Arrays halten (Muster: Render-Interpolation `viSchnappschussKF`). Absichtliche Wertungs-
aenderung: neue Zahl hier und in `data/generated/` festhalten.

**Climbing-Format „Canyon“ ist LIVE (18.11., Motor-Vorgabe `climbingFormat:"canyon"`):** GESAMT rechnet Climbing im
Canyon. Das alte Format bleibt als Rueckweg geschuetzt: das Skript gibt nach GESAMT drei eigene Zeilen
`spiele climbing/standard 1/7/42` und eine eigene Summe aus — **nicht in GESAMT**: `CLIMBING-STANDARD 164b3d846334`
(Zeilen `58b9222c223b`/`b2b7c6e4bfbc`/`d26ad5352068`, die alten `spiele climbing`-Zeilen). Abschalt-Schalter
`OLY_CLIMBING_FORMAT=standard` (deploy/hetzner/.env, compose reicht ihn an Container und Build-Arg
`NEXT_PUBLIC_OLY_CLIMBING_FORMAT`): ab dem naechsten gewerteten Spieltag wieder das alte Format; gebuchte Spieltage
behalten ihr Format (Wechselliste `seasonState.climbingFormat`, `lib/resolve/climbing-format.ts`). Das Format reist im
Kader-Umschlag (`formatByDisciplineId.climbing`) zu Host, Chromium-Runner und Node-Motor (gezeigt = gebucht) und steht im
Eingabe-Hash des Vorlaufs. `node scripts/pruefe-wertung-fingerabdruck.mjs --node` rechnet denselben Abgleich ueber den
Node-Motor (ohne Chromium, ohne Aufnahme-Sperre); `scripts/miss-alle-disziplinen.mjs --node` ebenso fuer rho. Details:
`docs/design/climbing-canyon-live-18-11.md`, `docs/design/climbing-canyon-bau-18-11.md`.

## CI-Weiche für Moosgrab / Kartenschmiede

Chris am 18.10.: Moosgrab soll nicht jedes Mal die Oly-CI fahren. Ein Push oder PR, der **nur**
Kartenschmiede-Dateien ändert (`apps/kartenschmiede/`, `lib/kartenschmiede/`,
`tests/kartenschmiede*.test.ts`, `scripts/kartenschmiede-*`, `docs/design/moosgrab-*.md`), fährt
statt Build, Browser-Smokes, voller Suite, Persistenz-Suiten und Rangtreue-Schranke nur den Job
`kartenschmiede` (Vitest, eslint, Typen der Kartenschmiede, Seitenbau). Die Liste steht in
`scripts/ci-nur-kartenschmiede.sh`; liegt auch nur eine Datei außerhalb (auch die Routen unter
`app/`), läuft die volle CI. Website und Deploy bleiben unverändert: der Server baut jeden neuen
`main`-Commit wie bisher.

**LEC-Cockpit (apps/LEC, docs/enterich-cards) hängt an derselben Weiche** (Chris, 11.11.): ein Push, der nur dort etwas ändert, fährt
statt der Oly-CI nur den Job `lec` (Prisma, Typen, Vitest). Berührt ein Push `apps/LEC`, läuft `lec` immer mit, auch neben der
Oly-CI. `scripts/ci-beruehrt.sh` sagt, welches Nebenprojekt angefasst wurde.

**Jeder neue CI-Job braucht die Weiche** (`needs: weiche` und `if: ${{ !cancelled() && needs.weiche.outputs.nur_kartenschmiede != 'true' }}`).
Sonst läuft er bei jedem Moosgrab-PR mit; `tests/kartenschmiede.test.ts` („CI-Weiche“) wird dann rot.
