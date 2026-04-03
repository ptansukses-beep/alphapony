import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RawTrackedTransfer } from "./onchain.types";
import { XRP_ONCHAIN_CONFIG } from "./onchain.constants";

@Injectable()
export class OnchainXrpProvider {
  private readonly logger = new Logger(OnchainXrpProvider.name);

  constructor(private readonly configService: ConfigService) {}

  async getTransfers(priceBySymbol: Record<string, number>) {
    try {
      return await this.fetchRecentTransfers(priceBySymbol.XRP ?? 0);
    } catch (error) {
      this.logger.warn(`XRP onchain fetch failed: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  private async fetchRecentTransfers(xrpPrice: number) {
    const rpcUrl =
      this.configService.get<string>(XRP_ONCHAIN_CONFIG.rpcUrlEnv) ??
      XRP_ONCHAIN_CONFIG.defaultRpcUrl;
    const exchangeAddresses = this.parseAddresses(
      XRP_ONCHAIN_CONFIG.exchangeEnv,
      [...XRP_ONCHAIN_CONFIG.defaultExchangeAddresses]
    );
    const whaleAddresses = this.parseAddresses(
      XRP_ONCHAIN_CONFIG.whaleEnv,
      [...XRP_ONCHAIN_CONFIG.defaultWhaleAddresses]
    );
    const trackedAddresses = [...new Set([...exchangeAddresses, ...whaleAddresses])];
    const transfers = new Map<string, RawTrackedTransfer>();

    for (const address of trackedAddresses) {
      const result = await this.rpc<any>(rpcUrl, {
        method: "account_tx",
        params: [
          {
            account: address,
            binary: false,
            forward: false,
            limit: XRP_ONCHAIN_CONFIG.limit
          }
        ]
      });

      const transactions = result?.result?.transactions ?? [];
      for (const [index, item] of transactions.entries()) {
        const tx = item.tx ?? item;
        if (tx?.TransactionType !== "Payment" || typeof tx?.Amount !== "string") {
          continue;
        }

        const from = String(tx.Account ?? "");
        const to = String(tx.Destination ?? "");
        const amount = Number(tx.Amount) / 1_000_000;
        const amountUsd = amount * xrpPrice;

        if (amountUsd < XRP_ONCHAIN_CONFIG.transferThresholdUsd) {
          continue;
        }

        const hash = String(tx.hash ?? `${address}:${index}`);
        transfers.set(hash, {
          symbol: "XRP",
          chainId: 144,
          tokenSymbol: "XRP",
          tokenAddress: "native",
          txHash: hash,
          logIndex: index,
          from,
          to,
          amount,
          amountUsd,
          timestamp: new Date().toISOString(),
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

    return [...transfers.values()].sort((left, right) => right.amountUsd - left.amountUsd);
  }

  private parseAddresses(envKey: string, defaults: string[]) {
    const raw = this.configService.get<string>(envKey) ?? "";

    return [...new Set([
      ...defaults,
      ...raw
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    ])];
  }

  private async rpc<T>(rpcUrl: string, body: Record<string, unknown>) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);

    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "xrp",
          ...body
        }),
        signal: controller.signal
      });
      const payload = await response.json();

      if (!response.ok || payload.error) {
        throw new Error(payload.error?.message ?? `HTTP ${response.status}`);
      }

      return payload as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}
