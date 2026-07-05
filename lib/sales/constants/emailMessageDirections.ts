export const SALES_EMAIL_MESSAGE_DIRECTIONS = ['outbound', 'inbound'] as const

export type SalesEmailMessageDirection = (typeof SALES_EMAIL_MESSAGE_DIRECTIONS)[number]

export const SALES_EMAIL_MESSAGE_IMPORT_SOURCES = ['graph_delta', 'manual'] as const

export type SalesEmailMessageImportSource = (typeof SALES_EMAIL_MESSAGE_IMPORT_SOURCES)[number]
