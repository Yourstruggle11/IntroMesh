import type { Metadata } from "next";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { markAllReadAction } from "@/app/actions/notifications";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/primitives";
import { requireOnboardedUser } from "@/lib/auth";
import { recentNotifications } from "@/lib/queries";
import { cn, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireOnboardedUser("/notifications");
  const items = await recentNotifications(user.id, 60);
  const unread = items.some((n) => !n.readAt);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        action={
          unread ? (
            <form action={markAllReadAction}>
              <Button variant="secondary" size="sm">
                <CheckCheck className="h-4 w-4" /> Mark all read
              </Button>
            </form>
          ) : undefined
        }
      />
      {items.length === 0 ? (
        <EmptyState icon={<Bell className="h-5 w-5" />} title="All quiet" description="Intro requests, approvals, meetings and payouts will show up here." />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {items.map((n) => (
              <li key={n.id}>
                <Link href={n.link ?? "#"} className={cn("flex items-start gap-3 px-5 py-4 transition hover:bg-white/[0.03]", !n.readAt && "bg-brand/[0.03]")}>
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.readAt ? "bg-white/15" : "bg-brand")} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{n.title}</p>
                    {n.body && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{n.body}</p>}
                  </div>
                  <span className="shrink-0 text-xs text-subtle">{timeAgo(n.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
