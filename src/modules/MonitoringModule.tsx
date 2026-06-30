import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Activity, Wifi, Clock, RefreshCcw } from 'lucide-react';
import { ModuleShell } from '../components/ModuleShell';
import { Pagination as SharedPagination } from '../components/Pagination';
import { authHeaders, isOnline, formatDateTime, formatDuration, getActionStyle } from '../utils/helpers';
import { API_BASE_URL, PAGE_SIZE, roleDisplay } from '../constants';
import type { SessionInfo, ActivityEntry } from '../types';

interface MonitoringModuleProps {
  onClose: () => void;
  onUnauthorized: () => void;
}

function Pagination({ total, page, onChange }: { total: number; page: number; onChange: (p: number) => void }) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  return <SharedPagination currentPage={page} totalPages={totalPages} totalItems={total} pageSize={PAGE_SIZE} onPageChange={onChange} />;
}

export default function MonitoringModule({ onClose, onUnauthorized }: MonitoringModuleProps) {
  const [monitoringTab, setMonitoringTab] = useState<'sessions' | 'activities'>('sessions');
  const [activeSessions, setActiveSessions] = useState<SessionInfo[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityEntry[]>([]);
  const [activityUserFilter, setActivityUserFilter] = useState<number | null>(null);
  const [monitoringLoading, setMonitoringLoading] = useState(false);
  const [monitoringLastRefresh, setMonitoringLastRefresh] = useState<Date | null>(null);
  const [activityPage, setActivityPage] = useState(1);
  const activityUserFilterRef = useRef<number | null>(null);

  const pagedActivityLogs = useMemo(() =>
    activityLogs.slice((activityPage - 1) * PAGE_SIZE, activityPage * PAGE_SIZE),
    [activityLogs, activityPage]
  );

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/sessions`, { headers: authHeaders() });
      if (res.status === 401) { onUnauthorized(); return; }
      if (res.ok) setActiveSessions(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchActivities = async (userId?: number | null) => {
    try {
      const qs = userId != null ? `?userId=${userId}&limit=200` : '?limit=200';
      const res = await fetch(`${API_BASE_URL}/api/admin/activities${qs}`, { headers: authHeaders() });
      if (res.status === 401) { onUnauthorized(); return; }
      if (res.ok) setActivityLogs(await res.json());
    } catch (err) { console.error(err); }
  };

  const refreshMonitoring = async () => {
    setMonitoringLoading(true);
    await Promise.all([fetchSessions(), fetchActivities(activityUserFilterRef.current)]);
    setMonitoringLoading(false);
    setMonitoringLastRefresh(new Date());
  };

  useEffect(() => { setActivityPage(1); }, [activityUserFilter]);

  useEffect(() => {
    refreshMonitoring();
  }, []);

  useEffect(() => {
    const id = setInterval(() => refreshMonitoring(), 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <ModuleShell
      icon={<Activity className="w-5 h-5 text-white" />}
      title="Monitoring en temps réel"
      subtitle={`${activeSessions.filter(s => isOnline(s.lastSeen)).length} en ligne · ${activeSessions.filter(s => !isOnline(s.lastSeen)).length} inactif(s) · rafraîchissement auto toutes les 30s`}
      onClose={onClose}
      actions={<>
        <div className="flex items-center gap-1.5 text-xs text-white/70">
          {monitoringLoading
            ? <div className="w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            : <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
          <span>
            {monitoringLoading
              ? 'Actualisation…'
              : monitoringLastRefresh
                ? `Actualisé à ${monitoringLastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                : 'En direct'}
          </span>
        </div>
        <button
          onClick={refreshMonitoring}
          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
        >
          <RefreshCcw className="w-3.5 h-3.5" />
          Actualiser
        </button>
      </>}
    >
      {/* Tabs */}
      <div className="flex gap-1 px-6 pt-3 border-b border-gray-100">
        <button
          onClick={() => setMonitoringTab('sessions')}
          className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${monitoringTab === 'sessions' ? 'border-[#1a6fa6] text-[#1a6fa6]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <span className="flex items-center gap-2">
            <Wifi className="w-4 h-4" />
            Sessions actives
            {(() => {
              const onlineCount = activeSessions.filter(s => isOnline(s.lastSeen)).length;
              return (
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${onlineCount > 0 ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                  {onlineCount} / {activeSessions.length}
                </span>
              );
            })()}
          </span>
        </button>
        <button
          onClick={() => setMonitoringTab('activities')}
          className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${monitoringTab === 'activities' ? 'border-[#1a6fa6] text-[#1a6fa6]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <span className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Journal d'activité
            <span className="rounded-full px-2 py-0.5 text-xs font-bold bg-gray-200 text-gray-600">
              {activityLogs.length}
            </span>
          </span>
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {/* ── Sessions tab ── */}
        {monitoringTab === 'sessions' && (
          <div className="p-6">
            {activeSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Wifi className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">Aucune session active pour le moment.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {[...activeSessions].sort((a, b) => (isOnline(b.lastSeen) ? 1 : 0) - (isOnline(a.lastSeen) ? 1 : 0)).map((session) => {
                  const online = isOnline(session.lastSeen);
                  const info = roleDisplay[session.role] ?? { label: session.role, classes: 'bg-gray-100 text-gray-700' };
                  return (
                    <div key={session.userId} className={`rounded-xl border-2 p-4 ${online ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        {/* Identity */}
                        <div className="flex items-center gap-3">
                          <div className={`relative flex items-center justify-center w-11 h-11 rounded-full font-bold text-lg ${online ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                            {session.name.charAt(0).toUpperCase()}
                            <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${online ? 'bg-green-500' : 'bg-gray-400'}`} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-900">{session.name}</span>
                              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${info.classes}`}>{info.label}</span>
                            </div>
                            <div className="text-xs text-gray-500">@{session.username}</div>
                          </div>
                        </div>
                        {/* Status badge */}
                        <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${online ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-green-600' : 'bg-gray-500'}`} />
                          {online ? 'En ligne' : 'Inactif'}
                        </div>
                      </div>

                      {/* Stats grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                        {[
                          { label: 'Connexion', value: formatDateTime(session.loginAt), grad: 'from-blue-50 to-cyan-50' },
                          { label: 'Dernière activité', value: formatDateTime(session.lastSeen), grad: 'from-emerald-50 to-teal-50' },
                          { label: 'Durée de session', value: formatDuration(session.loginAt), grad: 'from-amber-50 to-orange-50' },
                          { label: 'Adresse IP', value: session.ip, grad: 'from-gray-50 to-slate-50', mono: true },
                        ].map(s => (
                          <div key={s.label} className={`bg-gradient-to-br ${s.grad} rounded-lg p-2.5 border border-gray-100/50`}>
                            <div className="text-[10px] text-gray-500 mb-0.5 font-medium">{s.label}</div>
                            <div className={`text-xs font-semibold text-gray-800 ${s.mono ? 'font-mono' : ''}`}>{s.value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Quick activity link */}
                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={() => {
                            setActivityUserFilter(session.userId);
                            activityUserFilterRef.current = session.userId;
                            fetchActivities(session.userId);
                            setMonitoringTab('activities');
                          }}
                          className="text-xs text-[#1a6fa6] hover:text-[#0d4a73] underline"
                        >
                          Voir l'activité de {session.name} →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Activities tab ── */}
        {monitoringTab === 'activities' && (
          <div className="p-6">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span className="text-sm text-gray-600 font-medium">Filtrer par utilisateur :</span>
              <button
                onClick={() => {
                  setActivityUserFilter(null);
                  activityUserFilterRef.current = null;
                  fetchActivities(null);
                }}
                className={`rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${activityUserFilter === null ? 'bg-[#1a6fa6] text-white border-[#1a6fa6]' : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'}`}
              >
                Tous
              </button>
              {Array.from(new Map(activityLogs.map((a) => [a.userId, { id: a.userId, name: a.name, username: a.username }])).values()).map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    setActivityUserFilter(u.id);
                    activityUserFilterRef.current = u.id;
                    fetchActivities(u.id);
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${activityUserFilter === u.id ? 'bg-[#1a6fa6] text-white border-[#1a6fa6]' : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'}`}
                >
                  {u.name}
                </button>
              ))}
            </div>

            {activityLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Clock className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">Aucune activité enregistrée.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Date / Heure</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Utilisateur</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Détails</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {pagedActivityLogs.map((entry) => (
                      <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap font-mono">
                          {formatDateTime(entry.timestamp)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 text-xs">{entry.name}</div>
                          <div className="text-gray-400 text-xs">@{entry.username}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getActionStyle(entry.action)}`}>
                            {entry.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 max-w-xs truncate">{entry.details || '—'}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 font-mono whitespace-nowrap">{entry.ip}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination total={activityLogs.length} page={activityPage} onChange={setActivityPage} />
              </div>
            )}
          </div>
        )}
      </div>
    </ModuleShell>
  );
}
