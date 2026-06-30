import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, ArrowRightLeft, X, RefreshCcw, ChevronLeft, ChevronRight, Truck, Wrench, Calendar, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { ModuleShell, FilterBar } from '../components/ModuleShell';
import { authHeaders } from '../utils/helpers';
import { API_BASE_URL, PAGE_SIZE } from '../constants';
import type { RMARequest } from '../types';

interface RMAModuleProps {
  canWrite: boolean;
  canModify: boolean;
  maskValue: (val: string) => string;
  suppliers: { id: number; name: string }[];
  onClose: () => void;
  onToast: (t: { message: string; type: 'error' | 'success' | 'info' }) => void;
  onConfirm: (c: { message: string; onConfirm: () => void }) => void;
  onRMAUpdate?: (data: RMARequest[] | ((prev: RMARequest[]) => RMARequest[])) => void;
}

const cardGradients = ['from-amber-500 to-orange-600', 'from-cyan-500 to-blue-600', 'from-rose-500 to-pink-600', 'from-emerald-500 to-teal-600', 'from-violet-500 to-purple-600'];
const statusMeta: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  ouvert: { label: 'Ouvert', dot: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700' },
  expédié: { label: 'Expédié', dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700' },
  résolu: { label: 'Résolu', dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
};

export default function RMAModule({ canWrite, canModify, maskValue, suppliers, onClose, onToast, onConfirm, onRMAUpdate }: RMAModuleProps) {
  const [rmaRequests, setRMARequests] = useState<RMARequest[]>([]);
  const [rmaLoading, setRMALoading] = useState(false);
  const [rmaSearch, setRMASearch] = useState('');
  const [rmaPage, setRMAPage] = useState(1);
  const [showRMAForm, setShowRMAForm] = useState(false);
  const [editingRMAId, setEditingRMAId] = useState<number | null>(null);
  const defaultRMAForm = { equipmentId: null as number | null, equipmentName: '', serialNumber: '', vendor: '', rmaNumber: '', reason: '', shippedDate: '', receivedDate: '', resolution: '', status: 'ouvert', technician: '', notes: '', supplierId: null as number | null };
  const [rmaForm, setRMAForm] = useState(defaultRMAForm);
  const [showRMAsTrash, setShowRMAsTrash] = useState(false);
  const [deletedRMAs, setDeletedRMAs] = useState<any[]>([]);
  const [rmaTrashLoading, setRmaTrashLoading] = useState(false);

  const notifyUpdate = (updated: RMARequest[]) => {
    setRMARequests(updated);
    onRMAUpdate?.(updated);
  };

  const fetchRMA = async () => {
    setRMALoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/rma`, { headers: authHeaders() });
      if (r.ok) {
        const data = await r.json();
        notifyUpdate(data);
      }
    } finally { setRMALoading(false); }
  };

  useEffect(() => { fetchRMA(); }, []);

  const saveRMA = async () => {
    const url = editingRMAId ? `${API_BASE_URL}/api/rma/${editingRMAId}` : `${API_BASE_URL}/api/rma`;
    const r = await fetch(url, { method: editingRMAId ? 'PUT' : 'POST', headers: authHeaders(), body: JSON.stringify(rmaForm) });
    if (r.ok) {
      const s = await r.json();
      if (editingRMAId) notifyUpdate(rmaRequests.map(x => x.id === s.id ? s : x));
      else notifyUpdate([s, ...rmaRequests]);
      setShowRMAForm(false); setEditingRMAId(null); setRMAForm(defaultRMAForm);
    }
  };

  const deleteRma = (id: number) => onConfirm({
    message: 'Supprimer ce RMA ?',
    onConfirm: async () => {
      onConfirm({ message: '', onConfirm: () => {} });
      await fetch(`${API_BASE_URL}/api/rma/${id}`, { method: 'DELETE', headers: authHeaders() });
      notifyUpdate(rmaRequests.filter(r => r.id !== id));
    }
  });

  const fetchDeletedRMAs = async () => {
    setRmaTrashLoading(true);
    try { const r = await fetch(`${API_BASE_URL}/api/rma/deleted`, { headers: authHeaders() }); if (r.ok) setDeletedRMAs(await r.json()); } catch {}
    setRmaTrashLoading(false);
  };

  const restoreRMA = async (id: number) => {
    const r = await fetch(`${API_BASE_URL}/api/rma/${id}/restore`, { method: 'POST', headers: authHeaders() });
    if (r.ok) {
      const data = await r.json();
      setDeletedRMAs(p => p.filter(r => r.id !== id));
      notifyUpdate([data, ...rmaRequests]);
      onToast({ message: 'RMA restauré.', type: 'success' as const });
    }
  };

  const hardDeleteRMA = async (id: number) => {
    if (!confirm('Suppression définitive ?')) return;
    const r = await fetch(`${API_BASE_URL}/api/rma/${id}/hard`, { method: 'DELETE', headers: authHeaders() });
    if (r.ok) {
      setDeletedRMAs(p => p.filter(r => r.id !== id));
      onToast({ message: 'RMA supprimé définitivement.', type: 'success' as const });
    }
  };

  const filteredRMA = rmaRequests.filter(r => {
    if (!rmaSearch) return true;
    const q = rmaSearch.toLowerCase();
    return r.equipment_name?.toLowerCase().includes(q) || r.vendor?.toLowerCase().includes(q) || r.rma_number?.toLowerCase().includes(q);
  });
  const pagedRMA = filteredRMA.slice((rmaPage - 1) * PAGE_SIZE, rmaPage * PAGE_SIZE);

  function Pagination({ total, page, onChange }: { total: number; page: number; onChange: (p: number) => void }) {
    const totalPages = Math.ceil(total / PAGE_SIZE);
    if (total <= PAGE_SIZE) return null;
    const from = (page - 1) * PAGE_SIZE + 1;
    const to = Math.min(page * PAGE_SIZE, total);
    const raw: number[] = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) raw.push(i);
    }
    const items: (number | '…')[] = [];
    let prev = 0;
    for (const p of raw) {
      if (prev && p - prev > 1) items.push('…');
      items.push(p); prev = p;
    }
    return (
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 bg-white text-xs select-none">
        <span className="text-gray-400">{from}–{to} sur {total}</span>
        <div className="flex items-center gap-0.5">
          <button onClick={() => onChange(page - 1)} disabled={page === 1} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft className="w-3.5 h-3.5" /></button>
          {items.map((p, i) => p === '…' ? <span key={`e${i}`} className="px-1 text-gray-400">…</span> : <button key={p} onClick={() => onChange(p as number)} className={`min-w-[1.75rem] h-7 rounded-lg font-medium transition ${p === page ? 'bg-[#1a6fa6] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{p}</button>)}
          <button onClick={() => onChange(page + 1)} disabled={page === totalPages} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    );
  }

  const ouvertCount = rmaRequests.filter(r => r.status === 'ouvert').length;
  const expedieCount = rmaRequests.filter(r => r.status === 'expédié').length;
  const resoluCount = rmaRequests.filter(r => r.status === 'résolu').length;

  return (
    <ModuleShell
      icon={<ArrowRightLeft className="w-5 h-5 text-white" />}
      title="Retours garantie (RMA)"
      subtitle={`${ouvertCount} ouvert(s) · ${expedieCount} expédié(s)`}
      onClose={onClose}
      actions={<>
        {canWrite && <button onClick={() => { setRMAForm(defaultRMAForm); setEditingRMAId(null); setShowRMAForm(true); }} className="bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Nouveau RMA</button>}
        {canModify && <button onClick={() => { fetchDeletedRMAs(); setShowRMAsTrash(true); }} className="border border-white/30 text-white/70 p-1.5 rounded hover:bg-white/10 shrink-0 transition-colors" title="Corbeille"><Trash2 className="w-3.5 h-3.5" /></button>}
      </>}
    >
      <FilterBar searchValue={rmaSearch} onSearchChange={(v) => { setRMASearch(v); setRMAPage(1); }} />
      <div className="flex-1 overflow-auto p-4 lg:p-5">
        {rmaRequests.length > 0 && <div className="flex items-center gap-3 mb-4 flex-wrap text-xs">
          <span className="flex items-center gap-1.5 bg-blue-50 text-blue-700 font-semibold px-2.5 py-1 rounded-lg"><AlertTriangle className="w-3 h-3" /> {ouvertCount} ouvert(s)</span>
          <span className="flex items-center gap-1.5 bg-amber-50 text-amber-700 font-semibold px-2.5 py-1 rounded-lg"><Truck className="w-3 h-3" /> {expedieCount} expédié(s)</span>
          <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 font-semibold px-2.5 py-1 rounded-lg"><CheckCircle className="w-3 h-3" /> {resoluCount} résolu(s)</span>
        </div>}

        {rmaLoading ? <div className="text-center py-16 text-gray-400"><div className="skeleton h-4 w-48 mx-auto" /><div className="skeleton h-3 w-32 mx-auto mt-2" /></div> : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {pagedRMA.map((r, idx) => {
              const sm = statusMeta[r.status] || statusMeta.ouvert;
              return (
                <div key={r.id} className="group relative bg-white rounded-2xl border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all duration-200 overflow-hidden">
                  <div className={`h-1.5 bg-gradient-to-r ${cardGradients[idx % cardGradients.length]}`} />
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0 flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${cardGradients[idx % cardGradients.length]} flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm`}>
                          <Wrench className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 text-sm truncate">{r.equipment_name}</p>
                          <p className="text-xs text-gray-500 truncate font-mono">{maskValue(r.serial_number)}</p>
                        </div>
                      </div>
                      <div className={`${sm.bg} ${sm.text} text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 flex items-center gap-1`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sm.dot}`} />
                        {sm.label}
                      </div>
                    </div>
                    <div className="ml-10.5 space-y-1">
                      <div className="flex items-center gap-3 text-xs text-gray-600">
                        <span className="flex items-center gap-1"><Truck className="w-3 h-3" /> {r.vendor}</span>
                        {r.rma_number && <span className="font-mono">#{r.rma_number}</span>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        {r.shipped_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Env.: {new Date(r.shipped_date).toLocaleDateString('fr-FR')}</span>}
                        {r.received_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Reçu: {new Date(r.received_date).toLocaleDateString('fr-FR')}</span>}
                      </div>
                      {r.technician && <p className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" /> {r.technician}</p>}
                      {r.reason && <p className="text-xs text-gray-400 line-clamp-2">{r.reason}</p>}
                    </div>
                    {canModify && <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50 ml-10.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setRMAForm({ equipmentId: r.equipment_id, equipmentName: r.equipment_name, serialNumber: r.serial_number, vendor: r.vendor, rmaNumber: r.rma_number, reason: r.reason, shippedDate: r.shipped_date||'', receivedDate: r.received_date||'', resolution: r.resolution, status: r.status, technician: r.technician, notes: r.notes, supplierId: (r as any).supplier_id ?? null }); setEditingRMAId(r.id); setShowRMAForm(true); }}
                        className="flex-1 text-xs text-[#1a6fa6] hover:text-[#0d4a73] font-medium flex items-center justify-center gap-1 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"><Edit className="w-3 h-3" /> Modifier</button>
                      <button onClick={() => deleteRma(r.id)} className="flex-1 text-xs text-red-500 hover:text-red-700 font-medium flex items-center justify-center gap-1 py-1.5 rounded-lg hover:bg-red-50 transition-colors"><Trash2 className="w-3 h-3" /> Supprimer</button>
                    </div>}
                  </div>
                </div>
              );
            })}
            <Pagination total={filteredRMA.length} page={rmaPage} onChange={setRMAPage} />
            {rmaRequests.length === 0 && !rmaLoading && (
              <div className="col-span-3 flex flex-col items-center justify-center py-16 text-gray-400">
                <div className="w-20 h-20 rounded-2xl bg-gray-50 flex items-center justify-center mb-4"><ArrowRightLeft className="w-10 h-10 text-gray-300" /></div>
                <p className="font-semibold text-gray-500">Aucun RMA enregistré</p>
                <p className="text-sm mt-1">Créez votre premier retour garantie</p>
                {canWrite && <button onClick={() => { setRMAForm(defaultRMAForm); setEditingRMAId(null); setShowRMAForm(true); }} className="mt-4 text-sm bg-[#1a6fa6] text-white font-semibold px-4 py-2 rounded-xl hover:bg-[#155a8a] flex items-center gap-1.5"><Plus className="w-4 h-4" /> Nouveau RMA</button>}
              </div>
            )}
          </div>
        )}
      </div>
      {/* <Pagination total={filteredRMA.length} page={rmaPage} onChange={setRMAPage} /> */}

      {showRMAForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowRMAForm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-auto p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${editingRMAId ? 'from-amber-500 to-orange-600' : 'from-cyan-500 to-blue-600'} flex items-center justify-center text-white shadow-sm`}>
                {editingRMAId ? <Edit className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </div>
              <div><h3 className="font-bold text-gray-900">{editingRMAId ? 'Modifier' : 'Nouveau'} RMA</h3><p className="text-xs text-gray-500">{editingRMAId ? 'Modifiez les informations' : 'Enregistrez un retour garantie'}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">Équipement <span className="text-red-500">*</span></label><input type="text" value={rmaForm.equipmentName} onChange={e => setRMAForm(f => ({...f, equipmentName: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none" /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">N° série</label><input type="text" value={rmaForm.serialNumber} onChange={e => setRMAForm(f => ({...f, serialNumber: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none" /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">N° RMA</label><input type="text" value={rmaForm.rmaNumber} onChange={e => setRMAForm(f => ({...f, rmaNumber: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none" /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Prestataire</label><input type="text" value={rmaForm.vendor} onChange={e => setRMAForm(f => ({...f, vendor: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none" /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Fournisseur lié</label><select value={rmaForm.supplierId ?? ''} onChange={e => setRMAForm(f => ({...f, supplierId: e.target.value ? Number(e.target.value) : null}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none"><option value="">— Aucun —</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Statut</label><select value={rmaForm.status} onChange={e => setRMAForm(f => ({...f, status: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none"><option value="ouvert">Ouvert</option><option value="expédié">Expédié</option><option value="résolu">Résolu</option></select></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Technicien</label><input type="text" value={rmaForm.technician} onChange={e => setRMAForm(f => ({...f, technician: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none" /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Expédié le</label><input type="date" value={rmaForm.shippedDate} onChange={e => setRMAForm(f => ({...f, shippedDate: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none" /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Reçu le</label><input type="date" value={rmaForm.receivedDate} onChange={e => setRMAForm(f => ({...f, receivedDate: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none" /></div>
              <div className="col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">Raison</label><textarea rows={2} value={rmaForm.reason} onChange={e => setRMAForm(f => ({...f, reason: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none resize-none" /></div>
              <div className="col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">Résolution</label><textarea rows={2} value={rmaForm.resolution} onChange={e => setRMAForm(f => ({...f, resolution: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none resize-none" /></div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowRMAForm(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">Annuler</button>
              <button onClick={saveRMA} disabled={!rmaForm.equipmentName.trim()} className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl text-sm font-semibold hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {showRMAsTrash && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowRMAsTrash(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center"><Trash2 className="w-4 h-4 text-white" /></div> RMA supprimés</h2>
              <button onClick={() => setShowRMAsTrash(false)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="overflow-auto flex-1 p-4">
              {rmaTrashLoading ? (
                <div className="text-center py-12 text-gray-400"><div className="skeleton h-4 w-48 mx-auto" /><div className="skeleton h-3 w-32 mx-auto mt-2" /></div>
              ) : deletedRMAs.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-gray-400"><div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-3"><Trash2 className="w-8 h-8 text-gray-300" /></div><p className="font-medium text-gray-500">Corbeille vide</p></div>
              ) : (
                <div className="space-y-2">
                  {deletedRMAs.map(e => (
                    <div key={e.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-100 p-3 hover:shadow-sm transition-shadow">
                      <div className="flex-1 min-w-0"><p className="font-medium text-gray-900 text-sm truncate">{e.equipment_name}</p><p className="text-xs text-gray-400 truncate">{e.vendor} · {e.serial_number}</p></div>
                      <div className="text-xs text-gray-500 shrink-0 mx-3">{e.deleted_at ? new Date(e.deleted_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' }) : '—'}</div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => restoreRMA(e.id)} className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 flex items-center gap-1 transition-colors"><RefreshCcw className="w-3 h-3" /> Restaurer</button>
                        <button onClick={() => hardDeleteRMA(e.id)} className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600 flex items-center gap-1 transition-colors"><Trash2 className="w-3 h-3" /> Définitif</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </ModuleShell>
  );
}
