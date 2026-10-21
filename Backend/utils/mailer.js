// utils/mailer.js
// Sends emails. It NEVER throws, so an email problem can never break
// the approve / reject flow.
//
// Provider order:
//   1) Brevo HTTP API  (BREVO_API_KEY)      -> works on Render free plan
//   2) Gmail SMTP      (EMAIL_USER/EMAIL_PASS) -> local testing only
//      (Render free plan blocks SMTP ports 25 / 465 / 587)

const SITE_URL = (process.env.SITE_URL || "https://mncconnect.onrender.com").replace(/\/$/, "");
const FROM_NAME = process.env.EMAIL_FROM_NAME || "MNCConnect";

const escapeHtml = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const firstName = (mentor) => String((mentor && mentor.name) || "Mentor").trim().split(" ")[0] || "Mentor";

// ------------------------------------------------------------
// Providers
// ------------------------------------------------------------

const sendViaBrevo = async ({ to, toName, subject, text, html }) => {
  const fromEmail = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  if (!fromEmail) throw new Error("EMAIL_FROM is not set (use your verified Brevo sender email)");

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: FROM_NAME, email: fromEmail },
      to: [toName ? { email: to, name: toName } : { email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Brevo error ${res.status}`);
  return data.messageId || "ok";
};

let transporter = null;

const sendViaGmail = async ({ to, subject, text, html }) => {
  if (!transporter) {
    let nodemailer;
    try {
      nodemailer = require("nodemailer");
    } catch (_) {
      throw new Error("nodemailer is not installed. Run: npm install nodemailer");
    }
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: String(process.env.EMAIL_PASS || "").replace(/\s/g, ""),
      },
    });
  }

  const info = await transporter.sendMail({
    from: `"${FROM_NAME}" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  });
  return info.messageId;
};

// ------------------------------------------------------------
// Public sender
// ------------------------------------------------------------

const sendMail = async (opts) => {
  if (String(process.env.EMAIL_ENABLED || "true").toLowerCase() === "false") {
    return { success: false, error: "Email is disabled (EMAIL_ENABLED=false)" };
  }
  if (!opts || !opts.to) return { success: false, error: "No recipient email" };

  try {
    let id;
    if (process.env.BREVO_API_KEY) {
      id = await sendViaBrevo(opts);
    } else if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      id = await sendViaGmail(opts);
    } else {
      return { success: false, error: "Email is not configured" };
    }

    console.log("📧 Email sent:", id, "to", opts.to);
    return { success: true, id };
  } catch (err) {
    console.error("❌ Email failed:", err.message);
    return { success: false, error: err.message };
  }
};

// ------------------------------------------------------------
// HTML layout shared by all emails
// ------------------------------------------------------------

const layout = ({ preheader, heading, paragraphsHtml, listTitle, listItems, buttonText, buttonUrl, footerNote }) => `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f4f9;font-family:Arial,Helvetica,sans-serif;color:#1e293b;">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f4f9;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr>
          <td style="background:linear-gradient(135deg,#111827,#1d4ed8 55%,#06b6d4);padding:28px 32px;">
            <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:.5px;">MNC<span style="color:#67e8f9;">CONNECT</span></div>
            <div style="font-size:13px;color:#bfdbfe;margin-top:4px;">Connecting freshers with real industry mentors</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;color:#0f172a;">${heading}</h1>
            ${paragraphsHtml}
            ${listItems && listItems.length ? `
            <div style="margin:22px 0 6px;font-size:15px;font-weight:700;color:#0f172a;">${escapeHtml(listTitle)}</div>
            <ul style="margin:0 0 8px;padding-left:20px;font-size:15px;line-height:1.7;color:#334155;">
              ${listItems.map((i) => `<li style="margin-bottom:6px;">${i}</li>`).join("")}
            </ul>` : ""}
            ${buttonUrl ? `
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 14px;">
              <tr><td style="background:#1d4ed8;border-radius:10px;">
                <a href="${escapeHtml(buttonUrl)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${escapeHtml(buttonText)} &rarr;</a>
              </td></tr>
            </table>
            <p style="margin:0;font-size:13px;color:#64748b;">Button not working? Copy this link into your browser:<br>
              <a href="${escapeHtml(buttonUrl)}" style="color:#1d4ed8;word-break:break-all;">${escapeHtml(buttonUrl)}</a></p>` : ""}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 28px;border-top:1px solid #e2e8f0;background:#f8fafc;">
            <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#64748b;">${footerNote}</p>
            <p style="margin:0;font-size:13px;color:#64748b;">Visit us anytime:
              <a href="${SITE_URL}" style="color:#1d4ed8;">${SITE_URL}</a></p>
            <p style="margin:12px 0 0;font-size:12px;color:#94a3b8;">&copy; ${new Date().getFullYear()} MNCConnect. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

// ------------------------------------------------------------
// Templates
// ------------------------------------------------------------

const approvalEmail = (mentor) => {
  const name = firstName(mentor);
  const loginUrl = `${SITE_URL}/mentor/login`;

  const paragraphs = [
    `Great news! Our admin team has carefully reviewed the profile details and verification documents you submitted, and we are delighted to let you know that your mentor account on MNCConnect has been <b>approved</b>.`,
    `You are now a verified mentor on our platform. Freshers who are just starting their careers are looking for guidance from working professionals like you, and your real-world industry experience can make a genuine difference to them.`,
  ];

  const steps = [
    "Log in to your mentor dashboard using the same email and password you used during registration.",
    "Review your profile and keep your skills, experience and bio up to date, so freshers can understand how you can help them.",
    "Respond to session requests from freshers and start guiding them with your knowledge and experience.",
  ];

  const subject = "🎉 Congratulations! Your MNCConnect mentor profile is approved";

  const text = [
    `Hi ${name},`,
    "",
    "Great news! Our admin team has carefully reviewed the profile details and verification documents you submitted, and your mentor account on MNCConnect has been approved.",
    "",
    "You are now a verified mentor on our platform. Freshers who are just starting their careers are looking for guidance from working professionals like you, and your real-world industry experience can make a genuine difference to them.",
    "",
    "What you can do next:",
    ...steps.map((s, i) => `${i + 1}. ${s}`),
    "",
    `Login here: ${loginUrl}`,
    `Visit our website: ${SITE_URL}`,
    "",
    "If you did not create this account, or if you have any questions, simply reply to this email and our team will be happy to help.",
    "",
    "Thank you for sharing your experience and helping the next generation of professionals.",
    "",
    "Warm regards,",
    "Team MNCConnect",
  ].join("\n");

  const html = layout({
    preheader: "Your mentor account has been verified. Log in and start mentoring today.",
    heading: `Congratulations, ${escapeHtml(name)}! 🎉`,
    paragraphsHtml: paragraphs
      .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#334155;">${p}</p>`)
      .join(""),
    listTitle: "What you can do next",
    listItems: steps,
    buttonText: "Login to MNCConnect",
    buttonUrl: loginUrl,
    footerNote:
      "If you did not create this account, or if you have any questions, simply reply to this email and our team will be happy to help. Thank you for sharing your experience and helping the next generation of professionals.",
  });

  return { subject, text, html };
};

const rejectionEmail = (mentor) => {
  const name = firstName(mentor);
  const reason = mentor.rejectionReason || "The submitted details or documents could not be verified.";

  const subject = "Update on your MNCConnect mentor verification";

  const text = [
    `Hi ${name},`,
    "",
    "Thank you for applying to become a mentor on MNCConnect. After reviewing your profile and documents, we were unable to approve your account at this time.",
    "",
    `Reason: ${reason}`,
    "",
    "If you believe this is a mistake, or you would like to share clearer documents, please reply to this email and our team will look into it.",
    "",
    `Visit our website: ${SITE_URL}`,
    "",
    "Warm regards,",
    "Team MNCConnect",
  ].join("\n");

  const html = layout({
    preheader: "An update on your mentor verification request.",
    heading: `Hi ${escapeHtml(name)}, an update on your application`,
    paragraphsHtml: [
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#334155;">Thank you for applying to become a mentor on MNCConnect. After reviewing your profile and documents, we were unable to approve your account at this time.</p>`,
      `<p style="margin:0 0 14px;padding:14px 16px;border-radius:10px;background:#fef2f2;border:1px solid #fecaca;font-size:14px;line-height:1.6;color:#991b1b;"><b>Reason:</b> ${escapeHtml(reason)}</p>`,
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#334155;">If you believe this is a mistake, or you would like to share clearer documents, please reply to this email and our team will look into it.</p>`,
    ].join(""),
    listItems: [],
    buttonText: "Visit MNCConnect",
    buttonUrl: SITE_URL,
    footerNote: "We appreciate your interest in mentoring freshers and hope to welcome you on MNCConnect soon.",
  });

  return { subject, text, html };
};

const resetPasswordEmail = (mentor, resetUrl, expiryMinutes = 30) => {
  const name = firstName(mentor);

  const subject = "Reset your MNCConnect password";

  const text = [
    `Hi ${name},`,
    "",
    "We received a request to reset your MNCConnect mentor account password.",
    "",
    `Reset your password using this link: ${resetUrl}`,
    "",
    `This link expires in ${expiryMinutes} minutes and can only be used once.`,
    "",
    "If you did not request this change, you can ignore this email.",
    "",
    "Team MNCConnect",
  ].join("\n");

  const html = layout({
    preheader: "Reset your MNCConnect password securely.",
    heading: `Reset your password, ${escapeHtml(name)}`,
    paragraphsHtml: `
      <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#334155;">
        We received a request to reset your MNCConnect mentor account password.
      </p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#334155;">
        Click the button below to choose a new password. This link expires in
        ${expiryMinutes} minutes and can only be used once.
      </p>
    `,
    listItems: [],
    buttonText: "Reset Password",
    buttonUrl: resetUrl,
    footerNote:
      "If you did not request a password reset, ignore this email. Your existing password will remain unchanged.",
  });

  return { subject, text, html };
};

const passwordChangedEmail = (mentor) => {
  const name = firstName(mentor);

  const subject = "Your MNCConnect password was changed";

  const text = [
    `Hi ${name},`,
    "",
    "Your MNCConnect account password has been changed successfully.",
    "",
    "If you did not make this change, please contact the MNCConnect support team immediately.",
    "",
    "Team MNCConnect",
  ].join("\n");

  const html = layout({
    preheader: "Your MNCConnect password has been changed.",
    heading: "Password changed successfully",
    paragraphsHtml: `
      <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#334155;">
        Hi ${escapeHtml(name)}, your MNCConnect account password has been changed successfully.
      </p>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#334155;">
        If you did not make this change, please contact the MNCConnect support team immediately.
      </p>
    `,
    listItems: [],
    buttonText: "Visit MNCConnect",
    buttonUrl: SITE_URL,
    footerNote:
      "This is a security notification. You do not need to reply if you made this change.",
  });

  return { subject, text, html };
};
// ============================================================
// OTP VERIFICATION EMAIL
// ============================================================
const otpVerificationEmail = (name, otp) => {
  const subject = "Verify your MNCConnect account";
  const text = `Hi ${name},\n\nYour OTP for MNCConnect verification is: ${otp}\n\nThis OTP is valid for 10 minutes. Do not share this with anyone.\n\nTeam MNCConnect`;
  
  const html = layout({
    preheader: "Your MNCConnect verification code is inside.",
    heading: `Verify your email, ${escapeHtml(name)}`,
    paragraphsHtml: `
      <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#334155;">
        Thank you for signing up with MNCConnect. Please use the following OTP to verify your email address.
      </p>
      <div style="margin:24px 0;text-align:center;">
        <span style="display:inline-block;padding:12px 32px;font-size:32px;font-weight:800;letter-spacing:8px;color:#1d4ed8;background:#eff6ff;border-radius:12px;border:1px dashed #93c5fd;">
          ${otp}
        </span>
      </div>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#334155;">
        This OTP is valid for <b>10 minutes</b>. If you didn't create this account, ignore this email.
      </p>
    `,
    listItems: [],
    footerNote: "This is an automated message, please do not reply.",
  });

  return { subject, text, html };
};

module.exports = {
  sendMail,
  approvalEmail,
  rejectionEmail,
  resetPasswordEmail,
  passwordChangedEmail,
  otpVerificationEmail, // ✅ Export this
};
