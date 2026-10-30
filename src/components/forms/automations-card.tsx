"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Loader2, Send, Workflow, Zap } from "lucide-react";
import { toast } from "sonner";
import { saveAutomationWebhookAction, sendTestAutomationAction } from "@/app/actions/automations";
import { Button } from "@/components/ui/button";
import { Badge, Card, FieldHint, Input, Label } from "@/components/ui/primitives";

declare global {
  interface Window {
    openViasocket?: (...args: unknown[]) => void;
  }
}

const SCRIPT_ID = "viasocket-embed-main-script";

/**
 * Load viaSocket's embed on demand, authorised with this member's signed token. Our `config` overrides the
 * display style set in the viaSocket dashboard: "all_space" would render the builder inline at the bottom
 * of the page, so we always ask for a slide-over panel instead.
 */
function loadViasocket(embedToken: string, src: string): Promise<void> {
  if (window.openViasocket) return Promise.resolve();
  return new Promise((resolve, reject) => {
    document.getElementById(SCRIPT_ID)?.remove(); // a previous attempt that failed to load
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.src = src;
    s.async = true;
    s.setAttribute("embedToken", embedToken);
    const narrow = window.innerWidth < 768;
    s.setAttribute("config", JSON.stringify({ type: "right_slider", width: narrow ? "100" : "45", widthUnit: "%", backdrop: true }));
    s.onload = () => (window.openViasocket ? resolve() : reject(new Error("viaSocket loaded without its API")));
    s.onerror = () => reject(new Error("viaSocket script failed to load"));
    document.body.appendChild(s);
  });
}

export function AutomationsCard({ embedToken, embedSrc, webhookUrl, events }: { embedToken: string | null; embedSrc: string; webhookUrl: string | null; events: { type: string; label: string }[] }) {
  const [url, setUrl] = useState(webhookUrl ?? "");
  const [opening, setOpening] = useState(false);
  const [saving, startSave] = useTransition();
  const [testing, startTest] = useTransition();

  const openViasocket = async () => {
    if (!embedToken) return;
    setOpening(true);
    try {
      await loadViasocket(embedToken, embedSrc);
      window.openViasocket?.();
    } catch (err) {
      console.error("[viasocket]", (err as Error).message);
      toast.error("Couldn't open viaSocket. Check your connection (or an ad blocker) and try again.");
    } finally {
      setOpening(false);
    }
  };

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
        <Button variant="secondary" disabled={!embedToken || opening} onClick={openViasocket}>
          {opening ? <Loader2 className="h-4 w-4 animate-spin text-brand-2" /> : <Zap className="h-4 w-4 text-brand-2" />} Open viaSocket
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
