-- CreateTable
CREATE TABLE "LatestSignalState" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "signalType" TEXT NOT NULL,
    "direction" "Direction" NOT NULL,
    "biasLevel" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "confidence" TEXT NOT NULL,
    "driversJson" JSONB NOT NULL,
    "metricsJson" JSONB NOT NULL,
    "stateJson" JSONB NOT NULL,
    "lastChangedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LatestSignalState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LatestSignalState_assetId_signalType_key" ON "LatestSignalState"("assetId", "signalType");

-- CreateIndex
CREATE INDEX "LatestSignalState_signalType_updatedAt_idx" ON "LatestSignalState"("signalType", "updatedAt");

-- AddForeignKey
ALTER TABLE "LatestSignalState" ADD CONSTRAINT "LatestSignalState_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
