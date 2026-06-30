import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Trash2, Edit, Monitor, Wrench, AlertTriangle, Search, CircleCheck,
  CheckCircle, Clock, Headset, LayoutList, LayoutGrid, Download, X
} from 'lucide-react';
import * as ExportHelpers from '../utils/exportHelpers';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  TableRow as DocxTableRow, TableCell as DocxTableCell,
  Paragraph as DocxParagraph, TextRun, Document as DocxDocument,
  Packer, Table as DocxTable, WidthType, HeadingLevel
} from 'docx';
import { ModuleShell } from '../components/ModuleShell';
import { Pagination as SharedPagination } from '../components/Pagination';
import { authHeaders } from '../utils/helpers';
import { API_BASE_URL, PAGE_SIZE } from '../constants/index';
import type { Equipment, Site, MaintenanceRecord, MaintenanceForm, MaintenanceStatus, MaintenancePriority } from '../types/index';

function Section({ icon, title, color, children }: { icon: React.ReactNode; title: string; color: 'red' | 'yellow' | 'green' | 'blue'; children: React.ReactNode }) {
  const border = { red: 'border-red-200', yellow: 'border-yellow-200', green: 'border-green-200', blue: 'border-blue-200' }[color];
  const bg = { red: 'bg-red-50', yellow: 'bg-yellow-50', green: 'bg-green-50', blue: 'bg-blue-50' }[color];
  return (
    <div className={`rounded-lg border ${border} ${bg} p-4`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm font-semibold text-gray-700">{title}</span>
      </div>
      {children}
    </div>
  );
}

function Pagination({ total, page, onChange }: { total: number; page: number; onChange: (p: number) => void }) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  return <SharedPagination currentPage={page} totalPages={totalPages} totalItems={total} pageSize={PAGE_SIZE} onPageChange={onChange} />;
}

const maintenanceStatusStyle: Record<string, string> = {
  en_attente: 'bg-blue-100 text-blue-700',
  ouvert:     'bg-red-100 text-red-700',
  en_cours:   'bg-yellow-100 text-yellow-700',
  résolu:     'bg-green-100 text-green-700',
};

const maintenanceStatusLabel: Record<string, string> = {
  en_attente: 'En attente',
  ouvert:     'Ouvert',
  en_cours:   'En cours',
  résolu:     'Résolu',
};

const maintenancePriorityStyle: Record<string, string> = {
  faible:   'bg-gray-100 text-gray-600',
  normale:  'bg-blue-100 text-blue-700',
  haute:    'bg-orange-100 text-orange-700',
  critique: 'bg-red-200 text-red-800 font-bold',
};

const defaultMaintenanceForm: MaintenanceForm = {
  equipmentId: null, failureDesc: '', diagnosis: '', solution: '',
  partsReplaced: '', technician: '', priority: 'normale', status: 'ouvert', requestType: 'maintenance'
};

const fmtDate = (iso: string | null) => iso
  ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '—';

interface Props {
  onClose: () => void;
  onUnauthorized: () => void;
  onToast: (t: { message: string; type: 'error' | 'success' | 'info' } | null) => void;
  onConfirm: (c: { message: string; onConfirm: () => void } | null) => void;
  equipments: Equipment[];
  sites: Site[];
  canWrite: boolean;
  canModify: boolean;
  currentUserName: string;
  userAllowedSiteIds: number[];
  maintenanceRecords: MaintenanceRecord[];
  onRefresh: (status?: string) => void;
  onRefreshEquipment: () => void;
  initialFormType?: 'maintenance' | 'assistance';
  initialEquipmentId?: number | null;
}

export default function MaintenanceModule({
  onClose, onUnauthorized, onToast, onConfirm,
  equipments, sites, canWrite, canModify, currentUserName, userAllowedSiteIds,
  maintenanceRecords, onRefresh, onRefreshEquipment,
  initialFormType, initialEquipmentId
}: Props) {
  const [showKanban, setShowKanban] = useState(false);
  const [showMaintenanceReport, setShowMaintenanceReport] = useState(false);
  const [maintenanceFilter, setMaintenanceFilter] = useState<string>('all');
  const [selectedMaintenance, setSelectedMaintenance] = useState<MaintenanceRecord | null>(null);
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [maintenanceEditId, setMaintenanceEditId] = useState<number | null>(null);
  const [maintenanceForm, setMaintForm] = useState<MaintenanceForm>(defaultMaintenanceForm);
  const [showAssistanceFilter, setShowAssistanceFilter] = useState(false);
  const [maintTechFilter, setMaintTechFilter] = useState<string[]>([]);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingValue, setRatingValue] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [showMaintenanceTrash, setShowMaintenanceTrash] = useState(false);
  const [deletedMaintenanceRecords, setDeletedMaintenanceRecords] = useState<any[]>([]);
  const [maintenanceTrashLoading, setMaintenanceTrashLoading] = useState(false);
  const [maintenancePage, setMaintenancePage] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setMaintenancePage(1); }, [maintenanceFilter]);

  useEffect(() => {
    if (initialEquipmentId != null) {
      setMaintForm(prev => ({ ...prev, equipmentId: initialEquipmentId }));
      setShowMaintenanceForm(true);
    } else if (initialFormType === 'assistance') {
      setMaintForm(prev => ({ ...prev, requestType: 'assistance' }));
      setShowMaintenanceForm(true);
    }
  }, []);

  const siteFilteredRecords = useMemo(() => {
    if (userAllowedSiteIds.length === 0) return maintenanceRecords;
    return maintenanceRecords.filter(m => {
      const siteId = (m as MaintenanceRecord & { siteId?: number | null }).siteId;
      if (siteId != null) return userAllowedSiteIds.includes(siteId);
      if (m.equipmentId != null) {
        const eq = equipments.find(e => e.id === m.equipmentId);
        return eq?.siteId != null && userAllowedSiteIds.includes(eq.siteId);
      }
      return false;
    });
  }, [maintenanceRecords, userAllowedSiteIds, equipments]);

  const assistanceViewRecords = useMemo(() =>
    showAssistanceFilter
      ? siteFilteredRecords.filter(m => m.requestType === 'assistance')
      : siteFilteredRecords,
    [showAssistanceFilter, siteFilteredRecords]
  );

  const pagedMaintenance = useMemo(() =>
    assistanceViewRecords.slice((maintenancePage - 1) * PAGE_SIZE, maintenancePage * PAGE_SIZE),
    [assistanceViewRecords, maintenancePage]
  );

  const activeCount = useMemo(() =>
    siteFilteredRecords.filter(m => m.status !== 'résolu').length,
    [siteFilteredRecords]
  );

  // ── API helpers ──

  const apiFetch = async (url: string, opts?: RequestInit) => {
    const r = await fetch(`${API_BASE_URL}${url}`, { ...opts, headers: { ...authHeaders(), ...(opts?.headers || {}) } });
    if (r.status === 401) onUnauthorized();
    return r;
  };

  const handleSaveMaintenance = async () => {
    if (!maintenanceForm.failureDesc.trim()) { onToast({ message: 'Description de la panne requise.', type: 'error' }); return; }
    try {
      if (maintenanceEditId !== null) {
        const r = await apiFetch(`/api/maintenance/${maintenanceEditId}`, {
          method: 'PUT', body: JSON.stringify(maintenanceForm),
        });
        if (r.ok) {
          const updated = await r.json();
          onRefresh(maintenanceFilter);
          setSelectedMaintenance(updated);
          onRefreshEquipment();
        }
      } else {
        const r = await apiFetch('/api/maintenance', {
          method: 'POST', body: JSON.stringify(maintenanceForm),
        });
        if (r.ok) {
          await r.json();
          onRefresh(maintenanceFilter);
          onRefreshEquipment();
        }
      }
      setShowMaintenanceForm(false);
      setMaintForm(defaultMaintenanceForm);
      setMaintenanceEditId(null);
    } catch { onToast({ message: 'Erreur lors de la sauvegarde.', type: 'error' }); }
  };

  const handleDeleteMaintenance = (id: number) => {
    onConfirm({
      message: 'Supprimer ce ticket de maintenance ?',
      onConfirm: async () => {
        onConfirm(null);
        const r = await apiFetch(`/api/maintenance/${id}`, { method: 'DELETE' });
        if (r.ok || r.status === 204) {
          if (selectedMaintenance?.id === id) setSelectedMaintenance(null);
          onRefresh(maintenanceFilter);
        }
      }
    });
  };

  const fetchDeletedMaintenanceRecords = async () => {
    setMaintenanceTrashLoading(true);
    try { const r = await apiFetch('/api/maintenance/deleted'); if (r.ok) setDeletedMaintenanceRecords(await r.json()); } catch {}
    setMaintenanceTrashLoading(false);
  };

  const restoreMaintenance = async (id: number) => {
    const r = await apiFetch(`/api/maintenance/${id}/restore`, { method: 'POST' });
    if (r.ok) { setDeletedMaintenanceRecords(p => p.filter(m => m.id !== id)); onRefresh(); onToast({ message: 'Ticket restauré.', type: 'success' }); }
  };

  const hardDeleteMaintenance = async (id: number) => {
    if (!confirm('Suppression définitive ?')) return;
    const r = await apiFetch(`/api/maintenance/${id}/hard`, { method: 'DELETE' });
    if (r.ok) { setDeletedMaintenanceRecords(p => p.filter(m => m.id !== id)); onToast({ message: 'Ticket supprimé définitivement.', type: 'success' }); }
  };

  const handleStatusChange = async (id: number, status: string) => {
    const r = await apiFetch(`/api/maintenance/${id}`, {
      method: 'PUT', body: JSON.stringify({ status })
    });
    if (r.ok) { onRefresh(maintenanceFilter); onRefreshEquipment(); }
  };

  const handleAssign = async (id: number) => {
    const r = await apiFetch(`/api/maintenance/${id}/assign`, { method: 'PATCH' });
    if (r.ok) { const u = await r.json(); setSelectedMaintenance(u); onRefresh(); }
  };

  const handleConfirmTech = async (id: number) => {
    const r = await apiFetch(`/api/maintenance/${id}/confirm-tech`, { method: 'PATCH' });
    if (r.ok) { const u = await r.json(); setSelectedMaintenance(u); onRefresh(); if (u.userConfirmed && u.techConfirmed) setShowRatingModal(true); }
  };

  const handleConfirmUser = async (id: number) => {
    const r = await apiFetch(`/api/maintenance/${id}/confirm-user`, { method: 'PATCH' });
    if (r.ok) { const u = await r.json(); setSelectedMaintenance(u); onRefresh(); if (u.userConfirmed && u.techConfirmed) setShowRatingModal(true); }
  };

  const handleAddNote = async () => {
    if (!noteText.trim() || !selectedMaintenance) return;
    setNoteLoading(true);
    try {
      const r = await apiFetch(`/api/maintenance/${selectedMaintenance.id}/note`, {
        method: 'PATCH', body: JSON.stringify({ text: noteText })
      });
      if (r.ok) {
        const updated = await r.json();
        setSelectedMaintenance(updated);
        setNoteText('');
        setShowNoteForm(false);
        onRefresh();
      }
    } catch {}
    setNoteLoading(false);
  };

  return (
    <ModuleShell
      icon={<Wrench className="w-5 h-5 text-white" />}
      title="Module Maintenance"
      subtitle={`${activeCount} ticket(s) actif(s)`}
      onClose={onClose}
      actions={
        <>
          <button onClick={() => { setMaintForm({ ...defaultMaintenanceForm, requestType: 'maintenance' }); setMaintenanceEditId(null); setShowMaintenanceForm(true); setSelectedMaintenance(null); }}
            className="inline-flex items-center gap-2 rounded border border-white/30 bg-white/15 px-3 py-1.5 text-sm text-white hover:bg-white/25 font-semibold transition-colors">
            <Plus className="w-4 h-4" /> Nouveau ticket
          </button>
          {canModify && <button onClick={() => { fetchDeletedMaintenanceRecords(); setShowMaintenanceTrash(true); }} className="border border-white/30 text-white/70 p-1.5 rounded hover:bg-white/10 shrink-0 transition-colors" title="Corbeille"><Trash2 className="w-3.5 h-3.5" /></button>}
        </>
      }
    >
      {/* Tabs */}
      <div className="px-6 pt-3 pb-0 flex gap-1 shrink-0 border-b border-gray-200 bg-white items-center">
        <button onClick={() => { setShowMaintenanceReport(false); setShowKanban(false); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${!showMaintenanceReport && !showKanban ? 'border-[#1a6fa6] text-[#1a6fa6]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <LayoutList className="w-3.5 h-3.5" /> Liste
        </button>
        <button onClick={() => { setShowMaintenanceReport(false); setShowKanban(true); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${!showMaintenanceReport && showKanban ? 'border-[#1a6fa6] text-[#1a6fa6]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          <LayoutGrid className="w-3.5 h-3.5" /> Kanban
        </button>
        <button onClick={() => { setShowMaintenanceReport(true); setShowKanban(false); if (maintenanceFilter !== 'all') { setMaintenanceFilter('all'); onRefresh('all'); } }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${showMaintenanceReport ? 'border-[#1a6fa6] text-[#1a6fa6]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          Rapport
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => { setShowAssistanceFilter(v => !v); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${showAssistanceFilter ? 'bg-[#1a6fa6] text-white' : 'text-gray-500 hover:text-gray-700 border border-gray-200'}`}>
            <Headset className="w-3.5 h-3.5 inline-block mr-1" />
            Assistance
          </button>
        </div>
      </div>

      {/* Stats pills */}
      <div className="flex gap-3 px-6 py-3 shrink-0 border-b border-gray-100 bg-white">
        {[
          { label: 'En attente', status: 'en_attente', dot: 'bg-blue-500', bg: 'bg-blue-50', ring: 'ring-blue-200' },
          { label: 'Ouverts', status: 'ouvert', dot: 'bg-red-500', bg: 'bg-red-50', ring: 'ring-red-200' },
          { label: 'En cours', status: 'en_cours', dot: 'bg-yellow-500', bg: 'bg-yellow-50', ring: 'ring-yellow-200' },
          { label: 'Résolus', status: 'résolu', dot: 'bg-green-500', bg: 'bg-green-50', ring: 'ring-green-200' },
        ].map(({ label, status, dot, bg, ring }) => (
          <button key={status} onClick={() => { const f = maintenanceFilter === status ? 'all' : status; setMaintenanceFilter(f); onRefresh(f); }}
            className={`flex items-center gap-3 rounded-xl px-4 py-2.5 transition-all ${maintenanceFilter === status ? bg + ' ring-2 ' + ring + ' shadow-sm' : 'bg-white border border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}>
            <span className={`w-2 h-2 rounded-full ${dot}`} />
            <span className="text-xs font-medium text-gray-700 min-w-[3rem]">{label}</span>
            <span className="text-sm font-bold text-gray-900">{maintenanceRecords.filter(m => m.status === status).length}</span>
          </button>
        ))}
      </div>

      {/* Rapport maintenance */}
      {showMaintenanceReport && (() => {
        const allRecords = maintenanceRecords;
        const allTechs = [...new Set(allRecords.map(m => m.technician || 'Non assigné'))].sort();
        const all = maintTechFilter.length > 0
          ? allRecords.filter(m => maintTechFilter.includes(m.technician || 'Non assigné'))
          : allRecords;
        const byStatus = (['en_attente','ouvert','en_cours','résolu'] as const).map(s => ({
          s, label: maintenanceStatusLabel[s] ?? s, style: maintenanceStatusStyle[s],
          count: all.filter(m => m.status === s).length,
        }));
        const byPriority: Record<string, number> = {};
        all.forEach(m => { byPriority[m.priority] = (byPriority[m.priority] ?? 0) + 1; });
        const byTech: Record<string, { total: number; resolved: number }> = {};
        all.forEach(m => {
          const t = m.technician || 'Non assigné';
          if (!byTech[t]) byTech[t] = { total: 0, resolved: 0 };
          byTech[t].total++;
          if (m.status === 'résolu') byTech[t].resolved++;
        });
        const byEq: Record<string, number> = {};
        all.forEach(m => { if (m.equipmentName) { byEq[m.equipmentName] = (byEq[m.equipmentName] ?? 0) + 1; } });
        const resolved = all.filter(m => m.status === 'résolu' && m.openedAt && m.closedAt);
        const avgMs = resolved.length ? resolved.reduce((acc, m) => acc + (new Date(m.closedAt!).getTime() - new Date(m.openedAt).getTime()), 0) / resolved.length : 0;
        const avgH = Math.round(avgMs / 3600000);
        const prioColors: Record<string, string> = { critique: 'bg-red-500', haute: 'bg-orange-400', normale: 'bg-blue-400', basse: 'bg-gray-300' };

        const exportMaintenanceExcel = async () => {
          const sheets: { name: string; rows: any[] }[] = [];
          sheets.push({ name: 'Par statut', rows: byStatus.map(r => ({ Statut: r.label, Nombre: r.count })) });
          sheets.push({ name: 'Par technicien', rows: Object.entries(byTech).sort((a,b) => b[1].total - a[1].total).map(([t, d]) => ({ Technicien: t, Total: d.total, Résolus: d.resolved, 'Taux (%)': d.total ? Math.round((d.resolved / d.total) * 100) : 0 })) });
          sheets.push({ name: 'Par équipement', rows: Object.entries(byEq).sort((a,b) => b[1] - a[1]).map(([eq, cnt]) => ({ Équipement: eq, Tickets: cnt })) });
          sheets.push({ name: 'Tous les tickets', rows: all.map(m => ({ '#': m.id, Statut: maintenanceStatusLabel[m.status] ?? m.status, Priorité: m.priority, Équipement: m.equipmentName || '—', Technicien: m.technician || '—', Description: m.failureDesc, 'Ouvert le': m.openedAt ? new Date(m.openedAt).toLocaleDateString('fr-FR') : '—', 'Résolu le': m.closedAt ? new Date(m.closedAt).toLocaleDateString('fr-FR') : '—' })) });
          await ExportHelpers.exportMultiSheetXlsx(sheets, `rapport-maintenance-${Date.now()}.xlsx`);
        };

        const exportMaintenancePdf = () => {
          const doc = new jsPDF({ orientation: 'landscape' });
          doc.setFontSize(16); doc.text('Rapport Maintenance', 14, 16);
          doc.setFontSize(10); doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} · ${all.length} tickets`, 14, 23);
          doc.setFontSize(12); doc.text('Résumé', 14, 32);
          autoTable(doc, {
            startY: 35, head: [['Statut', 'Nombre']], body: byStatus.map(r => [r.label, r.count]),
            theme: 'striped', headStyles: { fillColor: [234, 88, 12] },
          });
          const y1 = (doc as any).lastAutoTable.finalY + 8;
          doc.setFontSize(12); doc.text('Par technicien', 14, y1);
          autoTable(doc, {
            startY: y1 + 3, head: [['Technicien', 'Total', 'Résolus', 'Taux (%)']],
            body: Object.entries(byTech).sort((a,b) => b[1].total - a[1].total).map(([t, d]) => [t, d.total, d.resolved, d.total ? Math.round((d.resolved / d.total) * 100) + '%' : '0%']),
            theme: 'striped', headStyles: { fillColor: [234, 88, 12] },
          });
          const y2 = (doc as any).lastAutoTable.finalY + 8;
          if (y2 < 180) {
            doc.setFontSize(12); doc.text('Top équipements en panne', 14, y2);
            autoTable(doc, { startY: y2 + 3, head: [['Équipement', 'Tickets']], body: Object.entries(byEq).sort((a,b) => b[1] - a[1]).slice(0, 10).map(([eq, cnt]) => [eq, cnt]), theme: 'striped', headStyles: { fillColor: [234, 88, 12] } });
          }
          doc.save(`rapport-maintenance-${Date.now()}.pdf`);
        };

        const exportMaintenanceWord = async () => {
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
            new DocxParagraph({ text: 'Rapport Maintenance', heading: HeadingLevel.HEADING_1 }),
            new DocxParagraph({ children: [new TextRun(`Généré le ${new Date().toLocaleDateString('fr-FR')} · ${all.length} ticket(s)`)] }),
            ...(maintTechFilter.length > 0 ? [new DocxParagraph({ children: [new TextRun({ text: `Technicien(s) : ${maintTechFilter.join(', ')}`, italics: true })] })] : []),
            new DocxParagraph({ text: '' }),
            new DocxParagraph({ text: 'Résumé par statut', heading: HeadingLevel.HEADING_2 }),
            new DocxTable({ rows: [makeHdr(['Statut','Nombre']), ...byStatus.map(r => makeRow([r.label, String(r.count)]))] }),
            new DocxParagraph({ text: '' }),
            new DocxParagraph({ text: 'Par technicien', heading: HeadingLevel.HEADING_2 }),
            new DocxTable({ rows: [makeHdr(['Technicien','Total','Résolus','Taux (%)']), ...Object.entries(byTech).sort((a,b) => b[1].total - a[1].total).map(([t, d]) => makeRow([t, String(d.total), String(d.resolved), (d.total ? Math.round((d.resolved / d.total) * 100) : 0) + '%']))] }),
            new DocxParagraph({ text: '' }),
            new DocxParagraph({ text: 'Top équipements en panne', heading: HeadingLevel.HEADING_2 }),
            new DocxTable({ rows: [makeHdr(['Équipement','Tickets']), ...Object.entries(byEq).sort((a,b) => b[1]-a[1]).slice(0,10).map(([eq,cnt]) => makeRow([eq, String(cnt)]))] }),
            new DocxParagraph({ text: '' }),
            new DocxParagraph({ text: 'Tous les tickets', heading: HeadingLevel.HEADING_2 }),
            new DocxTable({ rows: [makeHdr(['#','Statut','Priorité','Équipement','Technicien','Description']), ...all.map(m => makeRow([String(m.id), maintenanceStatusLabel[m.status] ?? m.status, m.priority, m.equipmentName || '—', m.technician || '—', m.failureDesc || '—']))] }),
          ];
          const doc = new DocxDocument({ sections: [{ children }] });
          const blob = await Packer.toBlob(doc);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = `rapport-maintenance-${Date.now()}.docx`; a.click();
          URL.revokeObjectURL(url);
        };

        return (
          <div className="flex-1 overflow-auto px-6 pb-6 pt-4 space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4 bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide shrink-0">Filtrer par technicien :</span>
                {allTechs.map(tech => (
                  <button key={tech} onClick={() => setMaintTechFilter(f => f.includes(tech) ? f.filter(t => t !== tech) : [...f, tech])}
                    className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${maintTechFilter.includes(tech) ? 'bg-orange-500 text-white border-orange-500 shadow-sm' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-orange-300 hover:text-orange-600'}`}>
                    {tech}
                  </button>
                ))}
                {maintTechFilter.length > 0 && (
                  <button onClick={() => setMaintTechFilter([])} className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded-full hover:bg-gray-100 transition-colors">
                    ✕ Effacer
                  </button>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={exportMaintenanceExcel}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 shadow-sm">
                  <Download className="w-4 h-4 text-green-600" /> Excel
                </button>
                <button onClick={exportMaintenancePdf}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 shadow-sm">
                  <Download className="w-4 h-4 text-red-500" /> PDF
                </button>
                <button onClick={exportMaintenanceWord}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 hover:bg-blue-100 shadow-sm">
                  <Download className="w-4 h-4 text-blue-600" /> Word
                </button>
              </div>
            </div>
            {maintTechFilter.length > 0 && (
              <p className="text-xs text-orange-600 font-medium bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
                Rapport filtré — {all.length} ticket(s) pour : {maintTechFilter.join(', ')}
              </p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total tickets', value: all.length, color: 'text-gray-800' },
                { label: 'Actifs', value: all.filter(m => m.status !== 'résolu').length, color: 'text-red-600' },
                { label: 'Résolus', value: resolved.length, color: 'text-green-600' },
                { label: 'Délai moyen résolution', value: avgH > 0 ? `${avgH}h` : '—', color: 'text-[#1a6fa6]' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                  <div className={`text-2xl font-bold ${color}`}>{value}</div>
                  <div className="text-xs text-gray-500 mt-1">{label}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <h3 className="font-semibold text-gray-700 mb-4">Répartition par statut</h3>
                {all.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">Aucune donnée</p> : (() => {
                  const statusColors = ['#6366f1','#ef4444','#f59e0b','#22c55e'];
                  const r = 52; const cx = 70; const cy = 70; const stroke = 18;
                  let cumul = 0;
                  const total = byStatus.reduce((s,b) => s + b.count, 0) || 1;
                  const circumference = 2 * Math.PI * r;
                  return (
                    <div className="flex items-center gap-4">
                      <svg width="140" height="140" viewBox="0 0 140 140">
                        {byStatus.map(({ count }, i) => {
                          const pct = count / total;
                          const offset = circumference * (1 - cumul);
                          const dashArr = `${circumference * pct} ${circumference * (1 - pct)}`;
                          cumul += pct;
                          return count > 0 ? <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={statusColors[i]} strokeWidth={stroke} strokeDasharray={dashArr} strokeDashoffset={offset} style={{transition:'all 0.5s'}} transform={`rotate(-90 ${cx} ${cy})`} /> : null;
                        })}
                        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" className="text-xl font-bold" fontSize="22" fontWeight="bold" fill="#1f2937">{all.length}</text>
                        <text x={cx} y={cy+16} textAnchor="middle" fontSize="10" fill="#9ca3af">tickets</text>
                      </svg>
                      <div className="space-y-2 flex-1">
                        {byStatus.map(({ label, style, count }, i) => (
                          <div key={label} className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{background: statusColors[i]}} />
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${style}`}>{label}</span>
                            <span className="text-sm font-bold text-gray-700 ml-auto">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <h3 className="font-semibold text-gray-700 mb-4">Par priorité</h3>
                <div className="space-y-3">
                  {Object.entries(byPriority).sort((a, b) => b[1] - a[1]).map(([prio, cnt]) => {
                    const pct = all.length ? (cnt / all.length) * 100 : 0;
                    return (
                      <div key={prio}>
                        <div className="flex justify-between mb-1">
                          <span className="text-xs text-gray-600 capitalize font-medium">{prio}</span>
                          <span className="text-xs font-bold text-gray-700">{cnt} <span className="text-gray-400 font-normal">({Math.round(pct)}%)</span></span>
                        </div>
                        <div className="bg-gray-100 rounded-full h-3 overflow-hidden">
                          <div className={`h-3 rounded-full transition-all ${prioColors[prio] ?? 'bg-gray-400'}`} style={{width:`${pct}%`}} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <h3 className="font-semibold text-gray-700 mb-3">Par technicien</h3>
                <table className="w-full text-sm">
                  <thead><tr className="text-xs text-gray-400 border-b">
                    <th className="pb-2 text-left">Technicien</th>
                    <th className="pb-2 text-right">Total</th>
                    <th className="pb-2 text-right">Résolus</th>
                    <th className="pb-2 text-right">Taux</th>
                  </tr></thead>
                  <tbody>
                    {Object.entries(byTech).sort((a, b) => b[1].total - a[1].total).map(([tech, d]) => (
                      <tr key={tech} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-1.5 font-medium text-gray-800">{tech}</td>
                        <td className="py-1.5 text-right text-gray-500">{d.total}</td>
                        <td className="py-1.5 text-right text-green-600 font-medium">{d.resolved}</td>
                        <td className="py-1.5 text-right text-[#1a6fa6] font-medium">{d.total ? Math.round((d.resolved / d.total) * 100) : 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <h3 className="font-semibold text-gray-700 mb-3">Top équipements en panne</h3>
                <div className="space-y-2">
                  {Object.entries(byEq).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([eq, cnt]) => {
                    const max = Math.max(...Object.values(byEq), 1);
                    return (
                      <div key={eq} className="flex items-center gap-2">
                        <span className="text-xs text-gray-600 truncate flex-1">{eq}</span>
                        <div className="w-24 bg-gray-100 rounded-full h-1.5 shrink-0">
                          <div className="h-1.5 rounded-full bg-orange-400" style={{ width: `${(cnt / max) * 100}%` }} />
                        </div>
                        <span className="text-xs font-bold text-gray-700 w-4 text-right">{cnt}</span>
                      </div>
                    );
                  })}
                  {Object.keys(byEq).length === 0 && <p className="text-sm text-gray-400">Aucun équipement lié</p>}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Kanban ── */}
      {showKanban && !showMaintenanceReport && (
        <div className="flex-1 overflow-x-auto px-6 py-4">
          <div className="flex gap-4 h-full" style={{minWidth:'max-content'}}>
            {(['en_attente','ouvert','en_cours','résolu'] as const).map(st => {
              const cols = { en_attente:{label:'En attente',dot:'bg-blue-500',hdr:'bg-blue-50 border-blue-200'}, ouvert:{label:'Ouvert',dot:'bg-red-500',hdr:'bg-red-50 border-red-200'}, en_cours:{label:'En cours',dot:'bg-yellow-500',hdr:'bg-yellow-50 border-yellow-200'}, résolu:{label:'Résolu',dot:'bg-green-500',hdr:'bg-green-50 border-green-200'} };
              const prioStyle: Record<string,string> = { critique:'bg-red-100 text-red-700', haute:'bg-orange-100 text-orange-700', normale:'bg-blue-100 text-blue-700', basse:'bg-gray-100 text-gray-600' };
              const statusLabels: Record<string,string> = { en_attente:'Attente', ouvert:'Ouvert', en_cours:'En cours', résolu:'Résolu' };
              const records = maintenanceRecords.filter(m => m.status === st);
              const col = cols[st];
              return (
                <div key={st} className="w-72 shrink-0 flex flex-col">
                  <div className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-xl border ${col.hdr}`}>
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${col.dot}`} />
                    <span className="font-semibold text-gray-700 text-sm">{col.label}</span>
                    <span className="ml-auto text-xs bg-white border border-gray-200 text-gray-600 rounded-full px-2 py-0.5 font-bold">{records.length}</span>
                  </div>
                  <div className="space-y-2 overflow-y-auto" style={{maxHeight:'calc(100vh - 300px)'}}>
                    {records.length === 0 && <div className="border-2 border-dashed border-gray-200 rounded-xl p-5 text-center text-xs text-gray-400">Aucun ticket</div>}
                    {records.map(m => (
                      <div key={m.id} className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm cursor-pointer hover:shadow-md hover:border-orange-300 transition-all"
                        onClick={() => { setSelectedMaintenance(m); setShowMaintenanceForm(false); }}>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${prioStyle[m.priority] ?? 'bg-gray-100 text-gray-600'}`}>{m.priority}</span>
                          <span className="text-xs text-gray-400 font-mono">#{m.id}</span>
                        </div>
                        <p className="text-sm font-semibold text-gray-800 mb-1 line-clamp-2">{m.failureDesc || '—'}</p>
                        {m.equipmentName && <p className="text-xs text-[#1a6fa6] font-medium truncate">{m.equipmentName}</p>}
                        {m.technician && (
                          <div className="flex items-center gap-1.5 mt-2">
                            <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">{m.technician.charAt(0).toUpperCase()}</div>
                            <span className="text-xs text-gray-500 truncate">{m.technician}</span>
                          </div>
                        )}
                        <div className="flex gap-1 mt-2 pt-2 border-t border-gray-50 flex-wrap">
                          {(['en_attente','ouvert','en_cours','résolu'] as const).filter(s => s !== st).map(s => (
                            <button key={s} onClick={e => { e.stopPropagation(); handleStatusChange(m.id, s); }}
                              className="flex-1 text-xs py-1 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors text-center min-w-0 truncate">
                              → {statusLabels[s]}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Body (List + Detail + Form) */}
      {!showMaintenanceReport && !showKanban && (
        <div className="flex flex-1 overflow-hidden">
          <div className={`${selectedMaintenance || showMaintenanceForm ? 'w-2/5 border-r' : 'w-full'} overflow-y-auto`}>
            {loading ? (
              <div className="text-center py-12 text-gray-400"><div className="skeleton h-4 w-48 mx-auto" /><div className="skeleton h-3 w-32 mx-auto mt-2" /></div>
            ) : assistanceViewRecords.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Headset className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">{showAssistanceFilter ? 'Aucune demande d\'assistance' : 'Aucun ticket de maintenance'}</p>
                <p className="text-sm mt-1">{showAssistanceFilter ? 'Les demandes d\'assistance apparaîtront ici.' : 'Cliquez sur "Nouveau ticket" pour en créer un.'}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {pagedMaintenance.map((ticket) => (
                  <div key={ticket.id} onClick={() => { setSelectedMaintenance(ticket); setShowMaintenanceForm(false); setShowNoteForm(false); setNoteText(''); }}
                    className={`relative p-4 cursor-pointer hover:bg-gray-50 transition group ${selectedMaintenance?.id === ticket.id ? 'bg-orange-50' : ''}`}>
                    <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full transition-all ${selectedMaintenance?.id === ticket.id ? 'bg-gradient-to-b from-orange-400 to-orange-600' : 'bg-transparent group-hover:bg-gray-300'}`} />
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${maintenanceStatusStyle[ticket.status]}`}>
                          {maintenanceStatusLabel[ticket.status] ?? ticket.status}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${maintenancePriorityStyle[ticket.priority]}`}>
                          {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">#{ticket.id}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-800 line-clamp-2">{ticket.failureDesc}</p>
                    {ticket.equipmentName && <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><Monitor className="w-3 h-3" />{ticket.equipmentName}</p>}
                    {ticket.visitId && <p className="text-xs text-blue-600 mt-1 flex items-center gap-1"><Clock className="w-3 h-3" />Lié à une visite{ticket.siteName ? ` — ${ticket.siteName}` : ''}</p>}
                    <p className="text-xs text-gray-400 mt-1">{fmtDate(ticket.openedAt)} · {ticket.openedBy}</p>
                  </div>
                ))}
                <Pagination total={assistanceViewRecords.length} page={maintenancePage} onChange={setMaintenancePage} />
              </div>
            )}
          </div>

          {/* Detail panel */}
          {selectedMaintenance && !showMaintenanceForm && (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${maintenanceStatusStyle[selectedMaintenance.status]}`}>
                      {maintenanceStatusLabel[selectedMaintenance.status] ?? selectedMaintenance.status}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${maintenancePriorityStyle[selectedMaintenance.priority]}`}>
                      {selectedMaintenance.priority}
                    </span>
                    <span className="text-xs text-gray-400">Ticket #{selectedMaintenance.id}</span>
                  </div>
                  {selectedMaintenance.equipmentName && (
                    <p className="text-sm text-gray-500 flex items-center gap-1"><Monitor className="w-3.5 h-3.5" />{selectedMaintenance.equipmentName} · {selectedMaintenance.department}</p>
                  )}
                  {selectedMaintenance.visitId && (
                    <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Ticket lié à une visite planifiée{selectedMaintenance.siteName ? ` — ${selectedMaintenance.siteName}` : ''}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {selectedMaintenance.status === 'résolu' && (
                    <span className="text-xs px-3 py-1.5 rounded-lg bg-green-50 border border-green-200 text-green-700 flex items-center gap-1 font-medium">
                      <CheckCircle className="w-3.5 h-3.5" /> Résolu — lecture seule
                    </span>
                  )}
                  {canWrite && selectedMaintenance.status !== 'résolu' && (
                    <button onClick={() => { setMaintForm({ equipmentId: selectedMaintenance.equipmentId, failureDesc: selectedMaintenance.failureDesc, diagnosis: selectedMaintenance.diagnosis, solution: selectedMaintenance.solution, partsReplaced: selectedMaintenance.partsReplaced, technician: selectedMaintenance.technician, priority: selectedMaintenance.priority, status: selectedMaintenance.status, requestType: selectedMaintenance.requestType }); setMaintenanceEditId(selectedMaintenance.id); setShowMaintenanceForm(true); }}
                      className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center gap-1 transition-colors">
                      <Edit className="w-3.5 h-3.5" /> Modifier
                    </button>
                  )}
                  {selectedMaintenance.status !== 'résolu' && (
                    <button onClick={() => { setShowNoteForm(v => !v); setNoteText(''); }}
                      className="text-xs px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#1a6fa6] to-blue-700 text-white hover:from-[#155a8a] hover:to-[#0d4a73] flex items-center gap-1 shadow-sm transition-all">
                      <Edit className="w-3.5 h-3.5" /> Note
                    </button>
                  )}
                  {canModify && selectedMaintenance.status !== 'résolu' && (
                    <button onClick={() => handleDeleteMaintenance(selectedMaintenance.id)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-1 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" /> Supprimer
                    </button>
                  )}
                </div>
              </div>

              {/* Timeline */}
              <div className="space-y-4">
                <Section icon={<AlertTriangle className="w-4 h-4 text-red-500" />} title="Description de la panne" color="red">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedMaintenance.failureDesc || <em className="text-gray-400">Non renseigné</em>}</p>
                  <p className="text-xs text-gray-400 mt-2">Signalé le {fmtDate(selectedMaintenance.openedAt)} par {selectedMaintenance.openedBy}</p>
                </Section>

                <Section icon={<Search className="w-4 h-4 text-yellow-500" />} title="Diagnostic" color="yellow">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedMaintenance.diagnosis || <em className="text-gray-400">Diagnostic en attente</em>}</p>
                  {selectedMaintenance.startedAt && <p className="text-xs text-gray-400 mt-2">Débuté le {fmtDate(selectedMaintenance.startedAt)}</p>}
                </Section>

                <Section icon={<CircleCheck className="w-4 h-4 text-green-500" />} title="Solution / Réparation" color="green">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedMaintenance.solution || <em className="text-gray-400">Réparation en attente</em>}</p>
                  {selectedMaintenance.partsReplaced && <p className="text-xs text-gray-500 mt-1">🔧 Pièces remplacées : {selectedMaintenance.partsReplaced}</p>}
                  {selectedMaintenance.technician && <p className="text-xs text-gray-500 mt-1">👷 Technicien : {selectedMaintenance.technician}</p>}
                  {selectedMaintenance.closedAt && <p className="text-xs text-gray-400 mt-2">Résolu le {fmtDate(selectedMaintenance.closedAt)}</p>}
                </Section>

                {/* Notes */}
                {(selectedMaintenance.notes || showNoteForm) && (
                  <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-blue-50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-sm"><Edit className="w-3 h-3" /></div>
                      <span className="text-sm font-semibold text-gray-700">Informations complémentaires</span>
                    </div>
                    {selectedMaintenance.notes && (
                      <div className="space-y-3 mb-3">
                        {selectedMaintenance.notes.split('\n\n---\n\n').map((entry, i) => (
                          <div key={i} className="bg-white rounded-lg border border-blue-100 p-3 text-sm text-gray-700 whitespace-pre-wrap">{entry}</div>
                        ))}
                      </div>
                    )}
                    {showNoteForm && (
                      <div className="space-y-2">
                        <textarea
                          value={noteText}
                          onChange={e => setNoteText(e.target.value)}
                          rows={3}
                          placeholder="Saisir une nouvelle information…"
                          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            disabled={noteLoading || !noteText.trim()}
                            onClick={handleAddNote}
                            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#1a6fa6] to-blue-700 text-white text-sm font-semibold hover:from-[#155a8a] hover:to-[#0d4a73] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
                          >
                            {noteLoading ? 'Enregistrement…' : 'Enregistrer'}
                          </button>
                          <button onClick={() => { setShowNoteForm(false); setNoteText(''); }}
                            className="px-4 py-1.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                            Annuler
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Assistance actions */}
              {selectedMaintenance.requestType === 'assistance' && (
                <div className="mt-4 pt-4 border-t space-y-3">
                  {selectedMaintenance.status !== 'résolu' && !selectedMaintenance.assignedTechId && (
                    <button onClick={() => handleAssign(selectedMaintenance.id)}
                      className="w-full py-2 rounded-xl bg-gradient-to-r from-[#1a6fa6] to-blue-700 text-white text-sm font-semibold hover:from-[#155a8a] hover:to-[#0d4a73] shadow-sm transition-all">
                      Prendre en charge
                    </button>
                  )}
                  {selectedMaintenance.status !== 'résolu' && selectedMaintenance.assignedTechId && !selectedMaintenance.userConfirmed && !selectedMaintenance.techConfirmed && (
                    <div className="text-sm text-gray-600 text-center">En attente de résolution…</div>
                  )}
                  {selectedMaintenance.status !== 'résolu' && selectedMaintenance.assignedTechId && !selectedMaintenance.techConfirmed && (
                    <button onClick={() => handleConfirmTech(selectedMaintenance.id)}
                      className="w-full py-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white text-sm font-semibold hover:from-green-700 hover:to-emerald-700 shadow-sm transition-all">
                      Confirmer la résolution (technicien)
                    </button>
                  )}
                  {selectedMaintenance.status !== 'résolu' && selectedMaintenance.assignedTechId && !selectedMaintenance.userConfirmed && selectedMaintenance.techConfirmed && (
                    <div className="text-sm text-gray-600 text-center">En attente de confirmation de l'utilisateur</div>
                  )}
                  {selectedMaintenance.status !== 'résolu' && !selectedMaintenance.userConfirmed && !selectedMaintenance.techConfirmed && (
                    <button onClick={() => handleConfirmUser(selectedMaintenance.id)}
                      className="w-full py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-semibold hover:from-blue-700 hover:to-indigo-700 shadow-sm transition-all">
                      Confirmer la résolution (utilisateur)
                    </button>
                  )}
                  {selectedMaintenance.userConfirmed && selectedMaintenance.techConfirmed && !selectedMaintenance.rating && (
                    <button onClick={() => setShowRatingModal(true)}
                      className="w-full py-2 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-sm font-semibold hover:from-yellow-600 hover:to-orange-600 shadow-sm transition-all">
                      Noter le technicien
                    </button>
                  )}
                  {selectedMaintenance.rating && (
                    <div className="text-sm text-gray-700 text-center">
                      Note : {'★'.repeat(selectedMaintenance.rating)}{'☆'.repeat(5 - selectedMaintenance.rating)}
                      {selectedMaintenance.reviewComment && <p className="text-xs text-gray-500 mt-1">"{selectedMaintenance.reviewComment}"</p>}
                    </div>
                  )}
                </div>
              )}

              {/* Quick status change */}
              {canWrite && selectedMaintenance.status !== 'résolu' && (
                <div className="mt-4 pt-4 border-t flex gap-2">
                  {selectedMaintenance.status === 'ouvert' && (
                    <button onClick={() => handleStatusChange(selectedMaintenance.id, 'en_cours')}
                      className="flex-1 py-2 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-sm font-semibold hover:from-yellow-600 hover:to-orange-600 shadow-sm transition-all">
                      Démarrer la réparation
                    </button>
                  )}
                  <button onClick={() => { setMaintForm({ equipmentId: selectedMaintenance.equipmentId, failureDesc: selectedMaintenance.failureDesc, diagnosis: selectedMaintenance.diagnosis, solution: selectedMaintenance.solution, partsReplaced: selectedMaintenance.partsReplaced, technician: selectedMaintenance.technician, priority: selectedMaintenance.priority, status: 'résolu', requestType: selectedMaintenance.requestType }); setMaintenanceEditId(selectedMaintenance.id); setShowMaintenanceForm(true); }}
                    className="flex-1 py-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white text-sm font-semibold hover:from-green-700 hover:to-emerald-700 shadow-sm transition-all">
                    Marquer comme résolu
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Form panel */}
          {showMaintenanceForm && (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white shadow-sm shrink-0">
                  <Wrench className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-800">{maintenanceEditId ? 'Modifier le ticket' : maintenanceForm.requestType === 'assistance' ? 'Nouvelle demande d\'assistance' : 'Nouveau ticket de maintenance'}</h3>
                  <p className="text-xs text-gray-400">{maintenanceEditId ? 'Modifier les informations du ticket' : 'Remplir les informations ci-dessous'}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-3.5">
                  {!maintenanceEditId && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Équipement concerné</label>
                      <select value={maintenanceForm.equipmentId ?? ''} onChange={e => setMaintForm(f => ({ ...f, equipmentId: e.target.value ? Number(e.target.value) : null }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none">
                        <option value="">— Sélectionner un équipement —</option>
                        {equipments.map(eq => <option key={eq.id} value={eq.id}>{eq.name} ({eq.location})</option>)}
                      </select>
                    </div>
                  )}
                  {maintenanceForm.requestType !== 'assistance' && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Priorité</label>
                      <select value={maintenanceForm.priority} onChange={e => setMaintForm(f => ({ ...f, priority: e.target.value as MaintenancePriority }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none">
                        <option value="faible">Faible</option>
                        <option value="normale">Normale</option>
                        <option value="haute">Haute</option>
                        <option value="critique">Critique</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Description <span className="text-red-500">*</span></label>
                    <textarea rows={3} value={maintenanceForm.failureDesc} onChange={e => setMaintForm(f => ({ ...f, failureDesc: e.target.value }))}
                      placeholder={maintenanceForm.requestType === 'assistance' ? 'Décrivez votre besoin…' : 'Décrivez le problème observé…'}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none resize-none" />
                  </div>
                  {maintenanceForm.requestType !== 'assistance' && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Diagnostic</label>
                        <textarea rows={3} value={maintenanceForm.diagnosis} onChange={e => setMaintForm(f => ({ ...f, diagnosis: e.target.value }))}
                          placeholder="Cause identifiée du problème…" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none resize-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Solution / Réparation effectuée</label>
                        <textarea rows={3} value={maintenanceForm.solution} onChange={e => setMaintForm(f => ({ ...f, solution: e.target.value }))}
                          placeholder="Actions effectuées pour résoudre le problème…" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none resize-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Pièces remplacées</label>
                        <input type="text" value={maintenanceForm.partsReplaced} onChange={e => setMaintForm(f => ({ ...f, partsReplaced: e.target.value }))}
                          placeholder="Ex: Disque dur, Alimentation, RAM…" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Agent responsable</label>
                        <input type="text" value={maintenanceForm.technician} onChange={e => setMaintForm(f => ({ ...f, technician: e.target.value }))}
                          placeholder="Nom du technicien" className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none" />
                      </div>
                    </>
                  )}
                  {maintenanceEditId && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Statut</label>
                      <select value={maintenanceForm.status} onChange={e => setMaintForm(f => ({ ...f, status: e.target.value as MaintenanceStatus }))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#1a6fa6] focus:border-transparent outline-none">
                        <option value="en_attente">En attente</option>
                        <option value="ouvert">Ouvert</option>
                        <option value="en_cours">En cours</option>
                        <option value="résolu">Résolu</option>
                      </select>
                    </div>
                  )}
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => { setShowMaintenanceForm(false); setMaintenanceEditId(null); }}
                      className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">Annuler</button>
                    <button onClick={handleSaveMaintenance}
                      className="flex-1 py-2.5 bg-gradient-to-r from-[#1a6fa6] to-blue-700 text-white rounded-xl text-sm font-semibold hover:from-[#155a8a] hover:to-[#0d4a73] shadow-sm transition-all">
                      {maintenanceEditId ? 'Enregistrer' : maintenanceForm.requestType === 'assistance' ? 'Envoyer la demande' : 'Créer le ticket'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Rating modal ── */}
      {showRatingModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowRatingModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Noter le technicien</h3>
              <button onClick={() => setShowRatingModal(false)} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex justify-center gap-1 mb-4">
              {[1,2,3,4,5].map(v => (
                <button key={v} onClick={() => setRatingValue(v)}
                  className={`w-10 h-10 rounded-full text-2xl transition-colors ${v <= ratingValue ? 'text-yellow-400' : 'text-gray-200'}`}>
                  ★
                </button>
              ))}
            </div>
            <textarea
              value={reviewComment}
              onChange={e => setReviewComment(e.target.value)}
              placeholder="Commentaire (optionnel)"
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm mb-4 resize-none"
            />
            <button onClick={async () => {
              if (!selectedMaintenance) return;
              await apiFetch(`/api/maintenance/${selectedMaintenance.id}/rate`, {
                method: 'PATCH', body: JSON.stringify({ rating: ratingValue, reviewComment }),
              });
              onRefresh();
              setShowRatingModal(false);
              setRatingValue(5);
              setReviewComment('');
            }}
              className="w-full py-2.5 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-xl font-semibold hover:from-yellow-600 hover:to-orange-600 shadow-sm transition-all">
              Envoyer la note
            </button>
          </div>
        </div>
      )}

      {/* ── Trash modal ── */}
      {showMaintenanceTrash && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowMaintenanceTrash(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">Corbeille — Maintenance</h3>
              <button onClick={() => setShowMaintenanceTrash(false)} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {maintenanceTrashLoading ? (
                <div className="text-center py-8 text-gray-400"><div className="skeleton h-4 w-48 mx-auto" /></div>
              ) : deletedMaintenanceRecords.length === 0 ? (
                <p className="text-center py-8 text-gray-400">Corbeille vide.</p>
              ) : (
                <div className="space-y-2">
                  {deletedMaintenanceRecords.map(m => (
                    <div key={m.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-800">#{m.id} — {m.failureDesc || '—'}</p>
                        <p className="text-xs text-gray-400">{m.equipmentName || '—'} · {m.technician || 'Non assigné'}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => restoreMaintenance(m.id)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-green-200 text-green-600 hover:bg-green-50 transition-colors">Restaurer</button>
                        <button onClick={() => hardDeleteMaintenance(m.id)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors">Supprimer</button>
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
