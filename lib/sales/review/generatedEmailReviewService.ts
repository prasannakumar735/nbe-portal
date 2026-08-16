import type { SupabaseClient } from '@supabase/supabase-js'
import {
  approveSalesGeneratedEmail,
  bulkApproveSalesGeneratedEmails,
  bulkRejectSalesGeneratedEmails,
  editSalesGeneratedEmail,
  rejectSalesGeneratedEmail,
} from '@/lib/sales/repositories/salesGeneratedEmailRepository'
import type {
  ApproveGeneratedEmailResult,
  EditGeneratedEmailResult,
  GeneratedEmailBulkReviewResult,
  RejectGeneratedEmailResult,
} from '@/lib/sales/types/generatedEmailReview.types'

export type GeneratedEmailReviewContext = {
  reviewedBy: string
}

export async function approveGeneratedEmail(
  supabase: SupabaseClient,
  emailId: string,
  context: GeneratedEmailReviewContext,
): Promise<ApproveGeneratedEmailResult> {
  return approveSalesGeneratedEmail(supabase, emailId, context.reviewedBy)
}

export async function rejectGeneratedEmail(
  supabase: SupabaseClient,
  emailId: string,
  context: GeneratedEmailReviewContext,
): Promise<RejectGeneratedEmailResult> {
  return rejectSalesGeneratedEmail(supabase, emailId, context.reviewedBy)
}

export async function editGeneratedEmail(
  supabase: SupabaseClient,
  emailId: string,
  input: { subject: string; body: string },
  _context: GeneratedEmailReviewContext,
): Promise<EditGeneratedEmailResult> {
  return editSalesGeneratedEmail(supabase, emailId, {
    subject: input.subject,
    body: input.body,
  })
}

export async function bulkApproveGeneratedEmails(
  supabase: SupabaseClient,
  emailIds: string[],
  context: GeneratedEmailReviewContext,
): Promise<GeneratedEmailBulkReviewResult> {
  return bulkApproveSalesGeneratedEmails(supabase, emailIds, context.reviewedBy)
}

export async function bulkRejectGeneratedEmails(
  supabase: SupabaseClient,
  emailIds: string[],
  context: GeneratedEmailReviewContext,
): Promise<GeneratedEmailBulkReviewResult> {
  return bulkRejectSalesGeneratedEmails(supabase, emailIds, context.reviewedBy)
}
