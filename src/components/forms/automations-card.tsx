"use client";

import { useEffect, useState, useTransition } from "react";
import { ExternalLink, Send, Workflow, Zap } from "lucide-react";
import { toast } from "sonner";
import { saveAutomationWebhookAction, sendTestAutomationAction } from "@/app/actions/automations";
import { Button } from "@/components/ui/button";
import { Badge, Card, FieldHint, Input, Label } from "@/components/ui/primitives";

declare global {
  interface Window {
    openViasocket?: (...args: unknown[]) => void;
  }
}

export function AutomationsCard({ embedToken, embedSrc, webhookUrl, events }: { embedToken: string | null; embedSrc: string; webhookUrl: string | null; events: { type: string; label: string }[] }) {
  const [url, setUrl] = useState(webhookUrl ?? "");
  const [ready, setReady] = useState(false);
  const [saving, startSave] = useTransition();
  const [testing, startTest] = useTransition();

  // Load viaSocket's embed script once, authorised with this member's signed token.
  useEffect(() => {
    if (!embedToken) return;
    const id = "viasocket-embed-main-script";
    const existing = document.getElementById(id);
    if (existing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReady(true);
      return;
    }
    const s = document.createElement("script");
    s.id = id;
    s.src = embedSrc;
    s.async = true;
    s.setAttribute("embedToken", embedToken);
    s.onload = () => setReady(true);
    s.onerror = () => toast.error("Couldn't load viaSocket right now.");
    document.body.appendChild(s);
  }, [embedToken, embedSrc]);

  return (
    <Card id="automations" className="scroll-mt-24 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <Workflow className="h-4 w-4 text-brand-2" /> Automations
          </h2>
          <p className="mt-1 text-sm text-muted">Send your IntroMesh activity to Slack, Google Sheets, HubSpot, Notion and 1,000+ apps.</p>
        </div>
        <Badge tone="brand">Powered by viaSocket</Badge>
      </div>

      <ol className="mt-5 space-y-2 text-sm text-fg/85">
        <li>
          <b>1.</b> Open viaSocket and create a flow that starts with a <b>Webhook</b> trigger.
        </li>
        <li>
          <b>2.</b> Paste the webhook URL below and send a test event.
        </li>
        <li>
          <b>3.</b> Add any action, e.g. post to Slack or add a row to a Sheet, whenever someone asks you for an intro.
        </li>
      </ol>

      <div className="mt-5">
        <Button
          variant="secondary"
          disabled={!embedToken}
          onClick={() => {
            if (window.openViasocket) window.openViasocket();
            else toast(ready ? "viaSocket is still starting — try again in a second." : "Loading viaSocket…");
          }}
        >
          <Zap className="h-4 w-4 text-brand-2" /> Open viaSocket
          <ExternalLink className="h-3.5 w-3.5 opacity-60" />
        </Button>
        {!embedToken && <p className="mt-2 text-xs text-subtle">viaSocket isn&apos;t configured on this deployment yet.</p>}
      </div>

      <div className="mt-6">
        <Label htmlFor="hook">Webhook URL from your viaSocket flow</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input id="hook" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="font-mono text-xs" />
          <Button
            loading={saving}
            onClick={() =>
              startSave(async () => {
                const r = await saveAutomationWebhookAction(url);
                if (r.error) return void toast.error(r.error);
                toast.success(url.trim() ? "Webhook saved" : "Webhook removed");
              })
            }
          >
            Save
          </Button>
          <Button
            variant="secondary"
            loading={testing}
            disabled={!webhookUrl && !url}
            onClick={() =>
              startTest(async () => {
                const r = await sendTestAutomationAction();
                if (r.error) return void toast.error(r.error);
                toast.success(`Test event delivered (${r.status})`);
              })
            }
          >
            <Send className="h-4 w-4" /> Test
          </Button>
        </div>
        <FieldHint>Only https URLs on public hosts are accepted. Events are sent as JSON.</FieldHint>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-subtle">Events we send</p>
        <div className="flex flex-wrap gap-1.5">
          {events.map((e) => (
            <span key={e.type} className="rounded-lg border border-line bg-white/[0.03] px-2 py-1 text-xs text-muted" title={e.type}>
              {e.label}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}
