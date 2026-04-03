import { BadGatewayException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { AppDataService, type RuntimeAiConfig } from "../database/app-data.service";

type AiRefreshReason = "periodic" | "direction_switch" | "manual" | "snapshot_change";

type GeneratedAiResult = {
  score: number;
  direction: "bullish" | "bearish" | "watch";
  biasLevel:
    | "super_bearish"
    | "strong_bearish"
    | "weak_bearish"
    | "watch"
    | "weak_bullish"
    | "strong_bullish"
    | "super_bullish";
  action: string;
  actionKey?: string;
  strength: string;
  strengthKey?: "high" | "medium" | "low";
  confidence: string;
  confidenceKey?: "high" | "medium" | "low";
  summary: string;
  reasons: string[];
  risks: string[];
};

type SupportedLocale = "zh-CN" | "en-US";

const AI_REQUEST_TIMEOUT_MS = 25_000;
const AI_REQUEST_MAX_ATTEMPTS = 2;
const AI_RECOMPUTE_CONCURRENCY = 2;

type LlmPayload = {
  symbol: string;
  name: string;
  price: string;
  priceChange24h: string;
  analysisWindow: string;
  marketFacts: {
    currentState: Array<{ name: string; value: string }>;
    recentChanges: Array<{
      time: string;
      title: string;
    }>;
  };
  newsItems: Array<{
    time: string;
    title: string;
    link?: string;
  }>;
  kolItems: Array<{
    time: string;
    author?: string;
    title: string;
    link?: string;
  }>;
  communityItems: Array<{
    time: string;
    title: string;
    link?: string;
  }>;
  onchainFacts: {
    currentState: Array<{ name: string; value: string }>;
    recentChanges: Array<{
      time: string;
      title: string;
    }>;
  };
  whaleFacts: {
    currentState: Array<{ name: string; value: string }>;
    recentChanges: Array<{
      time: string;
      title: string;
    }>;
  };
};

@Injectable()
export class AiAnalysisService {
  private readonly logger = new Logger(AiAnalysisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly appDataService: AppDataService
  ) {}

  async recomputeForSymbol(symbol: string, reason: AiRefreshReason = "manual", force = false) {
    const normalizedSymbol = symbol.toUpperCase();
    const asset = await this.prisma.asset.findUnique({
      where: { symbol: normalizedSymbol },
      include: {
        analysisSnapshots: {
          orderBy: {
            createdAt: "desc"
          },
          take: 1
        },
        latestAiAnalysis: true
      }
    });

    if (!asset?.analysisSnapshots[0]) {
      throw new NotFoundException("AI recompute target snapshot not found");
    }

    const latestSnapshot = asset.analysisSnapshots[0];
    if (!force && asset.latestAiAnalysis?.basedOnSnapshotId === latestSnapshot.id) {
      return {
        skipped: true,
        symbol: normalizedSymbol,
        basedOnSnapshotAt: latestSnapshot.createdAt.toISOString()
      };
    }

    const detail = await this.appDataService.getAssetDetail(normalizedSymbol);
    const prompt = await this.appDataService.getGlobalPrompt();
    const config = await this.appDataService.getAiRuntimeConfig();
    const generated = await this.generateAiResult(detail, prompt.promptTextByLocale["zh-CN"], config, "zh-CN");
    const englishGenerated = await this.generateAiResult(detail, prompt.promptTextByLocale["en-US"], config, "en-US");
    const localizedPayload = {
      "zh-CN": {
        summary: generated.summary,
        reasons: generated.reasons,
        risks: generated.risks
      },
      "en-US": {
        summary: englishGenerated.summary,
        reasons: englishGenerated.reasons,
        risks: englishGenerated.risks
      }
    } as const;

    const stored = await this.prisma.latestAiAnalysis.upsert({
      where: {
        assetId: asset.id
      },
      update: {
        basedOnSnapshotId: latestSnapshot.id,
        basedOnSnapshotAt: latestSnapshot.createdAt,
        direction: generated.direction,
        biasLevel: generated.biasLevel,
        score: generated.score,
        action: generated.action,
        strength: generated.strength,
        confidence: generated.confidence,
        summary: generated.summary,
        reasonsJson: generated.reasons,
        risksJson: generated.risks,
        summaryLocalizedJson: {
          "zh-CN": localizedPayload["zh-CN"].summary,
          "en-US": localizedPayload["en-US"].summary
        },
        reasonsLocalizedJson: {
          "zh-CN": localizedPayload["zh-CN"].reasons,
          "en-US": localizedPayload["en-US"].reasons
        },
        risksLocalizedJson: {
          "zh-CN": localizedPayload["zh-CN"].risks,
          "en-US": localizedPayload["en-US"].risks
        }
      },
      create: {
        assetId: asset.id,
        basedOnSnapshotId: latestSnapshot.id,
        basedOnSnapshotAt: latestSnapshot.createdAt,
        direction: generated.direction,
        biasLevel: generated.biasLevel,
        score: generated.score,
        action: generated.action,
        strength: generated.strength,
        confidence: generated.confidence,
        summary: generated.summary,
        reasonsJson: generated.reasons,
        risksJson: generated.risks,
        summaryLocalizedJson: {
          "zh-CN": localizedPayload["zh-CN"].summary,
          "en-US": localizedPayload["en-US"].summary
        },
        reasonsLocalizedJson: {
          "zh-CN": localizedPayload["zh-CN"].reasons,
          "en-US": localizedPayload["en-US"].reasons
        },
        risksLocalizedJson: {
          "zh-CN": localizedPayload["zh-CN"].risks,
          "en-US": localizedPayload["en-US"].risks
        }
      }
    });

    this.logger.log(`recomputed AI for ${normalizedSymbol} (${reason}) score=${stored.score}`);

    return {
      skipped: false,
      symbol: normalizedSymbol,
      direction: stored.direction,
      biasLevel: stored.biasLevel,
      score: stored.score,
      action: stored.action,
      actionKey: this.actionKeyFromAction(stored.action),
      strength: stored.strength,
      strengthKey: this.strengthKeyFromValue(stored.strength),
      confidence: stored.confidence,
      confidenceKey: this.confidenceKeyFromValue(stored.confidence),
      summary: stored.summary,
      localizedText: {
        sourceLocale: "zh-CN",
        availableLocales: ["zh-CN", "en-US"],
        summaryByLocale: {
          "zh-CN": generated.summary,
          "en-US": englishGenerated.summary
        },
        reasonsByLocale: {
          "zh-CN": generated.reasons,
          "en-US": englishGenerated.reasons
        },
        risksByLocale: {
          "zh-CN": generated.risks,
          "en-US": englishGenerated.risks
        }
      },
      updatedAt: stored.updatedAt.toISOString(),
      basedOnSnapshotAt: stored.basedOnSnapshotAt.toISOString()
    };
  }

  async recomputeForSymbols(symbols: string[], reason: AiRefreshReason = "periodic") {
    const normalizedSymbols = [...new Set(symbols.map((item) => item.toUpperCase()).filter(Boolean))];
    const results = [];

    for (let index = 0; index < normalizedSymbols.length; index += AI_RECOMPUTE_CONCURRENCY) {
      const batch = normalizedSymbols.slice(index, index + AI_RECOMPUTE_CONCURRENCY);
      const settled = await Promise.allSettled(
        batch.map((symbol) => this.recomputeForSymbol(symbol, reason))
      );

      for (let batchIndex = 0; batchIndex < settled.length; batchIndex += 1) {
        const outcome = settled[batchIndex];
        const symbol = batch[batchIndex];

        if (outcome.status === "fulfilled") {
          results.push(outcome.value);
          continue;
        }

        const error = outcome.reason;
        this.logger.warn(`AI recompute skipped for ${symbol}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return results;
  }

  async recomputeForDirectionSwitches(items: Array<{ symbol: string; previousDirection?: string | null; currentDirection: string }>) {
    const switchedSymbols = items
      .filter((item) => item.previousDirection && item.previousDirection !== item.currentDirection)
      .map((item) => item.symbol.toUpperCase());

    if (switchedSymbols.length === 0) {
      return [];
    }

    return this.recomputeForSymbols(switchedSymbols, "direction_switch");
  }

  static buildSystemPrompt(locale: SupportedLocale = "zh-CN") {
    if (locale === "en-US") {
      return [
        "You are AlphaPony's crypto trading analysis AI.",
        "You must make judgments only from the provided data and never invent facts.",
        "Your task is to produce a professional short-term trading assessment from multi-source facts and return structured JSON for the asset detail AI card.",
        "Think like an experienced crypto market researcher and trader, not like a mechanical score aggregator.",
        "You must weigh market structure, capital flows, event catalysts, sentiment shifts, source credibility, KOL influence, on-chain behavior, whale activity, and the typical market reaction seen in similar setups.",
        "Prioritize fact-level data, change-level data, and event significance for your own judgment instead of repeating the system's existing conclusion.",
        "System scores are only references, not the final answer. Judge the importance, durability, credibility, and conflicts of each signal yourself.",
        "Interpret these dimensions separately:",
        "1. Market data: assess price change, trend structure, moving average position, MACD, volume, and whether volatility supports continuation or reversal.",
        "2. News data: assess headlines, source, time, content, and likely impact scope to judge whether the item is noise or a real catalyst.",
        "3. KOL data: assess the speaker's importance, historical influence, message content, ability to move sentiment, and whether views are aligned.",
        "4. Community data: assess discussion content, heat, bullish or bearish distribution, and sentiment quality to separate real consensus from emotional noise.",
        "5. On-chain data: assess exchange flows, stablecoin flows, active addresses, and capital movement to judge real inflow or outflow support.",
        "6. Whale data: assess whether large holders are consistently accumulating or distributing, and whether large transfers create short-term pressure or support.",
        "If signals conflict, explain which one matters more, which one lags, and which one is likely noise.",
        "If evidence is insufficient or offsets itself, choose watch explicitly instead of forcing a strong directional call.",
        "You must follow these rules:",
        "1. score must be an integer from -100 to 100.",
        "2. Positive score means bullish, negative score means bearish, near zero means watch.",
        "3. direction must be exactly one of bullish, bearish, watch.",
        "4. biasLevel must be exactly one of super_bearish, strong_bearish, weak_bearish, watch, weak_bullish, strong_bullish, super_bullish.",
        "5. actionKey must be exactly one of aggressive_long, follow_bullish, probe_long, probe_short, defensive_bearish, aggressive_defense, standby.",
        "6. strengthKey must be exactly one of high, medium, low.",
        "7. confidenceKey must be exactly one of high, medium, low.",
        "8. All natural-language output fields must be written in English.",
        "9. summary must be one concise English sentence with at most 50 words.",
        "10. reasons must contain 2 to 3 short English sentences, each grounded in concrete facts, changes, or important signals.",
        "11. risks must contain 1 to 2 short English sentences describing opposite factors or uncertainty.",
        "12. If the input contains any system-generated summary or labels, treat them only as background instead of the final conclusion.",
        "13. If the overall information is obviously conflicting, lean toward watch instead of forcing a strong bullish or bearish call.",
        "14. Return JSON only, with no markdown and no explanation."
      ].join("\n");
    }

    return [
      "你是 AlphaPony 的币圈交易分析 AI。",
      "你必须只根据提供的数据做判断，不能编造不存在的事实。",
      "你的任务是基于多源事实数据完成一份专业的短线交易判断，并输出结构化 JSON，用于详情页 AI 判断卡片。",
      "你要像经验丰富的加密市场研究员和交易分析师一样思考，而不是机械汇总分数。",
      "你需要综合考虑市场结构、资金流、事件驱动、情绪变化、消息可信度、KOL 影响力、链上行为、鲸鱼动向，以及历史上类似场景的常见市场反应。",
      "你必须优先依据事实层数据、变化层数据和事件重要性做独立判断，而不是简单复述系统已有结论。",
      "系统提供的分值可以作为参考，但不是最终答案；你要自己判断每类信号的重要性、持续性、可信度和相互冲突关系。",
      "你需要分别理解以下维度：",
      "1. 市场数据：关注价格变化、趋势结构、均线位置、MACD、量能、波动是否支持趋势延续或反转。",
      "2. 新闻数据：关注新闻标题、来源、时间、内容与潜在影响范围，判断是短线噪音还是重要驱动。",
      "3. KOL 数据：关注 KOL 本身的重要度、历史影响力、发言内容、是否具备带节奏能力，以及观点是否一致。",
      "4. 社区数据：关注社区讨论内容、热度、偏多偏空分布、情绪质量，评估是真实共识还是情绪噪音。",
      "5. 链上数据：关注交易所流向、稳定币流向、活跃地址、资金迁移是否支持资金真实流入或流出。",
      "6. 鲸鱼数据：关注大额地址是否持续加仓/减仓、大额转账频率和方向，判断是否对短线造成压力或支撑。",
      "如果不同信号相互冲突，你要解释谁更重要、谁更滞后、谁更可能只是噪音。",
      "如果证据不足或相互抵消，应明确选择观望，而不是勉强给出强方向。",
      "你必须遵守以下规则：",
      "1. score 必须是 -100 到 100 的整数。",
      "2. 正分表示偏多，负分表示偏空，0 附近表示观望。",
      "3. direction 只能是 bullish、bearish、watch 之一。",
      "4. biasLevel 只能是 super_bearish、strong_bearish、weak_bearish、watch、weak_bullish、strong_bullish、super_bullish 之一。",
      "5. actionKey 只能是 aggressive_long、follow_bullish、probe_long、probe_short、defensive_bearish、aggressive_defense、standby 之一。",
      "6. strengthKey 只能是 high、medium、low 之一。",
      "7. confidenceKey 只能是 high、medium、low 之一。",
      "8. 所有自然语言输出字段都必须使用中文。",
      "9. summary 必须是一句中文总结，不超过 50 个字。",
      "10. reasons 必须是 2 到 3 条中文短句，每条都要引用具体事实、数据变化或重要信号。",
      "11. risks 必须是 1 到 2 条中文短句，指出反向因素或不确定性。",
      "12. 如果输入里出现任何系统生成的摘要或标签，你也只能把它们当背景材料，不能把它们当成最终结论。",
      "13. 如果整体信息冲突明显，应更偏向 watch，而不是强行给出强偏多/强偏空。",
      "14. 只输出 JSON，不要输出 markdown，不要输出解释。"
    ].join("\n");
  }

  private async generateAiResult(
    detail: Awaited<ReturnType<AppDataService["getAssetDetail"]>>,
    assetPrompt: string,
    config: RuntimeAiConfig,
    locale: SupportedLocale
  ): Promise<GeneratedAiResult> {
    if (!config.apiKey) {
      throw new NotFoundException("AI API key is not configured");
    }

    const signalByType = new Map(detail.signals.map((signal) => [signal.type, signal]));
    const marketSignal = signalByType.get("market");
    const newsSignal = signalByType.get("news");
    const kolSignal = signalByType.get("kol");
    const communitySignal = signalByType.get("community");
    const onchainSignal = signalByType.get("onchain");
    const whaleSignal = signalByType.get("whale");

    const payload: LlmPayload = {
      symbol: detail.symbol,
      name: detail.name,
      price: detail.price,
      priceChange24h: detail.priceChange,
      analysisWindow: detail.window ?? "4H",
      marketFacts: {
        currentState: (marketSignal?.metrics ?? []).slice(0, 8).map((item) => ({
          name: `${item.name}${locale === "en-US" ? " (current)" : "（当前）"}`,
          value: item.value
        })),
        recentChanges: (marketSignal?.highlights ?? []).slice(0, 8).map((item) => ({
          time: item.publishedAt ?? detail.ai.basedOnSnapshotAt,
          title: item.title
        }))
      },
      newsItems: (newsSignal?.highlights ?? []).slice(0, 10).map((item) => ({
        time: item.publishedAt ?? detail.ai.basedOnSnapshotAt,
        title: item.title,
        ...(item.href ? { link: item.href } : {})
      })),
      kolItems: (kolSignal?.highlights ?? []).slice(0, 10).map((item) => ({
        time: item.publishedAt ?? detail.ai.basedOnSnapshotAt,
        author: this.extractKolAuthor(item.title),
        title: item.title,
        ...(item.href ? { link: item.href } : {})
      })),
      communityItems: (communitySignal?.highlights ?? []).slice(0, 10).map((item) => ({
        time: item.publishedAt ?? detail.ai.basedOnSnapshotAt,
        title: item.title,
        ...(item.href ? { link: item.href } : {})
      })),
      onchainFacts: {
        currentState: (onchainSignal?.metrics ?? []).slice(0, 8).map((item) => ({
          name: `${item.name}${locale === "en-US" ? " (current)" : "（当前）"}`,
          value: item.value
        })),
        recentChanges: (onchainSignal?.highlights ?? []).slice(0, 8).map((item) => ({
          time: item.publishedAt ?? detail.ai.basedOnSnapshotAt,
          title: item.title
        }))
      },
      whaleFacts: {
        currentState: (whaleSignal?.metrics ?? []).slice(0, 8).map((item) => ({
          name: `${item.name}${locale === "en-US" ? " (current)" : "（当前）"}`,
          value: item.value
        })),
        recentChanges: (whaleSignal?.highlights ?? []).slice(0, 8).map((item) => ({
          time: item.publishedAt ?? detail.ai.basedOnSnapshotAt,
          title: item.title
        }))
      }
    };

    const raw = await this.callChatCompletions(config, this.buildMessages(assetPrompt, payload, locale));
    const parsed = this.parseModelResponse(raw);

    return this.normalizeGeneratedAiResult(parsed, locale);
  }

  private buildMessages(assetPrompt: string, payload: LlmPayload, locale: SupportedLocale) {
    const systemPrompt = AiAnalysisService.buildSystemPrompt(locale);

    const userPrompt = locale === "en-US"
      ? [
          "Asset-specific extra prompt:",
          assetPrompt.trim() || "None",
          "",
          "Below is the current asset's multi-source factual data. Produce your own combined judgment.",
          "Priority requirements:",
          "1. Do not copy the system's existing stance mechanically.",
          "2. Focus on facts, timing, changes, and importance inside each signal group.",
          "3. For news, judge event significance and lasting impact.",
          "4. For KOLs, judge speaker importance, credibility, and ability to move sentiment.",
          "5. For community data, judge whether discussion reflects valid consensus or emotional noise.",
          "6. For market data, judge whether trend structure aligns with price and volume.",
          "7. For on-chain and whale data, judge whether capital actually supports the current direction.",
          "8. If bullish and bearish evidence offsets, return watch explicitly and explain why.",
          "",
          "The input below focuses on raw facts, content, timestamps, current state, and recent changes. You must synthesize the judgment yourself.",
          "Important: fields marked with '(current)' are snapshot state, not necessarily newly changed events. recentChanges contains the actual recent events and timestamps.",
          "",
          "Return JSON from the following input data:",
          JSON.stringify(payload, null, 2),
          "",
          "JSON schema:",
          JSON.stringify({
            score: -12,
            direction: "watch",
            biasLevel: "watch",
            actionKey: "standby",
            strengthKey: "low",
            confidenceKey: "medium",
            summary: "One concise English summary sentence",
            reasons: ["Reason 1", "Reason 2"],
            risks: ["Risk 1"]
          }, null, 2)
        ].join("\n")
      : [
          "资产级附加提示词：",
          assetPrompt.trim() || "无",
          "",
          "下面给你的是当前资产的多源事实数据，请你自己完成综合判断。",
          "重点要求：",
          "1. 不要简单照抄系统已有方向。",
          "2. 重点看每类数据里的事实、时间、变化和重要性。",
          "3. 新闻要判断事件的重要性和持续影响。",
          "4. KOL 要判断发言者的重要度、可信度和带动能力。",
          "5. 社区要判断讨论是有效共识还是情绪噪音。",
          "6. 市场要判断趋势结构与量价是否一致。",
          "7. 链上和鲸鱼要判断资金是否真实支持当前方向。",
          "8. 如果多空证据对冲，就明确给出观望，并解释原因。",
          "",
          "以下输入以原始事实数据、内容、时间、当前状态和最近变化为主，请你自行综合判断。",
          "请特别注意：带有“（当前）”字样的是当前状态快照，不代表刚刚发生变化；recentChanges 才表示最近发生的事件和变化时间。",
          "",
          "请基于以下输入数据输出 JSON：",
          JSON.stringify(payload, null, 2),
          "",
          "JSON schema:",
          JSON.stringify({
            score: -12,
            direction: "watch",
            biasLevel: "watch",
            actionKey: "standby",
            strengthKey: "low",
            confidenceKey: "medium",
            summary: "一句中文总结",
            reasons: ["原因1", "原因2"],
            risks: ["风险1"]
          }, null, 2)
        ].join("\n");

    return [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: userPrompt
      }
    ];
  }

  private async callChatCompletions(
    config: RuntimeAiConfig,
    messages: Array<{ role: string; content: string }>
  ) {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= AI_REQUEST_MAX_ATTEMPTS; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`
          },
          body: JSON.stringify({
            model: config.model,
            temperature: 0.2,
            response_format: {
              type: "json_object"
            },
            messages
          }),
          signal: controller.signal
        });

        const text = await response.text();
        if (!response.ok) {
          await this.appDataService.updateAiConnectionStatus("error");
          throw new BadGatewayException(this.extractProviderError(response.status, text));
        }

        await this.appDataService.updateAiConnectionStatus("ok");

        const parsed = JSON.parse(text) as {
          choices?: Array<{
            message?: {
              content?: string | Array<{ type?: string; text?: string }>;
            };
          }>;
        };
        const content = parsed.choices?.[0]?.message?.content;

        if (typeof content === "string" && content.trim()) {
          return content;
        }

        if (Array.isArray(content)) {
          const joined = content
            .map((item) => (typeof item?.text === "string" ? item.text : ""))
            .join("")
            .trim();

          if (joined) {
            return joined;
          }
        }

        throw new BadGatewayException("AI provider returned empty content");
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const isRetriable = this.isRetriableAiError(error);

        if (attempt < AI_REQUEST_MAX_ATTEMPTS && isRetriable) {
          this.logger.warn(
            `AI request attempt ${attempt} failed: ${lastError.message}. Retrying.`
          );
          continue;
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    await this.appDataService.updateAiConnectionStatus("error");
    throw new BadGatewayException(
      lastError ? this.normalizeAiErrorMessage(lastError) : "AI provider returned empty content"
    );
  }

  private isRetriableAiError(error: unknown) {
    if (error instanceof BadGatewayException) {
      return false;
    }

    if (!(error instanceof Error)) {
      return false;
    }

    return error.name === "AbortError" || error instanceof TypeError;
  }

  private normalizeAiErrorMessage(error: Error) {
    if (error.name === "AbortError") {
      return `AI provider timeout after ${Math.round(AI_REQUEST_TIMEOUT_MS / 1000)}s`;
    }

    return error.message;
  }

  private parseModelResponse(raw: string) {
    const trimmed = raw.trim();
    const normalized = trimmed.startsWith("```")
      ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
      : trimmed;

    return JSON.parse(normalized) as Partial<GeneratedAiResult>;
  }

  private normalizeGeneratedAiResult(parsed: Partial<GeneratedAiResult>, locale: SupportedLocale): GeneratedAiResult {
    const score = this.clamp(Math.round(Number(parsed.score ?? 0)), -100, 100);
    const biasLevel = this.normalizeBiasLevel(parsed.biasLevel, score);
    const direction = this.biasLevelToDirection(biasLevel);
    const strengthKey = this.normalizeStrengthKey(parsed.strengthKey ?? parsed.strength, biasLevel);
    const confidenceKey = this.normalizeConfidenceKey(parsed.confidenceKey ?? parsed.confidence, score);
    const actionKey = this.normalizeActionKey(parsed.actionKey ?? parsed.action, biasLevel);
    const strength = this.strengthFromKey(strengthKey, locale);
    const confidence = this.confidenceFromKey(confidenceKey, locale);
    const action = this.actionFromKey(actionKey, locale);
    const summary = typeof parsed.summary === "string" && parsed.summary.trim()
      ? parsed.summary.trim().slice(0, 80)
      : locale === "en-US"
        ? `AI currently rates the setup as ${this.biasLevelLabel(biasLevel, "en-US")} (${score > 0 ? `+${score}` : score}).`
        : `AI 当前判断为${this.biasLevelLabel(biasLevel, "zh-CN")}（${score > 0 ? `+${score}` : score}）。`;
    const reasons = Array.isArray(parsed.reasons)
      ? parsed.reasons.map((item) => String(item).trim()).filter(Boolean).slice(0, 3)
      : [];
    const risks = Array.isArray(parsed.risks)
      ? parsed.risks.map((item) => String(item).trim()).filter(Boolean).slice(0, 2)
      : [];

    return {
      score,
      direction,
      biasLevel,
      action,
      actionKey,
      strength,
      strengthKey,
      confidence,
      confidenceKey,
      summary,
      reasons: reasons.length > 0
        ? reasons
        : [locale === "en-US"
          ? "Current evidence is still limited and needs more confirmation."
          : "当前有效共识有限，需等待更多信号确认。"],
      risks: risks.length > 0
        ? risks
        : [locale === "en-US"
          ? "Short-term conditions remain uncertain and signals may reverse."
          : "短线仍存在不确定性，需警惕信号反复。"]
    };
  }

  private normalizeBiasLevel(level: unknown, score: number): GeneratedAiResult["biasLevel"] {
    const allowedLevels = new Set<GeneratedAiResult["biasLevel"]>([
      "super_bearish",
      "strong_bearish",
      "weak_bearish",
      "watch",
      "weak_bullish",
      "strong_bullish",
      "super_bullish"
    ]);

    if (typeof level === "string" && allowedLevels.has(level as GeneratedAiResult["biasLevel"])) {
      return level as GeneratedAiResult["biasLevel"];
    }

    return this.scoreToBiasLevel(score);
  }

  private normalizeStrengthKey(value: unknown, biasLevel: GeneratedAiResult["biasLevel"]): "high" | "medium" | "low" {
    if (value === "high" || value === "medium" || value === "low") {
      return value;
    }

    if (value === "强") {
      return "high";
    }

    if (value === "中") {
      return "medium";
    }

    if (value === "弱") {
      return "low";
    }

    return this.strengthKeyFromBiasLevel(biasLevel);
  }

  private normalizeConfidenceKey(value: unknown, score: number): "high" | "medium" | "low" {
    if (value === "high" || value === "medium" || value === "low") {
      return value;
    }

    if (value === "高") {
      return "high";
    }

    if (value === "中") {
      return "medium";
    }

    if (value === "低") {
      return "low";
    }

    if (Math.abs(score) >= 60) {
      return "high";
    }

    if (Math.abs(score) >= 25) {
      return "medium";
    }

    return "low";
  }

  private actionFromBiasLevel(level: string) {
    switch (level) {
      case "super_bullish":
        return "积极做多";
      case "strong_bullish":
        return "偏多跟随";
      case "weak_bullish":
        return "轻仓试多";
      case "weak_bearish":
        return "轻仓试空";
      case "strong_bearish":
        return "偏空防守";
      case "super_bearish":
        return "积极防守";
      default:
        return "暂不操作";
    }
  }

  private actionKeyFromBiasLevel(level: string) {
    switch (level) {
      case "super_bullish":
        return "aggressive_long";
      case "strong_bullish":
        return "follow_bullish";
      case "weak_bullish":
        return "probe_long";
      case "weak_bearish":
        return "probe_short";
      case "strong_bearish":
        return "defensive_bearish";
      case "super_bearish":
        return "aggressive_defense";
      default:
        return "standby";
    }
  }

  private normalizeActionKey(value: unknown, biasLevel: GeneratedAiResult["biasLevel"]) {
    const allowedKeys = new Set([
      "aggressive_long",
      "follow_bullish",
      "probe_long",
      "probe_short",
      "defensive_bearish",
      "aggressive_defense",
      "standby"
    ]);

    if (typeof value === "string" && allowedKeys.has(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      return this.actionKeyFromAction(value);
    }

    return this.actionKeyFromBiasLevel(biasLevel);
  }

  private actionKeyFromAction(action: string) {
    switch (action) {
      case "Aggressive Long":
      case "积极做多":
        return "aggressive_long";
      case "Follow Bullish":
      case "偏多跟随":
        return "follow_bullish";
      case "Probe Long":
      case "轻仓试多":
        return "probe_long";
      case "Probe Short":
      case "轻仓试空":
        return "probe_short";
      case "Defensive Bearish":
      case "偏空防守":
        return "defensive_bearish";
      case "Aggressive Defense":
      case "积极防守":
        return "aggressive_defense";
      default:
        return "standby";
    }
  }

  private actionFromKey(actionKey: string, locale: SupportedLocale) {
    if (locale === "en-US") {
      switch (actionKey) {
        case "aggressive_long":
          return "Aggressive Long";
        case "follow_bullish":
          return "Follow Bullish";
        case "probe_long":
          return "Probe Long";
        case "probe_short":
          return "Probe Short";
        case "defensive_bearish":
          return "Defensive Bearish";
        case "aggressive_defense":
          return "Aggressive Defense";
        default:
          return "Stand By";
      }
    }

    switch (actionKey) {
      case "aggressive_long":
        return "积极做多";
      case "follow_bullish":
        return "偏多跟随";
      case "probe_long":
        return "轻仓试多";
      case "probe_short":
        return "轻仓试空";
      case "defensive_bearish":
        return "偏空防守";
      case "aggressive_defense":
        return "积极防守";
      default:
        return "暂不操作";
    }
  }

  private strengthFromBiasLevel(level: string) {
    switch (level) {
      case "super_bullish":
      case "super_bearish":
      case "strong_bullish":
      case "strong_bearish":
        return "强";
      case "weak_bullish":
      case "weak_bearish":
        return "中";
      default:
        return "弱";
    }
  }

  private strengthKeyFromBiasLevel(level: string): "high" | "medium" | "low" {
    switch (level) {
      case "super_bullish":
      case "super_bearish":
      case "strong_bullish":
      case "strong_bearish":
        return "high";
      case "weak_bullish":
      case "weak_bearish":
        return "medium";
      default:
        return "low";
    }
  }

  private strengthFromKey(value: "high" | "medium" | "low", locale: SupportedLocale) {
    if (locale === "en-US") {
      return value === "high" ? "High" : value === "medium" ? "Medium" : "Low";
    }

    return value === "high" ? "强" : value === "medium" ? "中" : "弱";
  }

  private strengthKeyFromValue(value: string) {
    switch (value) {
      case "high":
      case "强":
        return "high";
      case "medium":
      case "中":
        return "medium";
      default:
        return "low";
    }
  }

  private confidenceKeyFromValue(value: string) {
    switch (value) {
      case "high":
      case "高":
        return "high";
      case "medium":
      case "中":
        return "medium";
      default:
        return "low";
    }
  }

  private confidenceFromKey(value: "high" | "medium" | "low", locale: SupportedLocale) {
    if (locale === "en-US") {
      return value === "high" ? "High" : value === "medium" ? "Medium" : "Low";
    }

    return value === "high" ? "高" : value === "medium" ? "中" : "低";
  }

  private biasLevelToDirection(level: GeneratedAiResult["biasLevel"]): "bullish" | "bearish" | "watch" {
    if (level === "watch") {
      return "watch";
    }

    return level.includes("bearish") ? "bearish" : "bullish";
  }

  private scoreToBiasLevel(score: number): GeneratedAiResult["biasLevel"] {
    if (score <= -75) return "super_bearish";
    if (score <= -45) return "strong_bearish";
    if (score <= -15) return "weak_bearish";
    if (score < 15) return "watch";
    if (score < 45) return "weak_bullish";
    if (score < 75) return "strong_bullish";
    return "super_bullish";
  }

  private biasLevelLabel(level: string, locale: SupportedLocale = "zh-CN") {
    if (locale === "en-US") {
      switch (level) {
        case "super_bearish":
          return "Super Bearish";
        case "strong_bearish":
          return "Strong Bearish";
        case "weak_bearish":
          return "Weak Bearish";
        case "weak_bullish":
          return "Weak Bullish";
        case "strong_bullish":
          return "Strong Bullish";
        case "super_bullish":
          return "Super Bullish";
        default:
          return "Watch";
      }
    }

    switch (level) {
      case "super_bearish":
        return "超级偏空";
      case "strong_bearish":
        return "强偏空";
      case "weak_bearish":
        return "弱偏空";
      case "weak_bullish":
        return "弱偏多";
      case "strong_bullish":
        return "强偏多";
      case "super_bullish":
        return "超级偏多";
      default:
        return "观望";
    }
  }

  private clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }

  private extractKolAuthor(content: string) {
    const match = content.match(/^\[@([^\]]+)\]/);
    return match?.[1] ?? undefined;
  }

  private extractProviderError(status: number, raw: string) {
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string; code?: string } };
      const message = parsed.error?.message?.trim();
      const code = parsed.error?.code?.trim();

      if (message && code) {
        return `AI provider error (${status} ${code}): ${message}`;
      }

      if (message) {
        return `AI provider error (${status}): ${message}`;
      }
    } catch {
      // Ignore parse failure and fall through.
    }

    return `AI provider error (${status}): ${raw}`;
  }
}
