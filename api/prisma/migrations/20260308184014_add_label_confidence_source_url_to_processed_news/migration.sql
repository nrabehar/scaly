-- AlterTable
ALTER TABLE "ProcessedNews" ADD COLUMN "confidence" REAL;
ALTER TABLE "ProcessedNews" ADD COLUMN "label" TEXT;
ALTER TABLE "ProcessedNews" ADD COLUMN "source" TEXT;
ALTER TABLE "ProcessedNews" ADD COLUMN "url" TEXT;
