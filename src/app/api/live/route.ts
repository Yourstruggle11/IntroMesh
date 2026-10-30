import { NextResponse } from "next/server";
import { liveStats, withDeadline } from "@/lib/stats";

export async function GET() {
  try {
    const stats = await withDeadline(liveStats(), 8000);
    // Vercel's CDN answers repeat polls for 10s, so a room full of screens costs one query batch.
    return NextResponse.json(stats, { headers: { "Cache-Control": "public, max-age=0, s-maxage=10, stale-while-revalidate=30" } });
  } catch (err) {
    console.error("[live]", (err as Error).message);
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
