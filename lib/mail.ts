import "server-only";

import { Resend } from "resend";

import { appUrl, env, mailEnabled } from "./env";
import { CATEGORY_LABELS, STATUS_LABELS, type ComplaintCategory, type ComplaintStatus } from "./domain";

type Mail = { to: string; subject: string; html: string; text: string };

let client: Resend | null = null;
function resend(): Resend {
  if (!client) client = new Resend(env.resendApiKey);
  return client;
}

/**
 * Sends one email, or logs it when no provider is configured.
 *
 * Never throws. Notifications are a side effect of a status change, not part
 * of it - a mail outage must not roll back a complaint update or return a 500
 * to the admin who made it.
 */
async function send(mail: Mail): Promise<{ delivered: boolean; reason?: string }> {
  if (!mailEnabled()) {
    console.info(
      `[mail:console] to=${mail.to} subject="${mail.subject}"\n${mail.text}\n` +
        "  (set RESEND_API_KEY to deliver this for real)",
    );
    return { delivered: false, reason: "no-provider" };
  }

  try {
    const { error } = await resend().emails.send({
      from: env.mailFrom,
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });
    if (error) {
      console.error(`[mail] provider rejected message to ${mail.to}:`, error.message);
      return { delivered: false, reason: error.message };
    }
    return { delivered: true };
  } catch (error) {
    console.error(`[mail] failed to send to ${mail.to}:`, error);
    return { delivered: false, reason: (error as Error).message };
  }
}

/** Sends to many recipients one at a time; a single failure never aborts the rest. */
async function sendAll(mails: Mail[]) {
  const results = await Promise.allSettled(mails.map(send));
  const delivered = results.filter(
    (r) => r.status === "fulfilled" && r.value.delivered,
  ).length;
  return { attempted: mails.length, delivered };
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function layout(heading: string, bodyHtml: string, ctaHref: string, ctaLabel: string) {
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2430">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e3e6ea">
      <tr><td style="padding:24px 28px 8px">
        <p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280">Society Maintenance Tracker</p>
        <h1 style="margin:0;font-size:20px;line-height:1.3">${escapeHtml(heading)}</h1>
      </td></tr>
      <tr><td style="padding:8px 28px 20px;font-size:14px;line-height:1.6;color:#374151">${bodyHtml}</td></tr>
      <tr><td style="padding:0 28px 28px">
        <a href="${ctaHref}" style="display:inline-block;background:#1f2430;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600">${escapeHtml(ctaLabel)}</a>
      </td></tr>
    </table>
    <p style="max-width:560px;margin:14px auto 0;font-size:12px;color:#9aa1ab">You are receiving this because you are registered with your society's maintenance tracker.</p>
  </td></tr></table>
</body></html>`;
}

const row = (label: string, value: string) =>
  `<tr><td style="padding:3px 12px 3px 0;color:#6b7280;white-space:nowrap">${escapeHtml(label)}</td><td style="padding:3px 0;font-weight:600">${escapeHtml(value)}</td></tr>`;

/** Notifies a resident that the status of their complaint changed. */
export function sendStatusChangeEmail(input: {
  to: string;
  residentName: string;
  complaintId: string;
  title: string;
  category: ComplaintCategory;
  fromStatus: ComplaintStatus;
  toStatus: ComplaintStatus;
  note: string | null;
  actorName: string;
}) {
  const link = `${appUrl()}/complaints/${input.complaintId}`;
  const from = STATUS_LABELS[input.fromStatus];
  const to = STATUS_LABELS[input.toStatus];

  const details = `<table role="presentation" style="font-size:14px;margin:12px 0 4px">
    ${row("Complaint", input.title)}
    ${row("Category", CATEGORY_LABELS[input.category])}
    ${row("Status", `${from} → ${to}`)}
    ${row("Updated by", input.actorName)}
  </table>`;

  const noteHtml = input.note
    ? `<p style="margin:14px 0 0;padding:12px 14px;background:#f4f5f7;border-radius:8px;border-left:3px solid #1f2430"><strong>Note:</strong> ${escapeHtml(input.note)}</p>`
    : "";

  const closing =
    input.toStatus === "RESOLVED"
      ? `<p style="margin:14px 0 0">This complaint is now closed. If the problem comes back, please raise a new complaint.</p>`
      : "";

  const text = [
    `Hi ${input.residentName},`,
    "",
    `Your complaint "${input.title}" moved from ${from} to ${to}.`,
    input.note ? `Note: ${input.note}` : "",
    `Updated by: ${input.actorName}`,
    "",
    `View it here: ${link}`,
  ]
    .filter(Boolean)
    .join("\n");

  return send({
    to: input.to,
    subject: `[${to}] ${input.title}`,
    html: layout(
      `Your complaint is now ${to.toLowerCase()}`,
      `<p style="margin:0">Hi ${escapeHtml(input.residentName)}, there is an update on your complaint.</p>${details}${noteHtml}${closing}`,
      link,
      "View complaint",
    ),
    text,
  });
}

/** Notifies every resident that an important notice was posted. */
export function sendImportantNoticeEmails(input: {
  recipients: { email: string; name: string }[];
  title: string;
  body: string;
  authorName: string;
}) {
  const link = `${appUrl()}/notices`;
  const bodyHtml = escapeHtml(input.body).replace(/\n/g, "<br />");

  return sendAll(
    input.recipients.map((recipient) => ({
      to: recipient.email,
      subject: `Important notice: ${input.title}`,
      html: layout(
        input.title,
        `<p style="margin:0 0 12px;color:#6b7280">Posted by ${escapeHtml(input.authorName)}</p><p style="margin:0">${bodyHtml}</p>`,
        link,
        "Open notice board",
      ),
      text: [
        `Important notice: ${input.title}`,
        "",
        input.body,
        "",
        `Posted by ${input.authorName}`,
        `Notice board: ${link}`,
      ].join("\n"),
    })),
  );
}
