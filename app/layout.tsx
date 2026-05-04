import './globals.css';
import { headers } from 'next/headers';
import { AuthProvider } from './providers/AuthProvider';
import { RoleProvider } from './providers/RoleProvider';
import { ServiceWorkerRegister } from './components/ServiceWorkerRegister';
import { ToasterClient } from '@/components/ToasterClient';
export const dynamic = 'force-dynamic';
export default async function RootLayout({ children, }: {
    children: React.ReactNode;
}) {
    await headers();
    return (<html lang="en" className="font-sans" suppressHydrationWarning>
      <body className="font-sans">
        <AuthProvider>
          <RoleProvider>
            <ServiceWorkerRegister />
            <ToasterClient />
            {children}
          </RoleProvider>
        </AuthProvider>
      </body>
    </html>);
}
