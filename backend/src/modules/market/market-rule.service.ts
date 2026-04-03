import { Injectable } from "@nestjs/common";
import type { MarketOhlcvPoint, MarketSignalEvaluation, MarketSignalInput } from "./market.types";

type Contribution = {
  score: number;
  reason: string;
};

@Injectable()
export class MarketRuleService {
  evaluate(input: MarketSignalInput): MarketSignalEvaluation {
    const closes = input.candles4h.map((item) => item.close);
    const volumes = input.candles4h.map((item) => item.volume);
    const ema20 = this.ema(closes, 20);
    const ema60 = this.ema(closes, 60);
    const macd = this.macd(closes);
    const atr = this.atr(input.candles4h, 14);
    const previousCloses = closes.slice(0, -1);
    const previousCandles = input.candles4h.slice(0, -1);
    const previousEma20 = previousCloses.length >= 20 ? this.ema(previousCloses, 20) : ema20;
    const previousEma60 = previousCloses.length >= 60 ? this.ema(previousCloses, 60) : ema60;
    const previousMacd = previousCloses.length >= 35 ? this.macd(previousCloses) : macd;
    const previousAtr = previousCandles.length >= 14 ? this.atr(previousCandles, 14) : atr;
    const change4h = this.percentChange(
      closes[closes.length - 2] ?? input.price,
      closes[closes.length - 1] ?? input.price
    );
    const averageVolume20 = this.average(volumes.slice(-21, -1));
    const latestVolume = volumes[volumes.length - 1] ?? 0;
    const volumeRatio = averageVolume20 > 0 ? latestVolume / averageVolume20 : 1;
    const previousAverageVolume20 = this.average(volumes.slice(-22, -2));
    const previousVolume = volumes[volumes.length - 2] ?? latestVolume;
    const previousVolumeRatio = previousAverageVolume20 > 0 ? previousVolume / previousAverageVolume20 : volumeRatio;
    const atrRatio = input.price > 0 ? atr / input.price : 0;
    const previousPrice = closes[closes.length - 2] ?? input.price;
    const previousAtrRatio = previousPrice > 0 ? previousAtr / previousPrice : atrRatio;

    const contributions: Contribution[] = [
      this.scorePriceVsEma(input.price, ema20, "价格相对 EMA20"),
      this.scorePriceVsEma(input.price, ema60, "价格相对 EMA60"),
      this.scoreEmaStructure(ema20, ema60),
      this.scoreChange4h(change4h),
      this.scoreMacd(macd.macdLine, macd.signalLine),
      this.scoreHistogram(macd.histogram),
      this.scoreChange24h(input.change24h),
      this.scoreVolume(volumeRatio, change4h),
      this.scoreAtr(atrRatio)
    ];

    const totalScore = this.clamp(
      Math.round(contributions.reduce((sum, item) => sum + item.score, 0)),
      -100,
      100
    );

    const direction = this.toDirection(totalScore);
    const marketHref = this.toBinanceTradeUrl(input.symbol);
    const volumeState = this.toVolumeState(volumeRatio);
    const previousVolumeState = this.toVolumeState(previousVolumeRatio);
    const atrState = this.toAtrState(atrRatio);
    const previousAtrState = this.toAtrState(previousAtrRatio);
    const priceVsEma20State = input.price >= ema20 ? "Price > EMA20" : "Price < EMA20";
    const emaStructureState = ema20 >= ema60 ? "EMA20 > EMA60" : "EMA20 < EMA60";
    const macdState = macd.macdLine >= macd.signalLine ? "金叉" : "死叉";
    const highlights = this.pickMarketEvents({
      price: input.price,
      ema20,
      ema60,
      previousPrice,
      previousEma20,
      previousEma60,
      macd,
      previousMacd,
      volumeRatio,
      previousVolumeState,
      volumeState,
      atrRatio,
      previousAtrState,
      atrState,
      href: marketHref,
      publishedAt: input.timestamp,
      score: totalScore
    });

    return {
      symbol: input.symbol,
      score: totalScore,
      direction,
      biasLevel: this.toBiasLevel(totalScore),
      confidence: this.toConfidence(totalScore),
      drivers: this.pickDrivers(contributions, direction),
      metrics: [
        { name: "24H 涨跌", value: this.formatSignedPercent(input.change24h) },
        { name: "4H 涨跌", value: this.formatSignedPercent(change4h) },
        { name: "EMA", value: priceVsEma20State },
        { name: "均线", value: emaStructureState },
        { name: "MACD", value: macdState },
        { name: "量能", value: `${volumeState.label} ${volumeRatio.toFixed(2)}x` },
        { name: "波动", value: `${atrState.label} ${(atrRatio * 100).toFixed(2)}%` }
      ],
      highlights
    };
  }

  private pickMarketEvents(input: {
    price: number;
    ema20: number;
    ema60: number;
    previousPrice: number;
    previousEma20: number;
    previousEma60: number;
    macd: { macdLine: number; signalLine: number };
    previousMacd: { macdLine: number; signalLine: number };
    volumeRatio: number;
    previousVolumeState: { key: string; label: string };
    volumeState: { key: string; label: string };
    atrRatio: number;
    previousAtrState: { key: string; label: string };
    atrState: { key: string; label: string };
    href: string;
    publishedAt: string;
    score: number;
  }) {
    const events: MarketSignalEvaluation["highlights"] = [];
    const previousAboveEma20 = input.previousPrice >= input.previousEma20;
    const currentAboveEma20 = input.price >= input.ema20;
    const previousEma20AboveEma60 = input.previousEma20 >= input.previousEma60;
    const currentEma20AboveEma60 = input.ema20 >= input.ema60;
    const previousMacdBullish = input.previousMacd.macdLine >= input.previousMacd.signalLine;
    const currentMacdBullish = input.macd.macdLine >= input.macd.signalLine;

    if (previousAboveEma20 !== currentAboveEma20) {
      events.push({
        title: `价格${currentAboveEma20 ? "上穿" : "跌破"} EMA20 · 价格 ${input.price.toFixed(2)} / EMA20 ${input.ema20.toFixed(2)}`,
        href: input.href,
        publishedAt: input.publishedAt,
        score: input.score
      });
    }

    if (previousEma20AboveEma60 !== currentEma20AboveEma60) {
      events.push({
        title: `EMA20${currentEma20AboveEma60 ? "上穿" : "下穿"} EMA60 · EMA20 ${input.ema20.toFixed(2)} / EMA60 ${input.ema60.toFixed(2)}`,
        href: input.href,
        publishedAt: input.publishedAt,
        score: input.score
      });
    }

    if (previousMacdBullish !== currentMacdBullish) {
      events.push({
        title: `MACD ${currentMacdBullish ? "金叉形成" : "死叉形成"} · MACD ${input.macd.macdLine.toFixed(1)} / Signal ${input.macd.signalLine.toFixed(1)}`,
        href: input.href,
        publishedAt: input.publishedAt,
        score: input.score
      });
    }

    if (input.previousVolumeState.key !== input.volumeState.key) {
      events.push({
        title: `量能转为${input.volumeState.label} · 4H 成交量比 ${input.volumeRatio.toFixed(2)}x`,
        href: input.href,
        publishedAt: input.publishedAt,
        score: input.score
      });
    }

    if (input.previousAtrState.key !== input.atrState.key) {
      events.push({
        title: `波动率转为${input.atrState.label} · ATR/价格比 ${(input.atrRatio * 100).toFixed(2)}%`,
        href: input.href,
        publishedAt: input.publishedAt,
        score: input.score
      });
    }

    return events;
  }

  private toBinanceTradeUrl(symbol: string) {
    return `https://www.binance.com/en/trade/${symbol.toUpperCase()}_USDT`;
  }

  private toVolumeState(volumeRatio: number) {
    if (volumeRatio < 0.8) {
      return { key: "low", label: "缩量" };
    }

    if (volumeRatio < 1.1) {
      return { key: "normal", label: "正常量能" };
    }

    if (volumeRatio < 1.6) {
      return { key: "high", label: "放量" };
    }

    return { key: "extreme", label: "异常放量" };
  }

  private toAtrState(atrRatio: number) {
    if (atrRatio <= 0.025) {
      return { key: "low", label: "低波动" };
    }

    if (atrRatio <= 0.045) {
      return { key: "normal", label: "中性波动" };
    }

    if (atrRatio <= 0.07) {
      return { key: "elevated", label: "高波动观察区" };
    }

    if (atrRatio <= 0.1) {
      return { key: "high", label: "高风险波动" };
    }

    return { key: "extreme", label: "异常波动" };
  }

  private scorePriceVsEma(price: number, ema: number, label: string): Contribution {
    const bullish = price >= ema;

    return {
      score: bullish ? 10 : -10,
      reason: `${label}${bullish ? "偏强" : "偏弱"}`
    };
  }

  private scoreEmaStructure(ema20: number, ema60: number): Contribution {
    const bullish = ema20 >= ema60;

    return {
      score: bullish ? 12 : -12,
      reason: `EMA20 ${bullish ? "上穿并维持在" : "下穿并维持在"} EMA60 ${bullish ? "上方" : "下方"}`
    };
  }

  private scoreChange4h(change4h: number): Contribution {
    if (change4h >= 1.5) {
      return { score: 10, reason: "4H 涨幅明显，短线趋势偏强" };
    }

    if (change4h >= 0) {
      return { score: 5, reason: "4H 维持正收益，短线仍偏多" };
    }

    if (change4h <= -1.5) {
      return { score: -10, reason: "4H 跌幅扩大，短线承压明显" };
    }

    return { score: -5, reason: "4H 小幅回落，短线偏弱" };
  }

  private scoreMacd(macdLine: number, signalLine: number): Contribution {
    const bullish = macdLine >= signalLine;

    return {
      score: bullish ? 8 : -8,
      reason: `MACD ${bullish ? "主线位于信号线上方" : "主线跌破信号线"}`
    };
  }

  private scoreHistogram(histogram: number): Contribution {
    const bullish = histogram >= 0;

    return {
      score: bullish ? 8 : -8,
      reason: `MACD 柱体${bullish ? "位于零轴上方" : "位于零轴下方"}`
    };
  }

  private scoreChange24h(change24h: number): Contribution {
    if (change24h >= 2) {
      return { score: 9, reason: "24H 表现偏强，趋势延续性较好" };
    }

    if (change24h >= 0) {
      return { score: 4, reason: "24H 保持正涨幅，整体结构仍稳" };
    }

    if (change24h <= -2) {
      return { score: -9, reason: "24H 跌幅偏大，日内结构转弱" };
    }

    return { score: -4, reason: "24H 仍为负收益，日内偏空" };
  }

  private scoreVolume(volumeRatio: number, change4h: number): Contribution {
    if (volumeRatio >= 1.4 && change4h >= 0) {
      return { score: 15, reason: "上涨伴随明显放量，趋势确认度较高" };
    }

    if (volumeRatio >= 1.1 && change4h >= 0) {
      return { score: 8, reason: "上涨有量能配合，偏多得到确认" };
    }

    if (volumeRatio >= 1.4 && change4h < 0) {
      return { score: -15, reason: "下跌放量，抛压释放较强" };
    }

    if (volumeRatio >= 1.1 && change4h < 0) {
      return { score: -8, reason: "下跌伴随放量，偏空确认度提升" };
    }

    return { score: 0, reason: "成交量未明显放大，量能确认不足" };
  }

  private scoreAtr(atrRatio: number): Contribution {
    if (atrRatio <= 0.025) {
      return { score: 10, reason: "ATR 较低，波动可控" };
    }

    if (atrRatio <= 0.045) {
      return { score: 4, reason: "ATR 中性，波动尚可接受" };
    }

    if (atrRatio <= 0.07) {
      return { score: 0, reason: "ATR 偏高，波动进入观察区" };
    }

    if (atrRatio <= 0.1) {
      return { score: -8, reason: "ATR 高企，短线风险上升" };
    }

    return { score: -14, reason: "ATR 异常偏高，走势噪音和风险都较大" };
  }

  private toDirection(score: number): "bullish" | "bearish" | "watch" {
    if (score >= 18) {
      return "bullish";
    }

    if (score <= -18) {
      return "bearish";
    }

    return "watch";
  }

  private toBiasLevel(score: number) {
    if (score <= -75) {
      return "super_bearish" as const;
    }

    if (score <= -45) {
      return "strong_bearish" as const;
    }

    if (score <= -15) {
      return "weak_bearish" as const;
    }

    if (score < 15) {
      return "watch" as const;
    }

    if (score < 45) {
      return "weak_bullish" as const;
    }

    if (score < 75) {
      return "strong_bullish" as const;
    }

    return "super_bullish" as const;
  }

  private pickDrivers(
    contributions: Contribution[],
    direction: "bullish" | "bearish" | "watch"
  ) {
    const aligned = contributions.filter((item) => {
      if (direction === "bullish") {
        return item.score > 0;
      }

      if (direction === "bearish") {
        return item.score < 0;
      }

      return true;
    });

    return (aligned.length > 0 ? aligned : contributions)
      .slice()
      .sort((left, right) => Math.abs(right.score) - Math.abs(left.score))
      .slice(0, 3)
      .map((item) => item.reason);
  }

  private toConfidence(score: number) {
    const value = Math.abs(score);

    if (value >= 60) {
      return "high";
    }

    if (value >= 30) {
      return "medium";
    }

    return "low";
  }

  private ema(values: number[], period: number) {
    const multiplier = 2 / (period + 1);
    let current = values[0] ?? 0;

    for (const value of values.slice(1)) {
      current = (value - current) * multiplier + current;
    }

    return current;
  }

  private macd(values: number[]) {
    const ema12Series = this.emaSeries(values, 12);
    const ema26Series = this.emaSeries(values, 26);
    const macdSeries = ema12Series.map((value, index) => value - ema26Series[index]);
    const signalSeries = this.emaSeries(macdSeries, 9);
    const macdLine = macdSeries[macdSeries.length - 1] ?? 0;
    const signalLine = signalSeries[signalSeries.length - 1] ?? 0;

    return {
      macdLine,
      signalLine,
      histogram: macdLine - signalLine
    };
  }

  private atr(candles: MarketOhlcvPoint[], period: number) {
    if (candles.length < 2) {
      return 0;
    }

    const trueRanges: number[] = [];

    for (let index = 1; index < candles.length; index += 1) {
      const current = candles[index];
      const previous = candles[index - 1];
      trueRanges.push(
        Math.max(
          current.high - current.low,
          Math.abs(current.high - previous.close),
          Math.abs(current.low - previous.close)
        )
      );
    }

    return this.average(trueRanges.slice(-period));
  }

  private average(values: number[]) {
    if (values.length === 0) {
      return 0;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private emaSeries(values: number[], period: number) {
    const multiplier = 2 / (period + 1);
    const series: number[] = [];
    let current = values[0] ?? 0;

    for (const value of values) {
      current = series.length === 0 ? value : (value - current) * multiplier + current;
      series.push(current);
    }

    return series;
  }

  private percentChange(previous: number, current: number) {
    if (!previous) {
      return 0;
    }

    return ((current - previous) / previous) * 100;
  }

  private formatSignedPercent(value: number) {
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  }

  private clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
  }
}
