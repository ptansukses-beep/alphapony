import type { BiasLevel, Direction, SignalHighlight, SignalMetric } from "@/lib/api-types";
import type { LocaleCode } from "@/lib/i18n/config";

const signalAbbreviationMap: Record<LocaleCode, Record<string, string>> = {
  "zh-CN": {
    news: "新",
    community: "社",
    kol: "K",
    market: "市",
    onchain: "链",
    whale: "鲸"
  },
  "en-US": {
    news: "NEW",
    community: "CMN",
    kol: "KOL",
    market: "MKT",
    onchain: "CHN",
    whale: "WHL"
  }
};

const signalLabelMap: Record<LocaleCode, Record<string, string>> = {
  "zh-CN": {
    news: "新闻信号",
    community: "社区信号",
    kol: "KOL 信号",
    market: "市场信号",
    onchain: "链上信号",
    whale: "鲸鱼信号"
  },
  "en-US": {
    news: "News Signal",
    community: "Community Signal",
    kol: "KOL Signal",
    market: "Market Signal",
    onchain: "On-chain Signal",
    whale: "Whale Signal"
  }
};

const signalDisplayOrder = ["market", "news", "community", "kol", "onchain", "whale"] as const;

export function directionClassName(direction: Direction): string {
  switch (direction) {
    case "bullish":
      return "bull";
    case "bearish":
      return "bear";
    default:
      return "watch";
  }
}

export function directionFromScore(score?: number, fallback: Direction = "watch"): Direction {
  if (typeof score !== "number") {
    return fallback;
  }

  if (score > 0) {
    return "bullish";
  }

  if (score < 0) {
    return "bearish";
  }

  return "watch";
}

export function directionLabel(direction: Direction, locale: LocaleCode = "zh-CN"): string {
  switch (direction) {
    case "bullish":
      return locale === "en-US" ? "Bullish" : "偏多";
    case "bearish":
      return locale === "en-US" ? "Bearish" : "偏空";
    default:
      return locale === "en-US" ? "Watch" : "观望";
  }
}

export function biasLevelFromScore(score?: number, fallback: Direction = "watch"): BiasLevel {
  if (typeof score === "number") {
    return scoreToBiasLevel(score);
  }

  switch (fallback) {
    case "bullish":
      return "weak_bullish";
    case "bearish":
      return "weak_bearish";
    default:
      return "watch";
  }
}

export function biasLevelClassName(level?: BiasLevel): string {
  switch (level) {
    case "super_bearish":
      return "bias-super-bearish";
    case "strong_bearish":
      return "bias-strong-bearish";
    case "weak_bearish":
      return "bias-weak-bearish";
    case "weak_bullish":
      return "bias-weak-bullish";
    case "strong_bullish":
      return "bias-strong-bullish";
    case "super_bullish":
      return "bias-super-bullish";
    default:
      return "bias-watch";
  }
}

export function biasLevelLabel(level?: BiasLevel, locale: LocaleCode = "zh-CN"): string {
  switch (level) {
    case "super_bearish":
      return locale === "en-US" ? "Super Bearish" : "超级偏空";
    case "strong_bearish":
      return locale === "en-US" ? "Strong Bearish" : "强偏空";
    case "weak_bearish":
      return locale === "en-US" ? "Weak Bearish" : "弱偏空";
    case "weak_bullish":
      return locale === "en-US" ? "Weak Bullish" : "弱偏多";
    case "strong_bullish":
      return locale === "en-US" ? "Strong Bullish" : "强偏多";
    case "super_bullish":
      return locale === "en-US" ? "Super Bullish" : "超级偏多";
    default:
      return locale === "en-US" ? "Watch" : "观望";
  }
}

export function scoreToBiasLevel(score: number): BiasLevel {
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

export function signalLabel(
  signalType: string,
  locale: LocaleCode = "zh-CN",
  fallback?: string
): string {
  return signalLabelMap[locale][signalType] ?? fallback ?? signalType;
}

export function confidenceLabel(
  confidence: string | undefined,
  locale: LocaleCode = "zh-CN"
): string {
  switch ((confidence ?? "").toLowerCase()) {
    case "high":
    case "高":
      return locale === "en-US" ? "High" : "高";
    case "medium":
    case "中":
      return locale === "en-US" ? "Medium" : "中";
    case "low":
    case "低":
      return locale === "en-US" ? "Low" : "低";
    default:
      return confidence ?? "";
  }
}

export function riskLabel(
  risk: string | undefined,
  locale: LocaleCode = "zh-CN"
): string {
  switch (risk) {
    case "high":
    case "高":
      return locale === "en-US" ? "High" : "高";
    case "medium_high":
    case "中高":
      return locale === "en-US" ? "Medium-High" : "中高";
    case "medium":
    case "中":
      return locale === "en-US" ? "Medium" : "中";
    default:
      return risk ?? "";
  }
}

export function consistencyLabel(
  consistency: string | undefined,
  locale: LocaleCode = "zh-CN"
): string {
  switch (consistency) {
    case "aligned":
    case "规则与 AI 基本一致":
      return locale === "en-US" ? "Rules and AI are broadly aligned" : "规则与 AI 基本一致";
    case "rule_clearer_ai_watch":
    case "规则方向更明确，AI 暂时观望":
      return locale === "en-US" ? "Rules are clearer while AI remains on watch" : "规则方向更明确，AI 暂时观望";
    case "ai_clearer_rule_watch":
    case "规则暂时观望，AI 方向更明确":
      return locale === "en-US" ? "Rules stay on watch while AI is more directional" : "规则暂时观望，AI 方向更明确";
    case "divergent":
    case "规则与 AI 存在分歧":
      return locale === "en-US" ? "Rules and AI are diverging" : "规则与 AI 存在分歧";
    default:
      return consistency ?? "";
  }
}

export function signalMetricLabel(
  name: string | undefined,
  locale: LocaleCode = "zh-CN"
): string {
  if (!name || locale !== "en-US") {
    return name ?? "";
  }

  switch (name) {
    case "24H 涨跌":
      return "24H Change";
    case "4H 涨跌":
      return "4H Change";
    case "EMA":
      return "EMA";
    case "均线":
      return "MA Structure";
    case "MACD":
      return "MACD";
    case "量能":
      return "Volume";
    case "波动":
      return "Volatility";
    case "新闻样本":
      return "News Samples";
    case "单币种事件":
      return "Asset-specific Items";
    case "正向 / 负向":
      return "Positive / Negative";
    case "最近 24H":
      return "Last 24H";
    case "帖子数量":
      return "Post Count";
    case "热度权重":
      return "Activity Weight";
    case "偏多 / 偏空帖子":
      return "Bullish / Bearish Posts";
    case "平均情绪":
      return "Average Sentiment";
    case "KOL 帖子数":
      return "KOL Posts";
    case "活跃作者数":
      return "Active Authors";
    case "核心 / 观察名单":
      return "Core / Watchlist";
    case "偏多 / 偏空观点":
      return "Bullish / Bearish Views";
    case "交易所净流":
      return "Exchange Netflow";
    case "交易所流入 / 流出":
      return "Exchange Inflow / Outflow";
    case "交易所净流出":
      return "Exchange Net Outflow";
    case "稳定币净流入":
      return "Stablecoin Net Inflow";
    case "大额转账":
      return "Large Transfers";
    case "大额转账总额":
      return "Large Transfer Volume";
    case "鲸鱼净变化":
      return "Whale Net Change";
    case "净增持":
      return "Net Accumulation";
    case "鲸鱼买入 / 卖出":
      return "Whale Buy / Sell";
    case "鲸鱼交易次数":
      return "Whale Trades";
    case "活跃地址数":
      return "Active Addresses";
    default:
      return name;
  }
}

function translateTopics(text: string) {
  return text
    .replaceAll("宏观风险", "macro risk")
    .replaceAll("监管", "regulation")
    .replaceAll("安全事件", "security incidents")
    .replaceAll("网络升级", "network upgrades")
    .replaceAll("价格波动", "price volatility")
    .replaceAll("资金流", "capital flows");
}

function translateStructuredState(value: string, locale: LocaleCode) {
  if (locale !== "en-US") {
    return value;
  }

  return value
    .replaceAll("缩量", "low volume")
    .replaceAll("正常量能", "normal volume")
    .replaceAll("放量", "expanded volume")
    .replaceAll("异常放量", "extreme volume")
    .replaceAll("低波动", "low volatility")
    .replaceAll("中性波动", "neutral volatility")
    .replaceAll("高波动观察区", "elevated volatility")
    .replaceAll("高风险波动", "high-risk volatility")
    .replaceAll("异常波动", "extreme volatility")
    .replaceAll("转出交易所", "left exchanges")
    .replaceAll("转入交易所", "moved into exchanges")
    .replaceAll("链上转移", "moved on-chain")
    .replaceAll("单币种新闻", "asset-specific news")
    .replaceAll("宏观金融新闻", "macro-finance news")
    .replaceAll("政治事件新闻", "political news")
    .replaceAll("行业新闻", "industry news")
    .replaceAll("单币新闻", "asset-specific news")
    .replaceAll("宏观金融", "macro-finance")
    .replaceAll("政治宏观", "macro-political")
    .replaceAll("偏多", "bullish")
    .replaceAll("偏空", "bearish")
    .replaceAll("中性", "neutral")
    .replaceAll("VADER + 领域词表", "VADER + domain lexicon")
    .replaceAll("VADER", "VADER");
}

function formatTopicParam(topics: string | number | undefined, locale: LocaleCode) {
  if (typeof topics !== "string") {
    return "";
  }

  const nextTopics = topics.split("|").map((item) => item.trim()).filter(Boolean);
  if (locale !== "en-US") {
    return nextTopics.join("、");
  }

  return nextTopics.map((topic) => translateTopics(topic)).join(", ");
}

function applyTemplate(
  template: string,
  params: Record<string, string | number> | undefined,
  locale: LocaleCode
) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params?.[key];
    if (key === "topics") {
      return formatTopicParam(value, locale);
    }
    if (typeof value === "number") {
      return String(value);
    }
    if (typeof value === "string") {
      if (key === "amount" || key === "price") {
        return formatDisplayPrice(value);
      }
      return translateStructuredState(value, locale);
    }
    return "";
  });
}

const structuredDriverTemplates: Record<string, Record<LocaleCode, string>> = {
  rule_driver_support: { "zh-CN": "{signalType}支撑整体判断（加权 {weightedScore}）", "en-US": "{signalType} supports the overall view (weighted {weightedScore})." },
  rule_driver_drag: { "zh-CN": "{signalType}拖累整体判断（加权 {weightedScore}）", "en-US": "{signalType} drags on the overall view (weighted {weightedScore})." },
  consistency_aligned: { "zh-CN": "规则与 AI 基本一致", "en-US": "Rules and AI are broadly aligned." },
  consistency_rule_clearer: { "zh-CN": "规则方向更明确", "en-US": "Rules are more directional." },
  consistency_ai_watch: { "zh-CN": "AI 暂时观望", "en-US": "AI remains on watch." },
  consistency_rule_watch: { "zh-CN": "规则暂时观望", "en-US": "Rules remain on watch." },
  consistency_ai_clearer: { "zh-CN": "AI 方向更明确", "en-US": "AI is more directional." },
  consistency_divergent: { "zh-CN": "规则与 AI 存在分歧", "en-US": "Rules and AI are diverging." },
  market_ema_below: { "zh-CN": "EMA20 下穿并维持在 EMA60 下方", "en-US": "EMA20 remains below EMA60 after crossing down." },
  market_ema_above: { "zh-CN": "EMA20 上穿并维持在 EMA60 上方", "en-US": "EMA20 remains above EMA60 after crossing up." },
  market_price_vs_ema20_weak: { "zh-CN": "价格相对 EMA20偏弱", "en-US": "Price is weak versus EMA20." },
  market_price_vs_ema20_strong: { "zh-CN": "价格相对 EMA20偏强", "en-US": "Price is strong versus EMA20." },
  market_price_vs_ema60_weak: { "zh-CN": "价格相对 EMA60偏弱", "en-US": "Price is weak versus EMA60." },
  market_price_vs_ema60_strong: { "zh-CN": "价格相对 EMA60偏强", "en-US": "Price is strong versus EMA60." },
  market_change_4h_strong_up: { "zh-CN": "4H 涨幅明显，短线趋势偏强", "en-US": "The 4H gain is significant and short-term momentum is strong." },
  market_change_4h_up: { "zh-CN": "4H 维持正收益，短线仍偏多", "en-US": "The last 4H remains positive and short-term bias stays bullish." },
  market_change_4h_strong_down: { "zh-CN": "4H 跌幅扩大，短线承压明显", "en-US": "The 4H decline is widening and short-term pressure is clear." },
  market_change_4h_down: { "zh-CN": "4H 小幅回落，短线偏弱", "en-US": "The last 4H pulled back slightly and short-term bias is weak." },
  market_macd_above: { "zh-CN": "MACD 主线位于信号线上方", "en-US": "MACD line is above the signal line." },
  market_macd_below: { "zh-CN": "MACD 主线跌破信号线", "en-US": "MACD line has fallen below the signal line." },
  market_histogram_above: { "zh-CN": "MACD 柱体位于零轴上方", "en-US": "MACD histogram is above zero." },
  market_histogram_below: { "zh-CN": "MACD 柱体位于零轴下方", "en-US": "MACD histogram is below zero." },
  market_change_24h_strong_up: { "zh-CN": "24H 表现偏强，趋势延续性较好", "en-US": "The 24H performance is strong and trend continuation looks healthy." },
  market_change_24h_up: { "zh-CN": "24H 保持正涨幅，整体结构仍稳", "en-US": "The 24H change remains positive and structure is still stable." },
  market_change_24h_strong_down: { "zh-CN": "24H 跌幅偏大，日内结构转弱", "en-US": "The 24H loss is notable and intraday structure is weakening." },
  market_change_24h_down: { "zh-CN": "24H 仍为负收益，日内偏空", "en-US": "The 24H return remains negative and intraday bias is bearish." },
  market_volume_up_strong: { "zh-CN": "上涨伴随明显放量，趋势确认度较高", "en-US": "The rally is backed by clear volume expansion, confirming the trend." },
  market_volume_up: { "zh-CN": "上涨有量能配合，偏多得到确认", "en-US": "The rise is supported by volume and the bullish bias is confirmed." },
  market_volume_down_strong: { "zh-CN": "下跌放量，抛压释放较强", "en-US": "The drop comes with higher volume and selling pressure is strong." },
  market_volume_down: { "zh-CN": "下跌伴随放量，偏空确认度提升", "en-US": "The decline is backed by volume and bearish confirmation is stronger." },
  market_volume_unconfirmed: { "zh-CN": "成交量未明显放大，量能确认不足", "en-US": "Volume has not expanded clearly, so confirmation is limited." },
  market_atr_low: { "zh-CN": "ATR 较低，波动可控", "en-US": "ATR is low and volatility is manageable." },
  market_atr_neutral: { "zh-CN": "ATR 中性，波动尚可接受", "en-US": "ATR is neutral and volatility remains acceptable." },
  market_atr_elevated: { "zh-CN": "ATR 偏高，波动进入观察区", "en-US": "ATR is elevated and volatility has entered a watch zone." },
  market_atr_high: { "zh-CN": "ATR 高企，短线风险上升", "en-US": "ATR is high and short-term risk is rising." },
  market_atr_extreme: { "zh-CN": "ATR 异常偏高，走势噪音和风险都较大", "en-US": "ATR is abnormally high, with elevated noise and risk." },
  community_activity_very_high: { "zh-CN": "社区讨论热度显著放大", "en-US": "Community discussion intensity has expanded sharply." },
  community_activity_active: { "zh-CN": "社区讨论热度处于活跃区间", "en-US": "Community discussion intensity is in an active range." },
  community_activity_limited: { "zh-CN": "社区讨论热度相对有限", "en-US": "Community discussion intensity is relatively limited." },
  community_limited_sample_bullish: { "zh-CN": "社区样本量有限，但方向偏多", "en-US": "Community sample size is limited, but the bias is bullish." },
  community_limited_sample_bearish: { "zh-CN": "社区样本量有限，但方向偏空", "en-US": "Community sample size is limited, but the bias is bearish." },
  community_limited_sample_watch: { "zh-CN": "社区样本量有限，暂未形成明显方向", "en-US": "Community sample size is limited and no clear direction has formed yet." },
  community_topics_scattered: { "zh-CN": "讨论主题较分散", "en-US": "Discussion topics are dispersed." },
  community_sentiment_bullish: { "zh-CN": "偏多 / 偏空帖子为 {positive} / {negative}，情绪偏多", "en-US": "Bullish / bearish posts: {positive} / {negative}, with bullish sentiment." },
  community_sentiment_bearish: { "zh-CN": "偏多 / 偏空帖子为 {positive} / {negative}，情绪偏空", "en-US": "Bullish / bearish posts: {positive} / {negative}, with bearish sentiment." },
  community_sentiment_balanced: { "zh-CN": "偏多 / 偏空帖子为 {positive} / {negative}，整体接近平衡", "en-US": "Bullish / bearish posts: {positive} / {negative}, broadly balanced overall." },
  community_topics_focus: { "zh-CN": "讨论焦点集中在 {topics}", "en-US": "Discussion is concentrated around {topics}." },
  kol_authors_limited: { "zh-CN": "活跃作者数量有限", "en-US": "The number of active authors is limited." },
  kol_sentiment_bullish: { "zh-CN": "偏多 / 偏空观点为 {positive} / {negative}，观点偏多", "en-US": "Bullish / bearish views: {positive} / {negative}, with a bullish lean." },
  kol_sentiment_bearish: { "zh-CN": "偏多 / 偏空观点为 {positive} / {negative}，观点偏空", "en-US": "Bullish / bearish views: {positive} / {negative}, with a bearish lean." },
  kol_sentiment_balanced: { "zh-CN": "偏多 / 偏空观点为 {positive} / {negative}，整体接近平衡", "en-US": "Bullish / bearish views: {positive} / {negative}, broadly balanced overall." },
  kol_core_alignment: { "zh-CN": "{count} 个核心作者参与，出现同向信号", "en-US": "{count} core authors are involved, showing aligned positioning." },
  kol_active_authors_mixed: { "zh-CN": "{count} 个活跃作者参与，但核心作者一致性一般", "en-US": "{count} active authors are involved, though core-author alignment is moderate." },
  kol_topics_focus: { "zh-CN": "高权重讨论集中在 {topics}", "en-US": "High-weight discussion is concentrated around {topics}." },
  news_reason: { "zh-CN": "{category}{sentiment}，来源 {source}，判断基于 {basis}", "en-US": "{category} is {sentiment}, source {source}, based on {basis}." },
  news_driver: { "zh-CN": "{category}{topic}，来源 {source}，整体{sentiment}", "en-US": "{category}{topic}, source {source}, overall {sentiment}." },
  onchain_exchange_outflow_strong: { "zh-CN": "交易所净流出显著放大，链上资金偏多", "en-US": "Exchange net outflows expanded sharply, indicating bullish on-chain flows." },
  onchain_exchange_outflow: { "zh-CN": "交易所净流出扩大，链上资金回流", "en-US": "Exchange net outflows increased, suggesting capital is moving back on-chain." },
  onchain_exchange_outflow_legacy: { "zh-CN": "交易所流出扩大", "en-US": "Exchange outflows are increasing." },
  onchain_exchange_inflow_strong: { "zh-CN": "交易所净流入显著放大，潜在抛压上升", "en-US": "Exchange net inflows expanded sharply, pointing to rising sell pressure." },
  onchain_exchange_inflow: { "zh-CN": "交易所净流入增加，链上偏空", "en-US": "Exchange net inflows increased and on-chain bias is bearish." },
  onchain_exchange_netflow_flat: { "zh-CN": "交易所净流变化有限", "en-US": "Exchange netflow changed only marginally." },
  onchain_stablecoin_inflow_legacy: { "zh-CN": "稳定币净流入改善", "en-US": "Stablecoin net inflows are improving." },
  onchain_large_transfers_strong: { "zh-CN": "链上大额转账明显增多，资金活跃度提升", "en-US": "Large on-chain transfers increased materially and capital activity improved." },
  onchain_large_transfers_active: { "zh-CN": "链上大额转账活跃，资金开始放量", "en-US": "Large on-chain transfers are active and capital flow is picking up." },
  onchain_large_transfers_flat: { "zh-CN": "链上大额转账未明显放量", "en-US": "Large on-chain transfers have not expanded materially." },
  onchain_whale_participation_bullish: { "zh-CN": "大户参与度提升且净增持偏多", "en-US": "Whale participation increased and net accumulation is bullish." },
  onchain_whale_participation_bearish: { "zh-CN": "大户活跃且净减持偏空", "en-US": "Whales are active and net distribution is bearish." },
  onchain_whale_participation_neutral: { "zh-CN": "大户参与度中性", "en-US": "Whale participation is neutral." },
  whale_net_strong_buy: { "zh-CN": "观察名单鲸鱼净增持显著", "en-US": "Watchlist whales show strong net accumulation." },
  whale_net_buy: { "zh-CN": "观察名单鲸鱼净增持偏多", "en-US": "Watchlist whales show bullish net accumulation." },
  whale_net_strong_sell: { "zh-CN": "观察名单鲸鱼净减持显著", "en-US": "Watchlist whales show strong net distribution." },
  whale_net_sell: { "zh-CN": "观察名单鲸鱼净减持偏空", "en-US": "Watchlist whales show bearish net distribution." },
  whale_net_flat: { "zh-CN": "鲸鱼净变化有限", "en-US": "Whale net change is limited." },
  whale_exchange_withdraw_strong: { "zh-CN": "鲸鱼从交易所提出资产明显更多", "en-US": "Whales are withdrawing materially more assets from exchanges." },
  whale_exchange_withdraw: { "zh-CN": "鲸鱼提出交易所资产偏多", "en-US": "Whales are withdrawing more assets from exchanges." },
  whale_exchange_deposit_strong: { "zh-CN": "鲸鱼向交易所转入资产明显更多", "en-US": "Whales are depositing materially more assets to exchanges." },
  whale_exchange_deposit: { "zh-CN": "鲸鱼向交易所转入资产偏多", "en-US": "Whales are depositing more assets to exchanges." },
  whale_exchange_neutral: { "zh-CN": "鲸鱼与交易所之间的转移中性", "en-US": "Whale transfers versus exchanges are neutral." },
  whale_activity_strong: { "zh-CN": "鲸鱼地址活跃度显著提升", "en-US": "Whale address activity increased materially." },
  whale_activity_active: { "zh-CN": "鲸鱼地址开始活跃", "en-US": "Whale addresses are becoming active." },
  whale_activity_limited: { "zh-CN": "鲸鱼活跃度有限", "en-US": "Whale activity is limited." },
  whale_accumulating_4h: { "zh-CN": "鲸鱼地址 4H 内持续加仓", "en-US": "Whale addresses kept accumulating over the last 4H." }
};

const structuredHighlightTemplates: Record<string, Record<LocaleCode, string>> = {
  market_price_cross_above_ema20: { "zh-CN": "价格上穿 EMA20 · 价格 {price} / EMA20 {ema20}", "en-US": "Price crossed above EMA20 · Price {price} / EMA20 {ema20}" },
  market_price_cross_below_ema20: { "zh-CN": "价格跌破 EMA20 · 价格 {price} / EMA20 {ema20}", "en-US": "Price fell below EMA20 · Price {price} / EMA20 {ema20}" },
  market_ema20_cross_above_ema60: { "zh-CN": "EMA20上穿 EMA60 · EMA20 {ema20} / EMA60 {ema60}", "en-US": "EMA20 crossed above EMA60 · EMA20 {ema20} / EMA60 {ema60}" },
  market_ema20_cross_below_ema60: { "zh-CN": "EMA20下穿 EMA60 · EMA20 {ema20} / EMA60 {ema60}", "en-US": "EMA20 crossed below EMA60 · EMA20 {ema20} / EMA60 {ema60}" },
  market_macd_bull_cross: { "zh-CN": "MACD 金叉形成 · MACD {macd} / Signal {signal}", "en-US": "MACD bullish crossover formed · MACD {macd} / Signal {signal}" },
  market_macd_bear_cross: { "zh-CN": "MACD 死叉形成 · MACD {macd} / Signal {signal}", "en-US": "MACD bearish crossover formed · MACD {macd} / Signal {signal}" },
  market_volume_shift: { "zh-CN": "量能转为{state} · 4H 成交量比 {ratio}", "en-US": "Volume shifted to {state} · 4H volume ratio {ratio}" },
  market_volatility_shift: { "zh-CN": "波动率转为{state} · ATR/价格比 {ratio}", "en-US": "Volatility shifted to {state} · ATR/Price {ratio}" },
  market_metric_shift: { "zh-CN": "{metric} 转为 {state}", "en-US": "{metric} shifted to {state}" },
  onchain_exchange_outflow_local_high: { "zh-CN": "交易所净流出达到阶段高位", "en-US": "Exchange net outflows reached a local high" },
  onchain_stablecoin_inflow_improved: { "zh-CN": "稳定币净流入显著改善", "en-US": "Stablecoin net inflows improved materially" },
  onchain_active_addresses_rising: { "zh-CN": "活跃地址数继续抬升", "en-US": "Active address count continues to rise" },
  onchain_large_transfer_frequency_up: { "zh-CN": "大额转账频率上升", "en-US": "The frequency of large transfers is increasing" },
  onchain_large_exchange_withdrawals_up: { "zh-CN": "交易所大额提出增加", "en-US": "Large exchange withdrawals are increasing" },
  onchain_transfer: { "zh-CN": "{token} {amount} {action}", "en-US": "{token} {amount} {action}" },
  whale_accumulating_4h: { "zh-CN": "鲸鱼地址 4H 内持续加仓", "en-US": "Whale addresses kept accumulating over the last 4H." }
};

const structuredMetricValueTemplates: Record<string, Record<LocaleCode, string>> = {
  count_items: { "zh-CN": "{count} 条", "en-US": "{count} items" },
  count_transfers: { "zh-CN": "{count} 笔", "en-US": "{count} transfers" },
  count_addresses: { "zh-CN": "{count} 个", "en-US": "{count}" },
  state_with_ratio: { "zh-CN": "{state} {ratio}", "en-US": "{state} {ratio}" },
  state_with_percent: { "zh-CN": "{state} {percent}", "en-US": "{state} {percent}" },
  price_above_ema20: { "zh-CN": "Price > EMA20", "en-US": "Price > EMA20" },
  price_below_ema20: { "zh-CN": "Price < EMA20", "en-US": "Price < EMA20" },
  ema20_above_ema60: { "zh-CN": "EMA20 > EMA60", "en-US": "EMA20 > EMA60" },
  ema20_below_ema60: { "zh-CN": "EMA20 < EMA60", "en-US": "EMA20 < EMA60" },
  macd_bull_cross: { "zh-CN": "金叉", "en-US": "Bullish Cross" },
  macd_bear_cross: { "zh-CN": "死叉", "en-US": "Bearish Cross" }
};

function renderStructuredDriver(
  textKey: string | undefined,
  textParams: Record<string, string | number> | undefined,
  locale: LocaleCode
) {
  if (!textKey) {
    return "";
  }

  if (textKey === "news_reason") {
    const category = translateStructuredState(String(textParams?.category ?? ""), locale);
    const sentiment = translateStructuredState(String(textParams?.sentiment ?? ""), locale);
    const source = String(textParams?.source ?? "");
    const basis = translateStructuredState(String(textParams?.basis ?? ""), locale);
    return locale === "en-US"
      ? `${category} is ${sentiment}, source ${source}, based on ${basis}.`
      : `${textParams?.category ?? ""}${textParams?.sentiment ?? ""}，来源 ${source}，判断基于 ${textParams?.basis ?? ""}`;
  }

  if (textKey === "news_driver") {
    const categoryRaw = String(textParams?.category ?? "");
    const topicRaw = String(textParams?.topic ?? "");
    const source = String(textParams?.source ?? "");
    const sentimentRaw = String(textParams?.sentiment ?? "");
    if (locale === "en-US") {
      const category = translateStructuredState(categoryRaw, locale);
      const topic = topicRaw ? ` focused on ${translateTopics(topicRaw)}` : "";
      const sentiment = translateStructuredState(sentimentRaw, locale);
      return `${category}${topic}, source ${source}, overall ${sentiment}.`;
    }

    return `${categoryRaw}${topicRaw ? `聚焦${topicRaw}` : ""}，来源 ${source}，整体${sentimentRaw}`;
  }

  if (textKey === "rule_driver_support" || textKey === "rule_driver_drag") {
    const signalType = signalLabel(String(textParams?.signalType ?? ""), locale, String(textParams?.signalType ?? ""));
    const weightedScoreValue = Number(textParams?.weightedScore ?? 0);
    const weightedScore = Number.isFinite(weightedScoreValue)
      ? `${weightedScoreValue > 0 ? "+" : ""}${weightedScoreValue}`
      : String(textParams?.weightedScore ?? "");
    return locale === "en-US"
      ? `${signalType}${textKey === "rule_driver_support" ? " supports" : " drags on"} the overall view (weighted ${weightedScore}).`
      : `${signalType}${textKey === "rule_driver_support" ? "支撑" : "拖累"}整体判断（加权 ${weightedScore}）`;
  }

  const template = structuredDriverTemplates[textKey]?.[locale];
  return template ? applyTemplate(template, textParams, locale) : "";
}

function renderStructuredHighlight(
  titleKey: string | undefined,
  titleParams: Record<string, string | number> | undefined,
  locale: LocaleCode
) {
  if (!titleKey) {
    return "";
  }

  const template = structuredHighlightTemplates[titleKey]?.[locale];
  return template ? applyTemplate(template, titleParams, locale) : "";
}

function renderStructuredMetricValue(
  valueKey: string | undefined,
  valueParams: Record<string, string | number> | undefined,
  locale: LocaleCode
) {
  if (!valueKey) {
    return "";
  }

  const template = structuredMetricValueTemplates[valueKey]?.[locale];
  return template ? applyTemplate(template, valueParams, locale) : "";
}

export function formatSignalDriver(
  driver: string | undefined,
  locale: LocaleCode = "zh-CN",
  driverItem?: { textKey?: string; textParams?: Record<string, string | number> }
): string {
  const structured = renderStructuredDriver(driverItem?.textKey, driverItem?.textParams, locale);
  if (structured) {
    return structured;
  }

  return signalTextLabel(driver, locale);
}

export function formatSummaryItems(
  summary: string | undefined,
  locale: LocaleCode = "zh-CN",
  summaryItems?: Array<{ textKey?: string; textParams?: Record<string, string | number> } | null>
): string {
  const rendered = (summaryItems ?? [])
    .map((item) => formatSignalDriver(undefined, locale, item ?? undefined))
    .filter(Boolean);

  if (rendered.length > 0) {
    return locale === "en-US" ? rendered.join(" ") : rendered.join("；");
  }

  return signalTextLabel(summary, locale);
}

export function formatSignalMetricLabel(
  metric: SignalMetric,
  locale: LocaleCode = "zh-CN"
): string {
  const structuredNameMap: Record<string, string> = {
    change_24h: "24H 涨跌",
    change_4h: "4H 涨跌",
    ema: "EMA",
    ma_structure: "均线",
    macd: "MACD",
    volume: "量能",
    volatility: "波动",
    news_samples: "新闻样本",
    asset_specific_items: "单币种事件",
    positive_negative: "正向 / 负向",
    recent_24h: "最近 24H",
    post_count: "帖子数量",
    activity_weight: "热度权重",
    bullish_bearish_posts: "偏多 / 偏空帖子",
    average_sentiment: "平均情绪",
    kol_post_count: "KOL 帖子数",
    active_authors: "活跃作者数",
    core_watchlist: "核心 / 观察名单",
    bullish_bearish_views: "偏多 / 偏空观点",
    exchange_netflow: "交易所净流",
    exchange_net_outflow: "交易所净流出",
    exchange_inflow_outflow: "交易所流入 / 流出",
    stablecoin_net_inflow: "稳定币净流入",
    large_transfers: "大额转账",
    large_transfer_volume: "大额转账总额",
    net_accumulation: "净增持",
    whale_net_change: "鲸鱼净变化",
    whale_buy_sell: "鲸鱼买入 / 卖出",
    whale_trades: "鲸鱼交易次数",
    active_addresses: "活跃地址数"
  };

  return signalMetricLabel(structuredNameMap[metric.nameKey ?? ""] ?? metric.name, locale);
}

export function formatSignalMetricValue(
  metric: SignalMetric,
  locale: LocaleCode = "zh-CN"
): string {
  const structured = renderStructuredMetricValue(metric.valueKey, metric.valueParams, locale);
  if (structured) {
    return structured;
  }

  return signalMetricValue(metric.value, locale);
}

export function formatSignalHighlightTitle(
  highlight: Pick<SignalHighlight, "title" | "titleKey" | "titleParams">,
  locale: LocaleCode = "zh-CN"
): string {
  const structured = renderStructuredHighlight(highlight.titleKey, highlight.titleParams, locale);
  if (structured) {
    return structured;
  }

  return signalHighlightTitle(highlight.title, locale);
}

export function signalTextLabel(
  text: string | undefined,
  locale: LocaleCode = "zh-CN"
): string {
  if (!text || locale !== "en-US") {
    return text ?? "";
  }

  const supportMatch = text.match(/^(市场信号|新闻信号|社区信号|KOL 信号|链上信号|鲸鱼信号)(支撑|拖累)整体判断（加权 ([+-]?\d+)）$/);
  if (supportMatch) {
    return `${signalLabel(
      supportMatch[1]
        .replace("信号", "")
        .replace("KOL ", "kol")
        .replace("市场", "market")
        .replace("新闻", "news")
        .replace("社区", "community")
        .replace("链上", "onchain")
        .replace("鲸鱼", "whale"),
      locale,
      supportMatch[1]
    )} ${supportMatch[2] === "支撑" ? "supports" : "drags on"} the overall view (weighted ${supportMatch[3]}).`;
  }

  const exactMap: Record<string, string> = {
    "EMA20 下穿并维持在 EMA60 下方": "EMA20 remains below EMA60 after crossing down.",
    "EMA20 上穿并维持在 EMA60 上方": "EMA20 remains above EMA60 after crossing up.",
    "价格相对 EMA20偏弱": "Price is weak versus EMA20.",
    "价格相对 EMA20偏强": "Price is strong versus EMA20.",
    "价格相对 EMA60偏弱": "Price is weak versus EMA60.",
    "价格相对 EMA60偏强": "Price is strong versus EMA60.",
    "4H 涨幅明显，短线趋势偏强": "The 4H gain is significant and short-term momentum is strong.",
    "4H 维持正收益，短线仍偏多": "The last 4H remains positive and short-term bias stays bullish.",
    "4H 跌幅扩大，短线承压明显": "The 4H decline is widening and short-term pressure is clear.",
    "4H 小幅回落，短线偏弱": "The last 4H pulled back slightly and short-term bias is weak.",
    "MACD 主线位于信号线上方": "MACD line is above the signal line.",
    "MACD 主线跌破信号线": "MACD line has fallen below the signal line.",
    "MACD 柱体位于零轴上方": "MACD histogram is above zero.",
    "MACD 柱体位于零轴下方": "MACD histogram is below zero.",
    "24H 表现偏强，趋势延续性较好": "The 24H performance is strong and trend continuation looks healthy.",
    "24H 保持正涨幅，整体结构仍稳": "The 24H change remains positive and structure is still stable.",
    "24H 跌幅偏大，日内结构转弱": "The 24H loss is notable and intraday structure is weakening.",
    "24H 仍为负收益，日内偏空": "The 24H return remains negative and intraday bias is bearish.",
    "上涨伴随明显放量，趋势确认度较高": "The rally is backed by clear volume expansion, confirming the trend.",
    "上涨有量能配合，偏多得到确认": "The rise is supported by volume and the bullish bias is confirmed.",
    "下跌放量，抛压释放较强": "The drop comes with higher volume and selling pressure is strong.",
    "下跌伴随放量，偏空确认度提升": "The decline is backed by volume and bearish confirmation is stronger.",
    "成交量未明显放大，量能确认不足": "Volume has not expanded clearly, so confirmation is limited.",
    "ATR 较低，波动可控": "ATR is low and volatility is manageable.",
    "ATR 中性，波动尚可接受": "ATR is neutral and volatility remains acceptable.",
    "ATR 偏高，波动进入观察区": "ATR is elevated and volatility has entered a watch zone.",
    "ATR 高企，短线风险上升": "ATR is high and short-term risk is rising.",
    "ATR 异常偏高，走势噪音和风险都较大": "ATR is abnormally high, with elevated noise and risk.",
    "社区讨论热度显著放大": "Community discussion intensity has expanded sharply.",
    "社区讨论热度处于活跃区间": "Community discussion intensity is in an active range.",
    "社区讨论热度相对有限": "Community discussion intensity is relatively limited.",
    "社区样本量有限，但方向偏多": "Community sample size is limited, but the bias is bullish.",
    "社区样本量有限，但方向偏空": "Community sample size is limited, but the bias is bearish.",
    "社区样本量有限，暂未形成明显方向": "Community sample size is limited and no clear direction has formed yet.",
    "讨论主题较分散": "Discussion topics are dispersed.",
    "活跃作者数量有限": "The number of active authors is limited.",
    "交易所净流出显著放大，链上资金偏多": "Exchange net outflows expanded sharply, indicating bullish on-chain flows.",
    "交易所净流出扩大，链上资金回流": "Exchange net outflows increased, suggesting capital is moving back on-chain.",
    "交易所净流入显著放大，潜在抛压上升": "Exchange net inflows expanded sharply, pointing to rising sell pressure.",
    "交易所净流入增加，链上偏空": "Exchange net inflows increased and on-chain bias is bearish.",
    "交易所净流变化有限": "Exchange netflow changed only marginally.",
    "链上大额转账明显增多，资金活跃度提升": "Large on-chain transfers increased materially and capital activity improved.",
    "链上大额转账活跃，资金开始放量": "Large on-chain transfers are active and capital flow is picking up.",
    "链上大额转账未明显放量": "Large on-chain transfers have not expanded materially.",
    "大户参与度提升且净增持偏多": "Whale participation increased and net accumulation is bullish.",
    "大户活跃且净减持偏空": "Whales are active and net distribution is bearish.",
    "大户参与度中性": "Whale participation is neutral.",
    "观察名单鲸鱼净增持显著": "Watchlist whales show strong net accumulation.",
    "观察名单鲸鱼净增持偏多": "Watchlist whales show bullish net accumulation.",
    "观察名单鲸鱼净减持显著": "Watchlist whales show strong net distribution.",
    "观察名单鲸鱼净减持偏空": "Watchlist whales show bearish net distribution.",
    "鲸鱼净变化有限": "Whale net change is limited.",
    "鲸鱼从交易所提出资产明显更多": "Whales are withdrawing materially more assets from exchanges.",
    "鲸鱼提出交易所资产偏多": "Whales are withdrawing more assets from exchanges.",
    "鲸鱼向交易所转入资产明显更多": "Whales are depositing materially more assets to exchanges.",
    "鲸鱼向交易所转入资产偏多": "Whales are depositing more assets to exchanges.",
    "鲸鱼与交易所之间的转移中性": "Whale transfers versus exchanges are neutral.",
    "鲸鱼地址活跃度显著提升": "Whale address activity increased materially.",
    "鲸鱼地址开始活跃": "Whale addresses are becoming active.",
    "鲸鱼活跃度有限": "Whale activity is limited.",
    "交易所流出扩大": "Exchange outflows are increasing.",
    "稳定币净流入改善": "Stablecoin net inflows are improving.",
    "鲸鱼地址 4H 内持续加仓": "Whale addresses kept accumulating over the last 4H.",
    "交易所净流出达到阶段高位": "Exchange net outflows reached a local high.",
    "稳定币净流入显著改善": "Stablecoin net inflows improved materially.",
    "活跃地址数继续抬升": "Active address count continues to rise.",
    "大额转账频率上升": "The frequency of large transfers is increasing.",
    "交易所大额提出增加": "Large exchange withdrawals are increasing."
  };

  if (exactMap[text]) {
    return exactMap[text];
  }

  let next = text;
  next = next.replace(/偏多 \/ 偏空帖子为 (\d+) \/ (\d+)，情绪偏多/, "Bullish / bearish posts: $1 / $2, with bullish sentiment.");
  next = next.replace(/偏多 \/ 偏空帖子为 (\d+) \/ (\d+)，情绪偏空/, "Bullish / bearish posts: $1 / $2, with bearish sentiment.");
  next = next.replace(/偏多 \/ 偏空帖子为 (\d+) \/ (\d+)，整体接近平衡/, "Bullish / bearish posts: $1 / $2, broadly balanced overall.");
  next = next.replace(/偏多 \/ 偏空观点为 (\d+) \/ (\d+)，观点偏多/, "Bullish / bearish views: $1 / $2, with a bullish lean.");
  next = next.replace(/偏多 \/ 偏空观点为 (\d+) \/ (\d+)，观点偏空/, "Bullish / bearish views: $1 / $2, with a bearish lean.");
  next = next.replace(/偏多 \/ 偏空观点为 (\d+) \/ (\d+)，整体接近平衡/, "Bullish / bearish views: $1 / $2, broadly balanced overall.");
  next = next.replace(/(\d+) 个核心作者参与，出现同向信号/, "$1 core authors are involved, showing aligned positioning.");
  next = next.replace(/(\d+) 个活跃作者参与，但核心作者一致性一般/, "$1 active authors are involved, though core-author alignment is moderate.");
  next = next.replace(/讨论焦点集中在 (.+)/, (_, topics: string) => `Discussion is concentrated around ${translateTopics(topics).replaceAll("、", ", ")}.`);
  next = next.replace(/高权重讨论集中在 (.+)/, (_, topics: string) => `High-weight discussion is concentrated around ${translateTopics(topics).replaceAll("、", ", ")}.`);
  next = next.replace(/单币种新闻偏多，来源 (.+)，判断基于 (.+)/, "Asset-specific news is bullish, source $1, based on $2.");
  next = next.replace(/单币种新闻偏空，来源 (.+)，判断基于 (.+)/, "Asset-specific news is bearish, source $1, based on $2.");
  next = next.replace(/单币种新闻中性，来源 (.+)，判断基于 (.+)/, "Asset-specific news is neutral, source $1, based on $2.");
  next = next.replace(/宏观金融新闻偏多，来源 (.+)，判断基于 (.+)/, "Macro-finance news is bullish, source $1, based on $2.");
  next = next.replace(/宏观金融新闻偏空，来源 (.+)，判断基于 (.+)/, "Macro-finance news is bearish, source $1, based on $2.");
  next = next.replace(/宏观金融新闻中性，来源 (.+)，判断基于 (.+)/, "Macro-finance news is neutral, source $1, based on $2.");
  next = next.replace(/政治事件新闻偏多，来源 (.+)，判断基于 (.+)/, "Political news is bullish, source $1, based on $2.");
  next = next.replace(/政治事件新闻偏空，来源 (.+)，判断基于 (.+)/, "Political news is bearish, source $1, based on $2.");
  next = next.replace(/政治事件新闻中性，来源 (.+)，判断基于 (.+)/, "Political news is neutral, source $1, based on $2.");
  next = next.replace(/行业新闻偏多，来源 (.+)，判断基于 (.+)/, "Industry news is bullish, source $1, based on $2.");
  next = next.replace(/行业新闻偏空，来源 (.+)，判断基于 (.+)/, "Industry news is bearish, source $1, based on $2.");
  next = next.replace(/行业新闻中性，来源 (.+)，判断基于 (.+)/, "Industry news is neutral, source $1, based on $2.");
  next = next.replace(/单币新闻聚焦([A-Z0-9]+)，来源 (.+)，整体偏多/, "Asset-specific news is focused on $1, source $2, overall bullish.");
  next = next.replace(/单币新闻聚焦([A-Z0-9]+)，来源 (.+)，整体偏空/, "Asset-specific news is focused on $1, source $2, overall bearish.");
  next = next.replace(/行业新闻聚焦(.+)，来源 (.+)，整体偏多/, "Industry news is focused on $1, source $2, overall bullish.");
  next = next.replace(/行业新闻聚焦(.+)，来源 (.+)，整体偏空/, "Industry news is focused on $1, source $2, overall bearish.");
  next = next.replace(/行业新闻，来源 (.+)，整体偏多/, "Industry news, source $1, overall bullish.");
  next = next.replace(/行业新闻，来源 (.+)，整体偏空/, "Industry news, source $1, overall bearish.");
  next = next.replace(/政治宏观，来源 (.+)，整体偏多/, "Macro-political coverage, source $1, overall bullish.");
  next = next.replace(/政治宏观，来源 (.+)，整体偏空/, "Macro-political coverage, source $1, overall bearish.");
  next = next.replace(/宏观金融，来源 (.+)，整体偏多/, "Macro-finance coverage, source $1, overall bullish.");
  next = next.replace(/宏观金融，来源 (.+)，整体偏空/, "Macro-finance coverage, source $1, overall bearish.");
  return next;
}

export function signalHighlightTitle(
  title: string | undefined,
  locale: LocaleCode = "zh-CN"
): string {
  if (!title || locale !== "en-US") {
    return title ?? "";
  }

  let next = title;
  next = next.replace(/价格上穿 EMA20 · 价格 ([\d.]+) \/ EMA20 ([\d.]+)/, "Price crossed above EMA20 · Price $1 / EMA20 $2");
  next = next.replace(/价格跌破 EMA20 · 价格 ([\d.]+) \/ EMA20 ([\d.]+)/, "Price fell below EMA20 · Price $1 / EMA20 $2");
  next = next.replace(/EMA20上穿 EMA60 · EMA20 ([\d.]+) \/ EMA60 ([\d.]+)/, "EMA20 crossed above EMA60 · EMA20 $1 / EMA60 $2");
  next = next.replace(/EMA20下穿 EMA60 · EMA20 ([\d.]+) \/ EMA60 ([\d.]+)/, "EMA20 crossed below EMA60 · EMA20 $1 / EMA60 $2");
  next = next.replace(/MACD 金叉形成 · MACD ([\d.-]+) \/ Signal ([\d.-]+)/, "MACD bullish crossover formed · MACD $1 / Signal $2");
  next = next.replace(/MACD 死叉形成 · MACD ([\d.-]+) \/ Signal ([\d.-]+)/, "MACD bearish crossover formed · MACD $1 / Signal $2");
  next = next.replace(/量能转为(.+) · 4H 成交量比 ([\d.]+)x/, "Volume shifted to $1 · 4H volume ratio $2x");
  next = next.replace(/波动率转为(.+) · ATR\/价格比 ([\d.]+)%/, "Volatility shifted to $1 · ATR/Price $2%");
  next = next.replace(/^交易所净流出达到阶段高位$/, "Exchange net outflows reached a local high");
  next = next.replace(/^稳定币净流入显著改善$/, "Stablecoin net inflows improved materially");
  next = next.replace(/^活跃地址数继续抬升$/, "Active address count continues to rise");
  next = next.replace(/^大额转账频率上升$/, "The frequency of large transfers is increasing");
  next = next.replace(/^交易所大额提出增加$/, "Large exchange withdrawals are increasing");
  next = next.replace(/转出交易所$/, "left exchanges");
  next = next.replace(/转入交易所$/, "moved into exchanges");
  next = next.replace(/链上转移$/, "moved on-chain");
  next = next.replaceAll("缩量", "low volume");
  next = next.replaceAll("正常量能", "normal volume");
  next = next.replaceAll("放量", "expanded volume");
  next = next.replaceAll("异常放量", "extreme volume");
  next = next.replaceAll("低波动", "low volatility");
  next = next.replaceAll("中性波动", "neutral volatility");
  next = next.replaceAll("高波动观察区", "elevated volatility");
  next = next.replaceAll("高风险波动", "high-risk volatility");
  next = next.replaceAll("异常波动", "extreme volatility");
  return next;
}

export function signalMetricValue(
  value: string | undefined,
  locale: LocaleCode = "zh-CN"
): string {
  if (!value || locale !== "en-US") {
    return value ?? "";
  }

  let next = value;
  next = next.replace(/(\d+)\s*条/g, "$1 items");
  next = next.replace(/(\d+)\s*个/g, "$1");
  next = next.replace(/低波动/g, "low volatility");
  next = next.replace(/中性波动/g, "neutral volatility");
  next = next.replace(/高波动观察区/g, "elevated volatility");
  next = next.replace(/高风险波动/g, "high-risk volatility");
  next = next.replace(/异常波动/g, "extreme volatility");
  next = next.replace(/缩量/g, "low volume");
  next = next.replace(/正常量能/g, "normal volume");
  next = next.replace(/放量/g, "expanded volume");
  next = next.replace(/异常放量/g, "extreme volume");
  return next;
}

export function aiToBiasLevel(
  direction: Direction,
  strength?: string,
  confidence?: string
): BiasLevel {
  if (direction === "watch") {
    return "watch";
  }

  if (direction === "bullish") {
    if (strength === "强" && confidence === "高") {
      return "super_bullish";
    }

    if (strength === "强" || confidence === "高") {
      return "strong_bullish";
    }

    return "weak_bullish";
  }

  if (strength === "强" && confidence === "高") {
    return "super_bearish";
  }

  if (strength === "强" || confidence === "高") {
    return "strong_bearish";
  }

  return "weak_bearish";
}

export function formatRelativeTime(value?: string, locale: LocaleCode = "zh-CN"): string {
  if (!value) {
    return "";
  }

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return "";
  }

  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(0, Math.round(diffMs / 60_000));

  if (diffMinutes < 1) {
    return locale === "en-US" ? "Just now" : "刚刚";
  }

  if (diffMinutes < 60) {
    return locale === "en-US" ? `${diffMinutes} min ago` : `${diffMinutes} 分钟前`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return locale === "en-US" ? `${diffHours} hr ago` : `${diffHours} 小时前`;
  }

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) {
    return locale === "en-US" ? `${diffDays} day ago` : `${diffDays} 天前`;
  }

  return new Date(value).toLocaleString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function formatAbsoluteTime(value?: string, locale: LocaleCode = "zh-CN"): string {
  if (!value) {
    return "";
  }

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return "";
  }

  return new Date(value).toLocaleString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function signalAbbreviation(type: string, locale: LocaleCode = "zh-CN"): string {
  const normalizedType = type.trim().toLowerCase();
  return signalAbbreviationMap[locale][normalizedType] ?? type.slice(0, 1).toUpperCase();
}

export function sortSignalsForDisplay<T extends { type: string }>(signals: T[]): T[] {
  return [...signals].sort((left, right) => {
    const leftIndex = signalDisplayOrder.indexOf(left.type.trim().toLowerCase() as (typeof signalDisplayOrder)[number]);
    const rightIndex = signalDisplayOrder.indexOf(right.type.trim().toLowerCase() as (typeof signalDisplayOrder)[number]);

    if (leftIndex === -1 && rightIndex === -1) {
      return left.type.localeCompare(right.type);
    }

    if (leftIndex === -1) {
      return 1;
    }

    if (rightIndex === -1) {
      return -1;
    }

    return leftIndex - rightIndex;
  });
}

export function formatDisplayPrice(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value.trim().replace(/^\$+/, "$");
}
