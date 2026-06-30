import React, { useState } from 'react';
import { Plus, Edit, Trash2, X, RefreshCcw, Download, Eye, Building2, FileSpreadsheet, FileText } from 'lucide-react';
import { ModuleShell, FilterBar } from '../components/ModuleShell';
import { authHeaders } from '../utils/helpers';
import { API_BASE_URL } from '../constants';
import * as ExportHelpers from '../utils/exportHelpers';
import { useToast } from '../components/Toast';

interface SuppliersModuleProps {
  canWrite: boolean;
  canModify: boolean;
  onClose: () => void;
  equipments: any[];
  purchases: any[];
  contracts: any[];
  licenses: any[];
  rmaRequests: any[];
  onSuppliersUpdate: (data: any[]) => void;
}

export default function SuppliersModule({ canWrite, canModify, onClose, equipments, purchases, contracts, licenses, rmaRequests, onSuppliersUpdate }: SuppliersModuleProps) {
  const tc = useToast();
  const defaultForm = { name: '', contactName: '', email: '', phone: '', address: '', city: '', country: '', notes: '' };
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [supplierForm, setSupplierForm] = useState(defaultForm);
  const [editingSupplierId, setEditingSupplierId] = useState<number | null>(null);
  const [showSupplierExport, setShowSupplierExport] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<any | null>(null);
  const [showSuppliersTrash, setShowSuppliersTrash] = useState(false);
  const [deletedSuppliers, setDeletedSuppliers] = useState<any[]>([]);
  const [suppliersTrashLoading, setSuppliersTrashLoading] = useState(false);

  const notifyUpdate = (updated: any[]) => {
    setSuppliers(updated);
    onSuppliersUpdate(updated);
  };

  const fetchSuppliers = async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/suppliers`, { headers: authHeaders() });
      if (r.ok) {
        const data = await r.json();
        notifyUpdate(data);
      }
    } catch {}
  };

  const saveSupplier = async () => {
    const isEdit = editingSupplierId != null && editingSupplierId > 0;
    const url = isEdit ? `${API_BASE_URL}/api/suppliers/${editingSupplierId}` : `${API_BASE_URL}/api/suppliers`;
    const method = isEdit ? 'PUT' : 'POST';
    try {
      const r = await fetch(url, { method, headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(supplierForm) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); tc.error(d.message || 'Erreur'); return; }
      setEditingSupplierId(null);
      setSupplierForm(defaultForm);
      fetchSuppliers();
    } catch {}
  };

  const deleteSupplier = async (id: number) => {
    if (!confirm('Supprimer ce fournisseur ?')) return;
    try {
      const r = await fetch(`${API_BASE_URL}/api/suppliers/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (r.ok) fetchSuppliers();
    } catch {}
  };

  const fetchDeletedSuppliers = async () => {
    setSuppliersTrashLoading(true);
    try { const r = await fetch(`${API_BASE_URL}/api/suppliers/deleted`, { headers: authHeaders() }); if (r.ok) setDeletedSuppliers(await r.json()); } catch {}
    setSuppliersTrashLoading(false);
  };

  const restoreSupplier = async (id: number) => {
    const r = await fetch(`${API_BASE_URL}/api/suppliers/${id}/restore`, { method: 'POST', headers: authHeaders() });
    if (r.ok) { setDeletedSuppliers(p => p.filter(s => s.id !== id)); fetchSuppliers(); tc.success('Fournisseur restauré.'); }
  };

  const hardDeleteSupplier = async (id: number) => {
    if (!confirm('Suppression définitive ?')) return;
    const r = await fetch(`${API_BASE_URL}/api/suppliers/${id}/hard`, { method: 'DELETE', headers: authHeaders() });
    if (r.ok) { setDeletedSuppliers(p => p.filter(s => s.id !== id)); tc.success('Fournisseur supprimé définitivement.'); }
  };

  const exportSuppliersXlsx = async () => {
    const rows = suppliers.map(s => ({ Nom: s.name, Contact: s.contactName || '', Email: s.email || '', Téléphone: s.phone || '', Adresse: s.address || '', Ville: s.city || '', Pays: s.country || '', Notes: s.notes || '' }));
    await ExportHelpers.exportJsonToXlsx(rows, `fournisseurs_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const exportSuppliersPdf = async () => {
    const head = [['Nom', 'Contact', 'Email', 'Téléphone', 'Ville', 'Pays']];
    const body = suppliers.map(s => [s.name, s.contactName||'', s.email||'', s.phone||'', s.city||'', s.country||'']);
    await ExportHelpers.exportRowsToPdf({ head, body, filename: `fournisseurs_${new Date().toISOString().slice(0,10)}.pdf`, title: 'Fournisseurs', orientation: 'landscape' });
  };

  return (
    <>
      {showSuppliersTrash && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowSuppliersTrash(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Trash2 className="w-5 h-5 text-red-500" /> Fournisseurs supprimés</h2>
              <button onClick={() => setShowSuppliersTrash(false)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
            </div>
            <div className="overflow-auto flex-1 p-4">
              {suppliersTrashLoading ? (
                <div className="text-center py-12 text-gray-400"><div className="skeleton h-4 w-48 mx-auto" /><div className="skeleton h-3 w-32 mx-auto mt-2" /></div>
              ) : deletedSuppliers.length === 0 ? (
                <div className="text-center py-12 text-gray-400"><Trash2 className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>Corbeille vide</p></div>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-100"><th className="text-left px-3 py-2 text-xs font-bold text-gray-500 uppercase">Nom</th><th className="text-left px-3 py-2 text-xs font-bold text-gray-500 uppercase">Email</th><th className="text-left px-3 py-2 text-xs font-bold text-gray-500 uppercase">Supprimé le</th><th className="px-3 py-2" /></tr></thead>
                  <tbody>
                    {deletedSuppliers.map(e => (
                      <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-gray-900">{e.name}</p>
                          <p className="text-xs text-gray-400">{e.contactName}</p>
                        </td>
                        <td className="px-3 py-2.5 text-sm text-gray-600">{e.email}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-500">{e.deleted_at ? new Date(e.deleted_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => restoreSupplier(e.id)} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 flex items-center gap-1"><RefreshCcw className="w-3 h-3" /> Restaurer</button>
                            <button onClick={() => hardDeleteSupplier(e.id)} className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600 flex items-center gap-1"><Trash2 className="w-3 h-3" /> Suppr. déf.</button>
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

      {selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedSupplier(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white shadow-sm"><Building2 className="w-4 h-4" /></div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-gray-900">{selectedSupplier.name}</h3>
                <p className="text-xs text-gray-400">{selectedSupplier.email}{selectedSupplier.phone ? ` · ${selectedSupplier.phone}` : ''}</p>
              </div>
              <button onClick={() => setSelectedSupplier(null)} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {(() => {
                const sid = selectedSupplier.id;
                const sEquip = equipments.filter((e: any) => e.supplierId === sid);
                const sPurchases = purchases.filter((p: any) => p.supplier_id === sid);
                const sContracts = contracts.filter((c: any) => c.supplier_id === sid);
                const sLicenses = licenses.filter((l: any) => l.supplier_id === sid);
                const sRMA = rmaRequests.filter((r: any) => r.supplier_id === sid);
                const total = sEquip.length + sPurchases.length + sContracts.length + sLicenses.length + sRMA.length;
                return (
                  <div className="space-y-6">
                    <div className="grid grid-cols-5 gap-2">
                      {([
                        ['Équipements', sEquip.length, 'from-blue-500 to-cyan-600'],
                        ['Achats', sPurchases.length, 'from-emerald-500 to-teal-600'],
                        ['Contrats', sContracts.length, 'from-violet-500 to-purple-600'],
                        ['Licences', sLicenses.length, 'from-amber-500 to-orange-600'],
                        ['RMA', sRMA.length, 'from-rose-500 to-pink-600'],
                      ] as [string, number, string][]).map(([label, count, grad]) => (
                        <div key={label} className="text-center p-3 rounded-xl bg-gradient-to-br from-gray-50 to-white border border-gray-100">
                          <div className={`text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r ${grad}`}>{count}</div>
                          <div className="text-[10px] text-gray-500 font-medium">{label}</div>
                        </div>
                      ))}
                    </div>
                    {total === 0 && <p className="text-center py-8 text-gray-400 text-sm">Aucun élément lié à ce fournisseur.</p>}
                    {sEquip.length > 0 && <div>
                      <h4 className="text-sm font-bold text-gray-700 mb-2">Équipements ({sEquip.length})</h4>
                      <div className="space-y-1">{sEquip.map((e: any) => <div key={e.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 text-sm"><span className="font-medium text-gray-800">{e.name}</span><span className="text-xs text-gray-400">{e.brand} {e.model} · {e.department}</span></div>)}</div>
                    </div>}
                    {sPurchases.length > 0 && <div>
                      <h4 className="text-sm font-bold text-gray-700 mb-2">Demandes d'achat ({sPurchases.length})</h4>
                      <div className="space-y-1">{sPurchases.map((p: any) => <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 text-sm"><span className="font-medium text-gray-800">{p.title}</span><span className="text-xs text-gray-400">{p.quantity}× {p.equipment_type} · {p.status}</span></div>)}</div>
                    </div>}
                    {sContracts.length > 0 && <div>
                      <h4 className="text-sm font-bold text-gray-700 mb-2">Contrats ({sContracts.length})</h4>
                      <div className="space-y-1">{sContracts.map((c: any) => <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 text-sm"><span className="font-medium text-gray-800">{c.title}</span><span className="text-xs text-gray-400">{c.vendor} · {c.status}</span></div>)}</div>
                    </div>}
                    {sLicenses.length > 0 && <div>
                      <h4 className="text-sm font-bold text-gray-700 mb-2">Licences ({sLicenses.length})</h4>
                      <div className="space-y-1">{sLicenses.map((l: any) => <div key={l.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 text-sm"><span className="font-medium text-gray-800">{l.name}</span><span className="text-xs text-gray-400">{l.vendor} · {l.seats} sièges</span></div>)}</div>
                    </div>}
                    {sRMA.length > 0 && <div>
                      <h4 className="text-sm font-bold text-gray-700 mb-2">RMA ({sRMA.length})</h4>
                      <div className="space-y-1">{sRMA.map((r: any) => <div key={r.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 text-sm"><span className="font-medium text-gray-800">{r.equipment_name}</span><span className="text-xs text-gray-400">{r.status} · {r.reason ? r.reason.slice(0,40) : ''}</span></div>)}</div>
                    </div>}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      <ModuleShell
        icon={<Building2 className="w-5 h-5 text-white" />}
        title={`Fournisseurs (${suppliers.length})`}
        onClose={onClose}
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <button onClick={() => setShowSupplierExport(e => !e)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/15 rounded-lg text-xs font-semibold text-white hover:bg-white/25 transition-colors">
                <Download className="w-3.5 h-3.5" /> Exporter
              </button>
              {showSupplierExport && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-10 min-w-[140px]">
                  <button onClick={() => { setShowSupplierExport(false); exportSuppliersXlsx(); }} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"><FileSpreadsheet className="w-4 h-4 text-green-600" /> Excel</button>
                  <button onClick={() => { setShowSupplierExport(false); exportSuppliersPdf(); }} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"><FileText className="w-4 h-4 text-red-500" /> PDF</button>
                </div>
              )}
            </div>
            {canWrite && (
              <button onClick={() => { setEditingSupplierId(-1); setSupplierForm(defaultForm); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/20 rounded-lg text-xs font-semibold text-white hover:bg-white/30 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Ajouter
              </button>
            )}
            {canModify && (
              <button onClick={() => { fetchDeletedSuppliers(); setShowSuppliersTrash(true); }}
                className="bg-white/10 p-1.5 rounded-lg hover:bg-white/20 transition-colors" title="Corbeille">
                <Trash2 className="w-3.5 h-3.5 text-white/70" />
              </button>
            )}
          </div>
        }
      >
        <FilterBar
          searchValue=""
          onSearchChange={() => {}}
          searchPlaceholder="Rechercher un fournisseur…"
        >
          <span className="text-xs text-gray-400">{suppliers.length} fournisseur(s)</span>
        </FilterBar>

        <div className="flex-1 overflow-y-auto p-4">
          {editingSupplierId != null ? (
            <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 mb-4">
              <div className="flex items-center gap-2.5 mb-4">
                <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${editingSupplierId > 0 ? 'from-amber-500 to-orange-600' : 'from-blue-500 to-cyan-600'} flex items-center justify-center text-white text-xs font-bold shadow-sm`}>
                  {editingSupplierId > 0 ? <Edit className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">{editingSupplierId > 0 ? 'Modifier' : 'Ajouter'} un fournisseur</p>
                  <p className="text-[10px] text-gray-500">{editingSupplierId > 0 ? 'Modifiez les informations' : 'Ajoutez un nouveau fournisseur'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {([['name','Nom *','text',true],['contactName','Contact','text',false],['email','Email','email',false],['phone','Téléphone','text',false],['address','Adresse','text',false],['city','Ville','text',false],['country','Pays','text',false]] as const).map(([key, label, type, full]) => (
                  <div key={key} className={full ? 'col-span-2' : ''}>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
                    <input type={type} value={(supplierForm as any)[key]} onChange={e => setSupplierForm(f => ({...f, [key]: e.target.value}))}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none" />
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                  <textarea value={supplierForm.notes} onChange={e => setSupplierForm(f => ({...f, notes: e.target.value}))}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none resize-none h-16" />
                </div>
              </div>
              <div className="flex gap-2 pt-3">
                <button onClick={() => { setEditingSupplierId(null); setSupplierForm(defaultForm); }}
                  className="flex-1 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">Annuler</button>
                <button onClick={saveSupplier} className="flex-1 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-xl text-sm font-semibold hover:from-blue-600 hover:to-cyan-700 shadow-sm transition-all">{editingSupplierId > 0 ? 'Enregistrer' : 'Ajouter'}</button>
              </div>
            </div>
          ) : null}
          {suppliers.length === 0 && <p className="text-center py-8 text-gray-400 text-sm">Aucun fournisseur.</p>}
          <div className="space-y-2">
            {suppliers.map((s, idx) => {
              const avGrads = ['from-blue-500 to-cyan-600','from-emerald-500 to-teal-600','from-violet-500 to-purple-600','from-amber-500 to-orange-600'];
              return (
                <div key={s.id} className="group flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${avGrads[idx%avGrads.length]} flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm`}>{s.name.charAt(0).toUpperCase()}</div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{s.name}</p>
                      <p className="text-xs text-gray-400 truncate">{[s.contactName, s.email, s.phone].filter(Boolean).join(' · ') || s.city || ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditingSupplierId(s.id); setSupplierForm({ name: s.name, contactName: s.contactName||'', email: s.email||'', phone: s.phone||'', address: s.address||'', city: s.city||'', country: s.country||'', notes: s.notes||'' }); }}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-[#1a6fa6] transition-colors"><Edit className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setSelectedSupplier(s)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-[#1a6fa6] transition-colors"><Eye className="w-3.5 h-3.5" /></button>
                    <button onClick={() => deleteSupplier(s.id)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </ModuleShell>
    </>
  );
}
