import React, { useState } from 'react';
import { Plus, Edit, Trash2, X, RefreshCcw, FileText, AlertTriangle, Clock, ClipboardList } from 'lucide-react';
import { ModuleShell, FilterBar } from '../components/ModuleShell';
import { Pagination } from '../components/Pagination';
import { authHeaders } from '../utils/helpers';
import { API_BASE_URL, PAGE_SIZE } from '../constants';
import { useToast } from '../components/Toast';
import type { MaintenanceContract } from '../types';

interface ContractsModuleProps {
  canWrite: boolean;
  canModify: boolean;
  suppliers: any[];
  contracts: MaintenanceContract[];
  onClose: () => void;
  onContractsUpdate: (data: MaintenanceContract[]) => void;
}

const defaultContractForm = { title: '', vendor: '', contractNumber: '', siteId: null as number | null, equipmentIds: [] as number[], startDate: '', endDate: '', amount: '' as string, currency: 'XOF', scope: '', contactName: '', contactEmail: '', contactPhone: '', status: 'actif', notes: '', supplierId: null as number | null };

export default function ContractsModule({ canWrite, canModify, suppliers, contracts, onClose, onContractsUpdate }: ContractsModuleProps) {
  const tc = useToast();
  const [contractsLoading, setContractsLoading] = useState(false);
  const [contractSearch, setContractSearch] = useState('');
  const [contractPage, setContractPage] = useState(1);
  const [showContractForm, setShowContractForm] = useState(false);
  const [editingContractId, setEditingContractId] = useState<number | null>(null);
  const [contractForm, setContractForm] = useState(defaultContractForm);
  const [showContractsTrash, setShowContractsTrash] = useState(false);
  const [deletedContracts, setDeletedContracts] = useState<any[]>([]);
  const [contractsTrashLoading, setContractsTrashLoading] = useState(false);

  const fetchContracts = async () => {
    setContractsLoading(true);
    try { const r = await fetch(`${API_BASE_URL}/api/contracts`, { headers: authHeaders() }); if (r.ok) onContractsUpdate(await r.json()); } finally { setContractsLoading(false); }
  };

  const saveContract = async () => {
    const url = editingContractId ? `${API_BASE_URL}/api/contracts/${editingContractId}` : `${API_BASE_URL}/api/contracts`;
    const r = await fetch(url, { method: editingContractId ? 'PUT' : 'POST', headers: authHeaders(), body: JSON.stringify(contractForm) });
    if (r.ok) {
      const s = await r.json();
      if (editingContractId) onContractsUpdate(contracts.map(c => c.id === s.id ? s : c));
      else onContractsUpdate([s, ...contracts]);
      setShowContractForm(false);
      setEditingContractId(null);
      setContractForm(defaultContractForm);
    }
  };

  const deleteContract = async (id: number) => {
    if (!confirm('Supprimer ce contrat ?')) return;
    const r = await fetch(`${API_BASE_URL}/api/contracts/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (r.ok) onContractsUpdate(contracts.filter(c => c.id !== id));
  };

  const fetchDeletedContracts = async () => {
    setContractsTrashLoading(true);
    try { const r = await fetch(`${API_BASE_URL}/api/contracts/deleted`, { headers: authHeaders() }); if (r.ok) setDeletedContracts(await r.json()); } catch {}
    setContractsTrashLoading(false);
  };

  const restoreContract = async (id: number) => {
    const r = await fetch(`${API_BASE_URL}/api/contracts/${id}/restore`, { method: 'POST', headers: authHeaders() });
    if (r.ok) { const data = await r.json(); setDeletedContracts(p => p.filter(c => c.id !== id)); onContractsUpdate([data, ...contracts]); tc.success('Contrat restauré.'); }
  };

  const hardDeleteContract = async (id: number) => {
    if (!confirm('Suppression définitive ?')) return;
    const r = await fetch(`${API_BASE_URL}/api/contracts/${id}/hard`, { method: 'DELETE', headers: authHeaders() });
    if (r.ok) { setDeletedContracts(p => p.filter(c => c.id !== id)); tc.success('Contrat supprimé définitivement.'); }
  };

  const filteredContracts = contracts.filter(c => {
    if (!contractSearch) return true;
    const q = contractSearch.toLowerCase();
    return c.title?.toLowerCase().includes(q) || c.vendor?.toLowerCase().includes(q) || c.contract_number?.toLowerCase().includes(q);
  });
  const pagedContracts = filteredContracts.slice((contractPage - 1) * PAGE_SIZE, contractPage * PAGE_SIZE);

  return (
    <>
      {showContractsTrash && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowContractsTrash(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Trash2 className="w-5 h-5 text-red-500" /> Contrats supprimés</h2>
              <button onClick={() => setShowContractsTrash(false)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
            </div>
            <div className="overflow-auto flex-1 p-4">
              {contractsTrashLoading ? (
                <div className="text-center py-12 text-gray-400"><div className="skeleton h-4 w-48 mx-auto" /><div className="skeleton h-3 w-32 mx-auto mt-2" /></div>
              ) : deletedContracts.length === 0 ? (
                <div className="text-center py-12 text-gray-400"><Trash2 className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>Corbeille vide</p></div>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-100"><th className="text-left px-3 py-2 text-xs font-bold text-gray-500 uppercase">Titre</th><th className="text-left px-3 py-2 text-xs font-bold text-gray-500 uppercase">Prestataire</th><th className="text-left px-3 py-2 text-xs font-bold text-gray-500 uppercase">Supprimé le</th><th className="px-3 py-2" /></tr></thead>
                  <tbody>
                    {deletedContracts.map(e => (
                      <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-gray-900">{e.title}</p>
                          <p className="text-xs text-gray-400">{e.contract_number}</p>
                        </td>
                        <td className="px-3 py-2.5 text-sm text-gray-600">{e.vendor}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-500">{e.deleted_at ? new Date(e.deleted_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => restoreContract(e.id)} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 flex items-center gap-1"><RefreshCcw className="w-3 h-3" /> Restaurer</button>
                            <button onClick={() => hardDeleteContract(e.id)} className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600 flex items-center gap-1"><Trash2 className="w-3 h-3" /> Suppr. déf.</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      <ModuleShell
        icon={<ClipboardList className="w-5 h-5 text-white" />}
        title="Contrats de maintenance"
        subtitle={`${contracts.length} contrat(s) · ${contracts.filter(c => c.end_date && new Date(c.end_date) < new Date()).length} expiré(s)`}
        onClose={onClose}
        actions={<>
          {canWrite && <button onClick={() => { setContractForm(defaultContractForm); setEditingContractId(null); setShowContractForm(true); }} className="bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Nouveau</button>}
          {canModify && <button onClick={() => { fetchDeletedContracts(); setShowContractsTrash(true); }} className="border border-white/30 text-white/70 p-1.5 rounded hover:bg-white/10 shrink-0 transition-colors" title="Corbeille"><Trash2 className="w-3.5 h-3.5" /></button>}
        </>}
      >
        <FilterBar searchValue={contractSearch} onSearchChange={(v) => { setContractSearch(v); setContractPage(1); }} />
        <div className="flex-1 overflow-auto p-4 lg:p-5">
          {contracts.length > 0 && <div className="flex items-center gap-3 mb-4 flex-wrap text-xs">
            <span className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 font-semibold px-2.5 py-1 rounded-lg"><FileText className="w-3 h-3" /> {contracts.length} contrat(s)</span>
            <span className="flex items-center gap-1.5 bg-red-50 text-red-700 font-semibold px-2.5 py-1 rounded-lg"><AlertTriangle className="w-3 h-3" /> {contracts.filter(c => c.end_date && new Date(c.end_date) < new Date()).length} expiré(s)</span>
            <span className="flex items-center gap-1.5 bg-amber-50 text-amber-700 font-semibold px-2.5 py-1 rounded-lg"><Clock className="w-3 h-3" /> {contracts.filter(c => c.end_date && !(new Date(c.end_date) < new Date()) && (new Date(c.end_date).getTime() - Date.now()) < 30*86400000).length} imminent(s)</span>
          </div>}
          {contractsLoading ? <div className="text-center py-16 text-gray-400"><div className="skeleton h-4 w-48 mx-auto" /><div className="skeleton h-3 w-32 mx-auto mt-2" /></div> : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {pagedContracts.map((c, idx) => {
                const expired = c.end_date && new Date(c.end_date) < new Date();
                const expiringSoon = c.end_date && !expired && (new Date(c.end_date).getTime() - Date.now()) < 30*86400000;
                const grads = ['from-blue-500 to-cyan-600','from-emerald-500 to-teal-600','from-violet-500 to-purple-600','from-amber-500 to-orange-600','from-rose-500 to-pink-600'];
                const grad = grads[idx % grads.length];
                return (
                  <div key={c.id} className={`group relative bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${expired ? 'border-red-200' : expiringSoon ? 'border-orange-200' : 'border-gray-100 hover:shadow-md hover:border-gray-200'}`}>
                    <div className={`h-1.5 bg-gradient-to-r ${grad}`} />
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0 flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm`}>{c.title.charAt(0).toUpperCase()}</div>
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 text-sm truncate">{c.title}</p>
                            <p className="text-xs text-gray-500 truncate">{c.vendor}{c.contract_number ? ` · #${c.contract_number}` : ''}</p>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0 ml-2">
                          {expired && <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded-full">Expiré</span>}
                          {expiringSoon && <span className="text-[10px] bg-orange-100 text-orange-700 font-bold px-1.5 py-0.5 rounded-full">Bientôt</span>}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${c.status === 'actif' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{c.status}</span>
                        </div>
                      </div>
                      <div className="ml-10.5">
                        {c.scope && <p className="text-xs text-gray-600 mb-2 line-clamp-2">{c.scope}</p>}
                        <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                          {c.start_date && <span>Du {new Date(c.start_date).toLocaleDateString('fr-FR')}</span>}
                          {c.end_date && <span className={`font-semibold ${expired ? 'text-red-600' : expiringSoon ? 'text-orange-600' : ''}`}>Au {new Date(c.end_date).toLocaleDateString('fr-FR')}</span>}
                        </div>
                        {c.amount && <p className="text-sm font-bold text-gray-700">{Number(c.amount).toLocaleString('fr-FR')} {c.currency}</p>}
                        {c.contact_name && <p className="text-xs text-gray-500 mt-1">{c.contact_name}{c.contact_email ? ` · ${c.contact_email}` : ''}</p>}
                      </div>
                      {canModify && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50 ml-10.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setContractForm({ title: c.title, vendor: c.vendor, contractNumber: c.contract_number, siteId: c.site_id, equipmentIds: c.equipment_ids, startDate: c.start_date || '', endDate: c.end_date || '', amount: c.amount ? String(c.amount) : '', currency: c.currency, scope: c.scope, contactName: c.contact_name, contactEmail: c.contact_email, contactPhone: c.contact_phone, status: c.status, notes: c.notes, supplierId: (c as any).supplier_id ?? null }); setEditingContractId(c.id); setShowContractForm(true); }}
                            className="flex-1 text-xs text-[#1a6fa6] hover:text-[#0d4a73] font-medium flex items-center justify-center gap-1 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"><Edit className="w-3 h-3" /> Modifier</button>
                          <button onClick={() => deleteContract(c.id)} className="flex-1 text-xs text-red-500 hover:text-red-700 font-medium flex items-center justify-center gap-1 py-1.5 rounded-lg hover:bg-red-50 transition-colors"><Trash2 className="w-3 h-3" /> Supprimer</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <Pagination currentPage={contractPage} totalPages={Math.ceil(filteredContracts.length / PAGE_SIZE)} totalItems={filteredContracts.length} pageSize={PAGE_SIZE} onPageChange={setContractPage} />
              {contracts.length === 0 && !contractsLoading && <div className="col-span-3 flex flex-col items-center justify-center py-16 text-gray-400"><div className="w-20 h-20 rounded-2xl bg-gray-50 flex items-center justify-center mb-4"><FileText className="w-10 h-10 text-gray-300" /></div><p className="font-semibold text-gray-500">Aucun contrat</p><p className="text-sm mt-1">Ajoutez votre premier contrat</p>{canWrite && <button onClick={() => { setContractForm(defaultContractForm); setEditingContractId(null); setShowContractForm(true); }} className="mt-4 text-sm bg-[#1a6fa6] text-white font-semibold px-4 py-2 rounded-xl hover:bg-[#155a8a] flex items-center gap-1.5"><Plus className="w-4 h-4" /> Nouveau contrat</button>}</div>}
            </div>
          )}
        </div>
        {showContractForm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowContractForm(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-auto p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${editingContractId ? 'from-amber-500 to-orange-600' : 'from-blue-500 to-cyan-600'} flex items-center justify-center text-white shadow-sm`}>
                  {editingContractId ? <Edit className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </div>
                <div><h3 className="font-bold text-gray-900">{editingContractId ? 'Modifier' : 'Nouveau'} contrat</h3><p className="text-xs text-gray-500">{editingContractId ? 'Modifiez les informations' : 'Ajoutez un nouveau contrat de maintenance'}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">Titre <span className="text-red-500">*</span></label><input type="text" value={contractForm.title} onChange={e => setContractForm(f => ({...f, title: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none" /></div>
                <div><label className="block text-xs font-semibold text-gray-600 mb-1">N° contrat</label><input type="text" value={contractForm.contractNumber} onChange={e => setContractForm(f => ({...f, contractNumber: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none" /></div>
                <div><label className="block text-xs font-semibold text-gray-600 mb-1">Prestataire</label><input type="text" value={contractForm.vendor} onChange={e => setContractForm(f => ({...f, vendor: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none" /></div>
                <div><label className="block text-xs font-semibold text-gray-600 mb-1">Montant</label><input type="number" value={contractForm.amount} onChange={e => setContractForm(f => ({...f, amount: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none" /></div>
                <div><label className="block text-xs font-semibold text-gray-600 mb-1">Devise</label><input type="text" value={contractForm.currency} onChange={e => setContractForm(f => ({...f, currency: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none" /></div>
                <div><label className="block text-xs font-semibold text-gray-600 mb-1">Début</label><input type="date" value={contractForm.startDate} onChange={e => setContractForm(f => ({...f, startDate: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none" /></div>
                <div><label className="block text-xs font-semibold text-gray-600 mb-1">Fin</label><input type="date" value={contractForm.endDate} onChange={e => setContractForm(f => ({...f, endDate: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none" /></div>
                <div><label className="block text-xs font-semibold text-gray-600 mb-1">Contact</label><input type="text" value={contractForm.contactName} onChange={e => setContractForm(f => ({...f, contactName: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none" /></div>
                <div><label className="block text-xs font-semibold text-gray-600 mb-1">Fournisseur lié</label><select value={contractForm.supplierId ?? ''} onChange={e => setContractForm(f => ({...f, supplierId: e.target.value ? Number(e.target.value) : null}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none"><option value="">— Aucun —</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                <div className="col-span-2"><label className="block text-xs font-semibold text-gray-600 mb-1">Périmètre / Description</label><textarea rows={3} value={contractForm.scope} onChange={e => setContractForm(f => ({...f, scope: e.target.value}))} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none resize-none" /></div>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={() => setShowContractForm(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">Annuler</button>
                <button onClick={saveContract} disabled={!contractForm.title.trim()} className="flex-1 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-xl text-sm font-semibold hover:from-blue-600 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all">Enregistrer</button>
              </div>
            </div>
          </div>
        )}
      </ModuleShell>
    </>
  );
}
