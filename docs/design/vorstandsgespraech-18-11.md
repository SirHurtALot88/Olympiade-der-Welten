# Vorstandsgespräch: Budgetfreigabe verhandeln (Fable, 18.11.)

Anlass, Chris am 18.11.: „Es muss eine Option geben, wo man mit dem Vorstand verhandeln kann, die
%-Freigabe anzupassen und dass er das verfügbare Cash für das Team für die Season erhöht.“ Und: „Das
Cash, das gesperrt ist, ist eine NOTRÜCKLAGE. Wenn sie benötigt wird, gibt der Vorstand sie lieber
frei, anstatt Kredite zu nehmen. Das Cash soll vor Notlagen schützen und nicht dafür sorgen, dass
ein Team ausverkaufen muss, weil der Vorstand greedy ist.“

Dies ist ein Entwurf: Mockup und Konzept. `app/`, `components/`, `lib/` und der Motor sind nicht
angefasst. Bei PixelLab ist nichts bestellt (0 Generationen), es gibt keine neue Figur: der Vorstand
ist das Teamwappen im Kreis, alles andere ist CSS und SVG.

## Ansehen

| Was | Datei |
|---|---|
| Gespräch und Notfall-Antrag, klickbar | `public/mockups/vorstandsgespraech-18-11.html` |
| Bilder (1600 × 900, einfache Dichte; Phone 390 breit) | `docs/design/vorstandsgespraech-18-11/01` bis `07` |

Die Seite läuft per Doppelklick ohne Server. Die graue Leiste oben gehört nicht zum UI: sie wechselt
das Team und springt mit einem Klick zu jedem Ausgang. Dieselben Zustände per Adresse:
`?team=M-M|C-C|W-W`, `&ansicht=gespraech|notfall`, `&anliegen=stufe|sonder|ruecklage|alles`,
`&biete=ziel,rueck,deckel,vertrauen`, `&antwort=1` (Antrag gleich stellen), `&annehmen=1`,
`&not=klein|gross|wunsch`, `&ctab=toepfe|vorstand|regeln`, `&phone=1`, `&still=1`.

| Bild | Zustand |
|---|---|
| `01-entwurf-mm.png` | Mayhem Mavericks, Antrag im Entwurf: Stufe 80 → 90 %, Waage zeigt „fehlt 8“ |
| `02-gegenangebot-mm.png` | Antrag gestellt, Vorstand verlangt ein höheres Saisonziel |
| `03-zustimmung-mm.png` | Mit Saisonziel angeboten: Zustimmung, Protokoll, Töpfe angepasst |
| `04-ablehnung-cc.png` | Cash Creators wollen die halbe Rücklage für einen Wunsch: Ablehnung mit Begründung, Reiter Vorstand |
| `05-notfall-gross-mm.png` | Notfall in der Saison: Rücklage zuerst, Rest über den Rahmen, kein Verkauf |
| `06-sonderbudget-ww.png` | Wicked Wizards, Sonderbudget fürs Gehalt, Reiter Regeln, mit Mockup-Leiste |
| `07-phone-gegenangebot.png` | Phone, Gegenangebot |

### Was echt ist und was nicht

| Echt | Vorschlag oder erfunden |
|---|---|
| Teamnamen, Wappen, Finanzwert, Ambition, Start-Vertrauen (`data/source/team-identities.json`) | Kasse, Gehälter, erwarteter Überschuss, Saisonziel, die Notlagen, der Kreditrahmen |
| Stufen 100 / 90 / 80 / 70 / 50 % nach Vertrauen, Gehalts-Untergrenze 75 % (`lib/finance/vorstand-budgetfreigabe.ts`, PR #1618) | Die Punkte der Waage (Abschnitt 4) und die drei Vorstands-Charaktere |
| Anzapfen bis 50 % des Ziels, −0,25 Vertrauen je Viertel, Wirkung erst bei der nächsten Festlegung | Sparneigung = Finanzwert − max(0, Ambition − 5), Rücklage 10 bis 75 % des Jahresgehalts (Chris' Vorschlag, wird gemessen) |
| „Alles auf eine Karte“: ab Vertrauen 4, 5 % Puffer, Ziel zwei Plätze besser, +0,75 / −1,0 | Die Gegenleistungen Saisonziel, Rückzahlung, Gehaltsdeckel, Vertrauenseinsatz |

Der Gehaltspuffer der echten Rechnung (7 Spieltage Gehalt, soweit die Rücklage ihn nicht deckt) fehlt
im Mockup, damit der Kassenbalken drei Teile hat. Der Bau rechnet mit `berechneVorstandBudgetStand`,
nicht mit dem Mockup.

---

## 1. Die Idee in drei Sätzen

Die Finanzseite V2 hat vier Hebel als Knöpfe: Umschichten, Lockerung, Rücklage anzapfen, Alles auf
eine Karte. Das Gespräch macht daraus **eine** Handlung mit drei Schritten: ich bitte um etwas, ich
biete etwas dafür, der Vorstand antwortet. Die Rechnung dahinter bleibt dieselbe; neu ist nur, dass
der Spieler den Preis mitbestimmt, statt ihn hinzunehmen.

Der zweite Teil ist kein Verhandeln: der **Notfall-Antrag**. Dort hat der Vorstand kein Ermessen.

## 2. Wann es stattfindet

| Zeitpunkt | Was | Wie oft |
|---|---|---|
| Kaufphase der neuen Saison, vor Spieltag 1 (ab Saison 2) | Gespräch: ein Anliegen, höchstens zwei Runden | einmal je Fenster |
| In der Saison, an jedem Spieltag | Notfall-Antrag | sooft eine Notlage eintritt |
| Saison 1 | nichts, alles ist frei | — |

Das Gespräch liegt in der Kaufphase, weil dort die Töpfe binden: verkauft ist am Saisonende schon,
die Erlöse stehen fest, und der Spieler weiß, welcher Kauf am Topf scheitert. Einstieg: Knopf
„Mit dem Vorstand sprechen“ im Reiter Budgets der Finanzseite und in der Sperrmeldung des
Transfermarkts („Ablöse über dem freien Transfertopf“).

## 3. Das Gespräch

### 3.1 Worum ich bitte (ein Anliegen je Gespräch)

| Anliegen | Wirkung | Entspricht heute |
|---|---|---|
| **Freigabe anheben** | Eine Stufe mehr (80 → 90 %) für die ganze Saison. Mehr Ablöse, mehr Gehaltsbudget, Verkaufserlöse künftig zur neuen Quote frei | Lockerung (heute nur nach Verkäufen) |
| **Sonderbudget** | Einmaliger Betrag aus dem Vorbehalt, wahlweise für Ablösen oder Gehalt. Die Stufe bleibt | Umschichten, nur aus dem Vorbehalt statt aus dem anderen Topf |
| **Notrücklage anzapfen** | Ein Viertel oder die Hälfte des Ziels, zur Quote frei. Kostet 0,25 Vertrauen je Viertel | Rücklage anzapfen, unverändert |
| **Alles auf eine Karte** | 100 %, Rücklage frei, 5 % Puffer, Ziel zwei Plätze besser | unverändert, ab Vertrauen 4 |

„Mehr Freigabe-%“ und „mehr Saison-Cash“ aus Chris' Vorgabe sind die ersten beiden Zeilen: die Stufe
ist der große Schritt für die ganze Saison, das Sonderbudget der kleine, gezielte für einen Kauf.

### 3.2 Was ich dafür biete (frei wählbar, beliebig viele)

| Zusage | Was sie bindet |
|---|---|
| **Höheres Saisonziel** | Ziel einen Platz besser. Verfehlt: −0,5 Vertrauen. Erreicht: wie jedes erfüllte Ziel |
| **Rückzahlung aus Verkäufen** | Von den nächsten Verkaufserlösen behält der Vorstand die Hälfte ein, bis der Mehrbetrag zurück ist |
| **Gehaltsdeckel** | Das Gehaltsbudget wächst diese Saison nicht mit (keine höhere Gehaltsquote, kein Umschichten ins Gehalt) |
| **Vertrauen einsetzen** | Sofort −0,25 Vertrauen, wirksam bei der nächsten Festlegung |

Keine Zusage kostet Geld vom Konto, und keine erzwingt einen Verkauf. Die Rückzahlung greift nur,
**wenn** der Spieler von sich aus verkauft.

### 3.3 Wie der Vorstand antwortet

Drei Charaktere, abgeleitet aus der Sparneigung des Teams (kein neues Datum):

| Sparneigung | Charakter | Ihm am meisten wert | Beispiel |
|---|---|---|---|
| unter 3,5 | **Der Antreiber** | höheres Saisonziel | Mayhem Mavericks (6 − 3,5 = 2,5) |
| 3,5 bis unter 7 | **Der Kaufmann** | alles ähnlich | Wicked Wizards (7 − 1,5 = 5,5) |
| ab 7 | **Der Kassenwart** | Rückzahlung, Gehaltsdeckel | Cash Creators (10 − 0 = 10) |

Die Antwort ist eine Waage, **ohne Würfel**:

    Dein Gewicht = Vertrauen × 2 + Summe der angebotenen Zusagen (Wert je Charakter)
    Verlangt     = Preis des Anliegens

| Ergebnis | Antwort |
|---|---|
| Gewicht ≥ Verlangt | **Zustimmung.** Die Töpfe ändern sich sofort, die Zusagen stehen im Protokoll |
| es fehlen bis 10 Punkte | **Gegenangebot.** Der Vorstand nennt die Zusagen, die ihm am liebsten wären und die Lücke schließen; beim Sonderbudget zusätzlich „oder X C ohne Bedingung“. Annehmen, nachbessern (Runde 2) oder zurückziehen |
| es fehlen mehr als 10, oder eine feste Regel greift | **Ablehnung mit Begründung** und Hinweis, was ginge (kleiner bitten, Notlage, nächstes Fenster) |

Feste Regeln, die immer ablehnen: Freigabe schon 100 %, „Alles auf eine Karte“ unter Vertrauen 4,
Rücklage im Fenster gar nicht gesperrt. Aus PR #1618 bleiben: keine Lockerung bei Kasse im Minus,
bei Kredit dieses Fensters und unter Kader 8.

Der Spieler sieht die Antwort **vor** dem Antrag als „Einschätzung“ (reicht / fehlt 8). Fragen kostet
nichts, eine Ablehnung auch nicht. Nur Zusagen binden.

### 3.4 Vorschau der Töpfe

Rechts steht dauerhaft der Reiter **Töpfe**: die Kasse als Balken (frei für Ablösen, Vorbehalt,
Notrücklage) heute und danach, darunter eine Tabelle heute / danach / Δ für Freigabe, Transfertopf,
Gehaltsbudget, Vorbehalt, Rücklage, Vertrauen, Saisonziel. Ein Warnhinweis erscheint, wenn die
Vertrauenskosten bei der nächsten Festlegung eine Stufe kosten würden (Mavericks: 3,0 − 0,25 = 2,75,
nächste Saison 70 % statt 80 %), und wenn das Gehaltsbudget der eigentliche Engpass ist.

## 4. Zahlen der Waage (Startwerte, zum Messen)

| | Antreiber | Kaufmann | Kassenwart |
|---|---:|---:|---:|
| Höheres Saisonziel | 8 | 5 | 2 |
| Rückzahlung aus Verkäufen | 3 | 5 | 8 |
| Gehaltsdeckel | 2 | 4 | 6 |
| Vertrauen einsetzen | 3 | 3 | 3 |

| Anliegen | Preis |
|---|---|
| Freigabe anheben | 14 |
| Sonderbudget | 4 + 10 × Betrag / Vorbehalt (also 4 bis 14) |
| Rücklage anzapfen | 5 je Viertel × 0,8 / 1,0 / 1,6 (Antreiber / Kaufmann / Kassenwart) |
| Alles auf eine Karte | 20 |

Was daraus folgt, an den drei Teams des Mockups:

| Team (Vertrauen, Stufe) | Bitte | Ohne Zusage | Mit der Lieblingszusage |
|---|---|---|---|
| Mayhem Mavericks (3,0 · 80 %) | Stufe auf 90 % | 6 gegen 14: Gegenangebot | + Saisonziel: 14 gegen 14, Zustimmung |
| Mayhem Mavericks | Sonderbudget 1 C | 6 gegen 5,1: Zustimmung | — |
| Mayhem Mavericks | Alles auf eine Karte | Ablehnung (Vertrauen unter 4) | — |
| Cash Creators (2,5 · 70 %) | Stufe auf 80 % | 5 gegen 14: Gegenangebot | Rückzahlung + Gehaltsdeckel: 19, Zustimmung |
| Cash Creators | halbe Rücklage | 5 gegen 16: Ablehnung | ein Viertel + Rückzahlung: 13 gegen 8, Zustimmung |
| Wicked Wizards (6,5 · 90 %) | Stufe auf 100 % | 13 gegen 14: Gegenangebot | + eine Zusage: Zustimmung |

Kleine Bitten gehen bei normalem Vertrauen ohne Gegenleistung durch. Ein Vorstand mit niedrigem
Vertrauen ist nicht zu, er ist teurer.

## 5. Die Notrücklage

### 5.1 Höhe (Chris' Vorschlag, wird gemessen)

    Sparneigung = Finanzwert − max(0, Ambition − 5)
    Rücklage    = (10 % + Sparneigung / 10 × 65 %) × Jahresgehalt      (Sparneigung auf 0 bis 10 begrenzt)

| Team | Finanzwert | Ambition | Sparneigung | Quote | Jahresgehalt (Mockup) | Rücklage |
|---|---:|---:|---:|---:|---:|---:|
| Cash Creators | 10 | 2 | 10 | 75 % | 48 C | 36,0 C |
| Wicked Wizards | 7 | 6,5 | 5,5 | 46 % | 56 C | 25,6 C |
| Mayhem Mavericks | 6 | 8,5 | 2,5 | 26 % | 62 C | 16,3 C |

Sie wird über die Saison angespart. Im Kauffenster **gesperrt** ist nur, was die erwarteten Einnahmen
nicht decken (Mavericks: 16,3 − 6,0 = 10,3 C). Die lineare Zuordnung Sparneigung → Quote ist meine
Lesart von „10 bis 75 %“; die Messung kann sie ersetzen, ohne dass sich am Gespräch etwas ändert.

### 5.2 Die feste Reihenfolge

**Notrücklage vor Kredit vor Notverkauf.** Sichtbar im Notfall-Antrag (als Leiter mit Beträgen) und
dauerhaft im Reiter Regeln.

1. **Notrücklage.** Der Vorstand gibt sie frei: kein Vertrauensverlust, keine Gegenleistung, kein Ermessen.
2. **Kredit.** Erst der zinsfreie Rahmen, dann ein Kredit, und nur für den Rest.
3. **Notverkauf.** Nur wenn 1 und 2 zusammen nicht reichen.

Eine **anerkannte Notlage** ist eine von drei Lagen, die das Spiel selbst feststellt (der Spieler
kann sie nicht behaupten):

* Die Kasse fällt nach der Spieltagsbuchung unter 0.
* Der Kader fällt unter 8 spielfähige Spieler.
* Am Kassensturz droht ein Pflichtkredit.

Alles andere ist ein Wunsch. Ein Wunsch in der Saison wird abgelehnt (ohne Vertrauensverlust) und auf
das nächste Kauffenster verwiesen, wo die Rücklage regulär und mit Vertrauenskosten angezapft werden
kann. So bleibt der Unterschied spürbar: **in der Not kostet die Rücklage nichts, für einen Wunsch
kostet sie Vertrauen.**

Nach einer Freigabe wird die Rücklage wieder angespart. Bis sie zur Hälfte steht, gibt es keine
Lockerung und kein „Alles auf eine Karte“.

### 5.3 Was der Vorstand nie darf

* Geld vom Konto nehmen. Gesperrt heißt nur: nicht ausgebbar.
* Einen Kauf sperren, der den Kader auf 8 bringt (`VORSTAND_PFLICHT_KADER`).
* Das Gehaltsbudget unter 75 % kürzen.
* Eine Notlage ablehnen oder dafür Vertrauen abziehen.
* Einen Verkauf verlangen, solange Rücklage oder Rahmen reichen.

## 6. Aufbau der Seite (Stil der Mockups vom 17.11.)

```
┌──┬────────────────────────────────────────────────────────────────────────────────┐
│  │ Wappen  SAISON 3 · KAUFPHASE     ◢ Budget verhandeln 80 % ◣ ◢ Notfall-Antrag 16,3 ◣   Vertrauen │ Hero-Kopf
│S │ Vorstandsgespräch · Team                                                    [Zur Finanzseite] │
│c ├────────────────────────────┬─────────────────────────────────┬─────────────────────┤
│h │ 1 WORUM BITTE ICH          │ Vorstand: Eröffnung              │ Töpfe│Vorstand│Regeln │
│i │ vier Anliegen-Karten       │ Du: Antrag (Entwurf)             │ Kasse heute / danach │
│e │ Betrag / Viertel / Topf    │ Waage: Gewicht ▬▬▬▬ Verlangt     │ Tabelle heute/danach │
│n │ 2 WAS BIETE ICH DAFÜR      │ Vorstand: Zustimmung /           │ Warnhinweis          │
│e │ vier Zusagen mit Wert      │   Gegenangebot / Ablehnung       │                     │
│  ├────────────────────────────┴─────────────────────────────────┤                     │
│  │ ● Status · eine Zeile     Mehr Ablöse  Mehr Gehalt [Antrag stellen] │ Dock            │
└──┴────────────────────────────────────────────────────────────────┴─────────────────────┘
```

Übernommen sind die Tokens, die Icon-Schiene, der Hero-Kopf mit den schrägen Reitern, Tafel und
Kontext-Reiter, die Waage und das Dock der Einsatzliste, `.rech`, `.geg`, `.formel`, `.seg`, `.marke`
und das Blatt auf dem Phone (der Kontext fährt von unten herein). Zahlen in Barlow Condensed (lokal),
Titel in der Hausschrift. Bei 1600 × 900 scrollt die Seite nicht; nur das Gespräch scrollt in sich,
wenn es lang wird.

## 7. Was der Bau bräuchte (nicht Teil dieses PR)

| Teil | Wo |
|---|---|
| Bewertung (Waage), Charakter, Gegenangebot als reine Funktionen | neu neben `lib/finance/vorstand-budgetfreigabe.ts` |
| Zusagen im Zustand (`seasonState.vorstandBudget[team].zusagen`) | `VorstandBudgetZustand`, Schreibweg `POST /api/finance/vorstand` |
| Stufe anheben und Sonderbudget als neue Quellen in `berechneVorstandBudgetStand` | dieselbe Funktion, damit Planer und Sperre eine Zahl behalten |
| Zusagen als Vorstandsziele (Ziel verfehlt, Rückzahlung offen) | `lib/board/team-season-objectives-service.ts` |
| Notlage feststellen, Freigabe vor Pflichtkredit | Spieltagsbuchung und Kassensturz |
| KI: nutzt dieselben Funktionen, wählt die Zusage nach Charakter | `entscheideKiVorstandMassnahmen` |

Wertung und Arena-Motor bleiben unberührt, der Fingerabdruck ändert sich nicht.

## 8. Offene Fragen an Chris

1. **Feste Antwort oder Würfel?** Empfehlung: **fest**, mit sichtbarer Einschätzung vor dem Antrag.
   Ein Würfel lädt zum Neuladen ein, und „gezeigt = gerechnet“ ist die Linie der Finanzseite.
2. **Ersetzt das Gespräch die vier Knöpfe der Finanzseite oder kommt es dazu?** Empfehlung:
   **ersetzen**. Umschichten bleibt als Schieber ohne Gespräch (es kostet den Vorstand nichts), alles
   andere läuft über das Gespräch, sonst gibt es zwei Wege zum selben Geld.
3. **Kostet die Notrücklage in einer anerkannten Notlage wirklich gar nichts?** Empfehlung: **ja**,
   kein Vertrauen, keine Zusage; nur die Sperre „keine Lockerung, bis sie halb wieder steht“. Das ist
   der Kern deiner Vorgabe, und jede Strafe darauf würde den Spieler wieder zum Verkauf treiben.
4. **Drei Notlagen: Kasse unter 0, Kader unter 8, drohender Pflichtkredit. Reicht das?** Empfehlung:
   **ja**, bewusst eng und vom Spiel festgestellt. Eine vierte („auslaufender Vertrag eines
   Stammspielers“) wäre ein Wunsch im Notlagen-Kleid.
5. **Wie oft?** Empfehlung: **ein Gespräch je Kauffenster, ein Anliegen, zwei Runden**; der
   Notfall-Antrag jederzeit. Mehr Gespräche machen aus der Stufe eine Formsache.
6. **Verhandelt die KI auch?** Empfehlung: **ja, mit denselben Funktionen**, aber erst in einem
   zweiten Schritt und mit Messung (Kaderstärke, Kasse, Teams unter 8), weil die KI-Bedingungen in
   der Messung von #1618 bisher bei keinem der 32 Teams griffen.
