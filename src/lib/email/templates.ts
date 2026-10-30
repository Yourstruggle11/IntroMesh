import { escapeHtml } from "@/lib/utils";

const BRAND = "#0EA5A4";

function paragraphs(text: string) {
  return text
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.6;">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

function button(href: string, label: string) {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;font-weight:600;padding:11px 18px;border-radius:10px;font-size:14px;">${escapeHtml(label)}</a>`;
}

export function layout({ preheader, body, footer }: { preheader: string; body: string; footer?: string }) {
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;background:#f4f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:28px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e6ebf2;">
<tr><td style="height:4px;background:linear-gradient(90deg,#2dd4bf,#22d3ee,#a78bfa);"></td></tr>
<tr><td style="padding:22px 28px 6px;font-size:15px;font-weight:700;letter-spacing:-0.01em;">Intro<span style="color:${BRAND};">Mesh</span></td></tr>
<tr><td style="padding:8px 28px 24px;font-size:15px;color:#1e293b;">${body}</td></tr>
</table>
<p style="max-width:560px;margin:14px auto 0;font-size:12px;color:#64748b;line-height:1.5;">${footer ?? "Sent by IntroMesh — warm introductions through people you trust. Built at Hacker House Goa 2026."}</p>
</td></tr></table></body></html>`;
}

/** The actual introduction, sent to the target with requester + connector in CC. */
export function introEmail(p: { subject: string; body: string; connectorName: string }) {
  return {
    subject: p.subject,
    text: `${p.body}\n\n—\nSent via IntroMesh on behalf of ${p.connectorName}. Reply-all to continue the conversation.`,
    html: layout({
      preheader: p.body.split("\n").find((l) => l.trim().length > 20)?.slice(0, 120) ?? p.subject,
      body: paragraphs(p.body),
      footer: `Sent via IntroMesh on behalf of ${escapeHtml(p.connectorName)}. Reply-all to continue the conversation.`,
    }),
  };
}

/** Private follow-up to the target so only they can confirm the meeting. */
export function targetConfirmEmail(p: { targetName: string; requesterName: string; connectorName: string; confirmUrl: string; bountyLabel?: string | null }) {
  const bounty = p.bountyLabel
    ? `Confirming also releases a <b>${escapeHtml(p.bountyLabel)}</b> thank-you bounty to ${escapeHtml(p.connectorName)} for making the intro.`
    : `It helps ${escapeHtml(p.connectorName)} know the intro was useful.`;
  return {
    subject: `Did you meet ${p.requesterName}?`,
    text: `Hi ${p.targetName},\n\n${p.connectorName} just introduced you to ${p.requesterName}. Once you've spoken, confirm here: ${p.confirmUrl}\n\n${p.bountyLabel ? `Confirming releases a ${p.bountyLabel} thank-you bounty to ${p.connectorName}.` : ""}`,
    html: layout({
      preheader: `One tap once you've met ${p.requesterName}`,
      body: `<p style="margin:0 0 14px;">Hi ${escapeHtml(p.targetName)},</p>
<p style="margin:0 0 14px;line-height:1.6;">${escapeHtml(p.connectorName)} just introduced you to <b>${escapeHtml(p.requesterName)}</b>. Once you've had a chance to talk, let us know with one tap. ${bounty}</p>
<p style="margin:22px 0;">${button(p.confirmUrl, "Yes, we met")}</p>
<p style="margin:0;font-size:13px;color:#64748b;">This link is private to you. If you'd rather not meet, simply ignore this email.</p>`,
    }),
  };
}

export function notifyEmail(p: { to: string; title: string; lines: string[]; cta?: { href: string; label: string } }) {
  return {
    subject: p.title,
    text: `${p.lines.join("\n\n")}${p.cta ? `\n\n${p.cta.label}: ${p.cta.href}` : ""}`,
    html: layout({
      preheader: p.lines[0]?.slice(0, 120) ?? p.title,
      body: `<p style="margin:0 0 14px;font-size:17px;font-weight:700;">${escapeHtml(p.title)}</p>${p.lines
        .map((l) => `<p style="margin:0 0 12px;line-height:1.6;">${escapeHtml(l)}</p>`)
        .join("")}${p.cta ? `<p style="margin:20px 0 4px;">${button(p.cta.href, p.cta.label)}</p>` : ""}`,
    }),
  };
}
