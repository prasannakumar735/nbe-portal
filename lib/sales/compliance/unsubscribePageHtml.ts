import { escapeHtml } from '@/lib/sales/sending/emailBodyFormat'

export type UnsubscribePageView =
  | { kind: 'confirm'; email?: string | null }
  | { kind: 'done' }
  | { kind: 'cancelled' }
  | { kind: 'invalid' }

const NBE_WEBSITE = 'https://www.nbeaustralia.com.au/'

function shell(inner: string, title = 'Unsubscribe — NBE Australia'): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>${escapeHtml(title)}</title>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; }
body {
  min-height: 100vh;
  background-color: #f3f4f6;
  font-family: Arial, Helvetica, sans-serif;
  color: #111827;
  line-height: 1.6;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
}
.card {
  width: 100%;
  max-width: 480px;
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 4px 24px rgba(0,0,0,0.08);
  overflow: hidden;
}
.logo-bar {
  background: #ffffff;
  padding: 1.25rem 1.75rem 1rem;
  border-bottom: 3px solid #5B21B6;
}
.logo-bar img {
  height: 44px;
  width: auto;
  display: block;
}
.accent-bar {
  background: #5B21B6;
  padding: 0.55rem 1.75rem;
}
.accent-bar p {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: #ede9fe;
  text-transform: uppercase;
}
.body {
  padding: 2rem 1.75rem 1.75rem;
}
.body h1 {
  font-size: 1.35rem;
  font-weight: 700;
  color: #111827;
  margin-bottom: 0.6rem;
}
.body .desc {
  font-size: 0.95rem;
  color: #4b5563;
  margin-bottom: 1.5rem;
  line-height: 1.6;
}
.body .email-highlight {
  color: #111827;
  font-weight: 600;
}
.actions {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}
.btn {
  display: block;
  width: 100%;
  padding: 0.8rem 1rem;
  border-radius: 7px;
  font-size: 0.95rem;
  font-weight: 600;
  text-align: center;
  cursor: pointer;
  border: none;
  text-decoration: none;
  line-height: 1.4;
}
.btn-unsub {
  background: #b91c1c;
  color: #ffffff;
}
.btn-unsub:hover { background: #991b1b; }
.btn-keep {
  background: #f3f0ff;
  color: #5B21B6;
  border: 1.5px solid #c4b5fd;
}
.btn-keep:hover { background: #ede9fe; }
.divider {
  border: none;
  border-top: 1px solid #e5e7eb;
  margin: 1.5rem 0 1.25rem;
}
.legal {
  font-size: 0.7rem;
  color: #9ca3af;
  line-height: 1.5;
}
.footer {
  margin-top: 1.25rem;
  text-align: center;
  font-size: 0.75rem;
  color: #9ca3af;
}
.footer a {
  color: #6d28d9;
  text-decoration: none;
}
.footer a:hover { text-decoration: underline; }
.icon {
  font-size: 2.5rem;
  margin-bottom: 0.75rem;
  display: block;
}
</style>
</head>
<body>
  <div class="card">
    <div class="logo-bar">
      <img src="/NBE_LOGO_BK_PL.png" alt="NBE Australia" />
    </div>
    <div class="accent-bar">
      <p>Industrial rapid doors &amp; PVC door systems</p>
    </div>
    <div class="body">
      ${inner}
      <hr class="divider" />
      <p class="legal">NBE Australia Pty Ltd (ABN 17 007 048 008) &mdash; 22A Humeside Drive, Campbellfield VIC 3061</p>
    </div>
  </div>
  <div class="footer">
    <a href="${NBE_WEBSITE}" target="_blank" rel="noopener">Visit nbeaustralia.com.au</a>
  </div>
</body>
</html>`
}

export function renderUnsubscribePageHtml(view: UnsubscribePageView): string {
  if (view.kind === 'invalid') {
    return shell(
      `<span class="icon">&#x26A0;&#xFE0F;</span>
      <h1>Link not valid</h1>
      <p class="desc">This unsubscribe link may have expired or been copied incorrectly. If you continue to receive sales emails from NBE, please reply to any of them and we will remove you promptly.</p>
      <div class="actions">
        <a class="btn btn-keep" href="${NBE_WEBSITE}" target="_blank" rel="noopener">Visit NBE Australia</a>
      </div>`,
      'Unsubscribe — NBE Australia',
    )
  }

  if (view.kind === 'done') {
    return shell(
      `<span class="icon">&#x2705;</span>
      <h1>You've been unsubscribed</h1>
      <p class="desc">You will not receive any further sales emails from NBE Australia. We're sorry to see you go — if you ever need industrial door solutions, we're always here.</p>
      <div class="actions">
        <a class="btn btn-keep" href="${NBE_WEBSITE}" target="_blank" rel="noopener">Visit NBE Australia</a>
      </div>`,
      "You've been unsubscribed — NBE Australia",
    )
  }

  if (view.kind === 'cancelled') {
    return shell(
      `<span class="icon">&#x1F44D;</span>
      <h1>No changes made</h1>
      <p class="desc">You're still on our list. We'll only send you relevant information about industrial door solutions that may benefit your business.</p>
      <div class="actions">
        <a class="btn btn-keep" href="${NBE_WEBSITE}" target="_blank" rel="noopener">Visit NBE Australia</a>
      </div>`,
      'No changes — NBE Australia',
    )
  }

  // kind === 'confirm'
  const emailLine = view.email?.trim()
    ? `We'll stop sending sales emails to <span class="email-highlight">${escapeHtml(view.email.trim())}</span> if you confirm below.`
    : "Confirm below to stop receiving sales emails from NBE Australia."

  return shell(
    `<h1>Unsubscribe from NBE emails?</h1>
    <p class="desc">${emailLine}</p>
    <p class="desc" style="margin-bottom:1.5rem;font-size:0.875rem;color:#6b7280;">Changed your mind? Just click &ldquo;Keep me subscribed&rdquo; — no action will be taken.</p>
    <div class="actions">
      <form method="POST" action="" style="margin:0;">
        <button type="submit" class="btn btn-unsub">Yes, unsubscribe me</button>
      </form>
      <form method="GET" action="?cancel=1" style="margin:0;">
        <button type="submit" class="btn btn-keep">No, keep me subscribed</button>
      </form>
    </div>`,
    'Unsubscribe — NBE Australia',
  )
}
