import type { AssetDetail } from "@/lib/api-types";
import type { LocaleCode } from "@/lib/i18n/config";

export function formatAiAction(ai: AssetDetail["ai"], locale: LocaleCode) {
  switch (ai.actionKey) {
    case "aggressive_long":
      return locale === "en-US" ? "Aggressive Long" : "积极做多";
    case "follow_bullish":
      return locale === "en-US" ? "Follow Bullish" : "偏多跟随";
    case "probe_long":
      return locale === "en-US" ? "Probe Long" : "轻仓试多";
    case "probe_short":
      return locale === "en-US" ? "Probe Short" : "轻仓试空";
    case "defensive_bearish":
      return locale === "en-US" ? "Defensive Bearish" : "偏空防守";
    case "aggressive_defense":
      return locale === "en-US" ? "Aggressive Defense" : "积极防守";
    case "standby":
      return locale === "en-US" ? "Stand By" : "暂不操作";
    default:
      return ai.action ?? "";
  }
}

export function formatAiStrength(ai: AssetDetail["ai"], locale: LocaleCode) {
  switch (ai.strengthKey) {
    case "high":
      return locale === "en-US" ? "High" : "强";
    case "medium":
      return locale === "en-US" ? "Medium" : "中";
    case "low":
      return locale === "en-US" ? "Low" : "弱";
    default:
      return ai.strength ?? "";
  }
}

export function formatAiConfidence(ai: AssetDetail["ai"], locale: LocaleCode) {
  switch (ai.confidenceKey) {
    case "high":
      return locale === "en-US" ? "High" : "高";
    case "medium":
      return locale === "en-US" ? "Medium" : "中";
    case "low":
      return locale === "en-US" ? "Low" : "低";
    default:
      return ai.confidence ?? "";
  }
}

export function getAiSummaryText(ai: AssetDetail["ai"], locale: LocaleCode) {
  return ai.localizedText?.summaryByLocale[locale]
    ?? ai.localizedText?.summaryByLocale["zh-CN"]
    ?? ai.summary
    ?? "";
}

export function getAiReasonsText(ai: AssetDetail["ai"], locale: LocaleCode) {
  return ai.localizedText?.reasonsByLocale[locale]
    ?? ai.localizedText?.reasonsByLocale["zh-CN"]
    ?? ai.reasons;
}

export function getAiRisksText(ai: AssetDetail["ai"], locale: LocaleCode) {
  return ai.localizedText?.risksByLocale[locale]
    ?? ai.localizedText?.risksByLocale["zh-CN"]
    ?? ai.risks;
}
