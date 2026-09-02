'use client';
import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useAuth } from '@/app/providers/AuthProvider';
import type { ClientLocationRecord, ClientOption, ClientRecord, ClientLocationOption, DoorRecord } from '@/lib/types/maintenance.types';
import { createClientSchema, csvDoorRowSchema, csvLocationRowSchema } from '@/lib/validation/admin-clients';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { compareDoorRecordsByLabel } from '@/lib/door/doorLabelSort';
type TabKey = 'clients' | 'locations' | 'doors';
type ApiResult<T> = {
    ok: true;
    data: T;
} | {
    ok: false;
    error?: string;
};
type CsvImportPreview = {
    inserted: number;
    skipped: number;
    to_create: number;
    errors: Array<{
        rowIndex: number;
        message: string;
    }>;
    preview: Array<Record<string, unknown>>;
};
type LocationCsvImportPreview = {
    inserted: number;
    skipped: number;
    duplicates: number;
    to_create: number;
    errors: Array<{
        rowIndex: number;
        message: string;
    }>;
    preview: Array<Record<string, unknown>>;
};
const TABS: Array<{
    key: TabKey;
    label: string;
}> = [
    { key: 'clients', label: 'Clients' },
    { key: 'locations', label: 'Locations' },
    { key: 'doors', label: 'Doors' },
];
const locationCsvTemplateHeaders = [
    'client_name',
    'location_name',
    'Company_address',
    'suburb',
];
const csvTemplateHeaders = [
    'client_name',
    'location_name',
    'door_label',
    'door_serial',
    'door_type',
    'door_description',
    'door_type_alt',
    'cw',
    'ch',
    'install_date',
];
const locationFormSchema = z.object({
    client_id: z.string().uuid('Client is required'),
    location_name: z.string().trim().min(1, 'Location name is required'),
    Company_address: z.string().trim().min(1, 'Address is required'),
    suburb: z.string().optional(),
});
const doorFormSchema = z.object({
    client_location_id: z.string().uuid('Location is required'),
    door_label: z.string().trim().min(1, 'Door label is required'),
    door_serial: z.string().optional(),
    door_type: z.string().trim().min(1, 'Door type is required'),
    door_description: z.string().optional(),
    door_type_alt: z.string().optional(),
    cw: z.string().optional(),
    ch: z.string().optional(),
    install_date: z.string().optional(),
});
export default function AdminClientsPage() {
    const { isAdmin, isManager } = useAuth();
    const canEdit = isAdmin || isManager;
    const [activeTab, setActiveTab] = useState<TabKey>('clients');
    const [loading, setLoading] = useState(true);
    const [clients, setClients] = useState<ClientRecord[]>([]);
    const [locations, setLocations] = useState<ClientLocationRecord[]>([]);
    const [doors, setDoors] = useState<DoorRecord[]>([]);
    const [selectedClientId, setSelectedClientId] = useState('');
    const [selectedLocationId, setSelectedLocationId] = useState('');
    const [clientSearch, setClientSearch] = useState('');
    const [locationSearch, setLocationSearch] = useState('');
    const [doorSearch, setDoorSearch] = useState('');
    const [editingClientId, setEditingClientId] = useState<string | null>(null);
    const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
    const [editingDoor, setEditingDoor] = useState<DoorRecord | null>(null);
    const [showDoorModal, setShowDoorModal] = useState(false);
    const [showCsvModal, setShowCsvModal] = useState(false);
    const [csvRows, setCsvRows] = useState<Array<z.infer<typeof csvDoorRowSchema>>>([]);
    const [csvRawRows, setCsvRawRows] = useState<Array<Record<string, string>>>([]);
    const [csvPreview, setCsvPreview] = useState<CsvImportPreview | null>(null);
    const [csvLoading, setCsvLoading] = useState(false);
    const [csvImportProgress, setCsvImportProgress] = useState<number | null>(null);
    const [csvFailedRows, setCsvFailedRows] = useState<Array<Record<string, string>>>([]);
    const [csvImportRan, setCsvImportRan] = useState(false);

    const [showLocationCsvModal, setShowLocationCsvModal] = useState(false);
    const [locationCsvRows, setLocationCsvRows] = useState<Array<z.infer<typeof csvLocationRowSchema>>>([]);
    const [locationCsvRawRows, setLocationCsvRawRows] = useState<Array<Record<string, string>>>([]);
    const [locationCsvPreview, setLocationCsvPreview] = useState<LocationCsvImportPreview | null>(null);
    const [locationCsvLoading, setLocationCsvLoading] = useState(false);
    const [locationCsvImportProgress, setLocationCsvImportProgress] = useState<number | null>(null);
    const [locationCsvFailedRows, setLocationCsvFailedRows] = useState<Array<Record<string, string>>>([]);
    const [locationCsvImportRan, setLocationCsvImportRan] = useState(false);

    const [doorModalClientId, setDoorModalClientId] = useState('');
    const [doorModalLocations, setDoorModalLocations] = useState<ClientLocationRecord[]>([]);
    const clientForm = useForm<z.infer<typeof createClientSchema>>({
        resolver: zodResolver(createClientSchema),
        defaultValues: { client_name: '' },
    });
    const locationForm = useForm<z.infer<typeof locationFormSchema>>({
        resolver: zodResolver(locationFormSchema),
        defaultValues: {
            client_id: '',
            location_name: '',
            Company_address: '',
            suburb: '',
        },
    });
    const doorForm = useForm<z.infer<typeof doorFormSchema>>({
        resolver: zodResolver(doorFormSchema),
        defaultValues: {
            client_location_id: '',
            door_label: '',
            door_serial: '',
            door_type: '',
            door_description: '',
            door_type_alt: '',
            cw: '',
            ch: '',
            install_date: '',
        },
    });
    const clientOptions: ClientOption[] = useMemo(() => clients.map(item => ({ id: item.id, name: item.client_name })), [clients]);
    const filteredLocationsForClient: ClientLocationOption[] = useMemo(() => {
        const list = locations.filter(item => item.client_id === selectedClientId || !selectedClientId);
        return list.map(item => ({
            id: item.id,
            client_id: item.client_id,
            name: item.location_name,
            address: item.Company_address ?? '',
        }));
    }, [locations, selectedClientId]);
    const visibleClients = useMemo(() => {
        const term = clientSearch.trim().toLowerCase();
        if (!term)
            return clients;
        return clients.filter(item => item.client_name.toLowerCase().includes(term));
    }, [clients, clientSearch]);
    const visibleLocations = useMemo(() => {
        const term = locationSearch.trim().toLowerCase();
        const byClient = locations.filter(item => !selectedClientId || item.client_id === selectedClientId);
        if (!term)
            return byClient;
        return byClient.filter(item => [item.location_name, item.Company_address ?? '', item.suburb ?? '']
            .join(' ')
            .toLowerCase()
            .includes(term));
    }, [locations, locationSearch, selectedClientId]);
    const visibleDoors = useMemo(() => {
        const term = doorSearch.trim().toLowerCase();
        const byLocation = doors.filter(item => !selectedLocationId || item.client_location_id === selectedLocationId);
        const filtered = !term
            ? byLocation
            : byLocation.filter(item => [item.door_label, item.door_serial ?? '', item.door_type, item.door_description ?? '', item.door_type_alt ?? '', item.cw ?? '', item.ch ?? '']
                .join(' ')
                .toLowerCase()
                .includes(term));
        return [...filtered].sort(compareDoorRecordsByLabel);
    }, [doors, doorSearch, selectedLocationId]);
    async function fetchJson<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
        const response = await fetch(url, init);
        const raw = await response.json().catch(() => ({}));
        const body = raw as {
            ok?: boolean;
            data?: T;
            error?: string;
        };
        if (!response.ok) {
            return { ok: false, error: body.error ?? 'Request failed' };
        }
        if (body.ok === true && body.data !== undefined) {
            return { ok: true, data: body.data };
        }
        if (body.ok === false) {
            return { ok: false, error: body.error ?? 'Request failed' };
        }
        return { ok: false, error: 'Unexpected response' };
    }
    async function loadClients() {
        const response = await fetch('/api/maintenance/clients', { cache: 'no-store' });
        const payload = (await response.json().catch(() => ({}))) as {
            clients?: ClientOption[];
        };
        const list = (payload.clients ?? []).map(item => ({
            id: item.id,
            client_name: item.name,
            created_at: null,
        }));
        setClients(list);
    }
    async function fetchLocationsForClient(clientId: string): Promise<ClientLocationRecord[]> {
        if (!clientId) {
            return [];
        }
        const response = await fetch(`/api/maintenance/locations?clientId=${encodeURIComponent(clientId)}`, { cache: 'no-store' });
        const payload = (await response.json().catch(() => ({}))) as {
            locations?: ClientLocationOption[];
        };
        return (payload.locations ?? []).map(item => ({
            id: item.id,
            client_id: item.client_id,
            location_name: item.name,
            Company_address: item.address,
            suburb: item.suburb ?? null,
            created_at: null,
        }));
    }
    async function loadLocations(clientId: string) {
        if (!clientId) {
            setLocations([]);
            return;
        }
        const list = await fetchLocationsForClient(clientId);
        setLocations(list);
    }
    async function loadDoors(locationId: string) {
        if (!locationId) {
            setDoors([]);
            return;
        }
        const response = await fetch(`/api/maintenance/doors?locationId=${encodeURIComponent(locationId)}`, { cache: 'no-store' });
        const payload = (await response.json().catch(() => ({}))) as {
            doors?: DoorRecord[];
        };
        setDoors(payload.doors ?? []);
    }
    useEffect(() => {
        let active = true;
        const run = async () => {
            setLoading(true);
            try {
                await loadClients();
            }
            catch (error) {
                if (active)
                    toast.error(error instanceof Error ? error.message : 'Failed to load clients');
            }
            finally {
                if (active)
                    setLoading(false);
            }
        };
        void run();
        return () => {
            active = false;
        };
    }, []);
    useEffect(() => {
        if (!selectedClientId) {
            setLocations([]);
            setSelectedLocationId('');
            setDoors([]);
            return;
        }
        locationForm.setValue('client_id', selectedClientId, { shouldValidate: false });
        void loadLocations(selectedClientId);
    }, [selectedClientId, locationForm]);
    useEffect(() => {
        if (!selectedLocationId) {
            setDoors([]);
            return;
        }
        void loadDoors(selectedLocationId);
    }, [selectedLocationId]);
    async function onSubmitClient(values: z.infer<typeof createClientSchema>) {
        if (!canEdit)
            return;
        const wasEditing = Boolean(editingClientId);
        const url = editingClientId ? `/api/admin/clients/${editingClientId}` : '/api/admin/clients';
        const method = editingClientId ? 'PATCH' : 'POST';
        const result = await fetchJson<ClientRecord>(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(values),
        });
        if (!result.ok) {
            toast.error(result.error ?? 'Failed to save client');
            return;
        }
        const saved = result.data;
        setEditingClientId(null);
        clientForm.reset({ client_name: '' });
        await loadClients();
        if (!wasEditing && saved?.id) {
            setSelectedClientId(saved.id);
            setActiveTab('locations');
            locationForm.reset({
                client_id: saved.id,
                location_name: '',
                Company_address: '',
                suburb: '',
            });
            toast.success('Client created — add a location below.');
        }
        else {
            toast.success(wasEditing ? 'Client updated' : 'Client saved');
        }
    }
    async function onSubmitLocation(values: z.infer<typeof locationFormSchema>) {
        if (!canEdit)
            return;
        const url = editingLocationId ? `/api/admin/client-locations/${editingLocationId}` : '/api/admin/client-locations';
        const method = editingLocationId ? 'PATCH' : 'POST';
        const body = editingLocationId
            ? { location_name: values.location_name, Company_address: values.Company_address, suburb: values.suburb }
            : values;
        const result = await fetchJson<ClientLocationRecord>(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!result.ok) {
            toast.error(result.error ?? 'Failed to save location');
            return;
        }
        toast.success(editingLocationId ? 'Location updated' : 'Location created');
        setEditingLocationId(null);
        locationForm.reset({
            client_id: selectedClientId || '',
            location_name: '',
            Company_address: '',
            suburb: '',
        });
        if (selectedClientId)
            await loadLocations(selectedClientId);
    }
    async function onSubmitDoor(values: z.infer<typeof doorFormSchema>) {
        if (!canEdit)
            return;
        const url = editingDoor ? `/api/admin/doors/${editingDoor.id}` : '/api/admin/doors';
        const method = editingDoor ? 'PATCH' : 'POST';
        const result = await fetchJson<DoorRecord>(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(values),
        });
        if (!result.ok) {
            toast.error(result.error ?? 'Failed to save door');
            return;
        }
        toast.success(editingDoor ? 'Door updated (registry only; approved reports unchanged)' : 'Door created');
        closeDoorModal();
        doorForm.reset({
            client_location_id: selectedLocationId || '',
            door_label: '',
            door_serial: '',
            door_type: '',
            door_description: '',
            door_type_alt: '',
            cw: '',
            ch: '',
            install_date: '',
        });
        if (selectedLocationId)
            await loadDoors(selectedLocationId);
    }
    async function handleDeleteClient(id: string) {
        if (!canEdit)
            return;
        if (!window.confirm('Delete this client? This only works when no locations are attached.'))
            return;
        const result = await fetchJson<{
            id: string;
        }>(`/api/admin/clients/${id}`, { method: 'DELETE' });
        if (!result.ok) {
            toast.error(result.error ?? 'Failed to delete client');
            return;
        }
        toast.success('Client deleted');
        await loadClients();
        if (selectedClientId === id)
            setSelectedClientId('');
    }
    async function handleDeleteLocation(id: string) {
        if (!canEdit)
            return;
        if (!window.confirm('Delete this location? This only works when no doors are attached.'))
            return;
        const result = await fetchJson<{
            id: string;
        }>(`/api/admin/client-locations/${id}`, { method: 'DELETE' });
        if (!result.ok) {
            toast.error(result.error ?? 'Failed to delete location');
            return;
        }
        toast.success('Location deleted');
        if (selectedClientId)
            await loadLocations(selectedClientId);
        if (selectedLocationId === id)
            setSelectedLocationId('');
    }
    async function handleDeleteDoor(id: string) {
        if (!canEdit)
            return;
        if (!window.confirm('Delete this door?'))
            return;
        const result = await fetchJson<{
            id: string;
        }>(`/api/admin/doors/${id}`, { method: 'DELETE' });
        if (!result.ok) {
            toast.error(result.error ?? 'Failed to delete door');
            return;
        }
        toast.success('Door deleted');
        if (selectedLocationId)
            await loadDoors(selectedLocationId);
    }
    function startEditClient(client: ClientRecord) {
        setEditingClientId(client.id);
        clientForm.reset({ client_name: client.client_name });
    }
    function startEditLocation(location: ClientLocationRecord) {
        setEditingLocationId(location.id);
        locationForm.reset({
            client_id: location.client_id,
            location_name: location.location_name,
            Company_address: location.Company_address ?? '',
            suburb: location.suburb ?? '',
        });
    }
    function closeDoorModal() {
        setShowDoorModal(false);
        setEditingDoor(null);
        setDoorModalClientId('');
        setDoorModalLocations([]);
    }
    async function prepareDoorModal(clientId: string, formValues: z.infer<typeof doorFormSchema>) {
        setDoorModalClientId(clientId);
        const list = clientId ? await fetchLocationsForClient(clientId) : [];
        setDoorModalLocations(list);
        const locationId = formValues.client_location_id;
        const validLocation = list.some(item => item.id === locationId);
        doorForm.reset({
            ...formValues,
            client_location_id: validLocation ? locationId : '',
        });
    }
    async function onDoorModalClientChange(clientId: string) {
        setDoorModalClientId(clientId);
        const list = clientId ? await fetchLocationsForClient(clientId) : [];
        setDoorModalLocations(list);
        const currentLoc = doorForm.getValues('client_location_id');
        if (!list.some(item => item.id === currentLoc)) {
            doorForm.setValue('client_location_id', '', { shouldValidate: true });
        }
    }
    async function openCreateDoorModal() {
        setEditingDoor(null);
        await prepareDoorModal(selectedClientId, {
            client_location_id: selectedLocationId || '',
            door_label: '',
            door_serial: '',
            door_type: '',
            door_description: '',
            door_type_alt: '',
            cw: '',
            ch: '',
            install_date: '',
        });
        setShowDoorModal(true);
    }
    async function openEditDoorModal(door: DoorRecord) {
        setEditingDoor(door);
        const clientId = locations.find(item => item.id === door.client_location_id)?.client_id ?? selectedClientId;
        await prepareDoorModal(clientId, {
            client_location_id: door.client_location_id,
            door_label: door.door_label,
            door_serial: door.door_serial ?? '',
            door_type: door.door_type,
            door_description: door.door_description ?? '',
            door_type_alt: door.door_type_alt ?? '',
            cw: door.cw ?? '',
            ch: door.ch ?? '',
            install_date: door.install_date ?? '',
        });
        setShowDoorModal(true);
    }
    function closeCsvModal() {
        setShowCsvModal(false);
        setCsvRows([]);
        setCsvRawRows([]);
        setCsvPreview(null);
        setCsvFailedRows([]);
        setCsvImportRan(false);
    }
    function downloadCsvTemplate() {
        const sampleRow = 'Acme Corp,Tottenham,Door 1,SN-0001,Strip Door,,Full Coverage,1200,2200,2024-01-15';
        const csv = `${csvTemplateHeaders.join(',')}\n${sampleRow}\n`;
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'door-import-template.csv';
        anchor.click();
        URL.revokeObjectURL(url);
    }
    async function handleCsvFile(file: File) {
        setCsvPreview(null);
        setCsvRows([]);
        setCsvRawRows([]);
        setCsvFailedRows([]);
        setCsvImportRan(false);
        setCsvLoading(true);
        try {
            const Papa = await import('papaparse');
            const text = await file.text();
            const parsed = Papa.parse<Record<string, string>>(text, {
                header: true,
                skipEmptyLines: true,
            });
            const validRaw: Array<Record<string, string>> = [];
            const validParsed: Array<z.infer<typeof csvDoorRowSchema>> = [];
            const invalidRaw: Array<Record<string, string>> = [];
            for (const row of parsed.data) {
                const result = csvDoorRowSchema.safeParse({
                    client_name: row.client_name,
                    location_name: row.location_name,
                    door_label: row.door_label,
                    door_serial: row.door_serial,
                    door_type: row.door_type,
                    door_description: row.door_description,
                    door_type_alt: row.door_type_alt,
                    cw: row.cw,
                    ch: row.ch,
                    install_date: row.install_date,
                });
                if (!result.success) {
                    invalidRaw.push({ ...row, error_reason: result.error.issues.map(e => e.message).join('; ') });
                } else {
                    validParsed.push(result.data);
                    validRaw.push(row);
                }
            }
            if (invalidRaw.length) {
                toast.error(`${invalidRaw.length} row(s) have validation errors — download the failed rows CSV to fix them.`);
                setCsvFailedRows(invalidRaw);
                if (!validParsed.length) { setCsvLoading(false); return; }
            }
            setCsvRows(validParsed);
            setCsvRawRows(validRaw);
            const preview = await fetchJson<CsvImportPreview>('/api/admin/doors/import-csv', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rows: validParsed, createMissing: false, preview: true }),
            });
            if (!preview.ok) {
                toast.error(preview.error ?? 'Preview failed');
                return;
            }
            setCsvPreview(preview.data);

            // Merge server-side errors (client/location not found) into csvFailedRows
            const previewErrors = preview.data.errors ?? [];
            if (previewErrors.length) {
                const serverFailed = previewErrors.flatMap(e => {
                    const raw = validRaw[e.rowIndex - 1];
                    return raw ? [{ ...raw, error_reason: e.message }] : [];
                });
                if (serverFailed.length) {
                    setCsvFailedRows(prev => [...prev, ...serverFailed]);
                }
            }
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : 'Invalid CSV file');
        }
        finally {
            setCsvLoading(false);
        }
    }
    async function confirmCsvImport() {
        if (!csvRows.length) {
            toast.error('Choose a CSV file first');
            return;
        }
        setCsvLoading(true);
        setCsvImportProgress(0);
        // Animate progress bar while waiting for API response
        let progressValue = 0;
        const progressInterval = setInterval(() => {
            progressValue = Math.min(progressValue + Math.random() * 8, 88);
            setCsvImportProgress(Math.round(progressValue));
        }, 250);
        try {
            const result = await fetchJson<{
                inserted: number;
                skipped: number;
                errors: Array<{
                    rowIndex: number;
                    message: string;
                }>;
            }>('/api/admin/doors/import-csv', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rows: csvRows, createMissing: false }),
            });
            clearInterval(progressInterval);
            setCsvImportProgress(100);
            if (!result.ok) {
                toast.error(result.error ?? 'Import failed');
                return;
            }
            setCsvImportRan(true);
            const serverErrors = result.data.errors ?? [];
            if (serverErrors.length) {
                const serverFailed = serverErrors.flatMap(e => {
                    const raw = csvRawRows[e.rowIndex - 1];
                    return raw ? [{ ...raw, error_reason: e.message }] : [];
                });
                setCsvFailedRows(prev => [...prev, ...serverFailed]);
            }
            const successCount = result.data.inserted;
            const totalFailed = serverErrors.length + csvFailedRows.length;
            await new Promise(r => setTimeout(r, 400)); // let bar show 100% briefly
            if (totalFailed > 0) {
                toast.error(`${successCount} imported, ${totalFailed} failed — download error CSV to fix them.`);
            } else {
                toast.success(`${successCount} door(s) imported successfully`);
                closeCsvModal();
            }
            if (selectedLocationId)
                await loadDoors(selectedLocationId);
        }
        catch {
            clearInterval(progressInterval);
            toast.error('Import failed — please try again.');
        }
        finally {
            setCsvLoading(false);
            setCsvImportProgress(null);
        }
    }
    function downloadFailedRowsCsv() {
        if (!csvFailedRows.length) return;
        const headers = [...csvTemplateHeaders, 'error_reason'];
        const lines = csvFailedRows.map(row =>
            headers.map(h => {
                const val = String(row[h] ?? '');
                return val.includes(',') || val.includes('"') || val.includes('\n')
                    ? `"${val.replace(/"/g, '""')}"` : val;
            }).join(',')
        );
        const csv = [headers.join(','), ...lines].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'door-import-errors.csv';
        anchor.click();
        URL.revokeObjectURL(url);
    }
    function closeLocationCsvModal() {
        setShowLocationCsvModal(false);
        setLocationCsvRows([]);
        setLocationCsvRawRows([]);
        setLocationCsvPreview(null);
        setLocationCsvFailedRows([]);
        setLocationCsvImportRan(false);
    }
    function downloadLocationCsvTemplate() {
        const sampleRow = 'Acme Corp,Tottenham,123 Industrial Ave,Tottenham';
        const csv = `${locationCsvTemplateHeaders.join(',')}\n${sampleRow}\n`;
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'location-import-template.csv';
        anchor.click();
        URL.revokeObjectURL(url);
    }
    async function handleLocationCsvFile(file: File) {
        setLocationCsvPreview(null);
        setLocationCsvRows([]);
        setLocationCsvRawRows([]);
        setLocationCsvFailedRows([]);
        setLocationCsvImportRan(false);
        setLocationCsvLoading(true);
        try {
            const Papa = await import('papaparse');
            const text = await file.text();
            const parsed = Papa.parse<Record<string, string>>(text, {
                header: true,
                skipEmptyLines: true,
            });
            const validRaw: Array<Record<string, string>> = [];
            const validParsed: Array<z.infer<typeof csvLocationRowSchema>> = [];
            const invalidRaw: Array<Record<string, string>> = [];
            for (const row of parsed.data) {
                const result = csvLocationRowSchema.safeParse({
                    client_name: row.client_name,
                    location_name: row.location_name,
                    Company_address: row.Company_address,
                    suburb: row.suburb,
                });
                if (!result.success) {
                    invalidRaw.push({ ...row, error_reason: result.error.issues.map(e => e.message).join('; ') });
                } else {
                    validParsed.push(result.data);
                    validRaw.push(row);
                }
            }
            if (invalidRaw.length) {
                toast.error(`${invalidRaw.length} row(s) have validation errors — download the failed rows CSV to fix them.`);
                setLocationCsvFailedRows(invalidRaw);
                if (!validParsed.length) { setLocationCsvLoading(false); return; }
            }
            setLocationCsvRows(validParsed);
            setLocationCsvRawRows(validRaw);
            const preview = await fetchJson<LocationCsvImportPreview>('/api/admin/locations/import-csv', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rows: validParsed, preview: true }),
            });
            if (!preview.ok) {
                toast.error(preview.error ?? 'Preview failed');
                return;
            }
            setLocationCsvPreview(preview.data);
            const previewErrors = preview.data.errors ?? [];
            if (previewErrors.length) {
                const serverFailed = previewErrors.flatMap(e => {
                    const raw = validRaw[e.rowIndex - 1];
                    return raw ? [{ ...raw, error_reason: e.message }] : [];
                });
                if (serverFailed.length) setLocationCsvFailedRows(prev => [...prev, ...serverFailed]);
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Invalid CSV file');
        } finally {
            setLocationCsvLoading(false);
        }
    }
    async function confirmLocationCsvImport() {
        if (!locationCsvRows.length) {
            toast.error('Choose a CSV file first');
            return;
        }
        setLocationCsvLoading(true);
        setLocationCsvImportProgress(0);
        let progressValue = 0;
        const progressInterval = setInterval(() => {
            progressValue = Math.min(progressValue + Math.random() * 8, 88);
            setLocationCsvImportProgress(Math.round(progressValue));
        }, 250);
        try {
            const result = await fetchJson<{
                inserted: number;
                skipped: number;
                duplicates: number;
                errors: Array<{ rowIndex: number; message: string }>;
            }>('/api/admin/locations/import-csv', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rows: locationCsvRows }),
            });
            clearInterval(progressInterval);
            setLocationCsvImportProgress(100);
            if (!result.ok) {
                toast.error(result.error ?? 'Import failed');
                return;
            }
            setLocationCsvImportRan(true);
            const serverErrors = result.data.errors ?? [];
            if (serverErrors.length) {
                const serverFailed = serverErrors.flatMap(e => {
                    const raw = locationCsvRawRows[e.rowIndex - 1];
                    return raw ? [{ ...raw, error_reason: e.message }] : [];
                });
                setLocationCsvFailedRows(prev => [...prev, ...serverFailed]);
            }
            const successCount = result.data.inserted;
            const totalFailed = serverErrors.length + locationCsvFailedRows.length;
            await new Promise(r => setTimeout(r, 400));
            if (totalFailed > 0) {
                toast.error(`${successCount} imported, ${totalFailed} failed — download error CSV to fix them.`);
            } else {
                toast.success(`${successCount} location(s) imported successfully`);
                closeLocationCsvModal();
            }
            if (selectedClientId) await loadLocations(selectedClientId);
        } catch {
            clearInterval(progressInterval);
            toast.error('Import failed — please try again.');
        } finally {
            setLocationCsvLoading(false);
            setLocationCsvImportProgress(null);
        }
    }
    function downloadLocationFailedRowsCsv() {
        if (!locationCsvFailedRows.length) return;
        const headers = [...locationCsvTemplateHeaders, 'error_reason'];
        const lines = locationCsvFailedRows.map(row =>
            headers.map(h => {
                const val = String(row[h] ?? '');
                return val.includes(',') || val.includes('"') || val.includes('\n')
                    ? `"${val.replace(/"/g, '""')}"` : val;
            }).join(',')
        );
        const csv = [headers.join(','), ...lines].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'location-import-errors.csv';
        anchor.click();
        URL.revokeObjectURL(url);
    }
    if (loading) {
        return <div className="text-sm text-slate-600">Loading client registry...</div>;
    }
    return (<div className="space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Clients & Doors</h1>
        <p className="mt-1 text-sm text-slate-600">Create clients, locations, and doors from UI. Managers and admins only.</p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {TABS.map(tab => (<button key={tab.key} type="button" className={`rounded-lg px-3 py-1.5 text-sm ${activeTab === tab.key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`} onClick={() => setActiveTab(tab.key)}>
              {tab.label}
            </button>))}
        </div>
      </section>

      {activeTab === 'clients' && (<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Clients</h2>
            <input value={clientSearch} onChange={event => setClientSearch(event.target.value)} placeholder="Search clients..." className="h-10 rounded-lg border border-slate-300 px-3 text-sm"/>
          </div>

          <form className="mb-4 flex flex-wrap gap-2" onSubmit={clientForm.handleSubmit(onSubmitClient)}>
            <input {...clientForm.register('client_name')} placeholder="Client name" className="h-10 min-w-[240px] rounded-lg border border-slate-300 px-3 text-sm"/>
            <button disabled={!canEdit} type="submit" className="h-10 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white disabled:opacity-50">
              {editingClientId ? 'Update client' : 'Create client'}
            </button>
            {editingClientId && (<button type="button" className="h-10 rounded-lg border border-slate-300 px-4 text-sm" onClick={() => {
                    setEditingClientId(null);
                    clientForm.reset({ client_name: '' });
                }}>
                Cancel
              </button>)}
          </form>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleClients.map(client => (<tr key={client.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-slate-800">{client.client_name}</td>
                    <td className="px-3 py-2 text-right">
                      <button disabled={!canEdit} type="button" className="mr-2 text-indigo-700 underline disabled:opacity-40" onClick={() => startEditClient(client)}>Edit</button>
                      <button disabled={!canEdit} type="button" className="text-red-700 underline disabled:opacity-40" onClick={() => handleDeleteClient(client.id)}>Delete</button>
                    </td>
                  </tr>))}
              </tbody>
            </table>
          </div>
        </section>)}

      {activeTab === 'locations' && (<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-900">Locations</h2>
            <div className="flex gap-2">
              <button disabled={!canEdit} type="button" onClick={() => setShowLocationCsvModal(true)} className="h-9 rounded-lg border border-slate-300 px-3 text-sm disabled:opacity-50">
                Import CSV
              </button>
              <button type="button" onClick={downloadLocationCsvTemplate} className="h-9 rounded-lg border border-slate-300 px-3 text-sm">
                Download Template
              </button>
            </div>
          </div>
          <div className="mb-3 grid gap-2 md:grid-cols-2">
            <SearchableSelect
              id="admin-locations-filter-client"
              label="Filter by client"
              value={selectedClientId}
              onChange={value => {
                setSelectedClientId(value);
                locationForm.setValue('client_id', value);
              }}
              options={clientOptions.map(c => ({ value: c.id, label: c.name }))}
              allowEmpty
              emptyLabel="Select client"
              placeholder="Search clients…"
              className="[&_button]:h-10"
            />
            <input value={locationSearch} onChange={event => setLocationSearch(event.target.value)} placeholder="Search locations..." className="h-10 rounded-lg border border-slate-300 px-3 text-sm"/>
          </div>

          <form className="mb-4 grid gap-2 md:grid-cols-5" onSubmit={locationForm.handleSubmit(onSubmitLocation)}>
            <SearchableSelect
              id="admin-location-form-client"
              label="Client"
              value={locationForm.watch('client_id')}
              onChange={v => locationForm.setValue('client_id', v, { shouldValidate: true, shouldDirty: true })}
              options={clientOptions.map(c => ({ value: c.id, label: c.name }))}
              allowEmpty
              emptyLabel="Select client"
              placeholder="Search clients…"
              className="[&_button]:h-10"
            />
            <input {...locationForm.register('location_name')} placeholder="Location name" className="h-10 rounded-lg border border-slate-300 px-3 text-sm"/>
            <input {...locationForm.register('Company_address')} placeholder="Address" className="h-10 rounded-lg border border-slate-300 px-3 text-sm"/>
            <input {...locationForm.register('suburb')} placeholder="Suburb (optional)" className="h-10 rounded-lg border border-slate-300 px-3 text-sm"/>
            <div className="flex gap-2">
              <button disabled={!canEdit} type="submit" className="h-10 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white disabled:opacity-50">
                {editingLocationId ? 'Update location' : 'Create location'}
              </button>
              {editingLocationId && (<button type="button" className="h-10 rounded-lg border border-slate-300 px-4 text-sm" onClick={() => {
                    setEditingLocationId(null);
                    locationForm.reset({
                        client_id: selectedClientId || '',
                        location_name: '',
                        Company_address: '',
                        suburb: '',
                    });
                }}>
                  Cancel
                </button>)}
            </div>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-2">Location</th>
                  <th className="px-3 py-2">Address</th>
                  <th className="px-3 py-2">Suburb</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleLocations.map(location => (<tr key={location.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-slate-800">{location.location_name}</td>
                    <td className="px-3 py-2 text-slate-700">{location.Company_address ?? '-'}</td>
                    <td className="px-3 py-2 text-slate-700">{location.suburb ?? '-'}</td>
                    <td className="px-3 py-2 text-right">
                      <button disabled={!canEdit} type="button" className="mr-2 text-indigo-700 underline disabled:opacity-40" onClick={() => startEditLocation(location)}>Edit</button>
                      <button disabled={!canEdit} type="button" className="text-red-700 underline disabled:opacity-40" onClick={() => handleDeleteLocation(location.id)}>Delete</button>
                    </td>
                  </tr>))}
              </tbody>
            </table>
          </div>
        </section>)}

      {activeTab === 'doors' && (<section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 grid gap-2 md:grid-cols-4">
            <SearchableSelect
              id="admin-doors-filter-client"
              label="Client"
              value={selectedClientId}
              onChange={setSelectedClientId}
              options={clientOptions.map(c => ({ value: c.id, label: c.name }))}
              allowEmpty
              emptyLabel="Select client"
              placeholder="Search clients…"
              className="[&_button]:h-10"
            />
            <select value={selectedLocationId} onChange={event => setSelectedLocationId(event.target.value)} className="h-10 rounded-lg border border-slate-300 px-3 text-sm">
              <option value="">Select location</option>
              {filteredLocationsForClient.map(location => (<option key={location.id} value={location.id}>{location.name}</option>))}
            </select>
            <input value={doorSearch} onChange={event => setDoorSearch(event.target.value)} placeholder="Search doors..." className="h-10 rounded-lg border border-slate-300 px-3 text-sm"/>
            <div className="flex gap-2">
              <button disabled={!canEdit} type="button" onClick={openCreateDoorModal} className="h-10 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white disabled:opacity-50">
                Add Door
              </button>
              <button disabled={!canEdit} type="button" onClick={() => setShowCsvModal(true)} className="h-10 rounded-lg border border-slate-300 px-3 text-sm disabled:opacity-50">
                Import CSV
              </button>
              <button type="button" onClick={downloadCsvTemplate} className="h-10 rounded-lg border border-slate-300 px-3 text-sm">
                Download Template
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-2">Door Label</th>
                  <th className="px-3 py-2">Serial</th>
                  <th className="px-3 py-2">Location</th>
                  <th className="px-3 py-2">Door Type</th>
                  <th className="px-3 py-2">CW</th>
                  <th className="px-3 py-2">CH</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleDoors.map(door => (<tr key={door.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-slate-800">{door.door_label}</td>
                    <td className="px-3 py-2 text-slate-700">{door.door_serial ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-700">{locations.find(item => item.id === door.client_location_id)?.location_name ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-700">{door.door_type}</td>
                    <td className="px-3 py-2 text-slate-700">{door.cw ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-700">{door.ch ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-700">{door.door_description ?? '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <button disabled={!canEdit} type="button" className="mr-2 text-indigo-700 underline disabled:opacity-40" onClick={() => openEditDoorModal(door)}>Edit</button>
                      <button disabled={!canEdit} type="button" className="text-red-700 underline disabled:opacity-40" onClick={() => handleDeleteDoor(door.id)}>Delete</button>
                    </td>
                  </tr>))}
              </tbody>
            </table>
          </div>
        </section>)}

      {showDoorModal && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-3xl rounded-xl bg-white p-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">{editingDoor ? 'Edit door' : 'Add door'}</h3>
            <form className="mt-3 grid gap-2 md:grid-cols-2" onSubmit={doorForm.handleSubmit(onSubmitDoor)}>
              <SearchableSelect
                id="admin-door-modal-client"
                label="Client"
                value={doorModalClientId}
                onChange={value => void onDoorModalClientChange(value)}
                options={clientOptions.map(c => ({ value: c.id, label: c.name }))}
                allowEmpty
                emptyLabel="Select client"
                placeholder="Search clients…"
                className="md:col-span-2 [&_button]:h-10"
              />
              <div className="flex flex-col gap-1">
                <label htmlFor="admin-door-modal-location" className="text-sm font-medium text-slate-700">Location</label>
                <select
                  id="admin-door-modal-location"
                  {...doorForm.register('client_location_id')}
                  disabled={!doorModalClientId}
                  className="h-10 rounded-lg border border-slate-300 px-3 text-sm disabled:opacity-50"
                >
                  <option value="">Select location</option>
                  {doorModalLocations.map(location => (<option key={location.id} value={location.id}>{location.location_name}</option>))}
                </select>
              </div>
              {editingDoor && (
                <p className="md:col-span-2 text-xs text-slate-600">
                  Moving client/site updates the door registry and client portal gallery. Approved reports and PDFs are not changed. For portal photos, the report&apos;s site should match this client/location.
                </p>
              )}
              <input {...doorForm.register('door_label')} placeholder="Door label" className="h-10 rounded-lg border border-slate-300 px-3 text-sm"/>
              <input {...doorForm.register('door_serial')} placeholder="Serial number (e.g. P0823)" className="h-10 rounded-lg border border-slate-300 px-3 text-sm"/>
              <input {...doorForm.register('door_type')} placeholder="Door type" className="h-10 rounded-lg border border-slate-300 px-3 text-sm"/>
              <input {...doorForm.register('install_date')} type="date" className="h-10 rounded-lg border border-slate-300 px-3 text-sm"/>
              <input {...doorForm.register('door_description')} placeholder="Door description" className="h-10 rounded-lg border border-slate-300 px-3 text-sm md:col-span-2"/>
              <input {...doorForm.register('door_type_alt')} placeholder="Door type alt" className="h-10 rounded-lg border border-slate-300 px-3 text-sm"/>
              <input {...doorForm.register('cw')} placeholder="CW" className="h-10 rounded-lg border border-slate-300 px-3 text-sm"/>
              <input {...doorForm.register('ch')} placeholder="CH" className="h-10 rounded-lg border border-slate-300 px-3 text-sm"/>
              <div className="md:col-span-2 flex justify-end gap-2">
                <button type="button" className="h-10 rounded-lg border border-slate-300 px-4 text-sm" onClick={closeDoorModal}>Cancel</button>
                <button disabled={!canEdit} type="submit" className="h-10 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white disabled:opacity-50">{editingDoor ? 'Save changes' : 'Create door'}</button>
              </div>
            </form>
          </div>
        </div>)}

      {showCsvModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="flex w-full max-w-3xl flex-col gap-0 rounded-2xl bg-white shadow-2xl">

            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Import Doors from CSV</h3>
                <p className="mt-0.5 text-xs text-slate-500">Upload your file, review the preview, then confirm. Any failures are downloadable as a CSV.</p>
              </div>
              <button type="button" onClick={closeCsvModal} className="ml-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex flex-col gap-4 overflow-y-auto px-6 py-4" style={{maxHeight: '60vh'}}>

              {/* Upload zone */}
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 py-8 text-center transition hover:border-indigo-400 hover:bg-indigo-50">
                <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/></svg>
                <span className="text-sm font-medium text-slate-600">
                  {csvRows.length ? `${csvRows.length} valid row(s) loaded — choose a different file to replace` : 'Choose a CSV file or drag it here'}
                </span>
                <span className="text-xs text-slate-400">Columns: client_name, location_name, door_label, door_serial, door_type, door_description, door_type_alt, cw, ch, install_date</span>
                <input type="file" accept=".csv,text/csv" className="sr-only" onChange={event => {
                  const file = event.target.files?.[0];
                  if (file) void handleCsvFile(file);
                }}/>
              </label>

              {csvLoading && (
                <div className="flex items-center gap-2 rounded-lg bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  Processing CSV…
                </div>
              )}

              {/* Failure banner — only shown after import ran, not during preview */}
              {csvImportRan && csvFailedRows.length > 0 && (
                <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-red-800">{csvFailedRows.length} row(s) could not be imported</p>
                    <p className="mt-0.5 text-xs text-red-600">Download the error file, fix the issues in the <strong>error_reason</strong> column, then re-import.</p>
                  </div>
                  <button type="button" onClick={downloadFailedRowsCsv} className="shrink-0 inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 text-xs font-medium text-red-700 hover:bg-red-50">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                    Download errors.csv
                  </button>
                </div>
              )}

              {/* Preview summary + table */}
              {csvPreview && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
                      <p className="text-2xl font-bold text-indigo-600">{csvPreview.to_create}</p>
                      <p className="mt-0.5 text-xs text-slate-500">Ready to import</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
                      <p className={`text-2xl font-bold ${csvPreview.skipped ? 'text-amber-600' : 'text-slate-400'}`}>{csvPreview.skipped}</p>
                      <p className="mt-0.5 text-xs text-slate-500">Skipped (client/location not found)</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-3 text-center sm:col-span-1 col-span-2">
                      <p className={`text-2xl font-bold ${csvPreview.skipped ? 'text-red-600' : 'text-slate-400'}`}>{csvPreview.skipped}</p>
                      <p className="mt-0.5 text-xs text-slate-500">Not matched (fix &amp; re-import)</p>
                    </div>
                  </div>

                  {csvRows.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-slate-500">Preview (first {Math.min(csvRows.length, 10)} of {csvRows.length} valid rows)</p>
                      <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-slate-600">
                              {csvTemplateHeaders.map(h => <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {csvRows.slice(0, 10).map((row, i) => (
                              <tr key={`${row.client_name}-${row.location_name}-${i}`} className="border-t border-slate-100 hover:bg-slate-50">
                                <td className="px-3 py-1.5">{row.client_name}</td>
                                <td className="px-3 py-1.5">{row.location_name}</td>
                                <td className="px-3 py-1.5">{row.door_label}</td>
                                <td className="px-3 py-1.5">{row.door_serial ?? ''}</td>
                                <td className="px-3 py-1.5">{row.door_type}</td>
                                <td className="px-3 py-1.5">{row.door_description ?? ''}</td>
                                <td className="px-3 py-1.5">{row.door_type_alt ?? ''}</td>
                                <td className="px-3 py-1.5">{row.cw ?? ''}</td>
                                <td className="px-3 py-1.5">{row.ch ?? ''}</td>
                                <td className="px-3 py-1.5">{row.install_date ?? ''}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Progress bar */}
            {csvImportProgress !== null && (
              <div className="px-6 pb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-500">Importing doors…</span>
                  <span className="text-xs font-medium text-indigo-600">{csvImportProgress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                    style={{width: `${csvImportProgress}%`}}
                  />
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
              <button type="button" className="h-10 rounded-lg border border-slate-300 px-4 text-sm text-slate-700 hover:bg-slate-50" onClick={closeCsvModal} disabled={csvLoading}>
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
                disabled={!canEdit || csvLoading || !csvRows.length || !csvPreview}
                onClick={() => void confirmCsvImport()}
              >
                {csvLoading && (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                )}
                {csvLoading ? `Importing… ${csvImportProgress ?? 0}%` : `Import ${csvPreview?.to_create ?? ''} door(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLocationCsvModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="flex w-full max-w-2xl flex-col gap-0 rounded-2xl bg-white shadow-2xl">

            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Import Locations from CSV</h3>
                <p className="mt-0.5 text-xs text-slate-500">Upload your file, review the preview, then confirm. Client must exist first. Duplicate locations are skipped.</p>
              </div>
              <button type="button" onClick={closeLocationCsvModal} className="ml-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="flex flex-col gap-4 overflow-y-auto px-6 py-4" style={{maxHeight: '60vh'}}>

              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 py-8 text-center transition hover:border-indigo-400 hover:bg-indigo-50">
                <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/></svg>
                <span className="text-sm font-medium text-slate-600">
                  {locationCsvRows.length ? `${locationCsvRows.length} valid row(s) loaded — choose a different file to replace` : 'Choose a CSV file or drag it here'}
                </span>
                <span className="text-xs text-slate-400">Columns: client_name, location_name, Company_address, suburb</span>
                <input type="file" accept=".csv,text/csv" className="sr-only" onChange={event => {
                  const file = event.target.files?.[0];
                  if (file) void handleLocationCsvFile(file);
                }}/>
              </label>

              {locationCsvLoading && (
                <div className="flex items-center gap-2 rounded-lg bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                  Processing CSV…
                </div>
              )}

              {locationCsvImportRan && locationCsvFailedRows.length > 0 && (
                <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-red-800">{locationCsvFailedRows.length} row(s) could not be imported</p>
                    <p className="mt-0.5 text-xs text-red-600">Download the error file, fix the issues in the <strong>error_reason</strong> column, then re-import.</p>
                  </div>
                  <button type="button" onClick={downloadLocationFailedRowsCsv} className="shrink-0 inline-flex h-8 items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 text-xs font-medium text-red-700 hover:bg-red-50">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                    Download errors.csv
                  </button>
                </div>
              )}

              {locationCsvPreview && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
                      <p className="text-2xl font-bold text-indigo-600">{locationCsvPreview.to_create}</p>
                      <p className="mt-0.5 text-xs text-slate-500">Ready to import</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
                      <p className={`text-2xl font-bold ${locationCsvPreview.skipped ? 'text-amber-600' : 'text-slate-400'}`}>{locationCsvPreview.skipped}</p>
                      <p className="mt-0.5 text-xs text-slate-500">Client not found</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
                      <p className={`text-2xl font-bold ${locationCsvPreview.duplicates ? 'text-amber-600' : 'text-slate-400'}`}>{locationCsvPreview.duplicates}</p>
                      <p className="mt-0.5 text-xs text-slate-500">Already exists</p>
                    </div>
                  </div>

                  {locationCsvRows.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-slate-500">Preview (first {Math.min(locationCsvRows.length, 10)} of {locationCsvRows.length} valid rows)</p>
                      <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-slate-600">
                              {locationCsvTemplateHeaders.map(h => <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {locationCsvRows.slice(0, 10).map((row, i) => (
                              <tr key={`${row.client_name}-${row.location_name}-${i}`} className="border-t border-slate-100 hover:bg-slate-50">
                                <td className="px-3 py-1.5">{row.client_name}</td>
                                <td className="px-3 py-1.5">{row.location_name}</td>
                                <td className="px-3 py-1.5">{row.Company_address}</td>
                                <td className="px-3 py-1.5">{row.suburb ?? ''}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {locationCsvImportProgress !== null && (
              <div className="px-6 pb-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-500">Importing locations…</span>
                  <span className="text-xs font-medium text-indigo-600">{locationCsvImportProgress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-indigo-500 transition-all duration-300" style={{width: `${locationCsvImportProgress}%`}}/>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
              <button type="button" className="h-10 rounded-lg border border-slate-300 px-4 text-sm text-slate-700 hover:bg-slate-50" onClick={closeLocationCsvModal} disabled={locationCsvLoading}>
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
                disabled={!canEdit || locationCsvLoading || !locationCsvRows.length || !locationCsvPreview}
                onClick={() => void confirmLocationCsvImport()}
              >
                {locationCsvLoading && (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                )}
                {locationCsvLoading ? `Importing… ${locationCsvImportProgress ?? 0}%` : `Import ${locationCsvPreview?.to_create ?? ''} location(s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>);
}
