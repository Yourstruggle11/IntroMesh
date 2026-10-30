import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { PageHeader } from "@/components/app/page-header";
import { SettingsForm } from "@/components/forms/settings-form";
import { Button } from "@/components/ui/button";
import { requireOnboardedUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireOnboardedUser("/settings");
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Account" title="Settings" description="Your profile, what you're looking for, and where bounties get paid." />
      <SettingsForm
        email={user.email}
        initial={{
          name: user.name,
          headline: user.headline ?? "",
          role: user.role ?? "",
          company: user.company ?? "",
          linkedinUrl: user.linkedinUrl ?? "",
          payoutAddress: user.payoutAddress ?? "",
          lookingFor: user.lookingFor,
          canIntroduce: user.canIntroduce,
          tags: user.tags,
          showOnLeaderboard: user.showOnLeaderboard,
        }}
      />
      <form action={logoutAction} className="mt-10 border-t border-line pt-6 lg:hidden">
        <Button variant="ghost" className="w-full">
          <LogOut className="h-4 w-4" /> Log out
        </Button>
      </form>
    </div>
  );
}
