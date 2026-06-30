import React, { useState } from 'react';
import { Archive, X } from 'lucide-react';
import { authHeaders } from '../utils/helpers';
import { API_BASE } from '../constants';
import { useToast } from '../components/Toast';
import type { Equipment, ReformForm as ReformFormType } from '../types';

interface ReformModuleProps {
  equipments: Equipment[];
  reformTarget: Equipment;
  onClose: () => void;
  onReformed: (updated: Equipment) => void;
}

export default function ReformModule({ equipments, reformTarget, onClose, onReformed }: ReformModuleProps) {
  const tc = useToast();
  const [reformForm, setReformForm] = useState<ReformFormType>({ reason: '', replacedById: null, notes: '', reformQty: reformTarget.quantity ?? 1 });
  const [reformLoading, setReformLoading] = useState(false);

  const handleReform = async () => {
    if (!reformForm.reason.trim()) { tc.error('Veuillez indiquer la raison de la réforme.'); return; }
    setReformLoading(true);
    try {
      const r = await fetch(`${API_BASE}/${reformTarget.id}/reform`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(reformForm),
      });
      if (!r.ok) throw new Error();
      const updated = await r.json();
      onReformed(updated);
      onClose();
    } catch {
      tc.error('Impossible de réformer cet équipement.');
    }
    setReformLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[90vh]">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-[#e8f3fc] flex items-center justify-center shrink-0">
            <Archive className="w-5 h-5 text-[#1a6fa6]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-gray-900">Réformer l'équipement</h2>
            <p className="text-xs text-gray-400 truncate">{reformTarget.name}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 shrink-0">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
            {(reformTarget.quantity ?? 1) > 1 && reformForm.reformQty < (reformTarget.quantity ?? 1)
              ? <><strong>{reformForm.reformQty}</strong> unité(s) seront réformées. Il restera <strong>{(reformTarget.quantity ?? 1) - reformForm.reformQty}</strong> unité(s) en stock.</>
              : <>Cet équipement sera marqué comme <strong>réformé (mis au rebut)</strong> et ne pourra plus être transféré ni mis en maintenance.</>
            }
          </div>

          {(reformTarget.quantity ?? 1) > 1 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantité à réformer <span className="text-gray-400 font-normal">(stock : {reformTarget.quantity})</span>
              </label>
              <input type="number" min={1} max={reformTarget.quantity}
                value={reformForm.reformQty}
                onChange={e => setReformForm(f => ({ ...f, reformQty: Math.min(Math.max(1, parseInt(e.target.value) || 1), reformTarget.quantity ?? 1) }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6]" />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Raison de la réforme *</label>
            <select value={reformForm.reason} onChange={e => setReformForm(f => ({ ...f, reason: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6]">
              <option value="">— Sélectionner —</option>
              <option>Fin de vie / obsolescence</option>
              <option>Défaillance irréparable</option>
              <option>Casse / sinistre</option>
              <option>Vol / perte</option>
              <option>Remplacement planifié</option>
              <option>Autre</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Remplacé par un équipement existant</label>
            <select value={reformForm.replacedById ?? ''} onChange={e => setReformForm(f => ({ ...f, replacedById: e.target.value ? Number(e.target.value) : null }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6]">
              <option value="">— Aucun remplacement ou non encore enregistré —</option>
              {equipments.filter(e => e.id !== reformTarget.id && e.status !== 'réformé').map(e => (
                <option key={e.id} value={e.id}>{e.name} — {e.location}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes complémentaires</label>
            <textarea rows={2} value={reformForm.notes} onChange={e => setReformForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Informations supplémentaires…"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6]" />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 text-sm">Annuler</button>
          <button onClick={handleReform} disabled={reformLoading || !reformForm.reason}
            className="px-4 py-2 bg-[#1a6fa6] text-white rounded hover:bg-[#155a8a] text-sm disabled:opacity-50 flex items-center gap-2">
            {reformLoading && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            <Archive className="w-4 h-4" /> Confirmer la réforme
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
