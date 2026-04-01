export async function sendPasswordResetEmail(
  to: string,
  name: string,
  code: string
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "DownTime <onboarding@resend.dev>";

  if (!apiKey) {
    console.log(
      `[EMAIL - DEV FALLBACK] Password reset code for ${name} <${to}>: ${code}  (Set RESEND_API_KEY to send real emails)`
    );
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8f9fb; padding: 40px 20px;">
        <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="display: inline-block; background: #0F3460; border-radius: 14px; padding: 16px 20px; margin-bottom: 16px;">
              <span style="color: #ffffff; font-size: 22px; font-weight: 700;">DownTime</span>
            </div>
            <p style="color: #6B7B8D; font-size: 14px; margin: 0;">Restaurant Issue Tracker · Gandar Management, Inc.</p>
          </div>

          <h2 style="color: #0F3460; font-size: 20px; font-weight: 700; margin: 0 0 8px;">Password Reset Request</h2>
          <p style="color: #3D4F61; font-size: 15px; line-height: 1.6; margin: 0 0 28px;">
            Hi ${name}, we received a request to reset your DownTime password. Use the code below in the app to set a new password.
          </p>

          <div style="background: #F0F4FF; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 28px;">
            <p style="color: #6B7B8D; font-size: 12px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; margin: 0 0 10px;">Your Reset Code</p>
            <p style="color: #0F3460; font-size: 40px; font-weight: 700; letter-spacing: 8px; margin: 0; font-family: monospace;">${code}</p>
            <p style="color: #9BAABB; font-size: 12px; margin: 10px 0 0;">Expires in 30 minutes</p>
          </div>

          <p style="color: #9BAABB; font-size: 13px; line-height: 1.6; margin: 0;">
            If you did not request a password reset, you can safely ignore this email. Your password will not change unless you complete the reset in the app.
          </p>
        </div>
      </body>
    </html>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `DownTime — Your password reset code: ${code}`,
      html,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("[EMAIL] Resend API error:", err);
    throw new Error("Failed to send reset email");
  }
}
