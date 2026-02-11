const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineString } = require("firebase-functions/params");
const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");

admin.initializeApp();

// Define the SendGrid API key as a Cloud Functions parameter
const sendgridApiKey = defineString("SENDGRID_API_KEY");

/**
 * Triggered when a new document is created in the Waitlist collection.
 * Sends a branded welcome email via SendGrid.
 */
exports.onWaitlistSignup = onDocumentCreated("Waitlist/{docId}", async (event) => {
  const snapshot = event.data;

  if (!snapshot) {
    console.error("No data in event");
    return;
  }

  const data = snapshot.data();
  const { name, email, telegram } = data;

  if (!email) {
    console.error("No email found in waitlist doc:", event.params.docId);
    return;
  }

  const firstName = name || "there";

  console.log(`📧 Sending waitlist welcome email to: ${email} (${firstName})`);

  // Initialize SendGrid
  sgMail.setApiKey(sendgridApiKey.value());

  const htmlContent = buildWelcomeEmail(firstName);

  const msg = {
    to: email,
    from: {
      email: "leo@arcanearchives.shop",
      name: "Leo Gray | The Arcane Archives",
    },
    subject: `You're in, ${firstName}. Here's what's coming.`,
    html: htmlContent,
    text: buildPlainTextEmail(firstName),
  };

  try {
    await sgMail.send(msg);
    console.log(`✅ Welcome email sent to ${email}`);

    // Mark the doc as email sent
    await snapshot.ref.update({
      emailSent: true,
      emailSentAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error("❌ SendGrid error:", error.message);
    if (error.response) {
      console.error("SendGrid response body:", error.response.body);
    }

    // Mark the failure
    await snapshot.ref.update({
      emailSent: false,
      emailError: error.message,
    });
  }
});

/**
 * Build the HTML welcome email
 */
function buildWelcomeEmail(firstName) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to The Arcane Archives</title>
</head>
<body style="margin: 0; padding: 0; background-color: #030303; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #ffffff;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #030303;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px;">

          <!-- LOGO -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              <span style="font-size: 28px; font-weight: 900; letter-spacing: -0.03em; color: #ffffff;">THE ARCANE ARCHIVES</span>
            </td>
          </tr>

          <!-- MAIN CARD -->
          <tr>
            <td style="background: #0f0f0f; border: 1px solid rgba(255,255,255,0.06); border-radius: 20px; padding: 40px 32px;">

              <!-- BADGE -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom: 24px;">
                    <span style="display: inline-block; padding: 6px 16px; background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.3); border-radius: 999px; font-size: 12px; font-weight: 600; color: #22c55e; text-transform: uppercase; letter-spacing: 0.08em;">You're on the list</span>
                  </td>
                </tr>
              </table>

              <!-- HEADING -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom: 16px;">
                    <h1 style="margin: 0; font-size: 28px; font-weight: 800; line-height: 1.2; letter-spacing: -0.03em; color: #ffffff;">${firstName}, you made the right call.</h1>
                  </td>
                </tr>
              </table>

              <!-- BODY TEXT -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="padding-bottom: 24px; font-size: 15px; line-height: 1.7; color: #a1a1aa;">
                    You've just joined <strong style="color: #ffffff;">500+ people</strong> waiting for access to The Arcane Archives &mdash; the most comprehensive knowledge vault ever built.
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom: 24px; font-size: 15px; line-height: 1.7; color: #a1a1aa;">
                    While you wait, here's what you're getting access to when doors open:
                  </td>
                </tr>
              </table>

              <!-- STATS ROW -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 24px;">
                <tr>
                  <td align="center" style="padding: 20px; background: rgba(139,92,246,0.06); border: 1px solid rgba(139,92,246,0.15); border-radius: 14px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td align="center" style="padding: 0 20px;">
                          <div style="font-family: 'Courier New', monospace; font-size: 24px; font-weight: 700; color: #a78bfa;">3,330+</div>
                          <div style="font-size: 11px; color: #71717a; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.05em;">Modules</div>
                        </td>
                        <td align="center" style="padding: 0 20px;">
                          <div style="font-family: 'Courier New', monospace; font-size: 24px; font-weight: 700; color: #a78bfa;">45+</div>
                          <div style="font-size: 11px; color: #71717a; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.05em;">Courses</div>
                        </td>
                        <td align="center" style="padding: 0 20px;">
                          <div style="font-family: 'Courier New', monospace; font-size: 24px; font-weight: 700; color: #fbbf24;">&pound;80K+</div>
                          <div style="font-size: 11px; color: #71717a; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.05em;">Invested</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- WHAT'S COVERED -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 24px;">
                <tr>
                  <td style="font-size: 15px; line-height: 2; color: #a1a1aa;">
                    <span style="color: #a78bfa;">&#9670;</span>&nbsp; Trading Mastery (Gold, Forex, Stocks)<br>
                    <span style="color: #a78bfa;">&#9670;</span>&nbsp; Business &amp; Entrepreneurship Systems<br>
                    <span style="color: #a78bfa;">&#9670;</span>&nbsp; Psychology, Mindset &amp; Dark Psychology<br>
                    <span style="color: #a78bfa;">&#9670;</span>&nbsp; Dating, Attraction &amp; Social Dynamics<br>
                    <span style="color: #a78bfa;">&#9670;</span>&nbsp; Health Optimization &amp; Biohacking<br>
                    <span style="color: #a78bfa;">&#9670;</span>&nbsp; Weekly Live Calls with Leo Gray<br>
                    <span style="color: #a78bfa;">&#9670;</span>&nbsp; Lifetime Access to All Future Content
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="padding-bottom: 8px; font-size: 15px; line-height: 1.7; color: #a1a1aa;">
                    <strong style="color: #ffffff;">What to do now:</strong> Follow me on TikTok for launch updates, behind-the-scenes content, and early access announcements.
                  </td>
                </tr>
              </table>

              <!-- BUTTON -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 16px;">
                <tr>
                  <td align="center">
                    <a href="https://www.tiktok.com/@leogray2028" target="_blank" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: #ffffff; text-decoration: none; border-radius: 12px; font-size: 15px; font-weight: 700;">Follow @leogray2028 on TikTok</a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- DIVIDER -->
          <tr>
            <td style="padding: 32px 0;">
              <div style="height: 1px; background: rgba(255,255,255,0.06);"></div>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td align="center" style="font-size: 12px; color: #71717a; line-height: 1.6;">
              <p style="margin: 0 0 8px;">The Arcane Archives &bull; Built by Leo Gray</p>
              <p style="margin: 0;">
                <a href="https://arcanearchives.shop/Privacy-policy.html" style="color: #71717a; text-decoration: underline;">Privacy Policy</a>
                &nbsp;&bull;&nbsp;
                <a href="https://arcanearchives.shop/waitlist.html" style="color: #71717a; text-decoration: underline;">Waitlist Page</a>
              </p>
              <p style="margin: 8px 0 0; font-size: 11px; color: #52525b;">You're receiving this because you signed up for the waitlist at arcanearchives.shop</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Build the plain text fallback email
 */
function buildPlainTextEmail(firstName) {
  return `THE ARCANE ARCHIVES
====================

${firstName}, you made the right call.

You've just joined 500+ people waiting for access to The Arcane Archives - the most comprehensive knowledge vault ever built.

Here's what you're getting access to when doors open:

- 3,330+ Modules across every domain
- 45+ Complete Courses
- £80K+ of knowledge invested

What's covered:
- Trading Mastery (Gold, Forex, Stocks)
- Business & Entrepreneurship Systems
- Psychology, Mindset & Dark Psychology
- Dating, Attraction & Social Dynamics
- Health Optimization & Biohacking
- Weekly Live Calls with Leo Gray
- Lifetime Access to All Future Content

WHAT TO DO NOW:
Follow @leogray2028 on TikTok for launch updates and early access announcements.
https://www.tiktok.com/@leogray2028

---
The Arcane Archives | Built by Leo Gray
Privacy Policy: https://arcanearchives.shop/Privacy-policy.html

You're receiving this because you signed up for the waitlist at arcanearchives.shop`;
}
