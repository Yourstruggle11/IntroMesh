import type { Metadata } from "next";
import { LegalPage } from "../legal";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="October 30, 2026">
      <p>IntroMesh is built on minimum disclosure: your network is never turned into a public database.</p>
      <h2>What we collect</h2>
      <ul>
        <li>Account data: name, email, password hash, and the profile you write (role, company, interests).</li>
        <li>Connections you create by scanning QR codes, and private contacts you add (name, email, company, role, notes).</li>
        <li>Introduction requests, the messages you approve, and confirmations of meetings.</li>
        <li>Payment records: Dodo subscription identifiers, and for USDC payments the transaction hash and paying wallet address.</li>
      </ul>
      <h2>How private contacts are shown</h2>
      <p>
        Other members never see your contact list. In search results a private contact appears only as a masked name with role and company. A contact&apos;s
        identity and email are revealed only to you, and to the requester and contact themselves when you choose to send an introduction.
      </p>
      <h2>AI processing</h2>
      <p>
        We use Google Gemini to structure profiles, expand searches, explain recommendations and draft introductions. We send only the fields needed for each
        task and never send contact email addresses to the AI provider.
      </p>
      <h2>Sharing</h2>
      <ul>
        <li>Graph relationships are stored in TigerGraph to compute introduction paths.</li>
        <li>Card payments are processed by Dodo Payments. Emails are delivered through our SMTP provider.</li>
        <li>We do not sell or rent personal data.</li>
      </ul>
      <h2>Your choices</h2>
      <ul>
        <li>You can edit or delete your contacts and profile at any time, and opt out of the public leaderboard in Settings.</li>
        <li>To delete your account and data, contact us via the address in the footer.</li>
      </ul>
    </LegalPage>
  );
}
