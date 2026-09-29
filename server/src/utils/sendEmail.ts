// ===== NEW: Forgot Password =====
import nodemailer, { Transporter } from 'nodemailer';
import { env, isSmtpConfigured } from '../config/env.js';

const BRAND = '#1F453E';
const PAPER = '#FAF9F5';

export interface SendEmailOptions {
  to: string;
  subject: string;
  /** Tieu de lon trong than email. */
  title: string;
  /** Cac doan van ban thuan (se duoc escape HTML). */
  paragraphs: string[];
  /** Nut hanh dong chinh, vd. link dat lai mat khau. */
  action?: { label: string; url: string };
  /** Dong chu nho cuoi email. */
  note?: string;
}

let transporter: Transporter | null = null;

/** Tao transporter 1 lan, tai su dung cho cac lan gui sau. */
function getTransporter(): Transporter {
  if (!isSmtpConfigured()) {
    throw new Error('SMTP chua duoc cau hinh (SMTP_HOST / SMTP_USER / SMTP_PASS)');
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465, // 465 = SSL, 587 = STARTTLS
      auth: { user: env.smtp.user, pass: env.smtp.pass },
    });
  }
  return transporter;
}

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Template HTML don gian, dung inline style vi nhieu email client bo qua <style>. */
function renderTemplate({ title, paragraphs, action, note }: SendEmailOptions): string {
  const body = paragraphs
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">${escapeHtml(p)}</p>`)
    .join('');

  const button = action
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px auto;">
        <tr><td style="border-radius:999px;background:${BRAND};">
          <a href="${escapeHtml(action.url)}" target="_blank"
             style="display:inline-block;padding:14px 32px;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#ffffff;text-decoration:none;border-radius:999px;">
            ${escapeHtml(action.label)}
          </a>
        </td></tr>
      </table>
      <p style="margin:0 0 16px;font-size:12px;line-height:1.6;color:#6B7280;">
        Nếu nút không hoạt động, hãy sao chép đường dẫn sau vào trình duyệt:<br />
        <a href="${escapeHtml(action.url)}" style="color:${BRAND};word-break:break-all;">${escapeHtml(action.url)}</a>
      </p>`
    : '';

  const footnote = note
    ? `<p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#6B7280;">${escapeHtml(note)}</p>`
    : '';

  return `<!doctype html>
<html lang="vi">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:${PAPER};font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${PAPER};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;">
        <tr><td style="background:${BRAND};padding:20px 32px;text-align:center;">
          <span style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#E2ECC8;font-style:italic;">Outfit</span>
          <span style="font-family:Georgia,'Times New Roman',serif;font-size:16px;letter-spacing:4px;color:#ffffff;">CRAFT</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:500;color:${BRAND};">${escapeHtml(title)}</h1>
          ${body}
          ${button}
          ${footnote}
        </td></tr>
        <tr><td style="background:${PAPER};padding:16px 32px;text-align:center;font-size:11px;color:#9CA3AF;">
          © ${new Date().getFullYear()} OutfitCraft · Email tự động, vui lòng không trả lời.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Ban text thuan cho email client khong ho tro HTML. */
function renderText({ title, paragraphs, action, note }: SendEmailOptions): string {
  return [title, '', ...paragraphs, action ? `\n${action.label}: ${action.url}` : '', note ?? '']
    .filter((line, i, arr) => line !== '' || arr[i - 1] !== '')
    .join('\n');
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  await getTransporter().sendMail({
    from: env.smtp.from || `OutfitCraft <${env.smtp.user}>`,
    to: options.to,
    subject: options.subject,
    html: renderTemplate(options),
    text: renderText(options),
  });
}
// ===== END NEW =====
