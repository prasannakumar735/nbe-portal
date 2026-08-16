import type { SalesGeneratedEmail } from '@/lib/sales/types/generatedEmail.types'

export type GeneratedEmailReviewAction = 'approve' | 'reject' | 'edit'

export type GeneratedEmailBulkReviewFailure = {
  emailId: string
  reason: string
}

export type GeneratedEmailBulkReviewResult = {
  succeeded: SalesGeneratedEmail[]
  failed: GeneratedEmailBulkReviewFailure[]
}

export type ApproveGeneratedEmailResult = SalesGeneratedEmail

export type RejectGeneratedEmailResult = SalesGeneratedEmail

export type EditGeneratedEmailResult = SalesGeneratedEmail
