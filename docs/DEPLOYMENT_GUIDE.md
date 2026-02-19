# NBE Portal Timecard Module - Deployment Guide

## Prerequisites

- Node.js 18+ and npm/yarn
- PostgreSQL 14+ or Supabase account
- Git (for version control)
- VS Code or preferred IDE

## Step-by-Step Deployment

### 1. Database Setup

#### Option A: Using Supabase (Recommended)

1. Create a Supabase project at https://supabase.com

2. Go to SQL Editor and run the schema:
```sql
-- Copy contents from lib/db/schema.sql
-- Execute in Supabase SQL Editor
```

3. Seed work types:
```sql
-- Copy contents from lib/db/seed-work-types.sql
-- Execute in Supabase SQL Editor
```

4. Seed sample projects (optional):
```sql
-- Copy contents from lib/db/seed-projects.sql
-- Execute in Supabase SQL Editor
```

#### Option B: Using Local PostgreSQL

```bash
# Create database
createdb nbe_portal

# Run migrations
psql -U postgres -d nbe_portal -f lib/db/schema.sql
psql -U postgres -d nbe_portal -f lib/db/seed-work-types.sql
psql -U postgres -d nbe_portal -f lib/db/seed-projects.sql
```

### 2. Environment Configuration

Create `.env.local` in project root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Optional: Analytics
NEXT_PUBLIC_GA_TRACKING_ID=UA-XXXXXXXXX-X
```

### 3. Install Dependencies

```bash
cd c:\xampp\htdocs\nbe-portal\nbe-portal
npm install

# Or with yarn
yarn install
```

### 4. Configure User Roles

After users sign up, assign roles in Supabase:

```sql
-- Assign admin role
INSERT INTO user_roles (user_id, role)
VALUES ('uuid-from-auth-users', 'admin');

-- Assign manager role
INSERT INTO user_roles (user_id, role)
VALUES ('uuid-from-auth-users', 'manager');

-- Assign staff role
INSERT INTO user_roles (user_id, role)
VALUES ('uuid-from-auth-users', 'staff');

-- Setup manager-employee relationships
INSERT INTO manager_assignments (manager_id, employee_id)
VALUES ('manager-uuid', 'staff-uuid');
```

### 5. Test Locally

```bash
npm run dev
```

Navigate to:
- http://localhost:3000/timecard-enhanced

Test workflow:
1. Create time entries
2. Submit week
3. Login as manager and approve/reject
4. View analytics dashboard

### 6. Build for Production

```bash
npm run build
```

Fix any TypeScript errors or warnings before deployment.

### 7. Deploy to Production

#### Option A: Vercel (Recommended for Next.js)

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

Configure environment variables in Vercel dashboard:
- Settings → Environment Variables
- Add `NEXT_PUBLIC_SUPABASE_URL`
- Add `NEXT_PUBLIC_SUPABASE_ANON_KEY`

#### Option B: Netlify

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Login
netlify login

# Deploy
netlify deploy --prod
```

#### Option C: Docker

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t nbe-portal .
docker run -p 3000:3000 -e NEXT_PUBLIC_SUPABASE_URL=... nbe-portal
```

### 8. Post-Deployment Verification

✅ **Database**
- [ ] All tables created
- [ ] Work types seeded (check 39 records)
- [ ] RLS policies active
- [ ] Indexes created

✅ **Authentication**
- [ ] Users can sign up/login
- [ ] Roles assigned correctly
- [ ] Manager assignments set

✅ **Functionality**
- [ ] Create time entry
- [ ] Edit time entry (before submission)
- [ ] Submit week
- [ ] Manager approval/rejection
- [ ] Unlock functionality
- [ ] Dashboard loads with data

✅ **Permissions**
- [ ] Staff can only see own entries
- [ ] Manager can see team entries
- [ ] Admin can see all entries
- [ ] Accountant has read-only access

✅ **Validation**
- [ ] Hours must be 0.25 increments
- [ ] Cannot exceed 16 hours/day
- [ ] Project required for non-leave
- [ ] Cannot edit after submission

✅ **Analytics**
- [ ] Summary KPIs display
- [ ] Project hours chart renders
- [ ] Work type distribution shows
- [ ] Filters work correctly

### 9. Monitoring & Logging

Setup error tracking (recommended):

**Sentry**
```bash
npm install @sentry/nextjs

# Add to next.config.ts
const { withSentryConfig } = require('@sentry/nextjs');

module.exports = withSentryConfig(
  nextConfig,
  { silent: true }
);
```

**Supabase Logs**
- Monitor database logs in Supabase dashboard
- Check API usage and performance
- Set up alerts for errors

### 10. Backup Strategy

**Database Backups (Supabase)**
- Enable daily automatic backups
- Test restore procedure
- Export data periodically

**Manual Backup**
```bash
# Export database
pg_dump -U postgres nbe_portal > backup_$(date +%Y%m%d).sql

# Restore
psql -U postgres nbe_portal < backup_20260219.sql
```

### 11. Performance Optimization

**Caching**
```typescript
// Cache work types (rarely change)
const CACHE_DURATION = 3600 // 1 hour
let workTypesCache = null
let cacheTime = 0

export async function getCachedWorkTypes() {
  if (workTypesCache && Date.now() - cacheTime < CACHE_DURATION * 1000) {
    return workTypesCache
  }
  workTypesCache = await WorkTypeService.getAll()
  cacheTime = Date.now()
  return workTypesCache
}
```

**Database Optimization**
```sql
-- Add indexes for common queries
CREATE INDEX idx_time_entries_date_range ON time_entries(entry_date) 
WHERE entry_date >= CURRENT_DATE - INTERVAL '90 days';

-- Vacuum and analyze
VACUUM ANALYZE time_entries;
VACUUM ANALYZE weekly_submissions;
```

### 12. Security Checklist

- [ ] RLS policies enabled on all tables
- [ ] Environment variables not committed
- [ ] HTTPS enabled in production
- [ ] CORS configured properly
- [ ] API rate limiting set up
- [ ] SQL injection prevented (parameterized queries)
- [ ] XSS prevented (React escaping)
- [ ] Authentication tokens secured

### 13. User Documentation

Create user guides:

**For Staff:**
1. How to create time entries
2. How to submit weekly timesheet
3. How to view history
4. Understanding billable vs non-billable

**For Managers:**
1. How to review submissions
2. How to approve/reject
3. How to unlock timesheets
4. How to view team analytics

**For Admins:**
1. User role management
2. Project creation
3. System configuration
4. Report generation

### 14. Maintenance Plan

**Weekly:**
- Review error logs
- Check database performance
- Monitor user feedback

**Monthly:**
- Update dependencies
- Review audit logs
- Backup database
- Performance analysis

**Quarterly:**
- Security audit
- Feature requests review
- User training sessions

### 15. Troubleshooting Common Issues

**Issue: "Work types not loading"**
```bash
# Check if seed data loaded
SELECT COUNT(*) FROM work_types; -- Should be 39

# Re-run seed
psql -d nbe_portal -f lib/db/seed-work-types.sql
```

**Issue: "Permission denied on time_entries"**
```sql
-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'time_entries';

-- Verify user role
SELECT role FROM user_roles WHERE user_id = 'uuid';
```

**Issue: "Cannot submit week"**
- Check if entries exist for that week
- Verify submission doesn't already exist
- Check user permissions

**Issue: "Build errors"**
```bash
# Clear cache
rm -rf .next node_modules
npm install
npm run build
```

### 16. Scaling Considerations

**For 100+ users:**
- Implement Redis caching
- Add database read replicas
- Set up CDN for static assets
- Consider serverless functions for heavy operations

**For 1000+ users:**
- Microservices architecture
- Message queue for async operations
- Horizontal database scaling
- Load balancing

## Support Contacts

- Technical Issues: dev@nbeaustralia.com
- Database Issues: dba@nbeaustralia.com
- User Support: support@nbeaustralia.com

## Version History

- v1.0.0 (2026-02-19): Initial release
  - Time entry management
  - Weekly submissions
  - Role-based permissions
  - Analytics dashboard
  - Audit logging

## Next Steps

After successful deployment:
1. Train key users (managers, admins)
2. Roll out to pilot group
3. Gather feedback
4. Iterate and improve
5. Full organization rollout

---

**Deployment Checklist**

- [ ] Database schema created
- [ ] Work types seeded
- [ ] Sample projects loaded
- [ ] Environment variables set
- [ ] User roles configured
- [ ] Local testing passed
- [ ] Production build successful
- [ ] Deployed to hosting
- [ ] Post-deployment verification
- [ ] Monitoring enabled
- [ ] Backup strategy in place
- [ ] Documentation created
- [ ] Users trained

🎉 **Deployment Complete!**
