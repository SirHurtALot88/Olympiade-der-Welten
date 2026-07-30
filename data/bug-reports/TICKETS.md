# Tickets — Bug-Meldungen aus dem Spiel

> **GENERIERT — nicht von Hand editieren.** Diese Datei entsteht aus `data/bug-reports/*.json`,
> `data/bug-reports/triage/*.md` und `tickets.json`. Wer hier etwas ändert, verliert es beim
> nächsten `npm run bugs:tabelle`. Der Stand einer Meldung wird in ihrer Triage-Notiz gepflegt.

6 Meldungen — offen: 0 · vorgeprüft: 2 · angenommen: 0 · gebaut: 4 · abgelehnt: 0 · erledigt: 0

| Nr | Eingang | Von | Wo | Titel | Status | Ergebnis |
|---:|---|---|---|---|---|---|
| [1](triage/bug-2026-07-30T14-10-27-776Z-7ysypt.md) | 30.07., 16:10 | Chris | Spieltag · Einsatzliste | Die Einsatzlisten-Route nimmt Spieler-Identität und Spielstand ungeprüft vom Browser — Formkarten sperren sich dadurch am eigenen Team | gebaut ⚠ | Punkt 1 gebaut — Identitaet kommt aus der Sitzung, Besitzer wird durchgereicht. Punkt 2 (Standalone-Lab-Seiten) und 3 (warmup-derivations) stehen noch aus. · PR #264 · `7a64b621` · **Wirkung nicht bestaetigt** |
| [2](triage/bug-2026-07-30T14-24-16-118Z-51cfo5.md) | 30.07., 16:24 | Chris | Welt · Sponsoren | Der Knopf „Sponsoren" im Saisonstand öffnet die Preisgeld-Ansicht — und es führt kein Weg zurück | gebaut ⚠ | Doppelt gefixt — #268 (eine Regel statt zwei) und unabhaengig davon der Knopf selbst. Genau die Doppelarbeit, die das Ticketsystem verhindern soll. · PR #268 + #264 · `76488c98 + c288f56e` · **Wirkung nicht bestaetigt** |
| [3](triage/bug-2026-07-30T14-31-43-590Z-jkxfgt.md) | 30.07., 16:31 | Franky | Markt · Transfermarkt | Ein 5-Sekunden-Poller überschreibt ungespeicherte Änderungen — entfernte Wishlist-Einträge kommen zurück | vorgeprüft | — |
| [4](triage/bug-2026-07-30T14-37-11-903Z-imx650.md) | 30.07., 16:37 | Franky | Markt · Transfermarkt | Cash-Anzeige bleibt nach dem Kauf stehen — der Anstoß wird vom Markt-Zwischenspeicher verschluckt | gebaut ⚠ | Zwei Anläufe. #273 stieß den Feed neu an, der Anstoß wurde aber vom Ref-Cache verschluckt; erst die Entwertung des Zwischenspeichers schließt die Kette. · PR #273 + #264 · `ea89b21e + 4bf73875` · **Wirkung nicht bestaetigt** |
| [5](triage/bug-2026-07-30T14-42-43-320Z-sq84lk.md) | 30.07., 16:42 | Franky | Spieltag · Inbox | Inbox-Links führen in der Startphase fast alle zur Einsatzliste — kein Verdrahtungsfehler, sondern die Schrittfolge | vorgeprüft | — |
| [6](triage/bug-2026-07-30T15-01-02-061Z-vi7fg4.md) | 30.07., 17:01 | Franky | Spieltag · Einsatzliste | „Bester Fit" wählt nach dem rohen Score, zeigt aber den angepassten — beide Zahlen sind verschieden | gebaut ⚠ | Auf main bereits behoben (#274) — Auswahl und angezeigte Zahl benutzen denselben Maßstab. Nicht von mir gebaut, nur zugeordnet. · PR #274 · `fb6299e2` · **Wirkung nicht bestaetigt** |

**`gebaut ⚠`** heißt: Der Fix ist gemergt, die Wirkung im laufenden Spiel aber noch nicht belegt.
Erst ein `bestaetigt:` in der Triage-Notiz macht daraus `erledigt`. Diese Unterscheidung gibt es,
weil ein Fix schon einmal als behoben galt und nicht wirkte — der Reload, den er anstieß, wurde
von einem Zwischenspeicher verschluckt.

Details je Ticket: die Nummer verlinkt auf die Triage-Notiz. Volltext: `npm run bugs:review`.

_Erzeugt: 30.7.2026, 18:58:22_
