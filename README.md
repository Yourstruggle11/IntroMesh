# IntroMesh

**Your next customer is one trusted connection away.**

IntroMesh finds the warmest path to the person you want to meet, drafts the intro with AI, and pays the connector a USDC bounty when the meeting actually happens. Built at Hacker House Goa 2026 (AI × Crypto).

- **Live:** https://intro-mesh.vercel.app (big-screen board at [`/live`](https://intro-mesh.vercel.app/live))
- **Showcase (PDF):** features, flows, worked examples and sponsor integrations, in [`public/IntroMesh-Showcase.pdf`](public/IntroMesh-Showcase.pdf), also served at https://intro-mesh.vercel.app/IntroMesh-Showcase.pdf

## Core loop

1. **Join**: describe yourself once (typed or dictated with Wispr Flow / the mic button). AI turns it into a profile: role, company, *want to meet*, *can introduce*.
2. **Connect**: scan someone's QR (`/c/CODE`) to create a mutual, consented edge. Add private contacts you can introduce (form or CSV). Others only ever see them masked, as "role at company".
3. **Discover**: search a person, company or goal. TigerGraph (with a Postgres fallback) finds every shortest path up to 3 hops. AI expands the query and explains each path.
4. **Request + bounty**: write why, optionally attach a USDC bounty (Base / Polygon / Arbitrum). The bounty is held once paid.
5. **Approve**: the connector gets an AI-drafted intro in their own voice, edits it, and sends it. Email goes to the target, CC'ing requester + connector.
6. **Confirm & settle**: the requester confirms in-app, the target via a private email link. When both have confirmed, the bounty is paid to the connector's wallet. Declined or expired means an automatic refund.
7. **Live**: `/live` is a big-screen view: totals, a force-directed mesh (bigger nodes = more connections, gold = the last 15 minutes), a join QR, top connectors and an activity feed. Names appear only for members who left "Show me on the live leaderboard" on.

## Stack

| Layer | Tech |
| --- | --- |
| App | Next.js 16 (App Router, Turbopack), React 19, Tailwind v4, motion |
| Hosting | Vercel, functions pinned to **`dub1` (Dublin)** next to the database, plus a daily cron (see [Background jobs](#background-jobs)) |
| DB | Postgres (Supabase, `eu-west-1`) via Drizzle ORM and postgres.js. Local dev falls back to embedded **PGlite** (`./.pglite`). |
| Auth | Email + password (bcrypt). Session tokens are stored hashed, in httpOnly cookies. |
| Graph | TigerGraph Savanna (REST++ / GSQL), with an in-memory BFS over Postgres as fallback |
| AI | Provider chain: **AI Grants** OpenAI key (`gpt-5-nano`), then **Google Gemini**, then deterministic built-in fallbacks. Schemas are written once and converted per provider. |
| Automations | **viaSocket Embed**: members build flows in-app (signed per-user JWT), and IntroMesh POSTs their events to the flow's webhook (SSRF-guarded) |
| Supply chain | **Socket**: the GitHub App flags risky dependencies on PRs, and `.github/workflows/socket.yml` runs `socket ci` on every push/PR |
| Email | Any SMTP server (e.g. Gmail + app password) through nodemailer. Every email is recorded in an outbox with its delivery status. |
| Crypto | viem: USDC orders with a unique amount, verified by reading on-chain `Transfer` logs. Payouts and refunds come from the server wallet. |
| Billing | Dodo Payments subscriptions (signed Standard Webhooks), or a 30-day plan prepaid in USDC |

## Business model

Revenue comes from subscriptions only. Bounties pass through untouched: the connector receives 100% of the bounty, and IntroMesh pays the network gas for every payout and refund from its own wallet. (The few extra digits that make each payment amount unique, a fraction of a cent, stay in the server wallet.)

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

Demo members from the seed log in with `<firstname>@demo.intromesh.local` / `demo-password`. Leave `DATABASE_URL` empty to develop against the embedded PGlite database; with it set, `npm run dev` talks to that database (production, if you copied the production URL).

`/api/health` reports whether the database answers and which integrations are configured. `/admin` (for emails listed in `ADMIN_EMAILS`) shows status, the email outbox, wallet balances, and the TigerGraph setup, resync and "Run expiry/refund tick" buttons.

| Script | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js dev server (runs migrations first), production build, production server |
| `npm run typecheck` / `lint` | `tsc --noEmit` / ESLint |
| `npm run db:generate` / `db:migrate` | Create a migration from `src/db/schema.ts` / apply migrations (`DATABASE_URL_DIRECT` if set, else the pooler, else PGlite) |
| `npm run db:seed` | Demo members and contacts for local development (refuses remote databases) |
| `npm run wallet:new` | Generate the server wallet into `.env.local` |
| `npm run graph:setup` / `graph:sync` | Create the TigerGraph schema and install `warm_paths` / copy every member, contact and connection into TigerGraph |
| `npm run dodo:setup` | Create the Pro and Team products in Dodo and print their IDs |

## Environment

See `.env.example`. In short:

- **`APP_URL`**: the public URL (`https://intro-mesh.vercel.app`). Used in emails, QR codes and Dodo return URLs.
- **`SUPPORT_EMAIL`**: contact address shown in the footer and policy pages. **`ADMIN_EMAILS`**: comma-separated emails that get `/admin`. **`CRON_SECRET`**: random string that protects `/api/cron/tick`.
- **`DATABASE_URL`**: the Supabase *transaction pooler* URI (port 6543). **`DATABASE_URL_DIRECT`**: the *direct* URI (5432), used for migrations. `PGLITE_DIR` (optional, local only) moves the embedded database.
- **`OPENAI_API_KEY`**: AI Grants key (primary AI). Optional: `OPENAI_MODEL` (default `gpt-5-nano`), `OPENAI_BASE_URL`, `AI_PROVIDER_ORDER` (default `openai,gemini`).
- **`GEMINI_API_KEY`**: from aistudio.google.com (fallback AI). **`GEMINI_MODEL`** (default `gemini-3.5-flash`) does the writing; **`GEMINI_FAST_MODEL`** (default `gemini-3.5-flash-lite`) handles quick structured tasks.
- **`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`**: e.g. `smtp.gmail.com`, `465`, your Gmail address, and a 16-character app password. Without them, emails are recorded in the outbox but not sent.
- **`TG_HOST`, `TG_SECRET`, `TG_USERNAME`, `TG_PASSWORD`, `TG_GRAPH`**: TigerGraph Savanna.
- **`CRYPTO_NETWORK`**: `testnet` (default: Base Sepolia / Polygon Amoy / Arbitrum Sepolia with free faucet USDC, no real money) or `mainnet` (real USDC; this is where Cake Wallet works). Every order and bounty records its network, and payouts and refunds only run while the app is on that same network.
- **`CRYPTO_CHAINS`** (default `base,polygon,arbitrum`) and **`CRYPTO_DEFAULT_CHAIN`** (default `base`): which chains are offered. **`RPC_BASE`, `RPC_POLYGON`, `RPC_ARBITRUM`**: optional custom RPC endpoints (public ones with automatic failover are used otherwise).
- **`WALLET_PRIVATE_KEY`**: server wallet (receives payments, pays bounties and refunds). It only needs a little gas on each chain you use. Payouts are funded by the bounties people paid in.
- **`VIASOCKET_ORG_ID`, `VIASOCKET_PROJECT_ID`, `VIASOCKET_EMBED_SECRET`**: viaSocket Embed (see below).
- **`DODO_API_KEY`, `DODO_WEBHOOK_SECRET`, `DODO_ENV`, `DODO_PRODUCT_PRO`, `DODO_PRODUCT_TEAM`**: Dodo Payments (test mode for the event).

## Going live (Vercel + Supabase)

1. **Supabase**: create a project and copy both connection strings into `.env.local`, then run `npm run db:migrate` to create the tables.
2. **Region**: `vercel.json` pins the functions to `dub1` (Dublin), the same AWS region as the Supabase project (`eu-west-1`). If your database lives elsewhere, change `regions` to match: every page runs several queries, and an ocean between app and database multiplies that latency. After a deploy, the `x-vercel-id` response header shows the region (`…::dub1::…`).
3. **Vercel**: import the repo and add every env var from `.env.local` (set `APP_URL` to the Vercel URL). Deploy. Env var changes need a redeploy to take effect.
4. **TigerGraph**: make sure the Savanna workspace is running with **Auto Start** enabled (otherwise API calls can't wake it after auto-suspend, and the app falls back to Postgres). Then open `/admin` and click **Set up TigerGraph**. This creates the schema, installs `warm_paths`, and syncs. Or run `npm run graph:setup` then `npm run graph:sync`.
5. **Dodo**: set `DODO_API_KEY`, run `npm run dodo:setup` (creates the Pro and Team products), and add the product IDs to Vercel. Then in the Dodo dashboard add the webhook `https://<app>/api/webhooks/dodo` and copy its secret into `DODO_WEBHOOK_SECRET`.
6. **Wallet**: send a little gas to the address printed by `npm run wallet:new` (also shown on `/admin`). On testnet that's free Base Sepolia ETH from a faucet (see below); on mainnet, ~$1 of ETH on Base covers 100+ payouts.

## Testing payments without real money

Keep `CRYPTO_NETWORK=testnet` (the pay page shows **"Testnet · no real money"**; if it doesn't, stop) and keep Dodo in test mode.

**USDC bounty, end to end**

1. **Wallet**: install MetaMask and add the **Base Sepolia** network: RPC `https://sepolia.base.org`, chain ID `84532`, symbol `ETH`, explorer `https://sepolia.basescan.org`. Create a second account to receive payouts.
2. **Test funds**: claim Base Sepolia **ETH** (for gas) and **USDC** at the [Coinbase Developer Platform faucet](https://portal.cdp.coinbase.com/products/faucet) (free account), or USDC at [faucet.circle.com](https://faucet.circle.com). Alchemy's faucet only pays wallets that already hold mainnet ETH. In MetaMask, import the USDC token `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (6 decimals).
3. **Server wallet gas**: claim Base Sepolia ETH straight to the server wallet address too. Without it, payouts and refunds can't be sent.
4. **Two accounts**: sign up a requester and a connector (Gmail `you+a@gmail.com` / `you+b@gmail.com` both land in your inbox), in two browser windows. Connect them with the connector's 6-character code (Connect → "Connect with a code"). As the connector, add a private contact with your own email (e.g. `you+c@gmail.com`) and paste the second MetaMask address in Settings → Bounty payouts.
5. **Pay**: as the requester, find the contact in Discover, ask for an intro, add a $1 bounty on Base Sepolia and send the **exact** amount shown (the extra digits identify the payment). The page flips to *Held* within ~30 s; if not, paste the transaction hash into "Already paid?".
6. **Settle**: the connector approves and sends the intro; the target clicks "Yes, we met" in their email and the requester confirms in-app. The connector's wallet receives 1 USDC. To test a refund instead, have the connector **Decline**: the bounty goes back to the paying wallet.

**Card subscription (Dodo test mode)**: Plans & billing → "Subscribe with card", then card `4242 4242 4242 4242`, expiry `06/32`, CVC `123` (Indian test card: `4576 2389 1277 1450`). The plan switches when Dodo's signed webhook arrives, within seconds. `4000 0000 0000 0002` tests a declined payment. Full list: [Dodo test cards](https://docs.dodopayments.com/miscellaneous/testing-process).

**Cake Wallet** has no test networks, so testing it means `CRYPTO_NETWORK=mainnet` and real USDC (use Polygon and native USDC `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359`, not bridged USDC.e). Finish any payout or refund before switching back to testnet.

## Background jobs

Vercel calls **`/api/cron/tick`** once a day (`0 6 * * *`, 06:00 UTC = 11:30 IST, configured in `vercel.json`), sending `Authorization: Bearer $CRON_SECRET`; anything else gets a 401. It:

1. **Expires stale intros**: requests the connector didn't act on within 7 days, intros not confirmed within 14 days of being sent, and bounty requests that were never paid. A held bounty is **refunded** to the wallet that paid it.
2. **Retries failed refunds** (e.g. when the server wallet was out of gas).
3. **Pays out** confirmed meetings whose bounty is still held.
4. **Catches late payments**: re-checks the chain for orders still pending after a minute, in case someone paid after closing the pay page.

Expiry also runs in the background whenever someone opens Home, and on demand from the **Run expiry/refund tick** button in `/admin`. A payout that failed (*payout pending*) is retried when the connector adds a payout address.

## Performance & reliability

- **No pipelining on the pooler.** The Supabase transaction pooler can stall when several queries are pipelined on one connection, so postgres.js runs one query per connection at a time (`max_pipeline: 0`) and never uses prepared statements (`prepare: false`).
- **Query deadlines.** Every query gets 6 s. A stuck one (typically a pooled socket that died while the Vercel instance was frozen) replaces the client; reads are retried once on a fresh connection, writes surface the error. See `src/db/index.ts`.
- **Live numbers are cached.** `/live`, `/api/live` and the landing-page banner share one cached computation (8–15 s), `/api/live` is CDN-cached for 10 s, and the board polls every 15 s only while the tab is visible. Both pages render within a few seconds even if the database is slow.
- **Slow dependencies don't block pages.** TigerGraph queries time out after 4 s and, after a failure, are skipped for 60 s in favour of the Postgres fallback. AI calls have one total time budget shared by the provider chain.

## viaSocket (automations)

Set `VIASOCKET_ORG_ID`, `VIASOCKET_PROJECT_ID` and `VIASOCKET_EMBED_SECRET`. In **Settings → Automations**, each member clicks **Open viaSocket** (the embed loads on demand and always opens as a right-side panel, whatever display type the viaSocket dashboard is set to), creates a flow with a **Webhook** trigger, pastes the URL, and sends a test event. After that, every intro request, sent intro, confirmed meeting, bounty payout and new connection is delivered to their flow as JSON. Make sure **webhooks** are enabled for the embed in the viaSocket dashboard.

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
- Automation webhooks must be public `https` URLs: private, loopback and metadata addresses are rejected, the check is repeated at send time, and redirects are not followed.
- Plan limits are enforced by the app; data written straight into the database bypasses them, so seed production through the app or the scripts above.
