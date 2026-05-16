/**
 * Sends transactional emails via Brevo (free: 300/day, no credit card).
 * Set BREVO_API_KEY and BREVO_FROM_EMAIL in your environment.
 */

type SendEmailOptions = {
  to:      string
  subject: string
  body:    string   // plain text — auto-wrapped in clean HTML
  fromName?: string
}

export async function sendEmail({ to, subject, body, fromName = 'Sameer' }: SendEmailOptions) {
  const apiKey   = process.env.BREVO_API_KEY
  const fromEmail = process.env.BREVO_FROM_EMAIL

  if (!apiKey || !fromEmail) {
    console.warn('[email-sender] BREVO_API_KEY or BREVO_FROM_EMAIL not set — skipping email send')
    return { skipped: true }
  }

  // Wrap plain text in a clean, minimal HTML email
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .wrap { max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; }
    .body { padding: 40px 36px; color: #1a1a1a; font-size: 15px; line-height: 1.7; }
    .footer { padding: 20px 36px; background: #f9f9f9; color: #999; font-size: 12px; text-align: center; }
    p { margin: 0 0 16px; }
    a { color: #22c55e; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="body">
      ${body.split('\n').filter(l => l.trim()).map(l => `<p>${l}</p>`).join('\n      ')}
    </div>
    <div class="footer">You're receiving this because you asked for it on Instagram.</div>
  </div>
</body>
</html>`

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key':     apiKey,
      'Content-Type':'application/json',
    },
    body: JSON.stringify({
      sender:      { name: fromName, email: fromEmail },
      to:          [{ email: to }],
      subject,
      htmlContent: html,
      textContent: body,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Brevo error ${res.status}: ${err}`)
  }

  return { sent: true, to }
}
