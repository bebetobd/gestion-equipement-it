import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { ModuleShell } from '../components/ModuleShell';
import { authHeaders } from '../utils/helpers';
import { API_BASE_URL } from '../constants';
import type { AnomalyItem } from '../types';

interface AnomaliesModuleProps {
  onClose: () => void;
  onOpenMaintenance: () => void;
}

export default function AnomaliesModule({ onClose, onOpenMaintenance }: AnomaliesModuleProps) {
  const [anomalies, setAnomalies] = useState<AnomalyItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`${API_BASE_URL}/api/anomalies`, { headers: authHeaders() });
        if (r.ok) setAnomalies(await r.json());
      } catch (err) { console.error(err); }
      setLoading(false);
    })();
  }, []);

  return (
    <ModuleShell
      icon={<AlertTriangle className="w-5 h-5 text-white" />}
      title="Détection d'anomalies"
      subtitle="Équipements avec ≥ 3 pannes sur 6 mois"
      onClose={onClose}
    >
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="text-center py-16 text-gray-400"><div className="skeleton h-4 w-48 mx-auto" /><div className="skeleton h-3 w-32 mx-auto mt-2" /></div>
        ) : anomalies.length === 0 ? (
          <div className="text-center py-16">
            <CheckCircle className="w-16 h-16 mx-auto text-green-400 mb-4" />
            <p className="text-lg font-bold text-gray-700">Aucune anomalie détectée</p>
            <p className="text-sm text-gray-400 mt-1">Tous vos équipements semblent normaux.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
              <p className="text-sm font-bold text-orange-800">{anomalies.length} équipement{anomalies.length > 1 ? 's' : ''} nécessite{anomalies.length === 1 ? '' : 'nt'} une attention particulière</p>
              <p className="text-xs text-orange-600 mt-0.5">Ces équipements ont subi ≥ 3 pannes ou maintenances ces 6 derniers mois.</p>
            </div>
            {anomalies.map(a => (
              <div key={a.id} className="bg-white rounded-xl shadow-sm border border-red-100 p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                  <span className="text-xl font-black text-red-600">{a.ticket_count}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900">{a.name}</p>
                  <p className="text-xs text-gray-500">{a.type} · {a.department} · {a.location}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Dernière panne : {a.last_ticket ? new Date(a.last_ticket).toLocaleDateString('fr-FR') : '—'}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-xs bg-red-100 text-red-700 font-bold px-2 py-1 rounded-lg">{a.ticket_count} tickets</span>
                  <button onClick={() => { onClose(); onOpenMaintenance(); }} className="block text-xs text-[#1a6fa6] hover:underline mt-1">Voir maintenance →</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModuleShell>
  );
}
