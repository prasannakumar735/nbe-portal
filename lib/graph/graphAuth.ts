/**
 * Shared Microsoft Graph client-credentials token (same as sendMail).
 */

export async function getGraphAccessToken(): Promise<string> {
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

export function resolveGraphMailboxUserId(sendAsUserId?: string): string {
  const userId =
    sendAsUserId?.trim() ||
    process.env.MS_GRAPH_MAIL_USER_ID?.trim() ||
    process.env.MS_ONEDRIVE_USER_ID?.trim()

  if (!userId) {
    throw new Error('No Graph mailbox user. Set MS_GRAPH_MAIL_USER_ID or MS_ONEDRIVE_USER_ID.')
  }

  return userId
}
