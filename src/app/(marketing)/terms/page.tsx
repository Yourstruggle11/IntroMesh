import type { Metadata } from "next";
import { LegalPage } from "../legal";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="October 30, 2026">
      <p>
        IntroMesh is a software service that helps professionals discover warm introduction paths, request introductions from people they
        trust, and track the outcome. By creating an account you agree to these terms.
      </p>
      <h2>Accounts</h2>
      <ul>
        <li>You must provide accurate information and keep your password secure.</li>
        <li>You may only add contacts you have a genuine relationship with and a lawful basis to share with a connector for the purpose of an introduction.</li>
        <li>Do not use IntroMesh for spam, harassment, scraping or reselling contact data.</li>
      </ul>
      <h2>Introductions</h2>
      <ul>
        <li>Introductions are always sent by, and at the discretion of, the person who owns the relationship. IntroMesh never emails a contact without that person&apos;s explicit approval.</li>
        <li>AI-generated drafts are suggestions; the connector is responsible for the final message they send.</li>
      </ul>
      <h2>Subscriptions</h2>
      <ul>
        <li>Paid plans (Pro, Team) are billed monthly by card through our payment partner Dodo Payments, or prepaid for 30 days in USDC.</li>
        <li>Card subscriptions renew automatically until cancelled. Stablecoin terms do not auto-renew.</li>
      </ul>
      <h2>Intro bounties</h2>
      <ul>
        <li>Bounties are optional thank-you payments in USDC from the requester to the connector. They are held by IntroMesh, released when both the requester and the target confirm the meeting, and refunded if the request is declined or expires.</li>
        <li>Blockchain transactions are irreversible. You are responsible for sending the exact amount, on the selected network, from a wallet you control.</li>
      </ul>
      <h2>Liability</h2>
      <p>
        The service is provided &quot;as is&quot;. IntroMesh does not guarantee that any introduction will lead to a meeting or business outcome. To the extent
        permitted by law, our liability is limited to the fees you paid in the 3 months before a claim.
      </p>
      <h2>Contact</h2>
      <p>Questions about these terms can be sent to the contact address listed in the site footer.</p>
    </LegalPage>
  );
}
