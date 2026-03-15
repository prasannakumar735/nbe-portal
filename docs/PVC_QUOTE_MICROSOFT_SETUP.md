# PVC Quote PDF - Microsoft Graph & OneDrive Setup Guide

This guide explains how to enable cloud upload and email delivery for PVC quote PDFs.

## Current Behavior (No Credentials)

If Microsoft/SMTP credentials are not configured, the app will:
- Generate the PDF
- Return it to the browser
- Download it locally for testing
- Mark OneDrive/email as `skipped` in API audit

This lets you test quote PDF generation immediately.

---

## 1) Azure App Registration

1. Go to **Azure Portal** → **Microsoft Entra ID** → **App registrations**.
2. Click **New registration**.
3. Name it: `NBE Portal Quote Service`.
4. Supported account type:
   - Choose your org default (usually **Single tenant**).
5. Click **Register**.

Save these values:
- **Application (client) ID** → `MS_CLIENT_ID`
- **Directory (tenant) ID** → `MS_TENANT_ID`

---

## 2) Create Client Secret

1. Open the app registration.
2. Go to **Certificates & secrets**.
3. Click **New client secret**.
4. Set expiry and create.
5. Copy the secret value immediately.

Set as:
- `MS_CLIENT_SECRET`

---

## 3) Microsoft Graph API Permissions

Go to **API permissions** → **Add a permission** → **Microsoft Graph**.

### For OneDrive Upload
- Add **Application** permission: `Files.ReadWrite.All`

### For Sending Email (Graph option, if you later switch from SMTP)
- Add **Application** permission: `Mail.Send`

Then click **Grant admin consent**.

> Note: Current code sends email via SMTP (`nodemailer`). Graph Mail is optional future enhancement.

---

## 4) OneDrive Target Account Strategy

The API supports:

### Option A (Recommended for app-only flow)
Use a specific user drive:
- Set `MS_ONEDRIVE_USER_ID` (UPN or object ID)
- API endpoint used: `/users/{id}/drive/root:/...:/content`

### Option B
Custom endpoint template:
- Set `MS_ONEDRIVE_UPLOAD_ENDPOINT`
- Include `{path}` placeholder
- Example:
  - `https://graph.microsoft.com/v1.0/users/<user-id>/drive/root:/{path}:/content`

If neither is set, code defaults to `/me/drive`, which usually requires delegated user tokens.

---

## 5) Environment Variables

Set these in local `.env.local` and Vercel project settings.

### Required for OneDrive Upload
- `MS_TENANT_ID`
- `MS_CLIENT_ID`
- `MS_CLIENT_SECRET`

### Optional / Advanced
- `MS_ONEDRIVE_USER_ID`
- `MS_ONEDRIVE_UPLOAD_ENDPOINT`
- `MS_GRAPH_ACCESS_TOKEN` (manual override token; mainly for testing)

### Existing required app vars
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### SMTP for email sending
- `SMTP_HOST`
- `SMTP_PORT` (e.g. `587`)
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

---

## 6) Vercel Configuration

1. Open Vercel project → **Settings** → **Environment Variables**.
2. Add all variables above.
3. Redeploy.

---

## 7) Verify End-to-End

1. Open PVC Calculator.
2. Click **Calculate**.
3. Click **Generate Quote**.
4. Confirm API response audit:
   - `audit.oneDrive.status = uploaded`
   - `audit.email.status = sent`
   - `audit.database.status = inserted`
5. Verify file appears in:
   - `NBE Quotes/{year}/{month}/PVC_Quote_{timestamp}.pdf`

---

## 8) Troubleshooting

### Error: Missing Microsoft Graph credentials
- Set either:
  - `MS_GRAPH_ACCESS_TOKEN`, or
  - `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`

### Upload fails with permissions error
- Confirm Graph app permission `Files.ReadWrite.All`
- Confirm admin consent granted
- Prefer `MS_ONEDRIVE_USER_ID` with app-only flow

### Email skipped
- Check SMTP vars are present and correct

### Database skipped
- Check `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_URL`

---

## 9) Security Notes

- Never expose `MS_CLIENT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, or SMTP password to the browser.
- Keep these only in server-side env vars.
- Rotate secrets periodically.
