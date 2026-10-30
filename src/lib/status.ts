export type Tone = "neutral" | "brand" | "gold" | "success" | "danger" | "violet" | "warning";

export const INTRO_STATUS: Record<string, { label: string; tone: Tone; hint: string }> = {
  awaiting_payment: { label: "Awaiting bounty payment", tone: "gold", hint: "Send the USDC bounty to submit this request." },
  pending: { label: "Waiting for connector", tone: "brand", hint: "The connector will review your request." },
  accepted: { label: "Approved · drafting", tone: "violet", hint: "The connector approved and is preparing the email." },
  introduced: { label: "Intro sent", tone: "success", hint: "Everyone is CC'd. Confirm once you've met." },
  met: { label: "Met 🤝", tone: "success", hint: "Both sides confirmed the meeting." },
  declined: { label: "Declined", tone: "danger", hint: "The connector couldn't make this intro." },
  expired: { label: "Expired", tone: "neutral", hint: "No action was taken in time." },
  cancelled: { label: "Cancelled", tone: "neutral", hint: "This request was withdrawn." },
};

export const BOUNTY_STATUS: Record<string, { label: string; tone: Tone }> = {
  none: { label: "No bounty", tone: "neutral" },
  awaiting_payment: { label: "Awaiting payment", tone: "gold" },
  held: { label: "Held in escrow", tone: "gold" },
  payout_pending: { label: "Payout pending", tone: "warning" },
  payout_sending: { label: "Paying out…", tone: "warning" },
  paid: { label: "Paid to connector", tone: "success" },
  refund_pending: { label: "Refund pending", tone: "warning" },
  refund_sending: { label: "Refunding…", tone: "warning" },
  refunded: { label: "Refunded", tone: "neutral" },
  failed: { label: "Failed", tone: "danger" },
};

export function introStatus(s: string) {
  return INTRO_STATUS[s] ?? { label: s, tone: "neutral" as Tone, hint: "" };
}

export function bountyStatus(s: string) {
  return BOUNTY_STATUS[s] ?? { label: s, tone: "neutral" as Tone };
}
