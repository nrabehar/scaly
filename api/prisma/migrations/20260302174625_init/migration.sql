-- CreateTable
CREATE TABLE "Signal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "symbol" TEXT NOT NULL,
    "provider" TEXT,
    "signal" TEXT NOT NULL,
    "score" REAL,
    "metadata" JSONB,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AccessLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "event" TEXT NOT NULL,
    "path" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "fingerprint" TEXT,
    "details" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
