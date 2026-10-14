-- Verschluesselte Zugangsdaten (Billbee), Eingabe ueber die Einstellungen
CREATE TABLE "IntegrationSecret" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
