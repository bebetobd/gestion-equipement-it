import React, { useState } from 'react';
import { ArrowRightLeft, Clock, Building2, Monitor, Globe, Download, ChevronLeft, Plus, RefreshCcw } from 'lucide-react';
import { ModuleShell } from '../components/ModuleShell';
import * as ExportHelpers from '../utils/exportHelpers';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Site { id: number; name: string; city?: string; }

interface TransferEvent {
  id: number;
  createdAt: string;
  equipmentId: number;
  equipmentName?: string;
  equipmentType?: string;
  fromLocation?: string;
  toLocation: string;
  fromDepartment?: string;
  department?: string;
  toDepartment: string;
  fromSiteId?: number | null;
  toSiteId?: number | null;
  fromSiteName?: string;
  toSiteName?: string;
  reason?: string;
  technician?: string;
  transferRequester?: string;
  transferResponsible?: string;
  userName?: string;
  notes?: string;
}

interface Equipment {
  id: number;
  name: string;
  type: string;
  status: string;
  location: string;
  department: string;
  siteId?: number | null;
}

interface TransferModuleProps {
  allTransfers: TransferEvent[];
  equipments: Equipment[];
  sites: Site[];
  canModify: boolean;
  onClose: () => void;
  onTransfer: (data: { target: Equipment | null; form: TransferFormData }) => Promise<void>;
}

interface TransferFormData {
  toLocation: string;
  toDepartment: string;
  toSiteId: number | null;
  reason: string;
  technicianName: string;
  transferRequester: string;
  transferResponsible: string;
  notes: string;
  transferQty: number;
}

const defaultTransferForm: TransferFormData = {
  toLocation: '', toDepartment: '', toSiteId: null, reason: 'Réorganisation',
  technicianName: '', transferRequester: '', transferResponsible: '', notes: '', transferQty: 1,
};

const getTransferLocations = (ev: any) => {
  const originalSite = ev.fromSiteName || (ev.fromSiteId ? `Site #${ev.fromSiteId}` : '');
  const newSite = ev.toSiteName || (ev.toSiteId ? `Site #${ev.toSiteId}` : '');
  const fromLocation = ev.fromLocation || ev.location || '—';
  const toLocation = ev.toLocation || '—';
  const fromDept = ev.fromDepartment || ev.department || '—';
  const toDept = ev.toDepartment || '—';
  const fromSiteName = originalSite;
  const toSiteName = newSite;
  const siteChanged = ev.fromSiteId !== ev.toSiteId;
  return { fromLocation, toLocation, fromDept, toDept, fromSiteName, toSiteName, siteChanged };
};

export default function TransferModule({ allTransfers, equipments, sites, canModify, onClose, onTransfer }: TransferModuleProps) {
  const [showReport, setShowReport] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [transferTarget, setTransferTarget] = useState<Equipment | null>(null);
  const [transferForm, setTransferForm] = useState<TransferFormData>(defaultTransferForm);
  const [transferLoading, setTransferLoading] = useState(false);
  const [filter, setFilter] = useState({ department: '', from: '', to: '' });

  const handleTransfer = async () => {
    if (!transferTarget) return;
    setTransferLoading(true);
    try {
      await onTransfer({ target: transferTarget, form: transferForm });
      setTransferLoading(false);
      setShowForm(false);
      setTransferTarget(null);
      setTransferForm(defaultTransferForm);
    } catch {
      setTransferLoading(false);
    }
  };

  const filteredTransfers = allTransfers.filter(ev => {
    if (filter.department && ev.department !== filter.department && ev.toDepartment !== filter.department) return false;
    if (filter.from && new Date(ev.createdAt) < new Date(filter.from)) return false;
    if (filter.to && new Date(ev.createdAt) > new Date(filter.to + 'T23:59:59')) return false;
    return true;
  });

  return (
    <ModuleShell
      icon={<ArrowRightLeft className="w-5 h-5 text-white" />}
      title="Transferts"
      subtitle={`${allTransfers.length} transfert(s) enregistré(s)`}
      onClose={onClose}
    >
      {/* Tabs */}
      <div className="px-6 pt-3 pb-0 flex gap-1 shrink-0 border-b border-gray-200 bg-white">
        <button onClick={() => setShowReport(false)}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${!showReport ? 'border-[#1a6fa6] text-[#1a6fa6]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          Liste des transferts
        </button>
        <button onClick={() => setShowReport(true)}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${showReport ? 'border-[#1a6fa6] text-[#1a6fa6]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          Rapport
        </button>
      </div>

      {/* Stats */}
      <div className="px-4 lg:px-5 py-4 flex items-center gap-3 flex-wrap shrink-0 text-xs">
        {[
          { label: 'Total transferts', value: allTransfers.length, icon: ArrowRightLeft, color: 'text-purple-700', bg: 'bg-purple-50' },
          { label: 'Ce mois', value: allTransfers.filter(t => new Date(t.createdAt) > new Date(Date.now() - 30*24*3600*1000)).length, icon: Clock, color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Services touchés', value: new Set(allTransfers.map(t => t.department)).size, icon: Building2, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'Équipements déplacés', value: new Set(allTransfers.map(t => t.equipmentId)).size, icon: Monitor, color: 'text-amber-700', bg: 'bg-amber-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <span key={label} className={`flex items-center gap-1.5 font-semibold px-2.5 py-1 rounded-lg ${bg} ${color}`}><Icon className="w-3 h-3" /> {value} {label}</span>
        ))}
      </div>

      {!showReport && (<>
      {/* Filters */}
      {!showForm && <div className="px-6 pb-4 flex flex-wrap gap-3 shrink-0">
        <select value={filter.department} onChange={e => setFilter(f => ({ ...f, department: e.target.value }))}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6]">
          <option value="">Tous les services</option>
          {[...new Set(equipments.map(e => e.department).filter(Boolean))].sort().map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <input type="date" value={filter.from} onChange={e => setFilter(f => ({ ...f, from: e.target.value }))}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6]" />
        <input type="date" value={filter.to} onChange={e => setFilter(f => ({ ...f, to: e.target.value }))}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6]" />
        <button onClick={() => setFilter({ department: '', from: '', to: '' })}
          className="px-4 py-2 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 flex items-center gap-2">
          <RefreshCcw className="w-4 h-4" /> Réinitialiser
        </button>
        {canModify && (
          <button onClick={() => { setTransferTarget(null); setTransferForm(defaultTransferForm); setShowForm(true); }}
            className="ml-auto px-4 py-2 bg-[#1a6fa6] text-white rounded-xl text-sm hover:bg-[#155a8a] flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nouveau transfert
          </button>
        )}
      </div>}

      {/* Form */}
      {showForm && (
        <div className="flex-1 overflow-auto px-6 pb-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 max-w-xl">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
              <button onClick={() => { setShowForm(false); setTransferTarget(null); }}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" title="Retour à la liste">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-sm">
                <ArrowRightLeft className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Nouveau transfert</h3>
                <p className="text-xs text-gray-400">Déplacer un équipement vers un autre site ou emplacement</p>
              </div>
            </div>
            {!transferTarget ? (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Équipement à transférer *</label>
                <select defaultValue="" onChange={e => {
                  const eq = equipments.find(x => x.id === Number(e.target.value)) ?? null;
                  if (eq) { setTransferTarget(eq); setTransferForm(f => ({ ...f, toLocation: eq.location, toDepartment: eq.department, toSiteId: eq.siteId ?? null })); }
                }} className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] text-sm">
                  <option value="" disabled>— Sélectionner un équipement —</option>
                  {equipments.filter(e => e.status !== 'réformé').map(e => (
                    <option key={e.id} value={e.id}>{e.name} — {e.location} ({e.department})</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="mb-4 rounded-lg bg-purple-50 border border-purple-100 px-3 py-2 text-sm text-gray-600 space-y-0.5">
                <p><span className="font-semibold text-gray-800">{transferTarget.name}</span></p>
                <p>Bureau actuel : <span className="font-medium">{transferTarget.location || '—'}</span> · {transferTarget.department || '—'}</p>
                {transferTarget.siteId && <p>Site actuel : <span className="font-medium">{sites.find(s => s.id === transferTarget.siteId)?.name ?? `Site #${transferTarget.siteId}`}</span></p>}
              </div>
            )}
            <div className="space-y-3">
              <div className="rounded-xl border-2 border-purple-100 bg-purple-50 p-3">
                <label className="block text-sm font-semibold text-purple-800 mb-2 flex items-center gap-1.5"><Globe className="w-4 h-4" />Site de destination *</label>
                <select value={transferForm.toSiteId ?? ''} onChange={e => setTransferForm({ ...transferForm, toSiteId: e.target.value ? Number(e.target.value) : null })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] text-sm bg-white">
                  <option value="">— Sélectionner un site —</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name}{s.city ? ` — ${s.city}` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1"><Building2 className="inline w-3.5 h-3.5 mr-1 text-purple-500" />Nouveau bureau / localisation *</label>
                <input type="text" value={transferForm.toLocation} onChange={e => setTransferForm({ ...transferForm, toLocation: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] text-sm" placeholder="Ex: Bureau 301…" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau département *</label>
                <input type="text" value={transferForm.toDepartment} onChange={e => setTransferForm({ ...transferForm, toDepartment: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] text-sm" placeholder="Ex: Comptabilité…" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Raison du transfert</label>
                <select value={transferForm.reason} onChange={e => setTransferForm({ ...transferForm, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] text-sm">
                  <option>Réorganisation</option><option>Transfert de site</option><option>Maintenance</option>
                  <option>Demande du service</option><option>Remplacement</option><option>Autre</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Agent responsable</label>
                <input type="text" value={transferForm.technicianName} onChange={e => setTransferForm({ ...transferForm, technicianName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] text-sm" placeholder="Nom du technicien" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Demandeur du transfert</label>
                <input type="text" value={transferForm.transferRequester} onChange={e => setTransferForm({ ...transferForm, transferRequester: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] text-sm" placeholder="Nom du demandeur" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Responsable du transfert</label>
                <input type="text" value={transferForm.transferResponsible} onChange={e => setTransferForm({ ...transferForm, transferResponsible: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] text-sm" placeholder="Nom du responsable" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optionnel)</label>
                <textarea value={transferForm.notes} onChange={e => setTransferForm({ ...transferForm, notes: e.target.value })} rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#1a6fa6] text-sm" placeholder="Informations complémentaires…" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => { setShowForm(false); setTransferTarget(null); }} className="px-4 py-2 border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 text-sm">Annuler</button>
              <button onClick={handleTransfer} disabled={transferLoading || !transferTarget}
                className="px-4 py-2 bg-[#1a6fa6] text-white rounded hover:bg-[#155a8a] text-sm disabled:opacity-60 flex items-center gap-2">
                {transferLoading && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <ArrowRightLeft className="w-4 h-4" /> Confirmer le transfert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {!showForm && <div className="flex-1 overflow-auto px-6 pb-6">
        {filteredTransfers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <ArrowRightLeft className="w-10 h-10 mb-2 opacity-30" />
            <p>Aucun transfert trouvé.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Date', 'Équipement', 'Type', 'De', 'Vers', 'Technicien', 'Demandeur', 'Responsable'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredTransfers.map((ev, idx) => {
                  const { fromLocation, toLocation, fromDept, toDept, fromSiteName, toSiteName, siteChanged } = getTransferLocations(ev);
                  const locationChanged = fromLocation !== toLocation || fromDept !== toDept;
                  const avGrads = ['from-purple-500 to-indigo-600','from-blue-500 to-cyan-600','from-emerald-500 to-teal-600','from-amber-500 to-orange-600'];
                  return (
                    <tr key={ev.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                        {new Date(ev.createdAt).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${avGrads[idx%avGrads.length]} flex items-center justify-center text-white text-[10px] font-bold shrink-0 shadow-sm`}>{ev.equipmentName?.charAt(0).toUpperCase() || '?'}</div>
                          <span className="font-medium text-gray-900">{ev.equipmentName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          {siteChanged && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              <Globe className="w-3 h-3" /> Site
                            </span>
                          )}
                          {locationChanged && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                              <Building2 className="w-3 h-3" /> Bureau
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {siteChanged && fromSiteName && <p className="text-xs text-[#1a6fa6] font-medium">{fromSiteName}</p>}
                        <span className="font-medium">{fromLocation}</span>
                        {fromDept && <span className="text-gray-400"> · {fromDept}</span>}
                      </td>
                      <td className="px-4 py-3">
                        {siteChanged && toSiteName && <p className="text-xs text-[#1a6fa6] font-medium flex items-center gap-1"><ArrowRightLeft className="w-3 h-3" />{toSiteName}</p>}
                        <span className="inline-flex items-center gap-1 font-medium text-purple-700">
                          <ArrowRightLeft className="w-3 h-3" /> {toLocation}
                        </span>
                        {toDept && <span className="text-gray-400 ml-1">· {toDept}</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{ev.technician || ev.userName}</td>
                      <td className="px-4 py-3 text-gray-600">{ev.transferRequester || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{ev.transferResponsible || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>}
      </>)}

      {/* Report */}
      {showReport && (() => {
        const byDestDept: Record<string, number> = {};
        const byType: Record<string, number> = {};
        const byTech: Record<string, number> = {};
        allTransfers.forEach(ev => {
          const { toDept } = getTransferLocations(ev);
          const dept = toDept || 'Non défini';
          byDestDept[dept] = (byDestDept[dept] ?? 0) + 1;
          const t = ev.equipmentType || 'Autre';
          byType[t] = (byType[t] ?? 0) + 1;
          const tech = ev.technician || ev.userName || 'Inconnu';
          byTech[tech] = (byTech[tech] ?? 0) + 1;
        });
        const thisMonth = allTransfers.filter(t => new Date(t.createdAt) > new Date(Date.now() - 30*24*3600*1000)).length;
        const maxDept = Math.max(...Object.values(byDestDept), 1);
        const maxType = Math.max(...Object.values(byType), 1);
        const exportTransferExcel = async () => {
          const sheets = [];
          sheets.push({ name: 'Par service', rows: Object.entries(byDestDept).sort((a,b)=>b[1]-a[1]).map(([dept, cnt]) => ({ 'Service destination': dept, Transferts: cnt })) });
          sheets.push({ name: 'Par type', rows: Object.entries(byType).sort((a,b)=>b[1]-a[1]).map(([type, cnt]) => ({ 'Type équipement': type, Transferts: cnt })) });
          sheets.push({ name: 'Par technicien', rows: Object.entries(byTech).sort((a,b)=>b[1]-a[1]).map(([tech, cnt]) => ({ Technicien: tech, Transferts: cnt })) });
          sheets.push({ name: 'Tous les transferts', rows: allTransfers.map(ev => { const { fromDept, toDept } = getTransferLocations(ev); return { Équipement: ev.equipmentName, Type: ev.equipmentType, 'Service source': fromDept || '—', 'Service destination': toDept || '—', Technicien: ev.technician || ev.userName, Demandeur: ev.transferRequester || '—', Responsable: ev.transferResponsible || '—', Date: new Date(ev.createdAt).toLocaleDateString('fr-FR') }; }) });
          await ExportHelpers.exportMultiSheetXlsx(sheets, `rapport-transferts-${Date.now()}.xlsx`);
        };

        const exportTransferPdf = () => {
          const doc = new jsPDF({ orientation: 'landscape' });
          doc.setFontSize(16); doc.text('Rapport Transferts', 14, 16);
          doc.setFontSize(10); doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} · ${allTransfers.length} transferts`, 14, 23);
          doc.setFontSize(12); doc.text('Par service destination', 14, 32);
          autoTable(doc, {
            startY: 35, head: [['Service destination', 'Transferts']],
            body: Object.entries(byDestDept).sort((a,b)=>b[1]-a[1]).map(([d,c]) => [d,c]),
            theme: 'striped', headStyles: { fillColor: [124, 58, 237] },
          });
          const y1 = (doc as any).lastAutoTable.finalY + 8;
          doc.setFontSize(12); doc.text("Par type d'équipement", 14, y1);
          autoTable(doc, {
            startY: y1 + 3, head: [["Type d'équipement", 'Transferts']],
            body: Object.entries(byType).sort((a,b)=>b[1]-a[1]).map(([t,c]) => [t,c]),
            theme: 'striped', headStyles: { fillColor: [124, 58, 237] },
          });
          const y2 = (doc as any).lastAutoTable.finalY + 8;
          if (y2 < 180) {
            doc.setFontSize(12); doc.text('Par technicien', 14, y2);
            autoTable(doc, {
              startY: y2 + 3, head: [['Technicien', 'Transferts']],
              body: Object.entries(byTech).sort((a,b)=>b[1]-a[1]).map(([t,c]) => [t,c]),
              theme: 'striped', headStyles: { fillColor: [124, 58, 237] },
            });
          }
          doc.save(`rapport-transferts-${Date.now()}.pdf`);
        };

        return (
          <div className="flex-1 overflow-auto px-6 pb-6 pt-4 space-y-6">
            <div className="flex justify-end gap-2">
              <button onClick={exportTransferExcel}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 shadow-sm">
                <Download className="w-4 h-4 text-green-600" /> Excel
              </button>
              <button onClick={exportTransferPdf}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 shadow-sm">
                <Download className="w-4 h-4 text-red-500" /> PDF
              </button>
            </div>
            <div className="flex items-center gap-3 flex-wrap text-xs">
              {[
                { label: 'Total transferts', value: allTransfers.length, icon: ArrowRightLeft, color: 'text-purple-700', bg: 'bg-purple-50' },
                { label: 'Ce mois', value: thisMonth, icon: Clock, color: 'text-blue-700', bg: 'bg-blue-50' },
                { label: 'Services destination', value: Object.keys(byDestDept).length, icon: Building2, color: 'text-emerald-700', bg: 'bg-emerald-50' },
                { label: 'Équipements déplacés', value: new Set(allTransfers.map(t => t.equipmentId)).size, icon: Monitor, color: 'text-amber-700', bg: 'bg-amber-50' },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <span key={label} className={`flex items-center gap-1.5 font-semibold px-2.5 py-1 rounded-lg ${bg} ${color}`}><Icon className="w-3 h-3" /> {value} {label}</span>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <h3 className="font-semibold text-gray-700 mb-4">Par service destination</h3>
                <div className="space-y-2">
                  {Object.entries(byDestDept).sort((a,b)=>b[1]-a[1]).map(([dept, cnt]) => (
                    <div key={dept} className="flex items-center gap-2">
                      <span className="text-xs text-gray-600 truncate w-36 shrink-0">{dept}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div className="h-2 rounded-full bg-purple-400" style={{width:`${(cnt/maxDept)*100}%`}}/>
                      </div>
                      <span className="text-sm font-bold text-gray-700 w-6 text-right">{cnt}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <h3 className="font-semibold text-gray-700 mb-4">Par type d'équipement</h3>
                <div className="space-y-2">
                  {Object.entries(byType).sort((a,b)=>b[1]-a[1]).map(([type, cnt]) => (
                    <div key={type} className="flex items-center gap-2">
                      <span className="text-xs text-gray-600 capitalize w-28 shrink-0">{type}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2">
                        <div className="h-2 rounded-full bg-blue-400" style={{width:`${(cnt/maxType)*100}%`}}/>
                      </div>
                      <span className="text-sm font-bold text-gray-700 w-6 text-right">{cnt}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <h3 className="font-semibold text-gray-700 mb-3">Par technicien</h3>
              <div className="flex flex-wrap gap-3">
                {Object.entries(byTech).sort((a,b)=>b[1]-a[1]).map(([tech, cnt]) => (
                  <div key={tech} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-sm text-gray-700 font-medium">{tech}</span>
                    <span className="text-xs bg-purple-100 text-purple-700 rounded-full px-2 py-0.5 font-bold">{cnt}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <h3 className="font-semibold text-gray-700 mb-3">10 derniers transferts</h3>
              <div className="space-y-2">
                {allTransfers.slice(0,10).map(ev => {
                  const { fromDept, toDept } = getTransferLocations(ev);
                  return (
                    <div key={ev.id} className="flex items-center gap-3 text-sm border-b border-gray-50 pb-2">
                      <span className="text-xs text-gray-400 shrink-0 w-20">{new Date(ev.createdAt).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'})}</span>
                      <span className="font-medium text-gray-800 truncate flex-1">{ev.equipmentName}</span>
                      <span className="text-xs text-gray-500 shrink-0">{fromDept || '—'} → {toDept || '—'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}
    </ModuleShell>
  );
}
