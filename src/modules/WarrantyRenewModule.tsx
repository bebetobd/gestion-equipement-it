import React, { useState } from 'react';
import { Search, ShieldCheck } from 'lucide-react';
import { ModuleShell } from '../components/ModuleShell';

interface Equipment {
  id: number;
  name: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  type: string;
  warranty: string;
}

interface WarrantyRenewModuleProps {
  equipments: Equipment[];
  onClose: () => void;
  onRenew: (equipmentId: number, newDate: string) => Promise<void>;
  getWarrantyInfo: (warranty: string) => { label: string; color: string } | null;
  getTypeIcon: (type: string) => React.ReactNode;
}

export default function WarrantyRenewModule({ equipments, onClose, onRenew, getWarrantyInfo, getTypeIcon }: WarrantyRenewModuleProps) {
  const [search, setSearch] = useState('');
  const [renewEquipId, setRenewEquipId] = useState<number | null>(null);
  const [renewDate, setRenewDate] = useState('');
  const [saving, setSaving] = useState(false);

  const handleRenew = async (id: number, date: string) => {
    if (!date || saving) return;
    setSaving(true);
    try {
      await onRenew(id, date);
    } finally {
      setSaving(false);
      setRenewEquipId(null);
      setRenewDate('');
    }
  };

  const filter = (e: Equipment) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return e.name.toLowerCase().includes(q) || e.brand?.toLowerCase().includes(q) || e.model?.toLowerCase().includes(q) || e.serialNumber?.toLowerCase().includes(q);
  };

  const filtered = equipments.filter(filter);
  const displayed = filtered.slice(0, 50);

  return (
    <ModuleShell
      icon={<ShieldCheck className="w-5 h-5 text-white" />}
      title="Renouvellement de garantie"
      subtitle="Prolonger la garantie d'un équipement"
      onClose={onClose}
    >
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Rechercher un équipement par nom, marque ou modèle…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:outline-none" />
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="divide-y divide-gray-100">
              {displayed.map(eq => {
                const wInfo = getWarrantyInfo(eq.warranty);
                const isRenewing = renewEquipId === eq.id;
                return (
                  <div key={eq.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      {getTypeIcon(eq.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{eq.name}</p>
                      <p className="text-xs text-gray-400 truncate">{eq.brand} {eq.model} · {eq.serialNumber || 'N/A'}</p>
                    </div>
                    <div className="shrink-0 text-right min-w-[130px]">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${wInfo ? wInfo.color : 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                        {wInfo ? wInfo.label : 'Non renseignée'}
                      </span>
                    </div>
                    {isRenewing ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <input type="date" value={renewDate}
                          onChange={e => setRenewDate(e.target.value)}
                          className="w-40 px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1a6fa6]" />
                        <button onClick={() => handleRenew(eq.id, renewDate)} disabled={!renewDate || saving}
                          className="px-3 py-1.5 bg-[#1a6fa6] text-white rounded-lg text-xs font-medium hover:bg-[#155a8a] disabled:opacity-50 transition-colors">
                          {saving ? '…' : 'Confirmer'}
                        </button>
                        <button onClick={() => { setRenewEquipId(null); setRenewDate(''); }}
                          className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors">
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => { setRenewEquipId(eq.id); setRenewDate(eq.warranty || ''); }}
                        className="shrink-0 px-3 py-1.5 bg-[#e8f3fc] text-[#1a6fa6] rounded-lg text-xs font-medium hover:bg-[#d0e6f7] transition-colors">
                        Renouveler
                      </button>
                    )}
                  </div>
                );
              })}
              {displayed.length === 0 && (
                <div className="text-center py-12 text-gray-400 text-sm">Aucun équipement trouvé.</div>
              )}
            </div>
          </div>
          {filtered.length > 50 && (
            <p className="text-xs text-gray-400 text-center">Affichage des 50 premiers résultats. Utilisez la recherche pour préciser.</p>
          )}
        </div>
      </div>
    </ModuleShell>
  );
}
