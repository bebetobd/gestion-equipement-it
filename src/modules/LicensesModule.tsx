import React, { useState, useEffect } from 'react';
import { Plus, File, Trash2, X, RefreshCcw, Edit, ChevronLeft, ChevronRight, Key, Calendar, Package } from 'lucide-react';
import { ModuleShell, FilterBar } from '../components/ModuleShell';
import { authHeaders } from '../utils/helpers';
import { API_BASE_URL, PAGE_SIZE } from '../constants';
import type { License } from '../types';

interface LicensesModuleProps {
  canWrite: boolean;
  canModify: boolean;
  suppliers: { id: number; name: string }[];
  onClose: () => void;
  onToast: (t: { message: string; type: 'error' | 'success' | 'info' }) => void;
  onConfirm: (c: { message: string; onConfirm: () => void }) => void;
  onLicensesUpdate?: (data: License[]) => void;
}

const cardGradients = ['from-violet-500 to-purple-600', 'from-blue-500 to-cyan-600', 'from-emerald-500 to-teal-600', 'from-amber-500 to-orange-600', 'from-rose-500 to-pink-600'];

export default function LicensesModule({ canWrite, canModify, suppliers, onClose, onToast, onConfirm, onLicensesUpdate }: LicensesModuleProps) {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [licensesLoading, setLicensesLoading] = useState(false);
  const [showLicenseForm, setShowLicenseForm] = useState(false);
  const [editingLicenseId, setEditingLicenseId] = useState<number | null>(null);
  const defaultLicenseForm = {
    name: '', vendor: '', license_key: '', seats: 1, used_seats: 0,
    equipment_id: null as number | null, purchase_date: '', expiry_date: '',
    notes: '', supplierId: null as number | null
  };
  const [licenseForm, setLicenseForm] = useState(defaultLicenseForm);
  const [licenseFilter, setLicenseFilter] = useState('');
  const [licensePage, setLicensePage] = useState(1);
  const [showLicensesTrash, setShowLicensesTrash] = useState(false);
  const [deletedLicenses, setDeletedLicenses] = useState<any[]>([]);
  const [licensesTrashLoading, setLicensesTrashLoading] = useState(false);

  const notifyUpdate = (updated: License[]) => {
    setLicenses(updated);
    onLicensesUpdate?.(updated);
  };

  const fetchLicenses = async () => {
    setLicensesLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/licenses`, { headers: authHeaders() });
      if (r.ok) { const data = await r.json(); notifyUpdate(data); }
    } finally { setLicensesLoading(false); }
  };

  useEffect(() => { fetchLicenses(); }, []);

  const saveLicense = async () => {
    const method = editingLicenseId ? 'PUT' : 'POST';
    const url = editingLicenseId ? `${API_BASE_URL}/api/licenses/${editingLicenseId}` : `${API_BASE_URL}/api/licenses`;
    const r = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(licenseForm) });
    if (r.ok) {
      const saved = await r.json();
      if (editingLicenseId) notifyUpdate(licenses.map(l => l.id === saved.id ? saved : l));
      else notifyUpdate([saved, ...licenses]);
      setShowLicenseForm(false); setEditingLicenseId(null); setLicenseForm(defaultLicenseForm);
    }
  };

  const deleteLicense = (id: number) => onConfirm({
    message: 'Supprimer cette licence ?', onConfirm: async () => {
      onConfirm({ message: '', onConfirm: () => {} });
      await fetch(`${API_BASE_URL}/api/licenses/${id}`, { method: 'DELETE', headers: authHeaders() });
      notifyUpdate(licenses.filter(l => l.id !== id));
    }
  });

  const fetchDeletedLicenses = async () => {
    setLicensesTrashLoading(true);
    try { const r = await fetch(`${API_BASE_URL}/api/licenses/deleted`, { headers: authHeaders() }); if (r.ok) setDeletedLicenses(await r.json()); } catch {}
    setLicensesTrashLoading(false);
  };

  const restoreLicense = async (id: number) => {
    const r = await fetch(`${API_BASE_URL}/api/licenses/${id}/restore`, { method: 'POST', headers: authHeaders() });
    if (r.ok) {
      const data = await r.json();
      setDeletedLicenses(p => p.filter(l => l.id !== id));
      notifyUpdate([data, ...licenses]);
      onToast({ message: 'Licence restaurée.', type: 'success' });
    }
  };

  const hardDeleteLicense = async (id: number) => {
    if (!confirm('Suppression définitive ?')) return;
    const r = await fetch(`${API_BASE_URL}/api/licenses/${id}/hard`, { method: 'DELETE', headers: authHeaders() });
    if (r.ok) { setDeletedLicenses(p => p.filter(l => l.id !== id)); onToast({ message: 'Licence supprimée définitivement.', type: 'success' }); }
  };

  const filteredLicenses = licenses.filter(l => {
    if (!licenseFilter) return true;
    const q = licenseFilter.toLowerCase();
    return l.name?.toLowerCase().includes(q) || l.vendor?.toLowerCase().includes(q);
  });
  const pagedLicenses = filteredLicenses.slice((licensePage - 1) * PAGE_SIZE, licensePage * PAGE_SIZE);
  const expiredCount = licenses.filter(l => l.expiry_date && new Date(l.expiry_date) < new Date()).length;
  const totalSeats = licenses.reduce((a, l) => a + l.seats, 0);
  const usedSeats = licenses.reduce((a, l) => a + l.used_seats, 0);

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

  return (
    <ModuleShell
      icon={<File className="w-5 h-5 text-white" />}
      title="Licences logicielles"
      subtitle={`${licenses.length} licence(s) · ${expiredCount} expirée(s)`}
      onClose={onClose}
      actions={<>
        {canWrite && <button onClick={() => { setLicenseForm(defaultLicenseForm); setEditingLicenseId(null); setShowLicenseForm(true); }}
          className="bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Nouvelle licence</button>}
        {canModify && <button onClick={() => { fetchDeletedLicenses(); setShowLicensesTrash(true); }} className="border border-white/30 text-white/70 p-1.5 rounded hover:bg-white/10 shrink-0 transition-colors" title="Corbeille"><Trash2 className="w-3.5 h-3.5" /></button>}
      </>}
    >
      <FilterBar searchValue={licenseFilter} onSearchChange={setLicenseFilter} />
      <div className="flex-1 overflow-auto p-4 lg:p-5">
        {/* Mini stats */}
        {licenses.length > 0 && <div className="flex items-center gap-3 mb-4 text-xs">
          <span className="flex items-center gap-1.5 bg-violet-50 text-violet-700 font-semibold px-2.5 py-1 rounded-lg"><Key className="w-3 h-3" /> {licenses.length} licences</span>
          <span className="flex items-center gap-1.5 bg-blue-50 text-blue-700 font-semibold px-2.5 py-1 rounded-lg"><Package className="w-3 h-3" /> {usedSeats}/{totalSeats} sièges</span>
          {expiredCount > 0 && <span className="flex items-center gap-1.5 bg-red-50 text-red-700 font-semibold px-2.5 py-1 rounded-lg"><Calendar className="w-3 h-3" /> {expiredCount} expirée(s)</span>}
        </div>}

        {licensesLoading ? (
          <div className="text-center py-16 text-gray-400"><div className="skeleton h-4 w-48 mx-auto" /><div className="skeleton h-3 w-32 mx-auto mt-2" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {pagedLicenses.map((l, idx) => {
              const expired = l.expiry_date && new Date(l.expiry_date) < new Date();
              const expiringSoon = l.expiry_date && !expired && (new Date(l.expiry_date).getTime() - Date.now()) < 30 * 86400000;
              const usagePct = l.seats > 0 ? Math.round(l.used_seats / l.seats * 100) : 0;
              const grad = cardGradients[idx % cardGradients.length];
              return (
                <div key={l.id} className={`group relative bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${expired ? 'border-red-200' : expiringSoon ? 'border-orange-200' : 'border-gray-100 hover:shadow-md hover:border-gray-200'}`}>
                  <div className={`h-1.5 bg-gradient-to-r ${grad}`} />
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0 flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm`}>{l.name.charAt(0).toUpperCase()}</div>
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 text-sm truncate">{l.name}</p>
                          <p className="text-xs text-gray-500 truncate">{l.vendor}</p>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0 ml-2">
                        {expired && <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded-full">Expirée</span>}
                        {expiringSoon && <span className="text-[10px] bg-orange-100 text-orange-700 font-bold px-1.5 py-0.5 rounded-full">Bientôt</span>}
                      </div>
                    </div>
                    {l.license_key && <p className="text-xs text-gray-400 font-mono truncate mb-2 ml-10.5">{l.license_key}</p>}
                    <div className="ml-10.5">
                      <div className="flex items-center justify-between text-xs text-gray-600 mb-1"><span>Sièges utilisés</span><span className="font-semibold">{l.used_seats}/{l.seats}</span></div>
                      <div className="h-1.5 bg-gray-100 rounded-full"><div className={`h-1.5 rounded-full transition-all ${usagePct >= 100 ? 'bg-red-500' : usagePct >= 80 ? 'bg-orange-400' : 'bg-green-500'}`} style={{width: `${Math.min(100,usagePct)}%`}} /></div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-400 mt-2 ml-10.5">
                      {l.expiry_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Expire: {new Date(l.expiry_date).toLocaleDateString('fr-FR')}</span>}
                      {l.equipment_id && <span>#{l.equipment_id}</span>}
                    </div>
                    {canModify && <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50 ml-10.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setLicenseForm({ name: l.name, vendor: l.vendor, license_key: l.license_key, seats: l.seats, used_seats: l.used_seats, equipment_id: l.equipment_id, purchase_date: l.purchase_date || '', expiry_date: l.expiry_date || '', notes: l.notes, supplierId: (l as any).supplier_id ?? null }); setEditingLicenseId(l.id); setShowLicenseForm(true); }}
                        className="flex-1 text-xs text-[#1a6fa6] hover:text-[#0d4a73] font-medium flex items-center justify-center gap-1 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"><Edit className="w-3 h-3" /> Modifier</button>
                      <button onClick={() => deleteLicense(l.id)} className="flex-1 text-xs text-red-500 hover:text-red-700 font-medium flex items-center justify-center gap-1 py-1.5 rounded-lg hover:bg-red-50 transition-colors"><Trash2 className="w-3 h-3" /> Supprimer</button>
                    </div>}
                  </div>
                </div>
              );
            })}
            <Pagination total={filteredLicenses.length} page={licensePage} onChange={setLicensePage} />
            {licenses.length === 0 && !licensesLoading && (
              <div className="col-span-3 flex flex-col items-center justify-center py-16 text-gray-400">
                <div className="w-20 h-20 rounded-2xl bg-gray-50 flex items-center justify-center mb-4"><File className="w-10 h-10 text-gray-300" /></div>
                <p className="font-semibold text-gray-500">Aucune licence enregistrée</p>
                <p className="text-sm mt-1">Ajoutez votre première licence</p>
                {canWrite && <button onClick={() => { setLicenseForm(defaultLicenseForm); setEditingLicenseId(null); setShowLicenseForm(true); }} className="mt-4 text-sm bg-[#1a6fa6] text-white font-semibold px-4 py-2 rounded-xl hover:bg-[#155a8a] flex items-center gap-1.5"><Plus className="w-4 h-4" /> Nouvelle licence</button>}
              </div>
            )}
          </div>
        )}
      </div>
      {showLicenseForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowLicenseForm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-auto p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${editingLicenseId ? 'from-amber-500 to-orange-600' : 'from-violet-500 to-purple-600'} flex items-center justify-center text-white shadow-sm`}>
                {editingLicenseId ? <Edit className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </div>
              <div><h3 className="font-bold text-gray-900">{editingLicenseId ? 'Modifier' : 'Nouvelle'} licence</h3><p className="text-xs text-gray-500">{editingLicenseId ? 'Modifiez les informations' : 'Ajoutez une nouvelle licence'}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">Nom <span className="text-red-500">*</span></label><input type="text" value={licenseForm.name} onChange={e => setLicenseForm(f => ({...f, name: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none" /></div>
              <div className="col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">Clé de licence</label><input type="text" value={licenseForm.license_key} onChange={e => setLicenseForm(f => ({...f, license_key: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none" /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Sièges total</label><input type="number" min={1} value={licenseForm.seats} onChange={e => setLicenseForm(f => ({...f, seats: parseInt(e.target.value) || 1}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none" /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Sièges utilisés</label><input type="number" min={0} value={licenseForm.used_seats} onChange={e => setLicenseForm(f => ({...f, used_seats: parseInt(e.target.value) || 0}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none" /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Éditeur</label><input type="text" value={licenseForm.vendor} onChange={e => setLicenseForm(f => ({...f, vendor: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none" /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Fournisseur lié</label><select value={licenseForm.supplierId ?? ''} onChange={e => setLicenseForm(f => ({...f, supplierId: e.target.value ? Number(e.target.value) : null}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none"><option value="">— Aucun —</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Date d'achat</label><input type="date" value={licenseForm.purchase_date} onChange={e => setLicenseForm(f => ({...f, purchase_date: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none" /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Date d'expiration</label><input type="date" value={licenseForm.expiry_date} onChange={e => setLicenseForm(f => ({...f, expiry_date: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none" /></div>
              <div className="col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label><textarea rows={2} value={licenseForm.notes} onChange={e => setLicenseForm(f => ({...f, notes: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none resize-none" /></div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowLicenseForm(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">Annuler</button>
              <button onClick={saveLicense} disabled={!licenseForm.name.trim()} className="flex-1 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl text-sm font-semibold hover:from-violet-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all">Enregistrer</button>
            </div>
          </div>
        </div>
      )}
      {showLicensesTrash && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowLicensesTrash(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center"><Trash2 className="w-4 h-4 text-white" /></div> Licences supprimées</h2>
              <button onClick={() => setShowLicensesTrash(false)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="overflow-auto flex-1 p-4">
              {licensesTrashLoading ? (
                <div className="text-center py-12 text-gray-400"><div className="skeleton h-4 w-48 mx-auto" /><div className="skeleton h-3 w-32 mx-auto mt-2" /></div>
              ) : deletedLicenses.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-gray-400"><div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-3"><Trash2 className="w-8 h-8 text-gray-300" /></div><p className="font-medium text-gray-500">Corbeille vide</p></div>
              ) : (
                <div className="space-y-2">
                  {deletedLicenses.map(e => (
                    <div key={e.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-100 p-3 hover:shadow-sm transition-shadow">
                      <div className="flex-1 min-w-0"><p className="font-medium text-gray-900 text-sm truncate">{e.name}</p><p className="text-xs text-gray-400 truncate">{e.vendor}{e.license_key ? ` · ${e.license_key}` : ''}</p></div>
                      <div className="text-xs text-gray-500 shrink-0 mx-3">{e.deleted_at ? new Date(e.deleted_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' }) : '—'}</div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => restoreLicense(e.id)} className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 flex items-center gap-1 transition-colors"><RefreshCcw className="w-3 h-3" /> Restaurer</button>
                        <button onClick={() => hardDeleteLicense(e.id)} className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600 flex items-center gap-1 transition-colors"><Trash2 className="w-3 h-3" /> Définitif</button>
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
