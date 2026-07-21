import React, { useState } from 'react';
import { Users as UsersIcon, Plus, Edit, User, ChevronLeft, Trash2, ShieldCheck, Ban, X } from 'lucide-react';
import { ModuleShell } from '../components/ModuleShell';
import type { UserAccount, UserFormData, Permission, Site } from '../types';
import { PERMISSION_CONFIG, roleDisplay, API_USERS, AVAILABLE_MODULES } from '../constants';
import { authHeaders } from '../utils/helpers';

interface UsersModuleProps {
  userAccounts: UserAccount[];
  sites: Site[];
  currentUserId: number;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onToast: (msg: { message: string; type: 'success' | 'error' }) => void;
  onUnauthorized: () => void;
}

export default function UsersModule({ userAccounts, sites, currentUserId, onClose, onRefresh, onToast, onUnauthorized }: UsersModuleProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<UserFormData>({ username: '', name: '', role: 'technicien', password: '', permissions: ['lecture'], allowedSiteIds: [], modules: [] });
  const [formError, setFormError] = useState<string | null>(null);

  const [showAccess, setShowAccess] = useState(false);
  const [accessTarget, setAccessTarget] = useState<UserAccount | null>(null);
  const [accessForm, setAccessForm] = useState<{ role: UserAccount['role']; permissions: Permission[]; allowedSiteIds: number[]; modules: string[] }>({ role: 'technicien', permissions: ['lecture'], allowedSiteIds: [], modules: [] });
  const [accessError, setAccessError] = useState<string | null>(null);

  const openCreate = () => {
    setFormData({ username: '', name: '', role: 'technicien', password: '', permissions: ['lecture'], allowedSiteIds: [], modules: [] });
    setEditingId(null);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (user: UserAccount) => {
    setFormData({ username: user.username, name: user.name, role: user.role, password: '', permissions: (user.permissions ?? ['lecture']) as Permission[], allowedSiteIds: user.allowedSiteIds ?? [], modules: user.modules ?? [] });
    setEditingId(user.id);
    setFormError(null);
    setShowForm(true);
  };

  const openAccess = (user: UserAccount) => {
    setAccessTarget(user);
    setAccessForm({ role: user.role, permissions: (user.permissions ?? []) as Permission[], allowedSiteIds: user.allowedSiteIds ?? [], modules: user.modules ?? [] });
    setAccessError(null);
    setShowAccess(true);
  };

  const handleSubmit = async () => {
    if (!formData.username.trim() || !formData.name.trim()) { setFormError('Champs requis manquants.'); return; }
    if (!editingId && !formData.password.trim()) { setFormError('Mot de passe requis.'); return; }
    setFormError(null);
    try {
      const payload = { username: formData.username.trim(), name: formData.name.trim(), role: formData.role, password: formData.password.trim() || undefined, permissions: formData.role === 'admin' ? ['lecture', 'ecriture', 'modification'] : formData.permissions, allowedSiteIds: formData.role === 'admin' ? [] : formData.allowedSiteIds, modules: formData.role === 'admin' ? [] : formData.modules };
      const url = editingId ? `${API_USERS}/${editingId}` : API_USERS;
      const method = editingId ? 'PUT' : 'POST';
      const r = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(payload) });
      if (r.status === 401) { onUnauthorized(); return; }
      if (r.status === 409) { setFormError('Ce nom d\'utilisateur existe déjà.'); return; }
      if (!r.ok) { setFormError('Erreur lors de l\'enregistrement.'); return; }
      onToast({ message: editingId ? 'Utilisateur modifié.' : 'Utilisateur créé.', type: 'success' });
      setShowForm(false);
      await onRefresh();
    } catch { setFormError('Erreur réseau.'); }
  };

  const handleDelete = (id: number) => {
    if (!window.confirm('Supprimer cet utilisateur ?')) return;
    fetch(`${API_USERS}/${id}`, { method: 'DELETE', headers: authHeaders() }).then(r => { if (r.ok) { onToast({ message: 'Utilisateur supprimé.', type: 'success' }); onRefresh(); } });
  };

  const handleToggleBlock = async (user: UserAccount) => {
    try {
      const r = await fetch(`${API_USERS}/${user.id}/block`, { method: 'PATCH', headers: authHeaders() });
      if (r.status === 401) { onUnauthorized(); return; }
      if (!r.ok) return;
      onToast({ message: user.blocked ? 'Utilisateur débloqué.' : 'Utilisateur bloqué.', type: 'success' });
      await onRefresh();
    } catch { onToast({ message: 'Erreur.', type: 'error' }); }
  };

  const handleAccessSave = async () => {
    if (!accessTarget) return;
    try {
      const payload = { username: accessTarget.username, name: accessTarget.name, role: accessForm.role, permissions: accessForm.role === 'admin' ? ['lecture', 'ecriture', 'modification'] : accessForm.permissions, allowedSiteIds: accessForm.role === 'admin' ? [] : accessForm.allowedSiteIds, modules: accessForm.role === 'admin' ? [] : accessForm.modules };
      const r = await fetch(`${API_USERS}/${accessTarget.id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(payload) });
      if (r.status === 401) { onUnauthorized(); return; }
      if (!r.ok) { setAccessError('Erreur'); return; }
      onToast({ message: 'Accès mis à jour.', type: 'success' });
      setShowAccess(false);
      await onRefresh();
    } catch { setAccessError('Erreur réseau'); }
  };

  const avGrads = ['from-blue-500 to-cyan-600','from-emerald-500 to-teal-600','from-violet-500 to-purple-600','from-amber-500 to-orange-600','from-rose-500 to-pink-600'];

  return (
    <>
      <ModuleShell
        icon={<UsersIcon className="w-5 h-5 text-white" />}
        title="Gestion des utilisateurs"
        subtitle={`${userAccounts.length} compte(s) enregistré(s)`}
        onClose={onClose}
        actions={!showForm ? <button onClick={openCreate}
          className="inline-flex items-center gap-2 rounded border border-white/30 bg-white/15 px-3 py-1.5 text-sm text-white hover:bg-white/25 font-semibold transition-colors">
          <Plus className="w-4 h-4" /> Ajouter un utilisateur
        </button> : undefined}
      >
        {!showForm && <div className="flex-1 overflow-y-auto p-4 lg:p-5">
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Utilisateur</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Rôle</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Permissions</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Sites</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {userAccounts.map((user, idx) => {
                  const info = roleDisplay[user.role] ?? { label: user.role, classes: 'bg-gray-100 text-gray-700' };
                  return (
                    <tr key={user.id} className={`hover:bg-gray-50 transition-colors group ${user.blocked ? 'bg-red-50/40' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${avGrads[idx%avGrads.length]} flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm`}>
                            {user.name?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={`font-medium text-gray-900 ${user.blocked ? 'line-through text-red-500' : ''}`}>{user.name}</span>
                              {user.blocked && <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold bg-red-100 text-red-600">Bloqué</span>}
                            </div>
                            <div className="text-xs text-gray-400 font-mono">@{user.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${info.classes}`}>{info.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        {user.role === 'admin' ? (
                          <span className="rounded-full px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700">Toutes</span>
                        ) : (user.permissions ?? []).length === 0 ? (
                          <span className="text-xs text-gray-400 italic">Aucune</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {PERMISSION_CONFIG.filter((p) => (user.permissions ?? []).includes(p.value)).map((p) => {
                              const cls: Record<string, string> = { blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700', orange: 'bg-orange-100 text-orange-700' };
                              return <span key={p.value} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls[p.color]}`}>{p.label}</span>;
                            })}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {user.role === 'admin' ? (
                          <span className="text-xs text-gray-400 italic">Tous</span>
                        ) : (user.allowedSiteIds ?? []).length === 0 ? (
                          <span className="text-xs text-gray-400 italic">Tous</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {(user.allowedSiteIds ?? []).map(sid => {
                              const s = sites.find(x => x.id === sid);
                              return s ? <span key={sid} className="rounded-full px-2 py-0.5 text-xs font-medium bg-sky-100 text-sky-700">{s.name}</span> : null;
                            })}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openAccess(user)} title="Gérer rôle, permissions et sites"
                            className="text-xs px-2 py-1.5 rounded-lg bg-[#e8f3fc] text-[#155a8a] border border-[#1a6fa6]/30 hover:bg-[#cfe2ff] font-medium transition-colors">
                            Accès
                          </button>
                          <button onClick={() => openEdit(user)} className="p-1.5 rounded-lg text-[#1a6fa6] hover:bg-blue-50 transition-colors" title="Modifier identité">
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          {user.id !== currentUserId && (
                            <button onClick={() => handleToggleBlock(user)}
                              className={`p-1.5 rounded-lg transition-colors ${user.blocked ? 'text-emerald-600 hover:bg-emerald-50' : 'text-orange-500 hover:bg-orange-50'}`}
                              title={user.blocked ? 'Débloquer' : 'Bloquer'}>
                              {user.blocked ? <ShieldCheck className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          {user.id !== currentUserId && (
                            <button onClick={() => handleDelete(user.id)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors" title="Supprimer">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {userAccounts.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-400">Aucun utilisateur trouvé.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>}

        {showForm && (
          <div className="flex-1 overflow-y-auto p-4 lg:p-5">
            <div className="bg-white rounded-2xl border border-gray-100 max-w-lg shadow-sm">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
                <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 mr-1" title="Retour">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${editingId ? 'from-amber-500 to-orange-600' : 'from-blue-500 to-cyan-600'} flex items-center justify-center text-white shadow-sm shrink-0`}>
                  {editingId ? <Edit className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-bold text-gray-900">{editingId ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}</h2>
                  <p className="text-xs text-gray-400">{editingId ? 'Modifier le compte' : 'Créer un nouveau compte'}</p>
                </div>
              </div>
              {formError && (
                <div className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formError}</div>
              )}
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom d'utilisateur *</label>
                  <input type="text" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet *</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rôle *</label>
                  <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value as UserFormData['role'] })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6]">
                    <option value="admin">Administrateur</option>
                    <option value="technicien">Technicien</option>
                    <option value="user">Utilisateur</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe {!editingId && '*'}</label>
                  <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingId ? 'Laisser vide pour ne pas changer' : ''}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Permissions *</label>
                  {formData.role === 'admin' ? (
                    <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">Les administrateurs ont automatiquement toutes les permissions.</div>
                  ) : (
                    <div className="space-y-2">
                      {PERMISSION_CONFIG.map((perm) => {
                        const checked = formData.permissions.includes(perm.value);
                        const colorMap: Record<string, string> = {
                          blue: checked ? 'border-indigo-400 bg-[#e8f3fc]' : 'border-gray-200 hover:border-[#1a6fa6]/50',
                          green: checked ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-green-300',
                          orange: checked ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-orange-300'
                        };
                        const badgeMap: Record<string, string> = { blue: 'bg-[#cfe2ff] text-[#155a8a]', green: 'bg-green-100 text-green-700', orange: 'bg-orange-100 text-orange-700' };
                        return (
                          <label key={perm.value} className={`flex items-center gap-3 rounded-lg border-2 p-3 cursor-pointer transition-colors ${colorMap[perm.color]}`}>
                            <input type="checkbox" checked={checked}
                              onChange={(e) => { const next = e.target.checked ? [...formData.permissions, perm.value] : formData.permissions.filter((p) => p !== perm.value); setFormData({ ...formData, permissions: next }); }}
                              className="h-4 w-4 rounded border-gray-300 accent-blue-600" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-gray-800">{perm.label}</span>
                                {checked && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badgeMap[perm.color]}`}>Actif</span>}
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">{perm.desc}</p>
                            </div>
                          </label>
                        );
                      })}
                      {formData.permissions.length === 0 && <p className="text-xs text-amber-600 mt-1">⚠ Aucune permission sélectionnée — l'utilisateur ne pourra rien faire.</p>}
                    </div>
                  )}
                </div>
                {formData.role !== 'admin' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sites autorisés <span className="ml-2 text-xs text-gray-400 font-normal">(aucun coché = accès à tous)</span>
                    </label>
                    {sites.length === 0 ? (
                      <p className="text-xs text-gray-400 italic">Aucun site configuré.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
                        {sites.map(site => {
                          const checked = formData.allowedSiteIds.includes(site.id);
                          return (
                            <label key={site.id} className={`flex items-center gap-3 rounded-lg border-2 p-2.5 cursor-pointer transition-colors ${checked ? 'border-sky-400 bg-sky-50' : 'border-gray-200 hover:border-sky-300'}`}>
                              <input type="checkbox" checked={checked}
                                onChange={(e) => { const next = e.target.checked ? [...formData.allowedSiteIds, site.id] : formData.allowedSiteIds.filter(sid => sid !== site.id); setFormData({ ...formData, allowedSiteIds: next }); }}
                                className="h-4 w-4 rounded accent-sky-600" />
                              <div>
                                <div className="text-sm font-medium text-gray-800">{site.name}</div>
                                {(site.city || site.country) && <div className="text-xs text-gray-400">{[site.city, site.country].filter(Boolean).join(', ')}</div>}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                    {formData.allowedSiteIds.length === 0 && sites.length > 0 && <p className="text-xs text-gray-400 mt-1">Accès à tous les sites.</p>}
                  </div>
                )}
                {formData.role !== 'admin' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Modules autorisés</label>
                    <div className="flex flex-wrap gap-1.5 p-2 border border-gray-200 rounded-lg min-h-[2.2rem]">
                      {AVAILABLE_MODULES.map(mod => {
                        const checked = formData.modules.includes(mod.value);
                        return (
                          <button key={mod.value} type="button" onClick={() => { const next = checked ? formData.modules.filter(m => m !== mod.value) : [...formData.modules, mod.value]; setFormData({ ...formData, modules: next }); }}
                            className={`px-2.5 py-1 text-xs rounded-full border transition ${checked ? 'bg-[#1a6fa6] text-white border-[#1a6fa6]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                            {mod.label}
                          </button>
                        );
                      })}
                    </div>
                    {formData.modules.length === 0 && <p className="text-xs text-gray-400 mt-1">Aucun module sélectionné — seuls les modules publics seront visibles.</p>}
                  </div>
                )}
              {accessForm.role !== 'admin' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Modules autorisés</label>
                  <div className="flex flex-wrap gap-1.5 p-2 border border-gray-200 rounded-lg min-h-[2.2rem]">
                    {AVAILABLE_MODULES.map(mod => {
                      const checked = accessForm.modules.includes(mod.value);
                      return (
                        <button key={mod.value} type="button" onClick={() => { const next = checked ? accessForm.modules.filter(m => m !== mod.value) : [...accessForm.modules, mod.value]; setAccessForm(f => ({ ...f, modules: next })); }}
                          className={`px-2.5 py-1 text-xs rounded-full border transition ${checked ? 'bg-[#1a6fa6] text-white border-[#1a6fa6]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                          {mod.label}
                        </button>
                      );
                    })}
                  </div>
                  {accessForm.modules.length === 0 && <p className="text-xs text-gray-400 mt-1">Aucun module sélectionné — seuls les modules publics seront visibles.</p>}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">Annuler</button>
                  <button type="button" onClick={handleSubmit} className="flex-1 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-600 text-white rounded-xl text-sm font-semibold hover:from-blue-600 hover:to-cyan-700 shadow-sm transition-all">{editingId ? 'Modifier' : 'Ajouter'}</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </ModuleShell>

      {/* Access Modal */}
      {showAccess && accessTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAccess(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
              <div className="w-9 h-9 rounded-xl bg-[#e8f3fc] flex items-center justify-center shrink-0">
                <UsersIcon className="w-5 h-5 text-[#1a6fa6]" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-gray-900">Gestion des accès</h2>
                <p className="text-xs text-gray-400">{accessTarget.name} <span className="font-mono">@{accessTarget.username}</span></p>
              </div>
              <button onClick={() => setShowAccess(false)} className="p-2 rounded-lg hover:bg-gray-100 shrink-0">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-6">
              {accessError && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{accessError}</div>}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Rôle</label>
                <div className="grid grid-cols-3 gap-2">
                  {([{ value: 'admin', label: 'Administrateur', desc: 'Accès complet', color: 'red' }, { value: 'technicien', label: 'Technicien', desc: 'Selon permissions', color: 'blue' }, { value: 'user', label: 'Utilisateur', desc: 'Selon permissions', color: 'gray' }] as const).map(r => (
                    <label key={r.value} className={`flex flex-col gap-1 rounded-xl border-2 p-3 cursor-pointer transition-colors ${accessForm.role === r.value ? r.value === 'admin' ? 'border-red-400 bg-red-50' : r.value === 'technicien' ? 'border-indigo-400 bg-[#e8f3fc]' : 'border-gray-400 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <input type="radio" name="role" value={r.value} checked={accessForm.role === r.value}
                        onChange={() => setAccessForm(f => ({ ...f, role: r.value as UserAccount['role'] }))} className="sr-only" />
                      <span className="text-sm font-semibold text-gray-800">{r.label}</span>
                      <span className="text-xs text-gray-500">{r.desc}</span>
                    </label>
                  ))}
                </div>
              </div>

              {accessForm.role !== 'admin' ? (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Permissions</label>
                  <div className="space-y-2">
                    {PERMISSION_CONFIG.map(perm => {
                      const checked = accessForm.permissions.includes(perm.value);
                      const colorMap: Record<string, string> = {
                        blue: checked ? 'border-indigo-400 bg-[#e8f3fc]' : 'border-gray-200 hover:border-[#1a6fa6]/50',
                        green: checked ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-green-300',
                        orange: checked ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-orange-300',
                      };
                      return (
                        <label key={perm.value} className={`flex items-center gap-3 rounded-xl border-2 p-3 cursor-pointer transition-colors ${colorMap[perm.color]}`}>
                          <input type="checkbox" checked={checked}
                            onChange={e => { const next = e.target.checked ? [...accessForm.permissions, perm.value] : accessForm.permissions.filter(p => p !== perm.value); setAccessForm(f => ({ ...f, permissions: next })); }}
                            className="h-4 w-4 rounded border-gray-300 accent-blue-600" />
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-gray-800">{perm.label}</div>
                            <div className="text-xs text-gray-500">{perm.desc}</div>
                          </div>
                        </label>
                      );
                    })}
                    {accessForm.permissions.length === 0 && <p className="text-xs text-amber-600">⚠ Aucune permission — l'utilisateur ne pourra rien faire.</p>}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">Les administrateurs ont toutes les permissions.</div>
              )}

              {accessForm.role !== 'admin' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Sites autorisés</label>
                  {sites.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Aucun site.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
                      {sites.map(site => {
                        const checked = accessForm.allowedSiteIds.includes(site.id);
                        return (
                          <label key={site.id} className={`flex items-center gap-3 rounded-lg border-2 p-2.5 cursor-pointer transition-colors ${checked ? 'border-sky-400 bg-sky-50' : 'border-gray-200 hover:border-sky-300'}`}>
                            <input type="checkbox" checked={checked}
                              onChange={e => { const next = e.target.checked ? [...accessForm.allowedSiteIds, site.id] : accessForm.allowedSiteIds.filter(id => id !== site.id); setAccessForm(f => ({ ...f, allowedSiteIds: next })); }}
                              className="h-4 w-4 rounded accent-sky-600" />
                            <div>
                              <div className="text-sm font-medium text-gray-800">{site.name}</div>
                              {(site.city || site.country) && <div className="text-xs text-gray-400">{[site.city, site.country].filter(Boolean).join(', ')}</div>}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {accessForm.allowedSiteIds.length === 0 && sites.length > 0 && <p className="text-xs text-gray-400 mt-1">Accès à tous les sites.</p>}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowAccess(false)} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-100">Annuler</button>
                <button onClick={handleAccessSave} className="px-4 py-2 bg-[#1a6fa6] text-white rounded-xl text-sm hover:bg-[#155a8a]">Enregistrer</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
