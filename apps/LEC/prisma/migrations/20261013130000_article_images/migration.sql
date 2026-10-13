-- Kartenbilder aus dem eigenen eBay-Shop (src/lib/images/)
ALTER TABLE "Article" ADD COLUMN "ebayItemId" TEXT;
ALTER TABLE "Article" ADD COLUMN "imageGuid" TEXT;
ALTER TABLE "Article" ADD COLUMN "imageFile" TEXT;
ALTER TABLE "Article" ADD COLUMN "imageMatchedBy" TEXT;
ALTER TABLE "Article" ADD COLUMN "imageFetchedAt" DATETIME;
