// TypeScript Types and Interfaces for Timecard Module

export type UserRole = 'admin' | 'manager' | 'staff' | 'accountant'

export type SubmissionStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'locked'

export type ProjectStatus = 'active' | 'completed' | 'on-hold' | 'cancelled'

export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT' | 'UNLOCK' | 'SUBMIT'

// ============================================
// WORK TYPES
// ============================================
export interface WorkType {
  id: string
  level1_id: string
  level1_description: string
  level2_id: string | null
  level2_description: string | null
  billable_flag: boolean
  is_leave_type: boolean
  active: boolean
  created_at: string
  updated_at: string
}

export interface WorkTypeLevel1 {
  id: string
  code: string
  description: string
  active?: boolean
  level2Options?: WorkTypeLevel2[]
}

export interface WorkTypeLevel2 {
  id: string
  level1_id: string
  code: string
  description: string
  billable: boolean
  is_leave_type: boolean
  active: boolean
}

// ============================================
// PROJECTS
// ============================================
export interface Project {
  id: string
  project_code: string
  project_name: string
  client_name: string
  door_id: string | null
  status: ProjectStatus
  budget_hours: number | null
  start_date: string | null
  end_date: string | null
  created_at: string
  updated_at: string
}

// ============================================
// CLIENTS & LOCATIONS
// ============================================
export interface Client {
  id: string
  client_name?: string | null
  name?: string | null
  code?: string | null
  active?: boolean
  created_at?: string
  updated_at?: string
}

export interface ClientLocation {
  id: string
  client_id: string
  suburb?: string | null
  location_name?: string | null
  name?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  active?: boolean
  created_at?: string
  updated_at?: string
}

// ============================================
// TIME ENTRIES
// ============================================
export interface TimeEntry {
  id: string
  employee_id: string
  entry_date: string
  work_type_level1_id: string
  work_type_level2_id: string
  project_id: string | null
  hours: number
  billable: boolean
  notes: string | null
  weekly_submission_id: string | null
  created_at: string
  updated_at: string
  created_by: string
  updated_by: string | null
}

export interface TimeEntryWithDetails extends TimeEntry {
  employee_name: string
  employee_email: string
  project_name: string | null
  project_code: string | null
  client_name: string | null
  work_type_level1_description: string
  work_type_level2_description: string
}

export interface TimeEntryFormData {
  entry_date: string
  work_type_level1_id: string
  work_type_level2_id: string
  project_id: string | null
  hours: number
  notes: string
}

export interface ActiveWorkEntry {
  id: string
  employee_id: string
  client_id: string
  location_id: string
  work_type_level1_id: string
  work_type_level2_id: string
  billable: boolean
  start_time: string
  end_time: string | null
  status: 'active' | 'completed'
  hours?: number | null
  created_at?: string
  updated_at?: string
}

// ============================================
// WEEKLY SUBMISSIONS
// ============================================
export interface WeeklySubmission {
  id: string
  employee_id: string
  week_start_date: string
  week_end_date: string
  total_hours: number
  billable_hours: number
  status: SubmissionStatus
  submitted_at: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  manager_comments: string | null
  created_at: string
  updated_at: string
}

export interface WeeklySubmissionWithDetails extends WeeklySubmission {
  employee_name: string
  employee_email: string
  reviewer_name: string | null
  time_entries: TimeEntryWithDetails[]
}

export interface WeeklySubmissionSummary {
  week_start_date: string
  week_end_date: string
  total_hours: number
  billable_hours: number
  non_billable_hours: number
  status: SubmissionStatus
  entry_count: number
}

// ============================================
// AUDIT LOGS
// ============================================
export interface AuditLog {
  id: string
  table_name: string
  record_id: string
  action: AuditAction
  field_name: string | null
  old_value: string | null
  new_value: string | null
  changed_by: string
  changed_at: string
  ip_address: string | null
  user_agent: string | null
}

export interface AuditLogWithUser extends AuditLog {
  user_name: string
  user_email: string
}

// ============================================
// USER ROLES
// ============================================
export interface UserRoleRecord {
  id: string
  user_id: string
  role: UserRole
  assigned_at: string
  assigned_by: string | null
}

export interface UserWithRole {
  id: string
  email: string
  full_name: string | null
  role: UserRole
}

// ============================================
// MANAGER ASSIGNMENTS
// ============================================
export interface ManagerAssignment {
  id: string
  manager_id: string
  employee_id: string
  assigned_at: string
  assigned_by: string | null
}

// ============================================
// DASHBOARD ANALYTICS
// ============================================
export interface DashboardSummary {
  total_hours: number
  billable_hours: number
  non_billable_hours: number
  billable_percentage: number
  total_entries: number
  active_projects: number
}

export interface HoursByProject {
  project_id: string
  project_code: string
  project_name: string
  client_name: string
  total_hours: number
  billable_hours: number
  entry_count: number
}

export interface HoursByClient {
  client_name: string
  total_hours: number
  billable_hours: number
  project_count: number
  entry_count: number
}

export interface WorkTypeMix {
  work_type_level1_id: string
  work_type_level1_description: string
  work_type_level2_id: string
  work_type_level2_description: string
  total_hours: number
  percentage: number
  billable: boolean
}

export interface StaffWorkTypeMatrix {
  employee_id: string
  employee_name: string
  work_type_hours: Record<string, number> // key: level2_id, value: hours
  total_hours: number
}

export interface DashboardFilters {
  start_date?: string
  end_date?: string
  employee_id?: string
  project_id?: string
  client_name?: string
  work_type_level1_id?: string
  billable?: boolean | null
}

// ============================================
// API RESPONSES
// ============================================
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

// ============================================
// VALIDATION
// ============================================
export interface ValidationError {
  field: string
  message: string
}

export interface TimeEntryValidation {
  valid: boolean
  errors: ValidationError[]
}

// ============================================
// PERMISSIONS
// ============================================
export interface Permissions {
  canCreateEntry: boolean
  canEditEntry: boolean
  canDeleteEntry: boolean
  canSubmitWeek: boolean
  canApproveSubmission: boolean
  canRejectSubmission: boolean
  canUnlockSubmission: boolean
  canViewAllEntries: boolean
  canViewTeamEntries: boolean
  canExportData: boolean
  canManageProjects: boolean
  canManageUsers: boolean
}
