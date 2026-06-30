import React, { useState, useEffect } from 'react';
import { Plus, ShoppingCart, Trash2, X, RefreshCcw, CheckCircle, XCircle, ChevronLeft, ChevronRight, Package, AlertTriangle, DollarSign, Clock, Edit } from 'lucide-react';
import { ModuleShell, FilterBar } from '../components/ModuleShell';
import { authHeaders } from '../utils/helpers';
import { API_BASE_URL, PAGE_SIZE, equipmentTypes } from '../constants';
import type { PurchaseRequest } from '../types';

interface PurchasesModuleProps {
  canWrite: boolean;
  canModify: boolean;
  isAdmin: boolean;
  currentUserName: string;
  suppliers: { id: number; name: string }[];
  onClose: () => void;
  onToast: (t: { message: string; type: 'error' | 'success' | 'info' }) => void;
  onConfirm: (c: { message: string; onConfirm: () => void }) => void;
  onPurchasesUpdate?: (data: PurchaseRequest[]) => void;
}

const cardGradients = ['from-emerald-500 to-teal-600', 'from-sky-500 to-blue-600', 'from-amber-500 to-orange-600', 'from-rose-500 to-pink-600', 'from-violet-500 to-purple-600'];
const statusColors: Record<string, { dot: string; bg: string; text: string }> = {
  en_attente: { dot: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700' },
  approuvé: { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  rejeté: { dot: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700' },
};

export default function PurchasesModule({ canWrite, canModify, isAdmin, currentUserName, suppliers, onClose, onToast, onConfirm, onPurchasesUpdate }: PurchasesModuleProps) {
  const [purchases, setPurchases] = useState<PurchaseRequest[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [purchaseSearch, setPurchaseSearch] = useState('');
  const [purchasePage, setPurchasePage] = useState(1);
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const defaultPurchaseForm = {
    title: '', equipmentType: 'ordinateur', quantity: 1,
    estimatedCost: '' as string, currency: 'XOF', priority: 'normale',
    justification: '', requestedBy: currentUserName, department: '',
    siteId: null as number | null, notes: '', supplierId: null as number | null
  };
  const [purchaseForm, setPurchaseForm] = useState(defaultPurchaseForm);
  const [showPurchasesTrash, setShowPurchasesTrash] = useState(false);
  const [deletedPurchases, setDeletedPurchases] = useState<any[]>([]);
  const [purchasesTrashLoading, setPurchasesTrashLoading] = useState(false);

  const notifyUpdate = (updated: PurchaseRequest[]) => {
    setPurchases(updated);
    onPurchasesUpdate?.(updated);
  };

  const fetchPurchases = async () => {
    setPurchasesLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/purchases`, { headers: authHeaders() });
      if (r.ok) {
        const data = await r.json();
        notifyUpdate(data);
      }
    } finally { setPurchasesLoading(false); }
  };

  useEffect(() => { fetchPurchases(); }, []);

  const savePurchase = async () => {
    const r = await fetch(`${API_BASE_URL}/api/purchases`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(purchaseForm) });
    if (r.ok) {
      const s = await r.json();
      notifyUpdate([s, ...purchases]);
      setShowPurchaseForm(false);
      setPurchaseForm(defaultPurchaseForm);
    }
  };

  const approvePurchase = async (id: number) => {
    const r = await fetch(`${API_BASE_URL}/api/purchases/${id}/approve`, { method: 'PATCH', headers: authHeaders() });
    if (r.ok) { const s = await r.json(); notifyUpdate(purchases.map(x => x.id === id ? s : x)); }
  };

  const rejectPurchase = async (id: number, reason: string) => {
    const r = await fetch(`${API_BASE_URL}/api/purchases/${id}/reject`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ reason }) });
    if (r.ok) { const s = await r.json(); notifyUpdate(purchases.map(x => x.id === id ? s : x)); }
  };

  const deletePurchase = (id: number) => onConfirm({
    message: "Supprimer cette demande d'achat ?",
    onConfirm: async () => {
      onConfirm({ message: '', onConfirm: () => {} });
      await fetch(`${API_BASE_URL}/api/purchases/${id}`, { method: 'DELETE', headers: authHeaders() });
      notifyUpdate(purchases.filter(p => p.id !== id));
    }
  });

  const fetchDeletedPurchases = async () => {
    setPurchasesTrashLoading(true);
    try { const r = await fetch(`${API_BASE_URL}/api/purchases/deleted`, { headers: authHeaders() }); if (r.ok) setDeletedPurchases(await r.json()); } catch {}
    setPurchasesTrashLoading(false);
  };

  const restorePurchase = async (id: number) => {
    const r = await fetch(`${API_BASE_URL}/api/purchases/${id}/restore`, { method: 'POST', headers: authHeaders() });
    if (r.ok) {
      const data = await r.json();
      setDeletedPurchases(p => p.filter(p => p.id !== id));
      notifyUpdate([data, ...purchases]);
      onToast({ message: 'Achat restauré.', type: 'success' as const });
    }
  };

  const hardDeletePurchase = async (id: number) => {
    if (!confirm('Suppression définitive ?')) return;
    const r = await fetch(`${API_BASE_URL}/api/purchases/${id}/hard`, { method: 'DELETE', headers: authHeaders() });
    if (r.ok) {
      setDeletedPurchases(p => p.filter(p => p.id !== id));
      onToast({ message: 'Achat supprimé définitivement.', type: 'success' as const });
    }
  };

  const filteredPurchases = purchases.filter(p => {
    if (!purchaseSearch) return true;
    const q = purchaseSearch.toLowerCase();
    return p.title?.toLowerCase().includes(q) || p.requested_by?.toLowerCase().includes(q) || p.department?.toLowerCase().includes(q);
  });
  const pagedPurchases = filteredPurchases.slice((purchasePage - 1) * PAGE_SIZE, purchasePage * PAGE_SIZE);

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

  const pendingCount = purchases.filter(p => p.status === 'en_attente').length;
  const approvedCount = purchases.filter(p => p.status === 'approuvé').length;
  const totalEstimated = purchases.reduce((a, p) => a + (Number(p.estimated_cost) || 0), 0);

  return (
    <ModuleShell
      icon={<ShoppingCart className="w-5 h-5 text-white" />}
      title="Demandes d'achat"
      subtitle={`${pendingCount} en attente d'approbation`}
      onClose={onClose}
      actions={<>
        {canWrite && <button onClick={() => { setPurchaseForm(defaultPurchaseForm); setShowPurchaseForm(true); }} className="bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Nouvelle demande</button>}
        {canModify && <button onClick={() => { fetchDeletedPurchases(); setShowPurchasesTrash(true); }} className="border border-white/30 text-white/70 p-1.5 rounded hover:bg-white/10 shrink-0 transition-colors" title="Corbeille"><Trash2 className="w-3.5 h-3.5" /></button>}
      </>}
    >
      <FilterBar searchValue={purchaseSearch} onSearchChange={(v) => { setPurchaseSearch(v); setPurchasePage(1); }} />
      <div className="flex-1 overflow-auto p-4 lg:p-5">
        {purchases.length > 0 && <div className="flex items-center gap-3 mb-4 flex-wrap text-xs">
          <span className="flex items-center gap-1.5 bg-blue-50 text-blue-700 font-semibold px-2.5 py-1 rounded-lg"><Clock className="w-3 h-3" /> {pendingCount} en attente</span>
          <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 font-semibold px-2.5 py-1 rounded-lg"><CheckCircle className="w-3 h-3" /> {approvedCount} approuvée(s)</span>
          <span className="flex items-center gap-1.5 bg-gray-50 text-gray-700 font-semibold px-2.5 py-1 rounded-lg"><DollarSign className="w-3 h-3" /> {totalEstimated.toLocaleString('fr-FR')} CFA</span>
        </div>}

        {purchasesLoading ? <div className="text-center py-16 text-gray-400"><div className="skeleton h-4 w-48 mx-auto" /><div className="skeleton h-3 w-32 mx-auto mt-2" /></div> : (
          <div className="space-y-3">
            {(['en_attente','approuvé','rejeté'] as const).map(st => {
              const items = pagedPurchases.filter(p => p.status === st);
              if (items.length === 0) return null;
              const labels: Record<string,string> = { en_attente:'En attente', approuvé:'Approuvées', rejeté:'Rejetées' };
              const sc = statusColors[st];
              return (
                <div key={st}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-2 h-2 rounded-full ${sc.dot}`} />
                    <h3 className={`text-xs font-bold uppercase tracking-wide ${sc.text}`}>{labels[st]} · {items.length}</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {items.map((p, idx) => (
                      <div key={p.id} className="group relative bg-white rounded-2xl border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all duration-200 overflow-hidden">
                        <div className={`h-1.5 bg-gradient-to-r ${cardGradients[idx % cardGradients.length]}`} />
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-gray-900 text-sm truncate">{p.title}</p>
                              <p className="text-xs text-gray-500 truncate">{p.requested_by}{p.department ? ` · ${p.department}` : ''}</p>
                            </div>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${p.priority === 'haute' ? 'bg-red-100 text-red-700' : p.priority === 'normale' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{p.priority}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-600 mb-2">
                            <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {p.quantity}× {p.equipment_type}</span>
                            {p.estimated_cost && <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />{Number(p.estimated_cost).toLocaleString('fr-FR')} {p.currency}</span>}
                          </div>
                          {p.justification && <p className="text-xs text-gray-400 line-clamp-2 mb-2">{p.justification}</p>}
                          {p.rejection_reason && <p className="text-xs text-red-500 mb-2 flex items-center gap-1"><XCircle className="w-3 h-3" />{p.rejection_reason}</p>}
                          {isAdmin && p.status === 'en_attente' && (
                            <div className="flex gap-2 pt-3 border-t border-gray-50 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => approvePurchase(p.id)} className="flex-1 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-1 transition-colors"><CheckCircle className="w-3 h-3" /> Approuver</button>
                              <button onClick={() => { const r = prompt('Motif du rejet :'); if (r !== null) rejectPurchase(p.id, r); }} className="flex-1 py-1.5 bg-red-500 text-white text-xs font-semibold rounded-lg hover:bg-red-600 flex items-center justify-center gap-1 transition-colors"><XCircle className="w-3 h-3" /> Rejeter</button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            <Pagination total={filteredPurchases.length} page={purchasePage} onChange={setPurchasePage} />
            {purchases.length === 0 && (
              <div className="flex flex-col items-center py-16 text-gray-400">
                <div className="w-20 h-20 rounded-2xl bg-gray-50 flex items-center justify-center mb-4"><ShoppingCart className="w-10 h-10 text-gray-300" /></div>
                <p className="font-semibold text-gray-500">Aucune demande d'achat</p>
                <p className="text-sm mt-1">Soumettez votre première demande</p>
                {canWrite && <button onClick={() => { setPurchaseForm(defaultPurchaseForm); setShowPurchaseForm(true); }} className="mt-4 text-sm bg-[#1a6fa6] text-white font-semibold px-4 py-2 rounded-xl hover:bg-[#155a8a] flex items-center gap-1.5"><Plus className="w-4 h-4" /> Nouvelle demande</button>}
              </div>
            )}
          </div>
        )}
      </div>

      {showPurchaseForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowPurchaseForm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-auto p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-sm"><ShoppingCart className="w-4 h-4" /></div>
              <div><h3 className="font-bold text-gray-900">Nouvelle demande d'achat</h3><p className="text-xs text-gray-500">Remplissez les informations ci-dessous</p></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">Titre <span className="text-red-500">*</span></label><input value={purchaseForm.title} onChange={e => setPurchaseForm(f => ({...f, title: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none" /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Type</label><select value={purchaseForm.equipmentType} onChange={e => setPurchaseForm(f => ({...f, equipmentType: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none">{equipmentTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Quantité</label><input type="number" min={1} value={purchaseForm.quantity} onChange={e => setPurchaseForm(f => ({...f, quantity: parseInt(e.target.value)||1}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none" /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Coût estimé</label><input type="number" value={purchaseForm.estimatedCost} onChange={e => setPurchaseForm(f => ({...f, estimatedCost: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none" /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Priorité</label><select value={purchaseForm.priority} onChange={e => setPurchaseForm(f => ({...f, priority: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none"><option value="basse">Basse</option><option value="normale">Normale</option><option value="haute">Haute</option></select></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Département</label><input value={purchaseForm.department} onChange={e => setPurchaseForm(f => ({...f, department: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none" /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Fournisseur</label><select value={purchaseForm.supplierId ?? ''} onChange={e => setPurchaseForm(f => ({...f, supplierId: e.target.value ? Number(e.target.value) : null}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none"><option value="">— Aucun —</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div className="col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">Justification</label><textarea rows={3} value={purchaseForm.justification} onChange={e => setPurchaseForm(f => ({...f, justification: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none resize-none" /></div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowPurchaseForm(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">Annuler</button>
              <button onClick={savePurchase} disabled={!purchaseForm.title.trim()} className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl text-sm font-semibold hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all">Soumettre</button>
            </div>
          </div>
        </div>
      )}

      {showPurchasesTrash && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowPurchasesTrash(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center"><Trash2 className="w-4 h-4 text-white" /></div> Achats supprimés</h2>
              <button onClick={() => setShowPurchasesTrash(false)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="overflow-auto flex-1 p-4">
              {purchasesTrashLoading ? (
                <div className="text-center py-12 text-gray-400"><div className="skeleton h-4 w-48 mx-auto" /><div className="skeleton h-3 w-32 mx-auto mt-2" /></div>
              ) : deletedPurchases.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-gray-400"><div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-3"><Trash2 className="w-8 h-8 text-gray-300" /></div><p className="font-medium text-gray-500">Corbeille vide</p></div>
              ) : (
                <div className="space-y-2">
                  {deletedPurchases.map(e => (
                    <div key={e.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-100 p-3 hover:shadow-sm transition-shadow">
                      <div className="flex-1 min-w-0"><p className="font-medium text-gray-900 text-sm truncate">{e.title}</p><p className="text-xs text-gray-400 truncate">{e.requested_by} · {e.status}</p></div>
                      <div className="text-xs text-gray-500 shrink-0 mx-3">{e.deleted_at ? new Date(e.deleted_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' }) : '—'}</div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => restorePurchase(e.id)} className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 flex items-center gap-1 transition-colors"><RefreshCcw className="w-3 h-3" /> Restaurer</button>
                        <button onClick={() => hardDeletePurchase(e.id)} className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600 flex items-center gap-1 transition-colors"><Trash2 className="w-3 h-3" /> Définitif</button>
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
