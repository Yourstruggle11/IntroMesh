export type PlanId = "free" | "pro" | "team";

export type Plan = {
  id: PlanId;
  name: string;
  tagline: string;
  /** Monthly price in USD cents (0 = free). */
  priceCents: number;
  /** Intro requests per calendar month (null = unlimited). */
  requestsPerMonth: number | null;
  /** Private "can introduce" contacts you can store. */
  maxContacts: number;
  /** Largest bounty you can attach to a single intro request, in USD. */
  maxBountyUsd: number;
  features: string[];
  highlight?: boolean;
};

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    tagline: "Start meeting the right people.",
    priceCents: 0,
    requestsPerMonth: 5,
    maxContacts: 50,
    maxBountyUsd: 5,
    features: [
      "5 intro requests / month",
      "50 private contacts",
      "Warm-path discovery & AI intro drafts",
      "Bounties up to $5",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "For founders who live on warm intros.",
    priceCents: 900,
    requestsPerMonth: 50,
    maxContacts: 500,
    maxBountyUsd: 50,
    features: [
      "50 intro requests / month",
      "500 private contacts",
      "Bounties up to $50",
      "Everything in Free",
    ],
    highlight: true,
  },
  team: {
    id: "team",
    name: "Team",
    tagline: "For BD & partnership teams.",
    priceCents: 2900,
    requestsPerMonth: null,
    maxContacts: 2000,
    maxBountyUsd: 200,
    features: [
      "Unlimited intro requests",
      "2,000 private contacts",
      "Bounties up to $200",
      "Everything in Pro",
    ],
  },
};

export const PAID_PLANS: PlanId[] = ["pro", "team"];

/** Prepaid term granted by one crypto payment. */
export const CRYPTO_TERM_DAYS = 30;

export function formatUsd(cents: number) {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

export function isPlanId(v: unknown): v is PlanId {
  return v === "free" || v === "pro" || v === "team";
}
