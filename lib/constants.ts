/** Base depot for OSRM travel time (Campbellfield). */
export const BASE_LOCATION = {
  label: '22A Humeside Drive, Campbellfield VIC 3061',
  lat: -37.6636,
  lng: 144.9596,
} as const

/** Nominatim requests must identify the app (see Nominatim usage policy). */
export const GEO_USER_AGENT = 'NBE-Portal/1.0 (field-service calendar)'

export const CALENDAR_DAY_START_HOUR = 7
export const CALENDAR_DAY_END_HOUR = 18
export const CALENDAR_SLOT_MINUTES = 30
/** Pixel height of one calendar slot (30 minutes). Used with duration for block height. */
export const CALENDAR_SLOT_HEIGHT_PX = 48
