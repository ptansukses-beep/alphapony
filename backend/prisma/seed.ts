import { resolve } from "node:path";
import * as dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import {
  baseAssets,
  baseGlobalConfigs,
  baseSourceConfigs,
  baseTemplates,
  defaultGlobalAiPrompt,
  defaultAiConfig
} from "../src/data/seed-data";

dotenv.config({
  path: resolve(__dirname, "../../.env")
});

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(
    new Pool({
      connectionString
    })
  )
});

function toDate(value: string) {
  if (value.includes("T")) {
    return new Date(value);
  }

  return new Date(`2026-03-25T${value}:00Z`);
}

async function main() {
  await prisma.signalSupportingMetric.deleteMany();
  await prisma.signalSnapshot.deleteMany();
  await prisma.assetAnalysisSnapshot.deleteMany();
  await prisma.event.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.ruleStrategyConfig.deleteMany();
  await prisma.assetPromptConfig.deleteMany();
  await prisma.sourceConfig.deleteMany();
  await prisma.globalConfigSection.deleteMany();
  await prisma.systemAiConfig.deleteMany();
  await prisma.systemTelegramConfig.deleteMany();
  await prisma.asset.deleteMany();

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
    }))
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
    ]
  });
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
