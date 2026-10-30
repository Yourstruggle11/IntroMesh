"use client";

import { useState, useTransition } from "react";
import { Play, RefreshCw, Server, Wrench } from "lucide-react";
import { toast } from "sonner";
import { resyncGraphAction, retryEmailAction, runTickAction, setupTigerGraphAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";

export function AdminActions() {
  const [log, setLog] = useState("");
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; log: string }>) =>
    start(async () => {
      const r = await fn();
      setLog(r.log);
      if (r.ok) toast.success("Done");
      else toast.error("Finished with errors — see log");
    });
  return (
    <Card className="p-5">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Wrench className="h-4 w-4 text-brand" /> Operations
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" loading={pending} onClick={() => run(setupTigerGraphAction)}>
          <Server className="h-4 w-4" /> Set up TigerGraph (schema + query + sync)
        </Button>
        <Button size="sm" variant="secondary" loading={pending} onClick={() => run(resyncGraphAction)}>
          <RefreshCw className="h-4 w-4" /> Resync graph
        </Button>
        <Button size="sm" variant="secondary" loading={pending} onClick={() => run(runTickAction)}>
          <Play className="h-4 w-4" /> Run expiry/refund tick
        </Button>
      </div>
      {log && <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-black/40 p-3 font-mono text-[11px] text-muted">{log}</pre>}
    </Card>
  );
}

export function RetryEmail({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="text-xs text-brand hover:underline disabled:opacity-50"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await retryEmailAction(id);
          if (r.ok) toast.success(`Email ${r.status}`);
          else toast.error(r.error ?? "Retry failed");
        })
      }
    >
      {pending ? "Retrying…" : "Retry"}
    </button>
  );
}
