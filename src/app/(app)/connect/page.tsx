import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { ConnectTabs } from "@/components/connect/connect-client";
import { QrCard } from "@/components/connect/qr-card";
import { requireOnboardedUser } from "@/lib/auth";
import { effectivePlan } from "@/lib/billing";
import { myConnections, myContacts } from "@/lib/queries";
import { absoluteUrl } from "@/lib/utils";

export const metadata: Metadata = { title: "Connect" };

export default async function ConnectPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const user = await requireOnboardedUser("/connect");
  const [connections, contacts] = await Promise.all([myConnections(user.id), myContacts(user.id)]);
  return (
    <>
      <PageHeader eyebrow="Your mesh" title="Connect" description="Grow your trust graph: scan people you meet, and add the contacts you can introduce." />
      <ConnectTabs
        initialTab={tab ?? "qr"}
        qr={<QrCard name={user.name} headline={user.headline} code={user.connectCode} url={absoluteUrl(`/c/${user.connectCode}`)} />}
        connections={connections}
        contacts={contacts.map((c) => ({ id: c.id, name: c.name, email: c.email, company: c.company, role: c.role, tags: c.tags, strength: c.strength, createdAt: c.createdAt }))}
        contactLimit={effectivePlan(user).maxContacts}
      />
    </>
  );
}
