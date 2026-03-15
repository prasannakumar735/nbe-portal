/**
 * Upload a file to OneDrive using Microsoft Graph API.
 *
 * Example Graph request:
 *   Method: PUT
 *   URL:    https://graph.microsoft.com/v1.0/me/drive/root:/NBE-Maintenance-Reports%2F2026%2FInghams%20Thomastown%2F2026-03-15%2Fphoto.jpg:/content
 *   Headers:
 *     Authorization: Bearer {access_token}
 *     Content-Type: image/jpeg   (or application/octet-stream)
 *   Body:   raw file bytes (binary)
 *
 * Path segments must be encoded (e.g. encodeURIComponent). Folders are created automatically.
 */

function encodePath(pathParts: string[]): string {
  return pathParts.map(part => encodeURIComponent(part)).join('/')
}

async function getGraphToken(): Promise<string> {
  if (process.env.MS_GRAPH_ACCESS_TOKEN) {
    return process.env.MS_GRAPH_ACCESS_TOKEN
  }

  const tenantId = process.env.MS_TENANT_ID
  const clientId = process.env.MS_CLIENT_ID
  const clientSecret = process.env.MS_CLIENT_SECRET

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error(
      'Missing Microsoft Graph credentials. Set MS_GRAPH_ACCESS_TOKEN or MS_TENANT_ID/MS_CLIENT_ID/MS_CLIENT_SECRET.',
    )
  }

  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
    },
  )

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

function contentTypeFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    pdf: 'application/pdf',
  }
  return map[ext ?? ''] ?? 'application/octet-stream'
}

export type UploadFileResult = {
  webUrl?: string
  name?: string
}

/**
 * Upload file bytes to OneDrive at the given path.
 * @param fileBuffer - Raw file bytes (Buffer or Uint8Array)
 * @param filePath  - Full path under root, e.g. "NBE-Maintenance-Reports/2026/Inghams Thomastown/2026-03-15/photo.jpg"
 *                   Path segments are encoded for the Graph URL; folders are created automatically.
 */
export async function uploadFileToOneDrive(
  fileBuffer: Buffer | Uint8Array,
  filePath: string,
): Promise<UploadFileResult> {
  const token = await getGraphToken()

  const segments = filePath.replace(/\\/g, '/').split('/').filter(Boolean)
  const graphPath = encodePath(segments)

  const customEndpoint = process.env.MS_ONEDRIVE_UPLOAD_ENDPOINT
  const endpoint = customEndpoint
    ? customEndpoint.replace('{path}', graphPath)
    : process.env.MS_ONEDRIVE_USER_ID
      ? `https://graph.microsoft.com/v1.0/users/${process.env.MS_ONEDRIVE_USER_ID}/drive/root:/${graphPath}:/content`
      : `https://graph.microsoft.com/v1.0/me/drive/root:/${graphPath}:/content`

  const contentType = contentTypeFromPath(filePath)
  const body = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer)

  const uploadRes = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': contentType,
    },
    body: body as unknown as BodyInit,
  })

  if (!uploadRes.ok) {
    const bodyText = await uploadRes.text()
    throw new Error(`OneDrive upload failed (${uploadRes.status}): ${bodyText}`)
  }

  const uploaded = (await uploadRes.json()) as Record<string, unknown>
  return {
    webUrl: typeof uploaded.webUrl === 'string' ? uploaded.webUrl : undefined,
    name: typeof uploaded.name === 'string' ? uploaded.name : undefined,
  }
}
