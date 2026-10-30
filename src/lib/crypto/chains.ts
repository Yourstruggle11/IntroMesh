import { arbitrum, arbitrumSepolia, base, baseSepolia, polygon, polygonAmoy, type Chain } from "viem/chains";

export type ChainKey = "base" | "polygon" | "arbitrum";
export type CryptoNetwork = "mainnet" | "testnet";

export type ChainConfig = {
  key: ChainKey;
  network: CryptoNetwork;
  label: string;
  chain: Chain;
  /** Native USDC contract (6 decimals). */
  usdc: `0x${string}`;
  rpcEnv: string;
  defaultRpc: string;
  /** Extra public endpoints used for automatic failover. */
  fallbackRpcs: string[];
  explorer: string;
  /** Native gas token symbol. */
  gas: string;
  /** Max block span per eth_getLogs call on public RPCs. */
  logSpan: bigint;
  color: string;
};

const MAINNET: Record<ChainKey, ChainConfig> = {
  base: {
    key: "base",
    network: "mainnet",
    label: "Base",
    chain: base,
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    rpcEnv: "RPC_BASE",
    defaultRpc: "https://base-rpc.publicnode.com",
    // mainnet.base.org rate-limits eth_getLogs; 1rpc caps it at 50 blocks.
    fallbackRpcs: ["https://mainnet.base.org", "https://1rpc.io/base"],
    explorer: "https://basescan.org",
    gas: "ETH",
    logSpan: BigInt(500),
    color: "#3B82F6",
  },
  polygon: {
    key: "polygon",
    network: "mainnet",
    label: "Polygon",
    chain: polygon,
    usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    rpcEnv: "RPC_POLYGON",
    defaultRpc: "https://polygon-bor-rpc.publicnode.com",
    fallbackRpcs: ["https://polygon-rpc.com", "https://1rpc.io/matic"],
    explorer: "https://polygonscan.com",
    gas: "POL",
    logSpan: BigInt(500),
    color: "#8B5CF6",
  },
  arbitrum: {
    key: "arbitrum",
    network: "mainnet",
    label: "Arbitrum",
    chain: arbitrum,
    usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    rpcEnv: "RPC_ARBITRUM",
    defaultRpc: "https://arbitrum-one-rpc.publicnode.com",
    fallbackRpcs: ["https://arb1.arbitrum.io/rpc", "https://1rpc.io/arb"],
    explorer: "https://arbiscan.io",
    gas: "ETH",
    logSpan: BigInt(2000),
    color: "#38BDF8",
  },
};

/** Free practice networks: test USDC from faucet.circle.com, test gas from public faucets. */
const TESTNET: Record<ChainKey, ChainConfig> = {
  base: {
    key: "base",
    network: "testnet",
    label: "Base Sepolia",
    chain: baseSepolia,
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    rpcEnv: "RPC_BASE_SEPOLIA",
    defaultRpc: "https://base-sepolia-rpc.publicnode.com",
    fallbackRpcs: ["https://sepolia.base.org"],
    explorer: "https://sepolia.basescan.org",
    gas: "ETH",
    logSpan: BigInt(500),
    color: "#3B82F6",
  },
  polygon: {
    key: "polygon",
    network: "testnet",
    label: "Polygon Amoy",
    chain: polygonAmoy,
    usdc: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
    rpcEnv: "RPC_POLYGON_AMOY",
    defaultRpc: "https://polygon-amoy-bor-rpc.publicnode.com",
    fallbackRpcs: ["https://rpc-amoy.polygon.technology"],
    explorer: "https://amoy.polygonscan.com",
    gas: "POL",
    logSpan: BigInt(500),
    color: "#8B5CF6",
  },
  arbitrum: {
    key: "arbitrum",
    network: "testnet",
    label: "Arbitrum Sepolia",
    chain: arbitrumSepolia,
    usdc: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    rpcEnv: "RPC_ARBITRUM_SEPOLIA",
    defaultRpc: "https://arbitrum-sepolia-rpc.publicnode.com",
    fallbackRpcs: ["https://sepolia-rollup.arbitrum.io/rpc"],
    explorer: "https://sepolia.arbiscan.io",
    gas: "ETH",
    logSpan: BigInt(2000),
    color: "#38BDF8",
  },
};

/** Active network. Defaults to testnet so nothing touches real money unless explicitly enabled. */
export function cryptoNetwork(): CryptoNetwork {
  return process.env.CRYPTO_NETWORK === "mainnet" ? "mainnet" : "testnet";
}

export function chainsFor(network: CryptoNetwork) {
  return network === "mainnet" ? MAINNET : TESTNET;
}

/** Chain configs for the active network. */
export const CHAINS: Record<ChainKey, ChainConfig> = chainsFor(cryptoNetwork());

/** Config for a stored record, honouring the network it was created on. */
export function chainConfig(key: ChainKey, network?: string | null): ChainConfig {
  return chainsFor(network === "mainnet" ? "mainnet" : network === "testnet" ? "testnet" : cryptoNetwork())[key];
}

export const USDC_DECIMALS = 6;
export const USDC_UNIT = BigInt(1_000_000);

export function isChainKey(v: unknown): v is ChainKey {
  return v === "base" || v === "polygon" || v === "arbitrum";
}

/** Chains enabled via CRYPTO_CHAINS (default: all). Safe to call on server only. */
export function enabledChains(): ChainKey[] {
  const raw = (process.env.CRYPTO_CHAINS ?? "base,polygon,arbitrum").split(",").map((s) => s.trim());
  const list = raw.filter(isChainKey);
  return list.length ? list : ["base"];
}

export function defaultChain(): ChainKey {
  const d = process.env.CRYPTO_DEFAULT_CHAIN;
  const enabled = enabledChains();
  return isChainKey(d) && enabled.includes(d) ? d : enabled[0];
}

/** Primary RPC (env override or default) followed by public fallbacks, for the active network. */
export function rpcUrls(key: ChainKey) {
  const c = CHAINS[key];
  const primary = process.env[c.rpcEnv] || c.defaultRpc;
  return [primary, ...[c.defaultRpc, ...c.fallbackRpcs].filter((u) => u !== primary)];
}

export function txUrl(key: ChainKey, hash: string, network?: string | null) {
  return `${chainConfig(key, network).explorer}/tx/${hash}`;
}

export function addressUrl(key: ChainKey, addr: string, network?: string | null) {
  return `${chainConfig(key, network).explorer}/address/${addr}`;
}

/** 1234567n -> "1.234567" (trims trailing zeros, keeps at least 2 decimals). */
export function formatUnits6(units: bigint | string | number) {
  const v = BigInt(units);
  const neg = v < BigInt(0);
  const abs = neg ? -v : v;
  const whole = abs / USDC_UNIT;
  let frac = (abs % USDC_UNIT).toString().padStart(6, "0").replace(/0+$/, "");
  if (frac.length < 2) frac = frac.padEnd(2, "0");
  return `${neg ? "-" : ""}${whole.toString()}.${frac}`;
}

export function usdToUnits(usd: number) {
  return BigInt(Math.round(usd * 100)) * BigInt(10_000);
}
