import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  EVM_ONCHAIN_CONFIG,
  SUPPORTED_EVM_ONCHAIN_SYMBOLS,
  type SupportedEvmOnchainSymbol
} from "./onchain.constants";
import { RawTrackedTransfer } from "./onchain.types";

const { createPublicClient, formatUnits, getAddress, http, parseAbiItem } = require("viem") as {
  createPublicClient: (...args: any[]) => any;
  formatUnits: (value: bigint, decimals: number) => string;
  getAddress: (value: string) => string;
  http: (...args: any[]) => any;
  parseAbiItem: (value: string) => any;
};
const { mainnet, bsc } = require("viem/chains") as {
  mainnet: any;
  bsc: any;
};

@Injectable()
export class OnchainEvmProvider {
  private readonly logger = new Logger(OnchainEvmProvider.name);
  private readonly transferEvent = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

  constructor(private readonly configService: ConfigService) {}

  async getTransfers(priceBySymbol: Record<string, number>) {
    const results = new Map<SupportedEvmOnchainSymbol, RawTrackedTransfer[]>();

    for (const symbol of SUPPORTED_EVM_ONCHAIN_SYMBOLS) {
      try {
        results.set(symbol, await this.getSymbolTransfers(symbol, priceBySymbol));
      } catch (error) {
        this.logger.warn(`${symbol} onchain fetch failed: ${error instanceof Error ? error.message : String(error)}`);
        results.set(symbol, []);
      }
    }

    return results;
  }

  private async getSymbolTransfers(
    symbol: SupportedEvmOnchainSymbol,
    priceBySymbol: Record<string, number>
  ) {
    const config = EVM_ONCHAIN_CONFIG[symbol];
    const exchangeAddresses = this.parseAddresses(
      config.exchangeEnv,
      [...config.defaultExchangeAddresses]
    );
    const whaleAddresses = this.parseAddresses(
      config.whaleEnv,
      [...config.defaultWhaleAddresses]
    );
    const trackedAddresses = [...new Set([...exchangeAddresses, ...whaleAddresses])];

    if (trackedAddresses.length === 0) {
      return [];
    }

    const client = createPublicClient({
      chain: config.chainId === 1 ? mainnet : bsc,
      transport: http(
        this.configService.get<string>(config.rpcUrlEnv) ?? config.defaultRpcUrl,
        { timeout: 6_000 }
      )
    });

    const headBlock = await client.getBlockNumber();
    const safeHeadOffset = config.chainId === 1 ? 16n : 24n;
    const toBlock = headBlock > safeHeadOffset ? headBlock - safeHeadOffset : 0n;
    const fromBlock = toBlock > config.lookbackBlocks ? toBlock - config.lookbackBlocks : 0n;
    const nativeFromBlock =
      toBlock > config.nativeLookbackBlocks ? toBlock - config.nativeLookbackBlocks : 0n;
    const transfers = new Map<string, RawTrackedTransfer>();

    for (const token of config.tokens) {
      if (symbol === "BNB") {
        const logs = await client.getLogs({
          address: getAddress(token.address),
          event: this.transferEvent,
          fromBlock,
          toBlock
        });

        logs.forEach((log: any) => {
          this.pushTrackedTransfer({
            transfers,
            symbol,
            chainId: config.chainId,
            tokenSymbol: token.symbol,
            tokenAddress: token.address,
            tokenDecimals: token.decimals,
            log,
            trackedAddresses,
            exchangeAddresses,
            whaleAddresses,
            priceMultiplier:
              token.priceSource === "usd" ? 1 : priceBySymbol[config.nativePriceSymbol] ?? 0
          });
        });

        continue;
      }

      for (const trackedAddress of trackedAddresses) {
        const [incoming, outgoing] = await Promise.all([
          client.getLogs({
            address: getAddress(token.address),
            event: this.transferEvent,
            args: { to: trackedAddress },
            fromBlock,
            toBlock
          }),
          client.getLogs({
            address: getAddress(token.address),
            event: this.transferEvent,
            args: { from: trackedAddress },
            fromBlock,
            toBlock
          })
        ]);

        [...incoming, ...outgoing].forEach((log: any) => {
          this.pushTrackedTransfer({
            transfers,
            symbol,
            chainId: config.chainId,
            tokenSymbol: token.symbol,
            tokenAddress: token.address,
            tokenDecimals: token.decimals,
            log,
            trackedAddresses,
            exchangeAddresses,
            whaleAddresses,
            priceMultiplier:
              token.priceSource === "usd" ? 1 : priceBySymbol[config.nativePriceSymbol] ?? 0
          });
        });
      }
    }

    if (config.nativeLookbackBlocks > 0n) {
      const nativeTransfers = await this.getNativeTransfers({
        client,
        symbol,
        chainId: config.chainId,
        fromBlock: nativeFromBlock,
        toBlock,
        trackedAddresses,
        exchangeAddresses,
        whaleAddresses,
        nativePrice: priceBySymbol[config.nativePriceSymbol] ?? 0
      });

      nativeTransfers.forEach((item) => {
        transfers.set(`${item.txHash}:${item.logIndex}`, item);
      });
    }

    return [...transfers.values()]
      .filter((item) => item.amountUsd > 0)
      .sort((left, right) => right.amountUsd - left.amountUsd);
  }

  private async getNativeTransfers({
    client,
    symbol,
    chainId,
    fromBlock,
    toBlock,
    trackedAddresses,
    exchangeAddresses,
    whaleAddresses,
    nativePrice
  }: {
    client: any;
    symbol: SupportedEvmOnchainSymbol;
    chainId: number;
    fromBlock: bigint;
    toBlock: bigint;
    trackedAddresses: string[];
    exchangeAddresses: string[];
    whaleAddresses: string[];
    nativePrice: number;
  }) {
    const items: RawTrackedTransfer[] = [];

    for (let block = fromBlock; block <= toBlock; block += 1n) {
      const blockData = await client.getBlock({
        blockNumber: block,
        includeTransactions: true
      });

      const timestamp = new Date(Number(blockData.timestamp) * 1000).toISOString();

      for (const tx of blockData.transactions) {
        if (!tx.to || tx.value === 0n) {
          continue;
        }

        const from = getAddress(String(tx.from));
        const to = getAddress(String(tx.to));

        if (!trackedAddresses.includes(from) && !trackedAddresses.includes(to)) {
          continue;
        }

        const amount = Number(formatUnits(tx.value, 18));
        const amountUsd = amount * nativePrice;

        items.push({
          symbol,
          chainId,
          tokenSymbol: symbol,
          tokenAddress: "native",
          txHash: String(tx.hash),
          logIndex: Number(tx.transactionIndex ?? 0),
          from,
          to,
          amount,
          amountUsd,
          timestamp,
          isExchangeInflow: exchangeAddresses.includes(to) && !exchangeAddresses.includes(from),
          isExchangeOutflow: exchangeAddresses.includes(from) && !exchangeAddresses.includes(to),
          touchesExchange: exchangeAddresses.includes(from) || exchangeAddresses.includes(to),
          touchesWhale: whaleAddresses.includes(from) || whaleAddresses.includes(to),
          fromWhale: whaleAddresses.includes(from),
          toWhale: whaleAddresses.includes(to),
          fromExchange: exchangeAddresses.includes(from),
          toExchange: exchangeAddresses.includes(to)
        });
      }
    }

    return items;
  }

  private parseAddresses(envKey: string, defaults: string[]) {
    const raw = this.configService.get<string>(envKey) ?? "";

    return [...defaults, ...raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .flatMap((value) => {
        try {
          return [getAddress(value.toLowerCase())];
        } catch {
          this.logger.warn(`Invalid address in ${envKey}: ${value}`);
          return [];
        }
      })];
  }

  private pushTrackedTransfer({
    transfers,
    symbol,
    chainId,
    tokenSymbol,
    tokenAddress,
    tokenDecimals,
    log,
    trackedAddresses,
    exchangeAddresses,
    whaleAddresses,
    priceMultiplier
  }: {
    transfers: Map<string, RawTrackedTransfer>;
    symbol: SupportedEvmOnchainSymbol;
    chainId: number;
    tokenSymbol: string;
    tokenAddress: string;
    tokenDecimals: number;
    log: any;
    trackedAddresses: string[];
    exchangeAddresses: string[];
    whaleAddresses: string[];
    priceMultiplier: number;
  }) {
    const logFrom = getAddress(String(log.args.from));
    const logTo = getAddress(String(log.args.to));

    if (!trackedAddresses.includes(logFrom) && !trackedAddresses.includes(logTo)) {
      return;
    }

    const amount = Number(formatUnits(log.args.value ?? 0n, tokenDecimals));
    const amountUsd = amount * priceMultiplier;
    const key = `${log.transactionHash}:${log.logIndex}`;

    transfers.set(key, {
      symbol,
      chainId,
      tokenSymbol,
      tokenAddress,
      txHash: log.transactionHash,
      logIndex: Number(log.logIndex),
      from: logFrom,
      to: logTo,
      amount,
      amountUsd,
      timestamp: new Date().toISOString(),
      isExchangeInflow: exchangeAddresses.includes(logTo) && !exchangeAddresses.includes(logFrom),
      isExchangeOutflow: exchangeAddresses.includes(logFrom) && !exchangeAddresses.includes(logTo),
      touchesExchange: exchangeAddresses.includes(logFrom) || exchangeAddresses.includes(logTo),
      touchesWhale: whaleAddresses.includes(logFrom) || whaleAddresses.includes(logTo),
      fromWhale: whaleAddresses.includes(logFrom),
      toWhale: whaleAddresses.includes(logTo),
      fromExchange: exchangeAddresses.includes(logFrom),
      toExchange: exchangeAddresses.includes(logTo)
    });
  }
}
