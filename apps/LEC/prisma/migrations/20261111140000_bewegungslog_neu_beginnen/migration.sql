-- Der erste Billbee-Abgleich verglich gegen alte Datei-Staende und schrieb dabei Phantom-Bewegungen
-- (auch mehrfach bei Stammartikeln mit gleichem Namen). Der Verlauf beginnt neu: der naechste Abgleich
-- gilt als Startbestand, ab dem uebernaechsten werden Aenderungen mitgeschrieben.
DELETE FROM "StockMovement";
DELETE FROM "PriceChange";
