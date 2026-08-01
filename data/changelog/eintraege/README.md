# Gepflegte Changelog-Einträge — eine Datei pro Eintrag

Hier liegen die Changelog-Einträge für Änderungen **ohne** Bug-Meldung: ein neues Feature, eine
umgebaute Ansicht. Ein gefixter Bug bekommt seinen Eintrag stattdessen als `changelog:`-Zeile in
der Triage-Notiz (`data/bug-reports/triage/<reportId>.md`).

## Warum eine Datei pro Eintrag

Vorher standen alle Einträge in einem gemeinsamen Array in `data/changelog/eintraege.json`. Jeder
PR hängte seinen Eintrag ans Ende derselben Liste — und kollidierte damit mit **jedem** anderen
gleichzeitig offenen PR. Der Konflikt war jedes Mal rein mechanisch, ohne inhaltliche Bedeutung,
kostete aber Rebase und einen neuen CI-Lauf von rund zwanzig Minuten. Da `main` sich schneller
bewegt, als die CI läuft, verlor ein PR dieses Rennen auch mal dreimal hintereinander.

Zwei PRs fassen nie dieselbe Datei an, wenn jeder Eintrag seine eigene hat. Mehr ist an der
Umstellung nicht dran.

## Eine neue Datei anlegen

Dateiname: `<datum>-pr<nummer>.json`, z. B. `2026-08-01-pr299.json`. Ohne PR-Nummer tut es ein
sprechender Zusatz statt `pr<nummer>`. Gelesen wird in Dateinamen-Reihenfolge, damit der Lauf
reproduzierbar bleibt; die Anzeige sortiert am Ende ohnehin nach Datum.

```json
{
  "datum": "2026-08-01",
  "seite": "Markt · Transfermarkt",
  "text": "Ein Satz Alltagssprache: was war vorher, was ist jetzt anders.",
  "gewicht": "behebung",
  "pr": "#299",
  "version": "0.3"
}
```

| Feld      | Pflicht | Bedeutung |
| --------- | ------- | --------- |
| `datum`   | ja      | `JJJJ-MM-TT`, der Merge-Tag |
| `text`    | ja      | Ein Satz: was war kaputt / wie war es, was ist jetzt anders |
| `gewicht` | ja¹     | `grundlegend`, `spielblockierend`, `behebung` oder `feinschliff` |
| `seite`   | nein    | Betroffene Seite in den Worten der Navigation |
| `pr`      | nein    | PR-Nummer als Beleg |
| `version` | nein    | Zwei Stellen (`0.3`), passend zum `package.json`-Stand zum Merge-Zeitpunkt — nur setzen, wenn wirklich bekannt |

¹ Technisch optional: fehlt es, erscheint der Eintrag unter „Ohne Einstufung" und der Generator
mahnt es an. Sichtbar unvollständig ist besser als still geraten.

Eine Datei darf auch ein Array mehrerer Einträge enthalten — nötig ist das selten, aber es kostet
nichts und erspart eine Stolperfalle.

## Danach

```
npm run changelog:bauen
```

Das schreibt `data/changelog/CHANGELOG.json`, und nur die liest der Reiter im Spiel. Gepflegt wird
beim Mergen, nicht später: was nicht gemergt ist, gehört nicht hinein.

## Die alte Sammeldatei

`data/changelog/eintraege.json` wird weiterhin gelesen, damit ein älterer Zweig seinen Eintrag
nicht still verliert. Sie soll leer bleiben — der Generator meldet, was dort noch liegt.
