import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RawTrackedTransfer } from "./onchain.types";
import { SOLANA_ONCHAIN_CONFIG } from "./onchain.constants";

@Injectable()
export class OnchainSolanaProvider {
  private readonly logger = new Logger(OnchainSolanaProvider.name);

  constructor(private readonly configService: ConfigService) {}

  async getTransfers(priceBySymbol: Record<string, number>) {
    try {
      return await this.fetchRecentTransfers(priceBySymbol.SOL ?? 0);
    } catch (error) {
      this.logger.warn(`SOL onchain fetch failed: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  private async fetchRecentTransfers(solPrice: number) {
    const rpcUrl =
      this.configService.get<string>(SOLANA_ONCHAIN_CONFIG.rpcUrlEnv) ??
      SOLANA_ONCHAIN_CONFIG.defaultRpcUrl;
    const exchangeAddresses = this.parseAddresses(
      SOLANA_ONCHAIN_CONFIG.exchangeEnv,
      [...SOLANA_ONCHAIN_CONFIG.defaultExchangeAddresses]
    );
    const whaleAddresses = this.parseAddresses(
      SOLANA_ONCHAIN_CONFIG.whaleEnv,
      [...SOLANA_ONCHAIN_CONFIG.defaultWhaleAddresses]
    );
    const dynamicWhaleAddresses = await this.getLargestAccounts(rpcUrl);
    const trackedWhaleAddresses = [...new Set([...whaleAddresses, ...dynamicWhaleAddresses])];
    const transfers = new Map<string, RawTrackedTransfer>();
    const signatures = await this.getRecentSignatures(rpcUrl, trackedWhaleAddresses, exchangeAddresses);

    for (let index = 0; index < signatures.length; index += 6) {
      const batch = signatures.slice(index, index + 6);
      const transactions = await Promise.all(
        batch.map((signature) => this.getTransaction(rpcUrl, signature).catch(() => null))
      );

      transactions.forEach((tx) => {
        if (!tx?.transaction?.signatures?.[0]) {
          return;
        }

        const signature = tx.transaction.signatures[0];
        const timestamp = tx.blockTime
          ? new Date(tx.blockTime * 1000).toISOString()
          : new Date().toISOString();

        this.collectInstructions(tx).forEach(({ instruction, index: instructionIndex }) => {
          const transfer = this.toTransfer({
            instruction,
            signature,
            instructionIndex,
            timestamp,
            solPrice,
            exchangeAddresses,
            whaleAddresses: trackedWhaleAddresses
          });

          if (transfer) {
            transfers.set(`${signature}:${instructionIndex}`, transfer);
          }
        });
      });
    }

    return [...transfers.values()].sort((left, right) => right.amountUsd - left.amountUsd);
  }

  private async getRecentSignatures(
    rpcUrl: string,
    whaleAddresses: string[],
    exchangeAddresses: string[]
  ) {
    const primaryAddresses = [...new Set([
      ...exchangeAddresses.slice(0, SOLANA_ONCHAIN_CONFIG.exchangeAccountLimit),
      ...whaleAddresses.slice(0, Math.max(4, Math.floor(SOLANA_ONCHAIN_CONFIG.whaleAccountLimit / 2)))
    ])];
    const addresses = primaryAddresses.length > 0
      ? primaryAddresses
      : [SOLANA_ONCHAIN_CONFIG.wrappedSolMint];
    const signatureSets: Array<Array<{ signature?: string; blockTime?: number | null }>> = [];

    for (let index = 0; index < addresses.length; index += 2) {
      const batch = addresses.slice(index, index + 2);
      const batchResults = await Promise.all(
        batch.map((address) =>
          this.rpc<Array<{ signature?: string; blockTime?: number | null }>>(
            rpcUrl,
            "getSignaturesForAddress",
            [address, { limit: Math.max(8, Math.floor(SOLANA_ONCHAIN_CONFIG.signatureLimit / 4)), commitment: "confirmed" }]
          ).catch(() => [])
        )
      );

      signatureSets.push(...batchResults);
    }

    const latestSignatures = signatureSets
      .flatMap((items) => items)
      .filter((item): item is { signature: string; blockTime?: number | null } => Boolean(item.signature))
      .sort((left, right) => Number(right.blockTime ?? 0) - Number(left.blockTime ?? 0));

    const deduped = [...new Set(latestSignatures.map((item) => item.signature))];
    if (deduped.length > 0) {
      return deduped.slice(0, SOLANA_ONCHAIN_CONFIG.signatureLimit);
    }

    const fallbackSignatures = await this.rpc<Array<{ signature?: string; blockTime?: number | null }>>(
      rpcUrl,
      "getSignaturesForAddress",
      [SOLANA_ONCHAIN_CONFIG.wrappedSolMint, { limit: SOLANA_ONCHAIN_CONFIG.signatureLimit, commitment: "confirmed" }]
    ).catch(() => []);

    return fallbackSignatures
      .map((item) => item.signature ?? "")
      .filter(Boolean)
      .slice(0, SOLANA_ONCHAIN_CONFIG.signatureLimit);
  }

  private async getLargestAccounts(rpcUrl: string) {
    const [nativeAccounts, wrappedSolAccounts] = await Promise.all([
      this.rpc<{ value?: Array<{ address?: string }> }>(
        rpcUrl,
        "getLargestAccounts",
        [{ commitment: "confirmed" }]
      ).catch(() => ({ value: [] })),
      this.rpc<{ value?: Array<{ address?: string }> }>(
        rpcUrl,
        "getTokenLargestAccounts",
        [SOLANA_ONCHAIN_CONFIG.wrappedSolMint, { commitment: "confirmed" }]
      ).catch(() => ({ value: [] }))
    ]);

    return [...new Set([
      ...(nativeAccounts.value ?? []).map((item) => item.address ?? ""),
      ...(wrappedSolAccounts.value ?? []).map((item) => item.address ?? "")
    ])]
      .filter(Boolean)
      .slice(0, SOLANA_ONCHAIN_CONFIG.whaleAccountLimit);
  }

  private async getTransaction(rpcUrl: string, signature: string) {
    return this.rpc<any>(rpcUrl, "getTransaction", [
      signature,
      {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
        encoding: "jsonParsed"
      }
    ]);
  }

  private collectInstructions(tx: any) {
    const outer = (tx.transaction?.message?.instructions ?? []).map((instruction: any, index: number) => ({
      instruction,
      index
    }));
    const inner = (tx.meta?.innerInstructions ?? []).flatMap((group: any) =>
      (group.instructions ?? []).map((instruction: any, innerIndex: number) => ({
        instruction,
        index: Number(group.index ?? 0) * 100 + innerIndex
      }))
    );

    return [...outer, ...inner];
  }

  private toTransfer({
    instruction,
    signature,
    instructionIndex,
    timestamp,
    solPrice,
    exchangeAddresses,
    whaleAddresses
  }: {
    instruction: any;
    signature: string;
    instructionIndex: number;
    timestamp: string;
    solPrice: number;
    exchangeAddresses: string[];
    whaleAddresses: string[];
  }) {
    const systemTransfer = this.toSystemTransfer(instruction);
    const wrappedSolTransfer = this.toWrappedSolTransfer(instruction);
    const parsedTransfer = systemTransfer ?? wrappedSolTransfer;

    if (!parsedTransfer) {
      return null;
    }

    const amountUsd = parsedTransfer.amount * solPrice;

    const { from, to, amount, tokenAddress } = parsedTransfer;
    return {
      symbol: "SOL",
      chainId: 101,
      tokenSymbol: "SOL",
      tokenAddress,
      txHash: signature,
      logIndex: instructionIndex,
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
    };
  }

  private toSystemTransfer(instruction: any) {
    if (instruction.program !== "system" || instruction.parsed?.type !== "transfer") {
      return null;
    }

    const info = instruction.parsed?.info;
    return {
      from: String(info?.source ?? ""),
      to: String(info?.destination ?? ""),
      amount: Number(info?.lamports ?? 0) / 1_000_000_000,
      tokenAddress: "native"
    };
  }

  private toWrappedSolTransfer(instruction: any) {
    if (instruction.program !== "spl-token") {
      return null;
    }

    if (!["transferChecked", "transfer"].includes(String(instruction.parsed?.type ?? ""))) {
      return null;
    }

    const info = instruction.parsed?.info;
    if (String(info?.mint ?? "") !== SOLANA_ONCHAIN_CONFIG.wrappedSolMint) {
      return null;
    }

    return {
      from: String(info?.source ?? ""),
      to: String(info?.destination ?? ""),
      amount: Number(
        info?.tokenAmount?.uiAmountString ??
        info?.tokenAmount?.uiAmount ??
        info?.amount ??
        0
      ),
      tokenAddress: SOLANA_ONCHAIN_CONFIG.wrappedSolMint
    };
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

  private async rpc<T>(rpcUrl: string, method: string, params: unknown[]) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);

    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: method,
          method,
          params
        }),
        signal: controller.signal
      });
      const payload = await response.json();

      if (!response.ok || payload.error) {
        throw new Error(payload.error?.message ?? `HTTP ${response.status}`);
      }

      return payload.result as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}
