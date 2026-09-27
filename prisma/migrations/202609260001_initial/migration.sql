-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "createdAt" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "payload" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "PartnerDNA" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "payload" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "MutualRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "senderId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" REAL NOT NULL,
    "expiresAt" REAL NOT NULL,
    "status" TEXT NOT NULL,
    "matchedAt" REAL
);

-- CreateTable
CREATE TABLE "MutualSearch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "searcherId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "month" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "MutualMatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "matchedAt" REAL NOT NULL,
    "earliestEndAt" REAL NOT NULL,
    "active" BOOLEAN NOT NULL
);

-- CreateTable
CREATE TABLE "PendingMutualIdentity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL,
    "createdAt" TEXT NOT NULL,
    "payload" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ScoutRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL,
    "createdAt" TEXT NOT NULL,
    "payload" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ScoutConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL,
    "payload" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL,
    "createdAt" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "AppRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "collection" TEXT NOT NULL,
    "payload" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerDNA_profileId_key" ON "PartnerDNA"("profileId");

-- CreateIndex
CREATE INDEX "MutualRequest_senderId_createdAt_idx" ON "MutualRequest"("senderId", "createdAt");

-- CreateIndex
CREATE INDEX "MutualRequest_targetId_status_idx" ON "MutualRequest"("targetId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MutualSearch_searcherId_targetId_month_key" ON "MutualSearch"("searcherId", "targetId", "month");

-- CreateIndex
CREATE INDEX "PendingMutualIdentity_ownerId_active_idx" ON "PendingMutualIdentity"("ownerId", "active");

-- CreateIndex
CREATE INDEX "ScoutRequest_ownerId_active_idx" ON "ScoutRequest"("ownerId", "active");

-- CreateIndex
CREATE INDEX "Notification_ownerId_read_idx" ON "Notification"("ownerId", "read");

-- CreateIndex
CREATE INDEX "AppRecord_collection_idx" ON "AppRecord"("collection");

