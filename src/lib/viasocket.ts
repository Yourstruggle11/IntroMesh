import "server-only";
import { createHmac } from "crypto";

/**
 * viaSocket Embed: lets members build automations (Slack, Sheets, HubSpot, …) on their IntroMesh
 * events without leaving the app. The embed is authorised by a per-user HS256 JWT signed with our
 * embed secret; the secret itself never reaches the browser.
 * Docs: https://viasocket.com/faq/steps-to-integrate-embed
 */
export const VIASOCKET_EMBED_SRC = "https://embed.viasocket.com/prod-embedcomponent.js";

export function viasocketConfigured() {
  return Boolean(process.env.VIASOCKET_ORG_ID && process.env.VIASOCKET_PROJECT_ID && process.env.VIASOCKET_EMBED_SECRET);
}

const b64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

/** Signed embed token for one member (unique user_id per member, as viaSocket requires). */
export function viasocketEmbedToken(user: { id: string; email?: string | null; name?: string | null }) {
  if (!viasocketConfigured()) return null;
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    org_id: process.env.VIASOCKET_ORG_ID,
    project_id: process.env.VIASOCKET_PROJECT_ID,
    user_id: user.id,
    iat: Math.floor(Date.now() / 1000),
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signature = createHmac("sha256", process.env.VIASOCKET_EMBED_SECRET!).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}
