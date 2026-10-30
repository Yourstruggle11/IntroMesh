"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, RefreshCw, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { cancelIntroAction, confirmMetAction, declineIntroAction, generateDraftAction, sendIntroAction } from "@/app/actions/intros";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/client";
import { Card, FieldHint, Input, Label, Textarea } from "@/components/ui/primitives";

export function ConnectorPanel({ introId, initialDraft, targetEmailHint, ccHint }: { introId: string; initialDraft: { subject: string; body: string } | null; targetEmailHint: string; ccHint: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState(initialDraft);
  const [loading, startLoad] = useTransition();
  const [sending, startSend] = useTransition();
  const [declineOpen, setDeclineOpen] = useState(false);
  const [note, setNote] = useState("");
  const [declining, startDecline] = useTransition();

  const gen = (regenerate: boolean) =>
    startLoad(async () => {
      const r = await generateDraftAction(introId, regenerate);
      if (!r.ok) return void toast.error(r.error);
      setDraft({ subject: r.subject, body: r.body });
    });

  return (
    <Card className="ring-gradient p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand">Your call</p>
          <h3 className="mt-1 text-lg font-semibold">Make this intro?</h3>
          <p className="mt-1 text-sm text-muted">Nothing is sent until you approve the exact email.</p>
        </div>
      </div>

      {!draft ? (
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button onClick={() => gen(false)} loading={loading} className="flex-1">
            <Sparkles className="h-4 w-4" /> Approve & draft with AI
          </Button>
          <Button variant="secondary" onClick={() => setDeclineOpen(true)}>
            <X className="h-4 w-4" /> Decline
          </Button>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="rounded-xl border border-line bg-white/[0.02] px-3.5 py-2.5 text-xs text-muted">
            <p>
              <span className="text-subtle">To:</span> {targetEmailHint}
            </p>
            <p className="mt-0.5">
              <span className="text-subtle">CC:</span> {ccHint}
            </p>
          </div>
          <div>
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} maxLength={180} />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Label htmlFor="body" className="mb-0">Email</Label>
              <button onClick={() => gen(true)} disabled={loading} className="inline-flex items-center gap-1 text-xs text-brand disabled:opacity-50">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Regenerate
              </button>
            </div>
            <Textarea id="body" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} className="min-h-[240px] text-[14px] leading-relaxed" maxLength={5000} />
            <FieldHint>Edit freely — this goes out exactly as written, with everyone CC&apos;d and replies coming to you.</FieldHint>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              size="lg"
              className="flex-1"
              loading={sending}
              onClick={() =>
                startSend(async () => {
                  const r = await sendIntroAction(introId, draft.subject, draft.body);
                  if (!r.ok) return void toast.error(r.error);
                  toast.success("Intro sent 🎉 Everyone's CC'd.");
                  router.refresh();
                })
              }
            >
              <Send className="h-4 w-4" /> Send intro
            </Button>
            <Button variant="secondary" size="lg" onClick={() => setDeclineOpen(true)}>
              Decline
            </Button>
          </div>
        </div>
      )}

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen} title="Decline this request?" description="The requester is notified, and any bounty is refunded automatically.">
        <Label htmlFor="note">Optional note</Label>
        <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Not the right timing for them — try again next month!" maxLength={500} />
        <Button
          variant="danger"
          className="mt-4 w-full"
          loading={declining}
          onClick={() =>
            startDecline(async () => {
              const r = await declineIntroAction(introId, note);
              if (!r.ok) return void toast.error(r.error);
              toast("Request declined");
              setDeclineOpen(false);
              router.refresh();
            })
          }
        >
          Decline request
        </Button>
      </Dialog>
    </Card>
  );
}

export function ConfirmMetButton({ introId, as, label = "Yes — we met" }: { introId: string; as: "requester" | "target"; label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="gold"
      size="lg"
      loading={pending}
      onClick={() =>
        start(async () => {
          const r = await confirmMetAction(introId, as);
          if (!r.ok) return void toast.error(r.error);
          toast.success("Thanks for confirming 🤝");
          router.refresh();
        })
      }
    >
      <CheckCircle2 className="h-5 w-5" /> {label}
    </Button>
  );
}

export function CancelButton({ introId }: { introId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      loading={pending}
      onClick={() =>
        start(async () => {
          const r = await cancelIntroAction(introId);
          if (!r.ok) return void toast.error(r.error);
          toast("Request cancelled");
          router.refresh();
        })
      }
    >
      Cancel request
    </Button>
  );
}
