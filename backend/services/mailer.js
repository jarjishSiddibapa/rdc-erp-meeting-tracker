const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function verifyMailer() {
  try {
    await transporter.verify();
    console.log('Mailer ready:', process.env.SMTP_USER);
  } catch (e) {
    console.warn('Mailer not ready (forgot-password emails will fail):', e.message);
  }
}

async function sendPasswordResetEmail({ to, fullName, resetUrl }) {
  const brand = '#00B51A';
  await transporter.sendMail({
    from: `"RDC Digitization Review" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Reset your password — RDC Digitization Review',
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #111827;">
        <div style="background: ${brand}; padding: 20px 24px; border-radius: 8px 8px 0 0;">
          <h2 style="color: #fff; margin: 0; font-size: 18px;">RDC Digitization Review</h2>
        </div>
        <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
          <p>Hi ${fullName || ''},</p>
          <p>We received a request to reset your password. Click the button below to choose a new one. This link expires in 1 hour.</p>
          <p style="text-align: center; margin: 28px 0;">
            <a href="${resetUrl}" style="background: ${brand}; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; display: inline-block;">
              Reset Password
            </a>
          </p>
          <p style="font-size: 13px; color: #6b7280;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
          <p style="font-size: 12px; color: #9ca3af; word-break: break-all;">Or copy this link: ${resetUrl}</p>
        </div>
      </div>
    `,
  });
}

async function sendWelcomeEmail({ to, fullName, tempPassword, resetUrl }) {
  const brand = '#00B51A';
  await transporter.sendMail({
    from: `"RDC Digitization Review" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Your account has been created — RDC Digitization Review',
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #111827;">
        <div style="background: ${brand}; padding: 20px 24px; border-radius: 8px 8px 0 0;">
          <h2 style="color: #fff; margin: 0; font-size: 18px;">RDC Digitization Review</h2>
        </div>
        <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
          <p>Hi ${fullName || ''},</p>
          <p>An account has been created for you. Here are your temporary sign-in details:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Email</td><td style="padding: 6px 0; font-weight: 600;">${to}</td></tr>
            <tr><td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Temporary password</td><td style="padding: 6px 0; font-weight: 600; font-family: monospace;">${tempPassword}</td></tr>
          </table>
          <p>For your security, please set your own password before you continue — click below:</p>
          <p style="text-align: center; margin: 28px 0;">
            <a href="${resetUrl}" style="background: ${brand}; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; display: inline-block;">
              Set Your Password
            </a>
          </p>
          <p style="font-size: 13px; color: #6b7280;">This link expires in 1 hour. If it expires, use "Forgot password" on the login page instead.</p>
          <p style="font-size: 12px; color: #9ca3af; word-break: break-all;">Or copy this link: ${resetUrl}</p>
        </div>
      </div>
    `,
  });
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0, n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(1)} ${units[i]}`;
}

const TRIGGERED_BY_LABEL = { schedule: 'the daily automatic schedule', manual: 'a manual "Run Backup Now"' };

// `to` is the raw comma-separated recipients string from backup_settings.email_recipients —
// nodemailer accepts that directly, no need to split it into an array first.
async function sendBackupEmail({ to, filename, filepath, sizeBytes, triggeredBy }) {
  const brand = '#00B51A';
  await transporter.sendMail({
    from: `"RDC Digitization Review" <${process.env.SMTP_USER}>`,
    to,
    subject: `Database backup — ${filename}`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #111827;">
        <div style="background: ${brand}; padding: 20px 24px; border-radius: 8px 8px 0 0;">
          <h2 style="color: #fff; margin: 0; font-size: 18px;">RDC Digitization Review</h2>
        </div>
        <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
          <p>A fresh database backup was just taken by ${TRIGGERED_BY_LABEL[triggeredBy] || triggeredBy} and is attached to this email as an offsite copy.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 6px 0; color: #6b7280; font-size: 13px;">File</td><td style="padding: 6px 0; font-weight: 600; font-family: monospace;">${filename}</td></tr>
            <tr><td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Size</td><td style="padding: 6px 0; font-weight: 600;">${formatBytes(sizeBytes)}</td></tr>
          </table>
          <p style="font-size: 13px; color: #6b7280;">This is a full MySQL dump — restore with <code>mysql -u root -p &lt; ${filename}</code> on any MySQL server. This address is managed under Backup Settings in the admin panel.</p>
        </div>
      </div>
    `,
    attachments: [{ filename, path: filepath }],
  });
}

// The reminder email is the first one that interpolates arbitrary free-text DB content (SR
// descriptions, contact names) rather than fixed server-generated strings — escape it so a
// description containing "<" or "&" can't break the layout or masquerade as markup.
function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// One email per person, listing everything currently pending with them (except Deloitte,
// filtered out by the caller) so they walk into the next meeting already knowing what's on
// their plate — this is fired manually by an admin, never on a schedule.
async function sendPendingReminderEmail({ to, name, srs }) {
  const brand = '#00B51A';
  const rows = srs.map(sr => `
    <tr>
      <td style="padding: 8px 6px; border-bottom: 1px solid #e5e7eb; font-family: monospace; font-size: 13px;">${escapeHtml(sr.sr_number)}</td>
      <td style="padding: 8px 6px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${escapeHtml(sr.description || '—')}</td>
      <td style="padding: 8px 6px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">${escapeHtml(sr.status)}</td>
    </tr>
  `).join('');

  await transporter.sendMail({
    from: `"RDC Digitization Review" <${process.env.SMTP_USER}>`,
    to,
    subject: `Reminder: ${srs.length} Service Request${srs.length === 1 ? '' : 's'} pending with you`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #111827;">
        <div style="background: ${brand}; padding: 20px 24px; border-radius: 8px 8px 0 0;">
          <h2 style="color: #fff; margin: 0; font-size: 18px;">RDC Digitization Review</h2>
        </div>
        <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
          <p>Hi ${escapeHtml(name)},</p>
          <p>The following Service Request${srs.length === 1 ? ' is' : 's are'} currently pending with you. A quick note ahead of the next meeting so nothing gets missed:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <thead>
              <tr style="text-align: left; font-size: 12px; color: #6b7280;">
                <th style="padding: 0 6px 6px;">SR No.</th>
                <th style="padding: 0 6px 6px;">Description</th>
                <th style="padding: 0 6px 6px;">Status</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
    `,
  });
}

module.exports = { transporter, verifyMailer, sendPasswordResetEmail, sendWelcomeEmail, sendBackupEmail, sendPendingReminderEmail };
