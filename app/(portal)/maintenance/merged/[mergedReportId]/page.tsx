'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/providers/AuthProvider';
import { canApproveMaintenanceReport } from '@/lib/auth/roles';

export default function MergedReportViewPage() {
  const params = useParams();
  const { profile } = useAuth();
  const mergedReportId =
    typeof params.mergedReportId === 'string' ? params.mergedReportId : null;

  const canView = canApproveMaintenanceReport(profile ?? undefined);

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const blobRef = useRef<string | null>(null);

  useEffect(() => {
    if (!canView || !mergedReportId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const src = `/api/maintenance/merged-reports/${encodeURIComponent(mergedReportId)}/pdf?inline=1`;

    fetch(src)
      .then(async (res) => {
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error((json as { error?: string }).error ?? `Failed to load PDF (${res.status})`);
        }
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        blobRef.current = url;
        setBlobUrl(url);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load PDF');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = null;
      }
    };
  }, [canView, mergedReportId]);

  if (!canView) {
    return (
      <div className="mx-auto w-full max-w-screen-md px-4 py-8">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          You do not have permission to view this report.
        </div>
        <Link href="/maintenance" className="mt-4 inline-block text-slate-600 underline">
          Back to Maintenance Reports
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3" style={{ height: 'calc(100vh - 6rem)' }}>
      <Link
        href="/maintenance"
        className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
      >
        <span className="material-symbols-outlined text-base" aria-hidden>
          arrow_back
        </span>
        Back to Maintenance Reports
      </Link>

      <div className="flex-1 overflow-hidden rounded-xl border border-slate-200 shadow-sm">
        {loading && (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Loading report…
          </div>
        )}
        {!loading && error && (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
            <Link href="/maintenance" className="text-sm text-slate-600 underline">
              Back to Maintenance Reports
            </Link>
          </div>
        )}
        {!loading && blobUrl && (
          <iframe
            src={blobUrl}
            title="Merged Maintenance Report"
            className="h-full w-full"
            style={{ border: 'none' }}
          />
        )}
      </div>
    </div>
  );
}
