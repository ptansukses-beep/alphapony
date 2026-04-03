export type RawTrackedTransfer = {
  symbol: string;
  chainId: number;
  tokenSymbol: string;
  tokenAddress: string;
  txHash: string;
  logIndex: number;
  from: string;
  to: string;
  amount: number;
  amountUsd: number;
  timestamp: string;
  isExchangeInflow: boolean;
  isExchangeOutflow: boolean;
  touchesExchange: boolean;
  touchesWhale: boolean;
  fromWhale: boolean;
  toWhale: boolean;
  fromExchange: boolean;
  toExchange: boolean;
};

export type OnchainSymbolConfig = {
  transferThresholdUsd: number;
  exchangeFlowThresholdUsd: number;
  whaleTradeThresholdUsd: number;
};

export type OnchainAggregate = {
  symbol: string;
  transferThresholdUsd: number;
  exchangeFlowThresholdUsd: number;
  whaleTradeThresholdUsd: number;
  exchangeInflowUsd: number;
  exchangeOutflowUsd: number;
  exchangeNetflowUsd: number;
  largeTransferCount: number;
  largeTransferUsd: number;
  whaleNetUsd: number;
  whaleBuyUsd: number;
  whaleSellUsd: number;
  whaleTransferCount: number;
  whaleAddressCount: number;
  sampledTransfers: RawTrackedTransfer[];
};

export type OnchainSignalEvaluation = {
  symbol: string;
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
  confidence: string;
  drivers: string[];
  metrics: Array<{ name: string; value: string }>;
  highlights: Array<{ title: string; href: string; publishedAt?: string; score?: number }>;
};

export type WhaleSignalEvaluation = OnchainSignalEvaluation;
