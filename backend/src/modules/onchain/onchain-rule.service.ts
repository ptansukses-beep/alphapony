import { Injectable } from "@nestjs/common";
import { OnchainAggregate, OnchainSignalEvaluation, RawTrackedTransfer, WhaleSignalEvaluation } from "./onchain.types";

type Contribution = { score: number; reason: string };

@Injectable()
export class OnchainRuleService {
  evaluateOnchain(aggregate: OnchainAggregate): OnchainSignalEvaluation {
    const contributions: Contribution[] = [
      this.scoreExchangeNetflow(aggregate.exchangeNetflowUsd, aggregate.exchangeFlowThresholdUsd),
      this.scoreLargeTransferVolume(
        aggregate.largeTransferUsd,
        aggregate.largeTransferCount,
        aggregate.transferThresholdUsd
      ),
      this.scoreWhaleParticipation(
        aggregate.whaleNetUsd,
        aggregate.whaleTransferCount,
        aggregate.whaleTradeThresholdUsd
      )
    ];
    const score = this.clamp(
      Math.round(contributions.reduce((sum, item) => sum + item.score, 0)),
      -100,
      100
    );
    const direction = this.toDirection(score);

    return {
      symbol: aggregate.symbol,
      score,
      direction,
      biasLevel: this.toBiasLevel(score),
      confidence: this.toConfidence(score, aggregate.largeTransferCount),
      drivers: this.pickDrivers(contributions, direction),
      metrics: [
        { name: "交易所净流", value: this.formatUsd(aggregate.exchangeNetflowUsd) },
        { name: "交易所流入 / 流出", value: `${this.formatUsd(aggregate.exchangeInflowUsd)} / ${this.formatUsd(aggregate.exchangeOutflowUsd)}` },
        { name: "大额转账", value: `${aggregate.largeTransferCount} 笔` },
        { name: "大额转账总额", value: this.formatUsd(aggregate.largeTransferUsd) }
      ],
      highlights: this.pickHighlights(aggregate)
    };
  }

  evaluateWhale(aggregate: OnchainAggregate): WhaleSignalEvaluation {
    const contributions: Contribution[] = [
      this.scoreWhaleNet(aggregate.whaleNetUsd, aggregate.whaleTradeThresholdUsd),
      this.scoreWhaleBuySell(
        aggregate.whaleBuyUsd,
        aggregate.whaleSellUsd,
        aggregate.whaleTradeThresholdUsd
      ),
      this.scoreWhaleActivity(aggregate.whaleTransferCount, aggregate.whaleAddressCount)
    ];
    const score = this.clamp(
      Math.round(contributions.reduce((sum, item) => sum + item.score, 0)),
      -100,
      100
    );
    const direction = this.toDirection(score);

    return {
      symbol: aggregate.symbol,
      score,
      direction,
      biasLevel: this.toBiasLevel(score),
      confidence: this.toConfidence(score, aggregate.whaleTransferCount),
      drivers: this.pickDrivers(contributions, direction),
      metrics: [
        { name: "鲸鱼净变化", value: this.formatUsd(aggregate.whaleNetUsd) },
        { name: "鲸鱼买入 / 卖出", value: `${this.formatUsd(aggregate.whaleBuyUsd)} / ${this.formatUsd(aggregate.whaleSellUsd)}` },
        { name: "鲸鱼交易次数", value: `${aggregate.whaleTransferCount} 笔` },
        { name: "活跃地址数", value: `${aggregate.whaleAddressCount} 个` }
      ],
      highlights: this.pickHighlights(aggregate)
    };
  }

  private scoreExchangeNetflow(value: number, exchangeFlowThresholdUsd: number): Contribution {
    const largeThreshold = this.scaleThreshold(exchangeFlowThresholdUsd, 2.4, exchangeFlowThresholdUsd);
    const mediumThreshold = this.scaleThreshold(exchangeFlowThresholdUsd, 1, exchangeFlowThresholdUsd);

    if (value >= largeThreshold) {
      return { score: 45, reason: "交易所净流出显著放大，链上资金偏多" };
    }
    if (value >= mediumThreshold) {
      return { score: 25, reason: "交易所净流出扩大，链上资金回流" };
    }
    if (value <= -largeThreshold) {
      return { score: -45, reason: "交易所净流入显著放大，潜在抛压上升" };
    }
    if (value <= -mediumThreshold) {
      return { score: -25, reason: "交易所净流入增加，链上偏空" };
    }
    return { score: 0, reason: "交易所净流变化有限" };
  }

  private scoreLargeTransferVolume(
    volumeUsd: number,
    count: number,
    transferThresholdUsd: number
  ): Contribution {
    const strongVolumeThreshold = transferThresholdUsd * 12;
    const mediumVolumeThreshold = transferThresholdUsd * 4;
    if (volumeUsd >= strongVolumeThreshold || count >= 8) {
      return { score: 20, reason: "链上大额转账明显增多，资金活跃度提升" };
    }
    if (volumeUsd >= mediumVolumeThreshold || count >= 3) {
      return { score: 10, reason: "链上大额转账活跃，资金开始放量" };
    }
    return { score: 0, reason: "链上大额转账未明显放量" };
  }

  private scoreWhaleParticipation(
    whaleNetUsd: number,
    whaleTransferCount: number,
    whaleTradeThresholdUsd: number
  ): Contribution {
    const threshold = whaleTradeThresholdUsd * 3;
    if (whaleNetUsd >= threshold && whaleTransferCount >= 1) {
      return { score: 18, reason: "大户参与度提升且净增持偏多" };
    }
    if (whaleNetUsd <= -threshold && whaleTransferCount >= 1) {
      return { score: -18, reason: "大户活跃且净减持偏空" };
    }
    return { score: 0, reason: "大户参与度中性" };
  }

  private scoreWhaleNet(value: number, whaleTradeThresholdUsd: number): Contribution {
    const strongThreshold = whaleTradeThresholdUsd * 8;
    const mediumThreshold = whaleTradeThresholdUsd * 3;
    if (value >= strongThreshold) {
      return { score: 50, reason: "观察名单鲸鱼净增持显著" };
    }
    if (value >= mediumThreshold) {
      return { score: 25, reason: "观察名单鲸鱼净增持偏多" };
    }
    if (value <= -strongThreshold) {
      return { score: -50, reason: "观察名单鲸鱼净减持显著" };
    }
    if (value <= -mediumThreshold) {
      return { score: -25, reason: "观察名单鲸鱼净减持偏空" };
    }
    return { score: 0, reason: "鲸鱼净变化有限" };
  }

  private scoreWhaleBuySell(
    buyUsd: number,
    sellUsd: number,
    whaleTradeThresholdUsd: number
  ): Contribution {
    const delta = buyUsd - sellUsd;
    const strongThreshold = whaleTradeThresholdUsd * 6;
    const mediumThreshold = whaleTradeThresholdUsd * 2;
    if (delta >= strongThreshold) {
      return { score: 30, reason: "鲸鱼从交易所提出资产明显更多" };
    }
    if (delta >= mediumThreshold) {
      return { score: 15, reason: "鲸鱼提出交易所资产偏多" };
    }
    if (delta <= -strongThreshold) {
      return { score: -30, reason: "鲸鱼向交易所转入资产明显更多" };
    }
    if (delta <= -mediumThreshold) {
      return { score: -15, reason: "鲸鱼向交易所转入资产偏多" };
    }
    return { score: 0, reason: "鲸鱼与交易所之间的转移中性" };
  }

  private scoreWhaleActivity(transferCount: number, addressCount: number): Contribution {
    if (transferCount >= 4 || addressCount >= 3) {
      return { score: 15, reason: "鲸鱼地址活跃度显著提升" };
    }
    if (transferCount >= 2 || addressCount >= 2) {
      return { score: 8, reason: "鲸鱼地址开始活跃" };
    }
    return { score: 0, reason: "鲸鱼活跃度有限" };
  }

  private pickHighlights(aggregate: OnchainAggregate) {
    return aggregate.sampledTransfers.slice(0, 10).map((item) => ({
      title: `${item.tokenSymbol} ${this.formatUsd(item.amountUsd)} ${item.isExchangeOutflow ? "转出交易所" : item.isExchangeInflow ? "转入交易所" : "链上转移"}`,
      href: this.getTransferExplorerUrl(item),
      publishedAt: item.timestamp,
      score: item.isExchangeOutflow ? 24 : item.isExchangeInflow ? -24 : 8
    }));
  }

  private getTransferExplorerUrl(item: RawTrackedTransfer) {
    const txHash = item.txHash?.trim();
    if (!txHash) {
      return "";
    }

    switch (item.chainId) {
      case 1:
        return `https://etherscan.io/tx/${txHash}`;
      case 56:
        return `https://bscscan.com/tx/${txHash}`;
      case 101:
        return `https://solscan.io/tx/${txHash}`;
      case 144:
        return `https://xrpscan.com/tx/${txHash}`;
      default:
        return "";
    }
  }

  private pickDrivers(
    contributions: Contribution[],
    direction: "bullish" | "bearish" | "watch"
  ) {
    const filtered = contributions.filter((item) => {
      if (direction === "bullish") return item.score > 0;
      if (direction === "bearish") return item.score < 0;
      return item.score !== 0;
    });

    return (filtered.length > 0 ? filtered : contributions)
      .slice()
      .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
      .slice(0, 3)
      .map((item) => item.reason);
  }

  private toDirection(score: number): "bullish" | "bearish" | "watch" {
    if (score >= 18) return "bullish";
    if (score <= -18) return "bearish";
    return "watch";
  }

  private toBiasLevel(score: number) {
    if (score <= -75) return "super_bearish" as const;
    if (score <= -45) return "strong_bearish" as const;
    if (score <= -15) return "weak_bearish" as const;
    if (score < 15) return "watch" as const;
    if (score < 45) return "weak_bullish" as const;
    if (score < 75) return "strong_bullish" as const;
    return "super_bullish" as const;
  }

  private toConfidence(score: number, count: number) {
    const value = Math.abs(score);
    if (value >= 60 || (value >= 40 && count >= 4)) return "high";
    if (value >= 25 || count >= 2) return "medium";
    return "low";
  }

  private formatUsd(value: number) {
    const abs = Math.abs(value);
    const prefix = value < 0 ? "-" : "";
    if (abs >= 1_000_000_000) return `${prefix}$${(abs / 1_000_000_000).toFixed(2)}B`;
    if (abs >= 1_000_000) return `${prefix}$${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${prefix}$${(abs / 1_000).toFixed(1)}K`;
    return `${prefix}$${abs.toFixed(0)}`;
  }

  private clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
  }

  private scaleThreshold(base: number, multiplier: number, minimum: number) {
    return Math.max(minimum, base * multiplier);
  }
}
