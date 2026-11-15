-- Bei eBay beendete Angebote erkennen (Chris, 13.11.2026)
ALTER TABLE "Article" ADD COLUMN "ebayEndedAt" DATETIME;
