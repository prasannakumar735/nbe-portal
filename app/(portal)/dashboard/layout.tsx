/**
 * Dashboard segment under the portal shell. Global width, padding, and base font size
 * are applied in `app/(portal)/components/LayoutWrapper.tsx` and `app/globals.css`.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-w-0">{children}</div>
}
