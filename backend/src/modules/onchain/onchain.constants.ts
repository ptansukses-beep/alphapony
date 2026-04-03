export const SUPPORTED_EVM_ONCHAIN_SYMBOLS = ["ETH", "BNB"] as const;
export const SUPPORTED_ONCHAIN_SYMBOLS = ["ETH", "BNB", "SOL", "XRP"] as const;

export type SupportedEvmOnchainSymbol = (typeof SUPPORTED_EVM_ONCHAIN_SYMBOLS)[number];
export type SupportedOnchainSymbol = (typeof SUPPORTED_ONCHAIN_SYMBOLS)[number];

export const ONCHAIN_CACHE_TTL_MS = 5 * 60 * 1000;

export const TRANSFER_EVENT_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "value", type: "uint256" }
    ],
    name: "Transfer",
    type: "event"
  }
] as const;

export const EVM_ONCHAIN_CONFIG = {
  ETH: {
    symbol: "ETH",
    chainId: 1,
    rpcUrlEnv: "ETH_RPC_URL",
    defaultRpcUrl: "https://ethereum-rpc.publicnode.com",
    lookbackBlocks: 360n,
    nativeLookbackBlocks: 0n,
    exchangeEnv: "ETH_EXCHANGE_ADDRESSES",
    whaleEnv: "ETH_WHALE_ADDRESSES",
    defaultExchangeAddresses: [
      "0x28C6c06298d514Db089934071355E5743bf21d60",
      "0x4E7b110335511F662FDBB01bf958A7844118c0D4"
    ],
    defaultWhaleAddresses: [],
    transferThresholdUsd: 1_000_000,
    exchangeFlowThresholdUsd: 5_000_000,
    whaleTradeThresholdUsd: 1_000_000,
    nativePriceSymbol: "ETH",
    tokens: [
      {
        symbol: "WETH",
        address: "0xC02aaA39b223FE8D0A0E5C4F27eAD9083C756Cc2",
        decimals: 18,
        priceSource: "native"
      },
      {
        symbol: "USDT",
        address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        decimals: 6,
        priceSource: "usd"
      },
      {
        symbol: "USDC",
        address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        decimals: 6,
        priceSource: "usd"
      }
    ]
  },
  BNB: {
    symbol: "BNB",
    chainId: 56,
    rpcUrlEnv: "BNB_RPC_URL",
    defaultRpcUrl: "https://bsc-rpc.publicnode.com",
    lookbackBlocks: 720n,
    nativeLookbackBlocks: 0n,
    exchangeEnv: "BNB_EXCHANGE_ADDRESSES",
    whaleEnv: "BNB_WHALE_ADDRESSES",
    defaultExchangeAddresses: [
      "0xF977814e90dA44bFA03b6295A0616a897441aceC",
      "0xa180fe01B906A1Be37Be6C534A3300785b20d947",
      "0xA0420C29B214d09b9ec751aa1f592c7b1fa77dA3",
      "0xF5988713400DA6fC8a58EC9515e2B0DF9b40b115",
      "0x8894E0a0c962CB723c1976a4421c95949bE2D4E3",
      "0x28C6c06298d514Db089934071355E5743bf21d60"
    ],
    defaultWhaleAddresses: [
      "0xD37c9B07304c6e3396a81A176C9e3b45A9aA07CA",
      "0x771f4c697b35677b107f9ddc9cea0c2976a9a23e"
    ],
    transferThresholdUsd: 2_000,
    exchangeFlowThresholdUsd: 20_000,
    whaleTradeThresholdUsd: 5_000,
    nativePriceSymbol: "BNB",
    tokens: [
      {
        symbol: "WBNB",
        address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
        decimals: 18,
        priceSource: "native"
      },
      {
        symbol: "USDT",
        address: "0x55d398326f99059fF775485246999027B3197955",
        decimals: 18,
        priceSource: "usd"
      },
      {
        symbol: "USDC",
        address: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
        decimals: 18,
        priceSource: "usd"
      },
      {
        symbol: "BUSD",
        address: "0xe9e7cea3dedca5984780bafc599bd69add087d56",
        decimals: 18,
        priceSource: "usd"
      }
    ]
  }
} as const;

export const SOLANA_ONCHAIN_CONFIG = {
  symbol: "SOL",
  rpcUrlEnv: "SOL_RPC_URL",
  defaultRpcUrl: "https://api.mainnet-beta.solana.com",
  wrappedSolMint: "So11111111111111111111111111111111111111112",
  signatureLimit: 56,
  whaleAccountLimit: 8,
  exchangeAccountLimit: 6,
  transferThresholdUsd: 1_000,
  exchangeFlowThresholdUsd: 10_000,
  whaleTradeThresholdUsd: 1_500,
  defaultExchangeAddresses: [
    "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9",
    "5VCwKtCXgCJ6kit5FybXjvriW3xELsFDhYrPSqtJNmcD",
    "C68a6RCGLiPskbPYtAcsCjhG8tfTWYcoB4JjCrXFdqyo",
    "8wM44Ryv9DFCSfkgUnPEPgnsc53arT4cnmXL6LnnC4UW",
    "AEZoku1fLfUz5JYJ3kJ5YVdf3QT1T4RwdggGbuR8Eakd",
    "is6MTRHEgyFLNTfYcuV4QBWLjrZBfmhVNYR6ccgr8KV",
    "5g7yNHyGLJ7fiQ9SN9mf47opDnMjc585kqXWt6d7aBWs",
    "FpwQQhQQoEaVu3WU2qZMfF1hx48YyfwsLoRgXG83E99Q",
    "GCRJD52pGwcCSs4oswYxTBCPatxY1P6WpxCC9R9zty6r",
    "GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7npE",
    "D89hHJT5Aqyx1trP6EnGY9jJUB3whgnq3aUvvCqedvzf",
    "DPqsobysNf5iA9w7zrQM8HLzCKZEDMkZsWbiidsAt1xo",
    "4NyK1AdJBNbgaJ9EsKz3J4rfeHsuYdjkTPg3JaNdLeFw",
    "FWznbcNXWQuHTawe9RxvQ2LdCENssh12dsznf4RiouN5",
    "CDhUgGEiUxx1aTbnoiSAKcmBhnGUFRQ6AMzuLQRD5VFZ",
    "krakeNd6ednDPEXxHAmoBs1qKVM8kLg79PvWF2mhXV1",
    "D5jx4wmxuPz18hqmgpCMLGVq3uSksCafCp5xjVe1nw8p",
    "FH9iLV5Z8EUEDMnW6CzUPkpDhWJCsHqJ5N4W23njNsUo"
  ] as string[],
  defaultWhaleAddresses: [] as string[],
  exchangeEnv: "SOL_EXCHANGE_ADDRESSES",
  whaleEnv: "SOL_WHALE_ADDRESSES"
} as const;

export const XRP_ONCHAIN_CONFIG = {
  symbol: "XRP",
  rpcUrlEnv: "XRP_RPC_URL",
  defaultRpcUrl: "https://s1.ripple.com:51234/",
  limit: 100,
  transferThresholdUsd: 100_000,
  exchangeFlowThresholdUsd: 250_000,
  whaleTradeThresholdUsd: 100_000,
  defaultExchangeAddresses: [
    "rfQ9EcLkU6WnNmkS3EwUkFeXeN47Rk8Cvi",
    "rDAE53VfMvftPB4ogpWGWvzkQxfht6JPxr",
    "rNxp4h8apvRis6mJf9Sh8C6iRxfrDWN7AV",
    "rEb8TK3gBgk5auZkwc6sHnwrGVJH8DuaLh"
  ],
  defaultWhaleAddresses: [] as string[],
  exchangeEnv: "XRP_EXCHANGE_ADDRESSES",
  whaleEnv: "XRP_WHALE_ADDRESSES"
} as const;
