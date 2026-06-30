-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'PARTIAL');

-- CreateTable
CREATE TABLE "Scan" (
    "id" TEXT NOT NULL,
    "jobId" TEXT,
    "url" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "status" "ScanStatus" NOT NULL DEFAULT 'PENDING',
    "rulebookVersion" TEXT NOT NULL DEFAULT 'v1',
    "overallScore" INTEGER,
    "performanceScore" INTEGER,
    "seoScore" INTEGER,
    "securityScore" INTEGER,
    "accessibilityScore" INTEGER,
    "mobileScore" INTEGER,
    "lighthouseDesktop" JSONB,
    "lighthouseMobile" JSONB,
    "resultJson" JSONB,
    "errorReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Scan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "consent" BOOLEAN NOT NULL DEFAULT false,
    "pdfSentAt" TIMESTAMP(3),
    "deleteRequestedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Scan_jobId_key" ON "Scan"("jobId");

-- CreateIndex
CREATE INDEX "Scan_jobId_idx" ON "Scan"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_scanId_key" ON "Lead"("scanId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
