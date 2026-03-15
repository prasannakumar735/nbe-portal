type UploadPdfResult = {
  webUrl: string
  downloadUrl: string
  name: string
}

type GraphUploadResponse = {
  name?: string
  webUrl?: string
  [key: string]: unknown
}

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
    throw new Error('Missing Microsoft Graph credentials. Set MS_GRAPH_ACCESS_TOKEN or MS_TENANT_ID/MS_CLIENT_ID/MS_CLIENT_SECRET.')
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

export async function uploadPdfToOneDrive(pdfBuffer: Uint8Array, fileName: string): Promise<UploadPdfResult> {
  const token = await getGraphToken()

  const now = new Date()
  const year = String(now.getFullYear())
  const month = now.toLocaleString('en-AU', { month: 'long' })
  const relativePath = ['NBE Quotes', year, month, fileName]

  const customEndpoint = process.env.MS_ONEDRIVE_UPLOAD_ENDPOINT
  const graphPath = encodePath(relativePath)

  const endpoint = customEndpoint
    ? customEndpoint.replace('{path}', graphPath)
    : process.env.MS_ONEDRIVE_USER_ID
      ? `https://graph.microsoft.com/v1.0/users/${process.env.MS_ONEDRIVE_USER_ID}/drive/root:/${graphPath}:/content`
      : `https://graph.microsoft.com/v1.0/me/drive/root:/${graphPath}:/content`

  const uploadRes = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/pdf',
    },
    body: Buffer.from(pdfBuffer),
  })

  if (!uploadRes.ok) {
    const body = await uploadRes.text()
    throw new Error(`Failed uploading quote PDF to OneDrive: ${body}`)
  }

  const uploaded = (await uploadRes.json()) as GraphUploadResponse
  const downloadUrl = String(uploaded['@microsoft.graph.downloadUrl'] || uploaded.webUrl || '')
  const webUrl = String(uploaded.webUrl || downloadUrl)

  if (!webUrl) {
    throw new Error('OneDrive upload succeeded but no URL returned by Microsoft Graph.')
  }

  return {
    webUrl,
    downloadUrl: downloadUrl || webUrl,
    name: String(uploaded.name || fileName),
  }
}
