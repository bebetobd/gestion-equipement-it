import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, X, Download, Trash2, Edit, ChevronLeft, ChevronRight,
  CheckCircle, FileText, Clock
} from 'lucide-react';
import { ModuleShell } from '../components/ModuleShell';
import { authHeaders } from '../utils/helpers';
import { API_BASE_URL, PAGE_SIZE, workLogTypes, workLogStatuses } from '../constants';

export const MODULE_NAME = 'Feuille de temps';

export interface WorkLog {
  id: number;
  userId: number;
  userName: string;
  workDate: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  type: string;
  equipmentId?: number;
  equipmentName?: string;
  siteId?: number;
  siteName?: string;
  description: string;
  status: string;
  teamMembers: number[];
  teamMemberInfo: { id: number; name: string }[];
}

export interface WorkLogReportItem {
  period: string;
  type: string;
  count: number;
  totalMinutes: number;
}

interface Props {
  canWrite: boolean;
  canModify: boolean;
  isAdmin: boolean;
  currentUserName: string;
  currentUserId: number;
  equipments: { id: number; name: string; siteId?: number | null }[];
  sites: { id: number; name: string }[];
  onClose: () => void;
  onToast: (t: { message: string; type: 'error' | 'success' | 'info' }) => void;
  onConfirm: (c: { message: string; onConfirm: () => void }) => void;
}

interface UserOption {
  id: number;
  name: string;
  username: string;
}

const emptyForm = {
  workDate: '',
  startTime: '',
  endTime: '',
  durationMinutes: '',
  type: 'maintenance',
  equipmentId: '',
  siteId: '',
  description: '',
  status: 'termine',
  teamMembers: [] as number[],
};

function calcDuration(start: string, end: string): number | null {
  if (!start || !end) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  return diff > 0 ? diff : null;
}

export default function WorkLogModule({
  canWrite, canModify, isAdmin, currentUserName, currentUserId,
  equipments, sites, onClose, onToast, onConfirm,
}: Props) {
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [reportData, setReportData] = useState<WorkLogReportItem[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [tab, setTab] = useState<'list' | 'report'>('list');
  const [reportFrom, setReportFrom] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10);
  });
  const [reportTo, setReportTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [reportType, setReportType] = useState('');
  const [reportSiteId, setReportSiteId] = useState('');
  const [reportGroupBy, setReportGroupBy] = useState<'day' | 'week' | 'month'>('day');
  const [users, setUsers] = useState<UserOption[]>([]);

  useEffect(() => { fetchLogs(); }, [page]);

  useEffect(() => {
    if (showForm && users.length === 0) {
      fetch(`${API_BASE_URL}/api/users`, { headers: authHeaders() })
        .then(r => r.ok ? r.json() : [])
        .then(d => setUsers(Array.isArray(d) ? d : d.rows || []))
        .catch(() => {});
    }
  }, [showForm]);

  useEffect(() => { fetchReport(); }, [reportFrom, reportTo, reportGroupBy, reportType, reportSiteId]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (!isAdmin) params.set('userId', String(currentUserId));
      const r = await fetch(`${API_BASE_URL}/api/worklogs?${params}`, { headers: authHeaders() });
      if (r.ok) {
        const d = await r.json();
        setLogs(d.rows);
        setTotal(d.total);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const fetchReport = async () => {
    setReportLoading(true);
    try {
      const p = new URLSearchParams({ from: reportFrom, to: reportTo, groupBy: reportGroupBy });
      if (reportType) p.set('type', reportType);
      if (reportSiteId) p.set('siteId', reportSiteId);
      if (!isAdmin) p.set('userId', String(currentUserId));
      const r = await fetch(`${API_BASE_URL}/api/worklogs/report?${p}`, { headers: authHeaders() });
      if (r.ok) setReportData(await r.json());
    } catch { /* ignore */ }
    finally { setReportLoading(false); }
  };

  const onTimeChange = (field: 'startTime' | 'endTime', value: string) => {
    const next = { ...form, [field]: value };
    const dur = calcDuration(
      field === 'startTime' ? value : next.startTime,
      field === 'endTime' ? value : next.endTime
    );
    if (dur !== null) next.durationMinutes = String(dur);
    setForm(next);
  };

  const toggleTeamMember = (uid: number) => {
    setForm(prev => ({
      ...prev,
      teamMembers: prev.teamMembers.includes(uid)
        ? prev.teamMembers.filter(id => id !== uid)
        : [...prev.teamMembers, uid]
    }));
  };

  const handleSave = async () => {
    if (!form.workDate || !form.description.trim()) {
      onToast({ message: 'Date et description requises', type: 'error' });
      return;
    }
    const dur = form.durationMinutes ? parseInt(form.durationMinutes, 10) : undefined;
    const data = {
      workDate: form.workDate,
      startTime: form.startTime || undefined,
      endTime: form.endTime || undefined,
      durationMinutes: dur,
      type: form.type,
      equipmentId: form.equipmentId ? Number(form.equipmentId) : undefined,
      siteId: form.siteId ? Number(form.siteId) : undefined,
      description: form.description.trim(),
      status: form.status,
      teamMembers: form.teamMembers,
    };
    try {
      const r = await fetch(`${API_BASE_URL}/api/worklogs`, {
        method: editingId ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data),
      });
      if (!r.ok) throw Error();
      const saved = await r.json();
      if (editingId) {
        setLogs(prev => prev.map(l => l.id === editingId ? { ...l, ...saved } : l));
      } else {
        setLogs(prev => [saved, ...prev]);
      }
      onToast({ message: editingId ? 'Modifié' : 'Créé', type: 'success' });
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
    } catch { onToast({ message: 'Erreur', type: 'error' }); }
  };

  const editLog = (log: WorkLog) => {
    setEditingId(log.id);
    setForm({
      workDate: log.workDate,
      startTime: log.startTime || '',
      endTime: log.endTime || '',
      durationMinutes: log.durationMinutes ? String(log.durationMinutes) : '',
      type: log.type,
      equipmentId: log.equipmentId ? String(log.equipmentId) : '',
      siteId: log.siteId ? String(log.siteId) : '',
      description: log.description,
      status: log.status,
      teamMembers: log.teamMembers || [],
    });
    setShowForm(true);
  };

  const deleteLog = (id: number) => {
    onConfirm({
      message: 'Supprimer cette entrée ?',
      onConfirm: async () => {
        try {
          const r = await fetch(`${API_BASE_URL}/api/worklogs/${id}`, { method: 'DELETE', headers: authHeaders() });
          if (r.ok) {
            setLogs(prev => prev.filter(l => l.id !== id));
            onToast({ message: 'Supprimé', type: 'success' });
          }
        } catch { onToast({ message: 'Erreur', type: 'error' }); }
      }
    });
  };

  const exportCSV = async () => {
    const r = await fetch(`${API_BASE_URL}/api/worklogs?limit=10000`, { headers: authHeaders() });
    if (!r.ok) return;
    const data = await r.json();
    const rows = data.rows.map((l: WorkLog) => [
      l.workDate, l.userName, (l.teamMemberInfo || []).map((m: any) => m.name).join(', '),
      l.type, l.equipmentName || '', l.siteName || '',
      l.startTime || '', l.endTime || '',
      l.durationMinutes ? String(l.durationMinutes) : '',
      l.description, l.status
    ]);
    const header = ['Date', 'Technicien', 'Équipe', 'Type', 'Équipement', 'Site', 'Début', 'Fin', 'Durée(min)', 'Description', 'Statut'];
    const csv = [header, ...rows].map((r: string[]) => r.map((v: string) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `feuille-temps-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportReport = () => {
    const rows = reportData.map(r => [r.period, r.type, String(r.count), String(r.totalMinutes)]);
    const header = ['Période', 'Type', 'Nombre', 'Durée(min)'];
    const csv = [header, ...rows].map((r: string[]) => r.map((v: string) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderReport = () => (
    <div className="flex-1 flex flex-col">
      <div className="p-4 flex items-center gap-3 flex-wrap bg-white border-b border-gray-200">
        <div className="flex items-center gap-1 text-sm">
          <label className="text-gray-500">Du</label>
          <input type="date" value={reportFrom} onChange={e => setReportFrom(e.target.value)}
            className="px-2 py-1 border border-gray-200 rounded text-sm" />
          <label className="text-gray-500">Au</label>
          <input type="date" value={reportTo} onChange={e => setReportTo(e.target.value)}
            className="px-2 py-1 border border-gray-200 rounded text-sm" />
        </div>
        <select value={reportType} onChange={e => setReportType(e.target.value)}
          className="px-2 py-1 border border-gray-200 rounded text-sm">
          <option value="">Tous types</option>
          {workLogTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={reportSiteId} onChange={e => setReportSiteId(e.target.value)}
          className="px-2 py-1 border border-gray-200 rounded text-sm">
          <option value="">Tous sites</option>
          {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={reportGroupBy} onChange={e => setReportGroupBy(e.target.value as any)}
          className="px-2 py-1 border border-gray-200 rounded text-sm">
          <option value="day">Par jour</option>
          <option value="week">Par semaine</option>
          <option value="month">Par mois</option>
        </select>
        <button onClick={fetchReport} disabled={reportLoading}
          className="px-3 py-1 text-sm bg-[#1a6fa6] text-white rounded-lg hover:bg-[#155a8a] disabled:opacity-50">
          {reportLoading ? '...' : 'Filtrer'}
        </button>
        {reportData.length > 0 && (
          <button onClick={exportReport}
            className="px-3 py-1 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-1">
            <Download className="w-4 h-4" /> CSV
          </button>
        )}
      </div>
      <div className="flex-1 overflow-auto">
        {reportData.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Aucune donnée</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left text-gray-500">Période</th>
                <th className="px-4 py-2 text-left text-gray-500">Type</th>
                <th className="px-4 py-2 text-right text-gray-500">Nb</th>
                <th className="px-4 py-2 text-right text-gray-500">Durée</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reportData.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-1.5">{r.period}</td>
                  <td className="px-4 py-1.5">
                    <span className="px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700">{r.type}</span>
                  </td>
                  <td className="px-4 py-1.5 text-right">{r.count}</td>
                  <td className="px-4 py-1.5 text-right font-mono">{r.totalMinutes} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  const renderForm = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">
            {editingId ? 'Modifier' : 'Nouvelle entrée'}
          </h3>
          <button onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}
            className="p-1 rounded hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date *</label>
              <input type="date" value={form.workDate} onChange={e => setForm({ ...form, workDate: e.target.value })}
                required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1a6fa6]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                {workLogTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Début</label>
              <input type="time" value={form.startTime}
                onChange={e => onTimeChange('startTime', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fin</label>
              <input type="time" value={form.endTime}
                onChange={e => onTimeChange('endTime', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Durée (min)</label>
              <input type="number" value={form.durationMinutes}
                onChange={e => setForm({ ...form, durationMinutes: e.target.value })} min="1"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Intervenants</label>
            <div className="flex flex-wrap gap-1.5 p-2 border border-gray-200 rounded-lg min-h-[2.2rem]">
              {users.filter(u => u.id !== currentUserId).map(u => {
                const selected = form.teamMembers.includes(u.id);
                return (
                  <button key={u.id} type="button" onClick={() => toggleTeamMember(u.id)}
                    className={`px-2 py-0.5 text-xs rounded-full border transition ${
                      selected
                        ? 'bg-[#1a6fa6] text-white border-[#1a6fa6]'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}>
                    {u.name}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Cliquez pour ajouter/retirer des intervenants</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Site</label>
              <select value={form.siteId} onChange={e => { setForm({ ...form, siteId: e.target.value, equipmentId: '' }); }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="">—</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Équipement</label>
              <select value={form.equipmentId} onChange={e => setForm({ ...form, equipmentId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="">—</option>
                {equipments
                  .filter(eq => !form.siteId || eq.siteId === Number(form.siteId))
                  .map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description *</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              rows={2} required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
              placeholder="Détails du travail..." />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
              Annuler
            </button>
            <button type="submit"
              className="px-4 py-2 text-sm bg-[#1a6fa6] text-white rounded-lg hover:bg-[#155a8a] flex items-center gap-1">
              <CheckCircle className="w-4 h-4" />
              {editingId ? 'Enregistrer' : 'Ajouter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <ModuleShell
      icon={<Clock className="w-5 h-5" />}
      title={tab === 'report' ? 'Rapports' : 'Feuille de temps'}
      subtitle={tab === 'report' ? 'Statistiques par période' : 'Saisie des interventions'}
      onClose={onClose}
      actions={
        <>
          {tab === 'list' && canWrite && (
            <button onClick={() => { setEditingId(null); setForm(emptyForm); setShowForm(true); }}
              className="px-3 py-1.5 text-sm bg-[#1a6fa6] text-white rounded-lg hover:bg-[#155a8a] flex items-center gap-1">
              <Plus className="w-4 h-4" /> Nouvelle
            </button>
          )}
          <button onClick={() => setTab(tab === 'list' ? 'report' : 'list')}
            className={`px-3 py-1.5 text-sm rounded-lg flex items-center gap-1 ${
              tab === 'list' ? 'bg-[#1a6fa6] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}>
            <FileText className="w-4 h-4" />
            {tab === 'list' ? 'Rapport' : 'Liste'}
          </button>
          {tab === 'list' && (
            <button onClick={exportCSV}
              className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-1">
              <Download className="w-4 h-4" /> CSV
            </button>
          )}
        </>
      }
    >
      {tab === 'report' ? renderReport() : (
        <div className="flex-1 flex flex-col">
          {showForm && renderForm()}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32 text-gray-500">Chargement...</div>
            ) : logs.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-400">Aucune entrée</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-gray-500 font-medium">Date</th>
                    <th className="px-4 py-2 text-left text-gray-500 font-medium">Intervenant(s)</th>
                    <th className="px-4 py-2 text-left text-gray-500 font-medium">Type</th>
                    <th className="px-4 py-2 text-left text-gray-500 font-medium">Détails</th>
                    <th className="px-4 py-2 text-left text-gray-500 font-medium">Durée</th>
                    <th className="px-4 py-2 text-right text-gray-500 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 whitespace-nowrap">{new Date(log.workDate).toLocaleDateString('fr-FR')}</td>
                      <td className="px-4 py-2">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-gray-800">{log.userName}</span>
                          {log.teamMemberInfo && log.teamMemberInfo.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {log.teamMemberInfo.map((m: any) => (
                                <span key={m.id} className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">{m.name}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <span className="px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700">
                          {workLogTypes.find(t => t.value === log.type)?.label || log.type}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-600 max-w-xs truncate">
                        {log.description}
                        {log.equipmentName && <span className="ml-2 text-blue-500 text-xs">{log.equipmentName}</span>}
                        {log.siteName && <span className="ml-1 text-green-500 text-xs">{log.siteName}</span>}
                      </td>
                      <td className="px-4 py-2 font-mono text-gray-700">
                        {log.durationMinutes ? `${log.durationMinutes} min` : '-'}
                      </td>
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        <button onClick={() => editLog(log)}
                          className="p-1 rounded hover:bg-blue-50 text-blue-600" title="Modifier">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteLog(log.id)}
                          className="p-1 rounded hover:bg-red-50 text-red-600 ml-1" title="Supprimer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 p-3 border-t border-gray-100">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-30">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-600">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-30">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </ModuleShell>
  );
}