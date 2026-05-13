#!/usr/bin/env node
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { getRootDir, loadEnv } = require("./_node-utils.cjs");
const {
  baseAssets,
  baseGlobalConfigs,
  baseSourceConfigs,
  baseTemplates,
  defaultAiConfig,
  defaultGlobalAiPrompt
} = require("../backend/dist/data/seed-data");

const rootDir = getRootDir();
loadEnv(rootDir);

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not configured.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool)
});

function toDate(value) {
  if (value.includes("T")) {
    return new Date(value);
  }

  return new Date(`2026-03-25T${value}:00Z`);
}

async function seed() {
  const assetCount = await prisma.asset.count();
  if (assetCount > 0) {
    console.log(`Seed skipped. Existing assets: ${assetCount}.`);
    return;
  }

  for (const [index, asset] of baseAssets.entries()) {
    const createdAsset = await prisma.asset.create({
      data: {
        symbol: asset.symbol,
        name: asset.name,
        sortOrder: index
      }
    });

    const snapshot = await prisma.assetAnalysisSnapshot.create({
      data: {
        assetId: createdAsset.id,
        window: "4H",
        priceDisplay: asset.price,
        priceChangeDisplay: asset.priceChange,
        ruleDirection: asset.rule.direction,
        ruleScore: asset.rule.score,
        ruleConfidence: asset.rule.confidence,
        riskLevel: asset.rule.risk,
        ruleDriversJson: asset.rule.drivers,
        aiDirection: asset.ai.direction,
        aiAction: asset.ai.action,
        aiStrength: asset.ai.strength,
        aiConfidence: asset.ai.confidence,
        aiReasonsJson: asset.ai.reasons,
        aiRisksJson: asset.ai.risks,
        consistencySummary: asset.consistency,
        briefNote: asset.events[0]?.title ?? asset.ai.reasons[0] ?? null,
        updatedAt: toDate(asset.updatedAt)
      }
    });

    for (const signal of asset.signals) {
      const createdSignal = await prisma.signalSnapshot.create({
        data: {
          analysisSnapshotId: snapshot.id,
          signalType: signal.type,
          label: signal.label,
          direction: signal.direction,
          score: signal.score,
          confidence: signal.confidence,
          driversJson: signal.drivers,
          highlightsJson: signal.highlights
        }
      });

      if (signal.metrics.length > 0) {
        await prisma.signalSupportingMetric.createMany({
          data: signal.metrics.map((metric, metricIndex) => ({
            signalSnapshotId: createdSignal.id,
            metricName: metric.name,
            metricValue: metric.value,
            displayOrder: metricIndex
          }))
        });
      }
    }

    if (asset.events.length > 0) {
      await prisma.event.createMany({
        data: asset.events.map((event) => ({
          assetId: createdAsset.id,
          eventType: event.type,
          title: event.title,
          summary: event.summary,
          direction: event.direction,
          occurredAt: toDate(event.time)
        }))
      });
    }

    if (asset.alerts.length > 0) {
      await prisma.alert.createMany({
        data: asset.alerts.map((alert) => ({
          assetId: createdAsset.id,
          alertType: alert.type,
          summary: alert.summary,
          status: alert.status,
          triggeredAt: toDate(alert.time)
        }))
      });
    }

    await prisma.ruleStrategyConfig.create({
      data: {
        assetId: createdAsset.id,
        templateType: "default",
        weightsJson: baseTemplates.default.weights
      }
    });
  }

  await prisma.systemAiConfig.create({
    data: {
      provider: defaultAiConfig.provider,
      model: defaultAiConfig.model,
      baseUrl: defaultAiConfig.baseUrl,
      apiKeyEncrypted: defaultAiConfig.apiKeyMasked,
      connectionStatus: defaultAiConfig.connectionStatus
    }
  });

  await prisma.systemTelegramConfig.create({
    data: {
      botTokenEncrypted: "",
      alertChatId: "",
      connectionStatus: "unchecked"
    }
  });

  await prisma.sourceConfig.createMany({
    data: baseSourceConfigs.map((source) => ({
      configKey: source.key,
      sourceType: source.type,
      sourceName: source.source,
      status: source.status,
      coverage: source.coverage
    })),
    skipDuplicates: true
  });

  await prisma.globalConfigSection.createMany({
    data: [
      {
        sectionKey: "sources",
        title: "数据源与观察名单",
        configJson: baseGlobalConfigs.sources
      },
      {
        sectionKey: "onchainWhaleRules",
        title: "链上 / 大户规则",
        configJson: baseGlobalConfigs.onchainWhaleRules
      },
      {
        sectionKey: "preferences",
        title: "全局偏好",
        configJson: baseGlobalConfigs.preferences
      },
      {
        sectionKey: "alertRules",
        title: "告警规则",
        configJson: baseGlobalConfigs.alertRules
      },
      {
        sectionKey: "aiPromptStrategy",
        title: "全局 AI 提示策略",
        configJson: {
          promptText: defaultGlobalAiPrompt
        }
      }
    ],
    skipDuplicates: true
  });

  console.log(`Seed completed. Created ${baseAssets.length} assets.`);
}

seed()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
