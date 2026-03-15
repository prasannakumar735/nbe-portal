export type ServiceLineItem = {
  description: string
  width: string
  height: string
  qty: number
  unitPrice: number
}

export type ServiceQuoteFormValues = {
  quoteNumber: string
  serviceDate: string
  companyName: string
  abn: string
  companyAddress: string
  companyEmail: string
  customerCompany: string
  contactPerson: string
  phone: string
  customerEmail: string
  siteAddress: string
  items: ServiceLineItem[]
  notes: string
  printedName: string
  signatureDate: string
}