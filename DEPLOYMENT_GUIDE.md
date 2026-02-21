# Vercel Production Deployment Guide

## ✅ Pre-Deployment Verification

```bash
# 1. Verify build passes locally
npm run build
# Expected output: ✓ Compiled successfully (exit code: 0)

# 2. Verify no TypeScript errors
npm run type-check
# Expected output: No errors found

# 3. Start development server to test auth flow
npm run dev
# Expected output: Ready in X ms on http://localhost:3000
```

---

## 🚀 Deployment Steps

### Step 1: Set Environment Variables in Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project: **nbe-portal**
3. Go to **Settings → Environment Variables**
4. Add the following variables:

| Name | Value | Environments |
|------|-------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ0eXAi...` (your anon key) | Production, Preview, Development |

**How to find these values:**
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings → API**
4. Copy **Project URL** → Use as `NEXT_PUBLIC_SUPABASE_URL`
5. Copy **Anon public key** → Use as `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**⚠️ Important Notes:**
- These values are **PUBLIC by design** - they're not secrets
- Anon key is limited by Row Level Security (RLS) policies
- Never use the `service_role` key in environment variables

### Step 2: Verify Supabase Row Level Security

Before deploying, ensure RLS is enabled on all tables:

```sql
-- Enable RLS for all tables
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Create policy: Users can only see their own time entries
CREATE POLICY "Users can view own time entries"
  ON time_entries
  FOR SELECT
  USING (auth.uid() = employee_id);

-- Create policy: Admins/managers can view all time entries
CREATE POLICY "Managers can view all time entries"
  ON time_entries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
    )
  );
```

### Step 3: Deploy to Vercel

#### Option A: Deploy via Vercel Dashboard
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select **nbe-portal** project
3. Click **Deploy** button
4. Wait for deployment to complete
5. Verify build passed (green checkmark)

#### Option B: Deploy via CLI
```bash
# Install Vercel CLI (if not already installed)
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod

# Follow prompts to confirm settings
```

#### Option C: Deploy via Git (Recommended)
Push code to your Git repository - Vercel auto-deploys on push:
```bash
git add .
git commit -m "feat: production-grade authentication implementation"
git push origin main
```

### Step 4: Monitor Deployment

1. **In Vercel Dashboard:**
   - Go to **Deployments** tab
   - Watch for green checkmark (deployment successful)
   - Click deployment to view build logs

2. **Expected Build Output:**
   ```
   ✓ Compiled successfully in 2.1s
   ✓ Finished TypeScript in 2.8s
   ✓ Generated 7 routes
   ✓ Production build completed
   ```

3. **If deployment fails:**
   - Click deployment to view logs
   - Look for errors in build section
   - Verify environment variables are set correctly
   - Check that all required packages are installed

---

## ✅ Post-Deployment Testing

### Test 1: Verify Deployment URL
1. Get deployment URL from Vercel Dashboard (format: `https://nbe-portal-xxxx.vercel.app`)
2. Open in browser
3. Expected: See login page with "NBE Portal Login" heading

### Test 2: Test Login Flow
1. Click login page input fields
2. Enter test credentials: 
   - Email: `test@example.com`
   - Password: `your-test-password`
3. Click **Sign In**
4. Expected: 
   - Loading spinner appears
   - Redirects to `/dashboard` after 1-2 seconds
   - Dashboard loads with user's data

### Test 3: Test Session Persistence
1. On dashboard page, refresh browser (F5)
2. Expected: Page reloads and stays on dashboard (session persists)
3. Check browser DevTools → Application → Cookies
   - Should see `sb-<project-id>-auth-token` cookie

### Test 4: Test Protected Route Access
1. Open browser DevTools → Application → Cookies
2. Delete `sb-<project-id>-auth-token` cookie
3. Refresh page
4. Expected: Redirected to login page (accessed without session)

### Test 5: Test Logout Flow
1. On dashboard, look for logout button
2. Click logout
3. Expected: 
   - Redirects to `/login` page
   - Auth cookie is removed
   - Login form is visible

### Test 6: Test Token Refresh
1. Login to dashboard
2. Leave browser open for 1+ hours
3. Expected: Page continues to work (token auto-refreshes before expiration)
4. Check Network tab for `refresh_session` calls

---

## 🔍 Production Monitoring

### Monitor Error Logs
```bash
# View Vercel logs (if using Vercel CLI)
vercel logs --prod

# Or go to: Vercel Dashboard → Deployments → Click deployment → Logs tab
```

### Monitor Auth Events
In Supabase Dashboard:
1. Go to **Auth → Users**
2. Check recent login activity
3. Look for failed login attempts
4. Verify user creation working correctly

### Monitor Performance
In Vercel Dashboard:
1. Go to **Analytics**
2. Check Core Web Vitals
3. Monitor response times
4. Watch for errors/exceptions

---

## 🚨 Troubleshooting

### Issue: "Cookies can only be modified in Server Action"
**Cause:** Server Component trying to write cookies  
**Solution:** Already fixed in lib/supabase/server.ts with try-catch blocks  
**Verification:** Check build logs - should not see this error

### Issue: "Missing environment variables"
**Cause:** NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not set  
**Solution:**
1. Go to Vercel Project Settings → Environment Variables
2. Add both required variables
3. Redeploy (Vercel will auto-redeploy)

### Issue: "Continuous redirect to login"
**Cause:** Session not being persisted properly  
**Verification:**
1. Open DevTools → Application → Cookies
2. Check if `sb-<project-id>-auth-token` exists
3. If missing, session not saving (check Supabase config)
4. If exists, check expiration time

### Issue: "Auth listener not triggering"
**Cause:** AuthProvider not mounted or subscription failed  
**Solution:**
1. Verify AuthProvider in app/layout.tsx wraps children
2. Check browser console for errors during mount
3. Verify onAuthStateChange subscription completes

### Issue: "Slow login redirect"
**Cause:** router.refresh() waiting for server response  
**Solution:** Expected behavior - allows session sync, happens in ~100ms

---

## 📋 Vercel Deployment Checklist

- [ ] **Pre-Deployment:**
  - [ ] Local build passes: `npm run build` (exit code 0)
  - [ ] No TypeScript errors: `npm run type-check`
  - [ ] Git repo is clean and pushed
  - [ ] All environment variables noted

- [ ] **Vercel Configuration:**
  - [ ] NEXT_PUBLIC_SUPABASE_URL set in Environment Variables
  - [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY set in Environment Variables
  - [ ] Variables applied to all environments (Production/Preview/Development)
  - [ ] Build settings correct (use defaults for Next.js)

- [ ] **Supabase Configuration:**
  - [ ] RLS enabled on all tables
  - [ ] RLS policies created for user isolation
  - [ ] Test user created with credentials
  - [ ] Auth email templates configured

- [ ] **Post-Deployment:**
  - [ ] Deployment shows green checkmark
  - [ ] Build logs show 0 errors
  - [ ] Login page loads at deployment URL
  - [ ] Test login with credentials succeeds
  - [ ] Session persists after page refresh
  - [ ] Logout works and redirects to login
  - [ ] Protected routes redirect without session

- [ ] **Production Monitoring:**
  - [ ] Error logs configured
  - [ ] Supabase auth events monitored
  - [ ] Performance metrics baseline established
  - [ ] Alerts configured for failures

---

## 🎉 Deployment Successful!

Your NBE Portal is now live on Vercel with production-grade authentication.

**Next Steps:**
1. Share deployment URL with users: `https://nbe-portal-xxxx.vercel.app`
2. Monitor auth logs in Supabase Dashboard
3. Help users create accounts via Sign Up flow
4. Watch for auth-related issues in first 24 hours

**Support Resources:**
- [Vercel Docs](https://vercel.com/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Next.js App Router Guide](https://nextjs.org/docs/app)

---

**Deployment Date:** _________________  
**Deployed By:** _________________  
**Vercel URL:** https://nbe-portal-____.vercel.app  
**Release Notes:** Production auth implementation with session persistence
