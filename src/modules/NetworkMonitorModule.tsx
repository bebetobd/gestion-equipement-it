import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, Wifi, WifiOff, Search, RefreshCcw, Monitor, Server, Printer, Network, HardDrive, Radio, Plus, Laptop } from 'lucide-react';
import { ModuleShell } from '../components/ModuleShell';
import { authHeaders } from '../utils/helpers';
import { API_BASE_URL } from '../constants';

interface DBEquipment {
  id: number;
  name: string;
  ip_address: string;
  type: string;
  location: string;
  department: string;
  reachable: boolean;
}

interface DiscoveredDevice {
  ip: string;
  mac: string;
  hostname: string;
  reachable: boolean;
}

interface ScanResult {
  db: DBEquipment[];
  discovered: DiscoveredDevice[];
  stats: { dbTotal: number; dbOnline: number; discoveredTotal: number; discoveredOnline: number };
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
  const [dbEquipments, setDbEquipments] = useState<DBEquipment[]>([]);
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredDevice[]>([]);
  const [stats, setStats] = useState<ScanResult['stats']>({ dbTotal: 0, dbOnline: 0, discoveredTotal: 0, discoveredOnline: 0 });
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [tab, setTab] = useState<'db' | 'discovered'>('db');
  const [error, setError] = useState<string | null>(null);
  const prevStatusRef = useRef<Map<number, boolean>>(new Map());

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(API_BASE_URL + '/api/network-monitor', { method: 'POST', headers: authHeaders() });
      if (res.status === 401) { onUnauthorized(); return; }
      if (!res.ok) { setError('Erreur lors du scan reseau.'); return; }
      const data: ScanResult = await res.json();
      setDbEquipments(data.db);
      setDiscoveredDevices(data.discovered);
      setStats(data.stats);

      const prev = prevStatusRef.current;
      data.db.forEach(function(eq) {
        if (prev.has(eq.id) && prev.get(eq.id) !== eq.reachable) {
          if (onToast) {
            onToast({ message: eq.name + ' ' + (eq.reachable ? 'de nouveau en ligne' : 'hors ligne'), type: eq.reachable ? 'success' : 'error' });
          }
        }
        prev.set(eq.id, eq.reachable);
      });

      setLastRefresh(new Date());
    } catch (e) {
      setError('Erreur reseau.');
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized, onToast]);

  useEffect(function() {
    fetchStatus();
    var id = setInterval(fetchStatus, 30000);
    return function() { clearInterval(id); };
  }, [fetchStatus]);

  var filteredDb = dbEquipments.filter(function(eq) {
    if (!filter) return true;
    var q = filter.toLowerCase();
    return eq.name.toLowerCase().indexOf(q) !== -1
      || eq.ip_address.indexOf(q) !== -1
      || eq.type.toLowerCase().indexOf(q) !== -1
      || eq.department.toLowerCase().indexOf(q) !== -1;
  });

  var filteredDiscovered = discoveredDevices.filter(function(d) {
    if (!filter) return true;
    var q = filter.toLowerCase();
    return d.ip.indexOf(q) !== -1
      || d.mac.toLowerCase().indexOf(q) !== -1
      || d.hostname.toLowerCase().indexOf(q) !== -1;
  });

  return (
    <ModuleShell
      icon={<Radio className="w-5 h-5 text-white" />}
      title="Reseau - Decouverte automatique"
      subtitle={stats.dbTotal + ' en base · ' + stats.discoveredTotal + ' decouverts · ' + (stats.dbOnline + stats.discoveredOnline) + ' en ligne · auto 30s'}
      onClose={onClose}
      actions={
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-white/70">
            {loading
              ? <div className="w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
              : <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
            <span>{loading ? 'Scan...' : lastRefresh ? lastRefresh.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--'}</span>
          </div>
          <button onClick={fetchStatus} className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20 transition-colors">
            <RefreshCcw className="w-3.5 h-3.5" /> Scanner
          </button>
        </div>
      }
    >
      <div className="flex items-center gap-4 px-6 py-3 border-b border-gray-100 bg-gray-50/50 flex-wrap">
        <div className="flex items-center gap-1.5 text-sm"><div className="w-2.5 h-2.5 rounded-full bg-green-500" /><span className="font-semibold text-gray-700">{stats.dbOnline + stats.discoveredOnline}</span><span className="text-gray-400">en ligne</span></div>
        <div className="w-px h-4 bg-gray-200" />
        <div className="text-sm text-gray-400"><span className="font-semibold text-gray-700">{stats.dbTotal}</span> en base · <span className="font-semibold text-gray-700">{stats.discoveredTotal}</span> decouverts</div>
        <div className="w-px h-4 bg-gray-200" />
        <div className="flex gap-1">
          <button onClick={function() { setTab('db'); }} className={'px-3 py-1 text-xs rounded-full font-medium transition-colors ' + (tab === 'db' ? 'bg-[#1a6fa6] text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300')}>Base ({stats.dbTotal})</button>
          <button onClick={function() { setTab('discovered'); }} className={'px-3 py-1 text-xs rounded-full font-medium transition-colors ' + (tab === 'discovered' ? 'bg-[#1a6fa6] text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300')}>Reseau ({stats.discoveredTotal})</button>
        </div>
        <div className="flex-1" />
        <div className="relative max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Filtrer..." value={filter} onChange={function(e) { setFilter(e.target.value); }}
            className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:outline-none" />
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex-1 overflow-auto p-6">
        {tab === 'db' && (
          <div>
            {filteredDb.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <WifiOff className="w-12 h-12 mb-3 opacity-30" />
                <p className="font-semibold text-gray-500">Aucun equipement avec IP</p>
                <p className="text-sm mt-1">Ajoutez une adresse IP aux equipements pour les surveiller.</p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredDb.map(function(eq) {
                var Icon = typeIcons[eq.type] || <HardDrive className="w-4 h-4" />;
                var grad = typeColors[eq.type] || 'from-gray-500 to-gray-600';
                return (
                  <div key={eq.id} className={'bg-white rounded-xl shadow-sm border transition-all hover:shadow-md ' + (eq.reachable ? 'border-gray-100' : 'border-red-200 bg-red-50/30')}>
                    <div className="flex items-start gap-3 p-4">
                      <div className={'w-10 h-10 rounded-xl bg-gradient-to-br ' + grad + ' flex items-center justify-center text-white shrink-0'}>{Icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900 truncate">{eq.name}</p>
                          {eq.reachable ? <Wifi className="w-3.5 h-3.5 text-green-500 shrink-0" /> : <WifiOff className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                        </div>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{eq.ip_address}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                          <span className="capitalize">{eq.type}</span>
                          {eq.location && <span>{eq.location}</span>}
                          {eq.department && <span>{eq.department}</span>}
                        </div>
                      </div>
                      <div className={'w-2.5 h-2.5 rounded-full shrink-0 ' + (eq.reachable ? 'bg-green-500 shadow-sm shadow-green-300' : 'bg-red-500 shadow-sm shadow-red-300')} />
                    </div>
                  </div>
                );
              })}
            </div>
            {filteredDb.length === 0 && dbEquipments.length > 0 && <div className="text-center py-16 text-gray-400 text-sm">Aucun resultat pour "{filter}"</div>}
          </div>
        )}

        {tab === 'discovered' && (
          <div>
            {filteredDiscovered.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Radio className="w-12 h-12 mb-3 opacity-30" />
                <p className="font-semibold text-gray-500">Aucun equipement detecte</p>
                <p className="text-sm mt-1">Le scan ARP n'a rien trouve sur le reseau local.</p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredDiscovered.map(function(d) {
                var inDb = dbEquipments.find(function(e) { return e.ip_address === d.ip; });
                return (
                  <div key={d.ip} className={'bg-white rounded-xl shadow-sm border transition-all hover:shadow-md ' + (d.reachable ? 'border-gray-100' : 'border-red-200 bg-red-50/30')}>
                    <div className="flex items-start gap-3 p-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center text-white shrink-0">
                        <Laptop className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900 truncate">{d.hostname || d.ip}</p>
                          {d.reachable ? <Wifi className="w-3.5 h-3.5 text-green-500 shrink-0" /> : <WifiOff className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                        </div>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{d.ip}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                          <span className="font-mono">{d.mac}</span>
                          {inDb && <span className="text-[#1a6fa6] font-semibold">en base</span>}
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <div className={'w-2.5 h-2.5 rounded-full ' + (d.reachable ? 'bg-green-500 shadow-sm shadow-green-300' : 'bg-red-500 shadow-sm shadow-red-300')} />
                        {!inDb && d.reachable && (
                          <button onClick={function() { if (onToast) onToast({ message: 'Ajouter ' + (d.hostname || d.ip) + ' aux equipements ?', type: 'info' }); }}
                            className="text-[#1a6fa6] hover:text-[#0d4a73]" title="Ajouter comme equipement">
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {filteredDiscovered.length === 0 && discoveredDevices.length > 0 && <div className="text-center py-16 text-gray-400 text-sm">Aucun resultat pour "{filter}"</div>}
          </div>
        )}
      </div>
    </ModuleShell>
  );
}
