import { Injectable, Logger } from "@nestjs/common";
import { AlertStatus, Direction } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import type { LatestSnapshotState, PersistedAssetDetail } from "../database/app-data.service";

type AlertingConfig = {
  scoreThresholdBullish: number;
  scoreThresholdBearish: number;
  aiSwitchReminderEnabled: boolean;
  cooldownMinutes: number;
  notificationChannel: string;
  locale: "zh-CN" | "en-US";
};

type AlertCandidate = {
  assetId: string;
  symbol: string;
  type: string;
  typeKey: string;
  summary: string;
  summaryKey: string;
  alertKey: string;
  triggeredAt: Date;
  payload: Record<string, unknown>;
};

type AlertSeverity = "high" | "medium" | "low";

function normalizeMoneyString(value: string) {
  return value.trim().replace(/^\$+/, "$");
}

@Injectable()
export class AlertingService {
  private readonly logger = new Logger(AlertingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async evaluateAndDispatch(params: {
    assetId: string;
    symbol: string;
    detail: PersistedAssetDetail;
    latestSnapshot: LatestSnapshotState | null;
    now: Date;
  }) {
    const config = await this.getAlertingConfig();
    const candidates = this.buildCandidates({
      ...params,
      config
    });

    let createdCount = 0;

    for (const candidate of candidates) {
      const recentAlert = await this.findRecentMatchingAlert(
        candidate.assetId,
        candidate.type,
        candidate.alertKey,
        config.cooldownMinutes,
        candidate.triggeredAt
      );

      if (recentAlert) {
        continue;
      }

      const created = await this.prisma.alert.create({
        data: {
          assetId: candidate.assetId,
          alertType: candidate.type,
          summary: candidate.summary,
          status: AlertStatus.new,
          triggeredAt: candidate.triggeredAt,
          payloadJson: {
            alertKey: candidate.alertKey,
            typeKey: candidate.typeKey,
            summaryKey: candidate.summaryKey,
            ...candidate.payload
          }
        }
      });

      createdCount += 1;

      if (config.notificationChannel.toLowerCase().includes("telegram")) {
        const delivered = await this.sendTelegramAlert(candidate, config.locale);
        if (delivered) {
          await this.prisma.alert.update({
            where: { id: created.id },
            data: { status: AlertStatus.sent }
          });
        }
      }
    }

    return createdCount;
  }

  private buildCandidates(params: {
    assetId: string;
    symbol: string;
    detail: PersistedAssetDetail;
    latestSnapshot: LatestSnapshotState | null;
    now: Date;
    config: AlertingConfig;
  }) {
    const { assetId, symbol, detail, latestSnapshot, now, config } = params;
    const candidates: AlertCandidate[] = [];
    const strongBullishSignals = detail.signals.filter((signal) => signal.score >= 45);
    const strongBearishSignals = detail.signals.filter((signal) => signal.score <= -45);

    if (detail.rule.score >= config.scoreThresholdBullish) {
      candidates.push({
        assetId,
        symbol,
        type: "规则分阈值",
        typeKey: "rule_threshold",
        summary: this.withMarketContext(
          `${symbol} 当前规则分达到 ${detail.rule.score > 0 ? `+${detail.rule.score}` : detail.rule.score}，触发偏多阈值 ${config.scoreThresholdBullish}。`,
          detail
        ),
        summaryKey: "alerts.ruleThresholdBullish",
        alertKey: "rule-threshold-bullish",
        triggeredAt: now,
        payload: {
          symbol,
          direction: "bullish",
          ruleScore: detail.rule.score,
          ruleDirection: detail.rule.direction,
          threshold: config.scoreThresholdBullish,
          price: normalizeMoneyString(detail.price),
          priceChange24h: detail.priceChange
        }
      });
    }

    if (detail.rule.score <= config.scoreThresholdBearish) {
      candidates.push({
        assetId,
        symbol,
        type: "规则分阈值",
        typeKey: "rule_threshold",
        summary: this.withMarketContext(
          `${symbol} 当前规则分达到 ${detail.rule.score}，触发偏空阈值 ${config.scoreThresholdBearish}。`,
          detail
        ),
        summaryKey: "alerts.ruleThresholdBearish",
        alertKey: "rule-threshold-bearish",
        triggeredAt: now,
        payload: {
          symbol,
          direction: "bearish",
          ruleScore: detail.rule.score,
          ruleDirection: detail.rule.direction,
          threshold: config.scoreThresholdBearish,
          price: normalizeMoneyString(detail.price),
          priceChange24h: detail.priceChange
        }
      });
    }

    if (
      config.aiSwitchReminderEnabled
      && latestSnapshot
      && latestSnapshot.aiDirection !== detail.ai.direction
    ) {
      candidates.push({
        assetId,
        symbol,
        type: "AI 方向切换",
        typeKey: "ai_switch",
        summary: this.withMarketContext(
          `${symbol} AI 判断由${this.directionLabel(latestSnapshot.aiDirection)}切换为${this.directionLabel(detail.ai.direction)}。`,
          detail
        ),
        summaryKey: "alerts.aiSwitch",
        alertKey: `ai-switch-${latestSnapshot.aiDirection}-to-${detail.ai.direction}`,
        triggeredAt: now,
        payload: {
          symbol,
          previousDirection: latestSnapshot.aiDirection,
          currentDirection: detail.ai.direction,
          action: detail.ai.action,
          price: normalizeMoneyString(detail.price),
          priceChange24h: detail.priceChange
        }
      });
    }

    if (
      latestSnapshot
      && latestSnapshot.ruleDirection !== detail.rule.direction
      && Math.abs(detail.rule.score - latestSnapshot.ruleScore) > 20
    ) {
      candidates.push({
        assetId,
        symbol,
        type: "总信号方向切换",
        typeKey: "rule_direction_switch",
        summary: this.withMarketContext(
          `${symbol} 总信号由${this.biasLevelLabelFromScore(latestSnapshot.ruleScore)}（${this.formatSignedScore(latestSnapshot.ruleScore)}）切换为${this.biasLevelLabelFromScore(detail.rule.score)}（${this.formatSignedScore(detail.rule.score)}）。`,
          detail
        ),
        summaryKey: "alerts.ruleDirectionSwitch",
        alertKey: `rule-direction-switch-${latestSnapshot.ruleDirection}-to-${detail.rule.direction}`,
        triggeredAt: now,
        payload: {
          symbol,
          previousDirection: latestSnapshot.ruleDirection,
          currentDirection: detail.rule.direction,
          previousRuleScore: latestSnapshot.ruleScore,
          currentRuleScore: detail.rule.score,
          scoreDelta: Math.abs(detail.rule.score - latestSnapshot.ruleScore),
          price: normalizeMoneyString(detail.price),
          priceChange24h: detail.priceChange
        }
      });
    }

    if (strongBullishSignals.length >= 2) {
      const signalLabels = strongBullishSignals.map((signal) => signal.label);
      const signalTypes = strongBullishSignals.map((signal) => signal.type).sort();
      candidates.push({
        assetId,
        symbol,
        type: "多信号共振",
        typeKey: "signal_resonance",
        summary: this.withMarketContext(
          `${symbol} ${signalLabels.join("、")} 同时强偏多，形成多信号共振。整体信号 ${this.biasLevelLabelFromScore(detail.rule.score)}（${this.formatSignedScore(detail.rule.score)}）。`,
          detail
        ),
        summaryKey: "alerts.signalResonanceBullish",
        alertKey: `signal-resonance-bullish-${signalTypes.join("-")}`,
        triggeredAt: now,
        payload: {
          symbol,
          direction: "bullish",
          signalTypes,
          signalLabels,
          ruleScore: detail.rule.score,
          price: normalizeMoneyString(detail.price),
          priceChange24h: detail.priceChange,
          scores: strongBullishSignals.map((signal) => ({
            type: signal.type,
            label: signal.label,
            score: signal.score
          }))
        }
      });
    }

    if (strongBearishSignals.length >= 2) {
      const signalLabels = strongBearishSignals.map((signal) => signal.label);
      const signalTypes = strongBearishSignals.map((signal) => signal.type).sort();
      candidates.push({
        assetId,
        symbol,
        type: "多信号共振",
        typeKey: "signal_resonance",
        summary: this.withMarketContext(
          `${symbol} ${signalLabels.join("、")} 同时强偏空，形成多信号共振。整体信号 ${this.biasLevelLabelFromScore(detail.rule.score)}（${this.formatSignedScore(detail.rule.score)}）。`,
          detail
        ),
        summaryKey: "alerts.signalResonanceBearish",
        alertKey: `signal-resonance-bearish-${signalTypes.join("-")}`,
        triggeredAt: now,
        payload: {
          symbol,
          direction: "bearish",
          signalTypes,
          signalLabels,
          ruleScore: detail.rule.score,
          price: normalizeMoneyString(detail.price),
          priceChange24h: detail.priceChange,
          scores: strongBearishSignals.map((signal) => ({
            type: signal.type,
            label: signal.label,
            score: signal.score
          }))
        }
      });
    }

    return candidates;
  }

  private async getAlertingConfig(): Promise<AlertingConfig> {
    const sections = await this.prisma.globalConfigSection.findMany({
      where: {
        sectionKey: {
          in: ["preferences", "alertRules"]
        }
      }
    });

    const preferences = this.toRecord(sections.find((section) => section.sectionKey === "preferences")?.configJson);
    const alertRules = this.toRecord(sections.find((section) => section.sectionKey === "alertRules")?.configJson);
    const thresholds = this.parseScoreThresholds(alertRules.scoreThreshold);

    return {
      scoreThresholdBullish: thresholds.bullish,
      scoreThresholdBearish: thresholds.bearish,
      aiSwitchReminderEnabled: (alertRules.aiSwitchReminder ?? "").includes("开启"),
      cooldownMinutes: this.parseCooldownMinutes(alertRules.cooldownMinutes),
      notificationChannel: preferences.notification ?? "",
      locale: this.normalizeAlertLocale(preferences.language)
    };
  }

  private async findRecentMatchingAlert(
    assetId: string,
    type: string,
    alertKey: string,
    cooldownMinutes: number,
    triggeredAt: Date
  ) {
    const since = new Date(triggeredAt.getTime() - cooldownMinutes * 60_000);
    const recentAlerts = await this.prisma.alert.findMany({
      where: {
        assetId,
        alertType: type,
        triggeredAt: {
          gte: since
        }
      },
      orderBy: {
        triggeredAt: "desc"
      },
      take: 20
    });

    return recentAlerts.find((alert) => {
      if (!alert.payloadJson || typeof alert.payloadJson !== "object" || Array.isArray(alert.payloadJson)) {
        return false;
      }

      return String((alert.payloadJson as { alertKey?: string }).alertKey ?? "") === alertKey;
    });
  }

  private async sendTelegramAlert(candidate: AlertCandidate, locale: "zh-CN" | "en-US") {
    const telegramConfig = await this.prisma.systemTelegramConfig.findFirst({
      orderBy: { createdAt: "desc" }
    }) ?? await this.prisma.systemTelegramConfig.create({
      data: {
        // One-time bootstrap for installs that previously stored Telegram config in .env.
        botTokenEncrypted: process.env.TELEGRAM_BOT_TOKEN?.trim() ?? "",
        alertChatId: process.env.TELEGRAM_ALERT_CHAT_ID?.trim() ?? "",
        connectionStatus: "unchecked"
      }
    });
    const token = telegramConfig?.botTokenEncrypted?.trim() ?? "";
    const chatId = telegramConfig?.alertChatId?.trim() ?? "";

    if (!token || !chatId) {
      this.logger.log(`telegram alert skipped for ${candidate.symbol}: missing Telegram bot token or alert chat id`);
      return false;
    }

    try {
      const severityPrefix = this.alertSeverityEmoji(this.alertSeverity(candidate.typeKey));
      const typeLabel = this.formatAlertType(candidate, locale);
      const summaryText = this.formatAlertSummary(candidate, locale);
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: `【${candidate.symbol} ${severityPrefix}${typeLabel}】\n${summaryText}`,
          disable_web_page_preview: true
        })
      });

      if (!response.ok) {
        const details = await response.text().catch(() => "");
        this.logger.warn(`telegram alert failed for ${candidate.symbol}: ${response.status} ${details}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.warn(`telegram alert failed for ${candidate.symbol}: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  private parseScoreThresholds(value?: string) {
    const text = value ?? ">= 60 / <= -40";
    const bullishMatch = text.match(/>=\s*(-?\d+)/);
    const bearishMatch = text.match(/<=\s*(-?\d+)/);

    return {
      bullish: bullishMatch ? Number(bullishMatch[1]) : 60,
      bearish: bearishMatch ? Number(bearishMatch[1]) : -40
    };
  }

  private parseCooldownMinutes(value?: string) {
    const match = (value ?? "30 分钟").match(/(\d+)/);
    return match ? Number(match[1]) : 30;
  }

  private normalizeAlertLocale(value?: string) {
    const normalized = value?.trim().toLowerCase();

    if (normalized === "en-us" || normalized === "en" || normalized === "english") {
      return "en-US" as const;
    }

    return "zh-CN" as const;
  }

  private alertSeverity(typeKey: string): AlertSeverity {
    switch (typeKey) {
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

  private alertSeverityEmoji(severity: AlertSeverity) {
    switch (severity) {
      case "high":
        return "🔴 ";
      case "medium":
        return "🟠 ";
      case "low":
      default:
        return "";
    }
  }

  private formatAlertType(candidate: AlertCandidate, locale: "zh-CN" | "en-US") {
    switch (candidate.typeKey) {
      case "rule_threshold":
        return locale === "en-US" ? "Rule Threshold" : "规则分阈值";
      case "ai_switch":
        return locale === "en-US" ? "AI Switch" : "AI 方向切换";
      case "rule_direction_switch":
        return locale === "en-US" ? "Rule Direction Switch" : "总信号方向切换";
      case "signal_resonance":
        return locale === "en-US" ? "Signal Resonance" : "多信号共振";
      default:
        return locale === "en-US" ? candidate.type : candidate.type;
    }
  }

  private formatAlertSummary(candidate: AlertCandidate, locale: "zh-CN" | "en-US") {
    const symbol = String(candidate.payload.symbol ?? candidate.symbol);
    const price = this.normalizeMoneyText(candidate.payload.price);
    const priceChange = this.asString(candidate.payload.priceChange24h);

    let main = candidate.summary;

    switch (candidate.summaryKey) {
      case "alerts.ruleThresholdBullish":
      case "alerts.ruleThresholdBearish": {
        const ruleScore = this.asNumber(candidate.payload.ruleScore);
        const threshold = this.asNumber(candidate.payload.threshold);
        const direction = candidate.payload.direction === "bearish"
          ? (locale === "en-US" ? "bearish" : "偏空")
          : (locale === "en-US" ? "bullish" : "偏多");

        if (ruleScore !== null && threshold !== null) {
          main = locale === "en-US"
            ? `${symbol} rule score reached ${this.formatSignedScore(ruleScore)}, triggering the ${direction} threshold ${threshold}.`
            : `${symbol} 当前规则分达到 ${this.formatSignedScore(ruleScore)}，触发${direction}阈值 ${threshold}。`;
        }
        break;
      }
      case "alerts.aiSwitch": {
        const previousDirection = this.asString(candidate.payload.previousDirection);
        const currentDirection = this.asString(candidate.payload.currentDirection);

        if (previousDirection && currentDirection) {
          main = locale === "en-US"
            ? `${symbol} AI view switched from ${this.directionLabelEn(previousDirection)} to ${this.directionLabelEn(currentDirection)}.`
            : `${symbol} AI 判断由${this.directionLabel(previousDirection as Direction)}切换为${this.directionLabel(currentDirection as Direction)}。`;
        }
        break;
      }
      case "alerts.ruleDirectionSwitch": {
        const previousRuleScore = this.asNumber(candidate.payload.previousRuleScore);
        const currentRuleScore = this.asNumber(candidate.payload.currentRuleScore);

        if (previousRuleScore !== null && currentRuleScore !== null) {
          const previousLabel = this.biasLevelLabelFromScoreByLocale(previousRuleScore, locale);
          const currentLabel = this.biasLevelLabelFromScoreByLocale(currentRuleScore, locale);
          main = locale === "en-US"
            ? `${symbol} overall signal changed from ${previousLabel} (${this.formatSignedScore(previousRuleScore)}) to ${currentLabel} (${this.formatSignedScore(currentRuleScore)}).`
            : `${symbol} 总信号由${previousLabel}（${this.formatSignedScore(previousRuleScore)}）切换为${currentLabel}（${this.formatSignedScore(currentRuleScore)}）。`;
        }
        break;
      }
      case "alerts.signalResonanceBullish":
      case "alerts.signalResonanceBearish": {
        const signalTypes = this.asStringList(candidate.payload.signalTypes);
        const signalLabels = signalTypes.length > 0
          ? signalTypes.map((type) => this.signalLabel(type, locale)).join(locale === "en-US" ? ", " : "、")
          : this.asStringList(candidate.payload.signalLabels).join(locale === "en-US" ? ", " : "、");
        const ruleScore = this.asNumber(candidate.payload.ruleScore);
        const direction = candidate.payload.direction === "bearish"
          ? (locale === "en-US" ? "bearish" : "偏空")
          : (locale === "en-US" ? "bullish" : "偏多");
        const overall = ruleScore !== null
          ? `${this.biasLevelLabelFromScoreByLocale(ruleScore, locale)}${locale === "en-US" ? ` (${this.formatSignedScore(ruleScore)})` : `（${this.formatSignedScore(ruleScore)}）`}`
          : null;

        main = locale === "en-US"
          ? `${symbol} ${signalLabels || "multiple signals"} aligned strongly ${direction}, forming signal resonance.${overall ? ` Overall signal ${overall}.` : ""}`
          : `${symbol} ${signalLabels || "多个信号"} 同时强${direction}，形成多信号共振。${overall ? `整体信号 ${overall}。` : ""}`;
        break;
      }
      default:
        break;
    }

    if (!price && !priceChange) {
      return main;
    }

    if (locale === "en-US") {
      return `${main} Current price ${price ?? "--"}, 24H change ${priceChange ?? "--"}.`;
    }

    return `${main} 当前价格 ${price ?? "--"}，24H 涨跌 ${priceChange ?? "--"}。`;
  }

  private asString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : "";
  }

  private asStringList(value: unknown) {
    if (!Array.isArray(value)) {
      return [] as string[];
    }

    return value.map((item) => String(item)).filter(Boolean);
  }

  private asNumber(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  private normalizeMoneyText(value: unknown) {
    const text = this.asString(value);
    return text ? text.replace(/^\$+/, "$") : "";
  }

  private signalLabel(type: string, locale: "zh-CN" | "en-US") {
    switch (type) {
      case "market":
        return locale === "en-US" ? "Market" : "市场";
      case "news":
        return locale === "en-US" ? "News" : "新闻";
      case "community":
        return locale === "en-US" ? "Community" : "社区";
      case "kol":
        return locale === "en-US" ? "KOL" : "KOL";
      case "onchain":
        return locale === "en-US" ? "On-chain" : "链上";
      case "whale":
        return locale === "en-US" ? "Whale" : "鲸鱼";
      default:
        return type;
    }
  }

  private directionLabelEn(direction: string) {
    switch (direction) {
      case "bullish":
        return "Bullish";
      case "bearish":
        return "Bearish";
      default:
        return "Watch";
    }
  }

  private biasLevelLabelFromScoreByLocale(score: number, locale: "zh-CN" | "en-US") {
    if (locale === "en-US") {
      if (score <= -75) {
        return "Super Bearish";
      }

      if (score <= -45) {
        return "Strong Bearish";
      }

      if (score <= -15) {
        return "Weak Bearish";
      }

      if (score >= 75) {
        return "Super Bullish";
      }

      if (score >= 45) {
        return "Strong Bullish";
      }

      if (score >= 15) {
        return "Weak Bullish";
      }

      return "Watch";
    }

    return this.biasLevelLabelFromScore(score);
  }

  private toRecord(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {} as Record<string, string>;
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, String(item)])
    );
  }

  private directionLabel(direction: Direction) {
    switch (direction) {
      case "bullish":
        return "偏多";
      case "bearish":
        return "偏空";
      default:
        return "观望";
    }
  }

  private biasLevelLabelFromScore(score: number) {
    if (score <= -75) {
      return "超级偏空";
    }

    if (score <= -45) {
      return "强偏空";
    }

    if (score <= -15) {
      return "弱偏空";
    }

    if (score < 15) {
      return "观望";
    }

    if (score < 45) {
      return "弱偏多";
    }

    if (score < 75) {
      return "强偏多";
    }

    return "超级偏多";
  }

  private formatSignedScore(score: number) {
    return score > 0 ? `+${score}` : String(score);
  }

  private withMarketContext(summary: string, detail: PersistedAssetDetail) {
    return `${summary} 当前价格 ${detail.price}，24H 涨跌 ${detail.priceChange}。`;
  }
}
