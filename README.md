# IntroMesh

**Your next customer is one trusted connection away.**

IntroMesh finds the warmest path to the person you want to meet, drafts the intro with AI, and pays the connector a USDC bounty when the meeting actually happens. Built at Hacker House Goa 2026 (AI × Crypto).

## Core loop

1. **Join**: describe yourself once (typed or dictated with Wispr Flow / the mic button). AI turns it into a profile: role, company, *want to meet*, *can introduce*.
2. **Connect**: scan someone's QR (`/c/CODE`) to create a mutual, consented edge. Add private contacts you can introduce (form or CSV). Others only ever see them masked, as "role at company".
3. **Discover**: search a person, company or goal. TigerGraph (with a Postgres fallback) finds every shortest path up to 3 hops. AI expands the query and explains each path.
4. **Request + bounty**: write why, optionally attach a USDC bounty (Base / Polygon / Arbitrum). The bounty is held once paid.
5. **Approve**: the connector gets an AI-drafted intro, edits it, and sends it. Email goes to the target, CC'ing requester + connector.
6. **Confirm & settle**: the requester confirms in-app, the target via a private email link. When both have confirmed, the bounty is paid to the connector's wallet. Declined or expired means an automatic refund.
7. **Live**: `/live` is a big-screen view with a force-directed mesh, totals, top connectors and an activity feed.

## Stack

| Layer | Tech |
| --- | --- |
| App | Next.js 16 (App Router, Turbopack), React 19, Tailwind v4, motion |
| DB | Postgres (Supabase) via Drizzle ORM. Local dev falls back to embedded **PGlite** (`./.pglite`). |
| Auth | Email + password (bcrypt). Session tokens are stored hashed, in httpOnly cookies. |
| Graph | TigerGraph Savanna (REST++ / GSQL), with an in-memory BFS over Postgres as fallback |
| AI | Provider chain: **AI Grants** OpenAI key (`gpt-5-nano`), then **Google Gemini**, then deterministic built-in fallbacks. Schemas are written once and converted per provider. |
| Automations | **viaSocket Embed**: members build flows in-app (signed per-user JWT), and IntroMesh POSTs their events to the flow's webhook (SSRF-guarded) |
| Supply chain | **Socket**: the GitHub App flags risky dependencies on PRs, and `.github/workflows/socket.yml` runs `socket ci` on every push/PR |
| Email | Any SMTP server (e.g. Gmail + app password) through nodemailer. Every email is recorded in an outbox with its delivery status. |
| Crypto | viem: USDC orders with a unique amount, verified by reading on-chain `Transfer` logs. Payouts and refunds come from the server wallet. |
| Billing | Dodo Payments subscriptions (signed Standard Webhooks), or a 30-day plan prepaid in USDC |

## Business model

Revenue comes from subscriptions only. Bounties pass through untouched: the connector receives 100% of the USDC, and IntroMesh pays the network gas for every payout and refund from its own wallet.

| Plan | Price | Intro requests / month | Private contacts | Max bounty per intro |
| --- | --- | --- | --- | --- |
| Free | $0 | 5 | 50 | $5 |
| Pro | $9 / month | 50 | 500 | $50 |
| Team | $29 / month | Unlimited | 2,000 | $200 |

Pro and Team are billed monthly by card (Dodo Payments) or prepaid for 30 days in USDC. Limits are defined in `src/lib/plans.ts`.

## Local development

```bash
npm install
cp .env.example .env.local     # fill in what you have; everything is optional locally
npm run wallet:new             # generates the server wallet into .env.local (prints the address only)
npm run db:seed                # optional: demo members for local testing (refuses remote DBs)
npm run dev                    # runs migrations first, then http://localhost:3000
```

Demo members from the seed log in with `<firstname>@demo.intromesh.local` / `demo-password`.

`/api/health` reports which integrations are configured. `/admin` (for emails listed in `ADMIN_EMAILS`) shows status, the email outbox, wallet balances, and the TigerGraph setup and resync buttons.

## Environment

See `.env.example`. In short:

- **`DATABASE_URL`**: the Supabase *transaction pooler* URI (port 6543). **`DATABASE_URL_DIRECT`**: the *direct* URI (5432), used for migrations.
- **`OPENAI_API_KEY`**: AI Grants key (primary AI). Optional: `OPENAI_MODEL` (default `gpt-5-nano`), `OPENAI_BASE_URL`, `AI_PROVIDER_ORDER` (default `openai,gemini`).
- **`GEMINI_API_KEY`**: from aistudio.google.com (fallback AI). **`GEMINI_MODEL`** (default `gemini-3.5-flash`) does the writing; **`GEMINI_FAST_MODEL`** (default `gemini-3.5-flash-lite`) handles quick structured tasks.
- **`SMTP_*` / `EMAIL_FROM`**: e.g. `smtp.gmail.com`, `465`, your Gmail address, and a 16-character app password.
- **`TG_HOST`, `TG_SECRET`, `TG_USERNAME`, `TG_PASSWORD`, `TG_GRAPH`**: TigerGraph Savanna.
- **`CRYPTO_NETWORK`**: `testnet` (default: Base Sepolia / Polygon Amoy / Arbitrum Sepolia with free faucet USDC, no real money) or `mainnet` (real USDC, works with Cake Wallet). Every order and bounty records its network, and payouts never cross networks.
- **`WALLET_PRIVATE_KEY`**: server wallet (receives payments, pays bounties). It only needs a little gas (ETH on Base). Payouts are funded by the bounties people paid in.
- **`DODO_API_KEY`, `DODO_WEBHOOK_SECRET`, `DODO_PRODUCT_PRO`, `DODO_PRODUCT_TEAM`**: Dodo test mode.
- **`APP_URL`**: the public URL (e.g. `https://intromesh.vercel.app`).
- **`CRON_SECRET`**: random string. **`ADMIN_EMAILS`**: comma-separated.

## Going live (Vercel + Supabase)

1. **Supabase**: create a project and copy both connection strings into `.env.local`, then run `npm run db:migrate` to create the tables.
2. **Vercel**: import the repo and add every env var from `.env.local` (set `APP_URL` to the Vercel URL). Deploy.
3. **TigerGraph**: make sure the Savanna workspace is running with **Auto Start** enabled (otherwise API calls can't wake it after auto-suspend, and the app falls back to Postgres). Then open `/admin` and click **Set up TigerGraph**. This creates the schema, installs `warm_paths`, and syncs. Or run `npm run graph:setup` then `npm run graph:sync`.
4. **Dodo**: set `DODO_API_KEY`, run `npm run dodo:setup` (creates the Pro and Team products), and add the product IDs to Vercel. Then in the Dodo dashboard add the webhook `https://<app>/api/webhooks/dodo` and copy its secret into `DODO_WEBHOOK_SECRET`.
5. **Wallet**: send a little gas to the address printed by `npm run wallet:new`. On testnet that's free Base Sepolia ETH from a faucet; on mainnet, ~$1 of ETH on Base covers 100+ payouts.

## viaSocket (automations)

Set `VIASOCKET_ORG_ID`, `VIASOCKET_PROJECT_ID` and `VIASOCKET_EMBED_SECRET`. In **Settings → Automations**, each member opens the viaSocket builder in-app, creates a flow with a **Webhook** trigger, pastes the URL, and sends a test event. After that, every intro request, sent intro, confirmed meeting, bounty payout and new connection is delivered to their flow as JSON. In the viaSocket dashboard, set the embed display type to **side slider** or **pop-up** and enable **webhooks** in the embed.

## Socket (supply-chain security)

1. Sign in at socket.dev with GitHub and install the **Socket GitHub App** on this repo. It comments on PRs that add risky dependencies.
2. In Socket, create an API token with `full-scans:create`, `full-scans:list` and `security-policy:read`.
3. Add it as a GitHub Actions secret named **`SOCKET_CLI_API_TOKEN`**. The `Socket supply-chain scan` workflow then runs `socket ci` on every push and PR, failing on "error"-level policy alerts. Without the secret it skips with a warning.

## Security notes

- Entitlements change **only** on a verified Dodo webhook signature or an on-chain transfer we verified ourselves. Checkout redirects are never trusted.
- Every state change is a conditional update (e.g. `pending → accepted`), so concurrent clicks can't double-send intros or double-pay bounties.
- Private contacts are never sent to the client unmasked, except to their owner, and to the requester once they are CC'd on the intro.
- AI prompts treat user text as untrusted data. Contact email addresses are never sent to the AI.
- The meeting-confirmation link goes privately to the target only, and confirming requires a POST (email link scanners can't trigger it).
