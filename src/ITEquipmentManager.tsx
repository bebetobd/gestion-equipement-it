import React, { useEffect, useRef, useState } from 'react';
import {
  Plus, Search, Edit, Trash2, Monitor, Wifi, Server, Printer,
  User, Users, Calendar, MapPin, AlertTriangle, CheckCircle,
  XCircle, Info, Clock, ShieldCheck, Download, ChevronDown,
  RefreshCcw, LogOut, Activity, ArrowRightLeft, FileText, Upload, File,
  Wrench, CircleCheck, Archive, Globe, Building2, ClipboardList, Filter
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AuthUser {
  id: number;
  username: string;
  name: string;
  role: string;
  permissions: string[];
  allowedSiteIds?: number[];
}

type Permission = 'lecture' | 'ecriture' | 'modification';

const PERMISSION_CONFIG: { value: Permission; label: string; desc: string; color: string }[] = [
  { value: 'lecture',      label: 'Lecture',       desc: 'Consulter la liste des équipements',      color: 'blue'   },
  { value: 'ecriture',     label: 'Écriture',      desc: 'Ajouter de nouveaux équipements',          color: 'green'  },
  { value: 'modification', label: 'Modification',  desc: 'Modifier et supprimer des équipements',    color: 'orange' }
];

interface ITEquipmentManagerProps {
  currentUser: AuthUser;
  onLogout: () => void;
}

type EquipmentType = 'ordinateur' | 'reseau' | 'serveur' | 'imprimante';
type EquipmentStatus = 'actif' | 'inactif' | 'maintenance' | 'defaillant' | 'réformé';

interface Equipment {
  id: number;
  name: string;
  type: EquipmentType;
  brand: string;
  model: string;
  serialNumber: string;
  ipAddress: string;
  location: string;
  department: string;
  status: EquipmentStatus;
  purchaseDate: string;
  warranty: string;
  lastMaintenance: string;
  visited: boolean;
  technicianName: string;
  visitDate: string;
  interventionDetails: string;
  replacedById?: number | null;
  siteId?: number | null;
  quantity: number;
}

interface EquipmentFormData extends Omit<Equipment, 'id'> {}

interface EquipmentDoc {
  id: number;
  equipmentId: number;
  filename: string;
  fileType: string;
  fileSize: number;
  description: string;
  uploadedBy: string;
  uploadedAt: string;
}

interface TransferForm {
  toLocation: string;
  toDepartment: string;
  toSiteId: number | null;
  reason: string;
  technicianName: string;
  notes: string;
  transferQty: number;
}

type MaintenanceStatus = 'ouvert' | 'en_cours' | 'résolu';
type MaintenancePriority = 'faible' | 'normale' | 'haute' | 'critique';

interface MaintenanceRecord {
  id: number;
  equipmentId: number | null;
  equipmentName: string;
  equipmentType: string;
  department: string;
  failureDesc: string;
  diagnosis: string;
  solution: string;
  partsReplaced: string;
  technician: string;
  openedBy: string;
  openedAt: string;
  startedAt: string | null;
  closedAt: string | null;
  status: MaintenanceStatus;
  priority: MaintenancePriority;
  notes: string;
}

interface Site {
  id: number;
  name: string;
  city: string;
  country: string;
  address: string;
  description: string;
  createdAt: string;
  equipmentCount: number;
}

interface SiteForm {
  name: string;
  city: string;
  country: string;
  address: string;
  description: string;
}

interface ReformForm {
  reason: string;
  replacedById: number | null;
  notes: string;
  reformQty: number;
}

interface MaintenanceForm {
  equipmentId: number | null;
  failureDesc: string;
  diagnosis: string;
  solution: string;
  partsReplaced: string;
  technician: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
}

const defaultFormData: EquipmentFormData = {
  name: '',
  type: 'ordinateur',
  brand: '',
  model: '',
  serialNumber: '',
  ipAddress: '',
  location: '',
  department: '',
  status: 'actif',
  purchaseDate: '',
  warranty: '',
  lastMaintenance: '',
  visited: false,
  technicianName: '',
  visitDate: '',
  interventionDetails: '',
  siteId: null,
  quantity: 1,
};

const equipmentTypes = [
  { value: 'ordinateur' as EquipmentType, label: 'Ordinateur', icon: Monitor },
  { value: 'reseau' as EquipmentType, label: 'Équipement Réseau', icon: Wifi },
  { value: 'serveur' as EquipmentType, label: 'Serveur', icon: Server },
  { value: 'imprimante' as EquipmentType, label: 'Imprimante', icon: Printer }
];

const roleDisplay: Record<string, { label: string; classes: string }> = {
  admin: { label: 'Administrateur', classes: 'bg-red-100 text-red-700' },
  technicien: { label: 'Technicien', classes: 'bg-blue-100 text-blue-700' },
  user: { label: 'Utilisateur', classes: 'bg-gray-100 text-gray-700' }
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? '';

const API_BASE = `${API_BASE_URL}/api/equipments`;
const API_USERS = `${API_BASE_URL}/api/users`;
const EXPORT_URL = `${API_BASE_URL}/api/equipments/export`;

const statusColors: Record<EquipmentStatus, string> = {
  actif: 'bg-green-100 text-green-800',
  inactif: 'bg-gray-100 text-gray-800',
  maintenance: 'bg-yellow-100 text-yellow-800',
  defaillant: 'bg-red-100 text-red-800',
  réformé: 'bg-purple-100 text-purple-800',
};

const sampleEquipments: Equipment[] = [
  {
    id: 1,
    name: 'PC-Bureau-001',
    type: 'ordinateur',
    brand: 'Dell',
    model: 'OptiPlex 7090',
    serialNumber: 'DL7090001',
    ipAddress: '192.168.1.101',
    location: 'Bureau 205',
    department: 'Comptabilité',
    status: 'actif',
    purchaseDate: '2023-03-15',
    warranty: '2026-03-15',
    lastMaintenance: '2024-08-15',
    visited: true,
    technicianName: 'Jean Dupont',
    visitDate: '2024-09-15T14:30',
    interventionDetails: 'Mise à jour système et nettoyage complet',
    quantity: 1
  },
  {
    id: 2,
    name: 'Switch-Etage-2',
    type: 'reseau',
    brand: 'Cisco',
    model: 'Catalyst 2960',
    serialNumber: 'CS2960002',
    ipAddress: '192.168.1.10',
    location: 'Local technique Étage 2',
    department: 'Infrastructure',
    status: 'actif',
    purchaseDate: '2022-11-20',
    warranty: '2027-11-20',
    lastMaintenance: '2024-07-10',
    visited: false,
    technicianName: '',
    visitDate: '',
    interventionDetails: '',
    quantity: 1
  },
  {
    id: 3,
    name: 'Imprimante-RH-001',
    type: 'imprimante',
    brand: 'HP',
    model: 'LaserJet Pro 404dn',
    serialNumber: 'HP404001',
    ipAddress: '192.168.1.150',
    location: 'Bureau RH',
    department: 'Ressources Humaines',
    status: 'maintenance',
    purchaseDate: '2023-07-12',
    warranty: '2026-07-12',
    lastMaintenance: '2024-09-01',
    visited: true,
    technicianName: 'Marie Martin',
    visitDate: '2024-09-18T09:15',
    interventionDetails: 'Remplacement toner et maintenance préventive',
    quantity: 1
  }
];

interface UserAccount {
  id: number;
  username: string;
  name: string;
  role: 'admin' | 'technicien' | 'user';
  permissions: string[];
  allowedSiteIds: number[];
}

interface UserFormData {
  username: string;
  name: string;
  role: 'admin' | 'technicien' | 'user';
  password: string;
  permissions: Permission[];
  allowedSiteIds: number[];
}

interface SessionInfo {
  userId: number;
  username: string;
  name: string;
  role: string;
  loginAt: string;
  lastSeen: string;
  ip: string;
}

interface ActivityEntry {
  id: number;
  userId: number;
  username: string;
  name: string;
  action: string;
  details: string;
  timestamp: string;
  ip: string;
}

interface FieldChange {
  field: string;
  from: string | boolean;
  to: string | boolean;
}

interface EquipmentEvent {
  id: number;
  equipmentId: number;
  equipmentName: string;
  equipmentType: string;
  department: string;
  action: string;
  details: string;
  changes: FieldChange[];
  technician: string;
  userId: number;
  username: string;
  userName: string;
  ip: string;
  createdAt: string;
}

interface DeptStat {
  department: string;
  total_events: string;
  equipment_count: string;
  creations: string;
  modifications: string;
  interventions: string;
  suppressions: string;
  last_activity: string;
}

interface UserStat {
  user_name: string;
  username: string;
  total_actions: string;
  creations: string;
  modifications: string;
  interventions: string;
  transferts: string;
  suppressions: string;
  maintenances: string;
  reformes: string;
  equipment_count: string;
  dept_count: string;
  last_action: string;
}

const Section = ({ icon, title, color, children }: { icon: React.ReactNode; title: string; color: 'red' | 'yellow' | 'green' | 'blue'; children: React.ReactNode }) => {
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
};

const ITEquipmentManager = ({ currentUser, onLogout }: ITEquipmentManagerProps) => {
  const isAdmin = currentUser.role === 'admin';
  const roleInfo = roleDisplay[currentUser.role] ?? { label: currentUser.role, classes: 'bg-gray-100 text-gray-700' };
  const canRead   = isAdmin || (currentUser.permissions ?? []).includes('lecture');
  const canWrite  = isAdmin || (currentUser.permissions ?? []).includes('ecriture');
  const canModify = isAdmin || (currentUser.permissions ?? []).includes('modification');
  const userAllowedSiteIds = currentUser.allowedSiteIds ?? [];

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`
  });

  const [equipments, setEquipments] = useState<Equipment[]>(sampleEquipments);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | EquipmentType>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | EquipmentStatus>('all');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [formData, setFormData] = useState<EquipmentFormData>(defaultFormData);
  const [userAccounts, setUserAccounts] = useState<UserAccount[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showUserFormModal, setShowUserFormModal] = useState(false);
  const [userEditingId, setUserEditingId] = useState<number | null>(null);
  const [userFormData, setUserFormData] = useState<UserFormData>({ username: '', name: '', role: 'technicien', password: '', permissions: ['lecture'], allowedSiteIds: [] });
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [accessTarget, setAccessTarget] = useState<UserAccount | null>(null);
  const [accessForm, setAccessForm] = useState<{ role: UserAccount['role']; permissions: Permission[]; allowedSiteIds: number[] }>({ role: 'technicien', permissions: ['lecture'], allowedSiteIds: [] });
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [showModulesMenu, setShowModulesMenu] = useState(false);
  const modulesMenuRef = useRef<HTMLDivElement>(null);
  const [showSiteDropdown, setShowSiteDropdown] = useState(false);
  const siteDropdownRef = useRef<HTMLDivElement>(null);

  // Transfer
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTarget, setTransferTarget] = useState<Equipment | null>(null);
  const [transferForm, setTransferForm] = useState<TransferForm>({ toLocation: '', toDepartment: '', toSiteId: null, reason: 'Réorganisation', technicianName: '', notes: '', transferQty: 1 });
  const [transferLoading, setTransferLoading] = useState(false);

  // Documents
  const [detailsTab, setDetailsTab] = useState<'info' | 'transfers' | 'documents'>('info');
  const [equipmentDocs, setEquipmentDocs] = useState<EquipmentDoc[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [transferHistory, setTransferHistory] = useState<any[]>([]);
  const [transfersLoading, setTransfersLoading] = useState(false);
  const [newEquipDocs, setNewEquipDocs] = useState<{ file: File; description: string }[]>([]);
  const [uploadingDocs, setUploadingDocs] = useState(false);

  // Maintenance
  const [showMaintenanceModule, setShowMaintenanceModule] = useState(false);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [maintenanceFilter, setMaintenanceFilter] = useState<string>('all');
  const [selectedMaintenance, setSelectedMaintenance] = useState<MaintenanceRecord | null>(null);
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [maintenanceEditId, setMaintenanceEditId] = useState<number | null>(null);
  const defaultMaintenanceForm: MaintenanceForm = { equipmentId: null, failureDesc: '', diagnosis: '', solution: '', partsReplaced: '', technician: '', priority: 'normale', status: 'ouvert' };
  const [maintenanceForm, setMaintForm] = useState<MaintenanceForm>(defaultMaintenanceForm);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);

  // Sites
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [showSiteModal, setShowSiteModal] = useState(false);
  const defaultSiteForm: SiteForm = { name: '', city: '', country: '', address: '', description: '' };
  const [siteForm, setSiteForm] = useState<SiteForm>(defaultSiteForm);
  const [editingSiteId, setEditingSiteId] = useState<number | null>(null);
  const [siteLoading, setSiteLoading] = useState(false);

  // Transfer module
  const [showTransferModule, setShowTransferModule] = useState(false);
  const [allTransfers, setAllTransfers] = useState<any[]>([]);
  const [transferModuleLoading, setTransferModuleLoading] = useState(false);
  const [transferModuleFilter, setTransferModuleFilter] = useState({ department: '', from: '', to: '' });

  // Reform
  const [showReformModal, setShowReformModal] = useState(false);
  const [reformTarget, setReformTarget] = useState<Equipment | null>(null);
  const [reformForm, setReformForm] = useState<ReformForm>({ reason: '', replacedById: null, notes: '', reformQty: 1 });
  const [reformLoading, setReformLoading] = useState(false);

  // Activity log
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [activityEntries, setActivityEntries] = useState<any[]>([]);
  const [activityLogLoading, setActivityLogLoading] = useState(false);
  const [activityFilter, setActivityFilter] = useState({ username: '', dateFrom: '', dateTo: '', action: '' });

  // Monitoring
  const [showMonitoringModal, setShowMonitoringModal] = useState(false);
  const [monitoringTab, setMonitoringTab] = useState<'sessions' | 'activities'>('sessions');
  const [activeSessions, setActiveSessions] = useState<SessionInfo[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityEntry[]>([]);
  const [activityUserFilter, setActivityUserFilter] = useState<number | null>(null);
  const [monitoringLoading, setMonitoringLoading] = useState(false);
  const activityUserFilterRef = useRef<number | null>(null);

  // ── Reports state ──────────────────────────────────────────────────────────
  const [showReportsModal, setShowReportsModal] = useState(false);
  const [reportsTab, setReportsTab] = useState<'equipment' | 'date' | 'department' | 'user'>('equipment');
  const [reportEquipmentId, setReportEquipmentId] = useState<number | ''>('');
  const [reportHistory, setReportHistory] = useState<EquipmentEvent[]>([]);
  const [reportHistoryLoading, setReportHistoryLoading] = useState(false);
  const [reportDateFrom, setReportDateFrom] = useState('');
  const [reportDateTo, setReportDateTo] = useState('');
  const [reportDeptFilter, setReportDeptFilter] = useState('');
  const [reportTypeFilter, setReportTypeFilter] = useState('');
  const [reportDateEvents, setReportDateEvents] = useState<EquipmentEvent[]>([]);
  const [reportDateLoading, setReportDateLoading] = useState(false);
  const [reportDeptStats, setReportDeptStats] = useState<DeptStat[]>([]);
  const [reportDeptLoading, setReportDeptLoading] = useState(false);
  const [reportUserStats, setReportUserStats] = useState<UserStat[]>([]);
  const [reportUserLoading, setReportUserLoading] = useState(false);
  const [reportUserFrom, setReportUserFrom] = useState('');
  const [reportUserTo, setReportUserTo] = useState('');
  const [reportUserDeptFilter, setReportUserDeptFilter] = useState('');
  const [reportUserExpanded, setReportUserExpanded] = useState<string | null>(null);
  const [reportUserDetail, setReportUserDetail] = useState<EquipmentEvent[]>([]);
  const [reportUserDetailLoading, setReportUserDetailLoading] = useState(false);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
      if (modulesMenuRef.current && !modulesMenuRef.current.contains(e.target as Node)) {
        setShowModulesMenu(false);
      }
      if (siteDropdownRef.current && !siteDropdownRef.current.contains(e.target as Node)) {
        setShowSiteDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ─── Reports helpers ──────────────────────────────────────────────────────

  const fetchReportHistory = async (equipmentId: number) => {
    setReportHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/reports/equipment/${equipmentId}`, { headers: authHeaders() });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) setReportHistory(await res.json());
    } catch {}
    setReportHistoryLoading(false);
  };

  const fetchReportByDate = async () => {
    setReportDateLoading(true);
    try {
      const params = new URLSearchParams();
      if (reportDateFrom) params.set('from', reportDateFrom);
      if (reportDateTo) params.set('to', reportDateTo);
      if (reportDeptFilter) params.set('department', reportDeptFilter);
      if (reportTypeFilter) params.set('type', reportTypeFilter);
      const res = await fetch(`${API_BASE_URL}/api/reports/by-date?${params}`, { headers: authHeaders() });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) setReportDateEvents(await res.json());
    } catch {}
    setReportDateLoading(false);
  };

  const fetchReportByDepartment = async () => {
    setReportDeptLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/reports/by-department`, { headers: authHeaders() });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) setReportDeptStats(await res.json());
    } catch {}
    setReportDeptLoading(false);
  };

  const fetchReportByUser = async (opts?: { from?: string; to?: string; department?: string }) => {
    setReportUserLoading(true);
    setReportUserExpanded(null);
    try {
      const params = new URLSearchParams();
      const from = opts?.from ?? reportUserFrom;
      const to   = opts?.to   ?? reportUserTo;
      const dept = opts?.department ?? reportUserDeptFilter;
      if (from) params.set('from', from);
      if (to)   params.set('to', to);
      if (dept) params.set('department', dept);
      const res = await fetch(`${API_BASE_URL}/api/reports/by-user?${params}`, { headers: authHeaders() });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) setReportUserStats(await res.json());
    } catch {}
    setReportUserLoading(false);
  };

  const fetchUserDetail = async (username: string) => {
    if (reportUserExpanded === username) { setReportUserExpanded(null); return; }
    setReportUserExpanded(username);
    setReportUserDetailLoading(true);
    try {
      const params = new URLSearchParams({ username });
      if (reportUserFrom) params.set('from', reportUserFrom);
      if (reportUserTo)   params.set('to', reportUserTo);
      if (reportUserDeptFilter) params.set('department', reportUserDeptFilter);
      const res = await fetch(`${API_BASE_URL}/api/reports/user-detail?${params}`, { headers: authHeaders() });
      if (res.ok) setReportUserDetail(await res.json());
    } catch {}
    setReportUserDetailLoading(false);
  };

  const getEventActionStyle = (action: string) => {
    if (action === 'Création')    return { dot: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-700' };
    if (action === 'Intervention')return { dot: 'bg-green-500',  badge: 'bg-green-100 text-green-700' };
    if (action === 'Modification') return { dot: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-700' };
    if (action === 'Suppression')  return { dot: 'bg-red-500',    badge: 'bg-red-100 text-red-700' };
    return { dot: 'bg-gray-400', badge: 'bg-gray-100 text-gray-600' };
  };

  const FIELD_LABELS: Record<string, string> = {
    name: 'Nom', type: 'Type', brand: 'Marque', model: 'Modèle',
    serialNumber: 'N° Série', ipAddress: 'Adresse IP', location: 'Emplacement',
    department: 'Département', status: 'Statut', purchaseDate: 'Date achat',
    warranty: 'Garantie', lastMaintenance: 'Dernière maintenance',
    visited: 'Visité', technicianName: 'Technicien',
    visitDate: 'Date visite', interventionDetails: 'Détails intervention',
  };

  const exportReportPdf = (title: string, events: EquipmentEvent[]) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text(title, 14, 14);
    doc.setFontSize(9);
    doc.text(`Exporté le ${new Date().toLocaleDateString('fr-FR')} — ${events.length} événement(s)`, 14, 21);
    autoTable(doc, {
      startY: 26,
      head: [['Date', 'Équipement', 'Type', 'Département', 'Action', 'Détails', 'Technicien', 'Utilisateur']],
      body: events.map(ev => [
        new Date(ev.createdAt).toLocaleString('fr-FR'),
        ev.equipmentName, ev.equipmentType, ev.department,
        ev.action, ev.details, ev.technician, ev.userName,
      ]),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [79, 70, 229] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });
    doc.save(`rapport-${Date.now()}.pdf`);
  };

  const exportReportExcel = (sheetName: string, events: EquipmentEvent[]) => {
    const rows = events.map(ev => ({
      'Date': new Date(ev.createdAt).toLocaleString('fr-FR'),
      'Équipement': ev.equipmentName,
      'Type': ev.equipmentType,
      'Département': ev.department,
      'Action': ev.action,
      'Détails': ev.details,
      'Technicien': ev.technician,
      'Utilisateur': ev.userName,
      'IP': ev.ip,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    XLSX.writeFile(wb, `rapport-${Date.now()}.xlsx`);
  };

  // ─── Monitoring helpers ────────────────────────────────────────────────────

  const formatDuration = (startIso: string) => {
    const diffMs = Date.now() - new Date(startIso).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Moins d'1 min";
    if (diffMins < 60) return `${diffMins} min`;
    const h = Math.floor(diffMins / 60);
    const m = diffMins % 60;
    return `${h}h ${m}min`;
  };

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

  const isOnline = (lastSeen: string) =>
    Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000;

  const getActionStyle = (action: string): string => {
    if (action === 'Connexion') return 'bg-green-100 text-green-700';
    if (action === 'Déconnexion') return 'bg-gray-100 text-gray-600';
    if (action.startsWith('Ajout') || action.startsWith('Création')) return 'bg-blue-100 text-blue-700';
    if (action.startsWith('Modification')) return 'bg-yellow-100 text-yellow-700';
    if (action.startsWith('Suppression')) return 'bg-red-100 text-red-700';
    if (action === 'Export CSV') return 'bg-purple-100 text-purple-700';
    return 'bg-gray-100 text-gray-600';
  };

  const fetchSessions = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/sessions`, { headers: authHeaders() });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) setActiveSessions(await res.json());
    } catch {}
  };

  const fetchActivities = async (userId?: number | null) => {
    try {
      const qs = userId != null ? `?userId=${userId}&limit=200` : '?limit=200';
      const res = await fetch(`${API_BASE_URL}/api/admin/activities${qs}`, { headers: authHeaders() });
      if (res.status === 401) { handleUnauthorized(); return; }
      if (res.ok) setActivityLogs(await res.json());
    } catch {}
  };

  const refreshMonitoring = async () => {
    setMonitoringLoading(true);
    await Promise.all([fetchSessions(), fetchActivities(activityUserFilterRef.current)]);
    setMonitoringLoading(false);
  };

  const handleUnauthorized = () => {
    alert('Session expirée ou non autorisée. Veuillez vous reconnecter.');
    onLogout();
  };

  const fetchEquipments = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(API_BASE, { headers: authHeaders() });
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      if (response.status === 403) {
        setError('Vous n\'êtes pas autorisé à voir ces équipements.');
        return;
      }
      if (!response.ok) {
        throw new Error('Erreur réseau');
      }
      const data = await response.json();
      setEquipments(data);
    } catch (err) {
      setError('Impossible de charger les équipements depuis le backend. Affichage des données locales.');
      setEquipments(sampleEquipments);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    if (!isAdmin) return;
    try {
      const response = await fetch(API_USERS, { headers: authHeaders() });
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      if (response.status === 403) {
        setError('Vous n\'êtes pas autorisé à voir les utilisateurs.');
        return;
      }
      if (!response.ok) {
        throw new Error('Erreur réseau');
      }
      const data = await response.json();
      setUserAccounts(data);
    } catch {
      setError('Impossible de charger les utilisateurs.');
    }
  };

  const openAccessModal = (user: UserAccount) => {
    setAccessTarget(user);
    setAccessForm({ role: user.role, permissions: (user.permissions ?? []) as Permission[], allowedSiteIds: user.allowedSiteIds ?? [] });
    setAccessError(null);
    setShowAccessModal(true);
  };

  const handleSaveAccess = async () => {
    if (!accessTarget) return;
    setAccessLoading(true);
    setAccessError(null);
    try {
      const payload = {
        username: accessTarget.username,
        name: accessTarget.name,
        role: accessForm.role,
        permissions: accessForm.role === 'admin' ? ['lecture', 'ecriture', 'modification'] : accessForm.permissions,
        allowedSiteIds: accessForm.role === 'admin' ? [] : accessForm.allowedSiteIds,
      };
      const r = await fetch(`${API_USERS}/${accessTarget.id}`, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(payload) });
      if (r.status === 401) { handleUnauthorized(); return; }
      if (!r.ok) { const d = await r.json().catch(() => null); setAccessError(d?.message || 'Erreur lors de la sauvegarde.'); return; }
      setShowAccessModal(false);
      await fetchUsers();
    } catch { setAccessError('Impossible de sauvegarder.'); }
    setAccessLoading(false);
  };

  const openUserCreate = () => {
    setUserEditingId(null);
    setUserFormData({ username: '', name: '', role: 'technicien', password: '', permissions: ['lecture'], allowedSiteIds: [] });
    setUserFormError(null);
    setShowUserFormModal(true);
  };

  const openUserEdit = (user: UserAccount) => {
    setUserEditingId(user.id);
    setUserFormData({ username: user.username, name: user.name, role: user.role, password: '', permissions: (user.permissions ?? []) as Permission[], allowedSiteIds: user.allowedSiteIds ?? [] });
    setUserFormError(null);
    setShowUserFormModal(true);
  };

  const handleUserSubmit = async () => {
    if (!userFormData.username.trim() || !userFormData.name.trim()) {
      setUserFormError('Le nom d\'utilisateur et le nom complet sont obligatoires.');
      return;
    }

    if (!userEditingId && !userFormData.password.trim()) {
      setUserFormError('Le mot de passe est requis pour un nouvel utilisateur.');
      return;
    }

    const payload = {
      username: userFormData.username.trim(),
      name: userFormData.name.trim(),
      role: userFormData.role,
      password: userFormData.password.trim() || undefined,
      permissions: userFormData.role === 'admin' ? ['lecture', 'ecriture', 'modification'] : userFormData.permissions,
      allowedSiteIds: userFormData.role === 'admin' ? [] : userFormData.allowedSiteIds
    };

    try {
      const url = userEditingId ? `${API_USERS}/${userEditingId}` : API_USERS;
      const method = userEditingId ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(payload)
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      if (response.status === 403) {
        setUserFormError('Action réservée aux administrateurs.');
        return;
      }
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setUserFormError(data?.message || 'Impossible de sauvegarder l\'utilisateur.');
        return;
      }

      setShowUserFormModal(false);
      setUserFormData({ username: '', name: '', role: 'technicien', password: '', permissions: ['lecture'], allowedSiteIds: [] });
      await fetchUsers();
    } catch {
      setUserFormError('Impossible de sauvegarder l\'utilisateur.');
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
      return;
    }
    try {
      const response = await fetch(`${API_USERS}/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      if (response.status === 403) {
        setError('Action réservée aux administrateurs.');
        return;
      }
      if (!response.ok) {
        throw new Error('Erreur de suppression');
      }
      await fetchUsers();
    } catch {
      setError('Impossible de supprimer l\'utilisateur.');
    }
  };

  useEffect(() => {
    fetchEquipments();
    fetchUsers();
    fetchSites();
  }, []);

  // Load monitoring data when modal opens
  useEffect(() => {
    if (!showMonitoringModal || !isAdmin) return;
    refreshMonitoring();
  }, [showMonitoringModal]);

  // Auto-fetch activity log when filters change (debounced 400ms)
  useEffect(() => {
    if (!showActivityLog) return;
    const timer = setTimeout(() => fetchActivityLog(activityFilter), 400);
    return () => clearTimeout(timer);
  }, [activityFilter, showActivityLog]);

  // Auto-fetch transfers when filters change (debounced 400ms)
  useEffect(() => {
    if (!showTransferModule) return;
    const timer = setTimeout(() => fetchAllTransfers(transferModuleFilter), 400);
    return () => clearTimeout(timer);
  }, [transferModuleFilter, showTransferModule]);

  // Auto-fetch report by date when filters change (debounced 500ms)
  useEffect(() => {
    if (!showReportsModal || reportsTab !== 'date') return;
    const timer = setTimeout(() => fetchReportByDate(), 500);
    return () => clearTimeout(timer);
  }, [reportDateFrom, reportDateTo, reportDeptFilter, reportTypeFilter, showReportsModal, reportsTab]);

  // Auto-fetch report by user when filters change (debounced 500ms)
  useEffect(() => {
    if (!showReportsModal || reportsTab !== 'user') return;
    const timer = setTimeout(() => fetchReportByUser(), 500);
    return () => clearTimeout(timer);
  }, [reportUserFrom, reportUserTo, reportUserDeptFilter, showReportsModal, reportsTab]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowForm(false);
        setShowDetailsModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const resetForm = () => {
    setFormData(defaultFormData);
    setEditingId(null);
  };

  const openNewEquipmentForm = () => {
    resetForm();
    setShowForm(true);
  };

  const handleSaveEquipment = async (equipment: EquipmentFormData) => {
    try {
      if (editingId !== null) {
        const response = await fetch(`${API_BASE}/${editingId}`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify(equipment)
        });
        if (response.status === 401) {
          handleUnauthorized();
          return;
        }
        if (!response.ok) {
          throw new Error('Erreur de mise à jour');
        }
        const updated = await response.json();
        setEquipments((prev) => prev.map((item) => (item.id === editingId ? updated : item)));
      } else {
        const response = await fetch(API_BASE, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(equipment)
        });
        if (response.status === 401) {
          handleUnauthorized();
          return;
        }
        if (!response.ok) {
          throw new Error('Erreur de création');
        }
        const created = await response.json();
        setEquipments((prev) => [...prev, created]);
      }
    } catch (err) {
      alert('Impossible de sauvegarder l\'équipement. Vérifiez vos autorisations et que le backend est démarré.');
    }
  };

  const handleSubmit = async () => {
    const requiredFields = ['name', 'brand', 'model', 'serialNumber', 'location', 'department'];
    const missingField = requiredFields.find((field) => !formData[field as keyof EquipmentFormData]?.toString().trim());

    if (missingField) {
      alert('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    if (formData.visited && !formData.technicianName.trim()) {
      alert('Le nom du technicien est obligatoire si l\'équipement a été visité.');
      return;
    }

    await handleSaveEquipment(formData);

    // Upload documents for new equipment
    if (editingId === null && newEquipDocs.length > 0) {
      const latestEquip = equipments[equipments.length - 1];
      if (latestEquip) {
        setUploadingDocs(true);
        for (const { file, description } of newEquipDocs) {
          await handleDocumentUpload(latestEquip.id, file, description);
        }
        setUploadingDocs(false);
      }
      setNewEquipDocs([]);
    }

    setShowForm(false);
    resetForm();
  };

  const handleEdit = (equipment: Equipment) => {
    setFormData({ ...equipment });
    setEditingId(equipment.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cet équipement ?')) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      if (response.status === 403) {
        alert('Action réservée aux administrateurs.');
        return;
      }
      if (!response.ok) {
        throw new Error('Erreur de suppression');
      }
      setEquipments((prev) => prev.filter((item) => item.id !== id));
      if (selectedEquipment?.id === id) {
        setShowDetailsModal(false);
        setSelectedEquipment(null);
      }
    } catch (err) {
      alert('Impossible de supprimer l\'équipement. Vérifiez vos autorisations et que le backend est démarré.');
    }
  };

  const handleRefresh = async () => {
    await fetchEquipments();
  };

  const handleExportCsv = async () => {
    try {
      const response = await fetch(EXPORT_URL, { headers: authHeaders() });
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!response.ok) throw new Error('Export impossible');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'equipements.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Impossible d\'exporter les équipements.');
    }
    setShowExportMenu(false);
  };

  const EXPORT_COLUMNS = [
    { key: 'id',                  label: 'ID' },
    { key: 'name',                label: 'Nom' },
    { key: 'type',                label: 'Type' },
    { key: 'brand',               label: 'Marque' },
    { key: 'model',               label: 'Modèle' },
    { key: 'serialNumber',        label: 'N° Série' },
    { key: 'ipAddress',           label: 'Adresse IP' },
    { key: 'location',            label: 'Emplacement' },
    { key: 'department',          label: 'Département' },
    { key: 'status',              label: 'Statut' },
    { key: 'purchaseDate',        label: 'Date achat' },
    { key: 'warranty',            label: 'Garantie' },
    { key: 'lastMaintenance',     label: 'Dernière maintenance' },
    { key: 'visited',             label: 'Visité' },
    { key: 'technicianName',      label: 'Technicien' },
    { key: 'visitDate',           label: 'Date visite' },
    { key: 'interventionDetails', label: 'Détails intervention' },
  ] as const;

  const handleExportExcel = () => {
    const rows = filteredEquipments.map((e) => {
      const row = Object.fromEntries(
        EXPORT_COLUMNS.map(({ key, label }) => [label, key === 'visited' ? (e[key] ? 'Oui' : 'Non') : (e[key as keyof Equipment] ?? '')])
      );
      row['Site'] = e.siteId ? (sites.find(s => s.id === e.siteId)?.name ?? '') : '';
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Équipements');
    XLSX.writeFile(wb, 'equipements.xlsx');
    setShowExportMenu(false);
  };

  const handleExportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Liste des équipements IT', 14, 14);
    doc.setFontSize(9);
    doc.text(`Exporté le ${new Date().toLocaleDateString('fr-FR')} — ${filteredEquipments.length} équipement(s)`, 14, 21);

    autoTable(doc, {
      startY: 26,
      head: [['Nom', 'Type', 'Marque / Modèle', 'N° Série', 'IP', 'Emplacement', 'Site', 'Département', 'Statut', 'Garantie', 'Visité']],
      body: filteredEquipments.map((e) => [
        e.name,
        e.type,
        `${e.brand} ${e.model}`.trim(),
        e.serialNumber,
        e.ipAddress,
        e.location,
        e.siteId ? (sites.find(s => s.id === e.siteId)?.name ?? '') : '',
        e.department,
        e.status,
        e.warranty,
        e.visited ? 'Oui' : 'Non',
      ]),
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [37, 99, 235] },
      alternateRowStyles: { fillColor: [245, 247, 250] },
    });

    doc.save('equipements.pdf');
    setShowExportMenu(false);
  };

  // ─── Transfer ───────────────────────────────────────────────────────────────

  const openTransferModal = (equipment: Equipment) => {
    setTransferTarget(equipment);
    setTransferForm({ toLocation: equipment.location, toDepartment: equipment.department, toSiteId: equipment.siteId ?? null, reason: 'Réorganisation', technicianName: '', notes: '', transferQty: equipment.quantity ?? 1 });
    setShowTransferModal(true);
  };

  const handleTransfer = async () => {
    if (!transferTarget) return;
    if (!transferForm.toLocation.trim() || !transferForm.toDepartment.trim()) {
      alert('Localisation et département requis.');
      return;
    }
    setTransferLoading(true);
    try {
      const response = await fetch(`${API_BASE}/${transferTarget.id}/transfer`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(transferForm),
      });
      if (response.status === 401) { handleUnauthorized(); return; }
      if (!response.ok) throw new Error('Erreur transfert');
      const updated = await response.json();
      setEquipments((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      if (selectedEquipment?.id === updated.id) setSelectedEquipment(updated);
      setShowTransferModal(false);
    } catch {
      alert('Impossible d\'effectuer le transfert.');
    } finally {
      setTransferLoading(false);
    }
  };

  // ─── Documents ──────────────────────────────────────────────────────────────

  const fetchDocuments = async (equipmentId: number) => {
    setDocsLoading(true);
    try {
      const r = await fetch(`${API_BASE}/${equipmentId}/documents`, { headers: authHeaders() });
      if (r.ok) setEquipmentDocs(await r.json());
    } finally {
      setDocsLoading(false);
    }
  };

  const fetchTransferHistory = async (equipmentId: number) => {
    setTransfersLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/reports/equipment/${equipmentId}`, { headers: authHeaders() });
      if (r.ok) {
        const all = await r.json();
        setTransferHistory(all.filter((ev: any) => ev.action === 'Transfert'));
      }
    } finally {
      setTransfersLoading(false);
    }
  };

  const fetchSites = async () => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/sites`, { headers: authHeaders() });
      if (r.ok) setSites(await r.json());
    } catch {}
  };

  const handleSaveSite = async () => {
    if (!siteForm.name.trim()) { alert('Le nom du site est requis.'); return; }
    setSiteLoading(true);
    try {
      const url = editingSiteId ? `${API_BASE_URL}/api/sites/${editingSiteId}` : `${API_BASE_URL}/api/sites`;
      const r = await fetch(url, {
        method: editingSiteId ? 'PUT' : 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(siteForm),
      });
      if (!r.ok) { const d = await r.json(); alert(d.message || 'Erreur'); return; }
      await fetchSites();
      setEditingSiteId(null);
      setSiteForm(defaultSiteForm);
    } catch { alert('Erreur réseau.'); }
    setSiteLoading(false);
  };

  const handleDeleteSite = async (id: number) => {
    if (!confirm('Supprimer ce site ?')) return;
    try {
      const r = await fetch(`${API_BASE_URL}/api/sites/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (!r.ok) { const d = await r.json(); alert(d.message); return; }
      if (selectedSiteId === id) setSelectedSiteId(null);
      await fetchSites();
    } catch { alert('Erreur réseau.'); }
  };

  const getTransferLocations = (ev: any) => {
    const changes = Array.isArray(ev.changes) ? ev.changes : [];
    const loc  = changes.find((c: any) => c.field === 'location');
    const dept = changes.find((c: any) => c.field === 'department');
    const site = changes.find((c: any) => c.field === 'siteId');
    return {
      fromLocation: loc?.from      || '',
      toLocation:   loc?.to        || '',
      fromDept:     dept?.from     || '',
      toDept:       dept?.to       || ev.department || '',
      fromSiteName: site?.fromName || (site?.from ? `Site #${site.from}` : ''),
      toSiteName:   site?.toName   || (site?.to   ? `Site #${site.to}`   : ''),
      siteChanged:  !!site,
    };
  };

  const fetchAllTransfers = async (filter = transferModuleFilter) => {
    setTransferModuleLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.department) params.append('department', filter.department);
      if (filter.from)       params.append('from', filter.from);
      if (filter.to)         params.append('to', filter.to);
      const r = await fetch(`${API_BASE_URL}/api/transfers?${params}`, { headers: authHeaders() });
      if (r.ok) setAllTransfers(await r.json());
    } catch {}
    setTransferModuleLoading(false);
  };

  const fetchActivityLog = async (filter = activityFilter) => {
    setActivityLogLoading(true);
    try {
      const params = new URLSearchParams({ limit: '300' });
      if (filter.username) params.append('username', filter.username);
      if (filter.dateFrom) params.append('dateFrom', filter.dateFrom);
      if (filter.dateTo)   params.append('dateTo', filter.dateTo);
      if (filter.action)   params.append('action', filter.action);
      const r = await fetch(`${API_BASE_URL}/api/admin/activity-log?${params}`, { headers: authHeaders() });
      if (r.ok) setActivityEntries(await r.json());
    } catch {}
    setActivityLogLoading(false);
  };

  const openReformModal = (equipment: Equipment) => {
    setReformTarget(equipment);
    setReformForm({ reason: '', replacedById: null, notes: '', reformQty: equipment.quantity ?? 1 });
    setShowReformModal(true);
  };

  const handleReform = async () => {
    if (!reformTarget) return;
    if (!reformForm.reason.trim()) { alert('Veuillez indiquer la raison de la réforme.'); return; }
    setReformLoading(true);
    try {
      const r = await fetch(`${API_BASE}/${reformTarget.id}/reform`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(reformForm),
      });
      if (!r.ok) throw new Error();
      const updated = await r.json();
      setEquipments(prev => prev.map(e => e.id === updated.id ? updated : e));
      setShowReformModal(false);
    } catch {
      alert('Impossible de réformer cet équipement.');
    }
    setReformLoading(false);
  };

  const handleDocumentUpload = async (equipmentId: number, file: File, description: string) => {
    return new Promise<EquipmentDoc | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const fileData = (reader.result as string).split(',')[1];
        try {
          const r = await fetch(`${API_BASE}/${equipmentId}/documents`, {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ filename: file.name, fileType: file.type, fileSize: file.size, fileData, description }),
          });
          if (r.ok) resolve(await r.json());
          else resolve(null);
        } catch { resolve(null); }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDeleteDocument = async (docId: number) => {
    if (!window.confirm('Supprimer ce document ?')) return;
    const r = await fetch(`${API_BASE_URL}/api/documents/${docId}`, { method: 'DELETE', headers: authHeaders() });
    if (r.ok || r.status === 204) {
      setEquipmentDocs((prev) => prev.filter((d) => d.id !== docId));
    }
  };

  const downloadDocument = async (docId: number) => {
    const r = await fetch(`${API_BASE_URL}/api/documents/${docId}/download`, { headers: authHeaders() });
    if (!r.ok) return;
    const { filename, fileType, fileData } = await r.json();
    const link = document.createElement('a');
    link.href = `data:${fileType};base64,${fileData}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleNewEquipDocAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter((f) => f.size <= 3 * 1024 * 1024);
    if (valid.length < files.length) alert('Certains fichiers dépassent 3 Mo et ont été ignorés.');
    setNewEquipDocs((prev) => [...prev, ...valid.map((f) => ({ file: f, description: '' }))]);
    e.target.value = '';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  // ─── Maintenance ────────────────────────────────────────────────────────────

  const fetchMaintenance = async (status = 'all') => {
    setMaintenanceLoading(true);
    try {
      const url = status === 'all' ? '/api/maintenance' : `/api/maintenance?status=${status}`;
      const r = await fetch(`${API_BASE_URL}${url}`, { headers: authHeaders() });
      if (r.ok) setMaintenanceRecords(await r.json());
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const openMaintenanceModule = () => {
    setShowMaintenanceModule(true);
    setSelectedMaintenance(null);
    fetchMaintenance(maintenanceFilter);
  };

  const openSignalerPanne = (equipment: Equipment) => {
    setMaintForm({ ...defaultMaintenanceForm, equipmentId: equipment.id });
    setMaintenanceEditId(null);
    setShowMaintenanceForm(true);
    setShowMaintenanceModule(true);
  };

  const handleSaveMaintenance = async () => {
    if (!maintenanceForm.failureDesc.trim()) { alert('Description de la panne requise.'); return; }
    try {
      if (maintenanceEditId !== null) {
        const r = await fetch(`${API_BASE_URL}/api/maintenance/${maintenanceEditId}`, {
          method: 'PUT', headers: authHeaders(), body: JSON.stringify(maintenanceForm),
        });
        if (r.ok) {
          const updated = await r.json();
          setMaintenanceRecords((prev) => prev.map((m) => m.id === maintenanceEditId ? updated : m));
          setSelectedMaintenance(updated);
        }
      } else {
        const r = await fetch(`${API_BASE_URL}/api/maintenance`, {
          method: 'POST', headers: authHeaders(), body: JSON.stringify(maintenanceForm),
        });
        if (r.ok) {
          const created = await r.json();
          setMaintenanceRecords((prev) => [created, ...prev]);
          // Refresh equipment list so status updates
          fetchEquipments();
        }
      }
      setShowMaintenanceForm(false);
      setMaintForm(defaultMaintenanceForm);
      setMaintenanceEditId(null);
    } catch { alert('Erreur lors de la sauvegarde.'); }
  };

  const handleDeleteMaintenance = async (id: number) => {
    if (!window.confirm('Supprimer ce ticket de maintenance ?')) return;
    const r = await fetch(`${API_BASE_URL}/api/maintenance/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (r.ok || r.status === 204) {
      setMaintenanceRecords((prev) => prev.filter((m) => m.id !== id));
      if (selectedMaintenance?.id === id) setSelectedMaintenance(null);
    }
  };

  const maintenanceStatusStyle: Record<string, string> = {
    ouvert:   'bg-red-100 text-red-700',
    en_cours: 'bg-yellow-100 text-yellow-700',
    résolu:   'bg-green-100 text-green-700',
  };
  const maintenancePriorityStyle: Record<string, string> = {
    faible:   'bg-gray-100 text-gray-600',
    normale:  'bg-blue-100 text-blue-700',
    haute:    'bg-orange-100 text-orange-700',
    critique: 'bg-red-200 text-red-800 font-bold',
  };

  const fmtDate = (iso: string | null) => iso
    ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

  const openDetailsModal = (equipment: Equipment) => {
    setSelectedEquipment(equipment);
    setDetailsTab('info');
    setEquipmentDocs([]);
    setTransferHistory([]);
    setShowDetailsModal(true);
  };

  const filteredEquipments = equipments.filter((equipment) => {
    const lowerSearch = searchTerm.toLowerCase();
    const matchesSearch =
      equipment.name.toLowerCase().includes(lowerSearch) ||
      equipment.location.toLowerCase().includes(lowerSearch) ||
      equipment.department.toLowerCase().includes(lowerSearch) ||
      equipment.brand.toLowerCase().includes(lowerSearch) ||
      equipment.model.toLowerCase().includes(lowerSearch) ||
      equipment.serialNumber.toLowerCase().includes(lowerSearch) ||
      equipment.ipAddress.toLowerCase().includes(lowerSearch);

    const matchesType   = filterType   === 'all' || equipment.type   === filterType;
    const matchesStatus = filterStatus === 'all' || equipment.status === filterStatus;
    const matchesSite   = selectedSiteId === null || equipment.siteId === selectedSiteId;

    return matchesSearch && matchesType && matchesStatus && matchesSite;
  });

  const getTypeIcon = (type: EquipmentType) => {
    const typeInfo = equipmentTypes.find((t) => t.value === type);
    const IconComponent = typeInfo?.icon || Monitor;
    return <IconComponent className="w-4 h-4" />;
  };

  const dueSoonCount = equipments.filter((equipment) => {
    if (!equipment.warranty) {
      return false;
    }
    const warrantyDate = new Date(equipment.warranty);
    const now = new Date();
    const soon = new Date();
    soon.setDate(now.getDate() + 90);
    return warrantyDate >= now && warrantyDate <= soon;
  }).length;

  const maintenanceCount = equipments.filter((equipment) => equipment.status === 'maintenance').length;
  const notVisitedCount = equipments.filter((equipment) => !equipment.visited).length;

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="relative rounded-xl shadow-sm mb-6 p-6" style={{background:'linear-gradient(to right, #075985, #0ea5e9)'}}>
          <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
            <div className="absolute inset-0 opacity-0" />
          </div>
          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Gestion des équipements informatiques</h1>
              <p className="text-sky-100 mt-1 text-sm">Suivi des équipements et accès protégé par rôle.</p>
            </div>
            <div className="flex items-center gap-3">
              {/* User pill */}
              <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-white backdrop-blur-sm">
                <User className="w-4 h-4 text-blue-100" />
                <span className="font-medium">{currentUser.name}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${roleInfo.classes}`}>{roleInfo.label}</span>
              </div>

              {/* Modules dropdown */}
              <div className="relative" ref={modulesMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowModulesMenu(v => !v)}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/25 bg-white/15 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-white/25 transition-colors backdrop-blur-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  {maintenanceRecords.filter(m => m.status !== 'résolu').length > 0 && (
                    <span className="bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                      {maintenanceRecords.filter(m => m.status !== 'résolu').length}
                    </span>
                  )}
                  <ChevronDown className={`w-4 h-4 transition-transform ${showModulesMenu ? 'rotate-180' : ''}`} />
                </button>

                {showModulesMenu && (
                  <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-gray-200 bg-white shadow-lg z-30 py-1 overflow-hidden">
                    {canWrite && (
                      <>
                        <div className="px-3 pt-2 pb-1">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Opérations</p>
                        </div>
                        {canModify && (
                          <button type="button"
                            onClick={() => { setShowModulesMenu(false); setShowTransferModule(true); fetchAllTransfers(); }}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                            <ArrowRightLeft className="w-4 h-4 text-purple-500" />
                            Transferts
                          </button>
                        )}
                        <button type="button"
                          onClick={() => { setShowModulesMenu(false); openMaintenanceModule(); }}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                          <Wrench className="w-4 h-4 text-orange-500" />
                          Maintenance
                          {maintenanceRecords.filter(m => m.status !== 'résolu').length > 0 && (
                            <span className="ml-auto bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                              {maintenanceRecords.filter(m => m.status !== 'résolu').length}
                            </span>
                          )}
                        </button>
                      </>
                    )}

                    {isAdmin && (
                      <>
                        <div className="border-t border-gray-100 my-1" />
                        <div className="px-3 pt-2 pb-1">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Administration</p>
                        </div>
                        <button type="button"
                          onClick={() => { setShowModulesMenu(false); setShowReportsModal(true); setReportsTab('equipment'); fetchReportByDepartment(); }}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                          <Calendar className="w-4 h-4 text-indigo-500" />
                          Rapports
                        </button>
                        <button type="button"
                          onClick={() => { setShowModulesMenu(false); setShowActivityLog(true); fetchActivityLog(); }}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                          <ClipboardList className="w-4 h-4 text-teal-500" />
                          Journal d'activité
                        </button>
                        <button type="button"
                          onClick={() => { setShowModulesMenu(false); setShowMonitoringModal(true); }}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                          <Activity className="w-4 h-4 text-green-500" />
                          Monitoring
                        </button>
                        <button type="button"
                          onClick={() => { setShowModulesMenu(false); fetchUsers(); setShowUserModal(true); }}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                          <Users className="w-4 h-4 text-blue-500" />
                          Gérer les utilisateurs
                        </button>
                      </>
                    )}

                    <div className="border-t border-gray-100 my-1" />
                    <button type="button"
                      onClick={() => { setShowModulesMenu(false); onLogout(); }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                      <LogOut className="w-4 h-4" />
                      Déconnexion
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Sélecteur de sites ── */}
        {(sites.length > 0 || isAdmin) && (
          <div className="flex items-center gap-3 mb-6">
            {/* Site dropdown */}
            <div className="relative flex-1 max-w-sm" ref={siteDropdownRef}>
              <button
                type="button"
                onClick={() => setShowSiteDropdown(v => !v)}
                className="w-full flex items-center gap-3 bg-white border border-gray-200 rounded-xl shadow-sm px-4 py-3 text-left hover:border-blue-400 hover:shadow-md transition-all"
              >
                <Globe className="w-4 h-4 text-blue-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  {selectedSiteId === null ? (
                    <span className="text-sm text-gray-400">— Sélectionner un site —</span>
                  ) : (() => {
                    const s = sites.find(s => s.id === selectedSiteId);
                    return s ? (
                      <>
                        <span className="text-sm font-semibold text-gray-800 block truncate">{s.name}</span>
                        <span className="text-xs text-gray-400">{s.city}{s.country ? `, ${s.country}` : ''} · {equipments.filter(e => e.siteId === s.id).length} équip.</span>
                      </>
                    ) : null;
                  })()}
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${showSiteDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showSiteDropdown && (
                <div className="absolute left-0 top-full mt-1 w-full min-w-[260px] bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1 overflow-hidden">
                  {(isAdmin || userAllowedSiteIds.length === 0 ? sites : sites.filter(s => userAllowedSiteIds.includes(s.id))).map(site => {
                    const count = equipments.filter(e => e.siteId === site.id).length;
                    const selected = selectedSiteId === site.id;
                    return (
                      <button key={site.id} type="button"
                        onClick={() => { setSelectedSiteId(site.id); setShowSiteDropdown(false); }}
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${selected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                      >
                        <div className={`w-2 h-2 rounded-full shrink-0 ${selected ? 'bg-blue-500' : 'bg-gray-200'}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${selected ? 'text-blue-700' : 'text-gray-800'}`}>{site.name}</p>
                          <p className="text-xs text-gray-400 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />{site.city}{site.country ? `, ${site.country}` : ''} · {count} équip.
                          </p>
                        </div>
                        {selected && <CheckCircle className="w-4 h-4 text-blue-500 shrink-0" />}
                      </button>
                    );
                  })}
                  {sites.length === 0 && (
                    <p className="px-4 py-3 text-sm text-gray-400 text-center">Aucun site configuré.</p>
                  )}
                </div>
              )}
            </div>

            {/* Admin: gérer les sites */}
            {isAdmin && (
              <button
                onClick={() => { setSiteForm(defaultSiteForm); setEditingSiteId(null); setShowSiteModal(true); }}
                className="inline-flex items-center gap-2 rounded-xl border border-dashed border-gray-300 bg-white px-4 py-3 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" /> Gérer les sites
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-blue-500">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <Info className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400 font-medium">Total équipements</div>
                <div className="text-2xl font-bold text-gray-900">{equipments.length}</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-amber-400">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400 font-medium">Sous garantie 90j</div>
                <div className="text-2xl font-bold text-gray-900">{dueSoonCount}</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-orange-500">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400 font-medium">Maintenance</div>
                <div className="text-2xl font-bold text-gray-900">{maintenanceCount}</div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5 border-l-4 border-rose-500">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400 font-medium">Non visités</div>
                <div className="text-2xl font-bold text-gray-900">{notVisitedCount}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm mb-6 border border-gray-100">
          {/* Ligne 1 : recherche + actions */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher un équipement, marque, modèle…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-transparent transition-all"
              />
            </div>

            {/* Actualiser */}
            <button
              onClick={handleRefresh}
              title="Actualiser"
              className="p-2.5 rounded-lg border border-gray-200 text-gray-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-colors"
            >
              <RefreshCcw className="w-4 h-4" />
            </button>

            {/* Exporter */}
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setShowExportMenu((v) => !v)}
                className="inline-flex items-center gap-2 px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                Exporter
                <ChevronDown className={`w-3 h-3 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
              </button>
              {showExportMenu && (
                <div className="absolute right-0 z-50 mt-1 w-44 rounded-xl border border-gray-200 bg-white shadow-lg py-1 overflow-hidden">
                  <button onClick={handleExportCsv}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                    <span className="w-5 h-5 rounded bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">CSV</span>
                    Fichier CSV
                  </button>
                  <button onClick={handleExportExcel}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                    <span className="w-5 h-5 rounded bg-green-100 flex items-center justify-center text-xs font-bold text-green-600">XLS</span>
                    Excel (.xlsx)
                  </button>
                  <button onClick={handleExportPdf}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                    <span className="w-5 h-5 rounded bg-red-100 flex items-center justify-center text-xs font-bold text-red-500">PDF</span>
                    PDF
                  </button>
                </div>
              )}
            </div>

            {/* Nouvel équipement */}
            {canWrite && (
              <button
                onClick={openNewEquipmentForm}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white shadow-sm transition-all hover:opacity-90 active:scale-95"
                style={{background:'linear-gradient(135deg, #0f1b35 0%, #1a3a6b 45%, #1e5799 100%)'}}
              >
                <Plus className="w-4 h-4" />
                Nouvel équipement
              </button>
            )}
          </div>

          {/* Ligne 2 : filtres + compteur */}
          <div className="flex flex-wrap items-center gap-4 px-4 py-2.5 bg-gray-50">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Type</span>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as 'all' | EquipmentType)}
                className="py-1.5 pl-2 pr-7 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Tous</option>
                {equipmentTypes.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Statut</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as 'all' | EquipmentStatus)}
                className="py-1.5 pl-2 pr-7 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Tous</option>
                <option value="actif">Actif</option>
                <option value="inactif">Inactif</option>
                <option value="maintenance">Maintenance</option>
                <option value="defaillant">Défaillant</option>
                <option value="réformé">Réformé</option>
              </select>
            </div>

            {/* Réinitialiser les filtres si actifs */}
            {(filterType !== 'all' || filterStatus !== 'all' || searchTerm) && (
              <button
                onClick={() => { setFilterType('all'); setFilterStatus('all'); setSearchTerm(''); }}
                className="text-xs text-blue-600 hover:text-blue-800 underline underline-offset-2"
              >
                Réinitialiser
              </button>
            )}

            <span className="ml-auto text-xs text-gray-400 font-medium">
              {filteredEquipments.length} résultat{filteredEquipments.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center text-gray-400">Chargement des données…</div>
        ) : sites.length > 0 && selectedSiteId === null ? (
          <div className="bg-white rounded-lg shadow-sm p-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
              <Globe className="w-8 h-8 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-1">Sélectionnez un site</h3>
            <p className="text-sm text-gray-400 max-w-xs">Choisissez un site dans la barre ci-dessus pour afficher ses équipements.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-700 to-slate-600">
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-200 uppercase tracking-wider">Équipement</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-200 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-200 uppercase tracking-wider">Localisation</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-200 uppercase tracking-wider">Statut</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-200 uppercase tracking-wider">Passage technicien</th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-200 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {filteredEquipments.map((equipment) => (
                    <tr key={equipment.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {getTypeIcon(equipment.type)}
                          <div>
                            <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                              {equipment.name}
                              {(equipment.quantity ?? 1) > 1 && (
                                <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-bold rounded bg-indigo-100 text-indigo-700">×{equipment.quantity}</span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">{equipment.brand} {equipment.model}</div>
                            <div className="text-sm text-gray-400">IP: {equipment.ipAddress || 'N/A'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {equipmentTypes.find((t) => t.value === equipment.type)?.label}
                      </td>
                      <td className="px-6 py-4">
                        {equipment.siteId && (
                          <div className="text-xs text-blue-600 flex items-center gap-1 mb-0.5">
                            <Building2 className="w-3 h-3" />
                            {sites.find(s => s.id === equipment.siteId)?.name}
                          </div>
                        )}
                        <div className="text-sm text-gray-900 flex items-center">
                          <MapPin className="w-3 h-3 mr-1 text-gray-400" />
                          {equipment.location}
                        </div>
                        <div className="text-sm text-gray-500">{equipment.department}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColors[equipment.status]}`}>
                          {equipment.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {equipment.visited ? (
                          <button
                            onClick={() => openDetailsModal(equipment)}
                            className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 hover:bg-green-200"
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            {equipment.technicianName}
                          </button>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                            <XCircle className="w-3 h-3 mr-1" />
                            Non visité
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium">
                        <div className="flex items-center gap-2">
                          {canModify && (
                            <button
                              onClick={() => handleEdit(equipment)}
                              className="text-blue-600 hover:text-blue-900"
                              title="Modifier"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {canModify && (
                            <button
                              onClick={() => handleDelete(equipment.id)}
                              className="text-red-600 hover:text-red-900"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          {canWrite && (
                            <button
                              onClick={() => openSignalerPanne(equipment)}
                              className="text-orange-500 hover:text-orange-700"
                              title="Signaler une panne"
                            >
                              <Wrench className="w-4 h-4" />
                            </button>
                          )}
                          {canModify && equipment.status !== 'réformé' && (
                            <button
                              onClick={() => openTransferModal(equipment)}
                              className="text-purple-600 hover:text-purple-900"
                              title="Transférer"
                            >
                              <ArrowRightLeft className="w-4 h-4" />
                            </button>
                          )}
                          {canModify && equipment.status !== 'réformé' && (
                            <button
                              onClick={() => openReformModal(equipment)}
                              className="text-gray-400 hover:text-gray-700"
                              title="Réformer (mettre au rebut)"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => openDetailsModal(equipment)}
                            className="text-gray-600 hover:text-gray-900"
                            title="Voir détails / Documents"
                          >
                            <Info className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showForm && (
          <div
            className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => {
              setShowForm(false);
              resetForm();
            }}
          >
            <div
              className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 className="text-xl font-bold mb-4">
                {editingId !== null ? 'Modifier l\'équipement' : 'Nouvel équipement'}
              </h2>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'équipement *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value as EquipmentType })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {equipmentTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Marque *</label>
                    <input
                      type="text"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Modèle *</label>
                    <input
                      type="text"
                      value={formData.model}
                      onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Numéro de série *</label>
                    <input
                      type="text"
                      value={formData.serialNumber}
                      onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Adresse IP</label>
                    <input
                      type="text"
                      value={formData.ipAddress}
                      onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="192.168.1.100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Site</label>
                    <select
                      value={formData.siteId ?? ''}
                      onChange={e => setFormData({ ...formData, siteId: e.target.value ? Number(e.target.value) : null })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">— Aucun site —</option>
                      {sites.map(s => (
                        <option key={s.id} value={s.id}>{s.name} — {s.city}{s.country ? `, ${s.country}` : ''}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantité</label>
                    <input
                      type="number"
                      min={1}
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Localisation *</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Département *</label>
                    <input
                      type="text"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Statut *</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as EquipmentStatus })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="actif">Actif</option>
                      <option value="inactif">Inactif</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="defaillant">Défaillant</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date d'achat</label>
                    <input
                      type="date"
                      value={formData.purchaseDate}
                      onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fin de garantie</label>
                    <input
                      type="date"
                      value={formData.warranty}
                      onChange={(e) => setFormData({ ...formData, warranty: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dernière maintenance</label>
                    <input
                      type="date"
                      value={formData.lastMaintenance}
                      onChange={(e) => setFormData({ ...formData, lastMaintenance: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-3">Passage technicien</h3>

                  <div className="flex items-center mb-4">
                    <input
                      type="checkbox"
                      id="visited"
                      checked={formData.visited}
                      onChange={(e) => setFormData({ ...formData, visited: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="visited" className="ml-2 block text-sm text-gray-900">
                      Un technicien a visité cet équipement
                    </label>
                  </div>

                  {formData.visited && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nom du technicien *</label>
                        <input
                          type="text"
                          value={formData.technicianName}
                          onChange={(e) => setFormData({ ...formData, technicianName: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date et heure de visite</label>
                        <input
                          type="datetime-local"
                          value={formData.visitDate}
                          onChange={(e) => setFormData({ ...formData, visitDate: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Détails de l'intervention</label>
                        <textarea
                          value={formData.interventionDetails}
                          onChange={(e) => setFormData({ ...formData, interventionDetails: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Décrivez les actions effectuées..."
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Documents à l'achat (nouveau équipement seulement) */}
                {editingId === null && (
                  <div className="border-t pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Documents d'achat (optionnel)</span>
                      <span className="text-xs text-gray-400">PDF, images — max 3 Mo chacun</span>
                    </div>
                    <label className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                      <Upload className="w-4 h-4" />
                      Ajouter des fichiers
                      <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden" onChange={handleNewEquipDocAdd} />
                    </label>
                    {newEquipDocs.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {newEquipDocs.map((d, i) => (
                          <div key={i} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
                            <File className="w-4 h-4 text-gray-400 shrink-0" />
                            <span className="text-xs text-gray-700 truncate flex-1">{d.file.name}</span>
                            <span className="text-xs text-gray-400">{formatFileSize(d.file.size)}</span>
                            <input
                              type="text"
                              placeholder="Description…"
                              value={d.description}
                              onChange={(e) => setNewEquipDocs((prev) => prev.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
                              className="text-xs border border-gray-200 rounded px-2 py-1 w-36"
                            />
                            <button onClick={() => setNewEquipDocs((prev) => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); resetForm(); setNewEquipDocs([]); }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={uploadingDocs}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
                  >
                    {uploadingDocs ? 'Upload…' : editingId !== null ? 'Modifier' : 'Ajouter'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showDetailsModal && selectedEquipment && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowDetailsModal(false)}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{selectedEquipment.name}</h3>
                  <p className="text-xs text-gray-500">{selectedEquipment.brand} {selectedEquipment.model} · {selectedEquipment.serialNumber}</p>
                </div>
                <button onClick={() => setShowDetailsModal(false)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
              </div>

              {/* Tabs */}
              <div className="flex border-b px-6">
                {([['info', 'Informations', Info], ['transfers', 'Transferts', ArrowRightLeft], ['documents', 'Documents', FileText]] as const).map(([tab, label, Icon]) => (
                  <button key={tab} onClick={() => {
                    setDetailsTab(tab);
                    if (tab === 'documents' && equipmentDocs.length === 0) fetchDocuments(selectedEquipment.id);
                    if (tab === 'transfers' && transferHistory.length === 0) fetchTransferHistory(selectedEquipment.id);
                  }}
                    className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition ${detailsTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    <Icon className="w-4 h-4" />{label}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-6 py-4">

                {/* ── Infos ── */}
                {detailsTab === 'info' && (
                  <div className="space-y-2 text-sm text-gray-700">
                    {[
                      ['Type', equipmentTypes.find((t) => t.value === selectedEquipment.type)?.label],
                      ['Quantité', String(selectedEquipment.quantity ?? 1)],
                      ['Localisation', selectedEquipment.location],
                      ['Département', selectedEquipment.department],
                      ['Statut', selectedEquipment.status],
                      ['Adresse IP', selectedEquipment.ipAddress || 'N/A'],
                      ['N° de série', selectedEquipment.serialNumber],
                      ['Date d\'achat', selectedEquipment.purchaseDate || 'N/A'],
                      ['Garantie', selectedEquipment.warranty || 'N/A'],
                      ['Dernière maintenance', selectedEquipment.lastMaintenance || 'N/A'],
                    ].map(([label, value]) => (
                      <div key={label} className="flex gap-2">
                        <span className="font-semibold w-44 shrink-0 text-gray-600">{label}</span>
                        <span>{value}</span>
                      </div>
                    ))}
                    {selectedEquipment.visited && (
                      <div className="border-t pt-3 mt-3 space-y-1">
                        <div className="flex gap-2"><span className="font-semibold w-44 shrink-0 text-gray-600">Technicien</span><span>{selectedEquipment.technicianName}</span></div>
                        {selectedEquipment.visitDate && <div className="flex gap-2"><span className="font-semibold w-44 shrink-0 text-gray-600">Date visite</span><span>{new Date(selectedEquipment.visitDate).toLocaleDateString('fr-FR', { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' })}</span></div>}
                        {selectedEquipment.interventionDetails && <div className="mt-2 p-3 bg-gray-50 rounded-lg"><p className="text-xs font-semibold text-gray-500 mb-1">Intervention</p><p>{selectedEquipment.interventionDetails}</p></div>}
                      </div>
                    )}
                    {/* Replacement info */}
                    {(() => {
                      const replacedBy = selectedEquipment.replacedById
                        ? equipments.find(e => e.id === selectedEquipment.replacedById)
                        : null;
                      const replaces = equipments.find(e => e.replacedById === selectedEquipment.id);
                      return (
                        <>
                          {selectedEquipment.status === 'réformé' && (
                            <div className="mt-3 p-3 rounded-lg bg-purple-50 border border-purple-200 text-sm">
                              <p className="font-semibold text-purple-700 flex items-center gap-1"><Archive className="w-4 h-4" /> Équipement réformé (mis au rebut)</p>
                              {replacedBy && <p className="text-purple-600 mt-1">Remplacé par : <span className="font-medium">{replacedBy.name}</span></p>}
                            </div>
                          )}
                          {replaces && (
                            <div className="mt-3 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm">
                              <p className="text-blue-700">Remplace l'ancien équipement : <span className="font-medium">{replaces.name}</span> <span className="text-blue-400">(réformé)</span></p>
                            </div>
                          )}
                        </>
                      );
                    })()}
                    {canModify && selectedEquipment.status !== 'réformé' && (
                      <div className="pt-3 border-t flex gap-2">
                        <button onClick={() => openTransferModal(selectedEquipment)} className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700">
                          <ArrowRightLeft className="w-4 h-4" /> Transférer
                        </button>
                        <button onClick={() => { setSelectedEquipment(null); openReformModal(selectedEquipment); }} className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          <Archive className="w-4 h-4" /> Réformer
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Transferts ── */}
                {detailsTab === 'transfers' && (
                  <div>
                    {transfersLoading ? <p className="text-center py-10 text-gray-400">Chargement…</p> : transferHistory.length === 0 ? (
                      <div className="text-center py-10 text-gray-400">
                        <ArrowRightLeft className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p>Aucun transfert enregistré.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {transferHistory.map((ev) => (
                          <div key={ev.id} className="flex gap-3 rounded-lg border border-purple-100 bg-purple-50 p-3">
                            <ArrowRightLeft className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                            <div className="text-sm">
                              <p className="font-medium text-gray-800">{ev.details}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(ev.createdAt).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                                {ev.technician && ` · Technicien : ${ev.technician}`}
                                {` · Par ${ev.userName}`}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Documents ── */}
                {detailsTab === 'documents' && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm text-gray-500">{equipmentDocs.length} document(s)</p>
                      <label className="inline-flex items-center gap-2 cursor-pointer rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700">
                        <Upload className="w-4 h-4" /> Ajouter
                        <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp" className="hidden" onChange={async (e) => {
                          const files = Array.from(e.target.files || []);
                          for (const f of files) {
                            if (f.size > 3 * 1024 * 1024) { alert(`${f.name} dépasse 3 Mo.`); continue; }
                            const doc = await handleDocumentUpload(selectedEquipment.id, f, '');
                            if (doc) setEquipmentDocs((prev) => [...prev, doc]);
                          }
                          e.target.value = '';
                        }} />
                      </label>
                    </div>
                    {docsLoading ? <p className="text-center py-10 text-gray-400">Chargement…</p> : equipmentDocs.length === 0 ? (
                      <div className="text-center py-10 text-gray-400">
                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p>Aucun document attaché.</p>
                        <p className="text-xs mt-1">Ajoutez des reçus, factures ou bons de livraison.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {equipmentDocs.map((doc) => (
                          <div key={doc.id} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                            <File className="w-5 h-5 text-blue-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{doc.filename}</p>
                              <p className="text-xs text-gray-500">{formatFileSize(doc.fileSize)} · {doc.uploadedBy} · {new Date(doc.uploadedAt).toLocaleDateString('fr-FR')}</p>
                              {doc.description && <p className="text-xs text-gray-400 italic">{doc.description}</p>}
                            </div>
                            <button onClick={() => downloadDocument(doc.id)} className="text-blue-600 hover:text-blue-800 p-1" title="Télécharger">
                              <Download className="w-4 h-4" />
                            </button>
                            {canModify && (
                              <button onClick={() => handleDeleteDocument(doc.id)} className="text-red-400 hover:text-red-600 p-1" title="Supprimer">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end px-6 py-4 border-t">
                <button onClick={() => setShowDetailsModal(false)} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm">Fermer</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Maintenance module ───────────────────────────────────────────── */}
      {showMaintenanceModule && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50" onClick={() => { setShowMaintenanceModule(false); setShowMaintenanceForm(false); setSelectedMaintenance(null); }}>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-6xl mx-4 flex flex-col" style={{ maxHeight: '92vh' }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
              <div className="flex items-center gap-3">
                <Wrench className="w-5 h-5 text-orange-600" />
                <h2 className="text-lg font-bold text-gray-900">Module Maintenance</h2>
                <span className="text-sm text-gray-500">{maintenanceRecords.filter(m => m.status !== 'résolu').length} ticket(s) actif(s)</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setMaintForm(defaultMaintenanceForm); setMaintenanceEditId(null); setShowMaintenanceForm(true); setSelectedMaintenance(null); }}
                  className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm text-white hover:bg-orange-700">
                  <Plus className="w-4 h-4" /> Nouveau ticket
                </button>
                <button onClick={() => { setShowMaintenanceModule(false); setShowMaintenanceForm(false); setSelectedMaintenance(null); }} className="text-gray-400 hover:text-gray-700 text-xl ml-2">✕</button>
              </div>
            </div>

            {/* Stats bar */}
            <div className="grid grid-cols-3 gap-4 px-6 py-3 bg-gray-50 border-b shrink-0">
              {[
                { label: 'Ouverts', status: 'ouvert', color: 'text-red-600', bg: 'bg-red-100' },
                { label: 'En cours', status: 'en_cours', color: 'text-yellow-600', bg: 'bg-yellow-100' },
                { label: 'Résolus', status: 'résolu', color: 'text-green-600', bg: 'bg-green-100' },
              ].map(({ label, status, color, bg }) => (
                <button key={status} onClick={() => { const f = maintenanceFilter === status ? 'all' : status; setMaintenanceFilter(f); fetchMaintenance(f); }}
                  className={`flex items-center justify-between rounded-lg px-4 py-2 ${maintenanceFilter === status ? bg + ' ring-2 ring-offset-1 ' + color.replace('text', 'ring') : 'bg-white border border-gray-200'} transition`}>
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                  <span className={`text-xl font-bold ${color}`}>{maintenanceRecords.filter(m => m.status === status).length}</span>
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="flex flex-1 overflow-hidden">

              {/* List */}
              <div className={`${selectedMaintenance || showMaintenanceForm ? 'w-2/5 border-r' : 'w-full'} overflow-y-auto`}>
                {maintenanceLoading ? (
                  <div className="text-center py-12 text-gray-400">Chargement…</div>
                ) : maintenanceRecords.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <Wrench className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">Aucun ticket de maintenance</p>
                    <p className="text-sm mt-1">Cliquez sur "Nouveau ticket" pour en créer un.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {maintenanceRecords.map(ticket => (
                      <div key={ticket.id} onClick={() => { setSelectedMaintenance(ticket); setShowMaintenanceForm(false); setShowNoteForm(false); setNoteText(''); }}
                        className={`p-4 cursor-pointer hover:bg-gray-50 transition ${selectedMaintenance?.id === ticket.id ? 'bg-orange-50 border-l-4 border-orange-500' : ''}`}>
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${maintenanceStatusStyle[ticket.status]}`}>
                              {ticket.status === 'ouvert' ? 'Ouvert' : ticket.status === 'en_cours' ? 'En cours' : 'Résolu'}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${maintenancePriorityStyle[ticket.priority]}`}>
                              {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400 shrink-0">#{ticket.id}</span>
                        </div>
                        <p className="text-sm font-medium text-gray-800 line-clamp-2">{ticket.failureDesc}</p>
                        {ticket.equipmentName && <p className="text-xs text-gray-500 mt-1 flex items-center gap-1"><Monitor className="w-3 h-3" />{ticket.equipmentName}</p>}
                        <p className="text-xs text-gray-400 mt-1">{fmtDate(ticket.openedAt)} · {ticket.openedBy}</p>
                      </div>
                    ))}
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
                          {selectedMaintenance.status === 'ouvert' ? 'Ouvert' : selectedMaintenance.status === 'en_cours' ? 'En cours' : 'Résolu'}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${maintenancePriorityStyle[selectedMaintenance.priority]}`}>
                          {selectedMaintenance.priority}
                        </span>
                        <span className="text-xs text-gray-400">Ticket #{selectedMaintenance.id}</span>
                      </div>
                      {selectedMaintenance.equipmentName && (
                        <p className="text-sm text-gray-500 flex items-center gap-1"><Monitor className="w-3.5 h-3.5" />{selectedMaintenance.equipmentName} · {selectedMaintenance.department}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {selectedMaintenance.status === 'résolu' && (
                        <span className="text-xs px-3 py-1.5 rounded-lg bg-green-50 border border-green-200 text-green-700 flex items-center gap-1 font-medium">
                          <CheckCircle className="w-3.5 h-3.5" /> Résolu — lecture seule
                        </span>
                      )}
                      {canWrite && selectedMaintenance.status !== 'résolu' && (
                        <button onClick={() => { setMaintForm({ equipmentId: selectedMaintenance.equipmentId, failureDesc: selectedMaintenance.failureDesc, diagnosis: selectedMaintenance.diagnosis, solution: selectedMaintenance.solution, partsReplaced: selectedMaintenance.partsReplaced, technician: selectedMaintenance.technician, priority: selectedMaintenance.priority, status: selectedMaintenance.status }); setMaintenanceEditId(selectedMaintenance.id); setShowMaintenanceForm(true); }}
                          className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center gap-1">
                          <Edit className="w-3.5 h-3.5" /> Modifier
                        </button>
                      )}
                      <button onClick={() => { setShowNoteForm(v => !v); setNoteText(''); }}
                        className="text-xs px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 flex items-center gap-1">
                        <Edit className="w-3.5 h-3.5" /> Nouvelle information
                      </button>
                      {canModify && selectedMaintenance.status !== 'résolu' && (
                        <button onClick={() => handleDeleteMaintenance(selectedMaintenance.id)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-1">
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

                    {/* Notes / informations complémentaires */}
                    {(selectedMaintenance.notes || showNoteForm) && (
                      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Edit className="w-4 h-4 text-blue-500" />
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
                              className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none"
                            />
                            <div className="flex gap-2">
                              <button
                                disabled={noteLoading || !noteText.trim()}
                                onClick={async () => {
                                  if (!noteText.trim()) return;
                                  setNoteLoading(true);
                                  try {
                                    const r = await fetch(`${API_BASE_URL}/api/maintenance/${selectedMaintenance.id}/note`, {
                                      method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ text: noteText })
                                    });
                                    if (r.ok) {
                                      const updated = await r.json();
                                      setMaintenanceRecords(p => p.map(m => m.id === updated.id ? updated : m));
                                      setSelectedMaintenance(updated);
                                      setNoteText('');
                                      setShowNoteForm(false);
                                    }
                                  } catch {}
                                  setNoteLoading(false);
                                }}
                                className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                              >
                                {noteLoading ? 'Enregistrement…' : 'Enregistrer'}
                              </button>
                              <button onClick={() => { setShowNoteForm(false); setNoteText(''); }}
                                className="px-4 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
                                Annuler
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Quick status change */}
                  {canWrite && selectedMaintenance.status !== 'résolu' && (
                    <div className="mt-4 pt-4 border-t flex gap-2">
                      {selectedMaintenance.status === 'ouvert' && (
                        <button onClick={async () => { const r = await fetch(`${API_BASE_URL}/api/maintenance/${selectedMaintenance.id}`, { method:'PUT', headers: authHeaders(), body: JSON.stringify({ status: 'en_cours' }) }); if(r.ok) { const u = await r.json(); setMaintenanceRecords(p=>p.map(m=>m.id===u.id?u:m)); setSelectedMaintenance(u); fetchEquipments(); } }}
                          className="flex-1 py-2 rounded-lg bg-yellow-500 text-white text-sm font-medium hover:bg-yellow-600">
                          Démarrer la réparation
                        </button>
                      )}
                      <button onClick={() => { setMaintForm({ equipmentId: selectedMaintenance.equipmentId, failureDesc: selectedMaintenance.failureDesc, diagnosis: selectedMaintenance.diagnosis, solution: selectedMaintenance.solution, partsReplaced: selectedMaintenance.partsReplaced, technician: selectedMaintenance.technician, priority: selectedMaintenance.priority, status: 'résolu' }); setMaintenanceEditId(selectedMaintenance.id); setShowMaintenanceForm(true); }}
                        className="flex-1 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700">
                        Marquer comme résolu
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Form panel */}
              {showMaintenanceForm && (
                <div className="flex-1 overflow-y-auto p-6">
                  <h3 className="text-base font-bold text-gray-800 mb-4">{maintenanceEditId ? 'Modifier le ticket' : 'Nouveau ticket de maintenance'}</h3>
                  <div className="space-y-4">
                    {!maintenanceEditId && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Équipement concerné</label>
                        <select value={maintenanceForm.equipmentId ?? ''} onChange={e => setMaintForm(f => ({ ...f, equipmentId: e.target.value ? Number(e.target.value) : null }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400">
                          <option value="">— Sélectionner un équipement —</option>
                          {equipments.map(eq => <option key={eq.id} value={eq.id}>{eq.name} ({eq.location})</option>)}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Priorité</label>
                      <select value={maintenanceForm.priority} onChange={e => setMaintForm(f => ({ ...f, priority: e.target.value as MaintenancePriority }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400">
                        <option value="faible">Faible</option>
                        <option value="normale">Normale</option>
                        <option value="haute">Haute</option>
                        <option value="critique">Critique</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description de la panne *</label>
                      <textarea rows={3} value={maintenanceForm.failureDesc} onChange={e => setMaintForm(f => ({ ...f, failureDesc: e.target.value }))}
                        placeholder="Décrivez le problème observé…" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Diagnostic</label>
                      <textarea rows={3} value={maintenanceForm.diagnosis} onChange={e => setMaintForm(f => ({ ...f, diagnosis: e.target.value }))}
                        placeholder="Cause identifiée du problème…" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Solution / Réparation effectuée</label>
                      <textarea rows={3} value={maintenanceForm.solution} onChange={e => setMaintForm(f => ({ ...f, solution: e.target.value }))}
                        placeholder="Actions effectuées pour résoudre le problème…" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Pièces remplacées</label>
                      <input type="text" value={maintenanceForm.partsReplaced} onChange={e => setMaintForm(f => ({ ...f, partsReplaced: e.target.value }))}
                        placeholder="Ex: Disque dur, Alimentation, RAM…" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Technicien responsable</label>
                      <input type="text" value={maintenanceForm.technician} onChange={e => setMaintForm(f => ({ ...f, technician: e.target.value }))}
                        placeholder="Nom du technicien" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400" />
                    </div>
                    {maintenanceEditId && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                        <select value={maintenanceForm.status} onChange={e => setMaintForm(f => ({ ...f, status: e.target.value as MaintenanceStatus }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-400">
                          <option value="ouvert">Ouvert</option>
                          <option value="en_cours">En cours</option>
                          <option value="résolu">Résolu</option>
                        </select>
                      </div>
                    )}
                    <div className="flex gap-3 pt-2">
                      <button onClick={() => { setShowMaintenanceForm(false); setMaintenanceEditId(null); }}
                        className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Annuler</button>
                      <button onClick={handleSaveMaintenance}
                        className="flex-1 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700">
                        {maintenanceEditId ? 'Enregistrer' : 'Créer le ticket'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ Module Transferts ════════════════════════════════════════════ */}
      {showTransferModule && (
        <div className="fixed inset-0 z-40 flex flex-col bg-gray-50">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                <ArrowRightLeft className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Module Transferts</h2>
                <p className="text-sm text-gray-500">{allTransfers.length} transfert(s) enregistré(s)</p>
              </div>
            </div>
            <button onClick={() => setShowTransferModule(false)} className="p-2 rounded-lg hover:bg-gray-100">
              <XCircle className="w-6 h-6 text-gray-500" />
            </button>
          </div>

          {/* Stats */}
          <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 shrink-0">
            {[
              { label: 'Total transferts', value: allTransfers.length, color: 'purple' },
              { label: 'Ce mois', value: allTransfers.filter(t => new Date(t.createdAt) > new Date(Date.now() - 30*24*3600*1000)).length, color: 'blue' },
              { label: 'Services touchés', value: new Set(allTransfers.map(t => t.department)).size, color: 'green' },
              { label: 'Équipements déplacés', value: new Set(allTransfers.map(t => t.equipmentId)).size, color: 'orange' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
                <div className={`text-2xl font-bold text-${color}-600`}>{value}</div>
                <div className="text-xs text-gray-500 mt-1">{label}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="px-6 pb-4 flex flex-wrap gap-3 shrink-0">
            <select
              value={transferModuleFilter.department}
              onChange={e => setTransferModuleFilter(f => ({ ...f, department: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-400"
            >
              <option value="">Tous les services</option>
              {[...new Set(equipments.map(e => e.department).filter(Boolean))].sort().map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <input type="date" value={transferModuleFilter.from}
              onChange={e => setTransferModuleFilter(f => ({ ...f, from: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-400" />
            <input type="date" value={transferModuleFilter.to}
              onChange={e => setTransferModuleFilter(f => ({ ...f, to: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-400" />
            <button onClick={() => { setTransferModuleFilter({ department: '', from: '', to: '' }); }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 flex items-center gap-2">
              <RefreshCcw className="w-4 h-4" /> Réinitialiser
            </button>
            {canModify && (
              <button
                onClick={() => {
                  setTransferTarget(null);
                  setTransferForm({ toLocation: '', toDepartment: '', toSiteId: null, reason: 'Réorganisation', technicianName: '', notes: '', transferQty: 1 });
                  setShowTransferModal(true);
                }}
                className="ml-auto px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Nouveau transfert
              </button>
            )}
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto px-6 pb-6">
            {transferModuleLoading ? (
              <div className="flex items-center justify-center h-40 text-gray-400">Chargement…</div>
            ) : allTransfers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                <ArrowRightLeft className="w-10 h-10 mb-2 opacity-30" />
                <p>Aucun transfert trouvé.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['Date', 'Équipement', 'Type', 'De', 'Vers', 'Technicien'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {allTransfers.map(ev => {
                      const { fromLocation, toLocation, fromDept, toDept, fromSiteName, toSiteName, siteChanged } = getTransferLocations(ev);
                      const locationChanged = fromLocation !== toLocation || fromDept !== toDept;
                      return (
                        <tr key={ev.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                            {new Date(ev.createdAt).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' })}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-medium text-gray-900">{ev.equipmentName}</span>
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
                            {siteChanged && fromSiteName && <p className="text-xs text-blue-600 font-medium">{fromSiteName}</p>}
                            <span className="font-medium">{fromLocation}</span>
                            {fromDept && <span className="text-gray-400"> · {fromDept}</span>}
                          </td>
                          <td className="px-4 py-3">
                            {siteChanged && toSiteName && <p className="text-xs text-blue-600 font-medium flex items-center gap-1"><ArrowRightLeft className="w-3 h-3" />{toSiteName}</p>}
                            <span className="inline-flex items-center gap-1 font-medium text-purple-700">
                              <ArrowRightLeft className="w-3 h-3" /> {toLocation}
                            </span>
                            {toDept && <span className="text-gray-400 ml-1">· {toDept}</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{ev.technician || ev.userName}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ Modale Gestion des Sites ════════════════════════════════════ */}
      {showSiteModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50" onClick={() => setShowSiteModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Gestion des sites</h2>
              </div>
              <button onClick={() => setShowSiteModal(false)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
            </div>

            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
              {/* Liste des sites */}
              <div className="flex-1 overflow-y-auto p-4 border-r border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{sites.length} site(s)</p>
                {sites.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <Globe className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Aucun site créé.</p>
                  </div>
                )}
                <div className="space-y-2">
                  {sites.map(site => (
                    <div key={site.id} className={`rounded-xl border p-3 transition-colors cursor-pointer ${editingSiteId === site.id ? 'border-blue-400 bg-blue-50' : 'border-gray-100 hover:bg-gray-50'}`}
                      onClick={() => { setEditingSiteId(site.id); setSiteForm({ name: site.name, city: site.city, country: site.country, address: site.address, description: site.description }); }}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{site.name}</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3" />{site.city}{site.country ? `, ${site.country}` : ''}
                          </p>
                          {site.address && <p className="text-xs text-gray-400 mt-0.5">{site.address}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-blue-600 font-medium">{site.equipmentCount} équip.</span>
                          <button onClick={e => { e.stopPropagation(); handleDeleteSite(site.id); }}
                            className="text-red-400 hover:text-red-600" title="Supprimer">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Formulaire */}
              <div className="w-full md:w-72 p-4 shrink-0">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  {editingSiteId ? 'Modifier le site' : 'Nouveau site'}
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Nom du site *</label>
                    <input type="text" value={siteForm.name} onChange={e => setSiteForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Ex: Siège Paris" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Ville</label>
                      <input type="text" value={siteForm.city} onChange={e => setSiteForm(f => ({ ...f, city: e.target.value }))}
                        placeholder="Paris" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Pays</label>
                      <input type="text" value={siteForm.country} onChange={e => setSiteForm(f => ({ ...f, country: e.target.value }))}
                        placeholder="France" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Adresse</label>
                    <input type="text" value={siteForm.address} onChange={e => setSiteForm(f => ({ ...f, address: e.target.value }))}
                      placeholder="12 rue de la Paix" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                    <textarea rows={2} value={siteForm.description} onChange={e => setSiteForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Informations complémentaires…" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400" />
                  </div>
                  <div className="flex gap-2 pt-1">
                    {editingSiteId && (
                      <button onClick={() => { setEditingSiteId(null); setSiteForm(defaultSiteForm); }}
                        className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
                        Annuler
                      </button>
                    )}
                    <button onClick={handleSaveSite} disabled={siteLoading || !siteForm.name.trim()}
                      className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                      {siteLoading && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                      {editingSiteId ? 'Enregistrer' : 'Créer le site'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modale Réforme ═══════════════════════════════════════════════ */}
      {showReformModal && reformTarget && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowReformModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                <Archive className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Réformer l'équipement</h3>
                <p className="text-sm text-gray-500">{reformTarget.name}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                {(reformTarget.quantity ?? 1) > 1 && reformForm.reformQty < (reformTarget.quantity ?? 1)
                  ? <><strong>{reformForm.reformQty}</strong> unité(s) seront réformées. Il restera <strong>{(reformTarget.quantity ?? 1) - reformForm.reformQty}</strong> unité(s) en stock.</>
                  : <>Cet équipement sera marqué comme <strong>réformé (mis au rebut)</strong> et ne pourra plus être transféré ni mis en maintenance.</>
                }
              </div>

              {(reformTarget.quantity ?? 1) > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantité à réformer <span className="text-gray-400 font-normal">(stock : {reformTarget.quantity})</span>
                  </label>
                  <input type="number" min={1} max={reformTarget.quantity}
                    value={reformForm.reformQty}
                    onChange={e => setReformForm(f => ({ ...f, reformQty: Math.min(Math.max(1, parseInt(e.target.value) || 1), reformTarget.quantity ?? 1) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-400" />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Raison de la réforme *</label>
                <select value={reformForm.reason} onChange={e => setReformForm(f => ({ ...f, reason: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-400">
                  <option value="">— Sélectionner —</option>
                  <option>Fin de vie / obsolescence</option>
                  <option>Défaillance irréparable</option>
                  <option>Casse / sinistre</option>
                  <option>Vol / perte</option>
                  <option>Remplacement planifié</option>
                  <option>Autre</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Remplacé par un équipement existant</label>
                <select value={reformForm.replacedById ?? ''} onChange={e => setReformForm(f => ({ ...f, replacedById: e.target.value ? Number(e.target.value) : null }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-400">
                  <option value="">— Aucun remplacement ou non encore enregistré —</option>
                  {equipments.filter(e => e.id !== reformTarget.id && e.status !== 'réformé').map(e => (
                    <option key={e.id} value={e.id}>{e.name} — {e.location}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes complémentaires</label>
                <textarea rows={2} value={reformForm.notes} onChange={e => setReformForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Informations supplémentaires…"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-400" />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowReformModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm">Annuler</button>
              <button onClick={handleReform} disabled={reformLoading || !reformForm.reason}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 text-sm disabled:opacity-50 flex items-center gap-2">
                {reformLoading && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <Archive className="w-4 h-4" /> Confirmer la réforme
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Transfer modal ───────────────────────────────────────────────── */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowTransferModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-5">
              <ArrowRightLeft className="w-5 h-5 text-purple-600" />
              <h3 className="text-lg font-bold text-gray-900">Transfert d'équipement</h3>
            </div>

            {/* Sélecteur d'équipement (quand ouvert depuis le module) */}
            {!transferTarget ? (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Équipement à transférer *</label>
                <select
                  defaultValue=""
                  onChange={e => {
                    const eq = equipments.find(x => x.id === Number(e.target.value)) ?? null;
                    if (eq) {
                      setTransferTarget(eq);
                      setTransferForm(f => ({ ...f, toLocation: eq.location, toDepartment: eq.department, toSiteId: eq.siteId ?? null }));
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 text-sm"
                >
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
              {/* ── Site destination ── */}
              <div className="rounded-xl border-2 border-purple-100 bg-purple-50 p-3">
                <label className="block text-sm font-semibold text-purple-800 mb-2 flex items-center gap-1.5">
                  <Globe className="w-4 h-4" />Site de destination
                </label>
                {sites.length === 0 ? (
                  <p className="text-xs text-purple-500 italic">Aucun site configuré — configurez des sites dans le menu Administration.</p>
                ) : (
                  <select value={transferForm.toSiteId ?? ''}
                    onChange={e => setTransferForm({ ...transferForm, toSiteId: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent text-sm bg-white">
                    <option value="">— Même site / Sans site —</option>
                    {sites.map(s => (
                      <option key={s.id} value={s.id}>{s.name}{s.city ? ` — ${s.city}` : ''}{s.country ? `, ${s.country}` : ''}</option>
                    ))}
                  </select>
                )}
                {transferForm.toSiteId && (() => {
                  const dest = sites.find(s => s.id === transferForm.toSiteId);
                  const src = transferTarget ? sites.find(s => s.id === transferTarget.siteId) : null;
                  return dest ? (
                    <p className="text-xs text-purple-600 mt-1.5 font-medium">
                      {src ? `${src.name}` : 'Sans site'} → {dest.name}
                    </p>
                  ) : null;
                })()}
              </div>
              {/* ── Bureau / localisation ── */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Building2 className="inline w-3.5 h-3.5 mr-1 text-purple-500" />Nouveau bureau / localisation *
                </label>
                <input type="text" value={transferForm.toLocation}
                  onChange={(e) => setTransferForm({ ...transferForm, toLocation: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent text-sm"
                  placeholder="Ex: Bureau 301, Salle serveurs…" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau département *</label>
                <input type="text" value={transferForm.toDepartment}
                  onChange={(e) => setTransferForm({ ...transferForm, toDepartment: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent text-sm"
                  placeholder="Ex: Comptabilité, RH…" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Raison du transfert</label>
                <select value={transferForm.reason}
                  onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent text-sm">
                  <option>Réorganisation</option>
                  <option>Transfert de site</option>
                  <option>Maintenance</option>
                  <option>Demande du service</option>
                  <option>Remplacement</option>
                  <option>Autre</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Technicien responsable</label>
                <input type="text" value={transferForm.technicianName}
                  onChange={(e) => setTransferForm({ ...transferForm, technicianName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent text-sm"
                  placeholder="Nom du technicien" />
              </div>
              {transferTarget && (transferTarget.quantity ?? 1) > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantité à transférer <span className="text-gray-400 font-normal">(stock : {transferTarget.quantity})</span>
                  </label>
                  <input type="number" min={1} max={transferTarget.quantity}
                    value={transferForm.transferQty}
                    onChange={e => setTransferForm({ ...transferForm, transferQty: Math.min(Math.max(1, parseInt(e.target.value) || 1), transferTarget.quantity) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent text-sm" />
                  {transferForm.transferQty < (transferTarget.quantity ?? 1) && (
                    <p className="text-xs text-purple-600 mt-1">Transfert partiel — {transferTarget.quantity - transferForm.transferQty} unité(s) resteront sur le site actuel.</p>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optionnel)</label>
                <textarea value={transferForm.notes}
                  onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-400 focus:border-transparent text-sm"
                  placeholder="Informations complémentaires…" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowTransferModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm">Annuler</button>
              <button onClick={handleTransfer} disabled={transferLoading || !transferTarget}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm disabled:opacity-60 flex items-center gap-2">
                {transferLoading && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <ArrowRightLeft className="w-4 h-4" /> Confirmer le transfert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reports modal ────────────────────────────────────────────────── */}
      {showReportsModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50" onClick={() => setShowReportsModal(false)}>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl mx-4 flex flex-col" style={{ maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-bold text-gray-900">Module Rapports</h2>
              </div>
              <button onClick={() => setShowReportsModal(false)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 shrink-0 px-6">
              {([['equipment','Parcours équipement'],['date','Par date'],['department','Par service'],['user','Par utilisateur']] as const).map(([tab, label]) => (
                <button key={tab} onClick={() => { setReportsTab(tab); if (tab === 'user' && reportUserStats.length === 0) fetchReportByUser(); }}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${reportsTab === tab ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto flex-1 p-6">

              {/* ── Tab 1: Parcours équipement ── */}
              {reportsTab === 'equipment' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <select
                      value={reportEquipmentId}
                      onChange={e => {
                        const id = Number(e.target.value);
                        setReportEquipmentId(id || '');
                        setReportHistory([]);
                        if (id) fetchReportHistory(id);
                      }}
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    >
                      <option value="">— Sélectionner un équipement —</option>
                      {equipments.map(eq => (
                        <option key={eq.id} value={eq.id}>{eq.name} ({eq.brand} {eq.model})</option>
                      ))}
                    </select>
                    {reportHistory.length > 0 && (
                      <div className="flex gap-2 ml-auto">
                        <button onClick={() => exportReportExcel(`Parcours ${reportHistory[0]?.equipmentName}`, reportHistory)}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                          <Download className="w-3.5 h-3.5 text-green-600" /> Excel
                        </button>
                        <button onClick={() => exportReportPdf(`Parcours — ${reportHistory[0]?.equipmentName}`, reportHistory)}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                          <Download className="w-3.5 h-3.5 text-red-500" /> PDF
                        </button>
                      </div>
                    )}
                  </div>

                  {reportHistoryLoading && <div className="text-center py-12 text-gray-400">Chargement…</div>}

                  {!reportHistoryLoading && reportEquipmentId && reportHistory.length === 0 && (
                    <div className="text-center py-12 text-gray-400">Aucun événement enregistré pour cet équipement.</div>
                  )}

                  {reportHistory.length > 0 && (() => {
                    const eq = equipments.find(e => e.id === reportEquipmentId);
                    return (
                      <div>
                        {/* Equipment card */}
                        {eq && (
                          <div className="mb-5 rounded-xl border border-indigo-100 bg-indigo-50 p-4 flex flex-wrap gap-4 text-sm">
                            <div><span className="font-semibold text-indigo-800">{eq.name}</span> <span className="text-indigo-500">·</span> {eq.brand} {eq.model}</div>
                            <div className="text-indigo-600">S/N: {eq.serialNumber || '—'}</div>
                            <div className="text-indigo-600">IP: {eq.ipAddress || '—'}</div>
                            <div className="text-indigo-600">Dept: {eq.department}</div>
                            <div className="text-indigo-600">Statut: <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${statusColors[eq.status]}`}>{eq.status}</span></div>
                            <div className="text-indigo-600">{reportHistory.length} événement(s)</div>
                          </div>
                        )}

                        {/* Timeline */}
                        <div className="relative pl-6 space-y-0">
                          <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-200" />
                          {reportHistory.map((ev, i) => {
                            const style = getEventActionStyle(ev.action);
                            return (
                              <div key={ev.id} className="relative pb-6">
                                <div className={`absolute -left-4 mt-1 w-3 h-3 rounded-full ring-2 ring-white ${style.dot}`} />
                                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                                  <div className="flex flex-wrap items-center gap-2 mb-2">
                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${style.badge}`}>{ev.action}</span>
                                    <span className="text-xs text-gray-400">{new Date(ev.createdAt).toLocaleString('fr-FR')}</span>
                                    {ev.technician && <span className="text-xs text-gray-500">Technicien: <strong>{ev.technician}</strong></span>}
                                    <span className="text-xs text-gray-400 ml-auto">par {ev.userName} ({ev.username})</span>
                                  </div>
                                  <p className="text-sm text-gray-700">{ev.details}</p>
                                  {ev.changes.length > 0 && (
                                    <div className="mt-3 space-y-1">
                                      {ev.changes.map((ch, j) => (
                                        <div key={j} className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded px-2 py-1">
                                          <span className="font-medium text-gray-700">{FIELD_LABELS[ch.field] ?? ch.field}</span>
                                          <span className="line-through text-gray-400">{String(ch.from)}</span>
                                          <span className="text-gray-400">→</span>
                                          <span className="font-medium text-gray-800">{String(ch.to)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* ── Tab 2: Par date ── */}
              {reportsTab === 'date' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-end gap-3 bg-gray-50 rounded-xl p-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Du</label>
                      <input type="date" value={reportDateFrom} onChange={e => setReportDateFrom(e.target.value)}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Au</label>
                      <input type="date" value={reportDateTo} onChange={e => setReportDateTo(e.target.value)}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Service</label>
                      <select value={reportDeptFilter} onChange={e => setReportDeptFilter(e.target.value)}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                        <option value="">Tous</option>
                        {[...new Set(equipments.map(e => e.department).filter(Boolean))].sort().map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                      <select value={reportTypeFilter} onChange={e => setReportTypeFilter(e.target.value)}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                        <option value="">Tous</option>
                        <option value="ordinateur">Ordinateur</option>
                        <option value="reseau">Réseau</option>
                        <option value="serveur">Serveur</option>
                        <option value="imprimante">Imprimante</option>
                      </select>
                    </div>
                    {reportDateEvents.length > 0 && (
                      <>
                        <button onClick={() => exportReportExcel('Rapport par date', reportDateEvents)}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          <Download className="w-3.5 h-3.5 text-green-600" /> Excel
                        </button>
                        <button onClick={() => exportReportPdf('Rapport par date', reportDateEvents)}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                          <Download className="w-3.5 h-3.5 text-red-500" /> PDF
                        </button>
                      </>
                    )}
                  </div>

                  {reportDateLoading && <div className="text-center py-12 text-gray-400">Chargement…</div>}

                  {!reportDateLoading && reportDateEvents.length === 0 && (
                    <div className="text-center py-12 text-gray-400">Aucun événement trouvé pour ces critères.</div>
                  )}

                  {reportDateEvents.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-500 mb-3">{reportDateEvents.length} événement(s) trouvé(s)</p>
                      <div className="overflow-x-auto rounded-xl border border-gray-100">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                            <tr>
                              <th className="px-4 py-2 text-left">Date</th>
                              <th className="px-4 py-2 text-left">Équipement</th>
                              <th className="px-4 py-2 text-left">Département</th>
                              <th className="px-4 py-2 text-left">Action</th>
                              <th className="px-4 py-2 text-left">Détails</th>
                              <th className="px-4 py-2 text-left">Technicien</th>
                              <th className="px-4 py-2 text-left">Utilisateur</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {reportDateEvents.map(ev => {
                              const style = getEventActionStyle(ev.action);
                              return (
                                <tr key={ev.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">{new Date(ev.createdAt).toLocaleString('fr-FR')}</td>
                                  <td className="px-4 py-2 font-medium text-gray-900">{ev.equipmentName}</td>
                                  <td className="px-4 py-2 text-gray-500">{ev.department}</td>
                                  <td className="px-4 py-2"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${style.badge}`}>{ev.action}</span></td>
                                  <td className="px-4 py-2 text-gray-600 max-w-xs truncate" title={ev.details}>{ev.details}</td>
                                  <td className="px-4 py-2 text-gray-500">{ev.technician || '—'}</td>
                                  <td className="px-4 py-2 text-gray-500">{ev.userName}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Tab 3: Par service ── */}
              {reportsTab === 'department' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-500">Activité globale par service ({reportDeptStats.length} service(s))</p>
                    <div className="flex gap-2">
                      <button onClick={fetchReportByDepartment}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                        <RefreshCcw className="w-3.5 h-3.5" /> Actualiser
                      </button>
                      {reportDeptStats.length > 0 && (
                        <button onClick={() => {
                          const rows = reportDeptStats.map(d => ({
                            'Service': d.department,
                            'Équipements': d.equipment_count,
                            'Total événements': d.total_events,
                            'Créations': d.creations,
                            'Modifications': d.modifications,
                            'Interventions': d.interventions,
                            'Suppressions': d.suppressions,
                            'Dernière activité': d.last_activity ? new Date(d.last_activity).toLocaleString('fr-FR') : '—',
                          }));
                          const ws = XLSX.utils.json_to_sheet(rows);
                          const wb = XLSX.utils.book_new();
                          XLSX.utils.book_append_sheet(wb, ws, 'Par service');
                          XLSX.writeFile(wb, `rapport-services-${Date.now()}.xlsx`);
                        }}
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                          <Download className="w-3.5 h-3.5 text-green-600" /> Excel
                        </button>
                      )}
                    </div>
                  </div>

                  {reportDeptLoading && <div className="text-center py-12 text-gray-400">Chargement…</div>}

                  {!reportDeptLoading && reportDeptStats.length === 0 && (
                    <div className="text-center py-12 text-gray-400">Aucune donnée — les événements s'enregistrent dès la première action sur un équipement.</div>
                  )}

                  {reportDeptStats.length > 0 && (
                    <div className="space-y-3">
                      {reportDeptStats.map(dept => {
                        const maxTotal = Math.max(...reportDeptStats.map(d => Number(d.total_events)));
                        const barWidth = Math.round((Number(dept.total_events) / maxTotal) * 100);
                        return (
                          <div key={dept.department} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-indigo-400" />
                                <span className="font-semibold text-gray-800">{dept.department}</span>
                                <span className="text-xs text-gray-400">{dept.equipment_count} équipement(s)</span>
                              </div>
                              <span className="text-sm font-bold text-indigo-700">{dept.total_events} événements</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
                              <div className="bg-indigo-500 h-2 rounded-full transition-all" style={{ width: `${barWidth}%` }} />
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs">
                              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />{dept.creations} créations</span>
                              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />{dept.interventions} interventions</span>
                              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />{dept.modifications} modifications</span>
                              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />{dept.suppressions} suppressions</span>
                              {dept.last_activity && <span className="ml-auto text-gray-400">Dernière activité: {new Date(dept.last_activity).toLocaleDateString('fr-FR')}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── Tab 4 : Par utilisateur ── */}
              {reportsTab === 'user' && (
                <div className="space-y-4">
                  {/* Filtres */}
                  <div className="flex flex-wrap items-end gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Du</label>
                      <input type="date" value={reportUserFrom} onChange={e => setReportUserFrom(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Au</label>
                      <input type="date" value={reportUserTo} onChange={e => setReportUserTo(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Service</label>
                      <select value={reportUserDeptFilter} onChange={e => setReportUserDeptFilter(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400">
                        <option value="">Tous les services</option>
                        {[...new Set(equipments.map(e => e.department).filter(Boolean))].sort().map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <button onClick={() => { setReportUserFrom(''); setReportUserTo(''); setReportUserDeptFilter(''); }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      <RefreshCcw className="w-3.5 h-3.5" /> Réinitialiser
                    </button>
                    {reportUserStats.length > 0 && (
                      <button onClick={() => {
                        const rows = reportUserStats.map(u => ({
                          'Utilisateur': u.user_name, 'Login': u.username,
                          'Total actions': Number(u.total_actions),
                          'Créations': Number(u.creations), 'Modifications': Number(u.modifications),
                          'Interventions': Number(u.interventions), 'Transferts': Number(u.transferts),
                          'Suppressions': Number(u.suppressions), 'Maintenances': Number(u.maintenances),
                          'Réformes': Number(u.reformes),
                          'Équipements traités': Number(u.equipment_count),
                          'Services touchés': Number(u.dept_count),
                          'Dernière action': u.last_action ? new Date(u.last_action).toLocaleString('fr-FR') : '—',
                        }));
                        const ws = XLSX.utils.json_to_sheet(rows);
                        const wb = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(wb, ws, 'Par utilisateur');
                        XLSX.writeFile(wb, `rapport-utilisateurs-${Date.now()}.xlsx`);
                      }} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                        <Download className="w-3.5 h-3.5 text-green-600" /> Excel
                      </button>
                    )}
                  </div>

                  {reportUserLoading && <div className="text-center py-12 text-gray-400">Chargement…</div>}

                  {!reportUserLoading && reportUserStats.length === 0 && (
                    <div className="text-center py-12 text-gray-400">
                      <User className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p>Aucune donnée disponible pour ces critères.</p>
                    </div>
                  )}

                  {/* Résumé global */}
                  {reportUserStats.length > 0 && (
                    <>
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-center">
                          <div className="text-2xl font-bold text-indigo-700">{reportUserStats.length}</div>
                          <div className="text-xs text-gray-500 mt-0.5">Utilisateur(s) actif(s)</div>
                        </div>
                        <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-center">
                          <div className="text-2xl font-bold text-blue-700">{reportUserStats.reduce((s, u) => s + Number(u.total_actions), 0)}</div>
                          <div className="text-xs text-gray-500 mt-0.5">Actions au total</div>
                        </div>
                        <div className="rounded-xl border border-green-100 bg-green-50 p-3 text-center">
                          <div className="text-2xl font-bold text-green-700">{reportUserStats.reduce((s, u) => s + Number(u.equipment_count), 0)}</div>
                          <div className="text-xs text-gray-500 mt-0.5">Équipements traités</div>
                        </div>
                      </div>

                      {/* Cartes par utilisateur */}
                      <div className="space-y-2">
                        {reportUserStats.map(user => {
                          const total = Number(user.total_actions) || 1;
                          const maxTotal = Math.max(...reportUserStats.map(u => Number(u.total_actions)));
                          const barW = Math.round((Number(user.total_actions) / maxTotal) * 100);
                          const isExpanded = reportUserExpanded === user.username;
                          const pills = [
                            { label: 'Créations',     value: Number(user.creations),     color: 'bg-blue-100 text-blue-700' },
                            { label: 'Modifications', value: Number(user.modifications), color: 'bg-yellow-100 text-yellow-700' },
                            { label: 'Interventions', value: Number(user.interventions), color: 'bg-green-100 text-green-700' },
                            { label: 'Transferts',    value: Number(user.transferts),    color: 'bg-purple-100 text-purple-700' },
                            { label: 'Suppressions',  value: Number(user.suppressions),  color: 'bg-red-100 text-red-700' },
                            { label: 'Maintenance',   value: Number(user.maintenances),  color: 'bg-orange-100 text-orange-700' },
                            { label: 'Réformes',      value: Number(user.reformes),      color: 'bg-gray-100 text-gray-700' },
                          ].filter(p => p.value > 0);

                          return (
                            <div key={user.username} className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                              {/* En-tête utilisateur */}
                              <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                                onClick={() => fetchUserDetail(user.username)}>
                                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                                  <User className="w-5 h-5 text-indigo-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-gray-900">{user.user_name}</span>
                                    <span className="text-xs text-gray-400">@{user.username}</span>
                                    <span className="text-xs text-gray-400">· {user.equipment_count} équipement(s) · {user.dept_count} service(s)</span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                                      <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${barW}%` }} />
                                    </div>
                                    <span className="text-xs font-bold text-indigo-700 shrink-0">{user.total_actions} actions</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5 mt-2">
                                    {pills.map(p => (
                                      <span key={p.label} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${p.color}`}>
                                        {p.value} {p.label}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <div className="text-right text-xs text-gray-400 shrink-0">
                                  {user.last_action && <p>Dernière action<br />{new Date(user.last_action).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' })}</p>}
                                  <ChevronDown className={`w-4 h-4 mx-auto mt-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </div>
                              </div>

                              {/* Détail expandable */}
                              {isExpanded && (
                                <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                                  {reportUserDetailLoading ? (
                                    <p className="text-center py-4 text-gray-400 text-sm">Chargement…</p>
                                  ) : reportUserDetail.length === 0 ? (
                                    <p className="text-center py-4 text-gray-400 text-sm">Aucun événement trouvé.</p>
                                  ) : (
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                      {reportUserDetail.map(ev => {
                                        const st = getEventActionStyle(ev.action);
                                        return (
                                          <div key={ev.id} className="flex items-start gap-3 text-xs bg-white rounded-lg px-3 py-2 border border-gray-100">
                                            <span className={`inline-block w-2 h-2 rounded-full mt-1 shrink-0 ${st.dot}`} />
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`rounded-full px-2 py-0.5 font-medium ${st.badge}`}>{ev.action}</span>
                                                <span className="font-medium text-gray-800">{ev.equipmentName}</span>
                                                {ev.department && <span className="text-gray-400">· {ev.department}</span>}
                                              </div>
                                              <p className="text-gray-500 mt-0.5 truncate">{ev.details}</p>
                                            </div>
                                            <span className="text-gray-400 shrink-0 whitespace-nowrap">
                                              {new Date(ev.createdAt).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ── Monitoring modal ─────────────────────────────────────────────── */}
      {showMonitoringModal && (
        <div
          className="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50"
          onClick={() => setShowMonitoringModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-green-100">
                  <Activity className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Monitoring en temps réel</h2>
                  <p className="text-xs text-gray-500">Actualisation automatique toutes les 10 secondes</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  {monitoringLoading
                    ? <div className="w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                    : <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
                  <span>{monitoringLoading ? 'Actualisation…' : 'En direct'}</span>
                </div>
                <button
                  onClick={refreshMonitoring}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
                >
                  <RefreshCcw className="w-3.5 h-3.5" />
                  Actualiser
                </button>
                <button onClick={() => setShowMonitoringModal(false)} className="text-gray-400 hover:text-gray-700 text-xl leading-none" aria-label="Fermer">✕</button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-6 pt-3 border-b border-gray-100">
              <button
                onClick={() => setMonitoringTab('sessions')}
                className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${monitoringTab === 'sessions' ? 'border-green-500 text-green-700 bg-green-50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                <span className="flex items-center gap-2">
                  <Wifi className="w-4 h-4" />
                  Sessions actives
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${activeSessions.length > 0 ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                    {activeSessions.length}
                  </span>
                </span>
              </button>
              <button
                onClick={() => setMonitoringTab('activities')}
                className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${monitoringTab === 'activities' ? 'border-blue-500 text-blue-700 bg-blue-50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Journal d'activité
                  <span className="rounded-full px-2 py-0.5 text-xs font-bold bg-gray-200 text-gray-600">
                    {activityLogs.length}
                  </span>
                </span>
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">
              {/* ── Sessions tab ── */}
              {monitoringTab === 'sessions' && (
                <div className="p-6">
                  {activeSessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                      <Wifi className="w-12 h-12 mb-3 opacity-30" />
                      <p className="text-sm">Aucune session active pour le moment.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {activeSessions.map((session) => {
                        const online = isOnline(session.lastSeen);
                        const info = roleDisplay[session.role] ?? { label: session.role, classes: 'bg-gray-100 text-gray-700' };
                        return (
                          <div key={session.userId} className={`rounded-xl border-2 p-4 ${online ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                              {/* Identity */}
                              <div className="flex items-center gap-3">
                                <div className={`relative flex items-center justify-center w-11 h-11 rounded-full font-bold text-lg ${online ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                                  {session.name.charAt(0).toUpperCase()}
                                  <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${online ? 'bg-green-500' : 'bg-gray-400'}`} />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-gray-900">{session.name}</span>
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${info.classes}`}>{info.label}</span>
                                  </div>
                                  <div className="text-xs text-gray-500">@{session.username}</div>
                                </div>
                              </div>
                              {/* Status badge */}
                              <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${online ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-green-600' : 'bg-gray-500'}`} />
                                {online ? 'En ligne' : 'Inactif'}
                              </div>
                            </div>

                            {/* Stats grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                              <div className="bg-white rounded-lg p-3 border border-gray-100">
                                <div className="text-xs text-gray-500 mb-0.5">Connexion</div>
                                <div className="text-xs font-semibold text-gray-800">{formatDateTime(session.loginAt)}</div>
                              </div>
                              <div className="bg-white rounded-lg p-3 border border-gray-100">
                                <div className="text-xs text-gray-500 mb-0.5">Dernière activité</div>
                                <div className="text-xs font-semibold text-gray-800">{formatDateTime(session.lastSeen)}</div>
                              </div>
                              <div className="bg-white rounded-lg p-3 border border-gray-100">
                                <div className="text-xs text-gray-500 mb-0.5">Durée de session</div>
                                <div className="text-xs font-semibold text-gray-800">{formatDuration(session.loginAt)}</div>
                              </div>
                              <div className="bg-white rounded-lg p-3 border border-gray-100">
                                <div className="text-xs text-gray-500 mb-0.5">Adresse IP</div>
                                <div className="text-xs font-semibold text-gray-800 font-mono">{session.ip}</div>
                              </div>
                            </div>

                            {/* Quick activity link */}
                            <div className="mt-3 flex justify-end">
                              <button
                                onClick={() => {
                                  setActivityUserFilter(session.userId);
                                  activityUserFilterRef.current = session.userId;
                                  fetchActivities(session.userId);
                                  setMonitoringTab('activities');
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800 underline"
                              >
                                Voir l'activité de {session.name} →
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── Activities tab ── */}
              {monitoringTab === 'activities' && (
                <div className="p-6">
                  {/* Filter bar */}
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <span className="text-sm text-gray-600 font-medium">Filtrer par utilisateur :</span>
                    <button
                      onClick={() => {
                        setActivityUserFilter(null);
                        activityUserFilterRef.current = null;
                        fetchActivities(null);
                      }}
                      className={`rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${activityUserFilter === null ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}
                    >
                      Tous
                    </button>
                    {Array.from(new Map(activityLogs.map((a) => [a.userId, { id: a.userId, name: a.name, username: a.username }])).values()).map((u) => (
                      <button
                        key={u.id}
                        onClick={() => {
                          setActivityUserFilter(u.id);
                          activityUserFilterRef.current = u.id;
                          fetchActivities(u.id);
                        }}
                        className={`rounded-full px-3 py-1 text-xs font-semibold border transition-colors ${activityUserFilter === u.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}
                      >
                        {u.name}
                      </button>
                    ))}
                  </div>

                  {activityLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                      <Clock className="w-12 h-12 mb-3 opacity-30" />
                      <p className="text-sm">Aucune activité enregistrée.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">Date / Heure</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Utilisateur</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Détails</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {activityLogs.map((entry) => (
                            <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap font-mono">
                                {formatDateTime(entry.timestamp)}
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-medium text-gray-900 text-xs">{entry.name}</div>
                                <div className="text-gray-400 text-xs">@{entry.username}</div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getActionStyle(entry.action)}`}>
                                  {entry.action}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-600 max-w-xs truncate">{entry.details || '—'}</td>
                              <td className="px-4 py-3 text-xs text-gray-500 font-mono whitespace-nowrap">{entry.ip}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showUserModal && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowUserModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Gestion des utilisateurs</h2>
              <button onClick={() => setShowUserModal(false)} className="text-gray-500 hover:text-gray-900" aria-label="Fermer">✕</button>
            </div>
            <div className="flex justify-end mb-4">
              <button
                onClick={openUserCreate}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Ajouter un utilisateur
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom d'utilisateur</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom complet</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rôle</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Permissions</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sites</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {userAccounts.map((user) => {
                    const info = roleDisplay[user.role] ?? { label: user.role, classes: 'bg-gray-100 text-gray-700' };
                    return (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900 font-mono">{user.username}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{user.name}</td>
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
                                const cls: Record<string, string> = {
                                  blue: 'bg-blue-100 text-blue-700',
                                  green: 'bg-green-100 text-green-700',
                                  orange: 'bg-orange-100 text-orange-700'
                                };
                                return (
                                  <span key={p.value} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls[p.color]}`}>{p.label}</span>
                                );
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
                          <div className="flex items-center gap-2">
                            <button onClick={() => openAccessModal(user)} title="Gérer rôle, permissions et sites"
                              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 font-medium">
                              Accès
                            </button>
                            <button onClick={() => openUserEdit(user)} className="text-blue-600 hover:text-blue-900" title="Modifier identité">
                              <Edit className="w-4 h-4" />
                            </button>
                            {user.id !== currentUser.id && (
                              <button onClick={() => handleDeleteUser(user.id)} className="text-red-600 hover:text-red-900" title="Supprimer">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {userAccounts.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">Aucun utilisateur trouvé.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showUserFormModal && (
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowUserFormModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{userEditingId ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}</h2>
              <button onClick={() => setShowUserFormModal(false)} className="text-gray-500 hover:text-gray-900" aria-label="Fermer">✕</button>
            </div>
            {userFormError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{userFormError}</div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom d'utilisateur *</label>
                <input
                  type="text"
                  value={userFormData.username}
                  onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet *</label>
                <input
                  type="text"
                  value={userFormData.name}
                  onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rôle *</label>
                <select
                  value={userFormData.role}
                  onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value as UserFormData['role'] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="admin">Administrateur</option>
                  <option value="technicien">Technicien</option>
                  <option value="user">Utilisateur</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mot de passe {!userEditingId && '*'}
                </label>
                <input
                  type="password"
                  value={userFormData.password}
                  onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                  placeholder={userEditingId ? 'Laisser vide pour ne pas changer' : ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Permissions */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Permissions *</label>
                {userFormData.role === 'admin' ? (
                  <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                    Les administrateurs ont automatiquement toutes les permissions.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {PERMISSION_CONFIG.map((perm) => {
                      const checked = userFormData.permissions.includes(perm.value);
                      const colorMap: Record<string, string> = {
                        blue:   checked ? 'border-blue-400 bg-blue-50'   : 'border-gray-200 hover:border-blue-300',
                        green:  checked ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-green-300',
                        orange: checked ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-orange-300'
                      };
                      const badgeMap: Record<string, string> = {
                        blue: 'bg-blue-100 text-blue-700', green: 'bg-green-100 text-green-700', orange: 'bg-orange-100 text-orange-700'
                      };
                      return (
                        <label
                          key={perm.value}
                          className={`flex items-center gap-3 rounded-lg border-2 p-3 cursor-pointer transition-colors ${colorMap[perm.color]}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...userFormData.permissions, perm.value]
                                : userFormData.permissions.filter((p) => p !== perm.value);
                              setUserFormData({ ...userFormData, permissions: next });
                            }}
                            className="h-4 w-4 rounded border-gray-300 accent-blue-600"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-800">{perm.label}</span>
                              {checked && (
                                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badgeMap[perm.color]}`}>Actif</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">{perm.desc}</p>
                          </div>
                        </label>
                      );
                    })}
                    {userFormData.permissions.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">⚠ Aucune permission sélectionnée — l'utilisateur ne pourra rien faire.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Sites autorisés */}
              {userFormData.role !== 'admin' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sites autorisés
                    <span className="ml-2 text-xs text-gray-400 font-normal">(aucun coché = accès à tous)</span>
                  </label>
                  {sites.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Aucun site configuré.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
                      {sites.map(site => {
                        const checked = userFormData.allowedSiteIds.includes(site.id);
                        return (
                          <label key={site.id} className={`flex items-center gap-3 rounded-lg border-2 p-2.5 cursor-pointer transition-colors ${checked ? 'border-sky-400 bg-sky-50' : 'border-gray-200 hover:border-sky-300'}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...userFormData.allowedSiteIds, site.id]
                                  : userFormData.allowedSiteIds.filter(sid => sid !== site.id);
                                setUserFormData({ ...userFormData, allowedSiteIds: next });
                              }}
                              className="h-4 w-4 rounded accent-sky-600"
                            />
                            <div>
                              <div className="text-sm font-medium text-gray-800">{site.name}</div>
                              {(site.city || site.country) && <div className="text-xs text-gray-400">{[site.city, site.country].filter(Boolean).join(', ')}</div>}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {userFormData.allowedSiteIds.length === 0 && sites.length > 0 && (
                    <p className="text-xs text-gray-400 mt-1">Accès à tous les sites.</p>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUserFormModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleUserSubmit}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {userEditingId ? 'Modifier' : 'Ajouter'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modale Gestion des accès ════════════════════════════════════════ */}
      {showAccessModal && accessTarget && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50" onClick={() => setShowAccessModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Gestion des accès</h2>
                <p className="text-sm text-gray-500">{accessTarget.name} <span className="font-mono text-gray-400">@{accessTarget.username}</span></p>
              </div>
              <button onClick={() => setShowAccessModal(false)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>

            <div className="px-6 py-5 space-y-6">
              {accessError && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{accessError}</div>}

              {/* Rôle */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Rôle</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: 'admin', label: 'Administrateur', desc: 'Accès complet', color: 'red' },
                    { value: 'technicien', label: 'Technicien', desc: 'Selon permissions', color: 'blue' },
                    { value: 'user', label: 'Utilisateur', desc: 'Selon permissions', color: 'gray' },
                  ] as const).map(r => (
                    <label key={r.value} className={`flex flex-col gap-1 rounded-xl border-2 p-3 cursor-pointer transition-colors ${accessForm.role === r.value ? r.value === 'admin' ? 'border-red-400 bg-red-50' : r.value === 'technicien' ? 'border-blue-400 bg-blue-50' : 'border-gray-400 bg-gray-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <input type="radio" name="role" value={r.value} checked={accessForm.role === r.value}
                        onChange={() => setAccessForm(f => ({ ...f, role: r.value }))} className="sr-only" />
                      <span className="text-sm font-semibold text-gray-800">{r.label}</span>
                      <span className="text-xs text-gray-500">{r.desc}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Permissions */}
              {accessForm.role !== 'admin' ? (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Permissions</label>
                  <div className="space-y-2">
                    {PERMISSION_CONFIG.map(perm => {
                      const checked = accessForm.permissions.includes(perm.value);
                      const colorMap: Record<string, string> = {
                        blue:   checked ? 'border-blue-400 bg-blue-50'   : 'border-gray-200 hover:border-blue-300',
                        green:  checked ? 'border-green-400 bg-green-50' : 'border-gray-200 hover:border-green-300',
                        orange: checked ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-orange-300',
                      };
                      return (
                        <label key={perm.value} className={`flex items-center gap-3 rounded-xl border-2 p-3 cursor-pointer transition-colors ${colorMap[perm.color]}`}>
                          <input type="checkbox" checked={checked}
                            onChange={e => {
                              const next = e.target.checked ? [...accessForm.permissions, perm.value] : accessForm.permissions.filter(p => p !== perm.value);
                              setAccessForm(f => ({ ...f, permissions: next }));
                            }}
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
                <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                  Les administrateurs ont automatiquement toutes les permissions.
                </div>
              )}

              {/* Sites */}
              {accessForm.role !== 'admin' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-semibold text-gray-700">Sites autorisés</label>
                    <span className="text-xs text-gray-400">Aucun coché = accès à tous</span>
                  </div>
                  {sites.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Aucun site configuré.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-2">
                      {sites.map(site => {
                        const checked = accessForm.allowedSiteIds.includes(site.id);
                        return (
                          <label key={site.id} className={`flex items-center gap-3 rounded-lg border-2 p-2.5 cursor-pointer transition-colors ${checked ? 'border-sky-400 bg-sky-50' : 'border-gray-200 hover:border-sky-300'}`}>
                            <input type="checkbox" checked={checked}
                              onChange={e => {
                                const next = e.target.checked ? [...accessForm.allowedSiteIds, site.id] : accessForm.allowedSiteIds.filter(id => id !== site.id);
                                setAccessForm(f => ({ ...f, allowedSiteIds: next }));
                              }}
                              className="h-4 w-4 rounded border-gray-300 accent-sky-600" />
                            <div>
                              <div className="text-sm font-semibold text-gray-800">{site.name}</div>
                              {(site.city || site.country) && <div className="text-xs text-gray-400">{[site.city, site.country].filter(Boolean).join(', ')}</div>}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {accessForm.allowedSiteIds.length === 0 && sites.length > 0 && (
                    <p className="text-xs text-gray-400 mt-1">Accès à tous les sites.</p>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t flex justify-end gap-3 bg-gray-50 rounded-b-2xl">
              <button onClick={() => setShowAccessModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 text-sm">Annuler</button>
              <button onClick={handleSaveAccess} disabled={accessLoading}
                className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {accessLoading ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Journal d'activité ═══════════════════════════════════════════════ */}
      {showActivityLog && (
        <div className="fixed inset-0 z-50 flex flex-col bg-gray-50">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-teal-100 flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Journal d'activité</h2>
                <p className="text-sm text-gray-500">{activityEntries.length} entrée(s) affichée(s)</p>
              </div>
            </div>
            <button onClick={() => setShowActivityLog(false)} className="p-2 rounded-lg hover:bg-gray-100">
              <XCircle className="w-6 h-6 text-gray-500" />
            </button>
          </div>

          {/* Filters */}
          <div className="px-6 py-4 bg-white border-b border-gray-100 shrink-0">
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Utilisateur</label>
                <select
                  value={activityFilter.username}
                  onChange={e => setActivityFilter(f => ({ ...f, username: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-400"
                >
                  <option value="">— Tous les utilisateurs —</option>
                  {userAccounts.map((u: UserAccount) => <option key={u.id} value={u.username}>{u.name} ({u.username})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Type d'action</label>
                <select
                  value={activityFilter.action}
                  onChange={e => setActivityFilter(f => ({ ...f, action: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-400"
                >
                  <option value="">— Toutes les actions —</option>
                  {['Connexion','Déconnexion','Ajout équipement','Modification équipement','Suppression équipement',
                    'Transfert équipement','Réforme équipement','Création utilisateur','Modification utilisateur',
                    'Suppression utilisateur','Création site','Modification site','Suppression site',
                    'Ticket maintenance','MAJ maintenance','Ajout document','Suppression document','Export CSV'].map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Du</label>
                <input type="date" value={activityFilter.dateFrom}
                  onChange={e => setActivityFilter(f => ({ ...f, dateFrom: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Au</label>
                <input type="date" value={activityFilter.dateTo}
                  onChange={e => setActivityFilter(f => ({ ...f, dateTo: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-400" />
              </div>
              <button
                onClick={() => {
                  const reset = { username: '', dateFrom: '', dateTo: '', action: '' };
                  setActivityFilter(reset);
                  fetchActivityLog(reset);
                }}
                className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
              >
                Réinitialiser
              </button>
              {activityEntries.length > 0 && (
                <>
                <button
                  onClick={() => {
                    const rows = activityEntries.map(e => ({
                      'Date / Heure': new Date(e.createdAt).toLocaleString('fr-FR'),
                      'Utilisateur': e.userName,
                      'Login': e.username,
                      'Action': e.action,
                      'Détails': e.details,
                      'IP': e.ip,
                    }));
                    const ws = XLSX.utils.json_to_sheet(rows);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, 'Journal');
                    XLSX.writeFile(wb, `journal-activite-${new Date().toISOString().slice(0,10)}.xlsx`);
                  }}
                  className="ml-auto inline-flex items-center gap-2 px-4 py-2 border border-green-300 text-green-700 rounded-lg text-sm hover:bg-green-50"
                >
                  <Download className="w-4 h-4" /> Excel
                </button>
                <button
                  onClick={() => {
                    const doc = new jsPDF({ orientation: 'landscape' });
                    const dateStr = new Date().toLocaleDateString('fr-FR');
                    const filterLabel = [
                      activityFilter.username ? `Utilisateur : ${activityFilter.username}` : '',
                      activityFilter.action   ? `Action : ${activityFilter.action}` : '',
                      activityFilter.dateFrom ? `Du : ${activityFilter.dateFrom}` : '',
                      activityFilter.dateTo   ? `Au : ${activityFilter.dateTo}` : '',
                    ].filter(Boolean).join('  |  ');
                    doc.setFontSize(14);
                    doc.text("Journal d'activité", 14, 14);
                    doc.setFontSize(8);
                    doc.text(`Exporté le ${dateStr} — ${activityEntries.length} entrée(s)${filterLabel ? `  |  ${filterLabel}` : ''}`, 14, 21);
                    autoTable(doc, {
                      startY: 26,
                      head: [['Date / Heure', 'Utilisateur', 'Login', 'Action', 'Détails', 'IP']],
                      body: activityEntries.map(e => [
                        new Date(e.createdAt).toLocaleString('fr-FR'),
                        e.userName,
                        e.username,
                        e.action,
                        e.details || '—',
                        e.ip || '—',
                      ]),
                      styles: { fontSize: 7, cellPadding: 2 },
                      headStyles: { fillColor: [13, 148, 136] },
                      alternateRowStyles: { fillColor: [245, 250, 250] },
                      columnStyles: { 4: { cellWidth: 70 } },
                    });
                    doc.save(`journal-activite-${new Date().toISOString().slice(0,10)}.pdf`);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-red-300 text-red-700 rounded-lg text-sm hover:bg-red-50"
                >
                  <FileText className="w-4 h-4" /> PDF
                </button>
                </>
              )}
            </div>
          </div>

          {/* Stats bar */}
          {activityEntries.length > 0 && (() => {
            const connexions   = activityEntries.filter(e => e.action === 'Connexion').length;
            const modifications = activityEntries.filter(e => e.action.includes('équipement') || e.action.includes('utilisateur') || e.action.includes('site')).length;
            const uniqueUsers  = new Set(activityEntries.map(e => e.username)).size;
            const lastEntry    = activityEntries[0];
            return (
              <div className="px-6 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white border-b border-gray-100 shrink-0">
                {[
                  { label: 'Total actions', value: activityEntries.length, color: 'text-teal-700', bg: 'bg-teal-50' },
                  { label: 'Utilisateurs actifs', value: uniqueUsers, color: 'text-blue-700', bg: 'bg-blue-50' },
                  { label: 'Connexions', value: connexions, color: 'text-green-700', bg: 'bg-green-50' },
                  { label: 'Opérations', value: modifications, color: 'text-purple-700', bg: 'bg-purple-50' },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className={`${bg} rounded-lg px-4 py-2 text-center`}>
                    <p className={`text-xl font-bold ${color}`}>{value}</p>
                    <p className="text-xs text-gray-500">{label}</p>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Table */}
          <div className="flex-1 overflow-auto px-6 py-4">
            {activityLogLoading ? (
              <div className="flex items-center justify-center h-40 text-gray-400">
                <span className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mr-3" />
                Chargement…
              </div>
            ) : activityEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                <ClipboardList className="w-10 h-10 mb-2 opacity-30" />
                <p>Aucune activité trouvée pour ces critères.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['Date / Heure', 'Utilisateur', 'Action', 'Détails', 'IP'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {activityEntries.map(entry => {
                      const isAuth = entry.action === 'Connexion' || entry.action === 'Déconnexion';
                      const isDanger = entry.action.includes('Suppression');
                      const isWrite = entry.action.includes('Ajout') || entry.action.includes('Création') || entry.action.includes('Réforme') || entry.action.includes('Transfert');
                      const badgeClass = isDanger
                        ? 'bg-red-100 text-red-700'
                        : isWrite
                          ? 'bg-purple-100 text-purple-700'
                          : isAuth
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600';
                      return (
                        <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                            {new Date(entry.createdAt).toLocaleString('fr-FR', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{entry.userName}</p>
                            <p className="text-xs text-gray-400">{entry.username}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${badgeClass}`}>
                              {entry.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-xs max-w-xs">
                            <span className="line-clamp-2">{entry.details || '—'}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400 font-mono whitespace-nowrap">{entry.ip || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ITEquipmentManager;
