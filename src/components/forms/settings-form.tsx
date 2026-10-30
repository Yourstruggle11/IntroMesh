"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Save, Wand2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { saveProfileAction, type ProfileInput } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { Card, FieldHint, Input, Label } from "@/components/ui/primitives";
import { TagInput } from "@/components/ui/tag-input";

export function SettingsForm({ initial, email }: { initial: Required<Pick<ProfileInput, "name" | "headline" | "role" | "company" | "linkedinUrl" | "payoutAddress" | "lookingFor" | "canIntroduce" | "tags">> & { showOnLeaderboard: boolean }; email: string }) {
  const [p, setP] = useState(initial);
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      const r = await saveProfileAction(p);
      if (r?.error) toast.error(r.error);
      else toast.success("Saved");
    });
  return (
    <div className="space-y-6">
      <Card className="p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Profile</h2>
          <Link href="/onboarding?edit=1" className="inline-flex items-center gap-1 text-xs text-brand hover:underline">
            <Wand2 className="h-3.5 w-3.5" /> Rebuild with AI
          </Link>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={email} disabled />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="headline">Headline</Label>
            <Input id="headline" value={p.headline} onChange={(e) => setP({ ...p, headline: e.target.value })} maxLength={120} />
          </div>
          <div>
            <Label htmlFor="role">Role</Label>
            <Input id="role" value={p.role} onChange={(e) => setP({ ...p, role: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="company">Company</Label>
            <Input id="company" value={p.company} onChange={(e) => setP({ ...p, company: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="li">LinkedIn</Label>
            <Input id="li" value={p.linkedinUrl} onChange={(e) => setP({ ...p, linkedinUrl: e.target.value })} placeholder="https://www.linkedin.com/in/…" />
          </div>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <h2 className="font-semibold">What powers your matches</h2>
        <div className="mt-5 space-y-4">
          <div>
            <Label>I want to meet</Label>
            <TagInput value={p.lookingFor} onChange={(v) => setP({ ...p, lookingFor: v })} tone="gold" placeholder="seed investors…" />
          </div>
          <div>
            <Label>I can introduce people to</Label>
            <TagInput value={p.canIntroduce} onChange={(v) => setP({ ...p, canIntroduce: v })} tone="violet" placeholder="Polygon BD…" />
          </div>
          <div>
            <Label>Topics</Label>
            <TagInput value={p.tags} onChange={(v) => setP({ ...p, tags: v })} placeholder="payments, ai agents…" />
          </div>
        </div>
      </Card>

      <Card id="payout" className="scroll-mt-24 border-gold/20 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-semibold">
          <Wallet className="h-4 w-4 text-gold" /> Bounty payouts
        </h2>
        <p className="mt-1 text-sm text-muted">USDC bounties for intros you make are sent here, on the network the requester paid on.</p>
        <div className="mt-4">
          <Label htmlFor="payout-addr">EVM wallet address</Label>
          <Input id="payout-addr" value={p.payoutAddress} onChange={(e) => setP({ ...p, payoutAddress: e.target.value })} placeholder="0x… (copy from Cake Wallet → Receive)" className="font-mono text-xs" />
          <FieldHint>Same address works on Base, Polygon and Arbitrum.</FieldHint>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <span>
            <span className="block font-semibold">Show me on the live leaderboard</span>
            <span className="block text-sm text-muted">Your first name and intro count appear on the event screen.</span>
          </span>
          <input type="checkbox" className="peer sr-only" checked={p.showOnLeaderboard} onChange={(e) => setP({ ...p, showOnLeaderboard: e.target.checked })} />
          <span className="relative h-6 w-11 shrink-0 rounded-full bg-white/10 transition peer-checked:bg-brand after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-5" />
        </label>
      </Card>

      <div className="sticky bottom-24 z-10 flex justify-end lg:bottom-6">
        <Button size="lg" onClick={save} loading={pending} className="shadow-2xl">
          <Save className="h-4 w-4" /> Save changes
        </Button>
      </div>
    </div>
  );
}
