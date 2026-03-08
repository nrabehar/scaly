-- CreateTable
CREATE TABLE "ProcessedNews" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
