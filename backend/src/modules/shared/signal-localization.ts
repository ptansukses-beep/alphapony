export type LocalizationParams = Record<string, string | number>;

export type LocalizedDriverItem = {
  textKey: string;
  textParams?: LocalizationParams;
};

export type LocalizedConsistencyItem = {
  textKey: string;
  textParams?: LocalizationParams;
};

export type LocalizedMetric = {
  nameKey?: string;
  valueKey?: string;
  valueParams?: LocalizationParams;
};

export type LocalizedHighlight = {
  titleKey?: string;
  titleParams?: LocalizationParams;
};

function normalizeMoneyString(value: string) {
  return value.trim().replace(/^\$+/, "$");
}

function toTopicList(topics: string) {
  return topics.split("、").map((item) => item.trim()).filter(Boolean);
}

export function getLocalizedDriverItem(text: string): LocalizedDriverItem | undefined {
  const exactDriverKeyMap: Record<string, string> = {
    "EMA20 下穿并维持在 EMA60 下方": "market_ema_below",
    "EMA20 上穿并维持在 EMA60 上方": "market_ema_above",
    "价格相对 EMA20偏弱": "market_price_vs_ema20_weak",
    "价格相对 EMA20偏强": "market_price_vs_ema20_strong",
    "价格相对 EMA60偏弱": "market_price_vs_ema60_weak",
    "价格相对 EMA60偏强": "market_price_vs_ema60_strong",
    "4H 涨幅明显，短线趋势偏强": "market_change_4h_strong_up",
    "4H 维持正收益，短线仍偏多": "market_change_4h_up",
    "4H 跌幅扩大，短线承压明显": "market_change_4h_strong_down",
    "4H 小幅回落，短线偏弱": "market_change_4h_down",
    "MACD 主线位于信号线上方": "market_macd_above",
    "MACD 主线跌破信号线": "market_macd_below",
    "MACD 柱体位于零轴上方": "market_histogram_above",
    "MACD 柱体位于零轴下方": "market_histogram_below",
    "24H 表现偏强，趋势延续性较好": "market_change_24h_strong_up",
    "24H 保持正涨幅，整体结构仍稳": "market_change_24h_up",
    "24H 跌幅偏大，日内结构转弱": "market_change_24h_strong_down",
    "24H 仍为负收益，日内偏空": "market_change_24h_down",
    "上涨伴随明显放量，趋势确认度较高": "market_volume_up_strong",
    "上涨有量能配合，偏多得到确认": "market_volume_up",
    "下跌放量，抛压释放较强": "market_volume_down_strong",
    "下跌伴随放量，偏空确认度提升": "market_volume_down",
    "成交量未明显放大，量能确认不足": "market_volume_unconfirmed",
    "ATR 较低，波动可控": "market_atr_low",
    "ATR 中性，波动尚可接受": "market_atr_neutral",
    "ATR 偏高，波动进入观察区": "market_atr_elevated",
    "ATR 高企，短线风险上升": "market_atr_high",
    "ATR 异常偏高，走势噪音和风险都较大": "market_atr_extreme",
    "社区讨论热度显著放大": "community_activity_very_high",
    "社区讨论热度处于活跃区间": "community_activity_active",
    "社区讨论热度相对有限": "community_activity_limited",
    "社区样本量有限，但方向偏多": "community_limited_sample_bullish",
    "社区样本量有限，但方向偏空": "community_limited_sample_bearish",
    "社区样本量有限，暂未形成明显方向": "community_limited_sample_watch",
    "讨论主题较分散": "community_topics_scattered",
    "活跃作者数量有限": "kol_authors_limited",
    "交易所净流出显著放大，链上资金偏多": "onchain_exchange_outflow_strong",
    "交易所净流出扩大，链上资金回流": "onchain_exchange_outflow",
    "交易所净流入显著放大，潜在抛压上升": "onchain_exchange_inflow_strong",
    "交易所净流入增加，链上偏空": "onchain_exchange_inflow",
    "交易所净流变化有限": "onchain_exchange_netflow_flat",
    "链上大额转账明显增多，资金活跃度提升": "onchain_large_transfers_strong",
    "链上大额转账活跃，资金开始放量": "onchain_large_transfers_active",
    "链上大额转账未明显放量": "onchain_large_transfers_flat",
    "大户参与度提升且净增持偏多": "onchain_whale_participation_bullish",
    "大户活跃且净减持偏空": "onchain_whale_participation_bearish",
    "大户参与度中性": "onchain_whale_participation_neutral",
    "观察名单鲸鱼净增持显著": "whale_net_strong_buy",
    "观察名单鲸鱼净增持偏多": "whale_net_buy",
    "观察名单鲸鱼净减持显著": "whale_net_strong_sell",
    "观察名单鲸鱼净减持偏空": "whale_net_sell",
    "鲸鱼净变化有限": "whale_net_flat",
    "鲸鱼从交易所提出资产明显更多": "whale_exchange_withdraw_strong",
    "鲸鱼提出交易所资产偏多": "whale_exchange_withdraw",
    "鲸鱼向交易所转入资产明显更多": "whale_exchange_deposit_strong",
    "鲸鱼向交易所转入资产偏多": "whale_exchange_deposit",
    "鲸鱼与交易所之间的转移中性": "whale_exchange_neutral",
    "鲸鱼地址活跃度显著提升": "whale_activity_strong",
    "鲸鱼地址开始活跃": "whale_activity_active",
    "鲸鱼活跃度有限": "whale_activity_limited",
    "交易所流出扩大": "onchain_exchange_outflow_legacy",
    "稳定币净流入改善": "onchain_stablecoin_inflow_legacy",
    "鲸鱼地址 4H 内持续加仓": "whale_accumulating_4h"
  };

  const exactKey = exactDriverKeyMap[text];
  if (exactKey) {
    return { textKey: exactKey };
  }

  let match = text.match(/^偏多 \/ 偏空帖子为 (\d+) \/ (\d+)，情绪偏多$/);
  if (match) {
    return { textKey: "community_sentiment_bullish", textParams: { positive: Number(match[1]), negative: Number(match[2]) } };
  }
  match = text.match(/^偏多 \/ 偏空帖子为 (\d+) \/ (\d+)，情绪偏空$/);
  if (match) {
    return { textKey: "community_sentiment_bearish", textParams: { positive: Number(match[1]), negative: Number(match[2]) } };
  }
  match = text.match(/^偏多 \/ 偏空帖子为 (\d+) \/ (\d+)，整体接近平衡$/);
  if (match) {
    return { textKey: "community_sentiment_balanced", textParams: { positive: Number(match[1]), negative: Number(match[2]) } };
  }
  match = text.match(/^偏多 \/ 偏空观点为 (\d+) \/ (\d+)，观点偏多$/);
  if (match) {
    return { textKey: "kol_sentiment_bullish", textParams: { positive: Number(match[1]), negative: Number(match[2]) } };
  }
  match = text.match(/^偏多 \/ 偏空观点为 (\d+) \/ (\d+)，观点偏空$/);
  if (match) {
    return { textKey: "kol_sentiment_bearish", textParams: { positive: Number(match[1]), negative: Number(match[2]) } };
  }
  match = text.match(/^偏多 \/ 偏空观点为 (\d+) \/ (\d+)，整体接近平衡$/);
  if (match) {
    return { textKey: "kol_sentiment_balanced", textParams: { positive: Number(match[1]), negative: Number(match[2]) } };
  }
  match = text.match(/^讨论焦点集中在 (.+)$/);
  if (match) {
    return { textKey: "community_topics_focus", textParams: { topics: toTopicList(match[1]).join("|") } };
  }
  match = text.match(/^高权重讨论集中在 (.+)$/);
  if (match) {
    return { textKey: "kol_topics_focus", textParams: { topics: toTopicList(match[1]).join("|") } };
  }
  match = text.match(/^(\d+) 个核心作者参与，出现同向信号$/);
  if (match) {
    return { textKey: "kol_core_alignment", textParams: { count: Number(match[1]) } };
  }
  match = text.match(/^(\d+) 个活跃作者参与，但核心作者一致性一般$/);
  if (match) {
    return { textKey: "kol_active_authors_mixed", textParams: { count: Number(match[1]) } };
  }

  match = text.match(/^(单币种新闻|宏观金融新闻|政治事件新闻|行业新闻)(偏多|偏空|中性)，来源 (.+)，判断基于 (.+)$/);
  if (match) {
    return {
      textKey: "news_reason",
      textParams: {
        category: match[1],
        sentiment: match[2],
        source: match[3],
        basis: match[4]
      }
    };
  }

  match = text.match(/^(单币新闻|宏观金融|政治宏观|行业新闻)(?:聚焦(.+))?，来源 (.+)，整体(偏多|偏空|中性)$/);
  if (match) {
    return {
      textKey: "news_driver",
      textParams: {
        category: match[1],
        topic: match[2] ?? "",
        source: match[3],
        sentiment: match[4]
      }
    };
  }

  return undefined;
}

export function getLocalizedRuleDriverItem(text: string): LocalizedDriverItem | undefined {
  const match = text.match(
    /^(市场信号|新闻信号|社区信号|KOL 信号|链上信号|鲸鱼信号)(支撑|拖累)整体判断（加权 ([+-]?\d+)）$/
  );
  if (!match) {
    return undefined;
  }

  const signalTypeMap: Record<string, string> = {
    "市场信号": "market",
    "新闻信号": "news",
    "社区信号": "community",
    "KOL 信号": "kol",
    "链上信号": "onchain",
    "鲸鱼信号": "whale"
  };

  return {
    textKey: match[2] === "支撑" ? "rule_driver_support" : "rule_driver_drag",
    textParams: {
      signalType: signalTypeMap[match[1]] ?? match[1],
      weightedScore: Number(match[3])
    }
  };
}

export function getLocalizedConsistencyItems(consistency: string): LocalizedConsistencyItem[] {
  switch (consistency.trim()) {
    case "规则与 AI 基本一致":
      return [{ textKey: "consistency_aligned" }];
    case "规则方向更明确，AI 暂时观望":
      return [{ textKey: "consistency_rule_clearer" }, { textKey: "consistency_ai_watch" }];
    case "规则暂时观望，AI 方向更明确":
      return [{ textKey: "consistency_rule_watch" }, { textKey: "consistency_ai_clearer" }];
    case "规则与 AI 存在分歧":
      return [{ textKey: "consistency_divergent" }];
    default:
      return [];
  }
}

export function getLocalizedMetric(name: string, value: string): LocalizedMetric {
  const nameKeyMap: Record<string, string> = {
    "24H 涨跌": "change_24h",
    "4H 涨跌": "change_4h",
    "EMA": "ema",
    "均线": "ma_structure",
    "MACD": "macd",
    "量能": "volume",
    "波动": "volatility",
    "新闻样本": "news_samples",
    "单币种事件": "asset_specific_items",
    "正向 / 负向": "positive_negative",
    "最近 24H": "recent_24h",
    "帖子数量": "post_count",
    "热度权重": "activity_weight",
    "偏多 / 偏空帖子": "bullish_bearish_posts",
    "平均情绪": "average_sentiment",
    "KOL 帖子数": "kol_post_count",
    "活跃作者数": "active_authors",
    "核心 / 观察名单": "core_watchlist",
    "偏多 / 偏空观点": "bullish_bearish_views",
    "交易所净流": "exchange_netflow",
    "交易所净流出": "exchange_net_outflow",
    "交易所流入 / 流出": "exchange_inflow_outflow",
    "稳定币净流入": "stablecoin_net_inflow",
    "大额转账": "large_transfers",
    "大额转账总额": "large_transfer_volume",
    "净增持": "net_accumulation",
    "鲸鱼净变化": "whale_net_change",
    "鲸鱼买入 / 卖出": "whale_buy_sell",
    "鲸鱼交易次数": "whale_trades",
    "活跃地址数": "active_addresses"
  };

  const result: LocalizedMetric = {
    ...(nameKeyMap[name] ? { nameKey: nameKeyMap[name] } : {})
  };

  let match = value.match(/^(\d+)\s*条$/);
  if (match) {
    result.valueKey = "count_items";
    result.valueParams = { count: Number(match[1]) };
    return result;
  }
  match = value.match(/^(\d+)\s*笔$/);
  if (match) {
    result.valueKey = "count_transfers";
    result.valueParams = { count: Number(match[1]) };
    return result;
  }
  match = value.match(/^(\d+)\s*个$/);
  if (match) {
    result.valueKey = "count_addresses";
    result.valueParams = { count: Number(match[1]) };
    return result;
  }
  match = value.match(/^(.+)\s+([+-]?[\d.]+x)$/);
  if (match) {
    result.valueKey = "state_with_ratio";
    result.valueParams = { state: match[1], ratio: match[2] };
    return result;
  }
  match = value.match(/^(.+)\s+([+-]?[\d.]+%)$/);
  if (match) {
    result.valueKey = "state_with_percent";
    result.valueParams = { state: match[1], percent: match[2] };
    return result;
  }

  const exactValueKeyMap: Record<string, string> = {
    "Price > EMA20": "price_above_ema20",
    "Price < EMA20": "price_below_ema20",
    "EMA20 > EMA60": "ema20_above_ema60",
    "EMA20 < EMA60": "ema20_below_ema60",
    "金叉": "macd_bull_cross",
    "死叉": "macd_bear_cross"
  };
  if (exactValueKeyMap[value]) {
    result.valueKey = exactValueKeyMap[value];
    return result;
  }

  return result;
}

export function getLocalizedHighlight(title: string): LocalizedHighlight | undefined {
  const exactTitleKeyMap: Record<string, string> = {
    "交易所净流出达到阶段高位": "onchain_exchange_outflow_local_high",
    "稳定币净流入显著改善": "onchain_stablecoin_inflow_improved",
    "活跃地址数继续抬升": "onchain_active_addresses_rising",
    "大额转账频率上升": "onchain_large_transfer_frequency_up",
    "交易所大额提出增加": "onchain_large_exchange_withdrawals_up"
  };

  const exactKey = exactTitleKeyMap[title];
  if (exactKey) {
    return { titleKey: exactKey };
  }

  if (title === "鲸鱼地址 4H 内持续加仓") {
    return { titleKey: "whale_accumulating_4h" };
  }

  let match = title.match(/^价格上穿 EMA20 · 价格 ([\d.]+) \/ EMA20 ([\d.]+)$/);
  if (match) {
    return { titleKey: "market_price_cross_above_ema20", titleParams: { price: match[1], ema20: match[2] } };
  }
  match = title.match(/^价格跌破 EMA20 · 价格 ([\d.]+) \/ EMA20 ([\d.]+)$/);
  if (match) {
    return { titleKey: "market_price_cross_below_ema20", titleParams: { price: match[1], ema20: match[2] } };
  }
  match = title.match(/^EMA20上穿 EMA60 · EMA20 ([\d.]+) \/ EMA60 ([\d.]+)$/);
  if (match) {
    return { titleKey: "market_ema20_cross_above_ema60", titleParams: { ema20: match[1], ema60: match[2] } };
  }
  match = title.match(/^EMA20下穿 EMA60 · EMA20 ([\d.]+) \/ EMA60 ([\d.]+)$/);
  if (match) {
    return { titleKey: "market_ema20_cross_below_ema60", titleParams: { ema20: match[1], ema60: match[2] } };
  }
  match = title.match(/^MACD 金叉形成 · MACD ([\d.-]+) \/ Signal ([\d.-]+)$/);
  if (match) {
    return { titleKey: "market_macd_bull_cross", titleParams: { macd: match[1], signal: match[2] } };
  }
  match = title.match(/^MACD 死叉形成 · MACD ([\d.-]+) \/ Signal ([\d.-]+)$/);
  if (match) {
    return { titleKey: "market_macd_bear_cross", titleParams: { macd: match[1], signal: match[2] } };
  }
  match = title.match(/^量能转为(.+) · 4H 成交量比 ([\d.]+x)$/);
  if (match) {
    return { titleKey: "market_volume_shift", titleParams: { state: match[1], ratio: match[2] } };
  }
  match = title.match(/^波动率转为(.+) · ATR\/价格比 ([\d.]+%)$/);
  if (match) {
    return { titleKey: "market_volatility_shift", titleParams: { state: match[1], ratio: match[2] } };
  }
  match = title.match(/^EMA 转为 (.+)$/);
  if (match) {
    return { titleKey: "market_metric_shift", titleParams: { metric: "EMA", state: match[1] } };
  }
  match = title.match(/^均线转为 (.+)$/);
  if (match) {
    return { titleKey: "market_metric_shift", titleParams: { metric: "均线", state: match[1] } };
  }
  match = title.match(/^MACD 转为 (.+)$/);
  if (match) {
    return { titleKey: "market_metric_shift", titleParams: { metric: "MACD", state: match[1] } };
  }
  match = title.match(/^量能转为 (.+)$/);
  if (match) {
    return { titleKey: "market_metric_shift", titleParams: { metric: "量能", state: match[1] } };
  }
  match = title.match(/^波动转为 (.+)$/);
  if (match) {
    return { titleKey: "market_metric_shift", titleParams: { metric: "波动", state: match[1] } };
  }
  match = title.match(/^([A-Z0-9]+)\s+(\$[\d.,KMB-]+)\s+(转出交易所|转入交易所|链上转移)$/);
  if (match) {
    return {
      titleKey: "onchain_transfer",
      titleParams: {
        token: match[1],
        amount: normalizeMoneyString(match[2]),
        action: match[3]
      }
    };
  }

  return undefined;
}
