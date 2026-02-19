-- NBE Portal Timecard Module Database Schema
-- Database: PostgreSQL (compatible with Supabase)

-- ============================================
-- 1. WORK TYPES TABLE
-- ============================================
CREATE TABLE work_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level1_id VARCHAR(10) NOT NULL,
    level1_description VARCHAR(100) NOT NULL,
    level2_id VARCHAR(10),
    level2_description VARCHAR(100),
    billable_flag BOOLEAN DEFAULT TRUE,
    is_leave_type BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_work_types_level1 ON work_types(level1_id);
CREATE INDEX idx_work_types_level2 ON work_types(level2_id);
CREATE INDEX idx_work_types_active ON work_types(active);

-- ============================================
-- 2. PROJECTS/CLIENTS TABLE
-- ============================================
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_code VARCHAR(50) UNIQUE NOT NULL,
    project_name VARCHAR(200) NOT NULL,
    client_name VARCHAR(200) NOT NULL,
    door_id VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on-hold', 'cancelled')),
    budget_hours DECIMAL(10, 2),
    start_date DATE,
    end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_client ON projects(client_name);

-- ============================================
-- 3. TIME ENTRIES TABLE
-- ============================================
CREATE TABLE time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    work_type_level1_id VARCHAR(10) NOT NULL,
    work_type_level2_id VARCHAR(10) NOT NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    hours DECIMAL(4, 2) NOT NULL CHECK (hours > 0 AND hours <= 24 AND (hours * 4) = FLOOR(hours * 4)),
    billable BOOLEAN DEFAULT TRUE,
    notes TEXT,
    weekly_submission_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_time_entries_employee ON time_entries(employee_id);
CREATE INDEX idx_time_entries_date ON time_entries(entry_date);
CREATE INDEX idx_time_entries_project ON time_entries(project_id);
CREATE INDEX idx_time_entries_submission ON time_entries(weekly_submission_id);
CREATE INDEX idx_time_entries_employee_date ON time_entries(employee_id, entry_date);

-- Constraint: prevent duplicate entries for same employee/date/project/work_type
CREATE UNIQUE INDEX idx_time_entries_unique ON time_entries(employee_id, entry_date, project_id, work_type_level2_id) 
WHERE weekly_submission_id IS NULL;

-- ============================================
-- 4. WEEKLY SUBMISSIONS TABLE
-- ============================================
CREATE TABLE weekly_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL,
    week_end_date DATE NOT NULL,
    total_hours DECIMAL(6, 2) NOT NULL DEFAULT 0,
    billable_hours DECIMAL(6, 2) NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'locked')),
    submitted_at TIMESTAMP WITH TIME ZONE,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES auth.users(id),
    manager_comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_weekly_submissions_employee ON weekly_submissions(employee_id);
CREATE INDEX idx_weekly_submissions_status ON weekly_submissions(status);
CREATE INDEX idx_weekly_submissions_week ON weekly_submissions(week_start_date, week_end_date);

-- Unique constraint: one submission per employee per week
CREATE UNIQUE INDEX idx_weekly_submissions_unique ON weekly_submissions(employee_id, week_start_date);

-- ============================================
-- 5. AUDIT LOG TABLE
-- ============================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(50) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'UNLOCK', 'SUBMIT')),
    field_name VARCHAR(100),
    old_value TEXT,
    new_value TEXT,
    changed_by UUID NOT NULL REFERENCES auth.users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

CREATE INDEX idx_audit_logs_table ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(changed_by);
CREATE INDEX idx_audit_logs_date ON audit_logs(changed_at);

-- ============================================
-- 6. USER ROLES TABLE (extends auth.users)
-- ============================================
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'manager', 'staff', 'accountant')),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role);

-- Unique constraint: one role per user
CREATE UNIQUE INDEX idx_user_roles_unique ON user_roles(user_id);

-- ============================================
-- 7. MANAGER ASSIGNMENTS TABLE
-- ============================================
CREATE TABLE manager_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manager_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_manager_assignments_manager ON manager_assignments(manager_id);
CREATE INDEX idx_manager_assignments_employee ON manager_assignments(employee_id);

-- Unique constraint: one manager per employee
CREATE UNIQUE INDEX idx_manager_assignments_unique ON manager_assignments(employee_id);

-- ============================================
-- TRIGGERS FOR AUTO-UPDATE TIMESTAMPS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_work_types_updated_at BEFORE UPDATE ON work_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_time_entries_updated_at BEFORE UPDATE ON time_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_weekly_submissions_updated_at BEFORE UPDATE ON weekly_submissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TRIGGERS FOR AUDIT LOGGING
-- ============================================
CREATE OR REPLACE FUNCTION log_time_entry_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        -- Log each changed field
        IF OLD.hours != NEW.hours THEN
            INSERT INTO audit_logs (table_name, record_id, action, field_name, old_value, new_value, changed_by)
            VALUES ('time_entries', NEW.id, 'UPDATE', 'hours', OLD.hours::TEXT, NEW.hours::TEXT, NEW.updated_by);
        END IF;
        IF OLD.work_type_level2_id != NEW.work_type_level2_id THEN
            INSERT INTO audit_logs (table_name, record_id, action, field_name, old_value, new_value, changed_by)
            VALUES ('time_entries', NEW.id, 'UPDATE', 'work_type_level2_id', OLD.work_type_level2_id, NEW.work_type_level2_id, NEW.updated_by);
        END IF;
        IF OLD.project_id IS DISTINCT FROM NEW.project_id THEN
            INSERT INTO audit_logs (table_name, record_id, action, field_name, old_value, new_value, changed_by)
            VALUES ('time_entries', NEW.id, 'UPDATE', 'project_id', OLD.project_id::TEXT, NEW.project_id::TEXT, NEW.updated_by);
        END IF;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO audit_logs (table_name, record_id, action, changed_by)
        VALUES ('time_entries', NEW.id, 'INSERT', NEW.created_by);
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO audit_logs (table_name, record_id, action, changed_by)
        VALUES ('time_entries', OLD.id, 'DELETE', OLD.updated_by);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_time_entries
AFTER INSERT OR UPDATE OR DELETE ON time_entries
FOR EACH ROW EXECUTE FUNCTION log_time_entry_changes();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_types ENABLE ROW LEVEL SECURITY;

-- Staff can view/edit their own time entries (if not submitted)
CREATE POLICY "Staff can view own time entries" ON time_entries
    FOR SELECT USING (auth.uid() = employee_id);

CREATE POLICY "Staff can create own time entries" ON time_entries
    FOR INSERT WITH CHECK (auth.uid() = employee_id);

CREATE POLICY "Staff can update own unsubmitted entries" ON time_entries
    FOR UPDATE USING (
        auth.uid() = employee_id 
        AND (weekly_submission_id IS NULL 
             OR EXISTS (
                 SELECT 1 FROM weekly_submissions 
                 WHERE id = time_entries.weekly_submission_id 
                 AND status = 'draft'
             ))
    );

-- Managers can view their team's entries
CREATE POLICY "Managers can view team entries" ON time_entries
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM manager_assignments 
            WHERE manager_id = auth.uid() 
            AND employee_id = time_entries.employee_id
        )
    );

-- Admins can view all entries
CREATE POLICY "Admins can view all entries" ON time_entries
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Similar policies for weekly_submissions
CREATE POLICY "Users can view own submissions" ON weekly_submissions
    FOR SELECT USING (auth.uid() = employee_id);

CREATE POLICY "Managers can view team submissions" ON weekly_submissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM manager_assignments 
            WHERE manager_id = auth.uid() 
            AND employee_id = weekly_submissions.employee_id
        )
    );

-- Everyone can read work types and projects
CREATE POLICY "All authenticated users can view work types" ON work_types
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "All authenticated users can view projects" ON projects
    FOR SELECT USING (auth.role() = 'authenticated');
