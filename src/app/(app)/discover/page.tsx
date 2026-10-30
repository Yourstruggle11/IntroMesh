import type { Metadata } from "next";
import { PageHeader } from "@/components/app/page-header";
import { DiscoverClient } from "@/components/discover/discover-client";
import { requireOnboardedUser } from "@/lib/auth";
import { effectivePlan } from "@/lib/billing";
import { CHAINS, defaultChain, enabledChains } from "@/lib/crypto/chains";
import { walletConfigured } from "@/lib/crypto/payments";
import { discover } from "@/lib/discover";

export const metadata: Metadata = { title: "Discover" };

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const user = await requireOnboardedUser("/discover");
  const data = await discover(user, q);
  return (
    <>
      <PageHeader eyebrow="Warm-path discovery" title="Who do you want to meet?" description="Search a person, company, role or goal. We traverse your trust graph and rank every warm route." />
      <DiscoverClient
        initialQuery={q}
        data={data}
        chains={enabledChains().map((k) => ({ key: k, label: CHAINS[k].label }))}
        defaultChain={defaultChain()}
        maxBountyUsd={effectivePlan(user).maxBountyUsd}
        bountiesReady={walletConfigured()}
      />
    </>
  );
}
