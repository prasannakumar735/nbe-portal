import type { Contact } from '@/lib/types/contact.types'

type BusinessCardProps = {
  contact: Pick<Contact, 'first_name' | 'last_name' | 'company' | 'phone' | 'email' | 'street' | 'city' | 'state' | 'postcode' | 'country' | 'website'>
  qrDataUrl: string
  backgroundImageUrl?: string
  logoUrl?: string
}

function compactAddress(contact: BusinessCardProps['contact']): string {
  const parts = [contact.street, contact.city, contact.state, contact.postcode, contact.country]
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(Boolean)

  return parts.join(', ')
}

export default function BusinessCard({ contact, qrDataUrl, backgroundImageUrl, logoUrl }: BusinessCardProps) {
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() || 'Contact'
  const company = contact.company?.trim() || 'NBE Australia'
  const address = compactAddress(contact)
  const website = contact.website?.trim() || 'www.nbeaustralia.com.au'

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        background: '#f6f1e8',
        color: '#2f2f36',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      {backgroundImageUrl ? (
        <img
          src={backgroundImageUrl}
          alt="Business card template"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.28,
          }}
        />
      ) : null}

      <div style={{ display: 'flex', width: '100%', height: '100%', position: 'relative', padding: '36px 42px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, paddingRight: 28 }}>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="NBE Australia"
              style={{ width: 360, height: 120, objectFit: 'contain' }}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', color: '#d61fb2', fontSize: 66, fontWeight: 700, letterSpacing: 1 }}>NBE</div>
              <div style={{ display: 'flex', color: '#63636f', fontSize: 30, marginTop: -8, fontWeight: 700, letterSpacing: 6 }}>AUSTRALIA</div>
            </div>
          )}

          <div style={{ marginTop: 22, color: '#d61fb2', fontSize: 32, lineHeight: 1.2, display: 'flex', flexDirection: 'column' }}>
            <span>High Impact Doors</span>
            <span>Rapid Opening Doors</span>
            <span>PVC Strip Doors</span>
          </div>

          <div style={{ marginTop: 34, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 62, fontWeight: 500 }}>{name}</div>
            {contact.phone ? <div style={{ display: 'flex', fontSize: 48, marginTop: 6 }}>Mob {contact.phone}</div> : null}
          </div>

          <div style={{ marginTop: 28, fontSize: 36, lineHeight: 1.25, display: 'flex', flexDirection: 'column' }}>
            <span>{company}</span>
            {address ? <span>{address}</span> : null}
            {contact.email ? <span>{contact.email}</span> : null}
            <span>{website}</span>
          </div>
        </div>

        <div
          style={{
            width: 300,
            borderLeft: '2px solid #dfd6c8',
            paddingLeft: 16,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <img
            src={qrDataUrl}
            alt="Contact QR"
            style={{ width: 190, height: 190, background: '#fff', padding: 8 }}
          />
          <div
            style={{
              width: 280,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              marginLeft: -8,
              fontSize: 14,
              color: '#a5328b',
              lineHeight: 1.2,
            }}
          >
            <span
              style={{
                display: 'flex',
                maxWidth: '100%',
                whiteSpace: 'nowrap',
              }}
            >
              22A Humeside Drive, Campbellfield 3061
            </span>
            <span
              style={{
                display: 'flex',
                maxWidth: '100%',
                whiteSpace: 'nowrap',
              }}
            >
              {contact.email || ''}
            </span>
            <span
              style={{
                display: 'flex',
                maxWidth: '100%',
                whiteSpace: 'nowrap',
              }}
            >
              {website}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
