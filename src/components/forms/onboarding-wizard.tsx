"use client";

import { useCallback, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { extractProfileAction, saveProfileAction } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { DictationButton } from "@/components/ui/client";
import { Card, FieldHint, Input, Label, Textarea } from "@/components/ui/primitives";
import { TagInput } from "@/components/ui/tag-input";
import type { ExtractedProfile } from "@/lib/ai";

const EXAMPLE =
  "I'm Ravi, building Settlr — stablecoin payroll for remote teams, live on Base. Looking for seed investors who back payments, and a design partner in Indian SaaS. I can intro people to the Polygon BD team and a few Bangalore fintech founders.";

type Initial = { name: string; about: string | null; headline: string | null; role: string | null; company: string | null; lookingFor: string[]; canIntroduce: string[]; tags: string[]; payoutAddress: string | null; linkedinUrl: string | null };

export function OnboardingWizard({ initial, next, aiOn }: { initial: Initial; next?: string; aiOn: boolean }) {
  const [step, setStep] = useState<0 | 1>(initial.headline ? 1 : 0);
  const [about, setAbout] = useState(initial.about ?? "");
  const [p, setP] = useState<ExtractedProfile & { payoutAddress: string; linkedinUrl: string }>({
    name: initial.name,
    headline: initial.headline ?? "",
    role: initial.role ?? "",
    company: initial.company ?? "",
    lookingFor: initial.lookingFor,
    canIntroduce: initial.canIntroduce,
    tags: initial.tags,
    payoutAddress: initial.payoutAddress ?? "",
    linkedinUrl: initial.linkedinUrl ?? "",
  });
  const [extracting, startExtract] = useTransition();
  const [saving, startSave] = useTransition();

  const onDictate = useCallback((text: string) => setAbout((a) => (a ? `${a.trimEnd()} ${text}` : text)), []);

  const build = () =>
    startExtract(async () => {
      const r = await extractProfileAction(about);
      if (r.error || !r.profile) {
        toast.error(r.error ?? "Couldn't build your profile — try again.");
        return;
      }
      setP((cur) => ({ ...cur, ...r.profile!, name: r.profile!.name || cur.name }));
      setStep(1);
    });

  const save = () =>
    startSave(async () => {
      const r = await saveProfileAction(p, { finishOnboarding: true, next });
      if (r?.error) toast.error(r.error);
    });

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-8 flex items-center gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div className="h-full bg-brand-gradient" initial={false} animate={{ width: step >= i ? "100%" : "0%" }} transition={{ duration: 0.5 }} />
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 0 ? (
          <motion.div key="s0" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Step 1 of 2</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Tell the mesh who you are</h1>
            <p className="mt-3 text-muted">
              One paragraph is enough: what you&apos;re building, who you want to meet, and who you can introduce people to. Type it — or just talk.
            </p>
            <Card className="mt-6 p-4 sm:p-5">
              <Textarea
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                placeholder={EXAMPLE}
                className="min-h-[180px] border-0 bg-transparent px-1 text-[15px] focus:ring-0"
                maxLength={2000}
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                <div className="flex items-center gap-2">
                  <DictationButton onText={onDictate} />
                  <span className="text-xs text-subtle">Tip: Wispr Flow works in this box too.</span>
                </div>
                <button type="button" onClick={() => setAbout(EXAMPLE)} className="text-xs text-muted underline-offset-4 hover:text-fg hover:underline">
                  Use example
                </button>
              </div>
            </Card>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>
                Skip — I&apos;ll fill it in myself
              </Button>
              <Button size="lg" onClick={build} loading={extracting} disabled={about.trim().length < 20}>
                {aiOn ? <Wand2 className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />} Build my profile
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="s1" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }}>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Step 2 of 2</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Looks right?</h1>
            <p className="mt-3 text-muted">This is what others see, and what powers your matches. Edit anything.</p>

            <Card className="mt-6 space-y-5 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="headline">Headline</Label>
                  <Input id="headline" value={p.headline} onChange={(e) => setP({ ...p, headline: e.target.value })} placeholder="Building stablecoin payroll on Base" maxLength={120} />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Input id="role" value={p.role} onChange={(e) => setP({ ...p, role: e.target.value })} placeholder="Founder & CEO" />
                </div>
                <div>
                  <Label htmlFor="company">Company</Label>
                  <Input id="company" value={p.company} onChange={(e) => setP({ ...p, company: e.target.value })} placeholder="Settlr" />
                </div>
              </div>
              <div>
                <Label htmlFor="want">I want to meet</Label>
                <TagInput id="want" value={p.lookingFor} onChange={(v) => setP({ ...p, lookingFor: v })} placeholder="seed investors, Solana devrel…" tone="gold" />
              </div>
              <div>
                <Label htmlFor="can">I can introduce people to</Label>
                <TagInput id="can" value={p.canIntroduce} onChange={(v) => setP({ ...p, canIntroduce: v })} placeholder="Polygon BD, fintech founders…" tone="violet" />
              </div>
              <div>
                <Label htmlFor="tags">Topics</Label>
                <TagInput id="tags" value={p.tags} onChange={(v) => setP({ ...p, tags: v })} placeholder="payments, defi, ai agents…" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="payout">USDC payout address (optional)</Label>
                  <Input id="payout" value={p.payoutAddress} onChange={(e) => setP({ ...p, payoutAddress: e.target.value })} placeholder="0x… from Cake Wallet" className="font-mono text-xs" />
                  <FieldHint>Where your intro bounties land. EVM address (Base/Polygon/Arbitrum).</FieldHint>
                </div>
                <div>
                  <Label htmlFor="li">LinkedIn (optional)</Label>
                  <Input id="li" value={p.linkedinUrl} onChange={(e) => setP({ ...p, linkedinUrl: e.target.value })} placeholder="https://www.linkedin.com/in/…" />
                </div>
              </div>
            </Card>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <Button variant="ghost" onClick={() => setStep(0)}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button size="lg" onClick={save} loading={saving} disabled={p.name.trim().length < 2}>
                Enter the mesh <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
