import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, Wifi, WifiOff, Search, RefreshCcw, Monitor, Server, Printer, Network, HardDrive } from 'lucide-react';
import { ModuleShell } from '../components/ModuleShell';
import { authHeaders } from '../utils/helpers';
import { API_BASE_URL } from '../constants';

interface NetworkEquipment {
  id: number;
  name: string;
  ip_address: string;
  type: string;
  location: string;
  department: string;
  reachable: boolean;
}

interface NetworkMonitorModuleProps {
  onClose: () => void;
  onUnauthorized: () => void;
  onToast: (t: { message: string; type: 'error' | 'success' | 'info' } | null) => void;
}

const typeIcons: Record<string, React.ReactNode> = {
  serveur: <Server className="w-4 h-4" />,
  imprimante: <Printer className="w-4 h-4" />,
  reseau: <Network className="w-4 h-4" />,
  ordinateur: <Monitor className="w-4 h-4" />,
};

const typeColors: Record<string, string> = {
  serveur: 'from-purple-500 to-violet-600',
  imprimante: 'from-amber-500 to-orange-600',
  reseau: 'from-cyan-500 to-blue-600',
  ordinateur: 'from-emerald-500 to-teal-600',
};

export default function NetworkMonitorModule({ onClose, onUnauthorized, onToast }: NetworkMonitorModuleProps) {
  const [equipments, setEquipments] = useState<NetworkEquipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const prevStatusRef = useRef<Map<number, boolean>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE_URL}/api/network-monitor`, { method: 'POST', headers: authHeaders() });
      if (res.status === 401) { onUnauthorized(); return; }
      if (!res.ok) { setError('Erreur lors de la récupération du statut réseau.'); return; }
      const data: NetworkEquipment[] = await res.json();

      const prev = prevStatusRef.current;
      const changes: { name: string; wentOffline: boolean }[] = [];

      data.forEach(eq => {
        if (prev.has(eq.id) && prev.get(eq.id) !== eq.reachable) {
          changes.push({ name: eq.name, wentOffline: !eq.reachable });
        }
        prev.set(eq.id, eq.reachable);
      });

      if (changes.length > 0 && onToast) {
        changes.forEach(c => {
          onToast({
            message: `${c.name} ${c.wentOffline ? 'est hors ligne' : 'est de nouveau en ligne'}`,
            type: c.wentOffline ? 'error' : 'success',
          });
        });
      }

      setEquipments(data);
      setLastRefresh(new Date());
    } catch {
      setError('Erreur réseau.');
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized, onToast]);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 30000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  const filtered = equipments.filter(eq =>
    !filter || eq.name.toLowerCase().includes(filter.toLowerCase()) || eq.ip_address.includes(filter) || eq.type.toLowerCase().includes(filter.toLowerCase()) || eq.department.toLowerCase().includes(filter.toLowerCase())
  );

  const onlineCount = equipments.filter(e => e.reachable).length;
  const offlineCount = equipments.filter(e => !e.reachable).length;

  return (
    <ModuleShell
      icon={<Activity className="w-5 h-5 text-white" />}
      title="Surveillance réseau temps réel"
      subtitle={`${equipments.length} équipement(s) · ${onlineCount} en ligne · ${offlineCount} hors ligne · auto 30s`}
      onClose={onClose}
      actions={
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-white/70">
            {loading
              ? <div className="w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
              : <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
            <span>{loading ? 'Scan…' : lastRefresh ? lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}</span>
          </div>
          <button onClick={fetchStatus} className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20 transition-colors">
            <RefreshCcw className="w-3.5 h-3.5" /> Actualiser
          </button>
        </div>
      }
    >
      {/* Stats bar */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-1.5 text-sm"><div className="w-2.5 h-2.5 rounded-full bg-green-500" /><span className="font-semibold text-gray-700">{onlineCount}</span><span className="text-gray-400">en ligne</span></div>
        <div className="w-px h-4 bg-gray-200" />
        <div className="flex items-center gap-1.5 text-sm"><div className="w-2.5 h-2.5 rounded-full bg-red-500" /><span className="font-semibold text-gray-700">{offlineCount}</span><span className="text-gray-400">hors ligne</span></div>
        <div className="w-px h-4 bg-gray-200" />
        <div className="flex items-center gap-1.5 text-sm"><div className="w-2.5 h-2.5 rounded-full bg-gray-300" /><span className="font-semibold text-gray-700">{equipments.length}</span><span className="text-gray-400">total</span></div>
        <div className="flex-1" />
        <div className="relative max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Filtrer…" value={filter} onChange={e => setFilter(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:outline-none" />
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {equipments.length === 0 && !loading && !error && (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
          <WifiOff className="w-12 h-12 mb-3 opacity-30" />
          <p className="font-semibold text-gray-500">Aucun équipement réseau</p>
          <p className="text-sm mt-1">Ajoutez des équipements avec une adresse IP pour les surveiller.</p>
        </div>
      )}

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(eq => {
            const Icon = typeIcons[eq.type] || <HardDrive className="w-4 h-4" />;
            const grad = typeColors[eq.type] || 'from-gray-500 to-gray-600';
            return (
              <div key={eq.id} className={`bg-white rounded-xl shadow-sm border transition-all hover:shadow-md ${eq.reachable ? 'border-gray-100' : 'border-red-200 bg-red-50/30'}`}>
                <div className="flex items-start gap-3 p-4">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center text-white shrink-0`}>
                    {Icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 truncate">{eq.name}</p>
                      {eq.reachable
                        ? <Wifi className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        : <WifiOff className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                    </div>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">{eq.ip_address}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                      {eq.type && <span className="capitalize">{eq.type}</span>}
                      {eq.location && <span>{eq.location}</span>}
                      {eq.department && <span>{eq.department}</span>}
                    </div>
                  </div>
                  <div className="shrink-0">
                    <div className={`w-2.5 h-2.5 rounded-full ${eq.reachable ? 'bg-green-500 shadow-sm shadow-green-300' : 'bg-red-500 shadow-sm shadow-red-300'}`} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {filtered.length === 0 && equipments.length > 0 && (
          <div className="text-center py-16 text-gray-400 text-sm">Aucun résultat pour "{filter}"</div>
        )}
      </div>
    </ModuleShell>
  );
}
