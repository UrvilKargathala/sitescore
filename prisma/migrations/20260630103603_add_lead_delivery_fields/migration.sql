-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "consentAt" TIMESTAMP(3),
ADD COLUMN     "deliveryError" TEXT,
ADD COLUMN     "deliveryJobId" TEXT,
ADD COLUMN     "deliveryStatus" TEXT NOT NULL DEFAULT 'pending';
