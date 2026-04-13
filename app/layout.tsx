import './globals.css'
import { AuthProvider } from './providers/AuthProvider'
import { RoleProvider } from './providers/RoleProvider'
import { ServiceWorkerRegister } from './components/ServiceWorkerRegister'
import { ToasterClient } from '@/components/ToasterClient'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="font-sans" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght@100..700&display=swap"
          rel="stylesheet"
        />
      </head>
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
