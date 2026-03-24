export type ContactStatus = 'active' | 'inactive'
export type ContactQrType = 'vcard' | 'dynamic'

export type Contact = {
  id: string
  slug: string
  first_name: string
  last_name: string
  company: string | null
  title: string | null
  phone: string | null
  email: string | null
  website?: string | null
  street?: string | null
  city?: string | null
  state?: string | null
  postcode?: string | null
  country?: string | null
  status: ContactStatus
  qr_type: ContactQrType
  created_at: string
  profile_image_url?: string | null
  company_logo_url?: string | null
}

export type ContactInput = Omit<Contact, 'id' | 'created_at'>
