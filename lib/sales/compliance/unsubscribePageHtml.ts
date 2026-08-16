import { escapeHtml } from '@/lib/sales/sending/emailBodyFormat'

const FONT = "Arial, 'Helvetica Neue', Helvetica, sans-serif"

export type UnsubscribePageView =
  | { kind: 'confirm'; email?: string | null }
  | { kind: 'done' }
  | { kind: 'invalid' }

function shell(inner: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Unsubscribe — NBE Australia</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    background: #eef0f3;
    color: #1f2937;
    font-family: ${FONT};
    line-height: 1.55;
  }
  .wrap { max-width: 32rem; margin: 0 auto; padding: 2.5rem 1.25rem; }
  .card {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 8px 24px rgba(17, 24, 39, 0.06);
  }
  .logo-bar {
    background: #fff;
    padding: 1rem 1.5rem 0.85rem;
    border-bottom: 4px solid #5B21B6;
  }
  .logo-bar img { height: 40px; width: auto; display: block; }
  .header {
    background: #5B21B6;
    padding: 0.85rem 1.5rem;
    color: #fff;
  }
  .header p { margin: 0; }
  .kicker {
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    font-weight: 600;
    color: #e9d5ff;
  }
  .body { padding: 1.5rem 1.5rem 1.75rem; }
  h1 { margin: 0 0 0.75rem; font-size: 1.25rem; }
  p { margin: 0 0 1rem; color: #4b5563; }
  button {
    appearance: none;
    border: 0;
    border-radius: 6px;
    background: #b3271e;
    color: #fff;
    font-size: 0.95rem;
    font-weight: 600;
    padding: 0.75rem 1.2rem;
    cursor: pointer;
  }
  button:hover { background: #9f1f18; }
  .muted { color: #6b7280; font-size: 0.85rem; }
  .legal { margin-top: 1.25rem; color: #9ca3af; font-size: 0.75rem; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="logo-bar">
        <img src="/nbe-logo.png" alt="NBE Australia" />
      </div>
      <div class="header">
        <p class="kicker">Industrial rapid doors &amp; PVC door systems</p>
      </div>
      <div class="body">
        ${inner}
        <p class="legal">NBE Australia Pty Ltd (ABN 17 007 048 008) — 22A Humeside Drive, Campbellfield VIC 3061</p>
      </div>
    </div>
  </div>
</body>
</html>`
}

export function renderUnsubscribePageHtml(view: UnsubscribePageView): string {
  if (view.kind === 'invalid') {
    return shell(
      '<h1>This link is not valid</h1><p>The unsubscribe link may have been copied incorrectly. If you still receive sales emails from NBE, reply to that message and we will remove you.</p>',
    )
  }

  if (view.kind === 'done') {
    return shell(
      '<h1>You have been unsubscribed</h1><p>You will not receive further sales emails from NBE Australia.</p><p class="muted">You can close this page.</p>',
    )
  }

  const emailLine = view.email?.trim()
    ? `<p>Stop receiving sales emails from NBE at <strong style="color:#111827;">${escapeHtml(view.email.trim())}</strong>?</p>`
    : '<p>Stop receiving sales emails from NBE Australia?</p>'

  return shell(
    [
      '<h1>Unsubscribe</h1>',
      emailLine,
      '<form method="POST" action="">',
      `<button type="submit">Yes, unsubscribe me</button>`,
      '</form>',
      '<p class="muted" style="margin-top:1rem;">You can close this page if you did not mean to unsubscribe.</p>',
    ].join(''),
  )
}
