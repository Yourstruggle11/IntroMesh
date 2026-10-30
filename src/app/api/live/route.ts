import { NextResponse } from "next/server";
import { liveStats } from "@/lib/stats";

export async function GET() {
  try {
    const stats = await liveStats();
    return NextResponse.json(stats, { headers: { "Cache-Control": "public, max-age=5, s-maxage=5" } });
  } catch (err) {
    console.error("[live]", err);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
