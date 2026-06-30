import React, { useState } from 'react';
import { CheckCircle, Package } from 'lucide-react';
import { ModuleShell } from '../components/ModuleShell';
import type { Equipment } from '../types';

interface InventoryModuleProps {
  equipments: Equipment[];
  maskValue: (val: string) => string;
  pingResults: Record<number, boolean | null>;
  statusColors: Record<string, string>;
  onClose: () => void;
}

export default function InventoryModule({ equipments, maskValue, pingResults, statusColors, onClose }: InventoryModuleProps) {
  const [inventoryScanned, setInventoryScanned] = useState<Set<number>>(new Set());
  const [inventoryMissing, setInventoryMissing] = useState<Equipment[]>([]);

  const activeEquipments = equipments.filter(e => e.status !== 'réformé');

  return (
    <ModuleShell
      icon={<CheckCircle className="w-5 h-5 text-white" />}
      title="Inventaire physique guidé"
      subtitle={`${inventoryScanned.size}/${activeEquipments.length} équipements scannés`}
      onClose={onClose}
      actions={<>
        <button onClick={() => { setInventoryMissing(activeEquipments.filter(e => !inventoryScanned.has(e.id))); }} className="bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-3 py-1.5 rounded-lg">Voir manquants</button>
      </>}
    >
      <div className="bg-white px-6 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-600 mb-1.5">
          <span>Progression</span>
          <span className="font-bold">{Math.round(inventoryScanned.size / Math.max(1, activeEquipments.length) * 100)}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full"><div className="h-2 bg-green-500 rounded-full transition-all" style={{width: `${Math.round(inventoryScanned.size / Math.max(1, activeEquipments.length) * 100)}%`}} /></div>
      </div>
      <div className="flex-1 overflow-auto">
        {inventoryMissing.length > 0 && (
          <div className="p-4 bg-red-50 border-b border-red-100">
            <p className="text-sm font-bold text-red-700 mb-2">{inventoryMissing.length} équipement(s) non trouvé(s)</p>
            <div className="flex flex-wrap gap-2">{inventoryMissing.map(e => <span key={e.id} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-lg">{e.name}</span>)}</div>
          </div>
        )}
        <div className="divide-y divide-gray-100">
          {activeEquipments.map(e => {
            const scanned = inventoryScanned.has(e.id);
            return (
              <div key={e.id} className={`flex items-center gap-4 px-6 py-3 transition-colors ${scanned ? 'bg-green-50' : 'bg-white hover:bg-gray-50'}`}>
                <button onClick={() => setInventoryScanned(prev => { const next = new Set(prev); scanned ? next.delete(e.id) : next.add(e.id); return next; })}
                  className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${scanned ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'}`}>
                  {scanned && <CheckCircle className="w-4 h-4 text-white" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium ${scanned ? 'text-green-700 line-through' : 'text-gray-900'}`}>{e.name}</p>
                  <p className="text-xs text-gray-400">{e.location} · {e.department} · {maskValue(e.serialNumber)}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${statusColors[e.status]}`}>{e.status}</span>
                {e.ipAddress && pingResults[e.id] !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${pingResults[e.id] === null ? 'bg-gray-100 text-gray-500' : pingResults[e.id] ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {pingResults[e.id] === null ? '⏳' : pingResults[e.id] ? 'En ligne' : 'Hors ligne'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </ModuleShell>
  );
}
