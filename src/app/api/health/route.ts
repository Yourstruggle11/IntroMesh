import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db, usingEmbeddedDb } from "@/db";
import { aiEnabled } from "@/lib/ai";
import { walletConfigured } from "@/lib/crypto/payments";
import { dodoConfigured } from "@/lib/dodo";
import { smtpConfigured } from "@/lib/email";
import { tgConfigured } from "@/lib/graph/tigergraph";

export async function GET() {
  let dbOk = false;
  try {
    await db.execute(sql`select 1`);
    dbOk = true;
  } catch {
    dbOk = false;
  }
  return NextResponse.json({
    ok: dbOk,
    db: dbOk ? (usingEmbeddedDb() ? "embedded" : "postgres") : "down",
    ai: aiEnabled(),
    email: smtpConfigured(),
    tigergraph: tgConfigured(),
    crypto: walletConfigured(),
    dodo: dodoConfigured(),
  });
}
