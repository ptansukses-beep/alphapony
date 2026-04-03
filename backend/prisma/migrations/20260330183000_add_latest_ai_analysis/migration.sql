CREATE TABLE "LatestAiAnalysis" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "basedOnSnapshotId" TEXT NOT NULL,
    "basedOnSnapshotAt" TIMESTAMP(3) NOT NULL,
    "direction" "Direction" NOT NULL,
    "biasLevel" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "strength" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "reasonsJson" JSONB NOT NULL,
    "risksJson" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LatestAiAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LatestAiAnalysis_assetId_key" ON "LatestAiAnalysis"("assetId");
CREATE INDEX "LatestAiAnalysis_basedOnSnapshotId_updatedAt_idx" ON "LatestAiAnalysis"("basedOnSnapshotId", "updatedAt");

ALTER TABLE "LatestAiAnalysis" ADD CONSTRAINT "LatestAiAnalysis_assetId_fkey"
FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
