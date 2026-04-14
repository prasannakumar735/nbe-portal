/**
 * Send an email via Microsoft Graph API (sendMail).
 * Requires app permission Mail.Send or delegated Mail.Send, and a user to send as.
 */

export type GraphSendMailOptions = {
  to: string
  subject: string
  /** Plain-text body (used when bodyHtml is not set). */
  bodyText?: string
  /** HTML body; takes precedence over bodyText when set. */
  bodyHtml?: string
  /** Optional; defaults to process.env.MS_GRAPH_MAIL_USER_ID or MS_ONEDRIVE_USER_ID */
  sendAsUserId?: string
}

async function getGraphAccessToken(): Promise<string> {
  if (process.env.MS_GRAPH_ACCESS_TOKEN?.trim()) {
    return process.env.MS_GRAPH_ACCESS_TOKEN.trim()
  }

  const tenantId = process.env.MS_TENANT_ID
  const clientId = process.env.MS_CLIENT_ID
  const clientSecret = process.env.MS_CLIENT_SECRET

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      'Missing Microsoft Graph credentials. Set MS_GRAPH_ACCESS_TOKEN or MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET.',
    )
  }

  const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  })

  if (!tokenRes.ok) {
    const body = await tokenRes.text()
    throw new Error(`Failed to get Microsoft Graph token: ${body}`)
  }

  const tokenJson = (await tokenRes.json()) as { access_token?: string }
  if (!tokenJson.access_token) {
    throw new Error('Microsoft Graph token response did not include access_token.')
  }

  return tokenJson.access_token
}

/**
 * Send an email using Microsoft Graph API.
 * Uses POST /users/{userId}/sendMail.
 */
export async function sendMailViaGraph(options: GraphSendMailOptions): Promise<void> {
  const { to, subject, bodyText, bodyHtml, sendAsUserId } = options

  const userId =
    sendAsUserId?.trim() ||
    process.env.MS_GRAPH_MAIL_USER_ID?.trim() ||
    process.env.MS_ONEDRIVE_USER_ID?.trim()

  if (!userId) {
    throw new Error(
      'No user to send mail as. Set MS_GRAPH_MAIL_USER_ID or MS_ONEDRIVE_USER_ID.',
    )
  }

  const html = bodyHtml?.trim()
  const text = bodyText?.trim()
  if (!html && !text) {
    throw new Error('sendMailViaGraph requires bodyHtml or bodyText.')
  }

  const token = await getGraphAccessToken()

  const payload = {
    message: {
      subject,
      body: html
        ? { contentType: 'HTML', content: html }
        : { contentType: 'Text', content: text! },
      toRecipients: [
        {
          emailAddress: {
            address: to,
            name: to,
          },
        },
      ],
    },
    saveToSentItems: true,
  }

  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${userId}/sendMail`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Microsoft Graph sendMail failed (${res.status}): ${body}`)
  }
}
