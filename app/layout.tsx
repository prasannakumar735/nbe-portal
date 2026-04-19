import './globals.css'
import { headers } from 'next/headers'
import { AuthProvider } from './providers/AuthProvider'
import { RoleProvider } from './providers/RoleProvider'
import { ServiceWorkerRegister } from './components/ServiceWorkerRegister'
import { ToasterClient } from '@/components/ToasterClient'

/** Nonce-based CSP requires dynamic rendering so each response matches middleware `x-nonce`. */
export const dynamic = 'force-dynamic'

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Ensures dynamic rendering so HTML nonces align with middleware CSP (`x-nonce` on the request).
  await headers()

  return (
    <html lang="en" className="font-sans" suppressHydrationWarning>
      <body className="font-sans">
        <AuthProvider>
          <RoleProvider>
            <ServiceWorkerRegister />
            <ToasterClient />
            {children}
          </RoleProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
