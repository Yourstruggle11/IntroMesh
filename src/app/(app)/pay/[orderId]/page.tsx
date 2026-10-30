import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { PayClient } from "@/components/billing/pay-client";
import { requireOnboardedUser } from "@/lib/auth";
import { chainConfig, formatUnits6, isChainKey } from "@/lib/crypto/chains";
import { paymentUri } from "@/lib/crypto/payments";
import { getOrderForUser } from "@/lib/orders";
import { PLANS, isPlanId } from "@/lib/plans";

export const metadata: Metadata = { title: "Pay with USDC" };

export default async function PayPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const user = await requireOnboardedUser(`/pay/${orderId}`);
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) notFound();
  const order = await getOrderForUser(orderId, user.id);
  if (!order || !isChainKey(order.chain)) notFound();
  const chain = chainConfig(order.chain, order.network);
  const uri = paymentUri(order);
  const qr = await QRCode.toString(uri, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#05080f", light: "#ffffff" } });
  const what = order.purpose === "plan" && isPlanId(order.plan) ? `${PLANS[order.plan].name} plan · 30 days` : "Intro bounty (held until you meet)";
  return (
    <PayClient
      order={{
        id: order.id,
        status: order.status,
        purpose: order.purpose,
        introRequestId: order.introRequestId,
        amount: formatUnits6(order.amountUnits),
        usd: (order.usdCents / 100).toFixed(2),
        treasury: order.treasury,
        txHash: order.txHash,
        expiresAt: order.expiresAt.toISOString(),
      }}
      chain={{ key: chain.key, label: chain.label, gas: chain.gas, explorer: chain.explorer, usdc: chain.usdc, testnet: chain.network === "testnet" }}
      what={what}
      qrSvg={qr}
    />
  );
}
