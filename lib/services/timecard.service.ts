// Timecard API Service Layer
// Handles all database operations and business logic

import { supabase } from '../supabase'
import type {
  TimeEntry,
  TimeEntryWithDetails,
  TimeEntryFormData,
  WeeklySubmission,
  WeeklySubmissionWithDetails,
  WorkType,
  WorkTypeLevel1,
  WorkTypeLevel2,
  Project,
  Client,
  ClientLocation,
  AuditLog,
  DashboardSummary,
  HoursByProject,
  HoursByClient,
  WorkTypeMix,
  StaffWorkTypeMatrix,
  DashboardFilters,
  UserRole,
  Permissions,
  ActiveWorkEntry
} from '../types/timecard.types'

// ============================================
// WORK TYPES SERVICE
// ============================================
export class WorkTypeService {
  static async getAll(): Promise<WorkType[]> {
    // This method is deprecated - use getGroupedByLevel1() instead
    // Kept for backward compatibility with existing code
    const { data, error } = await supabase
      .from('work_types')
      .select('*')
      .eq('active', true)
      .order('level1_id', { ascending: true })
      .order('level2_id', { ascending: true })

    if (error) throw error
    return data || []
  }

  static async getGroupedByLevel1(): Promise<WorkTypeLevel1[]> {
    // Fetch Level 1 work types
    const { data: level1Data, error: level1Error } = await supabase
      .from('work_type_level1')
      .select('id, code, name')
      .order('code')
    
    if (level1Error) throw level1Error
    
    return (level1Data || []).map(level1 => ({
      id: level1.id,
      code: level1.code,
      description: level1.name,
      level2Options: []
    }))
  }

  static async getLevel2ByLevel1(level1Id: string): Promise<WorkTypeLevel2[]> {
    if (!level1Id) {
      console.error('[getLevel2ByLevel1] level1_id is required but received:', level1Id)
      return []
    }
    const { data, error } = await supabase
      .from('work_type_level2')
      .select('id, code, name, billable')
      .eq('level1_id', level1Id)
      .order('code')
    
    if (error) throw error
    return (data || []).map(l2 => ({
      id: l2.id,
      level1_id: level1Id,
      code: l2.code,
      description: l2.name,
      billable: l2.billable,
      is_leave_type: false,
      active: true
    }))
  }

  static async getBillableFlag(level1_id: string, level2_id: string): Promise<boolean> {
    if (!level1_id || !level2_id) {
      console.error('[getBillableFlag] level1_id and level2_id are required but received:', { level1_id, level2_id })
      return false
    }
    const { data, error } = await supabase
      .from('work_type_level2')
      .select('billable')
      .eq('level1_id', level1_id)
      .eq('id', level2_id)
      .single()

    if (error) throw error
    return data?.billable ?? false
  }
}

// ============================================
// PROJECTS SERVICE
// ============================================
export class ProjectService {
  static async getAll(status?: string): Promise<Project[]> {
    let query = supabase
      .from('projects')
      .select('*')
      .order('client_name', { ascending: true })
      .order('project_name', { ascending: true })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  }

  static async getActive(): Promise<Project[]> {
    return this.getAll('active')
  }

  static async getById(id: string): Promise<Project | null> {
    if (!id) {
      console.error('[ProjectService.getById] id is required but received:', id)
      return null
    }
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  }

  static async create(project: Omit<Project, 'id' | 'created_at' | 'updated_at'>): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .insert([project])
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async update(id: string, updates: Partial<Project>): Promise<Project> {
    if (!id) {
      console.error('[ProjectService.update] id is required but received:', id)
      throw new Error('Project id is required for update operation')
    }
    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }
}

// ============================================
// CLIENTS SERVICE
// ============================================
export class ClientService {
  static async getAll(): Promise<Client[]> {
    const { data, error } = await supabase
      .from('clients')
      .select('*')

    if (error) throw error
    return data || []
  }
}

// ============================================
// CLIENT LOCATIONS SERVICE
// ============================================
export class ClientLocationService {
  static async getByClient(clientId: string): Promise<ClientLocation[]> {
    if (!clientId) {
      console.error('[ClientLocationService.getByClient] clientId is required but received:', clientId)
      return []
    }
    const { data, error } = await supabase
      .from('client_locations')
      .select('id, client_id, suburb')
      .eq('client_id', clientId)

    if (error) throw error
    return data || []
  }
}

// ============================================
// TIME ENTRIES SERVICE
// ============================================
export class TimeEntryService {
  static async getByEmployee(employeeId: string, startDate?: string, endDate?: string): Promise<TimeEntryWithDetails[]> {
    if (!employeeId) {
      console.error('[TimeEntryService.getByEmployee] employeeId is required but received:', employeeId)
      return []
    }
    let query = supabase
      .from('time_entries')
      .select(`
        *,
        projects:project_id (
          project_name,
          project_code,
          client_name
        )
      `)
      .eq('employee_id', employeeId)
      .order('entry_date', { ascending: false })

    if (startDate) {
      query = query.gte('entry_date', startDate)
    }
    if (endDate) {
      query = query.lte('entry_date', endDate)
    }

    const { data, error } = await query

    if (error) throw error

    // Transform to include work type descriptions
    const workTypes = await WorkTypeService.getAll()
    
    return (data || []).map(entry => {
      const workType = workTypes.find(
        wt => wt.level1_id === entry.work_type_level1_id && wt.level2_id === entry.work_type_level2_id
      )
      
      return {
        ...entry,
        employee_name: '', // Will be populated from user query
        employee_email: '',
        project_name: entry.projects?.project_name || null,
        project_code: entry.projects?.project_code || null,
        client_name: entry.projects?.client_name || null,
        work_type_level1_description: workType?.level1_description || '',
        work_type_level2_description: workType?.level2_description || ''
      }
    })
  }

  static async getByWeek(employeeId: string, weekStartDate: string): Promise<TimeEntryWithDetails[]> {
    const weekEndDate = new Date(weekStartDate)
    weekEndDate.setDate(weekEndDate.getDate() + 6)
    
    return this.getByEmployee(
      employeeId,
      weekStartDate,
      weekEndDate.toISOString().split('T')[0]
    )
  }

  static async getActiveWorkEntry(employeeId: string): Promise<ActiveWorkEntry | null> {
    if (!employeeId) {
      console.error('[TimeEntryService.getActiveWorkEntry] employeeId is required but received:', employeeId)
      return null
    }
    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('status', 'active')
      .is('end_time', null)
      .order('start_time', { ascending: false })
      .maybeSingle()

    if (error) throw error
    return data
  }

  static async startWork(payload: {
    employee_id: string
    client_id: string
    location_id: string
    level1_id: string
    level2_id: string
    billable: boolean
  }): Promise<ActiveWorkEntry> {
    // Validate required fields to prevent undefined values
    if (!payload.level1_id || !payload.level2_id) {
      throw new Error('level1_id and level2_id are required')
    }

    const { data, error } = await supabase
      .from('time_entries')
      .insert([
        {
          employee_id: payload.employee_id,
          client_id: payload.client_id,
          location_id: payload.location_id,
          level1_id: payload.level1_id,
          level2_id: payload.level2_id,
          billable: payload.billable,
          start_time: new Date().toISOString(),
          end_time: null,
          status: 'active'
        }
      ])
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async endWork(entryId: string, startTime: string): Promise<ActiveWorkEntry> {
    if (!entryId) {
      console.error('[TimeEntryService.endWork] entryId is required but received:', entryId)
      throw new Error('Entry id is required to end work')
    }
    const endTime = new Date().toISOString()
    const totalHours = Number(
      ((new Date(endTime).getTime() - new Date(startTime).getTime()) / 3600000).toFixed(2)
    )

    const { data, error } = await supabase
      .from('time_entries')
      .update({
        end_time: endTime,
        hours: totalHours,
        status: 'completed'
      })
      .eq('id', entryId)
      .select()
      .maybeSingle()

    if (error) throw error
    if (!data) throw new Error('No active work entry found to end.')

    return data
  }

  static async create(entry: TimeEntryFormData, userId: string): Promise<TimeEntry> {
    // Get billable flag from work type
    const billable = await WorkTypeService.getBillableFlag(
      entry.work_type_level1_id,
      entry.work_type_level2_id
    )

    const newEntry = {
      ...entry,
      employee_id: userId,
      billable,
      created_by: userId,
      updated_by: userId
    }

    const { data, error } = await supabase
      .from('time_entries')
      .insert([newEntry])
      .select()
      .single()

    if (error) throw error

    // Log audit
    await AuditService.log({
      table_name: 'time_entries',
      record_id: data.id,
      action: 'INSERT',
      changed_by: userId
    })

    return data
  }

  static async update(id: string, updates: Partial<TimeEntryFormData>, userId: string): Promise<TimeEntry> {
    if (!id) {
      console.error('[TimeEntryService.update] id is required but received:', id)
      throw new Error('Entry id is required for update operation')
    }
    // Get current entry for audit
    const { data: current } = await supabase
      .from('time_entries')
      .select('*')
      .eq('id', id)
      .single()

    // Update billable flag if work type changed
    let billable = current?.billable
    if (updates.work_type_level1_id && updates.work_type_level2_id) {
      billable = await WorkTypeService.getBillableFlag(
        updates.work_type_level1_id,
        updates.work_type_level2_id
      )
    }

    const { data, error } = await supabase
      .from('time_entries')
      .update({
        ...updates,
        billable,
        updated_by: userId
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Audit logging is handled by trigger

    return data
  }

  static async delete(id: string): Promise<void> {
    if (!id) {
      console.error('[TimeEntryService.delete] id is required but received:', id)
      throw new Error('Entry id is required for delete operation')
    }
    const { error } = await supabase
      .from('time_entries')
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  static async validateHours(employeeId: string, date: string, hours: number, excludeEntryId?: string): Promise<{ valid: boolean; message?: string }> {
    if (!employeeId || !date) {
      console.error('[TimeEntryService.validateHours] employeeId and date are required but received:', { employeeId, date })
      return { valid: false, message: 'Employee id and date are required' }
    }
    let query = supabase
      .from('time_entries')
      .select('hours')
      .eq('employee_id', employeeId)
      .eq('entry_date', date)

    if (excludeEntryId) {
      query = query.neq('id', excludeEntryId)
    }

    const { data, error } = await query

    if (error) throw error

    const totalHours = (data || []).reduce((sum, entry) => sum + entry.hours, 0) + hours

    if (totalHours > 16) {
      return {
        valid: false,
        message: `Total hours for ${date} would exceed 16 hours. Current total: ${totalHours - hours}h, attempting to add: ${hours}h`
      }
    }

    return { valid: true }
  }

  static validateHoursIncrement(hours: number): boolean {
    // Must be 0.25 increments (quarter hours)
    return (hours * 4) % 1 === 0
  }
}

// ============================================
// WEEKLY SUBMISSIONS SERVICE
// ============================================
export class WeeklySubmissionService {
  static async getByEmployee(employeeId: string): Promise<WeeklySubmission[]> {
    if (!employeeId) {
      console.error('[WeeklySubmissionService.getByEmployee] employeeId is required but received:', employeeId)
      return []
    }
    const { data, error } = await supabase
      .from('weekly_submissions')
      .select('*')
      .eq('employee_id', employeeId)
      .order('week_start_date', { ascending: false })

    if (error) throw error
    return data || []
  }

  static async getByWeek(employeeId: string, weekStartDate: string): Promise<WeeklySubmission | null> {
    if (!employeeId || !weekStartDate) {
      console.error('[WeeklySubmissionService.getByWeek] employeeId and weekStartDate are required but received:', { employeeId, weekStartDate })
      return null
    }
    const { data, error } = await supabase
      .from('weekly_submissions')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('week_start_date', weekStartDate)
      .single()

    if (error && error.code !== 'PGRST116') throw error // PGRST116 = not found
    return data
  }

  static async create(employeeId: string, weekStartDate: string): Promise<WeeklySubmission> {
    const weekEndDate = new Date(weekStartDate)
    weekEndDate.setDate(weekEndDate.getDate() + 6)

    // Calculate totals from time entries
    const entries = await TimeEntryService.getByWeek(employeeId, weekStartDate)
    const totalHours = entries.reduce((sum, e) => sum + e.hours, 0)
    const billableHours = entries.reduce((sum, e) => sum + (e.billable ? e.hours : 0), 0)

    const submission = {
      employee_id: employeeId,
      week_start_date: weekStartDate,
      week_end_date: weekEndDate.toISOString().split('T')[0],
      total_hours: totalHours,
      billable_hours: billableHours,
      status: 'draft' as const
    }

    const { data, error } = await supabase
      .from('weekly_submissions')
      .insert([submission])
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async submit(id: string, userId: string): Promise<WeeklySubmission> {
    if (!id) {
      console.error('[WeeklySubmissionService.submit] id is required but received:', id)
      throw new Error('Weekly submission id is required for submit operation')
    }
    const { data, error } = await supabase
      .from('weekly_submissions')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Link all time entries to this submission
    const submission = data as WeeklySubmission
    await supabase
      .from('time_entries')
      .update({ weekly_submission_id: id })
      .eq('employee_id', submission.employee_id)
      .gte('entry_date', submission.week_start_date)
      .lte('entry_date', submission.week_end_date)
      .is('weekly_submission_id', null)

    // Audit log
    await AuditService.log({
      table_name: 'weekly_submissions',
      record_id: id,
      action: 'SUBMIT',
      changed_by: userId
    })

    return data
  }

  static async approve(id: string, managerId: string, comments?: string): Promise<WeeklySubmission> {
    if (!id) {
      console.error('[WeeklySubmissionService.approve] id is required but received:', id)
      throw new Error('Weekly submission id is required for approve operation')
    }
    const { data, error } = await supabase
      .from('weekly_submissions')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: managerId,
        manager_comments: comments
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    await AuditService.log({
      table_name: 'weekly_submissions',
      record_id: id,
      action: 'APPROVE',
      changed_by: managerId,
      new_value: comments
    })

    return data
  }

  static async reject(id: string, managerId: string, comments: string): Promise<WeeklySubmission> {
    if (!id) {
      console.error('[WeeklySubmissionService.reject] id is required but received:', id)
      throw new Error('Weekly submission id is required for reject operation')
    }
    const { data, error } = await supabase
      .from('weekly_submissions')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: managerId,
        manager_comments: comments
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Unlink time entries so they can be edited
    const submission = data as WeeklySubmission
    await supabase
      .from('time_entries')
      .update({ weekly_submission_id: null })
      .eq('weekly_submission_id', id)

    await AuditService.log({
      table_name: 'weekly_submissions',
      record_id: id,
      action: 'REJECT',
      changed_by: managerId,
      new_value: comments
    })

    return data
  }

  static async unlock(id: string, managerId: string, reason: string): Promise<WeeklySubmission> {
    if (!id) {
      console.error('[WeeklySubmissionService.unlock] id is required but received:', id)
      throw new Error('Weekly submission id is required for unlock operation')
    }
    const { data, error } = await supabase
      .from('weekly_submissions')
      .update({
        status: 'draft'
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Unlink time entries
    await supabase
      .from('time_entries')
      .update({ weekly_submission_id: null })
      .eq('weekly_submission_id', id)

    await AuditService.log({
      table_name: 'weekly_submissions',
      record_id: id,
      action: 'UNLOCK',
      changed_by: managerId,
      new_value: reason
    })

    return data
  }
}

// ============================================
// AUDIT SERVICE
// ============================================
export class AuditService {
  static async log(
    entry: Omit<AuditLog, 'id' | 'changed_at' | 'ip_address' | 'user_agent' | 'field_name' | 'old_value' | 'new_value'>
      & Partial<Pick<AuditLog, 'field_name' | 'old_value' | 'new_value'>>
  ): Promise<void> {
    const { error } = await supabase
      .from('audit_logs')
      .insert([entry])

    if (error) throw error
  }

  static async getByRecord(tableName: string, recordId: string): Promise<AuditLog[]> {
    if (!tableName || !recordId) {
      console.error('[AuditService.getByRecord] tableName and recordId are required but received:', { tableName, recordId })
      return []
    }
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('table_name', tableName)
      .eq('record_id', recordId)
      .order('changed_at', { ascending: false })

    if (error) throw error
    return data || []
  }
}

// ============================================
// AUTHORIZATION SERVICE
// ============================================
export class AuthService {
  static async getUserRole(userId: string): Promise<UserRole | null> {
    if (!userId) {
      console.error('[AuthService.getUserRole] userId is required but received:', userId)
      return null
    }
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single()

    if (error) return null
    return data?.role || null
  }

  static async getPermissions(userId: string, role?: UserRole): Promise<Permissions> {
    const userRole = role || await this.getUserRole(userId)

    const permissions: Permissions = {
      canCreateEntry: false,
      canEditEntry: false,
      canDeleteEntry: false,
      canSubmitWeek: false,
      canApproveSubmission: false,
      canRejectSubmission: false,
      canUnlockSubmission: false,
      canViewAllEntries: false,
      canViewTeamEntries: false,
      canExportData: false,
      canManageProjects: false,
      canManageUsers: false
    }

    switch (userRole) {
      case 'admin':
        return {
          canCreateEntry: true,
          canEditEntry: true,
          canDeleteEntry: true,
          canSubmitWeek: true,
          canApproveSubmission: true,
          canRejectSubmission: true,
          canUnlockSubmission: true,
          canViewAllEntries: true,
          canViewTeamEntries: true,
          canExportData: true,
          canManageProjects: true,
          canManageUsers: true
        }

      case 'manager':
        return {
          canCreateEntry: true,
          canEditEntry: true,
          canDeleteEntry: false,
          canSubmitWeek: true,
          canApproveSubmission: true,
          canRejectSubmission: true,
          canUnlockSubmission: true,
          canViewAllEntries: false,
          canViewTeamEntries: true,
          canExportData: true,
          canManageProjects: false,
          canManageUsers: false
        }

      case 'staff':
        return {
          canCreateEntry: true,
          canEditEntry: true,
          canDeleteEntry: true,
          canSubmitWeek: true,
          canApproveSubmission: false,
          canRejectSubmission: false,
          canUnlockSubmission: false,
          canViewAllEntries: false,
          canViewTeamEntries: false,
          canExportData: false,
          canManageProjects: false,
          canManageUsers: false
        }

      case 'accountant':
        return {
          canCreateEntry: false,
          canEditEntry: false,
          canDeleteEntry: false,
          canSubmitWeek: false,
          canApproveSubmission: false,
          canRejectSubmission: false,
          canUnlockSubmission: false,
          canViewAllEntries: true,
          canViewTeamEntries: true,
          canExportData: true,
          canManageProjects: false,
          canManageUsers: false
        }

      default:
        return permissions
    }
  }
}

// ============================================
// DASHBOARD SERVICE
// ============================================
export class DashboardService {
  static async getSummary(filters: DashboardFilters): Promise<DashboardSummary> {
    let query = supabase
      .from('time_entries')
      .select('hours, billable, project_id')

    query = this.applyFilters(query, filters)

    const { data, error } = await query

    if (error) throw error

    const entries = data || []
    const totalHours = entries.reduce((sum, e) => sum + e.hours, 0)
    const billableHours = entries.reduce((sum, e) => sum + (e.billable ? e.hours : 0), 0)
    const nonBillableHours = totalHours - billableHours
    const uniqueProjects = new Set(entries.map(e => e.project_id).filter(Boolean)).size

    return {
      total_hours: totalHours,
      billable_hours: billableHours,
      non_billable_hours: nonBillableHours,
      billable_percentage: totalHours > 0 ? (billableHours / totalHours) * 100 : 0,
      total_entries: entries.length,
      active_projects: uniqueProjects
    }
  }

  static async getHoursByProject(filters: DashboardFilters): Promise<HoursByProject[]> {
    let query = supabase
      .from('time_entries')
      .select(`
        project_id,
        hours,
        billable,
        projects:project_id (
          project_code,
          project_name,
          client_name
        )
      `)
      .not('project_id', 'is', null)

    query = this.applyFilters(query, filters)

    const { data, error } = await query

    if (error) throw error

    const projectMap = new Map<string, HoursByProject>()

    ;(data || []).forEach(entry => {
      if (!entry.project_id || !entry.projects) return

      const projectDetails = Array.isArray(entry.projects)
        ? entry.projects[0]
        : entry.projects

      if (!projectDetails) return

      if (!projectMap.has(entry.project_id)) {
        projectMap.set(entry.project_id, {
          project_id: entry.project_id,
          project_code: projectDetails.project_code,
          project_name: projectDetails.project_name,
          client_name: projectDetails.client_name,
          total_hours: 0,
          billable_hours: 0,
          entry_count: 0
        })
      }

      const project = projectMap.get(entry.project_id)!
      project.total_hours += entry.hours
      if (entry.billable) {
        project.billable_hours += entry.hours
      }
      project.entry_count++
    })

    return Array.from(projectMap.values()).sort((a, b) => b.total_hours - a.total_hours)
  }

  static async getHoursByClient(filters: DashboardFilters): Promise<HoursByClient[]> {
    const projectHours = await this.getHoursByProject(filters)

    const clientMap = new Map<string, HoursByClient>()

    projectHours.forEach(project => {
      if (!clientMap.has(project.client_name)) {
        clientMap.set(project.client_name, {
          client_name: project.client_name,
          total_hours: 0,
          billable_hours: 0,
          project_count: 0,
          entry_count: 0
        })
      }

      const client = clientMap.get(project.client_name)!
      client.total_hours += project.total_hours
      client.billable_hours += project.billable_hours
      client.project_count++
      client.entry_count += project.entry_count
    })

    return Array.from(clientMap.values()).sort((a, b) => b.total_hours - a.total_hours)
  }

  static async getWorkTypeMix(filters: DashboardFilters): Promise<WorkTypeMix[]> {
    let query = supabase
      .from('time_entries')
      .select('work_type_level1_id, work_type_level2_id, hours, billable')

    query = this.applyFilters(query, filters)

    const { data, error } = await query

    if (error) throw error

    const workTypes = await WorkTypeService.getAll()
    const workTypeMap = new Map<string, WorkTypeMix>()
    const totalHours = (data || []).reduce((sum, e) => sum + e.hours, 0)

    ;(data || []).forEach(entry => {
      const key = `${entry.work_type_level1_id}-${entry.work_type_level2_id}`
      
      if (!workTypeMap.has(key)) {
        const wt = workTypes.find(
          w => w.level1_id === entry.work_type_level1_id && w.level2_id === entry.work_type_level2_id
        )
        
        workTypeMap.set(key, {
          work_type_level1_id: entry.work_type_level1_id,
          work_type_level1_description: wt?.level1_description || '',
          work_type_level2_id: entry.work_type_level2_id,
          work_type_level2_description: wt?.level2_description || '',
          total_hours: 0,
          percentage: 0,
          billable: entry.billable
        })
      }

      workTypeMap.get(key)!.total_hours += entry.hours
    })

    const result = Array.from(workTypeMap.values())
    result.forEach(wt => {
      wt.percentage = totalHours > 0 ? (wt.total_hours / totalHours) * 100 : 0
    })

    return result.sort((a, b) => b.total_hours - a.total_hours)
  }

  static async getStaffWorkTypeMatrix(filters: DashboardFilters): Promise<StaffWorkTypeMatrix[]> {
    let query = supabase
      .from('time_entries')
      .select('employee_id, work_type_level2_id, hours')

    query = this.applyFilters(query, filters)

    const { data, error } = await query

    if (error) throw error

    const staffMap = new Map<string, StaffWorkTypeMatrix>()

    ;(data || []).forEach(entry => {
      if (!staffMap.has(entry.employee_id)) {
        staffMap.set(entry.employee_id, {
          employee_id: entry.employee_id,
          employee_name: '', // Will be populated from user query
          work_type_hours: {},
          total_hours: 0
        })
      }

      const staff = staffMap.get(entry.employee_id)!
      if (!staff.work_type_hours[entry.work_type_level2_id]) {
        staff.work_type_hours[entry.work_type_level2_id] = 0
      }
      staff.work_type_hours[entry.work_type_level2_id] += entry.hours
      staff.total_hours += entry.hours
    })

    return Array.from(staffMap.values()).sort((a, b) => b.total_hours - a.total_hours)
  }

  private static applyFilters(query: any, filters: DashboardFilters): any {
    if (filters.start_date) {
      query = query.gte('entry_date', filters.start_date)
    }
    if (filters.end_date) {
      query = query.lte('entry_date', filters.end_date)
    }
    if (filters.employee_id) {
      query = query.eq('employee_id', filters.employee_id)
    }
    if (filters.project_id) {
      query = query.eq('project_id', filters.project_id)
    }
    if (filters.work_type_level1_id) {
      query = query.eq('work_type_level1_id', filters.work_type_level1_id)
    }
    if (filters.billable !== undefined && filters.billable !== null) {
      query = query.eq('billable', filters.billable)
    }
    return query
  }
}
