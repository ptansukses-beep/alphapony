-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('bullish', 'bearish', 'watch');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('new', 'sent', 'archived');

-- CreateEnum
CREATE TYPE "RuleTemplateType" AS ENUM ('aggressive', 'conservative', 'default', 'custom');

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'active',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetAnalysisSnapshot" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "window" TEXT NOT NULL,
    "priceDisplay" TEXT NOT NULL,
    "priceChangeDisplay" TEXT NOT NULL,
    "ruleDirection" "Direction" NOT NULL,
    "ruleScore" INTEGER NOT NULL,
    "ruleConfidence" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "ruleDriversJson" JSONB NOT NULL,
    "aiDirection" "Direction" NOT NULL,
    "aiAction" TEXT NOT NULL,
    "aiStrength" TEXT NOT NULL,
    "aiConfidence" TEXT NOT NULL,
    "aiReasonsJson" JSONB NOT NULL,
    "aiRisksJson" JSONB NOT NULL,
    "consistencySummary" TEXT NOT NULL,
    "briefNote" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetAnalysisSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalSnapshot" (
    "id" TEXT NOT NULL,
    "analysisSnapshotId" TEXT NOT NULL,
    "signalType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "direction" "Direction" NOT NULL,
    "score" INTEGER NOT NULL,
    "confidence" TEXT NOT NULL,
    "driversJson" JSONB NOT NULL,
    "highlightsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignalSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalSupportingMetric" (
    "id" TEXT NOT NULL,
    "signalSnapshotId" TEXT NOT NULL,
    "metricName" TEXT NOT NULL,
    "metricValue" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignalSupportingMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "direction" "Direction" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "sourceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'new',
    "triggeredAt" TIMESTAMP(3) NOT NULL,
    "payloadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleStrategyConfig" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "templateType" "RuleTemplateType" NOT NULL,
    "weightsJson" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RuleStrategyConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetPromptConfig" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "promptText" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetPromptConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemAiConfig" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT NOT NULL,
    "connectionStatus" TEXT NOT NULL,
    "lastCheckedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemAiConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceConfig" (
    "id" TEXT NOT NULL,
    "configKey" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "coverage" TEXT NOT NULL,
    "configJson" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalConfigSection" (
    "id" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "configJson" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlobalConfigSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Asset_symbol_key" ON "Asset"("symbol");

-- CreateIndex
CREATE INDEX "AssetAnalysisSnapshot_assetId_window_idx" ON "AssetAnalysisSnapshot"("assetId", "window");

-- CreateIndex
CREATE INDEX "SignalSnapshot_analysisSnapshotId_signalType_idx" ON "SignalSnapshot"("analysisSnapshotId", "signalType");

-- CreateIndex
CREATE INDEX "Event_assetId_occurredAt_idx" ON "Event"("assetId", "occurredAt");

-- CreateIndex
CREATE INDEX "Alert_assetId_triggeredAt_idx" ON "Alert"("assetId", "triggeredAt");

-- CreateIndex
CREATE UNIQUE INDEX "RuleStrategyConfig_assetId_key" ON "RuleStrategyConfig"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetPromptConfig_assetId_key" ON "AssetPromptConfig"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceConfig_configKey_key" ON "SourceConfig"("configKey");

-- CreateIndex
CREATE UNIQUE INDEX "SourceConfig_sourceType_key" ON "SourceConfig"("sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalConfigSection_sectionKey_key" ON "GlobalConfigSection"("sectionKey");

-- AddForeignKey
ALTER TABLE "AssetAnalysisSnapshot" ADD CONSTRAINT "AssetAnalysisSnapshot_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalSnapshot" ADD CONSTRAINT "SignalSnapshot_analysisSnapshotId_fkey" FOREIGN KEY ("analysisSnapshotId") REFERENCES "AssetAnalysisSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalSupportingMetric" ADD CONSTRAINT "SignalSupportingMetric_signalSnapshotId_fkey" FOREIGN KEY ("signalSnapshotId") REFERENCES "SignalSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleStrategyConfig" ADD CONSTRAINT "RuleStrategyConfig_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetPromptConfig" ADD CONSTRAINT "AssetPromptConfig_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
