import React, { useState, useMemo } from 'react';
import { Clock, Plus, Trash2, LayoutList, Calendar, Search, RefreshCcw, ChevronLeft, FileText, Download, X, Eye, Edit, Filter, AlertTriangle, CheckCircle, ArrowUpRight, Check, Loader, Wrench, Monitor, XCircle, Globe, ChevronRight, MapPin } from 'lucide-react';
import { ModuleShell } from '../components/ModuleShell';
import * as ExportHelpers from '../utils/exportHelpers';
import { authHeaders, formatDateTime } from '../utils/helpers';
import { API_BASE_URL, PAGE_SIZE } from '../constants';
import { Pagination as SharedPagination } from '../components/Pagination';
import type { SiteVisit, VisitStatus, Site, Equipment } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import {
  TableRow as DocxTableRow,
  TableCell as DocxTableCell,
  Paragraph as DocxParagraph,
  TextRun,
  Document as DocxDocument,
  Packer,
  Table as DocxTable,
  WidthType,
  HeadingLevel
} from 'docx';

interface VisitsModuleProps {
  visits: SiteVisit[];
  sites: Site[];
  equipments: Equipment[];
  maintenanceRecords: any[];
  canWrite: boolean;
  canModify: boolean;
  userName: string;
  userAllowedSiteIds: number[];
  onClose: () => void;
  onUpdateVisits: (data: SiteVisit[]) => void;
  onRefreshMaintenance: () => void;
  onToast: (msg: { message: string; type: 'error' | 'success' | 'info' } | null) => void;
}

function Pagination({ total, page, onChange }: { total: number; page: number; onChange: (p: number) => void }) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  return <SharedPagination currentPage={page} totalPages={totalPages} totalItems={total} pageSize={PAGE_SIZE} onPageChange={onChange} />;
}

const defaultVisitForm = { siteId: null as number | null, siteName: '', visitSiteId: null as number | null, visitSiteName: '', scheduledDate: '', scheduledTime: '', technician: '', purpose: '', status: 'planifié' as VisitStatus, notes: '', withMaintenance: false, equipmentIds: [] as number[], maintenanceDesc: '' };

const VisitsModule = ({ visits, sites, equipments, maintenanceRecords, canWrite, canModify, userName, userAllowedSiteIds, onClose, onUpdateVisits, onRefreshMaintenance, onToast }: VisitsModuleProps) => {
  const [visitSearch, setVisitSearch] = useState('');
  const [visitPage, setVisitPage] = useState(1);
  const [showVisitForm, setShowVisitForm] = useState(false);
  const [editingVisitId, setEditingVisitId] = useState<number | null>(null);
  const [visitForm, setVisitForm] = useState(defaultVisitForm);
  const [visitSaving, setVisitSaving] = useState(false);
  const [visitActionDialog, setVisitActionDialog] = useState<{ visit: SiteVisit; action: 'terminé' | 'annulé' | 'reporté'; comment: string; newDate: string; maintenanceAction: 'sur_place' | 'programmer' | 'laisser' } | null>(null);
  const [showVisitReports, setShowVisitReports] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [eqSearchQuery, setEqSearchQuery] = useState('');
  const [showEqDropdown, setShowEqDropdown] = useState(false);
  const [siteSearchQuery, setSiteSearchQuery] = useState('');
  const [showVisitSiteDropdown, setShowVisitSiteDropdown] = useState(false);
  const [visitSiteSearchQuery, setVisitSiteSearchQuery] = useState('');
  const [showVisitSiteSearchDropdown, setShowVisitSiteSearchDropdown] = useState(false);
  const [visitTechFilter, setVisitTechFilter] = useState<string[]>([]);
  const [showVisitsTrash, setShowVisitsTrash] = useState(false);
  const [deletedVisits, setDeletedVisits] = useState<any[]>([]);
  const [visitsTrashLoading, setVisitsTrashLoading] = useState(false);
  const [visitFilter, setVisitFilter] = useState({ siteId: '', status: '', from: '', to: '' });
  const [visitsLoading, setVisitsLoading] = useState(false);

  const fetchVisits = async (filter = visitFilter) => {
    setVisitsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.siteId) params.set('siteId', filter.siteId);
      if (filter.status) params.set('status', filter.status);
      if (filter.from) params.set('from', filter.from);
      if (filter.to) params.set('to', filter.to);
      const r = await fetch(`${API_BASE_URL}/api/visits?${params}`, { headers: authHeaders() });
      if (r.ok) onUpdateVisits(await r.json());
    } catch {}
    setVisitsLoading(false);
  };

  const saveVisit = async () => {
    if (!visitForm.siteId && !visitForm.siteName.trim()) { onToast({ message: 'Veuillez sélectionner un site ou saisir un nom de lieu.', type: 'error' }); return; }
    if (!visitForm.scheduledDate) { onToast({ message: 'Veuillez choisir une date.', type: 'error' }); return; }
    if (!visitForm.technician.trim()) { onToast({ message: 'Veuillez indiquer le technicien.', type: 'error' }); return; }
    if (!visitForm.purpose.trim()) { onToast({ message: "Veuillez indiquer l'objet de la visite.", type: 'error' }); return; }
    setVisitSaving(true);
    try {
      const site = visitForm.siteId ? sites.find(s => s.id === visitForm.siteId) : null;
      const siteName = site?.name ?? visitForm.siteName.trim();
      const visitSite = visitForm.visitSiteId ? sites.find(s => s.id === visitForm.visitSiteId) : null;
      const visitSiteName = visitSite?.name ?? visitForm.visitSiteName.trim();
      const body = { ...visitForm, siteName, visitSiteName };
      const url = editingVisitId ? `${API_BASE_URL}/api/visits/${editingVisitId}` : `${API_BASE_URL}/api/visits`;
      const method = editingVisitId ? 'PATCH' : 'POST';
      const r = await fetch(url, { method, headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (r.ok) {
        const savedVisit = await r.json();
        if (!editingVisitId && visitForm.withMaintenance) {
          const desc = visitForm.maintenanceDesc.trim() ||
            `Maintenance à prévoir – Visite du ${new Date(visitForm.scheduledDate + 'T00:00:00').toLocaleDateString('fr-FR')} — Site : ${siteName}`;
          const eqIds = visitForm.equipmentIds.length > 0 ? visitForm.equipmentIds : [null as null];
          for (const eqId of eqIds) {
            const mBody: Record<string, unknown> = {
              failureDesc: desc, technician: visitForm.technician,
              priority: 'normale', status: 'en_attente',
              visitId: savedVisit.id, siteName
            };
            if (eqId !== null) mBody.equipmentId = eqId;
            await fetch(`${API_BASE_URL}/api/maintenance`, {
              method: 'POST',
              headers: { ...authHeaders(), 'Content-Type': 'application/json' },
              body: JSON.stringify(mBody)
            });
          }
          onRefreshMaintenance();
        }
        onToast({ message: editingVisitId ? 'Visite mise à jour.' : (visitForm.withMaintenance ? 'Visite programmée · Ticket(s) maintenance créé(s) en attente.' : 'Visite programmée.'), type: 'success' });
        setShowVisitForm(false);
        setEditingVisitId(null);
        setVisitForm(defaultVisitForm);
        fetchVisits();
      } else {
        const d = await r.json();
        onToast({ message: d.message || 'Erreur lors de la sauvegarde.', type: 'error' });
      }
    } catch { onToast({ message: 'Erreur réseau.', type: 'error' }); }
    setVisitSaving(false);
  };

  const deleteVisitRecord = async (id: number) => {
    if (!window.confirm('Supprimer cette visite programmée ?')) return;
    const r = await fetch(`${API_BASE_URL}/api/visits/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (r.ok) { onToast({ message: 'Visite supprimée.', type: 'success' }); fetchVisits(); }
  };

  const fetchDeletedVisits = async () => {
    setVisitsTrashLoading(true);
    try { const r = await fetch(`${API_BASE_URL}/api/visits/deleted`, { headers: authHeaders() }); if (r.ok) setDeletedVisits(await r.json()); } catch {}
    setVisitsTrashLoading(false);
  };

  const restoreVisit = async (id: number) => {
    const r = await fetch(`${API_BASE_URL}/api/visits/${id}/restore`, { method: 'POST', headers: authHeaders() });
    if (r.ok) { setDeletedVisits(p => p.filter(v => v.id !== id)); fetchVisits(); onToast({ message: 'Visite restaurée.', type: 'success' }); }
  };

  const hardDeleteVisit = async (id: number) => {
    if (!window.confirm('Suppression définitive ?')) return;
    const r = await fetch(`${API_BASE_URL}/api/visits/${id}/hard`, { method: 'DELETE', headers: authHeaders() });
    if (r.ok) { setDeletedVisits(p => p.filter(v => v.id !== id)); onToast({ message: 'Visite supprimée définitivement.', type: 'success' }); }
  };

  const handleVisitAction = async () => {
    if (!visitActionDialog) return;
    const { visit: v, action, comment, newDate, maintenanceAction } = visitActionDialog;
    setVisitActionDialog(null);
    const now = new Date().toISOString();
    const payload: Record<string, unknown> = {
      ...v,
      status: action,
      validationComment: comment,
      validatedAt: now,
      validatedBy: userName,
      rescheduledDate: action === 'reporté' ? newDate || null : v.rescheduledDate
    };
    const res = await fetch(`${API_BASE_URL}/api/visits/${v.id}`, {
      method: 'PATCH',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) { onToast({ message: 'Erreur lors de la mise à jour.', type: 'error' }); return; }
    if (v.withMaintenance && maintenanceAction !== 'laisser') {
      const linkedTickets = maintenanceRecords.filter(m => m.visitId === v.id && m.status !== 'résolu');
      if (linkedTickets.length > 0) {
        const newStatus = maintenanceAction === 'sur_place' ? 'résolu' : 'ouvert';
        const extra = maintenanceAction === 'sur_place'
          ? { closedAt: now, solution: comment || 'Traité sur place lors de la visite' }
          : {};
        for (const ticket of linkedTickets) {
          await fetch(`${API_BASE_URL}/api/maintenance/${ticket.id}`, {
            method: 'PUT',
            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus, ...extra })
          });
        }
        onRefreshMaintenance();
      } else if (action === 'terminé' && maintenanceAction === 'sur_place') {
        const desc = v.maintenanceDesc.trim() || `Maintenance effectuée lors de la visite du ${new Date(v.scheduledDate + 'T00:00:00').toLocaleDateString('fr-FR')} — Site : ${v.siteName}`;
        await fetch(`${API_BASE_URL}/api/maintenance`, {
          method: 'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ failureDesc: desc, technician: v.technician, priority: 'normale', status: 'résolu', visitId: v.id, siteName: v.siteName })
        });
        onRefreshMaintenance();
      }
    }
    fetchVisits();
    const maintMsg = v.withMaintenance && maintenanceAction !== 'laisser'
      ? (maintenanceAction === 'sur_place' ? ' · Maintenance marquée comme résolue.' : ' · Maintenance ouverte pour planification.')
      : '';
    const baseMsg: Record<string, string> = { 'terminé': 'Visite terminée', 'annulé': 'Visite annulée', 'reporté': 'Visite reportée' };
    onToast({ message: (baseMsg[action] ?? 'Visite mise à jour') + maintMsg + '.', type: 'success' });
  };

  const siteFilteredVisits = useMemo(() => {
    if (userAllowedSiteIds.length === 0) return visits;
    return visits.filter(v => v.siteId == null || userAllowedSiteIds.includes(v.siteId));
  }, [visits, userAllowedSiteIds]);

  const filteredVisitsAll = siteFilteredVisits.filter(v => {
    if (!visitSearch) return true;
    const q = visitSearch.toLowerCase();
    return v.siteName?.toLowerCase().includes(q) || v.visitSiteName?.toLowerCase().includes(q) || v.technician?.toLowerCase().includes(q) || v.purpose?.toLowerCase().includes(q);
  });
  const pagedVisits = filteredVisitsAll.slice((visitPage - 1) * PAGE_SIZE, visitPage * PAGE_SIZE);

  return (
    <ModuleShell
      icon={<Clock className="w-5 h-5 text-white" />}
      title="Visites de site"
      subtitle={`${siteFilteredVisits.length} visite(s) enregistrée(s)`}
      onClose={onClose}
      actions={<>
        {canWrite && !showVisitForm && (
          <button
            onClick={() => { setEditingVisitId(null); setVisitForm(defaultVisitForm); setShowVisitForm(true); }}
            className="inline-flex items-center gap-2 rounded border border-white/30 bg-white/15 px-3 py-1.5 text-sm text-white hover:bg-white/25 font-semibold transition-colors">
            <Plus className="w-4 h-4" /> Nouvelle visite
          </button>
        )}
        {canModify && <button onClick={() => { fetchDeletedVisits(); setShowVisitsTrash(true); }} className="border border-white/30 text-white/70 p-1.5 rounded hover:bg-white/10 shrink-0 transition-colors" title="Corbeille"><Trash2 className="w-3.5 h-3.5" /></button>}
      </>}
    >
      {!showVisitForm && <>
      {/* Tabs */}
      <div className="px-6 pt-3 pb-0 flex gap-1 shrink-0 border-b border-gray-200 bg-white">
        <button onClick={() => { setShowVisitReports(false); setShowCalendar(false); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${!showVisitReports && !showCalendar ? 'border-[#1a6fa6] text-[#1a6fa6]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <LayoutList className="w-3.5 h-3.5" /> Liste
        </button>
        <button onClick={() => { setShowVisitReports(false); setShowCalendar(true); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${!showVisitReports && showCalendar ? 'border-[#1a6fa6] text-[#1a6fa6]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <Calendar className="w-3.5 h-3.5" /> Calendrier
        </button>
        <button onClick={() => { setShowVisitReports(true); setShowCalendar(false); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${showVisitReports ? 'border-[#1a6fa6] text-[#1a6fa6]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          Rapport
        </button>
      </div>

      {/* Stats pills */}
      <div className="px-6 py-4 flex gap-3 shrink-0">
        {[
          { label: 'Total', value: siteFilteredVisits.length, dot: 'bg-blue-500', bg: 'bg-blue-50' },
          { label: 'Planifiées', value: visits.filter(v => v.status === 'planifié').length, dot: 'bg-indigo-500', bg: 'bg-indigo-50' },
          { label: 'En cours', value: visits.filter(v => v.status === 'en_cours').length, dot: 'bg-yellow-500', bg: 'bg-yellow-50' },
          { label: 'Terminées', value: visits.filter(v => v.status === 'terminé').length, dot: 'bg-green-500', bg: 'bg-green-50' },
          { label: 'Annulées/Rep.', value: visits.filter(v => v.status === 'annulé' || v.status === 'reporté').length, dot: 'bg-red-500', bg: 'bg-red-50' },
        ].map(({ label, value, dot, bg }) => (
          <div key={label} className={`flex items-center gap-3 rounded-xl px-4 py-2.5 ${bg} border border-gray-100 shadow-sm`}>
            <span className={`w-2 h-2 rounded-full ${dot}`} />
            <span className="text-xs font-medium text-gray-600 min-w-[4rem]">{label}</span>
            <span className="text-sm font-bold text-gray-900">{value}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="px-6 pb-4 flex flex-wrap gap-3 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Rechercher…" value={visitSearch}
            onChange={e => { setVisitSearch(e.target.value); setVisitPage(1); }}
            className="pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm w-48 focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none" />
        </div>
        <select value={visitFilter.siteId}
          onChange={e => { const f = { ...visitFilter, siteId: e.target.value }; setVisitFilter(f); fetchVisits(f); }}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none">
          <option value="">Tous les sites</option>
          {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={visitFilter.status}
          onChange={e => { const f = { ...visitFilter, status: e.target.value }; setVisitFilter(f); fetchVisits(f); }}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none">
          <option value="">Tous les statuts</option>
          <option value="planifié">Planifié</option>
          <option value="en_cours">En cours</option>
          <option value="terminé">Terminé</option>
          <option value="reporté">Reporté</option>
          <option value="annulé">Annulé</option>
        </select>
        <input type="date" value={visitFilter.from}
          onChange={e => { const f = { ...visitFilter, from: e.target.value }; setVisitFilter(f); fetchVisits(f); }}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none" />
        <input type="date" value={visitFilter.to}
          onChange={e => { const f = { ...visitFilter, to: e.target.value }; setVisitFilter(f); fetchVisits(f); }}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none" />
        <button onClick={() => { const f = { siteId: '', status: '', from: '', to: '' }; setVisitFilter(f); fetchVisits(f); }}
          className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-2">
          <RefreshCcw className="w-4 h-4" /> Réinitialiser
        </button>
      </div>

      {/* Report view */}
      {showVisitReports && (
        <div className="flex-1 overflow-auto px-6 pb-6">
          {(() => {
            const allVisitTechs = [...new Set(visits.map(v => v.technician || 'Non assigné'))].sort();
            const filteredVisits = visitTechFilter.length > 0
              ? visits.filter(v => visitTechFilter.includes(v.technician || 'Non assigné'))
              : visits;
            const byStatus = ['planifié','en_cours','terminé','reporté','annulé'].map(s => ({
              status: s,
              count: filteredVisits.filter(v => v.status === s).length
            }));
            const bySite = sites.map(s => {
              const siteVisits = filteredVisits.filter(v => v.siteId === s.id);
              const last = siteVisits.filter(v => v.status === 'terminé').sort((a,b) => b.scheduledDate.localeCompare(a.scheduledDate))[0];
              return { site: s.name, total: siteVisits.length, terminé: siteVisits.filter(v=>v.status==='terminé').length, lastDate: last?.scheduledDate ?? '—' };
            }).filter(r => r.total > 0).sort((a,b) => b.total - a.total);
            const byTech: Record<string, number> = {};
            filteredVisits.forEach(v => { byTech[v.technician] = (byTech[v.technician] ?? 0) + 1; });
            const techRows = Object.entries(byTech).sort((a,b) => b[1]-a[1]);
            const statusLabels: Record<string,{label:string,cls:string}> = {
              'planifié':{label:'Planifié',cls:'bg-[#cfe2ff] text-[#155a8a]'},
              'en_cours':{label:'En cours',cls:'bg-yellow-100 text-yellow-700'},
              'terminé':{label:'Terminé',cls:'bg-green-100 text-green-700'},
              'reporté':{label:'Reporté',cls:'bg-orange-100 text-orange-700'},
              'annulé':{label:'Annulé',cls:'bg-red-100 text-red-700'},
            };
            const exportVisitsExcel = async () => {
              const sheets = [];
              sheets.push({ name: 'Par statut', rows: byStatus.map(r => ({ Statut: statusLabels[r.status]?.label ?? r.status, Nombre: r.count })) });
              sheets.push({ name: 'Par site', rows: bySite.map(r => ({ Site: r.site, Total: r.total, Terminées: r.terminé, 'Dernière visite': r.lastDate !== '—' ? new Date(r.lastDate + 'T00:00:00').toLocaleDateString('fr-FR') : '—' })) });
              sheets.push({ name: 'Par technicien', rows: techRows.map(([t, cnt]) => ({ Technicien: t, Visites: cnt })) });
              sheets.push({ name: 'Toutes les visites', rows: filteredVisits.map(v => ({ '#': v.id, 'Site de départ': v.siteName, 'Site visité': v.visitSiteName || '', Date: new Date(v.scheduledDate + 'T00:00:00').toLocaleDateString('fr-FR'), Technicien: v.technician, Statut: statusLabels[v.status]?.label ?? v.status, Objectif: v.purpose, 'Avec maintenance': v.withMaintenance ? 'Oui' : 'Non', Commentaire: v.validationComment || '—', 'Validé par': v.validatedBy || '—', 'Reporté au': v.rescheduledDate ? new Date(v.rescheduledDate + 'T00:00:00').toLocaleDateString('fr-FR') : '—' })) });
              await ExportHelpers.exportMultiSheetXlsx(sheets, `rapport-visites-${Date.now()}.xlsx`);
            };
            const exportVisitsPdf = () => {
              const doc = new jsPDF({ orientation: 'landscape' });
              doc.setFontSize(16); doc.text('Rapport Visites de site', 14, 16);
              doc.setFontSize(10); doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} · ${filteredVisits.length} visite(s)${visitTechFilter.length > 0 ? ` · Filtre : ${visitTechFilter.join(', ')}` : ''}`, 14, 23);
              doc.setFontSize(12); doc.text('Répartition par statut', 14, 32);
              autoTable(doc, {
                startY: 35,
                head: [['Statut', 'Nombre']],
                body: byStatus.map(r => [statusLabels[r.status]?.label ?? r.status, r.count]),
                theme: 'striped', headStyles: { fillColor: [79, 70, 229] },
              });
              const y1 = (doc as any).lastAutoTable.finalY + 8;
              doc.setFontSize(12); doc.text('Visites par site', 14, y1);
              autoTable(doc, {
                startY: y1 + 3,
                head: [['Site', 'Total', 'Terminées', 'Dernière visite terminée']],
                body: bySite.map(r => [
                  r.site, r.total, r.terminé,
                  r.lastDate !== '—' ? new Date(r.lastDate + 'T00:00:00').toLocaleDateString('fr-FR') : '—',
                ]),
                theme: 'striped', headStyles: { fillColor: [79, 70, 229] },
              });
              const y2 = (doc as any).lastAutoTable.finalY + 8;
              if (y2 < 180) {
                doc.setFontSize(12); doc.text('Visites par technicien', 14, y2);
                autoTable(doc, {
                  startY: y2 + 3,
                  head: [['Technicien', 'Nombre de visites']],
                  body: techRows.map(([t, cnt]) => [t, cnt]),
                  theme: 'striped', headStyles: { fillColor: [79, 70, 229] },
                });
              }
              doc.save(`rapport-visites-${Date.now()}.pdf`);
            };
            const exportVisitsWord = async () => {
              const makeHdr = (cells: string[]) => new DocxTableRow({
                children: cells.map(c => new DocxTableCell({
                  children: [new DocxParagraph({ children: [new TextRun({ text: c, bold: true })] })],
                  width: { size: Math.floor(9000 / cells.length), type: WidthType.DXA },
                })),
              });
              const makeRow = (cells: string[]) => new DocxTableRow({
                children: cells.map(c => new DocxTableCell({
                  children: [new DocxParagraph({ children: [new TextRun(c)] })],
                  width: { size: Math.floor(9000 / cells.length), type: WidthType.DXA },
                })),
              });
              const children = [
                new DocxParagraph({ text: 'Rapport Visites de site', heading: HeadingLevel.HEADING_1 }),
                new DocxParagraph({ children: [new TextRun(`Généré le ${new Date().toLocaleDateString('fr-FR')} · ${filteredVisits.length} visite(s)`)] }),
                ...(visitTechFilter.length > 0 ? [new DocxParagraph({ children: [new TextRun({ text: `Technicien(s) : ${visitTechFilter.join(', ')}`, italics: true })] })] : []),
                new DocxParagraph({ text: '' }),
                new DocxParagraph({ text: 'Répartition par statut', heading: HeadingLevel.HEADING_2 }),
                new DocxTable({ rows: [makeHdr(['Statut','Nombre']), ...byStatus.map(r => makeRow([statusLabels[r.status]?.label ?? r.status, String(r.count)]))] }),
                new DocxParagraph({ text: '' }),
                new DocxParagraph({ text: 'Visites par site', heading: HeadingLevel.HEADING_2 }),
                new DocxTable({ rows: [makeHdr(['Site','Total','Terminées','Dernière visite']), ...bySite.map(r => makeRow([r.site, String(r.total), String(r.terminé), r.lastDate !== '—' ? new Date(r.lastDate+'T00:00:00').toLocaleDateString('fr-FR') : '—']))] }),
                new DocxParagraph({ text: '' }),
                new DocxParagraph({ text: 'Visites par technicien', heading: HeadingLevel.HEADING_2 }),
                new DocxTable({ rows: [makeHdr(['Technicien','Nombre de visites']), ...techRows.map(([t, cnt]) => makeRow([t, String(cnt)]))] }),
                new DocxParagraph({ text: '' }),
                new DocxParagraph({ text: 'Détail de toutes les visites', heading: HeadingLevel.HEADING_2 }),
                new DocxTable({ rows: [makeHdr(['#','Site départ','Site visité','Date','Technicien','Statut','Objectif','Maintenance']), ...filteredVisits.map(v => makeRow([String(v.id), v.siteName, v.visitSiteName || '—', new Date(v.scheduledDate+'T00:00:00').toLocaleDateString('fr-FR'), v.technician, statusLabels[v.status]?.label ?? v.status, v.purpose, v.withMaintenance ? 'Oui' : 'Non']))] }),
              ];
              const doc = new DocxDocument({ sections: [{ children }] });
              const blob = await Packer.toBlob(doc);
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = `rapport-visites-${Date.now()}.docx`; a.click();
              URL.revokeObjectURL(url);
            };
            return (
              <div className="space-y-6 mt-2">
                <div className="flex flex-wrap items-start justify-between gap-4 bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2 flex-1">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide shrink-0">Filtrer par technicien :</span>
                    {allVisitTechs.map(tech => (
                      <button key={tech} onClick={() => setVisitTechFilter(f => f.includes(tech) ? f.filter(t => t !== tech) : [...f, tech])}
                        className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${visitTechFilter.includes(tech) ? 'bg-[#1a6fa6] text-white border-[#1a6fa6] shadow-sm' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-[#1a6fa6]/50 hover:text-[#1a6fa6]'}`}>
                        {tech}
                      </button>
                    ))}
                    {visitTechFilter.length > 0 && (
                      <button onClick={() => setVisitTechFilter([])} className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded-full hover:bg-gray-100 transition-colors">
                        ✕ Effacer
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={exportVisitsExcel}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 shadow-sm">
                      <Download className="w-4 h-4 text-green-600" /> Excel
                    </button>
                    <button onClick={exportVisitsPdf}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 shadow-sm">
                      <Download className="w-4 h-4 text-red-500" /> PDF
                    </button>
                    <button onClick={exportVisitsWord}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100 shadow-sm">
                      <Download className="w-4 h-4 text-blue-600" /> Word
                    </button>
                  </div>
                </div>
                {visitTechFilter.length > 0 && (
                  <p className="text-xs text-gray-700 font-medium bg-gradient-to-br from-indigo-50 to-blue-100/30 border border-indigo-100 rounded-lg px-3 py-2">
                    Rapport filtré — {filteredVisits.length} visite(s) pour : {visitTechFilter.join(', ')}
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <h3 className="font-semibold text-gray-800 mb-4">Répartition par statut</h3>
                    {filteredVisits.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">Aucune donnée</p> : (() => {
                      const palette = ['#6366f1','#eab308','#22c55e','#f97316','#ef4444'];
                      const r = 52; const cx = 70; const cy = 70; const stroke = 18;
                      const total = byStatus.reduce((s,b) => s + b.count, 0) || 1;
                      let cumul = 0;
                      const circumference = 2 * Math.PI * r;
                      return (
                        <div className="flex items-center gap-4">
                          <svg width="140" height="140" viewBox="0 0 140 140">
                            {byStatus.map(({ count }, i) => {
                              const pct = count / total;
                              const offset = circumference * (1 - cumul);
                              const dashArr = `${circumference * pct} ${circumference * (1 - pct)}`;
                              cumul += pct;
                              return count > 0 ? <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={palette[i]} strokeWidth={stroke} strokeDasharray={dashArr} strokeDashoffset={offset} style={{transition:'all 0.5s'}} transform={`rotate(-90 ${cx} ${cy})`} /> : null;
                            })}
                            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="22" fontWeight="bold" fill="#1f2937">{filteredVisits.length}</text>
                            <text x={cx} y={cy+16} textAnchor="middle" fontSize="10" fill="#9ca3af">visites</text>
                          </svg>
                          <div className="space-y-1.5 flex-1">
                            {byStatus.map(({ status, count }, i) => (
                              <div key={status} className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{background: palette[i]}} />
                                <span className="text-xs text-gray-600 flex-1">{statusLabels[status]?.label ?? status}</span>
                                <span className="text-sm font-bold text-gray-700">{count}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                    <h3 className="font-semibold text-gray-800 mb-4">Par technicien</h3>
                    {techRows.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">Aucune donnée</p> : (
                      <div className="space-y-3">
                        {techRows.slice(0, 6).map(([tech, cnt]) => {
                          const maxCnt = techRows[0]?.[1] || 1;
                          return (
                            <div key={tech}>
                              <div className="flex justify-between mb-1">
                                <span className="text-xs font-medium text-gray-700 truncate max-w-[120px]">{tech}</span>
                                <span className="text-xs font-bold text-[#155a8a]">{cnt}</span>
                              </div>
                              <div className="bg-gray-100 rounded-full h-2.5 overflow-hidden">
                                <div className="h-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-blue-600 transition-all" style={{width:`${(cnt/maxCnt)*100}%`}} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100"><h3 className="font-semibold text-gray-800">Visites par site</h3></div>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Site</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600">Total</th>
                        <th className="px-4 py-3 text-center font-medium text-gray-600">Terminées</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Dernière visite terminée</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bySite.map(r => (
                        <tr key={r.site} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-800">{r.site}</td>
                          <td className="px-4 py-3 text-center text-gray-700">{r.total}</td>
                          <td className="px-4 py-3 text-center text-green-600 font-medium">{r.terminé}</td>
                          <td className="px-4 py-3 text-gray-500">{r.lastDate !== '—' ? new Date(r.lastDate+'T00:00:00').toLocaleDateString('fr-FR') : '—'}</td>
                        </tr>
                      ))}
                      {bySite.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Aucune donnée</td></tr>}
                    </tbody>
                  </table>
                </div>
                {filteredVisits.filter(v => v.validationComment).length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100"><h3 className="font-semibold text-gray-800">Commentaires de validation</h3></div>
                    <div className="divide-y divide-gray-50">
                      {visits.filter(v => v.validationComment).map(v => (
                        <div key={v.id} className="px-5 py-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusLabels[v.status]?.cls ?? 'bg-gray-100 text-gray-700'}`}>{statusLabels[v.status]?.label ?? v.status}</span>
                            <span className="text-xs text-gray-500">{v.siteName} · {new Date(v.scheduledDate+'T00:00:00').toLocaleDateString('fr-FR')}</span>
                            <span className="text-xs text-gray-400 ml-auto">{v.validatedBy}</span>
                          </div>
                          <p className="text-sm text-gray-700">{v.validationComment}</p>
                          {v.rescheduledDate && <p className="text-xs text-orange-600 mt-1">Reporté au : {new Date(v.rescheduledDate+'T00:00:00').toLocaleDateString('fr-FR')}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Table */}
      {/* ── Calendrier des visites ── */}
      {showCalendar && !showVisitReports && (
        <div className="flex-1 overflow-auto px-6 pb-6 pt-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <button onClick={() => { const d = new Date(calendarYear, calendarMonth - 1); setCalendarYear(d.getFullYear()); setCalendarMonth(d.getMonth()); }} className="p-2 rounded-lg hover:bg-gray-100"><ChevronLeft className="w-5 h-5 text-gray-500" /></button>
              <h3 className="text-base font-bold text-gray-900 capitalize">{new Date(calendarYear, calendarMonth).toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}</h3>
              <button onClick={() => { const d = new Date(calendarYear, calendarMonth + 1); setCalendarYear(d.getFullYear()); setCalendarMonth(d.getMonth()); }} className="p-2 rounded-lg hover:bg-gray-100"><ChevronRight className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-7 mb-2">
                {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d => (
                  <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
                ))}
              </div>
              {(() => {
                const statusCls: Record<string,string> = { planifié:'bg-gradient-to-br from-indigo-400 to-blue-500', en_cours:'bg-yellow-500', terminé:'bg-green-500', reporté:'bg-orange-400', annulé:'bg-red-400' };
                const firstDay = new Date(calendarYear, calendarMonth, 1);
                const startDow = (firstDay.getDay() + 6) % 7;
                const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
                const todayStr = new Date().toISOString().slice(0,10);
                const cells: JSX.Element[] = [];
                for (let i = 0; i < startDow; i++) cells.push(<div key={`e${i}`} />);
                for (let day = 1; day <= daysInMonth; day++) {
                  const dateStr = `${calendarYear}-${String(calendarMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                  const dayVisits = visits.filter(v => v.scheduledDate === dateStr);
                  const isToday = dateStr === todayStr;
                  cells.push(
                    <div key={day} className={`min-h-[72px] p-1 rounded-lg border transition-colors ${isToday ? 'border-indigo-400 bg-gradient-to-br from-indigo-50 to-blue-100/30' : 'border-transparent hover:bg-gray-50'}`}>
                      <div className={`text-xs font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-gradient-to-br from-[#1a6fa6] to-blue-700 text-white shadow-sm' : 'text-gray-600'}`}>{day}</div>
                      <div className="space-y-0.5">
                        {dayVisits.slice(0,3).map(v => (
                          <div key={v.id} onClick={() => setVisitActionDialog(null)} title={`${v.siteName}${v.visitSiteName ? ' → ' + v.visitSiteName : ''} — ${v.technician}`}
                            className={`text-xs px-1.5 py-0.5 rounded-md text-white truncate cursor-default ${statusCls[v.status] ?? 'bg-gray-400'}`}>
                            {v.siteName}{v.visitSiteName ? ` → ${v.visitSiteName}` : ''}
                          </div>
                        ))}
                        {dayVisits.length > 3 && <div className="text-xs text-gray-400 text-center">+{dayVisits.length-3}</div>}
                      </div>
                    </div>
                  );
                }
                return <div className="grid grid-cols-7 gap-1">{cells}</div>;
              })()}
            </div>
            <div className="px-4 pb-4 flex flex-wrap gap-3">
              {[['planifié','bg-gradient-to-br from-indigo-400 to-blue-500','Planifié'],['en_cours','bg-yellow-500','En cours'],['terminé','bg-green-500','Terminé'],['reporté','bg-orange-400','Reporté'],['annulé','bg-red-400','Annulé']].map(([,cls,label]) => (
                <div key={label} className="flex items-center gap-1.5"><span className={`w-3 h-3 rounded-full ${cls}`} /><span className="text-xs text-gray-500">{label}</span></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!showVisitReports && !showCalendar && <div className="flex-1 overflow-auto px-6 pb-6">
        {visitsLoading ? (
          <div className="flex items-center justify-center h-40 text-gray-400"><div className="skeleton h-4 w-48 mx-auto" /><div className="skeleton h-3 w-32 mx-auto mt-2" /></div>
        ) : siteFilteredVisits.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <Clock className="w-10 h-10 mb-2 opacity-30" />
            <p>Aucune visite programmée.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Date', 'Heure', 'Site de départ', 'Site visité', 'Technicien', 'Objet', 'Maint.', 'Statut', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pagedVisits.map(v => {
                  const statusCfg: Record<string, { label: string; cls: string }> = {
                    'planifié':  { label: 'Planifié',  cls: 'bg-blue-100 text-blue-700' },
                    'en_cours':  { label: 'En cours',  cls: 'bg-yellow-100 text-yellow-700' },
                    'terminé':   { label: 'Terminé',   cls: 'bg-green-100 text-green-700' },
                    'annulé':    { label: 'Annulé',    cls: 'bg-gray-100 text-gray-500' },
                  };
                  const sc = statusCfg[v.status] ?? { label: v.status, cls: 'bg-gray-100 text-gray-600' };
                  return (
                    <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                        {v.scheduledDate ? new Date(v.scheduledDate + 'T00:00:00').toLocaleDateString('fr-FR') : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{v.scheduledTime || '—'}</td>
                      <td className="px-4 py-3 text-gray-800 font-medium">{v.siteName}</td>
                      <td className="px-4 py-3 text-gray-700">{v.visitSiteName || '—'}</td>
                      <td className="px-4 py-3 text-gray-700">{v.technician}</td>
                      <td className="px-4 py-3 text-gray-700 max-w-[200px] truncate" title={v.purpose}>{v.purpose}</td>
                      <td className="px-4 py-3">
                        {v.withMaintenance ? (() => {
                          const linked = maintenanceRecords.filter(m => m.visitId === v.id);
                          const pending = linked.filter(m => m.status === 'en_attente').length;
                          const open = linked.filter(m => m.status === 'ouvert' || m.status === 'en_cours').length;
                          const resolved = linked.filter(m => m.status === 'résolu').length;
                          if (pending > 0) return <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full"><Wrench className="w-3 h-3" />{pending} en attente</span>;
                          if (open > 0) return <span className="inline-flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full"><Wrench className="w-3 h-3" />{open} ouvert(s)</span>;
                          if (resolved > 0) return <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full"><Wrench className="w-3 h-3" />{resolved} résolu(s)</span>;
                          return <span className="inline-flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full"><Wrench className="w-3 h-3" />Oui</span>;
                        })() : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${sc.cls}`}>{sc.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {v.status === 'planifié' && canWrite && (
                            <button onClick={() => {
                              fetch(`${API_BASE_URL}/api/visits/${v.id}`, { method: 'PATCH', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify({ ...v, status: 'en_cours' }) })
                                .then(() => fetchVisits());
                            }} className="p-1.5 rounded-lg text-yellow-600 hover:bg-yellow-50" title="Marquer en cours">
                              <Clock className="w-4 h-4" />
                            </button>
                          )}
                          {(v.status === 'planifié' || v.status === 'en_cours' || v.status === 'reporté') && canWrite && (
                            <button onClick={() => setVisitActionDialog({ visit: v, action: 'terminé', comment: '', newDate: '', maintenanceAction: 'laisser' })} className="p-1.5 rounded-lg text-green-600 hover:bg-green-50" title="Terminer la visite">
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          {(v.status === 'planifié' || v.status === 'en_cours') && canWrite && (
                            <button onClick={() => setVisitActionDialog({ visit: v, action: 'reporté', comment: '', newDate: '', maintenanceAction: 'laisser' })} className="p-1.5 rounded-lg text-yellow-600 hover:bg-yellow-50" title="Reporter la visite">
                              <RefreshCcw className="w-4 h-4" />
                            </button>
                          )}
                          {(v.status === 'planifié' || v.status === 'en_cours' || v.status === 'reporté') && canWrite && (
                            <button onClick={() => setVisitActionDialog({ visit: v, action: 'annulé', comment: '', newDate: '', maintenanceAction: 'laisser' })} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50" title="Annuler la visite">
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                          {canWrite && v.status !== 'terminé' && v.status !== 'annulé' && (
                            <button onClick={() => {
                              setEditingVisitId(v.id);
                              setVisitForm({ siteId: v.siteId, siteName: v.siteName || '', visitSiteId: v.visitSiteId ?? null, visitSiteName: v.visitSiteName || '', scheduledDate: v.scheduledDate, scheduledTime: v.scheduledTime, technician: v.technician, purpose: v.purpose, status: v.status, notes: v.notes, withMaintenance: v.withMaintenance, equipmentIds: v.equipmentIds, maintenanceDesc: v.maintenanceDesc });
                              setShowVisitForm(true);
                            }} className="p-1.5 rounded-lg text-[#1a6fa6] hover:bg-[#e8f3fc]" title="Modifier">
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {canModify && v.status !== 'terminé' && v.status !== 'annulé' && v.status !== 'en_cours' && (
                            <button onClick={() => deleteVisitRecord(v.id)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50 hover:text-red-500" title="Supprimer">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>}

      {/* Visit complete dialog */}
      {visitActionDialog && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setVisitActionDialog(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm ${
                visitActionDialog.action === 'terminé' ? 'bg-gradient-to-br from-green-500 to-emerald-600' :
                visitActionDialog.action === 'reporté' ? 'bg-gradient-to-br from-yellow-500 to-orange-500' : 'bg-gradient-to-br from-red-500 to-rose-600'
              }`}>
                {visitActionDialog.action === 'terminé' && <CheckCircle className="w-5 h-5" />}
                {visitActionDialog.action === 'reporté' && <RefreshCcw className="w-5 h-5" />}
                {visitActionDialog.action === 'annulé' && <XCircle className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  {visitActionDialog.action === 'terminé' && 'Terminer la visite'}
                  {visitActionDialog.action === 'reporté' && 'Reporter la visite'}
                  {visitActionDialog.action === 'annulé' && 'Annuler la visite'}
                </h3>
                <p className="text-xs text-gray-500">{visitActionDialog.visit.siteName}{visitActionDialog.visit.visitSiteName ? ` → ${visitActionDialog.visit.visitSiteName}` : ''} · {new Date(visitActionDialog.visit.scheduledDate + 'T00:00:00').toLocaleDateString('fr-FF')}</p>
              </div>
            </div>
            {visitActionDialog.action === 'reporté' && (
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nouvelle date prévue</label>
                <input type="date" value={visitActionDialog.newDate}
                  onChange={e => setVisitActionDialog(d => d ? { ...d, newDate: e.target.value } : d)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6fa6] outline-none" />
              </div>
            )}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Commentaire {visitActionDialog.action === 'annulé' ? '(motif)' : '(optionnel)'}
              </label>
              <textarea rows={3} value={visitActionDialog.comment}
                onChange={e => setVisitActionDialog(d => d ? { ...d, comment: e.target.value } : d)}
                placeholder={visitActionDialog.action === 'annulé' ? 'Motif de l\'annulation…' : visitActionDialog.action === 'reporté' ? 'Raison du report…' : 'Notes sur le déroulement de la visite…'}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6fa6] outline-none resize-none" />
            </div>
            {visitActionDialog.visit.withMaintenance && (
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  {visitActionDialog.action === 'annulé' ? 'Tickets de maintenance liés' : 'Que faire de la maintenance ?'}
                </p>
                <div className="space-y-2">
                  {visitActionDialog.action === 'terminé' && (
                    <label className="flex items-start gap-2.5 cursor-pointer p-2.5 rounded-lg border border-gray-200 hover:bg-gray-50">
                      <input type="radio" name="maintAction" value="sur_place"
                        checked={visitActionDialog.maintenanceAction === 'sur_place'}
                        onChange={() => setVisitActionDialog(d => d ? { ...d, maintenanceAction: 'sur_place' } : d)}
                        className="mt-0.5 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-800">Traité sur place</p>
                        <p className="text-xs text-gray-500">Les tickets liés passent en « Résolu »</p>
                      </div>
                    </label>
                  )}
                  <label className="flex items-start gap-2.5 cursor-pointer p-2.5 rounded-lg border border-gray-200 hover:bg-gray-50">
                    <input type="radio" name="maintAction" value="programmer"
                      checked={visitActionDialog.maintenanceAction === 'programmer'}
                      onChange={() => setVisitActionDialog(d => d ? { ...d, maintenanceAction: 'programmer' } : d)}
                      className="mt-0.5 text-[#1a6fa6]" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">À programmer</p>
                      <p className="text-xs text-gray-500">Les tickets passent en « Ouvert » pour planification</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-2.5 cursor-pointer p-2.5 rounded-lg border border-gray-200 hover:bg-gray-50">
                    <input type="radio" name="maintAction" value="laisser"
                      checked={visitActionDialog.maintenanceAction === 'laisser'}
                      onChange={() => setVisitActionDialog(d => d ? { ...d, maintenanceAction: 'laisser' } : d)}
                      className="mt-0.5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">Laisser en attente</p>
                      <p className="text-xs text-gray-500">Les tickets restent inchangés</p>
                    </div>
                  </label>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setVisitActionDialog(null)} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-100 transition-colors">
                Retour
              </button>
              <button onClick={handleVisitAction} className={`flex-1 px-4 py-2.5 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-all ${
                visitActionDialog.action === 'terminé' ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700' :
                visitActionDialog.action === 'reporté' ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600' : 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700'
              }`}>
                {visitActionDialog.action === 'terminé' && <><CheckCircle className="w-4 h-4" /> Confirmer</>}
                {visitActionDialog.action === 'reporté' && <><RefreshCcw className="w-4 h-4" /> Reporter</>}
                {visitActionDialog.action === 'annulé' && <><XCircle className="w-4 h-4" /> Annuler la visite</>}
              </button>
            </div>
          </div>
        </div>
      )}
      </>}

      {/* Visit form modal */}
      {showVisitForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowVisitForm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-sm shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-gray-900">{editingVisitId ? 'Modifier la visite' : 'Programmer une visite'}</h3>
                <p className="text-xs text-gray-400">Renseignez les informations de la visite</p>
              </div>
              <button onClick={() => setShowVisitForm(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" title="Fermer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Site / Lieu de départ */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Site de départ <span className="text-red-500">*</span></label>
                {(visitForm.siteId || visitForm.siteName) && (() => {
                  const s = visitForm.siteId ? sites.find(s => s.id === visitForm.siteId) : null;
                  const displayName = s?.name ?? visitForm.siteName;
                  const subInfo = s ? `${s.city}${s.country ? `, ${s.country}` : ''}` : 'Lieu personnalisé';
                  return (
                    <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-gradient-to-br from-indigo-50 to-blue-100/30 border border-indigo-200 rounded-lg">
                      <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-sm shrink-0"><Globe className="w-3 h-3" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{displayName}</p>
                        <p className="text-xs text-gray-400">{subInfo}</p>
                      </div>
                      <button type="button" onClick={() => { setVisitForm(f => ({ ...f, siteId: null, siteName: '', equipmentIds: [] })); setSiteSearchQuery(''); }}
                        className="text-indigo-400 hover:text-[#155a8a] shrink-0" title="Changer de site">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })()}
                {!visitForm.siteId && !visitForm.siteName && (
                  <div className="relative">
                    <div className="flex items-center gap-2 border border-gray-300 rounded-lg bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-[#1a6fa6] focus-within:border-[#1a6fa6]">
                      <Search className="w-4 h-4 text-gray-400 shrink-0" />
                      <input
                        type="text"
                        value={siteSearchQuery}
                        onChange={e => { setSiteSearchQuery(e.target.value); setShowVisitSiteDropdown(true); }}
                        onFocus={() => setShowVisitSiteDropdown(true)}
                        onBlur={() => setTimeout(() => setShowVisitSiteDropdown(false), 200)}
                        placeholder="Rechercher un site ou saisir un lieu…"
                        className="flex-1 text-sm outline-none bg-transparent text-gray-700 placeholder-gray-400"
                      />
                      {siteSearchQuery && (
                        <button type="button" onClick={() => { setSiteSearchQuery(''); setShowVisitSiteDropdown(false); }}
                          className="text-gray-400 hover:text-gray-600">
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {showVisitSiteDropdown && (() => {
                      const q = siteSearchQuery.trim().toLowerCase();
                      const pool = userAllowedSiteIds.length > 0
                        ? sites.filter(s => userAllowedSiteIds.includes(s.id))
                        : sites;
                      const results = q
                        ? pool.filter(s => s.name.toLowerCase().includes(q) || s.city?.toLowerCase().includes(q) || s.country?.toLowerCase().includes(q))
                        : pool;
                      return (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-52 overflow-y-auto">
                          {results.map(s => (
                            <button key={s.id} type="button"
                              onMouseDown={() => {
                                setVisitForm(f => ({ ...f, siteId: s.id, siteName: '', equipmentIds: [] }));
                                setSiteSearchQuery('');
                                setShowVisitSiteDropdown(false);
                                setEqSearchQuery('');
                              }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#e8f3fc] text-left border-b border-gray-50 last:border-0">
                              <Globe className="w-4 h-4 text-indigo-400 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                                <p className="text-xs text-gray-400">{s.city}{s.country ? `, ${s.country}` : ''}</p>
                              </div>
                            </button>
                          ))}
                          {q && (
                            <button type="button"
                              onMouseDown={() => {
                                setVisitForm(f => ({ ...f, siteId: null, siteName: siteSearchQuery.trim(), equipmentIds: [] }));
                                setSiteSearchQuery('');
                                setShowVisitSiteDropdown(false);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-green-50 text-left border-t border-green-100 bg-green-50/50">
                              <span className="text-sm text-green-600 font-medium shrink-0">+</span>
                              <p className="text-sm text-green-700">Utiliser « {siteSearchQuery.trim()} » comme lieu</p>
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Site à visiter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Site à visiter <span className="text-gray-400 font-normal">(optionnel)</span></label>
                {(visitForm.visitSiteId || visitForm.visitSiteName) && (() => {
                  const s = visitForm.visitSiteId ? sites.find(s => s.id === visitForm.visitSiteId) : null;
                  const displayName = s?.name ?? visitForm.visitSiteName;
                  const subInfo = s ? `${s.city}${s.country ? `, ${s.country}` : ''}` : 'Lieu personnalisé';
                  return (
                    <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-gradient-to-br from-emerald-50 to-green-100/30 border border-emerald-200 rounded-lg">
                      <div className="w-6 h-6 rounded-md bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-white shadow-sm shrink-0"><MapPin className="w-3 h-3" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{displayName}</p>
                        <p className="text-xs text-gray-400">{subInfo}</p>
                      </div>
                      <button type="button" onClick={() => { setVisitForm(f => ({ ...f, visitSiteId: null, visitSiteName: '' })); setVisitSiteSearchQuery(''); }}
                        className="text-emerald-400 hover:text-green-600 shrink-0" title="Changer">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })()}
                {!visitForm.visitSiteId && !visitForm.visitSiteName && (
                  <div className="relative">
                    <div className="flex items-center gap-2 border border-gray-300 rounded-lg bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-green-500 focus-within:border-green-500">
                      <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                      <input
                        type="text"
                        value={visitSiteSearchQuery}
                        onChange={e => { setVisitSiteSearchQuery(e.target.value); setShowVisitSiteSearchDropdown(true); }}
                        onFocus={() => setShowVisitSiteSearchDropdown(true)}
                        onBlur={() => setTimeout(() => setShowVisitSiteSearchDropdown(false), 200)}
                        placeholder="Rechercher un site ou saisir un lieu à visiter…"
                        className="flex-1 text-sm outline-none bg-transparent text-gray-700 placeholder-gray-400"
                      />
                      {visitSiteSearchQuery && (
                        <button type="button" onClick={() => { setVisitSiteSearchQuery(''); setShowVisitSiteSearchDropdown(false); }}
                          className="text-gray-400 hover:text-gray-600">
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {showVisitSiteSearchDropdown && (() => {
                      const q = visitSiteSearchQuery.trim().toLowerCase();
                      const pool = userAllowedSiteIds.length > 0
                        ? sites.filter(s => userAllowedSiteIds.includes(s.id))
                        : sites;
                      const results = q
                        ? pool.filter(s => s.name.toLowerCase().includes(q) || s.city?.toLowerCase().includes(q) || s.country?.toLowerCase().includes(q))
                        : pool;
                      return (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-52 overflow-y-auto">
                          {results.map(s => (
                            <button key={s.id} type="button"
                              onMouseDown={() => {
                                setVisitForm(f => ({ ...f, visitSiteId: s.id, visitSiteName: '' }));
                                setVisitSiteSearchQuery('');
                                setShowVisitSiteSearchDropdown(false);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-green-50 text-left border-b border-gray-50 last:border-0">
                              <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                                <p className="text-xs text-gray-400">{s.city}{s.country ? `, ${s.country}` : ''}</p>
                              </div>
                            </button>
                          ))}
                          {q && (
                            <button type="button"
                              onMouseDown={() => {
                                setVisitForm(f => ({ ...f, visitSiteId: null, visitSiteName: visitSiteSearchQuery.trim() }));
                                setVisitSiteSearchQuery('');
                                setShowVisitSiteSearchDropdown(false);
                              }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-green-50 text-left border-t border-green-100 bg-green-50/50">
                              <span className="text-sm text-green-600 font-medium shrink-0">+</span>
                              <p className="text-sm text-green-700">Utiliser « {visitSiteSearchQuery.trim()} » comme lieu</p>
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date <span className="text-red-500">*</span></label>
                  <input type="date" value={visitForm.scheduledDate} onChange={e => setVisitForm(f => ({ ...f, scheduledDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6fa6] outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Heure</label>
                  <input type="time" value={visitForm.scheduledTime} onChange={e => setVisitForm(f => ({ ...f, scheduledTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6fa6] outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Technicien <span className="text-red-500">*</span></label>
                <input type="text" value={visitForm.technician} onChange={e => setVisitForm(f => ({ ...f, technician: e.target.value }))}
                  placeholder="Nom du technicien"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6fa6] outline-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Objet de la visite <span className="text-red-500">*</span></label>
                <input type="text" value={visitForm.purpose} onChange={e => setVisitForm(f => ({ ...f, purpose: e.target.value }))}
                  placeholder="Ex : Audit réseau, vérification équipements…"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6fa6] outline-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                <select value={visitForm.status} onChange={e => setVisitForm(f => ({ ...f, status: e.target.value as VisitStatus }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6fa6] outline-none">
                  <option value="planifié">Planifié</option>
                  <option value="en_cours">En cours</option>
                  <option value="terminé">Terminé</option>
                  <option value="annulé">Annulé</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={visitForm.notes} onChange={e => setVisitForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Informations complémentaires…"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1a6fa6] outline-none resize-none" />
              </div>

              <div className="border border-orange-200 rounded-xl p-4 bg-orange-50">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={visitForm.withMaintenance} onChange={e => setVisitForm(f => ({ ...f, withMaintenance: e.target.checked }))}
                    className="rounded text-orange-500 w-4 h-4" />
                  <div className="flex items-center gap-1.5">
                    <Wrench className="w-4 h-4 text-orange-500" />
                    <span className="text-sm font-medium text-gray-800">Inclure une intervention de maintenance</span>
                  </div>
                </label>
                {visitForm.withMaintenance && (
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Équipements concernés <span className="text-gray-400 font-normal">(optionnel)</span></label>
                      {visitForm.equipmentIds.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {visitForm.equipmentIds.map(id => {
                            const eq = equipments.find(e => e.id === id);
                            if (!eq) return null;
                            return (
                              <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-50 border border-orange-200 text-orange-700 text-xs rounded-full">
                                <Wrench className="w-2.5 h-2.5" />
                                {eq.name}
                                <button type="button" onClick={() => setVisitForm(f => ({ ...f, equipmentIds: f.equipmentIds.filter(i => i !== id) }))}
                                  className="ml-0.5 hover:text-orange-900 text-orange-500">
                                  <XCircle className="w-3 h-3" />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      )}
                      <div className="relative">
                        <div className="flex items-center gap-2 border border-gray-200 rounded-lg bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-orange-400 focus-within:border-orange-400">
                          <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <input
                            type="text"
                            value={eqSearchQuery}
                            onChange={e => { setEqSearchQuery(e.target.value); setShowEqDropdown(true); }}
                            onFocus={() => setShowEqDropdown(true)}
                            onBlur={() => setTimeout(() => setShowEqDropdown(false), 150)}
                            placeholder="Rechercher un équipement…"
                            className="flex-1 text-xs outline-none bg-transparent text-gray-700 placeholder-gray-400"
                          />
                          {eqSearchQuery && (
                            <button type="button" onClick={() => { setEqSearchQuery(''); setShowEqDropdown(false); }}
                              className="text-gray-400 hover:text-gray-600">
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        {showEqDropdown && (() => {
                          const pool = (visitForm.visitSiteId
                            ? equipments.filter(e => e.siteId === visitForm.visitSiteId)
                            : visitForm.siteId
                              ? equipments.filter(e => e.siteId === visitForm.siteId)
                              : equipments
                          ).filter(e => !visitForm.equipmentIds.includes(e.id));
                          const query = eqSearchQuery.trim().toLowerCase();
                          const results = query
                            ? pool.filter(e =>
                                e.name.toLowerCase().includes(query) ||
                                e.brand?.toLowerCase().includes(query) ||
                                e.model?.toLowerCase().includes(query) ||
                                e.serialNumber?.toLowerCase().includes(query) ||
                                e.location?.toLowerCase().includes(query) ||
                                e.type?.toLowerCase().includes(query)
                              )
                            : pool;
                          if (results.length === 0) return (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-center">
                              <p className="text-xs text-gray-400">{pool.length === 0 ? 'Aucun équipement sur ce site.' : 'Aucun résultat.'}</p>
                            </div>
                          );
                          return (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                              {results.slice(0, 10).map(eq => (
                                <button key={eq.id} type="button"
                                  onMouseDown={() => {
                                    setVisitForm(f => ({ ...f, equipmentIds: [...f.equipmentIds, eq.id] }));
                                    setEqSearchQuery('');
                                    setShowEqDropdown(false);
                                  }}
                                  className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-orange-50 text-left border-b border-gray-50 last:border-0">
                                  <div className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                                    <Monitor className="w-3.5 h-3.5 text-gray-500" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium text-gray-800 truncate">{eq.name}</p>
                                    <p className="text-xs text-gray-400 truncate">{[eq.brand, eq.model, eq.location].filter(Boolean).join(' · ')}</p>
                                  </div>
                                </button>
                              ))}
                              {results.length > 10 && (
                                <p className="text-xs text-gray-400 text-center py-2 border-t">{results.length - 10} autre(s) — affinez la recherche</p>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Description de la maintenance</label>
                      <textarea value={visitForm.maintenanceDesc} onChange={e => setVisitForm(f => ({ ...f, maintenanceDesc: e.target.value }))}
                        rows={2} placeholder="Travaux de maintenance prévus…"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none bg-white" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-100">
              <button onClick={() => setShowVisitForm(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-100 transition-colors">
                Annuler
              </button>
              <button onClick={saveVisit} disabled={visitSaving}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-[#1a6fa6] to-blue-700 text-white rounded-xl text-sm font-semibold hover:from-[#155a8a] hover:to-[#0d4a73] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all">
                {visitSaving ? 'Enregistrement…' : editingVisitId ? 'Mettre à jour' : 'Programmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal Corbeille Visites ════════════════════════════════════════ */}
      {showVisitsTrash && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowVisitsTrash(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Trash2 className="w-5 h-5 text-red-500" /> Visites supprimées</h2>
              <button onClick={() => setShowVisitsTrash(false)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
            </div>
            <div className="overflow-auto flex-1 p-4">
              {visitsTrashLoading ? (
                <div className="text-center py-12 text-gray-400"><div className="skeleton h-4 w-48 mx-auto" /><div className="skeleton h-3 w-32 mx-auto mt-2" /></div>
              ) : deletedVisits.length === 0 ? (
                <div className="text-center py-12 text-gray-400"><Trash2 className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>Corbeille vide</p></div>
              ) : (
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-100"><th className="text-left px-3 py-2 text-xs font-bold text-gray-500 uppercase">Site</th><th className="text-left px-3 py-2 text-xs font-bold text-gray-500 uppercase">Date</th><th className="text-left px-3 py-2 text-xs font-bold text-gray-500 uppercase">Supprimé le</th><th className="px-3 py-2" /></tr></thead>
                  <tbody>
                    {deletedVisits.map(e => (
                      <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-gray-900">{e.siteName}</p>
                          <p className="text-xs text-gray-400">{e.technician}</p>
                        </td>
                        <td className="px-3 py-2.5 text-sm text-gray-600">{e.scheduledDate ? new Date(e.scheduledDate).toLocaleDateString('fr-FR') : '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-500">{e.deleted_at ? new Date(e.deleted_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => restoreVisit(e.id)} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 flex items-center gap-1"><RefreshCcw className="w-3 h-3" /> Restaurer</button>
                            <button onClick={() => hardDeleteVisit(e.id)} className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600 flex items-center gap-1"><Trash2 className="w-3 h-3" /> Suppr. déf.</button>
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
    </ModuleShell>
  );
};

export default VisitsModule;
