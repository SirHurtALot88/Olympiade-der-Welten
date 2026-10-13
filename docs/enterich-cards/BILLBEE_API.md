# Billbee-API-Anbindung (LEC)

Die App holt Artikelstamm (Bestand, VK, EK) und die Bestellungen der letzten 365 Tage selbst aus
Billbee. Beim Serverstart, alle 3 Stunden und per Knopf „Jetzt aktualisieren“ unter Einstellungen.
Der Datei-Import unter `/import` bleibt als Rückfall.

## Einrichten (einmalig, auf dem Server)

1. Billbee: Einstellungen > Billbee API aktivieren und ein API-Passwort setzen (ist bei Chris erledigt).
2. Zusätzlich braucht Billbee einen **API-Schlüssel** (Header `X-Billbee-Api-Key`); Billbee vergibt ihn auf Anfrage.
3. In `deploy/hetzner/.env` (nicht versioniert) drei Zeilen ergänzen:

```
BILLBEE_API_KEY=...
BILLBEE_USER=<Billbee-Login, E-Mail>
BILLBEE_PASSWORD=<API-Passwort>
```

4. `docker compose up -d lec-app` (liest die `.env` neu). Ohne die drei Werte bleibt die Anbindung aus.

## Struktur prüfen

Die Feldnamen sind nach der öffentlichen API-Beschreibung gebaut, aber ohne Konto-Zugriff nicht live getestet.
`scripts/billbee-probe.ts` zeigt die echte Struktur (nur Feldnamen und Typen, keine Namen, keine Zugangsdaten):

```
cd apps/LEC && BILLBEE_API_KEY=... BILLBEE_USER=... BILLBEE_PASSWORD=... npx tsx scripts/billbee-probe.ts
```

## Was passiert

- **Artikel:** `/products` → Bestand (`StockCurrent`), VK (`Price`), EK (`CostPrice`). Deaktivierte Artikel und alles, was nicht
  mehr im Stamm steht, gelten als „ausgelaufen“.
- **Verkäufe:** `/orders` der letzten 365 Tage → je Artikel die Fenster 30/90/365 (Stück, Umsatz brutto, EK). Ein per Datei
  importiertes „all“-Fenster bleibt unberührt. Stornierte Bestellungen zählen nicht (Status-ID 8, einstellbar über
  `BILLBEE_EXCLUDE_STATES`).
- **eBay-Gebühren:** ohne eBay-Report im Lauf gilt die zuletzt bekannte Gebühr je Stück des Artikels.
- **Nicht enthalten:** Einkäufe (Datum, Menge) liefert die Billbee-API nicht. Dafür bleibt der Detail-Bereich „Einkäufe“ leer.
