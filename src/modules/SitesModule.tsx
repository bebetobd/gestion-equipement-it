import React, { useState } from 'react';
import { Plus, Edit, Trash2, Globe, MapPin, Monitor, X, RefreshCcw } from 'lucide-react';
import { ModuleShell } from '../components/ModuleShell';
import { authHeaders } from '../utils/helpers';
import { API_BASE_URL } from '../constants';
import { useToast } from '../components/Toast';
import type { SiteForm } from '../types';

interface SitesModuleProps {
  canWrite: boolean;
  canModify: boolean;
  sites: any[];
  onClose: () => void;
  onSitesUpdate: (data: any[]) => void;
}

const defaultSiteForm: SiteForm = { name: '', city: '', country: '', address: '', description: '', latitude: '', longitude: '', email: '', phone: '' };

export default function SitesModule({ canWrite, canModify, sites, onClose, onSitesUpdate }: SitesModuleProps) {
  const tc = useToast();
  const [editingSiteId, setEditingSiteId] = useState<number | null>(null);
  const [siteForm, setSiteForm] = useState<SiteForm>(defaultSiteForm);
  const [siteLoading, setSiteLoading] = useState(false);
  const [showSitesTrash, setShowSitesTrash] = useState(false);
  const [deletedSites, setDeletedSites] = useState<any[]>([]);
  const [sitesTrashLoading, setSitesTrashLoading] = useState(false);

  const fetchSites = async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/sites`, { headers: authHeaders() });
      if (r.ok) onSitesUpdate(await r.json());
    } catch {}
  };

  const handleSaveSite = async () => {
    if (!siteForm.name.trim()) { tc.error('Le nom du site est requis.'); return; }
    setSiteLoading(true);
    try {
      const url = editingSiteId ? `${API_BASE_URL}/api/sites/${editingSiteId}` : `${API_BASE_URL}/api/sites`;
      const method = editingSiteId ? 'PUT' : 'POST';
      const r = await fetch(url, { method, headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(siteForm) });
      if (!r.ok) { const d = await r.json(); tc.error(d.message || 'Erreur'); return; }
      setEditingSiteId(null);
      setSiteForm(defaultSiteForm);
      fetchSites();
    } catch { tc.error('Erreur réseau.'); }
    setSiteLoading(false);
  };

  const handleDeleteSite = (id: number) => {
    if (!confirm('Supprimer ce site ?')) return;
    fetch(`${API_BASE_URL}/api/sites/${id}`, { method: 'DELETE', headers: authHeaders() })
      .then(r => { if (r.ok) fetchSites(); })
      .catch(() => tc.error('Erreur réseau.'));
  };

  const fetchDeletedSites = async () => {
    setSitesTrashLoading(true);
    try { const r = await fetch(`${API_BASE_URL}/api/sites/deleted`, { headers: authHeaders() }); if (r.ok) setDeletedSites(await r.json()); } catch {}
    setSitesTrashLoading(false);
  };

  const restoreSite = async (id: number) => {
    const r = await fetch(`${API_BASE_URL}/api/sites/${id}/restore`, { method: 'POST', headers: authHeaders() });
    if (r.ok) { setDeletedSites(p => p.filter(s => s.id !== id)); fetchSites(); tc.success('Site restauré.'); }
  };

  const hardDeleteSite = async (id: number) => {
    if (!confirm('Suppression définitive ?')) return;
    const r = await fetch(`${API_BASE_URL}/api/sites/${id}/hard`, { method: 'DELETE', headers: authHeaders() });
    if (r.ok) { setDeletedSites(p => p.filter(s => s.id !== id)); tc.success('Site supprimé définitivement.'); }
  };

  return (
    <>
      {showSitesTrash && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowSitesTrash(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Trash2 className="w-5 h-5 text-red-500" /> Sites supprimés</h2>
              <button onClick={() => setShowSitesTrash(false)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
            </div>
            <div className="overflow-auto flex-1 p-4">
              {sitesTrashLoading ? (
                <div className="text-center py-12 text-gray-400"><div className="skeleton h-4 w-48 mx-auto" /><div className="skeleton h-3 w-32 mx-auto mt-2" /></div>
              ) : deletedSites.length === 0 ? (
                <div className="text-center py-12 text-gray-400"><Trash2 className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>Corbeille vide</p></div>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-100"><th className="text-left px-3 py-2 text-xs font-bold text-gray-500 uppercase">Nom</th><th className="text-left px-3 py-2 text-xs font-bold text-gray-500 uppercase">Ville</th><th className="text-left px-3 py-2 text-xs font-bold text-gray-500 uppercase">Supprimé le</th><th className="px-3 py-2" /></tr></thead>
                  <tbody>
                    {deletedSites.map(e => (
                      <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-gray-900">{e.name}</p>
                          <p className="text-xs text-gray-400">{e.country}</p>
                        </td>
                        <td className="px-3 py-2.5 text-sm text-gray-600">{e.city}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-500">{e.deleted_at ? new Date(e.deleted_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => restoreSite(e.id)} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 flex items-center gap-1"><RefreshCcw className="w-3 h-3" /> Restaurer</button>
                            <button onClick={() => hardDeleteSite(e.id)} className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600 flex items-center gap-1"><Trash2 className="w-3 h-3" /> Suppr. déf.</button>
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
        icon={<Globe className="w-5 h-5 text-white" />}
        title="Gestion des sites"
        subtitle="Configurer les sites et localisations"
        onClose={onClose}
        actions={canModify ? <button onClick={() => { fetchDeletedSites(); setShowSitesTrash(true); }} className="border border-white/30 text-white/70 p-1.5 rounded hover:bg-white/10 shrink-0 transition-colors" title="Corbeille"><Trash2 className="w-3.5 h-3.5" /></button> : undefined}
      >
        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
          <div className="hidden lg:flex flex-col items-center justify-center w-20 shrink-0 border-r border-gray-100 bg-gradient-to-b from-gray-50 to-white p-2 gap-3">
            <div className="text-center">
              <p className="text-2xl font-black text-[#1a6fa6]">{sites.length}</p>
              <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider leading-tight">Sites</p>
            </div>
            <div className="w-8 h-px bg-gray-200" />
            <div className="text-center">
              <p className="text-lg font-black text-emerald-600">{sites.filter((s: any) => s.latitude).length}</p>
              <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider leading-tight">Géo-localisés</p>
            </div>
            <div className="w-8 h-px bg-gray-200" />
            <div className="text-center">
              <p className="text-lg font-black text-amber-600">{(sites as any[]).reduce((a: number, s: any) => a + (s.equipmentCount || 0), 0)}</p>
              <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider leading-tight">Équipements</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 lg:p-5">
            <div className="flex items-center justify-between mb-4 lg:hidden">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{sites.length} site(s)</p>
              {canModify && <button onClick={() => { setEditingSiteId(null); setSiteForm(defaultSiteForm); }}
                className="text-xs bg-[#1a6fa6] text-white font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-[#155a8a]"><Plus className="w-3.5 h-3.5" /> Ajouter</button>}
            </div>

            {sites.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <div className="w-20 h-20 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
                  <Globe className="w-10 h-10 text-gray-300" />
                </div>
                <p className="font-semibold text-gray-500">Aucun site configuré</p>
                <p className="text-sm mt-1">Créez votre premier site pour commencer</p>
                {canModify && <button onClick={() => { setEditingSiteId(null); setSiteForm(defaultSiteForm); }}
                  className="mt-4 text-sm bg-[#1a6fa6] text-white font-semibold px-4 py-2 rounded-xl hover:bg-[#155a8a] flex items-center gap-1.5"><Plus className="w-4 h-4" /> Nouveau site</button>}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {sites.map((site: any, idx: number) => {
                  const isGeo = site.latitude;
                  const eqCount = site.equipmentCount || 0;
                  const colors = ['from-blue-500 to-blue-600', 'from-emerald-500 to-teal-600', 'from-violet-500 to-purple-600', 'from-amber-500 to-orange-600', 'from-rose-500 to-pink-600', 'from-cyan-500 to-sky-600', 'from-indigo-500 to-indigo-600', 'from-lime-500 to-green-600'];
                  const grad = colors[idx % colors.length];
                  return (
                    <div key={site.id}
                      className={`group relative bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${editingSiteId === site.id ? 'border-indigo-300 shadow-lg shadow-indigo-100 ring-2 ring-indigo-200' : 'border-gray-100 hover:shadow-md hover:border-gray-200'}`}>
                      <div className={`h-2 bg-gradient-to-r ${grad}`} />
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm`}>
                                {site.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-gray-900 text-sm truncate">{site.name}</p>
                                <p className="text-xs text-gray-500 flex items-center gap-1">
                                  <MapPin className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{site.city || '—'}{site.country ? `, ${site.country}` : ''}</span>
                                </p>
                              </div>
                            </div>
                          </div>
                          {canModify && <div className="flex gap-1 shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={e => { e.stopPropagation(); setEditingSiteId(site.id); setSiteForm({ name: site.name, city: site.city, country: site.country, address: site.address, description: site.description, latitude: site.latitude != null ? String(site.latitude) : '', longitude: site.longitude != null ? String(site.longitude) : '', email: site.email || '', phone: site.phone || '' }); }}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-[#1a6fa6] hover:bg-blue-50 transition-colors" title="Modifier">
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={e => { e.stopPropagation(); handleDeleteSite(site.id); }}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Supprimer">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>}
                        </div>

                        {site.address && <p className="text-xs text-gray-400 ml-10 mb-2 truncate">{site.address}</p>}

                        <div className="flex items-center gap-2 ml-10">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${eqCount > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                            <Monitor className="w-2.5 h-2.5" /> {eqCount}
                          </span>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${isGeo ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                            <MapPin className="w-2.5 h-2.5" /> {isGeo ? 'Géolocalisé' : 'Non géolocalisé'}
                          </span>
                        </div>

                        {(site.email || site.phone) && (
                          <div className="mt-3 pt-3 border-t border-gray-50 flex items-center gap-3 text-[10px] text-gray-400 ml-10">
                            {site.email && <span className="truncate">{site.email}</span>}
                            {site.phone && <span className="shrink-0">{site.phone}</span>}
                          </div>
                        )}
                      </div>
                      <div onClick={() => { setEditingSiteId(site.id); setSiteForm({ name: site.name, city: site.city, country: site.country, address: site.address, description: site.description, latitude: site.latitude != null ? String(site.latitude) : '', longitude: site.longitude != null ? String(site.longitude) : '', email: site.email || '', phone: site.phone || '' }); }}
                        className="hidden group-hover:block absolute inset-0 cursor-pointer" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="w-full lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-gray-100 bg-gray-50/50 overflow-y-auto">
            <div className="p-4 lg:p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${editingSiteId ? 'from-amber-500 to-orange-600' : 'from-[#1a6fa6] to-blue-700'} flex items-center justify-center text-white text-xs font-bold shadow-sm`}>
                  {editingSiteId ? <Edit className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">{editingSiteId ? 'Modifier le site' : 'Nouveau site'}</p>
                  <p className="text-[10px] text-gray-500">{editingSiteId ? 'Modifiez les informations' : 'Ajoutez un nouveau site'}</p>
                </div>
              </div>

              <div className="space-y-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">Nom du site <span className="text-red-500">*</span></label>
                  <input type="text" value={siteForm.name} onChange={e => setSiteForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Ex: Siège Paris" className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none transition-shadow" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">Ville</label>
                    <input type="text" value={siteForm.city} onChange={e => setSiteForm(f => ({ ...f, city: e.target.value }))}
                      placeholder="Paris" className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none transition-shadow" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 mb-1">Pays</label>
                    <input type="text" value={siteForm.country} onChange={e => setSiteForm(f => ({ ...f, country: e.target.value }))}
                      placeholder="France" className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none transition-shadow" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">Adresse</label>
                  <input type="text" value={siteForm.address} onChange={e => setSiteForm(f => ({ ...f, address: e.target.value }))}
                    placeholder="12 rue de la Paix" className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none transition-shadow" />
                </div>

                <div className="pt-1">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Coordonnées GPS</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">Latitude</label>
                      <input type="text" value={siteForm.latitude} onChange={e => setSiteForm(f => ({ ...f, latitude: e.target.value }))}
                        placeholder="48.8566" className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none transition-shadow" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">Longitude</label>
                      <input type="text" value={siteForm.longitude} onChange={e => setSiteForm(f => ({ ...f, longitude: e.target.value }))}
                        placeholder="2.3522" className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none transition-shadow" />
                    </div>
                  </div>
                </div>

                <div className="pt-1">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Contact</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">Email</label>
                      <input type="email" value={siteForm.email} onChange={e => setSiteForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="contact@exemple.fr" className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none transition-shadow" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">Téléphone</label>
                      <input type="text" value={siteForm.phone} onChange={e => setSiteForm(f => ({ ...f, phone: e.target.value }))}
                        placeholder="+33 1 23 45 67 89" className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none transition-shadow" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">Description</label>
                  <textarea rows={2} value={siteForm.description} onChange={e => setSiteForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Informations complémentaires…" className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none transition-shadow resize-none" />
                </div>

                <div className="flex gap-2 pt-2">
                  {editingSiteId && (
                    <button onClick={() => { setEditingSiteId(null); setSiteForm(defaultSiteForm); }}
                      className="flex-1 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
                      Annuler
                    </button>
                  )}
                  <button onClick={handleSaveSite} disabled={siteLoading || !siteForm.name.trim()}
                    className="flex-1 py-2 rounded-xl bg-gradient-to-r from-[#1a6fa6] to-blue-700 text-white text-sm font-semibold hover:from-[#155a8a] hover:to-[#0d4a73] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm transition-all">
                    {siteLoading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                    {editingSiteId ? 'Enregistrer' : 'Créer le site'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ModuleShell>
    </>
  );
}
