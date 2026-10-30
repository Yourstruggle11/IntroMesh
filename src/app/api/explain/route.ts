import { NextResponse } from "next/server";
import { z } from "zod";
import { explainPaths } from "@/lib/ai";
import { getCurrentUser } from "@/lib/auth";

const schema = z.object({
  query: z.string().max(120).default(""),
  items: z
    .array(
      z.object({
        key: z.string().max(80),
        target: z.string().max(160),
        connector: z.string().max(100),
        hops: z.number().int().min(1).max(4),
        via: z.array(z.string().max(100)).max(3),
        signals: z.array(z.string().max(200)).max(6),
      }),
    )
    .max(6),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const reasons = await explainPaths({
    requester: { name: user.name, headline: user.headline, lookingFor: user.lookingFor },
    query: parsed.data.query,
    candidates: parsed.data.items,
  });
  return NextResponse.json({ reasons });
}
