import React, { useState } from 'react';
import { Headset, X } from 'lucide-react';
import { authHeaders } from '../utils/helpers';
import { API_BASE_URL } from '../constants/index';
import type { Equipment, MaintenanceForm, Site } from '../types/index';

interface Props {
  equipments: Equipment[];
  sites: Site[];
  onClose: () => void;
  onToast: (t: { message: string; type: 'error' | 'success' | 'info' } | null) => void;
  onSaved: () => void;
}

const defaultForm: MaintenanceForm = {
  equipmentId: null,
  failureDesc: '',
  diagnosis: '',
  solution: '',
  partsReplaced: '',
  technician: '',
  priority: 'normale',
  status: 'ouvert',
  requestType: 'assistance',
  callerName: '',
  callerPhone: '',
  callerReport: '',
};

export default function AssistanceModal({ equipments, sites, onClose, onToast, onSaved }: Props) {
  const [form, setForm] = useState<MaintenanceForm>({ ...defaultForm });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.failureDesc.trim()) {
      onToast({ message: 'Description requise.', type: 'error' });
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/maintenance`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(form),
      });
      if (r.ok) {
        onToast({ message: 'Demande d\'assistance envoyée.', type: 'success' });
        onSaved();
        onClose();
      } else {
        const d = await r.json().catch(() => ({}));
        onToast({ message: d.message || 'Erreur lors de l\'envoi.', type: 'error' });
      }
    } catch {
      onToast({ message: 'Erreur réseau.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-[#1a6fa6] to-blue-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <Headset className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Nouvelle demande d'assistance</h3>
              <p className="text-xs text-blue-100">Remplir les informations ci-dessous</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Site</label>
            <select
              value={form.siteId ?? ''}
              onChange={(e) => { const siteId = e.target.value ? Number(e.target.value) : null; setForm((f) => ({ ...f, siteId, equipmentId: null })); }}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none"
            >
              <option value="">— Tous les sites —</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.city ? ` — ${s.city}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Équipement concerné</label>
            <select
              value={form.equipmentId ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, equipmentId: e.target.value ? Number(e.target.value) : null }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none"
            >
              <option value="">— Sélectionner un équipement —</option>
              {equipments.filter(eq => !form.siteId || eq.siteId === form.siteId).map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.reference ? `[${eq.reference}] ` : ''}{eq.name} ({eq.location})
                </option>
              ))}
            </select>
          </div>

          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Appelant</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Nom</label>
                <input
                  type="text"
                  value={form.callerName}
                  onChange={(e) => setForm((f) => ({ ...f, callerName: e.target.value }))}
                  placeholder="Qui a appelé ?"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Téléphone</label>
                <input
                  type="text"
                  value={form.callerPhone}
                  onChange={(e) => setForm((f) => ({ ...f, callerPhone: e.target.value }))}
                  placeholder="Numéro de rappel"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none"
                />
              </div>
            </div>
            <div className="mt-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Ce qu'il a signalé</label>
              <textarea
                rows={2}
                value={form.callerReport}
                onChange={(e) => setForm((f) => ({ ...f, callerReport: e.target.value }))}
                placeholder="Problème rapporté par l'appelant…"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none resize-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={form.failureDesc}
              onChange={(e) => setForm((f) => ({ ...f, failureDesc: e.target.value }))}
              placeholder="Décrivez votre besoin…"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none resize-none"
            />
          </div>
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2.5 bg-gradient-to-r from-[#1a6fa6] to-blue-700 text-white rounded-xl text-sm font-semibold hover:from-[#155a8a] hover:to-[#0d4a73] shadow-sm transition-all disabled:opacity-50"
          >
            {loading ? 'Envoi…' : 'Envoyer la demande'}
          </button>
        </div>
      </div>
    </div>
  );
}
