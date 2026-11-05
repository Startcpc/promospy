-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PromoOffer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "codeKey" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "searchText" TEXT NOT NULL DEFAULT '',
    "discount" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'found',
    "conditions" TEXT NOT NULL DEFAULT '[]',
    "sources" TEXT NOT NULL DEFAULT '[]',
    "minOrder" REAL,
    "startsAt" DATETIME,
    "expiresAt" DATETIME,
    "foundAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedAt" DATETIME,
    "validUntil" DATETIME,
    "invalidSince" DATETIME,
    "verificationDetails" TEXT,
    "evidence" TEXT
);

-- CreateTable
CREATE TABLE "PromoCheck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "offerId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" TEXT NOT NULL,
    "evidence" TEXT,
    CONSTRAINT "PromoCheck_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "PromoOffer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PromoScanJob" (
    "companyId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "state" TEXT NOT NULL DEFAULT 'queued',
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "nextRunAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "owner" TEXT,
    "leaseUntil" DATETIME,
    "error" TEXT,
    "officialCheckedAt" DATETIME,
    "officialError" TEXT,
    "log" TEXT NOT NULL DEFAULT '[]'
);

-- CreateTable
CREATE TABLE "PromoWorkerLease" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "owner" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "PromoOffer_companyId_status_idx" ON "PromoOffer"("companyId", "status");

-- CreateIndex
CREATE INDEX "PromoOffer_expiresAt_idx" ON "PromoOffer"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PromoOffer_companyId_codeKey_key" ON "PromoOffer"("companyId", "codeKey");

-- CreateIndex
CREATE INDEX "PromoCheck_offerId_checkedAt_idx" ON "PromoCheck"("offerId", "checkedAt");

-- CreateIndex
CREATE INDEX "PromoScanJob_state_requestedAt_idx" ON "PromoScanJob"("state", "requestedAt");
