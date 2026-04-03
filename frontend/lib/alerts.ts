import type { AlertsResponse, AssetDetail } from "@/lib/api-types";
import type { Dictionary } from "@/lib/i18n";
import type { LocaleCode } from "@/lib/i18n/config";
import { biasLevelLabel, scoreToBiasLevel, signalLabel } from "./format";

type AlertLike = AlertsResponse["items"][number] | AssetDetail["alerts"][number];

type ParsedAlert = {
  main: string;
  price: string | null;
  priceChange: string | null;
};

export type AlertSeverity = "high" | "medium" | "low";

function formatSignedScore(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanPrice(value: string | null) {
  if (!value) {
    return null;
  }

  return value.trim().replace(/^\$+/, "$");
}

function normalizeLegacyPunctuation(value: string) {
  return value.replace(/（/g, "(").replace(/）/g, ")");
}

function normalizeSignedScore(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (/^[+-]?\d+$/.test(trimmed)) {
    const numeric = Number(trimmed);
    return numeric > 0 ? `+${numeric}` : String(numeric);
  }

  return trimmed.replace(/\(\+\+/g, "(+");
}

function translateBiasText(text: string, locale: LocaleCode) {
  if (locale !== "en-US") {
    return text;
  }

  switch (text.trim()) {
    case "超级偏多":
      return "Super Bullish";
    case "强偏多":
      return "Strong Bullish";
    case "弱偏多":
      return "Weak Bullish";
    case "观望":
      return "Watch";
    case "弱偏空":
      return "Weak Bearish";
    case "强偏空":
      return "Strong Bearish";
    case "超级偏空":
      return "Super Bearish";
    default:
      return text;
  }
}

function asStringList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item)).filter(Boolean);
      }
    } catch {
      return [value.trim()];
    }
  }

  return null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function fallbackSummary(summary: string) {
  const match = summary.match(/^(.*?)(?:\s*当前价格\s+(.+?)，24H 涨跌\s+(.+?)。)?$/);

  if (!match) {
    return { main: summary, price: null, priceChange: null };
  }

  return {
    main: match[1]?.trim() || summary,
    price: cleanPrice(match[2]?.trim() || null),
    priceChange: match[3]?.trim() || null
  };
}

function parseLegacyAlertSummary(summary: string, locale: LocaleCode): ParsedAlert | null {
  const thresholdMatch = summary.match(/^([A-Z0-9]+)\s+当前规则分达到\s+([+-]?\d+)，触发(偏多|偏空)阈值\s+([+-]?\d+)。(?:\s*当前价格\s+(.+?)，24H 涨跌\s+(.+?)。)?$/);
  if (thresholdMatch) {
    const [, symbol, ruleScore, direction, threshold, price, priceChange] = thresholdMatch;
    return {
      main: locale === "en-US"
        ? `${symbol} rule score reached ${normalizeSignedScore(ruleScore)}, triggering the ${direction === "偏空" ? "bearish" : "bullish"} threshold ${threshold}.`
        : `${symbol} 当前规则分达到 ${ruleScore}，触发${direction}阈值 ${threshold}。`,
      price: cleanPrice(price ?? null),
      priceChange: priceChange ?? null
    };
  }

  const directionSwitchMatch = summary.match(/^([A-Z0-9]+)\s+总信号由(.+?)（([+-]?\d+)）切换为(.+?)（([+-]?\d+)）。(?:\s*当前价格\s+(.+?)，24H 涨跌\s+(.+?)。)?$/);
  if (directionSwitchMatch) {
    const [, symbol, previousLabel, previousScore, currentLabel, currentScore, price, priceChange] = directionSwitchMatch;
    return {
      main: locale === "en-US"
        ? `${symbol} overall signal changed from ${translateBiasText(previousLabel, locale)} (${normalizeSignedScore(previousScore)}) to ${translateBiasText(currentLabel, locale)} (${normalizeSignedScore(currentScore)}).`
        : `${symbol} 总信号由${previousLabel}（${previousScore}）切换为${currentLabel}（${currentScore}）。`,
      price: cleanPrice(price ?? null),
      priceChange: priceChange ?? null
    };
  }

  const aiSwitchMatch = summary.match(/^([A-Z0-9]+)\s+AI 判断由(.+?)切换为(.+?)。(?:\s*当前价格\s+(.+?)，24H 涨跌\s+(.+?)。)?$/);
  if (aiSwitchMatch) {
    const [, symbol, previousDirection, currentDirection, price, priceChange] = aiSwitchMatch;
    return {
      main: locale === "en-US"
        ? `${symbol} AI view switched from ${previousDirection} to ${currentDirection}.`
        : `${symbol} AI 判断由${previousDirection}切换为${currentDirection}。`,
      price: cleanPrice(price ?? null),
      priceChange: priceChange ?? null
    };
  }

  const resonanceMatch = summary.match(/^([A-Z0-9]+)\s+(.+?)\s+同时强(偏多|偏空)，形成多信号共振。整体信号\s+(.+?)（([+-]?\d+)）。(?:\s*当前价格\s+(.+?)，24H 涨跌\s+(.+?)。)?$/);
  if (resonanceMatch) {
    const [, symbol, signalLabels, direction, overallLabel, overallScore, price, priceChange] = resonanceMatch;
    return {
      main: locale === "en-US"
        ? `${symbol} ${signalLabels} aligned strongly ${direction === "偏空" ? "bearish" : "bullish"}, forming signal resonance. Overall signal ${translateBiasText(overallLabel, locale)} (${normalizeSignedScore(overallScore)}).`
        : `${symbol} ${signalLabels} 同时强${direction}，形成多信号共振。整体信号 ${overallLabel}（${overallScore}）。`,
      price: cleanPrice(price ?? null),
      priceChange: priceChange ?? null
    };
  }

  return null;
}

function inferAlertTypeKey(alert: AlertLike) {
  if (alert.typeKey) {
    return alert.typeKey;
  }

  const alertKey = asString(alert.summaryParams?.alertKey);
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

export function inferAlertSeverity(alert: AlertLike): AlertSeverity {
  if ("severity" in alert && alert.severity) {
    return alert.severity;
  }

  switch (inferAlertTypeKey(alert)) {
    case "rule_threshold":
      return "high";
    case "rule_direction_switch":
    case "ai_switch":
      return "medium";
    case "signal_resonance":
    default:
      return "low";
  }
}

export function formatAlertSeverity(alert: AlertLike, locale: LocaleCode) {
  switch (inferAlertSeverity(alert)) {
    case "high":
      return "🔴";
    case "medium":
      return "🟠";
    case "low":
    default:
      return "";
  }
}

function inferAlertSummaryKey(alert: AlertLike) {
  if (alert.summaryKey) {
    return alert.summaryKey;
  }

  const alertKey = asString(alert.summaryParams?.alertKey);
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

export function formatAlertType(alert: AlertLike, locale: LocaleCode) {
  switch (inferAlertTypeKey(alert)) {
    case "rule_threshold":
      return locale === "en-US" ? "Rule Threshold" : "规则分阈值";
    case "ai_switch":
      return locale === "en-US" ? "AI Switch" : "AI 方向切换";
    case "rule_direction_switch":
      return locale === "en-US" ? "Rule Direction Switch" : "总信号方向切换";
    case "signal_resonance":
      return locale === "en-US" ? "Signal Resonance" : "多信号共振";
    default:
      return alert.type;
  }
}

export function formatAlertSummary(alert: AlertLike, locale: LocaleCode, _dict: Dictionary): ParsedAlert {
  const params = alert.summaryParams ?? {};
  const symbol = asString(params.symbol) ?? ("asset" in alert ? asString(alert.asset) : null);
  const price = asString(params.price);
  const priceChange = asString(params.priceChange24h);
  const summaryKey = inferAlertSummaryKey(alert);

  if (!summaryKey) {
    return parseLegacyAlertSummary(alert.summary, locale) ?? fallbackSummary(alert.summary);
  }

  switch (summaryKey) {
    case "alerts.ruleThresholdBullish":
    case "alerts.ruleThresholdBearish": {
      const ruleScore = asNumber(params.ruleScore);
      const threshold = asNumber(params.threshold);
      const direction = params.direction === "bearish"
        ? (locale === "en-US" ? "bearish" : "偏空")
        : (locale === "en-US" ? "bullish" : "偏多");

      if (symbol && ruleScore !== null && threshold !== null) {
        return {
          main: locale === "en-US"
            ? `${symbol} rule score reached ${formatSignedScore(ruleScore)}, triggering the ${direction} threshold ${threshold}.`
            : `${symbol} 当前规则分达到 ${formatSignedScore(ruleScore)}，触发${direction}阈值 ${threshold}。`,
          price: cleanPrice(price),
          priceChange
        };
      }
      break;
    }
    case "alerts.aiSwitch": {
      const previousDirection = asString(params.previousDirection);
      const currentDirection = asString(params.currentDirection);

      if (symbol && previousDirection && currentDirection) {
        return {
          main: locale === "en-US"
            ? `${symbol} AI view switched from ${previousDirection} to ${currentDirection}.`
            : `${symbol} AI 判断由${previousDirection}切换为${currentDirection}。`,
          price: cleanPrice(price),
          priceChange
        };
      }
      break;
    }
    case "alerts.ruleDirectionSwitch": {
      const previousRuleScore = asNumber(params.previousRuleScore);
      const currentRuleScore = asNumber(params.currentRuleScore);

      if (symbol && previousRuleScore !== null && currentRuleScore !== null) {
        const previousLabel = biasLevelLabel(scoreToBiasLevel(previousRuleScore), locale);
        const currentLabel = biasLevelLabel(scoreToBiasLevel(currentRuleScore), locale);

        return {
          main: locale === "en-US"
            ? `${symbol} overall signal changed from ${previousLabel} (${formatSignedScore(previousRuleScore)}) to ${currentLabel} (${formatSignedScore(currentRuleScore)}).`
            : `${symbol} 总信号由${previousLabel}（${formatSignedScore(previousRuleScore)}）切换为${currentLabel}（${formatSignedScore(currentRuleScore)}）。`,
          price: cleanPrice(price),
          priceChange
        };
      }
      break;
    }
    case "alerts.signalResonanceBullish":
    case "alerts.signalResonanceBearish": {
      const signalTypes = asStringList(params.signalTypes);
      const signalLabels = signalTypes?.length
        ? signalTypes.map((type) => signalLabel(type, locale, type)).join(locale === "en-US" ? ", " : "、")
        : asStringList(params.signalLabels)?.join(locale === "en-US" ? ", " : "、");
      const ruleScore = asNumber(params.ruleScore);
      const direction = params.direction === "bearish"
        ? (locale === "en-US" ? "bearish" : "偏空")
        : (locale === "en-US" ? "bullish" : "偏多");

      if (symbol) {
        const overall = ruleScore !== null
          ? `${biasLevelLabel(scoreToBiasLevel(ruleScore), locale)}${locale === "en-US" ? ` (${formatSignedScore(ruleScore)})` : `（${formatSignedScore(ruleScore)}）`}`
          : null;

        return {
          main: locale === "en-US"
            ? `${symbol} ${signalLabels ?? "multiple signals"} aligned strongly ${direction}, forming signal resonance.${overall ? ` Overall signal ${overall}.` : ""}`
            : `${symbol} ${signalLabels ?? "多个信号"} 同时强${direction}，形成多信号共振。${overall ? `整体信号 ${overall}。` : ""}`,
          price: cleanPrice(price),
          priceChange
        };
      }
      break;
    }
    default:
      break;
  }

  const fallback = fallbackSummary(alert.summary);
  const parsedLegacy = parseLegacyAlertSummary(alert.summary, locale);
  if (parsedLegacy) {
    return {
      main: locale === "en-US" ? normalizeLegacyPunctuation(parsedLegacy.main) : parsedLegacy.main,
      price: parsedLegacy.price ?? cleanPrice(price),
      priceChange: parsedLegacy.priceChange ?? priceChange
    };
  }

  return {
    main: locale === "en-US" ? normalizeLegacyPunctuation(fallback.main) : fallback.main,
    price: fallback.price ?? cleanPrice(price),
    priceChange: fallback.priceChange ?? priceChange
  };
}
