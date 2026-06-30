import React, { useState, useEffect } from 'react';
import { ClipboardList, RefreshCcw, Download, FileText, Users, LogOut, Edit } from 'lucide-react';
import { ModuleShell } from '../components/ModuleShell';
import * as ExportHelpers from '../utils/exportHelpers';
import { authHeaders } from '../utils/helpers';
import { API_BASE_URL } from '../constants';
import type { UserAccount } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ActivityLogModuleProps {
  onClose: () => void;
  userAccounts: UserAccount[];
}

export default function ActivityLogModule({ onClose, userAccounts }: ActivityLogModuleProps) {
  const [activityEntries, setActivityEntries] = useState<any[]>([]);
  const [activityLogLoading, setActivityLogLoading] = useState(false);
  const [activityFilter, setActivityFilter] = useState({ username: '', dateFrom: '', dateTo: '', action: '' });

  const fetchActivityLog = async (filter = activityFilter) => {
    setActivityLogLoading(true);
    try {
      const params = new URLSearchParams({ limit: '300' });
      if (filter.username) params.append('username', filter.username);
      if (filter.dateFrom) params.append('dateFrom', filter.dateFrom);
      if (filter.dateTo)   params.append('dateTo', filter.dateTo);
      if (filter.action)   params.append('action', filter.action);
      const r = await fetch(`${API_BASE_URL}/api/admin/activity-log?${params}`, { headers: authHeaders() });
      if (r.ok) setActivityEntries(await r.json());
    } catch (err) { console.error(err); }
    setActivityLogLoading(false);
  };

  useEffect(() => {
    fetchActivityLog();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchActivityLog(activityFilter), 400);
    return () => clearTimeout(timer);
  }, [activityFilter]);

  return (
    <ModuleShell
      icon={<ClipboardList className="w-5 h-5 text-white" />}
      title="Journal d'activité"
      subtitle={`${activityEntries.length} entrée(s) affichée(s)`}
      onClose={onClose}
    >
      {/* Filters */}
      <div className="px-4 lg:px-5 py-3 bg-white border-b border-gray-100 shrink-0">
        <div className="flex flex-wrap gap-2 items-center">
          <select value={activityFilter.username} onChange={e => setActivityFilter(f => ({ ...f, username: e.target.value }))}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#1a6fa6]">
            <option value="">— Tous —</option>
            {userAccounts.map((u: UserAccount) => <option key={u.id} value={u.username}>{u.name}</option>)}
          </select>
          <select value={activityFilter.action} onChange={e => setActivityFilter(f => ({ ...f, action: e.target.value }))}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#1a6fa6]">
            <option value="">— Toutes actions —</option>
            {['Connexion','Déconnexion','Ajout équipement','Modification équipement','Suppression équipement','Transfert équipement','Réforme équipement','Création utilisateur','Suppression utilisateur','Ticket maintenance','Ajout document','Export CSV'].map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <input type="date" value={activityFilter.dateFrom} onChange={e => setActivityFilter(f => ({ ...f, dateFrom: e.target.value }))}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#1a6fa6]" />
          <input type="date" value={activityFilter.dateTo} onChange={e => setActivityFilter(f => ({ ...f, dateTo: e.target.value }))}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#1a6fa6]" />
          <button onClick={() => { const reset = { username: '', dateFrom: '', dateTo: '', action: '' }; setActivityFilter(reset); fetchActivityLog(reset); }}
            className="px-3 py-1.5 border border-gray-200 text-gray-500 rounded-lg text-xs hover:bg-gray-50 transition-colors">
            <RefreshCcw className="w-3 h-3 inline mr-1" />Réinitialiser
          </button>
          <div className="ml-auto flex gap-1">
            <button onClick={async () => {
              const rows = activityEntries.map((e: any) => ({ 'Date': new Date(e.timestamp).toLocaleString('fr-FR'), 'Utilisateur': e.name, 'Login': e.username, 'Action': e.action, 'Détails': e.details, 'IP': e.ip }));
              await ExportHelpers.exportJsonToXlsx(rows, `journal-${new Date().toISOString().slice(0,10)}.xlsx`, 'Journal');
            }} className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs hover:bg-gray-50 transition-colors">
              <Download className="w-3 h-3" /> Excel
            </button>
            <button onClick={() => {
              const doc = new jsPDF({ orientation: 'landscape' });
              const dateStr = new Date().toLocaleDateString('fr-FR');
              doc.setFontSize(14); doc.text("Journal d'activité", 14, 14);
              doc.setFontSize(8); doc.text(`Exporté le ${dateStr} — ${activityEntries.length} entrée(s)`, 14, 21);
              autoTable(doc, { startY: 26, head: [['Date/Heure','Utilisateur','Action','Détails','IP']], body: activityEntries.map((e: any) => [new Date(e.timestamp).toLocaleString('fr-FR'), e.name, e.action, e.details||'—', e.ip||'—']), styles: { fontSize: 7, cellPadding: 2 }, headStyles: { fillColor: [13, 148, 136] } });
              doc.save(`journal-${new Date().toISOString().slice(0,10)}.pdf`);
            }} className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs hover:bg-gray-50 transition-colors">
              <FileText className="w-3 h-3" /> PDF
            </button>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      {activityEntries.length > 0 && (() => {
        const connexions   = activityEntries.filter((e: any) => e.action === 'Connexion').length;
        const modifications = activityEntries.filter((e: any) => e.action.includes('équipement') || e.action.includes('utilisateur') || e.action.includes('site')).length;
        const uniqueUsers  = new Set(activityEntries.map((e: any) => e.username)).size;
        return (
          <div className="px-4 lg:px-5 py-3 flex items-center gap-3 flex-wrap bg-white border-b border-gray-100 shrink-0 text-xs">
            {[
              { label: 'Total actions', value: activityEntries.length, icon: ClipboardList, color: 'text-teal-700', bg: 'bg-teal-50' },
              { label: 'Utilisateurs actifs', value: uniqueUsers, icon: Users, color: 'text-blue-700', bg: 'bg-blue-50' },
              { label: 'Connexions', value: connexions, icon: LogOut, color: 'text-emerald-700', bg: 'bg-emerald-50' },
              { label: 'Opérations', value: modifications, icon: Edit, color: 'text-purple-700', bg: 'bg-purple-50' },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <span key={label} className={`flex items-center gap-1.5 font-semibold px-2.5 py-1 rounded-lg ${bg} ${color}`}><Icon className="w-3 h-3" /> {value} {label}</span>
            ))}
          </div>
        );
      })()}

      {/* Table */}
      <div className="flex-1 overflow-auto p-4 lg:p-5">
        {activityLogLoading ? (
          <div className="flex items-center justify-center h-40 text-gray-400">
            <span className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mr-3" />
            <div className="skeleton h-4 w-40 mx-auto" />
          </div>
        ) : activityEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-3"><ClipboardList className="w-8 h-8 text-gray-300" /></div>
            <p className="font-medium text-gray-500">Aucune activité trouvée</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Date / Heure', 'Utilisateur', 'Action', 'Détails', 'IP'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {activityEntries.map((entry: any) => {
                  const isAuth = entry.action === 'Connexion' || entry.action === 'Déconnexion';
                  const isDanger = entry.action.includes('Suppression');
                  const isWrite = entry.action.includes('Ajout') || entry.action.includes('Création') || entry.action.includes('Réforme') || entry.action.includes('Transfert');
                  const badgeClass = isDanger ? 'bg-red-100 text-red-700' : isWrite ? 'bg-purple-100 text-purple-700' : isAuth ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600';
                  return (
                    <tr key={entry.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap font-mono">
                        {new Date(entry.createdAt).toLocaleString('fr-FR', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-400 to-cyan-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0 shadow-sm">
                            {entry.userName?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 text-sm">{entry.userName}</p>
                            <p className="text-xs text-gray-400">@{entry.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${badgeClass}`}>{entry.action}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-xs"><span className="line-clamp-2">{entry.details || '—'}</span></td>
                      <td className="px-4 py-3 text-xs text-gray-400 font-mono">{entry.ip || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ModuleShell>
  );
}
