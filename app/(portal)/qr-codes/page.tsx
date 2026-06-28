'use client';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/app/providers/AuthProvider';
import { createSupabaseClient } from '@/lib/supabase/client';
import { canApproveMaintenanceReport } from '@/lib/auth/roles';
import type { ClientLocationOption, ClientOption } from '@/lib/types/maintenance.types';
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { composeDoorServiceQrLabelPngDataUrl } from '@/lib/door/doorServiceQrLabel'
type DoorOption = {
    id: string;
    door_label: string;
    door_type: string;
};
export default function QrCodesPage() {
    const { profile, isLoading } = useAuth();
    const supabase = useMemo(() => createSupabaseClient(), []);
    const [clients, setClients] = useState<ClientOption[]>([]);
    const [locations, setLocations] = useState<ClientLocationOption[]>([]);
    const [doors, setDoors] = useState<DoorOption[]>([]);
    const [clientId, setClientId] = useState('');
    const [locationId, setLocationId] = useState('');
    const [doorId, setDoorId] = useState('');
    const [error, setError] = useState('');
    const [generatedLabelUrl, setGeneratedLabelUrl] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const isAllowed = canApproveMaintenanceReport(profile ?? undefined);
    const selectedDoor = doors.find(item => item.id === doorId);
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
    const qrTargetUrl = doorId ? `${baseUrl}/door/${encodeURIComponent(doorId)}` : '';
    const qrImageUrl = doorId ? `/api/qr/door/${encodeURIComponent(doorId)}` : '';
    useEffect(() => {
        const loadClients = async () => {
            try {
                const response = await fetch('/api/maintenance/clients', { cache: 'no-store' });
                const data = (await response.json()) as {
                    clients?: ClientOption[];
                };
                setClients(data.clients ?? []);
            }
            catch {
                setClients([]);
            }
        };
        void loadClients();
    }, []);
    useEffect(() => {
        const loadLocations = async () => {
            if (!clientId) {
                setLocations([]);
                setLocationId('');
                setDoors([]);
                setDoorId('');
                return;
            }
            try {
                const response = await fetch(`/api/maintenance/locations?clientId=${encodeURIComponent(clientId)}`, {
                    cache: 'no-store',
                });
                const data = (await response.json()) as {
                    locations?: ClientLocationOption[];
                };
                setLocations(data.locations ?? []);
            }
            catch {
                setLocations([]);
            }
            setLocationId('');
            setDoors([]);
            setDoorId('');
        };
        void loadLocations();
    }, [clientId]);
    useEffect(() => {
        const loadDoors = async () => {
            if (!locationId) {
                setDoors([]);
                setDoorId('');
                return;
            }
            const { data, error: queryError } = await supabase
                .from('doors')
                .select('id, door_label, door_type')
                .eq('client_location_id', locationId)
                .order('door_label', { ascending: true });
            if (queryError) {
                setDoors([]);
                setError('Failed to load doors for selected location.');
                return;
            }
            const options = (data ?? []).map(row => ({
                id: String(row.id ?? ''),
                door_label: String(row.door_label ?? '').trim() || 'Unnamed door',
                door_type: String(row.door_type ?? '').trim() || 'Door',
            }));
            setDoors(options);
            setDoorId('');
            setGeneratedLabelUrl('');
            setError('');
        };
        void loadDoors();
    }, [locationId, supabase]);
    useEffect(() => {
        setGeneratedLabelUrl('');
    }, [doorId]);
    const handleGenerate = async () => {
        if (!doorId || !qrImageUrl || !selectedDoor)
            return;
        setIsGenerating(true);
        setError('');
        try {
            const pngDataUrl = await composeDoorServiceQrLabelPngDataUrl({
                qrImageSrc: qrImageUrl,
                doorLabel: selectedDoor.door_label,
            });
            setGeneratedLabelUrl(pngDataUrl);
        }
        catch {
            setError('Failed to generate door QR label.');
            setGeneratedLabelUrl('');
        }
        finally {
            setIsGenerating(false);
        }
    };
    const handleDownload = () => {
        if (!generatedLabelUrl)
            return;
        try {
            const link = document.createElement('a');
            const safeDoorName = (selectedDoor?.door_label || 'door').replace(/\s+/g, '-').toLowerCase();
            link.href = generatedLabelUrl;
            link.download = `door-qr-${safeDoorName}.png`;
            link.click();
        }
        catch {
            setError('Failed to download QR code.');
        }
    };
    if (isLoading) {
        return <div className="py-6 text-sm text-slate-600">Loading...</div>;
    }
    if (!isAllowed) {
        return (<div className="py-6">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
          Only managers can generate door QR codes.
        </div>
      </div>);
    }
    return (<div className="w-full space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col items-center gap-3 text-center">
          <img src="/NBE_LOGO_BK_PL.png" alt="NBE Australia" className="h-24 w-auto object-contain"/>
          <h1 className="text-xl font-black tracking-wide text-slate-900">QR Code Generator</h1>
          <p className="text-sm text-slate-600">Generate printable industrial door QR codes.</p>
        </div>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">
            <div className="mt-1">
              <SearchableSelect
                id="qr-client"
                label="Client"
                value={clientId}
                onChange={(v) => setClientId(v)}
                options={(clients ?? []).map(c => ({ value: c.id, label: c.name }))}
                allowEmpty
                emptyLabel="Select client"
                placeholder="Search clients…"
              />
            </div>
          </label>

          <label className="text-sm font-medium text-slate-700">
            Location
            <select value={locationId} onChange={event => setLocationId(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3" disabled={!clientId}>
              <option value="">Select location</option>
              {locations.map(location => (<option key={location.id} value={location.id}>{location.name}</option>))}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700">
            Door
            <select value={doorId} onChange={event => setDoorId(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3" disabled={!locationId}>
              <option value="">Select door</option>
              {doors.map(door => (<option key={door.id} value={door.id}>{door.door_label} ({door.door_type})</option>))}
            </select>
          </label>
        </div>

        {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
      </section>

      {doorId && (<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
            {generatedLabelUrl ? (
              <img
                src={generatedLabelUrl}
                alt="Door service QR label"
                className="max-h-[28rem] w-auto max-w-full rounded-lg border border-slate-200 shadow-sm"
              />
            ) : (
              <p className="text-sm text-slate-600">
                Generate a label to place the door QR code on the NBE service template and fill in the serial number.
              </p>
            )}

            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={isGenerating}
                onClick={() => void handleGenerate()}
                className="h-11 flex-1 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGenerating ? 'Generating…' : 'Generate QR Code'}
              </button>
              {generatedLabelUrl ? (
                <>
                  <a
                    href={qrTargetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Open door link
                  </a>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="h-11 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Download label
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </section>)}
    </div>);
}
