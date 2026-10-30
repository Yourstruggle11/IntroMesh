"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { FileUp, Link2, Lock, Plus, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { addContactAction, connectByCodeAction, deleteContactAction, importContactsAction } from "@/app/actions/connect";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/client";
import { Avatar, Badge, Card, EmptyState, FieldHint, Input, Label, Select, Tag, Textarea } from "@/components/ui/primitives";
import { cn, timeAgo } from "@/lib/utils";

type Conn = { id: string; name: string; headline: string | null; role: string | null; company: string | null; tags: string[]; since: Date | string; source: string };
type Ct = { id: string; name: string; email: string; company: string | null; role: string | null; tags: string[]; strength: number; createdAt: Date | string };

export function ConnectTabs({ initialTab, qr, connections, contacts, contactLimit }: { initialTab: string; qr: ReactNode; connections: Conn[]; contacts: Ct[]; contactLimit: number }) {
  const [tab, setTab] = useState(["qr", "connections", "contacts"].includes(initialTab) ? initialTab : "qr");
  const tabs = [
    { id: "qr", label: "My QR" },
    { id: "connections", label: `Connections · ${connections.length}` },
    { id: "contacts", label: `Private contacts · ${contacts.length}` },
  ];
  return (
    <div>
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-line bg-white/[0.02] p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn("whitespace-nowrap rounded-xl px-4 py-2 text-sm transition", tab === t.id ? "bg-white/[0.08] text-fg shadow" : "text-muted hover:text-fg")}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "qr" && (
        <div className="grid items-start gap-8 lg:grid-cols-[1fr_1fr]">
          {qr}
          <ConnectByCode />
        </div>
      )}
      {tab === "connections" && <ConnectionList items={connections} onShowQr={() => setTab("qr")} />}
      {tab === "contacts" && <ContactsPanel items={contacts} limit={contactLimit} />}
    </div>
  );
}

function ConnectByCode() {
  const [code, setCode] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-brand" />
        <h3 className="font-semibold">Connect with a code</h3>
      </div>
      <p className="mt-1.5 text-sm text-muted">Camera not cooperating? Type the 6-character code under their QR.</p>
      <form
        className="mt-5 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const r = await connectByCodeAction(code);
            if (r.error) toast.error(r.error);
            else {
              toast.success(r.already ? `You're already connected with ${r.name}` : `Connected with ${r.name} 🤝`);
              setCode("");
              router.refresh();
            }
          });
        }}
      >
        <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. K7Q2MX" maxLength={8} className="font-mono uppercase tracking-[0.25em]" autoCapitalize="characters" />
        <Button type="submit" loading={pending} disabled={code.trim().length < 4}>
          Connect
        </Button>
      </form>
      <div className="mt-6 rounded-xl border border-line bg-white/[0.02] p-4 text-sm text-muted">
        <p className="font-medium text-fg">Why scan?</p>
        <p className="mt-1">Each scan is a mutual, consented edge in the trust graph. The more people you connect with at the house, the more warm paths open up — for you and for them.</p>
      </div>
    </Card>
  );
}

function ConnectionList({ items, onShowQr }: { items: Conn[]; onShowQr: () => void }) {
  if (!items.length) {
    return <EmptyState icon={<Users className="h-5 w-5" />} title="No connections yet" description="Show your QR to someone at the house, or scan theirs. Connections are mutual and consented." action={<Button size="sm" onClick={onShowQr}>Show my QR</Button>} />;
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((c) => (
        <li key={c.id}>
          <Link href={`/people/${c.id}`} className="glass flex items-start gap-3 rounded-2xl p-4 transition hover:border-line-strong">
            <Avatar name={c.name} seed={`u:${c.id}`} size={42} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{c.name}</p>
              <p className="truncate text-xs text-muted">{c.headline || [c.role, c.company].filter(Boolean).join(" · ") || "Member"}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {c.tags.slice(0, 2).map((t) => (
                  <Tag key={t}>{t}</Tag>
                ))}
              </div>
            </div>
            <span className="shrink-0 text-[11px] text-subtle">{timeAgo(c.since)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ContactsPanel({ items, limit }: { items: Ct[]; limit: number }) {
  const [addOpen, setAddOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const router = useRouter();
  return (
    <div>
      <Card className="mb-5 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-3/10 text-brand-3">
            <Lock className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold">People you can introduce</p>
            <p className="mt-0.5 text-sm text-muted">Private to you. Others only ever see “someone at Company in Role” — and you approve every intro.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setCsvOpen(true)}>
            <FileUp className="h-4 w-4" /> Import CSV
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add contact
          </Button>
        </div>
      </Card>
      <p className="mb-3 text-xs text-subtle">
        {items.length} / {limit} contacts on your plan
      </p>
      {items.length === 0 ? (
        <EmptyState icon={<UserPlus className="h-5 w-5" />} title="No private contacts yet" description="Add investors, customers or partners you'd happily introduce. They become warm paths for people you trust." />
      ) : (
        <div className="glass overflow-hidden rounded-2xl">
          <ul className="divide-y divide-line">
            {items.map((c) => (
              <ContactRow key={c.id} c={c} onDeleted={() => router.refresh()} />
            ))}
          </ul>
        </div>
      )}
      <Dialog open={addOpen} onOpenChange={setAddOpen} title="Add a private contact" description="Only you can see their name and email.">
        <AddContactForm onDone={() => { setAddOpen(false); router.refresh(); }} />
      </Dialog>
      <Dialog open={csvOpen} onOpenChange={setCsvOpen} title="Import contacts from CSV" description="Header row with name, email, company, role (tags and notes optional).">
        <CsvImport onDone={() => { setCsvOpen(false); router.refresh(); }} />
      </Dialog>
    </div>
  );
}

function ContactRow({ c, onDeleted }: { c: Ct; onDeleted: () => void }) {
  const [pending, start] = useTransition();
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Avatar name={c.name} seed={`c:${c.id}`} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{c.name}</p>
        <p className="truncate text-xs text-muted">{[c.role, c.company].filter(Boolean).join(" · ") || c.email}</p>
      </div>
      <Badge tone="violet" className="hidden sm:inline-flex">{"★".repeat(c.strength)}</Badge>
      <button
        onClick={() =>
          start(async () => {
            const r = await deleteContactAction(c.id);
            if (r.ok) {
              toast.success("Contact removed");
              onDeleted();
            } else toast.error(r.error ?? "Couldn't delete");
          })
        }
        disabled={pending}
        className="rounded-lg p-2 text-subtle transition hover:bg-danger/10 hover:text-danger disabled:opacity-50"
        aria-label={`Delete ${c.name}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

function AddContactForm({ onDone }: { onDone: () => void }) {
  const [state, action, pending] = useActionState(addContactAction, null);
  const done = useRef(false);
  useEffect(() => {
    if (state?.ok && !done.current) {
      done.current = true;
      toast.success("Contact added — it's now a warm path for your connections.");
      onDone();
    } else if (state?.error) toast.error(state.error);
  }, [state, onDone]);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="c-name">Name</Label>
          <Input id="c-name" name="name" required />
        </div>
        <div>
          <Label htmlFor="c-email">Email</Label>
          <Input id="c-email" name="email" type="email" required />
        </div>
        <div>
          <Label htmlFor="c-company">Company</Label>
          <Input id="c-company" name="company" />
        </div>
        <div>
          <Label htmlFor="c-role">Role</Label>
          <Input id="c-role" name="role" />
        </div>
      </div>
      <div>
        <Label htmlFor="c-tags">Tags</Label>
        <Input id="c-tags" name="tags" placeholder="investor, payments, seed" />
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
        <div>
          <Label htmlFor="c-notes">Notes (private)</Label>
          <Textarea id="c-notes" name="notes" className="min-h-[72px]" />
        </div>
        <div>
          <Label htmlFor="c-strength">How well?</Label>
          <Select id="c-strength" name="strength" defaultValue="3">
            <option value="5">★★★★★ Close</option>
            <option value="4">★★★★ Good</option>
            <option value="3">★★★ Know them</option>
            <option value="2">★★ Met once</option>
            <option value="1">★ Barely</option>
          </Select>
        </div>
      </div>
      <Button type="submit" className="w-full" loading={pending}>
        Add contact
      </Button>
    </form>
  );
}

function CsvImport({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-4">
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-white/[0.02] px-4 py-8 text-center transition hover:border-brand/50">
        <FileUp className="h-6 w-6 text-brand" />
        <span className="mt-2 text-sm font-medium">Choose a .csv file</span>
        <span className="mt-1 text-xs text-muted">or paste rows below</span>
        <input
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (f.size > 2_000_000) return void toast.error("File too large (max 2MB).");
            setText(await f.text());
          }}
        />
      </label>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={"name,email,company,role\nPriya Shah,priya@fund.vc,Seed Fund,Partner"} className="min-h-[120px] font-mono text-xs" />
      <FieldHint>Duplicates and rows without a valid email are skipped.</FieldHint>
      <Button
        className="w-full"
        loading={pending}
        disabled={!text.trim()}
        onClick={() =>
          start(async () => {
            const r = await importContactsAction(text);
            if (r.error) return void toast.error(r.error);
            toast.success(`Imported ${r.added} contact${r.added === 1 ? "" : "s"}${r.skipped ? ` · ${r.skipped} skipped` : ""}`);
            onDone();
          })
        }
      >
        Import contacts
      </Button>
    </div>
  );
}
