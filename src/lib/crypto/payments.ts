import "server-only";
import { randomInt } from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  erc20Abi,
  fallback,
  getAddress,
  http,
  isAddress,
  parseAbiItem,
  type Hash,
  type PublicClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { db } from "@/db";
import { paymentOrders, type PaymentOrder } from "@/db/schema";
import { CHAINS, chainConfig, cryptoNetwork, enabledChains, rpcUrls, type ChainKey } from "./chains";

const TRANSFER_EVENT = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");
const ORDER_TTL_MIN = 45;

export function walletConfigured() {
  const k = process.env.WALLET_PRIVATE_KEY;
  return Boolean(k && /^0x[0-9a-fA-F]{64}$/.test(k));
}

function account() {
  if (!walletConfigured()) throw new Error("WALLET_PRIVATE_KEY is not configured");
  return privateKeyToAccount(process.env.WALLET_PRIVATE_KEY as `0x${string}`);
}

export function treasuryAddress(): `0x${string}` | null {
  return walletConfigured() ? account().address : null;
}

const clients = new Map<ChainKey, PublicClient>();
export function publicClient(key: ChainKey): PublicClient {
  let c = clients.get(key);
  if (!c) {
    c = createPublicClient({ chain: CHAINS[key].chain, transport: fallback(rpcUrls(key).map((u) => http(u, { timeout: 12_000, retryCount: 1 }))) }) as PublicClient;
    clients.set(key, c);
  }
  return c;
}

export function normalizeAddress(addr: string): `0x${string}` | null {
  const a = addr.trim();
  return isAddress(a) ? getAddress(a) : null;
}

/** Create an order whose exact amount (price + unique micro-offset) identifies the payment. */
export async function createOrder(opts: {
  userId: string;
  purpose: "plan" | "bounty";
  usdCents: number;
  chain: ChainKey;
  plan?: string | null;
  introRequestId?: string | null;
}): Promise<PaymentOrder> {
  const treasury = treasuryAddress();
  if (!treasury) throw new Error("Crypto payments are not configured yet (missing server wallet).");
  if (!enabledChains().includes(opts.chain)) throw new Error("That chain is not enabled.");

  const base = BigInt(opts.usdCents) * BigInt(10_000);
  const pending = await db
    .select({ amountUnits: paymentOrders.amountUnits })
    .from(paymentOrders)
    .where(and(eq(paymentOrders.chain, opts.chain), eq(paymentOrders.network, cryptoNetwork()), eq(paymentOrders.status, "pending")));
  const taken = new Set(pending.map((p) => p.amountUnits.toString()));
  let amount = base;
  for (let i = 0; i < 50; i++) {
    const candidate = base + BigInt(randomInt(1, 9999));
    if (!taken.has(candidate.toString())) {
      amount = candidate;
      break;
    }
  }

  const latest = await publicClient(opts.chain).getBlockNumber();
  const startBlock = latest > BigInt(5) ? latest - BigInt(5) : BigInt(0);
  const [order] = await db
    .insert(paymentOrders)
    .values({
      userId: opts.userId,
      purpose: opts.purpose,
      plan: opts.plan ?? null,
      introRequestId: opts.introRequestId ?? null,
      chain: opts.chain,
      network: cryptoNetwork(),
      amountUnits: amount,
      usdCents: opts.usdCents,
      treasury,
      startBlock,
      expiresAt: new Date(Date.now() + ORDER_TTL_MIN * 60_000),
    })
    .returning();
  return order;
}

export function paymentUri(order: Pick<PaymentOrder, "chain" | "treasury" | "amountUnits" | "network">) {
  const c = chainConfig(order.chain as ChainKey, order.network);
  // EIP-681 token transfer request
  return `ethereum:${c.usdc}@${c.chain.id}/transfer?address=${order.treasury}&uint256=${order.amountUnits.toString()}`;
}

type Match = { txHash: Hash; from: `0x${string}`; blockNumber: bigint };

/** Scan USDC transfers to the treasury since the order was created. */
async function findTransfer(order: PaymentOrder): Promise<Match | null> {
  const key = order.chain as ChainKey;
  const c = CHAINS[key];
  const client = publicClient(key);
  const latest = await client.getBlockNumber();
  let from = order.startBlock;
  // Don't scan more than ~2 hours of blocks.
  const maxSpan = BigInt(7200);
  if (latest - from > maxSpan) from = latest - maxSpan;
  while (from <= latest) {
    const to = from + c.logSpan - BigInt(1) > latest ? latest : from + c.logSpan - BigInt(1);
    const logs = await client.getLogs({ address: c.usdc, event: TRANSFER_EVENT, args: { to: order.treasury as `0x${string}` }, fromBlock: from, toBlock: to });
    for (const log of logs) {
      if (log.args.value === order.amountUnits && log.transactionHash && log.args.from) {
        return { txHash: log.transactionHash, from: log.args.from, blockNumber: log.blockNumber ?? latest };
      }
    }
    from = to + BigInt(1);
  }
  return null;
}

/** Check one pending order on-chain. Returns the (possibly updated) order. */
export async function checkOrder(order: PaymentOrder): Promise<{ order: PaymentOrder; justPaid: boolean }> {
  if (order.status !== "pending") return { order, justPaid: false };
  // Never look for (or accept) a payment on a different network than the order was created for.
  if (order.network !== cryptoNetwork()) return { order, justPaid: false };
  const match = await findTransfer(order);
  if (!match) {
    if (order.expiresAt.getTime() < Date.now() - 5 * 60_000) {
      const [o] = await db.update(paymentOrders).set({ status: "expired" }).where(and(eq(paymentOrders.id, order.id), eq(paymentOrders.status, "pending"))).returning();
      return { order: o ?? order, justPaid: false };
    }
    return { order, justPaid: false };
  }
  return markPaid(order, match);
}

/** Fallback: the payer pastes their transaction hash. */
export async function verifyTxHash(order: PaymentOrder, hash: string): Promise<{ order: PaymentOrder; justPaid: boolean; error?: string }> {
  if (order.status !== "pending") return { order, justPaid: false };
  if (order.network !== cryptoNetwork()) return { order, justPaid: false, error: `This order was created on ${order.network}, but the app is now on ${cryptoNetwork()}.` };
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash.trim())) return { order, justPaid: false, error: "That doesn't look like a transaction hash." };
  const key = order.chain as ChainKey;
  const c = CHAINS[key];
  const receipt = await publicClient(key).getTransactionReceipt({ hash: hash.trim() as Hash }).catch(() => null);
  if (!receipt) return { order, justPaid: false, error: `Transaction not found on ${c.label} yet. Wait a few seconds and retry.` };
  if (receipt.status !== "success") return { order, justPaid: false, error: "That transaction failed on-chain." };
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== c.usdc.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi: [TRANSFER_EVENT], data: log.data, topics: log.topics });
      if (ev.args.to.toLowerCase() === order.treasury.toLowerCase() && ev.args.value === order.amountUnits) {
        return markPaid(order, { txHash: receipt.transactionHash, from: ev.args.from, blockNumber: receipt.blockNumber });
      }
    } catch {
      /* not a Transfer */
    }
  }
  return { order, justPaid: false, error: "That transaction doesn't contain the exact USDC amount for this order." };
}

async function markPaid(order: PaymentOrder, m: Match) {
  try {
    const [o] = await db
      .update(paymentOrders)
      .set({ status: "paid", txHash: m.txHash, payerAddress: getAddress(m.from), paidAt: new Date() })
      .where(and(eq(paymentOrders.id, order.id), inArray(paymentOrders.status, ["pending", "expired"])))
      .returning();
    if (!o) {
      const [cur] = await db.select().from(paymentOrders).where(eq(paymentOrders.id, order.id)).limit(1);
      return { order: cur ?? order, justPaid: false };
    }
    return { order: o, justPaid: true };
  } catch (err) {
    // Unique (chain, tx_hash): this transfer already paid another order.
    console.warn("[pay] markPaid conflict:", (err as Error).message);
    return { order, justPaid: false };
  }
}

/** Send USDC from the server wallet. Waits for 1 confirmation. */
export async function sendUsdc(key: ChainKey, to: string, units: bigint, network: string): Promise<Hash> {
  // Funds received on one network are only ever paid out on that same network.
  if (network !== cryptoNetwork()) throw new Error(`Network mismatch: funds are on ${network}, the app is on ${cryptoNetwork()}`);
  const dest = normalizeAddress(to);
  if (!dest) throw new Error("Invalid destination address");
  if (units <= BigInt(0)) throw new Error("Invalid amount");
  const acct = account();
  const c = CHAINS[key];
  const wallet = createWalletClient({ account: acct, chain: c.chain, transport: fallback(rpcUrls(key).map((u) => http(u, { timeout: 20_000, retryCount: 1 }))) });
  const hash = await wallet.writeContract({ address: c.usdc, abi: erc20Abi, functionName: "transfer", args: [dest, units] });
  const receipt = await publicClient(key).waitForTransactionReceipt({ hash, timeout: 60_000 });
  if (receipt.status !== "success") throw new Error(`Transfer reverted (${hash})`);
  return hash;
}

export async function walletBalances() {
  const addr = treasuryAddress();
  if (!addr) return null;
  const out: { chain: ChainKey; usdc: bigint | null; gas: bigint | null }[] = [];
  for (const key of enabledChains()) {
    const client = publicClient(key);
    const [usdc, gas] = await Promise.all([
      client.readContract({ address: CHAINS[key].usdc, abi: erc20Abi, functionName: "balanceOf", args: [addr] }).catch(() => null),
      client.getBalance({ address: addr }).catch(() => null),
    ]);
    out.push({ chain: key, usdc, gas });
  }
  return { address: addr, balances: out };
}
