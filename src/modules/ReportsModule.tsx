import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Download, MapPin, User, Globe, RefreshCcw, ChevronDown } from 'lucide-react';
import * as ExportHelpers from '../utils/exportHelpers';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ModuleShell } from '../components/ModuleShell';
import { authHeaders } from '../utils/helpers';
import { API_BASE_URL, statusColors } from '../constants/index';
import type { Equipment, EquipmentEvent, DeptStat, UserStat, SiteStat, MaintenanceRecord, SiteVisit } from '../types/index';

interface Props {
  onClose: () => void;
  equipments: Equipment[];
  isAdmin: boolean;
  onUnauthorized: () => void;
  userAllowedSiteIds?: number[];
}

const maintenanceStatusStyle: Record<string, string> = {
  en_attente: 'bg-gray-100 text-gray-700',
  ouvert: 'bg-blue-100 text-blue-700',
  en_cours: 'bg-yellow-100 text-yellow-700',
  résolu: 'bg-green-100 text-green-700',
};

const maintenanceStatusLabel: Record<string, string> = {
  en_attente: 'En attente',
  ouvert: 'Ouvert',
  en_cours: 'En cours',
  résolu: 'Résolu',
};

const getEventActionStyle = (action: string) => {
  if (action === 'Création')    return { dot: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-700' };
  if (action === 'Intervention')return { dot: 'bg-green-500',  badge: 'bg-green-100 text-green-700' };
  if (action === 'Modification') return { dot: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-700' };
  if (action === 'Suppression')  return { dot: 'bg-red-500',    badge: 'bg-red-100 text-red-700' };
  return { dot: 'bg-gray-400', badge: 'bg-gray-100 text-gray-600' };
};

const FIELD_LABELS: Record<string, string> = {
  name: 'Nom', type: 'Type', brand: 'Marque', model: 'Modèle',
  serialNumber: 'N° Série', ipAddress: 'Adresse IP', location: 'Emplacement',
  department: 'Département', status: 'Statut', purchaseDate: 'Date achat',
  warranty: 'Garantie', lastMaintenance: 'Dernière maintenance',
  visited: 'Visité', technicianName: 'Technicien',
  visitDate: 'Date visite', interventionDetails: 'Détails intervention',
};

export default function ReportsModule({ onClose, equipments, isAdmin, onUnauthorized, userAllowedSiteIds }: Props) {
  const [reportsTab, setReportsTab] = useState<'equipment' | 'date' | 'department' | 'user' | 'site' | 'maintenance' | 'visits'>('equipment');
  const [reportMaintenanceAll, setReportMaintenanceAll] = useState<MaintenanceRecord[]>([]);
  const [reportMaintenanceLoading, setReportMaintenanceLoading] = useState(false);
  const [reportVisitsAll, setReportVisitsAll] = useState<SiteVisit[]>([]);
  const [reportVisitsLoading, setReportVisitsLoading] = useState(false);
  const [reportEquipmentId, setReportEquipmentId] = useState<number | ''>('');
  const [reportHistory, setReportHistory] = useState<EquipmentEvent[]>([]);
  const [reportHistoryLoading, setReportHistoryLoading] = useState(false);
  const [reportDateFrom, setReportDateFrom] = useState('');
  const [reportDateTo, setReportDateTo] = useState('');
  const [reportDeptFilter, setReportDeptFilter] = useState('');
  const [reportTypeFilter, setReportTypeFilter] = useState('');
  const [reportDateEvents, setReportDateEvents] = useState<EquipmentEvent[]>([]);
  const [reportDateLoading, setReportDateLoading] = useState(false);
  const [reportDeptStats, setReportDeptStats] = useState<DeptStat[]>([]);
  const [reportDeptLoading, setReportDeptLoading] = useState(false);
  const [reportUserStats, setReportUserStats] = useState<UserStat[]>([]);
  const [reportUserLoading, setReportUserLoading] = useState(false);
  const [reportUserFrom, setReportUserFrom] = useState('');
  const [reportUserTo, setReportUserTo] = useState('');
  const [reportUserDeptFilter, setReportUserDeptFilter] = useState('');
  const [reportUserExpanded, setReportUserExpanded] = useState<string | null>(null);
  const [reportUserDetail, setReportUserDetail] = useState<EquipmentEvent[]>([]);
  const [reportUserDetailLoading, setReportUserDetailLoading] = useState(false);
  const [reportSiteStats, setReportSiteStats] = useState<SiteStat[]>([]);
  const [reportSiteLoading, setReportSiteLoading] = useState(false);
  const [reportSiteFrom, setReportSiteFrom] = useState('');
  const [reportSiteTo, setReportSiteTo] = useState('');
  const [reportSiteTypeFilter, setReportSiteTypeFilter] = useState('');
  const [reportSiteExpanded, setReportSiteExpanded] = useState<number | null>(null);
  const [reportSiteDetail, setReportSiteDetail] = useState<EquipmentEvent[]>([]);
  const [reportSiteDetailLoading, setReportSiteDetailLoading] = useState(false);

  // Site filtering for non-admin users
  const allowedEquipments = useMemo(() => {
    if (!userAllowedSiteIds || userAllowedSiteIds.length === 0) return equipments;
    return equipments.filter(e => e.siteId != null && userAllowedSiteIds.includes(e.siteId));
  }, [equipments, userAllowedSiteIds]);

  const siteFilteredMaintenance = useMemo(() => {
    if (!userAllowedSiteIds || userAllowedSiteIds.length === 0) return reportMaintenanceAll;
    return reportMaintenanceAll.filter(m => {
      if (m.equipmentId != null) {
        const eq = equipments.find(e => e.id === m.equipmentId);
        return eq?.siteId != null && userAllowedSiteIds.includes(eq.siteId);
      }
      return true;
    });
  }, [reportMaintenanceAll, equipments, userAllowedSiteIds]);

  const siteFilteredVisits = useMemo(() => {
    if (!userAllowedSiteIds || userAllowedSiteIds.length === 0) return reportVisitsAll;
    return reportVisitsAll.filter(v => v.siteId != null && userAllowedSiteIds.includes(v.siteId));
  }, [reportVisitsAll, userAllowedSiteIds]);

  // ── Fetch helpers ──

  const fetchReportHistory = async (equipmentId: number) => {
    setReportHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/reports/equipment/${equipmentId}`, { headers: authHeaders() });
      if (res.status === 401) { onUnauthorized(); return; }
      if (res.ok) setReportHistory(await res.json());
    } catch (err) { console.error(err); }
    setReportHistoryLoading(false);
  };

  const fetchReportByDate = async () => {
    setReportDateLoading(true);
    try {
      const params = new URLSearchParams();
      if (reportDateFrom) params.set('from', reportDateFrom);
      if (reportDateTo) params.set('to', reportDateTo);
      if (reportDeptFilter) params.set('department', reportDeptFilter);
      if (reportTypeFilter) params.set('type', reportTypeFilter);
      const res = await fetch(`${API_BASE_URL}/api/reports/by-date?${params}`, { headers: authHeaders() });
      if (res.status === 401) { onUnauthorized(); return; }
      if (res.ok) setReportDateEvents(await res.json());
    } catch (err) { console.error(err); }
    setReportDateLoading(false);
  };

  const fetchReportByDepartment = async () => {
    setReportDeptLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/reports/by-department`, { headers: authHeaders() });
      if (res.status === 401) { onUnauthorized(); return; }
      if (res.ok) setReportDeptStats(await res.json());
    } catch (err) { console.error(err); }
    setReportDeptLoading(false);
  };

  const fetchReportByUser = async (opts?: { from?: string; to?: string; department?: string }) => {
    setReportUserLoading(true);
    setReportUserExpanded(null);
    try {
      const params = new URLSearchParams();
      const from = opts?.from ?? reportUserFrom;
      const to   = opts?.to   ?? reportUserTo;
      const dept = opts?.department ?? reportUserDeptFilter;
      if (from) params.set('from', from);
      if (to)   params.set('to', to);
      if (dept) params.set('department', dept);
      const res = await fetch(`${API_BASE_URL}/api/reports/by-user?${params}`, { headers: authHeaders() });
      if (res.status === 401) { onUnauthorized(); return; }
      if (res.ok) setReportUserStats(await res.json());
    } catch (err) { console.error(err); }
    setReportUserLoading(false);
  };

  const fetchUserDetail = async (username: string) => {
    if (reportUserExpanded === username) { setReportUserExpanded(null); return; }
    setReportUserExpanded(username);
    setReportUserDetailLoading(true);
    try {
      const params = new URLSearchParams({ username });
      if (reportUserFrom) params.set('from', reportUserFrom);
      if (reportUserTo)   params.set('to', reportUserTo);
      if (reportUserDeptFilter) params.set('department', reportUserDeptFilter);
      const res = await fetch(`${API_BASE_URL}/api/reports/user-detail?${params}`, { headers: authHeaders() });
      if (res.ok) setReportUserDetail(await res.json());
    } catch (err) { console.error(err); }
    setReportUserDetailLoading(false);
  };

  const fetchReportBySite = async (opts?: { from?: string; to?: string; type?: string }) => {
    setReportSiteLoading(true);
    try {
      const params = new URLSearchParams();
      const from = opts?.from ?? reportSiteFrom;
      const to   = opts?.to   ?? reportSiteTo;
      const type = opts?.type ?? reportSiteTypeFilter;
      if (from) params.set('from', from);
      if (to)   params.set('to', to);
      if (type) params.set('type', type);
      const res = await fetch(`${API_BASE_URL}/api/reports/by-site?${params}`, { headers: authHeaders() });
      if (res.status === 401) { onUnauthorized(); return; }
      if (res.ok) setReportSiteStats(await res.json());
    } catch (err) { console.error(err); }
    setReportSiteLoading(false);
  };

  const fetchSiteDetail = async (siteId: number) => {
    if (reportSiteExpanded === siteId) { setReportSiteExpanded(null); return; }
    setReportSiteExpanded(siteId);
    setReportSiteDetailLoading(true);
    try {
      const params = new URLSearchParams({ siteId: String(siteId) });
      if (reportSiteFrom) params.set('from', reportSiteFrom);
      if (reportSiteTo)   params.set('to', reportSiteTo);
      if (reportSiteTypeFilter) params.set('type', reportSiteTypeFilter);
      const res = await fetch(`${API_BASE_URL}/api/reports/site-detail?${params}`, { headers: authHeaders() });
      if (res.ok) setReportSiteDetail(await res.json());
    } catch (err) { console.error(err); }
    setReportSiteDetailLoading(false);
  };

  const fetchReportMaintenance = async () => {
    setReportMaintenanceLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/maintenance?limit=500`, { headers: authHeaders() });
      if (r.ok) setReportMaintenanceAll(await r.json());
    } catch (err) { console.error(err); }
    setReportMaintenanceLoading(false);
  };

  const fetchReportVisits = async () => {
    setReportVisitsLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/visits`, { headers: authHeaders() });
      if (r.ok) setReportVisitsAll(await r.json());
    } catch (err) { console.error(err); }
    setReportVisitsLoading(false);
  };

  // ── Export helpers ──

  const exportReportPdf = async (title: string, events: EquipmentEvent[]) => {
    await ExportHelpers.exportRowsToPdf({
      head: [['Date', 'Équipement', 'Type', 'Département', 'Action', 'Détails', 'Technicien', 'Utilisateur']],
      body: events.map(ev => [
        new Date(ev.createdAt).toLocaleString('fr-FR'),
        ev.equipmentName, ev.equipmentType, ev.department,
        ev.action, ev.details, ev.technician, ev.userName,
      ]),
      filename: `rapport-${Date.now()}.pdf`,
      title,
      orientation: 'landscape',
    });
  };

  const exportReportExcel = async (sheetName: string, events: EquipmentEvent[]) => {
    const rows = events.map(ev => ({
      'Date': new Date(ev.createdAt).toLocaleString('fr-FR'),
      'Équipement': ev.equipmentName,
      'Type': ev.equipmentType,
      'Département': ev.department,
      'Action': ev.action,
      'Détails': ev.details,
      'Technicien': ev.technician,
      'Utilisateur': ev.userName,
      'IP': ev.ip,
    }));
    await ExportHelpers.exportJsonToXlsx(rows, `rapport-${Date.now()}.xlsx`, sheetName);
  };

  const exportDeptPdf = async (stats: DeptStat[]) => {
    await ExportHelpers.exportRowsToPdf({
      head: [['Service', 'Équipements', 'Total événements', 'Créations', 'Modifications', 'Interventions', 'Suppressions', 'Dernière activité']],
      body: stats.map(d => [
        d.department, d.equipment_count, d.total_events, d.creations,
        d.modifications, d.interventions, d.suppressions,
        d.last_activity ? new Date(d.last_activity).toLocaleString('fr-FR') : '—',
      ]),
      filename: `rapport-services-${Date.now()}.pdf`,
      title: 'Rapport par service',
      orientation: 'landscape'
    });
  };

  const exportUserPdf = async (stats: UserStat[]) => {
    await ExportHelpers.exportRowsToPdf({
      head: [['Utilisateur', 'Login', 'Total', 'Créations', 'Modifications', 'Transferts', 'Suppressions', 'Maintenances', 'Réformes', 'Équip.', 'Services', 'Dernière action']],
      body: stats.map(u => [
        u.user_name, u.username, u.total_actions, u.creations, u.modifications,
        u.transferts, u.suppressions, u.maintenances, u.reformes,
        u.equipment_count, u.dept_count,
        u.last_action ? new Date(u.last_action).toLocaleString('fr-FR') : '—',
      ]),
      filename: `rapport-utilisateurs-${Date.now()}.pdf`,
      title: 'Rapport par utilisateur',
      orientation: 'landscape'
    });
  }

  const exportSitePdf = async (stats: any[]) => {
    await ExportHelpers.exportRowsToPdf({
      head: [['Site', 'Ville', 'Pays', 'Équipements', 'Total événements', 'Créations', 'Modifications', 'Transferts', 'Interventions', 'Réformes', 'Suppressions', 'Dernière activité']],
      body: stats.map(s => [
        s.site_name, s.city || '—', s.country || '—',
        s.equipment_count, s.total_events, s.creations, s.modifications,
        s.transferts, s.interventions, s.reformes, s.suppressions,
        s.last_activity ? new Date(s.last_activity).toLocaleString('fr-FR') : '—',
      ]),
      filename: `rapport-sites-${Date.now()}.pdf`,
      title: 'Rapport par site',
      orientation: 'landscape',
      tableOptions: { styles: { fontSize: 6, cellPadding: 2 }, alternateRowStyles: { fillColor: [245, 247, 250] } },
    });
  };

  const downloadUserReport = async (username: string, userName: string) => {
    try {
      const params = new URLSearchParams({ username });
      if (reportUserFrom) params.set('from', reportUserFrom);
      if (reportUserTo) params.set('to', reportUserTo);
      if (reportUserDeptFilter) params.set('department', reportUserDeptFilter);
      const res = await fetch(`${API_BASE_URL}/api/reports/user-detail?${params}`, { headers: authHeaders() });
      if (!res.ok) return;
      const events: EquipmentEvent[] = await res.json();
      const rows = events.map(ev => ({
        'Date': new Date(ev.createdAt).toLocaleString('fr-FR'),
        'Équipement': ev.equipmentName,
        'Type': ev.equipmentType,
        'Département': ev.department,
        'Action': ev.action,
        'Détails': ev.details,
        'Technicien': ev.technician,
        'Utilisateur': ev.userName,
      }));
      await ExportHelpers.exportJsonToXlsx(rows, `rapport-${username}-${Date.now()}.xlsx`, userName);
    } catch (err) { console.error(err); }
  };

  // ── Effects ──

  useEffect(() => {
    fetchReportByDepartment();
  }, []);

  useEffect(() => {
    if (reportsTab !== 'date') return;
    const timer = setTimeout(() => fetchReportByDate(), 500);
    return () => clearTimeout(timer);
  }, [reportDateFrom, reportDateTo, reportDeptFilter, reportTypeFilter, reportsTab]);

  useEffect(() => {
    if (reportsTab !== 'user') return;
    const timer = setTimeout(() => fetchReportByUser(), 500);
    return () => clearTimeout(timer);
  }, [reportUserFrom, reportUserTo, reportUserDeptFilter, reportsTab]);

  useEffect(() => {
    if (reportsTab !== 'site') return;
    const timer = setTimeout(() => fetchReportBySite(), 500);
    return () => clearTimeout(timer);
  }, [reportSiteFrom, reportSiteTo, reportSiteTypeFilter, reportsTab]);

  // ── Render ──

  return (
    <ModuleShell
      icon={<Calendar className="w-5 h-5 text-white" />}
      title="Module Rapports"
      subtitle="Statistiques et historique du parc"
      onClose={onClose}
    >
      {/* Tabs */}
      <div className="flex border-b border-gray-100 shrink-0 px-6 overflow-x-auto">
        {([
          ['equipment','Parcours équipement'],
          ['date','Par date'],
          ['department','Par service'],
          ['user', isAdmin ? 'Par utilisateur' : 'Mes actions'],
          ['site','Par site'],
          ['maintenance','Maintenance'],
          ['visits','Visites'],
        ] as const).map(([tab, label]) => (
          <button key={tab} onClick={() => {
            setReportsTab(tab as typeof reportsTab);
            if (tab === 'user' && reportUserStats.length === 0) fetchReportByUser();
            if (tab === 'site' && reportSiteStats.length === 0) fetchReportBySite();
            if (tab === 'maintenance' && reportMaintenanceAll.length === 0) fetchReportMaintenance();
            if (tab === 'visits' && reportVisitsAll.length === 0) fetchReportVisits();
          }}
            className={`whitespace-nowrap px-4 py-3 text-sm font-medium border-b-2 transition-colors ${reportsTab === tab ? 'border-[#1a6fa6] text-[#1a6fa6]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-y-auto flex-1 p-6">

        {/* ── Tab 1: Parcours équipement ── */}
        {reportsTab === 'equipment' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <select
                value={reportEquipmentId}
                onChange={e => {
                  const id = Number(e.target.value);
                  setReportEquipmentId(id || '');
                  setReportHistory([]);
                  if (id) fetchReportHistory(id);
                }}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6fa6]"
              >
                <option value="">— Sélectionner un équipement —</option>
                {equipments.map(eq => (
                  <option key={eq.id} value={eq.id}>{eq.name} ({eq.brand} {eq.model})</option>
                ))}
              </select>
              {reportHistory.length > 0 && (
                <div className="flex gap-2 ml-auto">
                  <button onClick={() => exportReportExcel(`Parcours ${reportHistory[0]?.equipmentName}`, reportHistory)}
                    className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                    <Download className="w-3.5 h-3.5 text-green-600" /> Excel
                  </button>
                  <button onClick={() => exportReportPdf(`Parcours — ${reportHistory[0]?.equipmentName}`, reportHistory)}
                    className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                    <Download className="w-3.5 h-3.5 text-red-500" /> PDF
                  </button>
                </div>
              )}
            </div>

            {reportHistoryLoading && <div className="text-center py-12 text-gray-400"><div className="skeleton h-4 w-48 mx-auto" /><div className="skeleton h-3 w-32 mx-auto mt-2" /></div>}

            {!reportHistoryLoading && reportEquipmentId && reportHistory.length === 0 && (
              <div className="text-center py-12 text-gray-400">Aucun événement enregistré pour cet équipement.</div>
            )}

            {reportHistory.length > 0 && (() => {
              const eq = equipments.find(e => e.id === reportEquipmentId);
              return (
                <div>
                  {eq && (
                    <div className="mb-5 rounded-xl bg-gradient-to-br from-indigo-50 to-blue-100/30 border border-indigo-100 p-4 flex flex-wrap gap-4 text-sm">
                      <div><span className="font-semibold text-gray-800">{eq.name}</span> <span className="text-indigo-400">·</span> {eq.brand} {eq.model}</div>
                      <div className="text-gray-600">S/N: {eq.serialNumber || '—'}</div>
                      <div className="text-gray-600">IP: {eq.ipAddress || '—'}</div>
                      <div className="text-gray-600">Dept: {eq.department}</div>
                      <div className="text-gray-600">Statut: <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${statusColors[eq.status]}`}>{eq.status}</span></div>
                      <div className="text-gray-600">{reportHistory.length} événement(s)</div>
                    </div>
                  )}

                  <div className="relative pl-6 space-y-0">
                    <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-200" />
                    {reportHistory.map((ev) => {
                      const style = getEventActionStyle(ev.action);
                      return (
                        <div key={ev.id} className="relative pb-6">
                          <div className={`absolute -left-4 mt-1 w-3 h-3 rounded-full ring-2 ring-white ${style.dot}`} />
                          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${style.badge}`}>{ev.action}</span>
                              <span className="text-xs text-gray-400">{new Date(ev.createdAt).toLocaleString('fr-FR')}</span>
                              {ev.technician && <span className="text-xs text-gray-500">Technicien: <strong>{ev.technician}</strong></span>}
                              <span className="text-xs text-gray-400 ml-auto">par {ev.userName} ({ev.username})</span>
                            </div>
                            <p className="text-sm text-gray-700">{ev.details}</p>
                            {ev.changes.length > 0 && (
                              <div className="mt-3 space-y-1">
                                {ev.changes.map((ch, j) => (
                                  <div key={j} className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded px-2 py-1">
                                    <span className="font-medium text-gray-700">{FIELD_LABELS[ch.field] ?? ch.field}</span>
                                    <span className="line-through text-gray-400">{String(ch.from)}</span>
                                    <span className="text-gray-400">→</span>
                                    <span className="font-medium text-gray-800">{String(ch.to)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── Tab 2: Par date ── */}
        {reportsTab === 'date' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100 p-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Du</label>
                <input type="date" value={reportDateFrom} onChange={e => setReportDateFrom(e.target.value)}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6fa6] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Au</label>
                <input type="date" value={reportDateTo} onChange={e => setReportDateTo(e.target.value)}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6fa6] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Service</label>
                <select value={reportDeptFilter} onChange={e => setReportDeptFilter(e.target.value)}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6fa6] outline-none">
                  <option value="">Tous</option>
                  {[...new Set(equipments.map(e => e.department).filter(Boolean))].sort().map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Type</label>
                <select value={reportTypeFilter} onChange={e => setReportTypeFilter(e.target.value)}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6fa6] outline-none">
                  <option value="">Tous</option>
                  <option value="ordinateur">Ordinateur</option>
                  <option value="reseau">Réseau</option>
                  <option value="serveur">Serveur</option>
                  <option value="imprimante">Imprimante</option>
                </select>
              </div>
              {reportDateEvents.length > 0 && (
                <>
                  <button onClick={() => exportReportExcel('Rapport par date', reportDateEvents)}
                    className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    <Download className="w-3.5 h-3.5 text-green-600" /> Excel
                  </button>
                  <button onClick={() => exportReportPdf('Rapport par date', reportDateEvents)}
                    className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    <Download className="w-3.5 h-3.5 text-red-500" /> PDF
                  </button>
                </>
              )}
            </div>

            {reportDateLoading && <div className="text-center py-12 text-gray-400"><div className="skeleton h-4 w-48 mx-auto" /><div className="skeleton h-3 w-32 mx-auto mt-2" /></div>}

            {!reportDateLoading && reportDateEvents.length === 0 && (
              <div className="text-center py-12 text-gray-400">Aucun événement trouvé pour ces critères.</div>
            )}

            {reportDateEvents.length > 0 && (
              <div>
                <p className="text-sm text-gray-500 mb-3">{reportDateEvents.length} événement(s) trouvé(s)</p>
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="px-4 py-2 text-left">Date</th>
                        <th className="px-4 py-2 text-left">Équipement</th>
                        <th className="px-4 py-2 text-left">Département</th>
                        <th className="px-4 py-2 text-left">Action</th>
                        <th className="px-4 py-2 text-left">Détails</th>
                        <th className="px-4 py-2 text-left">Technicien</th>
                        <th className="px-4 py-2 text-left">Utilisateur</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {reportDateEvents.map(ev => {
                        const style = getEventActionStyle(ev.action);
                        return (
                          <tr key={ev.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">{new Date(ev.createdAt).toLocaleString('fr-FR')}</td>
                            <td className="px-4 py-2 font-medium text-gray-900">{ev.equipmentName}</td>
                            <td className="px-4 py-2 text-gray-500">{ev.department}</td>
                            <td className="px-4 py-2"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${style.badge}`}>{ev.action}</span></td>
                            <td className="px-4 py-2 text-gray-600 max-w-xs truncate" title={ev.details}>{ev.details}</td>
                            <td className="px-4 py-2 text-gray-500">{ev.technician || '—'}</td>
                            <td className="px-4 py-2 text-gray-500">{ev.userName}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab 3: Par service ── */}
        {reportsTab === 'department' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Activité globale par service ({reportDeptStats.length} service(s))</p>
              <div className="flex gap-2">
                <button onClick={fetchReportByDepartment}
                  className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                  <RefreshCcw className="w-3.5 h-3.5" /> Actualiser
                </button>
                {reportDeptStats.length > 0 && (
                  <>
                    <button onClick={async () => {
                      const rows = reportDeptStats.map(d => ({
                        'Service': d.department,
                        'Équipements': d.equipment_count,
                        'Total événements': d.total_events,
                        'Créations': d.creations,
                        'Modifications': d.modifications,
                        'Interventions': d.interventions,
                        'Suppressions': d.suppressions,
                        'Dernière activité': d.last_activity ? new Date(d.last_activity).toLocaleString('fr-FR') : '—',
                      }));
                      await ExportHelpers.exportJsonToXlsx(rows, `rapport-services-${Date.now()}.xlsx`, 'Par service');
                    }}
                      className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                      <Download className="w-3.5 h-3.5 text-green-600" /> Excel
                    </button>
                    <button onClick={() => exportDeptPdf(reportDeptStats)}
                      className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                      <Download className="w-3.5 h-3.5 text-red-500" /> PDF
                    </button>
                  </>
                )}
              </div>
            </div>

            {reportDeptLoading && <div className="text-center py-12 text-gray-400"><div className="skeleton h-4 w-48 mx-auto" /><div className="skeleton h-3 w-32 mx-auto mt-2" /></div>}

            {!reportDeptLoading && reportDeptStats.length === 0 && (
              <div className="text-center py-12 text-gray-400">Aucune donnée — les événements s'enregistrent dès la première action sur un équipement.</div>
            )}

            {reportDeptStats.length > 0 && (
              <div className="space-y-3">
                {reportDeptStats.map(dept => {
                  const maxTotal = Math.max(...reportDeptStats.map(d => Number(d.total_events)), 1);
                  const barWidth = Math.round((Number(dept.total_events) / maxTotal) * 100);
                  return (
                    <div key={dept.department} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-indigo-400" />
                          <span className="font-semibold text-gray-800">{dept.department}</span>
                          <span className="text-xs text-gray-400">{dept.equipment_count} équipement(s)</span>
                        </div>
                        <span className="text-sm font-bold text-[#155a8a]">{dept.total_events} événements</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
                        <div className="bg-gradient-to-r from-indigo-500 to-blue-600 h-2 rounded-full transition-all" style={{ width: `${barWidth}%` }} />
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />{dept.creations} créations</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />{dept.interventions} interventions</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />{dept.modifications} modifications</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />{dept.suppressions} suppressions</span>
                        {dept.last_activity && <span className="ml-auto text-gray-400">Dernière activité: {new Date(dept.last_activity).toLocaleDateString('fr-FR')}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Tab 4 : Par utilisateur ── */}
        {reportsTab === 'user' && (
          <div className="space-y-4">
            {!isAdmin && (
              <div className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-indigo-50 to-blue-100/30 border border-indigo-100 px-4 py-2.5 text-sm text-gray-700">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-sm shrink-0"><User className="w-3 h-3" /></div>
                Rapport de vos actions sur vos sites assignés.
              </div>
            )}
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Du</label>
                <input type="date" value={reportUserFrom} onChange={e => setReportUserFrom(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6]" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Au</label>
                <input type="date" value={reportUserTo} onChange={e => setReportUserTo(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6]" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Service</label>
                <select value={reportUserDeptFilter} onChange={e => setReportUserDeptFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6]">
                  <option value="">Tous les services</option>
                  {[...new Set(equipments.map(e => e.department).filter(Boolean))].sort().map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <button onClick={() => { setReportUserFrom(''); setReportUserTo(''); setReportUserDeptFilter(''); }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                <RefreshCcw className="w-3.5 h-3.5" /> Réinitialiser
              </button>
              {reportUserStats.length > 0 && (
                <>
                  <button onClick={async () => {
                    const rows = reportUserStats.map(u => ({
                      'Utilisateur': u.user_name, 'Login': u.username,
                      'Total actions': Number(u.total_actions),
                      'Créations': Number(u.creations), 'Modifications': Number(u.modifications),
                      'Interventions': Number(u.interventions), 'Transferts': Number(u.transferts),
                      'Suppressions': Number(u.suppressions), 'Maintenances': Number(u.maintenances),
                      'Réformes': Number(u.reformes),
                      'Équipements traités': Number(u.equipment_count),
                      'Services touchés': Number(u.dept_count),
                      'Dernière action': u.last_action ? new Date(u.last_action).toLocaleString('fr-FR') : '—',
                    }));
                    await ExportHelpers.exportJsonToXlsx(rows, `rapport-utilisateurs-${Date.now()}.xlsx`, 'Par utilisateur');
                  }} className="ml-auto inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                    <Download className="w-3.5 h-3.5 text-green-600" /> Excel
                  </button>
                  <button onClick={() => exportUserPdf(reportUserStats)}
                    className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                    <Download className="w-3.5 h-3.5 text-red-500" /> PDF
                  </button>
                </>
              )}
            </div>

            {reportUserLoading && <div className="text-center py-12 text-gray-400"><div className="skeleton h-4 w-48 mx-auto" /><div className="skeleton h-3 w-32 mx-auto mt-2" /></div>}

            {!reportUserLoading && reportUserStats.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <User className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>Aucune donnée disponible pour ces critères.</p>
              </div>
            )}

            {reportUserStats.length > 0 && (
              <>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-blue-100/30 border border-indigo-100 p-3 text-center">
                    <div className="text-2xl font-bold text-gray-800">{reportUserStats.length}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Utilisateur(s) actif(s)</div>
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-blue-100/30 border border-indigo-100 p-3 text-center">
                    <div className="text-2xl font-bold text-gray-800">{reportUserStats.reduce((s, u) => s + Number(u.total_actions), 0)}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Actions au total</div>
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-green-50 to-emerald-100/30 border border-green-100 p-3 text-center">
                    <div className="text-2xl font-bold text-green-700">{reportUserStats.reduce((s, u) => s + Number(u.equipment_count), 0)}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Équipements traités</div>
                  </div>
                </div>

                <div className="space-y-2">
                  {reportUserStats.map(user => {
                    const maxTotal = Math.max(...reportUserStats.map(u => Number(u.total_actions)), 1);
                    const barW = Math.round((Number(user.total_actions) / maxTotal) * 100);
                    const isExpanded = reportUserExpanded === user.username;
                    const pills = [
                      { label: 'Créations',     value: Number(user.creations),     color: 'bg-[#cfe2ff] text-[#155a8a]' },
                      { label: 'Modifications', value: Number(user.modifications), color: 'bg-yellow-100 text-yellow-700' },
                      { label: 'Interventions', value: Number(user.interventions), color: 'bg-green-100 text-green-700' },
                      { label: 'Transferts',    value: Number(user.transferts),    color: 'bg-purple-100 text-purple-700' },
                      { label: 'Suppressions',  value: Number(user.suppressions),  color: 'bg-red-100 text-red-700' },
                      { label: 'Maintenance',   value: Number(user.maintenances),  color: 'bg-orange-100 text-orange-700' },
                      { label: 'Réformes',      value: Number(user.reformes),      color: 'bg-gray-100 text-gray-700' },
                    ].filter(p => p.value > 0);

                    return (
                      <div key={user.username} className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                        <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                          onClick={() => fetchUserDetail(user.username)}>
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-sm shrink-0">
                            <User className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-gray-900">{user.user_name}</span>
                              <span className="text-xs text-gray-400">@{user.username}</span>
                              <span className="text-xs text-gray-400">· {user.equipment_count} équipement(s) · {user.dept_count} service(s)</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                                <div className="bg-gradient-to-r from-indigo-500 to-blue-600 h-1.5 rounded-full" style={{ width: `${barW}%` }} />
                              </div>
                              <span className="text-xs font-bold text-gray-700 shrink-0">{user.total_actions} actions</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {pills.map(p => (
                                <span key={p.label} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${p.color}`}>
                                  {p.value} {p.label}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={e => { e.stopPropagation(); downloadUserReport(user.username, user.user_name); }}
                              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-green-600 transition-colors"
                              title="Télécharger le rapport Excel">
                              <Download className="w-4 h-4" />
                            </button>
                            <div className="text-right text-xs text-gray-400">
                              {user.last_action && <p>Dernière action<br />{new Date(user.last_action).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' })}</p>}
                              <ChevronDown className={`w-4 h-4 ml-auto mt-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </div>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                            {reportUserDetailLoading ? (
                              <p className="text-center py-4 text-gray-400 text-sm"><div className="skeleton h-4 w-48 mx-auto" /><div className="skeleton h-3 w-32 mx-auto mt-2" /></p>
                            ) : reportUserDetail.length === 0 ? (
                              <p className="text-center py-4 text-gray-400 text-sm">Aucun événement trouvé.</p>
                            ) : (
                              <div className="space-y-2 max-h-64 overflow-y-auto">
                                {reportUserDetail.map(ev => {
                                  const st = getEventActionStyle(ev.action);
                                  return (
                                    <div key={ev.id} className="flex items-start gap-3 text-xs bg-white rounded-lg px-3 py-2 border border-gray-100">
                                      <span className={`inline-block w-2 h-2 rounded-full mt-1 shrink-0 ${st.dot}`} />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className={`rounded-full px-2 py-0.5 font-medium ${st.badge}`}>{ev.action}</span>
                                          <span className="font-medium text-gray-800">{ev.equipmentName}</span>
                                          {ev.department && <span className="text-gray-400">· {ev.department}</span>}
                                        </div>
                                        <p className="text-gray-500 mt-0.5 truncate">{ev.details}</p>
                                      </div>
                                      <span className="text-gray-400 shrink-0 whitespace-nowrap">
                                        {new Date(ev.createdAt).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Tab 5: Par site ── */}
        {reportsTab === 'site' && (
          <div className="space-y-4">
            {!isAdmin && (
              <div className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-indigo-50 to-blue-100/30 border border-indigo-100 px-4 py-2.5 text-sm text-gray-700">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-sm shrink-0"><Globe className="w-3 h-3" /></div>
                Rapport limité à vos sites assignés.
              </div>
            )}
            <div className="flex flex-wrap items-end gap-3 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100 p-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Du</label>
                <input type="date" value={reportSiteFrom} onChange={e => setReportSiteFrom(e.target.value)}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6fa6] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Au</label>
                <input type="date" value={reportSiteTo} onChange={e => setReportSiteTo(e.target.value)}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6fa6] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Type</label>
                <select value={reportSiteTypeFilter} onChange={e => setReportSiteTypeFilter(e.target.value)}
                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6fa6] outline-none">
                  <option value="">Tous</option>
                  <option value="ordinateur">Ordinateur</option>
                  <option value="reseau">Réseau</option>
                  <option value="serveur">Serveur</option>
                  <option value="imprimante">Imprimante</option>
                </select>
              </div>
              <button onClick={() => { setReportSiteFrom(''); setReportSiteTo(''); setReportSiteTypeFilter(''); }}
                className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                <RefreshCcw className="w-3.5 h-3.5" /> Réinitialiser
              </button>
              {reportSiteStats.length > 0 && (
                <>
                  <button onClick={async () => {
                    const rows = reportSiteStats.map(s => ({
                      'Site': s.site_name, 'Ville': s.city || '—', 'Pays': s.country || '—',
                      'Équipements': s.equipment_count, 'Total événements': s.total_events,
                      'Créations': s.creations, 'Modifications': s.modifications,
                      'Transferts': s.transferts, 'Interventions': s.interventions,
                      'Réformes': s.reformes, 'Suppressions': s.suppressions,
                      'Dernière activité': s.last_activity ? new Date(s.last_activity).toLocaleString('fr-FR') : '—',
                    }));
                    await ExportHelpers.exportJsonToXlsx(rows, `rapport-sites-${Date.now()}.xlsx`, 'Par site');
                  }} className="ml-auto inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                    <Download className="w-3.5 h-3.5 text-green-600" /> Excel
                  </button>
                  <button onClick={() => exportSitePdf(reportSiteStats)}
                    className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                    <Download className="w-3.5 h-3.5 text-red-500" /> PDF
                  </button>
                </>
              )}
            </div>

            {reportSiteLoading && <div className="text-center py-12 text-gray-400"><div className="skeleton h-4 w-48 mx-auto" /><div className="skeleton h-3 w-32 mx-auto mt-2" /></div>}

            {!reportSiteLoading && reportSiteStats.length > 0 && (() => {
              const filteredSiteStats = userAllowedSiteIds && userAllowedSiteIds.length > 0
                ? reportSiteStats.filter(s => userAllowedSiteIds.includes(s.site_id))
                : reportSiteStats;
              return filteredSiteStats.length > 0 ? (
              <div className="space-y-2">
                {filteredSiteStats.map(site => {
                  const isExpanded = reportSiteExpanded === site.site_id;
                  const maxEv = Math.max(...filteredSiteStats.map(s => s.total_events), 1);
                  const barW = Math.round((site.total_events / maxEv) * 100);
                  return (
                    <div key={site.site_id} className="rounded-xl border border-gray-100 bg-white overflow-hidden">
                      <button type="button" onClick={() => fetchSiteDetail(site.site_id)}
                        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Globe className="w-4 h-4 text-indigo-500 shrink-0" />
                            <span className="font-semibold text-gray-900">{site.site_name}</span>
                            {(site.city || site.country) && (
                              <span className="text-xs text-gray-400">{[site.city, site.country].filter(Boolean).join(', ')}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                              <div className="bg-gradient-to-r from-indigo-500 to-blue-600 h-1.5 rounded-full" style={{width:`${barW}%`}} />
                            </div>
                            <span className="text-xs text-gray-500 shrink-0">{site.total_events} événement(s)</span>
                          </div>
                        </div>
                        <div className="flex gap-3 text-center shrink-0">
                          {[
                            ['Équip.', site.equipment_count, 'text-[#1a6fa6]'],
                            ['Créations', site.creations, 'text-green-600'],
                            ['Modifs', site.modifications, 'text-yellow-600'],
                            ['Transferts', site.transferts, 'text-purple-600'],
                          ].map(([lbl, val, cls]) => (
                            <div key={String(lbl)} className="hidden sm:block">
                              <div className={`text-sm font-bold ${cls}`}>{val}</div>
                              <div className="text-xs text-gray-400">{lbl}</div>
                            </div>
                          ))}
                        </div>
                        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>

                      {isExpanded && (
                        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
                          {reportSiteDetailLoading ? (
                            <p className="text-sm text-gray-400 text-center py-4"><div className="skeleton h-4 w-48 mx-auto" /><div className="skeleton h-3 w-32 mx-auto mt-2" /></p>
                          ) : reportSiteDetail.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-4">Aucun événement pour ce site.</p>
                          ) : (
                            <div className="space-y-1.5 max-h-80 overflow-y-auto">
                              {reportSiteDetail.map(ev => {
                                const st = getEventActionStyle(ev.action);
                                return (
                                  <div key={ev.id} className="flex items-start gap-3 text-xs bg-white rounded-lg border border-gray-100 px-3 py-2">
                                    <span className={`rounded-full px-2 py-0.5 font-semibold shrink-0 ${st.badge}`}>{ev.action}</span>
                                    <div className="flex-1 min-w-0">
                                      <span className="font-medium text-gray-800">{ev.equipmentName}</span>
                                      {ev.department && <span className="text-gray-400"> · {ev.department}</span>}
                                      {ev.details && <p className="text-gray-500 mt-0.5 truncate">{ev.details}</p>}
                                    </div>
                                    <div className="text-gray-400 shrink-0 text-right whitespace-nowrap">
                                      <div>{new Date(ev.createdAt).toLocaleDateString('fr-FR', { day:'2-digit', month:'short' })}</div>
                                      <div>{ev.userName}</div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <Globe className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>Aucun site avec activité trouvé.</p>
              </div>
            )})()}
          </div>
        )}

        {/* ── Tab Maintenance ── */}
        {reportsTab === 'maintenance' && (
          <div className="space-y-6">
            {reportMaintenanceLoading && <div className="text-center py-12 text-gray-400"><div className="skeleton h-4 w-48 mx-auto" /><div className="skeleton h-3 w-32 mx-auto mt-2" /></div>}
            {!reportMaintenanceLoading && siteFilteredMaintenance.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <p>{reportMaintenanceAll.length === 0 ? 'Aucun ticket de maintenance trouvé.' : 'Aucun ticket pour vos sites.'}</p>
                <button onClick={fetchReportMaintenance} className="mt-3 px-4 py-2 bg-gradient-to-r from-[#1a6fa6] to-blue-700 text-white rounded-xl text-sm font-semibold hover:from-[#155a8a] hover:to-[#0d4a73] shadow-sm transition-all">Charger</button>
              </div>
            )}
            {siteFilteredMaintenance.length > 0 && (() => {
              const all = siteFilteredMaintenance;
              const byStatus = (['en_attente','ouvert','en_cours','résolu'] as const).map(s => ({
                label: maintenanceStatusLabel[s] ?? s, style: maintenanceStatusStyle[s],
                count: all.filter(m => m.status === s).length,
              }));
              const byPriority: Record<string,number> = {};
              all.forEach(m => { byPriority[m.priority] = (byPriority[m.priority]??0)+1; });
              const byTech: Record<string,{total:number;resolved:number}> = {};
              all.forEach(m => {
                const t = m.technician||'Non assigné';
                if (!byTech[t]) byTech[t]={total:0,resolved:0};
                byTech[t].total++;
                if (m.status==='résolu') byTech[t].resolved++;
              });
              const resolved = all.filter(m=>m.status==='résolu'&&m.openedAt&&m.closedAt);
              const avgMs = resolved.length ? resolved.reduce((a,m)=>a+(new Date(m.closedAt!).getTime()-new Date(m.openedAt).getTime()),0)/resolved.length : 0;
              const avgH = Math.round(avgMs/3600000);
              const prioColors: Record<string,string> = {critique:'bg-red-500',haute:'bg-orange-400',normale:'bg-blue-400',basse:'bg-gray-300'};
              return (<>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    {label:'Total tickets',value:all.length,color:'text-gray-800'},
                    {label:'Actifs',value:all.filter(m=>m.status!=='résolu').length,color:'text-red-600'},
                    {label:'Résolus',value:resolved.length,color:'text-green-600'},
                    {label:'Délai moyen résolution',value:avgH>0?`${avgH}h`:'—',color:'text-[#1a6fa6]'},
                  ].map(({label,value,color})=>(
                    <div key={label} className="bg-white rounded-xl border p-4 shadow-sm">
                      <div className={`text-2xl font-bold ${color}`}>{value}</div>
                      <div className="text-xs text-gray-500 mt-1">{label}</div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl border p-4 shadow-sm">
                    <h3 className="font-semibold text-gray-700 mb-4">Par statut</h3>
                    {byStatus.map(({label,style,count})=>(
                      <div key={label} className="flex items-center gap-3 mb-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium w-24 text-center shrink-0 ${style}`}>{label}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div className="h-2 rounded-full bg-orange-400" style={{width:`${all.length?(count/all.length)*100:0}%`}}/>
                        </div>
                        <span className="text-sm font-bold text-gray-700 w-6 text-right">{count}</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-white rounded-xl border p-4 shadow-sm">
                    <h3 className="font-semibold text-gray-700 mb-4">Par priorité</h3>
                    {Object.entries(byPriority).sort((a,b)=>b[1]-a[1]).map(([prio,cnt])=>(
                      <div key={prio} className="flex items-center gap-3 mb-2">
                        <span className="text-xs text-gray-600 capitalize w-20 shrink-0">{prio}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div className={`h-2 rounded-full ${prioColors[prio]??'bg-gray-400'}`} style={{width:`${all.length?(cnt/all.length)*100:0}%`}}/>
                        </div>
                        <span className="text-sm font-bold text-gray-700 w-6 text-right">{cnt}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white rounded-xl border p-4 shadow-sm">
                  <h3 className="font-semibold text-gray-700 mb-3">Par technicien</h3>
                  <table className="w-full text-sm">
                    <thead><tr className="text-xs text-gray-400 border-b">
                      <th className="pb-2 text-left">Technicien</th>
                      <th className="pb-2 text-right">Total</th>
                      <th className="pb-2 text-right">Résolus</th>
                      <th className="pb-2 text-right">Taux</th>
                    </tr></thead>
                    <tbody>
                      {Object.entries(byTech).sort((a,b)=>b[1].total-a[1].total).map(([tech,d])=>(
                        <tr key={tech} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-1.5 font-medium text-gray-800">{tech}</td>
                          <td className="py-1.5 text-right text-gray-500">{d.total}</td>
                          <td className="py-1.5 text-right text-green-600 font-medium">{d.resolved}</td>
                          <td className="py-1.5 text-right text-[#1a6fa6] font-medium">{d.total?Math.round((d.resolved/d.total)*100):0}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>);
            })()}
          </div>
        )}

        {/* ── Tab Visites ── */}
        {reportsTab === 'visits' && (
          <div className="space-y-6">
            {reportVisitsLoading && <div className="text-center py-12 text-gray-400"><div className="skeleton h-4 w-48 mx-auto" /><div className="skeleton h-3 w-32 mx-auto mt-2" /></div>}
            {!reportVisitsLoading && siteFilteredVisits.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <p>{reportVisitsAll.length === 0 ? 'Aucune visite trouvée.' : 'Aucune visite pour vos sites.'}</p>
                <button onClick={fetchReportVisits} className="mt-3 px-4 py-2 bg-[#1a6fa6] text-white rounded-xl text-sm hover:bg-[#155a8a]">Charger</button>
              </div>
            )}
            {siteFilteredVisits.length > 0 && (() => {
              const all = siteFilteredVisits;
              const visitStatusStyle: Record<string,string> = {
                planifié:'bg-[#cfe2ff] text-[#155a8a]', en_cours:'bg-yellow-100 text-yellow-700',
                terminé:'bg-green-100 text-green-700', reporté:'bg-orange-100 text-orange-700', annulé:'bg-red-100 text-red-700'
              };
              const byStatus = (['planifié','en_cours','terminé','reporté','annulé'] as const).map(s=>({
                label:s.charAt(0).toUpperCase()+s.slice(1).replace('_',' '),
                style:visitStatusStyle[s], count:all.filter(v=>v.status===s).length
              }));
              const bySite: Record<string,{total:number;terminé:number}> = {};
              all.forEach(v=>{
                const s=v.siteName||'Inconnu';
                if(!bySite[s]) bySite[s]={total:0,terminé:0};
                bySite[s].total++;
                if(v.status==='terminé') bySite[s].terminé++;
              });
              const byTech: Record<string,number> = {};
              all.forEach(v=>{ const t=v.technician||'Non assigné'; byTech[t]=(byTech[t]??0)+1; });
              const withMaint = all.filter(v=>v.withMaintenance).length;
              const maxSite = Math.max(...Object.values(bySite).map(s=>s.total),1);
              return (<>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    {label:'Total visites',value:all.length,color:'text-blue-700'},
                    {label:'Terminées',value:all.filter(v=>v.status==='terminé').length,color:'text-green-600'},
                    {label:'À venir',value:all.filter(v=>v.status==='planifié'||v.status==='en_cours').length,color:'text-[#1a6fa6]'},
                    {label:'Avec maintenance',value:withMaint,color:'text-orange-600'},
                  ].map(({label,value,color})=>(
                    <div key={label} className="bg-white rounded-xl border p-4 shadow-sm">
                      <div className={`text-2xl font-bold ${color}`}>{value}</div>
                      <div className="text-xs text-gray-500 mt-1">{label}</div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl border p-4 shadow-sm">
                    <h3 className="font-semibold text-gray-700 mb-4">Par statut</h3>
                    {byStatus.map(({label,style,count})=>(
                      <div key={label} className="flex items-center gap-3 mb-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium w-24 text-center shrink-0 ${style}`}>{label}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div className="h-2 rounded-full bg-blue-400" style={{width:`${all.length?(count/all.length)*100:0}%`}}/>
                        </div>
                        <span className="text-sm font-bold text-gray-700 w-6 text-right">{count}</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-white rounded-xl border p-4 shadow-sm">
                    <h3 className="font-semibold text-gray-700 mb-4">Par technicien</h3>
                    {Object.entries(byTech).sort((a,b)=>b[1]-a[1]).map(([tech,cnt])=>(
                      <div key={tech} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 mb-1">
                        <span className="text-sm text-gray-700 font-medium flex-1">{tech}</span>
                        <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-bold">{cnt}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white rounded-xl border p-4 shadow-sm">
                  <h3 className="font-semibold text-gray-700 mb-3">Par site</h3>
                  <div className="space-y-2">
                    {Object.entries(bySite).sort((a,b)=>b[1].total-a[1].total).map(([site,d])=>(
                      <div key={site} className="flex items-center gap-3">
                        <span className="text-sm text-gray-700 font-medium w-40 truncate shrink-0">{site}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div className="h-2 rounded-full bg-blue-400" style={{width:`${(d.total/maxSite)*100}%`}}/>
                        </div>
                        <span className="text-xs text-gray-500 shrink-0">{d.terminé}/{d.total}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>);
            })()}
          </div>
        )}

      </div>
    </ModuleShell>
  );
}
