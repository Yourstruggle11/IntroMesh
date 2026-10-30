import { NextResponse } from "next/server";
import { WebhookError, handleDodoWebhook } from "@/lib/dodo";

export async function POST(req: Request) {
  const raw = await req.text(); // raw body is required for signature verification
  try {
    const r = await handleDodoWebhook(raw, req.headers);
    return NextResponse.json({ received: true, duplicate: r.duplicate });
  } catch (err) {
    if (err instanceof WebhookError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[dodo:webhook]", err);
    // 500 makes Dodo retry later.
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
