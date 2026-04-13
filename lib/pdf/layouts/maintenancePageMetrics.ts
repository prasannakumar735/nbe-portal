import { rgb } from 'pdf-lib'

/** A4 width/height in PDF points (pdf-lib default). */
export const PAGE_WIDTH = 595.28
export const PAGE_HEIGHT = 841.89
export const MARGIN = 50
export const HEADER_HEIGHT = 180
export const FOOTER_MARGIN = 40
/** Minimum baseline Y before starting a new content row/block (room above footer). */
export const PAGE_BREAK_Y = FOOTER_MARGIN + 82
/** Max thumbnail box edge (points); ~100 CSS px — keeps photos from dominating the page. */
export const PHOTO_THUMB_MAX_PT = 76

export const SECTION_COLOR = rgb(0.08, 0.14, 0.38)
/** Table header — gray-100 */
export const HEADER_FILL = rgb(0.96, 0.97, 0.98)
/** Alternating row — gray-50 */
export const ROW_ALT_FILL = rgb(0.98, 0.99, 0.99)
export const BORDER_LIGHT = rgb(0.86, 0.88, 0.91)
/** Tailwind gray-300 #d1d5db — horizontal rule below report header (matches UI ReportHeader) */
export const HEADER_RULE_GRAY = rgb(209 / 255, 213 / 255, 219 / 255)

/** Checklist column header text (Tailwind-ish) */
export const HDR_ITEM = rgb(0.28, 0.3, 0.34)
export const HDR_GOOD = rgb(0.05, 0.45, 0.28)
export const HDR_CAUTION = rgb(0.72, 0.52, 0.02)
export const HDR_FAULT = rgb(0.82, 0.18, 0.14)
export const HDR_NA = rgb(0.45, 0.48, 0.52)

/** Active cell tints */
export const CELL_GOOD = rgb(0.93, 0.98, 0.95)
export const CELL_CAUTION = rgb(1, 0.98, 0.9)
export const CELL_FAULT = rgb(0.99, 0.94, 0.94)
export const CELL_NA = rgb(0.96, 0.97, 0.98)

/** Status marks (body) */
export const MARK_GOOD = rgb(0.05, 0.52, 0.32)
export const MARK_CAUTION = rgb(0.75, 0.55, 0.05)
export const MARK_FAULT = rgb(0.86, 0.2, 0.16)
export const MARK_NA = rgb(0.5, 0.52, 0.56)

/**
 * Compact spacing (PDF points). ~1pt ≈ 1.33px at 96dpi — tuned for engineering-report density.
 * Section ≈ mt-4 / mb-4, title→table ≈ mt-1.
 */
export const DOOR_TITLE_GAP = 14
export const DOOR_META_SIZE = 8
export const DOOR_META_BOTTOM = 10
export const SECTION_FIRST_TOP = 9
export const SECTION_GAP_BETWEEN = 11
export const SECTION_TITLE_TO_TABLE = 6
export const TABLE_SECTION_TAIL = 11
export const CHECKLIST_ROW_HEIGHT = 16
export const CHECKLIST_HEADER_HEIGHT = 17
export const CHECKLIST_BODY_FONT = 9
export const CHECKLIST_HEADER_FONT = 8
export const CHECKLIST_ITEM_COL = 297
export const CHECKLIST_STAT_COL = 49.5

/** Label column width (~200 CSS px → PDF points). */
export const CUSTOMER_LABEL_WIDTH = 150
export const CUSTOMER_COL_GAP = 8
export const CUSTOMER_LINE_HEIGHT = 11
export const CUSTOMER_ROW_GAP = 4
