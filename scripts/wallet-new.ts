import { appendFileSync, existsSync, readFileSync, writeFileSync } from "fs";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { loadEnv } from "./_env";

loadEnv();

const existing = process.env.WALLET_PRIVATE_KEY;
if (existing && /^0x[0-9a-fA-F]{64}$/.test(existing)) {
  console.log("A wallet is already configured. Address:", privateKeyToAccount(existing as `0x${string}`).address);
  process.exit(0);
}

const key = generatePrivateKey();
const address = privateKeyToAccount(key).address;
const file = ".env.local";
const current = existsSync(file) ? readFileSync(file, "utf8") : "";
if (/^WALLET_PRIVATE_KEY=.+$/m.test(current)) {
  console.error("WALLET_PRIVATE_KEY already has a value in .env.local but it isn't a valid key. Fix it manually.");
  process.exit(1);
}
if (/^WALLET_PRIVATE_KEY=[ \t]*$/m.test(current)) {
  // Fill the empty placeholder line copied from .env.example.
  writeFileSync(file, current.replace(/^WALLET_PRIVATE_KEY=[ \t]*$/m, `WALLET_PRIVATE_KEY=${key}`));
} else {
  appendFileSync(file, `${current.endsWith("\n") || !current ? "" : "\n"}# Server wallet (generated ${new Date().toISOString()}) — keep secret\nWALLET_PRIVATE_KEY=${key}\n`);
}
console.log("✓ New server wallet written to .env.local (private key NOT printed).");
console.log("  Address:", address);
console.log("  Fund it on Base with a little ETH (gas) and some USDC for bounty payouts.");
console.log("  To view it in Cake Wallet, restore an EVM wallet from the private key in .env.local.");
