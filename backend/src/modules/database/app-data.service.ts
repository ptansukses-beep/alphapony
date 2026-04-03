import { createHash } from "node:crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { AlertStatus, Direction, RuleTemplateType, type Prisma } from "@prisma/client";
import { baseTemplates, defaultGlobalAiPrompt, defaultGlobalAiPromptByLocale } from "../../data/seed-data";
import { AiAnalysisService } from "../ai/ai-analysis.service";
import type { KolSignalEvaluation, SupportedKolSymbol } from "../kol/kol.types";
import {
  getLocalizedConsistencyItems,
  getLocalizedDriverItem,
  getLocalizedRuleDriverItem,
  getLocalizedHighlight,
  getLocalizedMetric,
  type LocalizationParams
} from "../shared/signal-localization";
import { PrismaService } from "./prisma.service";

const fallbackSignalScores = (
  ruleScore: number
): Array<{ type: string; score: number; direction: "bullish" | "bearish" | "watch"; biasLevel: string }> => {
  const marketDirection = ruleScore > 0 ? "bullish" : ruleScore < 0 ? "bearish" : "watch";
  const marketScore = ruleScore > 0 ? Math.min(ruleScore, 24) : Math.max(ruleScore, -24);

  return [
    { type: "news", score: 0, direction: "watch", biasLevel: scoreToBiasLevel(0) },
    { type: "community", score: 0, direction: "watch", biasLevel: scoreToBiasLevel(0) },
    { type: "kol", score: 0, direction: "watch", biasLevel: scoreToBiasLevel(0) },
    { type: "market", score: marketScore, direction: marketDirection, biasLevel: scoreToBiasLevel(marketScore) },
    { type: "onchain", score: 0, direction: "watch", biasLevel: scoreToBiasLevel(0) },
    { type: "whale", score: 0, direction: "watch", biasLevel: scoreToBiasLevel(0) }
  ];
};

function toDirection(value: Direction): "bullish" | "bearish" | "watch" {
  return value;
}

function normalizeSignalLabel(type: string, label: string) {
  if (type === "whale") {
    return "鲸鱼信号";
  }

  return label;
}

function signalLabelKeyFromType(
  type: string
): "news" | "community" | "kol" | "market" | "onchain" | "whale" | undefined {
  switch (type) {
    case "news":
    case "community":
    case "kol":
    case "market":
    case "onchain":
    case "whale":
      return type;
    default:
      return undefined;
  }
}

function confidenceKeyFromText(confidence: string) {
  switch (confidence.trim().toLowerCase()) {
    case "high":
    case "高":
      return "high" as const;
    case "medium":
    case "中":
      return "medium" as const;
    case "low":
    case "低":
      return "low" as const;
    default:
      return undefined;
  }
}

function riskKeyFromText(risk: string) {
  switch (risk.trim()) {
    case "高":
      return "high" as const;
    case "中高":
      return "medium_high" as const;
    case "中":
      return "medium" as const;
    default:
      return undefined;
  }
}

function consistencyKeyFromText(consistency: string) {
  switch (consistency.trim()) {
    case "规则与 AI 基本一致":
      return "aligned" as const;
    case "规则方向更明确，AI 暂时观望":
      return "rule_clearer_ai_watch" as const;
    case "规则暂时观望，AI 方向更明确":
      return "ai_clearer_rule_watch" as const;
    case "规则与 AI 存在分歧":
      return "divergent" as const;
    default:
      return undefined;
  }
}

function toJsonRecord(value: Prisma.JsonValue | null | undefined): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, String(item)])
  );
}

function toPromptText(value: Prisma.JsonValue | null | undefined): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const promptText = (value as { promptText?: unknown }).promptText;
  return typeof promptText === "string" ? promptText : null;
}

function toPromptTextByLocale(
  value: Prisma.JsonValue | null | undefined
): Record<"zh-CN" | "en-US", string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...defaultGlobalAiPromptByLocale };
  }

  const promptTextByLocale = (value as { promptTextByLocale?: unknown }).promptTextByLocale;

  if (promptTextByLocale && typeof promptTextByLocale === "object" && !Array.isArray(promptTextByLocale)) {
    const zh = (promptTextByLocale as { "zh-CN"?: unknown })["zh-CN"];
    const en = (promptTextByLocale as { "en-US"?: unknown })["en-US"];

    return {
      "zh-CN": typeof zh === "string" && zh.trim() ? zh : defaultGlobalAiPromptByLocale["zh-CN"],
      "en-US": typeof en === "string" && en.trim() ? en : defaultGlobalAiPromptByLocale["en-US"]
    };
  }

  const legacyPromptText = toPromptText(value);

  return {
    "zh-CN": legacyPromptText ?? defaultGlobalAiPromptByLocale["zh-CN"],
    "en-US": defaultGlobalAiPromptByLocale["en-US"]
  };
}

function toReadableErrorMessage(raw: string) {
  const text = raw.trim();

  if (!text) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(text) as {
      error?: { message?: unknown; code?: unknown; type?: unknown };
      description?: unknown;
      message?: unknown;
    };

    if (typeof parsed.error?.message === "string" && parsed.error.message.trim()) {
      return parsed.error.message.trim();
    }

    if (typeof parsed.description === "string" && parsed.description.trim()) {
      return parsed.description.trim();
    }

    if (typeof parsed.message === "string" && parsed.message.trim()) {
      return parsed.message.trim();
    }
  } catch {
    return text;
  }

  return text;
}

function normalizeMoneyString(value: string) {
  return value.trim().replace(/^\$+/, "$");
}

function toAlertPayloadRecord(value: Prisma.JsonValue | null | undefined): Record<string, string | number | boolean | null> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => {
      if (typeof item === "string" || typeof item === "number" || typeof item === "boolean" || item === null) {
        if (typeof item === "string" && (key === "price" || key === "amount")) {
          return [key, normalizeMoneyString(item)];
        }

        return [key, item];
      }

      return [key, JSON.stringify(item)];
    })
  );
}

function inferAlertTypeKeyFromPayload(payload: Record<string, string | number | boolean | null>) {
  const explicit = typeof payload.typeKey === "string" && payload.typeKey.trim() ? payload.typeKey.trim() : null;
  if (explicit) {
    return explicit;
  }

  const alertKey = typeof payload.alertKey === "string" ? payload.alertKey : "";
  if (!alertKey) {
    return undefined;
  }

  if (alertKey.startsWith("rule-threshold-")) {
    return "rule_threshold";
  }

  if (alertKey.startsWith("rule-direction-switch-")) {
    return "rule_direction_switch";
  }

  if (alertKey.startsWith("signal-resonance-")) {
    return "signal_resonance";
  }

  if (alertKey.startsWith("ai-switch-")) {
    return "ai_switch";
  }

  return undefined;
}

function inferAlertSummaryKeyFromPayload(payload: Record<string, string | number | boolean | null>) {
  const explicit = typeof payload.summaryKey === "string" && payload.summaryKey.trim() ? payload.summaryKey.trim() : null;
  if (explicit) {
    return explicit;
  }

  const alertKey = typeof payload.alertKey === "string" ? payload.alertKey : "";
  if (!alertKey) {
    return undefined;
  }

  if (alertKey === "rule-threshold-bullish") {
    return "alerts.ruleThresholdBullish";
  }

  if (alertKey === "rule-threshold-bearish") {
    return "alerts.ruleThresholdBearish";
  }

  if (alertKey.startsWith("rule-direction-switch-")) {
    return "alerts.ruleDirectionSwitch";
  }

  if (alertKey.startsWith("signal-resonance-bullish-")) {
    return "alerts.signalResonanceBullish";
  }

  if (alertKey.startsWith("signal-resonance-bearish-")) {
    return "alerts.signalResonanceBearish";
  }

  if (alertKey.startsWith("ai-switch-")) {
    return "alerts.aiSwitch";
  }

  return undefined;
}

function inferAlertSeverityFromPayload(payload: Record<string, string | number | boolean | null>) {
  const typeKey = inferAlertTypeKeyFromPayload(payload);

  switch (typeKey) {
    case "rule_threshold":
      return "high" as const;
    case "rule_direction_switch":
    case "ai_switch":
      return "medium" as const;
    case "signal_resonance":
      return "low" as const;
    default:
      return "low" as const;
  }
}

function toLocalizedAiStringRecord(
  value: Prisma.JsonValue | null | undefined
): Partial<Record<"zh-CN" | "en-US", string>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const record = value as Record<string, unknown>;
  const next: Partial<Record<"zh-CN" | "en-US", string>> = {};

  if (typeof record["zh-CN"] === "string") {
    next["zh-CN"] = record["zh-CN"];
  }

  if (typeof record["en-US"] === "string") {
    next["en-US"] = record["en-US"];
  }

  return next;
}

function toLocalizedAiListRecord(
  value: Prisma.JsonValue | null | undefined
): Partial<Record<"zh-CN" | "en-US", string[]>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const record = value as Record<string, unknown>;
  const next: Partial<Record<"zh-CN" | "en-US", string[]>> = {};

  if (Array.isArray(record["zh-CN"])) {
    next["zh-CN"] = (record["zh-CN"] as unknown[]).map(String);
  }

  if (Array.isArray(record["en-US"])) {
    next["en-US"] = (record["en-US"] as unknown[]).map(String);
  }

  return next;
}

function scoreToBiasLevel(score: number) {
  if (score <= -75) {
    return "super_bearish";
  }

  if (score <= -45) {
    return "strong_bearish";
  }

  if (score <= -15) {
    return "weak_bearish";
  }

  if (score < 15) {
    return "watch";
  }

  if (score < 45) {
    return "weak_bullish";
  }

  if (score < 75) {
    return "strong_bullish";
  }

  return "super_bullish";
}

function directionFromScore(score: number): "bullish" | "bearish" | "watch" {
  if (score > 0) {
    return "bullish";
  }

  if (score < 0) {
    return "bearish";
  }

  return "watch";
}

function aiToBiasLevel(
  direction: "bullish" | "bearish" | "watch",
  strength: string,
  confidence: string
) {
  if (direction === "watch") {
    return "watch";
  }

  const normalizedStrength = strength.trim();
  const normalizedConfidence = confidence.trim();

  if (direction === "bullish") {
    if (normalizedStrength === "强" && normalizedConfidence === "高") {
      return "super_bullish";
    }

    if (normalizedStrength === "强" || normalizedConfidence === "高") {
      return "strong_bullish";
    }

    if (normalizedStrength === "中" || normalizedConfidence === "中") {
      return "weak_bullish";
    }

    return "weak_bullish";
  }

  if (normalizedStrength === "强" && normalizedConfidence === "高") {
    return "super_bearish";
  }

  if (normalizedStrength === "强" || normalizedConfidence === "高") {
    return "strong_bearish";
  }

  if (normalizedStrength === "中" || normalizedConfidence === "中") {
    return "weak_bearish";
  }

  return "weak_bearish";
}

function aiScoreFromLegacy(
  direction: "bullish" | "bearish" | "watch",
  strength: string,
  confidence: string
) {
  if (direction === "watch") {
    return 0;
  }

  const strengthBoost = strength === "强" ? 54 : strength === "中" ? 30 : 18;
  const confidenceBoost = confidence === "高" ? 16 : confidence === "中" ? 8 : 0;
  const score = strengthBoost + confidenceBoost;

  return direction === "bullish" ? score : -score;
}

function aiActionKeyFromText(action: string) {
  const normalized = action.trim();

  switch (normalized) {
    case "积极做多":
      return "aggressive_long";
    case "偏多跟随":
      return "follow_bullish";
    case "轻仓试多":
      return "probe_long";
    case "轻仓试空":
      return "probe_short";
    case "偏空防守":
      return "defensive_bearish";
    case "积极防守":
      return "aggressive_defense";
    case "暂不操作":
      return "standby";
    default:
      return normalized.includes("观望") || normalized.includes("等待")
        ? "standby"
        : undefined;
  }
}

function aiStrengthKeyFromText(strength: string) {
  switch (strength.trim()) {
    case "强":
      return "high";
    case "中":
      return "medium";
    case "弱":
      return "low";
    default:
      return undefined;
  }
}

function aiConfidenceKeyFromText(confidence: string) {
  switch (confidence.trim()) {
    case "高":
      return "high";
    case "中":
      return "medium";
    case "低":
      return "low";
    default:
      return undefined;
  }
}

function normalizeExternalHref(href?: string | null) {
  if (!href) {
    return undefined;
  }

  const trimmed = href.trim();
  if (!trimmed || trimmed === "#") {
    return undefined;
  }

  try {
    const parsed = new URL(trimmed);
    if (/^nitter(\.[^/]+)?$/i.test(parsed.hostname)) {
      const segments = parsed.pathname.split("/").filter(Boolean);
      const username = segments[0]?.replace(/^@/, "");
      const statusIndex = segments.findIndex((segment) => segment === "status");
      const statusId = statusIndex >= 0 ? segments[statusIndex + 1] : null;

      if (username && statusId) {
        return `https://x.com/${username}/status/${statusId}`;
      }

      if (username) {
        return `https://x.com/${username}`;
      }
    }

    return trimmed;
  } catch {
    return undefined;
  }
}

export type PersistedDetailSignal = {
  type: string;
  label: string;
  labelKey?: string;
  direction: "bullish" | "bearish" | "watch";
  score: number;
  confidence: string;
  confidenceKey?: "high" | "medium" | "low";
  drivers: string[];
  driverItems?: Array<{ textKey: string; textParams?: LocalizationParams } | null>;
  metrics: Array<{
    name: string;
    value: string;
    nameKey?: string;
    valueKey?: string;
    valueParams?: LocalizationParams;
  }>;
  highlights: Array<{
    title: string;
    href: string;
    publishedAt?: string;
    score?: number;
    titleKey?: string;
    titleParams?: LocalizationParams;
  }>;
};

export type PersistedAssetDetail = {
  symbol: string;
  price: string;
  priceChange: string;
  briefNote?: string;
  window?: string;
  rule: {
    direction: "bullish" | "bearish" | "watch";
    score: number;
    confidence: string;
    confidenceKey?: "high" | "medium" | "low";
    risk: string;
    riskKey?: "high" | "medium_high" | "medium";
    drivers: string[];
    driverItems?: Array<{ textKey: string; textParams?: LocalizationParams } | null>;
  };
  ai: {
    direction: "bullish" | "bearish" | "watch";
    action: string;
    strength: string;
    confidence: string;
    reasons: string[];
    risks: string[];
  };
  consistency: string;
  consistencyKey?: string;
  consistencyItems?: Array<{ textKey: string; textParams?: LocalizationParams }>;
  signals: PersistedDetailSignal[];
};

export type PersistedAiAnalysis = {
  available: boolean;
  direction: "bullish" | "bearish" | "watch";
  biasLevel:
    | "super_bearish"
    | "strong_bearish"
    | "weak_bearish"
    | "watch"
    | "weak_bullish"
    | "strong_bullish"
    | "super_bullish";
  score: number;
  action: string;
  actionKey?: string;
  strength: string;
  strengthKey?: "high" | "medium" | "low";
  confidence: string;
  confidenceKey?: "high" | "medium" | "low";
  summary: string;
  reasons: string[];
  risks: string[];
  localizedText?: {
    sourceLocale: "zh-CN" | "en-US";
    availableLocales: Array<"zh-CN" | "en-US">;
    summaryByLocale: Partial<Record<"zh-CN" | "en-US", string>>;
    reasonsByLocale: Partial<Record<"zh-CN" | "en-US", string[]>>;
    risksByLocale: Partial<Record<"zh-CN" | "en-US", string[]>>;
  };
  updatedAt: string;
  basedOnSnapshotAt: string;
};

export type RuntimeAiConfig = {
  model: string;
  provider: string;
  baseUrl: string;
  apiKey: string;
};

export type LatestSnapshotState = {
  id: string;
  createdAt: Date;
  ruleScore: number;
  ruleDirection: "bullish" | "bearish" | "watch";
  aiDirection: "bullish" | "bearish" | "watch";
  signalSnapshots: Array<{
    signalType: string;
    direction: "bullish" | "bearish" | "watch";
    score: number;
    driversJson: Prisma.JsonValue;
    highlightsJson: Prisma.JsonValue;
    metricNames: string[];
  }>;
};

type StrategyWeightInput = {
  type: string;
  label: string;
  value: number;
};

export type TimelineItem = {
  time: string;
  assetSymbol: string;
  assetName: string;
  type: string;
  typeKey?: string;
  title: string;
  titleKey?: string;
  titleParams?: LocalizationParams;
  summary?: string;
  summaryItems?: Array<{ textKey: string; textParams?: LocalizationParams } | null>;
  direction: "bullish" | "bearish" | "watch";
  href?: string;
  score?: number;
};

export type TimelineListResult = {
  items: TimelineItem[];
  total: number;
};

type PersistedLatestSignalState = {
  signalType: string;
  direction: "bullish" | "bearish" | "watch";
  biasLevel: string;
  score: number;
  confidence: string;
  drivers: string[];
  driverItems?: Array<{ textKey: string; textParams?: LocalizationParams } | null>;
  metrics: Array<{
    name: string;
    value: string;
    nameKey?: string;
    valueKey?: string;
    valueParams?: LocalizationParams;
  }>;
  updatedAt: string;
  lastChangedAt: string;
};

function createEventFingerprint(parts: Array<string | number | undefined>) {
  return createHash("sha1")
    .update(
      parts
        .map((part) => String(part ?? ""))
        .join("|")
    )
    .digest("hex");
}

function toStoredHighlight(highlight: PersistedDetailSignal["highlights"][number]) {
  return {
    title: highlight.title,
    href: highlight.href,
    ...(highlight.publishedAt ? { publishedAt: highlight.publishedAt } : {}),
    ...(typeof highlight.score === "number" ? { score: highlight.score } : {})
  };
}

function toMarketStateJson(metrics: PersistedDetailSignal["metrics"]) {
  const metricMap = new Map(metrics.map((metric) => [metric.name, metric.value]));
  const volumeValue = metricMap.get("量能") ?? "";
  const volatilityValue = metricMap.get("波动") ?? "";

  return {
    ema: metricMap.get("EMA") ?? "",
    ma: metricMap.get("均线") ?? "",
    macd: metricMap.get("MACD") ?? "",
    volumeState: volumeValue.split(" ")[0] ?? volumeValue,
    volatilityState: volatilityValue.split(" ")[0] ?? volatilityValue
  };
}

function fingerprintStateJson(value: Prisma.JsonValue | null | undefined) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "";
  }

  return Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${key}:${String(item ?? "")}`)
    .join("|");
}

@Injectable()
export class AppDataService {
  constructor(private readonly prisma: PrismaService) {}

  private maskApiKey(apiKey?: string | null) {
    if (!apiKey) {
      return "";
    }

    const trimmed = apiKey.trim();
    if (!trimmed) {
      return "";
    }

    if (trimmed.includes("••••")) {
      return trimmed;
    }

    if (trimmed.length <= 8) {
      return `${trimmed.slice(0, 2)}••••`;
    }

    return `${trimmed.slice(0, 3)}••••${trimmed.slice(-4)}`;
  }

  private looksMaskedApiKey(apiKey?: string | null) {
    if (!apiKey) {
      return true;
    }

    return apiKey.includes("••••");
  }

  async listDashboardAssets() {
    const assets = await this.prisma.asset.findMany({
      orderBy: {
        sortOrder: "asc"
      },
      include: {
        latestAiAnalysis: true,
        analysisSnapshots: {
          orderBy: {
            createdAt: "desc"
          },
          take: 1,
          include: {
            signalSnapshots: {
              include: {
                metrics: {
                  orderBy: {
                    displayOrder: "asc"
                  }
                }
              }
            }
          }
        }
      }
    });

    return assets
      .map((asset) => {
        const snapshot = asset.analysisSnapshots[0];
        if (!snapshot) {
          return null;
        }

        return {
          symbol: asset.symbol,
          name: asset.name,
          snapshotCreatedAt: snapshot.createdAt.toISOString(),
          analysisUpdatedAt:
            asset.latestAiAnalysis && asset.latestAiAnalysis.basedOnSnapshotAt.getTime() === snapshot.createdAt.getTime()
              ? asset.latestAiAnalysis.updatedAt.toISOString()
              : null,
          price: snapshot.priceDisplay,
          priceChange: snapshot.priceChangeDisplay,
          ruleScore: snapshot.ruleScore,
          ruleDirection: toDirection(snapshot.ruleDirection),
          aiAvailable:
            Boolean(asset.latestAiAnalysis)
            && asset.latestAiAnalysis!.basedOnSnapshotAt.getTime() === snapshot.createdAt.getTime(),
          aiDirection:
            asset.latestAiAnalysis && asset.latestAiAnalysis.basedOnSnapshotAt.getTime() === snapshot.createdAt.getTime()
            ? toDirection(asset.latestAiAnalysis.direction)
            : undefined,
          aiScore:
            asset.latestAiAnalysis && asset.latestAiAnalysis.basedOnSnapshotAt.getTime() === snapshot.createdAt.getTime()
            ? asset.latestAiAnalysis.score
            : undefined,
          aiBiasLevel:
            asset.latestAiAnalysis && asset.latestAiAnalysis.basedOnSnapshotAt.getTime() === snapshot.createdAt.getTime()
            ? asset.latestAiAnalysis.biasLevel
            : undefined,
          riskLevel: snapshot.riskLevel,
          signalScores:
            snapshot.signalSnapshots.length > 0
              ? snapshot.signalSnapshots.map((signal) => ({
                  type: signal.signalType,
                  score: signal.score,
                  direction: toDirection(signal.direction),
                  biasLevel: scoreToBiasLevel(signal.score)
                }))
              : fallbackSignalScores(snapshot.ruleScore),
          briefNote: snapshot.briefNote ?? "当前暂无额外提醒。",
          briefNoteItem: getLocalizedRuleDriverItem(snapshot.briefNote ?? "当前暂无额外提醒。")
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }

  async listTrackedAssets() {
    return this.prisma.asset.findMany({
      orderBy: {
        sortOrder: "asc"
      },
      select: {
        symbol: true,
        name: true
      }
    });
  }

  async getAssetDetail(symbol: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { symbol },
      include: {
        analysisSnapshots: {
          orderBy: {
            createdAt: "desc"
          },
          take: 1,
          include: {
            signalSnapshots: {
              include: {
                metrics: {
                  orderBy: {
                    displayOrder: "asc"
                  }
                }
              },
              orderBy: {
                createdAt: "asc"
              }
            }
          }
        },
        events: {
          orderBy: {
            occurredAt: "desc"
          },
          take: 10
        },
        latestSignalStates: {
          orderBy: {
            updatedAt: "desc"
          }
        },
        alerts: {
          orderBy: {
            triggeredAt: "desc"
          },
          take: 10
        }
      }
    });

    if (!asset || asset.analysisSnapshots.length === 0) {
      throw new NotFoundException("Asset detail not found");
    }

    const snapshot = asset.analysisSnapshots[0];

    return {
      symbol: asset.symbol,
      name: asset.name,
      price: snapshot.priceDisplay,
      priceChange: snapshot.priceChangeDisplay,
      window: snapshot.window,
      rule: {
        direction: toDirection(snapshot.ruleDirection),
        score: snapshot.ruleScore,
        confidence: snapshot.ruleConfidence,
        confidenceKey: confidenceKeyFromText(snapshot.ruleConfidence),
        risk: snapshot.riskLevel,
        riskKey: riskKeyFromText(snapshot.riskLevel),
        drivers: Array.isArray(snapshot.ruleDriversJson)
          ? snapshot.ruleDriversJson.map(String)
          : [],
        driverItems: Array.isArray(snapshot.ruleDriversJson)
          ? snapshot.ruleDriversJson.map(String).map((item) => getLocalizedRuleDriverItem(item) ?? null)
          : []
      },
      ai: {
        available: false,
        direction: toDirection(snapshot.aiDirection),
        biasLevel: aiToBiasLevel(
          toDirection(snapshot.aiDirection),
          snapshot.aiStrength,
          snapshot.aiConfidence
        ),
        score: aiScoreFromLegacy(
          toDirection(snapshot.aiDirection),
          snapshot.aiStrength,
          snapshot.aiConfidence
        ),
        action: snapshot.aiAction,
        actionKey: aiActionKeyFromText(snapshot.aiAction),
        strength: snapshot.aiStrength,
        strengthKey: aiStrengthKeyFromText(snapshot.aiStrength),
        confidence: snapshot.aiConfidence,
        confidenceKey: aiConfidenceKeyFromText(snapshot.aiConfidence),
        summary: Array.isArray(snapshot.aiReasonsJson) && snapshot.aiReasonsJson.length > 0
          ? String(snapshot.aiReasonsJson[0])
          : "当前暂无额外 AI 摘要。",
        reasons: Array.isArray(snapshot.aiReasonsJson)
          ? snapshot.aiReasonsJson.map(String)
          : [],
        risks: Array.isArray(snapshot.aiRisksJson)
          ? snapshot.aiRisksJson.map(String)
          : [],
        localizedText: {
          sourceLocale: "zh-CN",
          availableLocales: ["zh-CN"],
          summaryByLocale: {
            "zh-CN": Array.isArray(snapshot.aiReasonsJson) && snapshot.aiReasonsJson.length > 0
              ? String(snapshot.aiReasonsJson[0])
              : "当前暂无额外 AI 摘要。"
          },
          reasonsByLocale: {
            "zh-CN": Array.isArray(snapshot.aiReasonsJson)
              ? snapshot.aiReasonsJson.map(String)
              : []
          },
          risksByLocale: {
            "zh-CN": Array.isArray(snapshot.aiRisksJson)
              ? snapshot.aiRisksJson.map(String)
              : []
          }
        },
        updatedAt: snapshot.updatedAt.toISOString(),
        basedOnSnapshotAt: snapshot.createdAt.toISOString()
      },
      consistency: snapshot.consistencySummary,
      consistencyKey: consistencyKeyFromText(snapshot.consistencySummary),
      consistencyItems: getLocalizedConsistencyItems(snapshot.consistencySummary),
      signals: snapshot.signalSnapshots.map((signal) => ({
        type: signal.signalType,
        label: normalizeSignalLabel(signal.signalType, signal.label),
        labelKey: signalLabelKeyFromType(signal.signalType),
        direction: toDirection(signal.direction),
        biasLevel: scoreToBiasLevel(signal.score),
        score: signal.score,
        confidence: signal.confidence,
        confidenceKey: confidenceKeyFromText(signal.confidence),
        drivers: Array.isArray(signal.driversJson) ? signal.driversJson.map(String) : [],
        driverItems: Array.isArray(signal.driversJson)
          ? signal.driversJson.map(String).map((item) => getLocalizedDriverItem(item) ?? null)
          : [],
        metrics: signal.metrics.map((metric) => ({
          name: metric.metricName,
          value: metric.metricValue,
          ...getLocalizedMetric(metric.metricName, metric.metricValue)
        })),
        highlights: Array.isArray(signal.highlightsJson)
          ? signal.highlightsJson.slice(0, 10).map((item) => ({
              title: String((item as { title?: string }).title ?? ""),
              href: normalizeExternalHref(String((item as { href?: string }).href ?? "#")) ?? "",
              publishedAt: typeof (item as { publishedAt?: string }).publishedAt === "string"
                ? (item as { publishedAt?: string }).publishedAt
                : snapshot.createdAt.toISOString(),
              score:
                typeof (item as { score?: number }).score === "number"
                  ? (item as { score?: number }).score
                  : signal.score,
              ...getLocalizedHighlight(String((item as { title?: string }).title ?? ""))
            }))
          : []
      })),
      events: asset.events.map((event) => ({
        time: event.occurredAt.toISOString(),
        type: event.eventType,
        typeKey: signalLabelKeyFromType(event.eventType),
        title: event.title,
        ...getLocalizedHighlight(event.title),
        direction: toDirection(event.direction),
        href: normalizeExternalHref(event.sourceRef),
        score: event.score ?? undefined
      })),
      latestSignalStates: asset.latestSignalStates.map((state): PersistedLatestSignalState => ({
        signalType: state.signalType,
        direction: toDirection(state.direction),
        biasLevel: state.biasLevel,
        score: state.score,
        confidence: state.confidence,
        drivers: Array.isArray(state.driversJson) ? state.driversJson.map(String) : [],
        driverItems: Array.isArray(state.driversJson)
          ? state.driversJson.map(String).map((item) => getLocalizedDriverItem(item) ?? null)
          : [],
        metrics: Array.isArray(state.metricsJson)
          ? state.metricsJson.map((item) => ({
              name: String((item as { name?: string }).name ?? ""),
              value: String((item as { value?: string }).value ?? ""),
              ...getLocalizedMetric(
                String((item as { name?: string }).name ?? ""),
                String((item as { value?: string }).value ?? "")
              )
            }))
          : [],
        updatedAt: state.updatedAt.toISOString(),
        lastChangedAt: state.lastChangedAt.toISOString()
      })),
      alerts: asset.alerts.map((alert) => ({
        ...(function () {
          const summaryParams = toAlertPayloadRecord(alert.payloadJson);
          return {
            summaryParams,
            typeKey: inferAlertTypeKeyFromPayload(summaryParams),
            summaryKey: inferAlertSummaryKeyFromPayload(summaryParams),
            severity: inferAlertSeverityFromPayload(summaryParams)
          };
        })(),
        time: alert.triggeredAt.toISOString(),
        type: alert.alertType,
        summary: alert.summary,
        status: alert.status
      }))
    };
  }

  async getLatestAiAnalysis(symbol: string): Promise<PersistedAiAnalysis | null> {
    const asset = await this.prisma.asset.findUnique({
      where: { symbol },
      include: {
        latestAiAnalysis: true
      }
    });

    if (!asset?.latestAiAnalysis) {
      return null;
    }

    return {
      available: true,
      direction: toDirection(asset.latestAiAnalysis.direction),
      biasLevel: asset.latestAiAnalysis.biasLevel as PersistedAiAnalysis["biasLevel"],
      score: asset.latestAiAnalysis.score,
      action: asset.latestAiAnalysis.action,
      actionKey: aiActionKeyFromText(asset.latestAiAnalysis.action),
      strength: asset.latestAiAnalysis.strength,
      strengthKey: aiStrengthKeyFromText(asset.latestAiAnalysis.strength),
      confidence: asset.latestAiAnalysis.confidence,
      confidenceKey: aiConfidenceKeyFromText(asset.latestAiAnalysis.confidence),
      summary: asset.latestAiAnalysis.summary,
      reasons: Array.isArray(asset.latestAiAnalysis.reasonsJson)
        ? asset.latestAiAnalysis.reasonsJson.map(String)
        : [],
      risks: Array.isArray(asset.latestAiAnalysis.risksJson)
        ? asset.latestAiAnalysis.risksJson.map(String)
        : [],
      localizedText: {
        sourceLocale: "zh-CN",
        availableLocales: Object.keys({
          ...toLocalizedAiStringRecord(asset.latestAiAnalysis.summaryLocalizedJson),
          ...toLocalizedAiListRecord(asset.latestAiAnalysis.reasonsLocalizedJson),
          ...toLocalizedAiListRecord(asset.latestAiAnalysis.risksLocalizedJson),
          "zh-CN": true
        }) as Array<"zh-CN" | "en-US">,
        summaryByLocale: {
          "zh-CN": asset.latestAiAnalysis.summary,
          ...toLocalizedAiStringRecord(asset.latestAiAnalysis.summaryLocalizedJson)
        },
        reasonsByLocale: {
          "zh-CN": Array.isArray(asset.latestAiAnalysis.reasonsJson)
            ? asset.latestAiAnalysis.reasonsJson.map(String)
            : [],
          ...toLocalizedAiListRecord(asset.latestAiAnalysis.reasonsLocalizedJson)
        },
        risksByLocale: {
          "zh-CN": Array.isArray(asset.latestAiAnalysis.risksJson)
            ? asset.latestAiAnalysis.risksJson.map(String)
            : [],
          ...toLocalizedAiListRecord(asset.latestAiAnalysis.risksLocalizedJson)
        }
      },
      updatedAt: asset.latestAiAnalysis.updatedAt.toISOString(),
      basedOnSnapshotAt: asset.latestAiAnalysis.basedOnSnapshotAt.toISOString()
    };
  }

  async listAlerts(limit = 50, offset = 0) {
    const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 500)) : 50;
    const normalizedOffset = Number.isFinite(offset) ? Math.max(0, offset) : 0;
    const [alerts, total] = await this.prisma.$transaction([
      this.prisma.alert.findMany({
        include: { asset: true },
        orderBy: { triggeredAt: "desc" },
        take: normalizedLimit,
        ...(normalizedOffset > 0 ? { skip: normalizedOffset } : {})
      }),
      this.prisma.alert.count()
    ]);

    return {
      total,
      items: alerts.map((alert) => ({
        ...(function () {
          const summaryParams = toAlertPayloadRecord(alert.payloadJson);
          return {
            summaryParams,
            typeKey: inferAlertTypeKeyFromPayload(summaryParams),
            summaryKey: inferAlertSummaryKeyFromPayload(summaryParams),
            severity: inferAlertSeverityFromPayload(summaryParams)
          };
        })(),
        id: alert.id,
        asset: alert.asset.symbol,
        type: alert.alertType,
        summary: alert.summary,
        status: alert.status,
        timestamp: alert.triggeredAt.toISOString()
      }))
    };
  }

  async listTimelineEvents(symbol: string, limit?: number, offset = 0): Promise<TimelineListResult> {
    const normalizedSymbol = symbol.toUpperCase();
    const where = normalizedSymbol === "ALL"
      ? undefined
      : {
          asset: {
            symbol: normalizedSymbol
          }
        };
    const [events, total] = await this.prisma.$transaction([
      this.prisma.event.findMany({
        where,
        include: {
          asset: true
        },
        orderBy: {
          occurredAt: "desc"
        },
        ...(typeof limit === "number" ? { take: limit } : {}),
        ...(offset > 0 ? { skip: offset } : {})
      }),
      this.prisma.event.count({ where })
    ]);

    return {
      total,
      items: events.map((event) => ({
        time: event.occurredAt.toISOString(),
        assetSymbol: event.asset.symbol,
        assetName: event.asset.name,
        type: event.eventType,
        typeKey: signalLabelKeyFromType(event.eventType),
        title: event.title,
        ...getLocalizedHighlight(event.title),
        direction: toDirection(event.direction),
        href: normalizeExternalHref(event.sourceRef),
        score: event.score ?? undefined
      }))
    };
  }

  async listTimelineSignalHighlights(
    symbol: string,
    signalType: string,
    limit?: number,
    offset = 0
  ): Promise<TimelineListResult> {
    const normalizedSymbol = symbol.toUpperCase();
    const assets = normalizedSymbol === "ALL"
      ? await this.prisma.asset.findMany({
          orderBy: {
            sortOrder: "asc"
          }
        })
      : await this.prisma.asset.findMany({
          where: {
            symbol: normalizedSymbol
          }
        });

    const items = await Promise.all(
      assets.map(async (asset) => {
        const snapshot = await this.prisma.assetAnalysisSnapshot.findFirst({
          where: {
            assetId: asset.id
          },
          orderBy: {
            createdAt: "desc"
          },
          include: {
            signalSnapshots: {
              where: {
                signalType
              },
              take: 1
            }
          }
        });

        const signal = snapshot?.signalSnapshots[0];
        if (!signal || !Array.isArray(signal.highlightsJson)) {
          return [];
        }

        return signal.highlightsJson.map((item) => ({
          time:
            typeof (item as { publishedAt?: string }).publishedAt === "string"
              ? (item as { publishedAt?: string }).publishedAt as string
              : snapshot?.createdAt.toISOString() ?? new Date().toISOString(),
          assetSymbol: asset.symbol,
          assetName: asset.name,
          type: normalizeSignalLabel(signal.signalType, signal.label),
          typeKey: signalLabelKeyFromType(signal.signalType),
          title: String((item as { title?: string }).title ?? ""),
          ...getLocalizedHighlight(String((item as { title?: string }).title ?? "")),
          summary: Array.isArray(signal.driversJson)
            ? signal.driversJson
              .map(String)
              .slice(0, 2)
              .join("；")
            : `${signal.label}更新`,
          summaryItems: Array.isArray(signal.driversJson)
            ? signal.driversJson
              .map(String)
              .slice(0, 2)
              .map((driver) => getLocalizedDriverItem(driver) ?? null)
            : [],
          direction: toDirection(signal.direction),
          href: normalizeExternalHref(String((item as { href?: string }).href ?? "#")) ?? "",
          score:
            typeof (item as { score?: number }).score === "number"
              ? (item as { score?: number }).score
              : signal.score
        })).filter((item) => item.title);
      })
    );

    const flattened = items
      .flat()
      .sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime());

    return {
      total: flattened.length,
      items: flattened.slice(
        offset,
        typeof limit === "number" ? offset + limit : undefined
      )
    };
  }

  async getLatestKolSignalEvaluations() {
    const snapshots = await this.prisma.assetAnalysisSnapshot.findMany({
      include: {
        asset: true,
        signalSnapshots: {
          where: {
            signalType: "kol"
          },
          include: {
            metrics: {
              orderBy: {
                displayOrder: "asc"
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    const evaluations = new Map<SupportedKolSymbol, KolSignalEvaluation>();

    for (const snapshot of snapshots) {
      const symbol = snapshot.asset.symbol as SupportedKolSymbol;
      if (evaluations.has(symbol)) {
        continue;
      }

      const signal = snapshot.signalSnapshots[0];
      if (!signal) {
        continue;
      }

      evaluations.set(symbol, {
        symbol,
        score: signal.score,
        direction: toDirection(signal.direction),
        biasLevel: scoreToBiasLevel(signal.score),
        confidence: signal.confidence,
        drivers: Array.isArray(signal.driversJson) ? signal.driversJson.map(String) : [],
        metrics: signal.metrics.map((metric) => ({
          name: metric.metricName,
          value: metric.metricValue,
          ...getLocalizedMetric(metric.metricName, metric.metricValue)
        })),
        highlights: Array.isArray(signal.highlightsJson)
          ? signal.highlightsJson.map((item) => ({
              title: String((item as { title?: string }).title ?? ""),
              href: normalizeExternalHref(String((item as { href?: string }).href ?? "#")) ?? "",
              publishedAt:
                typeof (item as { publishedAt?: string }).publishedAt === "string"
                  ? (item as { publishedAt?: string }).publishedAt
                  : undefined,
              score:
                typeof (item as { score?: number }).score === "number"
                  ? (item as { score?: number }).score
                  : undefined,
              ...getLocalizedHighlight(String((item as { title?: string }).title ?? ""))
            }))
          : []
      });
    }

    return evaluations;
  }

  async getRecentSignalHighlights(symbol: string, signalType: string, limit = 10) {
    const snapshots = await this.prisma.assetAnalysisSnapshot.findMany({
      where: {
        asset: {
          symbol
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: Math.max(limit, 20),
      include: {
        signalSnapshots: {
          where: {
            signalType
          },
          take: 1
        }
      }
    });

    const merged = snapshots.flatMap((snapshot) => {
      const signal = snapshot.signalSnapshots[0];
      if (!signal || !Array.isArray(signal.highlightsJson)) {
        return [];
      }

      return signal.highlightsJson.map((item) => ({
        title: String((item as { title?: string }).title ?? ""),
        href: normalizeExternalHref(String((item as { href?: string }).href ?? "#")) ?? "",
        publishedAt:
          typeof (item as { publishedAt?: string }).publishedAt === "string"
            ? (item as { publishedAt?: string }).publishedAt
            : snapshot.createdAt.toISOString(),
        score:
          typeof (item as { score?: number }).score === "number"
            ? (item as { score?: number }).score
            : signal.score
      }));
    });

    return merged
      .filter((item) => item.title)
      .filter((item, index, items) => {
        const key = `${item.title}::${item.publishedAt ?? ""}`;
        return items.findIndex((candidate) => `${candidate.title}::${candidate.publishedAt ?? ""}` === key) === index;
      })
      .slice(0, limit);
  }

  async getRecentMarketTransitions(symbol: string, limit = 10) {
    const snapshots = await this.prisma.assetAnalysisSnapshot.findMany({
      where: {
        asset: {
          symbol
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 200,
      include: {
        signalSnapshots: {
          where: {
            signalType: "market"
          },
          include: {
            metrics: {
              orderBy: {
                displayOrder: "asc"
              }
            }
          },
          take: 1
        }
      }
    });

    const marketSnapshots = snapshots
      .map((snapshot) => ({
        createdAt: snapshot.createdAt.toISOString(),
        signal: snapshot.signalSnapshots[0]
      }))
      .filter((item): item is {
        createdAt: string;
        signal: NonNullable<(typeof snapshots)[number]["signalSnapshots"][number]>;
      } => Boolean(item.signal));

    const transitions: Array<{ title: string; href: string; publishedAt: string; score: number }> = [];

    for (let index = 0; index < marketSnapshots.length - 1; index += 1) {
      const current = marketSnapshots[index];
      const previous = marketSnapshots[index + 1];
      const currentMetrics = new Map(current.signal.metrics.map((metric) => [metric.metricName, metric.metricValue]));
      const previousMetrics = new Map(previous.signal.metrics.map((metric) => [metric.metricName, metric.metricValue]));

      const pushTransition = (title: string) => {
        transitions.push({
          title,
          href: "#",
          publishedAt: current.createdAt,
          score: current.signal.score
        });
      };

      const currentEma = currentMetrics.get("EMA");
      const previousEma = previousMetrics.get("EMA");
      if (currentEma && previousEma && currentEma !== previousEma) {
        pushTransition(`EMA 转为 ${currentEma}`);
      }

      const currentMa = currentMetrics.get("均线");
      const previousMa = previousMetrics.get("均线");
      if (currentMa && previousMa && currentMa !== previousMa) {
        pushTransition(`均线转为 ${currentMa}`);
      }

      const currentMacd = currentMetrics.get("MACD");
      const previousMacd = previousMetrics.get("MACD");
      if (currentMacd && previousMacd && currentMacd !== previousMacd) {
        pushTransition(`MACD 转为 ${currentMacd}`);
      }

      const currentVolume = currentMetrics.get("量能");
      const previousVolume = previousMetrics.get("量能");
      if (currentVolume && previousVolume && currentVolume !== previousVolume) {
        pushTransition(`量能转为 ${currentVolume}`);
      }

      const currentVolatility = currentMetrics.get("波动");
      const previousVolatility = previousMetrics.get("波动");
      if (currentVolatility && previousVolatility && currentVolatility !== previousVolatility) {
        pushTransition(`波动转为 ${currentVolatility}`);
      }
    }

    return transitions
      .filter((item, index, items) => {
        const key = `${item.title}::${item.publishedAt}`;
        return items.findIndex((candidate) => `${candidate.title}::${candidate.publishedAt}` === key) === index;
      })
      .slice(0, limit);
  }

  async getLatestSnapshotBase(symbol: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { symbol },
      include: {
        analysisSnapshots: {
          orderBy: {
            createdAt: "desc"
          },
          take: 1
        }
      }
    });

    if (!asset || asset.analysisSnapshots.length === 0) {
      return null;
    }

    const snapshot = asset.analysisSnapshots[0];
    return {
      assetId: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      window: snapshot.window,
      price: snapshot.priceDisplay,
      priceChange: snapshot.priceChangeDisplay,
      rule: {
        direction: toDirection(snapshot.ruleDirection),
        score: snapshot.ruleScore,
        confidence: snapshot.ruleConfidence,
        risk: snapshot.riskLevel,
        drivers: Array.isArray(snapshot.ruleDriversJson) ? snapshot.ruleDriversJson.map(String) : []
      },
      ai: {
        direction: toDirection(snapshot.aiDirection),
        action: snapshot.aiAction,
        strength: snapshot.aiStrength,
        confidence: snapshot.aiConfidence,
        reasons: Array.isArray(snapshot.aiReasonsJson) ? snapshot.aiReasonsJson.map(String) : [],
        risks: Array.isArray(snapshot.aiRisksJson) ? snapshot.aiRisksJson.map(String) : []
      },
      consistency: snapshot.consistencySummary
    };
  }

  async getSignalWeights(symbol: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { symbol },
      include: {
        ruleStrategyConfig: true
      }
    });

    if (!asset?.ruleStrategyConfig) {
      return new Map<string, number>();
    }

    if (asset.ruleStrategyConfig.templateType !== "custom") {
      return new Map(
        baseTemplates[asset.ruleStrategyConfig.templateType].weights.map((item) => [item.type, item.value])
      );
    }

    if (!Array.isArray(asset.ruleStrategyConfig.weightsJson)) {
      return new Map<string, number>();
    }

    return new Map(
      asset.ruleStrategyConfig.weightsJson.map((item) => [
        String((item as { type?: string }).type ?? ""),
        Number((item as { value?: number }).value ?? 0)
      ])
    );
  }

  async persistLiveAssetDetails(details: PersistedAssetDetail[], minIntervalMs = 8 * 60 * 1000) {
    const symbols = details.map((detail) => detail.symbol);
    const assets = await this.prisma.asset.findMany({
      where: {
        symbol: {
          in: symbols
        }
      },
      include: {
        analysisSnapshots: {
          orderBy: {
            createdAt: "desc"
          },
          take: 1
        }
      }
    });

    const assetBySymbol = new Map(assets.map((asset) => [asset.symbol, asset]));
    const now = new Date();
    let persistedCount = 0;

    for (const detail of details) {
      const asset = assetBySymbol.get(detail.symbol);
      if (!asset) {
        continue;
      }

      const latestSnapshot = asset.analysisSnapshots[0];
      if (latestSnapshot && now.getTime() - latestSnapshot.createdAt.getTime() < minIntervalMs) {
        continue;
      }

      await this.prisma.$transaction(async (tx) => {
        const snapshot = await tx.assetAnalysisSnapshot.create({
          data: {
            assetId: asset.id,
            window: detail.window ?? latestSnapshot?.window ?? "4H",
            priceDisplay: detail.price,
            priceChangeDisplay: detail.priceChange,
            ruleDirection: detail.rule.direction,
            ruleScore: detail.rule.score,
            ruleConfidence: detail.rule.confidence,
            riskLevel: detail.rule.risk,
            ruleDriversJson: detail.rule.drivers,
            aiDirection: detail.ai.direction,
            aiAction: detail.ai.action,
            aiStrength: detail.ai.strength,
            aiConfidence: detail.ai.confidence,
            aiReasonsJson: detail.ai.reasons,
            aiRisksJson: detail.ai.risks,
            consistencySummary: detail.consistency,
            briefNote: detail.briefNote ?? latestSnapshot?.briefNote ?? null,
            updatedAt: now,
            signalSnapshots: {
              create: detail.signals.map((signal) => ({
                signalType: signal.type,
                label: signal.label,
                direction: signal.direction,
                score: signal.score,
                confidence: signal.confidence,
                driversJson: signal.drivers,
                highlightsJson: signal.highlights.map(toStoredHighlight),
                metrics: {
                  create: signal.metrics.map((metric, index) => ({
                    metricName: metric.name,
                    metricValue: metric.value,
                    displayOrder: index
                  }))
                }
              }))
            }
          },
          include: {
            signalSnapshots: true
          }
        });

        for (const signal of detail.signals) {
          for (const highlight of signal.highlights) {
            const fingerprint = createEventFingerprint([
              detail.symbol,
              signal.type,
              highlight.href,
              highlight.title,
              highlight.publishedAt
            ]);

            await tx.event.upsert({
              where: {
                fingerprint
              },
              update: {
                title: highlight.title,
                summary: signal.drivers.slice(0, 2).join("；") || `${signal.label}更新`,
                direction: signal.direction,
                score: highlight.score ?? signal.score,
                occurredAt: highlight.publishedAt ? new Date(highlight.publishedAt) : now,
                sourceRef: highlight.href !== "#" ? highlight.href : null,
                payloadJson: {
                  analysisSnapshotId: snapshot.id,
                  signalType: signal.type,
                  signalLabel: signal.label,
                  signalScore: signal.score,
                  signalConfidence: signal.confidence,
                  drivers: signal.drivers,
                  metrics: signal.metrics,
                  highlight: toStoredHighlight(highlight)
                }
              },
              create: {
                assetId: asset.id,
                fingerprint,
                eventType: signal.type,
                title: highlight.title,
                summary: signal.drivers.slice(0, 2).join("；") || `${signal.label}更新`,
                direction: signal.direction,
                score: highlight.score ?? signal.score,
                occurredAt: highlight.publishedAt ? new Date(highlight.publishedAt) : now,
                sourceRef: highlight.href !== "#" ? highlight.href : null,
                payloadJson: {
                  analysisSnapshotId: snapshot.id,
                  signalType: signal.type,
                  signalLabel: signal.label,
                  signalScore: signal.score,
                  signalConfidence: signal.confidence,
                  drivers: signal.drivers,
                  metrics: signal.metrics,
                  highlight: toStoredHighlight(highlight)
                }
              }
            });
          }
        }
      });
      persistedCount += 1;
    }

    return persistedCount;
  }

  async persistChangedAssetDetails(details: PersistedAssetDetail[]) {
    const symbols = details.map((detail) => detail.symbol);
    const assets = await this.prisma.asset.findMany({
      where: {
        symbol: {
          in: symbols
        }
      },
      include: {
        analysisSnapshots: {
          orderBy: {
            createdAt: "desc"
          },
          take: 1,
          include: {
            signalSnapshots: {
              include: {
                metrics: {
                  orderBy: {
                    displayOrder: "asc"
                  }
                }
              }
            }
          }
        }
      }
    });

    const assetBySymbol = new Map(assets.map((asset) => [asset.symbol, asset]));
    const now = new Date();
    let persistedCount = 0;
    const persistedSymbols: string[] = [];

    for (const detail of details) {
      const asset = assetBySymbol.get(detail.symbol);
      if (!asset) {
        continue;
      }

      const latestSnapshot: LatestSnapshotState | null = asset.analysisSnapshots[0]
        ? {
            id: asset.analysisSnapshots[0].id,
            createdAt: asset.analysisSnapshots[0].createdAt,
            ruleScore: asset.analysisSnapshots[0].ruleScore,
            ruleDirection: toDirection(asset.analysisSnapshots[0].ruleDirection),
            aiDirection: toDirection(asset.analysisSnapshots[0].aiDirection),
            signalSnapshots: asset.analysisSnapshots[0].signalSnapshots.map((signal) => ({
              signalType: signal.signalType,
              direction: toDirection(signal.direction),
              score: signal.score,
              driversJson: signal.driversJson,
              highlightsJson: signal.highlightsJson,
              metricNames: signal.metrics.map((metric) => metric.metricName)
            }))
          }
        : null;

      const shouldPersistSnapshot = this.shouldPersistDetailSnapshot(detail, latestSnapshot);
      let snapshotId = latestSnapshot?.id ?? null;

      await this.persistLatestSignalStates(asset.id, detail, now);

      if (shouldPersistSnapshot) {
        snapshotId = await this.prisma.$transaction(async (tx) => {
          const snapshot = await tx.assetAnalysisSnapshot.create({
            data: {
              assetId: asset.id,
              window: detail.window ?? asset.analysisSnapshots[0]?.window ?? "4H",
              priceDisplay: detail.price,
              priceChangeDisplay: detail.priceChange,
              ruleDirection: detail.rule.direction,
              ruleScore: detail.rule.score,
              ruleConfidence: detail.rule.confidence,
              riskLevel: detail.rule.risk,
              ruleDriversJson: detail.rule.drivers,
              aiDirection: detail.ai.direction,
              aiAction: detail.ai.action,
              aiStrength: detail.ai.strength,
              aiConfidence: detail.ai.confidence,
              aiReasonsJson: detail.ai.reasons,
              aiRisksJson: detail.ai.risks,
              consistencySummary: detail.consistency,
              briefNote: detail.briefNote ?? asset.analysisSnapshots[0]?.briefNote ?? null,
              updatedAt: now,
              signalSnapshots: {
                create: detail.signals.map((signal) => ({
                  signalType: signal.type,
                  label: signal.label,
                  direction: signal.direction,
                  score: signal.score,
                  confidence: signal.confidence,
                  driversJson: signal.drivers,
                  highlightsJson: signal.highlights.map(toStoredHighlight),
                  metrics: {
                    create: signal.metrics.map((metric, index) => ({
                      metricName: metric.name,
                      metricValue: metric.value,
                      displayOrder: index
                    }))
                  }
                }))
              }
            }
          });

          return snapshot.id;
        });
        persistedCount += 1;
        persistedSymbols.push(detail.symbol);
      }

      await this.persistSignalEvents(asset.id, detail, snapshotId, now);
    }

    return {
      persistedCount,
      persistedSymbols
    };
  }

  private async persistSignalEvents(
    assetId: string,
    detail: PersistedAssetDetail,
    snapshotId: string | null,
    now: Date
  ) {
    const latestMarketState = await this.prisma.latestSignalState.findUnique({
      where: {
        assetId_signalType: {
          assetId,
          signalType: "market"
        }
      }
    });
    const shouldPersistMarketEvents = latestMarketState
      ? latestMarketState.lastChangedAt.getTime() === now.getTime()
      : true;

    for (const signal of detail.signals) {
      if (signal.type === "market" && !shouldPersistMarketEvents) {
        continue;
      }

      for (const highlight of signal.highlights) {
        const occurredAt = signal.type === "market" && latestMarketState
          ? latestMarketState.lastChangedAt
          : highlight.publishedAt
            ? new Date(highlight.publishedAt)
            : now;
        const fingerprint = createEventFingerprint([
          detail.symbol,
          signal.type,
          highlight.href,
          highlight.title,
          occurredAt.toISOString()
        ]);

        await this.prisma.event.upsert({
          where: {
            fingerprint
          },
          update: {
            title: highlight.title,
            summary: signal.drivers.slice(0, 2).join("；") || `${signal.label}更新`,
            direction: signal.direction,
            score: highlight.score ?? signal.score,
            occurredAt,
            sourceRef: highlight.href !== "#" ? highlight.href : null,
            payloadJson: {
              ...(snapshotId ? { analysisSnapshotId: snapshotId } : {}),
              signalType: signal.type,
              signalLabel: signal.label,
              signalScore: signal.score,
              signalConfidence: signal.confidence,
              drivers: signal.drivers,
              metrics: signal.metrics,
              highlight: toStoredHighlight(highlight)
            }
          },
          create: {
            assetId,
            fingerprint,
            eventType: signal.type,
            title: highlight.title,
            summary: signal.drivers.slice(0, 2).join("；") || `${signal.label}更新`,
            direction: signal.direction,
            score: highlight.score ?? signal.score,
            occurredAt,
            sourceRef: highlight.href !== "#" ? highlight.href : null,
            payloadJson: {
              ...(snapshotId ? { analysisSnapshotId: snapshotId } : {}),
              signalType: signal.type,
              signalLabel: signal.label,
              signalScore: signal.score,
              signalConfidence: signal.confidence,
              drivers: signal.drivers,
              metrics: signal.metrics,
              highlight: toStoredHighlight(highlight)
            }
          }
        });
      }
    }
  }

  private async persistLatestSignalStates(
    assetId: string,
    detail: PersistedAssetDetail,
    now: Date
  ) {
    for (const signal of detail.signals) {
      const metricsJson = signal.metrics.map((metric) => ({
        name: metric.name,
        value: metric.value
      }));
      const stateJson = signal.type === "market"
        ? toMarketStateJson(signal.metrics)
        : Object.fromEntries(signal.metrics.map((metric) => [metric.name, metric.value]));
      const previous = await this.prisma.latestSignalState.findUnique({
        where: {
          assetId_signalType: {
            assetId,
            signalType: signal.type
          }
        }
      });

      const previousState = previous?.stateJson ?? null;
      const currentStateFingerprint = fingerprintStateJson(stateJson);
      const previousStateFingerprint = fingerprintStateJson(previousState);
      const lastChangedAt = currentStateFingerprint === previousStateFingerprint && previous
        ? previous.lastChangedAt
        : now;

      await this.prisma.latestSignalState.upsert({
        where: {
          assetId_signalType: {
            assetId,
            signalType: signal.type
          }
        },
        update: {
          direction: signal.direction,
          biasLevel: scoreToBiasLevel(signal.score),
          score: signal.score,
          confidence: signal.confidence,
          driversJson: signal.drivers,
          metricsJson,
          stateJson,
          lastChangedAt
        },
        create: {
          assetId,
          signalType: signal.type,
          direction: signal.direction,
          biasLevel: scoreToBiasLevel(signal.score),
          score: signal.score,
          confidence: signal.confidence,
          driversJson: signal.drivers,
          metricsJson,
          stateJson,
          lastChangedAt
        }
      });
    }
  }

  private shouldPersistDetailSnapshot(
    detail: PersistedAssetDetail,
    latestSnapshot: LatestSnapshotState | null
  ) {
    if (!latestSnapshot) {
      return true;
    }

    if (
      detail.rule.direction !== latestSnapshot.ruleDirection ||
      Math.abs(detail.rule.score - latestSnapshot.ruleScore) >= 10
    ) {
      return true;
    }

    const latestSignalMap = new Map(
      latestSnapshot.signalSnapshots.map((signal) => [signal.signalType, signal])
    );

    for (const signal of detail.signals) {
      const latestSignal = latestSignalMap.get(signal.type);
      if (!latestSignal) {
        return true;
      }

      if (this.hasMeaningfulSignalChange(signal, latestSignal)) {
        return true;
      }
    }

    return false;
  }

  private hasMeaningfulSignalChange(
    current: PersistedDetailSignal,
    latest: LatestSnapshotState["signalSnapshots"][number]
  ) {
    if (current.direction !== latest.direction) {
      return true;
    }

    const previousBiasLevel = scoreToBiasLevel(latest.score);
    const currentBiasLevel = scoreToBiasLevel(current.score);
    if (previousBiasLevel !== currentBiasLevel) {
      return true;
    }

    if (Math.abs(current.score - latest.score) >= 8) {
      return true;
    }

    if (current.type === "market") {
      const previousDrivers = Array.isArray(latest.driversJson) ? latest.driversJson.map(String) : [];
      const legacyMetricNames = ["EMA20 / EMA60", "MACD 柱体", "ATR(14)", "成交量比"];
      const latestMetricNames = latest.metricNames;
      if (legacyMetricNames.some((name) => latestMetricNames.includes(name))) {
        return true;
      }

      const previousHighlights = this.readStoredHighlights(latest.highlightsJson);
      const hasLegacyTitles = previousHighlights.some((item) =>
        item.title.includes("4H 成交量为近 20 根均量")
        || item.title.includes("ATR/价格比约")
        || item.title.includes("MACD 死叉结构")
        || item.title.includes("MACD 金叉结构")
      );
      if (hasLegacyTitles) {
        return true;
      }

      return this.fingerprintList(current.drivers) !== this.fingerprintList(previousDrivers);
    }

    const previousHighlights = this.readStoredHighlights(latest.highlightsJson);
    return this.fingerprintHighlights(current.highlights) !== this.fingerprintHighlights(previousHighlights);
  }

  private readStoredHighlights(value: Prisma.JsonValue) {
    if (!Array.isArray(value)) {
      return [] as Array<{ title: string; href: string; publishedAt?: string }>;
    }

    return value.map((item) => ({
      title: String((item as { title?: string }).title ?? ""),
      href: String((item as { href?: string }).href ?? "#"),
      publishedAt:
        typeof (item as { publishedAt?: string }).publishedAt === "string"
          ? (item as { publishedAt?: string }).publishedAt
          : undefined
    }));
  }

  private fingerprintHighlights(
    highlights: Array<{ title: string; href: string; publishedAt?: string }>
  ) {
    return highlights
      .map((item) => `${item.title}|${item.href}|${item.publishedAt ?? ""}`)
      .join("||");
  }

  private fingerprintList(items: string[]) {
    return items.join("||");
  }

  private async getOrCreateTelegramConfigEntity() {
    const current = await this.prisma.systemTelegramConfig.findFirst({
      orderBy: { createdAt: "desc" }
    });

    if (current) {
      return current;
    }

    return this.prisma.systemTelegramConfig.create({
      data: {
        // One-time bootstrap for existing local installs that previously relied on .env.
        botTokenEncrypted: process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "",
        alertChatId: process.env.TELEGRAM_ALERT_CHAT_ID?.trim() ?? "",
        connectionStatus: "unchecked"
      }
    });
  }

  async getStrategyConfig(symbol: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { symbol },
      include: {
        ruleStrategyConfig: true,
        analysisSnapshots: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { signalSnapshots: true }
        }
      }
    });

    if (!asset || !asset.ruleStrategyConfig || asset.analysisSnapshots.length === 0) {
      throw new NotFoundException("Strategy config not found");
    }

    const snapshot = asset.analysisSnapshots[0];
    const strategyWeights = asset.ruleStrategyConfig.templateType !== "custom"
      ? baseTemplates[asset.ruleStrategyConfig.templateType].weights
      : Array.isArray(asset.ruleStrategyConfig.weightsJson)
        ? asset.ruleStrategyConfig.weightsJson.map((item) => ({
            type: String((item as { type?: string }).type ?? ""),
            label: String((item as { label?: string }).label ?? ""),
            value: Number((item as { value?: number }).value ?? 0)
          }))
        : [];
    const sections = await this.prisma.globalConfigSection.findMany({
      orderBy: { createdAt: "asc" }
    });
    const promptTextByLocale = toPromptTextByLocale(
      sections.find((section) => section.sectionKey === "aiPromptStrategy")?.configJson
    );

    return {
      symbol: asset.symbol,
      ruleStrategy: {
        template: asset.ruleStrategyConfig.templateType,
        weights: strategyWeights
      },
      promptStrategy: {
        scope: "global" as const,
        promptText: promptTextByLocale["zh-CN"],
        promptTextByLocale,
        systemPromptText: AiAnalysisService.buildSystemPrompt("zh-CN"),
        systemPromptTextByLocale: {
          "zh-CN": AiAnalysisService.buildSystemPrompt("zh-CN"),
          "en-US": AiAnalysisService.buildSystemPrompt("en-US")
        }
      },
      globalConfigs: {
        sources: toJsonRecord(sections.find((section) => section.sectionKey === "sources")?.configJson),
        onchainWhaleRules: toJsonRecord(
          sections.find((section) => section.sectionKey === "onchainWhaleRules")?.configJson
        ),
        preferences: toJsonRecord(
          sections.find((section) => section.sectionKey === "preferences")?.configJson
        ),
        alertRules: toJsonRecord(
          sections.find((section) => section.sectionKey === "alertRules")?.configJson
        )
      },
      preview: this.buildStrategyPreview(snapshot, strategyWeights)
    };
  }

  async updateRuleTemplate(symbol: string, template: RuleTemplateType, weightsJson?: Prisma.JsonArray) {
    const asset = await this.prisma.asset.findUnique({ where: { symbol } });

    if (!asset) {
      throw new NotFoundException("Asset not found");
    }

    await this.prisma.ruleStrategyConfig.update({
      where: { assetId: asset.id },
      data: {
        templateType: template,
        ...(weightsJson ? { weightsJson } : {})
      }
    });

    return this.getStrategyConfig(symbol);
  }

  async updateRuleWeights(symbol: string, weights: StrategyWeightInput[]) {
    const asset = await this.prisma.asset.findUnique({ where: { symbol } });

    if (!asset) {
      throw new NotFoundException("Asset not found");
    }

    const normalizedWeights = this.normalizeStrategyWeights(weights);

    await this.prisma.ruleStrategyConfig.update({
      where: { assetId: asset.id },
      data: {
        templateType: "custom",
        weightsJson: normalizedWeights as unknown as Prisma.JsonArray
      }
    });

    return this.getStrategyConfig(symbol);
  }

  async updatePrompt(promptText: string) {
    const currentSection = await this.prisma.globalConfigSection.findUnique({
      where: {
        sectionKey: "aiPromptStrategy"
      }
    });
    const currentPromptTextByLocale = toPromptTextByLocale(currentSection?.configJson);

    const updated = await this.prisma.globalConfigSection.upsert({
      where: {
        sectionKey: "aiPromptStrategy"
      },
      update: {
        title: "全局 AI 提示策略",
        configJson: {
          promptText,
          promptTextByLocale: {
            ...currentPromptTextByLocale,
            "zh-CN": promptText
          }
        }
      },
      create: {
        sectionKey: "aiPromptStrategy",
        title: "全局 AI 提示策略",
        configJson: {
          promptText,
          promptTextByLocale: {
            ...defaultGlobalAiPromptByLocale,
            "zh-CN": promptText
          }
        }
      }
    });

    const promptTextByLocale = toPromptTextByLocale(updated.configJson);

    return {
      scope: "global" as const,
      promptText: toPromptText(updated.configJson) ?? defaultGlobalAiPrompt,
      promptTextByLocale
    };
  }

  async getSources() {
    const items = await this.prisma.sourceConfig.findMany({
      orderBy: { createdAt: "asc" }
    });

    return items.map((item) => ({
      key: item.configKey,
      type: item.sourceType,
      source: item.sourceName,
      status: item.status,
      coverage: item.coverage
    }));
  }

  async updateSource(
    key: string,
    payload: { source?: string; status?: string; coverage?: string }
  ) {
    const existing = await this.prisma.sourceConfig.findUnique({
      where: { configKey: key }
    });

    if (!existing) {
      throw new NotFoundException("Source config not found");
    }

    return this.prisma.sourceConfig.update({
      where: { configKey: key },
      data: {
        ...(payload.source ? { sourceName: payload.source } : {}),
        ...(payload.status ? { status: payload.status } : {}),
        ...(payload.coverage ? { coverage: payload.coverage } : {})
      }
    }).then((item) => ({
      key: item.configKey,
      type: item.sourceType,
      source: item.sourceName,
      status: item.status,
      coverage: item.coverage
    }));
  }

  async getAiConfig() {
    const config = await this.prisma.systemAiConfig.findFirst({
      orderBy: { createdAt: "desc" }
    });

    if (!config) {
      throw new NotFoundException("AI config not found");
    }

    return {
      model: config.model,
      provider: config.provider,
      baseUrl: config.baseUrl,
      apiKeyMasked: this.maskApiKey(config.apiKeyEncrypted),
      connectionStatus: config.connectionStatus
    };
  }

  async getTelegramConfig() {
    const sections = await this.prisma.globalConfigSection.findMany({
      where: {
        sectionKey: {
          in: ["preferences"]
        }
      }
    });
    const preferences = toJsonRecord(sections.find((section) => section.sectionKey === "preferences")?.configJson);
    const telegramConfig = await this.getOrCreateTelegramConfigEntity();
    const botToken = telegramConfig.botTokenEncrypted.trim();
    const alertChatId = telegramConfig.alertChatId.trim();
    const notificationChannel = preferences.notification ?? "";
    const connectionStatus = telegramConfig.connectionStatus ?? "unchecked";

    return {
      botTokenMasked: this.maskApiKey(botToken),
      alertChatIdMasked: alertChatId ? `${alertChatId.slice(0, 4)}***${alertChatId.slice(-2)}` : "未配置",
      notificationChannel,
      alertsEnabled: notificationChannel.toLowerCase().includes("telegram") && Boolean(botToken) && Boolean(alertChatId),
      connectionStatus
    };
  }

  async updateTelegramConfig(payload: { notificationChannel: string; botToken: string; alertChatId: string }) {
    const currentSection = await this.prisma.globalConfigSection.findUnique({
      where: {
        sectionKey: "preferences"
      }
    });
    const currentPreferences = toJsonRecord(currentSection?.configJson);
    const currentTelegramConfig = await this.getOrCreateTelegramConfigEntity();
    const nextBotToken = payload.botToken.trim() || currentTelegramConfig.botTokenEncrypted.trim();
    const nextAlertChatId = payload.alertChatId.trim() || currentTelegramConfig.alertChatId.trim();

    await this.prisma.globalConfigSection.upsert({
      where: {
        sectionKey: "preferences"
      },
      update: {
        title: currentSection?.title ?? "偏好设置",
        configJson: {
          ...currentPreferences,
          notification: payload.notificationChannel.trim()
        }
      },
      create: {
        sectionKey: "preferences",
        title: "偏好设置",
        configJson: {
          ...currentPreferences,
          notification: payload.notificationChannel.trim()
        }
      }
    });

    await this.prisma.systemTelegramConfig.update({
      where: {
        id: currentTelegramConfig.id
      },
      data: {
        botTokenEncrypted: nextBotToken,
        alertChatId: nextAlertChatId,
        connectionStatus: "unchecked",
        lastCheckedAt: null
      }
    });

    return this.getTelegramConfig();
  }

  async updateLanguagePreference(language: string) {
    const currentSection = await this.prisma.globalConfigSection.findUnique({
      where: {
        sectionKey: "preferences"
      }
    });
    const currentPreferences = toJsonRecord(currentSection?.configJson);

    await this.prisma.globalConfigSection.upsert({
      where: {
        sectionKey: "preferences"
      },
      update: {
        title: currentSection?.title ?? "偏好设置",
        configJson: {
          ...currentPreferences,
          language: language.trim()
        }
      },
      create: {
        sectionKey: "preferences",
        title: "偏好设置",
        configJson: {
          ...currentPreferences,
          language: language.trim()
        }
      }
    });

    return {
      language: language.trim()
    };
  }

  async updateTelegramConnectionStatus(connectionStatus: string) {
    const current = await this.getOrCreateTelegramConfigEntity();

    return this.prisma.systemTelegramConfig.update({
      where: {
        id: current.id
      },
      data: {
        connectionStatus,
        lastCheckedAt: new Date()
      }
    });
  }

  async testTelegramConfig() {
    const config = await this.getOrCreateTelegramConfigEntity();
    const currentSection = await this.prisma.globalConfigSection.findUnique({
      where: {
        sectionKey: "preferences"
      }
    });
    const preferences = toJsonRecord(currentSection?.configJson);
    const locale = typeof preferences.language === "string" && preferences.language.trim().toLowerCase() === "en-us"
      ? "en-US"
      : "zh-CN";
    const token = config.botTokenEncrypted.trim();
    const chatId = config.alertChatId.trim();

    if (!token || !chatId) {
      await this.updateTelegramConnectionStatus("missing_config");
      return {
        success: false,
        connectionStatus: "missing_config",
        message: "缺少 Bot Token 或 Alert Chat ID"
      };
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: locale === "en-US" ? "AlphaPony Telegram connection test" : "AlphaPony Telegram 连通测试",
          disable_web_page_preview: true
        })
      });

      const connectionStatus = response.ok ? "ok" : "error";
      const details = response.ok ? "" : await response.text().catch(() => "");
      await this.updateTelegramConnectionStatus(connectionStatus);

      return {
        success: response.ok,
        connectionStatus,
        statusCode: response.status,
        message: toReadableErrorMessage(details)
      };
    } catch (error) {
      await this.updateTelegramConnectionStatus("error");
      return {
        success: false,
        connectionStatus: "error",
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async updateAiConfig(payload: { model: string; provider: string; baseUrl: string; apiKey: string }) {
    const current = await this.prisma.systemAiConfig.findFirst({
      orderBy: { createdAt: "desc" }
    });

    if (!current) {
      throw new NotFoundException("AI config not found");
    }

    return this.prisma.systemAiConfig.update({
      where: { id: current.id },
      data: {
        model: payload.model,
        provider: payload.provider,
        baseUrl: payload.baseUrl,
        apiKeyEncrypted: payload.apiKey.trim() ? payload.apiKey.trim() : current.apiKeyEncrypted,
        connectionStatus: "unchecked"
      }
    }).then((config) => ({
      model: config.model,
      provider: config.provider,
      baseUrl: config.baseUrl,
      apiKeyMasked: this.maskApiKey(config.apiKeyEncrypted),
      connectionStatus: config.connectionStatus
    }));
  }

  async getAiRuntimeConfig(): Promise<RuntimeAiConfig> {
    const current = await this.prisma.systemAiConfig.findFirst({
      orderBy: { createdAt: "desc" }
    });

    if (!current) {
      throw new NotFoundException("AI config not found");
    }

    const apiKey = this.looksMaskedApiKey(current.apiKeyEncrypted)
      ? ""
      : current.apiKeyEncrypted.trim();

    return {
      model: current.model,
      provider: current.provider,
      baseUrl: current.baseUrl,
      apiKey
    };
  }

  async updateAiConnectionStatus(connectionStatus: string) {
    const current = await this.prisma.systemAiConfig.findFirst({
      orderBy: { createdAt: "desc" }
    });

    if (!current) {
      throw new NotFoundException("AI config not found");
    }

    return this.prisma.systemAiConfig.update({
      where: { id: current.id },
      data: {
        connectionStatus,
        lastCheckedAt: new Date()
      }
    });
  }

  async getGlobalPrompt() {
    const section = await this.prisma.globalConfigSection.findUnique({
      where: {
        sectionKey: "aiPromptStrategy"
      }
    });

    return {
      scope: "global" as const,
      promptText: toPromptText(section?.configJson) ?? defaultGlobalAiPrompt,
      promptTextByLocale: toPromptTextByLocale(section?.configJson)
    };
  }

  async testAiConfig() {
    const current = await this.getAiRuntimeConfig();

    if (!current.apiKey) {
      await this.updateAiConnectionStatus("missing_api_key");
      return {
        success: false,
        connectionStatus: "missing_api_key",
        message: "缺少 API Key"
      };
    }

    try {
      const response = await fetch(`${current.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${current.apiKey}`
        },
        body: JSON.stringify({
          model: current.model,
          temperature: 0.1,
          max_tokens: 32,
          messages: [
            {
              role: "system",
              content: "Return a short plain text reply."
            },
            {
              role: "user",
              content: "Reply with OK only."
            }
          ]
        })
      });

      const connectionStatus = response.ok ? "ok" : "error";
      const details = response.ok ? "" : await response.text().catch(() => "");
      await this.updateAiConnectionStatus(connectionStatus);

      return {
        success: response.ok,
        connectionStatus,
        statusCode: response.status,
        message: toReadableErrorMessage(details)
      };
    } catch (error) {
      await this.updateAiConnectionStatus("error");
      return {
        success: false,
        connectionStatus: "error",
        message: error instanceof Error ? error.message : "AI config test failed"
      };
    }
  }

  async updateGlobalConfig(section: string, config: Record<string, string>) {
    const updated = await this.prisma.globalConfigSection.update({
      where: { sectionKey: section },
      data: {
        configJson: config
      }
    });

    return {
      section: updated.sectionKey,
      config: toJsonRecord(updated.configJson)
    };
  }

  private normalizeStrategyWeights(weights: StrategyWeightInput[]) {
    const fallbackWeights = baseTemplates.custom.weights;
    const byType = new Map(
      weights.map((item) => [
        item.type,
        {
          type: item.type,
          label: item.label,
          value: Number.isFinite(item.value) ? Math.max(0, item.value) : 0
        }
      ])
    );
    const ordered = fallbackWeights.map((item) => byType.get(item.type) ?? item);
    const total = ordered.reduce((sum, item) => sum + item.value, 0);

    if (total <= 0) {
      return fallbackWeights;
    }

    let remaining = 100;
    return ordered.map((item, index) => {
      const normalizedValue = index === ordered.length - 1
        ? remaining
        : Math.round((item.value / total) * 100);
      remaining -= normalizedValue;

      return {
        type: item.type,
        label: item.label,
        value: normalizedValue
      };
    });
  }

  private buildStrategyPreview(
    snapshot: {
      ruleScore: number;
      ruleDirection: Direction;
      aiDirection: Direction;
      signalSnapshots: Array<{
        signalType: string;
        score: number;
        direction: Direction;
      }>;
    },
    weights: StrategyWeightInput[]
  ) {
    const normalizedWeights = this.normalizeStrategyWeights(weights);
    const weightsByType = new Map(normalizedWeights.map((item) => [item.type, item.value]));
    const signalScores = snapshot.signalSnapshots.length > 0
      ? snapshot.signalSnapshots.map((signal) => {
          const weightedScore = Math.round((signal.score * (weightsByType.get(signal.signalType) ?? 0)) / 100);

          return {
            type: signal.signalType,
            score: signal.score,
            weightedScore,
            direction: directionFromScore(weightedScore),
            biasLevel: scoreToBiasLevel(weightedScore)
          };
        })
      : fallbackSignalScores(snapshot.ruleScore).map((signal) => {
          const weightedScore = Math.round((signal.score * (weightsByType.get(signal.type) ?? 0)) / 100);

          return {
            ...signal,
            weightedScore,
            direction: directionFromScore(weightedScore),
            biasLevel: scoreToBiasLevel(weightedScore)
          };
        });
    const ruleScore = signalScores.reduce((sum, signal) => sum + (signal.weightedScore ?? 0), 0);

    return {
      ruleScore,
      ruleDirection: directionFromScore(ruleScore),
      aiDirection: toDirection(snapshot.aiDirection),
      signalScores
    };
  }
}
