import type { Metadata } from "next";
import { LegalPage } from "../legal";

export const metadata: Metadata = { title: "Refund & Cancellation Policy" };

export default function RefundsPage() {
  return (
    <LegalPage title="Refund & Cancellation Policy" updated="October 30, 2026">
      <h2>Card subscriptions (Dodo Payments)</h2>
      <ul>
        <li>You can cancel anytime; your plan stays active until the end of the paid billing period.</li>
        <li>If you were charged in error or the service was unavailable, contact us within 14 days and we will refund the charge.</li>
      </ul>
      <h2>Stablecoin (USDC) plan payments</h2>
      <ul>
        <li>Each payment prepays 30 days of access and does not renew automatically.</li>
        <li>Overpayments or payments sent on the wrong network can be returned on request, minus network fees, when recoverable.</li>
      </ul>
      <h2>Intro bounties</h2>
      <ul>
        <li>Bounties are refunded automatically to the paying wallet if the connector declines, if you cancel before a decision, or if the request expires.</li>
        <li>Once both sides confirm the meeting, the bounty is released to the connector and is no longer refundable.</li>
      </ul>
    </LegalPage>
  );
}
