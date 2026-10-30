import type { ReactNode } from "react";
import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { introRequests, notifications } from "@/db/schema";
import { MobileTabBar, MobileTopBar, Sidebar } from "@/components/app/nav";
import { isAdmin, requireOnboardedUser } from "@/lib/auth";
import { effectivePlan } from "@/lib/billing";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireOnboardedUser();
  const [[inbox], [unread]] = await Promise.all([
    db.select({ n: count() }).from(introRequests).where(and(eq(introRequests.connectorId, user.id), inArray(introRequests.status, ["pending", "accepted"]))),
    db.select({ n: count() }).from(notifications).where(and(eq(notifications.userId, user.id), isNull(notifications.readAt))),
  ]);
  const counts = { inbox: Number(inbox?.n ?? 0), unread: Number(unread?.n ?? 0) };
  const navUser = { id: user.id, name: user.name, headline: user.headline, planName: effectivePlan(user).name, isAdmin: isAdmin(user) };
  return (
    <div className="aurora flex min-h-dvh">
      <Sidebar user={navUser} counts={counts} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar user={navUser} counts={counts} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">{children}</main>
      </div>
      <MobileTabBar counts={counts} />
    </div>
  );
}
