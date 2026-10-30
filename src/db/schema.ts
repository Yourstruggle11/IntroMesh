import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

/* ───────────────────────── Users & auth ───────────────────────── */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    headline: text("headline"),
    role: text("role"),
    company: text("company"),
    about: text("about"),
    lookingFor: jsonb("looking_for").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    canIntroduce: jsonb("can_introduce").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    tags: jsonb("tags").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    linkedinUrl: text("linkedin_url"),
    payoutAddress: text("payout_address"),
    connectCode: text("connect_code").notNull(),
    plan: text("plan").notNull().default("free"),
    planPaidThrough: timestamp("plan_paid_through", { withTimezone: true }),
    planSource: text("plan_source"),
    onboarded: boolean("onboarded").notNull().default(false),
    showOnLeaderboard: boolean("show_on_leaderboard").notNull().default(true),
    /** viaSocket (or other automation) webhook that receives this member's IntroMesh events. */
    automationWebhookUrl: text("automation_webhook_url"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email), uniqueIndex("users_connect_code_uq").on(t.connectCode)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(), // sha256(token)
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/* ───────────────────────── Relationship graph ───────────────────────── */

/** Mutual connection between two members (stored once, userA < userB). */
export const connections = pgTable(
  "connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userA: uuid("user_a")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userB: uuid("user_b")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    source: text("source").notNull().default("qr"), // qr | code
    strength: integer("strength").notNull().default(3), // 1..5
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("connections_pair_uq").on(t.userA, t.userB), index("connections_b_idx").on(t.userB)],
);

/** Private people a member can introduce. Never exposed directly to others. */
export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    company: text("company"),
    role: text("role"),
    notes: text("notes"),
    tags: jsonb("tags").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    strength: integer("strength").notNull().default(3), // 1..5 how well you know them
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("contacts_owner_email_uq").on(t.ownerId, t.email), index("contacts_owner_idx").on(t.ownerId)],
);

/* ───────────────────────── Introductions ───────────────────────── */

export type PathNode = { id: string; kind: "user" | "contact"; name: string; company?: string | null; role?: string | null; masked?: boolean };

export const introRequests = pgTable(
  "intro_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requesterId: uuid("requester_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    connectorId: uuid("connector_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: text("target_type").notNull(), // user | contact
    targetUserId: uuid("target_user_id").references(() => users.id, { onDelete: "cascade" }),
    targetContactId: uuid("target_contact_id").references(() => contacts.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    path: jsonb("path").$type<PathNode[]>().notNull().default(sql`'[]'::jsonb`),
    /** awaiting_payment | pending | accepted | introduced | met | declined | expired | cancelled */
    status: text("status").notNull().default("pending"),
    draftSubject: text("draft_subject"),
    draftBody: text("draft_body"),
    declineNote: text("decline_note"),
    /** Bounty in USDC base units (6 decimals). */
    bountyUnits: bigint("bounty_units", { mode: "bigint" }),
    bountyChain: text("bounty_chain"),
    /** testnet | mainnet — payouts never cross networks. */
    bountyNetwork: text("bounty_network"),
    /** none | awaiting_payment | held | payout_pending | paid | refund_pending | refunded | failed */
    bountyStatus: text("bounty_status").notNull().default("none"),
    bountyError: text("bounty_error"),
    payerAddress: text("payer_address"),
    payoutTxHash: text("payout_tx_hash"),
    refundTxHash: text("refund_tx_hash"),
    requesterConfirmedAt: timestamp("requester_confirmed_at", { withTimezone: true }),
    targetConfirmedAt: timestamp("target_confirmed_at", { withTimezone: true }),
    targetConfirmToken: text("target_confirm_token").notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    introducedAt: timestamp("introduced_at", { withTimezone: true }),
    metAt: timestamp("met_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("intro_requester_idx").on(t.requesterId),
    index("intro_connector_idx").on(t.connectorId),
    index("intro_status_idx").on(t.status),
    uniqueIndex("intro_confirm_token_uq").on(t.targetConfirmToken),
  ],
);

/* ───────────────────────── Payments ───────────────────────── */

export const paymentOrders = pgTable(
  "payment_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: text("purpose").notNull(), // plan | bounty
    plan: text("plan"),
    introRequestId: uuid("intro_request_id").references(() => introRequests.id, { onDelete: "set null" }),
    chain: text("chain").notNull(),
    /** testnet | mainnet */
    network: text("network").notNull().default("testnet"),
    token: text("token").notNull().default("USDC"),
    amountUnits: bigint("amount_units", { mode: "bigint" }).notNull(),
    usdCents: integer("usd_cents").notNull(),
    treasury: text("treasury").notNull(),
    startBlock: bigint("start_block", { mode: "bigint" }).notNull(),
    status: text("status").notNull().default("pending"), // pending | paid | expired | cancelled
    txHash: text("tx_hash"),
    payerAddress: text("payer_address"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("payment_orders_tx_uq").on(t.chain, t.txHash), index("payment_orders_user_idx").on(t.userId), index("payment_orders_status_idx").on(t.status)],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // dodo | crypto
    plan: text("plan").notNull(),
    status: text("status").notNull(), // pending | active | on_hold | cancelled | expired
    externalId: text("external_id").notNull(),
    paidThrough: timestamp("paid_through", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("subscriptions_ext_uq").on(t.provider, t.externalId), index("subscriptions_user_idx").on(t.userId)],
);

export const webhookEvents = pgTable("webhook_events", {
  id: text("id").primaryKey(), // provider:webhook-id
  provider: text("provider").notNull(),
  type: text("type").notNull(),
  payload: jsonb("payload").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  error: text("error"),
  createdAt: createdAt(),
});

/* ───────────────────────── Messaging & activity ───────────────────────── */

export const emails = pgTable(
  "emails",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(), // intro | intro_request | intro_accepted | bounty_paid | ...
    relatedId: uuid("related_id"),
    to: text("to_addr").notNull(),
    cc: jsonb("cc").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    replyTo: text("reply_to"),
    subject: text("subject").notNull(),
    html: text("html").notNull(),
    text: text("text").notNull(),
    status: text("status").notNull().default("queued"), // queued | sent | failed | logged
    error: text("error"),
    providerMessageId: text("provider_message_id"),
    attempts: integer("attempts").notNull().default(0),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("emails_related_idx").on(t.relatedId)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

/** Append-only event log used for timelines, analytics and the live leaderboard. */
export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(),
    actorId: uuid("actor_id"),
    subjectId: uuid("subject_id"),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
  },
  (t) => [index("events_type_idx").on(t.type, t.createdAt), index("events_subject_idx").on(t.subjectId)],
);

export const aiCache = pgTable("ai_cache", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  createdAt: createdAt(),
});

export type User = typeof users.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type IntroRequest = typeof introRequests.$inferSelect;
export type PaymentOrder = typeof paymentOrders.$inferSelect;
